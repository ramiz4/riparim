import {createServer} from 'node:http';
import {parseArgs} from 'node:util';
import next from 'next';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {handleMigrationRequest,migrationReadOnly} from '../lib/migration-export';
import {env} from '../lib/runtime/node-env';
import {peerClientAddress,trustedProxyAddresses,withNodeClientAddress} from '../lib/runtime/node-request';

const {values}=parseArgs({options:{port:{type:'string',default:process.env.PORT??'3000'},hostname:{type:'string',default:'127.0.0.1'}}});
const port=Number(values.port),hostname=values.hostname;
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid Node server port');
const trustedProxies=trustedProxyAddresses(process.env.RIPARIM_TRUSTED_PROXIES);
let origin:URL;try{origin=new URL(process.env.SITE_ORIGIN??`http://127.0.0.1:${port}`);}catch{throw new Error('SITE_ORIGIN must be an HTTP(S) origin');}
if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('SITE_ORIGIN must be an HTTP(S) origin');
process.env.SITE_ORIGIN=origin.origin;
const publicPort=Number(origin.port||(origin.protocol==='https:'?'443':'80'));
const app=next({dev:false,hostname:origin.hostname,port:publicPort});await app.prepare();
const handle=app.getRequestHandler();
const server=createServer(async(request,response)=>{
 const address=peerClientAddress(request.socket.remoteAddress,request.headers['x-real-ip'],trustedProxies);
 // Next's absolute request metadata comes from our configured public origin,
 // independently of the listening socket and any client forwarding headers.
 request.headers.host=origin.host;
 request.headers['x-forwarded-host']=origin.host;
 request.headers['x-forwarded-proto']=origin.protocol.slice(0,-1);
 request.headers['x-forwarded-port']=String(publicPort);
 try{
  if(migrationReadOnly(env)||new URL(request.url??'/',origin).pathname==='/__migration/export'){
   const headers=new Headers();for(const [name,value] of Object.entries(request.headers)){if(Array.isArray(value))value.forEach(item=>headers.append(name,item));else if(value!==undefined)headers.set(name,value);}
   const method=request.method??'GET',body=['GET','HEAD'].includes(method)?undefined:Readable.toWeb(request) as ReadableStream<Uint8Array>;
   const result=await handleMigrationRequest(new Request(new URL(request.url??'/',origin),{method,headers,...(body?{body,duplex:'half'}:{})} as RequestInit),env);
   if(result){response.writeHead(result.status,Object.fromEntries(result.headers));if(result.body&&method!=='HEAD')await pipeline(Readable.fromWeb(result.body as import('node:stream/web').ReadableStream),response);else response.end();return;}
  }
  await withNodeClientAddress(address,()=>handle(request,response));
 }
 catch{console.error('node-request-failed');if(response.headersSent)response.destroy();else{response.writeHead(500);response.end('Internal Server Error');}}
});
server.listen(port,hostname,()=>console.log(`Riparim Node server listening on ${hostname}:${port}`));
function shutdown(){server.close(()=>{void app.close().then(()=>process.exit(0),()=>process.exit(1));});}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
