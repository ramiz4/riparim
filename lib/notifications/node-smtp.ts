import nodemailer from "nodemailer";
import SMTPConnection from "nodemailer/lib/smtp-connection";
import {deliveryPayloadSchema,DeliveryError} from "./email";
import type {SmtpConfiguration} from "./transports";
export const smtpAvailable=true;
const senderAddress=(from:string)=>from.match(/<([^<>]+)>$/)?.[1]??from;
export async function prepareSmtp(body:string,id:string):Promise<string>{
 const payload=deliveryPayloadSchema.parse(JSON.parse(body));
 const composer=nodemailer.createTransport({streamTransport:true,buffer:true,newline:"windows",disableFileAccess:true,disableUrlAccess:true});
 const result=await composer.sendMail({...payload,messageId:`<${id}@${senderAddress(payload.from).split("@")[1]}>`});
 return (result.message as Buffer).toString("base64");
}
export async function sendSmtp(config:SmtpConfiguration,body:string,wire:string|null,id:string):Promise<string>{
 if(!wire)throw new DeliveryError("invalid_payload",false);
 const payload=deliveryPayloadSchema.parse(JSON.parse(body));
 const connection=new SMTPConnection({host:config.host,port:config.port,secure:config.secure,requireTLS:!config.secure&&!config.local,ignoreTLS:config.local,tls:{rejectUnauthorized:true,minVersion:"TLSv1.2"},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:8000,dnsTimeout:8000});
 // Use one documented SMTPConnection, without pool requeues. close() aborts
 // the actual socket; the overall deadline also bounds cumulative slow stages.
 return new Promise<string>((resolve,reject)=>{
  let settled=false;
  const timer=setTimeout(()=>finish(new DeliveryError("delivery_uncertain",false,true)),20000);
  function finish(error?:unknown){
   if(settled)return;settled=true;clearTimeout(timer);connection.close();
   if(!error){resolve(id);return;}
   if(error instanceof DeliveryError){reject(error);return;}
   // A complete negative SMTP response proves non-acceptance. Socket errors
   // (including setup) are conservatively uncertain after the durable marker.
   const response=(error as {responseCode?:unknown})?.responseCode;
   reject(typeof response==="number"&&response>=400&&response<600?new DeliveryError(response<500?"provider_unavailable":"provider_rejected",response<500):new DeliveryError("delivery_uncertain",false,true));
  }
  connection.on("error",finish);
  connection.on("end",()=>{if(!settled)finish(new DeliveryError("delivery_uncertain",false,true));});
  const send=()=>connection.send({from:senderAddress(payload.from),to:payload.to},Buffer.from(wire,"base64"),(error,result)=>finish(error??(result?.accepted.length===1?undefined:new DeliveryError("provider_rejected",false))));
  connection.connect(()=>{
   if(!config.local&&!connection.secure){finish(new DeliveryError("delivery_uncertain",false,true));return;}
   if(config.user)connection.login({user:config.user,pass:config.pass},error=>error?finish(error):send());else send();
  });
 });
}
