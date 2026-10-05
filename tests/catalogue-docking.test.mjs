import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {JSDOM,VirtualConsole} from 'jsdom';

const dom=new JSDOM('<div id="root"></div>',{url:'https://riparim.example.test/werkstaetten',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
for(const key of ['window','document','navigator','HTMLElement','HTMLButtonElement','HTMLFormElement','HTMLInputElement','HTMLSelectElement','Option','DocumentFragment','Element','Node','NodeFilter','MutationObserver','CustomEvent','Event','MouseEvent','KeyboardEvent','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let width=689,height=988,sentinelTop=120;
function matches(query){
 const colon=[...query.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)].every(([,limit,axis,value])=>limit==='max'?(axis==='width'?width:height)<=Number(value):(axis==='width'?width:height)>=Number(value));
 const range=[...query.matchAll(/\(\s*(width|height)\s*(<=|>=|<|>)\s*(\d+)px\s*\)/g)].every(([,axis,operator,value])=>{const actual=axis==='width'?width:height;return operator==='<='?actual<=Number(value):operator==='>='?actual>=Number(value):operator==='<'?actual<Number(value):actual>Number(value);});
 return colon&&range;
}
window.matchMedia=query=>({matches:matches(query),media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
HTMLElement.prototype.getBoundingClientRect=function(){return {top:sentinelTop,bottom:sentinelTop+1,left:16,right:width-16,width:width-32,height:1};};
const observers=[];
globalThis.IntersectionObserver=class{
 constructor(callback,options){this.callback=callback;this.options=options;observers.push(this);}
 observe(target){this.target=target;}
 disconnect(){this.disconnected=true;}
 emit(top,isIntersecting){sentinelTop=top;this.callback([{target:this.target,isIntersecting,boundingClientRect:this.target.getBoundingClientRect()}]);}
};
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
globalThis.fetch=async url=>{assert.equal(url,'/api/google-places','Docking fixtures never send live requests');return Response.json({enabled:false});};

const require=createRequire(import.meta.url),{build}=require('esbuild');
const {transform}=createRequire(require.resolve('vite/package.json'))('lightningcss');
const output='.test-runtime/catalogue-docking';await mkdir(output,{recursive:true});
const bundle=await build({stdin:{contents:"export {default as Catalogue} from './app/[locale]/werkstaetten/catalogue';export {defaultCatalogueFilters} from './lib/catalogue-filters';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",resolveDir:process.cwd(),loader:'tsx'},outfile:output+'/ui.mjs',bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'navigation-boundary',setup(b){
 b.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',resolveDir:process.cwd(),contents:args.path==='next/link'?"import React from 'react';export default function Link({children,href,...props}){return React.createElement('a',{...props,href},children);}":"export function useRouter(){return {push(){},replace(){},refresh(){}};}export function useSearchParams(){return new URLSearchParams();}export function usePathname(){return '/werkstaetten';}"}));
}}]});await writeFile(output+'/ui.mjs',bundle.outputFiles[0].contents);
const {createElement,act}=await import('react'),{createRoot}=await import('react-dom/client');
const {Catalogue,defaultCatalogueFilters,I18nProvider,getMessages}=await import(new URL('../'+output+'/ui.mjs',import.meta.url));
const files=['globals.css','ui-refresh.css','site-header.css','catalogue.css','form-controls.css','theme.css'];
const css=(await Promise.all(files.map(file=>readFile(new URL('../app/'+file,import.meta.url),'utf8')))).join('\n').replace(/^@(?:import|custom-variant).*;$/gm,'').replace(/@theme inline\{[^}]*\}/g,'');
const production=transform({filename:'catalogue.css',code:Buffer.from(css),minify:true}).code.toString().replace(/[^{}]*:is\(\)\{[^}]*\}/g,'');
function viewportCss(source){
 const fixture=new JSDOM(`<style>${source}</style>`,{virtualConsole:new VirtualConsole()});
 const flatten=rules=>[...rules].map(rule=>rule.type===4?(matches(rule.conditionText)?flatten(rule.cssRules):''):rule.type===1?rule.cssText:'').join('\n');
 const result=flatten(fixture.window.document.styleSheets[0].cssRules);fixture.window.close();return result;
}
const styleElement=document.createElement('style');document.head.append(styleElement);
function styles(source=css){styleElement.textContent=viewportCss(source);}
// jsdom has no layout engine. Resolve the public CSS dimensions to check the
// frame/controls contract; the companion live browser QA measures real rectangles.
function resolved(style,key){
 const scratch=document.createElement('div').style;
 scratch[key]=style[key].replace(/var\((--[\w-]+)\)/g,(_,token)=>getComputedStyle(document.documentElement).getPropertyValue(token));
 return scratch[key];
}
const pixels=value=>parseFloat(value.replace(/^calc\((.*)\)$/,'$1'))||0;
function geometry(style){
 const gutter=pixels(getComputedStyle(document.documentElement).getPropertyValue('--page-gutter')),parentWidth=width-2*gutter;
 const frameWidth=resolved(style,'width'),percentage=frameWidth.match(/([\d.]+)%/),addition=frameWidth.match(/([+-])\s*([\d.]+)px/);
 const actualWidth=percentage?parentWidth*Number(percentage[1])/100+(addition?Number(addition[2])*(addition[1]==='-'?-1:1):0):parentWidth;
 const left=gutter+pixels(resolved(style,'marginInline')||style.marginLeft);
 const padding=pixels(resolved(style,'paddingInline')||style.paddingLeft),border=pixels(style.borderLeftWidth);
 return {left,right:left+actualWidth,controlsLeft:left+padding+border,controlsWidth:actualWidth-2*(padding+border),paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,gap:style.gap};
}
const root=createRoot(document.getElementById('root'));
const panel=()=>document.querySelector('[aria-label="Werkstätten suchen"]');
let cases=0;
try{
 styles();
 await act(async()=>root.render(createElement(I18nProvider,{locale:'de',messages:getMessages('de',['common','public'])},createElement(Catalogue,{initialWorkshops:[],initialError:'',initialFilters:defaultCatalogueFilters,signedIn:false,account:null,isAdmin:false}))));
 const observer=observers.at(-1);
 assert(observer,'The mobile search detects when it reaches the site header');
 assert.equal(observer.options.root,document,'Docking measures the viewport of the search document, including embedded previews');
 await act(async()=>observer.emit(69,false));
 const docked=getComputedStyle(panel());
 assert.equal(docked.borderTopLeftRadius,'0px','The docked search joins the header without a rounded top left corner');
 assert.equal(docked.borderTopRightRadius,'0px','The docked search joins the header without a rounded top right corner');
 const name=panel().querySelector('input[type="search"]');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(name,'Fixture search');name.dispatchEvent(new Event('input',{bubbles:true}));});
 for(const source of [css,production])for(const dark of [false,true])for(const viewportWidth of [320,390,689,720]){
  width=viewportWidth;height=988;sentinelTop=120;document.documentElement.classList.toggle('dark',dark);styles(source);
  await act(async()=>window.dispatchEvent(new Event('resize')));
  const before=getComputedStyle(panel()),normal=geometry(before),headerHeight=pixels(getComputedStyle(document.documentElement).getPropertyValue('--site-header-height'));
  assert.equal(before.borderRadius,'12px','The normal search preserves its rounded panel');
  assert.equal(normal.left,16,'The normal search keeps the page gutter');
  name.focus();
  await act(async()=>observers.at(-1).emit(headerHeight-1,false));
  const style=getComputedStyle(panel()),after=geometry(style);
  assert.equal(after.left,0,'The docked frame reaches the left viewport edge');
  assert.equal(after.right,width,'The docked frame reaches the right edge without horizontal overflow');
  assert.deepEqual({...after,left:normal.left,right:normal.right},normal,'Docking preserves the controls position, available width and vertical spacing');
  assert.equal(style.position,'sticky');assert.equal(pixels(resolved(style,'top')),headerHeight,'The docked search sits directly below the responsive header');
  assert.equal(pixels(style.borderTopLeftRadius||style.borderRadius),0);assert.equal(pixels(style.borderTopRightRadius||style.borderRadius),0);
  assert.equal(style.borderBottomLeftRadius||style.borderRadius,'12px','Docking preserves the bottom corners');
  assert.equal(document.activeElement,name,'Docking preserves keyboard focus');assert.equal(name.value,'Fixture search','Docking preserves the active query');
  for(const label of ['Ort','Leistung'])assert(panel().querySelector(`[role="combobox"][aria-label="${label}"]`),'The docked search retains labelled location/service controls');
  assert(panel().querySelector('[aria-label="Weitere Filter"]'),'The docked search retains the advanced filter action');
  await act(async()=>observers.at(-1).emit(headerHeight+24,true));
  assert.deepEqual(geometry(getComputedStyle(panel())),normal,'Releasing restores the original frame without changing the controls');
  assert.equal(getComputedStyle(panel()).borderTopLeftRadius||getComputedStyle(panel()).borderRadius,'12px','Releasing restores rounded top corners');
  cases++;
 }
 await act(async()=>observers.at(-1).emit(2000,false));
 assert.equal(panel().dataset.docked,'false','A search panel below the viewport is not treated as docked');
 for(const source of [css,production])for(const [viewportWidth,viewportHeight] of [[721,988],[1280,988],[689,600],[390,520]]){
  width=viewportWidth;height=viewportHeight;sentinelTop=0;styles(source);
  await act(async()=>window.dispatchEvent(new Event('resize')));
  assert.equal(panel().dataset.docked,'false','Desktop and short viewports release the docked state');
  assert.notEqual(getComputedStyle(panel()).position,'sticky','Desktop and short viewports preserve the static search');
  assert.equal(getComputedStyle(panel()).borderTopLeftRadius||getComputedStyle(panel()).borderRadius,'12px');
 }
 console.log(JSON.stringify({catalogueDockingCasesPassed:cases,sourceAndProduction:true,liveRequests:false}));
}finally{await act(async()=>root.unmount());dom.window.close();}
