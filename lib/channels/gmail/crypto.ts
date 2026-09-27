import "server-only";
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { getRequiredEnv } from "@/lib/security/env";

/**
 * Application-level authenticated encryption for Gmail refresh tokens
 * before they ever reach `gmail_connection_credentials` — the database
 * table itself is unreadable to `authenticated`/`anon` (see the Module
 * 4 migration), so this is defense in depth, not the only protection.
 *
 * AES-256-GCM, per the Module 4 specification. The stored envelope is:
 *
 *   [envelopeVersion(1 byte) | iv(12 bytes) | authTag(16 bytes) | ciphertext]
 *
 * base64-encoded. `envelopeVersion` is this module's own wire-format
 * version (currently always 1) — distinct from `encryptionKeyVersion`,
 * which selects *which* server secret was used to encrypt, so the key
 * can be rotated later without changing the envelope layout.
 *
 * Ciphertext is bound to (businessId, externalAccountId) via AEAD
 * associated data, so a ciphertext value can never be decrypted under
 * a different connection's context even if it were somehow copied
 * into another row. externalAccountId (the Google `sub`) is used
 * instead of the surrogate channel_connection_id because the
 * connection row and its credential are persisted together, in one
 * database call, before a channel_connection_id is known to the
 * caller — externalAccountId is available immediately after Google
 * identity validation and is just as immutable a binding. See the
 * Module 4 completion report for this deliberate deviation from the
 * specification's literal example AAD string.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ENVELOPE_VERSION = 1;

export class GmailCredentialCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GmailCredentialCryptoError";
  }
}

export interface GmailCredentialContext {
  businessId: string;
  externalAccountId: string;
}

export interface EncryptedGmailToken {
  ciphertext: string;
  keyVersion: number;
}

/** Only key version 1 exists today. Keeping this indirection (rather
 * than reading `GMAIL_TOKEN_ENCRYPTION_KEY_V1` inline everywhere) is
 * what makes a future key rotation ("add v2, keep decrypting v1")
 * a change confined to this one function. */
function loadKey(keyVersion: number): Buffer {
  if (keyVersion !== 1) {
    throw new GmailCredentialCryptoError(
      `Unsupported Gmail token encryption key version: ${keyVersion}`,
    );
  }

  const raw = getRequiredEnv("GMAIL_TOKEN_ENCRYPTION_KEY_V1");
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new GmailCredentialCryptoError(
      "GMAIL_TOKEN_ENCRYPTION_KEY_V1 is not valid base64",
    );
  }

  if (key.length !== KEY_LENGTH) {
    throw new GmailCredentialCryptoError(
      "GMAIL_TOKEN_ENCRYPTION_KEY_V1 must decode to exactly 32 bytes (256 bits)",
    );
  }

  return key;
}

function buildAad(context: GmailCredentialContext, keyVersion: number): Buffer {
  return Buffer.from(
    `signal:gmail:${context.businessId}:${context.externalAccountId}:v${keyVersion}`,
    "utf8",
  );
}

export function encryptGmailRefreshToken(
  plaintext: string,
  context: GmailCredentialContext,
  keyVersion = 1,
): EncryptedGmailToken {
  if (!plaintext) {
    throw new GmailCredentialCryptoError(
      "Refresh token must not be empty",
    );
  }

  const key = loadKey(keyVersion);
  const iv = randomBytes(IV_LENGTH);
  const aad = buildAad(context, keyVersion);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const envelope = Buffer.concat([
    Buffer.from([ENVELOPE_VERSION]),
    iv,
    tag,
    encrypted,
  ]);

  return { ciphertext: envelope.toString("base64"), keyVersion };
}

export function decryptGmailRefreshToken(
  ciphertextB64: string,
  context: GmailCredentialContext,
  keyVersion: number,
): string {
  if (!ciphertextB64) {
    throw new GmailCredentialCryptoError("Ciphertext must not be empty");
  }

  const key = loadKey(keyVersion);

  let envelope: Buffer;
  try {
    envelope = Buffer.from(ciphertextB64, "base64");
  } catch {
    throw new GmailCredentialCryptoError("Malformed Gmail credential ciphertext");
  }

  if (envelope.length < 1 + IV_LENGTH + TAG_LENGTH) {
    throw new GmailCredentialCryptoError("Malformed Gmail credential ciphertext");
  }

  const version = envelope[0];
  if (version !== ENVELOPE_VERSION) {
    throw new GmailCredentialCryptoError(
      `Unsupported Gmail credential envelope version: ${version}`,
    );
  }

  const iv = envelope.subarray(1, 1 + IV_LENGTH);
  const tag = envelope.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const encrypted = envelope.subarray(1 + IV_LENGTH + TAG_LENGTH);
  const aad = buildAad(context, keyVersion);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    // Wrong key, wrong key version, modified ciphertext, or modified
    // AAD/context all land here — GCM's authentication tag check
    // fails closed rather than returning tampered plaintext.
    throw new GmailCredentialCryptoError(
      "Failed to decrypt Gmail refresh token: authentication failed",
    );
  }
}
