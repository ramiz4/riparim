"use client";
import {useI18n} from "@/lib/i18n/client";
import {searchService} from "@/lib/search-service";
import {responseError,LocalizedError,type CodedResponse} from "@/lib/i18n/codes";
import {valueLabel} from "@/lib/i18n/values";
import {formatDate} from "@/lib/i18n/format";
import {evidenceHref} from "@/lib/i18n/evidence";
import {localizeHref} from "@/lib/i18n/locale";
import {ownReviewsHref,reviewSubmissionId} from "@/lib/own-reviews";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {LocaleAnchor} from "@/components/locale-anchor";
import Link from "@/components/locale-link";
import {useState,useEffect,useRef,useId,useCallback,type FormEvent} from "react";
import {ArrowLeft,CarFront,ShieldCheck,MessageCircle,Star,LoaderCircle,Trash2} from "lucide-react";
import {ModalContent,ModalBody} from "@/components/modal-shell";
import {Dialog,DialogClose} from "@/components/ui/dialog";
import {Progress} from "@/components/ui/progress";
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogCancel,AlertDialogAction,AlertDialogFooter,AlertDialogHeader} from "@/components/ui/alert-dialog";
import {Picker} from "@/components/picker";
import {AccountStorageNotice,type AccountIdentity} from "@/components/account-storage-notice";
import {ReviewForm} from "@/components/review-form";
import {services,cities,brands,type Workshop} from "@/lib/workshops";
export type SearchContext={brand:string;model:string;year:string;problem:string;service:string;city:string;additionalCity:string;radius:number;from:string;to:string};

const initial:SearchContext={brand:"Alle Marken",model:"",year:"",problem:"",service:services[0],city:cities[1],additionalCity:"",radius:0,from:"",to:""};
export function DetailSearch({open,onClose,onSearch,initialContext=null}:{open:boolean;onClose:()=>void;onSearch:(c:SearchContext)=>void;initialContext?:SearchContext|null}){
 const {locale,t}=useI18n();
 const searchFormId=useId();
 const [step,setStep]=useState(0),[ctx,setCtx]=useState(initial),[error,setError]=useState("");
 // eslint-disable-next-line react-hooks/set-state-in-effect -- An explicit opening resumes a private in-memory draft.
 useEffect(()=>{if(open){setCtx(initialContext??initial);setStep(0);setError("");}},[open,initialContext]);
 useNavigationGuard({dirty:open&&JSON.stringify(ctx)!==JSON.stringify(initialContext??initial)});
 const change=(key:keyof SearchContext,value:string|number)=>{setCtx(c=>({...c,[key]:value}));setError("");};
 function submit(e:FormEvent){e.preventDefault();if(step===0){if(!ctx.model.trim()){setError(t("public.modelRequired"));return;}setStep(1);}else if(step===1){if(ctx.problem.trim().length<10){setError(t("public.problemRequired"));return;}setStep(2);}else{if(ctx.from&&ctx.to&&ctx.from>ctx.to){setError(t("public.travelInvalid"));return;}const service=searchService(locale,ctx.service,ctx.problem);onSearch({...ctx,service});onClose();}}
 return <Dialog open={open} onOpenChange={v=>{if(!v)onClose();}}><ModalContent title={t("public.wizardTitle")} description={t("public.wizardDescription")} footer={<>{step>0&&<button type="button" className="outline" onClick={()=>{setStep(s=>s-1);setError("");}}>{t("public.back")}</button>}<button className="primary" type="submit" form={searchFormId}>{step===2?t("public.showWorkshops"):t("public.next")}</button></>}><div className="wizard-labels">{[t("public.vehicle"),t("public.work"),t("public.locationTravel")].map((s,i)=><span className={step===i?"current":""} key={s}>{i+1} · {s}</span>)}</div><Progress value={(step+1)/3*100} aria-label={t("public.wizardStep",{count:step+1})} className="h-1.5"/><form id={searchFormId} onSubmit={submit} className="journey-form">
 {step===0&&<><div className="field"><label>{t("public.vehicleBrand")}</label><Picker sortLabels value={ctx.brand} onChange={v=>change("brand",v)} values={brands} valueCategory="sentinel" label={t("public.vehicleBrand")}/></div><div className="form-grid"><label>{t("public.model")}<input required maxLength={80} placeholder={t("public.modelExample")} value={ctx.model} onChange={e=>change("model",e.target.value)}/></label><label>{t("public.year")}<span>{t("public.optional")}</span><input type="number" min="1950" max={new Date().getFullYear()+1} placeholder={t("public.yearExample")} value={ctx.year} onChange={e=>change("year",e.target.value)}/></label></div><div className="note"><CarFront size={20}/><p>{t("public.vehicleHelp")}</p></div></>}
 {step===1&&<><label>{t("public.desiredWork")}<textarea required minLength={10} maxLength={2000} rows={4} placeholder={t("public.problemExample")} value={ctx.problem} onChange={e=>change("problem",e.target.value)}/></label><div className="field"><label>{t("public.serviceCategory")}</label><Picker sortLabels value={ctx.service} onChange={v=>change("service",v)} values={services} valueCategory="service" label={t("public.serviceCategory")}/></div><p className="help">{locale==="de"?t("public.heuristicHelp"):t("public.manualServiceHelp")}</p></>}
 {step===2&&<><div className="form-grid"><div className="field"><label>{t("public.yourCity")}</label><Picker sortLabels value={ctx.city} onChange={v=>change("city",v)} values={cities.slice(1)} label={t("public.yourCity")}/></div><div className="field"><label>{t("public.additionalCity")}<span>{t("public.optional")}</span></label><Picker sortLabels value={ctx.additionalCity||"Kein weiterer Ort"} onChange={v=>change("additionalCity",v==="Kein weiterer Ort"?"":v)} valueCategory="sentinel" values={["Kein weiterer Ort",...cities.slice(1).filter(c=>c!==ctx.city)]} label={t("public.additionalCity")}/></div></div><div className="field"><label>{t("public.radiusCity")}</label><Picker sortLabels value={ctx.radius===0?"Nur im Ort":`${ctx.radius} km`} onChange={v=>change("radius",v==="Nur im Ort"?0:parseInt(v))} valueCategory="sentinel" values={["Nur im Ort","25 km","50 km","100 km"]} label={t("public.radius")}/></div><p className="help">{t("public.radiusHelp")}</p><div className="form-grid"><label>{t("public.travelStart")}<span>{t("public.optional")}</span><input type="date" value={ctx.from} onChange={e=>change("from",e.target.value)}/></label><label>{t("public.travelEnd")}<span>{t("public.optional")}</span><input type="date" min={ctx.from||undefined} value={ctx.to} onChange={e=>change("to",e.target.value)}/></label></div><p className="help">{t("public.travelHelp")}</p></>}
 <div className="private-caption"><ShieldCheck size={16}/>{t("public.privateSearch")}</div>{error&&<p role="alert" className="error">{error}</p>}</form></ModalContent></Dialog>;
}
export type Review={display_name:string;vehicle:string;service:string;date:string;rating:number;review:string};
export type Visit={id:string;workshop:string;workshop_name?:string;date:string;vehicle:string;service:string;evidence_type:string;evidence_note:string;status:string;moderator_note:string;display_name:string|null;rating:number|null;review:string|null;created_at:string;file_name:string|null;revision:number};
export const statusLabels:Record<string,string>={pending:"In Prüfung",approved:"Bewertung vervollständigen",needs_more:"Ergänzung nötig",published:"Veröffentlicht",deleting:"Löschung ausstehend"};

