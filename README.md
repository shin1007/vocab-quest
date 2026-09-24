# Vocab Quest 🗝️

身の回りやゲーム・アニメで**すでに知っているカタカナ語**（ドッグ、ジュース、ホテル、ポーション…）を足場にして、
英単語を学ぶ単語アプリのプロトタイプです。単語はジャンルで分けず、**英検の級（5級〜1級）にあわせたレベル**に分けて出題します。
レベルは英語としての難しさで決めています。各級の単語の8割が定着するとその級を「クリア」し、ホームに次の級までの残り語数が出ます。日常のカタカナ語に加えて、ゲームの装備名・技名・モンスター名（ソード、ブリザード、スコーピオン…）からも単語を集めています。
学習の仕組みはふつうの単語アプリ（レッスン・復習・単語帳）で、**見た目だけ**をゲーム風にしています。見た目は4テーマ（ステージ／ポップ／ストリート／ノーブル）から選べます。

- **語源**でつながりを知る：「ポーション（potion）と毒（poison）は兄弟語」
- **類義語**のニュアンスと語源を比べる：potion / elixir / remedy / draught
- **似た単語**をセットで覚える：hat / hut（母音）、light / right（L と R）、desert / dessert（つづり）など、英検でまちがえやすい語を聞きくらべ・空所補充で練習
- **カタカナの罠**を見抜く：「テンション高い」は英語で *I'm so excited!*、「マンション」は *apartment*

## 中身

| パス | 内容 |
|---|---|
| [`docs/UX_DESIGN.md`](docs/UX_DESIGN.md) | UX デザイン（学習の流れ、問題タイプ、習熟度と復習、ビジュアル、KPI） |
| [`docs/WORD_LIST.md`](docs/WORD_LIST.md) | 単語リスト（1736語・類義語3881語・語根56種・似た単語130セット）— 語源・類義語つき、人が読む用 |
| `data/words.json` | 単語データ（正本） |
| `data/roots.json` | 語根ファミリーデータ |
| `data/candidates.json` | 入れたいカタカナ語の候補（分野別）。未収録の語は `build_wordlist.py` の実行時に表示 |
| `data/pairs.json` | 似た単語セット（母音・L/R・B/V・TH・同音語・つづり・派生語の7種類）。単語リストでカタカナが同じになる語（staff / stuff、bus / bath など）は必ずどこかのセットに入れる（`build_wordlist.py` が確認） |
| `index.html`, `app/` | 動くプロトタイプ（依存なしの HTML/CSS/JS）。コース・テーマ・問題タイプ・習熟度の定義は `app/app.js` 冒頭、テーマの見た目は `app/style.css` |
| `scripts/build_wordlist.py` | データ検証と `WORD_LIST.md` の生成 |
| [`docs/VOICE_TTS.md`](docs/VOICE_TTS.md) | 日本語・英語の読み上げ音声の設計（声の素材とライセンス、エンジン選定、容量） |
| `scripts/tts/tts.py`, `tts/` | 音声の事前生成パイプライン（生成・差分更新・Whisper による品質確認） |

## 使い方

```bash
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

`fetch` で JSON を読むため、`index.html` をファイルとして直接開くのではなくローカルサーバー経由で開いてください。
進捗はブラウザの localStorage に保存されます。

## 音声

声を学習させるまでは、ブラウザ標準の読み上げ（日本語・英語）で再生します。高品質な音声を事前に生成する場合は次のとおりです（詳しくは [`docs/VOICE_TTS.md`](docs/VOICE_TTS.md)）。

```bash
python3 scripts/tts/tts.py utterances             # 読み上げる文の一覧を作る
python3 scripts/tts/tts.py estimate               # 容量の見積もり
python3 scripts/tts/tts.py synth --voice tsukuyomi-gsv   # 生成（ffmpeg が必要）
python3 scripts/tts/tts.py qa --voice tsukuyomi-gsv      # 読み間違いの検出（faster-whisper が必要）
```

## 単語を追加・修正するとき

1. 入れたい語を `data/candidates.json` の分野に書き足す（任意）
2. `data/words.json`（必要なら `data/roots.json`）を編集
3. `python3 scripts/build_wordlist.py` を実行（データの検証＋ `docs/WORD_LIST.md` の再生成＋候補のうち未収録の語の表示）
4. 音声を使う場合は `python3 scripts/tts/tts.py utterances` と `synth` を再実行（変わった文だけ生成されます）

1つの語が複数のモードに出てもかまいません（例：light は単語リストにも、似た単語セット light / right にも入っています）。

`python3 scripts/build_wordlist.py --check` で、生成物が最新かどうかを確認できます。

> 語源は Online Etymology Dictionary などの一般的な説に基づいていますが、諸説ある語はその旨を記載しています。
> 公開前には専門家による監修を推奨します。
