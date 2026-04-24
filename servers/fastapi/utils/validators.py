from pathlib import Path
from typing import List
from fastapi import HTTPException

from fastapi import UploadFile


def _is_accepted_file_type(file: UploadFile, accepted_types: List[str]) -> bool:
    accepted_mime_types = {t.lower() for t in accepted_types if not t.startswith(".")}
    accepted_extensions = {t.lower() for t in accepted_types if t.startswith(".")}

    content_type = (file.content_type or "").strip().lower()
    if content_type in accepted_mime_types:
        return True

    extension = Path(file.filename or "").suffix.lower()
    if extension in accepted_extensions:
        return True

    return False


def validate_files(
    field,
    nullable: bool,
    multiple: bool,
    max_size: int,
    accepted_types: List[str],
):

    if field:
        files: List[UploadFile] = field if multiple else [field]
        for each_file in files:
            file_size = each_file.size or 0

            if (max_size * 1024 * 1024) < file_size:
                raise HTTPException(
                    400,
                    detail=f"File '{each_file.filename}' exceeded max upload size of {max_size} MB",
                )
            elif not _is_accepted_file_type(each_file, accepted_types):
                raise HTTPException(
                    400,
                    detail=f"File '{each_file.filename}' not accepted. Accepted types: {accepted_types}",
                )

    elif not (field or nullable):
        raise HTTPException(400, detail="File must be provided.")
