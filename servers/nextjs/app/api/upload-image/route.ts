import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";

const MAX_UPLOAD_IMAGE_BYTES = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let filePath: string | undefined;

  try {
    const userDataDir = process.env.APP_DATA_DIRECTORY;
    if (!userDataDir) {
      return NextResponse.json(
        { error: "User data directory not found" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image file is too large" },
        { status: 413 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(userDataDir, "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });


    // Generate unique filename
    const filename = `${crypto.randomBytes(16).toString("hex")}.png`;
    filePath = path.join(uploadsDir, filename);

    // Write file to disk
    await pipeline(
      Readable.fromWeb(file.stream() as unknown as NodeReadableStream<Uint8Array>),
      fs.createWriteStream(filePath)
    );

    // Return the relative path that can be used in the frontend
    return NextResponse.json({
      success: true,
      filePath: `${uploadsDir}/${filename}`
    });
  } catch (error) {
    if (filePath) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Best-effort cleanup for partial uploads.
      }
    }
    console.error("Error saving image:", error);
    return NextResponse.json(
      { error: "Failed to save image" },
      { status: 500 }
    );
  }
}
