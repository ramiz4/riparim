"use client";
/* eslint-disable @next/next/no-img-element -- Google photos use fresh provider references; avoid an image optimizer persisting these resources. */
import {useEffect,useId,useRef,useState} from "react";
import {useTheme} from "next-themes";
import {Camera,ChevronDown,ChevronLeft,ChevronRight,Clock3,LoaderCircle,MapPin} from "lucide-react";
import {googleOpeningPresentation,googlePhotoUrl,type GooglePhoto,type GoogleProfileStatus,type LiveGoogleProfile} from "@/lib/google-workshop-profile";
import {showConfirmedGoogleMap} from "@/lib/google-maps-browser";
import type {GoogleWorkshopIdentity} from "./use-google-workshop-profile";
import {Dialog,DialogContent,DialogTitle} from "./ui/dialog";

export function WorkshopOpeningHours({profile,status,mapsUrl}:{profile:LiveGoogleProfile|null;status:GoogleProfileStatus;mapsUrl:string}){
 const hours=googleOpeningPresentation(profile,status);
 const showToday=!!hours.today&&!(hours.tone==="closed"&&hours.today?.trim().toLocaleLowerCase("de")==="geschlossen");
 return <div className={`profile-opening-hours ${hours.tone}`}><div className="profile-opening-summary" role="status"><Clock3 size={17}/><div><strong>{hours.label}</strong>{hours.detail&&<span>{hours.detail}</span>}{showToday&&<span className="profile-hours-today">Heute: {hours.today}</span>}</div></div>{hours.rows.length>0?<details className="profile-week-hours"><summary>Wochenzeiten<ChevronDown size={15}/></summary><ul>{hours.rows.map(row=><li key={row.day} className={row.today?"today":""}><span>{row.day}</span><span>{row.text}</span></li>)}</ul><p>Ortszeit Kosovo · <a href={mapsUrl} target="_blank" rel="noopener noreferrer" translate="no">Google Maps</a></p>{profile?.rating.attributions.map((a,i)=><p key={i}>{a.providerURI?<a href={a.providerURI} target="_blank" rel="noopener noreferrer">{a.provider}</a>:a.provider}</p>)}</details>:status!=="loading"&&<a className="profile-hours-fallback" href={mapsUrl} target="_blank" rel="noopener noreferrer">Auf Google Maps prüfen</a>}</div>;
}

