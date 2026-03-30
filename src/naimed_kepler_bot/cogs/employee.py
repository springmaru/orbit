from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from naimed_kepler_bot.services.employee_service import EmployeeService


class EmployeeCog(commands.Cog):
    def __init__(self, bot: commands.Bot, employee_service: EmployeeService, admin_role_ids: set[int]) -> None:
        self.bot = bot
        self.employee_service = employee_service
        self.admin_role_ids = admin_role_ids

    def _is_admin(self, member: discord.Member) -> bool:
        if not self.admin_role_ids:
            return True
        return any(role.id in self.admin_role_ids for role in member.roles)

    @app_commands.command(name="employee_register", description="사원 정보를 등록하거나 갱신합니다.")
    @app_commands.describe(
        member="등록할 사원",
        legal_name="실명",
        department="부서",
        role_title="직책 또는 역할",
    )
    async def employee_register(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        legal_name: str | None = None,
        department: str | None = None,
        role_title: str | None = None,
    ) -> None:
        assert isinstance(interaction.user, discord.Member)

        if not self._is_admin(interaction.user):
            await interaction.response.send_message("이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return

        self.employee_service.upsert_employee(
            discord_user_id=str(member.id),
            display_name=member.display_name,
            legal_name=legal_name,
            department=department,
            role_title=role_title,
            employment_status="active",
        )
        await interaction.response.send_message(f"{member.mention} 사원 정보를 등록했어요.")

    @app_commands.command(name="employee_status", description="사원의 재직 상태를 변경합니다.")
    @app_commands.describe(member="대상 사원", status="active, leave, inactive 중 하나")
    async def employee_status(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        status: str,
    ) -> None:
        assert isinstance(interaction.user, discord.Member)

        if not self._is_admin(interaction.user):
            await interaction.response.send_message("이 명령어를 사용할 권한이 없습니다.", ephemeral=True)
            return

        normalized = status.strip().lower()
        if normalized not in {"active", "leave", "inactive"}:
            await interaction.response.send_message("status는 active, leave, inactive 중 하나여야 합니다.", ephemeral=True)
            return

        self.employee_service.upsert_employee(
            discord_user_id=str(member.id),
            display_name=member.display_name,
            employment_status=normalized,
        )
        await interaction.response.send_message(f"{member.mention}의 상태를 `{normalized}`로 변경했어요.")

    @app_commands.command(name="employee_profile", description="사원 프로필과 KP 현황을 조회합니다.")
    @app_commands.describe(member="조회할 사원")
    async def employee_profile(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
    ) -> None:
        profile = self.employee_service.get_profile(str(member.id), member.display_name)
        lines = [
            f"사원: {member.mention}",
            f"실명: {profile.legal_name or '-'}",
            f"부서: {profile.department or '-'}",
            f"역할: {profile.role_title or '-'}",
            f"상태: {profile.employment_status}",
            f"누적 KP: {profile.kp_balance}",
        ]
        await interaction.response.send_message("\n".join(lines))

    @app_commands.command(name="employee_list", description="등록된 사원 목록을 조회합니다.")
    async def employee_list(self, interaction: discord.Interaction) -> None:
        employees = self.employee_service.list_employees()
        if not employees:
            await interaction.response.send_message("등록된 사원이 아직 없습니다.")
            return

        lines = [
            f"- {employee.display_name} | {employee.department or '-'} | {employee.role_title or '-'} | {employee.employment_status} | KP {employee.kp_balance}"
            for employee in employees
        ]
        await interaction.response.send_message("사원 목록\n" + "\n".join(lines))


async def setup(bot: commands.Bot, employee_service: EmployeeService, admin_role_ids: set[int]) -> None:
    await bot.add_cog(EmployeeCog(bot, employee_service, admin_role_ids))

