# Driver Extension

The library currently ships with `pg` built in.

To add another database engine:

1. Implement a driver factory returning a `DBClient` (`query` + `end`).
2. Register the factory with `registerDriver("your-db-type", factory)`.
3. Set `defaultDbType` or per-provider `dbType` in your config.

```ts
import { registerDriver, type DBClient } from "saiyandb";

registerDriver("custom-db", (cfg): DBClient => {
  // construct your driver client here
  throw new Error(`Not implemented for ${cfg.name}`);
});
```
