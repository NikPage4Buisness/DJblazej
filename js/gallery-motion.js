/*
 * Płynne przejścia w galeriach portfolio (strona główna i podstrony).
 *
 * Gdy zmienia się zestaw widocznych zdjęć (zmiana zakładki, „więcej”, zmiana szerokości okna), zdjęcia nie przeskakują:
 *  - zdjęcia, które zostają, płynnie przesuwają się (i zmieniają rozmiar) na nowe miejsca,
 *  - zdjęcia, które znikają, kurczą się i gasną w miejscu,
 *  - zdjęcia, które dochodzą, wyrastają z zera,
 *  - kolejne zdjęcia ruszają z lekkim opóźnieniem (kaskada), a wysokość galerii zmienia się płynnie.
 * Tak samo działa Isotope w galerii na obecnej stronie klienta (500 ms, kaskada 30 ms).
 *
 * Skrypt niczego nie zakłada o zdjęciach, ich liczbie ani proporcjach: mierzy położenie kafelków przed zmianą i po niej
 * (technika FLIP), więc działa tak samo dla zdjęć z projektu i dodanych później przez edytor. Układ (kolejność, rozmiary kafelków)
 * nadal liczy kod galerii; tu jest tylko ruch. Ruch jest wyłączany przy ustawieniu „ogranicz animacje” w systemie.
 *
 * Użycie:  BBMotion.run( kontener, kafelki, function () { …zmiana widocznych zdjęć i układu… } );
 */
