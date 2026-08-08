"use client";

import { useState } from "react";
import { Copy, MoreVertical, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canApplyComponentLayerAction,
  type ComponentLayerAction,
} from "@/components/slide-editor/selection/layering";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ComponentActionsMenuActions = {
  canUngroup: boolean;
  componentIndex: number;
  componentCount: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onLayerAction: (action: ComponentLayerAction) => void;
  onUngroup: () => void;
};

const COMPONENT_LAYER_ACTIONS: Array<{
  action: ComponentLayerAction;
  label: string;
  shortcut: string;
}> = [
  {
    action: "bring-to-front",
    label: "Bring to Front",
    shortcut: "Shift+Alt+K",
  },
  {
    action: "bring-forward",
    label: "Bring Forward",
    shortcut: "Alt+K",
  },
  {
    action: "send-backward",
    label: "Send Backward",
    shortcut: "Alt+J",
  },
  {
    action: "send-to-back",
    label: "Send Back",
    shortcut: "Shift+Alt+J",
  },
];

export function ComponentActionsMenu({
  actions,
  open,
  onOpenChange,
}: {
  actions: ComponentActionsMenuActions;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const menuOpen = open ?? uncontrolledOpen;
  const setMenuOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="More"
          aria-label="More"
          className={cn(
            "grid h-8 w-8 place-items-center rounded-[4px] border-0 bg-transparent font-manrope text-black hover:bg-[#F6F6F9]",
            menuOpen && "bg-[#F6F6F9]",
          )}
        >
          <MoreVertical
            size={16}
            className="text-black"
            strokeWidth={1.33}
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-template-v2-floating-toolbar="true"
        data-inline-edit-ignore="true"
        align="end"
        sideOffset={12}
        collisionPadding={8}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className="z-[10001] box-border w-[244px] rounded-[12px] border border-[#EDEEEF] bg-white py-2 font-syne text-[14px] font-normal leading-normal tracking-[0.14px] text-[#191919] shadow-[0_6px_18px_rgba(16,24,40,0.08)]"
      >
        <ComponentActionsMenuItem
          strong
          icon={Copy}
          label="Duplicate"
          onClick={actions.onDuplicate}
        />
        {COMPONENT_LAYER_ACTIONS.map(({ action, label, shortcut }) => {
          const disabled = !canApplyComponentLayerAction(
            actions.componentIndex,
            actions.componentCount,
            action,
          );
          return (
            <ComponentActionsMenuItem
              key={action}
              disabled={disabled}
              label={label}
              shortcut={shortcut}
              onClick={() => actions.onLayerAction(action)}
            />
          );
        })}
        <DropdownMenuSeparator className="my-1 h-px bg-[#E7E8EC]" />
        <ComponentActionsMenuItem
          strong
          icon={Trash2}
          label="Delete Component"
          onClick={actions.onDelete}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ComponentUngroupButton({
  actions,
}: {
  actions: ComponentActionsMenuActions;
}) {
  if (!actions.canUngroup) return null;
  return (
    <button
      type="button"
      title="Ungroup"
      onClick={actions.onUngroup}
      className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-[6px] px-2 font-manrope text-[14px] font-medium leading-4 text-[#191919] hover:bg-[#F6F6F9]"
    >
      <span>Ungroup</span>
    </button>
  );
}

function ComponentActionsMenuItem({
  disabled,
  icon: Icon = undefined,
  label,
  shortcut,
  strong,
  onClick,
}: {
  disabled?: boolean;
  icon?: LucideIcon;
  label: string;
  shortcut?: string;
  strong?: boolean;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={onClick}
      style={{ cursor: disabled ? "not-allowed" : "pointer" }}
      className={cn(
        "flex w-full cursor-default items-center gap-2 rounded-none px-4 py-2.5 text-left font-syne text-[14px] font-normal leading-normal tracking-[0.14px] text-[#191919] outline-none hover:bg-[#F6F6F9] focus:bg-[#F6F6F9] focus:text-[#191919]",
        strong && "text-black",
        disabled &&
          "cursor-not-allowed text-[#A0A3AD] hover:bg-transparent focus:bg-transparent data-[disabled]:opacity-100",
      )}
    >
      {Icon ? <Icon size={16} strokeWidth={1.33} aria-hidden /> : null}
      <span>{label}</span>
      {shortcut ? (
        <span
          className={cn(
            "ml-auto inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[6px] bg-[#F6F6F9] px-1.5 py-1 font-manrope text-[12px] font-normal leading-none tracking-[0.14px] text-[#808080]",
            disabled && "bg-[#F7F7FA] text-[#B0B3BB]",
          )}
        >
          {shortcut}
        </span>
      ) : null}
    </DropdownMenuItem>
  );
}
