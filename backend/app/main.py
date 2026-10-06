from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import auth, images
from app.core.config import settings
from app.db.session import get_db
from app.services import captioning


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once when the server starts: load the caption model
    captioning.load_captioner()
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# Let the React app (a different origin) call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["ETag"],
)

app.include_router(auth.router)
app.include_router(images.router)


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Confirms the API is running and can reach the database."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}