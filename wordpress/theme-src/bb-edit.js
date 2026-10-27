/*
 * Edytor tekstów, zdjęć i linków na stronie (tylko dla zalogowanych z prawem edycji stron; wczytywany przez inc/editor.php).
 *
 * Przycisk „Edytuj” włącza tryb edycji:
 *  - tekst (element z data-bb): kliknij i pisz; Ctrl+B pogrubia, Ctrl+I robi kursywę, Enter wstawia nową linię,
 *  - zdjęcie (data-bb-img): kliknij zdjęcie, wybierz nowe (z komputera albo z biblioteki mediów) i opisz je,
 *  - link (data-bb-link): kliknij ikonę lub przycisk z linkiem albo Alt+klik w link z tekstem, wpisz nowy adres,
 *  - przyciski „Zdjęcia” i „Linki” pokazują listy wszystkich zdjęć i linków strony (także tych, w które trudno kliknąć, np. tło nagłówka),
 *  - przycisk „Galeria” (albo klik w kafelek galerii) otwiera okno portfolio: przeciąganie zmienia kolejność, można dodawać zdjęcia
 *    (z komputera lub z biblioteki mediów), ustawiać im kategorie i opis, podmieniać je i usuwać.
 * Zapis: REST POST /wp-json/djblazej/v1/texts | images | links | gallery. Elementy o tej samej treści (ten sam klucz) zmieniają się razem.
 */
