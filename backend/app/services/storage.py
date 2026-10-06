import httpx
import io
import uuid

import cloudinary
import cloudinary.uploader

from app.core.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)


def upload_image(data: bytes, user_id: int) -> tuple[str, str]:
    """Upload JPEG bytes to Cloudinary. Returns (public_url, public_id).

    The random file name makes the URL impossible to guess.
    """
    result = cloudinary.uploader.upload(
        io.BytesIO(data),
        folder=f"caption-generator/user_{user_id}",
        public_id=uuid.uuid4().hex,
        resource_type="image",
        overwrite=False,
    )
    return result["secure_url"], result["public_id"]


def delete_image(public_id: str) -> None:
    """Remove an image from Cloudinary."""
    cloudinary.uploader.destroy(public_id, resource_type="image")
    

def download_image(url: str) -> bytes:
    """Fetch a stored image back from Cloudinary (it is already small)."""
    response = httpx.get(url, timeout=15.0)
    response.raise_for_status()
    return response.content