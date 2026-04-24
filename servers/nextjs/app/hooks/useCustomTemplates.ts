"use client";

import { useState, useEffect, useCallback } from "react";

import { compileCustomLayout, CompiledLayout } from "./compileLayout";
import TemplateService from "../(presentation-generator)/services/api/template";

/**
 * API response types
 */


export interface TemplateSummary {
    id: string;
    name: string;
    total_layouts: number;
}

export interface RawLayoutResponse {
    template: string;
    layout_id: string;
    layout_name: string;
    layout_code: string;
    fonts?: string[];
}

export interface CustomTemplateDetailResponse {

    layouts: RawLayoutResponse[];
    template: any;
    fonts?: string[];
}

// Compiled layout with all metadata
export interface CustomTemplateLayout extends CompiledLayout {
    templateId: string;
    rawLayoutId: string;
    rawLayoutName: string;
    layoutCode: string;
    fonts?: string[];
}

export interface CustomTemplateDetail {
    layouts: CustomTemplateLayout[];
    name: string;
    description: string;
    id: string;
    template: any;
    fonts?: string[];
}

// Custom templates for the main page
export interface CustomTemplates {
    id: string;

    name: string;

    layoutCount: number;

    isCustom: true;
}

// GLOBAL CACHE
const customTemplateDetailsCache = new Map<string, CustomTemplateDetail>();

// GLOBAL IN-FLIGHT PROMISE TRACKER - prevents duplicate API calls for same ID
const inFlightRequests = new Map<string, Promise<CustomTemplateDetail | null>>();

// GLOBAL CACHE: compiled first-slide previews (we only compile the first layout)
const customTemplateFirstSlideCache = new Map<string, CompiledLayout | null>();

// GLOBAL IN-FLIGHT PROMISE TRACKER - prevents duplicate preview calls for same ID
const inFlightFirstSlideRequests = new Map<string, Promise<CompiledLayout | null>>();

function normalizeCustomTemplateId(id: string): string {
    if (!id) return id;
    return id.startsWith("custom-") ? id.slice("custom-".length) : id;
}

/**
 * Fetch + compile ONLY the first layout for a custom template.
 * Accepts either a raw presentationId or a "custom-..." id.
 * Uses global cache + in-flight request deduplication.
 */
export async function getCustomTemplateFirstSlidePreview(
    presentationIdOrCustomId: string
): Promise<CompiledLayout | null> {
    const presentationId = normalizeCustomTemplateId(presentationIdOrCustomId);
    if (!presentationId) return null;

    // Cache first
    if (customTemplateFirstSlideCache.has(presentationId)) {
        return customTemplateFirstSlideCache.get(presentationId) ?? null;
    }

    // In-flight dedupe
    const existing = inFlightFirstSlideRequests.get(presentationId);
    if (existing) return existing;

    const fetchPromise = (async (): Promise<CompiledLayout | null> => {
        try {
            const data: CustomTemplateDetailResponse = await TemplateService.getCustomTemplateDetails(presentationId);
            const firstLayout = data?.layouts?.[0];
            if (!firstLayout?.layout_code) {
                customTemplateFirstSlideCache.set(presentationId, null);
                return null;
            }

            const compiled = compileCustomLayout(firstLayout.layout_code);
            customTemplateFirstSlideCache.set(presentationId, compiled);
            return compiled;
        } catch (err) {
            console.error("Error fetching first-slide preview:", err);
            // Don't cache errors; allow retry next time.
            return null;
        } finally {
            inFlightFirstSlideRequests.delete(presentationId);
        }
    })();

    inFlightFirstSlideRequests.set(presentationId, fetchPromise);
    return fetchPromise;
}


/**
 * Standalone async function to fetch and compile custom template details
 * Can be called from hooks or regular async functions (like handleSubmit)
 * Uses global cache and in-flight request deduplication
 */
