import {spawnSync} from 'node:child_process';
import {rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=new URL('../.test-runtime/',import.meta.url);
const suites=['release-policy.test.mjs','sites-release.test.mjs','migration-export.test.mjs','data-transfer.test.mjs','export-source.test.mjs','cloudflare-request.test.mjs','cloudflare-deploy.test.mjs','combined-reviews.test.mjs','evidence-fencing.test.mjs','auth-ownership.test.mjs','google-auth.test.mjs','auth-header.test.mjs','brand-navigation.test.mjs','footer-ui.test.mjs','theme-toggle-styles.test.mjs','form-control-styles.test.mjs','user-management.test.mjs','account-settings.test.mjs','account-settings-ui.test.mjs','business.test.mjs','business-ui.test.mjs','notifications.test.mjs','notification-runtime.test.mjs','notification-ui.test.mjs','notification-link-ui.test.mjs','admin-roles-ui.test.mjs','email-activation.test.mjs','catalogue-filters.test.mjs','profile-navigation.test.mjs','admin-menu.test.mjs','workshop-import.test.mjs','workshop-source.test.mjs','google-places.test.mjs','workshop-profile.test.mjs'];

try{
 await rm(runtime,{recursive:true,force:true});
 for(const suite of suites){
  console.log(`\nRunning ${suite}`);
  const result=spawnSync(process.execPath,[fileURLToPath(new URL(suite,import.meta.url))],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0){process.exitCode=result.status??1;break;}
 }
}finally{
 await rm(runtime,{recursive:true,force:true});
}
