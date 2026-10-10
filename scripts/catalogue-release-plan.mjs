import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

export async function catalogueReleasePlan(catalogue,commit,root=process.cwd()){
 const output=resolve(root,'.sites-runtime/catalogue-release/import.mjs');await mkdir(dirname(output),{recursive:true});
 await build({absWorkingDir:root,entryPoints:['db/catalogue-import.ts'],outfile:output,bundle:true,platform:'node',format:'esm'});
 const {catalogueImportStatements,catalogueImportKey,catalogueCompletionSql}=await import(pathToFileURL(output));
 // The same statement factory powers runtime imports; this adapter records its plan.
 const recorder={prepare(sql){return {bind(...params){return {sql,params};}};}};
 return {schemaVersion:1,commit,key:await catalogueImportKey(catalogue),completionSql:catalogueCompletionSql,statements:await catalogueImportStatements(recorder,catalogue)};
}
export function statementSql({sql,params}){
 let index=0;
 const text=sql.replace(/\?/g,()=>{
  if(index>=params.length)throw Error('Catalogue parameter missing');
  const value=params[index++];
  if(value===null)return 'NULL';
  if(typeof value==='number'&&Number.isFinite(value))return String(value);
  if(typeof value==='string')return "'"+value.replaceAll("'","''")+"'";
  throw Error('Invalid catalogue parameter');
 });
 if(index!==params.length)throw Error('Extra catalogue parameter');
 return text+';';
}
export async function writeCatalogueSql(file,statements){await writeFile(file,statements.map(statementSql).join('\n')+'\n',{mode:0o600,flag:'wx'});}
