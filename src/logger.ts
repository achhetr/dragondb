import type { DBLogger } from "./types";

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) {
    return undefined;
  }

  const blockedKeys = ["password", "connectionString", "connString", "secret", "token"];
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const lowered = key.toLowerCase();
    sanitized[key] = blockedKeys.some((blocked) => lowered.includes(blocked)) ? "[REDACTED]" : value;
  }
  return sanitized;
}

function print(level: "debug" | "info" | "warn" | "error", message: string, meta?: Record<string, unknown>): void {
  const payload = sanitizeMeta(meta);
  if (level === "error") {
    console.error(`[saiyandb] ${message}`, payload ?? "");
    return;
  }
  if (level === "warn") {
    console.warn(`[saiyandb] ${message}`, payload ?? "");
    return;
  }
  console.log(`[saiyandb] ${message}`, payload ?? "");
}

export const defaultLogger: DBLogger = {
  debug(message, meta) {
    print("debug", message, meta);
  },
  info(message, meta) {
    print("info", message, meta);
  },
  warn(message, meta) {
    print("warn", message, meta);
  },
  error(message, meta) {
    print("error", message, meta);
  }
};
