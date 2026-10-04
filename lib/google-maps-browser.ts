export type LiveGoogleRating={rating:number|null;count:number|null;mapsUrl:string;attributions:{provider?:string;providerURI?:string}[]};
type GooglePlace={rating?:number|null;userRatingCount?:number|null;googleMapsURI?:string;attributions?:LiveGoogleRating["attributions"];fetchFields(options:{fields:string[]}):Promise<unknown>};
export type GooglePlacesLibrary={Place:new(options:{id:string;requestedLanguage?:string})=>GooglePlace};
type GoogleWindow=Window&{google?:{maps?:{importLibrary:(name:string)=>Promise<GooglePlacesLibrary>}};__riparimGoogleMapsLoaded?:()=>void;gm_authFailure?:()=>void};
type ClientConfig={enabled:boolean;browserKey?:string};
function safeHttps(value:string|undefined):string|undefined{if(!value)return undefined;try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}}
let configPromise:Promise<ClientConfig>|undefined,libraryPromise:Promise<GooglePlacesLibrary>|undefined;
const identities=new Map<string,Promise<{placeId:string;browserKey:string}|null>>();
const liveRequests=new Map<string,Promise<LiveGoogleRating>>();
export function googlePlacesClientConfig(){return configPromise??=fetch("/api/google-places",{credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(12000)}).then(async response=>{if(!response.ok)throw Error("Google unavailable");return response.json() as Promise<ClientConfig>;});}
export async function workshopGoogleIdentity(id:string){
 let pending=identities.get(id);if(!pending){pending=(async()=>{const config=await googlePlacesClientConfig();if(!config.enabled||!config.browserKey)return null;const response=await fetch(`/api/google-places/${encodeURIComponent(id)}`,{credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error("Google unavailable");const result=await response.json() as {placeId?:string|null};return result.placeId?{placeId:result.placeId,browserKey:config.browserKey!}:null;})();identities.set(id,pending);pending.catch(()=>identities.delete(id));}
 return pending;
}
export function loadGooglePlaces(browserKey:string):Promise<GooglePlacesLibrary>{
 if(libraryPromise)return libraryPromise;
 const win=window as GoogleWindow;
 libraryPromise=(async()=>{
  if(!win.google?.maps?.importLibrary)await new Promise<void>((resolve,reject)=>{
   const script=document.createElement("script"),previousAuthFailure=win.gm_authFailure;
   const finish=(error?:Error)=>{clearTimeout(timeout);delete win.__riparimGoogleMapsLoaded;win.gm_authFailure=previousAuthFailure;error?reject(error):resolve();};
   const timeout=setTimeout(()=>finish(Error("Google load timeout")),12000);
   win.__riparimGoogleMapsLoaded=()=>finish();win.gm_authFailure=()=>finish(Error("Google authorization unavailable"));
   const params=new URLSearchParams({key:browserKey,v:"weekly",loading:"async",libraries:"places",language:"de",region:"XK",callback:"__riparimGoogleMapsLoaded"});
   script.src=`https://maps.googleapis.com/maps/api/js?${params}`;script.async=true;script.onerror=()=>finish(Error("Google unavailable"));document.head.appendChild(script);
  });
  if(!win.google?.maps?.importLibrary)throw Error("Google unavailable");return win.google.maps.importLibrary("places");
 })();
 return libraryPromise;
}
export async function currentGoogleRating(placeId:string,browserKey:string){
 let pending=liveRequests.get(placeId);if(!pending){pending=(async()=>{const library=await loadGooglePlaces(browserKey),place=new library.Place({id:placeId,requestedLanguage:"de"});await place.fetchFields({fields:["rating","userRatingCount","googleMapsURI","attributions"]});return {rating:typeof place.rating==="number"&&place.rating>=1&&place.rating<=5?place.rating:null,count:typeof place.userRatingCount==="number"&&Number.isInteger(place.userRatingCount)&&place.userRatingCount>=0?place.userRatingCount:null,mapsUrl:safeHttps(place.googleMapsURI)??`https://www.google.com/maps/search/?api=1&query=Werkstatt&query_place_id=${encodeURIComponent(placeId)}`,attributions:(place.attributions??[]).filter(a=>a.provider).map(a=>({provider:a.provider,providerURI:safeHttps(a.providerURI)}))};})();liveRequests.set(placeId,pending);void pending.finally(()=>liveRequests.delete(placeId)).catch(()=>{});}
 return pending;
}
