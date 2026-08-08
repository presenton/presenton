from llmai import get_client
from llmai.shared import JSONSchemaResponse, Message, SystemMessage, UserMessage
from models.presentation_layout import PresentationLayoutModel, SlideLayoutModel
from models.slide_layout_index import SlideLayoutIndex
from models.sql.slide import SlideModel
from utils.llm_config import get_llm_config
from utils.llm_client_error_handler import handle_llm_client_exceptions
from utils.llm_utils import generate_structured_with_schema_retries
from utils.llm_provider import get_model
from utils.schema_utils import prepare_schema_for_validation


def get_messages(
    prompt: str,
    slide_data: dict,
    layout: PresentationLayoutModel,
    current_slide_layout: int,
    memory_context: str = "",
) -> list[Message]:
    memory_block = (
        f"\n                # Retrieved Presentation Memory Context\n                {memory_context}\n"
        if memory_context
        else ""
    )

    return [
        SystemMessage(
            content=f"""
                Select a Slide Layout index based on provided user prompt and current slide data.
                {layout.to_string()}
                {memory_block}

                # Notes
                - Do not select different slide layout than current unless absolutely necessary as per user prompt. 
                - If user prompt is not clear, select the layout that is most relevant to the slide data.
                - If user prompt is not clear, select the layout that is most relevant to the slide data.
                **Go through all notes and steps and make sure they are followed, including mentioned constraints**
            """,
        ),
        UserMessage(
            content=f"""
                - User Prompt: {prompt}
                - Current Slide Data: {slide_data}
                - Current Slide Layout: {current_slide_layout}
            """,
        ),
    ]


async def get_slide_layout_from_prompt(
    prompt: str,
    layout: PresentationLayoutModel,
    slide: SlideModel,
    memory_context: str = "",
) -> SlideLayoutModel:
    client = get_client(config=get_llm_config())
    model = get_model()

    slide_layout_index = layout.get_slide_layout_index(slide.layout)

    try:
        layout_index_schema = prepare_schema_for_validation(
            SlideLayoutIndex.model_json_schema(),
            strict=False,
        )
        response_format = JSONSchemaResponse(
            name="response",
            json_schema=layout_index_schema,
            strict=False,
        )
        messages = get_messages(
            prompt,
            slide.content,
            layout,
            slide_layout_index,
            memory_context,
        )

        content = await generate_structured_with_schema_retries(
            client,
            model,
            messages=messages,
            response_format=response_format,
            json_schema=layout_index_schema,
            strict=False,
            validate_schema=True,
        )
        index = SlideLayoutIndex(**content).index
        return layout.slides[index]

    except Exception as e:
        raise handle_llm_client_exceptions(e)
