import {defaultLocale,isLocale,type Locale} from "./locale";

// Keys are existing stored/form values. Only the labels are translated.
const de={
 service:{"Alle Leistungen":"Alle Leistungen","Inspektion & Wartung":"Inspektion & Wartung","Diagnose & Elektronik":"Diagnose & Elektronik","Bremsen & Fahrwerk":"Bremsen & Fahrwerk","Motor & Getriebe":"Motor & Getriebe","Karosserie & Lack":"Karosserie & Lack","Reifen & Klima":"Reifen & Klima"},
 sentinel:{"Alle Leistungen":"Alle Leistungen","Ganz Kosovo":"Ganz Kosovo","Alle Marken":"Alle Marken","Alle Sprachen":"Alle Sprachen","Kein weiterer Ort":"Kein weiterer Ort","Nur im Ort":"Nur im Ort"},
 evidence:{"Rechnung":"Rechnung","Service- oder Arbeitsbeleg":"Service- oder Arbeitsbeleg","Anderer Nachweis":"Anderer Nachweis"},
 status:{pending:"In Prüfung",approved:"Bewertung vervollständigen",needs_more:"Ergänzung nötig",published:"Veröffentlicht",deleting:"Löschung ausstehend",draft:"Entwurf",rejected:"Abgelehnt",revoked:"Widerrufen"},
 language:{Albanisch:"Albanisch",Deutsch:"Deutsch",Englisch:"Englisch"},
 provider:{Google:"Google",google:"Google",ChatGPT:"ChatGPT","E-Mail":"E-Mail",password:"E-Mail",email:"E-Mail"}
} as const;
export type ValueCategory=keyof typeof de;
type ValueCatalog={[C in ValueCategory]:{[V in keyof typeof de[C]]:string}};
const sq={
 service:{"Alle Leistungen":"Të gjitha shërbimet","Inspektion & Wartung":"Kontroll & mirëmbajtje","Diagnose & Elektronik":"Diagnostikë & elektronikë","Bremsen & Fahrwerk":"Frena & shasi","Motor & Getriebe":"Motor & transmision","Karosserie & Lack":"Karroceri & ngjyrosje","Reifen & Klima":"Goma & klimatizim"},
 sentinel:{"Alle Leistungen":"Të gjitha shërbimet","Ganz Kosovo":"E gjithë Kosova","Alle Marken":"Të gjitha markat","Alle Sprachen":"Të gjitha gjuhët","Kein weiterer Ort":"Pa vend tjetër","Nur im Ort":"Vetëm në vend"},
 evidence:{"Rechnung":"Faturë","Service- oder Arbeitsbeleg":"Dëshmi shërbimi ose pune","Anderer Nachweis":"Dëshmi tjetër"},
 status:{pending:"Në shqyrtim",approved:"Plotëso vlerësimin",needs_more:"Nevojitet plotësim",published:"Publikuar",deleting:"Fshirja në pritje",draft:"Draft",rejected:"Refuzuar",revoked:"Revokuar"},
 language:{Albanisch:"Shqip",Deutsch:"Gjermanisht",Englisch:"Anglisht"},
 provider:{Google:"Google",google:"Google",ChatGPT:"ChatGPT","E-Mail":"Email",password:"Email",email:"Email"}
} as const satisfies ValueCatalog;
const en={
 service:{"Alle Leistungen":"All services","Inspektion & Wartung":"Inspection & maintenance","Diagnose & Elektronik":"Diagnostics & electronics","Bremsen & Fahrwerk":"Brakes & suspension","Motor & Getriebe":"Engine & transmission","Karosserie & Lack":"Bodywork & paint","Reifen & Klima":"Tyres & air conditioning"},
 sentinel:{"Alle Leistungen":"All services","Ganz Kosovo":"All of Kosovo","Alle Marken":"All brands","Alle Sprachen":"All languages","Kein weiterer Ort":"No additional location","Nur im Ort":"Only in this location"},
 evidence:{"Rechnung":"Invoice","Service- oder Arbeitsbeleg":"Service or work receipt","Anderer Nachweis":"Other evidence"},
 status:{pending:"Under review",approved:"Complete your review",needs_more:"More information needed",published:"Published",deleting:"Deletion pending",draft:"Draft",rejected:"Rejected",revoked:"Revoked"},
 language:{Albanisch:"Albanian",Deutsch:"German",Englisch:"English"},
 provider:{Google:"Google",google:"Google",ChatGPT:"ChatGPT","E-Mail":"Email",password:"Email",email:"Email"}
} as const satisfies ValueCatalog;

export const canonicalValues={
 service:Object.keys(de.service),sentinel:Object.keys(de.sentinel),evidence:Object.keys(de.evidence),
 status:Object.keys(de.status),language:Object.keys(de.language),provider:Object.keys(de.provider)
};
export function valueLabel(locale:Locale,category:ValueCategory,value:string):string{
 const catalog:ValueCatalog={de,sq,en}[isLocale(locale)?locale:defaultLocale];
 if(!Object.hasOwn(catalog,category))return value;
 const labels=catalog[category] as Record<string,string>|undefined;
 return labels&&Object.hasOwn(labels,value)?labels[value]:value;
}
export function displayLabels(locale:Locale,category:ValueCategory,values:readonly string[]):Record<string,string>{
 return Object.fromEntries(values.map(value=>[value,valueLabel(locale,category,value)]));
}
