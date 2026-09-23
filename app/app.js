/* Vocab Quest — カタカナ語から英単語を学ぶ RPG（依存なし） */
(() => {
  "use strict";

  // ---------- ゲーム世界の定義 ----------
  const REGIONS = {
    fantasy: {
      name: "剣と魔法の王国", icon: "🏰", genre: "RPG・ファンタジー",
      stages: [
        { name: "はじまりの草原", enemy: "🐛", enemyName: "グリーンワーム" },
        { name: "まよいの森", enemy: "🐺", enemyName: "シャドウウルフ" },
        { name: "古代遺跡", enemy: "🗿", enemyName: "ストーンゴーレム" },
      ],
      boss: { name: "竜の城", enemy: "🐉", enemyName: "エンシェントドラゴン" },
    },
    battle: {
      name: "闘技場の都", icon: "⚔️", genre: "バトル・アクション",
      stages: [
        { name: "予選リング", enemy: "🤺", enemyName: "見習いフェンサー" },
        { name: "砂の闘技場", enemy: "🦂", enemyName: "サソリ闘士" },
        { name: "決勝の門", enemy: "🦍", enemyName: "バーサークコング" },
      ],
      boss: { name: "王者の玉座", enemy: "🤖", enemyName: "チャンピオン・ゴーレム" },
    },
    scifi: {
      name: "星の方舟", icon: "🚀", genre: "SF・ロボット",
      stages: [
        { name: "発着ゲート", enemy: "👽", enemyName: "グレイ" },
        { name: "無重力区画", enemy: "🛸", enemyName: "UFOドローン" },
        { name: "動力炉", enemy: "🦾", enemyName: "ガードロイド" },
      ],
      boss: { name: "司令塔", enemy: "👾", enemyName: "マザーインベーダー" },
    },
    story: {
      name: "カタカナ町", icon: "🏫", genre: "学園・スポーツ・ドラマ",
      stages: [
        { name: "通学路", enemy: "👻", enemyName: "カタカナおばけ" },
        { name: "体育館", enemy: "😈", enemyName: "イタズラ小悪魔" },
        { name: "放課後の屋上", enemy: "🦇", enemyName: "ヨフカシバット" },
      ],
      boss: { name: "ワセイの館", enemy: "🎭", enemyName: "ニセモノ王ワセイ" },
    },
  };
  const JOBS = {
    warrior: { name: "戦士", icon: "🛡️", desc: "HPが高い。ミスに強い", hp: 10, mp: 0, exp: 1, gold: 1 },
    mage: { name: "魔法使い", icon: "🧙", desc: "MPが高い。ヒント呪文を多く使える", hp: 0, mp: 6, exp: 1, gold: 1 },
    thief: { name: "盗賊", icon: "🗡️", desc: "手に入るゴールドが1.5倍", hp: 0, mp: 0, exp: 1, gold: 1.5 },
    scholar: { name: "学者", icon: "📚", desc: "手に入る経験値が1.2倍", hp: 0, mp: 0, exp: 1.2, gold: 1 },
  };
  // 呪文＝学習のヒント。呪文名そのものも英単語
  const SPELLS = [
    { id: "reveal", name: "リビール", en: "reveal（明かす）", mp: 4, lv: 1, desc: "まちがいの選択肢を2つ消す／スペル問題は1文字うめる" },
    { id: "scan", name: "スキャン", en: "scan（調べる）", mp: 2, lv: 3, desc: "問題のヒントを表示する" },
  ];
  const ITEMS = {
    potion: { name: "ポーション", icon: "🧪", price: 10, desc: "HPを15回復する", hp: 15 },
    ether: { name: "エーテル", icon: "🔷", price: 15, desc: "MPを6回復する", mp: 6 },
  };
  const QTYPES = {
    kata: "カタカナ → 英語",
    meaning: "英語 → 意味",
    spell: "スペル錬成",
    etym: "語源パズル",
    syn: "類義語ハンター",
    trap: "⚠️ カタカナの罠",
  };
  const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const STAR_INTERVAL_DAYS = [0, 0, 1, 3, 7, 21]; // ★ごとの次回出題までの日数
  const STAGE_SIZE = 6;
  const QUESTIONS_PER_BATTLE = 8;
  const CRIT_MS = 5000;
  const ENEMY_ATTACK = 10;
  const BOSS_ATTACK = 13;
  const DAY = 24 * 60 * 60 * 1000;
  const STORE_KEY = "vocab-quest-save-v2";

  let WORDS = [];
  let ROOTS = [];
  let byId = {};
  let state = null;
  let battle = null;
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
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  const todayKey = (t = Date.now()) => new Date(t).toLocaleDateString("sv-SE");
  const plainKatakana = (w) => w.katakana.replace(/（.*）/, "");
  // 出題文から答えの単語（と派生形）を伏せる: equipment → equip も伏せる
  const mask = (text, w) => text.replace(new RegExp(`\\b${w.word.slice(0, 4)}[a-z]*`, "gi"), "＿＿＿");
  const html = (strings, ...vals) => strings.reduce((out, s, i) => out + s + (i < vals.length ? vals[i] : ""), "");
  const gauge = (cur, max, cls = "") => `<div class="gauge ${cls}"><div style="width:${Math.max(0, Math.min(1, cur / max)) * 100}%"></div></div>`;

  // ---------- セーブデータ ----------
  function defaultState() {
    return {
      hero: { name: "ゆうしゃ", job: "warrior" },
      level: 1, exp: 0, totalExp: 0, gold: 50, items: { potion: 3, ether: 0 },
      cleared: {}, cards: {}, streak: 0, lastDay: null,
      battles: 0, answered: 0, correct: 0, bestCombo: 0, onboarded: false,
      settings: { autoVoice: true },
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
    } catch {
      return defaultState();
    }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* プライベートモード等では保存しない */ }
  }
  const card = (id) => state.cards[id] || { star: 0, due: 0, seen: 0, correct: 0 };
  const isDue = (id) => { const c = state.cards[id]; return c && c.star > 0 && c.due <= Date.now(); };
  const dueWords = () => WORDS.filter((w) => isDue(w.id));

  // ---------- 主人公のステータス ----------
  const job = () => JOBS[state.hero.job];
  const maxHp = () => 30 + 4 * (state.level - 1) + job().hp;
  const maxMp = () => 8 + 2 * (state.level - 1) + job().mp;
  const expToNext = () => state.level * 100;

  // ---------- ステージ ----------
  // 各地方の単語を CEFR の易しい順に並べ、ほぼ均等に分けてステージにする
  function stagesOf(region) {
    const words = WORDS.filter((w) => w.area === region)
      .sort((a, b) => CEFR_ORDER.indexOf(a.cefr) - CEFR_ORDER.indexOf(b.cefr));
    const count = Math.ceil(words.length / STAGE_SIZE);
    const size = Math.ceil(words.length / count);
    return REGIONS[region].stages.slice(0, count).map((s, i) => ({
      ...s, region, index: i, key: `${region}-${i}`, words: words.slice(i * size, (i + 1) * size),
    }));
  }
  const bossKey = (region) => `${region}-boss`;
  const stageOpen = (st) => st.index === 0 || !!state.cleared[`${st.region}-${st.index - 1}`];
  const bossOpen = (region) => stagesOf(region).every((st) => state.cleared[st.key]);
  function nextStage() {
    for (const r of Object.keys(REGIONS)) {
      const st = stagesOf(r).find((s) => !state.cleared[s.key] && stageOpen(s));
      if (st) return st;
    }
    return null;
  }

  // ---------- HUD ----------
  function renderHud() {
    document.getElementById("hud-level").textContent = `Lv ${state.level}`;
    document.getElementById("hud-xp").style.width = `${(state.exp / expToNext()) * 100}%`;
    document.getElementById("hud-gold").textContent = `💰${state.gold}G`;
    document.getElementById("hud-streak").textContent = `🔥${state.streak}`;
  }

  // ---------- 画面切り替え ----------
  function go(tab) {
    stopVoice();
    document.body.classList.remove("in-battle");
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    ({ map: renderMap, dex: renderDex, roots: renderRoots, status: renderStatus })[tab]();
    renderHud();
    window.scrollTo(0, 0);
  }

  // ---------- オンボーディング（名前とジョブ） ----------
  function renderOnboarding() {
    document.body.classList.add("in-battle");
    let chosen = state.hero.job;
    const draw = () => {
      $view.innerHTML = html`
        <div class="title-screen">
          <div class="logo">⚔️🗝️</div>
          <h1 class="game-title">VOCAB QUEST</h1>
          <p class="subtitle">〜 カタカナ語と ことばの大陸 〜</p>
        </div>
        <div class="window">
          <p class="npc">🧙 <b>賢者ロゴス</b>「よくぞ来た、旅の者よ。この大陸では、おぬしの知っている<b>カタカナ語</b>が英語の力に変わる。まずは名を聞かせてくれんか？」</p>
          <label class="field">なまえ<input id="name" maxlength="8" value="${esc(state.hero.name)}" autocomplete="off"></label>
          <p class="npc" style="margin-top:14px">「そして、おぬしの<b>ジョブ</b>は？」</p>
          <div class="job-grid">
            ${Object.entries(JOBS).map(([k, j]) => html`
              <button class="job ${chosen === k ? "selected" : ""}" data-job="${k}" aria-pressed="${chosen === k}">
                <span class="i">${j.icon}</span><b>${esc(j.name)}</b><span class="small">${esc(j.desc)}</span>
              </button>`).join("")}
          </div>
          <button class="btn block" id="start">▶ ぼうけんに でる</button>
        </div>`;
      $view.querySelectorAll("[data-job]").forEach((b) => b.addEventListener("click", () => {
        state.hero.name = $view.querySelector("#name").value.trim() || "ゆうしゃ";
        chosen = b.dataset.job;
        draw();
      }));
      $view.querySelector("#start").addEventListener("click", () => {
        state.hero = { name: $view.querySelector("#name").value.trim() || "ゆうしゃ", job: chosen };
        save();
        startBattle({ kind: "tutorial" });
      });
    };
    draw();
  }

  // ---------- ワールドマップ ----------
  function sageLine() {
    const due = dueWords();
    if (due.length) return `はぐれモンスターが ${due.length}体 うろついておる。覚えかけのことばは、忘れかけた頃にもう一度戦うと心に深く刻まれるのじゃ。`;
    const st = nextStage();
    if (st) {
      const hints = st.words.slice(0, 3).map((w) => `「${plainKatakana(w)}」`).join("");
      return `次は <b>${esc(REGIONS[st.region].name)}</b> の <b>${esc(st.name)}</b> じゃな。${esc(hints)}の気配がするぞ…`;
    }
    const w = pick(WORDS);
    return `知っておるか？ ${esc(w.word)}（${esc(plainKatakana(w))}）について――${esc(w.etymology.story.split("。")[0])}。`;
  }

  function renderMap() {
    const due = dueWords();
    $view.innerHTML = html`
      <div class="window npc-window">
        <div class="npc">🧙 <b>賢者ロゴス</b>「${sageLine()}」</div>
      </div>
      ${due.length ? html`
        <div class="window review-banner">
          <div class="emoji">👹</div>
          <div class="spacer">
            <b>はぐれモンスター ×${due.length}</b>
            <div class="small muted">復習で ことばカードを進化させよう</div>
          </div>
          <button class="btn" id="review">たたかう</button>
        </div>` : ""}
      <div class="row" style="margin-bottom:14px">
        <button class="btn secondary" id="shop">🛒 どうぐや</button>
        <span class="small muted">🧪×${state.items.potion} 🔷×${state.items.ether}</span>
      </div>
      ${Object.entries(REGIONS).map(([k, r]) => {
        const stages = stagesOf(k);
        const clearedCount = stages.filter((s) => state.cleared[s.key]).length;
        const bossDone = !!state.cleared[bossKey(k)];
        const bOpen = bossOpen(k);
        return html`
          <div class="window region" style="--area-color: var(--area-${k})">
            <div class="region-head">
              <span class="icon">${r.icon}</span>
              <div class="spacer"><h3>${esc(r.name)}</h3><div class="small muted">${esc(r.genre)}</div></div>
              <span class="small">${bossDone ? "👑 制覇" : `${clearedCount}/${stages.length}`}</span>
            </div>
            <ol class="path">
              ${stages.map((s) => {
                const cleared = !!state.cleared[s.key];
                const open = stageOpen(s);
                return html`
                  <li><button class="node ${cleared ? "cleared" : open ? "open" : "locked"}" data-stage="${s.key}" ${open ? "" : "disabled"}>
                    <span class="mark">${cleared ? "✅" : open ? "▶" : "🔒"}</span>
                    <span class="spacer">${s.index + 1}. ${esc(s.name)}</span>
                    <span class="enemy-mini">${open ? s.enemy : "？"}</span>
                  </button></li>`;
              }).join("")}
              <li><button class="node boss ${bossDone ? "cleared" : bOpen ? "open" : "locked"}" data-boss="${k}" ${bOpen ? "" : "disabled"}>
                <span class="mark">${bossDone ? "👑" : bOpen ? "⚠️" : "🔒"}</span>
                <span class="spacer">BOSS. ${esc(r.boss.name)}</span>
                <span class="enemy-mini">${bOpen ? r.boss.enemy : "？"}</span>
              </button></li>
            </ol>
          </div>`;
      }).join("")}`;
    $view.querySelector("#review")?.addEventListener("click", () => startBattle({ kind: "review" }));
    $view.querySelector("#shop").addEventListener("click", openShop);
    $view.querySelectorAll("[data-stage]").forEach((b) => b.addEventListener("click", () => {
      const [region, i] = b.dataset.stage.split("-");
      openStage(stagesOf(region)[+i]);
    }));
    $view.querySelectorAll("[data-boss]").forEach((b) => b.addEventListener("click", () => openBoss(b.dataset.boss)));
  }

  function openStage(st) {
    const learned = st.words.filter((w) => card(w.id).star >= 3).length;
    $modalContent.innerHTML = html`
      <div class="stage-intro">
        <div class="small muted">${esc(REGIONS[st.region].name)} ・ ステージ ${st.index + 1}</div>
        <h2>${esc(st.name)}</h2>
        <div class="big-enemy">${st.enemy}</div>
        <p><b>${esc(st.enemyName)}</b> が 待ちかまえている。</p>
        <div class="window inner">
          <div class="small muted">このステージで出会うことば（${learned}/${st.words.length} 定着）</div>
          ${st.words.map((w) => `<span class="chip">${card(w.id).star ? esc(w.word) : esc(plainKatakana(w))}</span>`).join("")}
        </div>
        <button class="btn block" id="go">⚔️ いどむ</button>
      </div>`;
    $modalContent.querySelector("#go").addEventListener("click", () => { closeModal(); startBattle({ kind: "stage", stage: st }); });
    openModal();
  }

  function openBoss(region) {
    const r = REGIONS[region];
    $modalContent.innerHTML = html`
      <div class="stage-intro">
        <div class="small muted">${esc(r.name)} ・ BOSS</div>
        <h2>${esc(r.boss.name)}</h2>
        <div class="big-enemy">${r.boss.enemy}</div>
        <p><b>${esc(r.boss.enemyName)}</b> が 待っている。</p>
        <p class="small muted">ボスは <b>語源パズル・類義語・カタカナの罠</b> だけで攻めてくる。攻撃力も高いぞ。</p>
        <button class="btn block" id="go">⚔️ いどむ</button>
      </div>`;
    $modalContent.querySelector("#go").addEventListener("click", () => { closeModal(); startBattle({ kind: "boss", region }); });
    openModal();
  }

  // ---------- どうぐや ----------
  function openShop() {
    const draw = () => {
      $modalContent.innerHTML = html`
        <h2>🛒 どうぐや</h2>
        <p class="npc">🧑‍🦰「いらっしゃい！ ちなみに <b>potion</b> と <b>poison（毒）</b> は語源が同じなんだぜ。うちのは毒じゃないけどな！」</p>
        <p>所持金：<b>${state.gold}G</b></p>
        ${Object.entries(ITEMS).map(([k, it]) => html`
          <div class="window inner row">
            <span style="font-size:1.6rem">${it.icon}</span>
            <div class="spacer"><b>${esc(it.name)}</b> <span class="small muted">×${state.items[k]}</span><div class="small muted">${esc(it.desc)}</div></div>
            <button class="btn" data-buy="${k}" ${state.gold >= it.price ? "" : "disabled"}>${it.price}G</button>
          </div>`).join("")}`;
      $modalContent.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => {
        const it = ITEMS[b.dataset.buy];
        if (state.gold < it.price) return;
        state.gold -= it.price;
        state.items[b.dataset.buy]++;
        save();
        renderHud();
        draw();
      }));
    };
    draw();
    openModal(() => go("map"));
  }

  // ---------- 出題 ----------
  function selectWords({ kind, stage, region }) {
    if (kind === "tutorial") {
      return shuffle(WORDS.filter((w) => w.area === "fantasy" && w.cefr === "A2")).slice(0, 3);
    }
    if (kind === "review") return shuffle(dueWords()).slice(0, QUESTIONS_PER_BATTLE);
    if (kind === "boss") return shuffle(WORDS.filter((w) => w.area === region)).slice(0, QUESTIONS_PER_BATTLE);
    // ステージ：ステージの単語＋同じ地方の復習期限の単語で埋める
    const extra = shuffle(WORDS.filter((w) => w.area === stage.region && isDue(w.id) && !stage.words.includes(w)));
    return shuffle([...stage.words, ...extra].slice(0, QUESTIONS_PER_BATTLE));
  }

  function allowedTypes(w, kind) {
    if (kind === "tutorial") return ["kata"];
    const hard = ["etym", "syn", ...(w.trapQuiz ? ["trap"] : [])];
    if (kind === "boss") return hard;
    const s = card(w.id).star;
    if (s <= 1) return ["kata", "meaning"];
    if (s === 2) return ["kata", "meaning", "spell", "etym"];
    return ["spell", ...hard];
  }

  function distractors(w, n, filter = () => true) {
    const same = WORDS.filter((x) => x.id !== w.id && x.area === w.area && filter(x));
    const other = WORDS.filter((x) => x.id !== w.id && x.area !== w.area && filter(x));
    return [...shuffle(same), ...shuffle(other)].slice(0, n);
  }

  function makeQuestion(w, type) {
    const q = { word: w, type, choices: null, cast: {} };
    const wordChoices = (label, filter) => shuffle([w, ...distractors(w, 3, filter)]).map((x) => ({ label: label(x), correct: x.id === w.id, ref: x }));
    switch (type) {
      case "kata":
        q.prompt = html`<span class="big">${esc(w.katakana)}</span><span class="small muted">🎮 ${esc(mask(w.scene, w))}</span><br>英語で正しいつづりは？`;
        q.hint = `意味は「${w.meaning}」`;
        q.choices = wordChoices((x) => x.word);
        break;
      case "meaning":
        q.prompt = html`<span class="big">${esc(w.word)}</span>英語での意味は？`;
        q.hint = `カタカナでは「${w.katakana}」。${w.scene}`;
        q.choices = wordChoices((x) => x.meaning);
        break;
      case "spell":
        q.prompt = html`<span class="big">${esc(w.katakana)}</span>${esc(w.meaning)}<br><span class="small muted">文字をタップしてつづりを完成させよう</span>`;
        q.hint = `語源：${mask(w.etymology.origin, w)}`;
        q.letters = shuffle(w.word.split(""));
        q.typed = [];
        break;
      case "etym":
        q.prompt = html`📜 <b>${esc(mask(w.etymology.origin, w))}</b><br>この語源から生まれた英単語は？`;
        q.hint = `カタカナでは「${w.katakana}」`;
        q.choices = wordChoices((x) => `${x.word}（${plainKatakana(x)}）`);
        break;
      case "syn": {
        const s = pick(w.synonyms);
        q.prompt = html`<span class="big">${esc(s.word)}</span>（${esc(s.meaning)}）<br>この語の<b>類義語</b>はどれ？`;
        q.hint = `${s.word} のニュアンス：${s.nuance}`;
        q.choices = wordChoices((x) => `${x.word}（${plainKatakana(x)}）`, (x) => !x.synonyms.some((y) => y.word === s.word));
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
    }
    return q;
  }

  // ---------- バトル ----------
  function startBattle({ kind, stage, region }) {
    const words = selectWords({ kind, stage, region });
    if (!words.length) { go("map"); return; }
    region = region || stage?.region;
    const foe =
      kind === "stage" ? stage :
      kind === "boss" ? REGIONS[region].boss :
      kind === "review" ? { name: "はぐれモンスター", enemy: "👹", enemyName: "はぐれモンスター" } :
      { name: "チュートリアル", enemy: "🐛", enemyName: "ちびワーム" };
    const n = words.length;
    battle = {
      kind, stage, region,
      title: kind === "boss" ? `BOSS ${foe.name}` : foe.name,
      enemy: foe.enemy, enemyName: foe.enemyName,
      questions: words.map((w) => makeQuestion(w, pick(allowedTypes(w, kind)))),
      index: 0,
      // 敵HP：全問に答えてはじめて倒せる。途中で削りきっても最後の1問まで「ふみとどまる」
      maxHp: Math.round(n * 10 * (kind === "boss" ? 1.4 : kind === "tutorial" ? 0.5 : 1.2)),
      dealt: 0,
      heroHp: maxHp(), heroMp: maxMp(),
      attack: kind === "boss" ? BOSS_ATTACK : ENEMY_ATTACK,
      combo: 0, maxCombo: 0, exp: 0, gold: 0, correct: 0, answered: [],
      log: [`${foe.enemyName} が あらわれた！`],
      startStars: Object.fromEntries(words.map((w) => [w.id, card(w.id).star])),
    };
    document.body.classList.add("in-battle");
    renderQuestion();
  }

  const enemyHpLeft = () => battle.maxHp - battle.dealt;
  const lastQuestion = () => battle.index >= battle.questions.length - 1;
  // 最後の問題までは HP を 0 にしない（1 ミリ残って「ふみとどまる」）
  const enemyHpRatio = () => {
    const left = enemyHpLeft();
    if (left > 0) return left / battle.maxHp;
    return lastQuestion() && battle.answered.length === battle.questions.length ? 0 : 0.03;
  };

  function say(...lines) {
    battle.log.push(...lines);
    const box = $view.querySelector("#msg");
    if (box) box.innerHTML = battle.log.slice(-3).map((l) => `<div>${esc(l)}</div>`).join("");
  }

  function drawStatus() {
    const b = battle;
    $view.querySelector("#hero-status").innerHTML = html`
      <div class="row small"><b>${esc(state.hero.name)}</b><span class="muted">${job().icon} ${esc(job().name)} Lv${state.level}</span></div>
      <div class="stat"><span>HP</span>${gauge(b.heroHp, maxHp(), b.heroHp <= maxHp() / 3 ? "danger" : "hp")}<span class="num">${Math.max(0, b.heroHp)}/${maxHp()}</span></div>
      <div class="stat"><span>MP</span>${gauge(b.heroMp, maxMp(), "mp")}<span class="num">${b.heroMp}/${maxMp()}</span></div>`;
    $view.querySelector("#enemy-hp div").style.width = `${enemyHpRatio() * 100}%`;
  }

  function renderQuestion() {
    const b = battle;
    const q = b.questions[b.index];
    q.shownAt = Date.now();
    // 出題文の読み上げ（答えがばれない物だけ）：カタカナ語、または意味を問う英単語
    const promptVoice = q.type === "kata" || q.type === "spell" ? `${q.word.id}.katakana` : q.type === "meaning" ? `${q.word.id}.word` : null;
    $view.innerHTML = html`
      <div class="battle-top">
        <span class="title small muted">${esc(b.title)}</span>
        <span class="small muted">${b.index + 1}/${b.questions.length}</span>
      </div>
      <div class="enemy">
        <div class="sprite ${enemyHpLeft() <= 0 ? "dizzy" : ""}" id="sprite">${b.enemy}</div>
        <div class="dmg" id="dmg"></div>
        <div class="small">${esc(b.enemyName)}</div>
        <div class="gauge enemy-hp" id="enemy-hp"><div></div></div>
      </div>
      <div class="window message" id="msg"></div>
      <div class="window question">
        <div class="qtype row"><span class="spacer">${QTYPES[q.type]}</span>${promptVoice ? voiceButton(promptVoice) : ""}</div>
        <div class="prompt">${q.prompt}</div>
        <div id="hint"></div>
        ${q.type === "spell" ? html`
          <div class="spell-slots" id="slots">${q.word.word.split("").map(() => "<span></span>").join("")}</div>
          <div class="tiles">${q.letters.map((l, i) => `<button class="tile" data-i="${i}">${esc(l)}</button>`).join("")}</div>
          <div class="row" style="justify-content:center;margin-top:10px">
            <button class="btn secondary" id="undo">↩ 1文字もどす</button>
          </div>` : html`
          <div class="choices">${q.choices.map((c, i) => `<button class="choice" data-i="${i}">${esc(c.label)}</button>`).join("")}</div>`}
      </div>
      <div class="window commands" id="commands"></div>
      <div class="window hero-status" id="hero-status"></div>`;
    say();
    drawStatus();
    drawCommands("main");
    if (q.type === "spell") bindSpell(q);
    else $view.querySelectorAll(".choice").forEach((el) => el.addEventListener("click", () => answer(q, q.choices[+el.dataset.i], el)));
    if (promptVoice && state.settings.autoVoice) playVoice([promptVoice]);
  }

  function drawCommands(menu) {
    const b = battle;
    const q = b.questions[b.index];
    const box = $view.querySelector("#commands");
    if (menu === "main") {
      box.innerHTML = html`
        <button class="cmd" data-cmd="spells">🪄 じゅもん</button>
        <button class="cmd" data-cmd="items">🎒 どうぐ</button>
        <button class="cmd" data-cmd="flee">🏃 にげる</button>`;
    } else if (menu === "spells") {
      box.innerHTML = html`
        ${SPELLS.map((s) => {
          const known = state.level >= s.lv;
          const ok = known && b.heroMp >= s.mp && !q.cast[s.id];
          return html`<button class="cmd wide" data-spell="${s.id}" ${ok ? "" : "disabled"}>
            <span>${known ? esc(s.name) : "？？？"} <span class="small">${known ? `MP${s.mp}` : `Lv${s.lv}`}</span></span>
            <span class="small muted desc">${known ? esc(s.desc) : "まだ おぼえていない"}</span></button>`;
        }).join("")}
        <button class="cmd back" data-cmd="main">◀ もどる</button>`;
    } else if (menu === "items") {
      box.innerHTML = html`
        ${Object.entries(ITEMS).map(([k, it]) => html`<button class="cmd wide" data-item="${k}" ${state.items[k] > 0 ? "" : "disabled"}>
          <span>${it.icon} ${esc(it.name)} ×${state.items[k]}</span><span class="small muted desc">${esc(it.desc)}</span></button>`).join("")}
        <button class="cmd back" data-cmd="main">◀ もどる</button>`;
    }
    box.querySelectorAll("[data-cmd]").forEach((el) => el.addEventListener("click", () => {
      if (el.dataset.cmd !== "flee") drawCommands(el.dataset.cmd);
      else if (confirm("にげますか？ ここまでの経験値は手に入ります。")) finishBattle("flee");
    }));
    box.querySelectorAll("[data-spell]").forEach((el) => el.addEventListener("click", () => castSpell(el.dataset.spell)));
    box.querySelectorAll("[data-item]").forEach((el) => el.addEventListener("click", () => useItem(el.dataset.item)));
  }

  function castSpell(id) {
    const b = battle;
    const q = b.questions[b.index];
    const s = SPELLS.find((x) => x.id === id);
    if (b.heroMp < s.mp || q.cast[id]) return;
    b.heroMp -= s.mp;
    q.cast[id] = true;
    say(`${state.hero.name} は ${s.name} を となえた！`);
    if (id === "reveal") {
      if (q.type === "spell") {
        // 入力途中が間違っていたらリセットしてから、正しい次の1文字を置く
        const target = q.word.word;
        if (!target.startsWith(q.typed.map((i) => q.letters[i]).join(""))) q.typed.length = 0;
        const next = target[q.typed.length];
        q.typed.push(q.letters.findIndex((l, idx) => l === next && !q.typed.includes(idx)));
        say(`「${next}」の文字が 光りだした！`);
        q.redraw();
      } else {
        const wrong = shuffle([...$view.querySelectorAll(".choice")].filter((el, i) => !q.choices[i].correct && !el.disabled)).slice(0, 2);
        wrong.forEach((el) => { el.disabled = true; el.classList.add("gone"); });
        say("まちがいの せんたくしが 2つ きえた！");
      }
    } else if (id === "scan") {
      $view.querySelector("#hint").innerHTML = `<div class="tip">🔍 ${esc(q.hint)}</div>`;
      say(`${b.enemyName} の よわみを しらべた！`);
    }
    if (!battle || battle.index !== b.index || q.answeredAt) return; // リビールで回答が完成した場合
    drawStatus();
    drawCommands("main");
  }

  function useItem(k) {
    const b = battle;
    const it = ITEMS[k];
    if (state.items[k] <= 0) return;
    state.items[k]--;
    if (it.hp) { b.heroHp = Math.min(maxHp(), b.heroHp + it.hp); say(`${state.hero.name} は ${it.name} をのんだ！ HPが ${it.hp} かいふくした！`); }
    if (it.mp) { b.heroMp = Math.min(maxMp(), b.heroMp + it.mp); say(`${state.hero.name} は ${it.name} をのんだ！ MPが ${it.mp} かいふくした！`); }
    save();
    drawStatus();
    drawCommands("main");
  }

  function bindSpell(q) {
    const slots = [...$view.querySelectorAll("#slots span")];
    const tiles = [...$view.querySelectorAll(".tile")];
    q.redraw = () => {
      slots.forEach((s, i) => { s.textContent = q.typed[i] != null ? q.letters[q.typed[i]] : ""; });
      tiles.forEach((t, i) => { t.disabled = q.typed.includes(i); });
      if (q.typed.length === q.letters.length) {
        const spelled = q.typed.map((i) => q.letters[i]).join("");
        tiles.forEach((x) => { x.disabled = true; });
        answer(q, { label: spelled, correct: spelled === q.word.word });
      }
    };
    tiles.forEach((t) => t.addEventListener("click", () => { q.typed.push(+t.dataset.i); q.redraw(); }));
    $view.querySelector("#undo").addEventListener("click", () => { q.typed.pop(); q.redraw(); });
  }

  function answer(q, choice, button) {
    const b = battle;
    const w = q.word;
    const ok = choice.correct;
    q.answeredAt = Date.now();
    const crit = ok && q.answeredAt - q.shownAt <= CRIT_MS;
    b.answered.push(w);
    $view.querySelectorAll(".choice").forEach((el, i) => {
      el.disabled = true;
      if (q.choices[i].correct) el.classList.add("correct");
    });
    if (button && !ok) button.classList.add("wrong");
    $view.querySelector("#commands").hidden = true;
    const undo = $view.querySelector("#undo");
    if (undo) undo.disabled = true;

    // ことばカード（間隔反復）
    const c = { ...card(w.id) };
    c.seen = (c.seen || 0) + 1;
    if (ok) {
      c.correct = (c.correct || 0) + 1;
      c.star = Math.min(5, (c.star || 0) + 1);
    } else {
      c.star = Math.max(1, (c.star || 0) - 1);
    }
    c.due = Date.now() + STAR_INTERVAL_DAYS[c.star] * DAY;
    state.cards[w.id] = c;
    state.answered++;
    if (ok) state.correct++;

    const sprite = $view.querySelector("#sprite");
    if (ok) {
      b.correct++;
      b.combo++;
      b.maxCombo = Math.max(b.maxCombo, b.combo);
      const mult = Math.min(3, 1 + 0.5 * (b.combo - 1));
      const dmg = Math.round(10 * mult * (crit ? 2 : 1));
      b.dealt += dmg;
      b.exp += 10 + (crit ? 5 : 0) + (b.kind === "boss" ? 5 : 0);
      b.gold += 5;
      say(
        `${state.hero.name} の こうげき！${crit ? " かいしんの いちげき！" : ""}${b.combo >= 2 ? ` ${b.combo}コンボ！` : ""}`,
        `${b.enemyName} に ${dmg} の ダメージ！`,
      );
      if (enemyHpLeft() <= 0 && !lastQuestion()) say(`${b.enemyName} は ふみとどまった！ さいごの 1もんで とどめを させ！`);
      sprite.classList.remove("hit"); void sprite.offsetWidth; sprite.classList.add("hit");
      popDamage(dmg, crit);
    } else {
      b.combo = 0;
      if (b.kind === "tutorial") {
        say(`${b.enemyName} の こうげき！ しかし ${state.hero.name} は ひらりと かわした！`);
      } else {
        b.heroHp -= b.attack;
        say(`${b.enemyName} の こうげき！`, `${state.hero.name} は ${b.attack} の ダメージを うけた！`);
        document.body.classList.remove("shake"); void document.body.offsetWidth; document.body.classList.add("shake");
        if (b.heroHp <= 0) say(`${state.hero.name} は ちからつきた…`);
      }
    }
    if (enemyHpLeft() <= 0 && lastQuestion() && b.heroHp > 0) {
      sprite.classList.add("dead");
      say(`${b.enemyName} を たおした！`);
    }
    save();
    drawStatus();
    showFeedback(q, choice, ok);
  }

  function popDamage(dmg, crit) {
    const el = $view.querySelector("#dmg");
    el.textContent = crit ? `${dmg}!!` : `${dmg}`;
    el.className = `dmg show ${crit ? "crit" : ""}`;
  }

  function showFeedback(q, choice, ok) {
    const b = battle;
    const w = q.word;
    const over = lastQuestion() || b.heroHp <= 0;
    const wrongRef = !ok && choice.ref && choice.ref.id !== w.id ? choice.ref : null;
    const firstSentence = w.etymology.story.split("。")[0] + "。";
    const box = document.createElement("div");
    box.className = `window feedback ${ok ? "ok" : "ng"}`;
    box.innerHTML = html`
      <div class="row">
        <span class="verdict">${ok ? "✅ 正解！" : "❌ おしい！"}</span>
        <span class="spacer"></span>
        <span class="stars" title="ことばカードの★">${stars(card(w.id).star)}</span>
      </div>
      <div class="row"><span class="word">${esc(w.word)}</span><span class="muted">${esc(w.katakana)}</span>
        ${voiceButton(`${w.id}.word,${w.id}.meaning`)}</div>
      <div>${esc(w.meaning)}</div>
      ${q.synonym ? `<div class="tip">🔀 <b>${esc(q.synonym.word)}</b>：${esc(q.synonym.nuance)}</div>` : ""}
      ${wrongRef ? `<div class="tip">🤔 あなたが選んだ <b>${esc(wrongRef.word)}</b> は「${esc(wrongRef.meaning)}」</div>` : ""}
      ${!ok && q.type === "spell" ? `<div class="tip">✏️ あなたのつづり：<b>${esc(choice.label)}</b></div>` : ""}
      <div class="tip">📜 ${esc(w.etymology.origin)}<br>💡 ${esc(firstSentence)}</div>
      ${w.gap ? `<div class="tip warn">⚠️ ${esc(w.gap)}</div>` : ""}
      <div class="row" style="margin-top:12px">
        <button class="btn secondary" data-detail="${w.id}">📖 ことばの書</button>
        <span class="spacer"></span>
        <button class="btn" id="next">${over ? "▶ けっかへ" : "▶ つぎへ"}</button>
      </div>`;
    $view.querySelector(".question").after(box);
    if (state.settings.autoVoice) playVoice([`${w.id}.word`, `${w.id}.meaning`]);
    box.querySelector("[data-detail]").addEventListener("click", () => openDetail(w.id));
    const next = box.querySelector("#next");
    next.addEventListener("click", () => {
      if (b.heroHp <= 0) finishBattle("lose");
      else if (over) finishBattle(enemyHpLeft() <= 0 ? "win" : "escaped");
      else { b.index++; renderQuestion(); window.scrollTo(0, 0); }
    });
    next.focus({ preventScroll: true });
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function gainExp(amount) {
    const ups = [];
    state.exp += amount;
    state.totalExp += amount;
    while (state.exp >= expToNext()) {
      state.exp -= expToNext();
      state.level++;
      ups.push(state.level);
    }
    return ups;
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

  function finishBattle(outcome) {
    const b = battle;
    const won = outcome === "win";
    const beforeHp = maxHp();
    const beforeMp = maxMp();
    const exp = Math.round((b.exp + (won ? (b.kind === "boss" ? 60 : 20) : 0)) * job().exp);
    const gold = Math.round((b.gold + (won ? (b.kind === "boss" ? 80 : 20) : 0)) * job().gold);
    const levelUps = gainExp(exp);
    state.gold += gold;
    const welcomeBack = updateStreak();
    state.battles++;
    state.bestCombo = Math.max(state.bestCombo, b.maxCombo);
    if (b.kind === "tutorial") state.onboarded = true;
    let unlocked = null;
    if (won && b.kind === "stage" && !state.cleared[b.stage.key]) {
      state.cleared[b.stage.key] = true;
      const next = stagesOf(b.region)[b.stage.index + 1];
      unlocked = next ? `「${next.name}」へ すすめるようになった！` : `「${REGIONS[b.region].boss.name}」の とびらが ひらいた！`;
    }
    if (won && b.kind === "boss" && !state.cleared[bossKey(b.region)]) {
      state.cleared[bossKey(b.region)] = true;
      unlocked = `${REGIONS[b.region].name} を せいはした！ 👑`;
    }
    save();
    renderHud();

    const newCards = b.answered.filter((w) => b.startStars[w.id] === 0);
    const starUps = b.answered.filter((w) => b.startStars[w.id] > 0 && card(w.id).star > b.startStars[w.id]);
    const newSpells = SPELLS.filter((s) => levelUps.includes(s.lv));
    const lines = {
      win: [`${b.enemyName} を たおした！`],
      escaped: [`${b.enemyName} は たおれずに にげていった…`, "もういちど いどめば きっと勝てる！"],
      lose: [`${state.hero.name} は ちからつきた…`, "……きょうかいで めをさました。けいけんちは そのままだ！"],
      flee: [`${state.hero.name} は うまく にげきった！`],
    }[outcome];
    lines.push(`${exp} ポイントの けいけんちを かくとく！`, `${gold} ゴールドを てにいれた！`);
    if (levelUps.length) {
      lines.push(`${state.hero.name} は レベル ${state.level} に あがった！`, `さいだいHP +${maxHp() - beforeHp}　さいだいMP +${maxMp() - beforeMp}`);
      newSpells.forEach((s) => lines.push(`${s.name}（${s.en}）の じゅもんを おぼえた！`));
    }
    if (welcomeBack) lines.push("おかえり！ また いっしょに ぼうけんしよう。");
    if (unlocked) lines.push(unlocked);

    document.body.classList.remove("in-battle");
    $view.innerHTML = html`
      <div class="result">
        <div class="big-emoji">${won ? (b.kind === "boss" ? "👑" : "🏆") : outcome === "lose" ? "⛪" : "💨"}</div>
        <div class="window message result-log">${lines.map((l) => `<div>${esc(l)}</div>`).join("")}</div>
        <div class="window result-grid">
          <div><b>${b.correct}/${b.answered.length}</b>正解</div>
          <div><b>${b.maxCombo}</b>最大コンボ</div>
          <div><b>+${exp}</b>EXP</div>
        </div>
        <div class="window drops">
          ${newCards.length ? `<h4>🃏 あたらしい ことばカード</h4><div>${newCards.map((w) => `<button class="chip" data-detail="${w.id}">${esc(w.word)}</button>`).join("")}</div>` : ""}
          ${starUps.length ? `<h4>⬆️ しんかした ことばカード</h4><div>${starUps.map((w) => `<button class="chip" data-detail="${w.id}">${esc(w.word)} <span class="stars">${"★".repeat(card(w.id).star)}</span></button>`).join("")}</div>` : ""}
          ${!newCards.length && !starUps.length ? `<div class="small muted">ことばカードは つぎの せんとうで しんかするかも…</div>` : ""}
        </div>
        <div class="row" style="margin-top:14px">
          ${b.kind === "stage" || b.kind === "boss" ? `<button class="btn secondary" id="again">もういちど</button>` : ""}
          <span class="spacer"></span>
          <button class="btn" id="home">▶ マップへ</button>
        </div>
      </div>`;
    $view.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
    $view.querySelector("#again")?.addEventListener("click", () => startBattle({ kind: b.kind, stage: b.stage, region: b.region }));
    $view.querySelector("#home").addEventListener("click", () => go("map"));
    battle = null;
  }

  // ---------- ことばの書（図鑑） ----------
  const dexFilter = { q: "", area: "all", trap: false };
  function renderDex() {
    const found = WORDS.filter((w) => card(w.id).star > 0).length;
    $view.innerHTML = html`
      <h2>📖 ことばの書 <span class="small muted">${found}/${WORDS.length} 発見</span></h2>
      <div class="filters">
        <input id="q" type="search" placeholder="英語・カタカナ・意味で検索" value="${esc(dexFilter.q)}" aria-label="検索">
        <select id="area" aria-label="地方">
          <option value="all">全地方</option>
          ${Object.entries(REGIONS).map(([k, a]) => `<option value="${k}" ${dexFilter.area === k ? "selected" : ""}>${a.icon} ${esc(a.name)}</option>`).join("")}
        </select>
      </div>
      <label class="small row" style="margin-bottom:12px"><input type="checkbox" id="trap" ${dexFilter.trap ? "checked" : ""}> ⚠️ カタカナの罠だけ表示</label>
      <div class="dex-grid" id="grid"></div>`;
    const drawGrid = () => {
      const q = dexFilter.q.trim().toLowerCase();
      const list = WORDS.filter((w) =>
        (dexFilter.area === "all" || w.area === dexFilter.area) &&
        (!dexFilter.trap || w.gap) &&
        (!q || [w.word, w.katakana, w.meaning, ...w.synonyms.map((s) => s.word)].some((t) => t.toLowerCase().includes(q))));
      const grid = $view.querySelector("#grid");
      grid.innerHTML = list.length ? list.map((w) => {
        const s = card(w.id).star;
        return html`
          <button class="dex-item ${s ? "" : "locked"}" data-detail="${w.id}" style="--area-color: var(--area-${w.area})">
            <div class="w">${esc(w.word)} ${w.gap ? "⚠️" : ""}</div>
            <div class="small muted">${esc(w.katakana)}</div>
            <div class="stars small">${s ? stars(s) : "未発見"}</div>
          </button>`;
      }).join("") : `<p class="muted">見つかりませんでした</p>`;
      grid.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
    };
    $view.querySelector("#q").addEventListener("input", (e) => { dexFilter.q = e.target.value; drawGrid(); });
    $view.querySelector("#area").addEventListener("change", (e) => { dexFilter.area = e.target.value; drawGrid(); });
    $view.querySelector("#trap").addEventListener("change", (e) => { dexFilter.trap = e.target.checked; drawGrid(); });
    drawGrid();
  }

  function openDetail(id) {
    const w = byId[id];
    const s = card(id).star;
    const roots = w.roots.map((r) => ROOTS.find((x) => x.id === r));
    $modalContent.innerHTML = html`
      <div class="detail">
        <div class="small muted">${REGIONS[w.area].icon} ${esc(REGIONS[w.area].name)} ・ ${esc(w.pos)} ・ CEFR ${esc(w.cefr)}</div>
        <div class="row">
          <h2>${esc(w.word)}</h2>
          ${voiceButton(`${w.id}.word`)}
          <span class="spacer"></span>
          <span class="stars">${s ? stars(s) : "未発見"}</span>
        </div>
        <div class="muted">${esc(w.katakana)} ${voiceButton(`${w.id}.katakana`, "🔈")}</div>
        <p style="font-size:1.1rem;margin:8px 0 0"><b>${esc(w.meaning)}</b> ${voiceButton(`${w.id}.meaning`, "🔈")}</p>

        <section><h4>🎮 シーン</h4>${esc(w.scene)}</section>
        ${w.gap ? `<section><h4>⚠️ カタカナの罠</h4><div class="tip warn">${esc(w.gap)}</div></section>` : ""}
        <section><h4>💬 例文</h4><i>${esc(w.example.en)}</i> ${voiceButton(`${w.id}.example.en`, "🔈")}<br><span class="muted">${esc(w.example.ja)}</span> ${voiceButton(`${w.id}.example.ja`, "🔈")}</section>
        <section><h4>📜 語源 ${voiceButton(`${w.id}.story`, "🔈")}</h4><b>${esc(w.etymology.origin)}</b><p style="margin:6px 0 0">${esc(w.etymology.story)}</p></section>
        ${roots.length ? `<section><h4>💎 語根</h4>${roots.map((r) => `<span class="chip">${esc(r.form)}＝${esc(r.meaning)}</span>`).join("")}</section>` : ""}
        ${w.family.length ? `<section><h4>🌳 同じ語源の仲間</h4>${w.family.map((f) => `<span class="chip">${esc(f)}</span>`).join("")}</section>` : ""}
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

  // ---------- 語根の宝珠 ----------
  function renderRoots() {
    const done = ROOTS.filter((r) => r.words.every((id) => card(id).star >= 3)).length;
    $view.innerHTML = html`
      <h2>💎 語根の宝珠 <span class="small muted">${done}/${ROOTS.length} 完成</span></h2>
      <p class="small muted">同じ語根をもつことばをすべて★3以上にすると、宝珠が輝きます。</p>
      ${ROOTS.map((r) => {
        const complete = r.words.every((id) => card(id).star >= 3);
        return html`
          <div class="window crystal ${complete ? "done" : ""}">
            <div class="gem">💎</div>
            <div class="spacer">
              <div><span class="form">${esc(r.form)}</span> ＝ <b>${esc(r.meaning)}</b> <span class="small muted">（${esc(r.source)}）</span></div>
              <div style="margin-top:4px">
                ${r.words.map((id) => `<button class="chip" data-detail="${id}">${esc(byId[id].word)} <span class="stars">${card(id).star ? "★".repeat(card(id).star) : "？"}</span></button>`).join("")}
              </div>
              <div class="small muted" style="margin-top:4px">仲間のことば：${r.extra.map(esc).join(", ")}</div>
            </div>
          </div>`;
      }).join("")}`;
    $view.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
  }

  // ---------- つよさ ----------
  function renderStatus() {
    const dist = [0, 1, 2, 3, 4, 5].map((n) => WORDS.filter((w) => card(w.id).star === n).length);
    const acc = state.answered ? Math.round((state.correct / state.answered) * 100) : 0;
    const cleared = Object.keys(state.cleared).length;
    const total = Object.keys(REGIONS).reduce((n, r) => n + stagesOf(r).length + 1, 0);
    $view.innerHTML = html`
      <div class="window">
        <div class="row"><span style="font-size:2.2rem">${job().icon}</span>
          <div class="spacer"><h2 style="margin:0">${esc(state.hero.name)}</h2><div class="small muted">${esc(job().name)} ・ ${esc(job().desc)}</div></div></div>
        <table class="stat-table">
          <tr><th>レベル</th><td>${state.level}</td></tr>
          <tr><th>さいだいHP</th><td>${maxHp()}</td></tr>
          <tr><th>さいだいMP</th><td>${maxMp()}</td></tr>
          <tr><th>つぎのレベルまで</th><td>${expToNext() - state.exp} EXP</td></tr>
          <tr><th>ゴールド</th><td>${state.gold} G</td></tr>
        </table>
      </div>
      <div class="window">
        <h3>🪄 じゅもん</h3>
        ${SPELLS.map((s) => html`<div class="spell-row small">
          <b>${state.level >= s.lv ? esc(s.name) : "？？？"}</b>
          <span>${state.level >= s.lv ? `${esc(s.en)} ・ MP${s.mp} ・ ${esc(s.desc)}` : `Lv${s.lv} で おぼえる`}</span></div>`).join("")}
        <h3 style="margin-top:12px">🎒 どうぐ</h3>
        ${Object.entries(ITEMS).map(([k, it]) => `<span class="chip">${it.icon} ${esc(it.name)} ×${state.items[k]}</span>`).join("")}
      </div>
      <div class="window result-grid">
        <div><b>${cleared}/${total}</b>クリア</div>
        <div><b>${state.battles}</b>せんとう</div>
        <div><b>${acc}%</b>正答率</div>
        <div><b>${state.bestCombo}</b>最大コンボ</div>
        <div><b>${state.streak}</b>連続日数</div>
        <div><b>${state.totalExp}</b>累計EXP</div>
      </div>
      <div class="window">
        <h3>🃏 ことばカードの★</h3>
        ${dist.map((n, i) => html`
          <div class="row small" style="margin:4px 0">
            <span class="stars" style="width:90px">${i ? stars(i) : "未発見"}</span>
            <div class="gauge spacer"><div style="width:${(n / WORDS.length) * 100}%"></div></div>
            <span style="width:32px;text-align:right">${n}</span>
          </div>`).join("")}
      </div>
      <div class="window">
        <h3>🔊 おんせい</h3>
        <label class="row"><input type="checkbox" id="auto-voice" ${state.settings.autoVoice ? "checked" : ""}> 問題と答えを自動で読み上げる</label>
        <p class="small muted" style="margin:8px 0 0">声：${VOICE ? esc(VOICE.label) : "ブラウザ標準の読み上げ（音声ファイル未生成）"}</p>
        ${VOICE?.credit ? `<p class="small muted" style="margin:4px 0 0">${esc(VOICE.credit)}</p>` : ""}
      </div>
      <button class="btn secondary block" id="reset">🗑 ぼうけんのしょを けす</button>`;
    $view.querySelector("#auto-voice").addEventListener("change", (e) => { state.settings.autoVoice = e.target.checked; save(); });
    $view.querySelector("#reset").addEventListener("click", () => {
      if (!confirm("ぼうけんのしょ（セーブデータ）を本当に消しますか？")) return;
      state = defaultState();
      save();
      renderHud();
      renderOnboarding();
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
      const [w, r] = await Promise.all([fetch("data/words.json"), fetch("data/roots.json")]);
      WORDS = await w.json();
      ROOTS = await r.json();
    } catch (e) {
      $view.innerHTML = `<div class="window">データを読み込めませんでした。<br><code>python3 -m http.server</code> などでローカルサーバーを起動して開いてください。</div>`;
      return;
    }
    byId = Object.fromEntries(WORDS.map((w) => [w.id, w]));
    buildClips();
    await loadVoice();
    state = load();
    state.settings = { ...defaultState().settings, ...state.settings };
    document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
    document.getElementById("modal-close").addEventListener("click", closeModal);
    $modal.addEventListener("click", (e) => { if (e.target === $modal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-voice]");
      if (b) playVoice(b.dataset.voice.split(","));
    });
    renderHud();
    if (state.onboarded) go("map");
    else renderOnboarding();
  }

  init();
})();
