"use client";
import {useState,type FormEvent} from "react";
import {Mail,LockKeyhole,LoaderCircle,Eye,EyeOff} from "lucide-react";
import {SiteHeader} from "@/components/site-header";
import type {AccountIdentity} from "@/components/account-storage-notice";

export type AuthScreen="login"|"register"|"recovery"|"reset";
type Props={account:AccountIdentity|null;screen:AuthScreen;emailReady:boolean;googleReady:boolean;isOwner:boolean;returnTo:string;errorHint?:string;notice?:string};
const headings:Record<AuthScreen,string>={login:"Anmelden",register:"Konto erstellen",recovery:"Passwort vergessen?",reset:"Neues Passwort"};

function GoogleMark(){return <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-2.9-.4-4.3H24v8.1h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15.1Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.5a12 12 0 0 1 0-7V15.2H5.8a20 20 0 0 0 0 17.6l6.8-5.3Z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3l5.9-5.9A19.6 19.6 0 0 0 24 4 20 20 0 0 0 5.8 15.2l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>;}

export default function AuthForm({screen,emailReady,googleReady,isOwner,returnTo,errorHint,notice,account}:Props){
 const [error,setError]=useState(errorHint??""),[message,setMessage]=useState(""),[busy,setBusy]=useState<"email"|"google"|null>(null),[showPassword,setShowPassword]=useState(false);
 const social=screen==="login"||screen==="register";
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!emailReady||busy)return;const f=new FormData(e.currentTarget);
  if(screen==="reset"&&f.get("password")!==f.get("passwordRepeat")){setError("Die Passwörter stimmen nicht überein.");return;}
  setBusy("email");setError("");
  try{const r=await fetch(`/api/auth/${screen}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:f.get("email"),password:f.get("password"),returnTo})});const d=await r.json() as {error?:string;message?:string;returnTo?:string};if(!r.ok)throw Error(d.error);if(d.returnTo)window.location.assign(d.returnTo);else setMessage(d.message??"Anfrage eingereicht.");}
  catch(e){setError(e instanceof Error?e.message:"Bitte versuche es erneut.");}finally{setBusy(null);}
 }
 async function google(){
  if(!googleReady||busy)return;setBusy("google");setError("");
  try{const r=await fetch("/api/auth/google",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({returnTo})});const d=await r.json() as {error?:string;url?:string};if(!r.ok||!d.url)throw Error(d.error??"Google-Anmeldung ist gerade nicht verfügbar.");window.location.assign(d.url);}
  catch(e){setError(e instanceof Error?e.message:"Bitte versuche es erneut.");setBusy(null);}
 }
 return <><SiteHeader account={account} isAdmin={isOwner} section="Konto"/><main className="auth-page"><section className="auth-card auth-compact" aria-labelledby="auth-title">
 <h1 id="auth-title">{headings[screen]}</h1><p className="auth-intro">{screen==="login"?"Deine Besuche und Bewertungen an einem Ort.":screen==="register"?"Bewerte deinen Werkstattbesuch.":screen==="recovery"?"Wir senden dir einen Link per E-Mail.":"Wähle ein Passwort mit mindestens 12 Zeichen."}</p>
 {notice&&<p className="admin-feedback" role="status">{notice}</p>}
 {message?<div className="auth-success" role="status"><Mail size={24}/><p>{message}</p><a className="outline" href={`/anmelden?weiter=${encodeURIComponent(returnTo)}`}>Zur Anmeldung</a></div>:<>
 {social&&<><button className="auth-google" type="button" disabled={!googleReady||!!busy} onClick={()=>void google()}>{busy==="google"?<LoaderCircle className="spin" size={20}/>:<GoogleMark/>}Mit Google fortfahren</button>{!googleReady&&<p className="auth-unavailable">Google-Anmeldung wird eingerichtet.</p>}<div className="auth-divider"><span>oder mit E-Mail</span></div></>}
 <form onSubmit={submit} className="journey-form auth-email-form">
 {screen!=="reset"&&<label>E-Mail<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="name@beispiel.de" disabled={!emailReady||!!busy}/></label>}
 {screen!=="recovery"&&<label><span className="auth-label-row">Passwort{screen==="login"&&<a href="/passwort-vergessen">Vergessen?</a>}</span><span className="auth-password-field"><input name="password" type={showPassword?"text":"password"} autoComplete={screen==="login"?"current-password":"new-password"} required minLength={screen==="login"?1:12} maxLength={128} placeholder={screen==="login"?"Dein Passwort":"Mindestens 12 Zeichen"} disabled={!emailReady||!!busy}/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Passwort verbergen":"Passwort anzeigen"} aria-pressed={showPassword} disabled={!emailReady}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>}
 {screen==="reset"&&<label>Passwort wiederholen<input name="passwordRepeat" type={showPassword?"text":"password"} autoComplete="new-password" required minLength={12} maxLength={128} disabled={!emailReady||!!busy}/></label>}
 <button className="primary" disabled={!emailReady||!!busy} type="submit">{busy==="email"?<><LoaderCircle className="spin" size={17}/>Einen Moment …</>:screen==="login"?"Anmelden":screen==="register"?"Konto erstellen":screen==="recovery"?"Link senden":"Passwort speichern"}</button>
 {!emailReady&&<p className="auth-unavailable">E-Mail-Anmeldung wird eingerichtet.</p>}
 </form>
 {error&&<p className="error auth-error" role="alert">{error}</p>}
 <p className="auth-switch">{screen==="login"?<>Noch kein Konto? <a href={`/registrieren?weiter=${encodeURIComponent(returnTo)}`}>Registrieren</a></>:screen==="register"?<>Schon ein Konto? <a href={`/anmelden?weiter=${encodeURIComponent(returnTo)}`}>Anmelden</a></>:<a href="/anmelden">Zur Anmeldung</a>}</p>
 </>}
 <div className="auth-privacy"><LockKeyhole size={14}/><p>Deine Belege bleiben privat.</p></div>
 </section></main></>;
}
