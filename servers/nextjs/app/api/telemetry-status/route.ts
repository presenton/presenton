import fs from "fs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const userConfigPath = process.env.USER_CONFIG_PATH;
  let fileDisabled: string | undefined;
  if (userConfigPath && fs.existsSync(userConfigPath)) {
    try {
      const raw = fs.readFileSync(userConfigPath, "utf-8");
      const parsed = JSON.parse(raw) as { DISABLE_ANONYMOUS_TRACKING?: string };
      fileDisabled = parsed?.DISABLE_ANONYMOUS_TRACKING;
    } catch {
      fileDisabled = undefined;
    }
  }
  const envDisabled =
    process.env.DISABLE_ANONYMOUS_TRACKING === "true" ||
    process.env.DISABLE_ANONYMOUS_TRACKING === "True";
  const isDisabled =
    envDisabled ||
    fileDisabled === "true" ||
    fileDisabled === "True";
  const telemetryEnabled = !isDisabled;
  return NextResponse.json({ telemetryEnabled });
}


