"use client";

import React, { useState, useEffect } from "react";

import { DashboardApi } from "@/app/(presentation-generator)/services/api/dashboard";
import { PresentationGrid } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/PresentationGrid";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { usePathname } from "next/navigation";



const DashboardPage: React.FC = () => {
  const pathname = usePathname();
  const [presentations, setPresentations] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      await fetchPresentations();
    };
    loadData();
  }, []);

  const fetchPresentations = async () => {
    let fetchedCount = 0;
    let hasError = false;
    try {
      setIsLoading(true);
      setError(null);
      const data = await DashboardApi.getPresentations();
      fetchedCount = data.length;
      data.sort(
        (a: any, b: any) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setPresentations(data);
    } catch (err) {
      hasError = true;
      setError(null);
      setPresentations([]);
    } finally {
      trackEvent(MixpanelEvent.Dashboard_Page_Viewed, {
        pathname,
        presentation_count: fetchedCount,
        load_failed: hasError,
      });
      setIsLoading(false);
    }
  };

  const removePresentation = (presentationId: string) => {
    setPresentations((prev: any) =>
      prev ? prev.filter((p: any) => p.id !== presentationId) : []
    );
  };

  return (
    <div className="min-h-screen  w-full px-6 pb-10 relative">
      <div className="sticky top-0 right-0 z-50 py-[28px]   backdrop-blur mb-4 ">
        <div className="flex xl:flex-row flex-col gap-6 xl:gap-0 items-center justify-between">
          <h3 className=" text-[28px] tracking-[-0.84px] font-unbounded font-normal text-[#101828] flex items-center gap-2">

            Slide Presentations
          </h3>
          <div className="flex  gap-2.5 max-sm:w-full max-md:justify-center max-sm:flex-wrap">



            <Link
              href="/upload"
              onClick={() => trackEvent(MixpanelEvent.Dashboard_New_Presentation_Clicked, { pathname, source: "dashboard_header" })}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-black text-sm font-semibold font-syne shadow-sm hover:shadow-md"
              aria-label="Create new presentation"
              style={{
                borderRadius: "48px",
                background: "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
              }}
            >

              <span className="hidden md:inline">New presentation</span>
              <span className="md:hidden">New</span>
              <ChevronRight className="w-4 h-4" />
            </Link>

          </div>
        </div>
      </div>
      <PresentationGrid
        presentations={presentations}
        type="slide"
        isLoading={isLoading}
        error={error}
        onPresentationDeleted={removePresentation}
      />
      <div
        className='fixed z-0 bottom-[-16.5rem] left-0 w-full h-full'
        style={{
          height: "341px",
          borderRadius: '1440px',
          background: 'radial-gradient(5.92% 104.69% at 50% 100%, rgba(122, 90, 248, 0.00) 0%, rgba(255, 255, 255, 0.00) 100%), radial-gradient(50% 50% at 50% 50%, rgba(122, 90, 248, 0.80) 0%, rgba(122, 90, 248, 0.00) 100%)',
        }}
      />
    </div>
  );
};

export default DashboardPage;
