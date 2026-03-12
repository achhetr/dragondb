import { Pool, type PoolConfig } from "pg";
import type { CloudDBConfig, DBClient } from "../types";

export function createPostgresPool(cfg: CloudDBConfig, queryTimeoutMs?: number): DBClient {
  if (!cfg.connectionString) {
    throw new Error(
      `Provider '${cfg.name}' must provide connectionString via YAML env references.`
    );
  }

  const poolConfig: PoolConfig = {
    connectionString: cfg.connectionString,
    ssl: cfg.ssl ? { rejectUnauthorized: false } : false,
    statement_timeout: queryTimeoutMs
  };
  return new Pool(poolConfig);
}
