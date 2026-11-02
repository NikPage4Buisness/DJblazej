/*
 * Przekierowania 301 ze starych adresów (poprzednia strona na WordPressie) na nowe, żeby nie stracić pozycji w Google.
 *
 * Źródło listy: mapy witryny starej strony (Yoast, 2.11.2026): 10 stron, 18 wpisów, 9 kategorii, 129 tagów.
 * Zmiany robi się tutaj, a potem buduje paczkę ponownie: node wordpress/build-standalone.mjs
 *
 * Zasady:
 *  - adresy zapisujemy małymi literami, z ukośnikiem na końcu (poza plikami, np. /sitemap_index.xml); wielkość liter i brak
 *    ukośnika w żądaniu nie mają znaczenia,
 *  - cel to adres strony nowego serwisu: /, /eventy/, /studniowki/, /wedding/ albo /sitemap.xml, ewentualnie z kotwicą (/#portfolio);
 *    skrypt budujący sprawdza to i przerywa, gdy cel nie istnieje,
 *  - adresów, które są stronami nowego serwisu (np. /eventy/), tu nie wpisujemy: działają same,
 *  - wyrażenia w "rules" sprawdzane są po kolei, pierwsze pasujące wygrywa; piszemy je prostą składnią (bez lookbehind),
 *    bo działają i w JavaScripcie (test przy budowie), i w PHP (PCRE).
 */

export const exact = {
  /* --- strony --- */
  '/oferta-weselna/': '/wedding/',
  '/oferta-studniowkowa/': '/studniowki/',
  '/oferta-eventy/': '/eventy/',
  '/oferta-2/': '/#oferta',
  '/portfolio-zdjecia/': '/#portfolio',
  '/portfolio-video/': '/#portfolio',
  '/kontak-dj-blazej/': '/#kontakt', // tak, z literówką: tak brzmiał stary adres
  // /referencje-dj-blazej/ i /polityka-prywatnosci-i-plikow-cookies/ mają w nowym serwisie strony pod tym samym adresem, więc nie wymagają wpisu

  /* --- wpisy starego bloga (2018-2019) --- */
  '/dj-na-wesele/': '/wedding/',
  '/dj-i-muzyka-na-wesele/': '/wedding/',
  '/repertuar-muzyczny-na-wesele/': '/wedding/',
  '/oprawa-muzyczna-wesela/': '/wedding/',
  '/zespol-na-wesele/': '/wedding/',
  '/dj-i-oprawa-muzyczna-wesela/': '/wedding/',
  '/atrakcje-na-weselach/': '/wedding/',
  '/saksofon-na-wesele/': '/wedding/',
  '/dekoracje-na-weselu/': '/wedding/',
  '/dj-na-weselu/': '/wedding/',
  '/dj-na-wesele-w-warszawie-czy-zespol/': '/wedding/',
  '/pierwszy-taniec-mlodej-pary/': '/wedding/',
  '/dj-wodzirej/': '/',
  '/dj-na-impreze/': '/eventy/',
  '/dj-na-impreze-w-warszawie/': '/eventy/',
  '/studniowka/': '/studniowki/',
  '/nowoczesne-studniowki/': '/studniowki/',
  // /eventy/ (wpis o tym samym adresie co nowa strona) nie wymaga wpisu

  /* --- kategorie --- */
  '/category/dj-na-wesele/': '/wedding/',
  '/category/pierwszy-taniec/': '/wedding/',
  '/category/wesele/': '/wedding/',
  '/category/dekoracje-weselne/': '/wedding/',
  '/category/zespol-na-wesele/': '/wedding/',
  '/category/studniowka/': '/studniowki/',
  '/category/impreza/': '/eventy/',
  '/category/impreza/dj-na-impreze/': '/eventy/',
  '/category/eventy/': '/eventy/',

  /* --- mapy witryny i kanały starej strony: jedna nowa mapa --- */
  '/sitemap_index.xml': '/sitemap.xml',
  '/post-sitemap.xml': '/sitemap.xml',
  '/page-sitemap.xml': '/sitemap.xml',
  '/category-sitemap.xml': '/sitemap.xml',
  '/post_tag-sitemap.xml': '/sitemap.xml',
  '/sitemap.rss': '/sitemap.xml',
  '/feed/': '/',
  '/comments/feed/': '/'
};

export const rules = [
  /* tagi i kategorie starego bloga (129 tagów): do strony o tym samym temacie, reszta na stronę główną */
  { match: '^/(?:category|tag)/.*studniow', to: '/studniowki/' },
  { match: '^/(?:category|tag)/.*(?:event|imprez|firmow|urodzin|wydarzen)', to: '/eventy/' },
  { match: '^/(?:category|tag)/.*(?:wesel|slub|mlod|taniec|dekorac|saksofon|zespol|espol|swiat|swietl|bank|baniek|mydlan|efekt|specjakn|targi|sali|repertuar|scenariusz|przygotowan|przyjec|utwor|oblok|lod)', to: '/wedding/' },
  { match: '^/(?:category|tag|author|page)/', to: '/' },
  { match: '^/(?:[^/]+/)*feed/', to: '/' }
];
