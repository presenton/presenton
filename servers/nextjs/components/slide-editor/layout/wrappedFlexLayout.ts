export type WrappedFlexElement = Record<string, any>;

export type WrappedFlexBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WrappedFlexLaidOutChild = {
  child: WrappedFlexElement;
  index: number;
  box: WrappedFlexBox | null;
  layoutManaged: boolean;
};

type Dimension = "height" | "width";

type WrappedFlexLayoutOptions = {
  align: string;
  alignSelf: (child: WrappedFlexElement) => string | null;
  alignmentOffset: (alignment: string | null, available: number, used: number) => number;
  availableCross: number;
  availableMain: number;
  childCrossSize: (
    child: WrappedFlexElement,
    direction: "row" | "column",
    crossSize: number,
    alignment: string,
  ) => number;
  children: WrappedFlexElement[];
  clampLayoutSize: (
    value: number,
    child: WrappedFlexElement,
    dimension: Dimension,
  ) => number;
  crossGap: number;
  direction: "row" | "column";
  elementBox: (child: WrappedFlexElement) => WrappedFlexBox;
  flexBasis: (
    child: WrappedFlexElement,
    direction: "row" | "column",
    crossSize: number,
  ) => number;
  isManualPositioned: (child: WrappedFlexElement) => boolean;
  justify: string;
  layoutNumber: (child: WrappedFlexElement, key: string) => number | null;
  mainGap: number;
  padding: { top: number; right: number; bottom: number; left: number };
};

export function layoutWrappedFlexChildren({
  align,
  alignSelf,
  alignmentOffset,
  availableCross,
  availableMain,
  childCrossSize,
  children,
  clampLayoutSize,
  crossGap,
  direction,
  elementBox,
  flexBasis,
  isManualPositioned,
  justify,
  layoutNumber,
  mainGap,
  padding,
}: WrappedFlexLayoutOptions): WrappedFlexLaidOutChild[] {
  const isColumn = direction === "column";
  const lines: Array<
    Array<{ basis: number; child: WrappedFlexElement; index: number }>
  > = [];
  const manual = new Map<number, WrappedFlexLaidOutChild>();

  children.forEach((child, index) => {
    if (isManualPositioned(child)) {
      manual.set(index, {
        child,
        index,
        box: elementBox(child),
        layoutManaged: false,
      });
      return;
    }

    const basis = Math.max(0, flexBasis(child, direction, availableCross));
    let line = lines.at(-1);
    if (!line) {
      line = [];
      lines.push(line);
    }
    const used =
      line.reduce((sum, entry) => sum + entry.basis, 0) +
      mainGap * line.length;
    if (line.length > 0 && used + basis > availableMain) {
      line = [];
      lines.push(line);
    }
    line.push({ basis, child, index });
  });

  if (lines.length === 0) {
    return children.map((child, index) =>
      manual.get(index) ?? {
        child,
        index,
        box: elementBox(child),
        layoutManaged: false,
      },
    );
  }

  const naturalLineCrosses = lines.map((line) =>
    Math.max(
      1,
      ...line.map((entry) => {
        const itemAlignment = alignSelf(entry.child) ?? align;
        return childCrossSize(
          entry.child,
          direction,
          availableCross,
          itemAlignment,
        );
      }),
    ),
  );
  const crossGapTotal = crossGap * Math.max(0, lines.length - 1);
  const usedNaturalCross =
    naturalLineCrosses.reduce((sum, lineCross) => sum + lineCross, 0) +
    crossGapTotal;
  const extraCross = Math.max(0, availableCross - usedNaturalCross);
  const lineCrosses = naturalLineCrosses.map(
    (lineCross) => lineCross + extraCross / lines.length,
  );
  const laidOut = new Map<number, WrappedFlexLaidOutChild>();
  let crossCursor = 0;

  lines.forEach((line, lineNumber) => {
    const lineCross = lineCrosses[lineNumber] ?? 1;
    const gapTotal = mainGap * Math.max(0, line.length - 1);
    const free =
      availableMain -
      gapTotal -
      line.reduce((sum, entry) => sum + entry.basis, 0);
    let mainSizes = line.map((entry) => entry.basis);
    const grows = line.map(
      (entry) => layoutNumber(entry.child, "grow") ?? (entry.basis > 0 ? 0 : 1),
    );
    const growTotal = grows.reduce((sum, grow) => sum + grow, 0);

    if (free > 0 && growTotal > 0) {
      mainSizes = mainSizes.map(
        (size, index) => size + (free * grows[index]) / growTotal,
      );
    } else if (free > 0 && justify === "stretch") {
      mainSizes = mainSizes.map((size) => size + free / line.length);
    }

    const usedMain =
      mainSizes.reduce((sum, size) => sum + size, 0) + gapTotal;
    let mainCursor = alignmentOffset(justify, availableMain, usedMain);

    line.forEach((entry, lineIndex) => {
      const main = clampLayoutSize(
        mainSizes[lineIndex],
        entry.child,
        isColumn ? "height" : "width",
      );
      const itemAlignment = alignSelf(entry.child) ?? align;
      const cross = childCrossSize(
        entry.child,
        direction,
        lineCross,
        itemAlignment,
      );
      const crossOffset = alignmentOffset(
        itemAlignment,
        lineCross,
        cross,
      );
      const box = isColumn
        ? {
            x: padding.left + crossCursor + crossOffset,
            y: padding.top + mainCursor,
            width: cross,
            height: main,
          }
        : {
            x: padding.left + mainCursor,
            y: padding.top + crossCursor + crossOffset,
            width: main,
            height: cross,
          };
      laidOut.set(entry.index, {
        child: entry.child,
        index: entry.index,
        box,
        layoutManaged: true,
      });
      mainCursor += main + mainGap;
    });
    crossCursor += lineCross + crossGap;
  });

  return children.map(
    (child, index) =>
      manual.get(index) ??
      laidOut.get(index) ?? {
        child,
        index,
        box: elementBox(child),
        layoutManaged: false,
      },
  );
}
