from pydantic import BaseModel


class OllamaModelMetadata(BaseModel):
    label: str
    value: str
    size: str
    tested: bool = True
