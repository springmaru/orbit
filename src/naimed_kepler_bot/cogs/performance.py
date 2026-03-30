from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from naimed_kepler_bot.services.performance_service import PerformanceService


class PerformanceCog(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
        performance_service: PerformanceService,
        admin_role_ids: set[int],
    ) -> None:
        self.bot = bot
        self.performance_service = performance_service
        self.admin_role_ids = admin_role_ids

    def _is_admin(self, member: discord.Member) -> bool:
        if not self.admin_role_ids:
            return True
        return any(role.id in self.admin_role_ids for role in member.roles)

    @app_commands.command(name="performance_check", description="사원의 업무 수행 체크를 기록합니다.")
    @app_commands.describe(member="대상 사원", score="평가 점수", summary="평가 메모")
    async def performance_check(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        score: app_commands.Range[int, 1, 5],
        summary: str,
    ) -> None:
        assert isinstance(interaction.user, discord.Member)

        if not self._is_admin(interaction.user):
            await interaction.response.send_message("이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return

        self.performance_service.record_check(
            discord_user_id=str(member.id),
            display_name=member.display_name,
            score=score,
            summary=summary,
            checked_by_user_id=str(interaction.user.id),
        )
        await interaction.response.send_message(
            f"{member.mention}의 업무 수행 체크를 기록했어요. 점수는 {score}/5입니다."
        )

    @app_commands.command(name="performance_history", description="사원의 최근 업무 수행 체크 기록을 조회합니다.")
    @app_commands.describe(member="조회할 사원")
    async def performance_history(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
    ) -> None:
        history = self.performance_service.get_history(str(member.id))
        if not history:
            await interaction.response.send_message(f"{member.mention}의 평가 기록이 아직 없습니다.")
            return

        lines = [
            f"- {entry.checked_at} | {entry.score}/5 | {entry.summary}"
            for entry in history
        ]
        await interaction.response.send_message(
            f"{member.mention}의 최근 업무 수행 체크\n" + "\n".join(lines)
        )


async def setup(bot: commands.Bot, performance_service: PerformanceService, admin_role_ids: set[int]) -> None:
    await bot.add_cog(PerformanceCog(bot, performance_service, admin_role_ids))

