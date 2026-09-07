import asyncio
import uuid
from unittest.mock import patch

import services.mem0_oss_memory as mem0_oss
from services.chat.chat_memory_store import ChatMemoryStore


class FakeMemoryClient:
    instances: list["FakeMemoryClient"] = []

    def __init__(self, config=None):
        self.config = config
        self.add_calls = []
        self.search_calls = []
        self.get_all_calls = []
        self.next_search_response = {"results": []}
        self.next_get_all_response = {"results": []}
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

    def get_all(self, *args, **kwargs):
        self.get_all_calls.append(
            {
                "filters": kwargs.get("filters"),
                "user_id": kwargs.get("user_id"),
                "limit": kwargs.get("limit"),
            }
        )
        return self.next_get_all_response


def _mem0_oss_fresh() -> None:
    mem0_oss._shared_client = None  # type: ignore[attr-defined]
    mem0_oss._init_attempted = False  # type: ignore[attr-defined]


class TestChatMemoryStore:
    def setup_method(self):
        FakeMemoryClient.instances = []
        _mem0_oss_fresh()

    def test_store_chat_turn_uses_conversation_scoped_user_id(self):
        with (
            patch.dict(
                "os.environ",
                {
                    "MEM0_ENABLED": "true",
                    "MEM0_TOP_K": "4",
                    "MEM0_PRESENTATION_NAMESPACE_PREFIX": "presentation",
                    "APP_DATA_DIRECTORY": "/tmp/presenton-test",
                },
                clear=False,
            ),
            patch(
                "services.chat.chat_memory_store.get_shared_mem0_client",
                return_value=FakeMemoryClient.from_config(
                    {
                        "vector_store": {"provider": "qdrant", "config": {}},
                        "embedder": {"provider": "fastembed", "config": {}},
                    }
                ),
            ),
        ):
            store = ChatMemoryStore()
            presentation_id = uuid.uuid4()
            conversation_id = uuid.uuid4()

            asyncio.run(
                store.store_chat_turn(
                    presentation_id=presentation_id,
                    conversation_id=conversation_id,
                    user_message="Can you tighten slide 3?",
                    assistant_message="Yes, I can make it shorter.",
                )
            )

        assert len(FakeMemoryClient.instances) == 1
        client = FakeMemoryClient.instances[0]
        assert len(client.add_calls) == 1
        expected_user_id = f"presentation:{presentation_id}:conversation:{conversation_id}"
        assert client.add_calls[0]["user_id"] == expected_user_id
        assert client.add_calls[0]["infer"] is False
        payload = str(client.add_calls[0]["messages"][0]["content"])
        assert "[chat_turn]" in payload
        assert "user=Can you tighten slide 3?" in payload
        assert "assistant=Yes, I can make it shorter." in payload

    def test_retrieve_context_reads_only_conversation_scoped_user_id(self):
        with (
            patch.dict(
                "os.environ",
                {
                    "MEM0_ENABLED": "true",
                    "MEM0_TOP_K": "6",
                    "MEM0_PRESENTATION_NAMESPACE_PREFIX": "presentation",
                    "APP_DATA_DIRECTORY": "/tmp/presenton-test",
                },
                clear=False,
            ),
            patch(
                "services.chat.chat_memory_store.get_shared_mem0_client",
                return_value=FakeMemoryClient.from_config(
                    {
                        "vector_store": {"provider": "qdrant", "config": {}},
                        "embedder": {"provider": "fastembed", "config": {}},
                    }
                ),
            ),
        ):
            store = ChatMemoryStore()
            presentation_id = uuid.uuid4()
            conversation_id = uuid.uuid4()
            expected_user_id = f"presentation:{presentation_id}:conversation:{conversation_id}"

            asyncio.run(
                store.store_chat_turn(
                    presentation_id=presentation_id,
                    conversation_id=conversation_id,
                    user_message="First turn",
                    assistant_message="First answer",
                )
            )

            client = FakeMemoryClient.instances[0]
            client.next_search_response = {
                "results": [
                    {"memory": "Chat memory A"},
                    {"memory": "Chat memory A"},
                    {"memory": "Chat memory B"},
                ]
            }

            context = asyncio.run(
                store.retrieve_context(
                    presentation_id=presentation_id,
                    conversation_id=conversation_id,
                    query="What did we decide?",
                )
            )

        assert "Chat memory A" in context
        assert "Chat memory B" in context
        assert context.count("Chat memory A") == 1

        assert len(client.search_calls) == 1
        assert client.search_calls[0]["query"] == "What did we decide?"
        assert client.search_calls[0]["filters"] == {"user_id": expected_user_id}
        assert client.search_calls[0]["top_k"] == 6

    def test_load_history_reads_conversation_scoped_turns(self):
        with (
            patch.dict(
                "os.environ",
                {
                    "MEM0_ENABLED": "true",
                    "MEM0_PRESENTATION_NAMESPACE_PREFIX": "presentation",
                    "APP_DATA_DIRECTORY": "/tmp/presenton-test",
                },
                clear=False,
            ),
            patch(
                "services.chat.chat_memory_store.get_shared_mem0_client",
                return_value=FakeMemoryClient.from_config(
                    {
                        "vector_store": {"provider": "qdrant", "config": {}},
                        "embedder": {"provider": "fastembed", "config": {}},
                    }
                ),
            ),
        ):
            store = ChatMemoryStore()
            presentation_id = uuid.uuid4()
            conversation_id = uuid.uuid4()
            expected_user_id = f"presentation:{presentation_id}:conversation:{conversation_id}"

            asyncio.run(
                store.store_chat_turn(
                    presentation_id=presentation_id,
                    conversation_id=conversation_id,
                    user_message="Draft intro",
                    assistant_message="Updated intro done.",
                )
            )

            client = FakeMemoryClient.instances[0]
            client.next_get_all_response = {
                "results": [
                    {
                        "memory": (
                            "[chat_turn]\n"
                            "turn_created_at=2026-04-25T10:00:00+00:00\n"
                            "user=Draft intro\nassistant=Updated intro done."
                        ),
                        "created_at": "2026-04-25T10:00:01+00:00",
                    },
                    {
                        "memory": (
                            "[chat_turn]\n"
                            "turn_created_at=2026-04-25T10:01:00+00:00\n"
                            "user=Add roadmap\nassistant=Roadmap slide added."
                        ),
                        "created_at": "2026-04-25T10:01:01+00:00",
                    },
                ]
            }

            history = asyncio.run(
                store.load_history(
                    presentation_id=presentation_id,
                    conversation_id=conversation_id,
                )
            )

        assert history == [
            {"role": "user", "content": "Draft intro"},
            {"role": "assistant", "content": "Updated intro done."},
            {"role": "user", "content": "Add roadmap"},
            {"role": "assistant", "content": "Roadmap slide added."},
        ]

        assert len(client.get_all_calls) == 1
        assert client.get_all_calls[0]["filters"] == {"user_id": expected_user_id}
        assert client.get_all_calls[0]["limit"] >= 10
