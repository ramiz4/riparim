"use client";

import Link from "next/link";
import {useCallback,useEffect,useId,useRef,useState,type FormEvent} from "react";
import {ChevronLeft,ChevronRight,LoaderCircle,Plus,RefreshCw,Search,ShieldCheck,Trash2,UserRound,UsersRound} from "lucide-react";
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
function displayDate(value:string|null){
 if(!value)return "Noch nie";
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"–":date.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"});
}
function failureMessage(error:unknown,fallback:string){return error instanceof Error&&!(error instanceof TypeError)?error.message:fallback;}

export default function AdminUsers({account}:{account:AccountIdentity}){
 const formId=useId();
 const [pendingDeletions,setPendingDeletions]=useState<ManagedUser[]>([]);
 const [users,setUsers]=useState<ManagedUser[]>([]),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(false),[configured,setConfigured]=useState<boolean|null>(null);
 const [loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false),[error,setError]=useState(""),[feedback,setFeedback]=useState(""),[query,setQuery]=useState("");
 const [editor,setEditor]=useState(false),[editing,setEditing]=useState<ManagedUser|null>(null),[draft,setDraft]=useState<Draft|null>(null),[saving,setSaving]=useState(false),[formError,setFormError]=useState("");
 const [mutating,setMutating]=useState<string|null>(null),[deleteUser,setDeleteUser]=useState<ManagedUser|null>(null),[deleteError,setDeleteError]=useState("");
 const [roleUser,setRoleUser]=useState<ManagedUser|null>(null);
 const controller=useRef<AbortController|null>(null),requestGeneration=useRef(0);
 const cancelLoad=useCallback(()=>{controller.current?.abort();requestGeneration.current++;},[]);
 const load=useCallback(async(targetPage:number)=>{
  const generation=++requestGeneration.current;
  controller.current?.abort();
  const request=new AbortController();controller.current=request;setLoading(true);setError("");
  try{
   const response=await fetch(`/api/users?page=${targetPage}&perPage=${perPage}`,{signal:request.signal});
   const data=await response.json() as UserPage;
   if(generation!==requestGeneration.current)return;
   if(!response.ok){
    if(response.status===401||response.status===403){setUsers([]);setPendingDeletions([]);setLoaded(false);setConfigured(null);setHasMore(false);}
    throw Error(data.error||"Benutzer konnten nicht geladen werden.");
   }
   setPendingDeletions(data.pendingDeletions??[]);setUsers(data.users);setPage(data.page);setHasMore(data.hasMore);setConfigured(data.configured);setLoaded(true);
  }catch(loadError){
   if(generation===requestGeneration.current&&!request.signal.aborted)setError(failureMessage(loadError,"Benutzer konnten nicht geladen werden. Bitte versuche es erneut."));
  }finally{if(generation===requestGeneration.current)setLoading(false);}
 },[]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- Mounting this authorized management page starts its remote user list load.
 useEffect(()=>{void load(1);return cancelLoad;},[load,cancelLoad]);

 function openEditor(user?:ManagedUser){
  setEditing(user??null);setDraft({name:user?.name??"",email:user?.email??"",password:"",active:user?.active??true});setFormError("");setEditor(true);
 }
 function change<K extends keyof Draft>(key:K,value:Draft[K]){setDraft(old=>old?{...old,[key]:value}:old);setFormError("");}
 async function save(event:FormEvent){
  event.preventDefault();
  if(!draft||saving)return;
  if(draft.name.trim().length<2){setFormError("Bitte gib einen Namen mit mindestens 2 Zeichen ein.");return;}
  if((!editing||draft.password.length>0)&&(draft.password.length<12||draft.password.length>128)){setFormError("Das Passwort muss 12 bis 128 Zeichen lang sein.");return;}
  setSaving(true);setFormError("");setFeedback("");
  try{
   const payload=editing?{name:draft.name.trim(),...(!editing.protected?{email:draft.email.trim()}:{}),...(draft.password?{password:draft.password}:{})}:{name:draft.name.trim(),email:draft.email.trim(),password:draft.password,active:draft.active};
   const response=await fetch(editing?`/api/users/${encodeURIComponent(editing.id)}`:"/api/users",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const data=await response.json() as {user?:ManagedUser;error?:string};
   if(!response.ok)throw Error(data.error||"Das Benutzerkonto konnte nicht gespeichert werden.");
   setEditor(false);setDraft(null);setFeedback(editing?"Benutzerkonto aktualisiert.":"Benutzerkonto angelegt.");
   if(!editing)setQuery("");
   await load(editing?page:1);
  }catch(saveError){setFormError(failureMessage(saveError,"Das Benutzerkonto konnte nicht gespeichert werden. Bitte versuche es erneut."));}
  finally{setSaving(false);}
 }
 async function setActive(user:ManagedUser){
  if(user.protected||loading||saving||mutating)return;
  setMutating(user.id);setError("");setFeedback("");
  try{
   const response=await fetch(`/api/users/${encodeURIComponent(user.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({active:!user.active})});
   const data=await response.json() as {user:ManagedUser;error?:string};
   if(!response.ok)throw Error(data.error||"Der Kontostatus konnte nicht geändert werden.");
   setUsers(old=>old.map(item=>item.id===user.id?data.user:item));setFeedback(user.active?"Benutzerkonto deaktiviert.":"Benutzerkonto aktiviert.");
  }catch(statusError){const message=failureMessage(statusError,"Der Kontostatus konnte nicht geändert werden. Bitte versuche es erneut.");await load(page);setError(message);}
  finally{setMutating(null);}
 }
 async function remove(){
  if(!deleteUser||deleteUser.protected||mutating)return;
  setMutating(deleteUser.id);setDeleteError("");setFeedback("");
  try{
   const response=await fetch(`/api/users/${encodeURIComponent(deleteUser.id)}`,{method:"DELETE"});
   const data=await response.json() as {ok?:boolean;error?:string};
   if(!response.ok)throw Error(data.error||"Das Benutzerkonto konnte nicht gelöscht werden.");
   setDeleteUser(null);setFeedback("Benutzerkonto gelöscht.");
   await load(users.length===1&&page>1?page-1:page);
  }catch(removeError){setDeleteError(failureMessage(removeError,"Das Benutzerkonto konnte nicht gelöscht werden. Bitte versuche es erneut."));await load(page);}
  finally{setMutating(null);}
 }
 async function changeRole(){
  if(!roleUser||roleUser.protected||loading||saving||mutating)return;
  const role=roleUser.role==="admin"?"user":"admin";
  setMutating(roleUser.id);setError("");setFeedback("");
  try{
   const response=await fetch(`/api/users/${encodeURIComponent(roleUser.id)}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({role})});
   const data=await response.json() as {user:ManagedUser;roleChanged?:boolean;error?:string};
   if(!response.ok)throw Error(data.error||"Die Benutzerrolle konnte nicht geändert werden.");
   setUsers(old=>old.map(user=>user.id===roleUser.id?data.user:user));setRoleUser(null);
   setFeedback(data.roleChanged===false?"Diese Rolle war bereits zugewiesen.":`${data.user.role==="admin"?"Adminrechte erteilt.":"Adminrechte entzogen."} Bestehende Sitzungen wurden beendet. Der Benutzer muss sich erneut anmelden.`);
  }catch(roleError){
   const message=failureMessage(roleError,"Die Benutzerrolle konnte nicht geändert werden. Bitte versuche es erneut.");
   // A failed response can follow a completed server write. Reload before offering another role change.
   setRoleUser(null);setUsers([]);await load(page);setError(message);
  }finally{setMutating(null);}
 }
 const busy=loading||saving||!!mutating;
 const shown=users.filter(user=>`${user.name} ${user.email}`.toLocaleLowerCase("de").includes(query.trim().toLocaleLowerCase("de")));

 return <><SiteHeader account={account} isAdmin/><AdminNavigation active="users"/>
  <main className="admin-main admin-users-page wrap">
   <div className="admin-title"><div><span className="eyebrow">VERWALTUNG</span><h1>Benutzer verwalten</h1><p>Konten anlegen, Angaben pflegen und den Zugang verwalten.</p></div><button className="primary" disabled={busy||configured!==true} onClick={()=>openEditor()}><Plus size={17} aria-hidden="true"/>Benutzer anlegen</button></div>
   <div className="users-toolbar"><label className="users-search"><Search size={16} aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name oder E-Mail auf dieser Seite suchen" aria-label="Benutzer auf dieser Seite durchsuchen" disabled={configured!==true}/></label><button className="outline small" disabled={busy} onClick={()=>void load(page)}><RefreshCw size={15} aria-hidden="true"/>Aktualisieren</button></div>
   {feedback&&<p className="admin-feedback" role="status">{feedback}</p>}
   {error&&<p className="error users-error" role="alert">{error}</p>}
   {pendingDeletions.length>0&&<section className="users-setup-note" aria-labelledby="pending-deletions-title"><div><h2 id="pending-deletions-title">Unvollständige Kontolöschungen</h2><p>Diese Konten bleiben gesperrt. Setze die Bereinigung fort, auch wenn der Anmeldedienst das Konto bereits entfernt hat.</p>{pendingDeletions.map(user=><p key={user.id}><span>{user.id}</span> <button className="outline small" disabled={busy||user.protected} aria-label={`Löschung für ${user.id} abschließen`} onClick={()=>{setDeleteUser(user);setDeleteError("");}}>Löschung abschließen</button></p>)}</div></section>}
   {configured===false&&<section className="users-setup-note" aria-labelledby="users-setup-title"><ShieldCheck size={24} aria-hidden="true"/><div><h2 id="users-setup-title">Serverkonfiguration fehlt</h2><p>Die Benutzerverwaltung benötigt eine serverseitige Verbindung zum Anmeldedienst. Prüfe die Einrichtung unter Login & Registrierung.</p><Link className="text-action" href="/verwaltung/anmeldung">Login & Registrierung öffnen</Link></div></section>}
   {loading&&!loaded&&<div className="review-loading" role="status"><LoaderCircle size={20} className="spin" aria-hidden="true"/>Benutzer werden geladen …</div>}
   {configured===true&&<>
    {loading&&loaded&&<p className="help users-refresh-status" role="status"><LoaderCircle size={16} className="spin" aria-hidden="true"/>Benutzer werden geladen …</p>}
    <div className="directory-table users-table" aria-busy={loading}><Table aria-label="Benutzerkonten"><TableHeader><TableRow><TableHead>Benutzer</TableHead><TableHead>Rolle</TableHead><TableHead>Status</TableHead><TableHead>Anmeldung</TableHead><TableHead>Erstellt</TableHead><TableHead>Zuletzt angemeldet</TableHead><TableHead><span className="sr-only">Aktionen</span></TableHead></TableRow></TableHeader><TableBody>{shown.map(user=><TableRow key={user.id}>
     <TableCell><strong>{user.name||"Ohne Namen"}</strong><span className="users-email">{user.email}</span>{user.protected&&<span className="users-protected"><ShieldCheck size={12} aria-hidden="true"/>Geschützter Zugang</span>}</TableCell>
     <TableCell><span className={`users-role ${user.role}`}>{user.role==="admin"?<><ShieldCheck size={13} aria-hidden="true"/>Admin</>:"Benutzer"}</span></TableCell>
     <TableCell><span className={`users-status ${user.active?"active":"inactive"}`}>{user.active?"Aktiv":"Deaktiviert"}</span></TableCell>
     <TableCell><span className="users-providers">{user.providers.length?user.providers.map(provider=>providerLabels[provider]??provider).join(", "):"–"}</span><span className="users-confirmation">{user.confirmed?"E-Mail bestätigt":"E-Mail nicht bestätigt"}</span></TableCell>
     <TableCell>{user.createdAt?displayDate(user.createdAt):"–"}</TableCell><TableCell>{displayDate(user.lastSignInAt)}</TableCell>
     <TableCell><div className="users-actions"><button className="text-action" disabled={busy} aria-label={`${user.name||user.email} bearbeiten`} onClick={()=>openEditor(user)}>Bearbeiten</button><button className="text-action" disabled={busy||user.protected} title={user.protected?"Die Adminrolle deines eigenen Zugangs und des geschützten Verwaltungszugangs bleibt erhalten.":undefined} aria-label={user.role==="admin"?`Adminrechte für ${user.name||user.email} entziehen`:`${user.name||user.email} zum Admin machen`} onClick={()=>setRoleUser(user)}>{user.role==="admin"?"Adminrechte entziehen":"Zum Admin machen"}</button><button className="text-action" disabled={busy||user.protected} title={user.protected?"Der geschützte Zugang bleibt aktiv.":undefined} aria-label={`${user.name||user.email} ${user.active?"deaktivieren":"aktivieren"}`} onClick={()=>void setActive(user)}>{mutating===user.id&&!deleteUser&&!roleUser?<LoaderCircle size={14} className="spin" aria-hidden="true"/>:null}{user.active?"Deaktivieren":"Aktivieren"}</button><button className="users-delete" disabled={busy||user.protected} title={user.protected?"Der geschützte Zugang kann nicht gelöscht werden.":undefined} aria-label={`${user.name||user.email} löschen`} onClick={()=>{setDeleteError("");setDeleteUser(user);}}><Trash2 size={15} aria-hidden="true"/>Löschen</button></div></TableCell>
    </TableRow>)}</TableBody></Table></div>
    {!loading&&!error&&!shown.length&&<div className="empty users-empty"><UsersRound size={28} aria-hidden="true"/><h2>{query.trim()?"Keine passenden Benutzer auf dieser Seite.":"Noch keine Benutzer auf dieser Seite."}</h2><p>{query.trim()?"Prüfe den Suchbegriff oder blättere zu einer anderen Seite.":"Lege ein Benutzerkonto an, um Zugang zu ermöglichen."}</p>{!query.trim()&&<button className="outline" disabled={busy} onClick={()=>openEditor()}>Benutzer anlegen</button>}</div>}
    <nav className="users-pagination" aria-label="Benutzerseiten"><button className="outline small" disabled={busy||page===1} onClick={()=>{setQuery("");void load(page-1);}}><ChevronLeft size={16} aria-hidden="true"/>Zurück</button><span>Seite {page} · {users.length} Benutzer{query.trim()?` · ${shown.length} Treffer`:""}</span><button className="outline small" disabled={busy||!hasMore} onClick={()=>{setQuery("");void load(page+1);}}>Weiter<ChevronRight size={16} aria-hidden="true"/></button></nav>
    <div className="note admin-note users-protection-note"><ShieldCheck size={21} aria-hidden="true"/><p>Dein eigener Zugang und der festgelegte Verwaltungszugang bleiben geschützt. Name und Passwort können bearbeitet werden; E-Mail-Adresse, aktiver Kontostatus und Adminrolle bleiben erhalten. Diese Konten können nicht gelöscht werden.</p></div>
   </>}
  </main>
  <Dialog open={editor} onOpenChange={open=>{if(!saving){setEditor(open);if(!open)setDraft(null);}}}><ModalContent className="user-editor" closeDisabled={saving} title={editing?"Benutzer bearbeiten":"Benutzer anlegen"} description={editing?"Kontodaten und bei Bedarf das Passwort aktualisieren.":"Ein neues Benutzerkonto mit E-Mail und Passwort erstellen."} footer={<><DialogClose asChild><button className="outline" disabled={saving}>Abbrechen</button></DialogClose><button className="primary" disabled={saving||!draft} type="submit" form={formId}>{saving?<><LoaderCircle size={16} className="spin" aria-hidden="true"/>Wird gespeichert …</>:editing?"Änderungen speichern":"Benutzer anlegen"}</button></>}>
   {draft&&<form id={formId} className="journey-form users-form" onSubmit={save}><fieldset disabled={saving}><label>Name<input required minLength={2} maxLength={80} autoComplete="name" value={draft.name} onChange={event=>change("name",event.target.value)}/></label><label>E-Mail-Adresse<input required type="email" maxLength={254} autoComplete="email" disabled={editing?.protected} value={draft.email} onChange={event=>change("email",event.target.value)}/></label>{editing?.protected&&<p className="help">Die E-Mail-Adresse des Verwaltungszugangs ist geschützt.</p>}<label>{editing?"Neues Passwort":"Passwort"}{editing&&<span> (optional)</span>}<input type="password" required={!editing} minLength={12} maxLength={128} autoComplete="new-password" value={draft.password} onChange={event=>change("password",event.target.value)} aria-describedby={`${formId}-password-help`}/></label><p className="help" id={`${formId}-password-help`}>{editing?"Leer lassen, um das bisherige Passwort zu behalten. Ein neues Passwort muss 12 bis 128 Zeichen lang sein.":"Verwende ein Passwort mit 12 bis 128 Zeichen."}</p>{!editing&&<><label className="activation-switch users-activation"><Switch checked={draft.active} onCheckedChange={active=>change("active",active)} aria-label="Neues Benutzerkonto aktivieren"/><span><strong>Konto aktivieren</strong><span>Deaktivierte Benutzer können sich nicht anmelden.</span></span></label><p className="help">Das Konto erhält reguläre Kundenrechte. Die E-Mail-Adresse wird direkt bestätigt; es wird keine Bestätigungs-E-Mail versendet.</p></>}{editing?.protected&&<div className="note"><UserRound size={18} aria-hidden="true"/><p>Dieser Benutzer hat den geschützten Verwaltungszugang.</p></div>}</fieldset>{formError&&<p className="error" role="alert">{formError}</p>}</form>}
  </ModalContent></Dialog>
  <AlertDialog open={!!roleUser} onOpenChange={open=>{if(!open&&!mutating)setRoleUser(null);}}><AlertDialogContent className={`app-dialog confirmation-dialog user-role-dialog ${roleUser?.role==="admin"?"role-revoke":"role-grant"}`}><AlertDialogHeader><AlertDialogTitle>{roleUser?.role==="admin"?"Adminrechte entziehen?":"Benutzer zum Admin machen?"}</AlertDialogTitle></AlertDialogHeader><ModalBody><AlertDialogDescription>{roleUser?.role==="admin"?<><strong>{roleUser?.name||roleUser?.email}</strong> erhält wieder reguläre Kundenrechte. Der Zugang zur Werkstattverwaltung, zur Prüfung von Bewertungen und privaten Nachweisen, zur Benutzerverwaltung und zur Login-Konfiguration entfällt.</>:<><strong>{roleUser?.name||roleUser?.email}</strong> erhält Adminrechte und kann Werkstätten verwalten, Bewertungen und private Nachweise prüfen, Benutzer verwalten sowie die Login-Konfiguration ändern.</>}</AlertDialogDescription>{roleUser?.name&&<p className="help">{roleUser.email}</p>}<p className="help">Bestehende Sitzungen dieses Benutzers werden beendet. Eine erneute Anmeldung ist erforderlich. Der Adminzugang setzt ein aktives Konto und eine bestätigte E-Mail-Adresse voraus.</p></ModalBody><AlertDialogFooter><AlertDialogCancel disabled={!!mutating}>Abbrechen</AlertDialogCancel><AlertDialogAction disabled={!!mutating} onClick={event=>{event.preventDefault();void changeRole();}}>{mutating?<><LoaderCircle size={16} className="spin" aria-hidden="true"/>Rolle wird geändert …</>:roleUser?.role==="admin"?"Adminrechte entziehen":"Zum Admin machen"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  <AlertDialog open={!!deleteUser} onOpenChange={open=>{if(!open&&!mutating)setDeleteUser(null);}}><AlertDialogContent className="app-dialog confirmation-dialog user-delete-dialog"><AlertDialogHeader><AlertDialogTitle>Benutzerkonto löschen?</AlertDialogTitle></AlertDialogHeader><ModalBody><AlertDialogDescription>Das Benutzerkonto von <strong>{deleteUser?.name||deleteUser?.email}</strong> sowie zugeordnete Bewertungen, Besuche und private Nachweise werden dauerhaft gelöscht. Dieser Schritt kann nicht rückgängig gemacht werden.</AlertDialogDescription>{deleteUser?.name&&<p className="help">{deleteUser.email}</p>}{deleteError&&<p className="error" role="alert">{deleteError}</p>}</ModalBody><AlertDialogFooter><AlertDialogCancel disabled={!!mutating}>Abbrechen</AlertDialogCancel><AlertDialogAction disabled={!!mutating} onClick={event=>{event.preventDefault();void remove();}}>{mutating?<><LoaderCircle size={16} className="spin" aria-hidden="true"/>Wird gelöscht …</>:"Benutzer löschen"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
