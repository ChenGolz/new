/* Premium “מושקע” layer – tiny, safe enhancements (no framework). */

(function(){
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
    if (reduceMotion) document.body.classList.add('is-loaded');
    else requestAnimationFrame(() => document.body.classList.add('is-loaded'));

    // add subtle polish    addAmbient();
    if (!reduceMotion) {
      addProgress();
      initReveal();
      // re-run reveal after the app renders dynamic lists
      setTimeout(initReveal, 300);
      setTimeout(initReveal, 900);
    }
  });
})();
