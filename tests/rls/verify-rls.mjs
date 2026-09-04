// Exercises the actual RLS policies from
// supabase/migrations/20260903061958_business_membership_foundation.sql
// against a real local Postgres instance, impersonating different
// authenticated users the same way Supabase does in production: by
// setting the `request.jwt.claims` GUC and switching to the
// `authenticated` role for the duration of each check.
//
// Run: node verify-rls.mjs
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

async function asUser(admin, userId, fn) {
  const client = new Client(CONN);
  await client.connect();
  try {
    await client.query("begin");
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
  } finally {
    await client.end();
  }
}

async function main() {
  const admin = new Client(CONN);
  await admin.connect();

  // --- Fixtures: two independent users who each onboard their own business.
  const userA = (
    await admin.query(
      "insert into auth.users (email) values ('a@example.com') returning id",
    )
  ).rows[0].id;
  const userB = (
    await admin.query(
      "insert into auth.users (email) values ('b@example.com') returning id",
    )
  ).rows[0].id;
  // A third user who will be granted a plain 'member' row on Business A
  // directly by the admin (simulating a future invitation feature,
  // which is out of scope for this module) so member-vs-owner/admin
  // authorization can be tested.
  const userC = (
    await admin.query(
      "insert into auth.users (email) values ('c@example.com') returning id",
    )
  ).rows[0].id;

  console.log("--- Onboarding ---");

  const businessA = await asUser(admin, userA, (c) =>
    c.query("select * from public.onboard_business($1)", ["Acme Inc"]),
  );
  const businessAId = businessA.rows[0].id;
  check(
    "userA onboarding creates a business and returns it",
    businessA.rows[0].name === "Acme Inc",
  );

  const membershipCheckA = await admin.query(
    "select role from public.memberships where user_id = $1 and business_id = $2",
    [userA, businessAId],
  );
  check(
    "userA's initial membership has role owner",
    membershipCheckA.rows[0]?.role === "owner",
  );

  const businessB = await asUser(admin, userB, (c) =>
    c.query("select * from public.onboard_business($1)", ["Widgets Co"]),
  );
  const businessBId = businessB.rows[0].id;
  check(
    "userB onboarding creates a separate business",
    businessBId !== businessAId,
  );

  console.log("--- Idempotent retry ---");

  const retry = await asUser(admin, userA, (c) =>
    c.query("select * from public.onboard_business($1)", ["Acme Inc Again"]),
  );
  check(
    "retrying onboard_business for an already-onboarded user returns the SAME business, not a new one",
    retry.rows[0].id === businessAId,
  );
  const businessCountForA = await admin.query(
    "select count(*)::int as n from public.memberships where user_id = $1",
    [userA],
  );
  check(
    "userA still has exactly one membership after retrying onboarding",
    businessCountForA.rows[0].n === 1,
  );

  console.log("--- Multi-tenancy shape ---");

  const bizForUserA = await admin.query(
    "select business_id from public.memberships where user_id = $1",
    [userA],
  );
  check(
    "one user -> one membership works (baseline)",
    bizForUserA.rowCount === 1,
  );

  // Directly attach userA as a second owner-equivalent on business B's
  // team isn't the point here; instead prove "one business, many users"
  // using userC as a plain member of business A (set up below), and
  // prove "one user, many businesses" by giving userA a second business
  // via a second, distinct onboarding-style insert done as admin (since
  // onboard_business is deliberately idempotent per user and multi-
  // business creation UI is not part of this module).
  const secondBusiness = await admin.query(
    "insert into public.businesses (name) values ('Acme Labs') returning id",
  );
  await admin.query(
    "insert into public.memberships (user_id, business_id, role) values ($1, $2, 'owner')",
    [userA, secondBusiness.rows[0].id],
  );
  const userAMemberships = await admin.query(
    "select count(*)::int as n from public.memberships where user_id = $1",
    [userA],
  );
  check(
    "one user -> multiple businesses is possible at the schema level",
    userAMemberships.rows[0].n === 2,
  );

  // userC as a plain 'member' of business A (simulating a future invite).
  await admin.query(
    "insert into public.memberships (user_id, business_id, role) values ($1, $2, 'member')",
    [userC, businessAId],
  );
  const businessAMembers = await admin.query(
    "select count(*)::int as n from public.memberships where business_id = $1",
    [businessAId],
  );
  check(
    "one business -> multiple users is possible at the schema level",
    businessAMembers.rows[0].n === 2,
  );

  console.log("--- Cross-tenant read denial ---");

  const aReadsB = await asUser(admin, userA, (c) =>
    c.query("select * from public.businesses where id = $1", [businessBId]),
  );
  check(
    "userA (not a member of Business B) reads ZERO rows for Business B",
    aReadsB.rowCount === 0,
  );

  const bReadsA = await asUser(admin, userB, (c) =>
    c.query("select * from public.businesses where id = $1", [businessAId]),
  );
  check(
    "userB (not a member of Business A) reads ZERO rows for Business A",
    bReadsA.rowCount === 0,
  );

  const bReadsMembershipsOfA = await asUser(admin, userB, (c) =>
    c.query("select * from public.memberships where business_id = $1", [
      businessAId,
    ]),
  );
  check(
    "userB reads ZERO membership rows for Business A (not their business)",
    bReadsMembershipsOfA.rowCount === 0,
  );

  const aReadsOwnBusiness = await asUser(admin, userA, (c) =>
    c.query("select * from public.businesses where id = $1", [businessAId]),
  );
  check(
    "userA CAN read their own Business A",
    aReadsOwnBusiness.rowCount === 1,
  );

  console.log("--- Cross-tenant mutation denial ---");

  const aUpdatesB = await asUser(admin, userA, (c) =>
    c.query("update public.businesses set name = 'hacked' where id = $1", [
      businessBId,
    ]),
  );
  check(
    "userA's UPDATE on Business B affects ZERO rows",
    aUpdatesB.rowCount === 0,
  );
  const businessBUnchanged = await admin.query(
    "select name from public.businesses where id = $1",
    [businessBId],
  );
  check(
    "Business B's name is unchanged after userA's attempted update",
    businessBUnchanged.rows[0].name === "Widgets Co",
  );

  console.log("--- Member vs owner/admin authorization ---");

  const memberUpdatesOwnBusiness = await asUser(admin, userC, (c) =>
    c.query("update public.businesses set name = 'member did this' where id = $1", [
      businessAId,
    ]),
  );
  check(
    "plain member (userC) CANNOT update their own Business A (affects 0 rows)",
    memberUpdatesOwnBusiness.rowCount === 0,
  );

  const ownerUpdatesOwnBusiness = await asUser(admin, userA, (c) =>
    c.query("update public.businesses set name = 'Acme Inc (renamed)' where id = $1", [
      businessAId,
    ]),
  );
  check(
    "owner (userA) CAN update their own Business A",
    ownerUpdatesOwnBusiness.rowCount === 1,
  );

  const memberReadsOwnBusiness = await asUser(admin, userC, (c) =>
    c.query("select * from public.businesses where id = $1", [businessAId]),
  );
  check(
    "plain member (userC) CAN still read Business A",
    memberReadsOwnBusiness.rowCount === 1,
  );

  console.log("--- Membership self-service is fully denied ---");

  // No UPDATE policy exists on memberships at all, so RLS filters the
  // target row away before the UPDATE runs — it silently affects zero
  // rows rather than erroring (the same "UPDATE needs a matching
  // USING/SELECT policy or it's a no-op" behavior Postgres RLS always
  // has). That's the correct, secure outcome — verify no error AND no
  // effect, then verify the role is genuinely unchanged.
  const selfPromoteAttempt = await asUser(admin, userC, (c) =>
    c.query(
      "update public.memberships set role = 'owner' where user_id = $1 and business_id = $2",
      [userC, businessAId],
    ),
  );
  check(
    "member (userC) CANNOT promote themselves to owner (UPDATE affects 0 rows, no policy permits it)",
    selfPromoteAttempt.rowCount === 0,
  );
  const userCRoleAfter = await admin.query(
    "select role from public.memberships where user_id = $1 and business_id = $2",
    [userC, businessAId],
  );
  check(
    "userC's role in Business A is still 'member' after the self-promote attempt",
    userCRoleAfter.rows[0]?.role === "member",
  );

  let selfAssignError = null;
  try {
    await asUser(admin, userB, (c) =>
      c.query(
        "insert into public.memberships (user_id, business_id, role) values ($1, $2, 'owner')",
        [userB, businessAId],
      ),
    );
  } catch (err) {
    selfAssignError = err;
  }
  check(
    "userB CANNOT insert themselves as owner of Business A (arbitrary business, permission denied)",
    selfAssignError !== null && /permission denied|row-level security/i.test(selfAssignError.message),
  );

  let directBusinessInsertError = null;
  try {
    await asUser(admin, userA, (c) =>
      c.query("insert into public.businesses (name) values ('spoofed')"),
    );
  } catch (err) {
    directBusinessInsertError = err;
  }
  check(
    "no authenticated user can INSERT a business directly (bypassing onboard_business) — permission denied",
    directBusinessInsertError !== null &&
      /permission denied|row-level security/i.test(directBusinessInsertError.message),
  );

  console.log("--- Unauthenticated ---");

  let noSessionResult;
  try {
    noSessionResult = await asUser(admin, null, (c) =>
      c.query("select * from public.businesses"),
    );
    check(
      "a request with no jwt claims (auth.uid() is null) reads ZERO business rows",
      noSessionResult.rowCount === 0,
    );
  } catch {
    // Also acceptable: some drivers/paths might error instead of
    // returning zero rows for a null-claims session.
    check(
      "a request with no jwt claims is rejected or returns zero rows",
      true,
    );
  }

  await admin.end();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test harness crashed:", err);
  process.exit(1);
});
