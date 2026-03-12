import { readFile } from "node:fs/promises";
import { config as loadDotenv } from "dotenv";
import { parse } from "yaml";
import type { CloudDBConfig, CloudProvider, DBConfig, DatabaseType } from "../types";

type EnvMap = Record<string, string | undefined>;

interface YamlFailoverConfig {
  enabled?: boolean;
}

interface YamlProviderEnvRefs {
  connectionString?: string;
  host?: string;
  port?: string;
  database?: string;
  username?: string;
  password?: string;
}

interface YamlProviderConfig {
  name: string;
  role: "primary" | "failover";
  provider: CloudProvider;
  dbType?: DatabaseType;
  enabled?: boolean;
  ssl?: boolean;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  env?: YamlProviderEnvRefs;
}

interface YamlDBConfig {
  defaultDbType?: DatabaseType;
  queryTimeoutMs?: number;
  healthcheckTimeoutMs?: number;
  failover?: YamlFailoverConfig;
  providers: YamlProviderConfig[];
}

export interface LoadYamlConfigOptions {
  env?: EnvMap;
  envFilePath?: string;
}

function pickValue<T>(inlineValue: T | undefined, envKey: string | undefined, env: EnvMap): T | undefined {
  if (envKey) {
    const raw = env[envKey];
    if (raw !== undefined && raw !== "") {
      return raw as unknown as T;
    }
  }
  return inlineValue;
}

function parsePort(value: number | string | undefined): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid port value '${String(value)}' in YAML/env config.`);
  }
  return parsed;
}

function resolveProvider(provider: YamlProviderConfig, env: EnvMap): CloudDBConfig {
  const envRefs = provider.env ?? {};

  const connectionString = pickValue(provider.connectionString, envRefs.connectionString, env);
  const host = pickValue(provider.host, envRefs.host, env);
  const port = parsePort(pickValue(provider.port, envRefs.port, env));
  const database = pickValue(provider.database, envRefs.database, env);
  const username = pickValue(provider.username, envRefs.username, env);
  const password = pickValue(provider.password, envRefs.password, env);

  return {
    name: provider.name,
    provider: provider.provider,
    dbType: provider.dbType ?? "pg",
    connectionString,
    host,
    port,
    database,
    username,
    password,
    ssl: provider.ssl
  };
}

export async function loadDBConfigFromYaml(
  yamlPath: string,
  options: LoadYamlConfigOptions = {}
): Promise<DBConfig> {
  if (options.envFilePath) {
    loadDotenv({ path: options.envFilePath });
  }
  const env = options.env ?? process.env;

  const source = await readFile(yamlPath, "utf8");
  const parsed = parse(source) as YamlDBConfig;

  if (!parsed || !Array.isArray(parsed.providers) || parsed.providers.length === 0) {
    throw new Error("YAML config must define a non-empty 'providers' array.");
  }

  const activeProviders = parsed.providers.filter((provider) => provider.enabled !== false);
  const primaryEntries = activeProviders.filter((provider) => provider.role === "primary");

  if (primaryEntries.length !== 1) {
    throw new Error(
      `YAML config must define exactly one enabled primary provider. Found ${primaryEntries.length}.`
    );
  }

  const failoverEnabled = parsed.failover?.enabled !== false;
  const failoverEntries = failoverEnabled
    ? activeProviders.filter((provider) => provider.role === "failover")
    : [];

  return {
    defaultDbType: parsed.defaultDbType ?? "pg",
    queryTimeoutMs: parsed.queryTimeoutMs,
    healthcheckTimeoutMs: parsed.healthcheckTimeoutMs,
    primary: resolveProvider(primaryEntries[0], env),
    failovers: failoverEntries.map((provider) => resolveProvider(provider, env))
  };
}
