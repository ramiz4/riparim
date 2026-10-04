"use client";

import {useCallback,useEffect,useId,useState,type FormEvent} from "react";
import {services,type Workshop} from "@/lib/workshops";
import {editableBusinessProfile,type BusinessProfile,type BusinessRequest,type BusinessState} from "@/lib/business-contract";
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogHeader,AlertDialogFooter,AlertDialogCancel} from "@/components/ui/alert-dialog";

const statusLabels:Record<string,string>={pending:"In Prüfung",approved:"Bestätigt",rejected:"Abgelehnt"};
function errorMessage(error:unknown){return error instanceof Error&&!(error instanceof TypeError)?error.message:"Der Betriebsbereich ist gerade nicht erreichbar. Bitte versuche es erneut.";}
export function BusinessPanel({directory=[],initialWorkshop,moderation=false}:{directory?:Workshop[];initialWorkshop?:string;moderation?:boolean}){
 const id=useId(),[state,setState]=useState<BusinessState|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[feedback,setFeedback]=useState("");
 const [workshopId,setWorkshopId]=useState(directory.some(workshop=>workshop.id===initialWorkshop)?initialWorkshop!:directory[0]?.id??""),[evidence,setEvidence]=useState(""),[links,setLinks]=useState("");
 const [editing,setEditing]=useState<Workshop|null>(null),[profile,setProfile]=useState<BusinessProfile|null>(null);
 const [decision,setDecision]=useState<{request:BusinessRequest;kind:"claim"|"change";approve:boolean}|null>(null),[note,setNote]=useState("");
 const load=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);setError("");
  try{
   const response=await fetch(`/api/business${moderation?"?moderation=1":""}`,{cache:"no-store",signal}),data=await response.json() as BusinessState;
   if(!response.ok)throw Error(data.error||"Anträge konnten nicht geladen werden.");if(signal?.aborted)return;setState(data);
  }catch(e){if(!signal?.aborted)setError(errorMessage(e));}finally{if(!signal?.aborted)setLoading(false);}
 },[moderation]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the authorized request queue or owned profiles when this panel mounts.
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return ()=>controller.abort();},[load]);
 async function loadMore(kind:"claim"|"change"){
  const cursor=kind==="claim"?state?.nextClaimCursor:state?.nextChangeCursor;if(!cursor||busy)return;
  setBusy(true);setError("");
  try{
   const params=new URLSearchParams({[kind==="claim"?"claimCursor":"changeCursor"]:cursor});if(moderation)params.set("moderation","1");
   const response=await fetch(`/api/business?${params}`,{cache:"no-store"}),data=await response.json() as BusinessState;
   if(!response.ok)throw Error(data.error||"Weitere Anträge konnten nicht geladen werden.");
   setState(old=>old?kind==="claim"?{...old,claims:[...old.claims,...data.claims],nextClaimCursor:data.nextClaimCursor}:{...old,changes:[...old.changes,...data.changes],nextChangeCursor:data.nextChangeCursor}:old);
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function mutate(method:string,body:unknown){
  const response=await fetch("/api/business",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),data=await response.json() as {error?:string};
  if(!response.ok)throw Error(data.error||"Der Antrag konnte nicht gespeichert werden.");
 }
 async function claim(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError("");setFeedback("");
  try{await mutate("POST",{kind:"claim",input:{workshopId,evidence,evidenceLinks:links.split(/\n/).map(link=>link.trim()).filter(Boolean)}});setEvidence("");setLinks("");await load();setFeedback("Dein privater Inhabernachweis wurde zur Prüfung eingereicht.");}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function save(event:FormEvent){
  event.preventDefault();if(!editing||!profile||busy)return;setBusy(true);setError("");setFeedback("");
  try{await mutate("POST",{kind:"change",workshopId:editing.id,profile});setEditing(null);setProfile(null);await load();setFeedback("Dein Änderungsentwurf wurde eingereicht. Die bisherigen öffentlichen Angaben bleiben erhalten.");}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 async function decide(){
  if(!decision||busy||note.trim().length<10)return;setBusy(true);setError("");setFeedback("");
  try{await mutate("PATCH",{kind:decision.kind,id:decision.request.id,revision:decision.request.revision,decision:decision.approve?"approved":"rejected",note});setDecision(null);setNote("");await load();setFeedback("Entscheidung gespeichert.");}
  catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 function requestList(requests:BusinessRequest[],kind:"claim"|"change"){
  return requests.map(request=><article className="business-request" key={request.id}>
   <div className="business-request-heading"><h3>{request.workshopName}</h3><span className={`business-status ${request.status}`}>{statusLabels[request.status]??request.status}</span></div>
   <p className="business-meta">{kind==="claim"?"Übernahme-Antrag":"Änderungsentwurf"} · {new Date(request.createdAt).toLocaleDateString("de-DE")}</p>
   {moderation&&kind==="claim"&&<><p className="business-meta">Antragstellendes Konto: {request.owner}</p><p className="business-evidence">{request.evidence}</p>{request.evidenceLinks?.length?<ul>{request.evidenceLinks.map(link=><li key={link}><a href={link} target="_blank" rel="noopener noreferrer">{link}</a></li>)}</ul>:<p>Keine zusätzlichen Beleglinks. Nachweis vor Bestätigung unabhängig prüfen.</p>}</>}
   {request.profile&&<dl className="business-proposal"><dt>Telefon</dt><dd>{request.profile.phone}</dd><dt>Kontakt-Hinweis</dt><dd>{request.profile.phoneNote||"–"}</dd><dt>WhatsApp</dt><dd>{request.profile.whatsapp||"–"}</dd><dt>Leistungen</dt><dd>{request.profile.services.join(", ")} · {request.profile.serviceDetails.join(", ")}</dd><dt>Beschreibung</dt><dd>{request.profile.description}</dd></dl>}
   {moderation&&kind==="change"&&<><details className="business-current"><summary>Aktuell freigegebene Angaben ansehen</summary>{state?.workshops.filter(workshop=>workshop.id===request.workshopId).map(workshop=><dl className="business-proposal" key={workshop.id}><dt>Telefon</dt><dd>{workshop.phone}</dd><dt>Kontakt-Hinweis</dt><dd>{workshop.phoneNote||"–"}</dd><dt>WhatsApp</dt><dd>{workshop.whatsapp||"–"}</dd><dt>Leistungen</dt><dd>{workshop.services.join(", ")} · {workshop.serviceDetails.join(", ")}</dd><dt>Beschreibung</dt><dd>{workshop.description}</dd></dl>)}</details><p>Prüfe die Änderungen gegen das aktuelle Profil. Geänderte Telefonnummern benötigen eine neue bestätigte Google-Zuordnung.</p></>}
   {request.moderatorNote&&<p className="business-note">Prüfvermerk: {request.moderatorNote}</p>}
   {moderation&&<div className="business-actions"><button className="primary small" disabled={busy} onClick={()=>{setDecision({request,kind,approve:true});setNote("");setError("");}}>Bestätigen</button><button className="outline small" disabled={busy} onClick={()=>{setDecision({request,kind,approve:false});setNote("");setError("");}}>Ablehnen</button></div>}
  </article>);
 }
 return <div className="business-panel" aria-busy={busy||loading}>
  {error&&!decision&&<p className="error" role="alert">{error}</p>}{feedback&&<p className="success" role="status">{feedback}</p>}
  <button className="outline small" disabled={busy||loading} onClick={()=>void load()}>Aktualisieren</button>
  {loading&&!state?<p role="status">Betriebsdaten werden geladen …</p>:state?<>
   {!moderation&&<section className="business-section"><h2>Bestätigte Profile</h2>{state.workshops.length?state.workshops.map(workshop=><article className="business-request" key={workshop.id}><h3>{workshop.name}</h3><p>{workshop.city} · {workshop.address}</p><button className="outline small" disabled={busy||state.changes.some(change=>change.workshopId===workshop.id&&change.status==="pending")} onClick={()=>{setEditing(workshop);setProfile(editableBusinessProfile(workshop));setError("");}}>Angaben als Entwurf bearbeiten</button>{state.changes.some(change=>change.workshopId===workshop.id&&change.status==="pending")&&<p>Ein Änderungsentwurf ist bereits in Prüfung.</p>}</article>):<p>Noch kein bestätigtes Werkstattprofil. Reiche zuerst einen Übernahme-Antrag ein.</p>}</section>}
   {editing&&profile&&<section className="business-section"><h2>Entwurf für {editing.name}</h2><p>Name, Standort, Quellen und Freigabestatus bleiben geschützt. Identitätsänderungen müssen durch die Verwaltung erneut geprüft werden.</p><form className="business-form" onSubmit={save}><fieldset disabled={busy}><label>Telefon<input required maxLength={30} value={profile.phone} onChange={event=>setProfile({...profile,phone:event.target.value})}/></label><label>Kontakt-Hinweis<input maxLength={150} value={profile.phoneNote} onChange={event=>setProfile({...profile,phoneNote:event.target.value})}/></label><label>WhatsApp (optional)<input maxLength={30} value={profile.whatsapp} onChange={event=>setProfile({...profile,whatsapp:event.target.value})}/></label><fieldset className="business-services"><legend>Leistungen</legend>{services.slice(1).map(service=><label key={service}><input type="checkbox" checked={profile.services.includes(service)} onChange={event=>setProfile({...profile,services:event.target.checked?[...profile.services,service]:profile.services.filter(value=>value!==service)})}/>{service}</label>)}</fieldset><label>Konkrete Arbeiten (eine pro Zeile)<textarea required maxLength={6030} value={profile.serviceDetails.join("\n")} onChange={event=>setProfile({...profile,serviceDetails:event.target.value.split("\n")})}/></label><label>Beschreibung<textarea required minLength={20} maxLength={2000} value={profile.description} onChange={event=>setProfile({...profile,description:event.target.value})}/></label><div className="business-actions"><button className="primary" type="submit">Entwurf einreichen</button><button className="outline" type="button" onClick={()=>{setEditing(null);setProfile(null);}}>Abbrechen</button></div></fieldset></form></section>}
   <section className="business-section"><h2>{moderation?"Inhabernachweise zur Prüfung":"Deine Übernahme-Anträge"}</h2>{state.claims.length?requestList(state.claims,"claim"):<p>{moderation?"Keine offenen Inhabernachweise.":"Du hast noch keinen Übernahme-Antrag gestellt."}</p>}{state.nextClaimCursor&&<button className="outline small" disabled={busy||loading} onClick={()=>void loadMore("claim")}>Weitere Übernahme-Anträge laden</button>}</section>
   <section className="business-section"><h2>{moderation?"Profilentwürfe zur Freigabe":"Deine Änderungsentwürfe"}</h2>{state.changes.length?requestList(state.changes,"change"):<p>Keine Änderungsentwürfe vorhanden.</p>}{state.nextChangeCursor&&<button className="outline small" disabled={busy||loading} onClick={()=>void loadMore("change")}>Weitere Änderungsentwürfe laden</button>}</section>
   {!moderation&&<section className="business-section"><h2>Werkstattprofil beanspruchen</h2><p>Beschreibe, wie die Verwaltung deine Inhaberschaft unabhängig prüfen kann, zum Beispiel über einen Registereintrag oder einen Kontakt auf der offiziellen Betriebsseite. Der Nachweis und seine Links bleiben privat. Eine Bestätigung veröffentlicht dein Profil nicht automatisch.</p>{directory.length?<form className="business-form" onSubmit={claim}><fieldset disabled={busy}><label htmlFor={`${id}-workshop`}>Bestehendes Profil<select id={`${id}-workshop`} required value={workshopId} onChange={event=>setWorkshopId(event.target.value)}>{directory.map(workshop=><option key={workshop.id} value={workshop.id}>{workshop.name} · {workshop.city}</option>)}</select></label><label htmlFor={`${id}-evidence`}>Privater Inhabernachweis<textarea id={`${id}-evidence`} required minLength={40} maxLength={4000} value={evidence} onChange={event=>setEvidence(event.target.value)}/></label><label htmlFor={`${id}-links`}>Beleglinks (optional, HTTPS, einer pro Zeile)<textarea id={`${id}-links`} maxLength={5005} value={links} onChange={event=>setLinks(event.target.value)}/></label><button className="primary" type="submit">Antrag zur Prüfung einreichen</button></fieldset></form>:<p>Aktuell sind keine öffentlichen Profile verfügbar.</p>}</section>}
  </>:<p>Die Liste konnte nicht geladen werden. Versuche es mit „Aktualisieren“ erneut.</p>}
  <AlertDialog open={!!decision} onOpenChange={open=>{if(!open&&!busy){setDecision(null);setNote("");setError("");}}}><AlertDialogContent onEscapeKeyDown={event=>{if(busy)event.preventDefault();}}><AlertDialogHeader><AlertDialogTitle>{decision?.approve?"Antrag bestätigen?":"Antrag ablehnen?"}</AlertDialogTitle><AlertDialogDescription>{decision?.request.workshopName}: {decision?.approve?decision.kind==="claim"?"Der bestätigte Betriebsinhaber darf für dieses Profil Änderungsentwürfe einreichen.":"Die eingereichten Angaben ersetzen nach erneuter Prüfung die freigegebenen Angaben.":"Der Betrieb erhält deine Begründung und kann einen neuen Antrag stellen."}</AlertDialogDescription></AlertDialogHeader><label className="business-decision-note">Begründung<textarea required minLength={10} maxLength={2000} value={note} disabled={busy} onChange={event=>setNote(event.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel><button className="primary" disabled={busy||note.trim().length<10} onClick={()=>void decide()}>{busy?"Entscheidung wird gespeichert …":"Entscheidung speichern"}</button></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
