import os
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree


class OfficeDocumentError(Exception):
    pass


_DOCX_EXTENSIONS = {".docx", ".docm"}
_PPTX_EXTENSIONS = {".pptx", ".pptm"}
_XLSX_EXTENSIONS = {".xlsx", ".xlsm"}
_ODF_EXTENSIONS = {".odt", ".odp", ".ods"}
_TEXT_EXTENSIONS = {".csv", ".tsv"}
_UNSUPPORTED_LEGACY_EXTENSIONS = {".doc", ".ppt", ".xls", ".rtf"}


def _natural_key(value: str) -> list[object]:
    return [
        int(part) if part.isdigit() else part.lower()
        for part in re.split(r"(\d+)", value)
    ]


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _read_xml(archive: zipfile.ZipFile, member: str) -> ElementTree.Element:
    try:
        return ElementTree.fromstring(archive.read(member))
    except (KeyError, ElementTree.ParseError) as exc:
        raise OfficeDocumentError(f"Could not read {member}") from exc


def _text_nodes(root: ElementTree.Element) -> list[str]:
    return [
        value
        for element in root.iter()
        if _local_name(element.tag) == "t"
        and (value := (element.text or "").strip())
    ]


def _extract_docx(archive: zipfile.ZipFile) -> str:
    root = _read_xml(archive, "word/document.xml")
    paragraphs: list[str] = []
    for paragraph in root.iter():
        if _local_name(paragraph.tag) != "p":
            continue
        text = " ".join(_text_nodes(paragraph))
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def _extract_pptx(archive: zipfile.ZipFile) -> str:
    slide_members = sorted(
        (
            name
            for name in archive.namelist()
            if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
        ),
        key=_natural_key,
    )
    slides = [" ".join(_text_nodes(_read_xml(archive, member))) for member in slide_members]
    return "\n\n".join(slide for slide in slides if slide)


def _extract_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = _read_xml(archive, "xl/sharedStrings.xml")
    return [
        " ".join(_text_nodes(item))
        for item in root.iter()
        if _local_name(item.tag) == "si"
    ]


def _extract_xlsx(archive: zipfile.ZipFile) -> str:
    shared_strings = _extract_shared_strings(archive)
    sheet_members = sorted(
        (
            name
            for name in archive.namelist()
            if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name)
        ),
        key=_natural_key,
    )
    sheets: list[str] = []
    for member in sheet_members:
        root = _read_xml(archive, member)
        rows: list[str] = []
        for row in root.iter():
            if _local_name(row.tag) != "row":
                continue
            values: list[str] = []
            for cell in row:
                if _local_name(cell.tag) != "c":
                    continue
                cell_type = cell.attrib.get("t")
                if cell_type == "inlineStr":
                    value = " ".join(_text_nodes(cell))
                else:
                    raw_value = next(
                        (
                            (element.text or "").strip()
                            for element in cell
                            if _local_name(element.tag) == "v"
                        ),
                        "",
                    )
                    if cell_type == "s" and raw_value.isdigit():
                        index = int(raw_value)
                        value = (
                            shared_strings[index]
                            if index < len(shared_strings)
                            else raw_value
                        )
                    else:
                        value = raw_value
                if value:
                    values.append(value)
            if values:
                rows.append("\t".join(values))
        if rows:
            sheets.append("\n".join(rows))
    return "\n\n".join(sheets)


def _extract_odf(archive: zipfile.ZipFile) -> str:
    root = _read_xml(archive, "content.xml")
    values = [
        " ".join(text.strip() for text in element.itertext() if text.strip())
        for element in root.iter()
        if _local_name(element.tag) in {"p", "h"}
    ]
    return "\n".join(value for value in values if value)


def extract_office_document_text(file_path: str) -> str:
    extension = Path(file_path).suffix.lower()
    if extension in _TEXT_EXTENSIONS:
        with open(file_path, "r", encoding="utf-8", errors="replace") as file:
            return file.read()

    if extension in _UNSUPPORTED_LEGACY_EXTENSIONS:
        raise OfficeDocumentError(
            f"{extension} files require an external office conversion engine; "
            "save the document in a modern OOXML or OpenDocument format first"
        )

    try:
        with zipfile.ZipFile(file_path) as archive:
            if extension in _DOCX_EXTENSIONS:
                return _extract_docx(archive)
            if extension in _PPTX_EXTENSIONS:
                return _extract_pptx(archive)
            if extension in _XLSX_EXTENSIONS:
                return _extract_xlsx(archive)
            if extension in _ODF_EXTENSIONS:
                return _extract_odf(archive)
    except (OSError, zipfile.BadZipFile) as exc:
        raise OfficeDocumentError(
            f"Could not parse {os.path.basename(file_path)}"
        ) from exc

    raise OfficeDocumentError(f"Unsupported office document format: {extension}")
