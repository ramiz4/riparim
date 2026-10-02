import { env } from "cloudflare:workers";
export function storage(){if(!env.DB||!env.BUCKET)throw new Error("Storage unavailable");return {db:env.DB,bucket:env.BUCKET};}
export function moderatorEmail(){return (env.REVIEW_MODERATOR_EMAIL??"").toLowerCase();}
