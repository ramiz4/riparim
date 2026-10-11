"use client";
import {useEffect,useId,useRef,useState,type FormEvent} from "react";
import {ArrowLeft,Building2,CheckCircle2,FileText,LoaderCircle,ShieldCheck,Upload,X} from "lucide-react";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,type CodedResponse} from "@/lib/i18n/codes";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {LocaleAnchor} from "@/components/locale-anchor";
import type {Workshop} from "@/lib/workshops";

export function BusinessClaimForm({workshop}:{workshop:Workshop|null}){
 const {t}=useI18n(),id=useId(),fileInput=useRef<HTMLInputElement>(null),confirmation=useRef<HTMLHeadingElement>(null);
 const [evidence,setEvidence]=useState(""),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[submitted,setSubmitted]=useState(false),[error,setError]=useState("");
 useNavigationGuard({busy,dirty:!!evidence||!!file});
 useEffect(()=>{if(submitted)confirmation.current?.focus();},[submitted]);
 async function submit(event:FormEvent){
  event.preventDefault();if(!workshop||busy||submitted)return;setBusy(true);setError("");
  try{
   const body=new FormData();body.set("workshopId",workshop.id);body.set("evidence",evidence);if(file)body.set("file",file);
   const response=await fetch("/api/business",{method:"POST",body}),data=await response.json() as CodedResponse;
   if(!response.ok)throw responseError(t,data);
   setEvidence("");setFile(null);if(fileInput.current)fileInput.current.value="";setSubmitted(true);
  }catch(error){setError(error instanceof LocalizedError?error.message:t("management.businessNetwork"));}finally{setBusy(false);}
 }
 function removeFile(){setFile(null);setError("");if(fileInput.current){fileInput.current.value="";fileInput.current.focus();}}
 return <div className="business-panel business-claim" aria-busy={busy}>
  {workshop&&<LocaleAnchor className="claim-back" href={`/werkstatt/${encodeURIComponent(workshop.id)}`}><ArrowLeft size={16} aria-hidden="true"/>{t("management.claimBack")}</LocaleAnchor>}
  <h1>{t("management.claimTitle")}</h1>
  {workshop?<>
   <section className="claim-workshop"><Building2 size={22} aria-hidden="true"/><div><h2>{workshop.name}</h2><p>{workshop.city} · {workshop.address}</p></div></section>
   {submitted?<section className="claim-confirmation"><CheckCircle2 size={30} aria-hidden="true"/><h2 ref={confirmation} tabIndex={-1}>{t("management.claimSuccessTitle")}</h2><p className="success" role="status">{t("management.claimSubmitted")}</p><p>{t("management.claimPendingHelp")}</p><LocaleAnchor className="primary" href="/betrieb">{t("management.myBusiness")}</LocaleAnchor></section>:<>
    <p className="claim-intro">{t("management.claimIntro")}</p>
    <form className="business-form claim-form" onSubmit={submit}><fieldset disabled={busy}>
     <div className="claim-field"><label htmlFor={`${id}-evidence`}>{t("management.claimEvidenceLabel")}</label><textarea id={`${id}-evidence`} required rows={3} minLength={40} maxLength={4000} aria-describedby={`${id}-evidence-help`} placeholder={t("management.claimEvidencePlaceholder")} value={evidence} onChange={event=>setEvidence(event.target.value)}/><small id={`${id}-evidence-help`}>{t("management.claimEvidenceHint")}</small></div>
     <div className="claim-field"><label htmlFor={`${id}-file`}>{t("management.claimDocumentLabel")} <span>{t("management.claimOptional")}</span></label>
      <div className="claim-upload"><Upload size={22} aria-hidden="true"/><div><strong>{file?t("management.claimReplaceDocument"):t("management.claimChooseDocument")}</strong><small id={`${id}-file-help`}>{t("management.claimFileTypes")}</small></div><input ref={fileInput} id={`${id}-file`} type="file" accept="application/pdf,image/jpeg,image/png" aria-describedby={`${id}-file-help`} onChange={event=>{setFile(event.target.files?.[0]??null);setError("");}}/></div>
      {file&&<div className="claim-selected-file"><FileText size={18} aria-hidden="true"/><span aria-live="polite">{file.name}</span><button type="button" className="claim-remove-file" aria-label={t("management.claimRemoveDocument")} onClick={removeFile}><X size={18} aria-hidden="true"/></button></div>}
     </div>
     {error&&<p className="error" role="alert">{error}</p>}
     <div className="claim-submit"><p className="claim-private"><ShieldCheck size={16} aria-hidden="true"/>{t("management.claimPrivacy")}</p><button className="primary" type="submit">{busy&&<LoaderCircle className="spin" size={18} aria-hidden="true"/>}{busy?t("management.claimSending"):t("management.submitClaim")}</button><small>{t("management.claimManualReview")}</small></div>
    </fieldset></form>
   </>}
  </>:<><p>{t("management.claimFromProfile")}</p><LocaleAnchor className="primary" href="/werkstaetten">{t("management.findWorkshop")}</LocaleAnchor></>}
 </div>;
}
