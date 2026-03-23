-- HOST Performance Indexes
-- Run in Supabase dashboard → SQL Editor
-- Safe to run multiple times (IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS idx_queue_restaurant_status
  ON queue_entries (restaurant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_tables_restaurant
  ON tables (restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_date
  ON reservations (restaurant_id, date);

CREATE INDEX IF NOT EXISTS idx_reservations_external_uid
  ON reservations (restaurant_id, external_uid);
