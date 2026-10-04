"use client";
/* eslint-disable @next/next/no-img-element -- Google photos use fresh provider references and direct attribution; avoid an image optimizer persisting these resources. */
import {useEffect,useRef,useState} from "react";
import {Camera,ChevronDown,Clock3,MapPin} from "lucide-react";
import {googleOpeningPresentation,googlePhotoUrl,type GoogleProfileStatus,type LiveGoogleProfile} from "@/lib/google-workshop-profile";
import {showConfirmedGoogleMap} from "@/lib/google-maps-browser";
import type {GoogleWorkshopIdentity} from "./use-google-workshop-profile";

export function WorkshopOpeningHours({profile,status,mapsUrl}:{profile:LiveGoogleProfile|null;status:GoogleProfileStatus;mapsUrl:string}){
 const hours=googleOpeningPresentation(profile,status);
 return <div className={`profile-opening-hours ${hours.tone}`}><div className="profile-opening-summary" role="status"><Clock3 size={17}/><div><strong>{hours.label}</strong>{hours.detail&&<span>{hours.detail}</span>}{hours.today&&<span>Heute: {hours.today}</span>}</div></div>{hours.rows.length>0?<details className="profile-week-hours"><summary>Wochenzeiten<ChevronDown size={15}/></summary><ul>{hours.rows.map(row=><li key={row.day} className={row.today?"today":""}><span>{row.day}</span><span>{row.text}</span></li>)}</ul><p>Ortszeit Kosovo · <a href={mapsUrl} target="_blank" rel="noopener noreferrer" translate="no">Google Maps</a></p>{profile?.rating.attributions.map((a,i)=><p key={i}>{a.providerURI?<a href={a.providerURI} target="_blank" rel="noopener noreferrer">{a.provider}</a>:a.provider}</p>)}</details>:status!=="loading"&&<a className="profile-hours-fallback" href={mapsUrl} target="_blank" rel="noopener noreferrer">Auf Google Maps prüfen</a>}</div>;
}

export function WorkshopPhotos({name,profile,identity,status,mapsUrl}:{name:string;profile:LiveGoogleProfile|null;identity:GoogleWorkshopIdentity|null;status:GoogleProfileStatus;mapsUrl:string}){
 const [failed,setFailed]=useState<string[]>([]);
 const photos=profile?.photos.filter(photo=>!failed.includes(photo.resource))??[];
 if(status==="loading")return <div className="profile-photo-loading" aria-label="Werkstattfotos werden geladen" role="status"><Camera size={20}/><span>Werkstattfotos werden geladen …</span></div>;
 if(!identity||!photos.length)return null;
 return <section className="profile-photo-section" id="fotos" aria-label={`Fotos zu ${name}`}><div className="profile-photo-strip">{photos.map((photo,i)=><figure key={photo.resource}><a href={photo.mapsUrl??mapsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Foto ${i+1} zu ${name} auf Google Maps ansehen`}><img src={googlePhotoUrl(photo,identity.browserKey)} alt={`Foto ${i+1} zum Google-Eintrag von ${name}`} width={600} height={380} loading="lazy" decoding="async" referrerPolicy="strict-origin-when-cross-origin" onError={()=>setFailed(value=>value.includes(photo.resource)?value:[...value,photo.resource])}/></a><figcaption>{photo.authors.map((author,index)=><span key={index}>{author.url?<a href={author.url} target="_blank" rel="noopener noreferrer">{author.name}</a>:author.name}</span>)}<a href={photo.mapsUrl??mapsUrl} target="_blank" rel="noopener noreferrer" className="google-maps-attribution" translate="no">Google Maps</a></figcaption></figure>)}</div></section>;
}

export function WorkshopGoogleMap({name,profile,identity,status,mapsUrl}:{name:string;profile:LiveGoogleProfile|null;identity:GoogleWorkshopIdentity|null;status:GoogleProfileStatus;mapsUrl:string}){
 const [open,setOpen]=useState(false),[mapStatus,setMapStatus]=useState<"loading"|"ready"|"unavailable">("loading"),host=useRef<HTMLDivElement>(null);
 const placeId=profile?.placeId,lat=profile?.location?.lat,lng=profile?.location?.lng,browserKey=identity?.browserKey;
 useEffect(()=>{
  if(!open||!host.current||!placeId||lat==null||lng==null||!browserKey)return;
  let active=true,dispose:(()=>void)|undefined;
  const element=host.current;
  void showConfirmedGoogleMap(element,{placeId,location:{lat,lng}},browserKey,name).then(cleanup=>{if(!active){cleanup();return;}dispose=cleanup;setMapStatus("ready");}).catch(()=>{if(active)setMapStatus("unavailable");});
  return()=>{active=false;dispose?.();};
 },[open,placeId,lat,lng,browserKey,name]);
 const unavailable=mapStatus==="unavailable"||status==="unavailable"||status==="ready"&&!profile?.location;
 return <details className="profile-map" onToggle={event=>{const expanded=event.currentTarget.open;setOpen(expanded);if(expanded)setMapStatus("loading");}}><summary><span><MapPin size={16}/>Karte anzeigen</span><ChevronDown size={17}/></summary>{open&&<>{!unavailable&&<div ref={host} className="profile-google-map" role="region" aria-label={`Karte: ${name}`} data-google-place-id={profile?.placeId}/>}<p className="help" role="status">{unavailable?"Die Karte konnte nicht geladen werden.":mapStatus!=="ready"?"Karte wird geladen …":null}</p>{unavailable&&<a className="text-action" href={mapsUrl} target="_blank" rel="noopener noreferrer">Standort auf Google Maps öffnen</a>}</>}</details>;
}
