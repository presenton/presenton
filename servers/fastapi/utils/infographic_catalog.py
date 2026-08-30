from copy import deepcopy
from typing import Any, Literal

InfographicType = Literal[
    "progress_bar",
    "gauge",
    "gantt",
    "timeline",
    "roadmap",
    "milestone_timeline",
    "staircase",
    "supply_chain",
    "stair_step_blocks",
    "maturity_model",
    "pillar_framework",
    "transformation_hub",
    "diagonal_circles",
    "risk_matrix",
    "chevron_process",
    "radial_cycle",
    "conversion_funnel",
    "pyramid",
    "segmented_wheel",
    "customer_journey",
    "before_after",
    "impact_effort_matrix",
    "comparison_matrix",
    "org_chart",
    "decision_tree",
    "mind_map",
]


def _item_example(heading: str, description: str) -> dict[str, str]:
    return {"heading": heading, "description": description}


_METER_FIELDS = ["min_value:number", "max_value:number", "value:number"]
_ITEM_FIELDS = [
    "items: array of {heading?, description?, label?, focus?, icon?}",
]


INFOGRAPHIC_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "type": "progress_bar",
        "name": "Progress bar",
        "category": "metric",
        "best_for": "One value measured against a minimum and maximum.",
        "required_data": _METER_FIELDS,
        "default_size": {"width": 420, "height": 74},
        "example_data": {"min_value": 0, "max_value": 100, "value": 68},
    },
    {
        "type": "gauge",
        "name": "Gauge",
        "category": "metric",
        "best_for": "A single KPI, score, or completion percentage.",
        "required_data": _METER_FIELDS,
        "default_size": {"width": 320, "height": 190},
        "example_data": {"min_value": 0, "max_value": 100, "value": 76},
    },
    {
        "type": "gantt",
        "name": "Gantt chart",
        "category": "plan",
        "best_for": "Tasks scheduled across named time periods.",
        "required_data": [
            "columns: array of {label}",
            "rows: array of {label, items:[{name,start:{column,offset},end:{column,offset}}]}",
        ],
        "default_size": {"width": 720, "height": 300},
        "example_data": {
            "columns": [{"label": "Q1"}, {"label": "Q2"}, {"label": "Q3"}],
            "rows": [
                {
                    "label": "Product",
                    "items": [
                        {
                            "name": "Build",
                            "start": {"column": 0, "offset": 0},
                            "end": {"column": 1, "offset": 1},
                        }
                    ],
                }
            ],
        },
    },
    {
        "type": "timeline",
        "name": "Timeline",
        "category": "sequence",
        "best_for": "A chronological sequence of events or phases.",
        "required_data": _ITEM_FIELDS,
        "default_size": {"width": 720, "height": 260},
        "example_data": {
            "items": [
                _item_example("Discover", "Research the opportunity."),
                _item_example("Launch", "Release to customers."),
            ]
        },
    },
    {
        "type": "roadmap",
        "name": "Roadmap",
        "category": "plan",
        "best_for": "A product or strategy plan progressing through phases.",
        "required_data": _ITEM_FIELDS,
        "default_size": {"width": 720, "height": 252},
        "example_data": {
            "items": [
                _item_example("Now", "Validate demand."),
                _item_example("Next", "Scale delivery."),
            ]
        },
    },
    {
        "type": "milestone_timeline",
        "name": "Milestone timeline",
        "category": "sequence",
        "best_for": "Important dated achievements and checkpoints.",
        "required_data": _ITEM_FIELDS,
        "default_size": {"width": 720, "height": 260},
        "example_data": {
            "items": [
                {"label": "Jan", "heading": "Kickoff"},
                {"label": "Apr", "heading": "Launch"},
            ]
        },
    },
    {
        "type": "staircase",
        "name": "Staircase",
        "category": "progression",
        "best_for": "Increasing levels, outcomes, or sequential advancement.",
        "required_data": _ITEM_FIELDS,
        "default_size": {"width": 720, "height": 340},
        "example_data": {
            "items": [
                _item_example("Start", "Build the foundation."),
                _item_example("Scale", "Expand repeatably."),
            ]
        },
    },
    {
        "type": "supply_chain",
        "name": "Supply chain",
        "category": "process",
        "best_for": "A flow of materials, information, or value between stages.",
        "required_data": _ITEM_FIELDS,
        "default_size": {"width": 720, "height": 300},
        "example_data": {
            "items": [
                _item_example("Source", "Secure inputs."),
                _item_example("Deliver", "Reach customers."),
            ]
        },
    },
    {
        "type": "stair_step_blocks",
        "name": "Stair-step blocks",
        "category": "progression",
        "best_for": "A stepped capability or execution journey.",
        "required_data": _ITEM_FIELDS,
        "default_size": {"width": 720, "height": 350},
        "example_data": {
            "items": [
                _item_example("Foundation", "Standardize."),
                _item_example("Optimize", "Automate."),
            ]
        },
    },
    {
        "type": "maturity_model",
        "name": "Maturity model",
        "category": "progression",
        "best_for": "Capability levels from early-stage to advanced.",
        "required_data": _ITEM_FIELDS,
        "default_size": {"width": 720, "height": 390},
        "example_data": {
            "items": [
                _item_example("Reactive", "Ad hoc practices."),
                _item_example("Leading", "Continuously optimized."),
            ]
        },
    },
    {
        "type": "pillar_framework",
        "name": "Pillar framework",
        "category": "framework",
        "best_for": "Several strategic pillars supporting one shared ambition.",
        "required_data": ["title: string", *_ITEM_FIELDS],
        "default_size": {"width": 720, "height": 380},
        "example_data": {
            "title": "Growth Framework",
            "items": [
                {
                    "heading": "Customer",
                    "description": "Earn loyalty.",
                    "focus": "Experience",
                },
                {
                    "heading": "Product",
                    "description": "Create value.",
                    "focus": "Innovation",
                },
            ],
        },
    },
    {
        "type": "transformation_hub",
        "name": "Transformation hub",
        "category": "framework",
        "best_for": "Related workstreams orbiting a central transformation theme.",
        "required_data": ["center_label: string", *_ITEM_FIELDS],
        "default_size": {"width": 720, "height": 300},
        "example_data": {
            "center_label": "Transformation",
            "items": [
                {"heading": "People"},
                {"heading": "Process"},
                {"heading": "Technology"},
            ],
        },
    },
    {
        "type": "diagonal_circles",
        "name": "Diagonal circles",
        "category": "sequence",
        "best_for": "A bold rising sequence of connected ideas.",
        "required_data": _ITEM_FIELDS,
        "default_size": {"width": 720, "height": 430},
        "example_data": {
            "items": [
                _item_example("Signal", "See the change."),
                _item_example("Action", "Respond quickly."),
            ]
        },
    },
    {
        "type": "risk_matrix",
        "name": "Risk matrix",
        "category": "framework",
        "best_for": "A four-part risk-management cycle around a central label.",
        "required_data": ["center_label: string", "items: exactly four phase items"],
        "default_size": {"width": 720, "height": 370},
        "example_data": {
            "center_label": "RISK",
            "items": [
                {"heading": "Identify"},
                {"heading": "Prioritize"},
                {"heading": "Assess"},
                {"heading": "Respond"},
            ],
        },
    },
    {
        "type": "chevron_process",
        "name": "Chevron process",
        "category": "process",
        "best_for": "A directional multi-step operating process.",
        "required_data": _ITEM_FIELDS,
        "default_size": {"width": 720, "height": 340},
        "example_data": {
            "items": [
                _item_example("Plan", "Set direction."),
                _item_example("Deliver", "Execute the work."),
            ]
        },
    },
    {
        "type": "radial_cycle",
        "name": "Radial cycle",
        "category": "cycle",
        "best_for": "Recurring stages around an optional central image.",
        "required_data": ["center_image?: URL", *_ITEM_FIELDS],
        "default_size": {"width": 620, "height": 520},
        "example_data": {
            "center_image": None,
            "items": [
                {"heading": "Learn"},
                {"heading": "Build"},
                {"heading": "Measure"},
            ],
        },
    },
    {
        "type": "conversion_funnel",
        "name": "Conversion funnel",
        "category": "funnel",
        "best_for": "Stage-by-stage conversion values that usually narrow over time.",
        "required_data": [
            "items: array of {value:number, heading:string, description?}"
        ],
        "default_size": {"width": 720, "height": 380},
        "example_data": {
            "items": [
                {"value": 100, "heading": "Visitors"},
                {"value": 38, "heading": "Qualified"},
                {"value": 12, "heading": "Customers"},
            ]
        },
    },
    {
        "type": "pyramid",
        "name": "Pyramid",
        "category": "hierarchy",
        "best_for": "Layered priorities or foundations building toward an apex.",
        "required_data": _ITEM_FIELDS,
        "default_size": {"width": 720, "height": 430},
        "example_data": {
            "items": [
                {"heading": "Foundation"},
                {"heading": "Efficiency"},
                {"heading": "Innovation"},
            ]
        },
    },
    {
        "type": "segmented_wheel",
        "name": "Segmented wheel",
        "category": "cycle",
        "best_for": "Equal, connected dimensions of one operating model.",
        "required_data": _ITEM_FIELDS,
        "default_size": {"width": 720, "height": 520},
        "example_data": {
            "items": [
                {"heading": "Strategy"},
                {"heading": "People"},
                {"heading": "Systems"},
            ]
        },
    },
    {
        "type": "customer_journey",
        "name": "Customer journey",
        "category": "journey",
        "best_for": "Customer stages, touchpoints, or experience moments.",
        "required_data": ["start_color?: color", *_ITEM_FIELDS],
        "default_size": {"width": 720, "height": 420},
        "example_data": {
            "items": [
                {"heading": "Discover", "description": "Find the offer."},
                {"heading": "Adopt", "description": "Realize value."},
            ]
        },
    },
    {
        "type": "before_after",
        "name": "Before and after",
        "category": "comparison",
        "best_for": "Paired current-state and future-state comparisons.",
        "required_data": [
            "before_label: string",
            "after_label: string",
            "items: an even number of paired items",
        ],
        "default_size": {"width": 720, "height": 390},
        "example_data": {
            "before_label": "Before",
            "after_label": "After",
            "items": [
                {"heading": "Manual", "description": "Slow handoffs."},
                {"heading": "Automated", "description": "Fast workflows."},
            ],
        },
    },
    {
        "type": "impact_effort_matrix",
        "name": "Impact-effort matrix",
        "category": "matrix",
        "best_for": "Prioritizing initiatives by impact and effort.",
        "required_data": [
            "x_axis_label, y_axis_label, low_label, high_label: strings",
            "items: exactly four quadrant items",
        ],
        "default_size": {"width": 720, "height": 420},
        "example_data": {
            "x_axis_label": "Impact",
            "y_axis_label": "Effort",
            "low_label": "Low",
            "high_label": "High",
            "items": [
                {"heading": "Quick wins"},
                {"heading": "Strategic"},
                {"heading": "Deprioritize"},
                {"heading": "Fill-ins"},
            ],
        },
    },
    {
        "type": "comparison_matrix",
        "name": "Comparison matrix",
        "category": "comparison",
        "best_for": "Comparing options consistently across named criteria.",
        "required_data": [
            "criteria: array of strings",
            "items: array of {heading, values:string[]}",
        ],
        "default_size": {"width": 720, "height": 360},
        "example_data": {
            "criteria": ["Cost", "Speed"],
            "items": [
                {"heading": "Option A", "values": ["Low", "Fast"]},
                {"heading": "Option B", "values": ["High", "Moderate"]},
            ],
        },
    },
    {
        "type": "org_chart",
        "name": "Organization chart",
        "category": "hierarchy",
        "best_for": "Reporting lines and organizational structure.",
        "required_data": ["items: array of {id, parent_id?, heading, description?}"],
        "default_size": {"width": 720, "height": 420},
        "example_data": {
            "items": [
                {"id": "ceo", "parent_id": None, "heading": "CEO"},
                {"id": "product", "parent_id": "ceo", "heading": "Product"},
            ]
        },
    },
    {
        "type": "decision_tree",
        "name": "Decision tree",
        "category": "hierarchy",
        "best_for": "Branching decisions, options, and outcomes.",
        "required_data": ["items: array of {id, parent_id?, heading, description?}"],
        "default_size": {"width": 720, "height": 430},
        "example_data": {
            "items": [
                {"id": "start", "parent_id": None, "heading": "Proceed?"},
                {"id": "yes", "parent_id": "start", "heading": "Launch"},
            ]
        },
    },
    {
        "type": "mind_map",
        "name": "Mind map",
        "category": "hierarchy",
        "best_for": "Nested ideas branching from a central theme.",
        "required_data": [
            "items: recursive array of {heading?, description?, items:[]}"
        ],
        "default_size": {"width": 720, "height": 430},
        "example_data": {
            "items": [
                {
                    "heading": "Growth",
                    "items": [
                        {"heading": "Product", "items": []},
                        {"heading": "Market", "items": []},
                    ],
                }
            ]
        },
    },
)


