import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
// Node scripts consume the same TypeScript route contract as the app and Worker.
const result=await build({entryPoints:[fileURLToPath(new URL('../../lib/i18n/locale.ts',import.meta.url))],bundle:true,format:'esm',platform:'node',write:false});
export const {localizeHref}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
