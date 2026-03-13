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
- `failover.connectionStrings` (string env key, optional; comma-separated failover URLs)
- `providers` (required, non-empty array)

Each provider:

- `name` (required string; must match naming standard)
- `role` (required: `primary` or `failover`)
- `provider` (required string; cloud/vendor label)
- `dbType` (optional string; defaults to `pg`)
- `enabled` (optional boolean; defaults to `true`)
- `ssl` (optional boolean)
- `unsafeDisableTlsCertVerification` (optional boolean; `true` is unsafe and intended for local development only)
- `env.connectionString` (required for `primary`; optional for `failover` when `failover.connectionStrings` is used)

## Example configuration

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
    enabled: true
```

```bash
PRIMARY_DB_URL=postgres://postgres:postgres@localhost:5432/appdb
FAILOVER_DB_URLS=postgres://postgres:postgres@localhost:5433/appdb,postgres://postgres:postgres@localhost:5434/appdb
```

When `failover.connectionStrings` is configured, enabled failover providers consume
entries in list order.

## Production security hardening

- Enable `ssl: true` for every provider in production.
- Keep `unsafeDisableTlsCertVerification` unset (or `false`) in production.
- Use `unsafeDisableTlsCertVerification: true` only for local/dev self-signed cert workflows.
- Use least-privileged DB users (read/write scopes only as needed).
- Rotate DB credentials regularly and avoid long-lived shared credentials.
- Keep `.env` files out of source control and secret scanners.

### TLS behavior

When `ssl: true`:

- Default behavior verifies server certificates (`rejectUnauthorized: true`).
- If `unsafeDisableTlsCertVerification: true`, certificate verification is disabled.
- Disabling verification increases MITM risk and should never be used in production.

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
- If `failover.connectionStrings` is set, failover connection strings are assigned by failover order.
- Primary retries are temporarily skipped after a failure based on `primaryRetryCooldownMs`.
- If `failover.enabled: false`, only primary is used.
