const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const dir = path.join(__dirname, "..", "data");
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, "desburocratiza.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 password_salt TEXT NOT NULL,
 verified INTEGER NOT NULL DEFAULT 0,
 verify_token TEXT,
 verify_expires INTEGER,
 avatar TEXT,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 game_key TEXT NOT NULL,
 score INTEGER NOT NULL DEFAULT 0,
 completed_at INTEGER NOT NULL,
 UNIQUE(user_id, game_key)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
`);
module.exports = db;
