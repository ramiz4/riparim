"use client";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useEffect,useRef,useState} from "react";
import {loadGooglePlaces} from "@/lib/google-maps-browser";
import type {LiveGoogleRating} from "@/lib/google-maps-browser";
import type {GoogleProfileStatus} from "@/lib/google-workshop-profile";
import type {GoogleWorkshopIdentity} from "./use-google-workshop-profile";
import {workshopMapsUrl} from "@/lib/google-maps-link";
import type {Workshop} from "@/lib/workshops";
export function GooglePlaceReviews({workshop,identity,liveRating,status}:{workshop:Workshop;identity:GoogleWorkshopIdentity|null;liveRating:LiveGoogleRating|null;status:GoogleProfileStatus}){
 const ref=useRef<HTMLDivElement>(null),container=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false),[widgetReady,setWidgetReady]=useState(false),[widgetFailed,setWidgetFailed]=useState(false);
 const empty=liveRating?.count===0;
 const mapsUrl=workshopMapsUrl(workshop,identity?.placeId);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Older browsers without an observer must still load the Google widget after hydration.
 useEffect(()=>{if(typeof IntersectionObserver==="undefined"){setVisible(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:"120px"});if(ref.current)observer.observe(ref.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!visible||empty||!identity||!container.current)return;let active=true,element:HTMLElement|null=null,timer:ReturnType<typeof setTimeout>|null=null;const host=container.current;
  const clearTimer=()=>{if(timer!==null)clearTimeout(timer);};
  const fail=()=>{if(active){clearTimer();setWidgetFailed(true);active=false;}};
  void (async()=>{await loadGooglePlaces(identity.browserKey);if(!active)return;timer=setTimeout(fail,12000);await customElements.whenDefined("gmp-place-details");if(!active)return;
   element=document.createElement("gmp-place-details");const request=document.createElement("gmp-place-details-place-request");request.setAttribute("place",identity.placeId);const config=document.createElement("gmp-place-content-config");config.appendChild(document.createElement("gmp-place-rating"));config.appendChild(document.createElement("gmp-place-reviews"));element.appendChild(request);element.appendChild(config);
   element.addEventListener("gmp-load",()=>{if(active){clearTimer();setWidgetReady(true);}},{once:true});element.addEventListener("gmp-error",fail,{once:true});host.appendChild(element);
  })().catch(fail);
  return()=>{active=false;clearTimer();element?.remove();};
 },[identity,visible,empty]);
 return <div ref={ref} className="google-reviews-panel">{!empty&&<div ref={container} className={`google-official-widget${widgetFailed?" google-widget-unavailable":""}`} aria-label={`Google-Rezensionen zu ${workshop.name}`}/>} {empty?<p className="help">Noch keine Google-Rezensionen.</p>:widgetFailed||status==="unavailable"&&!identity?<p className="help" role="status">Google-Rezensionen konnten nicht geladen werden.</p>:!widgetReady&&visible&&<p className="help" role="status">Google-Rezensionen werden geladen …</p>}<LocaleAnchor className="text-action" href={mapsUrl} target="_blank" rel="noopener noreferrer">{widgetReady?"Alle Rezensionen auf Google Maps":"Rezensionen auf Google Maps ansehen"}</LocaleAnchor></div>;
}
