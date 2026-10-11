import {AsyncLocalStorage} from 'node:async_hooks';
import {isIP,SocketAddress} from 'node:net';

// The ordinary server and Next's separately bundled app share only this
// container. Request addresses always remain in isolated async contexts.
const key=Symbol.for('riparim.node.client-address');
const contexts=(Reflect.get(globalThis,key) as AsyncLocalStorage<string>|undefined)??new AsyncLocalStorage<string>();
Reflect.set(globalThis,key,contexts);
export function withNodeClientAddress<T>(address:string,run:()=>T){return contexts.run(address,run);}
export function currentNodeClientAddress(){return contexts.getStore()??'unknown';}
function normalizedIp(value:string|undefined){
 if(!value||!isIP(value))return null;
 const address=SocketAddress.parse(isIP(value)===6?`[${value}]:0`:`${value}:0`)?.address;
 return address?.startsWith('::ffff:')?address.slice(7):address??null;
}
export function trustedProxyAddresses(value=''){
 return new Set(value.split(',').map(value=>value.trim()).filter(Boolean).map(value=>{
  const address=normalizedIp(value);if(!address)throw new Error('RIPARIM_TRUSTED_PROXIES requires explicit IP addresses');return address;
 }));
}
export function peerClientAddress(peer:string|undefined,realIp:string|string[]|undefined,trustedProxies:Set<string>){
 const address=normalizedIp(peer);
 if(address&&trustedProxies.has(address)&&typeof realIp==='string')return normalizedIp(realIp)??address;
 return address??'unknown';
}
