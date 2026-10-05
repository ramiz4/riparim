"use client";
import {useI18n} from "@/lib/i18n/client";
import {responseError,LocalizedError,type CodedResponse} from "@/lib/i18n/codes";
import {valueLabel} from "@/lib/i18n/values";
import {formatDate} from "@/lib/i18n/format";
import {useNavigationGuard} from "@/lib/i18n/navigation-guard";

import Link from "@/components/locale-link";
import {useCallback,useEffect,useId,useRef,useState,type FormEvent} from "react";
import {ChevronLeft,ChevronRight,LoaderCircle,Plus,Pencil,Search,ShieldCheck,ShieldMinus,ShieldPlus,Trash2,UserRound,UserRoundX,UserRoundCheck,UsersRound} from "lucide-react";
import {SiteHeader} from "@/components/site-header";
import {AdminNavigation} from "@/components/admin-navigation";
import type {AccountIdentity} from "@/components/account-storage-notice";
import type {ManagedUser} from "@/lib/user-contract";
import {ModalBody,ModalContent} from "@/components/modal-shell";
import {Dialog,DialogClose} from "@/components/ui/dialog";
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from "@/components/ui/alert-dialog";
import {Switch} from "@/components/ui/switch";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";

type UserPage={users:ManagedUser[];pendingDeletions?:ManagedUser[];page:number;perPage:number;hasMore:boolean;configured:boolean;error?:string};
type Draft={name:string;email:string;password:string;active:boolean};
const perPage=20;
const providerLabels:Record<string,string>={email:"E-Mail",google:"Google",chatgpt:"ChatGPT",apple:"Apple",github:"GitHub"};

function failureMessage(error:unknown,fallback:string){return error instanceof LocalizedError?error.message:fallback;}

