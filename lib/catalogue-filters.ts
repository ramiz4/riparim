import {displayComparator} from "@/lib/i18n/collation";
import {valueLabel} from "@/lib/i18n/values";
import {localizeHref,type Locale} from "@/lib/i18n/locale";
import {brands,cities,services,cityCoordinates,type Workshop} from "@/lib/workshops";

export type CatalogueSort="name"|"rating"|"distance";
export type CatalogueChoice=string|string[];
export const catalogueValues=(value:CatalogueChoice)=>Array.isArray(value)?value:[value];
export const catalogueChoice=(values:string[],fallback:string):CatalogueChoice=>{const selected=[...new Set(values)].filter(value=>value!==fallback);return selected.length>1?selected:selected[0]??fallback;};
export const catalogueChoiceLabel=(value:CatalogueChoice)=>catalogueValues(value).join(", ");
export type CatalogueFilters={query:string;service:CatalogueChoice;city:CatalogueChoice;brand:CatalogueChoice;language:string;sort:CatalogueSort};
export const defaultCatalogueFilters:CatalogueFilters={query:"",service:services[0],city:cities[0],brand:brands[0],language:"Alle Sprachen",sort:"name"};
export const filterLabels={query:"Name",service:"Leistung",city:"Ort",brand:"Marke",language:"Sprache"};
export const knownLanguages=["Albanisch","Deutsch","Englisch"];
const sortSlugs:Record<CatalogueSort,string>={name:"name",rating:"bewertung",distance:"entfernung"};
export function catalogueSlug(value:string){const language={Albanisch:"sq",Deutsch:"de",Englisch:"en"}[value as "Albanisch"|"Deutsch"|"Englisch"];return language??value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
export function catalogueQuery(value:string){return value.replace(/[\u0000-\u001f\u007f]/g,"").trim().replace(/\s+/g," ").slice(0,100);}
const searchText=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("de");
const unique=(values:string[])=>[...new Set(values)].sort((a,b)=>a.localeCompare(b,"de"));
export function catalogueOptions(directory:Workshop[],locale:Locale="de"){const compare=displayComparator(locale),sorted=(values:string[],language=false)=>[...new Set(values)].sort((a,b)=>compare(language?valueLabel(locale,"language",a):a,language?valueLabel(locale,"language",b):b));return {cities:[cities[0],...sorted(directory.map(w=>w.city))],brands:[brands[0],...sorted(directory.flatMap(w=>w.brands).filter(value=>value!==brands[0]))],languages:["Alle Sprachen",...sorted(directory.flatMap(w=>w.languages),true)]};}
const validRating=(value:number|null|undefined)=>value!=null&&Number.isFinite(value)&&value>=1&&value<=5;
export function hasPublishedRatings(directory:Workshop[]){return directory.some(w=>w.status==="published"&&validRating(w.rating)&&w.count>0);}

export function catalogueDistance(w:Workshop,city:CatalogueChoice):number|null{
 const selected=catalogueValues(city);
 const origin=selected.length===1?cityCoordinates[selected[0]]:undefined;
 if(!origin||w.lat==null||w.lng==null||!Number.isFinite(w.lat)||!Number.isFinite(w.lng))return null;
 const rad=Math.PI/180,a=Math.sin((w.lat-origin[0])*rad/2)**2+Math.cos(origin[0]*rad)*Math.cos(w.lat*rad)*Math.sin((w.lng-origin[1])*rad/2)**2;
 return Math.round(6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))*10)/10;
}
export function hasCatalogueDistances(directory:Workshop[],city:CatalogueChoice){return directory.some(w=>catalogueDistance(w,city)!==null);}

