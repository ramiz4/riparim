"use client";
import {DeferredStatus} from "./deferred-status";
import {useEffect,useRef,useState} from "react";
import {usePageQuery} from "./use-page-query";
import {useI18n} from "@/lib/i18n/client";
import {localizeHref} from "@/lib/i18n/locale";
import {useDeferredSession} from "./use-deferred-session";
import {SiteHeader} from "./site-header";
import {DirectoryFooter} from "./directory-footer";
import {ThemeSettings} from "./theme-settings";
import {AccountSettings} from "./account-settings";
import {BusinessPanel} from "./business-panel";
import {BusinessClaimForm} from "./business-claim-form";
import {AdminNavigation} from "./admin-navigation";
import Link from "./locale-link";
import type {Workshop} from "@/lib/workshops";
import AdminPanel from "@/app/[locale]/verwaltung/panel";
import AdminUsers from "@/app/[locale]/verwaltung/benutzer/users";
import AdminReviews from "@/app/[locale]/verwaltung/bewertungen/reviews";
import AuthSetup from "@/app/[locale]/verwaltung/anmeldung/setup";

export type DeferredManagementKind="settings"|"business"|"claim"|"workshops"|"users"|"reviews"|"claims"|"auth";
const paths={settings:'/einstellungen',business:'/betrieb',claim:'/betrieb/beanspruchen',workshops:'/verwaltung',users:'/verwaltung/benutzer',reviews:'/verwaltung/bewertungen',claims:'/verwaltung/betriebe',auth:'/verwaltung/anmeldung'};

export function DeferredManagement({kind}:{kind:DeferredManagementKind}){
 const {locale,t}=useI18n(),query=usePageQuery(),{session,error,pending,retry}=useDeferredSession();
 const workshopId=query.getAll('werkstatt').length===1?query.get('werkstatt'):null;
 const accountKey=session?.account?JSON.stringify([session.account.provider,session.account.email]):null,directoryKey=JSON.stringify([accountKey,workshopId]);
 const [directory,setDirectory]=useState<{key:string;state:'ready'|'error';workshop:Workshop|null}|null>(null),[directoryAttempt,setDirectoryAttempt]=useState(0),[pendingDirectory,setPendingDirectory]=useState<string|null>(null);
 const claimMain=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(kind!=='claim'||!accountKey||!workshopId)return;
  let active=true;
  void fetch('/api/workshops',{cache:'no-store'}).then(async response=>{
   const value=await response.json() as {workshops?:Workshop[]};if(!response.ok||!Array.isArray(value.workshops))throw Error('Directory unavailable');
   if(active)setDirectory({key:directoryKey,state:'ready',workshop:value.workshops.find(workshop=>workshop.id===workshopId&&workshop.status==='published')??null});
  }).catch(()=>{if(active)setDirectory({key:directoryKey,state:'error',workshop:null});}).finally(()=>{if(active)setPendingDirectory(current=>current===directoryKey?null:current);});
  return()=>{active=false;};
 },[kind,accountKey,workshopId,directoryKey,directoryAttempt]);
 const currentDirectory=directory?.key===directoryKey?directory:null,directoryPending=!!workshopId&&(!currentDirectory||pendingDirectory===directoryKey),directoryReady=!workshopId||currentDirectory?.state==='ready'&&!directoryPending;
 const title={settings:t('customer.settings'),business:t('management.myBusiness'),claim:t('management.claimTitle'),workshops:t('management.workshopAdministration'),users:t('management.manageUsers'),reviews:t('management.moderateReviews'),claims:t('management.businessModeration'),auth:t('management.authSetupTitle')}[kind];
 const returnTo=localizeHref(paths[kind]+(kind==='claim'&&workshopId?'?werkstatt='+encodeURIComponent(workshopId):''),locale);
 const header=<SiteHeader account={session?.account??null} isAdmin={session?.isAdmin??false}/>;
 const footer=['settings','business','claim'].includes(kind)?<DirectoryFooter/>:null;
 if(!session)return <>{header}<main className={kind==='settings'?'settings-page wrap':'business-page wrap'}><h1>{title}</h1><DeferredStatus error={error} pending={pending} retry={retry}/></main>{footer}</>;
 if(kind==='settings')return <>{header}<main className="settings-page wrap"><h1>{title}</h1><ThemeSettings/><AccountSettings/></main>{footer}</>;
 const administrative=['workshops','users','reviews','claims','auth'].includes(kind);
 if(!session.account||administrative&&!session.isAdmin)return <>{header}<main className="access-page"><h1>{title}</h1>{session.account&&administrative?<p>{t('management.noReviewAccess')}</p>:<p><Link className="primary" href={'/anmelden?weiter='+encodeURIComponent(returnTo)}>{t('management.login')}</Link> {t('management.businessLogin')}</p>}<Link href="/">{t('management.backWorkshops')}</Link></main>{footer}</>;
 if(kind==='workshops')return <AdminPanel account={session.account}/>;
 if(kind==='users')return <AdminUsers account={session.account}/>;
 if(kind==='reviews')return <AdminReviews account={session.account}/>;
 if(kind==='auth')return <AuthSetup account={session.account}/>;
 if(kind==='claim')return <>{header}<main ref={claimMain} tabIndex={-1} className="business-page business-claim-page wrap">{!directoryReady&&<h1>{title}</h1>}<DeferredStatus error={currentDirectory?.state==='error'} pending={directoryPending} errorText={t('management.businessUnavailable')} retryText={t('management.retryBusiness')} completedFocusRef={claimMain} retry={()=>{setPendingDirectory(directoryKey);setDirectoryAttempt(value=>value+1);}}/>{directoryReady&&<BusinessClaimForm key={directoryKey} workshop={workshopId?currentDirectory?.workshop??null:null}/>}</main>{footer}</>;

 return <>{header}{kind==='claims'&&<AdminNavigation active="business"/>}<main className="business-page wrap">{kind==='claims'&&<><h1>{title}</h1><p>{t('management.businessModerationHelp')}</p></>}<BusinessPanel moderation={kind==='claims'}/></main>{footer}</>;
}
