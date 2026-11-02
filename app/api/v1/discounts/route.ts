import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { error, json, unauthorized } from "@/lib/http";
import { listRegistryByPopup } from "@/lib/discount";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v1/discounts?popupId= — list registry entries (code, popupId,
// endsAt). JWT-protected like the other v1 routes. No emails are returned.
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return unauthorized();
  try {
    const popupId = req.nextUrl.searchParams.get("popupId") || undefined;
    const metas = await listRegistryByPopup(popupId);
    const discounts = metas.map((m) => ({
      code: m.code,
      popupId: m.popupId,
      endsAt: m.endsAt,
    }));
    return json({ success: true, discounts, total: discounts.length });
  } catch {
    return error("Internal server error", 500);
  }
}
