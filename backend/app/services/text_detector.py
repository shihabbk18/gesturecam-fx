from __future__ import annotations

import math
import re
import statistics
from collections import Counter
from uuid import uuid4

from app.models.schemas import DetectionResult, Highlight, ProbabilityBreakdown


AI_MARKERS = {
    "overall", "furthermore", "moreover", "delve", "underscores", "landscape",
    "robust", "seamless", "leverage", "nuanced", "pivotal", "realm",
}


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]


def _words(text: str) -> list[str]:
    return re.findall(r"[^\W\d_]+(?:'[^\W\d_]+)?", text.lower(), flags=re.UNICODE)


def _clamp(value: float, lo: float = 0, hi: float = 1) -> float:
    return max(lo, min(hi, value))


class TextDetector:
    """Lightweight ensemble that can run locally without model downloads.

    Production deployments can add transformer/perplexity providers behind this
    interface while preserving the API contract.
    """

    def analyze(self, text: str, language: str = "en") -> DetectionResult:
        sentences = _sentences(text)
        words = _words(text)
        word_count = len(words)
        unique_ratio = len(set(words)) / max(word_count, 1)
        lengths = [len(_words(s)) for s in sentences] or [0]
        avg_sentence = statistics.mean(lengths)
        burstiness = statistics.pstdev(lengths) if len(lengths) > 1 else 0
        burstiness_norm = _clamp(burstiness / 18)
        marker_hits = sum(1 for w in words if w in AI_MARKERS)
        marker_score = _clamp(marker_hits / max(word_count / 80, 1))
        repeated_bigrams = self._repeated_bigram_score(words)
        entropy = self._entropy(words)
        entropy_norm = _clamp(entropy / 9)

        # AI prose often has medium-high vocabulary entropy, low burstiness, and
        # repeated transitional language. These are weak signals, so combine them.
        ai_score = (
            0.28 * (1 - burstiness_norm)
            + 0.18 * _clamp((avg_sentence - 12) / 18)
            + 0.18 * marker_score
            + 0.16 * repeated_bigrams
            + 0.12 * _clamp((0.72 - unique_ratio) / 0.35)
            + 0.08 * entropy_norm
        )
        ai_score = _clamp(ai_score)
        confidence = round(max(ai_score, 1 - ai_score) * 100, 1)
        label = "AI-generated" if ai_score >= 0.55 else "Likely human-written"

        highlights = self._highlights(sentences, words)
        explanation = [
            f"Sentence burstiness score: {burstiness:.2f}; lower variation can indicate generated prose.",
            f"Vocabulary uniqueness: {unique_ratio:.2f}; repetitive phrasing increases the AI score.",
            f"Detected {marker_hits} common AI-style marker words or phrases.",
            "Final score is an ensemble estimate, not proof of authorship.",
        ]

        return DetectionResult(
            id=str(uuid4()),
            kind="text",
            label=label,
            confidence=confidence,
            breakdown=ProbabilityBreakdown(
                human=round((1 - ai_score) * 100, 1),
                ai=round(ai_score * 100, 1),
                gpt_style=round(ai_score * 63, 1),
                claude_style=round(ai_score * 22, 1),
            ),
            explanation=explanation,
            highlights=highlights,
            metrics={
                "word_count": word_count,
                "sentence_count": len(sentences),
                "avg_sentence_length": round(avg_sentence, 2),
                "burstiness": round(burstiness, 2),
                "entropy": round(entropy, 2),
                "unique_ratio": round(unique_ratio, 3),
            },
        )

    def _repeated_bigram_score(self, words: list[str]) -> float:
        if len(words) < 4:
            return 0
        bigrams = list(zip(words, words[1:]))
        counts = Counter(bigrams)
        repeats = sum(count - 1 for count in counts.values() if count > 1)
        return _clamp(repeats / max(len(bigrams) / 20, 1))

    def _entropy(self, words: list[str]) -> float:
        total = len(words)
        if not total:
            return 0
        counts = Counter(words)
        return -sum((n / total) * math.log2(n / total) for n in counts.values())

    def _highlights(self, sentences: list[str], words: list[str]) -> list[Highlight]:
        highlights: list[Highlight] = []
        for sentence in sentences[:12]:
            sw = _words(sentence)
            marker_count = sum(1 for w in sw if w in AI_MARKERS)
            score = _clamp(marker_count / 3 + (len(sw) > 24) * 0.25)
            if score >= 0.25:
                highlights.append(
                    Highlight(
                        text=sentence[:280],
                        reason="Formal marker language or unusually uniform sentence shape",
                        score=round(score, 2),
                    )
                )
        return highlights[:6]
