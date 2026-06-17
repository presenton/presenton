import * as z from "zod";

const MarketLayerSchema = z.object({
  label: z.string().min(2).max(12).meta({
    description: "Short market layer label.",
  }),
  value: z.string().min(2).max(14).meta({
    description: "Market size value.",
  }),
  description: z.string().min(14).max(56).meta({
    description: "Short description for the market layer.",
  }),
});

export const slideLayoutId = "market-size-slide";
export const slideLayoutName = "Market Size Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with market size layers and supporting segment notes.";

export const Schema = z.object({
  title: z.string().min(4).max(28).default("Market Size").meta({
    description: "Main slide heading.",
  }),
  subtitle: z.string().min(24).max(95).default(
    "A focused view of the addressable market, reachable segment, and initial serviceable opportunity."
  ).meta({
    description: "Short subtitle explaining the market sizing view.",
  }),
  layers: z.array(MarketLayerSchema).min(3).max(3).default([
    { label: "TAM", value: "$48B", description: "Total addressable opportunity across the category." },
    { label: "SAM", value: "$12B", description: "Reachable segment aligned with the current product scope." },
    { label: "SOM", value: "$1.4B", description: "Initial share targeted through the go-to-market plan." },
  ]).meta({
    description: "Market size layers displayed as large value blocks.",
  }),
  segmentNote: z.string().min(24).max(105).default(
    "The entry segment is selected for clear pain, budget ownership, and repeatable sales motion."
  ).meta({
    description: "Short note explaining the market entry segment.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const MarketSizeSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    layers: data.layers ?? defaults.layers,
  } as SchemaType;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden px-[42px] py-[56px]"
        style={{
          backgroundColor: "var(--background-color,#27292d)",
          color: "var(--background-text,#d7d3be)",
          fontFamily: "var(--body-font-family,'DM Serif Display')",
          letterSpacing: 0,
        }}
      >
        <h2 className="break-words text-[78px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>
          {slideData.title}
        </h2>
        <p className="mt-[18px] max-w-[840px] break-words text-[27px] leading-[1.15]" style={{ color: "var(--background-text,#cbc7b2)" }}>
          {slideData.subtitle}
        </p>

        <div className="mt-[54px] grid gap-[24px]" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {slideData.layers.map((layer, index) => (
            <div key={`${layer.label}-${index}`} className="border px-[28px] py-[34px]" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
              <p className="text-[26px] leading-none" style={{ color: "var(--primary-color,#dddac7)" }}>{layer.label}</p>
              <p className="mt-[24px] break-words text-[82px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>{layer.value}</p>
              <p className="mt-[22px] break-words text-[22px] leading-[1.14]" style={{ color: "var(--background-text,#cbc7b2)" }}>{layer.description}</p>
            </div>
          ))}
        </div>

        <p className="mt-[26px] break-words border-l-[6px] py-[10px] pl-[22px] text-[27px] leading-[1.15]" style={{ borderColor: "var(--primary-color,#dddac7)", color: "var(--background-text,#d7d3be)" }}>
          {slideData.segmentNote}
        </p>
      </div>
    </>
  );
};

export default MarketSizeSlide;
