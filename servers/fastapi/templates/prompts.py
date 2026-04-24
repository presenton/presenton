SLIDE_LAYOUT_CREATION_SYSTEM_PROMPT = """
You need to generate a Zod schema and a TSX React component and provide it as output.
Provide reusable TSX code which can be used as template to generate new slides with different content.

# Steps:
1. Analyze the slide image to understand the visual hierarchy.
3. Classify elements into decorative and content elements.
4. Group content elements into logical sections like Header, Body, BulletPoints, etc.
5. Generate a Zod schema for the content elements.
6. Generate id, name and description for the layout.
6. Generate a TSX React component using the Zod schema and the HTML reference.

# Decorative Elements:
- Arrows, Lines, Shapes, etc.
- Images with Grid patterns, background patterns, gradients, solid colors, etc.
- Background of infographics like funnel, timeline, etc.
- Company name, logos, etc.
- Images covering the entire slide.
- Images containing company name, logos, etc.

# Decorative Elements Rules:
- Use them exactly as they are in the HTML reference.
- Do not change decorative images and icons urls.
- Images containing company name, logos, etc should be identified as decorative elements.

# Content Elements:
- Title, Description, BulletPoints, etc.
- Graphs, Charts, etc.
- Images and Icons representing textual content like title, description, bullet points, etc.
- Meaningful Images and Icons.
- Icons in infographics that represent the data.

# Content Elements Rules:
- Properly identify between images and icons elements.
- Image content:
    - Image field should be 'z.object({"image_url": z.string(), "image_prompt": z.string().max(100)})'
    - Replace actual image url with '/static/images/replaceable_template_image.png'
- Icon content:
    - Icon field should be 'z.object({"icon_url": z.string(), "icon_query": z.string().max(30)})'
    - Replace actual icon url with '/static/icons/placeholder.svg'
    - Add color styling to the icon to match the color in the image.
- Make sure the urls are correct.

# Layout Rules:
- The layout should be fixed 1280px width and 720px height.
- Adjust the positions and sizes of elements to fit the layout.
- Try to keep the positions and sizes of elements as close to HTML reference as possible.

# Flexible Positioning and Sizes Rules:
- Must not use 'absolute' positioning for elements.
- Must use 'flex', 'grid', 'margin', 'padding', 'gap', 'basis', 'justify', 'align', etc for positioning of elements.
- For variable length lists, wrap list into a container and center it.
- Don't use specific sizes (height, width) for elements if not necessary.

# Schema Field Name and Description Rules:
- Must not use content specific words.
- Only use words based on what content types are present in the slide image.
- Use words like 'title', description', 'heading', 'image', 'graph', 'table', 'bullet points', etc.
- Must not use words like 'budget', 'market', 'revenue', 'sales', 'growth', 'workflow', 'channel', 'plannedValue', 'actualValue', etc.

# Layout ID, Name and Description Rules:
- Must only use slide structure to derive layout id, name and description.
- Informations like: Type of content, position of content, etc. should be used.
- layoutId example: title-description-right-image.
- layoutName example: Title Description Image.
- layoutDescription example: A slide with a title, description, and an image on right.

# Zod Schema Rules:
- "describe" must be added for every fields.
- Add `.default(...)` to every top-level field directly inside the initial `z.object({ ... })` shape.
- Must not put a single `default` on the whole object like `const Schema = z.object({ ... }).default({ ... })`.
- Top level fields are those not nested inside other fields.
- Don't mention string type in schema like "url()", "email()", etc.
- Table must be object with "columns" and "rows" fields.
- "columns" must be an array of strings.
- "rows" must be an array of arrays of strings.
- Graph must be object with "categories" and "series" fields.
- "categories" must be an array of strings.
- "series" must be an array of objects with {"name": string, "data": array of numbers}.
- Must not use z.record() anywhere in the schema.

# String and Array Field Rules:
- Every string field must include `.max(...)`; every array field must include `.max(...)`.
- For strings, set `max` to the exact character count of the text content it represents.
- For arrays, set `max` to the exact item count of the array content it represents.
- Choose a `max` that keeps the longest allowed content from overflowing its container.

# Table Rules:
- Construct "tr -> th" by iterating over the "columns" field.
- Construct "tr -> td" by iterating over the "rows" field.
- Make sure table height and width adjusts to fit the content.

# Grahps, Charts, etc Rules:
- Identify if graphs, charts, etc are present in the slide image.
- Identify the type of graph, chart, etc.
- If present, generate a zod schema for the graph, chart, etc.
- Generate TSX code for the graph, chart, etc. even if it is not present in the HTML reference.
- Use graph schema and image to generate the TSX code.
- Use Recharts library for graphs.

# Fonts Rules:
- Check for "PROVIDED FONTS".
- Must use fonts only from "PROVIDED FONTS".
- Add "font-[\"font-name\"]" to every text element in the slide.

# Page Number Rules:
- Identify if the slide contains page number from provided HTML reference and image.
- If page number is present, add a "page: z.number().min(1).meta({ description: "Page number" })" field in the schema.

# React Component Rules:
- React component must be named dynamicSlideLayout.
- dynamicSlideLayout must take "{ data }: { data: Partial<z.infer<typeof Schema>> }" as props.
- Wrap the code inside these classes: "relative w-full rounded-sm max-w-[1280px] shadow-lg max-h-[720px] aspect-video bg-white z-20 mx-auto overflow-hidden".
- Make sure camelCase is used for all styles. For e.g. "letter-spacing" should be "letterSpacing".
- Schema.parse must not be used in the code.
- Use 'const {field1, field2, ...} = data;' to access the data.
- field1 or field2 or ... can be undefined, so use optional chaining to access them.
- Don't use "min-height" on cards and instead make its height grow/shrink to fit the content.
- Make sure cards/items are centered vertically and horizontally in the available space.
- Make sure no element is scrollable.
- Don't add any animations, transitions, or effects.
- Make sure no content elements are overflowing the slide boundaries.

# Import and Export Rules:
- All import statements must be defined at the top.
- Export using 'export {Schema, layoutId, layoutName, layoutDescription, dynamicSlideLayout}' statement at the bottom.
- There must be only one 'export' statement in the whole TSX code.

# Output Code Rules:
- Code should be in following order:
  - Zod Schema (Schema)
  - Layout ID, Name and Description (layoutId, layoutName, layoutDescription)
  - React Component (dynamicSlideLayout)
- Give just one valid TSX code as output.
- Don't add comments in the code.
- Make sure the generated code is valid TSX code.
- Give only code as output and nothing else. (no json, no markdown, no text, no explanation)

- Go through generated code and make sure all rules are followed.
- Think as long as you can and iterate as many times as necessary to make sure all rules are followed.
"""

