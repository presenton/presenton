import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import { authStatusForRequest } from "@/lib/server-auth-role";

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
};

function getVideosDirectory(): string {
  const appDataDirectory = process.env.APP_DATA_DIRECTORY?.trim();
  if (!appDataDirectory) {
    throw new Error("APP_DATA_DIRECTORY is required to download exported videos.");
  }
  return path.join(appDataDirectory, "videos");
}

// Mirrors getSafeExportName() in app/api/export-presentation/file/route.ts --
// videos are saved the same owner-scoped way as PDF/PPTX exports (both go
// through _owned_directory() on the backend, which nests everything under
// "users/<owner_id>/"), so the same ownership check applies here: a
// non-admin caller may only reach files under their own "users/<id>/"
// subdirectory; an admin (or a legacy/no-owner-context deployment) may
// reach a flat top-level filename.
function getSafeVideoName(
  request: NextRequest,
  userId: string | null,
  isAdmin: boolean,
): string | null {
  const decodedName = request.nextUrl.searchParams.get("name");

  if (
    !decodedName ||
    decodedName.includes("\\") ||
    path.isAbsolute(decodedName)
  ) {
    return null;
  }

  const normalized = path.normalize(decodedName);
  if (
    normalized === ".." ||
    normalized.startsWith(`..${path.sep}`)
  ) {
    return null;
  }
  if (!userId) return normalized;

  const parts = normalized.split(path.sep);
  if (parts[0] === "users") {
    return parts.length >= 3 && parts[1] === userId ? normalized : null;
  }
  return isAdmin && parts.length === 1 ? normalized : null;
}

function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(request: NextRequest) {
  const auth = await authStatusForRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const filename = getSafeVideoName(
    request,
    auth.user_id,
    auth.role === "admin",
  );
  if (!filename) {
    return NextResponse.json({ error: "Invalid video file name" }, { status: 400 });
  }

  try {
    const videosDirectory = getVideosDirectory();
    const resolvedVideosDirectory = await fsPromises.realpath(videosDirectory);
    const filePath = path.join(videosDirectory, filename);
    const resolvedFilePath = await fsPromises.realpath(filePath);

    if (
      resolvedFilePath !== resolvedVideosDirectory &&
      !resolvedFilePath.startsWith(resolvedVideosDirectory + path.sep)
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const ext = path.extname(resolvedFilePath).toLowerCase();
    const stats = await fsPromises.stat(resolvedFilePath);
    const stream = Readable.toWeb(fs.createReadStream(resolvedFilePath));
    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Content-Disposition": contentDisposition(path.basename(filename)),
        "Content-Length": String(stats.size),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "Video file not found" }, { status: 404 });
    }

    console.error("[export-presentation-video:file]", error);
    return NextResponse.json(
      { error: "Failed to download video file" },
      { status: 500 }
    );
  }
}
