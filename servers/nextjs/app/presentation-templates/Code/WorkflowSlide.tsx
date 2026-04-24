import { RemoteSvgIcon } from "@/app/hooks/useRemoteSvgIcon";
import { Fragment } from "react";
import * as z from "zod";

const WorkflowStepSchema = z.object({
  title: z.string().min(3).max(12).meta({
    description: "Step title shown in each workflow card.",
  }),
  description: z.string().min(18).max(50).meta({
    description: "Short step description text.",
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
  }),
});

export const slideLayoutId = "workflow-slide";
export const slideLayoutName = "Workflow Slide";
export const slideLayoutDescription =
  "A workflow slide with cards and directional arrows between steps.";

export const Schema = z.object({
  title: z.string().min(6).max(16).default("Workflow").meta({
    description: "Slide title shown above the workflow row.",
  }),
  steps: z
    .array(WorkflowStepSchema)
    .min(1)
    .max(4)
    .default([
      {
        title: "Design",
        description: "Create wireframes and design system components.",
        icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        title: "Develop",
        description: "Build features using modern frameworks and best practices.",
        icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        title: "Test & QA",
        description: "Run automated tests and quality assurance checks.",
        icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
      {
        title: "Deploy",
        description: "Ship to production with CI and CD pipeline automation.",
        icon: {
          __icon_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
          __icon_query__: "check icon",
        },
      },
    ])
    .meta({
      description: "Workflow steps shown in sequence.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const CodeSlide06Workflow = ({ data }: { data: Partial<SchemaType> }) => {

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

        <h2 className="text-[64px] font-medium" style={{ color: "var(--background-text,#ffffff)" }}>{data.title}</h2>

        <div className="mt-[52px] grid flex-1  justify-center items-center gap-[12px]"

          style={{
            gridTemplateColumns: data.steps?.length === 1 ? '1fr' : data?.steps?.length === 2 ? '1fr auto 1fr' : data?.steps?.length === 3 ? '1fr auto 1fr auto 1fr' : data?.steps?.length === 4 ? '1fr auto 1fr auto 1fr auto 1fr' : '1fr auto 1fr auto 1fr auto 1fr auto 1fr',
          }}
        >
          {data?.steps?.map((step, index) => (
            <Fragment key={`${step.title}-${index}`}>
              <div
                className="rounded-[18px] border max-w-[500px] mx-auto  p-[21px] text-center"
                style={{
                  boxShadow: "0 33.333px 66.667px -16px rgba(0, 0, 0, 0.25)",
                  borderColor: "var(--stroke,#1D293D80)",
                  backgroundColor: "var(--card-color,#0F172B80)",
                }}
              >
                <div
                  className="mx-auto flex h-[75px] w-[75px] items-center justify-center rounded-full border"
                  style={{
                    borderColor: "var(--primary-color,#2B7FFF80)",
                    backgroundColor: "var(--primary-color,#2B7FFF33)",
                  }}
                >
                  <RemoteSvgIcon
                    url={step.icon?.__icon_url__}
                    strokeColor={"currentColor"}
                    className="h-[37px] w-[37px] object-contain"
                    color="var(--primary-text, #ffffff)"
                    title={step.icon.__icon_query__}
                  />
                  {/* <img src={step.icon.__icon_url__} alt={step.icon.__icon_query__} className="h-[37px] w-[37px] object-contain"
                    style={{
                      filter: "invert(1)",
                    }}
                  /> */}
                </div>
                <h3 className="mt-[12px] text-[24px] font-medium" style={{ color: "var(--background-text,#ffffff)" }}>{step.title}</h3>
                <p className="mt-[12px] text-[18px]" style={{ color: "var(--background-text,#90A1B9)" }}>{step.description}</p>
              </div>
              {index < (data?.steps?.length || 0) - 1 && (
                <svg xmlns="http://www.w3.org/2000/svg" width="43" height="43" viewBox="0 0 43 43" fill="none">
                  <path d="M8.88892 21.3333H33.7778" stroke="var(--primary-color,#51A2FF)" strokeWidth="3.55556" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21.3334 8.88892L33.7778 21.3334L21.3334 33.7778" stroke="var(--primary-color,#51A2FF)" strokeWidth="3.55556" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </Fragment>
          ))}

        </div>
      </div>
    </>
  );
};

export default CodeSlide06Workflow;
