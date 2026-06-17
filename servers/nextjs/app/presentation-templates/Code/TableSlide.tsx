import * as z from "zod";

const DEFAULT_TABLE_COLUMNS = ["Feature", "Column 1", "Column 2", "Column 3"];

const DEFAULT_ROWS = [
  { cells: ["Component-based", "check", "check", "check"] },
  { cells: ["TypeScript Support", "check", "check", "check"] },
  { cells: ["Learning Curve", "Medium", "Easy", "Steep"] },
  { cells: ["Bundle Size", "40KB", "34KB", "167KB"] },
  { cells: ["Performance", "Excellent", "Excellent", "Good"] },
  { cells: ["Community Size", "Huge", "Large", "Large"] },
];

const ComparisonRowSchema = z.object({
  cells: z.array(z.string().max(24)).min(1).max(6).meta({
    description: "Cell values for this row in left-to-right order. Match the number of table columns.",
  }),
});

export const slideLayoutId = "table-slide";
export const slideLayoutName = "Table Slide";
export const slideLayoutDescription =
  "A slide with title and a table.";

export const Schema = z.object({
  title: z.string().min(6).max(18).default("Comparison").meta({
    description: "Slide title shown above the table.",
  }),
  tableColumns: z.array(z.string().max(18)).min(1).max(6).meta({
    description: "Table columns shown in the first row.",
  }).default(DEFAULT_TABLE_COLUMNS),
  rows: z
    .array(ComparisonRowSchema)
    .min(1)
    .max(6)
    .default(DEFAULT_ROWS)
    .meta({
      description: "Table rows where each row contains a cells array matching the table columns.",
    }),
}).superRefine((value, ctx) => {
  value.rows.forEach((row, rowIndex) => {
    if (row.cells.length !== value.tableColumns.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows", rowIndex, "cells"],
        message: "Each row must contain the same number of cells as tableColumns.",
      });
    }
  });
});

export type SchemaType = z.infer<typeof Schema>;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getCellFontSize(columnCount: number, rowCount: number, value: string) {
  const lengthPenalty = Math.max(0, value.length - 18) * 0.18;
  const densityPenalty = Math.max(0, columnCount - 4) * 1.2 + Math.max(0, rowCount - 5) * 0.8;

  return clamp(19 - lengthPenalty - densityPenalty, 13, 19);
}

function normalizeColumns(columns?: string[]) {
  const validColumns = Array.isArray(columns)
    ? columns.filter((column) => typeof column === "string" && column.trim())
    : [];

  return validColumns.length ? validColumns.slice(0, 6) : DEFAULT_TABLE_COLUMNS;
}

function normalizeRows(rows: Partial<SchemaType>["rows"], columnCount: number) {
  const validRows = Array.isArray(rows) && rows.length ? rows : DEFAULT_ROWS;

  return validRows.slice(0, 6).map((row) => {
    const cells = Array.isArray(row?.cells) ? row.cells : [];
    return {
      cells: Array.from({ length: columnCount }, (_, index) => cells[index] || ""),
    };
  });
}

function renderCell(value: string, isFirstColumn: boolean, columnCount: number, rowCount: number) {
  if (!isFirstColumn && value && value.toLowerCase() === "check") {
    return (
      <span
        className="block w-full text-center text-[26px] leading-none"
        style={{ color: "var(--graph-2,#37f08e)" }}
      >
        ✓
      </span>
    );
  }

  return (
    <span
      className="block max-w-full overflow-hidden whitespace-normal break-words leading-[130%]"
      style={{
        fontSize: `${getCellFontSize(columnCount, rowCount, value)}px`,
        color: isFirstColumn
          ? "var(--background-text,#d5dcff)"
          : "var(--background-text,#CAD5E2)",
      }}
    >
      {value}
    </span>
  );
}

const CodeSlide05ComparisonTable = ({ data }: { data: Partial<SchemaType> }) => {
  const tableColumns = normalizeColumns(data.tableColumns);
  const rows = normalizeRows(data.rows, tableColumns.length);
  const headerFontSize = clamp(18 - Math.max(0, tableColumns.length - 4) * 1.2, 13, 18);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap" rel="stylesheet" />
      <div
        className="relative flex h-[720px] w-[1280px] flex-col overflow-hidden p-[53px]"
        style={{
          backgroundColor: "var(--background-color,#101B37)",
          fontFamily: "var(--body-font-family,Nunito Sans)",
        }}
      >

        <h2 className="text-[64px] font-medium" style={{ color: "var(--background-text,#ffffff)" }}>{data.title}</h2>

        <div
          className="mt-[22px] min-h-0 flex-1 overflow-hidden rounded-[16px] border"
          style={{
            backgroundColor: "var(--card-color,#0F172BCC)",
            borderColor: "var(--stroke,#1D293D80)",
          }}
        >
          <div
            role="table"
            aria-label={data.title || "Comparison table"}
            className="h-full w-full"
            style={{
              color: "var(--background-text,#8ea1da)",
              display: "grid",
              gridTemplateColumns: `repeat(${tableColumns.length}, minmax(0, 1fr))`,
              gridTemplateRows: `auto repeat(${rows.length}, minmax(0, 1fr))`,
              width: "100%",
              height: "100%",
            }}
          >
            {tableColumns.map((column, columnIndex) => (
              <div
                key={`${column}-${columnIndex}`}
                role="columnheader"
                className="min-w-0 overflow-hidden border-b border-r px-[28px] py-[16px] text-left font-normal leading-[120%]"
                style={{
                  color: "var(--background-text,#ffffff)",
                  borderColor: "var(--stroke,#1D293D80)",
                  borderRightWidth: columnIndex === tableColumns.length - 1 ? "0px" : undefined,
                  fontSize: `${headerFontSize}px`,
                }}
              >
                {column}
              </div>
            ))}
            {rows.flatMap((row, rowIndex) =>
              row.cells.map((cell, cellIndex) => (
                <div
                  key={`row-${rowIndex}-cell-${cellIndex}`}
                  role="cell"
                  className="flex min-h-0 min-w-0 items-center overflow-hidden border-b border-r px-[28px] py-[14px]"
                  style={{
                    borderColor: "var(--stroke,#1D293D80)",
                    borderRightWidth: cellIndex === tableColumns.length - 1 ? "0px" : undefined,
                    borderBottomWidth: rowIndex === rows.length - 1 ? "0px" : undefined,
                  }}
                >
                  {renderCell(cell, cellIndex === 0, tableColumns.length, rows.length)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CodeSlide05ComparisonTable;
