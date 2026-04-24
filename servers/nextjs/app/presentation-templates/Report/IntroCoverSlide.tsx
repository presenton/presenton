import * as z from "zod";

export const Schema = z.object({
  titleFirstLine: z.string().min(1).max(12).default("Company's ").meta({
    description: "First half of title or heading",
  }),
  titleSecondLine: z.string().min(1).max(12).default("Annual Report").meta({
    description: "Second half of title or heading",
  }),
  name: z.string().min(1).max(10).optional().default("John Doe").meta({
    description: "Name of the presenter/individual/company/organization.",
  }),
  position: z.string().min(1).max(20).default("Company Name | Strategy, Content, growth").meta({
    description: "Position or role of the presenter or address of the company/organization.",
  }),
})
export type SchemaType = z.infer<typeof Schema>;
export const slideLayoutId = "intro-slide";
export const slideLayoutName = "Intro/Cover Slide";
export const slideLayoutDescription =
  "A cover/intro slide with a two-line title section, a divider directly beneath the title, and a presenter information block below the divider containing a name line and a supporting role or company line.";
const IntroSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const { titleFirstLine, titleSecondLine, name, position } = data;

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet" />
      <div
        className='relative w-[1280px] h-[720px] aspect-video  flex flex-col justify-center items-center bg-white'
        style={{
          backgroundColor: "var(--background-color,#ffffff)",
          fontFamily: "var(--body-font-family,'Source Sans 3')",
        }}
      >
        <svg className="absolute top-0 left-10" xmlns="http://www.w3.org/2000/svg" width="116" height="251" viewBox="0 0 116 251" fill="none">
          <path d="M0 0H44.6667V228.333C44.6667 240.668 34.6677 250.667 22.3333 250.667C9.99898 250.667 0 240.668 0 228.333V0Z" fill="var(--primary-color,#147CFE)" />
          <path d="M71.3334 0H116V163C116 175.334 106.001 185.333 93.6667 185.333C81.3324 185.333 71.3334 175.334 71.3334 163V0Z" fill="var(--primary-color,#147CFE)" />
        </svg>
        <svg className="absolute bottom-0 right-10 rotate-180" xmlns="http://www.w3.org/2000/svg" width="116" height="251" viewBox="0 0 116 251" fill="none">
          <path d="M0 0H44.6667V228.333C44.6667 240.668 34.6677 250.667 22.3333 250.667C9.99898 250.667 0 240.668 0 228.333V0Z" fill="var(--primary-color,#147CFE)" />
          <path d="M71.3334 0H116V163C116 175.334 106.001 185.333 93.6667 185.333C81.3324 185.333 71.3334 175.334 71.3334 163V0Z" fill="var(--primary-color,#147CFE)" />
        </svg>

        <div>
          <h1
            className="text-[#232223] text-[133px] italic text-center font-bold capitalize tracking-[-2.8px]"
            style={{ color: "var(--background-text,#232223)" }}
          >
            {titleFirstLine}
          </h1>
          <p
            className="text-[#232223] text-[93px]  text-center font-medium capitalize tracking-[-2.8px]"
            style={{ color: "var(--background-text,#232223)" }}
          >
            {titleSecondLine}
          </p>
        </div>
        <div
          className="bg-[#CD7721] w-[67px] h-0.5 my-[78px]"
          style={{ backgroundColor: "var(--graph-2,#CD7721)" }}
        />
        <div className="text-center">
          <h4 className="text-[#232223] text-[40px]  pb-4" style={{ color: "var(--background-text,#232223)" }}>{name}</h4>
          <p className="text-[19px] text-[#232223]" style={{ color: "var(--background-text,#232223)" }}>{position}</p>
        </div>

      </div>
    </>
  )
}

export default IntroSlide
