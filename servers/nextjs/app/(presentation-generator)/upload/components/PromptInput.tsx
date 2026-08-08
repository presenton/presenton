import { Textarea } from "@/components/ui/textarea";
import { PencilIcon } from "lucide-react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function PromptInput({ value, onChange }: PromptInputProps) {


  const handleChange = (val: string) => {

    onChange(val);
  };

  return (

    <div className="relative rounded-[8px] border border-[#DBDBDB99] px-[10px] py-3 font-syne min-[1800px]:px-4 min-[1800px]:py-4 min-[2200px]:px-5 min-[2200px]:py-5"
      style={{
        boxShadow: "0 4px 14px 0 rgba(0, 0, 0, 0.04)",

      }}
    >
      <div className="mb-1 flex items-center gap-2 min-[1800px]:mb-2">
        <PencilIcon className="h-3.5 w-3.5 min-[1800px]:h-4 min-[1800px]:w-4 min-[2200px]:h-5 min-[2200px]:w-5" />
        <p className="font-syne text-sm font-normal text-[#333333] min-[1800px]:text-base min-[2200px]:text-lg">Write prompt</p>
      </div>
      <Textarea
        value={value}
        autoFocus={true}
        rows={4}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Start with your idea… we’ll handle the slides"
        data-testid="prompt-input"
        className="min-h-[120px] max-h-[250px] overflow-y-auto border-none px-2 py-0 indent-4 font-syne text-base font-medium shadow-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0 min-[1800px]:min-h-[150px] min-[1800px]:max-h-[320px] min-[1800px]:text-lg min-[2200px]:min-h-[180px] min-[2200px]:max-h-[380px] min-[2200px]:text-xl custom_scrollbar"
      />
    </div>

  );
}
