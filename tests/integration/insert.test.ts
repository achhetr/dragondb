import assert from "node:assert/strict";
import test from "node:test";
import { createDalFromYaml, integrationTableName, missingIntegrationEnv } from "./helpers";

const missingEnv = missingIntegrationEnv();

if (missingEnv.length > 0) {
  test("integration: insert action skipped", { skip: true }, () => {
    assert.ok(true);
  });
} else {
  test("integration: insert writes a row and returns it", async () => {
    const dal = await createDalFromYaml();
    const table = integrationTableName("insert");

    try {
      await dal.query(`CREATE TABLE ${table} (id SERIAL PRIMARY KEY, name TEXT NOT NULL)`);
      const inserted = await dal.insert<{ id: number; name: string }>(table, { name: "vegeta" });

      assert.ok(inserted);
      assert.equal(inserted?.name, "vegeta");
      assert.equal(typeof inserted?.id, "number");
    } finally {
      await dal.query(`DROP TABLE IF EXISTS ${table}`);
      await dal.close();
    }
  });
}
