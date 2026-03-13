import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitiveText, sanitizeMeta } from "../src/logger";

test("redactSensitiveText redacts credentials and token-like values", () => {
  const input =
    "postgres://admin:supersecret@db.internal/app?token=abc123 password=hunter2 secret:xyz";
  const output = redactSensitiveText(input);

  assert.match(output, /postgres:\/\/admin:\[REDACTED\]@db\.internal\/app/);
  assert.match(output, /token=\[REDACTED\]/);
  assert.match(output, /password=\[REDACTED\]/);
  assert.match(output, /secret:\s*\[REDACTED\]/);
  assert.doesNotMatch(output, /supersecret|abc123|hunter2|xyz/);
});

test("sanitizeMeta redacts blocked keys recursively and sanitizes text values", () => {
  const sanitized = sanitizeMeta({
    connectionString: "postgres://admin:supersecret@db.internal/app",
    nested: {
      tokenValue: "t-123",
      details: "password=hidden"
    },
    items: [{ secretKey: "abc" }, "postgres://u:p@localhost/db"]
  });

  assert.equal(sanitized?.connectionString, "[REDACTED]");
  assert.equal((sanitized?.nested as Record<string, unknown>).tokenValue, "[REDACTED]");
  assert.equal((sanitized?.nested as Record<string, unknown>).details, "password=[REDACTED]");
  assert.equal(
    ((sanitized?.items as unknown[])[0] as Record<string, unknown>).secretKey,
    "[REDACTED]"
  );
  assert.equal((sanitized?.items as unknown[])[1], "postgres://u:[REDACTED]@localhost/db");
});
