from models.presentation_layout import PresentationLayoutModel, SlideLayoutModel
from utils.llm_calls.generate_presentation_structure import (
    get_messages,
    get_messages_for_slides_markdown,
)


def _layout() -> PresentationLayoutModel:
    return PresentationLayoutModel(
        name="test",
        slides=[
            SlideLayoutModel(
                id="left-image",
                description="Image on the left with text on the right",
                json_schema={"type": "object", "properties": {}},
            ),
            SlideLayoutModel(
                id="bar-chart",
                description="Vertical bar chart",
                json_schema={"type": "object", "properties": {}},
            ),
        ],
    )


def test_structure_prompt_preserves_visual_intent_from_original_request():
    request = (
        "Presentation Topic: Global Warming and AI. I need a bar chart on the "
        "4th slide and images on the left on all slides."
    )

    messages = get_messages(
        _layout(),
        6,
        "outline",
        source_content=request,
    )
    prompt = str(messages[0].content)

    assert f"# Original User Request:\n{request}" in prompt
    assert "Slide numbers are\none-based" in prompt
    assert "Prefer exact chart types and\nimage placements" in prompt
    assert '"all" or "every" includes the title slide' in prompt


def test_slides_markdown_structure_prompt_includes_both_intent_sources():
    messages = get_messages_for_slides_markdown(
        _layout(),
        1,
        "## Climate",
        instructions="Use a bar chart",
        source_content="Climate presentation with visuals on the left",
    )
    prompt = str(messages[0].content)

    assert "# User Instructions:\nUse a bar chart" in prompt
    assert "# Original User Request:\nClimate presentation" in prompt
