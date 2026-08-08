from services.chat.prompts import _trim_block, build_system_prompt


def test_trim_block_returns_empty_for_blank_text():
    assert _trim_block("label", "") == ""
    assert _trim_block("label", "   \n\t") == ""


def test_build_system_prompt_includes_trimmed_memory_blocks():
    system_prompt = build_system_prompt(
        presentation_memory_context="  Prior deck decision  ",
        chat_memory_context="\nEarlier user request\n",
    )

    assert "Deck memory (background only; may be partial or stale):" in system_prompt
    assert "Chat memory (earlier messages in this conversation):" in system_prompt
    assert "Common prompts" in system_prompt
    assert "If grouped text or elements still cannot be moved cleanly inside the group" in system_prompt
    assert "\nPrior deck decision\n" in system_prompt
    assert "\nEarlier user request\n" in system_prompt


def test_build_system_prompt_omits_empty_memory_blocks():
    system_prompt = build_system_prompt("", " ")

    assert "Deck memory (background only; may be partial or stale):" not in system_prompt
    assert "Chat memory (earlier messages in this conversation):" not in system_prompt
    assert "Tool Protocol" in system_prompt
    assert "getAvailableBlocks" in system_prompt


def test_system_prompt_preserves_existing_content_for_additive_edits():
    system_prompt = build_system_prompt("", "")

    assert "Treat add/insert/include requests as additive" in system_prompt
    assert "preserve existing substantive charts, tables, images, text, icons" in system_prompt
    assert "prioritize copying and adapting an existing block/component shape" in system_prompt
    assert "Use primitive elements only when the task cannot be achieved from existing blocks" in system_prompt
    assert "Treat existing template blocks as the default style source" in system_prompt
    assert "search for reusable title/header text blocks first" in system_prompt
    assert "Prefer this over fetching a whole layout or schema just to find one block" in system_prompt
    assert "For new table or chart requests, getAvailableBlocks is mandatory before inserting" in system_prompt
    assert "Do not use addElement to create a new table or chart while a reusable block exists" in system_prompt
    assert "Do not add primitive title, header, subtitle" in system_prompt
    assert "compose it from reusable blocks in this order: title/header block" in system_prompt
    assert "update or add only those requested text elements" in system_prompt
    assert "Use deleteElement, deleteComponent, or deleteSlide only when deletion is explicitly requested" in system_prompt


def test_system_prompt_uses_current_vector_and_infographic_models():
    system_prompt = build_system_prompt("", "")

    assert "Current rendered element types are" in system_prompt
    assert "Use type=\"vector\" for every line and geometric shape" in system_prompt
    assert "Do not emit the removed line, rectangle, ellipse, circle, polygon" in system_prompt
    assert "Vector points determine the actual geometry" in system_prompt
    assert "Use the current infographic model only" in system_prompt
    assert "Do not use removed infographic_type" in system_prompt
