import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parents[1]))

from qwen_organize import build_page_payload, build_organize_prompt, parse_json_response


def test_word_table_payload_preserves_columns_and_page_text():
    payload = build_page_payload(
        source_name="words.pdf",
        page_number=1,
        page_text="1 比 靠近 其两膝相比者 各隐卷底衣褶中 核舟记",
        tables=[[["序号", "例词", "词义", "例句", "出处"], ["1", "比", "①靠近", "其两膝相比者", "核舟记"]]],
        document_type="word_table",
    )

    assert payload["page_number"] == 1
    assert payload["tables"][0][1][2] == "①靠近"
    assert payload["page_text"].startswith("1 比")


def test_prompt_forbids_inference_and_requires_examples():
    prompt = build_organize_prompt("word_table", 1)

    assert "不要推断" in prompt
    assert "examples" in prompt
    assert "source" in prompt


def test_parse_json_response_handles_fenced_json():
    result = parse_json_response("```json\n{\"page_number\": 1, \"entries\": []}\n```")

    assert result == {"page_number": 1, "entries": []}


def test_page_payload_keeps_expected_numbers_and_previous_context():
    payload = build_page_payload(
        "words.pdf", 24, "续表", [], "word_table",
        {"expected_numbers": [1, 2, 3], "previous_entries": [{"number": 1, "term": "之"}]},
    )

    assert payload["context"]["expected_numbers"] == [1, 2, 3]
    assert payload["context"]["previous_entries"][0]["term"] == "之"


def test_classic_prompt_separates_piece_titles_from_cover_and_grade_headers():
    prompt = build_organize_prompt("classic_text", 2)

    assert "古诗词背诵" in prompt
    assert "不能创建 piece" in prompt
    assert "只有页面明确出现的新篇名" in prompt
