import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadDBConfigFromYaml } from "../src/config/yamlConfig";

test("loadDBConfigFromYaml resolves provider metadata from yaml and secrets from env", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saiyandb-yaml-test-"));
  const yamlPath = join(dir, "db.yaml");

  const yaml = `
defaultDbType: pg
failover:
  enabled: true
providers:
  - name: primary-db
    role: primary
    provider: aws
    database: appdb
    env:
      host: DB_PRIMARY_HOST
      port: DB_PRIMARY_PORT
      username: DB_PRIMARY_USER
      password: DB_PRIMARY_PASSWORD
  - name: failover-db
    role: failover
    provider: gcp
    database: appdb
    env:
      connectionString: DB_FAILOVER_URL
`;
  await writeFile(yamlPath, yaml, "utf8");

  const config = await loadDBConfigFromYaml(yamlPath, {
    env: {
      DB_PRIMARY_HOST: "localhost",
      DB_PRIMARY_PORT: "5432",
      DB_PRIMARY_USER: "postgres",
      DB_PRIMARY_PASSWORD: "secret",
      DB_FAILOVER_URL: "postgres://postgres:secret@localhost:5433/appdb"
    }
  });

  assert.equal(config.defaultDbType, "pg");
  assert.equal(config.primary.name, "primary-db");
  assert.equal(config.primary.host, "localhost");
  assert.equal(config.primary.password, "secret");
  assert.equal(config.failovers?.[0]?.name, "failover-db");
  assert.equal(config.failovers?.[0]?.connectionString, "postgres://postgres:secret@localhost:5433/appdb");

  await rm(dir, { recursive: true, force: true });
});
