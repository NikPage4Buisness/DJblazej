# Strona na zwykłym hostingu (bez WordPressa), z edycją na stronie

Ta wersja to ta sama strona i ten sam edytor co w motywie WordPressa (teksty, zdjęcia, linki, galerie portfolio edytuje się klikając na stronie),
ale działa bez WordPressa i bez bazy danych. Wystarczy hosting z PHP i domena.

Budowa paczki (na komputerze, z głównego folderu projektu):

```bash
node wordpress/build-standalone.mjs
```

Wynik w `wordpress/dist/`:

| Plik | Do czego |
| --- | --- |
| `djblazej-hosting.zip` | **pierwsze wdrożenie** (cała strona, puste dane, kod instalacyjny) |
| `djblazej-hosting-aktualizacja.zip` | **aktualizacja** istniejącej strony (nie zawiera `data/` ani `uploads/`, więc nie kasuje zmian klienta) |
| `KOD-INSTALACYJNY.txt` | kod do założenia konta (tylko dla Ciebie, nie jest w paczce, nie wysyłaj go klientowi razem z paczką) |

## Wymagania hostingu

- **PHP 7.4 lub nowszy** (zalecane 8.x). Zwykle jest na każdym współdzielonym hostingu.
- **Apache lub LiteSpeed z włączonym `.htaccess` i `mod_rewrite`** (standard). Dla **nginx** jest fragment konfiguracji niżej.
- Rozszerzenie **GD z obsługą WebP** (zdjęcia wgrywane w edytorze są zmniejszane i zapisywane jako WebP). Bez GD wszystko działa, ale zdjęcia
  zostają w oryginalnym rozmiarze, co spowalnia stronę. Rozszerzenie **exif** jest zalecane (poprawny obrót zdjęć z telefonu).
- Zapis do folderów `data/` i `uploads/` (zwykle uprawnienia 755 wystarczą, gdy PHP działa na tym samym koncie co FTP; jeśli edytor pisze
  „Nie udało się zapisać”, ustaw na tych dwóch folderach 775).
