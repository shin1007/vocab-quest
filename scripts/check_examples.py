#!/usr/bin/env python3
"""例文の文法が英検の級（words.json・pairs.json の level）に合っているかを、簡単な規則で確認する。

使い方: python3 scripts/check_examples.py [--level N]
  文法の目安（中学の学年にあわせる。準2級より上は高校の文法なので確認しない）
    5級（level 1）: 現在形・現在進行形・can・命令文・Let's。過去形・未来・不定詞・動名詞・比較・接続詞・完了・受け身・関係詞は使わない
    4級（level 2）: 5級に加えて過去形・過去進行形・未来（will / be going to）・助動詞・不定詞・動名詞・比較・接続詞（when / if / because / that）。
                    完了・受け身・関係詞・分詞の後置修飾は使わない
    3級（level 3）: 4級に加えて現在完了・受け身・関係代名詞（who / which / that）・分詞の後置修飾・間接疑問。
                    過去完了・仮定法・分詞構文・関係詞の what / whose / whom は使わない
  規則は語の並びだけで見るので、見落としや誤検出がある（形容詞の tired を過去分詞と見るなど）。
  誤検出の語は例文ごとに OK に足す。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDS = json.loads((ROOT / "data/words.json").read_text(encoding="utf-8"))
PAIRS = json.loads((ROOT / "data/pairs.json").read_text(encoding="utf-8"))

IRREGULAR_PAST = set("""was were went came saw took gave made got had said told found thought knew ate drank ran sat stood felt
kept bought brought caught taught wrote broke spoke chose began swam sang flew fell forgot held lost met paid sold sent spent won woke
wore threw built heard hid rode rose drove grew drew froze slept fought understood became did led lay hung meant shot shook struck stole
tore bit blew dug fed forgave lent lit sank shone shut slid spun spread stuck stung swept swung wept wound bent bled bound bred dealt
fled flung ground knelt leapt overcame overtook rang sought sprang strode strove swore upset withdrew""".split())
PARTICIPLE = set("""been done gone seen taken given eaten written spoken broken chosen known grown drawn driven fallen forgotten hidden
ridden shown stolen thrown worn flown frozen beaten begun sung swum drunk born torn sworn woken bitten blown shaken risen forbidden
forgiven mistaken overtaken withdrawn""".split()) | IRREGULAR_PAST - {"was", "were", "went", "ate", "saw", "gave", "took", "wrote",
    "spoke", "broke", "chose", "began", "swam", "sang", "flew", "fell", "forgot", "knew", "grew", "drew", "froze", "drank", "ran",
    "came", "became", "did", "rode", "rose", "drove", "hid", "woke", "wore", "threw", "tore", "bit", "blew", "shook", "stole", "rang",
    "sprang", "sank", "strode", "strove", "swore", "overcame", "overtook", "withdrew", "lay"}
# -ed で終わるが過去形ではない語
NOT_ED = set("""bed red need seed feed speed shed sled hundred weed breed bleed greed steed reed deed indeed proceed exceed succeed
sacred naked wicked rugged ragged wretched beloved kindred hatred shred embed bred fled led fed sped""".split())
# -ing で終わるが動詞の -ing 形ではない語
NOT_ING = set("""morning evening something anything nothing everything thing things king kings ring rings sing wing wings spring
string strings sting swing bring during ceiling building buildings clothing ending painting paintings meeting meetings wedding
pudding stuffing icing earring earrings darling sibling siblings feeling feelings lightning ginger finger fingers
interesting exciting amazing boring surprising""".split())
# 不定詞（to + 動詞の原形）を見つけるための動詞。words.json の動詞に、よく使う動詞を足す
VERBS = {w["word"].lower() for w in WORDS if w["pos"].startswith("動詞")} | set("""be do go come get make take give have see look
watch hear listen say tell talk speak ask answer know think feel find keep leave put let help try use buy sell pay eat drink cook
play run walk swim ride drive fly sit stand sleep wake read write draw sing dance study learn teach work live stay visit meet call
open close start begin finish stop wait win lose change carry bring send show catch throw hold turn move become grow wear wash clean
break build fix spend save choose decide forget remember understand believe hope want need like love enjoy agree protect travel
explain prepare solve join follow return arrive leave reach hurt kill fight attack escape hide""".split()) - {"school", "bed", "work", "music"}
# -est で終わるが最上級ではない語
NOT_EST = set("forest west interest test guest chest nest rest contest request harvest quest vest pest protest".split())
ADVERBS = {"never", "ever", "already", "just", "not", "always", "also", "still", "often", "finally", "recently"}
BE = r"(?:am|is|are|was|were|be|been|being|'m|'s|'re)"
HAVE = r"(?:have|has|had|'ve|'d)"


def tokens(s):
    return re.findall(r"[A-Za-z]+(?=n't)|n't|[A-Za-z]+|'[a-z]+", s.replace("’", "'"))


def is_pp(t):
    t = t.lower()
    return t in PARTICIPLE or (t.endswith("ed") and len(t) > 3 and t not in NOT_ED)


def features(sentence):
    """例文に含まれる文法事項の名前の集合"""
    s = sentence.replace("’", "'")
    low = s.lower()
    raw = tokens(s)
    toks = [t.lower() for t in raw]
    f = set()
    for i, t in enumerate(toks):
        prev = toks[i - 1] if i else ""
        proper = i and raw[i][0].isupper()
        if not proper and (t in IRREGULAR_PAST or (t.endswith("ed") and len(t) > 3 and t not in NOT_ED)):
            f.add("過去形")
        # go swimming（〜しに行く）は5級の表現
        if t.endswith("ing") and len(t) > 4 and t not in NOT_ING and not proper \
                and not re.fullmatch(BE, prev) and prev not in ("not", "go", "goes"):
            f.add("動名詞・分詞")
        if t in ("than", "more", "most", "less", "least") or re.fullmatch(r"\w+est", t) and prev == "the" and t not in NOT_EST:
            f.add("比較")
    if re.search(r"\b(?:will|won't|shall)\b|'ll\b|\bgoing to\b", low):
        f.add("未来")
    if re.search(r"\b(?:must|should|may|might|could|would|have to|has to|had to)\b|'d\b", low):
        f.add("助動詞")
    for m in re.finditer(r"\bto (?:not )?([a-z]+)\b", s):
        if m.group(1) in VERBS and not re.search(rf"\b(?:nice|glad|happy) to (?:meet|see)\b", low):
            f.add("不定詞")
    if re.search(r"(?<!^)\b(?:when|if|because|though|although|while|until|since|after|before|so that)\b(?= \w+ )", low) \
            and not re.match(r"(?:when|if)\b", low):
        f.add("接続詞")
    elif re.match(r"(?:when|if|because|though|although|while|until|since)\b.*,", low):
        f.add("接続詞")
    # have + 過去分詞（間に副詞が1語入ってもよい: have never seen）
    for m in re.finditer(rf"(?:\b|(?<=\w)){HAVE}\s+(\w+)(?:\s+(\w+))?", low):
        for pp in (m.group(1), m.group(2) if m.group(1).endswith("ly") or m.group(1) in ADVERBS else None):
            if pp and is_pp(pp) and pp not in ("had", "made", "got"):
                f.add("過去完了" if m.group(0).startswith(("had", "'d")) else "現在完了")
    if re.search(rf"\b{HAVE}\s+(?:\w+\s+)?been\b", low):
        f.add("過去完了" if re.search(r"\bhad\s+(?:\w+\s+)?been\b", low) else "現在完了")
    for m in re.finditer(rf"(?:\b|(?<=\w)){BE}\s+(?:\w+ly\s+|not\s+|also\s+|always\s+|never\s+|still\s+|often\s+)?(\w+)", low):
        if is_pp(m.group(1)):
            f.add("受け身")
    if re.search(r"(?<!^)\b(?:who|which)\b(?![^,]*\?)", low) or re.search(r"\w+ (?:that) (?:is|are|was|were|has|have|can|will)\b", low):
        f.add("関係代名詞")
    if re.search(r"(?<!^)\b(?:whose|whom)\b", low) or re.search(r"(?<!^)\bwhat (?!a\b|an\b)\w+ (?:\w+ )?(?:is|was|need|want|said|say|do|did)\b", low) and not low.startswith("what"):
        f.add("関係詞 what・whose・whom")
    if re.search(r"\b(?:would|could|might|should|must) have\b", low) or re.search(r"\bif\b[^.]*\b(?:were|had)\b", low) \
            or re.search(r"\b(?:wish|as if|as though)\b", low):
        f.add("仮定法")
    if re.match(r"(?:having|being|\w+ing|\w+ed)\b[^,.]*,", low) and not re.match(r"(?:morning|evening|nothing|something|everything)\b", low):
        f.add("分詞構文")
    return f


ALLOWED = {
    1: set(),
    2: {"過去形", "動名詞・分詞", "比較", "未来", "助動詞", "不定詞", "接続詞"},
    3: {"過去形", "動名詞・分詞", "比較", "未来", "助動詞", "不定詞", "接続詞", "現在完了", "受け身", "関係代名詞"},
}
# 規則にかかるが、その級の範囲の文（誤検出）。{例文: 無視する事項}
OK = {
    "Cooking is my hobby.": ["動名詞・分詞"],  # 見出し語の cooking（名詞）
    "I'm full. I can't eat any more.": ["比較"],  # any more は「これ以上」
    "This plan is better than that one.": ["比較"],  # 見出し語が better
}
MAX_WORDS = {1: 9, 2: 11, 3: 13}


def problems(sentence, level):
    """その級の範囲をこえる文法事項（と長すぎる文）"""
    if level not in ALLOWED:
        return []
    out = sorted(features(sentence) - ALLOWED[level] - set(OK.get(sentence, [])))
    n = len(tokens(sentence))
    if n > MAX_WORDS[level]:
        out.append(f"長い（{n}語）")
    return out


def examples():
    for w in WORDS:
        yield w["level"], w["id"], w["example"]["en"]
    for p in PAIRS:
        for x in p["words"]:
            yield p["level"], f"pair:{p['id']}/{x['word']}", x["example"]["en"]


def main():
    only = int(sys.argv[sys.argv.index("--level") + 1]) if "--level" in sys.argv else None
    found = 0
    for lv, key, en in examples():
        if only and lv != only:
            continue
        p = problems(en, lv)
        if p:
            found += 1
            print(f"{lv}\t{key}\t{'・'.join(p)}\t{en}")
    print(f"{found} 件", file=sys.stderr)


if __name__ == "__main__":
    main()
