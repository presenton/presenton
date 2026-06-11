import logging
import os
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from utils.runtime_limits import log_memory


class DocumentConversionError(Exception):
    pass


LOGGER = logging.getLogger(__name__)


class DocumentConversionService:
    @staticmethod
    def _make_png_output_path(file_path: str, output_dir: str) -> Path:
        input_path = Path(file_path)
        output_path = Path(output_dir) / f"{input_path.stem}.png"

        try:
            if output_path.resolve() == input_path.resolve():
                output_path = Path(output_dir) / f"{input_path.stem}-converted.png"
        except OSError:
            pass

        if not output_path.exists():
            return output_path

        index = 1
        while True:
            candidate = Path(output_dir) / f"{input_path.stem}-{index}.png"
            if not candidate.exists():
                return candidate
            index += 1

    def convert_image_to_png(
        self,
        file_path: str,
        output_dir: str,
        timeout_seconds: int = 180,
    ) -> str:
        del timeout_seconds

        Path(output_dir).mkdir(parents=True, exist_ok=True)
        output_path = self._make_png_output_path(file_path, output_dir)

        try:
            LOGGER.info(
                "[DocumentConversion] Image conversion start input=%s output=%s",
                file_path,
                output_path,
            )
            log_memory(LOGGER, "document_conversion.image.start", input=file_path)

            with Image.open(file_path) as image:
                image.seek(0)
                converted = ImageOps.exif_transpose(image)

                if converted.mode in ("RGBA", "LA") or (
                    converted.mode == "P" and "transparency" in converted.info
                ):
                    rgba = converted.convert("RGBA")
                    background = Image.new("RGB", rgba.size, (255, 255, 255))
                    background.paste(rgba, mask=rgba.getchannel("A"))
                    converted = background
                elif converted.mode != "RGB":
                    converted = converted.convert("RGB")

                converted.save(output_path, format="PNG")

            LOGGER.info(
                "[DocumentConversion] Image conversion complete input=%s output=%s",
                file_path,
                output_path,
            )
            log_memory(LOGGER, "document_conversion.image.finish", input=file_path)
            return str(output_path)
        except (OSError, UnidentifiedImageError) as exc:
            LOGGER.error(
                "[DocumentConversion] Image conversion failed input=%s error=%s",
                file_path,
                exc,
            )
            raise DocumentConversionError(
                f"Image conversion failed for {os.path.basename(file_path)}: {exc}"
            ) from exc
