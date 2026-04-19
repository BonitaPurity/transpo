# JSON Storage Layer

This backend now supports file-based persistence via `db-json.js` and `storage/json-store.js`.

## Directory Layout

- `backend/data/<entity>.json`: canonical JSON data per entity.
- `backend/data/_locks/<entity>.lock`: lock files for cross-process safety.
- `backend/data/_backups/<entity>/<timestamp>.json`: rolling backups.

## Core Guarantees

- Atomic writes with temp-file + rename.
- Per-entity lock files with timeout and retry.
- In-process operation queue per entity for thread-safe sequencing.
- Record checksum verification on read to detect corruption.
- Automatic backup before write and backup retention.
- Recovery support from latest per-entity backup.

## Configuration

- `JSON_STORAGE_DIR`: custom root directory for JSON data.
- `JSON_BACKUP_KEEP`: max number of backups per entity (default: `20`).

## Notes

- This storage strategy is intended for small-scale deployments.
- For high write concurrency and large datasets, migrate to a dedicated DB engine.
