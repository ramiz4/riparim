"use client";
import {useI18n} from "@/lib/i18n/client";
import {valueLabel} from "@/lib/i18n/values";
import {useId} from "react";
import {SearchablePicker} from "@/components/searchable-picker";
import {catalogueOptions,catalogueValues,catalogueChoice,type CatalogueChoice,type CatalogueFilters} from "@/lib/catalogue-filters";
import {services,type Workshop} from "@/lib/workshops";

export function CatalogueFilterFields({filters,onChange,directory,fields=["service","city","brand","language"]}:{filters:CatalogueFilters;onChange:(field:"service"|"city"|"brand"|"language",value:CatalogueChoice)=>void;directory:Workshop[];fields?:readonly ("service"|"city"|"brand"|"language")[]}){
 const {locale,t}=useI18n();
 const id=useId(),options=catalogueOptions(directory,locale),withSelected=(values:string[],selected:CatalogueChoice)=>[...new Set([...values,...catalogueValues(selected)])];
 return <div className="catalogue-filter-fields" role="group" aria-label={t("public.filterLabel")}>{([{key:"service",label:t("public.service"),values:services},{key:"city",label:t("public.city"),values:withSelected(options.cities,filters.city)},{key:"brand",label:t("public.brand"),values:withSelected(options.brands,filters.brand)},{key:"language",label:t("public.consultationLanguage"),values:withSelected(options.languages,filters.language)}] as const).filter(field=>fields.includes(field.key)).sort((a,b)=>fields.indexOf(a.key)-fields.indexOf(b.key)).map(field=><div className="catalogue-filter-field" key={field.key}><label htmlFor={`${id}-${field.key}`}>{field.label}</label><SearchablePicker multiple={field.key!=="language"} allValue={field.values[0]} id={`${id}-${field.key}`} value={filters[field.key]} onChange={value=>onChange(field.key,catalogueChoice(catalogueValues(value),field.values[0]))} values={[...field.values]} label={field.label} displayLabels={Object.fromEntries(field.values.map(value=>[value,valueLabel(locale,field.key==="service"?"service":"language",valueLabel(locale,"sentinel",value))]))} disabled={field.key==="language"&&options.languages.length===1}/>{field.key==="language"&&options.languages.length===1&&<p>{t("public.languageUnknown")}</p>}</div>)}</div>;
}
