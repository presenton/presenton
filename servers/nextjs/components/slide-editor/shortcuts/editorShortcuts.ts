export type EditorShortcutKey =
  | "Mod"
  | "Shift"
  | "Alt"
  | "Click"
  | "Backspace"
  | "Delete"
  | "C"
  | "G"
  | "J"
  | "K"
  | "V"
  | "Y"
  | "Z"
  | "?";

export type EditorShortcut = {
  id:
    | "multi-select"
    | "group"
    | "delete"
    | "copy"
    | "paste"
    | "undo"
    | "redo"
    | "bring-forward"
    | "bring-to-front"
    | "send-backward"
    | "send-to-back"
    | "shortcut-help";
  label: string;
  description: string;
  chords: EditorShortcutKey[][];
};

export type EditorShortcutSection = {
  id: "selection" | "editing" | "arrange" | "help";
  title: string;
  description: string;
  shortcuts: EditorShortcut[];
};

export const EDITOR_SHORTCUT_SECTIONS: EditorShortcutSection[] = [
  {
    id: "selection",
    title: "Selection",
    description: "Select and organize objects on the active slide.",
    shortcuts: [
      {
        id: "multi-select",
        label: "Add to selection",
        description: "Hold Shift while clicking to add or remove an object.",
        chords: [["Shift", "Click"]],
      },
      {
        id: "group",
        label: "Group objects",
        description: "Combine two or more selected objects into one group.",
        chords: [["Mod", "G"]],
      },
      {
        id: "delete",
        label: "Delete selection",
        description: "Remove the selected object or objects from the slide.",
        chords: [["Backspace"], ["Delete"]],
      },
    ],
  },
  {
    id: "editing",
    title: "Editing",
    description: "Common editing commands for slide objects.",
    shortcuts: [
      {
        id: "undo",
        label: "Undo",
        description: "Undo the last change made on the active slide.",
        chords: [["Mod", "Z"]],
      },
      {
        id: "redo",
        label: "Redo",
        description: "Restore the most recently undone slide change.",
        chords: [["Mod", "Shift", "Z"], ["Mod", "Y"]],
      },
      {
        id: "copy",
        label: "Copy selection",
        description: "Copy the selected object or objects.",
        chords: [["Mod", "C"]],
      },
      {
        id: "paste",
        label: "Paste",
        description: "Paste copied objects with a small position offset.",
        chords: [["Mod", "V"]],
      },
    ],
  },
  {
    id: "arrange",
    title: "Arrange",
    description: "Change the selected object’s layer position.",
    shortcuts: [
      {
        id: "bring-forward",
        label: "Bring forward",
        description: "Move the selected object forward by one layer.",
        chords: [["Alt", "K"]],
      },
      {
        id: "bring-to-front",
        label: "Bring to front",
        description: "Move the selected object above every other object.",
        chords: [["Shift", "Alt", "K"]],
      },
      {
        id: "send-backward",
        label: "Send backward",
        description: "Move the selected object backward by one layer.",
        chords: [["Alt", "J"]],
      },
      {
        id: "send-to-back",
        label: "Send to back",
        description: "Move the selected object behind every other object.",
        chords: [["Shift", "Alt", "J"]],
      },
    ],
  },
  {
    id: "help",
    title: "Help",
    description: "Quickly return to this reference.",
    shortcuts: [
      {
        id: "shortcut-help",
        label: "Keyboard shortcuts",
        description: "Open this keyboard-shortcuts guide.",
        chords: [["?"]],
      },
    ],
  },
];

export function editorShortcutById(id: EditorShortcut["id"]) {
  return EDITOR_SHORTCUT_SECTIONS.flatMap(
    (section) => section.shortcuts,
  ).find((shortcut) => shortcut.id === id);
}

export function shortcutKeyLabel(
  key: EditorShortcutKey,
  applePlatform: boolean,
) {
  if (!applePlatform) {
    if (key === "Mod") return "Ctrl";
    return key;
  }

  switch (key) {
    case "Mod":
      return "⌘";
    case "Shift":
      return "⇧";
    case "Alt":
      return "⌥";
    case "Backspace":
      return "⌫";
    default:
      return key;
  }
}
