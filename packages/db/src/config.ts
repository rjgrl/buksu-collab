export type DatabaseConfig = {
  // TODO(PLAKY-PLATFORM): PLAKY-DB-003 - varlock generates this shape from packages/db/.env.schema.
  // Keep in sync when the DATABASE_* contract changes.
  DATABASE_URL: string;
};