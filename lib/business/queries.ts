import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Business, MembershipWithBusiness, MembershipRole } from "./types";

interface MembershipRow {
  id: string;
  business_id: string;
  role: MembershipRole;
  created_at: string;
  business: {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
  } | null;
}

function toBusiness(row: NonNullable<MembershipRow["business"]>): Business {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * All of a user's memberships, oldest first, each with the business it
 * grants access to. Filters explicitly by `userId` as defense in depth
 * even though RLS (`private.is_member_of`) already scopes every row to
 * the caller — see docs/architecture.md on using both layers together.
 *
 * Uses the authenticated (RLS-respecting) server client — never the
 * service-role client — so this can never return another user's rows
 * even if the `userId` argument were somehow wrong.
 */
export async function getMembershipsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<MembershipWithBusiness[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, business_id, role, created_at, business:businesses(id, name, created_at, updated_at)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<MembershipRow[]>();

  if (error) {
    throw new Error(`Failed to load memberships: ${error.message}`);
  }

  return (data ?? [])
    .filter(
      (row): row is MembershipRow & { business: NonNullable<MembershipRow["business"]> } =>
        row.business !== null,
    )
    .map((row) => ({
      id: row.id,
      userId,
      businessId: row.business_id,
      role: row.role,
      createdAt: row.created_at,
      business: toBusiness(row.business),
    }));
}

/**
 * A single membership (with its business) for one user in one
 * business, or `null` if none exists. RLS means this can only ever
 * return a row the caller is actually a member of.
 */
export async function getMembershipForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
): Promise<MembershipWithBusiness | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, business_id, role, created_at, business:businesses(id, name, created_at, updated_at)",
    )
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .maybeSingle()
    .returns<MembershipRow>();

  if (error) {
    throw new Error(`Failed to load membership: ${error.message}`);
  }

  if (!data || !data.business) {
    return null;
  }

  return {
    id: data.id,
    userId,
    businessId: data.business_id,
    role: data.role,
    createdAt: data.created_at,
    business: toBusiness(data.business),
  };
}
