# Quickstart

## Install

```bash
npm install saiyandb
```

## Minimal usage

```ts
import { createDALFromYaml } from "saiyandb";

const dal = await createDALFromYaml("./config/db.config.yaml", {
  envFilePath: ".env"
});
const rows = await dal.query("SELECT 1 as up");
console.log(rows.result.rows);
await dal.close();
```

## Integration tests with Docker

Use the Docker failover integration stack to validate real provider fallback and log events:

```bash
npm run integration:up
npm run test:integration:docker
npm run integration:down
```

For host-based integration runs, set `PRIMARY_DB_URL` and comma-separated `FAILOVER_DB_URLS`. See `docs/integration-testing.md` for full details.
