import base64
import binascii
import os
from io import BytesIO
from typing import Annotated, List, Optional
from fastapi import APIRouter, Body, File, HTTPException, UploadFile
from pydantic import BaseModel, Field, model_validator

from constants.documents import UPLOAD_ACCEPTED_FILE_TYPES
from models.decomposed_file_info import DecomposedFileInfo
from services.temp_file_service import TEMP_FILE_SERVICE
from services.documents_loader import DocumentsLoader
import uuid
from utils.validators import validate_files

FILES_ROUTER = APIRouter(prefix="/files", tags=["Files"])

MCP_FILES_UPLOAD_MAX_TOTAL_BYTES = 100 * 1024 * 1024
MCP_FILES_UPLOAD_MAX_BASE64_CHARS = (
    4 * ((MCP_FILES_UPLOAD_MAX_TOTAL_BYTES + 2) // 3) + 4 * 32
)


class McpEncodedFileUpload(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_base64: str = Field(
        min_length=1,
        max_length=MCP_FILES_UPLOAD_MAX_BASE64_CHARS,
        description=(
            "Standard base64-encoded file contents. A host application's attachment "
            "ID or filename is not file content."
        ),
    )


class McpFilesUploadRequest(BaseModel):
    files: list[McpEncodedFileUpload] = Field(
        min_length=1,
        max_length=32,
        description=(
            "Reference documents or images to upload for presentation generation."
        ),
    )

    @model_validator(mode="after")
    def validate_combined_upload_size(self):
        encoded_size = sum(len(file.content_base64) for file in self.files)
        if encoded_size > MCP_FILES_UPLOAD_MAX_BASE64_CHARS:
            raise ValueError("Combined file upload exceeds 100 MiB")
        return self


class McpFilesUploadResponse(BaseModel):
    file_paths: list[str] = Field(
        min_length=1,
        description=(
            "Presenton-owned file paths. Pass this exact array as files to Standard "
            "or Smart presentation generation."
        ),
    )


def _decode_mcp_file(upload: McpEncodedFileUpload) -> bytes:
    try:
        content = base64.b64decode(upload.content_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid base64 content for '{upload.filename}'",
        ) from exc
    if len(content) > MCP_FILES_UPLOAD_MAX_TOTAL_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"'{upload.filename}' exceeds the allowed upload size",
        )
    return content


@FILES_ROUTER.post("/upload", response_model=List[str])
async def upload_files(files: Optional[List[UploadFile]]):
    if not files:
        raise HTTPException(400, "Documents are required")

    temp_dir = TEMP_FILE_SERVICE.create_temp_dir(str(uuid.uuid4()))

    validate_files(files, True, True, 100, UPLOAD_ACCEPTED_FILE_TYPES)

    temp_files: List[str] = []
    if files:
        for each_file in files:
            temp_path = TEMP_FILE_SERVICE.create_temp_file_path(
                each_file.filename, temp_dir
            )
            with open(temp_path, "wb") as f:
                content = await each_file.read()
                f.write(content)

            temp_files.append(temp_path)

    return temp_files


@FILES_ROUTER.post(
    "/mcp-upload",
    response_model=McpFilesUploadResponse,
    operation_id="mcp_files_upload",
)
async def upload_files_for_mcp(request: McpFilesUploadRequest):
    """Upload reference files through clients that cannot send multipart bodies."""
    decoded_files: list[tuple[McpEncodedFileUpload, bytes]] = []
    total_bytes = 0
    for encoded_file in request.files:
        content = _decode_mcp_file(encoded_file)
        total_bytes += len(content)
        if total_bytes > MCP_FILES_UPLOAD_MAX_TOTAL_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Combined file upload exceeds 100 MiB",
            )
        decoded_files.append((encoded_file, content))

    uploads = [
        UploadFile(
            file=BytesIO(content),
            filename=encoded_file.filename,
            size=len(content),
        )
        for encoded_file, content in decoded_files
    ]
    return McpFilesUploadResponse(file_paths=await upload_files(uploads))


@FILES_ROUTER.post("/decompose", response_model=List[DecomposedFileInfo])
async def decompose_files(
    file_paths: Annotated[List[str], Body(embed=True)],
    language: Annotated[Optional[str], Body()] = None,
):
    temp_dir = TEMP_FILE_SERVICE.create_temp_dir(str(uuid.uuid4()))
    resolved_file_paths = TEMP_FILE_SERVICE.resolve_existing_temp_paths(file_paths)

    txt_files = []
    other_files = []
    for file_path in resolved_file_paths:
        if file_path.endswith(".txt"):
            txt_files.append(file_path)
        else:
            other_files.append(file_path)

    documents_loader = DocumentsLoader(file_paths=other_files, presentation_language=language)
    await documents_loader.load_documents(temp_dir)
    parsed_documents = documents_loader.documents

    response = []
    for index, parsed_doc in enumerate(parsed_documents):
        file_path = TEMP_FILE_SERVICE.create_temp_file_path(
            f"{uuid.uuid4()}.txt", temp_dir
        )
        parsed_doc = parsed_doc.replace("<br>", "\n")
        with open(file_path, "w", encoding="utf-8") as text_file:
            text_file.write(parsed_doc)
        response.append(
            DecomposedFileInfo(
                name=os.path.basename(other_files[index]), file_path=file_path
            )
        )

    # Return the txt documents as it is
    for each_file in txt_files:
        response.append(
            DecomposedFileInfo(name=os.path.basename(each_file), file_path=each_file)
        )

    return response


@FILES_ROUTER.post("/update")
async def update_files(
    file_path: Annotated[str, Body()],
    file: Annotated[UploadFile, File()],
):
    validate_files(file, False, False, 100, UPLOAD_ACCEPTED_FILE_TYPES)
    await TEMP_FILE_SERVICE.update_temp_file_from_upload(file_path, file)

    return {"message": "File updated successfully"}
