import mimetypes

from utils.mime_types import init_sandbox_safe_mimetypes


def test_init_sandbox_safe_mimetypes_does_not_read_system_files(monkeypatch):
    state = {
        "inited": mimetypes.inited,
        "_db": mimetypes._db,
        "suffix_map": mimetypes.suffix_map,
        "types_map": mimetypes.types_map,
        "encodings_map": mimetypes.encodings_map,
        "common_types": mimetypes.common_types,
        "knownfiles": mimetypes.knownfiles,
    }
    system_file = "/etc/apache2/mime.types"
    read_calls = []

    def fail_if_system_file_is_read(self, filename, strict=True):
        read_calls.append(filename)
        raise PermissionError(1, "Operation not permitted", filename)

    monkeypatch.setattr(mimetypes.os.path, "isfile", lambda _path: True)
    monkeypatch.setattr(mimetypes.MimeTypes, "read", fail_if_system_file_is_read)
    mimetypes.inited = False
    mimetypes._db = None
    mimetypes.knownfiles = [system_file]

    try:
        init_sandbox_safe_mimetypes()

        assert read_calls == []
        assert mimetypes.knownfiles == [system_file]
        assert mimetypes.guess_type("biohazard.svg")[0] == "image/svg+xml"
        assert mimetypes.guess_type("slide-font.woff2")[0] == "font/woff2"
        assert (
            mimetypes.guess_type("export.pptx")[0]
            == "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
    finally:
        for name, value in state.items():
            setattr(mimetypes, name, value)
