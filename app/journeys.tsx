"use client";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,type CodedResponse} from "@/lib/i18n/codes";
import {valueLabel} from "@/lib/i18n/values";
import {formatDate} from "@/lib/i18n/format";
import {evidenceHref} from "@/lib/i18n/evidence";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {LocaleAnchor} from "@/components/locale-anchor";
import Link from "@/components/locale-link";
import {useState,useEffect,useRef,useId,useCallback,type FormEvent} from "react";
import {CarFront,ShieldCheck,MessageCircle,Star,LoaderCircle,Trash2} from "lucide-react";
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
 const searchFormId=useId();
 const [step,setStep]=useState(0),[ctx,setCtx]=useState(initial),[error,setError]=useState("");
 // eslint-disable-next-line react-hooks/set-state-in-effect -- An explicit opening resumes a private in-memory draft.
 useEffect(()=>{if(open){setCtx(initialContext??initial);setStep(0);setError("");}},[open,initialContext]);
 useNavigationGuard({dirty:open&&JSON.stringify(ctx)!==JSON.stringify(initialContext??initial)});
 const change=(key:keyof SearchContext,value:string|number)=>{setCtx(c=>({...c,[key]:value}));setError("");};
 function submit(e:FormEvent){e.preventDefault();if(step===0){if(!ctx.model.trim()){setError("Bitte ergänze das Fahrzeugmodell.");return;}setStep(1);}else if(step===1){if(ctx.problem.trim().length<10){setError("Beschreibe das Problem oder die gewünschte Arbeit mit mindestens 10 Zeichen.");return;}setStep(2);}else{if(ctx.from&&ctx.to&&ctx.from>ctx.to){setError("Das Ende des Reisezeitraums muss nach dem Beginn liegen.");return;}let service=ctx.service;if(service===services[0]){const p=ctx.problem.toLowerCase();if(/brems|fahrwerk|feder|stoßdämpf/.test(p))service=services[3];else if(/motor|getriebe|kupplung/.test(p))service=services[4];else if(/lack|karosserie|delle/.test(p))service=services[5];else if(/reifen|klima/.test(p))service=services[6];else if(/wartung|öl|inspektion/.test(p))service=services[1];else if(/fehler|elektr|diagnos|leuchte/.test(p))service=services[2];}onSearch({...ctx,service});onClose();}}
 return <Dialog open={open} onOpenChange={v=>{if(!v)onClose();}}><ModalContent title="Suche mit Fahrzeug" description="Drei Schritte zur passenden Auswahl." footer={<>{step>0&&<button type="button" className="outline" onClick={()=>{setStep(s=>s-1);setError("");}}>Zurück</button>}<button className="primary" type="submit" form={searchFormId}>{step===2?"Werkstätten zeigen":"Weiter"}</button></>}><div className="wizard-labels">{["Fahrzeug","Arbeit","Ort & Reise"].map((s,i)=><span className={step===i?"current":""} key={s}>{i+1} · {s}</span>)}</div><Progress value={(step+1)/3*100} aria-label={`Schritt ${step+1} von 3`} className="h-1.5"/><form id={searchFormId} onSubmit={submit} className="journey-form">
 {step===0&&<><div className="field"><label>Fahrzeugmarke</label><Picker value={ctx.brand} onChange={v=>change("brand",v)} values={brands} valueCategory="sentinel" label="Fahrzeugmarke"/></div><div className="form-grid"><label>Modell<input required maxLength={80} placeholder="z. B. Golf 7" value={ctx.model} onChange={e=>change("model",e.target.value)}/></label><label>Baujahr <span>(optional)</span><input type="number" min="1950" max={new Date().getFullYear()+1} placeholder="z. B. 2019" value={ctx.year} onChange={e=>change("year",e.target.value)}/></label></div><div className="note"><CarFront size={20}/><p>Marken und Leistungen laut Betriebsquelle. Keine Kennzeichen oder Fahrgestellnummer nötig.</p></div></>}
 {step===1&&<><label>Was soll gemacht werden?<textarea required minLength={10} maxLength={2000} rows={4} placeholder="z. B. Beim Bremsen vibriert das Lenkrad. Ich möchte die Ursache prüfen lassen." value={ctx.problem} onChange={e=>change("problem",e.target.value)}/></label><div className="field"><label>Leistungsbereich</label><Picker value={ctx.service} onChange={v=>change("service",v)} values={services} valueCategory="service" label="Leistungsbereich"/></div><p className="help">„Alle Leistungen“ nutzt passende Stichwörter. Das ist keine Diagnose.</p></>}
 {step===2&&<><div className="form-grid"><div className="field"><label>Dein Ort</label><Picker value={ctx.city} onChange={v=>change("city",v)} values={cities.slice(1)} label="Dein Ort"/></div><div className="field"><label>Weiterer Ort <span>(optional)</span></label><Picker value={ctx.additionalCity||"Kein weiterer Ort"} onChange={v=>change("additionalCity",v==="Kein weiterer Ort"?"":v)} valueCategory="sentinel" values={["Kein weiterer Ort",...cities.slice(1).filter(c=>c!==ctx.city)]} label="Weiterer Ort"/></div></div><div className="field"><label>Umkreis um deinen Ort</label><Picker value={ctx.radius===0?"Nur im Ort":`${ctx.radius} km`} onChange={v=>change("radius",v==="Nur im Ort"?0:parseInt(v))} valueCategory="sentinel" values={["Nur im Ort","25 km","50 km","100 km"]} label="Umkreis"/></div><p className="help">Luftlinie ab Stadtzentrum. Ohne genaue Betriebskoordinaten zählt dessen Stadtzentrum.</p><div className="form-grid"><label>Reisebeginn <span>(optional)</span><input type="date" value={ctx.from} onChange={e=>change("from",e.target.value)}/></label><label>Reiseende <span>(optional)</span><input type="date" min={ctx.from||undefined} value={ctx.to} onChange={e=>change("to",e.target.value)}/></label></div><p className="help">Reisezeitraum für das Gespräch – keine Terminbestätigung.</p></>}
 <div className="private-caption"><ShieldCheck size={16}/>Private Suche. Keine Ausschreibung, kein Auftrag.</div>{error&&<p role="alert" className="error">{error}</p>}</form></ModalContent></Dialog>;
}
export type Review={display_name:string;vehicle:string;service:string;date:string;rating:number;review:string};
export type Visit={id:string;workshop:string;workshop_name?:string;date:string;vehicle:string;service:string;evidence_type:string;evidence_note:string;status:string;moderator_note:string;display_name:string|null;rating:number|null;review:string|null;created_at:string;file_name:string|null;revision:number};
export const statusLabels:Record<string,string>={pending:"In Prüfung",approved:"Bewertung vervollständigen",needs_more:"Ergänzung nötig",published:"Veröffentlicht",deleting:"Löschung ausstehend"};

