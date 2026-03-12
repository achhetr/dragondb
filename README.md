# SaiyanDB DB Wrapper

Cloud-agnostic DAL for Node.js with:
- one API for queries and CRUD helpers
- one primary provider and multiple ordered failovers
- provider health checks
- structured logging hooks
- YAML-based topology configuration
- `.env`-based secret management

## Prerequisites

- Node.js 25+
- npm 11+
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
import { createDAL, loadDBConfigFromYaml } from "saiyandb";

const config = await loadDBConfigFromYaml("./config/db.config.yaml", {
  envFilePath: ".env"
});

const dal = createDAL(config);
const health = await dal.health();
const result = await dal.query("SELECT now()");
await dal.close();
```

## API

- `createDAL(config)` creates a DAL instance.
- `loadDBConfigFromYaml(path, options?)` loads YAML topology with strict schema validation and resolves env secrets.
- `registerDriver(dbType, factory)` registers an engine driver factory.
- `listRegisteredDrivers()` returns registered db types.
- `resolveDatabaseType(config, options)` returns resolved db type for provider config.
- `createDriverPool(config, options)` creates a pool using the registered driver.
- `dal.query(sql, params?)` executes SQL with failover.
- `dal.getById(table, id)` gets a row by `id`.
- `dal.insert(table, data)` inserts one row and returns it.
- `dal.health()` returns primary and failover health snapshot.
- `dal.close()` closes all pools.

## Database Type Resolution

- The wrapper resolves database type first, then selects a driver implementation.
- Set `defaultDbType` once at root config, or override per provider with `dbType`.
- Current release ships with built-in `pg` support only.
- Additional db types can be plugged in via `registerDriver`.

## YAML + .env Configuration (Recommended)

Use YAML for non-secret topology and failover behavior:
- provider name
- cloud provider type
- role (`primary` or `failover`)
- failover enabled/disabled
- timeout settings
- naming standard for provider names (validated)

Use `.env` for secrets:
- DB URL/connection string
- username/password
- host/port overrides when needed

Example files:
- `config/db.config.yaml.example`
- `.env.example`

Load YAML and env values:

```ts
import { createDAL, loadDBConfigFromYaml } from "saiyandb";

const config = await loadDBConfigFromYaml("./config/db.config.yaml", {
  envFilePath: ".env",
  namingStandard: "kebab-case", // kebab-case | snake_case | camelCase | pascalCase
  strict: true
});

const dal = createDAL(config);
```

### Driver Registration (Extensibility)

```ts
import { registerDriver } from "saiyandb";

registerDriver("my-future-db", (cfg) => {
  // Return a pool-like object compatible with query()/end().
  // Not implemented in MVP.
  throw new Error(`Driver not implemented for ${cfg.name}`);
});
```

## Failover Behavior

1. Query attempts `primary`.
2. If primary fails, it iterates `failovers` in order.
3. On first success, it returns result with provider execution metadata.
4. If all fail, it throws a combined error.

## Health Checks

- Uses `SELECT 1` probes.
- `checkPrimary`, `checkFailovers`, and `checkAll` are available through the internal connection manager and surfaced through `dal.health()`.
- Health checks include latency and last error message.

## Logging

- Default logger writes to console with `[saiyandb]` prefix.
- Inject custom logger via `DBConfig.logger`.
- Sensitive fields are redacted in metadata logs.

## Development

```bash
npm run typecheck
npm run build
npm test
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
- typecheck
- build
- unit tests
