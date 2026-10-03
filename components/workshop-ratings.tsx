"use client";
import {useEffect} from "react";
import {MessageCircle,ShieldCheck,Star} from "lucide-react";
import type {Workshop} from "@/lib/workshops";
import {useVisibleGooglePlace} from "./use-google-place";
import type {LiveGoogleRating} from "@/lib/google-maps-browser";

const decimal=(value:number)=>value.toLocaleString("de-DE",{minimumFractionDigits:1,maximumFractionDigits:1});
const date=(value:string)=>new Date(value.length===10?value+"T12:00:00":value).toLocaleDateString("de-DE");

export function WorkshopRatings({workshop:w,details=false,hideUnavailable=false,linkGoogle=true,compact=false,liveGoogleRating,onGoogleRating}:{workshop:Workshop;details?:boolean;hideUnavailable?:boolean;linkGoogle?:boolean;compact?:boolean;liveGoogleRating?:LiveGoogleRating;onGoogleRating?:(id:string,rating:LiveGoogleRating)=>void}){
 const {ref,live:observed,status}=useVisibleGooglePlace(w.id);
 const live=liveGoogleRating??observed;
 useEffect(()=>{if(observed)onGoogleRating?.(w.id,observed);},[w.id,observed,onGoogleRating]);
 const snapshot=w.googleRating;
 const google=live??snapshot;
 const mapsUrl=google?.mapsUrl??`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${w.name} ${w.address} Kosovo`)}`;
 const riparimRated=w.rating!==null&&w.count>0;
 const googleAvailable=google?.rating!=null||(google?.count??0)>0;
 if(hideUnavailable&&!riparimRated&&!googleAvailable)return <div ref={ref} className="workshop-ratings-empty" aria-hidden="true"/>;
 return <div ref={ref} className={`workshop-ratings${details?" workshop-ratings-detailed":""}${compact?" workshop-ratings-compact":""}`} aria-label="Bewertungen nach Quelle">
  {(!hideUnavailable||riparimRated)&&<div className="workshop-rating-row riparim-rating"><span className="rating-provider"><ShieldCheck size={15} aria-hidden="true"/>Riparim</span>{riparimRated?<span className="rating-value" aria-label={`${decimal(w.rating!)} von 5 Sternen, ${w.count} Riparim-Bewertungen`}><Star size={14} fill="currentColor" aria-hidden="true"/><strong>{decimal(w.rating!)}</strong><span>{compact?`(${w.count})`:`${w.count} ${w.count===1?"Bewertung":"Bewertungen"}`}</span></span>:<span className="rating-unavailable">{compact?"0 Bewertungen":<><MessageCircle size={14} aria-hidden="true"/>Noch keine Bewertungen</>}</span>}</div>}
  {(!hideUnavailable||googleAvailable)&&<div className="workshop-rating-row google-rating">{linkGoogle?<a className={`rating-provider${live?" google-maps-attribution":""}`} href={mapsUrl} target="_blank" rel="noopener noreferrer" translate="no" aria-label={`Google Maps: ${w.name}`}>{live?"Google Maps":"Google"}</a>:<span className={`rating-provider${live?" google-maps-attribution":""}`} translate="no">{live?"Google Maps":"Google"}</span>}{google?.rating!==null&&google?.rating!==undefined?<span className="rating-value" aria-label={`${decimal(google.rating)} von 5 Sternen auf Google${google.count!==null?`, ${google.count} Bewertungen`:""}`}><Star size={14} fill="currentColor" aria-hidden="true"/><strong>{decimal(google.rating)}</strong>{google.count!==null&&<span>{compact?`(${google.count})`:`${google.count} ${google.count===1?"Bewertung":"Bewertungen"}`}</span>}</span>:<span className="rating-unavailable">{google?.count!=null&&google.count>0?`${google.count} ${google.count===1?"Bewertung":"Bewertungen"}`:status==="loading"?"Wird geladen …":"Bewertung nicht verfügbar"}</span>}</div>}
  {live?.attributions.map((attribution,index)=><p className="rating-source" key={index}>{attribution.providerURI?<a href={attribution.providerURI} target="_blank" rel="noopener noreferrer">{attribution.provider}</a>:attribution.provider}</p>)}
  {details&&<><p className="rating-explanation">Riparim: freigegebene Bewertungen mit geprüftem Besuchsnachweis. Google: separat erfasste öffentliche Angaben.</p>{live?<p className="rating-source">Sterne und Anzahl direkt von Google Maps.</p>:snapshot?.sourceUrl&&<p className="rating-source"><a href={snapshot.sourceUrl} target="_blank" rel="noopener noreferrer">{snapshot.sourceLabel??"Quelle der Google-Angaben"}</a>{snapshot.sourceUpdatedAt?` · Quellenstand ${date(snapshot.sourceUpdatedAt)}`:""} · Abgerufen {date(snapshot.checkedAt)}{snapshot.rating!==null&&snapshot.count===null?" · Anzahl nicht veröffentlicht":""}</p>}{(!google||google.rating===null)&&<p className="rating-explanation">Aktuelle Sterne und Rezensionen direkt auf Google Maps prüfen.</p>}</>}
 </div>;
}
