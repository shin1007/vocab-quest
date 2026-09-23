#!/usr/bin/env python3
"""data/*.json を検証し、docs/WORD_LIST.md を生成する。

使い方: python3 scripts/build_wordlist.py [--check]
  --check  生成物が最新かどうかだけ確認する（CI 用）
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDS = json.loads((ROOT / "data/words.json").read_text(encoding="utf-8"))
ROOTS = json.loads((ROOT / "data/roots.json").read_text(encoding="utf-8"))
# コースは英検の級の目安で分ける（app/app.js の COURSES と同じ）
COURSES = {
    "5": "英検5級レベル",
    "4": "英検4級レベル",
    "3": "英検3級レベル",
    "p2": "英検準2級レベル",
    "2": "英検2級レベル",
    "p1": "英検準1級レベル",
    "1": "英検1級レベル",
}
CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"]
REQUIRED = ["id", "word", "katakana", "pos", "cefr", "eiken", "meaning", "scene",
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
        if w.get("eiken") not in COURSES:
            errors.append(f"{w['id']}: 不明な eiken {w.get('eiken')}")
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
    return errors


def render():
    out = [
        "# 単語リスト（カタカナ語 → 英単語）",
        "",
        "> このファイルは `data/words.json` と `data/roots.json` から "
        "`python3 scripts/build_wordlist.py` で自動生成されています。直接編集しないでください。",
        "",
        f"収録語数: **{len(WORDS)} 語**（類義語 {sum(len(w['synonyms']) for w in WORDS)} 語） / "
        f"語根ファミリー: **{len(ROOTS)} 種**",
        "",
        "級別: " + " / ".join(f"{label.removesuffix('レベル')} {sum(w['eiken'] == key for w in WORDS)}語" for key, label in COURSES.items()),
        "",
        "> 級は英検の出題レベルを目安に割り当てたもので、公式の級別単語リストではありません。",
        "",
        "凡例: ⚠️ = カタカナの罠（日本語での意味と英語の意味がずれている語）",
        "",
        "## 目次",
        "",
    ]
    for key, label in COURSES.items():
        words = [w for w in WORDS if w["eiken"] == key]
        out.append(f"- {label} — " + ", ".join(f"[{w['word']}](#{w['id']})" for w in words))
    out += ["- [語根ファミリー一覧](#語根ファミリー一覧)", ""]

    for key, label in COURSES.items():
        out += [f"## {label}", ""]
        for w in (w for w in WORDS if w["eiken"] == key):
            trap = " ⚠️" if w.get("gap") else ""
            out += [
                f'<a id="{w["id"]}"></a>',
                f"### {w['word']}（{w['katakana']}）{trap}",
                "",
                f"**{w['pos']}** / {COURSES[w['eiken']]} / CEFR {w['cefr']} — {w['meaning']}",
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
