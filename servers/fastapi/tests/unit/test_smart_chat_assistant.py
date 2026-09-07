import asyncio
import uuid

from models.chat import ChatMessageRequest
from models.sql.presentation import PresentationModel, PresentationVersion
from models.sql.slide import SlideModel
from services.chat.memory_layer import PresentationChatMemoryLayer
from services.chat.prompts import build_system_prompt
from services.chat.tools import ChatTools

VALID_SMART_HTML = (
    '<section data-slide-type="content" data-slide-title="Updated title" '
    'class="relative h-[720px] w-[1280px] overflow-hidden bg-white">'
    '<h2 class="text-5xl">Updated title</h2></section>'
)

VALID_SMART_CHART_HTML = (
    '<section data-slide-type="content" data-slide-title="Updated chart" '
    'class="relative h-[720px] w-[1280px] overflow-hidden bg-white">'
    '<canvas id="chart-a1b2c3" width="600" height="300"></canvas>'
    "<script>(() => { const canvas = document.querySelector('#chart-a1b2c3'); "
    "new Chart(canvas, {type: 'bar', data: {labels: ['A'], datasets: "
    "[{data: [7]}]}, options: {responsive: false, animation: false, plugins: "
    "{datalabels: {formatter: function(value) { return value; }}}}}); "
    "})();</script></section>"
)


class _Rows:
    def __init__(self, rows):
        self._rows = rows

    def __iter__(self):
        return iter(self._rows)


class _SmartSession:
    def __init__(self, presentation, slides):
        self.presentation = presentation
        self.slides = slides
        self.added = []
        self.commit_count = 0

    async def get(self, model, object_id):
        if model is PresentationModel and object_id == self.presentation.id:
            return self.presentation
        return None

    async def scalar(self, _statement):
        return self.slides[0] if self.slides else None

    async def scalars(self, _statement):
        return _Rows(self.slides)

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, _value):
        return None


def _smart_presentation(presentation_id):
    return PresentationModel(
        id=presentation_id,
        version=PresentationVersion.V2_STANDARD,
        content="Smart deck",
        n_slides=1,
        language="English",
        title="Smart deck",
        generation_mode="smart",
    )


def test_chat_request_accepts_smart_presentation_type():
    payload = ChatMessageRequest(
        presentation_id=uuid.uuid4(),
        presentation_type="smart",
        message="Shorten slide 1",
    )

    assert payload.presentation_type == "smart"


def test_smart_memory_text_strips_malformed_script_end_tag():
    text = PresentationChatMemoryLayer._html_to_text(
        "<h2>Safe title</h2><script>secret()</script\t\n data-extra><p>Visible</p>"
    )

    assert text == "Safe title Visible"


def test_smart_prompt_requires_full_validated_html_replacement():
    prompt = build_system_prompt("", "", presentation_type="smart")

    assert "complete replacement HTML fragment" in prompt
    assert "includeFullContent=true" in prompt
    assert "replaceOldSlideAtIndex=true" in prompt
    assert "template layout/schema/component" in prompt
    assert "never save a canvas" in prompt
    assert "do not add a CDN script" in prompt
    assert "normal-flow flex/grid" in prompt
    assert "no sibling boxes overlap" in prompt
    assert "Preserve important facts" in prompt


def test_smart_chat_exposes_only_html_appropriate_tools():
    class _Memory:
        presentation_type = "smart"

    tool_names = {tool.name for tool in ChatTools(_Memory()).get_tool_definitions()}

    assert {
        "getSmartPresentationContext",
        "getSlideAtIndex",
        "searchSlide",
        "saveSlide",
        "deleteSlide",
    }.issubset(tool_names)
    assert "updateElement" not in tool_names
    assert "getAvailableLayouts" not in tool_names
    assert "addOutline" not in tool_names


