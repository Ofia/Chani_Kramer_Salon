from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_JWT_SECRET: str
    ANTHROPIC_API_KEY: str = ""
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"


settings = Settings()
