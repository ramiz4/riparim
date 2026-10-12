"use client";
import {useEffect,useState} from "react";
import type {AccountIdentity} from "./account-storage-notice";
export type PublicSession={account:AccountIdentity|null;isAdmin:boolean};
export type SessionChange={displayName?:string;signedOut?:boolean};
let pending:Promise<PublicSession>|undefined;
const listeners=new Set<(change:SessionChange)=>void>();
export function loadPublicSession(){
 if(pending)return pending;
 const request=fetch("/api/session",{cache:"no-store"}).then(async response=>{
  if(!response.ok)throw Error("Session unavailable");
  const value=await response.json();
  if(!value||typeof value!=="object"||!("isAdmin" in value)||!("account" in value))throw Error("Invalid session response");
  if(typeof value.isAdmin!=="boolean"||(value.account!==null&&(!value.account||["email","displayName","provider"].some(key=>typeof (value.account as Record<string,unknown>)[key]!=="string"))))throw Error("Invalid session response");
  return value as PublicSession;
 }).finally(()=>{if(pending===request)pending=undefined;});
 pending=request;return request;
}
export function subscribePublicSession(listener:(change:SessionChange)=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function invalidatePublicSession(change:SessionChange={}){
 // A response started before the mutation must not be shared with its reload.
 pending=undefined;for(const listener of listeners)listener(change);
}
export function applyPublicSessionChange(session:PublicSession|null,change:SessionChange):PublicSession|null{
 if(change.signedOut)return {account:null,isAdmin:false};
 return change.displayName&&session?.account?{...session,account:{...session.account,displayName:change.displayName}}:session;
}
export function usePublicSession(initial:PublicSession,publicSnapshot=false){
 const [session,setSession]=useState(initial);
 useEffect(()=>{
  if(!publicSnapshot)return;
  let active=true,sequence=0;
  const refresh=(change:SessionChange={})=>{
   const current=++sequence;setSession(previous=>applyPublicSessionChange(previous,change)??previous);
   void loadPublicSession().then(value=>{if(active&&current===sequence)setSession(value);}).catch(()=>{});
  };
  const unsubscribe=subscribePublicSession(refresh);refresh();
  return()=>{active=false;unsubscribe();};
 },[publicSnapshot]);
 return publicSnapshot?session:initial;
}
