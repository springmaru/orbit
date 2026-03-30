from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(slots=True)
class Settings:
    discord_bot_token: str
    discord_guild_id: int
    bot_admin_role_ids: set[int]
    database_path: Path


def load_settings() -> Settings:
    load_dotenv()

    token = os.getenv("DISCORD_BOT_TOKEN", "").strip()
    guild_id = os.getenv("DISCORD_GUILD_ID", "").strip()
    role_ids_raw = os.getenv("BOT_ADMIN_ROLE_IDS", "").strip()
    database_path = Path(os.getenv("DATABASE_PATH", "data/kepler_bot.db"))

    if not token:
        raise ValueError("DISCORD_BOT_TOKEN is required")

    if not guild_id:
        raise ValueError("DISCORD_GUILD_ID is required")

    role_ids = {
        int(role_id.strip())
        for role_id in role_ids_raw.split(",")
        if role_id.strip()
    }

    return Settings(
        discord_bot_token=token,
        discord_guild_id=int(guild_id),
        bot_admin_role_ids=role_ids,
        database_path=database_path,
    )

