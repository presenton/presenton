"""
Utility for counting tokens in text content.
Provides approximate token counting without requiring tiktoken library.
"""
import re
from typing import Optional


def estimate_tokens(text: str) -> int:
    """
    Estimate the number of tokens in a text string.

    This is a simple approximation based on:
    - 1 token ≈ 4 characters for English text
    - 1 token ≈ 0.75 words on average

    For more accurate counting, install tiktoken library.

    Args:
        text: The text to count tokens for

    Returns:
        Estimated token count
    """
    if not text:
        return 0

    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text.strip())

    # Method 1: Character-based (1 token ≈ 4 chars)
    char_estimate = len(text) / 4

    # Method 2: Word-based (1 token ≈ 0.75 words)
    words = len(text.split())
    word_estimate = words / 0.75

    # Use the average of both methods for better accuracy
    return int((char_estimate + word_estimate) / 2)


def try_tiktoken_count(text: str, model: str = "gpt-4") -> Optional[int]:
    """
    Attempt to use tiktoken for accurate token counting.
    Falls back to estimation if tiktoken is not available.

    Args:
        text: The text to count tokens for
        model: The model name for encoding (default: gpt-4)

    Returns:
        Exact token count if tiktoken available, None otherwise
    """
    try:
        import tiktoken
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except ImportError:
        return None
    except Exception:
        return None


def count_tokens(text: str, model: str = "gpt-4") -> int:
    """
    Count tokens in text, using tiktoken if available, otherwise estimating.

    Args:
        text: The text to count tokens for
        model: The model name for encoding (default: gpt-4)

    Returns:
        Token count (exact if tiktoken available, estimated otherwise)
    """
    # Try exact counting first
    exact_count = try_tiktoken_count(text, model)
    if exact_count is not None:
        return exact_count

    # Fall back to estimation
    return estimate_tokens(text)


def truncate_to_token_limit(
    text: str,
    max_tokens: int,
    model: str = "gpt-4",
    preserve_start: bool = True
) -> str:
    """
    Truncate text to fit within a token limit.

    Args:
        text: The text to truncate
        max_tokens: Maximum number of tokens allowed
        model: The model name for encoding
        preserve_start: If True, keep the beginning; if False, keep the end

    Returns:
        Truncated text
    """
    current_tokens = count_tokens(text, model)

    if current_tokens <= max_tokens:
        return text

    # Calculate approximate character limit
    chars_per_token = len(text) / current_tokens
    target_chars = int(max_tokens * chars_per_token * 0.95)  # 95% to be safe

    if preserve_start:
        truncated = text[:target_chars]
    else:
        truncated = text[-target_chars:]

    return truncated
