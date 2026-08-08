# Template V2 Slide Rendering and Editor Documentation

This document explains the Template V2 slide editor for a developer who is new
to the project. It covers what features exist, which files own each feature,
how rendering works, how editing works, and where to make changes safely.

The code lives mainly in:

- `components/slide-editor`
- `app/(presentation-generator)/custom-template/components/EachSlide`
- `lib/template-v2-json-to-html.ts`

## Mental Model

Template V2 is a JSON-driven slide system. A slide has a `ui` layout object.
That layout is edited in the browser with a Konva canvas and is also rendered
to HTML for preview/export flows.

There are two important rendering paths:

1. Editor rendering: `surface/TemplateV2KonvaSlide.tsx` renders editable Konva
   nodes through `surface/nodes.tsx`.
2. HTML rendering/export: `TemplateV2LayoutPreview.tsx` and
   `lib/template-v2-json-to-html.ts` render the same slide data outside the
   Konva editor.

The editor generally works like this:

1. A slide layout is loaded into `TemplateV2KonvaSlide`.
2. The slide is normalized and stored in local `uiDraft` state.
3. Konva nodes render components/elements from `uiDraft`.
4. Selection state decides which toolbar/editor is visible.
5. Toolbars produce partial element/component changes.
6. `commitUi()` writes the next layout to local state, undo history, and Redux.
7. Redux keeps the current slide `ui` in the presentation state.

## Important Terms

- Template V2 layout: The raw `ui` layout object for a slide. It can contain
  `components`, root `elements`, `background`, and asset/font metadata.
- Component: A top-level movable group. Components have `position`, `size`, and
  usually an `elements` array.
- Element: A renderable object. Examples are `text`, `text-list`, `image`,
  `rectangle`, `ellipse`, `line`, `container`, `flex`, `grid`, `table`, and
  `chart`.
- Root element: An element stored directly under slide `elements`, not inside a
  component. The editor treats root elements as a virtual component with
  `ROOT_ELEMENTS_COMPONENT_INDEX`.
- Selection: The active item in the editor. It can be a component, multiple
  components, or a nested element path.
- Element path: An array of indexes that points to a nested element inside an
  element tree. For example, `[2, 0, 1]` means component element 2, then child
  0, then child 1.
- Editor units: Template V2 editor geometry is stored in `1280 x 720` canvas
  pixels. Positions, sizes, padding, gaps, and border radius values are edited
  as pixels.
- Raw element: A permissive `Record<string, any>` representation of Template V2
  JSON used by the editor surface.
- Editor element: A typed `SlideElement` from `types.ts` used by
  element toolbars.

## Folder Map

| Folder | Purpose |
| --- | --- |
| `surface/` | Main editable canvas, Konva nodes, font loading, image loading/export assets. |
| `model/` | Geometry, selection, raw UI updates, conversions between raw Template V2 elements and typed toolbar elements. |
| `types.ts` | Plain TypeScript contract for Template V2 editor data. |
| `importing/` | Template V2 import/adaptation code. |
| `selection/` | Floating selection toolbar, transformer boxes, layer ordering, toolbar positioning. |
| `toolbar/` | Element toolbar router, shared toolbar helpers/icons, design variable toolbar. |
| `text/` | Rich text rendering helpers, Tiptap inline editor, text and bullet toolbars. |
| `tables/` | Table Konva renderer, table toolbar, inline cell editor, selected cell state. |
| `charts/` | Chart renderer, chart toolbar, chart editor content, chart data conversion. |
| `images/` | Image toolbar, crop/focus UI, icon search/replacement editor. |
| `shapes/` | Rectangle/ellipse toolbar and line toolbar. |
| `layout/` | Container/flex/grid/line selection toolbar controls and layout algorithms. |
| `clipboard/` | Copy/paste payload creation, parsing, browser clipboard integration. |
| `events/` | Custom browser event names and payload types used to connect editor UI to other app panels. |
| `state/` | Small shared state hooks/types for inline editing and table cell selection. |
| `utils/` | Small editor utilities, currently color helpers. |

## Main Data Flow

### Types and Import

Primary files:

- `types.ts`
- `importing/template-v2-import.ts`

`types.ts` defines the editor data contract for supported slide elements:

- `TextElement`
- `ImageElement`
- `TextListElement`
- `TableElement`
- `RectangleElement`
- `EllipseElement`
- `LineElement`
- `ChartElement`
- `FlexElement`
- `GridElement`
- `GroupElement`
- `Slide`
- `Deck`

The exported `SlideElement` union is what element toolbars edit.

`template-v2-import.ts` adapts generated Template V2 payloads into editor
deck/slide data. Backend validation owns the JSON contract; the frontend
adapter owns scaling, asset URL normalization, fallback elements, and legacy
shape compatibility. Important functions:

- `adaptTemplateV2ResponseToDeck()`: Converts a template response into a deck.
- `adaptGeneratedTemplateV2PresentationToDeck()`: Converts a generated
  presentation payload into deck slides.
- `extractTemplateV2Layouts()`: Reads layouts from different possible response
  shapes.
- `adaptTemplateV2LayoutToSlide()`: Converts one Template V2 layout into one
  typed slide.
- `normalizeTemplateV2Slide()`: Normalizes elements after import.
- `adaptTemplateV2ComponentToElement()`: Converts a merged component into a
  group-like element.
- `withEqualTemplateV2FlowChildSizes()`: Normalizes flex/grid child sizing.

When adding a new element type, start by updating `types.ts`, then make sure
`template-v2-import.ts` can adapt old/raw data into that shape.

### Editor Surface State

Primary file:

- `surface/TemplateV2KonvaSlide.tsx`

This is the main editable slide component. It owns:

- `uiDraft`: The current local Template V2 layout.
- `currentUiRef`: Ref copy of the latest `uiDraft` for event handlers.
- `selection`: Current selection.
- `nodeRefs`: Map from selection keys to Konva nodes.
- `undoStackRef` and `redoStackRef`: Undo/redo history.
- `inlineEdit`: Text/table inline edit state.
- `iconEditorSelection`: The icon currently being edited.
- `isUploadingImage`: Upload overlay state.

Important functions in `TemplateV2KonvaSlide.tsx`:

- `setRootNode()`: Saves the surface DOM node and registers it for toolbar
  position calculations.
