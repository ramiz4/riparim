"use client";
import {useState} from "react";
import {Cloud,UserRound} from "lucide-react";

export type AccountIdentity={email:string;displayName:string;provider?:string};

export function AccountStorageNotice({account}:{account:AccountIdentity|null}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function signOut(){setBusy(true);setError("");try{const r=await fetch("/api/auth/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});if(!r.ok)throw Error("Abmelden ist gerade nicht verfügbar. Bitte versuche es erneut.");window.location.assign("/anmelden");}catch(e){setError(e instanceof Error?e.message:"Abmelden fehlgeschlagen.");setBusy(false);}}
 if(!account)return null;
 return <aside className="account-storage-notice" aria-label="Dein Konto und die Speicherung">
  <div className="account-identity"><UserRound size={19}/><div><span>{account.provider==="E-Mail"?"Mit deinem Mjeshtër-Konto angemeldet":`Angemeldet${account.provider?` über ${account.provider}`:""}`}</span><strong>{account.email}</strong>{account.displayName!==account.email&&<span>{account.displayName}</span>}</div></div>
  <div className="account-storage-copy"><Cloud size={19}/><p><strong>Nachweise bleiben privat auf dem Server gespeichert.</strong> Auch nach einem Browserwechsel oder gelöschtem Cache – melde dich mit diesem Konto an.</p></div>
 <div className="account-actions">{account.provider==="E-Mail"?<button onClick={()=>void signOut()} disabled={busy} type="button">{busy?"Wird abgemeldet …":"Abmelden"}</button>:<a href="/signout-with-chatgpt?return_to=%2Fanmelden" target="_top">Abmelden</a>}<span>Abmelden löscht keine Nachweise.</span></div>{error&&<p className="error" role="alert">{error}</p>}</aside>;
}
