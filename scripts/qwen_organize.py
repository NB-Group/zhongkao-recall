"""Use Qwen to organize extracted PDF text and tables into structured JSON.

The model receives page-local evidence and returns source-paired records. The
script never infers missing fields or merges pages locally.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any



DEFAULT_ENDPOINT = "https://api.siliconflow.cn/v1/chat/completions"
DEFAULT_MODEL = "Qwen/Qwen3.5-4B"


def build_page_payload(
    source_name: str,
    page_number: int,
    page_text: str,
    tables: list[list[list[str | None]]],
    document_type: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "source_name": source_name,
        "page_number": page_number,
        "document_type": document_type,
        "page_text": page_text,
        "tables": tables,
        "context": context or {},
    }


def build_organize_prompt(document_type: str, page_number: int) -> str:
    if document_type == "word_table":
        schema = """
{
  "page_number": 1,
  "document_type": "word_table",
  "entries": [
    {
      "number": 1,
      "term": "比",
      "senses": [
        {
          "sense_index": 1,
          "meaning": "页面词义原文",
          "examples": [{"text": "页面例句原文", "source": "页面出处原文", "tags": []}]
        }
      ]
    }
  ],
  "continuations": [
    {
      "parent_number": 1,
      "parent_term": "比",
      "meaning": null,
      "examples": [{"text": "续表中的例句原文", "source": "续表中的出处原文", "tags": []}]
    }
  ],
  "noise": [],
  "warnings": []
}
"""
    else:
        schema = """
{
  "page_number": 1,
  "document_type": "classic_text",
  "pieces": [{"title": "页面标题原文", "author": "作者原文", "location": "教材位置原文", "segments": ["页面段落原文"]}],
  "continuations": [{"piece_title": "上一页篇名原文", "segments": ["本页续接正文原文"]}],
  "noise": [],
  "warnings": []
}
"""
    return f"""你是中文学习资料结构化助手，正在处理第 {page_number} 页。

输入包含 PDF 原生文字和表格列。只根据输入中的原文整理，不要推断，不要改写，不要补全，不要把释义、例句、出处混合。保留原始标点、括号、序号、标签和不确定内容。页眉、页脚、页码、推广文案和咨询信息放入 noise。缺失字段使用 null 或空数组。

对表格输入，表格数组中的每一个 row 是不可跨越的证据边界。一个 row 的“词义、例句、出处”只能来自同一个 row，不能把下一 row 的文字拼入当前 row，也不能用页面连续文字覆盖表格单元格。只有同一词条下明确为空的例句/出处单元格，才可以按表格视觉结构归入同一义项。
如果输入的 context 提供了上一页末尾词条、篇目或预期编号，使用它判断本页的续表归属。不要把没有序号的续表行伪造为新词条或新篇目。表格续行放进 continuations。经典文本跨页正文放进 continuations，并填写 piece_title。只有页面明确出现的新篇名才创建新 piece。
经典文本的封面标题、总标题、页码、机构信息和年级分节标题不能创建 piece，放入 noise 或作为 location。piece 的 title 只能是具体诗名或文章名，不能是“风华教育语文必备手册”“古诗词背诵”“文言文阅读”“第 N 页”。author 只能是作者或“佚名/汉乐府”等作者信息。教材位置放入 location。segments 只能放正文，不要重复 title、author、location。

只返回合法 JSON，不要 Markdown 代码围栏。返回结构必须符合：
{schema}

