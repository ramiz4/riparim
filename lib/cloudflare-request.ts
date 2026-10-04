const SITES_IDENTITY_HEADER_PREFIX = "oai-authenticated-user-";

// Sites supplies these headers at its trusted edge. On an owned Worker they
// come from the client and must never establish an application identity.
export function stripSitesIdentityHeaders(request: Request): Request {
  const headers = new Headers(request.headers);
  for (const name of request.headers.keys()) {
    if (name.toLowerCase().startsWith(SITES_IDENTITY_HEADER_PREFIX)) {
      headers.delete(name);
    }
  }
  return new Request(request, { headers });
}
