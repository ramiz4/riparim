import {AsyncLocalStorage} from "node:async_hooks";
import {processNotifications} from "./outbox";

const contexts=new AsyncLocalStorage<Pick<ExecutionContext,"waitUntil">>();
export function withNotificationContext<T>(context:Pick<ExecutionContext,"waitUntil">,run:()=>T){return contexts.run(context,run);}
export async function triggerNotifications(options:{id?:string;force?:boolean;limit?:number}={}){
 const task=processNotifications(options),context=contexts.getStore();
 if(context)context.waitUntil(task);else await task;
}
