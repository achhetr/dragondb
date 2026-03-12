# Quickstart

## Install

```bash
npm install saiyandb
```

## Minimal usage

```ts
import { createDAL, loadDBConfigFromYaml } from "saiyandb";

const config = await loadDBConfigFromYaml("./config/db.config.yaml", {
  envFilePath: ".env"
});

const dal = createDAL(config);
const rows = await dal.query("SELECT 1 as up");
console.log(rows.result.rows);
await dal.close();
```
