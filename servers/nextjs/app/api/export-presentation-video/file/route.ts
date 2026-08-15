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

function getSafeVideoName(request: NextRequest): string | null {
  const decodedName = request.nextUrl.searchParams.get("name");

  if (!decodedName || decodedName.includes("\\") || path.isAbsolute(decodedName)) {
    return null;
  }

  const normalized = path.normalize(decodedName);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    return null;
  }
  // Videos aren't scoped to per-user subdirectories the way PDF/PPTX
  // exports are -- keep this simple and rely on the random UUID suffix
  // in the filename (see video_export_service.py) as the access control.
  return normalized;
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

  const filename = getSafeVideoName(request);
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
