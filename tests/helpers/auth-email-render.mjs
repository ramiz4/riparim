import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function renderAuthEmails(fixtures){
 const program=fileURLToPath(new URL('../../scripts/render-auth-email-templates.go',import.meta.url));
 try{return JSON.parse(execFileSync(process.env.RIPARIM_GO_BINARY||'go',['run',program],{input:JSON.stringify(fixtures),encoding:'utf8',env:{...process.env,GOTOOLCHAIN:'local',GOPROXY:'off',GOSUMDB:'off'},maxBuffer:8*1024*1024}));}
 catch(error){throw new Error('Actual Go html/template rendering failed. Install the CI Go version or set RIPARIM_GO_BINARY to its executable.',{cause:error});}
}
