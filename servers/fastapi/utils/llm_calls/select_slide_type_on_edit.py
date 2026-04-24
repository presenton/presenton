import asyncio
from fastapi import HTTPException
from llmai import get_client
from llmai.shared import JSONSchemaResponse, Message, SystemMessage, UserMessage
from models.presentation_layout import PresentationLayoutModel, SlideLayoutModel
from models.slide_layout_index import SlideLayoutIndex
from models.sql.slide import SlideModel
from utils.llm_config import get_llm_config
from utils.llm_client_error_handler import handle_llm_client_exceptions
from utils.llm_utils import extract_structured_content, get_generate_kwargs
from utils.llm_provider import get_model


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
        response_format = JSONSchemaResponse(
            name="response",
            json_schema=SlideLayoutIndex.model_json_schema(),
            strict=True,
        )
        messages = get_messages(
            prompt,
            slide.content,
            layout,
            slide_layout_index,
            memory_context,
        )

        for attempt in range(3):
            response = await asyncio.to_thread(
                client.generate,
                **get_generate_kwargs(
                    model=model,
                    messages=messages,
                    response_format=response_format,
                ),
            )
            content = extract_structured_content(response.content)
            if content is not None:
                index = SlideLayoutIndex(**content).index
                return layout.slides[index]

            if attempt < 2:
                await asyncio.sleep(0.5 * (attempt + 1))

        raise HTTPException(status_code=400, detail="LLM did not return any content")

    except Exception as e:
        raise handle_llm_client_exceptions(e)
