from __future__ import annotations

from dataclasses import dataclass

from naimed_kepler_bot.services.storage import Database


@dataclass(slots=True)
class PerformanceCheck:
    score: int
    summary: str
    checked_by_user_id: str
    checked_at: str


class PerformanceService:
    def __init__(self, database: Database) -> None:
        self.database = database

    def record_check(
        self,
        discord_user_id: str,
        display_name: str,
        score: int,
        summary: str,
        checked_by_user_id: str,
    ) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO employees (discord_user_id, display_name)
                VALUES (?, ?)
                ON CONFLICT(discord_user_id)
                DO UPDATE SET display_name = excluded.display_name
                """,
                (discord_user_id, display_name),
            )
            connection.execute(
                """
                INSERT INTO performance_checks (
                    discord_user_id, score, summary, checked_by_user_id
                ) VALUES (?, ?, ?, ?)
                """,
                (discord_user_id, score, summary, checked_by_user_id),
            )

    def get_history(self, discord_user_id: str, limit: int = 5) -> list[PerformanceCheck]:
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT score, summary, checked_by_user_id, checked_at
                FROM performance_checks
                WHERE discord_user_id = ?
                ORDER BY checked_at DESC, id DESC
                LIMIT ?
                """,
                (discord_user_id, limit),
            ).fetchall()

        return [
            PerformanceCheck(
                score=int(row["score"]),
                summary=str(row["summary"]),
                checked_by_user_id=str(row["checked_by_user_id"]),
                checked_at=str(row["checked_at"]),
            )
            for row in rows
        ]

