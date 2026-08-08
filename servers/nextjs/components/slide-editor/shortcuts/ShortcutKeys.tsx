"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import {
  shortcutKeyLabel,
  type EditorShortcut,
} from "@/components/slide-editor/shortcuts/editorShortcuts";

export function useAppleShortcutPlatform() {
  return useSyncExternalStore(
    subscribeToPlatform,
    readApplePlatform,
    () => false,
  );
}

function subscribeToPlatform() {
  return () => undefined;
}

function readApplePlatform() {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

export function ShortcutKeys({
  applePlatform,
  className,
  compact = false,
  shortcut,
}: {
  applePlatform: boolean;
  className?: string;
  compact?: boolean;
  shortcut: EditorShortcut;
}) {
  const chords = compact ? shortcut.chords.slice(0, 1) : shortcut.chords;

  return (
    <span
      aria-label={`${shortcut.label} shortcut`}
      className={cn("inline-flex shrink-0 items-center gap-1.5", className)}
    >
      {chords.map((chord, chordIndex) => (
        <span
          key={chord.join("+")}
          className="inline-flex items-center gap-1"
        >
          {chordIndex > 0 ? (
            <span className="px-0.5 text-[10px] font-medium text-[#98A0B3]">
              or
            </span>
          ) : null}
          {chord.map((key) => (
            <kbd
              key={key}
              className={cn(
                "inline-flex min-w-6 items-center justify-center rounded-[6px] border border-[#E1E3E9] bg-white px-1.5 py-1 font-manrope text-[11px] font-semibold leading-none text-[#475467] shadow-[0_1px_0_rgba(16,24,40,0.08)]",
                applePlatform && "text-[13px]",
              )}
            >
              {shortcutKeyLabel(key, applePlatform)}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  );
}
