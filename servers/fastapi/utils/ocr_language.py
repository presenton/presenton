"""
Map presentation UI language strings (LanguageType enum values from Next.js) to
Tesseract / LiteParse OCR language codes (ISO 639-3 where applicable).

Keep keys in sync with:
servers/nextjs/app/(presentation-generator)/upload/type.ts → LanguageType
"""

from __future__ import annotations

import re
from typing import Optional

# Values must match `LanguageType` string literals in the upload UI.
PRESENTATION_LANGUAGE_TO_TESSERACT: dict[str, str] = {
    "English": "eng",
    "Spanish (Español)": "spa",
    "French (Français)": "fra",
    "German (Deutsch)": "deu",
    "Portuguese (Português)": "por",
    "Italian (Italiano)": "ita",
    "Dutch (Nederlands)": "nld",
    "Russian (Русский)": "rus",
    "Chinese (Simplified - 中文, 汉语)": "chi_sim",
    "Chinese (Traditional - 中文, 漢語)": "chi_tra",
    "Japanese (日本語)": "jpn",
    "Korean (한국어)": "kor",
    "Arabic (العربية)": "ara",
    "Hindi (हिन्दी)": "hin",
    "Bengali (বাংলা)": "ben",
    "Polish (Polski)": "pol",
    "Czech (Čeština)": "ces",
    "Slovak (Slovenčina)": "slk",
    "Hungarian (Magyar)": "hun",
    "Romanian (Română)": "ron",
    "Bulgarian (Български)": "bul",
    "Greek (Ελληνικά)": "ell",
    "Serbian (Српски / Srpski)": "srp",
    "Croatian (Hrvatski)": "hrv",
    "Bosnian (Bosanski)": "bos",
    "Slovenian (Slovenščina)": "slv",
    "Finnish (Suomi)": "fin",
    "Swedish (Svenska)": "swe",
    "Danish (Dansk)": "dan",
    "Norwegian (Norsk)": "nor",
    "Icelandic (Íslenska)": "isl",
    "Lithuanian (Lietuvių)": "lit",
    "Latvian (Latviešu)": "lav",
    "Estonian (Eesti)": "est",
    "Maltese (Malti)": "mlt",
    "Welsh (Cymraeg)": "cym",
    "Irish (Gaeilge)": "gle",
    "Scottish Gaelic (Gàidhlig)": "gla",
    "Ukrainian (Українська)": "ukr",
    "Hebrew (עברית)": "heb",
    "Persian/Farsi (فارسی)": "fas",
    "Turkish (Türkçe)": "tur",
    "Kurdish (Kurdî / کوردی)": "kmr",
    "Pashto (پښتو)": "pus",
    "Dari (دری)": "prs",
    "Uzbek (Oʻzbek)": "uzb",
    "Kazakh (Қазақша)": "kaz",
    "Tajik (Тоҷикӣ)": "tgk",
    "Turkmen (Türkmençe)": "tuk",
    "Azerbaijani (Azərbaycan dili)": "aze",
    "Urdu (اردو)": "urd",
    "Tamil (தமிழ்)": "tam",
    "Telugu (తెలుగు)": "tel",
    "Marathi (मराठी)": "mar",
    "Punjabi (ਪੰਜਾਬੀ / پنجابی)": "pan",
    "Gujarati (ગુજરાતી)": "guj",
    "Malayalam (മലയാളം)": "mal",
    "Kannada (ಕನ್ನಡ)": "kan",
    "Odia (ଓଡ଼ିଆ)": "ori",
    "Sinhala (සිංහල)": "sin",
    "Nepali (नेपाली)": "nep",
    "Thai (ไทย)": "tha",
    "Vietnamese (Tiếng Việt)": "vie",
    "Lao (ລາວ)": "lao",
    "Khmer (ភាសាខ្មែរ)": "khm",
    "Burmese (မြန်မာစာ)": "mya",
    "Tagalog/Filipino (Tagalog/Filipino)": "tgl",
    "Javanese (Basa Jawa)": "jav",
    "Sundanese (Basa Sunda)": "sun",
    "Malay (Bahasa Melayu)": "msa",
    "Mongolian (Монгол)": "mon",
    "Swahili (Kiswahili)": "swa",
    "Hausa (Hausa)": "hau",
    "Yoruba (Yorùbá)": "yor",
    "Igbo (Igbo)": "ibo",
    "Amharic (አማርኛ)": "amh",
    "Zulu (isiZulu)": "zul",
    "Xhosa (isiXhosa)": "xho",
    "Shona (ChiShona)": "sna",
    "Somali (Soomaaliga)": "som",
    "Basque (Euskara)": "eus",
    "Catalan (Català)": "cat",
    "Galician (Galego)": "glg",
    "Quechua (Runasimi)": "que",
    "Nahuatl (Nāhuatl)": "nah",
    "Hawaiian (ʻŌlelo Hawaiʻi)": "haw",
    "Maori (Te Reo Māori)": "mri",
    # No dedicated Tahitian traineddata in default Tesseract bundles.
    "Tahitian (Reo Tahiti)": "eng",
    "Samoan (Gagana Samoa)": "smo",
}

_LOWER_MAP = {k.lower(): v for k, v in PRESENTATION_LANGUAGE_TO_TESSERACT.items()}

_OCR_CODE_RE = re.compile(r"^[a-zA-Z0-9_,+]+$")


def presentation_language_to_ocr_code(language: Optional[str]) -> str:
    """Resolve UI language label to a Tesseract language code; default English."""
    if language is None:
        return "eng"
    s = str(language).strip()
    if not s:
        return "eng"
    if s in PRESENTATION_LANGUAGE_TO_TESSERACT:
        code = PRESENTATION_LANGUAGE_TO_TESSERACT[s]
    else:
        code = _LOWER_MAP.get(s.lower(), "eng")
    if not _OCR_CODE_RE.fullmatch(code):
        return "eng"
    return code
