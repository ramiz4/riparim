import { isDeepStrictEqual } from "node:util";

export const sitesProjectId = "appgprj_6abfd028b7e48191822a15d44cbbda8d";

export function releaseBuildTarget(value = "cloudflare") {
  if (!["cloudflare", "sites"].includes(value)) throw new Error("BUILD_TARGET must be cloudflare or sites.");
  return value;
}

export function sitesBuildConfiguration(hosting) {
  if (hosting.project_id !== sitesProjectId || hosting.d1 !== "DB" || hosting.r2 !== "BUCKET") {
    throw new Error("Sites builds must preserve the existing project and its logical DB/BUCKET bindings.");
  }
  return {
    name: "riparim-sites",
    main: "./build/sites-worker.ts",
    compatibility_date: "2026-05-15",
    compatibility_flags: ["nodejs_compat"],
    workers_dev: false,
    preview_urls: false,
    vars: { SITE_ORIGIN: "https://riparim.com" },
    triggers: { crons: ["*/5 * * * *"] },
    d1_databases: [{ binding: hosting.d1, database_name: "site-creator-d1", database_id: "00000000-0000-4000-8000-000000000000", remote: false }],
    r2_buckets: [{ binding: hosting.r2, bucket_name: "site-creator-r2", remote: false }],
  };
}

export function assertSitesBuildConfig(hosting, generated) {
  const expected = sitesBuildConfiguration(hosting);
  const database = generated.d1_databases?.[0];
  const bucket = generated.r2_buckets?.[0];
  if (generated.name !== expected.name || generated.d1_databases?.length !== 1 || database.binding !== expected.d1_databases[0].binding || database.database_name !== expected.d1_databases[0].database_name || database.database_id !== expected.d1_databases[0].database_id || database.remote !== false || generated.r2_buckets?.length !== 1 || bucket.binding !== expected.r2_buckets[0].binding || bucket.bucket_name !== expected.r2_buckets[0].bucket_name || bucket.remote !== false) {
    throw new Error("Sites output must contain only the existing logical bindings with platform placeholders.");
  }
  const otherBindings = ["services", "kv_namespaces", "workflows", "send_email", "vectorize", "hyperdrive", "analytics_engine_datasets", "dispatch_namespaces", "mtls_certificates", "pipelines", "secrets_store_secrets", "ai_search_namespaces", "ai_search", "worker_loaders", "vpc_services", "vpc_networks", "artifacts", "containers", "flagship", "ratelimits", "ai", "browser", "images", "media", "stream"];
  if (Object.hasOwn(generated, "account_id") || otherBindings.some(name => generated[name] && Object.keys(generated[name]).length) || generated.durable_objects?.bindings?.length || generated.queues?.producers?.length || generated.queues?.consumers?.length || generated.routes?.length || Object.keys(generated.env ?? {}).length || generated.build?.command || generated.dispatch_namespace || generated.unsafe || database.preview_database_id || bucket.preview_bucket_name || generated.workers_dev !== false || generated.preview_urls !== false) {
    throw new Error("Sites output must not contain owned-account resources, routes, preview services or alternate deployments.");
  }
  if (generated.main !== "index.js" || generated.no_bundle !== true || generated.assets?.directory !== "../client" || generated.compatibility_date !== expected.compatibility_date || !isDeepStrictEqual(generated.compatibility_flags, expected.compatibility_flags) || !isDeepStrictEqual(generated.vars, expected.vars) || !isDeepStrictEqual(generated.triggers, expected.triggers)) {
    throw new Error("Sites output must preserve its compiled adapter, client assets, source origin and scheduled handler.");
  }
}

export function assertReleaseContext(env, commit) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_EVENT_NAME !== "push" || env.GITHUB_REF !== "refs/heads/main" || env.GITHUB_REPOSITORY !== "ramiz4/riparim") {
    throw new Error("Releases are allowed only by GitHub Actions after a push to ramiz4/riparim main.");
  }
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "") || env.GITHUB_SHA !== commit) {
    throw new Error("The release checkout must match the exact main workflow commit.");
  }
}

export function assertBuildProvenance(provenance, commit, sha256) {
  if (provenance.repository !== "ramiz4/riparim" || provenance.commit !== commit || !/^[a-f0-9]{64}$/.test(sha256 ?? "") || provenance.sha256 !== sha256) {
    throw new Error("Verified build repository, commit or SHA-256 does not match.");
  }
}

export function assertReleaseBuildProvenance(provenance, commit, sha256, provider) {
  assertBuildProvenance(provenance, commit, sha256);
  if (provenance.provider !== releaseBuildTarget(provider) || (provider === "sites" && provenance.project_id !== sitesProjectId)) {
    throw new Error("Verified archive provider or Sites project does not match the release target.");
  }
}

export function assertSitesReleaseAssets(release, tag, commit) {
  existingReleaseMetadata(release, tag, commit);
  const names = new Set(release.assets?.filter(asset => asset.state === "uploaded" && asset.size > 0).map(asset => asset.name));
  if (!names.has(`riparim-sites-${tag}.tar.gz`) || !names.has(`riparim-sites-${tag}.json`)) {
    throw new Error("Existing release has no complete Sites companion. Finish its publication before retrying the new release flow.");
  }
}

export function existingReleaseMetadata(release, tag, commit) {
  const names = new Set(release.assets?.filter(asset => asset.state === "uploaded" && asset.size > 0).map(asset => asset.name));
  if (!/^v\d+\.\d+\.\d+$/.test(tag) || release.tag_name !== tag || release.draft || release.prerelease || !names.has(`riparim-${tag}.tar.gz`) || !names.has(`riparim-${tag}.json`)) {
    throw new Error("Existing release publication is incomplete. Finish its release assets before retrying deployment.");
  }
  return { version: tag.slice(1), gitTag: tag, gitHead: commit };
}
