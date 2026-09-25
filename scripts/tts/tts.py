#!/usr/bin/env python3
"""Vocab Quest 音声パイプライン（事前生成・差分更新）

  python3 scripts/tts/tts.py utterances              # data/*.json → tts/utterances.json（読み上げる文の一覧）
  python3 scripts/tts/tts.py estimate [--tier core]  # 容量と再生時間の見積もり
  python3 scripts/tts/tts.py design --voice NAME     # 声を文章で設計し、参照音声の候補を作る（Qwen3-TTS VoiceDesign）
  python3 scripts/tts/tts.py synth  --voice NAME     # 音声を生成（生成済みはスキップ）→ audio/NAME/
  python3 scripts/tts/tts.py qa     --voice NAME     # Whisper で聞き取り、読み間違いを検出（要 faster-whisper）
  python3 scripts/tts/tts.py review --voice NAME     # 耳で確認するための一覧ページ audio/NAME/review.html
  python3 scripts/tts/tts.py prune  --voice NAME     # どの文からも参照されない古い音声ファイルを削除

声（エンジン・モデル・話者）は tts/voices/NAME.json で定義する。
ファイル名は「声の設定 + 言語 + 読み上げ文」のハッシュなので、文や声を変えた所だけが再生成される。
"""
import argparse
import concurrent.futures
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TTS_DIR = ROOT / "tts"
AUDIO_DIR = ROOT / "audio"
UTTERANCES = TTS_DIR / "utterances.json"
LEXICON = TTS_DIR / "lexicon.json"

# tier: core＝ゲーム中に使う短い音声 / extended＝図鑑の語源解説など長めの音声
TIERS = ("core", "extended")


# ---------- 読み上げる文の一覧 ----------
def syn_key(word):
    return "syn." + re.sub(r"[^a-z0-9]+", "-", word.lower()).strip("-")


def ja_for_speech(text):
    """表示用の日本語を読み上げ用に整える。"""
    text = re.sub(r"（([^）]*)）", r" \1 ", text)          # 括弧は外して中身を読む
    for src, dst in (("・", "、"), ("〜", "から"), ("→", "、"), ("＝", "、"), ("＿＿＿", "")):
        text = text.replace(src, dst)
    return re.sub(r"\s+", " ", text).strip()


def strip_diacritics(text):
    """pōtiō → potio。ラテン語などの長音記号は日英どちらのエンジンも読めないため外す。

    ラテン文字だけを対象にする（仮名の濁点「び」→「ひ」や全角記号を壊さないため）。
    """
    out = []
    for ch in text:
        base = unicodedata.normalize("NFD", ch)
        out.append(base[0] if len(base) > 1 and base[0].isascii() else ch)
    return "".join(out)


def build_utterances():
    words = json.loads((ROOT / "data/words.json").read_text(encoding="utf-8"))
    items = {}

    def add(key, lang, text, tier="core"):
        items[key] = {"lang": lang, "text": text, "tier": tier}

    for w in words:
        # 英語以外の形（lang がある語）はアプリがブラウザの読み上げでその言語の発音にする
        if "lang" not in w:
            add(f"{w['id']}.word", "en", w["word"])
        add(f"{w['id']}.katakana", "ja", ja_for_speech(w["katakana"]))
        add(f"{w['id']}.meaning", "ja", ja_for_speech(w["meaning"]))
        add(f"{w['id']}.example.en", "en", w["example"]["en"])
        add(f"{w['id']}.example.ja", "ja", ja_for_speech(w["example"]["ja"]))
        add(f"{w['id']}.story", "ja", ja_for_speech(strip_diacritics(w["etymology"]["story"])), "extended")
        for s in w["synonyms"]:
            add(syn_key(s["word"]), "en", s["word"])
    # 似た単語セット（キーは app/app.js の pairWordKey / pairExampleKey と同じ）
    for p in json.loads((ROOT / "data/pairs.json").read_text(encoding="utf-8")):
        for x in p["words"]:
            add(f"pw.{x['word']}", "en", x["word"])
            add(f"pe.{p['id']}.{x['word']}", "en", x["example"]["en"])
    return dict(sorted(items.items()))


def load_utterances():
    if not UTTERANCES.exists():
        sys.exit("tts/utterances.json がありません。先に `utterances` を実行してください。")
    return json.loads(UTTERANCES.read_text(encoding="utf-8"))


