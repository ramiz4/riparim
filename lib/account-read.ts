import { legacyMessages } from "@/lib/i18n/legacy-messages";
import type { AppUser } from "./auth/app-user";
import type { AuthConfig } from "./auth/config";
import {
  deletionProtected,
  matchesDeletionGrant,
  type DeletionGrant,
} from "./auth/deletion-read";
import { json } from "./http";

export type ReadAccount = { user: AppUser; config: AuthConfig };
export type AccountReadAuth = {
  currentAccount(): Promise<ReadAccount | null>;
  readDeletionGrant(): Promise<DeletionGrant | null>;
  getAuthConfig(): Promise<AuthConfig | null>;
};
const unavailable = () =>
  json(
    {
      error: legacyMessages.accountUnavailable,
      errorCode: "account_unavailable",
    },
    503,
  );
export async function accountReadResponse(auth: AccountReadAuth) {
  const { currentAccount, readDeletionGrant, getAuthConfig } = auth;
  try {
    const current = await currentAccount(),
      grant = await readDeletionGrant(),
      config = await getAuthConfig();
    const validGrant =
      grant && config?.enabled && (await matchesDeletionGrant(grant, config))
        ? grant
        : null;
    if (!current || validGrant?.started)
      return json({
        account: null,
        deletionReady: false,
        deletionStarted: !!validGrant?.started,
      });
    return json({
      account: {
        email: current.user.email,
        name: current.user.displayName,
        provider: current.user.provider,
        protected: await deletionProtected(current.user),
      },
      deletionReady:
        !!validGrant && validGrant.account_id === current.user.userId,
      deletionStarted: !!validGrant?.started,
    });
  } catch (e) {
    console.error("account-operation-failed", {
      operation: "read",
      reason: e instanceof Error ? e.name : "unknown",
    });
    return unavailable();
  }
}
