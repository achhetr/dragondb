import { Pool, type PoolConfig } from "pg";
import type { CloudDBConfig, DBClient } from "../types";

export function buildPostgresPoolConfig(cfg: CloudDBConfig, queryTimeoutMs?: number): PoolConfig {
  return {
    connectionString: cfg.connectionString,
    ssl: cfg.ssl
      ? {
          rejectUnauthorized: !cfg.unsafeDisableTlsCertVerification
        }
      : false,
    statement_timeout: queryTimeoutMs
  };
}

export function createPostgresPool(cfg: CloudDBConfig, queryTimeoutMs?: number): DBClient {
  if (!cfg.connectionString) {
    throw new Error(
      `Provider '${cfg.name}' must provide connectionString via YAML env references.`
    );
  }

  return new Pool(buildPostgresPoolConfig(cfg, queryTimeoutMs));
}
