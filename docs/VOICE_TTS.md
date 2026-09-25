# 音声（日本語・英語の読み上げ）設計

## 1. 結論

| 項目 | 推奨 |
|---|---|
| 声の素材 | **声優っぽいオリジナルの声を Qwen3-TTS VoiceDesign で作る**（Apache-2.0・商用可・日英可、他人の声を使わないので権利の心配がない。§3.4）。次点は**つくよみちゃんコーパス**（無料・商用可・学習可、クレジット必須）。本物の声優の声なら声優に依頼（日英バイリンガルなら理想） |
| 合成エンジン | **Qwen3-TTS**（Apache-2.0）で「設計した声」をクローンして日英とも話させる ／ つくよみちゃんを使う場合は **GPT-SoVITS v2Pro**（MIT）の追加学習とも**同じ参照音声で聞き比べ**、良い方を採用 |
| 日英で同じ声にする方法 | 1人の話者で学習（またはクローン）し、その**同じモデルに日本語と英語の両方を話させる**（クロスリンガル合成） |
| 生成方法 | **事前生成**（`scripts/tts/tts.py`）。文や声を変えた所だけ作り直す |
| 形式・容量 | **Opus / WebM 24kbps モノラル**。ゲーム内で使う音声（519件・約12分）で **約2.8MB** |
| 品質管理 | Whisper で生成音声を聞き取り、読み間違いを自動検出 → 読み辞書で修正 → 耳で最終確認 |
| 宮舞モカ | **この用途には使えない**（§3.1） |

### 現在の状態

**学習済みの声ができるまでは、ブラウザ標準の読み上げ（日本語は ja-JP、英語は en-US）で再生する。** アプリは `audio/manifest.json` がある場合だけ生成済みの音声を使う。このファイルは本番用の声で `synth` を実行したときに初めて作られる。動作確認用の `espeak-test` は `"activate": false` にしてあるので、生成してもアプリの声は切り替わらない。

---

## 2. 要件

1. 日本語と英語の両方を読み上げる（英単語・例文、日本語の意味・例文・語源解説）
2. ゲーム・アニメ題材に合う、キャラクター性のある高品質な声
3. **日英で同じ声**
4. リアルタイム生成は不要 → 事前生成でよい。ただし容量に配慮する
5. 無料が望ましい。自分たちで学習させてもよい

---

## 3. 声の素材とライセンス

合成エンジンの性能より先に「**どの声を、どんな条件で学習・配布してよいか**」が決まる。

### 3.1 VOICEPEAK 宮舞モカ（所有済み）— この用途には使えない

- 使用許諾契約 第14条(14) は「**本製品または本製品で出力した音声を使用して、他の音声合成技術開発の研究、またはそれを実用化する行為**」を禁じている。
  → モカの出力音声を学習データや参照音声にして、**英語を話すモカを作ることはできない**。
- 同じ契約の第13条では、**別のソフトウェアに組み込んで商用利用する場合は AHS への問い合わせが必要**とされている。個人・非営利での配布は個人利用の範囲、営利目的なら別途ライセンスが必要。
- モカが話せるのは日本語だけ。モカを日本語専用に使うと、英語は別の声になり、要件3を満たせない。

