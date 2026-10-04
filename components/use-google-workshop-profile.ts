"use client";
import {useEffect,useState} from "react";
import {currentGoogleProfile,workshopGoogleIdentity} from "@/lib/google-maps-browser";
import {googleProfileRefreshDelay,type GoogleProfileStatus,type LiveGoogleProfile} from "@/lib/google-workshop-profile";

export type GoogleWorkshopIdentity={placeId:string;browserKey:string};
export function useGoogleWorkshopProfile(id:string){
 const [profile,setProfile]=useState<LiveGoogleProfile|null>(null),[identity,setIdentity]=useState<GoogleWorkshopIdentity|null>(null),[status,setStatus]=useState<GoogleProfileStatus>("loading"),[loadedFor,setLoadedFor]=useState(id);
 useEffect(()=>{
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset live Google content when navigating to a different workshop; the ID guard prevents displaying the previous business.
  setProfile(null);setIdentity(null);setStatus("loading");setLoadedFor(id);
  let active=true,timer:ReturnType<typeof setTimeout>|undefined,pending=false,lastLoaded=0,nextRefresh=0;
  const refresh=async()=>{
   if(pending||document.visibilityState==="hidden")return;
   pending=true;
   try{
    const match=await workshopGoogleIdentity(id);if(!active)return;
    if(!match){setStatus("unavailable");return;}
    setIdentity(previous=>previous?.placeId===match.placeId&&previous.browserKey===match.browserKey?previous:match);
    const result=await currentGoogleProfile(match.placeId,match.browserKey);if(!active)return;
    setProfile(result);setStatus("ready");lastLoaded=result.loadedAt;
    const delay=googleProfileRefreshDelay(result);nextRefresh=Date.now()+delay;
    clearTimeout(timer);timer=setTimeout(()=>void refresh(),delay);
   }catch{if(active){setProfile(null);setStatus("unavailable");}}
   finally{pending=false;}
  };
  const visible=()=>{if(document.visibilityState==="visible"&&(Date.now()>=nextRefresh||Date.now()-lastLoaded>300000))void refresh();};
  void refresh();document.addEventListener("visibilitychange",visible);
  return()=>{active=false;clearTimeout(timer);document.removeEventListener("visibilitychange",visible);};
 },[id]);
 return loadedFor===id?{profile,identity,status}:{profile:null,identity:null,status:"loading" as GoogleProfileStatus};
}
