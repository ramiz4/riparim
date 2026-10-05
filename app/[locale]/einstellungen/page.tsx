import type { Metadata } from "next";
import { getAdminUser, getAppUser } from "@/app/auth";
import { DirectoryFooter } from "@/components/directory-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeSettings } from "@/components/theme-settings";
import { AccountSettings } from "@/components/account-settings";
import "./settings.css";

export const metadata: Metadata = { title: "Einstellungen · Riparim" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getAppUser();
  const admin = await getAdminUser(user);

  return (
    <>
      <SiteHeader account={user ? { email: user.email, displayName: user.displayName, provider: user.provider } : null} isAdmin={!!admin?.isModerator} />
      <main className="settings-page wrap">
        <h1>Einstellungen</h1>
        <ThemeSettings />
        <AccountSettings />
      </main>
      <DirectoryFooter />
    </>
  );
}
