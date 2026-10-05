"use client";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";

import Link from "@/components/locale-link";
import {useRouter} from "next/navigation";
import {useCallback,useEffect,useId,useState,type FormEvent} from "react";
import {AlertDialog,AlertDialogTrigger,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from "@/components/ui/alert-dialog";

type Account={email:string;name:string;provider:string;protected:boolean};
type AccountState={account:Account|null;deletionReady:boolean;deletionStarted:boolean;error?:string};
const networkError="Die Kontoverwaltung ist gerade nicht erreichbar. Bitte versuche es erneut.";

export function AccountSettings(){
 const id=useId(),router=useRouter();
 const [state,setState]=useState<AccountState|null>(null),[name,setName]=useState(""),[password,setPassword]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState("");
 useNavigationGuard({busy,dirty:!!password||!!confirmation||!!state?.account&&name!==state.account.name});
 const load=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);setError("");
  try{
   const response=await fetch("/api/account",{cache:"no-store",signal}),data=await response.json() as AccountState;
   if(!response.ok)throw Error(data.error||networkError);
   if(signal?.aborted)return;
   setState(data);setName(data.account?.name??"");
   if(data.deletionReady||data.deletionStarted)setOpen(true);
  }catch(e){if(!signal?.aborted)setError(e instanceof TypeError?networkError:e instanceof Error?e.message:networkError);}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Load only the authenticated account, including an interrupted deletion, on mount.
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return ()=>controller.abort();},[load]);

 async function mutate(method:string,body:Record<string,unknown>,url="/api/account"){
  const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json() as {name?:string;url?:string;ok?:boolean;error?:string};
  if(!response.ok)throw Error(data.error||networkError);
  return data;
 }
 async function save(event:FormEvent){
  event.preventDefault();if(busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const data=await mutate("PATCH",{name});
   setState(old=>old?.account?{...old,account:{...old.account,name:data.name!}}:old);setName(data.name!);
   setMessage("Anzeigename gespeichert. Bestehende Bewertungsnamen bleiben unverändert.");router.refresh();
  }catch(e){setError(e instanceof TypeError?networkError:e instanceof Error?e.message:networkError);}
  finally{setBusy(false);}
 }
 async function reauthenticate(){
  if(busy||!state?.account)return;
  setBusy(true);setError("");setMessage("");let navigating=false;
  try{
   if(state.account.provider==="Google"){
    const data=await mutate("POST",{reauthenticate:true},"/api/auth/google");
    navigating=true;window.location.assign(data.url!);
   }else{
    await mutate("POST",{password});setPassword("");setState(old=>old?{...old,deletionReady:true}:old);
   }
  }catch(e){navigating=false;setPassword("");setError(e instanceof TypeError?networkError:e instanceof Error?e.message:networkError);}
  finally{if(!navigating)setBusy(false);}
 }
 async function remove(){
  if(busy||confirmation!=="KONTO LÖSCHEN")return;
  setBusy(true);setError("");setMessage("");
  try{
   await mutate("DELETE",{confirmation});setOpen(false);setState({account:null,deletionReady:false,deletionStarted:false});
   setMessage("Dein Konto, deine Bewertungen und privaten Nachweise wurden gelöscht.");router.refresh();
  }catch(e){
   const failure=e instanceof TypeError?networkError:e instanceof Error?e.message:networkError;
   await load();setError(failure);
  }finally{setBusy(false);}
 }
 const ready=!!state&&(state.deletionReady||state.deletionStarted);
 return <section className="account-settings" aria-labelledby={`${id}-heading`} aria-busy={loading||busy}>
  <h2 id={`${id}-heading`}>Dein Konto</h2>
  {loading?<p role="status">Kontodaten werden geladen …</p>:state?.account?<>
   <p className="account-identity">{state.account.email} · {state.account.provider}</p>
   <form onSubmit={save} className="account-name-form">
    <label htmlFor={`${id}-name`}>Anzeigename</label>
    <input id={`${id}-name`} name="name" autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={event=>setName(event.target.value)} disabled={busy||state.deletionStarted} aria-describedby={`${id}-name-note`}/>
    <p id={`${id}-name-note`}>Dieser Name gilt für dein Konto. Die Anzeigenamen bereits eingereichter Bewertungen bleiben unverändert; du kannst sie unter „Meine Bewertungen“ einzeln bearbeiten.</p>
    <button className="account-button" type="submit" disabled={busy||state.deletionStarted}>{busy?"Bitte warten …":"Anzeigename speichern"}</button>
   </form>
   {state.account.protected?<p>Administrationszugänge sind gegen eigene Kontolöschung geschützt. Bitte wende dich für eine Übergabe an die Verwaltung.</p>:<p>Du kannst dein Konto mit allen Bewertungen, Besuchen und privaten Nachweisdateien endgültig löschen. Dein Google-Konto wird dabei nicht gelöscht.</p>}
  </>:state?.deletionStarted?<p>Deine Kontolöschung wurde begonnen. Das Konto ist gesperrt. Du kannst die Bereinigung hier wiederholen.</p>:state?<p>Melde dich mit <Link href="/anmelden?weiter=/einstellungen">Google oder E-Mail</Link> an, um deinen Anzeigenamen zu bearbeiten oder dein Konto zu löschen.</p>:<button className="account-button" onClick={()=>{setError("");void load();}}>Erneut laden</button>}
  {error&&!open&&<p className="account-error" role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
  {state&&(state.deletionStarted||state.account&&!state.account.protected)&&<AlertDialog open={open} onOpenChange={value=>{if(!busy){setOpen(value);setConfirmation("");setPassword("");setError("");}}}>
   <AlertDialogTrigger asChild><button className="account-button account-danger" disabled={busy||loading}>{state.deletionStarted?"Löschung fortsetzen":"Konto löschen"}</button></AlertDialogTrigger>
   <AlertDialogContent onEscapeKeyDown={event=>{if(busy)event.preventDefault();}}>
    <AlertDialogHeader>
     <AlertDialogTitle>Konto endgültig löschen?</AlertDialogTitle>
     <AlertDialogDescription>Dein Riparim-Konto und alle zugehörigen Bewertungen, Besuche, privaten Nachweisdateien und bestätigten Kontoverknüpfungen werden entfernt. Diese Aktion lässt sich nicht rückgängig machen.</AlertDialogDescription>
    </AlertDialogHeader>
    {!ready?<div className="account-confirmation">
     <p>Bestätige zuerst erneut deine Identität. Die Bestätigung gilt zehn Minuten.</p>
     {state.account?.provider==="E-Mail"&&<><label htmlFor={`${id}-password`}>Aktuelles Passwort</label><input id={`${id}-password`} type="password" autoComplete="current-password" maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} disabled={busy}/></>}
     <button className="account-button" disabled={busy||state.account?.provider==="E-Mail"&&!password} onClick={()=>void reauthenticate()}>{busy?"Identität wird geprüft …":state.account?.provider==="Google"?"Mit Google erneut bestätigen":"Passwort bestätigen"}</button>
    </div>:<div className="account-confirmation">
     <label htmlFor={`${id}-confirmation`}>Gib zur Bestätigung KONTO LÖSCHEN ein</label>
     <input id={`${id}-confirmation`} autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={busy}/>
     {state.deletionStarted&&<p>Bei einem Teilfehler bleibt das Konto gesperrt. Wiederhole die Löschung innerhalb von sieben Tagen in diesem Browser; danach hilft die Verwaltung.</p>}
    </div>}
    {error&&<p className="account-error" role="alert">{error}</p>}
    <AlertDialogFooter>
     <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
     {ready&&<button className="account-button account-danger" disabled={busy||confirmation!=="KONTO LÖSCHEN"} onClick={()=>void remove()}>{busy?"Konto wird gelöscht …":state.deletionStarted?"Löschung wiederholen":"Endgültig löschen"}</button>}
    </AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>}
 </section>;
}
