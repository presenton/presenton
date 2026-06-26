import * as z from 'zod';
export const Schema = z.object({
    slideNumber: z.string().max(2).describe('Slide number or index').default('1'),
    title: z.string().max(30).describe('The main heading of the slide').default('Executive Summary'),
    description: z.string().max(400).describe('Supporting description text').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    image: z.object({
        __image_url__: z.string(),
        __image_prompt__: z.string().max(100)
    }).default({
        __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
        __image_prompt__: 'A close-up image of a professional team joining hands in a circle, symbolizing unity and partnership.'
    })
});

/**
 * Layout ID, Name, and Description
 */
export const layoutId = 'headline-description-with-image-layout';
export const layoutName = 'Title Description With Image';
export const layoutDescription = 'A minimal two-column layout featuring bold title, accent bar, and description on the left, with a single rounded image on the right.';

/**
 * React Component for the Slide Layout
 */
const HeadlineDescriptionWithImageLayout = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-white z-20 mx-auto overflow-hidden flex items-center font-['Poppins']"

                style={{
                    fontFamily: 'var(--heading-font-family,Poppins)',
                    background: "var(--background-color,#ffffff)"
                }}
            >
                {((data as any)?.__companyName__ || (data as any)?._logo_url__) && (
                    <div className="absolute top-0 left-0 right-0 px-8  pt-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                {(data as any)?._logo_url__ && <img src={(data as any)?._logo_url__} alt="logo" className="w-[60px] object-contain" />}
                                <span
                                    style={{ backgroundColor: 'var(--stroke, #F0F0F0)' }}
                                    className=' w-[2px] h-4'></span>
                                {(data as any)?.__companyName__ && <span className="text-sm  font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                                    {(data as any)?.__companyName__ || 'Company Name'}
                                </span>}
                            </div>
                        </div>
                    </div>
                )}


                <div className="flex w-full h-full px-[89.6px] items-center justify-between gap-[50px]">
                    {/* Left Content Column */}
                    <div className="flex flex-col flex-[1.2] max-w-[570px]">
                        <h1
                            className="text-[42.7px]  font-bold leading-[1.05] tracking-[-2px]"

                            style={{
                                color: 'var(--background-text,#101828)'
                            }}
                        >
                            {data.title}
                        </h1>

                        {/* Decorative Purple Line */}
                        <div className="w-[116.6px] h-[5.7px]"

                            style={{
                                backgroundColor: 'var(--primary-color,#9234EB)'
                            }}
                        />

                        <p
                            className="text-[16.0px] font-normal leading-[28.5px] mt-8"

                            style={{
                                color: 'var(--background-text,#000000)'
                            }}
                        >
                            {data.description}
                        </p>
                    </div>

                    {/* Right Image Column */}
                    <div className="flex flex-1 justify-end items-center ">
                        <div className="w-[380px] h-[350px] overflow-hidden rounded-[30px]">
                            <img
                                src={data.image?.__image_url__}
                                alt={data.image?.__image_prompt__}
                                className="w-full h-full object-cover"
                                style={{ objectPosition: '52.54% 44.07%' }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
export default HeadlineDescriptionWithImageLayout;