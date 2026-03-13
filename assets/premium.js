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
