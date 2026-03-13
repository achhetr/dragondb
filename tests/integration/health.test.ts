import assert from "node:assert/strict";
import test from "node:test";
import { createDalFromYaml, missingIntegrationEnv } from "./helpers";

const missingEnv = missingIntegrationEnv();

if (missingEnv.length > 0) {
  test("integration: health action skipped", { skip: true }, () => {
    assert.ok(true);
  });
} else {
  test("integration: health reports primary and failovers", async () => {
    const dal = await createDalFromYaml();

    try {
      const snapshot = await dal.health();
      assert.equal(snapshot.primary.name, "primary-real");
      assert.equal(snapshot.primary.healthy, true);
      assert.equal(snapshot.failovers.length, 2);
      assert.equal(snapshot.overallHealthy, true);
    } finally {
      await dal.close();
    }
  });
}