def spoken_text(key, item, lexicon):
    """辞書（読み修正）を適用した、実際にエンジンへ渡す文。"""
    if key in lexicon.get("keys", {}):
        return lexicon["keys"][key]
    text = item["text"]
    for src, dst in lexicon.get(item["lang"], {}).items():
        text = text.replace(src, dst)
    return text


def load_lexicon():
    return json.loads(LEXICON.read_text(encoding="utf-8")) if LEXICON.exists() else {}


# ---------- 声の設定 ----------
def load_voice(name):
    path = TTS_DIR / "voices" / f"{name}.json"
    if not path.exists():
        sys.exit(f"{path.relative_to(ROOT)} がありません")
    voice = json.loads(path.read_text(encoding="utf-8"))
    voice["name"] = name
    return voice


def voice_fingerprint(voice):
    """音に影響する設定だけをハッシュの材料にする（出力形式や並列数を変えても再生成しない）。"""
    return {k: voice.get(k) for k in ("version", "backend", "gpt_sovits", "qwen3", "command", "lang_map", "post")}


def audio_hash(voice, lang, text):
    payload = json.dumps([voice_fingerprint(voice), lang, text], ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:16]


# ---------- 合成バックエンド ----------
def synth_gpt_sovits(voice, lang, text, wav_path):
    """GPT-SoVITS の api_v2.py（POST /tts）を呼ぶ。"""
    cfg = voice["gpt_sovits"]
    body = {
        "text": text,
        "text_lang": voice.get("lang_map", {}).get(lang, lang),
        "media_type": "wav",
        "streaming_mode": False,
        **cfg.get("params", {}),
        **cfg.get("ref", {}).get(lang, cfg.get("ref", {}).get("default", {})),
    }
    req = urllib.request.Request(
        cfg["url"].rstrip("/") + "/tts",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=cfg.get("timeout", 300)) as res:
        Path(wav_path).write_bytes(res.read())


def synth_command(voice, lang, text, wav_path):
    """任意のコマンドを呼ぶ（Qwen3-TTS・Style-Bert-VITS2 などの推論スクリプト用）。

    argv の {text} {text_file} {lang} {out} を置換する。シェルは経由しない。
    """
    with tempfile.NamedTemporaryFile("w", suffix=".txt", encoding="utf-8", delete=False) as f:
        f.write(text)
        text_file = f.name
    try:
        subs = {"text": text, "text_file": text_file, "lang": voice.get("lang_map", {}).get(lang, lang), "out": str(wav_path)}
        argv = [a.format(**subs) for a in voice["command"]]
        subprocess.run(argv, check=True, capture_output=True, timeout=voice.get("timeout", 300))
    finally:
        Path(text_file).unlink(missing_ok=True)


_QWEN = {}


def qwen3_model(name, cfg):
    """Qwen3-TTS（pip install qwen-tts）のモデルを1回だけ読み込む（jobs は 1 にする）。"""
    if name not in _QWEN:
        import torch
        from qwen_tts import Qwen3TTSModel
        # AMD Radeon も ROCm 版 PyTorch なら "cuda:0" で動く。bfloat16 が遅い・使えない GPU や CPU では dtype を変える
        kwargs = {"device_map": cfg.get("device", "cuda:0"), "dtype": getattr(torch, cfg.get("dtype", "bfloat16"))}
        if cfg.get("attn_implementation"):
            kwargs["attn_implementation"] = cfg["attn_implementation"]
        _QWEN[name] = Qwen3TTSModel.from_pretrained(name, **kwargs)
    return _QWEN[name]


def resolve_path(path):
    """声の設定に書くパスは、相対パスならリポジトリのルートからとみなす。"""
    p = Path(path)
    return p if p.is_absolute() else ROOT / p


_QWEN_PROMPT = {}


def synth_qwen3(voice, lang, text, wav_path):
    """Qwen3-TTS でボイスクローン。参照音声から作る声の特徴は1回だけ計算して使い回す。"""
    import soundfile as sf
    cfg = voice["qwen3"]
    model = qwen3_model(cfg["model"], cfg)
    ref = str(resolve_path(cfg["ref_audio"]))
    if ref not in _QWEN_PROMPT:
        _QWEN_PROMPT[ref] = model.create_voice_clone_prompt(ref_audio=ref, ref_text=cfg["ref_text"])
    wavs, sr = model.generate_voice_clone(
        text=text,
        language=voice.get("lang_map", {}).get(lang, lang),
        voice_clone_prompt=_QWEN_PROMPT[ref],
    )
    sf.write(str(wav_path), wavs[0], sr)


