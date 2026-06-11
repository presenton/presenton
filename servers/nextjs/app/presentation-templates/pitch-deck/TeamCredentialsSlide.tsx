import * as z from "zod";

const MemberImageSchema = z.object({
  __image_url__: z.string().url().meta({
    description: "Team member image URL.",
  }),
  __image_prompt__: z.string().min(6).max(80).meta({
    description: "Short prompt describing the team member image.",
  }),
});

const TeamMemberSchema = z.object({
  name: z.string().min(3).max(34).meta({
    description: "Team member name.",
  }),
  role: z.string().min(4).max(34).meta({
    description: "Team member role.",
  }),
  credential: z.string().min(12).max(64).meta({
    description: "Relevant experience, prior achievement, or credibility note.",
  }),
  image: MemberImageSchema.meta({
    description: "Team member image.",
  }),
});

export const slideLayoutId = "team-credentials-slide";
export const slideLayoutName = "Team Credentials Slide";
export const slideLayoutDescription =
  "A pitch-deck layout with founder or team profiles, roles, images, and credibility notes.";

export const Schema = z.object({
  title: z.string().min(4).max(24).default("Team").meta({
    description: "Main slide heading.",
  }),
  summary: z.string().min(24).max(90).default(
    "The founding team combines product, market, and operational experience in the category."
  ).meta({
    description: "Short summary describing the team.",
  }),
  members: z.array(TeamMemberSchema).min(3).max(4).default([
    {
      name: "Alex Morgan",
      role: "Founder / CEO",
      credential: "Led operations products from zero to enterprise adoption.",
      image: {
        __image_url__: "https://i.pravatar.cc/600?img=11",
        __image_prompt__: "Professional founder portrait",
      },
    },
    {
      name: "Riya Shah",
      role: "Product Lead",
      credential: "Built workflow systems used by distributed teams.",
      image: {
        __image_url__: "https://i.pravatar.cc/600?img=32",
        __image_prompt__: "Professional product leader portrait",
      },
    },
    {
      name: "Jordan Lee",
      role: "Engineering Lead",
      credential: "Scaled data-heavy platforms and reliable integrations.",
      image: {
        __image_url__: "https://i.pravatar.cc/600?img=15",
        __image_prompt__: "Professional engineering leader portrait",
      },
    },
  ]).meta({
    description: "Team member profile cards.",
  }),
});

export type SchemaType = z.infer<typeof Schema>;

const TeamCredentialsSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const defaults = Schema.parse({});
  const slideData = {
    ...defaults,
    ...data,
    members: data.members ?? defaults.members,
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
        <p className="mt-[18px] max-w-[850px] break-words text-[27px] leading-[1.15]" style={{ color: "var(--background-text,#cbc7b2)" }}>
          {slideData.summary}
        </p>

        <div className="mt-[44px] grid gap-[24px]" style={{ gridTemplateColumns: `repeat(${slideData.members.length}, minmax(0, 1fr))` }}>
          {slideData.members.map((member, index) => (
            <div key={`${member.name}-${index}`} className="border p-[18px]" style={{ borderColor: "var(--stroke,#8d8a7d)" }}>
              <img src={member.image.__image_url__} alt={member.image.__image_prompt__} className="h-[230px] w-full object-cover" />
              <p className="mt-[18px] break-words text-[32px] leading-none" style={{ color: "var(--background-text,#dddac7)" }}>{member.name}</p>
              <p className="mt-[8px] break-words text-[23px] leading-[1.08]" style={{ color: "var(--primary-color,#dddac7)" }}>{member.role}</p>
              <p className="mt-[12px] break-words text-[20px] leading-[1.13]" style={{ color: "var(--background-text,#cbc7b2)" }}>{member.credential}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default TeamCredentialsSlide;
