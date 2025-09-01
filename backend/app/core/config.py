from pydantic import BaseModel
import os


class Settings(BaseModel):
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    MONGO_URI: str | None = os.getenv("MONGO_URI")
    MONGO_DB: str = os.getenv("MONGO_DB", "app")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRES_MINUTES: int = int(os.getenv("JWT_EXPIRES_MINUTES", "60"))

    # Optional external providers
    INFURA_KEY: str | None = os.getenv("INFURA_KEY")
    TATUM_API_KEY: str | None = os.getenv("TATUM_API_KEY")
    BLOCKCHAIR_API_KEY: str | None = os.getenv("BLOCKCHAIR_API_KEY")

    # Web cookie security
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"

    # Concurrency limits
    BLOCKCHAIR_MAX_CONCURRENCY: int = int(os.getenv("BLOCKCHAIR_MAX_CONCURRENCY", "8"))
    INFURA_MAX_CONCURRENCY: int = int(os.getenv("INFURA_MAX_CONCURRENCY", "8"))

    # Cache
    REDIS_URL: str | None = os.getenv("REDIS_URL")
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "300"))

    # Circuit breaker
    CIRCUIT_FAIL_MAX: int = int(os.getenv("CIRCUIT_FAIL_MAX", "5"))
    CIRCUIT_RESET_TIMEOUT: int = int(os.getenv("CIRCUIT_RESET_TIMEOUT", "60"))


settings = Settings()
