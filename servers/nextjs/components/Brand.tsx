import { cn } from "@/lib/utils";

export function YarexMark({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Yarex"
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full bg-[#101323] font-unbounded font-bold leading-none text-white",
        className
      )}
      style={
        size
          ? {
              width: size,
              height: size,
              fontSize: Math.round(size * 0.5),
            }
          : undefined
      }
    >
      Y
    </span>
  );
}

export function YarexWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-unbounded font-bold leading-none tracking-[-0.03em] text-[#101323]",
        className
      )}
    >
      Yarex
    </span>
  );
}
