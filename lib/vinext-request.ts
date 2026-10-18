import { isPagePath } from "./i18n/locale";

// Vinext treats an absent UA as streaming even when htmlLimitedBots matches all.
// Supply a neutral application identity only for document rendering; keep each
// adapter's authentication, body, cancellation and RSC headers unchanged.
export function metadataDocumentRequest(request: Request): Request {
  if (
    request.headers.get("user-agent")?.trim() ||
    !["GET", "HEAD"].includes(request.method) ||
    !isPagePath(new URL(request.url).pathname) ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Accept")?.includes("text/x-component")
  )
    return request;
  const headers = new Headers(request.headers);
  headers.set("User-Agent", "RiparimHtmlRenderer/1.0");
  return new Request(request, { headers });
}
