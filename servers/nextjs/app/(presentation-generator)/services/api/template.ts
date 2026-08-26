import { getApiUrl } from "@/utils/api";
import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import {
    normalizeTemplateTheme,
    type TemplateTheme,
} from "@/lib/template-theme";
import { ApiResponseHandler } from "./api-error-handler";
import { getHeader } from "./header";

const TEMPLATE_THEME_CACHE_TTL_MS = 5 * 60 * 1000;

export interface CloneTemplatePayload {
    id: string;
    name?: string;
    description?: string;
}

export interface CloneLayoutPayload {
    template_id: string;
    layout_id: string;
    layout_name?: string;
}

export interface CreateTemplatePayload {
    pptx_url: string;
    slide_image_urls: string[];
    fonts: Record<string, unknown>;
    name: string;
    description?: string | null;
}

export interface TemplateListResponse {
    items: TemplateListItem[];
    total: number;
    page: number;
    page_size: number;
}

export interface TemplateListItem {
    id: string;
    name: string;
    description?: string | null;
    layout_count?: number;
    thumbnail?: string | null;
    is_default?: boolean;
    status?: string | null;
    generation_status?: string | null;
    error?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface TemplateDetailsResponse extends TemplateListItem {
    raw_layouts?: unknown;
    components?: unknown;
    merged_components?: unknown;
    layouts?: unknown;
    assets?: unknown;
}

export interface AsyncTaskResponse {
    id: string;
    type: string;
    status: string;
    message?: string | null;
    error?: unknown;
    data?: unknown;
    created_at: string;
    updated_at: string;
}

export interface TemplateCreateTaskData {
    created_layouts?: number;
    remaining_layouts?: number;
    name?: string;
    thumbnail?: string | null;
}

export interface TemplateCreateTaskResponse extends AsyncTaskResponse {
    type: "template.create";
    data?: TemplateCreateTaskData | null;
}

export interface UpdateTemplateMetadataPayload {
    name: string;
    description?: string | null;
}

export interface UpdateTemplatePayload extends Partial<TemplateDetailsResponse> {
    id: string;
}

export interface UpdateTemplateLayoutsPayload {
    layouts: Array<{
        index: number;
        layout: unknown;
    }>;
}

export interface CreateTemplateLayoutPayload {
    template_id: string;
    index: number;
}

export interface GenerateTemplateLayoutPayload {
    template_id: string;
    prompt: string;
}

export interface GenerateTemplateLayoutResponse {
    layout: TemplateV2Layout;
    response: string;
}

class TemplateService {

    private static templateThemeCache = new Map<
        string,
        { expiresAt: number; value: TemplateTheme | null }
    >();

    private static templateThemeRequests = new Map<
        string,
        Promise<TemplateTheme | null>
    >();

    private static normalizeTemplateId(templateId: string) {
        return templateId.trim().replace(/^template-v2-/, "");
    }

    private static invalidateTemplateTheme(templateId: string) {
        const cacheKey = this.normalizeTemplateId(templateId);
        this.templateThemeCache.delete(cacheKey);
        this.templateThemeRequests.delete(cacheKey);
    }

    static async getCustomTemplateSummaries() {
        try {
            const response = await fetch(getApiUrl(`/api/v1/ppt/template/all?page_size=100&default=false`),);
            return await ApiResponseHandler.handleResponse(response, "Failed to get custom template summaries");
        } catch (error) {
            console.error("Failed to get custom template summaries", error);
            throw error;
        }
    }

    static async getCustomTemplateDetails(templateId: string) {
        try {
            const response = await fetch(getApiUrl(`/api/v1/ppt/template/${templateId}/layouts`),);
            return await ApiResponseHandler.handleResponse(response, "Failed to get custom template details");
        } catch (error) {
            console.error("Failed to get custom template details", error);
            throw error;
        }
    }

