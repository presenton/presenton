from pydantic import BaseModel


class OllamaModelStatus(BaseModel):
    name: str
    parameters: str | None = None
    size: int | None = None
    downloaded: int | None = None
    status: str
    done: bool
    error: str | None = None
