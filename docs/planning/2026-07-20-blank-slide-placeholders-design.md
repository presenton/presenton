# Editable Blank-Slide Placeholders Design

**Issue:** #766
**Status:** Approved for implementation

## Goal

Make a newly created Template V2 blank slide feel like a Google Slides starter slide: users start with editable title and subtitle text boxes instead of an empty canvas. The AI Assistant can treat that text as an editable brief, rewriting it, expanding it, and applying an appropriate design to the same slide.

## Scope

### Included

- Add title and subtitle `text` elements to the Template V2 blank-slide factory.
- Preserve the white background and the existing blank-slide layout ID.
- Use the existing Template V2 editor model so placeholders are selectable, editable, movable, restylable, and deletable.
- Make the blank-slide AI instruction explicitly permit rewriting title/subtitle copy, expanding content, and applying a layout/design to the existing target slide.
- Add Node regression tests for the factory output and the AI instruction.

### Excluded

- Migrating existing slides.
- Changing the Legacy/V1 blank-slide renderer, which does not use the Template V2 editable text-element model.
- Adding a separate “completely empty” menu option; that is a later UX extension.
- Changing server-side generation contracts.

## Data model

`BLANK_TEMPLATE_V2_LAYOUT` will retain its white decorative background and add two normal `text` elements in its top-level `elements` list:

| Element | Text | Geometry | Style |
| --- | --- | --- | --- |
| Title | `Title` | x 120, y 180, 1040×100 | centered, 48px, bold, dark text |
| Subtitle | `Subtitle` | x 180, y 310, 920×64 | centered, 24px, regular, muted text |

The exact strings intentionally read as neutral editable starter copy. They are stored in both `text` and `runs` to match the existing Template V2 text contract.

## AI behavior

A prompt submitted from a blank-slide overlay continues to update the selected slide and must not add another slide. Its instruction additionally tells the assistant to:

1. treat the title/subtitle as a brief rather than immutable content;
2. improve or rewrite their wording when appropriate;
3. expand the brief into presentation-ready content; and
4. apply an appropriate visual design/layout to that same slide.

## Acceptance cases

| Case | Expected result |
| --- | --- |
| New Template V2 blank slide | Contains the white background plus editable `Title` and `Subtitle` text elements. |
| New Legacy/V1 blank slide | Remains unchanged and empty. |
| User edits title/subtitle | Existing Template V2 editor persists direct edits without custom code. |
| AI prompt from blank slide | Targets the existing slide, permits copy rewrite/content expansion/design application, and says not to add another slide. |
| Existing deck | Unchanged; only newly created V2 blank slides receive placeholders. |

## Test plan

1. Write a focused Node test that imports the shared blank-slide factory and expects the two editable text placeholders only for Template V2.
2. Run it while the factory is still empty and verify the expected assertion failure.
3. Implement the minimal factory change, rerun the focused test, and run the full Next.js test suite.
4. Extract the blank-slide AI instruction to a small pure shared helper, write a failing test for its rewrite/design semantics, then integrate it in `Chat.tsx`.
5. Run `npm test`, `npm run build`, `npm run lint`, and `git diff --check`.
