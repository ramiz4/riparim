"use client";
import {useEffect,useId,useRef,useState,type FormEvent} from "react";
import {ArrowLeft,Building2,CheckCircle2,FileText,LoaderCircle,ShieldCheck,Upload,X} from "lucide-react";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,errorCodeMessage,type CodedResponse} from "@/lib/i18n/codes";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {LocaleAnchor} from "@/components/locale-anchor";
import {SelectWithOther,selectedChoiceText,type SelectionDraft} from "@/components/select-with-other";
import {claimDocumentsError} from "@/lib/business-contract";
import type {Workshop} from "@/lib/workshops";

const claimConnections=[
 {value:"owner",label:"management.claimRoleOwner",evidence:"management.claimRoleOwnerStatement"},
 {value:"director",label:"management.claimRoleDirector",evidence:"management.claimRoleDirectorStatement"},
 {value:"authorized",label:"management.claimRoleAuthorized",evidence:"management.claimRoleAuthorizedStatement"},
 {value:"other",label:"management.claimRoleOther",evidence:"management.claimRoleOther"},
] as const;

export function BusinessClaimForm({workshop}:{workshop:Workshop|null}){
 const {t}=useI18n(),id=useId(),fileInput=useRef<HTMLInputElement>(null),confirmation=useRef<HTMLHeadingElement>(null);
 const [connection,setConnection]=useState<SelectionDraft>({choice:"",detail:""}),[files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false),[submitted,setSubmitted]=useState(false),[error,setError]=useState("");
 const evidence=selectedChoiceText(connection,claimConnections.map(role=>({value:role.value,label:t(role.evidence)})));
 useNavigationGuard({busy,dirty:!!connection.choice||!!connection.detail||files.length>0});
 useEffect(()=>{if(submitted)confirmation.current?.focus();},[submitted]);
 async function submit(event:FormEvent){
  event.preventDefault();if(!workshop||busy||submitted)return;
  if(evidence.trim().length<40){setError(t("management.claimConnectionRequired"));document.getElementById(connection.choice==="other"?`${id}-connection-details`:`${id}-connection`)?.focus();return;}
  const selectionError=claimDocumentsError(files);if(selectionError){setError(errorCodeMessage(t,selectionError));fileInput.current?.focus();return;}
  setBusy(true);setError("");
  try{
   const body=new FormData();body.set("workshopId",workshop.id);body.set("evidence",evidence);for(const file of files)body.append("file",file);
   const response=await fetch("/api/business",{method:"POST",body}),data=await response.json() as CodedResponse;
   if(!response.ok)throw responseError(t,data);
   setConnection({choice:"",detail:""});setFiles([]);if(fileInput.current)fileInput.current.value="";setSubmitted(true);
  }catch(error){setError(error instanceof LocalizedError?error.message:t("management.businessNetwork"));}finally{setBusy(false);}
 }
 function addFiles(selected:File[]){
  if(!selected.length)return;
  const next=[...files,...selected],selectionError=claimDocumentsError(next);
  if(selectionError)setError(errorCodeMessage(t,selectionError));else{setFiles(next);setError("");}
  if(fileInput.current)fileInput.current.value="";
 }
 function removeFile(index:number){setFiles(files.filter((_,position)=>position!==index));setError("");fileInput.current?.focus();}
 return <div className="business-panel business-claim" aria-busy={busy}>
  {workshop&&<LocaleAnchor className="claim-back" href={`/werkstatt/${encodeURIComponent(workshop.id)}`}><ArrowLeft size={16} aria-hidden="true"/>{t("management.claimBack")}</LocaleAnchor>}
  <h1>{t("management.claimTitle")}</h1>
  {workshop?<>
   <section className="claim-workshop"><Building2 size={22} aria-hidden="true"/><div><h2>{workshop.name}</h2><p>{workshop.city} · {workshop.address}</p></div></section>
   {submitted?<section className="claim-confirmation"><CheckCircle2 size={30} aria-hidden="true"/><h2 ref={confirmation} tabIndex={-1}>{t("management.claimSuccessTitle")}</h2><p className="success" role="status">{t("management.claimSubmitted")}</p><p>{t("management.claimPendingHelp")}</p><LocaleAnchor className="primary" href="/antraege">{t("management.myApplications")}</LocaleAnchor></section>:<>
    <p className="claim-intro">{t("management.claimIntro")}</p>
    <form className="business-form claim-form" onSubmit={submit}><fieldset disabled={busy}>
     <div className="claim-field"><SelectWithOther id={`${id}-connection`} label={t("management.claimEvidenceLabel")} placeholder={t("management.claimChooseConnection")} options={claimConnections.map(role=>({value:role.value,label:t(role.label)}))} value={connection} onChange={value=>{setConnection(value);setError("");}} detailLabel={t("management.claimConnectionDetails")} detailPlaceholder={t("management.claimEvidencePlaceholder")} minLength={40} maxLength={4000} disabled={busy} describedBy={connection.choice==="other"?`${id}-evidence-help`:undefined}/>{connection.choice==="other"&&<small id={`${id}-evidence-help`}>{t("management.claimEvidenceHint")}</small>}</div>
     <div className="claim-field"><label htmlFor={`${id}-file`}>{t("management.claimDocumentLabel")}</label>
      <div className="claim-upload"><Upload size={22} aria-hidden="true"/><div><strong>{files.length?t("management.claimReplaceDocument"):t("management.claimChooseDocument")}</strong><small id={`${id}-file-help`}>{t("management.claimFileTypes")}</small></div><input ref={fileInput} id={`${id}-file`} type="file" multiple required={!files.length} accept="application/pdf,image/jpeg,image/png" aria-describedby={`${id}-file-help`} onChange={event=>addFiles(Array.from(event.target.files??[]))}/></div>
      {files.map((file,index)=><div className="claim-selected-file" key={`${index}-${file.name}`}><FileText size={18} aria-hidden="true"/><span aria-live="polite">{file.name}</span><button type="button" className="claim-remove-file" aria-label={t("management.claimRemoveDocument",{name:file.name})} onClick={()=>removeFile(index)}><X size={18} aria-hidden="true"/></button></div>)}
     </div>
     {error&&<p className="error" role="alert">{error}</p>}
     <div className="claim-submit"><p className="claim-private"><ShieldCheck size={16} aria-hidden="true"/>{t("management.claimPrivacy")}</p><button className="primary" type="submit">{busy&&<LoaderCircle className="spin" size={18} aria-hidden="true"/>}{busy?t("management.claimSending"):t("management.submitClaim")}</button><small>{t("management.claimManualReview")}</small></div>
    </fieldset></form>
   </>}
  </>:<><p>{t("management.claimFromProfile")}</p><LocaleAnchor className="primary" href="/werkstaetten">{t("management.findWorkshop")}</LocaleAnchor></>}
 </div>;
}
