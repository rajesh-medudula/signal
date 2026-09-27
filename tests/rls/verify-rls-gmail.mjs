// Exercises the actual RLS policies (or, for
// gmail_connection_credentials, the deliberate absence of any),
// privilege revocations, the composite foreign key, and the
// persist_gmail_connection function from
// supabase/migrations/20260925081753_gmail_connection_foundation.sql
// against a real local Postgres instance — same harness pattern as
// tests/rls/verify-rls.mjs and verify-rls-conversations.mjs.
//
// Needs the same local Postgres + tests/rls/auth-shim.sql setup as
// those harnesses, PLUS this module's own migration applied on top of
// Module 2B's and Module 3A's:
//
//   createdb signal_test
//   psql -h 127.0.0.1 -U postgres -d signal_test -f tests/rls/auth-shim.sql
//   psql -h 127.0.0.1 -U postgres -d signal_test \
//     -f supabase/migrations/20260903061958_business_membership_foundation.sql
//   psql -h 127.0.0.1 -U postgres -d signal_test \
//     -f supabase/migrations/20260924120000_customer_conversation_message_foundation.sql
//   psql -h 127.0.0.1 -U postgres -d signal_test \
//     -f supabase/migrations/20260925081753_gmail_connection_foundation.sql
//
// `pg` isn't a project dependency (same as the other harnesses here) —
// install it ad hoc (`npm install pg --no-save`) before running.
//
// Run: node tests/rls/verify-rls-gmail.mjs
import { Client } from "pg";

const CONN = "postgres://postgres:postgres@127.0.0.1:5432/signal_test";

let pass = 0;
let fail = 0;

