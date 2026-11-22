import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

export default function TemplateNavIcon({ active = false, className, ...props }: SVGProps<SVGSVGElement> & { active?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.17} aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0", active ? "text-[#7A5AF8]" : "text-black", className)} {...props}>
      <path d="M7.58374 12.2498C9.23366 12.2498 10.0586 12.2498 10.5712 11.7372C11.0837 11.2246 11.0837 10.3997 11.0837 8.74976V7.58309C11.0837 5.93319 11.0837 5.10824 10.5712 4.59566C10.0586 4.08309 9.23366 4.08309 7.58374 4.08309H4.66707C3.01717 4.08309 2.19222 4.08309 1.67965 4.59566C1.16707 5.10824 1.16707 5.93319 1.16707 7.58309V8.74976C1.16707 10.3997 1.16707 11.2246 1.67965 11.7372C2.19222 12.2498 3.01717 12.2498 4.66707 12.2498H7.58374Z" />
      <path d="M2.91658 4.12733C3.27393 3.48811 4.05957 3.27071 5.63089 2.83589L7.85304 2.22094C9.42438 1.78607 10.21 1.56866 10.829 1.93773C11.4479 2.30681 11.6584 3.11822 12.0795 4.741L12.3772 5.88853C12.7982 7.51137 13.0087 8.32275 12.6514 8.96199C12.397 9.4171 11.9254 9.65839 11.1078 9.91656" />
    </svg>
  );
}
