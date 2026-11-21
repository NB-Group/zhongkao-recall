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
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import requests


DEFAULT_ENDPOINT = "https://api.siliconflow.cn/v1/chat/completions"
DEFAULT_MODEL = "Qwen/Qwen3.5-4B"


def build_page_payload(
    source_name: str,
    page_number: int,
    page_text: str,
    tables: list[list[list[str | None]]],
    document_type: str,
) -> dict[str, Any]:
    return {
        "source_name": source_name,
        "page_number": page_number,
        "document_type": document_type,
        "page_text": page_text,
        "tables": tables,
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
  "noise": [],
  "warnings": []
}
"""
    return f"""你是中文学习资料结构化助手，正在处理第 {page_number} 页。

输入包含 PDF 原生文字和表格列。只根据输入中的原文整理，不要推断，不要改写，不要补全，不要把释义、例句、出处混合。保留原始标点、括号、序号、标签和不确定内容。页眉、页脚、页码、推广文案和咨询信息放入 noise。缺失字段使用 null 或空数组。

只返回合法 JSON，不要 Markdown 代码围栏。返回结构必须符合：
{schema}

当前文档类型是 {document_type}。
"""


def parse_json_response(content: str) -> dict[str, Any]:
    text = content.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError("Qwen response must be a JSON object")
    return value


def extract_page_payload(pdf_path: Path, page_number: int, document_type: str) -> dict[str, Any]:
    import pdfplumber

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_number - 1]
        text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
        tables = page.extract_tables() if document_type == "word_table" else []
    return build_page_payload(pdf_path.name, page_number, text, tables, document_type)


class QwenOrganizer:
    def __init__(self, api_key: str, endpoint: str = DEFAULT_ENDPOINT, model: str = DEFAULT_MODEL, timeout: int = 600):
        if not api_key:
            raise ValueError("SILICONFLOW_API_KEY is required")
        self.api_key = api_key
        self.endpoint = endpoint
        self.model = model
        self.timeout = timeout

    def organize(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = requests.post(
            self.endpoint,
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            json={
                "model": self.model,
                "temperature": 0,
                "max_tokens": 5000,
                "enable_thinking": False,
                "messages": [
                    {"role": "system", "content": "你只返回合法 JSON。"},
                    {"role": "user", "content": build_organize_prompt(payload["document_type"], payload["page_number"]) + "\n输入证据：\n" + json.dumps(payload, ensure_ascii=False)},
                ],
            },
            timeout=self.timeout,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        result = parse_json_response(content)
        result["source_name"] = payload["source_name"]
        result["page_number"] = payload["page_number"]
        result["evidence"] = payload
        return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--document-type", choices=["word_table", "classic_text"], required=True)
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--end-page", type=int)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--timeout", type=int, default=600)
    args = parser.parse_args()

    api_key = os.environ.get("SILICONFLOW_API_KEY")
    if not api_key:
        raise SystemExit("SILICONFLOW_API_KEY is not set")
    with pdfplumber.open(args.pdf) as pdf:
        end_page = args.end_page or len(pdf.pages)
    pages = list(range(args.start_page, end_page + 1))
    args.output.mkdir(parents=True, exist_ok=True)
    organizer = QwenOrganizer(api_key, timeout=args.timeout)

    def run_page(page_number: int) -> tuple[int, dict[str, Any]]:
        payload = extract_page_payload(args.pdf, page_number, args.document_type)
        return page_number, organizer.organize(payload)

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
