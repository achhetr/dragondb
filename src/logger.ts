import type { DBLogger } from "./types";

const BLOCKED_KEYS = ["password", "connectionString", "connString", "secret", "token"];

function isBlockedKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return BLOCKED_KEYS.some((blocked) => lowered.includes(blocked.toLowerCase()));
}

export function redactSensitiveText(input: string): string {
  return input
    .replace(/([a-z]+:\/\/[^:/\s]+:)([^@\s]+)(@)/gi, "$1[REDACTED]$3")
    .replace(/([?&](?:password|token|secret)=)([^&\s]+)/gi, "$1[REDACTED]")
    .replace(/((?:password|token|secret)\s*=\s*)([^,\s;]+)/gi, "$1[REDACTED]")
    .replace(/((?:password|token|secret)\s*:\s*)([^,\s;}]+)/gi, "$1[REDACTED]");
}

export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const redactedMessage = redactSensitiveText(error.message ?? "").trim();
    if (redactedMessage.length > 0) {
      return redactedMessage;
    }

    const errorWithCode = error as Error & { code?: unknown };
    if (typeof errorWithCode.code === "string" && errorWithCode.code.trim().length > 0) {
      return `${error.name || "Error"} (${errorWithCode.code.trim()})`;
    }
    if (error.name && error.name.trim().length > 0) {
      return error.name.trim();
    }
    return "Unknown error";
  }

  const serialized = redactSensitiveText(String(error ?? "")).trim();
  return serialized.length > 0 ? serialized : "Unknown error";
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }
  if (typeof value === "object" && value !== null) {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    const sanitizedObject: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      sanitizedObject[key] = isBlockedKey(key) ? "[REDACTED]" : sanitizeValue(nestedValue, seen);
    }
    return sanitizedObject;
  }
  return value;
}

export function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) {
    return undefined;
  }

  const seen = new WeakSet<object>();
  return sanitizeValue(meta, seen) as Record<string, unknown>;
}

function print(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
): void {
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
