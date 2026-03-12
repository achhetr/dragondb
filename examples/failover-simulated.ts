import { createDALFromYaml } from "../src";

async function run(): Promise<void> {
  const dal = await createDALFromYaml("./config/db.config.yaml.example", {
    envFilePath: ".env"
  });
  const response = await dal.query("SELECT 1 as ok");

  console.log("Query succeeded via provider:", response.meta.providerName);
  console.log("Provider type:", response.meta.providerType);
  console.log("Rows:", response.result.rows);

  await dal.close();
}

run().catch((error) => {
  console.error("Failover simulation failed:", error);
  process.exit(1);
});
