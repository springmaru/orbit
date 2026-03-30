from __future__ import annotations

import sqlite3
from pathlib import Path


SCHEMA = """
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
"""


class Database:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(SCHEMA)
