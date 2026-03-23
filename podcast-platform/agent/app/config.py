import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://podcast:podcast@localhost:5432/podcast")

# S3-compatible storage (AWS S3 or Cloudflare R2)
S3_BUCKET = os.getenv("S3_BUCKET", "")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")  # None for AWS S3, set for R2
S3_PRESIGN_URL = os.getenv("S3_PRESIGN_URL")  # Public/CORS-enabled domain for browser uploads (e.g. https://pub-xxx.r2.dev)
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")

# CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
