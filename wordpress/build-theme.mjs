/*
 * Budowa motywu WordPressa z aktualnej statycznej strony.
 *
 * Uruchomienie z głównego folderu projektu:   node wordpress/build-theme.mjs
 * Wynik:  wordpress/dist/djblazej/            (gotowy folder motywu)
 *         wordpress/dist/djblazej-theme.zip   (do wgrania w WordPressie: Wygląd > Motywy > Dodaj nowy > Wyślij motyw na serwer)
 *
 * Co robi:
 *  - kopiuje css/, js/ i assets/ (bez assets/source, czyli oryginałów) do motywu,
 *  - z index.html, eventy/, studniowki/ i wedding/ robi szablony PHP (front-page.php, page-eventy.php, page-studniowki.php, page-wedding.php),
 *    zamieniając ścieżki do zasobów na adres motywu, a linki między stronami na adresy WordPressa,
 *  - etap 2, teksty: znajduje w szablonach teksty do edycji (nagłówki, akapity, elementy list, podpisy, napisy na przyciskach i w linkach),
 *    nadaje im znacznik data-bb="klucz" i zastępuje ich treść wywołaniem bb_e( 'klucz' ); teksty domyślne trafiają do inc/texts.json,
 *  - etap 3, zdjęcia i linki: zdjęcia (img z assets/, bez srcset i picture) dostają data-bb-img="klucz", a src, alt i adres powiększenia
 *    (data-src lub href lightboxa) pochodzą z bb_img_src/alt/full( 'klucz' ); linki (http, mailto, tel i adresy stron serwisu) dostają
 *    data-bb-link="klucz", a adres pochodzi z bb_href( 'klucz' ). Wartości domyślne są w inc/images.json i inc/links.json,
 *  - etap 4, galerie portfolio: lista kafelków każdej galerii (strona główna i trzy podstrony) trafia do inc/gallery.json, a w szablonie
 *    zostaje wywołanie bb_gallery( 'id' ), które wypisuje kafelki w kolejności zapisanej przez klienta (z dodanymi i bez usuniętych),
 *  - dodaje wp_head() i wp_footer(), style.css z nagłówkiem motywu, index.php oraz pliki z wordpress/theme-src/
 *    (functions.php, editor.php, edytor js/bb-edit.js i css/bb-edit.css).
 * Pliki źródłowe strony (HTML, CSS, JS) nie są zmieniane, motyw jest zawsze budowany od nowa z ich aktualnej wersji.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'wordpress', 'dist');
const out = path.join(dist, 'djblazej');
const src = path.join(root, 'wordpress', 'theme-src');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'inc'), { recursive: true });

/* ---------- 1. zasoby ---------- */
fs.cpSync(path.join(root, 'css'), path.join(out, 'css'), { recursive: true });
fs.cpSync(path.join(root, 'assets'), path.join(out, 'assets'), {
  recursive: true,
  filter: (p) => !p.replace(/\\/g, '/').includes('/assets/source')
});
fs.mkdirSync(path.join(out, 'js'), { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'js'))) {
  let code = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  /* ścieżka do obrazu krytycznego (preloader) liczona od adresu motywu, bo strona nie leży w katalogu głównym serwera */
  code = code.replace("var critical = ['assets/logo.png'];", "var critical = [(window.BB_BASE || '') + 'assets/logo.png'];");
  fs.writeFileSync(path.join(out, 'js', f), code);
}
fs.copyFileSync(path.join(src, 'bb-edit.js'), path.join(out, 'js', 'bb-edit.js'));
fs.copyFileSync(path.join(src, 'bb-edit.css'), path.join(out, 'css', 'bb-edit.css'));
fs.copyFileSync(path.join(src, 'functions.php'), path.join(out, 'functions.php'));
fs.copyFileSync(path.join(src, 'editor.php'), path.join(out, 'inc', 'editor.php'));
fs.copyFileSync(path.join(src, 'gallery.php'), path.join(out, 'inc', 'gallery.php'));

/* ---------- 2. rozbiór HTML ---------- */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea']);
const CAND = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'figcaption', 'blockquote', 'dt', 'dd']);
const INLINE_OK = new Set(['em', 'strong', 'b', 'i', 'br', 'span', 'small', 'sup', 'sub', 'mark', 'abbr', 'u', 's']);
const EXCL_TAGS = new Set(['nav', 'footer', 'button', 'dialog', 'svg', 'noscript', 'template', 'script', 'style', 'head', 'select', 'option', 'form', 'label']);
/* menu, nagłówek strony, stopka, okno kontaktu, loader, filtry i galeria nie są edytowane jako teksty ani linki;
   dla zdjęć obowiązuje ta sama lista bez galerii i filtrów (zdjęcia w galerii są edytowalne) */
