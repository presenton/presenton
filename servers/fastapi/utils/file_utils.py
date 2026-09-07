import os
import uuid
from typing import BinaryIO

from fastapi import UploadFile


def replace_file_name(filename: str, new_stem: str) -> str:
    _, ext = os.path.splitext(filename)
    return f"{new_stem}{ext}"


def get_file_name_with_random_uuid(file: str | UploadFile | BinaryIO) -> str:
    filename = None
    if getattr(file, "filename", None):
        filename = file.filename
    elif isinstance(file, str):
        filename = os.path.basename(file)
    else:
        filename = str(uuid.uuid4())

    return replace_file_name(filename, f"{os.path.splitext(filename)[0]}----{str(uuid.uuid4())}")


def get_original_file_name(file_path: str) -> str:
    base_name = os.path.basename(file_path)
    name = base_name.split("----")[0]
    ext = get_file_ext_or_none(base_name)
    return f"{name}{ext}"


def get_file_ext_or_none(filename: str) -> str | None:
    splitted = os.path.splitext(filename)
    if len(splitted) > 1:
        return splitted[-1]
    return None


def set_file_ext(file_path: str, ext: str) -> str:
    if get_file_ext_or_none(file_path):
        return f"{os.path.splitext(file_path)[0]}{ext}"
    return f"{file_path}{ext}"
