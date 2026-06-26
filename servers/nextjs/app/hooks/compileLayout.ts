"use client";

import React from "react";
import * as z from "zod";
import * as Recharts from "recharts";
import * as Babel from "@babel/standalone";
import * as d3 from "d3";
import * as LucideReact from "lucide-react";
import { resolveBackendAssetUrl } from "@/utils/api";
// import * as d3Cloud from "d3-cloud";

/** Names already bound from Recharts (and core helpers) — do not shadow with Lucide. */
const RESERVED_FOR_LUCIDE = new Set([
    "Fragment",
    "useState",
    "useEffect",
    "useRef",
    "useMemo",
    "useCallback",
    "z",
    "ResponsiveContainer",
    "LineChart",
    "Line",
    "BarChart",
    "Bar",
    "XAxis",
    "YAxis",
    "CartesianGrid",
    "Tooltip",
    "Legend",
    "PieChart",
    "Pie",
    "Cell",
    "AreaChart",
    "Area",
    "RadarChart",
    "Radar",
    "PolarGrid",
    "PolarAngleAxis",
    "PolarRadiusAxis",
    "ComposedChart",
    "ScatterChart",
    "Scatter",
    "RadialBarChart",
    "RadialBar",
    "ReferenceLine",
    "ReferenceDot",
    "ReferenceArea",
    "Brush",
    "LabelList",
    "Label",
    "Text",
]);

function isLucideComponent(value: unknown): boolean {
    return typeof value === "function" || (typeof value === "object" && value !== null);
}

function getLucideBindingLines(layoutCode: string): string {
    const requestedBindings = new Map<string, string>();
    const declaredComponents = new Set<string>();
    const bindings: string[] = [];

    for (const match of layoutCode.matchAll(
        /\b(?:const|let|var|function|class)\s+([A-Z][A-Za-z0-9_$]*)\b/g
    )) {
        declaredComponents.add(match[1]);
    }

    const importPattern = /import\s+\{([\s\S]*?)\}\s+from\s+['"]lucide-react['"];?/g;

    for (const match of layoutCode.matchAll(importPattern)) {
        const specifiers = match[1].split(",");
        for (const specifier of specifiers) {
            const [importedName, localName = importedName] = specifier
                .trim()
                .split(/\s+as\s+/);

            if (!importedName || !/^[A-Z][A-Za-z0-9_$]*$/.test(localName)) continue;
            requestedBindings.set(localName, importedName);
        }
    }

    // Generated layouts sometimes omit Lucide imports entirely. Any undefined
    // capitalized JSX component gets a Lucide component or a visible placeholder.
    for (const match of layoutCode.matchAll(/<\s*([A-Z][A-Za-z0-9_$]*)(?![A-Za-z0-9_$.])/g)) {
        const componentName = match[1];
        if (!requestedBindings.has(componentName)) {
            requestedBindings.set(componentName, componentName);
        }
    }

    for (const [localName, importedName] of requestedBindings) {
        if (RESERVED_FOR_LUCIDE.has(localName)) continue;
        if (localName === "Icon" || localName === "LucideIcon") continue;
        if (declaredComponents.has(localName)) continue;

        const resolvedName = isLucideComponent(
            (LucideReact as Record<string, unknown>)[importedName]
        )
            ? importedName
            : "CircleHelp";

        bindings.push(`const ${localName} = _Lucide[${JSON.stringify(resolvedName)}];`);
    }

    return bindings.join("\n");
}

export interface CompiledLayout {
    component: React.ComponentType<{ data: any }>;
    layoutId: string;
    layoutName: string;
    layoutDescription: string;
    schema: any;
    sampleData: Record<string, any>;
    schemaJSON: any;
}

function createInvalidCompiledLayout(message: string): CompiledLayout {
    const InvalidLayout: React.ComponentType<{ data: any }> = () => (
        React.createElement(
            "div",
            {
                className:
                    "relative w-full max-w-[1280px] max-h-[720px] aspect-video bg-white border border-red-200 text-red-700 flex items-center justify-center p-8 text-center",
            },
            React.createElement(
                "div",
                null,
                React.createElement("div", { className: "text-lg font-semibold" }, "Invalid layout code"),
                React.createElement("div", { className: "mt-2 text-sm text-red-600" }, message)
            )
        )
    );
    InvalidLayout.displayName = "InvalidCustomTemplateLayout";

    const schema = z.object({});
    return {
        component: InvalidLayout,
        layoutId: "invalid-layout",
        layoutName: "Invalid Layout",
        layoutDescription: "This custom layout code is invalid and must be regenerated or edited.",
        schema,
        sampleData: {},
        schemaJSON: z.toJSONSchema(schema),
    };
}

function isLikelyBackendAssetPath(value: string): boolean {
    if (!value) return false;
    if (value.startsWith("file://")) return true;
    if (value.startsWith("/app_data/") || value.startsWith("/static/")) return true;
    if (value.startsWith("app_data/") || value.startsWith("static/")) return true;
    return value.includes("/app_data/") || value.includes("/static/");
}

function normalizeLayoutAssetUrls<T>(value: T): T {
    if (typeof value === "string") {
        const trimmedValue = value.trim();
        if (!isLikelyBackendAssetPath(trimmedValue)) {
            return value;
        }
        return resolveBackendAssetUrl(trimmedValue) as T;
    }

    if (Array.isArray(value)) {
        return value.map((item) => normalizeLayoutAssetUrls(item)) as T;
    }

    if (value && typeof value === "object") {
        const normalizedEntries = Object.entries(value as Record<string, unknown>).map(
            ([key, item]) => [key, normalizeLayoutAssetUrls(item)]
        );
        return Object.fromEntries(normalizedEntries) as T;
    }

    return value;
}

function normalizeHardcodedBackendUrlsInCode(layoutCode: string): string {
    // Keep /app_data and /static paths origin-agnostic so nginx can proxy them.
    return layoutCode.replace(
        /https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0):(?:8000|5000|5001)(?=\/(?:app_data|static)\/)/g,
        ""
    );
}

