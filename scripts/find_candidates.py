#!/usr/bin/env python3
"""カタカナ語辞典（JMdict）から、まだ data/words.json にない単語の候補を一覧にする。

使い方: python3 scripts/find_candidates.py [JMdict_e.gz のパス] > candidates.tsv
  パスを省略すると EDRDG から JMdict_e.gz（約10MB）をダウンロードする（リポジトリには入れない）。

出力（タブ区切り）: カタカナ / 英語の意味（最初の3つ）/ 常用度の印 / 和製英語なら wasei
- 漢字表記がなく、読みがカタカナだけの見出しに限る
- 常用度の印（news1, ichi1, spec1, gai1 など）がある語に限る
- 英語以外の言語から入った外来語（アルバイトなど）と、ドキドキのような繰り返しの擬態語は除く
- 見出しのカタカナ、または最初の英訳がすでに収録されている語は除く
候補は機械的に拾っただけなので、人が選んでから words.json に書き足すこと。

JMdict は EDRDG（Electronic Dictionary Research and Development Group）の辞書で、
CC BY-SA 4.0 で公開されている。https://www.edrdg.org/edrdg/licence.html
"""
import gzip
import io
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz"
XML_LANG = "{http://www.w3.org/XML/1998/namespace}lang"


def main():
    words = json.loads((ROOT / "data/words.json").read_text(encoding="utf-8"))
    known_en = {w["word"].lower() for w in words}
    known_kana = {k.strip() for w in words for k in re.split(r"[（）()・／/、]", w["katakana"])}

    source = sys.argv[1] if len(sys.argv) > 1 else None
    if source is None:
        print(f"{URL} をダウンロードしています…", file=sys.stderr)
        data = urllib.request.urlopen(URL).read()
        stream = gzip.GzipFile(fileobj=io.BytesIO(data))
    else:
        stream = gzip.open(source)

    count = 0
    for _, entry in ET.iterparse(stream):
        if entry.tag != "entry":
            continue
        readings = entry.findall("r_ele")
        kana = readings[0].findtext("reb")
        priority = sorted({p.text for r in readings for p in r.findall("re_pri")})
        senses = entry.findall("sense")
        sources = [s for sense in senses for s in sense.findall("lsource")]
        glosses = [g.text for sense in senses for g in sense.findall("gloss")]
        first = re.sub(r"\(.*?\)", "", glosses[0] if glosses else "").strip().lower()
        if (entry.find("k_ele") is None
                and re.fullmatch(r"[ァ-ヴー・]+", kana)
                and not re.fullmatch(r"(.{2})\1", kana)
                and priority
                and (not sources or any(s.get(XML_LANG, "eng") == "eng" for s in sources))
                and kana not in known_kana
                and first not in known_en):
            wasei = "wasei" if any(s.get("ls_wasei") for s in sources) else ""
            print("\t".join([kana, "; ".join(glosses[:3]), ",".join(priority), wasei]))
            count += 1
        entry.clear()
    print(f"{count} 件", file=sys.stderr)


if __name__ == "__main__":
    main()
