import {z} from "zod";
import {evidenceFileLimit} from "@/lib/evidence-file";
import type {ErrorCode} from "@/lib/i18n/codes";
import {services,type Workshop} from "@/lib/workshops";

const text=(min:number,max:number)=>z.string().trim().min(min).max(max);
export const businessProfileSchema=z.object({
 phone:text(8,30),phoneNote:text(0,150),whatsapp:text(0,30),
 services:z.array(text(1,100).refine(value=>services.slice(1).includes(value))).min(1).max(20),
 serviceDetails:z.array(text(1,200)).min(1).max(30),description:text(20,2000)
}).strict();
export const claimSchema=z.object({
 workshopId:text(3,81).regex(/^[a-z0-9][a-z0-9-]{2,80}$/),evidence:text(40,4000),
 evidenceLinks:z.array(z.string().max(1000).url().refine(value=>{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password;})).max(5).default([])
}).strict();
export type BusinessProfile=z.infer<typeof businessProfileSchema>;
export type BusinessDecision="approved"|"rejected";
export type BusinessRequest={id:string;workshopId:string;workshopName:string;status:string;moderatorNote:string;revision:number;createdAt:string;owner:string;evidence?:string;evidenceLinks?:string[];fileName?:string|null;documents?:{id:string;fileName:string}[];profile?:BusinessProfile;baseUpdatedAt?:string};
export type PendingBusinessClaim=Pick<BusinessRequest,"id"|"workshopId"|"workshopName"|"createdAt"|"fileName"|"documents">;
export type BusinessState={pendingClaims:PendingBusinessClaim[];pendingChangeWorkshopIds:string[];pendingChangeRequestIds:string[];claims:BusinessRequest[];changes:BusinessRequest[];workshops:Workshop[];nextClaimCursor:string|null;nextChangeCursor:string|null;error?:string};
export function editableBusinessProfile(workshop:Pick<Workshop,"phone"|"phoneNote"|"whatsapp"|"services"|"serviceDetails"|"description">):BusinessProfile{return {phone:workshop.phone,phoneNote:workshop.phoneNote,whatsapp:workshop.whatsapp,services:workshop.services,serviceDetails:workshop.serviceDetails,description:workshop.description};}

export const claimDocumentLimit=5,claimDocumentsSizeLimit=10*1024*1024,claimUploadRequestLimit=11*1024*1024;
export function claimDocumentsError(files:ReadonlyArray<Pick<File,"size">>):ErrorCode|null{
 if(!files.length)return "business_documents_required";
 if(files.length>claimDocumentLimit)return "business_documents_limit";
 if(files.some(file=>file.size>evidenceFileLimit))return "file_too_large";
 if(files.reduce((total,file)=>total+file.size,0)>claimDocumentsSizeLimit)return "business_documents_too_large";
 return null;
}
const storedClaimDocumentSchema=z.object({id:z.string().uuid(),fileKey:z.string().min(1),fileName:z.string(),fileType:z.enum(["application/pdf","image/jpeg","image/png"])}).strict();
export type StoredClaimDocument=z.infer<typeof storedClaimDocumentSchema>;
export function storedClaimDocuments(row:Record<string,unknown>):StoredClaimDocument[]{
 const documents=z.array(storedClaimDocumentSchema).max(claimDocumentLimit).parse(JSON.parse(String(row.documents??"[]")));
 // The previous worker may still create a single-file claim during schema rollout.
 if(!documents.length&&row.file_key)return [storedClaimDocumentSchema.parse({id:row.id,fileKey:row.file_key,fileName:row.file_name,fileType:row.file_type})];
 return documents;
}
export function claimDocumentViews(row:Record<string,unknown>){return storedClaimDocuments(row).map(({id,fileName})=>({id,fileName}));}
