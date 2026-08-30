import { Sparkles } from "lucide-react";

export type SmartSelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export default function SmartHtmlSelectionOverlay({
  hoverRect,
  selectionRect,
}: {
  hoverRect: SmartSelectionRect | null;
  selectionRect: SmartSelectionRect | null;
}) {
  return (
    <>
      {hoverRect && (
        <div
          aria-hidden="true"
          data-smart-selection-overlay="hover"
          className="pointer-events-none fixed z-[80] border border-[#5B8DEF]"
          style={{
            ...hoverRect,
            backgroundColor: "rgba(91, 141, 239, 0.08)",
          }}
        />
      )}
      {selectionRect && (
        <div
          aria-hidden="true"
          data-smart-selection-overlay="selected"
          className="pointer-events-none fixed z-[81] border border-[#5B8DEF]"
          style={{
            ...selectionRect,
            backgroundColor: "rgba(91, 141, 239, 0.14)",
          }}
        >
          <span
            className="absolute right-0 inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-[3px] bg-[#5B8DEF] px-1.5 font-syne text-[10px] font-semibold leading-none text-white shadow-sm"
            style={{ top: selectionRect.top > 28 ? -22 : 2 }}
          >
            <Sparkles className="h-3 w-3" />
            AI edit
          </span>
        </div>
      )}
    </>
  );
}
