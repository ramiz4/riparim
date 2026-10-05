"use client";
import {formatNumber} from "@/lib/i18n/format";
import {useI18n} from "@/lib/i18n/client";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useEffect} from "react";
import {MapPin,MessageCircle,ShieldCheck,Star} from "lucide-react";
import type {Workshop} from "@/lib/workshops";
import {workshopMapsUrl} from "@/lib/google-maps-link";
import {useVisibleGooglePlace} from "./use-google-place";
import type {LiveGoogleRating} from "@/lib/google-maps-browser";
import {googleRatingEmptyLabel,type GoogleProfileStatus} from "@/lib/google-workshop-profile";


export function WorkshopRatings({workshop:w,details=false,hideUnavailable=false,linkGoogle=true,compact=false,liveGoogleRating,onGoogleRating,googleState}:{workshop:Workshop;details?:boolean;hideUnavailable?:boolean;linkGoogle?:boolean;compact?:boolean;liveGoogleRating?:LiveGoogleRating;onGoogleRating?:(id:string,rating:LiveGoogleRating)=>void;googleState?:{live:LiveGoogleRating|null;status:GoogleProfileStatus}}){
const {locale,t}=useI18n();const decimal=(value:number)=>formatNumber(locale,value,{minimumFractionDigits:1,maximumFractionDigits:1}); const {ref,live:observed,status:observedStatus}=useVisibleGooglePlace(w.id,true,!googleState);
 const live=googleState?googleState.live:liveGoogleRating??observed,status=googleState?.status??observedStatus;
 useEffect(()=>{if(observed)onGoogleRating?.(w.id,observed);},[w.id,observed,onGoogleRating]);
 const google=live;
 const mapsUrl=google?.mapsUrl??workshopMapsUrl(w);
 const riparimRated=w.rating!==null&&w.count>0;
 const googleAvailable=google?.rating!=null||(google?.count??0)>0;
 if(hideUnavailable&&!riparimRated&&!googleAvailable)return <div ref={ref} className="workshop-ratings-empty" aria-hidden="true"/>;
 return <div ref={ref} className={`workshop-ratings${details?" workshop-ratings-detailed":""}${compact?" workshop-ratings-compact":""}`} aria-label={t("public.ratingSources")}>
  {(!hideUnavailable||riparimRated)&&<div className="workshop-rating-row riparim-rating"><span className="rating-provider"><ShieldCheck size={15} aria-hidden="true"/>Riparim</span>{riparimRated?<span className="rating-value" aria-label={t("public.ratingAria",{rating:decimal(w.rating!),count:w.count})}><Star size={14} fill="currentColor" aria-hidden="true"/><strong>{decimal(w.rating!)}</strong><span>{compact?`(${formatNumber(locale,w.count)})`:t("common.reviewCount",{count:w.count})}</span></span>:<span className="rating-unavailable">{compact?t("common.reviewCount",{count:0}):<><MessageCircle size={14} aria-hidden="true"/>{t("public.noReviews")}</>}</span>}</div>}
  {(!hideUnavailable||googleAvailable)&&<div className="workshop-rating-row google-rating">{linkGoogle?<LocaleAnchor className={`rating-provider${live?" google-maps-attribution":""}`} href={mapsUrl} target="_blank" rel="noopener noreferrer" translate="no" aria-label={`Google Maps: ${w.name}`}><MapPin size={15} aria-hidden="true"/>Google Maps</LocaleAnchor>:<span className={`rating-provider${live?" google-maps-attribution":""}`} translate="no"><MapPin size={15} aria-hidden="true"/>Google Maps</span>}{google?.rating!==null&&google?.rating!==undefined?<span className="rating-value" aria-label={t("public.googleRatingAria",{rating:decimal(google.rating)})+(google.count!==null?`, ${t("common.reviewCount",{count:google.count})}`:"")}><Star size={14} fill="currentColor" aria-hidden="true"/><strong>{decimal(google.rating)}</strong>{google.count!==null&&<span>{compact?`(${formatNumber(locale,google.count)})`:t("common.reviewCount",{count:google.count})}</span>}</span>:<span className="rating-unavailable">{google?.count!=null&&google.count>0?t("common.reviewCount",{count:google.count}):t(googleRatingEmptyLabel(google,status))}</span>}</div>}
  {live?.attributions.map((attribution,index)=><p className="rating-source" key={index}>{attribution.providerURI?<LocaleAnchor href={attribution.providerURI} target="_blank" rel="noopener noreferrer">{attribution.provider}</LocaleAnchor>:attribution.provider}</p>)}
  {details&&<><p className="rating-explanation">{t("public.ratingExplanation")}</p>{live&&<p className="rating-source">{t("public.googleRatingSource")}</p>}{!google&&<p className="rating-explanation">{t("public.googleCheck")}</p>}</>}
 </div>;
}
