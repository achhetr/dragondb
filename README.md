# SaiyanDB

Cloud-agnostic Node.js DAL with deterministic PostgreSQL failover.

SaiyanDB keeps query execution predictable when a primary provider degrades by
attempting providers in a strict order and returning structured metadata for each
successful execution.

## Table of Contents

- [At a Glance](#at-a-glance)
- [Why SaiyanDB](#why-saiyandb)
- [Reliability Guarantees](#reliability-guarantees)
- [Known Limits](#known-limits)
- [Installation](#installation)
- [Quick Usage](#quick-usage)
- [API Surface](#api-surface)
- [Operational Workflows](#operational-workflows)
- [Documentation](#documentation)
- [License](#license)

## At a Glance

- **Database support:** PostgreSQL (`pg`) only
- **Runtime:** Node.js `>=22`, npm `>=10`
- **Config model:** YAML topology + `.env` secrets
- **Execution model:** primary-first, ordered failover fallback
- **Health model:** non-destructive provider checks (`SELECT 1`)
- **Current scope:** single-database-family DAL focused on reliability behavior

## Why SaiyanDB

- Deterministic failover path: primary first, then enabled failovers in order
- Cooldown protection via `primaryRetryCooldownMs` to avoid hot-loop retries
- Strict config validation (unknown keys, missing env references, invalid shape)
- Query execution metadata (`queryId`, provider, duration, attempt)
- Small, typed API surface that is easy to audit and test

## Reliability Guarantees

- Every query attempts the configured primary provider first.
- On primary failure, failovers are attempted in configured order.
- Provider failures are not swallowed; all-provider failures throw a combined error.
- Health checks remain non-destructive and provider-scoped.

## Known Limits

- Only PostgreSQL is supported today.
- `getById` assumes an `id` column in the target table.
- `insert` and `getById` validate table/column identifiers and are intended for
  trusted schema names.
- This library does not replace migrations, ORM modeling, or access-control policy.

## Installation

```bash
npm install @akashbro/saiyandb
```

## Quick Usage

### Happy path (YAML + `.env`)

```ts
import { createDALFromYaml } from "@akashbro/saiyandb";

const dal = await createDALFromYaml("./config/db.config.yaml", {
  envFilePath: ".env",
  strict: true,
  namingStandard: "kebab-case",
  primaryRetryCooldownMs: 5_000
});

const health = await dal.health();
console.log("Overall healthy:", health.overallHealthy);

const created = await dal.insert("users", { name: "Goku", email: "goku@example.com" });
const user = await dal.getById("users", created?.id as number);
const response = await dal.query("SELECT now()");

console.log("Provider:", response.meta.providerName);
console.log("User:", user);

await dal.close();
```

### Production knobs (logger + retry tuning)

```ts
import { createDALFromYaml } from "@akashbro/saiyandb";

const dal = await createDALFromYaml("./config/db.config.yaml", {
  envFilePath: ".env",
  strict: true,
  primaryRetryCooldownMs: 15_000,
  logger: {
    debug: (message, meta) => console.debug(message, meta),
    info: (message, meta) => console.info(message, meta),
    warn: (message, meta) => console.warn(message, meta),
    error: (message, meta) => console.error(message, meta)
  }
});
```

## API Surface

- `createDALFromYaml(path, options?)`: create DAL from YAML topology + env references
- `dal.query(sql, params?)`: execute SQL with automatic failover
- `dal.getById(table, id)`: helper for `SELECT ... WHERE id = $1 LIMIT 1`
- `dal.insert(table, data)`: helper for `INSERT ... RETURNING *`
- `dal.health()`: health snapshot for primary and failovers
- `dal.close()`: close all database pools

## Operational Workflows

### Local quality gate

```bash
npm run verify
```

Runs lint, format check, typecheck, build, and unit tests.

### Integration tests (Docker)

```bash
npm run integration:up
npm run test:integration:docker
npm run integration:down
```

Integration uses host ports `56432-56434`; playground uses `55432-55434`, so both
stacks can run in parallel without collisions.

### Playground (published package validation)

```bash
cd playground
npm run init
npm run start
npm run db:down
```

For full workflow details, see [`playground/README.md`](playground/README.md).

### Versioning and publishing

```bash
# determine bump from latest commit and publish
npm run release:auto

# dry-run variant
npm run release:auto:dry-run
```

`release:auto` follows Conventional Commits on the latest commit:

- `major`: commit has `BREAKING CHANGE` or uses `!` in the type (for example `feat!: ...`)
- `minor`: commit type is `feat`
- `patch`: default fallback

The release flow commits version file updates, including:

- `package.json`
- `package-lock.json`
- `playground/package.json`
- `playground/package-lock.json`

## Documentation

- [`docs/quickstart.md`](docs/quickstart.md): end-to-end setup from config files to first query
- [`docs/configuration.md`](docs/configuration.md): YAML schema, strict validation, naming, and security guidance
- [`docs/integration-testing.md`](docs/integration-testing.md): Docker topology, host env vars, and failover test workflow
- [`CONTRIBUTING.md`](CONTRIBUTING.md): development expectations, testing, and PR workflow

## License

MIT
