"use client";
import {workshopEmailHref} from "@/lib/workshop-emails";
import {publicDataError} from "@/lib/i18n/public-errors";
import {useI18n} from "@/lib/i18n/client";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {formatDate,formatNumber} from "@/lib/i18n/format";
import {reviewServicesLabel,valueLabel} from "@/lib/i18n/values";
import {localizeHref} from "@/lib/i18n/locale";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useCallback,useEffect,useId,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,Check,ChevronDown,Copy,LoaderCircle,FileCheck2,Globe,Mail,MapPin,MessageCircle,Navigation,Phone,Share2,ShieldCheck,Star} from "lucide-react";
import {usePublicSession} from "@/components/use-public-session";
import {SiteHeader} from "@/components/site-header";
import {WorkshopRatings} from "@/components/workshop-ratings";
import {workshopMapsUrl,workshopRouteUrl} from "@/lib/google-maps-link";
import {WorkshopOpeningHours} from "@/components/opening-hours";
import {defaultCatalogueFilters,parseCatalogueFilters} from "@/lib/catalogue-filters";
import {workshopDisplayLanguage,displayServiceDetail,type WorkshopDisplayContent,groupWorkshopServices,profileSelection,workshopSelectionMatches,type ProfileSelection} from "@/lib/workshop-profile-content";
import {reviewDialogHref,reviewDialogRequested} from "@/lib/review-dialog-route";
import {ReviewForm,type ReviewFormDraft} from "@/components/review-form";
import {ModalContent} from "@/components/modal-shell";
import {Dialog,DialogTrigger} from "@/components/ui/dialog";
import type {AccountIdentity} from "@/components/account-storage-notice";
import type {Review} from "@/app/journeys";
import {contactHref,type Workshop} from "@/lib/workshops";
import {readSearchSession} from "@/lib/search-session";
import {profileSearchHref} from "@/lib/profile-navigation";
import {WorkshopNavigationLink} from "@/components/workshop-navigation-link";

