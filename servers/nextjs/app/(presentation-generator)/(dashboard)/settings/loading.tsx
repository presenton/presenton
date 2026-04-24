function Shimmer({ className }: { className?: string }) {
    return (
        <div
            className={`bg-[#E1E1E5] animate-pulse rounded-md ${className ?? ""}`}
            aria-hidden
        />
    );
}

export default function LoadingSettings() {
    return (
        <div className="h-screen font-syne flex flex-col overflow-hidden relative">
            <div
                className="fixed z-0 bottom-[-14.5rem] left-0 w-full h-full pointer-events-none"
                style={{
                    height: "341px",
                    borderRadius: "1440px",
                    background:
                        "radial-gradient(5.92% 104.69% at 50% 100%, rgba(122, 90, 248, 0.00) 0%, rgba(255, 255, 255, 0.00) 100%), radial-gradient(50% 50% at 50% 50%, rgba(122, 90, 248, 0.80) 0%, rgba(122, 90, 248, 0.00) 100%)",
                }}
            />

            <main className="w-full mx-auto gap-6 overflow-hidden flex">
                {/* SettingSideBar structure */}
                <div className="w-full max-w-[230px] h-screen px-4 pt-[22px] bg-[#F9FAFB] flex flex-col shrink-0">
                    <div className="mt-[3.15rem] border-b border-[#E1E1E5] pb-3.5">
                        <Shimmer className="h-3 w-16" />
                    </div>
                    <div className="mt-6 flex-1 min-h-0">
                        <Shimmer className="h-3 w-24 mb-2.5" />
                        <div className="p-0.5 rounded-[40px] bg-white w-full max-w-[210px] border border-[#EDEEEF] flex items-center mb-[34px] h-[30px]">
                            <Shimmer className="h-[26px] flex-1 rounded-[70px] mx-0.5" />
                            <Shimmer className="h-[26px] flex-1 rounded-[70px] mx-0.5 opacity-70" />
                        </div>
                        <Shimmer className="h-3 w-28 mb-2.5" />
                        <div className="space-y-2.5">
                            {[0, 1].map((i) => (
                                <div
                                    key={i}
                                    className="w-full rounded-[6px] px-3 py-4 flex items-center gap-1.5 border border-[#EDEEEF] bg-white"
                                >
                                    <Shimmer className="h-[18px] w-[18px] rounded-full shrink-0" />
                                    <Shimmer className="h-3 flex-1 max-w-[100px]" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="border-t border-[#E1E1E5] py-5">
                        <Shimmer className="h-3 w-12 mb-2.5" />
                        <div className="w-full rounded-[6px] p-3 py-4 flex items-center gap-1.5 border border-[#EDEEEF] bg-white">
                            <Shimmer className="h-6 w-6 rounded-full shrink-0" />
                            <Shimmer className="h-3 w-16" />
                        </div>
                    </div>
                </div>

                {/* Main column — matches SettingPage + TextProvider default */}
                <div className="w-full min-w-0 flex flex-col">
                    <div className="sticky top-0 right-0 z-50 py-[28px] backdrop-blur mb-4">
                        <div className="flex gap-3 items-center flex-wrap">
                            <Shimmer className="h-8 w-[132px] rounded-md" />
                            <Shimmer className="h-[22px] w-[min(320px,55%)] rounded-[50px]" />
                        </div>
                    </div>

                    <div className="space-y-6 bg-[#F9F8F8] p-7 rounded-[12px] pr-4 sm:pr-7">
                        {/* TextProvider top card: white panel, icon + copy left, controls right */}
                        <div className="mb-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 rounded-[12px] bg-white pt-5 pb-10 px-6 sm:px-10">
                            <div className="max-w-[290px] shrink-0">
                                <Shimmer className="w-[60px] h-[60px] rounded-[4px]" />
                                <Shimmer className="h-6 w-48 mt-2.5 mb-2" />
                                <Shimmer className="h-4 w-full max-w-[260px]" />
                                <Shimmer className="h-4 w-40 mt-1.5" />
                            </div>
                            <div className="flex flex-col items-stretch lg:items-end gap-4 flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row gap-4 sm:justify-end w-full">
                                    <div className="w-full sm:w-[222px]">
                                        <Shimmer className="h-4 w-36 mb-2" />
                                        <Shimmer className="h-12 w-full rounded-lg" />
                                    </div>
                                    <div className="w-full sm:w-[222px]">
                                        <Shimmer className="h-4 w-28 mb-2" />
                                        <Shimmer className="h-12 w-full rounded-lg" />
                                    </div>
                                </div>
                                <div className="w-full sm:w-[222px] sm:ml-auto">
                                    <Shimmer className="h-4 w-40 mb-2" />
                                    <Shimmer className="h-12 w-full rounded-lg" />
                                </div>
                            </div>
                        </div>

                        {/* TextProvider “Advanced” card */}
                        <div className="bg-white flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 p-6 sm:p-10 rounded-[12px]">
                            <div className="max-w-[290px] shrink-0">
                                <Shimmer className="h-6 w-28 mb-2" />
                                <Shimmer className="h-4 w-52" />
                            </div>
                            <div className="flex items-center gap-2.5 w-full sm:w-[222px] sm:justify-start">
                                <Shimmer className="h-6 w-11 rounded-full shrink-0" />
                                <Shimmer className="h-4 flex-1 max-w-[160px]" />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Fixed save button — matches SettingPage placement */}
            <div className="mx-auto fixed bottom-20 right-5 z-40">
                <Shimmer className="h-12 w-[200px] sm:w-[240px] rounded-[58px]" />
            </div>
        </div>
    );
}
