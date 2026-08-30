"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import CreateCustomTemplate from "./CreateCustomTemplate";
import Link from "next/link";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { ensureTailwindBrowserScript } from "@/lib/tailwind-browser";
import { useTemplateSummaries, TemplateTab } from "../../../hooks/useTemplateSummaries";
import {
  ProcessingTemplateListCard,
  TemplateListCard,
  TemplateTabSwitcher,
  TemplateListLoadingState,
  TemplateListEmptyState,
} from "../../../components/TemplateListUi";

const LayoutPreview = () => {
  const [tab, setTab] = useState<TemplateTab>("default");
  const router = useRouter();
  const {
    defaultTemplates,
    customTemplates,
    processingTemplateTasks,
    loading,
    error,
  } = useTemplateSummaries({ includeProcessingTemplateTasks: true });

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "custom" || requestedTab === "default") {
      setTab(requestedTab);
    }

    trackEvent(MixpanelEvent.Templates_Page_Viewed);
    ensureTailwindBrowserScript();
  }, []);

  const handleOpenTemplate = useCallback(
    (templateId: string, templateName: string, isDefault: boolean) => {
      trackEvent(
        isDefault
          ? MixpanelEvent.Templates_Inbuilt_Opened
          : MixpanelEvent.Templates_Custom_Opened,
        {
          template_id: templateId,
          template_name: templateName,
        }
      );
      router.push(`/template-preview?templateV2Id=${templateId}`);
    },
    [router]
  );

  const handleTabChange = useCallback((nextTab: TemplateTab) => {
    trackEvent(MixpanelEvent.Templates_Tab_Switched, { tab: nextTab });
    setTab(nextTab);
  }, []);

  const activeTemplates = tab === "default" ? defaultTemplates : customTemplates;

  return (
    <div className="min-h-screen relative font-syne">
      <div className="sticky top-0 right-0 z-50 py-[28px] px-6 backdrop-blur">
        <div className="flex xl:flex-row flex-col gap-6 xl:gap-0 items-center justify-between">
          <h3 className="text-[28px] tracking-[-0.84px] font-unbounded font-normal text-[#101828] flex items-center gap-2">
            Templates
          </h3>
          <div className="flex gap-2.5 max-sm:w-full max-md:justify-center max-sm:flex-wrap">
            <Link
              href="/custom-template"
              onClick={() => trackEvent(MixpanelEvent.Templates_New_Template_Clicked)}
              className="inline-flex items-center font-syne font-semibold gap-2 rounded-xl px-4 py-2.5 text-black text-sm shadow-sm hover:shadow-md"
              aria-label="Create new template"
              style={{
                borderRadius: "48px",
                background:
                  "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
              }}
            >
              <span className="hidden md:inline">New Template</span>
              <span className="md:hidden">New</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto px-6 py-8">
        <TemplateTabSwitcher tab={tab} onTabChange={handleTabChange} />

        <section className="my-12">
          {loading ? (
            <TemplateListLoadingState />
          ) : error ? (
            <TemplateListEmptyState message={`Templates could not be loaded: ${error}`} />
          ) : tab === "custom" ? (
            <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <CreateCustomTemplate />
              {processingTemplateTasks.map((task) => (
                <ProcessingTemplateListCard key={task.id} task={task} />
              ))}
              {customTemplates.map((template) => (
                <TemplateListCard
                  key={template.id}
                  template={template}
                  showArrow
                  onClick={() => handleOpenTemplate(template.id, template.name, false)}
                />
              ))}
            </div>
          ) : activeTemplates.length === 0 ? (
            <TemplateListEmptyState message="No built-in templates available." />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {activeTemplates.map((template) => (
                <TemplateListCard
                  key={template.id}
                  template={template}
                  showArrow
                  onClick={() => handleOpenTemplate(template.id, template.name, true)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default LayoutPreview;
