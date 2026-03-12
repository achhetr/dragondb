import type { QueryResult, QueryResultRow } from "pg";

export type CloudProvider = "aws" | "gcp" | "azure" | (string & {});
export type DatabaseType = "postgres" | (string & {});

export interface CloudDBConfig {
  name: string;
  provider: CloudProvider;
  dbType?: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface DBLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface DBConfig {
  defaultDbType?: DatabaseType;
  primary: CloudDBConfig;
  failovers?: CloudDBConfig[];
  logger?: DBLogger;
  queryTimeoutMs?: number;
  healthcheckTimeoutMs?: number;
}

export interface ProviderHealth {
  name: string;
  provider: CloudProvider;
  healthy: boolean;
  latencyMs: number;
  checkedAt: string;
  lastError?: string;
}

export interface HealthSnapshot {
  primary: ProviderHealth;
  failovers: ProviderHealth[];
  overallHealthy: boolean;
}

export interface QueryExecutionMeta {
  providerName: string;
  providerType: CloudProvider;
  isPrimary: boolean;
  attemptedAt: string;
}

export interface QueryExecutionResult<T extends QueryResultRow = QueryResultRow> {
  result: QueryResult<T>;
  meta: QueryExecutionMeta;
}
