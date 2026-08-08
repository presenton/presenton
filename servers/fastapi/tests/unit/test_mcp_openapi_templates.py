import json
from pathlib import Path

from constants.presentation import DEFAULT_TEMPLATES


def test_default_templates_match_supported_builtin_groups():
    assert DEFAULT_TEMPLATES == [
        "momentum",
        "dynamic",
        "executive",
        "general",
        "modern",
        "standard",
        "swift",
    ]


def test_openapi_exposes_template_catalog_and_schema_detail():
    openapi_spec_path = Path(__file__).resolve().parents[2] / "openai_spec.json"
    spec = json.loads(openapi_spec_path.read_text(encoding="utf-8"))

    list_operation = spec["paths"]["/api/v1/ppt/template/all"]["get"]
    detail_operation = spec["paths"]["/api/v1/ppt/template/{template_id}"]["get"]

    assert list_operation["operationId"] == "template_list"
    assert detail_operation["operationId"] == "template_get"
    default_filter = next(
        parameter
        for parameter in list_operation["parameters"]
        if parameter["name"] == "default"
    )
    assert default_filter["in"] == "query"
    assert {"type": "boolean"} in default_filter["schema"]["anyOf"]

    list_item = spec["components"]["schemas"]["TemplateListItem"]
    detail = spec["components"]["schemas"]["TemplateResponse"]
    assert "generation_template" not in list_item["properties"]
    assert "layouts" in detail["properties"]
    assert "merged_components" in detail["properties"]
    assert "fonts" in detail["properties"]
    assert "raw_layouts" not in detail["properties"]
    assert "components" not in detail["properties"]
    assert "assets" not in detail["properties"]
    assert "layout_schema" not in detail["properties"]


def test_openapi_prepare_returns_minimal_response():
    openapi_spec_path = Path(__file__).resolve().parents[2] / "openai_spec.json"
    spec = json.loads(openapi_spec_path.read_text(encoding="utf-8"))

    prepare_operation = spec["paths"]["/api/v1/ppt/presentation/prepare"]["post"]
    response_schema = prepare_operation["responses"]["200"]["content"][
        "application/json"
    ]["schema"]
    assert response_schema == {"$ref": "#/components/schemas/PresentationPrepareResponse"}

    prepare_response = spec["components"]["schemas"]["PresentationPrepareResponse"]
    assert set(prepare_response["properties"]) == {"presentation_id"}
