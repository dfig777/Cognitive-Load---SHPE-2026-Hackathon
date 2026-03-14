from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Azure OpenAI
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_deployment_gpt4o: str = "gpt-4o"
    azure_openai_api_version: str = "2024-02-01"

    # Azure Cosmos DB
    cosmos_endpoint: str
    cosmos_key: str
    cosmos_database: str = "neurofocus"
    cosmos_container_preferences: str = "user_preferences"
    cosmos_container_sessions: str = "sessions"

    # Azure AI Content Safety (optional — app degrades gracefully without it)
    content_safety_endpoint: Optional[str] = None
    content_safety_key: Optional[str] = None

    # Azure Blob Storage (optional — blob archival skipped if not configured)
    blob_connection_string: Optional[str] = None
    blob_container_name: str = "documents"

    # Azure AI Document Intelligence (optional — upload endpoint unavailable without it)
    doc_intelligence_endpoint: Optional[str] = None
    doc_intelligence_key: Optional[str] = None

    # Azure Monitor / Application Insights (optional — telemetry skipped if not set)
    app_insights_connection_string: Optional[str] = None

    # App
    allowed_origins: str = "http://localhost:5173"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
