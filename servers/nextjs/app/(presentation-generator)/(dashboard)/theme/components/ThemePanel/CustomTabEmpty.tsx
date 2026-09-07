"use client";
import { ArrowRight, Plus, Sparkle, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

const CustomTabEmpty = () => {
    const router = useRouter()
    return (
        <div
            onClick={() => {
                router.push('/theme?tab=new-theme')
            }}
            className='w-[305px] rounded-xl border border-[#EDEEEF] cursor-pointer'>
            <div className='relative h-[250px] flex justify-center items-center '>
                <img src="/card_bg.svg" alt="" className="absolute top-0 z-[1] left-0 w-full h-full object-cover" />
                <div className='w-[36px] h-[36px] relative z-[4]  rounded-full bg-[#2563EB] flex items-center justify-center'
                    style={{
                        background: 'linear-gradient(90deg, #F00 5.21%, #FF8A00 16.48%, #FFE600 27.74%, #14FF00 39.35%, #00A3FF 49.37%, #0500FF 61.18%, #AD00FF 72.26%, #FF00C7 83.53%, #F00 94.61%), #FFF'
                    }}
                ><div className='w-[26px] h-[26px] rounded-full bg-white flex items-center justify-center'>

                        <Plus className='w-4 h-4 text-[#A2A0A1]' />
                    </div>
                </div>
            </div>
            <div className='px-5 py-4 bg-white flex items-center gap-4 border-t border-[#EDEEEF]'>
                <div className='bg-[#2563EB] w-[45px] h-[45px] rounded-lg p-2 flex items-center justify-center'>

                    <Sparkles className='w-6 h-6 text-white' />
                </div>
                <div>
                    <h4 className='text-[#191919] text-sm font-semibold '>Build Theme</h4>
                    <p className='flex text-[#808080] text-sm  font-medium items-center gap-2'>From colors <ArrowRight className='w-3 h-3' /> fonts </p>
                </div>

            </div>
        </div>
    )
}

export default CustomTabEmpty