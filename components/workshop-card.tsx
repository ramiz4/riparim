"use client";
import {useI18n} from "@/lib/i18n/client";
import {valueLabel} from "@/lib/i18n/values";
import {WorkshopNavigationLink} from "@/components/workshop-navigation-link";
import {MapPin,ArrowUpRight} from "lucide-react";
import {WorkshopRatings} from "@/components/workshop-ratings";
import {workshopDisplayLanguage,type WorkshopDisplayContent} from "@/lib/workshop-profile-content";
import type {Workshop} from "@/lib/workshops";


export function WorkshopCard({workshop:w,selectedBrand="Alle Marken",selectedService="Alle Leistungen",searchHref,distanceKm,distanceOrigin,display,hidden=false,headingLevel=2,variant="default",placementLabel,backgroundImage}:{variant?:"default"|"highlight";placementLabel?:string;backgroundImage?:string;headingLevel?:2|3;display?:WorkshopDisplayContent;workshop:Workshop;selectedBrand?:string;selectedService?:string;searchHref?:string;distanceKm?:number|null;distanceOrigin?:string;hidden?:boolean}){
 const {locale,t}=useI18n();
 const Heading=headingLevel===3?"h3":"h2";
 const profileHref=`/werkstatt/${encodeURIComponent(w.id)}${searchHref?`?${new URLSearchParams({suche:searchHref})}`:""}`;
 const details=w.services.length?[...w.services].sort((a,b)=>Number(b===selectedService)-Number(a===selectedService)).slice(0,3):w.serviceDetails.filter(detail=>detail.length<=50).slice(0,3);
 const shownBrands=[...w.brands].sort((a,b)=>Number(b===selectedBrand)-Number(a===selectedBrand)).slice(0,2);
 if(variant==="highlight")return <article className="catalogue-card partner-card" hidden={hidden}>
  {backgroundImage&&<div className="partner-card-background" style={{backgroundImage:`url("${backgroundImage}")`}} aria-hidden="true"/>}
  {placementLabel&&<span className="partner-label">{placementLabel}</span>}
  <div className="partner-card-heading"><Heading><WorkshopNavigationLink className="partner-card-target" href={profileHref} aria-label={t("public.viewProfile",{name:w.name})} onFocus={event=>event.currentTarget.closest("article")?.scrollIntoView({block:"nearest",inline:"nearest"})}>{w.name}</WorkshopNavigationLink></Heading>{details[0]&&<p className="partner-card-service" lang={w.services.includes(details[0])?undefined:workshopDisplayLanguage(display,locale)}>{w.services.includes(details[0])?valueLabel(locale,"service",details[0]):display?.serviceDetails[w.serviceDetails.indexOf(details[0])]??details[0]}</p>}</div>
  <div className="partner-card-footer"><div><p className="partner-card-place"><MapPin size={16} aria-hidden="true"/>{w.city}</p><WorkshopRatings workshop={w} hideUnavailable showGoogle={false} compact/></div><span className="partner-card-open" aria-hidden="true"><ArrowUpRight size={24}/></span></div>
  {backgroundImage&&<span className="partner-card-image-note">{t("public.partnerImageNote")}</span>}
  {display?.fallback&&<p className="help workshop-translation-notice">{t("public.translationFallback")}</p>}
 </article>;
 return <article className="catalogue-card" hidden={hidden}><div className="catalogue-card-link">
  <div className="catalogue-card-heading"><Heading><WorkshopNavigationLink className="catalogue-card-target" href={profileHref} aria-label={t("public.viewProfile",{name:w.name})}>{w.name}</WorkshopNavigationLink></Heading><p className="catalogue-card-place"><MapPin size={16} aria-hidden="true"/>{w.city}{distanceKm!=null&&<span className="catalogue-card-distance" title={t("public.distanceTitle",{city:distanceOrigin??w.city})}>{t("public.approxDistance",{distance:distanceKm})}</span>}</p></div>
  <WorkshopRatings workshop={w} hideUnavailable/>
  {details.length>0&&<div className="catalogue-card-services">{details.map(detail=><span lang={w.services.includes(detail)?undefined:workshopDisplayLanguage(display,locale)} className={detail===selectedService?"selected-service":undefined} key={detail}>{w.services.includes(detail)?valueLabel(locale,"service",detail):display?.serviceDetails[w.serviceDetails.indexOf(detail)]??detail}</span>)}</div>}{shownBrands.length>0&&<div className="catalogue-card-brands">{shownBrands.map(brand=><span key={brand}>{valueLabel(locale,"sentinel",brand)}</span>)}</div>}
  {display?.fallback&&<p className="help workshop-translation-notice">{t("public.translationFallback")}</p>}
 </div></article>;
}
