# AGENTS.md

AI エージェント（Claude Code、Codex など）がこのリポジトリで作業するときのルールです。
プロジェクトの概要とファイル構成は [`README.md`](README.md) を参照してください。

## 基本ルール

- **日本語で対応すること。** ユーザーへの返答、PR のタイトル・本文、コードコメント、ドキュメントは日本語で書く。
- **指示があったらマージまで進めること。** 作業を頼まれたら、途中で止めずに次の流れを最後までやりきる。
  1. 作業ブランチで変更する（`main` に直接コミットしない）
  2. 下の「確認」を通す
  3. コミットしてプッシュする
  4. PR を作る
  5. CI・レビューの指摘があれば直し、問題がなければ PR をマージする
- マージできない理由（確認が通らない、判断が必要な点がある など）があれば、そこで止めて理由をユーザーに伝える。

## プロジェクトの要点

- 依存なしの静的サイト（HTML/CSS/JS）。ビルド手順やパッケージマネージャーはない。
- 単語データの正本は `data/*.json`。`docs/WORD_LIST.md` は生成物なので**手で編集しない**。
- コース・テーマ・問題タイプ・習熟度の定義は `app/app.js` 冒頭、テーマの見た目は `app/style.css`。
- 進捗は localStorage に保存される。保存形式を変えるときは `STORE_KEY` / `COURSE_VERSION` と移行処理（`app/app.js`）を確認し、既存ユーザーの進捗を壊さない。
- 生成した音声（`/audio/`、`/tts/qa/`）はリポジトリに入れない。

## 動かし方

```bash
python3 -m http.server 8000
# http://localhost:8000 を開く（fetch で JSON を読むので file:// では動かない）
```

## 確認（コミット前に必ず実行）

```bash
python3 scripts/build_wordlist.py --check           # データ検証と生成物が最新かの確認
python3 -m unittest discover -s scripts/tts         # 音声パイプラインのテスト
```

`--check` が失敗したら `python3 scripts/build_wordlist.py` を実行して `docs/WORD_LIST.md` を再生成し、一緒にコミットする。

## 単語データを変えるとき

1. 入れたい語を `data/candidates.json` に書き足す（任意）
2. `data/words.json`（必要なら `data/roots.json`・`data/pairs.json`）を編集する
3. `python3 scripts/build_wordlist.py` を実行する
4. 音声を使う場合は `python3 scripts/tts/tts.py utterances` を再実行して `tts/utterances.json` を更新する

注意点：

- レベル（`level`）は英検の級に対応する（1=5級 … 7=1級）。英語としての難しさで決め、ジャンルでは分けない。
- カタカナが同じになる語（staff / stuff、bus / bath など）は、必ず `data/pairs.json` のどこかのセットに入れる（`build_wordlist.py` が確認する）。
- 語源は Online Etymology Dictionary などの一般的な説に基づいて書き、諸説ある語はその旨を書く。
- README や `docs/` に書いてある語数などの数字が変わったら、あわせて更新する。

## その他

- OGP 画像は `node scripts/ogp/render.mjs` で `icons/ogp.png` に書き出す（Playwright が必要）。
- 音声の設計は [`docs/VOICE_TTS.md`](docs/VOICE_TTS.md)、UX の設計は [`docs/UX_DESIGN.md`](docs/UX_DESIGN.md) を参照。
