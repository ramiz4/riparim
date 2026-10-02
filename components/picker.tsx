"use client";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
export function Picker({value,onChange,values,label,displayLabels}:{value:string;onChange:(v:string)=>void;values:string[];label:string;displayLabels?:Record<string,string>}){return <Select value={value} onValueChange={onChange}><SelectTrigger className="picker" aria-label={label}><SelectValue /></SelectTrigger><SelectContent position="popper">{values.map(v=><SelectItem key={v} value={v}>{displayLabels?.[v]??v}</SelectItem>)}</SelectContent></Select>;}
