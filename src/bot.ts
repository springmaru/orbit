import {
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  GuildMember,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

import type { Settings } from "./config.js";
import type { EmployeeService } from "./services/employee-service.js";
import type { GovernanceService } from "./services/governance-service.js";
import type { PerformanceService } from "./services/performance-service.js";
import type { RewardService } from "./services/reward-service.js";

function isAdmin(member: GuildMember, adminRoleIds: Set<string>): boolean {
  if (adminRoleIds.size === 0) {
    return true;
  }
  return member.roles.cache.some((role) => adminRoleIds.has(role.id));
}

const palette = {
  brand: 0x3aaed8,
  success: 0x22c55e,
  warn: 0xf59e0b,
  danger: 0xef4444,
  slate: 0x334155,
};

function agendaColor(grade: number): number {
  if (grade === 1) return 0x0ea5e9;
  if (grade === 2) return 0xf59e0b;
  return 0xef4444;
}

function statusBadge(status: string): string {
  if (status === "active") return "Active";
  if (status === "leave") return "On Leave";
  if (status === "inactive") return "Inactive";
  if (status === "open") return "Open";
  if (status === "closed") return "Closed";
  return status;
}

export async function createAndStartBot(deps: {
  settings: Settings;
  employeeService: EmployeeService;
  rewardService: RewardService;
  governanceService: GovernanceService;
  performanceService: PerformanceService;
}): Promise<Client> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  const commands = [
    new SlashCommandBuilder()
      .setName("employee_register")
      .setDescription("사원 정보를 등록하거나 갱신합니다.")
      .addUserOption((option) => option.setName("member").setDescription("등록할 사원").setRequired(true))
      .addStringOption((option) => option.setName("legal_name").setDescription("실명"))
      .addStringOption((option) => option.setName("department").setDescription("부서"))
      .addStringOption((option) => option.setName("role_title").setDescription("직책 또는 역할")),
    new SlashCommandBuilder()
      .setName("employee_status")
      .setDescription("사원의 재직 상태를 변경합니다.")
      .addUserOption((option) => option.setName("member").setDescription("대상 사원").setRequired(true))
      .addStringOption((option) =>
        option
          .setName("status")
          .setDescription("active, leave, inactive")
          .setRequired(true)
          .addChoices(
            { name: "active", value: "active" },
            { name: "leave", value: "leave" },
            { name: "inactive", value: "inactive" },
          ),
      ),
    new SlashCommandBuilder()
      .setName("employee_profile")
      .setDescription("사원 프로필과 KP 현황을 조회합니다.")
      .addUserOption((option) => option.setName("member").setDescription("조회할 사원").setRequired(true)),
    new SlashCommandBuilder()
      .setName("employee_list")
      .setDescription("등록된 사원 목록을 조회합니다."),
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("봇에서 사용할 수 있는 명령어 목록을 안내합니다."),
    new SlashCommandBuilder()
      .setName("reward_give")
      .setDescription("사원에게 KP를 지급하거나 차감합니다.")
      .addUserOption((option) => option.setName("member").setDescription("대상 사원").setRequired(true))
      .addIntegerOption((option) => option.setName("points").setDescription("지급 또는 차감 KP").setRequired(true))
      .addStringOption((option) => option.setName("reason").setDescription("지급 사유").setRequired(true)),
    new SlashCommandBuilder()
      .setName("reward_balance")
      .setDescription("사원의 현재 KP를 조회합니다.")
      .addUserOption((option) => option.setName("member").setDescription("조회할 사원")),
    new SlashCommandBuilder()
      .setName("reward_leaderboard")
      .setDescription("KP 리더보드를 조회합니다."),
    new SlashCommandBuilder()
      .setName("agenda_create")
      .setDescription("거버넌스 안건을 생성합니다.")
      .addStringOption((option) => option.setName("title").setDescription("안건 제목").setRequired(true))
      .addStringOption((option) => option.setName("description").setDescription("안건 설명").setRequired(true))
      .addIntegerOption((option) => option.setName("grade").setDescription("안건 등급").setRequired(true).addChoices(
        { name: "Grade 1", value: 1 },
        { name: "Grade 2", value: 2 },
        { name: "Grade 3", value: 3 },
      ))
      .addStringOption((option) => option.setName("deadline").setDescription("예: 2026-03-31 18:00").setRequired(true)),
    new SlashCommandBuilder()
      .setName("agenda_vote")
      .setDescription("안건에 투표합니다.")
      .addIntegerOption((option) => option.setName("agenda_id").setDescription("안건 ID").setRequired(true))
      .addStringOption((option) =>
        option
          .setName("choice")
          .setDescription("투표 선택")
          .setRequired(true)
          .addChoices(
            { name: "yes", value: "yes" },
            { name: "no", value: "no" },
            { name: "abstain", value: "abstain" },
          ),
      ),
    new SlashCommandBuilder()
      .setName("agenda_result")
      .setDescription("안건의 현재 투표 현황을 조회합니다.")
      .addIntegerOption((option) => option.setName("agenda_id").setDescription("안건 ID").setRequired(true)),
    new SlashCommandBuilder()
      .setName("agenda_list")
      .setDescription("열려 있는 안건 목록을 조회합니다."),
    new SlashCommandBuilder()
      .setName("agenda_close")
      .setDescription("안건을 마감합니다.")
      .addIntegerOption((option) => option.setName("agenda_id").setDescription("안건 ID").setRequired(true)),
    new SlashCommandBuilder()
      .setName("performance_check")
      .setDescription("사원의 업무 수행 체크를 기록합니다.")
      .addUserOption((option) => option.setName("member").setDescription("대상 사원").setRequired(true))
      .addIntegerOption((option) => option.setName("score").setDescription("1~5 점수").setRequired(true).setMinValue(1).setMaxValue(5))
      .addStringOption((option) => option.setName("summary").setDescription("평가 메모").setRequired(true)),
    new SlashCommandBuilder()
      .setName("performance_history")
      .setDescription("최근 업무 수행 체크 기록을 조회합니다.")
      .addUserOption((option) => option.setName("member").setDescription("조회할 사원").setRequired(true)),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(deps.settings.discordBotToken);
  const applicationId = extractApplicationIdFromToken(deps.settings.discordBotToken);

  if (deps.settings.discordGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(applicationId, deps.settings.discordGuildId),
      { body: commands },
    );
    console.log(`Registered guild commands for guild ${deps.settings.discordGuildId}`);
  } else {
    await rest.put(Routes.applicationCommands(applicationId), { body: commands });
    console.log("Registered global commands");
  }

  client.on("ready", () => {
    console.log(`Bot ready as ${client.user?.tag ?? "unknown-user"}`);
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {
      await handleCommand(interaction, deps);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Unexpected error";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true });
        return;
      }
      await interaction.reply({ content: message, ephemeral: true });
    }
  });

  await client.login(deps.settings.discordBotToken);
  return client;
}

