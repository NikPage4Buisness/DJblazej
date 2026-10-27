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
   W katalogu mają się znaleźć: `index.php`, `.htaccess`, `cms/`, `theme/`, `data/`, `uploads/`.
2. Otwórz `https://twoja-domena.pl/`. Strona powinna wyglądać tak jak w podglądzie.
3. Otwórz `https://twoja-domena.pl/admin`. Zobaczysz „Pierwsze uruchomienie”. Wpisz **kod instalacyjny** z pliku `KOD-INSTALACYJNY.txt`,
   wybierz login i hasło (co najmniej 10 znaków) i kliknij „Załóż konto”. Konto zakłada się raz, kod przestaje wtedy działać.
4. Po założeniu konta strona pokaże się z czerwonym przyciskiem **„Edytuj teksty, zdjęcia i linki”** w lewym dolnym rogu. Tak wygląda codzienna praca klienta.

Przy instalacji w podkatalogu (np. `domena.pl/nowa/`) wgraj całość do tego podkatalogu. Strona sama wykrywa swój adres.

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
