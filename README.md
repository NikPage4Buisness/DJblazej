# DJ Błażej Biurkowski | One Page

Statyczna strona (HTML + CSS + JS, bez frameworków), przygotowana do przeniesienia na WordPress.

## Struktura
- `index.html` – cała treść, sekcje: Home, Media, Oferta, Styl (wartości), Portfolio, Kontakt
- `css/style.css` – kolory i fonty w zmiennych `:root` (paleta z obecnej strony: #ECEBE8, czerń, gradient do #C2C2C2)
- `js/main.js` – loader, przejścia (kurtyna), linia postępu, filtr galerii, lightbox
- `assets/` – zdjęcia pobrane z djblazej.pl

## Podgląd lokalny
`node .claude/serve.js` → http://localhost:5510

## Przeniesienie na WordPress
- Każda `<section>` = jedna sekcja/kontener w Gutenbergu lub Elementorze. Teksty są zwykłymi nagłówkami i akapitami (bez dzielenia na litery, bez tekstu na grafikach).
- Galeria to zwykła lista `<li>` z atrybutem `data-cat` (kategoria filtra). W WP: blok Galeria + klasy CSS lub ten sam markup w bloku HTML.
- Animacje sterowane są atrybutami: `data-reveal` (wejście elementu), `data-stagger` (wejście dzieci po kolei), `data-snap` + `data-label` + `data-theme` (sekcja w pasku postępu i menu, jej nazwa, jasny/ciemny nagłówek). W Elementorze dodaje się je w Zaawansowane → Atrybuty.
- `style.css` i `main.js` podpina się w motywie potomnym (`wp_enqueue_style` / `wp_enqueue_script`).
