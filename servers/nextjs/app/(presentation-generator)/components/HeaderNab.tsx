"use client";
import { LayoutDashboard, Settings, Upload } from "lucide-react";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { RootState } from "@/store/store";
import { useSelector } from "react-redux";

const HeaderNav = () => {

  const canChangeKeys = useSelector((state: RootState) => state.userConfig.can_change_keys);
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2">

      <Link
        href="/dashboard"
        prefetch={false}
        className="flex items-center gap-2 px-3 py-2 text-[#101323]  rounded-md transition-colors outline-none"
        role="menuitem"
        onClick={() => trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/dashboard" })}
      >
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-sm font-medium font-manrope">
          Dashboard
        </span>
      </Link>
      {canChangeKeys && (
        <Link
          href="/settings"
          prefetch={false}
          className="flex items-center gap-2 px-3 py-2 text-[#101323]  rounded-md transition-colors outline-none"
          role="menuitem"
          onClick={() => trackEvent(MixpanelEvent.Navigation, { from: pathname, to: "/settings" })}
        >
          <Settings className="w-5 h-5" />
          <span className="text-sm font-medium font-manrope">
            Settings
          </span>
        </Link>
      )}
    </div>
  );
};

export default HeaderNav;
