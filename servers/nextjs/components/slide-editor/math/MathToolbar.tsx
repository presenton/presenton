"use client";

import { useEffect, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Sigma } from "lucide-react";
import type { ComponentActionsMenuActions } from "@/components/slide-editor/selection/ComponentActionsMenu";
import {
  ComponentActionsMenu,
  ComponentUngroupButton,
} from "@/components/slide-editor/selection/ComponentActionsMenu";
import type { MathSlideElement } from "@/components/slide-editor/state/state";
import { elementBox } from "@/components/slide-editor/model/element-model";
import { DeferredColorInput } from "@/components/slide-editor/toolbar/DeferredColorInput";
import {
  FloatingToolbar,
  type FloatingToolbarBox,
} from "@/components/slide-editor/toolbar/FloatingToolbar";
import { normalizeMathLatex } from "@/lib/math";

export function MathToolbar({
  anchorBox,
  componentActions,
  element,
  index,
  onChange,
  scale,
}: {
  anchorBox?: FloatingToolbarBox | null;
  componentActions?: ComponentActionsMenuActions | null;
  element: MathSlideElement;
  index: number;
  onChange: (index: number, element: MathSlideElement) => void;
  scale: number;
}) {
  const box = elementBox(element);
  const [latex, setLatex] = useState(element.latex);
  const fontSize = element.font?.size ?? 32;
  const color = withHash(element.font?.color ?? "#111827");
  const horizontal = element.alignment?.horizontal ?? "center";

  useEffect(() => setLatex(element.latex), [element.latex]);

  const update = (changes: Partial<MathSlideElement>) => {
    onChange(index, { ...element, ...changes });
  };
  const updateFont = (changes: NonNullable<MathSlideElement["font"]>) => {
    update({ font: { ...(element.font ?? {}), ...changes } });
  };
  const commitLatex = () => {
    const normalized = normalizeMathLatex(latex);
    if (normalized && normalized !== element.latex) update({ latex: normalized });
  };

  return (
    <FloatingToolbar
      anchorBox={
        anchorBox ?? {
          x: box.x * scale,
          y: box.y * scale,
          width: box.w * scale,
          height: box.h * scale,
        }
      }
      fallbackWidth={620}
      inlineEditIgnore
      className="inline-flex max-w-[760px] items-center gap-2 rounded-[6px] bg-white px-[10px] py-[6px] font-syne text-[#191919] shadow-[0_0_4px_rgba(0,0,0,0.15)]"
    >
      <Sigma size={16} strokeWidth={1.8} aria-hidden="true" />
      <textarea
        aria-label="LaTeX expression"
        title="LaTeX expression"
        value={latex}
        rows={1}
        onChange={(event) => setLatex(event.target.value)}
        onBlur={commitLatex}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            commitLatex();
            event.currentTarget.blur();
          }
        }}
        className="h-8 w-[280px] resize-none rounded-[5px] border border-[#E5E7EB] px-2 py-1 text-[12px] leading-5 outline-none focus:border-[#7C3AED]"
      />

      <Divider />

      <label className="flex h-8 items-center gap-1 rounded-[5px] border border-[#E5E7EB] px-2 text-[12px]">
        <span>Size</span>
        <input
          aria-label="Equation font size"
          type="number"
          min={8}
          max={256}
          value={fontSize}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value)) {
              updateFont({ size: Math.max(8, Math.min(256, value)) });
            }
          }}
          className="w-10 bg-transparent text-right outline-none"
        />
      </label>

      <label
        title="Equation color"
        aria-label="Equation color"
        className="relative flex h-8 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[12px] hover:bg-[#F6F6F9]"
      >
        <span
          aria-hidden="true"
          className="size-4 rounded-full border border-black/10"
          style={{ backgroundColor: color }}
        />
        <DeferredColorInput
          aria-label="Equation color"
          value={color}
          onCommit={(nextColor) => updateFont({ color: nextColor })}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>

      <Divider />

      {([
        ["left", AlignLeft],
        ["center", AlignCenter],
        ["right", AlignRight],
      ] as const).map(([value, Icon]) => (
        <button
          key={value}
          type="button"
          title={`Align ${value}`}
          aria-label={`Align ${value}`}
          aria-pressed={horizontal === value}
          onClick={() =>
            update({
              alignment: {
                ...(element.alignment ?? {}),
                horizontal: value,
              },
            })
          }
          className={`grid size-8 place-items-center rounded-[5px] ${
            horizontal === value ? "bg-[#EEE9FF] text-[#6D28D9]" : "hover:bg-[#F6F6F9]"
          }`}
        >
          <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
        </button>
      ))}

      {componentActions ? (
        <>
          <Divider />
          <ComponentUngroupButton actions={componentActions} />
          {componentActions.canUngroup ? <Divider /> : null}
          <ComponentActionsMenu actions={componentActions} />
        </>
      ) : null}
    </FloatingToolbar>
  );
}

function withHash(value: string) {
  return value.startsWith("#") || value.startsWith("rgb") ? value : `#${value}`;
}

function Divider() {
  return <span aria-hidden="true" className="h-5 w-px bg-[#EDEEEF]" />;
}
