from app.services.text_detector import TextDetector


def test_text_detector_returns_valid_result():
    text = "This product helps teams write reports. It has a clear workflow and useful review tools. People can change the final draft."
    result = TextDetector().analyze(text)
    assert result.kind == "text"
    assert 0 <= result.confidence <= 100
    assert result.metrics["word_count"] > 10
