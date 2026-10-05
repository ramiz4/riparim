"use client";
import {useI18n} from "@/lib/i18n/client";
import {useEffect,useRef,useState} from "react";
import {currentGoogleRating,workshopGoogleIdentity,type LiveGoogleRating} from "@/lib/google-maps-browser";
export function useVisibleGooglePlace(id:string,loadRating=true,enabled=true){
 const {locale}=useI18n();
 const requestKey=`${id}:${locale}`;
 const ref=useRef<HTMLDivElement>(null),[identity,setIdentity]=useState<{placeId:string;browserKey:string}|null>(null),[live,setLive]=useState<LiveGoogleRating|null>(null),[loadedFor,setLoadedFor]=useState(requestKey),[status,setStatus]=useState<"idle"|"loading"|"ready"|"unavailable">("idle");
 useEffect(()=>{if(!enabled)return;let active=true,observer:IntersectionObserver|undefined;const start=async()=>{observer?.disconnect();setLoadedFor(requestKey);setLive(null);setIdentity(null);setStatus("loading");try{const match=await workshopGoogleIdentity(id);if(!active)return;if(!match){setStatus("unavailable");return;}setIdentity(match);if(loadRating){const rating=await currentGoogleRating(match.placeId,match.browserKey,locale);if(!active)return;setLive(rating);}setStatus("ready");}catch{if(active)setStatus("unavailable");}};
  const element=ref.current?.closest(".catalogue-card")??ref.current;
  if(element&&typeof IntersectionObserver!=="undefined"){observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))void start();},{rootMargin:"120px"});observer.observe(element);}else void start();
  return ()=>{active=false;observer?.disconnect();};
 },[id,loadRating,enabled,locale,requestKey]);
 return loadedFor===requestKey?{ref,identity,live,status}:{ref,identity:null,live:null,status:"loading" as const};
}
