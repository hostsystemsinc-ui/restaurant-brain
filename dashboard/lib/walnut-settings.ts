/**
 * Server-side settings store for the Walnut admin dashboard.
 * Reads/writes a JSON file at process.cwd()/walnut-settings.json.
 * Falls back to env vars when overrides are null.
 * File is NOT committed to git — resets to env-var defaults on fresh deploy.
 */

import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

const SETTINGS_PATH = join(process.cwd(), "walnut-settings.json")

interface WalnutSettings {
  /** 4-digit PIN string. null = use env var WALNUT_ADMIN_PIN (default "1234") */
  pin: string | null
  /** Per-account password overrides. null = use env var for that account */
  credentials: {
    original:  string | null
    southside: string | null
    walnut:    string | null
  }
}

const DEFAULT_SETTINGS: WalnutSettings = {
  pin: null,
  credentials: { original: null, southside: null, walnut: null },
}

export function readSettings(): WalnutSettings {
  try {
    if (existsSync(SETTINGS_PATH)) {
      const raw = readFileSync(SETTINGS_PATH, "utf8")
      const parsed = JSON.parse(raw) as Partial<WalnutSettings>
      return {
        pin: parsed.pin ?? null,
        credentials: {
          original:  parsed.credentials?.original  ?? null,
          southside: parsed.credentials?.southside ?? null,
          walnut:    parsed.credentials?.walnut    ?? null,
        },
      }
    }
  } catch {}
  return { ...DEFAULT_SETTINGS, credentials: { ...DEFAULT_SETTINGS.credentials } }
}

export function writeSettings(settings: WalnutSettings): void {
  try {
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8")
  } catch (e) {
    console.error("[walnut-settings] Failed to write settings file:", e)
  }
}

/** Returns the current admin PIN (from file override or env var or default). */
export function getAdminPin(): string {
  const settings = readSettings()
  return settings.pin ?? process.env.WALNUT_ADMIN_PIN ?? "1234"
}

/**
 * Returns the credential override for an account, or null if none set
 * (meaning the caller should fall back to env var).
 */
export function getCredentialOverride(account: string): string | null {
  const settings = readSettings()
  const creds = settings.credentials as Record<string, string | null>
  return creds[account] ?? null
}
