const APP_VERSION = "2026-03-01";

/**
 * GitHub Pages / subfolder-safe base resolver:
 * We derive the site root from the loaded /assets/app.js URL.
 */
function getSiteBaseUrl(){
  const scripts = Array.from(document.scripts || []);
  const app = scripts.find(s => s.src && s.src.includes("/assets/app.js")) || document.currentScript;
  const src = app && app.src ? app.src : null;
  if (src){
    const u = new URL(src, location.href);
    u.hash = "";
    u.search = "";
    // /.../assets/app.js  ->  /.../
    u.pathname = u.pathname.replace(/\/assets\/app\.js$/,"/");
    return u;
  }
  return new URL("./", location.href);
}
const SITE_BASE = getSiteBaseUrl();
const DATA_URL = new URL("data/people.json", SITE_BASE).toString();

function setTheme(theme){
  const t = theme || localStorage.getItem("theme") || "olive";
  document.documentElement.setAttribute("data-theme", t);
}

function initThemePicker(){
  setTheme();
  const footerRow = document.querySelector(".site-footer .footer-bottom");
  if (!footerRow) return;
  if (footerRow.querySelector("#themeSelect")) return;

  const wrap = document.createElement("span");
  wrap.className = "theme-ui";
  wrap.innerHTML = `
    <label class="sr" for="themeSelect">ערכת צבעים</label>
    <select id="themeSelect" class="theme-select" aria-label="ערכת צבעים">
      <option value="olive">Olive Grove</option>
      <option value="dusk">Jerusalem Dusk</option>
      <option value="stone">Eternal Stone</option>
      <option value="moonlit">Moonlit Teal</option>
    </select>
  `;
  footerRow.appendChild(wrap);

  const sel = wrap.querySelector("#themeSelect");
  sel.value = document.documentElement.getAttribute("data-theme") || "olive";
  sel.addEventListener("change", () => {
    setTheme(sel.value);
    localStorage.setItem("theme", sel.value);
  });
}

/**
 * Backend (אופציונלי)
 * כדי להפוך נרות + מילים ל”משותפים לכולם”, מומלץ לחבר Supabase.
 *
 * 1) צרו פרויקט ב-Supabase
 * 2) העתיקו את URL ואת ANON KEY לקובץ assets/backend-config.js (תבנית בהמשך)
 * 3) הריצו את ה-SQL שבקובץ SETUP_SUPABASE.md
 *
 * אם אין קונפיגורציה—האתר יעבוד במצב מקומי (localStorage) כמו קודם.
 */
function getBackendConfig(){
  return window.BACKEND || null;
}

