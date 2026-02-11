import React from 'react'
import * as z from "zod";


const ImageSchema = z.object({
  __image_url__: z.string().url().default("https://images.pexels.com/photos/31527637/pexels-photo-31527637.jpeg").meta({
    description: "URL to image",
  }),
  __image_prompt__: z.string().min(10).max(120).default("Muted cover background image with subtle subject suitable for contact slide").meta({
    description: "Prompt used to generate the image. Max 24 words",
  }),
})

const IconSchema = z.object({
  __icon_url__: z.string().default("data:svg+xml,placeholder").meta({
    description: "URL to icon",
  }),
  __icon_query__: z.string().min(3).max(24).default("photo placeholder").meta({
    description: "Query used to search the icon. Max 5 words",
  }),
})

const layoutId = "header-left-media-contact-info-slide"
const layoutName = "ContactLayout"
const layoutDescription = "A slide with a top bar, left media with overlay and bottom bar, and right content with header and text blocks. This should only be used for contact information."

const Schema = z.object({
  metaMaxWords: z.number().default(24).meta({
    description: "Maximum number of words in any single text field",
  }),

  topBar: z.object({

    pageNumber: z.string().min(1).max(3).default("9").meta({
      description: "Top-right number text. Max 1 word",
    }),
  }).default({

    pageNumber: "9",
  }),

  leftPanel: z.object({
    backgroundImage: ImageSchema.default({
      __image_url__: "https://images.pexels.com/photos/31527637/pexels-photo-31527637.jpeg",
      __image_prompt__: "Muted cover background image with subtle subject suitable for contact slide",
    }),
    centerIcon: IconSchema.default({
      __icon_url__: "data:svg+xml,placeholder",
      __icon_query__: "photo placeholder",
    }),
    websiteBar: z.object({
      websiteText: z.string().min(12).max(30).default("www.yourwebsite.com").meta({
        description: "Website text in bottom green bar. Max 4 words",
      }),
      actionIcon: IconSchema.default({
        __icon_url__: "data:svg+xml,plus-arrow",
        __icon_query__: "plus arrow",
      }),
    }).default({
      websiteText: "www.yourwebsite.com",
      actionIcon: {
        __icon_url__: "data:svg+xml,plus-arrow",
        __icon_query__: "plus arrow",
      },
    }),
  }).default({
    backgroundImage: {
      __image_url__: "https://images.pexels.com/photos/326576/pexels-photo-326576.jpeg",
      __image_prompt__: "Muted cover background image with subtle subject suitable for contact slide",
    },
    centerIcon: {
      __icon_url__: "data:svg+xml,placeholder",
      __icon_query__: "photo placeholder",
    },
    websiteBar: {
      websiteText: "www.yourwebsite.com",
      actionIcon: {
        __icon_url__: "data:svg+xml,plus-arrow",
        __icon_query__: "plus arrow",
      },
    },
  }),

  rightContent: z.object({
    title: z.string().min(18).max(40).default("Let’s Get in\nTouch with Us").meta({
      description: "Main heading. Max 6 words",
    }),
    sections: z.array(z.object({
      label: z.string().min(4).max(10).default("Label").meta({
        description: "Section label text. Max 2 words",
      }),
      value: z.string().min(8).max(50).default("Value text").meta({
        description: "Section value text. Max 100 characters",
      }),
      showDivider: z.boolean().default(true).meta({
        description: "Whether to show bottom divider",
      }),
    })).min(1).max(3).default([
      {
        label: "Address",
        value: "Boston, Downtown Main Street 233, New York, US",
        showDivider: true,
      },
      {
        label: "Phone",
        value: "+1234 2345 1234",
        showDivider: true,
      },
      {
        label: "E-mail:",
        value: "mail@company.com",
        showDivider: false,
      },
    ]).meta({
      description: "List of content sections",
    }),
  }).default({
    title: "Let’s Get in\nTouch with Us",
    sections: [
      {
        label: "Address",
        value: "Boston, Downtown Main Street 233, New York, US",
        showDivider: true,
      },
      {
        label: "Phone",
        value: "+1234 2345 1234",
        showDivider: true,
      },
      {
        label: "E-mail:",
        value: "mail@company.com",
        showDivider: false,
      },
    ],
  }),
})

type SlideData = z.infer<typeof Schema>

interface SlideLayoutProps {
  data?: Partial<SlideData>
}

const dynamicSlideLayout: React.FC<SlideLayoutProps> = ({ data: slideData }) => {
  const sections = slideData?.rightContent?.sections || []

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <div className=" w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden" style={{ fontFamily: "var(--heading-font-family,Playfair Display)", backgroundColor: 'var(--card-background-color, #FFFFFF)' }}>


        <div className="px-10 pt-4 pb-8 h-[calc(100%-72px)]">
          <div className="grid grid-cols-[640px_1fr] gap-x-16 h-full">
            <div className="relative h-full overflow-hidden" style={{ backgroundColor: 'var(--tertiary-accent-color, #E5E7EB)' }}>
              <img
                src={slideData?.leftPanel?.backgroundImage?.__image_url__ || ""}
                alt={slideData?.leftPanel?.backgroundImage?.__image_prompt__ || "cover"}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>

            <div className="h-full flex flex-col">
              <h1 className=" text-[64px] leading-[1.12] font-semibold mb-8 whitespace-pre-line" style={{ color: 'var(--text-heading-color, #111827)' }}>
                {slideData?.rightContent?.title || "Let’s Get in\nTouch with Us"}
              </h1>

              <div className="mb-6">
                {sections.map((sec, idx) => (
                  <div key={idx} className={idx < sections.length - 1 ? "mb-6" : "mt-2"}>
                    <div className="text-[24px]  font-semibold mb-2" style={{ color: 'var(--text-heading-color, #111827)' }}>
                      {sec.label}
                    </div>
                    <div className="text-[18px] " style={{ color: 'var(--text-body-color, #6B7280)' }}>
                      {sec.value}
                    </div>
                    {sec.showDivider ? <div className="border-b border-gray-300 mt-6"></div> : null}
                  </div>
                ))}
              </div>

              <div className="flex-1"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export { Schema, layoutId, layoutName, layoutDescription }
export default dynamicSlideLayout