"use client";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,type CodedResponse} from "@/lib/i18n/codes";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";

import {deletePhrases,deleteConfirmation} from "@/lib/i18n/delete-confirmation";
import {valueLabel} from "@/lib/i18n/values";
import Link from "@/components/locale-link";
import {useRouter} from "next/navigation";
import {useCallback,useEffect,useId,useState,type FormEvent} from "react";
import {AlertDialog,AlertDialogTrigger,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from "@/components/ui/alert-dialog";

type Account={email:string;name:string;provider:string;protected:boolean};
type AccountState=CodedResponse&{account:Account|null;deletionReady:boolean;deletionStarted:boolean;error?:string};

export function AccountSettings(){
 const {locale,t}=useI18n(),phrase=deletePhrases[locale],networkError=t("customer.accountNetwork");
 const id=useId(),router=useRouter();
 const [state,setState]=useState<AccountState|null>(null),[name,setName]=useState(""),[password,setPassword]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState("");
 useNavigationGuard({busy,dirty:!!password||!!confirmation||!!state?.account&&name!==state.account.name});
 const load=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);setError("");
  try{
   const response=await fetch("/api/account",{cache:"no-store",signal}),data=await response.json() as AccountState;
   if(!response.ok)throw responseError(t,data);
   if(signal?.aborted)return;
   setState(data);setName(data.account?.name??"");
   if(data.deletionReady||data.deletionStarted)setOpen(true);
  }catch(e){if(!signal?.aborted)setError(e instanceof TypeError?networkError:e instanceof LocalizedError?e.message:networkError);}
  finally{if(!signal?.aborted)setLoading(false);}
 },[t,networkError]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Load only the authenticated account, including an interrupted deletion, on mount.
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return ()=>controller.abort();},[load]);

 async function mutate(method:string,body:Record<string,unknown>,url="/api/account"){
  const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json() as CodedResponse&{name?:string;url?:string;ok?:boolean};
  if(!response.ok)throw responseError(t,data);
  return data;
 }
 async function save(event:FormEvent){
  event.preventDefault();if(busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const data=await mutate("PATCH",{name});
   setState(old=>old?.account?{...old,account:{...old.account,name:data.name!}}:old);setName(data.name!);
   setMessage(t("customer.nameSaved"));router.refresh();
  }catch(e){setError(e instanceof TypeError?networkError:e instanceof LocalizedError?e.message:networkError);}
  finally{setBusy(false);}
 }
 async function reauthenticate(){
  if(busy||!state?.account)return;
  setBusy(true);setError("");setMessage("");let navigating=false;
  try{
   if(state.account.provider==="Google"){
    const data=await mutate("POST",{locale,reauthenticate:true},"/api/auth/google");
    navigating=true;window.location.assign(data.url!);
   }else{
    await mutate("POST",{password});setPassword("");setState(old=>old?{...old,deletionReady:true}:old);
   }
  }catch(e){navigating=false;setPassword("");setError(e instanceof TypeError?networkError:e instanceof LocalizedError?e.message:networkError);}
  finally{if(!navigating)setBusy(false);}
 }
 async function remove(){
  if(busy||!deleteConfirmation(locale,confirmation))return;
  setBusy(true);setError("");setMessage("");
  try{
   await mutate("DELETE",{confirmation:deleteConfirmation(locale,confirmation)});setOpen(false);setState({account:null,deletionReady:false,deletionStarted:false});
   setMessage(t("customer.accountDeleted"));router.refresh();
  }catch(e){
   const failure=e instanceof TypeError?networkError:e instanceof LocalizedError?e.message:networkError;
   await load();setError(failure);
  }finally{setBusy(false);}
 }
 const ready=!!state&&(state.deletionReady||state.deletionStarted);
 return <section className="account-settings" aria-labelledby={`${id}-heading`} aria-busy={loading||busy}>
  <h2 id={`${id}-heading`}>{t("customer.yourAccount")}</h2>
  {loading?<p role="status">{t("customer.accountLoading")}</p>:state?.account?<>
   <p className="account-identity">{state.account.email} · {valueLabel(locale,"provider",state.account.provider)}</p>
   <form onSubmit={save} className="account-name-form">
    <label htmlFor={`${id}-name`}>{t("customer.displayName")}</label>
    <input id={`${id}-name`} name="name" autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={event=>setName(event.target.value)} disabled={busy||state.deletionStarted} aria-describedby={`${id}-name-note`}/>
    <p id={`${id}-name-note`}>{t("customer.nameNote")}</p>
    <button className="account-button" type="submit" disabled={busy||state.deletionStarted}>{busy?t("customer.wait"):t("customer.saveName")}</button>
   </form>
   {state.account.protected?<p>{t("customer.protectedAccount")}</p>:<p>{t("customer.deleteAccountNote")}</p>}
  </>:state?.deletionStarted?<p>{t("customer.deletionStarted")}</p>:state?<p>{t("customer.loginAccountStart")} <Link href="/anmelden?weiter=/einstellungen">{t("customer.googleOrEmail")}</Link> {t("customer.loginAccountEnd")}</p>:<button className="account-button" onClick={()=>{setError("");void load();}}>{t("customer.reload")}</button>}
  {error&&!open&&<p className="account-error" role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
  {state&&(state.deletionStarted||state.account&&!state.account.protected)&&<AlertDialog open={open} onOpenChange={value=>{if(!busy){setOpen(value);setConfirmation("");setPassword("");setError("");}}}>
   <AlertDialogTrigger asChild><button className="account-button account-danger" disabled={busy||loading}>{state.deletionStarted?t("customer.continueDeletion"):t("customer.deleteAccount")}</button></AlertDialogTrigger>
   <AlertDialogContent onEscapeKeyDown={event=>{if(busy)event.preventDefault();}}>
    <AlertDialogHeader>
     <AlertDialogTitle>{t("customer.deleteAccountTitle")}</AlertDialogTitle>
     <AlertDialogDescription>{t("customer.deleteAccountDescription")}</AlertDialogDescription>
    </AlertDialogHeader>
    {!ready?<div className="account-confirmation">
     <p>{t("customer.reauthNote")}</p>
     {state.account?.provider==="E-Mail"&&<><label htmlFor={`${id}-password`}>{t("customer.currentPassword")}</label><input id={`${id}-password`} type="password" autoComplete="current-password" maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} disabled={busy}/></>}
     <button className="account-button" disabled={busy||state.account?.provider==="E-Mail"&&!password} onClick={()=>void reauthenticate()}>{busy?t("customer.identityChecking"):state.account?.provider==="Google"?t("customer.googleReauth"):t("customer.confirmPassword")}</button>
    </div>:<div className="account-confirmation">
     <label htmlFor={`${id}-confirmation`}>{t("customer.enterDeletePhrase",{phrase})}</label>
     <input id={`${id}-confirmation`} autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={busy}/>
     {state.deletionStarted&&<p>{t("customer.deletionRetryNote")}</p>}
    </div>}
    {error&&<p className="account-error" role="alert">{error}</p>}
    <AlertDialogFooter>
     <AlertDialogCancel disabled={busy}>{t("customer.cancel")}</AlertDialogCancel>
     {ready&&<button className="account-button account-danger" disabled={busy||!deleteConfirmation(locale,confirmation)} onClick={()=>void remove()}>{busy?t("customer.accountDeleting"):state.deletionStarted?t("customer.retryDeletion"):t("customer.deletePermanently")}</button>}
    </AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>}
 </section>;
}
