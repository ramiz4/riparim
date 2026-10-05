import {spawnSync} from 'node:child_process';
import {rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=new URL('../.test-runtime/',import.meta.url);
const suites=['auth-email-templates.test.mjs','auth-email-export.test.mjs','customer-localization-ui.test.mjs','customer-metadata.test.mjs','i18n-native-auth.test.mjs','i18n-whatsapp-guard.test.mjs','i18n-collation.test.mjs','i18n-public.test.mjs','i18n-public-ui.test.mjs','i18n-google-lifecycle.test.mjs','i18n-google.test.mjs','i18n-routing.test.mjs','i18n-navigation.test.mjs','i18n-switcher.test.mjs','i18n-messages.test.mjs','rolldown-navigation.test.mjs','release-policy.test.mjs','repository-policy.test.mjs','sites-release.test.mjs','local-dev-config.test.mjs','migration-export.test.mjs','data-transfer.test.mjs','data-delta.test.mjs','apply-delta-d1.test.mjs','import-d1.test.mjs','export-source.test.mjs','cloudflare-request.test.mjs','cloudflare-deploy.test.mjs','combined-reviews.test.mjs','evidence-fencing.test.mjs','auth-ownership.test.mjs','google-auth.test.mjs','auth-header.test.mjs','site-header-layout.test.mjs','brand-navigation.test.mjs','footer-ui.test.mjs','theme-toggle-styles.test.mjs','form-control-styles.test.mjs','user-management.test.mjs','account-settings.test.mjs','account-settings-ui.test.mjs','business.test.mjs','business-ui.test.mjs','notifications.test.mjs','notification-runtime.test.mjs','notification-ui.test.mjs','notification-link-ui.test.mjs','admin-roles-ui.test.mjs','user-management-ui.test.mjs','email-activation.test.mjs','catalogue-filters.test.mjs','catalogue-docking.test.mjs','profile-navigation.test.mjs','admin-menu.test.mjs','admin-workshops-ui.test.mjs','workshop-import.test.mjs','workshop-source.test.mjs','workshop-retirement.test.mjs','google-places.test.mjs','workshop-profile.test.mjs'];

try{
 await rm(runtime,{recursive:true,force:true});
 const contract=spawnSync(process.execPath,['scripts/check-i18n.mjs'],{cwd:root,stdio:'inherit'});if(contract.status!==0)throw Error('i18n contract check failed');
 for(const suite of suites){
  console.log(`\nRunning ${suite}`);
  const result=spawnSync(process.execPath,[fileURLToPath(new URL(suite,import.meta.url))],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0){process.exitCode=result.status??1;break;}
 }
}finally{
 await rm(runtime,{recursive:true,force:true});
}