export default function AdminUsers({account}:{account:AccountIdentity}){
 const {locale,t}=useI18n();
 function displayDate(value:string|null){return value?formatDate(locale,value):t("management.never");}
 const formId=useId();
 const [pendingDeletions,setPendingDeletions]=useState<ManagedUser[]>([]);
 const [users,setUsers]=useState<ManagedUser[]>([]),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(false),[configured,setConfigured]=useState<boolean|null>(null);
 const [loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false),[error,setError]=useState(""),[feedback,setFeedback]=useState(""),[query,setQuery]=useState("");
 const [editor,setEditor]=useState(false),[editing,setEditing]=useState<ManagedUser|null>(null),[draft,setDraft]=useState<Draft|null>(null),[saving,setSaving]=useState(false),[formError,setFormError]=useState("");
 const [mutating,setMutating]=useState<string|null>(null),[deleteUser,setDeleteUser]=useState<ManagedUser|null>(null),[deleteError,setDeleteError]=useState("");
 const [roleUser,setRoleUser]=useState<ManagedUser|null>(null);
 const controller=useRef<AbortController|null>(null),requestGeneration=useRef(0);
 const cancelLoad=useCallback(()=>{controller.current?.abort();requestGeneration.current++;},[]);
 const [dirty,setDirty]=useState(false);useNavigationGuard({busy:saving||!!mutating,dirty:editor&&dirty});
 const load=useCallback(async(targetPage:number)=>{
  const generation=++requestGeneration.current;
  controller.current?.abort();
  const request=new AbortController();controller.current=request;setLoading(true);setError("");
  try{
   const response=await fetch(`/api/users?page=${targetPage}&perPage=${perPage}`,{signal:request.signal});
   const data=await response.json() as UserPage&CodedResponse;
   if(generation!==requestGeneration.current)return;
   if(!response.ok){
    if(response.status===401||response.status===403){setUsers([]);setPendingDeletions([]);setLoaded(false);setConfigured(null);setHasMore(false);}
    throw responseError(t,data);
   }
   setPendingDeletions(data.pendingDeletions??[]);setUsers(data.users);setPage(data.page);setHasMore(data.hasMore);setConfigured(data.configured);setLoaded(true);
  }catch(loadError){
   if(generation===requestGeneration.current&&!request.signal.aborted)setError(failureMessage(loadError,t("management.usersLoadFailed")));
  }finally{if(generation===requestGeneration.current)setLoading(false);}
 },[t]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Mounting this authorized management page starts its remote user list load.
 useEffect(()=>{void load(1);return cancelLoad;},[load,cancelLoad]);

 function openEditor(user?:ManagedUser){setDirty(false);
  setEditing(user??null);setDraft({name:user?.name??"",email:user?.email??"",password:"",active:user?.active??true});setFormError("");setEditor(true);
 }
 function change<K extends keyof Draft>(key:K,value:Draft[K]){setDirty(true);setDraft(old=>old?{...old,[key]:value}:old);setFormError("");}
 async function save(event:FormEvent){
  event.preventDefault();
  if(!draft||saving)return;
  if(draft.name.trim().length<2){setFormError(t("management.nameMinimum"));return;}
  if((!editing||draft.password.length>0)&&(draft.password.length<12||draft.password.length>128)){setFormError(t("management.passwordLength"));return;}
  setSaving(true);setFormError("");setFeedback("");
  try{
   const payload=editing?{name:draft.name.trim(),...(!editing.protected?{email:draft.email.trim()}:{}),...(draft.password?{password:draft.password}:{})}:{name:draft.name.trim(),email:draft.email.trim(),password:draft.password,active:draft.active};
   const response=await fetch(editing?`/api/users/${encodeURIComponent(editing.id)}`:"/api/users",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const data=await response.json() as CodedResponse&{user?:ManagedUser;error?:string};
   if(!response.ok)throw responseError(t,data);
   setEditor(false);setDraft(null);setFeedback(editing?t("management.userUpdated"):t("management.userCreated"));
   if(!editing)setQuery("");
   await load(editing?page:1);
  }catch(saveError){setFormError(failureMessage(saveError,t("management.userSaveFailed")));}
  finally{setSaving(false);}
 }
 async function setActive(user:ManagedUser){
  if(user.protected||loading||saving||mutating)return;
  setMutating(user.id);setError("");setFeedback("");
  try{
   const response=await fetch(`/api/users/${encodeURIComponent(user.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:!user.active})});
   const data=await response.json() as CodedResponse&{user:ManagedUser;error?:string};
   if(!response.ok)throw responseError(t,data);
   setUsers(old=>old.map(item=>item.id===user.id?data.user:item));setFeedback(user.active?t("management.userDisabled"):t("management.userEnabled"));
  }catch(statusError){const message=failureMessage(statusError,t("management.userStatusFailed"));await load(page);setError(message);}
  finally{setMutating(null);}
 }
 async function remove(){
  if(!deleteUser||deleteUser.protected||mutating)return;
  setMutating(deleteUser.id);setDeleteError("");setFeedback("");
  try{
   const response=await fetch(`/api/users/${encodeURIComponent(deleteUser.id)}`,{method:"DELETE"});
   const data=await response.json() as CodedResponse&{ok?:boolean;error?:string};
   if(!response.ok)throw responseError(t,data);
   setDeleteUser(null);setFeedback(t("management.userDeleted"));
   await load(users.length===1&&page>1?page-1:page);
  }catch(removeError){setDeleteError(failureMessage(removeError,t("management.userDeleteFailed")));await load(page);}
  finally{setMutating(null);}
 }
 async function changeRole(){
  if(!roleUser||roleUser.protected||loading||saving||mutating)return;
  const role=roleUser.role==="admin"?"user":"admin";
  setMutating(roleUser.id);setError("");setFeedback("");
  try{
   const response=await fetch(`/api/users/${encodeURIComponent(roleUser.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({role})});
   const data=await response.json() as CodedResponse&{user:ManagedUser;roleChanged?:boolean;error?:string};
   if(!response.ok)throw responseError(t,data);
   setUsers(old=>old.map(user=>user.id===roleUser.id?data.user:user));setRoleUser(null);
   setFeedback(data.roleChanged===false?t("management.roleAlready"):t(data.user.role==="admin"?"management.roleGranted":"management.roleRevoked"));
  }catch(roleError){
   const message=failureMessage(roleError,t("management.userRoleFailed"));
   // A failed response can follow a completed server write. Reload before offering another role change.
   setRoleUser(null);setUsers([]);await load(page);setError(message);
  }finally{setMutating(null);}
 }
 const busy=loading||saving||!!mutating;
 const shown=users.filter(user=>`${user.name} ${user.email}`.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)));

 return <><SiteHeader account={account} isAdmin/><AdminNavigation active="users"/>
  <main className="admin-main admin-users-page wrap">
   <div className="admin-title"><div><h1>{t("management.manageUsers")}</h1></div><button className="primary" disabled={busy||configured!==true} onClick={()=>openEditor()}><Plus size={17} aria-hidden="true"/>{t("management.createUser")}</button></div>
   <div className="users-toolbar"><label className="users-search"><Search size={16} aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("management.userSearchExample")} aria-label={t("management.userSearch")} disabled={configured!==true}/></label></div>
   {feedback&&<p className="admin-feedback" role="status">{feedback}</p>}
   {error&&<p className="error users-error" role="alert">{error}</p>}
   {pendingDeletions.length>0&&<section className="users-setup-note" aria-labelledby="pending-deletions-title"><div><h2 id="pending-deletions-title">{t("management.unfinishedDeletions")}</h2><p>{t("management.unfinishedDeletionHelp")}</p>{pendingDeletions.map(user=><p key={user.id}><span>{user.id}</span> <button className="outline small" disabled={busy||user.protected} aria-label={t("management.finishDeletionLabel",{id:user.id})} onClick={()=>{setDeleteUser({...user,name:t("management.startedDeletion",{id:user.id})});setDeleteError("");}}>{t("management.finishDeletion")}</button></p>)}</div></section>}
   {configured===false&&<section className="users-setup-note" aria-labelledby="users-setup-title"><ShieldCheck size={24} aria-hidden="true"/><div><h2 id="users-setup-title">{t("management.serverMissing")}</h2><p>{t("management.usersSetupHelp")}</p><Link className="text-action" href="/verwaltung/anmeldung">{t("management.openLoginSettings")}</Link></div></section>}
   {loading&&!loaded&&<div className="review-loading" role="status"><LoaderCircle size={20} className="spin" aria-hidden="true"/>{t("management.usersLoading")}</div>}
   {configured===true&&<>
    {loading&&loaded&&<p className="help users-refresh-status" role="status"><LoaderCircle size={16} className="spin" aria-hidden="true"/>{t("management.usersLoading")}</p>}
    <div className="directory-table users-table" aria-busy={loading}><Table aria-label={t("management.userAccounts")}><TableHeader><TableRow><TableHead>{t("management.users")}</TableHead><TableHead>{t("management.role")}</TableHead><TableHead>{t("management.status")}</TableHead><TableHead>{t("management.loginMethod")}</TableHead><TableHead>{t("management.created")}</TableHead><TableHead>{t("management.lastLogin")}</TableHead><TableHead><span className="sr-only">{t("management.actions")}</span></TableHead></TableRow></TableHeader><TableBody>{shown.map(user=><TableRow key={user.id}>
     <TableCell><strong>{user.name||t("management.unnamed")}</strong><span className="users-email">{user.email}</span>{user.protected&&<span className="users-protected"><ShieldCheck size={12} aria-hidden="true"/>{t("management.protectedAccess")}</span>}</TableCell>
     <TableCell><span className={`users-role ${user.role}`}>{user.role==="admin"?<><ShieldCheck size={13} aria-hidden="true"/>{t("management.adminRole")}</>:t("management.userRole")}</span></TableCell>
     <TableCell><span className={`users-status ${user.active?"active":"inactive"}`}>{user.active?t("management.active"):t("management.inactive")}</span></TableCell>
     <TableCell><span className="users-providers">{user.providers.length?user.providers.map(provider=>valueLabel(locale,"provider",providerLabels[provider]??provider)).join(", "):"–"}</span><span className="users-confirmation">{user.confirmed?t("management.emailConfirmed"):t("management.emailUnconfirmed")}</span></TableCell>
     <TableCell>{user.createdAt?displayDate(user.createdAt):"–"}</TableCell><TableCell>{displayDate(user.lastSignInAt)}</TableCell>
     <TableCell><div className="users-actions"><button className="text-action" disabled={busy} aria-label={t("management.editUserLabel",{name:user.name||user.email})} onClick={()=>openEditor(user)}><Pencil size={15} aria-hidden="true"/>{t("management.edit")}</button><button className="text-action" disabled={busy||user.protected} title={user.protected?t("management.preserveAdmin"):undefined} aria-label={user.role==="admin"?t("management.revokeRoleLabel",{name:user.name||user.email}):t("management.grantRoleLabel",{name:user.name||user.email})} onClick={()=>setRoleUser(user)}>{user.role==="admin"?<ShieldMinus size={15} aria-hidden="true"/>:<ShieldPlus size={15} aria-hidden="true"/>}{user.role==="admin"?t("management.revokeAdmin"):t("management.makeAdmin")}</button><button className="text-action" disabled={busy||user.protected} title={user.protected?t("management.protectedStaysActive"):undefined} aria-label={t(user.active?"management.disableUserLabel":"management.enableUserLabel",{name:user.name||user.email})} onClick={()=>void setActive(user)}>{mutating===user.id&&!deleteUser&&!roleUser?<LoaderCircle size={15} className="spin" aria-hidden="true"/>:user.active?<UserRoundX size={15} aria-hidden="true"/>:<UserRoundCheck size={15} aria-hidden="true"/>}{user.active?t("management.disable"):t("management.enable")}</button><button className="users-delete" disabled={busy||user.protected} title={user.protected?t("management.protectedNotDeleted"):undefined} aria-label={t("management.deleteUserLabel",{name:user.name||user.email})} onClick={()=>{setDeleteError("");setDeleteUser(user);}}><Trash2 size={15} aria-hidden="true"/>{t("management.delete")}</button></div></TableCell>
    </TableRow>)}</TableBody></Table></div>
    {!loading&&!error&&!shown.length&&<div className="empty users-empty"><UsersRound size={28} aria-hidden="true"/><h2>{query.trim()?t("management.noMatchingUsers"):t("management.noUsers")}</h2><p>{query.trim()?t("management.userSearchHelp"):t("management.createUserHelp")}</p>{!query.trim()&&<button className="outline" disabled={busy} onClick={()=>openEditor()}>{t("management.createUser")}</button>}</div>}
    <nav className="users-pagination" aria-label={t("management.userPages")}><button className="outline small" disabled={busy||page===1} onClick={()=>{setQuery("");void load(page-1);}}><ChevronLeft size={16} aria-hidden="true"/>{t("management.back")}</button><span>{t("management.userPageSummary",{page,count:users.length})}{query.trim()?t("management.userMatches",{count:shown.length}):""}</span><button className="outline small" disabled={busy||!hasMore} onClick={()=>{setQuery("");void load(page+1);}}>{t("management.next")}<ChevronRight size={16} aria-hidden="true"/></button></nav>

   </>}
  </main>
  <Dialog open={editor} onOpenChange={open=>{if(!saving){setEditor(open);if(!open)setDraft(null);}}}><ModalContent className="user-editor" closeDisabled={saving} title={editing?t("management.editUser"):t("management.createUser")} description={editing?t("management.editUserHelp"):t("management.newUserHelp")} footer={<><DialogClose asChild><button className="outline" disabled={saving}>{t("management.cancel")}</button></DialogClose><button className="primary" disabled={saving||!draft} type="submit" form={formId}>{saving?<><LoaderCircle size={16} className="spin" aria-hidden="true"/>{t("management.saving")}</>:editing?t("management.saveChanges"):t("management.createUser")}</button></>}>
   {draft&&<form id={formId} className="journey-form users-form" onSubmit={save}><fieldset disabled={saving}><label>{t("management.name")}<input required minLength={2} maxLength={80} autoComplete="name" value={draft.name} onChange={event=>change("name",event.target.value)}/></label><label>{t("management.emailAddress")}<input required type="email" maxLength={254} autoComplete="email" disabled={editing?.protected} value={draft.email} onChange={event=>change("email",event.target.value)}/></label>{editing?.protected&&<p className="help">{t("management.protectedEmail")}</p>}<label>{editing?t("management.newPassword"):t("management.password")}{editing&&<span> {t("management.optional")}</span>}<input type="password" required={!editing} minLength={12} maxLength={128} autoComplete="new-password" value={draft.password} onChange={event=>change("password",event.target.value)} aria-describedby={`${formId}-password-help`}/></label><p className="help" id={`${formId}-password-help`}>{editing?t("management.passwordKeepHelp"):t("management.passwordHelp")}</p>{!editing&&<><label className="activation-switch users-activation"><Switch checked={draft.active} onCheckedChange={active=>change("active",active)} aria-label={t("management.activateNewUser")}/><span><strong>{t("management.activateAccount")}</strong><span>{t("management.disabledLogin")}</span></span></label><p className="help">{t("management.createdUserRights")}</p></>}{editing?.protected&&<div className="note"><UserRound size={18} aria-hidden="true"/><p>{t("management.protectedUser")}</p></div>}</fieldset>{formError&&<p className="error" role="alert">{formError}</p>}</form>}
  </ModalContent></Dialog>
  <AlertDialog open={!!roleUser} onOpenChange={open=>{if(!open&&!mutating)setRoleUser(null);}}><AlertDialogContent className={`app-dialog confirmation-dialog user-role-dialog ${roleUser?.role==="admin"?"role-revoke":"role-grant"}`}><AlertDialogHeader><AlertDialogTitle>{roleUser?.role==="admin"?t("management.revokeAdminTitle"):t("management.grantAdminTitle")}</AlertDialogTitle></AlertDialogHeader><ModalBody><AlertDialogDescription>{t(roleUser?.role==="admin"?"management.roleRevokeHelp":"management.roleGrantHelp",{name:roleUser?.name||roleUser?.email||""})}</AlertDialogDescription>{roleUser?.name&&<p className="help">{roleUser.email}</p>}<p className="help">{t("management.roleSessionsHelp")}</p></ModalBody><AlertDialogFooter><AlertDialogCancel disabled={!!mutating}>{t("management.cancel")}</AlertDialogCancel><AlertDialogAction disabled={!!mutating} onClick={event=>{event.preventDefault();void changeRole();}}>{mutating?<><LoaderCircle size={16} className="spin" aria-hidden="true"/>{t("management.changingRole")}</>:roleUser?.role==="admin"?t("management.revokeAdmin"):t("management.makeAdmin")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  <AlertDialog open={!!deleteUser} onOpenChange={open=>{if(!open&&!mutating)setDeleteUser(null);}}><AlertDialogContent className="app-dialog confirmation-dialog user-delete-dialog"><AlertDialogHeader><AlertDialogTitle>{t("management.deleteUserTitle")}</AlertDialogTitle></AlertDialogHeader><ModalBody><AlertDialogDescription>{t("management.deleteUserHelp",{name:deleteUser?.name||deleteUser?.email||""})}</AlertDialogDescription>{deleteUser?.name&&<p className="help">{deleteUser.email}</p>}{deleteError&&<p className="error" role="alert">{deleteError}</p>}</ModalBody><AlertDialogFooter><AlertDialogCancel disabled={!!mutating}>{t("management.cancel")}</AlertDialogCancel><AlertDialogAction disabled={!!mutating} onClick={event=>{event.preventDefault();void remove();}}>{mutating?<><LoaderCircle size={16} className="spin" aria-hidden="true"/>{t("management.deleting")}</>:t("management.deleteUser")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
