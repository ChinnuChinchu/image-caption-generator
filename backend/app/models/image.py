from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Image(Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    filename: Mapped[str] = mapped_column(String(255))
    # Where the image lives on Cloudinary
    image_url: Mapped[str] = mapped_column(String(500))
    public_id: Mapped[str] = mapped_column(String(255), unique=True)
    width: Mapped[int]
    height: Mapped[int]
    # Filled in by Module 4, so it is empty right after upload
    generated_caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    edited_caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    owner: Mapped["User"] = relationship(back_populates="images")