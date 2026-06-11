from datetime import datetime
from typing import Any, Optional

from llmai.shared import JSONSchemaResponse, SystemMessage, UserMessage

from utils.llm_utils import generate_structured_with_schema_retries

SEARCH_QUERY_GENERATION_PROMPT = """
Generate a concise web search query that finds useful factual context for a presentation.

# Steps
1. Analyze CONTENT and INSTRUCTIONS to identify the presentation topic and information needs.
2. Consider today's date when the request needs current or time-sensitive information.
3. Return one search-engine-style query that would add useful factual context.

# Rules
- Keep the query focused and at most 12 words.
- Preserve important names, places, dates, products, and technical terms.
- Include terms such as "latest", the relevant year, statistics, trends, or examples when
  they would improve the presentation.
- Do not answer the user's request.
- Do not include explanations, quotation marks, search operators, or multiple queries.
""".strip()

SEARCH_QUERY_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "minLength": 1,
            "maxLength": 200,
        },
    },
    "required": ["query"],
    "additionalProperties": False,
}


async def generate_web_search_query(
    client: Any,
    model: str,
    content: str,
    instructions: Optional[str] = None,
) -> Optional[str]:
    response_format = JSONSchemaResponse(
        name="web_search_query",
        json_schema=SEARCH_QUERY_RESPONSE_SCHEMA,
        strict=True,
    )
    response = await generate_structured_with_schema_retries(
        client,
        model,
        messages=[
            SystemMessage(content=SEARCH_QUERY_GENERATION_PROMPT),
            UserMessage(
                content=(
                    f"TODAY'S DATE: {datetime.now().strftime('%Y-%m-%d')}\n\n"
                    f"CONTENT: {content}\n\n"
                    f"INSTRUCTIONS: {instructions or ''}"
                )
            ),
        ],
        response_format=response_format,
        json_schema=SEARCH_QUERY_RESPONSE_SCHEMA,
        strict=True,
        validate_schema=True,
    )
    query = response.get("query")
    if not isinstance(query, str):
        return None
    normalized_query = " ".join(query.split())[:200]
    return normalized_query or None
