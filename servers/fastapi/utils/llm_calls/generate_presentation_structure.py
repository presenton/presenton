from typing import Optional
import logging

from llmai import get_client
from llmai.shared import JSONSchemaResponse, Message, SystemMessage, UserMessage
from models.presentation_layout import PresentationLayoutModel
from models.presentation_outline_model import PresentationOutlineModel
from utils.llm_config import get_llm_config
from utils.llm_client_error_handler import handle_llm_client_exceptions
from utils.llm_utils import DisconnectChecker, generate_structured_with_schema_retries
from utils.llm_provider import get_model
from utils.get_dynamic_models import get_presentation_structure_model_with_n_slides
from utils.schema_utils import prepare_schema_for_validation
from models.presentation_structure_model import PresentationStructureModel

LOGGER = logging.getLogger(__name__)

# Keyword tiers used to identify which layout(s) in a template are meant for
# the opening/title slide, most-specific first. Models -- especially
# smaller/local ones -- don't reliably follow instruction-only guidance for
# this on a single-shot structured output (no reasoning step to correct
# itself), so this backs the prompt with a deterministic check rather than
# relying on compliance alone.
#
# "title" is deliberately last and treated as low-confidence: many
# real-world templates prefix nearly every layout id/name with "title_"
# (meaning "this layout has a title field"), which makes the word "title"
# alone non-discriminating -- see _MAX_MATCH_FRACTION below.
_TITLE_LAYOUT_KEYWORD_TIERS = ("intro", "cover", "opening", "welcome", "hero", "title")

# If a keyword matches more than this fraction of the whole layout catalog,
# it's almost certainly a naming-convention artifact for this template (e.g.
# every layout id happens to start with "title_") rather than a real signal
# that a specific layout is the opening slide -- skip it and fall through to
# a more specific/rarer keyword instead of trusting a near-universal match.
# Deliberately high: small templates can legitimately have two or three
# layouts that are genuinely title-ish, and that shouldn't get thrown out --
# this is meant to catch only the extreme "basically the whole catalog
# matched" case.
_MAX_MATCH_FRACTION = 0.75


STRUCTURE_FROM_SLIDES_MARKDOWN_SYSTEM_PROMPT = """
You will be given available slide layouts and content for each slide.
You need to select a layout for each slide based on the mentioned guidelines.

# Steps
1. Analyze all available slide layouts.
2. Analyze content for each slide.
3. Select a layout for each slide one by one by following the selection rules.

# Analyzing Slide Layouts
- Identify what each layout contains based on provided schema markdown.

# Analyzing Content
- Identify how the content is structured.
- Identify if the content contains tables.

# Selection Rules
- If content contains table, then select either table layout or graph layout.
- Don't select layout with image unless content contains image or the user explicitly requests imagery.
- Don't select table layout if content does not contain table.
- You are allowed to select same layout for multiple slides.

# Title Slide Rule (highest priority -- apply before all other rules)
- The first slide in the presentation is the opening/title slide.
- Check every available layout's name and description for words indicating it is a
  title, cover, or opening layout.
- If any such layout exists among the available layouts, the first slide MUST use it.
- Do not use a title/cover/opening layout for any slide other than the first slide
  (or a dedicated closing slide, if the content explicitly calls for one), even if it
  seems visually appealing for a content slide.

# Table Layout Selection Rules
- Must select table layout if the content contains table with text data.
- Must only select a layout with table if the table only contains text data.

# Graph Layout Selection Rules
- Must only select a layout with chart if the content contains table with numeric data.
- Identify how many columns are present in the table.
- Must select a layout that supports n-1 charts for n columns.
- Must prioritize layouts that support multiple charts.
- Don't select metrics layout for content containing table with numeric data.
- For example, if content contains table with 3 columns, then select a layout that supports 2 charts.

{user_intent}

# User Intent Rules
- Extract visual constraints from User Instructions and Original User Request; User Instructions win conflicts.
- The supplied slide count is authoritative. Slide numbers are one-based; "all" means every slide.
- Prefer exact chart types and image placements, reusing layouts if needed.
- Treat a numeric table on a chart-requested slide as chart data, not a request for a table-only layout.

# Output Rules: 
- One layout option number for each slide, in slide order.
- Layout option numbers do NOT need to match slide positions -- the same option can
  repeat, and options are typically used out of order. Example: [2, 0, 4, 0, 1]

{presentation_layout}
"""


