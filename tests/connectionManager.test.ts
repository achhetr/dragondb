import assert from "node:assert/strict";
import test from "node:test";
import { ConnectionManager } from "../src/connection/connectionManager";
import type { CloudDBConfig, DBClient, DBConfig, DBLogger } from "../src/types";

interface ProviderBehavior {
  failQueries?: boolean;
  failHealth?: boolean;
}

function makeProvider(name: string): CloudDBConfig {
  return {
    name,
    provider: "aws",
    connectionString: `postgres://postgres:postgres@localhost:5432/${name}`
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

function createMockPoolFactory(
  behavior: Record<string, ProviderBehavior>
): (cfg: CloudDBConfig) => DBClient {
  return (cfg) =>
    ({
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
    }) as DBClient;
}

function makeConfig(): DBConfig {
  return {
    defaultDbType: "pg",
    logger: makeLogger(),
    primary: makeProvider("primary"),
    failovers: [makeProvider("failover-1"), makeProvider("failover-2")]
  };
}

test("query returns primary result when primary is healthy", async () => {
  const manager = new ConnectionManager(makeConfig(), {
    createPool: createMockPoolFactory({}),
    resolveDbType: () => "pg"
  });
  const response = await manager.query("SELECT * FROM users");
  assert.equal(response.meta.providerName, "primary");
  assert.equal(response.meta.isPrimary, true);
  await manager.close();
});

test("query falls back to first healthy failover provider", async () => {
  const manager = new ConnectionManager(makeConfig(), {
    createPool: createMockPoolFactory({
      primary: { failQueries: true },
      "failover-1": { failQueries: false },
      "failover-2": { failQueries: false }
    }),
    resolveDbType: () => "pg"
  });
  const response = await manager.query("SELECT * FROM users");
  assert.equal(response.meta.providerName, "failover-1");
  assert.equal(response.meta.isPrimary, false);
  await manager.close();
});

test("query throws when all providers fail", async () => {
  const manager = new ConnectionManager(makeConfig(), {
    createPool: createMockPoolFactory({
      primary: { failQueries: true },
      "failover-1": { failQueries: true },
      "failover-2": { failQueries: true }
    }),
    resolveDbType: () => "pg"
  });
  await assert.rejects(() => manager.query("SELECT * FROM users"), /All providers failed/);
  await manager.close();
});

test("query throws when primary fails and no failover is configured", async () => {
  const manager = new ConnectionManager(
    {
      defaultDbType: "pg",
      logger: makeLogger(),
      primary: makeProvider("primary"),
      failovers: []
    },
    {
      createPool: createMockPoolFactory({
        primary: { failQueries: true }
      }),
      resolveDbType: () => "pg"
    }
  );

  await assert.rejects(() => manager.query("SELECT * FROM users"), /All providers failed/);
  await manager.close();
});

test("checkAll marks overallHealthy when any provider is healthy", async () => {
  const manager = new ConnectionManager(makeConfig(), {
    createPool: createMockPoolFactory({
      primary: { failHealth: true },
      "failover-1": { failHealth: false },
      "failover-2": { failHealth: true }
    }),
    resolveDbType: () => "pg"
  });
  const health = await manager.checkAll();

  assert.equal(health.primary.healthy, false);
  assert.equal(health.failovers[0]?.healthy, true);
  assert.equal(health.overallHealthy, true);
  await manager.close();
});

test("primary cooldown skips immediate retry after a failure", async () => {
  let primaryCalls = 0;
  const manager = new ConnectionManager(
    {
      ...makeConfig(),
      primaryRetryCooldownMs: 10_000
    },
    {
      createPool: (cfg) =>
        ({
          query: async (sql: string) => {
            if (cfg.name === "primary") {
              primaryCalls += 1;
              throw new Error("primary down");
            }
            return { rows: [{ provider: cfg.name, sql }] };
          },
          end: async () => undefined
        }) as DBClient,
      resolveDbType: () => "pg"
    }
  );

  await manager.query("SELECT 1");
  await manager.query("SELECT 2");
  assert.equal(primaryCalls, 1);
  await manager.close();
});
