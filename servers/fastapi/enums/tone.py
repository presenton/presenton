from enum import Enum


class Tone(str, Enum):
    DEFAULT = "default"
    CASUAL = "casual"
    PROFESSIONAL = "professional"
    FUNNY = "funny"
    EDUCATIONAL = "educational"
    SALES_PITCH = "sales_pitch"