- `setSelectionNodeRef()`: Registers Konva nodes by selection key.
- `activateSurface()`: Marks this slide surface as the active editor surface.
- `clearSurface()`: Clears active surface state for this slide.
- `clearEditorUiState()`: Clears selection, inline edit, table cell selection,
  chart/icon editor state, and optionally active surface.
- `commitUi()`: Central write function. Updates local state, pushes undo
  history, clears redo stack, and dispatches `updateSlideUi`.
- `undo()` and `redo()`: Move layouts between undo/redo stacks and call
  `commitUi(previous, false)`.
- `select()`: Applies normal, multi-select, and toggle selection behavior.
- `updateComponent()`: Updates one component in the raw UI.
- `updateElement()`: Updates one nested element in the raw UI.
- `handleComponentDragStart()`, `handleComponentDragMove()`,
  `handleComponentDragEnd()`: Drag one or multiple selected components.
- `deleteSelection()`: Deletes selected components or nested elements.
- `createClipboardPayload()`: Converts current selection into a clipboard
  payload.
- `pasteClipboardPayload()`: Inserts clipboard payload into current UI.
- `duplicateSelection()`: Copy/paste without using the system clipboard.
- `openInlineEditor()`: Opens rich text editor for text or text-list elements.
- `closeInlineEditor()`: Commits or discards inline text edits.
- `commitInlineTextRuns()`: Receives live rich text runs from Tiptap without
  pushing every keystroke to Redux.
- `applyToolbarElementChange()`: Merges typed toolbar edits back into the raw
  selected element.
- `applyLayoutElementChange()`: Applies container/flex/grid line toolbar edits.
- `ungroupSelectedComponent()`: Converts a component's children into standalone
  components/elements.
- `reorderSelectedComponentLayer()`: Bring forward/backward actions.
- `openImageUpload()` and `handleImageUploadChange()`: Replace image data.
- `openIconEditor()` and `handleIconChange()`: Replace SVG/icon data.
- `openChartEditor()`: Opens chart editor via custom events.
- `handleElementDoubleClick()`: Opens inline text/table/chart/icon/image edit
  flows depending on element type.

The render body creates:

- A fixed-size editor surface.
- A hidden image file input for image replacement.
- A Konva `Stage` with background layer and editable content layer.
- `MemoizedRawElementNode` for root elements.
- `MemoizedRawComponentNode` for components.
- `TemplateV2SelectionTransformers` for resize/transform handles.
- `TemplateV2SelectionToolbar` for component/layout actions.
- `ElementToolbar` for type-specific element editing.
- `TableInlineEditor` for selected table cells.
- `TemplateV2InlineEditor` for text editing.
- `IconsEditor` for icon replacement.

### Model Helpers

Primary files:

- `model/core.ts`
- `model/model.ts`
- `model/inserted-content.ts`
- `model/chart-model.ts`
- `model/render-style.ts`
- `model/element-model.ts`
- `model/design-variables.ts`
- `model/template-v2-ungroup.ts`

`model/model.ts` is now the compatibility barrel plus the tightly coupled
editor operations for selection, geometry, layout, and toolbar merging.
Smaller pure helper groups live beside it:

- `model/core.ts`: stage constants, raw Template V2 types, raw readers,
  clamps, id normalization, and editable-target checks.
- `model/inserted-content.ts`: conversion of inserted palette/block content
  into raw top-level components.
- `model/chart-model.ts`: raw chart to editor chart conversion and the reverse.
- `model/render-style.ts`: color, opacity, shadow, and border-radius helpers
  used by Konva rendering.

Important groups:

Raw UI updates:

- `updateComponentInUi()`
- `setComponentPositionsInUi()`
- `updateElementInUi()`
- `updateElementArray()`
- `deleteSelectionFromUi()`

Geometry and layout:

- `componentBox()`
- `elementBox()`
- `elementSize()`
- `absoluteBoxForSelection()`
- `absoluteInlineEditBox()`
- `absoluteElementLocalFrame()`
- `renderedLocalBoxForElementSelection()`
- `childrenBounds()`
- `layoutChildren()`
- `layoutContainerChildren()`
- `elementWithNormalizedLayoutChildren()`

Selection:

- `keyForSelection()`
- `keysForSelection()`
- `selectionFromKey()`
- `selectionWithComponentToggle()`
- `componentIndexesForSelection()`
- `selectionForComponentIndexes()`
- `selectionTouchesComponent()`
- `selectionTouchesElement()`

Clipboard helpers:

- `componentForClipboardSelection()`
- `rootElementClipboardComponent()`

Inserted content conversion:

- `appendInsertedContent()`
- `insertedComponentToRaw()`
- `insertedElementToComponent()`
- `rawElementFromInsertedElement()`
- `convertInsertedChildArrays()`
- `normalizeInsertedElementGeometry()`
- `normalizeInsertedTextCollections()`
- `normalizeInsertedTableRows()`

These functions are implemented in `model/inserted-content.ts` and re-exported
from `model/model.ts` for existing imports.

Toolbar conversion:

- `rawElementForEditorToolbar()`: Converts raw selected element into typed
  `SlideElement` for `ElementToolbar`.
- `mergeEditorToolbarElement()`: Merges toolbar result back into raw element.
- `rawStrokeForEditor()` and `editorStrokeToRaw()`
- `rawBorderRadiusForEditor()` and `editorBorderRadiusToRaw()`
- `rawChartToEditorChart()` and `editorChartToRawChart()` from
  `model/chart-model.ts`

Rendering primitives:

- `lineRenderBox()`, `linePointsForElement()`, `lineStrokeWidth()`
- `fillColor()`, `fillOpacity()`
- `strokeColor()`, `strokeWidth()`, `strokeOpacity()`
- `colorWithOpacity()`
- `shadowProps()`
- `borderRadius()`
- `readPadding()`

Style helpers live in `model/render-style.ts`; raw readers such as
`readPadding()` live in `model/core.ts`.

`model/element-model.ts` contains typed helper functions used by toolbars:

- `elementBox()`
- `resizeElement()`
- `moveElement()`
- `elementFont()`
- `applyTextElementSelectionFont()`
- `tableRowsAsStrings()`

`model/design-variables.ts` implements design-variable option selection:

- `applyDesignVariableOption()`
- `selectedDesignVariableOptionIndex()`
- `designVariableNameLabel()`

