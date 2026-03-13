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
# npm
npm install @akashbro/saiyandb
```

## 2) Create config files

Create `config/db.config.yaml`:

```yaml
defaultDbType: pg
queryTimeoutMs: 5000
healthcheckTimeoutMs: 3000

failover:
  enabled: true
  connectionStrings: FAILOVER_DB_URLS

providers:
  - name: primary-real
    role: primary
    provider: aws
    dbType: pg
    ssl: true
    env:
      connectionString: PRIMARY_DB_URL

  - name: failover-1-real
    role: failover
    provider: gcp
    dbType: pg

  - name: failover-2-real
    role: failover
    provider: azure
    dbType: pg
```

Create `.env`:

```bash
PRIMARY_DB_URL=postgres://postgres:postgres@localhost:5432/appdb
FAILOVER_DB_URLS=postgres://postgres:postgres@localhost:5433/appdb,postgres://postgres:postgres@localhost:5434/appdb
```

These credentials are examples for local development only. Never reuse example passwords in shared, CI, or production environments.

Failovers are matched to this list by provider order in YAML. In this example:
`failover-1-real` uses the first URL and `failover-2-real` uses the second URL.

## 3) Initialize and query

```ts
import { createDALFromYaml } from "@akashbro/saiyandb";

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

## Production checklist

- Use strong, rotated credentials and least-privileged DB roles.
- Keep `.env` out of git and secret-share channels.
- Keep `ssl: true` enabled for all providers.
- Do not set `unsafeDisableTlsCertVerification` outside local development.
