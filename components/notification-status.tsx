"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {notificationErrorLabels,notificationStateLabels,type NotificationView} from "@/lib/notifications/contract";

type Queue={notifications:NotificationView[];nextCursor:string|null;configured:boolean;error?:string};
export function NotificationStatus({refreshKey=0}:{refreshKey?:number}){
 const [queue,setQueue]=useState<Queue|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[feedback,setFeedback]=useState("");
 const current=useRef<Queue|null>(null),generation=useRef(0),controller=useRef<AbortController|null>(null),expanded=useRef(false);
 const load=useCallback(async(append=false)=>{
  if(!append)expanded.current=false;else expanded.current=true;
  const request=++generation.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;setLoading(true);setError("");
  try{
   const response=await fetch(`/api/notifications${append&&current.current?.nextCursor?`?cursor=${encodeURIComponent(current.current.nextCursor)}`:""}`,{cache:"no-store",signal:abort.signal}),data=await response.json() as Queue;
   if(request!==generation.current)return;
   if(!response.ok){if(response.status===401||response.status===403){setQueue(null);current.current=null;}throw Error(data.error||"Die Versandübersicht ist nicht erreichbar.");}
   const next=append&&current.current?{...data,notifications:[...current.current.notifications,...data.notifications]}:data;current.current=next;setQueue(next);
  }catch(e){if(request===generation.current&&!abort.signal.aborted)setError(e instanceof TypeError?"Die Versandübersicht ist nicht erreichbar.":e instanceof Error?e.message:"Laden fehlgeschlagen.");}
  finally{if(request===generation.current)setLoading(false);}
 },[]);
 const cancelLoad=useCallback(()=>{controller.current?.abort();generation.current++;},[]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Refresh the authorized outbox after moderation; polling only reads durable status, never sends mail.
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState!=="hidden"&&!expanded.current)void load();},20000);return ()=>{clearInterval(timer);cancelLoad();};},[load,refreshKey,cancelLoad]);
 async function retry(id?:string){
  if(busy)return;setBusy(true);setError("");setFeedback("");
  try{
   const response=await fetch("/api/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{action:"retry",id}:{action:"dispatch"})}),data=await response.json() as {error?:string};
   if(!response.ok)throw Error(data.error||"Die Versandprüfung konnte nicht gestartet werden.");
   await load();setFeedback("Versandprüfung gestartet. Den bestätigten Status siehst du in der Übersicht.");
  }catch(e){setError(e instanceof TypeError?"Die Versandprüfung ist nicht erreichbar.":e instanceof Error?e.message:"Versandprüfung fehlgeschlagen.");}
  finally{setBusy(false);}
 }
 return <section className="notification-panel" aria-labelledby="notification-heading" aria-busy={loading||busy}>
  <div className="notification-heading"><div><h2 id="notification-heading">Benachrichtigungsversand</h2><p>Freigaben und Ergänzungsanfragen werden getrennt von der Prüfentscheidung verarbeitet. Private Belege und Vermerke bleiben im Kontobereich.</p></div><button className="outline small" disabled={loading||busy} onClick={()=>void load()}>Versandübersicht aktualisieren</button></div>
  {error&&<p className="error" role="alert">{error}</p>}{feedback&&<p className="admin-feedback" role="status">{feedback}</p>}
  {loading&&!queue&&<p role="status">Versandübersicht wird geladen …</p>}
  {queue&&!queue.configured&&<p className="note">Der serverseitige E-Mail-Versand ist noch nicht eingerichtet. Moderationsentscheidungen bleiben gespeichert; die Benachrichtigungen warten auf die Einrichtung.</p>}
  {queue&&<><div className="notification-list">{queue.notifications.map(item=><article key={item.id} className="notification-entry"><div><h3>{item.workshopName}</h3><p>{item.decision==="published"?"Bewertungsfreigabe":"Nachweisergänzung"} · {notificationStateLabels[item.state]}</p>{item.error&&<p className="notification-reason">{notificationErrorLabels[item.error]??"Der Versand benötigt eine Prüfung durch die Verwaltung."}</p>}<p className="help">{item.attempts} Versandversuche{item.state==="pending"?` · Nächste Prüfung ab ${new Date(item.nextAttemptAt).toLocaleString("de-DE",{timeZone:"Europe/Belgrade"})}`:""}</p><a className="text-action" href={`/verwaltung/bewertungen?einreichung=${encodeURIComponent(item.visitId)}`}>Zugehörige Einreichung prüfen</a></div><button className="outline small" disabled={busy||loading||!item.retryable} onClick={()=>void retry(item.id)}>Benachrichtigung erneut prüfen</button></article>)}</div>{!loading&&!queue.notifications.length&&<p>Keine offenen Versandereignisse. Erfolgreich an den Versanddienst übergebene Nachrichten sind hier nicht mehr aufgeführt; dies bestätigt noch keine Zustellung.</p>}{queue.nextCursor&&<button className="outline small" disabled={busy||loading} onClick={()=>void load(true)}>Weitere Versandereignisse laden</button>}<button className="outline small" disabled={busy||loading||!queue.configured} onClick={()=>void retry()}>Fällige Benachrichtigungen prüfen</button></>}
 </section>;
}