GET_MESSAGES_SYSTEM_PROMPT = """
You're a professional presentation designer with creative freedom to design engaging presentations.

# DESIGN PHILOSOPHY
- Create visually compelling and varied presentations
- Match layout to content purpose and audience needs

# Title Slide Rule (highest priority -- apply before all other guidelines)
- The first slide in the presentation is the opening/title slide.
- Check every available layout's name and description for words indicating it is a
  title, cover, or opening layout.
- If any such layout exists among the available layouts, the first slide MUST use it.
- Do not use a title/cover/opening layout for any slide other than the first slide
  (or a dedicated closing slide, if the content explicitly calls for one), even if it
  seems visually appealing for a content slide.

# Layout Selection Guidelines
1. **Content-driven choices**: Let the slide's purpose guide layout selection
- Opening/closing → Title layouts (see Title Slide Rule above for the first slide)
- Processes/workflows → Visual process layouts  
- Comparisons/contrasts → Side-by-side layouts
- Data/metrics → Chart/graph layouts
- Concepts/ideas → Image + text layouts
- Key insights → Emphasis layouts

2. **Visual variety**: Aim for diverse slide layouts across the presentation. 
- Don't use same layout for multiple slides unless necessary.
- Mix text-heavy and visual-heavy slides naturally
- Use your judgment on when repetition serves the content
- Balance information density across slides
- Adjacent slide layouts should be different unless instructed/necessary otherwise.

3. **Audience experience**: Consider how slides work together
- Create natural transitions between topics

4. **Table of contents**:
- Must only use table of contents layout if slide content contains table of contents.

{user_instruction_header}

Extract visual constraints from User Instructions and Original User Request; User
Instructions win conflicts. The supplied slide count is authoritative. Slide numbers are
one-based, and "all" or "every" includes the title slide. Prefer exact chart types and
image placements over variety, reusing layouts if needed. A numeric table on a
chart-requested slide is chart data, not a request for a table-only layout.

Select layout index for each of the {n_slides} slides based on what will best serve the presentation's goals.

"""


def get_messages(
    presentation_layout: PresentationLayoutModel,
    n_slides: int,
    data: str,
    instructions: Optional[str] = None,
    source_content: Optional[str] = None,
) -> list[Message]:
    intent_sections = []
    if instructions:
        intent_sections.append(f"# User Instructions:\n{instructions}")
    if source_content:
        intent_sections.append(f"# Original User Request:\n{source_content}")
    system_prompt = GET_MESSAGES_SYSTEM_PROMPT.format(
        user_instruction_header="\n\n".join(intent_sections),
        n_slides=n_slides,
    )

    return [
        SystemMessage(content=system_prompt),
        UserMessage(
            content=(
                f"{presentation_layout.to_string()}\n\n"
                "--------------------------------------\n\n"
                f"{data}"
            )
        ),
    ]


def get_messages_for_slides_markdown(
    presentation_layout: PresentationLayoutModel,
    n_slides: int,
    data: str,
    instructions: Optional[str] = None,
    source_content: Optional[str] = None,
) -> list[Message]:
    intent_sections = []
    if instructions:
        intent_sections.append(f"# User Instructions:\n{instructions}")
    if source_content:
        intent_sections.append(f"# Original User Request:\n{source_content}")
    system_prompt = STRUCTURE_FROM_SLIDES_MARKDOWN_SYSTEM_PROMPT.format(
        user_intent="\n\n".join(intent_sections),
        presentation_layout=presentation_layout.to_string(with_schema=True),
    )

    return [SystemMessage(content=system_prompt), UserMessage(content=data)]


