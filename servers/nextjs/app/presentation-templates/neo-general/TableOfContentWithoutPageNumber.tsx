/**
 * Zod Schema for Table of Content Slide
 * Defined based on the visual elements observed in the reference.
 */
import * as z from 'zod';

export const Schema = z.object({
    title: z.string().max(30).describe('The main heading of the slide').default('Table of Content'),
    items: z.array(z.object({
        number: z.string().max(5).describe('Sequence number or index').default('1'),
        label: z.string().max(40).describe('Label text for the item').default('Introduction'),
    })).describe('List of items displayed in two columns').default([
        { number: '1', label: 'Introduction' },
        { number: '2', label: 'Key Findings' },
        { number: '3', label: 'Data Analysis' },
        { number: '4', label: 'Recommendations' },
        { number: '5', label: 'Conclusion' },
        { number: '6', label: 'Introduction' },
        { number: '7', label: 'Key Findings' },
        { number: '8', label: 'Data Analysis' },
        { number: '9', label: 'Recommendations' },
        { number: '10', label: 'Conclusion' },
    ]),
});

type DataProps = z.infer<typeof Schema>;

export const layoutId = 'title-two-column-numbered-list';
export const layoutName = 'Split Title With Two Column Numbered List';
export const layoutDescription = 'A split layout with large title on the left and two-column numbered list on the right. Each item displays a numbered circle badge and label.';

/**
 * dynamicSlideLayout - A React component representing a Table of Content slide.
 */
const dynamicSlideLayout: React.FC<{ data: Partial<DataProps> }> = ({ data }) => {
    const { title, items = [] } = data;

    // Split items into two columns for the layout
    const half = Math.ceil(items.length / 2);
    const firstCol = items.slice(0, half);
    const secondCol = items.slice(half);

    // Helper to format title with a newline after the first word to match visual reference
    const formattedTitle = title?.split(' ').map((word, i) => (i === 1 ? `\n${word}` : (i > 1 ? ` ${word}` : word))).join('');

    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-[#FFFFFE] z-20 mx-auto overflow-hidden flex items-center px-[90px] font-['Poppins']"

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
                {/* Left Section: Title and Decorative Bar */}
                <div className="flex-[1.2] flex flex-col justify-center h-full">
                    <div className="max-w-[400px]">
                        <h1 className="text-[42.7px] font-bold  leading-[1.05] tracking-[-2px] whitespace-pre-wrap"

                            style={{
                                color: 'var(--background-text,#101828)'
                            }}
                        >
                            {formattedTitle}
                        </h1>
                        <div className="w-[116.6px] h-[5.7px] mt-[12px]"

                            style={{
                                backgroundColor: 'var(--primary-color,#9234EB)'
                            }}
                        />
                    </div>
                </div>

                {/* Right Section: Two Columns of Numbered Items */}
                <div className="flex-[1.8] flex justify-between items-center h-full py-[100px] gap-8">
                    {/* First Column */}
                    <div className="flex flex-col gap-[55px] flex-1">
                        {firstCol.map((item, index) => (
                            <div key={`col1-${index}`} className="flex items-center gap-[24px]">
                                <div className="w-[50.8px] h-[50.3px] rounded-full flex items-center justify-center shrink-0"

                                    style={{
                                        backgroundColor: 'var(--primary-color,#703AC9)'
                                    }}
                                >
                                    <span className="text-[20.6px] font-normal leading-none"

                                        style={{
                                            color: 'var(--primary-text,#FFFFFF)'
                                        }}
                                    >
                                        {item?.number}
                                    </span>
                                </div>
                                <span className="text-[20.6px] font-normal "

                                    style={{
                                        color: 'var(--background-text,#18181B)'
                                    }}
                                >
                                    {item?.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Second Column */}
                    <div className="flex flex-col gap-[55px] flex-1">
                        {secondCol.map((item, index) => (
                            <div key={`col2-${index}`} className="flex items-center gap-[24px]">
                                <div className="w-[50.8px] h-[50.3px] rounded-full flex items-center justify-center shrink-0"

                                    style={{
                                        backgroundColor: 'var(--primary-color,#703AC9)'
                                    }}
                                >
                                    <span className="text-[20.6px] font-normal leading-none"

                                        style={{
                                            color: 'var(--primary-text,#FFFFFF)'
                                        }}
                                    >
                                        {item?.number}
                                    </span>
                                </div>
                                <span className="text-[20.6px] font-normal "

                                    style={{
                                        color: 'var(--background-text,#18181B)'
                                    }}
                                >
                                    {item?.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default dynamicSlideLayout;