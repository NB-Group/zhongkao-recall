"""Page-level OCR through an OpenAI-compatible SiliconFlow vision endpoint.

The script preserves model output as raw structured data. It does not infer
meanings, repair page order, or merge examples into definitions.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import requests


DEFAULT_ENDPOINT = "https://api.siliconflow.cn/v1/chat/completions"
DEFAULT_MODEL = "Qwen/Qwen3.5-4B"


def build_ocr_prompt(source_name: str, page_number: int) -> str:
    return f"""你是中文学习资料 OCR 助手。请处理文件 {source_name} 的第 {page_number} 页。

只做逐字、逐行的版面识别，不要翻译，不要补写，不要纠错，不要推断缺失内容，不要把相邻字段合并。
必须保留原始标点、括号、引号、序号、换行关系和页面上的“非考试篇目”“被删除篇目”等标签。
页眉、页脚、页码、公众号推广、咨询电话和装饰性文字标记为 noise，仍然放入 blocks，不能静默丢弃。

只返回 JSON，不要 Markdown 代码围栏。JSON 结构必须是：
{{
  "source_name": {json.dumps(source_name, ensure_ascii=False)},
  "page_number": {page_number},
  "blocks": [
    {{
      "block_type": "section|title|author_metadata|body|word_entry|sense|example|source|noise",
      "text": "页面上看到的原文",
      "line_number": 1,
      "parent_block": null,
      "fields": {{}}
    }}
  ],
  "warnings": []
}}

对实词和虚词表，word_entry 表示一个编号词条，sense 表示一个明确的义项，example 表示例句，source 表示出处。字段关系只能依据页面排版表达，不能根据常识重组。
"""


def parse_model_json(content: str) -> dict[str, Any]:
    text = content.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    result = json.loads(text)
    if not isinstance(result, dict) or not isinstance(result.get("blocks"), list):
        raise ValueError("OCR response must be an object with a blocks array")
    return result


class QwenOCRClient:
    def __init__(
        self,
        api_key: str,
        endpoint: str = DEFAULT_ENDPOINT,
        model: str = DEFAULT_MODEL,
        timeout: int = 120,
        session: Any = requests,
    ) -> None:
        if not api_key:
            raise ValueError("SILICONFLOW_API_KEY is required")
        self.api_key = api_key
        self.endpoint = endpoint
        self.model = model
        self.timeout = timeout
        self.session = session

    def recognize_page(self, image_bytes: bytes, source_name: str, page_number: int) -> dict[str, Any]:
        encoded = base64.b64encode(image_bytes).decode("ascii")
        response = self.session.post(
            self.endpoint,
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            json={
                "model": self.model,
                "temperature": 0,
                "messages": [
                    {"role": "system", "content": "你只返回合法 JSON。"},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": build_ocr_prompt(source_name, page_number)},
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encoded}"}},
                        ],
                    },
                ],
            },
            timeout=self.timeout,
        )
        response.raise_for_status()
        payload = response.json()
        content = payload["choices"][0]["message"]["content"]
        return parse_model_json(content)


def render_pdf_pages(pdf_path: Path, output_dir: Path, page_start: int, page_end: int) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    prefix = output_dir / "page"
    binary = os.environ.get("PDFTOPPM", "pdftoppm")
    subprocess.run(
        [binary, "-png", "-r", "180", "-f", str(page_start), "-l", str(page_end), str(pdf_path), str(prefix)],
        check=True,
        capture_output=True,
        text=True,
    )
    return sorted(output_dir.glob("page-*.png"))


def main() -> None:
    parser = argparse.ArgumentParser(description="OCR PDF pages with Qwen through SiliconFlow")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--end-page", type=int)
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    args = parser.parse_args()

    api_key = os.environ.get("SILICONFLOW_API_KEY")
    if not api_key:
        raise SystemExit("SILICONFLOW_API_KEY is not set")
    end_page = args.end_page or args.start_page
    with tempfile.TemporaryDirectory(prefix="qwen-ocr-") as temp_dir:
        pages = render_pdf_pages(args.pdf, Path(temp_dir), args.start_page, end_page)
        client = QwenOCRClient(api_key, endpoint=args.endpoint, model=args.model)
        args.output.mkdir(parents=True, exist_ok=True)
        for image_path in pages:
            page_number = int(image_path.stem.split("-")[-1])
            result = client.recognize_page(image_path.read_bytes(), args.pdf.name, page_number)
            (args.output / f"page-{page_number:03d}.json").write_text(
                json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            print(f"OCR_PAGE_DONE {page_number}")


if __name__ == "__main__":
    main()
