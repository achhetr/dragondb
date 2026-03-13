import assert from "node:assert/strict";
import test from "node:test";
import { createDALFromYaml } from "../../src";
import {
  collectLogs,
  createDalFromYaml,
  createTestLogger,
  failoverTwoUrl,
  missingIntegrationEnv,
  noFailoverYamlPath,
  unreachableFailoverOneUrl,
  unreachableFailoverTwoUrl,
  unreachablePrimaryUrl,
  type LogEntry
} from "./helpers";

const missingEnv = missingIntegrationEnv();

if (missingEnv.length > 0) {
  test("integration: failover behavior skipped", { skip: true }, () => {
    assert.ok(true);
  });
} else {
  test("integration: ordered failover reaches second failover and logs events", async () => {
    const entries: LogEntry[] = [];
    const dal = await createDalFromYaml({
      logger: createTestLogger(entries),
      primary: unreachablePrimaryUrl,
      failovers: [unreachableFailoverOneUrl, failoverTwoUrl as string]
    });

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
    const dal = await createDalFromYaml({
      logger: createTestLogger(entries),
      primary: unreachablePrimaryUrl,
      failovers: [unreachableFailoverOneUrl, unreachableFailoverTwoUrl]
    });
    await assert.rejects(
      () => dal.query("SELECT 1 as up"),
      /All providers failed.*primary-real.*failover-1-real.*failover-2-real/
    );
    assert.equal(collectLogs(entries, "primary-failed", "warn").length, 1);
    assert.equal(collectLogs(entries, "failover-failed", "warn").length, 2);
    await dal.close();
  });

  test("integration: throws when no failover providers are enabled in YAML", async () => {
    const dal = await createDALFromYaml(noFailoverYamlPath, {
      env: {
        PRIMARY_DB_URL: unreachablePrimaryUrl
      },
      primaryRetryCooldownMs: 5_000
    });
    await assert.rejects(() => dal.query("SELECT 1 as up"), /All providers failed.*primary-real/);
    await dal.close();
  });

  test("integration: cooldown skips primary retry and logs cooldown event", async () => {
    const entries: LogEntry[] = [];
    const dal = await createDalFromYaml({
      logger: createTestLogger(entries),
      primaryRetryCooldownMs: 60_000,
      primary: unreachablePrimaryUrl
    });
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
