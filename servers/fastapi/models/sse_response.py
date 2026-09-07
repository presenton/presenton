import json

from pydantic import BaseModel


class SSEResponse(BaseModel):
    event: str
    data: str

    def to_string(self):
        return f"event: {self.event}\ndata: {self.data}\n\n"


class SSEStatusResponse(BaseModel):
    status: str

    def to_string(self):
        return SSEResponse(
            event="response", data=json.dumps({"type": "status", "status": self.status})
        ).to_string()


class SSETraceResponse(BaseModel):
    trace: object

    def to_string(self):
        return SSEResponse(
            event="response", data=json.dumps({"type": "trace", "trace": self.trace})
        ).to_string()


class SSEErrorResponse(BaseModel):
    detail: str
    source: str | None = None
    status_code: int | None = None
    error_type: str | None = None
    retryable: bool | None = None
    completed_slides: int | None = None
    total_slides: int | None = None

    def to_string(self):
        payload = {"type": "error", **self.model_dump(exclude_none=True)}
        return SSEResponse(event="response", data=json.dumps(payload)).to_string()


class SSECompleteResponse(BaseModel):
    key: str
    value: object

    def to_string(self):
        return SSEResponse(
            event="response",
            data=json.dumps({"type": "complete", self.key: self.value}),
        ).to_string()
