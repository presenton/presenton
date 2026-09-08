import type { Box, ElementSelection } from "@/components/slide-editor/model/model";

export type InfographicCanvasTargetKind =
  | "item"
  | "icon"
  | "image"
  | "shape"
  | "text";
export type InfographicCanvasCollection = "items" | "rows";

export type InfographicCanvasTextStyle = {
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  fontStyle?: "italic" | "normal";
  fontWeight?: number;
  lineHeight?: number;
  textAlign?: "center" | "justify" | "left" | "right";
  verticalAlign?: "bottom" | "middle" | "top";
};

export type InfographicCanvasTarget = {
  box: Box;
  collection?: InfographicCanvasCollection;
  displayText?: string;
  editing?: boolean;
  field?: string;
  itemPath: number[];
  kind: InfographicCanvasTargetKind;
  textStyle?: InfographicCanvasTextStyle;
};

export type InfographicCanvasSelection = {
  selection: ElementSelection;
  target: InfographicCanvasTarget;
};

export function sameInfographicCanvasSelection(
  left: InfographicCanvasSelection | null,
  right: InfographicCanvasSelection | null,
) {
  if (!left || !right) return left === right;
  return (
    left.target.kind === right.target.kind &&
    left.target.field === right.target.field &&
    left.target.displayText === right.target.displayText &&
    left.target.collection === right.target.collection &&
    left.selection.componentIndex === right.selection.componentIndex &&
    sameNumberPath(left.selection.elementPath, right.selection.elementPath) &&
    sameNumberPath(left.target.itemPath, right.target.itemPath)
  );
}

function sameNumberPath(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
