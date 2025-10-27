"""
Content summarization service for handling large documents.
Chunks and summarizes content that exceeds token limits.
"""
import re
from typing import List, Optional
from models.llm_message import LLMSystemMessage, LLMUserMessage
from services.llm_client import LLMClient
from utils.token_counter import count_tokens, truncate_to_token_limit
from utils.llm_provider import get_model


class ContentSummarizer:
    """
    Summarizes large content into presentation-friendly format.
    """

    def __init__(
        self,
        max_context_tokens: int = 20000,
        chunk_size_tokens: int = 8000,
        model: Optional[str] = None,
        use_llm_summarization: bool = False
    ):
        """
        Initialize the content summarizer.

        Args:
            max_context_tokens: Maximum tokens to include in final context
            chunk_size_tokens: Size of each chunk for processing
            model: LLM model to use for summarization
            use_llm_summarization: If False, use simple truncation instead of LLM
        """
        self.max_context_tokens = max_context_tokens
        self.chunk_size_tokens = chunk_size_tokens
        self.model = model or get_model()
        self.use_llm_summarization = use_llm_summarization

    def split_into_chunks(self, text: str, chunk_size: int) -> List[str]:
        """
        Split text into chunks by paragraphs, respecting token limits.

        Args:
            text: The text to split
            chunk_size: Target token size for each chunk

        Returns:
            List of text chunks
        """
        # Split by double newlines (paragraphs)
        paragraphs = re.split(r'\n\s*\n', text)

        chunks = []
        current_chunk = []
        current_tokens = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            para_tokens = count_tokens(para, self.model)

            # If single paragraph exceeds chunk size, split it
            if para_tokens > chunk_size:
                if current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                    current_chunk = []
                    current_tokens = 0

                # Split long paragraph by sentences
                sentences = re.split(r'(?<=[.!?])\s+', para)
                temp_chunk = []
                temp_tokens = 0

                for sentence in sentences:
                    sent_tokens = count_tokens(sentence, self.model)
                    if temp_tokens + sent_tokens > chunk_size:
                        if temp_chunk:
                            chunks.append(" ".join(temp_chunk))
                        temp_chunk = [sentence]
                        temp_tokens = sent_tokens
                    else:
                        temp_chunk.append(sentence)
                        temp_tokens += sent_tokens

                if temp_chunk:
                    chunks.append(" ".join(temp_chunk))

            # Normal paragraph processing
            elif current_tokens + para_tokens > chunk_size:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = [para]
                current_tokens = para_tokens
            else:
                current_chunk.append(para)
                current_tokens += para_tokens

        # Add remaining chunk
        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        return chunks

    async def summarize_chunk(
        self,
        chunk: str,
        context: str = "presentation content",
        n_slides: Optional[int] = None
    ) -> str:
        """
        Summarize a single chunk of content.

        Args:
            chunk: The text chunk to summarize
            context: Description of what this content is for
            n_slides: Target number of slides (helps guide summary length)

        Returns:
            Summarized text
        """
        system_prompt = f"""You are a presentation content summarizer.
Your task is to extract and condense the most important information from the provided text.

Guidelines:
- Focus on key facts, data, insights, and conclusions
- Preserve important numbers, statistics, and specific details
- Maintain logical flow and structure
- Remove redundant or less important information
- Keep the summary concise but informative
- Use bullet points and clear formatting
{"- Target approximately " + str(n_slides) + " main topics/themes" if n_slides else ""}

Output the summary in markdown format."""

        user_prompt = f"""Summarize the following content for a {context}:

{chunk}

Provide a concise summary that captures the essential information."""

        messages = [
            LLMSystemMessage(content=system_prompt),
            LLMUserMessage(content=user_prompt)
        ]

        client = LLMClient(model=self.model)

        try:
            summary = ""
            async for chunk_text in client.stream_text(messages=messages):
                summary += chunk_text

            return summary.strip()
        except Exception as e:
            # If summarization fails, truncate instead
            print(f"Summarization failed: {e}, falling back to truncation")
            return truncate_to_token_limit(
                chunk,
                self.chunk_size_tokens // 2,
                self.model
            )

    async def process_large_content(
        self,
        content: str,
        context: str = "presentation content",
        n_slides: Optional[int] = None
    ) -> str:
        """
        Process large content: chunk and summarize if needed.

        Args:
            content: The content to process
            context: Description of what this content is for
            n_slides: Target number of slides

        Returns:
            Processed content that fits within token limits
        """
        total_tokens = count_tokens(content, self.model)

        # If content fits, return as-is
        if total_tokens <= self.max_context_tokens:
            return content

        print(f"Content too large ({total_tokens} tokens), summarizing...")

        # Split into chunks
        chunks = self.split_into_chunks(content, self.chunk_size_tokens)
        print(f"Split into {len(chunks)} chunks")

        # Summarize each chunk
        summaries = []
        for i, chunk in enumerate(chunks):
            print(f"Summarizing chunk {i+1}/{len(chunks)}...")
            summary = await self.summarize_chunk(
                chunk,
                context,
                n_slides // len(chunks) if n_slides else None
            )
            summaries.append(summary)

        # Combine summaries
        combined = "\n\n---\n\n".join(summaries)
        combined_tokens = count_tokens(combined, self.model)

        # If combined summaries still too large, recursively summarize
        if combined_tokens > self.max_context_tokens:
            print(f"Combined summaries still large ({combined_tokens} tokens), recursing...")
            return await self.process_large_content(
                combined,
                context,
                n_slides
            )

        print(f"Content reduced from {total_tokens} to {combined_tokens} tokens")
        return combined

    async def summarize_if_needed(
        self,
        content: Optional[str],
        additional_context: Optional[str],
        n_slides: int
    ) -> tuple[Optional[str], Optional[str]]:
        """
        Summarize content and additional context if they exceed limits.

        Args:
            content: Main content
            additional_context: Additional context from uploaded files
            n_slides: Target number of slides

        Returns:
            Tuple of (processed_content, processed_additional_context)
        """
        processed_content = content
        processed_additional_context = additional_context

        # Check additional context first (usually the larger one)
        if additional_context:
            additional_tokens = count_tokens(additional_context, self.model)
            print(f"Additional context tokens: {additional_tokens}")
            if additional_tokens > self.max_context_tokens:
                if self.use_llm_summarization:
                    print(f"Using LLM summarization for additional context")
                    processed_additional_context = await self.process_large_content(
                        additional_context,
                        "uploaded document content",
                        n_slides
                    )
                else:
                    print(f"Truncating additional context from {additional_tokens} to {self.max_context_tokens} tokens")
                    processed_additional_context = truncate_to_token_limit(
                        additional_context,
                        self.max_context_tokens,
                        self.model,
                        preserve_start=True
                    )

        # Check main content
        if content:
            content_tokens = count_tokens(content, self.model)
            print(f"Main content tokens: {content_tokens}")
            if content_tokens > self.max_context_tokens // 2:
                if self.use_llm_summarization:
                    print(f"Using LLM summarization for main content")
                    processed_content = await self.process_large_content(
                        content,
                        "presentation topic",
                        n_slides
                    )
                else:
                    print(f"Truncating main content from {content_tokens} to {self.max_context_tokens // 2} tokens")
                    processed_content = truncate_to_token_limit(
                        content,
                        self.max_context_tokens // 2,
                        self.model,
                        preserve_start=True
                    )

        return processed_content, processed_additional_context
