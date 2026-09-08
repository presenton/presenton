"use client";

import { Trash2 } from "lucide-react";
import {
  ComponentUngroupButton,
  type ComponentActionsMenuActions,
} from "@/components/slide-editor/selection/ComponentActionsMenu";
import {
  FloatingToolbar,
  type FloatingToolbarBox,
} from "@/components/slide-editor/toolbar/FloatingToolbar";

export function InfographicItemToolbar({
  anchorBox,
  canDelete,
  canUngroup,
  onDelete,
  onUngroup,
}: {
  anchorBox: FloatingToolbarBox;
  canDelete: boolean;
  canUngroup: boolean;
  onDelete: () => void;
  onUngroup: () => void;
}) {
  const ungroupActions: ComponentActionsMenuActions = {
    canUngroup,
    componentCount: 1,
    componentIndex: 0,
    onDelete,
    onDuplicate: () => undefined,
    onLayerAction: () => undefined,
    onUngroup,
  };

  return (
    <FloatingToolbar
      anchorBox={anchorBox}
      fallbackWidth={172}
      inlineEditIgnore
      className="inline-flex items-center gap-2 rounded-[6px] bg-white px-[10px] py-[6px] font-syne text-[#191919] shadow-[0_0_4px_rgba(0,0,0,0.15)]"
    >
      <button
        type="button"
        title="Delete infographic item"
        disabled={!canDelete}
        onClick={onDelete}
        className="inline-flex h-8 items-center gap-1.5 rounded-[6px] px-2 text-[13px] font-medium hover:bg-[#F6F6F9] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 size={15} />
        <span>Delete</span>
      </button>
      {canUngroup ? (
        <>
          <Divider />
          <ComponentUngroupButton actions={ungroupActions} />
        </>
      ) : null}
    </FloatingToolbar>
  );
}

function Divider() {
  return <span aria-hidden="true" className="h-5 w-px bg-[#EDEEEF]" />;
}
