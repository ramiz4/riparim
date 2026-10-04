import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';

const require=createRequire(import.meta.url);
// Use the same minifier supplied by the project's locked Vite dependency.
const {transform}=createRequire(require.resolve('vite/package.json'))('lightningcss');
const css=await readFile(process.argv[2]??new URL('../app/theme.css',import.meta.url),'utf8');
const start=css.indexOf('.theme-control'),end=css.indexOf('.footer>a');
assert(start>=0&&end>start,'the shared toggle styles are present');
const theme=css.slice(start,end);
const primitive=await readFile(new URL('../app/form-controls.css',import.meta.url),'utf8');
const source='*{box-sizing:border-box}'+primitive+theme;
const minified=transform({filename:'theme.css',code:Buffer.from(source),minify:true}).code.toString();

function offset(style,width){
 const translate=style.translate.startsWith('calc(')?width-2:parseFloat(style.translate)||0;
 const transform=parseFloat(style.transform.match(/^translate(?:X)?\(([-.\d]+)/)?.[1]??'0');
 return translate+transform;
}

for(const [variant,styles] of [['source',source],['production',minified]]){
 for(const [dark,checked,mounted] of [[false,false,true],[true,true,true],[true,false,false],[false,false,false]]){
  const state=checked?'checked':'unchecked';
  const dom=new JSDOM(`<html class="${dark?'dark':''}"><head><style>${styles}</style></head><body><div class="theme-control" data-mounted="${mounted}"><span class="theme-switch-shell"><button class="theme-switch" data-slot="switch" data-state="${state}"><span data-slot="switch-thumb" data-state="${state}"></span></button><span class="theme-switch-glyph"></span></span></div></body></html>`);
  try{
   const style=selector=>dom.window.getComputedStyle(dom.window.document.querySelector(selector));
   const track=style('.theme-switch'),thumb=style('[data-slot=switch-thumb]'),glyph=style('.theme-switch-glyph');
   const inset=parseFloat(track.borderLeftWidth)+parseFloat(track.paddingLeft);
   const thumbWidth=parseFloat(thumb.width),trackWidth=parseFloat(track.width);
   const thumbLeft=inset+offset(thumb,thumbWidth);
   const glyphLeft=parseFloat(glyph.left)+offset(glyph,parseFloat(glyph.width));
   const context=`${variant}: dark=${dark}, checked=${checked}, mounted=${mounted}`;
   assert(thumbLeft>=inset&&thumbLeft+thumbWidth<=trackWidth-inset,`${context}: thumb stays inside the pill`);
   assert.equal(thumbLeft+thumbWidth/2,glyphLeft+parseFloat(glyph.width)/2,`${context}: icon remains centered on the thumb`);
  }finally{dom.window.close();}
 }
}
console.log('Theme toggle styles: source and production keep the thumb contained and icon centered in both themes and before hydration');