- **HTTPS** (certyfikat Let's Encrypt jest na każdym hostingu). Logowanie przez zwykłe http jest mniej bezpieczne.
- Do wgrywania dużych zdjęć przydaje się limit żądania `post_max_size` co najmniej 16M (typowo jest 32M lub więcej).

## Pierwsze wdrożenie

1. Rozpakuj `djblazej-hosting.zip` na komputerze. **Wgraj całą zawartość przez FTP do katalogu domeny** (zwykle `public_html`), razem z plikiem
   `.htaccess` (jest ukryty, upewnij się, że program FTP pokazuje ukryte pliki).
   W katalogu mają się znaleźć: `index.php`, `.htaccess`, `robots.txt`, `sitemap.xml`, `cms/`, `theme/`, `data/`, `uploads/`.
2. Otwórz `https://twoja-domena.pl/`. Strona powinna wyglądać tak jak w podglądzie.
3. Otwórz `https://twoja-domena.pl/admin`. Zobaczysz „Pierwsze uruchomienie”. Wpisz **kod instalacyjny** z pliku `KOD-INSTALACYJNY.txt`,
   wybierz login i hasło (co najmniej 10 znaków) i kliknij „Załóż konto”. Konto zakłada się raz, kod przestaje wtedy działać.
4. Po założeniu konta strona pokaże się z czerwonym przyciskiem **„Edytuj teksty, zdjęcia i linki”** w lewym dolnym rogu. Tak wygląda codzienna praca klienta.

Przy instalacji w podkatalogu (np. `domena.pl/nowa/`) wgraj całość do tego podkatalogu. Strona sama wykrywa swój adres.

## Sprawdzenie hostingu przed wdrożeniem

Zamiast wersji testowej można sprawdzić hosting jednym plikiem. Przy budowaniu paczki powstaje `wordpress/dist/sprawdz-hosting-<losowe znaki>.php` (poza paczką, nazwa jest za każdym razem inna).

1. Wgraj ten plik do folderu domeny (tam, gdzie ma stanąć strona, np. `domains/djblazej.pl/public_html`).
2. Otwórz `https://djblazej.pl/sprawdz-hosting-....php` (z tą nazwą). Skrypt sprawdza dokładnie to, czego potrzebuje strona, na tej samej domenie i z tą samą wersją PHP:
   wersję PHP, wymagane funkcje, GD z zapisem WebP (próbnym obrazem), exif, limity pamięci i wgrywania, zapis plików i blokady, HTTPS oraz to, czy serwer stosuje
   reguły `.htaccess` (robi próbę na tymczasowym podfolderze, który od razu usuwa).
3. Skopiuj wynik z dołu strony. Werdykt: **zielony** (wszystko jest), **żółty** (można wdrażać, są uwagi) albo **czerwony** (jest coś do naprawy przed wdrożeniem; przy każdym punkcie jest podane, co zrobić).
4. Plik **sam się usuwa** po wyświetleniu wyniku (żeby go zostawić, dopisz do adresu `?zostaw=1`). Jeśli serwer nie pozwala zapytać samego siebie, próba `.htaccess` pokaże „nie udało się sprawdzić”: wtedy wystarczy, że po wgraniu strony otworzy się `/admin`.
   Do adresu można też dopisać `?bez-proby=1`, żeby pominąć próbę `.htaccess`.

Skrypt niczego nie zmienia poza własnym plikiem i tymczasowymi podfolderami (usuwanymi od razu). Nie ma go w `djblazej-hosting.zip`.

## Wdrożenie na domenę, na której działa stara strona (WordPress)

1. **Kopia.** Pobierz na dysk folder starej strony (`domains/<domena>`; w panelu „Archiwizuj” i „Pobierz”) oraz bazę danych WordPressa (phpMyAdmin → Eksport albo kopia baz w panelu). Poczta nie jest w tym folderze i wdrożenie jej nie dotyka.
2. **Sprawdzenie hostingu** (wyżej), najlepiej ze starą stroną jeszcze na miejscu.
3. **Przełączenie.** W menedżerze plików, w folderze domeny:
   - utwórz obok `public_html` nowy folder, np. `stara-strona-wp` (nie wewnątrz `public_html`, bo byłby dostępny z internetu),
   - przenieś do niego całą zawartość `public_html` **oprócz folderu `.well-known`** (służy do odnawiania certyfikatu SSL), razem ze starym `.htaccess`,
   - wgraj `djblazej-hosting.zip` do `public_html` i rozpakuj go tam („Extract”), razem z ukrytym `.htaccess`,
   - od razu otwórz `https://domena.pl/admin` i załóż konto kodem z `KOD-INSTALACYJNY.txt`.
4. **Po przełączeniu** sprawdź: stronę główną i trzy podstrony, `/admin`, kilka starych adresów (patrz niżej), `http://` i `www` (powinny przekierować na `https://domena.pl`). Jeśli stary `.htaccess` ustawiał wersję PHP, a nowy ją zresetował, wybierz właściwą wersję PHP w panelu.
5. **Wycofanie** (gdyby coś poszło źle): usuń zawartość `public_html` z wyjątkiem `.well-known` i przenieś z powrotem pliki z `stara-strona-wp`. Stara strona wróci w takim stanie, w jakim była.
6. Po kilku tygodniach, gdy wszystko działa, folder `stara-strona-wp` i bazę starego WordPressa można usunąć.

## Zgoda na cookies

Przy pierwszej wizycie, chwilę po załadowaniu strony, w rogu pojawia się minimalistyczny pasek z dwoma równorzędnymi przyciskami **Odrzucam** i **Akceptuję** oraz linkiem do polityki prywatności (na telefonie pasek jest na całą szerokość u dołu).
Działa to na wszystkich sześciu stronach i na zwykłym hostingu, i w WordPressie (plik `js/consent.js`).

- Wybór zapisuje się we własnym cookie `bb_consent` na 12 miesięcy (cookie niezbędne: zapamiętuje ustawienia prywatności). Odwiedzający może zmienić zdanie przyciskiem **„Ustawienia cookies”** w stopce każdej strony.
- **Dziś strona nie ładuje żadnych opcjonalnych narzędzi** (statystyk, reklam, pikseli), więc odrzucenie niczego nie wyłącza. Pasek jest gotowy na ich dodanie: kod narzędzia wstawia się wtedy tak, żeby ruszał dopiero po zgodzie:
  `BBConsent.onAccept(function () { ...kod narzędzia... });` (pomocnicze: `BBConsent.accepted()` i `BBConsent.get()`; po każdym wyborze idzie też zdarzenie `bb:consent`).
- Zalogowany użytkownik edytora nie widzi paska automatycznie (przeszkadzałby w edycji), a w oknie prywatnym i u odwiedzających pokazuje się normalnie.
- Tekst paska jest w `js/consent.js` (zmienia się w kodzie, nie w edytorze treści).
- Polityka prywatności (skopiowana ze starej strony) mówi o trzech możliwościach: zaakceptować wszystko, odrzucić wszystko i wybrać kategorie. Pasek daje dwie pierwsze; gdy pojawią się narzędzia opcjonalne, warto dodać wybór kategorii i zaktualizować politykę.

## Strony Referencje i Polityka prywatności

Obie strony są przeniesione ze starej strony i mają ten sam adres co tam, więc nie trzeba ich przekierowywać:

- `/referencje-dj-blazej/`: film (odtwarzacz YouTube ładuje się dopiero po kliknięciu, więc przed kliknięciem nic nie idzie do zewnętrznych serwerów) i 58 opinii w jednej kolumnie.
  Teksty opinii i podpisy klient poprawia w edytorze jak każdy inny tekst; adres filmu zmienia, klikając w plakat (jak zwykły link, wystarczy adres z youtu.be albo youtube.com).
  Dodawanie i usuwanie całych opinii nie jest jeszcze w edytorze: robi się to w kodzie (`referencje-dj-blazej/index.html`) i wgrywa aktualizację.
  Z opinii pominięto jeden dokładny duplikat (Paulina i Krzysztof), a jedna opinia nie ma podpisu, tak jak na starej stronie.
- `/polityka-prywatnosci-i-plikow-cookies/`: tekst skopiowany bez zmian ze starej strony (stan z 15 lipca 2026 r.), w tym tabela celów przetwarzania, która na telefonie zamienia się w karty.
  Wszystkie akapity, nagłówki i komórki tabeli można poprawiać w edytorze. **Treść wymaga przeglądu**: opisuje m.in. formularz kontaktowy, narzędzia analityczne i panel zgody na cookies,
  których nowa strona nie ma (jest tylko poczta, telefon i linki do mediów społecznościowych).

Linki do obu stron są w stopce każdej strony. **Referencje** mają też skrót w menu: na stronie głównej w górnym pasku, w menu w sekcji głównej i w sekcji skrótów
(górny pasek ma układ 3 + 3: Home, O mnie, Oferta | Portfolio, Referencje, Kontakt), a na podstronach obok „Strona główna”; są też w bloku „Zobacz też” na podstronach oferty.
Mapa strony (`sitemap.xml`) zawiera obie strony.

## Przekierowania ze starych adresów

Strona nie traci pozycji w Google, jeśli stare adresy kierują (kodem 301) na odpowiedniki w nowej. Lista jest w `wordpress/redirects.mjs` i powstała z map witryny starej strony (10 stron, 18 wpisów, 9 kategorii, 129 tagów):

- strony: `/oferta-weselna/` → `/wedding/`, `/oferta-studniowkowa/` → `/studniowki/`, `/oferta-eventy/` → `/eventy/`, `/portfolio-zdjecia/` i `/portfolio-video/` → `/#portfolio`, `/kontak-dj-blazej/` → `/#kontakt`, `/oferta-2/` → `/#oferta`; strony `/referencje-dj-blazej/` i `/polityka-prywatnosci-i-plikow-cookies/` istnieją w nowym serwisie pod tym samym adresem, więc nie potrzebują przekierowania,
- wpisy starego bloga: wesela → `/wedding/`, imprezy → `/eventy/`, studniówki → `/studniowki/` (adres `/eventy/` jest taki sam jak nowa strona i działa sam),
- kategorie i tagi: według tematu (80 tagów → wesele, 23 → eventy, 8 → studniówki, 18 ogólnych → strona główna),
- stare mapy witryny (`/sitemap_index.xml` itd.) → `/sitemap.xml`; `/sitemap.xml` zostaje tym samym adresem, który stara strona podawała w `robots.txt`, więc Search Console go nie zgubi.

Działa to w `index.php` (nie w `.htaccess`), więc nie zależy od ustawień serwera. Zapytanie z `?utm_...` też jest obsługiwane (zapytanie się nie przenosi). Adresów, których nie ma na liście (np. `/wp-content/uploads/...`, pliki starych zdjęć), nie da się sensownie zastąpić: dostają zwykłe 404.
Żeby zmienić listę, edytuj `wordpress/redirects.mjs` i zbuduj paczkę ponownie: skrypt budujący sprawdza, że każdy cel istnieje w nowym serwisie.

Do tego paczka przekierowuje wariant domeny z `www` na adres docelowy (`SITE_URL`, domyślnie `https://djblazej.pl`), a `.htaccess` wymusza `https`.
Po wdrożeniu Google potrzebuje kilku tygodni na przeniesienie pozycji i w tym czasie wahania w wynikach są normalne. W Search Console warto wejść w „Mapy witryn” i podać `sitemap.xml`.

## Codzienna edycja (dla klienta)

Wchodzi na swoją stronę, loguje się pod `/admin` (hasło zapamiętuje przeglądarka) i klika czerwony przycisk. Dalej tak samo jak w WordPressie
(opis w `INSTRUKCJA.md`, etapy 2 do 4): teksty klika i pisze, zdjęcia i linki zmienia po kliknięciu, a portfolio układa w oknie „Galeria”.
Różnice względem WordPressa:

- „Wybierz z biblioteki mediów” pokazuje listę zdjęć wgranych wcześniej przez edytor (nie ma całej biblioteki WordPressa).
- Przy przycisku jest **„Wyloguj”**.
- Pod `/admin` są: zmiana hasła i **Historia zmian**. Przed każdym zapisem strona zapamiętuje poprzedni stan treści (60 ostatnich zapisów)
  i można do niego wrócić jednym kliknięciem.

## Aktualizacja strony (nowa wersja projektu)

1. Zbuduj paczkę: `node wordpress/build-standalone.mjs`.
2. Wgraj zawartość `djblazej-hosting-aktualizacja.zip` na hosting **z nadpisaniem** istniejących plików. Ta paczka celowo nie ma folderów `data/` i `uploads/`,
   więc zmiany klienta (teksty, zdjęcia, galerie, konto) zostają.
3. Po aktualizacji odśwież stronę z Ctrl+F5. Jeśli w nowej wersji zmieniły się teksty w projekcie, zmiany klienta dla tych tekstów mogą przestać obowiązywać
   (klucz tekstu zależy od jego treści domyślnej), dlatego po wdrożeniu teksty zmienia klient w edytorze, a my zmieniamy kod i wygląd.

## Mapa strony (sitemap.xml) i robots.txt

Paczka ma dwa pliki dla wyszukiwarek, tworzone przy budowaniu: `sitemap.xml` (lista stron do zaindeksowania) i `robots.txt` (wskazuje mapę).

- Adres w mapie to domyślnie `https://djblazej.pl`. Inny (np. z `www`) ustawia się przy budowaniu paczki:
  `SITE_URL=https://www.djblazej.pl node wordpress/build-standalone.mjs` (w PowerShellu: `$env:SITE_URL='https://www.djblazej.pl'; node wordpress/build-standalone.mjs`).
  Adres musi być taki, pod jakim strona naprawdę działa (z `www` albo bez, z `https`).
- Do mapy trafiają tylko strony bez `<meta name="robots" content="noindex">`. Podstrony oznaczone jako szkic (noindex) są pomijane, a skrypt wypisuje je po budowaniu.
  Po akceptacji treści wystarczy usunąć tę linię z HTML i zbudować paczkę jeszcze raz: podstrona sama pojawi się w mapie.
- Po wdrożeniu na docelową domenę: w Google Search Console dodaj usługę dla domeny, wejdź w „Mapy witryn” i wpisz `sitemap.xml`.
- Panel `/admin` ma własny `noindex`, więc nie trafia do wyszukiwarki (nie blokujemy go w `robots.txt`, żeby wyszukiwarka mogła ten znacznik odczytać).
- Mapa nie ma dat modyfikacji. Strona jest mała i rzadko zmienia adresy, a błędne daty szkodzą bardziej niż ich brak.

## Kopia zapasowa

Wystarczy skopiować dwa foldery: **`data/`** (treści, konto, historia zmian) i **`uploads/`** (wgrane zdjęcia). Reszta to kod, który zawsze można wgrać ponownie.
Kopię robi się przez FTP albo w panelu hostingu. Warto robić ją raz w miesiącu i przed większymi zmianami.

## Zapomniane hasło

1. Przez FTP usuń plik `data/auth.php`.
2. Wgraj z oryginalnej paczki (`djblazej-hosting.zip`) plik `data/setup.php` (ten sam kod instalacyjny z `KOD-INSTALACYJNY.txt` znów zadziała).
3. Wejdź na `/admin` i załóż konto od nowa. Treści strony zostają.

## nginx (zamiast .htaccess)

```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}
location ~ ^/(data|cms)/ { deny all; }
location ~* ^/uploads/.*\.(php|phtml|phar)$ { deny all; }
```

Pliki z `data/` i tak mają w środku zabezpieczenie (każdy kończy się na `.php` i zaczyna od polecenia przerywającego wykonanie), więc nawet bez tej reguły
ich zawartość nie wyjdzie na zewnątrz.

## Bezpieczeństwo (co jest zrobione)

- Hasło jest zapisane tylko jako skrót (bcrypt), nigdy jawnie. Po 5 błędnych próbach logowania z jednego adresu IP logowanie jest blokowane na 15 minut.
- Sesja to losowy token w ciasteczku (HttpOnly, SameSite=Lax, Secure na https), a każda zmiana z edytora wymaga dodatkowego tokenu wyliczonego z sesji.
- Wszystkie treści wpisywane przez klienta są oczyszczane (dozwolone tylko pogrubienie, kursywa, złamanie linii, wyróżnienie), adresy linków sprawdzane
  (tylko http, https, mailto, tel i adresy w obrębie strony), opisy zabezpieczone przed wstrzyknięciem kodu.
- Wgrywane pliki są sprawdzane i zapisywane od nowa (tylko JPG, PNG, WebP), pod losowymi nazwami, a w `uploads/` skrypty nie mogą się wykonywać.
- Dane leżą w plikach poza dostępem z sieci. Odwiedzający nigdy nie dostają kodu edytora ani danych galerii.

## Jeśli coś nie działa

| Objaw | Co sprawdzić |
| --- | --- |
| Biała strona albo błąd 500 po wgraniu | wersja PHP w panelu hostingu (min. 7.4); czy wgrano `.htaccess` w całości |
| Wszystkie podstrony poza główną dają 404 | `.htaccess` nie został wgrany albo hosting ignoruje `.htaccess` (nginx: użyj konfiguracji wyżej) |
| „Nie udało się zapisać” w edytorze | uprawnienia zapisu do `data/` i `uploads/` (775) |
| Wgrywanie zdjęcia kończy się błędem | zbyt duży plik wobec limitu hostingu (`post_max_size`); zmniejsz zdjęcie do ok. 4000 px z dłuższego boku |
| Po zalogowaniu nie ma czerwonego przycisku | odśwież stronę z Ctrl+F5; sprawdź, czy przeglądarka nie blokuje ciasteczek tej domeny |
| Zmiana nie jest widoczna dla odwiedzających | wtyczki/CDN z pamięcią podręczną (np. Cloudflare): wyczyść ich pamięć |

## Co jest sprawdzone, a czego nie

Cała warstwa została uruchomiona w prawdziwym PHP 8.3 (w node, ten sam kod co na hostingu) i przetestowana end-to-end (strony, logowanie, zabezpieczenia,
zapis treści, wgrywanie i przetwarzanie zdjęć z obrotem EXIF, galerie, historia, hasło, wylogowanie). **Nie była uruchomiona na prawdziwym serwerze Apache/LiteSpeed**,
więc przy pierwszym wdrożeniu sprawdź: stronę główną, podstrony, `/admin`, zapis tekstu i wgranie zdjęcia. Reguły `.htaccess` są standardowe, ale mogą różnić się
w szczegółach między hostingami.
