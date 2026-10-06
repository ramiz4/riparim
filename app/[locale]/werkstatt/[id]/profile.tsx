"use client";
import {publicDataError} from "@/lib/i18n/public-errors";
import {useI18n} from "@/lib/i18n/client";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {formatDate,formatNumber} from "@/lib/i18n/format";
import {valueLabel} from "@/lib/i18n/values";
import {localizeHref} from "@/lib/i18n/locale";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,Check,ChevronDown,Copy,FileCheck2,Globe,MapPin,MessageCircle,Navigation,Phone,Share2,ShieldCheck,Star} from "lucide-react";
import {SiteHeader} from "@/components/site-header";
import {WorkshopRatings} from "@/components/workshop-ratings";
import {workshopMapsUrl,workshopRouteUrl} from "@/lib/google-maps-link";
import {GooglePlaceReviews} from "@/components/google-place-reviews";
import {useGoogleWorkshopProfile} from "@/components/use-google-workshop-profile";
import {WorkshopOpeningHours,WorkshopPhotos} from "@/components/workshop-google-details";
import {defaultCatalogueFilters,parseCatalogueFilters} from "@/lib/catalogue-filters";
import {workshopDisplayLanguage,displayServiceDetail,type WorkshopDisplayContent,groupWorkshopServices,profileSelection,workshopSelectionMatches,type ProfileSelection} from "@/lib/workshop-profile-content";
import {ReviewForm} from "@/components/review-form";
import {ModalContent} from "@/components/modal-shell";
import {Dialog} from "@/components/ui/dialog";
import type {AccountIdentity} from "@/components/account-storage-notice";
import {MyVisits,VisitForm,type Review,type Visit} from "@/app/journeys";
import {contactHref,type Workshop} from "@/lib/workshops";
import {readSearchSession} from "@/lib/search-session";
import {profileSearchHref} from "@/lib/profile-navigation";
import {WorkshopNavigationLink} from "@/components/workshop-navigation-link";

