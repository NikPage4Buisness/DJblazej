# DJ Błażej Biurkowski | v2 (cała strona)

One page w czystym HTML + CSS + vanilla JS, przygotowany do przeniesienia na WordPress tak,
żeby klient mógł sam edytować wszystkie teksty oraz dodawać i usuwać zdjęcia, opinie i filmy.

## Sekcje
| # | Sekcja | Kotwica | Co zawiera |
|---|---|---|---|
| – | Hero „Events” | `#home` | czarna scena; filmowe okręgi światła ze snopami spoza ekranu odsłaniają biały napis Events, potem dryfują; przycisk „Zapytaj o dostępność terminu”, telefon, e-mail |
| 01 | Sylwetka (zamiast „O mnie”) | `#sylwetka` | postać na środku, fakty po lewej i prawej, cytat, „W mediach” (logotypy + zdjęcia z TV i prasy) |
| 02 | Oferta | `#oferta`, `#wesela`, `#eventy`, `#studniowki` | 3 oferty: zdjęcie, opis, lista usług |
| 03 | Styl | `#styl` | 4 wartości + zmieniające się zdjęcia; na wejściu czarna kurtyna z logo (jak w v1) |
| 04 | Portfolio | `#portfolio` | 161 zdjęć, filtr kategorii, „Pokaż więcej”, lightbox |
| 05 | Video | `#video` | 4 filmy (odtwarzacz ładuje się dopiero po kliknięciu) |
| 06 | Referencje | `#referencje` | karuzela 10 opinii na „zakrzywionej przestrzeni” (łuki u góry i u dołu, karty skręcone w 3D); po „zakręceniu” myszą leci chwilę z bezwładem, hamuje i zostaje tam, gdzie się zatrzyma |
| 07 | Kontakt | `#kontakt` | dwa kafle: telefon i e-mail (bez formularza), social media, stopka |

Numery sekcji liczy CSS, więc po dodaniu, usunięciu lub przestawieniu sekcji nic nie trzeba poprawiać.

## Hero: filmowe okręgi światła
Oś czasu (main.js, obiekt `T`): strona startuje od czarnej sceny z samą nawigacją. Po 0,5 s pojawiają się okręgi
światła – każdy ze snopem z reflektora spoza ekranu – krążą wokół niewidocznego napisu i spiralnie zbiegają się na nim,
odsłaniając go tam, gdzie świecą. Po 4,1 s rozbłysk odsłania całe hero, a od 4,3 s okręgi przechodzą w swobodny dryf
(na komputerze po całej scenie, na telefonie po napisie, żeby światło padało na tekst).

Jak to działa: nad treścią leży czarna „zasłona” (`.bb-veil`, `mix-blend-mode: multiply`); białe okręgi i snopy
w zasłonie przepuszczają obraz, reszta zostaje czarna. Widoczne światło to druga warstwa (`.bb-glow`) z tymi samymi
okręgami i snopami. Wszystko porusza się wyłącznie transformacjami (GPU), poza ekranem animacja stoi.
Bez JS zasłony nie ma, a przy `prefers-reduced-motion` od razu widać odsłoniętą scenę z nieruchomymi okręgami.

## Kurtyna (sekcja Styl)
Sekcja z atrybutem `data-curtain` dostaje przy wejściu na ekran czarną planszę z logo, która po chwili podnosi się
do góry (to samo przejście co kurtyna w v1). W WP wystarczy dodać ten atrybut do sekcji (w Elementorze: Atrybuty).

## Podgląd lokalny
`node .claude/serve.js 5520` (z folderu nadrzędnego), potem http://localhost:5520/v2/.
Zdjęcia portfolio, mediów i sekcji Styl są brane z `../assets/` (te same pliki co w v1, bez duplikowania).

## Przeniesienie na WordPress
Zasada: cała treść siedzi w HTML (nagłówki, akapity, listy, `<img>`), CSS i JS niczego nie dopisują.
JS nie zależy od liczby elementów, więc dodanie lub usunięcie pozycji nie wymaga zmian w kodzie.

Zalecane: motyw potomny + pola własne (ACF PRO albo darmowe Secure Custom Fields z polami „Repeater” i „Gallery”).
Szablon wypisuje pola w tym samym markupie co `index.html`.

