import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

// Export only. This command has no provider credentials or network writes.
const options=new Map();for(let i=2;i<process.argv.length;i+=2){if(!['--site-origin','--provider-site-url','--output-dir'].includes(process.argv[i])||!process.argv[i+1]||options.has(process.argv[i]))throw Error('Use --site-origin ORIGIN --provider-site-url ACTUAL_SITE_URL --output-dir NEW_DIRECTORY');options.set(process.argv[i],process.argv[i+1]);}
if(options.size!==3)throw Error('Use --site-origin ORIGIN --provider-site-url ACTUAL_SITE_URL --output-dir NEW_DIRECTORY');
const root=fileURLToPath(new URL('../',import.meta.url));
const bundle=await build({stdin:{contents:"export * from './lib/auth/email-templates';export {authCallbackUrl} from './lib/auth/locale';export {emailCopy,emailText} from './lib/email-content';",resolveDir:root,loader:'ts'},bundle:true,format:'esm',platform:'node',write:false});
const templates=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
const providerSiteURL=options.get('--provider-site-url'),origin=templates.validateAuthEmailOrigins(options.get('--site-origin'),providerSiteURL);
const sources={
 'confirmation.subject.txt':templates.confirmationEmailSubject,'confirmation.body.html':templates.confirmationEmailTemplate,
 'recovery.subject.txt':templates.recoveryEmailSubject,'recovery.body.html':templates.recoveryEmailTemplate,
};
const fixtures=[],previews=[];
for(const kind of ['confirmation','recovery'])for(const locale of ['de','sq','en']){
 const callback=templates.authCallbackUrl(origin,locale,kind==='recovery'?'/passwort-neu':'/werkstatt/fixture-workshop#bewerten');
 fixtures.push({Subject:sources[kind+'.subject.txt'],Body:sources[kind+'.body.html'],Data:{SiteURL:providerSiteURL,RedirectTo:callback,TokenHash:'synthetic-preview-token'}});previews.push({kind,locale});
}
const binary=process.env.RIPARIM_GO_BINARY||'go',goVersion=execFileSync(binary,['version'],{encoding:'utf8'}).trim();
const rendered=JSON.parse(execFileSync(binary,['run',join(root,'scripts/render-auth-email-templates.go')],{input:JSON.stringify(fixtures),encoding:'utf8',env:{...process.env,GOTOOLCHAIN:'local',GOPROXY:'off',GOSUMDB:'off'},maxBuffer:8*1024*1024}));
for(const [index,result] of rendered.entries()){
 const preview=previews[index];preview.renderedLocale=result.body.match(/<html lang="(de|sq|en)"/)?.[1];
 if(preview.renderedLocale!==preview.locale)throw Error('AUTH_EMAIL_LOCALE_RENDER_MISMATCH');
 sources[`${preview.kind}-${preview.locale}.html`]=result.body;
 sources[`${preview.kind}-${preview.locale}.subject.txt`]=result.subject;
 const link=result.body.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&');
 sources[`${preview.kind}-${preview.locale}.preview.txt`]=templates.emailText(templates.emailCopy[preview.locale][preview.kind],link);
}
const directory=options.get('--output-dir');await mkdir(directory,{mode:0o700});
const checksums={};for(const [name,source] of Object.entries(sources)){await writeFile(join(directory,name),source,{mode:0o600});checksums[name]=createHash('sha256').update(source).digest('hex');}
const manifest={siteOrigin:origin,providerSiteURL,actualGoHtmlTemplate:true,goVersion,previews,checksums,productionChanged:false,syntheticTokensOnly:true,textPlainPreviewOnly:true};
await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({exportedDirectory:directory,actualGoHtmlTemplate:true,previews:previews.length,productionChanged:false}));
