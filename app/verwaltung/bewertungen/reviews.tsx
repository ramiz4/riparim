"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ChevronDown,FileCheck2,LoaderCircle,RefreshCw,Search,ShieldCheck,Star} from "lucide-react";
import {SiteHeader} from "@/components/site-header";
import {AdminNavigation} from "@/components/admin-navigation";
import {Picker} from "@/components/picker";
import type {AccountIdentity} from "@/components/account-storage-notice";
import {NotificationStatus} from "@/components/notification-status";
import {statusLabels,type Visit} from "@/app/journeys";

export default function AdminReviews({account}:{account:AccountIdentity}){
 const [items,setItems]=useState<Visit[]>([]),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false),[cursor,setCursor]=useState<string|null>(null),[pending,setPending]=useState<number|null>(null),[error,setError]=useState(""),[feedback,setFeedback]=useState(""),[mutating,setMutating]=useState<string|null>(null),[notes,setNotes]=useState<Record<string,string>>({}),[filter,setFilter]=useState("open"),[query,setQuery]=useState("");
 const [notificationRefresh,setNotificationRefresh]=useState(0);
 const [targeted,setTargeted]=useState(false);
 const selectedVisit=useRef<string|null|undefined>(undefined);
 const requestGeneration=useRef(0),controller=useRef<AbortController|null>(null),nextCursor=useRef<string|null>(null);
 const cancelLoad=useCallback(()=>{controller.current?.abort();requestGeneration.current++;},[]);
 const load=useCallback(async(append=false)=>{
  const generation=++requestGeneration.current;controller.current?.abort();const c=new AbortController();controller.current=c;setLoading(true);setError("");
  if(selectedVisit.current===undefined){const target=new URLSearchParams(window.location.search).get("einreichung");selectedVisit.current=target&&/^[0-9a-f-]{36}$/.test(target)?target:null;if(selectedVisit.current)setFilter("all");}
  setTargeted(!!selectedVisit.current);
  const params=new URLSearchParams({moderation:"1"});if(selectedVisit.current)params.set("id",selectedVisit.current);if(append&&nextCursor.current)params.set("cursor",nextCursor.current);
  try{const r=await fetch(`/api/visits?${params}`,{signal:c.signal}),d=await r.json() as {visits:Visit[];nextCursor:string|null;pendingCount:number;error?:string};if(generation!==requestGeneration.current)return;if(!r.ok){if(r.status===401||r.status===403){setItems([]);setPending(null);setCursor(null);nextCursor.current=null;setLoaded(false);}throw Error(d.error);}nextCursor.current=d.nextCursor;setCursor(d.nextCursor);setPending(d.pendingCount);setItems(old=>append?[...old,...d.visits]:d.visits);setLoaded(true);}
  catch(e){if(generation===requestGeneration.current&&!c.signal.aborted)setError(e instanceof Error?e.message:"Einreichungen konnten nicht geladen werden.");}
  finally{if(generation===requestGeneration.current)setLoading(false);}
 },[]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- This management page starts its authorized remote queue load on mount.
 useEffect(()=>{void load();return cancelLoad;},[load,cancelLoad]);
 async function moderate(visit:Visit,status:"published"|"needs_more"){
  setMutating(visit.id);setError("");setFeedback("");
  try{const r=await fetch("/api/visits",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"moderate",id:visit.id,status,revision:visit.revision,note:notes[visit.id]??""})}),d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error);setFeedback(status==="published"?"Bewertung veröffentlicht.":"Einreichung ausgeblendet. Ergänzung angefordert.");setNotes(old=>{const next={...old};delete next[visit.id];return next;});setNotificationRefresh(value=>value+1);await load();}
  catch(e){setError(e instanceof Error?e.message:"Prüfung konnte nicht gespeichert werden.");}
  finally{setMutating(null);}
 }
 const busy=loading||!!mutating;
 const shown=items.filter(visit=>(filter==="all"||(filter==="open"?["pending","approved"].includes(visit.status):visit.status===filter))&&`${visit.workshop_name??""} ${visit.display_name??""} ${visit.vehicle}`.toLocaleLowerCase("de").includes(query.toLocaleLowerCase("de")));
 return <><SiteHeader account={account} isAdmin/><AdminNavigation active="reviews"/><main className="admin-main admin-reviews-page wrap">
  <div className="admin-title"><div><span className="eyebrow">VERWALTUNG</span><h1>Bewertungen prüfen</h1><p>Erfahrung und privaten Besuchsnachweis gemeinsam prüfen.</p></div><div className="moderation-count"><strong>{pending??"–"}</strong><span>Neue Einreichungen</span></div></div>
  <div className="moderation-toolbar"><label className="moderation-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Werkstatt, Anzeigename oder Fahrzeug" aria-label="Geladene Bewertungen durchsuchen"/></label><Picker value={filter} onChange={setFilter} values={["open","needs_more","published","all"]} displayLabels={{open:"Zur Prüfung",needs_more:"Ergänzung nötig",published:"Veröffentlicht",all:"Alle Status"}} label="Prüfstatus filtern"/><button className="outline small" disabled={busy} onClick={()=>void load()}><RefreshCw size={15}/>Aktualisieren</button></div>
  {feedback&&<p className="admin-feedback" role="status">{feedback}</p>}{error&&<p className="error" role="alert">{error}</p>}{loading&&!loaded&&<div className="review-loading" role="status"><LoaderCircle size={20} className="spin"/>Einreichungen werden geladen …</div>}
  {targeted&&<button className="outline small" disabled={busy} onClick={()=>{selectedVisit.current=null;setTargeted(false);void load();}}>Alle Einreichungen anzeigen</button>}
  <div className="moderation-list" aria-busy={loading}>{shown.map(visit=>{
   const complete=!!visit.display_name&&visit.display_name.trim().length>=2&&visit.display_name.trim().length<=40&&!!visit.review&&visit.review.trim().length>=30&&visit.review.trim().length<=2000&&Number.isInteger(visit.rating)&&Number(visit.rating)>=1&&Number(visit.rating)<=5;
   return <details className="moderation-entry" key={visit.id}><summary><div><strong>{visit.workshop_name??"Ehemaliges Werkstattprofil"}</strong><span>{visit.display_name??"Bewertung fehlt"} · {new Date(visit.date+"T12:00:00").toLocaleDateString("de-DE")}{visit.rating?` · ${visit.rating}/5`:""}</span></div><span className={`visit-status ${visit.status}`}>{statusLabels[visit.status]??visit.status}</span><ChevronDown size={18}/></summary><div className="moderation-entry-body">
    <section><h2>Bewertung</h2><p className="review-meta">{visit.vehicle} · {visit.service}</p>{visit.review?<><p className="moderation-review-rating"><Star size={16} fill="currentColor"/>{visit.rating} / 5 · {visit.display_name}</p><p className="public-review-text">{visit.review}</p></>:<p className="note">Die ältere Einreichung enthält noch keine vollständige Bewertung. Fordere eine Ergänzung an.</p>}</section>
    <section className="moderation-evidence"><h2><FileCheck2 size={18}/>Privater Besuchsnachweis</h2><p>{visit.evidence_type}</p>{visit.file_name&&<a className="outline small" href={`/api/evidence/${visit.id}`}><FileCheck2 size={16}/>Beleg herunterladen</a>}{visit.evidence_note&&<p className="evidence-note">{visit.evidence_note}</p>}{!visit.file_name&&!visit.evidence_note&&<p className="help">Kein Nachweis vorhanden.</p>}</section>
    <section className="moderation-decision"><h2>Prüfentscheidung</h2>{visit.moderator_note&&<p className="help">Bisheriger Vermerk: {visit.moderator_note}</p>}<label htmlFor={`moderation-note-${visit.id}`}>Prüfvermerk</label><textarea id={`moderation-note-${visit.id}`} rows={3} maxLength={1000} value={notes[visit.id]??""} onChange={e=>setNotes(old=>({...old,[visit.id]:e.target.value}))} placeholder="Was belegen Bewertung und Nachweis? Was fehlt? Mindestens 10 Zeichen."/><p className="help">Werkstatt, Datum, Arbeit und mögliche doppelte Einreichungen prüfen. Der Vermerk bleibt privat.</p><div className="moderation-decision-actions">{["pending","approved","needs_more"].includes(visit.status)&&<button className="primary" disabled={busy||!complete||(notes[visit.id]??"").trim().length<10} onClick={()=>void moderate(visit,"published")}><ShieldCheck size={16}/>Prüfen & veröffentlichen</button>}<button className="outline" disabled={busy||visit.status==="deleting"||(notes[visit.id]??"").trim().length<10} onClick={()=>void moderate(visit,"needs_more")}>{visit.status==="published"?"Ausblenden & Ergänzung anfordern":"Ergänzung anfordern"}</button></div></section>
   </div></details>;
  })}</div>
  {loaded&&!loading&&!error&&!shown.length&&<div className="empty"><ShieldCheck size={27}/><h2>Keine passenden Einreichungen geladen.</h2><p>{cursor?"Weitere Einreichungen können auf der nächsten Seite liegen.":"Für diesen Filter liegt keine Einreichung vor."}</p></div>}
  {cursor&&<button className="outline moderation-load-more" disabled={busy} onClick={()=>void load(true)}>{loading?<><LoaderCircle className="spin" size={16}/>Wird geladen …</>:"Weitere Einreichungen laden"}</button>}{loaded&&<p className="help moderation-loaded-count">{items.length} Einreichungen geladen · {shown.length} in dieser Auswahl</p>}
 <NotificationStatus refreshKey={notificationRefresh}/></main></>;
}
