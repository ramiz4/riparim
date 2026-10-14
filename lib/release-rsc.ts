export function setReleaseRscHeaders(headers: Headers, request: Request) {
  const url = new URL(request.url);
  url.searchParams.delete("_rsc");
  headers.set("Content-Type", "text/x-component;charset=utf-8");
  // Vinext embeds this build identity in both server and browser bundles. Without
  // the matching response header it rejects even same-release RSC as incompatible.
  const compatibilityId = process.env.__VINEXT_RSC_COMPATIBILITY_ID;
  if (compatibilityId)
    headers.set("X-Vinext-RSC-Compatibility-Id", compatibilityId);
  // Vinext uses this response contract for its client navigation context. The
  // payload is immutable; its current request URL belongs only in no-store headers.
  headers.set(
    "X-Vinext-Rendered-Path-And-Search",
    encodeURIComponent(url.pathname + url.search),
  );
  headers.set("X-Vinext-Dynamic-Stale-Time", "0");
}
