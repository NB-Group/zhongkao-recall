"""Build a reviewable content-pack candidate from Qwen page JSON outputs."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


def stable_id(prefix: str, *parts: str) -> str:
    import hashlib

    digest = hashlib.sha1("\x1f".join(parts).encode("utf-8")).hexdigest()[:12]
    return f"{prefix}:{digest}"


def load_pieces(root: Path) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for path in sorted(root.glob("page-*.json")):
        page = json.loads(path.read_text(encoding="utf-8"))
        for piece in page.get("pieces", []):
            title = str(piece.get("title", "")).strip()
            if not title or any(token in title for token in ("风华教育", "古诗词背诵", "文言文阅读", "第 ")):
                continue
            key = title
            current = merged.setdefault(
                key,
                {
                    "title": title,
                    "author": piece.get("author"),
                    "location": piece.get("location"),
                    "segments": [],
                    "sourcePages": [],
                },
            )
            if piece.get("author") and not current.get("author"):
                current["author"] = piece["author"]
            if piece.get("location") and current.get("location", "").startswith("新 6-9"):
                current["location"] = piece["location"]
            current["sourcePages"].append(page.get("page_number"))
            current["segments"].extend(piece.get("segments", []))
        for continuation in page.get("continuations", []):
            key = str(continuation.get("piece_title", "")).strip()
            if key in merged:
                merged[key]["segments"].extend(continuation.get("segments", []))
    return list(merged.values())


def add_explicit_prose_candidates(pieces: list[dict[str, Any]], prose_root: Path) -> list[dict[str, Any]]:
    existing = {piece["title"] for piece in pieces}
    candidates = {
        "马说": (12, "韩愈", "九年级上册"),
        "岳阳楼记": (12, "范仲淹", "九年级上册"),
        "湖心亭看雪": (13, "张岱", "九年级上册"),
        "邹忌讽齐王纳谏": (16, "刘向编纂", "九年级下册"),
    }
    for title, (page_number, author, location) in candidates.items():
        if title in existing:
            continue
        page_path = prose_root / f"page-{page_number:03d}.json"
        page = json.loads(page_path.read_text(encoding="utf-8"))
        evidence = str(page.get("evidence", {}).get("page_text", ""))
        marker = evidence.find(title)
        if marker < 0:
            continue
        following = evidence[marker + len(title):]
        next_title = re.search(r"\n(?:岳阳楼记|醉翁亭记|湖心亭看雪|鱼我所欲也|送东阳马生序|邹忌讽齐王纳谏|陈涉世家)\n", following)
        text = following[: next_title.start() if next_title else len(following)].strip()
        pieces.append({
            "title": title,
            "author": author,
            "location": location,
            "segments": [text],
            "sourcePages": [page_number],
            "sourceTags": ["qwen-page-organization", "candidate-title-review"],
        })
    return pieces


def load_word_senses(word_roots: list[Path], word_map_path: Path) -> list[dict[str, Any]]:
    expected_map = json.loads(word_map_path.read_text(encoding="utf-8"))
    function_terms = {1: "之", 2: "其", 3: "而", 4: "以", 5: "何", 6: "于"}
    senses: list[dict[str, Any]] = []
    for root in word_roots:
        for path in sorted(root.glob("page-*.json")):
            page_number = int(path.stem.split("-")[-1])
            page = json.loads(path.read_text(encoding="utf-8"))
            entries = page.get("entries", [])
            expected_numbers = expected_map.get(str(page_number), [])
            for index, entry in enumerate(entries):
                if index >= len(expected_numbers):
                    continue
                number = expected_numbers[index]
                is_function = page_number >= 23 and number <= 6
                term = function_terms[number] if is_function else str(entry.get("term", "")).strip()
                if not term:
                    continue
                previous = None
                for sense in entry.get("senses", []):
                    meaning = sense.get("meaning")
                    examples = sense.get("examples", [])
                    if not meaning and previous is not None:
                        previous["examples"].extend(examples)
                        continue
                    previous = {
                        "id": stable_id("sense", "qwen-2026.11.22", "function" if is_function else "real", str(number), term, str(sense.get("sense_index", 1)), str(page_number)),
                        "term": term,
                        "meaning": meaning,
                        "example": examples[0].get("text") if examples else None,
                        "source": examples[0].get("source") if examples else None,
                        "tags": sorted({tag for example in examples for tag in example.get("tags", [])}),
                        "number": number,
                        "senseIndex": sense.get("sense_index", 1),
                        "category": "function-word" if is_function else "real-word",
                        "sourcePages": [page_number],
                        "examples": list(examples),
                    }
                    senses.append(previous)
    return senses


def build_pack(poetry_root: Path, prose_root: Path, word_roots: list[Path], word_map_path: Path) -> dict[str, Any]:
    pieces = []
    segments = []
    for kind, root in (("poem", poetry_root), ("prose", prose_root)):
        prose_pieces = load_pieces(root)
        if kind == "prose":
            prose_pieces = add_explicit_prose_candidates(prose_pieces, root)
        for piece in prose_pieces:
            piece_id = stable_id("piece", "qwen-2026.11.22", kind, piece["title"])
            pieces.append({
                "id": piece_id,
                "kind": kind,
                "title": piece["title"],
                "author": piece.get("author"),
                "textbookLocation": piece.get("location"),
                "sourceTags": ["qwen-page-organization"],
            })
            for order, text in enumerate(piece.get("segments", [])):
                text = str(text).strip()
                if not text or text.startswith("第 "):
                    continue
                segments.append({
                    "id": stable_id("segment", piece_id, str(order), text[:40]),
                    "pieceId": piece_id,
                    "order": order,
                    "text": text,
                })

    senses = load_word_senses(word_roots, word_map_path)
    unique_senses = {sense["id"]: sense for sense in senses}
    cards = []
    for segment in segments:
        cards.append({
            "id": stable_id("card", "qwen-2026.11.22", segment["id"], "segment-continuation"),
            "kind": "segment-continuation",
            "pieceId": segment["pieceId"],
            "segmentId": segment["id"],
            "prompt": segment["text"].split("\n", 1)[0],
            "answer": segment["text"],
            "estimatedSeconds": 25,
        })
    for sense in unique_senses.values():
        cards.append({
            "id": stable_id("card", "qwen-2026.11.22", sense["id"], "sense-recall"),
            "kind": "sense-recall",
            "senseId": sense["id"],
            "context": sense["example"],
            "prompt": f"“{sense['term']}”在上面这句中的意思是？",
            "answer": sense["meaning"],
            "estimatedSeconds": 20,
        })
    return {
        "manifest": {
            "packId": "zhongkao-qwen-2026.11.22",
            "version": "2026.11.22",
            "title": "上海中考初中文言文与古诗词（Qwen 整理候选）",
            "counts": {
                "prosePieces": sum(1 for p in pieces if p["kind"] == "prose"),
                "poetryPieces": sum(1 for p in pieces if p["kind"] == "poem"),
                "wordSenses": len(unique_senses),
            },
        },
        "pieces": pieces,
        "segments": segments,
        "senses": [{key: value for key, value in sense.items() if key != "examples"} for sense in unique_senses.values()],
        "cards": cards,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--poetry", type=Path, required=True)
    parser.add_argument("--prose", type=Path, required=True)
    parser.add_argument("--words", type=Path, action="append", required=True)
    parser.add_argument("--word-map", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    pack = build_pack(args.poetry, args.prose, args.words, args.word_map)
    args.output.mkdir(parents=True, exist_ok=True)
    for key in ("pieces", "segments", "senses", "cards"):
        (args.output / f"{key}.json").write_text(json.dumps(pack[key], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (args.output / "manifest.json").write_text(json.dumps(pack["manifest"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(pack["manifest"], ensure_ascii=False))


if __name__ == "__main__":
    main()
