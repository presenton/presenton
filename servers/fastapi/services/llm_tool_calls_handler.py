import asyncio
from datetime import datetime
import json
from typing import Any, Callable, Coroutine, List, Optional
from fastapi import HTTPException
from enums.llm_provider import LLMProvider
from models.llm_message import (
    AnthropicToolCallMessage,
    GoogleToolCallMessage,
    OpenAIToolCallMessage,
)
from models.llm_tool_call import AnthropicToolCall, GoogleToolCall, OpenAIToolCall
from models.llm_tools import LLMDynamicTool, LLMTool, SearchWebTool
from utils.schema_utils import (
    ensure_strict_json_schema,
    flatten_json_schema,
    remove_titles_from_schema,
)


class LLMToolCallsHandler:
    def __init__(self, client):
        from services.llm_client import LLMClient

        self.client: LLMClient = client

        self.tools_map: dict[str, Callable[..., Coroutine[Any, Any, str]]] = {
            "SearchWebTool": self.search_web_tool_call_handler,
            "GetCurrentDatetimeTool": self.get_current_datetime_tool_call_handler,
        }
        self.dynamic_tools: List[LLMDynamicTool] = []

    def get_tool_handler(
        self, tool_name: str
    ) -> Callable[..., Coroutine[Any, Any, str]]:
        handler = self.tools_map.get(tool_name)
        if handler:
            return handler
        else:
            dynamic_tools = list(
                filter(lambda tool: tool.name == tool_name, self.dynamic_tools)
            )
            if dynamic_tools:
                return dynamic_tools[0].handler
        raise HTTPException(status_code=500, detail=f"Tool {tool_name} not found")

    def parse_tools(self, tools: Optional[List[type[LLMTool] | LLMDynamicTool]] = None):
        if tools is None:
            return None
        parsed_tools = map(self.parse_tool, tools)
        return list(parsed_tools)

    def parse_tool(self, tool: type[LLMTool] | LLMDynamicTool, strict: bool = False):
        if isinstance(tool, LLMDynamicTool):
            self.dynamic_tools.append(tool)

        match self.client.llm_provider:
            case LLMProvider.OPENAI | LLMProvider.OLLAMA | LLMProvider.CUSTOM:
                return self.parse_tool_openai(tool, strict)
            case LLMProvider.ANTHROPIC:
                return self.parse_tool_anthropic(tool)
            case LLMProvider.GOOGLE:
                return self.parse_tool_google(tool)
            case _:
                raise ValueError(
                    f"LLM provider must be either openai, anthropic, or google"
                )

    def parse_tool_openai(
        self, tool: type[LLMTool] | LLMDynamicTool, strict: bool = False
    ):
        if isinstance(tool, LLMDynamicTool):
            name = tool.name
            description = tool.description
            parameters = tool.parameters
        else:
            name = tool.__name__
            description = tool.__doc__ or ""
            parameters = tool.model_json_schema()

        if strict:
            parameters = ensure_strict_json_schema(parameters, path=(), root=parameters)

        return {
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "strict": strict,
                "parameters": parameters,
            },
        }

    def parse_tool_google(self, tool: type[LLMTool] | LLMDynamicTool):
        parsed = self.parse_tool_openai(tool)
        parsed["function"]["parameters"] = (
            remove_titles_from_schema(
                flatten_json_schema(parsed["function"]["parameters"])
            )
            if parsed["function"]["parameters"]
            else {}
        )
        return {
            "name": parsed["function"]["name"],
            "description": parsed["function"]["description"],
            "parameters": parsed["function"]["parameters"],
        }

    def parse_tool_anthropic(self, tool: type[LLMTool] | LLMDynamicTool):
        parsed = self.parse_tool_openai(tool)
        input_schema = parsed["function"]["parameters"]
        return {
            "name": parsed["function"]["name"],
            "description": parsed["function"]["description"],
            "input_schema": {"type": "object"} if input_schema == {} else input_schema,
        }

    async def handle_tool_calls_openai(
        self,
        tool_calls: List[OpenAIToolCall],
    ) -> List[OpenAIToolCallMessage]:
        async_tool_calls_tasks = []
        for tool_call in tool_calls:
            tool_name = tool_call.function.name
            tool_handler = self.get_tool_handler(tool_name)
            async_tool_calls_tasks.append(tool_handler(tool_call.function.arguments))

        tool_call_results: List[str] = await asyncio.gather(*async_tool_calls_tasks)
        tool_call_messages = [
            OpenAIToolCallMessage(
                content=result,
                tool_call_id=tool_call.id,
            )
            for tool_call, result in zip(tool_calls, tool_call_results)
        ]
        return tool_call_messages

    async def handle_tool_calls_google(
        self,
        tool_calls: List[GoogleToolCall],
    ) -> List[GoogleToolCallMessage]:
        async_tool_calls_tasks = []
        for tool_call in tool_calls:
            tool_name = tool_call.name
            tool_handler = self.get_tool_handler(tool_name)
            async_tool_calls_tasks.append(tool_handler(json.dumps(tool_call.arguments)))

        tool_call_results: List[str] = await asyncio.gather(*async_tool_calls_tasks)

        tool_call_messages = [
            GoogleToolCallMessage(
                id=tool_call.id,
                name=tool_call.name,
                response={"result": result},
            )
            for tool_call, result in zip(tool_calls, tool_call_results)
        ]
        return tool_call_messages

    async def handle_tool_calls_anthropic(
        self,
        tool_calls: List[AnthropicToolCall],
    ) -> List[AnthropicToolCallMessage]:
        async_tool_calls_tasks = []
        for tool_call in tool_calls:
            tool_name = tool_call.name
            tool_handler = self.get_tool_handler(tool_name)
            async_tool_calls_tasks.append(tool_handler(json.dumps(tool_call.input)))

        tool_call_results: List[str] = await asyncio.gather(*async_tool_calls_tasks)
        tool_call_messages = [
            AnthropicToolCallMessage(
                content=result,
                tool_use_id=tool_call.id,
            )
            for tool_call, result in zip(tool_calls, tool_call_results)
        ]
        return tool_call_messages

    # ? Tool call handlers
    # Search web tool call handler
    async def search_web_tool_call_handler(self, arguments: str) -> str:
        match self.client.llm_provider:
            case LLMProvider.OPENAI:
                return await self.search_web_tool_call_handler_openai(arguments)
            case LLMProvider.ANTHROPIC:
                return await self.search_web_tool_call_handler_anthropic(arguments)
            case LLMProvider.GOOGLE:
                return await self.search_web_tool_call_handler_google(arguments)
            case _:
                return (
                    "Web search tool call handler not implemented for this LLM provider: "
                    + self.client.llm_provider.value
                )

    async def search_web_tool_call_handler_openai(self, arguments: str) -> str:
        args = SearchWebTool.model_validate_json(arguments)
        return await self.client._search_openai(args.query)

    async def search_web_tool_call_handler_google(self, arguments: str) -> str:
        args = SearchWebTool.model_validate_json(arguments)
        return await self.client._search_google(args.query)

    async def search_web_tool_call_handler_anthropic(self, arguments: str) -> str:
        args = SearchWebTool.model_validate_json(arguments)
        return await self.client._search_anthropic(args.query)

    # Get current datetime tool call handler
    async def get_current_datetime_tool_call_handler(self, _) -> str:
        current_time = datetime.now()
        return f"{current_time.strftime('%A, %B %d, %Y')} at {current_time.strftime('%I:%M:%S %p')}"
