import { finishWorkerRead, workerReadAuth } from "./worker-read-auth";

// The owned Worker has no native identity. Use the same account/session policy
// as App Router, while avoiding React and its cookie-renewal proxy for this GET.
export async function workerSessionResponse(request: Request) {
  const headers = new Headers();
  try {
    const user = await (await workerReadAuth(request, headers)).getAppUser();
    return finishWorkerRead(
      Response.json({
        account: user
          ? {
              email: user.email,
              displayName: user.displayName,
              provider: user.provider,
            }
          : null,
        isAdmin: !!user?.isModerator,
      }),
      headers,
    );
  } catch (error) {
    console.error(
      "public-session",
      error instanceof Error ? error.name : "unknown",
    );
    return finishWorkerRead(
      Response.json({ errorCode: "unavailable" }, { status: 503 }),
      headers,
    );
  }
}
