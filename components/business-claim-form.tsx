"use client";
import {useId,useRef,useState,type FormEvent} from "react";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,type CodedResponse} from "@/lib/i18n/codes";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {LocaleAnchor} from "@/components/locale-anchor";
import type {Workshop} from "@/lib/workshops";

export function BusinessClaimForm({workshop}:{workshop:Workshop|null}){
 const {t}=useI18n(),id=useId(),fileInput=useRef<HTMLInputElement>(null);
 const [evidence,setEvidence]=useState(""),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[submitted,setSubmitted]=useState(false),[error,setError]=useState("");
 useNavigationGuard({busy,dirty:!!evidence||!!file});
 async function submit(event:FormEvent){
  event.preventDefault();if(!workshop||busy||submitted)return;setBusy(true);setError("");
  try{
   const body=new FormData();body.set("workshopId",workshop.id);body.set("evidence",evidence);if(file)body.set("file",file);
   const response=await fetch("/api/business",{method:"POST",body}),data=await response.json() as CodedResponse;
   if(!response.ok)throw responseError(t,data);
   setEvidence("");setFile(null);if(fileInput.current)fileInput.current.value="";setSubmitted(true);
  }catch(error){setError(error instanceof LocalizedError?error.message:t("management.businessNetwork"));}finally{setBusy(false);}
 }
 return <div className="business-panel" aria-busy={busy}>
  <h1>{t("management.claimProfile")}</h1>
  {workshop?<section className="business-section"><h2>{workshop.name}</h2><p>{workshop.city} · {workshop.address}</p>
   {submitted?<><p className="success" role="status">{t("management.claimSubmitted")}</p><p>{t("management.claimPendingHelp")}</p><LocaleAnchor className="primary" href="/betrieb">{t("management.myBusiness")}</LocaleAnchor></>:<>
    <p>{t("management.claimHelp")}</p>{error&&<p className="error" role="alert">{error}</p>}
    <form className="business-form" onSubmit={submit}><fieldset disabled={busy}>
     <label htmlFor={`${id}-evidence`}>{t("management.privateOwnership")}<textarea id={`${id}-evidence`} required minLength={40} maxLength={4000} value={evidence} onChange={event=>setEvidence(event.target.value)}/></label>
     <label htmlFor={`${id}-file`}>{t("management.ownershipDocument")}<input ref={fileInput} id={`${id}-file`} type="file" accept="application/pdf,image/jpeg,image/png" aria-describedby={`${id}-file-help`} onChange={event=>setFile(event.target.files?.[0]??null)}/></label>
     <p id={`${id}-file-help`}>{t("management.ownershipDocumentHelp")}</p><button className="primary" type="submit">{t("management.submitClaim")}</button>
    </fieldset></form>
   </>}
  </section>:<><p>{t("management.claimFromProfile")}</p><LocaleAnchor className="primary" href="/werkstaetten">{t("management.findWorkshop")}</LocaleAnchor></>}
  {workshop&&<div className="business-actions"><LocaleAnchor className="outline small" href={`/werkstatt/${encodeURIComponent(workshop.id)}`}>{t("management.backToWorkshop")}</LocaleAnchor>{!submitted&&<LocaleAnchor className="outline small" href="/betrieb">{t("management.myBusiness")}</LocaleAnchor>}</div>}
 </div>;
}
