"use client";
/* eslint-disable @next/next/no-img-element */

import { Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { cn } from "@/lib/utils";

const CreateCustomTemplate = ({
  selectionPage = false,
  onClick,
}: {
  selectionPage?: boolean;
  onClick?: () => void;
}) => {
    const router = useRouter();

    const handleOpenTemplateBuilder = () => {
        trackEvent(MixpanelEvent.Templates_Build_Template_Clicked);
        onClick?.();
        router.push("/custom-template");
    };

    return (
        <div
            onClick={handleOpenTemplateBuilder}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenTemplateBuilder();
                }
            }}
            role="button"
            tabIndex={0}
            className={cn(
              "w-full cursor-pointer overflow-hidden border border-[#EDEEEF] font-syne",
              selectionPage
                ? "rounded-[12px] !border-0 !shadow-[inset_0_0_0_1px_#EDEEEF]"
                : "rounded-[22px]"
            )}
        >
            <div
              className={cn(
                "relative bg-[#F8FBFB] p-5",
                selectionPage && "h-[249px]"
              )}
            >
                <img src="/card_bg.svg" alt="" className="absolute left-0 top-0 z-[1] h-full w-full object-cover" />
                <div
                  className={cn(
                    "relative z-[4] flex w-full items-center justify-center",
                    selectionPage ? "h-full" : "aspect-video"
                  )}
                >
                    <div
                      className={cn(
                        "flex items-center justify-center rounded-full bg-[#7A5AF8]",
                        selectionPage ? "h-12 w-12" : "h-[36px] w-[36px]"
                      )}
                      style={{
                          background: "linear-gradient(0deg, rgba(0, 0, 0, 0.20) 0%, rgba(0, 0, 0, 0.20) 100%), #FFF"
                      }}
                    >
                        <div
                          className={cn(
                            "flex items-center justify-center rounded-full bg-white",
                            selectionPage ? "h-9 w-9" : "h-[26px] w-[26px]"
                          )}
                        >
                            <Plus
                              strokeWidth={selectionPage ? 3 : 2}
                              className={cn(
                                "text-[#A2A0A1]",
                                selectionPage
                                  ? "h-[22.395px] w-[22.395px]"
                                  : "h-4 w-4"
                              )}
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div
              className={cn(
                "flex items-center overflow-hidden border-t border-[#EDEEEF] bg-white px-5",
                selectionPage ? "h-20 gap-[15px] py-2.5" : "gap-4 py-4"
              )}
            >
                <div
                  className={cn(
                    "flex items-center justify-center rounded-lg bg-[#7A5AF8] p-2",
                    selectionPage ? "h-[46px] w-[45px]" : "h-[45px] w-[45px]"
                  )}
                >
                    <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                    <h4 className="text-sm font-semibold tracking-[0.14px] text-[#191919]">
                      {selectionPage ? "Build Templates" : "Build Template"}
                    </h4>
                    <p
                      className={cn(
                        "flex items-center gap-2 font-medium text-[#808080]",
                        selectionPage
                          ? "text-sm tracking-[0.14px]"
                          : "text-sm"
                      )}
                    >
                      {selectionPage
                        ? "Build Your Template"
                        : "Build Your Own Template"}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CreateCustomTemplate;
