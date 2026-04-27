const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lockWaitMs() {
  const raw = process.env.JSON_READ_LOCK_WAIT_MS;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return 1500;
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function checksumForRecords(records) {
  const payload = JSON.stringify(records);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

class JsonStore {
  constructor(options = {}) {
    this.rootDir = options.rootDir || path.join(__dirname, '..', '..', 'data');
    this.backupDir = path.join(this.rootDir, '_backups');
    this.lockDir = path.join(this.rootDir, '_locks');
    this.logger = options.logger || console;
    this._queues = new Map();
    this.maxBackupsPerEntity = Number(options.maxBackupsPerEntity || 20);
    this.lockStaleMs = Number(options.lockStaleMs || process.env.JSON_LOCK_STALE_MS || 60000);
    ensureDirSync(this.rootDir);
    ensureDirSync(this.backupDir);
    ensureDirSync(this.lockDir);
  }

  entityFile(entity) {
    return path.join(this.rootDir, `${entity}.json`);
  }

  lockFile(entity) {
    return path.join(this.lockDir, `${entity}.lock`);
  }

  async ensureEntity(entity) {
    const file = this.entityFile(entity);
    if (fs.existsSync(file)) return;
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
    await this._atomicWrite(file, initial);
  }

  async ensureEntities(entities) {
    for (const entity of entities) {
      await this.ensureEntity(entity);
    }
  }

  async _acquireLock(entity, timeoutMs = 10000, retryMs = 25) {
    const lockPath = this.lockFile(entity);
    const start = Date.now();
    let fd;
    while (!fd) {
      try {
        fd = await fs.promises.open(lockPath, 'wx');
        try {
          await fd.writeFile(JSON.stringify({ pid: process.pid, createdAt: nowIso() }), 'utf8');
        } catch {}
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
        try {
          const raw = await fs.promises.readFile(lockPath, 'utf8');
          const meta = JSON.parse(raw);
          const createdAtMs = meta?.createdAt ? Date.parse(meta.createdAt) : NaN;
          const ageOk = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : this.lockStaleMs + 1;
          const pid = Number(meta?.pid);
          const pidAlive = Number.isFinite(pid) ? (() => {
            try {
              process.kill(pid, 0);
              return true;
            } catch {
              return false;
            }
          })() : false;

          if (ageOk > this.lockStaleMs || !pidAlive) {
            await fs.promises.unlink(lockPath);
            continue;
          }
        } catch {
          try {
            await fs.promises.unlink(lockPath);
            continue;
          } catch {}
        }
        if (Date.now() - start > timeoutMs) {
          throw new Error(`Lock timeout for entity "${entity}"`);
        }
        await sleep(retryMs);
      }
    }
    return fd;
  }

  async _releaseLock(entity, fd) {
    const lockPath = this.lockFile(entity);
    try {
      await fd.close();
    } finally {
      try {
        await fs.promises.unlink(lockPath);
      } catch {
        // No-op: lock file already removed.
      }
    }
  }

  async withLock(entity, fn) {
    const previous = this._queues.get(entity) || Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        await this.ensureEntity(entity);
        const fd = await this._acquireLock(entity);
        try {
          return await fn();
        } finally {
          await this._releaseLock(entity, fd);
        }
      });

    this._queues.set(
      entity,
      run.finally(() => {
        if (this._queues.get(entity) === run) {
          this._queues.delete(entity);
        }
      })
    );
    return run;
  }

  async _atomicWrite(filePath, payload) {
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tempPath, filePath);
  }

  async _readEntityUnsafe(entity) {
    const file = this.entityFile(entity);
    const raw = await fs.promises.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.records)) {
      throw new Error(`Corrupted JSON structure in ${file}`);
    }
    const expected = checksumForRecords(parsed.records);
    if (parsed.meta?.checksum && parsed.meta.checksum !== expected) {
      throw new Error(`Checksum mismatch detected in ${file}`);
    }
    return parsed;
  }

  async _recoverLatestUnsafe(entity) {
    const entityBackupDir = path.join(this.backupDir, entity);
    if (!fs.existsSync(entityBackupDir)) return false;
    const backups = (await fs.promises.readdir(entityBackupDir))
      .filter((f) => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));
    if (backups.length === 0) return false;
    const latest = path.join(entityBackupDir, backups[0]);
    const file = this.entityFile(entity);
    await fs.promises.copyFile(latest, file);
    this.logger.warn(`Recovered entity "${entity}" from backup ${backups[0]}`);
    return true;
  }

  async _readEntityWithRecoveryUnsafe(entity) {
    try {
      return await this._readEntityUnsafe(entity);
    } catch (error) {
      try {
        this.logger.error(`Failed to read entity "${entity}": ${error?.message || error}`);
      } catch {}
      const recovered = await this._recoverLatestUnsafe(entity);
      if (!recovered) throw error;
      return this._readEntityUnsafe(entity);
    }
  }

  async _writeEntityUnsafe(entity, doc, { backup = true } = {}) {
    const file = this.entityFile(entity);
    doc.meta = {
      ...(doc.meta || {}),
      entity,
      version: Number(doc.meta?.version || 1),
      updatedAt: nowIso(),
      checksum: checksumForRecords(doc.records || []),
    };
    if (backup && fs.existsSync(file)) {
      await this.createBackup(entity);
    }
    await this._atomicWrite(file, doc);
  }

  async _readEntityBestEffortNoLock(entity) {
    await this.ensureEntity(entity);
    const doc = await this._readEntityWithRecoveryUnsafe(entity);
    return doc;
  }

  async readAll(entity) {
    const waitMs = lockWaitMs();
    const locked = this.withLock(entity, async () => {
        const doc = await this._readEntityWithRecoveryUnsafe(entity);
        return doc.records;
      });

    const timed = Promise.race([
      locked,
      sleep(waitMs).then(() => ({ __lockWaitTimedOut: true })),
    ]);

    const out = await timed;
    if (out && out.__lockWaitTimedOut) {
      locked.catch(() => undefined);
      const doc = await this._readEntityBestEffortNoLock(entity);
      return doc.records;
    }
    return out;
  }

  async readById(entity, id) {
    const waitMs = lockWaitMs();
    const locked = this.withLock(entity, async () => {
        const doc = await this._readEntityWithRecoveryUnsafe(entity);
        return doc.records.find((r) => String(r.id) === String(id)) || null;
      });

    const timed = Promise.race([
      locked,
      sleep(waitMs).then(() => ({ __lockWaitTimedOut: true })),
    ]);

    const out = await timed;
    if (out && out.__lockWaitTimedOut) {
      locked.catch(() => undefined);
      const doc = await this._readEntityBestEffortNoLock(entity);
      return doc.records.find((r) => String(r.id) === String(id)) || null;
    }
    return out;
  }

  async create(entity, record) {
    return this.withLock(entity, async () => {
      const doc = await this._readEntityWithRecoveryUnsafe(entity);
      doc.records.push(record);
      await this._writeEntityUnsafe(entity, doc);
      return record;
    });
  }

  async upsert(entity, predicate, nextRecordFactory) {
    return this.withLock(entity, async () => {
      const doc = await this._readEntityWithRecoveryUnsafe(entity);
      const idx = doc.records.findIndex(predicate);
      const nextRecord = nextRecordFactory(idx >= 0 ? doc.records[idx] : null);
      if (idx >= 0) {
        doc.records[idx] = nextRecord;
      } else {
        doc.records.push(nextRecord);
      }
      await this._writeEntityUnsafe(entity, doc);
      return nextRecord;
    });
  }

  async updateById(entity, id, updater) {
    return this.withLock(entity, async () => {
      const doc = await this._readEntityWithRecoveryUnsafe(entity);
      const idx = doc.records.findIndex((r) => String(r.id) === String(id));
      if (idx < 0) return null;
      const current = doc.records[idx];
      const next = updater(current);
      doc.records[idx] = next;
      await this._writeEntityUnsafe(entity, doc);
      return next;
    });
  }

  async updateWhere(entity, predicate, updater) {
    return this.withLock(entity, async () => {
      const doc = await this._readEntityWithRecoveryUnsafe(entity);
      let changed = 0;
      doc.records = doc.records.map((r) => {
        if (!predicate(r)) return r;
        changed += 1;
        return updater(r);
      });
      if (changed > 0) {
        await this._writeEntityUnsafe(entity, doc);
      }
      return changed;
    });
  }

  async deleteById(entity, id) {
    return this.withLock(entity, async () => {
      const doc = await this._readEntityWithRecoveryUnsafe(entity);
      const initial = doc.records.length;
      doc.records = doc.records.filter((r) => String(r.id) !== String(id));
      if (doc.records.length !== initial) {
        await this._writeEntityUnsafe(entity, doc);
        return true;
      }
      return false;
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

    return this.withLock(entity, async () => {
      const doc = await this._readEntityWithRecoveryUnsafe(entity);
      let out = [...doc.records];
      if (typeof filter === 'function') {
        out = out.filter(filter);
      }
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

  async replaceAll(entity, records) {
    return this.withLock(entity, async () => {
      const doc = await this._readEntityWithRecoveryUnsafe(entity);
      doc.records = records;
      await this._writeEntityUnsafe(entity, doc);
      return records;
    });
  }

  async createBackup(entity) {
    const file = this.entityFile(entity);
    if (!fs.existsSync(file)) return null;

    const entityBackupDir = path.join(this.backupDir, entity);
    ensureDirSync(entityBackupDir);
    const backupFile = path.join(entityBackupDir, `${Date.now()}.json`);
    await fs.promises.copyFile(file, backupFile);

    const backups = (await fs.promises.readdir(entityBackupDir))
      .filter((f) => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));
    const stale = backups.slice(this.maxBackupsPerEntity);
    for (const item of stale) {
      try {
        await fs.promises.unlink(path.join(entityBackupDir, item));
      } catch {
        // Best-effort cleanup.
      }
    }
    return backupFile;
  }

  async backupAll(entities) {
    const backups = {};
    for (const entity of entities) {
      backups[entity] = await this.withLock(entity, async () => this.createBackup(entity));
    }
    return backups;
  }

  async recoverLatest(entity) {
    return this.withLock(entity, async () => {
      return this._recoverLatestUnsafe(entity);
    });
  }
}

module.exports = {
  JsonStore,
};
