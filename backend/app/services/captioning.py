import io
import logging
import threading
from typing import Optional, Protocol

from PIL import Image as PILImage

from app.core.config import settings

logger = logging.getLogger(__name__)


class CaptionUnavailableError(Exception):
    """The caption model is not loaded / not available."""


class Captioner(Protocol):
    """Anything that can turn image bytes into a caption."""

    def generate(self, image_bytes: bytes) -> str: ...


class LocalBlipCaptioner:
    """Runs the BLIP model inside this process (used in development)."""

    def __init__(self, model_name: str):
        # Imported here so the app can start without torch when a remote
        # captioner is used (e.g. on Render's small free server).
        import torch
        from transformers import BlipForConditionalGeneration, BlipProcessor

        logger.info("Loading BLIP model '%s' (first run downloads ~1 GB)...", model_name)
        self._torch = torch
        self.processor = BlipProcessor.from_pretrained(model_name)
        self.model = BlipForConditionalGeneration.from_pretrained(model_name)
        self.model.eval()  # inference mode
        self._lock = threading.Lock()  # one caption at a time
        logger.info("BLIP model ready")

    def generate(self, image_bytes: bytes) -> str:
        image = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")
        inputs = self.processor(images=image, return_tensors="pt")
        with self._lock, self._torch.no_grad():
            output_ids = self.model.generate(
                **inputs,
                max_new_tokens=30,
                num_beams=3,
                no_repeat_ngram_size=2,  # never repeat the same word pair
                repetition_penalty=1.3,  # discourage repeating words generally
            )
            # output_ids = self.model.generate(**inputs, max_new_tokens=30, num_beams=3)
        return self.processor.decode(output_ids[0], skip_special_tokens=True).strip()


_captioner: Optional[Captioner] = None


def load_captioner() -> None:
    """Called once at server start. A failure is logged, not fatal."""
    global _captioner
    try:
        if settings.CAPTION_BACKEND == "local":
            _captioner = LocalBlipCaptioner(settings.BLIP_MODEL_NAME)
        else:
            raise ValueError(
                f"Unsupported CAPTION_BACKEND '{settings.CAPTION_BACKEND}'"
            )
    except Exception:
        logger.exception("Caption model could not be loaded")
        _captioner = None


def generate_caption(image_bytes: bytes) -> str:
    if _captioner is None:
        raise CaptionUnavailableError()
    return _captioner.generate(image_bytes)