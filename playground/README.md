# Playground

This is a standalone playground that installs the latest published `@akashbro/saiyandb` package and runs against multiple Postgres providers.

## Prerequisites

- Docker + Docker Compose
- Node.js `>=22`

## Setup

```bash
npm --prefix playground install
cp playground/.env.example playground/.env
```

## One command run

From repo root:

```bash
npm run playground:start
npm run playground:clean
```

This command installs playground dependencies, creates `.env` from `.env.example` if needed, starts all Postgres containers, and runs the basic example.

## Start multiple Postgres providers

```bash
npm --prefix playground run db:up
```

This starts:

- `primary-db` on `localhost:55432`
- `failover-1-db` on `localhost:55433`
- `failover-2-db` on `localhost:55434`

## Run examples

```bash
npm --prefix playground run example:basic
npm --prefix playground run example:yaml
npm --prefix playground run example:failover
```

## Test all states (root command style)

```bash
# healthy primary path
npm --prefix playground run example:basic

# same config path via explicit yaml example
npm --prefix playground run example:yaml

# failover-focused output path
npm --prefix playground run example:failover
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
npm --prefix playground run example:failover
```

Then bring containers back up:

```bash
npm --prefix playground run db:up
```

## Cleanup

```bash
npm --prefix playground run db:down
```
