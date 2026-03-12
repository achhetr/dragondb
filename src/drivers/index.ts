import type { Pool } from "pg";
import { createPostgresPool } from "../providers/postgresProvider";
import type { CloudDBConfig, DatabaseType } from "../types";

interface DriverPoolFactoryOptions {
  defaultDbType?: DatabaseType;
  queryTimeoutMs?: number;
}

export type DriverFactory = (cfg: CloudDBConfig, options: DriverPoolFactoryOptions) => Pool;

const driverRegistry = new Map<DatabaseType, DriverFactory>();

export function registerDriver(
  dbType: DatabaseType,
  factory: DriverFactory,
  options: { overwrite?: boolean } = {}
): void {
  if (!options.overwrite && driverRegistry.has(dbType)) {
    throw new Error(
      `Driver for database type '${dbType}' already exists. Pass { overwrite: true } to replace it.`
    );
  }
  driverRegistry.set(dbType, factory);
}

export function listRegisteredDrivers(): DatabaseType[] {
  return Array.from(driverRegistry.keys());
}

function getDriver(dbType: DatabaseType): DriverFactory {
  const factory = driverRegistry.get(dbType);
  if (!factory) {
    const registered = listRegisteredDrivers();
    const supported = registered.length > 0 ? registered.join(", ") : "none";
    throw new Error(`Unsupported database type '${dbType}'. Registered drivers: ${supported}`);
  }
  return factory;
}

export function resolveDatabaseType(
  cfg: CloudDBConfig,
  options: DriverPoolFactoryOptions
): DatabaseType {
  return cfg.dbType ?? options.defaultDbType ?? "postgres";
}

export function createDriverPool(
  cfg: CloudDBConfig,
  options: DriverPoolFactoryOptions = {}
): Pool {
  const dbType = resolveDatabaseType(cfg, options);
  const createPool = getDriver(dbType);
  return createPool(cfg, options);
}

// Built-in Postgres driver registration for MVP.
registerDriver("postgres", (cfg, options) => createPostgresPool(cfg, options.queryTimeoutMs));
