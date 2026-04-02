import fs from "node:fs";
import path from "node:path";

import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";

export type AppDatabase = Database<sqlite3.Database, sqlite3.Statement>;

export async function createDatabase(databasePath: string): Promise<AppDatabase> {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = await open({
    filename: databasePath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      discord_user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      legal_name TEXT,
      department TEXT,
      role_title TEXT,
      employment_status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reward_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_user_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      awarded_by_user_id TEXT NOT NULL,
      awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (discord_user_id) REFERENCES employees(discord_user_id)
    );

    CREATE TABLE IF NOT EXISTS governance_agendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      grade INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_by_user_id TEXT NOT NULL,
      deadline TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS governance_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agenda_id INTEGER NOT NULL,
      discord_user_id TEXT NOT NULL,
      vote_choice TEXT NOT NULL,
      kp_snapshot INTEGER NOT NULL,
      voted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (agenda_id, discord_user_id),
      FOREIGN KEY (agenda_id) REFERENCES governance_agendas(id),
      FOREIGN KEY (discord_user_id) REFERENCES employees(discord_user_id)
    );

    CREATE TABLE IF NOT EXISTS performance_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_user_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      summary TEXT NOT NULL,
      checked_by_user_id TEXT NOT NULL,
      checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (discord_user_id) REFERENCES employees(discord_user_id)
    );
  `);

  return db;
}

