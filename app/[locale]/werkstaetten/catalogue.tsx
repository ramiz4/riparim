"use client";
import {isErrorCode} from "@/lib/i18n/codes";
import {publicDataError} from "@/lib/i18n/public-errors";
import {valueLabel} from "@/lib/i18n/values";
import {formatNumber} from "@/lib/i18n/format";
import {useI18n} from "@/lib/i18n/client";
import {useCallback,useEffect,useId,useRef,useState} from "react";
import {CarFront,Filter,LoaderCircle,RefreshCw,Search,X} from "lucide-react";
import {SiteHeader} from "@/components/site-header";
import {DirectoryFooter} from "@/components/directory-footer";
import {useDirectoryAccountActions} from "@/components/directory-account-actions";
import {CatalogueFilterFields} from "@/components/catalogue-filter-fields";
import {WorkshopCard} from "@/components/workshop-card";
import {Picker} from "@/components/picker";
import {Input} from "@/components/ui/input";
import {currentGoogleRating,googlePlacesClientConfig,workshopGoogleIdentity,type LiveGoogleRating} from "@/lib/google-maps-browser";
import {Dialog,DialogTrigger} from "@/components/ui/dialog";
import {ModalContent} from "@/components/modal-shell";
import {DetailSearch,type SearchContext} from "@/app/journeys";
import {activeCatalogueFilters,catalogueHref,defaultCatalogueFilters,hasPublishedRatings,hasGoogleRatings,hasCatalogueDistances,catalogueDistance,matchCatalogue,parseCatalogueFilters,type CatalogueFilters} from "@/lib/catalogue-filters";
import {readSearchSession,rememberSearchSession} from "@/lib/search-session";
import {cities,services,type Workshop} from "@/lib/workshops";
import type {WorkshopDisplayById} from "@/lib/workshop-profile-content";
import type {AccountIdentity} from "@/components/account-storage-notice";

type Props={initialDisplayById?:WorkshopDisplayById;initialWorkshops:Workshop[];initialError:string;initialFilters:CatalogueFilters;signedIn:boolean;account:AccountIdentity|null;isAdmin:boolean};
function SortControl({id,filters,onChange,ratingAvailable,googleAvailable,distanceAvailable}:{id:string;filters:CatalogueFilters;onChange:(sort:CatalogueFilters["sort"])=>void;ratingAvailable:boolean;googleAvailable:boolean;distanceAvailable:boolean}){
 const {t}=useI18n();
 const disabledValues=[...(ratingAvailable?[]:["rating"]),...(googleAvailable?[]:["google"]),...(distanceAvailable?[]:["distance"])];
 return <div className="catalogue-sort"><label htmlFor={id}>{t("public.sort")}</label><Picker id={id} value={filters.sort} onChange={value=>onChange(value as CatalogueFilters["sort"])} values={["name","google","rating","distance"]} displayLabels={{name:t("public.sortName"),google:t("public.sortGoogle"),rating:t("public.sortRiparim"),distance:distanceAvailable?t("public.sortDistance"):filters.city===defaultCatalogueFilters.city?t("public.sortChooseCity"):t("public.sortNoLocation")}} disabledValues={disabledValues} label={t("public.sort")}/></div>;
}