(function () {
  'use strict';

  var cfg = window.BB_EDIT;
  if (!cfg) return;

  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var nodes = qa('[data-bb]');
  var imgNodes = qa('[data-bb-img]');
  var linkNodes = qa('[data-bb-link]');
  var gal = window.BB_GALLERY || null;   // dane galerii tej strony (wypisuje je gallery.php)
  if (!nodes.length && !imgNodes.length && !linkNodes.length && !gal) return;

  var editing = false;
  var lastEl = null;
  var dirty = {};          // klucz tekstu -> true, gdy tekst został zmieniony od ostatniego zapisu
  var busy = false;
  var modalEl = null;
  var subEl = null;        // drugie okno nad pierwszym (edycja kafelka galerii, dodawanie zdjęć)
  var pickEl = null;       // okno wyboru zdjęcia z biblioteki (poza WordPressem), nad pozostałymi
  var modalGuard = null;   // funkcja pytająca o zamknięcie okna z niezapisanymi zmianami
  var modalCleanup = null; // sprzątanie po oknie (np. nasłuchiwanie przeciągania)

  /* ---------- pomocnicze ---------- */

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k === 'class') el.className = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }

  function api(url, body) {
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      if (!res.ok) throw new Error((res.j && res.j.message) || 'Nie udało się zapisać.');
      return res.j;
    });
  }

  function uniqueKeys(list, attr) {
    var seen = {}, out = [];
    list.forEach(function (el) {
      var k = el.getAttribute(attr);
      if (k && !seen[k]) { seen[k] = true; out.push(k); }
    });
    return out;
  }

  /* ---------- czyszczenie kodu z contenteditable do dozwolonego HTML ---------- */

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/ /g, '&nbsp;');
  }

  function walk(node, parts) {
    for (var n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) {
        parts.push(escapeHtml(n.nodeValue));
      } else if (n.nodeType === 1) {
        var tag = n.tagName.toLowerCase();
        var inner = [];
        walk(n, inner);
        var html = inner.join('');
        if (tag === 'br') parts.push('<br>');
        else if (tag === 'strong' || tag === 'b') parts.push('<strong>' + html + '</strong>');
        else if (tag === 'em' || tag === 'i') parts.push('<em>' + html + '</em>');
        else if (tag === 'span' && n.className && /^[\w -]+$/.test(n.className)) parts.push('<span class="' + n.className + '">' + html + '</span>');
        else if (tag === 'div' || tag === 'p') parts.push(html + (n.nextSibling ? '<br>' : ''));
        else parts.push(html);
      }
    }
  }

  function cleanHtml(el) {
    var parts = [];
    walk(el, parts);
    return parts.join('')
      .replace(/^(\s|<br>)+|(\s|<br>)+$/g, '')
      .replace(/\s+/g, ' ');
  }

  /* ---------- pasek narzędzi ---------- */

  var bar = document.createElement('div');
  bar.className = 'bb-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Edycja strony');
  bar.innerHTML =
    '<button type="button" class="bb-btn bb-toggle">Edytuj teksty, zdjęcia i linki</button>' +
    '<span class="bb-tools" hidden>' +
    '<button type="button" class="bb-btn bb-save" disabled>Zapisz zmiany</button>' +
    '<button type="button" class="bb-btn bb-reset" title="Przywraca oryginalny tekst z projektu dla ostatnio klikniętego pola">Przywróć oryginał tekstu</button>' +
    '<button type="button" class="bb-btn bb-gal" hidden title="Kolejność, dodawanie i usuwanie zdjęć w portfolio">Galeria</button>' +
    '<button type="button" class="bb-btn bb-imgs">Zdjęcia</button>' +
    '<button type="button" class="bb-btn bb-links">Linki</button>' +
    '<button type="button" class="bb-btn bb-end">Zakończ</button>' +
    '</span>' +
    '<span class="bb-msg" role="status" aria-live="polite"></span>';
  document.body.appendChild(bar);

  if (cfg.logout) {
    bar.insertBefore(h('a', { 'class': 'bb-btn bb-logout', href: cfg.logout, text: 'Wyloguj' }), bar.querySelector('.bb-msg'));
  }

  var elToggle = bar.querySelector('.bb-toggle');
  var elTools = bar.querySelector('.bb-tools');
  var elSave = bar.querySelector('.bb-save');
  var elReset = bar.querySelector('.bb-reset');
  var elGal = bar.querySelector('.bb-gal');
  var elImgs = bar.querySelector('.bb-imgs');
  var elLinks = bar.querySelector('.bb-links');
  var elEnd = bar.querySelector('.bb-end');
  var elMsg = bar.querySelector('.bb-msg');

  function say(text, kind) {
    elMsg.textContent = text || '';
    elMsg.className = 'bb-msg' + (kind ? ' bb-msg--' + kind : '');
  }

  function refreshSave() {
    var n = Object.keys(dirty).length;
    elSave.disabled = busy || n === 0;
    elSave.textContent = n ? 'Zapisz zmiany (' + n + ')' : 'Zapisz zmiany';
  }

  /* ---------- okno dialogowe ---------- */

  // force = true zamyka bez pytania o niezapisane zmiany (np. przy otwieraniu innego okna)
  function closeModal(force) {
    if (!force && modalGuard && !modalGuard()) return;
    closePick();
    closeSub();
    if (modalCleanup) {
      var cleanup = modalCleanup;
      modalCleanup = null;
      cleanup();
    }
    modalGuard = null;
    if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
    modalEl = null;
  }

  function closeSub() {
    if (subEl && subEl.parentNode) subEl.parentNode.removeChild(subEl);
    subEl = null;
  }

  function onEscape() {
    if (pickEl) closePick();
    else if (subEl) closeSub();
    else if (modalEl && modalEl.style.display !== 'none') closeModal();
  }

  // Klawisze w oknie dialogowym nie docierają do skryptów strony (menu, powiększanie zdjęć), a Esc zamyka okno.
  function shield(el) {
    ['keydown', 'keyup', 'keypress'].forEach(function (type) {
      el.addEventListener(type, function (e) {
        if (type === 'keydown' && e.key === 'Escape') onEscape();
        e.stopPropagation();
      });
    });
  }

  function buildBox(title, bodyEls, wide, extraClass, close) {
    var box = h('div', { 'class': 'bb-modal__box' + (wide ? ' bb-modal__box--wide' : '') + (extraClass ? ' ' + extraClass : ''), role: 'dialog', 'aria-label': title }, [
      h('div', { 'class': 'bb-modal__head' }, [
        h('strong', { text: title }),
        h('button', { type: 'button', 'class': 'bb-modal__x', 'aria-label': 'Zamknij', text: '×' })
      ])
    ].concat(bodyEls));
    box.querySelector('.bb-modal__x').addEventListener('click', function () { close(); });
    return box;
  }

  function openModal(title, bodyEls, wide, extraClass) {
    closeModal(true);
    var box = buildBox(title, bodyEls, wide, extraClass, closeModal);
    modalEl = h('div', { 'class': 'bb-modal' }, [box]);
    modalEl.addEventListener('mousedown', function (e) { if (e.target === modalEl) closeModal(); });
    shield(modalEl);
    document.body.appendChild(modalEl);
    return box;
  }

  // Drugie okno, nad pierwszym (pierwsze zostaje otwarte pod spodem).
  function openSub(title, bodyEls) {
    closeSub();
    var box = buildBox(title, bodyEls, false, '', closeSub);
    subEl = h('div', { 'class': 'bb-modal bb-modal--sub' }, [box]);
    subEl.addEventListener('mousedown', function (e) { if (e.target === subEl) closeSub(); });
    shield(subEl);
    document.body.appendChild(subEl);
    return box;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') onEscape();
  });

  function button(label, cls, onclick) {
    var b = h('button', { type: 'button', 'class': 'bb-btn ' + (cls || ''), text: label });
    b.addEventListener('click', onclick);
    return b;
  }

  /* ---------- zdjęcia ---------- */

  function imgEl(key) { return document.querySelector('[data-bb-img="' + key + '"]'); }

  function applyImage(key, s) {
    qa('[data-bb-img="' + key + '"]').forEach(function (img) {
      img.removeAttribute('srcset');
      img.src = s.src;
      img.alt = s.alt || '';
      var host = img.closest('[data-lb]');
      if (host) {
        if (host.tagName === 'A') host.setAttribute('href', s.full || s.src);
        else host.setAttribute('data-src', s.full || s.src);
      }
    });
  }

  function uploadFile(file) {
    var name = (file.name || 'zdjecie.jpg').replace(/[^\w.\-]+/g, '_');
    return fetch(cfg.restMedia, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-WP-Nonce': cfg.nonce, 'Content-Disposition': 'attachment; filename="' + name + '"', 'Content-Type': file.type || 'image/jpeg' },
      body: file
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      if (!res.ok) throw new Error((res.j && res.j.message) || 'Nie udało się wgrać zdjęcia.');
      return res.j;
    });
  }

  function openImage(key) {
    var el = imgEl(key);
    if (!el) return;
    var pending = { id: null };
    var altTouched = false;

    var prev = h('img', { 'class': 'bb-prev', src: el.currentSrc || el.src, alt: '' });
    var alt = h('input', { type: 'text', 'class': 'bb-input', value: el.getAttribute('alt') || '', placeholder: 'Krótki opis zdjęcia' });
    alt.addEventListener('input', function () { altTouched = true; });
    var note = h('p', { 'class': 'bb-note', text: 'Wybierz zdjęcie z komputera lub z biblioteki mediów. Zdjęcie zostanie dopasowane do miejsca na stronie.' });
    var status = h('p', { 'class': 'bb-note bb-note--status' });

    var actions = [];
    var file = h('input', { type: 'file', accept: 'image/*', hidden: 'hidden' });
    file.addEventListener('change', function () {
      if (!file.files || !file.files[0]) return;
      status.textContent = 'Wgrywanie…';
      uploadFile(file.files[0]).then(function (m) {
        pending.id = m.id;
        prev.src = m.source_url;
        status.textContent = 'Zdjęcie wgrane. Kliknij „Zapisz”, żeby użyć go na stronie.';
      }).catch(function (err) { status.textContent = err.message; });
    });
    if (cfg.canUpload) {
      actions.push(button('Wgraj z komputera', '', function () { file.click(); }));
      if (hasLibrary()) {
        actions.push(button('Wybierz z biblioteki mediów', '', function () {
          pickFromLibrary(false, 'Wybierz zdjęcie', 'Użyj tego zdjęcia', function (sel) {
            var a = sel[0];
            if (!a) return;
            pending.id = a.id;
            prev.src = (a.sizes && a.sizes.large && a.sizes.large.url) || a.url;
            if (!altTouched && a.alt) alt.value = a.alt;
            status.textContent = 'Wybrano zdjęcie. Kliknij „Zapisz”, żeby użyć go na stronie.';
          });
        }));
      }
    } else {
      note.textContent = 'To konto nie ma prawa wgrywania plików, ale można zmienić opis zdjęcia.';
    }

    var save = button('Zapisz', 'bb-primary', function () {
      var item = {};
      if (pending.id) item.id = pending.id;
      if (altTouched || pending.id) item.alt = alt.value;
      if (!Object.keys(item).length) { closeModal(); return; }
      var items = {};
      items[key] = item;
      status.textContent = 'Zapisywanie…';
      api(cfg.restImages, { items: items }).then(function (j) {
        if (j.saved && j.saved[key]) applyImage(key, j.saved[key]);
        closeModal();
        say('Zdjęcie zapisane.', 'ok');
      }).catch(function (err) { status.textContent = err.message; });
    });
    var reset = button('Przywróć oryginał', '', function () {
      if (!window.confirm('Przywrócić oryginalne zdjęcie z projektu?')) return;
      var items = {};
      items[key] = null;
      api(cfg.restImages, { items: items }).then(function (j) {
        if (j.saved && j.saved[key]) applyImage(key, j.saved[key]);
        closeModal();
        say('Przywrócono oryginalne zdjęcie.', 'ok');
      }).catch(function (err) { status.textContent = err.message; });
    });
    var cancel = button('Anuluj', '', closeModal);

    openModal('Zdjęcie', [
      h('div', { 'class': 'bb-prevwrap' }, [prev]),
      note,
      h('div', { 'class': 'bb-row' }, actions.concat([file])),
      h('label', { 'class': 'bb-label' }, [h('span', { text: 'Opis zdjęcia (dla osób niewidomych i wyszukiwarek)' }), alt]),
      status,
      h('div', { 'class': 'bb-row bb-row--end' }, [reset, cancel, save])
    ]);
  }

  /* ---------- linki ---------- */

  function linkLabel(el) {
    var t = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
    return t || 'Link';
  }

  function openLink(key) {
    var els = qa('[data-bb-link="' + key + '"]');
    if (!els.length) return;
    var input = h('input', { type: 'text', 'class': 'bb-input', value: els[0].getAttribute('href') || '' });
    var status = h('p', { 'class': 'bb-note bb-note--status' });

    function send(value, doneMsg) {
      var items = {};
      items[key] = value;
      status.textContent = 'Zapisywanie…';
      api(cfg.restLinks, { items: items }).then(function (j) {
        var url = j.saved && j.saved[key];
        if (url) els.forEach(function (a) { a.setAttribute('href', url); });
        closeModal();
        say(doneMsg, 'ok');
      }).catch(function (err) { status.textContent = err.message; });
    }

    var save = button('Zapisz', 'bb-primary', function () {
      var v = input.value.trim();
      if (!v) { status.textContent = 'Wpisz adres.'; return; }
      send(v, 'Link zapisany.');
    });
    var reset = button('Przywróć oryginał', '', function () {
      if (window.confirm('Przywrócić oryginalny adres linku z projektu?')) send(null, 'Przywrócono oryginalny adres.');
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save.click(); } });

    openModal('Link: ' + linkLabel(els[0]), [
      h('p', { 'class': 'bb-note', text: 'Adres strony (https://...), e-mail (nazwa@domena.pl lub mailto:nazwa@domena.pl?subject=Temat), telefon (tel:+48123456789) albo adres podstrony tego serwisu (/eventy/). Zmiana dotyczy wszystkich takich samych linków na stronie.' }),
      h('label', { 'class': 'bb-label' }, [h('span', { text: 'Adres' }), input]),
      status,
      h('div', { 'class': 'bb-row bb-row--end' }, [reset, button('Anuluj', '', closeModal), save])
    ]);
    input.focus();
    input.select();
  }

  /* ---------- listy zdjęć i linków strony ---------- */

  function openImageList() {
    var keys = uniqueKeys(imgNodes, 'data-bb-img');
    var grid = h('div', { 'class': 'bb-grid' });
    keys.forEach(function (key) {
      var el = imgEl(key);
      var im = h('img', { src: el.currentSrc || el.src, alt: '', loading: 'lazy' });
      var cell = h('button', { type: 'button', 'class': 'bb-cell', title: el.getAttribute('alt') || '' }, [im]);
      cell.addEventListener('click', function () { openImage(key); });
      grid.appendChild(cell);
    });
    openModal('Zdjęcia na tej stronie (' + keys.length + ')', [
      h('p', { 'class': 'bb-note', text: 'Kliknij zdjęcie, które chcesz zmienić.' }),
      grid
    ], true);
  }

  function openLinkList() {
    var keys = uniqueKeys(linkNodes, 'data-bb-link');
    var list = h('div', { 'class': 'bb-list' });
    keys.forEach(function (key) {
      var el = document.querySelector('[data-bb-link="' + key + '"]');
      var row = h('button', { type: 'button', 'class': 'bb-rowbtn' }, [
        h('strong', { text: linkLabel(el) }),
        h('span', { text: el.getAttribute('href') || '' })
      ]);
      row.addEventListener('click', function () { openLink(key); });
      list.appendChild(row);
    });
    openModal('Linki na tej stronie (' + keys.length + ')', [
      h('p', { 'class': 'bb-note', text: 'Kliknij link, którego adres chcesz zmienić.' }),
      list
    ], true);
  }

  elImgs.addEventListener('click', openImageList);
  elLinks.addEventListener('click', openLinkList);

  /* ---------- galeria portfolio: kolejność, dodawanie, usuwanie, kategorie ---------- */

  function rnd() { return Math.random().toString(36).slice(2, 10); }

  // 1 zdjęcie, 2-4 zdjęcia, 5+ zdjęć
  function plural(n) {
    var last = n % 10, tens = n % 100;
    if (n === 1) return 'zdjęcie';
    return (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) ? 'zdjęcia' : 'zdjęć';
  }

  // miniatura zdjęcia po wgraniu przez REST (odpowiedź wp/v2/media)
  function mediaPreview(m) {
    var s = m && m.media_details && m.media_details.sizes;
    var pick = s && (s.medium_large || s.medium || s.large || s.thumbnail);
    return (pick && pick.source_url) || (m && m.source_url) || '';
  }
  // miniatura zdjęcia wybranego w bibliotece mediów (wp.media)
  function libPreview(a) {
    var s = a.sizes || {};
    var pick = s.medium_large || s.medium || s.large || s.thumbnail;
    return (pick && pick.url) || a.url || '';
  }

  // Biblioteka zdjęć: w WordPressie jego okno (wp.media), na zwykłym hostingu własna lista wgranych zdjęć (cfg.restMediaList).
  function hasLibrary() {
    return !!((window.wp && window.wp.media) || cfg.restMediaList);
  }

  // Wybrane zdjęcia przekazujemy w postaci jak z wp.media: { id, alt, url, sizes: { large: { url } } }.
  function pickFromLibrary(multiple, titleText, buttonText, onPick) {
    if (!(window.wp && window.wp.media)) { openLibraryPicker(multiple, titleText, buttonText, onPick); return; }
    var frame = window.wp.media({ title: titleText, library: { type: 'image' }, button: { text: buttonText }, multiple: multiple });
    var hide = [modalEl, subEl].filter(Boolean);   // okno WordPressa leży nad naszymi, więc nasze chowamy na czas wyboru
    hide.forEach(function (el) { el.style.display = 'none'; });
    frame.on('select', function () {
      onPick(frame.state().get('selection').toJSON());
    });
    frame.on('close', function () { hide.forEach(function (el) { el.style.display = ''; }); });
    frame.open();
  }

  function closePick() {
    if (pickEl && pickEl.parentNode) pickEl.parentNode.removeChild(pickEl);
    pickEl = null;
  }

  // Własna lista wgranych wcześniej zdjęć (poza WordPressem): klik zaznacza, „Użyj” zatwierdza.
  function openLibraryPicker(multiple, titleText, buttonText, onPick) {
    var picked = [];
    var grid = h('div', { 'class': 'bb-grid' }, [h('p', { 'class': 'bb-note', text: 'Wczytywanie…' })]);
    var useBtn = button(buttonText, 'bb-primary', function () {
      if (!picked.length) return;
      var list = picked.slice();
      closePick();
      onPick(list);
    });
    useBtn.disabled = true;
    function refresh() {
      useBtn.disabled = !picked.length;
      useBtn.textContent = picked.length > 1 ? buttonText + ' (' + picked.length + ')' : buttonText;
    }
    var box = buildBox(titleText, [
      h('p', { 'class': 'bb-note', text: multiple ? 'Kliknij zdjęcia, które chcesz wybrać (można kilka).' : 'Kliknij zdjęcie, które chcesz wybrać.' }),
      h('div', { 'class': 'bb-pickscroll' }, [grid]),
      h('div', { 'class': 'bb-row bb-row--end' }, [button('Anuluj', '', closePick), useBtn])
    ], true, '', closePick);
    closePick();
    pickEl = h('div', { 'class': 'bb-modal bb-modal--pick' }, [box]);
    pickEl.addEventListener('mousedown', function (e) { if (e.target === pickEl) closePick(); });
    shield(pickEl);
    document.body.appendChild(pickEl);

    fetch(cfg.restMediaList, { credentials: 'same-origin', headers: { 'X-WP-Nonce': cfg.nonce } })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j && j.message) || 'Nie udało się wczytać zdjęć.'); return j; }); })
      .then(function (list) {
        grid.innerHTML = '';
        if (!list.length) { grid.appendChild(h('p', { 'class': 'bb-note', text: 'Nie ma jeszcze wgranych zdjęć. Wgraj zdjęcie z komputera.' })); return; }
        list.forEach(function (m) {
          var sizes = (m.media_details && m.media_details.sizes) || {};
          var item = {
            id: m.id,
            alt: m.alt_text || '',
            url: m.source_url,
            sizes: {
              large: { url: (sizes.large && sizes.large.source_url) || m.source_url },
              medium: { url: (sizes.medium && sizes.medium.source_url) || m.source_url }
            }
          };
          var cell = h('button', { type: 'button', 'class': 'bb-cell', title: item.alt }, [h('img', { src: item.sizes.medium.url, alt: '', loading: 'lazy' })]);
          cell.addEventListener('click', function () {
            var at = picked.indexOf(item);
            if (!multiple) {
              Array.prototype.forEach.call(grid.querySelectorAll('.bb-cell.is-picked'), function (c) { c.classList.remove('is-picked'); });
              picked = [];
              at = -1;
            }
            if (at > -1) { picked.splice(at, 1); cell.classList.remove('is-picked'); }
            else { picked.push(item); cell.classList.add('is-picked'); }
            refresh();
          });
          grid.appendChild(cell);
        });
      })
      .catch(function (err) { grid.innerHTML = ''; grid.appendChild(h('p', { 'class': 'bb-note', text: err.message })); });
  }

  function openGallery(selectId) {
    if (!gal) return;
    var st = {
      items: JSON.parse(JSON.stringify(gal.items)),
      removed: JSON.parse(JSON.stringify(gal.removed)),
      filter: 'all',
      changed: false,
      saving: false
    };
    var catLabel = {};
    gal.cats.forEach(function (c) { catLabel[c.slug] = c.label; });

    function indexOf(id) {
      for (var i = 0; i < st.items.length; i++) if (st.items[i].id === id) return i;
      return -1;
    }
    function matches(it) {
      if (st.filter === 'all') return true;
      if (st.filter === '_none') return !it.cats.length;
      return it.cats.indexOf(st.filter) > -1;
    }

    /* --- elementy okna --- */
    var grid = h('div', { 'class': 'bb-ggrid' });
    var indicator = h('div', { 'class': 'bb-gdrop' });
    grid.appendChild(indicator);
    var scroller = h('div', { 'class': 'bb-gscroll' }, [grid]);
    var count = h('span', { 'class': 'bb-gcount' });
    var status = h('p', { 'class': 'bb-note bb-note--status' });

    var filterSel = h('select', { 'class': 'bb-input bb-gfilter', 'aria-label': 'Pokaż kategorię' });
    [['all', 'Wszystkie zdjęcia']].concat(gal.cats.map(function (c) { return [c.slug, c.label]; })).concat([['_none', 'Bez kategorii']]).forEach(function (o) {
      filterSel.appendChild(h('option', { value: o[0], text: o[1] }));
    });
    filterSel.addEventListener('change', function () { st.filter = filterSel.value; render(); scroller.scrollTop = 0; });

    var btnAdd = button('Dodaj zdjęcia', 'bb-primary', function () { openAdd(); });
    if (!cfg.canUpload) btnAdd.hidden = true;
    var btnRemoved = button('Usunięte (0)', '', function () { openRemoved(); });
    var btnReset = button('Przywróć oryginalną galerię', '', function () {
      if (!window.confirm('Przywrócić galerię z projektu? Wszystkie Twoje zmiany w kolejności, kategoriach i dodane zdjęcia zostaną usunięte z tej galerii (zdjęcia w bibliotece mediów zostają).')) return;
      status.textContent = 'Przywracanie…';
      api(gal.rest, { gallery: gal.gallery, reset: true }).then(reloadAfterGallery).catch(function (err) { status.textContent = err.message; });
    });
    var btnCancel = button('Anuluj', '', function () { closeModal(); });
    var btnSave = button('Zapisz galerię', 'bb-primary', function () { save(); });
    btnSave.disabled = true;

    /* --- siatka kafelków --- */
    function tileEl(it, idx) {
      var first = it.cats[0];
      return h('div', {
        'class': 'bb-gtile' + (it.custom ? ' is-new' : ''),
        'data-id': it.id, tabindex: '0', role: 'button',
        'aria-label': 'Zdjęcie ' + (idx + 1) + (it.alt ? ': ' + it.alt : '') + '. Enter otwiera ustawienia, Alt i strzałki przesuwają.'
      }, [
        h('img', { src: it.src, alt: '', loading: 'lazy', draggable: 'false' }),
        h('span', { 'class': 'bb-gtile__n', text: String(idx + 1) }),
        it.custom ? h('span', { 'class': 'bb-gtile__new', text: 'nowe' }) : null,
        h('span', { 'class': 'bb-gtile__grip', 'aria-hidden': 'true', title: 'Przeciągnij', text: '⠿' }),
        first && catLabel[first] ? h('span', { 'class': 'bb-gtile__c', text: catLabel[first] }) : null
      ]);
    }

    function render(focusId) {
      Array.prototype.slice.call(grid.querySelectorAll('.bb-gtile')).forEach(function (t) { grid.removeChild(t); });
      var shown = 0;
      st.items.forEach(function (it, i) {
        if (!matches(it)) return;
        grid.appendChild(tileEl(it, i));
        shown++;
      });
      count.textContent = st.items.length + ' ' + plural(st.items.length) + (shown !== st.items.length ? ' (pokazano ' + shown + ')' : '');
      btnRemoved.textContent = 'Usunięte (' + st.removed.length + ')';
      btnRemoved.disabled = !st.removed.length;
      btnSave.disabled = !st.changed || st.saving;
      if (focusId) {
        var t = grid.querySelector('.bb-gtile[data-id="' + focusId + '"]');
        if (t) { t.focus({ preventScroll: true }); t.scrollIntoView({ block: 'nearest' }); }
      }
    }

    // Przenosi zdjęcie przed (before = true) albo za zdjęcie ref w pełnej kolejności galerii.
    function placeRelative(id, refId, before) {
      var from = indexOf(id);
      if (from < 0 || id === refId) return;
      var it = st.items.splice(from, 1)[0];
      var to = indexOf(refId);
      if (to < 0) { st.items.splice(from, 0, it); return; }
      st.items.splice(before ? to : to + 1, 0, it);
      st.changed = true;
    }

    /* --- przeciąganie (mysz, dotyk, pióro): zielony znacznik pokazuje, gdzie zdjęcie wyląduje --- */
    var drag = null;
    var suppressClick = false;

    function showIndicator() {
      if (!drag || !drag.ref) { indicator.style.display = 'none'; return; }
      var r = drag.ref;
      indicator.style.display = 'block';
      indicator.style.left = (drag.before ? r.offsetLeft - 4 : r.offsetLeft + r.offsetWidth) + 'px';
      indicator.style.top = r.offsetTop + 'px';
      indicator.style.height = r.offsetHeight + 'px';
    }

    function updateDrop(x, y) {
      var under = document.elementFromPoint(x, y);
      var tgt = under && under.closest ? under.closest('.bb-gtile') : null;
      if (tgt && tgt.parentNode === grid && tgt !== drag.tile) {
        var r = tgt.getBoundingClientRect();
        drag.ref = tgt;
        drag.before = x < r.left + r.width / 2;
      } else if (tgt === drag.tile) {
        drag.ref = null;                       // nad własnym miejscem: bez przenoszenia
      } else if (!tgt) {
        var tiles = grid.querySelectorAll('.bb-gtile');
        if (tiles.length) {
          var last = tiles[tiles.length - 1];
          var lr = last.getBoundingClientRect();
          if (y > lr.bottom || (y > lr.top && x > lr.right)) { drag.ref = last; drag.before = false; }
        }
      }
      showIndicator();
    }

    function autoScroll() {
      if (!drag || !drag.active) return;
      var r = scroller.getBoundingClientRect();
      var edge = 56, speed = 0;
      if (drag.y < r.top + edge) speed = -Math.ceil((r.top + edge - drag.y) / 4);
      else if (drag.y > r.bottom - edge) speed = Math.ceil((drag.y - (r.bottom - edge)) / 4);
      if (speed) { scroller.scrollTop += speed; updateDrop(drag.x, drag.y); }
      drag.raf = requestAnimationFrame(autoScroll);
    }

    function startDrag() {
      var r = drag.tile.getBoundingClientRect();
      drag.active = true;
      drag.dx = drag.x0 - r.left;
      drag.dy = drag.y0 - r.top;
      var ghost = drag.tile.cloneNode(true);
      ghost.className = 'bb-gtile bb-gghost';
      ghost.removeAttribute('tabindex');
      ghost.style.width = r.width + 'px';
      ghost.style.height = r.height + 'px';
      modalEl.appendChild(ghost);
      drag.ghost = ghost;
      drag.tile.classList.add('is-drag');
      autoScroll();
    }

    function onPointerMove(e) {
      if (!drag || e.pointerId !== drag.pid) return;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (!drag.active) {
        if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 8) return;
        startDrag();
      }
      drag.ghost.style.transform = 'translate(' + (e.clientX - drag.dx) + 'px,' + (e.clientY - drag.dy) + 'px)';
      updateDrop(e.clientX, e.clientY);
    }

    function endDrag(apply) {
      if (!drag) return;
      var d = drag;
      drag = null;
      cancelAnimationFrame(d.raf);
      if (!d.active) return;
      if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
      d.tile.classList.remove('is-drag');
      indicator.style.display = 'none';
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 0);
      if (apply && d.ref && d.ref !== d.tile) {
        placeRelative(d.id, d.ref.getAttribute('data-id'), d.before);
        render(d.id);
      }
    }

    function onPointerUp(e) { if (drag && e.pointerId === drag.pid) endDrag(true); }
    function onPointerCancel(e) { if (drag && e.pointerId === drag.pid) endDrag(false); }

    grid.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var tile = e.target.closest ? e.target.closest('.bb-gtile') : null;
      if (!tile) return;
      // dotykiem przeciąga się za uchwyt (reszta kafelka przewija okno)
      if (e.pointerType !== 'mouse' && !(e.target.closest && e.target.closest('.bb-gtile__grip'))) return;
      drag = { tile: tile, id: tile.getAttribute('data-id'), pid: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, ref: null, before: true, raf: 0 };
    });
    grid.addEventListener('mousedown', function (e) {
      if (e.target.closest && e.target.closest('.bb-gtile')) e.preventDefault();   // bez zaznaczania tekstu i natywnego przeciągania obrazu
    });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    grid.addEventListener('click', function (e) {
      var tile = e.target.closest ? e.target.closest('.bb-gtile') : null;
      if (!tile || suppressClick) return;
      openItem(tile.getAttribute('data-id'));
    });

    // klawiatura: Enter otwiera ustawienia, Alt + strzałki przesuwają zdjęcie o jedno miejsce
    grid.addEventListener('keydown', function (e) {
      var tile = e.target.closest ? e.target.closest('.bb-gtile') : null;
      if (!tile) return;
      var id = tile.getAttribute('data-id');
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openItem(id);
      } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        var back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
        var sib = back ? tile.previousElementSibling : tile.nextElementSibling;
        while (sib && !sib.classList.contains('bb-gtile')) sib = back ? sib.previousElementSibling : sib.nextElementSibling;
        if (sib) {
          placeRelative(id, sib.getAttribute('data-id'), back);
          render(id);
        }
      }
    });

    /* --- ustawienia jednego zdjęcia --- */
    function catChecks(selected) {
      return gal.cats.map(function (c) {
        var cb = h('input', { type: 'checkbox', value: c.slug });
        cb.checked = selected.indexOf(c.slug) > -1;
        return { slug: c.slug, cb: cb, el: h('label', { 'class': 'bb-check' }, [cb, h('span', { text: c.label })]) };
      });
    }
    function checkedSlugs(checks) {
      return checks.filter(function (c) { return c.cb.checked; }).map(function (c) { return c.slug; });
    }

    function openItem(id) {
      var i = indexOf(id);
      if (i < 0) return;
      var it = st.items[i];
      var pending = { att: it.att, src: it.src, altTouched: false };
      var before = JSON.stringify([it.cats, it.alt, it.att, i]);

      var prev = h('img', { 'class': 'bb-prev', src: it.src, alt: '' });
      var alt = h('input', { type: 'text', 'class': 'bb-input', value: it.alt || '', placeholder: 'Krótki opis zdjęcia' });
      alt.addEventListener('input', function () { pending.altTouched = true; });
      var checks = catChecks(it.cats);
      var pos = h('input', { type: 'number', 'class': 'bb-input bb-input--num', min: '1', max: String(st.items.length), value: String(i + 1) });
      var itemStatus = h('p', { 'class': 'bb-note bb-note--status' });

      var photoBtns = [];
      var file = h('input', { type: 'file', accept: 'image/*', hidden: 'hidden' });
      function setPhoto(att, src, newAlt) {
        pending.att = att;
        pending.src = src;
        prev.src = src;
        if (!pending.altTouched && typeof newAlt === 'string') alt.value = newAlt;
      }
      file.addEventListener('change', function () {
        if (!file.files || !file.files[0]) return;
        itemStatus.textContent = 'Wgrywanie…';
        uploadFile(file.files[0]).then(function (m) {
          setPhoto(m.id, mediaPreview(m), m.alt_text || '');
          itemStatus.textContent = 'Zdjęcie wgrane. Kliknij „Gotowe”, żeby je zastosować.';
        }).catch(function (err) { itemStatus.textContent = err.message; });
      });
      if (cfg.canUpload) {
        photoBtns.push(button('Zmień zdjęcie: z komputera', '', function () { file.click(); }));
        if (hasLibrary()) {
          photoBtns.push(button('Zmień zdjęcie: z biblioteki', '', function () {
            pickFromLibrary(false, 'Wybierz zdjęcie', 'Użyj tego zdjęcia', function (sel) {
              var a = sel[0];
              if (!a) return;
              setPhoto(a.id, libPreview(a), a.alt || '');
              itemStatus.textContent = 'Wybrano zdjęcie. Kliknij „Gotowe”, żeby je zastosować.';
            });
          }));
        }
        if (!it.custom && it.att) {
          photoBtns.push(button('Przywróć oryginalne zdjęcie', '', function () {
            setPhoto(0, it.src0, null);
            itemStatus.textContent = 'Przywrócono oryginalne zdjęcie. Kliknij „Gotowe”, żeby zastosować.';
          }));
        }
      }

      function applyFields() {
        var chosen = checkedSlugs(checks);
        var kept = it.cats.filter(function (s) { return chosen.indexOf(s) > -1; });   // pierwsza kategoria zostaje pierwsza
        chosen.forEach(function (s) { if (kept.indexOf(s) < 0) kept.push(s); });
        it.cats = kept;
        it.alt = alt.value.trim();
        it.att = pending.att;
        it.src = pending.src;
      }
      function finish() {
        var now = JSON.stringify([it.cats, it.alt, it.att, indexOf(it.id)]);
        if (now !== before) st.changed = true;
        render(it.id);
        closeSub();
      }
      function done() {
        applyFields();
        var want = parseInt(pos.value, 10);
        var cur = indexOf(it.id);
        if (want >= 1 && want <= st.items.length && want - 1 !== cur) {
          st.items.splice(cur, 1);
          st.items.splice(want - 1, 0, it);
        }
        finish();
      }
      function moveTo(toStart) {
        applyFields();
        var cur = indexOf(it.id);
        st.items.splice(cur, 1);
        if (toStart) st.items.unshift(it); else st.items.push(it);
        finish();
      }
      function remove() {
        var cur = indexOf(it.id);
        st.items.splice(cur, 1);
        if (!it.custom) {
          it.att = 0;
          it.src = it.src0;
          st.removed.push(it);
        }
        st.changed = true;
        render();
        closeSub();
      }

      openSub('Zdjęcie ' + (i + 1) + ' z ' + st.items.length, [
        h('div', { 'class': 'bb-prevwrap' }, [prev]),
        h('div', { 'class': 'bb-row' }, photoBtns.concat([file])),
        h('div', { 'class': 'bb-label' }, [h('span', { text: 'Kategorie (według nich działają zakładki nad galerią; podpis pod zdjęciem pochodzi z pierwszej)' }), h('div', { 'class': 'bb-checks' }, checks.map(function (c) { return c.el; }))]),
        h('label', { 'class': 'bb-label' }, [h('span', { text: 'Opis zdjęcia (dla osób niewidomych i wyszukiwarek)' }), alt]),
        h('div', { 'class': 'bb-row bb-row--center' }, [
          h('label', { 'class': 'bb-inline' }, [h('span', { text: 'Pozycja w galerii' }), pos]),
          button('Na początek', '', function () { moveTo(true); }),
          button('Na koniec', '', function () { moveTo(false); })
        ]),
        itemStatus,
        h('div', { 'class': 'bb-row bb-row--between' }, [
          button('Usuń z galerii', 'bb-danger', remove),
          h('span', { 'class': 'bb-row' }, [button('Anuluj', '', closeSub), button('Gotowe', 'bb-primary', done)])
        ])
      ]);
    }

    /* --- dodawanie zdjęć --- */
    function openAdd() {
      var checks = catChecks([]);
      var start = h('input', { type: 'radio', name: 'bb-where', value: 'start' });
      start.checked = true;
      var end = h('input', { type: 'radio', name: 'bb-where', value: 'end' });
      var addStatus = h('p', { 'class': 'bb-note bb-note--status' });
      var file = h('input', { type: 'file', accept: 'image/*', multiple: 'multiple', hidden: 'hidden' });

      function addMany(list) {
        var cats = checkedSlugs(checks);
        var made = list.map(function (m) {
          return { id: 'u' + rnd(), custom: true, att: m.att, src: m.src, src0: m.src, alt: m.alt || '', cats: cats.slice() };
        });
        var atStart = start.checked;
        st.items = atStart ? made.concat(st.items) : st.items.concat(made);
        st.changed = true;
        closeSub();
        render(made[0] && made[0].id);
        scroller.scrollTop = atStart ? 0 : scroller.scrollHeight;
      }

      file.addEventListener('change', function () {
        var files = Array.prototype.slice.call(file.files || []);
        if (!files.length) return;
        var okList = [];
        var i = 0;
        (function next() {
          if (i >= files.length) { addMany(okList); return; }
          addStatus.textContent = 'Wgrywanie ' + (i + 1) + ' z ' + files.length + '…';
          uploadFile(files[i]).then(function (m) {
            okList.push({ att: m.id, src: mediaPreview(m), alt: m.alt_text || '' });
            i++;
            next();
          }).catch(function (err) {
            if (okList.length) {
              addMany(okList);
              say('Dodano ' + okList.length + ' z ' + files.length + ' zdjęć. Błąd: ' + err.message, 'error');
            } else {
              addStatus.textContent = err.message;
            }
          });
        })();
      });

      var actions = [button('Wgraj z komputera', 'bb-primary', function () { file.click(); })];
      if (hasLibrary()) {
        actions.push(button('Wybierz z biblioteki mediów', '', function () {
          pickFromLibrary(true, 'Wybierz zdjęcia do galerii', 'Dodaj do galerii', function (sel) {
            if (!sel.length) return;
            addMany(sel.map(function (a) { return { att: a.id, src: libPreview(a), alt: a.alt || '' }; }));
          });
        }));
      }

      openSub('Dodaj zdjęcia do galerii', [
        h('p', { 'class': 'bb-note', text: 'Zaznacz kategorie, które dostaną wszystkie dodawane teraz zdjęcia (potem każde zdjęcie można ustawić osobno). Zdjęcie bez kategorii widać tylko w zakładce „Wszystko”.' }),
        h('div', { 'class': 'bb-checks' }, checks.map(function (c) { return c.el; })),
        h('div', { 'class': 'bb-row' }, [
          h('label', { 'class': 'bb-check' }, [start, h('span', { text: 'Dodaj na początku' })]),
          h('label', { 'class': 'bb-check' }, [end, h('span', { text: 'Dodaj na końcu' })])
        ]),
        h('div', { 'class': 'bb-row' }, actions.concat([file])),
        addStatus,
        h('div', { 'class': 'bb-row bb-row--end' }, [button('Anuluj', '', closeSub)])
      ]);
    }

    /* --- usunięte zdjęcia z projektu --- */
    function openRemoved() {
      var list = h('div', { 'class': 'bb-grid' });
      st.removed.forEach(function (it) {
        var cell = h('button', { type: 'button', 'class': 'bb-cell', title: 'Przywróć: ' + (it.alt || '') }, [h('img', { src: it.src0 || it.src, alt: '', loading: 'lazy' })]);
        cell.addEventListener('click', function () {
          st.removed = st.removed.filter(function (x) { return x.id !== it.id; });
          st.items.push(it);
          st.changed = true;
          closeSub();
          render(it.id);
          scroller.scrollTop = scroller.scrollHeight;
        });
        list.appendChild(cell);
      });
      openSub('Usunięte zdjęcia (' + st.removed.length + ')', [
        h('p', { 'class': 'bb-note', text: 'Kliknij zdjęcie, żeby przywrócić je do galerii. Wróci na koniec galerii.' }),
        list
      ]);
    }

    /* --- zapis: po zapisie strona się odświeża, żeby pokazać nową kolejność --- */
    function reloadAfterGallery() {
      st.changed = false;
      modalGuard = null;
      try { window.sessionStorage.setItem('bb-reopen', '1'); } catch (err) { /* bez pamięci sesji tryb edycji trzeba włączyć ponownie */ }
      window.location.reload();
    }

    function save() {
      st.saving = true;
      btnSave.disabled = true;
      status.textContent = 'Zapisywanie…';
      var payload = st.items.map(function (it) {
        var o = it.custom ? { u: it.id } : { k: it.id };
        o.cats = it.cats;
        o.alt = it.alt;
        if (it.att) o.att = it.att;
        return o;
      });
      var texts = dirtyItems();
      var chain = Object.keys(texts).length ? api(cfg.rest, { items: texts }).then(function () { dirty = {}; }) : Promise.resolve();
      chain.then(function () {
        return api(gal.rest, { gallery: gal.gallery, items: payload });
      }).then(reloadAfterGallery).catch(function (err) {
        st.saving = false;
        btnSave.disabled = !st.changed;
        status.textContent = err.message || 'Nie udało się zapisać.';
      });
    }

    openModal('Galeria portfolio', [
      h('p', { 'class': 'bb-note', text: 'Przeciągnij zdjęcie na nowe miejsce (na telefonie za uchwyt ⠿) albo kliknij je, żeby zmienić kategorie, opis, zdjęcie lub je usunąć. Siatka na stronie dopasowuje kafelki do orientacji zdjęć, więc zdjęcie może stanąć o kilka miejsc obok.' }),
      h('div', { 'class': 'bb-gtools' }, [btnAdd, filterSel, btnRemoved, count]),
      scroller,
      status,
      h('div', { 'class': 'bb-row bb-row--between' }, [btnReset, h('span', { 'class': 'bb-row' }, [btnCancel, btnSave])])
    ], true, 'bb-modal__box--g');

    // Ustawiamy dopiero po openModal (ono zamyka poprzednie okno razem z jego sprzątaniem i pytaniem o zmiany).
    modalGuard = function () {
      return !st.changed || window.confirm('Masz niezapisane zmiany w galerii. Zamknąć okno bez zapisywania?');
    };
    modalCleanup = function () {
      endDrag(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
    render();
    if (selectId && indexOf(selectId) > -1) openItem(selectId);
  }

  elGal.addEventListener('click', function () { openGallery(); });

  /* ---------- tryb edycji tekstów ---------- */

  function startEditing() {
    editing = true;
    document.body.classList.add('bb-editing');
    nodes.forEach(function (el) {
      el.__bbOrig = cleanHtml(el);
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
    });
    elToggle.hidden = true;
    elTools.hidden = false;
    elGal.hidden = !gal;
    say('Kliknij tekst, zdjęcie lub link, który chcesz zmienić.');
    refreshSave();
  }

  function stopEditing(revert) {
    closeModal(true);
    nodes.forEach(function (el) {
      el.removeAttribute('contenteditable');
      el.removeAttribute('spellcheck');
      if (revert && el.__bbOrig !== undefined) el.innerHTML = el.__bbOrig;
    });
    editing = false;
    dirty = {};
    lastEl = null;
    document.body.classList.remove('bb-editing');
    elToggle.hidden = false;
    elTools.hidden = true;
    say('');
    refreshSave();
  }

  elToggle.addEventListener('click', startEditing);

  elEnd.addEventListener('click', function () {
    if (Object.keys(dirty).length && !window.confirm('Masz niezapisane zmiany tekstów. Zakończyć bez zapisywania?')) return;
    stopEditing(true);
  });

  /* ---------- zapis tekstów ---------- */

  function sendTexts(items, doneMessage) {
    busy = true;
    refreshSave();
    say('Zapisywanie…');
    return api(cfg.rest, { items: items })
      .then(function (j) {
        var saved = (j && j.saved) || {};
        nodes.forEach(function (el) {
          var key = el.getAttribute('data-bb');
          if (Object.prototype.hasOwnProperty.call(saved, key)) {
            el.innerHTML = saved[key];
            el.__bbOrig = cleanHtml(el);
          }
        });
        Object.keys(saved).forEach(function (k) { delete dirty[k]; });
        say(doneMessage, 'ok');
      })
      .catch(function (err) {
        say(err.message || 'Nie udało się zapisać.', 'error');
      })
      .then(function () {
        busy = false;
        refreshSave();
      });
  }

  // zmienione, jeszcze niezapisane teksty: { klucz: kod HTML }
  function dirtyItems() {
    var items = {};
    nodes.forEach(function (el) {
      var key = el.getAttribute('data-bb');
      if (dirty[key]) items[key] = cleanHtml(el);
    });
    return items;
  }

  elSave.addEventListener('click', function () {
    var items = dirtyItems();
    if (Object.keys(items).length) sendTexts(items, 'Zapisano.');
  });

  elReset.addEventListener('click', function () {
    if (!lastEl) { say('Najpierw kliknij tekst, który chcesz przywrócić.'); return; }
    if (!window.confirm('Przywrócić oryginalny tekst z projektu dla tego pola?')) return;
    var items = {};
    items[lastEl.getAttribute('data-bb')] = null;
    sendTexts(items, 'Przywrócono oryginał.');
  });

  /* ---------- zachowanie w trybie edycji ---------- */

  function editableOf(t) {
    if (!t) return null;
    var el = t.nodeType === 1 ? t : t.parentElement;
    return el && el.closest ? el.closest('[data-bb]') : null;
  }
  function closestOf(t, sel) {
    if (!t) return null;
    var el = t.nodeType === 1 ? t : t.parentElement;
    return el && el.closest ? el.closest(sel) : null;
  }

  // Zdarzenia w edytowanych elementach nie trafiają do skryptów strony (linki, karuzele, powiększanie zdjęć, skróty klawiszowe).
  ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'keyup', 'keypress'].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (!editing) return;
      var t = e.target;
      if (closestOf(t, '.bb-modal')) return;   // okno dialogowe obsługuje swoje zdarzenia samo (shield)
      if (closestOf(t, '.bb-bar')) return;

      var text = editableOf(t);
      var image = closestOf(t, '[data-bb-img]');
      var link = closestOf(t, '[data-bb-link]');
      var tile = closestOf(t, '[data-bb-item]');

      // Alt + klik w link z tekstem otwiera okno linku (zwykły klik edytuje tekst).
      if (type === 'click' && e.altKey && link) {
        e.preventDefault();
        e.stopPropagation();
        openLink(link.getAttribute('data-bb-link'));
        return;
      }

      // kafelek galerii: klik otwiera okno galerii z tym zdjęciem (powiększenie zdjęć jest w trybie edycji wyłączone)
      if (tile) {
        if (type === 'click') {
          e.preventDefault();
          openGallery(tile.getAttribute('data-bb-item'));
        }
        e.stopPropagation();
        return;
      }

      if (text) {
        if (type === 'click') e.preventDefault();
        if (type === 'keydown') {
          if (e.key === 'Enter') {
            e.preventDefault();
            document.execCommand('insertLineBreak');
          } else if (e.key === 'Escape') {
            text.blur();
          }
        }
        e.stopPropagation();
        return;
      }

      if (image || link) {
        if (type === 'click') {
          e.preventDefault();
          if (image) openImage(image.getAttribute('data-bb-img'));
          else openLink(link.getAttribute('data-bb-link'));
        }
        e.stopPropagation();
      }
    }, true);
  });

  document.addEventListener('focusin', function (e) {
    if (!editing) return;
    var el = editableOf(e.target);
    if (el) lastEl = el;
  });

  document.addEventListener('input', function (e) {
    if (!editing) return;
    var el = editableOf(e.target);
    if (!el) return;
    lastEl = el;
    var key = el.getAttribute('data-bb');
    if (cleanHtml(el) !== el.__bbOrig) dirty[key] = true;
    else delete dirty[key];
    say('');
    refreshSave();
  }, true);

  // Wklejanie jako zwykły tekst (bez obcego formatowania i stylów).
  document.addEventListener('paste', function (e) {
    if (!editing || !editableOf(e.target)) return;
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text);
  }, true);

  // Nie wrzucamy do tekstów przeciągniętych obrazów i plików.
  ['dragover', 'drop'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (editing && editableOf(e.target)) e.preventDefault();
    }, true);
  });

  window.addEventListener('beforeunload', function (e) {
    if (editing && Object.keys(dirty).length) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Po zapisie galerii strona się odświeża (nowa kolejność pochodzi z serwera): wracamy od razu do trybu edycji.
  try {
    if (window.sessionStorage.getItem('bb-reopen') === '1') {
      window.sessionStorage.removeItem('bb-reopen');
      startEditing();
      say('Galeria zapisana.', 'ok');
    }
  } catch (err) { /* brak pamięci sesji: tryb edycji włączy się ręcznie */ }
})();
