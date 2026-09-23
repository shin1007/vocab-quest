# Vocab Quest 🗝️

ゲーム・まんが・アニメで**すでに知っているカタカナ語**（ポーション、クエスト、クリティカル…）を足場にして、
英単語を学ぶ **RPG** のプロトタイプです。
名前とジョブを決めて「ことばの大陸」を冒険し、コマンドバトルで問題に答えて敵を倒します。

- **語源**でつながりを知る：「ポーション（potion）と毒（poison）は兄弟語」
- **類義語**のニュアンスと語源を比べる：potion / elixir / remedy / draught
- **カタカナの罠**を見抜く：「テンション高い」は英語で *I'm so excited!*

## 中身

| パス | 内容 |
|---|---|
| [`docs/UX_DESIGN.md`](docs/UX_DESIGN.md) | UX デザイン（コアループ、問題タイプ、成長システム、画面フロー、KPI） |
| [`docs/WORD_LIST.md`](docs/WORD_LIST.md) | 単語リスト（65語・類義語196語・語根21種）— 語源・類義語つき、人が読む用 |
| `data/words.json` | 単語データ（正本） |
| `data/roots.json` | 語根ファミリーデータ |
| `index.html`, `app/` | 遊べるプロトタイプ（依存なしの HTML/CSS/JS）。地方・ステージ・ジョブ・呪文・どうぐの定義は `app/app.js` 冒頭 |
| `scripts/build_wordlist.py` | データ検証と `WORD_LIST.md` の生成 |
| [`docs/VOICE_TTS.md`](docs/VOICE_TTS.md) | 日本語・英語の読み上げ音声の設計（声の素材とライセンス、エンジン選定、容量） |
| `scripts/tts/tts.py`, `tts/` | 音声の事前生成パイプライン（生成・差分更新・Whisper による品質確認） |

## 遊び方

```bash
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

`fetch` で JSON を読むため、`index.html` をファイルとして直接開くのではなくローカルサーバー経由で開いてください。
進捗はブラウザの localStorage に保存されます。

## 音声

音声ファイルがなくても、ブラウザ標準の読み上げで動きます。高品質な音声を事前に生成する場合は次のとおりです（詳しくは [`docs/VOICE_TTS.md`](docs/VOICE_TTS.md)）。

```bash
python3 scripts/tts/tts.py utterances             # 読み上げる文の一覧を作る
python3 scripts/tts/tts.py estimate               # 容量の見積もり
python3 scripts/tts/tts.py synth --voice tsukuyomi-gsv   # 生成（ffmpeg が必要）
python3 scripts/tts/tts.py qa --voice tsukuyomi-gsv      # 読み間違いの検出（faster-whisper が必要）
```

## 単語を追加・修正するとき

1. `data/words.json`（必要なら `data/roots.json`）を編集
2. `python3 scripts/build_wordlist.py` を実行（データの検証＋ `docs/WORD_LIST.md` の再生成）
3. 音声を使う場合は `python3 scripts/tts/tts.py utterances` と `synth` を再実行（変わった文だけ生成されます）

`python3 scripts/build_wordlist.py --check` で、生成物が最新かどうかを確認できます。

> 語源は Online Etymology Dictionary などの一般的な説に基づいていますが、諸説ある語はその旨を記載しています。
> 公開前には専門家による監修を推奨します。
