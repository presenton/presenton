import json
from pathlib import Path

from constants.presentation import DEFAULT_TEMPLATES


def test_default_templates_match_supported_builtin_groups():
    assert DEFAULT_TEMPLATES == [
        "general",
        "modern",
        "standard",
        "swift",
        "code",
        "education",
        "product-overview",
        "report",
        "pitch-deck",
        "neo-general",
        "neo-standard",
        "neo-modern",
        "neo-swift",
    ]


def test_openapi_templates_list_points_to_combined_template_endpoint():
    openapi_spec_path = Path(__file__).resolve().parents[2] / "openai_spec.json"
    spec = json.loads(openapi_spec_path.read_text(encoding="utf-8"))

    templates_path = spec["paths"]["/api/v1/ppt/template/all"]["get"]
    assert templates_path["operationId"] == "templates_list"

    include_defaults_param = next(
        p for p in templates_path["parameters"] if p["name"] == "include_defaults"
    )
    assert include_defaults_param["schema"]["default"] is True

    success_schema = templates_path["responses"]["200"]["content"]["application/json"][
        "schema"
    ]
    assert success_schema["items"]["$ref"] == "#/components/schemas/TemplateDetail"
