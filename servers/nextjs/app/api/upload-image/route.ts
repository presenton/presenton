import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { uploadBufferToGcs } from "@/lib/gcsStorage";


const userDataDir = process.env.APP_DATA_DIRECTORY!;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!userDataDir) {
      return NextResponse.json(
        { error: "User data directory not found" },
        { status: 500 }
      );
    }
    // Generate unique filename
    const filename = `${crypto.randomBytes(16).toString("hex")}.png`;
    const contentType = file.type || "image/png";

    const gcsUrl = await uploadBufferToGcs(
      buffer,
      `uploads/${filename}`,
      contentType
    );

    if (gcsUrl) {
      return NextResponse.json({
        success: true,
        filePath: gcsUrl,
      });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(userDataDir, "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);

    // Write file to disk
    fs.writeFileSync(filePath, buffer);

    // Return the relative path that can be used in the frontend
    return NextResponse.json({
      success: true,
      filePath: `${uploadsDir}/${filename}`,
    });
  } catch (error) {
    console.error("Error saving image:", error);
    return NextResponse.json(
      { error: "Failed to save image" },
      { status: 500 }
    );
  }
}
