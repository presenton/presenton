import { RemoteSvgIcon } from "@/app/hooks/useRemoteSvgIcon";
import * as z from "zod";


export const slideLayoutId = "title-with-process-steps-slide";
export const slideLayoutName = "Title with Process Steps Slide";
export const slideLayoutDescription =
  "A slide with a title on top and a content section containing a process diagrams with connected hexagon steps and alternating caption blocks above and below the flow.";

const StepSchema = z.object({
  label: z.string().max(16).meta({
    description: "Short uppercase label for a process step.",
  }),
  body: z.string().max(32).meta({
    description: "Brief explanatory text for the process step.",
  }),
  icon: z.object({
    __icon_url__: z.string(),
    __icon_query__: z.string(),
  }).default({
    __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
    __icon_query__: "pulse icon",
  }),
  highlighted: z.boolean().default(false).meta({
    description: "Whether the hexagon is emphasized with dark fill.",
  }),
});

export const Schema = z.object({
  title: z.string().max(14).default("PROCESS").meta({
    description: "Main title shown in the top-left corner.",
  }),

  steps: z
    .array(StepSchema)

    .max(5)
    .default([
      {
        label: "TAGLINE TAGLINE", body: "Ut enim ad minim. Ut enim ad minim. ", icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "pulse icon",
        }, highlighted: false
      },
      {
        label: "TAGLINE", body: "Ut enim ad minim. Ut enim ad minim.", icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "upload icon",
        }, highlighted: false
      },
      {
        label: "TAGLINE", body: "Ut enim ad minim.", icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "pulse icon",
        }, highlighted: false
      },
      {
        label: "TAGLINE", body: "Ut enim ad minim.", icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "upload icon",
        }, highlighted: false
      },
      {
        label: "TAGLINE", body: "Ut enim ad minim.", icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "pulse icon",
        }, highlighted: true
      },
    ])
    .meta({
      description: "Process steps rendered from left to right.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;


const ProcessSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const { title, steps } = data;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden flex flex-col "
        style={{
          backgroundColor: "var(--background-color,#DAE1DE)",
          fontFamily: "var(--body-font-family,'Bricolage Grotesque')",
        }}
      >
        <div className="px-[66px] pt-[50px]">
          <h2
            className="text-[80px] font-semibold leading-[108.4%] tracking-[-2.419px] text-[#15342D]"
            style={{ color: "var(--primary-color,#15342D)" }}
          >
            {title}
          </h2>
        </div>
        <div className="flex justify-center  items-center w-full flex-1 px-[66px]  ">
          {steps?.map((step, index) => {
            if (index % 2 === 0) {
              return (
                <div key={index} className="relative  w-[230px] "
                  style={{
                    marginLeft: index === 0 ? '0' : '-10px',
                  }}
                >
                  <div className="relative  flex justify-center items-center h-[276px]">
                    <div className="relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[42px] h-[42px] flex items-center justify-center">

                        <RemoteSvgIcon
                          url={step.icon?.__icon_url__}
                          strokeColor={"currentColor"}
                          className="w-full h-full object-contain"
                          color={step.highlighted ? "var(--primary-text, #4C68DF)" : "var(--background-text,#315f58)"}
                          title={step.icon.__icon_query__}
                        />
                      </div>

                      <svg xmlns="http://www.w3.org/2000/svg" width="162" height="187" viewBox="0 0 162 187" fill="none">
                        <path d="M80.8291 0L161.658 46.6667V140L80.8291 186.667L2.28882e-05 140V46.6667L80.8291 0Z" fill={step.highlighted ? "var(--primary-color,#15342D)" : "var(--card-color,#FEFEFF)"} />
                      </svg>
                    </div>
                    <div className="absolute bottom-1 right-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="231" height="134" viewBox="0 0 231 134" fill="none">
                        <path d="M230.94 66.667L115.47 133.334L0 66.667V0H11.5469V60L115.47 120L219.393 60V0H230.94V66.667Z" fill="var(--card-color,#FEFEFF)" />
                      </svg>
                    </div>
                  </div>
                  <div className=" absolute bottom-[-120px] left-0   text-center mt-[60px]">
                    <p
                      className="text-[20px] font-semibold  tracking-[2.074px] text-[#15342D]"
                      style={{ color: "var(--primary-color,#15342D)" }}
                    >
                      {step.label}
                    </p>
                    <p
                      className="mt-[6px] text-[24px] leading-[1.2] text-[#315f58]"
                      style={{ color: "var(--background-text,#315f58)" }}
                    >
                      {step.body}
                    </p>
                  </div>
                </div>
              )
            }
            else {
              return (
                <div key={index} className="relative w-[230px]"
                  style={{
                    marginLeft: index === 0 ? '0' : '-11px',
                    marginTop: '2px',
                  }}
                >
                  <div className=" absolute top-[-140px] left-0     text-center">
                    <p
                      className="text-[20px] font-semibold  tracking-[2.074px] text-[#15342D]"
                      style={{ color: "var(--primary-color,#15342D)" }}
                    >
                      {step.label}
                    </p>
                    <p
                      className="mt-[6px] text-[24px] leading-[1.2] text-[#315f58]"
                      style={{ color: "var(--background-text,#315f58)" }}
                    >
                      {step.body}
                    </p>
                  </div>

                  <div className="relative w-[230px] flex justify-center items-center h-[276px]">
                    <div className="relative">
                      <svg xmlns="http://www.w3.org/2000/svg" width="162" height="187" viewBox="0 0 162 187" fill="none">
                        <path d="M80.8291 0L161.658 46.6667V140L80.8291 186.667L2.28882e-05 140V46.6667L80.8291 0Z" fill={step.highlighted ? "var(--primary-color,#15342D)" : "var(--card-color,#FEFEFF)"} />
                      </svg>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[42px] h-[42px] flex items-center justify-center">
                        <RemoteSvgIcon
                          url={step.icon?.__icon_url__}
                          strokeColor={"currentColor"}
                          className="w-full h-full object-contain"
                          color={step.highlighted ? "var(--primary-text, #4C68DF)" : "var(--background-text,#315f58)"}
                          title={step.icon.__icon_query__}
                        />
                      </div>
                    </div>
                    <div className="absolute top-1 right-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="231" height="134" viewBox="0 0 231 134" fill="none">
                        <path d="M230.94 66.667L115.47 0L0 66.667V133.333H11.5469V73.333L115.47 13.333L219.394 73.333V133.333H230.94V66.667Z" fill="var(--card-color,#FEFEFF)" />
                      </svg>
                    </div>
                  </div>
                </div>
              )
            }
          })}
        </div>
      </div>
    </>
  );
};

export default ProcessSlide;
