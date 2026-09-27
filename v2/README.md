# DJ Błażej Biurkowski | v2

Druga wersja strony: czysty HTML + CSS + vanilla JS, bez frameworków, przygotowana do przeniesienia na WordPress.
Na razie gotowe: górna nawigacja i hero strony głównej.

## Pliki
- `index.html`: nawigacja, hero, sticky CTA (mobile) i tymczasowy placeholder `.bb-next` na kolejne sekcje
- `styles.css`: tokeny kolorów i fontów w `:root` (`--bb-*`), wszystkie klasy z prefiksem `.bb-`
- `main.js`: podział h1 na słowa, start animacji, tło nagłówka po scrollu, dropdowny, menu mobilne, sticky CTA, paralaksa
- `assets/hero-person.png`, `assets/logo.svg`: **tymczasowe**, patrz niżej
- `wordpress/functions-snippet.php`: podpięcie plików, fontów i menu w motywie potomnym

## Podgląd lokalny
`node .claude/serve.js 5520` (z folderu nadrzędnego), potem http://localhost:5520/v2/

## Assety do podmiany
| Plik | Teraz | Potrzebne |
|---|---|---|
| `assets/hero-person.png` | wycinek z obecnej strony, tylko 410×901 px (na desktopie rozciągany ~2×, na ekranach retina nieostry) | PNG/WebP z przezroczystym tłem, min. **1000×2200 px**, pełna sylwetka ze stopami i podstawą hokera. Po podmianie zaktualizuj `width`/`height` w `<img>` i dostrój pozycję cienia (`.bb-hero__shadow::before/::after`) |
| `assets/logo.svg` | automatyczna wektoryzacja PNG 111×109 px (kształt zgodny, ale krawędzie mogą nie być idealne) | oryginalny plik wektorowy monogramu od projektanta |

Linki social (`#`) to placeholdery. Adresy z v1 są w komentarzu w `index.html`.

## Przeniesienie na WordPress
- **Menu**: markup ma te same klasy, które generuje `wp_nav_menu()` (`menu-item`, `menu-item-has-children`, `sub-menu`, `current-menu-item`). Pozycje-rodzice („Oferta”, „Portfolio”) zakładamy jako Własne odnośniki z adresem `#`. `main.js` sam zamienia je na przyciski z `aria-expanded`. Wywołanie jest w komentarzu w `wordpress/functions-snippet.php`.
- **EN | PL**: statyczna lista `.bb-lang`. W WP generuje się ją z Polylang (`pll_the_languages(['raw' => 1])`) w tym samym markupie.
- **Hero**: sekcja `.bb-hero` + `.bb-sticky-cta` → `template-parts/hero.php` albo blok „Własny HTML”. Kursywa w podtytule to zwykłe `<em>`, więc w edytorze wystarczy ją zaznaczyć jako kursywę. Zdjęcie najlepiej przez `wp_get_attachment_image()` z `fetchpriority="high"` i `loading` wyłączonym (WP doda `srcset`).
- **Animacje** sterowane są atrybutami: `data-anim` (wejście), `data-split` (h1 dzielony na słowa), `data-parallax="0.24"` (prędkość paralaksy). W Elementorze dodaje się je w Zaawansowane → Atrybuty.
- **Pasek admina** WP jest uwzględniony (`.admin-bar .bb-header`).
- **Logo SVG** w bibliotece mediów wymaga wtyczki typu Safe SVG.
- **RODO**: Google Fonts z CDN można zamienić na fonty hostowane lokalnie (np. wtyczka OMGF), bez zmian w CSS.

## Dostępność i wydajność
- Jeden `<h1>` („historie pisane muzyką”), nadtytuł jako `<p>` w `<hgroup>`, skip link, widoczny focus, dropdowny obsługiwane klawiaturą (Tab otwiera, Escape zamyka).
- Szary `#8A8A8A` (kontrast 3,09:1) tylko dla tekstu ≥ 24 px, więc spełnia AA dla dużego tekstu. Kursywa w podtytule ma min. 24 px.
- `prefers-reduced-motion: reduce` wyłącza animacje i paralaksę; treść jest widoczna od razu.
