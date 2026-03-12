import { createDriverPool, resolveDatabaseType } from "../drivers";
import { checkProviderHealth } from "../health/healthChecker";
import { defaultLogger } from "../logger";
import type {
  CloudDBConfig,
  DBClient,
  DBConfig,
  DBLogger,
  DBRow,
  HealthSnapshot,
  ProviderHealth,
  QueryExecutionResult
} from "../types";

interface ProviderRuntime {
  config: CloudDBConfig;
  pool: DBClient;
  isPrimary: boolean;
}

export class ConnectionManager {
  private readonly logger: DBLogger;
  private readonly primary: ProviderRuntime;
  private readonly failovers: ProviderRuntime[];
  private readonly healthcheckTimeoutMs: number;
  private readonly primaryRetryCooldownMs: number;
  private primaryFailedAtMs?: number;

  constructor(private readonly config: DBConfig) {
    this.logger = config.logger ?? defaultLogger;
    this.healthcheckTimeoutMs = config.healthcheckTimeoutMs ?? 3000;
    this.primaryRetryCooldownMs = config.primaryRetryCooldownMs ?? 2000;

    this.primary = {
      config: config.primary,
      pool: createDriverPool(config.primary, {
        defaultDbType: config.defaultDbType,
        queryTimeoutMs: config.queryTimeoutMs
      }),
      isPrimary: true
    };
    this.failovers = (config.failovers ?? []).map((failover) => ({
      config: failover,
      pool: createDriverPool(failover, {
        defaultDbType: config.defaultDbType,
        queryTimeoutMs: config.queryTimeoutMs
      }),
      isPrimary: false
    }));

    this.validateProviderNames();
  }

  private validateProviderNames(): void {
    const names = [this.primary.config.name, ...this.failovers.map((f) => f.config.name)];
    const duplicates = names.filter((name, idx) => names.indexOf(name) !== idx);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate provider names are not allowed: ${duplicates.join(", ")}`);
    }
  }

  private createQueryId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private shouldSkipPrimaryByCooldown(): boolean {
    if (!this.primaryFailedAtMs) {
      return false;
    }
    return Date.now() - this.primaryFailedAtMs < this.primaryRetryCooldownMs;
  }

  private async executeOnProvider<T extends DBRow>(
    target: ProviderRuntime,
    sql: string,
    params: readonly unknown[],
    queryId: string,
    attempt: number
  ): Promise<QueryExecutionResult<T>> {
    const started = Date.now();
    this.logger.debug("Executing query", {
      event: "query-attempt",
      queryId,
      providerName: target.config.name,
      provider: target.config.provider,
      dbType: resolveDatabaseType(target.config, { defaultDbType: this.config.defaultDbType }),
      isPrimary: target.isPrimary,
      attempt
    });

    const result = await target.pool.query<T>(sql, params);
    return {
      result,
      meta: {
        event: "query-success",
        queryId,
        providerName: target.config.name,
        providerType: target.config.provider,
        isPrimary: target.isPrimary,
        attemptedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        attempt
      }
    };
  }

  public async query<T extends DBRow = DBRow>(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<QueryExecutionResult<T>> {
    const errors: string[] = [];
    const queryId = this.createQueryId();
    let attempt = 1;

    if (!this.shouldSkipPrimaryByCooldown()) {
      try {
        const response = await this.executeOnProvider<T>(
          this.primary,
          sql,
          params,
          queryId,
          attempt
        );
        this.primaryFailedAtMs = undefined;
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`primary(${this.primary.config.name}): ${message}`);
        this.primaryFailedAtMs = Date.now();
        this.logger.warn("Primary provider failed, attempting failovers", {
          event: "primary-failed",
          queryId,
          providerName: this.primary.config.name,
          provider: this.primary.config.provider,
          error: message
        });
      }
    } else {
      this.logger.warn("Skipping primary due to cooldown", {
        event: "primary-cooldown-skip",
        queryId,
        providerName: this.primary.config.name,
        cooldownMs: this.primaryRetryCooldownMs
      });
    }

    for (const failover of this.failovers) {
      attempt += 1;
      try {
        const response = await this.executeOnProvider<T>(failover, sql, params, queryId, attempt);
        this.logger.info("Failover provider succeeded", {
          event: "failover-success",
          queryId,
          providerName: failover.config.name,
          provider: failover.config.provider,
          attempt
        });
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`failover(${failover.config.name}): ${message}`);
        this.logger.warn("Failover provider failed", {
          event: "failover-failed",
          queryId,
          providerName: failover.config.name,
          provider: failover.config.provider,
          error: message,
          attempt
        });
      }
    }

    throw new Error(`All providers failed for query. Attempts: ${errors.join(" | ")}`);
  }

  public async checkPrimary(): Promise<ProviderHealth> {
    const status = await checkProviderHealth(this.primary, this.healthcheckTimeoutMs);
    this.logger.info("Primary healthcheck completed", {
      providerName: this.primary.config.name,
      provider: this.primary.config.provider,
      healthy: status.healthy,
      latencyMs: status.latencyMs
    });
    return status;
  }

  public async checkFailovers(): Promise<ProviderHealth[]> {
    const statuses = await Promise.all(
      this.failovers.map((target) => checkProviderHealth(target, this.healthcheckTimeoutMs))
    );
    for (const status of statuses) {
      this.logger.info("Failover healthcheck completed", {
        providerName: status.name,
        provider: status.provider,
        healthy: status.healthy,
        latencyMs: status.latencyMs
      });
    }
    return statuses;
  }

  public async checkAll(): Promise<HealthSnapshot> {
    const [primary, failovers] = await Promise.all([this.checkPrimary(), this.checkFailovers()]);
    return {
      primary,
      failovers,
      overallHealthy: primary.healthy || failovers.some((status) => status.healthy)
    };
  }

  public async close(): Promise<void> {
    const pools = [this.primary.pool, ...this.failovers.map((provider) => provider.pool)];
    await Promise.all(pools.map((pool) => pool.end()));
    this.logger.info("All provider pools closed");
  }
}
