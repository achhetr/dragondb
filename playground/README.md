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

`start` brings up all Postgres containers and runs the basic example.

## Start multiple Postgres providers

```bash
npm run db:up
```

This starts:

- `primary-db` on `localhost:55432`
- `failover-1-db` on `localhost:55433`
- `failover-2-db` on `localhost:55434`

## Run examples

```bash
npm run example:basic
npm run example:yaml
npm run example:failover
```

## Test all states

```bash
# healthy primary path
npm run example:basic

# same config path via explicit yaml example
npm run example:yaml

# failover-focused output path
npm run example:failover
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

# run an example
npm run example:basic
```

## Simulate failover

In another terminal, stop primary and run the failover example:

```bash
docker stop primary-db
npm run example:failover
```

Then bring containers back up:

```bash
npm run db:up
```

## Cleanup

```bash
npm run db:down
```
