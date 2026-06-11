import * as z from "zod";

const WorkflowStepSchema = z.object({
  label: z.string().min(2).max(10).meta({
    description: "Short step number or label.",
  }),
  title: z.string().min(4).max(26).meta({
    description: "Step title.",
  }),
  description: z.string().min(18).max(64).meta({
    description: "Brief description of the step.",
  }),
});

const ProductImageSchema = z.object({
  __image_url__: z.string().url().meta({
    description: "Product, workflow, or interface image URL.",
  }),
  __image_prompt__: z.string().min(8).max(100).meta({
    description: "Short prompt describing the image content.",
  }),
});

export const slideLayoutId = "product-workflow-slide";
export const slideLayoutName = "Product Workflow Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with a product or workflow image and step-based explanation.";

export const Schema = z.object({
  title: z.string().min(4).max(26).default("How It Works").meta({
    description: "Main slide heading.",
  }),
  summary: z
    .string()
    .min(24)
    .max(90)
    .default(
      "The workflow moves from source inputs to prioritized decisions and visible progress."
    )
    .meta({
      description: "Short summary shown under the title.",
    }),
  image: ProductImageSchema.default({
    __image_url__:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80",
    __image_prompt__: "Product dashboard interface on a desktop screen",
  }).meta({
    description: "Image displayed in the product panel.",
  }),
  steps: z
    .array(WorkflowStepSchema)

    .max(4)
    .default([
      {
        label: "01",
        title: "Collect",
        description:
          "Pull updates, requests, and activity signals into the workspace.",
      },
      {
        label: "02",
        title: "Prioritize",
        description: "Rank work by urgency, ownership, and expected impact.",
      },
      {
        label: "03",
        title: "Execute",
        description:
          "Track progress, blockers, and decisions in one shared flow.",
      },
    ])
    .meta({
      description: "Workflow steps shown beside the image.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const ProductWorkflowSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    image: { ...defaults.image, ...(data.image ?? {}) },
    steps: data.steps ?? defaults.steps,
  } as SchemaType;

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden"
        style={{
          backgroundColor: "var(--background-color,#27292d)",
          color: "var(--background-text,#d7d3be)",
          fontFamily: "var(--body-font-family,'DM Serif Display')",
          letterSpacing: 0,
        }}
      >
        <div className="px-[42px] pt-[52px]">
          <h2
            className="break-words text-[76px] leading-none"
            style={{ color: "var(--background-text,#dddac7)" }}
          >
            {slideData.title}
          </h2>
          <p
            className="mt-[18px]  break-words text-[26px] leading-[1.15]"
            style={{ color: "var(--background-text,#cbc7b2)" }}
          >
            {slideData.summary}
          </p>
        </div>
        <div className="grid h-full grid-cols-[52%_48%] gap-[30px] px-[42px] mt-10 ">
          <div
            className="h-[410px] border p-[12px]"
            style={{ borderColor: "var(--stroke,#8d8a7d)" }}
          >
            <img
              src={slideData.image.__image_url__}
              alt={slideData.image.__image_prompt__}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col justify-start gap-[18px] pb-[4px]">
            {slideData.steps.map((step, index) => (
              <div
                key={`${step.label}-${index}`}
                className="grid grid-cols-[46px_1fr] gap-[18px] border-b pb-[18px]"
                style={{ borderColor: "var(--stroke,#8d8a7d)" }}
              >
                <p
                  className="text-[30px] leading-none"
                  style={{ color: "var(--primary-color,#dddac7)" }}
                >
                  {step.label}
                </p>
                <div>
                  <p
                    className="break-words text-[34px] leading-none"
                    style={{ color: "var(--background-text,#dddac7)" }}
                  >
                    {step.title}
                  </p>
                  <p
                    className="mt-[10px] break-words text-[21px] leading-[1.14]"
                    style={{ color: "var(--background-text,#cbc7b2)" }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductWorkflowSlide;
