import { env } from "cloudflare:workers";
export function storage(){if(!env.DB||!env.BUCKET)throw new Error("Storage unavailable");return {db:env.DB,bucket:env.BUCKET};}
export function moderatorEmail(){return (env.REVIEW_MODERATOR_EMAIL??"").toLowerCase();}
// The per-visit R2 namespace is a durable inventory, including older uploads.
// Retain the visit row on failure so owner deletion can retry the complete namespace.
export async function cleanupVisitEvidence(owner:string,id:string,keepKey:string|null=null){const {bucket}=storage();let cursor:string|undefined;do{const page=await bucket.list({prefix:`evidence/${owner}/${id}`,limit:100,cursor});const keys=page.objects.map(o=>o.key).filter(k=>k!==keepKey);if(keys.length)await bucket.delete(keys);cursor=page.truncated?page.cursor:undefined;}while(cursor);}
