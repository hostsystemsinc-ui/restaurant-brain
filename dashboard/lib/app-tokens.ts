// ── App login tokens ─────────────────────────────────────────────────────────
// Short-lived (60-second) one-time-use tokens for the HOST Android app.
//
// Flow:
//   1. App POSTs username + password to /api/client/app-token
//   2. Server validates credentials, creates a token, returns it
//   3. App opens a WebView to /api/client/app-auth?t={token}
//   4. Server validates token (one-time), sets a 1-year session cookie, redirects to station
//
// Tokens are in-memory only. They expire in 60 seconds and are deleted on use.
// A Railway restart clears them — that's fine since the app immediately requests a new one.

interface TokenEntry {
  account: string
  exp:     number     // Unix ms
}

const store = new Map<string, TokenEntry>()

function pruneExpired() {
  const now = Date.now()
  for (const [token, entry] of store) {
    if (entry.exp < now) store.delete(token)
  }
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("")
}

/** Create a 60-second one-time-use token for the given account. */
export function createAppToken(account: string): string {
  pruneExpired()
  const token = randomHex(24)   // 48 hex chars — unguessable
  store.set(token, { account, exp: Date.now() + 60_000 })
  return token
}

/** Redeem a token. Returns the account name, or null if missing/expired. Token is deleted on use. */
export function redeemAppToken(token: string): string | null {
  pruneExpired()
  const entry = store.get(token)
  if (!entry) return null
  store.delete(token)           // one-time use
  return entry.account
}
