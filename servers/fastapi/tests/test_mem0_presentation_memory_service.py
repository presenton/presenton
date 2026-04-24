import asyncio
import uuid
from unittest.mock import patch

from services.mem0_presentation_memory_service import Mem0PresentationMemoryService


class FakeMemoryClient:
    instances = []

    def __init__(self, config=None):
        self.config = config
        self.add_calls = []
        self.search_calls = []
        self.next_search_response = {"results": []}
        FakeMemoryClient.instances.append(self)

    @classmethod
    def from_config(cls, config):
        return cls(config=config)

    def add(self, *args, **kwargs):
        messages = kwargs.get("messages") if "messages" in kwargs else None
        if messages is None and args:
            messages = args[0]

        self.add_calls.append(
            {
                "messages": messages,
                "user_id": kwargs.get("user_id"),
                "infer": kwargs.get("infer"),
            }
        )
        return {"ok": True}

    def search(self, query, *args, **kwargs):
        self.search_calls.append(
            {
                "query": query,
                "filters": kwargs.get("filters"),
                "user_id": kwargs.get("user_id"),
                "top_k": kwargs.get("top_k"),
            }
        )
        return self.next_search_response


class FakeMem0Module:
    Memory = FakeMemoryClient


class TestMem0PresentationMemoryService:
    def setup_method(self):
        FakeMemoryClient.instances = []

    def test_store_generation_context_uses_presentation_scope(self):
        with patch.dict(
            "os.environ",
            {
                "MEM0_ENABLED": "true",
                "APP_DATA_DIRECTORY": "/tmp/presenton-test",
            },
            clear=False,
        ), patch(
            "services.mem0_presentation_memory_service.import_module",
            return_value=FakeMem0Module,
        ):
            service = Mem0PresentationMemoryService()
            presentation_id = uuid.uuid4()
            asyncio.run(
                service.store_generation_context(
                    presentation_id=presentation_id,
                    system_prompt="system prompt",
                    user_prompt="user prompt",
                    extracted_document_text="doc text",
                    source_content="seed prompt",
                    instructions="be concise",
                )
            )

        assert len(FakeMemoryClient.instances) == 1
        client = FakeMemoryClient.instances[0]
        assert client.config is not None
        assert client.config["vector_store"]["provider"] == "qdrant"
        assert client.config["embedder"]["provider"] == "fastembed"
        assert (
            client.config["embedder"]["config"]["model"]
            == "BAAI/bge-small-en-v1.5"
        )
        assert client.config["embedder"]["config"]["embedding_dims"] == 384
        assert client.config["vector_store"]["config"]["on_disk"] is True
        assert client.config["vector_store"]["config"]["embedding_model_dims"] == 384
        assert len(client.add_calls) == 5

        scoped_user_id = f"presentation:{presentation_id}"
        for call in client.add_calls:
            assert call["user_id"] == scoped_user_id
            assert call["infer"] is False

        serialized_messages = "\n".join(
            str(call["messages"][0]["content"]) for call in client.add_calls
        )
        assert "[outline_system_prompt]" in serialized_messages
        assert "[outline_user_prompt]" in serialized_messages
        assert "[document_extracted_text]" in serialized_messages
        assert "[presentation_source_prompt]" in serialized_messages

    def test_retrieve_context_uses_same_scope_and_deduplicates(self):
        with patch.dict(
            "os.environ",
            {
                "MEM0_ENABLED": "true",
                "MEM0_TOP_K": "5",
                "APP_DATA_DIRECTORY": "/tmp/presenton-test",
            },
            clear=False,
        ), patch(
            "services.mem0_presentation_memory_service.import_module",
            return_value=FakeMem0Module,
        ):
            service = Mem0PresentationMemoryService()
            presentation_id = uuid.uuid4()

            asyncio.run(
                service.store_generated_outlines(
                    presentation_id,
                    {"slides": [{"content": "One"}]},
                )
            )

            client = FakeMemoryClient.instances[0]
            client.next_search_response = {
                "results": [
                    {"memory": "Memory A"},
                    {"memory": "Memory A"},
                    {"memory": "Memory B"},
                ]
            }

            context = asyncio.run(
                service.retrieve_context(
                    presentation_id=presentation_id,
                    query="change the conclusion",
                )
            )

        assert "Memory A" in context
        assert "Memory B" in context
        assert context.count("Memory A") == 1

        assert len(client.search_calls) == 1
        assert client.search_calls[0]["query"] == "change the conclusion"
        assert client.search_calls[0]["filters"] == {
            "user_id": f"presentation:{presentation_id}"
        }
        assert client.search_calls[0]["top_k"] == 5