`model/template-v2-ungroup.ts` owns component ungrouping:

- `ungroupTemplateV2ComponentInUi()`

## Rendering Features

### Konva Editor Renderer

Primary file:

- `surface/nodes.tsx`

Important functions/components:

- `RawComponentNode()`: Renders one top-level component as a Konva `Group`.
  Handles component selection, drag callbacks, multi-select participation, and
  nested element rendering.
- `RawElementNode()`: Renders one element inside a component or root element
  tree. It handles element selection, double-click behavior, table cell
  callbacks, and nested child rendering.
- `SelectionBoundsRect()`: Draws selection boundaries for selected nodes.
- `RawElementVisual()`: Switches by `element.type` and returns the correct
  visual renderer.
- `RawRichTextElement()`: Renders `text` and `text-list` using Konva text token
  layout.
- `RawImageElement()`: Loads and renders images, icon masks, fit modes, crop
  focus, flip, and border radius clipping.
- `useLoadedKonvaImage()`: Async image loader hook.
- `imageCornerRadii()` and `drawRoundedImageClip()`: Rounded image clipping.
- `RawInfographicElement()`: Renders infographic-style elements.

Supported visual types in `RawElementVisual()`:

- `rectangle`
- `ellipse`
- `container`
- `flex`
- `grid`
- `group`
- `line`
- `text`
- `text-list`
- `image`
- `table`
- `chart`
- `infographic`

Rendering rules:

- The outer group in `RawElementNode` applies position, size, rotation, opacity,
  and clipping.
- Shapes use `fillColor`, `fillOpacity`, `strokeColor`, `strokeOpacity`,
  `strokeWidth`, `shadowProps`, and `borderRadius` helpers.
- Lines use signed size deltas via `lineRenderBox()` and
  `linePointsForElement()`, stroke color/width/opacity, optional `stroke.dash`,
  shadow, and hit stroke width for easier selection.
- Text uses text layout helpers from `text/template-v2-text.ts`.
- Images load through `loadKonvaImage()` and are clipped manually for rounded
  corners.
- Charts are delegated to `charts/TemplateV2ChartJsElement.tsx`, which renders
  Chart.js output into the Konva scene as an image-backed element.
- Tables are delegated to `tables/TemplateV2TableElement.tsx`.

### HTML Preview Renderer

Primary file:

- `app/(presentation-generator)/custom-template/components/EachSlide/TemplateV2LayoutPreview.tsx`

This renderer is used outside the Konva editor. It renders Template V2 layout
data as normal React DOM. Key functions:

- `renderImage()`: Renders image DOM with `objectFit`, `objectPosition`, flip,
  border radius, and icon mask color.
- `renderText()`: Renders text runs into spans.
- `renderTextList()`: Renders bullet/number lists.
- `renderTable()`: Renders table DOM.
- `renderContainer()`
- `renderFlex()`
- `renderGrid()`
- `renderGroup()`
- `renderChart()`
- `frameStyle()`
- `boxStyle()`
- `fontStyle()`

This path is useful for slide thumbnails or non-editable previews. If a visual
feature is added to the Konva renderer, check this file too.

### HTML Export Renderer

Primary file:

- `lib/template-v2-json-to-html.ts`

This produces HTML strings from Template V2 JSON. Important functions:

- `renderItem()`: Main switch by element type.
- `renderImage()`
- `renderText()`
- `renderTextList()`
- `renderTable()`
- `renderContainer()`
- `renderFlex()`
- `renderGrid()`
- `renderGroup()`
- `renderLine()`
- `renderChart()`
- `frameStyle()`
- `boxStyle()`
- `fontStyle()`
- `imageFocusStyle()`
- `chartConfig()`

Any feature that should survive export must be represented here. For example,
line dash support is already handled in `renderLine()` through
`stroke-dasharray`.

## Editor Feature Map

| Feature | Rendering owner | Editor owner | Model/helpers | Notes |
| --- | --- | --- | --- | --- |
| Slide surface and background | `TemplateV2KonvaSlide`, `backgroundColor()` | `TemplateV2KonvaSlide` | `model/render-style.ts`, `model/core.ts` | Surface is fixed `1280 x 720`. |
| Components | `RawComponentNode()` | Selection toolbar, drag handlers | `componentBox()`, `updateComponentInUi()` | Top-level movable groups. |
| Root elements | `MemoizedRawElementNode` in surface | `ElementToolbar` | `rootElementsComponent()` | Treated as virtual component index `-1`. |
| Selection | `SelectionBoundsRect`, transformers | `select()`, `SelectionToolbar` | `keyForSelection()`, `selectionWithComponentToggle()` | Supports component, multi-component, and element selections. |
| Resize/transform | `SelectionTransformers.tsx` | Konva Transformer callbacks | `resizeComponent()`, `positionFromNodeInParent()` | Updates raw geometry after transform. |
| Dragging | `RawComponentNode()` | `handleComponentDragStart/Move/End()` | `setComponentPositionsInUi()` | Multi-component drag updates all selected positions together. |
| Undo/redo | N/A | `commitUi()`, `undo()`, `redo()` | `MAX_HISTORY_ENTRIES` | Only `commitUi(..., true)` pushes history. |
| Copy/paste | N/A | `useTemplateV2Clipboard()` | `clipboard/clipboard.ts` | Supports custom MIME, plain text prefix, localStorage fallback. |
| Duplicate | N/A | `duplicateSelection()` | Clipboard payload helpers | Duplicate is local copy/paste. |
| Layer ordering | Render order in component array | `reorderSelectedComponentLayer()` | `selection/layering.ts` | Reorders component array. |
| Ungroup | Component/element rendering | Selection toolbar | `template-v2-ungroup.ts` | Converts grouped content to independent components/elements. |
| Insert elements | Rendered by normal renderer | Custom insert event listener | `insert/insert-elements.ts`, `model/inserted-content.ts` | Usually triggered from `PresentationActions`. |
| Text rendering | `RawRichTextElement()` | `TextToolbar`, inline editor | `template-v2-text.ts` | Uses text runs and custom layout. |
| Rich text editing | `TiptapInlineTextEditor` overlay | `TemplateV2InlineEditor` | `text-runs.ts` | Live runs are buffered to avoid typing lag. |
| Bullet/list editing | `RawRichTextElement()` with list runs | `BulletsToolbar` | `template-v2-text.ts`, `markdown-text.ts` | List markers only apply to `text-list`. |
| Images | `RawImageElement()` | `ImageToolbar`, upload flow | `loadKonvaImage()`, image helpers | Supports fit, crop focus, flip, opacity, radius. |
| Icon replacement | `RawImageElement()` with SVG URL/color | `IconsEditor` | `isRawIconElement()`, `rawIconQuery()` | Icons are image-like elements with `is_icon`. |
| Shapes | `RawElementVisual()` | `ShapeToolbar` | `model/render-style.ts` | Rectangle and ellipse share toolbar. |
| Lines | `RawElementVisual()` line branch | `LineToolbar` | `lineRenderBox()`, `linePointsForElement()`, `stroke.dash` | Supports style, border panel, transform, shadow, opacity. |
| Containers | `RawElementVisual()` and child rendering | `ContainerToolbarControls` | `layoutContainerChildren()` | Container has fill/stroke/radius/padding/shadow/alignment. |
| Flex layout | `layoutFlowChildren()` | `LayoutToolbar` flow controls | `flowLayout.ts`, `layoutResize.ts` | Calculates child boxes from direction, gap, grow/shrink. |
| Grid layout | `layoutFlowChildren()` | `LayoutToolbar` flow controls | `placeGridChildren()`, `layoutResize.ts` | Calculates grid cells, spans, and alignment. |
| Layout add/remove items | Layout render path | `ItemsControl` | `layoutItems.ts`, `layoutResize.ts` | Supports `children` and `elements` child arrays. |
| Tables | `TemplateV2TableElement` | `TableToolbar`, `TableInlineEditor` | `useTableCellSelection()` | Cell editing uses text toolbar plus Tiptap editor. |
| Charts | `TemplateV2ChartJsElement` | `ChartToolbar`, chart editor event | `chart-data.ts` | Chart editor is opened by event and updates selected chart. |
| Design variables | Normal element render | `DesignVariablesToolbar` | `design-variables.ts` | Overrides element properties from predefined options. |
| Fonts | Text/table/chart renderers | Text toolbar font picker | `google-fonts.ts`, `fontLoading.ts` | Surface waits for fonts before enabling layer. |

