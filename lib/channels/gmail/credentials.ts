import "server-only";
import { createServiceRoleClient } from "@/lib/db/supabase/admin";
import {
  encryptGmailRefreshToken,
  decryptGmailRefreshToken,
} from "./crypto";
import { GmailConnectionError } from "./errors";

/**
 * The Gmail-specific credential API boundary (item 30 of the
 * specification). Every function here that touches a plaintext
 * refresh token runs only on the server (`server-only`) and only
 * through the service-role client — `gmail_connection_credentials`
 * has no policy that would let the authenticated (RLS-respecting)
 * client read or write it at all. Nothing here is imported by, or
 * re-exported through, a generic client-facing query module.
 */

const CURRENT_KEY_VERSION = 1;

export interface PersistGmailConnectionInput {
  businessId: string;
  /** The Google `sub` — the actual provider account identity. Never
   * the email address; see item 74 of the specification. */
  externalAccountId: string;
  /** Only applied when the connection is created for the first time —
   * an existing, possibly user-customized display_label is never
   * overwritten by a reconnect (item 46). */
  displayLabel: string;
  authenticatedEmail: string;
  grantedScopes: string[];
  /** null means "Google did not return a new refresh token this
   * time" — the previously stored token is retained. Only a brand
   * new connection with no prior credential can't tolerate this; see
   * connection.ts's pre-check and the migration's NOT NULL backstop. */
  refreshToken: string | null;
}

export interface PersistedGmailConnection {
  channelConnectionId: string;
  wasReconnect: boolean;
}

/**
 * Atomically upserts the channel_connections row and its encrypted
 * credential via the trusted `persist_gmail_connection` database
 * function — the only trusted Module 4 path for establishing a
 * *verified* Gmail connection (item 37 of the specification). Module
 * 3A's own admin INSERT/UPDATE policies on channel_connections are
 * unchanged and still let an admin write that table directly; what
 * this function alone can do is make a `connected` row and a real,
 * decryptable credential exist together — see
 * lib/channels/gmail/queries.ts, which never trusts `status` alone for
 * that reason. Encryption happens here, immediately before the call;
 * the ciphertext going over the wire to Postgres is the only
 * Gmail-secret value this function sends anywhere.
 */
export async function persistGmailConnection(
  input: PersistGmailConnectionInput,
): Promise<PersistedGmailConnection> {
  const encrypted = input.refreshToken
    ? encryptGmailRefreshToken(
        input.refreshToken,
        {
          businessId: input.businessId,
          externalAccountId: input.externalAccountId,
        },
        CURRENT_KEY_VERSION,
      )
    : null;

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .rpc("persist_gmail_connection", {
      p_business_id: input.businessId,
      p_external_account_id: input.externalAccountId,
      p_display_label: input.displayLabel,
      p_authenticated_email: input.authenticatedEmail,
      p_granted_scopes: input.grantedScopes,
      p_refresh_token_ciphertext: encrypted?.ciphertext ?? null,
      p_encryption_key_version: encrypted?.keyVersion ?? null,
    })
    .single<{
      result_channel_connection_id: string;
      result_was_reconnect: boolean;
    }>();

  if (error || !data) {
    throw new GmailConnectionError("provider_error");
  }

  return {
    channelConnectionId: data.result_channel_connection_id,
    wasReconnect: data.result_was_reconnect,
  };
}

/**
 * Whether a business already has a stored Gmail credential for a
 * given Google account — used by connection.ts to decide, *before*
 * attempting persistence, whether a missing refresh token from Google
 * is fatal (brand new connection) or fine (an existing one to fall
 * back on). Deliberately two simple queries rather than a PostgREST
 * embed across the composite foreign key, to avoid relying on
 * relationship-name resolution for a query this small.
 */
export async function gmailCredentialExists(
  businessId: string,
  externalAccountId: string,
): Promise<boolean> {
  const supabase = createServiceRoleClient();

  const { data: connection, error: connectionError } = await supabase
    .from("channel_connections")
    .select("id")
    .eq("business_id", businessId)
    .eq("channel", "gmail")
    .eq("external_account_id", externalAccountId)
    .maybeSingle();

  if (connectionError) {
    throw new GmailConnectionError("provider_error");
  }
  if (!connection) return false;

  const { data: credential, error: credentialError } = await supabase
    .from("gmail_connection_credentials")
    .select("channel_connection_id")
    .eq("channel_connection_id", connection.id)
    .maybeSingle();

  if (credentialError) {
    throw new GmailConnectionError("provider_error");
  }

  return !!credential;
}

