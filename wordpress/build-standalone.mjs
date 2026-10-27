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
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

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

function assemble(dir, withData) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(theme, path.join(dir, 'theme'), { recursive: true });
  fs.cpSync(path.join(src, 'cms'), path.join(dir, 'cms'), { recursive: true });
  fs.copyFileSync(path.join(src, 'index.php'), path.join(dir, 'index.php'));
  fs.copyFileSync(path.join(src, 'htaccess.txt'), path.join(dir, '.htaccess'));
  /* adresy stron: ścieżka => szablon */
  fs.writeFileSync(path.join(dir, 'cms', 'routes.php'), `<?php
/* Adresy stron i ich szablony (z theme/). Wygenerowane przy budowie paczki. */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
return array(
	'/'            => 'front-page',
	'/eventy/'     => 'page-eventy',
	'/studniowki/' => 'page-studniowki',
	'/wedding/'    => 'page-wedding',
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
const mbFull = zip('djblazej-hosting.zip', out, ['.htaccess', 'index.php', 'cms', 'theme', 'data', 'uploads']);

/* 3. aktualizacja: sama strona, bez danych klienta */
assemble(outUpdate, false);
const mbUpdate = zip('djblazej-hosting-aktualizacja.zip', outUpdate, ['.htaccess', 'index.php', 'cms', 'theme']);

console.log(`Gotowe: ${path.join(dist, 'djblazej-hosting.zip')} (${mbFull} MB)`);
console.log(`Gotowe: ${path.join(dist, 'djblazej-hosting-aktualizacja.zip')} (${mbUpdate} MB)`);
console.log(`Kod instalacyjny (też w ${path.join(dist, 'KOD-INSTALACYJNY.txt')}): ${code}`);
