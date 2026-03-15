import os
import boto3
from botocore.client import Config
from app.config import S3_BUCKET, S3_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY


def get_s3():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL or None,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


def upload_file(local_path: str, s3_key: str, content_type: str = "audio/mpeg") -> str:
    """Upload a local file to S3. Returns the s3_key."""
    s3 = get_s3()
    s3.upload_file(
        local_path,
        S3_BUCKET,
        s3_key,
        ExtraArgs={"ContentType": content_type},
    )
    return s3_key


def download_file(s3_key: str, local_path: str) -> None:
    """Download an S3 object to a local path."""
    s3 = get_s3()
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    s3.download_file(S3_BUCKET, s3_key, local_path)


def get_presigned_url(s3_key: str, expires: int = 3600) -> str:
    """Return a presigned GET URL for the given S3 key."""
    s3 = get_s3()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": s3_key},
        ExpiresIn=expires,
    )


def delete_file(s3_key: str) -> None:
    s3 = get_s3()
    s3.delete_object(Bucket=S3_BUCKET, Key=s3_key)
