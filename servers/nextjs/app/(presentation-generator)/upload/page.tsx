import React from "react";

import UploadPage from "./components/UploadPage";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";
import { Metadata } from "next";
import { normalizePresentationGenerationMode } from "@/utils/presentationGenerationMode";

export const metadata: Metadata = {
  title: "Presenton | Open Source AI presentation generator",
  description:
    "Open-source AI presentation generator with custom layouts, multi-model support (OpenAI, Gemini, Ollama), and PDF/PPTX export. A free Gamma alternative.",
  alternates: {
    canonical: "https://presenton.ai/create",
  },
  keywords: [
    "presentation generator",
    "AI presentations",
    "data visualization",
    "automatic presentation maker",
    "professional slides",
    "data-driven presentations",
    "document to presentation",
    "presentation automation",
    "smart presentation tool",
    "business presentations",
  ],
  openGraph: {
    title: "Create Data Presentation | PresentOn",
    description:
      "Open-source AI presentation generator with custom layouts, multi-model support (OpenAI, Gemini, Ollama), and PDF/PPTX export. A free Gamma alternative.",
    type: "website",
    url: "https://presenton.ai/create",
    siteName: "PresentOn",
  },
  twitter: {
    card: "summary_large_image",
    title: "Create Data Presentation | PresentOn",
    description:
      "Open-source AI presentation generator with custom layouts, multi-model support (OpenAI, Gemini, Ollama), and PDF/PPTX export. A free Gamma alternative.",
    site: "@presenton_ai",
    creator: "@presenton_ai",
  },
};

const page = () => {
  const presentationGenerationMode = normalizePresentationGenerationMode(
    process.env.PRESENTATION_GENERATION_MODE,
  );

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Header />
      <main className="flex flex-1 flex-col mt-20 py-8">
        <div className="mb-8 flex flex-col items-center justify-center px-4 text-center">
          <h1 className="relative font-syne text-4xl font-semibold leading-[112%] text-[#101323] sm:text-5xl lg:text-[64px] min-[1920px]:text-[76px] min-[2560px]:text-[88px]">
            Generate

            <svg className="absolute -left-6 -top-8 sm:-left-12 sm:-top-12 lg:-left-20 lg:-top-16" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M9.73497 5.85272C8.05237 5.69492 6.72098 4.39958 6.55904 2.76316L6.28582 0L6.0126 2.76316C5.85066 4.39985 4.51927 5.6952 2.83667 5.85272L0 6.11849L2.83667 6.38426C4.51927 6.54206 5.85066 7.8374 6.0126 9.47382L6.28582 12.237L6.55904 9.47382C6.72098 7.83713 8.05237 6.54178 9.73497 6.38426L12.5716 6.11849L9.73497 5.85272Z" fill="#09CCFE" />
            </svg>
            <svg className="absolute -left-2 -top-6 sm:-left-4 sm:-top-8" xmlns="http://www.w3.org/2000/svg" width="26" height="25" viewBox="0 0 26 25" fill="none">
              <path d="M19.4699 11.7054C16.1047 11.3898 13.442 8.79915 13.1181 5.52632L12.5716 0L12.0252 5.52632C11.7013 8.79971 9.03854 11.3904 5.67335 11.7054L0 12.237L5.67335 12.7685C9.03854 13.0841 11.7013 15.6748 12.0252 18.9476L12.5716 24.474L13.1181 18.9476C13.442 15.6743 16.1047 13.0836 19.4699 12.7685L25.1433 12.237L19.4699 11.7054Z" fill="#09CCFE" />
            </svg>
            <svg className="absolute -right-7 bottom-0 sm:-right-10" xmlns="http://www.w3.org/2000/svg" width="41" height="41" viewBox="0 0 41 41" fill="none">
              <path d="M31.6166 19.8734C26.275 19.3587 22.0484 15.134 21.5343 9.797L20.6669 0.785156L19.7995 9.797C19.2854 15.1349 15.0588 19.3596 9.71723 19.8734L0.711914 20.7401L9.71723 21.6069C15.0588 22.1216 19.2854 26.3462 19.7995 31.6833L20.6669 40.6951L21.5343 31.6833C22.0484 26.3453 26.275 22.1207 31.6166 21.6069L40.6219 20.7401L31.6166 19.8734Z" fill="#DF92FC" />
            </svg>

          </h1>
          <p className="mt-2 max-w-2xl font-manrope text-base text-[#101323CC] sm:text-lg lg:text-xl min-[1920px]:text-2xl">Turn prompts or documents into presentations with AI</p>
        </div>

        <UploadPage presentationGenerationMode={presentationGenerationMode} />
      </main>
    </div>
  );
};

export default page;
