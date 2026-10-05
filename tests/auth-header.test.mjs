import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const {build}=createRequire(new URL('../package.json',import.meta.url))('esbuild');
const dropdown=`import {createElement} from 'react';
 const Wrapper=({children})=>createElement('div',null,children);
 export const DropdownMenu=Wrapper,DropdownMenuTrigger=Wrapper,DropdownMenuContent=Wrapper,DropdownMenuLabel=Wrapper,DropdownMenuSeparator=()=>null;
 export function DropdownMenuItem({children,asChild,onSelect}){return asChild?children:createElement('div',{'data-session-logout':onSelect?'true':undefined},children);}`;
const bundle=await build({entryPoints:['components/site-header.tsx'],bundle:true,format:'esm',platform:'node',jsx:'automatic',outfile:'.test-runtime/auth-header/site-header.mjs',write:false,external:['react','react/jsx-runtime','lucide-react'],plugins:[{name:'render-boundaries',setup(b){
 b.onResolve({filter:/^(next\/link|@\/components\/ui\/dropdown-menu|\.\/brand|\.\/theme-toggle)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='next/link'?"import {createElement} from 'react'; export default function Link({href,children}){return createElement('a',{href},children);}":args.path.includes('dropdown-menu')?dropdown:args.path==='./brand'?"export function Brand(){return null;}":"export function ThemeToggle(){return null;}",loader:'js'}));
}}]});
await mkdir('.test-runtime/auth-header',{recursive:true});
await writeFile(bundle.outputFiles[0].path,bundle.outputFiles[0].contents);
const {SiteHeader}=await import(pathToFileURL(bundle.outputFiles[0].path).href);
const render=provider=>renderToStaticMarkup(createElement(SiteHeader,{account:{displayName:'Fixture customer',email:'customer@example.test',provider}}));

for(const provider of ['Google','E-Mail']){
 const html=render(provider);
 assert(!html.includes('/signout-with-chatgpt'),`${provider} logout must use the Supabase session action`);
 assert.match(html,/data-session-logout="true"/);
 assert.match(html,/Abmelden/);
}
const legacy=render('ChatGPT');
assert.match(legacy,/href="\/signout-with-chatgpt\?return_to=%2Fanmelden"/);
assert(!legacy.includes('data-session-logout="true"'));
console.log('Account header: Google and email use session logout; ChatGPT uses native logout');
