/* =========================================================
   DJ Błażej Biurkowski | v2 – nawigacja + hero
   Bez bibliotek. Każdy moduł działa niezależnie (brak elementu = pomijany),
   więc plik można podpiąć w WordPressie na każdej podstronie.
   ========================================================= */
(() => {
  const root = document.documentElement;
  const header = document.querySelector('.bb-header');
  const hero = document.querySelector('.bb-hero');
  const mqDesktop = matchMedia('(min-width: 1024px)');
  const mqParallax = matchMedia('(min-width: 768px) and (prefers-reduced-motion: no-preference)');

  /* ---------- 1. Nagłówek h1: podział na słowa (stagger) ---------- */
  document.querySelectorAll('[data-split]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'bb-w';
      span.dataset.anim = '';
      span.style.setProperty('--d', `${140 + i * 70}ms`);
      span.textContent = word;
      el.append(span, i < words.length - 1 ? ' ' : '');
    });
    el.removeAttribute('data-anim');
  });

  /* ---------- 2. Start animacji wejścia, gdy fonty gotowe (max 500 ms) ---------- */
  Promise.race([document.fonts && document.fonts.ready, new Promise((r) => setTimeout(r, 500))])
    .then(() => requestAnimationFrame(() => root.classList.add('is-ready')));

  if (!header) return;

  /* ---------- 3. Nagłówek: tło + blur po scrollu > 40px ---------- */
  const sentinel = document.querySelector('.bb-top-sentinel');
  if (sentinel) {
    new IntersectionObserver(([entry]) => {
      header.classList.toggle('is-scrolled', !entry.isIntersecting);
    }).observe(sentinel);
  }

  /* ---------- 4. Dropdowny: hover + focus + klik, Escape zamyka ---------- */
  const dropdowns = [];
  header.querySelectorAll('.bb-nav .menu-item-has-children').forEach((li, i) => {
    const link = li.querySelector(':scope > a');
    const sub = li.querySelector(':scope > .sub-menu');
    if (!link || !sub) return;

    // Pozycja-rodzic bez adresu (href="#", jak w WP) staje się przyciskiem.
    // Gdy rodzic ma prawdziwy adres, zostaje link, a obok pojawia się przycisk ze strzałką.
    let toggle;
    const href = link.getAttribute('href');
    if (!href || href === '#') {
      toggle = document.createElement('button');
      toggle.innerHTML = link.innerHTML;
      link.replaceWith(toggle);
    } else {
      toggle = document.createElement('button');
      toggle.setAttribute('aria-label', `${link.textContent.trim()} – rozwiń`);
      link.after(toggle);
    }
    toggle.type = 'button';
    toggle.className = 'bb-nav__toggle';
    sub.id = sub.id || `bb-sub-${i}`;
    toggle.setAttribute('aria-controls', sub.id);
    toggle.setAttribute('aria-expanded', 'false');

    let closeTimer;
    let suppressFocusOpen = false;
    const set = (open) => {
      clearTimeout(closeTimer);
      li.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    const item = { li, toggle, set };
    dropdowns.push(item);

    // Kliknięcie myszą na desktopie tylko otwiera (hover już mogło otworzyć); Enter/Spacja przełączają.
    toggle.addEventListener('click', (e) => {
      if (mqDesktop.matches && e.detail > 0) set(true);
      else set(!li.classList.contains('is-open'));
    });

    li.addEventListener('mouseenter', () => {
      if (!mqDesktop.matches) return;
      dropdowns.forEach((d) => d !== item && d.set(false));
      set(true);
    });
    li.addEventListener('mouseleave', () => {
      if (!mqDesktop.matches) return;
      closeTimer = setTimeout(() => set(false), 160);
    });
    li.addEventListener('focusin', () => {
      if (!mqDesktop.matches) return;
      if (suppressFocusOpen) { suppressFocusOpen = false; return; }
      dropdowns.forEach((d) => d !== item && d.set(false));
      set(true);
    });
    li.addEventListener('focusout', (e) => {
      if (mqDesktop.matches && !li.contains(e.relatedTarget)) set(false);
    });
    li.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !li.classList.contains('is-open')) return;
      e.stopPropagation();
      suppressFocusOpen = true;
      set(false);
      toggle.focus();
    });
  });

  document.addEventListener('click', (e) => {
    dropdowns.forEach((d) => !d.li.contains(e.target) && mqDesktop.matches && d.set(false));
  });

  /* ---------- 5. Menu mobilne (pełnoekranowe) ---------- */
  const burger = header.querySelector('.bb-burger');
  const panel = burger && document.getElementById(burger.getAttribute('aria-controls'));
  const outside = [...document.body.children].filter((el) => el !== header && el.tagName !== 'SCRIPT');

  const setMenu = (open) => {
    if (!burger) return;
    header.classList.toggle('is-open', open);
    root.classList.toggle('bb-menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
    outside.forEach((el) => { el.inert = open; });   // fokus zostaje w menu
    if (!open) dropdowns.forEach((d) => d.set(false));
    updateSticky();
  };

  if (burger && panel) {
    burger.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
    panel.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (a && a.getAttribute('href') !== '#') setMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        setMenu(false);
        burger.focus();
      }
    });
    mqDesktop.addEventListener('change', () => setMenu(false));
  }

  /* ---------- 6. Sticky CTA (mobile/tablet) ---------- */
  const sticky = document.querySelector('.bb-sticky-cta');
  const heroCopy = document.querySelector('.bb-hero__copy');
  const heroCta = document.querySelector('.bb-hero__actions .bb-btn');   // na mobile ukryty (display: none)
  let pastCopy = false;
  let ctaInView = true;

  function updateSticky() {
    if (!sticky) return;
    sticky.classList.toggle('is-visible', pastCopy && !ctaInView && !header.classList.contains('is-open'));
  }
  if (sticky && heroCopy && heroCta) {
    new IntersectionObserver(([entry]) => {
      pastCopy = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      updateSticky();
    }).observe(heroCopy);
    new IntersectionObserver(([entry]) => {
      ctaInView = entry.isIntersecting;
      updateSticky();
    }).observe(heroCta);
  }

  /* ---------- 7. Paralaksa: tekst szybciej, postać wolniej, monogram najwolniej ---------- */
  const layers = hero ? [...hero.querySelectorAll('[data-parallax]')] : [];
  if (layers.length) {
    let heroH = hero.offsetHeight;
    let inView = true;
    let ticking = false;

    const render = () => {
      ticking = false;
      const y = mqParallax.matches ? Math.min(window.scrollY, heroH) : 0;
      layers.forEach((el) => el.style.setProperty('--bb-py', `${(y * parseFloat(el.dataset.parallax)).toFixed(1)}px`));
    };
    const request = () => {
      if (!ticking && inView) { ticking = true; requestAnimationFrame(render); }
    };

    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; request(); }).observe(hero);
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', () => { heroH = hero.offsetHeight; request(); }, { passive: true });
    mqParallax.addEventListener('change', render);
  }
})();
