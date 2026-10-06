import logging
import os
import hashlib

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.image import Image
from app.models.user import User
from app.schemas.image import CaptionUpdate, ImageList, ImageOut
from app.services import captioning, storage,tts
from app.services.image_processing import ImageValidationError, process_image


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/images", tags=["Images"])


def get_owned_image(db: Session, image_id: int, user: User) -> Image:
    """Return the image if it belongs to the user, otherwise 404."""
    image = db.get(Image, image_id)
    if image is None or image.user_id != user.id:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.post("/upload", response_model=ImageOut, status_code=status.HTTP_201_CREATED)
def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Read at most limit + 1 bytes, so oversized files are rejected early
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    data = file.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large (maximum {settings.MAX_UPLOAD_MB} MB)",
        )
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        processed, width, height = process_image(data)
    except ImageValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        image_url, public_id = storage.upload_image(processed, current_user.id)
    except Exception:
        logger.exception("Cloudinary upload failed")
        raise HTTPException(status_code=502, detail="Image storage is unavailable")

    # Keep only the file name, never a path sent by the client
    name = os.path.basename((file.filename or "image").replace("\\", "/"))[:255]

    image = Image(
        user_id=current_user.id,
        filename=name or "image",
        image_url=image_url,
        public_id=public_id,
        width=width,
        height=height,
    )
    try:
        db.add(image)
        db.commit()
        db.refresh(image)
    except Exception:
        db.rollback()
        # Don't leave an orphan file on Cloudinary
        try:
            storage.delete_image(public_id)
        except Exception:
            logger.exception("Could not clean up Cloudinary image %s", public_id)
        raise HTTPException(status_code=500, detail="Could not save the image")

    return image

@router.post("/{image_id}/caption", response_model=ImageOut)
def generate_caption(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate (or regenerate) the AI caption for one of your images."""
    image = get_owned_image(db, image_id, current_user)

    try:
        data = storage.download_image(image.image_url)
    except Exception:
        logger.exception("Could not download image %s", image.id)
        raise HTTPException(status_code=502, detail="Could not fetch the image")

    try:
        caption = captioning.generate_caption(data)
    except captioning.CaptionUnavailableError:
        raise HTTPException(status_code=503, detail="Caption model is not available")
    except Exception:
        logger.exception("Caption generation failed for image %s", image.id)
        raise HTTPException(status_code=500, detail="Caption generation failed")

    if not caption:
        raise HTTPException(status_code=500, detail="No caption could be generated")

    image.generated_caption = caption
    image.edited_caption = None  # a fresh caption replaces any earlier edit
    db.commit()
    db.refresh(image)
    return image

@router.get("", response_model=ImageList)
def list_images(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Your uploads, newest first."""
    total = db.scalar(
        select(func.count()).select_from(Image).where(Image.user_id == current_user.id)
    )
    items = db.scalars(
        select(Image)
        .where(Image.user_id == current_user.id)
        .order_by(Image.created_at.desc(), Image.id.desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return ImageList(items=items, total=total, skip=skip, limit=limit)


@router.patch("/{image_id}/caption", response_model=ImageOut)
def update_caption(
    image_id: int,
    data: CaptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save your own caption, or send null to go back to the AI caption."""
    image = get_owned_image(db, image_id, current_user)
    image.edited_caption = data.edited_caption
    db.commit()
    db.refresh(image)
    return image

@router.get("/{image_id}/audio")
def get_caption_audio(
    image_id: int,
    request: Request,
    lang: str = Query("en", max_length=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Spoken (MP3) version of the image's final caption."""
    image = get_owned_image(db, image_id, current_user)

    text = image.edited_caption or image.generated_caption
    if not text:
        raise HTTPException(status_code=400, detail="This image has no caption yet")

    # The ETag changes whenever the text or language changes, so the browser
    # reuses its saved audio, but never plays a stale one after an edit.
    etag = '"' + hashlib.sha256(f"{lang}:{text}".encode("utf-8")).hexdigest()[:32] + '"'
    headers = {"ETag": etag, "Cache-Control": "private, no-cache"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)

    try:
        audio = tts.text_to_mp3(text, lang)
    except tts.UnsupportedLanguageError:
        raise HTTPException(status_code=400, detail="Unsupported language code")
    except tts.TTSError:
        logger.exception("Text-to-speech failed for image %s", image.id)
        raise HTTPException(
            status_code=502, detail="Text-to-speech service is unavailable"
        )

    return Response(content=audio, media_type="audio/mpeg", headers=headers)

@router.get("/{image_id}", response_model=ImageOut)
def get_image(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_owned_image(db, image_id, current_user)


@router.delete("/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(
    image_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    image = get_owned_image(db, image_id, current_user)

    try:
        storage.delete_image(image.public_id)
    except Exception:
        logger.exception("Cloudinary delete failed")
        raise HTTPException(status_code=502, detail="Image storage is unavailable")

    db.delete(image)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)