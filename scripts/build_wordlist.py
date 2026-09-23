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
PAIR_KINDS = {
    "vowel": "🗣️ 母音のちがい",
    "lr": "👅 L と R",
    "bv": "👄 B と V",
    "th": "😛 TH の音",
    "homophone": "👂 同じ音・別の語",
    "spelling": "✍️ つづりが似ている",
    "derived": "🧬 形が似た派生語",
}
# コースはこのアプリ独自のレベル（app/app.js の COURSES と同じ）
COURSES = {
    1: "Lv.1 ひと目でわかる",
    2: "Lv.2 くらしの定番",
    3: "Lv.3 よく使う",
    4: "Lv.4 話が広がる",
    5: "Lv.5 よく見聞きする",
    6: "Lv.6 社会の話題",
    7: "Lv.7 大人の日常語",
    8: "Lv.8 ビジネス",
    9: "Lv.9 教養",
    10: "Lv.10 マスター",
}
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
        for r in w.get("roots", []):
            if r not in root_ids:
                errors.append(f"{w['id']}: 未定義の語根 {r}")
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
        "レベル別: " + " / ".join(f"Lv.{key} {sum(w['level'] == key for w in WORDS)}語" for key in COURSES),
        "",
        "> レベルはこのアプリ独自の分け方です（カタカナとしてのなじみやすさと、英語の難しさで決めています）。",
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
                f"**{w['pos']}** / {COURSES[w['level']]} / CEFR {w['cefr']} — {w['meaning']}",
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
                "| 類義語 | 意味 | ニュアンスの違い | 語源 |",
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
            out.append(f"| Lv.{p['level']} | {ws} | {p['point']} |")
        out.append("")

    out += ["## 語根ファミリー一覧", "", "| 語根 | 意味 | 由来 | 収録語 | その他の仲間 |", "|---|---|---|---|---|"]
    for r in ROOTS:
        main = ", ".join(f"[{wid}](#{wid})" for wid in r["words"])
        out.append(f"| `{r['form']}` | {r['meaning']} | {r['source']} | {main} | {', '.join(r['extra'])} |")
    out.append("")
    return "\n".join(out)


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


if __name__ == "__main__":
    main()
