/* =========================================================
   DJ Błażej Biurkowski | v2 – cała strona
   Bez bibliotek. Każdy moduł działa niezależnie (brak elementu = pomijany)
   i nie zależy od liczby pozycji, więc w WordPressie można dodawać
   i usuwać teksty, zdjęcia, opinie i filmy bez zmian w kodzie.
   ========================================================= */
(() => {
  const root = document.documentElement;
  const header = document.querySelector('.bb-header');
  const stage = document.querySelector('.bb-stage');
  const mqDesktop = matchMedia('(min-width: 1024px)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Start animacji wejścia, gdy fonty gotowe (max 500 ms) ---------- */
  const ready = Promise.race([document.fonts && document.fonts.ready, new Promise((r) => setTimeout(r, 500))]);
  ready.then(() => requestAnimationFrame(() => root.classList.add('is-ready')));

  /* ---------- 1b. Polska typografia: pojedyncze litery (a, i, o, u, w, z) nie zostają na końcu wiersza ---------- */
  const walker = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
  const orphan = /(^|\s)([aiouwzAIOUWZ])\s+/g;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (orphan.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(orphan, '$1$2\u00A0');
    orphan.lastIndex = 0;
  }

  /* ---------- 2. Nagłówek: jasny/ciemny tryb zależnie od sekcji pod nim ---------- */
  const sections = [...document.querySelectorAll('main > section')];
  function updateHeaderTheme() {
    if (!header) return;
    const y = header.offsetHeight / 2;
    const sec = sections.find((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; });
    const dark = !!sec && sec.dataset.theme === 'dark';
    header.classList.toggle('is-dark', dark);
  }
  let themeTick = false;
  addEventListener('scroll', () => {
    if (themeTick) return;
    themeTick = true;
    requestAnimationFrame(() => { themeTick = false; updateHeaderTheme(); });
  }, { passive: true });
  updateHeaderTheme();

  /* ---------- 2b. Hero: filmowe okręgi światła odsłaniają napis „Events” ----------
     Oś czasu (ms od startu): 0 czarna scena → 500 okręgi się pojawiają i krążą → do 4400 spiralnie
     zbiegają się na napis → 4100 rozbłysk odsłania całe hero → od 4300 okręgi przechodzą w swobodny dryf. */
  if (stage) {
    const word = stage.querySelector('.bb-stage__word');
    const title = stage.querySelector('.bb-stage__title');
    const content = stage.querySelector('.bb-stage__content');
    const veil = stage.querySelector('.bb-veil');
    const glow = stage.querySelector('.bb-glow');
    const rnd = (min, max) => min + Math.random() * (max - min);
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - ((-2 * p + 2) ** 3) / 2);
    const smooth = (p) => p * p * (3 - 2 * p);
    const T = { fadeIn: 500, fadeDur: 1100, spiral: 500, spiralDur: 3900, reveal: 4100, open: 6200, drift: 4300, driftDur: 2600 };

    let W = 0;
    let H = 0;
    let base = 900;
    let box = null;
    const measure = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      base = Math.round(Math.max(W, H) * 0.75);   // okręgi rysowane w dużym rozmiarze i skalowane w dół = ostre krawędzie
      stage.style.setProperty('--spot', `${base}px`);
      src = [];   // źródła snopów przeliczą się dla nowego rozmiaru
      if (word && content) {
        // pozycja napisu względem sceny: sumujemy offsety w górę drzewa (tytuł z transformacją 3D
        // jest dla napisu osobnym punktem odniesienia); offset* ignoruje animacje, więc cel się nie „pływa”
        let x = 0;
        let y = 0;
        for (let el = word; el && el !== stage; el = el.offsetParent) { x += el.offsetLeft; y += el.offsetTop; }
        box = { x, y, w: word.offsetWidth, h: word.offsetHeight };
      }
    };

    const count = innerWidth < 768 ? 4 : 5;
    const spots = Array.from({ length: count }, (_, i) => {
      const make = (parent, cls) => {
        if (!parent) return null;
        const el = document.createElement('span');
        el.className = cls;
        parent.append(el);
        return el;
      };
      // snop (stożek) pod okręgiem – w obu warstwach, żeby też lekko odsłaniał to, przez co przechodzi
      const beam = (parent, cls) => { const el = make(parent, cls); if (el) el.append(document.createElement('span')); return el; };
      return {
        beams: [beam(veil, 'bb-veil__beam'), beam(glow, 'bb-glow__beam')],
        els: [make(veil, 'bb-veil__spot'), make(glow, 'bb-glow__spot')].filter(Boolean),
        a0: (i / count) * Math.PI * 2 + rnd(-0.3, 0.3),   // start na okręgu wokół napisu
        turns: rnd(0.5, 0.8),                              // ile okrążenia zrobi, zbiegając się do środka
        lane: count > 1 ? i / (count - 1) : 0.5,           // miejsce na napisie, które oświetli
        dy: (i % 2 ? 1 : -1) * rnd(0.04, 0.14),
        // swobodny dryf: suma sinusów o losowych fazach = płynny, nieprzewidywalny tor
        fx: rnd(0.16, 0.3), fy: rnd(0.13, 0.26), fx2: rnd(0.35, 0.6), fy2: rnd(0.3, 0.55),
        px: rnd(0, 6.28), py: rnd(0, 6.28), px2: rnd(0, 6.28), py2: rnd(0, 6.28),
        ax: rnd(0.26, 0.4), ay: rnd(0.22, 0.34), size: rnd(0.3, 0.46),
        jit: rnd(-0.12, 0.12),
      };
    });

    // źródła snopów: łuk nad sceną, poza ekranem (od lewej do prawej jak okręgi na napisie)
    const sources = () => {
      const R = Math.hypot(W, H) * 0.9;
      return spots.map((s, i) => {
        const th = ((-150 + 120 * s.lane) * Math.PI) / 180 + s.jit;
        return { x: W / 2 + Math.cos(th) * R, y: H * 0.45 + Math.sin(th) * R };
      });
    };
    let src = [];

    const draw = (t) => {
      if (src.length !== spots.length) src = sources();
      const cx = box ? box.x + box.w / 2 : W / 2;
      const cy = box ? box.y + box.h / 2 : H / 2;
      const m = Math.min(W, H);
      const fade = smooth(clamp01((t - T.fadeIn) / T.fadeDur));
      const e = easeInOut(clamp01((t - T.spiral) / T.spiralDur));
      const w = smooth(clamp01((t - T.drift) / T.driftDur));
      const sec = t / 1000;
      const endSize = box ? Math.max(box.h * 1.6, (box.w / count) * 1.75) : m * 0.4;
      spots.forEach((s, i) => {
        // 1) krążenie po elipsie wokół napisu i spiralne zbieganie się na wybrane miejsce napisu
        const ang = s.a0 + s.turns * Math.PI * 2 * e;
        const tx = box ? box.x + box.w * (0.1 + 0.8 * s.lane) : cx;
        const ty = cy + (box ? box.h * s.dy : 0);
        let x = cx + Math.cos(ang) * W * 0.42 + (tx - cx - Math.cos(ang) * W * 0.42) * e;
        let y = cy + Math.sin(ang) * H * 0.38 + (ty - cy - Math.sin(ang) * H * 0.38) * e;
        let d = m * 0.32 + (endSize - m * 0.32) * e;
        // 2) swobodny dryf: na szerokim ekranie po całej scenie, na telefonie po napisie (światło pada na tekst)
        if (w > 0) {
          const nx = 0.8 * Math.sin(s.fx * sec + s.px) + 0.25 * Math.sin(s.fx2 * sec + s.px2);
          const ny = 0.8 * Math.sin(s.fy * sec + s.py) + 0.25 * Math.sin(s.fy2 * sec + s.py2);
          const onText = W < 768 && box;
          const dx = onText ? cx + box.w * 0.46 * nx : W / 2 + W * s.ax * nx;
          const dy = onText ? cy + box.h * 0.95 * ny : H / 2 + H * s.ay * ny;
          const dd = onText ? Math.max(box.h * 1.25, m * (s.size + 0.08)) : m * s.size;
          x += (dx - x) * w;
          y += (dy - y) * w;
          d += (dd - d) * w;
        }
        const tr = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(d / base).toFixed(4)})`;
        s.els.forEach((el) => {
          el.style.transform = tr;
          el.style.opacity = fade.toFixed(3);
        });
        // snop od źródła spoza ekranu do środka okręgu; koniec stożka = średnica jasnej krawędzi okręgu
        const S = src[i];
        const len = Math.hypot(x - S.x, y - S.y);
        const bt = `translate3d(${S.x.toFixed(1)}px, ${S.y.toFixed(1)}px, 0) rotate(${Math.atan2(y - S.y, x - S.x).toFixed(4)}rad) scale(${(len / 1200).toFixed(4)}, ${((d * 0.7) / 1200).toFixed(4)})`;
        s.beams.forEach((el, k) => {
          if (!el) return;
          el.style.transform = bt;
          el.style.opacity = (fade * (k === 0 ? 0.32 : 0.22)).toFixed(3);
        });
      });
    };

    let t0 = 0;
    let raf = 0;
    let visible = true;
    const loop = (now) => {
      raf = 0;
      draw(now - t0);
      if (visible) raf = requestAnimationFrame(loop);
    };

    measure();
    addEventListener('resize', () => { measure(); if (reduceMotion) draw(9000); }, { passive: true });

    if (reduceMotion) {
      // bez ruchu: od razu odsłonięta scena i nieruchome okręgi
      stage.classList.add('is-revealed', 'is-open');
      ready.then(() => { measure(); draw(9000); });
    } else {
      ready.then(() => {
        measure();
        t0 = performance.now();
        raf = requestAnimationFrame(loop);
        setTimeout(() => stage.classList.add('is-revealed'), T.reveal);
        setTimeout(() => stage.classList.add('is-open'), T.open);
      });
      // poza ekranem okręgi stoją (oszczędność baterii i płynny scroll reszty strony)
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && t0 && !raf) raf = requestAnimationFrame(loop);
      }).observe(stage);
    }

    // głębia: napis lekko przechyla się za kursorem (tylko mysz)
    if (title && !reduceMotion && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let tiltRaf = 0;
      let rx = 0;
      let ry = 0;
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        rx = ((e.clientY - r.top) / r.height - 0.5) * -7;
        ry = ((e.clientX - r.left) / r.width - 0.5) * 9;
        if (tiltRaf) return;
        tiltRaf = requestAnimationFrame(() => {
          tiltRaf = 0;
          title.style.setProperty('--tilt-x', `${rx.toFixed(2)}deg`);
          title.style.setProperty('--tilt-y', `${ry.toFixed(2)}deg`);
        });
      });
      stage.addEventListener('pointerleave', () => {
        title.style.setProperty('--tilt-x', '0deg');
        title.style.setProperty('--tilt-y', '0deg');
      });
    }
  }

  if (!header) return;

  /* ---------- 3. Nagłówek: tło po scrollu > 40px i jasny/ciemny tryb nad sekcjami ---------- */
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
    // po wyborze pozycji (kotwica na tej samej stronie) podmenu się chowa
    sub.addEventListener('click', (e) => {
      if (e.target.closest('a') && mqDesktop.matches) set(false);
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

  /* ---------- 6. Sticky CTA (mobile/tablet): po minięciu przycisku w hero, znika przy kontakcie ---------- */
  const sticky = document.querySelector('.bb-sticky-cta');
  const heroCta = document.querySelector('.bb-stage__actions');
  const contact = document.getElementById('kontakt');
  let pastHero = false;
  let contactInView = false;

  function updateSticky() {
    if (!sticky) return;
    sticky.classList.toggle('is-visible', pastHero && !contactInView && !header.classList.contains('is-open'));
  }
  if (sticky && heroCta) {
    new IntersectionObserver(([entry]) => {
      pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      updateSticky();
    }).observe(heroCta);
  }
  if (sticky && contact) {
    new IntersectionObserver(([entry]) => {
      contactInView = entry.isIntersecting;
      updateSticky();
    }, { rootMargin: '0px 0px -30% 0px' }).observe(contact);
  }

  /* ---------- 7. Pojawianie się elementów przy scrollu ---------- */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const groups = [
      '.bb-section .bb-head', '.bb-fact', '.bb-quote', '.bb-press', '.bb-offer',
      '.bb-values__slides', '.bb-values__list > li', '.bb-video__list > li', '.bb-refs__viewport',
      '.bb-contact__options > li',
    ];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    document.querySelectorAll(groups.join(',')).forEach((el) => {
      const siblings = [...el.parentElement.children];
      el.style.setProperty('--rd', `${(siblings.indexOf(el) % 4) * 90}ms`);
      el.classList.add('bb-reveal');
      io.observe(el);
    });
  }

  /* ---------- 8. Pas logotypów mediów (klon listy tylko dla animacji) ---------- */
  document.querySelectorAll('.bb-marquee').forEach((list) => {
    if (reduceMotion) return;
    const clip = document.createElement('div');
    clip.className = 'bb-marquee-clip';
    list.before(clip);
    clip.append(list);
    [...list.children].forEach((li) => {
      const copy = li.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('img').forEach((img) => { img.alt = ''; });
      list.append(copy);
    });
  });

  /* ---------- 9. Sekcja Styl: zdjęcia zmieniają się co kilka sekund ---------- */
  document.querySelectorAll('.bb-values__slides').forEach((box) => {
    const imgs = [...box.querySelectorAll('img')];
    if (imgs.length < 2) return;
    box.classList.add('is-js');
    let i = 0;
    let timer;
    imgs[0].classList.add('is-active');
    if (reduceMotion) return;
    new IntersectionObserver(([entry]) => {
      clearInterval(timer);
      if (!entry.isIntersecting) return;
      timer = setInterval(() => {
        imgs[i].classList.remove('is-active');
        i = (i + 1) % imgs.length;
        imgs[i].classList.add('is-active');
      }, 4500);
    }).observe(box);
  });

  /* ---------- 9b. Kurtyna jak w v1: czarna plansza z logo podnosi się nad sekcją z atrybutem data-curtain ---------- */
  if (!reduceMotion) {
    document.querySelectorAll('[data-curtain]').forEach((sec) => {
      const curtain = document.createElement('div');
      curtain.className = 'bb-curtain';
      curtain.setAttribute('aria-hidden', 'true');
      const logo = document.createElement('img');
      logo.src = (document.querySelector('.bb-header__logo img') || {}).src || 'assets/logo.svg';
      logo.alt = '';
      curtain.append(logo);
      sec.append(curtain);
      const io = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        curtain.classList.add('is-up');
        io.disconnect();
      }, { rootMargin: '0px 0px -35% 0px' });
      io.observe(sec);
    });
  }

  /* ---------- 10. Lightbox (portfolio i media) ---------- */
  let lb;
  let lbItems = [];
  let lbIndex = 0;
  let lbReturn;
  const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const buildLightbox = () => {
    lb = document.createElement('dialog');
    lb.className = 'bb-lightbox';
    lb.setAttribute('aria-label', 'Podgląd zdjęcia');
    lb.innerHTML = `
      <figure><img alt=""><figcaption></figcaption></figure>
      <button type="button" data-lb="close" aria-label="Zamknij">${icon('M6 6l12 12M18 6L6 18')}</button>
      <button type="button" data-lb="prev" aria-label="Poprzednie zdjęcie">${icon('M15 5l-7 7 7 7')}</button>
      <button type="button" data-lb="next" aria-label="Następne zdjęcie">${icon('M9 5l7 7-7 7')}</button>`;
    document.body.append(lb);
    lb.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lb]');
      if (btn) {
        const act = btn.dataset.lb;
        if (act === 'close') lb.close();
        else show(lbIndex + (act === 'next' ? 1 : -1));
      } else if (e.target === lb || e.target.tagName === 'FIGURE') {
        lb.close();
      }
    });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(lbIndex + 1);
      if (e.key === 'ArrowLeft') show(lbIndex - 1);
    });
    lb.addEventListener('close', () => {
      root.classList.remove('bb-menu-open');
      if (lbReturn) lbReturn.focus();
    });
  };
  const show = (i) => {
    lbIndex = (i + lbItems.length) % lbItems.length;
    const link = lbItems[lbIndex];
    const img = link.querySelector('img');
    const tag = link.querySelector('.bb-gallery__tag');
    lb.querySelector('img').src = link.href;
    lb.querySelector('img').alt = img ? img.alt : '';
    lb.querySelector('figcaption').textContent = `${tag ? tag.textContent : ''}${tag ? ' · ' : ''}${lbIndex + 1} / ${lbItems.length}`;
    const multi = lbItems.length > 1;
    lb.querySelector('[data-lb="prev"]').hidden = !multi;
    lb.querySelector('[data-lb="next"]').hidden = !multi;
  };
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-group]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || !window.HTMLDialogElement) return;
    e.preventDefault();
    if (!lb) buildLightbox();
    // w grupie tylko widoczne zdjęcia (np. po filtrowaniu portfolio)
    lbItems = [...document.querySelectorAll(`a[data-group="${link.dataset.group}"]`)]
      .filter((a) => !a.closest('.is-hidden'));
    lbReturn = link;
    show(lbItems.indexOf(link));
    lb.showModal();
    root.classList.add('bb-menu-open');   // blokada przewijania strony pod spodem
  });

  /* ---------- 11. Portfolio: filtr + „Pokaż więcej” ---------- */
  document.querySelectorAll('.bb-portfolio').forEach((section) => {
    const gallery = section.querySelector('.bb-gallery');
    if (!gallery) return;
    const items = [...gallery.children];
    const buttons = [...section.querySelectorAll('[data-filter]')];
    const moreWrap = section.querySelector('.bb-gallery__more');
    const more = moreWrap && moreWrap.querySelector('button');
    const page = parseInt(gallery.dataset.page, 10) || 12;
    let filter = 'all';
    let limit = page;

    const render = (fresh) => {
      let shown = 0;
      items.forEach((li) => {
        const cats = (li.dataset.cat || '').split(/\s+/);
        const match = filter === 'all' || cats.includes(filter);
        const visible = match && shown < limit;
        const wasHidden = li.classList.contains('is-hidden');
        li.classList.toggle('is-hidden', !visible);
        li.classList.toggle('is-wide', visible && shown % 9 === 0);
        li.classList.toggle('is-new', visible && wasHidden && !fresh);
        if (match) shown += 1;
      });
      if (moreWrap) moreWrap.hidden = shown <= limit;
    };
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      filter = btn.dataset.filter;
      limit = page;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      render(true);
    }));
    if (more) more.addEventListener('click', () => { limit += page; render(false); });
    render(true);
  });

  /* ---------- 12. Video: kafelek zamienia się w odtwarzacz po kliknięciu ---------- */
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.bb-video__card');
    if (!card) return;
    const url = card.href;
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
    const vimeo = url.match(/vimeo\.com\/(\d+)/);
    const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0`
      : vimeo ? `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&dnt=1` : null;
    if (!src) return;
    e.preventDefault();
    const frame = document.createElement('div');
    frame.className = 'bb-video__frame';
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = card.textContent.trim();
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    frame.append(iframe);
    card.replaceWith(frame);
    iframe.focus();
  });

  /* ---------- 13. Referencje: karuzela na „zakrzywionej przestrzeni” ----------
     Karty skręcają się w 3D zależnie od odległości od środka (jak na zakrzywionym ekranie kinowym),
     łuki u góry i u dołu robi maska w CSS. Przewijanie: strzałki, przeciąganie myszą, gest, klawiatura,
     a do tego samodzielne przesuwanie co kilka sekund (pauza po najechaniu i poza ekranem). */
  document.querySelectorAll('.bb-refs').forEach((section) => {
    const track = section.querySelector('.bb-refs__track');
    if (!track || !track.children.length) return;
    const cards = [...track.children];
    const count = section.querySelector('.bb-refs__count span');
    let current = 0;
    let ticking = false;

    const render = () => {
      ticking = false;
      const half = track.clientWidth / 2;
      const center = track.scrollLeft + half;
      const tilt = innerWidth < 768 ? 12 : 20;
      let best = 0;
      let bestDist = Infinity;
      cards.forEach((card, i) => {
        const mid = card.offsetLeft + card.offsetWidth / 2;
        const p = Math.max(-1.6, Math.min(1.6, (mid - center) / half));
        const a = Math.min(Math.abs(p), 1);
        card.style.setProperty('--ry', `${(-p * tilt).toFixed(2)}deg`);
        card.style.setProperty('--sc', (1 + a * 0.08).toFixed(3));
        card.style.setProperty('--op', (1 - a * 0.5).toFixed(3));
        if (Math.abs(mid - center) < bestDist) { bestDist = Math.abs(mid - center); best = i; }
      });
      current = best;
      if (count) count.textContent = String(best + 1).padStart(2, '0');
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(render); } };
    const goTo = (i) => {
      const card = cards[(i + cards.length) % cards.length];
      track.scrollTo({ left: card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    // automatyczne przesuwanie
    let timer;
    let hold = false;
    let inView = false;
    let manual = false;   // użytkownik sam przewija → karuzela już się nie rusza sama
    const play = () => {
      clearInterval(timer);
      if (!reduceMotion && !hold && inView && !manual) timer = setInterval(() => goTo(current + 1), 5500);
    };
    const takeOver = () => { manual = true; clearInterval(timer); };
    ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((type) => track.addEventListener(type, takeOver, { passive: true }));
    section.addEventListener('pointerenter', () => { hold = true; play(); });
    section.addEventListener('pointerleave', () => { hold = false; play(); });
    section.addEventListener('focusin', () => { hold = true; play(); });
    section.addEventListener('focusout', (e) => { if (!section.contains(e.relatedTarget)) { hold = false; play(); } });
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; play(); }, { threshold: 0.3 }).observe(section);

    section.querySelectorAll('[data-dir]').forEach((btn) => btn.addEventListener('click', () => {
      takeOver();
      goTo(current + Number(btn.dataset.dir));
    }));

    // przeciąganie myszą z bezwładem: po „zakręceniu” pas jeszcze chwilę leci i łagodnie hamuje
    // (dotyk i gładzik przewijają natywnie – z własnym bezwładem systemu)
    let drag = null;
    let glide = 0;
    const stopGlide = () => { cancelAnimationFrame(glide); glide = 0; };
    const startGlide = (velocity) => {          // px/ms; tarcie 0.955 na klatkę 60 Hz
      let v = velocity;
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min(48, now - last);
        last = now;
        const before = track.scrollLeft;
        track.scrollLeft = before + v * dt;
        v *= 0.955 ** (dt / 16.67);
        const stuck = Math.abs(track.scrollLeft - before) < 0.1 && Math.abs(v * dt) >= 0.1;   // krawędź pasa
        glide = Math.abs(v) > 0.02 && !stuck ? requestAnimationFrame(step) : 0;
      };
      glide = requestAnimationFrame(step);
    };
    track.addEventListener('pointerdown', (e) => {
      stopGlide();
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: track.scrollLeft, samples: [{ x: e.clientX, t: e.timeStamp }] };
      track.classList.add('is-dragging');
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', (e) => {
      if (!drag) return;
      track.scrollLeft = drag.left - (e.clientX - drag.x);
      drag.samples.push({ x: e.clientX, t: e.timeStamp });
      if (drag.samples.length > 8) drag.samples.shift();
    });
    const endDrag = (e) => {   // bez dociągania do karty – po wyhamowaniu zostaje tam, gdzie się zatrzyma
      if (!drag) return;
      // prędkość z ruchu w ostatnich ~100 ms przed puszczeniem
      const now = e && e.timeStamp ? e.timeStamp : performance.now();
      const recent = drag.samples.filter((s) => now - s.t < 100);
      drag = null;
      track.classList.remove('is-dragging');
      if (reduceMotion || recent.length < 2) return;
      const first = recent[0];
      const lastS = recent[recent.length - 1];
      const dt = lastS.t - first.t;
      if (dt <= 0) return;
      const v = -(lastS.x - first.x) / dt;
      if (Math.abs(v) > 0.08) startGlide(Math.max(-6, Math.min(6, v)));
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('wheel', stopGlide, { passive: true });

    track.addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request, { passive: true });
    // start od drugiej opinii, żeby po obu stronach środkowej karty były kolejne
    const start = cards[Math.min(1, cards.length - 1)];
    track.scrollLeft = start.offsetLeft + start.offsetWidth / 2 - track.clientWidth / 2;
    render();
  });
})();
