/* Premium “מושקע” layer – tiny, safe enhancements (no framework). */

(function(){
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function addAmbient(){
    const amb = document.createElement('div');
    amb.id = 'ambient';
    const count = 4;
    for(let i=0;i<count;i++){
      const s = document.createElement('span');
      // distributed positions (rtl-friendly)
      const left = (i===0)? '8%' : (i===1? '74%' : (i===2? '22%' : '58%'));
      const top  = (i===0)? '6%' : (i===1? '18%' : (i===2? '62%' : '78%'));
      s.style.left = left;
      s.style.top = top;
      s.style.animationDelay = (i * -4) + 's';
      amb.appendChild(s);
    }
    document.body.appendChild(amb);
  }

  function addProgress(){
    const bar = document.createElement('div');
    bar.id = 'scrollProgress';
    document.body.appendChild(bar);

    const onScroll = () => {
      const doc = document.documentElement;
      const max = (doc.scrollHeight - doc.clientHeight) || 1;
      const p = clamp((doc.scrollTop || window.scrollY || 0) / max, 0, 1);
      bar.style.transform = `scaleX(${p})`;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initReveal(){
    const els = Array.from(document.querySelectorAll('.hero, .card, .person-card, .place-card, .grid > *'))
      .filter(el => !el.classList.contains('reveal'));
    els.forEach(el => el.classList.add('reveal'));

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.12, rootMargin: '60px 0px' });

    els.forEach(el => io.observe(el));
  }

  document.addEventListener('DOMContentLoaded', () => {
    // “loaded” transition
    requestAnimationFrame(() => document.body.classList.add('is-loaded'));

    // add subtle polish
    addAmbient();
    addProgress();
    initReveal();

    // re-run reveal after the app renders dynamic lists
    setTimeout(initReveal, 300);
    setTimeout(initReveal, 900);
  });

  function upgradeMemorialCards(){
    try{
      document.querySelectorAll('.card.person-card').forEach(card=>{
        if(card.classList.contains('memorial-card')) return;
        const a = card.querySelector('a[href*="p/p"]');
        if(!a) return;
        const href = a.getAttribute('href') || '';
        const m = href.match(/p\/(p\d+)\.html/);
        if(!m) return;
        const id = m[1];

        // derive relative prefix from link (people.html vs /place/* etc.)
        let prefix = '';
        if(href.startsWith('../')) prefix = '../';
        else if(href.startsWith('../../')) prefix = '../../';

        card.classList.add('memorial-card');
        card.style.setProperty('--card-bg', `url(${prefix}assets/people/${id}.jpg), url(${prefix}assets/og-person/${id}.png)`);

        // make whole card clickable
        card.addEventListener('click', (e)=>{
          const t = e.target;
          if(t && (t.tagName === 'A' || t.closest('a'))) return;
          window.location.href = href;
        });

        // accessibility: keep focusable link
        a.setAttribute('aria-label', `פתיחה: ${card.querySelector('.person-name')?.textContent?.trim() || ''}`);
      });
    }catch(e){}
  }

  upgradeMemorialCards();
})();


(function(){
  function addAmbientFollower(){
    const amb = document.getElementById('ambient');
    if(!amb) return;
    if(amb.querySelector('.ambient-follower')) return;
    const f = document.createElement('span');
    f.className = 'ambient-follower';
    amb.appendChild(f);
    let tx = window.innerWidth * 0.35, ty = window.innerHeight * 0.25;
    let x = tx, y = ty;
    const onMove = (ev)=>{
      tx = ev.clientX;
      ty = ev.clientY;
    };
    window.addEventListener('mousemove', onMove, { passive:true });
    function tick(){
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      f.style.left = x + 'px';
      f.style.top = y + 'px';
      requestAnimationFrame(tick);
    }
    tick();
  }

  function initUnityCandle(){
    if(document.querySelector('.unity-candle-btn')) return;
    const key = 'global-memory-candle-count';
    const litKey = 'global-memory-candle-lit';
    const current = parseInt(localStorage.getItem(key) || '7240', 10) || 7240;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'unity-candle-btn';
    btn.innerHTML = '<span class="flame-dot" aria-hidden="true"></span><span class="txt">הדלקת נר</span><span class="count">'+ current.toLocaleString('he-IL') +'</span>';
    document.body.appendChild(btn);

    const host = document.querySelector('.site-header .brand .meta') || document.querySelector('.site-header .nav');
    let badge = document.querySelector('.header-flame-badge');
    if(!badge && host){
      badge = document.createElement('span');
      badge.className = 'header-flame-badge';
      badge.innerHTML = '<span class="header-flame-dot" aria-hidden="true"></span><span>נר זיכרון</span>';
      host.appendChild(badge);
    }
    const setLit = (lit)=>{
      btn.classList.toggle('is-lit', lit);
      badge?.querySelector('.header-flame-dot')?.classList.toggle('is-lit', lit);
      const txt = btn.querySelector('.txt');
      if(txt) txt.textContent = lit ? 'הנר דולק' : 'הדלקת נר';
    };
    setLit(localStorage.getItem(litKey)==='1');
    btn.addEventListener('click', ()=>{
      let count = parseInt(localStorage.getItem(key) || String(current), 10) || current;
      const lit = localStorage.getItem(litKey)==='1';
      if(!lit){
        count += 1;
        localStorage.setItem(key, String(count));
        localStorage.setItem(litKey, '1');
        const countEl = btn.querySelector('.count');
        if(countEl) countEl.textContent = count.toLocaleString('he-IL');
      }
      setLit(true);
      if(navigator.vibrate) try{ navigator.vibrate(45); }catch(e){}
    }, { passive:true });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(addAmbientFollower, 60);
    setTimeout(initUnityCandle, 180);
  });
})();


