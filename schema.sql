CREATE TABLE IF NOT EXISTS fires (
  track_id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL,
  nick TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_track ON comments(track_id, created_at);
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nick TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plays (
  track_id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS discogs (
  track_id TEXT PRIMARY KEY,
  release_id INTEGER,
  url TEXT,
  title TEXT,
  year INTEGER,
  label TEXT,
  format TEXT,
  lowest REAL,
  currency TEXT,
  for_sale INTEGER,
  fetched_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nick TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_top ON scores(score DESC);
