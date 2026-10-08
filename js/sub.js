/* DJ Błażej Biurkowski | podstrony oferty (eventy/, studniowki/, wedding/)
   1) odsłanianie elementów [data-reveal] przy przewijaniu,
   2) własne portfolio podstrony: filtr, „Pokaż więcej zdjęć”, powiększenie zdjęcia (okno <dialog>, strzałki i Escape).
   Reszta podstrony to czysty HTML i CSS. */
(function () {
  'use strict';

  /* ---------- odsłanianie ---------- */
  var els = document.querySelectorAll('[data-reveal]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) {
    Array.prototype.forEach.call(els, function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  /* ---------- znaczniki list „Co obejmuje oferta” ----------
     Kolumna dostaje in-view, gdy jest widoczna na ekranie, i out-view po jej opuszczeniu (po wejściu romby się obracają i pojawiają,
     po wyjściu obracają się dalej i znikają). Powtarza się przy każdym wejściu. */
  var cols = document.querySelectorAll('.sub-inc__col');
  if (cols.length && 'IntersectionObserver' in window) {
    var mio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var el = e.target;
        if (e.isIntersecting) { el.classList.remove('out-view'); el.classList.add('in-view'); }
        else if (el.classList.contains('in-view')) { el.classList.remove('in-view'); el.classList.add('out-view'); }
      });
    }, { threshold: 0.25 });
    Array.prototype.forEach.call(cols, function (col) { mio.observe(col); });
  }

  /* pozycje listy zawinięte do kilku wierszy: szerokość = najdłuższy wiersz, żeby romby stały przy tekście, a nie przy brzegach ekranu */
  var checks = document.querySelectorAll('.sub-inc .sub-check li');
  function hugLines() {
    Array.prototype.forEach.call(checks, function (li) {
      li.style.width = '';
      var range = document.createRange();
      range.selectNodeContents(li);
      var rects = range.getClientRects(), tops = {}, lines = 0, widest = 0, i;
      for (i = 0; i < rects.length; i++) {
        var key = Math.round(rects[i].top);
        if (!tops[key]) { tops[key] = 1; lines++; }
        widest = Math.max(widest, rects[i].width);
      }
      if (lines > 1) li.style.width = Math.ceil(widest) + 2 + 'px';
    });
  }
  if (checks.length) {
    var hugTimer;
    hugLines();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(hugLines);
    window.addEventListener('resize', function () { clearTimeout(hugTimer); hugTimer = setTimeout(hugLines, 120); });
  }

  /* ---------- portfolio podstrony ---------- */
  var section = document.querySelector('[data-portfolio]');
  if (!section) return;
  var items = Array.prototype.slice.call(section.querySelectorAll('.sub-gallery__item'));
  var moreBtn = section.querySelector('[data-more]');
  var filterBtns = Array.prototype.slice.call(section.querySelectorAll('[data-filter]'));
  var PAGE = 12;          // tyle zdjęć widać na start i przybywa po każdym kliknięciu
  var shown = PAGE;
  var filter = 'all';

  function matching() {
    return items.filter(function (li) {
      return filter === 'all' || (' ' + li.getAttribute('data-cat') + ' ').indexOf(' ' + filter + ' ') !== -1;
    });
  }
  function render() {
    var list = matching();
    items.forEach(function (li) { li.hidden = true; });
    list.forEach(function (li, i) { li.hidden = i >= shown; });
    if (moreBtn) moreBtn.hidden = list.length <= shown;
  }
  filterBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      filter = b.getAttribute('data-filter');
      shown = PAGE;
      filterBtns.forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      render();
    });
  });
  if (moreBtn) moreBtn.addEventListener('click', function () { shown += PAGE; render(); });
  render();

  /* ---------- powiększenie zdjęcia ---------- */
  if (typeof HTMLDialogElement === 'undefined') return;   // bez <dialog> zdjęcia otwierają się jak zwykłe linki
  var dlg = document.createElement('dialog');
  dlg.className = 'sub-lb';
  dlg.setAttribute('aria-label', 'Powiększone zdjęcie');
  dlg.innerHTML = '<button type="button" class="sub-lb__x" aria-label="Zamknij">&times;</button>' +
    '<button type="button" class="sub-lb__nav sub-lb__nav--prev" aria-label="Poprzednie zdjęcie">&#8249;</button>' +
    '<figure class="sub-lb__fig"><img alt=""></figure>' +
    '<button type="button" class="sub-lb__nav sub-lb__nav--next" aria-label="Następne zdjęcie">&#8250;</button>';
  document.body.appendChild(dlg);
  var img = dlg.querySelector('img');
  var cur = 0;
  var visible = [];
  function open(i) {
    visible = matching().filter(function (li) { return !li.hidden; });
    cur = (i + visible.length) % visible.length;
    var a = visible[cur].querySelector('a');
    img.src = a.getAttribute('href');
    img.alt = a.querySelector('img').alt;
    if (!dlg.open) dlg.showModal();
  }
  section.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-lb]');
    if (!a) return;
    e.preventDefault();
    visible = matching().filter(function (li) { return !li.hidden; });
    open(visible.indexOf(a.parentNode));
  });
  dlg.querySelector('.sub-lb__x').addEventListener('click', function () { dlg.close(); });
  dlg.querySelector('.sub-lb__nav--prev').addEventListener('click', function () { open(cur - 1); });
  dlg.querySelector('.sub-lb__nav--next').addEventListener('click', function () { open(cur + 1); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') open(cur - 1);
    if (e.key === 'ArrowRight') open(cur + 1);
  });
})();
