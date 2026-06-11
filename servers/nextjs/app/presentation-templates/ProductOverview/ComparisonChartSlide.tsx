import * as z from "zod";

export const slideLayoutId = "comparison-status-table-slide";
export const slideLayoutName = "Comparison Status Table Slide";
export const slideLayoutDescription =
  "A slide with a title on top and a description below, and a content section containing a table with column headers and rows of check, cross and empty state content.";

const CellStatusSchema = z.enum(["check", "cross", "empty"]);
type CellStatus = z.infer<typeof CellStatusSchema>;

const DEFAULT_COLUMNS = ["HEADING 1", "HEADING 2", "HEADING 3", "HEADING 4"];
const DEFAULT_ROWS: Array<{ label: string; cells: CellStatus[] }> = [
  {
    label: "HEADING 1",
    cells: ["check", "cross", "check", "cross"],
  },
  {
    label: "HEADING 1",
    cells: ["check", "empty", "check", "empty"],
  },
  {
    label: "HEADING 2",
    cells: ["check", "check", "check", "check"],
  },
];
const DEFAULT_CHECK_ICON = {
  __icon_url__:
    "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
  __icon_query__: "check icon",
};
const DEFAULT_CROSS_ICON = {
  __icon_url__:
    "https://presenton-public.s3.ap-southeast-1.amazonaws.com/static/icons/placeholder.svg",
  __icon_query__: "cross icon",
};

const GeneralRowSchema = z.object({
  label: z.string().max(18).meta({
    description: "Row heading shown in the first column.",
  }),
  cells: z.array(CellStatusSchema).min(1).max(8).meta({
    description: "Status cells aligned with the table columns.",
  }),
});

const LegacyRowSchema = z.object({
  label: z.string().max(18).meta({
    description: "Row heading shown in the first column.",
  }),
  cell1: CellStatusSchema.optional(),
  cell2: CellStatusSchema.optional(),
  cell3: CellStatusSchema.optional(),
  cell4: CellStatusSchema.optional(),
});

const RowSchema = z.union([GeneralRowSchema, LegacyRowSchema]);

