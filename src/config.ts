import dotenv from "dotenv";

dotenv.config();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export interface Settings {
  discordBotToken: string;
  discordGuildId?: string;
  botAdminRoleIds: Set<string>;
  databasePath: string;
}

export function loadSettings(): Settings {
  const roleIds = (process.env.BOT_ADMIN_ROLE_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    discordBotToken: requiredEnv("DISCORD_BOT_TOKEN"),
    discordGuildId: process.env.DISCORD_GUILD_ID?.trim() || undefined,
    botAdminRoleIds: new Set(roleIds),
    databasePath: process.env.DATABASE_PATH?.trim() || "data/kepler_bot.db",
  };
}
