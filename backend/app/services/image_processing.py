import io

import cv2
import numpy as np
from PIL import Image as PILImage
from PIL import UnidentifiedImageError

from app.core.config import settings

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MIN_SIDE = 32  # pixels
MAX_PIXELS = 25_000_000  # guards against huge "decompression bomb" images
JPEG_QUALITY = 85


class ImageValidationError(ValueError):
    """Raised when an uploaded file is not an acceptable image."""


def process_image(data: bytes) -> tuple[bytes, int, int]:
    """Validate an uploaded image, resize it and re-encode it as JPEG.

    Returns (jpeg_bytes, width, height).
    """
    # 1. Read only the file header with Pillow: gives the true format and
    #    size without decoding the whole image into memory.
    try:
        with PILImage.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            width, height = probe.size
    except (UnidentifiedImageError, OSError):
        raise ImageValidationError("File is not a valid image")

    if fmt not in ALLOWED_FORMATS:
        raise ImageValidationError("Only JPEG, PNG and WebP images are allowed")
    if min(width, height) < MIN_SIDE:
        raise ImageValidationError(f"Image is too small (minimum {MIN_SIDE}px)")
    if width * height > MAX_PIXELS:
        raise ImageValidationError("Image dimensions are too large")

    # 2. Decode with OpenCV (this also applies the EXIF rotation of phone photos)
    array = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ImageValidationError("Image file is corrupted")

    # 3. Shrink so the longest side is at most MAX_IMAGE_SIDE (never enlarge)
    h, w = image.shape[:2]
    longest = max(h, w)
    if longest > settings.MAX_IMAGE_SIDE:
        scale = settings.MAX_IMAGE_SIDE / longest
        image = cv2.resize(
            image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA
        )
        h, w = image.shape[:2]

    # 4. Re-encode as JPEG (this also strips metadata such as GPS location)
    ok, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    if not ok:
        raise ImageValidationError("Could not process the image")

    return buffer.tobytes(), w, h