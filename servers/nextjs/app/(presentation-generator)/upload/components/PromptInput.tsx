import Image from "next/image";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";

interface PromptReference {
  id: string;
  label: string;
}

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  references?: PromptReference[];
  onRemoveReference?: (id: string) => void;
  variant?: "smart" | "standard";
  footer?: ReactNode;
  onSubmit?: () => void;
  hasAttachments?: boolean;
}

export function PromptInput({
  value,
  onChange,
  references = [],
  onRemoveReference,
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
        "relative flex flex-col gap-2.5 rounded-xl border border-[#3088d599]  bg-white px-[10px] py-3 font-syne shadow-[0_4px_12px_rgba(0,0,0,0.04)]",
        hasAttachments ? "min-h-[215px]" : "min-h-[174px]",
      )}
    >
      {references.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {references.map((reference) => (
            <span
              key={reference.id}
              className="inline-flex h-[22px] max-w-full items-center gap-1.5 rounded-full bg-[#F4F4F4] px-[5px] py-1 font-manrope text-[10px] font-medium leading-none text-[#333333]"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7A5AF8]" />
              <span className="max-w-[220px] truncate">{reference.label}</span>
              {onRemoveReference && (
                <button
                  type="button"
                  onClick={() => onRemoveReference(reference.id)}
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#666666] hover:bg-[#E4E4E7] hover:text-[#191919]"
                  aria-label={`Remove ${reference.label}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-start gap-2">
        <span className="flex h-[21px] shrink-0 items-center">
          <Image src="/generate/pencil.svg" alt="" width={14} height={14} />
        </span>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="presentation-brief" className="text-sm font-normal leading-[17px] text-[#333333]">Presentation brief</label>
          <Textarea
            value={value}
            id="presentation-brief"
            rows={3}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your topic, audience, and key points, or attach supporting documents."
            data-testid="prompt-input"
            className={cn(
              "custom_scrollbar max-h-[400px] min-h-[57px] resize-none overflow-y-auto rounded-none border-none bg-transparent p-0 text-base font-normal leading-normal text-[#191919] shadow-none placeholder:text-[#999999] focus-visible:ring-0 focus-visible:ring-offset-0",
              references.length === 0 && "min-h-[77px]",
            )}
          />
        </div>
      </div>

      {footer}
    </div>
  );
}
