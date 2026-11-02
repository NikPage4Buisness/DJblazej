/*
 * Paczka strony na zwykły hosting PHP (bez WordPressa), z edycją na stronie.
 *
 * Uruchomienie z głównego folderu projektu:   node wordpress/build-standalone.mjs
 *
 * Najpierw buduje motyw (wordpress/build-theme.mjs: szablony, edytor i galeria), a potem dokłada do niego lekką warstwę
 * z wordpress/standalone/ (index.php, cms/: logowanie, zapis zmian, wgrywanie zdjęć), która zastępuje WordPressa.
 * Te same szablony i ten sam edytor działają więc w obu wersjach.
 *
 * Wynik w wordpress/dist/:
 *   djblazej-hosting.zip               pierwsze wdrożenie (cała strona, puste dane, kod instalacyjny)
 *   djblazej-hosting-aktualizacja.zip  aktualizacja istniejącej strony (bez data/ i uploads/, więc nie kasuje zmian klienta)
 *   KOD-INSTALACYJNY.txt               kod do założenia konta w /admin po pierwszym wgraniu (NIE jest w paczce)
 *   sprawdz-hosting-<losowe>.php       jednorazowy skrypt do sprawdzenia hostingu przed wdrożeniem (NIE jest w paczce)
 *
 * W paczce są też: sitemap.xml i robots.txt (adres strony: zmienna SITE_URL) oraz przekierowania ze starych adresów
 * poprzedniej strony na WordPressie (lista w wordpress/redirects.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { exact as REDIRECTS_EXACT, rules as REDIRECT_RULES } from './redirects.mjs';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'wordpress', 'dist');
const theme = path.join(dist, 'djblazej');
const src = path.join(root, 'wordpress', 'standalone');
const out = path.join(dist, 'standalone');
const outUpdate = path.join(dist, 'standalone-update');

/* 1. motyw (szablony, edytor, galeria) */
execFileSync(process.execPath, [path.join(root, 'wordpress', 'build-theme.mjs')], { stdio: 'inherit' });
if (!fs.existsSync(path.join(theme, 'front-page.php'))) throw new Error('Brak zbudowanego motywu w ' + theme);

const GUARD = '<?php http_response_code( 404 ); exit; ?>\n';

/* Adres strony po wdrożeniu (do sitemap.xml i robots.txt), bez ścieżki. Inny adres: SITE_URL=https://www.djblazej.pl node wordpress/build-standalone.mjs */
const SITE_URL = (process.env.SITE_URL || 'https://djblazej.pl').replace(/\/+$/, '');
if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(SITE_URL)) throw new Error('SITE_URL musi być adresem bez ścieżki, np. https://djblazej.pl (jest: ' + SITE_URL + ')');

/* strony: adres => szablon w theme/ (routes.php) i plik źródłowy w repozytorium (sprawdzamy w nim noindex) */
const PAGES = [
  ['/', 'front-page', 'index.html'],
  ['/eventy/', 'page-eventy', 'eventy/index.html'],
  ['/studniowki/', 'page-studniowki', 'studniowki/index.html'],
  ['/wedding/', 'page-wedding', 'wedding/index.html'],
  ['/referencje-dj-blazej/', 'page-referencje-dj-blazej', 'referencje-dj-blazej/index.html'],
  ['/polityka-prywatnosci-i-plikow-cookies/', 'page-polityka-prywatnosci-i-plikow-cookies', 'polityka-prywatnosci-i-plikow-cookies/index.html']
];

/* Mapa strony zawiera tylko strony, które wyszukiwarki mają indeksować: te z <meta name="robots" content="noindex"> (np. szkice
   czekające na akceptację) są pomijane, żeby sitemap nie przeczyła samej stronie. Po zdjęciu noindex wystarczy zbudować paczkę ponownie. */
