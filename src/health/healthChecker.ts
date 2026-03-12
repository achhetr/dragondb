import type { CloudDBConfig, DBClient, ProviderHealth } from "../types";

interface HealthcheckTarget {
  config: CloudDBConfig;
  pool: DBClient;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Healthcheck timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function checkProviderHealth(
  target: HealthcheckTarget,
  timeoutMs: number
): Promise<ProviderHealth> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    await withTimeout(target.pool.query("SELECT 1"), timeoutMs);
    return {
      name: target.config.name,
      provider: target.config.provider,
      healthy: true,
      latencyMs: Date.now() - started,
      checkedAt
    };
  } catch (error) {
    return {
      name: target.config.name,
      provider: target.config.provider,
      healthy: false,
      latencyMs: Date.now() - started,
      checkedAt,
      lastError: error instanceof Error ? error.message : String(error)
    };
  }
}