type Props={publicSnapshot?:boolean;initialSearchHref?:string|null;display?:WorkshopDisplayContent;workshop:Workshop;directory:Workshop[];reviews:Review[];reviewError:string;signedIn:boolean;account:AccountIdentity|null;isAdmin:boolean};
export default function WorkshopProfile({publicSnapshot=false,workshop:initialWorkshop,directory:initialDirectory,reviews:initialReviews,reviewError:initialReviewError,signedIn:initialSignedIn,account:initialAccount,isAdmin:initialAdmin,display:initialDisplay,initialSearchHref=null}:Props){
 const {account,isAdmin}=usePublicSession({account:initialAccount,isAdmin:initialAdmin},publicSnapshot);
 const signedIn=publicSnapshot?!!account:initialSignedIn;
 const [loadedReviews,setReviews]=useState(initialReviews),[loadedReviewError,setReviewError]=useState(initialReviewError),[reviewsLoading,setReviewsLoading]=useState(publicSnapshot),[reviewRevision,setReviewRevision]=useState(0);
 useEffect(()=>{if(!publicSnapshot)return;let active=true;void fetch(`/api/reviews?workshop=${encodeURIComponent(initialWorkshop.id)}`,{cache:"no-store"}).then(async response=>{const value=await response.json() as {reviews?:Review[]};if(!response.ok||!Array.isArray(value.reviews))throw Error("Reviews unavailable");if(active){setReviews(value.reviews);setReviewError("");}}).catch(()=>{if(active)setReviewError("unavailable");}).finally(()=>{if(active)setReviewsLoading(false);});return()=>{active=false;};},[publicSnapshot,initialWorkshop.id,reviewRevision]);
 const reviews=publicSnapshot?loadedReviews:initialReviews,reviewError=publicSnapshot?loadedReviewError:initialReviewError;
 const {locale,t}=useI18n();
 const [live,setLive]=useState<{workshop:Workshop;directory:Workshop[];display?:WorkshopDisplayContent}>({workshop:initialWorkshop,directory:initialDirectory,display:initialDisplay});
 const {workshop:w,directory,display}=publicSnapshot?live:{workshop:initialWorkshop,directory:initialDirectory,display:initialDisplay};
 useEffect(()=>{if(!publicSnapshot)return;let active=true;void fetch(`/api/workshops?locale=${locale}`,{cache:"no-store"}).then(async response=>{const value=await response.json() as {workshops?:Workshop[];displayById?:Record<string,WorkshopDisplayContent>};if(!response.ok||!Array.isArray(value.workshops))throw Error("Directory unavailable");const workshop=value.workshops.find(item=>item.id===initialWorkshop.id&&item.status==="published");if(!workshop){if(active)window.location.reload();return;}if(active)setLive({workshop,directory:value.workshops,display:value.displayById?.[workshop.id]});}).catch(()=>{});return()=>{active=false;};},[publicSnapshot,initialWorkshop.id,locale,reviewRevision]);
 const router=useRouter();const [reviewOpen,setReviewOpen]=useState(false),[reviewBusy,setReviewBusy]=useState(false),[contact,setContact]=useState(false),[message,setMessage]=useState(""),[initialMessage,setInitialMessage]=useState(""),[feedback,setFeedback]=useState(""),[backHref,setBackHref]=useState(()=>localizeHref(initialSearchHref??"/werkstaetten",locale));
 const reviewFormId=useId(),reviewIdentity=`${w.id}:${account?.provider??"guest"}:${account?.email??"guest"}`;
 const [reviewDraft,setReviewDraft]=useState<{identity:string;value:ReviewFormDraft}|null>(null),[reviewSubmitted,setReviewSubmitted]=useState<string|null>(null);
 const saveReviewDraft=useCallback((value:ReviewFormDraft)=>setReviewDraft({identity:reviewIdentity,value}),[reviewIdentity]);
 useNavigationGuard({busy:reviewBusy,dirty:contact&&message!==initialMessage||reviewDraft?.identity===reviewIdentity&&reviewDraft.value.dirty});
 const [selection,setSelection]=useState<ProfileSelection>({brand:null,service:null});
 const path=localizeHref(`/werkstatt/${encodeURIComponent(w.id)}`,locale);
 const reviewReturnTo=`${path}?${new URLSearchParams({bewerten:"1",suche:backHref})}`;
 const mapHref=workshopMapsUrl(w);
 const routeHref=workshopRouteUrl(w);
 const phoneHref=contactHref(w,"phone");
 const serviceGroups=groupWorkshopServices(w),matches=workshopSelectionMatches(w,selection);
 const description=display?.description??w.description,specialty=display?.specialty??w.specialty;
 const contentLanguage=workshopDisplayLanguage(display,locale);
 // The server validates the public document return target; RAM only recovers client navigation.
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore the validated public filters for profile highlights and the return link.
 useEffect(()=>{const session=readSearchSession(),explicit=profileSearchHref(new URLSearchParams(window.location.search).get("suche"),directory),remembered=profileSearchHref(session?.catalogueHref??null,directory),href=initialSearchHref??explicit??remembered;setBackHref(localizeHref(href??"/werkstaetten",locale));const filters=href?parseCatalogueFilters(new URL(href,window.location.origin).searchParams,directory):defaultCatalogueFilters;setSelection(profileSelection(filters));},[directory,w.id,locale,initialSearchHref]);
 // The URL owns modal state, including legacy login returns and browser navigation.
 useEffect(()=>{
  const sync=()=>{const open=reviewDialogRequested(window.location.href);if(reviewBusy&&!open){window.history.pushState({...window.history.state,riparimReviewDialog:window.location.pathname},"",reviewDialogHref(window.location.href,true));return;}setReviewOpen(open);};
  sync();window.addEventListener("popstate",sync);window.addEventListener("hashchange",sync);
  return()=>{window.removeEventListener("popstate",sync);window.removeEventListener("hashchange",sync);};
 },[reviewBusy,w.id]);
 function changeReviewOpen(open:boolean){
  if(reviewBusy)return;
  const href=reviewDialogHref(window.location.href,open),current=window.location.pathname+window.location.search+window.location.hash;
  if(href!==current){
   if(open)window.history.pushState({...window.history.state,riparimReviewDialog:window.location.pathname},"",href);
   else if(window.history.state?.riparimReviewDialog===window.location.pathname)window.history.back();
   else window.history.replaceState(window.history.state,"",href);
  }
  setReviewOpen(open);
 }
 function openReview(){if(reviewSubmitted===reviewIdentity){setReviewDraft(null);setReviewSubmitted(null);}changeReviewOpen(true);}
 function startWhatsApp(){
  setFeedback("");
  const draft=t("public.whatsAppHello",{name:w.name})+t("public.messageAsk");setInitialMessage(draft);setMessage(draft);setContact(true);
 }
 async function copy(value:string,label:string){try{await navigator.clipboard.writeText(value);setFeedback(label);}catch{setFeedback(t("public.copyManual"));}}
 const riparimReviews=<div key="riparim" className={`profile-riparim-reviews${!reviews.length&&!reviewError&&!reviewsLoading?" is-empty":""}`}>
  <div className="profile-review-provider"><h3><ShieldCheck size={18}/>Riparim</h3>{reviews.length>0&&<p>{t("public.reviewsProof")}</p>}</div>
  {reviewsLoading?<p role="status">{t("public.loading")}</p>:reviewError?<p className="error" role="alert">{publicDataError(t,reviewError,"reviews")}</p>:reviews.length?<div className="public-review-list">{reviews.map((review,index)=><article className="public-review" key={`${review.display_name}:${review.date}:${index}`}>
   <div className="review-title"><strong className="public-review-author">{review.display_name}</strong><span className="public-review-score"><Star size={15} fill="currentColor" aria-hidden="true"/>{formatNumber(locale,review.rating)} / 5</span></div>
   <p className="review-meta"><span>{review.vehicle}</span><span>{reviewServicesLabel(locale,review)}</span></p>
   {review.review&&<p className="public-review-text">{review.review}</p>}
   <footer className="public-review-footer"><span className="proof-badge"><ShieldCheck size={14} aria-hidden="true"/>{t("public.proofChecked")}</span><time dateTime={review.date}>{formatDate(locale,review.date,{dateOnly:true})}</time></footer>
  </article>)}{w.count>reviews.length&&<p className="help">{t("public.latestReviews",{count:reviews.length})}</p>}</div>:<p className="profile-review-empty">{t("public.noProofReviews")}</p>}
 </div>;
 return <><SiteHeader account={account} isAdmin={isAdmin}/>
 <main className="workshop-page wrap" data-workshop-id={w.id}>
  <WorkshopNavigationLink className="profile-back" href={backHref}><ArrowLeft size={16}/>{t("public.backSearch")}</WorkshopNavigationLink>
  {display?.fallback&&<p className="help workshop-translation-notice">{t("public.translationFallback")}</p>}
  <header className="workshop-overview"><div className="workshop-overview-identity"><h1>{w.name}</h1><p className="profile-place"><MapPin size={15}/><span>{w.city}</span>{specialty&&<span className="profile-specialty" lang={contentLanguage}>{specialty}</span>}</p></div><div className="workshop-overview-actions">{w.whatsapp&&<button className="primary" onClick={startWhatsApp}><MessageCircle size={17}/>WhatsApp</button>}{phoneHref&&<LocaleAnchor className={w.whatsapp?"outline":"primary"} href={phoneHref}><Phone size={17}/>{t("public.call")}</LocaleAnchor>}<LocaleAnchor className="outline" href={routeHref} target="_blank" rel="noopener noreferrer"><Navigation size={17}/>{t("public.route")}</LocaleAnchor></div><div className="profile-overview-details"><WorkshopRatings key={w.id} workshop={w} compact/><WorkshopOpeningHours importedHours={w.importedOpeningHours} hours={w.openingHours} confirmedAt={w.openingHoursConfirmedAt}/></div></header>
  <div className="workshop-page-grid"><div className="workshop-page-main">
   <section className="profile-page-section" id="leistungen"><div className="profile-section-heading"><h2>{w.brands.length?t("public.servicesBrands"):t("public.services")}</h2></div>{(selection.brand||selection.service)&&<div className="profile-search-match"><p>{t("public.yourSearch")}{selection.brand?`: ${selection.brand}`:""}</p><div>{matches.brand&&<span><Check size={14}/>{t("public.brandMatch",{brand:selection.brand!})}</span>}{matches.service&&<span><Check size={14}/>{t("public.serviceMatch",{service:valueLabel(locale,"service",selection.service!)})}</span>}</div></div>}{description&&<p className="profile-description" lang={contentLanguage}>{description}</p>}<div className="profile-service-groups" aria-label={t("public.offeredServices")}>{serviceGroups.map(group=><section key={group.title} className={`profile-service-group${matches.service&&group.title===selection.service?" selected":""}`}><h3>{group.title==="Weitere Leistungen"?t("public.otherServices"):valueLabel(locale,"service",group.title)}{matches.service&&group.title===selection.service&&<span className="profile-selection-label">{t("public.yourSelection")}</span>}</h3>{group.items.length>0&&<ul>{group.items.map(service=><li key={service.sourceIndex} lang={contentLanguage}>{displayServiceDetail(service,display,locale)}</li>)}</ul>}</section>)}</div>{(w.brands.length>0||w.languages.length>0)&&<div className="profile-facts">{w.brands.length>0&&<div><h3>{t("public.brands")}</h3><div className="brand-tags">{w.brands.map(brand=><span key={brand} className={matches.brand&&(brand===selection.brand||brand==="Alle Marken")?"profile-brand-selected":undefined}>{valueLabel(locale,"sentinel",brand)}{matches.brand&&(brand===selection.brand||brand==="Alle Marken")&&<span className="profile-selection-label">{t("public.yourSelection")}</span>}</span>)}</div></div>}{w.languages.length>0&&<div><h3>{t("public.consultationLanguages")}</h3><p><Globe size={15}/>{w.languages.map(language=>valueLabel(locale,"language",language)).join(" · ")}</p></div>}</div>}</section>
   <Dialog open={reviewOpen} onOpenChange={changeReviewOpen}><section className="profile-page-section" id="bewertungen"><div className="profile-section-heading"><h2>{t("public.reviews")}</h2><DialogTrigger asChild><button className="text-action" onClick={openReview}>{t("public.writeReview")}</button></DialogTrigger></div><div className="profile-review-stream">
    {riparimReviews}
    </div>
    <ModalContent className="profile-review-dialog" title={t("public.writeReview")} description={w.name} closeDisabled={reviewBusy} onEscapeKeyDown={event=>{if(reviewBusy)event.preventDefault();}} onPointerDownOutside={event=>{if(reviewBusy)event.preventDefault();}} footer={<><button type="button" className="outline" disabled={reviewBusy} onClick={()=>changeReviewOpen(false)}>{t("common.close")}</button>{signedIn&&reviewSubmitted!==reviewIdentity&&<button type="submit" form={reviewFormId} className="primary" disabled={reviewBusy}>{reviewBusy?<><LoaderCircle className="spin" size={17}/>{t("customer.submitting")}</>:t("customer.submitReview")}</button>}</>}>
     <ReviewForm key={reviewIdentity} formId={reviewFormId} showSubmit={false} workshop={w} directory={directory} signedIn={signedIn} account={account} draft={reviewDraft?.identity===reviewIdentity?reviewDraft.value:undefined} onDraftChange={saveReviewDraft} returnTo={reviewReturnTo} onBusyChange={setReviewBusy} onSubmitted={()=>{setReviewDraft(null);setReviewSubmitted(reviewIdentity);if(publicSnapshot)setReviewRevision(value=>value+1);else router.refresh();}}/>
    </ModalContent>
   </section></Dialog>
   <details className="profile-sources" id="quellen">
    <summary><span><FileCheck2 size={17}/>{t("public.sourcesDate")}</span><ChevronDown size={18}/></summary>
    <div className="profile-sources-content">
     <p className="profile-scope">{t("public.checkedAt",{date:formatDate(locale,w.checkedAt,{dateOnly:true})})}</p>
     {w.phoneNote&&<p className="profile-scope">{t("public.phoneContact")} <span lang={contentLanguage}>{display?.phoneNote??w.phoneNote}</span></p>}
     <ul className="profile-source-list">
      {w.sources.map((source,index)=><li key={source.url}><LocaleAnchor href={source.url} target="_blank" rel="noopener noreferrer"><strong lang={contentLanguage}>{display?.sourceTitles[index]??source.title}</strong><span>{new URL(source.url).hostname}</span></LocaleAnchor></li>)}
     </ul>
    </div>
   </details>
  </div><aside className="workshop-page-aside"><section className="profile-contact-summary" id="standort"><h2>{t("public.contactLocation")}</h2><p className="profile-address"><MapPin size={18}/><span>{w.address}</span></p><LocaleAnchor className="text-action" href={mapHref} target="_blank" rel="noopener noreferrer">{t("public.viewMaps")}</LocaleAnchor>{phoneHref&&<LocaleAnchor className="profile-phone-summary" href={phoneHref}><Phone size={17}/><strong>{w.phone}</strong></LocaleAnchor>}{!!w.emails?.length&&<div className="profile-email-summary"><h3>{t("common.workshopEmails")}</h3>{(w.emailContacts??w.emails.map(address=>({address,verified:false}))).map(entry=><div className="profile-email-entry" key={entry.address.toLowerCase()}><LocaleAnchor href={workshopEmailHref(entry.address)}><Mail size={17} aria-hidden="true"/><span>{entry.address}</span></LocaleAnchor><span className="profile-email-status">{entry.verified?t("common.workshopEmailVerified"):t("common.workshopEmailUnverified")}</span></div>)}</div>}{w.whatsapp&&<div className="profile-contact-actions"><button className="primary" onClick={startWhatsApp}><MessageCircle size={17}/>WhatsApp</button></div>}</section><button className="profile-share" onClick={()=>void copy(`${window.location.origin}${path}`,t("public.profileCopied"))}><Share2 size={16}/>{t("public.shareProfile")}</button>{feedback&&!contact&&<p className="help" role="status">{feedback}</p>}<div className="profile-owner"><LocaleAnchor href={`/betrieb/beanspruchen?werkstatt=${encodeURIComponent(w.id)}`}>{t("public.owner")}</LocaleAnchor></div></aside></div>
  <nav className={`profile-mobile-actions${w.whatsapp?" has-whatsapp":""}`} aria-label={t("public.contactWorkshop")}>{w.whatsapp&&<button className="primary" onClick={startWhatsApp}><MessageCircle size={18}/>WhatsApp</button>}{phoneHref&&<LocaleAnchor className={w.whatsapp?"outline":"primary"} href={phoneHref}><Phone size={18}/>{t("public.call")}</LocaleAnchor>}<LocaleAnchor className="outline" href={routeHref} target="_blank" rel="noopener noreferrer"><Navigation size={18}/><span className="profile-route-label">{t("public.route")}</span><span className="profile-route-short">{t("public.routeShort")}</span></LocaleAnchor></nav>
 </main>
 <Dialog open={contact} onOpenChange={setContact}><ModalContent title={t("public.prepareMessage")} description={w.name} footer={<><button className="outline" onClick={()=>void copy(message,t("public.messageCopied"))}><Copy size={16}/>{t("public.copyText")}</button><LocaleAnchor className="primary" href={contactHref(w,"whatsapp",message)??undefined} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>{t("public.openWhatsApp")}</LocaleAnchor></>}>
  <label className="message-label">{t("public.yourMessage")}<textarea rows={5} value={message} maxLength={3000} onChange={e=>setMessage(e.target.value)}/></label><p className="help">{t("public.sendWhatsApp")}</p>{feedback&&<p className="help" role="status">{feedback}</p>}
 </ModalContent></Dialog>
 </>;
}
