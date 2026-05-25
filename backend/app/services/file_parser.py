from __future__ import annotations

import io

from fastapi import HTTPException, UploadFile
from PIL import Image
from pypdf import PdfReader


IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
TEXT_TYPES = {"text/plain", "text/markdown", "application/pdf"}


async def parse_upload(file: UploadFile) -> tuple[str, str | bytes]:
    data = await file.read()
    content_type = file.content_type or ""

    if content_type in IMAGE_TYPES:
        try:
            Image.open(io.BytesIO(data)).verify()
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid image file") from exc
        return "image", data

    if content_type == "application/pdf" or (file.filename or "").lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        if not text.strip():
            raise HTTPException(status_code=400, detail="PDF did not contain extractable text")
        return "text", text

    if content_type in TEXT_TYPES or (file.filename or "").lower().endswith((".txt", ".md")):
        return "text", data.decode("utf-8", errors="ignore")

    raise HTTPException(status_code=415, detail="Supported uploads: TXT, MD, PDF, PNG, JPG, WEBP")
