"use client";
import {useEffect,useRef,useState} from "react";
import {useVisibleGooglePlace} from "./use-google-place";
import {loadGooglePlaces} from "@/lib/google-maps-browser";
import type {Workshop} from "@/lib/workshops";
export function GooglePlaceReviews({workshop}:{workshop:Workshop}){
 const {ref,identity,status}=useVisibleGooglePlace(workshop.id,false),container=useRef<HTMLDivElement>(null),[widgetReady,setWidgetReady]=useState(false),[widgetFailed,setWidgetFailed]=useState(false);
 const mapsUrl=workshop.googleRating?.mapsUrl??`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${workshop.name} ${workshop.address} Kosovo`)}`;
 useEffect(()=>{if(!identity||!container.current)return;let active=true,element:HTMLElement|null=null;const host=container.current;
  const timer=setTimeout(()=>{if(active){setWidgetFailed(true);active=false;}},12000);
  void (async()=>{await loadGooglePlaces(identity.browserKey);if(!active)return;await customElements.whenDefined("gmp-place-details");if(!active)return;
   element=document.createElement("gmp-place-details");const request=document.createElement("gmp-place-details-place-request");request.setAttribute("place",identity.placeId);const config=document.createElement("gmp-place-content-config");config.appendChild(document.createElement("gmp-place-rating"));config.appendChild(document.createElement("gmp-place-reviews"));element.appendChild(request);element.appendChild(config);
   element.addEventListener("gmp-load",()=>{if(active){clearTimeout(timer);setWidgetReady(true);}},{once:true});element.addEventListener("gmp-error",()=>{if(active){clearTimeout(timer);setWidgetFailed(true);}},{once:true});host.appendChild(element);
  })().catch(()=>{if(active){clearTimeout(timer);setWidgetFailed(true);}});
  return()=>{active=false;clearTimeout(timer);element?.remove();};
 },[identity]);
 return <div ref={ref} className="google-reviews-panel"><div ref={container} className={`google-official-widget${widgetFailed?" google-widget-unavailable":""}`} aria-label={`Google-Rezensionen zu ${workshop.name}`}/>{!widgetReady&&!widgetFailed&&(status==="loading"||status==="ready")&&<p className="help" role="status">Google-Rezensionen werden geladen …</p>}<a className="text-action" href={mapsUrl} target="_blank" rel="noopener noreferrer">{widgetReady?"Alle Rezensionen auf Google Maps":"Rezensionen auf Google Maps ansehen"}</a></div>;
}
