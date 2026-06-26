import React from "react";
import * as z from "zod";
import { ImageSchema } from "../defaultSchemes";

export const layoutId = "source-figure-focus";
export const layoutName = "Source Figure Focus";
export const layoutDescription =
  "Academic evidence slide for exactly one source figure. Use for paper figures, dense charts, screenshots, or ultra-wide schematics that must remain complete and readable. Renders one contained image, never as a background, gallery, hero crop, team photo, or decorative thumbnail.";

const sourceFigureFocusSchema = z.object({
  title: z.string().min(3).max(70).default("Evidence from the source").meta({
    description: "Slide title. Keep specific and claim-oriented.",
  }),
  takeaway: z.string().min(10).max(180).default("State the main point students should take from this figure.").meta({
    description: "Short takeaway explaining why the figure matters.",
  }),
  figure: ImageSchema.default({
    __image_url__:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1600&auto=format&fit=crop",
    __image_prompt__: "Academic chart or source figure",
  }).meta({
    description:
      "Exactly one source/evidence figure. The renderer preserves the complete image using object-contain.",
  }),
  caption: z.string().min(0).max(220).default("").meta({
    description: "Optional source caption or brief figure description.",
  }),
  sourceNote: z.string().min(0).max(120).default("").meta({
    description: "Optional source/page note, e.g. Figure 4, p. 7.",
  }),
});

export const Schema = sourceFigureFocusSchema;

export type SourceFigureFocusData = z.infer<typeof sourceFigureFocusSchema>;

interface SourceFigureFocusLayoutProps {
  data?: Partial<SourceFigureFocusData>;
}

const SourceFigureFocusLayout: React.FC<SourceFigureFocusLayoutProps> = ({
  data: slideData,
}) => {
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className="w-full max-w-[1280px] max-h-[720px] aspect-video mx-auto rounded-sm shadow-lg overflow-hidden relative z-20"
        style={{
          fontFamily: "var(--heading-font-family,Montserrat)",
          backgroundColor: "var(--background-color, #FFFFFF)",
          color: "var(--background-text, #111827)",
        }}
      >
        <div className="h-full flex flex-col px-12 py-8 gap-4">
          <div className="flex items-start justify-between gap-8">
            <div className="min-w-0">
              <h1
                className="text-[34px] leading-tight font-bold tracking-[-0.02em]"
                style={{ color: "var(--background-text, #1E3A8A)" }}
              >
                {slideData?.title}
              </h1>
              {slideData?.takeaway && (
                <p
                  className="mt-2 text-[17px] leading-snug max-w-[920px]"
                  style={{ color: "var(--background-text, #334155)" }}
                >
                  {slideData.takeaway}
                </p>
              )}
            </div>
            {slideData?.sourceNote && (
              <div
                className="shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold"
                style={{
                  color: "var(--primary-text, #1E3A8A)",
                  backgroundColor: "var(--primary-color, #DBEAFE)",
                }}
              >
                {slideData.sourceNote}
              </div>
            )}
          </div>

          <div
            className="flex-1 min-h-0 rounded-xl border overflow-hidden bg-white flex items-center justify-center"
            style={{ borderColor: "var(--stroke, #E5E7EB)" }}
          >
            {slideData?.figure?.__image_url__ ? (
              <img
                src={slideData.figure.__image_url__}
                alt={slideData.figure.__image_prompt__ || slideData?.title || "source figure"}
                className="w-full h-full object-contain bg-white"
              />
            ) : (
              <div className="text-slate-400 text-lg">Source figure</div>
            )}
          </div>

          {slideData?.caption && (
            <p
              className="text-[13px] leading-snug"
              style={{ color: "var(--background-text, #475569)" }}
            >
              {slideData.caption}
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default SourceFigureFocusLayout;
