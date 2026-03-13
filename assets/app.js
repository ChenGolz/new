const SITE_BASE = (() => {
  try {
    const scripts = Array.from(document.scripts || []);
    const me =
      scripts.find(s => (s.src || "").includes("/assets/app.js")) ||
      scripts.find(s => (s.src || "").includes("assets/app.js"));
    if (!me || !me.src) return "./";
    const u = new URL(me.src, location.href);
    const p = u.pathname;
    const idx = p.lastIndexOf("/assets/app.js");
    if (idx === -1) return "./";
    return p.slice(0, idx + 1); // includes trailing slash
  } catch {
    return "./";
  }
})();
function siteUrl(path) {
  return SITE_BASE + String(path || "").replace(/^\/+/,"");
}
const DATA_URL = siteUrl("data/people.json");
const META_URL = siteUrl("data/people_meta.json");

/* =======================
   Search helpers (Hebrew-friendly)
   - normalize final letters
   - remove niqqud
   - tolerant matching (tokens + bigram similarity)
======================= */
const HEB_FINALS = {
  "ך": "כ",
  "ם": "מ",
  "ן": "נ",
  "ף": "פ",
  "ץ": "צ",
};

function normalizeHe(str) {
  return String(str ?? "")
    .toLowerCase()
    // quotes
    .replace(/["'`״׳]/g, "")
    // niqqud + cantillation
    .replace(/[\u0591-\u05C7]/g, "")
    // finals
    .replace(/[ךםןףץ]/g, (ch) => HEB_FINALS[ch] || ch)
    // punctuation
    .replace(/[\[\]{}()<>.,:;!?/\\|_+=~^$#@]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(str) {
  const s = normalizeHe(str);
  return s ? s.split(" ") : [];
}

function bigrams(str) {
  const s = normalizeHe(str).replace(/\s+/g, "");
  const out = [];
  for (let i = 0; i < Math.max(0, s.length - 1); i++) out.push(s.slice(i, i + 2));
  return out;
}

function bigramSimilarity(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const setA = new Map();
  for (const x of A) setA.set(x, (setA.get(x) || 0) + 1);
  let inter = 0;
  for (const y of B) {
    const c = setA.get(y) || 0;
    if (c > 0) {
      inter += 1;
      setA.set(y, c - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

function deriveTraitTags(person, meta) {
  const out = new Set();
  const add = (v) => { if (v) out.add(String(v).trim()); };
  const addMany = (arr) => (arr || []).forEach(add);

  addMany(meta?.tags);
  addMany(person?.tags);
  add(person?.place);

  const hay = normalizeHe([
    person?.name,
    person?.place,
    ...(person?.articles || []).flatMap(a => [a?.title, a?.source, a?.url])
  ].filter(Boolean).join(' | '));

  const rules = [
    [/ספורט|אופני|ריצה|מרתון|sport|bike|cycling|runner/, ['ספורט','אופניים']],
    [/מוזיק|נגנ|שיר|פסטיבל|nova|dj|music/, ['מוזיקה']],
    [/טבע|חקלא|שדה|garden|nature/, ['טבע']],
    [/כיבוי|מדא|רפואה|חובש|rescue|fire|ems/, ['הצלה']],
    [/צבא|לוחמ|קצינ|מילואימ|combat|army/, ['לוחם/ת']],
    [/משפחה|אבא|אמא|ילד|ילדה|הורים|family/, ['משפחה']],
    [/חבר|קהילה|קיבוץ|community|friend/, ['חבר/ה','קהילה']]
  ];
  for (const [re, tags] of rules) {
    if (re.test(hay)) addMany(tags);
  }

  return Array.from(out);
}

function matchesQuery(person, query, meta) {
  const q = normalizeHe(query);
  if (!q) return true;
  const tokens = q.split(" ").filter(Boolean);
  const name = normalizeHe(person?.name);
  const place = normalizeHe(person?.place);
  const tags = normalizeHe(deriveTraitTags(person, meta).join(' '));
  const hay = (name + " " + place + " " + tags).trim();

  const tokenOk = tokens.every((t) => hay.includes(t));
  if (tokenOk) return true;

  const sim = Math.max(bigramSimilarity(q, name), bigramSimilarity(q, tags));
  return sim >= 0.56;
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

// For safe insertion into HTML attributes (e.g. data-*).
function escapeAttr(s) {
  return escapeHtml(s).replaceAll("`", "&#96;");
}

function setMeta(nameOrProp, content, kind="name"){
  try{
    if(!document || !document.head) return;
    const attr = (kind === "property") ? "property" : "name";
    const sel = `meta[${attr}="${CSS && CSS.escape ? CSS.escape(nameOrProp) : nameOrProp}"]`;
    let el = document.head.querySelector(sel);
    if(!el){
      el = document.createElement("meta");
      el.setAttribute(attr, nameOrProp);
      document.head.appendChild(el);
    }
    el.setAttribute("content", String(content ?? ""));
  }catch{}
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
  if (!res.ok) throw new Error("לא ניתן לטעון נתונים.");
  return await res.json();
}

function unique(arr) { return Array.from(new Set(arr)); }

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

  const people = await loadPeople();
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
      const rPx = Math.max(18, Math.min(68, 14 + Math.sqrt(cnt) * 7));

      // slightly softer than person dots
      const col = colorForPlace(pl).replace(/0\.95\)/, "0.70)");

      list.push({
        kind: "place",
        id: pl,
        place: pl,
        name: pl,
        count: cnt,
        x: c.ax,
        y: c.ay,
        r: rPx / (w || 1000),
        col
      });
    }
    return list;
  };

  let nodes = people.map((p) => {
    const c = centers.get(p.place) || { ax: 0.5, ay: 0.52 };
    const jx = (Math.random() - 0.5) * 0.18;
    const jy = (Math.random() - 0.5) * 0.18;
    return {
      ...p,
      x: c.ax + jx, y: c.ay + jy,
      r: 0.0065 + Math.random()*0.003,
      col: colorForPlace(p.place),
      t: Math.random()*1000,
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
      const qq = q.toLowerCase();
      arr = arr.filter(n =>
        (n.name || "").toLowerCase().includes(qq) ||
        (n.desc || "").toLowerCase().includes(qq)
      );
    }
    return arr;
  }

  let hover = null;

  function draw(ts) {
    ctx.clearRect(0,0,w,h);

    // Light, subtle background that works on both dark & light page themes
    const g = ctx.createRadialGradient(w*0.48,h*0.40, 0, w*0.55,h*0.55, Math.max(w,h)*0.95);
    g.addColorStop(0, "rgba(37,99,235,0.06)");
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
        ctx.fillText(`${pl} · ${cnt}`, c.ax*w, c.ay*h);
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
        ctx.fillText(pl, c.ax*w, c.ay*h - 12);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
    }

    // dots / bubbles
    for (const n of list) {
      const x = n.x*w, y = n.y*h;
      const pulse = 0.45 + 0.55*Math.sin((ts*0.002) + (n.t||0));

      if (n.kind === "place") {
        const rr = (n.r*w) * (0.98 + pulse*0.06);
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

      const rr = (n.r*w) * (0.92 + pulse*0.18);
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
      const x = hover.x*w, y = hover.y*h;
      const base = hover.r*w;
      const ring = (hover.kind === "place") ? base * 1.55 : base * 3.2;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(180,83,9,0.55)";
      ctx.lineWidth = 1;
      ctx.arc(x, y, ring, 0, Math.PI*2);
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  function pick(mx, my) {
    const list = filteredNodes();
    let best = null, bestD = Infinity;
    for (const n of list) {
      const x = n.x*w, y = n.y*h;
      const d = Math.hypot(mx-x, my-y);
      const base = (n.r*w);
      const hit = (n.kind === 'place') ? (base * 1.35) : (base * 3.2);
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

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const hit = pick(mx, my);
    hover = hit;
    if (hit) tooltipShow(hit, mx, my);
    else tooltipHide();
  });
  canvas.addEventListener("mouseleave", () => { hover = null; tooltipHide(); });
  canvas.addEventListener("click", (e) => {
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

  document.getElementById("goPeople")?.addEventListener("click", () => location.href = siteUrl("people.html"));
  document.getElementById("goPlaces")?.addEventListener("click", () => location.href = siteUrl("places.html"));

  placeSelect?.addEventListener("change", () => { hover = null; tooltipHide(); });
  searchInput?.addEventListener("input", () => { hover = null; tooltipHide(); });

  requestAnimationFrame(draw);
}

/* =======================
   people.html – רשימה מלאה
======================= */
async function initPeopleList() {
  const root = document.getElementById("peopleRoot");
  const search = document.getElementById("peopleSearch");
  const placeSelect = document.getElementById("peoplePlace");
  const tagsRoot = document.getElementById("peopleTags");
  const azBar = document.getElementById("azBar");
  let traitRoot = document.getElementById("peopleTraitTags");
  if (!root) return;

  const people = await loadPeople();
  const counts2 = new Map();
  for (const p of people) counts2.set(p.place, (counts2.get(p.place) || 0) + 1);
  const places = unique(people.map(p=>p.place)).sort((a,b)=>a.localeCompare(b,"he"));

  if (placeSelect) {
    placeSelect.innerHTML =
      `<option value="">כל היישובים</option>` +
      places.map(pl => `<option value="${escapeHtml(pl)}">${escapeHtml(pl)} (${counts2.get(pl) || 0})</option>`).join("");
  }

  // Optional: classification/date filters (based on data/people_meta.json)
  const metaAll = await loadPeopleMeta();
  const controls = document.querySelector(".controls");
  let kindSelect = document.getElementById("peopleKind");
  let dateSelect = document.getElementById("peopleDate");

  if(controls && !kindSelect){
    kindSelect = document.createElement("select");
    kindSelect.id = "peopleKind";
    kindSelect.innerHTML = `
      <option value="">כל הסוגים</option>
      <option value="combat">נפלו בקרב</option>
      <option value="civilian">אזרחים</option>
      <option value="other">אחר</option>
    `;
    controls.appendChild(kindSelect);

    dateSelect = document.createElement("select");
    dateSelect.id = "peopleDate";
    dateSelect.innerHTML = `
      <option value="">כל התאריכים</option>
      <option value="2023-10-07">7 באוקטובר 2023</option>
      <option value="2023-10">אוקטובר 2023</option>
      <option value="2023">שנת 2023</option>
    `;
    controls.appendChild(dateSelect);
  }

  // Move filters into a sticky bar above the list (mobile-friendly)
  (function(){
    const rootWrap = root.closest(".wrap");
    if(!rootWrap) return;
    if(document.getElementById("peopleStickyBar")) return;

    const heroCard = document.querySelector(".page-hero .card");
    const ctrls = heroCard?.querySelector(".controls");
    const tags = document.getElementById("peopleTags");
    const az = document.getElementById("azBar");
    if(!ctrls && !tags && !az) return;

    const bar = document.createElement("div");
    bar.id = "peopleStickyBar";
    bar.className = "people-sticky-bar";
    rootWrap.insertBefore(bar, root);

    if(ctrls) bar.appendChild(ctrls);
    if(tags) bar.appendChild(tags);
    if(az) bar.appendChild(az);
  })();


  const HEB_LETTERS = "אבגדהוזחטיכלמנסעפצקרשת".split("");

  function updateTags(activePlace) {
    if (!tagsRoot) return;
    const btns = places.map((pl) => {
      const n = counts2.get(pl) || 0;
      return `<button type="button" class="${pl === activePlace ? "is-active" : ""}" data-place="${escapeAttr(pl)}">${escapeHtml(pl)} <span class="muted">(${n})</span></button>`;
    });
    tagsRoot.innerHTML = `<button type="button" class="${!activePlace ? "is-active" : ""}" data-place="">כל היישובים</button>` + btns.join("");
  }

  function ensureTraitRoot(){
    if(traitRoot) return traitRoot;
    const bar = document.getElementById("peopleStickyBar") || document.querySelector(".page-hero .card");
    if(!bar) return null;
    traitRoot = document.createElement("div");
    traitRoot.id = "peopleTraitTags";
    traitRoot.className = "traitbar";
    bar.appendChild(traitRoot);
    return traitRoot;
  }

  function updateTraitTags(list){
    const rootEl = ensureTraitRoot();
    if(!rootEl) return;
    const counts = new Map();
    for(const p of list){
      const tags = deriveTraitTags(p, metaAll && metaAll[p.id]);
      for(const t of tags){
        if(t === p.place) continue;
        counts.set(t, (counts.get(t)||0)+1);
      }
    }
    const top = Array.from(counts.entries()).sort((a,b)=> b[1]-a[1] || a[0].localeCompare(b[0], 'he')).slice(0,8);
    if(!top.length){ rootEl.innerHTML = ''; return; }
    rootEl.innerHTML = '<span class="traitbar-label">חיפוש לפי מאפיין</span>' + top.map(([tag,n]) => `<button type="button" class="trait-chip" data-trait="${escapeAttr(tag)}">${escapeHtml(tag)} <span class="muted">(${n})</span></button>`).join('');
  }

  function updateAz(list) {
    if (!azBar) return;
    const available = new Set(list.map(p => initialOfName(p.name)));
    azBar.innerHTML = HEB_LETTERS.map((ch) => {
      const dis = !available.has(ch);
      return `<button type="button" class="az-btn" data-letter="${escapeAttr(ch)}" ${dis ? "disabled aria-disabled=\"true\"" : ""}>${escapeHtml(ch)}</button>`;
    }).join("");
  }

  function render() {
    const q = (search?.value || "").trim();
    const pl = (placeSelect?.value || "");
    const list = people.filter(p => {
      const okPlace = !pl || p.place === pl;

      const meta = metaAll && metaAll[p.id] ? metaAll[p.id] : null;
      const kind = (kindSelect && kindSelect.value) ? kindSelect.value : "";
      const dateF = (dateSelect && dateSelect.value) ? dateSelect.value : "";

      const pKind = meta && meta.kind ? String(meta.kind) : "";
      const pDate = meta && meta.date ? String(meta.date) : "2023-10-07";

      const okKind = !kind || (pKind && pKind === kind);
      const okDate = !dateF || (dateF.length === 10 ? pDate === dateF : pDate.startsWith(dateF));

      const okQuery = matchesQuery(p, q, meta);
      return okPlace && okKind && okDate && okQuery;
    });

    if (!list.length) {
  root.innerHTML = `
    <div class="card empty-state">
      <h3>לא נמצאו תוצאות</h3>
      <p class="muted">אולי נסו איות אחר או חפשו בלי ניקוד.</p>
    </div>
  `;
} else {
      root.innerHTML = list.map(p => {
      const initial = initialOfName(p.name);
      const letter = escapeAttr(initial);
      const place = p.place ? escapeHtml(p.place) : "";
      const name = escapeHtml(p.name);
      const href = siteUrl("p/" + escapeHtml(p.id) + ".html");
      const imgPrimary = siteUrl("assets/people/" + escapeHtml(p.id) + ".jpg");
      const tags = deriveTraitTags(p, metaAll && metaAll[p.id]).filter(t => t && t !== p.place).slice(0,2);
      return `
        <article class="person-card person-tile" data-letter="${letter}" data-place="${escapeAttr(p.place || "")}" id="person-${escapeAttr(p.id)}">
          <a class="person-tile-link" href="${href}" aria-label="לפתיחה: ${name}">
            <div class="person-tile-media">
              <img class="person-tile-img" data-person-id="${escapeAttr(p.id)}" src="${imgPrimary}" alt="" loading="lazy" decoding="async"/>
            </div>
            <div class="person-tile-overlay" aria-hidden="true">
              ${place ? `<div class="person-tile-place">${place}</div>` : ``}
              <div class="person-tile-name">${name}</div>
              ${tags.length ? `<div class="person-tile-tags">${tags.map(t => `<span>${escapeHtml(t)}</span>`).join("")}</div>` : ``}${(() => {
                const meta = (metaAll && metaAll[p.id]) ? metaAll[p.id] : null;
                const dateIso = meta && meta.date ? String(meta.date) : "";
                const dateText = dateIso ? formatHebrewDate(dateIso) : "";
                return dateText ? `<div class="person-tile-date">${escapeHtml(dateText)}</div>` : ``;
              })()}
            </div>
          </a>
        </article>`;
    }).join("");

    // Respectful light fallback if there is no photo.
    root.querySelectorAll("img.person-tile-img[data-person-id]").forEach(img => {
      const pid = img.getAttribute("data-person-id");
      img.addEventListener("error", () => {
        img.src = siteUrl("assets/person-placeholder.svg");
        img.classList.add("is-placeholder");
      }, { once: true });
    });
}

    updateTags(pl);
    updateAz(list);
    updateTraitTags(list);

    const count = document.getElementById("peopleCount");
    if (count) count.textContent = `${list.length} מתוך ${people.length}`;
  }

  search?.addEventListener("input", render);
  placeSelect?.addEventListener("change", render);
  kindSelect?.addEventListener("change", render);
  dateSelect?.addEventListener("change", render);

  tagsRoot?.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button[data-place]");
    if (!btn || !placeSelect) return;
    placeSelect.value = btn.dataset.place || "";
    render();
  });


  document.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button.trait-chip[data-trait]");
    if(!btn || !search) return;
    search.value = btn.dataset.trait || "";
    render();
    search.focus();
  });

  azBar?.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button.az-btn");
    if (!btn || btn.hasAttribute("disabled")) return;
    const ch = btn.dataset.letter;
    const esc = (window.CSS && CSS.escape) ? CSS.escape(ch) : ch;
    const first = root.querySelector(`.person-card[data-letter="${esc}"]`);
    if (first) first.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  render();
}

/* =======================
   index.html — quick live search
======================= */
function initHomeSearch(){
  const input = document.getElementById("homeSearch");
  const list = document.getElementById("homeDirectory");
  if(!input || !list) return;
  const items = Array.from(list.querySelectorAll("li"));

  function apply(){
    const q = input.value.trim();
    let shown = 0;
    for(const li of items){
      const a = li.querySelector('a');
      const name = a?.textContent || li.textContent || '';
      const place = li.querySelector('.muted')?.textContent || '';
      const ok = matchesQuery({ name, place }, q);
      li.style.display = ok ? "" : "none";
      if(ok) shown++;
    }
    let empty = document.getElementById("homeEmpty");
    if(!empty){
      empty = document.createElement("p");
      empty.id = "homeEmpty";
      empty.className = "muted";
      empty.style.marginTop = "14px";
      list.insertAdjacentElement("afterend", empty);
    }
    empty.textContent = shown ? "" : "לא נמצאו תוצאות. נסו איות אחר או חיפוש בלי ניקוד.";
  }
  input.addEventListener("input", apply);
  apply();
}

function initHomePreload(){
  const root = document.getElementById('featuredRoot');
  if(!root) return;
  const hrefs = Array.from(root.querySelectorAll('a[href]')).slice(0,5).map(a => a.getAttribute('href')).filter(Boolean);
  for(const href of hrefs){
    const pre = document.createElement('link');
    pre.rel = 'prefetch';
    pre.href = href;
    document.head.appendChild(pre);
    const idm = href.match(/p\/(p\d+)\.html/);
    if(idm){
      const img = document.createElement('link');
      img.rel = 'preload';
      img.as = 'image';
      img.href = siteUrl(`assets/og-person/${idm[1]}.png`);
      document.head.appendChild(img);
    }
  }
}

/* =======================
   places.html — mini map shortcuts
======================= */
async function initPlacesMap(){
  const box = document.getElementById("placeMapBox");
  if(!box) return;
  const people = await loadPeople();
  const map = new Map();
  for(const p of people) map.set(p.place, (map.get(p.place) || 0) + 1);
  const places = Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0],"he"));
  box.innerHTML = `
    <div class="map-head">
      <h2 class="section-title" style="margin:0;">מפה מהירה</h2>
      <p class="muted" style="margin:6px 0 0;">לחצו על יישוב כדי לפתוח את דף הקהילה.</p>
    </div>
    <div class="map-dots" role="list">
      ${places.map(([pl,n])=>`
        <a role="listitem" class="dot" href="${siteUrl("place/"+encodeURIComponent(placeSlug(pl))+".html")}">
          <span class="dot-name">${escapeHtml(pl)}</span>
          <span class="dot-count">${n}</span>
        </a>
      `).join("")}
    </div>
  `;
}

/* =======================
   Theme / Dark mode + optional ambient audio
======================= */
function initTheme(){
  const key = "theme-mode";
  const html = document.documentElement;
  try{ localStorage.setItem(key, "light"); }catch{}
  html.dataset.theme = "light";
}

function toggleTheme(){
  const html = document.documentElement;
  html.dataset.theme = "light";
  try{ localStorage.setItem("theme-mode", "light"); }catch{}
}

let ambientCtx = null;
let ambientSrc = null;
let ambientGain = null;

function startAmbient(){
  if(ambientCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if(!Ctx) return;
  const ctx = new Ctx();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * 0.12;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 650;

  const gain = ctx.createGain();
  gain.gain.value = 0.0;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();

  // gentle fade in
  gain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.6);

  ambientCtx = ctx;
  ambientSrc = src;
  ambientGain = gain;
}

function stopAmbient(){
  if(!ambientCtx) return;
  try{
    ambientGain.gain.setTargetAtTime(0.0, ambientCtx.currentTime, 0.2);
    setTimeout(()=>{
      try{ ambientSrc.stop(); }catch{}
      try{ ambientCtx.close(); }catch{}
      ambientCtx = null; ambientSrc = null; ambientGain = null;
    }, 500);
  }catch{
    try{ ambientSrc.stop(); }catch{}
    try{ ambientCtx.close(); }catch{}
    ambientCtx = null; ambientSrc = null; ambientGain = null;
  }
}

function initHeaderExtras(){
  const bar = document.querySelector(".wrap.nav");
  if(!bar) return;

  // ensure silent button exists everywhere
  if(!document.getElementById("silentToggle")){
    const silent = document.createElement("button");
    silent.className = "silent-toggle";
    silent.id = "silentToggle";
    silent.type = "button";
    silent.setAttribute("aria-pressed","false");
    silent.textContent = "";
    silent.setAttribute("aria-label","תצוגה שקטה");
    const menu = bar.querySelector(".menu-btn") || bar.querySelector("button");
    if(menu) menu.insertAdjacentElement("afterend", silent);
    else bar.appendChild(silent);
  }

  // remove legacy theme toggle – site is light-only now
  document.getElementById("themeToggle")?.remove();

  // optional ambient
  if(!document.getElementById("audioToggle")){
    const btn = document.createElement("button");
    btn.className = "audio-toggle";
    btn.id = "audioToggle";
    btn.type = "button";
    btn.setAttribute("aria-pressed","false");
    btn.innerHTML = `<span aria-hidden="true">🔇</span><span class="sr">סאונד</span>`;
    const silent = document.getElementById("silentToggle");
    silent?.insertAdjacentElement("afterend", btn);
  }

  document.getElementById("audioToggle")?.addEventListener("click", (ev)=>{
    const btn = ev.currentTarget;
    const on = btn.getAttribute("aria-pressed") === "true";
    if(on){
      stopAmbient();
      btn.setAttribute("aria-pressed","false");
      btn.firstElementChild.textContent = "🔇";
      return;
    }
    startAmbient();
    btn.setAttribute("aria-pressed","true");
    btn.firstElementChild.textContent = "🔈";
  });
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
      <a class="readmore" href="${siteUrl("place/" + encodeURIComponent(placeSlug(pl)) + ".html")}">לדף היישוב →</a>
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
  const metaAll = await loadPeopleMeta();


  title.textContent = pl;
  if (sub) sub.textContent = `${list.length} אנשים`;
  if (intro) intro.textContent = placeIntro(pl);

  root.innerHTML = list.map(p => {
    const initial = initialOfName(p.name);
    const letter = escapeAttr(initial);
    const place = pl ? escapeHtml(pl) : "";
    const name = escapeHtml(p.name);
    const href = siteUrl("p/" + encodeURIComponent(p.id) + ".html");
    const imgPrimary = siteUrl("assets/people/" + escapeHtml(p.id) + ".jpg");

    const meta = (metaAll && metaAll[p.id]) ? metaAll[p.id] : null;
    const dateIso = meta && meta.date ? String(meta.date) : "";
    const dateText = dateIso ? formatHebrewDate(dateIso) : "";

    return `
      <article class="person-card person-tile memorial-card" data-letter="${letter}" data-place="${escapeAttr(pl || "")}" id="person-${escapeAttr(p.id)}">
        <a class="person-tile-link" href="${href}" aria-label="לפתיחה: ${name}">
          <div class="person-tile-media">
            <img class="person-tile-img" data-person-id="${escapeAttr(p.id)}" src="${imgPrimary}" alt="" loading="lazy" decoding="async"/>
          </div>
          <div class="person-tile-overlay" aria-hidden="true">
            ${place ? `<div class="person-tile-place">${place}</div>` : ``}
            <div class="person-tile-name">${name}</div>
            ${dateText ? `<div class="person-tile-date">${escapeHtml(dateText)}</div>` : ``}
          </div>
        </a>
      </article>`;
  }).join("");

  // Respectful light fallback if there is no photo.
  root.querySelectorAll("img.person-tile-img[data-person-id]").forEach(img => {
    img.addEventListener("error", () => {
      img.src = siteUrl("assets/person-placeholder.svg");
      img.classList.add("is-placeholder");
    }, { once: true });
  });
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

  // Ambient background for individual pages
  try{ if(id) document.body.style.setProperty("--person-bg", `url(\'${siteUrl("assets/og-person/" + id + ".png")}\')`); }catch(e){}
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
  // עדכון מטא (לתצוגה יפה בדפדפן; לשיתוף בוואטסאפ עדיין מומלץ p/*.html)
  document.title = `לזכר ${person.name} ז״ל`;
  setMeta("description", `דף זיכרון וקישורים לזכר ${person.name} ז״ל.`, "name");
  setMeta("og:title", `לזכר ${person.name} ז״ל`, "property");
  setMeta("og:description", "מנציחים את זכרם של הנופלים והנרצחים.", "property");
  // תמונת OG אישית (נוצרת אוטומטית בתיקיית assets/og-person)
  setMeta("og:image", new URL(siteUrl(`assets/og-person/${id}.png`), location.href).href, "property");
  setMeta("twitter:card", "summary_large_image", "name");
  if (placeLink) {
    placeLink.href = siteUrl(`place/${encodeURIComponent(placeSlug(person.place))}.html`);
    placeLink.textContent = person.place;
  }

  const usingShared = isSupabaseReady();
  if (backendNote) {
    backendNote.textContent = usingShared
      ? "מצב משותף פעיל: נרות ומילים נשמרים לכל המבקרים (בכפוף לאישור)."
      : "מצב מקומי: נרות ומילים נשמרים רק במכשיר שלך. כדי לשתף לכולם – חבר/י Supabase (ראה אודות).";

  // העתקת קישור (שיתוף נכון: דף סטטי עם OG)
  shareBtn?.addEventListener("click", async () => {
    const url = new URL(siteUrl("p/" + encodeURIComponent(id) + ".html"), location.href).href;
    const title = person?.name ? ("לזכר " + person.name) : document.title;
    try{
      if(navigator.share){
        await navigator.share({ title, url });
        return;
      }
    }catch(e){}
    try{
      await navigator.clipboard.writeText(url);
      shareBtn.textContent = "הועתק!";
      setTimeout(()=> shareBtn.textContent = "העתקת קישור", 1200);
    }catch{
      // fallback
      prompt("העתיקו את הקישור:", url);
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
            <p style="margin:10px 0 0; line-height:1.85; color: rgba(255,255,255,.84);">${escapeHtml(e.text)}</p>
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
        <p style="margin:10px 0 0; line-height:1.85; color: rgba(255,255,255,.84);">${escapeHtml(e.text)}</p>
      </article>
    `).join("");
  }

  guestForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const by = (guestForm.by?.value || "").trim();
    const text = (guestForm.text?.value || "").trim();
    if (!text) return;

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

    guestForm.reset();
    if (error) {
      console.error(error);
      if (guestList) guestList.innerHTML = `<p class="muted">לא הצלחנו לשלוח כרגע. נסו שוב מאוחר יותר.</p>`;
      return;
    }
    if (guestList) guestList.innerHTML = `<p class="muted">תודה. המילים נשלחו לאישור ויופיעו לאחר בדיקה.</p>`;
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
              <a class="readmore" href="about.html#how">איך מוסיפים כתבות →</a>
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
   Init
======================= */
document.addEventListener("DOMContentLoaded", async () => {
  try{ initTheme(); }catch{}
  try{ initHeaderExtras(); }catch{}
  try{ initSilentMode(); }catch{}
  try{ document.body.classList.add("is-loaded"); }catch{}
  setYear();
  bindMenu();
  setActiveNav();

  try {
    try{ initHomeSearch(); }catch{}
    try{ initHomePreload(); }catch{}
    try{ initHomeAlphaIndex(); }catch{}
    try{ await initPlacesMap(); }catch{}
    await initField();
    await initPeopleList();
    await initPlaces();
    await initPlacePage();
    await initPersonPage();
  } catch (e) {
    const err = document.getElementById("fatal");
    if (err) err.textContent = "אירעה שגיאה בטעינת הנתונים.";
    console.error(e);
  }
});


function initHomeAlphaIndex(){
  const list = document.getElementById("homeDirectory");
  if(!list || document.getElementById('homeAlphaWrap')) return;
  const items = Array.from(list.querySelectorAll('li'));
  if(!items.length) return;
  const letters = [];
  const firstByLetter = new Map();
  items.forEach(li=>{
    const t = normalizeHe(li.textContent || '').replace(/^[^א-ת]*/, '');
    const ch = t.charAt(0);
    if(ch && !firstByLetter.has(ch)){
      firstByLetter.set(ch, li);
      letters.push(ch);
    }
  });
  if(!letters.length) return;
  const wrap = document.createElement('div');
  wrap.id = 'homeAlphaWrap';
  wrap.className = 'home-alpha-wrap';
  const nav = document.createElement('nav');
  nav.className = 'alpha-jump';
  nav.setAttribute('aria-label', 'קפיצה לפי אות');
  letters.forEach(ch=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = ch;
    btn.addEventListener('click', ()=>{
      firstByLetter.get(ch)?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
    nav.appendChild(btn);
  });
  wrap.appendChild(nav);
  document.body.appendChild(wrap);
}

function initSilentMode(){
  const btn = document.getElementById("silentToggle");
  if(!btn) return;
  const key = "silent-mode";
  const html = document.documentElement;
  const saved = localStorage.getItem(key);
  if(saved === "1"){ html.classList.add("silent"); btn.setAttribute("aria-pressed","true"); }
  btn.addEventListener("click", ()=>{
    const on = html.classList.toggle("silent");
    localStorage.setItem(key, on ? "1" : "0");
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function formatHebrewDate(iso){
  if(!iso) return "";
  let d;
  if(iso instanceof Date) d = iso;
  else{
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!m) return String(iso);
    d = new Date(Date.UTC(+m[1], +m[2]-1, +m[3]));
  }
  const months = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ב${month} ${year}`;
}

async function loadPeopleMeta(){
  try{
    const r = await fetch(META_URL, { cache: "no-store" });
    if(!r.ok) return {};
    return await r.json();
  }catch(e){
    return {};
  }
}

function initLitePersonPage(){
  const body = document.body;
  const pid = body?.dataset?.personId || body?.getAttribute("data-person-id");
  const pname = body?.dataset?.personName || body?.getAttribute("data-person-name") || "";
  if(!pid) return;

  // Set a blurred “ambient” background from the person's image (museum-style)
  try{
    const img = document.querySelector('.memorial-photo img.profile-img') || document.querySelector('.profile-img');
    const hero = getComputedStyle(body).getPropertyValue('--hero-bg').trim();
    const src = (img && img.src) ? String(img.src) : "";
    const looksPlaceholder = src.includes("illust-person") || src.includes("person-placeholder") || src.includes("placeholder");
    const bg = (!looksPlaceholder && src) ? `url('${src}')` : (hero || "");
    if(bg) body.style.setProperty('--person-bg', bg);
  }catch(e){}

  // Move story section into the top grid to reduce “empty space”
  try{
    const grid = document.querySelector('.memorial-grid');
    const story = document.querySelector('.story-section');
    const idCard = document.querySelector('.memorial-grid .id-card');
    if(grid && story && !grid.contains(story)){
      if(idCard) grid.insertBefore(story, idCard);
      else grid.appendChild(story);
      story.classList.add('story-in-grid');
    }
  }catch(e){}


// Update memorial verb/date line (some people have a different date).
(async ()=>{
  const metaAll = await loadPeopleMeta();
  const meta = metaAll && metaAll[pid] ? metaAll[pid] : null;

  // Default (editable): most pages are 7.10.2023. Override per id in data/people_meta.json
  const verb = (meta && meta.verb) ? String(meta.verb) : "נהרג/ה";
  const dateIso = (meta && meta.date) ? String(meta.date) : "2023-10-07";
  const details = (meta && meta.details) ? String(meta.details) : "";

  const prettyDate = formatHebrewDate(dateIso);

  // Header subtitle: "<place> | <verb> ב-<date> (details)"
  const headerP = document.querySelector('.memorial-header p');
  if(headerP){
    const placeText = headerP.textContent.split('|')[0].trim();
    const tail = `${verb} ב-${prettyDate}${details ? ' ('+details+')' : ''}`;
    headerP.textContent = `${placeText} | ${tail}`;
  }

  // ID card row
  const dl = document.querySelector('.id-dl');
  if(dl){
    const labelEl = dl.querySelector('.death-label') || dl.querySelector('dt[data-role="death-label"]');
    const valueEl = dl.querySelector('.death-date') || dl.querySelector('dd[data-role="death-date"]');
    if(labelEl) labelEl.textContent = `${verb} בתאריך`;
    if(valueEl) valueEl.textContent = `${prettyDate}${details ? ' ('+details+')' : ''}`;
  }
})();

  const peoplePromise = loadPeople();

  function enhanceQuoteOverlay(){
    const photo = document.querySelector('.memorial-photo');
    if(!photo || photo.querySelector('.quote-overlay')) return;
    const quoteText = (document.querySelector('.story-section blockquote.quote')?.childNodes?.[0]?.textContent || '').trim()
      || ((document.querySelector('.story-section p')?.textContent || '').split(/[.!?]|׃/)[0] || '').trim();
    if(!quoteText || quoteText.includes('טרם הוזן')) return;
    const quote = document.createElement('div');
    quote.className = 'quote-overlay';
    quote.textContent = quoteText.replace(/^"|"$/g,'');
    photo.appendChild(quote);
  }
  enhanceQuoteOverlay();

  (async ()=>{
    try{
      const people = await peoplePromise;
      const idx = people.findIndex(p => p.id === pid);
      if(idx === -1) return;
      const nav = document.querySelector('.navigation-links');
      if(nav){
        const links = nav.querySelectorAll('a');
        const prev = people[idx-1];
        const next = people[idx+1];
        if(links[0] && prev){ links[0].textContent = `→ לזכר ${prev.name}`; links[0].setAttribute('aria-label', `הקודם: ${prev.name}`); }
        if(links[2] && next){ links[2].textContent = `${next.name} ←`; links[2].setAttribute('aria-label', `הבא: ${next.name}`); }
      }
    }catch(e){}
  })();

  const usingShared = isSupabaseReady();

  const candleBtn = document.getElementById("candleBtnLite") || document.getElementById("candleBtn");
  const status = document.getElementById("candleStatusLite") || document.getElementById("candleStatus");
  const shareBtn = document.getElementById("shareBtnLite") || document.getElementById("shareBtn");

  // status area: add counter line if missing
  let countEl = document.getElementById("candleCountLite");
  if(!countEl && status){
    countEl = document.createElement("div");
    countEl.id = "candleCountLite";
    countEl.className = "muted small";
    countEl.style.marginTop = "8px";
    status.insertAdjacentElement("afterend", countEl);
  }

  const litKey = "candle-lit:" + pid;
  const localCountKey = "candles_" + pid;
  const throttleKey = "candle_throttle_" + pid;

  function setLit(lit){
    if(!candleBtn) return;
    candleBtn.classList.toggle("lit", !!lit);
    const txt = candleBtn.querySelector(".candle-text");
    if(txt) txt.textContent = lit ? "נר דולק" : "הדלקת נר";
    if(status) status.textContent = lit ? "נר דולק לזכרם. יהי זכרם ברוך." : "";
  }

  async function renderSharedCount(){
    try{
      const client = supa();
      const { data } = await client.from("candles").select("count").eq("person_id", pid).maybeSingle();
      const c = data?.count ?? 0;
      if(countEl) countEl.textContent = `${c} נרות הודלקו (סה״כ)`;
    }catch(e){
      if(countEl) countEl.textContent = "";
    }
  }
  function renderLocalCount(){
    const c = loadLocal(localCountKey, 0);
    if(countEl) countEl.textContent = `${c} נרות הודלקו במכשיר זה`;
  }

  async function onCandle(){
    if(!candleBtn) return;
    if(!usingShared){
      // local toggle + counter (תחושה של פעולה)
      let lit = localStorage.getItem(litKey) === "1";
      let c = loadLocal(localCountKey, 0);
      if(!lit){ c += 1; lit = true; }
      else { lit = false; }
      localStorage.setItem(litKey, lit ? "1" : "0");
      saveLocal(localCountKey, c);
      setLit(lit);
      renderLocalCount();
      return;
    }

    // shared (Supabase): פעם ביום למכשיר
    const today = ymdNow();
    const last = loadLocal(throttleKey, "");
    if(last === today){
      setLit(true);
      if(status) status.textContent = "כבר הודלק נר היום במכשיר זה. תודה.";
      await renderSharedCount();
      return;
    }
    try{
      const client = supa();
      const { data, error } = await client.rpc("increment_candle", { pid });
      if(error) throw error;
      saveLocal(throttleKey, today);
      setLit(true);
      if(countEl) countEl.textContent = `${data ?? "—"} נרות הודלקו (סה״כ)`;
    }catch(e){
      console.error(e);
      if(status) status.textContent = "לא הצלחנו להדליק נר כרגע.";
    }
  }

  if(candleBtn){
    setLit(localStorage.getItem(litKey) === "1");
    candleBtn.addEventListener("click", onCandle);
  }

  // initial counter
  if(usingShared) { renderSharedCount(); }
  else { renderLocalCount(); }

  if(shareBtn){
    shareBtn.addEventListener("click", async ()=>{
      const url = location.href;
      const title = pname ? ("לזכר " + pname) : document.title;
      try{
        if(navigator.share){
          await navigator.share({ title, url });
          return;
        }
      }catch(e){}
      try{
        await navigator.clipboard.writeText(url);
        if(status) status.textContent = "הקישור הועתק ללוח.";
      }catch(e){
        prompt("העתיקו את הקישור:", url);
      }
    });
  }

  // ========= ספר אורחים (בדפים הסטטיים p/*.html) =========
  try{ initLiteGuestbook(pid, pname, usingShared); }catch(e){}

  // ========= הקראת טקסט (נגישות) =========
  try{ initMemorialTTS(); }catch(e){}
}



document.addEventListener('DOMContentLoaded', ()=>{ try{ initLitePersonPage(); }catch(e){} });



/* =======================
   Accessibility (נגישות)
   - הגדלת טקסט (כפתור צף)
   - הקראת טקסט בדפי זיכרון
======================= */
function initA11yWidget(){
  const key = "font-scale";
  const html = document.documentElement;
  const saved = localStorage.getItem(key) || "1";
  html.classList.toggle("font-lg", saved === "2");

  if(document.getElementById("a11yFontBtn")) return;

  const btn = document.createElement("button");
  btn.id = "a11yFontBtn";
  btn.type = "button";
  btn.className = "a11y-fab";
  btn.setAttribute("aria-label", "הגדלת טקסט");
  btn.setAttribute("aria-pressed", saved === "2" ? "true" : "false");
  btn.innerHTML = `<span aria-hidden="true">Aa</span><span class="sr">הגדלת טקסט</span>`;
  document.body.appendChild(btn);

  btn.addEventListener("click", ()=>{
    const on = html.classList.toggle("font-lg");
    localStorage.setItem(key, on ? "2" : "1");
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.title = on ? "טקסט מוגדל פעיל" : "טקסט רגיל";
  });
}

let __ttsSpeaking = false;
function initMemorialTTS(){
  const story = document.querySelector(".story-section");
  if(!story) return;
  if(!("speechSynthesis" in window)) return;

  // add button once
  if(story.querySelector("#speakBtn")) return;

  const btn = document.createElement("button");
  btn.id = "speakBtn";
  btn.type = "button";
  btn.className = "btn small tts-btn";
  btn.setAttribute("aria-pressed","false");
  btn.innerHTML = `<span aria-hidden="true">🔊</span> <span class="tts-label">השמע</span>`;

  const h2 = story.querySelector("h2");
  if(h2){
    const row = document.createElement("div");
    row.className = "tts-row";
    row.appendChild(btn);
    h2.insertAdjacentElement("afterend", row);
  }else{
    story.insertAdjacentElement("afterbegin", btn);
  }

  function collectText(){
    // clone to avoid reading UI labels
    const clone = story.cloneNode(true);
    clone.querySelectorAll("button, .tts-row").forEach(n=>n.remove());
    return (clone.innerText || "").replace(/\s+/g," ").trim();
  }

  function stop(){
    try{ window.speechSynthesis.cancel(); }catch(e){}
    __ttsSpeaking = false;
    btn.setAttribute("aria-pressed","false");
    btn.querySelector(".tts-label").textContent = "השמע";
    btn.firstElementChild.textContent = "🔊";
  }

  btn.addEventListener("click", ()=>{
    if(__ttsSpeaking){ stop(); return; }
    const text = collectText();
    if(!text) return;

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "he-IL";
    u.rate = 0.95;
    u.onend = stop;
    u.onerror = stop;

    __ttsSpeaking = true;
    btn.setAttribute("aria-pressed","true");
    btn.querySelector(".tts-label").textContent = "עצור";
    btn.firstElementChild.textContent = "⏹️";

    try{ window.speechSynthesis.cancel(); }catch(e){}
    window.speechSynthesis.speak(u);
  });

  // stop reading when leaving page
  window.addEventListener("beforeunload", stop);
}

/* =======================
   Lite memorial pages (p/*.html) – Guestbook + moderation
======================= */
function initLiteGuestbook(pid, pname, usingShared){
  // only on p/*.html: detect by data-person-id + the absence of existing guestbook blocks
  const shell = document.querySelector(".memorial-shell") || document.querySelector(".memorial-container") || document.querySelector("main");
  if(!shell) return;
  if(document.getElementById("guestFormLite") || document.getElementById("guestListLite")) return;

  // Build UI
  const sec = document.createElement("section");
  sec.className = "section";
  sec.innerHTML = `
    <h2 class="section-title">ספר אורחים</h2>
    <div class="wrap grid cols-2">
      <form id="guestFormLite" class="card list" aria-label="כתבו כמה מילים">
        <h3>כתבו כמה מילים</h3>
        <p class="muted">אפשר להשאיר משפט קצר של זיכרון/געגוע/תודה.</p>
        <label class="sr" for="byLite">שם (אופציונלי)</label>
        <input id="byLite" name="by" placeholder="שם (אופציונלי)" />
        <label class="sr" for="textLite">הודעה</label>
        <textarea id="textLite" name="text" placeholder="מה תרצו לכתוב?" required></textarea>
        <div style="margin-top:10px;">
          <button class="btn primary" type="submit">שליחה</button>
          <p class="tiny muted" style="margin-top:8px;">
            ${usingShared ? "במצב “משותף”: ההודעות נשלחות לאישור ויופיעו לאחר בדיקה." : "במצב מקומי: ההודעות נשמרות רק במכשיר שלך."}
          </p>
        </div>
      </form>

      <aside class="card list">
        <h3>מילים שנכתבו</h3>
        <div id="guestListLite"></div>
      </aside>
    </div>
  `;

  // append near end, but before footer if possible
  const main = document.getElementById("main") || document.querySelector("main");
  if(main) main.appendChild(sec);
  else shell.appendChild(sec);

  const guestList = document.getElementById("guestListLite");
  const guestForm = document.getElementById("guestFormLite");

  const gbKey = `guestbook_${pid}`;
  let entriesLocal = loadLocal(gbKey, []);

  async function renderShared(){
    const client = supa();
    const { data, error } = await client
      .from("guestbook_entries")
      .select("by,text,created_at")
      .eq("person_id", pid)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if(error){
      console.error(error);
      if(guestList) guestList.innerHTML = `<p class="muted">לא ניתן לטעון הודעות כרגע.</p>`;
      return;
    }
    if(!data?.length){
      if(guestList) guestList.innerHTML = `<p class="muted">עדיין אין כאן מילים. אפשר להיות הראשונים.</p>`;
      return;
    }
    if(guestList){
      guestList.innerHTML = data.map(e=>{
        const d = new Date(e.created_at);
        const date = d.toLocaleDateString("he-IL", { year:"numeric", month:"2-digit", day:"2-digit" });
        return `
          <article class="card list" style="padding:14px;">
            <div class="person-meta">
              <span>${escapeHtml(e.by || "אנונימי")}</span>
              <span>${escapeHtml(date)}</span>
            </div>
            <p style="margin:10px 0 0; line-height:1.85; color: rgba(255,255,255,.84);">${escapeHtml(e.text)}</p>
          </article>
        `;
      }).join("");
    }
  }

  function renderLocal(){
    if(!guestList) return;
    if(!entriesLocal.length){
      guestList.innerHTML = `<p class="muted">עדיין אין כאן מילים. אפשר להיות הראשונים.</p>`;
      return;
    }
    guestList.innerHTML = entriesLocal.slice().reverse().map(e => `
      <article class="card list" style="padding:14px;">
        <div class="person-meta">
          <span>${escapeHtml(e.by || "אנונימי")}</span>
          <span>${escapeHtml(e.date)}</span>
        </div>
        <p style="margin:10px 0 0; line-height:1.85; color: rgba(255,255,255,.84);">${escapeHtml(e.text)}</p>
      </article>
    `).join("");
  }

  guestForm?.addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    const by = (guestForm.by?.value || "").trim();
    const text = (guestForm.text?.value || "").trim();
    if(!text) return;

    if(!usingShared){
      const d = new Date();
      const date = d.toLocaleDateString("he-IL", { year:"numeric", month:"2-digit", day:"2-digit" });
      entriesLocal.push({ by: by || "אנונימי", text, date });
      saveLocal(gbKey, entriesLocal);
      guestForm.reset();
      renderLocal();
      return;
    }

    try{
      const client = supa();
      const { error } = await client.from("guestbook_entries").insert([{
        person_id: pid,
        by: by || "אנונימי",
        text,
        approved: false
      }]);
      guestForm.reset();
      if(error) throw error;
      if(guestList) guestList.innerHTML = `<p class="muted">תודה. המילים נשלחו לאישור ויופיעו לאחר בדיקה.</p>`;
    }catch(e){
      console.error(e);
      if(guestList) guestList.innerHTML = `<p class="muted">לא הצלחנו לשלוח כרגע. נסו שוב מאוחר יותר.</p>`;
    }
  });

  if(usingShared) renderShared();
  else renderLocal();
}

/* =======================
   “שלחו לנו זיכרון” – טופס/מייל מה-Footer
======================= */
let __siteCfg = null;
async function loadSiteConfig(){
  if(__siteCfg) return __siteCfg;
  try{
    const r = await fetch(siteUrl("data/site_config.json"), { cache: "no-store" });
    if(!r.ok) throw new Error("no cfg");
    __siteCfg = await r.json();
  }catch(e){
    __siteCfg = { contactEmail:"", contactFormEndpoint:"" };
  }
  return __siteCfg;
}

function initFooterMemoryModal(){
  const footer = document.querySelector(".site-footer");
  if(!footer) return;

  // add button once
  if(document.getElementById("memoryBtn")) return;

  // create a small block in footer grid
  const grid = footer.querySelector(".footer-grid");
  if(grid){
    const box = document.createElement("div");
    box.innerHTML = `
      <strong>שלחו לנו זיכרון</strong>
      <p class="muted small" style="margin:6px 0 10px;">תמונה, סיפור קצר או תיקון — נשמח לקבל.</p>
      <button class="btn small" id="memoryBtn" type="button">שליחת זיכרון</button>
    `;
    grid.appendChild(box);
  }

  const modal = document.createElement("div");
  modal.id = "memoryModal";
  modal.className = "modal";
  modal.setAttribute("role","dialog");
  modal.setAttribute("aria-modal","true");
  modal.setAttribute("aria-labelledby","memoryTitle");
  modal.hidden = true;

  const personName = document.body?.dataset?.personName || document.getElementById("personName")?.textContent || "";

  modal.innerHTML = `
    <div class="modal-backdrop" data-close="1"></div>
    <div class="modal-card">
      <button class="modal-close" type="button" data-close="1" aria-label="סגירה">×</button>
      <h2 id="memoryTitle">שלחו לנו זיכרון</h2>
      <p class="muted" style="margin-top:6px;">אפשר לשלוח תמונה, סיפור קצר, או תיקון מידע. הכל עולה לאתר רק לאחר בדיקה.</p>

      <form id="memoryForm" class="modal-form">
        <label class="sr" for="memPerson">שם</label>
        <input id="memPerson" name="person" placeholder="שם האדם (אופציונלי)" value="${escapeAttr(personName)}" />

        <label class="sr" for="memFrom">מייל / טלפון (אופציונלי)</label>
        <input id="memFrom" name="from" placeholder="מייל / טלפון (אופציונלי)" />

        <label class="sr" for="memText">מה תרצו לשלוח?</label>
        <textarea id="memText" name="text" placeholder="מה תרצו לשלוח?" required></textarea>

        <div class="modal-actions">
          <button class="btn primary" type="submit">שליחה</button>
          <button class="btn" type="button" data-close="1">ביטול</button>
        </div>

        <p class="tiny muted" style="margin-top:10px;">
          אם תבחרו לשלוח דרך מייל – תוכלו לצרף קבצים (תמונה) ידנית בחלון המייל.
        </p>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  function open(){
    modal.hidden = false;
    document.body.classList.add("modal-open");
    setTimeout(()=> modal.querySelector("#memText")?.focus(), 10);
  }
  function close(){
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  document.getElementById("memoryBtn")?.addEventListener("click", open);
  modal.addEventListener("click", (ev)=>{
    if(ev.target?.dataset?.close) close();
  });
  document.addEventListener("keydown", (ev)=>{
    if(!modal.hidden && ev.key === "Escape") close();
  });

  modal.querySelector("#memoryForm")?.addEventListener("submit", async (ev)=>{
    ev.preventDefault();
    const form = ev.currentTarget;
    const person = (form.person?.value || "").trim();
    const from = (form.from?.value || "").trim();
    const text = (form.text?.value || "").trim();
    if(!text) return;

    const cfg = await loadSiteConfig();

    // If endpoint configured – post JSON (simple)
    if(cfg && cfg.contactFormEndpoint){
      try{
        const res = await fetch(cfg.contactFormEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person, from, text, page: location.href })
        });
        if(!res.ok) throw new Error("bad");
        form.reset();
        close();
        alert("תודה. הזיכרון נשלח לבדיקה.");
        return;
      }catch(e){
        console.error(e);
        alert("לא הצלחנו לשלוח כרגע. נסו שוב או שלחו במייל.");
      }
    }

    // Fallback: mailto if email exists
    if(cfg && cfg.contactEmail){
      const subject = encodeURIComponent(`זיכרון / תיקון – ${person || "אתר הנצחה"}`);
      const body = encodeURIComponent(
        `עמוד: ${location.href}\n` +
        (person ? `אדם: ${person}\n` : "") +
        (from ? `פרטי קשר: ${from}\n` : "") +
        `\n${text}\n\n(אפשר לצרף תמונה למייל)`
      );
      location.href = `mailto:${encodeURIComponent(cfg.contactEmail)}?subject=${subject}&body=${body}`;
      close();
      return;
    }

    // Final fallback: עמוד אודות / הוספה
    close();
    location.href = siteUrl("about.html#how");
  });
}

/* =======================
   Upgrade: places.html "מפת הזיכרון" – נקודות על מפה (ויזואלית)
======================= */
async function initPlacesMap(){
  const box = document.getElementById("placeMapBox");
  if(!box) return;

  const people = await loadPeople();
  const map = new Map();
  for(const p of people) map.set(p.place, (map.get(p.place) || 0) + 1);
  const places = Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0],"he"));

  // Rough relative positions (percent) for a small “memory map”
  const POS = {
    "ארז": { x: 38, y: 18 },
    "גבים": { x: 55, y: 22 },
    "יכיני": { x: 70, y: 32 },
    "ניר עם": { x: 30, y: 40 },
    "נחל עוז": { x: 56, y: 55 },
    "כפר עזה": { x: 48, y: 66 }
  };

  box.innerHTML = `
    <div class="map-head">
      <h2 class="section-title" style="margin:0;">מפת הזיכרון</h2>
      <p class="muted" style="margin:6px 0 0;">לחצו על יישוב כדי לפתוח את דף הקהילה.</p>
    </div>

    <div class="sng-map" role="img" aria-label="מפה אינטראקטיבית של יישובי שער הנגב">
      <div class="sng-map-bg" aria-hidden="true"></div>
      ${places.map(([pl,n])=>{
        const pos = POS[pl] || { x: 50, y: 50 };
        return `
          <a class="sng-pin" style="--x:${pos.x}%;--y:${pos.y}%;" href="${siteUrl("place/"+encodeURIComponent(placeSlug(pl))+".html")}" aria-label="${escapeAttr(pl)} (${n})">
            <span class="pin-dot" aria-hidden="true"></span>
            <span class="pin-label">${escapeHtml(pl)}</span>
            <span class="pin-count">${n}</span>
          </a>
        `;
      }).join("")}
    </div>

    <div class="map-list" aria-label="רשימה (נגישות)" style="margin-top:12px;">
      ${places.map(([pl,n])=>`
        <a class="dot" href="${siteUrl("place/"+encodeURIComponent(placeSlug(pl))+".html")}">
          <span class="dot-name">${escapeHtml(pl)}</span>
          <span class="dot-count">${n}</span>
        </a>
      `).join("")}
    </div>
  `;
}

function initShareSite(){
  const btn = document.getElementById("shareSiteBtn");
  if(!btn) return;
  btn.addEventListener("click", async ()=>{
    const url = location.origin + location.pathname.replace(/\/[^\/]*$/, "/");
    const title = "אתר הנצחה | ספר זיכרון";
    try{
      if(navigator.share){
        await navigator.share({ title, url });
        return;
      }
    }catch(e){}
    try{
      await navigator.clipboard.writeText(url);
      btn.textContent = "הועתק!";
      setTimeout(()=> btn.textContent = "שיתוף", 1200);
    }catch(e){
      prompt("העתיקו את הקישור:", url);
    }
  });
}
document.addEventListener('DOMContentLoaded', ()=>{ try{ initShareSite(); }catch(e){} });

function initWhatsAppShare(){
  const btn = document.getElementById("whatsAppBtn");
  if(!btn) return;
  btn.addEventListener("click", ()=>{
    const url = location.href;
    const msg = "אתר הנצחה | ספר זיכרון: " + url;
    const wa = "https://wa.me/?text=" + encodeURIComponent(msg);
    window.open(wa, "_blank", "noopener");
  });
}
document.addEventListener('DOMContentLoaded', ()=>{ try{ initWhatsAppShare(); }catch(e){} });


// Extra inits (safe, independent)
document.addEventListener("DOMContentLoaded", ()=>{
  try{ initA11yWidget(); }catch(e){}
  try{ initFooterMemoryModal(); }catch(e){}
  try{ initMemorialTTS(); }catch(e){}
});
