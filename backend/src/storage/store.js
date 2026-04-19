const path = require('path');
const { JsonStore } = require('./json-store');
const { PgStore } = require('./pg-store');

function shouldUsePostgres() {
  const mode = String(process.env.DB_MODE || '').toLowerCase();
  if (mode === 'postgres' || mode === 'pg') return true;
  if (mode === 'json' || mode === 'json-files') return false;
  if (process.env.DATABASE_URL && process.env.NODE_ENV === 'production') return true;
  return false;
}

function createStore({ logger } = {}) {
  const mode = String(process.env.DB_MODE || '').toLowerCase();
  const allowJsonInProd = String(process.env.ALLOW_JSON_IN_PROD || '').toLowerCase() === 'true';
  if (process.env.NODE_ENV === 'production') {
    if (mode === 'json' || mode === 'json-files') {
      if (!allowJsonInProd) {
        throw new Error('Refusing to start with JSON storage in production. Set DB_MODE=postgres and DATABASE_URL.');
      }
    } else if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set in production (Render Postgres).');
    }
  }

  if (shouldUsePostgres()) {
    return new PgStore({
      logger,
      maxBackupsPerEntity: Number(process.env.PG_BACKUP_KEEP || 20),
    });
  }
  const dataDir = process.env.JSON_STORAGE_DIR
    ? path.resolve(process.env.JSON_STORAGE_DIR)
    : path.join(__dirname, '..', '..', 'data');

  return new JsonStore({
    rootDir: dataDir,
    logger,
    maxBackupsPerEntity: Number(process.env.JSON_BACKUP_KEEP || 20),
  });
}

module.exports = {
  createStore,
  shouldUsePostgres,
};
