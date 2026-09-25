/* KATAkaNA BUILDER — カタカナ語から英単語を学ぶ単語アプリ（依存なし） */
(() => {
  "use strict";

  // ---------- 学習コンテンツの定義 ----------
  // コースは英検の級に合わせたざっくりしたレベル（words.json の level: 1=5級 … 7=1級）。英語としての難しさで分ける。
  // ジャンルでは分けず、身近な語もゲームの語も同じレベルに混ぜて出す
  const COURSES = {
    "1": { name: "5級", title: "はじめの一歩", desc: "中学1年程度。誰でも知っている身近なことば" },
    "2": { name: "4級", title: "くらしの基本", desc: "中学2年程度。家・食べ物・街など毎日のことば" },
    "3": { name: "3級", title: "中学卒業", desc: "中学卒業程度。学校・趣味・お出かけのことば" },
    "4": { name: "準2級", title: "高校なかば", desc: "高校中級程度。ネットやテレビでよく見聞きすることば" },
    "5": { name: "2級", title: "高校卒業", desc: "高校卒業程度。ニュースや社会の話題のことば" },
    "6": { name: "準1級", title: "大学なかば", desc: "大学中級程度。仕事・教養・ファンタジーの少し難しいことば" },
    "7": { name: "1級", title: "マスター", desc: "大学上級程度。知っていれば上級者のことば" },
  };
  const COURSE_ORDER = Object.keys(COURSES).sort((a, b) => a - b);
  // 見た目のテーマ（機能は共通）。CSS は app/style.css の [data-theme]
  // 先頭が既定のテーマ
  const THEMES = {
    wa: { name: "和", desc: "墨と朱と和紙。刀の一閃", color: "#121010" },
    stage: { name: "ステージ", desc: "パステル×グラデーション", color: "#eef4ff" },
    pop: { name: "ポップ", desc: "太いフチどりのカジュアル", color: "#2a168f" },
    street: { name: "ストリート", desc: "黒×ネオンのステッカー", color: "#0d0d0f" },
    noble: { name: "ノーブル", desc: "紺と金のファンタジー", color: "#11162c" },
  };
  const DEFAULT_THEME = Object.keys(THEMES)[0];
  const QTYPES = {
    kata: "カタカナ → 英語",
    meaning: "英語 → 意味",
    spell: "つづり",
    etym: "語源",
    syn: "類義語",
    trap: "⚠️ カタカナの罠",
    pair: "👯 似た単語",
  };
  // まぎらわしい単語セットの種類（data/pairs.json の kind）。listen: 聞き取り問題を出す（音のちがいのセット）
  const PAIR_KINDS = {
    vowel: { name: "母音のちがい", icon: "🗣️", listen: true },
    lr: { name: "L と R", icon: "👅", listen: true },
    bv: { name: "B と V", icon: "👄", listen: true },
    th: { name: "TH の音", icon: "😛", listen: true },
    homophone: { name: "同じ音・別の語", icon: "👂", listen: false },
    spelling: { name: "つづりが似ている", icon: "✍️", listen: false },
    derived: { name: "形が似た派生語", icon: "🧬", listen: false },
  };
  // 英語以外の形で収録した語（人名のフランス語形など）の言語。words.json の lang。speech はブラウザ読み上げの言語
  const LANGS = {
    fr: { name: "フランス語", speech: "fr-FR" },
    de: { name: "ドイツ語", speech: "de-DE" },
    es: { name: "スペイン語", speech: "es-ES" },
    it: { name: "イタリア語", speech: "it-IT" },
    pt: { name: "ポルトガル語", speech: "pt-PT" },
    nl: { name: "オランダ語", speech: "nl-NL" },
    ru: { name: "ロシア語", speech: "ru-RU" },
    pl: { name: "ポーランド語", speech: "pl-PL" },
    cs: { name: "チェコ語", speech: "cs-CZ" },
    sv: { name: "スウェーデン語", speech: "sv-SE" },
    ga: { name: "アイルランド語", speech: "ga-IE" },
    he: { name: "ヘブライ語", speech: "he-IL" },
    la: { name: "ラテン語", speech: "it-IT" },
    el: { name: "ギリシャ語", speech: "el-GR" },
    // 以下は辞書（dictionary.json）で使う言語
    ar: { name: "アラビア語", speech: "ar-SA" },
    fa: { name: "ペルシャ語", speech: "fa-IR" },
    sa: { name: "サンスクリット語", speech: "hi-IN" },
    hi: { name: "ヒンディー語", speech: "hi-IN" },
    zh: { name: "中国語", speech: "zh-CN" },
    ko: { name: "朝鮮語", speech: "ko-KR" },
    vi: { name: "ベトナム語", speech: "vi-VN" },
    th: { name: "タイ語", speech: "th-TH" },
    id: { name: "インドネシア語", speech: "id-ID" },
    ms: { name: "マレー語", speech: "ms-MY" },
    tl: { name: "タガログ語", speech: "fil-PH" },
    tr: { name: "トルコ語", speech: "tr-TR" },
    fi: { name: "フィンランド語", speech: "fi-FI" },
    da: { name: "デンマーク語", speech: "da-DK" },
    no: { name: "ノルウェー語", speech: "nb-NO" },
    is: { name: "アイスランド語", speech: "is-IS" },
    hu: { name: "ハンガリー語", speech: "hu-HU" },
    uk: { name: "ウクライナ語", speech: "uk-UA" },
    sw: { name: "スワヒリ語", speech: "sw-KE" },
    rw: { name: "キニヤルワンダ語", speech: "rw-RW" },
    haw: { name: "ハワイ語", speech: "haw-US" },
    mi: { name: "マオリ語", speech: "mi-NZ" },
    qu: { name: "ケチュア語", speech: "es-PE" },
    mn: { name: "モンゴル語", speech: "mn-MN" },
    ta: { name: "タミル語", speech: "ta-IN" },
    eu: { name: "バスク語", speech: "eu-ES" },
    zu: { name: "ズールー語", speech: "zu-ZA" },
    bn: { name: "ベンガル語", speech: "bn-BD" },
    af: { name: "アフリカーンス語", speech: "af-ZA" },
    ch: { name: "チャモロ語", speech: "ch-GU" },
    ku: { name: "クルド語", speech: "ku-TR" },
    ur: { name: "ウルドゥー語", speech: "ur-PK" },
    ja: { name: "日本語", speech: "ja-JP" },
  };
  // 固有名詞の品詞。類義語の代わりに「別名・関連する名前」を載せている
  const PROPER = new Set(["地名", "神名", "神話", "人名"]);
  const KINDS = { common: "一般の語", 地名: "地名", 神名: "神名・神話", 人名: "人名" };
  const kindOf = (w) => (!PROPER.has(w.pos) ? "common" : w.pos === "神話" ? "神名" : w.pos);
  const synLabel = (w) => (PROPER.has(w.pos) ? "別名・関連する名前" : "類義語");
  const langName = (w) => (w.lang ? LANGS[w.lang]?.name || w.lang : "");
  // 習熟度（0〜5）。間隔反復のボックスに対応する
  const LEVELS = ["未学習", "出会った", "覚えかけ", "定着中", "得意", "完璧"];
  const INTERVAL_DAYS = [0, 0, 1, 3, 7, 21]; // 習熟度ごとの次回出題までの日数
  const LEARNED = 3; // この習熟度以上を「定着」とみなす
  // 「次のn語」：まだ覚えていない語を、コースの並びの先頭から n 語ずつ出す。n はホームで選ぶ
  const BATCH_OPTIONS = [50, 100, 150, 200];
  const BATCH_SIZE = 50;
  const STUDY_GOAL = 2; // 1回の学習でこの習熟度（翌日に復習）まで上げる
  const MAX_TRIES = 4; // 1回の学習で同じ語を出す上限（間違え続けても終われるように）
  const REQUEUE_GAP = { ok: 6, ng: 3 }; // もう一度出すまでにはさむ問題数（正解なら長め、間違いなら短め）
  const REVIEW_SIZE = 20;
  const QUESTIONS_PER_SESSION = 8; // 似た単語の練習
  const DAY = 24 * 60 * 60 * 1000;
  const STORE_KEY = "vocab-quest-save-v3";
  const OLD_STORE_KEY = "vocab-quest-save-v2";

  let WORDS = [];
  let ROOTS = [];
  let PAIRS = [];
  let pairsByWord = {}; // 英単語 → その語を含むセットの一覧
  let byId = {};
  let state = null;
  let session = null;
  let pairSession = null;
  let VOICE = null; // audio/manifest.json（事前生成した音声の一覧）。無ければブラウザの読み上げを使う
  let CLIPS = {}; // 音声キー → { text, lang }（scripts/tts/tts.py と同じキー）

  const $view = document.getElementById("view");
  const $modal = document.getElementById("modal");
  const $modalContent = document.getElementById("modal-content");

  // ---------- ユーティリティ ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // 発音記号を日本の辞書のような表記にする（ˈkænzəs → kǽnzəs）。データは IPA の強勢記号（ˈ ˌ）のまま持ち、
  // 表示するときに強勢のある母音の上にアクセント記号（第1強勢は ´、第2強勢は `）を付ける。
  // 強勢記号のない1音節語にも付ける（弱い ə だけの語と、英語以外の形の語は除く）
  // scripts/build_wordlist.py の ipa_text も同じ変換をする（docs/WORD_LIST.md 用）
  const IPA_V = "aeiouæɑɒɔəɛɜɪʊʌ";
  const ipaText = (ipa, foreign = false) => ipa.split(" ").map((t) => {
    if (!/[ˈˌ]/.test(t) && !foreign) {
      const nuclei = t.match(new RegExp(`[${IPA_V}]+`, "g")) || [];
      if (nuclei.length === 1 && nuclei[0] !== "ə") t = `ˈ${t}`;
    }
    return t.replace(new RegExp(`([ˈˌ])([^${IPA_V}]*)([${IPA_V}])`, "g"), (_, m, c, v) => c + v + (m === "ˈ" ? "\u0301" : "\u0300"));
  }).join(" ");
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const todayKey = (t = Date.now()) => new Date(t).toLocaleDateString("sv-SE");
  const plainKatakana = (w) => w.katakana.replace(/（.*）/, "");
  const courseOf = (w) => String(w.level);
  const courseLabel = (c) => `${COURSES[c].name}「${COURSES[c].title}」`;
  // 文字列から決まった数を作る（コース内の並びを毎回同じにしつつ、ジャンルが偏らないように混ぜる）
  const mixKey = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  // 出題文から答えの単語（と派生形）を伏せる: equipment → equip も伏せる
  const mask = (text, w) => text.replace(new RegExp(`\\b${w.word.slice(0, 4)}[a-z]*`, "gi"), "＿＿＿");
  const html = (strings, ...vals) => strings.reduce((out, s, i) => out + s + (i < vals.length ? vals[i] : ""), "");
  const bar = (ratio, cls = "") => `<div class="bar ${cls}"><div style="width:${Math.max(0, Math.min(1, ratio)) * 100}%"></div></div>`;
  // 習熟度メーター（5マス）
  const meter = (n) => `<span class="meter lv${n}" title="習熟度：${LEVELS[n]}" aria-label="習熟度 ${n}/5">${"<i></i>".repeat(5)}</span>`;
  const ring = (ratio, label) => `<span class="ring" style="--p:${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}"><span>${label}</span></span>`;

  // ---------- セーブデータ ----------
  function defaultState() {
    return {
      cards: {}, streak: 0, lastDay: null,
      sessions: 0, answered: 0, correct: 0, welcomed: false,
      settings: { autoVoice: true, theme: DEFAULT_THEME, batch: BATCH_SIZE },
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // レッスン制だったころの項目（完了印・コースの版・1日の上限）は使わないので捨てる。単語ごとの習熟度はそのまま
        const { done, courseVersion, newToday, ...rest } = saved;
        const { newPerDay, ...settings } = saved.settings || {};
        const base = defaultState();
        const merged = { ...base, ...rest, settings: { ...base.settings, ...settings } };
        if (!BATCH_OPTIONS.includes(merged.settings.batch)) merged.settings.batch = BATCH_SIZE;
        return merged;
      }
      // 旧バージョン（RPG 版）のセーブから学習記録だけ引き継ぐ
      const old = JSON.parse(localStorage.getItem(OLD_STORE_KEY) || "null");
      if (!old) return defaultState();
      const cards = Object.fromEntries(Object.entries(old.cards || {}).map(([id, c]) => [id, { level: c.star || 0, due: c.due || 0, seen: c.seen || 0, correct: c.correct || 0 }]));
      return {
        ...defaultState(), cards, streak: old.streak || 0, lastDay: old.lastDay || null,
        answered: old.answered || 0, correct: old.correct || 0, sessions: old.battles || 0,
        welcomed: !!old.onboarded, settings: { ...defaultState().settings, ...old.settings },
      };
    } catch {
      return defaultState();
    }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* プライベートモード等では保存しない */ }
  }
  const card = (id) => state.cards[id] || { level: 0, due: 0, seen: 0, correct: 0 };
  const level = (id) => card(id).level;
  const isDue = (id) => { const c = state.cards[id]; return c && c.level > 0 && c.due <= Date.now(); };
  const dueWords = () => WORDS.filter((w) => isDue(w.id));
  const learnedCount = () => WORDS.filter((w) => level(w.id) >= LEARNED).length;

  // ---------- 次のn語 ----------
  // 各コースの単語を、ジャンルが混ざるように並べる（id から決まる順なので毎回同じ）。似た語が固まると混同しやすい
  const courseWords = (course) => WORDS.filter((w) => courseOf(w) === course).sort((a, b) => mixKey(a.id) - mixKey(b.id));
  const courseLearned = (c) => { const ws = WORDS.filter((w) => courseOf(w) === c); return { total: ws.length, learned: ws.filter((w) => level(w.id) >= LEARNED).length }; };
  // 「そのレベルの語を8割定着」を達成した一番上のレベル
  const MASTERED = 0.8;
  const reachedCourse = () => {
    let reached = null;
    for (const c of COURSE_ORDER) {
      const { total, learned } = courseLearned(c);
      if (!total || learned / total < MASTERED) break;
      reached = c;
    }
    return reached;
  };
  const badge = (c, big = false) => `<span class="topic-badge grade${big ? " big" : ""}" style="--area:var(--area-${c})">${esc(COURSES[c].name)}</span>`;
  // 次に出す語：覚えかけの語（出会ったが習熟度 STUDY_GOAL 未満）を先に、足りない分をまだ出会っていない語で埋めて n 語。
  // course を省くと、下のレベルから順に探す。全部の語が STUDY_GOAL に届いていれば、習熟度の低い語から n 語を練習する
  function nextPlan(course = null) {
    const words = course ? courseWords(course) : COURSE_ORDER.flatMap(courseWords);
    const n = state.settings.batch;
    const started = words.filter((w) => level(w.id) > 0 && level(w.id) < STUDY_GOAL);
    const fresh = words.filter((w) => level(w.id) === 0);
    const picked = [...started, ...fresh].slice(0, n);
    if (picked.length) return { course, words: picked, practice: false, started: started.length, fresh: fresh.length };
    return { course, words: [...words].sort((a, b) => level(a.id) - level(b.id)).slice(0, n), practice: true, started: 0, fresh: 0 };
  }
  const planLabel = (plan) => plan.practice ? `${plan.words.length}語を練習する` : `次の${plan.words.length}語を覚える`;

  // ---------- テーマ ----------
  function applyTheme() {
    const t = THEMES[state.settings.theme] ? state.settings.theme : DEFAULT_THEME;
    document.documentElement.dataset.theme = t;
    document.querySelector('meta[name="theme-color"]').content = THEMES[t].color;
  }
  const themeOptions = () => html`
    <div class="theme-grid">
      ${Object.entries(THEMES).map(([k, t]) => html`
        <button class="theme-option" data-theme-pick="${k}" aria-pressed="${state.settings.theme === k}">
          <span class="pv" data-theme="${k}" aria-hidden="true">
            <span class="pv-card">Aa<i></i></span>
            <span class="pv-btn">スタート</span>
          </span>
          <b>${esc(t.name)}</b><span class="small muted">${esc(t.desc)}</span>
        </button>`).join("")}
    </div>`;
  function bindThemeOptions(root, onPick) {
    root.querySelectorAll("[data-theme-pick]").forEach((b) => b.addEventListener("click", () => {
      state.settings.theme = b.dataset.themePick;
      save();
      applyTheme();
      root.querySelectorAll("[data-theme-pick]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      onPick?.();
    }));
  }
  // 右上の ⚙️ から開く設定（テーマ・音声・記録のリセット）
  function openSettings() {
    $modalContent.innerHTML = html`
      <h2>⚙️ 設定</h2>
      <section class="settings-section">
        <h3>🎨 テーマ</h3>
        <p class="small muted" style="margin:0">見た目だけが変わります。学習の記録はそのままです。</p>
        ${themeOptions()}
      </section>
      <section class="settings-section">
        <h3>🔊 音声</h3>
        <label class="toggle"><input type="checkbox" id="auto-voice" ${state.settings.autoVoice ? "checked" : ""}><span></span> 問題と答えを自動で読み上げる</label>
        <p class="small muted" style="margin:8px 0 0">声：${VOICE ? esc(VOICE.label) : "ブラウザ標準の読み上げ（音声ファイル未生成）"}</p>
        ${VOICE?.credit ? `<p class="small muted" style="margin:4px 0 0">${esc(VOICE.credit)}</p>` : ""}
      </section>
      <section class="settings-section">
        <h3>🗂️ 学習記録</h3>
        <button class="btn danger block" id="reset">学習記録をリセット</button>
      </section>`;
    bindThemeOptions($modalContent);
    $modalContent.querySelector("#auto-voice").addEventListener("change", (e) => { state.settings.autoVoice = e.target.checked; save(); });
    $modalContent.querySelector("#reset").addEventListener("click", () => {
      if (!confirm("学習記録をすべて消しますか？ この操作は取り消せません。")) return;
      state = defaultState();
      save();
      applyTheme();
      closeModal();
      go("home");
    });
    openModal();
  }

  // ---------- HUD ----------
  function renderHud() {
    document.getElementById("hud-streak").textContent = `🔥 ${state.streak}`;
    document.getElementById("hud-learned").textContent = `📘 ${learnedCount()}/${WORDS.length}`;
  }

  // ---------- 画面切り替え ----------
  function go(tab) {
    stopVoice();
    session = null;
    pairSession = null;
    document.body.classList.remove("in-session");
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    ({ home: renderHome, dex: renderDex, pairs: renderPairs, roots: renderRoots, stats: renderStats })[tab]();
    renderHud();
    window.scrollTo(0, 0);
  }

  // ---------- 目標と次のn語 ----------
  // 到達したレベル（8割定着）と次のレベルまでの進み具合に、次に覚える語をまとめた1枚のカード
  function goalCard(plan) {
    const reached = reachedCourse();
    const next = COURSE_ORDER[reached ? COURSE_ORDER.indexOf(reached) + 1 : 0];
    const { total, learned } = next ? courseLearned(next) : { total: 0, learned: 0 };
    const need = Math.max(0, Math.ceil(total * MASTERED) - learned);
    return html`
      <section class="card goal-card pop" style="--area:var(--area-${next || reached})">
        <div class="ribbon">GOAL</div>
        <div class="row">
          ${badge(next || reached)}
          <div class="spacer">
            <div class="small muted">${reached ? `🏅 ${esc(courseLabel(reached))}をクリア` : "🎯 最初の目標"}</div>
            ${next ? html`
              <b>${esc(courseLabel(next))}クリアまで あと${need}語</b>
              ${bar(learned / (total * MASTERED))}
              <div class="small muted">${learned}/${total}語 定着（8割の${Math.ceil(total * MASTERED)}語でクリア）</div>` : html`
              <b>全レベルクリア！ おめでとうございます</b>`}
          </div>
        </div>
        ${plan.words.length ? html`
          <div class="goal-next">
            <div class="small muted">NEXT ・ ${esc(COURSES[courseOf(plan.words[0])].name)} ・ ${plan.practice ? "全部の語に出会いました。習熟度の低い語を練習します" : `まだ出会っていない語 あと${WORDS.filter((w) => courseOf(w) === courseOf(plan.words[0]) && !level(w.id)).length}語`}</div>
            <div class="next-words">${plan.words.slice(0, 4).map((w) => esc(plainKatakana(w))).join(" / ")}…</div>
            <div class="batch-pick" role="group" aria-label="1回に覚える語の数">
              ${BATCH_OPTIONS.map((n) => `<button class="chip ${state.settings.batch === n ? "on" : ""}" data-batch="${n}" aria-pressed="${state.settings.batch === n}">${n}語</button>`).join("")}
            </div>
            <button class="btn block" data-study="">▶ ${planLabel(plan)}</button>
          </div>` : ""}
      </section>`;
  }

  // ---------- ホーム ----------
  function renderHome() {
    const due = dueWords();
    const next = nextPlan();
    const trivia = pick(WORDS);
    $view.innerHTML = html`
      ${state.welcomed ? "" : html`
        <section class="card welcome pop">
          <div class="welcome-art" aria-hidden="true">🐶<span>→</span>dog</div>
          <h1 class="display">知ってるカタカナを<br>英語にしよう</h1>
          <p>ドッグ、キャット、ジュース、ポーション…。身の回りやゲーム・アニメでおなじみのことばを入り口に、<b>正しいつづり・意味・語源・類義語</b>まで身につけます。</p>
          <button class="btn block" id="welcome-ok">はじめる</button>
        </section>`}

      <section class="card today pop">
        <div class="row">
          <h2 class="spacer">きょうの学習</h2>
          <span class="small muted">${todayKey().replaceAll("-", ".")}</span>
        </div>
        <div class="today-grid">
          <div class="stat-tile"><b>${state.streak}</b><span>🔥 連続日数</span></div>
          <div class="stat-tile"><b>${learnedCount()}</b><span>📘 定着した語</span></div>
          <div class="stat-tile ${due.length ? "hot" : ""}"><b>${due.length}</b><span>🔁 復習</span></div>
        </div>
        ${due.length ? html`
          <button class="btn green block" id="review">🔁 復習する（${Math.min(due.length, REVIEW_SIZE)}問）</button>
          <p class="small muted center">忘れかけた頃にもう一度思い出すと、長く記憶に残ります。</p>` : ""}
      </section>

      ${goalCard(next)}

      <h2 class="section-title">レベル別コース</h2>
      <p class="small lead">レベルは英検の級にあわせたおおよその目安です。英語のつづり・意味の難しさで分けています。</p>
      ${COURSE_ORDER.map((k) => {
        const t = COURSES[k];
        const words = courseWords(k);
        if (!words.length) return "";
        const learned = words.filter((w) => level(w.id) >= LEARNED).length;
        const plan = nextPlan(k);
        return html`
          <section class="card topic" style="--area:var(--area-${k})">
            <div class="topic-head">
              ${badge(k)}
              <div class="spacer"><h3>${esc(t.name)} ${esc(t.title)}</h3><div class="small muted">${esc(t.desc)} ・ ${words.length}語</div></div>
              ${ring(learned / words.length, `${learned}<small>/${words.length}</small>`)}
            </div>
            <div class="row">
              <span class="small muted spacer">${plan.practice ? "全部の語に出会いました" : `まだ出会っていない語 ${plan.fresh}語${plan.started ? ` ・ 覚えかけ ${plan.started}語` : ""}`}</span>
              <button class="btn secondary small" data-study="${k}">▶ ${planLabel(plan)}</button>
            </div>
          </section>`;
      }).join("")}

      <section class="card trivia">
        <div class="small muted">💡 ことばの小ネタ</div>
        <p><b>${esc(trivia.word)}</b>（${esc(plainKatakana(trivia))}）── ${esc(trivia.etymology.story.split("。")[0])}。</p>
        <button class="btn secondary small" data-detail="${trivia.id}">くわしく見る</button>
      </section>`;

    $view.querySelector("#welcome-ok")?.addEventListener("click", () => {
      state.welcomed = true;
      save();
      startSession({ kind: "study" });
    });
    $view.querySelector("#review")?.addEventListener("click", () => startSession({ kind: "review" }));
    $view.querySelectorAll("[data-study]").forEach((b) => b.addEventListener("click", () => startSession({ kind: "study", course: b.dataset.study || null })));
    $view.querySelectorAll("[data-batch]").forEach((b) => b.addEventListener("click", () => {
      state.settings.batch = +b.dataset.batch;
      save();
      renderHome();
    }));
    $view.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
  }

  // ---------- 出題 ----------

  // 習熟度に応じて出題タイプを難しくする
  function allowedTypes(w) {
    const lv = level(w.id);
    const pair = pairsByWord[w.word] ? ["pair"] : [];
    // つづり並べは英字だけの語に限る（gas station のような語句は文字タイルにしにくい）
    const spell = /^[A-Za-z]+$/.test(w.word) ? ["spell"] : [];
    if (lv <= 1) return ["kata", "meaning"];
    if (lv === 2) return ["kata", "meaning", ...spell, "etym", ...pair];
    return [...spell, "etym", "syn", ...(w.trapQuiz ? ["trap"] : []), ...pair];
  }

  // 錯乱肢は正解と「近い」語から選ぶ。見た目や種類の違いだけで消去できないようにする
  // - 共通：同じ種類（一般の語／地名／人名／神名）を優先し、品詞・レベル・言語・語句かどうか・大文字始まりをそろえる
  // - 英語を選ぶ問題（kata・etym・syn）：つづりが似た語（文字の並び・長さ・頭文字）を優先する
  // - 意味を選ぶ問題（meaning）：意味の文の長さをそろえる。意味が重なる語や類義語は正解が2つになるので除く
  const bigramCache = new Map();
  const bigrams = (t) => {
    if (!bigramCache.has(t)) bigramCache.set(t, new Set([...t].slice(1).map((c, i) => t[i] + c)));
    return bigramCache.get(t);
  };
  const dice = (a, b) => {
    const x = bigrams(a), y = bigrams(b);
    if (!x.size || !y.size) return 0;
    let n = 0;
    for (const g of x) if (y.has(g)) n++;
    return (2 * n) / (x.size + y.size);
  };
  const mainPos = (w) => w.pos.split("・")[0];
  function closeness(w, x, by) {
    let v = 0;
    if (kindOf(x) === kindOf(w)) v += 6;
    if (mainPos(x) === mainPos(w)) v += 2;
    v -= Math.abs(x.level - w.level) * 0.7;
    if (!x.lang === !w.lang) v += 1;
    if (x.word.includes(" ") === w.word.includes(" ")) v += 1.5;
    if ((x.word[0] === x.word[0].toUpperCase()) === (w.word[0] === w.word[0].toUpperCase())) v += 1.5;
    if (by === "meaning") {
      v -= Math.min(3, Math.abs(x.meaning.length - w.meaning.length) * 0.25);
    } else {
      const a = w.word.toLowerCase(), b = x.word.toLowerCase();
      v += dice(a, b) * 6;
      if (a[0] === b[0]) v += 1;
      v -= Math.min(3, Math.abs(a.length - b.length) * 0.5);
    }
    return v;
  }
  const TOP = 16;
  function distractors(w, n, filter = () => true, by = "word") {
    // カタカナが同じ語（bus と bath の「バス」など）は正解と見分けられないので選択肢に出さない
    // 同じつづりの語（英語の Michael とドイツ語の Michael）や、同じ名前の別の言語形も正解と紛らわしいので除く
    const syns = new Set(w.synonyms.map((s) => s.word.toLowerCase()));
    const ok = (x) => x.id !== w.id && plainKatakana(x) !== plainKatakana(w) && x.word.toLowerCase() !== w.word.toLowerCase() && !(w.group && x.group === w.group) && filter(x)
      && (by !== "meaning" || (!syns.has(x.word.toLowerCase()) && dice(x.meaning, w.meaning) < 0.4));
    // 近い順の上位だけを残す（全語を並べかえると、200語の出題を作るときに遅くなる）。少しゆらして毎回同じ組み合わせにならないようにする
    const top = [];
    for (const x of WORDS) {
      if (Math.abs(x.level - w.level) > 2 || !ok(x)) continue;
      const v = closeness(w, x, by) + Math.random() * 1.5;
      if (top.length === TOP && v <= top[TOP - 1][1]) continue;
      top.splice(top.findIndex((t) => t[1] < v) >>> 0, 0, [x, v]);
      if (top.length > TOP) top.pop();
    }
    const picked = [];
    for (const x of top) {
      // 錯乱肢どうしも見分けがつくように、同じカタカナ・同じ意味の語は1つだけにする
      if (picked.some((y) => plainKatakana(y) === plainKatakana(x[0]) || y.meaning === x[0].meaning || y.word.toLowerCase() === x[0].word.toLowerCase())) continue;
      picked.push(x[0]);
      if (picked.length === n) break;
    }
    return picked;
  }

  function makeQuestion(w, type) {
    const q = { word: w, type, choices: null };
    const wordChoices = (label, filter, by) => shuffle([w, ...distractors(w, 3, filter, by)]).map((x) => ({ label: label(x), correct: x.id === w.id, ref: x }));
    switch (type) {
      case "kata":
        q.prompt = html`<span class="big">${esc(w.katakana)}</span><span class="scene">📍 ${esc(mask(w.scene, w))}</span>${w.lang ? `${langName(w)}での` : "英語での正しい"}つづりは？`;
        q.hint = `意味は「${w.meaning}」`;
        q.choices = wordChoices((x) => x.word);
        break;
      case "meaning":
        q.prompt = html`<span class="big en">${esc(w.word)}</span>${w.lang ? `（${langName(w)}）意味は？` : "英語での意味は？"}`;
        q.hint = `カタカナでは「${w.katakana}」。${w.scene}`;
        q.choices = wordChoices((x) => x.meaning, undefined, "meaning");
        break;
      case "spell":
        q.prompt = html`<span class="big">${esc(w.katakana)}</span>${esc(w.meaning)}<span class="scene">文字をタップしてつづりを完成させよう</span>`;
        q.hint = `語源：${mask(w.etymology.origin, w)}`;
        q.letters = shuffle(w.word.split(""));
        q.typed = [];
        break;
      case "etym":
        q.prompt = html`<span class="origin">📜 ${esc(mask(w.etymology.origin, w))}</span>この語源から生まれた英単語は？`;
        q.hint = `カタカナでは「${w.katakana}」`;
        q.choices = wordChoices((x) => `${x.word}（${plainKatakana(x)}）`);
        break;
      case "syn": {
        const s = pick(w.synonyms);
        q.prompt = html`<span class="big en">${esc(s.word)}</span>（${esc(s.meaning)}）<br>この語の<b>${synLabel(w)}</b>はどれ？`;
        q.hint = `${s.word} のニュアンス：${s.nuance}`;
        q.choices = wordChoices((x) => `${x.word}（${plainKatakana(x)}）`, (x) => x.word !== s.word && !x.synonyms.some((y) => y.word === s.word));
        q.synonym = s;
        break;
      }
      case "trap":
        q.prompt = html`${esc(w.trapQuiz.question)}`;
        q.hint = `英語の ${w.word} は本来「${w.meaning}」という意味`;
        q.choices = shuffle([
          { label: w.trapQuiz.answer, correct: true },
          ...w.trapQuiz.wrong.map((label) => ({ label, correct: false })),
        ]);
        break;
      case "pair": {
        // 似た単語のセットから、例文の空所に入る語を選ぶ
        const set = pick(pairsByWord[w.word]);
        const target = set.words.find((x) => x.word === w.word);
        q.prompt = html`<span class="pair-sentence">${esc(blankOut(target))}</span><span class="scene">${esc(target.example.ja)}</span>空所に入るのはどれ？`;
        q.hint = set.point;
        q.choices = shuffle(set.words.map((x) => ({ label: x.word, correct: x.word === w.word })));
        q.pairSet = set;
        break;
      }
    }
    return q;
  }

  // ---------- 学習セッション ----------
  // 復習：期限が来た語から最大 REVIEW_SIZE 語を1回ずつ。
  // 次のn語：nextPlan の語をまとめて出し、STUDY_GOAL に届くまで間をあけてもう一度出す（answer → requeue）
  function startSession({ kind, course = null }) {
    const plan = kind === "study" ? nextPlan(course) : null;
    const words = shuffle(plan ? plan.words : dueWords()).slice(0, plan ? Infinity : REVIEW_SIZE);
    if (!words.length) { go("home"); return; }
    const courses = [...new Set(words.map(courseOf))];
    session = {
      kind, course,
      title: kind === "review" ? "復習" : `${courses.length === 1 ? `${COURSES[courses[0]].name} ・ ` : ""}${plan.practice ? `${words.length}語の練習` : `次の${words.length}語`}`,
      // 問題は出す直前に作る（その時点の習熟度で出題タイプを選び、200語でも始めるのを待たせない）
      questions: words.map((w) => ({ word: w, pending: true })),
      // 次のn語（練習以外）は語ごとに STUDY_GOAL まで繰り返す。進み具合は語の数で見せる
      targets: plan && !plan.practice ? words : null,
      tries: {},
      index: 0, correct: 0, results: [],
      startLevels: Object.fromEntries(words.map((w) => [w.id, level(w.id)])),
      startReached: reachedCourse(),
    };
    document.body.classList.add("in-session");
    renderQuestion();
  }

  // 進み具合：復習・練習は問題ごと、次のn語は語ごと（STUDY_GOAL に届いた語が緑）。
  // 語が多いとマスが細くなりすぎるので、STEP_MAX 語を超えたら1本のバーにする
  const STEP_MAX = 20;
  function stepsHtml(s) {
    if (s.targets) {
      const now = s.questions[s.index].word;
      const cleared = s.targets.filter((w) => level(w.id) >= STUDY_GOAL).length;
      const marks = s.targets.length > STEP_MAX
        ? `<i class="ok fill" style="width:${(cleared / s.targets.length) * 100}%"></i>`
        : s.targets.map((w) => `<i class="${level(w.id) >= STUDY_GOAL ? "ok" : w === now ? "now" : ""}"></i>`).join("");
      return html`
        <div class="steps" aria-label="${cleared}語 / ${s.targets.length}語 クリア">${marks}</div>
        <span class="count">${cleared}/${s.targets.length}</span>`;
    }
    return html`
      <div class="steps" aria-label="${s.index + 1}問目 / ${s.questions.length}問">
        ${s.questions.map((_, i) => `<i class="${i < s.index ? (s.results[i].ok ? "ok" : "ng") : i === s.index ? "now" : ""}"></i>`).join("")}
      </div>
      <span class="count">${s.index + 1}/${s.questions.length}</span>`;
  }

  function renderQuestion() {
    const s = session;
    const w = s.questions[s.index].word;
    if (s.questions[s.index].pending) s.questions[s.index] = makeQuestion(w, pick(allowedTypes(w)));
    const q = s.questions[s.index];
    // 出題文の読み上げ（答えがばれない物だけ）：カタカナ語、または意味を問う英単語
    const promptVoice = q.type === "kata" || q.type === "spell" ? `${q.word.id}.katakana` : q.type === "meaning" ? `${q.word.id}.word` : null;
    $view.innerHTML = html`
      <div class="quiz-top">
        <button class="icon-btn" id="quit" aria-label="やめる">✕</button>
        ${stepsHtml(s)}
      </div>
      <div class="small muted quiz-title">${esc(s.title)}</div>
      <section class="card question pop">
        <div class="row"><span class="tag">${QTYPES[q.type]}</span><span class="spacer"></span>${promptVoice ? voiceButton(promptVoice) : ""}</div>
        <div class="prompt">${q.prompt}</div>
        <div id="hint"></div>
        ${q.type === "spell" ? html`
          <div class="spell-slots" id="slots">${q.word.word.split("").map(() => "<span></span>").join("")}</div>
          <div class="tiles">${q.letters.map((l, i) => `<button class="tile" data-i="${i}">${esc(l)}</button>`).join("")}</div>` : html`
          <div class="choices">${q.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="key">${"ABCD"[i]}</span><span>${esc(c.label)}</span></button>`).join("")}</div>`}
        <div class="helpers" id="helpers">
          <button class="btn secondary small" id="hint-btn">💡 ヒント</button>
          ${q.type === "spell" ? `<button class="btn secondary small" id="undo">↩ 1文字もどす</button>` : ""}
          <span class="spacer"></span>
          <button class="btn ghost small" id="skip">わからない</button>
        </div>
      </section>`;
    $view.querySelector("#quit").addEventListener("click", () => {
      if (!s.results.length || confirm("学習をやめますか？ ここまでの記録は保存されます。")) finishSession();
    });
    $view.querySelector("#hint-btn").addEventListener("click", (e) => {
      $view.querySelector("#hint").innerHTML = `<div class="tip">💡 ${esc(q.hint)}</div>`;
      e.currentTarget.disabled = true;
      q.hinted = true;
    });
    $view.querySelector("#skip").addEventListener("click", () => answer(q, { label: "", correct: false, skipped: true }));
    if (q.type === "spell") bindSpell(q);
    else $view.querySelectorAll(".choice").forEach((el) => el.addEventListener("click", () => answer(q, q.choices[+el.dataset.i], el)));
    if (promptVoice && state.settings.autoVoice) playVoice([promptVoice]);
  }

  function bindSpell(q) {
    const slots = [...$view.querySelectorAll("#slots span")];
    const tiles = [...$view.querySelectorAll(".tile")];
    const redraw = () => {
      slots.forEach((s, i) => { s.textContent = q.typed[i] != null ? q.letters[q.typed[i]] : ""; s.classList.toggle("filled", q.typed[i] != null); });
      tiles.forEach((t, i) => { t.disabled = q.typed.includes(i); });
      if (q.typed.length === q.letters.length) {
        const spelled = q.typed.map((i) => q.letters[i]).join("");
        tiles.forEach((x) => { x.disabled = true; });
        answer(q, { label: spelled, correct: spelled === q.word.word });
      }
    };
    tiles.forEach((t) => t.addEventListener("click", () => { q.typed.push(+t.dataset.i); redraw(); }));
    $view.querySelector("#undo").addEventListener("click", () => { q.typed.pop(); redraw(); });
  }

  function answer(q, choice, button) {
    const s = session;
    const w = q.word;
    const ok = choice.correct;
    s.results.push({ word: w, ok });
    $view.querySelectorAll(".choice").forEach((el, i) => {
      el.disabled = true;
      if (q.choices[i].correct) el.classList.add("correct");
    });
    if (button && !ok) button.classList.add("wrong");
    if (q.type === "spell") $view.querySelector("#slots").classList.add(ok ? "correct" : "wrong");
    $view.querySelector("#helpers").hidden = true;

    // 習熟度（間隔反復）
    const c = { ...card(w.id) };
    c.seen = (c.seen || 0) + 1;
    if (ok) {
      c.correct = (c.correct || 0) + 1;
      c.level = Math.min(5, (c.level || 0) + 1);
    } else {
      c.level = Math.max(1, (c.level || 0) - 1);
    }
    c.due = Date.now() + INTERVAL_DAYS[c.level] * DAY;
    state.cards[w.id] = c;
    state.answered++;
    if (ok) { state.correct++; s.correct++; }
    save();
    if (s.targets) requeue(s, w, ok);
    const top = $view.querySelector(".quiz-top");
    top.querySelector(".steps").remove();
    top.querySelector(".count").remove();
    top.querySelector("#quit").insertAdjacentHTML("afterend", stepsHtml(s));
    if (!s.targets) top.querySelector(`.steps i:nth-child(${s.index + 1})`).className = ok ? "ok" : "ng";
    showFeedback(q, choice, ok);
  }

  // STUDY_GOAL に届いていない語を、数問あとにもう一度出す（別の語をはさむと思い出す間隔ができる）
  function requeue(s, w, ok) {
    s.tries[w.id] = (s.tries[w.id] || 0) + 1;
    if (level(w.id) >= STUDY_GOAL || s.tries[w.id] >= MAX_TRIES) return;
    const at = Math.min(s.questions.length, s.index + 1 + (ok ? REQUEUE_GAP.ok : REQUEUE_GAP.ng));
    s.questions.splice(at, 0, { word: w, pending: true });
  }

  function showFeedback(q, choice, ok) {
    const s = session;
    const w = q.word;
    const last = s.index >= s.questions.length - 1;
    const wrongRef = !ok && choice.ref && choice.ref.id !== w.id ? choice.ref : null;
    const firstSentence = w.etymology.story.split("。")[0] + "。";
    const box = document.createElement("section");
    box.className = `card feedback ${ok ? "ok" : "ng"} pop`;
    box.innerHTML = html`
      <div class="verdict">
        <span>${ok ? "✓ 正解！" : choice.skipped ? "答えはこちら" : "✗ おしい！"}</span>
        <span class="spacer"></span>
        ${meter(level(w.id))}
      </div>
      <div class="fb-body">
        <div class="row"><span class="word">${esc(w.word)}</span><span class="muted ipa">/${esc(ipaText(w.ipa, !!w.lang))}/</span><span class="muted">${esc(w.katakana)}</span>
          <span class="spacer"></span>${voiceButton(`${w.id}.word,${w.id}.meaning`)}</div>
        <div class="meaning">${esc(w.meaning)}</div>
        ${q.synonym ? `<div class="tip">🔀 <b>${esc(q.synonym.word)}</b>：${esc(q.synonym.nuance)}</div>` : ""}
        ${q.pairSet ? pairTip(q.pairSet) : ""}
        ${wrongRef ? `<div class="tip">🤔 選んだ <b>${esc(wrongRef.word)}</b> は「${esc(wrongRef.meaning)}」</div>` : ""}
        ${!ok && q.type === "spell" && !choice.skipped ? `<div class="tip">✏️ あなたのつづり：<b>${esc(choice.label)}</b></div>` : ""}
        <div class="tip">📜 ${esc(w.etymology.origin)}<br>💡 ${esc(firstSentence)}</div>
        ${w.gap ? `<div class="tip warn">⚠️ ${esc(w.gap)}</div>` : ""}
        <div class="row" style="margin-top:14px">
          <button class="btn secondary" data-detail="${w.id}">📖 くわしく</button>
          <span class="spacer"></span>
          <button class="btn ${ok ? "green" : ""}" id="next">${last ? "結果を見る" : "つぎへ ›"}</button>
        </div>
      </div>`;
    $view.querySelector(".question").after(box);
    if (state.settings.autoVoice) playVoice([`${w.id}.word`, `${w.id}.meaning`]);
    box.querySelector("[data-detail]").addEventListener("click", () => openDetail(w.id));
    const next = box.querySelector("#next");
    next.addEventListener("click", () => {
      if (last) finishSession();
      else { s.index++; renderQuestion(); window.scrollTo(0, 0); }
    });
    next.focus({ preventScroll: true });
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function updateStreak() {
    const today = todayKey();
    if (state.lastDay === today) return false;
    const yesterday = todayKey(Date.now() - DAY);
    const welcomeBack = state.lastDay && state.lastDay !== yesterday;
    state.streak = state.lastDay === yesterday ? state.streak + 1 : 1;
    state.lastDay = today;
    return welcomeBack;
  }

  function finishSession() {
    const s = session;
    if (!s.results.length) { go("home"); return; }
    const complete = s.targets ? s.targets.every((w) => level(w.id) >= STUDY_GOAL) : s.results.length === s.questions.length;
    const welcomeBack = updateStreak();
    state.sessions++;
    save();
    renderHud();

    const seen = [...new Map(s.results.map((r) => [r.word.id, r.word])).values()];
    const newWords = seen.filter((w) => s.startLevels[w.id] === 0);
    const levelUps = seen.filter((w) => s.startLevels[w.id] > 0 && level(w.id) > s.startLevels[w.id]);
    const missed = [...new Map(s.results.filter((r) => !r.ok).map((r) => [r.word.id, r.word])).values()];
    const acc = s.correct / s.results.length;
    const reached = reachedCourse();
    const cleared = reached !== s.startReached && reached ? reached : null;
    const headline = acc === 1 ? "パーフェクト！" : acc >= 0.7 ? "よくできました！" : "おつかれさま！";
    const chips = (ws, withMeter) => ws.map((w) => `<button class="chip" data-detail="${w.id}">${esc(w.word)}${withMeter ? meter(level(w.id)) : ""}</button>`).join("");

    // 結果画面も集中モードのまま（タブは出さない）。ボタンからホームへ戻る
    $view.innerHTML = html`
      <div class="result">
        <div class="burst ${acc >= 0.7 ? "shine" : ""}"><span>${acc === 1 ? "🏆" : acc >= 0.7 ? "🎉" : "🌱"}</span></div>
        <h1 class="display">${headline}</h1>
        <p class="muted">${esc(s.title)}${complete ? " 完了" : "（途中まで）"}</p>
        ${welcomeBack ? `<p class="small">おかえりなさい。また一緒に続けましょう。</p>` : ""}
        ${cleared ? html`<section class="card level-up pop" style="--area:var(--area-${cleared})">${badge(cleared, true)}<b>🏅 ${esc(courseLabel(cleared))}をクリア！</b><div class="small muted">このレベルの単語の8割が定着しました</div></section>` : ""}
        <section class="card result-grid pop">
          <div>${ring(acc, `${Math.round(acc * 100)}<small>%</small>`)}<span>正答率</span></div>
          <div><b>${s.correct}<small>/${s.results.length}</small></b><span>正解</span></div>
          <div><b>${state.streak}</b><span>🔥 連続日数</span></div>
        </section>
        <section class="card drops">
          ${newWords.length ? `<h4>✨ 新しく出会った語</h4><div>${chips(newWords, false)}</div>` : ""}
          ${levelUps.length ? `<h4>⬆️ 習熟度が上がった語</h4><div>${chips(levelUps, true)}</div>` : ""}
          ${missed.length ? `<h4>🔁 もう一度確認したい語</h4><div>${chips(missed, false)}</div>` : ""}
          ${!newWords.length && !levelUps.length && !missed.length ? `<div class="small muted">次の復習で習熟度が上がります。</div>` : ""}
        </section>
        <div class="row">
          ${s.kind === "study" ? `<button class="btn secondary" id="again">▶ ${complete ? planLabel(nextPlan(s.course)) : "続きから"}</button>` : ""}
          <span class="spacer"></span>
          <button class="btn" id="home">ホームへ</button>
        </div>
      </div>`;
    $view.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
    $view.querySelector("#again")?.addEventListener("click", () => startSession({ kind: "study", course: s.course }));
    $view.querySelector("#home").addEventListener("click", () => go("home"));
    session = null;
    window.scrollTo(0, 0);
  }

  // ---------- 単語帳 ----------
  const dexFilter = { q: "", course: "all", kind: "all", trap: false };
  // 検索用に、ひらがなをカタカナにし、空白・中黒・ハイフンを除いて小文字にそろえる
  const normalize = (t) => t.toLowerCase().replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).replace(/[\s・＝=\-‐]/g, "");
  // 辞書（data/dictionary.json）。カタカナ語を引くための軽いデータで、学習には出さない。単語帳を開いたときに読み込む
  let DICT = null;
  let dictLoading = null;
  function loadDict() {
    dictLoading ||= fetch("data/dictionary.json").then((r) => r.json()).then((d) => {
      DICT = d.map((x) => ({ ...x, key: normalize(`${x.word}|${x.katakana}|${x.meaning}`) }));
    }).catch(() => { DICT = []; });
    return dictLoading;
  }
  function renderDex() {
    const found = WORDS.filter((w) => level(w.id) > 0).length;
    $view.innerHTML = html`
      <h2 class="section-title">単語帳 <span class="small muted">${found}/${WORDS.length} 語 学習済み</span></h2>
      <div class="filters">
        <input id="q" type="search" placeholder="英語・カタカナ・意味で検索" value="${esc(dexFilter.q)}" aria-label="検索">
        <select id="course" aria-label="コース">
          <option value="all">すべて</option>
          ${COURSE_ORDER.map((k) => `<option value="${k}" ${dexFilter.course === k ? "selected" : ""}>${esc(COURSES[k].name)} ${esc(COURSES[k].title)}</option>`).join("")}
        </select>
        <select id="kind" aria-label="種類">
          <option value="all">全種類</option>
          ${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${dexFilter.kind === k ? "selected" : ""}>${esc(v)}</option>`).join("")}
        </select>
      </div>
      <label class="toggle"><input type="checkbox" id="trap" ${dexFilter.trap ? "checked" : ""}><span></span> ⚠️ カタカナの罠だけ表示</label>
      <div class="dex-grid" id="grid"></div>
      <div id="dict" class="dict"></div>`;
    loadDict();
    const drawGrid = () => {
      const q = normalize(dexFilter.q.trim());
      const list = WORDS.filter((w) =>
        (dexFilter.course === "all" || courseOf(w) === dexFilter.course) &&
        (dexFilter.kind === "all" || kindOf(w) === dexFilter.kind) &&
        (!dexFilter.trap || w.gap) &&
        (!q || [w.word, w.katakana, w.meaning, ...w.synonyms.map((s) => s.word)].some((t) => normalize(t).includes(q))));
      const grid = $view.querySelector("#grid");
      grid.innerHTML = list.length ? list.map((w) => html`
        <button class="dex-item ${level(w.id) ? "" : "new"}" data-detail="${w.id}" style="--area:var(--area-${courseOf(w)})">
          <span class="w">${esc(w.word)} ${w.gap ? "⚠️" : ""}</span>
          <span class="small muted">${esc(w.katakana)}${w.lang ? `・${esc(langName(w))}` : ""}</span>
          <span class="grade-chip">${esc(COURSES[courseOf(w)].name)}</span>
          ${meter(level(w.id))}
        </button>`).join("") : `<p class="muted">単語帳には見つかりませんでした</p>`;
      grid.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
      drawDict(q);
    };
    // 検索語があるときは、単語帳の下に辞書の検索結果も出す
    let dictLimit = 50;
    const drawDict = (q) => {
      const box = $view.querySelector("#dict");
      if (!q) { box.innerHTML = `<p class="small muted">📖 検索すると、単語帳にない${DICT ? ` ${DICT.length.toLocaleString()} 語の` : ""}カタカナ語も辞書から引けます。</p>`; return; }
      if (!DICT) { box.innerHTML = `<p class="small muted">📖 辞書を読み込んでいます…</p>`; loadDict().then(() => drawDict(normalize(dexFilter.q.trim()))); return; }
      // 見出し語が検索語で始まるものを先に出す
      const starts = (d) => normalize(d.katakana).split("／").some((k) => k.startsWith(q)) || normalize(d.word).startsWith(q);
      const hits = DICT.filter((d) => d.key.includes(q)).sort((a, b) => starts(b) - starts(a));
      box.innerHTML = html`
        <h3 class="section-title">📖 辞書 <span class="small muted">${hits.length.toLocaleString()} 件</span></h3>
        ${hits.length ? html`<ul class="dict-list">${hits.slice(0, dictLimit).map((d) => html`
          <li><button class="dict-item" data-dict="${d.id}">
            <span class="k">${esc(d.katakana)}</span>
            <span class="w">${esc(d.word)}</span>
            <span class="small muted">${esc(d.pos)}${d.lang ? `・${esc(langName(d))}` : ""}${d.wasei ? "・和製英語" : ""}${d.ref ? "・📘単語帳にあり" : ""}</span>
            ${dictMeaning(d) ? `<span class="m">${esc(dictMeaning(d))}</span>` : ""}
          </button></li>`).join("")}</ul>
          ${hits.length > dictLimit ? `<button class="btn secondary small" id="dict-more">もっと見る（残り ${(hits.length - dictLimit).toLocaleString()} 件）</button>` : ""}` : `<p class="muted">辞書にも見つかりませんでした</p>`}`;
      box.querySelectorAll("[data-dict]").forEach((el) => el.addEventListener("click", () => openDictEntry(DICT.find((d) => d.id === el.dataset.dict))));
      box.querySelector("#dict-more")?.addEventListener("click", () => { dictLimit += 100; drawDict(q); });
    };
    $view.querySelector("#q").addEventListener("input", (e) => { dexFilter.q = e.target.value; dictLimit = 50; drawGrid(); });
    $view.querySelector("#course").addEventListener("change", (e) => { dexFilter.course = e.target.value; drawGrid(); });
    $view.querySelector("#kind").addEventListener("change", (e) => { dexFilter.kind = e.target.value; drawGrid(); });
    $view.querySelector("#trap").addEventListener("change", (e) => { dexFilter.trap = e.target.checked; drawGrid(); });
    drawGrid();
  }

  // 意味が見出しのカタカナと同じ（アイシャドー → アイシャドー など）ときは出さない
  function dictMeaning(d) {
    const m = d.meaning.replace(/\s/g, "");
    return d.katakana.split("／").some((k) => k.replace(/\s/g, "") === m) ? "" : d.meaning;
  }

  // 辞書の項目。単語帳に同じ語があれば、そちらの詳しいページを開ける
  function openDictEntry(d) {
    const w = d.ref && byId[d.ref];
    $modalContent.innerHTML = html`
      <div class="detail">
        <div class="detail-head">
          <div class="small muted">📖 辞書 ・ ${esc(d.pos)}${d.lang ? `（${esc(langName(d))}）` : ""}</div>
          <h2 class="display">${esc(d.word)}</h2>
          <div class="muted">${esc(d.katakana)}</div>
          ${dictMeaning(d) ? `<p class="meaning">${esc(dictMeaning(d))}</p>` : ""}
        </div>
        ${d.wasei ? `<div class="tip warn">⚠️ 和製英語、または日本で独自に作られた・使われている語です。英語圏ではそのままでは通じないことがあります。</div>` : ""}
        ${w ? html`<section><button class="btn block" id="to-word">📘 単語帳の「${esc(w.word)}」を見る（例文・語源・類義語）</button></section>` : ""}
      </div>`;
    $modalContent.querySelector("#to-word")?.addEventListener("click", () => openDetail(w.id));
    openModal();
  }

  function openDetail(id) {
    const w = byId[id];
    const lv = level(id);
    const roots = w.roots.map((r) => ROOTS.find((x) => x.id === r));
    $modalContent.innerHTML = html`
      <div class="detail" style="--area:var(--area-${courseOf(w)})">
        <div class="detail-head">
          <div class="small muted"><span class="grade-chip">${esc(courseLabel(courseOf(w)))}</span> ${esc(w.pos)}${w.lang ? `（${esc(langName(w))}）` : ""}</div>
          <div class="row">
            <h2 class="display">${esc(w.word)}</h2>
            <span class="say">${voiceButton(`${w.id}.word`)}<span class="ipa muted">/${esc(ipaText(w.ipa, !!w.lang))}/</span></span>
          </div>
          <div class="muted">${esc(w.katakana)}</div>
          <p class="meaning">${esc(w.meaning)}</p>
          <div class="row small">${meter(lv)}<span class="muted">${LEVELS[lv]}</span></div>
        </div>

        <section><h4>📍 シーン</h4>${esc(w.scene)}</section>
        ${w.gap ? `<section><h4>⚠️ カタカナの罠</h4><div class="tip warn">${esc(w.gap)}</div></section>` : ""}
        <section><h4>💬 例文</h4><i>${esc(w.example.en)}</i> ${voiceButton(`${w.id}.example.en`, "🔈")}<br><span class="muted">${esc(w.example.ja)}</span></section>
        <section><h4>📜 語源</h4><b>${esc(w.etymology.origin)}</b><p style="margin:6px 0 0">${esc(w.etymology.story)}</p></section>
        ${roots.length ? `<section><h4>🧩 語根</h4>${roots.map((r) => `<span class="chip">${esc(r.form)}＝${esc(r.meaning)}</span>`).join("")}</section>` : ""}
        ${w.family.length ? `<section><h4>🌳 同じ語源の仲間</h4>${w.family.map((f) => `<span class="chip">${esc(f)}</span>`).join("")}</section>` : ""}
        ${pairsByWord[w.word] ? html`<section><h4>👯 まぎらわしい単語</h4>${pairsByWord[w.word].map((p) => `<button class="chip" data-pair="${p.id}">${p.words.map((x) => esc(x.word)).join(" / ")}</button>`).join("")}</section>` : ""}
        <section>
          <h4>🔀 ${synLabel(w)}（ニュアンスと語源）</h4>
          <table class="syn-table">
            <thead><tr><th>単語</th><th>ニュアンス</th><th>語源</th></tr></thead>
            <tbody>
              ${w.synonyms.map((x) => html`<tr>
                <td><b>${esc(x.word)}</b> ${voiceButton(synKey(x.word), "🔈")}<br><span class="small muted">${esc(x.meaning)}</span></td>
                <td>${esc(x.nuance)}</td>
                <td class="small">${esc(x.etymology)}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </section>
      </div>`;
    openModal();
  }

  let onModalClose = null;
  function openModal(onClose = null) {
    onModalClose = onClose;
    $modal.hidden = false;
    $modal.querySelector(".modal-body").scrollTop = 0;
  }
  function closeModal() {
    if ($modal.hidden) return;
    stopVoice();
    $modal.hidden = true;
    const cb = onModalClose;
    onModalClose = null;
    cb?.();
  }

  // ---------- 語根 ----------
  function renderRoots() {
    const complete = (r) => r.words.every((id) => level(id) >= LEARNED);
    const done = ROOTS.filter(complete).length;
    $view.innerHTML = html`
      <h2 class="section-title">語根 <span class="small muted">${done}/${ROOTS.length} コンプリート</span></h2>
      <p class="small lead">同じ語根をもつ単語をまとめて覚えると、知らない単語の意味も推測できるようになります。すべて「${LEVELS[LEARNED]}」以上でコンプリート。</p>
      ${ROOTS.map((r) => {
        const n = r.words.filter((id) => level(id) >= LEARNED).length;
        return html`
          <section class="card root ${complete(r) ? "done" : ""}">
            <div class="root-head">
              <span class="root-form">${esc(r.form)}</span>
              <div class="spacer"><b>${esc(r.meaning)}</b><div class="small muted">${esc(r.source)}</div></div>
              ${ring(n / r.words.length, complete(r) ? "✓" : `${n}<small>/${r.words.length}</small>`)}
            </div>
            <div>${r.words.map((id) => `<button class="chip" data-detail="${id}">${esc(byId[id].word)}${meter(level(id))}</button>`).join("")}</div>
            <div class="small muted" style="margin-top:6px">ほかにも：${r.extra.map(esc).join(", ")}</div>
          </section>`;
      }).join("")}`;
    $view.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
  }

  // ---------- 似た単語（まぎらわしい単語セット） ----------
  // 習熟度は単語と同じしくみ（state.cards）で、キーを "pair:セットID" にして持つ
  const pairKey = (p) => `pair:${p.id}`;
  const pairWordKey = (x) => `pw.${x.word}`;
  const pairExampleKey = (p, x) => `pe.${p.id}.${x.word}`;
  const blankOut = (x) => x.example.en.replace(new RegExp(`\\b${x.word}\\b`, "i"), "＿＿＿");
  const pairLearned = () => PAIRS.filter((p) => level(pairKey(p)) >= LEARNED).length;
  const pairDue = () => PAIRS.filter((p) => isDue(pairKey(p)));
  const pairTip = (p) => html`
    <div class="tip">👯 ${p.words.map((x) => `<b>${esc(x.word)}</b> <span class="ipa">/${esc(ipaText(x.ipa))}/</span> ${esc(x.meaning)}`).join("<br>")}<br><span class="small">${esc(p.point)}</span></div>`;
  const pairFilter = { kind: "all" };

  function pairCard(p) {
    const k = PAIR_KINDS[p.kind];
    return html`
      <section class="card pair-card" style="--area:var(--area-${p.level})">
        <div class="row small">
          <span class="grade-chip">${esc(COURSES[p.level].name)}</span>
          <span class="muted">${k.icon} ${esc(k.name)}</span>
          <span class="spacer"></span>${meter(level(pairKey(p)))}
        </div>
        <div class="pair-words">
          ${p.words.map((x) => html`
            <div class="pair-word">
              <div class="row"><b class="en">${esc(x.word)}</b>${voiceButton(pairWordKey(x), "🔈")}</div>
              <div class="small muted ipa">/${esc(ipaText(x.ipa))}/ ・ ${esc(x.pos)}</div>
              <div class="small">${esc(x.meaning)}</div>
            </div>`).join("")}
        </div>
        <p class="small pair-point">${esc(p.point)}</p>
        <details class="pair-examples"><summary class="small">例文</summary>
          ${p.words.map((x) => `<p class="small"><i>${esc(x.example.en)}</i> ${voiceButton(pairExampleKey(p, x), "🔈")}<br><span class="muted">${esc(x.example.ja)}</span></p>`).join("")}
        </details>
        <button class="btn secondary small block" data-pair-practice="${p.id}">▶ このセットを練習</button>
      </section>`;
  }

  function renderPairs() {
    const due = pairDue();
    $view.innerHTML = html`
      <h2 class="section-title">似た単語 <span class="small muted">${pairLearned()}/${PAIRS.length} セット 得意</span></h2>
      <p class="small lead">母音が1つちがうだけの語、カタカナにすると同じになる語、英検によく出るつづりの似た語をセットで覚えます。🔈で音のちがいを聞きくらべてみましょう。</p>
      <button class="btn block" id="pair-practice">▶ ${due.length ? `復習する（${Math.min(due.length, QUESTIONS_PER_SESSION)}問）` : `まとめて練習（${QUESTIONS_PER_SESSION}問）`}</button>
      <div class="chip-row" id="pair-kinds">
        <button class="chip ${pairFilter.kind === "all" ? "on" : ""}" data-kind="all">すべて</button>
        ${Object.entries(PAIR_KINDS).map(([k, v]) => `<button class="chip ${pairFilter.kind === k ? "on" : ""}" data-kind="${k}">${v.icon} ${esc(v.name)}</button>`).join("")}
      </div>
      <div id="pair-list"></div>`;
    const draw = () => {
      const list = PAIRS.filter((p) => pairFilter.kind === "all" || p.kind === pairFilter.kind).sort((a, b) => a.level - b.level);
      $view.querySelector("#pair-list").innerHTML = list.map(pairCard).join("");
      $view.querySelectorAll("[data-pair-practice]").forEach((b) => b.addEventListener("click", () => {
        startPairSession([PAIRS.find((p) => p.id === b.dataset.pairPractice)]);
      }));
    };
    $view.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => {
      pairFilter.kind = b.dataset.kind;
      $view.querySelectorAll("[data-kind]").forEach((x) => x.classList.toggle("on", x === b));
      draw();
    }));
    $view.querySelector("#pair-practice").addEventListener("click", () => startPairSession(pickPairsForPractice()));
    draw();
  }

  // 復習期限のセット → まだ練習していないセット（やさしい順）→ 習熟度の低いセット、の順に選ぶ
  function pickPairsForPractice() {
    const due = shuffle(pairDue());
    const fresh = PAIRS.filter((p) => level(pairKey(p)) === 0).sort((a, b) => a.level - b.level || Math.random() - 0.5);
    const rest = PAIRS.filter((p) => level(pairKey(p)) > 0 && !isDue(pairKey(p))).sort((a, b) => level(pairKey(a)) - level(pairKey(b)));
    return [...new Set([...due, ...fresh, ...rest])].slice(0, QUESTIONS_PER_SESSION);
  }

  function openPairSet(id) {
    const p = PAIRS.find((x) => x.id === id);
    if (!p) return;
    $modalContent.innerHTML = pairCard(p);
    $modalContent.querySelector("[data-pair-practice]").addEventListener("click", () => { closeModal(); startPairSession([p]); });
    openModal();
  }

  // 問題：空所補充（例文の空所にどの語が入るか）と、聞き取り（音のちがいのセットのみ）
  function makePairQuestion(p, target, type) {
    if (type === "listen") {
      return {
        set: p, target, type,
        prompt: html`<span class="big">🔊</span>聞こえたのはどっち？`,
        choices: shuffle(p.words.map((x) => ({ label: `${x.word}（${x.meaning}）`, correct: x === target }))),
      };
    }
    return {
      set: p, target, type,
      prompt: html`<span class="pair-sentence">${esc(blankOut(target))}</span><span class="scene">${esc(target.example.ja)}</span>空所に入るのはどれ？`,
      choices: shuffle(p.words.map((x) => ({ label: x.word, correct: x === target }))),
    };
  }

  function startPairSession(sets) {
    const single = sets.length === 1;
    const questions = single
      // 1セットだけのときは、セットの全部の語を空所補充で、音のセットなら聞き取りも1問
      ? [...sets[0].words.map((x) => makePairQuestion(sets[0], x, "blank")),
        ...(PAIR_KINDS[sets[0].kind].listen ? [makePairQuestion(sets[0], pick(sets[0].words), "listen")] : [])]
      : sets.map((p) => makePairQuestion(p, pick(p.words), PAIR_KINDS[p.kind].listen && Math.random() < 0.5 ? "listen" : "blank"));
    pairSession = { questions: shuffle(questions), index: 0, correct: 0, results: [] };
    document.body.classList.add("in-session");
    renderPairQuestion();
  }

  function renderPairQuestion() {
    const s = pairSession;
    const q = s.questions[s.index];
    const k = PAIR_KINDS[q.set.kind];
    $view.innerHTML = html`
      <div class="quiz-top">
        <button class="icon-btn" id="quit" aria-label="やめる">✕</button>
        <div class="steps">${s.questions.map((_, i) => `<i class="${i < s.index ? (s.results[i] ? "ok" : "ng") : i === s.index ? "now" : ""}"></i>`).join("")}</div>
        <span class="count">${s.index + 1}/${s.questions.length}</span>
      </div>
      <div class="small muted quiz-title">似た単語</div>
      <section class="card question pop">
        <div class="row"><span class="tag">${k.icon} ${esc(k.name)}</span><span class="spacer"></span>
          ${q.type === "listen" ? voiceButton(pairWordKey(q.target)) : ""}</div>
        <div class="prompt">${q.prompt}</div>
        <div class="choices">${q.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="key">${"ABCD"[i]}</span><span>${esc(c.label)}</span></button>`).join("")}</div>
      </section>`;
    $view.querySelector("#quit").addEventListener("click", () => {
      if (!s.results.length || confirm("練習をやめますか？ ここまでの記録は保存されます。")) finishPairSession();
    });
    $view.querySelectorAll(".choice").forEach((el) => el.addEventListener("click", () => answerPair(q, +el.dataset.i, el)));
    if (q.type === "listen") playVoice([pairWordKey(q.target)]);
  }

  function answerPair(q, i, button) {
    const s = pairSession;
    const ok = q.choices[i].correct;
    s.results.push(ok);
    $view.querySelectorAll(".choice").forEach((el, j) => {
      el.disabled = true;
      if (q.choices[j].correct) el.classList.add("correct");
    });
    if (!ok) button.classList.add("wrong");
    $view.querySelector(`.steps i:nth-child(${s.index + 1})`).className = ok ? "ok" : "ng";
    const key = pairKey(q.set);
    const c = { ...card(key) };
    c.seen = (c.seen || 0) + 1;
    if (ok) { c.correct = (c.correct || 0) + 1; c.level = Math.min(5, (c.level || 0) + 1); s.correct++; state.correct++; }
    else c.level = Math.max(1, (c.level || 0) - 1);
    c.due = Date.now() + INTERVAL_DAYS[c.level] * DAY;
    state.cards[key] = c;
    state.answered++;
    save();

    const last = s.index >= s.questions.length - 1;
    const box = document.createElement("section");
    box.className = `card feedback ${ok ? "ok" : "ng"} pop`;
    box.innerHTML = html`
      <div class="verdict"><span>${ok ? "✓ 正解！" : "✗ おしい！"}</span><span class="spacer"></span>${meter(level(key))}</div>
      <div class="fb-body">
        <div class="row"><span class="word">${esc(q.target.word)}</span><span class="spacer"></span>${voiceButton(q.set.words.map(pairWordKey).join(","))}</div>
        <p class="small" style="margin:4px 0 0"><i>${esc(q.target.example.en)}</i><br><span class="muted">${esc(q.target.example.ja)}</span></p>
        ${pairTip(q.set)}
        <div class="row" style="margin-top:14px"><span class="spacer"></span>
          <button class="btn ${ok ? "green" : ""}" id="next">${last ? "結果を見る" : "つぎへ ›"}</button></div>
      </div>`;
    $view.querySelector(".question").after(box);
    if (state.settings.autoVoice) playVoice(q.set.words.map(pairWordKey));
    const next = box.querySelector("#next");
    next.addEventListener("click", () => {
      if (last) finishPairSession();
      else { s.index++; renderPairQuestion(); window.scrollTo(0, 0); }
    });
    next.focus({ preventScroll: true });
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function finishPairSession() {
    const s = pairSession;
    pairSession = null;
    if (!s.results.length) { go("pairs"); return; }
    updateStreak();
    state.sessions++;
    save();
    renderHud();
    const acc = s.correct / s.results.length;
    const sets = [...new Set(s.questions.slice(0, s.results.length).map((q) => q.set))];
    $view.innerHTML = html`
      <div class="result">
        <div class="burst ${acc >= 0.7 ? "shine" : ""}"><span>${acc === 1 ? "🏆" : acc >= 0.7 ? "🎉" : "🌱"}</span></div>
        <h1 class="display">${acc === 1 ? "パーフェクト！" : acc >= 0.7 ? "よくできました！" : "おつかれさま！"}</h1>
        <p class="muted">似た単語 ${s.correct}/${s.results.length} 問正解</p>
        <section class="card drops">
          <h4>👯 練習したセット</h4>
          <div>${sets.map((p) => `<button class="chip" data-pair="${p.id}">${p.words.map((x) => esc(x.word)).join(" / ")}${meter(level(pairKey(p)))}</button>`).join("")}</div>
        </section>
        <div class="row"><span class="spacer"></span><button class="btn" id="back">似た単語へ</button></div>
      </div>`;
    $view.querySelector("#back").addEventListener("click", () => go("pairs"));
    window.scrollTo(0, 0);
  }

  // ---------- 記録・設定 ----------
  function renderStats() {
    const dist = [0, 1, 2, 3, 4, 5].map((n) => WORDS.filter((w) => level(w.id) === n).length);
    const acc = state.answered ? state.correct / state.answered : 0;
    const met = WORDS.filter((w) => level(w.id) > 0).length;
    $view.innerHTML = html`
      <h2 class="section-title">記録</h2>
      <section class="card result-grid">
        <div>${ring(learnedCount() / WORDS.length, `${learnedCount()}<small>/${WORDS.length}</small>`)}<span>定着した語</span></div>
        <div>${ring(acc, `${Math.round(acc * 100)}<small>%</small>`)}<span>正答率</span></div>
        <div><b>${state.streak}</b><span>🔥 連続日数</span></div>
        <div><b>${met}<small>/${WORDS.length}</small></b><span>出会った語</span></div>
        <div><b>${state.sessions}</b><span>学習回数</span></div>
        <div><b>${state.answered}</b><span>回答数</span></div>
        <div><b>${pairLearned()}<small>/${PAIRS.length}</small></b><span>👯 似た単語</span></div>
      </section>
      <section class="card">
        <h3>レベル別の定着度</h3>
        ${COURSE_ORDER.map((c) => {
          const { total, learned } = courseLearned(c);
          return html`
            <div class="dist-row grade-row">
              <span class="dist-label">${badge(c)}<span class="small">${esc(COURSES[c].title)}</span></span>
              ${bar(learned / total, learned >= total * MASTERED ? "lv5" : "")}
              <span class="small num">${learned}/${total}</span>
            </div>`;
        }).join("")}
        <p class="small muted" style="margin:10px 0 0">各レベルの単語の8割が「${LEVELS[LEARNED]}」以上になると、そのレベルをクリアです。</p>
      </section>
      <section class="card">
        <h3>習熟度の分布</h3>
        ${dist.map((n, i) => html`
          <div class="dist-row">
            <span class="dist-label">${meter(i)}<span class="small">${LEVELS[i]}</span></span>
            ${bar(n / WORDS.length, `lv${i}`)}
            <span class="small num">${n}</span>
          </div>`).join("")}
        <p class="small muted" style="margin:10px 0 0">正解するたびに1段階上がり、次の復習までの間隔が「当日 → 1日 → 3日 → 7日 → 21日」と伸びていきます。</p>
      </section>
      <p class="small center settings-hint">テーマ・音声・記録のリセットは、右上の ⚙️ 設定から。</p>`;
  }

  // ---------- 音声 ----------
  // 事前生成した音声ファイル（scripts/tts/tts.py）を優先し、無いものはブラウザの読み上げで代用する
  const synKey = (word) => "syn." + word.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const voiceButton = (keys, label = "🔊") => `<button class="speak" data-voice="${esc(keys)}" aria-label="読み上げ">${label}</button>`;
  let voiceToken = 0;
  let currentAudio = null;
  let voiceExt = null;

  function buildClips() {
    for (const w of WORDS) {
      CLIPS[`${w.id}.word`] = { text: w.word, lang: w.lang || "en" };
      CLIPS[`${w.id}.katakana`] = { text: plainKatakana(w), lang: "ja" };
      CLIPS[`${w.id}.meaning`] = { text: w.meaning, lang: "ja" };
      CLIPS[`${w.id}.example.en`] = { text: w.example.en, lang: "en" };
      CLIPS[`${w.id}.example.ja`] = { text: w.example.ja, lang: "ja" };
      CLIPS[`${w.id}.story`] = { text: w.etymology.story, lang: "ja" };
      for (const s of w.synonyms) CLIPS[synKey(s.word)] = { text: s.word, lang: "en" };
    }
    for (const p of PAIRS) {
      for (const x of p.words) {
        CLIPS[pairWordKey(x)] = { text: x.word, lang: "en" };
        CLIPS[pairExampleKey(p, x)] = { text: x.example.en, lang: "en" };
      }
    }
  }

  function stopVoice() {
    voiceToken++;
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  function playClip(key) {
    const clip = CLIPS[key];
    const hash = VOICE?.items[key];
    if (hash && voiceExt) {
      const audio = new Audio(`${VOICE.base}${hash}.${voiceExt}`);
      currentAudio = audio;
      return new Promise((done) => {
        audio.onended = audio.onerror = done;
        audio.play().catch(done);
      });
    }
    if (!clip || !("speechSynthesis" in window)) return Promise.resolve();
    return new Promise((done) => {
      const u = new SpeechSynthesisUtterance(clip.text);
      u.lang = clip.lang === "ja" ? "ja-JP" : LANGS[clip.lang]?.speech || "en-US";
      u.rate = clip.lang === "ja" ? 1.05 : 0.9;
      u.onend = u.onerror = done;
      speechSynthesis.speak(u);
    });
  }

  // 複数の音声を順番に再生する（例：英単語 → 日本語の意味）。新しい再生が始まったら前のものは止める
  async function playVoice(keys) {
    stopVoice();
    const token = voiceToken;
    for (const key of keys) {
      if (token !== voiceToken) return;
      await playClip(key);
    }
  }

  async function loadVoice() {
    try {
      const res = await fetch("audio/manifest.json");
      if (!res.ok) return;
      VOICE = await res.json();
      const probe = document.createElement("audio");
      const mime = { webm: 'audio/webm; codecs="opus"', m4a: 'audio/mp4; codecs="mp4a.40.2"' };
      voiceExt = VOICE.formats.find((f) => probe.canPlayType(mime[f])) || null;
    } catch { /* 音声ファイルが無くてもブラウザの読み上げで動く */ }
  }

  // ---------- 起動 ----------
  async function init() {
    try {
      const [w, r, p] = await Promise.all([fetch("data/words.json"), fetch("data/roots.json"), fetch("data/pairs.json")]);
      WORDS = await w.json();
      ROOTS = await r.json();
      PAIRS = await p.json();
    } catch (e) {
      $view.innerHTML = `<div class="card">データを読み込めませんでした。<br><code>python3 -m http.server</code> などでローカルサーバーを起動して開いてください。</div>`;
      return;
    }
    byId = Object.fromEntries(WORDS.map((w) => [w.id, w]));
    for (const p of PAIRS) for (const x of p.words) (pairsByWord[x.word] ||= []).push(p);
    buildClips();
    await loadVoice();
    state = load();
    state.settings = { ...defaultState().settings, ...state.settings };
    applyTheme();
    document.getElementById("settings-btn").addEventListener("click", openSettings);
    document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
    document.getElementById("modal-close").addEventListener("click", closeModal);
    $modal.addEventListener("click", (e) => { if (e.target === $modal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-voice]");
      if (b) playVoice(b.dataset.voice.split(","));
      const p = e.target.closest("[data-pair]");
      if (p) openPairSet(p.dataset.pair);
    });
    go("home");
  }

  init();
})();
