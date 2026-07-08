// ─── Turso / libSQL client ────────────────────────────────────────────────────
//
// Single shared client instance for the whole Next.js server process.
// In development with TURSO_DB_URL unset, falls back to a local SQLite file
// at .data/local.db — zero setup needed for `npm run dev`.
//
// Required environment variables for production (Vercel):
//   TURSO_DB_URL        = libsql://your-db-name.turso.io
//   TURSO_AUTH_TOKEN    = your-turso-auth-token
//
// Get these from: https://app.turso.tech → your database → "Connect"

import { createClient, type Client } from "@libsql/client";
import path from "path";
import fs from "fs";

let _client: Client | null = null;

export function getDb(): Client {
  if (_client) return _client;

  const url   = process.env.TURSO_DB_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  if (url && token) {
    // Production: remote Turso database
    _client = createClient({ url, authToken: token });
  } else {
    // Development: local SQLite file — no credentials needed.
    // @libsql/client does NOT create the parent directory automatically,
    // so we must ensure .data/ exists first (equivalent to the old code's
    // implicit directory creation via writeFileSync).
    const dataDir = path.join(process.cwd(), ".data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const localPath = path.join(dataDir, "local.db");
    _client = createClient({ url: `file:${localPath}` });
  }

  return _client;
}

// ─── Schema ──────────────────────────────────────────────────────────────────
//
// Three tables mirror the three JSON files exactly:
//   bookings  → db.json
//   settings  → settings.json   (one row, id = "singleton")
//   cms       → cms.json        (one row, id = "singleton")
//
// All JSON blobs are stored as TEXT so we never need migrations when
// the shape of settings/cms changes — just JSON.parse on read.

let _schemaInit: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (_schemaInit) return _schemaInit;

  _schemaInit = (async () => {
    const db = getDb();
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS bookings (
        id           TEXT PRIMARY KEY,
        group_id     TEXT NOT NULL,
        date         TEXT NOT NULL,
        court        TEXT NOT NULL,
        start        TEXT NOT NULL,
        end          TEXT NOT NULL,
        name         TEXT NOT NULL DEFAULT '',
        phone        TEXT NOT NULL DEFAULT '',
        email        TEXT NOT NULL DEFAULT '',
        status       TEXT NOT NULL DEFAULT 'pending_verification',
        total_price  INTEGER NOT NULL DEFAULT 0,
        booking_type TEXT NOT NULL DEFAULT 'single',
        created_at   INTEGER NOT NULL,
        verified_at  INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_bookings_date_court ON bookings (date, court);
      CREATE INDEX IF NOT EXISTS idx_bookings_group_id   ON bookings (group_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings (status);

      CREATE TABLE IF NOT EXISTS settings (
        id   TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cms (
        id   TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
    `);
  })();

  return _schemaInit;
}
