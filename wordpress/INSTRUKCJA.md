# Pierwsze uruchomienie strony na WordPressie (etap 1)

Etap 1 to przeniesienie aktualnej strony 1:1 na WordPressa, żeby zobaczyć, że działa na Twoim serwerze. Teksty są jeszcze w plikach motywu,
więc na razie nie edytuje się ich w panelu. Edycja przez kliknięcie w tekst to etap 2 (po tym, jak potwierdzisz, że etap 1 działa).

## Zanim zaczniesz

- Używaj testowego WordPressa (nowa instalacja, Local, WordPress Studio albo środowisko testowe u hostingu). **Aktywacja motywu od razu zmienia wygląd całej
  witryny**, więc na żywej stronie klienta rób to dopiero po teście i po kopii zapasowej.
- Wymagania: WordPress 6.3 lub nowszy, PHP 7.4 lub nowszy.

## Krok po kroku

1. **Zbuduj paczkę** (jeśli jej nie masz): w folderze projektu uruchom `node wordpress/build-theme.mjs`. Powstaje plik
   `wordpress/dist/djblazej-theme.zip` (ok. 44 MB, bez oryginałów zdjęć z `assets/source`).
2. **Wgraj motyw:** panel WordPressa, **Wygląd, Motywy, Dodaj nowy, Wyślij motyw na serwer**, wybierz `djblazej-theme.zip`, **Zainstaluj**.
   Jeśli wyskoczy błąd o rozmiarze pliku: rozpakuj zip i skopiuj folder `djblazej` do `wp-content/themes/` (menedżer plików hostingu, FTP albo
   w Local/Studio opcja „otwórz folder strony”). Motyw pojawi się na liście motywów.
3. **Ustaw adresy:** **Ustawienia, Bezpośrednie odnośniki**, wybierz **Nazwa wpisu**, **Zapisz**.
4. **Utwórz 3 strony** (**Strony, Dodaj nową**), treść zostaw pustą, opublikuj. Adres (slug) musi być dokładnie taki:

   | Tytuł | Adres (slug) |
   | --- | --- |
   | Eventy | `eventy` |
   | Studniówki | `studniowki` |
   | Wedding | `wedding` |

   Adres zmienisz w prawym panelu strony, **Odnośnik**, pole „Adres URL”. Szablon podstrony dobiera się automatycznie po adresie.
5. **Strona główna:** utwórz stronę „Strona główna” (treść pusta). **Ustawienia, Czytanie**, „Twoja strona główna wyświetla”,
   **Statyczna strona**, wybierz „Strona główna”, **Zapisz**.
6. **Aktywuj motyw:** **Wygląd, Motywy**, przy „DJ Błażej Biurkowski” kliknij **Aktywuj**.
7. **Sprawdź** (najlepiej w oknie incognito, bo zalogowany administrator widzi pasek WordPressa, który przesuwa górny pasek strony):
   - `/` (strona główna), `/eventy/`, `/studniowki/`, `/wedding/`,
   - czy się ładują zdjęcia i loader, czy działa menu (w tym „Oferta” z podmenu), galeria portfolio z filtrami i powiększeniem zdjęcia,
   - widok na telefonie.

## Jeśli coś nie działa

- Biała strona albo błąd PHP: włącz w `wp-config.php` `define( 'WP_DEBUG', true );` i prześlij mi komunikat.
- Brakujące zdjęcia lub style: otwórz w przeglądarce konsolę (F12, zakładka Network) i sprawdź, które adresy zwracają 404. Prześlij mi 2 lub 3 przykłady.
- Podstrony zwracają 404: wróć do **Ustawienia, Bezpośrednie odnośniki** i kliknij **Zapisz** jeszcze raz.
- Strona wygląda inaczej niż w podglądzie: wtyczki (np. optymalizacja, cache) mogą przerabiać style i skrypty. Wyłącz je na czas testu.

## Co jest w paczce

- `front-page.php`, `page-eventy.php`, `page-studniowki.php`, `page-wedding.php`: strony wygenerowane z plików `index.html`, `eventy/`, `studniowki/`, `wedding/`
  (ścieżki do zasobów zamienione na adres motywu, linki między stronami na adresy WordPressa),
- `css/`, `js/`, `assets/`: style, skrypty i zdjęcia,
- `style.css` (nagłówek motywu), `functions.php`, `index.php` (awaryjny).

