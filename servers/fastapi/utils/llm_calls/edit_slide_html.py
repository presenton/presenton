import asyncio
from typing import Optional
from fastapi import HTTPException
from llmai import get_client
from llmai.shared import SystemMessage, UserMessage
from utils.llm_config import get_llm_config
from utils.llm_client_error_handler import handle_llm_client_exceptions
from utils.llm_utils import extract_text, get_generate_kwargs
from utils.llm_provider import get_model

system_prompt = """
    You are an expert HTML slide editor. Your task is to modify slide HTML content based on user prompts while maintaining proper structure, styling, and functionality.

    Guidelines:
    1. **Preserve Structure**: Maintain the overall HTML structure, including essential containers, classes, and IDs
    2. **Content Updates**: Modify text, images, lists, and other content elements as requested
    3. **Style Consistency**: Keep existing CSS classes and styling unless specifically asked to change them
    4. **Responsive Design**: Ensure modifications work across different screen sizes
    5. **Accessibility**: Maintain proper semantic HTML and accessibility attributes
    6. **Clean Output**: Return only the modified HTML without explanations unless errors occur

    Common Edit Types:
    - Text content changes (headings, paragraphs, lists)
    - Image updates (src, alt text, captions)
    - Layout modifications (adding/removing sections)
    - Style adjustments (colors, fonts, spacing via classes)
    - Interactive elements (buttons, links, forms)

    Error Handling:
    - If the HTML structure is invalid, fix it while making requested changes
    - If a request would break functionality, suggest an alternative approach
    - For unclear prompts, make reasonable assumptions and note any ambiguities

    Output Format:
    Return the complete modified HTML. If the original HTML contains <style> or <script> tags, preserve them unless specifically asked to modify.
"""


def get_user_prompt(prompt: str, html: str, memory_context: Optional[str] = None):
    memory_block = (
        f"\n        **Retrieved Presentation Memory Context:**\n        {memory_context}\n"
        if memory_context
        else ""
    )

    return f"""
        Please edit the following slide HTML based on this prompt:

        **Edit Request:** {prompt}
        {memory_block}

        **Current HTML:**
        ```html
        {html}
        ```

        Return the modified HTML with your changes applied.
    """


async def get_edited_slide_html(
    prompt: str, html: str, memory_context: Optional[str] = None
):
    model = get_model()

    client = get_client(config=get_llm_config())
    try:
        response = await asyncio.to_thread(
            client.generate,
            **get_generate_kwargs(
                model=model,
                messages=[
                    SystemMessage(content=system_prompt),
                    UserMessage(
                        content=get_user_prompt(prompt, html, memory_context)
                    ),
                ],
            ),
        )
        response_text = extract_text(response.content)
        if response_text is None:
            raise HTTPException(status_code=400, detail="LLM did not return any content")
        return extract_html_from_response(response_text) or html
    except Exception as e:
        raise handle_llm_client_exceptions(e)


def extract_html_from_response(response_text: str) -> Optional[str]:
    start_index = response_text.find("<")
    end_index = response_text.rfind(">")

    if start_index != -1 and end_index != -1 and end_index > start_index:
        return response_text[start_index : end_index + 1]

    return None
