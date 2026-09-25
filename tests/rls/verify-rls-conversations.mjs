// Exercises the actual RLS policies, privilege revocations, foreign
// keys, CHECK constraints, and the concurrency-corrected
// last_message_* trigger from
// supabase/migrations/20260924120000_customer_conversation_message_foundation.sql
// against a real local Postgres instance — the same harness pattern as
// tests/rls/verify-rls.mjs, extended to also impersonate `service_role`
// (trusted backend infrastructure) where the design requires it.
//
// Needs the same local Postgres + tests/rls/auth-shim.sql setup as
// verify-rls.mjs, PLUS this module's own migration applied on top of
// Module 2B's:
//
//   createdb signal_test
//   psql -h 127.0.0.1 -U postgres -d signal_test -f tests/rls/auth-shim.sql
//   psql -h 127.0.0.1 -U postgres -d signal_test \
//     -f supabase/migrations/20260903061958_business_membership_foundation.sql
//   psql -h 127.0.0.1 -U postgres -d signal_test \
//     -f supabase/migrations/20260924120000_customer_conversation_message_foundation.sql
//
// `pg` isn't a project dependency (same as verify-rls.mjs) — install it
// ad hoc (`npm install pg --no-save`) before running.
//
// Run: node tests/rls/verify-rls-conversations.mjs
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * `authenticated` role — same mechanism verify-rls.mjs uses. */
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

/** Runs `fn` in its own transaction as `service_role` — trusted backend
 * infrastructure, bypasses RLS entirely. */
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

