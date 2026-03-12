import { Pool, type PoolConfig } from "pg";
import type { CloudDBConfig } from "../types";

export function createPostgresPool(cfg: CloudDBConfig, queryTimeoutMs?: number): Pool {
  const poolConfig: PoolConfig = {
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
