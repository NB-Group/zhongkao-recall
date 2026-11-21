import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parents[1]))

from import_content import clean_lines, parse_poetry, parse_wenyan, parse_words


def test_clean_lines_removes_layout_noise():
    lines = clean_lines(
        [
            "第 2 页 共 17 页",
            "公众号：上海家长club",
            "风华教育语文必备手册（二）",
            "桃花源记",
        ]
    )

    assert lines == ["桃花源记"]


def test_parse_wenyan_keeps_grade_author_and_segments():
    text = """六年级上册
两小儿辩日
作者：列御寇 出处：《列子·汤问》 朝代：战国
孔子东游，见两小儿辩斗，问其故。
一儿曰：我以日始出时去人近。
"""

    pieces, segments = parse_wenyan(text, "test-pack")

    assert pieces[0]["title"] == "两小儿辩日"
    assert pieces[0]["author"] == "列御寇"
    assert pieces[0]["textbookLocation"] == "六年级上册"
    assert len(segments) == 1
    assert "孔子东游" in segments[0]["text"]


def test_parse_poetry_supports_same_line_and_next_line_authors():
    text = """【六上】
宿建德江
[唐] 孟浩然
移舟泊烟渚，
日暮客愁新。
江南春 唐・杜牧
千里莺啼绿映红，水村山郭酒旗风。
"""

    pieces, segments = parse_poetry(text, "test-pack")

    assert [piece["title"] for piece in pieces] == ["宿建德江", "江南春"]
    assert pieces[0]["author"] == "孟浩然"
    assert pieces[1]["author"] == "杜牧"
    assert len(segments) == 2


def test_parse_words_keeps_real_and_function_word_ranges():
    text = """1 比
①靠近 其两膝相比者，各隐卷底衣褶中 核舟记
2 鄙
浅陋，目光短浅 肉食者鄙 曹刿论战
2024 上海中考文言文 6 个虚词
1 之
助词 的
"""

    senses = parse_words(text, "test-pack")

    assert senses[0]["term"] == "比"
    assert senses[1]["term"] == "鄙"
    assert senses[-1]["term"] == "之"
    assert senses[0]["category"] == "real-word"
    assert senses[-1]["category"] == "function-word"
