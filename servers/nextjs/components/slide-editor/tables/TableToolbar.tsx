import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronLeft,
  ChevronRight,
  Columns3,
  MoreVertical,
  Plus,
  Rows3,
  Settings,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  TableCellSelection,
  TableSlideElement,
} from "@/components/slide-editor/state/state";
import { withHash } from "@/components/slide-editor/utils/color";
import {
  elementBox,
  setTableRowsFromStrings,
  tableRowsAsStrings,
} from "@/components/slide-editor/model/element-model";
import type { TableCell } from "@/components/slide-editor/types";
import { DeferredColorInput } from "@/components/slide-editor/toolbar/DeferredColorInput";
import {
  FloatingToolbar,
  FloatingToolbarPanel,
  type FloatingToolbarBox,
} from "@/components/slide-editor/toolbar/FloatingToolbar";

type TableCellAlignment = NonNullable<TableCell["alignment"]>;

const TABLE_CELL_ALIGNMENTS = ["left", "center", "right"] as const satisfies
  readonly TableCellAlignment[];

export function TableToolbarControls({
  element,
  index,
  selectedCell,
  onChange,
}: {
  element: TableSlideElement;
  index: number;
  selectedCell: TableCellSelection | null;
  onChange: (index: number, element: TableSlideElement) => void;
}) {
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const rows = tableRowsAsStrings(element);
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const activeRow = Math.min(
    rows.length - 1,
    Math.max(0, selectedCell?.rowIndex ?? 0),
  );
  const activeColumn = Math.min(
    columnCount - 1,
    Math.max(0, selectedCell?.colIndex ?? 0),
  );
  const activeCell =
    activeRow === 0
      ? element.columns[activeColumn]
      : element.rows[activeRow - 1]?.[activeColumn];
  const activeCellFillColor =
    activeCell?.color?.color ??
    (activeCell as TableCell & { fill?: { color?: string | null } | null })
      ?.fill?.color;
  const colorPickerValue = activeCellFillColor ?? "FFFFFF";
  const activeCellAlignment: TableCellAlignment =
    activeCell?.alignment ?? "left";
  const ActiveCellAlignmentIcon =
    activeCellAlignment === "center"
      ? AlignCenter
      : activeCellAlignment === "right"
        ? AlignRight
        : AlignLeft;
  const canAddRow = rows.length < 8;
  const canAddColumn = columnCount < 6;
  const canDeleteRow = rows.length > 2;
  const canDeleteColumn = columnCount > 1;
  const canMoveColumnLeft = activeColumn > 0;
  const canMoveColumnRight = activeColumn < columnCount - 1;

  useEffect(() => {
    if (!tableMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-inline-edit-ignore='true']")) return;
      if (toolbarRef.current?.contains(event.target as Node)) return;
      setTableMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [tableMenuOpen]);

  const normalizeRows = (nextRows: string[][]) =>
    nextRows.map((row) =>
      Array.from({ length: columnCount }, (_, colIndex) => row[colIndex] ?? ""),
    );

  const commitRows = (nextRows: string[][]) => {
    onChange(index, setTableRowsFromStrings(element, nextRows));
  };

  const addRow = () => {
    if (!canAddRow) return;
    const nextRows = normalizeRows(rows);
    const insertIndex = Math.min(nextRows.length, activeRow + 1);
    nextRows.splice(
      insertIndex,
      0,
      Array.from({ length: columnCount }, () => ""),
    );
    commitRows(nextRows);
  };

  const deleteRow = () => {
    if (!canDeleteRow) return;
    const nextRows = normalizeRows(rows);
    nextRows.splice(activeRow, 1);
    commitRows(nextRows);
  };

  const addColumn = () => {
    if (!canAddColumn) return;
    const insertIndex = Math.min(columnCount, activeColumn + 1);
    commitRows(
      rows.map((row) => {
        const next = Array.from(
          { length: columnCount },
          (_, colIndex) => row[colIndex] ?? "",
        );
        next.splice(insertIndex, 0, "");
        return next;
      }),
    );
  };

  const deleteColumn = () => {
    if (!canDeleteColumn) return;
    commitRows(
      rows.map((row) =>
        Array.from({ length: columnCount }, (_, colIndex) => row[colIndex] ?? "")
          .filter((_, colIndex) => colIndex !== activeColumn),
      ),
    );
  };

  const moveColumn = (direction: "left" | "right") => {
    const targetColumn =
      direction === "left" ? activeColumn - 1 : activeColumn + 1;
    if (targetColumn < 0 || targetColumn >= columnCount) return;
    commitRows(
      rows.map((row) => {
        const next = Array.from(
          { length: columnCount },
          (_, colIndex) => row[colIndex] ?? "",
        );
        [next[activeColumn], next[targetColumn]] = [
          next[targetColumn],
          next[activeColumn],
        ];
        return next;
      }),
    );
  };

  const updateActiveCell = (
    patchCell: (cell: TableCell | undefined) => TableCell,
  ) => {
    if (activeRow === 0) {
      onChange(index, {
        ...element,
        columns: element.columns.map((cell, colIndex) =>
          colIndex === activeColumn ? patchCell(cell) : cell,
        ),
      });
      return;
    }

    onChange(index, {
      ...element,
      rows: element.rows.map((row, rowIndex) =>
        rowIndex === activeRow - 1
          ? Array.from(
            { length: columnCount },
            (_, colIndex) =>
              colIndex === activeColumn
                ? patchCell(row[colIndex])
                : row[colIndex] ?? { runs: [] },
          )
          : row,
      ),
    });
  };

  const updateActiveCellFillColor = (color: string) => {
    updateActiveCell((cell) => ({
      ...(cell ?? { runs: [] }),
      color: {
        ...(cell?.color ?? {}),
        color,
      },
    }));
  };
  const cycleActiveCellAlignment = () => {
    const activeIndex = TABLE_CELL_ALIGNMENTS.indexOf(activeCellAlignment);
    const nextAlignment =
      TABLE_CELL_ALIGNMENTS[
      (activeIndex + 1) % TABLE_CELL_ALIGNMENTS.length
      ] ?? "left";
    updateActiveCell((cell) => ({
      ...(cell ?? { runs: [] }),
      alignment: nextAlignment,
    }));
  };
  const runTableMenuAction = (action: () => void) => {
    action();
    setTableMenuOpen(false);
  };

  return (
    <div ref={toolbarRef} style={tableControlsStyle}>
      <button
        type="button"
        aria-label="Cell background color"
        title="Cell background"
        style={iconButtonStyle}
        onClick={() => colorInputRef.current?.click()}
      >
        <span
          style={{
            ...colorDotStyle,
            background: activeCellFillColor
              ? withHash(activeCellFillColor)
              : "transparent",
          }}
        />
        <DeferredColorInput
          ref={colorInputRef}
          aria-hidden="true"
          tabIndex={-1}
          value={colorPickerValue}
          onCommit={updateActiveCellFillColor}
          style={hiddenColorInputStyle}
        />
      </button>
      <Divider />
      <button
        type="button"
        aria-label="Table alignment"
        title={`Align ${nextAlignmentLabel(activeCellAlignment)}`}
        style={iconButtonStyle}
        onClick={cycleActiveCellAlignment}
      >
        <ActiveCellAlignmentIcon size={16} strokeWidth={1.33} />
      </button>
      <Divider />
      <button
        type="button"
        aria-label="Delete row"
        title="Delete row"
        disabled={!canDeleteRow}
        style={{
          ...iconButtonStyle,
          opacity: canDeleteRow ? 1 : 0.36,
          cursor: canDeleteRow ? "pointer" : "not-allowed",
        }}
        onClick={deleteRow}
      >
        <Trash2 size={16} strokeWidth={1.33} />
      </button>
      <Divider />
      <button
        type="button"
        aria-label="Table cell actions"
        aria-expanded={tableMenuOpen}
        title="Table cell actions"
        style={{
          ...iconButtonStyle,
          ...(tableMenuOpen ? activeButtonStyle : null),
        }}
        onClick={() => setTableMenuOpen((open) => !open)}
      >
        <Settings size={16} strokeWidth={1.33} />
      </button>
      <TableToolbarMenu
        canAddColumn={canAddColumn}
        canAddRow={canAddRow}
        canDeleteColumn={canDeleteColumn}
        canDeleteRow={canDeleteRow}
        canMoveColumnLeft={canMoveColumnLeft}
        canMoveColumnRight={canMoveColumnRight}
        menuOpen={tableMenuOpen}
        onAddColumn={() => runTableMenuAction(addColumn)}
        onAddRow={() => runTableMenuAction(addRow)}
        onDeleteColumn={() => runTableMenuAction(deleteColumn)}
        onDeleteRow={() => runTableMenuAction(deleteRow)}
        onMoveColumnLeft={() => runTableMenuAction(() => moveColumn("left"))}
        onMoveColumnRight={() => runTableMenuAction(() => moveColumn("right"))}
      />
    </div>
  );
}

export function TableToolbar({
  anchorBox,
  element,
  index,
  scale,
  selectedCell,
  onChange,
}: {
  anchorBox?: FloatingToolbarBox | null;
  element: TableSlideElement;
  index: number;
  scale: number;
  selectedCell: TableCellSelection | null;
  onChange: (index: number, element: TableSlideElement) => void;
}) {
  const box = elementBox(element);

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
      fallbackWidth={290}
      inlineEditIgnore
    >
      <div style={standaloneToolbarStyle}>
        <TableToolbarControls
          element={element}
          index={index}
          selectedCell={selectedCell}
          onChange={onChange}
        />
      </div>
    </FloatingToolbar>
  );
}

