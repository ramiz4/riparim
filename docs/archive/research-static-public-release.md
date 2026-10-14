# Static public-release research: October 10, 2026

Pinned Vinext beta.5 prerender accepted all routes, not selected route arrays.
Normal output remained outside assets; export mode conflicted with private/dynamic
routes. Importing the built Worker in Node failed on `cloudflare:workers`.
No full prerender build, code change, deployment or production saving was proved.

The proposed alternative rendered explicit public locale/profile routes in
isolated Miniflare/workerd with canonical data and blocked providers, then verified
identity, metadata, source and hashes before packaging. Sessions/evidence stayed
private and reviews approved-only. Navigation and live-revision compatibility
needed independent tests; rendering alone proved neither freshness nor CPU savings.

This was a proposal for the installed versions, not a current asset-bypass recipe.
Later implementation used live publication/revision checks and data-free shells.
Follow-up: [independent review](review-static-public-release.md) and
[catalogue publication acceptance](catalogue-history.md#first-automation-acceptance).
Primary sources: [Cloudflare asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
and [Vinext](https://github.com/cloudflare/vinext); installed-version probes took precedence.

[Full record and original evidence](https://github.com/ramiz4/riparim/blob/bb20bb86051f3e7f82b412f0f6604ff6e460efb4/docs/archive/research-static-public-release.md).
