export const SVG_UPDATE_ROUTE = "/api/update-svg";

export interface SvgUpdateQuery {
    color?: string | null;
    stroke?: string | null;
    fill?: string | null;
    strokeWidth?: string | null;
    opacity?: string | null;
    strokeOpacity?: string | null;
    fillOpacity?: string | null;
    strokeLinecap?: string | null;
    strokeLinejoin?: string | null;
}

type SvgUpdateBuildOptions = SvgUpdateQuery & {
    forceRoute?: boolean;
};

const UNSAFE_SVG_VALUE_CHARS = /["'<>`{};\r\n]/;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const BARE_HEX_COLOR_PATTERN = /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CSS_COLOR_FUNCTION_PATTERN =
    /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|var|calc)\(.+\)$/i;
const SVG_KEYWORD_PATTERN = /^[a-z-]+$/i;
const SVG_NUMBERISH_PATTERN =
    /^-?(?:\d+\.?\d*|\d*\.?\d+)(?:%|px|em|rem|pt|pc|cm|mm|in)?$/i;
const PRESERVED_PAINT_VALUES = new Set([
    "none",
    "currentcolor",
    "context-fill",
    "context-stroke",
    "inherit",
    "transparent",
]);
const VALID_STROKE_LINECAP_VALUES = new Set([
    "butt",
    "round",
    "square",
    "inherit",
]);
const VALID_STROKE_LINEJOIN_VALUES = new Set([
    "miter",
    "miter-clip",
    "round",
    "bevel",
    "arcs",
    "inherit",
]);

const SVG_UPDATE_QUERY_KEYS = [
    "color",
    "stroke",
    "fill",
    "strokeWidth",
    "opacity",
    "strokeOpacity",
    "fillOpacity",
    "strokeLinecap",
    "strokeLinejoin",
] as const;

const ROOT_SVG_TAG_PATTERN = /<svg\b([^>]*)>/i;

const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const shouldPreservePaintValue = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return (
        PRESERVED_PAINT_VALUES.has(normalized) || normalized.startsWith("url(")
    );
};

const shouldPreservePaintValueForExplicitColor = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return normalized !== "currentcolor" && shouldPreservePaintValue(value);
};

const replaceAttributeValue = (
    input: string,
    attrName: string,
    nextValue: string,
    preserveValue?: (currentValue: string) => boolean
): string => {
    const escapedAttrName = escapeRegExp(attrName);
    const patterns = [
        new RegExp(`(\\s${escapedAttrName}\\s*=\\s*")(.*?)(")`, "gi"),
        new RegExp(`(\\s${escapedAttrName}\\s*=\\s*')(.*?)(')`, "gi"),
        new RegExp(
            `(\\s${escapedAttrName}\\s*=\\s*)([^\\s"'=<>` + "`" + `]+)`,
            "gi"
        ),
    ];

    return patterns.reduce((output, pattern) => {
        return output.replace(
            pattern,
            (match, prefix: string, currentValue: string, suffix?: string) => {
                if (preserveValue?.(currentValue)) {
                    return match;
                }

                return suffix
                    ? `${prefix}${nextValue}${suffix}`
                    : `${prefix}${nextValue}`;
            }
        );
    }, input);
};

const replaceStyleValue = (
    input: string,
    attrName: string,
    nextValue: string,
    preserveValue?: (currentValue: string) => boolean
): string => {
    const escapedAttrName = escapeRegExp(attrName);
    const pattern = new RegExp(
        `(${escapedAttrName}\\s*:\\s*)([^;"'}]+?)(\\s*)(?=;|}|["']|$)`,
        "gi"
    );

    return input.replace(
        pattern,
        (
            match,
            prefix: string,
            currentValue: string,
            trailingWhitespace: string
        ) => {
            if (preserveValue?.(currentValue)) {
                return match;
            }

            return `${prefix}${nextValue}${trailingWhitespace}`;
        }
    );
};

const replaceSvgValue = (
    input: string,
    attrName: string,
    nextValue: string,
    preserveValue?: (currentValue: string) => boolean
): string => {
    let output = replaceAttributeValue(input, attrName, nextValue, preserveValue);
    output = replaceStyleValue(output, attrName, nextValue, preserveValue);
    return output;
};

const upsertRootAttribute = (
    input: string,
    attrName: string,
    nextValue: string
): string => {
    return input.replace(ROOT_SVG_TAG_PATTERN, (match, attrs: string) => {
        let updatedAttrs = attrs;
        const escapedAttrName = escapeRegExp(attrName);
        const patterns = [
            new RegExp(`(\\s${escapedAttrName}\\s*=\\s*")(.*?)(")`, "i"),
            new RegExp(`(\\s${escapedAttrName}\\s*=\\s*')(.*?)(')`, "i"),
            new RegExp(
                `(\\s${escapedAttrName}\\s*=\\s*)([^\\s"'=<>` + "`" + `]+)`,
                "i"
            ),
        ];

        for (const pattern of patterns) {
            if (pattern.test(updatedAttrs)) {
                updatedAttrs = updatedAttrs.replace(
                    pattern,
                    (
                        innerMatch,
                        prefix: string,
                        _currentValue: string,
                        suffix?: string
                    ) => {
                        return suffix
                            ? `${prefix}${nextValue}${suffix}`
                            : `${prefix}${nextValue}`;
                    }
                );

                return `<svg${updatedAttrs}>`;
            }
        }

        return `<svg${updatedAttrs} ${attrName}="${nextValue}">`;
    });
};

