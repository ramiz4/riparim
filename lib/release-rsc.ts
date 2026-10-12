export function setReleaseRscHeaders(headers:Headers,request:Request){
 const url=new URL(request.url);url.searchParams.delete('_rsc');
 headers.set('Content-Type','text/x-component;charset=utf-8');
 // Vinext uses this response contract for its client navigation context. The
 // payload is immutable; its current request URL belongs only in no-store headers.
 headers.set('X-Vinext-Rendered-Path-And-Search',encodeURIComponent(url.pathname+url.search));
 headers.set('X-Vinext-Dynamic-Stale-Time','0');
}
