// Семантическая валидация данных графиков: временные ряды (годы, даты,
// месяцы, кварталы) не должны рисоваться столбцами или кругами. Сервер
// коерсирует тип на границе схемы (pydantic Chart, template-fill); здесь
// страховка для старых деков и прямых правок редактора.

export const TEMPORAL_CHART_KIND = "line";

export const TEMPORAL_INCOMPATIBLE_CHART_KINDS = new Set([
  "bar",
  "horizontal_bar",
  "stacked_bar",
  "horizontal_stacked_bar",
  "pie",
  "donut",
  "polar_area",
  "radar",
]);

const MONTH_NAMES = new Set([
  // EN
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
  // RU (именительный и родительный падежи, сокращения)
  "январь", "февраль", "март", "апрель", "май", "июнь", "июль",
  "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
  "января", "февраля", "марта", "апреля", "июня", "июля",
  "августа", "сентября", "октября", "ноября", "декабря",
  "янв", "фев", "мар", "апр", "июн", "июл", "авг", "сен", "сент", "окт", "ноя", "нояб", "дек",
]);

const YEAR_RE = /^\d{4}\s*(?:г\.?|год|year)?$/i;
const ISO_DATE_RE = /^\d{4}-\d{1,2}(-\d{1,2})?$/;
const NUMERIC_DATE_RE = /^\d{1,2}[./]\d{1,2}([./]\d{2}|\d{4})?$/;
const QUARTER_RE = /^(?:q[1-4]|[1-4]\s*(?:кв(?:артал)?\.?|quarter))\s*(?:\d{4})?$/i;
const MONTH_YEAR_NUMERIC_RE = /^\d{1,2}\s*[-/]\s*\d{4}$/;
const HALF_YEAR_RE = /^(?:h[12]|полугодие\s*\d?)\s*(?:\d{4})?$/i;
const MONTH_DAY_RE = /^(?:\d{1,2}\s+(?:[а-яё]+|[a-z]+)|(?:[а-яё]+|[a-z]+)\s+\d{1,4})(?:\s+\d{2,4})?$/i;

export function isTemporalCategory(value: string): boolean {
  if (!value) return false;
  const text = value.trim().toLowerCase();
  if (!text || text.length > 32) return false;
  if (YEAR_RE.test(text)) return true;
  if (ISO_DATE_RE.test(text)) return true;
  if (NUMERIC_DATE_RE.test(text)) return true;
  if (QUARTER_RE.test(text)) return true;
  if (MONTH_YEAR_NUMERIC_RE.test(text)) return true;
  if (HALF_YEAR_RE.test(text)) return true;
  if (MONTH_NAMES.has(text)) return true;
  if (MONTH_DAY_RE.test(text)) {
    return text.split(/\s+/).some((part) => MONTH_NAMES.has(part));
  }
  return false;
}

export function isTemporalCategoryList(categories: unknown): boolean {
  if (!Array.isArray(categories)) return false;
  const values = categories
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (values.length < 3) return false;
  const temporal = values.filter((value) => isTemporalCategory(value)).length;
  return temporal >= 3 && temporal / values.length >= 0.6;
}

/** Исправленный kind, если категории временные, а текущий — нет; иначе null. */
export function coerceTemporalChartKind(
  kind: string | null | undefined,
  categories: unknown
): string | null {
  if (!kind || !TEMPORAL_INCOMPATIBLE_CHART_KINDS.has(kind)) return null;
  if (isTemporalCategoryList(categories)) return TEMPORAL_CHART_KIND;
  return null;
}
