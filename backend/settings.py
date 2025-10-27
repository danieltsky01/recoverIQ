from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", case_sensitive=False)

    api_title: str = "Hospital Debt Scoring API"
    debug: bool = True
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    firestore_project_id: str | None = None


settings = Settings()
