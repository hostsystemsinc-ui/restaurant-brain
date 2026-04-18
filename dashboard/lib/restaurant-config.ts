/**
 * Server-side restaurant configuration.
 * Maps client account ID → restaurant metadata.
 * Add a new entry here when onboarding a new client.
 */
export interface RestaurantConfig {
  name:      string    // Display name, e.g. "Walter's 303"
  city:      string    // City + state, e.g. "Denver, CO"
  rid:       string    // Supabase restaurant UUID (primary, or "" for multi-restaurant owners)
  slug:      string    // URL slug, e.g. "walters303"
  joinUrl:   string    // Public guest join URL
  ownerRids?: string[] // Multi-restaurant owner: array of all managed restaurant UUIDs
}

export const RESTAURANT_CONFIG: Record<string, RestaurantConfig> = {
  walters: {
    name:    "Walter's 303",
    city:    "Denver, CO",
    rid:     "272a8876-e4e6-4867-831d-0525db80a8db",
    slug:    "walters303",
    joinUrl: "https://hostplatform.net/walters303/join",
  },
  demo: {
    name:    "Demo Restaurant",
    city:    "Denver, CO",
    rid:     "dec0cafe-0000-4000-8000-000000000001",
    slug:    "demo",
    joinUrl: "https://hostplatform.net/demo/join",
  },

  // ── The Walnut Cafe (Boulder, CO) ────────────────────────────────────────
  original: {
    name:    "The Original Walnut Cafe",
    city:    "Boulder, CO",
    rid:     "0001cafe-0001-4000-8000-000000000001",
    slug:    "walnut-original",
    joinUrl: "https://hostplatform.net/walnut/original/join",
  },
  southside: {
    name:    "The Southside Walnut Cafe",
    city:    "Boulder, CO",
    rid:     "0002cafe-0001-4000-8000-000000000002",
    slug:    "walnut-southside",
    joinUrl: "https://hostplatform.net/walnut/southside/join",
  },
  // Ariel's owner account — manages both Walnut Cafe locations
  walnut: {
    name:      "The Walnut Cafe",
    city:      "Boulder, CO",
    rid:       "0001cafe-0001-4000-8000-000000000001", // primary (not used directly for owner dashboard)
    slug:      "walnut",
    joinUrl:   "",
    ownerRids: [
      "0001cafe-0001-4000-8000-000000000001", // The Original Walnut Cafe
      "0002cafe-0001-4000-8000-000000000002", // The Southside Walnut Cafe
    ],
  },
}
