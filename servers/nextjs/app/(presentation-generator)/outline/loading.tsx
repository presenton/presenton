import { Skeleton } from '@/components/ui/skeleton'
import React from 'react'

const CreatePageLoadingSkeleton = () => {
    return (
        <div className="min-h-screen bg-gray-50 ">
            <Skeleton className='h-24 w-full' />
            <div className="max-w-[1000px] mx-auto sm:px-6 pb-6">
                <div className="mt-4 sm:mt-8 font-manrope relative">
                    <div className="h-14 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="border p-2 sm:p-4 md:p-6 rounded-lg mt-10">
                        <div className="space-y-4">
                            {[...Array(10)].map((_, index) => (
                                <div key={index} className="h-14 bg-gray-200 rounded w-full mb-2"></div>
                            ))}
                        </div>
                        <div className="h-10 bg-gray-200 rounded w-full mt-4"></div>
                    </div>
                </div>
                <div className="mt-4">
                    <div className="h-12 bg-gray-200 rounded w-full"></div>
                </div>
            </div>
        </div>
    )
}

export default CreatePageLoadingSkeleton
