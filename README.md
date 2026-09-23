# Vocab Quest 🗝️

ゲーム・まんが・アニメで**すでに知っているカタカナ語**（ポーション、クエスト、クリティカル…）を足場にして、
英単語を RPG 感覚で学ぶ学習アプリのプロトタイプです。

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
| `index.html`, `app/` | 遊べるプロトタイプ（依存なしの HTML/CSS/JS） |
| `scripts/build_wordlist.py` | データ検証と `WORD_LIST.md` の生成 |

## 遊び方

```bash
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

`fetch` で JSON を読むため、`index.html` をファイルとして直接開くのではなくローカルサーバー経由で開いてください。
進捗はブラウザの localStorage に保存されます。

## 単語を追加・修正するとき

1. `data/words.json`（必要なら `data/roots.json`）を編集
2. `python3 scripts/build_wordlist.py` を実行（データの検証＋ `docs/WORD_LIST.md` の再生成）

`python3 scripts/build_wordlist.py --check` で、生成物が最新かどうかを確認できます。

> 語源は Online Etymology Dictionary などの一般的な説に基づいていますが、諸説ある語はその旨を記載しています。
> 公開前には専門家による監修を推奨します。
