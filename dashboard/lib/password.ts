/**
 * Password hashing utilities using Node.js built-in crypto (no extra packages).
 *
 * Format stored:  $s1$<saltHex>$<hashHex>
 *
 * Legacy plaintext passwords (set before hashing was introduced) are still
 * accepted on verification so existing clients are not locked out. On next
 * password change the new value will be hashed automatically.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "crypto"

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 }  // ≈ 0.1s per hash on modest hardware
const HASH_LEN = 64

/** Hash a plaintext password. Returns a `$s1$…` string safe to store. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, HASH_LEN, SCRYPT_PARAMS)
  return `$s1$${salt.toString("hex")}$${hash.toString("hex")}`
}

/**
 * Verify a plaintext password against a stored value.
 * Accepts both the new `$s1$…` format and legacy plaintext (backward-compat).
 */
export function verifyPassword(entered: string, stored: string): boolean {
  if (!stored) return false

  if (stored.startsWith("$s1$")) {
    const parts = stored.split("$")   // ["", "s1", saltHex, hashHex]
    if (parts.length !== 4) return false
    try {
      const salt    = Buffer.from(parts[2], "hex")
      const hash    = Buffer.from(parts[3], "hex")
      const derived = scryptSync(entered, salt, HASH_LEN, SCRYPT_PARAMS)
      return timingSafeEqual(derived, hash)
    } catch {
      return false
    }
  }

  // Legacy plaintext — timing-safe compare to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(entered), Buffer.from(stored))
  } catch {
    // Buffers of different length — not equal
    return false
  }
}

/** Returns true if the stored value is already hashed (not plaintext). */
export function isHashed(stored: string): boolean {
  return stored.startsWith("$s1$")
}
