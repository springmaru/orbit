import type { AppDatabase } from "../db.js";

export interface Agenda {
  agendaId: number;
  title: string;
  description: string;
  grade: number;
  status: string;
  deadline: string;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  yesWeight: number;
  noWeight: number;
  abstainWeight: number;
}

export class GovernanceService {
  constructor(private readonly db: AppDatabase) {}

  async createAgenda(input: {
    title: string;
    description: string;
    grade: number;
    deadline: string;
    createdByUserId: string;
  }): Promise<number> {
    const result = await this.db.run(
      `
        INSERT INTO governance_agendas (
          title, description, grade, deadline, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?)
      `,
      input.title,
      input.description,
      input.grade,
      input.deadline,
      input.createdByUserId,
    );

    return result.lastID as number;
  }

  async castVote(input: {
    agendaId: number;
    discordUserId: string;
    displayName: string;
    voteChoice: "yes" | "no" | "abstain";
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

    const agenda = await this.db.get<{ status: string }>(
      "SELECT status FROM governance_agendas WHERE id = ?",
      input.agendaId,
    );
    if (!agenda) {
      throw new Error("Agenda not found");
    }
    if (agenda.status !== "open") {
      throw new Error("Agenda is not open for voting");
    }

    const balance = await this.db.get<{ balance: number }>(
      "SELECT COALESCE(SUM(points), 0) AS balance FROM reward_events WHERE discord_user_id = ?",
      input.discordUserId,
    );

    await this.db.run(
      `
        INSERT INTO governance_votes (
          agenda_id, discord_user_id, vote_choice, kp_snapshot
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(agenda_id, discord_user_id) DO UPDATE SET
          vote_choice = excluded.vote_choice,
          kp_snapshot = excluded.kp_snapshot,
          voted_at = CURRENT_TIMESTAMP
      `,
      input.agendaId,
      input.discordUserId,
      input.voteChoice,
      balance?.balance ?? 0,
    );
  }

  async closeAgenda(agendaId: number): Promise<void> {
    await this.db.run("UPDATE governance_agendas SET status = 'closed' WHERE id = ?", agendaId);
  }

  async getAgenda(agendaId: number): Promise<Agenda | null> {
    const row = await this.db.get<{
      id: number;
      title: string;
      description: string;
      grade: number;
      status: string;
      deadline: string;
      yes_votes: number;
      no_votes: number;
      abstain_votes: number;
      yes_weight: number;
      no_weight: number;
      abstain_weight: number;
    }>(
      `
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
      `,
      agendaId,
    );

    if (!row) {
      return null;
    }

    return {
      agendaId: row.id,
      title: row.title,
      description: row.description,
      grade: row.grade,
      status: row.status,
      deadline: row.deadline,
      yesVotes: row.yes_votes,
      noVotes: row.no_votes,
      abstainVotes: row.abstain_votes,
      yesWeight: row.yes_weight,
      noWeight: row.no_weight,
      abstainWeight: row.abstain_weight,
    };
  }

  async listAgendas(status = "open", limit = 10): Promise<Agenda[]> {
    const rows = await this.db.all<Array<{
      id: number;
      title: string;
      description: string;
      grade: number;
      status: string;
      deadline: string;
      yes_votes: number;
      no_votes: number;
      abstain_votes: number;
      yes_weight: number;
      no_weight: number;
      abstain_weight: number;
    }>>(
      `
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
      `,
      status,
      limit,
    );

    return rows.map((row) => ({
      agendaId: row.id,
      title: row.title,
      description: row.description,
      grade: row.grade,
      status: row.status,
      deadline: row.deadline,
      yesVotes: row.yes_votes,
      noVotes: row.no_votes,
      abstainVotes: row.abstain_votes,
      yesWeight: row.yes_weight,
      noWeight: row.no_weight,
      abstainWeight: row.abstain_weight,
    }));
  }
}

