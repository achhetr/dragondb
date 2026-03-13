import { fileURLToPath } from "node:url";
import { createDALFromYaml } from "../../src";
import type { DBLogger } from "../../src/types";

const primaryUrl = process.env.PRIMARY_DB_URL;
const failoverUrls = (process.env.FAILOVER_DB_URLS ?? "")
  .split(",")
  .map((url) => url.trim())
  .filter((url) => url.length > 0);
export const failoverOneUrl = failoverUrls[0];
export const failoverTwoUrl = failoverUrls[1];

export const unreachablePrimaryUrl = "postgres://postgres:postgres@127.0.0.1:1/saiyandb_primary";
export const unreachableFailoverOneUrl =
  "postgres://postgres:postgres@127.0.0.1:2/saiyandb_failover1";
export const unreachableFailoverTwoUrl =
  "postgres://postgres:postgres@127.0.0.1:3/saiyandb_failover2";

export const yamlConfigPath = fileURLToPath(
  new URL("./fixtures/integration.db.config.yaml", import.meta.url)
);
export const noFailoverYamlPath = fileURLToPath(
  new URL("./fixtures/integration.db.no-failover.config.yaml", import.meta.url)
);

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

export interface IntegrationConfigOverrides {
  primary?: string;
  failovers?: string[];
  logger?: DBLogger;
  primaryRetryCooldownMs?: number;
}

export function collectLogs(entries: LogEntry[], event: string, level?: LogLevel): LogEntry[] {
  return entries.filter((entry) => {
    const metaEvent = entry.meta?.event;
    const levelMatches = level ? entry.level === level : true;
    return metaEvent === event && levelMatches;
  });
}

export function createTestLogger(entries: LogEntry[]): DBLogger {
  return {
    debug: (message, meta) => entries.push({ level: "debug", message, meta }),
    info: (message, meta) => entries.push({ level: "info", message, meta }),
    warn: (message, meta) => entries.push({ level: "warn", message, meta }),
    error: (message, meta) => entries.push({ level: "error", message, meta })
  };
}

export function integrationTableName(prefix: string): string {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  return `it_${prefix}_${suffix}`;
}

export function missingIntegrationEnv(): string[] {
  return [
    ["PRIMARY_DB_URL", primaryUrl],
    ["FAILOVER_DB_URLS[0]", failoverOneUrl],
    ["FAILOVER_DB_URLS[1]", failoverTwoUrl]
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
}

export async function createDalFromYaml(overrides: IntegrationConfigOverrides = {}) {
  const activeFailovers = overrides.failovers ?? [
    failoverOneUrl as string,
    failoverTwoUrl as string
  ];
  return createDALFromYaml(yamlConfigPath, {
    env: {
      PRIMARY_DB_URL: overrides.primary ?? (primaryUrl as string),
      FAILOVER_DB_URLS: activeFailovers.join(",")
    },
    logger: overrides.logger,
    primaryRetryCooldownMs: overrides.primaryRetryCooldownMs ?? 5_000
  });
}