/**
 * Compiles a layout code string into a usable React component
 */
export function compileCustomLayout(layoutCode: string): CompiledLayout | null {
    console.log('compileCustomLayout called');
    try {
        const normalizedLayoutCode = normalizeHardcodedBackendUrlsInCode(layoutCode);

        // Clean up imports that we'll provide ourselves
        const cleanCode = normalizedLayoutCode
            // Remove React imports
            .replace(/import\s+React\s*,?\s*\{?[^}]*\}?\s*from\s+['"]react['"];?/g, "")
            .replace(/import\s+\*\s+as\s+React\s+from\s+['"]react['"];?/g, "")
            .replace(/import\s+{\s*[^}]*\s*}\s*from\s+['"]react['"];?/g, "")
            // Remove zod imports
            .replace(/import\s+\*\s+as\s+z\s+from\s+['"]zod['"];?/g, "")
            .replace(/import\s+{\s*z\s*}\s*from\s+['"]zod['"];?/g, "")
            .replace(/import\s+.*\s+from\s+['"]zod['"];?/g, "")
            // Remove recharts imports
            .replace(/import\s+.*\s+from\s+['"]recharts['"];?/g, "")
            // Remove lucide-react imports (icons are injected into the sandbox below)
            .replace(/import\s+\{[\s\S]*?\}\s+from\s+['"]lucide-react['"];?\s*/g, "")
            .replace(/import\s+\*\s+as\s+[\w$]+\s+from\s+['"]lucide-react['"];?\s*/g, "")
            .replace(/import\s+[\w$]+\s+from\s+['"]lucide-react['"];?\s*/g, "")
            // Remove other common imports we'll provide
            .replace(/import\s+.*\s+from\s+['"]@\/[^'"]+['"];?/g, "")
            // Remove named exports; the runtime factory returns known bindings itself.
            .replace(/export\s+(const|let|var|function)\s+/g, "$1 ")
            .replace(/export\s*\{[\s\S]*?\};?\s*$/gm, "")
            .replace(/export\s+default\s+function\s+(\w+)/g, "function $1")
            // Remove export default at the end (we'll handle it differently)
            .replace(/export\s+default\s+\w+;?\s*$/g, "");



        const compiled = Babel.transform(cleanCode, {
            presets: [
                ["react", { runtime: "classic" }],
                ["typescript", { isTSX: true, allExtensions: true }],
            ],
            sourceType: "script",
        }).code;

        // Create a factory function that executes the compiled code
        const lucideBindings = getLucideBindingLines(normalizedLayoutCode);

        const factory = new Function(
            "React",
            "_z",
            "Recharts",
            "_d3",
            "_Lucide",
            // "_d3Cloud",
            `
             const z = _z;
            // const d3Cloud= _d3Cloud;
            const d3 = _d3;
            // Expose React hooks
            const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;
            
            // Expose Recharts components
            const {
                ResponsiveContainer, LineChart, Line, BarChart, Bar,
                XAxis, YAxis, CartesianGrid, Tooltip, Legend,
                PieChart, Pie, Cell, AreaChart, Area,
                RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
                ComposedChart, ScatterChart, Scatter,
                RadialBarChart, RadialBar,
                ReferenceLine, ReferenceDot, ReferenceArea,
                Brush, LabelList, Label,Text
            } = Recharts || {};

            // Lucide icons used in generated templates (<Star />, etc.) — skip names that clash with Recharts
            ${lucideBindings}

            // Execute the compiled code
            ${compiled}

            // Return the exports
            return {
              __esModule: true,   
                component: typeof dynamicSlideLayout !== 'undefined' 
                    ? dynamicSlideLayout 
                    : (typeof DefaultLayout !== 'undefined' ? DefaultLayout : undefined),
                layoutId: typeof layoutId !== 'undefined' ? layoutId : 'custom-layout',
                layoutName: typeof layoutName !== 'undefined' ? layoutName : 'Custom Layout',
                layoutDescription: typeof layoutDescription !== 'undefined' ? layoutDescription : '',
                Schema: typeof Schema !== 'undefined' ? Schema : null,
            };
            `
        );

        // Execute the factory
        const result = factory(React, z, Recharts, d3, LucideReact);

        if (!result.component) {
            console.error("No component found in compiled code");
            return createInvalidCompiledLayout("Missing dynamicSlideLayout component.");
        }

        if (!result.Schema) {
            console.error("No Schema found in compiled code");
            return createInvalidCompiledLayout("Missing Schema declaration.");
        }

        const wrappedComponent: React.ComponentType<{ data: any }> = ({ data, ...props }) => {
            const normalizedData = React.useMemo(() => normalizeLayoutAssetUrls(data), [data]);
            return React.createElement(result.component, { ...(props as any), data: normalizedData });
        };
        wrappedComponent.displayName = `CompiledTemplateLayout(${result.layoutName || result.layoutId || "Custom"})`;

        // Parse schema to get sample data
        let sampleData: Record<string, any> = {};
        if (result.Schema) {
            try {
                sampleData = normalizeLayoutAssetUrls(result.Schema.parse({}));
            } catch (e) {
                console.warn("Could not parse schema defaults:", e);
            }
        }
        const schemaJSON = z.toJSONSchema(result.Schema);

        return {
            component: wrappedComponent,
            layoutId: result.layoutId,
            layoutName: result.layoutName,
            layoutDescription: result.layoutDescription,
            schema: result.Schema,
            sampleData,
            schemaJSON,
        };
    } catch (error) {
        console.error("Error compiling layout:", error);
        const message =
            error instanceof Error ? error.message : "The layout could not be compiled.";
        return createInvalidCompiledLayout(message);
    }
}