## Detailed Feature Explanations

### Selection and Toolbars

Primary files:

- `selection/SelectionToolbar.tsx`
- `selection/SelectionTransformers.tsx`
- `selection/toolbarTarget.ts`
- `selection/toolbarPosition.ts`
- `toolbar/ElementToolbar.tsx`
- `layout/LayoutToolbar.tsx`

There are two toolbar systems:

1. Selection/layout toolbar: `TemplateV2SelectionToolbar` renders
   `TemplateV2LayoutToolbar`. It handles component actions and layout-specific
   controls for container/flex/grid/component selections.
2. Element toolbar: `ElementToolbar` routes selected element types to
   `TextToolbar`, `BulletsToolbar`, `ImageToolbar`, `ShapeToolbar`,
   `LineToolbar`, `ChartToolbar`, or `TableToolbar`.

`toolbarTarget.ts` decides when a layout toolbar target exists. It currently
targets layout elements such as container/flex/grid. Line elements are handled
by `ElementToolbar` so the editor does not show duplicate line toolbars.

`toolbarPosition.ts` calculates the floating toolbar anchor and viewport
position. It considers the selected box, toolbar width, surface bounds, and
whether the toolbar can fit above or below the selection.

`SelectionTransformers.tsx` renders Konva Transformer handles for resizing and
transforming selected items. It relies on `nodeRefs` registered by rendered
nodes in `surface/nodes.tsx`.

### Component Selection, Multi-select, Dragging, Resize

Selection data lives in `TemplateV2KonvaSlide.tsx` and uses types from
`model/model.ts`.

Single component selection:

1. User clicks a component group in `RawComponentNode`.
2. `onSelect()` calls `select()` in the surface.
3. `selection` becomes `{ kind: "component", componentIndex }`.
4. Toolbar and transformer use the selected component's box.

Multi-select:

1. `selectionWithComponentToggle()` handles modifier keys.
2. Selected component indexes become `{ kind: "multi-component", componentIndexes }`.
3. `keysForSelection()` returns all selected keys.
4. Transformer/selection UI treats them as a group.

Dragging:

1. `RawComponentNode` starts a Konva drag.
2. `handleComponentDragStart()` records model and node positions.
3. `handleComponentDragMove()` updates sibling selected nodes visually during
   a multi-component drag.
4. `handleComponentDragEnd()` commits final model positions with
   `setComponentPositionsInUi()`.

Resize:

1. Transformer changes node size/scale.
2. Resize helpers convert Konva geometry back to raw Template V2 position/size.
3. `commitUi()` persists the new state.

### Undo and Redo

Primary owner:

- `TemplateV2KonvaSlide.tsx`

`commitUi(nextUi, pushHistory = true)` is the only function that should write
new slide UI state. If `pushHistory` is true, it pushes the current layout onto
`undoStackRef` and clears `redoStackRef`.

Undo:

1. `undo()` pops from `undoStackRef`.
2. Current layout is pushed to `redoStackRef`.
3. Previous layout is committed with `pushHistory = false`.

Redo:

1. `redo()` pops from `redoStackRef`.
2. Current layout is pushed to `undoStackRef`.
3. Next layout is committed with `pushHistory = false`.

Keyboard handling listens for Cmd/Ctrl+Z and Cmd/Ctrl+Y only on the active
surface. Editable inputs are ignored through `isEditableTarget()`.

### Copy, Paste, Duplicate

Primary files:

- `clipboard/clipboard.ts`
- `clipboard/useClipboard.ts`
- `TemplateV2KonvaSlide.tsx`

`clipboard/clipboard.ts` handles pure data operations:

- `createTemplateV2ClipboardPayload()`: Creates payload from selected
  component(s) or root element converted into a component-like payload.
- `pasteTemplateV2ClipboardPayload()`: Inserts copied components with an offset,
  unique ids, and a new selection.

`useClipboard.ts` handles browser integration:

- Uses custom MIME: `application/x-presenton-template-v2`.
- Also writes plain text with prefix `PRESENTON_TEMPLATE_V2:`.
- Stores fallback in `localStorage`.
- Handles browser paste events and keyboard shortcut fallback.

