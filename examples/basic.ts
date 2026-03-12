import { createDAL, type DBConfig } from "../src";

const config: DBConfig = {
  defaultDbType: "pg",
  primary: {
    name: "aws-primary",
    provider: "aws",
    host: process.env.DB_PRIMARY_HOST ?? "localhost",
    port: Number(process.env.DB_PRIMARY_PORT ?? 5432),
    database: process.env.DB_NAME ?? "postgres",
    username: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD ?? "postgres"
  },
  failovers: [
    {
      name: "gcp-failover-1",
      provider: "gcp",
      host: process.env.DB_FAILOVER_1_HOST ?? "localhost",
      port: Number(process.env.DB_FAILOVER_1_PORT ?? 5432),
      database: process.env.DB_NAME ?? "postgres",
      username: process.env.DB_USER ?? "postgres",
      password: process.env.DB_PASSWORD ?? "postgres"
    }
  ]
};

async function run(): Promise<void> {
  const dal = createDAL(config);

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
