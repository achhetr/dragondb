# Playground

This is a standalone playground that installs the latest published `@akashbro/saiyandb` package and runs against multiple Postgres providers.

## Prerequisites

- Docker + Docker Compose
- Node.js `>=22`

## Setup

```bash
cd playground
npm run init
```

`init` installs dependencies and creates `.env` from `.env.example` if missing.

## Quick run

From the `playground` directory:

```bash
npm run start
npm run db:down
```

`start` brings up all Postgres containers and runs a single playground test file (`run.ts`) that:

- checks health of primary and failovers
- executes a query
- prints provider selection and result logs

## Start multiple Postgres providers

```bash
npm run db:up
```

This starts:

- `primary-db` on `localhost:55432`
- `failover-1-db` on `localhost:55433`
- `failover-2-db` on `localhost:55434`

## Run playground test

```bash
npm run test
```

## Simulate failover

Use service names from Docker Compose:

```bash
docker compose -f docker-compose.yml stop primary-db
npm run test
docker compose -f docker-compose.yml start primary-db
```

## Test local library changes

Playground installs `@akashbro/saiyandb` from npm by default. To test local, unpublished changes:

```bash
# from repo root: build and create tarball
npm run build
npm pack

# install the tarball into playground
cd playground
npm install ../akashbro-saiyandb-$(node -p "require('../package.json').version").tgz

# run playground test
npm run test
```

## Cleanup

```bash
npm run db:down
```
