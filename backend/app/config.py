"""TerraTrace Backend Configuration"""
import os
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    APP_NAME: str = "TerraTrace"
    APP_VERSION: str = "1.0.0"
    # Avoid collisions with hosting environments that use DEBUG for a release name.
    DEBUG: bool = Field(default=True, validation_alias="TERRATRACE_DEBUG")
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database
    DATABASE_URL: str = "sqlite:///./terratrace.db"
    
    # File storage
    UPLOAD_DIR: str = str(Path(__file__).parent.parent / "uploads")
    OUTPUT_DIR: str = str(Path(__file__).parent.parent / "outputs")
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    
    # Pipeline defaults
    ALIGNMENT_METHOD: str = "orb"  # orb or ecc
    MIN_ORB_MATCHES: int = 10
    SSIM_WINDOW_SIZE: int = 7
    CHANGE_THRESHOLD: float = 0.3
    MIN_REGION_AREA_PX: int = 50
    DEFAULT_GSD: float = 0.5  # meters/pixel
    
    # Classification
    MODEL_PATH: str = ""  # Path to trained CNN model (optional)

    # Optional Copernicus Data Space OAuth client for Sentinel Hub Process API.
    CDSE_CLIENT_ID: str = ""
    CDSE_CLIENT_SECRET: str = ""

    # Pixabay key is only used by the backend image-search proxy.
    PIXABAY_API_KEY: str = ""
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