function TableToolbarMenu({
  canAddColumn,
  canAddRow,
  canDeleteColumn,
  canDeleteRow,
  canMoveColumnLeft,
  canMoveColumnRight,
  menuOpen,
  onAddColumn,
  onAddRow,
  onDeleteColumn,
  onDeleteRow,
  onMoveColumnLeft,
  onMoveColumnRight,
}: {
  canAddColumn: boolean;
  canAddRow: boolean;
  canDeleteColumn: boolean;
  canDeleteRow: boolean;
  canMoveColumnLeft: boolean;
  canMoveColumnRight: boolean;
  menuOpen: boolean;
  onAddColumn: () => void;
  onAddRow: () => void;
  onDeleteColumn: () => void;
  onDeleteRow: () => void;
  onMoveColumnLeft: () => void;
  onMoveColumnRight: () => void;
}) {
  if (!menuOpen) return null;

  return (
    <FloatingToolbarPanel style={menuStyle}>
      <MenuItem
        disabled={!canDeleteRow}
        icon={<Rows3 size={20} strokeWidth={2.2} />}
        label="Delete Row"
        onClick={onDeleteRow}
      />
      <MenuItem
        disabled={!canDeleteColumn}
        icon={<Columns3 size={20} strokeWidth={2.2} />}
        label="Delete Column"
        onClick={onDeleteColumn}
      />
      <MenuItem
        disabled={!canAddRow}
        icon={<Plus size={20} strokeWidth={2.4} />}
        label="Add Row"
        onClick={onAddRow}
      />
      <MenuItem
        disabled={!canAddColumn}
        icon={<Plus size={20} strokeWidth={2.4} />}
        label="Add Column"
        onClick={onAddColumn}
      />
      <div style={menuDividerStyle} />
      <MenuItem
        disabled={!canMoveColumnRight}
        icon={<ChevronRight size={20} strokeWidth={2.4} />}
        label="Move Column Right"
        onClick={onMoveColumnRight}
      />
      <MenuItem
        disabled={!canMoveColumnLeft}
        icon={<ChevronLeft size={20} strokeWidth={2.4} />}
        label="Move Column Left"
        onClick={onMoveColumnLeft}
      />
    </FloatingToolbarPanel>
  );
}

