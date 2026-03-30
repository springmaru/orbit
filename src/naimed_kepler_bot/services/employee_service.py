from __future__ import annotations

from dataclasses import dataclass

from naimed_kepler_bot.services.storage import Database


@dataclass(slots=True)
class EmployeeProfile:
    discord_user_id: str
    display_name: str
    legal_name: str | None
    department: str | None
    role_title: str | None
    employment_status: str
    kp_balance: int


class EmployeeService:
    def __init__(self, database: Database) -> None:
        self.database = database

    def upsert_employee(
        self,
        discord_user_id: str,
        display_name: str,
        legal_name: str | None = None,
        department: str | None = None,
        role_title: str | None = None,
        employment_status: str = "active",
    ) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO employees (
                    discord_user_id, display_name, legal_name, department, role_title, employment_status
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(discord_user_id) DO UPDATE SET
                    display_name = excluded.display_name,
                    legal_name = COALESCE(excluded.legal_name, employees.legal_name),
                    department = COALESCE(excluded.department, employees.department),
                    role_title = COALESCE(excluded.role_title, employees.role_title),
                    employment_status = excluded.employment_status
                """,
                (discord_user_id, display_name, legal_name, department, role_title, employment_status),
            )

    def update_status(self, discord_user_id: str, employment_status: str) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                UPDATE employees
                SET employment_status = ?
                WHERE discord_user_id = ?
                """,
                (employment_status, discord_user_id),
            )

    def get_profile(self, discord_user_id: str, fallback_display_name: str) -> EmployeeProfile:
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO employees (discord_user_id, display_name)
                VALUES (?, ?)
                ON CONFLICT(discord_user_id) DO UPDATE SET
                    display_name = excluded.display_name
                """,
                (discord_user_id, fallback_display_name),
            )
            row = connection.execute(
                """
                SELECT
                    e.discord_user_id,
                    e.display_name,
                    e.legal_name,
                    e.department,
                    e.role_title,
                    e.employment_status,
                    COALESCE(SUM(r.points), 0) AS kp_balance
                FROM employees e
                LEFT JOIN reward_events r ON r.discord_user_id = e.discord_user_id
                WHERE e.discord_user_id = ?
                GROUP BY
                    e.discord_user_id,
                    e.display_name,
                    e.legal_name,
                    e.department,
                    e.role_title,
                    e.employment_status
                """,
                (discord_user_id,),
            ).fetchone()

        return EmployeeProfile(
            discord_user_id=str(row["discord_user_id"]),
            display_name=str(row["display_name"]),
            legal_name=row["legal_name"],
            department=row["department"],
            role_title=row["role_title"],
            employment_status=str(row["employment_status"]),
            kp_balance=int(row["kp_balance"]),
        )

    def list_employees(self, limit: int = 20) -> list[EmployeeProfile]:
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    e.discord_user_id,
                    e.display_name,
                    e.legal_name,
                    e.department,
                    e.role_title,
                    e.employment_status,
                    COALESCE(SUM(r.points), 0) AS kp_balance
                FROM employees e
                LEFT JOIN reward_events r ON r.discord_user_id = e.discord_user_id
                GROUP BY
                    e.discord_user_id,
                    e.display_name,
                    e.legal_name,
                    e.department,
                    e.role_title,
                    e.employment_status
                ORDER BY
                    CASE e.employment_status
                        WHEN 'active' THEN 0
                        WHEN 'leave' THEN 1
                        ELSE 2
                    END,
                    e.display_name ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        return [
            EmployeeProfile(
                discord_user_id=str(row["discord_user_id"]),
                display_name=str(row["display_name"]),
                legal_name=row["legal_name"],
                department=row["department"],
                role_title=row["role_title"],
                employment_status=str(row["employment_status"]),
                kp_balance=int(row["kp_balance"]),
            )
            for row in rows
        ]

