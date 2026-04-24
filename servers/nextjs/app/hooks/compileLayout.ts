"use client";

import React from "react";
import * as z from "zod";
import * as Recharts from "recharts";
import * as Babel from "@babel/standalone";
import * as d3 from "d3";
import { resolveBackendAssetUrl } from "@/utils/api";
// import * as d3Cloud from "d3-cloud";

export interface CompiledLayout {
    component: React.ComponentType<{ data: any }>;
    layoutId: string;
    layoutName: string;
    layoutDescription: string;
    schema: any;
    sampleData: Record<string, any>;
    schemaJSON: any;
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
        /https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0):(?:8000|5000)(?=\/(?:app_data|static)\/)/g,
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
            // Remove other common imports we'll provide
            .replace(/import\s+.*\s+from\s+['"]@\/[^'"]+['"];?/g, "")
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
        const factory = new Function(
            "React",
            "_z",
            "Recharts",
            "_d3",
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
        const result = factory(React, z, Recharts, d3);

        if (!result.component) {
            console.error("No component found in compiled code");
            return null;
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
        return null;
    }
}




