import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:tls';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
let passed=0;const equal=(actual,expected,label)=>{assert.equal(actual,expected,label);passed++;};const check=(value,label)=>{assert(value,label);passed++;};
const out='.test-runtime/smtp-tls';await mkdir(out,{recursive:true});
let authCalls=0,accepted=0;const sockets=new Set();
const server=createServer({key:await readFile('tests/fixtures/smtp/key.pem'),cert:await readFile('tests/fixtures/smtp/cert.pem')},socket=>{
 sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));socket.write('220 fixture ESMTP\r\n');let buffer='',data=false,authenticated=false;
 socket.on('data',chunk=>{buffer+=chunk.toString();let offset;while((offset=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,offset);buffer=buffer.slice(offset+2);
  if(data){if(line==='.'){data=false;accepted++;socket.write('250 accepted\r\n');}continue;}
  if(/^EHLO/.test(line))socket.write('250-fixture\r\n250 AUTH PLAIN\r\n');
  else if(/^AUTH PLAIN/.test(line)){authCalls++;equal(Buffer.from(line.split(' ')[2],'base64').toString(),'\0fixture-user\0fixture-password');authenticated=true;socket.write('235 authenticated\r\n');}
  else if(/^MAIL FROM:|^RCPT TO:/.test(line)){check(authenticated,'Credentials must be accepted over validated TLS before the envelope');socket.write('250 ok\r\n');}
  else if(line==='DATA'){socket.write('354 data\r\n');data=true;}
  else if(line==='QUIT')socket.end('221 bye\r\n');else socket.write('250 ok\r\n');
 }});
});
server.on('tlsClientError',()=>{});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const bundled=await build({stdin:{contents:`import {emailConfiguration} from './lib/notifications/transports';const transport=emailConfiguration();if(!transport)throw Error('configuration_missing');const body=JSON.stringify({from:transport.from,to:['fixture@example.test'],subject:'Isolated TLS fixture',html:'<html lang="en">Fixture</html>',text:''});try{const wire=await transport.prepare(body,'fixture-tls');await transport.send(body,wire,'fixture-tls');console.log('accepted');}catch(error){console.log(error.code);process.exitCode=1;}`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',packages:'external',alias:{'@/lib/notifications/smtp':new URL('../lib/notifications/node-smtp.ts',import.meta.url).pathname},plugins:[{name:'offline-env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'export const env=process.env;'}));}}]});
await writeFile(out+'/client.mjs',bundled.outputFiles[0].contents);
const origin=`smtps://127.0.0.1:${server.address().port}`;
async function client(trusted,secretOrigin=origin){
 const env={...process.env,EMAIL_TRANSPORT:'smtp',SMTP_URL:origin.replace('://','://fixture-user:fixture-password@'),SMTP_SECRET_ORIGIN:secretOrigin,SITE_ORIGIN:'https://riparim.example.test',TRANSACTIONAL_EMAIL_FROM:'Riparim <no-reply@auth.example.test>'};
 delete env.NODE_TLS_REJECT_UNAUTHORIZED;delete env.NODE_EXTRA_CA_CERTS;if(trusted)env.NODE_EXTRA_CA_CERTS=new URL('./fixtures/smtp/cert.pem',import.meta.url).pathname;
 const child=spawn(process.execPath,[out+'/client.mjs'],{env,stdio:['ignore','pipe','pipe']});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>output+=chunk);const code=await new Promise(resolve=>child.on('close',resolve));return {code,output};
}
try{
 let result=await client(true);equal(result.code,0,result.output);equal(accepted,1);equal(authCalls,1);
 result=await client(false);equal(result.code,1);check(result.output.includes('delivery_uncertain'));equal(accepted,1);equal(authCalls,1,'An untrusted TLS peer never receives credentials');
 result=await client(true,'smtps://foreign.example.test:465');equal(result.code,1);check(result.output.includes('configuration_missing'));equal(authCalls,1,'Unbound credentials never reach even a trusted peer');
 console.log(JSON.stringify({smtpTlsChecksPassed:passed,realEmailsSent:false,productionTouched:false}));
}finally{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
