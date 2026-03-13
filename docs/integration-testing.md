# Integration Testing

Integration tests validate real PostgreSQL failover behavior using isolated databases.

## What this suite verifies

- Query success on healthy primary provider.
- Ordered failover path when upstream providers are down.
- Combined error reporting when all providers fail.
- Primary retry cooldown behavior (`primary-cooldown-skip`).
- Failover logging events (`query-attempt`, `primary-failed`, `failover-failed`, `failover-success`).

## Prerequisites

- Docker and Docker Compose
- Node.js `>=22`
- npm `>=10`

## Environment variables

For host-based integration tests:

```bash
PRIMARY_DB_URL=postgres://postgres:postgres@localhost:56432/saiyandb_primary
FAILOVER_DB_URLS=postgres://postgres:postgres@localhost:56433/saiyandb_failover1,postgres://postgres:postgres@localhost:56434/saiyandb_failover2
```

These credentials are local test defaults only.

`FAILOVER_DB_URLS` must include at least two URLs for full integration coverage.
Failover providers consume this list in YAML failover order.

## Local workflow

```bash
# optional baseline check (no Docker required)
npm run verify

# 1) Start primary + failover databases
npm run integration:up

# 2) Run on host
npm run test:integration

# 3) (Alternative) run tests in Docker test-runner container
npm run test:integration:docker

# 4) Tear down containers and volumes
npm run integration:down
```

Copy default integration values from `docker/integration/.env.example` when needed.

Integration Docker ports (`56432-56434`) are intentionally separate from playground ports
(`55432-55434`) so both stacks can run at the same time.
If you customize ports and hit bind errors, stop playground containers first:
`cd playground && npm run db:down`.

## Important fixtures

- Topology fixture: `tests/integration/fixtures/integration.db.config.yaml`
- No-failover fixture: `tests/integration/fixtures/integration.db.no-failover.config.yaml`
- Test file: `tests/integration/pg.test.ts`

The tests intentionally use unreachable addresses for some scenarios to simulate provider failure and force failover path validation.

## Security incident triage

When debugging failures in production-like environments:

- Correlate events by `queryId` across `query-attempt`, `primary-failed`, `failover-failed`, and `failover-success`.
- Capture provider name, attempt number, and timing metadata first.
- Do not log or paste full connection strings, passwords, or tokens into incident channels.
- Rotate credentials and revoke exposed secrets immediately if any leak is suspected.

## CI behavior

CI runs the same Docker topology and containerized integration tests:

- `npm run integration:up`
- `npm run test:integration:docker`
- `npm run integration:down`
