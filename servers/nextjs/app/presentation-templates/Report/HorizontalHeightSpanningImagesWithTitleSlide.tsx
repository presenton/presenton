import * as z from "zod";


const MemberSchema = z.object({
  subtext: z.string().min(2).max(40).meta({
    description: "Subtext for the image.",
  }),
  title: z.string().min(2).max(40).meta({
    description: "Title/name/subject for the image",
  }),
  image: z.object({
    __image_url__: z.string().default("https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/images/placeholder.jpg"),
    __image_prompt__: z.string().default("Professional portrait of a team member"),
  }).default({
    __image_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/images/placeholder.jpg",
    __image_prompt__: "Professional portrait of a team member",
  }),
});

export const slideLayoutId = "horizontal-height-spanning-images-with-title-slide";
export const slideLayoutName = "Horizontal Height Spanning Images with Title Slide";
export const slideLayoutDescription =
  "A slide of portrait cards placed side by side from edge to edge. Each card uses a full-height image background with a content overlay at the bottom containing a short subtext line and a larger title line.";

export const Schema = z.object({
  members: z
    .array(MemberSchema)
    .min(2)
    .max(5)
    .default([
      {
        subtext: "Title",
        title: "Lanny LA",
        image: {
          __image_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/images/placeholder.jpg",
          __image_prompt__: "Professional portrait of a male team member",
        },
      },
      {
        subtext: "Title",
        title: "Lanny LA",
        image: {
          __image_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/images/placeholder.jpg",
          __image_prompt__: "Professional portrait of a female team member",
        },
      },
      {
        subtext: "Title",
        title: "Lanny LA",
        image: {
          __image_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/images/placeholder.jpg",
          __image_prompt__: "Professional portrait of a business manager",
        },
      },
      {
        subtext: "Title",
        title: "Lanny LA",
        image: {
          __image_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/images/placeholder.jpg",
          __image_prompt__: "Professional portrait of a senior employee",
        },
      },
      {
        subtext: "Title",
        title: "Lanny LA",
        image: {
          __image_url__: "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/images/placeholder.jpg",
          __image_prompt__: "Professional portrait of a young executive",
        },
      },
    ])
    .meta({
      description: "List of team members shown as portrait cards. Each member contains a title, subtext, and image.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

const TeamSlide = ({ data }: { data: Partial<SchemaType> }) => {

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap" rel="stylesheet" />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden rounded-[24px] bg-white"
        style={{
          backgroundColor: "var(--background-color,#ffffff)",
          fontFamily: "var(--body-font-family,'Source Sans 3')",
        }}
      >
        <div className="grid h-full "
          style={{ gridTemplateColumns: `repeat(${data?.members?.length}, minmax(0, 1fr))` }}
        >
          {data?.members?.map((member, index) => (
            <div
              key={`${member.title}-${index}`}
              className="relative h-full overflow-hidden"
            >
              <img
                src={member.image.__image_url__}
                alt={member.image.__image_prompt__}
                className="h-full w-full object-cover"
              />
              <div
                className="absolute inset-x-0 bottom-0 h-[240px] bg-gradient-to-t from-[#4d4ef3] via-[#4d4ef3]/55 to-transparent"
                style={{
                  backgroundImage: "linear-gradient(to top, var(--graph-1,#4d4ef3), rgba(77, 78, 243, 0.55), transparent)",
                }}
              />
              <div className="absolute left-0 bottom-0 p-[33px]  text-white" style={{ color: "var(--primary-text,#ffffff)" }}>
                <p
                  className="text-[21px] tracking-[2.074px] font-medium text-white/90"
                  style={{ color: "var(--primary-text,#ffffff)", opacity: 0.9 }}
                >
                  {member.title}
                </p>
                <p className="mt-[14px] text-[28px] ">
                  {member.subtext}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default TeamSlide;