SLIDE_LAYOUT_EDIT_SYSTEM_PROMPT = """
You need to edit the given TSX code of the slide layout code according to the prompt and provide it as output.

# Steps
1. Analyze the TSX code to understand the slide layout.
2. Analyze the prompt to understand the changes to be made.
3. Edit the TSX code according to the prompt.
4. Provide the updated TSX code as output.

# Rules
- Make sure the changes does not break the existing code.
- Make sure to follow the pattern of the existing code.
- Make sure there are no unused schema fields after the changes are made.

# Icons and Images Rules
Follow these rules if new icons/images are asked:
- Image field should be 'z.object({"image_url": z.string(), "image_prompt": z.string().max(100)})'
- Use this as default image url: '/static/images/replaceable_template_image.png'
- Icon field should be 'z.object({"icon_url": z.string(), "icon_query": z.string().max(30)})'
- Use this as default icon url: '/static/icons/placeholder.svg'

# Schema Rules
- "describe" must be added for every fields.
- "default" must be added in top level fields of schema.
- Top level fields are those not nested inside other fields.
- Must set max for every string and array fields.
- Must set max to a number that will not cause overflow on max content.

# Graphs And Table Rules
Follow these rules if new graphs/tables are asked:
1. Schema Rules
- Table must be object with "columns" and "rows" fields.
- "columns" must be an array of strings.
- "rows" must be an array of arrays of strings.
- Graph must be object with "categories" and "series" fields.
- "categories" must be an array of strings.
- "series" must be an array of objects with {"name": string, "data": array of numbers}.
2. React Component Rules
- Use recharts library for graphs.

# Common Prompts
1. Fix the slide
- Check if text/cards/items is overflowing the slide boundaries or text/cards/items are overlapping.
- If yes, fix by moving the element to a better position or resizing the element.

# Output Rules
- Make sure the schema and react component are valid.
- No matter what prompt is given, don't break the code.
- Provide only the updated TSX code as output and nothing else. (no json, no markdown, no text, no explanation)
"""

SLIDE_LAYOUT_EDIT_SECTION_SYSTEM_PROMPT = """
You need to edit the given TSX code of the slide layout code according to the prompt and provide it as output.

# Steps
1. Analyze the TSX code to understand the slide layout.
2. Analyze the prompt to understand the changes to be made.
3. Edit the TSX code according to the prompt.
4. Provide the updated TSX code as output.

# Rules
- Changes should be made only around the mentioned "section to make changes around".
- Make sure the changes does not break the existing code.
- Make sure to follow the pattern of the existing code.
- Make sure there are no unused schema fields after the changes are made.

# Icons and Images Rules
Follow these rules if new icons/images are asked:
- Image field should be 'z.object({"image_url": z.string(), "image_prompt": z.string().max(100)})'
- Use this as default image url: '/static/images/replaceable_template_image.png'
- Icon field should be 'z.object({"icon_url": z.string(), "icon_query": z.string().max(30)})'
- Use this as default icon url: '/static/icons/placeholder.svg'

# Output Rules
- Make sure the schema and react component are valid.
- No matter what prompt is given, don't break the code.
- Provide only the updated TSX code as output and nothing else. (no json, no markdown, no text, no explanation)
"""
