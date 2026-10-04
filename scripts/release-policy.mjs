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

export function existingReleaseMetadata(release, tag, commit) {
  const names = new Set(release.assets?.filter(asset => asset.state === "uploaded" && asset.size > 0).map(asset => asset.name));
  if (!/^v\d+\.\d+\.\d+$/.test(tag) || release.tag_name !== tag || release.draft || release.prerelease || !names.has(`riparim-${tag}.tar.gz`) || !names.has(`riparim-${tag}.json`)) {
    throw new Error("Existing release publication is incomplete. Finish its release assets before retrying deployment.");
  }
  return { version: tag.slice(1), gitTag: tag, gitHead: commit };
}
