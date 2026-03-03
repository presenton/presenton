"use client";
import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import LoadingStates from "./components/LoadingStates";
import { Card } from "@/components/ui/card";
import { Copy, ExternalLink } from "lucide-react";
import Header from "@/app/(presentation-generator)/dashboard/components/Header";
import { useLayout } from "../context/LayoutContext";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { getHeader } from "../services/api/header";
import { toast } from "sonner";

const LayoutPreview = () => {
  const {
    getAllTemplateIDs,
    getLayoutsByTemplateID,
    getTemplateSetting,
    getFullDataByTemplateID,
    loading,
    error,
  } = useLayout();
  const router = useRouter();
  const pathname = usePathname();

  const [summaryMap, setSummaryMap] = useState<Record<string, { lastUpdatedAt?: number; name?: string; description?: string }>>({});

  useEffect(() => {
    const existingScript = document.querySelector(
      'script[src*="tailwindcss.com"]'
    );
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    // Fetch summary to map custom template slug to template meta and last updated time
    fetch(`/api/v1/ppt/template-management/summary`, {
      headers: getHeader(),
    })
      .then((res) => res.json())
      .then((data) => {
        const map: Record<string, { lastUpdatedAt?: number; name?: string; description?: string }> = {};
        if (data && Array.isArray(data.presentations)) {
          for (const p of data.presentations) {
            const slug = `custom-${p.presentation_id}`;
            map[slug] = {
              lastUpdatedAt: p.last_updated_at ? new Date(p.last_updated_at).getTime() : 0,
              name: p.template?.name,
              description: p.template?.description,
            };
          }
        }
        setSummaryMap(map);
      })
      .catch(() => setSummaryMap({}));
  }, []);

  // Transform context data to match expected format
  const layoutTemplates = getAllTemplateIDs().map((templateID) => ({
    templateID,
    layouts: getLayoutsByTemplateID(templateID),
    settings: getTemplateSetting(templateID) || { description: "", ordered: false },
  }));
  const inBuiltTemplates = layoutTemplates.filter(
    (g) => !g.templateID.toLowerCase().startsWith("custom-")
  );
  const customTemplates = layoutTemplates.filter((g) =>
    g.templateID.toLowerCase().startsWith("custom-")
  );

  // Sort custom templates by last_updated_at desc using summaryMap
  const customTemplatesSorted = [...customTemplates].sort(
    (a, b) => (summaryMap[b.templateID]?.lastUpdatedAt || 0) - (summaryMap[a.templateID]?.lastUpdatedAt || 0)
  );

  // Handle loading state
  if (loading) {
    return <LoadingStates type="loading" />;
  }

  // Handle error state
  if (error) {
    return <LoadingStates type="error" message={error} />;
  }

  // Handle empty state
  if (!loading && layoutTemplates.length === 0) {
    return <LoadingStates type="empty" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className=" sticky top-0 z-30">
        <div className="max-w-7xl mx-auto border-b px-6 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">All Templates</h1>
            <p className="text-gray-600 mt-2">
              {layoutTemplates.length} templates
            </p>
          </div>
        </div>
        {/* Custom Templates */}
        <section className="h-full pt-8 pb-8 flex justify-center items-center">
          <div className="max-w-7xl mx-auto px-6 py-6 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Custom AI Templates</h2>
              <button className="text-sm text-gray-800 hover:text-blue-600 transition-colors flex items-center gap-2 group" onClick={() => {
                trackEvent(MixpanelEvent.Navigation, { from: pathname, to: `/custom-template` });
                router.push(`/custom-template`)
              }}>
                Create Custom Template
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customTemplatesSorted.length > 0 ? (
                customTemplatesSorted.map((template) => {
                  const meta = summaryMap[template.templateID];

                  const displayName = meta?.name ? meta.name : template.templateID;
                  const displayDescription = meta?.description ? meta.description : template.settings.description;
                  const layoutTemplate = getFullDataByTemplateID(template.templateID);
                  return (
                    <Card
                      key={template.templateID}
                      className="cursor-pointer hover:shadow-md transition-all duration-200 group"
                      onClick={() => {
                        trackEvent(MixpanelEvent.Navigation, { from: pathname, to: `/template-preview/${template.templateID}` });
                        router.push(`/template-preview/${template.templateID}`)
                      }}
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 capitalize group-hover:text-blue-600 transition-colors">
                            {displayName}
                          </h3>

                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {template.layouts.length}
                            </span>
                            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-600  ">ID: {template.templateID}</p>
                          <Copy className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" onClick={() => {
                            navigator.clipboard.writeText(template.templateID);
                            toast.success("Copied to clipboard");
                          }} />
                        </div>
                        <p className="text-sm text-gray-600 my-4">
                          {displayDescription}
                        </p>
                        <div className="grid grid-cols-2 gap-2 mb-3 min-h-[300px]">
                          {layoutTemplate &&
                            layoutTemplate?.slice(0, 4).map((layout: any, index: number) => {
                              const {
                                component: LayoutComponent,
                                sampleData,
                                layoutId,
                                templateID,
                              } = layout;
                              return (
                                <div
                                  key={`${templateID}-${index}`}
                                  className=" relative border border-gray-200 cursor-pointer overflow-hidden aspect-video"
                                >
                                  <div className="absolute cursor-pointer bg-transparent z-40 top-0 left-0 w-full h-full" />
                                  <div className="transform scale-[0.2] flex justify-center items-center origin-top-left  w-[500%] h-[500%]">
                                    <LayoutComponent data={sampleData} />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <Card
                  className="cursor-pointer hover:shadow-md transition-all border-blue-500 duration-200 group"
                  onClick={() => {
                    trackEvent(MixpanelEvent.Navigation, { from: pathname, to: `/custom-template` });
                    router.push(`/custom-template`)
                  }}
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 capitalize group-hover:text-blue-600 transition-colors">
                        Create Custom Template
                      </h3>
                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Create your first custom template
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </section>

        {/* In Built Templates */}
        <section className="h-full pt-8 flex justify-center items-center">
          <div className="max-w-7xl mx-auto px-6 py-6 w-full">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Inbuilt Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inBuiltTemplates.map((template) => {
                const isCustom = template.templateID.toLowerCase().startsWith("custom-");
                const meta = summaryMap[template.templateID];
                const displayName = isCustom && meta?.name ? meta.name : template.templateID;
                const displayDescription = isCustom && meta?.description ? meta.description : template.settings.description;
                const layoutTemplate = getFullDataByTemplateID(template.templateID);
                return (
                  <Card
                    key={template.templateID}
                    className="cursor-pointer hover:shadow-md transition-all duration-200 group"
                    onClick={() => {
                      trackEvent(MixpanelEvent.Navigation, { from: pathname, to: `/template-preview/${template.templateID}` });
                      router.push(`/template-preview/${template.templateID}`)
                    }}
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 capitalize group-hover:text-blue-600 transition-colors">
                          {displayName}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {template.layouts.length}
                          </span>
                          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        {displayDescription}
                      </p>
                      <div className="grid grid-cols-2 gap-2 mb-3 min-h-[300px]">
                        {layoutTemplate &&
                          layoutTemplate?.slice(0, 4).map((layout: any, index: number) => {
                            const {
                              component: LayoutComponent,
                              sampleData,
                              layoutId,
                              templateID,
                            } = layout;
                            return (
                              <div
                                key={`${templateID}-${index}`}
                                className=" relative border border-gray-200 cursor-pointer overflow-hidden aspect-video"
                              >
                                <div className="absolute cursor-pointer bg-transparent z-40 top-0 left-0 w-full h-full" />
                                <div className="transform scale-[0.2] flex justify-center items-center origin-top-left  w-[500%] h-[500%]">
                                  <LayoutComponent data={sampleData} />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>


      </div>
    </div>
  );
};

export default LayoutPreview;
