import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const require=createRequire(import.meta.url),{build}=require('esbuild'),ts=require('typescript');
const root=fileURLToPath(new URL('../',import.meta.url));
async function load(name){
 const result=await build({entryPoints:[path.join(root,`lib/i18n/${name}.ts`)],bundle:true,platform:'node',format:'esm',write:false});
 return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
}
const {privacyDe,privacyMessages}=await load('privacy-messages');
const {getMessages}=await load('messages'),{canonicalValues,valueLabel}=await load('values'),{services}=await load('../workshops');
const placeholders=text=>[...text.matchAll(/\{([a-zA-Z]\w*)\}/g)].map(match=>match[1]).sort();
function checkCatalog(base,translated,prefix){
 assert.deepEqual(Object.keys(translated).sort(),Object.keys(base).sort(),`${prefix}: key parity`);
 for(const [key,source] of Object.entries(base)){
  const value=translated[key],label=`${prefix}.${key}`;
  if(typeof source==='string'){
   assert.equal(typeof value,'string',`${label}: message must be text`);
   assert.ok(value.trim(),`${label}: message must not be empty`);
   assert.deepEqual(placeholders(value),placeholders(source),`${label}: parameter parity`);
  }else checkCatalog(source,value,label);
 }
}
for(const locale of ['de','sq','en'])checkCatalog(privacyDe,privacyMessages[locale],`privacy.${locale}`);
for(const locale of ['de','sq','en']){
 const messages=getMessages(locale),base=getMessages('de');
 assert.equal(messages.locale,locale);
 for(const namespace of Object.keys(base).filter(key=>key!=='locale'))checkCatalog(base[namespace],messages[namespace],`${locale}.${namespace}`);
 assert.deepEqual(JSON.parse(JSON.stringify(messages)),messages,`${locale}: JSON serialization`);
 assert.equal(Intl.PluralRules.supportedLocalesOf([locale]).length,1,`${locale}: Intl.PluralRules support`);
 assert.equal(Intl.NumberFormat.supportedLocalesOf([locale]).length,1,`${locale}: Intl.NumberFormat support`);
 assert.equal(Intl.DateTimeFormat.supportedLocalesOf([locale]).length,1,`${locale}: Intl.DateTimeFormat support`);
 for(const [category,values] of Object.entries(canonicalValues))for(const value of values){
  assert.ok(valueLabel(locale,category,value).trim(),`${locale}/${category}/${value}: nonempty label`);
 }
}
assert.deepEqual(canonicalValues.service,services,'label contracts cover all current canonical services');

// Compile caller examples as part of CI without leaving generated source behind.
const virtualFile=path.join(root,'.i18n-contract-check.ts');
const source=`
import {createTranslator,getMessages} from './lib/i18n/messages';
import {type CodedResponse} from './lib/i18n/codes';
const t=createTranslator(getMessages('sq',['common']));
t('common.login');
t('customer.stars',{count:2});
t('management.deliveryAttempts',{count:2});
// @ts-expect-error private draft titles still require their explicit name
t('management.draftFor');
// @ts-expect-error roles and statuses are displayed separately from payload data
const unknownManagementCode:CodedResponse={errorCode:'translated role'};
void unknownManagementCode;
// @ts-expect-error customer rich text needs its named parameter
t('customer.enterDeletePhrase');
// @ts-expect-error missing stars count fails
t('customer.stars');
t('common.reviewCount',{count:2});
const response:CodedResponse={errorCode:'forbidden',error:'Legacy compatible text'};
void response;
// @ts-expect-error unknown keys must fail
t('common.missing');
// @ts-expect-error omitted required interpolation parameter must fail
t('common.reviewCount');
// @ts-expect-error plural counts must be numeric
t('common.reviewCount',{count:'2'});
// @ts-expect-error extra interpolation parameter must fail
t('common.reviewCount',{count:2,extra:'unexpected'});
// @ts-expect-error messages with no parameters accept none
t('common.login',{count:2});
// @ts-expect-error unknown response codes must fail
const bad:CodedResponse={errorCode:'provider raw error'};
void bad;
`;
const options={strict:true,noEmit:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,types:['node']};
const host=ts.createCompilerHost(options),originalSource=host.getSourceFile.bind(host);
host.getSourceFile=(file,...args)=>file===virtualFile?ts.createSourceFile(file,source,options.target,true):originalSource(file,...args);
const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram([virtualFile],options,host));
if(diagnostics.length){
 console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:file=>file,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
 process.exitCode=1;
}else console.log('i18n catalogs, Intl support and compile-time caller contracts passed');
