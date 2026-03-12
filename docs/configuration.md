# Configuration

SaiyanDB uses YAML for topology and `.env` for secrets.

## Recommended setup

- Put non-secret routing/failover config in YAML.
- Put credentials and URLs in `.env`.
- Reference secret env vars from YAML using `env.connectionString`.

## YAML schema overview

Top-level fields:

- `defaultDbType` (string, optional; defaults to `pg`)
- `queryTimeoutMs` (number, optional)
- `healthcheckTimeoutMs` (number, optional)
- `failover.enabled` (boolean, optional; defaults to `true`)
- `providers` (required, non-empty array)

Each provider:

- `name` (required string; must match naming standard)
- `role` (required: `primary` or `failover`)
- `provider` (required string; cloud/vendor label)
- `dbType` (optional string; defaults to `pg`)
- `enabled` (optional boolean; defaults to `true`)
- `ssl` (optional boolean)
- `env.connectionString` (required string env key)

## Example configuration

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
    ssl: false
    env:
      connectionString: PRIMARY_DB_URL

  - name: failover-1-real
    role: failover
    provider: gcp
    dbType: pg
    enabled: true
    env:
      connectionString: FAILOVER_DB_URL_1
```

```bash
PRIMARY_DB_URL=postgres://postgres:postgres@localhost:5432/appdb
FAILOVER_DB_URL_1=postgres://postgres:postgres@localhost:5433/appdb
```

## Strict validation

By default, YAML parsing is strict:

- Unknown keys are rejected.
- Invalid value types are rejected.
- Missing referenced env vars are rejected.
- Exactly one enabled `primary` provider is required.

You can disable strict unknown-key checks with `strict: false`:

```ts
import { createDALFromYaml } from "saiyandb";

const dal = await createDALFromYaml("./config/db.config.yaml", {
  envFilePath: ".env",
  strict: false
});
```

## Naming standards

Provider names are validated against one of:

- `kebab-case` (default)
- `snake_case`
- `camelCase`
- `pascalCase`

Example:

```ts
import { createDALFromYaml } from "saiyandb";

const dal = await createDALFromYaml("./config/db.config.yaml", {
  envFilePath: ".env",
  namingStandard: "snake_case"
});
```

## Failover-specific behavior

- Queries try `primary` first.
- If primary fails, failovers are attempted in listed order.
- Primary retries are temporarily skipped after a failure based on `primaryRetryCooldownMs`.
- If `failover.enabled: false`, only primary is used.
