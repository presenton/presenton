import * as z from 'zod';
import React from 'react';

export const Schema = z.object({
    title: z.string().describe('The main heading of the slide').default('Our Team Members'),
    subtitle: z.string().max(300).describe('A descriptive sub-heading explaining the team\'s focus').default('Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies.'),
    teamMembers: z.array(z.object({
        name: z.string().max(30).describe('Name of the team member'),
        designation: z.string().max(40).describe('Job title or role of the team member'),
        image: z.object({
            __image_url__: z.string(),
            __image_prompt__: z.string().max(100)
        }).describe('Profile picture of the team member'),
        summary: z.string().max(100).describe('Short summary or focus area of the team member')
    })).max(4).describe('List of team members').default([
        {
            name: 'Hannah Morales',
            designation: 'Founder & CEO',
            image: {
                __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
                __image_prompt__: 'Professional headshot of a female executive smiling'
            },
            summary: 'Focus on companies with 500+ employees.'
        },
        {
            name: 'Hannah Morales',
            designation: 'Founder & CEO',
            image: {
                __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
                __image_prompt__: 'Professional headshot of a female executive smiling'
            },
            summary: 'Focus on companies with 500+ employees.'
        },
        {
            name: 'Hannah Morales',
            designation: 'Founder & CEO',
            image: {
                __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
                __image_prompt__: 'Professional headshot of a female executive smiling'
            },
            summary: 'Focus on companies with 500+ employees.'
        },
        {
            name: 'Hannah Morales',
            designation: 'Founder & CEO',
            image: {
                __image_url__: 'https://presenton-public-assets.s3.ap-southeast-1.amazonaws.com/replaceable_template_image.png',
                __image_prompt__: 'Professional headshot of a female executive smiling'
            },
            summary: 'Focus on companies with 500+ employees.'
        }
    ]),
});

export const layoutId = 'title-subtitle-four-team-member-cards';
export const layoutName = 'Title Subtitle Four Team Member Cards';
export const layoutDescription = 'A professional team showcase slide featuring a centered title and descriptive subtitle at the top, followed by four horizontal team member cards. Each card displays the member\'s name, designation, profile image, and a brief summary. Ideal for introducing leadership teams, project members, advisory boards, or key personnel with their roles and focus areas.';

const dynamicSlideLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const { title, subtitle, teamMembers } = data;

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex flex-col "

                style={{
                    backgroundColor: 'var(--background-color,#FFFFFF)',
                    fontFamily: 'var(--body-font-family,Albert Sans)',
                }}
            >
                {/* Header Section */}
                <div className="flex flex-col items-center text-center mb-16 px-12 pt-12">
                    <h1 className="text-[42.7px] font-bold tracking-[-1.6px] mb-4"

                        style={{ color: 'var(--background-text,#000000)' }}
                    >
                        {title}
                    </h1>
                    <p className="text-[16px]  leading-[1.6] max-w-[800px]"

                        style={{ color: 'var(--background-text,#000000)' }}
                    >
                        {subtitle}
                    </p>
                </div>

                {/* Cards Section */}
                <div className="flex justify-center items-start gap-[43px] flex-grow px-12">
                    {teamMembers?.map((member, index) => (
                        <div key={index} className="flex flex-col bg-[#BEF4FE] rounded-[11.3px] border-[0.7px] border-[#EBEBEB] w-[214.6px] h-[339.8px] overflow-hidden"

                            style={{
                                backgroundColor: 'var(--primary-color,#BEF4FE)',
                                borderColor: 'var(--stroke,#EBEBEB)',
                            }}
                        >
                            <div className="flex flex-col items-center justify-center py-4 px-2 min-h-[64px]">
                                <span className="text-[17.8px]  tracking-[-0.1px] "

                                    style={{ color: 'var(--primary-text,#000000)' }}
                                >
                                    {member?.name}
                                </span>
                                <span className="text-[14.2px]  tracking-[-0.1px] "

                                    style={{ color: 'var(--primary-text,#55626E)' }}
                                >
                                    {member?.designation}
                                </span>
                            </div>

                            <div className="w-full h-[214.6px]">
                                <img
                                    src={member?.image?.__image_url__}
                                    alt={member?.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>

                            <div className="flex-grow flex items-center justify-center text-center p-3">
                                <span className="text-[16px]  leading-[1.2] "

                                    style={{ color: 'var(--primary-text,#000000)' }}
                                >
                                    {member?.summary}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Section */}
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

