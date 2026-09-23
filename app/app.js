/* Vocab Quest — カタカナ語から英単語を学ぶ単語アプリ（依存なし） */
(() => {
  "use strict";

  // ---------- 学習コンテンツの定義 ----------
  // コースはこのアプリ独自のレベル（words.json の level）。カタカナとしてのなじみやすさと英語の難しさで分ける。
  // ジャンルでは分けず、身近な語もゲームの語も同じレベルに混ぜて出す
  const COURSES = {
    "1": { name: "Lv.1", title: "ひと目でわかる", desc: "誰でも知っているカタカナ。英語も短くてやさしい" },
    "2": { name: "Lv.2", title: "くらしの定番", desc: "家・食べ物・街など、毎日の生活で使うことば" },
    "3": { name: "Lv.3", title: "よく使う", desc: "学校・趣味・お出かけでよく使うことば" },
    "4": { name: "Lv.4", title: "話が広がる", desc: "身近な話題を広げることば" },
    "5": { name: "Lv.5", title: "よく見聞きする", desc: "ネットやテレビでよく見聞きすることば" },
    "6": { name: "Lv.6", title: "社会の話題", desc: "ニュースや社会の話題に出てくることば" },
    "7": { name: "Lv.7", title: "大人の日常語", desc: "仕事や生活で大人がよく使うカタカナ" },
    "8": { name: "Lv.8", title: "ビジネス", desc: "会議や資料に出てくるカタカナ" },
    "9": { name: "Lv.9", title: "教養", desc: "本や評論で出会う知的なことば" },
    "10": { name: "Lv.10", title: "マスター", desc: "知っていれば上級者。大人も迷うことば" },
  };
  const COURSE_ORDER = Object.keys(COURSES).sort((a, b) => a - b);
  // 見た目のテーマ（機能は共通）。CSS は app/style.css の [data-theme]
  const THEMES = {
    stage: { name: "ステージ", desc: "パステル×グラデーション", color: "#eef4ff" },
    pop: { name: "ポップ", desc: "太いフチどりのカジュアル", color: "#2a168f" },
    street: { name: "ストリート", desc: "黒×ネオンのステッカー", color: "#0d0d0f" },
    noble: { name: "ノーブル", desc: "紺と金のファンタジー", color: "#11162c" },
  };
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
  // 習熟度（0〜5）。間隔反復のボックスに対応する
  const LEVELS = ["未学習", "出会った", "覚えかけ", "定着中", "得意", "完璧"];
  const INTERVAL_DAYS = [0, 0, 1, 3, 7, 21]; // 習熟度ごとの次回出題までの日数
  const LEARNED = 3; // この習熟度以上を「定着」とみなす
  const LESSON_SIZE = 6;
  const QUESTIONS_PER_SESSION = 8;
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
  // 文字列から決まった数を作る（レッスン内の並びを毎回同じにしつつ、ジャンルが偏らないように混ぜる）
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
      cards: {}, done: {}, streak: 0, lastDay: null,
      sessions: 0, answered: 0, correct: 0, welcomed: false,
      settings: { autoVoice: true, theme: "stage" },
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return { ...defaultState(), ...JSON.parse(raw) };
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

  // ---------- レッスン ----------
  // 各コースの単語をジャンルが混ざるように並べ、ほぼ均等に分けてレッスンにする
  function lessonsOf(course) {
    const words = WORDS.filter((w) => courseOf(w) === course).sort((a, b) => mixKey(a.id) - mixKey(b.id));
    const count = Math.ceil(words.length / LESSON_SIZE);
    const size = Math.ceil(words.length / count);
    return Array.from({ length: count }, (_, i) => ({ course, index: i, key: `${course}-${i}`, words: words.slice(i * size, (i + 1) * size) }));
  }
  const allLessons = () => COURSE_ORDER.flatMap(lessonsOf);
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
  const lessonProgress = (ls) => ls.words.reduce((n, w) => n + level(w.id), 0) / (ls.words.length * 5);
  // おすすめ：まだ一度も終えていないレッスンの中で最初のもの。全部終えていれば習熟度が一番低いもの
  function nextLesson() {
    const all = allLessons();
    return all.find((ls) => !state.done[ls.key]) || all.sort((a, b) => lessonProgress(a) - lessonProgress(b))[0];
  }

  // ---------- テーマ ----------
  function applyTheme() {
    const t = THEMES[state.settings.theme] ? state.settings.theme : "stage";
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
  function openThemes() {
    $modalContent.innerHTML = html`<h2>🎨 テーマ</h2><p class="small muted">見た目だけが変わります。学習の記録はそのままです。</p>${themeOptions()}`;
    bindThemeOptions($modalContent);
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

  // ---------- レベルの到達度 ----------
  // 到達したレベル（8割定着）と、次のレベルまでの進み具合
  function levelCard() {
    const reached = reachedCourse();
    const next = COURSE_ORDER[reached ? COURSE_ORDER.indexOf(reached) + 1 : 0];
    const { total, learned } = next ? courseLearned(next) : { total: 0, learned: 0 };
    const need = Math.max(0, Math.ceil(total * MASTERED) - learned);
    return html`
      <section class="card level-card" style="--area:var(--area-${next || reached})">
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
      </section>`;
  }

  // ---------- ホーム ----------
  function renderHome() {
    const due = dueWords();
    const next = nextLesson();
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
          <button class="btn green block" id="review">🔁 復習する（${Math.min(due.length, QUESTIONS_PER_SESSION)}問）</button>
          <p class="small muted center">忘れかけた頃にもう一度思い出すと、長く記憶に残ります。</p>` : ""}
      </section>

      ${levelCard()}
      ${pairsHomeCard()}

      ${next ? html`
        <section class="card next-lesson pop" style="--area:var(--area-${next.course})">
          <div class="ribbon">NEXT</div>
          <div class="row">
            ${badge(next.course)}
            <div class="spacer">
              <div class="small muted">${esc(COURSES[next.course].name)} ・ レッスン ${next.index + 1}</div>
              <div class="lesson-words">${next.words.slice(0, 4).map((w) => esc(plainKatakana(w))).join(" / ")}…</div>
            </div>
          </div>
          <button class="btn block" data-lesson="${next.key}">▶ ${state.done[next.key] ? "練習する" : "レッスンを始める"}</button>
        </section>` : ""}

      <h2 class="section-title">レベル別コース</h2>
      <p class="small lead">レベルはこのアプリ独自の分け方です。カタカナとしてのなじみやすさと、英語のつづり・意味の難しさで決めています。</p>
      ${COURSE_ORDER.map((k) => {
        const t = COURSES[k];
        const lessons = lessonsOf(k);
        const words = lessons.flatMap((l) => l.words);
        if (!words.length) return "";
        const learned = words.filter((w) => level(w.id) >= LEARNED).length;
        return html`
          <section class="card topic" style="--area:var(--area-${k})">
            <div class="topic-head">
              ${badge(k)}
              <div class="spacer"><h3>${esc(t.name)} ${esc(t.title)}</h3><div class="small muted">${esc(t.desc)} ・ ${words.length}語</div></div>
              ${ring(learned / words.length, `${learned}<small>/${words.length}</small>`)}
            </div>
            <details class="lessons" ${next?.course === k ? "open" : ""}>
            <summary>レッスン一覧（${lessons.filter((ls) => state.done[ls.key]).length}/${lessons.length} 完了）</summary>
            <div class="lesson-list">
              ${lessons.map((ls) => html`
                <button class="lesson ${state.done[ls.key] ? "done" : ""}" data-lesson="${ls.key}">
                  <span class="num">${state.done[ls.key] ? "✓" : ls.index + 1}</span>
                  <span class="spacer">
                    <span class="lesson-name">レッスン ${ls.index + 1}</span>
                    ${bar(lessonProgress(ls))}
                  </span>
                  <span class="chev">›</span>
                </button>`).join("")}
            </div>
            </details>
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
      startSession({ kind: "lesson", lesson: allLessons()[0] });
    });
    $view.querySelector("#review")?.addEventListener("click", () => startSession({ kind: "review" }));
    $view.querySelector("#go-pairs").addEventListener("click", () => go("pairs"));
    $view.querySelectorAll("[data-lesson]").forEach((b) => b.addEventListener("click", () => {
      const [course, i] = b.dataset.lesson.split("-");
      openLesson(lessonsOf(course)[+i]);
    }));
    $view.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
  }

  function openLesson(ls) {
    const t = COURSES[ls.course];
    const learned = ls.words.filter((w) => level(w.id) >= LEARNED).length;
    $modalContent.innerHTML = html`
      <div class="lesson-intro" style="--area:var(--area-${ls.course})">
        ${badge(ls.course, true)}
        <div class="small muted">${esc(courseLabel(ls.course))}</div>
        <h2 class="display">レッスン ${ls.index + 1}</h2>
        <p class="small muted">${learned}/${ls.words.length} 語が定着</p>
        <ul class="word-rows">
          ${ls.words.map((w) => html`
            <li><button data-detail="${w.id}">
              <span class="spacer"><b>${level(w.id) ? esc(w.word) : esc(plainKatakana(w))}</b>
                <span class="small muted">${level(w.id) ? esc(plainKatakana(w)) : "？？？"}</span></span>
              ${meter(level(w.id))}
            </button></li>`).join("")}
        </ul>
        <button class="btn block" id="go">▶ 始める（${Math.min(QUESTIONS_PER_SESSION, ls.words.length + 2)}問前後）</button>
      </div>`;
    $modalContent.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
    $modalContent.querySelector("#go").addEventListener("click", () => { closeModal(); startSession({ kind: "lesson", lesson: ls }); });
    openModal();
  }

  // ---------- 出題 ----------
  function selectWords({ kind, lesson }) {
    if (kind === "review") return shuffle(dueWords()).slice(0, QUESTIONS_PER_SESSION);
    // レッスン：レッスンの単語＋同じコースの復習期限の単語で埋める
    const extra = shuffle(WORDS.filter((w) => courseOf(w) === lesson.course && isDue(w.id) && !lesson.words.includes(w)));
    return shuffle([...lesson.words, ...extra].slice(0, QUESTIONS_PER_SESSION));
  }

  // 習熟度に応じて出題タイプを難しくする
  function allowedTypes(w) {
    const lv = level(w.id);
    const pair = pairsByWord[w.word] ? ["pair"] : [];
    if (lv <= 1) return ["kata", "meaning"];
    if (lv === 2) return ["kata", "meaning", "spell", "etym", ...pair];
    return ["spell", "etym", "syn", ...(w.trapQuiz ? ["trap"] : []), ...pair];
  }

  function distractors(w, n, filter = () => true) {
    // カタカナが同じ語（bus と bath の「バス」など）は正解と見分けられないので選択肢に出さない
    const ok = (x) => x.id !== w.id && plainKatakana(x) !== plainKatakana(w) && filter(x);
    const same = WORDS.filter((x) => ok(x) && courseOf(x) === courseOf(w));
    const other = WORDS.filter((x) => ok(x) && courseOf(x) !== courseOf(w));
    return [...shuffle(same), ...shuffle(other)].slice(0, n);
  }

  function makeQuestion(w, type) {
    const q = { word: w, type, choices: null };
    const wordChoices = (label, filter) => shuffle([w, ...distractors(w, 3, filter)]).map((x) => ({ label: label(x), correct: x.id === w.id, ref: x }));
    switch (type) {
      case "kata":
        q.prompt = html`<span class="big">${esc(w.katakana)}</span><span class="scene">📍 ${esc(mask(w.scene, w))}</span>英語での正しいつづりは？`;
        q.hint = `意味は「${w.meaning}」`;
        q.choices = wordChoices((x) => x.word);
        break;
      case "meaning":
        q.prompt = html`<span class="big en">${esc(w.word)}</span>英語での意味は？`;
        q.hint = `カタカナでは「${w.katakana}」。${w.scene}`;
        q.choices = wordChoices((x) => x.meaning);
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
        q.prompt = html`<span class="big en">${esc(s.word)}</span>（${esc(s.meaning)}）<br>この語の<b>類義語</b>はどれ？`;
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
  function startSession({ kind, lesson }) {
    const words = selectWords({ kind, lesson });
    if (!words.length) { go("home"); return; }
    session = {
      kind, lesson,
      title: kind === "review" ? "復習" : `${COURSES[lesson.course].name} ・ レッスン ${lesson.index + 1}`,
      questions: words.map((w) => makeQuestion(w, pick(allowedTypes(w)))),
      index: 0, correct: 0, results: [],
      startLevels: Object.fromEntries(words.map((w) => [w.id, level(w.id)])),
      startReached: reachedCourse(),
    };
    document.body.classList.add("in-session");
    renderQuestion();
  }

  function renderQuestion() {
    const s = session;
    const q = s.questions[s.index];
    // 出題文の読み上げ（答えがばれない物だけ）：カタカナ語、または意味を問う英単語
    const promptVoice = q.type === "kata" || q.type === "spell" ? `${q.word.id}.katakana` : q.type === "meaning" ? `${q.word.id}.word` : null;
    $view.innerHTML = html`
      <div class="quiz-top">
        <button class="icon-btn" id="quit" aria-label="やめる">✕</button>
        <div class="steps" aria-label="${s.index + 1}問目 / ${s.questions.length}問">
          ${s.questions.map((_, i) => `<i class="${i < s.index ? (s.results[i].ok ? "ok" : "ng") : i === s.index ? "now" : ""}"></i>`).join("")}
        </div>
        <span class="count">${s.index + 1}/${s.questions.length}</span>
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
    $view.querySelector(`.steps i:nth-child(${s.index + 1})`).className = ok ? "ok" : "ng";

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
    showFeedback(q, choice, ok);
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
        <div class="row"><span class="word">${esc(w.word)}</span><span class="muted">${esc(w.katakana)}</span>
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
    const complete = s.results.length === s.questions.length;
    const welcomeBack = updateStreak();
    state.sessions++;
    if (complete && s.kind === "lesson") state.done[s.lesson.key] = true;
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
          ${s.kind === "lesson" ? `<button class="btn secondary" id="again">もう一度</button>` : ""}
          <span class="spacer"></span>
          <button class="btn" id="home">ホームへ</button>
        </div>
      </div>`;
    $view.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
    $view.querySelector("#again")?.addEventListener("click", () => startSession({ kind: "lesson", lesson: s.lesson }));
    $view.querySelector("#home").addEventListener("click", () => go("home"));
    session = null;
    window.scrollTo(0, 0);
  }

  // ---------- 単語帳 ----------
  const dexFilter = { q: "", course: "all", trap: false };
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
      </div>
      <label class="toggle"><input type="checkbox" id="trap" ${dexFilter.trap ? "checked" : ""}><span></span> ⚠️ カタカナの罠だけ表示</label>
      <div class="dex-grid" id="grid"></div>`;
    const drawGrid = () => {
      const q = dexFilter.q.trim().toLowerCase();
      const list = WORDS.filter((w) =>
        (dexFilter.course === "all" || courseOf(w) === dexFilter.course) &&
        (!dexFilter.trap || w.gap) &&
        (!q || [w.word, w.katakana, w.meaning, ...w.synonyms.map((s) => s.word)].some((t) => t.toLowerCase().includes(q))));
      const grid = $view.querySelector("#grid");
      grid.innerHTML = list.length ? list.map((w) => html`
        <button class="dex-item ${level(w.id) ? "" : "new"}" data-detail="${w.id}" style="--area:var(--area-${courseOf(w)})">
          <span class="w">${esc(w.word)} ${w.gap ? "⚠️" : ""}</span>
          <span class="small muted">${esc(w.katakana)}</span>
          <span class="grade-chip">${esc(COURSES[courseOf(w)].name)}</span>
          ${meter(level(w.id))}
        </button>`).join("") : `<p class="muted">見つかりませんでした</p>`;
      grid.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
    };
    $view.querySelector("#q").addEventListener("input", (e) => { dexFilter.q = e.target.value; drawGrid(); });
    $view.querySelector("#course").addEventListener("change", (e) => { dexFilter.course = e.target.value; drawGrid(); });
    $view.querySelector("#trap").addEventListener("change", (e) => { dexFilter.trap = e.target.checked; drawGrid(); });
    drawGrid();
  }

  function openDetail(id) {
    const w = byId[id];
    const lv = level(id);
    const roots = w.roots.map((r) => ROOTS.find((x) => x.id === r));
    $modalContent.innerHTML = html`
      <div class="detail" style="--area:var(--area-${courseOf(w)})">
        <div class="detail-head">
          <div class="small muted"><span class="grade-chip">${esc(courseLabel(courseOf(w)))}</span> ${esc(w.pos)}</div>
          <div class="row">
            <h2 class="display">${esc(w.word)}</h2>
            ${voiceButton(`${w.id}.word`)}
          </div>
          <div class="muted">${esc(w.katakana)} ${voiceButton(`${w.id}.katakana`, "🔈")}</div>
          <p class="meaning">${esc(w.meaning)} ${voiceButton(`${w.id}.meaning`, "🔈")}</p>
          <div class="row small">${meter(lv)}<span class="muted">${LEVELS[lv]}</span></div>
        </div>

        <section><h4>📍 シーン</h4>${esc(w.scene)}</section>
        ${w.gap ? `<section><h4>⚠️ カタカナの罠</h4><div class="tip warn">${esc(w.gap)}</div></section>` : ""}
        <section><h4>💬 例文</h4><i>${esc(w.example.en)}</i> ${voiceButton(`${w.id}.example.en`, "🔈")}<br><span class="muted">${esc(w.example.ja)}</span> ${voiceButton(`${w.id}.example.ja`, "🔈")}</section>
        <section><h4>📜 語源 ${voiceButton(`${w.id}.story`, "🔈")}</h4><b>${esc(w.etymology.origin)}</b><p style="margin:6px 0 0">${esc(w.etymology.story)}</p></section>
        ${roots.length ? `<section><h4>🧩 語根</h4>${roots.map((r) => `<span class="chip">${esc(r.form)}＝${esc(r.meaning)}</span>`).join("")}</section>` : ""}
        ${w.family.length ? `<section><h4>🌳 同じ語源の仲間</h4>${w.family.map((f) => `<span class="chip">${esc(f)}</span>`).join("")}</section>` : ""}
        ${pairsByWord[w.word] ? html`<section><h4>👯 まぎらわしい単語</h4>${pairsByWord[w.word].map((p) => `<button class="chip" data-pair="${p.id}">${p.words.map((x) => esc(x.word)).join(" / ")}</button>`).join("")}</section>` : ""}
        <section>
          <h4>🔀 類義語（ニュアンスと語源）</h4>
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
    <div class="tip">👯 ${p.words.map((x) => `<b>${esc(x.word)}</b> <span class="ipa">/${esc(x.ipa)}/</span> ${esc(x.meaning)}`).join("<br>")}<br><span class="small">${esc(p.point)}</span></div>`;
  const pairFilter = { kind: "all" };

  function pairCard(p) {
    const k = PAIR_KINDS[p.kind];
    return html`
      <section class="card pair-card" style="--area:var(--area-${p.level})">
        <div class="row small">
          <span class="grade-chip">Lv.${p.level}</span>
          <span class="muted">${k.icon} ${esc(k.name)}</span>
          <span class="spacer"></span>${meter(level(pairKey(p)))}
        </div>
        <div class="pair-words">
          ${p.words.map((x) => html`
            <div class="pair-word">
              <div class="row"><b class="en">${esc(x.word)}</b>${voiceButton(pairWordKey(x), "🔈")}</div>
              <div class="small muted ipa">/${esc(x.ipa)}/ ・ ${esc(x.pos)}</div>
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

  function pairsHomeCard() {
    const due = pairDue().length;
    return html`
      <section class="card pairs-home">
        <div class="row">
          <span class="topic-badge" style="--area:var(--area-6)">👯</span>
          <div class="spacer">
            <b>似た単語をセットで覚える</b>
            <div class="small muted">hat / hut、light / right、desert / dessert など ${PAIRS.length} セット ・ 得意 ${pairLearned()}${due ? ` ・ 🔁 復習 ${due}` : ""}</div>
          </div>
        </div>
        <button class="btn secondary block" id="go-pairs">👯 似た単語を見る</button>
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
    const lessons = allLessons();
    const doneLessons = lessons.filter((ls) => state.done[ls.key]).length;
    $view.innerHTML = html`
      <h2 class="section-title">記録</h2>
      <section class="card result-grid">
        <div>${ring(learnedCount() / WORDS.length, `${learnedCount()}<small>/${WORDS.length}</small>`)}<span>定着した語</span></div>
        <div>${ring(acc, `${Math.round(acc * 100)}<small>%</small>`)}<span>正答率</span></div>
        <div><b>${state.streak}</b><span>🔥 連続日数</span></div>
        <div><b>${doneLessons}<small>/${lessons.length}</small></b><span>完了レッスン</span></div>
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
      <section class="card">
        <h3>🎨 テーマ</h3>
        <p class="small muted" style="margin:0">見た目だけが変わります。学習の記録はそのままです。</p>
        ${themeOptions()}
      </section>
      <section class="card">
        <h3>🔊 音声</h3>
        <label class="toggle"><input type="checkbox" id="auto-voice" ${state.settings.autoVoice ? "checked" : ""}><span></span> 問題と答えを自動で読み上げる</label>
        <p class="small muted" style="margin:8px 0 0">声：${VOICE ? esc(VOICE.label) : "ブラウザ標準の読み上げ（音声ファイル未生成）"}</p>
        ${VOICE?.credit ? `<p class="small muted" style="margin:4px 0 0">${esc(VOICE.credit)}</p>` : ""}
      </section>
      <button class="btn danger block" id="reset">学習記録をリセット</button>`;
    bindThemeOptions($view);
    $view.querySelector("#auto-voice").addEventListener("change", (e) => { state.settings.autoVoice = e.target.checked; save(); });
    $view.querySelector("#reset").addEventListener("click", () => {
      if (!confirm("学習記録をすべて消しますか？ この操作は取り消せません。")) return;
      state = defaultState();
      save();
      applyTheme();
      go("home");
    });
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
      CLIPS[`${w.id}.word`] = { text: w.word, lang: "en" };
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
      u.lang = clip.lang === "ja" ? "ja-JP" : "en-US";
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
    document.getElementById("theme-btn").addEventListener("click", openThemes);
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