async function main() {
  const admin = new Client(CONN);
  await admin.connect();

  // ---------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------
  console.log("--- Fixtures ---");

  const userA = (
    await admin.query(
      "insert into auth.users (email) values ('conv-a@example.com') returning id",
    )
  ).rows[0].id;
  const userB = (
    await admin.query(
      "insert into auth.users (email) values ('conv-b@example.com') returning id",
    )
  ).rows[0].id;

  const businessA = (
    await asUser(userA, (c) =>
      c.query("select * from public.onboard_business($1)", ["Conv Tenant A"]),
    )
  ).rows[0];
  const businessB = (
    await asUser(userB, (c) =>
      c.query("select * from public.onboard_business($1)", ["Conv Tenant B"]),
    )
  ).rows[0];

  const ccA1 = (
    await asUser(userA, (c) =>
      c.query(
        `insert into public.channel_connections
           (business_id, channel, display_label, external_account_id)
         values ($1, 'gmail', 'Support inbox', 'acct-a1')
         returning id`,
        [businessA.id],
      ),
    )
  ).rows[0];
  const ccA2 = (
    await asUser(userA, (c) =>
      c.query(
        `insert into public.channel_connections
           (business_id, channel, display_label, external_account_id)
         values ($1, 'whatsapp', 'WA number', 'acct-a2')
         returning id`,
        [businessA.id],
      ),
    )
  ).rows[0];
  const ccB1 = (
    await asUser(userB, (c) =>
      c.query(
        `insert into public.channel_connections
           (business_id, channel, display_label, external_account_id)
         values ($1, 'gmail', 'B inbox', 'acct-b1')
         returning id`,
        [businessB.id],
      ),
    )
  ).rows[0];

  const custA1 = (
    await asUser(userA, (c) =>
      c.query(
        `insert into public.customers (business_id, display_name, primary_email)
         values ($1, 'Ravi Kumar', 'ravi@example.com') returning id`,
        [businessA.id],
      ),
    )
  ).rows[0];
  const custA2 = (
    await asUser(userA, (c) =>
      c.query(
        `insert into public.customers (business_id, display_name)
         values ($1, 'Priya Singh') returning id`,
        [businessA.id],
      ),
    )
  ).rows[0];
  const custB1 = (
    await asUser(userB, (c) =>
      c.query(
        `insert into public.customers (business_id, display_name)
         values ($1, 'B Customer') returning id`,
        [businessB.id],
      ),
    )
  ).rows[0];

  const identityA1 = await asServiceRole((c) =>
    c.query(
      `insert into public.customer_identities
         (business_id, customer_id, channel_connection_id, external_identity_value)
       values ($1, $2, $3, 'ravi@example.com') returning id`,
      [businessA.id, custA1.id, ccA1.id],
    ),
  );
  check(
    "service_role CAN insert a customer_identity",
    identityA1.rows.length === 1,
  );

  const convA1 = (
    await asUser(userA, (c) =>
      c.query(
        `insert into public.conversations
           (business_id, customer_id, channel_connection_id, external_conversation_id)
         values ($1, $2, $3, 'thread-1') returning id`,
        [businessA.id, custA1.id, ccA1.id],
      ),
    )
  ).rows[0];
  const convB1 = (
    await asUser(userB, (c) =>
      c.query(
        `insert into public.conversations
           (business_id, customer_id, channel_connection_id, external_conversation_id)
         values ($1, $2, $3, 'thread-1') returning id`,
        [businessB.id, custB1.id, ccB1.id],
      ),
    )
  ).rows[0];

  const msg1 = (
    await asServiceRole((c) =>
      c.query(
        `insert into public.messages
           (business_id, conversation_id, channel_connection_id, external_message_id,
            direction, sender_type, sender_customer_id, body, provider_sent_at)
         values ($1, $2, $3, 'ext-m1', 'inbound', 'customer', $4,
                 'Website price entha bro?', now() - interval '1 hour')
         returning id, sequence`,
        [businessA.id, convA1.id, ccA1.id, custA1.id],
      ),
    )
  ).rows[0];

  const msg2 = (
    await asServiceRole((c) =>
      c.query(
        `insert into public.messages
           (business_id, conversation_id, channel_connection_id, external_message_id,
            direction, sender_type, sender_member_user_id, body, provider_sent_at)
         values ($1, $2, $3, 'ext-m2', 'outbound', 'business_member', $4,
                 'Sure, sending pricing now.', now())
         returning id, sequence`,
        [businessA.id, convA1.id, ccA1.id, userA],
      ),
    )
  ).rows[0];

  check(
    "service_role CAN insert canonical messages (customer + business_member senders)",
    msg1.id && msg2.id,
  );

  const afterFixtures = await admin.query(
    "select last_message_sequence, last_message_preview from public.conversations where id = $1",
    [convA1.id],
  );
  check(
    "trigger fast path (INSERT) sets last_message_sequence to the newest message after two sequential inserts",
    String(afterFixtures.rows[0].last_message_sequence) === String(msg2.sequence),
  );
  check(
    "trigger fast path (INSERT) sets last_message_preview from the newest message's body",
    afterFixtures.rows[0].last_message_preview === "Sure, sending pricing now.",
  );

  // ---------------------------------------------------------------
  console.log("--- 1. Tenant isolation ---");
  // ---------------------------------------------------------------

  const bReadsACustomers = await asUser(userB, (c) =>
    c.query("select * from public.customers where business_id = $1", [businessA.id]),
  );
  check(
    "userB reads ZERO of business A's customers",
    bReadsACustomers.rowCount === 0,
  );

  const bReadsAConversations = await asUser(userB, (c) =>
    c.query("select * from public.conversations where business_id = $1", [
      businessA.id,
    ]),
  );
  check(
    "userB reads ZERO of business A's conversations",
    bReadsAConversations.rowCount === 0,
  );

  const bReadsAMessages = await asUser(userB, (c) =>
    c.query("select * from public.messages where business_id = $1", [businessA.id]),
  );
  check("userB reads ZERO of business A's messages", bReadsAMessages.rowCount === 0);

  const bReadsAChannelConnections = await asUser(userB, (c) =>
    c.query("select * from public.channel_connections where business_id = $1", [
      businessA.id,
    ]),
  );
  check(
    "userB reads ZERO of business A's channel connections",
    bReadsAChannelConnections.rowCount === 0,
  );

  const bReadsACustomerIdentities = await asUser(userB, (c) =>
    c.query("select * from public.customer_identities where business_id = $1", [
      businessA.id,
    ]),
  );
  check(
    "userB reads ZERO of business A's customer identities",
    bReadsACustomerIdentities.rowCount === 0,
  );

  const bUpdatesAConversation = await asUser(userB, (c) =>
    c.query("update public.conversations set subject = 'hijacked' where id = $1", [
      convA1.id,
    ]),
  );
  check(
    "userB's UPDATE on business A's conversation affects ZERO rows",
    bUpdatesAConversation.rowCount === 0,
  );

  const bUpdatesACustomer = await asUser(userB, (c) =>
    c.query(
      "update public.customers set display_name = 'hijacked' where id = $1",
      [custA1.id],
    ),
  );
  check(
    "userB's UPDATE on business A's customer affects ZERO rows",
    bUpdatesACustomer.rowCount === 0,
  );

  let bInsertsCustomerForA = null;
  try {
    await asUser(userB, (c) =>
      c.query(
        "insert into public.customers (business_id, display_name) values ($1, 'spoofed')",
        [businessA.id],
      ),
    );
  } catch (err) {
    bInsertsCustomerForA = err;
  }
  check(
    "userB CANNOT insert a customer into business A (RLS WITH CHECK denies it)",
    bInsertsCustomerForA !== null &&
      /permission denied|row-level security/i.test(bInsertsCustomerForA.message),
  );

  console.log(
    "--- 2. Provenance & trust boundaries (messages / customer_identities) ---",
  );

  let authInsertMessage = null;
  try {
    await asUser(userA, (c) =>
      c.query(
        `insert into public.messages
           (business_id, conversation_id, channel_connection_id, external_message_id,
            direction, sender_type, sender_customer_id, body, provider_sent_at)
         values ($1, $2, $3, 'ext-spoof', 'inbound', 'customer', $4, 'spoofed', now())`,
        [businessA.id, convA1.id, ccA1.id, custA1.id],
      ),
    );
  } catch (err) {
    authInsertMessage = err;
  }
  check(
    "authenticated client CANNOT INSERT into messages (privilege revoked)",
    authInsertMessage !== null && /permission denied/i.test(authInsertMessage.message),
  );

  let authUpdateMessage = null;
  try {
    await asUser(userA, (c) =>
      c.query("update public.messages set body = 'tampered' where id = $1", [
        msg1.id,
      ]),
    );
  } catch (err) {
    authUpdateMessage = err;
  }
  check(
    "authenticated client CANNOT UPDATE messages (privilege revoked)",
    authUpdateMessage !== null && /permission denied/i.test(authUpdateMessage.message),
  );

  let authInsertIdentity = null;
  try {
    await asUser(userA, (c) =>
      c.query(
        `insert into public.customer_identities
           (business_id, customer_id, channel_connection_id, external_identity_value)
         values ($1, $2, $3, 'spoofed@example.com')`,
        [businessA.id, custA1.id, ccA1.id],
      ),
    );
  } catch (err) {
    authInsertIdentity = err;
  }
  check(
    "authenticated client CANNOT INSERT into customer_identities (privilege revoked)",
    authInsertIdentity !== null && /permission denied/i.test(authInsertIdentity.message),
  );

  const authReadsOwnMessages = await asUser(userA, (c) =>
    c.query("select * from public.messages where conversation_id = $1", [convA1.id]),
  );
  check(
    "authenticated member CAN still SELECT their own business's messages",
    authReadsOwnMessages.rowCount === 2,
  );

  console.log("--- 3. Sender & direction integrity ---");

  let mismatchedCustomerSender = null;
  try {
    await asServiceRole((c) =>
      c.query(
        `insert into public.messages
           (business_id, conversation_id, channel_connection_id, external_message_id,
            direction, sender_type, sender_customer_id, body, provider_sent_at)
         values ($1, $2, $3, 'ext-mismatch', 'inbound', 'customer', $4, 'wrong customer', now())`,
        [businessA.id, convA1.id, ccA1.id, custA2.id],
      ),
    );
  } catch (err) {
    mismatchedCustomerSender = err;
  }
  check(
    "sender_customer_id that doesn't match the conversation's customer is REJECTED (FK violation)",
    mismatchedCustomerSender !== null &&
      /foreign key/i.test(mismatchedCustomerSender.message),
  );

  let mismatchedChannelConnection = null;
  try {
    await asServiceRole((c) =>
      c.query(
        `insert into public.messages
           (business_id, conversation_id, channel_connection_id, external_message_id,
            direction, sender_type, sender_customer_id, body, provider_sent_at)
         values ($1, $2, $3, 'ext-wrong-channel', 'inbound', 'customer', $4, 'wrong channel connection', now())`,
        // ccA2 is a real channel connection for business A, but NOT the
        // one convA1 was created with (ccA1) — the composite FK
        // (conversation_id, business_id, channel_connection_id) ->
        // conversations(id, business_id, channel_connection_id) must
        // reject this even though ccA2 itself is perfectly valid.
        [businessA.id, convA1.id, ccA2.id, custA1.id],
      ),
    );
  } catch (err) {
    mismatchedChannelConnection = err;
  }
  check(
    "channel_connection_id that doesn't match the conversation's own channel_connection_id is REJECTED (composite FK violation)",
    mismatchedChannelConnection !== null &&
      /foreign key/i.test(mismatchedChannelConnection.message),
  );

  let foreignMemberSender = null;
  try {
    await asServiceRole((c) =>
      c.query(
        `insert into public.messages
           (business_id, conversation_id, channel_connection_id, external_message_id,
            direction, sender_type, sender_member_user_id, body, provider_sent_at)
         values ($1, $2, $3, 'ext-foreign-member', 'outbound', 'business_member', $4, 'not a member here', now())`,
        [businessA.id, convA1.id, ccA1.id, userB],
      ),
    );
  } catch (err) {
    foreignMemberSender = err;
  }
  check(
    "sender_member_user_id for a user with no membership in this business is REJECTED (FK violation)",
    foreignMemberSender !== null && /foreign key/i.test(foreignMemberSender.message),
  );

  let badDirectionSenderPair = null;
  try {
    await asServiceRole((c) =>
      c.query(
        `insert into public.messages
           (business_id, conversation_id, channel_connection_id, external_message_id,
            direction, sender_type, sender_customer_id, body, provider_sent_at)
         values ($1, $2, $3, 'ext-bad-pair', 'outbound', 'customer', $4, 'invalid pair', now())`,
        [businessA.id, convA1.id, ccA1.id, custA1.id],
      ),
    );
  } catch (err) {
    badDirectionSenderPair = err;
  }
  check(
    "direction='outbound' with sender_type='customer' is REJECTED (CHECK constraint)",
    badDirectionSenderPair !== null &&
      /violates check constraint/i.test(badDirectionSenderPair.message),
  );

  let systemInbound = null;
  try {
    await asServiceRole((c) =>
      c.query(
        `insert into public.messages
           (business_id, conversation_id, channel_connection_id, external_message_id,
            direction, sender_type, body, provider_sent_at)
         values ($1, $2, $3, 'ext-bad-system', 'inbound', 'system', 'invalid system direction', now())`,
        [businessA.id, convA1.id, ccA1.id],
      ),
    );
  } catch (err) {
    systemInbound = err;
  }
  check(
    "direction='inbound' with sender_type='system' is REJECTED (CHECK constraint)",
    systemInbound !== null && /violates check constraint/i.test(systemInbound.message),
  );

  const validSystemMessage = await asServiceRole((c) =>
    c.query(
      `insert into public.messages
         (business_id, conversation_id, channel_connection_id, external_message_id,
          direction, sender_type, body, provider_sent_at)
       values ($1, $2, $3, 'ext-system-ok', 'outbound', 'system', 'Auto-reply', now())
       returning id`,
      [businessA.id, convA1.id, ccA1.id],
    ),
  );
  check(
    "direction='outbound' with sender_type='system' and no sender IDs is ACCEPTED",
    validSystemMessage.rows.length === 1,
  );

  console.log("--- 4. External message identity ---");

  let nullExternalId = null;
  try {
    await asServiceRole((c) =>
      c.query(
        `insert into public.messages
           (business_id, conversation_id, channel_connection_id, external_message_id,
            direction, sender_type, sender_customer_id, body, provider_sent_at)
         values ($1, $2, $3, null, 'inbound', 'customer', $4, 'no external id', now())`,
        [businessA.id, convA1.id, ccA1.id, custA1.id],
      ),
    );
  } catch (err) {
    nullExternalId = err;
  }
  check(
    "external_message_id = NULL is REJECTED (NOT NULL)",
    nullExternalId !== null && /null value|not-null/i.test(nullExternalId.message),
  );

  let duplicateExternalId = null;
  try {
    await asServiceRole((c) =>
      c.query(
        `insert into public.messages
           (business_id, conversation_id, channel_connection_id, external_message_id,
            direction, sender_type, sender_customer_id, body, provider_sent_at)
         values ($1, $2, $3, 'ext-m1', 'inbound', 'customer', $4, 'duplicate', now())`,
        [businessA.id, convA1.id, ccA1.id, custA1.id],
      ),
    );
  } catch (err) {
    duplicateExternalId = err;
  }
  check(
    "duplicate (channel_connection_id, external_message_id) is REJECTED (unique violation)",
    duplicateExternalId !== null &&
      /duplicate key value violates unique constraint/i.test(duplicateExternalId.message),
  );

  console.log("--- 8. Multi-participant / thread-splitting bounded rule ---");

  let duplicateExternalConversationId = null;
  try {
    await asUser(userA, (c) =>
      c.query(
        `insert into public.conversations
           (business_id, customer_id, channel_connection_id, external_conversation_id)
         values ($1, $2, $3, 'thread-1')`,
        [businessA.id, custA2.id, ccA1.id],
      ),
    );
  } catch (err) {
    duplicateExternalConversationId = err;
  }
  check(
    "a second conversation for the same (channel_connection_id, external_conversation_id) is REJECTED " +
      "(the DB guard backing the no-thread-splitting / no-misattribution rule)",
    duplicateExternalConversationId !== null &&
      /duplicate key value violates unique constraint/i.test(
        duplicateExternalConversationId.message,
      ),
  );

  // ---------------------------------------------------------------
  console.log("--- 5. Trigger concurrency & lock mechanics ---");
  // ---------------------------------------------------------------
  // Transaction B: inserts a genuinely newer message (fast path
  // succeeds, taking an implicit row lock on `conversations` for the
  // rest of B's open transaction). Transaction A: concurrently edits
  // the *previous* cached leader backward in time (fast path misses,
  // falls to the slow path, which must block on B's lock rather than
  // reading stale state). B commits first; A's slow path must then
  // observe that it is no longer the cached leader and skip the
  // overwrite.

  const beforeRace = await admin.query(
    "select sequence, provider_sent_at from public.messages where id = $1",
    [msg2.id],
  );
  const leaderBeforeRace = beforeRace.rows[0];

  const connB = new Client(CONN);
  await connB.connect();
  await connB.query("begin");
  await connB.query("set local role service_role");

  const raceMsgB = await connB.query(
    `insert into public.messages
       (business_id, conversation_id, channel_connection_id, external_message_id,
        direction, sender_type, sender_customer_id, body, provider_sent_at)
     values ($1, $2, $3, 'ext-race-b', 'inbound', 'customer', $4, 'Race: newer message', now() + interval '1 hour')
     returning id, sequence`,
    [businessA.id, convA1.id, ccA1.id, custA1.id],
  );
  // B's fast path has now run and (since this message is newer than
  // the current cached leader) taken the conversations row lock —
  // still held, because B's transaction is still open.

  const connA = new Client(CONN);
  await connA.connect();
  await connA.query("begin");
  await connA.query("set local role service_role");

  // Fire A's backward edit without awaiting yet — it will block inside
  // the trigger's slow-path `for update` until B releases the lock.
  const aUpdatePromise = connA.query(
    "update public.messages set provider_sent_at = $1 where id = $2 and sequence = $3",
    [
      new Date(Date.parse(leaderBeforeRace.provider_sent_at) - 60 * 60 * 1000),
      msg2.id,
      leaderBeforeRace.sequence,
    ],
  );

  // Give A's query time to actually reach and block on the lock before
  // B commits, so the interleaving is real rather than accidental.
  await sleep(300);

  await connB.query("commit");
  await connB.end();

  await aUpdatePromise;
  await connA.query("commit");
  await connA.end();

  const afterRace = await admin.query(
    "select last_message_sequence from public.conversations where id = $1",
    [convA1.id],
  );
  check(
    "after the race, conversations.last_message_sequence reflects Transaction B's NEWER message, " +
      "not a stale overwrite from Transaction A's backward edit",
    String(afterRace.rows[0].last_message_sequence) === String(raceMsgB.rows[0].sequence),
  );

  // ---------------------------------------------------------------
  console.log("--- 6. Race-safe identity resolution (advisory lock) ---");
  // ---------------------------------------------------------------
  // Two concurrent "ingestion workers" (service_role connections)
  // discover the same normalized external identity on the same
  // channel connection at the same time, and both attempt the
  // design's §5.1 algorithm: acquire the advisory lock keyed on
  // (channel_connection_id, normalized value), re-query, and only
  // create a new Customer + CustomerIdentity if none exists yet.

  const raceIdentityValue = "concurrent@example.com";

  async function resolveIdentity(client) {
    await client.query("begin");
    await client.query("set local role service_role");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 0))",
      [ccA1.id, raceIdentityValue],
    );
    const existing = await client.query(
      "select customer_id from public.customer_identities where channel_connection_id = $1 and external_identity_value = $2",
      [ccA1.id, raceIdentityValue],
    );
    if (existing.rowCount > 0) {
      await client.query("commit");
      return existing.rows[0].customer_id;
    }
    const newCustomer = await client.query(
      "insert into public.customers (business_id, display_name) values ($1, 'Concurrent Customer') returning id",
      [businessA.id],
    );
    await client.query(
      `insert into public.customer_identities
         (business_id, customer_id, channel_connection_id, external_identity_value)
       values ($1, $2, $3, $4)`,
      [businessA.id, newCustomer.rows[0].id, ccA1.id, raceIdentityValue],
    );
    await client.query("commit");
    return newCustomer.rows[0].id;
  }

  const workerClientX = new Client(CONN);
  await workerClientX.connect();
  const workerClientY = new Client(CONN);
  await workerClientY.connect();

  const [resolvedX, resolvedY] = await Promise.all([
    resolveIdentity(workerClientX),
    resolveIdentity(workerClientY),
  ]);

  await workerClientX.end();
  await workerClientY.end();

  check(
    "two concurrent workers resolving the same identity converge on the SAME customer_id",
    resolvedX === resolvedY,
  );

  const identityRowCount = await admin.query(
    "select count(*)::int as n from public.customer_identities where channel_connection_id = $1 and external_identity_value = $2",
    [ccA1.id, raceIdentityValue],
  );
  check(
    "exactly ONE customer_identity row exists for the concurrently-resolved identity",
    identityRowCount.rows[0].n === 1,
  );

  // ---------------------------------------------------------------
  console.log("--- 7. Bidirectional keyset pagination ---");
  // ---------------------------------------------------------------
  // Build a small, deterministic timeline (reusing convB1, which has
  // no messages yet, to keep this section's fixture isolated from the
  // concurrency test above).

  const baseTime = Date.parse("2026-01-01T00:00:00Z");
  const seeded = [];
  for (let i = 0; i < 5; i += 1) {
    const row = await asServiceRole((c) =>
      c.query(
        `insert into public.messages
           (business_id, conversation_id, channel_connection_id, external_message_id,
            direction, sender_type, sender_customer_id, body, provider_sent_at)
         values ($1, $2, $3, $4, 'inbound', 'customer', $5, $6, $7)
         returning id, sequence, provider_sent_at`,
        [
          businessB.id,
          convB1.id,
          ccB1.id,
          `ext-page-${i}`,
          custB1.id,
          `Message ${i}`,
          // Two messages share the same provider_sent_at to exercise
          // sequence-based disambiguation.
          new Date(baseTime + Math.floor(i / 2) * 60_000).toISOString(),
        ],
      ),
    );
    seeded.push(row.rows[0]);
  }

  // 'before' page starting from the newest message: descending order,
  // strictly older than the cursor.
  const cursorNewest = seeded[seeded.length - 1];
  const beforePage = await admin.query(
    `select id, sequence, provider_sent_at from public.messages
     where conversation_id = $1
       and (provider_sent_at, sequence) < ($2, $3)
     order by provider_sent_at desc, sequence desc
     limit 10`,
    [convB1.id, cursorNewest.provider_sent_at, cursorNewest.sequence],
  );
  const beforeSequences = beforePage.rows.map((r) => String(r.sequence));
  const expectedBeforeSequences = seeded
    .slice(0, -1)
    .map((r) => String(r.sequence))
    .reverse();
  check(
    "'before' pagination returns strictly-older messages in descending (provider_sent_at, sequence) order",
    JSON.stringify(beforeSequences) === JSON.stringify(expectedBeforeSequences),
  );

  // 'after' page starting from the oldest message: ascending order,
  // strictly newer than the cursor.
  const cursorOldest = seeded[0];
  const afterPage = await admin.query(
    `select id, sequence, provider_sent_at from public.messages
     where conversation_id = $1
       and (provider_sent_at, sequence) > ($2, $3)
     order by provider_sent_at asc, sequence asc
     limit 10`,
    [convB1.id, cursorOldest.provider_sent_at, cursorOldest.sequence],
  );
  const afterSequences = afterPage.rows.map((r) => String(r.sequence));
  const expectedAfterSequences = seeded.slice(1).map((r) => String(r.sequence));
  check(
    "'after' pagination returns strictly-newer messages in ascending (provider_sent_at, sequence) order",
    JSON.stringify(afterSequences) === JSON.stringify(expectedAfterSequences),
  );

  // The two messages sharing a timestamp (seeded[0]/seeded[1] and
  // seeded[2]/seeded[3]) must still come back in sequence order, not
  // interleaved/duplicated/dropped — i.e. same-timestamp disambiguation
  // by sequence actually holds for both pages above.
  check(
    "same-provider_sent_at messages are disambiguated by sequence (no duplicates/gaps across both pages)",
    beforeSequences.length + 1 === seeded.length &&
      afterSequences.length + 1 === seeded.length,
  );

  await admin.end();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test harness crashed:", err);
  process.exit(1);
});
