"use client";
import {useState} from "react";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {useI18n} from "@/lib/i18n/client";
import {responseError,type CodedResponse} from "@/lib/i18n/codes";
import {Dialog,DialogClose} from "./ui/dialog";
import {ModalContent} from "./modal-shell";
import {Checkbox} from "./ui/checkbox";
import type {Workshop} from "@/lib/workshops";
export function PremiumPartnerControl({workshop}:{workshop:Workshop}){
 const {t}=useI18n();
 const [open,setOpen]=useState(false),[active,setActive]=useState(false),[loaded,setLoaded]=useState(false),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useNavigationGuard({busy:open&&(busy||loading)});
 async function show(){setOpen(true);setLoading(true);setLoaded(false);setError("");try{const response=await fetch(`/api/premium-workshops?admin=1&workshop=${encodeURIComponent(workshop.id)}`),data=await response.json() as CodedResponse&{active:boolean};if(!response.ok)throw responseError(t,data);if(typeof data.active!=="boolean")throw Error("Invalid placement state");setActive(data.active);setLoaded(true);}catch{setError(t("common.unavailable"));}finally{setLoading(false);}}
 async function save(){if(loading||busy||!loaded)return;setBusy(true);setError("");try{const response=await fetch('/api/premium-workshops',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({workshop:workshop.id,active})}),data=await response.json() as CodedResponse;if(!response.ok)throw responseError(t,data);setOpen(false);}catch{setError(t("common.errorGeneric"));}finally{setBusy(false);}}
 return <><button type="button" className="text-action premium-control" onClick={()=>void show()}>{t("management.premiumManage")}</button><Dialog open={open} onOpenChange={value=>{if(!busy&&!loading)setOpen(value);}}><ModalContent title={t("management.premiumManage")} description={workshop.name} closeDisabled={busy||loading} footer={<><DialogClose asChild><button className="outline" disabled={busy||loading}>{t("management.cancel")}</button></DialogClose><button className="primary" disabled={loading||busy||!loaded} onClick={()=>void save()}>{busy?t("management.saving"):t("management.premiumSave")}</button></>}>
  <p>{t("management.premiumHelp")}</p>{loading?<p role="status">{t("management.loading")}</p>:<label className="activation-switch"><Checkbox checked={active} disabled={busy||!loaded||(workshop.status!=="published"&&!active)} onCheckedChange={value=>setActive(value===true)} aria-label={t("management.premiumActive")}/><span>{t("management.premiumActive")}</span></label>}{workshop.status!=="published"&&<p className="help">{t("management.premiumPublishedOnly")}</p>}{error&&<div><p className="error" role="alert">{error}</p>{!loaded&&<button className="outline" disabled={busy} onClick={()=>void show()}>{t("common.retry")}</button>}</div>}
 </ModalContent></Dialog></>;
}