def _find_title_layout_indices(presentation_layout: PresentationLayoutModel) -> list[int]:
    """
    Find layout(s) in the template whose name/description mark them as an
    opening/title/cover layout, most-specific keyword tier first. A tier is
    skipped (falling through to the next, less-specific one) if it matches
    more of the catalog than _MAX_MATCH_FRACTION allows, since that means
    the keyword isn't actually discriminating for this template. Returns
    all matches at the first usable tier found (usually just one), or an
    empty list if nothing in the template confidently reads as a title
    layout.
    """
    total = len(presentation_layout.slides)
    if total == 0:
        return []

    matches_by_tier: dict[int, list[int]] = {}
    for index, slide in enumerate(presentation_layout.slides):
        name = (slide.name or slide.json_schema.get("title") or "") or ""
        haystack = f"{name} {slide.description or ''}".lower()
        for tier, keyword in enumerate(_TITLE_LAYOUT_KEYWORD_TIERS):
            if keyword in haystack:
                matches_by_tier.setdefault(tier, []).append(index)
                break

    for tier in range(len(_TITLE_LAYOUT_KEYWORD_TIERS)):
        candidates = matches_by_tier.get(tier)
        if not candidates:
            continue
        if len(candidates) / total > _MAX_MATCH_FRACTION:
            LOGGER.info(
                "[title_layout_correction] keyword '%s' matched %s/%s layouts "
                "-- too broad to be a real signal for this template, skipping",
                _TITLE_LAYOUT_KEYWORD_TIERS[tier],
                len(candidates),
                total,
            )
            continue
        return candidates
    return []


def _ensure_title_layout_for_first_slide(
    structure: PresentationStructureModel,
    presentation_layout: PresentationLayoutModel,
) -> PresentationStructureModel:
    """
    Deterministic safety net for the model's layout choice for the first
    slide. If the template has a layout clearly meant for the opening/title
    slide but the model picked something else for slide 0, override it --
    this is too structurally important to leave entirely to model
    compliance, particularly with smaller/local models.
    """
    if not structure.slides:
        LOGGER.info("[title_layout_correction] called with an empty slide list -- nothing to check")
        return structure

    catalog_summary = [
        f"{index}:{slide.name or slide.json_schema.get('title') or '(no name)'}"
        for index, slide in enumerate(presentation_layout.slides)
    ]
    title_layout_indices = _find_title_layout_indices(presentation_layout)
    LOGGER.info(
        "[title_layout_correction] first slide check -- model chose layout %s; "
        "title/cover/opening candidates found: %s; layout catalog: %s",
        structure.slides[0],
        title_layout_indices,
        catalog_summary,
    )

    if not title_layout_indices:
        LOGGER.info(
            "[title_layout_correction] no layout in this template's catalog matched "
            "title/cover/opening keywords in its name or description -- nothing to enforce"
        )
        return structure

    if structure.slides[0] in title_layout_indices:
        return structure

    corrected_index = title_layout_indices[0]
    LOGGER.info(
        "[title_layout_correction] model chose layout %s for the first "
        "slide; overriding to %s (detected title/cover/opening layout)",
        structure.slides[0],
        corrected_index,
    )
    structure.slides[0] = corrected_index
    return structure


async def generate_presentation_structure(
    presentation_outline: PresentationOutlineModel,
    presentation_layout: PresentationLayoutModel,
    instructions: Optional[str] = None,
    using_slides_markdown: bool = False,
    source_content: Optional[str] = None,
    disconnect_checker: Optional[DisconnectChecker] = None,
) -> PresentationStructureModel:
    client = get_client(config=get_llm_config())
    model = get_model()
    response_model = get_presentation_structure_model_with_n_slides(
        len(presentation_outline.slides)
    )

    try:
        messages = (
            get_messages_for_slides_markdown(
                presentation_layout,
                len(presentation_outline.slides),
                presentation_outline.to_string(),
                instructions,
                source_content,
            )
            if using_slides_markdown
            else get_messages(
                presentation_layout,
                len(presentation_outline.slides),
                presentation_outline.to_string(),
                instructions,
                source_content,
            )
        )
        structure_schema = prepare_schema_for_validation(
            response_model.model_json_schema(),
            strict=False,
        )
        response_format = JSONSchemaResponse(
            name="response",
            json_schema=structure_schema,
            strict=False,
        )

        content = await generate_structured_with_schema_retries(
            client,
            model,
            messages=messages,
            response_format=response_format,
            json_schema=structure_schema,
            strict=False,
            validate_schema=True,
            disconnect_checker=disconnect_checker,
        )
        structure = PresentationStructureModel(**content)
        return _ensure_title_layout_for_first_slide(structure, presentation_layout)
    except Exception as e:
        raise handle_llm_client_exceptions(e)
