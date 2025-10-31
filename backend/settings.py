from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List, Any, Union
import json


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="", case_sensitive=False)

    api_title: str = "Hospital Debt Scoring API"
    debug: bool = True
    cors_origins: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    firestore_project_id: str | None = None

    # Accept CORS_ORIGINS as either JSON (e.g., '["http://localhost:5173"]')
    # or a simple comma-separated string (e.g., 'http://a,http://b').
    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_before(cls, v: Any) -> Any:
        # Keep lenient: allow empty, JSON, or comma-separated
        if v is None or v == "":
            return None  # handled in post-init
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return None
            if s.startswith("["):
                try:
                    arr = json.loads(s)
                    if isinstance(arr, list):
                        return [str(x).strip() for x in arr if str(x).strip()]
                except Exception:
                    # fall through to comma-separated
                    pass
            return s  # handle comma-separated in post-init
        return v

    def model_post_init(self, __context: Any) -> None:  # pydantic v2
        # Normalize cors_origins to a list[str]
        defaults = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
        v = getattr(self, "cors_origins", None)
        if v is None:
            self.cors_origins = defaults
            return
        if isinstance(v, str):
            parts = [x.strip() for x in v.split(",") if x.strip()]
            self.cors_origins = parts or defaults
        elif isinstance(v, list):
            self.cors_origins = [str(x).strip() for x in v if str(x).strip()] or defaults


settings = Settings()
