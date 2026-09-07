from pydantic import BaseModel


class DictGuide(BaseModel):
    key: str


class ListGuide(BaseModel):
    index: int


class JsonPathGuide(BaseModel):
    guides: list[DictGuide | ListGuide]