export const Schema = z.object({
  title: z.string().min(6).max(42).default("Feature Comparison").meta({
    description: "Main heading shown above the table.",
  }),
  subtitle: z
    .string()
    .min(20)
    .max(120)
    .default(
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt."
    )
    .meta({
      description: "Short subtitle shown under the main heading.",
    }),
  columns: z
    .array(z.string().min(2).max(18).meta({
      description: "Column heading shown across the comparison table.",
    }))
    .min(2)
    .max(4)
    .default(DEFAULT_COLUMNS)
    .meta({
      description: "Table column headings.",
    }),
  highlightedColumnIndex: z.number().int().min(1).max(4).default(4).meta({
    description: "1-based column index for the dark highlighted table header.",
  }),
  rows: z
    .array(RowSchema)
    .min(1)
    .max(3)
    .default(DEFAULT_ROWS)
    .meta({
      description:
        "Table rows with status indicators. Prefer the `cells` array format.",
    }),
  checkIcon: z
    .object({
      __icon_url__: z.string().default(DEFAULT_CHECK_ICON.__icon_url__).meta({
        description: "URL for the optional check status icon.",
      }),
      __icon_query__: z.string().default(DEFAULT_CHECK_ICON.__icon_query__).meta({
        description: "Search query or alt text for the optional check icon.",
      }),
    })
    .default(DEFAULT_CHECK_ICON)
    .meta({
      description: "Icon used for positive comparison status.",
    }),
  crossIcon: z
    .object({
      __icon_url__: z.string().default(DEFAULT_CROSS_ICON.__icon_url__).meta({
        description: "URL for the optional cross status icon.",
      }),
      __icon_query__: z.string().default(DEFAULT_CROSS_ICON.__icon_query__).meta({
        description: "Search query or alt text for the optional cross icon.",
      }),
    })
    .default(DEFAULT_CROSS_ICON)
    .meta({
      description: "Icon used for negative comparison status.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

function StatusIcon({
  status,
}: {
  status: CellStatus | string;
}) {
  if (status === "empty") {
    return (
      <span
        aria-label="No value"
        className="block h-[4px] w-[28px] rounded-full"
        style={{ backgroundColor: "var(--stroke,#aab7b5)" }}
      />
    );
  }

  if (status === "cross") {
    return (
      <span
        aria-label="Not included"
        className="relative block h-[34px] w-[34px] rounded-full"
        style={{ backgroundColor: "var(--background-color,#DAE1DE)" }}
      >
        <span
          className="absolute left-[9px] top-[16px] h-[3px] w-[16px] rounded-full"
          style={{
            backgroundColor: "var(--primary-color,#15342D)",
            transform: "rotate(45deg)",
          }}
        />
        <span
          className="absolute left-[9px] top-[16px] h-[3px] w-[16px] rounded-full"
          style={{
            backgroundColor: "var(--primary-color,#15342D)",
            transform: "rotate(-45deg)",
          }}
        />
      </span>
    );
  }
  if (status === "check") {
    return (
      <span
        aria-label="Included"
        className="relative block h-[34px] w-[34px] rounded-full"
        style={{ backgroundColor: "var(--primary-color,#15342D)" }}
      >
        <span
          className="absolute h-[10px] w-[17px]"
          style={{
            borderBottom: "3px solid var(--primary-text,#edf2f1)",
            borderLeft: "3px solid var(--primary-text,#edf2f1)",
            left: "9px",
            top: "10px",
            transform: "rotate(-45deg)",
          }}
        />
      </span>
    );
  }
  return <p className="text-[16px] font-medium leading-none">{status}</p>;
}

const ComparisonChartSlide = ({ data }: { data: Partial<SchemaType> }) => {
  const {
    title,
    subtitle,
    columns,
    highlightedColumnIndex,
    rows,
  } = data;
  const safeTitle = title || "Feature Comparison";
  const titleFontSize =
    safeTitle.length > 34 ? 58 : safeTitle.length > 26 ? 64 : 72;
  const safeSubtitle =
    subtitle ||
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.";
  const incomingColumns = columns?.filter(Boolean).slice(0, 4) || [];
  const safeColumns =
    incomingColumns.length >= 2 ? incomingColumns : DEFAULT_COLUMNS;
  const resolvedHighlightedColumnIndex =
    highlightedColumnIndex &&
    highlightedColumnIndex >= 1 &&
    highlightedColumnIndex <= safeColumns.length
      ? highlightedColumnIndex
      : Math.min(4, safeColumns.length);
  const safeRows = rows && rows.length > 0 ? rows.slice(0, 3) : DEFAULT_ROWS;
  const gridTemplateColumns = `240px repeat(${safeColumns.length}, minmax(0, 1fr))`;
  const normalizedRows = safeRows.map((row) => {
    const rowCells =
      "cells" in row
        ? row.cells
        : [row.cell1, row.cell2, row.cell3, row.cell4].filter(
            (cell): cell is CellStatus => typeof cell !== "undefined"
          );

    return {
      label: row.label,
      cells: Array.from(
        { length: safeColumns.length },
        (_, cellIndex) => rowCells[cellIndex] ?? "empty"
      ),
    };
  });

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden"
        style={{
          backgroundColor: "var(--background-color,#DAE1DE)",
          fontFamily: "var(--body-font-family,'Bricolage Grotesque')",
        }}
      >
        <div className="px-[56px] pt-[46px]">
          <h2
            className="max-w-[1130px] break-words font-semibold leading-[1.02] text-[#15342D]"
            style={{
              color: "var(--primary-color,#15342D)",
              fontSize: `${titleFontSize}px`,
              letterSpacing: 0,
            }}
          >
            {safeTitle}
          </h2>
          <p
            className="mt-[14px] max-w-[830px] overflow-hidden text-[22px] font-normal leading-[1.26] text-[#15342DCC]"
            style={{
              color: "var(--background-text,#15342DCC)",
            }}
          >
            {safeSubtitle}
          </p>
        </div>

        <div
          className="mx-[56px] mt-[28px] overflow-hidden rounded-[22px] border"
          style={{
            backgroundColor: "var(--card-color,#ffffff)",
            borderColor: "var(--stroke,#c5cccb)",
          }}
        >
          <div
            className="grid border-b"
            style={{
              borderColor: "var(--stroke,#c5cccb)",
              gridTemplateColumns,
            }}
          >
            <div
              aria-hidden="true"
              className="h-[88px] border-r"
              style={{ borderColor: "var(--stroke,#c5cccb)" }}
            />
            {safeColumns.map((column, index) => {
              const isHighlighted = index + 1 === resolvedHighlightedColumnIndex;
              return (
                <div
                  key={`${column}-${index}`}
                  className="flex h-[88px] min-w-0 items-center justify-center border-r px-[18px] py-[18px] text-center text-[18px] font-semibold uppercase leading-[1.08] tracking-[0.08em] last:border-r-0"
                  style={{
                    backgroundColor: isHighlighted
                      ? "var(--primary-color,#15342D)"
                      : "var(--card-color,#ffffff)",
                    borderColor: "var(--stroke,#c5cccb)",
                    color: isHighlighted
                      ? "var(--primary-text,#edf2f1)"
                      : "var(--primary-color,#15342D)",
                    overflowWrap: "break-word",
                    wordBreak: "normal",
                  }}
                >
                  {column}
                </div>
              );
            })}
          </div>

          {normalizedRows.map((row, index) => {
            return (
              <div
                key={`${row.label}-${index}`}
                className="grid border-b last:border-b-0"
                style={{
                  borderColor: "var(--stroke,#c5cccb)",
                  gridTemplateColumns,
                }}
              >
                <div
                  className="flex h-[94px] min-w-0 items-center border-r px-[26px] py-[18px] text-left text-[18px] font-semibold uppercase leading-[1.12] tracking-[0.08em]"
                  style={{
                    backgroundColor: "var(--card-color,#ffffff)",
                    borderColor: "var(--stroke,#c5cccb)",
                    color: "var(--primary-color,#15342D)",
                    overflowWrap: "break-word",
                    wordBreak: "normal",
                  }}
                >
                  {row.label}
                </div>

                {row.cells.map((status, cellIndex) => (
                  <div
                    key={`${status}-${cellIndex}`}
                    className="flex h-[94px] items-center justify-center border-r p-[18px] last:border-r-0"
                    style={{
                      backgroundColor: "var(--card-color,#ffffff)",
                      borderColor: "var(--stroke,#c5cccb)",
                    }}
                  >
                    <StatusIcon status={status} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default ComparisonChartSlide;
