from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, computed_field, field_validator


class ImageOut(BaseModel):
    id: int
    filename: str
    image_url: str
    width: int
    height: int
    generated_caption: Optional[str] = None
    edited_caption: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def final_caption(self) -> Optional[str]:
        """The caption to show: the user's edit if there is one, else the AI's."""
        return self.edited_caption or self.generated_caption


class ImageList(BaseModel):
    items: list[ImageOut]
    total: int
    skip: int
    limit: int


class CaptionUpdate(BaseModel):
    # Required, but may be null: null means "reset to the AI caption"
    edited_caption: Optional[str]

    @field_validator("edited_caption")
    @classmethod
    def clean_caption(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not 1 <= len(value) <= 500:
            raise ValueError("Caption must be between 1 and 500 characters")
        return value