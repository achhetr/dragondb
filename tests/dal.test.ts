import assert from "node:assert/strict";
import test from "node:test";
import { createDALFromConnectionManager } from "../src/dal";
import type { DALManager } from "../src/dal";
import type { DBRow } from "../src/types";

function makeManager(queryImpl: DALManager["query"]): DALManager {
  return {
    query: queryImpl,
    checkAll: async () => ({
      primary: {
        name: "primary",
        provider: "aws",
        healthy: true,
        latencyMs: 1,
        checkedAt: new Date().toISOString()
      },
      failovers: [],
      overallHealthy: true
    }),
    close: async () => undefined
  };
}

test("getById rejects invalid table identifiers", async () => {
  const dal = createDALFromConnectionManager(
    makeManager(async () => ({ result: { rows: [] }, meta: {} as never }))
  );

  await assert.rejects(() => dal.getById("users; DROP TABLE users", 1), /Invalid table identifier/);
});

test("insert rejects invalid column identifiers", async () => {
  const dal = createDALFromConnectionManager(
    makeManager(async () => ({ result: { rows: [] }, meta: {} as never }))
  );

  await assert.rejects(
    () =>
      dal.insert("users", {
        "email);DROP TABLE users;--": "foo@example.com"
      }),
    /Invalid column identifier/
  );
});

test("insert builds parameterized sql with placeholders", async () => {
  let capturedSql = "";
  let capturedParams: readonly unknown[] = [];
  const dal = createDALFromConnectionManager(
    makeManager(async <T extends DBRow>(sql: string, params: readonly unknown[] = []) => {
      capturedSql = sql;
      capturedParams = params;
      return {
        result: { rows: [{ id: 1 } as T] },
        meta: {} as never
      };
    })
  );

  await dal.insert("users", {
    name: "Goku",
    age: 21
  });

  assert.equal(capturedSql, "INSERT INTO users (name, age) VALUES ($1, $2) RETURNING *");
  assert.deepEqual(capturedParams, ["Goku", 21]);
});
