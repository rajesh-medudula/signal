import "server-only";
import { createSupabaseServerClient } from "@/lib/db/supabase/server";
import { getGmailConnectionEmails } from "./credentials";

/**
 * The Channels page's read contract (item 79 of the specification) —
 * deliberately no token field. `status`/`displayLabel`/timestamps come
 * from the ordinary authenticated (RLS-respecting) read of
 * `channel_connections` that Module 3A already allows any business
 * member; `email` is enriched in, display-only, via
 * getGmailConnectionEmails (service-role, credential-table-adjacent
 * but never touching the ciphertext column).
 */
export interface GmailConnectionView {
  id: string;
  status: "connected" | "disconnected" | "error";
  email: string;
  displayLabel: string;
  createdAt: string;
  updatedAt: string;
}

interface ChannelConnectionRow {
  id: string;
  business_id: string;
  external_account_id: string;
  status: GmailConnectionView["status"];
  display_label: string;
  created_at: string;
  updated_at: string;
}

/** All Gmail connections for a business, oldest first. Generic
 * `channel_connections` reads continue to go through the existing
 * authenticated/RLS model (item 47) — this only adds Gmail-specific
 * shaping on top, never a second read path for the underlying rows. */
export async function listGmailConnections(
  businessId: string,
): Promise<GmailConnectionView[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("channel_connections")
    .select(
      "id, business_id, external_account_id, status, display_label, created_at, updated_at",
    )
    .eq("business_id", businessId)
    .eq("channel", "gmail")
    .order("created_at", { ascending: true })
    .returns<ChannelConnectionRow[]>();

  if (error) {
    throw new Error(`Failed to load Gmail connections: ${error.message}`);
  }

  const rows = data ?? [];
  const emails = await getGmailConnectionEmails(
    rows.map((row) => ({
      id: row.id,
      businessId: row.business_id,
      externalAccountId: row.external_account_id,
    })),
  );

  return rows.map((row) => {
    // A channel_connections row is not, by itself, proof of a working
    // Gmail connection (item 6 of the specification) — Module 3A's
    // existing admin INSERT/UPDATE policy on channel_connections
    // means an admin can set status='connected' directly via the Data
    // API with no backing credential at all. getGmailConnectionEmails
    // only returns an entry for a channel_connection_id whose stored
    // refresh token decrypted successfully, so its absence signals that
    // the credential is missing or cannot be validated. In that case, a
    // `connected`-looking row is surfaced to the admin as needing
    // attention rather than shown as a false "Connected".
    const hasCredential = emails.has(row.id);
    const status: GmailConnectionView["status"] =
      row.status === "connected" && !hasCredential ? "error" : row.status;

    return {
      id: row.id,
      status,
      email: emails.get(row.id) ?? "",
      displayLabel: row.display_label,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}