function isSupabaseReady(){
  const cfg = getBackendConfig();
  return !!(cfg && cfg.provider === "supabase" && cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
}

function supa(){
  const cfg = getBackendConfig();
  return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function siteUrl(path){
  const clean = String(path || "").replace(/^\//, "");
  return new URL(clean, SITE_BASE).toString();
}

function showFatal(message, detail){
  console.error(detail || message);
  const main = document.querySelector("main");
  if (!main) return;

  let box = document.getElementById("fatal");
  if (!box){
    box = document.createElement("div");
    box.id = "fatal";
    box.className = "wrap";
    box.innerHTML = `
      <div class="card list">
        <h3>שגיאת טעינה</h3>
        <p class="muted">${escapeHtml(message || "אירעה שגיאה בטעינת הנתונים.")}</p>
        <p class="tiny muted" style="margin-top:10px;">
          אם זה GitHub Pages: ודאו שהאתר מצביע על תיקיית <strong>docs/</strong> ושקיימת <strong>data/people.json</strong>.
        </p>
      </div>
    `;
    main.prepend(box);
  } else {
    box.querySelector(".muted")?.replaceChildren(document.createTextNode(String(message || "")));
  }
}


// For safe insertion into HTML attributes (e.g. data-*).
function escapeAttr(s) {
  return escapeHtml(s).replaceAll("`", "&#96;");
}
function initialOfName(name) {
  const s = String(name ?? "")
    .replace(/["'״׳`]/g, "")
    .trim();
  return s ? s.slice(0, 1) : "•";
}

function safeDecodeURIComponent(s) {
  try {
    return decodeURIComponent(String(s));
  } catch (e) {
    return String(s);
  }
}


function prefersReducedMotion(){
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function prefersCoarsePointer(){
  return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
}

/* =======================
   Performance: Preconnect
   - CDN for Supabase JS
   - Supabase project origin (if configured)
======================= */
function ensurePreconnect(){
  const head = document.head;
  if (!head) return;

  const add = (href) => {
    try{
      const u = new URL(href, location.href);
      const origin = u.origin;
      if (head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = origin;
      link.crossOrigin = "anonymous";
      head.appendChild(link);
    }catch{}
  };

  add("https://cdn.jsdelivr.net");
  const cfg = getBackendConfig();
  if (cfg?.supabaseUrl) add(cfg.supabaseUrl);
}

/* =======================
   SEO / Social Sharing meta
   Notes:
   - Scrapers (WhatsApp/Facebook) usually DON'T run JS.
   - For best results, use the generated /p/* pages which bake the name in HTML.
======================= */
function updateSocialMeta({ title, description, url, image } = {}){
  const upsert = ({ name, property, content }) => {
    if (!content) return;
    const sel = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
    let el = document.head?.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      if (name) el.setAttribute("name", name);
      else el.setAttribute("property", property);
      document.head?.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  if (title) document.title = title;
  upsert({ name: "description", content: description });
  upsert({ property: "og:title", content: title });
  upsert({ property: "og:description", content: description });
  upsert({ property: "og:url", content: url });
  upsert({ property: "og:image", content: image });
  upsert({ name: "twitter:title", content: title });
  upsert({ name: "twitter:description", content: description });
  upsert({ name: "twitter:image", content: image });
}

/* =======================
   Fuzzy search (סלחני)
   - נירמול עברית (סופיות→רגילות, הסרת ניקוד, ניקוי גרשיים)
   - התאמה לפי טוקנים
   - “דמיון ביגרמים” לתיקון שגיאות
======================= */
function normalizeHebrew(input){
  const s = String(input ?? "")
    .toLowerCase()
    // remove niqqud + cantillation
    .replace(/[\u0591-\u05C7]/g, "")
    // normalize quotes/geresh
    .replace(/[\"'״׳`]/g, "")
    .replace(/[-_.,;:!?()\[\]{}\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "";
  const finals = { "ך":"כ", "ם":"מ", "ן":"נ", "ף":"פ", "ץ":"צ" };
  return s.replace(/[ךםןףץ]/g, (ch) => finals[ch] || ch);
}
function bigramSet(s){
  const t = normalizeHebrew(s).replace(/\s+/g, " ");
  const out = new Set();
  if (t.length < 2) return out;
  for (let i=0;i<t.length-1;i++){
    const a=t[i], b=t[i+1];
    if (a === " " || b === " ") continue;
    out.add(a+b);
  }
  return out;
}
function jaccard(aSet, bSet){
  if (!aSet.size || !bSet.size) return 0;
  let inter = 0;
  for (const x of aSet) if (bSet.has(x)) inter += 1;
  const union = aSet.size + bSet.size - inter;
  return union ? inter/union : 0;
}
function fuzzyMatch(haystackNorm, nameNorm, query){
  const qNorm = normalizeHebrew(query);
  if (!qNorm) return true;

  const qTokens = qNorm.split(/\s+/).filter(Boolean);
  if (!qTokens.length) return true;

  const hay = String(haystackNorm || "");
  let hit = 0;
  for (const t of qTokens) if (hay.includes(t)) hit += 1;

  // strict tokens match
  if (hit === qTokens.length) return true;

  // forgiving: if most tokens match, accept.
  if (qTokens.length >= 2 && hit >= qTokens.length - 1) return true;

  // typo tolerance: bigram similarity against name
  const sim = jaccard(bigramSet(nameNorm || ""), bigramSet(qNorm));
  return sim >= 0.42;
}


/**
 * Heuristic filter for "list pages" that only include the person's name among many others
 * (e.g. "שמות ההרוגים", "Victims of...", tag/category pages).
 * We hide these by default, but allow toggling them open.
 */
function isListOnlyArticle(article, personName) {
  const title = String(article?.title || "");
  const url = String(article?.url || "");
  const decodedUrl = safeDecodeURIComponent(url);
  const hay = `${title} ${decodedUrl}`;

  const listTitleRe =
    /(שמות\s+(?:ההרוגים|הנרצחים|החללים|הנופלים)|רשימת\s+(?:ההרוגים|הנרצחים|החללים|הנופלים)|כל\s+שמות|כל\s+ה(?:הרוגים|נרצחים|חללים|נופלים)|חללי\s+מלחמת|נופלי\s+מלחמת|הרוגי\s+מלחמת|Names?\s+of\s+the\s+(?:Fallen|Killed|Victims)|Victims?\s+of\s+(?:the\s+)?(?:War|Iron\s+Swords|Oct\.?\s*7))/i;

  const listUrlRe =
    /(\/tag\/|\/tags\/|\/category\/|\/archive\/|\/topics\/|\/projects\/.*victims|\/names|\/victims|\/fallen|\/killed|שמות-?(?:ההרוגים|הנרצחים|החללים|הנופלים))/i;

  const looksListy = listTitleRe.test(hay) || listUrlRe.test(decodedUrl);
  if (!looksListy) return false;

  // If the article clearly contains the person's name (2+ tokens), keep it.
  const tokens = String(personName || "")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  let hits = 0;
  for (const t of tokens) {
    if (title.includes(t) || decodedUrl.includes(t)) hits += 1;
  }

  return hits < 2;
}
function renderListOnlySection(listOnlyArticles) {
  return `
    <div class="muted tiny" style="margin-top: 14px;">
      הוסתרו ${listOnlyArticles.length} קישורים שהם רשימות שמות ללא מידע על האדם.
      <button type="button" id="toggle-list-only" class="badge" style="cursor:pointer; margin-inline-start:6px;">הצג</button>
    </div>
    <div id="list-only" style="display:none; margin-top: 10px;">
      <div class="grid article-grid">
        ${listOnlyArticles
          .map(
            (a) => `
          <article class="card article">
            <h3>${escapeHtml(a.title || a.source || a.url)}</h3>
            ${a.source ? `<div class="meta">${escapeHtml(a.source)}</div>` : ""}
            <a class="btn" href="${escapeAttr(a.url)}" target="_blank" rel="noopener">פתח קישור</a>
          </article>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

function setYear() {
  const y = document.getElementById("y");
  if (y) y.textContent = String(new Date().getFullYear());
}

function bindMenu() {
  const btn = document.querySelector(".menu-btn");
  const nav = document.getElementById("site-nav");
  if (!btn || !nav) return;

  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", String(open));
  });

  nav.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    nav.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("click", (e) => {
    if (!nav.classList.contains("is-open")) return;
    const within = e.target.closest("#site-nav") || e.target.closest(".menu-btn");
    if (!within) {
      nav.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

function setActiveNav() {
  const nav = document.getElementById("site-nav");
  if (!nav) return;
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  nav.querySelectorAll("a.pill").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    a.classList.toggle("is-active", href === path);
  });
}

async function loadPeople() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("לא ניתן לטעון את רשימת האנשים. נסו לרענן.");
  return await res.json();
}

function unique(arr) { return Array.from(new Set(arr)); }

// a11y: Canvas is visual-only. Provide a hidden HTML list for screen readers.
function renderCanvasAltList(people){
  const ul = document.getElementById("a11yList");
  if (!ul || !Array.isArray(people)) return;

  const sorted = people.slice().sort((a,b)=>{
    const pl = String(a.place||"").localeCompare(String(b.place||""), "he");
    if (pl) return pl;
    return String(a.name||"").localeCompare(String(b.name||""), "he");
  });

  ul.innerHTML = sorted.map(p => {
    const href = `p/${encodeURIComponent(p.id)}.html`;
    const label = `${p.name} — ${p.place}`;
    return `<li><a href="${escapeAttr(href)}">${escapeHtml(label)}</a></li>`;
  }).join("");
}

function colorForPlace(place) {
  const palette = [
    "rgba(96,165,250,0.95)",
    "rgba(59,130,246,0.95)",
    "rgba(147,197,253,0.95)",
    "rgba(99,102,241,0.95)",
    "rgba(14,165,233,0.95)",
    "rgba(125,211,252,0.95)"
  ];
  let h = 0;
  for (const ch of place) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/* טקסט פתיחה ייחודי לדפי יישוב */
const PLACE_INTRO = {
  "כפר עזה": "עמוד זה מרכז יחד את דפי הזיכרון של מי שהיו חלק מקהילת כפר עזה. אפשר לעבור לדף האישי, להדליק נר ולכתוב כמה מילים — בשקט ובכבוד.",
  "נחל עוז": "עמוד זה מרכז יחד את דפי הזיכרון של מי שהיו חלק מקהילת נחל עוז. נוכחותם נשארת איתנו — בזיכרון, בסיפורים, ובקהילה.",
  "ארז": "עמוד זה מרכז יחד את דפי הזיכרון של מי שהיו חלק מקהילת ארז.",
  "גבים": "עמוד זה מרכז יחד את דפי הזיכרון של מי שהיו חלק מקהילת גבים.",
  "יכיני": "עמוד זה מרכז יחד את דפי הזיכרון של מי שהיו חלק מקהילת יכיני.",
  "ניר עם": "עמוד זה מרכז יחד את דפי הזיכרון של מי שהיו חלק מקהילת ניר עם."
};

function placeSlug(place){
  const map = {
    "ארז":"arez",
    "גבים":"gavim",
    "יכיני":"yakhini",
    "כפר עזה":"kfar-aza",
    "נחל עוז":"nahal-oz",
    "ניר עם":"nir-am"
  };
  return map[place] || encodeURIComponent(place);
}

function placeIntro(place){
  return PLACE_INTRO[place] || `עמוד זה מרכז יחד את דפי הזיכרון של מי שהיו חלק מקהילת ${place}.`;
}

/* =======================
   דף הבית – שדה אורות
======================= */
async function initField() {
  const canvas = document.getElementById("field");
  const wrap = document.querySelector(".canvas-wrap");
  const tooltip = document.getElementById("tooltip");
  const placeSelect = document.getElementById("filterPlace");
  const searchInput = document.getElementById("searchName");
  if (!canvas || !wrap) return;

  const reduceMotion = prefersReducedMotion();
  const coarsePointer = prefersCoarsePointer();

  // a11y: make canvas focusable even if markup forgot tabindex
  try{
    canvas.setAttribute("tabindex", "0");
    if (canvas.tabIndex < 0) canvas.tabIndex = 0;
  }catch{}

  const people = await loadPeople();
  renderCanvasAltList(people);
  const counts = new Map();
  for (const p of people) counts.set(p.place, (counts.get(p.place) || 0) + 1);
  const places = unique(people.map(p => p.place)).sort((a,b)=>a.localeCompare(b,"he"));

  if (placeSelect) {
    placeSelect.innerHTML =
      `<option value="">כל היישובים</option>` +
      // 'counts2' is used elsewhere in a different scope; here we want the
      // per-place counts map defined above in this function.
      places.map(pl => `<option value="${escapeHtml(pl)}">${escapeHtml(pl)} (${counts.get(pl) || 0})</option>`).join("");
  }

  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = window.devicePixelRatio || 1;

  const view = { scale: 1, tx: 0, ty: 0, maxScale: 2.8 };
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const clampView = () => {
    const maxX = (view.scale - 1) * w * 0.55;
    const maxY = (view.scale - 1) * h * 0.55;
    view.tx = clamp(view.tx, -maxX, maxX);
    view.ty = clamp(view.ty, -maxY, maxY);
  };
  const toScreen = (wx, wy) => ({
    x: (wx - w/2) * view.scale + w/2 + view.tx,
    y: (wy - h/2) * view.scale + h/2 + view.ty
  });
  const toWorld = (sx, sy) => ({
    x: (sx - view.tx - w/2) / view.scale + w/2,
    y: (sy - view.ty - h/2) / view.scale + h/2
  });

  const centers = new Map();
  const R = 0.28;
  places.forEach((pl, i) => {
    const a = (i / Math.max(places.length,1)) * Math.PI * 2;
    centers.set(pl, { ax: 0.5 + Math.cos(a)*R, ay: 0.52 + Math.sin(a)*R });
  });

  // By default, showing every single person dot can become visually noisy.
  // When no filters are selected, we render a cleaner "place summary" view:
  // one bubble per place (size ~= number of people). Clicking a bubble (or
  // selecting a place in the dropdown) switches back to detailed people view.
  const isSummaryMode = () => {
    const pl = (placeSelect?.value || "").trim();
    const q = (searchInput?.value || "").trim();
    return !pl && !q;
  };
  const buildSummaryNodes = () => {
    const list = [];
    for (const pl of places) {
      const c = centers.get(pl);
      if (!c) continue;
      const cnt = counts.get(pl) || 0;

      // radius in px: grows with sqrt(count), clamped
      const minR = coarsePointer ? 22 : 18;
      const maxR = coarsePointer ? 76 : 68;
      const rPx = Math.max(minR, Math.min(maxR, 14 + Math.sqrt(cnt) * (coarsePointer ? 8 : 7)));

      // slightly softer than person dots
      const col = colorForPlace(pl).replace(/0\.95\)/, "0.70)");
      const nameNorm = normalizeHebrew(pl);

      list.push({
        kind: "place",
        id: pl,
        place: pl,
        name: pl,
        count: cnt,
        x: c.ax,
        y: c.ay,
        r: rPx / (w || 1000),
        col,
        _nameNorm: nameNorm,
        _hayNorm: nameNorm,
      });
    }
    return list;
  };

  const rBase = coarsePointer ? 0.0086 : 0.0065;
  const rJit  = coarsePointer ? 0.0042 : 0.0030;

  let nodes = people.map((p) => {
    const c = centers.get(p.place) || { ax: 0.5, ay: 0.52 };
    const jx = (Math.random() - 0.5) * 0.18;
    const jy = (Math.random() - 0.5) * 0.18;
    const nameNorm = normalizeHebrew(p.name);
    const placeNorm = normalizeHebrew(p.place);
    const descNorm = normalizeHebrew(p.desc || p.context || "");
    const hayNorm = (nameNorm + ' ' + placeNorm + ' ' + descNorm).trim();
    return {
      ...p,
            x: c.ax + jx,
      y: c.ay + jy,
      r: rBase + Math.random()*rJit,
      col: colorForPlace(p.place),
      t: Math.random()*1000,
      _nameNorm: nameNorm,
      _hayNorm: hayNorm,
    };
  });

  function resize() {
    w = wrap.clientWidth;
    h = wrap.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
    clampView();
  }

  function relax(iter=40) {
    for (let k=0; k<iter; k++) {
      for (let i=0; i<nodes.length; i++) {
        const a = nodes[i];
        const ca = centers.get(a.place) || { ax:0.5, ay:0.52 };
        a.x += (ca.ax - a.x)*0.008;
        a.y += (ca.ay - a.y)*0.008;

        for (let j=i+1; j<nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy) || 1e-6;
          const min = (a.r + b.r) * 1.8;
          if (dist < min) {
            const push = (min - dist) * 0.02;
            const ux = dx/dist, uy = dy/dist;
            a.x += ux*push; a.y += uy*push;
            b.x -= ux*push; b.y -= uy*push;
          }
        }
        a.x = Math.min(0.98, Math.max(0.02, a.x));
        a.y = Math.min(0.98, Math.max(0.02, a.y));
      }
    }
  }

  function filteredNodes() {
    const pl = (placeSelect?.value || "").trim();
    const q = (searchInput?.value || "").trim();

    // default: show per-place summary bubbles
    if (isSummaryMode()) return buildSummaryNodes();

    let arr = nodes;
    if (pl) arr = arr.filter(n => n.place === pl);
    if (q) {
      arr = arr.filter(n => fuzzyMatch(n._hayNorm || normalizeHebrew(`${n.name||''} ${n.place||''} ${n.desc || n.context || ''}`), n._nameNorm || normalizeHebrew(n.name||''), q));
    }
    return arr;
  }

  let hover = null;

  function draw(ts) {
    ctx.clearRect(0,0,w,h);

    // Light, subtle background that works on both dark & light page themes
    const g = ctx.createRadialGradient(w*0.48,h*0.40, 0, w*0.55,h*0.55, Math.max(w,h)*0.95);
    g.addColorStop(0, "rgba(96,165,250,0.06)");
    g.addColorStop(1, "rgba(0,0,0,0.00)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    const list = filteredNodes();
    const summary = isSummaryMode();

    const setA = (col, a) => col.replace(/0\.\d+\)/, `${a})`);

    // labels
    if (summary) {
      // Larger summary label for better readability
      ctx.font = "800 16px Heebo, system-ui, -apple-system, Segoe UI, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(17,24,39,0.78)";
      ctx.shadowColor = "rgba(15,23,42,0.10)";
      ctx.shadowBlur = 6;
      for (const pl of places) {
        const c = centers.get(pl);
        if (!c) continue;
        const cnt = counts.get(pl) || 0;
        const pos = toScreen(c.ax*w, c.ay*h);
        ctx.fillText(`${pl} · ${cnt}`, pos.x, pos.y);
      }
      ctx.shadowBlur = 0;
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    } else {
      ctx.globalAlpha = 0.34;
      // Larger cluster label for place names
      ctx.font = "700 16px Heebo, system-ui, -apple-system, Segoe UI, Arial";
      ctx.fillStyle = "rgba(17,24,39,0.72)";
      ctx.textAlign = "center";
      for (const pl of places) {
        if (placeSelect?.value && placeSelect.value !== pl) continue;
        const c = centers.get(pl);
        if (!c) continue;
        const pos = toScreen(c.ax*w, c.ay*h);
        ctx.fillText(pl, pos.x, pos.y - 12*view.scale);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
    }

    // dots / bubbles
    for (const n of list) {
      const wx = n.x*w, wy = n.y*h;
      const { x, y } = toScreen(wx, wy);
      const pulse = reduceMotion ? 1 : (0.78 + 0.22*Math.sin((ts*0.0008) + (n.t||0)));

      if (n.kind === "place") {
        const rr = (n.r*w) * view.scale * (0.98 + pulse*0.04);
        const glow = rr * 1.75;

        // soft glow
        const gg = ctx.createRadialGradient(x,y,rr*0.10,x,y,glow);
        gg.addColorStop(0, setA(n.col, 0.32));
        gg.addColorStop(1, setA(n.col, 0.00));
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(x,y,glow,0,Math.PI*2); ctx.fill();

        // main bubble (lighter fill + colored stroke)
        ctx.shadowColor = setA(n.col, 0.18);
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = setA(n.col, 0.16);
        ctx.beginPath(); ctx.arc(x,y,rr,0,Math.PI*2); ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = setA(n.col, 0.55);
        ctx.lineWidth = Math.max(1, rr*0.06);
        ctx.beginPath(); ctx.arc(x,y,rr,0,Math.PI*2); ctx.stroke();

        // core dot
        ctx.fillStyle = setA(n.col, 0.92);
        ctx.beginPath(); ctx.arc(x,y,Math.max(3, rr*0.11),0,Math.PI*2); ctx.fill();
        continue;
      }

      const rr = (n.r*w) * view.scale * (0.92 + pulse*0.10);
      const outer = rr * 2.9;
      const gg = ctx.createRadialGradient(x,y,rr*0.18,x,y,outer);
      gg.addColorStop(0, setA(n.col, 0.70));
      gg.addColorStop(1, setA(n.col, 0.05));
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(x,y,outer,0,Math.PI*2); ctx.fill();

      ctx.fillStyle = n.col;
      ctx.beginPath(); ctx.arc(x,y,rr,0,Math.PI*2); ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x,y,rr,0,Math.PI*2); ctx.stroke();
    }

    // hover ring
    if (hover) {
      const base = hover.r*w;
      const pos = toScreen(hover.x*w, hover.y*h);
      const ringWorld = (hover.kind === "place") ? base * 1.55 : base * 3.2;
      const ring = ringWorld * view.scale;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(20,184,166,0.55)";
      ctx.lineWidth = 1;
      ctx.arc(pos.x, pos.y, ring, 0, Math.PI*2);
      ctx.stroke();
    }

    if (!reduceMotion) requestAnimationFrame(draw);
  }

  function pick(mx, my) {
    const list = filteredNodes();
    const wpt = toWorld(mx, my);
    let best = null, bestD = Infinity;
    for (const n of list) {
      const x = n.x*w, y = n.y*h;
      const d = Math.hypot(wpt.x-x, wpt.y-y);
      const base = (n.r*w);
      const hit = (n.kind === 'place')
        ? (base * (coarsePointer ? 1.55 : 1.35))
        : (base * (coarsePointer ? 3.8 : 3.2));
      if (d < hit && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  function tooltipShow(n, mx, my) {
    if (!tooltip) return;
    if (n.kind === 'place') {
      tooltip.innerHTML = `<strong>${escapeHtml(n.place)}</strong>`
        + `<span>${escapeHtml(String(n.count || 0))} אנשים</span>`
        + `<div style="opacity:.75;font-size:12px;margin-top:4px">לחיצה כדי להיכנס</div>`;
    } else {
      tooltip.innerHTML = `<strong>${escapeHtml(n.name)}</strong><span>${escapeHtml(n.place)}</span>`;
    }
    tooltip.style.left = mx + "px";
    tooltip.style.top = my + "px";
    tooltip.style.opacity = "1";
  }
  function tooltipHide() { if (tooltip) tooltip.style.opacity = "0"; }

  relax(28);
  resize();
  window.addEventListener("resize", resize);

  let suppressClickUntil = 0;

  canvas.addEventListener("mousemove", (e) => {
    if (suppressClickUntil && Date.now() < suppressClickUntil) {
      return;
    }
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const hit = pick(mx, my);
    hover = hit;
    if (hit) tooltipShow(hit, mx, my);
    else tooltipHide();
  });
  canvas.addEventListener("mouseleave", () => { hover = null; tooltipHide(); });


  // Touch: pan / pinch zoom + tap
  canvas.style.touchAction = "none";
  const pointers = new Map(); // id -> {x,y} in canvas coords
  const getCanvasPt = (ev) => {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  const dist = (a,b)=> Math.hypot(a.x-b.x, a.y-b.y);

  const gesture = {
    mode: "none", // 'pan' | 'pinch'
    moved: false,
    startScale: 1,
    startTx: 0,
    startTy: 0,
    startDist: 0,
    startCenter: null,
    worldCenter: null,
  };

  const startPinch = () => {
    const pts = Array.from(pointers.values());
    if (pts.length !== 2) return;
    gesture.mode = "pinch";
    gesture.moved = false;
    gesture.startScale = view.scale;
    gesture.startTx = view.tx;
    gesture.startTy = view.ty;
    gesture.startDist = dist(pts[0], pts[1]) || 1;
    gesture.startCenter = { x:(pts[0].x+pts[1].x)/2, y:(pts[0].y+pts[1].y)/2 };
    gesture.worldCenter = toWorld(gesture.startCenter.x, gesture.startCenter.y);
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    pointers.set(e.pointerId, getCanvasPt(e));
    gesture.moved = false;

    if (pointers.size === 2) {
      startPinch();
      suppressClickUntil = Date.now() + 450;
    } else {
      gesture.mode = "pan";
      gesture.startTx = view.tx;
      gesture.startTy = view.ty;
      suppressClickUntil = 0;
    }
  }, { passive: true });

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") return;
    if (!pointers.has(e.pointerId)) return;

    const pt = getCanvasPt(e);
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, pt);

    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    if (Math.hypot(dx, dy) > 3) gesture.moved = true;

    if (pointers.size === 1 && gesture.mode === "pan") {
      view.tx += dx;
      view.ty += dy;
      clampView();
      hover = null; tooltipHide();
      suppressClickUntil = Date.now() + 450;
      return;
    }

    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const center = { x:(pts[0].x+pts[1].x)/2, y:(pts[0].y+pts[1].y)/2 };
      const d = dist(pts[0], pts[1]) || 1;
      const ratio = d / (gesture.startDist || 1);
      const nextScale = clamp(gesture.startScale * ratio, 1, view.maxScale);

      // keep the content under the pinch center stable
      view.scale = nextScale;
      const wc = gesture.worldCenter || toWorld(center.x, center.y);
      view.tx = center.x - ((wc.x - w/2) * view.scale + w/2);
      view.ty = center.y - ((wc.y - h/2) * view.scale + h/2);
      clampView();

      hover = null; tooltipHide();
      suppressClickUntil = Date.now() + 450;
    }
  }, { passive: true });

  const endPointer = (e) => {
    if (e.pointerType === "mouse") return;
    pointers.delete(e.pointerId);

    if (pointers.size === 1) {
      // transition from pinch back to pan
      gesture.mode = "pan";
    }

    if (pointers.size === 0) {
      const pt = getCanvasPt(e);

      // tap -> pick
      if (!gesture.moved) {
        const hit = pick(pt.x, pt.y);
        hover = hit;
        if (hit) {
          tooltipShow(hit, pt.x, pt.y);
          if (hit.kind === "place") {
            placeSelect.value = hit.place;
            placeSelect.dispatchEvent(new Event("change"));
          } else {
            location.href = siteUrl(`p/${encodeURIComponent(hit.id)}.html`);
          }
        } else {
          tooltipHide();
        }
      }

      gesture.mode = "none";
      gesture.moved = false;
      suppressClickUntil = Date.now() + 450;
    }
  };

  canvas.addEventListener("pointerup", endPointer, { passive: true });
  canvas.addEventListener("pointercancel", endPointer, { passive: true });

  canvas.addEventListener("click", (e) => {
    if (suppressClickUntil && Date.now() < suppressClickUntil) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const hit = pick(mx, my);
    if (!hit) return;
    if (hit.kind === "place") {
      placeSelect.value = hit.place;
      placeSelect.dispatchEvent(new Event("change"));
      return;
    }
    location.href = siteUrl(`p/${encodeURIComponent(hit.id)}.html`);
  });



  const invalidate = () => { if (reduceMotion) draw(performance.now()); };

  // Keyboard navigation (a11y)
  let kbIndex = -1;
  const focusFilters = () => {
    (searchInput || placeSelect)?.focus();
  };
  const focusNodeAt = (idx) => {
    const list = filteredNodes();
    if (!list.length) return;
    kbIndex = ((idx % list.length) + list.length) % list.length;
    hover = list[kbIndex];
    const pos = toScreen(hover.x*w, hover.y*h);
    tooltipShow(hover, clamp(pos.x, 0, w), clamp(pos.y, 0, h));
    invalidate();
  };

  canvas.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      hover = null; tooltipHide(); kbIndex = -1;
      focusFilters();
      invalidate();
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      focusNodeAt(kbIndex + (e.shiftKey ? -1 : 1));
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      if (!hover) return;
      e.preventDefault();
      if (hover.kind === "place") {
        placeSelect.value = hover.place;
        placeSelect.dispatchEvent(new Event("change"));
        focusFilters();
        return;
      }
      location.href = `p/${encodeURIComponent(hover.id)}.html`;
      return;
    }

    // Optional: zoom with keyboard
    if (e.key === "+" || e.key === "=") {
      view.scale = clamp(view.scale * 1.12, 1, view.maxScale);
      clampView();
      invalidate();
    }
    if (e.key === "-" || e.key === "_") {
      view.scale = clamp(view.scale / 1.12, 1, view.maxScale);
      clampView();
      invalidate();
    }
  });
  document.getElementById("goPeople")?.addEventListener("click", () => location.href = siteUrl("people.html"));
  document.getElementById("goPlaces")?.addEventListener("click", () => location.href = siteUrl("places.html"));

  placeSelect?.addEventListener("change", () => { hover = null; tooltipHide(); kbIndex = -1; if (reduceMotion) draw(performance.now()); });
  searchInput?.addEventListener("input", () => { hover = null; tooltipHide(); kbIndex = -1; if (reduceMotion) draw(performance.now()); });

  requestAnimationFrame(draw);
}

/* =======================
   people.html – רשימה מלאה
======================= */
async function initPeopleList() {
  const root = document.getElementById("peopleRoot");
  const search = document.getElementById("peopleSearch");
  const placeSelect = document.getElementById("peoplePlace");
  if (!root) return;

  const people = await loadPeople();

  // fuzzy-search index
  for (const p of people) {
    p._nameNorm = normalizeHebrew(p.name);
    const plNorm = normalizeHebrew(p.place);
    const ctxNorm = normalizeHebrew(p.context || '');
    p._hayNorm = (p._nameNorm + ' ' + plNorm + ' ' + ctxNorm).trim();
  }

  const counts2 = new Map();
  for (const p of people) counts2.set(p.place, (counts2.get(p.place) || 0) + 1);
  const places = unique(people.map(p=>p.place)).sort((a,b)=>a.localeCompare(b,"he"));

  if (placeSelect) {
    placeSelect.innerHTML =
      `<option value="">כל היישובים</option>` +
      places.map(pl => `<option value="${escapeHtml(pl)}">${escapeHtml(pl)} (${counts2.get(pl) || 0})</option>`).join("");
  }

  function render() {
    const q = (search?.value || "").trim();
    const pl = (placeSelect?.value || "");
    const list = people.filter(p => {
      const okPlace = !pl || p.place === pl;
      const okName = !q || fuzzyMatch(p._hayNorm, p._nameNorm, q);
      return okPlace && okName;
    });

    if (!list.length){
      root.innerHTML = `
        <div class="card list empty-state">
          <h3>לא נמצאו תוצאות</h3>
          <p class="muted">נסו איות אחר, או הסירו סינון לפי יישוב.</p>
        </div>
      `;
      const count = document.getElementById("peopleCount");
      if (count) count.textContent = `0 מתוך ${people.length}`;
      return;
    }

    root.innerHTML = list.map(p => {
      const place = p.place ? `יישוב: ${escapeHtml(p.place)}` : "";
      const initial = initialOfName(p.name);
      const context = p.context ? escapeHtml(p.context) : "";
      return `
      <article class="card person-card">
        <div class="person-main">
          <div class="person-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
          <div class="person-info">
            <div class="person-meta">${place}</div>
            <h3 class="person-name">${escapeHtml(p.name)}</h3>
            ${context ? `<div class="small">${context}</div>` : ``}
          </div>
        </div>
        <div class="person-art" title="כאן אפשר להוסיף איור/ציור קווי בהמשך">
          <div class="art-initials">${escapeHtml(initial)}</div>
          <div class="art-hint">איור</div>
        </div>
        <div class="person-cta">
          <a class="btn primary" href="${escapeAttr(siteUrl(`p/${p.id}.html`))}">לפתיחה</a>
        </div>
      </article>`;
    }).join("");

    const count = document.getElementById("peopleCount");
    if (count) count.textContent = `${list.length} מתוך ${people.length}`;
  }

  search?.addEventListener("input", render);
  placeSelect?.addEventListener("change", render);
  render();
}

/* =======================
   places.html – יישובים
======================= */
async function initPlaces() {
  const root = document.getElementById("placesRoot");
  if (!root) return;

  const people = await loadPeople();
  const map = new Map();
  for (const p of people) map.set(p.place, (map.get(p.place) || 0) + 1);

  const places = Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0],"he"));

  root.innerHTML = places.map(([pl, n]) => `
    <article class="card place-card">
      <div class="person-meta"><span>יישוב</span><span>${n} אנשים</span></div>
      <h3>${escapeHtml(pl)}</h3>
      <p class="muted">עמוד שמרכז את כולם יחד תחת היישוב.</p>
      <a class="readmore" href="${escapeAttr(siteUrl(`place/${encodeURIComponent(placeSlug(pl))}.html`))}">לדף היישוב →</a>
    </article>
  `).join("");

  const total = document.getElementById("totalCount");
  if (total) total.textContent = `${people.length}`;
}

/* =======================
   place.html – דף יישוב
======================= */
async function initPlacePage() {
  const title = document.getElementById("placeTitle");
  const sub = document.getElementById("placeSub");
  const intro = document.getElementById("placeIntro");
  const root = document.getElementById("placePeople");
  const pl = (window.PLACE_NAME || qs("place"));

  if (!title || !root) return;
  if (!pl) { title.textContent = "יישוב לא נבחר"; return; }

  const people = await loadPeople();
  const list = people.filter(p => p.place === pl);

  title.textContent = pl;
  if (sub) sub.textContent = `${list.length} אנשים`;
  if (intro) intro.textContent = placeIntro(pl);

  try{
    const t = `אתר הנצחה | ${pl}`;
    const d = `עמוד יישוב שמרכז יחד את דפי הזיכרון של קהילת ${pl}.`;
    const img = new URL("assets/default-share-image.png", document.baseURI).href;
    updateSocialMeta({ title: t, description: d, url: location.href, image: img });
  }catch{}

  root.innerHTML = list.map(p => `
    <article class="card person-card">
      <div class="person-meta"><span>${escapeHtml(pl)}</span><span>דף אישי</span></div>
      <h3>${escapeHtml(p.name)}</h3>
      <p class="muted">ספר זיכרון דיגיטלי.</p>
      <a class="readmore" href="${escapeAttr(siteUrl(`p/${encodeURIComponent(p.id)}.html`))}">לספר הזיכרון →</a>
    </article>
  `).join("");
}

/* =======================
   person.html – דף אישי
======================= */
function loadLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveLocal(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function ymdNow(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

async function initPersonPage() {
  const id = (window.PERSON_ID || qs("id"));
  const nameEl = document.getElementById("personName");
  const placeLink = document.getElementById("placeLink");
  const candle = document.getElementById("candle");
  const candleCount = document.getElementById("candleCount");
  const candleBtn = document.getElementById("candleBtn");
  const shareBtn = document.getElementById("shareBtn");
  const guestList = document.getElementById("guestList");
  const guestForm = document.getElementById("guestForm");
  const articlesRoot = document.getElementById("articlesRoot");
  const backendNote = document.getElementById("backendNote");

  if (!nameEl || !id) return;

  const people = await loadPeople();
  const person = people.find(p => p.id === id);
  if (!person) { nameEl.textContent = "לא נמצא אדם"; return; }

  nameEl.textContent = person.name;
  if (placeLink) {
    placeLink.href = siteUrl(`place/${encodeURIComponent(placeSlug(person.place))}.html`);
    placeLink.textContent = person.place;
  }

  // Best-effort client-side meta update (SSR/SSG is still recommended for scrapers)
  try{
    const t = `אתר הנצחה | ${person.name}`;
    const d = `עמוד זיכרון והדלקת נר לזכר ${person.name}.`;
    const img = new URL("assets/default-share-image.png", document.baseURI).href;
    updateSocialMeta({ title: t, description: d, url: location.href, image: img });
  }catch{}

  const usingShared = isSupabaseReady();
  if (backendNote) {
    backendNote.textContent = usingShared
      ? "מצב משותף פעיל: נרות ומילים נשמרים לכל המבקרים (בכפוף לאישור)."
      : "מצב מקומי: נרות ומילים נשמרים רק במכשיר שלך. כדי לשתף לכולם – חבר/י Supabase (ראה אודות).";

  // העתקת קישור (נוח לשיתוף)
  shareBtn?.addEventListener("click", async () => {
    try{
      await navigator.clipboard.writeText(location.href);
      shareBtn.textContent = "הועתק!";
      setTimeout(()=> shareBtn.textContent = "העתקת קישור", 1200);
    }catch{
      // fallback
      prompt("העתיקו את הקישור:", location.href);
    }
  });
  }

  // ========= נרות =========
  const localLitKey = `lit_${id}`;
  const localCountKey = `candles_${id}`;

  // הגבלה עדינה: נר אחד ליום למכשיר (לא מושלם, אבל מפחית ספאם)
  const throttleKey = `candle_throttle_${id}`;
  const lastYmd = loadLocal(throttleKey, "");

  async function renderSharedCandle() {
    const client = supa();
    // count
    const { data, error } = await client.from("candles")
      .select("count")
      .eq("person_id", id)
      .maybeSingle();
    const c = data?.count ?? 0;
    if (candleCount) candleCount.textContent = `${c} נרות הודלקו (סה״כ)`;
  }

  function renderLocalCandle() {
    const isLit = loadLocal(localLitKey, false);
    const count = loadLocal(localCountKey, 0);
    candle?.classList.toggle("is-lit", !!isLit);
    if (candleBtn) candleBtn.textContent = isLit ? "הנר דולק (לחיצה לכיבוי)" : "הדלק/י נר";
    if (candleCount) candleCount.textContent = `${count} נרות הודלקו במכשיר זה`;
  }

  async function handleCandleClick() {
    if (!usingShared) {
      // local
      let isLit = loadLocal(localLitKey, false);
      let count = loadLocal(localCountKey, 0);
      if (!isLit) { count += 1; isLit = true; }
      else { isLit = false; }
      saveLocal(localLitKey, isLit);
      saveLocal(localCountKey, count);
      renderLocalCandle();
      return;
    }

    // shared: פעם ביום למכשיר
    const today = ymdNow();
    if (lastYmd === today) {
      if (candleCount) candleCount.textContent = "כבר הודלק נר היום במכשיר זה. תודה.";
      candle?.classList.add("is-lit");
      return;
    }

    const client = supa();
    const { data, error } = await client.rpc("increment_candle", { pid: id });
    if (error) {
      console.error(error);
      if (candleCount) candleCount.textContent = "לא הצלחנו להדליק נר כרגע.";
      return;
    }
    saveLocal(throttleKey, today);
    candle?.classList.add("is-lit");
    if (candleCount) candleCount.textContent = `${data ?? "—"} נרות הודלקו (סה״כ)`;
  }

  candleBtn?.addEventListener("click", handleCandleClick);

  // מצב התחלתי
  if (usingShared) {
    candle?.classList.remove("is-lit");
    await renderSharedCandle();
  } else {
    renderLocalCandle();
  }

  // ========= ספר אורחים =========
  const gbKey = `guestbook_${id}`;
  let entriesLocal = loadLocal(gbKey, []);

  async function renderSharedGuestbook() {
    const client = supa();
    const { data, error } = await client
      .from("guestbook_entries")
      .select("by,text,created_at")
      .eq("person_id", id)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      if (guestList) guestList.innerHTML = `<p class="muted">לא ניתן לטעון הודעות כרגע.</p>`;
      return;
    }

    if (!data?.length) {
      if (guestList) guestList.innerHTML = `<p class="muted">עדיין אין כאן מילים. אפשר להיות הראשונים.</p>`;
      return;
    }

    if (guestList) {
      guestList.innerHTML = data.map(e => {
        const d = new Date(e.created_at);
        const date = d.toLocaleDateString("he-IL", { year:"numeric", month:"2-digit", day:"2-digit" });
        return `
          <article class="card list" style="padding:14px;">
            <div class="person-meta">
              <span>${escapeHtml(e.by || "אנונימי")}</span>
              <span>${escapeHtml(date)}</span>
            </div>
            <p class="guest-text">${escapeHtml(e.text)}</p>
          </article>
        `;
      }).join("");
    }
  }

  function renderLocalGuestbook() {
    if (!guestList) return;
    if (!entriesLocal.length) {
      guestList.innerHTML = `<p class="muted">עדיין אין כאן מילים. אפשר להיות הראשונים.</p>`;
      return;
    }
    guestList.innerHTML = entriesLocal.slice().reverse().map(e => `
      <article class="card list" style="padding:14px;">
        <div class="person-meta">
          <span>${escapeHtml(e.by || "אנונימי")}</span>
          <span>${escapeHtml(e.date)}</span>
        </div>
        <p class="guest-text">${escapeHtml(e.text)}</p>
      </article>
    `).join("");
  }

  let guestSending = false;
  guestForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const submitBtn = guestForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : "";
    let status = document.getElementById("formStatus");
    if (!status){
      status = document.createElement("p");
      status.id = "formStatus";
      status.className = "tiny muted";
      status.setAttribute("aria-live","polite");
      status.tabIndex = -1;
      guestForm.appendChild(status);
    }
    if (submitBtn){
      submitBtn.disabled = true;
      submitBtn.textContent = "שולח…";
    }

    if (guestSending) return;

    const by = (guestForm.by?.value || "").trim();
    const text = (guestForm.text?.value || "").trim();
    if (!text) return;

    const submitBtn = guestForm.querySelector('button[type="submit"]');
    const prevText = submitBtn?.textContent || "שליחה";
    const setUi = (on) => {
      guestForm.setAttribute("aria-busy", String(!!on));
      if (!submitBtn) return;
      submitBtn.disabled = !!on;
      submitBtn.setAttribute("aria-disabled", String(!!on));
      submitBtn.textContent = on ? "שולח..." : prevText;
    };

    guestSending = true;
    setUi(true);

    try {
      if (!usingShared) {
        const d = new Date();
        const date = d.toLocaleDateString("he-IL", { year:"numeric", month:"2-digit", day:"2-digit" });
        entriesLocal.push({ by: by || "אנונימי", text, date });
        saveLocal(gbKey, entriesLocal);
        guestForm.reset();
        renderLocalGuestbook();
        return;
      }

      const client = supa();
      // ברירת מחדל: נכנס לאישור (approved=false). הציבור רואה רק מאושרים.
      const { error } = await client.from("guestbook_entries").insert([{
        person_id: id,
        by: by || "אנונימי",
        text,
        approved: false
      }]);

      if (error) throw error;

      guestForm.reset();
      if (guestList) guestList.innerHTML = `<p class="muted">תודה. המילים נשלחו לאישור ויופיעו לאחר בדיקה.</p>`;
    if (status) { status.textContent = "תודה. המילים נשלחו לאישור."; status.focus(); }
    if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = originalBtnText || "שליחה"; }
    } catch (error) {
      console.error(error);
      if (guestList) guestList.innerHTML = `<p class="muted">לא הצלחנו לשלוח כרגע. נסו שוב מאוחר יותר.</p>`;
    } finally {
      guestSending = false;
      setUi(false);
      guestForm.removeAttribute("aria-busy");
    }
  });

  // render guestbook
  if (usingShared) await renderSharedGuestbook();
  else renderLocalGuestbook();

  // ========= כתבות =========
  const articles = person.articles || [];
    const listOnlyArticles = [];
    const filteredArticles = articles.filter((a) => {
      if (isListOnlyArticle(a, person.name)) {
        listOnlyArticles.push(a);
        return false;
      }
      return true;
    });
  if (articlesRoot) {
    if (!filteredArticles.length) {
      articlesRoot.innerHTML = `
        <div class="grid cols-2">
          <div class="card list">
            <h3>כתבות ופרסומים</h3>
            <p class="muted">כאן יופיעו קישורים לכתבות, ראיונות ופרסומים על האדם — לפי מקור ואישור.</p>
            <p class="muted" style="margin-top:10px;">אין כרגע כתבות/קישורים נוספים שאומתו עבור הדף הזה.</p>
            <div class="badges">
              <span class="badge">תבנית</span>
              <span class="badge">למילוי בקובץ people.json</span>
            </div>
            <p style="margin-top:12px;">
              <a class="readmore" href="${escapeAttr(siteUrl("about.html#how"))}">איך מוסיפים כתבות →</a>
            </p>
          </div>

          <div class="grid article-grid">
            <article class="card article">
              <h3>כותרת כתבה (דוגמה)</h3>
              <p class="muted">שם מקור • תאריך</p>
              <p style="margin-top:10px;">קישור לקריאה יופיע כאן.</p>
            </article>
            <article class="card article">
              <h3>כתבה נוספת (דוגמה)</h3>
              <p class="muted">שם מקור • תאריך</p>
              <p style="margin-top:10px;">קישור לקריאה יופיע כאן.</p>
            </article>
            <article class="card article">
              <h3>פרסום/ראיון (דוגמה)</h3>
              <p class="muted">שם מקור • תאריך</p>
              <p style="margin-top:10px;">קישור לקריאה יופיע כאן.</p>
            </article>
          </div>
        </div>
      `;
    } else {
      articlesRoot.innerHTML = `
        <div class="grid article-grid">
          ${filteredArticles.map(a => `
            <article class="card article">
              <h3>${escapeHtml(a.title || "כתבה")}</h3>
              <p class="muted">${escapeHtml(a.source || "")}${a.date ? " • " + escapeHtml(a.date) : ""}</p>
              <p style="margin-top:10px;"><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">לקריאה →</a></p>
            </article>
          `).join("")}
        </div>
      `;
    }
    if (listOnlyArticles.length) {
      articlesRoot.insertAdjacentHTML("beforeend", renderListOnlySection(listOnlyArticles));
      const toggle = document.getElementById("toggle-list-only");
      if (toggle) {
        toggle.addEventListener("click", () => {
          const box = document.getElementById("list-only");
          if (!box) return;
          const isHidden = box.style.display === "none" || box.style.display === "";
          box.style.display = isHidden ? "block" : "none";
          toggle.textContent = isHidden ? "הסתר" : "הצג";
        });
      }
    }

  }
}



/* =======================
   Footer: support + ambient audio (optional)
======================= */
function ensureFooterSupport(){
  const foot = document.querySelector(".site-footer .footer-bottom");
  if (!foot || foot.querySelector(".footer-support")) return;

  const support = document.createElement("div");
  support.className = "footer-support";
  support.innerHTML = `
    <strong>תמיכה נפשית:</strong>
    <a href="tel:1201" aria-label="ער״ן 1201">ער״ן – 1201</a>
    <a href="tel:*3362" aria-label="נט״ל כוכבית 3362">נט״ל – ‎*3362</a>
    <button type="button" id="audioToggle" class="audio-toggle" aria-pressed="false" aria-label="הפעלת/כיבוי סאונד אווירה">
      <span aria-hidden="true">🔇</span><span>סאונד</span>
    </button>
    <span class="hint">אם את/ה במצוקה מיידית — פנו למוקד חירום מקומי.</span>
  `;
  foot.appendChild(support);
  initAmbientAudio(support.querySelector("#audioToggle"));
}

function initAmbientAudio(btn){
  if (!btn) return;

  // Keep a single shared audio engine per session.
  const state = window.__windAudio || { ctx:null, gain:null, node:null, filter:null, on:false, btn:null };
  state.btn = btn;

  const setUi = () => {
    btn.setAttribute("aria-pressed", String(state.on));
    btn.innerHTML = state.on
      ? `<span aria-hidden="true">🔈</span><span>סאונד</span>`
      : `<span aria-hidden="true">🔇</span><span>סאונד</span>`;
  };

  const ensure = async () => {
    if (!state.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error("WebAudio unsupported");

      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = 0.0;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      filter.Q.value = 0.7;

      // Brown noise (“wind-like”) – tiny + safe.
      const bufferSize = 4096;
      let lastOut = 0.0;
      const node = ctx.createScriptProcessor(bufferSize, 1, 1);
      node.onaudioprocess = (e) => {
        const out = e.outputBuffer.getChannelData(0);
        for (let i=0;i<bufferSize;i++){
          const white = Math.random()*2-1;
          lastOut = (lastOut + 0.02*white) / 1.02;
          out[i] = lastOut * 3.5;
        }
      };

      node.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      state.ctx = ctx;
      state.gain = gain;
      state.filter = filter;
      state.node = node;
    }

    if (state.ctx.state === "suspended") await state.ctx.resume();
  };

  btn.addEventListener("click", async () => {
    try{
      await ensure();
      state.on = !state.on;
      state.gain.gain.value = state.on ? 0.14 : 0.0;
      setUi();
      window.__windAudio = state;
    }catch(err){
      console.warn(err);
      state.on = false;
      setUi();
    }
  });

  setUi();
  window.__windAudio = state;
}
/* =======================
   Init
======================= */
document.addEventListener("DOMContentLoaded", async () => {
  initThemePicker();
  setYear();
  bindMenu();
  setActiveNav();

  ensurePreconnect();

  ensureFooterSupport();

  try {
    await initField();
    await initPeopleList();
    await initPlaces();
    await initPlacePage();
    await initPersonPage();
  } catch (e) {
    showFatal("אירעה שגיאה בטעינת הנתונים. ייתכן ש־data/people.json לא נטען.", e);
  }
});
