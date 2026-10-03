"use client";
import {useId} from "react";
import {Picker} from "@/components/picker";
import {catalogueOptions,type CatalogueFilters} from "@/lib/catalogue-filters";
import {services,type Workshop} from "@/lib/workshops";

export function CatalogueFilterFields({filters,onChange,directory,fields=["service","city","brand","language"]}:{filters:CatalogueFilters;onChange:(field:"service"|"city"|"brand"|"language",value:string)=>void;directory:Workshop[];fields?:readonly ("service"|"city"|"brand"|"language")[]}){
 const id=useId(),options=catalogueOptions(directory),withSelected=(values:string[],selected:string)=>values.includes(selected)?values:[...values,selected];
 return <div className="catalogue-filter-fields" role="group" aria-label="Werkstattfilter">{([{key:"service",label:"Leistung",values:services},{key:"city",label:"Ort",values:withSelected(options.cities,filters.city)},{key:"brand",label:"Marke",values:withSelected(options.brands,filters.brand)},{key:"language",label:"Beratungssprache",values:withSelected(options.languages,filters.language)}] as const).filter(field=>fields.includes(field.key)).sort((a,b)=>fields.indexOf(a.key)-fields.indexOf(b.key)).map(field=><div className="catalogue-filter-field" key={field.key}><label htmlFor={`${id}-${field.key}`}>{field.label}</label><Picker id={`${id}-${field.key}`} value={filters[field.key]} onChange={value=>onChange(field.key,value)} values={[...field.values]} label={field.label} disabled={field.key==="language"&&options.languages.length===1}/>{field.key==="language"&&options.languages.length===1&&<p>Sprachangaben fehlen bisher. Kläre die Sprache direkt.</p>}</div>)}</div>;
}
