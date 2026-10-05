import {isLocale,type Locale} from "@/lib/i18n/locale";
export type LiveGoogleRating={rating:number|null;count:number|null;mapsUrl:string;attributions:{provider?:string;providerURI?:string}[]};
type GooglePlace={rating?:number|null;userRatingCount?:number|null;googleMapsURI?:string;attributions?:LiveGoogleRating["attributions"];fetchFields(options:{fields:string[]}):Promise<unknown>};
export type GooglePlacesLibrary={Place:new(options:{id:string;requestedLanguage?:string})=>GooglePlace};
type GoogleWindow=Window&{google?:{maps?:{importLibrary:(name:string)=>Promise<GooglePlacesLibrary>}};__riparimGoogleMapsLoaded?:()=>void;gm_authFailure?:()=>void};
type ClientConfig={enabled:boolean;browserKey?:string};
function safeHttps(value:string|undefined):string|undefined{if(!value)return undefined;try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}}
let configPromise:Promise<ClientConfig>|undefined,libraryPromise:Promise<GooglePlacesLibrary>|undefined;
const identities=new Map<string,Promise<{placeId:string;browserKey:string}|null>>();
const liveRequests=new Map<string,Promise<LiveGoogleRating>>();
const profileRequests=new Map<string,Promise<LiveGoogleProfile>>();
export function googlePlacesClientConfig(){return configPromise??=fetch("/api/google-places",{credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(12000)}).then(async response=>{if(!response.ok)throw Error("Google unavailable");return response.json() as Promise<ClientConfig>;});}
export async function workshopGoogleIdentity(id:string){
 let pending=identities.get(id);if(!pending){pending=(async()=>{const config=await googlePlacesClientConfig();if(!config.enabled||!config.browserKey)return null;const response=await fetch(`/api/google-places/${encodeURIComponent(id)}`,{credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error("Google unavailable");const result=await response.json() as {placeId?:string|null};return result.placeId?{placeId:result.placeId,browserKey:config.browserKey!}:null;})();identities.set(id,pending);pending.catch(()=>identities.delete(id));}
 return pending;
}
export function browserLocale():Locale{const value=typeof document==="undefined"?"de":document.documentElement?.lang;return isLocale(value)?value:"de";}
export function loadGooglePlaces(browserKey:string):Promise<GooglePlacesLibrary>{
 if(libraryPromise)return libraryPromise;
 const win=window as GoogleWindow;
 libraryPromise=(async()=>{
  if(!win.google?.maps?.importLibrary)await new Promise<void>((resolve,reject)=>{
   const script=document.createElement("script"),previousAuthFailure=win.gm_authFailure;
   const finish=(error?:Error)=>{clearTimeout(timeout);delete win.__riparimGoogleMapsLoaded;win.gm_authFailure=previousAuthFailure;if(error)reject(error);else resolve();};
   const timeout=setTimeout(()=>finish(Error("Google load timeout")),12000);
   win.__riparimGoogleMapsLoaded=()=>finish();win.gm_authFailure=()=>finish(Error("Google authorization unavailable"));
   const params=new URLSearchParams({key:browserKey,v:"weekly",loading:"async",libraries:"places",language:browserLocale(),region:"XK",callback:"__riparimGoogleMapsLoaded"});
   script.src=`https://maps.googleapis.com/maps/api/js?${params}`;script.async=true;script.onerror=()=>finish(Error("Google unavailable"));document.head.appendChild(script);
  });
  if(!win.google?.maps?.importLibrary)throw Error("Google unavailable");return win.google.maps.importLibrary("places");
 })();
 return libraryPromise;
}
export async function currentGoogleRating(placeId:string,browserKey:string,locale:Locale=browserLocale()){
 const providerLocale=isLocale(locale)?locale:"de",requestKey=`${placeId}:${providerLocale}`;
 let pending=liveRequests.get(requestKey);if(!pending){pending=(async()=>{const library=await loadGooglePlaces(browserKey),place=new library.Place({id:placeId,requestedLanguage:providerLocale});await place.fetchFields({fields:["rating","userRatingCount","googleMapsURI","attributions"]});return {rating:typeof place.rating==="number"&&place.rating>=1&&place.rating<=5?place.rating:null,count:typeof place.userRatingCount==="number"&&Number.isInteger(place.userRatingCount)&&place.userRatingCount>=0?place.userRatingCount:null,mapsUrl:safeHttps(place.googleMapsURI)??`https://www.google.com/maps/search/?api=1&query=Werkstatt&query_place_id=${encodeURIComponent(placeId)}`,attributions:(place.attributions??[]).filter(a=>a.provider).map(a=>({provider:a.provider,providerURI:safeHttps(a.providerURI)}))};})();liveRequests.set(requestKey,pending);void pending.finally(()=>liveRequests.delete(requestKey)).catch(()=>{});}
 return pending;
}
export async function currentGoogleProfile(placeId:string,browserKey:string,locale:Locale=browserLocale()):Promise<LiveGoogleProfile>{
 const providerLocale=isLocale(locale)?locale:"de",requestKey=`${placeId}:${providerLocale}`;
 let pending=profileRequests.get(requestKey);
 if(!pending){
  pending=(async()=>{
   const response=await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${providerLocale}`,{headers:{"X-Goog-Api-Key":browserKey,"X-Goog-FieldMask":"id,rating,userRatingCount,currentOpeningHours,regularOpeningHours,businessStatus,location,photos,googleMapsUri,attributions"},credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error("Google profile unavailable");
   return normalizeGoogleProfile(await response.json() as GoogleProfileResponse,placeId);
  })();
  profileRequests.set(requestKey,pending);void pending.finally(()=>profileRequests.delete(requestKey)).catch(()=>{});
 }
 return pending;
}
type MapInstance=object;
type MapLibrary={Map:new(element:HTMLElement,options:Record<string,unknown>)=>MapInstance};
type MarkerLibrary={AdvancedMarkerElement:new(options:Record<string,unknown>)=>{map:MapInstance|null}};
export async function showConfirmedGoogleMap(element:HTMLElement,profile:Pick<LiveGoogleProfile,"placeId"|"location">,browserKey:string,title:string,appearance:{theme:"light"|"dark";signal?:AbortSignal}={theme:"light"}){
 if(!profile.location)throw Error("Google location unavailable");
 await loadGooglePlaces(browserKey);
 const maps=(window as GoogleWindow).google!.maps!;
 const [mapLibrary,markerLibrary]=await Promise.all([maps.importLibrary("maps"),maps.importLibrary("marker")]) as unknown as [MapLibrary,MarkerLibrary];
 if(appearance.signal?.aborted)throw new DOMException("Map loading cancelled","AbortError");
 const map=new mapLibrary.Map(element,{center:profile.location,zoom:16,mapId:"DEMO_MAP_ID",colorScheme:appearance.theme==="dark"?"DARK":"LIGHT",mapTypeControl:false,streetViewControl:false,gestureHandling:"cooperative"});
 const marker=new markerLibrary.AdvancedMarkerElement({map,position:profile.location,title});
 return ()=>{marker.map=null;element.replaceChildren();};
}
import {normalizeGoogleProfile,type GoogleProfileResponse,type LiveGoogleProfile} from "./google-workshop-profile";
