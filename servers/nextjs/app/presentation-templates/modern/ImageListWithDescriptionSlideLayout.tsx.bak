import React from "react";
import * as z from "zod";
import { ImageSchema } from "../defaultSchemes";

export const layoutId = "image-list-with-description";
export const layoutName = "Image List with Description";
export const layoutDescription =
  "An image list with description slide layout";

const imageListWithDescriptionSlideSchema = z.object({


  title: z.string().min(3).max(40).default("Product Overview").meta({
    description: "Main title of the slide. Max 4 words",
  }),
  // removed mainDescription
  products: z
    .array(
      z.object({
        title: z.string().min(3).max(50).meta({
          description: "Product title",
        }),
        description: z.string().min(30).max(100).meta({
          description: "Product description",
        }),
        image: ImageSchema.meta({
          description: "Product image",
        }),
        isBlueBackground: z.boolean().default(false).meta({
          description: "Whether the product box has a blue background",
        }),
      }),
    )
    .min(1)
    .max(4)
    .default([
      {
        title: "Internet of Things",
        description:
          "Detail and explain each product. Our examination of community and market issues increases with additional products/services.",
        image: {
          __image_url__:
            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop",
          __image_prompt__: "Person working on electronics with headphones",
        },
        isBlueBackground: true,
      },
      {
        title: "Analytics Dashboard",
        description:
          "Our alternate product category is available. Our products must work together to solve social and economic issues.",
        image: {
          __image_url__: "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=300&h=200&fit=crop",
          __image_prompt__: "Analytics dashboard on laptop screen",
        },
        isBlueBackground: true,
      },
      {
        title: "Mobile App Suite",
        description:
          "Our alternate product category is available. Our products must work together to solve social and economic issues.",
        image: {
          __image_url__: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&h=200&fit=crop",
          __image_prompt__: "Mobile apps on smartphone in hand",
        },
        isBlueBackground: true,
      },
      {
        title: "Smart Home Platform",
        description:
          "Our alternate product category is available. Our products must work together to solve social and economic issues.",
        image: {
          __image_url__:
            "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=300&h=200&fit=crop",
          __image_prompt__:
            "Woman working at computer with technical equipment",
        },
        isBlueBackground: true,
      },
    ])
    .meta({
      description: "List of products or services to showcase",
    }),
});

export const Schema = imageListWithDescriptionSlideSchema;

export type ImageListWithDescriptionSlideData = z.infer<
  typeof imageListWithDescriptionSlideSchema
>;

interface ImageListWithDescriptionSlideLayoutProps {
  data?: Partial<ImageListWithDescriptionSlideData>;
}

const ImageListWithDescriptionSlideLayout: React.FC<ImageListWithDescriptionSlideLayoutProps> = ({
  data: slideData,
}) => {
  const products = slideData?.products || [];

  // Make the product boxes smaller
  const PRODUCT_BOX_HEIGHT = 340; // px (reduced height)
  const PRODUCT_BOX_WIDTH = 200; // px (smaller than before)
  const TEXT_SECTION_HEIGHT = Math.round(PRODUCT_BOX_HEIGHT * 0.56); // ~190px
  const IMAGE_SECTION_HEIGHT = PRODUCT_BOX_HEIGHT - TEXT_SECTION_HEIGHT; // ~150px

  return (
    <>
      {/* Import Google Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        className="w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video relative z-20 mx-auto overflow-hidden"
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
        <div className="flex h-full px-16 pb-16">
          {/* Title at the top */}
          <div className="absolute top-20 left-16 right-16">
            <h1 className="text-5xl font-bold leading-tight text-left" style={{ color: 'var(--background-text, #234CD9)' }}>
              {slideData?.title}
            </h1>
          </div>

          {/* Product Row centered (up to 4 items) */}
          <div className="flex flex-row gap-8 justify-center w-full mt-56">
            {products.slice(0, 4).map((prod, idx) => (
              <div
                key={idx}
                className="flex flex-col items-stretch"
                style={{ width: `${PRODUCT_BOX_WIDTH + 40}px`, height: `${PRODUCT_BOX_HEIGHT + 60}px` }}
              >
                {/* Alternate layout per column: even -> text first; odd -> image first */}
                {idx % 2 === 0 ? (
                  <>
                    <div
                      className={`p-5 flex flex-col justify-center text-center rounded-t-md`}
                      style={{ height: `${TEXT_SECTION_HEIGHT + 32}px`, backgroundColor: 'var(--card-color, #F5F8FE)', color: 'var(--background-text, #234CD9)' }}
                    >
                      <h2 className={`text-xl font-semibold mb-3`}>{prod.title}</h2>
                      <p className={`text-sm leading-relaxed`}>{prod.description}</p>
                    </div>
                    <div className="rounded-b-md overflow-hidden" style={{ height: `${IMAGE_SECTION_HEIGHT + 28}px` }}>
                      <img src={prod.image.__image_url__} alt={prod.image.__image_prompt__ || prod.title} className="w-full h-full object-cover" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-t-md overflow-hidden" style={{ height: `${IMAGE_SECTION_HEIGHT + 28}px` }}>
                      <img src={prod.image.__image_url__} alt={prod.image.__image_prompt__ || prod.title} className="w-full h-full object-cover" />
                    </div>
                    <div
                      className={`p-5 flex flex-col justify-center text-center rounded-b-md`}
                      style={{ height: `${TEXT_SECTION_HEIGHT + 32}px`, backgroundColor: 'var(--card-color, #F5F8FE)', color: 'var(--background-text, #234CD9)' }}
                    >
                      <h2 className={`text-xl font-semibold mb-3`}>{prod.title}</h2>
                      <p className={`text-sm leading-relaxed`}>{prod.description}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Bottom Border */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: 'var(--primary-color, #1E4CD9)' }}></div>
      </div>
    </>
  );
};

export default ImageListWithDescriptionSlideLayout;
