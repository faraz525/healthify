from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path


# Ensure data directory exists
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)


class Settings(BaseSettings):
    app_name: str = "Healthify"
    database_url: str = f"sqlite:///{DATA_DIR}/healthify.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:4173"]

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
