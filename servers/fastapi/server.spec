# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_all, collect_submodules


def safe_collect_submodules(package_name):
    try:
        return collect_submodules(package_name)
    except Exception:
        return []


def safe_collect_all(package_name):
    try:
        return collect_all(package_name)
    except Exception:
        # Some optional packages are platform-dependent.
        return [], [], []


datas_fastembed, binaries_fastembed, hiddenimports_fastembed = safe_collect_all(
    "fastembed"
)
datas_fastembed_vs, binaries_fastembed_vs, hiddenimports_fastembed_vs = (
    safe_collect_all("fastembed_vectorstore")
)
datas_onnx, binaries_onnx, hiddenimports_onnx = safe_collect_all("onnxruntime")
datas_pptx, binaries_pptx, hiddenimports_pptx = safe_collect_all("pptx")
datas_docx2everything, binaries_docx2everything, hiddenimports_docx2everything = (
    safe_collect_all("docx2everything")
)
datas_greenlet, binaries_greenlet, hiddenimports_greenlet = safe_collect_all(
    "greenlet"
)

datas_spacy, binaries_spacy, hiddenimports_spacy = safe_collect_all("spacy")
datas_spacy_model, binaries_spacy_model, hiddenimports_spacy_model = (
    safe_collect_all("en_core_web_sm")
)

datas_fastembed_cache = (
    [("fastembed_cache", "fastembed_cache")] if os.path.isdir("fastembed_cache") else []
)

# mem0 validates vector store configs via dynamic __import__(mem0.configs.vector_stores.{provider});
# PyInstaller does not trace those. Embedder/vector classes are loaded by string path at runtime.
hiddenimports_mem0 = safe_collect_submodules("mem0.configs.vector_stores") + [
    "mem0.embeddings.fastembed",
    "mem0.llms.openai",
    "mem0.vector_stores.qdrant",
]

a = Analysis(
    ["server.py"],
    pathex=[],
    binaries=binaries_fastembed
    + binaries_fastembed_vs
    + binaries_onnx
    + binaries_pptx
    + binaries_docx2everything
    + binaries_greenlet
    + binaries_spacy
    + binaries_spacy_model,
    datas=[
        ("assets", "assets"),
        ("static", "static"),
        ("alembic", "alembic"),
    ]
    + datas_fastembed_cache
    + datas_fastembed
    + datas_fastembed_vs
    + datas_onnx
    + datas_pptx
    + datas_docx2everything
    + datas_greenlet
    + datas_spacy
    + datas_spacy_model,
    hiddenimports=[
        "aiosqlite",
        "alembic",
        "sqlite3",
        "numpy",
        "pandas",
        "greenlet",
        "greenlet._greenlet",
        "importlib.metadata",
    ]
    + hiddenimports_fastembed
    + hiddenimports_fastembed_vs
    + hiddenimports_onnx
    + hiddenimports_pptx
    + hiddenimports_docx2everything
    + hiddenimports_greenlet
    + hiddenimports_spacy
    + hiddenimports_spacy_model
    + hiddenimports_mem0,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="fastapi",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="fastapi",
)
