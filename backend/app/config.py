"""Application settings loaded from environment variables (see ../.env.example)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RADARSYNC_", env_file=".env", extra="ignore")

    environment: str = "development"
    # Comma-separated list of origins allowed to call the API (the Next.js dev server by default).
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