Paczka jest budowana od nowa z aktualnych plików strony, więc po każdej zmianie wystarczy ponownie uruchomić skrypt.

---

# Etap 2: edycja tekstów przez kliknięcie na stronie

Motyw ma wbudowany prosty edytor. Zalogowany użytkownik z prawem edycji stron (administrator, redaktor) widzi na dole po lewej czerwony przycisk
**„Edytuj teksty”**. Po jego kliknięciu teksty na stronie stają się edytowalne: klikasz w tekst i piszesz, a zmiany zapisujesz przyciskiem.

## Aktualizacja motywu do wersji z edytorem

1. **Wygląd, Motywy, Dodaj nowy, Wyślij motyw na serwer**, wybierz nowy `djblazej-theme.zip`. WordPress napisze, że taki motyw już jest, i zaproponuje
   **„Zastąp aktywny wgranym”** (Replace active with uploaded). Kliknij to.
   (Jeśli wgrywanie zipa nie działa: rozpakuj go i skopiuj folder `djblazej` do `wp-content/themes/` z zastąpieniem plików.)
2. Odśwież stronę (Ctrl+F5).

## Jak edytować

1. Zaloguj się do panelu i otwórz stronę (np. `/studniowki/`).
2. Kliknij **„Edytuj teksty”**. Edytowalne teksty dostają czerwony, przerywany obrys.
3. Kliknij w tekst i zmień go. Dozwolone: pogrubienie (**Ctrl+B**), kursywa (**Ctrl+I**), nowa linia (**Enter**). Wklejany tekst jest zwykły, bez obcego formatowania.
4. Kliknij **„Zapisz zmiany”** (w nawiasie liczba zmienionych tekstów). Pojawi się „Zapisano.”.
5. **„Przywróć oryginał”** cofa ostatnio klikniętą kratkę do tekstu z projektu. **„Zakończ”** wyłącza tryb edycji (zapyta, jeśli są niezapisane zmiany).
6. Odśwież stronę bez zalogowania (okno incognito), żeby zobaczyć efekt tak, jak widzi go odwiedzający.

## Dobrze wiedzieć

- Zmiana tekstu, który występuje w kilku miejscach strony (np. „Zapytaj o dostępność terminu” na przycisku w hero i w sekcji kontaktu), zmienia go
  wszędzie naraz. Tak jest zamierzone.
- Zmiany leżą w bazie WordPressa (opcja `bb_text_overrides`), a nie w plikach motywu. Aktualizacja motywu ich nie kasuje, a kopia zapasowa bazy je zawiera.
- Edytowalne są nagłówki, akapity, punkty list, podpisy i napisy na przyciskach (łącznie 177 elementów, 151 różnych tekstów na czterech stronach).
- **Tekstów nie edytuje się w:** menu, stopkach, oknie kontaktu ani w tytułach i opisach dla wyszukiwarek. Adresy e-mail i telefon (to linki) oraz zdjęcia
  zmienia się według etapu 3 poniżej.
- Jeśli kiedyś zmienimy tekst w samym projekcie (nie w panelu), zmiana klienta dla tego tekstu może przestać obowiązywać (klucz zależy od treści domyślnej).
  Dlatego po wdrożeniu zmiany tekstów robi klient w panelu, a my zmieniamy kod i wygląd.

---

# Etap 3: zdjęcia i linki

Ten sam edytor (przycisk **„Edytuj teksty, zdjęcia i linki”** na dole po lewej) pozwala teraz zmieniać także zdjęcia i adresy linków.
Po aktualizacji motywu (jak w etapie 2: **Wygląd, Motywy, Dodaj motyw, Wyślij motyw na serwer, Zastąp aktywny wgranym**, potem Ctrl+F5) włącz tryb edycji.

## Zdjęcia

1. W trybie edycji zdjęcia mają **niebieski, przerywany obrys**. Kliknij zdjęcie.
2. W oknie wybierz **„Wgraj z komputera”** (zdjęcie trafia też do biblioteki mediów) albo **„Wybierz z biblioteki mediów”**.
3. Wpisz **opis zdjęcia** (dla osób niewidomych i wyszukiwarek) i kliknij **Zapisz**. **„Przywróć oryginał”** cofa zdjęcie do tego z projektu.
4. Przycisk **„Zdjęcia”** na pasku pokazuje listę wszystkich zdjęć strony. Użyj go dla zdjęć, w które trudno kliknąć, np. **tła nagłówka podstrony**
   (trzy zdjęcia, które płynnie przenikają jedno w drugie) albo zdjęć przykrytych tekstem. Kliknij miniaturę, żeby ją zmienić.
