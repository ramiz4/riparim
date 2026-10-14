import { services } from "@/lib/workshops";
import { validAccountName } from "@/lib/account-name";

export const reviewTextMaxLength = 2000;

export function validReviewRating(rating: unknown): rating is number {
  return (
    typeof rating === "number" &&
    Number.isInteger(rating) &&
    rating >= 1 &&
    rating <= 5
  );
}

export function validReviewText(review: unknown): boolean {
  return (
    review == null ||
    (typeof review === "string" && review.trim().length <= reviewTextMaxLength)
  );
}

export function completeReview(review: {
  display_name: unknown;
  rating: unknown;
  review: unknown;
}): boolean {
  return (
    !!validAccountName(review.display_name) &&
    validReviewRating(review.rating) &&
    validReviewText(review.review)
  );
}

// New clients send an explicit array; the scalar field remains compatible with older clients.
export function submittedReviewServices(form: FormData): string[] | null {
  const encoded = form.get("services");
  let values: unknown;
  if (encoded == null) values = [form.get("service")];
  else {
    if (
      typeof encoded !== "string" ||
      encoded.length > 1000 ||
      form.getAll("services").length !== 1
    )
      return null;
    try {
      values = JSON.parse(encoded);
    } catch {
      return null;
    }
  }
  if (
    !Array.isArray(values) ||
    !values.length ||
    values.length > services.length - 1 ||
    values.some(
      (value) =>
        typeof value !== "string" || !services.slice(1).includes(value.trim()),
    )
  )
    return null;
  return [...new Set(values.map((value) => String(value).trim()))];
}
export function decodeReviewServices(
  primary: unknown,
  stored: unknown,
): string[] {
  if (typeof primary !== "string") throw Error("Invalid stored review service");
  if (stored == null) return [primary];
  let values: unknown = stored;
  if (typeof stored === "string") {
    try {
      values = JSON.parse(stored);
    } catch {
      throw Error("Invalid stored review services");
    }
  }
  if (
    !Array.isArray(values) ||
    !values.length ||
    values.length > services.length - 1 ||
    values.some((value) => typeof value !== "string")
  )
    throw Error("Invalid stored review services");
  // Previous workers update only the scalar during deployment or rollback.
  if (values[0] !== primary) return [primary];
  return [...new Set(values.map((value) => String(value)))];
}
export function reviewServiceValues(review: {
  service: string;
  services?: string[];
}): string[] {
  return review.services?.length ? review.services : [review.service];
}
