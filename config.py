from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Azure OpenAI
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_deployment_gpt4o: str = "gpt-4o"
    azure_openai_deployment_gpt4_32k: str = "gpt-4-32k"
    azure_openai_api_version: str = "2024-02-01"

    # Azure Cosmos DB
    cosmos_endpoint: str
    cosmos_key: str
    cosmos_database: str = "neurofocus"
    cosmos_container_preferences: str = "user_preferences"
    cosmos_container_sessions: str = "sessions"

    # Azure AD
    azure_tenant_id: str
    azure_client_id: str
    azure_client_secret: str

    # App
    secret_key: str
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
