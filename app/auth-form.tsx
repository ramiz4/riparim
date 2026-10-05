"use client";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,messageCodeMessage,type CodedResponse} from "@/lib/i18n/codes";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useState,type FormEvent} from "react";
import {Mail,LockKeyhole,LoaderCircle,Eye,EyeOff} from "lucide-react";
import {SiteHeader} from "@/components/site-header";
import type {AccountIdentity} from "@/components/account-storage-notice";

export type AuthScreen="login"|"register"|"recovery"|"reset";
type Props={account:AccountIdentity|null;screen:AuthScreen;emailReady:boolean;googleReady:boolean;isOwner:boolean;returnTo:string;errorHint?:string;notice?:string};


function GoogleMark(){return <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-2.9-.4-4.3H24v8.1h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15.1Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.5a12 12 0 0 1 0-7V15.2H5.8a20 20 0 0 0 0 17.6l6.8-5.3Z"/><path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3l5.9-5.9A19.6 19.6 0 0 0 24 4 20 20 0 0 0 5.8 15.2l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>;}

export default function AuthForm({screen,emailReady,googleReady,isOwner,returnTo,errorHint,notice,account}:Props){
 const {locale,t}=useI18n();
 const headings:Record<AuthScreen,string>={login:t("customer.authLogin"),register:t("customer.authRegister"),recovery:t("customer.authRecovery"),reset:t("customer.authReset")};
 const [error,setError]=useState(errorHint??""),[message,setMessage]=useState(""),[busy,setBusy]=useState<"email"|"google"|null>(null),[showPassword,setShowPassword]=useState(false);
 const [dirty,setDirty]=useState(false);useNavigationGuard({dirty:dirty&&!message,busy:!!busy});
 const social=screen==="login"||screen==="register";
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!emailReady||busy)return;const f=new FormData(e.currentTarget);
  if(screen==="reset"&&f.get("password")!==f.get("passwordRepeat")){setError(t("customer.passwordMismatch"));return;}
  setBusy("email");setError("");let navigating=false;
  try{const r=await fetch(`/api/auth/${screen}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({locale,email:f.get("email"),password:f.get("password"),returnTo})});const d=await r.json() as CodedResponse&{returnTo?:string};if(!r.ok)throw responseError(t,d);if(d.returnTo){navigating=true;window.location.assign(d.returnTo);}else setMessage(messageCodeMessage(t,d.messageCode));}
  catch(e){navigating=false;setError(e instanceof LocalizedError?e.message:t("customer.tryAgain"));}finally{if(!navigating)setBusy(null);}
 }
 async function google(){
  if(!googleReady||busy)return;setBusy("google");setError("");
  try{const r=await fetch("/api/auth/google",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({locale,returnTo})});const d=await r.json() as CodedResponse&{url?:string};if(!r.ok||!d.url)throw responseError(t,d);window.location.assign(d.url);}
  catch(e){setError(e instanceof LocalizedError?e.message:t("customer.tryAgain"));setBusy(null);}
 }
 return <><SiteHeader account={account} isAdmin={isOwner}/><main className="auth-page"><section className="auth-card auth-compact" aria-labelledby="auth-title">
 <h1 id="auth-title">{headings[screen]}</h1><p className="auth-intro">{screen==="login"?t("customer.loginIntro"):screen==="register"?t("customer.registerIntro"):screen==="recovery"?t("customer.recoveryIntro"):t("customer.resetIntro")}</p>
 {notice&&<p className="admin-feedback" role="status">{notice}</p>}
 {message?<div className="auth-success" role="status"><Mail size={24}/><p>{message}</p><LocaleAnchor className="outline" href={`/anmelden?weiter=${encodeURIComponent(returnTo)}`}>{t("customer.backLogin")}</LocaleAnchor></div>:<>
 {social&&<><button className="auth-google" type="button" disabled={!googleReady||!!busy} onClick={()=>void google()}>{busy==="google"?<LoaderCircle className="spin" size={20}/>:<GoogleMark/>}{t("customer.googleContinue")}</button>{!googleReady&&<p className="auth-unavailable">{t("customer.googleSetup")}</p>}<div className="auth-divider"><span>{t("customer.orEmail")}</span></div></>}
 <form onChange={()=>setDirty(true)} onSubmit={submit} className="journey-form auth-email-form">
 {screen!=="reset"&&<label>{t("customer.email")}<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder={t("customer.emailPlaceholder")} disabled={!emailReady||!!busy}/></label>}
 {screen!=="recovery"&&<label><span className="auth-label-row">{t("customer.password")}{screen==="login"&&<LocaleAnchor href="/passwort-vergessen">{t("customer.forgot")}</LocaleAnchor>}</span><span className="auth-password-field"><input name="password" type={showPassword?"text":"password"} autoComplete={screen==="login"?"current-password":"new-password"} required minLength={screen==="login"?1:12} maxLength={128} placeholder={screen==="login"?t("customer.yourPassword"):t("customer.passwordMinimum")} disabled={!emailReady||!!busy}/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?t("customer.hidePassword"):t("customer.showPassword")} aria-pressed={showPassword} disabled={!emailReady}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>}
 {screen==="reset"&&<label>{t("customer.repeatPassword")}<input name="passwordRepeat" type={showPassword?"text":"password"} autoComplete="new-password" required minLength={12} maxLength={128} disabled={!emailReady||!!busy}/></label>}
 <button className="primary" disabled={!emailReady||!!busy} type="submit">{busy==="email"?<><LoaderCircle className="spin" size={17}/>{t("customer.oneMoment")}</>:screen==="login"?t("customer.authLogin"):screen==="register"?t("customer.authRegister"):screen==="recovery"?t("customer.sendLink"):t("customer.savePassword")}</button>
 {!emailReady&&<p className="auth-unavailable">{screen==="register"?t("customer.registrationSetup"):screen==="recovery"?t("customer.recoverySetup"):t("customer.emailSetup")}</p>}
 </form>
 {error&&<p className="error auth-error" role="alert">{error}</p>}
 <p className="auth-switch">{screen==="login"?<>{t("customer.noAccount")} <LocaleAnchor href={`/registrieren?weiter=${encodeURIComponent(returnTo)}`}>{t("customer.register")}</LocaleAnchor></>:screen==="register"?<>{t("customer.hasAccount")} <LocaleAnchor href={`/anmelden?weiter=${encodeURIComponent(returnTo)}`}>{t("customer.authLogin")}</LocaleAnchor></>:<LocaleAnchor href="/anmelden">{t("customer.backLogin")}</LocaleAnchor>}</p>
 </>}
 <div className="auth-privacy"><LockKeyhole size={14}/><p>{t("customer.privateReceipts")} <LocaleAnchor href="/datenschutz">{t("customer.privacy")}</LocaleAnchor></p></div>
 </section></main></>;
}