const getMergedInput = (
    incomingValue: string | null | undefined,
    existingValue: string | undefined
): string | null | undefined => {
    if (incomingValue === undefined) {
        return existingValue;
    }

    return incomingValue;
};

const normalizeSvgSourceForTransport = (
    rawSource: string,
    baseUrl: string
): string => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(rawSource)) {
        return rawSource;
    }

    try {
        return new URL(rawSource, baseUrl).toString();
    } catch {
        return rawSource;
    }
};

const readSvgUpdateParams = (
    rawSource: string,
    baseUrl: string
): Partial<Record<(typeof SVG_UPDATE_QUERY_KEYS)[number], string>> => {
    try {
        const parsedUrl = new URL(rawSource, baseUrl);
        if (parsedUrl.pathname !== SVG_UPDATE_ROUTE) {
            return {};
        }

        const output: Partial<
            Record<(typeof SVG_UPDATE_QUERY_KEYS)[number], string>
        > = {};
        for (const key of SVG_UPDATE_QUERY_KEYS) {
            const value = parsedUrl.searchParams.get(key);
            if (value) {
                output[key] = value;
            }
        }

        return output;
    } catch {
        return {};
    }
};

export const normalizeSvgColor = (value?: string | null): string | null => {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed || UNSAFE_SVG_VALUE_CHARS.test(trimmed)) {
        return null;
    }

    if (HEX_COLOR_PATTERN.test(trimmed)) {
        return trimmed;
    }

    if (BARE_HEX_COLOR_PATTERN.test(trimmed)) {
        return `#${trimmed}`;
    }

    if (CSS_COLOR_FUNCTION_PATTERN.test(trimmed)) {
        return trimmed;
    }

    if (SVG_KEYWORD_PATTERN.test(trimmed)) {
        return trimmed;
    }

    return null;
};

export const normalizeSvgNumberish = (value?: string | null): string | null => {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed || UNSAFE_SVG_VALUE_CHARS.test(trimmed)) {
        return null;
    }

    return SVG_NUMBERISH_PATTERN.test(trimmed) ? trimmed : null;
};

export const normalizeStrokeLinecap = (
    value?: string | null
): string | null => {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    return VALID_STROKE_LINECAP_VALUES.has(normalized) ? normalized : null;
};

export const normalizeStrokeLinejoin = (
    value?: string | null
): string | null => {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    return VALID_STROKE_LINEJOIN_VALUES.has(normalized) ? normalized : null;
};

export const unwrapSvgUpdateUrl = (
    rawSource: string,
    baseUrl: string
): string | null => {
    let currentSource = rawSource.trim();
    if (!currentSource) {
        return null;
    }

    for (let depth = 0; depth < 5; depth += 1) {
        try {
            const parsedUrl = new URL(currentSource, baseUrl);
            if (parsedUrl.pathname !== SVG_UPDATE_ROUTE) {
                return currentSource;
            }

            const nestedSource = parsedUrl.searchParams.get("url");
            if (!nestedSource) {
                return null;
            }

            currentSource = nestedSource.trim();
            if (!currentSource) {
                return null;
            }
        } catch {
            return currentSource;
        }
    }

    return null;
};

