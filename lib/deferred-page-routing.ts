import {setReleaseRscHeaders} from "./release-rsc";
import paths from "@/data/deferred-pages.json";
import {localeFromPath,localizeHref,pageIdentityPath} from "./i18n/locale";

export async function serveDeferredPage(request:Request,env:Cloudflare.Env){
 const url=new URL(request.url),identity=pageIdentityPath(url.pathname);
 if(url.pathname.startsWith('/__private/'))return new Response('Not Found',{status:404});
 if(!paths.includes(identity)||!['GET','HEAD'].includes(request.method)||!env.ASSETS||Reflect.get(env,'PUBLIC_RELEASE_RENDER'))return null;
 const locale=localeFromPath(url.pathname),localized=localizeHref(url.pathname,locale);
 if(localized!==url.pathname){url.pathname=localized;return new Response(null,{status:308,headers:{Location:url.href,'Cache-Control':'private, no-store'}});}
 const rsc=request.headers.get('RSC')==='1'||request.headers.get('Accept')?.includes('text/x-component');
 const asset=await env.ASSETS.fetch(new Request(new URL('/__private/'+locale+identity+(rsc?'.rsc':'.html'),url.origin),{method:request.method}));
 if(asset.status!==200){await asset.body?.cancel();return null;}
 // These release artifacts contain only UI/copy. Every account, permission and
 // private record is fetched from a fresh, authorized no-store API after mount.
 const headers=new Headers(asset.headers);headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 if(rsc)setReleaseRscHeaders(headers,request);
 return new Response(asset.body,{headers});
}