| Sekcja | Pola do edycji przez klienta |
|---|---|
| Nagłówek | menu z `wp_nav_menu()` (pozycje jako Własne odnośniki: `#wesela`, `#portfolio`…) |
| Hero | nadpis, napis „Events”, tekst i link przycisku, telefon, e-mail |
| Sylwetka | nadtytuł, tytuł, lead, zdjęcie postaci; **Repeater „Fakty”**: etykieta, tytuł, opis (nieparzyste idą na lewo, parzyste na prawo); cytat; **Gallery „Logotypy mediów”**; **Gallery „Zdjęcia z mediów”** |
| Oferta | tytuł; **Repeater „Oferty”**: kotwica, zdjęcie, nazwa, lead, Repeater „Usługi” (nazwa + opis), tagi |
| Styl | tytuł; **Gallery „Zdjęcia”**; **Repeater „Wartości”**: nazwa + opis (edytor z pogrubieniem) |
| Portfolio | tytuł; **Repeater „Zdjęcia”**: obraz + kategorie (wielokrotny wybór → atrybut `data-cat`); przyciski filtra = lista kategorii |
| Video | **Repeater „Filmy”**: tytuł + adres YouTube/Vimeo |
| Referencje | **Repeater „Opinie”**: treść + podpis (albo osobny typ wpisu) |
| Kontakt | tytuł, opis, telefon, e-mail, linki social |

Szczegóły techniczne:
- `styles.css`, `main.js` i `assets/` → folder `/bb` w motywie potomnym; podpięcie w `wordpress/functions-snippet.php`.
- Pasek logotypów mediów: JS sam klonuje listę do animacji, a klient edytuje jedną listę.
- Portfolio: duże kafelki (co 9. zdjęcie) i doładowywanie po 9 zdjęć robi JS.
- Polskie sierotki (a, i, o, u, w, z na końcu wiersza) poprawia JS automatycznie.
- Lightbox i odtwarzacz wideo tworzy JS; bez JS linki otwierają zdjęcie lub film normalnie.
- Pasek admina WP jest uwzględniony (`.admin-bar`). Logo SVG w bibliotece mediów wymaga wtyczki typu Safe SVG.

## Assety do podmiany
| Plik | Teraz | Potrzebne |
|---|---|---|
| `assets/hero-person-2.webp` | zdjęcie bez słuchawek z v1 (`assets/hero-2.webp`, 680×1474 px) z automatycznie wyciętym tłem i zachowanym cieniem | docelowo wycięcie z pliku w pełnej rozdzielczości (ręcznie lub w Photoshopie) |
| `assets/logo.svg` | automatyczna wektoryzacja PNG 111×109 px | oryginalny wektor monogramu |
| EN | `href="#"` | wersja angielska (np. Polylang) |

## Teksty przeniesione 1:1 z obecnej strony (do decyzji klienta)
Literówki zostawione bez zmian, żeby nie zmieniać treści klienta bez zgody:
- „nieograniczać” → „nie ograniczać”
- „Swój warsztat doskonalił” (3. osoba w tekście pisanym w 1. osobie) → „doskonaliłem”
- „Cele jaki sobie założyłem” → „Cele, jakie sobie założyłem”
- „Wprowadzę Twoją studniówke” → „studniówkę”
- „niesmowity” (opinia Joanny i Łukasza) → „niesamowity”

Nowe krótkie teksty dopisane przy przebudowie (do akceptacji): nazwa sekcji „Sylwetka”, etykiety i tytuły faktów,
tytuły sekcji Styl („Zawsze w dobrym stylu i z klasą”), Portfolio („Łączymy muzykę i światło”),
Video („Materiał z video z oryginalnym dźwiękiem”), Referencje („Goście mówili, że na takim weselu jeszcze nie byli”)
oraz etykiety kafli kontaktu („Telefon”, „E-mail”, „Zadzwoń”, „Napisz e-mail” – dwa ostatnie z v1). Wszystkie pochodzą z treści obecnej strony.

## Opinie (sekcja Referencje)
Źródło: https://djblazej.pl/referencje-dj-blazej/ – na stronie jest 59 opinii. Do karuzeli wybrane zostało 10
(wesela, studniówka, goście z zagranicy, Dj & Lady Sax, oświetlenie). Pisownia jest oryginalna (także literówki),
a pominięte fragmenty dłuższych opinii są oznaczone „(…)”. Jedyne ingerencje: brakujące spacje po kropkach
(„calu.Masz” → „calu. Masz”, „tańca .Wszyscy” → „tańca. Wszyscy”, „seenperform” → „seen perform”).
Karuzela działa z dowolną liczbą opinii, więc w WP można wgrać wszystkie 59.
