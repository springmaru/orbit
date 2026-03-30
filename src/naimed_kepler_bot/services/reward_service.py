from __future__ import annotations

from dataclasses import dataclass

from naimed_kepler_bot.services.storage import Database


@dataclass(slots=True)
class RewardBalance:
    discord_user_id: str
    display_name: str
    balance: int


class RewardService:
    def __init__(self, database: Database) -> None:
        self.database = database

    def give_reward(
        self,
        discord_user_id: str,
        display_name: str,
        points: int,
        reason: str,
        awarded_by_user_id: str,
    ) -> int:
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
                INSERT INTO reward_events (
                    discord_user_id, points, reason, awarded_by_user_id
                ) VALUES (?, ?, ?, ?)
                """,
                (discord_user_id, points, reason, awarded_by_user_id),
            )
            row = connection.execute(
                """
                SELECT COALESCE(SUM(points), 0) AS balance
                FROM reward_events
                WHERE discord_user_id = ?
                """,
                (discord_user_id,),
            ).fetchone()
            return int(row["balance"])

    def get_balance(self, discord_user_id: str, display_name: str) -> RewardBalance:
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
            row = connection.execute(
                """
                SELECT COALESCE(SUM(points), 0) AS balance
                FROM reward_events
                WHERE discord_user_id = ?
                """,
                (discord_user_id,),
            ).fetchone()
            return RewardBalance(
                discord_user_id=discord_user_id,
                display_name=display_name,
                balance=int(row["balance"]),
            )

    def get_leaderboard(self, limit: int = 10) -> list[RewardBalance]:
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    e.discord_user_id,
                    e.display_name,
                    COALESCE(SUM(r.points), 0) AS balance
                FROM employees e
                LEFT JOIN reward_events r
                    ON r.discord_user_id = e.discord_user_id
                GROUP BY e.discord_user_id, e.display_name
                ORDER BY balance DESC, e.display_name ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        return [
            RewardBalance(
                discord_user_id=str(row["discord_user_id"]),
                display_name=str(row["display_name"]),
                balance=int(row["balance"]),
            )
            for row in rows
        ]

