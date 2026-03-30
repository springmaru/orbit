from __future__ import annotations

from dataclasses import dataclass

from naimed_kepler_bot.services.storage import Database


@dataclass(slots=True)
class Agenda:
    agenda_id: int
    title: str
    description: str
    grade: int
    status: str
    deadline: str
    yes_votes: int
    no_votes: int
    abstain_votes: int
    yes_weight: int
    no_weight: int
    abstain_weight: int


class GovernanceService:
    def __init__(self, database: Database) -> None:
        self.database = database

    def create_agenda(
        self,
        title: str,
        description: str,
        grade: int,
        deadline: str,
        created_by_user_id: str,
    ) -> int:
        with self.database.connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO governance_agendas (
                    title, description, grade, deadline, created_by_user_id
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (title, description, grade, deadline, created_by_user_id),
            )
            return int(cursor.lastrowid)

    def cast_vote(
        self,
        agenda_id: int,
        discord_user_id: str,
        display_name: str,
        vote_choice: str,
    ) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO employees (discord_user_id, display_name)
                VALUES (?, ?)
                ON CONFLICT(discord_user_id) DO UPDATE SET
                    display_name = excluded.display_name
                """,
                (discord_user_id, display_name),
            )
            agenda = connection.execute(
                """
                SELECT status
                FROM governance_agendas
                WHERE id = ?
                """,
                (agenda_id,),
            ).fetchone()
            if agenda is None:
                raise ValueError("Agenda not found")
            if agenda["status"] != "open":
                raise ValueError("Agenda is not open for voting")

            kp_row = connection.execute(
                """
                SELECT COALESCE(SUM(points), 0) AS kp_balance
                FROM reward_events
                WHERE discord_user_id = ?
                """,
                (discord_user_id,),
            ).fetchone()
            kp_balance = int(kp_row["kp_balance"])

            connection.execute(
                """
                INSERT INTO governance_votes (
                    agenda_id, discord_user_id, vote_choice, kp_snapshot
                ) VALUES (?, ?, ?, ?)
                ON CONFLICT(agenda_id, discord_user_id) DO UPDATE SET
                    vote_choice = excluded.vote_choice,
                    kp_snapshot = excluded.kp_snapshot,
                    voted_at = CURRENT_TIMESTAMP
                """,
                (agenda_id, discord_user_id, vote_choice, kp_balance),
            )

    def close_agenda(self, agenda_id: int) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                UPDATE governance_agendas
                SET status = 'closed'
                WHERE id = ?
                """,
                (agenda_id,),
            )

    def get_agenda(self, agenda_id: int) -> Agenda | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT
                    a.id,
                    a.title,
                    a.description,
                    a.grade,
                    a.status,
                    a.deadline,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'yes' THEN 1 ELSE 0 END), 0) AS yes_votes,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'no' THEN 1 ELSE 0 END), 0) AS no_votes,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'abstain' THEN 1 ELSE 0 END), 0) AS abstain_votes,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'yes' THEN v.kp_snapshot ELSE 0 END), 0) AS yes_weight,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'no' THEN v.kp_snapshot ELSE 0 END), 0) AS no_weight,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'abstain' THEN v.kp_snapshot ELSE 0 END), 0) AS abstain_weight
                FROM governance_agendas a
                LEFT JOIN governance_votes v ON v.agenda_id = a.id
                WHERE a.id = ?
                GROUP BY a.id, a.title, a.description, a.grade, a.status, a.deadline
                """,
                (agenda_id,),
            ).fetchone()

        if row is None:
            return None

        return Agenda(
            agenda_id=int(row["id"]),
            title=str(row["title"]),
            description=str(row["description"]),
            grade=int(row["grade"]),
            status=str(row["status"]),
            deadline=str(row["deadline"]),
            yes_votes=int(row["yes_votes"]),
            no_votes=int(row["no_votes"]),
            abstain_votes=int(row["abstain_votes"]),
            yes_weight=int(row["yes_weight"]),
            no_weight=int(row["no_weight"]),
            abstain_weight=int(row["abstain_weight"]),
        )

    def list_agendas(self, status: str = "open", limit: int = 10) -> list[Agenda]:
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    a.id,
                    a.title,
                    a.description,
                    a.grade,
                    a.status,
                    a.deadline,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'yes' THEN 1 ELSE 0 END), 0) AS yes_votes,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'no' THEN 1 ELSE 0 END), 0) AS no_votes,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'abstain' THEN 1 ELSE 0 END), 0) AS abstain_votes,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'yes' THEN v.kp_snapshot ELSE 0 END), 0) AS yes_weight,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'no' THEN v.kp_snapshot ELSE 0 END), 0) AS no_weight,
                    COALESCE(SUM(CASE WHEN v.vote_choice = 'abstain' THEN v.kp_snapshot ELSE 0 END), 0) AS abstain_weight
                FROM governance_agendas a
                LEFT JOIN governance_votes v ON v.agenda_id = a.id
                WHERE a.status = ?
                GROUP BY a.id, a.title, a.description, a.grade, a.status, a.deadline
                ORDER BY a.deadline ASC, a.id DESC
                LIMIT ?
                """,
                (status, limit),
            ).fetchall()

        return [
            Agenda(
                agenda_id=int(row["id"]),
                title=str(row["title"]),
                description=str(row["description"]),
                grade=int(row["grade"]),
                status=str(row["status"]),
                deadline=str(row["deadline"]),
                yes_votes=int(row["yes_votes"]),
                no_votes=int(row["no_votes"]),
                abstain_votes=int(row["abstain_votes"]),
                yes_weight=int(row["yes_weight"]),
                no_weight=int(row["no_weight"]),
                abstain_weight=int(row["abstain_weight"]),
            )
            for row in rows
        ]

