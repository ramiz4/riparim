import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';

const require=createRequire(import.meta.url);
const {build}=require('esbuild');
const {transform}=createRequire(require.resolve('vite/package.json'))('lightningcss');
const bundle=await build({
 entryPoints:['components/ui/checkbox.tsx','components/ui/switch.tsx'],
 outdir:'.test-runtime/form-controls',outExtension:{'.js':'.mjs'},
 bundle:true,format:'esm',platform:'node',jsx:'automatic',
 external:['react','react/jsx-runtime','react-dom','radix-ui','lucide-react'],
});
assert.equal(bundle.errors.length,0);
const {Checkbox}=await import(pathToFileURL('.test-runtime/form-controls/checkbox.mjs').href);
const {Switch}=await import(pathToFileURL('.test-runtime/form-controls/switch.mjs').href);
const files=['globals.css','ui-refresh.css','auth.css','catalogue.css','workshop-pages.css','ratings.css','form-controls.css','theme.css','[locale]/verwaltung/benutzer/users.css'];
const css=(await Promise.all(files.map(file=>readFile(new URL(`../app/${file}`,import.meta.url),'utf8'))))
 .join('\n').replace(/^@(?:import|custom-variant).*;$/gm,'').replace(/@theme inline\{[^}]*\}/g,'');
// Empty :is() rules from unrelated pseudo-element selectors never match in a
// browser, but jsdom rejects them. They have no bearing on control styles.
const production=transform({filename:'controls.css',code:Buffer.from(css),minify:true}).code.toString()
 .replace(/[^{}]*:is\(\)\{[^}]*\}/g,'');

// jsdom does not resolve custom properties in border shorthands. Resolve the
// application's own theme tokens before measuring; browsers resolve them natively.
function resolveTokens(styles,dark){
 const tokens={};
 for(const [,selector,declarations] of css.matchAll(/(:root|html\.dark)\s*\{([^}]+)\}/g)){
  if(selector==='html.dark'&&!dark)continue;
  for(const [,name,value] of declarations.matchAll(/(--[\w-]+):\s*([^;]+)/g))tokens[name]=value.trim();
 }
 return styles.replace(/var\((--[\w-]+)\)/g,(match,name)=>tokens[name]??match);
}
function movement(style,width){
 const translate=style.translate.startsWith('calc(')?width-2:parseFloat(style.translate)||0;
 const transform=parseFloat(style.transform.match(/^translate(?:X)?\(([-.\d]+)/)?.[1]??'0');
 return translate+transform;
}
function markup(checked,size,context){
 return renderToStaticMarkup(createElement('label',{className:context},
  createElement(Switch,{checked,size,'aria-label':'Activation'}),createElement('span',null,'Activation')));
}
for(const [variant,styles] of [['source',css],['production',production]]){
 for(const dark of [false,true]){
  for(const context of ['', 'activation-switch', 'activation-switch users-activation']){
   for(const size of ['default','sm']){
    for(const checked of [false,true]){
     const dom=new JSDOM(`<html class="${dark?'dark':''}"><style>${resolveTokens(styles,dark)}</style><form class="journey-form">${markup(checked,size,context)}</form></html>`);
     try{
      const get=selector=>dom.window.getComputedStyle(dom.window.document.querySelector(selector));
      const track=get('[data-slot=switch]'),thumb=get('[data-slot=switch-thumb]');
      const inset=parseFloat(track.borderLeftWidth)+parseFloat(track.paddingLeft);
      const trackWidth=parseFloat(track.width),thumbWidth=parseFloat(thumb.width);
      const left=inset+movement(thumb,thumbWidth);
      const message=`${variant}, dark=${dark}, context=${context}, size=${size}, checked=${checked}`;
      assert(left>=inset&&left+thumbWidth<=trackWidth-inset,`${message}: thumb stays inside track`);
      assert.equal(left,checked?trackWidth-inset-thumbWidth:inset,`${message}: thumb reaches the correct end`);
      const expected=dom.window.document.createElement('span');
      expected.style.backgroundColor=resolveTokens(checked?'var(--primary)':'var(--input)',dark);
      assert.equal(track.backgroundColor,expected.style.backgroundColor,`${message}: state remains visible`);
     }finally{dom.window.close();}
    }
   }
  }
  for(const context of ['', 'consent', 'service-checkboxes']){
   for(const checked of [false,true,'indeterminate']){
    const html=renderToStaticMarkup(createElement('label',{className:context},createElement(Checkbox,{checked,'aria-label':'Consent'})));
    const dom=new JSDOM(`<html class="${dark?'dark':''}"><style>${resolveTokens(styles,dark)}</style><form class="journey-form">${html}</form></html>`);
    try{
     const node=dom.window.document.querySelector('[data-slot=checkbox]'),style=dom.window.getComputedStyle(node);
     const message=`${variant}, dark=${dark}, context=${context}, checked=${checked}`;
     assert.equal(style.width,'19px',`${message}: checkbox has a consistent width`);
     assert.equal(style.height,'19px');assert.equal(style.padding,'0px');
     assert.equal(node.getAttribute('role'),'checkbox');
     assert.equal(node.getAttribute('aria-checked'),checked==='indeterminate'?'mixed':String(checked));
     const expected=dom.window.document.createElement('span');
     expected.style.backgroundColor=resolveTokens(checked?'var(--primary)':'var(--background)',dark);
     assert.equal(style.backgroundColor,expected.style.backgroundColor,`${message}: state remains visible`);
     assert.equal(style.borderLeftStyle,'solid');assert(parseFloat(style.borderLeftWidth)>0);
     if(checked){
      const check=dom.window.getComputedStyle(node.querySelector('[data-slot=checkbox-check]'));
      const mixed=dom.window.getComputedStyle(node.querySelector('[data-slot=checkbox-mixed]'));
      assert.equal(check.display==='none',checked==='indeterminate',`${message}: correct state icon`);
      assert.equal(mixed.display==='none',checked!=='indeterminate');
     }
    }finally{dom.window.close();}
   }
  }
 }
}
console.log('Shared form controls: source and production contain both switch sizes in all forms and themes; checkbox states and reuse passed');
