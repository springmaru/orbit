from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from naimed_kepler_bot.services.reward_service import RewardService


class RewardCog(commands.Cog):
    def __init__(self, bot: commands.Bot, reward_service: RewardService, admin_role_ids: set[int]) -> None:
        self.bot = bot
        self.reward_service = reward_service
        self.admin_role_ids = admin_role_ids

    def _is_admin(self, member: discord.Member) -> bool:
        if not self.admin_role_ids:
            return True
        return any(role.id in self.admin_role_ids for role in member.roles)

    @app_commands.command(name="reward_give", description="사원에게 리워드 포인트를 지급합니다.")
    @app_commands.describe(member="대상 사원", points="지급 포인트", reason="지급 사유")
    async def reward_give(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        points: app_commands.Range[int, -100000, 100000],
        reason: str,
    ) -> None:
        assert interaction.guild is not None
        assert isinstance(interaction.user, discord.Member)

        if not self._is_admin(interaction.user):
            await interaction.response.send_message("이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return

        balance = self.reward_service.give_reward(
            discord_user_id=str(member.id),
            display_name=member.display_name,
            points=points,
            reason=reason,
            awarded_by_user_id=str(interaction.user.id),
        )
        await interaction.response.send_message(
            f"{member.mention}에게 {points}점을 반영했어요. 현재 누적 포인트는 {balance}점입니다."
        )

    @app_commands.command(name="reward_balance", description="사원의 현재 리워드 포인트를 조회합니다.")
    @app_commands.describe(member="조회할 사원, 비워두면 본인")
    async def reward_balance(
        self,
        interaction: discord.Interaction,
        member: discord.Member | None = None,
    ) -> None:
        target = member or interaction.user
        display_name = target.display_name if isinstance(target, discord.Member) else target.name
        balance = self.reward_service.get_balance(
            discord_user_id=str(target.id),
            display_name=display_name,
        )
        await interaction.response.send_message(
            f"{target.mention}의 현재 누적 리워드 포인트는 {balance.balance}점입니다."
        )

    @app_commands.command(name="reward_leaderboard", description="리워드 포인트 상위 순위를 조회합니다.")
    async def reward_leaderboard(self, interaction: discord.Interaction) -> None:
        leaderboard = self.reward_service.get_leaderboard()
        if not leaderboard:
            await interaction.response.send_message("아직 리워드 데이터가 없습니다.")
            return

        lines = [
            f"{index}. {entry.display_name} - {entry.balance}점"
            for index, entry in enumerate(leaderboard, start=1)
        ]
        await interaction.response.send_message("리워드 리더보드\n" + "\n".join(lines))


async def setup(bot: commands.Bot, reward_service: RewardService, admin_role_ids: set[int]) -> None:
    await bot.add_cog(RewardCog(bot, reward_service, admin_role_ids))

