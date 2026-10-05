"use client";
import {useI18n} from "@/lib/i18n/client";
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
import {WorkshopGoogleMap,WorkshopOpeningHours,WorkshopPhotos} from "@/components/workshop-google-details";
import {defaultCatalogueFilters,parseCatalogueFilters} from "@/lib/catalogue-filters";
import {groupWorkshopServices,profileSelection,workshopSelectionMatches,type ProfileSelection} from "@/lib/workshop-profile-content";
import {ReviewForm} from "@/components/review-form";
import {ModalContent} from "@/components/modal-shell";
import {Dialog} from "@/components/ui/dialog";
import type {AccountIdentity} from "@/components/account-storage-notice";
import {MyVisits,VisitForm,type Review,type Visit} from "@/app/journeys";
import {contactHref,type Workshop} from "@/lib/workshops";
import {readSearchSession} from "@/lib/search-session";
import {profileSearchHref} from "@/lib/profile-navigation";
import {WorkshopNavigationLink} from "@/components/workshop-navigation-link";

type Props={workshop:Workshop;directory:Workshop[];reviews:Review[];reviewError:string;signedIn:boolean;account:AccountIdentity|null;isAdmin:boolean};
export default function WorkshopProfile({workshop:w,directory,reviews,reviewError,signedIn,account,isAdmin}:Props){
 const {locale}=useI18n();
 const router=useRouter();const [reviewOpen,setReviewOpen]=useState(false),[reviewBusy,setReviewBusy]=useState(false),[myReviews,setMyReviews]=useState(false),[editing,setEditing]=useState<Visit|null>(null),[contact,setContact]=useState(false),[message,setMessage]=useState(""),[feedback,setFeedback]=useState(""),[backHref,setBackHref]=useState("/werkstaetten");
 const {profile,identity,status}=useGoogleWorkshopProfile(w.id);
 const [selection,setSelection]=useState<ProfileSelection>({brand:null,service:null,vehicle:null});
 const path=localizeHref(`/werkstatt/${encodeURIComponent(w.id)}`,locale);
 const mapHref=workshopMapsUrl(w,identity?.placeId);
 const routeHref=workshopRouteUrl(w,identity?.placeId);
 const phoneHref=contactHref(w,"phone");
 const serviceGroups=groupWorkshopServices(w),matches=workshopSelectionMatches(w,selection);
 const hasPhotos=status==="ready"&&!!profile?.photos.length;
 const description=/^Öffentlicher Werkstatteintrag\./.test(w.description)?"":w.description;
 const specialty=w.specialty.replace(/\s*·\s*Verzeichniseintrag\s*$/i,"");
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Search details stay in browser memory; only validated public filters enter URLs.
 useEffect(()=>{const session=readSearchSession(),explicit=profileSearchHref(new URLSearchParams(window.location.search).get("suche"),directory),remembered=profileSearchHref(session?.catalogueHref??null,directory),href=explicit??remembered;setBackHref(localizeHref(href??"/werkstaetten",locale));const filters=href?parseCatalogueFilters(new URL(href,window.location.origin).searchParams,directory):defaultCatalogueFilters;setSelection(profileSelection(filters,session?.privateMatchingActive&&(!explicit||explicit===remembered)?session.context:null));},[directory,w.id,locale]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- A login return may target the inline review section.
 useEffect(()=>{if(window.location.hash==="#bewerten"||new URLSearchParams(window.location.search).get("bewerten")==="1")setReviewOpen(true);},[]);
 function openReview(){setReviewOpen(true);requestAnimationFrame(()=>document.getElementById("bewerten")?.scrollIntoView({behavior:"smooth",block:"start"}));}
 function startWhatsApp(){
  setFeedback("");const session=readSearchSession(),context=session?.privateMatchingActive?session.context:null;
  setMessage(`Hallo, ich interessiere mich für eine Reparatur bei ${w.name}.${context?`\nFahrzeug: ${context.brand} ${context.model}${context.year?` (${context.year})`:""}\nGewünschte Arbeit: ${context.problem}${context.from||context.to?`\nReisezeitraum: ${context.from||"offen"} bis ${context.to||"offen"}`:""}`:""}\nKönnen wir die Arbeit und einen möglichen Termin besprechen?`);setContact(true);
 }
 async function copy(value:string,label:string){try{await navigator.clipboard.writeText(value);setFeedback(label);}catch{setFeedback("Bitte wähle den Text aus und kopiere ihn manuell.");}}
 const googleReviews=<div className="profile-google-reviews" id="google-bewertungen"><div className="profile-review-provider"><h3 translate="no">Google Maps</h3><p>Aktuelle Rezensionen zum bestätigten Google-Eintrag.</p></div><GooglePlaceReviews key={w.id} workshop={w} identity={identity} liveRating={profile?.rating??null} status={status}/></div>;
 const riparimReviews=<div className={`profile-riparim-reviews${!reviews.length&&!reviewError?" empty":""}`}><div className="profile-review-provider"><h3><ShieldCheck size={18}/>Riparim</h3>{reviews.length>0&&<p>Bewertungen mit geprüftem Besuchsnachweis.</p>}</div>{reviewError?<p className="error" role="alert">{reviewError}</p>:reviews.length?<div className="public-review-list">{reviews.map((review,index)=><article className="public-review" key={`${review.display_name}:${review.date}:${index}`}><div className="review-title"><strong>{review.display_name}</strong><span><Star size={14} fill="currentColor"/>{review.rating} / 5</span></div><p className="review-meta">{review.vehicle} · {review.service} · {new Date(review.date+"T12:00:00").toLocaleDateString("de-DE")}</p><p className="public-review-text">{review.review}</p><span className="proof-badge"><ShieldCheck size={13}/>Besuchsnachweis geprüft</span></article>)}{w.count>reviews.length&&<p className="help">Die neuesten {reviews.length} Bewertungen werden angezeigt.</p>}</div>:<p className="profile-review-empty">Noch keine Bewertungen mit Besuchsnachweis.</p>}</div>;
 return <><SiteHeader account={account} isAdmin={isAdmin} onVisits={()=>setMyReviews(true)} onNewVisit={openReview}/>
 <main className="workshop-page wrap" data-workshop-id={w.id}>
  <LocaleAnchor className="text-action" href={`/betrieb?werkstatt=${encodeURIComponent(w.id)}`}>Ich betreibe diese Werkstatt</LocaleAnchor>
  <WorkshopNavigationLink className="profile-back" href={backHref}><ArrowLeft size={16}/>Zurück zur Suche</WorkshopNavigationLink>
  <header className="workshop-overview"><div className="workshop-overview-identity"><div><p className="profile-place"><MapPin size={15}/>{w.city}{specialty&&` · ${specialty}`}</p><h1>{w.name}</h1><WorkshopRatings key={w.id} workshop={w} compact googleState={{live:profile?.rating??null,status}}/><WorkshopOpeningHours profile={profile} status={status} mapsUrl={mapHref}/></div></div><div className="workshop-overview-actions">{w.whatsapp&&<button className="primary" onClick={startWhatsApp}><MessageCircle size={17}/>WhatsApp</button>}{phoneHref&&<LocaleAnchor className={w.whatsapp?"outline":"primary"} href={phoneHref}><Phone size={17}/>Anrufen</LocaleAnchor>}<LocaleAnchor className="outline" href={routeHref} target="_blank" rel="noopener noreferrer"><Navigation size={17}/>Route planen</LocaleAnchor></div></header>
  <WorkshopPhotos key={w.id} name={w.name} profile={profile} identity={identity} status={status}/>
  <nav className="profile-section-nav" aria-label="Profilbereiche"><LocaleAnchor href="#leistungen">Leistungen</LocaleAnchor><LocaleAnchor href="#bewertungen">Bewertungen</LocaleAnchor><LocaleAnchor href="#standort">Standort</LocaleAnchor>{hasPhotos&&<LocaleAnchor href="#fotos">Fotos</LocaleAnchor>}</nav>
  <div className="workshop-page-grid"><div className="workshop-page-main">
   <section className="profile-page-section" id="leistungen"><div className="profile-section-heading"><h2>Leistungen{w.brands.length?" & Marken":""}</h2></div>{(selection.brand||selection.service)&&<div className="profile-search-match"><p>Deine Suche{selection.vehicle?`: ${selection.vehicle}`:selection.brand?`: ${selection.brand}`:""}</p><div>{matches.brand&&<span><Check size={14}/>{selection.brand} im Markenangebot</span>}{matches.service&&<span><Check size={14}/>{selection.service} im Leistungsangebot</span>}</div></div>}{description&&<p className="profile-description">{description}</p>}<div className="profile-service-groups" aria-label="Angebotene Leistungen">{serviceGroups.map(group=><section key={group.title} className={`profile-service-group${matches.service&&group.title===selection.service?" selected":""}`}><h3>{group.title}{matches.service&&group.title===selection.service&&<span className="profile-selection-label">Deine Auswahl</span>}</h3>{group.items.length>0&&<ul>{group.items.map(service=><li key={service}>{service}</li>)}</ul>}</section>)}</div>{(w.brands.length>0||w.languages.length>0)&&<div className="profile-facts">{w.brands.length>0&&<div><h3>Marken</h3><div className="brand-tags">{w.brands.map(brand=><span key={brand} className={matches.brand&&(brand===selection.brand||brand==="Alle Marken")?"profile-brand-selected":undefined}>{brand}{matches.brand&&(brand===selection.brand||brand==="Alle Marken")&&<span className="profile-selection-label">Deine Auswahl</span>}</span>)}</div></div>}{w.languages.length>0&&<div><h3>Beratungssprachen</h3><p><Globe size={15}/>{w.languages.join(" · ")}</p></div>}</div>}</section>
   <section className="profile-page-section" id="bewertungen"><div className="profile-section-heading"><h2>Bewertungen</h2><button className="text-action" onClick={openReview}>Bewertung schreiben</button></div><div className="profile-review-stream">
    {reviews.length?<>{riparimReviews}{googleReviews}</>:<>{googleReviews}{riparimReviews}</>}
    </div>
    <section className="inline-review" id="bewerten"><button type="button" className="inline-review-toggle" aria-expanded={reviewOpen} aria-controls="review-editor" disabled={reviewBusy} onClick={()=>setReviewOpen(value=>!value)}><span><Star size={19}/><strong>Deine Werkstatterfahrung</strong></span><ChevronDown size={19}/></button>{reviewOpen&&<div className="inline-review-body" id="review-editor"><p className="help">Bewertung und privaten Beleg gemeinsam einreichen. Nach Freigabe erscheint deine Erfahrung hier.</p><ReviewForm workshop={w} directory={directory} signedIn={signedIn} returnTo={`${path}#bewerten`} onBusyChange={setReviewBusy} onSubmitted={()=>router.refresh()}/></div>}</section>
   </section>
   <details className="profile-sources" id="quellen">
    <summary><span><FileCheck2 size={17}/>Quellen & Datenstand</span><ChevronDown size={18}/></summary>
    <div className="profile-sources-content">
     <p className="profile-scope">Abgeglichen am {new Date(w.checkedAt+"T12:00:00").toLocaleDateString("de-DE")}. Angaben aus öffentlichen Quellen; keine unabhängige Qualitätsprüfung.</p>
     {w.phoneNote&&<p className="profile-scope">Telefonkontakt: {w.phoneNote.replace(/[.!]$/,"")}.</p>}
     <ul className="profile-source-list">
      {w.sources.map(source=><li key={source.url}><LocaleAnchor href={source.url} target="_blank" rel="noopener noreferrer"><strong>{source.title}</strong><span>{new URL(source.url).hostname}</span></LocaleAnchor></li>)}
      {w.googleRating?.sourceUrl&&<li><LocaleAnchor href={w.googleRating.sourceUrl} target="_blank" rel="noopener noreferrer"><strong>Google-Angaben: {w.googleRating.sourceLabel??"Quelle der Bewertung"}</strong><span>Erfasst am {new Date(w.googleRating.checkedAt).toLocaleDateString("de-DE")}{w.googleRating.sourceUpdatedAt?` · Quellenstand ${new Date(w.googleRating.sourceUpdatedAt).toLocaleDateString("de-DE")}`:""}</span></LocaleAnchor></li>}
     </ul>
    </div>
   </details>
  </div><aside className="workshop-page-aside"><section className="profile-contact-summary" id="standort"><h2>Kontakt & Standort</h2><p className="profile-address"><MapPin size={18}/><span>{w.address}</span></p><LocaleAnchor className="text-action" href={mapHref} target="_blank" rel="noopener noreferrer">Auf Google Maps ansehen</LocaleAnchor>{phoneHref&&<LocaleAnchor className="profile-phone-summary" href={phoneHref}><Phone size={17}/><strong>{w.phone}</strong></LocaleAnchor>}{w.whatsapp&&<div className="profile-contact-actions"><button className="primary" onClick={startWhatsApp}><MessageCircle size={17}/>WhatsApp</button></div>}<WorkshopGoogleMap key={w.id} name={w.name} profile={profile} identity={identity} status={status} mapsUrl={mapHref}/></section><button className="profile-share" onClick={()=>void copy(`${window.location.origin}${path}`,"Profillink kopiert.")}><Share2 size={16}/>Profil teilen</button>{feedback&&!contact&&<p className="help" role="status">{feedback}</p>}</aside></div>
  <nav className={`profile-mobile-actions${w.whatsapp?" has-whatsapp":""}`} aria-label="Werkstatt kontaktieren">{w.whatsapp&&<button className="primary" onClick={startWhatsApp}><MessageCircle size={18}/>WhatsApp</button>}{phoneHref&&<LocaleAnchor className={w.whatsapp?"outline":"primary"} href={phoneHref}><Phone size={18}/>Anrufen</LocaleAnchor>}<LocaleAnchor className="outline" href={routeHref} target="_blank" rel="noopener noreferrer"><Navigation size={18}/><span className="profile-route-label">Route planen</span><span className="profile-route-short">Route</span></LocaleAnchor></nav>
 </main>
 <Dialog open={contact} onOpenChange={setContact}><ModalContent title="Nachricht vorbereiten" description={w.name} footer={<><button className="outline" onClick={()=>void copy(message,"Nachricht kopiert.")}><Copy size={16}/>Text kopieren</button><LocaleAnchor className="primary" href={contactHref(w,"whatsapp",message)??undefined} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>WhatsApp öffnen</LocaleAnchor></>}>
  <label className="message-label">Deine Nachricht<textarea rows={5} value={message} maxLength={3000} onChange={e=>setMessage(e.target.value)}/></label><p className="help">Du sendest die Nachricht selbst in WhatsApp.</p>{feedback&&<p className="help" role="status">{feedback}</p>}
 </ModalContent></Dialog>
 <MyVisits open={myReviews} onClose={()=>{setMyReviews(false);router.refresh();}} directory={directory} signedIn={signedIn} account={account} onResubmit={visit=>{setMyReviews(false);setEditing(visit);}}/>
 <VisitForm open={!!editing} existing={editing} workshop={directory.find(workshop=>workshop.id===editing?.workshop)??null} directory={directory} signedIn={signedIn} account={account} onClose={()=>{setEditing(null);router.refresh();}} onDone={()=>setMyReviews(true)}/>
 </>;
}
