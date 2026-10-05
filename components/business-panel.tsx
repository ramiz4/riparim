"use client";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,type CodedResponse} from "@/lib/i18n/codes";
import {valueLabel} from "@/lib/i18n/values";
import {formatDate} from "@/lib/i18n/format";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {LocaleAnchor} from "@/components/locale-anchor";

import {useCallback,useEffect,useId,useState,type FormEvent} from "react";
import {services,type Workshop} from "@/lib/workshops";
import {editableBusinessProfile,type BusinessProfile,type BusinessRequest,type BusinessState} from "@/lib/business-contract";
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogHeader,AlertDialogFooter,AlertDialogCancel} from "@/components/ui/alert-dialog";

export function BusinessPanel({directory=[],initialWorkshop,moderation=false}:{directory?:Workshop[];initialWorkshop?:string;moderation?:boolean}){
 const {locale,t}=useI18n();
 const statusLabels:Record<string,string>={pending:t("management.businessPending"),approved:t("management.businessApproved"),rejected:t("management.businessRejected")};
 const errorMessage=useCallback((error:unknown)=>error instanceof LocalizedError?error.message:t("management.businessNetwork"),[t]);
 const id=useId(),[state,setState]=useState<BusinessState|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[feedback,setFeedback]=useState("");
 const [workshopId,setWorkshopId]=useState(directory.some(workshop=>workshop.id===initialWorkshop)?initialWorkshop!:directory[0]?.id??""),[evidence,setEvidence]=useState(""),[links,setLinks]=useState("");
 const [editing,setEditing]=useState<Workshop|null>(null),[profile,setProfile]=useState<BusinessProfile|null>(null);
 const [decision,setDecision]=useState<{request:BusinessRequest;kind:"claim"|"change";approve:boolean}|null>(null),[note,setNote]=useState("");
 useNavigationGuard({busy,dirty:!!evidence||!!links||!!note||!!editing&&!!profile&&JSON.stringify(profile)!==JSON.stringify(editableBusinessProfile(editing))});
 const load=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);setError("");
  try{
   const response=await fetch(`/api/business${moderation?"?moderation=1":""}`,{cache:"no-store",signal}),data=await response.json() as BusinessState;
   if(!response.ok)throw responseError(t,data);if(signal?.aborted)return;setState(data);
  }catch(e){if(!signal?.aborted)setError(errorMessage(e));}finally{if(!signal?.aborted)setLoading(false);}
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
   setState(old=>old?kind==="claim"?{...old,claims:[...old.claims,...data.claims],nextClaimCursor:data.nextClaimCursor}:{...old,changes:[...old.changes,...data.changes],nextChangeCursor:data.nextChangeCursor}:old);
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function mutate(method:string,body:unknown){
  const response=await fetch("/api/business",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),data=await response.json() as CodedResponse;
  if(!response.ok)throw responseError(t,data);
 }
 async function claim(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError("");setFeedback("");
  try{await mutate("POST",{kind:"claim",input:{workshopId,evidence,evidenceLinks:links.split(/\n/).map(link=>link.trim()).filter(Boolean)}});setEvidence("");setLinks("");await load();setFeedback(t("management.claimSubmitted"));}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function save(event:FormEvent){
  event.preventDefault();if(!editing||!profile||busy)return;setBusy(true);setError("");setFeedback("");
  try{await mutate("POST",{kind:"change",workshopId:editing.id,profile});setEditing(null);setProfile(null);await load();setFeedback(t("management.draftSubmitted"));}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function decide(){
  if(!decision||busy||note.trim().length<10)return;setBusy(true);setError("");setFeedback("");
  try{await mutate("PATCH",{kind:decision.kind,id:decision.request.id,revision:decision.request.revision,decision:decision.approve?"approved":"rejected",note});setDecision(null);setNote("");await load();setFeedback(t("management.decisionSaved"));}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 function requestList(requests:BusinessRequest[],kind:"claim"|"change"){
  return requests.map(request=><article className="business-request" key={request.id}>
   <div className="business-request-heading"><h3>{request.workshopName}</h3><span className={`business-status ${request.status}`}>{statusLabels[request.status]??request.status}</span></div>
   <p className="business-meta">{kind==="claim"?t("management.claimType"):t("management.draftType")} · {formatDate(locale,request.createdAt)}</p>
   {moderation&&kind==="claim"&&<><p className="business-meta">{t("management.applicant",{owner:request.owner})}</p><p className="business-evidence">{request.evidence}</p>{request.evidenceLinks?.length?<ul>{request.evidenceLinks.map(link=><li key={link}><LocaleAnchor href={link} target="_blank" rel="noopener noreferrer">{link}</LocaleAnchor></li>)}</ul>:<p>{t("management.noProofLinks")}</p>}</>}
   {request.profile&&<dl className="business-proposal"><dt>{t("management.phone")}</dt><dd>{request.profile.phone}</dd><dt>{t("management.phoneNote")}</dt><dd>{request.profile.phoneNote||"–"}</dd><dt>WhatsApp</dt><dd>{request.profile.whatsapp||"–"}</dd><dt>{t("management.services")}</dt><dd>{request.profile.services.map(service=>valueLabel(locale,"service",service)).join(", ")} · {request.profile.serviceDetails.join(", ")}</dd><dt>{t("management.description")}</dt><dd>{request.profile.description}</dd></dl>}
   {moderation&&kind==="change"&&<><details className="business-current"><summary>{t("management.approvedDetails")}</summary>{state?.workshops.filter(workshop=>workshop.id===request.workshopId).map(workshop=><dl className="business-proposal" key={workshop.id}><dt>{t("management.phone")}</dt><dd>{workshop.phone}</dd><dt>{t("management.phoneNote")}</dt><dd>{workshop.phoneNote||"–"}</dd><dt>WhatsApp</dt><dd>{workshop.whatsapp||"–"}</dd><dt>{t("management.services")}</dt><dd>{workshop.services.map(service=>valueLabel(locale,"service",service)).join(", ")} · {workshop.serviceDetails.join(", ")}</dd><dt>{t("management.description")}</dt><dd>{workshop.description}</dd></dl>)}</details><p>{t("management.checkChanges")}</p></>}
   {request.moderatorNote&&<p className="business-note">{t("management.moderatorNote",{note:request.moderatorNote})}</p>}
   {moderation&&<div className="business-actions"><button className="primary small" disabled={busy} onClick={()=>{setDecision({request,kind,approve:true});setNote("");setError("");}}>{t("management.approve")}</button><button className="outline small" disabled={busy} onClick={()=>{setDecision({request,kind,approve:false});setNote("");setError("");}}>{t("management.reject")}</button></div>}
  </article>);
 }
 return <div className="business-panel" aria-busy={busy||loading}>
  {error&&!decision&&<p className="error" role="alert">{error}</p>}{feedback&&<p className="success" role="status">{feedback}</p>}
  <button className="outline small" disabled={busy||loading} onClick={()=>void load()}>{t("management.refresh")}</button>
  {loading&&!state?<p role="status">{t("management.businessLoading")}</p>:state?<>
   {!moderation&&<section className="business-section"><h2>{t("management.confirmedProfiles")}</h2>{state.workshops.length?state.workshops.map(workshop=><article className="business-request" key={workshop.id}><h3>{workshop.name}</h3><p>{workshop.city} · {workshop.address}</p><button className="outline small" disabled={busy||state.changes.some(change=>change.workshopId===workshop.id&&change.status==="pending")} onClick={()=>{setEditing(workshop);setProfile(editableBusinessProfile(workshop));setError("");}}>{t("management.editDraft")}</button>{state.changes.some(change=>change.workshopId===workshop.id&&change.status==="pending")&&<p>{t("management.draftPending")}</p>}</article>):<p>{t("management.noConfirmed")}</p>}</section>}
   {editing&&profile&&<section className="business-section"><h2>{t("management.draftFor",{name:editing.name})}</h2><p>{t("management.identityProtected")}</p><form className="business-form" onSubmit={save}><fieldset disabled={busy}><label>{t("management.phone")}<input required maxLength={30} value={profile.phone} onChange={event=>setProfile({...profile,phone:event.target.value})}/></label><label>{t("management.phoneNote")}<input maxLength={150} value={profile.phoneNote} onChange={event=>setProfile({...profile,phoneNote:event.target.value})}/></label><label>{t("management.whatsAppOptional")}<input maxLength={30} value={profile.whatsapp} onChange={event=>setProfile({...profile,whatsapp:event.target.value})}/></label><fieldset className="business-services"><legend>{t("management.services")}</legend>{services.slice(1).map(service=><label key={service}><input type="checkbox" checked={profile.services.includes(service)} onChange={event=>setProfile({...profile,services:event.target.checked?[...profile.services,service]:profile.services.filter(value=>value!==service)})}/>{valueLabel(locale,"service",service)}</label>)}</fieldset><label>{t("management.specificWork")}<textarea required maxLength={6030} value={profile.serviceDetails.join("\n")} onChange={event=>setProfile({...profile,serviceDetails:event.target.value.split("\n")})}/></label><label>{t("management.description")}<textarea required minLength={20} maxLength={2000} value={profile.description} onChange={event=>setProfile({...profile,description:event.target.value})}/></label><div className="business-actions"><button className="primary" type="submit">{t("management.submitDraft")}</button><button className="outline" type="button" onClick={()=>{setEditing(null);setProfile(null);}}>{t("management.cancel")}</button></div></fieldset></form></section>}
   <section className="business-section"><h2>{moderation?t("management.claimsReview"):t("management.ownClaims")}</h2>{state.claims.length?requestList(state.claims,"claim"):<p>{moderation?t("management.noClaimsReview"):t("management.noOwnClaims")}</p>}{state.nextClaimCursor&&<button className="outline small" disabled={busy||loading} onClick={()=>void loadMore("claim")}>{t("management.moreClaims")}</button>}</section>
   <section className="business-section"><h2>{moderation?t("management.draftsReview"):t("management.ownDrafts")}</h2>{state.changes.length?requestList(state.changes,"change"):<p>{t("management.noDrafts")}</p>}{state.nextChangeCursor&&<button className="outline small" disabled={busy||loading} onClick={()=>void loadMore("change")}>{t("management.moreDrafts")}</button>}</section>
   {!moderation&&<section className="business-section"><h2>{t("management.claimProfile")}</h2><p>{t("management.claimHelp")}</p>{directory.length?<form className="business-form" onSubmit={claim}><fieldset disabled={busy}><label htmlFor={`${id}-workshop`}>{t("management.existingProfile")}<select id={`${id}-workshop`} required value={workshopId} onChange={event=>setWorkshopId(event.target.value)}>{directory.map(workshop=><option key={workshop.id} value={workshop.id}>{workshop.name} · {workshop.city}</option>)}</select></label><label htmlFor={`${id}-evidence`}>{t("management.privateOwnership")}<textarea id={`${id}-evidence`} required minLength={40} maxLength={4000} value={evidence} onChange={event=>setEvidence(event.target.value)}/></label><label htmlFor={`${id}-links`}>{t("management.proofLinks")}<textarea id={`${id}-links`} maxLength={5005} value={links} onChange={event=>setLinks(event.target.value)}/></label><button className="primary" type="submit">{t("management.submitClaim")}</button></fieldset></form>:<p>{t("management.noPublicProfiles")}</p>}</section>}
  </>:<p>{t("management.businessReload")}</p>}
  <AlertDialog open={!!decision} onOpenChange={open=>{if(!open&&!busy){setDecision(null);setNote("");setError("");}}}><AlertDialogContent onEscapeKeyDown={event=>{if(busy)event.preventDefault();}}><AlertDialogHeader><AlertDialogTitle>{decision?.approve?t("management.approveRequest"):t("management.rejectRequest")}</AlertDialogTitle><AlertDialogDescription>{decision?.request.workshopName}: {decision?.approve?decision.kind==="claim"?t("management.claimDecisionHelp"):t("management.changeDecisionHelp"):t("management.rejectDecisionHelp")}</AlertDialogDescription></AlertDialogHeader><label className="business-decision-note">{t("management.reason")}<textarea required minLength={10} maxLength={2000} value={note} disabled={busy} onChange={event=>setNote(event.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>{t("management.cancel")}</AlertDialogCancel><button className="primary" disabled={busy||note.trim().length<10} onClick={()=>void decide()}>{busy?t("management.savingDecision"):t("management.saveDecision")}</button></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