export function WorkshopPhotos({name,profile,identity,status}:{name:string;profile:LiveGoogleProfile|null;identity:GoogleWorkshopIdentity|null;status:GoogleProfileStatus}){
 const [failed,setFailed]=useState<string[]>([]),[largeFailed,setLargeFailed]=useState<string[]>([]);
 const [gallery,setGallery]=useState<{photos:GooglePhoto[];index:number}|null>(null),[loaded,setLoaded]=useState<string[]>([]);
 const opener=useRef<HTMLButtonElement|null>(null),touch=useRef<{x:number;y:number}|null>(null),galleryId=useId();
 const photos=profile?.photos.filter(photo=>!failed.includes(photo.resource))??[];
 const selected=gallery?.photos[gallery.index];
 function move(direction:number){setGallery(current=>current?{...current,index:(current.index+direction+current.photos.length)%current.photos.length}:null);}
 if(status==="loading"&&!gallery)return <div className="profile-photo-loading" aria-label="Werkstattfotos werden geladen" role="status"><Camera size={20}/><span>Werkstattfotos werden geladen …</span></div>;
 if(!identity||(!photos.length&&!gallery))return null;
 return <section className="profile-photo-section" id="fotos" aria-label={`Fotos zu ${name}`}>
  <Dialog open={!!gallery} onOpenChange={open=>{if(!open)setGallery(null);}}>
   <div className="profile-photo-strip">{photos.map((photo,i)=><figure key={photo.resource}><button type="button" aria-label={`Foto ${i+1} von ${name} vergrößern`} aria-haspopup="dialog" aria-controls={gallery?galleryId:undefined} onClick={event=>{opener.current=event.currentTarget;setLargeFailed([]);setLoaded([]);setGallery({photos:[...photos],index:i});}}><img src={googlePhotoUrl(photo,identity.browserKey)} alt={`Foto ${i+1} zum Google-Eintrag von ${name}`} width={600} height={380} loading="lazy" decoding="async" referrerPolicy="strict-origin-when-cross-origin" onError={()=>setFailed(value=>value.includes(photo.resource)?value:[...value,photo.resource])}/></button></figure>)}</div>
   <DialogContent id={galleryId} className="profile-photo-viewer" overlayClassName="profile-gallery-overlay" aria-describedby={undefined} onCloseAutoFocus={event=>{event.preventDefault();opener.current?.focus();}} onKeyDown={event=>{if(event.altKey||event.ctrlKey||event.metaKey)return;if(event.key==="ArrowLeft"||event.key==="ArrowRight"){event.preventDefault();move(event.key==="ArrowLeft"?-1:1);}}}>
    {gallery&&selected&&<>
     <header className="profile-gallery-header"><DialogTitle className="profile-gallery-title">{name}</DialogTitle><span className="profile-gallery-counter" role="status" aria-label={`Foto ${gallery.index+1} von ${gallery.photos.length}`}>{gallery.index+1} / {gallery.photos.length}</span></header>
     <div className="profile-gallery-stage" onTouchStart={event=>{const point=event.touches[0];touch.current=event.touches.length===1?{x:point.clientX,y:point.clientY}:null;}} onTouchCancel={()=>{touch.current=null;}} onTouchEnd={event=>{const start=touch.current,point=event.changedTouches[0];touch.current=null;if(!start||!point)return;const dx=point.clientX-start.x,dy=point.clientY-start.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1);}}>
      {largeFailed.includes(selected.resource)?<p className="profile-photo-error" role="status">Das Bild konnte nicht geladen werden. {gallery.photos.length>1?"Wähle ein anderes Bild.":"Bitte öffne es erneut."}</p>:<>
       {!loaded.includes(selected.resource)&&<span className="profile-gallery-loading" role="status"><LoaderCircle size={24} className="spin"/>Bild wird geladen …</span>}
       <img key={selected.resource} className={loaded.includes(selected.resource)?"is-loaded":""} src={googlePhotoUrl(selected,identity.browserKey,"large")} alt={`Foto ${gallery.index+1} von ${name} in Großansicht`} loading="eager" decoding="async" draggable={false} referrerPolicy="strict-origin-when-cross-origin" onLoad={()=>setLoaded(value=>value.includes(selected.resource)?value:[...value,selected.resource])} onError={()=>setLargeFailed(value=>value.includes(selected.resource)?value:[...value,selected.resource])}/>
      </>}
      {gallery.photos.length>1&&<><button type="button" className="profile-gallery-prev" aria-label="Vorheriges Bild" onClick={()=>move(-1)}><ChevronLeft size={25}/></button><button type="button" className="profile-gallery-next" aria-label="Nächstes Bild" onClick={()=>move(1)}><ChevronRight size={25}/></button></>}
     </div>
     {gallery.photos.length>1&&<div className="profile-gallery-thumbnails" aria-label="Bildauswahl">{gallery.photos.map((photo,i)=><button key={photo.resource} type="button" aria-label={`Foto ${i+1} anzeigen`} aria-pressed={gallery.index===i} onClick={()=>setGallery(current=>current?{...current,index:i}:null)}><img src={googlePhotoUrl(photo,identity.browserKey)} alt="" width={80} height={56} decoding="async" referrerPolicy="strict-origin-when-cross-origin"/></button>)}</div>}
    </>}
   </DialogContent>
  </Dialog>
 </section>;
}

export function WorkshopGoogleMap({name,profile,identity,status,mapsUrl}:{name:string;profile:LiveGoogleProfile|null;identity:GoogleWorkshopIdentity|null;status:GoogleProfileStatus;mapsUrl:string}){
 const {resolvedTheme}=useTheme();
 const mapTheme=resolvedTheme==="dark"?"dark":"light";
 const [open,setOpen]=useState(false),[mapStatus,setMapStatus]=useState<"loading"|"ready"|"unavailable">("loading"),host=useRef<HTMLDivElement>(null);
 const placeId=profile?.placeId,lat=profile?.location?.lat,lng=profile?.location?.lng,browserKey=identity?.browserKey;
 useEffect(()=>{
  if(!open||!host.current||!placeId||lat==null||lng==null||!browserKey)return;
  let active=true,dispose:(()=>void)|undefined;const controller=new AbortController();
  const element=host.current;
  void showConfirmedGoogleMap(element,{placeId,location:{lat,lng}},browserKey,name,{theme:mapTheme,signal:controller.signal}).then(cleanup=>{if(!active){cleanup();return;}dispose=cleanup;setMapStatus("ready");}).catch(()=>{if(active)setMapStatus("unavailable");});
  return()=>{active=false;controller.abort();dispose?.();};
 },[open,placeId,lat,lng,browserKey,name,mapTheme]);
 const unavailable=mapStatus==="unavailable"||status==="unavailable"||status==="ready"&&!profile?.location;
 return <details className="profile-map" onToggle={event=>{const expanded=event.currentTarget.open;setOpen(expanded);if(expanded)setMapStatus("loading");}}><summary><span><MapPin size={16}/>Karte anzeigen</span><ChevronDown size={17}/></summary>{open&&<>{!unavailable&&<div ref={host} className="profile-google-map" role="region" aria-label={`Karte: ${name}`} data-google-place-id={profile?.placeId}/>}<p className="help" role="status">{unavailable?"Die Karte konnte nicht geladen werden.":mapStatus!=="ready"?"Karte wird geladen …":null}</p>{unavailable&&<a className="text-action" href={mapsUrl} target="_blank" rel="noopener noreferrer">Standort auf Google Maps öffnen</a>}</>}</details>;
}
