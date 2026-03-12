# SaiyanDB Postgres Wrapper

Cloud-agnostic Postgres DAL for Node.js with:
- one API for queries and CRUD helpers
- one primary provider and multiple ordered failovers
- provider health checks
- structured logging hooks

## Prerequisites

- Node.js 18+
- npm 9+
- reachable Postgres instances

## Install For Local Development

```bash
git clone <your-repo-url>
cd dragondb
npm install
npm run build
```

## Install As A Dependency

```bash
npm install saiyandb-pg-wrapper
```

## Quick Usage

```ts
import { createDAL, type DBConfig } from "saiyandb-pg-wrapper";

const config: DBConfig = {
  defaultDbType: "postgres",
  primary: {
    name: "aws-primary",
    provider: "aws",
    host: "aws-rds.example.com",
    port: 5432,
    database: "mydb",
    username: "user",
    password: "pass"
  },
  failovers: [
    {
      name: "gcp-failover",
      provider: "gcp",
      host: "gcp-sql.example.com",
      port: 5432,
      database: "mydb",
      username: "user",
      password: "pass"
    },
    {
      name: "azure-failover",
      provider: "azure",
      host: "azure-postgres.example.com",
      port: 5432,
      database: "mydb",
      username: "user",
      password: "pass"
    }
  ]
};

const dal = createDAL(config);
const health = await dal.health();
const result = await dal.query("SELECT now()");
await dal.close();
```

## API

- `createDAL(config)` creates a DAL instance.
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
- MVP ships with built-in `postgres`; additional db types can be plugged in via `registerDriver`.

### Driver Registration (Extensibility)

```ts
import { registerDriver } from "saiyandb-pg-wrapper";

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
npm run example
npm run example:failover
```

## First Commit Checklist

- Confirm `.gitignore` is present.
- Run `npm run typecheck` and `npm run build`.
- Review files with `git status`.
