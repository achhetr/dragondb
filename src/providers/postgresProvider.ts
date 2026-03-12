import { Pool, type PoolConfig } from "pg";
import type { CloudDBConfig } from "../types";

export function createPostgresPool(cfg: CloudDBConfig, queryTimeoutMs?: number): Pool {
  if (!cfg.connectionString) {
    const missing = ["host", "port", "database", "username", "password"].filter((field) => {
      const value = cfg[field as keyof CloudDBConfig];
      return value === undefined || value === "";
    });
    if (missing.length > 0) {
      throw new Error(
        `Provider '${cfg.name}' is missing required pg fields: ${missing.join(", ")}. ` +
          "Set discrete fields or provide connectionString."
      );
    }
  }

  const poolConfig: PoolConfig = {
    connectionString: cfg.connectionString,
    host: cfg.host,
    port: cfg.port,
    user: cfg.username,
    password: cfg.password,
    database: cfg.database,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : false,
    statement_timeout: queryTimeoutMs
  };
  return new Pool(poolConfig);
}
