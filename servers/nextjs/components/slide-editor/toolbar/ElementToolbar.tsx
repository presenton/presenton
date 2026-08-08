import type { ReactNode } from "react";
import type { SlideElement } from "@/components/slide-editor/types";
import type { TemplateFontOption } from "@/components/slide-editor/text/google-fonts";
import type { TextSelectionRange } from "@/components/slide-editor/text/text-runs";
import type { TableCellSelection } from "@/components/slide-editor/state/state";
import type { ComponentActionsMenuActions } from "@/components/slide-editor/selection/ComponentActionsMenu";
import { BulletsToolbar } from "@/components/slide-editor/text/BulletsToolbar";
import { ChartToolbar } from "@/components/slide-editor/charts/ChartToolbar";
import { DesignVariablesToolbar } from "@/components/slide-editor/toolbar/DesignVariablesToolbar";
import { IconToolbar } from "@/components/slide-editor/images/IconToolbar";
import { ImageToolbar } from "@/components/slide-editor/images/ImageToolbar";
import { ShapeToolbar } from "@/components/slide-editor/shapes/ShapeToolbar";
import { TableToolbar } from "@/components/slide-editor/tables/TableToolbar";
import { TextToolbar } from "@/components/slide-editor/text/TextToolbar";
import { MathToolbar } from "@/components/slide-editor/math/MathToolbar";

type ElementToolbarProps = {
  element: SlideElement;
  index: number;
  anchorBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  path: string;
  scale: number;
  componentActions?: ComponentActionsMenuActions | null;
  selectedTableCell: TableCellSelection | null;
  templateFonts?: TemplateFontOption[];
  textSelectionRange?: TextSelectionRange | null;
  onChange: (index: number, element: SlideElement, path?: string) => void;
  onImageCropModeChange?: (active: boolean) => void;
  onEditIcon: (index: number, path?: string) => void;
  onEditImage: (index: number, path?: string) => void;
  onEditText?: (index: number, path?: string) => void;
};

type ToolbarRenderer = (props: ElementToolbarProps) => ReactNode;

const TOOLBAR_RENDERERS: Partial<
  Record<SlideElement["type"], ToolbarRenderer>
> = {
  math: ({
    element,
    anchorBox,
    index,
    onChange,
    path,
    scale,
    componentActions,
  }) =>
    element.type === "math" ? (
      <MathToolbar
        element={element}
        index={index}
        anchorBox={anchorBox}
        scale={scale}
        componentActions={componentActions}
        onChange={(index, element) => onChange(index, element, path)}
      />
    ) : null,
  text: ({
    element,
    anchorBox,
    index,
    onChange,
    path,
    scale,
    componentActions,
    templateFonts,
    textSelectionRange,
  }) =>
    element.type === "text" ? (
      <TextToolbar
        element={element}
        index={index}
        anchorBox={anchorBox}
        scale={scale}
        componentActions={componentActions}
        selectionRange={textSelectionRange}
        templateFonts={templateFonts}
        onChange={(index, element) => onChange(index, element, path)}
      />
    ) : null,
  "text-list": ({
    element,
    anchorBox,
    index,
    onChange,
    path,
    scale,
    componentActions,
    templateFonts,
    textSelectionRange,
  }) =>
    element.type === "text-list" ? (
      <BulletsToolbar
        element={element}
        index={index}
        anchorBox={anchorBox}
        scale={scale}
        componentActions={componentActions}
        selectionRange={textSelectionRange}
        templateFonts={templateFonts}
        onChange={(index, element) => onChange(index, element, path)}
      />
    ) : null,
  image: ({
    anchorBox,
    componentActions,
    element,
    index,
    onChange,
    onEditIcon,
    onImageCropModeChange,
    path,
    scale,
  }) =>
    element.type === "image" ? (
      element.is_icon === true ? (
        <IconToolbar
          element={element}
          index={index}
          anchorBox={anchorBox}
          scale={scale}
          componentActions={componentActions}
          onChange={(index, element) => onChange(index, element, path)}
          onEditIcon={() => onEditIcon(index, path)}
        />
      ) : (
        <ImageToolbar
          element={element}
          index={index}
          anchorBox={anchorBox}
          scale={scale}
          onCropModeChange={onImageCropModeChange}
          onChange={(index, element) => onChange(index, element, path)}
        />
      )
    ) : null,
  vector: ({ anchorBox, componentActions, element, index, onChange, path, scale }) =>
    element.type === "vector" ? (
      <ShapeToolbar
        element={element}
        index={index}
        anchorBox={anchorBox}
        scale={scale}
        componentActions={componentActions}
        onChange={(index, element) => onChange(index, element, path)}
      />
    ) : null,
  chart: ({ anchorBox, element, index, onChange, path, scale }) =>
    element.type === "chart" ? (
      <ChartToolbar
        element={element}
        index={index}
        anchorBox={anchorBox}
        scale={scale}
        onChange={(index, element) => onChange(index, element, path)}
      />
    ) : null,

  table: ({
    anchorBox,
    element,
    index,
    onChange,
    path,
    scale,
    selectedTableCell,
  }) =>
    element.type === "table" ? (
      <TableToolbar
        element={element}
        index={index}
        anchorBox={anchorBox}
        scale={scale}
        selectedCell={
          (selectedTableCell?.elementPath ??
            (selectedTableCell
              ? String(selectedTableCell.elementIndex)
              : null)) === path
            ? selectedTableCell
            : null
        }
        onChange={(index, element) => onChange(index, element, path)}
      />
    ) : null,
};

export function ElementToolbar(props: ElementToolbarProps) {
  if (props.element.design_variables?.length) {
    return (
      <DesignVariablesToolbar
        element={props.element}
        index={props.index}
        anchorBox={props.anchorBox}
        scale={props.scale}
        onChange={(index, element) =>
          props.onChange(index, element, props.path)
        }
      />
    );
  }

  const renderToolbar = TOOLBAR_RENDERERS[props.element.type];
  return renderToolbar ? renderToolbar(props) : null;
}
