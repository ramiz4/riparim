// SMTP requires Node TCP/TLS. Workers retain the existing HTTP transport.
import {DeliveryError} from "./email";
import type {SmtpConfiguration,MailTransport} from "./transports";
export const smtpAvailable=false;
export const prepareSmtp:MailTransport["prepare"]=async()=>{throw new DeliveryError("configuration_missing",false);};
export const sendSmtp:(config:SmtpConfiguration,body:string,wire:string|null,id:string)=>Promise<string>=async()=>{throw new DeliveryError("configuration_missing",false);};
