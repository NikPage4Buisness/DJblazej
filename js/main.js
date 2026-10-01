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

  /* ---------- RAIL: skróty sekcji jako nuty ----------
     Każda sekcja ma inną nutę, a wartości rosną w dół strony jak zwalniająca fraza:
     trzydziestodwójka, szesnastka, ósemka, ćwierćnuta, półnuta i na końcu cała nuta
     (każda trwa dwa razy dłużej od poprzedniej; trzydziestodwójki i szesnastki jako pary
     połączone belkami). Nutę można też wybrać ręcznie atrybutem
     data-note na sekcji: trzydziestodwojka, szesnastka, osemka, cwiercnuta, polnuta, calka.
     Główka nuty (punkt 9,27 w viewBox 24x34) leży na linii paska. */
  var dotsWrap = document.getElementById('railDots');
  var railFill = document.getElementById('railFill');
  var topProgress = document.getElementById('topProgress');
  var NOTE_SERIES = ['thirtysecond', 'sixteenth', 'eighth', 'quarter', 'half', 'whole'];
  var NOTE_NAMES = {
    trzydziestodwojka: 'thirtysecond', szesnastka: 'sixteenth', osemka: 'eighth',
    cwiercnuta: 'quarter', polnuta: 'half', calka: 'whole'
  };
  var NOTE_HEAD = '<ellipse cx="9" cy="27" rx="5" ry="3.6" transform="rotate(-22 9 27)"/>';
  function noteStem(top) {
    return '<rect x="12.35" y="' + top + '" width="1.5" height="' + (26.6 - top).toFixed(1) + '" rx=".75"/>';
  }
  // dwie nuty połączone belkami (2 belki = szesnastki, 3 belki = trzydziestodwójki);
  // druga nuta stoi o stopień wyżej, belki lekko się wznoszą, para jest wyśrodkowana na linii paska
  function beamedPair(beams) {
    var thick = beams > 2 ? 2 : 2.4;
    var step = beams > 2 ? 3.4 : 3.8;
    var top = beams > 2 ? 4 : 5;
    var s = '<ellipse cx="4.1" cy="27" rx="4.4" ry="3.2" transform="rotate(-22 4.1 27)"/>' +
      '<ellipse cx="14.1" cy="25" rx="4.4" ry="3.2" transform="rotate(-22 14.1 25)"/>' +
      '<rect x="6.85" y="' + top + '" width="1.5" height="' + (26.6 - top).toFixed(1) + '" rx=".75"/>' +
      '<rect x="16.85" y="' + (top - 2) + '" width="1.5" height="' + (26.6 - top).toFixed(1) + '" rx=".75"/>';
    for (var b = 0; b < beams; b++) {
      var y = top + b * step;
      s += '<path d="M6.85 ' + y.toFixed(1) + 'L18.35 ' + (y - 2).toFixed(1) + 'v' + thick + 'L6.85 ' + (y + thick).toFixed(1) + 'z"/>';
    }
    return s;
  }
  var NOTE_SVG = {
    thirtysecond: beamedPair(3),
    sixteenth: beamedPair(2),
    eighth: NOTE_HEAD + noteStem(4) + '<path d="M13.85 4c.45 4.6 6.55 6.3 5.35 13.4-.3-2.5-2.3-4.9-5.35-5.8z"/>',
    quarter: NOTE_HEAD + noteStem(4),
    half: '<path fill-rule="evenodd" d="M13.636 25.127A5 3.6 -22 0 1 4.364 28.873 5 3.6 -22 0 1 13.636 25.127ZM11.867 24.992A3.5 1.55 -35 0 1 6.133 29.008 3.5 1.55 -35 0 1 11.867 24.992Z"/>' + noteStem(4),
    whole: '<path fill-rule="evenodd" d="M2.8 27A6.2 4.1 0 0 1 15.2 27 6.2 4.1 0 0 1 2.8 27ZM10.95 29.785A3.4 1.9 55 0 1 7.05 24.215 3.4 1.9 55 0 1 10.95 29.785Z"/>'
  };
  // efekty kliknięcia: dwie fale dźwięku z główki i mała ósemka, która odlatuje w górę
  var NOTE_FX = '<circle class="note__ring" cx="9" cy="27" r="6"/><circle class="note__ring" cx="9" cy="27" r="6"/>' +
    '<g class="note__float"><ellipse cx="17.6" cy="11.4" rx="2.3" ry="1.65" transform="rotate(-22 17.6 11.4)"/>' +
    '<rect x="19.1" y="3.6" width=".9" height="7.6" rx=".45"/><path d="M20 3.6c.3 2.2 3.1 3 2.6 6.4-.2-1.2-1.2-2.3-2.6-2.8z"/></g>';
  // domyślnie ostatnie n wartości z szeregu, więc ostatnia sekcja zawsze dostaje całą nutę
  function noteFor(i, n, name) {
    if (name && NOTE_NAMES[name]) return NOTE_NAMES[name];
    return NOTE_SERIES[Math.max(0, NOTE_SERIES.length - n + i)];
  }
  rail.style.setProperty('--n', sections.length);
  sections.forEach(function (s, i) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    var type = noteFor(i, sections.length, s.dataset.note);
    a.href = '#' + s.id;
    a.className = 'note--' + type;
    a.setAttribute('data-nav', '');
    a.setAttribute('aria-label', s.dataset.label);
    a.innerHTML = '<svg class="rail__note" viewBox="0 0 24 34" width="24" height="34" aria-hidden="true" focusable="false">' +
      NOTE_SVG[type] + NOTE_FX + '</svg>';
    var span = document.createElement('span');
    span.textContent = s.dataset.label;
    a.appendChild(span);
    a.addEventListener('click', function () {
      a.classList.remove('is-hit');
      void a.offsetWidth;          // animacja startuje od nowa także przy szybkim klikaniu
      a.classList.add('is-hit');
      clearTimeout(a._hitTimer);
      a._hitTimer = setTimeout(function () { a.classList.remove('is-hit'); }, 1300);
    });
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

  /* ---------- KARUZELA 3D (sekcja Styl) ----------
     Zdjęcia są ścianami obracającego się graniastosłupa: środkowe stoi przodem, sąsiednie odchodzą
     w głąb pod kątem THETA i stykają się z nim krawędzią, dalsze są po niewidocznej stronie.
     Przy obrocie zdjęcie zwęża się i znika za krawędzią następnego, jakby całość kręciła się w kółko.
     Bez strzałek: przeciąganie myszą lub palcem, strzałki na klawiaturze, klik w boczne zdjęcie,
     a co kilka sekund karuzela obraca się sama. Pozycja jest ułamkowa (liczona w zdjęciach)
     i dochodzi do celu sprężyną z tłumieniem krytycznym, więc niedociągnięte zdjęcie samo płynnie
     ustawia się na środku, bez szarpnięcia i bez odbicia.
     Na komputerze środkowe zdjęcie ma wysokość listy tekstów obok (najwyżej tyle, ile mieści ekran),
     a karuzela może wyjść w lewo poza kolumnę, aż do toru paska nut. */
  var carousel = document.querySelector('[data-carousel]');
  if (carousel) (function () {
    var track = carousel.querySelector('.carousel__track');
    var tiles = Array.prototype.slice.call(track.children);
    var n = tiles.length;
    if (n < 3) return;
    var valuesList = document.querySelector('.values__list');

    var THETA = 68;            // kąt między sąsiednimi zdjęciami na obwodzie (stopnie); większy = węższe boki
    var PERSP = 2.8;           // odległość „oka” liczona w szerokościach zdjęcia
    var SIDE_DIM = .5;         // przygaszenie bocznych zdjęć (0 = bez zmian, 1 = czarne)
    var SIZE = .86;            // wysokość środkowego zdjęcia względem listy tekstów obok (1 = równo z tekstem)
    // Szerokość całej karuzeli w szerokościach środkowego zdjęcia: w spoczynku (środek + widoczne boki)
    // i w połowie obrotu, kiedy bryła jest najszersza. Miejsce rezerwujemy pośrodku tych dwóch wartości,
    // żeby obracające się zdjęcia nie wchodziły pod pasek nut ani w tekst.
    var SPREAD = (function () {
      var r = .5 / Math.tan(THETA * Math.PI / 360);
      function span(deg) {
        var t = deg * Math.PI / 180;
        return 2 * (r * Math.sin(t) + .5 * Math.cos(t)) * PERSP / (PERSP + r - r * Math.cos(t) + .5 * Math.sin(t));
      }
      return (span(THETA) + span(THETA / 2)) / 2;
    })();
    var SNAP = 5;              // tempo dociągania po puszczeniu (mniej = wolniej i łagodniej)
    var GLIDE = 3.4;           // tempo samoczynnego obrotu
    var AUTO_EVERY = 5200;     // co ile ms karuzela obraca się sama
    var AUTO_RESUME = 7000;    // ile ms po ruchu użytkownika wraca samoczynny obrót

    var pos = 0;               // która pozycja jest na środku (ułamkowo)
    var target = 0;            // pozycja docelowa (pełne zdjęcie)
    var vel = 0;               // prędkość w zdjęciach na sekundę
    var omega = GLIDE;
    var dragging = false;
    var raf = null;
    var lastT = 0;
    var tileW = 320;           // szerokość zdjęcia w px
    var radius = 250;          // promień graniastosłupa: sąsiednie ściany stykają się krawędziami
    var stepPx = 190;          // ile px przeciągnięcia obraca o jedno zdjęcie

    function measure() {
      var tall;
      if (window.matchMedia('(min-width: 961px)').matches && valuesList) {
        // karuzela może wyjść w lewo poza kolumnę, aż do toru paska nut (albo marginesu ekranu)
        var grid = carousel.parentNode;
        var colLeft = grid.getBoundingClientRect().left + parseFloat(getComputedStyle(grid).paddingLeft);
        var lane = rail && getComputedStyle(rail).display !== 'none' ? rail.getBoundingClientRect().right + 38 : 24;
        carousel.style.setProperty('--bleed', Math.max(0, colLeft - lane).toFixed(0) + 'px');
        // z prawej boczne zdjęcie może wejść w odstęp między kolumnami (zostaje 44 px do tekstu)
        var colGap = parseFloat(getComputedStyle(grid).columnGap) || 0;
        carousel.style.setProperty('--bleed-r', Math.max(0, colGap - 44).toFixed(0) + 'px');
        // wysokość jak lista tekstów obok, ale nie więcej, niż mieści ekran pod nagłówkiem
        var cap = window.innerHeight - header.offsetHeight - 68;   // zapas: w obrocie krawędź bryły jest o kilka procent wyższa
        tall = Math.max(320, Math.min(valuesList.offsetHeight, cap) * SIZE);
        track.style.setProperty('--tile-h', tall.toFixed(0) + 'px');
      } else {
        carousel.style.removeProperty('--bleed');
        carousel.style.removeProperty('--bleed-r');
        track.style.removeProperty('--tile-h');
        tall = parseFloat(getComputedStyle(tiles[0]).height) || 360;
      }
      // zdjęcie w proporcjach 3:4; gdy brakuje szerokości, kafelek jest smuklejszy (boki zdjęcia poza kadrem)
      tileW = Math.min(tall * .75, carousel.clientWidth / SPREAD);
      tiles.forEach(function (li) { li.style.setProperty('--ar', (tileW / tall).toFixed(4)); });
      radius = tileW / 2 / Math.tan(THETA * Math.PI / 360);
      stepPx = tileW * .6;
      track.style.perspective = (tileW * PERSP).toFixed(0) + 'px';
    }

    // odległość zdjęcia od środka z zawinięciem (karuzela nie ma końca)
    function offsetOf(i) {
      var d = ((i - pos) % n + n) % n;
      return d > n / 2 ? d - n : d;
    }

    function layout() {
      for (var i = 0; i < n; i++) {
        var d = offsetOf(i);
        var phi = d * THETA;                      // kąt zdjęcia na obwodzie
        var aphi = Math.abs(phi);
        var el = tiles[i];
        if (aphi >= 90) { el.style.visibility = 'hidden'; continue; }   // niewidoczna strona bryły
        var rad = phi * Math.PI / 180;
        el.style.visibility = 'visible';
        el.style.transform = 'translate3d(' + (radius * Math.sin(rad)).toFixed(1) + 'px,0,' +
          (radius * Math.cos(rad) - radius).toFixed(1) + 'px) rotateY(' + phi.toFixed(2) + 'deg)';
        el.style.opacity = Math.min(1, (90 - aphi) / 16).toFixed(3);   // gaśnie tuż przed ustawieniem się bokiem
        el.style.zIndex = 100 - Math.round(Math.abs(d) * 20);
        el.style.filter = aphi < .5 ? 'none' : 'brightness(' + (1 - Math.min(aphi / THETA, 1) * SIDE_DIM).toFixed(3) + ')';
      }
    }

    function tick(now) {
      var dt = Math.min(.05, (now - lastT) / 1000);
      lastT = now;
      if (!dragging) {
        if (reduceMotion) {
          pos = target; vel = 0;
        } else {
          // sprężyna z tłumieniem krytycznym: najszybsze dojście do celu, które nie przestrzeliwuje
          vel += (-omega * omega * (pos - target) - 2 * omega * vel) * dt;
          pos += vel * dt;
          if (Math.abs(pos - target) < .0006 && Math.abs(vel) < .004) { pos = target; vel = 0; }
        }
      }
      layout();
      if (dragging || pos !== target) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
        var turns = Math.floor(target / n) * n;   // liczby zostają w zakresie 0..n
        pos -= turns; target -= turns;
      }
    }
    function wake() {
      if (raf) return;
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
    }

    /* samoczynna zmiana: tylko gdy karuzela jest na ekranie i nikt jej nie dotyka */
    var autoTimer = null;
    var resumeTimer = null;
    var inView = false;
    var hovering = false;
    function autoStep() {
      if (dragging || hovering || !inView || document.hidden) return;
      omega = GLIDE;
      target = Math.round(target) + 1;
      wake();
    }
    function startAuto() {
      clearInterval(autoTimer);
      if (!reduceMotion) autoTimer = setInterval(autoStep, AUTO_EVERY);
    }
    function pauseAuto() { clearInterval(autoTimer); clearTimeout(resumeTimer); autoTimer = null; }
    function resumeAutoLater() { pauseAuto(); resumeTimer = setTimeout(startAuto, AUTO_RESUME); }
    carousel.addEventListener('mouseenter', function () { hovering = true; });
    carousel.addEventListener('mouseleave', function () { hovering = false; });

    /* przeciąganie: zdjęcia jadą za ręką, po puszczeniu rozpęd przechodzi w dociąganie do środka */
    var pid = null;
    var startX = 0;
    var startPos = 0;
    var lastMove = 0;
    var travelled = 0;
    carousel.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      pid = e.pointerId;
      startX = e.clientX; startPos = pos; travelled = 0; vel = 0;
      lastMove = performance.now();
      carousel.classList.add('is-dragging');
      try { carousel.setPointerCapture(pid); } catch (err) { /* brak wsparcia: przeciąganie działa nad karuzelą */ }
      pauseAuto();
      wake();
    });
    carousel.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pid) return;
      var now = performance.now();
      var next = startPos - (e.clientX - startX) / stepPx;
      var dtm = Math.max(.001, (now - lastMove) / 1000);
      vel = vel * .6 + ((next - pos) / dtm) * .4;      // wygładzona prędkość ręki
      travelled = Math.max(travelled, Math.abs(e.clientX - startX));
      pos = next;
      lastMove = now;
    });
    function endDrag(e) {
      if (!dragging || (e && e.pointerId !== pid)) return;
      dragging = false;
      carousel.classList.remove('is-dragging');
      if (performance.now() - lastMove > 140) vel = 0;  // ręka stała w miejscu przed puszczeniem
      vel = Math.max(-5, Math.min(5, vel));
      if (travelled < 6 && e && e.type === 'pointerup') {
        // zwykłe kliknięcie w boczne zdjęcie przenosi je na środek
        var hit = document.elementFromPoint(e.clientX, e.clientY);
        var li = hit && hit.closest ? hit.closest('.carousel__item') : null;
        var idx = tiles.indexOf(li);
        target = idx > -1 ? Math.round(pos + offsetOf(idx)) : Math.round(pos);
      } else {
        // najbliższe zdjęcie; szybkie machnięcie przenosi o jedno dalej
        target = Math.round(pos + Math.max(-.6, Math.min(.6, vel * .18)));
      }
      omega = SNAP;
      wake();
      resumeAutoLater();
    }
    carousel.addEventListener('pointerup', endDrag);
    carousel.addEventListener('pointercancel', endDrag);
    carousel.addEventListener('lostpointercapture', endDrag);

    carousel.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      omega = SNAP;
      target = Math.round(target) + (e.key === 'ArrowRight' ? 1 : -1);
      wake();
      resumeAutoLater();
    });

    // zdjęcia pobieramy, gdy sekcja zbliża się do ekranu; samoczynna zmiana działa tylko na ekranie
    function loadAll() {
      tiles.forEach(function (li) { li.querySelector('img').loading = 'eager'; });
    }
    if ('IntersectionObserver' in window) {
      var loadIo = new IntersectionObserver(function (entries) {
        if (!entries.some(function (en) { return en.isIntersecting; })) return;
        loadIo.disconnect();
        loadAll();
      }, { rootMargin: '100% 0px' });
      loadIo.observe(carousel);
      new IntersectionObserver(function (entries) {
        var now = entries[0].isIntersecting;
        if (now && !inView && !dragging) startAuto();   // odliczanie od chwili, gdy karuzelę widać
        inView = now;
      }, { threshold: .3 }).observe(carousel);
    } else {
      inView = true;
      loadAll();
      startAuto();
    }

    var carouselResize = null;
    window.addEventListener('resize', function () {
      clearTimeout(carouselResize);
      carouselResize = setTimeout(function () { measure(); layout(); }, 120);
    });

    function refit() { measure(); layout(); }
    refit();
    window.addEventListener('load', refit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
  })();

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

  /* ---------- MEDIA: logotypy rozrzucone wokół ściany kadrów ----------
     Źródłem jest pasek logotypów na dole sekcji (jedna lista do edycji). Na komputerze kopiujemy
     z niego logotypy do listy .media__logos przy ścianie kadrów; rozmieszczenie i unoszenie są w CSS.
     Pasek zostaje widoczny tylko na telefonie i tablecie w pionie (klasa has-logos na sekcji). */
  var mediaSection = document.getElementById('media');
  var mediaStage = mediaSection && mediaSection.querySelector('.media__stage');
  var mediaMarquee = mediaSection && mediaSection.querySelector('.marquee');
  if (mediaStage && mediaMarquee) {
    var logoCloud = document.createElement('ul');
    logoCloud.className = 'media__logos';
    logoCloud.setAttribute('aria-label', mediaMarquee.getAttribute('aria-label') || 'Media');
    Array.prototype.forEach.call(mediaMarquee.querySelectorAll('img:not([aria-hidden])'), function (img, i) {
      var li = document.createElement('li');
      li.className = 'media__logo';
      li.style.setProperty('--i', i);
      li.appendChild(img.cloneNode(false));
      logoCloud.appendChild(li);
    });
    if (logoCloud.children.length) {
      mediaStage.appendChild(logoCloud);
      mediaSection.classList.add('has-logos');
    }
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
