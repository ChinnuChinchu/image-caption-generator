from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    
    # Caption generation: "local" runs BLIP inside this app.
    # ("remote" will call a Hugging Face Space - added in the deployment module)
    CAPTION_BACKEND: str = "local"
    BLIP_MODEL_NAME: str = "Salesforce/blip-image-captioning-base"
    
    # Which websites may call this API from a browser (comma-separated)
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    PROJECT_NAME: str = "Image Caption Generator"
    DATABASE_URL: str

    # Authentication
    SECRET_KEY: str  # long random string, kept in .env (never commit it)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Cloudinary (image storage) - from your Cloudinary dashboard
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    # Image upload rules
    MAX_UPLOAD_MB: int = 5
    MAX_IMAGE_SIDE: int = 1024  # longest side in pixels after resizing

    # Read values from environment variables, falling back to the .env file
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @field_validator("DATABASE_URL")
    @classmethod
    def use_psycopg2_driver(cls, v: str) -> str:
        # Render gives "postgres://..." and plain "postgresql://..." makes
        # newer SQLAlchemy pick the psycopg3 driver. We install psycopg2,
        # so always name that driver explicitly.
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg2://" + v[len(prefix):]
        return v


settings = Settings()