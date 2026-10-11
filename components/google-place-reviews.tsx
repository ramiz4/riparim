"use client";
import {useI18n} from "@/lib/i18n/client";
import {formatDate} from "@/lib/i18n/format";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useEffect,useRef,useState} from "react";
import {loadGooglePlaces} from "@/lib/google-maps-browser";
import type {GoogleProfileStatus} from "@/lib/google-workshop-profile";
import type {GoogleWorkshopIdentity,RequestGoogleIdentity} from "./use-google-workshop-profile";
import {useGoogleVisibility} from "./use-google-visibility";
import {workshopMapsUrl} from "@/lib/google-maps-link";
import type {Workshop} from "@/lib/workshops";

type Props={workshop:Workshop;identity:GoogleWorkshopIdentity|null;status:GoogleProfileStatus;requestIdentity?:RequestGoogleIdentity};
export function GooglePlaceReviews(props:Props){
 const {locale}=useI18n();
 return <GoogleDetails key={`${props.workshop.id}:${locale}:${props.identity?.placeId??""}`} {...props}/>;
}
function GoogleDetails({workshop,identity,status,requestIdentity}:Props){
 const {locale,t}=useI18n(),{ref,canLoad,isVisible}=useGoogleVisibility();
 const container=useRef<HTMLDivElement>(null),[started,setStarted]=useState(false),[revision,setRevision]=useState(0);
 const [widgetStatus,setWidgetStatus]=useState<GoogleProfileStatus>("loading"),[loadedAt,setLoadedAt]=useState<number|null>(null),[expired,setExpired]=useState(false),[needsReload,setNeedsReload]=useState(false);
 const mapsUrl=workshopMapsUrl(workshop,identity?.placeId);
 useEffect(()=>{if(canLoad)return requestIdentity?.(isVisible);},[canLoad,isVisible,requestIdentity]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Start a provider widget only after both its panel and browser tab become visible.
 useEffect(()=>{if(canLoad&&identity&&!started)setStarted(true);},[canLoad,identity,started]);
 useEffect(()=>{
  if(!started||!identity||!container.current)return;
  let active=true,element:HTMLElement|null=null,expiry:ReturnType<typeof setTimeout>|undefined;
  const host=container.current;
  setWidgetStatus("loading");setLoadedAt(null);setExpired(false);setNeedsReload(false);
  const fail=()=>{if(active){clearTimeout(timeout);setWidgetStatus("unavailable");setNeedsReload(!element);element?.remove();active=false;}};
  const timeout=setTimeout(fail,12000);
  void (async()=>{
   const library=await loadGooglePlaces(identity.browserKey);if(!active)return;
   await customElements.whenDefined("gmp-place-details");if(!active)return;
   // Visibility may change while the SDK loads; defer mounting the billable widget.
   if(!isVisible()){clearTimeout(timeout);setStarted(false);return;}
   element=document.createElement("gmp-place-details");
   const request=document.createElement("gmp-place-details-place-request");
   (request as HTMLElement&{place:unknown}).place=new library.Place({id:identity.placeId,requestedLanguage:locale});
   const config=document.createElement("gmp-place-content-config");
   for(const name of ["gmp-place-rating","gmp-place-opening-hours","gmp-place-reviews"])config.appendChild(document.createElement(name));
   element.appendChild(request);element.appendChild(config);
   element.addEventListener("gmp-load",()=>{if(active){clearTimeout(timeout);setWidgetStatus("ready");setLoadedAt(Date.now());expiry=setTimeout(()=>{if(active)setExpired(true);},1800000);}},{once:true});
   element.addEventListener("gmp-error",fail,{once:true});host.appendChild(element);
  })().catch(fail);
  return()=>{active=false;clearTimeout(timeout);clearTimeout(expiry);element?.remove();};
 },[identity,locale,started,revision,isVisible]);
 const unavailable=widgetStatus==="unavailable"||status==="unavailable"&&!identity;
 return <div ref={ref} className="google-reviews-panel">
  <h3 className="profile-google-heading" translate="no">Google Maps</h3>
  <div ref={container} className={`google-official-widget${expired||unavailable?" google-widget-unavailable":""}`} aria-label={t("public.googleDetailsAria",{name:workshop.name})}/>
  {unavailable?<p className="help" role="status">{t("public.googleDetailsFailed")}</p>:!loadedAt&&canLoad&&<p className="help" role="status">{t("public.googleDetailsLoading")}</p>}
  {loadedAt!==null&&<p className="help google-details-time">{t("public.googleDetailsLoadedAt",{time:formatDate(locale,loadedAt,{withTime:true})})}</p>}
  {expired&&<p className="help" role="status">{t("public.googleDetailsStale")}</p>}
  {(expired||unavailable)&&identity&&<button type="button" className="outline google-details-refresh" disabled={!canLoad} onClick={()=>{if(isVisible()){if(needsReload)window.location.reload();else setRevision(value=>value+1);}}}>{t(needsReload?"public.googleDetailsReload":"public.googleDetailsRefresh")}</button>}
  <LocaleAnchor className="text-action" href={mapsUrl} target="_blank" rel="noopener noreferrer">{t("public.checkMaps")}</LocaleAnchor>
 </div>;
}
