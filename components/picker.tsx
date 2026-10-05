"use client";
import {useI18n} from "@/lib/i18n/client";
import {valueLabel,type ValueCategory} from "@/lib/i18n/values";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
export function Picker({value,onChange,values,label,displayLabels,valueCategory,id,disabled=false,disabledValues=[]}:{value:string;onChange:(v:string)=>void;values:string[];label:string;displayLabels?:Record<string,string>;valueCategory?:ValueCategory;id?:string;disabled?:boolean;disabledValues?:string[]}){const {locale}=useI18n();return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger id={id} className="picker" aria-label={label}><SelectValue /></SelectTrigger><SelectContent position="popper">{values.map(v=><SelectItem key={v} value={v} disabled={disabledValues.includes(v)}>{displayLabels?.[v]??(valueCategory?valueLabel(locale,valueCategory,v):v)}</SelectItem>)}</SelectContent></Select>;}
