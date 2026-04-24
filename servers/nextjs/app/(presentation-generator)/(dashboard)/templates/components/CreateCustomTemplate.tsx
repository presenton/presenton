import { Plus, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation';
import React from 'react'
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";

const CreateCustomTemplate = () => {
    const router = useRouter();
    return (
        <div
            onClick={() => {
                trackEvent(MixpanelEvent.Templates_Build_Template_Clicked);
                router.push('/custom-template')
            }}
            className='w-full rounded-[22px] border border-[#EDEEEF] cursor-pointer font-syne'>
            <div className='relative h-[215px] flex justify-center items-center '>
                <img src="/card_bg.svg" alt="" className="absolute top-0 z-[1] left-0 w-full h-full object-cover" />
                <div className='w-[36px] h-[36px] relative z-[4]  rounded-full bg-[#7A5AF8] flex items-center justify-center'
                    style={{
                        background: 'linear-gradient(0deg, rgba(0, 0, 0, 0.20) 0%, rgba(0, 0, 0, 0.20) 100%), #FFF'
                    }}
                ><div className='w-[26px] h-[26px] rounded-full bg-white flex items-center justify-center'>

                        <Plus className='w-4 h-4 text-[#A2A0A1]' />
                    </div>
                </div>
            </div>
            <div className='px-5 py-4 bg-white flex items-center gap-4 overflow-hidden border-t  border-[#EDEEEF]'>
                <div className='bg-[#7A5AF8] w-[45px] h-[45px] rounded-lg p-2 flex items-center justify-center'>

                    <Sparkles className='w-6 h-6 text-white' />
                </div>
                <div>
                    <h4 className='text-[#191919] text-sm font-semibold '>Build Template</h4>
                    <p className='flex text-[#808080] text-sm  font-medium items-center gap-2'>Build Your Own Template</p>
                </div>

            </div>
        </div>
    )
}

export default CreateCustomTemplate
