# Quickstart

This guide gets you running with YAML + `.env` configuration and automatic failover.

## 1) Install

Install from source or GitHub.

```bash
# Source install
git clone https://github.com/akashpaudel/saiyandb.git
cd saiyandb
npm install
npm run build
```

Or:

```bash
# Git dependency
npm install github:akashpaudel/saiyandb
```

## 2) Create config files

Create `config/db.config.yaml`:

```yaml
defaultDbType: pg
queryTimeoutMs: 5000
healthcheckTimeoutMs: 3000

failover:
  enabled: true

providers:
  - name: primary-real
    role: primary
    provider: aws
    dbType: pg
    env:
      connectionString: PRIMARY_DB_URL

  - name: failover-1-real
    role: failover
    provider: gcp
    dbType: pg
    env:
      connectionString: FAILOVER_DB_URL_1

  - name: failover-2-real
    role: failover
    provider: azure
    dbType: pg
    env:
      connectionString: FAILOVER_DB_URL_2
```

Create `.env`:

```bash
PRIMARY_DB_URL=postgres://postgres:postgres@localhost:5432/appdb
FAILOVER_DB_URL_1=postgres://postgres:postgres@localhost:5433/appdb
FAILOVER_DB_URL_2=postgres://postgres:postgres@localhost:5434/appdb
```

Use one env var per failover in app usage because each provider maps to its own
`env.connectionString` key in YAML. The comma-separated `FAILOVER_DB_URLS` format
is only used by integration tests, where values are split and remapped to
`FAILOVER_DB_URL_1` and `FAILOVER_DB_URL_2`.

## 3) Initialize and query

```ts
import { createDALFromYaml } from "saiyandb";

const dal = await createDALFromYaml("./config/db.config.yaml", {
  envFilePath: ".env",
  strict: true,
  namingStandard: "kebab-case",
  primaryRetryCooldownMs: 5000
});

const health = await dal.health();
console.log("Overall healthy:", health.overallHealthy);

const response = await dal.query("SELECT 1 as up");
console.log("Provider used:", response.meta.providerName);
console.log("Rows:", response.result.rows);

await dal.close();
```

## 4) Validate failover locally

Run integration tests against Dockerized Postgres providers:

```bash
npm run integration:up
npm run test:integration:docker
npm run integration:down
```

For host-based runs and environment details, see `docs/integration-testing.md`.
