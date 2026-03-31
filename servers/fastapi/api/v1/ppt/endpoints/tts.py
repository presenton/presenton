import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from services.database import get_async_session
from services.tts_service import TTSService
from utils.get_env import get_camb_api_key_env

TTS_ROUTER = APIRouter(prefix="/tts", tags=["TTS"])

# Mapping from presentation language names to CAMB TTS language codes
LANGUAGE_TO_TTS_CODE = {
    "english": "en-us",
    "spanish": "es-es",
    "french": "fr-fr",
    "german": "de-de",
    "italian": "it-it",
    "portuguese": "pt-pt",
    "dutch": "nl-nl",
    "russian": "ru-ru",
    "japanese": "ja-jp",
    "korean": "ko-kr",
    "chinese": "zh-cn",
    "arabic": "ar-sa",
    "hindi": "hi-in",
    "turkish": "tr-tr",
    "polish": "pl-pl",
    "thai": "th-th",
    "vietnamese": "vi-vn",
    "indonesian": "id-id",
    "czech": "cs-cz",
    "romanian": "ro-ro",
    "ukrainian": "uk-ua",
    "greek": "el-gr",
    "finnish": "fi-fi",
    "tamil": "ta-in",
    "telugu": "te-in",
    "bengali": "bn-in",
    "marathi": "mr-in",
    "kannada": "kn-in",
    "malayalam": "ml-in",
    "punjabi": "pa-in",
}


def _resolve_language(language: Optional[str]) -> str:
    if not language:
        return "en-us"
    lang_lower = language.lower().strip()
    if lang_lower in LANGUAGE_TO_TTS_CODE:
        return LANGUAGE_TO_TTS_CODE[lang_lower]
    # If it already looks like a TTS code (e.g. "en-us"), pass through
    if "-" in lang_lower and len(lang_lower) <= 6:
        return lang_lower
    return "en-us"


@TTS_ROUTER.get("/status")
async def tts_status():
    """Check if TTS is available (CAMB_API_KEY is configured)."""
    return {"available": bool(get_camb_api_key_env())}


@TTS_ROUTER.post("/generate")
async def generate_tts_for_slide(
    slide_id: Annotated[uuid.UUID, Body()],
    voice_id: Annotated[Optional[int], Body()] = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    """Generate TTS audio for a slide's speaker note."""
    slide = await sql_session.get(SlideModel, slide_id)
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")

    if not slide.speaker_note or not slide.speaker_note.strip():
        raise HTTPException(status_code=400, detail="Slide has no speaker notes")

    presentation = await sql_session.get(PresentationModel, slide.presentation)
    language = _resolve_language(presentation.language if presentation else None)

    tts_service = TTSService()
    try:
        audio_path = await tts_service.generate_audio(
            text=slide.speaker_note.strip(),
            language=language,
            voice_id=voice_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    filename = audio_path.split("/")[-1]
    return {"audio_url": f"/app_data/audio/{filename}"}


@TTS_ROUTER.post("/generate-presentation")
async def generate_tts_for_presentation(
    presentation_id: Annotated[uuid.UUID, Body()],
    voice_id: Annotated[Optional[int], Body()] = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    """Generate TTS for all slides in a presentation that have speaker notes."""
    presentation = await sql_session.get(PresentationModel, presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    slides = list(
        await sql_session.scalars(
            select(SlideModel)
            .where(SlideModel.presentation == presentation_id)
            .order_by(SlideModel.index)
        )
    )
    if not slides:
        raise HTTPException(status_code=404, detail="No slides found")

    language = _resolve_language(presentation.language)
    tts_service = TTSService()
    results = []

    for slide in slides:
        if slide.speaker_note and slide.speaker_note.strip():
            try:
                audio_path = await tts_service.generate_audio(
                    text=slide.speaker_note.strip(),
                    language=language,
                    voice_id=voice_id,
                )
                filename = audio_path.split("/")[-1]
                results.append({
                    "slide_id": str(slide.id),
                    "slide_index": slide.index,
                    "audio_url": f"/app_data/audio/{filename}",
                })
            except Exception:
                results.append({
                    "slide_id": str(slide.id),
                    "slide_index": slide.index,
                    "audio_url": None,
                    "error": "Failed to generate audio",
                })
        else:
            results.append({
                "slide_id": str(slide.id),
                "slide_index": slide.index,
                "audio_url": None,
            })

    return results
