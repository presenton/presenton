import * as z from "zod";

const ChannelSchema = z.object({
  channel: z.string().min(3).max(24).meta({
    description: "Go-to-market channel name.",
  }),
  audience: z.string().min(6).max(38).meta({
    description: "Target audience or segment for the channel.",
  }),
  motion: z.string().min(10).max(56).meta({
    description: "Short description of the channel motion.",
  }),
});

const FunnelStageSchema = z.object({
  stage: z.string().min(3).max(18).meta({
    description: "Funnel stage name.",
  }),
  goal: z.string().min(8).max(36).meta({
    description: "Short goal for the funnel stage.",
  }),
});

export const slideLayoutId = "go-to-market-slide";
export const slideLayoutName = "Go-to-Market Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with channel rows and a compact funnel or motion summary.";

export const Schema = z.object({
  title: z.string().min(4).max(28).default("Go-to-Market").meta({
    description: "Main slide heading.",
  }),
  strategy: z.string().min(24).max(95).default(
    "Start with focused outbound and partner-led access, then expand through usage and customer referrals."
  ).meta({
    description: "Short go-to-market strategy summary.",
  }),
  channels: z.array(ChannelSchema).min(3).max(4).default([
    {
      channel: "Outbound",
      audience: "High-fit operators",
      motion: "Target accounts with urgent workflow visibility needs.",
    },
    {
      channel: "Partners",
      audience: "Service ecosystems",
      motion: "Co-sell through advisors already guiding operational change.",
    },
    {
      channel: "Expansion",
      audience: "Active customers",
      motion: "Grow from one team into adjacent workflows and business units.",
    },
  ]).meta({
    description: "Channel rows.",
  }),
  funnel: z.array(FunnelStageSchema).min(3).max(5).default([
    { stage: "Target", goal: "Define high-fit account list" },
    { stage: "Engage", goal: "Run value-led discovery" },
    { stage: "Convert", goal: "Pilot with clear success criteria" },
    { stage: "Expand", goal: "Land broader workflow coverage" },
  ]).meta({
    description: "Funnel stages shown across the bottom.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const GoToMarketSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    channels: data.channels ?? defaults.channels,
    funnel: data.funnel ?? defaults.funnel,
  } as SchemaType;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden px-[42px] py-[54px]"
        style={{
          backgroundColor: "var(--background-color,#27292d)",
          color: "var(--background-text,#d7d3be)",
          fontFamily: "var(--body-font-family,'DM Serif Display')",
          letterSpacing: 0,
        }}
      >
        <h2 className="break-words text-[76px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>
          {slideData.title}
        </h2>
        <p className="mt-[18px] max-w-[880px] break-words text-[27px] leading-[1.15]" style={{ color: "var(--background-text,#cbc7b2)" }}>
          {slideData.strategy}
        </p>

        <div className="mt-[38px] grid gap-[14px]">
          {slideData.channels.map((channel, index) => (
            <div key={`${channel.channel}-${index}`} className="grid grid-cols-[210px_260px_1fr] gap-[20px] border-b py-[16px]" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
              <p className="break-words text-[33px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>{channel.channel}</p>
              <p className="break-words text-[24px] leading-[1.08]" style={{ color: "var(--primary-color,#dddac7)" }}>{channel.audience}</p>
              <p className="break-words text-[22px] leading-[1.13]" style={{ color: "var(--background-text,#cbc7b2)" }}>{channel.motion}</p>
            </div>
          ))}
        </div>

        <div className="absolute bottom-[44px] left-[42px] right-[42px] grid gap-[18px]" style={{ gridTemplateColumns: `repeat(${slideData.funnel.length}, minmax(0, 1fr))` }}>
          {slideData.funnel.map((stage, index) => (
            <div key={`${stage.stage}-${index}`} className="p-[16px]" style={{ backgroundColor: "var(--primary-color,#dddac7)", color: "var(--primary-text,#27292d)" }}>
              <p className="break-words text-[28px] leading-none">{stage.stage}</p>
              <p className="mt-[10px] break-words text-[18px] leading-[1.1]">{stage.goal}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default GoToMarketSlide;
