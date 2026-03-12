# Integration Testing

## Purpose

Integration tests validate real failover behavior with isolated Postgres targets and verify that failover log events are emitted.

## Environment variables

Set these variables for host-based integration runs:

```bash
PRIMARY_DB_URL=postgres://postgres:postgres@localhost:55432/saiyandb_primary
FAILOVER_DB_URLS=postgres://postgres:postgres@localhost:55433/saiyandb_failover1,postgres://postgres:postgres@localhost:55434/saiyandb_failover2
```

`FAILOVER_DB_URLS` is a comma-separated list; integration coverage currently expects at least two failover URLs.

## Local workflow

```bash
# Start three integration Postgres instances
npm run integration:up

# Run integration tests on your host using env vars
npm run test:integration

# Or run integration tests in the test-runner container
npm run test:integration:docker

# Tear down containers and volumes
npm run integration:down
```

You can copy defaults from `docker/integration/.env.example`.

## What the suite validates

- Primary query success against a healthy primary provider.
- Ordered failover sequence (`primary` -> `failover-1` -> `failover-2`) when earlier targets are unavailable.
- Error propagation when all providers fail.
- Primary cooldown behavior (`primary-cooldown-skip`) between consecutive queries.
- Failover-related log events:
  - `query-attempt`
  - `primary-failed`
  - `failover-failed`
  - `failover-success`
  - `primary-cooldown-skip`

## CI

CI uses the same Docker compose topology and containerized integration run:

- `npm run integration:up`
- `npm run test:integration:docker`
- `npm run integration:down`
