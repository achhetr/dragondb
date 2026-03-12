import { createDAL, loadDBConfigFromYaml } from "../src";

async function run(): Promise<void> {
  const config = await loadDBConfigFromYaml("./config/db.config.yaml.example", {
    envFilePath: ".env"
  });

  const dal = createDAL(config);
  const health = await dal.health();
  console.log("Health:", health);

  const result = await dal.query("SELECT 1 as up");
  console.log("Provider used:", result.meta.providerName);
  console.log("Rows:", result.result.rows);

  await dal.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