BACKENDS = {"gpt_sovits": synth_gpt_sovits, "qwen3": synth_qwen3, "command": synth_command}


# ---------- 後処理（無音カット・音量正規化・圧縮） ----------
def encode(voice, wav_path, out_base):
    post = {"bitrate_opus": "24k", "bitrate_aac": "48k", "loudness": -18, **voice.get("post", {})}
    trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05"
    af = f"{trim},areverse,{trim},areverse,loudnorm=I={post['loudness']}:TP=-1.5:LRA=11,apad=pad_dur=0.08"
    outputs = []
    for fmt in voice.get("formats", ["webm"]):
        codec = ["-c:a", "libopus", "-b:a", post["bitrate_opus"]] if fmt == "webm" else ["-c:a", "aac", "-b:a", post["bitrate_aac"]]
        out = f"{out_base}.{fmt}"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), "-af", af, "-ar", "48000", "-ac", "1", *codec, out],
            check=True,
        )
        outputs.append(out)
    return outputs


# ---------- コマンド ----------
def cmd_utterances(_args):
    items = build_utterances()
    UTTERANCES.parent.mkdir(exist_ok=True)
    UTTERANCES.write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts = {t: sum(1 for i in items.values() if i["tier"] == t) for t in TIERS}
    print(f"{UTTERANCES.relative_to(ROOT)}: {len(items)} 件 {counts}")


def estimate_seconds(item):
    # 実測に近い目安：英語 約14文字/秒、日本語 約7.5文字/秒 ＋ 前後の間
    rate = 14 if item["lang"] == "en" else 7.5
    return len(item["text"]) / rate + 0.35


def cmd_estimate(args):
    items = load_utterances()
    rows = []
    for tier in TIERS:
        for lang in ("en", "ja"):
            sel = [i for i in items.values() if i["tier"] == tier and i["lang"] == lang]
            sec = sum(estimate_seconds(i) for i in sel)
            rows.append((tier, lang, len(sel), sec))
    # 実測（短いファイルはコンテナ分が効くため）：Opus 24k ≒ 30kbps、AAC 48k ≒ 62kbps
    opus_bps, aac_bps = 3800, 7800
    print(f"{'tier':9}{'lang':5}{'件数':>6}{'秒':>8}{'webm':>10}{'m4a':>10}")
    total_n = total_sec = 0
    for tier, lang, n, sec in rows:
        if args.tier and tier != args.tier:
            continue
        total_n += n
        total_sec += sec
        print(f"{tier:9}{lang:5}{n:>6}{sec:>8.0f}{sec * opus_bps / 1e6:>9.2f}M{sec * aac_bps / 1e6:>9.2f}M")
    print(f"{'合計':12}{total_n:>6}{total_sec:>8.0f}{total_sec * opus_bps / 1e6:>9.2f}M{total_sec * aac_bps / 1e6:>9.2f}M")


def cmd_synth(args):
    voice = load_voice(args.voice)
    if voice["backend"] not in BACKENDS:
        sys.exit(f"未対応の backend: {voice['backend']}")
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg が必要です")
    items = load_utterances()
    lexicon = load_lexicon()
    tiers = set(args.tier or voice.get("tiers", ["core"]))
    out_dir = AUDIO_DIR / voice["name"]
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest_items, todo = {}, {}
    for key, item in items.items():
        if item["tier"] not in tiers or (args.only and not re.search(args.only, key)):
            continue
        text = spoken_text(key, item, lexicon)
        h = audio_hash(voice, item["lang"], text)
        manifest_items[key] = h
        if args.force or not all((out_dir / f"{h}.{fmt}").exists() for fmt in voice.get("formats", ["webm"])):
            todo.setdefault(h, (item["lang"], text, key))  # 同じ文は1回だけ生成

    print(f"{voice['name']}: {len(manifest_items)} 件中 {len(todo)} 件を生成します")
    synth = BACKENDS[voice["backend"]]
    failed = []

    def run(h, lang, text, key):
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "raw.wav"
            synth(voice, lang, text, wav)
            encode(voice, wav, out_dir / h)

    with concurrent.futures.ThreadPoolExecutor(max_workers=voice.get("jobs", 1)) as pool:
        futures = {pool.submit(run, h, *v): v[2] for h, v in todo.items()}
        for i, fut in enumerate(concurrent.futures.as_completed(futures), 1):
            try:
                fut.result()
            except Exception as e:  # 1件の失敗で全体を止めない
                failed.append(futures[fut])
                print(f"  ✗ {futures[fut]}: {e}", file=sys.stderr)
            if i % 50 == 0 or i == len(futures):
                print(f"  {i}/{len(futures)}")

    for key in failed:
        manifest_items.pop(key, None)
    manifest = {
        "voice": voice["name"],
        "label": voice.get("label", voice["name"]),
        "credit": voice.get("credit", ""),
        "base": f"audio/{voice['name']}/",
        "formats": voice.get("formats", ["webm"]),
        "items": manifest_items,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    # activate: false の声（動作確認用など）はアプリの音声を切り替えない
    if not args.no_activate and voice.get("activate", True):
        (AUDIO_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False) + "\n", encoding="utf-8")
    size = sum(p.stat().st_size for p in out_dir.iterdir() if p.suffix in (".webm", ".m4a"))
    print(f"完了: 失敗 {len(failed)} 件 / audio/{voice['name']}/ 合計 {size / 1e6:.2f} MB")
    if not voice.get("activate", True):
        print("※ この声は activate: false のため、アプリはブラウザ標準の読み上げのままです")
    if failed:
        sys.exit(1)


