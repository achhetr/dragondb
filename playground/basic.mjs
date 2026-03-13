import { createDALFromYaml } from "@akashbro/saiyandb";

async function run() {
  const dal = await createDALFromYaml("./db.config.yaml", {
    envFilePath: ".env"
  });

  const health = await dal.health();
  console.log("Health status:", health);

  const response = await dal.query("SELECT 1 as up");
  console.log("Provider used:", response.meta.providerName);
  console.log("Rows:", response.result.rows);

  await dal.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