const EXCL_CLASS = /(^|\s)(loader|drawer|menu|menu-sec|hero__side|rail|header|subhead|subfoot|footer|skip|filters|sub-filters|gallery|sub-gallery)(\s|$)/;
const EXCL_CLASS_IMG = /(^|\s)(loader|drawer|menu|menu-sec|hero__side|rail|header|subhead|subfoot|footer|skip)(\s|$)/;

function parse(html) {
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
  const rootNode = { tag: '#root', children: [], attrs: '', parent: null };
  let cur = rootNode;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) {
      const tag = m[1].toLowerCase();
      let n = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (n && n !== rootNode) {
        n.closeStart = m.index;
        n.closeEnd = re.lastIndex;
        cur = n.parent;
      }
      continue;
    }
    if (m[2]) {
      const tag = m[2].toLowerCase();
      const attrs = m[3] || '';
      const node = { tag, attrs, parent: cur, children: [], openStart: m.index, openEnd: re.lastIndex };
      cur.children.push(node);
      if (VOID.has(tag) || /\/\s*$/.test(attrs)) {
        node.closeStart = node.closeEnd = re.lastIndex;
        continue;
      }
      if (RAW.has(tag)) {
        const closeRe = new RegExp('</' + tag + '\\s*>', 'gi');
        closeRe.lastIndex = re.lastIndex;
        const cm = closeRe.exec(html);
        node.closeStart = cm ? cm.index : html.length;
        node.closeEnd = cm ? closeRe.lastIndex : html.length;
        re.lastIndex = node.closeEnd;
        continue;
      }
      cur = node;
    }
  }
  return rootNode;
}

const classOf = (attrs) => (/\bclass\s*=\s*"([^"]*)"/i.exec(attrs) || [])[1] || '';
const noQuotes = (attrs) => attrs.replace(/"[^"]*"|'[^']*'/g, '');
const getAttr = (attrs, name) => {
  const m = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*"([^"]*)"', 'i').exec(attrs);
  return m ? m[1] : null;
};
const hasFlag = (attrs, name) => new RegExp('(^|\\s)' + name + '(\\s|=|$)').test(noQuotes(attrs));
const sha = (s, n) => crypto.createHash('sha1').update(s).digest('hex').slice(0, n);
const stripUp = (p) => p.replace(/^(\.\.\/)+/, '');

function excluded(node, classRe = EXCL_CLASS, allowButton = false, allowAria = false) {
  for (let n = node; n && n.tag !== '#root'; n = n.parent) {
    if (EXCL_TAGS.has(n.tag) && !(allowButton && n.tag === 'button')) return true;
    if ((!allowAria && /\baria-hidden\s*=\s*"true"/.test(n.attrs)) || hasFlag(n.attrs, 'data-no-edit') || hasFlag(n.attrs, 'hidden')) return true;
    if (classRe.test(classOf(n.attrs))) return true;
  }
  return false;
}

