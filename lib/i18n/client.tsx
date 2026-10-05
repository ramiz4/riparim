"use client";
import {createContext,useContext,useMemo,type ReactNode} from "react";
import {NavigationGuardProvider} from "./navigation-guard";
import type {Locale} from "./locale";
import {createTranslator,defaultMessages,type MessageCatalog} from "./messages";

type I18nContextValue={locale:Locale;messages:MessageCatalog};
const Context=createContext<I18nContextValue|null>(null);
export function I18nProvider({locale,messages,children}:I18nContextValue&{children:ReactNode}){
 const value=useMemo(()=>({locale,messages}),[locale,messages]);
 return <Context.Provider value={value}><NavigationGuardProvider>{children}</NavigationGuardProvider></Context.Provider>;
}
export function useI18n(){const context=useContext(Context)??{locale:"de" as const,messages:defaultMessages};const t=useMemo(()=>createTranslator(context.messages),[context.messages]);return {...context,t};}

// Feature providers add only the active messages while retaining the navigation guard.
export function I18nMessages({messages,children}:{messages:MessageCatalog;children:ReactNode}){
 const parent=useContext(Context)??{locale:messages.locale,messages:defaultMessages};
 return <Context.Provider value={{locale:messages.locale,messages:{...parent.messages,...messages}}}>{children}</Context.Provider>;
}
