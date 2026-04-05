-- Demo request submissions table
-- Run in Supabase dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS demo_submissions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  restaurant    TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  city          TEXT,
  type          TEXT,
  "submittedAt" TEXT,
  "receivedAt"  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_demo_submissions_received
  ON demo_submissions ("receivedAt" DESC);
