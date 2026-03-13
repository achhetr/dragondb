# SaiyanDB

Open-source Node.js DAL wrapper that can automatically fail over from an unhealthy primary database to ordered failover databases.

Current database support: `pg` only.

Built using a Vibe Engineering approach to iterate quickly and ship fast while keeping reliability-focused failover behavior.

## Core Behavior

- Attempts `primary` first for each query.
- If `primary` fails, tries `failovers` in configured order.
- Applies `primaryRetryCooldownMs` after primary failures to avoid immediate hot-loop retries.
- Returns query result plus execution metadata (`queryId`, provider used, duration, attempt).
- Throws a combined error if all providers fail.

## Requirements

- Node.js `>=22`
- npm `>=10`
- Reachable PostgreSQL instances for local/integration testing

## Installation

### Option A: Use from source

```bash
git clone https://github.com/akashpaudel/saiyandb.git
cd saiyandb
npm install
npm run build
```

### Option B: Install from npm

```bash
npm install @akashbro/saiyandb
```

## Quick Usage

```ts
import { createDALFromYaml } from "@akashbro/saiyandb";

const dal = await createDALFromYaml("./config/db.config.yaml", {
  envFilePath: ".env",
  strict: true,
  namingStandard: "kebab-case"
});

const health = await dal.health();
console.log(health.overallHealthy);

const response = await dal.query("SELECT now()");
console.log(response.meta.providerName);
console.log(response.result.rows);

await dal.close();
```

## API Surface

- `createDALFromYaml(path, options?)`: create DAL from YAML topology + env references.
- `dal.query(sql, params?)`: execute SQL with automatic failover.
- `dal.getById(table, id)`: helper for `SELECT ... WHERE id = $1 LIMIT 1`.
- `dal.insert(table, data)`: helper for `INSERT ... RETURNING *`.
- `dal.health()`: health snapshot for primary + failovers.
- `dal.close()`: close all database pools.

## Documentation

- `docs/quickstart.md`
- `docs/configuration.md`
- `docs/integration-testing.md`
- `CONTRIBUTING.md`

## Project readiness check

```bash
npm run verify
```

`verify` runs lint, formatting checks, type checks, build, and unit tests in one command.

## Integration Tests (Docker)

```bash
npm run integration:up
npm run test:integration:docker
npm run integration:down
```

Integration uses host ports `56432-56434`, while playground uses `55432-55434`,
so both can run in parallel without port collisions.
If you changed ports locally and see bind errors, stop playground DB containers first:
`cd playground && npm run db:down`.

## Playground (published package)

Use the standalone playground in `playground` to test the latest published
`@akashbro/saiyandb` against multiple Postgres providers.

The playground uses one entrypoint (`run.ts`) that:

- runs health checks for primary and failovers
- executes a sample query (`SELECT 1 as ok`)
- prints provider-level logs, selected provider, and returned rows

From the repo root:

```bash
cd playground
npm run init
npm run start
npm run db:down
```

Useful playground commands (inside `playground`):

```bash
npm run test
npm run db:up
npm run db:down
```

To simulate failover behavior:

```bash
docker compose -f docker-compose.yml stop primary-db
npm run test
docker compose -f docker-compose.yml start primary-db
```

See `playground/README.md` for complete workflow and local tarball testing.

## Versioning and publishing

Use semantic versioning with the release script:

```bash
# one command: determine bump from last commit and publish
npm run release:auto

# dry-run variant
npm run release:auto:dry-run
```

For CI pipelines, call `./scripts/release.sh release` directly.

`release:auto` follows Conventional Commits on the latest commit:

- `major`: commit has `BREAKING CHANGE` or uses `!` in the type (for example `feat!: ...`)
- `minor`: commit type is `feat`
- `patch`: default fallback

`release:auto` also creates a git commit for version files:

- `package.json`
- `package-lock.json`

## License

MIT
