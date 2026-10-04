const config = {
  branches: ["main"],
  repositoryUrl: "https://github.com/ramiz4/riparim.git",
  tagFormat: "v${version}",
  plugins: [
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits", presetConfig: {} }],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits", presetConfig: {} }],
    ["@semantic-release/github", {
      successCommentCondition: false,
      failCommentCondition: false,
      releasedLabels: false,
      assets: [
        { path: "artifacts/riparim-worker.tar.gz", name: "riparim-${nextRelease.gitTag}.tar.gz", label: "Cloudflare Worker and Sites migrations" },
        { path: "artifacts/provenance.json", name: "riparim-${nextRelease.gitTag}.json", label: "Release commit and archive SHA-256" },
        { path: "artifacts/riparim-sites.tar.gz", name: "riparim-sites-${nextRelease.gitTag}.tar.gz", label: "Sites companion Worker and migrations" },
        { path: "artifacts/sites-provenance.json", name: "riparim-sites-${nextRelease.gitTag}.json", label: "Sites project, release commit and archive SHA-256" },
      ],
    }],
  ],
};
export default config;
