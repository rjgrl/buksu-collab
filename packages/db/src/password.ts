import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

// TODO(PLAKY-AUTH): PLAKY-AUTH-001 - implement password hashing.
// Contract: scrypt with a 16-byte hex salt, stored as `salt:hashHex`, 64-byte derived key.
// packages/api/src/services/session.ts depends on this format for verification.
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-002 - implement constant-time password verification.
export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    return false;
  }

  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  const storedHash = Buffer.from(hash, "hex");
  if (storedHash.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(storedHash, derived);
}

// TODO(PLAKY-AUTH): PLAKY-AUTH-003 - implement opaque session token generation (32 random bytes, hex).
export function createSessionToken() {
  return randomBytes(32).toString("hex");
}