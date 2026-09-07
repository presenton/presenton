from templates.v2.content import hydrate_repeated_top_level_groups


def _repeated_groups():
    return [
        {
            "type": "group",
            "name": f"timeline_{index}",
            "position": {"x": index * 100, "y": index * 20},
            "children": [
                {
                    "type": "group",
                    "name": "timeline_items",
                    "children": [
                        {
                            "type": "image",
                            "decorative": True,
                            "name": "connector_branch_path",
                            "data": f"connector-{index}.svg",
                            "is_icon": False,
                        }
                    ],
                },
                {
                    "type": "group",
                    "name": "timeline_milestone",
                    "children": [
                        {
                            "type": "text",
                            "decorative": False,
                            "name": "milestone_title",
                            "min_length": 4,
                            "max_length": 20,
                        }
                    ],
                },
            ],
        }
        for index in (4, 5, 3, 1, 2)
    ]


def test_hydrate_repeated_top_level_groups_maps_items_to_whole_groups():
    elements = _repeated_groups()
    content = {
        "timeline": [
            {"timeline_milestone": {"milestone_title": title}}
            for title in ("First", "Second", "Third", "Fourth", "Fifth")
        ]
    }

    def apply_item(element, item):
        element["applied_title"] = item["timeline_milestone"]["milestone_title"]
        return element

    hydrated = hydrate_repeated_top_level_groups(
        elements,
        content,
        apply_item=apply_item,
    )

    assert hydrated is not None
    assert [element["name"] for element in hydrated] == [
        "timeline_4",
        "timeline_5",
        "timeline_3",
        "timeline_1",
        "timeline_2",
    ]
    assert [element["applied_title"] for element in hydrated] == [
        "First",
        "Second",
        "Third",
        "Fourth",
        "Fifth",
    ]
    assert [len(element["children"]) for element in hydrated] == [2] * 5
    assert hydrated[0]["children"][0]["children"][0]["data"] == "connector-4.svg"
    assert "applied_title" not in elements[0]


def test_hydrate_repeated_top_level_groups_centers_reduced_content():
    elements = _repeated_groups()
    content = {
        "timeline": [
            {"timeline_milestone": {"milestone_title": "Center lower"}},
            {"timeline_milestone": {"milestone_title": "Center upper"}},
        ]
    }

    hydrated = hydrate_repeated_top_level_groups(
        elements,
        content,
        apply_item=lambda element, _item: element,
    )

    assert hydrated is not None
    assert [element["name"] for element in hydrated] == [
        "timeline_5",
        "timeline_3",
    ]
