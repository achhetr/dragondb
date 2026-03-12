import { createPostgresPool } from "../providers/postgresProvider";
import type { CloudDBConfig, DBClient, DatabaseType } from "../types";

export interface DriverPoolFactoryOptions {
  defaultDbType?: DatabaseType;
  queryTimeoutMs?: number;
}

export function resolveDatabaseType(
  cfg: CloudDBConfig,
  options: DriverPoolFactoryOptions
): DatabaseType {
  return cfg.dbType ?? options.defaultDbType ?? "pg";
}

export function createDriverPool(
  cfg: CloudDBConfig,
  options: DriverPoolFactoryOptions = {}
): DBClient {
  const dbType = resolveDatabaseType(cfg, options);
  if (dbType !== "pg" && dbType !== "postgres") {
    throw new Error(`Unsupported database type '${dbType}'. Supported drivers: pg, postgres`);
  }
  return createPostgresPool(cfg, options.queryTimeoutMs);
}
