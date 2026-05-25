from pydantic import BaseModel, Field


class Highlight(BaseModel):
    text: str
    reason: str
    score: float = Field(ge=0, le=1)


class ProbabilityBreakdown(BaseModel):
    human: float
    ai: float
    gpt_style: float
    claude_style: float
    image_generator_style: float = 0


class DetectionResult(BaseModel):
    id: str
    kind: str
    label: str
    confidence: float = Field(ge=0, le=100)
    breakdown: ProbabilityBreakdown
    explanation: list[str]
    highlights: list[Highlight] = []
    metrics: dict[str, float | int | str] = {}


class TextDetectionRequest(BaseModel):
    text: str = Field(min_length=10)
    language: str = "en"
