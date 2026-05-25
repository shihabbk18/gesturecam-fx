from __future__ import annotations

import io
import math
from uuid import uuid4

from PIL import Image, ImageChops, ImageFilter, ImageOps, ImageStat

from app.models.schemas import DetectionResult, ProbabilityBreakdown


def _clamp(value: float, lo: float = 0, hi: float = 1) -> float:
    return max(lo, min(hi, value))


class ImageDetector:
    def analyze(self, data: bytes, filename: str = "upload") -> DetectionResult:
        image = Image.open(io.BytesIO(data)).convert("RGB")
        width, height = image.size
        ela_score = self._error_level_score(image)
        smoothness = self._smoothness_score(image)
        metadata_score = 0.18 if not image.getexif() else 0
        symmetry_score = self._symmetry_score(image)

        ai_score = _clamp(
            0.36 * smoothness
            + 0.28 * ela_score
            + 0.18 * metadata_score
            + 0.18 * symmetry_score
        )
        confidence = round(max(ai_score, 1 - ai_score) * 100, 1)
        label = "AI-generated image" if ai_score >= 0.55 else "Likely camera or human-made image"

        return DetectionResult(
            id=str(uuid4()),
            kind="image",
            label=label,
            confidence=confidence,
            breakdown=ProbabilityBreakdown(
                human=round((1 - ai_score) * 100, 1),
                ai=round(ai_score * 100, 1),
                gpt_style=0,
                claude_style=0,
                image_generator_style=round(ai_score * 100, 1),
            ),
            explanation=[
                "Checked compression consistency, local texture smoothness, symmetry, and EXIF presence.",
                "AI image detection is strongest when paired with provenance APIs such as Hive or Truepic.",
                "This local detector is a portfolio-friendly baseline and should be calibrated with labeled data.",
            ],
            metrics={
                "filename": filename,
                "width": width,
                "height": height,
                "ela_score": round(ela_score, 3),
                "smoothness": round(smoothness, 3),
                "symmetry": round(symmetry_score, 3),
                "has_exif": bool(image.getexif()),
            },
        )

    def _error_level_score(self, image: Image.Image) -> float:
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=85)
        buffer.seek(0)
        compressed = Image.open(buffer).convert("RGB")
        diff = ImageChops.difference(image, compressed)
        stat = ImageStat.Stat(diff)
        rms = math.sqrt(sum(v * v for v in stat.rms) / 3)
        return _clamp((18 - rms) / 18)

    def _smoothness_score(self, image: Image.Image) -> float:
        small = image.resize((128, 128))
        edges = small.filter(ImageFilter.FIND_EDGES)
        stat = ImageStat.Stat(edges)
        edge_strength = sum(stat.mean) / 3
        return _clamp((34 - edge_strength) / 34)

    def _symmetry_score(self, image: Image.Image) -> float:
        small = image.resize((128, 128))
        mirrored = ImageOps.mirror(small)
        diff = ImageChops.difference(small, mirrored)
        stat = ImageStat.Stat(diff)
        rms = math.sqrt(sum(v * v for v in stat.rms) / 3)
        return _clamp((95 - rms) / 95)
