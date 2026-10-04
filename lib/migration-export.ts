import hosting from "../.openai/hosting.json";

const prefix = "/__migration/export";
const pageSize = 5;
type SchemaEntry = { name: string; type: string; tbl_name: string; sql: string };
type Column = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number };

export function stampReleaseCommit(result: Response) {
  const commit = typeof __RIPARIM_RELEASE_COMMIT__ === "string" && /^[a-f0-9]{40}$/.test(__RIPARIM_RELEASE_COMMIT__) ? __RIPARIM_RELEASE_COMMIT__ : null;
  const name = "X-Riparim-Release-Commit";
  if (result.headers.get(name) === commit) return result;
  const headers = new Headers(result.headers);
  if (commit) headers.set(name, commit);
  else headers.delete(name);
  // Reuse the body without buffering or teeing it; redirects and session
  // cookies retain their original response contract.
  return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
}

export function migrationReadOnly(env: Cloudflare.Env) {
  // Expiring the export credential must never silently reopen the old writer.
  return env.MIGRATION_READ_ONLY === "true";
}

function response(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

async function authorized(request: Request, env: Cloudflare.Env) {
  const expires = Date.parse(env.MIGRATION_EXPORT_EXPIRES_AT ?? "");
  if (!migrationReadOnly(env) || !/^[a-f0-9]{64}$/.test(env.MIGRATION_EXPORT_TOKEN_SHA256 ?? "") ||
      !/^[a-f0-9]{40}$/.test(env.MIGRATION_SOURCE_COMMIT ?? "") ||
      !Number.isFinite(expires) || expires <= Date.now() || expires > Date.now() + 24 * 60 * 60_000) return false;
  const token = request.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return false;
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  const expected = env.MIGRATION_EXPORT_TOKEN_SHA256!;
  let difference = 0;
  for (let i = 0; i < hash.length; i++) difference |= hash[i] ^ parseInt(expected.slice(i * 2, i * 2 + 2), 16);
  return difference === 0;
}

function identifier(name: string) { return `"${name.replaceAll('"', '""')}"`; }
function scalar(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value) || (Array.isArray(value) && value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255))) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : Array.isArray(value) ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { type: "blob", base64: btoa(binary) };
  }
  throw new Error("Unsupported SQLite value");
}

async function schema(db: D1Database) {
  const result = await db.prepare("SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB '_cf_*' AND tbl_name NOT GLOB '_cf_*' AND type IN ('table','index','trigger','view') ORDER BY type,name").all<SchemaEntry>();
  if (!result.success) throw new Error("Schema export failed");
  return result.results;
}

async function columns(db: D1Database, name: string) {
  const result = await db.prepare(`PRAGMA table_info(${identifier(name)})`).all<Column>();
  if (!result.success || !result.results.length) throw new Error("Column export failed");
  return result.results.map(({ name, type, notnull, dflt_value, pk }) => ({ name, type, notnull, dflt_value, pk }));
}

function objectMetadata(object: R2Object) {
  return { key: object.key, size: object.size, etag: object.etag, uploaded: object.uploaded.toISOString(),
    version: object.version, storageClass: "storageClass" in object ? object.storageClass : "Standard",
    httpMetadata: object.httpMetadata ?? {}, customMetadata: object.customMetadata ?? {}, checksums: object.checksums.toJSON() };
}

