import { createDALFromYaml } from "../src";

async function run(): Promise<void> {
  const dal = await createDALFromYaml("./config/db.config.yaml.example", {
    envFilePath: ".env"
  });

  const health = await dal.health();
  console.log("Health status:", health);

  const users = await dal.query("SELECT 1 as up");
  console.log("Query provider:", users.meta.providerName);
  console.log("Rows:", users.result.rows);

  await dal.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
