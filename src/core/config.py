from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "LLM Evaluation Platform"
    
    # PostgreSQL Database
    POSTGRES_USER: str = "veritas_user"
    POSTGRES_PASSWORD: str = "veritas_password"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "veritas_db"
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # GitHub OAuth
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    
    # Gemini AI
    GEMINI_API_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
