import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";

vi.mock("server-only", () => ({}));

const {
  encryptGmailRefreshToken,
  decryptGmailRefreshToken,
  GmailCredentialCryptoError,
} = await import("@/lib/channels/gmail/crypto");

const VALID_KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");

const CONTEXT = { businessId: "biz-1", externalAccountId: "google-sub-1" };
const OTHER_CONTEXT = { businessId: "biz-2", externalAccountId: "google-sub-1" };

const originalEnv = process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V1;

beforeEach(() => {
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V1 = VALID_KEY;
});

afterEach(() => {
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V1 = originalEnv;
});

describe("encryptGmailRefreshToken / decryptGmailRefreshToken", () => {
  it("round-trips: decrypt(encrypt(x)) === x", () => {
    const plaintext = "1//refresh-token-value-abc123";
    const encrypted = encryptGmailRefreshToken(plaintext, CONTEXT);
    const decrypted = decryptGmailRefreshToken(
      encrypted.ciphertext,
      CONTEXT,
      encrypted.keyVersion,
    );
    expect(decrypted).toBe(plaintext);
  });

  it("never leaks the plaintext into the ciphertext output", () => {
    const plaintext = "super-secret-refresh-token-value";
    const encrypted = encryptGmailRefreshToken(plaintext, CONTEXT);
    expect(encrypted.ciphertext).not.toContain(plaintext);
    expect(
      Buffer.from(encrypted.ciphertext, "base64").toString("latin1"),
    ).not.toContain(plaintext);
  });

  it("records the key version used", () => {
    const encrypted = encryptGmailRefreshToken("token", CONTEXT, 1);
    expect(encrypted.keyVersion).toBe(1);
  });

  it("rejects an empty token", () => {
    expect(() => encryptGmailRefreshToken("", CONTEXT)).toThrow(
      GmailCredentialCryptoError,
    );
  });

  it("rejects an unsupported key version on encrypt", () => {
    expect(() => encryptGmailRefreshToken("token", CONTEXT, 2)).toThrow(
      GmailCredentialCryptoError,
    );
  });

  it("rejects an unsupported key version on decrypt", () => {
    const encrypted = encryptGmailRefreshToken("token", CONTEXT);
    expect(() =>
      decryptGmailRefreshToken(encrypted.ciphertext, CONTEXT, 2),
    ).toThrow(GmailCredentialCryptoError);
  });

  it("fails decryption with the wrong key", () => {
    const encrypted = encryptGmailRefreshToken("token", CONTEXT);
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V1 = OTHER_KEY;
    expect(() =>
      decryptGmailRefreshToken(
        encrypted.ciphertext,
        CONTEXT,
        encrypted.keyVersion,
      ),
    ).toThrow(GmailCredentialCryptoError);
  });

  it("fails authentication when the ciphertext is modified", () => {
    const encrypted = encryptGmailRefreshToken("token", CONTEXT);
    const raw = Buffer.from(encrypted.ciphertext, "base64");
    // Flip a bit in the ciphertext body (after the version+iv+tag
    // header) so the GCM auth tag no longer matches.
    raw[raw.length - 1] ^= 0xff;
    const tampered = raw.toString("base64");

    expect(() =>
      decryptGmailRefreshToken(tampered, CONTEXT, encrypted.keyVersion),
    ).toThrow(GmailCredentialCryptoError);
  });

  it("fails authentication when the associated context (AAD) is modified", () => {
    const encrypted = encryptGmailRefreshToken("token", CONTEXT);
    expect(() =>
      decryptGmailRefreshToken(
        encrypted.ciphertext,
        OTHER_CONTEXT,
        encrypted.keyVersion,
      ),
    ).toThrow(GmailCredentialCryptoError);
  });

  it("rejects a key that doesn't decode to 32 bytes", () => {
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V1 =
      Buffer.from("too-short").toString("base64");
    expect(() => encryptGmailRefreshToken("token", CONTEXT)).toThrow(
      GmailCredentialCryptoError,
    );
  });

  it("rejects malformed (too-short) ciphertext on decrypt", () => {
    expect(() =>
      decryptGmailRefreshToken(
        Buffer.from("short").toString("base64"),
        CONTEXT,
        1,
      ),
    ).toThrow(GmailCredentialCryptoError);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encryptGmailRefreshToken("token", CONTEXT);
    const b = encryptGmailRefreshToken("token", CONTEXT);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});
