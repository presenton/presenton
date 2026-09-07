import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PencilIcon } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
 
  footer?: ReactNode;
  onSubmit?: () => void;
  hasAttachments?: boolean;
}

export function PromptInput({
  value,
  onChange,
 
  footer,
  onSubmit,
  hasAttachments = false,
}: PromptInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2.5 rounded-lg border border-[#DBDBDB99] bg-white px-[10px] py-3 font-syne shadow-[0_4px_7px_rgba(0,0,0,0.04)]",
        hasAttachments ? "min-h-[215px]" : "min-h-[180px]",
      )}
    >
      <div className="flex min-h-0 flex-1 items-start gap-2">
        <span className="flex h-[21px] shrink-0 items-center">
          <PencilIcon className="h-3.5 w-3.5 text-[#191919]" strokeWidth={1.75} />
        </span>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-normal leading-normal text-[#333333]">
            Write prompt
          </p>
          <Textarea
            value={value}
            autoFocus
            rows={6}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start with your idea... we'll handle the slides"
            data-testid="prompt-input"
            className={cn(
              "custom_scrollbar max-h-[400px] min-h-[57px] resize-y overflow-y-auto rounded-none border-none bg-transparent p-0 text-base font-normal leading-normal text-[#191919] shadow-none placeholder:text-[#999999] focus-visible:ring-0 focus-visible:ring-offset-0",
              "min-h-[79px]",
            )}
          />
        </div>
      </div>

      {footer}
    </div>
  );
}