function extractApplicationIdFromToken(token: string): string {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid Discord bot token");
  }
  return Buffer.from(parts[0], "base64").toString("utf8");
}

async function handleCommand(
  interaction: ChatInputCommandInteraction,
  deps: {
    settings: Settings;
    employeeService: EmployeeService;
    rewardService: RewardService;
    governanceService: GovernanceService;
    performanceService: PerformanceService;
  },
): Promise<void> {
  const member = interaction.member;
  const guildMember = member instanceof GuildMember ? member : null;

  switch (interaction.commandName) {
    case "employee_register": {
      if (!guildMember || !isAdmin(guildMember, deps.settings.botAdminRoleIds)) {
        await interaction.reply({ content: "이 명령어를 사용할 권한이 없습니다.", ephemeral: true });
        return;
      }
      const target = interaction.options.getUser("member", true);
      await deps.employeeService.upsertEmployee({
        discordUserId: target.id,
        displayName: target.displayName,
        legalName: interaction.options.getString("legal_name"),
        department: interaction.options.getString("department"),
        roleTitle: interaction.options.getString("role_title"),
        employmentStatus: "active",
      });
      const embed = new EmbedBuilder()
        .setColor(palette.success)
        .setTitle("Employee Registered")
        .setDescription(`${target} 사원 정보를 등록했어요.`)
        .addFields(
          { name: "실명", value: interaction.options.getString("legal_name") ?? "-", inline: true },
          { name: "부서", value: interaction.options.getString("department") ?? "-", inline: true },
          { name: "역할", value: interaction.options.getString("role_title") ?? "-", inline: true },
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "employee_status": {
      if (!guildMember || !isAdmin(guildMember, deps.settings.botAdminRoleIds)) {
        await interaction.reply({ content: "이 명령어를 사용할 권한이 없습니다.", ephemeral: true });
        return;
      }
      const target = interaction.options.getUser("member", true);
      const status = interaction.options.getString("status", true);
      await deps.employeeService.upsertEmployee({
        discordUserId: target.id,
        displayName: target.displayName,
        employmentStatus: status,
      });
      const embed = new EmbedBuilder()
        .setColor(palette.warn)
        .setTitle("Employment Status Updated")
        .setDescription(`${target}의 상태를 변경했어요.`)
        .addFields({ name: "새 상태", value: statusBadge(status), inline: true });
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "employee_profile": {
      const target = interaction.options.getUser("member", true);
      const profile = await deps.employeeService.getProfile(target.id, target.displayName);
      const embed = new EmbedBuilder()
        .setColor(palette.brand)
        .setTitle(`${profile.displayName} Profile`)
        .setDescription(`${target}의 사원 정보를 조회했어요.`)
        .addFields(
          { name: "실명", value: profile.legalName ?? "-", inline: true },
          { name: "부서", value: profile.department ?? "-", inline: true },
          { name: "역할", value: profile.roleTitle ?? "-", inline: true },
          { name: "상태", value: statusBadge(profile.employmentStatus), inline: true },
          { name: "누적 KP", value: `${profile.kpBalance} KP`, inline: true },
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "employee_list": {
      const employees = await deps.employeeService.listEmployees();
      if (employees.length === 0) {
        await interaction.reply("등록된 사원이 아직 없습니다.");
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(palette.slate)
        .setTitle("Employee Directory")
        .setDescription("현재 등록된 사원 목록입니다.")
        .addFields(
          ...employees.slice(0, 10).map((employee) => ({
            name: `${employee.displayName} · ${statusBadge(employee.employmentStatus)}`,
            value: `${employee.department ?? "-"} / ${employee.roleTitle ?? "-"} / KP ${employee.kpBalance}`,
          })),
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "help": {
      const embed = new EmbedBuilder()
        .setColor(palette.brand)
        .setTitle("Naimed Kepler Bot")
        .setDescription("사원 관리, KP 리워드, 거버넌스 운영을 위한 명령어 안내")
        .addFields(
          {
            name: "Employee",
            value: "`/employee_register`\n`/employee_status`\n`/employee_profile`\n`/employee_list`",
            inline: true,
          },
          {
            name: "KP Reward",
            value: "`/reward_give`\n`/reward_balance`\n`/reward_leaderboard`",
            inline: true,
          },
          {
            name: "Governance",
            value: "`/agenda_create`\n`/agenda_vote`\n`/agenda_result`\n`/agenda_list`\n`/agenda_close`",
            inline: true,
          },
          {
            name: "Performance",
            value: "`/performance_check`\n`/performance_history`",
            inline: true,
          },
          {
            name: "관리자 전용",
            value: "`employee_register`, `employee_status`, `reward_give`, `agenda_create`, `agenda_close`, `performance_check`",
          },
        )
        .setFooter({ text: "Global command 반영이 느리면 잠시 기다린 뒤 다시 시도하세요." });
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "reward_give": {
      if (!guildMember || !isAdmin(guildMember, deps.settings.botAdminRoleIds)) {
        await interaction.reply({ content: "이 명령어를 사용할 권한이 없습니다.", ephemeral: true });
        return;
      }
      const target = interaction.options.getUser("member", true);
      const points = interaction.options.getInteger("points", true);
      const reason = interaction.options.getString("reason", true);
      const balance = await deps.rewardService.giveReward({
        discordUserId: target.id,
        displayName: target.displayName,
        points,
        reason,
        awardedByUserId: interaction.user.id,
      });
      const embed = new EmbedBuilder()
        .setColor(points >= 0 ? palette.success : palette.danger)
        .setTitle(points >= 0 ? "KP Awarded" : "KP Adjusted")
        .setDescription(`${target}에게 KP를 반영했어요.`)
        .addFields(
          { name: "변동", value: `${points > 0 ? "+" : ""}${points} KP`, inline: true },
          { name: "현재 누적", value: `${balance} KP`, inline: true },
          { name: "사유", value: reason },
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "reward_balance": {
      const target = interaction.options.getUser("member") ?? interaction.user;
      const balance = await deps.rewardService.getBalance(target.id, target.displayName);
      const embed = new EmbedBuilder()
        .setColor(palette.brand)
        .setTitle("KP Balance")
        .setDescription(`${target}의 현재 누적 KP`)
        .addFields({ name: "Balance", value: `${balance.balance} KP`, inline: true });
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "reward_leaderboard": {
      const leaderboard = await deps.rewardService.getLeaderboard();
      if (leaderboard.length === 0) {
        await interaction.reply("아직 KP 데이터가 없습니다.");
        return;
      }
      const medals = ["🥇", "🥈", "🥉"];
      const embed = new EmbedBuilder()
        .setColor(palette.warn)
        .setTitle("KP Leaderboard")
        .setDescription(
          leaderboard
            .map((entry, index) => `${medals[index] ?? `#${index + 1}`} ${entry.displayName} · **${entry.balance} KP**`)
            .join("\n"),
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "agenda_create": {
      if (!guildMember || !isAdmin(guildMember, deps.settings.botAdminRoleIds)) {
        await interaction.reply({ content: "이 명령어를 사용할 권한이 없습니다.", ephemeral: true });
        return;
      }
      const agendaId = await deps.governanceService.createAgenda({
        title: interaction.options.getString("title", true),
        description: interaction.options.getString("description", true),
        grade: interaction.options.getInteger("grade", true),
        deadline: interaction.options.getString("deadline", true),
        createdByUserId: interaction.user.id,
      });
      const embed = new EmbedBuilder()
        .setColor(agendaColor(interaction.options.getInteger("grade", true)))
        .setTitle(`Agenda #${agendaId} Created`)
        .setDescription(interaction.options.getString("title", true))
        .addFields(
          { name: "Grade", value: `G${interaction.options.getInteger("grade", true)}`, inline: true },
          { name: "Deadline", value: interaction.options.getString("deadline", true), inline: true },
          { name: "Description", value: interaction.options.getString("description", true) },
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "agenda_vote": {
      const choice = interaction.options.getString("choice", true) as "yes" | "no" | "abstain";
      await deps.governanceService.castVote({
        agendaId: interaction.options.getInteger("agenda_id", true),
        discordUserId: interaction.user.id,
        displayName: interaction.user.displayName,
        voteChoice: choice,
      });
      const choiceLabel = choice === "yes" ? "Yes" : choice === "no" ? "No" : "Abstain";
      const embed = new EmbedBuilder()
        .setColor(choice === "yes" ? palette.success : choice === "no" ? palette.danger : palette.slate)
        .setTitle("Vote Submitted")
        .setDescription(`안건 #${interaction.options.getInteger("agenda_id", true)} 투표가 반영됐어요.`)
        .addFields({ name: "선택", value: choiceLabel, inline: true });
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "agenda_result": {
      const agenda = await deps.governanceService.getAgenda(interaction.options.getInteger("agenda_id", true));
      if (!agenda) {
        await interaction.reply({ content: "해당 안건을 찾을 수 없습니다.", ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(agendaColor(agenda.grade))
        .setTitle(`Agenda #${agenda.agendaId} · ${agenda.title}`)
        .setDescription(agenda.description)
        .addFields(
          { name: "Grade", value: `G${agenda.grade}`, inline: true },
          { name: "Status", value: statusBadge(agenda.status), inline: true },
          { name: "Deadline", value: agenda.deadline, inline: true },
          { name: "Yes", value: `${agenda.yesVotes} votes\n${agenda.yesWeight} KP`, inline: true },
          { name: "No", value: `${agenda.noVotes} votes\n${agenda.noWeight} KP`, inline: true },
          { name: "Abstain", value: `${agenda.abstainVotes} votes\n${agenda.abstainWeight} KP`, inline: true },
        )
        .setFooter({ text: "KP snapshot weighted governance" });
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "agenda_list": {
      const agendas = await deps.governanceService.listAgendas();
      if (agendas.length === 0) {
        await interaction.reply("현재 열려 있는 안건이 없습니다.");
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(palette.brand)
        .setTitle("Open Agendas")
        .setDescription("현재 진행 중인 거버넌스 안건")
        .addFields(
          ...agendas.slice(0, 10).map((agenda) => ({
            name: `#${agenda.agendaId} · G${agenda.grade} · ${agenda.title}`,
            value: `마감 ${agenda.deadline}\nYes ${agenda.yesWeight} KP · No ${agenda.noWeight} KP · Abstain ${agenda.abstainWeight} KP`,
          })),
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "agenda_close": {
      if (!guildMember || !isAdmin(guildMember, deps.settings.botAdminRoleIds)) {
        await interaction.reply({ content: "이 명령어를 사용할 권한이 없습니다.", ephemeral: true });
        return;
      }
      const agendaId = interaction.options.getInteger("agenda_id", true);
      await deps.governanceService.closeAgenda(agendaId);
      const embed = new EmbedBuilder()
        .setColor(palette.slate)
        .setTitle("Agenda Closed")
        .setDescription(`안건 #${agendaId}를 마감했어요.`);
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "performance_check": {
      if (!guildMember || !isAdmin(guildMember, deps.settings.botAdminRoleIds)) {
        await interaction.reply({ content: "이 명령어를 사용할 권한이 없습니다.", ephemeral: true });
        return;
      }
      const target = interaction.options.getUser("member", true);
      await deps.performanceService.recordCheck({
        discordUserId: target.id,
        displayName: target.displayName,
        score: interaction.options.getInteger("score", true),
        summary: interaction.options.getString("summary", true),
        checkedByUserId: interaction.user.id,
      });
      const score = interaction.options.getInteger("score", true);
      const embed = new EmbedBuilder()
        .setColor(score >= 4 ? palette.success : score >= 3 ? palette.warn : palette.danger)
        .setTitle("Performance Check Recorded")
        .setDescription(`${target}의 업무 수행 체크를 기록했어요.`)
        .addFields(
          { name: "Score", value: `${score}/5`, inline: true },
          { name: "Summary", value: interaction.options.getString("summary", true) },
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }
    case "performance_history": {
      const target = interaction.options.getUser("member", true);
      const history = await deps.performanceService.getHistory(target.id);
      if (history.length === 0) {
        await interaction.reply(`${target}의 평가 기록이 아직 없습니다.`);
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(palette.slate)
        .setTitle(`${target.displayName} Performance History`)
        .setDescription("최근 업무 수행 체크 기록")
        .addFields(
          ...history.map((entry, index) => ({
            name: `${index + 1}. ${entry.score}/5 · ${entry.checkedAt}`,
            value: entry.summary,
          })),
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }
    default: {
      await interaction.reply({ content: "지원하지 않는 명령어입니다.", ephemeral: true });
    }
  }
}
