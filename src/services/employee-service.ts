import type { AppDatabase } from "../db.js";

export interface EmployeeProfile {
  discordUserId: string;
  displayName: string;
  legalName: string | null;
  department: string | null;
  roleTitle: string | null;
  employmentStatus: string;
  kpBalance: number;
}

export class EmployeeService {
  constructor(private readonly db: AppDatabase) {}

  async upsertEmployee(input: {
    discordUserId: string;
    displayName: string;
    legalName?: string | null;
    department?: string | null;
    roleTitle?: string | null;
    employmentStatus?: string;
  }): Promise<void> {
    await this.db.run(
      `
        INSERT INTO employees (
          discord_user_id, display_name, legal_name, department, role_title, employment_status
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(discord_user_id) DO UPDATE SET
          display_name = excluded.display_name,
          legal_name = COALESCE(excluded.legal_name, employees.legal_name),
          department = COALESCE(excluded.department, employees.department),
          role_title = COALESCE(excluded.role_title, employees.role_title),
          employment_status = excluded.employment_status
      `,
      input.discordUserId,
      input.displayName,
      input.legalName ?? null,
      input.department ?? null,
      input.roleTitle ?? null,
      input.employmentStatus ?? "active",
    );
  }

  async getProfile(discordUserId: string, fallbackDisplayName: string): Promise<EmployeeProfile> {
    await this.upsertEmployee({
      discordUserId,
      displayName: fallbackDisplayName,
    });

    const row = await this.db.get<{
      discord_user_id: string;
      display_name: string;
      legal_name: string | null;
      department: string | null;
      role_title: string | null;
      employment_status: string;
      kp_balance: number;
    }>(
      `
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
        GROUP BY e.discord_user_id, e.display_name, e.legal_name, e.department, e.role_title, e.employment_status
      `,
      discordUserId,
    );

    if (!row) {
      throw new Error("Employee not found");
    }

    return {
      discordUserId: row.discord_user_id,
      displayName: row.display_name,
      legalName: row.legal_name,
      department: row.department,
      roleTitle: row.role_title,
      employmentStatus: row.employment_status,
      kpBalance: row.kp_balance,
    };
  }

  async listEmployees(limit = 20): Promise<EmployeeProfile[]> {
    const rows = await this.db.all<Array<{
      discord_user_id: string;
      display_name: string;
      legal_name: string | null;
      department: string | null;
      role_title: string | null;
      employment_status: string;
      kp_balance: number;
    }>>(
      `
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
        GROUP BY e.discord_user_id, e.display_name, e.legal_name, e.department, e.role_title, e.employment_status
        ORDER BY
          CASE e.employment_status
            WHEN 'active' THEN 0
            WHEN 'leave' THEN 1
            ELSE 2
          END,
          e.display_name ASC
        LIMIT ?
      `,
      limit,
    );

    return rows.map((row) => ({
      discordUserId: row.discord_user_id,
      displayName: row.display_name,
      legalName: row.legal_name,
      department: row.department,
      roleTitle: row.role_title,
      employmentStatus: row.employment_status,
      kpBalance: row.kp_balance,
    }));
  }
}