const hasNoindex = (file) => (fs.readFileSync(path.join(root, file), 'utf8').split('</head>')[0].match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/gi) || []).some((m) => /noindex/i.test(m));
const indexable = PAGES.filter(([, , file]) => !hasNoindex(file)).map(([route]) => route);
const skipped = PAGES.filter(([, , file]) => hasNoindex(file)).map(([route]) => route);
const sitemap = indexable.length
  ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map((r) => `  <url><loc>${SITE_URL}${r}</loc></url>`).join('\n')}\n</urlset>\n`
  : '';
/* Bez Disallow dla /admin: strony panelu mają własny noindex, a zablokowanie ich w robots.txt uniemożliwiłoby wyszukiwarkom jego odczytanie. */
const robots = `User-agent: *\nAllow: /\n${sitemap ? `\nSitemap: ${SITE_URL}/sitemap.xml\n` : ''}`;
const rootFiles = ['.htaccess', 'index.php', 'robots.txt', ...(sitemap ? ['sitemap.xml'] : [])];

/* Przekierowania ze starych adresów (wordpress/redirects.mjs). Sprawdzamy listę przy budowie: cel musi istnieć w nowym serwisie,
   adresy mają mieć postać znormalizowaną (małe litery, ukośnik na końcu), a wyrażenia muszą się kompilować. */
const TARGETS = new Set([...PAGES.map(([route]) => route), '/sitemap.xml']);
const normKey = (p) => {
  const k = p.toLowerCase().replace(/\/{2,}/g, '/');
  const last = k.slice(k.lastIndexOf('/') + 1);
  return last && !last.includes('.') ? k + '/' : k;
};
const checkTarget = (to, what) => {
  if (!to.startsWith('/') || !TARGETS.has(to.split('#')[0] || '/')) throw new Error(`Przekierowanie ${what}: cel ${to} nie jest stroną nowego serwisu (${[...TARGETS].join(', ')})`);
};
const phpStr = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const exactPhp = [];
for (const [from, to] of Object.entries(REDIRECTS_EXACT)) {
  if (from !== normKey(from)) throw new Error(`Przekierowanie: adres ${from} ma mieć małe litery i ukośnik na końcu (${normKey(from)})`);
  if (PAGES.some(([route]) => route === from)) throw new Error(`Przekierowanie: ${from} jest stroną nowego serwisu, nie wpisujemy go`);
  checkTarget(to, from);
  exactPhp.push(`\t\t${phpStr(from)} => ${phpStr(to)},`);
}
const rulesPhp = [];
for (const { match, to } of REDIRECT_RULES) {
  if (match.includes('~')) throw new Error(`Przekierowanie: wyrażenie ${match} nie może zawierać znaku ~`);
  new RegExp(match); // błąd składni przerwie budowanie
  checkTarget(to, match);
  rulesPhp.push(`\t\tarray( ${phpStr('~' + match + '~i')}, ${phpStr(to)} ),`);
}
const redirectsPhp = `<?php
/* Przekierowania 301 ze starych adresów i z drugiego wariantu domeny. Wygenerowane przy budowie paczki z wordpress/redirects.mjs. */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
return array(
	'site'  => ${phpStr(SITE_URL)},
	'exact' => array(
${exactPhp.join('\n')}
	),
	'rules' => array(
${rulesPhp.join('\n')}
	),
);
`;
/* Wymuszenie https w .htaccess (tylko gdy adres strony jest https); drugi wariant domeny (www) obsługuje index.php */
const FORCE_HTTPS = SITE_URL.startsWith('https://')
  ? '  # Adres tylko przez https (drugi wariant domeny, www, obsługuje index.php)\n  RewriteCond %{HTTPS} !=on\n  RewriteCond %{HTTP:X-Forwarded-Proto} !https\n  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\n'
  : '';

function assemble(dir, withData) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(theme, path.join(dir, 'theme'), { recursive: true });
  fs.cpSync(path.join(src, 'cms'), path.join(dir, 'cms'), { recursive: true });
  fs.copyFileSync(path.join(src, 'index.php'), path.join(dir, 'index.php'));
  fs.writeFileSync(path.join(dir, '.htaccess'), fs.readFileSync(path.join(src, 'htaccess.txt'), 'utf8').replace('{{FORCE_HTTPS}}', () => FORCE_HTTPS));
  /* druga warstwa ochrony: pliki PHP z cms/ i theme/ nie mogą być otwierane bezpośrednio z internetu */
  for (const d of ['cms', 'theme']) fs.copyFileSync(path.join(src, 'php-deny-htaccess.txt'), path.join(dir, d, '.htaccess'));
  fs.writeFileSync(path.join(dir, 'cms', 'redirects.php'), redirectsPhp);
  fs.writeFileSync(path.join(dir, 'robots.txt'), robots);
  if (sitemap) fs.writeFileSync(path.join(dir, 'sitemap.xml'), sitemap);
  /* adresy stron: ścieżka => szablon */
  fs.writeFileSync(path.join(dir, 'cms', 'routes.php'), `<?php