export function VisitForm({open,onClose,onDone,workshop,directory,signedIn,existing}:{open:boolean;onClose:()=>void;onDone:()=>void;workshop:Workshop|null;directory:Workshop[];signedIn:boolean;account?:AccountIdentity|null;existing:Visit|null}){
 const {t}=useI18n();
 const formId=useId();const [busy,setBusy]=useState(false),[done,setDone]=useState(false);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Each controlled opening starts a fresh form session.
 useEffect(()=>{if(open){setBusy(false);setDone(false);}},[open,existing?.id,workshop?.id]);
 const returnTo=`/?nachweis=${encodeURIComponent(workshop?.id??"neu")}`;
 return <Dialog open={open} onOpenChange={v=>{if(!v&&!busy)onClose();}}><ModalContent className="review-submission-modal" closeDisabled={busy} title={done?t("customer.reviewSubmitted"):existing?t("customer.editReview"):t("customer.reviewWorkshop")} description={done?t("customer.publishedAfterApproval"):t("customer.combinedSubmission")} footer={<><DialogClose asChild><button className="outline" disabled={busy}>{done?t("customer.close"):t("customer.cancel")}</button></DialogClose>{signedIn&&done?<button className="primary" onClick={()=>{onClose();onDone();}}>{t("customer.myReviews")}</button>:signedIn&&directory.length>0?<button type="submit" form={formId} disabled={busy} className="primary">{busy?<><LoaderCircle className="spin" size={17}/>{t("customer.submitting")}</>:t("customer.submitReview")}</button>:null}</>}>
  {open&&<ReviewForm key={`${existing?.id??workshop?.id??"new"}:${existing?.revision??0}`} formId={formId} showSubmit={false} workshop={workshop} directory={directory} signedIn={signedIn} existing={existing} returnTo={returnTo} onBusyChange={setBusy} onSubmitted={()=>setDone(true)}/>}
 </ModalContent></Dialog>;
}

