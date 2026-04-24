import { NextResponse, NextRequest } from "next/server";

import {
  bundledExportPackageAvailable,
  runBundledPdfExport,
} from "@/lib/run-bundled-pdf-export";

export async function POST(req: NextRequest) {
  const { id, title } = await req.json();
  if (!id) {
    return NextResponse.json(
      { error: "Missing Presentation ID" },
      { status: 400 }
    );
  }

  try {
    if (!(await bundledExportPackageAvailable())) {
      throw new Error(
        "presentation-export runtime is not available. Run scripts/sync-presentation-export.cjs to install it."
      );
    }

    const { path: outPath } = await runBundledPdfExport({
      presentationId: id,
      title,
    });
    return NextResponse.json({
      success: true,
      path: outPath,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[export-as-pdf]", message);
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
