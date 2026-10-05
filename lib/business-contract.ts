import {z} from "zod";
import {services,type Workshop} from "@/lib/workshops";

const text=(min:number,max:number)=>z.string().trim().min(min).max(max);
export const businessProfileSchema=z.object({
 phone:text(8,30),phoneNote:text(0,150),whatsapp:text(0,30),
 services:z.array(text(1,100).refine(value=>services.slice(1).includes(value))).min(1).max(20),
 serviceDetails:z.array(text(1,200)).min(1).max(30),description:text(20,2000)
}).strict();
export const claimSchema=z.object({
 workshopId:text(3,81).regex(/^[a-z0-9][a-z0-9-]{2,80}$/),evidence:text(40,4000),
 evidenceLinks:z.array(z.string().max(1000).url().refine(value=>{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password;})).max(5)
}).strict();
export type BusinessProfile=z.infer<typeof businessProfileSchema>;
export type BusinessDecision="approved"|"rejected";
export type BusinessRequest={id:string;workshopId:string;workshopName:string;status:string;moderatorNote:string;revision:number;createdAt:string;owner:string;evidence?:string;evidenceLinks?:string[];profile?:BusinessProfile;baseUpdatedAt?:string};
export type PendingBusinessClaim=Pick<BusinessRequest,"id"|"workshopId"|"workshopName"|"createdAt">;
export type BusinessState={pendingClaims:PendingBusinessClaim[];pendingChangeWorkshopIds:string[];pendingChangeRequestIds:string[];claims:BusinessRequest[];changes:BusinessRequest[];workshops:Workshop[];nextClaimCursor:string|null;nextChangeCursor:string|null;error?:string};
export function editableBusinessProfile(workshop:Pick<Workshop,"phone"|"phoneNote"|"whatsapp"|"services"|"serviceDetails"|"description">):BusinessProfile{return {phone:workshop.phone,phoneNote:workshop.phoneNote,whatsapp:workshop.whatsapp,services:workshop.services,serviceDetails:workshop.serviceDetails,description:workshop.description};}
