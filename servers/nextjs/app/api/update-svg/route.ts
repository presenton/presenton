import {
    normalizeStrokeLinecap,
    normalizeStrokeLinejoin,
    normalizeSvgColor,
    normalizeSvgNumberish,
    transformSvgMarkup,
} from "@/lib/svg-color";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STATIC_ICONS_URL_PREFIX = "/static/icons/";
const MAX_SVG_SIZE_BYTES = 5 * 1024 * 1024;
let staticIconsRootPromise: Promise<string> | null = null;

class SvgSourceError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message);
        this.name = "SvgSourceError";
    }
}

const resolveStaticIconsRoot = async (): Promise<string> => {
    if (staticIconsRootPromise) {
        return staticIconsRootPromise;
    }

    const appRoot = process.env.PRESENTON_APP_ROOT?.trim();
    const candidates = [
        ...(appRoot
            ? [
                  path.join(appRoot, "servers", "fastapi", "static", "icons"),
                  path.join(appRoot, "resources", "fastapi", "static", "icons"),
                  path.resolve(
                      appRoot,
                      "..",
                      "servers",
                      "fastapi",
                      "static",
                      "icons"
                  ),
              ]
            : []),
        path.resolve(
            process.cwd(),
            "servers",
            "fastapi",
            "static",
            "icons"
        ),
        path.resolve(process.cwd(), "..", "fastapi", "static", "icons"),
    ];

    staticIconsRootPromise = (async () => {
        for (const candidate of candidates) {
            try {
                return await fs.realpath(/* turbopackIgnore: true */ candidate);
            } catch {
                // Try the next development fallback.
            }
        }
        throw new SvgSourceError("Static icon directory is unavailable", 500);
    })();

    return staticIconsRootPromise;
};

const isPathInside = (basePath: string, candidatePath: string): boolean =>
    candidatePath === basePath ||
    candidatePath.startsWith(`${basePath}${path.sep}`);

const readLocalStaticIconSvg = async (
    sourceUrl: string,
    requestUrl: string
): Promise<string | null> => {
    let pathname: string;
    try {
        pathname = decodeURIComponent(new URL(sourceUrl, requestUrl).pathname);
    } catch {
        return null;
    }

    if (!pathname.startsWith(STATIC_ICONS_URL_PREFIX)) {
        return null;
    }

    const relativePath = pathname.slice(STATIC_ICONS_URL_PREFIX.length);
    if (
        !relativePath ||
        relativePath.includes("\0") ||
        path.extname(relativePath).toLowerCase() !== ".svg"
    ) {
        throw new SvgSourceError("Invalid local SVG path", 400);
    }

    const staticIconsRoot = await resolveStaticIconsRoot();
    const unresolvedPath = path.resolve(staticIconsRoot, relativePath);
    if (!isPathInside(staticIconsRoot, unresolvedPath)) {
        throw new SvgSourceError("Invalid local SVG path", 400);
    }

    let resolvedPath: string;
    try {
        resolvedPath = await fs.realpath(
            /* turbopackIgnore: true */ unresolvedPath
        );
    } catch {
        throw new SvgSourceError("SVG file not found", 404);
    }
    if (!isPathInside(staticIconsRoot, resolvedPath)) {
        throw new SvgSourceError("Invalid local SVG path", 400);
    }

    const fileStats = await fs.stat(/* turbopackIgnore: true */ resolvedPath);
    if (!fileStats.isFile()) {
        throw new SvgSourceError("SVG file not found", 404);
    }
    if (fileStats.size > MAX_SVG_SIZE_BYTES) {
        throw new SvgSourceError("SVG file is too large", 413);
    }

    return fs.readFile(/* turbopackIgnore: true */ resolvedPath, "utf8");
};

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const svgUrl = searchParams.get("url");
        const color = normalizeSvgColor(searchParams.get("color"));
        const stroke = normalizeSvgColor(searchParams.get("stroke"));
        const fill = normalizeSvgColor(searchParams.get("fill"));
        const strokeWidth = normalizeSvgNumberish(
            searchParams.get("strokeWidth") ?? searchParams.get("stroke-width")
        );
        const opacity = normalizeSvgNumberish(searchParams.get("opacity"));
        const strokeOpacity = normalizeSvgNumberish(
            searchParams.get("strokeOpacity") ?? searchParams.get("stroke-opacity")
        );
        const fillOpacity = normalizeSvgNumberish(
            searchParams.get("fillOpacity") ?? searchParams.get("fill-opacity")
        );
        const strokeLinecap = normalizeStrokeLinecap(
            searchParams.get("strokeLinecap") ?? searchParams.get("stroke-linecap")
        );
        const strokeLinejoin = normalizeStrokeLinejoin(
            searchParams.get("strokeLinejoin") ?? searchParams.get("stroke-linejoin")
        );

        if (!svgUrl) {
            return NextResponse.json({ error: "url is required" }, { status: 400 });
        }

        const svgContent = await readLocalStaticIconSvg(svgUrl, req.url);
        if (svgContent === null) {
            return NextResponse.json(
                { error: "Only /static/icons SVG sources are supported" },
                { status: 400 }
            );
        }

        if (!/<svg\b/i.test(svgContent)) {
            return NextResponse.json(
                { error: "Invalid SVG markup" },
                { status: 400 }
            );
        }

        const transformedSvg = transformSvgMarkup(svgContent, {
            color,
            stroke,
            fill,
            strokeWidth,
            opacity,
            strokeOpacity,
            fillOpacity,
            strokeLinecap,
            strokeLinejoin,
        });

        return new Response(transformedSvg, {
            status: 200,
            headers: {
                "Content-Type": "image/svg+xml; charset=utf-8",
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        if (error instanceof SvgSourceError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }
        return NextResponse.json(
            { error: "Error processing SVG" },
            { status: 500 }
        );
    }
}