/* Adresy stron i ich szablony (z theme/). Wygenerowane przy budowie paczki. */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
return array(
${PAGES.map(([route, tpl]) => `\t${`'${route}'`.padEnd(15)}=> '${tpl}',`).join('\n')}
);
`);
  if (withData) {
    for (const d of ['data', 'uploads']) {
      fs.mkdirSync(path.join(dir, d), { recursive: true });
      fs.writeFileSync(path.join(dir, d, 'index.html'), '');
    }
    fs.copyFileSync(path.join(src, 'data-htaccess.txt'), path.join(dir, 'data', '.htaccess'));
    fs.copyFileSync(path.join(src, 'uploads-htaccess.txt'), path.join(dir, 'uploads', '.htaccess'));
  }
}

function zip(zipName, dir, entries) {
  const zipPath = path.join(dist, zipName);
  fs.rmSync(zipPath, { force: true });
  if (process.platform === 'win32') {
    execFileSync('C:\\Windows\\System32\\tar.exe', ['-a', '-c', '-f', zipPath, '-C', dir, ...entries], { stdio: 'inherit' });
  } else {
    execFileSync('zip', ['-rq', zipPath, ...entries], { cwd: dir, stdio: 'inherit' });
  }
  return (fs.statSync(zipPath).size / 1048576).toFixed(1);
}

/* 2. pierwsze wdrożenie: z pustymi folderami data/ i uploads/ oraz kodem instalacyjnym */
assemble(out, true);
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const raw = Array.from(crypto.randomBytes(16), (b) => alphabet[b % alphabet.length]).join('');
const code = raw.match(/.{4}/g).join('-');
fs.writeFileSync(path.join(out, 'data', 'setup.php'), GUARD + JSON.stringify({ hash: crypto.createHash('sha256').update(code).digest('hex') }));
fs.writeFileSync(path.join(dist, 'KOD-INSTALACYJNY.txt'), `Kod instalacyjny do założenia konta w /admin (po pierwszym wgraniu strony na hosting):\n\n${code}\n\nKod działa tylko przy tej paczce (djblazej-hosting.zip) i przestaje być potrzebny po założeniu konta. Nie wysyłaj go klientowi razem z paczką.\n`);
const mbFull = zip('djblazej-hosting.zip', out, [...rootFiles, 'cms', 'theme', 'data', 'uploads']);

/* 3. aktualizacja: sama strona, bez danych klienta */
assemble(outUpdate, false);
const mbUpdate = zip('djblazej-hosting-aktualizacja.zip', outUpdate, [...rootFiles, 'cms', 'theme']);

/* 4. jednorazowy skrypt sprawdzający hosting (poza paczką); nazwa losowa, żeby nikt jej nie zgadł, gdy plik chwilę leży na serwerze */
for (const f of fs.readdirSync(dist)) if (/^sprawdz-hosting-[0-9a-f]+\.php$/.test(f)) fs.rmSync(path.join(dist, f));
const probeName = `sprawdz-hosting-${crypto.randomBytes(6).toString('hex')}.php`;
fs.copyFileSync(path.join(root, 'wordpress', 'narzedzia', 'sprawdz-hosting.php'), path.join(dist, probeName));

console.log(`Przekierowania ze starych adresów: ${exactPhp.length} dokładnych + ${rulesPhp.length} reguł (wordpress/redirects.mjs), adres docelowy ${SITE_URL}${FORCE_HTTPS ? ', wymuszony https' : ''}`);
console.log(`Skrypt sprawdzający hosting: ${path.join(dist, probeName)}`);
console.log(`Mapa strony (${SITE_URL}/sitemap.xml): ${indexable.length ? indexable.join(' ') : 'brak stron do zaindeksowania, pliku nie ma w paczce'}`);
if (skipped.length) console.log(`  pominięte (noindex w HTML): ${skipped.join(' ')}`);
console.log(`Gotowe: ${path.join(dist, 'djblazej-hosting.zip')} (${mbFull} MB)`);
console.log(`Gotowe: ${path.join(dist, 'djblazej-hosting-aktualizacja.zip')} (${mbUpdate} MB)`);
console.log(`Kod instalacyjny (też w ${path.join(dist, 'KOD-INSTALACYJNY.txt')}): ${code}`);