Duplicate uses the same data path as copy/paste, but it does not require the
system clipboard.

### Custom Events

Primary file:

- `events/events.ts`

Events connect editor surfaces to app UI that is not directly nested under the
surface.

Event constants:

- `TEMPLATE_V2_INSERT_ELEMENTS_EVENT`: Add blocks/components/elements to active
  slide.
- `TEMPLATE_V2_SURFACE_SELECTED_EVENT`: Notify other UI which slide surface is
  active and what selection/history state exists.
- `TEMPLATE_V2_ACTIVATE_SURFACE_EVENT`: Programmatically activate one slide
  surface.

Why events are used:

- Toolbar/actions may live outside the slide surface React subtree.
- Multiple slide surfaces can exist in the page.
- The active surface needs to receive insert commands without prop drilling
  through the whole app.

When adding a new external editor panel, define a typed event payload in
`events.ts`, listen in `TemplateV2KonvaSlide.tsx`, and include a `slideId` or
active-surface guard so the wrong slide does not handle the event.

### Text and Rich Text

Primary files:

- `text/template-v2-text.ts`
- `text/text-runs.ts`
- `text/text-line-height.ts`
- `text/TextToolbar.tsx`
- `text/BulletsToolbar.tsx`
- `text/TemplateV2InlineEditor.tsx`
- `text/TiptapInlineTextEditor.tsx`
- `text/markdown-text.ts`

Rendering:

- Raw text data is normalized by helpers in `template-v2-text.ts`.
- `RawRichTextElement()` in `surface/nodes.tsx` calls these helpers to convert
  text runs into render tokens.
- Text rendering supports mixed runs, alignment, vertical alignment, line
  height, wrapping, bold, italic, underline, color, letter spacing, and list
  markers.

Important text helpers:

- `rawFont()`: Reads raw element font into a normalized render font.
- `rawTextContent()`: Reads plain text content.
- `rawTextRunsForEditor()`: Converts raw text to editor runs.
- `rawTextListRunsForEditor()`: Converts raw text-list to editor runs.
- `rawRenderTextRuns()`: Converts raw text into render runs.
- `rawTextListRenderTextRuns()`: Converts text-list items into render runs.
- `layoutRichText()`: Main rich text token layout function.
- `layoutRenderTextRuns()`: Breaks render runs into lines.
- `normalizeRawTextMarkdownElement()`: Removes markdown/list syntax where it
  should not be persisted.

Inline editing:

1. Double-click a text or text-list element.
2. `openInlineEditor()` creates an inline edit state with current runs/style.
3. `TemplateV2InlineEditor` positions a DOM/Tiptap editor over the Konva text.
4. `TiptapInlineTextEditor` converts runs to Tiptap JSON.
5. On input, runs are scheduled via `requestAnimationFrame` and emitted without
   committing Redux on every keystroke.
6. On close, `closeInlineEditor()` commits final runs to the raw element.

Toolbar editing:

- `TextToolbar` edits font family, size, styles, color, alignment, opacity,
  letter spacing, line height, and list settings if present.
- `BulletsToolbar` wraps `TextToolbar` behavior for `text-list` elements and
  marker settings.

Important performance detail:

- `commitInlineTextRuns()` only updates inline state while typing. The slide UI
  is committed on close. This avoids typing lag caused by rerendering the whole
  slide/Redux store on every keystroke.

### Images and Crop

Primary files:

- `images/ImageToolbar.tsx`
- `surface/nodes.tsx`
- `surface/exportAssets.ts`
- `utils/api.ts` for asset URL resolution outside this folder

Rendering:

- `RawImageElement()` loads images with `useLoadedKonvaImage()`.
- It supports `fit` values:
  - `cover` shown as "Fill" in the toolbar.
  - `contain`.
  - `fill` shown as "Stretch".
- It supports crop focus through `focus_x` and `focus_y`, with optional
  crop zoom through `crop_scale`.
- It supports `flip_h`, `flip_v`, `opacity`, `border_radius`, and icon color
  masking.

Crop model:

- The persisted crop data is not a pixel crop rectangle.
- It is `fit: "cover"` plus `focus_x`, `focus_y`, and optional `crop_scale`.
- The toolbar shows a Canva-style fixed crop window with a draggable/scalable
  image box outside it. It commits the final focus and zoom when the user
  applies or releases the crop interaction.

`ImageToolbar.tsx` owns:

- Fit dropdown.
- Replace image action.
- Crop window and source image scaling overlay.
- Horizontal/vertical flip.
- Opacity.
- Border radius.

Important functions:

- `cropActionsPosition()`: Keeps crop actions inside the canvas and below
  the main image toolbar.
- `normalizeCropDraft()`: Clamps focus to `0..100` and crop scale to bounds.
- `commitCrop()`: Writes `fit: "cover"`, `focus_x`, `focus_y`, and
  `crop_scale`.
- `CropOverlay()`: Shows the fixed crop window, outside shade, draggable image,
  and resize handles.
- `CropActions()`: Shows reset/apply/close.

Image replacement:

- `openImageUpload()` triggers a hidden file input.
- `handleImageUploadChange()` uploads using `ImagesApi.uploadImage()`.
- The returned asset path is normalized with `resolveBackendAssetSource()`.
- Selected image element gets new `data`.

### Icons

Primary files:

- `images/IconsEditor.tsx`
- `surface/nodes.tsx`
- `model/model.ts`
- `lib/svg-color.ts`

Icons are image-like elements, usually SVG assets with `is_icon` or static SVG
source paths.

Rendering:

- `RawImageElement()` detects static SVG icon sources.
- If the icon has a `color`, it builds an updated SVG URL with
  `buildSvgUpdateUrl()`.

Editing:

- Double-click an icon-like image opens `IconsEditor`.
- `IconsEditor` searches icons with `PresentationGenerationApi.searchIcons()`.
- It can change icon weight by rewriting the icon URL path.
- It can optionally apply icon styles across the presentation.
- When an icon is chosen, `handleIconChange()` writes the new `data` URL.

Important helpers:

- `isRawIconElement()`
- `isStaticSvgIconSource()`
- `rawIconQuery()`

### Shapes: Rectangle and Ellipse

Primary files:

