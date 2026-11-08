(() => {
  "use strict";

  // ---------- Konstante ----------
  const STORE_KEY = "tikii-v1";
  const MAX_HEARTS = 5;
  const HEART_REGEN_MS = 30 * 60 * 1000; // 1 zemër çdo 30 min
  const XP_LESSON = 10;
  const XP_PERFECT = 5;
  const XP_PRACTICE = 10;
  const app = document.getElementById("app");

  // ---------- Ndihmës ----------
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const sample = (a, n) => shuffle(a.slice()).slice(0, n);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return dayKey(d);
  };
  const wordCount = (s) => s.trim().split(/\s+/).length;

  // ---------- Gjendja ----------
  const defaultState = () => ({
    course: null,
    progress: {}, // cid -> { "u-l": numër herësh i përfunduar }
    mistakes: {}, // cid -> { itemId: numër gabimesh }
    xp: 0,
    daily: {}, // "YYYY-MM-DD" -> xp
    streak: 0,
    lastDay: null,
    hearts: MAX_HEARTS,
    heartsTs: Date.now(),
    settings: { goal: 20, hearts: false, sound: true, tts: true },
  });

  let S;
  try {
    S = Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || "{}"));
    S.settings = Object.assign(defaultState().settings, S.settings);
    S.settings.hearts = false; // zemrat/energjia pa limit
    S.hearts = MAX_HEARTS;
  } catch {
    S = defaultState();
  }
  const save = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
    } catch {}
  };

  function syncHearts() {
    if (S.hearts >= MAX_HEARTS) {
      S.hearts = MAX_HEARTS;
      S.heartsTs = Date.now();
      return;
    }
    const gained = Math.floor((Date.now() - S.heartsTs) / HEART_REGEN_MS);
    if (gained > 0) {
      S.hearts = Math.min(MAX_HEARTS, S.hearts + gained);
      S.heartsTs += gained * HEART_REGEN_MS;
      if (S.hearts === MAX_HEARTS) S.heartsTs = Date.now();
      save();
    }
  }

  function currentStreak() {
    if (!S.lastDay) return 0;
    return S.lastDay === dayKey() || S.lastDay === daysAgo(1) ? S.streak : 0;
  }

  function addXp(n) {
    const t = dayKey();
    S.xp += n;
    S.daily[t] = (S.daily[t] || 0) + n;
    if (S.lastDay !== t) {
      S.streak = S.lastDay === daysAgo(1) ? S.streak + 1 : 1;
      S.lastDay = t;
    }
    save();
  }

  // ---------- Kurset ----------
  const flat = {}; // cid -> [item]
  const byId = {}; // cid -> { id: item }
  for (const [cid, c] of Object.entries(window.COURSES)) {
    flat[cid] = [];
    byId[cid] = {};
    c.units.forEach((u, ui) =>
      u.lessons.forEach(([, pairs], li) =>
        pairs.forEach(([sq, t, alt], ii) => {
          const it = { id: `${ui}-${li}-${ii}`, u: ui, l: li, sq, t, alt: alt || [] };
          flat[cid].push(it);
          byId[cid][it.id] = it;
        })
      )
    );
  }
  const course = () => window.COURSES[S.course];
  const prog = (cid = S.course) => (S.progress[cid] ||= {});
  const lessonItems = (cid, u, l) => flat[cid].filter((it) => it.u === u && it.l === l);
  const isDone = (u, l) => (prog()[`${u}-${l}`] || 0) > 0;
  function isUnlocked(u, l) {
    if (u === 0 && l === 0) return true;
    if (l > 0) return isDone(u, l - 1);
    const prev = course().units[u - 1];
    return isDone(u - 1, prev.lessons.length - 1);
  }
  const learnedItems = (cid = S.course) => flat[cid].filter((it) => (prog(cid)[`${it.u}-${it.l}`] || 0) > 0);

  // ---------- Krahasimi i përgjigjeve ----------
  const CONTRACTIONS = {
    "i'm": "i am", "you're": "you are", "he's": "he is", "she's": "she is", "it's": "it is",
    "we're": "we are", "they're": "they are", "don't": "do not", "doesn't": "does not",
    "can't": "cannot", "what's": "what is", "where's": "where is", "isn't": "is not",
    "aren't": "are not", "i've": "i have", "that's": "that is",
  };
  function norm(s, lang) {
    let r = s
      .toLowerCase()
      .replace(/[’`´]/g, "'")
      .replace(/[.,!?¿¡;:"«»„“”()…–-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (lang === "en") {
      r = r.split(" ").map((w) => CONTRACTIONS[w] || w).join(" ").replace(/\bcan not\b/g, "cannot");
    }
    return r;
  }
  const loose = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
  function stripArticle(s, articles) {
    if (!articles) return s;
    for (const a of articles) {
      if (a.endsWith("'") && s.startsWith(a) && s.length > a.length) return s.slice(a.length).trim();
      if (s.startsWith(a + " ") && s.length > a.length + 1) return s.slice(a.length + 1);
    }
    return s;
  }
  function lev(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  // Kthen { ok, note }
  function check(input, answers, lang, articles, allowTypo) {
    const u = stripArticle(norm(input, lang), articles);
    if (!u) return { ok: false };
    const A = answers.map((a) => stripArticle(norm(a, lang), articles));
    if (A.includes(u)) return { ok: true };
    if (A.map(loose).includes(loose(u))) return { ok: true, note: "Kujdes me shkronjat e veçanta (theksat)." };
    if (allowTypo && A.some((a) => a.length > 4 && lev(loose(a), loose(u)) <= 1))
      return { ok: true, note: "Ke një gabim të vogël shtypi." };
    return { ok: false };
  }

  // ---------- Zëri & tingujt ----------
  const canSpeak = () => S.settings.tts && "speechSynthesis" in window;
  let voices = [];
  const loadVoices = () => (voices = "speechSynthesis" in window ? speechSynthesis.getVoices() : []);
  if ("speechSynthesis" in window) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }
  function speak(text, slow = false) {
    if (!canSpeak()) return;
    try {
      const lang = course().tts;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = slow ? 0.55 : 0.9;
      const v =
        voices.find((v) => v.lang === lang) || voices.find((v) => v.lang.slice(0, 2) === lang.slice(0, 2));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch {}
  }
  let actx;
  function beep(good) {
    if (!S.settings.sound) return;
    try {
      actx ||= new (window.AudioContext || window.webkitAudioContext)();
      const notes = good ? [660, 880] : [220, 180];
      notes.forEach((f, i) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = good ? "sine" : "square";
        o.frequency.value = f;
        const t0 = actx.currentTime + i * 0.11;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(good ? 0.25 : 0.08, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        o.connect(g).connect(actx.destination);
        o.start(t0);
        o.stop(t0 + 0.2);
      });
    } catch {}
  }

  // ---------- Gjenerimi i ushtrimeve ----------
  function distractors(cid, item, field, n) {
    const multi = wordCount(item[field]) > 1;
    const seen = new Set([norm(item[field])]);
    const other = field === "t" ? "sq" : "t";
    // Përjashton artikujt me të njëjtin kuptim (që të mos ketë dy përgjigje të sakta)
    const pool = shuffle(flat[cid].filter((o) => o.id !== item.id && norm(o[other]) !== norm(item[other])));
    // Preferon të njëjtin lloj (fjalë / fjali) dhe të njëjtën njësi
    pool.sort((a, b) => {
      const sa = (wordCount(a[field]) > 1) === multi ? 0 : 2;
      const sb = (wordCount(b[field]) > 1) === multi ? 0 : 2;
      return sa + (a.u === item.u ? 0 : 1) - (sb + (b.u === item.u ? 0 : 1));
    });
    const out = [];
    for (const o of pool) {
      const k = norm(o[field]);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(o[field]);
      if (out.length >= n) break;
    }
    return out;
  }
  function bankTokens(cid, item, field) {
    const tokens = item[field].split(/\s+/);
    const have = new Set(tokens.map((t) => norm(t)));
    const extra = [];
    for (const o of shuffle(flat[cid].slice())) {
      for (const w of o[field].split(/\s+/)) {
        const k = norm(w);
        if (k && !have.has(k)) {
          have.add(k);
          extra.push(w.replace(/[.,!?]+$/, ""));
        }
        if (extra.length >= Math.min(4, tokens.length + 1)) break;
      }
      if (extra.length >= Math.min(4, tokens.length + 1)) break;
    }
    return shuffle([...tokens, ...extra]);
  }
  const ex = {
    pickT: (cid, it) => ({ type: "pick", dir: "toT", item: it, options: shuffle([it.t, ...distractors(cid, it, "t", 3)]), answer: it.t }),
    pickS: (cid, it) => ({ type: "pick", dir: "toS", item: it, options: shuffle([it.sq, ...distractors(cid, it, "sq", 3)]), answer: it.sq }),
    buildT: (cid, it) => ({ type: "build", dir: "toT", item: it, bank: bankTokens(cid, it, "t") }),
    buildS: (cid, it) => ({ type: "build", dir: "toS", item: it, bank: bankTokens(cid, it, "sq") }),
    listen: (cid, it) => ({ type: "listen", item: it, bank: bankTokens(cid, it, "t") }),
    type: (cid, it) => ({ type: "type", item: it }),
    match: (cid, items) => ({ type: "match", items }),
  };
  function production(cid, it) {
    const multi = wordCount(it.t) > 1;
    const r = Math.random();
    if (multi) {
      if (canSpeak() && r < 0.33) return ex.listen(cid, it);
      return r < 0.7 ? ex.buildT(cid, it) : ex.buildS(cid, it);
    }
    return r < 0.65 ? ex.type(cid, it) : ex.pickS(cid, it);
  }
  function makeLesson(cid, items) {
    const q = [];
    shuffle(items.slice()).forEach((it, i) => q.push(i % 2 ? ex.pickS(cid, it) : ex.pickT(cid, it)));
    if (items.length >= 3) q.push(ex.match(cid, sample(items, Math.min(5, items.length))));
    shuffle(items.slice()).forEach((it) => q.push(production(cid, it)));
    return q;
  }
  function makePractice(cid) {
    const m = S.mistakes[cid] || {};
    const weak = Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId[cid][id])
      .filter(Boolean)
      .slice(0, 6);
    const rest = sample(learnedItems(cid).filter((it) => !weak.includes(it)), 8 - weak.length);
    const items = [...weak, ...rest];
    if (items.length < 3) return null;
    const q = shuffle(items.map((it) => (Math.random() < 0.3 ? ex.pickT(cid, it) : production(cid, it))));
    q.splice(Math.floor(q.length / 2), 0, ex.match(cid, sample(items, Math.min(5, items.length))));
    return { items, q };
  }

  // ---------- Pamjet ----------
  let view = "learn";
  let session = null;

  function topbar() {
    syncHearts();
    const c = course();
    const today = S.daily[dayKey()] || 0;
    const streak = currentStreak();
    return `
      <header class="topbar">
        <button class="chip" data-act="courses" title="Ndrysho kursin">${c.flag}</button>
        <div class="chip ${streak && S.lastDay === dayKey() ? "on-fire" : "muted"}" title="Seria e ditëve">🔥 ${streak}</div>
        <div class="chip gem" title="XP sot">⚡ ${today}</div>
        <div class="chip heart" title="Zemrat pa limit">❤️ ∞</div>
      </header>`;
  }
  function navbar() {
    const b = (id, icon, label) =>
      `<button class="nav-btn ${view === id ? "active" : ""}" data-nav="${id}"><span>${icon}</span>${label}</button>`;
    return `<nav class="navbar">${b("learn", "🏠", "Mëso")}${b("practice", "🎯", "Praktiko")}${b("words", "📖", "Fjalët")}${b("profile", "👤", "Profili")}</nav>`;
  }

  function render() {
    if (!S.course || !window.COURSES[S.course]) return renderWelcome();
    if (session) return renderExercise();
    const body =
      view === "practice" ? practiceView() : view === "words" ? wordsView() : view === "profile" ? profileView() : learnView();
    app.innerHTML = `${topbar()}<main class="scroll">${body}</main>${navbar()}`;
    if (view === "learn") {
      const cur = app.querySelector(".node.current");
      if (cur) cur.scrollIntoView({ block: "center" });
    }
  }

  function renderWelcome(switching = false) {
    app.innerHTML = `
      <main class="scroll welcome">
        ${switching ? `<button class="link back" data-act="close-courses">← Kthehu</button>` : ""}
        <div class="logo">tikii</div>
        <h1>${switching ? "Zgjidh kursin" : "Mirë se erdhe!"}</h1>
        <p class="sub">Çfarë do të mësosh?</p>
        <div class="course-list">
          ${Object.entries(window.COURSES)
            .map(([cid, c]) => {
              const done = Object.keys(S.progress[cid] || {}).length;
              const total = c.units.reduce((n, u) => n + u.lessons.length, 0);
              return `<button class="course-card ${S.course === cid ? "selected" : ""}" data-course="${cid}">
                <span class="flag">${c.flag}</span>
                <span class="cname">${c.name}</span>
                <span class="cprog">${done}/${total} mësime</span>
              </button>`;
            })
            .join("")}
        </div>
      </main>`;
  }

  function learnView() {
    const c = course();
    let foundCurrent = false;
    let k = 0;
    const units = c.units
      .map((u, ui) => {
        const nodes = u.lessons
          .map(([title], li) => {
            const done = prog()[`${ui}-${li}`] || 0;
            const unlocked = isUnlocked(ui, li);
            let cls = "locked";
            if (unlocked && !done && !foundCurrent) {
              cls = "current";
              foundCurrent = true;
            } else if (done) cls = "done";
            else if (unlocked) cls = "current";
            const offset = Math.round(Math.sin(k++ * 0.9) * 70);
            const stars = "★".repeat(Math.min(3, done)) + "☆".repeat(Math.max(0, 3 - done));
            return `
              <div class="node-wrap" style="transform:translateX(${offset}px)">
                <button class="node ${cls}" data-lesson="${ui}-${li}" ${unlocked ? "" : "disabled"} aria-label="${esc(title)}">
                  ${cls === "locked" ? "🔒" : done ? "✓" : "★"}
                </button>
                ${cls === "current" && !done ? `<div class="start-bubble">FILLO</div>` : ""}
                <div class="node-label">${esc(title)}${done ? `<span class="stars">${stars}</span>` : ""}</div>
              </div>`;
          })
          .join("");
        return `
          <section class="unit u${ui % 6}">
            <div class="unit-head">
              <div><small>NJËSIA ${ui + 1}</small><h2>${esc(u.title)}</h2><p>${esc(u.desc)}</p></div>
            </div>
            <div class="path">${nodes}</div>
          </section>`;
      })
      .join("");
    const allDone = !foundCurrent;
    return `${units}${allDone ? `<div class="card center"><h3>🏆 E përfundove kursin!</h3><p>Vazhdo të praktikosh që të mos harrosh.</p></div>` : ""}`;
  }

  function practiceView() {
    const m = Object.keys(S.mistakes[S.course] || {}).length;
    const learned = learnedItems().length;
    return `
      <div class="card">
        <h2>🎯 Praktikë</h2>
        <p>Përsërit fjalët që ke mësuar, duke filluar me ato ku ke gabuar më shumë. </p>
        <div class="stats-row">
          <div class="stat"><b>${learned}</b><span>fjalë të mësuara</span></div>
          <div class="stat"><b>${m}</b><span>për t'u përsëritur</span></div>
        </div>
        <button class="btn primary big" data-act="practice" ${learned < 3 ? "disabled" : ""}>Fillo praktikën</button>
        ${learned < 3 ? `<p class="hint">Përfundo të paktën një mësim që të hapet praktika.</p>` : ""}
      </div>`;
  }

  function wordsView() {
    const items = learnedItems();
    if (!items.length) return `<div class="card center"><h2>📖 Fjalët</h2><p>Këtu do të shfaqen fjalët dhe frazat që mëson.</p></div>`;
    const m = S.mistakes[S.course] || {};
    return `
      <div class="card">
        <h2>📖 Fjalët e mia <small>(${items.length})</small></h2>
        <ul class="word-list">
          ${items
            .map(
              (it) => `<li>
                <button class="speak-sm" data-say="${esc(it.t)}" aria-label="Dëgjo">🔊</button>
                <div><b>${esc(it.t)}</b><span>${esc(it.sq)}</span></div>
                ${m[it.id] ? `<em title="Duhet përsëritur">●</em>` : ""}
              </li>`
            )
            .join("")}
        </ul>
      </div>`;
  }

  function profileView() {
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(daysAgo(i));
    const maxXp = Math.max(S.settings.goal, ...days.map((d) => S.daily[d] || 0));
    const dn = ["Di", "Hë", "Ma", "Më", "En", "Pr", "Sh"];
    const totalLessons = Object.values(S.progress).reduce((n, p) => n + Object.keys(p).length, 0);
    const goalOpt = (g, l) => `<option value="${g}" ${S.settings.goal === g ? "selected" : ""}>${l}</option>`;
    const toggle = (k, l) =>
      `<label class="toggle"><span>${l}</span><input type="checkbox" data-setting="${k}" ${S.settings[k] ? "checked" : ""}><i></i></label>`;
    return `
      <div class="card">
        <h2>👤 Profili im</h2>
        <div class="stats-grid">
          <div class="stat"><b>🔥 ${currentStreak()}</b><span>ditë rresht</span></div>
          <div class="stat"><b>⚡ ${S.xp}</b><span>XP gjithsej</span></div>
          <div class="stat"><b>📚 ${totalLessons}</b><span>mësime</span></div>
          <div class="stat"><b>💬 ${learnedItems().length}</b><span>fjalë (${course().name})</span></div>
        </div>
      </div>
      <div class="card">
        <h3>Javën e fundit</h3>
        <div class="chart">
          ${days
            .map((d) => {
              const v = S.daily[d] || 0;
              const h = Math.round((v / maxXp) * 100);
              const dt = new Date(d + "T12:00:00");
              return `<div class="bar-col"><span class="v">${v || ""}</span><div class="bar ${v >= S.settings.goal ? "hit" : ""}" style="height:${Math.max(h, 3)}%"></div><span class="d">${dn[dt.getDay()]}</span></div>`;
            })
            .join("")}
        </div>
      </div>
      <div class="card settings">
        <h3>Cilësimet</h3>
        <label class="row"><span>Qëllimi ditor</span>
          <select data-setting="goal">
            ${goalOpt(10, "Lehtë · 10 XP")}${goalOpt(20, "Normal · 20 XP")}${goalOpt(30, "Seriozisht · 30 XP")}${goalOpt(50, "Intensiv · 50 XP")}
          </select>
        </label>
        ${toggle("sound", "Efektet zanore")}
        ${toggle("tts", "Shqiptimi me zë")}
        <div class="btn-row">
          <button class="btn" data-act="export">⬇️ Ruaj progresin</button>
          <button class="btn" data-act="import">⬆️ Ngarko progresin</button>
        </div>
        <button class="btn danger-outline" data-act="reset">Fshi gjithë progresin</button>
      </div>`;
  }

  // ---------- Sesioni i mësimit ----------
  function startLesson(u, l) {
    syncHearts();
    if (S.settings.hearts && S.hearts <= 0) return renderNoHearts();
    const items = lessonItems(S.course, u, l);
    const q = makeLesson(S.course, items);
    session = { kind: "lesson", u, l, q, total: q.length, done: 0, wrong: 0, wrongIds: new Set(), start: Date.now() };
    nextExercise();
  }
  function startPractice() {
    const p = makePractice(S.course);
    if (!p) return;
    session = { kind: "practice", q: p.q, total: p.q.length, done: 0, wrong: 0, wrongIds: new Set(), start: Date.now() };
    nextExercise();
  }
  function nextExercise() {
    if (!session.q.length) return finishSession();
    session.cur = session.q.shift();
    session.state = { picked: null, built: [], checked: false, retry: !!session.cur.retry };
    render();
  }

  function promptHtml(e) {
    const it = e.item;
    switch (e.type) {
      case "pick":
        return e.dir === "toT"
          ? `<h2 class="q">Si thuhet <span class="hl">„${esc(it.sq)}”</span>?</h2>`
          : `<h2 class="q">Çfarë do të thotë kjo?</h2>${speakBubble(it.t)}`;
      case "build":
        return e.dir === "toT"
          ? `<h2 class="q">Përkthe këtë fjali</h2><div class="bubble">${esc(it.sq)}</div>`
          : `<h2 class="q">Përkthe në shqip</h2>${speakBubble(it.t)}`;
      case "listen":
        return `<h2 class="q">Shkruaj atë që dëgjon</h2>
          <div class="listen-btns">
            <button class="big-speaker" data-say="${esc(it.t)}" aria-label="Dëgjo">🔊</button>
            <button class="small-speaker" data-say-slow="${esc(it.t)}" aria-label="Dëgjo ngadalë">🐢</button>
          </div>`;
      case "type":
        return `<h2 class="q">Shkruaj në ${course().name.toLowerCase()}</h2><div class="bubble">${esc(it.sq)}</div>`;
      case "match":
        return `<h2 class="q">Gjej çiftet</h2>`;
    }
  }
  const speakBubble = (t) =>
    `<div class="bubble with-speaker"><button class="speak-sm" data-say="${esc(t)}" aria-label="Dëgjo">🔊</button>${esc(t)}</div>`;

  function answerAreaHtml(e) {
    const st = session.state;
    const dis = st.checked ? "disabled" : "";
    switch (e.type) {
      case "pick":
        return `<div class="options">${e.options
          .map(
            (o, i) =>
              `<button class="option ${st.picked === i ? "selected" : ""}" data-opt="${i}" ${dis}><kbd>${i + 1}</kbd>${esc(o)}</button>`
          )
          .join("")}</div>`;
      case "build":
      case "listen":
        return `
          <div class="answer-line">${st.built
            .map((bi, k) => `<button class="tile" data-unbuild="${k}" ${dis}>${esc(e.bank[bi])}</button>`)
            .join("")}</div>
          <div class="bank">${e.bank
            .map(
              (w, i) =>
                `<button class="tile ${st.built.includes(i) ? "ghost" : ""}" data-build="${i}" ${st.built.includes(i) || st.checked ? "disabled" : ""}>${esc(w)}</button>`
            )
            .join("")}</div>`;
      case "type":
        return `<textarea class="type-in" rows="2" placeholder="Shkruaj këtu…" autocapitalize="off" autocomplete="off" spellcheck="false" ${dis}>${esc(st.typed || "")}</textarea>`;
      case "match": {
        if (!st.match) {
          st.match = {
            left: shuffle(e.items.map((it) => it.id)),
            right: shuffle(e.items.map((it) => it.id)),
            sel: { L: null, R: null },
            solved: new Set(),
            bad: null,
          };
        }
        const m = st.match;
        const col = (side, ids, field) =>
          ids
            .map((id) => {
              const it = e.items.find((x) => x.id === id);
              const solved = m.solved.has(id);
              const sel = m.sel[side] === id;
              const bad = m.bad && m.bad[side] === id;
              return `<button class="tile match ${solved ? "solved" : ""} ${sel ? "selected" : ""} ${bad ? "bad" : ""}" data-match="${side}:${id}" ${solved ? "disabled" : ""}>${esc(it[field])}</button>`;
            })
            .join("");
        return `<div class="match-grid"><div>${col("L", m.left, "sq")}</div><div>${col("R", m.right, "t")}</div></div>`;
      }
    }
  }

  function renderExercise() {
    const e = session.cur;
    const st = session.state;
    const pct = Math.round((session.done / session.total) * 100);
    const hearts = S.settings.hearts && session.kind === "lesson" ? `❤️ ${S.hearts}` : "❤️ ∞";
    let canCheck = false;
    if (e.type === "pick") canCheck = st.picked !== null;
    else if (e.type === "build" || e.type === "listen") canCheck = st.built.length > 0;
    else if (e.type === "type") canCheck = (st.typed || "").trim().length > 0;

    let footer;
    if (st.checked) {
      footer = `
        <footer class="ex-foot ${st.ok ? "good" : "bad"}">
          <div class="verdict">
            <h3>${st.ok ? pickPraise() : "Jo saktë"}</h3>
            ${st.ok && st.note ? `<p>${esc(st.note)}</p>` : ""}
            ${!st.ok || st.showAnswer ? `<p><small>Përgjigja e saktë:</small><br><b>${esc(st.correct)}</b></p>` : ""}
          </div>
          <button class="btn ${st.ok ? "success" : "danger"} big" data-act="continue">VAZHDO</button>
        </footer>`;
    } else if (e.type === "match") {
      footer = `<footer class="ex-foot"><div></div></footer>`;
    } else {
      footer = `
        <footer class="ex-foot">
          ${e.type === "listen" ? `<button class="btn ghost" data-act="skip-listen">S'mund të dëgjoj tani</button>` : "<span></span>"}
          <button class="btn primary big" data-act="check" ${canCheck ? "" : "disabled"}>KONTROLLO</button>
        </footer>`;
    }

    app.innerHTML = `
      <div class="exercise">
        <div class="ex-head">
          <button class="x" data-act="quit" aria-label="Mbyll">✕</button>
          <div class="progress"><div style="width:${pct}%"></div></div>
          <div class="chip heart">${hearts}</div>
        </div>
        <div class="ex-body">
          ${session.kind === "practice" ? `<div class="tag">PRAKTIKË</div>` : ""}
          ${st.retry ? `<div class="tag warn">GABIM I MËPARSHËM</div>` : ""}
          ${promptHtml(e)}
          ${answerAreaHtml(e)}
        </div>
        ${footer}
      </div>`;

    const ta = app.querySelector(".type-in");
    if (ta && !st.checked) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    if (!st.spoken && !st.checked) {
      st.spoken = true;
      if (e.type === "listen" || ((e.type === "pick" || e.type === "build") && e.dir === "toS")) {
        setTimeout(() => speak(e.item.t), 250);
      }
    }
  }

  const PRAISE = ["Shkëlqyeshëm!", "Bravo!", "Saktë!", "Super!", "Perfekt!", "Vazhdo kështu!"];
  const pickPraise = () => session.state.praise || (session.state.praise = PRAISE[Math.floor(Math.random() * PRAISE.length)]);

  function doCheck() {
    const e = session.cur;
    const st = session.state;
    if (st.checked) return;
    const it = e.item;
    const c = course();
    let res;
    if (e.type === "pick") {
      res = { ok: e.options[st.picked] === e.answer };
      st.correct = e.answer;
    } else if (e.type === "build" || e.type === "listen") {
      const input = st.built.map((i) => e.bank[i]).join(" ");
      const toT = e.type === "listen" || e.dir === "toT";
      const answers = toT ? [it.t, ...it.alt] : [it.sq];
      res = check(input, answers, toT ? S.course : "sq", toT ? c.articles : null, false);
      st.correct = toT ? it.t : it.sq;
    } else if (e.type === "type") {
      res = check(st.typed || "", [it.t, ...it.alt], S.course, c.articles, true);
      st.correct = it.t;
      if (res.ok && res.note) st.showAnswer = true;
    }
    st.checked = true;
    st.ok = res.ok;
    st.note = res.note;
    grade(res.ok, it);
    render();
    if (res.ok && e.type !== "listen") speak(it.t);
  }

  function grade(ok, it) {
    const m = (S.mistakes[S.course] ||= {});
    beep(ok);
    if (ok) {
      session.done++;
      if (session.kind === "practice" && m[it.id]) {
        m[it.id]--;
        if (m[it.id] <= 0) delete m[it.id];
      }
    } else {
      session.wrong++;
      session.wrongIds.add(it.id);
      m[it.id] = (m[it.id] || 0) + 1;
      if (S.settings.hearts && session.kind === "lesson") {
        syncHearts();
        if (S.hearts === MAX_HEARTS) S.heartsTs = Date.now();
        S.hearts = Math.max(0, S.hearts - 1);
      }
      // Ushtrimi kthehet në fund të radhës
      const again = Object.assign({}, session.cur, { retry: true });
      session.q.push(again);
    }
    save();
  }

  function cont() {
    if (session.kind === "lesson" && S.settings.hearts && S.hearts <= 0) {
      session = null;
      return renderNoHearts(true);
    }
    nextExercise();
  }

  function onMatch(side, id) {
    const st = session.state;
    const m = st.match;
    const e = session.cur;
    m.bad = null;
    m.sel[side] = m.sel[side] === id ? null : id;
    if (side === "R" && m.sel.R) speak(e.items.find((x) => x.id === id).t);
    if (m.sel.L && m.sel.R) {
      if (m.sel.L === m.sel.R) {
        m.solved.add(m.sel.L);
        beep(true);
      } else {
        m.bad = { ...m.sel };
        m.mistakes = (m.mistakes || 0) + 1;
        beep(false);
        setTimeout(() => {
          if (session && session.state === st) {
            m.bad = null;
            render();
          }
        }, 450);
      }
      m.sel = { L: null, R: null };
    }
    if (m.solved.size === e.items.length) {
      session.done++;
      st.checked = true;
      st.ok = true;
      st.note = m.mistakes ? `${m.mistakes} gabim(e) gjatë çiftimit.` : "";
    }
    render();
  }

  function finishSession() {
    const s = session;
    session = null;
    const secs = Math.round((Date.now() - s.start) / 1000);
    const firstTry = s.total;
    const acc = Math.max(0, Math.round((firstTry / (firstTry + s.wrong)) * 100));
    let xp;
    if (s.kind === "lesson") {
      const key = `${s.u}-${s.l}`;
      prog()[key] = (prog()[key] || 0) + 1;
      xp = XP_LESSON + (s.wrong === 0 ? XP_PERFECT : 0);
    } else {
      xp = XP_PRACTICE;
      S.hearts = Math.min(MAX_HEARTS, S.hearts + 1);
    }
    const before = S.daily[dayKey()] || 0;
    const streakBefore = currentStreak();
    const wasToday = S.lastDay === dayKey();
    addXp(xp);
    const after = S.daily[dayKey()];
    const goalHit = before < S.settings.goal && after >= S.settings.goal;
    app.innerHTML = `
      <main class="scroll result">
        <div class="trophy">${s.wrong === 0 ? "🌟" : "🎉"}</div>
        <h1>${s.kind === "lesson" ? "Mësimi u përfundua!" : "Praktika u përfundua!"}</h1>
        ${s.wrong === 0 ? `<p class="sub">Pa asnjë gabim!${s.kind === "lesson" ? ` +${XP_PERFECT} XP bonus` : ""}</p>` : ""}
        <div class="result-stats">
          <div class="rs gold"><small>XP</small><b>⚡ ${xp}</b></div>
          <div class="rs green"><small>SAKTËSIA</small><b>🎯 ${acc}%</b></div>
          <div class="rs blue"><small>KOHA</small><b>⏱ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}</b></div>
        </div>
        ${!wasToday ? `<div class="card center streak-card">🔥 <b>${currentStreak()}</b> ${currentStreak() === 1 ? "ditë" : "ditë rresht"}${streakBefore ? "" : " — seria filloi!"}</div>` : ""}
        ${goalHit ? `<div class="card center goal-card">✅ E arrite qëllimin ditor prej ${S.settings.goal} XP!</div>` : ""}
        <button class="btn primary big" data-act="home">VAZHDO</button>
      </main>`;
    save();
  }

  function renderNoHearts(mid = false) {
    const mins = Math.ceil((HEART_REGEN_MS - (Date.now() - S.heartsTs)) / 60000);
    app.innerHTML = `
      <main class="scroll result">
        <div class="trophy">💔</div>
        <h1>${mid ? "Mbete pa zemra!" : "Nuk ke zemra"}</h1>
        <p class="sub">Zemra e radhës vjen pas ${mins} min. Ose praktiko për të fituar një zemër tani.</p>
        <button class="btn primary big" data-act="practice" ${learnedItems().length < 3 ? "disabled" : ""}>Praktiko (+1 ❤️)</button>
        <button class="btn big" data-act="home">Kthehu</button>
      </main>`;
  }

  // ---------- Ngjarjet ----------
  app.addEventListener("click", (ev) => {
    const t = ev.target.closest("button, [data-act]");
    if (!t || t.disabled) return;
    const d = t.dataset;

    if (d.say) return speak(d.say);
    if (d.saySlow) return speak(d.saySlow, true);
    if (d.course) {
      S.course = d.course;
      save();
      view = "learn";
      return render();
    }
    if (d.nav) {
      view = d.nav;
      return render();
    }
    if (d.lesson) {
      const [u, l] = d.lesson.split("-").map(Number);
      return startLesson(u, l);
    }
    if (session && d.opt !== undefined) {
      session.state.picked = Number(d.opt);
      speakIfTarget();
      return render();
    }
    if (session && d.build !== undefined) {
      session.state.built.push(Number(d.build));
      if (session.cur.type === "listen" || session.cur.dir === "toT") speak(session.cur.bank[Number(d.build)]);
      return render();
    }
    if (session && d.unbuild !== undefined) {
      session.state.built.splice(Number(d.unbuild), 1);
      return render();
    }
    if (session && d.match) {
      const [side, id] = d.match.split(":");
      return onMatch(side, id);
    }

    switch (d.act) {
      case "courses":
        return renderWelcome(true);
      case "close-courses":
      case "home":
        view = "learn";
        return render();
      case "check":
        return doCheck();
      case "continue":
        return cont();
      case "skip-listen": {
        // Kthe ushtrimin dëgjimor në ushtrim ndërtimi
        const it = session.cur.item;
        session.cur = ex.buildT(S.course, it);
        session.state = { picked: null, built: [], checked: false };
        return render();
      }
      case "quit":
        if (confirm("Të dalësh nga mësimi? Progresi i këtij mësimi do të humbasë.")) {
          session = null;
          speechSynthesis?.cancel?.();
          render();
        }
        return;
      case "practice":
        return startPractice();
      case "export": {
        const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `tikii-progresi-${dayKey()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        return;
      }
      case "import": {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "application/json,.json";
        inp.onchange = async () => {
          try {
            const data = JSON.parse(await inp.files[0].text());
            if (typeof data !== "object" || !data.settings) throw new Error();
            S = Object.assign(defaultState(), data);
            save();
            render();
            alert("Progresi u ngarkua!");
          } catch {
            alert("Skedari nuk është i vlefshëm.");
          }
        };
        inp.click();
        return;
      }
      case "reset":
        if (confirm("Je i sigurt? Gjithë progresi do të fshihet përgjithmonë.")) {
          S = defaultState();
          save();
          render();
        }
        return;
    }
  });

  function speakIfTarget() {
    const e = session.cur;
    if (e.type === "pick" && e.dir === "toT") speak(e.options[session.state.picked]);
  }

  app.addEventListener("input", (ev) => {
    if (ev.target.classList.contains("type-in") && session) {
      session.state.typed = ev.target.value;
      const btn = app.querySelector('[data-act="check"]');
      if (btn) btn.disabled = !ev.target.value.trim();
    }
  });
  app.addEventListener("change", (ev) => {
    const k = ev.target.dataset.setting;
    if (!k) return;
    S.settings[k] = ev.target.type === "checkbox" ? ev.target.checked : Number(ev.target.value);
    save();
    render();
  });

  document.addEventListener("keydown", (ev) => {
    if (!session) return;
    const st = session.state;
    const e = session.cur;
    if (ev.key === "Enter") {
      ev.preventDefault();
      if (st.checked) cont();
      else doCheck();
      return;
    }
    if (st.checked || e.type !== "pick" || ev.target.tagName === "TEXTAREA") return;
    const n = Number(ev.key);
    if (n >= 1 && n <= e.options.length) {
      st.picked = n - 1;
      speakIfTarget();
      render();
    }
  });

  // Rifreskon zemrat çdo minutë kur je në faqen kryesore
  setInterval(() => {
    if (!session && S.course && document.visibilityState === "visible" && S.hearts < MAX_HEARTS) {
      const h = S.hearts;
      syncHearts();
      if (h !== S.hearts && !app.querySelector("select:focus")) render();
    }
  }, 60000);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  render();
})();
