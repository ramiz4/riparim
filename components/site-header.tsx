"use client";
import {LocaleAnchor} from "@/components/locale-anchor";
import {LanguageSwitcher} from "./language-switcher";
import {useI18n} from "@/lib/i18n/client";
import {valueLabel} from "@/lib/i18n/values";
import {localizeHref} from "@/lib/i18n/locale";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";
import {useState} from "react";
import {ChevronDown,UserRound,LayoutDashboard,LogOut,LoaderCircle,Settings,Building2,LogIn} from "lucide-react";
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuLabel,DropdownMenuItem,DropdownMenuSeparator} from "@/components/ui/dropdown-menu";
import {Brand} from "./brand";
import {ThemeToggle} from "./theme-toggle";
import type {AccountIdentity} from "./account-storage-notice";

type Props={account:AccountIdentity|null;isAdmin?:boolean;onVisits?:()=>void};
export function SiteHeader({account,isAdmin=false,onVisits}:Props){
 const {locale,t}=useI18n();
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 useNavigationGuard({busy});
 const name=account?.displayName.trim()||account?.email||"";
 const initials=name.includes("@")?name.slice(0,2):name.split(/\s+/).map(part=>part[0]).slice(0,2).join("");
 async function logout(){setBusy(true);setError("");try{const r=await fetch("/api/auth/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({locale})});if(!r.ok)throw Error(t("common.logoutFailed"));window.location.assign(localizeHref("/anmelden",locale));}catch{setBusy(false);setError(t("common.logoutFailed"));}}
 // Menu destinations must remain reachable if a client-side transition stalls.
 return <div className="navbar"><header className="header wrap"><Brand/><div className="header-right"><LanguageSwitcher verifiedAccount={!!account&&["E-Mail","Google"].includes(account.provider??"")}/><ThemeToggle/>{account?<DropdownMenu><DropdownMenuTrigger className="user-menu-trigger" aria-label={t("common.userMenu")}><span className="user-avatar">{initials.toUpperCase()}</span><span className="user-menu-name">{name.includes("@")?t("common.myAccount"):name.split(" ")[0]}</span><ChevronDown size={16}/></DropdownMenuTrigger><DropdownMenuContent className="user-menu" align="end" sideOffset={10}><DropdownMenuLabel className="user-menu-identity"><strong>{name}</strong><span>{account.email}</span><small>{isAdmin?t("common.admin"):`${t("common.signedIn")}${account.provider?` · ${valueLabel(locale,"provider",account.provider)}`:""}`}</small></DropdownMenuLabel><DropdownMenuSeparator/>{onVisits?<DropdownMenuItem onSelect={onVisits}><UserRound/>{t("common.myReviews")}</DropdownMenuItem>:<DropdownMenuItem asChild><LocaleAnchor href="/?besuche=1"><UserRound/>{t("common.myReviews")}</LocaleAnchor></DropdownMenuItem>}<DropdownMenuItem asChild><LocaleAnchor href="/einstellungen"><Settings/>{t("common.settings")}</LocaleAnchor></DropdownMenuItem><DropdownMenuItem asChild><LocaleAnchor href="/betrieb"><Building2/>{t("common.myBusiness")}</LocaleAnchor></DropdownMenuItem>{isAdmin&&<><DropdownMenuSeparator/><DropdownMenuItem asChild><LocaleAnchor href="/verwaltung"><LayoutDashboard/>{t("common.manage")}</LocaleAnchor></DropdownMenuItem></>}<DropdownMenuSeparator/>{account.provider!=="ChatGPT"?<DropdownMenuItem disabled={busy} onSelect={e=>{e.preventDefault();void logout();}}>{busy?<LoaderCircle className="spin"/>:<LogOut/>}{busy?t("common.loggingOut"):t("common.logout")}</DropdownMenuItem>:<DropdownMenuItem asChild><LocaleAnchor href={`/signout-with-chatgpt?return_to=${encodeURIComponent(localizeHref("/anmelden",locale))}`} target="_top"><LogOut/>{t("common.logout")}</LocaleAnchor></DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>:<><div className="header-auth"><LocaleAnchor href="/anmelden">{t("common.login")}</LocaleAnchor><LocaleAnchor className="primary small" href="/registrieren">{t("common.register")}</LocaleAnchor></div><LocaleAnchor className="header-login-mobile" href="/anmelden"><LogIn size={18} aria-hidden="true"/><span>{t("common.login")}</span></LocaleAnchor></>}</div></header>{error&&<p className="header-error wrap" role="alert">{error}</p>}</div>;
}
