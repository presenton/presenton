from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from google import genai


async def list_available_openai_compatible_models(url: str, api_key: str) -> list[str]:
    client = AsyncOpenAI(api_key=api_key, base_url=url)
    models = (await client.models.list()).data
    if models:
        return list(map(lambda x: x.id, models))
    return []


async def list_available_anthropic_models(api_key: str) -> list[str]:
    client = AsyncAnthropic(api_key=api_key)
    return list(map(lambda x: x.id, (await client.models.list(limit=50)).data))


async def list_available_google_models(api_key: str) -> list[str]:
    client = genai.Client(api_key=api_key)
    return list(map(lambda x: x.name, client.models.list(config={"page_size": 50})))


async def list_available_minimax_models(api_key: str) -> list[str]:
    from constants.llm import MINIMAX_URL

    return await list_available_openai_compatible_models(MINIMAX_URL, api_key)
