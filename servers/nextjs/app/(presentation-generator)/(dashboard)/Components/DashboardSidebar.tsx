"use client";

import React from "react";
import { LayoutDashboard, Star, Brain, Settings, HelpCircle, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import TemplateNavIcon from "./TemplateNavIcon";
import LocaleMenu from "@/components/LocaleMenu";



export const defaultNavItems = [
    { key: "dashboard" as const, labelKey: "nav.dashboard", icon: LayoutDashboard },
    { key: "templates" as const, labelKey: "nav.templates", icon: Star },
    { key: "designs" as const, labelKey: "nav.templates", icon: Brain },
    { key: "community" as const, labelKey: "nav.community", icon: UsersRound },



];
export const BelongingNavItems = [
    { key: "settings" as const, labelKey: "nav.settings", icon: Settings },

]

type DashboardSidebarProps = {
    showCommunity?: boolean;
    showTemplates?: boolean;
};

const DashboardSidebar = ({
    showCommunity = true,
    showTemplates = true,
}: DashboardSidebarProps) => {
    const pathname = usePathname();
    const t = useTranslations();

    return (
        <aside
            className={`sticky top-0 flex h-screen w-[114px] shrink-0 flex-col justify-between border-e border-[#E1E1E5] bg-[#F6F6F9] px-4 py-8 backdrop-blur ${pathname === "/admin" ? "max-sm:w-[64px] max-sm:px-2 max-sm:[&_span]:hidden" : ""}`}
            aria-label={t("sidebar.ariaLabel")}
        >
            <div>

                <Link href={`/dashboard`} className="flex items-center  pb-6 border-b border-[#E1E1E5]   gap-2    ">
                    <div className="bg-[#7C51F8] rounded-full cursor-pointer p-1 flex justify-center items-center mx-auto">
                        <img src="/logo-with-bg.png" alt="Presenton logo" className="h-[40px] object-contain w-full" />
                    </div>
                </Link>
                <nav className="pt-6 font-syne" aria-label={t("sidebar.navLabel")}>
                    <div className="  space-y-6">

                        {/* Dashboard */}
                        <Link
                            prefetch={false}
                            href={`/dashboard`}
                            className={[
                                "flex flex-col tex-center items-center gap-2  transition-colors",
                                pathname === "/dashboard" ? "" : "ring-transparent",
                            ].join(" ")}
                            aria-label={t("nav.dashboard")}
                            title={t("nav.dashboard")}
                        >
                            <LayoutDashboard className={["h-4 w-4", pathname === "/dashboard" ? "text-[#5146E5]" : "text-slate-600"].join(" ")} />
                            <span className="text-[11px] text-slate-800">{t("nav.dashboard")}</span>
                        </Link>
                        {showTemplates ? 
                        // <Link
                        //     prefetch={false}
                        //     href={`/templates`}
                        //     className={[
                        //         "flex flex-col tex-center items-center gap-2  transition-colors",
                        //         pathname === "/templates" ? "" : "ring-transparent",
                        //     ].join(" ")}
                        //     aria-label="Templates"
                        //     title="Templates"
                        // >
                        //     <div className="flex flex-col cursor-pointer tex-center items-center gap-2  transition-colors">
                        //         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={`${pathname === "/templates" ? "#5146E5" : "#475569"}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M4 14h6" /><path d="M4 2h10" /><rect x="4" y="18" width="16" height="4" rx="1" /><rect x="4" y="6" width="16" height="4" rx="1" /></svg>
                        //         <span className="text-[11px] text-slate-800">Templates</span>
                        //     </div>
                        // </Link> 
                        <Link
              prefetch={false}
              href="/templates"
              className="flex flex-col text-center items-center gap-2 transition-colors"
              aria-label={t("nav.templates")}
              title={t("nav.templates")}
            >
              <TemplateNavIcon active={pathname === "/templates"} />
              <span className="text-[11px] text-slate-800">{t("nav.templates")}</span>
            </Link>
                        : null}
                        {showCommunity ? <Link
                            prefetch={false}
                            href="/community"
                            className="flex flex-col items-center gap-2 text-center transition-colors"
                            aria-label={t("nav.community")}
                            title={t("nav.community")}
                        >
                            <UsersRound className={`h-4 w-4 ${pathname === "/community" ? "text-[#5146E5]" : "text-slate-600"}`} />
                            <span className="text-[11px] text-slate-800">{t("nav.community")}</span>
                        </Link> : null}

                    </div>
                </nav>
            </div>

            <div className="border-t border-[#E1E1E5] pt-5 font-syne">
                <LocaleMenu />
                <div className="py-2"/>
                  <Link
                    href="/settings"
                    aria-label={t("nav.settings")}
                    className="flex flex-col items-center gap-2 transition-colors"
                >
                    <Settings className="h-4 w-4" />
                    <span className="text-[11px] text-slate-800">{t("nav.settings")}</span>
                </Link>
                <div className="py-2"/>
                <Link
                    href="https://docs.presenton.ai/help"
                    aria-label={t("nav.help")}
                    target="_blank"
                    className="flex flex-col items-center gap-2 transition-colors"
                >
                    <HelpCircle className="h-4 w-4" />
                    <span className="text-[11px] text-slate-800">{t("nav.help")}</span>
                </Link>
            </div>

        </aside>
    );
};

export default DashboardSidebar;
