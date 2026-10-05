import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
async function load(name){
 const bundle=await build({entryPoints:[`lib/i18n/${name}.ts`],bundle:true,platform:'node',format:'esm',write:false});
 await mkdir('.test-runtime/i18n-messages',{recursive:true});
 await writeFile(`.test-runtime/i18n-messages/${name}.mjs`,bundle.outputFiles[0].contents);
 return import(new URL(`../.test-runtime/i18n-messages/${name}.mjs`,import.meta.url));
}
const {getMessages,createTranslator,defaultMessages}=await load('messages');
for(const [locale,login,title] of [['de','Anmelden','Riparim – Werkstätten in Kosovo'],['sq','Hyr','Riparim – Servise në Kosovë'],['en','Log in','Riparim – Workshops in Kosovo']]){
 const messages=getMessages(locale);
 assert.equal(messages.locale,locale,'the active locale travels with the JSON catalog');
 assert.equal(messages.common.login,login);
 assert.equal(messages.metadata.title,title);
 assert.deepEqual(JSON.parse(JSON.stringify(messages)),messages,'messages serialize without losing data');
 assert.deepEqual(Object.keys(getMessages(locale,['common'])).sort(),['common','locale'],'only requested namespaces reach the client');
}
assert.equal(createTranslator(defaultMessages)('common.login'),'Anmelden','isolated clients have a German common fallback');
assert.equal(getMessages('unexpected').locale,'de','unexpected runtime locales fall back to German');
const clientBundle=await build({stdin:{contents:"import {createTranslator,defaultMessages} from './lib/i18n/messages'; export const t=createTranslator(defaultMessages);",resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',write:false,minify:true});
assert.ok(!clientBundle.outputFiles[0].text.includes('Regjistrohu'),'client translator imports omit the Albanian catalog');
assert.ok(!clientBundle.outputFiles[0].text.includes('Open user menu'),'client translator imports omit the English catalog');
const codeBundle=await build({stdin:{contents:"import {errorCodeMessage} from './lib/i18n/codes'; export {errorCodeMessage};",resolveDir:process.cwd()},bundle:true,platform:'browser',format:'esm',write:false,minify:true});
assert.ok(!codeBundle.outputFiles[0].text.includes('Regjistrohu'),'safe code helpers do not pull inactive catalogs into the client');
for(const [locale,suffixes] of [['de',['Bewertungen','Bewertung','Bewertungen']],['sq',['vlerësime','vlerësim','vlerësime']],['en',['reviews','review','reviews']]]){
 const messages=getMessages(locale,['common']),t=createTranslator(messages);
 assert.equal(t('common.login'),messages.common.login);
 for(const count of [0,1,2])assert.equal(t('common.reviewCount',{count}),`${count} ${suffixes[count]}`,'plural rules distinguish 0, 1 and 2');
 assert.equal(t('common.reviewCount'),messages.common.unavailable,'missing runtime parameters show a safe understandable fallback');
 assert.equal(t('common.reviewCount',{count:NaN}),messages.common.unavailable);
 assert.equal(t('common.unknown'),messages.common.unavailable,'unknown keys never show internal keys or raw data');
 assert.equal(t('common.__proto__'),messages.common.unavailable);
 assert.equal(createTranslator({...messages,common:{...messages.common,login:''}})('common.login'),messages.common.unavailable);
}
const {valueLabel,displayLabels}=await load('values');
assert.equal(valueLabel('sq','service','Inspektion & Wartung'),'Kontroll & mirëmbajtje');
assert.equal(valueLabel('en','sentinel','Alle Sprachen'),'All languages');
assert.equal(valueLabel('en','evidence','Rechnung'),'Invoice');
assert.equal(valueLabel('sq','language','Deutsch'),'Gjermanisht');
assert.equal(valueLabel('en','status','pending'),'Under review');
assert.equal(valueLabel('sq','provider','E-Mail'),'Email');
assert.equal(valueLabel('en','language','Unbekannte Sprache'),'Unbekannte Sprache','unknown factual values remain visible');
assert.equal(valueLabel('en','service','__proto__'),'__proto__');
assert.equal(valueLabel('en','__proto__','toString'),'toString','unexpected categories cannot expose inherited object members');
const canonical=['Inspektion & Wartung','Diagnose & Elektronik'];
const labels=displayLabels('en','service',canonical);
assert.deepEqual(canonical,['Inspektion & Wartung','Diagnose & Elektronik'],'labels do not mutate submitted values');
assert.deepEqual(Object.keys(labels),canonical,'Picker values keep canonical map keys');
assert.deepEqual(Object.values(labels),['Inspection & maintenance','Diagnostics & electronics']);
const {formatNumber,formatDate}=await load('format');
assert.equal(formatNumber('de',1234.5),'1.234,5');
assert.equal(formatNumber('en',1234.5),'1,234.5');
assert.equal(formatNumber('sq',1234.5),'1234,5');
assert.equal(formatNumber('sq',12345.5),'12\u00a0345,5');
assert.equal(formatNumber('sq',9999.9999),'10\u00a0000','rounding carries into the Albanian grouping threshold');
assert.equal(formatDate('en','2026-01-01T23:30:00Z'),'02/01/2026','Kosovo timestamps use Europe/Belgrade');
assert.equal(formatDate('en','2026-10-25',{dateOnly:true}),'25/10/2026','a date-only value keeps its calendar day');
assert.equal(formatDate('de','2026-01-01',{dateOnly:true}),'01.01.2026');
assert.equal(formatDate('sq','2026-01-01',{dateOnly:true}),'01.01.2026');
assert.equal(formatDate('en','2026-02-30',{dateOnly:true}),'—','invalid calendar dates are not normalized into another day');
assert.equal(formatDate('en','invalid'),'—');
assert.equal(formatNumber('sq',NaN),'—');
const {errorCodeMessage,messageCodeMessage}=await load('codes');
assert.equal(errorCodeMessage(createTranslator(getMessages('en')),'authentication_required'),'Please log in.');
assert.equal(errorCodeMessage(createTranslator(getMessages('sq')),'forbidden'),'Nuk ke leje për këtë veprim.');
assert.equal(messageCodeMessage(createTranslator(getMessages('de')),'saved'),'Änderungen gespeichert.');
for(const locale of ['de','sq','en']){
 const messages=getMessages(locale),t=createTranslator(messages);
 for(const code of ['provider raw error with personal data','__proto__',{},null]){
  assert.equal(errorCodeMessage(t,code),messages.common.errorGeneric,'unknown error codes never reveal raw provider content');
  assert.equal(messageCodeMessage(t,code),messages.common.messageGeneric);
 }
 assert.equal(messageCodeMessage(t,'preference_not_saved'),messages.common.preferenceNotSaved);
}
console.log('i18n message contracts passed');
