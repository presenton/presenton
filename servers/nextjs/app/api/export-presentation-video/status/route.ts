import { NextRequest, NextResponse } from "next/server";
import { getFastApiAuthHeaders, getFastApiBaseUrl } from "@/lib/fastapi-internal";
import { authStatusForRequest } from "@/lib/server-auth-role";

export async function GET(req: NextRequest) {
  const auth = await authStatusForRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId || !taskId.trim()) {
    return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
  }

  const cookie = req.headers.get("cookie") || "";

  try {
    const response = await fetch(
      `${getFastApiBaseUrl()}/api/v1/async-tasks/status/${taskId.trim()}`,
      {
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
    console.error("[export-presentation-video:status]", message);
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
