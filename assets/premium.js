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

  function initMouseGlow(){
    const amb = document.getElementById("ambient");
    if(!amb) return;
    const glow = document.createElement("span");
    glow.className = "mouse-glow";
    amb.appendChild(glow);
    let tx = window.innerWidth * .65, ty = 180, x = tx, y = ty;
    window.addEventListener("pointermove", (e)=>{ tx = e.clientX; ty = e.clientY; }, {passive:true});
    function tick(){ x += (tx - x) * .06; y += (ty - y) * .06; glow.style.left = x + "px"; glow.style.top = y + "px"; requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
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
    initMouseGlow();
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
