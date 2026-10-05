"use client";
import {createContext,useContext,useEffect,useId,useMemo,useState,type ReactNode} from "react";
export type NavigationState={dirty:boolean;busy:boolean};
type Guard={state:NavigationState;set:(id:string,value:NavigationState|null)=>void};
const Context=createContext<Guard|null>(null);
export function NavigationGuardProvider({children}:{children:ReactNode}){
 const parent=useContext(Context);
 const [forms,setForms]=useState<Record<string,NavigationState>>({});
 const set=useMemo(()=>((id:string,value:NavigationState|null)=>setForms(previous=>{const next={...previous};if(value)next[id]=value;else delete next[id];return next;})),[]);
 const state={dirty:Object.values(forms).some(form=>form.dirty),busy:Object.values(forms).some(form=>form.busy)};
 return <Context.Provider value={parent??{state,set}}>{children}</Context.Provider>;
}
// Existing forms report only booleans; their private fields never enter context.
export function useNavigationGuard({dirty=false,busy=false}:Partial<NavigationState>){
 const guard=useContext(Context),id=useId(),set=guard?.set;
 useEffect(()=>{set?.(id,{dirty,busy});return()=>set?.(id,null);},[id,dirty,busy,set]);
}
export function useNavigationState(){return useContext(Context)?.state??{dirty:false,busy:false};}
