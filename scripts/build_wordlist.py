#!/usr/bin/env python3
"""data/*.json を検証し、docs/WORD_LIST.md を生成する。

使い方: python3 scripts/build_wordlist.py [--check]
  --check  生成物が最新かどうかだけ確認する（CI 用）
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDS = json.loads((ROOT / "data/words.json").read_text(encoding="utf-8"))
ROOTS = json.loads((ROOT / "data/roots.json").read_text(encoding="utf-8"))
PAIRS = json.loads((ROOT / "data/pairs.json").read_text(encoding="utf-8"))
CANDIDATES = json.loads((ROOT / "data/candidates.json").read_text(encoding="utf-8"))
PAIR_KINDS = {
    "vowel": "🗣️ 母音のちがい",
    "lr": "👅 L と R",
    "bv": "👄 B と V",
    "th": "😛 TH の音",
    "homophone": "👂 同じ音・別の語",
    "spelling": "✍️ つづりが似ている",
    "derived": "🧬 形が似た派生語",
}
# コースは英検の級に合わせたレベル（app/app.js の COURSES と同じ。level 1=5級 … 7=1級）
COURSES = {
    1: "5級 はじめの一歩",
    2: "4級 くらしの基本",
    3: "3級 中学卒業",
    4: "準2級 高校なかば",
    5: "2級 高校卒業",
    6: "準1級 大学なかば",
    7: "1級 マスター",
}
# 英語以外の形で収録した語の言語（app/app.js の LANGS と同じ）
LANGS = {"fr": "フランス語", "de": "ドイツ語", "es": "スペイン語", "it": "イタリア語", "pt": "ポルトガル語",
         "nl": "オランダ語", "ru": "ロシア語", "pl": "ポーランド語", "cs": "チェコ語", "sv": "スウェーデン語",
         "ga": "アイルランド語", "he": "ヘブライ語", "la": "ラテン語", "el": "ギリシャ語"}
# 固有名詞の品詞。類義語の代わりに「別名・関連する名前」を載せている
PROPER = {"地名", "神名", "神話", "人名"}
CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"]
REQUIRED = ["id", "word", "katakana", "pos", "cefr", "level", "meaning", "scene",
            "example", "etymology", "roots", "family", "synonyms"]


def validate():
    errors = []
    ids = [w["id"] for w in WORDS]
    root_ids = {r["id"] for r in ROOTS}
    if len(ids) != len(set(ids)):
        errors.append("重複した id があります")
    for w in WORDS:
        for key in REQUIRED:
            if key not in w:
                errors.append(f"{w.get('id')}: {key} がありません")
        if w.get("cefr") not in CEFR:
            errors.append(f"{w['id']}: 不明な cefr {w.get('cefr')}")
        if w.get("level") not in COURSES:
            errors.append(f"{w['id']}: 不明な level {w.get('level')}")
        if len(w.get("synonyms", [])) < 2:
            errors.append(f"{w['id']}: 類義語は2つ以上必要です")
        for s in w.get("synonyms", []):
            for key in ("word", "meaning", "nuance", "etymology"):
                if not s.get(key):
                    errors.append(f"{w['id']}: 類義語 {s.get('word')} の {key} がありません")
        tq = w.get("trapQuiz")
        if tq and (not w.get("gap") or len(tq["wrong"]) != 3 or tq["answer"] in tq["wrong"]):
            errors.append(f"{w['id']}: trapQuiz が不正です（gap 必須・誤答は3つ）")
        if "lang" in w and w["lang"] not in LANGS:
            errors.append(f"{w['id']}: 不明な lang {w['lang']}")
        for r in w.get("roots", []):
            if r not in root_ids:
                errors.append(f"{w['id']}: 未定義の語根 {r}")
    groups = {}
    for w in WORDS:
        if "group" in w:
            groups.setdefault(w["group"], []).append(w["id"])
    for g, members in groups.items():
        if len(members) < 2:
            errors.append(f"group {g}: 仲間が {members[0]} しかいません")
    for r in ROOTS:
        for wid in r["words"]:
            match = next((w for w in WORDS if w["id"] == wid), None)
            if match is None:
                errors.append(f"語根 {r['id']}: 未定義の単語 {wid}")
            elif r["id"] not in match["roots"]:
                errors.append(f"語根 {r['id']}: {wid} の roots に {r['id']} がありません")
    pair_ids = set()
    for p in PAIRS:
        if p["id"] in pair_ids:
            errors.append(f"似た単語: 重複した id {p['id']}")
        pair_ids.add(p["id"])
        if p.get("kind") not in PAIR_KINDS:
            errors.append(f"似た単語 {p['id']}: 不明な kind {p.get('kind')}")
        if p.get("level") not in COURSES:
            errors.append(f"似た単語 {p['id']}: 不明な level {p.get('level')}")
        if len(p.get("words", [])) < 2 or not p.get("point"):
            errors.append(f"似た単語 {p['id']}: 語が2つ以上と point が必要です")
        for x in p.get("words", []):
            for key in ("word", "ipa", "pos", "meaning", "example"):
                if not x.get(key):
                    errors.append(f"似た単語 {p['id']}: {x.get('word')} の {key} がありません")
            # 空所補充で出すので、例文にはその語そのもの（活用しない形）が入っていて、ほかの選択肢は入っていないこと
            for y in p.get("words", []):
                found = re.search(rf"\b{re.escape(y['word'])}\b", x["example"]["en"], re.I)
                if (y is x) != bool(found):
                    errors.append(f"似た単語 {p['id']}: {x['word']} の例文に {y['word']} が{'ありません' if y is x else '入っています'}")
    return errors


def render():
    out = [
        "# 単語リスト（カタカナ語 → 英単語）",
        "",
        "> このファイルは `data/words.json` と `data/roots.json` から "
        "`python3 scripts/build_wordlist.py` で自動生成されています。直接編集しないでください。",
        "",
        f"収録語数: **{len(WORDS)} 語**（類義語 {sum(len(w['synonyms']) for w in WORDS)} 語） / "
        f"語根ファミリー: **{len(ROOTS)} 種** / 似た単語セット: **{len(PAIRS)} セット**",
        "",
        "レベル別: " + " / ".join(f"{COURSES[key].split()[0]} {sum(w['level'] == key for w in WORDS)}語" for key in COURSES),
        "",
        "> レベルは英検の級にあわせたおおよその目安です（英語としての難しさで分けています）。",
        "",
        "凡例: ⚠️ = カタカナの罠（日本語での意味と英語の意味がずれている語）",
        "",
        "## 目次",
        "",
    ]
    for key, label in COURSES.items():
        words = [w for w in WORDS if w["level"] == key]
        out.append(f"- {label} — " + ", ".join(f"[{w['word']}](#{w['id']})" for w in words))
    out += ["- [語根ファミリー一覧](#語根ファミリー一覧)", "- [似た単語セット](#似た単語セット)", ""]

    for key, label in COURSES.items():
        out += [f"## {label}", ""]
        for w in (w for w in WORDS if w["level"] == key):
            trap = " ⚠️" if w.get("gap") else ""
            out += [
                f'<a id="{w["id"]}"></a>',
                f"### {w['word']}（{w['katakana']}）{trap}",
                "",
                f"**{w['pos']}{'（' + LANGS[w['lang']] + '）' if 'lang' in w else ''}** / {COURSES[w['level']]} / CEFR {w['cefr']} — {w['meaning']}",
                "",
                f"- 📍 シーン: {w['scene']}",
            ]
            if w.get("gap"):
                out.append(f"- ⚠️ カタカナの罠: {w['gap']}")
            out += [
                f"- 💬 例文: *{w['example']['en']}* — {w['example']['ja']}",
                f"- 📜 語源: {w['etymology']['origin']}",
                f"  - {w['etymology']['story']}",
            ]
            if w["roots"]:
                roots = [next(r for r in ROOTS if r["id"] == rid) for rid in w["roots"]]
                out.append("- 💎 語根: " + ", ".join(f"`{r['form']}`（{r['meaning']}）" for r in roots))
            if w["family"]:
                out.append("- 🌳 同じ語源の仲間: " + "、".join(w["family"]))
            out += [
                "",
                f"| {'別名・関連する名前' if w['pos'] in PROPER else '類義語'} | 意味 | ニュアンスの違い | 語源 |",
                "|---|---|---|---|",
            ]
            for s in w["synonyms"]:
                out.append(f"| **{s['word']}** | {s['meaning']} | {s['nuance']} | {s['etymology']} |")
            out.append("")

    out += ["## 似た単語セット", "", f"{len(PAIRS)} セット（`data/pairs.json`）", ""]
    for kind, label in PAIR_KINDS.items():
        out += [f"### {label}", "", "| レベル | 単語 | ここがちがう |", "|---|---|---|"]
        for p in sorted((p for p in PAIRS if p["kind"] == kind), key=lambda p: p["level"]):
            ws = "<br>".join(f"**{x['word']}** /{x['ipa']}/ {x['meaning']}" for x in p["words"])
            out.append(f"| {COURSES[p['level']].split()[0]} | {ws} | {p['point']} |")
        out.append("")

    out += ["## 語根ファミリー一覧", "", "| 語根 | 意味 | 由来 | 収録語 | その他の仲間 |", "|---|---|---|---|---|"]
    for r in ROOTS:
        main = ", ".join(f"[{wid}](#{wid})" for wid in r["words"])
        out.append(f"| `{r['form']}` | {r['meaning']} | {r['source']} | {main} | {', '.join(r['extra'])} |")
    out.append("")
    return "\n".join(out)


def coverage():
    """候補リスト（data/candidates.json）のうち、まだ単語リストにない語を分野ごとに返す"""
    have = {w["word"] for w in WORDS}
    skip = set(CANDIDATES["exclude"])
    return {cat: [x for x in words if x not in have and x not in skip]
            for cat, words in CANDIDATES["categories"].items()}


def katakana_clashes():
    """カタカナが同じなのに、似た単語セットで一緒に練習できない語（bus と bath など）を返す

    同じ名前の別の言語形（group が同じ Michel と Michelle）や、大文字・小文字だけがちがう同じつづりの語
    （echo と神話の Echo）は、空所補充で区別できないのでセットにせず、選択肢にも一緒に出さない。
    """
    groups = {}
    for w in WORDS:
        groups.setdefault(re.sub(r"（.*）", "", w["katakana"]), []).append(w)
    together = {(a["word"], b["word"]) for p in PAIRS for a in p["words"] for b in p["words"] if a is not b}
    for ws in groups.values():
        for a in ws:
            for b in ws:
                if a is not b and (a["word"].lower() == b["word"].lower() or (a.get("group") and a.get("group") == b.get("group"))):
                    together.add((a["word"], b["word"]))
    groups = {kata: list(dict.fromkeys(w["word"] for w in ws)) for kata, ws in groups.items()}
    out = []
    for kata, words in groups.items():
        lonely = [a for a in words if len(words) > 1 and not any((a, b) in together for b in words if b != a)]
        if lonely:
            out.append(f"{kata}（{' / '.join(words)}）")
    return out


def main():
    errors = validate()
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)
    target = ROOT / "docs/WORD_LIST.md"
    text = render()
    if "--check" in sys.argv:
        if not target.exists() or target.read_text(encoding="utf-8") != text:
            print("docs/WORD_LIST.md が古くなっています。スクリプトを実行してください。", file=sys.stderr)
            sys.exit(1)
        print("OK")
        return
    target.write_text(text, encoding="utf-8")
    print(f"生成しました: {target.relative_to(ROOT)}（{len(WORDS)} 語）")
    missing = coverage()
    print(f"候補リストのうち未収録: {sum(map(len, missing.values()))} 語")
    for cat, words in missing.items():
        if words:
            print(f"  {cat}: {' '.join(words)}")
    clashes = katakana_clashes()
    print(f"カタカナが同じなのに似た単語セットがない組: {len(clashes)} 組")
    for c in clashes:
        print(f"  {c}")


if __name__ == "__main__":
    main()
