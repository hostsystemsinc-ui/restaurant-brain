/**
 * Server-side restaurant configuration.
 * Maps client account ID → restaurant metadata.
 * Add a new entry here when onboarding a new client.
 */
export interface RestaurantConfig {
  name:    string  // Display name, e.g. "Walter's 303"
  city:    string  // City + state, e.g. "Denver, CO"
  rid:     string  // Supabase restaurant UUID
  slug:    string  // URL slug, e.g. "walters303"
  joinUrl: string  // Public guest join URL
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
}
