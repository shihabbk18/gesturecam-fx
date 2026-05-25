# Implementation Guide

## Phase 1: Baseline MVP

1. Run the backend and frontend locally.
2. Paste text into the scanner and confirm the result panel updates.
3. Upload a TXT, Markdown, PDF, PNG, JPG, or WEBP file.
4. Download the PDF report from the result panel.
5. Use the history section to revisit earlier scans.

## Phase 2: Improve Text Detection

Add detector classes behind `TextDetector.analyze()`:

- Zero-shot classifier: use `facebook/bart-large-mnli` or a modern NLI model.
- Perplexity detector: compare perplexity under a small language model and normalize by language.
- Fine-tuned classifier: train RoBERTa/DeBERTa on a labeled AI-vs-human dataset.
- Stylometry: keep the current burstiness, entropy, repetition, and marker signals as explainability features.

The final score should be a weighted ensemble with calibration on a validation set.

## Phase 3: Improve Image Detection

Add detector classes behind `ImageDetector.analyze()`:

- CLIP or ResNet classifier fine-tuned on real-vs-generated images.
- Metadata/provenance checks with EXIF and C2PA.
- Third-party API integrations for Hive, Illuminarty, or Truepic.
- OCR pipeline that routes screenshot text into the text detector.

## Phase 4: Production Hardening

- Replace in-memory results with Postgres.
- Add Redis caching for repeated scans.
- Add file size validation and malware scanning.
- Add API rate limits.
- Add auth with Clerk, Auth.js, or Auth0.
- Add structured logs and tracing.
- Add CI that runs backend tests and frontend builds.

## Suggested Metrics

- Text AUROC and F1 by language.
- False-positive rate on human essays and non-native English writing.
- Image AUROC by generator family.
- Calibration error for confidence scores.
- Latency p50 and p95 by file type.
