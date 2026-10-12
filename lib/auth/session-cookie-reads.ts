import {Buffer} from 'node:buffer';
import {combineChunks,isChunkLike} from '@supabase/ssr';
import type {AuthCookies} from './contract';

const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});

// Keep the real names for SSR's refresh/sign-out cleanup. Only its read view
// changes: valid canonical UTF-8 JSON can use the SDK's existing raw-cookie path.
// Legacy or malformed encodings remain untouched for the pinned SDK decoder.
export function sessionCookieReads(cookies:AuthCookies,key:string){
 let previous:string|undefined,decoded:string|null=null;
 return async()=>{
  const records=cookies.getAll();
  const encoded=await combineChunks(key,name=>records.find(cookie=>cookie.name===name)?.value);
  if(!encoded?.startsWith('base64-'))return records;
  if(encoded!==previous){
   previous=encoded;decoded=null;
   const base64=encoded.slice(7);
   if(/^[A-Za-z0-9_-]*$/.test(base64))try{
    const bytes=Buffer.from(base64,'base64url');
    if(bytes.toString('base64url')===base64){const value=decoder.decode(bytes);JSON.parse(value);decoded=value;}
   }catch{/* Preserve SSR's original fallback and invalid-cookie semantics. */}
  }
  if(decoded===null)return records;
  const whole=records.find(cookie=>cookie.name===key)?.value;
  return records.map(cookie=>cookie.name===(whole?key:key+'.0')?{...cookie,value:decoded!}:!whole&&isChunkLike(cookie.name,key)?{...cookie,value:''}:cookie);
 };
}
