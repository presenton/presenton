import React from "react";

const DeckShimmerCard = () => (
  <div className="flex min-h-[216px] flex-col overflow-hidden rounded-[12px] border border-[#EDEEEF] bg-[#F8FBFB] shadow-none animate-pulse">
    <div className="relative flex-1 overflow-hidden p-4">
      <img
        src="/card_bg.svg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      <div className="relative mx-auto mt-2 aspect-video w-[88%] rounded-lg border border-gray-200 bg-gray-200" />
    </div>
    <div className="relative z-10 border-t border-[#EDEEEF] bg-white px-5 py-3">
      <div className="flex items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="h-3.5 w-24 rounded bg-gray-200" />
          <div className="h-3 w-16 rounded bg-gray-200" />
        </div>
        <div className="h-5 w-1 rounded-full bg-gray-200" />
      </div>
    </div>
  </div>
);

const ActionShimmer = () => (
  <div className="relative mt-2 block w-[304px] max-w-full overflow-visible rounded-[10.8px]">
    <div className="pointer-events-none absolute right-[14px] top-[-36px] z-0 block h-[64px] w-[158px]">
      <div className="absolute left-0 top-0 aspect-[16/9] h-[46.238px] w-[82.201px] rounded-[4.474px] bg-gray-200 shadow-[0_8px_18px_rgba(16,24,40,0.12)]" />
      <div className="absolute left-[39px] top-1 z-10 aspect-[16/9] h-[46.238px] w-[82.201px] rounded-[4.474px] bg-gray-200 shadow-[0_8px_18px_rgba(16,24,40,0.12)]" />
      <div className="absolute left-[76px] top-0 aspect-[16/9] h-[46.238px] w-[82.201px] rounded-[4.474px] bg-gray-200 shadow-[0_8px_18px_rgba(16,24,40,0.12)]" />
    </div>
    <div className="relative z-10 flex h-[89.983px] w-[304px] max-w-full items-center justify-center rounded-[10.8px] border-[0.9px] border-[#EDEEEF] bg-gray-100">
      <div className="h-3.5 w-32 rounded bg-gray-200" />
    </div>
  </div>
);

const Loading = () => {
  return (
    <div className="min-h-screen w-full px-3 pb-10 sm:px-6">
      <div className="sticky top-0 right-0 z-50 py-[28px] backdrop-blur mb-2">
        <h3 className="text-[28px] tracking-[-0.84px] font-syne font-normal text-[#101828]">
          Slide Presentation
        </h3>
      </div>
      <section className="relative z-10 overflow-visible">
        <h2 className="pb-3.5 font-syne text-base font-medium text-[#333333]">
          Actions
        </h2>
        <div className="flex flex-wrap gap-4 animate-pulse">
          <ActionShimmer />
          <ActionShimmer />
        </div>
      </section>
      <section className="relative z-10 mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-syne text-base font-medium text-[#333333]">
            Decks
          </h2>
          <div className="h-8 w-8 rounded-full bg-gray-100 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(12)].map((_, i) => (
            <DeckShimmerCard key={i} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default Loading;
