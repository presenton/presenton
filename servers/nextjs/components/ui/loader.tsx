import { cn } from "@/lib/utils"

interface LoaderProps {
    text?: string
    className?: string
}

export const Loader = ({ text, className }: LoaderProps) => {
    return (
        <div className={cn("flex flex-col items-center justify-center", className)}>
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            {text && (
                <p className="mt-4 text-white text-base font-manrope font-semibold">{text}</p>
            )}
        </div>
    )
} 