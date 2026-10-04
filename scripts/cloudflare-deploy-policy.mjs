import { posix } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { assertBuildProvenance, assertReleaseContext } from "./release-policy.mjs";

export const cloudflareProduction = {
  account: "ec181b3a61c7c3da13910600953fc3ea",
  worker: "riparim",
  database: "b395ea3a-5316-4b0b-bdee-533bdb68d6a0",
  databaseName: "riparim-production",
  bucket: "riparim-evidence-production",
};

const workerSecretNames = new Set([
  "REVIEW_MODERATOR_EMAIL",
  "SUPABASE_SECRET_KEY",
  "GOOGLE_MAPS_BROWSER_API_KEY",
  "GOOGLE_PLACES_SERVER_API_KEY",
  "EMAIL_LOGIN_ACTIVATION_PROJECT",
  "EMAIL_LOGIN_ACTIVATION_TIME",
]);

export function assertCloudflareDeployContext(env, commit, tagCommit) {
  assertReleaseContext(env, commit);
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(env.RELEASE_TAG ?? "") || tagCommit !== commit) {
    throw new Error("Deployment requires a stable release tag resolving to the exact main workflow commit.");
  }
}

export function assertCloudflareProvenance(provenance, commit, sha256) {
  assertBuildProvenance(provenance, commit, sha256);
  if (provenance.provider !== "cloudflare") throw new Error("Only an owned Cloudflare build may be deployed.");
}

// Read names separately from permissions: filenames may contain spaces, while
// tar's verbose listing exposes links and special files by their first character.
export function assertSafeTarListing(listing, verbose) {
  const names = listing.split("\n").filter(Boolean);
  const details = verbose.split("\n").filter(Boolean);
  if (!names.length || names.length !== details.length) throw new Error("The release archive listing is incomplete.");
  const seen = new Set();
  const entries = names.map((name, index) => {
    const path = name.endsWith("/") ? name.slice(0, -1) : name;
    const parts = path.split("/");
    const type = details[index][0];
    if (parts[0] !== "dist" || parts.some(part => !part || part === "." || part === "..") || /[\x00-\x1f\x7f\\]/.test(name) || !["-", "d"].includes(type) || seen.has(path)) {
      throw new Error("The release archive contains an unsafe path, duplicate, link or special file.");
    }
    seen.add(path);
    return { path, type };
  });
  for (const required of ["dist/server/index.js", "dist/server/wrangler.json"]) {
    if (!entries.some(entry => entry.path === required && entry.type === "-")) throw new Error("The release archive has no complete Worker build.");
  }
  if (!entries.some(entry => entry.path.startsWith("dist/client/") && entry.type === "-")) throw new Error("The release archive has no client assets.");
}

function assertProductionTarget(config) {
  const database = config.d1_databases?.[0];
  const bucket = config.r2_buckets?.[0];
  if (config.account_id !== cloudflareProduction.account || config.name !== cloudflareProduction.worker || config.d1_databases?.length !== 1 || database.binding !== "DB" || database.database_id !== cloudflareProduction.database || database.database_name !== cloudflareProduction.databaseName || config.r2_buckets?.length !== 1 || bucket.binding !== "BUCKET" || bucket.bucket_name !== cloudflareProduction.bucket) {
    throw new Error("Wrangler configuration does not target the intended production Worker, D1 database and R2 bucket.");
  }
  if (config.services?.length || database.preview_database_id || bucket.preview_bucket_name || config.build?.command || Object.keys(config.env ?? {}).length || config.dispatch_namespace) {
    throw new Error("Preview services, preview resources, custom builds and alternate environments are forbidden during production deployment.");
  }
}

export function assertCloudflareDeployConfig(source, generated) {
  assertProductionTarget(source);
  assertProductionTarget(generated);
  if (posix.normalize(source.main ?? "") !== "build/cloudflare-worker.ts" || source.d1_databases[0].migrations_dir !== "drizzle") {
    throw new Error("Production must use the owned Cloudflare request boundary and the checked-in migrations.");
  }
  if (generated.no_bundle !== true || posix.normalize(generated.main ?? "") !== "index.js" || posix.normalize(generated.assets?.directory ?? "") !== "../client" || !isDeepStrictEqual(source.vars ?? {}, generated.vars ?? {})) {
    throw new Error("Generated configuration must deploy the released Worker and client assets with the checked-in runtime variables.");
  }
}

export function parseWorkerSecrets(value) {
  if (!value) return null;
  let secrets;
  try { secrets = JSON.parse(value); } catch { throw new Error("CLOUDFLARE_WORKER_SECRETS must be a JSON object of string values."); }
  if (!secrets || Array.isArray(secrets) || typeof secrets !== "object" || Object.entries(secrets).some(([name, secret]) => !workerSecretNames.has(name) || typeof secret !== "string" || !secret)) {
    throw new Error("CLOUDFLARE_WORKER_SECRETS must contain only permitted application runtime keys and nonempty string values.");
  }
  return Object.keys(secrets).length ? secrets : null;
}
