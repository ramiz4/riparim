import {brands,cities,services,cityCoordinates,findWorkshops,type Workshop} from "@/lib/workshops";
import type {SearchContext} from "@/app/journeys";

export type CatalogueSort="name"|"rating"|"google"|"distance";
export type CatalogueFilters={query:string;service:string;city:string;brand:string;language:string;sort:CatalogueSort};
export type CatalogueGoogleRatings=Record<string,{rating:number|null;count:number|null}>;
export const defaultCatalogueFilters:CatalogueFilters={query:"",service:services[0],city:cities[0],brand:brands[0],language:"Alle Sprachen",sort:"name"};
export const filterLabels={query:"Name",service:"Leistung",city:"Ort",brand:"Marke",language:"Sprache"};
export const knownLanguages=["Albanisch","Deutsch","Englisch"];
const sortSlugs:Record<CatalogueSort,string>={name:"name",rating:"bewertung",google:"google",distance:"entfernung"};
export function catalogueSlug(value:string){const language={Albanisch:"sq",Deutsch:"de",Englisch:"en"}[value as "Albanisch"|"Deutsch"|"Englisch"];return language??value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
export function catalogueQuery(value:string){return value.replace(/[\u0000-\u001f\u007f]/g,"").trim().replace(/\s+/g," ").slice(0,100);}
const searchText=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("de");
const unique=(values:string[])=>[...new Set(values)].sort((a,b)=>a.localeCompare(b,"de"));
export function catalogueOptions(directory:Workshop[]){return {cities:[cities[0],...unique(directory.map(w=>w.city))],brands:[brands[0],...unique(directory.flatMap(w=>w.brands).filter(value=>value!==brands[0]))],languages:["Alle Sprachen",...unique(directory.flatMap(w=>w.languages))]};}
const validRating=(value:number|null|undefined)=>value!=null&&Number.isFinite(value)&&value>=1&&value<=5;
export function hasPublishedRatings(directory:Workshop[]){return directory.some(w=>w.status==="published"&&validRating(w.rating)&&w.count>0);}
export function hasGoogleRatings(directory:Workshop[],live:CatalogueGoogleRatings={}){return directory.some(w=>w.status==="published"&&validRating((live[w.id]??w.googleRating)?.rating));}

export function catalogueDistance(w:Workshop,city:string):number|null{
 const origin=cityCoordinates[city];
 if(!origin||w.lat==null||w.lng==null||!Number.isFinite(w.lat)||!Number.isFinite(w.lng))return null;
 const rad=Math.PI/180,a=Math.sin((w.lat-origin[0])*rad/2)**2+Math.cos(origin[0]*rad)*Math.cos(w.lat*rad)*Math.sin((w.lng-origin[1])*rad/2)**2;
 return Math.round(6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))*10)/10;
}
export function hasCatalogueDistances(directory:Workshop[],city:string){return directory.some(w=>catalogueDistance(w,city)!==null);}

export function parseCatalogueFilters(query:Record<string,string|string[]|undefined>|URLSearchParams,directory:Workshop[]):CatalogueFilters{
 const get=(key:string)=>query instanceof URLSearchParams?query.get(key):typeof query[key]==="string"?query[key]:null;
 const options=catalogueOptions(directory),pick=(key:string,values:string[],fallback:string)=>values.find(value=>catalogueSlug(value)===get(key))??fallback;
 const city=pick("ort",unique([...cities,...options.cities]),cities[0]);
 const requested=(Object.keys(sortSlugs) as CatalogueSort[]).find(sort=>sortSlugs[sort]===get("sort"))??"name";
 const sort=requested==="rating"&&!hasPublishedRatings(directory)||requested==="distance"&&!cityCoordinates[city]?"name":requested;
 return {query:catalogueQuery(get("q")??""),service:pick("leistung",services,services[0]),city,brand:pick("marke",unique([...brands,...options.brands]),brands[0]),language:pick("sprache",unique(["Alle Sprachen",...knownLanguages,...options.languages]),"Alle Sprachen"),sort};
}
export function catalogueHref(filters:CatalogueFilters){
 const params=new URLSearchParams();
 const query=catalogueQuery(filters.query??"");if(query)params.set("q",query);
 for(const [field,key] of [["service","leistung"],["city","ort"],["brand","marke"],["language","sprache"]] as const){if(filters[field]!==defaultCatalogueFilters[field])params.set(key,catalogueSlug(filters[field]));}
 if(filters.sort!=="name")params.set("sort",sortSlugs[filters.sort]);
 return `/werkstaetten${params.size?`?${params.toString()}`:""}`;
}
export function matchCatalogue(directory:Workshop[],filters:CatalogueFilters,context:SearchContext|null=null,privateMatchingActive=false,live:CatalogueGoogleRatings={}){
 const geography=privateMatchingActive&&context&&context.city===filters.city?context:null;
 const words=searchText(catalogueQuery(filters.query??"")).split(" ").filter(Boolean);
 return findWorkshops(directory,filters.service,filters.city,filters.brand,geography?.radius??0,filters.language,geography?.additionalCity??"").filter(w=>w.status==="published"&&(filters.brand===brands[0]||w.brands.includes(filters.brand)||w.brands.includes(brands[0]))&&words.every(word=>searchText(w.name).includes(word))).sort((a,b)=>{
  if(filters.sort==="rating"||filters.sort==="google"){
   const av=filters.sort==="google"?live[a.id]??a.googleRating:{rating:a.rating,count:a.count};
   const bv=filters.sort==="google"?live[b.id]??b.googleRating:{rating:b.rating,count:b.count};
   const ar=validRating(av?.rating)&&(filters.sort==="google"||(av?.count??0)>0),br=validRating(bv?.rating)&&(filters.sort==="google"||(bv?.count??0)>0);
   if(ar!==br)return Number(br)-Number(ar);
   if(ar&&br){const difference=(bv?.rating??0)-(av?.rating??0)||(bv?.count??-1)-(av?.count??-1);if(difference)return difference;}
  }
  if(filters.sort==="distance"){
   const ad=catalogueDistance(a,filters.city),bd=catalogueDistance(b,filters.city);
   if((ad===null)!==(bd===null))return ad===null?1:-1;
   if(ad!==null&&bd!==null&&ad!==bd)return ad-bd;
  }
  return a.name.localeCompare(b.name,"de");
 });
}
export function activeCatalogueFilters(filters:CatalogueFilters){return (["query","service","city","brand","language"] as const).filter(key=>key==="query"?!!catalogueQuery(filters.query??""):filters[key]!==defaultCatalogueFilters[key]);}
