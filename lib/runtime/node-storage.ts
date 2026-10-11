import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {privateFiles} from './node-files';
import type {SqlDatabase,SqlStatement,SqlResult} from './contracts';

class Statement implements SqlStatement {
 constructor(readonly connection:DatabaseSync,readonly sql:string,readonly values:SQLInputValue[]=[]){}
 bind(...values:unknown[]){return new Statement(this.connection,this.sql,values.map(value=>{
  if(value===null||typeof value==='string'||typeof value==='number'||value instanceof Uint8Array)return value;
  throw new Error('Unsupported SQL parameter');
 }));}
 execute<T>():SqlResult<T>{
  const query=this.connection.prepare(this.sql),results=query.all(...this.values) as T[];
  const meta=this.connection.prepare('SELECT changes() AS changes').get()!;
  return {results,meta:{changes:Number(meta.changes)},success:true};
 }
 async first<T=Record<string,unknown>>(){return this.execute<T>().results[0]??null;}
 async all<T=Record<string,unknown>>(){return this.execute<T>();}
 async run(){return this.execute<Record<string,unknown>>();}
}
export function privateDatabase(path:string){
 const database=new DatabaseSync(path);
 chmodSync(path,0o600);
 database.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 return database;
}
export function createNodeStorage(directory:string){
 directory=resolve(directory);mkdirSync(directory,{recursive:true,mode:0o700});
 const connection=privateDatabase(join(directory,'app.sqlite'));
 const db:SqlDatabase={
  prepare(sql){return new Statement(connection,sql);},
  async batch<T>(statements:SqlStatement[]){
   // No await inside this transaction: other requests cannot interleave writes.
   connection.exec('BEGIN IMMEDIATE');
   try{
    const results=statements.map(statement=>{
     if(!(statement instanceof Statement)||statement.connection!==connection)throw new Error('Batch statement belongs to a different database');
     return statement.execute<T>();
    });
    connection.exec('COMMIT');return results;
   }catch(error){connection.exec('ROLLBACK');throw error;}
  },
 };
 const files=privateDatabase(join(directory,'files.sqlite')),bucket=privateFiles(files);
 return {db,bucket,close(){connection.close();files.close();}};
}