当前文档类型是 {document_type}。
"""


def parse_json_response(content: str) -> dict[str, Any]:
    text = content.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        repaired = text.replace(",\n  }", "\n  }").replace(",\n}", "\n}")
        value = json.loads(repaired)
    if not isinstance(value, dict):
        raise ValueError("Qwen response must be a JSON object")
    return value


def extract_page_payload(pdf_path: Path, page_number: int, document_type: str) -> dict[str, Any]:
    import pdfplumber

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_number - 1]
        text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
        tables = page.extract_tables() if document_type == "word_table" else []
    expected_numbers = []
    for table in tables:
        for row in table:
            if row and row[0] and str(row[0]).strip().isdigit():
                expected_numbers.append(int(str(row[0]).strip()))
    return build_page_payload(
        pdf_path.name,
        page_number,
        text,
        tables,
        document_type,
        {"expected_numbers": expected_numbers},
    )


class QwenOrganizer:
    def __init__(self, api_key: str, endpoint: str = DEFAULT_ENDPOINT, model: str = DEFAULT_MODEL, timeout: int = 600):
        if not api_key:
            raise ValueError("SILICONFLOW_API_KEY is required")
        self.api_key = api_key
        self.endpoint = endpoint
        self.model = model
        self.timeout = timeout

    def organize(self, payload: dict[str, Any]) -> dict[str, Any]:
        evidence = payload
        body = {
                "model": self.model,
                "temperature": 0,
                "max_tokens": 5000,
                "enable_thinking": False,
                "messages": [
                    {"role": "system", "content": "你只返回合法 JSON。"},
                    {
                        "role": "user",
                        "content": build_organize_prompt(payload["document_type"], payload["page_number"])
                        + "\n本页上下文和预期编号：\n"
                        + json.dumps(payload.get("context", {}), ensure_ascii=False)
                        + "\n输入证据：\n"
                        + json.dumps(payload, ensure_ascii=False),
                    },
                ],
            }
        request = urllib.request.Request(
            self.endpoint,
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    response_payload = json.loads(response.read().decode("utf-8"))
                break
            except urllib.error.HTTPError as error:
                if error.code == 503 and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"OCR_HTTP_ERROR status={error.code}") from None
            except urllib.error.URLError as error:
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(f"OCR_NETWORK_ERROR reason={error.reason}") from None
        content = response_payload["choices"][0]["message"]["content"]
        try:
            result = parse_json_response(content)
        except json.JSONDecodeError:
            retry_body = dict(body)
            retry_body["messages"] = body["messages"] + [{
                "role": "user",
                "content": "上一次输出不是合法 JSON。请重新输出完整、闭合、无 Markdown 围栏的 JSON，只返回 JSON。",
            }]
            retry_request = urllib.request.Request(
                self.endpoint,
                data=json.dumps(retry_body, ensure_ascii=False).encode("utf-8"),
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(retry_request, timeout=self.timeout) as retry_response:
                retry_payload = json.loads(retry_response.read().decode("utf-8"))
            result = parse_json_response(retry_payload["choices"][0]["message"]["content"])
        result["source_name"] = evidence["source_name"]
        result["page_number"] = evidence["page_number"]
        result["evidence"] = evidence
        return result


def main() -> None:
    import pdfplumber

    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--document-type", choices=["word_table", "classic_text"], required=True)
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--end-page", type=int)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--timeout", type=int, default=600)
    parser.add_argument("--expected-page-map", type=Path)
    args = parser.parse_args()

    api_key = os.environ.get("SILICONFLOW_API_KEY")
    if not api_key:
        raise SystemExit("SILICONFLOW_API_KEY is not set")
    with pdfplumber.open(args.pdf) as pdf:
        end_page = args.end_page or len(pdf.pages)
    pages = list(range(args.start_page, end_page + 1))
    expected_page_map = json.loads(args.expected_page_map.read_text(encoding="utf-8")) if args.expected_page_map else {}
    args.output.mkdir(parents=True, exist_ok=True)
    organizer = QwenOrganizer(api_key, timeout=args.timeout)

    previous_result: dict[str, Any] | None = None
    previous_path = args.output / f"page-{args.start_page - 1:03d}.json"
    if previous_path.exists():
        previous_result = json.loads(previous_path.read_text(encoding="utf-8"))

    def run_page(page_number: int, previous: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
        payload = extract_page_payload(args.pdf, page_number, args.document_type)
        if str(page_number) in expected_page_map:
            payload["context"]["expected_numbers"] = expected_page_map[str(page_number)]
        if previous:
            payload["context"]["previous_entries"] = previous.get("entries", [])[-3:]
            payload["context"]["previous_pieces"] = previous.get("pieces", [])[-2:]
        return page_number, organizer.organize(payload)

    if args.workers == 1:
        for page_number in pages:
            page_number, result = run_page(page_number, previous_result)
            (args.output / f"page-{page_number:03d}.json").write_text(
                json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            previous_result = result
            print(f"ORGANIZE_PAGE_DONE {page_number}", flush=True)
    else:
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            futures = {executor.submit(run_page, page): page for page in pages}
            for future in as_completed(futures):
                page_number, result = future.result()
                (args.output / f"page-{page_number:03d}.json").write_text(
                    json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
                )
                print(f"ORGANIZE_PAGE_DONE {page_number}", flush=True)


if __name__ == "__main__":
    main()
