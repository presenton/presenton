

import React from "react";

export const TemplateStudioHeader: React.FC = () => {
    return (
        <div className="text-center my-[52px] px-2 md:px-0">
            <h1 className="font-unbounded text-[36px] sm:text-[38px] md:text-[64px] text-[#101323] font-normal tracking-[-1.92px] pb-2">
                Template Studio
            </h1>
            <p className="text-[#101323CC] text-base md:text-xl font-syne font-normal max-w-[600px] mx-auto">
                Upload your PPTX file to extract slides and convert them to a template which you can use to generate AI presentations.
            </p>
        </div>
    );
};

