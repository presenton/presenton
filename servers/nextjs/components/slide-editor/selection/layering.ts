export type ComponentLayerAction =
  | "send-to-back"
  | "send-backward"
  | "bring-forward"
  | "bring-to-front";

type ComponentLayerShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export type ComponentLayerReorderResult<T> = {
  components: T[];
  componentIndex: number;
};

export function componentLayerActionForShortcut(
  event: ComponentLayerShortcutEvent,
): ComponentLayerAction | null {
  if (!event.altKey || event.metaKey || event.ctrlKey) return null;

  switch (normalizedLayerShortcutKey(event)) {
    case "k":
      return event.shiftKey ? "bring-to-front" : "bring-forward";
    case "j":
      return event.shiftKey ? "send-to-back" : "send-backward";
    default:
      return null;
  }
}

export function canApplyComponentLayerAction(
  componentIndex: number,
  componentCount: number,
  action: ComponentLayerAction,
) {
  if (
    componentCount <= 1 ||
    componentIndex < 0 ||
    componentIndex >= componentCount
  ) {
    return false;
  }

  if (action === "send-to-back" || action === "send-backward") {
    return componentIndex > 0;
  }

  return componentIndex < componentCount - 1;
}

export function reorderComponentLayer<T>(
  components: readonly T[],
  componentIndex: number,
  action: ComponentLayerAction,
): ComponentLayerReorderResult<T> | null {
  if (!canApplyComponentLayerAction(componentIndex, components.length, action)) {
    return null;
  }

  const targetIndex = targetLayerIndex(componentIndex, components.length, action);
  if (targetIndex === componentIndex) return null;

  return {
    components: moveArrayItem(components, componentIndex, targetIndex),
    componentIndex: targetIndex,
  };
}

function targetLayerIndex(
  componentIndex: number,
  componentCount: number,
  action: ComponentLayerAction,
) {
  switch (action) {
    case "send-to-back":
      return 0;
    case "send-backward":
      return componentIndex - 1;
    case "bring-forward":
      return componentIndex + 1;
    case "bring-to-front":
      return componentCount - 1;
  }
}

function moveArrayItem<T>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function normalizedLayerShortcutKey(event: ComponentLayerShortcutEvent) {
  if (event.code === "KeyK") return "k";
  if (event.code === "KeyJ") return "j";
  return event.key.toLowerCase();
}
