import { legacyMessages } from "@/lib/i18n/legacy-messages";
import {
  businessReadResponse,
  businessFailure as failure,
} from "@/lib/business-read";
import { ValidationError } from "@/lib/validation-error";
import { z } from "zod";
import { getAppUser, getAdminUser } from "@/app/auth";
import { json, readJson, readFormData, sameOrigin } from "@/lib/http";
import {
  businessProfileSchema,
  claimSchema,
  claimUploadRequestLimit,
} from "@/lib/business-contract";
import {
  BusinessError,
  requestWorkshopClaim,
  requestWorkshopChange,
  decideClaim,
  decideChange,
} from "@/lib/business";

export const dynamic = "force-dynamic";
const id = z.string().uuid();
const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("claim"), input: claimSchema }).strict(),
  z
    .object({
      kind: z.literal("change"),
      workshopId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,80}$/),
      profile: businessProfileSchema,
    })
    .strict(),
]);
const decisionSchema = z
  .object({
    kind: z.enum(["claim", "change"]),
    id,
    revision: z.number().int().nonnegative(),
    decision: z.enum(["approved", "rejected"]),
    note: z.string().trim().min(10).max(2000),
  })
  .strict();
async function input(request: Request, maxBytes: number) {
  try {
    return await readJson(request, maxBytes);
  } catch {
    throw new BusinessError(
      legacyMessages.invalidInputs,
      400,
      "invalid_request",
    );
  }
}
export async function GET(request: Request) {
  return businessReadResponse(request, { getAppUser, getAdminUser });
}
export async function POST(request: Request) {
  if (
    !sameOrigin(request) ||
    !["application/json", "multipart/form-data"].some((type) =>
      request.headers.get("content-type")?.includes(type),
    )
  )
    return json(
      { error: legacyMessages.invalidRequest, errorCode: "invalid_request" },
      403,
    );
  try {
    const user = await getAppUser();
    if (!user)
      return json(
        {
          error: legacyMessages.authenticationRequired,
          errorCode: "authentication_required",
        },
        401,
      );
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      let form: FormData;
      try {
        form = await readFormData(request, claimUploadRequestLimit);
      } catch (error) {
        if (error instanceof Error && error.message === "INPUT_TOO_LARGE")
          throw new BusinessError(
            legacyMessages.businessDocumentsTooLarge,
            413,
            "business_documents_too_large",
          );
        throw new BusinessError(
          legacyMessages.invalidInputs,
          400,
          "invalid_request",
        );
      }
      if (
        [...form.keys()].some(
          (key) => !["workshopId", "evidence", "file"].includes(key),
        ) ||
        ["workshopId", "evidence"].some((key) => form.getAll(key).length > 1)
      )
        throw new BusinessError(
          legacyMessages.invalidInputs,
          400,
          "business_invalid_input",
        );
      const files = form.getAll("file");
      if (files.some((file) => typeof file === "string"))
        throw new ValidationError("invalid_file", legacyMessages.invalidUpload);
      const created = await requestWorkshopClaim(
        user,
        { workshopId: form.get("workshopId"), evidence: form.get("evidence") },
        files as File[],
      );
      return json(
        { id: created, status: "pending", messageCode: "saved" },
        201,
      );
    }
    const body = createSchema.parse(await input(request, 48000));
    const created =
      body.kind === "claim"
        ? await requestWorkshopClaim(user, body.input)
        : await requestWorkshopChange(user, body.workshopId, body.profile);
    return json({ id: created, status: "pending", messageCode: "saved" }, 201);
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  if (
    !sameOrigin(request) ||
    !request.headers.get("content-type")?.includes("application/json")
  )
    return json(
      { error: legacyMessages.invalidRequest, errorCode: "invalid_request" },
      403,
    );
  try {
    const admin = await getAdminUser();
    if (!admin)
      return json(
        {
          error: legacyMessages.authenticationRequired,
          errorCode: "authentication_required",
        },
        401,
      );
    if (!admin.isModerator)
      return json(
        { error: legacyMessages.moderationForbidden, errorCode: "forbidden" },
        403,
      );
    const body = decisionSchema.parse(await input(request, 8192));
    if (body.kind === "claim")
      await decideClaim(
        admin,
        body.id,
        body.revision,
        body.decision,
        body.note,
      );
    else
      await decideChange(
        admin,
        body.id,
        body.revision,
        body.decision,
        body.note,
      );
    return json({ ok: true, messageCode: "saved" });
  } catch (e) {
    return failure(e);
  }
}
