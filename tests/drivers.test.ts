import assert from "node:assert/strict";
import test from "node:test";
import { createDriverPool, resolveDatabaseType } from "../src/drivers";
import { buildPostgresPoolConfig } from "../src/providers/postgresProvider";
import type { CloudDBConfig } from "../src/types";

function makeProvider(partial?: Partial<CloudDBConfig>): CloudDBConfig {
  return {
    name: partial?.name ?? "provider-1",
    provider: partial?.provider ?? "aws",
    dbType: partial?.dbType,
    ssl: partial?.ssl,
    unsafeDisableTlsCertVerification: partial?.unsafeDisableTlsCertVerification,
    connectionString:
      partial?.connectionString ?? "postgres://postgres:postgres@localhost:5432/testdb"
  };
}

test("resolveDatabaseType uses provider dbType over default", () => {
  const cfg = makeProvider({ dbType: "custom-db" });
  const result = resolveDatabaseType(cfg, { defaultDbType: "postgres" });
  assert.equal(result, "custom-db");
});

test("createDriverPool supports built-in pg driver", async () => {
  const pool = createDriverPool(makeProvider({ dbType: "pg" }), {});
  assert.ok(pool);
  await pool.end();
});

test("createDriverPool supports built-in postgres alias", async () => {
  const pool = createDriverPool(makeProvider({ dbType: "postgres" }), {});
  assert.ok(pool);
  await pool.end();
});

test("createDriverPool throws for unsupported db type", () => {
  assert.throws(
    () => createDriverPool(makeProvider({ dbType: "definitely-not-registered" }), {}),
    /Unsupported database type/
  );
});

test("buildPostgresPoolConfig verifies certs by default when ssl enabled", () => {
  const config = buildPostgresPoolConfig(
    makeProvider({
      ssl: true,
      unsafeDisableTlsCertVerification: undefined
    }),
    2000
  );

  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.equal(config.statement_timeout, 2000);
});

test("buildPostgresPoolConfig allows explicit unsafe TLS opt-out", () => {
  const config = buildPostgresPoolConfig(
    makeProvider({
      ssl: true,
      unsafeDisableTlsCertVerification: true
    })
  );

  assert.deepEqual(config.ssl, { rejectUnauthorized: false });
});