export function VisitForm({open,onClose,onCloseAutoFocus,workshop,directory,signedIn,existing}:{open:boolean;onClose:()=>void;onCloseAutoFocus?:(event:Event)=>void;workshop:Workshop|null;directory:Workshop[];signedIn:boolean;account?:AccountIdentity|null;existing:Visit|null}){
 const {locale,t}=useI18n();
 const formId=useId();const [busy,setBusy]=useState(false),[done,setDone]=useState(false);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Each controlled opening starts a fresh form session.
 useEffect(()=>{if(open){setBusy(false);setDone(false);}},[open,existing?.id,workshop?.id]);
 const returnTo=localizeHref(ownReviewsHref(existing?.id),locale);
 return <Dialog open={open&&!!existing} onOpenChange={v=>{if(!v&&!busy)onClose();}}><ModalContent className="review-submission-modal" onCloseAutoFocus={onCloseAutoFocus} closeDisabled={busy} title={done?t("customer.reviewSubmitted"):t("customer.editReview")} description={done?t("customer.publishedAfterApproval"):t("customer.combinedSubmission")} footer={<><DialogClose asChild><button className="outline" disabled={busy}>{done?t("customer.close"):t("customer.cancel")}</button></DialogClose>{signedIn&&done?<LocaleAnchor className="primary" href={ownReviewsHref(existing?.id)}>{t("customer.myReviews")}</LocaleAnchor>:signedIn&&directory.length>0?<button type="submit" form={formId} disabled={busy} className="primary">{busy?<><LoaderCircle className="spin" size={17}/>{t("customer.submitting")}</>:t("customer.submitReview")}</button>:null}</>}>
  {open&&<ReviewForm key={`${existing?.id??workshop?.id??"new"}:${existing?.revision??0}`} formId={formId} showSubmit={false} workshop={workshop} directory={directory} signedIn={signedIn} existing={existing} returnTo={returnTo} onBusyChange={setBusy} onSubmitted={()=>setDone(true)}/>}
 </ModalContent></Dialog>;
}

