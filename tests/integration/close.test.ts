import assert from "node:assert/strict";
import test from "node:test";
import { createDalFromYaml, missingIntegrationEnv } from "./helpers";

const missingEnv = missingIntegrationEnv();

if (missingEnv.length > 0) {
  test("integration: close action skipped", { skip: true }, () => {
    assert.ok(true);
  });
} else {
  test("integration: close shuts down connections and blocks further queries", async () => {
    const dal = await createDalFromYaml();

    const first = await dal.query("SELECT 1 as up");
    assert.equal(first.result.rows[0]?.up, 1);

    await dal.close();

    await assert.rejects(
      () => dal.query("SELECT 1 as up"),
      /All providers failed.*Cannot use a pool after calling end on the pool|Client was closed and is not queryable|Connection terminated unexpectedly|Connection terminated/
    );
  });
}
