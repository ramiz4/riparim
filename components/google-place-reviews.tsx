"use client";
import {useEffect,useRef,useState} from "react";
import {useVisibleGooglePlace} from "./use-google-place";
import {loadGooglePlaces} from "@/lib/google-maps-browser";
import type {Workshop} from "@/lib/workshops";
export function GooglePlaceReviews({workshop}:{workshop:Workshop}){
 const {ref,identity,status}=useVisibleGooglePlace(workshop.id,false),container=useRef<HTMLDivElement>(null),[widgetReady,setWidgetReady]=useState(false),[widgetFailed,setWidgetFailed]=useState(false);
 const mapsQuery=encodeURIComponent(`${workshop.name} ${workshop.address} Kosovo`);
 const mapsUrl=identity?`https://www.google.com/maps/search/?api=1&query=${mapsQuery}&query_place_id=${encodeURIComponent(identity.placeId)}`:workshop.googleRating?.mapsUrl??`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
 useEffect(()=>{if(!identity||!container.current)return;let active=true,element:HTMLElement|null=null,timer:ReturnType<typeof setTimeout>|null=null;const host=container.current;
  const clearTimer=()=>{if(timer!==null)clearTimeout(timer);};
  const fail=()=>{if(active){clearTimer();setWidgetFailed(true);active=false;}};
  void (async()=>{await loadGooglePlaces(identity.browserKey);if(!active)return;timer=setTimeout(fail,12000);await customElements.whenDefined("gmp-place-details");if(!active)return;
   element=document.createElement("gmp-place-details");const request=document.createElement("gmp-place-details-place-request");request.setAttribute("place",identity.placeId);const config=document.createElement("gmp-place-content-config");config.appendChild(document.createElement("gmp-place-rating"));config.appendChild(document.createElement("gmp-place-reviews"));element.appendChild(request);element.appendChild(config);
   element.addEventListener("gmp-load",()=>{if(active){clearTimer();setWidgetReady(true);}},{once:true});element.addEventListener("gmp-error",fail,{once:true});host.appendChild(element);
  })().catch(fail);
  return()=>{active=false;clearTimer();element?.remove();};
 },[identity]);
 return <div ref={ref} className="google-reviews-panel"><div ref={container} className={`google-official-widget${widgetFailed?" google-widget-unavailable":""}`} aria-label={`Google-Rezensionen zu ${workshop.name}`}/>{!widgetReady&&!widgetFailed&&(status==="loading"||status==="ready")&&<p className="help" role="status">Google-Rezensionen werden geladen …</p>}<a className="text-action" href={mapsUrl} target="_blank" rel="noopener noreferrer">{widgetReady?"Alle Rezensionen auf Google Maps":"Rezensionen auf Google Maps ansehen"}</a></div>;
}
