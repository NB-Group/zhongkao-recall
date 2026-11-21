"""Normalize extracted textbook text into a versioned content pack."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Iterable


PAGE_MARKER = re.compile(r"^第\s*\d+\s*页\s*共\s*\d+\s*页$")
EMBEDDED_PAGE_MARKER = re.compile(r"=====\s*PAGE\s*\d+\s*=====")
GRADE_MARKER = re.compile(r"^(六|七|八|九)年级(上册|下册)$")
POETRY_SECTION = re.compile(r"^【(六|七|八|九)(上|下)】$")
AUTHOR_MARKER = re.compile(r"^(?:\[?(?:唐|宋|元|清)\]?|汉乐府|《古诗十九首》)")
WORD_NUMBER = re.compile(r"^(\d{1,3})\s+(.+)$")


def clean_lines(lines: Iterable[str]) -> list[str]:
    cleaned: list[str] = []

    for raw_line in lines:
        line = EMBEDDED_PAGE_MARKER.sub(" ", raw_line)
        line = line.replace("更多初中学习资料等你来领", " ")
        line = re.sub(r"\s+", " ", line).strip()
        if not line:
            continue
        if PAGE_MARKER.match(line):
            continue
        if "公众号：" in line or "咨询热线：" in line or "校区地址：" in line:
            continue
        if "风华教育语文必备手册" in line or line.startswith("PDCA"): 
            continue
        if line in {"文言文阅读", "古诗词背诵", "（6-9 年级）"}:
            continue
        cleaned.append(line)

    return cleaned


def stable_id(prefix: str, *parts: str) -> str:
    raw = "\x1f".join(parts)
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}:{digest}"


def split_segments(text: str, max_chars: int = 120) -> list[str]:
    sentences = [part.strip() for part in re.split(r"(?<=[。！？；])", text) if part.strip()]
    if not sentences:
        return [text.strip()] if text.strip() else []

    segments: list[str] = []
    current = ""
    for sentence in sentences:
        if current and len(current) + len(sentence) > max_chars:
            segments.append(current)
            current = ""
        current += sentence
    if current:
        segments.append(current)
    return segments


def parse_wenyan(text: str, pack_id: str) -> tuple[list[dict], list[dict]]:
    lines = clean_lines(text.splitlines())
    pieces: list[dict] = []
    segments: list[dict] = []
    current_location = ""
    current: dict | None = None

    def finish_piece() -> None:
        nonlocal current
        if current is None:
            return
        body = "".join(current.pop("_body", [])).strip()
        piece_id = stable_id("piece", pack_id, current["sourceKey"])
        piece = {
            "id": piece_id,
            "kind": "prose",
            "title": current["title"],
            "author": current.get("author"),
            "textbookLocation": current["textbookLocation"],
            "sourceTags": current["sourceTags"],
        }
        pieces.append(piece)
        for order, segment_text in enumerate(split_segments(body)):
            segments.append(
                {
                    "id": stable_id("segment", piece_id, str(order)),
                    "pieceId": piece_id,
                    "order": order,
                    "text": segment_text,
                }
            )
        current = None

    for index, line in enumerate(lines):
        if GRADE_MARKER.match(line):
            finish_piece()
            current_location = line
            continue
        if line.startswith("作者："):
            finish_piece()
            title = lines[index - 1] if index > 0 else "未命名篇目"
            author_match = re.search(r"作者：(.+?)(?:\s+出处：|\s+朝代：|$)", line)
            source_match = re.search(r"出处：(.+?)(?:\s+朝代：|$)", line)
            dynasty_match = re.search(r"朝代：(.+)$", line)
            current = {
                "title": title,
                "author": author_match.group(1).strip() if author_match else None,
                "sourceKey": f"{current_location}:{title}",
                "textbookLocation": current_location,
                "sourceTags": [current_location],
                "source": source_match.group(1).strip() if source_match else None,
                "dynasty": dynasty_match.group(1).strip() if dynasty_match else None,
                "_body": [],
            }
            continue
        if current is not None:
            current["_body"].append(line)

    finish_piece()
    return pieces, segments


def _poetry_title_author(line: str, next_line: str | None) -> tuple[str, str | None, bool] | None:
    if re.search(r"[，。！？；：]", line):
        return None
    if " / " in line:
        title, author = line.split(" / ", 1)
        return title.strip(), author.strip(), False
    same_line = re.search(r"(唐|宋|元|清)・([^\s]+)$", line)
    if same_line:
        return line[: same_line.start()].strip(), same_line.group(2).strip(), False
    if line.endswith("汉乐府"):
        return line[: -len("汉乐府")].strip(), "汉乐府", False
    if next_line and AUTHOR_MARKER.match(next_line):
        author = re.sub(r"^\[?(?:唐|宋|元|清)\]?\s*", "", next_line).strip()
        return line, author, True
    return None


def parse_poetry(text: str, pack_id: str) -> tuple[list[dict], list[dict]]:
    lines = clean_lines(text.splitlines())
    pieces: list[dict] = []
    segments: list[dict] = []
    current_section = ""
    current: dict | None = None
    skip_author_line = False

    def finish_piece() -> None:
        nonlocal current
        if current is None:
            return
        body = "\n".join(current.pop("_body", [])).strip()
        piece_id = stable_id("piece", pack_id, current["sourceKey"])
        pieces.append(
            {
                "id": piece_id,
                "kind": "poem",
                "title": current["title"],
                "author": current.get("author"),
                "textbookLocation": current_section,
                "sourceTags": [current_section],
            }
        )
        segment_lines = [line.strip() for line in body.splitlines() if line.strip()]
        for order, start in enumerate(range(0, len(segment_lines), 2)):
            segments.append(
                {
                    "id": stable_id("segment", piece_id, str(order)),
                    "pieceId": piece_id,
                    "order": order,
                    "text": "\n".join(segment_lines[start : start + 2]),
                }
            )
        current = None

    for index, line in enumerate(lines):
        if POETRY_SECTION.match(line):
            finish_piece()
            current_section = line.strip("【】")
            continue
        if skip_author_line:
            skip_author_line = False
            continue
        next_line = lines[index + 1] if index + 1 < len(lines) else None
        candidate = _poetry_title_author(line, next_line)
        if candidate:
            finish_piece()
            title, author, consumes_next = candidate
            current = {
                "title": title,
                "author": author,
                "sourceKey": f"{current_section}:{title}",
                "_body": [],
            }
            skip_author_line = consumes_next
            continue
        if current is not None:
            current["_body"].append(line)

    finish_piece()
    return pieces, segments


ENUMERATION_MARKER = re.compile(r"(?=[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])")


def _word_entries(number: int, header: str, body: list[str], category: str, pack_id: str) -> list[dict]:
    parts = header.split(maxsplit=1)
    term = parts[0]
    raw = " ".join([parts[1] if len(parts) == 2 else "", *body]).strip()
    chunks = [chunk.strip() for chunk in ENUMERATION_MARKER.split(raw) if chunk.strip()]
    if not chunks:
        chunks = [raw]
    return [
        {
            "id": stable_id("sense", pack_id, category, str(number), term, str(index)),
            "term": term,
            "meaning": chunk.lstrip("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳ "),
            "example": chunk.lstrip("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳ "),
            "source": None,
            "tags": [
                tag
                for tag, marker in (
                    ("non-exam", "非考试篇目"),
                    ("deleted", "被删除篇目"),
                )
                if marker in chunk
            ],
            "category": category,
            "number": number,
            "senseIndex": index,
        }
        for index, chunk in enumerate(chunks, start=1)
    ]


def parse_words(text: str, pack_id: str) -> list[dict]:
    lines = clean_lines(text.splitlines())
    marker_index = next(
        (index for index, line in enumerate(lines) if "6 个虚词" in line), len(lines)
    )
    entries: list[dict] = []

    def collect(start: int, end: int, category: str, max_number: int) -> None:
        current_number: int | None = None
        current_header = ""
        current_body: list[str] = []
        for raw_line in lines[start:end]:
            line = raw_line.strip()
            match = WORD_NUMBER.match(line)
            if match and 1 <= int(match.group(1)) <= max_number:
                if current_number is not None:
                    entries.extend(
                        _word_entries(current_number, current_header, current_body, category, pack_id)
                    )
                current_number = int(match.group(1))
                current_header = match.group(2)
                current_body = []
                continue
            if current_number is not None and line and not PAGE_MARKER.match(line):
                current_body.append(line)
        if current_number is not None:
            entries.extend(
                _word_entries(current_number, current_header, current_body, category, pack_id)
            )

    collect(0, marker_index, "real-word", 150)
    collect(marker_index + 1, len(lines), "function-word", 6)
    category_order = {"real-word": 0, "function-word": 1}
    return sorted(entries, key=lambda entry: (category_order[entry["category"]], entry["number"], entry["senseIndex"]))


def build_pack(wenyan_text: str, poetry_text: str, words_text: str, pack_id: str) -> dict:
    content_version = "2026.11.21"
    prose_pieces, prose_segments = parse_wenyan(wenyan_text, pack_id)
    poem_pieces, poem_segments = parse_poetry(poetry_text, pack_id)
    senses = parse_words(words_text, pack_id)
    pieces = prose_pieces + poem_pieces
    segments = prose_segments + poem_segments
    cards: list[dict] = []
    for segment in segments:
        cloze_text = re.sub(r"^.{1,4}", "____", segment["text"], count=1)
        cards.append(
            {
                "id": stable_id("card", content_version, segment["id"], "segment-continuation"),
                "kind": "segment-continuation",
                "pieceId": segment["pieceId"],
                "segmentId": segment["id"],
                "prompt": segment["text"].split("\n", 1)[0],
                "answer": segment["text"],
                "estimatedSeconds": 25,
            }
        )
        cards.append(
            {
                "id": stable_id("card", content_version, segment["id"], "segment-cloze"),
                "kind": "segment-cloze",
                "pieceId": segment["pieceId"],
                "segmentId": segment["id"],
                "prompt": cloze_text,
                "answer": segment["text"],
                "estimatedSeconds": 25,
            }
        )
    segments_by_piece: dict[str, list[dict]] = {}
    for segment in segments:
        segments_by_piece.setdefault(segment["pieceId"], []).append(segment)
    for piece in pieces:
        full_text = "\n".join(segment["text"] for segment in segments_by_piece.get(piece["id"], []))
        cards.append(
            {
                "id": stable_id("card", content_version, piece["id"], "piece-check"),
                "kind": "piece-check",
                "pieceId": piece["id"],
                "prompt": f"请回忆《{piece['title']}》全文",
                "answer": full_text,
                "estimatedSeconds": 60,
            }
        )
    for sense in senses:
        cards.append(
            {
                "id": stable_id("card", content_version, sense["id"], "sense-recall"),
                "kind": "sense-recall",
                "senseId": sense["id"],
                "context": sense["example"],
                "prompt": f"“{sense['term']}”在上面这句中的意思是？",
                "answer": sense["meaning"],
                "estimatedSeconds": 20,
            }
        )
        cards.append(
            {
                "id": stable_id("card", content_version, sense["id"], "context-cloze"),
                "kind": "context-cloze",
                "senseId": sense["id"],
                "context": sense["example"],
                "prompt": f"请说出“{sense['term']}”的意思。",
                "answer": sense["meaning"],
                "estimatedSeconds": 20,
            }
        )
    return {
        "manifest": {
            "packId": pack_id,
            "version": content_version,
            "title": "上海中考初中文言文与古诗词",
            "counts": {
                "prosePieces": len(prose_pieces),
                "poetryPieces": len(poem_pieces),
                "realWordTerms": len(
                    {sense["number"] for sense in senses if sense["category"] == "real-word"}
                ),
                "functionWordTerms": len(
                    {sense["number"] for sense in senses if sense["category"] == "function-word"}
                ),
                "realWordSenses": sum(1 for sense in senses if sense["category"] == "real-word"),
                "functionWordSenses": sum(
                    1 for sense in senses if sense["category"] == "function-word"
                ),
            },
        },
        "pieces": pieces,
        "segments": segments,
        "senses": senses,
        "cards": cards,
    }


def validate_pack(pack: dict) -> dict:
    manifest = pack["manifest"]
    errors: list[str] = []
    ids = [item["id"] for key in ("pieces", "segments", "senses", "cards") for item in pack[key]]
    if len(ids) != len(set(ids)):
        errors.append("duplicate content IDs")
    forbidden = ("第 ", "===== PAGE", "公众号：", "更多初中学习资料", "咨询热线：", "校区地址：")
    for key in ("pieces", "segments", "senses"):
        for item in pack[key]:
            if any(token in json.dumps(item, ensure_ascii=False) for token in forbidden):
                errors.append(f"layout noise in {key}:{item['id']}")
    counts = manifest["counts"]
    if counts["prosePieces"] != 41:
        errors.append(f"expected 41 prose pieces, got {counts['prosePieces']}")
    if counts["poetryPieces"] != 82:
        errors.append(f"expected 82 poetry pieces, got {counts['poetryPieces']}")
    if counts["realWordTerms"] != 150:
        errors.append(f"expected 150 real-word terms, got {counts['realWordTerms']}")
    if counts["functionWordTerms"] != 6:
        errors.append(f"expected 6 function-word terms, got {counts['functionWordTerms']}")
    if counts["realWordSenses"] < counts["realWordTerms"]:
        errors.append("real-word sense count is below term count")
    if counts["functionWordSenses"] < counts["functionWordTerms"]:
        errors.append("function-word sense count is below term count")
    return {"ok": not errors, "errors": errors, "counts": counts}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wenyan-text", type=Path, required=True)
    parser.add_argument("--poetry-text", type=Path, required=True)
    parser.add_argument("--words-text", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    pack = build_pack(
        args.wenyan_text.read_text(encoding="utf-8"),
        args.poetry_text.read_text(encoding="utf-8"),
        args.words_text.read_text(encoding="utf-8"),
        "zhongkao-2024",
    )
    report = validate_pack(pack)
    if not report["ok"]:
        raise SystemExit(json.dumps(report, ensure_ascii=False, indent=2))
    args.output.mkdir(parents=True, exist_ok=True)
    for key in ("pieces", "segments", "senses", "cards"):
        (args.output / f"{key}.json").write_text(
            json.dumps(pack[key], ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    (args.output / "manifest.json").write_text(
        json.dumps(pack["manifest"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
