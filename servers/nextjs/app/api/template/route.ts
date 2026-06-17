import { NextResponse } from "next/server";

import {
  buildBuiltinTemplateLayoutPayload,
  buildCustomTemplateLayoutPayloadFromApi,
} from "@/lib/server-template-layouts";

export const dynamic = "force-dynamic";

/**
 * Server-only layout + JSON Schema for built-in templates (no import of
 * `presentation-templates/index.tsx`, which would pull Recharts into RSC).
 *
 * Used by FastAPI when `extract-schema` (Puppeteer) fails — e.g. `next dev`
 * + `networkidle0`.
 */
export async function GET(request: Request) {
  const group = new URL(request.url).searchParams.get("group");
  if (!group) {
    return NextResponse.json(
      { error: "Missing required query parameter: group" },
      { status: 400 },
    );
  }

  try {
    if (group.startsWith("custom-")) {
      const customPayload = await buildCustomTemplateLayoutPayloadFromApi(group);
      if (!customPayload) {
        return NextResponse.json(
          { error: `Unknown template group: ${group}` },
          { status: 404 },
        );
      }
      return NextResponse.json(customPayload);
    }

    const payload = await buildBuiltinTemplateLayoutPayload(group);
    if (!payload) {
      return NextResponse.json(
        { error: `Unknown template group: ${group}` },
        { status: 404 },
      );
    }
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/template] failed to build layout payload", err);
    return NextResponse.json(
      { error: "Failed to compile template layouts" },
      { status: 500 },
    );
  }
}
