import { NextRequest, NextResponse } from "next/server";
import { getFastApiAuthHeaders, getFastApiBaseUrl } from "@/lib/fastapi-internal";
import { authStatusForRequest } from "@/lib/server-auth-role";

export async function POST(req: NextRequest) {
  const auth = await authStatusForRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  let id: unknown;
  try {
    const body = await req.json();
    id = body?.id;
  } catch {
    return NextResponse.json(
      { error: "Invalid export request JSON body" },
      { status: 400 }
    );
  }

  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json(
      { error: "Missing Presentation ID" },
      { status: 400 }
    );
  }

  const cookie = req.headers.get("cookie") || "";

  try {
    const response = await fetch(
      `${getFastApiBaseUrl()}/api/v1/ppt/presentation/${id.trim()}/export-video/async`,
      {
        method: "POST",
        headers: {
          ...(cookie ? { cookie } : {}),
          ...getFastApiAuthHeaders(),
        },
        cache: "no-store",
      }
    );
    const payload = await response.text();
    return new NextResponse(payload || null, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[export-presentation-video]", message);
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
