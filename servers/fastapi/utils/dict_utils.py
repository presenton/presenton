from models.json_path_guide import DictGuide, JsonPathGuide, ListGuide


def get_dict_paths_with_key(data: dict, key: str) -> list[JsonPathGuide]:
    result = []

    def _find_paths(obj, current_path: list[DictGuide | ListGuide]):
        if isinstance(obj, dict):
            if key in obj:
                result.append(JsonPathGuide(guides=current_path.copy()))
            for k, v in obj.items():
                new_path = current_path + [DictGuide(key=k)]
                _find_paths(v, new_path)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                new_path = current_path + [ListGuide(index=i)]
                _find_paths(item, new_path)

    _find_paths(data, [])
    return result


def get_dict_at_path(data: dict, path: JsonPathGuide) -> dict:
    current = data
    for guide in path.guides:
        if isinstance(guide, DictGuide):
            current = current[guide.key]
        elif isinstance(guide, ListGuide):
            current = current[guide.index]
    return current


def set_dict_at_path(data: dict, path: JsonPathGuide, value: dict):
    current = data
    for guide in path.guides[:-1]:
        if isinstance(guide, DictGuide):
            current = current[guide.key]
        elif isinstance(guide, ListGuide):
            current = current[guide.index]

    if path.guides:
        final_guide = path.guides[-1]
        if isinstance(final_guide, DictGuide):
            current[final_guide.key] = value
        elif isinstance(final_guide, ListGuide):
            current[final_guide.index] = value


def deep_update(original: dict, updates: dict) -> dict:
    for key, value in updates.items():
        if key in original:
            if isinstance(original[key], dict) and isinstance(value, dict):
                deep_update(original[key], value)
            elif isinstance(original[key], list) and isinstance(value, list):
                if len(value) == 0:
                    continue
                elif len(value) == 1 and isinstance(value[0], dict):
                    if len(original[key]) > 0 and isinstance(original[key][0], dict):
                        deep_update(original[key][0], value[0])
                    else:
                        original[key][0] = value[0] if len(original[key]) > 0 else value[0]
                else:
                    min_length = min(len(original[key]), len(value))
                    for i in range(min_length):
                        if isinstance(original[key][i], dict) and isinstance(value[i], dict):
                            deep_update(original[key][i], value[i])
                        else:
                            original[key][i] = value[i]
            elif not isinstance(value, (dict, list)):
                original[key] = value
        else:
            if not isinstance(value, (dict, list)):
                original[key] = value
    return original


def has_more_than_n_keys(obj: dict[str, object], n: int) -> bool:
    i = 0
    for _ in obj.keys():
        i += 1
        if i > n:
            return True
    return False