/** Intercept before application code: GETs and scheduled jobs can also write. */
export async function handleMigrationRequest(request: Request, env: Cloudflare.Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== prefix) {
    if (!migrationReadOnly(env)) return null;
    return stampReleaseCommit(new Response("Riparim wird gerade auf den neuen Server übernommen. Bitte versuche es später erneut.", {
      status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300", "X-Riparim-Migration-Read-Only": "true" },
    }));
  }
  // No cookies, native identity, admin UI, cross-origin grant or caller SQL.
  if (!await authorized(request, env)) return response({ error: "Export unavailable" }, 404);
  if (!env.DB || !env.BUCKET) return response({ error: "Storage unavailable" }, 503);
  try {
    if (request.method === "GET" && url.searchParams.get("operation") === "schema") {
      // Cloudflare forbids reading reserved provider tables. Record the boundary
      // explicitly; this export never disguises an omitted internal table.
      const excluded = await env.DB.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name GLOB '_cf_*' ORDER BY name").all<{name:string}>();
      if (!excluded.success) throw new Error("Provider inventory failed");
      return response({ format: 1, projectId: hosting.project_id, sourceCommit: env.MIGRATION_SOURCE_COMMIT,
        exportedAt: new Date().toISOString(), readOnly: true, excludedProviderTables: excluded.results.map(item => item.name), schema: await schema(env.DB) });
    }
    if (request.method === "GET" && url.searchParams.get("operation") === "table") {
      const name = url.searchParams.get("table");
      const offsetText = url.searchParams.get("offset") ?? "0";
      if (!name || !/^(0|[1-9]\d*)$/.test(offsetText) || !Number.isSafeInteger(Number(offsetText))) return response({ error: "Invalid page" }, 400);
      const table = (await schema(env.DB)).find(item => item.type === "table" && item.name === name);
      if (!table) return response({ error: "Unknown table" }, 400);
      const fields = await columns(env.DB, name);
      // Primary-key order also supports WITHOUT ROWID tables; rowid is the
      // fallback only when no key exists. OFFSET is stable under the full pause.
      const keys = fields.filter(field => field.pk).sort((a, b) => a.pk - b.pk);
      const order = keys.length ? keys.map(field => identifier(field.name)).join(",") : "rowid";
      const result = await env.DB.prepare(`SELECT * FROM ${identifier(name)} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(pageSize + 1, Number(offsetText)).all<Record<string, unknown>>();
      if (!result.success) throw new Error("Table export failed");
      const rows = result.results.slice(0, pageSize).map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, scalar(value)])));
      return response({ name, columns: fields, rows, nextOffset: result.results.length > pageSize ? Number(offsetText) + pageSize : null });
    }
    if (request.method === "GET" && url.searchParams.get("operation") === "objects") {
      const options: R2ListOptions & { include: ("httpMetadata" | "customMetadata")[] } = { limit: 100, cursor: url.searchParams.get("cursor") ?? undefined, include: ["httpMetadata", "customMetadata"] };
      const result = await env.BUCKET.list(options);
      return response({ objects: result.objects.map(objectMetadata), cursor: result.truncated ? result.cursor : null });
    }
    if (request.method === "POST") {
      // Object keys stay out of request URLs and ordinary access logs.
      if (request.headers.get("Content-Type") !== "application/json") return response({ error: "Invalid request" }, 400);
      const reader = request.body?.getReader();
      if (!reader) return response({ error: "Invalid request" }, 400);
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 4096) { await reader.cancel(); return response({ error: "Invalid request" }, 400); } chunks.push(part.value); }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let at = 0; for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
      const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!value || typeof value !== "object" || !("operation" in value) || value.operation !== "object" ||
          !("key" in value) || typeof value.key !== "string" || new TextEncoder().encode(value.key).length > 1024 ||
          !("etag" in value) || typeof value.etag !== "string" || !value.etag || Object.keys(value).length !== 3) return response({ error: "Invalid request" }, 400);
      const object = await env.BUCKET.get(value.key, { onlyIf: { etagMatches: value.etag } });
      if (!object || !("body" in object)) return response({ error: "Snapshot changed" }, 409);
      return new Response(object.body, { headers: { "Content-Type": "application/octet-stream", "Content-Length": String(object.size), "ETag": object.httpEtag, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    return response({ error: "Invalid operation" }, 400);
  } catch {
    // Do not log row values, filenames, SQL, object keys or credentials.
    return response({ error: "Export failed" }, 503);
  }
}