export default function Catalogue({initialDisplayById={},initialWorkshops,initialError,initialFilters,signedIn,account,isAdmin}:Props){
 const {locale,t}=useI18n();
 const [displayById,setDisplayById]=useState(initialDisplayById);
 const [directory,setDirectory]=useState(initialWorkshops),[filters,setFilters]=useState(initialFilters),[draft,setDraft]=useState(initialFilters),[ready,setReady]=useState(!initialError),[error,setError]=useState(initialError),[refreshing,setRefreshing]=useState(false),[visibleCount,setVisibleCount]=useState(12),[context,setContext]=useState<SearchContext|null>(null),[privateMatchingActive,setPrivateMatchingActive]=useState(false),[hydrated,setHydrated]=useState(false),[filterOpen,setFilterOpen]=useState(false),[detailOpen,setDetailOpen]=useState(false),[liveGoogleRatings,setLiveGoogleRatings]=useState<Record<string,LiveGoogleRating>>({}),[googleEnabled,setGoogleEnabled]=useState(false),[googleLoading,setGoogleLoading]=useState(false);
 const filterButton=useRef<HTMLButtonElement>(null),resultsHeading=useRef<HTMLParagraphElement>(null),restoreScroll=useRef<number|null>(null),searchSentinel=useRef<HTMLDivElement>(null),sortId=useId();
 const [searchDocked,setSearchDocked]=useState(false);
 const matches=matchCatalogue(directory,filters,context,privateMatchingActive,liveGoogleRatings,locale),chips=activeCatalogueFilters(filters),ratingAvailable=hasPublishedRatings(directory),activeContext=privateMatchingActive&&context?.city===filters.city?context:null;
 const draftMatches=matchCatalogue(directory,draft,context,privateMatchingActive,liveGoogleRatings,locale);
 const googleAvailable=hasGoogleRatings(directory,liveGoogleRatings)||googleEnabled,distanceAvailable=hasCatalogueDistances(matches,filters.city),advancedCount=chips.filter(key=>key==="brand"||key==="language").length;
 const googleCandidates=matchCatalogue(directory,{...filters,sort:"name"},context,privateMatchingActive).map(w=>w.id).join("|");
 const rememberGoogleRating=useCallback((id:string,rating:LiveGoogleRating)=>setLiveGoogleRatings(previous=>JSON.stringify(previous[id])===JSON.stringify(rating)?previous:{...previous,[id]:rating}),[]);
 useEffect(()=>{
  const sentinel=searchSentinel.current;if(!sentinel)return;
  let observer:IntersectionObserver|null=null;
  const update=()=>{
   observer?.disconnect();observer=null;
   if(!window.matchMedia("(max-width: 720px) and (min-height: 601px)").matches){setSearchDocked(false);return;}
   const headerHeight=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--site-header-height"));
   setSearchDocked(sentinel.getBoundingClientRect().top<headerHeight);
   observer=new IntersectionObserver(([entry])=>setSearchDocked(!entry.isIntersecting&&entry.boundingClientRect.top<headerHeight),{root:document,rootMargin:`-${headerHeight}px 0px 0px 0px`,threshold:0});
   observer.observe(sentinel);
  };
  update();window.addEventListener("resize",update);
  return()=>{observer?.disconnect();window.removeEventListener("resize",update);};
 },[]);
 useEffect(()=>{let active=true;void googlePlacesClientConfig().then(config=>{if(active)setGoogleEnabled(config.enabled);}).catch(()=>{});return()=>{active=false;};},[]);
 useEffect(()=>{
  let active=true;
  if(!googleEnabled||filters.sort!=="google")return;
  void (async()=>{
   setGoogleLoading(true);
   const ids=googleCandidates?googleCandidates.split("|"):[],ratings:Record<string,LiveGoogleRating>={};
   for(let start=0;start<ids.length&&active;start+=4){
    const batch=await Promise.allSettled(ids.slice(start,start+4).map(async id=>{const identity=await workshopGoogleIdentity(id);return identity?{id,rating:await currentGoogleRating(identity.placeId,identity.browserKey,locale)}:null;}));
    for(const result of batch)if(result.status==="fulfilled"&&result.value)ratings[result.value.id]=result.value.rating;
   }
   if(active){setLiveGoogleRatings(previous=>({...previous,...ratings}));setGoogleLoading(false);}
  })();
  return()=>{active=false;};
 },[googleEnabled,filters.sort,googleCandidates,locale]);
 const refresh=useCallback(async()=>{setRefreshing(true);setError("");try{const response=await fetch(`/api/workshops?locale=${locale}`),data=await response.json() as {workshops:Workshop[];displayById?:WorkshopDisplayById;errorCode?:string};if(!response.ok){setError(isErrorCode(data.errorCode)?data.errorCode:"unknown");return;}const records=data.workshops.filter(w=>w.status==="published");setDirectory(records);setDisplayById(data.displayById??{});setFilters(parseCatalogueFilters(new URLSearchParams(window.location.search),records));setReady(true);}catch{setError("unavailable");}finally{setRefreshing(false);}},[locale]);
 const personal=useDirectoryAccountActions({directory,signedIn,account,onRefresh:()=>void refresh()});
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Private context and paging are read only after hydration, never from server props.
 useEffect(()=>{const saved=readSearchSession();setFilters(initialFilters);setVisibleCount(12);if(saved){setContext(saved.context);setPrivateMatchingActive(saved.privateMatchingActive&&saved.context?.city===initialFilters.city);if(saved.catalogueHref===catalogueHref(initialFilters,locale)){setVisibleCount(Math.max(12,saved.visibleCount));restoreScroll.current=saved.scrollY;}}setHydrated(true);},[initialFilters,locale]);
 useEffect(()=>{if(!hydrated)return;const persist=()=>rememberSearchSession({...filters,searched:true,context,privateMatchingActive,catalogueHref:catalogueHref(filters,locale),visibleCount,scrollY:window.scrollY});persist();window.addEventListener("scroll",persist,{passive:true});return()=>window.removeEventListener("scroll",persist);},[hydrated,filters,context,privateMatchingActive,visibleCount,locale]);
 useEffect(()=>{if(!hydrated||restoreScroll.current===null)return;const y=restoreScroll.current;restoreScroll.current=null;const frame=requestAnimationFrame(()=>window.scrollTo({top:y,behavior:"auto"}));return()=>cancelAnimationFrame(frame);},[hydrated,visibleCount]);
 useEffect(()=>{if(!hydrated)return;const sync=()=>{const next=parseCatalogueFilters(new URLSearchParams(window.location.search),directory);setFilters(next);setVisibleCount(12);setPrivateMatchingActive(previous=>previous&&next.city===context?.city);};window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);},[hydrated,directory,context]);
 useEffect(()=>{if(hydrated&&ready)window.history.replaceState(window.history.state,"",catalogueHref(filters,locale));},[hydrated,ready,filters,locale]);
 useEffect(()=>{const mc=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>Promise<void>|void}}).modelContext;if(!mc?.registerTool)return;const lifecycle=new AbortController();void Promise.resolve(mc.registerTool({name:"configure_workshop_search",title:t("public.searchToolTitle"),description:t("public.searchToolDescription"),inputSchema:{type:"object",properties:{service:{type:"string",enum:services},city:{type:"string",enum:cities}},required:["service","city"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input:unknown){if(!ready)throw Error(t("public.directoryUnavailable"));if(!input||typeof input!=="object")throw Error(t("common.invalidRequest"));const value=input as {service:string;city:string};if(!services.includes(value.service)||!cities.includes(value.city)||Object.keys(value).some(key=>!["service","city"].includes(key)))throw Error(t("common.invalidRequest"));const next={...defaultCatalogueFilters,service:value.service,city:value.city};setPrivateMatchingActive(false);setFilters(next);setVisibleCount(12);window.history.replaceState(window.history.state,"",catalogueHref(next,locale));return {workshops:matchCatalogue(directory,next).map(w=>({id:w.id,name:w.name,city:w.city,reviewCount:w.count}))};}},{signal:lifecycle.signal})).catch(error=>console.warn("WebMCP registration",error));return()=>lifecycle.abort();},[directory,ready,locale,t]);
 function commit(next:CatalogueFilters,resetPrivate=false){if(resetPrivate||next.city!==filters.city)setPrivateMatchingActive(false);const value=next.sort==="distance"&&!hasCatalogueDistances(directory,next.city)?{...next,sort:"name" as const}:next;setFilters(value);setVisibleCount(12);window.history.replaceState(window.history.state,"",catalogueHref(value,locale));}
 function change(field:"query"|"service"|"city"|"brand"|"language",value:string){commit({...filters,[field]:value});}
 function reset(){commit({...defaultCatalogueFilters,sort:filters.sort},true);}
 function applyDraft(){commit(draft);setFilterOpen(false);requestAnimationFrame(()=>{filterButton.current?.focus({preventScroll:true});resultsHeading.current?.scrollIntoView({block:"start",behavior:"auto"});});}
 function applyContext(value:SearchContext){const next={...defaultCatalogueFilters,service:value.service,city:value.city,brand:value.brand,sort:filters.sort};setContext(value);setPrivateMatchingActive(true);setFilters(next);setVisibleCount(12);window.history.replaceState(window.history.state,"",catalogueHref(next,locale));}

 return <><SiteHeader account={account} isAdmin={isAdmin} onVisits={personal.onVisits} onNewVisit={personal.onNewVisit}/><main className="catalogue-page wrap">
  <header className="catalogue-heading"><div><h1>{t("public.workshops")}</h1></div><button className="catalogue-detail-search" onClick={()=>setDetailOpen(true)}><CarFront size={18}/>{t("public.detailSearch")}</button></header>
  {activeContext&&<div className="catalogue-private-context"><CarFront size={18}/><div><strong>{t("public.privateContext")} · {valueLabel(locale,"sentinel",activeContext.brand)} {activeContext.model}</strong><p>{activeContext.radius>0?t("public.radiusSummary",{distance:activeContext.radius}):""}{activeContext.additionalCity?`${activeContext.additionalCity} · `:""}{t("public.ramOnly")}</p></div><button onClick={()=>setDetailOpen(true)}>{t("public.changeContext")}</button></div>}
  <div className="catalogue-search-sentinel" ref={searchSentinel} aria-hidden="true"/>
  <Dialog open={filterOpen} onOpenChange={setFilterOpen}><section className="catalogue-search-panel" data-docked={searchDocked} aria-label={t("public.searchWorkshops")}>
   <div className="catalogue-name-search"><label htmlFor={`${sortId}-name`}>{t("public.workshopName")}</label><div><Search size={18} aria-hidden="true"/><Input id={`${sortId}-name`} type="search" maxLength={100} autoComplete="off" placeholder={t("public.searchPlaceholder")} value={filters.query} onChange={event=>change("query",event.target.value)}/></div></div>
   <CatalogueFilterFields filters={filters} onChange={change} directory={directory} fields={["city","service"]}/>
   <DialogTrigger asChild><button className="outline catalogue-filter-button" ref={filterButton} aria-label={advancedCount>0?t("public.activeFilterCount",{count:advancedCount}):t("public.moreFilters")} onClick={()=>setDraft({...filters})}><Filter size={18} aria-hidden="true"/><span className="catalogue-filter-label-desktop">{t("public.moreFilters")}</span><span className="catalogue-filter-label-mobile">{t("public.filter")}</span>{advancedCount>0&&<span className="catalogue-filter-badge">{formatNumber(locale,advancedCount)}</span>}</button></DialogTrigger>
   <div className="catalogue-panel-sort"><SortControl id={`${sortId}-sort`} filters={filters} onChange={sort=>commit({...filters,sort})} ratingAvailable={ratingAvailable} googleAvailable={googleAvailable} distanceAvailable={distanceAvailable}/></div>
  </section><ModalContent className="catalogue-filter-dialog" title={t("public.moreFilters")} description={t("public.filterHelp")} footer={<><button className="outline" onClick={()=>setDraft(old=>({...old,brand:defaultCatalogueFilters.brand,language:defaultCatalogueFilters.language}))}>{t("public.reset")}</button><button className="primary" onClick={applyDraft}>{t("public.showResults")}{ready?` (${formatNumber(locale,draftMatches.length)})`:""}</button></>}><CatalogueFilterFields filters={draft} onChange={(field,value)=>setDraft(old=>({...old,[field]:value}))} directory={directory} fields={["brand","language"]}/>{ready&&draftMatches.length===0&&<p className="catalogue-draft-empty">{t("public.draftEmpty")}</p>}</ModalContent></Dialog>
  {chips.length>0&&<div className="catalogue-active-filters" aria-label={t("public.activeFilters")}>{chips.map(key=><button className="catalogue-filter-chip" key={key} aria-label={t("public.removeFilter",{label:t(`public.${key==="query"?"workshopName":key}`),value:key==="query"?filters.query:valueLabel(locale,key==="service"?"service":key==="language"?"language":"sentinel",filters[key])})} onClick={()=>change(key,defaultCatalogueFilters[key])}><span>{t(`public.${key==="query"?"workshopName":key}`)}: {key==="query"?filters.query:valueLabel(locale,key==="service"?"service":key==="language"?"language":"sentinel",filters[key])}</span><X size={15}/></button>)}<button className="catalogue-reset" onClick={reset}>{t("public.resetAll")}</button></div>}
  {!ready?error?<div className="catalogue-load-error" role="alert"><h2>{publicDataError(t,error,"directory")}</h2><p>{t("public.retryHelp")}</p><button className="primary" disabled={refreshing} onClick={()=>void refresh()}><RefreshCw size={16}/>{refreshing?t("public.loading"):t("public.reload")}</button></div>:<div className="review-loading" role="status"><LoaderCircle size={18} className="spin"/>{t("public.loadingWorkshops")}</div>:<>
   <div className="catalogue-results-toolbar"><p className="catalogue-result-count" ref={resultsHeading} role="status" aria-live="polite" aria-atomic="true">{t("public.workshopCount",{count:matches.length})}</p><div className="catalogue-results-sort"><SortControl id={`${sortId}-results-sort`} filters={filters} onChange={sort=>commit({...filters,sort})} ratingAvailable={ratingAvailable} googleAvailable={googleAvailable} distanceAvailable={distanceAvailable}/></div>{googleEnabled&&filters.sort==="google"&&googleLoading&&<span className="catalogue-refreshing" role="status"><LoaderCircle size={15} className="spin"/>{t("public.googleUpdating")}</span>}{refreshing&&<span className="catalogue-refreshing" role="status"><LoaderCircle size={15} className="spin"/>{t("public.updating")}</span>}</div>
   {filters.sort==="distance"&&<p className="catalogue-distance-note">{t("public.distanceNote",{city:filters.city})}</p>}
   {error&&<div className="error catalogue-refresh-error" role="alert">{t("public.refreshFailed")}<button disabled={refreshing} onClick={()=>void refresh()}>{t("public.reload")}</button></div>}
   {directory.length===0?<div className="empty catalogue-empty"><Search size={27}/><h2>{t("public.directoryEmpty")}</h2><p>{t("public.directoryEmptyHelp")}</p></div>:matches.length===0?<div className="empty catalogue-empty"><Search size={27}/><h2>{filters.query?t("public.noNameMatch"):t("public.noMatch")}</h2><p>{filters.language!==defaultCatalogueFilters.language?t("public.noLanguageMatch"):t("public.changeFilter")}</p><div>{filters.language!==defaultCatalogueFilters.language&&<button className="primary" onClick={()=>change("language",defaultCatalogueFilters.language)}>{t("public.removeLanguage")}</button>}<button className="outline" onClick={reset}>{t("public.resetAll")}</button></div></div>:<><div className="catalogue-grid">{matches.slice(0,visibleCount).map(workshop=><WorkshopCard display={displayById[workshop.id]} key={workshop.id} workshop={workshop} selectedBrand={filters.brand} selectedService={filters.service} searchHref={catalogueHref(filters,locale)} distanceKm={catalogueDistance(workshop,filters.city)} distanceOrigin={filters.city} liveGoogleRating={liveGoogleRatings[workshop.id]} onGoogleRating={rememberGoogleRating}/>)}</div><div className="catalogue-pagination"><p>{t("public.shownCount",{shown:Math.min(visibleCount,matches.length),total:matches.length})}</p>{visibleCount<matches.length&&<button className="outline" onClick={()=>setVisibleCount(count=>count+12)}>{t("public.showMore")}</button>}</div></>}
  </>}
 </main><DirectoryFooter/><DetailSearch open={detailOpen} onClose={()=>setDetailOpen(false)} onSearch={applyContext} initialContext={context}/>{personal.dialogs}</>;
}
