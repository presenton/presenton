import * as z from "zod";

const MetricSchema = z.object({
  value: z.string().min(2).max(6).meta({
    description: "Primary metric value.",
  }),
  label: z.string().min(3).max(15).meta({
    description: "Metric label text.",
  }),
  subtext: z.string().min(3).max(30).meta({
      description: "Metric subtext/description.",
  }),
});

export const slideLayoutId = "metrics-grid-slide";
export const slideLayoutName = "Metrics Grid Slide";
export const slideLayoutDescription =
  "A slide with metrics card grid and title at the top.";

export const Schema = z.object({
  title: z.string().min(6).max(18).default("Metrics").meta({
    description: "Slide heading shown above the KPI cards.",
  }),
  metrics: z
    .array(MetricSchema)
    .min(1)
    .max(6)
    .default([
      { value: "99.9%", label: "Uptime", subtext: "Last 12 months" },
      { value: "<100ms", label: "Response Time", subtext: "Last 12 months" },
      { value: "50k+", label: "Active Users", subtext: "Last 12 months" },
      { value: "99.9%", label: "Uptime", subtext: "Last 12 months" },
      { value: "<100ms", label: "Response Time", subtext: "Last 12 months" },
      { value: "50k+", label: "Active Users", subtext: "Last 12 months" },
    ])
    .meta({
      description: "Metrics cards in a grid.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const CodeSlide11MetricsGrid = ({ data }: { data: Partial<SchemaType> }) => {

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden rounded-[24px] border p-[40px]"
        style={{
          borderColor: "var(--stroke,#243272)",
          backgroundColor: "var(--background-color,#101B37)",
          color: "var(--background-text,#edf1ff)",
          fontFamily: "var(--body-font-family,Nunito Sans)",
        }}
      >



        <h2 className="text-[64px] font-medium" style={{ color: "var(--background-text,#ffffff)" }}>{data.title}</h2>

        <div className="mt-[53px] grid flex-1 grid-cols-3 gap-[14px]">
          {data?.metrics?.map((metric, index) => (
            <div
              key={`metric-grid-${index}`}
              className="rounded-[16px] border pt-[26px] px-[26px] pb-[16px] text-center"
              style={{
                borderColor: "var(--stroke,#1D293D80)",
                backgroundColor: "var(--card-color,#0F172B80)",
              }}
            >
              <p className="text-[64px] font-semibold leading-none" style={{ color: "var(--graph-0,#8bb4ff)" }}>{metric.value}</p>
              <p className="mt-[13px] text-[26px]" style={{ color: "var(--background-text,#edf1ff)" }}>{metric.label}</p>
              <p className="mt-[13px] text-[18px]" style={{ color: "var(--background-text,#8fa2d8)" }}>{metric.subtext}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default CodeSlide11MetricsGrid;