- `shapes/ShapeToolbar.tsx`
- `surface/nodes.tsx`
- `model/render-style.ts`

Rendering:

- `RawElementVisual()` handles `rectangle` and `ellipse`.
- Rectangles support fill, stroke, border radius, shadow, rotation, and opacity.
- Ellipses support fill, stroke, shadow, rotation, and opacity.

Toolbar:

- `ShapeToolbar` edits:
  - Fill color and opacity.
  - Border color, width, and opacity.
  - Shape type rectangle/ellipse.
  - Position and size.
  - Rectangle border radius.
  - Drop shadow toggle and settings.
  - Shape opacity.

Shadow data:

```ts
{
  color: "#000000",
  blur: number,
  opacity: number,
  offset_x: number,
  offset_y: number
}
```

Rendering uses `shadowProps()` in `model/render-style.ts`.

### Lines

Primary files:

- `shapes/LineToolbar.tsx`
- `layout/LineToolbarControls.tsx`
- `surface/nodes.tsx`
- `lib/template-v2-json-to-html.ts`

Rendering:

- Konva line rendering is in the `type === "line"` branch of
  `RawElementVisual()`.
- The frame and points preserve Template V2/PPTX line semantics: `position` is
  the line start point and signed `size` values are endpoint deltas.
- Stroke color, width, opacity, shadow, and `stroke.dash` are applied.
- Export HTML uses `renderLine()` and maps `stroke.dash` to
  `stroke-dasharray`.

Toolbar:

- `LineToolbar` is the main selected-line toolbar.
- It supports:
  - Style dropdown: solid, dashed, dotted.
  - Border panel: color, width, opacity.
  - Color quick control.
  - Transform panel: x, y, width, height, rotation.
  - Shadow panel.
  - Line opacity.

`layout/LineToolbarControls.tsx` is a compact version used when a line is
inside a layout/component toolbar context. The selected line itself should use
`shapes/LineToolbar.tsx` through `ElementToolbar`.

### Containers

Primary files:

- `layout/ContainerToolbarControls.tsx`
- `layout/LayoutToolbar.tsx`
- `surface/nodes.tsx`
- `model/model.ts`

Containers are visual boxes with optional child content. They can have fill,
stroke, radius, padding, shadow, and alignment. Children are positioned by
`layoutContainerChildren()` in `model/model.ts`.

Toolbar:

- Fill.
- Stroke.
- Border radius.
- Padding.
- Shadow.
- Child alignment matrix.

Rendering:

- Container background/border is rendered first.
- Child content is rendered inside the container.
- `shouldClipElementChildren()` decides whether children are clipped by parent
  bounds.

### Flex and Grid Layout

Primary files:

- `layout/flowLayout.ts`
- `layout/wrappedFlexLayout.ts`
- `layout/layoutResize.ts`
- `layout/layoutItems.ts`
- `layout/LayoutToolbar.tsx`
- `layout/layoutToolbarTarget.ts`
- `surface/nodes.tsx`

Rendering:

- `layoutChildren()` in `model/model.ts` delegates to `layoutFlowChildren()`
  for `flex`, `grid`, `list-view`, and `grid-view`.
- `layoutFlowChildren()` chooses flex or grid through `flowLayoutKind()`.

Flex:

- `layoutFlexChildren()` reads direction, gap, padding, align, justify, grow,
  shrink, basis, and wrap.
- `flexBasis()` calculates each child's main-axis size.
- `childCrossSize()` calculates the cross-axis size.
- Alignment offsets place children inside the parent content box.

Grid:

- `layoutGridChildren()` reads columns, rows, gaps, padding, align, justify.
- `placeGridChildren()` assigns each child to a grid cell and handles spans.
- Child boxes are calculated from grid cell dimensions.

Editing:

- `LayoutToolbar` displays gap and items controls for flex/grid.
- `layoutItems.ts` owns add/remove item changes:
  - `layoutItemStats()`
  - `addLayoutItemChanges()`
  - `removeLastLayoutItemChanges()`
- It supports both `children` and `elements` arrays.
- `layoutResize.ts` adjusts parent/component sizes when item counts change:
  - `updateComponentLayoutElement()`
  - `layoutElementWithAdjustedItemSpace()`
  - `adjustedFlexSize()`
  - `adjustedGridSize()`

When debugging layout, inspect child arrays first. Some generated layouts use
`children`, others use `elements`.

### Tables

Primary files:

- `tables/TemplateV2TableElement.tsx`
- `tables/TableToolbar.tsx`
- `tables/TableInlineEditor.tsx`
- `tables/useTableCellSelection.ts`
- `model/element-model.ts`

Rendering:

- `TemplateV2TableElement` renders table cells in Konva.
- Cell text is rendered using rich text layout helpers.
- `SelectedTableCellOutline` draws active cell outline.

Toolbar:

- `TableToolbar` edits table-level and selected-cell properties.
- `TableInlineEditor` opens a text editor over the selected cell.
- `useTableCellSelection()` tracks selected and editing cells.

Cell edit flow:

1. User selects or double-clicks a table cell.
2. Surface calls `selectTableCell()` or `editTableCell()`.
3. `TableInlineEditor` creates a text-element-like object for the cell.
4. `TextToolbar` edits the cell font/style.
5. `TiptapInlineTextEditor` edits the cell runs.
6. `updateCell()` writes the changed cell back to `columns` or `rows`.

CSV-like helpers:

- `tableDraftFromElement()`
- `tableRowsFromDraft()`

These are useful for converting table data to/from text-like drafts.

### Charts

Primary files:

- `charts/TemplateV2ChartJsElement.tsx`
- `charts/ChartToolbar.tsx`
- `charts/ChartEditorContent.tsx`
- `charts/chart-data.ts`
- `charts/ChartColorPalette.tsx`
- `events/events.ts`

Rendering:

- `TemplateV2ChartJsElement` renders Chart.js output to an offscreen canvas and
  places that canvas in the Konva scene.
- It supports chart variants such as bar, horizontal/stacked bar, line, area,
  pie/donut, scatter, bubble, radar, and polar area.
- It normalizes raw chart categories and series before rendering.

Data helpers:

- `chart-data.ts` handles chart type and series/data normalization.
- `rawChartToEditorChart()` in `model/chart-model.ts` converts raw chart elements to
  typed `ChartElement` for editing.
