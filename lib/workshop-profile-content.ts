import type {Workshop} from "./workshops";
import type {SearchContext} from "@/app/journeys";
import type {CatalogueFilters} from "./catalogue-filters";

// Display overlays are independent of factual/stored values and selection rules.
export type WorkshopDisplayContent={specialty:string;description:string;serviceDetails:string[];phoneNote:string;sourceTitles:string[]};
export const normalizeServiceDetail=(text:string)=>text.replace(/\s+laut öffentlichem Verzeichnis\.?/gi,"").replace(/\s*Konkreten Umfang direkt klären\.?/gi,"").trim();
export function displayServiceDetail(text:string,workshop:Pick<Workshop,"serviceDetails">,display?:WorkshopDisplayContent):string{const index=workshop.serviceDetails.findIndex(original=>normalizeServiceDetail(original)===text);return index>=0?display?.serviceDetails[index]??text:text;}
const patterns:Record<string,RegExp>={
 "Inspektion & Wartung":/wartung|inspektion|öl|filter|batterie|regelmäßig|fahrzeugkontroll/i,
 "Diagnose & Elektronik":/diagnos|elektr|kodier|programmier|software|chip/i,
 "Bremsen & Fahrwerk":/brems|fahrwerk|achs|radgeometr|vermess|lenk|stoßdämp|feder/i,
 "Motor & Getriebe":/motor|getriebe|kuppl|antrieb|automat/i,
 "Karosserie & Lack":/karos|lack|unfall|delle|blech|polier|detailing/i,
 "Reifen & Klima":/reifen|klima|auswucht|wucht|montage|felg|räder/i
};
export function groupWorkshopServices(workshop:Pick<Workshop,"services"|"serviceDetails">){
 const groups=workshop.services.map(title=>({title,items:[] as string[]}));
 const other={title:"Weitere Leistungen",items:[] as string[]};
 const details=[...new Set(workshop.serviceDetails.map(normalizeServiceDetail).filter(Boolean))];
 for(const text of details){const group=groups.find(g=>patterns[g.title]?.test(text))??(groups.length===1?groups[0]:other);group.items.push(text);}
 return [...groups,...(other.items.length?[other]:[])];
}
export type ProfileSelection={brand:string|null;service:string|null;vehicle:string|null};
export function profileSelection(filters:Pick<CatalogueFilters,"brand"|"service">,context?:SearchContext|null):ProfileSelection{
 const brand=context?.brand??filters.brand,service=context?.service??filters.service;
 return {brand:brand&&brand!=="Alle Marken"?brand:null,service:service&&service!=="Alle Leistungen"?service:null,vehicle:context?.model?[brand!=="Alle Marken"?brand:null,context.model,context.year?`(${context.year})`:null].filter(Boolean).join(" "):null};
}
export function workshopSelectionMatches(workshop:Pick<Workshop,"brands"|"services">,selection:ProfileSelection){return {brand:!!selection.brand&&(workshop.brands.includes(selection.brand)||workshop.brands.includes("Alle Marken")),service:!!selection.service&&workshop.services.includes(selection.service)};}
