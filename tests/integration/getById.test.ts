import assert from "node:assert/strict";
import test from "node:test";
import { createDalFromYaml, integrationTableName, missingIntegrationEnv } from "./helpers";

const missingEnv = missingIntegrationEnv();

if (missingEnv.length > 0) {
  test("integration: getById action skipped", { skip: true }, () => {
    assert.ok(true);
  });
} else {
  test("integration: getById returns matching row and undefined for misses", async () => {
    const dal = await createDalFromYaml();
    const table = integrationTableName("getbyid");

    try {
      await dal.query(`CREATE TABLE ${table} (id SERIAL PRIMARY KEY, name TEXT NOT NULL)`);
      const seeded = await dal.query<{ id: number }>(
        `INSERT INTO ${table} (name) VALUES ($1) RETURNING id`,
        ["gohan"]
      );
      const id = seeded.result.rows[0]?.id as number;

      const found = await dal.getById<{ id: number; name: string }>(table, id);
      const missing = await dal.getById(table, id + 10_000);

      assert.equal(found?.id, id);
      assert.equal(found?.name, "gohan");
      assert.equal(missing, undefined);
    } finally {
      await dal.query(`DROP TABLE IF EXISTS ${table}`);
      await dal.close();
    }
  });
}