def load_manifest(voice_name):
    path = AUDIO_DIR / voice_name / "manifest.json"
    if not path.exists():
        sys.exit(f"{path.relative_to(ROOT)} がありません。先に synth を実行してください。")
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_for_compare(text, lang):
    text = unicodedata.normalize("NFKC", text).lower()
    if lang == "en":
        return re.sub(r"[^a-z0-9' ]+", " ", text).split()
    return list(re.sub(r"[\s、。，．,.!?！？「」『』（）()・…ー-]+", "", text))


def edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def cmd_design(args):
    """VoiceDesign で「声の説明文」から参照音声の候補を作る。

    毎回ちがう声になるので、候補を並べて聞き比べ、気に入った1つを参照音声（qwen3.ref_audio）にする。
    以後の synth はその参照音声のクローンで話すので、全音声が同じ声になる。
    """
    import soundfile as sf
    import torch
    voice = load_voice(args.voice)
    cfg = voice["qwen3"]
    design = cfg["design"]
    model = qwen3_model(design.get("model", "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"), cfg)
    out_dir = TTS_DIR / "design" / args.voice
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for i in range(args.count):
        seed = args.seed + i
        torch.manual_seed(seed)
        wavs, sr = model.generate_voice_design(
            text=cfg["ref_text"],
            language=voice.get("lang_map", {}).get(design.get("lang", "ja"), design.get("lang", "ja")),
            instruct=design["instruct"],
        )
        name = f"seed{seed}.wav"
        sf.write(str(out_dir / name), wavs[0], sr)
        rows.append(f'<tr><td>seed {seed}</td><td><audio controls preload=none src="{name}"></audio></td></tr>')
        print(f"  {name}")
    page = f"""<!doctype html><meta charset=utf-8><title>声の候補 {html.escape(args.voice)}</title>
<style>body{{font-family:sans-serif;margin:2em}}td{{padding:.3em .8em}}</style>
<h1>声の候補：{html.escape(args.voice)}</h1><p>{html.escape(design["instruct"])}</p>
<p>気に入った候補を {html.escape(cfg["ref_audio"])} にコピーしてから synth を実行する。</p>
<table>{"".join(rows)}</table>"""
    (out_dir / "index.html").write_text(page, encoding="utf-8")
    print(f"{args.count} 件 → {(out_dir / 'index.html').relative_to(ROOT)}")


def cmd_qa(args):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("pip install faster-whisper が必要です")
    manifest = load_manifest(args.voice)
    items = load_utterances()
    model = WhisperModel(args.model, device=args.device, compute_type="int8" if args.device == "cpu" else "float16")
    fmt = manifest["formats"][0]
    report = []
    for key, h in manifest["items"].items():
        if args.only and not re.search(args.only, key):
            continue
        item = items[key]
        segs, _ = model.transcribe(str(AUDIO_DIR / args.voice / f"{h}.{fmt}"), language=item["lang"], beam_size=5)
        heard = "".join(s.text for s in segs).strip()
        ref, hyp = normalize_for_compare(item["text"], item["lang"]), normalize_for_compare(heard, item["lang"])
        err = edit_distance(ref, hyp) / max(1, len(ref))
        report.append({"key": key, "lang": item["lang"], "text": item["text"], "heard": heard, "error": round(err, 3)})
    report.sort(key=lambda r: -r["error"])
    out = TTS_DIR / "qa" / f"{args.voice}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    bad = [r for r in report if r["error"] > args.threshold]
    for lang in ("en", "ja"):
        rs = [r["error"] for r in report if r["lang"] == lang]
        if rs:
            print(f"{lang}: 平均誤り率 {sum(rs) / len(rs):.1%}（{'WER' if lang == 'en' else 'CER'}）")
    print(f"しきい値 {args.threshold:.0%} 超え: {len(bad)} 件 → {out.relative_to(ROOT)}")
    for r in bad[:20]:
        print(f"  {r['error']:.0%}  {r['key']}\n       文: {r['text']}\n     聞取: {r['heard']}")


