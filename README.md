# SaiyanDB DB Wrapper

Cloud-agnostic DAL for Node.js with:

- one API for queries and CRUD helpers
- one primary provider and multiple ordered failovers
- provider health checks
- structured logging hooks
- YAML-based topology configuration
- `.env`-based secret management

## Prerequisites

- Node.js 20+ (LTS recommended: 22)
- npm 10+
- reachable pg instances

## Install For Local Development

```bash
git clone <your-repo-url>
cd dragondb
npm install
npm run build
```

## Install As A Dependency

```bash
npm install saiyandb
```

## Quick Usage

```ts
import { createDALFromYaml } from "saiyandb";

const dal = await createDALFromYaml("./config/db.config.yaml", {
  envFilePath: ".env"
});
const health = await dal.health();
const result = await dal.query("SELECT now()");
await dal.close();
```

## API

- `createDALFromYaml(path, options?)` creates a DAL from YAML topology and env secrets.
- `dal.query(sql, params?)` executes SQL with failover.
- `dal.getById(table, id)` gets a row by `id`.
- `dal.insert(table, data)` inserts one row and returns it.
- `dal.health()` returns primary and failover health snapshot.
- `dal.close()` closes all pools.

## Documentation

- `docs/quickstart.md`
- `docs/configuration.md`

## Database Type Resolution

- The wrapper resolves database type first, then selects a driver implementation.
- Set `defaultDbType` once at root config, or override per provider with `dbType`.
- Current release supports `pg` only.

## YAML + .env Configuration (Recommended)

Use YAML for non-secret topology and failover behavior:

- provider name
- cloud provider type
- role (`primary` or `failover`)
- failover enabled/disabled
- timeout settings
- naming standard for provider names (validated)

Use `.env` for secrets:

- DB connection string for each provider (`env.connectionString`)

Example files:

- `config/db.config.yaml.example`
- `.env.example`

Load YAML and env values:

```ts
import { createDALFromYaml } from "saiyandb";

const dal = await createDALFromYaml("./config/db.config.yaml", {
  envFilePath: ".env",
  namingStandard: "kebab-case", // kebab-case | snake_case | camelCase | pascalCase
  strict: true
});
```

## Failover Behavior

1. Query attempts `primary`.
2. If primary fails, it iterates `failovers` in order.
3. Primary retries are cooldown-gated to reduce repeated failures (`primaryRetryCooldownMs`).
4. On first success, it returns result with provider execution metadata.
5. Query metadata includes `queryId`, attempt number, and execution duration.
6. If all fail, it throws a combined error.

## Health Checks

- Uses `SELECT 1` probes.
- `checkPrimary`, `checkFailovers`, and `checkAll` are available through the internal connection manager and surfaced through `dal.health()`.
- Health checks include latency and last error message.

## Logging

- Default logger writes to console with `[saiyandb]` prefix.
- Inject custom logger via `createDALFromYaml(..., { logger })`.
- Sensitive fields are redacted in metadata logs.

## Development

```bash
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
npm run example
npm run example:failover
npm run example:yaml
```

## First Commit Checklist

- Confirm `.gitignore` is present.
- Run `npm run typecheck`, `npm run build`, and `npm test`.
- Review files with `git status`.

## CI

GitHub Actions workflow is included at `.github/workflows/ci.yml` and runs:

- lint
- format check
- typecheck
- build
- unit tests (Node 20/22)
- integration tests (Dockerized multi-Postgres failover)
