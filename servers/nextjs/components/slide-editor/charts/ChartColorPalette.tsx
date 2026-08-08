import type { CSSProperties } from "react";
import { Check, Plus, X } from "lucide-react";
import {
  CHART_SYSTEM_COLORS,
  normalizeChartColor,
} from "@/components/slide-editor/charts/chart-data";
import { DeferredColorInput } from "@/components/slide-editor/toolbar/DeferredColorInput";

type ChartColorPaletteCardProps = {
  className?: string;
  colors: string[];
  onAddColor?: () => void;
  onChange: (color: string) => void;
  onClose?: () => void;
  onSelectIndex: (index: number) => void;
  selectedIndex: number;
  style?: CSSProperties;
};

export function ChartColorPaletteCard({
  className,
  colors,
  onAddColor,
  onChange,
  onClose,
  onSelectIndex,
  selectedIndex,
  style,
}: ChartColorPaletteCardProps) {
  const themeColors =
    colors.length > 0
      ? colors.map((color) => normalizeChartColor(color))
      : ["7F22FE"];
  const activeIndex = Math.min(
    Math.max(0, selectedIndex),
    themeColors.length - 1,
  );
  const currentColor = themeColors[activeIndex];
  const commitColor = (color: string) => {
    onChange(normalizeChartColor(color));
  };

  return (
    <div
      className={className}
      data-inline-edit-ignore="true"
      style={{ ...styles.card, ...style }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div style={styles.header}>
        <div style={styles.headerText}>
          <div style={styles.title}>Chart colors</div>
        </div>
        {onClose ? (
          <button
            type="button"
            aria-label="Close color palette"
            style={styles.closeButton}
            onClick={onClose}
          >
            <X size={16} strokeWidth={2} />
          </button>
        ) : null}
      </div>

      <div style={styles.heading}>Theme</div>
      <div style={styles.themeGrid}>
        {themeColors.map((color, index) => (
          <ColorSwatch
            key={`${color}-${index}`}
            ariaLabel={`Select theme color ${index + 1}`}
            color={color}
            selected={index === activeIndex}
            onClick={() => onSelectIndex(index)}
          />
        ))}
        {onAddColor ? (
          <button
            type="button"
            aria-label="Add chart color"
            title="Add chart color"
            style={styles.addSwatch}
            onClick={onAddColor}
          >
            <Plus size={15} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>

      <div style={styles.divider} />

      <div style={styles.heading}>System colors</div>
      <div style={styles.systemGrid}>
        <label
          aria-label="Custom chart color"
          title="Custom color"
          style={{
            ...styles.swatch,
            ...styles.customSwatch,
          }}
        >
          <Plus size={16} strokeWidth={2} />
          <DeferredColorInput
            value={currentColor}
            onCommit={commitColor}
            style={styles.hiddenColorInput}
          />
        </label>
        {CHART_SYSTEM_COLORS.map((color) => (
          <ColorSwatch
            key={color}
            ariaLabel={`Set chart color #${color}`}
            color={color}
            selected={color === currentColor}
            onClick={() => commitColor(color)}
          />
        ))}
      </div>
    </div>
  );
}

function ColorSwatch({
  ariaLabel,
  color,
  selected,
  onClick,
}: {
  ariaLabel: string;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      style={{
        ...styles.swatch,
        background: `#${color}`,
        borderColor: color === "FFFFFF" ? "#E6E6EA" : "transparent",
        color: isLightColor(color) ? "#191919" : "#FFFFFF",
      }}
      onClick={onClick}
    >
      {selected ? <Check size={16} strokeWidth={2.5} /> : null}
    </button>
  );
}

function isLightColor(color: string) {
  const normalized = normalizeChartColor(color);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 170;
}

const styles = {
  card: {
    background: "#FFFFFF",
    border: "1px solid #E6E6EA",
    borderRadius: 10,
    boxShadow: "0 18px 44px rgba(16,19,35,0.18)",
    boxSizing: "border-box",
    color: "#191919",
    fontFamily:
      "var(--font-syne), var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: 14,
    width: 296,
  },
  addSwatch: {
    alignItems: "center",
    background: "#FFFFFF",
    border: "1px dashed #B8A3F8",
    borderRadius: 999,
    boxSizing: "border-box",
    color: "#7C51F8",
    cursor: "pointer",
    display: "inline-grid",
    height: 28,
    justifyContent: "center",
    padding: 0,
    width: 28,
  },
  closeButton: {
    alignItems: "center",
    background: "transparent",
    border: 0,
    borderRadius: 6,
    color: "#686873",
    cursor: "pointer",
    display: "inline-flex",
    height: 28,
    justifyContent: "center",
    padding: 0,
    width: 28,
  },
  customSwatch: {
    alignItems: "center",
    background:
      "conic-gradient(from 0deg, #FF3B3B, #FF7417, #FFC20A, #22C55E, #38BDF8, #5B5FF4, #EC4899, #FF3B3B)",
    color: "#191919",
    display: "grid",
    justifyItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  divider: {
    background: "#ECECF1",
    height: 1,
    margin: "14px 0",
    width: "100%",
  },
  heading: {
    fontSize: 12,
    fontWeight: 500,
    lineHeight: "16px",
    marginBottom: 10,
    color: "#686873",
  },
  header: {
    alignItems: "flex-start",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 14,
    minHeight: 32,
  },
  headerText: {
    minWidth: 0,
    paddingTop: 1,
  },
  hiddenColorInput: {
    cursor: "pointer",
    height: "100%",
    inset: 0,
    opacity: 0,
    position: "absolute",
    width: "100%",
  },
  swatch: {
    alignItems: "center",
    border: "1px solid transparent",
    borderRadius: 999,
    boxSizing: "border-box",
    cursor: "pointer",
    display: "inline-grid",
    height: 28,
    justifyContent: "center",
    padding: 0,
    width: 28,
  },
  systemGrid: {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(7, 28px)",
  },
  themeGrid: {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(7, 28px)",
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: "17px",
  },
} satisfies Record<string, CSSProperties>;
