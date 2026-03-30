from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from naimed_kepler_bot.services.governance_service import GovernanceService


class GovernanceCog(commands.Cog):
    def __init__(self, bot: commands.Bot, governance_service: GovernanceService, admin_role_ids: set[int]) -> None:
        self.bot = bot
        self.governance_service = governance_service
        self.admin_role_ids = admin_role_ids

    def _is_admin(self, member: discord.Member) -> bool:
        if not self.admin_role_ids:
            return True
        return any(role.id in self.admin_role_ids for role in member.roles)

    @app_commands.command(name="agenda_create", description="거버넌스 안건을 생성합니다.")
    @app_commands.describe(
        title="안건 제목",
        description="안건 설명",
        grade="의사결정 등급 1~3",
        deadline="마감 시각 예: 2026-03-31 18:00",
    )
    async def agenda_create(
        self,
        interaction: discord.Interaction,
        title: str,
        description: str,
        grade: app_commands.Range[int, 1, 3],
        deadline: str,
    ) -> None:
        assert isinstance(interaction.user, discord.Member)

        if not self._is_admin(interaction.user):
            await interaction.response.send_message("이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return

        agenda_id = self.governance_service.create_agenda(
            title=title,
            description=description,
            grade=grade,
            deadline=deadline,
            created_by_user_id=str(interaction.user.id),
        )
        await interaction.response.send_message(f"안건 #{agenda_id}를 생성했어요. Grade {grade}, 마감 {deadline}")

    @app_commands.command(name="agenda_vote", description="거버넌스 안건에 투표합니다.")
    @app_commands.describe(agenda_id="안건 ID", choice="yes, no, abstain 중 하나")
    async def agenda_vote(
        self,
        interaction: discord.Interaction,
        agenda_id: int,
        choice: str,
    ) -> None:
        normalized = choice.strip().lower()
        if normalized not in {"yes", "no", "abstain"}:
            await interaction.response.send_message("choice는 yes, no, abstain 중 하나여야 합니다.", ephemeral=True)
            return

        display_name = interaction.user.display_name if isinstance(interaction.user, discord.Member) else interaction.user.name

        try:
            self.governance_service.cast_vote(
                agenda_id=agenda_id,
                discord_user_id=str(interaction.user.id),
                display_name=display_name,
                vote_choice=normalized,
            )
        except ValueError as error:
            await interaction.response.send_message(str(error), ephemeral=True)
            return

        await interaction.response.send_message(f"안건 #{agenda_id}에 `{normalized}`로 투표했어요.")

    @app_commands.command(name="agenda_result", description="안건의 현재 투표 현황을 조회합니다.")
    @app_commands.describe(agenda_id="안건 ID")
    async def agenda_result(self, interaction: discord.Interaction, agenda_id: int) -> None:
        agenda = self.governance_service.get_agenda(agenda_id)
        if agenda is None:
            await interaction.response.send_message("해당 안건을 찾을 수 없습니다.", ephemeral=True)
            return

        lines = [
            f"안건 #{agenda.agenda_id}: {agenda.title}",
            f"Grade: {agenda.grade}",
            f"상태: {agenda.status}",
            f"마감: {agenda.deadline}",
            f"Yes: {agenda.yes_votes}명 / KP {agenda.yes_weight}",
            f"No: {agenda.no_votes}명 / KP {agenda.no_weight}",
            f"Abstain: {agenda.abstain_votes}명 / KP {agenda.abstain_weight}",
            f"설명: {agenda.description}",
        ]
        await interaction.response.send_message("\n".join(lines))

    @app_commands.command(name="agenda_list", description="열려 있는 안건 목록을 조회합니다.")
    async def agenda_list(self, interaction: discord.Interaction) -> None:
        agendas = self.governance_service.list_agendas(status="open")
        if not agendas:
            await interaction.response.send_message("현재 열려 있는 안건이 없습니다.")
            return

        lines = [
            f"- #{agenda.agenda_id} | G{agenda.grade} | {agenda.title} | 마감 {agenda.deadline} | Yes KP {agenda.yes_weight} / No KP {agenda.no_weight}"
            for agenda in agendas
        ]
        await interaction.response.send_message("열린 안건 목록\n" + "\n".join(lines))

    @app_commands.command(name="agenda_close", description="안건을 마감합니다.")
    @app_commands.describe(agenda_id="안건 ID")
    async def agenda_close(self, interaction: discord.Interaction, agenda_id: int) -> None:
        assert isinstance(interaction.user, discord.Member)

        if not self._is_admin(interaction.user):
            await interaction.response.send_message("이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return

        self.governance_service.close_agenda(agenda_id)
        await interaction.response.send_message(f"안건 #{agenda_id}를 마감했어요.")


async def setup(bot: commands.Bot, governance_service: GovernanceService, admin_role_ids: set[int]) -> None:
    await bot.add_cog(GovernanceCog(bot, governance_service, admin_role_ids))

