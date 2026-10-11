import {env} from "@/lib/runtime/env";
import {siteOrigin} from "@/lib/auth/config";
import {sendReviewEmail,validSender} from "./email";
import {smtpAvailable,prepareSmtp,sendSmtp} from "@/lib/notifications/smtp";

export type SmtpConfiguration={host:string;port:number;secure:boolean;local:boolean;user:string;pass:string};
export type MailTransport={kind:"resend"|"smtp";from:string;scope:string;idempotent:boolean;prepare(body:string,id:string):Promise<string|null>;send(body:string,wire:string|null,id:string):Promise<string>};
export function emailConfiguration():MailTransport|null{
 const from=env.TRANSACTIONAL_EMAIL_FROM?.trim();
 if(!from||!validSender(from))return null;
 let origin:URL;try{origin=new URL(siteOrigin());}catch{return null;}if(origin.protocol!=="https:"||origin.username||origin.password)return null;
 const kind=env.EMAIL_TRANSPORT?.trim()||"resend";
 if(kind==="resend"){
  const key=env.RESEND_API_KEY?.trim();if(!key||!/^re_[A-Za-z0-9_-]{10,}$/.test(key))return null;
  return {kind,from,scope:key,idempotent:true,prepare:async()=>null,send:(body,_wire,id)=>sendReviewEmail(body,key,id)};
 }
 if(kind!=="smtp"||!smtpAvailable)return null;
 let url:URL;try{url=new URL(env.SMTP_URL??"");}catch{return null;}
 if(!["smtp:","smtps:"].includes(url.protocol)||!url.hostname||(url.pathname&&url.pathname!=="/")||url.search||url.hash)return null;
 const host=url.hostname.replace(/^\[|\]$/g,""),port=Number(url.port||(url.protocol==="smtps:"?465:587)),secure=url.protocol==="smtps:";
 let user:string,pass:string;try{user=decodeURIComponent(url.username);pass=decodeURIComponent(url.password);}catch{return null;}
 if(port<1||port>65535||/[\r\n\0]/.test(user+pass)||Boolean(user)!==Boolean(pass))return null;
 const local=!secure&&(host==="127.0.0.1"||host==="::1")&&!user&&!pass;
 // Bind credentials to an explicit destination. URL options cannot disable TLS,
 // certificate verification or timeouts; STARTTLS is mandatory off loopback.
 const destination=`${url.protocol}//${url.host}${url.port?"":":"+port}`;
 if((user||pass)&&env.SMTP_SECRET_ORIGIN!==destination)return null;
 const config={host,port,secure,local,user,pass};
 return {kind,from,scope:JSON.stringify(config),idempotent:false,prepare:prepareSmtp,send:(body,wire,id)=>sendSmtp(config,body,wire,id)};
}