    static async getTemplateSummaries(
        isDefault?: boolean,
        options: { presentonCloudOnly?: boolean } = {},
    ): Promise<TemplateListResponse> {
        try {
            const params = new URLSearchParams({ page_size: "100" });
            if (typeof isDefault === "boolean") {
                params.set("default", String(isDefault));
            }
            if (options.presentonCloudOnly) {
                params.set("presenton_cloud_only", "true");
            }
            const response = await fetch(getApiUrl(`/api/v1/ppt/template/all?${params.toString()}`));
            return await ApiResponseHandler.handleResponse(response, "Failed to get Templates summaries");
        } catch (error) {
            console.error("Failed to get Templates summaries", error);
            throw error;
        }
    }

    static async getTemplateDetails(templateId: string): Promise<TemplateDetailsResponse> {
        try {
            const apiTemplateId = this.normalizeTemplateId(templateId);
            const response = await fetch(getApiUrl(`/api/v1/ppt/template/${encodeURIComponent(apiTemplateId)}`));
            return await ApiResponseHandler.handleResponse(response, "Failed to get template details");
        } catch (error) {
            console.error("Failed to get Templates v1 details", error);
            throw error;
        }
    }

    static async getTemplateTheme(templateId: string): Promise<TemplateTheme | null> {
        const cacheKey = this.normalizeTemplateId(templateId);
        if (!cacheKey) return null;

        const cached = this.templateThemeCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return cached.value;

        const existingRequest = this.templateThemeRequests.get(cacheKey);
        if (existingRequest) return existingRequest;

        const request = (async () => {
            try {
                const response = await fetch(
                    getApiUrl(
                        `/api/v1/ppt/template/${encodeURIComponent(cacheKey)}/theme`,
                    ),
                    { headers: getHeader() },
                );
                if (!response.ok) {
                    throw new Error(`Template theme request failed (${response.status})`);
                }

                const theme = normalizeTemplateTheme(await response.json());
                this.templateThemeCache.set(cacheKey, {
                    expiresAt: Date.now() + TEMPLATE_THEME_CACHE_TTL_MS,
                    value: theme,
                });
                return theme;
            } catch (error) {
                console.warn("Failed to get template theme", error);
                return null;
            }
        })();

        this.templateThemeRequests.set(cacheKey, request);
        try {
            return await request;
        } finally {
            this.templateThemeRequests.delete(cacheKey);
        }
    }

    static async createTemplate(payload: CreateTemplatePayload): Promise<AsyncTaskResponse> {
        try {
            const response = await fetch(getApiUrl(`/api/v1/ppt/template/async`), {
                method: "POST",
                headers: getHeader(),
                body: JSON.stringify(payload),
            });
            return await ApiResponseHandler.handleResponse(response, "Failed to create template");
        } catch (error) {
            console.error("Failed to create template", error);
            throw error;
        }
    }

    static async getProcessingTemplateCreateTasks(createdAtFrom: Date): Promise<TemplateCreateTaskResponse[]> {
        try {
            const params = new URLSearchParams({
                type: "template.create",
                status: "pending",
                order_by: "created_at",
                order: "desc",
                limit: "50",
                offset: "0",
                created_at: createdAtFrom.toISOString(),
            });
            const response = await fetch(getApiUrl(`/api/v1/async-tasks?${params.toString()}`));
            return await ApiResponseHandler.handleResponse(response, "Failed to get processing template tasks");
        } catch (error) {
            console.error("Failed to get processing template tasks", error);
            throw error;
        }
    }

    static async deleteTemplate(templateId: string) {
        try {
            const response = await fetch(getApiUrl(`/api/v1/ppt/template/${encodeURIComponent(templateId)}`), {
                method: "DELETE",
                headers: getHeader(),
            });
            const result = await ApiResponseHandler.handleResponseWithResult(response, "Failed to delete template");
            this.invalidateTemplateTheme(templateId);
            return result;
        } catch (error) {
            console.error("Failed to delete Templates template", error);
            throw error;
        }
    }

