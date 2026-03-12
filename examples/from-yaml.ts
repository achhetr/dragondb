import { createDALFromYaml } from "../src";

async function run(): Promise<void> {
  const dal = await createDALFromYaml("./config/db.config.yaml.example", {
    envFilePath: ".env"
  });
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
