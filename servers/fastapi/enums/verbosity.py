from enum import Enum


class Verbosity(str, Enum):
    CONCISE = "concise"
    STANDARD = "standard"
    TEXT_HEAVY = "text-heavy"
