import React, { useState, useRef, useEffect } from "react";
import { UploadIcon, ChevronRight, Plus, FileText, X, Coins, Edit3, Info } from "lucide-react";
import { ProcessedSlide } from "../types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

interface FileUploadSectionProps {
  selectedFile: File | null;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: () => void;
  CheckFonts: () => void;

  isProcessingPptx: boolean;
  slides: ProcessedSlide[];
  completedSlides: number;
}

// Credit costs constants
const COST_PER_SLIDE = 3;
const COST_EDIT = 1;

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  selectedFile,
  handleFileSelect,
  removeFile,
  CheckFonts,

  isProcessingPptx,
  slides,
  completedSlides,
}) => {
  const isProcessing = isProcessingPptx || slides.some((s) => s.processing);
  const [isAllowed, setIsAllowed] = useState(false);

  const { llm_config } = useSelector((state: RootState) => state.userConfig);



  const handleCheckFonts = () => {

    CheckFonts();

  }

  useEffect(() => {


    if (llm_config?.LLM === 'custom' || llm_config?.LLM === 'ollama') {
      setIsAllowed(false);
    } else {
      setIsAllowed(true);
    }
  }, [llm_config]);


  return (
    <div className="md:h-[calc(100vh-310px)] h-[calc(100vh-450px)] relative overflow-hidden">

      <div className=" max-w-[650px] w-full mx-auto px-2 md:px-0 ">

        <div
          className='absolute z-0 md:-bottom-[36%] -bottom-[40%] left-0 w-full h-full'
          style={{
            height: "341px",
            borderRadius: '1440px',
            background: 'radial-gradient(5.92% 104.69% at 50% 100%, rgba(122, 90, 248, 0.00) 0%, rgba(255, 255, 255, 0.00) 100%), radial-gradient(50% 50% at 50% 50%, rgba(122, 90, 248, 0.80) 0%, rgba(122, 90, 248, 0.00) 100%)',
          }}
        />

        <div className=' w-max ml-9  rounded-tl-[28px] rounded-tr-[28px] flex items-center bg-[#FAFAFF]  px-2.5 pt-2.5 pb-1'
          style={{
            boxShadow: '0 0 16px 0 rgba(80, 71, 230, 0.12)',

          }}
        >

          <div className={`flex justify-center gap-1 py-2.5 pl-2 pr-3 cursor-pointer bg-white  rounded-[80px] `}

            style={{
              boxShadow: '0 0 4px 0 rgba(0, 0, 0, 0.06)',
            }}
          >
            <UploadIcon className={`w-4 h-4 text-black`} />
            <p className='text-xs font-medium text-black'>Upload PPTX File</p>
          </div>
        </div>
        <div className=" w-full bg-[#FAFAFF] rounded-[28px] p-2.5 "
          style={{
            boxShadow: '0 0 16px 0 rgba(80, 71, 230, 0.12)',
            clipPath: 'inset(0px -28px -28px -28px)',
          }}
        >
          <div className="bg-[#FEFEFF] rounded-[18px] p-2 border border-[#EDEEEF] ">
            <div className="h-[120px] w-full bg-[#F6F6F9]  rounded-[12px] p-1.5">
              <div className="border border-[#B8B8C1] border-dashed rounded-[12px ] p-1.5 h-full relative">
                {!selectedFile ? <>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pptx"
                    disabled={!isAllowed}
                    onChange={handleFileSelect}
                    className={`opacity-0 w-full h-full ${!isAllowed ? 'cursor-not-allowed' : 'cursor-pointer'} absolute top-0 left-0 z-10`}
                  />
                  <div className='absolute inset-0 flex flex-col items-center justify-center'>
                    <div className='w-[42px] h-[42px] flex justify-center items-center rounded-full bg-[#EBE9FE]' >
                      <div className='w-[22px] h-[22px] rounded-full bg-[#7A5AF8] flex items-center justify-center text-white'>
                        <Plus className='w-3 h-3' />
                      </div>
                    </div>
                    <p className='pt-3 text-xs font-normal text-[#808080] tracking-[-0.12px] text-center'>
                      <span className='text-[#808080] underline underline-offset-4'>Click to Upload</span> or drag &amp; drop.
                    </p>
                  </div>
                </> : <div className="flex gap-2 items-center justify-center h-full w-fit mx-auto">
                  <div className="flex gap-2 items-center justify-center mx-10 w-full">

                    <div className="w-[55px] h-[55px] rounded-[9px] bg-[#8E8F8F] flex items-center justify-center relative">
                      <button className="absolute w-[16px] h-[16px] flex items-center justify-center -top-1.5 -right-1.5"
                        style={{
                          borderRadius: '54.545px',
                          border: '0.682px solid #EDEEEF',
                          background: '#FFF',
                          boxShadow: '0 4px 8px 0 rgba(0, 0, 0, 0.25)',
                        }}
                        disabled={isProcessing}
                        onClick={removeFile}
                      >
                        <X className="w-3 h-3 text-black " />
                      </button>

                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[#4C4C4C] text-sm font-medium line-clamp-1"> {selectedFile.name}</h3>
                      <p className="text-xs font-normal text-[#808080] tracking-[-0.12px]">Presentation ( {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</p>
                    </div>

                  </div>
                </div>
                }
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between gap-2.5">
                <div className="min-w-[140px] w-full">
                  {isProcessing ? (
                    <div className="flex items-center justify-end gap-3" aria-live="polite" aria-label="Processing">
                      <div
                        className="h-[14px] w-[74px] rounded-full bg-[#EFEDFF] overflow-hidden ring-1 ring-[#E4E0FF]"
                        aria-hidden="true"
                      >
                        <div className="h-full w-full rounded-full processing-stripes" />
                      </div>
                      <p className="text-sm font-medium text-[#9A9AA6] tracking-[-0.1px]">Processing</p>
                      {slides.length > 0 ? (
                        <p className="text-sm font-medium text-[#9A9AA6] tracking-[-0.1px]">
                          {completedSlides}/{slides.length} Slides
                        </p>
                      ) : null}
                      <style jsx>{`
                      @keyframes stripes {
                        from {
                          background-position: 0 0;
                        }
                        to {
                          background-position: 24px 0;
                        }
                      }
                      .processing-stripes {
                        background: repeating-linear-gradient(
                          135deg,
                          rgba(122, 90, 248, 0.9) 0px,
                          rgba(122, 90, 248, 0.9) 9px,
                          rgba(122, 90, 248, 0.18) 9px,
                          rgba(122, 90, 248, 0.18) 18px
                        );
                        filter: saturate(1.05);
                        background-size: 24px 24px;
                        will-change: background-position;
                        animation: stripes 0.7s linear infinite;
                      }
                    `}</style>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2.5">

                      <button className="px-4 py-2.5 text-xs font-semibold text-[#101323] font-syne tracking-[-0.12px] flex gap-1"
                        style={{
                          borderRadius: '48px',
                          background: 'linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)',
                          cursor: !isAllowed ? 'not-allowed' : 'pointer',
                        }}
                        onClick={handleCheckFonts}
                        disabled={isProcessing || !isAllowed}
                      >
                        {isProcessingPptx
                          ? "Checking Fonts..."
                          : !selectedFile
                            ? "Select a PPTX file"
                            : "Check Fonts"}
                        <ChevronRight className="w-3.5 h-3.5 text-black" />
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

        </div>

        <ul className="flex items-center max-w-[85%] md:max-w-[70%] mx-auto  mt-5 justify-between gap-2.5">
          <li className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8.5" cy="8.17041" r="4.5" fill="#EBE9FE" />
            </svg>
            <p className="md:text-sm text-[10px] font-normal text-[#3A3A3A] ">PPTX. Only</p>
          </li>
          <li className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8.5" cy="8.17041" r="4.5" fill="#EBE9FE" />
            </svg>
            <p className="md:text-sm text-[10px] font-normal text-[#3A3A3A] ">Max 100MB</p>
          </li>
          <li className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8.5" cy="8.17041" r="4.5" fill="#EBE9FE" />
            </svg>
            <p className="md:text-sm text-[10px] font-normal text-[#3A3A3A] ">5min Generation</p>
          </li>
        </ul>

        <div className="mt-4 px-4 py-3 rounded-lg border border-[#EBE9FE]  flex items-start gap-2 shadow-md">
          <svg className="mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="10" fill="#EBE9FE" />
            <path d="M10 6V10M10 14H10.0088" stroke="#5B49A1" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-sm md:text-base font-medium text-[#20165C] tracking-[-0.13px]">
            <span className="font-bold text-[#5B49A1]">Note:</span> Template generation relies on <span className="font-semibold">vision-capable models</span> and is currently supported only by providers: <span className="font-medium text-[#5246C3]">Google</span>, <span className="font-medium text-[#5246C3]">OpenAI</span>, and <span className="font-medium text-[#5246C3]">Anthropic</span>.
            For optimal results, use state-of-the-art models from these providers, as performance may degrade with smaller models.
          </p>
        </div>

      </div>
    </div>

  );
}; 