export async function getCustomTemplateDetails(
    templateId: string,
    name: string = "Custom Template",
    description: string = "User-created template"
): Promise<CustomTemplateDetail | null> {
    if (!templateId) {
        return null;
    }

    // Check cache first
    const cachedTemplate = customTemplateDetailsCache.get(templateId);
    if (cachedTemplate) {
        return cachedTemplate;
    }

    // Check if there's already an in-flight request for this ID
    const existingRequest = inFlightRequests.get(templateId);
    if (existingRequest) {
        return existingRequest;
    }

    // Create new request and track it
    const fetchPromise = (async (): Promise<CustomTemplateDetail | null> => {
        try {
            const data: CustomTemplateDetailResponse = await TemplateService.getCustomTemplateDetails(templateId);

            // Compile each layout
            const compiledLayouts: CustomTemplateLayout[] = [];

            for (const layout of data.layouts) {
                try {
                    const compiled = compileCustomLayout(layout.layout_code);

                    if (compiled) {
                        compiledLayouts.push({
                            ...compiled,
                            templateId: layout.template,
                            rawLayoutId: layout.layout_id,
                            rawLayoutName: layout.layout_name,
                            layoutCode: layout.layout_code,
                            fonts: layout.fonts,
                        });
                    } else {
                        console.warn(`Failed to compile layout: ${layout.layout_name}`);
                    }
                } catch (compileError) {
                    console.error(`Error compiling ${layout.layout_name}:`, compileError);
                }
            }

            const result: CustomTemplateDetail = {
                layouts: compiledLayouts,
                name,
                description,
                id: templateId,
                template: data.template ? data.template : null,
                fonts: data.fonts
            };

            // Cache the result
            customTemplateDetailsCache.set(templateId, result);
            return result;
        } catch (err) {
            console.error("Error fetching template details:", err);
            throw err;
        } finally {
            // Clean up in-flight tracker
            inFlightRequests.delete(templateId);
        }
    })();

    // Track this request
    inFlightRequests.set(templateId, fetchPromise);

    return fetchPromise;
}


/**
 * Hook to fetch custom template summaries
 */
