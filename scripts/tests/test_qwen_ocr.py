import base64
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parents[1]))

from qwen_ocr import QwenOCRClient, build_ocr_prompt, parse_model_json


def test_prompt_requires_verbatim_blocks_without_inference():
    prompt = build_ocr_prompt("words.pdf", 3)

    assert "逐字" in prompt
    assert "不要推断" in prompt
    assert "page_number" in prompt
    assert "sense" in prompt


def test_parse_model_json_accepts_fenced_json():
    result = parse_model_json('```json\n{"page_number": 3, "blocks": []}\n```')

    assert result == {"page_number": 3, "blocks": []}


def test_client_builds_openai_compatible_image_request_without_logging_key():
    captured = {}

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": '{"page_number": 3, "blocks": []}'}}]}

    class FakeSession:
        def post(self, endpoint, headers, json, timeout):
            captured.update({"endpoint": endpoint, "headers": headers, "body": json, "timeout": timeout})
            return FakeResponse()

    client = QwenOCRClient("test-key", session=FakeSession())
    result = client.recognize_page(b"png-bytes", "words.pdf", 3)

    assert result["page_number"] == 3
    assert captured["endpoint"].endswith("/chat/completions")
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    content = captured["body"]["messages"][1]["content"]
    assert content[1]["type"] == "image_url"
    assert base64.b64encode(b"png-bytes").decode() in content[1]["image_url"]["url"]
