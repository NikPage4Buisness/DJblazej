/* DJ Błażej Biurkowski | sekcja „Pełna oprawa Twojego wydarzenia” (podstrona Eventy)
   Karuzela 3D ze zdjęciami, tło z wiązkami światła i karty spotlight z ofertą. Wydzielone z main.js, bo ta sekcja
   mieszka teraz na podstronie eventy/ (strona główna jej nie ma). Plik jest samodzielny: nie zależy od main.js. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rail = document.querySelector('.rail');                       // na podstronie go nie ma (null)
  var header = document.querySelector('.subhead') || document.getElementById('header');

  /* ---------- KARUZELA 3D (sekcja Styl) ----------
     Zdjęcia są ścianami obracającego się graniastosłupa: środkowe stoi przodem, sąsiednie odchodzą
     w głąb pod kątem THETA i stykają się z nim krawędzią, dalsze są po niewidocznej stronie.
     Przy obrocie zdjęcie zwęża się i znika za krawędzią następnego, jakby całość kręciła się w kółko.
     Bez strzałek: przeciąganie myszą lub palcem, strzałki na klawiaturze, klik w boczne zdjęcie.
     Karuzela cały czas lekko się obraca (stała, wolna prędkość). Gdy ktoś ją przesunie, po puszczeniu
     dociąga do najbliższego zdjęcia, zatrzymuje się na nim na 1,5 s i dopiero wtedy łagodnie się rozpędza
     do dalszego kręcenia. Pozycja jest ułamkowa (liczona w zdjęciach), a dociąganie to sprężyna
     z tłumieniem krytycznym, więc bez szarpnięcia i bez odbicia.
     Na komputerze środkowe zdjęcie ma wysokość listy tekstów obok (najwyżej tyle, ile mieści ekran),
     a karuzela może wyjść w lewo poza kolumnę, aż do toru paska nut. */
  var carousel = document.querySelector('[data-carousel]');
  if (carousel) (function () {
    var track = carousel.querySelector('.carousel__track');
    var tiles = Array.prototype.slice.call(track.children);
    var n = tiles.length;
    if (n < 3) return;
    var valuesList = document.querySelector('.values__copy') || document.querySelector('.values__list');

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
    var SNAP = 5.75;           // tempo dociągania po puszczeniu (mniej = wolniej i łagodniej); +15% względem 5
    var DRIFT = .1265;         // ciągły, lekki obrót: tyle zdjęć na sekundę (ok. 8,6° na sekundę, zdjęcie przesuwa się co ~8 s); +15% względem .11
    var HOLD = 1500;           // ms postoju na zdjęciu po dociągnięciu przeciągniętej karuzeli
    var RAMP = 1.2;            // s łagodnego rozpędzania do pełnej prędkości po postoju (o 15% krócej)

    var pos = 0;               // która pozycja jest na środku (ułamkowo)
    var target = 0;            // pozycja docelowa (pełne zdjęcie)
    var vel = 0;               // prędkość w zdjęciach na sekundę
    var omega = SNAP;
    var mode = 'drift';        // drift = ciągły obrót, settle = dociąganie do zdjęcia, hold = postój
    var gain = 0;              // 0..1: rozpęd ciągłego obrotu po starcie i po postoju
    var holdUntil = 0;
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

    var inView = false;
    function active() { return inView && !document.hidden; }
    function tick(now) {
      var dt = Math.min(.05, (now - lastT) / 1000);
      lastT = now;
      if (!dragging) {
        if (reduceMotion) {
          pos = target; vel = 0;
        } else if (mode === 'drift') {
          // ciągły, lekki obrót: stała prędkość, rozpędzana łagodnie po starcie i po postoju
          gain = Math.min(1, gain + dt / RAMP);
          vel = DRIFT * gain * gain * (3 - 2 * gain);
          pos += vel * dt;
          target = pos;
        } else if (mode === 'settle') {
          // sprężyna z tłumieniem krytycznym: najszybsze dojście do celu, które nie przestrzeliwuje
          vel += (-omega * omega * (pos - target) - 2 * omega * vel) * dt;
          pos += vel * dt;
          if (Math.abs(pos - target) < .0006 && Math.abs(vel) < .004) {
            pos = target; vel = 0;
            mode = 'hold'; holdUntil = now + HOLD;
          }
        } else if (now >= holdUntil) {
          mode = 'drift'; gain = 0;
        }
        if (pos >= n) { pos -= n; target -= n; } else if (pos < 0) { pos += n; target += n; }   // liczby zostają w zakresie 0..n
      }
      layout();
      // pętla chodzi, gdy karuzela się rusza albo czeka na koniec postoju; poza ekranem odpoczywa
      if (dragging || (!reduceMotion && active()) || pos !== target) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
      }
    }
    function wake() {
      if (raf) return;
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });


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
      mode = 'settle'; gain = 0;   // po puszczeniu: dociągnięcie do zdjęcia, postój, dopiero potem dalszy obrót
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
      omega = SNAP; mode = 'settle'; gain = 0;
      wake();
    }
    carousel.addEventListener('pointerup', endDrag);
    carousel.addEventListener('pointercancel', endDrag);
    carousel.addEventListener('lostpointercapture', endDrag);

    carousel.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      omega = SNAP; mode = 'settle'; gain = 0;
      target = Math.round(target) + (e.key === 'ArrowRight' ? 1 : -1);
      wake();
    });

    // zdjęcia pobieramy, gdy sekcja zbliża się do ekranu; obrót działa tylko, gdy karuzelę widać
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
        inView = entries[0].isIntersecting;
        if (inView) wake();
      }, { threshold: .3 }).observe(carousel);
    } else {
      inView = true;
      loadAll();
      wake();
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


  /* ---------- OFERTA: KARTY SPOTLIGHT ----------
     Tylko dla myszy (hover + precyzyjny wskaźnik) i bez ograniczonego ruchu: karta lekko się przechyla
     w stronę kursora, a poświata podąża za nim. Zdarzenia łapie nieruchomy <li>, żeby przechył karty
     nie zmieniał obszaru najechania. Styl i reszta efektu (połysk, linia, przygaszenie sąsiadów) jest w CSS. */
  (function () {
    var cards = document.querySelectorAll('.value');
    if (!cards.length || reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var TILT = 6;   // maksymalny przechył w stopniach
    Array.prototype.forEach.call(cards, function (li) {
      var card = li.querySelector('.value__card');
      if (!card) return;
      li.addEventListener('pointermove', function (e) {
        var r = li.getBoundingClientRect();
        var x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        var y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        card.style.setProperty('--ry', ((x - .5) * 2 * TILT).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((.5 - y) * 2 * TILT).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      li.addEventListener('pointerleave', function () {
        card.style.removeProperty('--rx'); card.style.removeProperty('--ry');
        card.style.removeProperty('--mx'); card.style.removeProperty('--my');
      });
    });
  })();

})();
