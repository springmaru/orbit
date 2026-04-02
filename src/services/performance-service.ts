import type { AppDatabase } from "../db.js";

export interface PerformanceCheck {
  score: number;
  summary: string;
  checkedByUserId: string;
  checkedAt: string;
}

export class PerformanceService {
  constructor(private readonly db: AppDatabase) {}

  async recordCheck(input: {
    discordUserId: string;
    displayName: string;
    score: number;
    summary: string;
    checkedByUserId: string;
  }): Promise<void> {
    await this.db.run(
      `
        INSERT INTO employees (discord_user_id, display_name)
        VALUES (?, ?)
        ON CONFLICT(discord_user_id) DO UPDATE SET
          display_name = excluded.display_name
      `,
      input.discordUserId,
      input.displayName,
    );

    await this.db.run(
      `
        INSERT INTO performance_checks (
          discord_user_id, score, summary, checked_by_user_id
        ) VALUES (?, ?, ?, ?)
      `,
      input.discordUserId,
      input.score,
      input.summary,
      input.checkedByUserId,
    );
  }

  async getHistory(discordUserId: string, limit = 5): Promise<PerformanceCheck[]> {
    const rows = await this.db.all<Array<{
      score: number;
      summary: string;
      checked_by_user_id: string;
      checked_at: string;
    }>>(
      `
        SELECT score, summary, checked_by_user_id, checked_at
        FROM performance_checks
        WHERE discord_user_id = ?
        ORDER BY checked_at DESC, id DESC
        LIMIT ?
      `,
      discordUserId,
      limit,
    );

    return rows.map((row) => ({
      score: row.score,
      summary: row.summary,
      checkedByUserId: row.checked_by_user_id,
      checkedAt: row.checked_at,
    }));
  }
}

