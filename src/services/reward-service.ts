import type { AppDatabase } from "../db.js";

export interface RewardBalance {
  discordUserId: string;
  displayName: string;
  balance: number;
}

export class RewardService {
  constructor(private readonly db: AppDatabase) {}

  async giveReward(input: {
    discordUserId: string;
    displayName: string;
    points: number;
    reason: string;
    awardedByUserId: string;
  }): Promise<number> {
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
        INSERT INTO reward_events (
          discord_user_id, points, reason, awarded_by_user_id
        ) VALUES (?, ?, ?, ?)
      `,
      input.discordUserId,
      input.points,
      input.reason,
      input.awardedByUserId,
    );

    const row = await this.db.get<{ balance: number }>(
      `
        SELECT COALESCE(SUM(points), 0) AS balance
        FROM reward_events
        WHERE discord_user_id = ?
      `,
      input.discordUserId,
    );

    return row?.balance ?? 0;
  }

  async getBalance(discordUserId: string, displayName: string): Promise<RewardBalance> {
    await this.db.run(
      `
        INSERT INTO employees (discord_user_id, display_name)
        VALUES (?, ?)
        ON CONFLICT(discord_user_id) DO UPDATE SET
          display_name = excluded.display_name
      `,
      discordUserId,
      displayName,
    );

    const row = await this.db.get<{ balance: number }>(
      `
        SELECT COALESCE(SUM(points), 0) AS balance
        FROM reward_events
        WHERE discord_user_id = ?
      `,
      discordUserId,
    );

    return {
      discordUserId,
      displayName,
      balance: row?.balance ?? 0,
    };
  }

  async getLeaderboard(limit = 10): Promise<RewardBalance[]> {
    const rows = await this.db.all<Array<{
      discord_user_id: string;
      display_name: string;
      balance: number;
    }>>(
      `
        SELECT
          e.discord_user_id,
          e.display_name,
          COALESCE(SUM(r.points), 0) AS balance
        FROM employees e
        LEFT JOIN reward_events r ON r.discord_user_id = e.discord_user_id
        GROUP BY e.discord_user_id, e.display_name
        ORDER BY balance DESC, e.display_name ASC
        LIMIT ?
      `,
      limit,
    );

    return rows.map((row) => ({
      discordUserId: row.discord_user_id,
      displayName: row.display_name,
      balance: row.balance,
    }));
  }
}

