"use client";
import {useId,useRef,useState,type FormEvent} from "react";
import {FileCheck2,LoaderCircle,ShieldCheck,Star,Upload} from "lucide-react";
import {Checkbox} from "@/components/ui/checkbox";
import {Picker} from "@/components/picker";
import {AccountStorageNotice} from "@/components/account-storage-notice";
import {services,type Workshop} from "@/lib/workshops";
import type {Visit} from "@/app/journeys";

type Props={workshop:Workshop|null;directory:Workshop[];signedIn:boolean;existing?:Visit|null;formId?:string;showSubmit?:boolean;returnTo:string;onSubmitted?:()=>void;onBusyChange?:(busy:boolean)=>void};
export function ReviewForm({workshop,directory,signedIn,existing=null,formId,showSubmit=true,returnTo,onSubmitted,onBusyChange}:Props){
 const generatedId=useId(),id=formId??generatedId,consentId=useId();
 const consentCheckbox=useRef<HTMLButtonElement>(null),ratingGroup=useRef<HTMLDivElement>(null);
 const [submissionId]=useState(()=>existing?.id??crypto.randomUUID());
 const [wid,setWid]=useState(existing?.workshop??workshop?.id??directory[0]?.id??""),[kind,setKind]=useState(existing?.evidence_type??"Rechnung"),[service,setService]=useState(existing?.service??workshop?.services[0]??directory[0]?.services[0]??services[1]);
 const [vehicle,setVehicle]=useState(existing?.vehicle??""),[date,setDate]=useState(existing?.date??""),[note,setNote]=useState(existing?.evidence_note??""),[rating,setRating]=useState(existing?.rating??0),[name,setName]=useState(existing?.display_name??""),[review,setReview]=useState(existing?.review??"");
 const [consent,setConsent]=useState(false),[consentError,setConsentError]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[done,setDone]=useState(false);
 function changeBusy(value:boolean){setBusy(value);onBusyChange?.(value);}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!rating){setError("Bitte wähle 1 bis 5 Sterne.");ratingGroup.current?.querySelector<HTMLButtonElement>("button")?.focus();return;}if(!consent){setConsentError(true);consentCheckbox.current?.focus();return;}
  changeBusy(true);setError("");const f=new FormData(e.currentTarget);f.set("id",submissionId);f.set("workshop",wid);f.set("service",service);f.set("evidenceType",kind);f.set("rating",String(rating));f.set("revision",String(existing?.revision??0));f.set("consent","true");if(existing?.file_name)f.set("keepEvidence","true");
  try{const r=await fetch("/api/visits",{method:existing?"PUT":"POST",body:f}),d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error);setDone(true);onSubmitted?.();}catch(e){setError(e instanceof Error?e.message:"Einreichen fehlgeschlagen. Deine Eingaben bleiben erhalten.");}finally{changeBusy(false);}
 }
 if(!signedIn)return <div className="login-prompt"><ShieldCheck size={25}/><p>Melde dich an, um eine Bewertung einzureichen.</p><a className="primary" href={`/anmelden?weiter=${encodeURIComponent(returnTo)}`}>Anmelden oder registrieren</a><p className="help">Dein Beleg bleibt privat. Die Bewertung erscheint erst nach Freigabe.</p></div>;
 if(done)return <div className="review-submission-success" role="status"><FileCheck2 size={30}/><h3>Bewertung eingereicht</h3><p>Die Verwaltung prüft Bewertung und Nachweis. Nach Freigabe erscheint deine Erfahrung im Profil.</p><AccountStorageNotice/></div>;
 if(!directory.length)return <p className="help">Keine veröffentlichte Werkstatt verfügbar.</p>;
 return <form id={id} className="journey-form combined-review-form" onSubmit={submit} aria-label="Bewertung und privaten Besuchsnachweis einreichen">
  {existing?.moderator_note&&<div className="note"><p>Prüfhinweis: {existing.moderator_note}</p></div>}{existing?.status==="published"&&<p className="note">Änderungen werden erneut geprüft. Die bisherige Bewertung wird bis dahin ausgeblendet.</p>}
  {!workshop&&<div className="field"><label>Werkstatt</label><Picker value={wid} onChange={setWid} values={directory.map(w=>w.id)} label="Bewertete Werkstatt" displayLabels={Object.fromEntries(directory.map(w=>[w.id,w.name]))}/></div>}
  <fieldset className="review-section"><legend>Deine Erfahrung</legend>
   <div className="form-grid"><label>Besuchsdatum<input required name="date" type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={e=>setDate(e.target.value)}/></label><label>Fahrzeug<input required name="vehicle" minLength={3} maxLength={100} placeholder="z. B. Audi A4, 2018" value={vehicle} onChange={e=>setVehicle(e.target.value)}/></label></div>
   <div className="field"><label>Durchgeführte Arbeit</label><Picker value={service} onChange={setService} values={services.slice(1)} label="Durchgeführte Arbeit"/></div>
   <div><label id={`${id}-rating`}>Deine Sterne</label><div className="star-rating" role="radiogroup" aria-labelledby={`${id}-rating`} aria-required="true" ref={ratingGroup}>{[1,2,3,4,5].map(value=><button key={value} type="button" role="radio" aria-checked={rating===value} aria-label={`${value} ${value===1?"Stern":"Sterne"}`} tabIndex={rating===value||(!rating&&value===1)?0:-1} onClick={()=>{setRating(value);setError("");}} onKeyDown={e=>{if(["ArrowRight","ArrowUp","ArrowLeft","ArrowDown","Home","End"].includes(e.key)){e.preventDefault();const next=e.key==="Home"?1:e.key==="End"?5:Math.max(1,Math.min(5,value+(["ArrowRight","ArrowUp"].includes(e.key)?1:-1)));setRating(next);e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next-1]?.focus();}}}><Star size={26} fill={value<=rating?"currentColor":"none"}/></button>)}<span>{rating?`${rating} / 5`:"Bitte wählen"}</span></div></div>
   <label>Deine Bewertung<textarea required name="review" minLength={30} maxLength={2000} rows={3} placeholder="Wie waren Arbeit, Ergebnis und Kommunikation? Mindestens 30 Zeichen." value={review} onChange={e=>setReview(e.target.value)}/></label>
   <label>Öffentlicher Anzeigename<input required name="name" minLength={2} maxLength={40} placeholder="z. B. Arben K." value={name} onChange={e=>setName(e.target.value)}/></label><p className="help">Nach Freigabe sichtbar: Anzeigename, Fahrzeug, Arbeit, Datum, Sterne und Text.</p>
  </fieldset>
  <fieldset className="review-section"><legend>Privater Besuchsnachweis</legend><AccountStorageNotice/><div className="field"><label>Nachweisart</label><Picker value={kind} onChange={setKind} values={["Rechnung","Service- oder Arbeitsbeleg","Anderer Nachweis"]} label="Nachweisart"/></div>
   {existing?.file_name&&<p className="existing-evidence"><FileCheck2 size={17}/>Vorhandener Beleg: {existing.file_name}<span>Wird weiterverwendet, wenn du keinen neuen hochlädst.</span></p>}
   <label className="upload"><Upload size={20}/><strong>{existing?.file_name?"Beleg ersetzen (optional)":"Beleg hochladen"}</strong><span>PDF, JPG oder PNG · max. 5 MB</span><input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required={kind!=="Anderer Nachweis"&&!existing?.file_name}/></label>
   <label>{kind==="Anderer Nachweis"?"Anderen Nachweis beschreiben":"Hinweis zum Beleg (optional)"}<textarea name="evidenceNote" rows={2} minLength={kind==="Anderer Nachweis"?40:undefined} required={kind==="Anderer Nachweis"} maxLength={3000} value={note} onChange={e=>setNote(e.target.value)} placeholder={kind==="Anderer Nachweis"?"Zum Beispiel datierte Reparaturfotos und Nachrichten. Werkstatt, Datum und Arbeit müssen nachvollziehbar sein.":"Was hilft bei der Prüfung?"}/></label><p className="help">Persönliche Daten darfst du schwärzen. Werkstatt, Datum und Arbeit müssen erkennbar bleiben.</p>
  </fieldset>
  <div className={`consent-block${consentError?" invalid":""}`}><label className="consent" htmlFor={consentId}><Checkbox id={consentId} ref={consentCheckbox} checked={consent} onCheckedChange={v=>{setConsent(v===true);if(v===true)setConsentError(false);}} aria-label="Besuch und private Prüfung bestätigen" aria-invalid={consentError} aria-describedby={`${consentId}-help${consentError?` ${consentId}-error`:""}`}/><span><strong>Besuch und private Prüfung bestätigen</strong><span>Ich war bei dieser Werkstatt. Bewertung und Nachweis dürfen geprüft werden; die Bewertung darf nach Freigabe veröffentlicht werden.</span></span></label><p className="consent-help" id={`${consentId}-help`}>Dein Beleg bleibt privat. Unter „Meine Bewertungen“ kannst du die gesamte Einreichung löschen.</p>{consentError&&<p className="consent-error" id={`${consentId}-error`} role="alert">Bitte aktiviere die Checkbox direkt darüber.</p>}</div>
  {error&&<p role="alert" className="error">{error}</p>}{showSubmit&&<button type="submit" disabled={busy} className="primary review-submit">{busy?<><LoaderCircle className="spin" size={17}/>Wird eingereicht …</>:"Bewertung einreichen"}</button>}
 </form>;
}
