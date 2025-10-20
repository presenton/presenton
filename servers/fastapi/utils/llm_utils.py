"""
Utility functions for LLM operations.

This module provides helper functions for working with LLM APIs,
including schema preparation and processing.
"""

from typing import Optional
from utils.schema_utils import (
    flatten_json_schema,
    remove_titles_from_schema,
    simplify_schema_for_llm,
    simplify_nested_schemas,
    calculate_schema_depth,
)


def prepare_schema_for_llm(
    schema: dict,
    max_depth: int = 4,
    remove_constraints: bool = True,
    debug_log: bool = False,
    provider_name: Optional[str] = None,
) -> dict:
    """
    Prepare a JSON schema for LLM structured output by:
    1. Flattening $refs
    2. Removing titles
    3. Removing constraints that cause "too many states" (optional)
    4. Limiting nesting depth

    This function handles schema complexity issues that are common across
    multiple LLM providers (Google Gemini, OpenAI, Anthropic, etc.).

    Args:
        schema: The original JSON schema
        max_depth: Maximum allowed nesting depth (default 4)
            - Google: 4 (strict limit ~5)
            - OpenAI: 5 (moderate limits)
            - Anthropic: 5 (good schema support)
        remove_constraints: Whether to remove length/value constraints
            that can cause "too many states" errors
        debug_log: Whether to log debug information about schema depth
        provider_name: Optional provider name for debug logging

    Returns:
        Processed schema ready for LLM API

    Example:
        >>> schema = {
        ...     "type": "object",
        ...     "properties": {
        ...         "title": {"type": "string", "minLength": 3, "maxLength": 40}
        ...     }
        ... }
        >>> prepared = prepare_schema_for_llm(schema)
        >>> # Result: minLength and maxLength are removed
    """
    # 1. Flatten to inline all $refs
    flattened = flatten_json_schema(schema)

    # 2. Remove titles to reduce metadata
    without_titles = remove_titles_from_schema(flattened)

    # 3. Remove constraints that cause "too many states"
    if remove_constraints:
        without_constraints = simplify_schema_for_llm(without_titles)
    else:
        without_constraints = without_titles

    # 4. Limit depth
    processed = simplify_nested_schemas(without_constraints, max_depth=max_depth)

    # Debug logging
    if debug_log:
        depth = calculate_schema_depth(processed)
        provider_label = f" ({provider_name})" if provider_name else ""
        print(f"=== SCHEMA DEPTH{provider_label}: {depth} (max: {max_depth}) ===")
        if depth > max_depth:
            print(f"WARNING: Schema depth {depth} exceeds max depth {max_depth}!")

    return processed


# Provider-specific presets for common use cases
def prepare_schema_for_google(schema: dict, debug_log: bool = False) -> dict:
    """
    Prepare schema specifically for Google Gemini API.
    Google has the strictest limits (~5 depth, sensitive to constraints).
    """
    return prepare_schema_for_llm(
        schema,
        max_depth=4,
        remove_constraints=True,
        debug_log=debug_log,
        provider_name="Google",
    )


def prepare_schema_for_openai(schema: dict, debug_log: bool = False) -> dict:
    """
    Prepare schema specifically for OpenAI API.
    OpenAI has moderate limits on schema complexity.
    """
    return prepare_schema_for_llm(
        schema,
        max_depth=5,
        remove_constraints=True,
        debug_log=debug_log,
        provider_name="OpenAI",
    )


def prepare_schema_for_anthropic(schema: dict, debug_log: bool = False) -> dict:
    """
    Prepare schema specifically for Anthropic Claude API.
    Anthropic has good schema support but still benefits from simplification.
    """
    return prepare_schema_for_llm(
        schema,
        max_depth=5,
        remove_constraints=True,
        debug_log=debug_log,
        provider_name="Anthropic",
    )
