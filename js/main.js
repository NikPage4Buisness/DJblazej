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
  var MIN_TIME = reduceMotion ? 300 : 2400;
  var MAX_TIME = 5000;
  var start = performance.now();
  var countEl = document.getElementById('loaderCount');
  var critical = ['assets/hero-2.webp', 'assets/logo.png'];
  var loaded = 0;
  var assetsDone = false;

  critical.forEach(function (src) {
    var img = new Image();
    img.onload = img.onerror = function () { loaded++; if (loaded === critical.length) assetsDone = true; };
    img.src = src;
  });

  function tickLoader(now) {
    var t = Math.min((now - start) / MIN_TIME, 1);
    var eased = 1 - Math.pow(1 - t, 3);
    var cap = assetsDone ? 1 : 0.9;
    var p = Math.min(eased, cap);
    countEl.textContent = Math.round(p * 100);
    if ((t >= 1 && assetsDone) || now - start > MAX_TIME) {
      countEl.textContent = '100';
      setTimeout(finishLoading, 250);
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
    setTimeout(function () { body.classList.add('is-ready'); }, 1400);
    initReveal();
  }

  /* ---------- REVEAL ---------- */
  function initReveal() {
    var els = document.querySelectorAll('[data-reveal], [data-stagger], .value');
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

  /* ---------- RAIL (Draw Attention Line) ---------- */
  var dotsWrap = document.getElementById('railDots');
  var railFill = document.getElementById('railFill');
  var topProgress = document.getElementById('topProgress');
  sections.forEach(function (s) {
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
  var menuLinks = document.querySelectorAll('.menu__list a');

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
    var hIdx = currentIndex(y + header.offsetHeight / 2);
    header.classList.toggle('is-dark', sections[hIdx].dataset.theme === 'dark');
    var rIdx = currentIndex(y + vh / 2);
    rail.classList.toggle('is-dark', sections[rIdx].dataset.theme === 'dark');
    Array.prototype.forEach.call(dots, function (d, i) { d.classList.toggle('is-current', i === rIdx); });
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
  function goTo(id) {
    var el = document.getElementById(id);
    if (!el) return;
    closeMenu();
    if (reduceMotion) { window.scrollTo(0, el.offsetTop); return; }
    var idxNow = currentIndex(window.scrollY + 1);
    var idxTo = sections.indexOf(el);
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

  /* ---------- SLIDESHOW (wartości) ---------- */
  var slides = document.querySelectorAll('.values__slide');
  var si = 0;
  if (slides.length > 1 && !reduceMotion) {
    setInterval(function () {
      slides[si].classList.remove('is-active');
      si = (si + 1) % slides.length;
      slides[si].classList.add('is-active');
    }, 5200);
  }

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
     Kolejność zdjęć zmieniamy tylko lokalnie (w obrębie najbliższych kilkunastu). */
  var gallery = document.getElementById('gallery');
  var PORTRAIT = 0.9;

  function isPortrait(it) { return parseFloat(it.dataset.ar || '1.5') < PORTRAIT; }

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
    });
    var variants = cols >= 4 ? VARIANTS_4 : VARIANTS_2;
    var LOOK = 12;
    var order = 0;
    var chunkNo = 0;
    var lastT = [];
    var history = [];

    while (queue.length) {
      var left = queue.length;
      var chunk;
      if (cols >= 4 && left === 1) {
        chunk = { p: ['w4'], t: [] };
      } else {
        var look = queue.slice(0, LOOK);
        var pAvail = look.filter(isPortrait).length;
        var lAvail = look.length - pAvail;
        var pRatio = pAvail / look.length;
        var best = null;
        var bestScore = Infinity;
        variants.forEach(function (v, vi) {
          var size = v.p.length;
          if (size > left) return;
          if (cols >= 4 && left - size === 1) return; // nie zostawiamy pojedynczego zdjęcia
          var tCount = v.p.filter(function (x) { return x === 't' || x === 'bt'; }).length;
          var mismatch = Math.max(0, tCount - pAvail) + Math.max(0, size - tCount - lAvail);
          var stacked = v.t.some(function (c) { return lastT.indexOf(c) > -1; });
          var wide = cols >= 4;
          var score = mismatch * 100
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

      // wysokie kafelki biorą najbliższe zdjęcia pionowe, pozostałe najbliższe poziome
      var window_ = queue.slice(0, LOOK);
      chunk.p.forEach(function (slot) {
        var want = slot === 't' || slot === 'bt';
        var idx = -1;
        for (var k = 0; k < window_.length; k++) {
          if (isPortrait(window_[k]) === want) { idx = k; break; }
        }
        if (idx < 0) idx = 0;
        var it = window_.splice(idx, 1)[0];
        if (!it) return;
        queue.splice(queue.indexOf(it), 1);
        if (slot !== 's') it.classList.add('bento-' + slot);
        it.style.order = order++;
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

  /* ---------- BEAMS (motyw: Beams Background, KokonutUI, MIT) ----------
     Wersja ciemna: ciepło-szare smugi o niskiej jasności, jak światło w scenicznym dymie.
     Rysujemy w obniżonej rozdzielczości (BEAM_SCALE), rozmycie robi CSS. */
  var beamsCanvas = document.querySelector('.values__beams');
  if (beamsCanvas && beamsCanvas.getContext) {
    var bctx = beamsCanvas.getContext('2d');
    var beamsHost = beamsCanvas.parentElement;
    var BEAM_SCALE = 0.35;
    var BEAM_COUNT = 22;
    var beams = [];
    var bw = 0;
    var bh = 0;
    var beamRaf = null;
    var beamsVisible = false;

    var makeBeam = function () {
      return {
        x: Math.random() * bw * 1.5 - bw * 0.25,
        y: Math.random() * bh * 1.5 - bh * 0.25,
        width: 40 + Math.random() * 90,
        length: bh * 2.5,
        angle: -35 + Math.random() * 10,
        speed: 0.3 + Math.random() * 0.6,
        opacity: 0.14 + Math.random() * 0.16,
        hue: 28 + Math.random() * 16,
        sat: 12 + Math.random() * 14,
        light: 30 + Math.random() * 10,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.008 + Math.random() * 0.016
      };
    };
    var resetBeam = function (b, i) {
      var spacing = bw / 3;
      b.y = bh + 100;
      b.x = (i % 3) * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
      b.width = 90 + Math.random() * 90;
      b.speed = 0.28 + Math.random() * 0.3;
      b.opacity = 0.16 + Math.random() * 0.1;
    };
    var sizeBeams = function () {
      bw = beamsHost.offsetWidth;
      bh = beamsHost.offsetHeight;
      beamsCanvas.width = Math.max(1, Math.round(bw * BEAM_SCALE));
      beamsCanvas.height = Math.max(1, Math.round(bh * BEAM_SCALE));
      bctx.setTransform(BEAM_SCALE, 0, 0, BEAM_SCALE, 0, 0);
      beams = [];
      for (var i = 0; i < BEAM_COUNT; i++) beams.push(makeBeam());
    };
    var drawBeams = function () {
      bctx.clearRect(0, 0, bw, bh);
      beams.forEach(function (b) {
        var a = b.opacity * (0.8 + Math.sin(b.pulse) * 0.2);
        var col = 'hsla(' + b.hue.toFixed(0) + ',' + b.sat.toFixed(0) + '%,' + b.light.toFixed(0) + '%,';
        bctx.save();
        bctx.translate(b.x, b.y);
        bctx.rotate(b.angle * Math.PI / 180);
        var g = bctx.createLinearGradient(0, 0, 0, b.length);
        g.addColorStop(0, col + '0)');
        g.addColorStop(0.1, col + (a * 0.5) + ')');
        g.addColorStop(0.4, col + a + ')');
        g.addColorStop(0.6, col + a + ')');
        g.addColorStop(0.9, col + (a * 0.5) + ')');
        g.addColorStop(1, col + '0)');
        bctx.fillStyle = g;
        bctx.fillRect(-b.width / 2, 0, b.width, b.length);
        bctx.restore();
      });
    };
    var beamTick = function () {
      beams.forEach(function (b, i) {
        b.y -= b.speed;
        b.pulse += b.pulseSpeed;
        if (b.y + b.length < -100) resetBeam(b, i);
      });
      drawBeams();
      beamRaf = requestAnimationFrame(beamTick);
    };
    var beamsStart = function () {
      if (beamRaf) return;
      beamsCanvas.classList.add('is-on');
      if (reduceMotion) { drawBeams(); return; }
      beamRaf = requestAnimationFrame(beamTick);
    };
    var beamsStop = function () { cancelAnimationFrame(beamRaf); beamRaf = null; };

    sizeBeams();
    drawBeams();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        beamsVisible = entries[0].isIntersecting;
        if (beamsVisible) beamsStart(); else beamsStop();
      }, { threshold: 0 }).observe(beamsHost);
    } else {
      beamsStart();
    }
    var beamsResize = null;
    window.addEventListener('resize', function () {
      clearTimeout(beamsResize);
      beamsResize = setTimeout(function () { sizeBeams(); drawBeams(); }, 150);
    });
  }

  /* ---------- MEDIA BENTO: kadry po kolei zapalają się w kolorze ---------- */
  var bento = document.getElementById('mediaBento');
  if (bento) {
    var litTiles = Array.prototype.slice.call(bento.querySelectorAll('.bento__tile')).sort(function (a, b) {
      return (+a.dataset.seq) - (+b.dataset.seq);
    });
    var litIdx = -1;
    var litTimer = null;
    var bentoInView = false;
    var bentoHover = false;
    var LIT_EVERY = 3200;

    var lightTile = function (i) {
      litIdx = i;
      litTiles.forEach(function (t, k) { t.classList.toggle('is-lit', k === i); });
    };
    var litStep = function () { lightTile((litIdx + 1) % litTiles.length); };
    var litStart = function () {
      if (litTimer || reduceMotion) return;
      litStep();
      litTimer = setInterval(litStep, LIT_EVERY);
    };
    var litStop = function () { clearInterval(litTimer); litTimer = null; };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        bentoInView = entries[0].isIntersecting;
        if (bentoInView && !bentoHover) litStart(); else litStop();
      }, { threshold: 0.3 }).observe(bento);
    } else {
      litStart();
    }

    litTiles.forEach(function (t, k) {
      var focusTile = function () { bentoHover = true; litStop(); lightTile(k); };
      t.addEventListener('mouseenter', focusTile);
      t.addEventListener('focusin', focusTile);
    });
    var resumeLit = function () { bentoHover = false; if (bentoInView) litStart(); };
    bento.addEventListener('mouseleave', resumeLit);
    bento.addEventListener('focusout', function (e) { if (!bento.contains(e.relatedTarget)) resumeLit(); });
  }

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