def cmd_review(args):
    manifest = load_manifest(args.voice)
    items = load_utterances()
    qa_path = TTS_DIR / "qa" / f"{args.voice}.json"
    qa = {r["key"]: r for r in json.loads(qa_path.read_text(encoding="utf-8"))} if qa_path.exists() else {}
    rows = sorted(manifest["items"].items(), key=lambda kv: -qa.get(kv[0], {}).get("error", 0))
    fmt = manifest["formats"][0]
    cells = []
    for key, h in rows:
        item, r = items[key], qa.get(key, {})
        err = f"{r['error']:.0%}" if r else ""
        cells.append(
            f"<tr><td><code>{html.escape(key)}</code></td><td>{item['lang']}</td><td>{html.escape(item['text'])}</td>"
            f"<td>{html.escape(r.get('heard', ''))}</td><td>{err}</td>"
            f"<td><audio controls preload=none src='{h}.{fmt}'></audio></td></tr>")
    body = "\n".join(cells)
    page = f"""<!doctype html><meta charset=utf-8><title>音声レビュー {html.escape(args.voice)}</title>
<style>body{{font-family:sans-serif;margin:16px}}table{{border-collapse:collapse;width:100%}}td,th{{border-top:1px solid #ccc;padding:4px;font-size:14px;text-align:left}}</style>
<h1>音声レビュー：{html.escape(manifest['label'])}（{len(rows)} 件）</h1>
<p>QA の誤り率が高い順。読み間違いは tts/lexicon.json で読みを直して synth を再実行すると、その文だけ作り直されます。</p>
<table><tr><th>key</th><th>言語</th><th>文</th><th>Whisper 聞き取り</th><th>誤り率</th><th>音声</th></tr>
{body}</table>"""
    out = AUDIO_DIR / args.voice / "review.html"
    out.write_text(page, encoding="utf-8")
    print(f"{out.relative_to(ROOT)} を作りました（ローカルサーバー経由で開いてください）")


def cmd_prune(args):
    manifest = load_manifest(args.voice)
    keep = set(manifest["items"].values())
    removed = 0
    for p in (AUDIO_DIR / args.voice).iterdir():
        if p.suffix in (".webm", ".m4a") and p.stem not in keep:
            p.unlink()
            removed += 1
    print(f"{removed} ファイルを削除しました")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("utterances")
    p = sub.add_parser("estimate")
    p.add_argument("--tier", choices=TIERS)
    p = sub.add_parser("design")
    p.add_argument("--voice", required=True)
    p.add_argument("--count", type=int, default=8, help="作る候補の数")
    p.add_argument("--seed", type=int, default=1, help="最初の候補の乱数シード（同じシードなら同じ声）")
    p = sub.add_parser("synth")
    p.add_argument("--voice", required=True)
    p.add_argument("--tier", action="append", choices=TIERS, help="省略時は声の設定の tiers（既定 core）")
    p.add_argument("--only", help="key の正規表現で絞り込む（例: '^potion\\.'）")
    p.add_argument("--force", action="store_true", help="生成済みでも作り直す")
    p.add_argument("--no-activate", action="store_true", help="audio/manifest.json を更新しない")
    p = sub.add_parser("qa")
    p.add_argument("--voice", required=True)
    p.add_argument("--model", default="large-v3")
    p.add_argument("--device", default="cpu")
    p.add_argument("--threshold", type=float, default=0.15)
    p.add_argument("--only", help="key の正規表現で絞り込む")
    p = sub.add_parser("review")
    p.add_argument("--voice", required=True)
    p = sub.add_parser("prune")
    p.add_argument("--voice", required=True)
    args = ap.parse_args()
    {"utterances": cmd_utterances, "estimate": cmd_estimate, "design": cmd_design, "synth": cmd_synth,
     "qa": cmd_qa, "review": cmd_review, "prune": cmd_prune}[args.cmd](args)


if __name__ == "__main__":
    main()
