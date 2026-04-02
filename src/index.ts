import { createAndStartBot } from "./bot.js";
import { loadSettings } from "./config.js";
import { createDatabase } from "./db.js";
import { EmployeeService } from "./services/employee-service.js";
import { GovernanceService } from "./services/governance-service.js";
import { PerformanceService } from "./services/performance-service.js";
import { RewardService } from "./services/reward-service.js";

async function main(): Promise<void> {
  const settings = loadSettings();
  const db = await createDatabase(settings.databasePath);

  const employeeService = new EmployeeService(db);
  const rewardService = new RewardService(db);
  const governanceService = new GovernanceService(db);
  const performanceService = new PerformanceService(db);

  await createAndStartBot({
    settings,
    employeeService,
    rewardService,
    governanceService,
    performanceService,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

