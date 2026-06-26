import * as z from 'zod';


export const Schema = z.object({
    title: z.string().max(20).describe('The main title of the slide').default('Executive Summary'),
    description: z.string().max(250).describe('The main descriptive text').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    image: z.object({
        __image_url__: z.string(),
        __image_prompt__: z.string().max(100),
    }).describe('The primary image on the right side of the slide').default({
        __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
        __image_prompt__: 'A diverse team of professionals in business suits stacking their hands together in the center for a team huddle, symbolizing unity and partnership.',
    }),
});


export const layoutId = 'title-description-large-image-right';
export const layoutName = 'Title Description Large Image Right';
export const layoutDescription = 'A balanced two-column layout with a title and descriptive text on the left, and a large prominent image on the right. The footer includes a website link and a decorative line. Ideal for introducing topics, highlighting concepts with strong visual support, or presenting narratives that benefit from an impactful image.';

/**
 * dynamicSlideLayout React Component.
 */
const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, description, image } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col font-['Albert_Sans']"

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Albert Sans)',
                }}
            >
                {/* Main Content Area */}
                <div className="flex-1 flex px-[90px] pt-[31px] gap-[94px] items-start">
                    {/* Left Column: Text */}
                    <div className="flex-1 flex flex-col mt-[191px]">
                        {title && (
                            <h1
                                className="text-[42.7px] font-bold text-[#101828] leading-[43.9px] mb-[15px]"
                                style={{ fontFamily: 'Albert Sans', fontWeight: 700, letterSpacing: '-1.6px', color: 'var(--background-text,#000000)' }}
                            >
                                {title}
                            </h1>
                        )}
                        {description && (
                            <p
                                className="text-[16px] text-[#000000] leading-[28.5px]"
                                style={{ fontFamily: 'Albert Sans', fontWeight: 400, color: 'var(--background-text,#000000)' }}
                            >
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Right Column: Image */}
                    <div className="w-[531px] h-[567px] flex-shrink-0">
                        {image?.__image_url__ && (
                            <img
                                src={image.__image_url__}
                                alt={image.__image_prompt__ || 'Executive Summary Image'}
                                className="w-full h-full object-cover rounded-xl"
                            />
                        )}
                    </div>
                </div>

                {/* Footer Area */}
                <div className="flex items-center px-[72px] w-full absolute bottom-4 ">
                    {((data as any)?.__companyName__ || (data as any)?._logo_url__) && <div className="flex items-center gap-1 mr-1">
                        {(data as any)?._logo_url__ && <img src={(data as any)?._logo_url__} alt="logo" className="w-[60px] object-contain" />}
                        <span
                            style={{ backgroundColor: 'var(--stroke, #F0F0F0)' }}
                            className=' w-[2px] h-4'></span>
                        {(data as any)?.__companyName__ && <span className="text-sm  font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                            {(data as any)?.__companyName__ || 'Company Name'}
                        </span>}
                    </div>}
                    <div className="flex-1 h-[3.6px] bg-[#55626E]"

                        style={{ backgroundColor: 'var(--background-text,#55626E)' }}
                    />
                    <div className="relative ml-[-4px] w-[58px] h-[58px] flex items-center justify-center">
                        <div className="w-[41px] h-[41px] bg-[#4D5463] rotate-45"

                            style={{ backgroundColor: 'var(--background-text,#4D5463)' }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};
export default dynamicSlideLayout;

