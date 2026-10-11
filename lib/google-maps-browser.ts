import {googlePlaceIdFromMapsUrl} from "./google-maps-link";
import {isLocale,type Locale} from "@/lib/i18n/locale";
export type LiveGoogleRating={rating:number|null;count:number|null;mapsUrl:string;attributions:{provider?:string;providerURI?:string}[]};
type GooglePlace=object;
export type GooglePlacesLibrary={Place:new(options:{id:string;requestedLanguage?:string})=>GooglePlace};
type GoogleWindow=Window&{google?:{maps?:{importLibrary:(name:string)=>Promise<GooglePlacesLibrary>}};__riparimGoogleMapsLoaded?:()=>void;gm_authFailure?:()=>void};
type ClientConfig={enabled:boolean;browserKey?:string};
let configPromise:Promise<ClientConfig>|undefined,libraryPromise:Promise<GooglePlacesLibrary>|undefined;
const identities=new Map<string,Promise<{placeId:string;browserKey:string}|null>>();
export function googlePlacesClientConfig(){return configPromise??=fetch("/api/google-places",{credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(12000)}).then(async response=>{if(!response.ok)throw Error("Google unavailable");return response.json() as Promise<ClientConfig>;});}
export async function workshopGoogleIdentity(id:string,sourceMapsUrl?:string|null,identityRevision=""){
 const identityKey=`${id}:${sourceMapsUrl??""}:${identityRevision}`,expectedPlaceId=googlePlaceIdFromMapsUrl(sourceMapsUrl);
 let pending=identities.get(identityKey);if(!pending){pending=(async()=>{const config=await googlePlacesClientConfig();if(!config.enabled||!config.browserKey)return null;const response=await fetch(`/api/google-places/${encodeURIComponent(id)}`,{credentials:"same-origin",cache:"no-store",signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error("Google unavailable");const result=await response.json() as {placeId?:string|null};return result.placeId&&(!expectedPlaceId||result.placeId===expectedPlaceId)?{placeId:result.placeId,browserKey:config.browserKey!}:null;})();identities.set(identityKey,pending);pending.catch(()=>identities.delete(identityKey));}
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
   // Rating-only Advanced UI Kit requires beta; one shared SDK also serves Standard profile widgets.
   const params=new URLSearchParams({key:browserKey,v:"beta",loading:"async",libraries:"places",language:browserLocale(),region:"XK",callback:"__riparimGoogleMapsLoaded"});
   script.src=`https://maps.googleapis.com/maps/api/js?${params}`;script.async=true;script.onerror=()=>finish(Error("Google unavailable"));document.head.appendChild(script);
  });
  if(!win.google?.maps?.importLibrary)throw Error("Google unavailable");return win.google.maps.importLibrary("places");
 })();
 return libraryPromise;
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
import {type LiveGoogleProfile} from "./google-workshop-profile";
