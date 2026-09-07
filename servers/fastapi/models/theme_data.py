from pydantic import BaseModel


class ThemeData(BaseModel):
    primary: str
    background: str
    card: str
    stroke: str
    background_text: str
    primary_text: str
    graph_0: str
    graph_1: str
    graph_2: str
    graph_3: str
    graph_4: str
    graph_5: str
    graph_6: str
    graph_7: str
    graph_8: str
    graph_9: str


class PresentationThemeTextFont(BaseModel):
    name: str
    url: str


class PresentationThemeFonts(BaseModel):
    textFont: PresentationThemeTextFont


class PresentationThemeColors(ThemeData):
    pass


class PresentationThemeData(BaseModel):
    colors: PresentationThemeColors
    fonts: PresentationThemeFonts


class GeneratedColorPalette(BaseModel):
    primary: str
    background: str
    accent_1: str
    accent_2: str
    text_1: str
    text_2: str
    primary_variations: dict[str, str]
    background_variations: dict[str, str]
    accent_1_variations: dict[str, str]
    accent_2_variations: dict[str, str]
    primary_lightness: float
    background_lightness: float
    accent_1_lightness: float
    accent_2_lightness: float
    text_1_lightness: float
    text_2_lightness: float
