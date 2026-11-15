// Shared behaviour for the Stillwork pages.
(() => {
  // Hairline under the header once the page has scrolled.
  const head = document.querySelector('.site-head');
  if (head) {
    const onScroll = () => head.classList.toggle('scrolled', window.scrollY > 8);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  }
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  // Nav hint: a small ember dot wanders around the links and settles under the one you point at.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nav = document.querySelector('.site-nav'); if (!nav) return;
  const dot = document.createElement('span'); dot.className = 'orbit'; nav.appendChild(dot);
  const rnd = (a, b) => a + Math.random() * (b - a);
  let th = rnd(0, 6.28), om = 0, omT = rnd(0.5, 1.4) * (Math.random() < .5 ? -1 : 1);
  let rs = 1.1, rsT = 1.1, m = 1, mT = 1, next = 0, hoverEl = null, hx = 0, tx = null, ty = null, last = performance.now(), t = 0, raf = 0;
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('mouseenter', () => hoverEl = a);
    a.addEventListener('mouseleave', () => hoverEl = null);
  });
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (t > next) {
      next = t + rnd(1.2, 4.5);
      const r = Math.random();
      omT = r < .15 ? rnd(-0.15, 0.15) : rnd(0.4, 2.2) * (Math.random() < .3 ? -Math.sign(omT || 1) : Math.sign(omT || 1));
      rsT = rnd(0.95, 1.3);
      if (Math.random() < .5) mT = mT > .5 ? 0 : 1;
    }
    om += (omT - om) * Math.min(1, dt * 1.5);
    rs += (rsT - rs) * Math.min(1, dt * 1.2);
    th += om * dt;
    const W = nav.offsetWidth, H = nav.offsetHeight;
    const wob = 1 + 0.06 * Math.sin(t * 2.3) + 0.04 * Math.sin(t * 3.7 + 1);
    m += (mT - m) * Math.min(1, dt * 0.6);
    const c = Math.cos(th), sn = Math.sin(th), q = 1 + sn * sn;
    const ex = c, ey = sn;                       // around the whole menu
    const lx = c / q, ly = sn * c / q / 0.354;   // figure eight: through the gap between the words
    const A = (W / 2 + 10) * rs * wob, B = (H / 2 + 6) * rs * wob;
    let x = W / 2 + A * (ex + (lx - ex) * m);
    let y = H / 2 + B * (ey + (ly - ey) * m);
    hx += ((hoverEl ? 1 : 0) - hx) * Math.min(1, dt * 7);
    if (hoverEl) { tx = hoverEl.offsetLeft + hoverEl.offsetWidth / 2; ty = hoverEl.offsetTop + hoverEl.offsetHeight - 3; }
    if (tx != null) { x += (tx - x) * hx; y += (ty - y) * hx; }
    dot.style.transform = `translate(${x - 2.5}px, ${y - 2.5}px)`;
    raf = requestAnimationFrame(frame);
  }
  // No need to animate a tab nobody is looking at.
  const run = () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', run);
  run();
})();
