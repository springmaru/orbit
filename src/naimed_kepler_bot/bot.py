from __future__ import annotations

import logging

import discord
from discord.ext import commands

from naimed_kepler_bot.cogs import employee, governance, performance, reward
from naimed_kepler_bot.config import Settings
from naimed_kepler_bot.services.employee_service import EmployeeService
from naimed_kepler_bot.services.governance_service import GovernanceService
from naimed_kepler_bot.services.performance_service import PerformanceService
from naimed_kepler_bot.services.reward_service import RewardService
from naimed_kepler_bot.services.storage import Database


logger = logging.getLogger(__name__)


class NaimedKeplerBot(commands.Bot):
    def __init__(self, settings: Settings) -> None:
        intents = discord.Intents.default()
        intents.guilds = True
        intents.members = True

        super().__init__(command_prefix="!", intents=intents)
        self.settings = settings
        self.database = Database(settings.database_path)
        self.employee_service = EmployeeService(self.database)
        self.reward_service = RewardService(self.database)
        self.governance_service = GovernanceService(self.database)
        self.performance_service = PerformanceService(self.database)

    async def setup_hook(self) -> None:
        await employee.setup(self, self.employee_service, self.settings.bot_admin_role_ids)
        await reward.setup(self, self.reward_service, self.settings.bot_admin_role_ids)
        await governance.setup(self, self.governance_service, self.settings.bot_admin_role_ids)
        await performance.setup(self, self.performance_service, self.settings.bot_admin_role_ids)

        guild = discord.Object(id=self.settings.discord_guild_id)
        self.tree.copy_global_to(guild=guild)
        synced = await self.tree.sync(guild=guild)
        logger.info("Synced %s slash commands to guild %s", len(synced), self.settings.discord_guild_id)

    async def on_ready(self) -> None:
        logger.info("Bot is ready: %s", self.user)
