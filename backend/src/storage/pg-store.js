const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const { Pool } = require('pg');

function nowIso() {
  return new Date().toISOString();
}

function checksumForRecords(records) {
  const payload = JSON.stringify(records);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function advisoryKey64(entity) {
  const hex = crypto.createHash('md5').update(String(entity)).digest('hex').slice(0, 16);
  const unsigned = BigInt(`0x${hex}`);
  const maxSigned = (1n << 63n) - 1n;
  const maxUnsigned = (1n << 64n) - 1n;
  const signed = unsigned > maxSigned ? (unsigned - (maxUnsigned + 1n)) : unsigned;
  return signed.toString();
}

class PgStore {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.maxBackupsPerEntity = Number(options.maxBackupsPerEntity || 20);
    this.databaseUrl = options.databaseUrl || process.env.DATABASE_URL;
    const sslEnabled = String(process.env.DATABASE_SSL || '').toLowerCase() === 'true'
      ? true
      : (String(process.env.DATABASE_SSL || '').toLowerCase() === 'false' ? false : (process.env.NODE_ENV === 'production'));
    const rejectUnauthorized = String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() === 'true';

    this.pool = options.pool || new Pool({
      connectionString: this.databaseUrl,
      ssl: sslEnabled ? { rejectUnauthorized } : false,
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_MS || 30000),
      connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONN_TIMEOUT_MS || 10000),
    });
    this.mode = 'postgres';
    this._als = new AsyncLocalStorage();
  }

  async init() {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1 as ok');
      await client.query(`
        CREATE TABLE IF NOT EXISTS entity_docs (
          entity TEXT PRIMARY KEY,
          doc JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS entity_backups (
          id BIGSERIAL PRIMARY KEY,
          entity TEXT NOT NULL,
          doc JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_entity_backups_entity_created ON entity_backups(entity, created_at DESC);`);
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }

  async withLock(entity, fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const key = advisoryKey64(entity);
      await client.query('SELECT pg_advisory_xact_lock($1::bigint) as locked', [key]);
      return await this._als.run(client, async () => {
        const out = await fn();
        await client.query('COMMIT');
        return out;
      });
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw e;
    } finally {
      client.release();
    }
  }

  _tx() {
    const client = this._als.getStore();
    if (!client) throw new Error('No active transaction client');
    return client;
  }

  async ensureEntity(entity) {
    return this.withLock(entity, async (client) => {
      const c = this._tx();
      const existing = await c.query('SELECT doc FROM entity_docs WHERE entity=$1', [entity]);
      if (existing.rowCount > 0) return;
      const initial = {
        meta: {
          entity,
          version: 1,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          checksum: checksumForRecords([]),
        },
        records: [],
      };
      await c.query(
        'INSERT INTO entity_docs(entity, doc, updated_at) VALUES ($1, $2::jsonb, NOW())',
        [entity, initial]
      );
    });
  }

  async ensureEntities(entities) {
    for (const entity of entities) {
      // eslint-disable-next-line no-await-in-loop
      await this.ensureEntity(entity);
    }
  }

  async _readEntityUnsafe(entity) {
    const c = this._tx();
    const r = await c.query('SELECT doc FROM entity_docs WHERE entity=$1', [entity]);
    if (r.rowCount === 0) {
      const initial = {
        meta: {
          entity,
          version: 1,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          checksum: checksumForRecords([]),
        },
        records: [],
      };
      await c.query('INSERT INTO entity_docs(entity, doc, updated_at) VALUES ($1, $2::jsonb, NOW())', [entity, initial]);
      return initial;
    }
    return r.rows[0].doc;
  }

  async _writeEntityUnsafe(entity, doc) {
    const c = this._tx();
    const nextDoc = {
      meta: {
        ...(doc.meta || {}),
        entity,
        updatedAt: nowIso(),
        checksum: checksumForRecords(doc.records || []),
      },
      records: doc.records || [],
    };

    await this.createBackupUnsafe(entity);
    await c.query(
      `
      INSERT INTO entity_docs(entity, doc, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (entity) DO UPDATE SET doc = EXCLUDED.doc, updated_at = NOW()
      `,
      [entity, nextDoc]
    );
    return nextDoc;
  }

  async createBackupUnsafe(entity) {
    const c = this._tx();
    const doc = await this._readEntityUnsafe(entity);
    await c.query('INSERT INTO entity_backups(entity, doc, created_at) VALUES ($1, $2::jsonb, NOW())', [entity, doc]);
    const keep = this.maxBackupsPerEntity;
    if (keep > 0) {
      await c.query(
        `
        DELETE FROM entity_backups
        WHERE id IN (
          SELECT id FROM entity_backups
          WHERE entity=$1
          ORDER BY created_at DESC
          OFFSET $2
        )
        `,
        [entity, keep]
      );
    }
  }

  async replaceAll(entity, records) {
    return this.withLock(entity, async (client) => {
      const doc = await this._readEntityUnsafe(entity);
      doc.records = Array.isArray(records) ? records : [];
      await this._writeEntityUnsafe(entity, doc);
      return doc.records;
    });
  }

  async readAll(entity) {
    return this.withLock(entity, async (client) => {
      const doc = await this._readEntityUnsafe(entity);
      return doc.records || [];
    });
  }

  async readById(entity, id) {
    return this.withLock(entity, async (client) => {
      const doc = await this._readEntityUnsafe(entity);
      return (doc.records || []).find((r) => String(r.id) === String(id)) || null;
    });
  }

  async create(entity, record) {
    return this.withLock(entity, async (client) => {
      const doc = await this._readEntityUnsafe(entity);
      doc.records = doc.records || [];
      doc.records.push(record);
      await this._writeEntityUnsafe(entity, doc);
      return record;
    });
  }

  async updateById(entity, id, updater) {
    return this.withLock(entity, async (client) => {
      const doc = await this._readEntityUnsafe(entity);
      doc.records = doc.records || [];
      const idx = doc.records.findIndex((r) => String(r.id) === String(id));
      if (idx < 0) return null;
      const next = updater(doc.records[idx]);
      doc.records[idx] = next;
      await this._writeEntityUnsafe(entity, doc);
      return next;
    });
  }

  async deleteById(entity, id) {
    return this.withLock(entity, async (client) => {
      const doc = await this._readEntityUnsafe(entity);
      doc.records = doc.records || [];
      const idx = doc.records.findIndex((r) => String(r.id) === String(id));
      if (idx < 0) return false;
      doc.records.splice(idx, 1);
      await this._writeEntityUnsafe(entity, doc);
      return true;
    });
  }

  async upsert(entity, predicate, nextRecordFactory) {
    return this.withLock(entity, async (client) => {
      const doc = await this._readEntityUnsafe(entity);
      doc.records = doc.records || [];
      const idx = doc.records.findIndex(predicate);
      const next = nextRecordFactory(idx >= 0 ? doc.records[idx] : null);
      if (idx >= 0) doc.records[idx] = next;
      else doc.records.push(next);
      await this._writeEntityUnsafe(entity, doc);
      return next;
    });
  }

  async query(entity, options = {}) {
    const {
      filter = null,
      sortBy = null,
      sortDir = 'asc',
      offset = 0,
      limit = null,
    } = options;

    return this.withLock(entity, async (client) => {
      const doc = await this._readEntityUnsafe(entity);
      let out = [...(doc.records || [])];
      if (typeof filter === 'function') out = out.filter(filter);
      if (sortBy) {
        out.sort((a, b) => {
          const av = a?.[sortBy];
          const bv = b?.[sortBy];
          if (av === bv) return 0;
          const cmp = av > bv ? 1 : -1;
          return sortDir === 'desc' ? -cmp : cmp;
        });
      }
      const safeOffset = Math.max(0, Number(offset || 0));
      const offsetSlice = out.slice(safeOffset);
      if (limit === null || limit === undefined) return offsetSlice;
      const safeLimit = Math.max(0, Number(limit));
      return offsetSlice.slice(0, safeLimit);
    });
  }

  async backupAll(entities) {
    const backups = {};
    for (const entity of entities) {
      backups[entity] = await this.withLock(entity, async (client) => {
        await this.createBackupUnsafe(entity);
        return true;
      });
    }
    return backups;
  }

  async recoverLatest(entity) {
    return this.withLock(entity, async (client) => {
      const c = this._tx();
      const r = await c.query(
        'SELECT doc FROM entity_backups WHERE entity=$1 ORDER BY created_at DESC LIMIT 1',
        [entity]
      );
      if (r.rowCount === 0) return false;
      const doc = r.rows[0].doc;
      await c.query(
        `
        INSERT INTO entity_docs(entity, doc, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (entity) DO UPDATE SET doc = EXCLUDED.doc, updated_at = NOW()
        `,
        [entity, doc]
      );
      return true;
    });
  }
}

module.exports = {
  PgStore,
};