function MenuItem({
  disabled = false,
  icon,
  label,
  shortcut,
  strong = false,
  onClick,
}: {
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  shortcut?: string;
  strong?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        ...menuItemStyle,
        ...(strong ? strongMenuItemStyle : null),
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
    >
      {icon ? <span style={menuIconStyle}>{icon}</span> : null}
      <span>{label}</span>
      {shortcut ? <span style={menuShortcutStyle}>{shortcut}</span> : null}
    </button>
  );
}

function Divider() {
  return <span aria-hidden="true" style={dividerStyle} />;
}

function nextAlignmentLabel(alignment: TableCellAlignment) {
  const activeIndex = TABLE_CELL_ALIGNMENTS.indexOf(alignment);
  return (
    TABLE_CELL_ALIGNMENTS[
    (activeIndex + 1) % TABLE_CELL_ALIGNMENTS.length
    ] ?? "left"
  );
}

const standaloneToolbarStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 14,
  border: "1px solid #E7E8EC",
  background: "#FFFFFF",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.18)",
};

const tableControlsStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  height: 28,
  color: "#191919",
  fontFamily:
    "syne, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const iconButtonStyle: CSSProperties = {
  position: "relative",
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: "#0F172A",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
};

const activeButtonStyle: CSSProperties = {
  background: "#F6F3FF",
};

const dividerStyle: CSSProperties = {
  width: 1,
  height: 28,
  margin: "0 8px",
  background: "#E7E8EC",
};

const colorDotStyle: CSSProperties = {
  width: 16,
  height: 16,
  boxSizing: "border-box",
  borderRadius: 999,
  border: "1px solid rgba(15, 23, 42, 0.26)",
  boxShadow:
    "inset 0 0 0 1px rgba(255, 255, 255, 0.68), 0 1px 3px rgba(15, 23, 42, 0.22)",
  display: "block",
};

const hiddenColorInputStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  opacity: 0,
  pointerEvents: "none",
};

const menuStyle: CSSProperties = {
  width: 260,
  padding: "14px 0",
  borderRadius: 14,
  border: "1px solid #E7E8EC",
  background: "#FFFFFF",
  boxShadow: "0 20px 52px rgba(15, 23, 42, 0.22)",
};

const menuItemStyle: CSSProperties = {
  width: "100%",
  height: 44,
  border: 0,
  background: "transparent",
  color: "#191919",
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "0 24px",
  fontSize: 15,
  fontWeight: 500,
  letterSpacing: 0,
  textAlign: "left",
};

const strongMenuItemStyle: CSSProperties = {
  color: "#000000",
};

const menuIconStyle: CSSProperties = {
  width: 22,
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#111827",
};

const menuShortcutStyle: CSSProperties = {
  marginLeft: "auto",
  padding: "4px 6px",
  borderRadius: 6,
  background: "#F6F6F9",
  color: "#808080",
  fontSize: 12,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const menuDividerStyle: CSSProperties = {
  height: 1,
  margin: "10px 0",
  background: "#ECEDEF",
};
