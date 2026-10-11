import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';

const require=createRequire(import.meta.url);
const {transform}=createRequire(require.resolve('vite/package.json'))('lightningcss');
const css=await readFile(new URL('../app/ratings.css',import.meta.url),'utf8');
const production=transform({filename:'ratings.css',code:Buffer.from(css),minify:true}).code.toString();
for(const [variant,styles] of [['source',css],['production',production]]){
 for(const dark of [false,true]){
  const dom=new JSDOM(`<html class="${dark?'dark':''}"><style>${styles}</style><div class="profile-google-reviews"><div class="google-reviews-panel"><div class="google-official-widget"><gmp-advanced-place-details><gmp-place-reviews></gmp-place-reviews><gmp-place-attribution></gmp-place-attribution></gmp-advanced-place-details></div></div></div></html>`);
  try{
   const widget=dom.window.document.querySelector('gmp-advanced-place-details');
   const style=dom.window.getComputedStyle(widget);
   for(const size of ['large','medium','extra-large','two-extra-large']){
    const spacing=style.getPropertyValue(`--gmp-mat-spacing-${size}`).trim();
    assert(!spacing||parseFloat(spacing)>=16,`${variant}, dark=${dark}: Google header and review content must retain the provider's normal inset (${size}=${spacing})`);
   }
   assert.equal(style.width,'100%','the provider fits narrow profile columns');
   assert.equal(style.maxWidth,'none','the provider can fill a desktop profile column');
   assert(widget.querySelector('gmp-place-attribution'),'provider attribution remains inside the native widget');
  }finally{dom.window.close();}
 }
}
console.log('Google review box: normal provider insets survive source and production CSS in both themes');
