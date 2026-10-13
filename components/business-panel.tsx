"use client";
import {Clock3,Download} from "lucide-react";
import {WorkshopEmailsEditor} from "./workshop-emails";
import {sameWorkshopEmailEdits,workshopEmailEditsSchema} from "@/lib/workshop-emails";
import {AdminLoading} from "@/components/admin-loading";
import {OpeningHoursEditor,OpeningHoursDetails} from "@/components/opening-hours";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,type CodedResponse} from "@/lib/i18n/codes";
import {valueLabel} from "@/lib/i18n/values";
import {formatDate} from "@/lib/i18n/format";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {LocaleAnchor} from "@/components/locale-anchor";

import {useCallback,useEffect,useState,type FormEvent} from "react";
import {services,type Workshop} from "@/lib/workshops";
import {editableBusinessProfile,type BusinessProfile,type BusinessRequest,type BusinessState} from "@/lib/business-contract";
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogHeader,AlertDialogFooter,AlertDialogCancel} from "@/components/ui/alert-dialog";

export function BusinessPanel({moderation=false,view="businesses"}:{moderation?:boolean;view?:"businesses"|"requests"}){
 const {locale,t}=useI18n();
 const showProfiles=!moderation&&view==="businesses",showRequests=moderation||view==="requests";
 const statusLabels:Record<string,string>={pending:t("management.businessPending"),approved:t("management.businessApproved"),rejected:t("management.businessRejected")};
 const errorMessage=useCallback((error:unknown)=>error instanceof LocalizedError?error.message:t("management.businessNetwork"),[t]);
 const [state,setState]=useState<BusinessState|null>(null),[loading,setLoading]=useState(true),[loadFailed,setLoadFailed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[feedback,setFeedback]=useState("");
 const [editing,setEditing]=useState<Workshop|null>(null),[profile,setProfile]=useState<BusinessProfile|null>(null);
 const [decision,setDecision]=useState<{request:BusinessRequest;kind:"claim"|"change";approve:boolean}|null>(null),[note,setNote]=useState("");
 useNavigationGuard({busy,dirty:!!note||!!editing&&!!profile&&JSON.stringify(profile)!==JSON.stringify(editableBusinessProfile(editing))});
 const load=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);setLoadFailed(false);setError("");
  try{
   const response=await fetch(`/api/business${moderation?"?moderation=1":""}`,{cache:"no-store",signal}),data=await response.json() as BusinessState;
   if(!response.ok)throw responseError(t,data);if(signal?.aborted)return;setState(data);return true;
  }catch(e){if(!signal?.aborted){setLoadFailed(true);setError(errorMessage(e));}return false;}finally{if(!signal?.aborted)setLoading(false);}
 },[moderation,t,errorMessage]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the authorized request queue or owned profiles when this panel mounts.
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return ()=>controller.abort();},[load]);
 async function loadMore(kind:"claim"|"change"){
  const cursor=kind==="claim"?state?.nextClaimCursor:state?.nextChangeCursor;if(!cursor||busy)return;
  setBusy(true);setError("");
  try{
   const params=new URLSearchParams({[kind==="claim"?"claimCursor":"changeCursor"]:cursor});if(moderation)params.set("moderation","1");
   const response=await fetch(`/api/business?${params}`,{cache:"no-store"}),data=await response.json() as BusinessState;
   if(!response.ok)throw responseError(t,data);
   setState(old=>old?kind==="claim"?{...old,workshops:data.workshops,pendingClaims:data.pendingClaims,pendingChangeWorkshopIds:data.pendingChangeWorkshopIds,pendingChangeRequestIds:data.pendingChangeRequestIds,claims:[...old.claims,...data.claims],nextClaimCursor:data.nextClaimCursor}:{...old,workshops:data.workshops,pendingClaims:data.pendingClaims,pendingChangeWorkshopIds:data.pendingChangeWorkshopIds,pendingChangeRequestIds:data.pendingChangeRequestIds,changes:[...old.changes,...data.changes],nextChangeCursor:data.nextChangeCursor}:old);
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function mutate(method:string,body:unknown){
  const response=await fetch("/api/business",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),data=await response.json() as CodedResponse;
  if(!response.ok)throw responseError(t,data);
 }
 async function save(event:FormEvent){
  event.preventDefault();if(!editing||!profile||busy||loading)return;setBusy(true);setError("");setFeedback("");
  const proposal={...profile};
  // An unchanged empty owner plan must not suppress imported fallback hours.
  if(JSON.stringify(profile.openingHours??null)===JSON.stringify(editing.openingHours??null))delete proposal.openingHours;
  try{const parsedEmails=workshopEmailEditsSchema.safeParse((profile.emailEntries??[]).map(entry=>({...entry,address:entry.address.trim()})).filter(entry=>entry.address));if(!parsedEmails.success)throw new LocalizedError(t("common.invalidRequest"));proposal.emailEntries=parsedEmails.data;if(sameWorkshopEmailEdits(proposal.emailEntries,editableBusinessProfile(editing).emailEntries??[]))delete proposal.emailEntries;await mutate("POST",{kind:"change",workshopId:editing.id,profile:proposal});setEditing(null);setProfile(null);const refreshed=await load();setFeedback(t("management.draftSubmitted"));if(!refreshed)setError(t("management.businessSavedReloadFailed"));}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function decide(){
  if(!decision||busy||note.trim().length<10)return;setBusy(true);setError("");setFeedback("");
  try{await mutate("PATCH",{kind:decision.kind,id:decision.request.id,revision:decision.request.revision,decision:decision.approve?"approved":"rejected",note});setDecision(null);setNote("");await load();setFeedback(t("management.decisionSaved"));}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 const documentLinks=(request:Pick<BusinessRequest,"id"|"fileName"|"documents">)=>{
  const documents=request.documents??(request.fileName?[{id:"",fileName:request.fileName}]:[]);
  return documents.length?<ul className="business-documents">{documents.map(document=><li key={document.id}><LocaleAnchor aria-label={t("management.ownershipDownload",{name:document.fileName})} href={`/api/business/evidence/${request.id}?locale=${locale}${document.id?`&document=${document.id}`:""}`}><Download size={18} aria-hidden="true"/><span><span className="business-document-label">{t("management.ownershipDocument")}</span><span className="business-document-name">{document.fileName}</span></span></LocaleAnchor></li>)}</ul>:null;
 };
 function requestList(requests:BusinessRequest[],kind:"claim"|"change"){
  return requests.map(request=>{
   const proposal=request.profile&&<dl className="business-proposal"><dt>{t("management.phone")}</dt><dd>{request.profile.phone}</dd><dt>{t("management.phoneNote")}</dt><dd>{request.profile.phoneNote||"–"}</dd><dt>WhatsApp</dt><dd>{request.profile.whatsapp||"–"}</dd><dt>{t("management.services")}</dt><dd>{request.profile.services.map(service=>valueLabel(locale,"service",service)).join(", ")} · {request.profile.serviceDetails.join(", ")}</dd><dt>{t("management.description")}</dt><dd>{request.profile.description}</dd><dt>{t("common.workshopEmails")}</dt><dd>{request.profile.emailEntries===undefined?t("common.workshopEmailsUnchanged"):request.profile.emailEntries.map(e=>`${e.address} (${e.active?t("common.workshopEmailActive"):t("common.workshopEmailInactive")}; ${e.verified?t("common.workshopEmailVerified"):t("common.workshopEmailUnverified")})`).join(", ")||"–"}</dd><dt>{t("common.hoursTitle")}</dt><dd>{request.profile.openingHours===undefined?<p>{t("common.hoursUnchanged")}</p>:<OpeningHoursDetails hours={request.profile.openingHours}/>}</dd></dl>;
   return <article className="business-request" key={request.id}>
   <div className="business-request-heading"><h3>{request.workshopName}</h3><span className={`business-status ${request.status}`}>{kind==="change"&&request.status==="approved"?t("management.businessChangeApproved"):statusLabels[request.status]??request.status}</span></div>
   <p className="business-meta">{kind==="claim"?t("management.claimType"):t("management.draftType")} · {formatDate(locale,request.createdAt)}</p>
   {moderation&&kind==="claim"&&<><p className="business-meta">{t("management.applicant",{owner:request.owner})}</p><p className="business-evidence">{request.evidence}</p>{request.evidenceLinks?.length?<ul>{request.evidenceLinks.map(link=><li key={link}><LocaleAnchor href={link} target="_blank" rel="noopener noreferrer">{link}</LocaleAnchor></li>)}</ul>:!request.documents?.length&&!request.fileName&&<p>{t("management.noProofLinks")}</p>}</>}
   {kind==="claim"&&documentLinks(request)}
   {request.profile&&(moderation?proposal:<details className="business-submitted"><summary>{t("management.submittedDetails")}</summary>{proposal}</details>)}
   {moderation&&kind==="change"&&<><details className="business-current"><summary>{t("management.approvedDetails")}</summary>{state?.workshops.filter(workshop=>workshop.id===request.workshopId).map(workshop=><dl className="business-proposal" key={workshop.id}><dt>{t("management.phone")}</dt><dd>{workshop.phone}</dd><dt>{t("management.phoneNote")}</dt><dd>{workshop.phoneNote||"–"}</dd><dt>WhatsApp</dt><dd>{workshop.whatsapp||"–"}</dd><dt>{t("management.services")}</dt><dd>{workshop.services.map(service=>valueLabel(locale,"service",service)).join(", ")} · {workshop.serviceDetails.join(", ")}</dd><dt>{t("management.description")}</dt><dd>{workshop.description}</dd><dt>{t("common.workshopEmails")}</dt><dd>{workshop.editableEmailContacts?.map(e=>`${e.address} (${e.active?t("common.workshopEmailActive"):t("common.workshopEmailInactive")}; ${e.verified?t("common.workshopEmailVerified"):t("common.workshopEmailUnverified")})`).join(", ")||"–"}</dd><dt>{t("common.hoursTitle")}</dt><dd><OpeningHoursDetails hours={workshop.openingHours}/></dd></dl>)}</details><p>{t("management.checkChanges")}</p></>}
   {!moderation&&<p>{kind==="claim"?request.status==="pending"?t("management.claimPendingHelp"):request.status==="approved"?t("management.claimApprovedHelp"):request.status==="rejected"?t("management.claimRejectedHelp"):null:request.status==="pending"?t("management.draftPending"):request.status==="approved"?t("management.changeApprovedHelp"):request.status==="rejected"?t("management.changeRejectedHelp"):null}</p>}
   {request.moderatorNote&&<p className="business-note">{t("management.moderatorNote",{note:request.moderatorNote})}</p>}
   {moderation&&<div className="business-actions"><button className="primary small" disabled={busy} onClick={()=>{setDecision({request,kind,approve:true});setNote("");setError("");}}>{t("management.approve")}</button><button className="outline small" disabled={busy} onClick={()=>{setDecision({request,kind,approve:false});setNote("");setError("");}}>{t("management.reject")}</button></div>}
  </article>;});
 }
 const visibleClaims=state?.claims.filter(request=>moderation||request.status!=="pending")??[];
 const pendingChangeRequestIds=state?.pendingChangeRequestIds??[];
 const visibleChanges=state?.changes.filter(request=>moderation||request.status!=="pending"||pendingChangeRequestIds.includes(request.id))??[];
 return <div className="business-panel" aria-busy={busy||loading}>
  {!moderation&&<header className="business-heading"><div><h1>{t(view==="requests"?"management.myApplications":"management.myBusiness")}</h1><p>{t(view==="requests"?"management.applicationsIntro":"management.businessIntro")}</p></div></header>}
  {error&&!decision&&<p className="error" role="alert">{error}</p>}{feedback&&<p className="success" role="status">{feedback}</p>}
  {loadFailed&&<button className="outline small" disabled={busy||loading} onClick={()=>void load()}>{t("management.retryBusiness")}</button>}
  {loading&&state&&(moderation?<AdminLoading compact>{t("management.businessRefreshing")}</AdminLoading>:<p role="status">{t("management.businessRefreshing")}</p>)}
  {loading&&!state?(moderation?<AdminLoading>{t("management.businessLoading")}</AdminLoading>:<p role="status">{t("management.businessLoading")}</p>):state?<>
   {showProfiles&&state.workshops.length===0&&<p>{t("management.businessEmpty")}</p>}
   {!moderation&&view==="requests"&&state.pendingClaims.length===0&&visibleClaims.length===0&&visibleChanges.length===0&&!state.nextClaimCursor&&!state.nextChangeCursor&&<p>{t("management.applicationsEmpty")}</p>}
   {showProfiles&&state.workshops.length>0&&<section className="business-section"><h2>{t("management.confirmedProfiles")}</h2><p>{t("management.profilesHelp")}</p>{state.workshops.map(workshop=><article className="business-request" key={workshop.id}><h3>{workshop.name}</h3><p>{workshop.city} · {workshop.address}</p><button className="outline small" disabled={busy||loading||state.pendingChangeWorkshopIds.includes(workshop.id)} onClick={()=>{setEditing(workshop);setProfile(editableBusinessProfile(workshop));setError("");}}>{t("management.editDraft")}</button>{state.pendingChangeWorkshopIds.includes(workshop.id)&&<p>{t("management.draftPending")}</p>}</article>)}</section>}
   {showProfiles&&editing&&profile&&<section className="business-section"><h2>{t("management.draftFor",{name:editing.name})}</h2><p>{t("management.identityProtected")}</p><form className="business-form" onSubmit={save}><fieldset disabled={busy||loading}><label>{t("management.phone")}<input required maxLength={30} value={profile.phone} onChange={event=>setProfile({...profile,phone:event.target.value})}/></label><label>{t("management.phoneNote")}<input maxLength={150} value={profile.phoneNote} onChange={event=>setProfile({...profile,phoneNote:event.target.value})}/></label><label>{t("management.whatsAppOptional")}<input maxLength={30} value={profile.whatsapp} onChange={event=>setProfile({...profile,whatsapp:event.target.value})}/></label><WorkshopEmailsEditor emails={profile.emailEntries??[]} onChange={emailEntries=>setProfile({...profile,emailEntries})}/><OpeningHoursEditor hours={profile.openingHours} onChange={openingHours=>setProfile({...profile,openingHours})}/><fieldset className="business-services"><legend>{t("management.services")}</legend>{services.slice(1).map(service=><label key={service}><input type="checkbox" checked={profile.services.includes(service)} onChange={event=>setProfile({...profile,services:event.target.checked?[...profile.services,service]:profile.services.filter(value=>value!==service)})}/>{valueLabel(locale,"service",service)}</label>)}</fieldset><label>{t("management.specificWork")}<textarea required maxLength={6030} value={profile.serviceDetails.join("\n")} onChange={event=>setProfile({...profile,serviceDetails:event.target.value.split("\n")})}/></label><label>{t("management.description")}<textarea required minLength={20} maxLength={2000} value={profile.description} onChange={event=>setProfile({...profile,description:event.target.value})}/></label><div className="business-actions"><button className="primary" type="submit">{t("management.submitDraft")}</button><button className="outline" type="button" onClick={()=>{setEditing(null);setProfile(null);}}>{t("management.cancel")}</button></div></fieldset></form></section>}
   {showRequests&&(moderation||state.pendingClaims.length>0||visibleClaims.length>0||state.nextClaimCursor)&&<section className="business-section"><h2>{moderation?t("management.claimsReview"):t("management.ownClaims")}</h2>{!moderation&&state.pendingClaims.map(request=><article className="business-request" key={request.id}><div className="business-request-heading"><h3>{request.workshopName}</h3><span className="business-status pending">{t("management.businessPending")}</span></div><p className="business-meta">{t("management.claimType")} · {formatDate(locale,request.createdAt)}</p><div className="business-claim-progress"><Clock3 size={20} aria-hidden="true"/><div><strong>{t("management.claimPendingTitle")}</strong><p>{t("management.claimPendingHelp")}</p></div></div><p className="business-claim-next">{t("management.claimPendingNext")}</p>{documentLinks(request)}</article>)}{visibleClaims.length?requestList(visibleClaims,"claim"):moderation?<p>{t("management.noClaimsReview")}</p>:null}{state.nextClaimCursor&&<button className="outline small" disabled={busy||loading} onClick={()=>void loadMore("claim")}>{t("management.moreClaims")}</button>}</section>}
   {showRequests&&(moderation||visibleChanges.length>0||state.nextChangeCursor)&&<section className="business-section"><h2>{moderation?t("management.draftsReview"):t("management.ownDrafts")}</h2>{visibleChanges.length?requestList(visibleChanges,"change"):<p>{t("management.noDrafts")}</p>}{state.nextChangeCursor&&<button className="outline small" disabled={busy||loading} onClick={()=>void loadMore("change")}>{t("management.moreDrafts")}</button>}</section>}
  </>:<p>{t("management.businessReload")}</p>}
  <AlertDialog open={!!decision} onOpenChange={open=>{if(!open&&!busy){setDecision(null);setNote("");setError("");}}}><AlertDialogContent onEscapeKeyDown={event=>{if(busy)event.preventDefault();}}><AlertDialogHeader><AlertDialogTitle>{decision?.approve?t("management.approveRequest"):t("management.rejectRequest")}</AlertDialogTitle><AlertDialogDescription>{decision?.request.workshopName}: {decision?.approve?decision.kind==="claim"?t("management.claimDecisionHelp"):t("management.changeDecisionHelp"):t("management.rejectDecisionHelp")}</AlertDialogDescription></AlertDialogHeader><label className="business-decision-note">{t("management.reason")}<textarea required minLength={10} maxLength={2000} value={note} disabled={busy} onChange={event=>setNote(event.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>{t("management.cancel")}</AlertDialogCancel><button className="primary" disabled={busy||note.trim().length<10} onClick={()=>void decide()}>{busy?t("management.savingDecision"):t("management.saveDecision")}</button></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
