import {readFile,writeFile,rename,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=resolve(root,'.sites-runtime/catalogue-cli');
await mkdir(runtime,{recursive:true});
const output=resolve(runtime,'source.mjs');
await build({absWorkingDir:root,entryPoints:['lib/workshop-source.ts'],bundle:true,platform:'node',format:'esm',outfile:output});
const {validateWorkshopCatalogue,catalogueStats,mergeWorkshopCatalogue}=await import(pathToFileURL(output));
const path=resolve(root,'data/workshops.json');
const current=validateWorkshopCatalogue(JSON.parse(await readFile(path,'utf8')));
const [action='check',inputPath,...flags]=process.argv.slice(2);
if(action==='check'){
 if(inputPath)throw Error('check benötigt keine zusätzlichen Argumente');
 console.log(JSON.stringify({file:'data/workshops.json',total:current.workshops.length,...catalogueStats(current.workshops),estimatedTotal:current.coverage.estimatedTotal,complete:current.coverage.complete},null,2));
}else if(action==='merge'){
 if(!inputPath||flags.some(flag=>flag!=='--write'))throw Error('Verwendung: npm run catalog:merge -- datei.json [--write]');
 const incoming=JSON.parse(await readFile(resolve(inputPath),'utf8'));
 if(!Array.isArray(incoming.workshops))throw Error('Importdatei muss ein workshops-Array enthalten');
 const {catalogue,report}=mergeWorkshopCatalogue(current,incoming.workshops);
 const changed=report.added.length+report.updated.length>0;
 if(flags.includes('--write')&&changed){
  const temporary=path+'.tmp';
  try{await writeFile(temporary,JSON.stringify(catalogue,null,2)+'\n',{flag:'wx'});await rename(temporary,path);}finally{await rm(temporary,{force:true});}
 }
 console.log(JSON.stringify({mode:flags.includes('--write')?'write':'dry-run',changed,total:catalogue.workshops.length,...report},null,2));
}else throw Error('Unterstützt werden check und merge');
