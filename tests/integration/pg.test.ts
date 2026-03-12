import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createDAL, loadDBConfigFromYaml, type DBConfig, type DBLogger } from "../../src";

const primaryUrl = process.env.PRIMARY_DB_URL;
const failoverUrls = (process.env.FAILOVER_DB_URLS ?? "")
  .split(",")
  .map((url) => url.trim())
  .filter((url) => url.length > 0);
const failoverOneUrl = failoverUrls[0];
const failoverTwoUrl = failoverUrls[1];
const unreachablePrimaryUrl = "postgres://postgres:postgres@127.0.0.1:1/saiyandb_primary";
const unreachableFailoverOneUrl = "postgres://postgres:postgres@127.0.0.1:2/saiyandb_failover1";
const unreachableFailoverTwoUrl = "postgres://postgres:postgres@127.0.0.1:3/saiyandb_failover2";
const yamlConfigPath = fileURLToPath(
  new URL("./fixtures/integration.db.config.yaml", import.meta.url)
);

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
}

function collectLogs(entries: LogEntry[], event: string, level?: LogLevel): LogEntry[] {
  return entries.filter((entry) => {
    const metaEvent = entry.meta?.event;
    const levelMatches = level ? entry.level === level : true;
    return metaEvent === event && levelMatches;
  });
}

function createTestLogger(entries: LogEntry[]): DBLogger {
  return {
    debug: (message, meta) => entries.push({ level: "debug", message, meta }),
    info: (message, meta) => entries.push({ level: "info", message, meta }),
    warn: (message, meta) => entries.push({ level: "warn", message, meta }),
    error: (message, meta) => entries.push({ level: "error", message, meta })
  };
}

interface IntegrationConfigOverrides {
  primary?: string;
  failover1?: string;
  failover2?: string;
  primaryRetryCooldownMs?: number;
  logger?: DBLogger;
}

async function createConfigFromYaml(overrides: IntegrationConfigOverrides = {}): Promise<DBConfig> {
  const config = await loadDBConfigFromYaml(yamlConfigPath, {
    env: {
      PRIMARY_DB_URL: overrides.primary ?? (primaryUrl as string),
      FAILOVER_DB_URL_1: overrides.failover1 ?? (failoverOneUrl as string),
      FAILOVER_DB_URL_2: overrides.failover2 ?? (failoverTwoUrl as string)
    }
  });

  return {
    ...config,
    logger: overrides.logger,
    primaryRetryCooldownMs: overrides.primaryRetryCooldownMs ?? 5_000
  };
}

const missingEnv = [
  ["PRIMARY_DB_URL", primaryUrl],
  ["FAILOVER_DB_URLS[0]", failoverOneUrl],
  ["FAILOVER_DB_URLS[1]", failoverTwoUrl]
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingEnv.length > 0) {
  test("integration pg tests skipped", { skip: true }, () => {
    assert.ok(true);
  });
} else {
  test("integration: query succeeds against real primary", async () => {
    const config = await createConfigFromYaml();
    const dal = createDAL(config);
    const response = await dal.query("SELECT 1 as up");
    assert.equal(response.result.rows[0]?.up, 1);
    assert.equal(response.meta.providerName, "primary-real");
    assert.equal(response.meta.isPrimary, true);
    await dal.close();
  });

  test("integration: ordered failover reaches second failover and logs events", async () => {
    const entries: LogEntry[] = [];
    const config = await createConfigFromYaml({
      logger: createTestLogger(entries),
      primary: unreachablePrimaryUrl,
      failover1: unreachableFailoverOneUrl
    });

    const dal = createDAL(config);
    const response = await dal.query("SELECT 1 as up");
    assert.equal(response.result.rows[0]?.up, 1);
    assert.equal(response.meta.providerName, "failover-2-real");
    assert.equal(response.meta.isPrimary, false);

    const attempts = collectLogs(entries, "query-attempt", "debug");
    assert.deepEqual(
      attempts.map((entry) => entry.meta?.providerName),
      ["primary-real", "failover-1-real", "failover-2-real"]
    );

    const primaryFailures = collectLogs(entries, "primary-failed", "warn");
    assert.equal(primaryFailures.length, 1);
    assert.equal(primaryFailures[0]?.meta?.providerName, "primary-real");

    const failoverFailures = collectLogs(entries, "failover-failed", "warn");
    assert.equal(failoverFailures.length, 1);
    assert.equal(failoverFailures[0]?.meta?.providerName, "failover-1-real");

    const failoverSuccesses = collectLogs(entries, "failover-success", "info");
    assert.equal(failoverSuccesses.length, 1);
    assert.equal(failoverSuccesses[0]?.meta?.providerName, "failover-2-real");
    await dal.close();
  });

  test("integration: throws when every provider is unavailable", async () => {
    const entries: LogEntry[] = [];
    const config = await createConfigFromYaml({
      logger: createTestLogger(entries),
      primary: unreachablePrimaryUrl,
      failover1: unreachableFailoverOneUrl,
      failover2: unreachableFailoverTwoUrl
    });

    const dal = createDAL(config);
    await assert.rejects(
      () => dal.query("SELECT 1 as up"),
      /All providers failed.*primary-real.*failover-1-real.*failover-2-real/
    );
    assert.equal(collectLogs(entries, "primary-failed", "warn").length, 1);
    assert.equal(collectLogs(entries, "failover-failed", "warn").length, 2);
    await dal.close();
  });

  test("integration: throws when failover list is empty and primary is unavailable", async () => {
    const yamlConfig = await createConfigFromYaml({
      primary: unreachablePrimaryUrl
    });
    const config: DBConfig = {
      ...yamlConfig,
      failovers: []
    };

    const dal = createDAL(config);
    await assert.rejects(() => dal.query("SELECT 1 as up"), /All providers failed.*primary-real/);
    await dal.close();
  });

  test("integration: cooldown skips primary retry and logs cooldown event", async () => {
    const entries: LogEntry[] = [];
    const config = await createConfigFromYaml({
      logger: createTestLogger(entries),
      primaryRetryCooldownMs: 60_000,
      primary: unreachablePrimaryUrl
    });

    const dal = createDAL(config);
    const firstResponse = await dal.query("SELECT 1 as up");
    const secondResponse = await dal.query("SELECT 1 as up");

    assert.equal(firstResponse.meta.providerName, "failover-1-real");
    assert.equal(secondResponse.meta.providerName, "failover-1-real");
    assert.equal(
      collectLogs(entries, "query-attempt", "debug").filter(
        (entry) => entry.meta?.providerName === "primary-real"
      ).length,
      1
    );
    assert.equal(collectLogs(entries, "primary-cooldown-skip", "warn").length, 1);
    await dal.close();
  });
}
