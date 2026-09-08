import asyncio
import base64
import uuid

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from api.v1.auth.context import reset_current_owner_id, set_current_owner_id
from api.v1.ppt.endpoints import files as files_endpoint
from api.v1.ppt.endpoints.files import (
    McpEncodedFileUpload,
    McpFilesUploadRequest,
    upload_files_for_mcp,
)


def _request(filename: str, content: bytes) -> McpFilesUploadRequest:
    return McpFilesUploadRequest(
        files=[
            McpEncodedFileUpload(
                filename=filename,
                content_base64=base64.b64encode(content).decode("ascii"),
            )
        ]
    )


def test_mcp_file_upload_returns_user_scoped_generation_paths(tmp_path, monkeypatch):
    monkeypatch.setattr(files_endpoint.TEMP_FILE_SERVICE, "base_dir", str(tmp_path))
    owner_id = uuid.uuid4()
    owner_token = set_current_owner_id(owner_id)
    try:
        response = asyncio.run(
            upload_files_for_mcp(_request("brief.txt", b"Quarterly launch brief"))
        )
    finally:
        reset_current_owner_id(owner_token)

    assert len(response.file_paths) == 1
    uploaded_path = response.file_paths[0]
    assert str(owner_id) in uploaded_path
    with open(uploaded_path, "rb") as uploaded_file:
        assert uploaded_file.read() == b"Quarterly launch brief"


def test_mcp_file_upload_rejects_invalid_base64():
    request = McpFilesUploadRequest(
        files=[McpEncodedFileUpload(filename="brief.txt", content_base64="not-base64")]
    )

    with pytest.raises(HTTPException, match="Invalid base64 content") as exc_info:
        asyncio.run(upload_files_for_mcp(request))

    assert exc_info.value.status_code == 400


def test_mcp_file_upload_reuses_file_type_validation(tmp_path, monkeypatch):
    monkeypatch.setattr(files_endpoint.TEMP_FILE_SERVICE, "base_dir", str(tmp_path))

    with pytest.raises(HTTPException, match="not accepted") as exc_info:
        asyncio.run(upload_files_for_mcp(_request("payload.exe", b"not allowed")))

    assert exc_info.value.status_code == 400


def test_mcp_file_upload_rejects_oversized_combined_payload(monkeypatch):
    monkeypatch.setattr(files_endpoint, "MCP_FILES_UPLOAD_MAX_BASE64_CHARS", 4)

    with pytest.raises(ValidationError, match="Combined file upload exceeds 100 MiB"):
        _request("brief.txt", b"five bytes")
