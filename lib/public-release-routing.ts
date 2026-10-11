import {localeFromPath,localizeHref,pageIdentityPath} from "./i18n/locale";
type Revision={id:string;updatedAt:string};
declare const __RIPARIM_PUBLIC_REVISIONS__:Revision[];
export function publicAssetPath(url:URL){
 const match=pageIdentityPath(url.pathname).match(/^\/(werkstaetten|werkstatt\/([a-z0-9][a-z0-9-]{2,80}))$/);
 if(!match)return null;
 const locale=localeFromPath(url.pathname),id=match[2];
 if(id&&!__RIPARIM_PUBLIC_REVISIONS__.some(w=>w.id===id))return null;
 return `/__public/${locale}/${id?"werkstatt/"+id:"werkstaetten"}.html`;
}
export async function servePublicRelease(request:Request,env:Cloudflare.Env){
 const url=new URL(request.url);
 if(url.pathname.startsWith("/__public/"))return new Response("Not found",{status:404});
 const asset=publicAssetPath(url);
 if(asset){const localized=localizeHref(url.pathname,localeFromPath(url.pathname));if(localized!==url.pathname){url.pathname=localized;return new Response(null,{status:308,headers:{Location:url.href,"Cache-Control":"private, no-store"}});}}
 if(!asset||!["GET","HEAD"].includes(request.method)||request.headers.get("RSC")==="1"||request.headers.get("Accept")?.includes("text/x-component")||Reflect.get(env,"PUBLIC_RELEASE_RENDER"))return null;
 // A changed profile uses a data-free shell until its next approved release.
 const id=pageIdentityPath(url.pathname).match(/^\/werkstatt\/([a-z0-9-]+)$/)?.[1];
 let current=false;
 if(id){
  const row=await env.DB.prepare("SELECT status,updated_at FROM workshops WHERE id=?").bind(id).first<{status:string;updated_at:string}>();
  if(!row||row.status!=="published")return new Response("Not found",{status:404});
  current=row.updated_at===__RIPARIM_PUBLIC_REVISIONS__.find(w=>w.id===id)?.updatedAt;
 }else{
  const result=await env.DB.prepare("SELECT id,updated_at FROM workshops WHERE status='published' ORDER BY id").all<{id:string;updated_at:string}>();
  current=result.results.length===__RIPARIM_PUBLIC_REVISIONS__.length&&result.results.every((w,i)=>w.id===__RIPARIM_PUBLIC_REVISIONS__[i].id&&w.updated_at===__RIPARIM_PUBLIC_REVISIONS__[i].updatedAt);
 }
 const selected=current?asset:asset.replace(/\.html$/,"-shell.html");
 const target=new URL(selected,url.origin);
 const response=await env.ASSETS.fetch(new Request(target,{method:request.method}));
 if(response.status!==200){await response.body?.cancel();return null;}
 const headers=new Headers(response.headers);headers.set("Cache-Control","no-store");headers.set("X-Riparim-Public-Snapshot","1");
 return new Response(response.body,{status:200,headers});
}
