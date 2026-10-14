import { headers } from "next/headers";
import type { AppUser } from "./app-user";
import {
  localSeedAccount,
  localEmailPreview,
  localGooglePreview,
  type LocalSettingsPreview,
} from "./local-seed";

export async function isLocalDevelopmentRequest() {
  if (process.env.NODE_ENV !== "development") return false;
  return /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
    (await headers()).get("host") ?? "",
  );
}
export async function localSeedPreviewAccount(
  user: Pick<AppUser, "userId" | "email" | "displayName" | "provider"> | null,
  view: unknown = "admin",
): Promise<LocalSettingsPreview | undefined> {
  if (
    !user ||
    user.provider !== "ChatGPT" ||
    user.userId !== localSeedAccount.userId ||
    user.email !== localSeedAccount.email ||
    !(await isLocalDevelopmentRequest())
  )
    return undefined;
  return view === "email"
    ? { ...localEmailPreview }
    : view === "google"
      ? { ...localGooglePreview }
      : {
          kind: "admin",
          email: user.email,
          name: user.displayName,
          provider: user.provider,
          protected: true,
        };
}
