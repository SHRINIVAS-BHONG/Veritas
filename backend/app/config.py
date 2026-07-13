from pydantic_settings import BaseSettings
from pydantic import Field
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Veritas LLM Evaluation Platform"
    
    # DB (Default to SQLite for local development, can override with PostgreSQL URL)
    DATABASE_URL: str = Field(default="sqlite:///./veritas.db", env="DATABASE_URL")
    
    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    
    # LLM APIs
    OPENAI_API_KEY: str | None = Field(default=None, env="OPENAI_API_KEY")
    ANTHROPIC_API_KEY: str | None = Field(default=None, env="ANTHROPIC_API_KEY")
    OLLAMA_BASE_URL: str = Field(default="http://localhost:11434", env="OLLAMA_BASE_URL")
    
    # System Under Test (SUT) Settings
    SUT_MODEL: str = Field(default="gpt-4o-mini", env="SUT_MODEL")
    
    # LLM Judge Settings
    JUDGE_MODEL: str = Field(default="gpt-4o-mini", env="JUDGE_MODEL")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
