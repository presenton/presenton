import { RemoteSvgIcon } from "@/app/hooks/useRemoteSvgIcon";
import * as z from "zod";

const FeatureCardSchema = z.object({
  title: z.string().min(3).max(17).meta({
    description: "Title shown on each card.",
  }),
  description: z.string().min(18).max(80).meta({
    description: "Description shown on each card.",
  }),
  icon: z.object({
    __icon_url__: z.string().meta({
      description: "URL to icon",
    }),
    __icon_query__: z.string().meta({
      description: "Query used to search the icon",
    }),
  }).default({
    __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
    __icon_query__: "check icon",
  }).meta({
    description: "Suiting icon used for each bullet in plan cards.",
  }),
});

export const slideLayoutId = "cards-grid-slide";
export const slideLayoutName = "Cards Grid Slide";
export const slideLayoutDescription =
  "A list of cards in grid with title, icon and compact description in each.";

export const Schema = z.object({
  title: z.string().min(6).max(20).default("Feature Grid").meta({
    description: "Slide title shown above the grid.",
  }),
  features: z
    .array(FeatureCardSchema)
    .min(1)
    .max(6)
    .default([
      {
        title: "Modern Stack",
        description: "Built with React, TypeScript, and Tailwind CSS for maximum developer experience.",
        icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        title: "Component Library ",
        description: "Reusable UI components with consistent design patterns.",
        icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        title: "CLI Tools",
        description: "Command-line utilities for scaffolding and automation.",
        icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        title: "Analytics",
        description: "Built-in tracking and performance monitoring.",
        icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        title: "Version Control",
        description: "Git-based workflow with automated deployments.",
        icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        title: "Best Practices",
        description: "Following industry standards and modern development patterns.",
        icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
    ])
    .meta({
      description: "Six feature cards displayed in a 3x2 grid.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const CodeSlide04FeatureGrid = ({ data }: { data: Partial<SchemaType> }) => {


  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden p-[53px]"
        style={{
          backgroundColor: "var(--background-color,#101B37)",
          fontFamily: "var(--body-font-family,Nunito Sans)",
        }}
      >


        <h2 className="text-[64px] font-medium tracking-[-0.03em]" style={{ color: "var(--background-text,#f2f4ff)" }}>{data.title}</h2>

        <div className="mt-[26px] grid flex-1 grid-cols-3 items-center h-fit  gap-[26px]">
          {data?.features?.map((feature) => (
            <div
              key={feature.title}
              className="rounded-[18px] border p-[26px]"
              style={{
                boxShadow: "0 33.333px 66.667px -16px rgba(0, 0, 0, 0.25)",
                borderColor: "var(--stroke,#1D293D80)",
                backgroundColor: "var(--card-color,#0F172B80)",
              }}
            >
              <div className="flex items-start justify-between gap-[8px]">
                <h3 className="text-[26px] font-medium" style={{ color: "var(--background-text,#ffffff)" }}>{feature.title}</h3>
                <span
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-full border text-[18px]"
                  style={{
                    borderColor: "var(--primary-color,#2B7FFF4D)",
                    backgroundColor: "var(--primary-color,#2B7FFF33)",
                  }}
                >
                  {/* <img src={feature.icon.__icon_url__} alt={feature.icon.__icon_query__} className="h-[24px] w-[24px] object-contain"
                    style={{
                      filter: "invert(1)",
                    }}
                  /> */}
                  <RemoteSvgIcon
                    url={feature.icon?.__icon_url__}
                    strokeColor={"currentColor"}
                    className="h-[24px] w-[24px] object-contain"
                    color="var(--primary-text, #ffffff)"
                    title={feature.icon.__icon_query__}
                  />
                </span>
              </div>
              <p className="mt-[12px] text-[18px] leading-[136%]" style={{ color: "var(--background-text,#90A1B9)" }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default CodeSlide04FeatureGrid;
