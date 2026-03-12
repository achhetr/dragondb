import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { createDriverPool, registerDriver, resolveDatabaseType } from "../src/drivers";
import type { CloudDBConfig } from "../src/types";

function makeProvider(partial?: Partial<CloudDBConfig>): CloudDBConfig {
  return {
    name: partial?.name ?? "provider-1",
    provider: partial?.provider ?? "aws",
    dbType: partial?.dbType,
    host: "localhost",
    port: 5432,
    database: "db",
    username: "user",
    password: "pass"
  };
}

function uniqueDbType(prefix: string): string {
  return `unit-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test("resolveDatabaseType uses provider dbType over default", () => {
  const cfg = makeProvider({ dbType: "custom-db" });
  const result = resolveDatabaseType(cfg, { defaultDbType: "postgres" });
  assert.equal(result, "custom-db");
});

test("createDriverPool uses registered driver factory", () => {
  const dbType = uniqueDbType("driver");
  let called = false;

  registerDriver(dbType, () => {
    called = true;
    const mockPool = {
      query: async () => ({ rows: [{ ok: true }] }),
      end: async () => undefined
    };
    return mockPool as unknown as Pool;
  });

  const pool = createDriverPool(makeProvider({ dbType }), {});
  assert.ok(pool);
  assert.equal(called, true);
});

test("createDriverPool throws for unsupported db type", () => {
  assert.throws(
    () => createDriverPool(makeProvider({ dbType: "definitely-not-registered" }), {}),
    /Unsupported database type/
  );
});
