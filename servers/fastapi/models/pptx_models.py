from enum import Enum
from typing import Annotated, List, Literal, Optional
from annotated_types import Len
from pydantic import BaseModel
from pptx.util import Pt
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR_TYPE


class PptxBoxShapeEnum(Enum):
    RECTANGLE = "rectangle"
    CIRCLE = "circle"


class PptxObjectFitEnum(Enum):
    CONTAIN = "contain"
    COVER = "cover"
    FILL = "fill"


class PptxSpacingModel(BaseModel):
    top: int = 0
    bottom: int = 0
    left: int = 0
    right: int = 0

    @classmethod
    def all(cls, num: int):
        return PptxSpacingModel(top=num, left=num, bottom=num, right=num)


class PptxPositionModel(BaseModel):
    left: int = 0
    top: int = 0
    width: int = 0
    height: int = 0

    @classmethod
    def for_textbox(cls, left: int, top: int, width: int):
        return cls(left=left, top=top, width=width, height=100)

    def to_pt_list(self) -> List[int]:
        return [Pt(self.left), Pt(self.top), Pt(self.width), Pt(self.height)]

    def to_pt_xyxy(self) -> List[int]:
        return [
            Pt(self.left),
            Pt(self.top),
            Pt(self.left + self.width),
            Pt(self.top + self.height),
        ]


class PptxFontModel(BaseModel):
    name: str = "Inter"
    size: int = 16
    italic: bool = False
    color: str = "000000"
    font_weight: Optional[int] = 400
    underline: Optional[bool] = None
    strike: Optional[bool] = None


class PptxFillModel(BaseModel):
    color: str
    opacity: float = 1.0


class PptxStrokeModel(BaseModel):
    color: str
    thickness: float
    opacity: float = 1.0


class PptxShadowModel(BaseModel):
    radius: int
    offset: int = 0
    color: str = "000000"
    opacity: float = 0.5
    angle: int = 0


class PptxTextRunModel(BaseModel):
    text: str
    font: Optional[PptxFontModel] = None


class PptxParagraphModel(BaseModel):
    spacing: Optional[PptxSpacingModel] = None
    alignment: Optional[PP_ALIGN] = None
    font: Optional[PptxFontModel] = None
    line_height: Optional[float] = None
    text: Optional[str] = None
    text_runs: Optional[List[PptxTextRunModel]] = None


class PptxObjectFitModel(BaseModel):
    fit: Optional[PptxObjectFitEnum] = None
    focus: Optional[
        Annotated[List[Optional[float]], Len(min_length=2, max_length=2)]
    ] = None


class PptxPictureModel(BaseModel):
    is_network: bool
    path: str


class PptxShapeModel(BaseModel):
    shape_type: Literal["textbox", "autoshape", "picture", "connector"]


class PptxTextBoxModel(PptxShapeModel):
    shape_type: Literal["textbox"] = "textbox"
    margin: Optional[PptxSpacingModel] = None
    fill: Optional[PptxFillModel] = None
    position: PptxPositionModel
    text_wrap: bool = True
    paragraphs: List[PptxParagraphModel]


class PptxAutoShapeBoxModel(PptxShapeModel):
    shape_type: Literal["autoshape"] = "autoshape"
    type: MSO_AUTO_SHAPE_TYPE = MSO_AUTO_SHAPE_TYPE.RECTANGLE
    margin: Optional[PptxSpacingModel] = None
    fill: Optional[PptxFillModel] = None
    stroke: Optional[PptxStrokeModel] = None
    shadow: Optional[PptxShadowModel] = None
    position: PptxPositionModel
    text_wrap: bool = True
    border_radius: Optional[float] = None
    paragraphs: Optional[List[PptxParagraphModel]] = None


class PptxPictureBoxModel(PptxShapeModel):
    shape_type: Literal["picture"] = "picture"
    position: PptxPositionModel
    margin: Optional[PptxSpacingModel] = None
    clip: bool = True
    opacity: Optional[float] = None
    invert: bool = False
    border_radius: Optional[List[float]] = None
    shape: Optional[PptxBoxShapeEnum] = None
    object_fit: Optional[PptxObjectFitModel] = None
    picture: PptxPictureModel


class PptxConnectorModel(PptxShapeModel):
    shape_type: Literal["connector"] = "connector"
    type: MSO_CONNECTOR_TYPE = MSO_CONNECTOR_TYPE.STRAIGHT
    position: PptxPositionModel
    thickness: float = 0.5
    color: str = "000000"
    opacity: float = 1.0


class PptxSlideModel(BaseModel):
    background: Optional[PptxFillModel] = None
    note: Optional[str] = None
    shapes: List[
        PptxTextBoxModel
        | PptxAutoShapeBoxModel
        | PptxConnectorModel
        | PptxPictureBoxModel
    ]


class PptxPresentationModel(BaseModel):
    name: Optional[str] = None
    shapes: Optional[List[PptxShapeModel]] = None
    slides: List[PptxSlideModel]
