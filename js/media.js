/* DJ Błażej Biurkowski | sekcja „W roli Eksperta” (podstrona Wedding)
   Rozkłada logotypy mediów wokół ściany kadrów. Wydzielone z main.js, bo ta sekcja mieszka teraz na podstronie wedding/
   (strona główna jej nie ma). Plik jest samodzielny: nie zależy od main.js. */
(function () {
  'use strict';

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
})();
