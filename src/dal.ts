import { ConnectionManager } from "./connection/connectionManager";
import type { DBConfig, DBRow, HealthSnapshot, QueryExecutionResult } from "./types";

const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertIdentifier(identifier: string, field: string): void {
  if (!IDENTIFIER_REGEX.test(identifier)) {
    throw new Error(`Invalid ${field} identifier: ${identifier}`);
  }
}

function assertColumns(columns: string[]): void {
  for (const column of columns) {
    assertIdentifier(column, "column");
  }
}

export interface DAL {
  query<T extends DBRow = DBRow>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<QueryExecutionResult<T>>;
  getById<T extends DBRow = DBRow>(table: string, id: string | number): Promise<T | undefined>;
  insert<T extends DBRow = DBRow>(
    table: string,
    data: Record<string, unknown>
  ): Promise<T | undefined>;
  health(): Promise<HealthSnapshot>;
  close(): Promise<void>;
}

export function createDAL(config: DBConfig): DAL {
  const manager = new ConnectionManager(config);

  return {
    async query<T extends DBRow = DBRow>(
      sql: string,
      params: readonly unknown[] = []
    ): Promise<QueryExecutionResult<T>> {
      return manager.query<T>(sql, params);
    },

    async getById<T extends DBRow = DBRow>(
      table: string,
      id: string | number
    ): Promise<T | undefined> {
      assertIdentifier(table, "table");
      const sql = `SELECT * FROM ${table} WHERE id = $1 LIMIT 1`;
      const response = await manager.query<T>(sql, [id]);
      return response.result.rows[0];
    },

    async insert<T extends DBRow = DBRow>(
      table: string,
      data: Record<string, unknown>
    ): Promise<T | undefined> {
      assertIdentifier(table, "table");

      const keys = Object.keys(data);
      if (keys.length === 0) {
        throw new Error("Insert payload must include at least one field");
      }
      assertColumns(keys);

      const values = Object.values(data);
      const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(", ");
      const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING *`;
      const response = await manager.query<T>(sql, values);
      return response.result.rows[0];
    },

    async health(): Promise<HealthSnapshot> {
      return manager.checkAll();
    },

    async close(): Promise<void> {
      await manager.close();
    }
  };
}