5. Zdjęcia w galerii portfolio (kafelki) zmienia się w oknie **„Galeria”** (etap 4 poniżej), a nie tutaj.

Wskazówki: wybieraj zdjęcia o podobnych proporcjach do wymienianego (strona dopasowuje je kadrem), w dobrej rozdzielczości, ale nie 20-megapikselowe
oryginały (WordPress zmniejsza bardzo duże pliki, mimo to lepiej wgrać zoptymalizowane). Tło nagłówka podstrony to poziome zdjęcia (ok. 3:2,
najlepiej min. 1920 px szerokości). Po podmianie zdjęcia, które miało kilka wersji rozmiarów, strona korzysta z rozmiarów wygenerowanych przez WordPressa.

## Linki

1. Linki bez tekstu (ikony TikTok, Instagram, YouTube, Facebook) i przyciski mają **zielony, przerywany obrys**. Kliknij taki link.
2. Wpisz nowy adres: adres strony (`https://...`), e-mail (`nazwa@domena.pl`, można też `mailto:nazwa@domena.pl?subject=Temat`), telefon (`tel:+48123456789`)
   albo adres podstrony tego serwisu (`/eventy/`). **Zapisz**.
3. Link, który ma też tekst (np. adres e-mail wyświetlony na stronie): **zwykły klik** edytuje tekst, a **Alt + klik** otwiera okno adresu.
4. Przycisk **„Linki”** na pasku pokazuje listę wszystkich linków strony z ich adresami.
5. Zmiana adresu dotyczy wszystkich takich samych linków na stronie (np. adres e-mail w kilku miejscach). Tekst linku zmieniasz osobno, klikając w niego.

## Czego jeszcze nie ma

- **Nie edytują się** logo i monogram w menu i nagłówku, znaczek NikPage w stopce oraz zdjęcie Błażeja w hero (ma osobne wersje dla komputera i telefonu,
  więc wymaga osobnej obsługi). Pozostałe zdjęcia na czterech stronach (w tym tła nagłówków podstron i logotypy mediów) edytować można.
- **Nie można dodawać ani usuwać** całych sekcji i kafelków poza galerią portfolio (galerię obsługuje etap 4).
- Menu, stopki i okno kontaktu zostają bez zmian.
- Zmiany leżą w bazie WordPressa (opcje `bb_text_overrides`, `bb_img_overrides`, `bb_link_overrides`), a nie w plikach motywu.

## Jeśli coś nie działa

- Okno wyboru z biblioteki mediów wygląda dziwnie albo się nie otwiera: użyj **„Wgraj z komputera”** w tym samym oknie (działa niezależnie od biblioteki).
- Zdjęcie się nie zapisuje: odśwież stronę z Ctrl+F5 (po aktualizacji motywu przeglądarka może trzymać stary skrypt) i spróbuj ponownie.
- Wciąż błąd: zrób zrzut ekranu okna i konsoli przeglądarki (F12, zakładka Console) i prześlij.

---

# Etap 4: galeria portfolio (kolejność, dodawanie i usuwanie zdjęć)

Portfolio jest na stronie głównej (186 zdjęć) i na podstronach Eventy, Studniówki i Wedding (po 36). Każda z tych czterech galerii ma własną kolejność
i własny zestaw zdjęć. Aktualizacja motywu jak w poprzednich etapach (**Wygląd, Motywy, Dodaj motyw, Wyślij motyw na serwer, Zastąp aktywny wgranym**,
potem Ctrl+F5). W trybie edycji na pasku jest nowy przycisk **„Galeria”**. Otworzy go także klik w dowolne zdjęcie portfolio na stronie.

## Okno „Galeria”

Pokazuje wszystkie zdjęcia galerii jako równe, ponumerowane kafelki (numer to miejsce w galerii) z podpisem pierwszej kategorii.

- **Zmiana kolejności:** przeciągnij zdjęcie myszą na nowe miejsce (czerwona kreska pokazuje, gdzie wyląduje). Na telefonie przeciągaj za uchwyt ⠿ w rogu
  kafelka, reszta kafelka przewija okno. Z klawiatury: Tab do kafelka i **Alt + strzałka**. Przy długiej galerii wygodniej wpisać **pozycję** (patrz niżej).
