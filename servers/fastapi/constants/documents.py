PDF_MIME_TYPES = ["application/pdf"]
TEXT_MIME_TYPES = ["text/plain", "text/markdown", "text/x-markdown"]
POWERPOINT_TYPES = [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]
WORD_TYPES = [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]
SPREADSHEET_TYPES = ["text/csv", "application/csv"]


PNG_MIME_TYPES = ["image/png"]
JPEG_MIME_TYPES = ["image/jpeg"]
WEBP_MIME_TYPES = ["image/webp"]


UPLOAD_ACCEPTED_FILE_TYPES = (
    PDF_MIME_TYPES + TEXT_MIME_TYPES + POWERPOINT_TYPES + WORD_TYPES
)
