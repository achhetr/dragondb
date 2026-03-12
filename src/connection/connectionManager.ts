import type { Pool, QueryResult, QueryResultRow } from "pg";
import { createDriverPool, resolveDatabaseType } from "../drivers";
import { checkProviderHealth } from "../health/healthChecker";
import { defaultLogger } from "../logger";
import type { CloudDBConfig, DBConfig, DBLogger, HealthSnapshot, ProviderHealth, QueryExecutionResult } from "../types";

interface ProviderRuntime {
  config: CloudDBConfig;
  pool: Pool;
  isPrimary: boolean;
}

export class ConnectionManager {
  private readonly logger: DBLogger;
  private readonly primary: ProviderRuntime;
  private readonly failovers: ProviderRuntime[];
  private readonly healthcheckTimeoutMs: number;

  constructor(private readonly config: DBConfig) {
    this.logger = config.logger ?? defaultLogger;
    this.healthcheckTimeoutMs = config.healthcheckTimeoutMs ?? 3000;

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

  private async executeOnProvider<T extends QueryResultRow>(
    target: ProviderRuntime,
    sql: string,
    params: readonly unknown[]
  ): Promise<QueryExecutionResult<T>> {
    this.logger.debug("Executing query", {
      providerName: target.config.name,
      provider: target.config.provider,
      dbType: resolveDatabaseType(target.config, { defaultDbType: this.config.defaultDbType }),
      isPrimary: target.isPrimary
    });

    const result = (await target.pool.query(sql, params as unknown[])) as QueryResult<T>;
    return {
      result,
      meta: {
        providerName: target.config.name,
        providerType: target.config.provider,
        isPrimary: target.isPrimary,
        attemptedAt: new Date().toISOString()
      }
    };
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<QueryExecutionResult<T>> {
    const errors: string[] = [];

    try {
      return await this.executeOnProvider<T>(this.primary, sql, params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`primary(${this.primary.config.name}): ${message}`);
      this.logger.warn("Primary provider failed, attempting failovers", {
        providerName: this.primary.config.name,
        provider: this.primary.config.provider,
        error: message
      });
    }

    for (const failover of this.failovers) {
      try {
        const response = await this.executeOnProvider<T>(failover, sql, params);
        this.logger.info("Failover provider succeeded", {
          providerName: failover.config.name,
          provider: failover.config.provider
        });
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`failover(${failover.config.name}): ${message}`);
        this.logger.warn("Failover provider failed", {
          providerName: failover.config.name,
          provider: failover.config.provider,
          error: message
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
