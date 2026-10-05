"use client";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useEffect} from "react";
import {MessageCircle,ShieldCheck,Star} from "lucide-react";
import type {Workshop} from "@/lib/workshops";
import {workshopMapsUrl} from "@/lib/google-maps-link";
import {useVisibleGooglePlace} from "./use-google-place";
import type {LiveGoogleRating} from "@/lib/google-maps-browser";
import {googleRatingEmptyLabel,type GoogleProfileStatus} from "@/lib/google-workshop-profile";

const decimal=(value:number)=>value.toLocaleString("de-DE",{minimumFractionDigits:1,maximumFractionDigits:1});

export function WorkshopRatings({workshop:w,details=false,hideUnavailable=false,linkGoogle=true,compact=false,liveGoogleRating,onGoogleRating,googleState}:{workshop:Workshop;details?:boolean;hideUnavailable?:boolean;linkGoogle?:boolean;compact?:boolean;liveGoogleRating?:LiveGoogleRating;onGoogleRating?:(id:string,rating:LiveGoogleRating)=>void;googleState?:{live:LiveGoogleRating|null;status:GoogleProfileStatus}}){
 const {ref,live:observed,status:observedStatus}=useVisibleGooglePlace(w.id,true,!googleState);
 const live=googleState?googleState.live:liveGoogleRating??observed,status=googleState?.status??observedStatus;
 useEffect(()=>{if(observed)onGoogleRating?.(w.id,observed);},[w.id,observed,onGoogleRating]);
 const google=live;
 const mapsUrl=google?.mapsUrl??workshopMapsUrl(w);
 const riparimRated=w.rating!==null&&w.count>0;
 const googleAvailable=google?.rating!=null||(google?.count??0)>0;
 if(hideUnavailable&&!riparimRated&&!googleAvailable)return <div ref={ref} className="workshop-ratings-empty" aria-hidden="true"/>;
 return <div ref={ref} className={`workshop-ratings${details?" workshop-ratings-detailed":""}${compact?" workshop-ratings-compact":""}`} aria-label="Bewertungen nach Quelle">
  {(!hideUnavailable||riparimRated)&&<div className="workshop-rating-row riparim-rating"><span className="rating-provider"><ShieldCheck size={15} aria-hidden="true"/>Riparim</span>{riparimRated?<span className="rating-value" aria-label={`${decimal(w.rating!)} von 5 Sternen, ${w.count} Riparim-Bewertungen`}><Star size={14} fill="currentColor" aria-hidden="true"/><strong>{decimal(w.rating!)}</strong><span>{compact?`(${w.count})`:`${w.count} ${w.count===1?"Bewertung":"Bewertungen"}`}</span></span>:<span className="rating-unavailable">{compact?"0 Bewertungen":<><MessageCircle size={14} aria-hidden="true"/>Noch keine Bewertungen</>}</span>}</div>}
  {(!hideUnavailable||googleAvailable)&&<div className="workshop-rating-row google-rating">{linkGoogle?<LocaleAnchor className={`rating-provider${live?" google-maps-attribution":""}`} href={mapsUrl} target="_blank" rel="noopener noreferrer" translate="no" aria-label={`Google Maps: ${w.name}`}>Google Maps</LocaleAnchor>:<span className={`rating-provider${live?" google-maps-attribution":""}`} translate="no">Google Maps</span>}{google?.rating!==null&&google?.rating!==undefined?<span className="rating-value" aria-label={`${decimal(google.rating)} von 5 Sternen auf Google${google.count!==null?`, ${google.count} Bewertungen`:""}`}><Star size={14} fill="currentColor" aria-hidden="true"/><strong>{decimal(google.rating)}</strong>{google.count!==null&&<span>{compact?`(${google.count})`:`${google.count} ${google.count===1?"Bewertung":"Bewertungen"}`}</span>}</span>:<span className="rating-unavailable">{google?.count!=null&&google.count>0?`${google.count} ${google.count===1?"Bewertung":"Bewertungen"}`:googleRatingEmptyLabel(google,status)}</span>}</div>}
  {live?.attributions.map((attribution,index)=><p className="rating-source" key={index}>{attribution.providerURI?<LocaleAnchor href={attribution.providerURI} target="_blank" rel="noopener noreferrer">{attribution.provider}</LocaleAnchor>:attribution.provider}</p>)}
  {details&&<><p className="rating-explanation">Riparim: freigegebene Bewertungen mit geprüftem Besuchsnachweis. Google Maps: aktuelle Sterne und Rezensionen direkt von Google.</p>{live&&<p className="rating-source">Sterne und Anzahl direkt von Google Maps.</p>}{!google&&<p className="rating-explanation">Aktuelle Sterne und Rezensionen direkt auf Google Maps prüfen.</p>}</>}
 </div>;
}