- **Klik w zdjęcie** otwiera jego ustawienia: kategorie, opis, zmiana zdjęcia, pozycja, usuwanie.
- **Kategorie** to te same, według których działają zakładki nad galerią. Zdjęcie może mieć kilka kategorii. Podpis pod zdjęciem na stronie głównej
  pochodzi z pierwszej z nich. Zdjęcie bez kategorii widać tylko w zakładce „Wszystko”.
- **Pozycja w galerii:** wpisz numer i kliknij „Gotowe”, albo „Na początek” / „Na koniec”.
- **Zmień zdjęcie:** z komputera albo z biblioteki mediów (podmienia plik, zostawia miejsce i kategorie). „Przywróć oryginalne zdjęcie” cofa podmianę.
- **Usuń z galerii:** zdjęcie znika ze strony (plik w bibliotece mediów zostaje). Usunięte zdjęcia z projektu są pod przyciskiem **„Usunięte”**
  i można je stamtąd przywrócić (wracają na koniec galerii).
- **Dodaj zdjęcia:** zaznacz kategorie dla dodawanych zdjęć, wybierz „na początku” albo „na końcu” i wgraj zdjęcia z komputera (można kilka naraz)
  albo wybierz z biblioteki mediów. Dodane zdjęcia mają zielony znacznik „nowe”.
- **Lista „Wszystkie zdjęcia”** u góry pozwala pokazać tylko jedną kategorię (to tylko podgląd, numery zostają globalne).
- **Zapisz galerię** zapisuje wszystko naraz i odświeża stronę, a tryb edycji włącza się sam. Jeśli w tym samym czasie masz niezapisane zmiany tekstów,
  zapiszą się razem z galerią. Gdy są niezapisane zmiany, „Anuluj” i krzyżyk najpierw pytają, czy je odrzucić.
- **„Przywróć oryginalną galerię”** kasuje wszystkie zmiany w tej galerii (zdjęcia w bibliotece mediów zostają).

## Dobrze wiedzieć

- Siatka na stronie układa kafelki sama: dobiera duże, wysokie i małe pola do orientacji zdjęć (pion, poziom), żeby nie było dziur. Dlatego kolejność
  jest zachowana w przybliżeniu: zdjęcie może stanąć o kilka miejsc obok tego, które wybrałeś. Nie da się ustawić zdjęcia w konkretnym polu siatki.
- Pierwsze 12 zdjęć widać od razu, kolejne dochodzą po kliknięciu „więcej” (na podstronach „Pokaż więcej zdjęć”).
- Przy zmianie zakładki i po kliknięciu „więcej” zdjęcia **płynnie się przesuwają, kurczą i wyrastają** (jak w galerii na dawnej stronie), także te dodane przez Ciebie.
  Zdjęcia o bardzo nietypowych proporcjach (np. panorama 3:1 albo wąskie, bardzo wysokie) strona pokazuje w całości z rozmytym tłem, żeby ich nie przycinać.
- Ta sama strona może też działać **bez WordPressa**, na zwykłym hostingu, z tym samym edytorem (patrz `INSTRUKCJA-HOSTING.md`).
- Dodawane zdjęcia powinny być dobrej jakości, ale nie ogromne (kilka tysięcy pikseli z dłuższego boku wystarczy). Na stronie kafelek pokazuje wersję
  „duża” z WordPressa (do 1024 px), a po kliknięciu otwiera się pełny plik. Zdjęcie pionowe dostanie wysoki kafelek, poziome szeroki.
- **Nie ma jeszcze:** dodawania nowych kategorii (zakładek). Są tylko te, które już istnieją na danej stronie. Nowa zakładka to zmiana w kodzie.
- Zdjęcia z portfolio nie pokazują się już na liście „Zdjęcia” (przycisk obok „Galeria”), bo zmienia się je właśnie tutaj.
- Jeśli w WordPressie działa wtyczka pamięci podręcznej (cache), po zapisie galerii wyczyść jej pamięć, żeby odwiedzający od razu zobaczyli zmiany.
- Zmiany leżą w opcji `bb_galleries` w bazie WordPressa. Aktualizacja motywu ich nie kasuje, ale zdjęcie dodane do motywu w nowej wersji dojdzie
  do galerii na jej koniec, a to usunięte przez Ciebie nie wróci.
