import { NextResponse } from "next/server";

import {
  LayoutCodeValidationError,
  validateLayoutCode,
} from "@/lib/validate-layout-code";

export const dynamic = "force-dynamic";

function invalidResponse(error: string, line?: number, column?: number) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(line === undefined ? {} : { line }),
      ...(column === undefined ? {} : { column }),
    },
    { status: 400 }
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return invalidResponse("Request body must be valid JSON");
  }

  const layoutCode = (payload as { layout_code?: unknown })?.layout_code;
  if (typeof layoutCode !== "string") {
    return invalidResponse("layout_code must be a string");
  }

  try {
    const validated = validateLayoutCode(layoutCode);
    return NextResponse.json({
      ok: true,
      layout_code: validated.layout_code,
      layoutId: validated.layoutId,
      layoutName: validated.layoutName,
      layoutDescription: validated.layoutDescription,
      schemaJSON: validated.schemaJSON,
    });
  } catch (error) {
    if (error instanceof LayoutCodeValidationError) {
      return invalidResponse(error.message, error.line, error.column);
    }

    console.error("[validate-layout-code] unexpected error", error);
    return NextResponse.json(
      { ok: false, error: "Failed to validate layout code" },
      { status: 500 }
    );
  }
}
