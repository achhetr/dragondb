import assert from "node:assert/strict";
import test from "node:test";
import { createDalFromYaml, missingIntegrationEnv } from "./helpers";

const missingEnv = missingIntegrationEnv();

if (missingEnv.length > 0) {
  test("integration: query action skipped", { skip: true }, () => {
    assert.ok(true);
  });
} else {
  test("integration: query succeeds against real primary", async () => {
    const dal = await createDalFromYaml();
    const response = await dal.query("SELECT 1 as up");
    assert.equal(response.result.rows[0]?.up, 1);
    assert.equal(response.meta.providerName, "primary-real");
    assert.equal(response.meta.isPrimary, true);
    await dal.close();
  });
}
