"use client";
import {useEffect,useState} from "react";
import type {AccountIdentity} from "./account-storage-notice";
type Session={account:AccountIdentity|null;isAdmin:boolean};
let pending:Promise<Session>|undefined;
function loadSession(){return pending??=fetch("/api/session",{cache:"no-store"}).then(async response=>{
 if(!response.ok)throw Error("Session unavailable");
 const value=await response.json();
 if(!value||typeof value!=="object"||!("isAdmin" in value)||!("account" in value))throw Error("Invalid session response");
 if(typeof value.isAdmin!=="boolean"||(value.account!==null&&(!value.account||["email","displayName","provider"].some(key=>typeof (value.account as Record<string,unknown>)[key]!=="string"))))throw Error("Invalid session response");
 return value as Session;
}).catch(error=>{pending=undefined;throw error;});}
export function usePublicSession(initial:Session,publicSnapshot=false){
 const [session,setSession]=useState(initial);
 useEffect(()=>{if(!publicSnapshot)return;let active=true;void loadSession().then(value=>{if(active)setSession(value);}).catch(()=>{});return()=>{active=false;};},[publicSnapshot]);
 return publicSnapshot?session:initial;
}
