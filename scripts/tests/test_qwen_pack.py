import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parents[1]))

from build_qwen_pack import build_pack


def test_sense_choices_always_include_the_current_meaning(tmp_path: Path):
    poetry_root = tmp_path / "poetry"
    prose_root = tmp_path / "prose"
    words_root = tmp_path / "words"
    poetry_root.mkdir()
    prose_root.mkdir()
    words_root.mkdir()

    (poetry_root / "page-001.json").write_text(
        json.dumps({"pieces": [{"title": "测试篇", "segments": ["测试句"]}]}),
        encoding="utf-8",
    )
    (prose_root / "page-001.json").write_text(
        json.dumps({"pieces": [
            {"title": "马说", "segments": ["测试句"]},
            {"title": "岳阳楼记", "segments": ["测试句"]},
            {"title": "湖心亭看雪", "segments": ["测试句"]},
            {"title": "邹忌讽齐王纳谏", "segments": ["测试句"]},
        ]}),
        encoding="utf-8",
    )
    entries = []
    for index in range(1, 6):
        entries.append({
            "term": "比",
            "senses": [{
                "meaning": f"释义{index}",
                "sense_index": index,
                "examples": [{"text": f"例句{index}", "source": "测试", "tags": []}],
            }],
        })
    (words_root / "page-001.json").write_text(
        json.dumps({"page_number": 1, "entries": entries}),
        encoding="utf-8",
    )
    word_map = tmp_path / "word-map.json"
    word_map.write_text(json.dumps({"1": [1, 2, 3, 4, 5]}), encoding="utf-8")

    pack = build_pack(poetry_root, prose_root, [words_root], word_map)
    sense_cards = [card for card in pack["cards"] if card["kind"] == "sense-recall"]

    assert len(sense_cards) == 5
    assert all(len(card["options"]) == 4 for card in sense_cards)
    assert all(card["answer"] in card["options"] for card in sense_cards)