/**
 * Reads only the verified mailbox address for a set of connections —
 * never the ciphertext or key version. Exists solely so a
 * server-rendered page can show the connected email address even
 * though `gmail_connection_credentials` has no authenticated-client
 * policy at all (item 38): this still goes through the service-role
 * client, from trusted server-only code, not through the Data API a
 * browser could query. See lib/channels/gmail/queries.ts, the only
 * caller.
 */
export async function getGmailConnectionEmails(
  connections: Array<{
    id: string;
    businessId: string;
    externalAccountId: string;
  }>,
): Promise<Map<string, string>> {
  if (connections.length === 0) {
    return new Map();
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("gmail_connection_credentials")
    .select(
      "channel_connection_id, authenticated_email, refresh_token_ciphertext, encryption_key_version",
    )
    .in(
      "channel_connection_id",
      connections.map((connection) => connection.id),
    );

  if (error) {
    throw new GmailConnectionError("provider_error");
  }

  const connectionById = new Map(
    connections.map((connection) => [connection.id, connection]),
  );
  const emails = new Map<string, string>();

  for (const row of data ?? []) {
    const connection = connectionById.get(row.channel_connection_id);
    if (!connection) continue;

    try {
      // Validate that this credential is actually usable before allowing
      // the Channels page to present its connection as healthy. Plaintext
      // stays inside this server-only module and is immediately discarded.
      decryptGmailRefreshToken(
        row.refresh_token_ciphertext,
        {
          businessId: connection.businessId,
          externalAccountId: connection.externalAccountId,
        },
        row.encryption_key_version,
      );
      emails.set(row.channel_connection_id, row.authenticated_email);
    } catch {
      // Missing/invalid keys, unsupported versions, and corrupted or
      // context-mismatched ciphertext all fail closed as no usable
      // credential; none of those details or token material leaves here.
    }
  }

  return emails;
}

export interface GmailCredential {
  refreshToken: string;
  grantedScopes: string[];
  authenticatedEmail: string;
}

/**
 * Decrypts and returns the stored refresh token for one connection.
 * Used today only by the disconnect flow's best-effort Google
 * revocation; reserved for a future ingestion module's own
 * server-only use. Returns null if there is no credential row —
 * callers must treat that as "nothing to revoke/use", not an error.
 */
export async function getGmailRefreshToken(
  channelConnectionId: string,
  businessId: string,
  externalAccountId: string,
): Promise<GmailCredential | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("gmail_connection_credentials")
    .select(
      "refresh_token_ciphertext, encryption_key_version, granted_scopes, authenticated_email",
    )
    .eq("channel_connection_id", channelConnectionId)
    .maybeSingle();

  if (error) {
    throw new GmailConnectionError("provider_error");
  }
  if (!data) {
    return null;
  }

  const refreshToken = decryptGmailRefreshToken(
    data.refresh_token_ciphertext,
    { businessId, externalAccountId },
    data.encryption_key_version,
  );

  return {
    refreshToken,
    grantedScopes: data.granted_scopes ?? [],
    authenticatedEmail: data.authenticated_email,
  };
}

/** Removes the local encrypted credential row for a connection.
 * Idempotent — deleting a row that's already gone is not an error. */
export async function deleteGmailCredential(
  channelConnectionId: string,
): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from("gmail_connection_credentials")
    .delete()
    .eq("channel_connection_id", channelConnectionId);

  if (error) {
    throw new GmailConnectionError("provider_error");
  }
}

/** Atomically removes the credential and disconnects its Gmail row. */
export async function disconnectGmailConnectionRecord(
  businessId: string,
  channelConnectionId: string,
): Promise<boolean> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .rpc("disconnect_gmail_connection", {
      p_business_id: businessId,
      p_channel_connection_id: channelConnectionId,
    })
    .single<{ result_disconnected: boolean }>();

  if (error || !data) {
    throw new GmailConnectionError("provider_error");
  }

  return data.result_disconnected;
}

/**
 * Safe scope-check helper for future modules (item 81 of the
 * specification) — reads the *actually granted* scope set stored on
 * the credential, never inferred from what Signal originally
 * requested. Module 4 does not itself implement incremental
 * authorization; this exists so a later module can check before
 * relying on a scope like `gmail.readonly`.
 */
export function hasGrantedScope(
  grantedScopes: string[],
  scope: string,
): boolean {
  return grantedScopes.includes(scope);
}