export function parseCatalogueFilters(query:Record<string,string|string[]|undefined>|URLSearchParams,directory:Workshop[]):CatalogueFilters{
 const get=(key:string)=>query instanceof URLSearchParams?query.get(key):typeof query[key]==="string"?query[key]:null;
 const all=(key:string)=>query instanceof URLSearchParams?query.getAll(key):Array.isArray(query[key])?query[key]:typeof query[key]==="string"?[query[key]]:[];
 const options=catalogueOptions(directory),pick=(key:string,values:string[],fallback:string)=>values.find(value=>catalogueSlug(value)===get(key))??fallback;
 const pickMany=(key:string,values:string[],fallback:string)=>catalogueChoice(all(key).slice(0,100).flatMap(slug=>values.find(value=>catalogueSlug(value)===slug)??[]),fallback);
 const city=pickMany("ort",unique([...cities,...options.cities]),cities[0]);
 const requested=(Object.keys(sortSlugs) as CatalogueSort[]).find(sort=>sortSlugs[sort]===get("sort"))??"name";
 const sort=requested==="rating"&&!hasPublishedRatings(directory)||requested==="distance"&&!(catalogueValues(city).length===1&&cityCoordinates[catalogueValues(city)[0]])?"name":requested;
 return {query:catalogueQuery(get("q")??""),service:pickMany("leistung",services,services[0]),city,brand:pickMany("marke",unique([...brands,...options.brands]),brands[0]),language:pick("sprache",unique(["Alle Sprachen",...knownLanguages,...options.languages]),"Alle Sprachen"),sort};
}
export function catalogueHref(filters:CatalogueFilters,locale:Locale="de"){
 const params=new URLSearchParams();
 const query=catalogueQuery(filters.query??"");if(query)params.set("q",query);
 for(const [field,key] of [["service","leistung"],["city","ort"],["brand","marke"],["language","sprache"]] as const){if(filters[field]!==defaultCatalogueFilters[field])for(const value of catalogueValues(filters[field]))if(value!==defaultCatalogueFilters[field])params.append(key,catalogueSlug(value));}
 if(filters.sort!=="name")params.set("sort",sortSlugs[filters.sort]);
 return localizeHref(`/werkstaetten${params.size?`?${params.toString()}`:""}`,locale);
}
function catalogueComparator(filters:CatalogueFilters,locale:Locale){
 const compareNames=displayComparator(locale);
 return (a:Workshop,b:Workshop)=>{
  if(filters.sort==="rating"){
   const av={rating:a.rating,count:a.count};
   const bv={rating:b.rating,count:b.count};
   const ar=validRating(av.rating)&&av.count>0,br=validRating(bv.rating)&&bv.count>0;
   if(ar!==br)return Number(br)-Number(ar);
   if(ar&&br){const difference=(bv?.rating??0)-(av?.rating??0)||(bv?.count??-1)-(av?.count??-1);if(difference)return difference;}
  }
  if(filters.sort==="distance"){
   const ad=catalogueDistance(a,filters.city),bd=catalogueDistance(b,filters.city);
   if((ad===null)!==(bd===null))return ad===null?1:-1;
   if(ad!==null&&bd!==null&&ad!==bd)return ad-bd;
  }
  return filters.sort==="name"?compareNames(a.name,b.name):a.name.localeCompare(b.name,"de");
 };
}
export function orderedCatalogue(directory:Workshop[],filters:CatalogueFilters,locale:Locale="de"){
 return directory.filter(w=>w.status==="published").sort(catalogueComparator(filters,locale));
}
export function matchCatalogue(directory:Workshop[],filters:CatalogueFilters,locale:Locale="de"){
 const words=searchText(catalogueQuery(filters.query??"")).split(" ").filter(Boolean);
 return directory.filter(w=>w.status==="published"&&catalogueValues(filters.service).some(value=>value===services[0]||w.services.includes(value))&&catalogueValues(filters.city).some(value=>value===cities[0]||w.city===value)&&catalogueValues(filters.brand).some(value=>value===brands[0]||w.brands.includes(value)||w.brands.includes(brands[0]))&&(filters.language==="Alle Sprachen"||w.languages.includes(filters.language))&&words.every(word=>searchText(w.name).includes(word))).sort(catalogueComparator(filters,locale));
}

export function activeCatalogueFilters(filters:CatalogueFilters){return (["query","service","city","brand","language"] as const).filter(key=>key==="query"?!!catalogueQuery(filters.query??""):filters[key]!==defaultCatalogueFilters[key]);}
