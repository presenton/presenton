import React from "react"
import * as z from "zod"
import { RemoteSvgIcon } from "@/app/hooks/useRemoteSvgIcon";

const layoutId = "icon-bullet-list-description-slide"
const layoutName = "Icon Bullet List Description"
const layoutDescription = "Bullet list with title, description, and icon"

const IconSchema = z
  .object({
    __icon_url__: z
      .string()
      .default(
        "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/file-text-bold.svg"
      ),
    __icon_query__: z.string().min(0).max(80).default("feature icon"),
  })
  .default({
    __icon_url__:
      "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/file-text-bold.svg",
    __icon_query__: "feature icon",
  })

const FeatureSchema = z
  .object({
    title: z.string().min(4).max(28).default("Customizable Workflows"),
    body: z
      .string()
      .min(20)
      .max(140)
      .default("Lorem ipsum dolor sit amet, dolor sit amet."),
    icon: IconSchema,
  })
  .default({
    title: "Customizable Workflows",
    body: "Lorem ipsum dolor sit amet, dolor sit amet.",
    icon: IconSchema.parse({}),
  })

const Schema = z
  .object({

    title: z
      .string()
      .min(8)
      .max(48)
      .default("Key Product Features"),
    description: z
      .string()
      .min(30)
      .max(200)
      .default(
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor."
      ),
    features: z
      .array(FeatureSchema)
      .min(3)
      .max(4)
      .default([
        FeatureSchema.parse({}),
        {
          title: "Multi-Device Access",
          body: "Lorem ipsum dolor sit amet.",
          icon: IconSchema.parse({
            __icon_url__:
              "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/devices-bold.svg",
          }),
        },
        {
          title: "Scalable Architecture",
          body: "Lorem ipsum dolor sit amet.",
          icon: IconSchema.parse({
            __icon_url__:
              "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/chart-line-up-bold.svg",
          }),
        },
        {
          title: "Detailed Reports",
          body: "Lorem ipsum dolor sit amet.",
          icon: IconSchema.parse({
            __icon_url__:
              "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg",
          }),
        },
      ]),
    website: z.string().min(6).max(60).default("www.yourwebsite.com"),
  })
  .default({

    title: "Key Product Features",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor.",
    features: [
      FeatureSchema.parse({}),
      {
        title: "Multi-Device Access",
        body: "Lorem ipsum dolor sit amet.",
        icon: IconSchema.parse({
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/devices-bold.svg",
        }),
      },
      {
        title: "Scalable Architecture",
        body: "Lorem ipsum dolor sit amet.",
        icon: IconSchema.parse({
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/chart-line-up-bold.svg",
        }),
      },
      {
        title: "Detailed Reports",
        body: "Lorem ipsum dolor sit amet.",
        icon: IconSchema.parse({
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/bold/checks-bold.svg",
        }),
      },
    ],
    website: "www.yourwebsite.com",
  })

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const FeatureCards: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const features = slideData?.features || []
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden"
        style={{
          fontFamily: "var(--heading-font-family,Albert Sans)",
          backgroundColor: "var(--card-background-color, #FFFFFF)",
        }}
      >



        {/* Decorative right image area removed to keep imagery-driven design */}

        <div className="px-12 pt-3">
          <h1 className="text-[48px] leading-[1.1] font-semibold" style={{ color: "var(--text-heading-color, #111827)" }}>{slideData?.title}</h1>
          <p className="mt-3 text-[16px] max-w-[760px]" style={{ color: "var(--text-body-color, #6B7280)" }}>{slideData?.description}</p>
        </div>

        {/* Cyan band */}
        <div className="absolute left-0 right-0 bottom-20 h-[160px]" style={{ backgroundColor: 'var(--primary-accent-color, #BFF4FF)' }}></div>

        {/* Feature cards */}
        <div className="relative px-12 mt-8">
          <div className="grid grid-flow-col auto-cols-[260px] gap-6 justify-center">
            {features.slice(0, 4).map((f, i) => (
              <div key={i} className="rounded-[22px] shadow-[0_16px_40px_rgba(0,0,0,0.08)] overflow-hidden" style={{ backgroundColor: 'var(--primary-accent-color, #BFF4FF)' }}>
                <div className="px-6 py-5">
                  <div className="w-10 h-10 rounded-sm flex items-center justify-center" style={{ backgroundColor: 'var(--secondary-accent-color, #FFFFFF)' }}>
                    <RemoteSvgIcon
                      url={f.icon.__icon_url__}
                      strokeColor={"currentColor"}
                      className="w-6 h-6"
                      color="var(--text-heading-color, #111827)"
                      title={f.icon.__icon_query__}
                    />
                  </div>
                  <div className="mt-4 text-[18px] font-semibold whitespace-pre-line" style={{ color: 'var(--text-heading-color, #111827)' }}>{f.title}</div>
                  <p className="mt-3 text-[14px] leading-[1.7]" style={{ color: 'var(--text-body-color, #6B7280)' }}>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer (standardized like IntroSlideLayout) */}
        <div className="absolute bottom-8 left-12 right-12 flex items-center">
          <span className="text-[14px]" style={{ color: "var(--text-body-color, #6B7280)" }}>{slideData?.website}</span>
          <div className="ml-6 h-[2px] flex-1" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
        </div>
        <div className="absolute bottom-7 right-6 w-8 h-8 rotate-45" style={{ backgroundColor: "var(--text-heading-color, #111827)" }}></div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default FeatureCards


