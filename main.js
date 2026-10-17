/* ==========================================================================
   SLIET TechFest — scroll-driven experience
   Modules: sequence (canvas), heroLogo, parallax, nav, sideBar, cards, loop
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- Config ---------- */
  const CONFIG = {
    frameCount: 192,
    framePath: (n) => `assets/frames/frame-${String(n).padStart(3, '0')}.webp`,
    parallaxStrength: 30,        // px the background shifts with the cursor
    parallaxScale: 1.08,         // zoom so edges never show while shifting
    cardsStart: 0.82,            // scroll progress where the first card appears
    cardsStagger: 0.04,          // delay between cards
    cardsDuration: 0.09,         // progress span of each card's entrance
  };

  /* ---------- Helpers ---------- */
  const $  = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
  const scrollProgress = () => {
    const max = maxScroll();
    return max > 0 ? clamp(scrollY / max) : 0;
  };

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Background: canvas image sequence ---------- */
  const sequence = (() => {
    const canvas = $('#sequence');
    const ctx = canvas.getContext('2d');
    let current = -1;
    let dirty = true;

    const frames = Array.from({ length: CONFIG.frameCount }, (_, i) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { if (i === current) dirty = true; };
      img.src = CONFIG.framePath(i + 1);
      return img;
    });

    // Nearest loaded frame at or before the index, so we never draw a blank
    function loadedFrame(index) {
      for (let i = index; i >= 0; i--) {
        if (frames[i].complete && frames[i].naturalWidth) return frames[i];
      }
      return null;
    }

    function draw(index) {
      const img = loadedFrame(index);
      if (!img) return;
      const { width: cw, height: ch } = canvas;
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight); // cover
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      dirty = true;
    }

    function update(progress) {
      const index = Math.round(progress * (CONFIG.frameCount - 1));
      if (index !== current || dirty) {
        current = index;
        dirty = false;
        draw(index);
      }
    }

    return { canvas, resize, update };
  })();

  /* ---------- Hero logo: moves up and fades on scroll ---------- */
  const heroLogo = (() => {
    const el = $('#heroLogo');
    function update() {
      const y = scrollY;
      el.style.transform = `translate3d(0, ${-y * 1.1}px, 0)`;
      el.style.opacity = clamp(1 - y / (innerHeight * 0.55));
    }
    return { update };
  })();

  /* ---------- Parallax: background follows the cursor ---------- */
  const parallax = (() => {
    let tx = 0, ty = 0, x = 0, y = 0;

    if (!reduceMotion) {
      addEventListener('mousemove', (e) => {
        tx = (e.clientX / innerWidth - 0.5) * -CONFIG.parallaxStrength;
        ty = (e.clientY / innerHeight - 0.5) * -CONFIG.parallaxStrength;
      });
    }

    function update() {
      x = lerp(x, tx, 0.08);
      y = lerp(y, ty, 0.08);
      sequence.canvas.style.transform =
        `translate3d(${x}px, ${y}px, 0) scale(${CONFIG.parallaxScale})`;
    }
    return { update };
  })();

  /* ---------- Navigation ---------- */
  const nav = (() => {
    const links = $$('#navItems a');
    const highlight = $('#navHighlight');
    const count = links.length;

    // Scroll to the start of section i (sections split the scroll evenly)
    function goTo(i) {
      scrollTo({ top: (maxScroll() * i) / count + (i > 0 ? 2 : 0), behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    links.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        goTo(Number(link.dataset.section));
      });
      link.addEventListener('mousemove', (e) => {
        const r = link.getBoundingClientRect();
        link.style.setProperty('--x', `${e.clientX - r.left}px`);
        link.style.setProperty('--y', `${e.clientY - r.top}px`);
      });
    });

    // Highlight rests on the current button, then slides to the next one
    // during the last 30% of each section.
    function update(progress) {
      const section = Math.min(count - 1, Math.floor(progress * count));
      const within = progress * count - section;
      const t = smoothstep(clamp((within - 0.7) / 0.3));
      const from = links[section];
      const to = links[Math.min(count - 1, section + 1)];
      const left = lerp(from.offsetLeft, to.offsetLeft, t);
      const width = lerp(from.offsetWidth, to.offsetWidth, t);
      highlight.style.transform = `translateX(${left}px)`;
      highlight.style.width = `${width}px`;
    }

    return { links, goTo, update };
  })();

  /* ---------- Side progress bar ---------- */
  const sideBar = (() => {
    const root = $('#side');
    const fill = $('#sideFill');
    const dots = nav.links.map((link, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.style.top = `${(i / (nav.links.length - 1)) * 100}%`;
      dot.setAttribute('aria-label', link.textContent.trim());
      dot.innerHTML = `<i></i><span>${link.textContent.trim()}</span>`;
      dot.className = 'side__dot';
      dot.addEventListener('click', () => nav.goTo(i));
      root.appendChild(dot);
      return dot;
    });

    function update(progress) {
      fill.style.height = `${progress * 100}%`;
      const current = Math.round(progress * (dots.length - 1));
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-passed', progress >= i / (dots.length - 1) - 0.001);
        dot.classList.toggle('is-current', i === current);
      });
    }
    return { update };
  })();

  /* ---------- Cards: drop out of the header near the end ---------- */
  const cards = (() => {
    const items = $$('.card');

    items.forEach((card) => {
      const body = $('.card__body', card);
      card.addEventListener('click', (e) => {
        e.preventDefault();
        nav.goTo(Number(card.dataset.section));
      });
      card.addEventListener('mousemove', (e) => {
        const r = body.getBoundingClientRect();
        body.style.setProperty('--x', `${e.clientX - r.left}px`);
        body.style.setProperty('--y', `${e.clientY - r.top}px`);
      });
    });

    function update(progress) {
      items.forEach((card, i) => {
        const start = CONFIG.cardsStart + i * CONFIG.cardsStagger;
        const t = clamp((progress - start) / CONFIG.cardsDuration);
        const e = easeOutCubic(t);
        const offset = -(1 - e) * (card.offsetHeight + 90);
        card.style.transform = `translateY(${offset}px) scale(${0.9 + 0.1 * e})`;
        card.style.opacity = Math.min(1, t * 3);
        card.style.pointerEvents = t > 0.9 ? 'auto' : 'none';
      });
    }
    return { update };
  })();

  /* ---------- Main loop ---------- */
  function frame() {
    const progress = scrollProgress();
    sequence.update(progress);
    heroLogo.update();
    parallax.update();
    nav.update(progress);
    sideBar.update(progress);
    cards.update(progress);
    requestAnimationFrame(frame);
  }

  addEventListener('resize', sequence.resize);
  sequence.resize();
  requestAnimationFrame(frame);
})();
