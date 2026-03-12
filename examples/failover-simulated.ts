import { createDAL, type DBConfig } from "../src";

const config: DBConfig = {
  defaultDbType: "pg",
  primary: {
    name: "intentionally-down-primary",
    provider: "aws",
    host: process.env.DB_PRIMARY_BAD_HOST ?? "127.0.0.2",
    port: Number(process.env.DB_PRIMARY_BAD_PORT ?? 5432),
    database: process.env.DB_NAME ?? "postgres",
    username: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD ?? "postgres"
  },
  failovers: [
    {
      name: "expected-healthy-failover",
      provider: "gcp",
      host: process.env.DB_FAILOVER_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_FAILOVER_PORT ?? 5432),
      database: process.env.DB_NAME ?? "postgres",
      username: process.env.DB_USER ?? "postgres",
      password: process.env.DB_PASSWORD ?? "postgres"
    }
  ]
};

async function run(): Promise<void> {
  const dal = createDAL(config);
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
