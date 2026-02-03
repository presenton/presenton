import React from 'react'
import * as z from "zod";
import { ImageSchema } from '@/presentation-templates/defaultSchemes';
import ActionableLogo from '@/components/ActionableLogo';
import { cn } from '@/lib/utils';
import ActionableWrapper from '@/components/ActionableWrapper';
import ActionableTitle from '@/components/ActionableTitle';
import ActionableSubTitle from '@/components/ActionableSubTitle';
import ActionableParagraph from '@/components/ActionableParagraph';
import ActionableImage from '@/components/ActionableImage';
import { ActionableMainContent } from '@/components/ActionableMainContent';

export const layoutId = 'image-slide'
export const layoutName = 'Image Slide'
export const layoutDescription = 'A two-column slide layout with an image on one side and content sections on the other.'

const contentSectionSchema = z.object({
  heading: z.string().min(3).max(60).default("Section Heading").meta({
    description: "Section heading",
  }),
  text: z.string().min(20).max(140).default("Section content text describing key points and information for this particular section.").meta({
    description: "Section content text",
  })
})

const imageSlideSchema = z.object({
  title: z.string().min(3).max(50).default("Innovation Framework").meta({
    description: "Main title of the slide",
  }),
  subtitle: z.string().min(5).max(100).default("Building sustainable solutions through collaborative design and cutting-edge technology implementation").meta({
    description: "Subtitle text",
  }),
  image: ImageSchema.default({
    __image_url__: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80",
    __image_prompt__: "Diverse team collaborating on innovative project with modern technology"
  }).meta({
    description: "Main image for the slide",
  }),
  contentHeading: z.string().min(3).max(60).default("Core Principles").meta({
    description: "Heading for the content section",
  }),
  contentSections: z.array(contentSectionSchema).min(1).max(3).default([
    {
      heading: "User-Centric Design",
      text: "Every decision is guided by deep user research and continuous feedback loops, ensuring our solutions truly address real-world needs and pain."
    },
    {
      heading: "Agile Methodology",
      text: "Iterative development cycles enable rapid prototyping, testing, and refinement while maintaining flexibility to adapt to changing."
    },
    {
      heading: "Data-Driven Insights",
      text: "Comprehensive analytics and metrics inform strategic decisions, helping us optimize performance and measure impact across all keys."
    }
  ]).meta({
    description: "Content sections with headings and text",
  })
})

export const Schema = imageSlideSchema

export type ImageSlideData = z.infer<typeof imageSlideSchema>

const ImageSlideLayout: React.FC<{ data: ImageSlideData }> = ({ data }) => {
  const title = data.title;
  const subtitle = data.subtitle;
  const image = data.image;
  const contentTitle = data.contentHeading;
  const contentSections = data.contentSections;

  return (
    <ActionableWrapper className="flex">
      <div className="w-3/5 h-full p-[50px] flex flex-col justify-between">
        <ActionableLogo />
        <ActionableMainContent className='gap-5'>
          <ActionableTitle>
            {title}
          </ActionableTitle>
          <ActionableParagraph>
            {subtitle}
          </ActionableParagraph>
          <ActionableSubTitle>
            {contentTitle}
          </ActionableSubTitle>
          <div className="gap-6 grid grid-cols-2">
            {contentSections.map((section, index) => (
              <div key={index} className={cn("px-6 py-5  bg-[#F5F5F5] flex flex-col gap-1.5", { "col-span-2": index === 2 })}>
                <h3 className="font-semibold text-xl leading-[150%]" style={{ fontFamily: "Geist, sans-serif" }}>
                  {section.heading}
                </h3>
                <ActionableParagraph>
                  {section.text}
                </ActionableParagraph>
              </div>
            ))}
          </div>
        </ActionableMainContent>
      </div>
      <div className='w-2/5'>
        <ActionableImage
          src={image.__image_url__}
          alt={image.__image_prompt__}
        />
      </div>
    </ActionableWrapper>
  );
};

export default ImageSlideLayout;
