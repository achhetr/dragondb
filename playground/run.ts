import { createDALFromYaml } from "@akashbro/saiyandb";

interface ProviderHealth {
  name: string;
  provider: string;
  healthy: boolean;
}

interface HealthSummary {
  primary: ProviderHealth;
  failovers: ProviderHealth[];
  overallHealthy: boolean;
}

function printHealthSummary(health: HealthSummary) {
  console.log("Overall healthy:", health.overallHealthy);
  console.log(
    `Primary: ${health.primary.name} (${health.primary.provider}) -> ${
      health.primary.healthy ? "healthy" : "unhealthy"
    }`
  );

  for (const failover of health.failovers) {
    console.log(
      `Failover: ${failover.name} (${failover.provider}) -> ${failover.healthy ? "healthy" : "unhealthy"}`
    );
  }
}

async function run() {
  const dal = await createDALFromYaml("./db.config.yaml", {
    envFilePath: ".env"
  });

  try {
    console.log("Running health check...");
    const health = await dal.health();
    printHealthSummary(health);

    console.log("\nRunning query...");
    const response = await dal.query("SELECT 1 as ok");

    console.log("Query succeeded");
    console.log("Provider used:", response.meta.providerName);
    console.log("Provider type:", response.meta.providerType);
    console.log("Is primary:", response.meta.isPrimary);
    console.log("Rows:", response.result.rows);
  } catch (error) {
    console.error("Playground run failed:", error);
    process.exitCode = 1;
  } finally {
    await dal.close();
    console.log("Connections closed");
  }
}

void run();
