"use client";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";

export type SelectionDraft={choice:string;detail:string};
export type SelectionOption={value:string;label:string;disabled?:boolean};
export function selectedChoiceText(draft:SelectionDraft,options:readonly SelectionOption[]){
 if(draft.choice==="other")return draft.detail.trim();
 return options.find(option=>option.value===draft.choice&&!option.disabled)?.label??"";
}
export function SelectWithOther({id,label,placeholder,options,value,onChange,detailLabel,detailPlaceholder,minLength,maxLength,disabled=false,describedBy}:{id:string;label:string;placeholder:string;options:readonly SelectionOption[];value:SelectionDraft;onChange:(value:SelectionDraft)=>void;detailLabel:string;detailPlaceholder:string;minLength:number;maxLength:number;disabled?:boolean;describedBy?:string}){
 return <div className="select-with-other"><label htmlFor={id}>{label}</label><Select value={value.choice} disabled={disabled} onValueChange={choice=>{if(!disabled&&options.some(option=>option.value===choice&&!option.disabled))onChange({...value,choice});}}><SelectTrigger id={id} aria-describedby={describedBy}><SelectValue placeholder={placeholder}/></SelectTrigger><SelectContent position="popper">{options.map(option=><SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent></Select>{value.choice==="other"&&<><label htmlFor={`${id}-details`}>{detailLabel}</label><textarea id={`${id}-details`} aria-describedby={describedBy} required rows={3} minLength={minLength} maxLength={maxLength} disabled={disabled} value={value.detail} placeholder={detailPlaceholder} onChange={event=>{if(!disabled)onChange({...value,detail:event.target.value});}}/></>}</div>;
}
