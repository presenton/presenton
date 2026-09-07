import React from 'react'
import { LogOut, Search, Shield, ShieldCheck } from 'lucide-react'
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from '@/utils/providerConstants'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/store'

export type SettingsSection = 'text-provider' | 'image-provider' | 'web-search-provider' | 'privacy' | 'admin' | 'session'

const SettingSideBar = ({ selectedProvider, setSelectedProvider, presentonSelected = false }: { selectedProvider: SettingsSection, setSelectedProvider: (provider: SettingsSection) => void, presentonSelected?: boolean }) => {
    const { llm_config } = useSelector((state: RootState) => state.userConfig)
    const textProviderIcon = LLM_PROVIDERS[llm_config.LLM as keyof typeof LLM_PROVIDERS]?.icon
    const imageProviderIcon = IMAGE_PROVIDERS[llm_config.IMAGE_PROVIDER as keyof typeof IMAGE_PROVIDERS]?.icon || '/providers/pexel.png'
    return (
        <div className='w-full max-w-[230px] h-screen px-3 pt-[22px] bg-[#F9FAFB] flex flex-col'>
            <p className='text-xs text-black  font-medium border-b mt-[3.15rem]  border-[#E1E1E5] pb-3.5'>FILTER BY:</p>
            <div className='mt-6 flex-1'>
                <p className='text-[#3A3A3A] text-xs font-medium pb-2.5'>Select Provider</p>
                <div className='space-y-2.5'>
                    <button className={` w-full rounded-[6px] px-3 py-4 flex items-center gap-1.5 border  ${selectedProvider === 'text-provider' ? 'bg-[#EFF6FF] border-[#BFDBFE]' : 'bg-white border-[#EDEEEF]'}`} onClick={() => setSelectedProvider('text-provider')}>
                        <div className='relative w-[18px] h-[18px] rounded-full overflow-hidden border border-[#EDEEEF]'>

                            <img src={textProviderIcon} className=' object-cover w-full h-full overflow-hidden' alt='google' />
                        </div>
                        <p className='text-[#191919] text-xs  font-medium' >Text Provider</p>
                    </button>
                    {!presentonSelected ? (
                        <>
                            <button className={` w-full rounded-[6px] px-3 py-4 flex items-center gap-1.5 border  ${selectedProvider === 'image-provider' ? 'bg-[#EFF6FF] border-[#BFDBFE]' : 'bg-white border-[#EDEEEF]'}`} onClick={() => setSelectedProvider('image-provider')}>
                                <div className='relative w-[18px] h-[18px] rounded-full overflow-hidden border border-[#EDEEEF]'>
                                    <img src={imageProviderIcon} className=' object-cover w-full h-full overflow-hidden' alt='image provider' />
                                </div>
                                <p className='text-[#191919] text-xs  font-medium' >Image Provider</p>
                            </button>
                            <button className={` w-full rounded-[6px] px-3 py-4 flex items-center gap-1.5 border  ${selectedProvider === 'web-search-provider' ? 'bg-[#EFF6FF] border-[#BFDBFE]' : 'bg-white border-[#EDEEEF]'}`} onClick={() => setSelectedProvider('web-search-provider')}>
                                <div className='relative w-[18px] h-[18px] rounded-full overflow-hidden border border-[#EDEEEF] flex items-center justify-center bg-white'>
                                    <Search className='w-3 h-3 text-[#1D4ED8]' />
                                </div>
                                <p className='text-[#191919] text-xs font-medium'>Web Search Provider</p>
                            </button>
                        </>
                    ) : null}
                </div>
            </div>

            <div className='border-t border-[#E1E1E5] py-5 relative z-50'>
                <p className='text-[#3A3A3A] text-xs font-medium pb-2.5'>Other</p>
                <div className='space-y-2.5'>
                    <button
                        className={`w-full rounded-[6px] p-3 py-4 flex items-center gap-1.5 border ${selectedProvider === 'privacy' ? 'bg-[#EFF6FF] border-[#BFDBFE]' : 'bg-white border-[#EDEEEF]'}`}
                        onClick={() => setSelectedProvider('privacy')}
                    >
                        <div className='relative w-6 h-6 rounded-full overflow-hidden border border-[#EDEEEF] flex items-center justify-center bg-white'>
                            <Shield className='w-3.5 h-3.5 text-[#1D4ED8]' />
                        </div>
                        <p className='text-[#191919] text-xs font-medium'>Usage Analytics</p>
                    </button>
                    <button
                        className={`w-full rounded-[6px] p-3 py-4 flex items-center gap-1.5 border ${selectedProvider === 'admin' ? 'bg-[#EFF6FF] border-[#BFDBFE]' : 'bg-white border-[#EDEEEF]'}`}
                        onClick={() => setSelectedProvider('admin')}
                    >
                        <div className='relative w-6 h-6 rounded-full overflow-hidden border border-[#EDEEEF] flex items-center justify-center bg-white'>
                            <ShieldCheck className='w-3.5 h-3.5 text-[#1D4ED8]' />
                        </div>
                        <p className='text-[#191919] text-xs font-medium'>Admin</p>
                    </button>
                    <button
                        className={`w-full rounded-[6px] p-3 py-4 flex items-center gap-1.5 border ${selectedProvider === 'session' ? 'bg-[#EFF6FF] border-[#BFDBFE]' : 'bg-white border-[#EDEEEF]'}`}
                        onClick={() => setSelectedProvider('session')}
                    >
                        <div className='relative w-6 h-6 rounded-full overflow-hidden border border-[#EDEEEF] flex items-center justify-center bg-white'>
                            <LogOut className='w-3.5 h-3.5 text-[#1D4ED8]' />
                        </div>
                        <p className='text-[#191919] text-xs font-medium'>Sign out</p>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SettingSideBar