> 参照：[宮舞モカ 使用許諾契約](https://www.ah-soft.com/voice/moca/eula.html)／[VOICEPEAK ライセンス](https://www.ah-soft.com/commercial/voicepeak/)

### 3.2 つくよみちゃんコーパス（推奨）

- 「高音ウィスパー系の14歳前後のアニメキャラクター風ボイス」。基本台本100文（JVS準拠）に加え、約1,500文の追加音声がある。96kHz/24bit 収録。
- **個人・法人、営利・非営利を問わず**、このコーパスから音声合成モデルを作り、アプリに組み込んで配布できる（有料・無料とも可）。
- 注意点：
  - **クレジット表記が必須**。アプリの「つよさ → おんせい」に表示する（`tts/voices/*.json` の `credit`）。
  - **つくよみちゃん以外のキャラクターの声として使うのは無断では禁止**。アプリでは「ナビゲーター：つくよみちゃん」のように、つくよみちゃんとして登場させる。賢者ロゴスなど別キャラの声にしたい場合は許諾を取る。
  - **二次利用を許可する形で公開しない**（生成音声を CC ライセンスなどで配らない）。
  - 人を批判・攻撃する内容、特定の政治・宗教への勧誘などには使わない。

> 参照：[つくよみちゃんコーパス](https://tyc.rei-yumesaki.net/material/corpus/)／[キャラクターライセンス](https://tyc.rei-yumesaki.net/about/terms/)

### 3.3 独自の声（録音・声優への依頼）

- アプリ専用の声になり、キャラクターも自由に作れる。
- **日本語と英語を両方話せる声優に日英それぞれ10〜30分ほど録音してもらう**のが、英語の発音品質では最良（§4.2）。有料になる点だけが難点。
- 契約書に「音声合成モデルの学習・生成音声のアプリ内配布」を明記すること。

### 3.4 Qwen3-TTS VoiceDesign で作るオリジナルの声（推奨）

- 「20代前半のアニメ声優、明るいゲームのナビゲーター役」のように**声を文章で説明すると、その声を新しく作る**機能。実在の人の声を学習・複製しないので、声の権利者の許諾やクレジット条件がない。モデルは Apache-2.0 で商用利用できる。
- 作った声を**参照音声**として保存し、以後は Base モデルのクローンで全音声を作る（「設計 → クローン」。公式の推奨手順）。VoiceDesign は呼ぶたびに声が変わるので、全文を VoiceDesign で直接作ってはいけない。
- 同じ参照音声から日本語と英語の両方を話すので、**日英で同じ声**になる（要件3）。
- 手順は §4.3。声の説明文は `tts/voices/navi-qwen3.json` の `qwen3.design.instruct`（英語で書くと指示が通りやすい）。
- 注意点：
  - 実在の声優・キャラクターの名前を説明文に入れて**そっくりな声を狙わない**（パブリシティ権・不正競争のおそれ）。「アニメ声優らしい」といった一般的な特徴だけを書く。
  - 選んだ参照音声（`tts/voices/navi-qwen3.ref.wav`、数百KB）は**声そのもの**なので、なくすと同じ声を作り直せない。これだけはリポジトリに入れる。

### 3.5 検討して外したもの

| 候補 | 理由 |
|---|---|
| ずんだもん・四国めたんなどの ITA コーパス読み上げ音声（声優が収録） | 配布元（東北ずん子プロジェクト）の研究用データベースで、**商用目的の利用は事前承認が必要**。英語の音声もない |
| VOICEVOX の各キャラクター | 日本語だけ。出力音声を別の音声合成の学習に使うことは各キャラクターの規約で制限されている |
| ElevenLabs（有料プラン） | 商用可・日英同じ声で品質も高い（2026年2月に v3 の日本語が正式版）。ただし**月額課金が続き**、語を足すたびに API で作ることになる。無料プランは商用不可。自前の GPU がない場合の代案 |

> 参照：[Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)（[VoiceDesign モデル](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign)）／[東北ずん子 マルチモーダルデータベース](https://zunko.jp/multimodal_dev/login.php)／[ElevenLabs 利用規約](https://elevenlabs.io/terms-of-use)

---

## 4. 合成エンジン

### 4.1 候補

| エンジン | ライセンス | 日英 | 同じ声で日英 | 特徴 |
|---|---|---|---|---|
| **GPT-SoVITS**（推奨版 v2Pro） | MIT | ◯ | ◯ 追加学習した声が日英を話す | 1分程度の音声から追加学習できる。アニメ声の実績が多い。GPU 1枚で学習・推論可 |
| **Qwen3-TTS**（2026年1月公開、0.6B / 1.7B） | Apache-2.0 | ◯（10言語） | ◯ 3秒の参照音声でクローン、言語をまたいでも声質を保つ | 学習不要。多言語の発音精度が高いと報告されている。VRAM 4GB 程度から |
| VOICEPEAK 宮舞モカ | 製品の使用許諾 | 日本語のみ | ✕ | §3.1 のとおり、学習・クローンに使えない |

> 参照：[GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS)（[リリース一覧](https://github.com/RVC-Boss/gpt-sovits/releases)）／[Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)（[技術報告](https://arxiv.org/html/2601.15621v1)）

### 4.2 英語の「なまり」に注意

学習用の音声が**日本語だけ**の場合、英語を話させると日本語なまりが出ることがある。英語学習アプリでは**英語の発音の正確さが声の統一より優先**なので、次の順で対処する。

1. `qa` で英語の単語誤り率（WER）を測る（§6）。単語1語だけの音声は誤り率が極端に振れやすいので、**例文の結果を主に見る**。
2. GPT-SoVITS で英語が崩れる場合は、Qwen3-TTS で英語を作った場合と比べる（同じ参照音声を使うので声質は近い）。
3. それでも足りなければ、同じ話者の**英語の録音を学習データに加える**（§3.3 の独自の声のときだけ可能）。

### 4.3 学習と起動の流れ（GPT-SoVITS）

1. つくよみちゃんコーパスをダウンロードする（書き起こし付きなので、自動書き起こしの工程は省ける）
2. GPT-SoVITS の WebUI で学習データの一覧（`音声パス|話者名|言語|テキスト`）を作り、SoVITS と GPT を追加学習する
3. 3〜10秒の、はっきり話している1文を**参照音声**に選び、その書き起こしと一緒に `tts/voices/tsukuyomi-gsv.json` の `ref` に書く
4. `api_v2.py` を学習済みの重みで起動する（既定 `http://127.0.0.1:9880`）
5. `python3 scripts/tts/tts.py synth --voice tsukuyomi-gsv`

Qwen3-TTS は学習が要らない。`pip install -U qwen-tts soundfile` のあと、`tts/voices/tsukuyomi-qwen3.json` に参照音声と書き起こしを書いて `synth --voice tsukuyomi-qwen3` を実行する。

### 4.4 VoiceDesign で声を作る流れ（Qwen3-TTS）

1. `pip install qwen-tts soundfile`（GPU 推奨。1.7B で VRAM 8GB 程度。GPU の種類ごとの注意は §4.5、Windows と Radeon の手順は §4.6）
2. `tts/voices/navi-qwen3.json` の `qwen3.design.instruct`（声の説明）と `qwen3.ref_text`（候補に読ませる5〜10秒の文）を決める
3. `python3 scripts/tts/tts.py design --voice navi-qwen3 --count 8` で候補を8つ作る → `tts/design/navi-qwen3/index.html` で聞き比べる
4. 気に入った候補（例：`seed3.wav`）を `tts/voices/navi-qwen3.ref.wav` にコピーする。同じ `--seed` なら同じ声が出るので、シード番号も控えておく
5. `python3 scripts/tts/tts.py synth --voice navi-qwen3 --only '^(potion|quest|tension)\.'` で数語だけ作り、英語が日本語なまりになっていないかを `qa` と耳で確認する（§4.2）
6. 声を選び直したら `version` を上げてから全件を作り直す


### 4.5 GPU の種類ごとの動かし方（Qwen3-TTS）

| GPU | 方法 | 設定（`qwen3` の中） |
|---|---|---|
| NVIDIA | CUDA 版 PyTorch | そのまま（`device: "cuda:0"`） |
| AMD Radeon RX 7000 / 9000（RDNA3・4） | **ROCm 版 PyTorch**。Linux でも Windows でも AMD 公式の wheel がある（Windows は §4.6）。先に ROCm 版 PyTorch を入れてから `qwen-tts` を入れる | そのまま。ROCm 版 PyTorch でも GPU の名前は `cuda:0` |
| AMD Radeon RX 6000 以前 | Linux で ROCm を使う（公式サポート外で、`HSA_OVERRIDE_GFX_VERSION=10.3.0` などの指定が要ることがある）。動かなければ CPU | bfloat16 が遅い場合は `dtype: "float16"` |
| なし（CPU） | 動くが遅い（1文あたり数十秒〜）。まず `--only` で数語だけ試す | `device: "cpu"`、`dtype: "float32"` |

- `python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"` で `True` と Radeon の名前が出れば GPU で動く。
- `attn_implementation: "flash_attention_2"` は NVIDIA 用なので、Radeon では付けない。

> 参照：[AMD ROCm on Radeon（インストール手順・対応表）](https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/index.html)／[Qwen3-TTS-ROCm（Radeon での動作例）](https://github.com/AIwork4me/Qwen3-TTS-ROCm)／[Windows で遅い件の報告](https://github.com/ROCm/TheRock/issues/3077)

### 4.6 Windows ＋ Radeon の手順

AMD 公式の Windows 版 PyTorch（ROCm 7.2.1）を使う。コマンドは PowerShell で実行する。

**AMD が公式に対応している GPU**（Windows 11）：RX 9070 XT / 9070 / 9060 XT、RX 7900 XTX / 7700。
ほかの RX 7000 シリーズ（7900 XT・7800 XT・7600 など）は一覧にないが、同じ世代なので動くことがある。まず下の手順3で確かめる。RX 6000 以前は Windows では動かないので、CPU で作る（§4.5）。

1. 準備
   - AMD のグラフィックドライバー（Adrenalin）を **26.2.2 以降**にする
   - **Python 3.12** を入れる（AMD の wheel は 3.12 専用）
   - ffmpeg を入れる：`winget install Gyan.FFmpeg`（入れたら PowerShell を開き直す）
2. リポジトリのフォルダで仮想環境を作り、ROCm と PyTorch を入れる
   ```powershell
   py -3.12 -m venv .venv
   .venv\Scripts\Activate.ps1
   $r = "https://repo.radeon.com/rocm/windows/rocm-rel-7.2.1"
   pip install --no-cache-dir "$r/rocm_sdk_core-7.2.1-py3-none-win_amd64.whl" "$r/rocm_sdk_devel-7.2.1-py3-none-win_amd64.whl" "$r/rocm_sdk_libraries_custom-7.2.1-py3-none-win_amd64.whl" "$r/rocm-7.2.1.tar.gz"
   pip install --no-cache-dir "$r/torch-2.9.1%2Brocm7.2.1-cp312-cp312-win_amd64.whl" "$r/torchaudio-2.9.1%2Brocm7.2.1-cp312-cp312-win_amd64.whl" "$r/torchvision-0.24.1%2Brocm7.2.1-cp312-cp312-win_amd64.whl"
   ```
3. Radeon が見えるか確かめる。`True` と Radeon の名前が出れば GPU で動く
   ```powershell
   python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
   ```
4. Qwen3-TTS を入れる。**`-U` を付けない**（付けると ROCm 版の PyTorch が普通の版に置き換わることがある）。入れたあと、もう一度手順3を実行して `True` のままか確かめる
   ```powershell
   pip install qwen-tts soundfile
   ```
5. 声の候補を作る → §4.4 の手順3から。Windows では `python3` を `python` に読みかえる
   ```powershell
   python scripts/tts/tts.py design --voice navi-qwen3 --count 8
   Copy-Item tts/design/navi-qwen3/seed3.wav tts/voices/navi-qwen3.ref.wav
   python scripts/tts/tts.py synth --voice navi-qwen3 --only '^(potion|quest|tension)\.'
   ```

**遅いとき**：Windows の ROCm 版では、音声を波形にもどす部分が遅い（RX 9060 XT で再生時間の約12倍）という報告がある。事前生成なので、この速さでもゲーム内の音声（約12分）は数時間で作り終わる。もっと速くしたいときは、声の設定の `qwen3` に `"cudnn": false` を足して速くなるか試す（MIOpen を使わなくする）。それでも遅ければ WSL2 か Linux で動かす。

> 参照：[AMD：Windows に PyTorch を入れる](https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/install/installrad/windows/install-pytorch.html)／[Windows の対応 GPU](https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/compatibility/compatibilityrad/windows/windows_compatibility.html)／[Windows で遅い件の報告](https://github.com/ROCm/TheRock/issues/3077)

---

## 5. 何を読み上げるか・容量

`python3 scripts/tts/tts.py utterances` で `data/words.json` から読み上げる文の一覧（`tts/utterances.json`）を作る。

| キー | 言語 | 内容 | 区分 |
|---|---|---|---|
| `potion.word` | 英 | potion | core |
| `potion.katakana` | 日 | ポーション | core |
| `potion.meaning` | 日 | 薬、魔法の 飲み薬、水薬 | core |
| `potion.example.en` / `.ja` | 英／日 | 例文 | core |
| `syn.elixir` | 英 | 類義語（同じ語は1回だけ） | core |
| `potion.story` | 日 | 語源の解説（長め） | extended |

`python3 scripts/tts/tts.py estimate` の見積もり（Opus は短いファイルほどコンテナ分がかさむため、実測の約30kbpsで計算）：

| 区分 | 件数 | 再生時間 | WebM（Opus） | M4A（AAC） |
|---|---|---|---|---|
| core（ゲーム内） | 519 | 約12分 | **約2.8MB** | 約5.8MB |
| extended（語源解説） | 65 | 約8.5分 | 約1.9MB | 約4.0MB |
| 合計 | 584 | 約21分 | 約4.8MB | 約9.8MB |

- 300語に増やしても、core は **約13MB** の見込み。
- 形式は **WebM（Opus）だけ**を既定にする。Safari も iOS 18.4（2025年3月）以降は WebM Opus を再生できる。古い端末にも対応したい場合は `formats` に `"m4a"` を足す（容量は約3倍になる）。対応形式がない端末では、ブラウザ標準の読み上げで代用する。
- 語源解説（extended）は図鑑でしか使わないので、最初は生成しなくてもよい（未生成の分はブラウザの読み上げで代用）。

---

## 6. パイプライン

```
data/words.json ──utterances──▶ tts/utterances.json ──synth──▶ audio/<声>/<ハッシュ>.webm
                                   ▲                              audio/<声>/manifest.json
                    tts/lexicon.json（読みの修正）                 audio/manifest.json（アプリが読む）
                                                          ──qa────▶ tts/qa/<声>.json（聞き取り誤り）
                                                          ──review─▶ audio/<声>/review.html（耳で確認）
                                                          ──prune──▶ 使われなくなった音声を削除
```

- **ファイル名＝ハッシュ**（声の設定 `version` など＋言語＋実際に読ませる文）。文を1か所直すとそこだけ作り直される。声を作り直したら `version` を上げれば全体を作り直す。同じ文（類義語の重複など）は1ファイルにまとめる。
- **後処理**（ffmpeg）：前後の無音カット → 音量を −18 LUFS にそろえる → 48kHz モノラル → Opus 24kbps。
- **読みの修正**：`tts/lexicon.json` の `ja` / `en` は全文置換、`keys` は特定の音声だけ読み上げ文を差し替える。
- **品質確認**：`qa` は faster-whisper で全音声を聞き取り、日本語は文字誤り率（CER）、英語は単語誤り率（WER）を出して、悪い順に並べる。`review` はその順に音声を並べたページを作る。
- **エンジンの追加**：`backend` は `gpt_sovits`（HTTP）、`qwen3`（Python）、`command`（任意のコマンド。`{text}` `{text_file}` `{lang}` `{out}` を置換）の3種類。

### 動作確認（この環境で実施）

`tts/voices/espeak-test.json`（espeak-ng。公開用ではなく、パイプラインの確認専用）で次を確認した。

- 584件を生成し、同じ文は1ファイルにまとめられた。2回目の実行では0件（差分だけ生成）
- 文を変えると、その文だけが作り直される（語源解説65件）。`prune` で古いファイルが消える
- アプリで、出題時にカタカナ語、回答後に「英単語 → 日本語の意味」の順で再生される。図鑑の例文・類義語のボタンも動く
- `audio/manifest.json` が無い場合はブラウザの読み上げで代用され、エラーにならない
- `qa` が読み間違いを検出した。これをきっかけに、読み上げ文を作る処理で濁点が消えるバグ（「きびきび」→「きひきひ」）を見つけて直した

---

## 7. 配信

- 音声はリポジトリに入れない（`.gitignore` 済み）。GitHub Pages なら公開用のブランチやリリース資産に置くか、オブジェクトストレージ／CDN（Cloudflare R2 など）に置く。
- ファイル名がハッシュなので、音声ファイルは `Cache-Control: public, max-age=31536000, immutable` にできる。`audio/manifest.json` だけは短いキャッシュにする。
- 再生するときに初めて読み込むので、最初の読み込み量は増えない。オフライン対応が必要になったら、Service Worker でステージ単位に先読みする。

---

## 8. 次にやること

1. `navi-qwen3` で VoiceDesign の候補を作り、声を決める（§4.4）
2. 数語だけ作り、つくよみちゃん（`tsukuyomi-gsv` / `tsukuyomi-qwen3`）と `qa` と `review` で聞き比べて声を決める
3. 決めたエンジンで全件を生成し、`qa` の結果を上から確認して `tts/lexicon.json` で読みを直す
4. アプリにナビゲーターとして「つくよみちゃん」を登場させるか検討する（§3.2 の条件）
