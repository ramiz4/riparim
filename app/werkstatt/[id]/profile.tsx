"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,ChevronDown,Copy,FileCheck2,Globe,MapPin,MessageCircle,Navigation,Phone,Share2,ShieldCheck,Star} from "lucide-react";
import {SiteHeader} from "@/components/site-header";
import {WorkshopRatings} from "@/components/workshop-ratings";
import {GooglePlaceReviews} from "@/components/google-place-reviews";
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
 const router=useRouter();const [reviewOpen,setReviewOpen]=useState(false),[reviewBusy,setReviewBusy]=useState(false),[myReviews,setMyReviews]=useState(false),[editing,setEditing]=useState<Visit|null>(null),[contact,setContact]=useState(false),[message,setMessage]=useState(""),[feedback,setFeedback]=useState(""),[backHref,setBackHref]=useState("/werkstaetten");
 const path=`/werkstatt/${encodeURIComponent(w.id)}`;
 const mapQuery=w.lat!==null&&w.lng!==null?`${w.lat},${w.lng}`:`${w.name} ${w.address} Kosovo`;
 const mapHref=w.googleRating?.mapsUrl??`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
 const routeHref=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`;
 const phoneHref=contactHref(w,"phone");
 const serviceLabels=[...new Set((w.serviceDetails.length?w.serviceDetails:w.services).map(service=>service.replace(/\s+laut öffentlichem Verzeichnis\.?/gi,"").replace(/\s*Konkreten Umfang direkt klären\.?/gi,"").trim()).filter(Boolean))];
 const description=/^Öffentlicher Werkstatteintrag\./.test(w.description)?"":w.description;
 const specialty=w.specialty.replace(/\s*·\s*Verzeichniseintrag\s*$/i,"");
 // eslint-disable-next-line react-hooks/set-state-in-effect -- The return link uses only a validated public catalogue URL from browser memory.
 useEffect(()=>{const href=profileSearchHref(new URLSearchParams(window.location.search).get("suche"),directory)??profileSearchHref(readSearchSession()?.catalogueHref??null,directory);if(href)setBackHref(href);},[directory]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- A login return may target the inline review section.
 useEffect(()=>{if(window.location.hash==="#bewerten"||new URLSearchParams(window.location.search).get("bewerten")==="1")setReviewOpen(true);},[]);
 function openReview(){setReviewOpen(true);requestAnimationFrame(()=>document.getElementById("bewerten")?.scrollIntoView({behavior:"smooth",block:"start"}));}
 function startWhatsApp(){
  setFeedback("");const context=readSearchSession()?.context;
  setMessage(`Hallo, ich interessiere mich für eine Reparatur bei ${w.name}.${context?`\nFahrzeug: ${context.brand} ${context.model}${context.year?` (${context.year})`:""}\nGewünschte Arbeit: ${context.problem}${context.from||context.to?`\nReisezeitraum: ${context.from||"offen"} bis ${context.to||"offen"}`:""}`:""}\nKönnen wir die Arbeit und einen möglichen Termin besprechen?`);setContact(true);
 }
 async function copy(value:string,label:string){try{await navigator.clipboard.writeText(value);setFeedback(label);}catch{setFeedback("Bitte wähle den Text aus und kopiere ihn manuell.");}}
 return <><SiteHeader account={account} isAdmin={isAdmin} onVisits={()=>setMyReviews(true)} onNewVisit={openReview}/>
 <main className="workshop-page wrap" data-workshop-id={w.id}>
  <WorkshopNavigationLink className="profile-back" href={backHref}><ArrowLeft size={16}/>Zurück zur Suche</WorkshopNavigationLink>
  <header className="workshop-overview"><div className="workshop-overview-identity"><div><p className="profile-place"><MapPin size={15}/>{w.city}{specialty&&` · ${specialty}`}</p><h1>{w.name}</h1><WorkshopRatings key={w.id} workshop={w} compact/></div></div><div className="workshop-overview-actions">{phoneHref&&<a className="primary" href={phoneHref}><Phone size={17}/>Anrufen</a>}<a className="outline" href={routeHref} target="_blank" rel="noopener noreferrer"><Navigation size={17}/>Route planen</a></div></header>
  <nav className="profile-section-nav" aria-label="Profilbereiche"><a href="#leistungen">Leistungen</a><a href="#bewertungen">Bewertungen</a><a href="#standort">Standort</a></nav>
  <div className="workshop-page-grid"><div className="workshop-page-main">
   <section className="profile-page-section" id="leistungen"><div className="profile-section-heading"><h2>Leistungen{w.brands.length?" & Marken":""}</h2></div>{description&&<p className="profile-description">{description}</p>}<ul className="profile-service-tags" aria-label="Angebotene Leistungen">{serviceLabels.map(service=><li key={service}>{service}</li>)}</ul>{(w.brands.length>0||w.languages.length>0)&&<div className="profile-facts">{w.brands.length>0&&<div><h3>Marken</h3><div className="brand-tags">{w.brands.map(brand=><span key={brand}>{brand}</span>)}</div></div>}{w.languages.length>0&&<div><h3>Beratungssprachen</h3><p><Globe size={15}/>{w.languages.join(" · ")}</p></div>}</div>}</section>
   <section className="profile-page-section" id="bewertungen"><div className="profile-section-heading"><h2>Bewertungen</h2><button className="text-action" onClick={openReview}>Bewertung schreiben</button></div><div className="profile-review-provider"><h3><ShieldCheck size={18}/>Riparim</h3><p>Bewertungen mit geprüftem Besuchsnachweis.</p></div>{reviewError?<p className="error" role="alert">{reviewError}</p>:reviews.length?<div className="public-review-list">{reviews.map((review,index)=><article className="public-review" key={`${review.display_name}:${review.date}:${index}`}><div className="review-title"><strong>{review.display_name}</strong><span><Star size={14} fill="currentColor"/>{review.rating} / 5</span></div><p className="review-meta">{review.vehicle} · {review.service} · {new Date(review.date+"T12:00:00").toLocaleDateString("de-DE")}</p><p className="public-review-text">{review.review}</p><span className="proof-badge"><ShieldCheck size={13}/>Besuchsnachweis geprüft</span></article>)}{w.count>reviews.length&&<p className="help">Die neuesten {reviews.length} Bewertungen werden angezeigt.</p>}</div>:<p className="profile-review-empty">Noch keine Riparim-Bewertungen. Teile deine Erfahrung.</p>}
    <section className="inline-review" id="bewerten"><button type="button" className="inline-review-toggle" aria-expanded={reviewOpen} aria-controls="review-editor" disabled={reviewBusy} onClick={()=>setReviewOpen(value=>!value)}><span><Star size={19}/><strong>Deine Werkstatterfahrung</strong></span><ChevronDown size={19}/></button>{reviewOpen&&<div className="inline-review-body" id="review-editor"><p className="help">Bewertung und privaten Beleg gemeinsam einreichen. Nach Freigabe erscheint deine Erfahrung hier.</p><ReviewForm workshop={w} directory={directory} signedIn={signedIn} returnTo={`${path}#bewerten`} onBusyChange={setReviewBusy} onSubmitted={()=>router.refresh()}/></div>}</section>
    <div className="profile-google-reviews" id="google-bewertungen"><div className="profile-review-provider"><h3 translate="no">Google Maps</h3><p>Google-Rezensionen werden separat angezeigt.</p></div><GooglePlaceReviews key={w.id} workshop={w}/></div>
   </section>
   <details className="profile-sources" id="quellen">
    <summary><span><FileCheck2 size={17}/>Quellen & Datenstand</span><ChevronDown size={18}/></summary>
    <div className="profile-sources-content">
     <p className="profile-scope">Abgeglichen am {new Date(w.checkedAt+"T12:00:00").toLocaleDateString("de-DE")}. Angaben aus öffentlichen Quellen; keine unabhängige Qualitätsprüfung.</p>
     {w.phoneNote&&<p className="profile-scope">Telefonkontakt: {w.phoneNote.replace(/[.!]$/,"")}.</p>}
     <ul className="profile-source-list">
      {w.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer"><strong>{source.title}</strong><span>{new URL(source.url).hostname}</span></a></li>)}
      {w.googleRating?.sourceUrl&&<li><a href={w.googleRating.sourceUrl} target="_blank" rel="noopener noreferrer"><strong>Google-Angaben: {w.googleRating.sourceLabel??"Quelle der Bewertung"}</strong><span>Erfasst am {new Date(w.googleRating.checkedAt).toLocaleDateString("de-DE")}{w.googleRating.sourceUpdatedAt?` · Quellenstand ${new Date(w.googleRating.sourceUpdatedAt).toLocaleDateString("de-DE")}`:""}</span></a></li>}
     </ul>
    </div>
   </details>
  </div><aside className="workshop-page-aside"><section className="profile-contact-summary" id="standort"><h2>Kontakt & Standort</h2><p className="profile-address"><MapPin size={18}/><span>{w.address}</span></p><a className="text-action" href={mapHref} target="_blank" rel="noopener noreferrer">Auf Google Maps ansehen</a>{phoneHref&&<a className="profile-phone-summary" href={phoneHref}><Phone size={17}/><strong>{w.phone}</strong></a>}<div className="profile-contact-actions">{phoneHref&&<a className="primary" href={phoneHref}><Phone size={17}/>Anrufen</a>}<a className="outline" href={routeHref} target="_blank" rel="noopener noreferrer"><Navigation size={17}/>Route planen</a>{w.whatsapp&&<button className="outline" onClick={startWhatsApp}><MessageCircle size={17}/>WhatsApp</button>}</div><details className="profile-map"><summary><span><MapPin size={16}/>Karte anzeigen</span><ChevronDown size={17}/></summary><iframe title={`Standort von ${w.name}`} src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&hl=de&z=15&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/></details></section><button className="profile-share" onClick={()=>void copy(`${window.location.origin}${path}`,"Profillink kopiert.")}><Share2 size={16}/>Profil teilen</button>{feedback&&!contact&&<p className="help" role="status">{feedback}</p>}</aside></div>
  <nav className="profile-mobile-actions" aria-label="Werkstatt kontaktieren">{phoneHref&&<a className="primary" href={phoneHref}><Phone size={18}/>Anrufen</a>}<a className="outline" href={routeHref} target="_blank" rel="noopener noreferrer"><Navigation size={18}/>Route planen</a></nav>
 </main>
 <Dialog open={contact} onOpenChange={setContact}><ModalContent title="Nachricht vorbereiten" description={w.name} footer={<><button className="outline" onClick={()=>void copy(message,"Nachricht kopiert.")}><Copy size={16}/>Text kopieren</button><a className="primary" href={contactHref(w,"whatsapp",message)??undefined} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/>WhatsApp öffnen</a></>}>
  <label className="message-label">Deine Nachricht<textarea rows={5} value={message} maxLength={3000} onChange={e=>setMessage(e.target.value)}/></label><p className="help">Du sendest die Nachricht selbst in WhatsApp.</p>{feedback&&<p className="help" role="status">{feedback}</p>}
 </ModalContent></Dialog>
 <MyVisits open={myReviews} onClose={()=>{setMyReviews(false);router.refresh();}} directory={directory} signedIn={signedIn} account={account} onResubmit={visit=>{setMyReviews(false);setEditing(visit);}}/>
 <VisitForm open={!!editing} existing={editing} workshop={directory.find(workshop=>workshop.id===editing?.workshop)??null} directory={directory} signedIn={signedIn} account={account} onClose={()=>{setEditing(null);router.refresh();}} onDone={()=>setMyReviews(true)}/>
 </>;
}
