import {runSuites} from './helpers/suite-runner.mjs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=new URL('../.test-runtime/',import.meta.url);
const suites=['worker-runtime.test.mjs','public-review-refresh.test.mjs','catalogue-release-plan.test.mjs','daily-workshop-import.test.mjs','auth-email-templates.test.mjs','auth-email-export.test.mjs','customer-localization-ui.test.mjs','customer-metadata.test.mjs','i18n-native-auth.test.mjs','i18n-whatsapp-guard.test.mjs','i18n-collation.test.mjs','i18n-public.test.mjs','i18n-public-ui.test.mjs','i18n-google-lifecycle.test.mjs','i18n-google.test.mjs','i18n-routing.test.mjs','i18n-navigation.test.mjs','i18n-switcher.test.mjs','i18n-messages.test.mjs','rolldown-navigation.test.mjs','release-policy.test.mjs','repository-policy.test.mjs','sites-release.test.mjs','local-dev-config.test.mjs','migration-export.test.mjs','data-transfer.test.mjs','data-delta.test.mjs','apply-delta-d1.test.mjs','import-d1.test.mjs','export-source.test.mjs','cloudflare-request.test.mjs','cloudflare-deploy.test.mjs','review-entry.test.mjs','combined-reviews.test.mjs','evidence-fencing.test.mjs','auth-provider.test.mjs','pocketbase-auth.test.mjs','auth-ownership.test.mjs','google-auth.test.mjs','auth-header.test.mjs','site-header-layout.test.mjs','brand-navigation.test.mjs','footer-ui.test.mjs','theme-toggle-styles.test.mjs','form-control-styles.test.mjs','user-management.test.mjs','account-settings.test.mjs','account-settings-ui.test.mjs','business.test.mjs','business-ui.test.mjs','business-claim-ui.test.mjs','business-pages.test.mjs','notifications.test.mjs','notification-runtime.test.mjs','notification-ui.test.mjs','notification-link-ui.test.mjs','my-reviews-page.test.mjs','my-reviews-ui.test.mjs','admin-roles-ui.test.mjs','user-management-ui.test.mjs','email-activation.test.mjs','catalogue-filters.test.mjs','catalogue-google-requests.test.mjs','catalogue-docking.test.mjs','public-performance-ui.test.mjs','profile-navigation.test.mjs','auth-setup-ui.test.mjs','admin-menu.test.mjs','admin-workshops-ui.test.mjs','admin-reviews-ui.test.mjs','workshop-import.test.mjs','workshop-source.test.mjs','workshop-translations.test.mjs','workshop-retirement.test.mjs','google-places.test.mjs','workshop-profile.test.mjs','google-profile-requests.test.mjs','management-localization-ui.test.mjs','management-metadata.test.mjs'];

suites.push('opening-hours.test.mjs');
suites.push('opening-hours-import.test.mjs');
suites.push('workshop-contacts.test.mjs');
suites.push('workshop-emails.test.mjs');
suites.push('workshop-emails-ui.test.mjs');
suites.push('catalogue-drawer-resize.test.mjs');
suites.push('searchable-picker.test.mjs');
suites.push('suite-runner.test.mjs');
suites.push('premium-workshops.test.mjs');
suites.push('premium-partner-ui.test.mjs');
suites.push('workshop-review-styles.test.mjs');
suites.push('google-opening-hours-styles.test.mjs');
suites.push('tool-install.test.mjs');
suites.push('tool-policy.test.mjs');
suites.push('tool-deployment-catalogue.test.mjs');
suites.push('release-retry.test.mjs');
suites.push('node-storage.test.mjs');
suites.push('node-restore.test.mjs');
suites.push('node-runtime.test.mjs');
suites.push('node-release.test.mjs');
suites.push('node-evidence.test.mjs');
suites.push('account-identities.test.mjs');
suites.push('account-identities-worker.test.mjs');
suites.push('mail-transports.test.mjs');
suites.push('smtp-tls.test.mjs');
suites.push('auth-privacy-routing.test.mjs');
suites.push('auth-backup.test.mjs');
suites.push('platform-backup.test.mjs');
suites.push('backup-monitor.test.mjs');
suites.push('backup-monitor-portable.test.mjs');
suites.push('backup-monitor-worker.test.mjs');
suites.push('auth-request-latency.test.mjs');
suites.push('auth-provider-worker.test.mjs');
suites.push('session-cookie-reads.test.mjs');
suites.push('deferred-pages-ui.test.mjs');
process.exitCode=await runSuites({
 cwd:root,runtime,contract:fileURLToPath(new URL('../scripts/check-i18n.mjs',import.meta.url)),
 suites:suites.map(suite=>fileURLToPath(new URL(suite,import.meta.url))),
});
