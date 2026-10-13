"use client";
import {reviewServiceValues,reviewTextMaxLength} from "@/lib/review";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,type CodedResponse} from "@/lib/i18n/codes";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useEffect,useId,useRef,useState,type FormEvent} from "react";
import {FileCheck2,LoaderCircle,ShieldCheck,Star,Upload} from "lucide-react";
import {Checkbox} from "@/components/ui/checkbox";
import {SearchablePicker} from "@/components/searchable-picker";
import {valueLabel} from "@/lib/i18n/values";
import {Field,FieldLabel} from "@/components/ui/field";
import {Picker} from "@/components/picker";
import {AccountStorageNotice,type AccountIdentity} from "@/components/account-storage-notice";
import {services,type Workshop} from "@/lib/workshops";
import type {Visit} from "@/app/journeys";

export type ReviewFormDraft={submissionId:string;wid:string;kind:string;service:string|string[];vehicle:string;date:string;note:string;rating:number;review:string;consent:boolean;file:File|null;dirty:boolean};
type Props={draft?:ReviewFormDraft;onDraftChange?:(draft:ReviewFormDraft)=>void;workshop:Workshop|null;directory:Workshop[];signedIn:boolean;account?:AccountIdentity|null;existing?:Visit|null;formId?:string;showSubmit?:boolean;returnTo:string;onSubmitted?:()=>void;onBusyChange?:(busy:boolean)=>void};
export function ReviewForm({workshop,directory,signedIn,existing=null,formId,showSubmit=true,returnTo,onSubmitted,onBusyChange,draft,onDraftChange}:Props){
 const {locale,t}=useI18n();
 const generatedId=useId(),id=formId??generatedId,consentId=useId();
 const consentCheckbox=useRef<HTMLButtonElement>(null),ratingGroup=useRef<HTMLDivElement>(null);
 const [submissionId]=useState(()=>draft?.submissionId??existing?.id??crypto.randomUUID());
 const initialServices=existing?reviewServiceValues(existing):[workshop?.services[0]??directory[0]?.services[0]??services[1]];
 const [wid,setWid]=useState(draft?.wid??existing?.workshop??workshop?.id??directory[0]?.id??""),[kind,setKind]=useState(draft?.kind??existing?.evidence_type??"Rechnung"),[service,setService]=useState<string|string[]>(draft?.service??initialServices);
 const [vehicle,setVehicle]=useState(draft?.vehicle??existing?.vehicle??""),[date,setDate]=useState(draft?.date??existing?.date??""),[note,setNote]=useState(draft?.note??existing?.evidence_note??""),[rating,setRating]=useState(draft?.rating??existing?.rating??0),[review,setReview]=useState(draft?.review??existing?.review??"");
 const [consent,setConsent]=useState(draft?.consent??false),[consentError,setConsentError]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[done,setDone]=useState(false);
 const workshopName=directory.find(w=>w.id===wid)?.name??workshop?.name??existing?.workshop_name;
 const [selectedFile,setSelectedFile]=useState<File|null>(draft?.file??null);
 const fileSelected=!!selectedFile,selectedServices=Array.isArray(service)?service:[service];
 const dirty=signedIn&&!done&&(fileSelected||wid!==(existing?.workshop??workshop?.id??directory[0]?.id??"")||JSON.stringify(selectedServices)!==JSON.stringify(initialServices)||vehicle!==(existing?.vehicle??"")||date!==(existing?.date??"")||note!==(existing?.evidence_note??"")||rating!==(existing?.rating??0)||review!==(existing?.review??"")||kind!==(existing?.evidence_type??"Rechnung")||consent);
 useNavigationGuard({busy,dirty});
 useEffect(()=>{if(!done)onDraftChange?.({submissionId,wid,kind,service,vehicle,date,note,rating,review,consent,file:selectedFile,dirty});},[onDraftChange,done,submissionId,wid,kind,service,vehicle,date,note,rating,review,consent,selectedFile,dirty]);
 function changeBusy(value:boolean){setBusy(value);onBusyChange?.(value);}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!selectedServices.length){setError(t("customer.chooseWork"));document.getElementById(`${id}-service`)?.focus();return;}if(!rating){setError(t("customer.chooseStars"));ratingGroup.current?.querySelector<HTMLButtonElement>("button")?.focus();return;}if(!consent){setConsentError(true);consentCheckbox.current?.focus();return;}
  changeBusy(true);setError("");const f=new FormData(e.currentTarget);if(selectedFile)f.set("file",selectedFile);f.set("id",submissionId);f.set("workshop",wid);f.set("service",selectedServices[0]);f.set("services",JSON.stringify(selectedServices));f.set("evidenceType",kind);f.set("rating",String(rating));f.set("revision",String(existing?.revision??0));f.set("consent","true");if(existing?.file_name)f.set("keepEvidence","true");
  try{const r=await fetch("/api/visits",{method:existing?"PUT":"POST",body:f}),d=await r.json() as CodedResponse;if(!r.ok)throw responseError(t,d);setDone(true);onSubmitted?.();}catch(e){setError(e instanceof LocalizedError?e.message:t("customer.reviewUnavailable"));}finally{changeBusy(false);}
 }
 if(!signedIn)return <div className="login-prompt"><ShieldCheck size={25}/><p>{t("customer.reviewLogin")}</p>{workshopName&&<p><strong>{t("customer.workshop")}: {workshopName}</strong></p>}<LocaleAnchor className="primary" href={`/anmelden?weiter=${encodeURIComponent(returnTo)}`}>{t("customer.loginOrRegister")}</LocaleAnchor><p className="help">{t("customer.reviewPrivacy")}</p></div>;
 if(done)return <div className="review-submission-success" role="status"><FileCheck2 size={30}/><h3>{t("customer.reviewSubmitted")}</h3><p>{t("customer.reviewSubmittedNote")}</p><AccountStorageNotice/></div>;
 if(!directory.length)return <p className="help">{t("customer.noWorkshop")}</p>;
 return <form id={id} className="journey-form combined-review-form" onSubmit={submit} aria-label={t("customer.reviewForm")}>
  {workshopName&&(!workshop||existing)&&<p className="note"><strong>{t("customer.workshop")}: {workshopName}</strong></p>}
  {existing?.moderator_note&&<div className="note"><p>{t("customer.moderationNote",{note:existing.moderator_note})}</p></div>}{existing?.status==="published"&&<p className="note">{t("customer.reviewRechecked")}</p>}
  {!workshop&&<Field className="picker-field"><FieldLabel htmlFor={`${id}-workshop`}>{t("customer.workshop")}</FieldLabel><Picker id={`${id}-workshop`} value={wid} onChange={setWid} values={directory.map(w=>w.id)} label={t("customer.reviewedWorkshop")} displayLabels={Object.fromEntries(directory.map(w=>[w.id,w.name]))}/></Field>}
  <fieldset className="review-section"><legend className="sr-only">{t("customer.experience")}</legend>
   <div className="form-grid"><label>{t("customer.visitDate")}<input required name="date" type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={e=>setDate(e.target.value)}/></label><label>{t("customer.vehicle")}<input required name="vehicle" minLength={3} maxLength={100} placeholder={t("customer.vehicleExample")} value={vehicle} onChange={e=>setVehicle(e.target.value)}/></label></div>
   <Field className="picker-field"><FieldLabel htmlFor={`${id}-service`}>{t("customer.completedWork")}</FieldLabel><SearchablePicker id={`${id}-service`} required multiple value={service} onChange={setService} values={services.slice(1)} displayLabels={Object.fromEntries(services.slice(1).map(value=>[value,valueLabel(locale,"service",value)]))} placeholder={t("customer.choose")} label={t("customer.completedWork")}/></Field>
   <div><label id={`${id}-rating`}>{t("customer.yourStars")}</label><div className="star-rating" role="radiogroup" aria-labelledby={`${id}-rating`} aria-required="true" ref={ratingGroup}>{[1,2,3,4,5].map(value=><button key={value} type="button" role="radio" aria-checked={rating===value} aria-label={t("customer.stars",{count:value})} tabIndex={rating===value||(!rating&&value===1)?0:-1} onClick={()=>{setRating(value);setError("");}} onKeyDown={e=>{if(["ArrowRight","ArrowUp","ArrowLeft","ArrowDown","Home","End"].includes(e.key)){e.preventDefault();const next=e.key==="Home"?1:e.key==="End"?5:Math.max(1,Math.min(5,value+(["ArrowRight","ArrowUp"].includes(e.key)?1:-1)));setRating(next);e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next-1]?.focus();}}}><Star size={26} fill={value<=rating?"currentColor":"none"}/></button>)}<span>{rating?`${rating} / 5`:t("customer.choose")}</span></div></div>
   <details className="review-optional" open={!!existing?.review||!!draft?.review}><summary>{t("customer.yourReview")}</summary><textarea name="review" aria-label={t("customer.yourReview")} maxLength={reviewTextMaxLength} rows={2} placeholder={t("customer.reviewPlaceholder")} value={review} onChange={e=>setReview(e.target.value)}/></details>
  </fieldset>
  <fieldset className="review-section"><legend>{t("customer.privateEvidence")}</legend><Field className="picker-field"><FieldLabel htmlFor={`${id}-kind`}>{t("customer.evidenceType")}</FieldLabel><Picker id={`${id}-kind`} value={kind} onChange={setKind} values={["Rechnung","Service- oder Arbeitsbeleg","Anderer Nachweis"]} valueCategory="evidence" label={t("customer.evidenceType")}/></Field>
   {existing?.file_name&&<p className="existing-evidence"><FileCheck2 size={17}/>{t("customer.existingReceipt",{name:existing.file_name})}<span>{t("customer.keepReceipt")}</span></p>}
   <label className="upload"><Upload size={20}/><strong>{existing?.file_name?t("customer.replaceReceipt"):t("customer.uploadReceipt")}</strong><span>{t("customer.fileTypes")}</span><input name="file" type="file" onChange={event=>setSelectedFile(event.target.files?.[0]??null)} accept="application/pdf,image/jpeg,image/png" required={kind!=="Anderer Nachweis"&&!existing?.file_name&&!selectedFile}/>{selectedFile&&<span className="review-selected-file">{selectedFile.name}</span>}</label>
   {kind==="Anderer Nachweis"?<label>{t("customer.describeEvidence")}<textarea name="evidenceNote" rows={2} minLength={40} required maxLength={3000} value={note} onChange={e=>setNote(e.target.value)} placeholder={t("customer.evidenceExample")}/></label>:<details className="review-optional" open={!!existing?.evidence_note||!!draft?.note}><summary>{t("customer.receiptNote")}</summary><textarea name="evidenceNote" aria-label={t("customer.receiptNote")} rows={2} maxLength={3000} value={note} onChange={e=>setNote(e.target.value)} placeholder={t("customer.evidenceHelp")}/></details>}<p className="help">{t("customer.redactNote")}</p>
  </fieldset>
  <div className={`consent-block${consentError?" invalid":""}`}><label className="consent" htmlFor={consentId}><Checkbox id={consentId} ref={consentCheckbox} checked={consent} onCheckedChange={v=>{setConsent(v===true);if(v===true)setConsentError(false);}} aria-label={t("customer.consentTitle")} aria-invalid={consentError} aria-describedby={`${consentId}-help${consentError?` ${consentId}-error`:""}`}/><span id={`${consentId}-help`}>{t("customer.consentNote")}</span></label>{consentError&&<p className="consent-error" id={`${consentId}-error`} role="alert">{t("customer.consentError")}</p>}</div>
  {error&&<p role="alert" className="error">{error}</p>}{showSubmit&&<button type="submit" disabled={busy} className="primary review-submit">{busy?<><LoaderCircle className="spin" size={17}/>{t("customer.submitting")}</>:t("customer.submitReview")}</button>}
 </form>;
}
