"use client";

import { useEffect, useState } from "react";
import {
  Keyboard,
  Layers3,
  MousePointer2,
  PencilLine,
  Presentation,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EDITOR_SHORTCUT_SECTIONS,
  type EditorShortcutSection,
} from "@/components/slide-editor/shortcuts/editorShortcuts";
import {
  ShortcutKeys,
  useAppleShortcutPlatform,
} from "@/components/slide-editor/shortcuts/ShortcutKeys";

const SECTION_ICONS: Record<EditorShortcutSection["id"], LucideIcon> = {
  selection: MousePointer2,
  editing: PencilLine,
  arrange: Layers3,
  navigation: Presentation,
  help: CircleHelp,
};

export function KeyboardShortcutsDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const detectedApplePlatform = useAppleShortcutPlatform();
  const [platformOverride, setPlatformOverride] = useState<boolean | null>(null);
  const applePlatform = platformOverride ?? detectedApplePlatform;

  useEffect(() => {
    const handleShortcutHelp = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.key !== "?" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      onOpenChange(true);
    };

    document.addEventListener("keydown", handleShortcutHelp);
    return () => document.removeEventListener("keydown", handleShortcutHelp);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[10021] max-h-[calc(100vh-32px)] w-[calc(100%-32px)] max-w-[780px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[20px] border border-[#E7E8EC] bg-white p-0 font-syne shadow-[0_24px_80px_rgba(16,24,40,0.24)]"
        overlayClassName="z-[10020] bg-[#101323]/45 backdrop-blur-[2px]"
      >
        <DialogHeader className="space-y-0 border-b border-[#EAECF0] px-6 py-5 pr-14 text-left">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#F0EDFF] text-[#6847F4]">
                <Keyboard
                  aria-hidden="true"
                  className="size-5"
                  strokeWidth={1.8}
                />
              </span>
              <div>
                <DialogTitle className="text-[18px] font-semibold leading-6 text-[#101323]">
                  Keyboard shortcuts
                </DialogTitle>
                <DialogDescription className="mt-1 text-[13px] leading-5 text-[#667085]">
                  Work faster while the slide canvas is active. Shortcuts pause
                  while you are typing in a text field.
                </DialogDescription>
              </div>
            </div>
            <div
              aria-label="Shortcut platform"
              className="inline-flex w-fit shrink-0 rounded-[9px] border border-[#E1E3E9] bg-[#F6F6F9] p-1"
              role="group"
            >
              <PlatformButton
                active={!applePlatform}
                label="Windows / Linux"
                onClick={() => setPlatformOverride(false)}
              />
              <PlatformButton
                active={applePlatform}
                label="macOS"
                onClick={() => setPlatformOverride(true)}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid items-start gap-4 md:grid-cols-2">
            {EDITOR_SHORTCUT_SECTIONS.map((section) => {
              const SectionIcon = SECTION_ICONS[section.id];
              return (
                <section
                  key={section.id}
                  className="overflow-hidden rounded-[14px] border border-[#EAECF0] bg-[#FCFCFD]"
                >
                  <div className="border-b border-[#EAECF0] bg-white px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <SectionIcon
                        aria-hidden="true"
                        className="size-4 text-[#6847F4]"
                        strokeWidth={1.8}
                      />
                      <h3 className="text-[14px] font-semibold text-[#101323]">
                        {section.title}
                      </h3>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-[#7A8295]">
                      {section.description}
                    </p>
                  </div>
                  <div className="divide-y divide-[#EAECF0]">
                    {section.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex min-h-[68px] items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#344054]">
                            {shortcut.label}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-4 text-[#7A8295]">
                            {shortcut.description}
                          </p>
                        </div>
                        <ShortcutKeys
                          applePlatform={applePlatform}
                          shortcut={shortcut}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#EAECF0] bg-[#FCFCFD] px-6 py-3 text-center text-[11px] text-[#7A8295]">
          Showing shortcuts for {applePlatform ? "macOS" : "Windows and Linux"}.
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlatformButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-[6px] px-2.5 py-1.5 font-manrope text-[11px] font-semibold transition-colors ${
        active
          ? "bg-white text-[#6847F4] shadow-[0_1px_3px_rgba(16,24,40,0.12)]"
          : "text-[#667085] hover:text-[#344054]"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