(function () {
  'use strict';

  var DURATION = 520;                         // ms
  var STAGGER = 28;                           // ms opóźnienia między kolejnymi zdjęciami
  var MAX_DELAY = 340;                        // ms: kaskada nigdy nie wydłuża przejścia ponad tyle
  var EASE = 'cubic-bezier(.22, .61, .36, 1)';
  var MARGIN = 280;                           // px: animujemy zdjęcia widoczne i blisko ekranu, reszta zmienia się bez ruchu

  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var current = null;                         // trwające przejście: { anims, ghosts }

  function shown(el) {
    return !el.hidden && el.getClientRects().length > 0;
  }

  // położenie względem kontenera (nie ekranu), więc przewinięcie strony w trakcie zmiany niczego nie psuje
  function rel(el, box) {
    var r = el.getBoundingClientRect();
    return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
  }

  function near(r, box) {
    var top = box.top + r.y;
    return top < window.innerHeight + MARGIN && top + r.h > -MARGIN;
  }

  function byPosition(a, b) {
    return (a.r.y - b.r.y) || (a.r.x - b.r.x);
  }

  function delayOf(rank) {
    return Math.min(rank * STAGGER, MAX_DELAY);
  }

  // kończy poprzednie przejście od razu (np. szybkie klikanie zakładek), żeby nowe zaczęło od czystego układu
  function finishCurrent() {
    if (!current) return;
    var cur = current;
    current = null;
    cur.anims.forEach(function (a) { try { a.finish(); } catch (e) { /* animacja już skończona */ } });
    cur.ghosts.forEach(function (g) { if (g.parentNode) g.parentNode.removeChild(g); });
    cur.cleanups.forEach(function (fn) { fn(); });
  }

  function run(container, items, mutate) {
    if (!container || !container.animate || !items || !items.length || motion.matches) {
      mutate();
      return;
    }
    finishCurrent();

    /* 1. stan przed zmianą: położenie widocznych zdjęć i kopie tych, które mogą zniknąć */
    var box0 = container.getBoundingClientRect();
    var height0 = box0.height;
    var before = new Map();
    var copies = new Map();
    items.forEach(function (it) {
      if (!shown(it)) return;
      var r = rel(it, box0);
      before.set(it, r);
      if (near(r, box0)) copies.set(it, it.cloneNode(true));
    });

    /* 2. zmiana widocznych zdjęć i układu (robi kod galerii) */
    mutate();

    /* 3. stan po zmianie */
    var box1 = container.getBoundingClientRect();
    var height1 = box1.height;
    var after = new Map();
    items.forEach(function (it) {
      if (shown(it)) after.set(it, rel(it, box1));
    });

    var anims = [];
    var ghosts = [];
    var cleanups = [];
    var kept = [];
    var entering = [];
    var leaving = [];

    after.forEach(function (r1, it) {
      var r0 = before.get(it);
      if (r0) {
        if (near(r0, box0) || near(r1, box1)) kept.push({ it: it, r: r1, from: r0 });
      } else if (near(r1, box1)) {
        entering.push({ it: it, r: r1 });
      }
    });
    before.forEach(function (r0, it) {
      if (!after.has(it) && copies.has(it)) leaving.push({ it: it, r: r0, copy: copies.get(it) });
    });
    kept.sort(function (a, b) { return byPosition({ r: a.r }, { r: b.r }); });
    entering.sort(byPosition);
    leaving.sort(byPosition);

    /* 4a. zdjęcia, które zostają: przesunięcie i zmiana rozmiaru od starego położenia do nowego */
    var rank = 0;
    kept.forEach(function (k) {
      var a = k.from;
      var b = k.r;
      var moved = Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1 || Math.abs(a.w - b.w) > 1 || Math.abs(a.h - b.h) > 1;
      if (!moved) return;
      var sx = b.w ? a.w / b.w : 1;
      var sy = b.h ? a.h / b.h : 1;
      var timing = { duration: DURATION, delay: delayOf(rank++), easing: EASE, fill: 'backwards' };
      var it = k.it;
      var child = it.firstElementChild;
      var resized = Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01;
      if (resized) {
        // zdjęcie w środku nie jest rozciągane: okno kafelka zmienia rozmiar, a zawartość zostaje w docelowym rozmiarze i jest przycinana
        var prevOverflow = it.style.overflow;
        var prevRadius = it.style.borderRadius;
        it.style.overflow = 'hidden';
        if (child) it.style.borderRadius = window.getComputedStyle(child).borderRadius;
        cleanups.push(function () { it.style.overflow = prevOverflow; it.style.borderRadius = prevRadius; });
      }
      anims.push(it.animate([
        { transformOrigin: '0 0', transform: 'translate(' + (a.x - b.x) + 'px, ' + (a.y - b.y) + 'px) scale(' + sx + ', ' + sy + ')' },
        { transformOrigin: '0 0', transform: 'translate(0, 0) scale(1, 1)' }
      ], timing));
      if (resized && child) {
        anims.push(child.animate([
          { transformOrigin: '0 0', transform: 'scale(' + (1 / sx) + ', ' + (1 / sy) + ')' },
          { transformOrigin: '0 0', transform: 'scale(1, 1)' }
        ], timing));
      }
    });

    /* 4b. zdjęcia, które dochodzą: wyrastają ze środka swojego miejsca */
    entering.forEach(function (e) {
      anims.push(e.it.animate([
        { opacity: 0, transformOrigin: '50% 50%', transform: 'scale(0.001)' },
        { opacity: 1, transformOrigin: '50% 50%', transform: 'scale(1)' }
      ], { duration: DURATION, delay: delayOf(rank++), easing: EASE, fill: 'backwards' }));
    });

    /* 4c. zdjęcia, które znikają: kopia kurczy się i gaśnie w starym miejscu (oryginał jest już ukryty) */
    var ghostRank = 0;
    leaving.forEach(function (l) {
      var g = l.copy;
      g.removeAttribute('id');
      g.removeAttribute('data-bb-item');
      g.removeAttribute('hidden');
      g.classList.remove('is-hidden', 'is-extra', 'is-fading');
      g.classList.add('bb-ghost');
      g.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(g.querySelectorAll('button, a'), function (n) { n.tabIndex = -1; });
      Array.prototype.forEach.call(g.querySelectorAll('img'), function (img) { img.loading = 'eager'; });
      g.style.position = 'absolute';
      g.style.margin = '0';
      g.style.left = l.r.x + 'px';
      g.style.top = l.r.y + 'px';
      g.style.width = l.r.w + 'px';
      g.style.height = l.r.h + 'px';
      g.style.order = '';
      g.style.gridColumn = 'auto';
      g.style.gridRow = 'auto';
      g.style.pointerEvents = 'none';
      g.style.zIndex = '2';
      container.appendChild(g);
      ghosts.push(g);
      anims.push(g.animate([
        { opacity: 1, transformOrigin: '50% 50%', transform: 'scale(1)' },
        { opacity: 0, transformOrigin: '50% 50%', transform: 'scale(0.001)' }
      ], { duration: DURATION, delay: delayOf(ghostRank++), easing: EASE, fill: 'forwards' }));
    });

    /* 4d. wysokość galerii zmienia się płynnie, więc to, co jest pod nią, nie skacze */
    if (Math.abs(height1 - height0) > 1) {
      anims.push(container.animate(
        [{ height: height0 + 'px' }, { height: height1 + 'px' }],
        { duration: DURATION + Math.min(rank, 12) * STAGGER * 0.5, easing: EASE }
      ));
    }

    if (!anims.length) return;
    current = { anims: anims, ghosts: ghosts, cleanups: cleanups };
    var mine = current;
    Promise.all(anims.map(function (a) { return a.finished; })).then(function () {
      if (current === mine) finishCurrent();
    }, function () { /* przerwane przez kolejne przejście */ });
  }

  window.BBMotion = { run: run };
})();
