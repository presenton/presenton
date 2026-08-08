import type {
  DesignVariable,
  SlideElement,
} from "@/components/slide-editor/types";

type ElementWithChildren = Extract<SlideElement, { children: SlideElement[] }>;
type ElementWithChild = Extract<SlideElement, { child?: SlideElement | null }>;
type UnknownRecord = Record<string, unknown>;

export function applyDesignVariableOption<T extends SlideElement>(
  element: T,
  variable: DesignVariable,
  option: unknown,
): T {
  return variable.effect.reduce(
    (current, effect) =>
      setElementTargetValue(
        current,
        pathParts(effect.path),
        scaleValueForTarget(
          effect.path,
          evaluateDesignExpression(option, effect.effect),
        ),
      ) as T,
    element,
  );
}

export function selectedDesignVariableOptionIndex(
  element: SlideElement,
  variable: DesignVariable,
) {
  return variable.options.findIndex((option) =>
    variable.effect.every((effect) =>
      valuesEqual(
        getElementTargetValue(element, pathParts(effect.path)),
        scaleValueForTarget(
          effect.path,
          evaluateDesignExpression(option, effect.effect),
        ),
      ),
    ),
  );
}

export function designVariableNameLabel(name: string) {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function designVariableOptionLabel(option: unknown) {
  if (option == null) return "None";
  if (typeof option === "string" || typeof option === "number") {
    return String(option);
  }
  if (typeof option === "boolean") return option ? "On" : "Off";
  if (Array.isArray(option)) return `${option.length} values`;
  if (isRecord(option)) {
    return Object.entries(option)
      .slice(0, 3)
      .map(([key, value]) => `${designVariableNameLabel(key)} ${String(value)}`)
      .join(", ");
  }
  return String(option);
}

function evaluateDesignExpression(option: unknown, expression: string): unknown {
  const trimmed = expression.trim();
  if (trimmed === "$") return option;

  const rounded = trimmed.match(/^round\((.+)\)$/);
  if (rounded) {
    const value = evaluateDesignExpression(option, rounded[1]);
    return typeof value === "number" ? Math.round(value) : value;
  }

  const arithmetic = trimmed.match(/^(.+?)\s*([*/+-])\s*(-?\d+(?:\.\d+)?)$/);
  if (arithmetic) {
    const value = evaluateDesignExpression(option, arithmetic[1]);
    const operand = Number(arithmetic[3]);
    if (typeof value !== "number" || !Number.isFinite(operand)) return value;
    switch (arithmetic[2]) {
      case "*":
        return value * operand;
      case "/":
        return operand === 0 ? value : value / operand;
      case "+":
        return value + operand;
      case "-":
        return value - operand;
      default:
        return value;
    }
  }

  if (trimmed.startsWith("$.")) {
    return readObjectPath(option, trimmed.slice(2).split("."));
  }

  return option;
}

function setElementTargetValue(
  element: SlideElement,
  parts: string[],
  value: unknown,
): SlideElement {
  if (parts.length === 0) return element;
  const [head, ...rest] = parts;

  if ((head === "elements" || head === "children") && hasChildren(element)) {
    const childIndex = Number(rest[0]);
    if (!Number.isInteger(childIndex) || !element.children[childIndex]) {
      return element;
    }
    return {
      ...element,
      children: element.children.map((child, index) =>
        index === childIndex
          ? setElementTargetValue(child, rest.slice(1), value)
          : child,
      ),
    } as SlideElement;
  }

  if (head === "child" && hasChild(element) && element.child) {
    return {
      ...element,
      child: setElementTargetValue(element.child, rest, value),
    } as SlideElement;
  }

  if (hasChildren(element)) {
    const childIndex = element.children.findIndex((child) =>
      matchesElementSelector(child, head),
    );
    if (childIndex >= 0) {
      return {
        ...element,
        children: element.children.map((child, index) =>
          index === childIndex ? setElementTargetValue(child, rest, value) : child,
        ),
      } as SlideElement;
    }
  }

  return setObjectPath(element, parts, value) as SlideElement;
}

function getElementTargetValue(element: SlideElement, parts: string[]): unknown {
  if (parts.length === 0) return undefined;
  const [head, ...rest] = parts;

  if ((head === "elements" || head === "children") && hasChildren(element)) {
    const childIndex = Number(rest[0]);
    const child = Number.isInteger(childIndex)
      ? element.children[childIndex]
      : null;
    return child ? getElementTargetValue(child, rest.slice(1)) : undefined;
  }

  if (head === "child" && hasChild(element) && element.child) {
    return getElementTargetValue(element.child, rest);
  }

  if (hasChildren(element)) {
    const child = element.children.find((candidate) =>
      matchesElementSelector(candidate, head),
    );
    if (child) return getElementTargetValue(child, rest);
  }

  return readObjectPath(element, parts);
}

function setObjectPath(target: unknown, parts: string[], value: unknown): unknown {
  if (parts.length === 0) return value;
  const [head, ...rest] = parts;

  if (Array.isArray(target)) {
    const index = Number(head);
    if (!Number.isInteger(index) || index < 0 || index >= target.length) {
      return target;
    }
    return target.map((item, itemIndex) =>
      itemIndex === index ? setObjectPath(item, rest, value) : item,
    );
  }

  if (!isRecord(target)) return target;

  return {
    ...target,
    [head]: rest.length > 0 ? setObjectPath(target[head], rest, value) : value,
  };
}

function readObjectPath(target: unknown, parts: string[]): unknown {
  return parts.reduce<unknown>((current, part) => {
    if (Array.isArray(current)) {
      const index = Number(part);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    return isRecord(current) ? current[part] : undefined;
  }, target);
}

function matchesElementSelector(element: SlideElement, selector: string) {
  return (
    element.component_slot === selector ||
    element.component_id === selector ||
    element.type === selector
  );
}

function scaleValueForTarget(targetPath: string, value: unknown) {
  if (typeof value !== "number") return value;
  const parts = pathParts(targetPath);
  const leaf = parts.at(-1);
  const parent = parts.at(-2);

  if (parent === "font" && leaf === "size") return round(value);
  if (parent === "size" && leaf === "width") return round(value);
  if (parent === "size" && leaf === "height") return round(value);
  if (parent === "position" && leaf === "x") return round(value);
  if (parent === "position" && leaf === "y") return round(value);
  if (parent === "borderRadius" || parent === "border_radius") {
    return round(value);
  }
  if (leaf === "offsetX") return round(value);
  if (leaf === "offsetY") return round(value);
  if (leaf === "blur") return round(value);

  return value;
}

function valuesEqual(left: unknown, right: unknown) {
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 0.01;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasChildren(element: SlideElement): element is ElementWithChildren {
  return "children" in element && Array.isArray(element.children);
}

function hasChild(element: SlideElement): element is ElementWithChild {
  return "child" in element;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pathParts(path: string) {
  return path.split(".").map((part) => part.trim()).filter(Boolean);
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