    static async updateTemplateMetadata(
        templateId: string,
        payload: UpdateTemplateMetadataPayload,
    ) {
        return this.updateTemplate(templateId, {
            id: templateId,
            ...payload,
        });
    }

    static async updateTemplate(
        templateId: string,
        payload: UpdateTemplatePayload,
    ) {
        try {
            const response = await fetch(getApiUrl(`/api/v1/ppt/template/${encodeURIComponent(templateId)}`), {
                method: "PATCH",
                headers: getHeader(),
                body: JSON.stringify(payload),
            });
            const result = await ApiResponseHandler.handleResponse(response, "Failed to update template");
            this.invalidateTemplateTheme(templateId);
            return result;
        } catch (error) {
            console.error("Failed to update template", error);
            throw error;
        }
    }

    static async updateTemplateLayouts(
        templateId: string,
        payload: UpdateTemplateLayoutsPayload,
    ) {
        try {
            const response = await fetch(
                getApiUrl(`/api/v1/ppt/template/${encodeURIComponent(templateId)}/layouts`),
                {
                    method: "PATCH",
                    headers: getHeader(),
                    body: JSON.stringify(payload),
                },
            );
            const result = await ApiResponseHandler.handleResponse(
                response,
                "Failed to update template layouts",
            );
            this.invalidateTemplateTheme(templateId);
            return result;
        } catch (error) {
            console.error("Failed to update template layouts", error);
            throw error;
        }
    }

    static async createTemplateLayout(payload: CreateTemplateLayoutPayload) {
        try {
            const response = await fetch(
                getApiUrl("/api/v1/ppt/template/layouts/create"),
                {
                    method: "POST",
                    headers: getHeader(),
                    body: JSON.stringify(payload),
                },
            );
            const result = await ApiResponseHandler.handleResponse(
                response,
                `Failed to create layout for slide ${payload.index + 1}`,
            );
            this.invalidateTemplateTheme(payload.template_id);
            return result;
        } catch (error) {
            console.error("Failed to create template layout", error);
            throw error;
        }
    }

    static async generateTemplateLayout(
        payload: GenerateTemplateLayoutPayload,
    ): Promise<GenerateTemplateLayoutResponse> {
        try {
            const response = await fetch(
                getApiUrl("/api/v1/ppt/template/layouts/generate"),
                {
                    method: "POST",
                    headers: getHeader(),
                    body: JSON.stringify(payload),
                },
            );
            const result = await ApiResponseHandler.handleResponse(
                response,
                "Failed to generate template layout",
            );
            this.invalidateTemplateTheme(payload.template_id);
            return result;
        } catch (error) {
            console.error("Failed to generate template layout", error);
            throw error;
        }
    }

    static async deleteCustomTemplate(presentationId: string) {
        try {
            const response = await fetch(getApiUrl(`/api/v1/ppt/template-management/delete-templates/${presentationId}`), { method: "DELETE", headers: getHeader() });
            return await ApiResponseHandler.handleResponseWithResult(response, "Failed to delete custom template");
        } catch (error) {
            console.error("Failed to delete custom template", error);
            throw error;
        }
    }

    static async cloneCustomTemplate(payload: CloneTemplatePayload) {
        try {
            const response = await fetch(getApiUrl(`/api/v1/ppt/template/clone`), {
                method: "POST",
                headers: getHeader(),
                body: JSON.stringify(payload),
            });
            return await ApiResponseHandler.handleResponse(response, "Failed to clone template");
        } catch (error) {
            console.error("Failed to clone template", error);
            throw error;
        }
    }

    static async cloneTemplateLayout(payload: CloneLayoutPayload) {
        try {
            const response = await fetch(getApiUrl(`/api/v1/ppt/template/slide-layout/clone`), {
                method: "POST",
                headers: getHeader(),
                body: JSON.stringify(payload),
            });
            return await ApiResponseHandler.handleResponse(response, "Failed to clone layout");
        } catch (error) {
            console.error("Failed to clone layout", error);
            throw error;
        }
    }
}

export default TemplateService;
