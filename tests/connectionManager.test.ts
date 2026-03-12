import assert from "node:assert/strict";
import test from "node:test";
import { ConnectionManager } from "../src/connection/connectionManager";
import { registerDriver } from "../src/drivers";
import type { CloudDBConfig, DBClient, DBConfig, DBLogger } from "../src/types";

interface ProviderBehavior {
  failQueries?: boolean;
  failHealth?: boolean;
}

function uniqueDbType(prefix: string): string {
  return `unit-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeProvider(name: string): CloudDBConfig {
  return {
    name,
    provider: "aws",
    host: "localhost",
    port: 5432,
    database: "db",
    username: "user",
    password: "pass"
  };
}

function makeLogger(): DBLogger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  };
}

function registerMockDriver(dbType: string, behavior: Record<string, ProviderBehavior>): void {
  registerDriver(
    dbType,
    (cfg) => {
      const mockPool = {
        query: async (sql: string) => {
          const rules = behavior[cfg.name] ?? {};
          if (sql === "SELECT 1" && rules.failHealth) {
            throw new Error(`${cfg.name} health failure`);
          }
          if (sql !== "SELECT 1" && rules.failQueries) {
            throw new Error(`${cfg.name} query failure`);
          }
          return { rows: [{ provider: cfg.name }] };
        },
        end: async () => undefined
      };
      return mockPool as DBClient;
    },
    { overwrite: true }
  );
}

function makeConfig(dbType: string): DBConfig {
  return {
    defaultDbType: dbType,
    logger: makeLogger(),
    primary: makeProvider("primary"),
    failovers: [makeProvider("failover-1"), makeProvider("failover-2")]
  };
}

test("query returns primary result when primary is healthy", async () => {
  const dbType = uniqueDbType("primary-success");
  registerMockDriver(dbType, {});

  const manager = new ConnectionManager(makeConfig(dbType));
  const response = await manager.query("SELECT * FROM users");
  assert.equal(response.meta.providerName, "primary");
  assert.equal(response.meta.isPrimary, true);
  await manager.close();
});

test("query falls back to first healthy failover provider", async () => {
  const dbType = uniqueDbType("failover");
  registerMockDriver(dbType, {
    primary: { failQueries: true },
    "failover-1": { failQueries: false },
    "failover-2": { failQueries: false }
  });

  const manager = new ConnectionManager(makeConfig(dbType));
  const response = await manager.query("SELECT * FROM users");
  assert.equal(response.meta.providerName, "failover-1");
  assert.equal(response.meta.isPrimary, false);
  await manager.close();
});

test("query throws when all providers fail", async () => {
  const dbType = uniqueDbType("all-fail");
  registerMockDriver(dbType, {
    primary: { failQueries: true },
    "failover-1": { failQueries: true },
    "failover-2": { failQueries: true }
  });

  const manager = new ConnectionManager(makeConfig(dbType));
  await assert.rejects(() => manager.query("SELECT * FROM users"), /All providers failed/);
  await manager.close();
});

test("query throws when primary fails and no failover is configured", async () => {
  const dbType = uniqueDbType("no-failover");
  registerMockDriver(dbType, {
    primary: { failQueries: true }
  });

  const manager = new ConnectionManager({
    defaultDbType: dbType,
    logger: makeLogger(),
    primary: makeProvider("primary"),
    failovers: []
  });

  await assert.rejects(() => manager.query("SELECT * FROM users"), /All providers failed/);
  await manager.close();
});

test("checkAll marks overallHealthy when any provider is healthy", async () => {
  const dbType = uniqueDbType("health");
  registerMockDriver(dbType, {
    primary: { failHealth: true },
    "failover-1": { failHealth: false },
    "failover-2": { failHealth: true }
  });

  const manager = new ConnectionManager(makeConfig(dbType));
  const health = await manager.checkAll();

  assert.equal(health.primary.healthy, false);
  assert.equal(health.failovers[0]?.healthy, true);
  assert.equal(health.overallHealthy, true);
  await manager.close();
});

test("primary cooldown skips immediate retry after a failure", async () => {
  const dbType = uniqueDbType("cooldown");
  let primaryCalls = 0;

  registerDriver(
    dbType,
    (cfg) => {
      const mockPool = {
        query: async (sql: string) => {
          if (cfg.name === "primary") {
            primaryCalls += 1;
            throw new Error("primary down");
          }
          return { rows: [{ provider: cfg.name, sql }] };
        },
        end: async () => undefined
      };
      return mockPool as DBClient;
    },
    { overwrite: true }
  );

  const manager = new ConnectionManager({
    ...makeConfig(dbType),
    primaryRetryCooldownMs: 10_000
  });

  await manager.query("SELECT 1");
  await manager.query("SELECT 2");
  assert.equal(primaryCalls, 1);
  await manager.close();
});