type OwnView={items:Visit[];cursor:string|null;loaded:boolean;error:string};
const emptyView=():OwnView=>({items:[],cursor:null,loaded:false,error:""});
export function MyVisits({open,onClose,directory,signedIn,account=null,onResubmit}:{open:boolean;onClose:()=>void;directory:Workshop[];signedIn:boolean;account?:AccountIdentity|null;onResubmit:(v:Visit)=>void}){
 const {locale,t}=useI18n();
 const [view,setView]=useState<OwnView>(emptyView),[loading,setLoading]=useState(false),[mutating,setMutating]=useState(false),[actionError,setActionError]=useState(""),[deleteId,setDeleteId]=useState<string|null>(null);
 useNavigationGuard({busy:mutating});
 const generation=useRef(0),controller=useRef<AbortController|null>(null),cursor=useRef<string|null>(null),cacheIdentity=useRef("");
 const [targeted,setTargeted]=useState(false);
 const selectedVisit=useRef<string|null|undefined>(undefined);
 const busy=loading||mutating;
 const cancelLoad=useCallback(()=>{controller.current?.abort();generation.current++;},[]);
 const load=useCallback(async(append=false)=>{
  const request=++generation.current;controller.current?.abort();const c=new AbortController();controller.current=c;setLoading(true);setView(old=>({...old,error:""}));
  if(selectedVisit.current===undefined){const target=new URLSearchParams(window.location.search).get("einreichung");selectedVisit.current=target&&/^[0-9a-f-]{36}$/.test(target)?target:null;}
  setTargeted(!!selectedVisit.current);
  const query=new URLSearchParams();if(selectedVisit.current)query.set("id",selectedVisit.current);if(append&&cursor.current)query.set("cursor",cursor.current);
  try{const r=await fetch(`/api/visits${query.size?`?${query}`:""}`,{signal:c.signal}),d=await r.json() as CodedResponse&{visits:Visit[];nextCursor:string|null};if(request!==generation.current)return;if(!r.ok){if([401,403,404].includes(r.status)){setView(emptyView());cursor.current=null;}throw responseError(t,d);}cursor.current=d.nextCursor;setView(old=>({items:append?[...old.items,...d.visits]:d.visits,cursor:d.nextCursor,loaded:true,error:""}));}
  catch(e){if(request===generation.current&&!c.signal.aborted)setView(old=>({...old,error:e instanceof LocalizedError?e.message:t("customer.loadFailed")}));}
  finally{if(request===generation.current)setLoading(false);}
 },[t]);
 useEffect(()=>{if(open&&signedIn){const identity=`${account?.provider??""}:${account?.email??""}`;if(cacheIdentity.current!==identity){setView(emptyView());cursor.current=null;cacheIdentity.current=identity;}setActionError("");void load();}return cancelLoad;},[open,signedIn,account?.email,account?.provider,load,cancelLoad]);
 async function remove(){setMutating(true);setActionError("");try{const r=await fetch("/api/visits",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:deleteId})}),d=await r.json() as CodedResponse;if(!r.ok)throw responseError(t,d);await load();setDeleteId(null);}catch(e){setActionError(e instanceof LocalizedError?e.message:t("customer.deleteFailed"));}finally{setMutating(false);}}
 return <><Dialog open={open} onOpenChange={v=>{if(!v&&!mutating)onClose();}}><ModalContent className="visits-modal" closeDisabled={mutating} title={t("customer.myReviews")} description={t("customer.myReviewsNote")} footer={<><DialogClose asChild><button className="outline" disabled={mutating}>{t("customer.close")}</button></DialogClose>{signedIn&&<button className="primary" disabled={busy} onClick={()=>void load()}>{loading?<><LoaderCircle className="spin" size={16}/>{t("customer.loading")}</>:t("customer.refresh")}</button>}</>}>
 {!signedIn?<div className="login-prompt"><ShieldCheck size={25}/><p>{t("customer.myReviewsLogin")}</p><LocaleAnchor className="primary" href="/anmelden?weiter=%2F%3Fbesuche%3D1">{t("customer.loginOrRegister")}</LocaleAnchor></div>:<><AccountStorageNotice/><div className="visit-list" aria-busy={loading}>
 {loading&&!view.loaded&&<div className="review-loading" role="status"><LoaderCircle size={18} className="spin"/><span>{t("customer.myReviewsLoading")}</span></div>}{view.error&&<p className="error" role="alert">{view.error}</p>}{!loading&&!view.error&&view.loaded&&!view.items.length&&<div className="empty"><MessageCircle size={25}/><h3>{t("customer.noReviews")}</h3><p>{t("customer.noReviewsNote")}</p></div>}
 {targeted&&<button className="outline small" disabled={busy} onClick={()=>{selectedVisit.current=null;setTargeted(false);void load();}}>{t("customer.allMyReviews")}</button>}{view.items.map(v=><article className="visit" key={v.id}><div className="visit-top"><strong>{directory.some(w=>w.id===v.workshop)?<Link href={`/werkstatt/${encodeURIComponent(v.workshop)}`}>{v.workshop_name??t("customer.workshopProfile")}</Link>:v.workshop_name??t("customer.formerWorkshop")}</strong><span className={`visit-status ${v.status}`}>{valueLabel(locale,"status",v.status)}</span></div><p className="review-meta">{v.vehicle} · {formatDate(locale,v.date,{dateOnly:true})} · {valueLabel(locale,"service",v.service)}</p>{v.review?<div className="submitted-review"><span><Star size={15} fill="currentColor"/>{v.rating} / 5 · {v.display_name}</span><p>{v.review}</p></div>:<p className="help">{t("customer.oldReview")}</p>}
 <details className="evidence-details"><summary>{t("customer.privateEvidenceSummary",{type:valueLabel(locale,"evidence",v.evidence_type)})}</summary>{v.file_name&&<LocaleAnchor className="text-action" href={evidenceHref(v.id,locale)}>{t("customer.downloadReceipt")}</LocaleAnchor>}{v.evidence_note&&<p className="evidence-note">{v.evidence_note}</p>}</details>{v.moderator_note&&<p className="note">{t("customer.moderationNote",{note:v.moderator_note})}</p>}
 <div className="visit-actions">{["pending","approved","needs_more","published"].includes(v.status)&&directory.some(w=>w.id===v.workshop)&&<button className="outline small" disabled={busy} onClick={()=>onResubmit(v)}>{!v.review?t("customer.completeReview"):v.status==="needs_more"?t("customer.supplement"):t("customer.edit")}</button>}<button className="delete-button" disabled={busy} onClick={()=>{setActionError("");setDeleteId(v.id);}}><Trash2 size={14}/>{t("customer.delete")}</button></div>
 </article>)}{view.cursor&&<button className="outline" disabled={busy} onClick={()=>void load(true)}>{t("customer.moreReviews")}</button>}</div>{actionError&&<p className="error" role="alert">{actionError}</p>}</>}
 </ModalContent></Dialog><AlertDialog open={!!deleteId} onOpenChange={v=>{if(!v&&!mutating)setDeleteId(null);}}><AlertDialogContent className="app-dialog confirmation-dialog"><AlertDialogHeader><AlertDialogTitle>{t("customer.deleteReviewTitle")}</AlertDialogTitle></AlertDialogHeader><ModalBody><AlertDialogDescription>{t("customer.deleteReviewNote")}</AlertDialogDescription>{actionError&&<p className="error" role="alert">{actionError}</p>}</ModalBody><AlertDialogFooter><AlertDialogCancel disabled={mutating}>{t("customer.keep")}</AlertDialogCancel><AlertDialogAction disabled={mutating} onClick={e=>{e.preventDefault();void remove();}}>{mutating?t("customer.deleting"):t("customer.delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