function check(name, condition) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}`);
  }
}

async function withClient(fn) {
  const client = new Client(CONN);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Runs `fn` in its own transaction, impersonating `userId` as the
 * `authenticated` role — same mechanism the other harnesses use. */
async function asUser(userId, fn) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      await client.query(
        `select set_config('request.jwt.claims', $1, true)`,
        [JSON.stringify({ sub: userId, role: "authenticated" })],
      );
      await client.query("set local role authenticated");
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    }
  });
}

/** Runs `fn` in its own transaction as `service_role` — trusted
 * backend infrastructure (lib/channels/gmail/credentials.ts), bypasses
 * RLS entirely. */
async function asServiceRole(fn) {
  return withClient(async (client) => {
    await client.query("begin");
    try {
      await client.query("set local role service_role");
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    }
  });
}

async function expectError(promise, pattern) {
  try {
    await promise;
    return { threw: false };
  } catch (err) {
    return { threw: true, matches: pattern.test(err.message) };
  }
}

async function main() {
  const admin = new Client(CONN);
  await admin.connect();

  // ---------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------
  console.log("--- Fixtures ---");

  const userA = (
    await admin.query(
      "insert into auth.users (email) values ('gmail-a@example.com') returning id",
    )
  ).rows[0].id;
  const userB = (
    await admin.query(
      "insert into auth.users (email) values ('gmail-b@example.com') returning id",
    )
  ).rows[0].id;

  const businessA = (
    await asUser(userA, (c) =>
      c.query("select * from public.onboard_business($1)", ["Gmail Tenant A"]),
    )
  ).rows[0];
  const businessB = (
    await asUser(userB, (c) =>
      c.query("select * from public.onboard_business($1)", ["Gmail Tenant B"]),
    )
  ).rows[0];

  console.log("--- persist_gmail_connection (service_role) ---");

  // Initial connect for business A.
  const connectA1 = (
    await asServiceRole((c) =>
      c.query(
        `select * from public.persist_gmail_connection($1, $2, $3, $4, $5, $6, $7)`,
        [
          businessA.id,
          "google-sub-a1",
          "Gmail · hello@a.example.com",
          "hello@a.example.com",
          ["openid", "email", "https://www.googleapis.com/auth/gmail.metadata"],
          "ciphertext-a1-v1",
          1,
        ],
      ),
    )
  ).rows[0];

  check(
    "initial connect creates a connected channel_connections row",
    !!connectA1.result_channel_connection_id && connectA1.result_was_reconnect === false,
  );

  const connA1Row = (
    await admin.query(
      "select status, display_label, channel, external_account_id from public.channel_connections where id = $1",
      [connectA1.result_channel_connection_id],
    )
  ).rows[0];
  check(
    "the created row has channel='gmail' and status='connected'",
    connA1Row.channel === "gmail" && connA1Row.status === "connected",
  );

  // Reconnect, no new refresh token: ciphertext + label must be retained.
  const reconnectNoToken = (
    await asServiceRole((c) =>
      c.query(
        `select * from public.persist_gmail_connection($1, $2, $3, $4, $5, $6, $7)`,
        [
          businessA.id,
          "google-sub-a1",
          "Gmail · ignored-on-reconnect@a.example.com",
          "hello@a.example.com",
          ["openid", "email", "https://www.googleapis.com/auth/gmail.metadata"],
          null,
          null,
        ],
      ),
    )
  ).rows[0];
  check(
    "reconnect without a new token resolves to the same connection and reports was_reconnect=true",
    reconnectNoToken.result_channel_connection_id === connectA1.result_channel_connection_id &&
      reconnectNoToken.result_was_reconnect === true,
  );

  const afterReconnectNoToken = (
    await admin.query(
      "select refresh_token_ciphertext, encryption_key_version from public.gmail_connection_credentials where channel_connection_id = $1",
      [connectA1.result_channel_connection_id],
    )
  ).rows[0];
  check(
    "the original ciphertext and key version are retained (not nulled/overwritten)",
    afterReconnectNoToken.refresh_token_ciphertext === "ciphertext-a1-v1" &&
      afterReconnectNoToken.encryption_key_version === 1,
  );

  const labelAfterReconnect = (
    await admin.query(
      "select display_label from public.channel_connections where id = $1",
      [connectA1.result_channel_connection_id],
    )
  ).rows[0].display_label;
  check(
    "an existing display_label is never overwritten by a reconnect",
    labelAfterReconnect === "Gmail · hello@a.example.com",
  );

  // Reconnect with a genuinely new token: must replace.
  await asServiceRole((c) =>
    c.query(
      `select * from public.persist_gmail_connection($1, $2, $3, $4, $5, $6, $7)`,
      [
        businessA.id,
        "google-sub-a1",
        "Gmail · hello@a.example.com",
        "hello@a.example.com",
        ["openid", "email", "https://www.googleapis.com/auth/gmail.metadata"],
        "ciphertext-a1-v2",
        1,
      ],
    ),
  );
  const afterReplace = (
    await admin.query(
      "select refresh_token_ciphertext from public.gmail_connection_credentials where channel_connection_id = $1",
      [connectA1.result_channel_connection_id],
    )
  ).rows[0];
  check(
    "reconnect with a new token replaces the stored ciphertext",
    afterReplace.refresh_token_ciphertext === "ciphertext-a1-v2",
  );

  // A brand-new connection with no refresh token and no existing
  // credential must fail closed and leave no rows behind.
  const beforeCount = (
    await admin.query(
      "select count(*)::int as n from public.channel_connections where business_id = $1",
      [businessA.id],
    )
  ).rows[0].n;

  const failedInsert = await expectError(
    asServiceRole((c) =>
      c.query(
        `select * from public.persist_gmail_connection($1, $2, $3, $4, $5, $6, $7)`,
        [
          businessA.id,
          "google-sub-a-new",
          "Gmail · new@a.example.com",
          "new@a.example.com",
          ["openid", "email"],
          null,
          null,
        ],
      ),
    ),
    /not-null constraint/i,
  );
  check(
    "a brand-new connection with no refresh token is rejected (NOT NULL backstop)",
    failedInsert.threw && failedInsert.matches,
  );

  const afterCount = (
    await admin.query(
      "select count(*)::int as n from public.channel_connections where business_id = $1",
      [businessA.id],
    )
  ).rows[0].n;
  check(
    "the failed attempt left no orphaned channel_connections row behind (atomicity)",
    afterCount === beforeCount,
  );

  console.log("--- Cross-tenant isolation ---");

  // connectA1 already has a credential row from the steps above (its
  // primary key is channel_connection_id) — remove it first so this
  // check actually exercises the composite FK rather than tripping
  // the primary-key uniqueness constraint instead.
  await asServiceRole((c) =>
    c.query(
      "delete from public.gmail_connection_credentials where channel_connection_id = $1",
      [connectA1.result_channel_connection_id],
    ),
  );

  const cannotSpoofCrossTenantCredential = await expectError(
    asServiceRole((c) =>
      c.query(
        `insert into public.gmail_connection_credentials
           (channel_connection_id, business_id, refresh_token_ciphertext, authenticated_email)
         values ($1, $2, 'x', 'x@x.com')`,
        [connectA1.result_channel_connection_id, businessB.id],
      ),
    ),
    /foreign key constraint/i,
  );
  check(
    "the composite FK rejects attaching business A's connection to business B's credential row, even for service_role",
    cannotSpoofCrossTenantCredential.threw && cannotSpoofCrossTenantCredential.matches,
  );

  console.log("--- Authenticated-role privilege boundary ---");

  const authenticatedSelectDenied = await expectError(
    asUser(userA, (c) =>
      c.query("select * from public.gmail_connection_credentials"),
    ),
    /permission denied/i,
  );
  check(
    "authenticated (even the connection's own business owner) cannot SELECT gmail_connection_credentials",
    authenticatedSelectDenied.threw && authenticatedSelectDenied.matches,
  );

  const authenticatedInsertDenied = await expectError(
    asUser(userA, (c) =>
      c.query(
        `insert into public.gmail_connection_credentials
           (channel_connection_id, business_id, refresh_token_ciphertext, authenticated_email)
         values (gen_random_uuid(), $1, 'x', 'x@x.com')`,
        [businessA.id],
      ),
    ),
    /permission denied/i,
  );
  check(
    "authenticated cannot INSERT into gmail_connection_credentials",
    authenticatedInsertDenied.threw && authenticatedInsertDenied.matches,
  );

  const authenticatedUpdateDenied = await expectError(
    asUser(userA, (c) =>
      c.query(
        `update public.gmail_connection_credentials
         set authenticated_email = 'hijacked@evil.example'
         where channel_connection_id = $1`,
        [connectA1.result_channel_connection_id],
      ),
    ),
    /permission denied/i,
  );
  check(
    "authenticated cannot UPDATE gmail_connection_credentials",
    authenticatedUpdateDenied.threw && authenticatedUpdateDenied.matches,
  );

  const authenticatedDeleteDenied = await expectError(
    asUser(userA, (c) =>
      c.query(
        "delete from public.gmail_connection_credentials where channel_connection_id = $1",
        [connectA1.result_channel_connection_id],
      ),
    ),
    /permission denied/i,
  );
  check(
    "authenticated cannot DELETE from gmail_connection_credentials",
    authenticatedDeleteDenied.threw && authenticatedDeleteDenied.matches,
  );

  const authenticatedRpcDenied = await expectError(
    asUser(userA, (c) =>
      c.query(
        `select * from public.persist_gmail_connection($1, $2, $3, $4, $5, $6, $7)`,
        [businessA.id, "google-sub-hijack", "x", "x@x.com", [], "x", 1],
      ),
    ),
    /permission denied/i,
  );
  check(
    "authenticated cannot call persist_gmail_connection directly, even as the business owner",
    authenticatedRpcDenied.threw && authenticatedRpcDenied.matches,
  );

  console.log(
    "--- Existing channel_connections read access (item 47: no new read path for the row itself) ---",
  );

  const ownerCanReadConnection = await asUser(userA, (c) =>
    c.query("select id, status from public.channel_connections where id = $1", [
      connectA1.result_channel_connection_id,
    ]),
  );
  check(
    "business A's owner can still read the channel_connections row via Module 3A's existing policy (unchanged)",
    ownerCanReadConnection.rows.length === 1,
  );

  const otherBusinessCannotReadConnection = await asUser(userB, (c) =>
    c.query("select id from public.channel_connections where id = $1", [
      connectA1.result_channel_connection_id,
    ]),
  );
  check(
    "business B cannot read business A's channel_connections row (Module 3A's existing tenant isolation, unaffected by Module 4)",
    otherBusinessCannotReadConnection.rows.length === 0,
  );

  console.log("--- Multiple Gmail accounts per business ---");

  const connectA2 = (
    await asServiceRole((c) =>
      c.query(
        `select * from public.persist_gmail_connection($1, $2, $3, $4, $5, $6, $7)`,
        [
          businessA.id,
          "google-sub-a2",
          "Gmail · other@a.example.com",
          "other@a.example.com",
          ["openid", "email"],
          "ciphertext-a2-v1",
          1,
        ],
      ),
    )
  ).rows[0];
  check(
    "a second, distinct Gmail account for the same business creates a second connection",
    connectA2.result_channel_connection_id !== connectA1.result_channel_connection_id,
  );

  const businessAConnectionCount = (
    await admin.query(
      "select count(*)::int as n from public.channel_connections where business_id = $1 and channel = 'gmail'",
      [businessA.id],
    )
  ).rows[0].n;
  check(
    "business A now has exactly 2 Gmail connections",
    businessAConnectionCount === 2,
  );

  console.log("--- Atomic Gmail disconnect ---");

  const authenticatedDisconnectDenied = await expectError(
    asUser(userA, (c) =>
      c.query(
        "select * from public.disconnect_gmail_connection($1, $2)",
        [businessA.id, connectA2.result_channel_connection_id],
      ),
    ),
    /permission denied/i,
  );
  check(
    "authenticated cannot call disconnect_gmail_connection directly",
    authenticatedDisconnectDenied.threw && authenticatedDisconnectDenied.matches,
  );

  const wrongBusinessDisconnect = (
    await asServiceRole((c) =>
      c.query(
        "select * from public.disconnect_gmail_connection($1, $2)",
        [businessB.id, connectA2.result_channel_connection_id],
      ),
    )
  ).rows[0];
  check(
    "disconnect with another business id is a no-op",
    wrongBusinessDisconnect.result_disconnected === false,
  );

  const disconnected = (
    await asServiceRole((c) =>
      c.query(
        "select * from public.disconnect_gmail_connection($1, $2)",
        [businessA.id, connectA2.result_channel_connection_id],
      ),
    )
  ).rows[0];
  const disconnectedState = (
    await admin.query(
      `select c.status, cr.channel_connection_id
       from public.channel_connections c
       left join public.gmail_connection_credentials cr
         on cr.channel_connection_id = c.id
       where c.id = $1 and c.business_id = $2`,
      [connectA2.result_channel_connection_id, businessA.id],
    )
  ).rows[0];
  check(
    "atomic disconnect reports success and leaves a disconnected row without a credential",
    disconnected.result_disconnected === true &&
      disconnectedState.status === "disconnected" &&
      disconnectedState.channel_connection_id === null,
  );

  await admin.end();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test harness crashed:", err);
  process.exit(1);
});
