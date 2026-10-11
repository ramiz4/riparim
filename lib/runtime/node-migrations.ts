import {nodeMigrationSchema} from './node-schema.mjs';
import {createHash} from 'node:crypto';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {privateDatabase} from './node-storage';

export function migrateNode(directory:string,migrations='drizzle'){
 directory=resolve(directory);mkdirSync(directory,{recursive:true,mode:0o700});
 const database=privateDatabase(join(directory,'app.sqlite'));
 try{
  database.exec(nodeMigrationSchema);
  // Every existing Drizzle SQL file runs once, atomically with its receipt.
  for(const name of readdirSync(migrations).filter(name=>/^\d+_.+\.sql$/.test(name)).sort()){
   const sql=readFileSync(join(migrations,name),'utf8'),digest=createHash('sha256').update(sql).digest('hex');
   database.exec('BEGIN IMMEDIATE');
   try{
    const existing=database.prepare('SELECT sha256 FROM riparim_node_migrations WHERE name=?').get(name);
    if(existing){if(existing.sha256!==digest)throw new Error(`Applied migration changed: ${name}`);}
    else{database.exec(sql);database.prepare('INSERT INTO riparim_node_migrations VALUES (?,?,?)').run(name,digest,new Date().toISOString());}
    database.exec('COMMIT');
   }catch(error){database.exec('ROLLBACK');throw error;}
  }
 }finally{database.close();}
}
