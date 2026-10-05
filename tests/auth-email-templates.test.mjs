import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {renderAuthEmails} from './helpers/auth-email-render.mjs';

const bundle=await build({stdin:{contents:"export * from './lib/auth/email-templates';export {emailHtml} from './lib/email-content';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
await mkdir('.test-runtime/auth-email-templates',{recursive:true});await writeFile('.test-runtime/auth-email-templates/templates.mjs',bundle.outputFiles[0].contents);
const templates=await import(new URL('../.test-runtime/auth-email-templates/templates.mjs',import.meta.url));
const origin='https://riparim.example.test',token='fixture&"<token>';
const cases=[...['de','sq','en'].map(locale=>({name:locale,locale,redirect:`${origin}/auth/bestaetigen?locale=${locale}&weiter=%2F${locale}%2Fpasswort-neu`})),
 {name:'empty',locale:'de',redirect:''},{name:'short',locale:'de',redirect:'x'},
 {name:'legacy',locale:'de',redirect:origin+'/auth/bestaetigen?weiter=%2F'},
 {name:'wrong origin',locale:'de',redirect:'https://other.example.test/auth/bestaetigen?locale=sq&weiter=%2F'},
 {name:'slash redirect',locale:'de',redirect:origin+'//auth/bestaetigen?locale=sq&weiter=%2F'},
 {name:'no ampersand',locale:'de',redirect:origin+'/auth/bestaetigen?locale=en'},
 {name:'locale prefix attack',locale:'de',redirect:origin+'/auth/bestaetigen?locale=english&weiter=%2F'},
 {name:'wrong order',locale:'de',redirect:origin+'/auth/bestaetigen?weiter=%2F&locale=sq'},
 {name:'trailing site slash',locale:'de',site:origin+'/',redirect:origin+'/auth/bestaetigen?locale=sq&weiter=%2F'}];
const subjects={confirmation:{de:'Bestätige deine E-Mail-Adresse bei Riparim',sq:'Konfirmo adresën tënde të emailit në Riparim',en:'Confirm your email address for Riparim'},recovery:{de:'Setze dein Riparim-Passwort zurück',sq:'Rivendos fjalëkalimin tënd të Riparim',en:'Reset your Riparim password'}};
const fixtures=Object.keys(subjects).flatMap(kind=>cases.map(entry=>({Subject:templates[kind+'EmailSubject']??'MISSING SUBJECT',Body:templates[kind+'EmailTemplate'],Data:{SiteURL:entry.site??origin,RedirectTo:entry.redirect,TokenHash:token}})));
const rendered=renderAuthEmails(fixtures);let passed=0;
for(const [index,result] of rendered.entries()){
 const kind=Object.keys(subjects)[Math.floor(index/cases.length)],entry=cases[index%cases.length];
 assert.equal(result.subject,subjects[kind][entry.locale],kind+' '+entry.name+' subject');passed++;
 const dom=new JSDOM(result.body),doc=dom.window.document;
 assert.equal(doc.documentElement.lang,entry.locale);assert.equal(doc.documentElement.dir,'ltr');passed+=2;
 assert.equal(doc.querySelector('title').textContent,result.subject);assert.equal(doc.querySelectorAll('h1').length,1);passed+=2;
 for(const child of doc.body.children){assert.equal(child.lang,entry.locale);assert.equal(child.dir,'ltr');passed+=2;}
 const link=doc.querySelector('a');assert(link.textContent.trim().length>10);assert(!result.body.includes('<token>'));passed+=2;
 if(entry.redirect.includes('?')){const url=new URL(link.href,origin);assert.equal(url.searchParams.get('token_hash'),token);assert.equal(url.searchParams.get('type'),kind==='confirmation'?'signup':'recovery');passed+=2;}
 assert(!result.body.includes('ZgotmplZ'));passed++;dom.window.close();
}
assert.equal(templates.validateAuthEmailOrigins(origin,origin),origin);passed++;
for(const site of [origin+'/',origin+'/path',origin+'?x=1',origin+'#fragment','https://other.example.test','https://user:password@riparim.example.test']){assert.throws(()=>templates.validateAuthEmailOrigins(origin,site),/AUTH_EMAIL_ORIGIN/);passed++;}
assert.throws(()=>templates.validateAuthEmailOrigins(origin+'/',origin),/AUTH_EMAIL_ORIGIN/);passed++;
const specialCopy={title:'<script>unsafe</script> & Ç Ë',copy:'<b>Original & text</b>',action:'Open "protected" link',note:"Don't <img>"},specialUrl=origin+'/?value="<&';
const escaped=new JSDOM(templates.emailHtml('sq',specialCopy,specialUrl));
assert.equal(escaped.window.document.querySelector('h1').textContent,specialCopy.title);assert.equal(escaped.window.document.querySelector('script,img,b'),null);assert.equal(escaped.window.document.querySelector('a').getAttribute('href'),specialUrl);passed+=3;escaped.window.close();
const luminance=hex=>{const rgb=hex.match(/[0-9a-f]{2}/gi).map(part=>parseInt(part,16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};
const contrast=(first,second)=>{const a=luminance(first),b=luminance(second);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);};
for(const result of rendered.slice(0,3)){
 const dom=new JSDOM(result.body),doc=dom.window.document,action=doc.querySelector('a'),style=doc.querySelector('style').sheet;
 const light=(color)=>color.startsWith('#')?color.slice(1):color.match(/\d+/g).slice(0,3).map(value=>Number(value).toString(16).padStart(2,'0')).join('');
 assert(contrast(light(doc.body.style.color),light(doc.body.style.background))>=4.5);assert(contrast(light(action.style.color),light(action.style.background))>=4.5);passed+=2;
 for(const rule of style.cssRules[0].cssRules){const color=rule.style.getPropertyValue('color'),background=rule.style.getPropertyValue('background');assert(contrast(color,background)>=4.5);passed++;}
 dom.window.close();
}
console.log(JSON.stringify({authEmailGoChecksPassed:passed,actualGoHtmlTemplate:true,realEmailsSent:false,productionTouched:false}));