- `editorChartToRawChart()` converts edited chart data back to raw Template V2.

Editing:

- `ChartToolbar` provides chart type, edit-data, and color controls.
- The edit-data button and chart double-click open `ChartDataEditorPopover`
  directly from `TemplateV2KonvaSlide`.
- The popover edits chart type, data, colors, title, axes, and X/Y grids, then
  writes the saved chart back through the selected surface element.

### Design Variables

Primary files:

- `toolbar/DesignVariablesToolbar.tsx`
- `model/design-variables.ts`

Some elements define `design_variables`. If present, `ElementToolbar` shows
`DesignVariablesToolbar` instead of the normal type toolbar.

Flow:

1. Element has `design_variables`.
2. `ElementToolbar` detects the array.
3. `DesignVariablesToolbar` renders select controls.
4. User picks an option.
5. `applyDesignVariableOption()` applies the option to paths defined by the
   variable's effects.

This lets template authors expose controlled design choices without requiring
the user to edit every raw property.

### Font Loading

Primary files:

- `surface/fontLoading.ts`
- `text/google-fonts.ts`
- `text/TextToolbar.tsx`
- `importing/template-v2-import.ts`

Fonts can come from template assets or Google font options. The editor surface
uses `useFontLoadState()` to wait for fonts before enabling the main layer.
This reduces layout flicker and text measurement mismatches.

`TextToolbar` can load/select fonts from:

- Fonts already included in the template.
- Google font options defined in `google-fonts.ts`.

### Image, SVG, and Asset Loading

Primary files:

- `surface/exportAssets.ts`
- `surface/nodes.tsx`
- `utils/api.ts`
- `lib/svg-color.ts`

`loadKonvaImage()` loads image assets into `HTMLImageElement` instances for
Konva. `resolveBackendAssetSource()` and related helpers normalize backend
asset URLs for browser/runtime differences.

SVG icon recoloring uses `buildSvgUpdateUrl()` from `lib/svg-color.ts`.

## File and Function Mapping by Feature

### Rendering

| Feature | File | Functions/components |
| --- | --- | --- |
| Main editor surface | `surface/TemplateV2KonvaSlide.tsx` | `TemplateV2KonvaSlideComponent` |
| Konva component renderer | `surface/nodes.tsx` | `RawComponentNode` |
| Konva element renderer | `surface/nodes.tsx` | `RawElementNode`, `RawElementVisual` |
| Text rendering | `surface/nodes.tsx`, `text/template-v2-text.ts` | `RawRichTextElement`, `layoutRichText`, `rawRenderTextRuns` |
| Image rendering | `surface/nodes.tsx` | `RawImageElement`, `useLoadedKonvaImage`, `imageCornerRadii` |
| Table rendering | `tables/TemplateV2TableElement.tsx` | `TemplateV2TableElement`, `TableCellText` |
| Chart rendering | `charts/TemplateV2ChartJsElement.tsx` | `TemplateV2ChartJsElement`, Chart.js canvas renderer |
| Flex/grid layout | `layout/flowLayout.ts` | `layoutFlowChildren`, `layoutFlexChildren`, `layoutGridChildren` |
| HTML preview | `TemplateV2LayoutPreview.tsx` | `renderImage`, `renderText`, `renderFlex`, `renderGrid`, `renderChart` |
| HTML export | `lib/template-v2-json-to-html.ts` | `renderItem`, `renderImage`, `renderLine`, `renderChart`, `boxStyle` |

### Editing

| Feature | File | Functions/components |
| --- | --- | --- |
| Commit state/history | `surface/TemplateV2KonvaSlide.tsx` | `commitUi`, `undo`, `redo` |
| Selection | `surface/TemplateV2KonvaSlide.tsx`, `model/model.ts` | `select`, `keyForSelection`, `selectionWithComponentToggle` |
| Resize handles | `selection/SelectionTransformers.tsx` | `TemplateV2SelectionTransformers` |
| Floating selection toolbar | `selection/SelectionToolbar.tsx` | `TemplateV2SelectionToolbar` |
| Toolbar routing | `toolbar/ElementToolbar.tsx` | `ElementToolbar`, `TOOLBAR_RENDERERS` |
| Text toolbar | `text/TextToolbar.tsx` | `TextToolbar` |
| Bullet toolbar | `text/BulletsToolbar.tsx` | `BulletsToolbar` |
| Inline text editor | `text/TemplateV2InlineEditor.tsx`, `text/TiptapInlineTextEditor.tsx` | `TemplateV2InlineEditor`, `TiptapInlineTextEditor` |
| Image toolbar | `images/ImageToolbar.tsx` | `ImageToolbar`, `CropOverlay`, `CropControls` |
| Icon editor | `images/IconsEditor.tsx` | `IconsEditor` |
| Shape toolbar | `shapes/ShapeToolbar.tsx` | `ShapeToolbar` |
| Line toolbar | `shapes/LineToolbar.tsx` | `LineToolbar` |
| Container toolbar | `layout/ContainerToolbarControls.tsx` | `TemplateV2ContainerToolbarControls` |
| Flex/grid toolbar | `layout/LayoutToolbar.tsx` | `FlowControls`, `GapControl`, `ItemsControl` |
| Table toolbar | `tables/TableToolbar.tsx` | `TableToolbar` |
| Table cell editor | `tables/TableInlineEditor.tsx` | `TableInlineEditor` |
| Chart toolbar/editor | `charts/ChartToolbar.tsx`, `charts/ChartEditorContent.tsx` | `ChartToolbar`, `ChartEditorContent` |
| Clipboard | `clipboard/useClipboard.ts`, `clipboard/clipboard.ts` | `useTemplateV2Clipboard`, `createTemplateV2ClipboardPayload`, `pasteTemplateV2ClipboardPayload` |
| Insert/chart events | `events/events.ts`, `surface/TemplateV2KonvaSlide.tsx` | event constants, insert/chart event handlers |

## How to Add a New Element Type

Use this checklist when adding a new renderable element type.

1. Types
   - Add the TypeScript type in `types.ts`.
   - Add it to the `SlideElement` union.

2. Import/adaptation
   - Update `importing/template-v2-import.ts` so generated/raw payloads adapt
     into the new element type.
   - Normalize legacy aliases if the backend may emit multiple names.

