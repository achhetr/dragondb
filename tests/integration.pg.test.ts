import assert from "node:assert/strict";
import test from "node:test";
import { createDAL, type DBConfig } from "../src";

const primaryUrl = process.env.PG_TEST_URL_PRIMARY;
const failoverUrl = process.env.PG_TEST_URL_FAILOVER;

if (!primaryUrl || !failoverUrl) {
  test("integration pg tests skipped", { skip: true }, () => {
    assert.ok(true);
  });
} else {
  test("integration: query and failover operate against real pg", async () => {
    const config: DBConfig = {
      defaultDbType: "pg",
      primaryRetryCooldownMs: 5_000,
      primary: {
        name: "primary-real",
        provider: "aws",
        connectionString: primaryUrl
      },
      failovers: [
        {
          name: "failover-real",
          provider: "gcp",
          connectionString: failoverUrl
        }
      ]
    };

    const dal = createDAL(config);
    try {
      const response = await dal.query("SELECT 1 as up");
      assert.equal(response.result.rows[0]?.up, 1);

      // Force primary failure by swapping to bad URL and relying on failover.
      const failoverConfig: DBConfig = {
        ...config,
        primary: {
          ...config.primary,
          connectionString: "postgres://bad:bad@127.0.0.2:5432/bad"
        }
      };
      const failoverDal = createDAL(failoverConfig);
      const failoverResponse = await failoverDal.query("SELECT 1 as up");
      assert.equal(failoverResponse.meta.providerName, "failover-real");
      await failoverDal.close();
    } finally {
      await dal.close();
    }
  });
}
