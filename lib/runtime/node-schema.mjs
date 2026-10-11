// Runtime receipts and private bytes are separate from the Drizzle app schema.
export const nodeMigrationSchema='CREATE TABLE IF NOT EXISTS riparim_node_migrations (name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TEXT NOT NULL)';
export const privateObjectsSchema='CREATE TABLE IF NOT EXISTS private_objects (key TEXT PRIMARY KEY,etag TEXT NOT NULL,bytes BLOB NOT NULL,uploaded INTEGER NOT NULL,http_metadata TEXT NOT NULL,custom_metadata TEXT NOT NULL)';
