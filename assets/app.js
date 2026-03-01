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

  function render() {
    const q = (search?.value || "").trim();
    const pl = (placeSelect?.value || "");
    const list = people.filter(p => {
      const okPlace = !pl || p.place === pl;
      const okName = !q || p.name.includes(q);
      return okPlace && okName;
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
        <a class="btn primary" href="${siteUrl("p/" + escapeHtml(p.id) + ".html")}">לפתיחה</a>
      </div>
    </article>`;
  }).join("");
}

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

  title.textContent = pl;
  if (sub) sub.textContent = `${list.length} אנשים`;
  if (intro) intro.textContent = placeIntro(pl);

  root.innerHTML = list.map(p => `
    <article class="card person-card">
      <div class="person-meta"><span>${escapeHtml(pl)}</span><span>דף אישי</span></div>
      <h3>${escapeHtml(p.name)}</h3>
      <p class="muted">ספר זיכרון דיגיטלי.</p>
      <a class="readmore" href="${siteUrl("p/" + encodeURIComponent(p.id) + ".html")}">לספר הזיכרון →</a>
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
  try{ document.body.classList.add("is-loaded"); }catch{}
  setYear();
  bindMenu();
  setActiveNav();

  try {
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
