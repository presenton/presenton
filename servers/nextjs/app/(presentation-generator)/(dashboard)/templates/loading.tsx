import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'

const TemplateCardSkeleton = () => (
    <Card className="overflow-hidden shadow-none sm:shadow-none relative">
        <Skeleton className="absolute top-2 left-2 h-6 w-20 rounded-full z-40" />
        <img src="/card_bg.svg" alt="" className="absolute top-0 left-0 w-full h-full object-cover" />
        <div className="p-5">
            <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-video rounded" />
                ))}
            </div>
        </div>
        <div className="flex items-center justify-between p-5 bg-white border-t border-[#EDEEEF] relative z-40">
            <div className="w-[191px]">
                <Skeleton className="h-4 w-28 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-4 w-4" />
        </div>
    </Card>
)

const Loading = () => {
    return (
        <div className="min-h-screen relative font-syne">
            <div
                className="fixed z-0 -bottom-[16.5rem] left-0 w-full h-full"
                style={{
                    height: '341px',
                    borderRadius: '1440px',
                    background: 'radial-gradient(5.92% 104.69% at 50% 100%, rgba(122, 90, 248, 0.00) 0%, rgba(255, 255, 255, 0.00) 100%), radial-gradient(50% 50% at 50% 50%, rgba(122, 90, 248, 0.80) 0%, rgba(122, 90, 248, 0.00) 100%)',
                }}
            />
            <div className="sticky top-0 right-0 z-50 py-[28px] px-6 backdrop-blur">
                <div className="flex xl:flex-row flex-col gap-6 xl:gap-0 items-center justify-between">
                    <Skeleton className="h-[34px] w-[180px] rounded-lg" />
                    <div className="flex gap-2.5 max-sm:w-full max-md:justify-center max-sm:flex-wrap">
                        <Skeleton className="h-[42px] w-[160px] rounded-[48px]" />
                    </div>
                </div>
            </div>

            <div className="mx-auto px-6 py-8">
                <div className="p-1 rounded-[40px] bg-[#ffffff] w-fit border border-[#EDEEEF] flex items-center justify-center">
                    <Skeleton className="h-8 w-20 rounded-[70px]" />
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-1" width="2" height="17" viewBox="0 0 2 17" fill="none">
                        <path d="M1 0V16.5" stroke="#EDECEC" strokeWidth="2" />
                    </svg>
                    <Skeleton className="h-8 w-20 rounded-[70px]" />
                </div>

                <section className="my-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {Array.from({ length: 4 }).map((_, idx) => (
                            <TemplateCardSkeleton key={idx} />
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}

export default Loading