3. Raw editor model
   - Add conversion logic in `rawElementForEditorToolbar()` if the toolbar needs
     typed data.
   - Add merge logic in `mergeEditorToolbarElement()` if the toolbar writes
     back to raw Template V2.
   - Add geometry helpers if the element has unusual sizing.

4. Konva rendering
   - Add a branch in `RawElementVisual()` in `surface/nodes.tsx`.
   - Reuse `fillColor`, `strokeColor`, `shadowProps`, `borderRadius`, and text
     helpers where possible.

5. Editor toolbar
   - Add or update a toolbar component.
   - Register it in `toolbar/ElementToolbar.tsx`.
   - Make sure toolbar panels have `data-template-v2-floating-toolbar` or
     `data-inline-edit-ignore` if they are portal/floating UI.

6. HTML preview/export
   - Add DOM rendering to `TemplateV2LayoutPreview.tsx`.
   - Add HTML string rendering to `lib/template-v2-json-to-html.ts`.

7. Clipboard/selection
   - Usually no changes are needed if the element is normal JSON.
   - If the element has external assets or ids, make sure duplicate/paste does
     not create collisions.

8. Verification
   - Run:
     - `./node_modules/.bin/tsc --noEmit --incremental false`
     - targeted `eslint` for changed files.
   - Manually test editor render, toolbar edit, undo/redo, copy/paste, preview,
     and export if affected.

## Common Debugging Guide

### Toolbar click closes selection or action does nothing

Likely cause:

- Floating UI is rendered outside the slide surface and is treated as an
  outside click.

Fix:

- Add `data-template-v2-floating-toolbar="true"` or
  `data-inline-edit-ignore="true"` to the floating panel/root.
- Check the document pointerdown handler in `TemplateV2KonvaSlide.tsx`.

### Editor shows two toolbars

Likely cause:

- The selected element is eligible for both `TemplateV2SelectionToolbar` and
  `ElementToolbar`.

Fix:

- Check `selection/toolbarTarget.ts`.
- Check `toolbar/ElementToolbar.tsx`.
- Make one toolbar system the owner for that element type.

### Drag snaps back

Likely cause:

- Konva node position and raw model position are out of sync.

Check:

- `handleComponentDragStart()`
- `handleComponentDragMove()`
- `handleComponentDragEnd()`
- `setComponentPositionsInUi()`

### Text typing is slow

Likely cause:

- Every keystroke is committing to Redux or rerendering the whole slide.

Check:

- `TiptapInlineTextEditor` should schedule run emission.
- `commitInlineTextRuns()` should update inline state, not commit full UI.
- Full commit should happen in `closeInlineEditor()`.

### Bullets appear on normal text

Likely cause:

- Markdown/list normalization is applying list markers to `text` instead of
  `text-list`.

Check:

- `normalizeRawTextMarkdownElement()`
- `normalizeMarkdownTextInUi()`
- `text/markdown-text.ts`

### Flex/grid controls do not update visible children

Likely cause:

- The layout uses `elements`, but code only edits `children`, or vice versa.

Check:

- `layout/layoutItems.ts`
- `layout/layoutResize.ts`
- `childArrayInfo()` helpers.

### Line style changes in toolbar but not canvas

Likely cause:

- Renderer is not reading `stroke.dash`.

Check:

- `surface/nodes.tsx` line branch.
- `lib/template-v2-json-to-html.ts` `renderLine()`.

### Preview/export differs from editor

Likely cause:

- Feature was added to Konva renderer only.

Check:

- `surface/nodes.tsx`
- `TemplateV2LayoutPreview.tsx`
- `lib/template-v2-json-to-html.ts`

### Undo/redo affects wrong slide or does nothing

Likely cause:

- Surface active state is wrong, or shortcut is captured by an input.

Check:

- `activateSurface()`
- `isSurfaceActive()`
- `TEMPLATE_V2_SURFACE_SELECTED_EVENT`
- undo/redo keydown handler in `TemplateV2KonvaSlide.tsx`

## Testing and Verification Commands

From `servers/nextjs`:

```bash
PATH=/home/badu/pinokio/bin/miniconda/bin:$PATH ./node_modules/.bin/tsc --noEmit --incremental false
```

Targeted lint examples:

```bash
PATH=/home/badu/pinokio/bin/miniconda/bin:$PATH ./node_modules/.bin/eslint components/slide-editor/surface components/slide-editor/model --max-warnings=0
PATH=/home/badu/pinokio/bin/miniconda/bin:$PATH ./node_modules/.bin/eslint components/slide-editor/text components/slide-editor/tables --max-warnings=0
PATH=/home/badu/pinokio/bin/miniconda/bin:$PATH ./node_modules/.bin/eslint components/slide-editor/images components/slide-editor/shapes components/slide-editor/charts --max-warnings=0
```

Manual smoke test checklist:

1. Select a component.
2. Drag it once and confirm it does not snap back.
3. Resize it and undo/redo.
4. Copy/paste a component and a multi-selection.
5. Edit text and confirm typing stays responsive.
6. Edit bullets and confirm list markers only affect text-list elements.
7. Replace/crop/flip an image.
8. Edit rectangle shadow and opacity.
9. Edit line style, border width/color/opacity, and shadow.
10. Add/remove flex/grid items.
11. Edit table cell text.
12. Open chart editor and apply chart changes.
13. Check non-edit preview/export for visual parity.

## Current Design Decisions

- `TemplateV2KonvaSlide.tsx` owns editing state because many features need to
  coordinate: selection, toolbars, inline editing, chart/image/icon editors,
  undo/redo, and Redux commits.
- Toolbars are split by feature folders so each element type owns its editor UI.
- `model/model.ts` stays as the compatibility entry point for existing imports,
  but pure helper groups are split into `core.ts`, `inserted-content.ts`,
  `chart-model.ts`, and `render-style.ts`.
- Text editing uses DOM/Tiptap instead of Konva text input because rich text
  editing needs selection, marks, keyboard behavior, and IME behavior that Konva
  does not provide.
- Image crop is stored as focus point percentages rather than a pixel crop rect
  because the renderer/export already support `object-position` semantics.
- Flex/grid layouts must support both `children` and `elements` because
  generated templates may contain either shape.
- Export parity matters. When a feature is visible in the editor, make sure the
  HTML preview/export path also understands it.