type Props={initialSearchHref?:string|null;display?:WorkshopDisplayContent;workshop:Workshop;directory:Workshop[];reviews:Review[];reviewError:string;signedIn:boolean;account:AccountIdentity|null;isAdmin:boolean};
export default function WorkshopProfile({workshop:w,directory,reviews,reviewError,signedIn,account,isAdmin,display,initialSearchHref=null}:Props){
 const {locale,t}=useI18n();
 const router=useRouter();const [reviewOpen,setReviewOpen]=useState(false),[reviewBusy,setReviewBusy]=useState(false),[myReviews,setMyReviews]=useState(false),[editing,setEditing]=useState<Visit|null>(null),[contact,setContact]=useState(false),[message,setMessage]=useState(""),[initialMessage,setInitialMessage]=useState(""),[feedback,setFeedback]=useState(""),[backHref,setBackHref]=useState(()=>localizeHref(initialSearchHref??"/werkstaetten",locale));
 useNavigationGuard({dirty:contact&&message!==initialMessage});
 const {profile,identity,status}=useGoogleWorkshopProfile(w.id);
 const [selection,setSelection]=useState<ProfileSelection>({brand:null,service:null,vehicle:null});
 const path=localizeHref(`/werkstatt/${encodeURIComponent(w.id)}`,locale);
 const mapHref=workshopMapsUrl(w,identity?.placeId);
 const routeHref=workshopRouteUrl(w,identity?.placeId);
 const phoneHref=contactHref(w,"phone");
 const serviceGroups=groupWorkshopServices(w),matches=workshopSelectionMatches(w,selection);
 const description=display?.description??w.description,specialty=display?.specialty??w.specialty;
 const contentLanguage=workshopDisplayLanguage(display,locale);
 // The server validates the public document return target; RAM only recovers client navigation.
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Search details stay in browser memory; only validated public filters enter URLs.
 useEffect(()=>{const session=readSearchSession(),explicit=profileSearchHref(new URLSearchParams(window.location.search).get("suche"),directory),remembered=profileSearchHref(session?.catalogueHref??null,directory),href=initialSearchHref??explicit??remembered;setBackHref(localizeHref(href??"/werkstaetten",locale));const filters=href?parseCatalogueFilters(new URL(href,window.location.origin).searchParams,directory):defaultCatalogueFilters;setSelection(profileSelection(filters,session?.privateMatchingActive&&href===remembered?session.context:null));},[directory,w.id,locale,initialSearchHref]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- A login return may target the inline review section.
 useEffect(()=>{if(window.location.hash==="#bewerten"||new URLSearchParams(window.location.search).get("bewerten")==="1")setReviewOpen(true);},[]);
 function openReview(){setReviewOpen(true);requestAnimationFrame(()=>document.getElementById("bewerten")?.scrollIntoView({behavior:"smooth",block:"start"}));}
 function startWhatsApp(){
  setFeedback("");const session=readSearchSession(),context=session?.privateMatchingActive?session.context:null;
  const draft=t("public.whatsAppHello",{name:w.name})+(context?t("public.messageVehicle",{vehicle:`${valueLabel(locale,"sentinel",context.brand)} ${context.model}${context.year?` (${context.year})`:""}`})+t("public.messageWork",{problem:context.problem})+(context.from||context.to?t("public.messageTravel",{from:context.from?formatDate(locale,context.from,{dateOnly:true}):t("public.unspecified"),to:context.to?formatDate(locale,context.to,{dateOnly:true}):t("public.unspecified")}):""):"")+t("public.messageAsk");setInitialMessage(draft);setMessage(draft);setContact(true);
 }
 async function copy(value:string,label:string){try{await navigator.clipboard.writeText(value);setFeedback(label);}catch{setFeedback(t("public.copyManual"));}}
 const googleReviews=<div className="profile-google-reviews" id="google-bewertungen"><GooglePlaceReviews key={w.id} workshop={w} identity={identity} liveRating={profile?.rating??null} status={status}/></div>;
 const riparimReviews=<div className={`profile-riparim-reviews${!reviews.length&&!reviewError?" is-empty":""}`}><div className="profile-review-provider"><h3><ShieldCheck size={18}/>Riparim</h3>{reviews.length>0&&<p>{t("public.reviewsProof")}</p>}</div>{reviewError?<p className="error" role="alert">{publicDataError(t,reviewError,"reviews")}</p>:reviews.length?<div className="public-review-list">{reviews.map((review,index)=><article className="public-review" key={`${review.display_name}:${review.date}:${index}`}><div className="review-title"><strong>{review.display_name}</strong><span><Star size={14} fill="currentColor"/>{formatNumber(locale,review.rating)} / 5</span></div><p className="review-meta">{review.vehicle} · {review.service} · {formatDate(locale,review.date,{dateOnly:true})}</p><p className="public-review-text">{review.review}</p><span className="proof-badge"><ShieldCheck size={13}/>{t("public.proofChecked")}</span></article>)}{w.count>reviews.length&&<p className="help">{t("public.latestReviews",{count:reviews.length})}</p>}</div>:<p className="profile-review-empty">{t("public.noProofReviews")}</p>}</div>;
 return <><SiteHeader account={account} isAdmin={isAdmin} onVisits={()=>setMyReviews(true)}/>
 <main className="workshop-page wrap" data-workshop-id={w.id}>
  <WorkshopNavigationLink className="profile-back" href={backHref}><ArrowLeft size={16}/>{t("public.backSearch")}</WorkshopNavigationLink>
  {display?.fallback&&<p className="help workshop-translation-notice">{t("public.translationFallback")}</p>}
  <header className="workshop-overview"><div className="workshop-overview-identity"><h1>{w.name}</h1><p className="profile-place"><MapPin size={15}/><span>{w.city}</span>{specialty&&<span className="profile-specialty" lang={contentLanguage}>{specialty}</span>}</p></div><div className="workshop-overview-actions">{w.whatsapp&&<button className="primary" onClick={startWhatsApp}><MessageCircle size={17}/>WhatsApp</button>}{phoneHref&&<LocaleAnchor className={w.whatsapp?"outline":"primary"} href={phoneHref}><Phone size={17}/>{t("public.call")}</LocaleAnchor>}<LocaleAnchor className="outline" href={routeHref} target="_blank" rel="noopener noreferrer"><Navigation size={17}/>{t("public.route")}</LocaleAnchor></div><div className="profile-overview-details"><WorkshopRatings key={w.id} workshop={w} compact googleState={{live:profile?.rating??null,status}}/><WorkshopOpeningHours profile={profile} status={status} mapsUrl={mapHref}/></div></header>
  <WorkshopPhotos key={w.id} name={w.name} profile={profile} identity={identity} status={status}/>
  <div className="workshop-page-grid"><div className="workshop-page-main">
   <section className="profile-page-section" id="leistungen"><div className="profile-section-heading"><h2>{w.brands.length?t("public.servicesBrands"):t("public.services")}</h2></div>{(selection.brand||selection.service)&&<div className="profile-search-match"><p>{t("public.yourSearch")}{selection.vehicle?`: ${selection.vehicle}`:selection.brand?`: ${selection.brand}`:""}</p><div>{matches.brand&&<span><Check size={14}/>{t("public.brandMatch",{brand:selection.brand!})}</span>}{matches.service&&<span><Check size={14}/>{t("public.serviceMatch",{service:valueLabel(locale,"service",selection.service!)})}</span>}</div></div>}{description&&<p className="profile-description" lang={contentLanguage}>{description}</p>}<div className="profile-service-groups" aria-label={t("public.offeredServices")}>{serviceGroups.map(group=><section key={group.title} className={`profile-service-group${matches.service&&group.title===selection.service?" selected":""}`}><h3>{group.title==="Weitere Leistungen"?t("public.otherServices"):valueLabel(locale,"service",group.title)}{matches.service&&group.title===selection.service&&<span className="profile-selection-label">{t("public.yourSelection")}</span>}</h3>{group.items.length>0&&<ul>{group.items.map(service=><li key={service.sourceIndex} lang={contentLanguage}>{displayServiceDetail(service,display,locale)}</li>)}</ul>}</section>)}</div>{(w.brands.length>0||w.languages.length>0)&&<div className="profile-facts">{w.brands.length>0&&<div><h3>{t("public.brands")}</h3><div className="brand-tags">{w.brands.map(brand=><span key={brand} className={matches.brand&&(brand===selection.brand||brand==="Alle Marken")?"profile-brand-selected":undefined}>{valueLabel(locale,"sentinel",brand)}{matches.brand&&(brand===selection.brand||brand==="Alle Marken")&&<span className="profile-selection-label">{t("public.yourSelection")}</span>}</span>)}</div></div>}{w.languages.length>0&&<div><h3>{t("public.consultationLanguages")}</h3><p><Globe size={15}/>{w.languages.map(language=>valueLabel(locale,"language",language)).join(" · ")}</p></div>}</div>}</section>
   <section className="profile-page-section" id="bewertungen"><div className="profile-section-heading"><h2>{t("public.reviews")}</h2><button className="text-action" onClick={openReview}>{t("public.writeReview")}</button></div><div className="profile-review-stream">
    {reviews.length?<>{riparimReviews}{googleReviews}</>:<>{googleReviews}{riparimReviews}</>}
    </div>
    <section className="inline-review" id="bewerten"><button type="button" className="inline-review-toggle" aria-expanded={reviewOpen} aria-controls="review-editor" disabled={reviewBusy} onClick={()=>setReviewOpen(value=>!value)}><span><Star size={19}/><strong>{t("public.experience")}</strong></span><ChevronDown size={19}/></button>{reviewOpen&&<div className="inline-review-body" id="review-editor"><p className="help">{t("public.reviewHelp")}</p><ReviewForm workshop={w} directory={directory} signedIn={signedIn} returnTo={`${path}#bewerten`} onBusyChange={setReviewBusy} onSubmitted={()=>router.refresh()}/></div>}</section>
   </section>
   <details className="profile-sources" id="quellen">
    <summary><span><FileCheck2 size={17}/>{t("public.sourcesDate")}</span><ChevronDown size={18}/></summary>
    <div className="profile-sources-content">
     <p className="profile-scope">{t("public.checkedAt",{date:formatDate(locale,w.checkedAt,{dateOnly:true})})}</p>
     {w.phoneNote&&<p className="profile-scope">{t("public.phoneContact")} <span lang={contentLanguage}>{display?.phoneNote??w.phoneNote}</span></p>}
     <ul className="profile-source-list">
      {w.sources.map((source,index)=><li key={source.url}><LocaleAnchor href={source.url} target="_blank" rel="noopener noreferrer"><strong lang={contentLanguage}>{display?.sourceTitles[index]??source.title}</strong><span>{new URL(source.url).hostname}</span></LocaleAnchor></li>)}
      {w.googleRating?.sourceUrl&&<li><LocaleAnchor href={w.googleRating.sourceUrl} target="_blank" rel="noopener noreferrer"><strong>{t("public.googleSource",{source:w.googleRating.sourceLabel??t("public.ratingSource")})}</strong><span>{t("public.recordedAt",{date:formatDate(locale,w.googleRating.checkedAt)})}{w.googleRating.sourceUpdatedAt?t("public.sourceDate",{date:formatDate(locale,w.googleRating.sourceUpdatedAt)}):""}</span></LocaleAnchor></li>}
     </ul>
    </div>
   </details>
  </div><aside className="workshop-page-aside"><section className="profile-contact-summary" id="standort"><h2>{t("public.contactLocation")}</h2><p className="profile-address"><MapPin size={18}/><span>{w.address}</span></p><LocaleAnchor className="text-action" href={mapHref} target="_blank" rel="noopener noreferrer">{t("public.viewMaps")}</LocaleAnchor>{phoneHref&&<LocaleAnchor className="profile-phone-summary" href={phoneHref}><Phone size={17}/><strong>{w.phone}</strong></LocaleAnchor>}{w.whatsapp&&<div className="profile-contact-actions"><button className="primary" onClick={startWhatsApp}><MessageCircle size={17}/>WhatsApp</button></div>}</section><button className="profile-share" onClick={()=>void copy(`${window.location.origin}${path}`,t("public.profileCopied"))}><Share2 size={16}/>{t("public.shareProfile")}</button>{feedback&&!contact&&<p className="help" role="status">{feedback}</p>}<div className="profile-owner"><LocaleAnchor href={`/betrieb?werkstatt=${encodeURIComponent(w.id)}`}>{t("public.owner")}</LocaleAnchor></div></aside></div>
  <nav className={`profile-mobile-actions${w.whatsapp?" has-whatsapp":""}`} aria-label={t("public.contactWorkshop")}>{w.whatsapp&&<button className="primary" onClick={startWhatsApp}><MessageCircle size={18}/>WhatsApp</button>}{phoneHref&&<LocaleAnchor className={w.whatsapp?"outline":"primary"} href={phoneHref}><Phone size={18}/>{t("public.call")}</LocaleAnchor>}<LocaleAnchor className="outline" href={routeHref} target="_blank" rel="noopener noreferrer"><Navigation size={18}/><span className="profile-route-label">{t("public.route")}</span><span className="profile-route-short">{t("public.routeShort")}</span></LocaleAnchor></nav>
 </main>
 <Dialog open={contact} onOpenChange={setContact}><ModalContent title={t("public.prepareMessage")} description={w.name} footer={<><button className="outline" onClick={()=>void copy(message,t("public.messageCopied"))}><Copy size={16}/>{t("public.copyText")}</button><LocaleAnchor className="primary" href={contactHref(w,"whatsapp",message)??undefined} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>{t("public.openWhatsApp")}</LocaleAnchor></>}>
  <label className="message-label">{t("public.yourMessage")}<textarea rows={5} value={message} maxLength={3000} onChange={e=>setMessage(e.target.value)}/></label><p className="help">{t("public.sendWhatsApp")}</p>{feedback&&<p className="help" role="status">{feedback}</p>}
 </ModalContent></Dialog>
 <MyVisits open={myReviews} onClose={()=>{setMyReviews(false);router.refresh();}} directory={directory} signedIn={signedIn} account={account} onResubmit={visit=>{setMyReviews(false);setEditing(visit);}}/>
 <VisitForm open={!!editing} existing={editing} workshop={directory.find(workshop=>workshop.id===editing?.workshop)??null} directory={directory} signedIn={signedIn} account={account} onClose={()=>{setEditing(null);router.refresh();}} onDone={()=>setMyReviews(true)}/>
 </>;
}
