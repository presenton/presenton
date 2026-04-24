import * as z from "zod";

import { Fragment } from "react/jsx-runtime";
import { RemoteSvgIcon } from "@/app/hooks/useRemoteSvgIcon";

const ServiceItemSchema = z.object({
  icon: z.object({
    __icon_url__: z.string().default("https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg"),
    __icon_query__: z.string().default("pulse icon"),
  }).default({
    __icon_url__:
      "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
    __icon_query__: "pulse icon",
  }).meta({
    description: "Icon used for service circles.",
  }),
  heading: z.string().min(3).max(30).meta({
    description: "Heading shown below the service icon.",
  }),
  description: z.string().min(20).max(60).meta({
    description: "Supporting description below the service heading.",
  }),
});

export const slideLayoutId = "title-workflow-with-title-description-slide";
export const slideLayoutName = "Title Workflow with Title Description Slide";
export const slideLayoutDescription =
  "A slide with a title and a horizontal flow. Each step contains a circular icon area, a heading, and a description placed underneath. Directional connectors between the circles indicate sequence, and the activeIndex field determines which step is emphasized.";

export const Schema = z.object({
  title: z.string().min(3).max(50).default("Services").meta({
    description: "Slide title shown at the top-left.",
  }),

  activeIndex: z.number().int().min(0).max(2).default(2).meta({
    description: "Zero-based index of the emphasized service step.",
  }),
  items: z
    .array(ServiceItemSchema)
    .min(1)
    .max(5)
    .default([
      {
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "pulse icon",
        },
        heading: "Heading",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "upload icon",
        },
        heading: "Heading",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "pulse icon",
        },
        heading: "Heading",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },
      {
        icon: {
          __icon_url__:
            "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "pulse icon",
        },
        heading: "Heading",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      },

    ])
    .meta({
      description: "Three sequential service items displayed on the slide.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

function ServiceGlyph({
  iconUrl,
  iconAlt,
  isActive,
}: {
  iconUrl: string;
  iconAlt: string;
  isActive: boolean;
}) {
  return (
    <img
      src={iconUrl}
      alt={iconAlt}
      className="h-[62px] w-[62px] object-contain"
      style={{ filter: isActive ? "brightness(0) invert(1)" : "none" }}
    />
  );
}

const ServicesSlide = ({ data }: { data: Partial<SchemaType> }) => {

  const { title, activeIndex, items } = data;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden rounded-[24px] bg-[#f9f8f8]"
        style={{
          backgroundColor: "var(--background-color,#f9f8f8)",
          fontFamily: "var(--body-font-family,'Source Sans 3')",
        }}
      >
        <div
          className="absolute left-0 top-0 w-[42px] rounded-b-[22px] bg-[#157CFF]"
          style={{ height: 185, backgroundColor: "var(--primary-color,#157CFF)" }}
        />

        <div className="px-[70px] pt-[56px]">
          <h2
            className="text-[80px] font-bold leading-[108.4%] tracking-[-2.419px] text-[#232223]"
            style={{ color: "var(--background-text,#232223)" }}
          >
            {title}
          </h2>
        </div>

        <div className="mt-[56px] flex items-start justify-center px-[82px]">
          {items?.map((item, index) => {
            const isActive = index === activeIndex;

            return (
              <Fragment key={`${item.heading}-${index}`}>
                <div key={`${item.heading}-${index}`} className="flex w-[302px] flex-col items-center text-center">
                  <div
                    className={`flex items-center justify-center rounded-full ${isActive
                      ? "bg-[#157CFF] text-white"
                      : "border border-[#157CFF] bg-transparent text-[#157CFE]"
                      }`}
                    style={{
                      width: items?.length === 3 ? '266px' : items?.length === 4 ? '192px' : items?.length === 5 ? '157px' : '266px',
                      height: items?.length === 3 ? '266px' : items?.length === 4 ? '192px' : items?.length === 5 ? '157px' : '270px',
                      backgroundColor: isActive ? "var(--primary-color,#157CFF)" : "transparent",
                      borderColor: "var(--primary-color,#157CFF)",
                      color: isActive ? "var(--primary-text,#ffffff)" : "var(--primary-color,#157CFE)",
                    }}
                  >
                    {/* <ServiceGlyph
                      iconUrl={
                        item.icon?.__icon_url__
                      }
                      iconAlt={
                        item.icon?.__icon_query__
                      }
                      isActive={isActive}
                    /> */}
                    <RemoteSvgIcon
                      url={item.icon?.__icon_url__}
                      strokeColor={"currentColor"}
                      className="h-[62px] w-[62px] object-contain"
                      color={isActive ? "var(--primary-text, #ffffff)" : "var(--primary-color,#157CFE)"}
                      title={item.icon?.__icon_query__}
                    />
                  </div>

                  <h3
                    className="mt-[18px] text-[26px] font-medium tracking-[0.08em] text-[#232223]"
                    style={{
                      fontSize: items?.length === 3 ? '20px' : items?.length === 4 ? '16px' : items?.length === 5 ? '12px' : '20px',
                      color: "var(--background-text,#232223)",
                    }}
                  >
                    {item.heading}
                  </h3>
                  <p
                    className="mt-[12px] max-w-[290px] text-[18px] leading-[1.08] tracking-[-0.04em] text-[#353538]"
                    style={{
                      fontSize: items?.length === 3 ? '24px' : items?.length === 4 ? '17px' : items?.length === 5 ? '14px' : '24px',
                      color: "var(--background-text,#353538)",
                    }}
                  >
                    {item.description}
                  </p>
                </div>

                {index < items?.length - 1 && (
                  <div className=" flex items-center px-1 "
                    style={{
                      marginTop: items?.length === 3 ? '135px' : items?.length === 4 ? '93px' : items?.length === 5 ? '70px' : '135px',
                    }}
                  >
                    {/* <div className="h-px mr-[-10px] w-full bg-[#4d4ef3]"
                    style={{
                      width: items?.length === 3 ? '117px' : items?.length === 4 ? '84px' : items?.length === 5 ? '60px' : '112px',
                    }}
                  />
                  <svg
                    viewBox="0 0 18 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-[18px] w-[18px] text-[#4d4ef3]"
                  >
                    <path
                      d="M5 4L12 9L5 14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg> */}
                    <svg xmlns="http://www.w3.org/2000/svg"
                      style={{
                        width: items?.length === 3 ? '117px' : items?.length === 4 ? '84px' : items?.length === 5 ? '60px' : '112px',
                      }}
                      height="15" viewBox="0 0 119 15" fill="none">
                      <path
                        d="M1 6.36401H0V8.36401H1V7.36401V6.36401ZM118.707 8.07112C119.098 7.6806 119.098 7.04743 118.707 6.65691L112.343 0.292946C111.953 -0.0975785 111.319 -0.0975785 110.929 0.292946C110.538 0.68347 110.538 1.31664 110.929 1.70716L116.586 7.36401L110.929 13.0209C110.538 13.4114 110.538 14.0446 110.929 14.4351C111.319 14.8256 111.953 14.8256 112.343 14.4351L118.707 8.07112ZM1 7.36401V8.36401H118V7.36401V6.36401H1V7.36401Z"
                        fill="var(--primary-color,#157CFE)"
                      />
                    </svg>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default ServicesSlide;
