/* Premium “מושקע” layer – tiny, safe enhancements (no framework). */

(function(){
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function addAmbient(){
    if(document.getElementById('ambient')) return document.getElementById('ambient');
    const amb = document.createElement('div');
    amb.id = 'ambient';
    const positions = [
      ['8%','6%'],
      ['74%','18%'],
      ['22%','62%'],
      ['58%','78%'],
      ['48%','34%']
    ];
    positions.forEach((pos, i) => {
      const s = document.createElement('span');
      s.style.left = pos[0];
      s.style.top = pos[1];
      s.style.animationDelay = (i * -0.8) + 's';
      if(i === positions.length - 1) s.classList.add('ambient-follower');
      amb.appendChild(s);
    });
    document.body.appendChild(amb);

    const follower = amb.querySelector('.ambient-follower');
    if(follower){
      let tx = window.innerWidth * 0.5;
      let ty = window.innerHeight * 0.3;
      const move = (x, y) => {
        tx = x; ty = y;
        follower.style.left = x + 'px';
        follower.style.top = y + 'px';
      };
      move(tx, ty);
      window.addEventListener('mousemove', (e) => {
        move(e.clientX - follower.offsetWidth * 0.5, e.clientY - follower.offsetHeight * 0.5);
      }, { passive: true });
    }
    return amb;
  }

  function addCommunityLanterns(){
    if(document.getElementById('communityLanterns')) return;
    const root = document.createElement('div');
    root.id = 'communityLanterns';
    root.innerHTML = `<div class="lantern-dots" aria-hidden="true"></div><div class="lantern-label">זוכרים יחד</div>`;
    document.body.appendChild(root);
    const dots = root.querySelector('.lantern-dots');
    const label = root.querySelector('.lantern-label');

    function render(count){
      const shown = Math.max(1, Math.min(Number(count) || 1, 8));
      dots.innerHTML = Array.from({length: shown}, (_,i) => `<span class="lantern-dot" style="animation-delay:${i * .35}s"></span>`).join('');
      label.textContent = count > 1 ? `כרגע ישנם ${count} אנשים שמתייחדים עם זכרם` : 'זוכרים יחד';
    }
    render(1);

    try{
      const cfg = window.BACKEND || null;
      if(!(cfg && cfg.provider === 'supabase' && cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase)) return;
      const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const channel = client.channel('memorial-presence', {
        config: { presence: { key: `visitor-${Math.random().toString(36).slice(2,10)}` } }
      });
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const count = Object.keys(state || {}).length || 1;
          render(count);
        })
        .subscribe(async (status) => {
          if(status === 'SUBSCRIBED'){
            await channel.track({ page: location.pathname, at: Date.now() });
          }
        });
      window.addEventListener('beforeunload', () => { try{ channel.untrack(); }catch(e){} });
    }catch(e){}
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
    requestAnimationFrame(() => document.body.classList.add('is-loaded'));
    addAmbient();
    addProgress();
    initReveal();
    addCommunityLanterns();
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
