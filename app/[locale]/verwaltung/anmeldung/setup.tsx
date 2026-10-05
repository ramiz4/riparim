"use client";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,type CodedResponse} from "@/lib/i18n/codes";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {LocaleAnchor} from "@/components/locale-anchor";
import {useEffect,useState,type FormEvent} from "react";
import {ShieldCheck,LoaderCircle} from "lucide-react";
import {SiteHeader} from "@/components/site-header";
import {AdminNavigation} from "@/components/admin-navigation";
import type {AccountIdentity} from "@/components/account-storage-notice";
import {Checkbox} from "@/components/ui/checkbox";
import {Switch} from "@/components/ui/switch";
import {confirmationEmailSubject,recoveryEmailSubject,confirmationEmailTemplate,recoveryEmailTemplate} from "@/lib/auth/email-templates";
export default function AuthSetup({account}:{account:AccountIdentity}){const {t}=useI18n();const [url,setUrl]=useState(""),[key,setKey]=useState(""),[enabled,setEnabled]=useState(false),[mail,setMail]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [dirty,setDirty]=useState(false);useNavigationGuard({busy,dirty});
 useEffect(()=>{const c=new AbortController();fetch("/api/auth-settings",{signal:c.signal}).then(async r=>{const d=await r.json() as CodedResponse&{config:{projectUrl:string;publicKey:string;enabled:boolean;emailDeliveryConfirmed:boolean}|null;error?:string};if(!r.ok)throw responseError(t,d);if(d.config){setUrl(d.config.projectUrl);setKey(d.config.publicKey);setEnabled(d.config.enabled);setMail(d.config.emailDeliveryConfirmed);}}).catch(e=>{if(!c.signal.aborted)setError(e instanceof LocalizedError?e.message:t("management.configNetwork"));}).finally(()=>setLoading(false));return()=>c.abort();},[t]);
 async function save(e:FormEvent){e.preventDefault();if(busy||loading)return;setBusy(true);setError("");setMessage("");try{const r=await fetch("/api/auth-settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectUrl:url,publicKey:key,enabled,emailDeliveryConfirmed:mail})});const d=await r.json() as CodedResponse;if(!r.ok)throw responseError(t,d);setDirty(false);setMessage(enabled?mail?t("management.authActivated"):t("management.authProvidersActivated"):t("management.authDraftSaved"));}catch(e){setError(e instanceof LocalizedError?e.message:t("management.saveFailed"));}finally{setBusy(false);}}
 const [copyMessage,setCopyMessage]=useState(""),[copyError,setCopyError]=useState("");
 async function copyMail(source:string,label:string){setCopyMessage("");setCopyError("");try{await navigator.clipboard.writeText(source);setCopyMessage(t("management.mailFieldCopied",{field:label}));}catch{setCopyError(t("management.mailCopyFailed"));}}
 const mailFields=[
  {id:"confirmation-subject",label:t("management.confirmationSubject"),source:confirmationEmailSubject},
  {id:"confirmation-body",label:t("management.confirmationBody"),source:confirmationEmailTemplate},
  {id:"recovery-subject",label:t("management.recoverySubject"),source:recoveryEmailSubject},
  {id:"recovery-body",label:t("management.recoveryBody"),source:recoveryEmailTemplate}
 ];
 const exportCommand="npm run auth:email-templates -- --site-origin SITE_ORIGIN --provider-site-url PROVIDER_SITE_URL --output-dir NEW_DIRECTORY";
 return <><SiteHeader account={account} isAdmin/><AdminNavigation active="login"/><main className="auth-setup-page wrap"><div className="section-heading"><h1>{t("management.connectAuth")}</h1><p>{t("management.authSetupIntro")}</p></div><div className="auth-setup-layout"><section className="setup-instructions" aria-labelledby="setup-instructions-heading">
 <h2 id="setup-instructions-heading">{t("management.authChecklist")}</h2>
 <p>{t("management.authReuseProject")}</p>
 <ol className="setup-steps">
  <li><h3>{t("management.authChooseProject")}</h3><p>{t("management.authProjectCheckBefore")} <LocaleAnchor href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">{t("management.supabaseProject")}</LocaleAnchor>{t("management.authProjectCheckAfter")}</p></li>
  <li><h3>{t("management.authWebsiteMail")}</h3><p>{t("management.authWebsiteMailCheck")}</p>
   <details><summary>{t("management.authMailHelp")}</summary><div className="setup-help">
    <p>{t("management.smtpHelp")}</p><p>{t("management.authSmtpFreeRule")}</p>
    <LocaleAnchor href="https://supabase.com/docs/guides/auth/auth-smtp" target="_blank" rel="noopener noreferrer">{t("management.smtpDocs")}</LocaleAnchor>
    <p>{t("management.authOriginRule")}</p>
    <p>{t("management.authCallbackRule",{callback:"https://riparim.com/auth/bestaetigen\\?**"})}</p>
    <p>{t("management.authReleaseBackup")}</p><p>{t("management.authExportHelp")}</p>
    <pre aria-label="auth:email-templates" tabIndex={0}>{exportCommand}</pre>
    <p>{t("management.authOriginFailure")}</p><p>{t("management.authFieldPairHelp")}</p>
    {mailFields.map(field=><details key={field.id} data-auth-mail-field={field.id}><summary>{field.label}</summary><button type="button" className="outline small" aria-label={t("management.copyMailField",{field:field.label})} onClick={()=>void copyMail(field.source,field.label)}>{t("management.copyMailField",{field:field.label})}</button><pre aria-label={field.label} tabIndex={0}>{field.source}</pre></details>)}
    {copyMessage&&<p role="status">{copyMessage}</p>}{copyError&&<p role="alert">{copyError}</p>}
    <p>{t("management.authReadbackHelp")}</p><p>{t("management.authActivationFailure")}</p>
    <LocaleAnchor href="https://supabase.com/docs/guides/auth/auth-email-templates" target="_blank" rel="noopener noreferrer">{t("management.authTemplatesDocs")}</LocaleAnchor>
   </div></details>
  </li>
  <li><h3>{t("management.authTestDelivery")}</h3><p>{t("management.authTestDeliveryCheck")}</p></li>
  <li><h3>{t("management.authGoogleHeading")}</h3><p>{t("management.authGoogleCheck")}</p>
   <details><summary>{t("management.authGoogleSettings")}</summary><div className="setup-help"><p>{t("management.googleBefore")} <strong>https://riparim.com</strong> {t("management.googleAfter")}</p><p>{t("management.authGoogleCredentials")}</p><LocaleAnchor href="https://supabase.com/docs/guides/auth/social-login/auth-google" target="_blank" rel="noopener noreferrer">{t("management.googleDocs")}</LocaleAnchor></div></details>
  </li>
 </ol>
 <div className="note"><ShieldCheck size={21}/><p>{t("management.legacyProofHelp")}</p></div>
 </section><form className="journey-form auth-settings-form" onChange={()=>setDirty(true)} onSubmit={save}><h2>{t("management.connectProject")}</h2>{loading&&<p role="status" className="help">{t("management.configLoading")}</p>}<label>{t("management.projectUrl")}<input disabled={loading||busy} type="url" required value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://dein-projekt.supabase.co" autoComplete="off"/></label><label>{t("management.publishableKey")}<textarea disabled={loading||busy} required rows={3} value={key} onChange={e=>setKey(e.target.value)} placeholder="sb_publishable_…" autoComplete="off"/></label><p className="help">{t("management.publicKeyHelp")}</p><label className="consent"><Checkbox disabled={loading||busy} checked={mail} onCheckedChange={v=>{setMail(v===true);setDirty(true);}} aria-label={t("management.confirmDelivery")}/><span>{t("management.deliveryTested")}</span></label><label className="activation-switch"><Switch disabled={loading||busy} checked={enabled} onCheckedChange={value=>{setEnabled(value);setDirty(true);}} aria-label={t("management.activateCustomerLogin")}/><span>{t("management.activateCustomerLogin")}</span></label>{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="admin-feedback" role="status">{message}</p>}<button type="submit" className="primary" disabled={loading||busy}>{busy?<><LoaderCircle className="spin" size={17}/>{t("management.checkingConnection")}</>:enabled?t("management.checkActivate"):t("management.saveConnectionDraft")}</button><div className="auth-preview-links"><LocaleAnchor href="/anmelden">{t("management.previewLogin")}</LocaleAnchor><LocaleAnchor href="/registrieren">{t("management.previewRegistration")}</LocaleAnchor><LocaleAnchor href="/passwort-vergessen">{t("management.previewRecovery")}</LocaleAnchor></div></form></div></main></>;
}
