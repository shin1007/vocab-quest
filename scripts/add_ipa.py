#!/usr/bin/env python3
"""data/words.json の発音記号（ipa）がない語に、CMU 発音辞書から発音記号を入れる。

使い方: python3 scripts/add_ipa.py [cmudict.dict のパス]
  パスを省くと CMU 発音辞書（cmusphinx/cmudict、BSD 系ライセンス）をダウンロードする。
  すでに ipa がある語は変えない。辞書にない語は scripts/ipa_manual.json に書いておく。

表記は data/pairs.json と同じ米音（hæt, ˈkɜːri, boʊt など）。自動で入れるときは第1強勢（ˈ）だけを付け、1音節語には付けない。
英語以外の形で収録した語（lang のある語）は、その言語での発音を scripts/ipa_manual.json に書く。
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = ROOT / "data/words.json"
MANUAL_PATH = ROOT / "scripts/ipa_manual.json"
CMU_URL = "https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict"

# ARPAbet → IPA。母音は強勢の有無で形を変える（強勢なしの AH は ə、ER は ər など）
VOWELS = {
    "AA": ("ɑː", "ɑː"), "AE": ("æ", "æ"), "AH": ("ʌ", "ə"), "AO": ("ɔː", "ɔː"), "AW": ("aʊ", "aʊ"),
    "AY": ("aɪ", "aɪ"), "EH": ("e", "e"), "ER": ("ɜːr", "ər"), "EY": ("eɪ", "eɪ"), "IH": ("ɪ", "ɪ"),
    "IY": ("iː", "i"), "OW": ("oʊ", "oʊ"), "OY": ("ɔɪ", "ɔɪ"), "UH": ("ʊ", "ʊ"), "UW": ("uː", "u"),
}
CONSONANTS = {
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "F": "f", "G": "ɡ", "HH": "h", "JH": "dʒ", "K": "k",
    "L": "l", "M": "m", "N": "n", "NG": "ŋ", "P": "p", "R": "r", "S": "s", "SH": "ʃ", "T": "t",
    "TH": "θ", "V": "v", "W": "w", "Y": "j", "Z": "z", "ZH": "ʒ",
}
# 音節のはじめに来られる子音の並び（強勢記号を置く位置を決めるのに使う）
ONSETS = {tuple(o.split("_")) for o in """
P B T D K G F V TH DH S Z SH ZH HH CH JH M N L R W Y
P_L P_R B_L B_R T_R D_R K_L K_R G_L G_R F_L F_R TH_R SH_R
T_W D_W K_W G_W S_W TH_W P_Y B_Y K_Y G_Y F_Y V_Y HH_Y M_Y N_Y
S_P S_T S_K S_M S_N S_L S_F S_P_R S_T_R S_K_R S_P_L S_K_W S_P_Y S_K_Y
""".split()}

# 名詞・形容詞は前、動詞は後ろの音節に強勢がくる語
STRESS_SHIFT = set("""
record present object project produce conduct contract contrast convert convict desert export import increase
decrease insult permit progress protest rebel refund reject subject suspect survey transfer transport upset
update discount conflict content digest extract combat compound escort insert invite perfect recall segment
torment conscript contest defect exploit implant incline perfume rebound refill replay reprint retake rewrite
recount remake upgrade frequent address consort console convoy discharge ferment finance impact impress
imprint intern overflow overlap override overthrow overturn produce prospect rebound relay research
""".split())


def load_cmu(path):
    text = Path(path).read_text(encoding="utf-8") if path else urllib.request.urlopen(CMU_URL).read().decode("utf-8")
    cmu = {}
    for line in text.splitlines():
        parts = line.split("#")[0].split()
        if parts:
            cmu.setdefault(re.sub(r"\(\d+\)$", "", parts[0]), []).append(parts[1:])
    return cmu


def to_ipa(phones):
    """ARPAbet の列を IPA にする。第1強勢の音節の頭に ˈ を置く（1音節語には付けない）"""
    vowel_idx = [i for i, p in enumerate(phones) if p[:2] in VOWELS]
    out = []
    mark = None
    stressed = [i for i in vowel_idx if phones[i].endswith("1")]
    if len(vowel_idx) > 1 and stressed:
        v = stressed[0]
        prev = max([i for i in vowel_idx if i < v], default=-1)
        cluster = phones[prev + 1:v]
        # 前の母音との間の子音のうち、音節のはじめに来られるいちばん長い並びを次の音節に付ける
        start = v
        if prev < 0:
            start = 0
        else:
            for k in range(len(cluster) + 1):
                if k == len(cluster) or tuple(cluster[k:]) in ONSETS:
                    start = prev + 1 + k
                    break
        mark = start
    for i, p in enumerate(phones):
        if i == mark:
            out.append("ˈ")
        if p[:2] in VOWELS and p[-1].isdigit():
            weak = p[-1] == "0"
            # 強勢のない語末・母音の前の IY は短い i（happy, reality, Slovakia）
            if p[:2] == "IY" and p[-1] != "1" and (i + 1 == len(phones) or phones[i + 1][-1].isdigit()):
                weak = True
            out.append(VOWELS[p[:2]][1 if weak else 0])
        else:
            out.append(CONSONANTS[p])
    return "".join(out)


def stress_pos(phones):
    vs = [p for p in phones if p[-1].isdigit()]
    return next((i for i, p in enumerate(vs) if p.endswith("1")), 0)


def choose(word, variants, pos):
    """発音が複数あるときは最初のもの。ただし品詞で発音が変わる語は品詞で選ぶ
    （名詞・形容詞は前、動詞は後ろに強勢がある record 型と、動詞だけ語末が /eɪt/ になる estimate 型）"""
    if len(variants) < 2 or not pos:
        return variants[0]
    verb = pos.startswith("動詞")
    if word in STRESS_SHIFT:
        return (max if verb else min)(variants, key=stress_pos)
    if word.endswith("ate"):
        ate = [v for v in variants if v[-2:] in (["EY2", "T"], ["EY1", "T"])]
        other = [v for v in variants if v not in ate]
        if ate and other:
            return ate[0] if verb else other[0]
    return variants[0]


def word_ipa(word, pos, cmu):
    key = word.lower()
    if key in cmu:
        return to_ipa(choose(key, cmu[key], pos))
    tokens = [t for t in re.split(r"[ \-]+", key.replace(",", "")) if t]
    if len(tokens) > 1 and all(t in cmu for t in tokens):
        return " ".join(to_ipa(choose(t, cmu[t], pos)) for t in tokens)
    return None


def main():
    cmu = load_cmu(sys.argv[1] if len(sys.argv) > 1 else None)
    manual = json.loads(MANUAL_PATH.read_text(encoding="utf-8"))
    pairs = {x["word"]: x["ipa"] for p in json.loads((ROOT / "data/pairs.json").read_text(encoding="utf-8")) for x in p["words"]}
    words = json.loads(WORDS_PATH.read_text(encoding="utf-8"))
    lines = WORDS_PATH.read_text(encoding="utf-8").split("\n")
    missing = []
    added = 0
    by_id = {w["id"]: w for w in words}
    for i, line in enumerate(lines):
        m = re.match(r'^    "id": "([^"]+)", "word": ("[^"]*"), ', line)
        if not m:
            continue
        w = by_id[m.group(1)]
        if w.get("ipa"):
            continue
        ipa = manual.get(w["word"]) or pairs.get(w["word"]) or word_ipa(w["word"], w["pos"], cmu)
        if not ipa:
            missing.append(w["word"])
            continue
        lines[i] = line.replace(f'"word": {m.group(2)}, ', f'"word": {m.group(2)}, "ipa": {json.dumps(ipa, ensure_ascii=False)}, ', 1)
        added += 1
    WORDS_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"{added} 語に発音記号を入れました")
    if missing:
        print(f"辞書にない語（scripts/ipa_manual.json に書いてください）: {len(missing)} 語", file=sys.stderr)
        print("\n".join(missing), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