export function useCustomTemplateSummaries() {
    const [templates, setTemplates] = useState<CustomTemplates[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const data: TemplateSummary[] = await TemplateService.getCustomTemplateSummaries();
            const mappedTemplates: CustomTemplates[] = data.filter(item => item.total_layouts && item.total_layouts > 0).map((item) => {

                return {
                    id: item.id,
                    name: item.name || "Custom Template",
                    layoutCount: item.total_layouts,
                    isCustom: true as const,
                }
            });

            setTemplates(mappedTemplates);
        } catch (err) {
            console.error("Error fetching custom templates:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
            setTemplates([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    return { templates, loading, error, refetch: fetchTemplates };
}

/**
 * Hook to fetch and compile custom template layouts
 * Uses global cache and in-flight request deduplication to prevent duplicate API calls
 */
export function useCustomTemplateDetails(templateDetail: { id: string, name: string, description: string }) {
    const [template, setTemplate] = useState<CustomTemplateDetail | null>(() => {

        return templateDetail.id ? customTemplateDetailsCache.get(templateDetail.id) ?? null : null;
    });
    const [fonts, setFonts] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(() => {
        return templateDetail.id ? !customTemplateDetailsCache.has(templateDetail.id) : false;
    });
    const [error, setError] = useState<string | null>(null);

    const fetchTemplateDetails = useCallback(async () => {
        if (!templateDetail.id) {
            return;
        }

        // Check cache first - instant return if cached
        const cachedTemplate = customTemplateDetailsCache.get(templateDetail.id);
        if (cachedTemplate) {
            setTemplate(cachedTemplate);
            setFonts(cachedTemplate?.fonts ?? []);
            setLoading(false);
            return;
        }

        // Check if there's already an in-flight request for this ID
        const existingRequest = inFlightRequests.get(templateDetail.id);
        if (existingRequest) {
            // Wait for the existing request instead of making a new one
            setLoading(true);
            try {
                const result = await existingRequest;
                if (result) {
                    setTemplate(result);
                    setFonts(result?.fonts ?? []);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
            return;
        }

        // Create new request and track it
        setLoading(true);
        setError(null);

        const fetchPromise = (async (): Promise<CustomTemplateDetail | null> => {
            try {
                const data: CustomTemplateDetailResponse = await TemplateService.getCustomTemplateDetails(templateDetail.id);

                // Compile each layout
                const compiledLayouts: CustomTemplateLayout[] = [];

                for (const layout of data.layouts) {
                    try {
                        const compiled = compileCustomLayout(layout.layout_code);

                        if (compiled) {
                            compiledLayouts.push({
                                ...compiled,
                                templateId: layout.template,
                                rawLayoutId: layout.layout_id,
                                rawLayoutName: layout.layout_name,
                                layoutCode: layout.layout_code,
                                fonts: layout.fonts,
                                layoutId: compiled?.layoutId ?? "",
                            });
                        } else {
                            console.warn(`Failed to compile layout: ${layout.layout_name}`);
                        }
                    } catch (compileError) {
                        console.error(`Error compiling ${layout.layout_name}:`, compileError);
                    }
                }

                const result: CustomTemplateDetail = {
                    layouts: compiledLayouts,
                    name: templateDetail.name,
                    description: templateDetail.description,
                    id: templateDetail.id,
                    template: data.template,
                    fonts: data.fonts
                };

                // Cache the result
                customTemplateDetailsCache.set(templateDetail.id, result);
                return result;
            } catch (err) {
                console.error("Error fetching template details:", err);
                throw err;
            } finally {
                // Clean up in-flight tracker
                inFlightRequests.delete(templateDetail.id);
            }
        })();

        // Track this request
        inFlightRequests.set(templateDetail.id, fetchPromise);

        try {
            const result = await fetchPromise;
            if (result) {
                setTemplate(result);
                setFonts(result?.fonts ?? []);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setTemplate(null);
            setFonts([]);
        } finally {
            setLoading(false);
        }
    }, [templateDetail.id, templateDetail.name, templateDetail.description]);

    useEffect(() => {
        if (templateDetail.id) {
            fetchTemplateDetails();
        }
    }, [templateDetail.id, fetchTemplateDetails]);

    return { template, loading, error, refetch: fetchTemplateDetails, fonts };
}

/**
 * Hook to fetch and compile preview layouts for a single template (first 4 layouts)
 */
export function useCustomTemplatePreview(presentationId: string) {
    const [previewLayouts, setPreviewLayouts] = useState<CompiledLayout[]>([]);
    const [loading, setLoading] = useState(true);



    useEffect(() => {
        if (!presentationId) return;

        const fetchPreviews = async () => {
            try {
                setLoading(true);
                const data = await TemplateService.getCustomTemplateDetails(presentationId);

                // Compile first 4 layouts for preview
                const compiled: CompiledLayout[] = [];
                const layoutsToPreview = data.layouts.slice(0, 4);

                for (const layout of layoutsToPreview) {
                    try {
                        const result = compileCustomLayout(layout.layout_code);
                        if (result) {
                            compiled.push(result);
                        }
                    } catch (e) {
                        console.warn(`Failed to compile preview: ${layout.layout_name}`);
                    }
                }

                setPreviewLayouts(compiled);
            } catch (err) {
                console.error("Error fetching preview layouts:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPreviews();
    }, [presentationId]);

    return { previewLayouts, loading: loading };
}

/**
 * Hook to fetch and compile preview for ONLY the first layout of a custom template.
 * Accepts either a raw presentationId or a "custom-..." id.
 */
export function useCustomTemplateFirstSlidePreview(presentationIdOrCustomId: string) {
    const [previewLayout, setPreviewLayout] = useState<CompiledLayout | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!presentationIdOrCustomId) return;

        let cancelled = false;
        const run = async () => {
            try {
                setLoading(true);
                setError(null);
                const compiled = await getCustomTemplateFirstSlidePreview(presentationIdOrCustomId);
                if (cancelled) return;
                setPreviewLayout(compiled);
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : "Unknown error");
                setPreviewLayout(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [presentationIdOrCustomId]);

    return { previewLayout, loading, error };
}