/* treść ma zawierać tylko tekst i proste znaczniki w tekście (em, strong, br, span z samą klasą itd.) */
function simpleInline(inner) {
  const tags = inner.replace(/<!--[\s\S]*?-->/g, '').match(/<\/?[a-zA-Z][^>]*>/g) || [];
  for (const t of tags) {
    const name = /^<\/?([a-zA-Z][\w-]*)/.exec(t)[1].toLowerCase();
    if (!INLINE_OK.has(name)) return false;
    if (t.startsWith('</')) continue;
    const attrs = t.replace(/^<[a-zA-Z][\w-]*/, '').replace(/\/?>$/, '').trim();
    if (name === 'span') {
      if (attrs && !/^class="[\w -]+"$/.test(attrs)) return false;
    } else if (attrs) {
      return false;
    }
  }
  return true;
}
const hasLetters = (inner) => (inner.replace(/<[^>]*>/g, ' ').replace(/&[#\w]+;/g, ' ').match(/\p{L}/gu) || []).length >= 2;

/* zmiana atrybutu w znaczniku otwierającym (lub dopisanie go przed zamknięciem) */
function setAttr(tag, name, value) {
  const re = new RegExp('(\\s' + name + '\\s*=\\s*")[^"]*(")', 'i');
  if (re.test(tag)) return tag.replace(re, (m, a, b) => a + value + b);
  return tag.replace(/\s*\/?>$/, (end) => ` ${name}="${value}"` + end);
}

const texts = {};    // klucz -> tekst domyślny (HTML), wspólne dla wszystkich stron
const images = {};   // klucz -> { src, alt, full?, srcset? }
const links = {};    // klucz -> { href, page }
const galleries = {};   // id galerii (home, eventy, studniowki, wedding) -> { kind, cats, fallbackTag, items }
const stats = {};

/* ---------- galerie portfolio (etap 4) ---------- */
const unent = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
/* napisy wersalikami z filtrów (WEDDING) zamieniamy na normalny zapis (Wedding) */
const titleCase = (s) => (s === s.toLocaleUpperCase('pl') && s !== s.toLocaleLowerCase('pl')
  ? s.toLocaleLowerCase('pl').replace(/(^|[\s&-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('pl'))
  : s);
const capitalize = (s) => s.charAt(0).toLocaleUpperCase('pl') + s.slice(1);

/* nazwy kategorii (slug -> napis) ze wszystkich stron: z przycisków filtrów i z podpisów kafelków */
const PAGE_FILES = ['index.html', 'eventy/index.html', 'studniowki/index.html', 'wedding/index.html'];
const slugLabel = {};   // napis z filtra, np. wesela -> Wedding
const slugTag = {};     // podpis na kafelku, np. wesela -> Wesela
for (const f of PAGE_FILES) {
  const t = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of t.matchAll(/<button\b[^>]*\bdata-filter="([^"]+)"[^>]*>([^<]*)<\/button>/g)) {
    if (m[1] !== 'all' && !slugLabel[m[1]]) slugLabel[m[1]] = titleCase(unent(m[2].trim()));
  }
  for (const m of t.matchAll(/<li class="gallery__item" data-cat="([^"]*)"(?:(?!<\/li>)[\s\S])*?<span class="gallery__tag">([^<]*)<\/span>/g)) {
    const first = m[1].split(' ')[0];
    if (first && !slugTag[first]) slugTag[first] = unent(m[2].trim());
  }
}

/* Lista kafelków galerii trafia do inc/gallery.json, a w szablonie zostaje wywołanie bb_gallery( 'id' ).
   Dzięki temu da się zmieniać kolejność, dodawać i usuwać zdjęcia oraz ich kategorie. */
function extractGallery(ul, gid, html) {
  const home = /(^|\s)gallery(\s|$)/.test(classOf(ul.attrs));   // „gallery” (strona główna: button + podpis) albo „sub-gallery” (podstrony: a)
  const find = (n, tag) => {
    for (const c of n.children) {
      if (c.tag === tag) return c;
      const r = find(c, tag);
      if (r) return r;
    }
    return null;
  };
  const items = [];
  const seen = new Set();
  const used = [];                    // kategorie w kolejności pojawiania się
  const tagCount = {};
  for (const li of ul.children.filter((c) => c.tag === 'li')) {
    const host = find(li, home ? 'button' : 'a');
    const img = find(li, 'img');
    if (!host || !img) throw new Error('Nietypowy kafelek galerii w ' + gid);
    const clean = stripUp(getAttr(img.attrs, 'src') || '');
    const alt = getAttr(img.attrs, 'alt') || '';
    let key = 'g' + sha(clean + '|' + alt, 9);
    for (let n = 2; seen.has(key); n++) key = 'g' + sha(clean + '|' + alt + '|' + n, 9);
    seen.add(key);
    const rec = { src: clean, alt };
    const fullRaw = getAttr(host.attrs, home ? 'data-src' : 'href');
    if (fullRaw && /^(\.\.\/)*assets\//.test(fullRaw)) rec.full = stripUp(fullRaw);
    const prev = images[key];
    if (prev && JSON.stringify(prev) !== JSON.stringify(rec)) throw new Error('Kolizja klucza zdjęcia galerii ' + key);
    images[key] = rec;
    const cat = getAttr(li.attrs, 'data-cat') || '';
    const it = { k: key, cat, w: Number(getAttr(img.attrs, 'width')), h: Number(getAttr(img.attrs, 'height')) };
    cat.split(' ').filter(Boolean).forEach((c) => { if (!used.includes(c)) used.push(c); });
    if (home) {
      it.ar = getAttr(li.attrs, 'data-ar') || '';
      it.caption = unent(getAttr(host.attrs, 'data-caption') || '');
      const sp = find(li, 'span');
      it.tag = sp ? unent(html.slice(sp.openEnd, sp.closeStart).trim()) : '';
      if (!cat) tagCount[it.tag] = (tagCount[it.tag] || 0) + 1;
    }
    items.push(it);
  }
  /* kategorie: najpierw przyciski filtrów tej strony, potem pozostałe, które występują na kafelkach */
  const filterSlugs = [...html.matchAll(/<button\b[^>]*\bdata-filter="([^"]+)"[^>]*>/g)].map((m) => m[1]).filter((s) => s !== 'all');
  const slugs = [...new Set([...filterSlugs, ...used])];
  const cats = slugs.map((slug) => {
    if (!/^[a-z0-9_-]+$/.test(slug)) throw new Error('Niedozwolony slug kategorii: ' + slug);
    const nice = slugLabel[slug] || slugTag[slug] || capitalize(slug);
    return { slug, label: nice, tag: slugTag[slug] || nice };
  });
  const fallbackTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).map((e) => e[0])[0] || '';
  galleries[gid] = { kind: home ? 'home' : 'sub', cats, fallbackTag, items };
  return items.length;
}

function markEditable(html, label) {
  const tree = parse(html);
  const ops = new Map();   // węzeł -> { set: { atrybut: wartość }, inner: klucz | null }
  const opOf = (node) => {
    if (!ops.has(node)) ops.set(node, { set: {}, inner: null });
    return ops.get(node);
  };
  const count = { texts: 0, images: 0, links: 0 };

  (function visit(node) {
    for (const child of node.children) {
      const tag = child.tag;
      let descend = true;

      /* --- galeria portfolio: cała lista kafelków jest generowana z danych (bb_gallery) --- */
      if (tag === 'ul' && /(^|\s)(sub-)?gallery(\s|$)/.test(classOf(child.attrs)) && child.closeStart !== undefined) {
        const gid = label === 'front-page.php' ? 'home' : label.replace(/^page-|\.php$/g, '');
        count.gallery = extractGallery(child, gid, html);
        const gop = opOf(child);
        gop.set['data-bb-gallery'] = gid;
        gop.innerRaw = `{{BBG:${gid}}}`;
        continue;
      }

      /* --- teksty --- */
      const isSpanInBtn = tag === 'span' && child.parent && child.parent.tag === 'a' && /(^|\s)btn(\s|$)/.test(classOf(child.parent.attrs));
      const isTextLink = tag === 'a' && getAttr(child.attrs, 'href') !== null;
      if (child.closeStart !== undefined && (CAND.has(tag) || isSpanInBtn || isTextLink) && !excluded(child)) {
        const inner = html.slice(child.openEnd, child.closeStart);
        if (simpleInline(inner) && hasLetters(inner)) {
          const def = inner.replace(/\s+/g, ' ').trim();
          const key = sha(def, 10);
          if (texts[key] !== undefined && texts[key] !== def) throw new Error('Kolizja klucza tekstu ' + key);
          texts[key] = def;
          const op = opOf(child);
          op.set['data-bb'] = key;
          op.inner = key;
          count.texts++;
          descend = false;
        }
      }

      /* --- linki --- */
      if (tag === 'a' && !excluded(child)) {
        const href = getAttr(child.attrs, 'href');
        if (href && !hasFlag(child.attrs, 'data-lb') && !href.startsWith('#')) {
          let norm = null, page = false, m;
          if ((m = /^(?:\.\.\/)?(eventy|studniowki|wedding)\/$/.exec(href))) { norm = '/' + m[1] + '/'; page = true; }
          else if (/^\.\.\/$/.test(href)) { norm = '/'; page = true; }
          else if ((m = /^\.\.\/(#[\w-]+)$/.exec(href))) { norm = '/' + m[1]; page = true; }
          else if (/^(https?:|mailto:|tel:)/i.test(href)) { norm = href; }
          if (norm) {
            const key = 'l' + sha(norm, 9);
            links[key] = { href: norm, page };
            const op = opOf(child);
            op.set.href = `{{BBL:${key}}}`;
            op.set['data-bb-link'] = key;
            count.links++;
          }
        }
      }

      /* --- zdjęcia --- */
      if (tag === 'img') {
        const s = getAttr(child.attrs, 'src');
        let inPicture = false;
        for (let n = child.parent; n; n = n.parent) if (n.tag === 'picture') inPicture = true;
        if (s && /^(\.\.\/)*assets\//.test(s) && !/\.svg(\?|$)/i.test(s) && !inPicture && !excluded(child, EXCL_CLASS_IMG, true, true)) {
          const clean = stripUp(s);
          const alt = getAttr(child.attrs, 'alt') || '';
          const key = 'i' + sha(clean + '|' + alt, 9);
          const rec = { src: clean, alt };
          const ss = getAttr(child.attrs, 'srcset');
          if (ss) rec.srcset = ss.split(',').map((x) => stripUp(x.trim())).filter(Boolean).join(', ');
          /* miniatura w galerii: element z data-lb (a: href, button: data-src) trzyma duży plik do powiększenia */
          for (let n = child.parent, i = 0; n && i < 4; n = n.parent, i++) {
            if (hasFlag(n.attrs, 'data-lb')) {
              const attr = n.tag === 'a' ? 'href' : 'data-src';
              const full = getAttr(n.attrs, attr);
              if (full && /^(\.\.\/)*assets\//.test(full)) {
                rec.full = stripUp(full);
                opOf(n).set[attr] = `{{BBF:${key}}}`;
              }
              break;
            }
          }
          images[key] = rec;
          const op = opOf(child);
          op.set.src = `{{BBI:${key}}}`;
          op.set.alt = `{{BBA:${key}}}`;
          if (rec.srcset) op.set.srcset = `{{BBS:${key}}}`;
          op.set['data-bb-img'] = key;
          count.images++;
        }
      }

      if (descend) visit(child);
    }
  })(tree);

  const list = [...ops.entries()].sort((a, b) => b[0].openStart - a[0].openStart);
  let h = html;
  for (const [node, op] of list) {
    let open = h.slice(node.openStart, node.openEnd);
    for (const [name, value] of Object.entries(op.set)) open = setAttr(open, name, value);
    if (op.innerRaw) {
      h = h.slice(0, node.openStart) + open + op.innerRaw + h.slice(node.closeStart);
    } else if (op.inner) {
      h = h.slice(0, node.openStart) + open + `{{BB:${op.inner}}}` + h.slice(node.closeStart);
    } else {
      h = h.slice(0, node.openStart) + open + h.slice(node.openEnd);
    }
  }
  stats[label] = count;
  return h;
}

/* ---------- 3. szablony ---------- */
const toPhp = (html) => {
  let h = html;
  h = h.replace('<html lang="pl">', '<html <?php language_attributes(); ?>>');
  /* adres motywu dla skryptów (preloader); wp_head() na końcu nagłówka */
  h = h.replace('</head>', '  <script>window.BB_BASE = "<?php echo esc_url( $bb ); ?>/";</script>\n  <?php wp_head(); ?>\n</head>');
  h = h.replace('</body>', '  <?php wp_footer(); ?>\n</body>');
  /* zasoby: assets/, css/, js/ (z ../ lub bez) */
  h = h.replace(/(["'(\s,])(?:\.\.\/)?assets\//g, '$1<?php echo $bb; ?>/assets/');
  h = h.replace(/(href|src)="(?:\.\.\/)?(css|js)\//g, '$1="<?php echo $bb; ?>/$2/');
  /* linki między stronami: adresy WordPressa */
  h = h.replace(/href="(?:\.\.\/)?(eventy|studniowki|wedding)\/"/g, 'href="<?php echo esc_url( home_url( \'/$1/\' ) ); ?>"');
  h = h.replace(/href="\.\.\/(#[\w-]*)?"/g, (m, hash) => `href="<?php echo esc_url( home_url( '/${hash || ''}' ) ); ?>"`);
  /* teksty, zdjęcia i linki edytowalne */
  h = h.replace(/\{\{BB:([0-9a-f]{10})\}\}/g, "<?php bb_e( '$1' ); ?>");
  h = h.replace(/\{\{BBI:([a-z0-9]{10})\}\}/g, "<?php bb_img_src( '$1' ); ?>");
  h = h.replace(/\{\{BBA:([a-z0-9]{10})\}\}/g, "<?php bb_img_alt( '$1' ); ?>");
  h = h.replace(/\{\{BBG:(home|eventy|studniowki|wedding)\}\}/g, "<?php bb_gallery( '$1' ); ?>");
  h = h.replace(/\{\{BBS:([a-z0-9]{10})\}\}/g, "<?php bb_img_srcset( '$1' ); ?>");
  h = h.replace(/\{\{BBF:([a-z0-9]{10})\}\}/g, "<?php bb_img_full( '$1' ); ?>");
  h = h.replace(/\{\{BBL:([a-z0-9]{10})\}\}/g, "<?php bb_href( '$1' ); ?>");
  return '<?php $bb = get_template_directory_uri(); ?><!doctype html>' + h.replace(/^<!doctype html>\s*/i, '\n');
};
const pages = [
  ['index.html', 'front-page.php'],
  ['eventy/index.html', 'page-eventy.php'],
  ['studniowki/index.html', 'page-studniowki.php'],
  ['wedding/index.html', 'page-wedding.php']
];
for (const [file, dst] of pages) {
  const marked = markEditable(fs.readFileSync(path.join(root, file), 'utf8'), dst);
  const php = toPhp(marked);
  const open = (php.match(/<\?php/g) || []).length, close = (php.match(/\?>/g) || []).length;
  if (open !== close) throw new Error(`Niezgodna liczba <?php (${open}) i ?> (${close}) w ${dst}`);
  if (/\{\{BB/.test(php)) throw new Error('Nieprzetworzony znacznik w ' + dst);
  fs.writeFileSync(path.join(out, dst), php);
}
fs.writeFileSync(path.join(out, 'inc', 'texts.json'), JSON.stringify(texts, null, 1));
fs.writeFileSync(path.join(out, 'inc', 'images.json'), JSON.stringify(images, null, 1));
fs.writeFileSync(path.join(out, 'inc', 'links.json'), JSON.stringify(links, null, 1));
fs.writeFileSync(path.join(out, 'inc', 'gallery.json'), JSON.stringify(galleries, null, 1));

/* ---------- 4. pozostałe pliki motywu ---------- */
fs.writeFileSync(path.join(out, 'style.css'), `/*
Theme Name: DJ Błażej Biurkowski
Theme URI: https://djblazej.pl
Author: NikPage
Description: Motyw strony DJ Błażej Biurkowski. Strona 1:1 z edycją tekstów, zdjęć, linków i galerii portfolio przez kliknięcie na stronie (przycisk „Edytuj teksty” dla zalogowanych). Style strony są w css/style.css.
Version: 0.4.0
Requires at least: 6.3
Requires PHP: 7.4
Text Domain: djblazej
*/
`);

fs.writeFileSync(path.join(out, 'index.php'), `<?php
/**
 * Awaryjny szablon (np. gdy nie ma strony o pasującym adresie).
 * Właściwe strony: front-page.php (strona główna), page-eventy.php, page-studniowki.php, page-wedding.php.
 */
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title><?php bloginfo( 'name' ); ?></title>
	<?php wp_head(); ?>
</head>
<body>
	<main style="font-family: sans-serif; max-width: 40rem; margin: 20vh auto; padding: 0 1rem;">
		<h1>Nie ma takiej strony</h1>
		<p>Motyw DJ Błażej: utwórz strony o adresach <code>eventy</code>, <code>studniowki</code> i <code>wedding</code> (Strony, Dodaj nową). <a href="<?php echo esc_url( home_url( '/' ) ); ?>">Wróć na stronę główną</a>.</p>
	</main>
	<?php wp_footer(); ?>
</body>
</html>
`);

/* ---------- 5. paczka ZIP (tar z systemu Windows tworzy poprawne ścieżki z ukośnikami) ---------- */
if (process.platform === 'win32') {
  execFileSync('C:\\Windows\\System32\\tar.exe', ['-a', '-c', '-f', path.join(dist, 'djblazej-theme.zip'), '-C', dist, 'djblazej'], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-rq', path.join(dist, 'djblazej-theme.zip'), 'djblazej'], { cwd: dist, stdio: 'inherit' });
}
const mb = (fs.statSync(path.join(dist, 'djblazej-theme.zip')).size / 1048576).toFixed(1);
console.log('Edytowalne elementy na stronach:', JSON.stringify(stats));
console.log('Unikalne: teksty', Object.keys(texts).length, '| zdjęcia', Object.keys(images).length, '| linki', Object.keys(links).length);
console.log(`Gotowe: ${path.join(dist, 'djblazej-theme.zip')} (${mb} MB)`);
