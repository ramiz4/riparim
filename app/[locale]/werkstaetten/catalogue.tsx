"use client";
import {isErrorCode} from "@/lib/i18n/codes";
import {publicDataError} from "@/lib/i18n/public-errors";
import {formatNumber} from "@/lib/i18n/format";
import {useI18n} from "@/lib/i18n/client";
import {useCallback,useEffect,useId,useLayoutEffect,useRef,useState} from "react";
import {Filter,RefreshCw,Search} from "lucide-react";
import {LoadingIndicator} from "@/components/loading-indicator";
import {SiteHeader} from "@/components/site-header";
import {DirectoryFooter} from "@/components/directory-footer";
import {CatalogueFilterFields} from "@/components/catalogue-filter-fields";
import {WorkshopCard} from "@/components/workshop-card";
import {Picker} from "@/components/picker";
import {Input} from "@/components/ui/input";
import {Dialog,DialogTrigger} from "@/components/ui/dialog";
import {ModalContent} from "@/components/modal-shell";
import {activeCatalogueFilters,catalogueValues,catalogueChoiceLabel,type CatalogueChoice,catalogueHref,defaultCatalogueFilters,hasPublishedRatings,hasCatalogueDistances,catalogueDistance,matchCatalogue,orderedCatalogue,parseCatalogueFilters,type CatalogueFilters} from "@/lib/catalogue-filters";
import {readSearchSession,rememberSearchSession} from "@/lib/search-session";
import {cities,services,type Workshop} from "@/lib/workshops";
import type {WorkshopDisplayById} from "@/lib/workshop-profile-content";
import type {AccountIdentity} from "@/components/account-storage-notice";

type Props={publicSnapshot?:boolean;reviewEntry?:boolean;initialDisplayById?:WorkshopDisplayById;initialWorkshops:Workshop[];initialError:string;initialFilters:CatalogueFilters;account:AccountIdentity|null;isAdmin:boolean};
function SortControl({id,filters,onChange,ratingAvailable,distanceAvailable}:{id:string;filters:CatalogueFilters;onChange:(sort:CatalogueFilters["sort"])=>void;ratingAvailable:boolean;distanceAvailable:boolean}){
 const {t}=useI18n();
 const disabledValues=[...(ratingAvailable?[]:["rating"]),...(distanceAvailable?[]:["distance"])];
 return <div className="catalogue-sort"><label htmlFor={id}>{t("public.sort")}</label><Picker id={id} value={filters.sort} onChange={value=>onChange(value as CatalogueFilters["sort"])} values={["name","rating","distance"]} displayLabels={{name:t("public.sortName"),rating:t("public.sortRiparim"),distance:distanceAvailable?t("public.sortDistance"):catalogueValues(filters.city).length>1?t("public.sortSingleCity"):filters.city===defaultCatalogueFilters.city?t("public.sortChooseCity"):t("public.sortNoLocation")}} disabledValues={disabledValues} label={t("public.sort")}/></div>;
}

