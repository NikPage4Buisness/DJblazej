# DJ Błażej Biurkowski | One Page

Statyczna strona (HTML + CSS + JS, bez frameworków), przygotowana do przeniesienia na WordPress.

## Struktura
- `index.html` – cała treść, sekcje: Home, Występy, O mnie, Styl (wartości), Portfolio, Kontakt
- `css/style.css` – kolory i fonty w zmiennych `:root` (paleta z obecnej strony: #ECEBE8, czerń, gradient do #C2C2C2)
- Typografia: **Montserrat** (`--f-head`) w nagłówkach i elementach interfejsu (menu, przyciski, etykiety), **Lora** (`--f-text`) we wszystkich akapitach i cytatach (reguła `p, blockquote`, więc nowe akapity dodane w WordPressie dostaną ją same). Cormorant Garamond zostaje tylko w dekoracyjnym napisie „Music / Artist” w hero.
- `js/main.js` – loader, przejścia (kurtyna), linia postępu, filtr galerii, lightbox
- `assets/` – zdjęcia pobrane z djblazej.pl

## Podgląd lokalny
`node .claude/serve.js` → http://localhost:5510

## Przeniesienie na WordPress
- Każda `<section>` = jedna sekcja/kontener w Gutenbergu lub Elementorze. Teksty są zwykłymi nagłówkami i akapitami (bez dzielenia na litery, bez tekstu na grafikach).
- Hero: nagłówek i opis siedzą w grupie `.hero__head` (w WordPressie: blok Grupa z nagłówkiem i akapitem). Linie nagłówka są łamane `<br>` (w edytorze Shift+Enter), więc ramka grupy ma szerokość najdłuższej linii; na telefonie opis stoi dokładnie na jej środku, na komputerze i tablecie jest wyrównany do lewej. Duży napis w tle (`.hero__bg-word`, dekoracyjny, `aria-hidden`) z lewej wyłania się z tła (maska gradientowa), a zdjęcie postaci z przezroczystym tłem (WebP z kanałem alfa) w `.hero__stage`. Scena ma w CSS proporcje wycinka 1024:924 (`aspect-ratio`); przy podmianie zdjęcia na kadr o innych proporcjach trzeba zmienić `aspect-ratio` i położenie napisu. Oryginał wycinka (PNG): `assets/source/hero-cutout.png`.
- O mnie: nagłówek „O mnie” i cała wypowiedź Błażeja jako jeden `<blockquote>` z akapitami (w WordPressie: blok Cytat). Obok zdjęcie Błażeja na hokerze ze słuchawkami w dłoni, z wyciętym tłem (`assets/about-portrait.webp`, oryginał wycinka: `assets/source/about-seated-cutout.png`), w tle miękkie wstęgi `assets/ribbons.webp` (CSS, `.about::before`, generator `.claude/tools/ribbons.mjs`).
- Styl: pokaz ma 7 pionowych zdjęć (`assets/slides/`, 1080x1440 WebP). Pierwszy slajd ma zdjęcie w atrybucie `style`, kolejne w `data-bg`: JS pobiera je dopiero, gdy sekcja zbliża się do ekranu, i wtedy rusza zmiana zdjęć (co 5,2 s). Zdjęcia są zawsze widoczne w całości (`contain`), wolne pola ramki wypełnia rozmyta kopia zdjęcia.
- Występy: ściana kadrów to zwykłe `<figure>` z atrybutem `style="--ar: szerokość/wysokość"` (proporcje kadru). Rzędy układają się same i wypełniają szerokość bez przycinania zdjęć; `data-seq` ustala kolejność zapalania się w kolorze. Znak stacji w rogu to opcjonalny `<span class="wall__badge">` z logo.
- Galeria to zwykła lista `<li>` z atrybutem `data-cat` (kategorie filtra, po spacji) i `data-ar` (proporcje miniatury: szerokość/wysokość). Kolejność na liście = kolejność w portfolio; na początku są nowe zdjęcia od klienta (wrzesień 2026, pliki `img-*.webp` i `mg-*.webp`). Miniatury: 720 px po krótszym boku, pełne do podglądu: 2048 px po dłuższym (WebP); oryginały w `assets/source/`. Układ bento dobiera kafelki do orientacji zdjęć; gdy pionowych zdjęć jest więcej, niż zmieszczą wysokie kafelki, zdjęcie w kafelku o innej orientacji jest pokazane w całości na rozmytym tle (klasa `is-fit`, dodaje ją JS). W WP: blok Galeria + klasy CSS lub ten sam markup w bloku HTML.
- Pasek skrótów sekcji po lewej (od 1100 px szerokości) to nuty, które JS buduje z sekcji `data-snap`. Każda sekcja ma inną nutę, od góry: trzydziestodwójki, szesnastki (obie jako pary nut połączone belkami), ósemka, ćwierćnuta, półnuta, cała nuta (każda wartość trwa dwa razy dłużej od poprzedniej). Inną nutę można przypisać sekcji atrybutem `data-note` (`trzydziestodwojka`, `szesnastka`, `osemka`, `cwiercnuta`, `polnuta`, `calka`). Najechanie: nuta kołysze się jak wahadło metronomu i pokazuje nazwę sekcji; kliknięcie: podskok, dwie fale i odlatująca ósemka.
- Stopka: podpis wykonawcy (NikPage, znak `assets/nikpage-n.webp`, odnośnik do https://www.nikpage.pl/).
- Animacje sterowane są atrybutami: `data-reveal` (wejście elementu), `data-stagger` (wejście dzieci po kolei), `data-snap` + `data-label` + `data-theme` (sekcja w pasku postępu i menu, jej nazwa, jasny/ciemny nagłówek). W Elementorze dodaje się je w Zaawansowane → Atrybuty.
- `style.css` i `main.js` podpina się w motywie potomnym (`wp_enqueue_style` / `wp_enqueue_script`).
