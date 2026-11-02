/* DJ Błażej Biurkowski | zgoda na pliki cookies
   Minimalny pasek zgody (Odrzucam / Akceptuję) i prosty interfejs dla ewentualnych skryptów opcjonalnych.
   Wybór zapisuje własne cookie "bb_consent" (cookie niezbędne: zapamiętuje ustawienia prywatności) na 12 miesięcy.
   Dziś strona nie ładuje żadnych opcjonalnych narzędzi (statystyk, reklam). Gdy się pojawią, mają startować dopiero po zgodzie:
     BBConsent.onAccept(function () { ...uruchom narzędzie... });
     BBConsent.accepted()  ->  true, gdy użytkownik zaakceptował
     BBConsent.get()       ->  'accepted', 'rejected' albo null (brak wyboru)
     BBConsent.open()      ->  pokazuje pasek ponownie (używa tego odnośnik „Ustawienia cookies” w stopce)
   Zdarzenie document 'bb:consent' (detail.choice) wysyłane jest po każdym wyborze. */
(function () {
  'use strict';

  var NAME = 'bb_consent';
  var MAX_AGE = 365 * 24 * 60 * 60;
  var listeners = [];
  var bar = null;

  function read() {
    var m = new RegExp('(?:^|;\\s*)' + NAME + '=([^;]*)').exec(document.cookie || '');
    var v = m ? decodeURIComponent(m[1]) : null;
    return v === 'accepted' || v === 'rejected' ? v : null;
  }

  function write(value) {
    try {
      document.cookie = NAME + '=' + value + '; Max-Age=' + MAX_AGE + '; Path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    } catch (e) { /* przeglądarka blokuje cookies: wybór obowiązuje do końca wizyty */ }
  }

  function choose(value) {
    write(value);
    hide();
    document.dispatchEvent(new CustomEvent('bb:consent', { detail: { choice: value } }));
    if (value === 'accepted') {
      var cbs = listeners.slice();
      listeners = [];
      cbs.forEach(function (cb) { try { cb(); } catch (e) { /* błąd cudzego skryptu nie może zablokować strony */ } });
    }
  }

  function policyUrl() {
    var a = document.querySelector('a[href$="polityka-prywatnosci-i-plikow-cookies/"]');
    return a ? a.getAttribute('href') : '/polityka-prywatnosci-i-plikow-cookies/';
  }

  function build() {
    var el = document.createElement('section');
    el.className = 'consent';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Pliki cookies');
    el.setAttribute('data-no-edit', '');
    el.hidden = true;

    var p = document.createElement('p');
    p.className = 'consent__text';
    p.appendChild(document.createTextNode('Ta strona korzysta z plików cookies. Niezbędne działają zawsze, pozostałe (np. statystyki, osadzone treści) tylko za Twoją zgodą. '));
    var link = document.createElement('a');
    link.href = policyUrl();
    link.textContent = 'Polityka prywatności i plików cookies';
    p.appendChild(link);

    var actions = document.createElement('div');
    actions.className = 'consent__actions';
    [['rejected', 'Odrzucam'], ['accepted', 'Akceptuję']].forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'consent__btn';
      btn.textContent = b[1];
      btn.addEventListener('click', function () { choose(b[0]); });
      actions.appendChild(btn);
    });

    el.appendChild(p);
    el.appendChild(actions);
    return el;
  }

  function show() {
    if (!bar) { bar = build(); document.body.appendChild(bar); }
    bar.hidden = false;
    window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { bar.classList.add('is-in'); }); });
  }

  function hide() {
    if (!bar) return;
    bar.classList.remove('is-in');
    var el = bar;
    window.setTimeout(function () { if (!el.classList.contains('is-in')) el.hidden = true; }, 700);
  }

  window.BBConsent = {
    get: read,
    accepted: function () { return read() === 'accepted'; },
    onAccept: function (cb) { if (read() === 'accepted') cb(); else listeners.push(cb); },
    open: show
  };

  /* odnośnik „Ustawienia cookies” w stopce (zwykły przycisk, działa też po ponownym wejściu na stronę) */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-consent-open]') : null;
    if (t) { e.preventDefault(); show(); }
  });

  /* pierwsza wizyta: pasek pojawia się chwilę po załadowaniu strony (po loaderze); zalogowany edytor treści go nie widzi */
  if (read() === null && !window.BB_EDIT) {
    var start = function () { window.setTimeout(show, 1200); };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  }
})();