export default function Catalogue({publicSnapshot=false,reviewEntry=false,initialDisplayById={},initialWorkshops,initialError,initialFilters,account,isAdmin}:Props){
 const {locale,t}=useI18n();
 const [displayById,setDisplayById]=useState(initialDisplayById);
 const [directory,setDirectory]=useState(initialWorkshops),[filters,setFilters]=useState(initialFilters),[draft,setDraft]=useState(initialFilters),[ready,setReady]=useState(!initialError&&!(publicSnapshot&&initialWorkshops.length===0)),[error,setError]=useState(initialError),[refreshing,setRefreshing]=useState(false),[visibleCount,setVisibleCount]=useState(12),[hydrated,setHydrated]=useState(false),[filterOpen,setFilterOpen]=useState(false);
 const nameSearch=useRef<HTMLInputElement>(null),filterButton=useRef<HTMLButtonElement>(null),resultsHeading=useRef<HTMLParagraphElement>(null),restoreScroll=useRef<number|null>(null),searchSentinel=useRef<HTMLDivElement>(null),sortId=useId();
 const [searchDocked,setSearchDocked]=useState(false);
 const [retainedCards,setRetainedCards]=useState<{key:string;ids:string[]}>({key:"",ids:[]});
 const resultsGrid=useRef<HTMLDivElement>(null),firstNewResult=useRef<number|null>(null);
 useLayoutEffect(()=>{
  if(firstNewResult.current===null)return;
  const index=firstNewResult.current;firstNewResult.current=null;
  resultsGrid.current?.querySelectorAll<HTMLAnchorElement>(".catalogue-card:not([hidden]) .catalogue-card-target")[index]?.focus();
 },[visibleCount]);
 const matches=matchCatalogue(directory,filters,locale),chips=activeCatalogueFilters(filters),ratingAvailable=hasPublishedRatings(directory);
 const mobileFilterCount=chips.filter(key=>key!=="query"&&key!=="language").reduce((count,key)=>count+catalogueValues(filters[key]).length,0);
 const draftMatches=matchCatalogue(directory,draft,locale);
 const orderedDirectory=orderedCatalogue(directory,filters,locale),visibleMatches=matches.slice(0,visibleCount),visibleIds=new Set(visibleMatches.map(w=>w.id));
 // Keep already mounted cards connected across filtering; only IDs stay in local view state, never provider content.
 // A changed ordering starts a fresh view so keyboard order always follows the displayed order.
 const retainedKey=`${locale}:${filters.sort}:${filters.sort==="distance"?filters.city:""}:${orderedDirectory.map(w=>w.id).join(",")}`;
 if(retainedCards.key!==retainedKey)setRetainedCards({key:retainedKey,ids:[...visibleIds]});
 else if(visibleMatches.some(w=>!retainedCards.ids.includes(w.id)))setRetainedCards({key:retainedKey,ids:[...new Set([...retainedCards.ids,...visibleIds])]});
 const renderedIds=new Set(retainedCards.key===retainedKey?retainedCards.ids:visibleIds);

 const distanceAvailable=hasCatalogueDistances(matches,filters.city);
 useEffect(()=>{
  const sentinel=searchSentinel.current;if(!sentinel)return;
  let observer:IntersectionObserver|null=null;
  const update=()=>{
   observer?.disconnect();observer=null;
   if(!window.matchMedia("(max-width: 1000px)").matches)setFilterOpen(false);
   if(!window.matchMedia("(max-width: 1000px) and (min-height: 601px)").matches){setSearchDocked(false);return;}
   const headerHeight=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--site-header-height"));
   setSearchDocked(sentinel.getBoundingClientRect().top<headerHeight);
   observer=new IntersectionObserver(([entry])=>setSearchDocked(!entry.isIntersecting&&entry.boundingClientRect.top<headerHeight),{root:document,rootMargin:`-${headerHeight}px 0px 0px 0px`,threshold:0});
   observer.observe(sentinel);
  };
  update();window.addEventListener("resize",update);
  return()=>{observer?.disconnect();window.removeEventListener("resize",update);};
 },[]);
 const refresh=useCallback(async()=>{setRefreshing(true);setError("");try{const response=await fetch(`/api/workshops?locale=${locale}`),data=await response.json() as {workshops:Workshop[];displayById?:WorkshopDisplayById;errorCode?:string};if(!response.ok){setError(isErrorCode(data.errorCode)?data.errorCode:"unknown");return;}const records=data.workshops.filter(w=>w.status==="published");setDirectory(records);setDisplayById(data.displayById??{});setFilters(parseCatalogueFilters(new URLSearchParams(window.location.search),records));setReady(true);}catch{setError("unavailable");}finally{setRefreshing(false);}},[locale]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Refresh the released snapshot against the live external directory after hydration.
 useEffect(()=>{if(publicSnapshot)void refresh();},[publicSnapshot,refresh]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Paging and scroll are restored after hydration, never from server props.
 useEffect(()=>{const saved=readSearchSession();const actualFilters=publicSnapshot?parseCatalogueFilters(new URLSearchParams(window.location.search),initialWorkshops):initialFilters;setFilters(actualFilters);setVisibleCount(12);if(saved&&saved.catalogueHref===catalogueHref(actualFilters,locale)){setVisibleCount(Math.max(12,saved.visibleCount));restoreScroll.current=saved.scrollY;}setHydrated(true);},[initialFilters,initialWorkshops,publicSnapshot,locale]);
 useEffect(()=>{if(!hydrated)return;const persist=()=>rememberSearchSession({catalogueHref:catalogueHref(filters,locale),visibleCount,scrollY:window.scrollY});persist();window.addEventListener("scroll",persist,{passive:true});return()=>window.removeEventListener("scroll",persist);},[hydrated,filters,visibleCount,locale]);
 useEffect(()=>{if(!hydrated||restoreScroll.current===null)return;const y=restoreScroll.current;restoreScroll.current=null;const frame=requestAnimationFrame(()=>window.scrollTo({top:y,behavior:"auto"}));return()=>cancelAnimationFrame(frame);},[hydrated,visibleCount]);
 useEffect(()=>{if(!hydrated)return;const sync=()=>{const next=parseCatalogueFilters(new URLSearchParams(window.location.search),directory);setFilters(next);setVisibleCount(12);};window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);},[hydrated,directory]);
 useEffect(()=>{if(hydrated&&ready){const href=catalogueHref(filters,locale);window.history.replaceState(window.history.state,"",reviewEntry?`${href}${href.includes("?")?"&":"?"}bewerten=1`:href);}},[hydrated,ready,filters,locale,reviewEntry]);
 useEffect(()=>{const mc=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>Promise<void>|void}}).modelContext;if(!mc?.registerTool)return;const lifecycle=new AbortController();void Promise.resolve(mc.registerTool({name:"configure_workshop_search",title:t("public.searchToolTitle"),description:t("public.searchToolDescription"),inputSchema:{type:"object",properties:{service:{type:"string",enum:services},city:{type:"string",enum:cities}},required:["service","city"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input:unknown){if(!ready)throw Error(t("public.directoryUnavailable"));if(!input||typeof input!=="object")throw Error(t("common.invalidRequest"));const value=input as {service:string;city:string};if(!services.includes(value.service)||!cities.includes(value.city)||Object.keys(value).some(key=>!["service","city"].includes(key)))throw Error(t("common.invalidRequest"));const next={...defaultCatalogueFilters,service:value.service,city:value.city};setFilters(next);setVisibleCount(12);window.history.replaceState(window.history.state,"",catalogueHref(next,locale));return {workshops:matchCatalogue(directory,next).map(w=>({id:w.id,name:w.name,city:w.city,reviewCount:w.count}))};}},{signal:lifecycle.signal})).catch(error=>console.warn("WebMCP registration",error));return()=>lifecycle.abort();},[directory,ready,locale,t]);
 function commit(next:CatalogueFilters){const value=next.sort==="distance"&&!hasCatalogueDistances(directory,next.city)?{...next,sort:"name" as const}:next;setFilters(value);setVisibleCount(12);window.history.replaceState(window.history.state,"",catalogueHref(value,locale));}
 function change(field:"query"|"service"|"city"|"brand"|"language",value:CatalogueChoice){if((field==="query"||field==="language")&&Array.isArray(value))return;commit({...filters,[field]:value});}
 function reset(){commit({...defaultCatalogueFilters,sort:filters.sort});}
 function showMore(){firstNewResult.current=visibleCount;setVisibleCount(count=>count+12);}
 function applyDraft(){commit(draft);setFilterOpen(false);requestAnimationFrame(()=>{filterButton.current?.focus({preventScroll:true});resultsHeading.current?.scrollIntoView({block:"start",behavior:"auto"});});}

 return <><SiteHeader account={account} isAdmin={isAdmin} publicSnapshot={publicSnapshot}/><main className="catalogue-page wrap">
  {(reviewEntry||(publicSnapshot&&hydrated&&new URLSearchParams(window.location.search).get("bewerten")==="1"))&&<p className="note" role="status">{t("public.reviewEntryHelp")}</p>}
  <header className="catalogue-heading"><div><h1>{t("public.workshops")}</h1></div></header>
  <div className="catalogue-search-sentinel" ref={searchSentinel} aria-hidden="true"/>
  <div className="catalogue-layout"><Dialog open={filterOpen} onOpenChange={setFilterOpen}><section className="catalogue-search-panel" data-docked={searchDocked} aria-label={t("public.searchWorkshops")}>
   <div className="catalogue-name-search"><label htmlFor={`${sortId}-name`}>{t("public.workshopName")}</label><div><Search size={18} aria-hidden="true"/><Input ref={nameSearch} id={`${sortId}-name`} type="search" maxLength={100} autoComplete="off" placeholder={t("public.searchPlaceholder")} value={filters.query} onChange={event=>change("query",event.target.value)}/></div></div>
   <CatalogueFilterFields filters={filters} onChange={change} directory={directory} fields={["city","service","brand"]}/>
   <DialogTrigger asChild><button className="outline catalogue-filter-button" ref={filterButton} aria-label={mobileFilterCount>0?t("public.activeFilterCount",{count:mobileFilterCount}):t("public.filter")} onClick={()=>setDraft({...filters})}><Filter size={18} aria-hidden="true"/><span className="catalogue-filter-label-desktop">{t("public.moreFilters")}</span><span className="catalogue-filter-label-mobile">{t("public.filter")}</span>{mobileFilterCount>0&&<span className="catalogue-filter-badge">{formatNumber(locale,mobileFilterCount)}</span>}</button></DialogTrigger>
   <button className="catalogue-reset catalogue-sidebar-reset" onClick={reset}>{t("public.resetAll")}</button>
  </section><ModalContent onCloseAutoFocus={event=>{if(!window.matchMedia("(max-width: 1000px)").matches){event.preventDefault();nameSearch.current?.focus({preventScroll:true});}}} className="catalogue-filter-dialog" title={t("public.filter")} description={t("public.drawerFilterHelp")} footer={<><button className="outline" onClick={()=>setDraft(old=>({...old,city:defaultCatalogueFilters.city,service:defaultCatalogueFilters.service,brand:defaultCatalogueFilters.brand,language:defaultCatalogueFilters.language}))}>{t("public.reset")}</button><button className="primary" onClick={applyDraft}>{t("public.showResults")}{ready?` (${formatNumber(locale,draftMatches.length)})`:""}</button></>}><CatalogueFilterFields filters={draft} onChange={(field,value)=>setDraft(old=>({...old,[field]:value}))} directory={directory} fields={["city","service","brand"]}/>{ready&&draftMatches.length===0&&<p className="catalogue-draft-empty">{t("public.draftEmpty")}</p>}</ModalContent></Dialog>
  <div className="catalogue-results">
  {!ready?error?<div className="catalogue-load-error" role="alert"><h2>{publicDataError(t,error,"directory")}</h2><p>{t("public.retryHelp")}</p><button className="primary" disabled={refreshing} onClick={()=>void refresh()}><RefreshCw size={16}/>{refreshing?t("public.loading"):t("public.reload")}</button></div>:<LoadingIndicator className="review-loading" label={t("public.loadingWorkshops")}/>:<>
   <div className="catalogue-results-toolbar"><p className="catalogue-result-count" ref={resultsHeading} role="status" aria-live="polite" aria-atomic="true">{t("public.workshopCount",{count:matches.length})}</p><div className="catalogue-panel-sort"><SortControl id={`${sortId}-results-sort`} filters={filters} onChange={sort=>commit({...filters,sort})} ratingAvailable={ratingAvailable} distanceAvailable={distanceAvailable}/></div>{refreshing&&<LoadingIndicator className="catalogue-refreshing" label={t("public.updating")}/>}</div>
   {filters.sort==="distance"&&<p className="catalogue-distance-note">{t("public.distanceNote",{city:catalogueChoiceLabel(filters.city)})}</p>}
   {error&&<div className="error catalogue-refresh-error" role="alert">{t("public.refreshFailed")}<button disabled={refreshing} onClick={()=>void refresh()}>{t("public.reload")}</button></div>}
   {directory.length===0?<div className="empty catalogue-empty"><Search size={27}/><h2>{t("public.directoryEmpty")}</h2><p>{t("public.directoryEmptyHelp")}</p></div>:<>{matches.length===0&&<div className="empty catalogue-empty"><Search size={27}/><h2>{filters.query?t("public.noNameMatch"):t("public.noMatch")}</h2><p>{filters.language!==defaultCatalogueFilters.language?t("public.noLanguageMatch"):t("public.changeFilter")}</p><div>{filters.language!==defaultCatalogueFilters.language&&<button className="primary" onClick={()=>change("language",defaultCatalogueFilters.language)}>{t("public.removeLanguage")}</button>}<button className="outline" onClick={reset}>{t("public.resetAll")}</button></div></div>}<div key="results" className="catalogue-grid" ref={resultsGrid} hidden={matches.length===0}>{orderedDirectory.filter(workshop=>renderedIds.has(workshop.id)).map(workshop=><WorkshopCard hidden={!visibleIds.has(workshop.id)} display={displayById[workshop.id]} key={`${retainedKey}:${workshop.id}`} workshop={workshop} selectedBrand={filters.brand} selectedService={filters.service} searchHref={catalogueHref(filters,locale)} distanceKm={catalogueDistance(workshop,filters.city)} distanceOrigin={catalogueChoiceLabel(filters.city)}/>)}</div>{matches.length>0&&<div className="catalogue-pagination"><p>{t("public.shownCount",{shown:Math.min(visibleCount,matches.length),total:matches.length})}</p>{visibleCount<matches.length&&<button className="outline" onClick={showMore}>{t("public.showMore")}</button>}</div>}</>}
  </>}
  </div></div>
 </main><DirectoryFooter/></>;
}
