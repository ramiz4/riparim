import { decodeReviewServices } from "@/lib/review";
import { storage } from "@/db/storage";
import { json } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("workshop");
    const result = await storage()
      .db.prepare(
        "SELECT v.display_name,v.vehicle,v.service,v.services,v.date,v.rating,v.review FROM visits v JOIN workshops w ON w.id=v.workshop AND w.status='published' WHERE v.workshop=? AND v.status='published' ORDER BY v.created_at DESC LIMIT 100",
      )
      .bind(id ?? "")
      .all<Record<string, unknown>>();
    return json({
      reviews: result.results.map((value) => ({
        ...value,
        services: decodeReviewServices(value.service, value.services),
      })),
    });
  } catch (e) {
    console.error("reviews-read", e);
    return json(
      {
        error: "Bewertungen sind momentan nicht verfügbar.",
        errorCode: "reviews_unavailable",
      },
      503,
    );
  }
}
