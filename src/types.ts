export type CloudProvider = "aws" | "gcp" | "azure" | (string & {});
export type DatabaseType = "pg" | "postgres" | (string & {});
export type DBRow = Record<string, unknown>;

export interface DBQueryResult<T extends DBRow = DBRow> {
  rows: T[];
  rowCount?: number | null;
}

export interface DBClient {
  query<T extends DBRow = DBRow>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<DBQueryResult<T>>;
  end(): Promise<void>;
}

export interface CloudDBConfig {
  name: string;
  provider: CloudProvider;
  dbType?: DatabaseType;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
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
  primaryRetryCooldownMs?: number;
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
  event: "query-success";
  queryId: string;
  providerName: string;
  providerType: CloudProvider;
  isPrimary: boolean;
  attemptedAt: string;
  durationMs: number;
  attempt: number;
}

export interface QueryExecutionResult<T extends DBRow = DBRow> {
  result: DBQueryResult<T>;
  meta: QueryExecutionMeta;
}