type OwnView={items:Visit[];cursor:string|null;loaded:boolean;error:string};
const emptyView=():OwnView=>({items:[],cursor:null,loaded:false,error:""});
export function MyVisits({directory,directoryUnavailable=false,signedIn,account=null,submissionId=null}:{directory:Workshop[];directoryUnavailable?:boolean;signedIn:boolean;account?:AccountIdentity|null;submissionId?:string|null}){
 const {locale,t}=useI18n();
 const [view,setView]=useState<OwnView>(emptyView),[loading,setLoading]=useState(signedIn),[mutating,setMutating]=useState(false),[actionError,setActionError]=useState(""),[deleteId,setDeleteId]=useState<string|null>(null);
 const [authenticationRequired,setAuthenticationRequired]=useState(false);
 const [editing,setEditing]=useState<Visit|null>(null),target=reviewSubmissionId(submissionId);
 useNavigationGuard({busy:mutating});
 const generation=useRef(0),controller=useRef<AbortController|null>(null),cursor=useRef<string|null>(null),cacheIdentity=useRef("");
 const opener=useRef<{button:HTMLButtonElement;href:string}|null>(null),refreshButton=useRef<HTMLButtonElement>(null);
 const [restorePending,setRestorePending]=useState(false);
 const busy=loading||mutating;
 // Radix may close after the refresh render; consume its focus request with the current enabled actions.
 useEffect(()=>{
  if(!restorePending||busy||editing||deleteId)return;
  setRestorePending(false);const previous=opener.current;
  if(!previous||previous.href!==window.location.href||document.activeElement!==document.body)return;
  opener.current=null;
  const destination=previous.button.isConnected&&!previous.button.disabled?previous.button:refreshButton.current;
  destination?.focus();
 },[restorePending,busy,editing,deleteId]);
 function rememberFocus(button:HTMLButtonElement){opener.current={button,href:window.location.href};setRestorePending(false);}
 function closeAutoFocus(event:Event){event.preventDefault();setRestorePending(true);}
 const cancelLoad=useCallback(()=>{controller.current?.abort();generation.current++;},[]);
 const load=useCallback(async(append=false)=>{
  const request=++generation.current;controller.current?.abort();const c=new AbortController();controller.current=c;setLoading(true);setAuthenticationRequired(false);setView(old=>({...old,error:""}));
  const query=new URLSearchParams();if(target)query.set("id",target);if(append&&cursor.current)query.set("cursor",cursor.current);
  try{const r=await fetch(`/api/visits${query.size?`?${query}`:""}`,{signal:c.signal}),d=await r.json() as CodedResponse&{visits:Visit[];nextCursor:string|null};if(request!==generation.current)return;if(!r.ok){if(r.status===401)setAuthenticationRequired(true);if([401,403,404].includes(r.status)){setView(emptyView());cursor.current=null;}throw responseError(t,d);}cursor.current=d.nextCursor;setView(old=>({items:append?[...old.items,...d.visits]:d.visits,cursor:d.nextCursor,loaded:true,error:""}));}
  catch(e){if(request===generation.current&&!c.signal.aborted)setView(old=>({...old,error:e instanceof LocalizedError?e.message:t("customer.loadFailed")}));}
  finally{if(request===generation.current)setLoading(false);}
 },[t,target]);
 useEffect(()=>{if(signedIn){const identity=`${account?.provider??""}:${account?.email??""}:${target??""}`;if(cacheIdentity.current!==identity){setView(emptyView());cursor.current=null;cacheIdentity.current=identity;}setActionError("");void load();}return()=>{cancelLoad();opener.current=null;};},[signedIn,account?.email,account?.provider,load,cancelLoad,target]);
 async function remove(){setMutating(true);setActionError("");try{const r=await fetch("/api/visits",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:deleteId})}),d=await r.json() as CodedResponse;if(!r.ok)throw responseError(t,d);await load();setDeleteId(null);}catch(e){setActionError(e instanceof LocalizedError?e.message:t("customer.deleteFailed"));}finally{setMutating(false);}}
 return <><main className="my-reviews-page wrap"><nav><LocaleAnchor href="/werkstaetten"><ArrowLeft size={16}/>{t("customer.backWorkshops")}</LocaleAnchor></nav><header className="my-reviews-heading"><div><h1>{t("customer.myReviews")}</h1><p>{t("customer.myReviewsNote")}</p></div>{signedIn&&<button ref={refreshButton} className="outline" disabled={busy} onClick={()=>void load()}>{loading?<><LoaderCircle className="spin" size={16}/>{t("customer.loading")}</>:t("customer.refresh")}</button>}</header>
 {!signedIn||authenticationRequired?<div className="login-prompt"><ShieldCheck size={25}/><p>{t("customer.myReviewsLogin")}</p><LocaleAnchor className="primary" href={`/anmelden?weiter=${encodeURIComponent(localizeHref(ownReviewsHref(target),locale))}`}>{t("customer.loginOrRegister")}</LocaleAnchor></div>:<><AccountStorageNotice/>{directoryUnavailable&&<p className="error" role="alert">{t("customer.workshopsUnavailable")} <LocaleAnchor href={ownReviewsHref(target)}>{t("customer.refresh")}</LocaleAnchor></p>}<div className="visit-list" aria-busy={loading}>
 {loading&&!view.loaded&&<div className="review-loading" role="status"><LoaderCircle size={18} className="spin"/><span>{t("customer.myReviewsLoading")}</span></div>}{view.error&&<p className="error" role="alert">{view.error}</p>}{!loading&&!view.error&&view.loaded&&!view.items.length&&<div className="empty"><MessageCircle size={25}/><h3>{t("customer.noReviews")}</h3><p>{t("customer.noReviewsNote")}</p></div>}
 {target&&<LocaleAnchor className="outline small" href="/bewertungen">{t("customer.allMyReviews")}</LocaleAnchor>}{view.items.map(v=><article className="visit" key={v.id}><div className="visit-top"><strong>{directory.some(w=>w.id===v.workshop)?<Link href={`/werkstatt/${encodeURIComponent(v.workshop)}`}>{v.workshop_name??t("customer.workshopProfile")}</Link>:v.workshop_name??t("customer.formerWorkshop")}</strong><span className={`visit-status ${v.status}`}>{valueLabel(locale,"status",v.status)}</span></div><p className="review-meta">{v.vehicle} · {formatDate(locale,v.date,{dateOnly:true})} · {valueLabel(locale,"service",v.service)}</p>{v.review?<div className="submitted-review"><span><Star size={15} fill="currentColor"/>{v.rating} / 5 · {v.display_name}</span><p>{v.review}</p></div>:<p className="help">{t("customer.oldReview")}</p>}
 <details className="evidence-details"><summary>{t("customer.privateEvidenceSummary",{type:valueLabel(locale,"evidence",v.evidence_type)})}</summary>{v.file_name&&<LocaleAnchor className="text-action" href={evidenceHref(v.id,locale)}>{t("customer.downloadReceipt")}</LocaleAnchor>}{v.evidence_note&&<p className="evidence-note">{v.evidence_note}</p>}</details>{v.moderator_note&&<p className="note">{t("customer.moderationNote",{note:v.moderator_note})}</p>}
 <div className="visit-actions">{["pending","approved","needs_more","published"].includes(v.status)&&directory.some(w=>w.id===v.workshop)&&<button className="outline small" disabled={busy} onClick={event=>{rememberFocus(event.currentTarget);setEditing(v);}}>{!v.review?t("customer.completeReview"):v.status==="needs_more"?t("customer.supplement"):t("customer.edit")}</button>}<button className="delete-button" disabled={busy} onClick={event=>{rememberFocus(event.currentTarget);setActionError("");setDeleteId(v.id);}}><Trash2 size={14}/>{t("customer.delete")}</button></div>
 </article>)}{view.cursor&&<button className="outline" disabled={busy} onClick={()=>void load(true)}>{t("customer.moreReviews")}</button>}</div>{actionError&&<p className="error" role="alert">{actionError}</p>}</>}
 </main><VisitForm open={!!editing} existing={editing} workshop={directory.find(workshop=>workshop.id===editing?.workshop)??null} directory={directory} signedIn={signedIn} onCloseAutoFocus={closeAutoFocus} onClose={()=>{setEditing(null);void load();}}/><AlertDialog open={!!deleteId} onOpenChange={v=>{if(!v&&!mutating)setDeleteId(null);}}><AlertDialogContent className="app-dialog confirmation-dialog" onCloseAutoFocus={closeAutoFocus}><AlertDialogHeader><AlertDialogTitle>{t("customer.deleteReviewTitle")}</AlertDialogTitle></AlertDialogHeader><ModalBody><AlertDialogDescription>{t("customer.deleteReviewNote")}</AlertDialogDescription>{actionError&&<p className="error" role="alert">{actionError}</p>}</ModalBody><AlertDialogFooter><AlertDialogCancel disabled={mutating}>{t("customer.keep")}</AlertDialogCancel><AlertDialogAction disabled={mutating} onClick={e=>{e.preventDefault();void remove();}}>{mutating?t("customer.deleting"):t("customer.delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
