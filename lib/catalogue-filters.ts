import {brands,cities,services,findWorkshops,type Workshop} from "@/lib/workshops";
import type {SearchContext} from "@/app/journeys";

export type CatalogueFilters={service:string;city:string;brand:string;language:string;sort:"name"|"rating"};
export const defaultCatalogueFilters:CatalogueFilters={service:services[0],city:cities[0],brand:brands[0],language:"Alle Sprachen",sort:"name"};
export const filterLabels={service:"Leistung",city:"Ort",brand:"Marke",language:"Sprache"};
export const knownLanguages=["Albanisch","Deutsch","Englisch"];
export function catalogueSlug(value:string){const language={Albanisch:"sq",Deutsch:"de",Englisch:"en"}[value as "Albanisch"|"Deutsch"|"Englisch"];return language??value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
const unique=(values:string[])=>[...new Set(values)].sort((a,b)=>a.localeCompare(b,"de"));
export function catalogueOptions(directory:Workshop[]){return {cities:[cities[0],...unique(directory.map(w=>w.city))],brands:[brands[0],...unique(directory.flatMap(w=>w.brands).filter(value=>value!==brands[0]))],languages:["Alle Sprachen",...unique(directory.flatMap(w=>w.languages))]};}
export function hasPublishedRatings(directory:Workshop[]){return directory.some(w=>w.rating!==null&&Number.isFinite(w.rating)&&w.count>0);}
export function parseCatalogueFilters(query:Record<string,string|string[]|undefined>|URLSearchParams,directory:Workshop[]):CatalogueFilters{
 const get=(key:string)=>query instanceof URLSearchParams?query.get(key):typeof query[key]==="string"?query[key]:null;
 const options=catalogueOptions(directory),pick=(key:string,values:string[],fallback:string)=>values.find(value=>catalogueSlug(value)===get(key))??fallback;
 return {service:pick("leistung",services,services[0]),city:pick("ort",unique([...cities,...options.cities]),cities[0]),brand:pick("marke",unique([...brands,...options.brands]),brands[0]),language:pick("sprache",unique(["Alle Sprachen",...knownLanguages,...options.languages]),"Alle Sprachen"),sort:get("sort")==="bewertung"&&hasPublishedRatings(directory)?"rating":"name"};
}
export function catalogueHref(filters:CatalogueFilters){const params=new URLSearchParams();for(const [field,key] of [["service","leistung"],["city","ort"],["brand","marke"],["language","sprache"]] as const){if(filters[field]!==defaultCatalogueFilters[field])params.set(key,catalogueSlug(filters[field]));}if(filters.sort==="rating")params.set("sort","bewertung");return `/werkstaetten${params.size?`?${params.toString()}`:""}`;}
export function matchCatalogue(directory:Workshop[],filters:CatalogueFilters,context:SearchContext|null=null,privateMatchingActive=false){
 const geography=privateMatchingActive&&context&&context.city===filters.city?context:null;
 return findWorkshops(directory,filters.service,filters.city,filters.brand,geography?.radius??0,filters.language,geography?.additionalCity??"").filter(w=>w.status==="published"&&(filters.brand===brands[0]||w.brands.includes(filters.brand)||w.brands.includes(brands[0]))).sort((a,b)=>{
  if(filters.sort==="rating"){const ar=a.rating!==null&&a.count>0,br=b.rating!==null&&b.count>0;if(ar!==br)return Number(br)-Number(ar);if(ar&&br){const difference=(b.rating??0)-(a.rating??0)||b.count-a.count;if(difference)return difference;}}
  return a.name.localeCompare(b.name,"de");
 });
}
export function activeCatalogueFilters(filters:CatalogueFilters){return (["service","city","brand","language"] as const).filter(key=>filters[key]!==defaultCatalogueFilters[key]);}