INFOGRAPHIC_BY_TYPE = {entry["type"]: entry for entry in INFOGRAPHIC_CATALOG}


def search_infographic_catalog(
    *, infographic_type: str | None = None, query: str | None = None
) -> list[dict[str, Any]]:
    if infographic_type is not None:
        entry = INFOGRAPHIC_BY_TYPE.get(infographic_type)
        return [deepcopy(entry)] if entry is not None else []

    normalized_query = (query or "").strip().casefold()
    matches = INFOGRAPHIC_CATALOG
    if normalized_query:
        matches = tuple(
            entry
            for entry in matches
            if normalized_query
            in " ".join(
                (
                    str(entry["type"]),
                    str(entry["name"]),
                    str(entry["category"]),
                    str(entry["best_for"]),
                )
            ).casefold()
        )
    return deepcopy(list(matches))


def infographic_default_size(infographic_type: InfographicType) -> dict[str, int]:
    return deepcopy(INFOGRAPHIC_BY_TYPE[infographic_type]["default_size"])


def normalize_infographic_data(
    infographic_type: InfographicType, data: dict[str, Any]
) -> dict[str, Any]:
    normalized = deepcopy(data)
    supplied_type = normalized.get("type")
    if supplied_type is not None and supplied_type != infographic_type:
        raise ValueError("data.type must match infographicType when it is supplied.")
    normalized["type"] = infographic_type

    if infographic_type in {"progress_bar", "gauge"}:
        values = [normalized.get(key) for key in ("min_value", "max_value", "value")]
        if any(
            isinstance(value, bool) or not isinstance(value, (int, float))
            for value in values
        ):
            raise ValueError(
                f"{infographic_type} requires numeric min_value, max_value, and value."
            )
        minimum, maximum, value = values
        if maximum <= minimum:
            raise ValueError("max_value must be greater than min_value.")
        if value < minimum or value > maximum:
            raise ValueError("value must be between min_value and max_value.")
        return normalized

    if infographic_type == "gantt":
        columns = normalized.get("columns")
        rows = normalized.get("rows")
        if not isinstance(columns, list) or not columns:
            raise ValueError("gantt requires a non-empty columns array.")
        if not all(
            isinstance(column, dict)
            and isinstance(column.get("label"), str)
            and bool(column["label"].strip())
            for column in columns
        ):
            raise ValueError("Every gantt column must contain a non-empty label.")
        if not isinstance(rows, list) or not rows:
            raise ValueError("gantt requires a non-empty rows array.")
        if not all(
            isinstance(row, dict)
            and isinstance(row.get("label"), str)
            and isinstance(row.get("items"), list)
            for row in rows
        ):
            raise ValueError("Every gantt row must contain label and items fields.")
        return normalized

    items = normalized.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError(f"{infographic_type} requires a non-empty items array.")

    required_strings: dict[str, tuple[str, ...]] = {
        "pillar_framework": ("title",),
        "transformation_hub": ("center_label",),
        "risk_matrix": ("center_label",),
        "before_after": ("before_label", "after_label"),
        "impact_effort_matrix": (
            "x_axis_label",
            "y_axis_label",
            "low_label",
            "high_label",
        ),
    }
    for field_name in required_strings.get(infographic_type, ()):
        value = normalized.get(field_name)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(
                f"{infographic_type} requires a non-empty {field_name} string."
            )

    if infographic_type in {"risk_matrix", "impact_effort_matrix"} and len(items) != 4:
        raise ValueError(f"{infographic_type} requires exactly four items.")
    if infographic_type == "before_after" and (len(items) < 2 or len(items) % 2):
        raise ValueError("before_after requires an even number of at least two items.")
    if infographic_type == "conversion_funnel" and not all(
        isinstance(item, dict)
        and isinstance(item.get("heading"), str)
        and not isinstance(item.get("value"), bool)
        and isinstance(item.get("value"), (int, float))
        for item in items
    ):
        raise ValueError(
            "Every conversion_funnel item requires a heading and numeric value."
        )
    if infographic_type == "comparison_matrix":
        criteria = normalized.get("criteria")
        if (
            not isinstance(criteria, list)
            or not criteria
            or not all(
                isinstance(criterion, str) and criterion.strip()
                for criterion in criteria
            )
        ):
            raise ValueError(
                "comparison_matrix requires a non-empty criteria string array."
            )
        if not all(
            isinstance(item, dict)
            and isinstance(item.get("heading"), str)
            and isinstance(item.get("values"), list)
            and len(item["values"]) == len(criteria)
            for item in items
        ):
            raise ValueError(
                "Every comparison_matrix item needs one value for each criterion."
            )
    if infographic_type in {"org_chart", "decision_tree"}:
        ids = [
            item.get("id")
            for item in items
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        ]
        if len(ids) != len(items) or len(set(ids)) != len(ids):
            raise ValueError(
                f"{infographic_type} requires a unique string id on every item."
            )
        known_ids = set(ids)
        if any(
            item.get("parent_id") is not None and item.get("parent_id") not in known_ids
            for item in items
        ):
            raise ValueError(
                f"Every {infographic_type} parent_id must reference another item id."
            )

    return normalized