def test_smart_slide_read_returns_authoritative_html():
    presentation_id = uuid.uuid4()
    presentation = _smart_presentation(presentation_id)
    slide = SlideModel(
        presentation=presentation_id,
        layout_group="smart-html",
        layout="smart-html",
        index=0,
        content={"title": "Original"},
        html_content=VALID_SMART_HTML,
        speaker_note="",
    )
    memory = PresentationChatMemoryLayer(
        _SmartSession(presentation, [slide]),
        presentation_id,
        presentation_type="smart",
    )

    result = asyncio.run(memory.get_slide_at_index(0, include_full_content=True))

    assert result is not None
    assert result["format"] == "html"
    assert result["html"] == VALID_SMART_HTML
    assert "Updated title" in result["html_text_preview"]


def test_smart_slide_save_validates_and_replaces_html():
    presentation_id = uuid.uuid4()
    presentation = _smart_presentation(presentation_id)
    slide = SlideModel(
        presentation=presentation_id,
        layout_group="smart-html",
        layout="smart-html",
        index=0,
        content={"title": "Original"},
        html_content=(
            '<section class="relative h-[720px] w-[1280px] overflow-hidden">'
            "<h2>Original</h2></section>"
        ),
        speaker_note="",
    )
    session = _SmartSession(presentation, [slide])
    memory = PresentationChatMemoryLayer(
        session,
        presentation_id,
        presentation_type="smart",
    )

    result = asyncio.run(
        memory.save_html_slide(
            html=VALID_SMART_HTML,
            index=0,
            replace_old_slide_at_index=True,
        )
    )

    assert result["saved"] is True
    assert slide.html_content == VALID_SMART_HTML
    assert slide.content == {"title": "Updated title"}
    assert slide.ui is None
    assert session.commit_count == 1


def test_smart_chat_save_preserves_complete_chart_script():
    presentation_id = uuid.uuid4()
    presentation = _smart_presentation(presentation_id)
    slide = SlideModel(
        presentation=presentation_id,
        layout_group="smart-html",
        layout="smart-html",
        index=0,
        content={"title": "Original"},
        html_content=VALID_SMART_HTML,
        speaker_note="",
    )
    session = _SmartSession(presentation, [slide])
    memory = PresentationChatMemoryLayer(
        session,
        presentation_id,
        presentation_type="smart",
    )

    result = asyncio.run(
        memory.save_html_slide(
            html=VALID_SMART_CHART_HTML,
            index=0,
            replace_old_slide_at_index=True,
        )
    )

    assert result["saved"] is True
    assert "<canvas" in slide.html_content
    assert "<script" in slide.html_content
    assert "new Chart" in slide.html_content


def test_smart_slide_save_rejects_invalid_canvas():
    presentation_id = uuid.uuid4()
    presentation = _smart_presentation(presentation_id)
    session = _SmartSession(presentation, [])
    memory = PresentationChatMemoryLayer(
        session,
        presentation_id,
        presentation_type="smart",
    )

    result = asyncio.run(
        memory.save_html_slide(
            html="<section><h2>Broken</h2></section>",
            index=0,
            replace_old_slide_at_index=False,
        )
    )

    assert result["saved"] is False
    assert result["validation_errors"]
    assert session.commit_count == 0


def test_smart_chat_save_rejects_overlapping_positioned_content():
    presentation_id = uuid.uuid4()
    presentation = _smart_presentation(presentation_id)
    session = _SmartSession(presentation, [])
    memory = PresentationChatMemoryLayer(
        session,
        presentation_id,
        presentation_type="smart",
    )
    overlapping_html = (
        '<section class="relative h-[720px] w-[1280px] overflow-hidden">'
        '<div class="absolute left-[40px] top-[80px] w-[500px] h-[180px]">'
        "First</div>"
        '<div class="absolute left-[300px] top-[120px] w-[500px] h-[180px]">'
        "Second</div></section>"
    )

    result = asyncio.run(
        memory.save_html_slide(
            html=overlapping_html,
            index=0,
            replace_old_slide_at_index=False,
        )
    )

    assert result["saved"] is False
    assert "sibling content boxes overlap" in result["validation_errors"][0]
    assert session.commit_count == 0
