from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.core.config import get_settings
from app.models.schemas import DetectionResult


def create_pdf_report(result: DetectionResult) -> str:
    settings = get_settings()
    report_dir = Path(settings.report_dir)
    report_dir.mkdir(exist_ok=True)
    path = report_dir / f"{result.id}.pdf"
    c = canvas.Canvas(str(path), pagesize=letter)
    width, height = letter

    y = height - 72
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, y, "AI Detector Pro Report")
    y -= 36
    c.setFont("Helvetica", 11)
    lines = [
        f"Content type: {result.kind}",
        f"Verdict: {result.label}",
        f"Confidence: {result.confidence}%",
        f"AI probability: {result.breakdown.ai}%",
        f"Human probability: {result.breakdown.human}%",
    ]
    for line in lines:
        c.drawString(72, y, line)
        y -= 18

    y -= 12
    c.setFont("Helvetica-Bold", 12)
    c.drawString(72, y, "Explanation")
    y -= 20
    c.setFont("Helvetica", 10)
    for item in result.explanation:
        c.drawString(72, y, f"- {item[:95]}")
        y -= 16

    y -= 12
    c.setFont("Helvetica-Bold", 12)
    c.drawString(72, y, "Metrics")
    y -= 20
    c.setFont("Helvetica", 10)
    for key, value in result.metrics.items():
        if y < 72:
            c.showPage()
            y = height - 72
        c.drawString(72, y, f"{key}: {value}")
        y -= 16

    c.save()
    return str(path)
