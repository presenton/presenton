import React from "react";
import * as z from "zod";
import { ImageSchema } from "../defaultSchemes";

export const layoutId = "image-and-description";
export const layoutName = "Image And Description";
export const layoutDescription =
  "A slide layout with a title, a description, and an image.";

const imageWithDescriptionSlideSchema = z.object({
  title: z.string().min(3).max(30).default("Image With Description").meta({
    description: "Main title of the slide",
  }),
  content: z
    .string()
    .min(25)
    .max(300)
    .default(
      "In the presentation session, the background/introduction can be filled with information that is arranged systematically and effectively with respect to an interesting topic to be used as material for discussion at the opening of the presentation session. The introduction can provide a general overview for those who are listening to your presentation so that the key words on the topic of discussion are emphasized during this background/introductory presentation session.",
    )
    .meta({
      description: "Main content text describing the company or topic",
    }),

  image: ImageSchema.default({
    __image_url__:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop",
    __image_prompt__: "Abstract business background",
  }).meta({
    description:
      "Optional supporting image for the slide (building, office, etc.)",
  }),
});

export const Schema = imageWithDescriptionSlideSchema;

export type ImageWithDescriptionSlideData = z.infer<typeof imageWithDescriptionSlideSchema>;

interface ImageWithDescriptionSlideLayoutProps {
  data?: Partial<ImageWithDescriptionSlideData>;
}

const ImageWithDescriptionSlideLayout: React.FC<ImageWithDescriptionSlideLayoutProps> = ({
  data: slideData,
}) => {
  return (
    <>
      {/* Import fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className="w-full rounded-sm max-w-[1280px] shadow-lg  aspect-video relative z-20 mx-auto overflow-hidden"
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

        {/* Main content area */}
        <div className="flex h-full px-16 pb-16">
          {/* Left side - Image */}
          <div className="flex-1 pr-16 flex items-center pt-8">
            <div className="w-full h-96 overflow-hidden">
              {slideData?.image ? (
                <img
                  src={slideData.image.__image_url__}
                  alt={slideData.image.__image_prompt__}
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Default building facade */
                <div className="w-full h-full bg-gray-200 relative">
                  {/* Building structure simulation */}
                  <div className="absolute inset-0 bg-gray-300"></div>

                  {/* Horizontal lines (building floors) */}
                  <div className="absolute inset-0">
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-full border-t border-gray-400 opacity-60"
                        style={{ top: `${(i + 1) * 8}%` }}
                      ></div>
                    ))}
                  </div>

                  {/* Vertical lines (building columns) */}
                  <div className="absolute inset-0">
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute h-full border-l border-gray-400 opacity-40"
                        style={{ left: `${(i + 1) * 16}%` }}
                      ></div>
                    ))}
                  </div>

                  {/* Windows */}
                  <div className="absolute inset-0 grid grid-cols-4 gap-2 p-4">
                    {[...Array(32)].map((_, i) => (
                      <div
                        key={i}
                        className="bg-blue-100 opacity-60 rounded-sm border border-gray-300"
                      ></div>
                    ))}
                  </div>

                  {/* Building edge highlight */}
                  <div className="absolute right-0 top-0 w-1 h-full bg-white opacity-80"></div>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Content */}
          <div className="flex-1 pl-16 flex flex-col justify-center">
            {slideData?.title && (
              <h2 className="text-5xl font-bold mb-12 leading-tight" style={{ color: 'var(--background-text, #1E4CD9)' }}>
                {slideData?.title}
              </h2>
            )}

            {slideData?.content && (
              <div className="text-lg leading-relaxed font-normal max-w-lg" style={{ color: 'var(--background-text, #334155)' }}>
                {slideData?.content}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ImageWithDescriptionSlideLayout;