export const isSvgImageSource = (
    rawSource: string,
    baseUrl: string
): boolean => {
    try {
        const parsedRawUrl = new URL(rawSource, baseUrl);
        if (parsedRawUrl.pathname === SVG_UPDATE_ROUTE) {
            return true;
        }
    } catch {
        // Ignore parse errors and fall through to the looser checks below.
    }

    const source = unwrapSvgUpdateUrl(rawSource, baseUrl) ?? rawSource.trim();
    if (!source) {
        return false;
    }

    if (/^data:image\/svg\+xml/i.test(source)) {
        return true;
    }

    try {
        const parsedUrl = new URL(source, baseUrl);
        return /\.svg$/i.test(parsedUrl.pathname);
    } catch {
        return /\.svg(?:$|[?#])/i.test(source);
    }
};

export const buildSvgUpdateUrl = (
    rawSource: string,
    baseUrl: string,
    options: SvgUpdateBuildOptions
): string | null => {
    const source = unwrapSvgUpdateUrl(rawSource, baseUrl);
    if (!source) {
        return null;
    }

    const transportSource = normalizeSvgSourceForTransport(source, baseUrl);

    const existingParams = readSvgUpdateParams(rawSource, baseUrl);
    const mergedInputs = {
        color: getMergedInput(options.color, existingParams.color),
        stroke: getMergedInput(options.stroke, existingParams.stroke),
        fill: getMergedInput(options.fill, existingParams.fill),
        strokeWidth: getMergedInput(
            options.strokeWidth,
            existingParams.strokeWidth
        ),
        opacity: getMergedInput(options.opacity, existingParams.opacity),
        strokeOpacity: getMergedInput(
            options.strokeOpacity,
            existingParams.strokeOpacity
        ),
        fillOpacity: getMergedInput(
            options.fillOpacity,
            existingParams.fillOpacity
        ),
        strokeLinecap: getMergedInput(
            options.strokeLinecap,
            existingParams.strokeLinecap
        ),
        strokeLinejoin: getMergedInput(
            options.strokeLinejoin,
            existingParams.strokeLinejoin
        ),
    };

    const normalizedParams = {
        color: normalizeSvgColor(mergedInputs.color),
        stroke: normalizeSvgColor(mergedInputs.stroke),
        fill: normalizeSvgColor(mergedInputs.fill),
        strokeWidth: normalizeSvgNumberish(mergedInputs.strokeWidth),
        opacity: normalizeSvgNumberish(mergedInputs.opacity),
        strokeOpacity: normalizeSvgNumberish(mergedInputs.strokeOpacity),
        fillOpacity: normalizeSvgNumberish(mergedInputs.fillOpacity),
        strokeLinecap: normalizeStrokeLinecap(mergedInputs.strokeLinecap),
        strokeLinejoin: normalizeStrokeLinejoin(mergedInputs.strokeLinejoin),
    };

    const searchParams = new URLSearchParams();
    searchParams.set("url", transportSource);

    let hasTransforms = false;
    for (const key of SVG_UPDATE_QUERY_KEYS) {
        const value = normalizedParams[key];
        if (value) {
            searchParams.set(key, value);
            hasTransforms = true;
        }
    }

    return hasTransforms || options.forceRoute
        ? `${SVG_UPDATE_ROUTE}?${searchParams.toString()}`
        : transportSource;
};

export const transformSvgMarkup = (
    svgContent: string,
    options: SvgUpdateQuery
): string => {
    let output = svgContent;

    const normalizedColor = normalizeSvgColor(options.color);
    const normalizedStroke = normalizeSvgColor(options.stroke);
    const normalizedFill = normalizeSvgColor(options.fill);
    const normalizedStrokeWidth = normalizeSvgNumberish(options.strokeWidth);
    const normalizedOpacity = normalizeSvgNumberish(options.opacity);
    const normalizedStrokeOpacity = normalizeSvgNumberish(options.strokeOpacity);
    const normalizedFillOpacity = normalizeSvgNumberish(options.fillOpacity);
    const normalizedStrokeLinecap = normalizeStrokeLinecap(options.strokeLinecap);
    const normalizedStrokeLinejoin = normalizeStrokeLinejoin(
        options.strokeLinejoin
    );
    const rootCurrentColor =
        normalizedColor ?? normalizedFill ?? normalizedStroke;

    if (rootCurrentColor) {
        output = replaceSvgValue(output, "color", rootCurrentColor);
        output = upsertRootAttribute(output, "color", rootCurrentColor);
    }

    if (normalizedColor) {
        output = replaceSvgValue(
            output,
            "stroke",
            normalizedColor,
            shouldPreservePaintValueForExplicitColor
        );
        output = replaceSvgValue(
            output,
            "fill",
            normalizedColor,
            shouldPreservePaintValueForExplicitColor
        );
        output = upsertRootAttribute(output, "fill", normalizedColor);
    }

    if (normalizedStroke) {
        output = replaceSvgValue(
            output,
            "stroke",
            normalizedStroke,
            shouldPreservePaintValueForExplicitColor
        );
    }

    if (normalizedFill) {
        output = replaceSvgValue(
            output,
            "fill",
            normalizedFill,
            shouldPreservePaintValueForExplicitColor
        );
        output = upsertRootAttribute(output, "fill", normalizedFill);
    }

    if (normalizedStrokeWidth) {
        output = replaceSvgValue(output, "stroke-width", normalizedStrokeWidth);
    }

    if (normalizedOpacity) {
        output = replaceSvgValue(output, "opacity", normalizedOpacity);
        output = upsertRootAttribute(output, "opacity", normalizedOpacity);
    }

    if (normalizedStrokeOpacity) {
        output = replaceSvgValue(output, "stroke-opacity", normalizedStrokeOpacity);
    }

    if (normalizedFillOpacity) {
        output = replaceSvgValue(output, "fill-opacity", normalizedFillOpacity);
        output = upsertRootAttribute(output, "fill-opacity", normalizedFillOpacity);
    }

    if (normalizedStrokeLinecap) {
        output = replaceSvgValue(output, "stroke-linecap", normalizedStrokeLinecap);
    }

    if (normalizedStrokeLinejoin) {
        output = replaceSvgValue(
            output,
            "stroke-linejoin",
            normalizedStrokeLinejoin
        );
    }

    return output;
};
