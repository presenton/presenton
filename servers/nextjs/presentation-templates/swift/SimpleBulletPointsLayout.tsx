import React from "react"
import * as z from "zod"

const layoutId = "simple-bullet-points-layout"
const layoutName = "Simple Bullet Points"
const layoutDescription = "Bullet Points with title and description"

const PointSchema = z
  .object({
    title: z.string().min(6).max(60).default("Your Title Here"),
    body: z
      .string()
      .min(30)
      .max(220)
      .default(
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa."
      ),
  })
  .default({ title: "Your Title Here", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa." })

const Schema = z
  .object({
    title: z.string().min(4).max(36).default("Our Commitment"),
    statement: z
      .string()
      .min(20)
      .max(260)
      .default(
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
      ),
    points: z
      .array(PointSchema)
      .min(1)
      .max(4)
      .default([PointSchema.parse({}), PointSchema.parse({}), PointSchema.parse({}), PointSchema.parse({ title: "Your Title Here", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa." })]),
    website: z.string().min(6).max(60).default("www.yourwebsite.com"),
  })
  .default({
    title: "Our Commitment to Innovation",
    statement: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    points: [
      { title: "Your Title Here", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa." },
      { title: "Your Title Here", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa." },
      { title: "Your Title Here", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa." },
      { title: "Your Title Here", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa." },

    ],
    website: "www.yourwebsite.com",
  })

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const CommitmentTwoPoints: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const points = slideData?.points || []
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


        {/* Subtle background motif */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[140px] w-[900px] h-[260px]"
          style={{
            background:
              "radial-gradient(closest-side, rgba(17,24,39,0.06), transparent 70%)",
            filter: "blur(0.2px)",
          }}
        ></div>

        {/* Content grid */}
        <div className="px-12 pt-4 grid grid-cols-[48%_52%] gap-10 items-start">
          {/* Left heading and statement */}
          <div>
            <div className="text-[56px] leading-[1.05] font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>
              {slideData?.title}
            </div>

            <p className="mt-10 text-[16px] leading-[1.8] max-w-[520px]" style={{ color: 'var(--text-body-color, #6B7280)' }}>
              {slideData?.statement}
            </p>
          </div>

          {/* Right numbered points (up to 4) */}
          <div className="flex flex-col gap-6">
            {points.slice(0, 4).map((p, i) => (
              <div key={i}>
                <div className="text-[24px] font-semibold" style={{ color: 'var(--text-heading-color, #111827)' }}>{p.title}</div>
                <p className="mt-3 text-[16px] leading-[1.8]" style={{ color: 'var(--text-body-color, #6B7280)' }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer (align with other Swift layouts) */}
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
export default CommitmentTwoPoints


