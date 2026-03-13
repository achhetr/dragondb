import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadDBConfigFromYaml } from "../src/config/yamlConfig";

test("loadDBConfigFromYaml resolves provider metadata from yaml and secrets from env", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saiyandb-yaml-test-"));
  const yamlPath = join(dir, "db.yaml");

  try {
    const yaml = `
defaultDbType: pg
failover:
  enabled: true
providers:
  - name: primary-db
    role: primary
    provider: aws
    env:
      connectionString: DB_PRIMARY_URL
  - name: failover-db
    role: failover
    provider: gcp
    env:
      connectionString: DB_FAILOVER_URL
`;
    await writeFile(yamlPath, yaml, "utf8");

    const config = await loadDBConfigFromYaml(yamlPath, {
      env: {
        DB_PRIMARY_URL: "postgres://postgres:secret@localhost:5432/appdb",
        DB_FAILOVER_URL: "postgres://postgres:secret@localhost:5433/appdb"
      }
    });

    assert.equal(config.defaultDbType, "pg");
    assert.equal(config.primary.name, "primary-db");
    assert.equal(
      config.primary.connectionString,
      "postgres://postgres:secret@localhost:5432/appdb"
    );
    assert.equal(config.failovers?.[0]?.name, "failover-db");
    assert.equal(
      config.failovers?.[0]?.connectionString,
      "postgres://postgres:secret@localhost:5433/appdb"
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("strict schema rejects unknown keys by default", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saiyandb-yaml-test-"));
  const yamlPath = join(dir, "db.yaml");

  try {
    const yaml = `
defaultDbType: pg
unexpectedTopLevel: true
providers:
  - name: primary-db
    role: primary
    provider: aws
    env:
      connectionString: PRIMARY_URL
`;
    await writeFile(yamlPath, yaml, "utf8");

    await assert.rejects(() => loadDBConfigFromYaml(yamlPath), /Unknown keys at root/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("kebab-case naming is enforced by default", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saiyandb-yaml-test-"));
  const yamlPath = join(dir, "db.yaml");

  try {
    const yaml = `
defaultDbType: pg
providers:
  - name: PrimaryDB
    role: primary
    provider: aws
    env:
      connectionString: PRIMARY_URL
`;
    await writeFile(yamlPath, yaml, "utf8");

    await assert.rejects(() => loadDBConfigFromYaml(yamlPath), /must follow kebab-case/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("user can choose snake_case naming standard", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saiyandb-yaml-test-"));
  const yamlPath = join(dir, "db.yaml");

  try {
    const yaml = `
defaultDbType: pg
providers:
  - name: primary_db
    role: primary
    provider: aws
    env:
      connectionString: PRIMARY_URL
`;
    await writeFile(yamlPath, yaml, "utf8");

    const config = await loadDBConfigFromYaml(yamlPath, {
      namingStandard: "snake_case",
      env: { PRIMARY_URL: "postgres://postgres:postgres@localhost:5432/appdb" }
    });
    assert.equal(config.primary.name, "primary_db");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("yaml env references must exist in runtime env", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saiyandb-yaml-test-"));
  const yamlPath = join(dir, "db.yaml");

  try {
    const yaml = `
defaultDbType: pg
providers:
  - name: primary-db
    role: primary
    provider: aws
    env:
      connectionString: PRIMARY_URL
`;
    await writeFile(yamlPath, yaml, "utf8");

    await assert.rejects(
      () => loadDBConfigFromYaml(yamlPath, { env: {} }),
      /Missing required env vars referenced by YAML/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("yaml schema rejects non-connectionString env keys", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saiyandb-yaml-test-"));
  const yamlPath = join(dir, "db.yaml");

  try {
    const yaml = `
defaultDbType: pg
providers:
  - name: primary-db
    role: primary
    provider: aws
    env:
      host: DB_PRIMARY_HOST
`;
    await writeFile(yamlPath, yaml, "utf8");

    await assert.rejects(
      () => loadDBConfigFromYaml(yamlPath),
      /Unknown keys at providers\[0\]\.env/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("failover providers can resolve from failover.connectionStrings list by order", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saiyandb-yaml-test-"));
  const yamlPath = join(dir, "db.yaml");

  try {
    const yaml = `
defaultDbType: pg
failover:
  enabled: true
  connectionStrings: FAILOVER_URLS
providers:
  - name: primary-db
    role: primary
    provider: aws
    env:
      connectionString: PRIMARY_URL
  - name: failover-one
    role: failover
    provider: gcp
  - name: failover-two
    role: failover
    provider: azure
`;
    await writeFile(yamlPath, yaml, "utf8");

    const config = await loadDBConfigFromYaml(yamlPath, {
      env: {
        PRIMARY_URL: "postgres://postgres:postgres@localhost:5432/appdb",
        FAILOVER_URLS:
          "postgres://postgres:postgres@localhost:5433/appdb,postgres://postgres:postgres@localhost:5434/appdb"
      }
    });

    assert.equal(
      config.failovers?.[0]?.connectionString,
      "postgres://postgres:postgres@localhost:5433/appdb"
    );
    assert.equal(
      config.failovers?.[1]?.connectionString,
      "postgres://postgres:postgres@localhost:5434/appdb"
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("failover.connectionStrings must provide enough values for enabled failovers", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saiyandb-yaml-test-"));
  const yamlPath = join(dir, "db.yaml");

  try {
    const yaml = `
defaultDbType: pg
failover:
  enabled: true
  connectionStrings: FAILOVER_URLS
providers:
  - name: primary-db
    role: primary
    provider: aws
    env:
      connectionString: PRIMARY_URL
  - name: failover-one
    role: failover
    provider: gcp
  - name: failover-two
    role: failover
    provider: azure
`;
    await writeFile(yamlPath, yaml, "utf8");

    await assert.rejects(
      () =>
        loadDBConfigFromYaml(yamlPath, {
          env: {
            PRIMARY_URL: "postgres://postgres:postgres@localhost:5432/appdb",
            FAILOVER_URLS: "postgres://postgres:postgres@localhost:5433/appdb"
          }
        }),
      /Not enough failover connection strings/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("failover.connectionStrings rejects whitespace-only env value", async () => {
  const dir = await mkdtemp(join(tmpdir(), "saiyandb-yaml-test-"));
  const yamlPath = join(dir, "db.yaml");

  try {
    const yaml = `
defaultDbType: pg
failover:
  enabled: true
  connectionStrings: FAILOVER_URLS
providers:
  - name: primary-db
    role: primary
    provider: aws
    env:
      connectionString: PRIMARY_URL
  - name: failover-one
    role: failover
    provider: gcp
`;
    await writeFile(yamlPath, yaml, "utf8");

    await assert.rejects(
      () =>
        loadDBConfigFromYaml(yamlPath, {
          env: {
            PRIMARY_URL: "postgres://postgres:postgres@localhost:5432/appdb",
            FAILOVER_URLS: "   "
          }
        }),
      /Missing required env vars referenced by YAML/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
