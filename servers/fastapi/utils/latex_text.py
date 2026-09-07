from __future__ import annotations

import copy
from html.parser import HTMLParser
from typing import Any


class _LatexTagParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.runs: list[dict[str, str]] = []
        self._buffer: list[str] = []
        self._in_latex = False
        self.saw_latex = False
        self.invalid = False

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.casefold() != "latex":
            self._buffer.append(self.get_starttag_text() or f"<{tag}>")
            return
        if self._in_latex:
            self.invalid = True
            return
        self._flush()
        self._in_latex = True
        self.saw_latex = True

    def handle_startendtag(self, tag: str, attrs) -> None:
        self._buffer.append(self.get_starttag_text() or f"<{tag}/>")

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() != "latex":
            self._buffer.append(f"</{tag}>")
            return
        if not self._in_latex:
            self.invalid = True
            return
        self._flush()
        self._in_latex = False

    def handle_data(self, data: str) -> None:
        self._buffer.append(data)

    def handle_entityref(self, name: str) -> None:
        self._buffer.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self._buffer.append(f"&#{name};")

    def handle_comment(self, data: str) -> None:
        self._buffer.append(f"<!--{data}-->")

    def handle_decl(self, decl: str) -> None:
        self._buffer.append(f"<!{decl}>")

    def finish(self) -> list[dict[str, str]] | None:
        self.close()
        if self._in_latex:
            self.invalid = True
        self._flush()
        if self.invalid or not self.saw_latex:
            return None
        return self.runs

    def _flush(self) -> None:
        content = "".join(self._buffer)
        self._buffer.clear()
        if content == "":
            return
        if self._in_latex:
            latex = normalize_latex(content)
            if not latex:
                self.invalid = True
                return
            run = {"type": "latex", "latex": latex}
        else:
            run = {"text": content}

        if self.runs and _is_latex_run(self.runs[-1]) == _is_latex_run(run):
            key = "latex" if _is_latex_run(run) else "text"
            self.runs[-1][key] += run[key]
        else:
            self.runs.append(run)


def parse_latex_tags(value: str) -> list[dict[str, str]] | None:
    parser = _LatexTagParser()
    parser.feed(value)
    return parser.finish()


def replace_text_runs(
    existing_runs: Any,
    value: str,
    fallback_font: Any = None,
) -> list[dict[str, Any]]:
    parsed_runs = parse_latex_tags(value)
    templates = (
        [run for run in existing_runs if isinstance(run, dict)]
        if isinstance(existing_runs, list)
        else []
    )
    if parsed_runs is None:
        return [_replace_single_run(templates[0] if templates else None, value, fallback_font)]

    return [
        _build_parsed_run(
            parsed_run,
            _matching_template_run(templates, parsed_run, index),
            fallback_font,
        )
        for index, parsed_run in enumerate(parsed_runs)
    ]


def text_runs_to_tagged_text(runs: Any) -> str:
    if not isinstance(runs, list):
        return ""
    parts: list[str] = []
    for run in runs:
        if not isinstance(run, dict):
            continue
        if _is_latex_run(run):
            parts.append(f"<latex>{str(run.get('latex') or '')}</latex>")
        else:
            parts.append(str(run.get("text") or ""))
    return "".join(parts)


def normalize_latex(value: str) -> str:
    normalized = value.strip()
    if normalized.startswith("$$") and normalized.endswith("$$") and len(normalized) > 4:
        return normalized[2:-2].strip()[:4000]
    if normalized.startswith(r"\[") and normalized.endswith(r"\]") and len(normalized) > 4:
        return normalized[2:-2].strip()[:4000]
    return normalized[:4000]


def _replace_single_run(
    template: dict[str, Any] | None,
    value: str,
    fallback_font: Any,
) -> dict[str, Any]:
    run = copy.deepcopy(template) if isinstance(template, dict) else {}
    _apply_fallback_font(run, fallback_font)
    if _is_latex_run(run):
        run["latex"] = normalize_latex(value)
        run.pop("text", None)
    else:
        run["text"] = value
    return run


def _build_parsed_run(
    parsed_run: dict[str, str],
    template: dict[str, Any] | None,
    fallback_font: Any,
) -> dict[str, Any]:
    run = copy.deepcopy(template) if isinstance(template, dict) else {}
    _apply_fallback_font(run, fallback_font)
    if _is_latex_run(parsed_run):
        was_latex = _is_latex_run(run)
        run["type"] = "latex"
        run["latex"] = parsed_run["latex"]
        run.pop("text", None)
        if not was_latex:
            run["display_mode"] = False
    else:
        run.pop("type", None)
        run.pop("latex", None)
        run.pop("display_mode", None)
        run["text"] = parsed_run["text"]
    return run


def _matching_template_run(
    templates: list[dict[str, Any]],
    parsed_run: dict[str, str],
    index: int,
) -> dict[str, Any] | None:
    if index < len(templates) and _is_latex_run(templates[index]) == _is_latex_run(parsed_run):
        return templates[index]
    for template in templates:
        if _is_latex_run(template) == _is_latex_run(parsed_run):
            return template
    if index < len(templates):
        return templates[index]
    return templates[0] if templates else None


def _apply_fallback_font(run: dict[str, Any], fallback_font: Any) -> None:
    if isinstance(fallback_font, dict) and not isinstance(run.get("font"), dict):
        run["font"] = copy.deepcopy(fallback_font)


def _is_latex_run(run: dict[str, Any]) -> bool:
    return run.get("type") == "latex"
