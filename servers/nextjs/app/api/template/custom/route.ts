import { NextResponse } from "next/server";

import {
  buildCustomTemplateLayoutPayload,
  type CustomLayoutCompileInput,
} from "@/lib/server-template-layouts";

export const dynamic = "force-dynamic";

type CustomCompileRequest = {
  group?: string;
  layouts?: CustomLayoutCompileInput[];
};

/**
 * Server-only: compile custom template layouts from DB `layout_code` (no Puppeteer).
 * Called by FastAPI `get_layout_by_name` for `custom-*` templates.
 */
export async function POST(request: Request) {
  let body: CustomCompileRequest;
  try {
    body = (await request.json()) as CustomCompileRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const group = body.group?.trim();
  if (!group || !group.startsWith("custom-")) {
    return NextResponse.json(
      { error: "Missing or invalid group (expected custom-<uuid>)" },
      { status: 400 },
    );
  }

  const layouts = body.layouts;
  if (!Array.isArray(layouts) || layouts.length === 0) {
    return NextResponse.json(
      { error: "layouts array is required" },
      { status: 400 },
    );
  }

  try {
    const payload = buildCustomTemplateLayoutPayload(group, layouts);
    if (!payload) {
      return NextResponse.json(
        { error: `No compilable layouts for template: ${group}` },
        { status: 404 },
      );
    }
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/template/custom] compile failed", err);
    return NextResponse.json(
      { error: "Failed to compile custom template layouts" },
      { status: 500 },
    );
  }
}
