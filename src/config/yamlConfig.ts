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

export type NamingStandard = "kebab-case" | "snake_case" | "camelCase" | "pascalCase";

export interface LoadYamlConfigOptions {
  env?: EnvMap;
  envFilePath?: string;
  strict?: boolean;
  namingStandard?: NamingStandard;
}

function pickValue<T>(
  inlineValue: T | undefined,
  envKey: string | undefined,
  env: EnvMap
): T | undefined {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function namingRegex(standard: NamingStandard): RegExp {
  switch (standard) {
    case "kebab-case":
      return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
    case "snake_case":
      return /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
    case "camelCase":
      return /^[a-z][A-Za-z0-9]*$/;
    case "pascalCase":
      return /^[A-Z][A-Za-z0-9]*$/;
    default:
      return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  }
}

function pushUnknownKeysError(
  obj: Record<string, unknown>,
  allowed: string[],
  path: string,
  strict: boolean,
  errors: string[]
): void {
  if (!strict) {
    return;
  }
  const extras = Object.keys(obj).filter((key) => !allowed.includes(key));
  if (extras.length > 0) {
    errors.push(`Unknown keys at ${path}: ${extras.join(", ")}`);
  }
}

function validateYamlConfig(
  raw: unknown,
  strict: boolean,
  namingStandard: NamingStandard
): YamlDBConfig {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    throw new Error("YAML config root must be an object.");
  }

  pushUnknownKeysError(
    raw,
    ["defaultDbType", "queryTimeoutMs", "healthcheckTimeoutMs", "failover", "providers"],
    "root",
    strict,
    errors
  );

  if (raw.failover !== undefined) {
    if (!isRecord(raw.failover)) {
      errors.push("Field 'failover' must be an object.");
    } else {
      pushUnknownKeysError(raw.failover, ["enabled"], "failover", strict, errors);
      if (raw.failover.enabled !== undefined && typeof raw.failover.enabled !== "boolean") {
        errors.push("Field 'failover.enabled' must be a boolean.");
      }
    }
  }

  if (raw.defaultDbType !== undefined && typeof raw.defaultDbType !== "string") {
    errors.push("Field 'defaultDbType' must be a string.");
  }
  if (raw.queryTimeoutMs !== undefined && typeof raw.queryTimeoutMs !== "number") {
    errors.push("Field 'queryTimeoutMs' must be a number.");
  }
  if (raw.healthcheckTimeoutMs !== undefined && typeof raw.healthcheckTimeoutMs !== "number") {
    errors.push("Field 'healthcheckTimeoutMs' must be a number.");
  }
  if (!Array.isArray(raw.providers) || raw.providers.length === 0) {
    errors.push("YAML config must define a non-empty 'providers' array.");
  } else {
    const nameRegex = namingRegex(namingStandard);
    raw.providers.forEach((provider, idx) => {
      const path = `providers[${idx}]`;
      if (!isRecord(provider)) {
        errors.push(`${path} must be an object.`);
        return;
      }

      pushUnknownKeysError(
        provider,
        [
          "name",
          "role",
          "provider",
          "dbType",
          "enabled",
          "ssl",
          "connectionString",
          "host",
          "port",
          "database",
          "username",
          "password",
          "env"
        ],
        path,
        strict,
        errors
      );

      if (typeof provider.name !== "string" || provider.name.length === 0) {
        errors.push(`${path}.name must be a non-empty string.`);
      } else if (!nameRegex.test(provider.name)) {
        errors.push(`${path}.name must follow ${namingStandard}. Received '${provider.name}'.`);
      }

      if (provider.role !== "primary" && provider.role !== "failover") {
        errors.push(`${path}.role must be 'primary' or 'failover'.`);
      }
      if (typeof provider.provider !== "string" || provider.provider.length === 0) {
        errors.push(`${path}.provider must be a non-empty string.`);
      }
      if (provider.dbType !== undefined && typeof provider.dbType !== "string") {
        errors.push(`${path}.dbType must be a string.`);
      }
      if (provider.enabled !== undefined && typeof provider.enabled !== "boolean") {
        errors.push(`${path}.enabled must be a boolean.`);
      }
      if (provider.ssl !== undefined && typeof provider.ssl !== "boolean") {
        errors.push(`${path}.ssl must be a boolean.`);
      }
      if (
        provider.connectionString !== undefined &&
        typeof provider.connectionString !== "string"
      ) {
        errors.push(`${path}.connectionString must be a string.`);
      }
      if (provider.host !== undefined && typeof provider.host !== "string") {
        errors.push(`${path}.host must be a string.`);
      }
      if (provider.port !== undefined && typeof provider.port !== "number") {
        errors.push(`${path}.port must be a number.`);
      }
      if (provider.database !== undefined && typeof provider.database !== "string") {
        errors.push(`${path}.database must be a string.`);
      }
      if (provider.username !== undefined && typeof provider.username !== "string") {
        errors.push(`${path}.username must be a string.`);
      }
      if (provider.password !== undefined && typeof provider.password !== "string") {
        errors.push(`${path}.password must be a string.`);
      }

      if (provider.env !== undefined) {
        if (!isRecord(provider.env)) {
          errors.push(`${path}.env must be an object.`);
        } else {
          pushUnknownKeysError(
            provider.env,
            ["connectionString", "host", "port", "database", "username", "password"],
            `${path}.env`,
            strict,
            errors
          );
          for (const [envKey, envValue] of Object.entries(provider.env)) {
            if (typeof envValue !== "string" || envValue.length === 0) {
              errors.push(`${path}.env.${envKey} must be a non-empty string env key.`);
            }
          }
        }
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`YAML schema validation failed:\n- ${errors.join("\n- ")}`);
  }
  return raw as unknown as YamlDBConfig;
}

function validateEnvReferences(parsed: YamlDBConfig, env: EnvMap): void {
  const missing: string[] = [];
  parsed.providers.forEach((provider, idx) => {
    if (!provider.env) {
      return;
    }
    for (const [key, envVar] of Object.entries(provider.env)) {
      if (!envVar) {
        continue;
      }
      if (!env[envVar]) {
        missing.push(`providers[${idx}].env.${key} -> ${envVar}`);
      }
    }
  });
  if (missing.length > 0) {
    throw new Error(`Missing required env vars referenced by YAML:\n- ${missing.join("\n- ")}`);
  }
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
  const strict = options.strict ?? true;
  const namingStandard = options.namingStandard ?? "kebab-case";
  const source = await readFile(yamlPath, "utf8");
  const parsedRaw = parse(source) as unknown;
  const parsed = validateYamlConfig(parsedRaw, strict, namingStandard);
  validateEnvReferences(parsed, env);

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
