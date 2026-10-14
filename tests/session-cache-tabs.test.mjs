import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const out='.test-runtime/session-cache-tabs';await mkdir(out,{recursive:true});
await build({entryPoints:['components/use-public-session.ts'],outfile:out+'/session.mjs',bundle:true,format:'esm',platform:'node',packages:'external'});
const member={account:{email:'fixture@example.test',displayName:'Fixture Member',provider:'E-Mail'},isAdmin:false},guest={account:null,isAdmin:false};
const channels=new Set(),messages=[],tabs=[];let current,backend=member,now=1000;
const originalNow=Date.now;Date.now=()=>now;
function inTab(tab,action){current=tab;globalThis.window=tab.dom.window;globalThis.document=tab.dom.window.document;return action();}
class Channel{
 constructor(name){this.name=name;this.owner=current;channels.add(this);}
 postMessage(signal){messages.push(signal);for(const other of channels)if(other!==this&&other.name===this.name)queueMicrotask(()=>inTab(other.owner,()=>other.onmessage?.({data:structuredClone(signal)})));}
 close(){channels.delete(this);}
}
globalThis.fetch=input=>{assert.equal(input,'/api/session');const tab=current;tab.requests++;if(tab.delay){tab.delay=false;return new Promise(resolve=>tab.finish=resolve);}return Promise.resolve(Response.json(backend));};
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
async function openTab(name,{broadcast=true}={}){
 const tab={name,requests:0,observed:null,dom:new JSDOM('',{url:'https://riparim.example.test/'} )};tabs.push(tab);
 if(broadcast)tab.dom.window.BroadcastChannel=Channel;
 tab.api=await import(new URL('../'+out+'/session.mjs?'+name,import.meta.url));
 inTab(tab,()=>{tab.unsubscribe=tab.api.subscribePublicSession(change=>{tab.observed=tab.api.applyPublicSessionChange(tab.observed,change);void tab.api.loadPublicSession().then(session=>tab.observed=session);});});
 tab.observed=await inTab(tab,()=>tab.api.loadPublicSession());await settle();return tab;
}
try{
 const a=await openTab('a'),b=await openTab('b');const before=[a.requests,b.requests];
 now+=299999;
 assert.deepEqual(await inTab(a,()=>a.api.loadPublicSession()),member);
 assert.deepEqual(await inTab(b,()=>b.api.loadPublicSession()),member);
 assert.deepEqual([a.requests,b.requests],before,'Both tabs retain their own five-minute cache');
 now+=2;await inTab(a,()=>a.api.loadPublicSession());assert.equal(a.requests,before[0]+1,'Five-minute expiry fetches an authoritative session');
 backend=guest;inTab(a,()=>a.api.invalidatePublicSession({signedOut:true}));
 assert.deepEqual(a.observed,guest,'Logout clears the originating tab synchronously');await settle();
 assert.deepEqual(b.observed,guest,'An already-open background tab observes logout without focus or routing');
 const afterLogout=[a.requests,b.requests];await inTab(b,()=>b.api.loadPublicSession());assert.deepEqual([a.requests,b.requests],afterLogout,'Signed-out state is cached too');
 backend=member;inTab(a,()=>a.api.invalidatePublicSession({signedIn:true}));
 assert.equal(a.observed,null,'Login discards the old guest before its fresh response');await settle();
 assert.deepEqual(a.observed,member);assert.deepEqual(b.observed,member,'An already-open tab observes login immediately');
 // A redirect-based login opens a new document without invoking the password form.
 backend=guest;inTab(a,()=>a.api.invalidatePublicSession({signedOut:true}));await settle();backend=member;
 const oauth=await openTab('oauth');await settle();assert.deepEqual(b.observed,member,'The first verified session after an OAuth/mail redirect invalidates other tabs');
 const messageCount=messages.length;await settle();assert.equal(messages.length,messageCount,'Received signals do not echo and cause a request loop');
 assert(messages.every(message=>['refresh','signed-in','signed-out'].includes(message)),'No identity or token crosses tabs');
 const malformedCount=b.requests;inTab(b,()=>{const channel=[...channels].find(channel=>channel.owner===b);channel.onmessage({data:{account:member.account,isAdmin:true}});});assert.equal(b.requests,malformedCount,'Malformed messages cannot install an identity or role');
 now+=300001;a.delay=true;const old=inTab(a,()=>a.api.loadPublicSession());backend=guest;inTab(b,()=>b.api.invalidatePublicSession({signedOut:true}));await settle();
 inTab(a,()=>a.finish(Response.json(member)));await old;await settle();assert.deepEqual(await inTab(a,()=>a.api.loadPublicSession()),guest,'A late pre-logout response cannot repopulate the cache');
 // Storage-only fallback transmits a nonce and signal, never an account.
 const fallback=await openTab('fallback',{broadcast:false});backend=member;
 inTab(fallback,()=>fallback.dom.window.dispatchEvent(new fallback.dom.window.StorageEvent('storage',{key:'riparim-session-v1',newValue:JSON.stringify({signal:'signed-in',nonce:'fixture'})})));await settle();assert.deepEqual(fallback.observed,member,'Storage events invalidate when BroadcastChannel is unavailable');
 assert.equal(fallback.dom.window.localStorage.length,0,'Notifications are not retained as browser session storage');
 inTab(fallback,()=>{Object.defineProperty(fallback.dom.window,'localStorage',{get(){throw Error('blocked');}});assert.doesNotThrow(()=>fallback.api.invalidatePublicSession({signedOut:true}));});await settle();
 console.log('Five-minute session cache: two isolated tabs, immediate login/logout, OAuth document return, no echo/identity sharing, stale-response race, storage fallback and restricted storage passed');
}finally{for(const tab of tabs){inTab(tab,()=>tab.unsubscribe?.());tab.dom.window.close();}for(const channel of channels)channel.close();delete globalThis.window;delete globalThis.document;Date.now=originalNow;}
