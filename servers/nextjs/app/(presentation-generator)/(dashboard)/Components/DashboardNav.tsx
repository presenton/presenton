"use client";

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import React, { } from 'react'
import { useTranslations } from 'next-intl';
import { BelongingNavItems, defaultNavItems } from './DashboardSidebar';
import { usePathname } from 'next/navigation';

const DashboardNav = () => {
    const pathname = usePathname();
    const t = useTranslations();
    const activeTab = pathname.split("?")[0].split("/").pop();
    const activeItem = [...defaultNavItems, ...BelongingNavItems].find((i: any) => i.key === activeTab);

    const title = activeItem
        ? t(activeItem.labelKey)
        : activeTab
            ? activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
            : null;

    return (
        <div className="sticky top-0 right-0 z-50 py-[28px]   backdrop-blur ">
            <div className="flex xl:flex-row flex-col gap-6 xl:gap-0 items-center justify-between">
                <h3 className=" text-[28px] tracking-[-0.84px] font-syne font-medium  text-[#101828] flex items-center gap-2">

                    {title}
                </h3>
                <div className="flex  gap-2.5 max-sm:w-full max-md:justify-center max-sm:flex-wrap">



                    {activeTab !== "playground" && activeTab !== "theme" && <Link
                        href="/generate"
                        className="group motion-press inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-black text-sm font-medium shadow-sm hover:shadow-md"
                        aria-label={t("nav.newPresentation")}
                        style={{
                            borderRadius: "48px",
                            background: "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
                        }}
                    >

                        <span className="hidden md:inline">{t("nav.newPresentation")}</span>
                        <span className="md:hidden">{t("nav.new")}</span>
                        <ChevronRight className="motion-arrow w-4 h-4" />
                    </Link>}
                    
                </div>
            </div>
        </div>
    )
}

export default DashboardNav
