import React from "react";
import * as z from "zod";
import { ImageSchema } from "../defaultSchemes";

export const layoutId = "images-with-description";
export const layoutName = "Images With Description";
export const layoutDescription =
  "Images with description slide layout";

const imagesWithDescriptionSlideSchema = z.object({
  name: z.string().min(2).max(50).meta({
    description: "Card title",
  }),
  description: z.string().min(20).max(120).meta({
    description: "Short description for the card",
  }),
  image: ImageSchema,
  linkedIn: z.string().optional().meta({
    description: "LinkedIn profile URL (optional)",
  }),
});

const imagesWithDescriptionSlideSchema2 = z.object({
  title: z.string().min(3).max(40).default("Our Team").meta({
    description: "Main title of the slide",
  }),
  subtitle: z.string().min(10).max(120).optional().meta({
    description: "Optional subtitle describing the team",
  }),
  teamMembers: z
    .array(imagesWithDescriptionSlideSchema)
    .min(2)
    .max(4)
    .default([
      {
        name: "Sarah Johnson",
        description:
          "Strategic leader with 15+ years experience in technology and business development. Former VP at Fortune 500 company.",
        image: {
          __image_url__:
            "https://plus.unsplash.com/premium_photo-1661589856899-6dd0871f9db6?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8YnVzaW5lc3N3b21lbnxlbnwwfHwwfHx8MA%3D%3D",
          __image_prompt__: "Professional businesswoman CEO headshot",
        },
      },
      {
        name: "Michael Chen",
        description:
          "Technology expert specializing in scalable architecture and AI solutions. PhD in Computer Science from MIT.",
        image: {
          __image_url__:
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
          __image_prompt__: "Professional businessman CTO headshot",
        },
      },
      {
        name: "Emily Rodriguez",
        description:
          "Sales leader with proven track record of building high-performing teams and driving revenue growth in B2B markets.",
        image: {
          __image_url__:
            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
          __image_prompt__: "Professional businesswoman VP headshot",
        },
      },
      {
        name: "David Kim",
        description:
          "Product strategist focused on user experience and market-driven solutions. Former product manager at leading tech companies.",
        image: {
          __image_url__:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
          __image_prompt__: "Professional businessman product manager headshot",
        },
      },
    ])
    .meta({
      description: "List of team members with their information",
    }),


});

export const Schema = imagesWithDescriptionSlideSchema2;

export type ImagesWithDescriptionSlideData = z.infer<typeof imagesWithDescriptionSlideSchema2>;

interface ImagesWithDescriptionSlideLayoutProps {
  data?: Partial<ImagesWithDescriptionSlideData>;
}

const ImagesWithDescriptionSlideLayout: React.FC<ImagesWithDescriptionSlideLayoutProps> = ({
  data: slideData,
}) => {
  return (
    <>
      {/* Import Montserrat Font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <div
        className="w-full max-w-[1280px] max-h-[720px] aspect-video mx-auto rounded shadow-lg overflow-hidden relative z-20"
        style={{
          fontFamily: "var(--heading-font-family,Montserrat)",
          backgroundColor: "var(--background-color, #FFFFFF)",
        }}
      >
        {/* Header */}
        {((slideData as any)?.__companyName__ || (slideData as any)?._logo_url__) && (
          <div className="absolute top-0 left-0 right-0 px-8 sm:px-12 lg:px-20 pt-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">

                {(slideData as any)?._logo_url__ && <img src={(slideData as any)?._logo_url__} alt="logo" className="w-6 h-6" />}
                {(slideData as any)?.__companyName__ && <span className="text-sm sm:text-base font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                  {(slideData as any)?.__companyName__ || 'Company Name'}
                </span>}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="relative z-10 flex flex-col items-start justify-center h-full px-16 pt-16 pb-8">
          {/* Title */}
          <h1
            className="text-5xl font-bold mb-4 leading-tight text-left"
            style={{ letterSpacing: "-0.03em", color: 'var(--background-text, #234CD9)' }}




          >
            {slideData?.title}
          </h1>
          {/* Subtitle */}
          <p className="text-lg leading-relaxed font-normal mb-12 max-w-lg text-left" style={{ color: 'var(--background-text, #234CD9)' }}>
            {slideData?.subtitle}
          </p>
          {/* Items Row */}
          <div className="flex flex-row w-full justify-between items-start gap-6 mt-1">
            {slideData?.teamMembers?.map((member, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center rounded-lg shadow-md px-6 pt-6 pb-4 w-1/4 min-w-[260px] max-w-[280px] mx-auto"
                style={{ minHeight: 380, backgroundColor: 'var(--card-color, #F5F8FE)' }}
              >
                {/* Image full width */}
                <div className="relative w-full h-40 mb-4 rounded-md overflow-hidden bg-white">
                  {member.image.__image_url__ && (
                    <img
                      src={member.image.__image_url__}
                      alt={member.image.__image_prompt__ || member.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {/* Name */}
                <div className="text-lg font-bold mb-1" style={{ color: 'var(--background-text, #234CD9)' }}>
                  {member.name}
                </div>
                {/* Description */}
                <div className="text-sm text-center mb-2 min-h-[48px]" style={{ color: 'var(--background-text, #234CD9)' }}>
                  {member.description}
                </div>
                {/* LinkedIn Link (if provided) */}
                {member.linkedIn && (
                  <a
                    href={member.linkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs transition-colors duration-200 mt-1"
                    style={{ color: 'var(--background-text, #234CD9)' }}
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    LinkedIn
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Bottom Divider */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: 'var(--primary-color, #1E4CD9)' }} />
      </div>
    </>
  );
};

export default ImagesWithDescriptionSlideLayout;
