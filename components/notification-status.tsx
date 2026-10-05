"use client";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,type CodedResponse} from "@/lib/i18n/codes";
import {formatDate} from "@/lib/i18n/format";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {LocaleAnchor} from "@/components/locale-anchor";

import {useCallback,useEffect,useRef,useState} from "react";
import {notificationErrorLabel,notificationStateLabel,type NotificationView} from "@/lib/notifications/contract";

type Queue={notifications:NotificationView[];nextCursor:string|null;configured:boolean;error?:string};
export function NotificationStatus({refreshKey=0}:{refreshKey?:number}){
 const {locale,t}=useI18n();
 const [queue,setQueue]=useState<Queue|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[feedback,setFeedback]=useState("");
 useNavigationGuard({busy});
 const current=useRef<Queue|null>(null),generation=useRef(0),controller=useRef<AbortController|null>(null),expanded=useRef(false);
 const load=useCallback(async(append=false)=>{
  if(!append)expanded.current=false;else expanded.current=true;
  const request=++generation.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;setLoading(true);setError("");
  try{
   const response=await fetch(`/api/notifications${append&&current.current?.nextCursor?`?cursor=${encodeURIComponent(current.current.nextCursor)}`:""}`,{cache:"no-store",signal:abort.signal}),data=await response.json() as Queue&CodedResponse;
   if(request!==generation.current)return;
   if(!response.ok){if(response.status===401||response.status===403){setQueue(null);current.current=null;}throw responseError(t,data);}
   const next=append&&current.current?{...data,notifications:[...current.current.notifications,...data.notifications]}:data;current.current=next;setQueue(next);
  }catch(e){if(request===generation.current&&!abort.signal.aborted)setError(e instanceof TypeError?t("management.notificationsNetwork"):e instanceof LocalizedError?e.message:t("management.loadFailed"));}
  finally{if(request===generation.current)setLoading(false);}
 },[t]);
 const cancelLoad=useCallback(()=>{controller.current?.abort();generation.current++;},[]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Refresh the authorized outbox after moderation; polling only reads durable status, never sends mail.
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState!=="hidden"&&!expanded.current)void load();},20000);return ()=>{clearInterval(timer);cancelLoad();};},[load,refreshKey,cancelLoad]);
 async function retry(id?:string){
  if(busy)return;setBusy(true);setError("");setFeedback("");
  try{
   const response=await fetch("/api/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(id?{action:"retry",id}:{action:"dispatch"})}),data=await response.json() as CodedResponse;
   if(!response.ok)throw responseError(t,data);
   await load();setFeedback(t("management.notificationsStarted"));
  }catch(e){setError(e instanceof TypeError?t("management.notificationCheckNetwork"):e instanceof LocalizedError?e.message:t("management.notificationCheckFailed"));}
  finally{setBusy(false);}
 }
 return <section className="notification-panel" aria-labelledby="notification-heading" aria-busy={loading||busy}>
  <div className="notification-heading"><div><h2 id="notification-heading">{t("management.notificationsTitle")}</h2><p>{t("management.notificationsHelp")}</p></div><button className="outline small" disabled={loading||busy} onClick={()=>void load()}>{t("management.refreshNotifications")}</button></div>
  {error&&<p className="error" role="alert">{error}</p>}{feedback&&<p className="admin-feedback" role="status">{feedback}</p>}
  {loading&&!queue&&<p role="status">{t("management.notificationsLoading")}</p>}
  {queue&&!queue.configured&&<p className="note">{t("management.notificationsSetupHelp")}</p>}
  {queue&&<><div className="notification-list">{queue.notifications.map(item=><article key={item.id} className="notification-entry"><div><h3>{item.workshopName}</h3><p>{item.decision==="published"?t("management.reviewApproval"):t("management.evidenceSupplement")} · {notificationStateLabel(t,item.state)}</p>{item.error&&<p className="notification-reason">{notificationErrorLabel(t,item.error)}</p>}<p className="help">{t("management.deliveryAttempts",{count:item.attempts})}{item.state==="pending"?t("management.nextDeliveryCheck",{when:formatDate(locale,item.nextAttemptAt,{withTime:true})}):""}</p><LocaleAnchor className="text-action" href={`/verwaltung/bewertungen?einreichung=${encodeURIComponent(item.visitId)}`}>{t("management.reviewRelated")}</LocaleAnchor></div><button className="outline small" disabled={busy||loading||!item.retryable} onClick={()=>void retry(item.id)}>{t("management.retryNotification")}</button></article>)}</div>{!loading&&!queue.notifications.length&&<p>{t("management.notificationsEmpty")}</p>}{queue.nextCursor&&<button className="outline small" disabled={busy||loading} onClick={()=>void load(true)}>{t("management.moreNotifications")}</button>}<button className="outline small" disabled={busy||loading||!queue.configured} onClick={()=>void retry()}>{t("management.checkDueNotifications")}</button></>}
 </section>;
}
