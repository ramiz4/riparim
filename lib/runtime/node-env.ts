import {createNodeStorage} from './node-storage';
import type {RuntimeEnv} from './contracts';
let storage:ReturnType<typeof createNodeStorage>|undefined;
const configuration=['SITE_ORIGIN','REVIEW_MODERATOR_EMAIL','GOOGLE_MAPS_BROWSER_API_KEY','GOOGLE_PLACES_SERVER_API_KEY','EMAIL_LOGIN_ACTIVATION_TIME','EMAIL_LOGIN_ACTIVATION_PROJECT','SUPABASE_SECRET_KEY','RESEND_API_KEY','TRANSACTIONAL_EMAIL_FROM'] as const;
export const env:RuntimeEnv=new Proxy({}, {get(_target,key){
 if(key==='DB'||key==='BUCKET'){
  storage??=createNodeStorage(process.env.RIPARIM_DATA_DIR??'.riparim');
  return key==='DB'?storage.db:storage.bucket;
 }
 return configuration.includes(key as typeof configuration[number])?process.env[String(key)]:undefined;
}});
export function nativeIdentityEnabled(){return false;}
