"use client";
import {useI18n} from "@/lib/i18n/client";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useRouter} from "next/navigation";
import {useState,useEffect,useCallback,useId} from "react";
import {Wrench,MapPin,Search,ShieldCheck,CarFront,ArrowRight} from "lucide-react";
import "./landing.css";
import {SiteHeader} from "@/components/site-header";
import {Picker} from "@/components/picker";
import {DirectoryFooter} from "@/components/directory-footer";
import {useDirectoryAccountActions} from "@/components/directory-account-actions";
import type {AccountIdentity} from "@/components/account-storage-notice";
import {DetailSearch,type SearchContext} from "./journeys";
import {catalogueHref,defaultCatalogueFilters,matchCatalogue} from "@/lib/catalogue-filters";
import {readSearchSession,rememberSearchSession,deactivatePrivateMatching} from "@/lib/search-session";
import {cities,services,type Workshop} from "@/lib/workshops";

type Props={initialWorkshops:Workshop[];initialError:string;signedIn:boolean;account:AccountIdentity|null;isAdmin:boolean};
export default function Finder({initialWorkshops,initialError,signedIn,account,isAdmin}:Props){
 const {locale}=useI18n();
 const router=useRouter(),id=useId();const [directory,setDirectory]=useState(initialWorkshops),[directoryReady,setDirectoryReady]=useState(!initialError),[service,setService]=useState(services[0]),[city,setCity]=useState(cities[0]),[detailed,setDetailed]=useState(false),[context,setContext]=useState<SearchContext|null>(null),[info,setInfo]=useState(false);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- A new landing entry preserves only the private RAM draft, never prior results.
 useEffect(()=>{setContext(readSearchSession()?.context??null);deactivatePrivateMatching();},[]);
 const refresh=useCallback(async()=>{try{const response=await fetch("/api/workshops"),data=await response.json() as {workshops:Workshop[]};if(response.ok){setDirectory(data.workshops.filter(w=>w.status==="published"));setDirectoryReady(true);}}catch{/* The landing entry has no result list to replace with a false empty state. */}},[]);
 const personal=useDirectoryAccountActions({directory,signedIn,account,onRefresh:()=>void refresh(),observePrivateQuery:true});
 function navigateQuick(nextService=service,nextCity=city){const filters={...defaultCatalogueFilters,service:nextService,city:nextCity},href=catalogueHref(filters,locale);rememberSearchSession({...filters,searched:true,context:readSearchSession()?.context??context,privateMatchingActive:false,catalogueHref:href,visibleCount:12,scrollY:0});router.push(href);}
 function applyContext(value:SearchContext){const filters={...defaultCatalogueFilters,service:value.service,city:value.city,brand:value.brand},href=catalogueHref(filters,locale);rememberSearchSession({...filters,searched:true,context:value,privateMatchingActive:true,catalogueHref:href,visibleCount:12,scrollY:0});router.push(href);}
 useEffect(()=>{const mc=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>Promise<void>|void}}).modelContext;if(!mc?.registerTool)return;const lifecycle=new AbortController();void Promise.resolve(mc.registerTool({name:"configure_workshop_search",title:"Werkstattsuche einstellen",description:"Open the published Kosovo workshop catalogue with service and city filters. Does not contact a business, send a message, or book a repair.",inputSchema:{type:"object",properties:{service:{type:"string",enum:services},city:{type:"string",enum:cities}},required:["service","city"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input:unknown){if(!directoryReady)throw Error("Workshop directory is currently unavailable");if(!input||typeof input!=="object")throw Error("Expected search filters");const value=input as {service:string;city:string};if(!services.includes(value.service)||!cities.includes(value.city)||Object.keys(value).some(key=>!["service","city"].includes(key)))throw Error("Invalid service or city");const filters={...defaultCatalogueFilters,service:value.service,city:value.city},href=catalogueHref(filters,locale);rememberSearchSession({...filters,searched:true,context:readSearchSession()?.context??null,privateMatchingActive:false,catalogueHref:href,visibleCount:12,scrollY:0});router.push(href);return {workshops:matchCatalogue(directory,filters).map(w=>({id:w.id,name:w.name,city:w.city,reviewCount:w.count}))};}},{signal:lifecycle.signal})).catch(error=>console.warn("WebMCP registration",error));return()=>lifecycle.abort();},[directory,directoryReady,router,locale]);
 return <><SiteHeader account={account} isAdmin={isAdmin} onVisits={personal.onVisits} onNewVisit={personal.onNewVisit}/><main className="landing-page">
 <section className="landing-hero" aria-labelledby="hero-title">
  <img className="landing-hero-image" src="/workshop.jpg" width={1536} height={1024} fetchPriority="high" alt="" aria-hidden="true"/>
  <div className="landing-hero-shade" aria-hidden="true"/>
  <div className="landing-hero-content wrap">
   <h1 id="hero-title">Dein Auto.<span>Deine Werkstatt.</span></h1>
   <p>Finde die passende Werkstatt in Kosovo.</p>
   <LocaleAnchor className="landing-hero-cta" href="#suche">Werkstatt finden<ArrowRight size={25} aria-hidden="true"/></LocaleAnchor>
  </div>
 </section>
 <div className="search-band"><section id="suche" className="search-section wrap" aria-label="Werkstattsuche" tabIndex={-1}><div className="search-tabs"><span className="search-tab active"><Search size={17}/>Schnellsuche</span><button onClick={()=>setDetailed(true)}><CarFront size={18}/>Mit Fahrzeug & Problem</button></div><form className="search-box" onSubmit={event=>{event.preventDefault();navigateQuick();}}><label htmlFor={`${id}-service`}><span><Wrench size={16}/>Leistung</span><Picker id={`${id}-service`} value={service} onChange={setService} values={services} valueCategory="service" label="Leistung"/></label><label htmlFor={`${id}-city`}><span><MapPin size={16}/>Ort</span><Picker id={`${id}-city`} value={city} onChange={setCity} values={cities} label="Ort"/></label><button type="submit" className="primary search-button"><Search size={18}/>Werkstätten finden</button></form></section></div>
 <section id="so-gehts" className="trust-section wrap" aria-labelledby="trust-title"><figure className="trust-visual"><img src="/diagnostics.jpg" width="1536" height="1024" loading="lazy" alt="Symbolbild: Mechaniker prüft ein Fahrzeug mit einem Diagnosegerät"/></figure><div className="trust-content"><div className="trust-title"><span className="hero-kicker"><ShieldCheck size={16}/> Geprüfte Bewertungen</span><h2 id="trust-title">Finden. Kontaktieren. Bewerten.</h2></div><div className="trust-steps"><div><span>1</span><div><h3>Werkstatt auswählen</h3><p>Leistung, Standort und Erfahrungen vergleichen.</p></div></div><div><span>2</span><div><h3>Direkt Kontakt aufnehmen</h3><p>Arbeit, Kosten und Termin persönlich klären.</p></div></div><div><span>3</span><div><h3>Nach dem Besuch bewerten</h3><p>Bewertung und Nachweis einreichen. Nach Freigabe sichtbar.</p></div></div></div></div></section>
 </main><DirectoryFooter open={info} onOpenChange={setInfo}/><DetailSearch open={detailed} onClose={()=>setDetailed(false)} onSearch={applyContext} initialContext={context}/>{personal.dialogs}</>;
}
