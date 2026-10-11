import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {PrivateFiles,PrivateObject,PrivateObjectBody,PutOptions} from './contracts';

type FileRow={key:string;etag:string;size:number;bytes:Uint8Array;uploaded:number;http_metadata:string;custom_metadata:string};
function validKey(key:string,prefix=false){
 const parts=key.split('/');
 if(key.length>1024||/[\\\x00-\x1f\x7f]/.test(key)||parts.some((part,index)=>part==='.'||part==='..'||(!part&&!(prefix&&index===parts.length-1))))throw new Error('Invalid private object key');
}
function metadata(row:FileRow):PrivateObject{return {key:row.key,etag:row.etag,size:row.size,uploaded:new Date(row.uploaded),httpMetadata:JSON.parse(row.http_metadata),customMetadata:JSON.parse(row.custom_metadata)};}
export function privateFiles(connection:DatabaseSync):PrivateFiles{
 connection.exec('CREATE TABLE IF NOT EXISTS private_objects (key TEXT PRIMARY KEY,etag TEXT NOT NULL,bytes BLOB NOT NULL,uploaded INTEGER NOT NULL,http_metadata TEXT NOT NULL,custom_metadata TEXT NOT NULL)');
 async function put(key:string,value:ArrayBuffer|Uint8Array|string|null,options:PutOptions={}):Promise<PrivateObject|null>{
  validKey(key);
  const bytes=value===null?new Uint8Array():typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value),etag=randomUUID(),uploaded=Date.now();
  const values=[etag,bytes,uploaded,JSON.stringify(options.httpMetadata??{}),JSON.stringify(options.customMetadata??{}),key];
  // The payload and its ETag are one SQLite row. A concurrent deletion and this
  // conditional UPDATE serialize on the database, including across processes.
  const result=options.onlyIf
   ?connection.prepare('UPDATE private_objects SET etag=?,bytes=?,uploaded=?,http_metadata=?,custom_metadata=? WHERE key=? AND etag=?').run(...values,options.onlyIf.etagMatches)
   :connection.prepare('INSERT INTO private_objects (etag,bytes,uploaded,http_metadata,custom_metadata,key) VALUES (?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET etag=excluded.etag,bytes=excluded.bytes,uploaded=excluded.uploaded,http_metadata=excluded.http_metadata,custom_metadata=excluded.custom_metadata').run(...values);
  return result.changes?{key,etag,size:bytes.byteLength,uploaded:new Date(uploaded),httpMetadata:options.httpMetadata,customMetadata:options.customMetadata}:null;
 }
 return {
  put:put as PrivateFiles['put'],
  async head(key){validKey(key);const row=connection.prepare('SELECT key,etag,length(bytes) AS size,uploaded,http_metadata,custom_metadata FROM private_objects WHERE key=?').get(key) as FileRow|undefined;return row?metadata(row):null;},
  async get(key,options){
   validKey(key);const row=connection.prepare('SELECT *,length(bytes) AS size FROM private_objects WHERE key=?').get(key) as FileRow|undefined;
   if(!row||(options?.onlyIf&&row.etag!==options.onlyIf.etagMatches))return null;
   const bytes=new Uint8Array(row.bytes);
   const result:PrivateObjectBody={...metadata(row),body:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}}),async arrayBuffer(){return bytes.slice().buffer;},async text(){return new TextDecoder().decode(bytes);}};
   return result;
  },
  async delete(keys){
   const values=typeof keys==='string'?[keys]:keys;values.forEach(key=>validKey(key));
   connection.exec('BEGIN IMMEDIATE');
   try{for(const key of values)connection.prepare('DELETE FROM private_objects WHERE key=?').run(key);connection.exec('COMMIT');}catch(error){connection.exec('ROLLBACK');throw error;}
  },
  async list({prefix='',cursor,limit=100}={}){
   validKey(prefix,true);if(!Number.isInteger(limit)||limit<1||limit>1000)throw new Error('Invalid private object list limit');
   if(cursor)validKey(cursor);
   const rows=connection.prepare('SELECT key,etag,length(bytes) AS size,uploaded,http_metadata,custom_metadata FROM private_objects WHERE substr(key,1,length(?))=? AND key>? ORDER BY key LIMIT ?').all(prefix,prefix,cursor??'',limit+1) as FileRow[];
   const truncated=rows.length>limit,objects=rows.slice(0,limit).map(metadata);
   return {objects,truncated,...(truncated?{cursor:objects.at(-1)!.key}:{})};
  },
 };
}
