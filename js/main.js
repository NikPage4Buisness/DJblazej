/* DJ Błażej Biurkowski | One Page
   Loader, dociąganie scrolla, przejścia sekcji, linia uwagi, galeria, lightbox */
(function () {
  'use strict';

  var body = document.body;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-snap]'));
  var header = document.getElementById('header');
  var rail = document.querySelector('.rail');

  /* ---------- LOADER ---------- */
  var MIN_TIME = reduceMotion ? 300 : 1500;
  var MAX_TIME = 4000;
  var start = performance.now();
  var countEl = document.getElementById('loaderCount');
  var critical = ['assets/logo.png'];
  // zdjęcie z hero: czekamy na ten wariant ze srcset, który przeglądarka faktycznie wybrała
  var heroImg = document.querySelector('.hero__portrait img');
  var total = critical.length + (heroImg ? 1 : 0);
  var loaded = 0;
  var assetsDone = false;
  function assetReady() { loaded++; if (loaded === total) assetsDone = true; }

  critical.forEach(function (src) {
    var img = new Image();
    img.onload = img.onerror = assetReady;
    img.src = src;
  });
  if (heroImg) {
    if (heroImg.complete) assetReady();
    else {
      heroImg.addEventListener('load', assetReady);
      heroImg.addEventListener('error', assetReady);
    }
  }

  function tickLoader(now) {
    var t = Math.min((now - start) / MIN_TIME, 1);
    var eased = 1 - Math.pow(1 - t, 3);
    var cap = assetsDone ? 1 : 0.9;
    var p = Math.min(eased, cap);
    countEl.textContent = Math.round(p * 100);
    if ((t >= 1 && assetsDone) || now - start > MAX_TIME) {
      countEl.textContent = '100';
      setTimeout(finishLoading, 150);
      return;
    }
    requestAnimationFrame(tickLoader);
  }
  requestAnimationFrame(tickLoader);

  function finishLoading() {
    body.classList.add('is-loaded');
    body.classList.remove('is-loading');
    if (location.hash && document.querySelector(location.hash)) {
      window.scrollTo(0, document.querySelector(location.hash).offsetTop);
    }
    setTimeout(function () { body.classList.add('is-ready'); }, 1100);
    initReveal();
  }

  /* ---------- REVEAL ---------- */
  function initReveal() {
    // hero jest widoczne od razu po loaderze, także to, co leży przy dolnej krawędzi ekranu (np. kontakt na telefonie)
    Array.prototype.forEach.call(document.querySelectorAll('#home [data-reveal], #home [data-stagger]'), function (el) {
      el.classList.add('is-in');
    });
    var els = document.querySelectorAll('[data-reveal]:not(.is-in), [data-stagger]:not(.is-in), .value');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  /* ---------- RAIL: skróty sekcji jako delikatne kropki ----------
     Pionowy pasek po lewej stronie (od 1100 px szerokości). W sekcji głównej jest ukryty (skróty są wtedy
     w pionowej sekcji po lewej stronie hero), pojawia się po przewinięciu do drugiej sekcji. */
  var dotsWrap = document.getElementById('railDots');
  var railFill = document.getElementById('railFill');
  var topProgress = document.getElementById('topProgress');
  var railSections = sections.filter(function (s) { return !s.hasAttribute('data-no-dot'); });
  rail.style.setProperty('--n', railSections.length);
  railSections.forEach(function (s) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = '#' + s.id;
    a.setAttribute('data-nav', '');
    a.setAttribute('aria-label', s.dataset.label);
    var span = document.createElement('span');
    span.textContent = s.dataset.label;
    a.appendChild(span);
    li.appendChild(a);
    dotsWrap.appendChild(li);
  });
  var dots = dotsWrap.querySelectorAll('a');
  var menuLinks = document.querySelectorAll('.menu__list a, .hero__side a, .menu-sec__list a');

  function currentIndex(probeY) {
    var idx = 0;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= probeY) idx = i;
    }
    return idx;
  }

  var parallaxEls = document.querySelectorAll('[data-parallax]');

  function onScrollUI() {
    var y = window.scrollY;
    var vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    var p = max > 0 ? y / max : 0;
    railFill.style.transform = 'translateX(-50%) scaleY(' + p + ')';
    topProgress.style.transform = 'scaleX(' + p + ')';

    header.classList.toggle('is-scrolled', y > 10);
    // komputer: pionowa sekcja ze skrótami w hero chowa się po przewinięciu, a skróty wracają na górny pasek (is-away)
    body.classList.toggle('is-away', y > Math.min(140, vh * .16));
    var hIdx = currentIndex(y + header.offsetHeight / 2);
    header.classList.toggle('is-dark', sections[hIdx].dataset.theme === 'dark');
    var rIdx = currentIndex(y + vh / 2);
    rail.classList.toggle('is-dark', sections[rIdx].dataset.theme === 'dark');
    rail.classList.toggle('is-visible', rIdx > 0);   // kropki dopiero od drugiej sekcji
    var dIdx = railSections.indexOf(sections[rIdx]);
    Array.prototype.forEach.call(dots, function (d, i) { d.classList.toggle('is-current', i === dIdx); });
    Array.prototype.forEach.call(menuLinks, function (a) {
      a.classList.toggle('is-current', a.getAttribute('href') === '#' + sections[rIdx].id);
    });

    if (!reduceMotion) {
      Array.prototype.forEach.call(parallaxEls, function (el) {
        var k = parseFloat(el.dataset.parallax) || 0;
        el.style.transform = 'translate3d(0,' + (y * k).toFixed(1) + 'px,0)';
      });
    }
  }

  /* ---------- PŁYNNE PRZEWIJANIE ---------- */
  var busy = false;
  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function scrollToY(target, duration, done) {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    target = Math.max(0, Math.min(target, max));
    var from = window.scrollY;
    var dist = target - from;
    if (Math.abs(dist) < 2 || reduceMotion) {
      window.scrollTo(0, target);
      if (done) done();
      return;
    }
    busy = true;
    var t0 = performance.now();
    duration = duration || Math.min(1100, 500 + Math.abs(dist) * 0.35);
    function step(now) {
      var t = Math.min((now - t0) / duration, 1);
      window.scrollTo(0, from + dist * easeInOut(t));
      if (t < 1) requestAnimationFrame(step);
      else setTimeout(function () { busy = false; if (done) done(); }, 80);
    }
    requestAnimationFrame(step);
  }

  /* ---------- PRZEWIJANIE ----------
     Bez dociągania do sekcji: strona przewija się swobodnie,
     JS tylko odświeża pasek postępu, nagłówek i paralaksę. */
  window.addEventListener('scroll', function () { requestAnimationFrame(onScrollUI); }, { passive: true });
  window.addEventListener('resize', onScrollUI);

  /* ---------- PRZEJŚCIA (kurtyna) ---------- */
  var curtain = document.getElementById('curtain');
  function railPos(sec) {
    var n = -1;
    for (var i = 0; i < sections.length; i++) {
      if (!sections[i].hasAttribute('data-no-dot')) n++;
      if (sections[i] === sec) return n;
    }
    return n;
  }
  function goTo(id) {
    var el = document.getElementById(id);
    if (!el) return;
    closeMenu();
    if (reduceMotion) { window.scrollTo(0, el.offsetTop); return; }
    var idxNow = railPos(sections[currentIndex(window.scrollY + 1)]);
    var idxTo = railPos(el);
    if (Math.abs(idxTo - idxNow) <= 1) { scrollToY(el.offsetTop); return; }
    busy = true;
    curtain.classList.remove('is-out');
    curtain.classList.add('is-in');
    setTimeout(function () {
      window.scrollTo(0, el.offsetTop);
      onScrollUI();
      curtain.classList.remove('is-in');
      curtain.classList.add('is-out');
      setTimeout(function () {
        curtain.classList.remove('is-out');
        busy = false;
      }, 650);
    }, 700);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-nav]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) !== '#') return;
    e.preventDefault();
    goTo(href.slice(1));
    if (history.replaceState) history.replaceState(null, '', href);
  });


  /* ---------- PODMENU „OFERTA” ----------
     Przycisk .submenu-toggle rozwija listę podstron (Eventy, Studniówki, Wedding). W górnym pasku na komputerze to lista
     rozwijana (zamyka się po kliknięciu poza nią albo Escape); w menu mobilnym, pionowym menu w hero
     i sekcji skrótów to harmonijka, która zostaje otwarta do ponownego kliknięcia. */
  var subToggles = document.querySelectorAll('.submenu-toggle');
  function setSub(t, open) {
    var li = t.closest('.has-sub');
    li.classList.toggle('is-open', open);
    t.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function isBarDropdown(t) { return t.closest('.menu__list') && window.matchMedia('(min-width: 961px)').matches; }
  function closeBarSub() {
    Array.prototype.forEach.call(subToggles, function (t) { if (isBarDropdown(t)) setSub(t, false); });
  }
  Array.prototype.forEach.call(subToggles, function (t) {
    t.addEventListener('click', function () {
      var open = t.getAttribute('aria-expanded') !== 'true';
      setSub(t, open);
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.menu__list .has-sub')) closeBarSub();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeBarSub();
  });

  /* ---------- MENU MOBILNE ---------- */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  function closeMenu() {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    body.classList.remove('menu-open', 'is-locked');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Otwórz menu');
  }
  burger.addEventListener('click', function () {
    var open = !menu.classList.contains('is-open');
    if (!open) { closeMenu(); return; }
    menu.classList.add('is-open');
    body.classList.add('menu-open', 'is-locked');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Zamknij menu');
  });

  /* ---------- PORTFOLIO: filtr + więcej ---------- */
  var items = Array.prototype.slice.call(document.querySelectorAll('.gallery__item'));
  var filters = document.querySelectorAll('.filter');
  var moreBtn = document.getElementById('moreBtn');
  var moreWrap = moreBtn.parentElement;
  var STEP = 12;
  var limit = STEP;
  var activeFilter = 'all';

  /* Bento dopasowany do zdjęć: układ składa się z „klocków” po 2 rzędy (4 kolumny)
     albo 1-2 rzędy (2 kolumny); każdy klocek wypełnia rzędy w całości, więc nie ma dziur.
     Wysokie kafelki (t) dostają zdjęcia pionowe, duże (b) i małe (s) poziome.
     Dla urozmaicenia: wysokie kafelki nigdy nie stoją obok siebie, nie ustawiają się
     jeden pod drugim w kolejnych klockach, a ten sam układ nie powtarza się pod rząd.
     Kolejność zdjęć zmieniamy tylko lokalnie (w obrębie najbliższych kilkunastu).
     Klocek wybieramy z wyprzedzeniem: jedno zdjęcie poziome „obsłuży” najwyżej dwa pionowe
     (klocek t,b,t), więc nie zużywamy poziomych zdjęć tak, żeby dalej pionowe nie miały miejsca.
     Gdy przewaga pionów jest nie do uniknięcia, zdjęcie w kafelku o innej orientacji
     pokazujemy w całości (klasa is-fit), a wolne pola wypełnia jego rozmyta kopia. */
  var gallery = document.getElementById('gallery');
  var PORTRAIT = 0.9;

  function isPortrait(it) { return parseFloat(it.dataset.ar || '1.5') < PORTRAIT; }
  function isTallSlot(slot) { return slot === 't' || slot === 'bt'; }
  function isBigSlot(slot) { return slot === 'b' || slot === 'bt' || slot === 'w4'; }
  function setFit(it, on) {
    var btn = it.querySelector('button');
    var img = it.querySelector('img');
    it.classList.toggle('is-fit', on);
    if (btn) btn.style.backgroundImage = on && img ? 'url("' + img.src + '")' : '';
  }

  // p = kolejność kafelków w klocku, t = kolumny, w których stoją wysokie kafelki
  var VARIANTS_4 = [
    { p: ['b', 's', 't', 's'], t: [4] },
    { p: ['t', 's', 'b', 's'], t: [1] },
    { p: ['b', 't', 's', 's'], t: [3] },
    { p: ['s', 't', 'b', 's'], t: [2] },
    { p: ['t', 'b', 't'], t: [1, 4] },
    { p: ['b', 'b'], t: [] },
    { p: ['b', 's', 's', 's', 's'], t: [] },
    { p: ['s', 'b', 's', 's', 's'], t: [] },
    { p: ['s', 's', 'b', 's', 's'], t: [] },
    { p: ['t', 's', 't', 's', 's', 's'], t: [1, 3] },
    { p: ['s', 't', 's', 't', 's', 's'], t: [2, 4] },
    { p: ['t', 's', 's', 't', 's', 's'], t: [1, 4] },
    { p: ['t', 's', 's', 's', 's', 's', 's'], t: [1] },
    { p: ['s', 't', 's', 's', 's', 's', 's'], t: [2] },
    { p: ['s', 's', 's', 't', 's', 's', 's'], t: [4] },
    { p: ['s', 's', 's', 's', 's', 's', 's', 's'], t: [] }
  ];
  // bt = pionowe zdjęcie na całą szerokość telefonu (2 kolumny x 3 rzędy)
  var VARIANTS_2 = [
    { p: ['bt'], t: [] },
    { p: ['t', 's', 's'], t: [1] },
    { p: ['s', 't', 's'], t: [2] },
    { p: ['b'], t: [] },
    { p: ['s', 's'], t: [] }
  ];

  function applyBento() {
    var cols = getComputedStyle(gallery).gridTemplateColumns.split(' ').length;
    var queue = items.filter(function (it) { return !it.classList.contains('is-hidden'); });
    items.forEach(function (it) {
      it.classList.remove('bento-b', 'bento-w2', 'bento-t', 'bento-w4', 'bento-bt');
      it.style.order = '';
      setFit(it, false);
    });
    var variants = cols >= 4 ? VARIANTS_4 : VARIANTS_2;
    var wide = cols >= 4;
    var LOOK = 12;
    var order = 0;
    var chunkNo = 0;
    var lastT = [];
    var history = [];
    // ile niedopasowań jest nie do uniknięcia przy p pionowych i l poziomych zdjęciach
    // (na telefonie pion zawsze ma swój kafelek bt)
    function unavoidable(p, l) { return wide ? Math.max(0, p - 2 * l) : 0; }

    while (queue.length) {
      var left = queue.length;
      var chunk;
      if (wide && left === 1) {
        chunk = { p: ['w4'], t: [] };
      } else {
        var look = queue.slice(0, LOOK);
        var pAvail = look.filter(isPortrait).length;
        var lAvail = look.length - pAvail;
        var pRatio = pAvail / look.length;
        var lbNow = unavoidable(pAvail, lAvail);
        var best = null;
        var bestScore = Infinity;
        variants.forEach(function (v, vi) {
          var size = v.p.length;
          if (size > left) return;
          if (wide && left - size === 1) return; // nie zostawiamy pojedynczego zdjęcia
          var tCount = v.p.filter(isTallSlot).length;
          var sCount = v.p.filter(function (x) { return x === 's'; }).length;
          var pOver = Math.max(0, tCount - pAvail);          // wysokie kafelki bez pionowych zdjęć
          var lOver = Math.max(0, size - tCount - lAvail);   // poziome kafelki bez poziomych zdjęć
          var mismatch = pOver + lOver;
          // niedopasowania ponad nieuniknione minimum (ten klocek + to, co zostanie w oknie)
          var pUse = Math.min(tCount, pAvail) + lOver;
          var future = unavoidable(pAvail - pUse, lAvail - (size - pUse));
          var waste = Math.max(0, mismatch + future - lbNow);
          var smallMis = Math.max(0, lOver - (size - tCount - sCount)); // pion w małym kafelku
          var stacked = v.t.some(function (c) { return lastT.indexOf(c) > -1; });
          var score = mismatch * 60 + waste * 100 + smallMis * 15
            + Math.abs(tCount / size - pRatio) * (wide ? 18 : 14)
            + (stacked ? 25 : 0)
            + (history[history.length - 1] === vi ? 30 : 0)
            + (history.slice(-3).indexOf(vi) > -1 ? (wide ? 6 : 1) : 0)
            + (size >= 8 ? 6 : size === 7 ? 2 : 0)
            + (!wide && v.p[0] === 'b' ? 2 : 0)
            + ((chunkNo * 7919 + vi * 104729) % 97) / 97 * 3; // stały „losowy” akcent
          if (score < bestScore) { bestScore = score; best = vi; }
        });
        chunk = best === null ? { p: ['s'], t: [] } : variants[best];
        history.push(best);
      }
      lastT = chunk.t;
      chunkNo++;

      // wysokie kafelki biorą najbliższe zdjęcia pionowe, pozostałe najbliższe poziome;
      // gdy pasujących zabraknie, reszta trafia najpierw do dużych kafelków, potem do małych
      var window_ = queue.slice(0, LOOK);
      var slots = chunk.p.map(function (slot) { return { slot: slot, it: null }; });
      slots.forEach(function (s) {
        var want = isTallSlot(s.slot);
        for (var k = 0; k < window_.length; k++) {
          if (isPortrait(window_[k]) === want) { s.it = window_.splice(k, 1)[0]; break; }
        }
      });
      slots.filter(function (s) { return !s.it; })
        .sort(function (a, b) { return (isBigSlot(a.slot) ? 0 : 1) - (isBigSlot(b.slot) ? 0 : 1); })
        .forEach(function (s) { s.it = window_.shift() || null; });
      slots.forEach(function (s) {
        var it = s.it;
        if (!it) return;
        queue.splice(queue.indexOf(it), 1);
        if (s.slot !== 's') it.classList.add('bento-' + s.slot);
        it.style.order = order++;
        setFit(it, s.slot === 'w4' || isTallSlot(s.slot) !== isPortrait(it));
      });
    }
  }

  function renderGallery() {
    var shown = 0;
    var total = 0;
    items.forEach(function (it) {
      var cats = (it.dataset.cat || '').split(' ');
      var match = activeFilter === 'all' || cats.indexOf(activeFilter) > -1;
      it.classList.remove('is-extra');
      if (match) total++;
      var visible = match && shown < limit;
      if (visible) shown++;
      it.classList.toggle('is-hidden', !visible);
    });
    moreWrap.classList.toggle('is-hidden', total <= limit);
    applyBento();
  }

  var bentoResize = null;
  window.addEventListener('resize', function () {
    clearTimeout(bentoResize);
    bentoResize = setTimeout(applyBento, 120);
  });

  // Morphic: zaokrąglenia liczone per rząd (pasek może się zawinąć na wąskim ekranie)
  var filterList = Array.prototype.slice.call(filters);
  function layoutFilters() {
    var tops = filterList.map(function (f) { return f.offsetTop; });
    filterList.forEach(function (f, i) {
      var rowStart = i === 0 || tops[i] !== tops[i - 1];
      var rowEnd = i === filterList.length - 1 || tops[i] !== tops[i + 1];
      var prevActive = !rowStart && filterList[i - 1].classList.contains('is-active');
      var nextActive = !rowEnd && filterList[i + 1].classList.contains('is-active');
      f.classList.toggle('is-row-start', rowStart);
      f.classList.toggle('is-row-end', rowEnd);
      f.classList.toggle('is-round-l', rowStart || prevActive);
      f.classList.toggle('is-round-r', rowEnd || nextActive);
    });
  }
  layoutFilters();
  setTimeout(layoutFilters, 450);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutFilters);
  var filterResize = null;
  window.addEventListener('resize', function () {
    clearTimeout(filterResize);
    filterResize = setTimeout(layoutFilters, 120);
  });

  Array.prototype.forEach.call(filters, function (btn) {
    btn.addEventListener('click', function () {
      if (btn.classList.contains('is-active')) return;
      Array.prototype.forEach.call(filters, function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      layoutFilters();
      setTimeout(layoutFilters, 450);
      activeFilter = btn.dataset.filter;
      limit = STEP;
      items.forEach(function (it) { it.classList.add('is-fading'); });
      setTimeout(function () {
        renderGallery();
        requestAnimationFrame(function () {
          items.forEach(function (it) { it.classList.remove('is-fading'); });
        });
      }, reduceMotion ? 0 : 300);
    });
  });
  moreBtn.addEventListener('click', function () { limit += STEP; renderGallery(); });
  renderGallery();

  /* ---------- LIGHTBOX ---------- */
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lbImg');
  var lbCap = document.getElementById('lbCap');
  var group = [];
  var gi = 0;
  var lastFocus = null;

  function visibleGroup(name) {
    return Array.prototype.slice.call(document.querySelectorAll('[data-lb="' + name + '"]')).filter(function (b) {
      return b.offsetParent !== null;
    }).sort(function (x, y) {
      var ox = parseInt(x.closest("li").style.order || "0", 10);
      var oy = parseInt(y.closest("li").style.order || "0", 10);
      return ox - oy;
    });
  }
  function showLb(i) {
    gi = (i + group.length) % group.length;
    var b = group[gi];
    lbImg.src = b.dataset.src;
    lbImg.alt = b.querySelector('img').alt;
    lbCap.textContent = b.dataset.caption || '';
  }
  function openLb(btn) {
    group = visibleGroup(btn.dataset.lb);
    lastFocus = btn;
    showLb(group.indexOf(btn));
    lb.hidden = false;
    body.classList.add('is-locked');
    requestAnimationFrame(function () { lb.classList.add('is-open'); });
    lb.querySelector('[data-lb-close]').focus();
  }
  function closeLb() {
    lb.classList.remove('is-open');
    body.classList.remove('is-locked');
    setTimeout(function () { lb.hidden = true; }, 300);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lb]');
    if (b) { openLb(b); return; }
    if (e.target.closest('[data-lb-close]') || e.target === lb) closeLb();
    if (e.target.closest('[data-lb-prev]')) showLb(gi - 1);
    if (e.target.closest('[data-lb-next]')) showLb(gi + 1);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!lb.hidden) closeLb(); else closeMenu(); }
    if (lb.hidden) return;
    if (e.key === 'ArrowLeft') showLb(gi - 1);
    if (e.key === 'ArrowRight') showLb(gi + 1);
  });
  var sx = null;
  lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) showLb(gi + (dx < 0 ? 1 : -1));
    sx = null;
  }, { passive: true });

  /* ---------- DRAWER KONTAKTOWY (motyw: Smooth Drawer, KokonutUI, MIT) ---------- */
  var drawer = document.getElementById('contactDrawer');
  var drawerPanel = drawer.querySelector('.drawer__panel');
  var drawerReturn = null;
  var drawerTimer = null;

  function drawerFocusables() {
    return Array.prototype.slice.call(drawerPanel.querySelectorAll('a[href], button:not([disabled])'));
  }
  function openDrawer(trigger) {
    clearTimeout(drawerTimer);
    drawerReturn = trigger || null;
    closeMenu();
    drawer.hidden = false;
    body.classList.add('is-locked');
    drawerPanel.style.transform = '';
    void drawer.offsetWidth; // przeliczenie układu, żeby animacja wejścia ruszyła od stanu ukrytego
    drawer.classList.add('is-open');
    var primary = drawerPanel.querySelector('.drawer__primary');
    setTimeout(function () { primary.focus({ preventScroll: true }); }, 50);
  }
  function closeDrawer() {
    if (drawer.hidden || !drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    body.classList.remove('is-locked');
    drawerTimer = setTimeout(function () {
      drawer.hidden = true;
      drawerPanel.style.transform = '';
      drawerPanel.style.transition = '';
    }, reduceMotion ? 0 : 600);
    if (drawerReturn) drawerReturn.focus({ preventScroll: true });
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-drawer-open]');
    if (opener) { e.preventDefault(); openDrawer(opener); return; }
    if (e.target.closest('[data-drawer-close]')) closeDrawer();
  });
  document.addEventListener('keydown', function (e) {
    if (drawer.hidden) return;
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key === 'Tab') {
      var f = drawerFocusables();
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // przeciągnięcie w dół zamyka panel
  var dragY = null;
  var dragDy = 0;
  var dragT = 0;
  drawerPanel.addEventListener('pointerdown', function (e) {
    if (e.target.closest('a, button') || drawerPanel.scrollTop > 0) return;
    dragY = e.clientY; dragDy = 0; dragT = performance.now();
    drawerPanel.style.transition = 'none';
    drawerPanel.setPointerCapture(e.pointerId);
  });
  drawerPanel.addEventListener('pointermove', function (e) {
    if (dragY === null) return;
    dragDy = Math.max(0, e.clientY - dragY);
    drawerPanel.style.transform = 'translate(-50%, ' + dragDy + 'px)';
  });
  function endDrag() {
    if (dragY === null) return;
    var velocity = dragDy / Math.max(1, performance.now() - dragT);
    dragY = null;
    drawerPanel.style.transition = '';
    if (dragDy > 110 || velocity > 0.6) {
      drawerPanel.style.transform = 'translate(-50%, 110%)';
      closeDrawer();
    } else {
      drawerPanel.style.transform = '';
    }
  }
  drawerPanel.addEventListener('pointerup', endDrag);
  drawerPanel.addEventListener('pointercancel', endDrag);


  onScrollUI();
})();
