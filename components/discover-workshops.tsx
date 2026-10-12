"use client";
import {useEffect,useState} from "react";
import {useI18n} from "@/lib/i18n/client";
import {defaultCatalogueFilters,orderedCatalogue} from "@/lib/catalogue-filters";
import {WorkshopCard} from "./workshop-card";
import {WorkshopNavigationLink} from "./workshop-navigation-link";
import {LoadingIndicator} from "./loading-indicator";
import type {Workshop} from "@/lib/workshops";
import type {WorkshopDisplayById} from "@/lib/workshop-profile-content";
import type {Locale} from "@/lib/i18n/locale";

type View={locale:Locale;status:"loading"|"ready"|"error";workshops:Workshop[];displayById:WorkshopDisplayById};
export function DiscoverWorkshops(){
 const {locale,t}=useI18n();
 const [view,setView]=useState<View>({locale,status:"loading",workshops:[],displayById:{}}),[attempt,setAttempt]=useState(0);
 const status=view.locale===locale?view.status:"loading";
 useEffect(()=>{
  const controller=new AbortController();
  void fetch(`/api/workshops?locale=${locale}`,{cache:"no-store",signal:controller.signal}).then(async response=>{
   const data=await response.json() as {workshops?:Workshop[];displayById?:WorkshopDisplayById};
   if(!response.ok||!Array.isArray(data.workshops))throw Error("Directory unavailable");
   if(!controller.signal.aborted)setView({locale,status:"ready",workshops:orderedCatalogue(data.workshops,defaultCatalogueFilters,locale).slice(0,3),displayById:data.displayById??{}});
  }).catch(()=>{if(!controller.signal.aborted)setView({locale,status:"error",workshops:[],displayById:{}});});
  return()=>controller.abort();
 },[locale,attempt]);
 function retry(){setView({locale,status:"loading",workshops:[],displayById:{}});setAttempt(value=>value+1);}
 return <section className="discover-section wrap" aria-labelledby="discover-title"><div className="discover-heading"><div><h2 id="discover-title">{t("public.discoverTitle")}</h2><p>{t("public.discoverHelp")}</p></div><WorkshopNavigationLink className="outline discover-all" href="/werkstaetten">{t("public.discoverAll")}</WorkshopNavigationLink></div>
  {status==="loading"?<LoadingIndicator label={t("public.loadingWorkshops")}/>:status==="error"?<div className="discover-message" role="alert"><p>{t("public.directoryUnavailable")}</p><button type="button" className="outline" onClick={retry}>{t("public.reload")}</button></div>:view.workshops.length===0?<div className="discover-message"><p>{t("public.directoryEmpty")}</p><p>{t("public.directoryEmptyHelp")}</p></div>:<div className="catalogue-grid discover-grid">{view.workshops.map(workshop=><WorkshopCard headingLevel={3} key={workshop.id} workshop={workshop} display={view.displayById[workshop.id]}/>)}</div>}
 </section>;
}
