/* Vocab Quest — カタカナ語から英単語を学ぶ RPG 風プロトタイプ（依存なし） */
(() => {
  "use strict";

  // ---------- 定数 ----------
  const AREAS = {
    fantasy: { name: "剣と魔法の王国", icon: "🏰", enemy: "🐉", enemyName: "エンシェントドラゴン", genre: "RPG・ファンタジー" },
    battle: { name: "闘技場", icon: "⚔️", enemy: "🤖", enemyName: "バトルゴーレム", genre: "バトル・アクション" },
    scifi: { name: "宇宙ステーション", icon: "🚀", enemy: "👾", enemyName: "スペースインベーダー", genre: "SF・ロボット" },
    story: { name: "青春ストリート", icon: "🏫", enemy: "👻", enemyName: "カタカナおばけ", genre: "学園・スポーツ・ドラマ" },
  };
  const QTYPES = {
    kata: "カタカナ → 英語",
    meaning: "英語 → 意味",
    spell: "スペル錬成",
    etym: "語源パズル",
    syn: "類義語ハンター",
    trap: "⚠️ カタカナの罠",
  };
  const STAR_INTERVAL_DAYS = [0, 0, 1, 3, 7, 21]; // ★ごとの次回出題までの日数
  const QUESTIONS_PER_BATTLE = 8;
  const MAX_NEW_PER_BATTLE = 3;
  const HEARTS = 3;
  const CRIT_MS = 5000;
  const BOSS_UNLOCK_RATIO = 0.6;
  const DAY = 24 * 60 * 60 * 1000;
  const STORE_KEY = "vocab-quest-save-v1";

  let WORDS = [];
  let ROOTS = [];
  let byId = {};
  let state = null;
  let battle = null;

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
  // 出題文から答えの単語（と派生形）を伏せる: equipment → equip も伏せる
  const mask = (text, w) => text.replace(new RegExp(`\\b${w.word.slice(0, 4)}[a-z]*`, "gi"), "＿＿＿");
  const html = (strings, ...vals) => strings.reduce((out, s, i) => out + s + (i < vals.length ? vals[i] : ""), "");

  // ---------- セーブデータ ----------
  function defaultState() {
    return { level: 1, xp: 0, totalXp: 0, streak: 0, lastDay: null, cards: {}, battles: 0, answered: 0, correct: 0, bestCombo: 0, onboarded: false, genres: [] };
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
  const areaWords = (area) => WORDS.filter((w) => w.area === area);
  const learnedRatio = (words) => words.filter((w) => card(w.id).star >= 3).length / words.length;

  // ---------- HUD ----------
  function renderHud() {
    document.getElementById("hud-level").textContent = `Lv ${state.level}`;
    document.getElementById("hud-xp").style.width = `${(state.xp / (state.level * 100)) * 100}%`;
    document.getElementById("hud-streak").textContent = `🔥 ${state.streak}`;
  }

  // ---------- 画面切り替え ----------
  function go(tab) {
    document.body.classList.remove("in-battle");
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    ({ world: renderWorld, dex: renderDex, roots: renderRoots, stats: renderStats })[tab]();
    renderHud();
    window.scrollTo(0, 0);
  }

  // ---------- オンボーディング ----------
  function renderOnboarding() {
    document.body.classList.add("in-battle");
    const selected = new Set(state.genres);
    const draw = () => {
      $view.innerHTML = html`
        <div class="hero">
          <div class="logo">🗝️</div>
          <h1>Vocab Quest へようこそ！</h1>
          <p class="muted">ゲームやアニメで聞いたことのあるカタカナ語が、<br>英単語へのワープポイントになる。</p>
        </div>
        <div class="card">
          <h3>好きなジャンルは？（いくつでも）</h3>
          <div class="genre-grid">
            ${Object.entries(AREAS).map(([k, a]) => html`
              <button class="genre ${selected.has(k) ? "selected" : ""}" data-genre="${k}" aria-pressed="${selected.has(k)}">
                <span class="i">${a.icon}</span>${esc(a.genre)}
              </button>`).join("")}
          </div>
          <button class="btn block" id="start" ${selected.size ? "" : "disabled"}>チュートリアルバトルへ ▶</button>
          <p class="small muted" style="text-align:center">3問だけの練習バトルです</p>
        </div>`;
      $view.querySelectorAll("[data-genre]").forEach((b) => b.addEventListener("click", () => {
        const k = b.dataset.genre;
        selected.has(k) ? selected.delete(k) : selected.add(k);
        draw();
      }));
      $view.querySelector("#start").addEventListener("click", () => {
        state.genres = [...selected];
        save();
        startBattle({ mode: "tutorial" });
      });
    };
    draw();
  }

  // ---------- ワールド ----------
  function renderWorld() {
    const due = dueWords();
    const order = [...state.genres, ...Object.keys(AREAS).filter((k) => !state.genres.includes(k))];
    $view.innerHTML = html`
      ${due.length ? html`
        <div class="card review-banner">
          <div class="emoji">👹</div>
          <div class="spacer">
            <b>復習モンスターが ${due.length} 体出現中！</b>
            <div class="small muted">覚えかけの単語を倒してカードを進化させよう</div>
          </div>
          <button class="btn" id="review">戦う</button>
        </div>` : html`
        <div class="card small muted">✨ 今は復習モンスターはいません。新しいエリアを冒険しよう！</div>`}
      ${order.map((k) => {
        const a = AREAS[k];
        const words = areaWords(k);
        const found = words.filter((w) => card(w.id).star > 0).length;
        const ratio = learnedRatio(words);
        const bossOpen = ratio >= BOSS_UNLOCK_RATIO;
        return html`
          <div class="card area" style="--area-color: var(--area-${k})">
            <div class="head">
              <div class="icon">${a.icon}</div>
              <div class="spacer">
                <h3>${esc(a.name)}</h3>
                <div class="small muted">${esc(a.genre)} ・ 発見 ${found}/${words.length} ・ 定着(★3+) ${Math.round(ratio * 100)}%</div>
              </div>
            </div>
            <div class="progress"><div style="width:${ratio * 100}%"></div></div>
            <div class="actions">
              <button class="btn" data-battle="${k}">⚔️ 冒険する</button>
              <button class="btn secondary" data-boss="${k}" ${bossOpen ? "" : "disabled"} title="定着率 ${BOSS_UNLOCK_RATIO * 100}% で解放">
                ${bossOpen ? "👑 ボス戦" : `🔒 ボス（定着${BOSS_UNLOCK_RATIO * 100}%で解放）`}
              </button>
            </div>
          </div>`;
      }).join("")}`;
    $view.querySelector("#review")?.addEventListener("click", () => startBattle({ mode: "review" }));
    $view.querySelectorAll("[data-battle]").forEach((b) => b.addEventListener("click", () => startBattle({ mode: "area", area: b.dataset.battle })));
    $view.querySelectorAll("[data-boss]").forEach((b) => b.addEventListener("click", () => startBattle({ mode: "boss", area: b.dataset.boss })));
  }

  // ---------- 出題 ----------
  function selectWords({ mode, area }) {
    if (mode === "tutorial") {
      const pool = WORDS.filter((w) => state.genres.includes(w.area) && ["A2", "B1"].includes(w.cefr));
      return shuffle(pool).slice(0, 3);
    }
    if (mode === "review") return shuffle(dueWords()).slice(0, QUESTIONS_PER_BATTLE);
    const pool = areaWords(area);
    if (mode === "boss") return shuffle(pool).slice(0, QUESTIONS_PER_BATTLE);
    const due = shuffle(pool.filter((w) => isDue(w.id)));
    const fresh = shuffle(pool.filter((w) => card(w.id).star === 0)).slice(0, MAX_NEW_PER_BATTLE);
    const rest = shuffle(pool.filter((w) => !due.includes(w) && !fresh.includes(w)))
      .sort((a, b) => card(a.id).star - card(b.id).star);
    return shuffle([...due, ...fresh, ...rest].slice(0, QUESTIONS_PER_BATTLE));
  }

  function allowedTypes(w, mode) {
    if (mode === "tutorial") return ["kata"];
    const hard = ["etym", "syn", ...(w.trapQuiz ? ["trap"] : [])];
    if (mode === "boss") return hard;
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
    const q = { word: w, type, choices: null };
    switch (type) {
      case "kata":
        q.prompt = html`<span class="big">${esc(w.katakana)}</span><span class="small muted">🎮 ${esc(mask(w.scene, w))}</span><br>英語で正しいつづりは？`;
        q.choices = shuffle([w, ...distractors(w, 3)]).map((x) => ({ label: x.word, correct: x.id === w.id, ref: x }));
        break;
      case "meaning":
        q.prompt = html`<span class="big">${esc(w.word)}</span>英語での意味は？`;
        q.choices = shuffle([w, ...distractors(w, 3)]).map((x) => ({ label: x.meaning, correct: x.id === w.id, ref: x }));
        break;
      case "spell":
        q.prompt = html`<span class="big">${esc(w.katakana)}</span>${esc(w.meaning)}<br><span class="small muted">文字をタップしてつづりを完成させよう</span>`;
        q.letters = shuffle(w.word.split(""));
        break;
      case "etym": {
        const masked = mask(w.etymology.origin, w);
        q.prompt = html`📜 <b>${esc(masked)}</b><br>この語源から生まれた英単語は？`;
        q.choices = shuffle([w, ...distractors(w, 3)]).map((x) => ({ label: `${x.word}（${x.katakana}）`, correct: x.id === w.id, ref: x }));
        break;
      }
      case "syn": {
        const s = pick(w.synonyms);
        const hasSyn = (x) => !x.synonyms.some((y) => y.word === s.word);
        q.prompt = html`<span class="big">${esc(s.word)}</span>（${esc(s.meaning)}）<br>この語の<b>類義語</b>はどれ？`;
        q.choices = shuffle([w, ...distractors(w, 3, hasSyn)]).map((x) => ({ label: `${x.word}（${x.katakana}）`, correct: x.id === w.id, ref: x }));
        q.synonym = s;
        break;
      }
      case "trap":
        q.prompt = html`${esc(w.trapQuiz.question)}`;
        q.choices = shuffle([
          { label: w.trapQuiz.answer, correct: true },
          ...w.trapQuiz.wrong.map((label) => ({ label, correct: false })),
        ]);
        break;
    }
    return q;
  }

  // ---------- バトル ----------
  function startBattle({ mode, area }) {
    const words = selectWords({ mode, area });
    if (!words.length) { go("world"); return; }
    const a = area ? AREAS[area] : { enemy: mode === "tutorial" ? "🐣" : "👹", enemyName: mode === "tutorial" ? "スライム" : "復習モンスター", name: mode === "tutorial" ? "チュートリアル" : "デイリー復習" };
    const isBoss = mode === "boss";
    battle = {
      mode, area, isBoss,
      title: isBoss ? `👑 ${a.name}のボス` : a.name,
      enemy: isBoss ? "👑" + a.enemy : a.enemy,
      enemyName: isBoss ? `ボス・${a.enemyName}` : a.enemyName,
      questions: words.map((w) => makeQuestion(w, pick(allowedTypes(w, mode)))),
      index: 0,
      hearts: mode === "tutorial" ? Infinity : HEARTS,
      combo: 0, maxCombo: 0, xp: 0, correct: 0, answered: [],
      startStars: Object.fromEntries(words.map((w) => [w.id, card(w.id).star])),
    };
    battle.maxHp = Math.round(battle.questions.length * 10 * (isBoss ? 1.6 : 1.2));
    battle.hp = battle.maxHp;
    document.body.classList.add("in-battle");
    renderQuestion();
  }

  function battleHeader() {
    const b = battle;
    return html`
      <div class="battle-top">
        <button class="btn secondary" id="flee" aria-label="撤退する">🏳️ にげる</button>
        <span class="title small muted">${esc(b.title)} ・ ${Math.min(b.index + 1, b.questions.length)}/${b.questions.length}</span>
        <span class="hearts" aria-label="残りハート">${b.hearts === Infinity ? "💖" : "❤️".repeat(b.hearts) + "🖤".repeat(HEARTS - b.hearts)}</span>
      </div>
      <div class="enemy">
        <div class="sprite ${b.hp <= 0 ? "dead" : ""}" id="sprite">${b.enemy}</div>
        <div class="small muted">${esc(b.enemyName)}</div>
        <div class="hp"><div style="width:${Math.max(0, b.hp / b.maxHp) * 100}%"></div></div>
      </div>
      <div class="combo" id="combo">${b.combo >= 2 ? `${b.combo} COMBO!` : ""}</div>`;
  }

  function renderQuestion() {
    const q = battle.questions[battle.index];
    q.shownAt = Date.now();
    $view.innerHTML = html`
      ${battleHeader()}
      <div class="card">
        <div class="qtype">${QTYPES[q.type]}</div>
        <div class="prompt">${q.prompt}</div>
        ${q.type === "spell" ? html`
          <div class="spell-slots" id="slots">${q.word.word.split("").map(() => "<span></span>").join("")}</div>
          <div class="tiles">${q.letters.map((l, i) => `<button class="tile" data-i="${i}">${esc(l)}</button>`).join("")}</div>
          <div class="row" style="justify-content:center;margin-top:12px">
            <button class="btn secondary" id="undo">↩ 1文字もどす</button>
          </div>` : html`
          <div class="choices">${q.choices.map((c, i) => `<button class="choice" data-i="${i}">${esc(c.label)}</button>`).join("")}</div>`}
      </div>`;
    $view.querySelector("#flee").addEventListener("click", () => {
      if (confirm("撤退しますか？ここまでの経験値は獲得できます。")) finishBattle(true);
    });
    if (q.type === "spell") bindSpell(q);
    else $view.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => answer(q, q.choices[+b.dataset.i], b)));
  }

  function bindSpell(q) {
    const typed = [];
    const slots = [...$view.querySelectorAll("#slots span")];
    const tiles = [...$view.querySelectorAll(".tile")];
    const draw = () => {
      slots.forEach((s, i) => { s.textContent = typed[i] != null ? q.letters[typed[i]] : ""; });
      tiles.forEach((t, i) => { t.disabled = typed.includes(i); });
    };
    tiles.forEach((t) => t.addEventListener("click", () => {
      typed.push(+t.dataset.i);
      draw();
      if (typed.length === q.letters.length) {
        const spelled = typed.map((i) => q.letters[i]).join("");
        tiles.forEach((x) => { x.disabled = true; });
        answer(q, { label: spelled, correct: spelled === q.word.word });
      }
    }));
    $view.querySelector("#undo").addEventListener("click", () => { typed.pop(); draw(); });
  }

  function answer(q, choice, button) {
    const b = battle;
    const w = q.word;
    const elapsed = Date.now() - q.shownAt;
    const ok = choice.correct;
    b.answered.push(w);
    $view.querySelectorAll(".choice").forEach((el, i) => {
      el.disabled = true;
      if (q.choices[i].correct) el.classList.add("correct");
    });
    if (button && !ok) button.classList.add("wrong");

    const c = { ...card(w.id) };
    c.seen = (c.seen || 0) + 1;
    let crit = false;
    if (ok) {
      b.correct++;
      b.combo++;
      b.maxCombo = Math.max(b.maxCombo, b.combo);
      crit = elapsed <= CRIT_MS;
      const mult = Math.min(3, 1 + 0.5 * (b.combo - 1));
      b.hp -= Math.round(10 * mult * (crit ? 2 : 1));
      b.xp += 10 + (crit ? 5 : 0) + (b.isBoss ? 5 : 0);
      c.correct = (c.correct || 0) + 1;
      c.star = Math.min(5, (c.star || 0) + 1);
    } else {
      b.combo = 0;
      if (b.hearts !== Infinity) b.hearts--;
      c.star = Math.max(1, (c.star || 0) - 1);
    }
    c.due = Date.now() + STAR_INTERVAL_DAYS[c.star] * DAY;
    state.cards[w.id] = c;
    state.answered++;
    if (ok) state.correct++;
    save();

    // 敵・コンボ演出
    const sprite = $view.querySelector("#sprite");
    const comboEl = $view.querySelector("#combo");
    if (ok) {
      sprite.classList.remove("hit"); void sprite.offsetWidth; sprite.classList.add("hit");
      comboEl.textContent = crit ? "💥 CRITICAL!" + (b.combo >= 2 ? ` ${b.combo} COMBO` : "") : b.combo >= 2 ? `${b.combo} COMBO!` : "";
      comboEl.classList.toggle("crit", crit);
      if (b.hp <= 0) sprite.classList.add("dead");
      $view.querySelector(".hp div").style.width = `${Math.max(0, b.hp / b.maxHp) * 100}%`;
    } else {
      comboEl.textContent = "";
      $view.querySelector(".hearts").textContent = b.hearts === Infinity ? "💖" : "❤️".repeat(b.hearts) + "🖤".repeat(HEARTS - b.hearts);
    }
    showFeedback(q, choice, ok);
  }

  function showFeedback(q, choice, ok) {
    const w = q.word;
    const last = battle.index >= battle.questions.length - 1 || battle.hearts <= 0;
    const wrongRef = !ok && choice.ref && choice.ref.id !== w.id ? choice.ref : null;
    const firstSentence = w.etymology.story.split("。")[0] + "。";
    const box = document.createElement("div");
    box.className = `card feedback ${ok ? "ok" : "ng"}`;
    box.innerHTML = html`
      <div class="row">
        <span class="verdict">${ok ? "✅ 正解！" : "❌ おしい！"}</span>
        <span class="spacer"></span>
        <span class="stars" title="カードの★">${stars(card(w.id).star)}</span>
      </div>
      <div class="row"><span class="word">${esc(w.word)}</span><span class="muted">${esc(w.katakana)}</span>
        <button class="speak" data-say="${esc(w.word)}" aria-label="発音を聞く">🔊</button></div>
      <div>${esc(w.meaning)}</div>
      ${q.synonym ? `<div class="tip">🔀 <b>${esc(q.synonym.word)}</b>：${esc(q.synonym.nuance)}</div>` : ""}
      ${wrongRef ? `<div class="tip">🤔 あなたが選んだ <b>${esc(wrongRef.word)}</b> は「${esc(wrongRef.meaning)}」</div>` : ""}
      ${!ok && q.type === "spell" ? `<div class="tip">✏️ あなたのつづり：<b>${esc(choice.label)}</b></div>` : ""}
      <div class="tip">📜 ${esc(w.etymology.origin)}<br>💡 ${esc(firstSentence)}</div>
      ${w.gap ? `<div class="tip warn">⚠️ ${esc(w.gap)}</div>` : ""}
      <div class="row" style="margin-top:12px">
        <button class="btn secondary" data-detail="${w.id}">📖 図鑑で詳しく</button>
        <span class="spacer"></span>
        <button class="btn" id="next">${last ? "結果を見る ▶" : "次へ ▶"}</button>
      </div>`;
    $view.appendChild(box);
    box.querySelector("[data-say]").addEventListener("click", () => speak(w.word));
    box.querySelector("[data-detail]").addEventListener("click", () => openDetail(w.id));
    const next = box.querySelector("#next");
    next.addEventListener("click", () => {
      if (last) finishBattle(battle.hearts <= 0);
      else { battle.index++; renderQuestion(); window.scrollTo(0, 0); }
    });
    next.focus({ preventScroll: true });
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function gainXp(amount) {
    const ups = [];
    state.xp += amount;
    state.totalXp += amount;
    while (state.xp >= state.level * 100) {
      state.xp -= state.level * 100;
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

  function finishBattle(retreated) {
    const b = battle;
    const won = b.hp <= 0;
    const bonus = won ? 20 : 0;
    const levelUps = gainXp(b.xp + bonus);
    const welcomeBack = updateStreak();
    state.battles++;
    state.bestCombo = Math.max(state.bestCombo, b.maxCombo);
    if (b.mode === "tutorial") state.onboarded = true;
    save();
    renderHud();

    const answeredWords = b.answered;
    const newCards = answeredWords.filter((w) => b.startStars[w.id] === 0);
    const starUps = answeredWords.filter((w) => b.startStars[w.id] > 0 && card(w.id).star > b.startStars[w.id]);
    const answered = answeredWords.length;

    $view.innerHTML = html`
      <div class="card result">
        <div class="big-emoji">${won ? "🏆" : retreated ? "🏳️" : "✨"}</div>
        <h2>${won ? `${esc(b.enemyName)}を倒した！` : retreated ? "撤退した…でも経験値はゲット！" : "バトル終了！"}</h2>
        ${welcomeBack ? `<p class="muted">おかえりなさい！また一緒に冒険しよう。</p>` : ""}
        ${levelUps.length ? `<p style="color:var(--accent);font-weight:800;font-size:1.2rem">🎉 レベルアップ！ Lv ${levelUps[levelUps.length - 1]}</p>` : ""}
        <div class="result-grid">
          <div><b>+${b.xp + bonus}</b>XP</div>
          <div><b>${b.correct}/${answered}</b>正解</div>
          <div><b>${b.maxCombo}</b>最大コンボ</div>
        </div>
        <div class="drops">
          ${newCards.length ? `<h4>🃏 新しいカード</h4><div>${newCards.map((w) => `<button class="chip" data-detail="${w.id}">${esc(w.word)}</button>`).join("")}</div>` : ""}
          ${starUps.length ? `<h4>⬆️ 進化したカード</h4><div>${starUps.map((w) => `<button class="chip" data-detail="${w.id}">${esc(w.word)} <span class="stars">${"★".repeat(card(w.id).star)}</span></button>`).join("")}</div>` : ""}
        </div>
        <div class="row" style="margin-top:16px">
          ${b.mode !== "tutorial" && b.area ? `<button class="btn secondary" id="again">もう一度</button>` : ""}
          <span class="spacer"></span>
          <button class="btn" id="home">ワールドへ ▶</button>
        </div>
      </div>`;
    $view.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
    $view.querySelector("#again")?.addEventListener("click", () => startBattle({ mode: b.mode, area: b.area }));
    $view.querySelector("#home").addEventListener("click", () => go("world"));
    battle = null;
  }

  // ---------- 図鑑 ----------
  const dexFilter = { q: "", area: "all", trap: false };
  function renderDex() {
    const found = WORDS.filter((w) => card(w.id).star > 0).length;
    $view.innerHTML = html`
      <h2>📖 単語図鑑 <span class="small muted">${found}/${WORDS.length} 発見</span></h2>
      <div class="filters">
        <input id="q" type="search" placeholder="英語・カタカナ・意味で検索" value="${esc(dexFilter.q)}" aria-label="検索">
        <select id="area" aria-label="エリア">
          <option value="all">全エリア</option>
          ${Object.entries(AREAS).map(([k, a]) => `<option value="${k}" ${dexFilter.area === k ? "selected" : ""}>${a.icon} ${esc(a.name)}</option>`).join("")}
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
        <div class="small muted">${AREAS[w.area].icon} ${esc(AREAS[w.area].name)} ・ ${esc(w.pos)} ・ CEFR ${esc(w.cefr)}</div>
        <div class="row">
          <h2>${esc(w.word)}</h2>
          <button class="speak" id="say" aria-label="発音を聞く">🔊</button>
          <span class="spacer"></span>
          <span class="stars">${s ? stars(s) : "未発見"}</span>
        </div>
        <div class="muted">${esc(w.katakana)}</div>
        <p style="font-size:1.1rem;margin:8px 0 0"><b>${esc(w.meaning)}</b></p>

        <section><h4>🎮 シーン</h4>${esc(w.scene)}</section>
        ${w.gap ? `<section><h4>⚠️ カタカナの罠</h4><div class="tip warn">${esc(w.gap)}</div></section>` : ""}
        <section><h4>💬 例文</h4><i>${esc(w.example.en)}</i><br><span class="muted">${esc(w.example.ja)}</span></section>
        <section><h4>📜 語源</h4><b>${esc(w.etymology.origin)}</b><p style="margin:6px 0 0">${esc(w.etymology.story)}</p></section>
        ${roots.length ? `<section><h4>💎 語根</h4>${roots.map((r) => `<span class="chip">${esc(r.form)}＝${esc(r.meaning)}</span>`).join("")}</section>` : ""}
        ${w.family.length ? `<section><h4>🌳 同じ語源の仲間</h4>${w.family.map((f) => `<span class="chip">${esc(f)}</span>`).join("")}</section>` : ""}
        <section>
          <h4>🔀 類義語（ニュアンスと語源）</h4>
          <table class="syn-table">
            <thead><tr><th>単語</th><th>ニュアンス</th><th>語源</th></tr></thead>
            <tbody>
              ${w.synonyms.map((x) => html`<tr>
                <td><b>${esc(x.word)}</b><br><span class="small muted">${esc(x.meaning)}</span></td>
                <td>${esc(x.nuance)}</td>
                <td class="small">${esc(x.etymology)}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </section>
      </div>`;
    $modalContent.querySelector("#say").addEventListener("click", () => speak(w.word));
    $modal.hidden = false;
    $modal.querySelector(".modal-body").scrollTop = 0;
  }
  function closeModal() { $modal.hidden = true; }

  // ---------- 語根 ----------
  function renderRoots() {
    const done = ROOTS.filter((r) => r.words.every((id) => card(id).star >= 3)).length;
    $view.innerHTML = html`
      <h2>💎 語根クリスタル <span class="small muted">${done}/${ROOTS.length} 完成</span></h2>
      <p class="small muted">同じ語根をもつ単語をすべて★3以上にするとクリスタルが輝きます。</p>
      ${ROOTS.map((r) => {
        const complete = r.words.every((id) => card(id).star >= 3);
        return html`
          <div class="card crystal ${complete ? "done" : ""}">
            <div class="gem">💎</div>
            <div class="spacer">
              <div><span class="form">${esc(r.form)}</span> ＝ <b>${esc(r.meaning)}</b> <span class="small muted">（${esc(r.source)}）</span></div>
              <div style="margin-top:4px">
                ${r.words.map((id) => `<button class="chip" data-detail="${id}">${esc(byId[id].word)} <span class="stars">${card(id).star ? "★".repeat(card(id).star) : "？"}</span></button>`).join("")}
              </div>
              <div class="small muted" style="margin-top:4px">仲間の単語：${r.extra.map(esc).join(", ")}</div>
            </div>
          </div>`;
      }).join("")}`;
    $view.querySelectorAll("[data-detail]").forEach((el) => el.addEventListener("click", () => openDetail(el.dataset.detail)));
  }

  // ---------- 記録 ----------
  function renderStats() {
    const dist = [0, 1, 2, 3, 4, 5].map((n) => WORDS.filter((w) => card(w.id).star === n).length);
    const acc = state.answered ? Math.round((state.correct / state.answered) * 100) : 0;
    $view.innerHTML = html`
      <h2>📊 冒険の記録</h2>
      <div class="card result-grid" style="grid-template-columns:repeat(3,1fr)">
        <div><b>Lv ${state.level}</b>レベル</div>
        <div><b>${state.totalXp}</b>累計XP</div>
        <div><b>${state.streak}</b>連続日数</div>
        <div><b>${state.battles}</b>バトル数</div>
        <div><b>${acc}%</b>正答率</div>
        <div><b>${state.bestCombo}</b>最大コンボ</div>
      </div>
      <div class="card">
        <h3>カードの★分布</h3>
        ${dist.map((n, i) => html`
          <div class="row small" style="margin:4px 0">
            <span class="stars" style="width:90px">${i ? stars(i) : "未発見"}</span>
            <div class="progress spacer"><div style="width:${(n / WORDS.length) * 100}%"></div></div>
            <span style="width:32px;text-align:right">${n}</span>
          </div>`).join("")}
      </div>
      <button class="btn secondary block" id="reset">🗑 セーブデータを削除</button>`;
    $view.querySelector("#reset").addEventListener("click", () => {
      if (!confirm("本当にセーブデータを削除しますか？")) return;
      state = defaultState();
      save();
      renderHud();
      renderOnboarding();
    });
  }

  // ---------- 音声 ----------
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  // ---------- 起動 ----------
  async function init() {
    try {
      const [w, r] = await Promise.all([fetch("data/words.json"), fetch("data/roots.json")]);
      WORDS = await w.json();
      ROOTS = await r.json();
    } catch (e) {
      $view.innerHTML = `<div class="card">データを読み込めませんでした。<br><code>python3 -m http.server</code> などでローカルサーバーを起動して開いてください。</div>`;
      return;
    }
    byId = Object.fromEntries(WORDS.map((w) => [w.id, w]));
    state = load();
    document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
    document.getElementById("modal-close").addEventListener("click", closeModal);
    $modal.addEventListener("click", (e) => { if (e.target === $modal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
    renderHud();
    if (state.onboarded) go("world");
    else renderOnboarding();
  }

  init();
})();