(function(){
  function premiumBase(){
    try{
      const me = Array.from(document.scripts || []).find(s => (s.src || '').includes('/assets/premium.js'));
      if(!me || !me.src) return './';
      const u = new URL(me.src, location.href);
      return u.href.replace(/assets\/premium\.js.*$/, '');
    }catch(e){ return './'; }
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const existing = Array.from(document.scripts).find(s => s.src === src);
      if(existing){ if(existing.dataset.loaded === '1' || existing.readyState === 'complete') return resolve(); existing.addEventListener('load', ()=>resolve(), {once:true}); existing.addEventListener('error', reject, {once:true}); return; }
      const s = document.createElement('script');
      s.src = src; s.defer = true;
      s.onload = ()=>{ s.dataset.loaded = '1'; resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensurePresenceDeps(){
    const base = premiumBase();
    if(!window.BACKEND){
      try{ await loadScript(base + 'assets/backend-config.js'); }catch(e){}
    }
    if(window.BACKEND && window.BACKEND.provider === 'supabase' && !window.supabase){
      try{ await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'); }catch(e){}
    }
    return !!(window.BACKEND && window.BACKEND.provider === 'supabase' && window.BACKEND.supabaseUrl && window.BACKEND.supabaseAnonKey && window.supabase);
  }

  async function initLivePulse(){
    const ok = await ensurePresenceDeps();
    if(!ok) return;
    try{
      const client = window.supabase.createClient(window.BACKEND.supabaseUrl, window.BACKEND.supabaseAnonKey);
      const host = document.querySelector('.site-header .nav') || document.querySelector('.site-header .wrap');
      const footer = document.querySelector('.site-footer .footer-bottom') || document.querySelector('.site-footer .wrap');
      const badge = document.createElement('div');
      badge.className = 'live-presence-badge';
      badge.hidden = true;
      badge.innerHTML = '<span class="live-dot" aria-hidden="true"></span><span class="live-label">כרגע ישנם — אנשים שמתייחדים עם זכרם</span>';
      host && host.appendChild(badge);
      let footerBadge = null;
      if(footer){ footerBadge = badge.cloneNode(true); footer.appendChild(footerBadge); }
      const renderCount = (n)=>{
        const text = `כרגע ישנם ${n} אנשים שמתייחדים עם זכרם`;
        [badge, footerBadge].filter(Boolean).forEach(el=>{ el.hidden = false; const label = el.querySelector('.live-label'); if(label) label.textContent = text; });
      };
      const channel = client.channel('memorial-presence', {
        config:{ presence:{ key: `visitor-${Math.random().toString(36).slice(2,10)}` } }
      });
      channel
        .on('presence', { event:'sync' }, ()=>{
          const state = channel.presenceState();
          const count = Object.keys(state || {}).length;
          renderCount(Math.max(count,1));
        })
        .subscribe(async (status)=>{
          if(status === 'SUBSCRIBED'){
            await channel.track({ path: location.pathname, at: Date.now() });
          }
        });
      window.addEventListener('pagehide', ()=>{ try{ client.removeChannel(channel); }catch(e){} }, { once:true });
    }catch(e){}
  }

  document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(initLivePulse, 260); });
})();
