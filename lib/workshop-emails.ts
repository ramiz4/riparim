import {z} from "zod";

export const workshopEmailLimit=10;
export const workshopEmailSchema=z.string().trim().min(1).max(254).email();
export const workshopEmailsSchema=z.array(workshopEmailSchema).max(workshopEmailLimit).superRefine((emails,context)=>{
 const seen=new Set<string>();
 emails.forEach((email,index)=>{const key=email.toLowerCase();if(seen.has(key))context.addIssue({code:z.ZodIssueCode.custom,path:[index],message:"Duplicate email address"});seen.add(key);});
});
export function sameWorkshopEmails(a:readonly string[],b:readonly string[]){return a.length===b.length&&a.every((email,index)=>email.trim()===b[index].trim());}
export function decodeWorkshopEmails(value:unknown):string[]{
 if(typeof value!=="string")return [];
 try{const result=workshopEmailsSchema.safeParse(JSON.parse(value));return result.success?result.data:[];}catch{return [];}
}
export const workshopEmailEditSchema=z.object({address:workshopEmailSchema,active:z.boolean(),verified:z.boolean()}).strict();
export type WorkshopEmailEdit=z.infer<typeof workshopEmailEditSchema>;
export const workshopEmailEditsSchema=z.array(workshopEmailEditSchema).max(workshopEmailLimit).superRefine((entries,context)=>{
 const result=workshopEmailsSchema.safeParse(entries.map(e=>e.address));
 if(!result.success)for(const issue of result.error.issues)context.addIssue({...issue,path:[...issue.path,"address"]});
});
export function sameWorkshopEmailEdits(a:readonly WorkshopEmailEdit[],b:readonly WorkshopEmailEdit[]){return a.length===b.length&&a.every((entry,index)=>entry.address.trim()===b[index].address.trim()&&entry.active===b[index].active&&entry.verified===b[index].verified);}
export function workshopEmailEdits(editorial:unknown,researched:unknown):WorkshopEmailEdit[]{
 if(editorial===null||editorial===undefined)return decodeWorkshopEmails(researched).map(address=>({address,active:true,verified:false}));
 if(typeof editorial!=="string")return [];
 try{const parsed=workshopEmailEditsSchema.safeParse(JSON.parse(editorial));return parsed.success?parsed.data:[];}catch{return [];}
}
// Encode each address, including local-part characters which could become URI
// headers or delimiters. Never combine recipients into a single mailto link.
export function workshopEmailHref(email:string){return "mailto:"+encodeURIComponent(email);}
