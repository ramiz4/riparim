"use client";
import {useI18n} from "@/lib/i18n/client";
import {valueLabel} from "@/lib/i18n/values";
import {WorkshopNavigationLink} from "@/components/workshop-navigation-link";
import {MapPin} from "lucide-react";
import {WorkshopRatings} from "@/components/workshop-ratings";
import type {WorkshopDisplayContent} from "@/lib/workshop-profile-content";
import type {Workshop} from "@/lib/workshops";
import type {LiveGoogleRating} from "@/lib/google-maps-browser";


export function WorkshopCard({workshop:w,selectedBrand="Alle Marken",selectedService="Alle Leistungen",searchHref,distanceKm,distanceOrigin,liveGoogleRating,onGoogleRating,display}:{display?:WorkshopDisplayContent;workshop:Workshop;selectedBrand?:string;selectedService?:string;searchHref?:string;distanceKm?:number|null;distanceOrigin?:string;liveGoogleRating?:LiveGoogleRating;onGoogleRating?:(id:string,rating:LiveGoogleRating)=>void}){
 const {locale,t}=useI18n();
 const profileHref=`/werkstatt/${encodeURIComponent(w.id)}${searchHref?`?${new URLSearchParams({suche:searchHref})}`:""}`;
 const details=w.services.length?[...w.services].sort((a,b)=>Number(b===selectedService)-Number(a===selectedService)).slice(0,3):w.serviceDetails.filter(detail=>detail.length<=50).slice(0,3);
 const shownBrands=[...w.brands].sort((a,b)=>Number(b===selectedBrand)-Number(a===selectedBrand)).slice(0,2);
 return <article className="catalogue-card"><div className="catalogue-card-link">
  <div className="catalogue-card-heading"><h2><WorkshopNavigationLink className="catalogue-card-target" href={profileHref} aria-label={t("public.viewProfile",{name:w.name})}>{w.name}</WorkshopNavigationLink></h2><p className="catalogue-card-place"><MapPin size={16} aria-hidden="true"/>{w.city}{distanceKm!=null&&<span className="catalogue-card-distance" title={t("public.distanceTitle",{city:distanceOrigin??w.city})}>{t("public.approxDistance",{distance:distanceKm})}</span>}</p></div>
  <WorkshopRatings workshop={w} hideUnavailable linkGoogle={false} liveGoogleRating={liveGoogleRating} onGoogleRating={onGoogleRating}/>
  {details.length>0&&<div className="catalogue-card-services">{details.map(detail=><span className={detail===selectedService?"selected-service":undefined} key={detail}>{w.services.includes(detail)?valueLabel(locale,"service",detail):display?.serviceDetails[w.serviceDetails.indexOf(detail)]??detail}</span>)}</div>}{shownBrands.length>0&&<div className="catalogue-card-brands">{shownBrands.map(brand=><span key={brand}>{valueLabel(locale,"sentinel",brand)}</span>)}</div>}
 </div></article>;
}
