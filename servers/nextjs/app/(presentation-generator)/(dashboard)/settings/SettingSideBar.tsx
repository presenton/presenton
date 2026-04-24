import React from 'react'
import { LogOut, Shield } from 'lucide-react'
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from '@/utils/providerConstants'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'

type SettingsSection = 'text-provider' | 'image-provider' | 'privacy' | 'session'

const SettingSideBar = ({ mode, setMode, selectedProvider, setSelectedProvider }: { mode: 'nanobanana' | 'presenton', setMode: (mode: 'nanobanana' | 'presenton') => void, selectedProvider: SettingsSection, setSelectedProvider: (provider: SettingsSection) => void }) => {
    const { llm_config } = useSelector((state: RootState) => state.userConfig)
    const textProviderIcon = LLM_PROVIDERS[llm_config.LLM as keyof typeof LLM_PROVIDERS]?.icon
    const imageProviderIcon = IMAGE_PROVIDERS[llm_config.IMAGE_PROVIDER as keyof typeof IMAGE_PROVIDERS]?.icon || '/providers/pexel.png'
    return (
        <div className='w-full max-w-[230px] h-screen px-3 pt-[22px] bg-[#F9FAFB] flex flex-col'>
            <p className='text-xs text-black  font-medium border-b mt-[3.15rem]  border-[#E1E1E5] pb-3.5'>FILTER BY:</p>
            <div className='mt-6 flex-1'>
                <p className='text-[#3A3A3A] text-xs font-medium pb-2.5'>Select Mode</p>
                <div className='p-0.5 rounded-[40px] bg-[#ffffff] w-fit border border-[#EDEEEF] flex items-center justify-center mb-[34px] '>
                    <button className='px-3 font-syne h-[26px] text-[10px] font-medium text-[#3A3A3A] rounded-[70px]'
                        onClick={() => setMode('presenton')}
                        style={{
                            background: mode === 'presenton' ? '#F4F3FF' : 'transparent',
                            color: mode === 'presenton' ? '#5146E5' : '#3A3A3A'
                        }}
                    >Template Based
                    </button>
                    <svg xmlns="http://www.w3.org/2000/svg" className='mx-1' width="2" height="17" viewBox="0 0 2 17" fill="none">
                        <path d="M1 0V16.5" stroke="#EDECEC" strokeWidth="2" />
                    </svg>
                    <div className='relative'>
                        <button className='px-3 font-syne  h-[26px] text-[10px] font-medium rounded-[70px] cursor-not-allowed opacity-60'
                            disabled
                            style={{
                                background: 'transparent',
                                color: '#9CA3AF'
                            }}
                        >
                            Image Based
                        </button>
                        <span className='absolute -top-2 -right-5 text-[7px] uppercase tracking-wide bg-[#F4F3FF] text-[#5146E5] border border-[#D9D6FE] rounded-full px-1.5 py-0.5 whitespace-nowrap'>
                            Coming soon
                        </span>
                    </div>


                </div>
                <p className='text-[#3A3A3A] text-xs font-medium pb-2.5'>Select Provider</p>
                {mode === 'presenton' && <div className='space-y-2.5'>
                    <button className={` w-full rounded-[6px] px-3 py-4 flex items-center gap-1.5 border  ${selectedProvider === 'text-provider' ? 'bg-[#F4F3FF] border-[#D9D6FE]' : 'bg-white border-[#EDEEEF]'}`} onClick={() => setSelectedProvider('text-provider')}>
                        <div className='relative w-[18px] h-[18px] rounded-full overflow-hidden border border-[#EDEEEF]'>

                            <img src={textProviderIcon} className=' object-cover w-full h-full overflow-hidden' alt='google' />
                        </div>
                        <p className='text-[#191919] text-xs  font-medium' >Text Provider</p>
                    </button>
                    <button className={` w-full rounded-[6px] px-3 py-4 flex items-center gap-1.5 border  ${selectedProvider === 'image-provider' ? 'bg-[#F4F3FF] border-[#D9D6FE]' : 'bg-white border-[#EDEEEF]'}`} onClick={() => setSelectedProvider('image-provider')}>
                        <div className='relative w-[18px] h-[18px] rounded-full overflow-hidden border border-[#EDEEEF]'>
                            <img src={imageProviderIcon} className=' object-cover w-full h-full overflow-hidden' alt='google' />
                        </div>
                        <p className='text-[#191919] text-xs  font-medium' >Image Provider</p>
                    </button>
                </div>}
                {
                    mode === 'nanobanana' && <div>
                        <button className={` w-full rounded-[6px] px-3 py-4 flex items-center gap-1.5 border  bg-[#F4F3FF] border-[#D9D6FE]`}>
                            <div className='relative w-[18px] h-[18px] rounded-full overflow-hidden border border-[#EDEEEF]'>

                                <img src='/providers/openai.png' className=' object-cover w-full h-full overflow-hidden' alt='google' />
                            </div>
                            <p className='text-[#191919] text-xs  font-medium' >Nanobanana</p>
                        </button>
                    </div>
                }
            </div>

            <div className='border-t border-[#E1E1E5] py-5 relative z-50'>
                <p className='text-[#3A3A3A] text-xs font-medium pb-2.5'>Other</p>
                <div className='space-y-2.5'>
                    <button
                        className={`w-full rounded-[6px] p-3 py-4 flex items-center gap-1.5 border ${selectedProvider === 'privacy' ? 'bg-[#F4F3FF] border-[#D9D6FE]' : 'bg-white border-[#EDEEEF]'}`}
                        onClick={() => setSelectedProvider('privacy')}
                    >
                        <div className='relative w-6 h-6 rounded-full overflow-hidden border border-[#EDEEEF] flex items-center justify-center bg-white'>
                            <Shield className='w-3.5 h-3.5 text-[#5146E5]' />
                        </div>
                        <p className='text-[#191919] text-xs font-medium'>Usage Analytics</p>
                    </button>
                    <button
                        className={`w-full rounded-[6px] p-3 py-4 flex items-center gap-1.5 border ${selectedProvider === 'session' ? 'bg-[#F4F3FF] border-[#D9D6FE]' : 'bg-white border-[#EDEEEF]'}`}
                        onClick={() => setSelectedProvider('session')}
                    >
                        <div className='relative w-6 h-6 rounded-full overflow-hidden border border-[#EDEEEF] flex items-center justify-center bg-white'>
                            <LogOut className='w-3.5 h-3.5 text-[#5146E5]' />
                        </div>
                        <p className='text-[#191919] text-xs font-medium'>Sign out</p>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SettingSideBar
