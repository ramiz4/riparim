import {
  publicReleaseRender,
  publicReleaseAuthProvider,
} from "@/lib/public-release";
import { PrivacyContent } from "./content";
import { getAppUser, getAdminUser } from "@/app/auth";
import { SiteHeader } from "@/components/site-header";
import { DirectoryFooter } from "@/components/directory-footer";
import { isLocale } from "@/lib/i18n/locale";
import { I18nMessages } from "@/lib/i18n/client";
import { getMessages } from "@/lib/i18n/messages";
import { privacyMessages } from "@/lib/i18n/privacy-messages";
import { publicMetadata } from "@/lib/i18n/public-metadata";
import { siteOrigin, getAuthConfig } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params,
    locale = isLocale(value) ? value : "de",
    text = privacyMessages[locale];
  return publicMetadata(locale, "/datenschutz", siteOrigin(), {
    title: text.metadataTitle,
    description: text.metadataDescription,
  });
}
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params,
    locale = isLocale(value) ? value : "de",
    snapshot = publicReleaseRender(),
    user = snapshot ? null : await getAppUser(),
    admin = snapshot ? null : await getAdminUser(user),
    config = snapshot ? null : await getAuthConfig();
  return (
    <I18nMessages messages={getMessages(locale, ["public"])}>
      <SiteHeader
        account={
          user
            ? {
                email: user.email,
                displayName: user.displayName,
                provider: user.provider,
              }
            : null
        }
        isAdmin={!!admin?.isModerator}
        publicSnapshot={snapshot}
      />
      <PrivacyContent
        text={privacyMessages[locale]}
        authProvider={snapshot ? publicReleaseAuthProvider() : config?.provider}
      />
      <DirectoryFooter />
    </I18nMessages>
  );
}
