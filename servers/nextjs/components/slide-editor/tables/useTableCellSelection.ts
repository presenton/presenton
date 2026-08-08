import { useCallback, useEffect, useMemo, useState } from "react";
import type { TableCellSelection } from "@/components/slide-editor/state/state";

type ElementSelectionLike = {
  elementPath: number[];
};

export function useTableCellSelection<
  TSelection extends object | null,
  TElementSelection extends ElementSelectionLike,
>({
  keyForSelection,
  selection,
}: {
  keyForSelection: (
    selection: NonNullable<TSelection> | TElementSelection,
  ) => string;
  selection: TSelection;
}) {
  const [selectedTableCell, setSelectedTableCell] =
    useState<TableCellSelection | null>(null);
  const [editingTableCell, setEditingTableCell] =
    useState<TableCellSelection | null>(null);

  useEffect(() => {
    if (!selectedTableCell) return;
    if (
      !selection ||
      selectedTableCell.elementPath !==
        keyForSelection(selection as NonNullable<TSelection>)
    ) {
      setSelectedTableCell(null);
    }
  }, [keyForSelection, selectedTableCell, selection]);

  useEffect(() => {
    if (!editingTableCell) return;
    if (
      !selection ||
      editingTableCell.elementPath !==
        keyForSelection(selection as NonNullable<TSelection>)
    ) {
      setEditingTableCell(null);
    }
  }, [editingTableCell, keyForSelection, selection]);

  const cellSelectionFor = useCallback(
    (
      elementSelection: TElementSelection,
      rowIndex: number,
      colIndex: number,
    ): TableCellSelection => ({
      elementIndex: elementSelection.elementPath[0] ?? 0,
      elementPath: keyForSelection(elementSelection),
      rowIndex,
      colIndex,
    }),
    [keyForSelection],
  );

  const clearTableCellSelection = useCallback(() => {
    setSelectedTableCell(null);
    setEditingTableCell(null);
  }, []);

  const clearTableCellEditing = useCallback(() => {
    setEditingTableCell(null);
  }, []);

  const selectTableCellSelection = useCallback(
    (
      elementSelection: TElementSelection,
      rowIndex: number,
      colIndex: number,
    ) => {
      setEditingTableCell(null);
      setSelectedTableCell(
        cellSelectionFor(elementSelection, rowIndex, colIndex),
      );
    },
    [cellSelectionFor],
  );

  const editTableCellSelection = useCallback(
    (
      elementSelection: TElementSelection,
      rowIndex: number,
      colIndex: number,
    ) => {
      const nextSelection = cellSelectionFor(
        elementSelection,
        rowIndex,
        colIndex,
      );
      setSelectedTableCell(nextSelection);
      setEditingTableCell(nextSelection);
    },
    [cellSelectionFor],
  );

  const visibleSelectedTableCell = useMemo(
    () => (editingTableCell ? null : selectedTableCell),
    [editingTableCell, selectedTableCell],
  );

  return {
    clearTableCellEditing,
    clearTableCellSelection,
    editingTableCell,
    editTableCellSelection,
    selectedTableCell,
    selectTableCellSelection,
    visibleSelectedTableCell,
  };
}
