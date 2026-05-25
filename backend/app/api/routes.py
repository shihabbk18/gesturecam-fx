from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.models.schemas import DetectionResult, TextDetectionRequest
from app.services.file_parser import parse_upload
from app.services.image_detector import ImageDetector
from app.services.report_service import create_pdf_report
from app.services.text_detector import TextDetector

router = APIRouter()
text_detector = TextDetector()
image_detector = ImageDetector()
RESULTS: dict[str, DetectionResult] = {}


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/detect/text", response_model=DetectionResult)
def detect_text(payload: TextDetectionRequest) -> DetectionResult:
    result = text_detector.analyze(payload.text, payload.language)
    RESULTS[result.id] = result
    return result


@router.post("/detect/file", response_model=DetectionResult)
async def detect_file(file: UploadFile = File(...)) -> DetectionResult:
    kind, content = await parse_upload(file)
    if kind == "image":
        result = image_detector.analyze(content, file.filename or "upload")
    else:
        result = text_detector.analyze(str(content))
    RESULTS[result.id] = result
    return result


@router.get("/report/{result_id}")
def report(result_id: str) -> FileResponse:
    if result_id not in RESULTS:
        raise HTTPException(status_code=404, detail="Result not found. Reports are available for scans created during this API session.")
    result = RESULTS[result_id]
    path = create_pdf_report(result)
    return FileResponse(path, media_type="application/pdf", filename=f"ai-detector-report-{result_id}.pdf")
