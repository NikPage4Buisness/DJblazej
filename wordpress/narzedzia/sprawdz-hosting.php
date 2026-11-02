<?php
/**
 * Sprawdzenie hostingu przed wdrożeniem strony (wersja bez WordPressa).
 *
 * Jak użyć: wgraj ten plik do folderu domeny (tam, gdzie ma stanąć strona, np. domains/djblazej.pl/public_html),
 * otwórz go w przeglądarce (https://domena.pl/nazwa-tego-pliku.php) i skopiuj wynik. Plik sam się po tym usuwa
 * (żeby go zostawić do ponownego uruchomienia, dopisz do adresu ?zostaw=1).
 *
 * Sprawdza to, czego potrzebuje strona: wersję PHP, GD z WebP, exif, limity wgrywania, zapis plików, HTTPS oraz to, czy serwer
 * stosuje reguły .htaccess (przepisywanie adresów), robiąc próbę na tymczasowym podfolderze. Niczego poza własnym plikiem
 * i tym podfolderem (usuwanym od razu) nie zmienia. Napisany tak, żeby uruchomił się nawet na starym PHP i powiedział, że jest za stary.
 */
header( 'Content-Type: text/html; charset=UTF-8' );
header( 'Cache-Control: no-store' );
header( 'X-Robots-Tag: noindex, nofollow' );
if ( function_exists( 'set_time_limit' ) ) {
	@set_time_limit( 60 );
}

$GLOBALS['bb_rows'] = array();
function bb_add( $status, $name, $detail ) {
	$GLOBALS['bb_rows'][] = array( $status, $name, $detail );
}
function bb_bytes( $v ) {
	$v = trim( (string) $v );
	if ( '' === $v ) {
		return 0;
	}
	if ( '-1' === $v ) {
		return -1;
	}
	$n = (float) $v;
	$u = strtolower( substr( $v, -1 ) );
	if ( 'g' === $u ) {
		$n *= 1073741824;
	} elseif ( 'm' === $u ) {
		$n *= 1048576;
	} elseif ( 'k' === $u ) {
		$n *= 1024;
	}
	return $n;
}
function bb_h( $s ) {
	return htmlspecialchars( (string) $s, ENT_QUOTES, 'UTF-8' );
}
/** Zapytanie do własnej domeny (bez podążania za przekierowaniami). Zwraca array( kod HTTP, treść ) albo null, gdy się nie udało. */
function bb_probe_fetch( $url ) {
	$code = 0;
	$body = false;
	if ( function_exists( 'curl_init' ) ) {
		$ch = curl_init( $url );
		curl_setopt_array( $ch, array( CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0, CURLOPT_FOLLOWLOCATION => false, CURLOPT_USERAGENT => 'sprawdz-hosting' ) );
		$body = curl_exec( $ch );
		$code = (int) curl_getinfo( $ch, CURLINFO_HTTP_CODE );
		curl_close( $ch );
	} elseif ( ini_get( 'allow_url_fopen' ) ) {
		$ctx  = stream_context_create( array( 'http' => array( 'timeout' => 10, 'ignore_errors' => true, 'follow_location' => 0 ), 'ssl' => array( 'verify_peer' => false, 'verify_peer_name' => false ) ) );
		$body = @file_get_contents( $url, false, $ctx );
		if ( isset( $http_response_header[0] ) && preg_match( '#\s(\d{3})\s#', $http_response_header[0], $m ) ) {
			$code = (int) $m[1];
		}
	}
	return ( false !== $body && null !== $body && $code > 0 ) ? array( $code, (string) $body ) : null;
}

/* 1. PHP */
$ver = defined( 'PHP_VERSION_ID' ) ? PHP_VERSION_ID : 0;
if ( $ver >= 80000 ) {
	bb_add( 'ok', 'Wersja PHP', PHP_VERSION . ' (zalecana, wystarcza z zapasem)' );
} elseif ( $ver >= 70400 ) {
	bb_add( 'warn', 'Wersja PHP', PHP_VERSION . ' (strona zadziała, ale ta wersja nie ma już wsparcia: jeśli panel pozwala, wybierz 8.x)' );
} else {
	bb_add( 'bad', 'Wersja PHP', PHP_VERSION . ' (za stara: strona wymaga PHP 7.4 lub nowszego; zmień wersję w panelu hostingu, w sekcji wyboru PHP)' );
}
bb_add( 'info', 'Serwer', ( isset( $_SERVER['SERVER_SOFTWARE'] ) ? $_SERVER['SERVER_SOFTWARE'] : 'brak informacji' ) . ', tryb PHP: ' . PHP_SAPI );
bb_add( 'info', 'Domena i folder', ( isset( $_SERVER['HTTP_HOST'] ) ? $_SERVER['HTTP_HOST'] : '?' ) . ' w folderze ' . __DIR__ . ' (sprawdź, że to folder właściwej domeny)' );

/* 2. HTTPS */
$https = ( ! empty( $_SERVER['HTTPS'] ) && 'off' !== strtolower( (string) $_SERVER['HTTPS'] ) )
	|| ( isset( $_SERVER['SERVER_PORT'] ) && 443 === (int) $_SERVER['SERVER_PORT'] )
	|| ( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && 'https' === strtolower( (string) $_SERVER['HTTP_X_FORWARDED_PROTO'] ) );
if ( $https ) {
	bb_add( 'ok', 'HTTPS', 'ta strona została otwarta przez https' );
} else {
	bb_add( 'warn', 'HTTPS', 'otwarto przez zwykłe http: logowanie do panelu powinno działać tylko przez https (włącz certyfikat i przekierowanie na https w panelu hostingu)' );
}

/* 3. Funkcje potrzebne stronie */
$need    = array( 'json_encode', 'json_decode', 'preg_match', 'hash_hmac', 'hash', 'password_hash', 'password_verify', 'random_bytes', 'flock', 'glob', 'rename', 'copy', 'unlink', 'mkdir', 'file_put_contents', 'filemtime', 'getimagesizefromstring', 'header' );
$missing = array();
foreach ( $need as $fn ) {
	if ( ! function_exists( $fn ) ) {
		$missing[] = $fn;
	}
}
$disabled = array_filter( array_map( 'trim', explode( ',', (string) ini_get( 'disable_functions' ) ) ) );
$blocked  = array_values( array_intersect( $need, $disabled ) );
if ( $missing || $blocked ) {
	bb_add( 'bad', 'Funkcje PHP', 'brakuje albo są wyłączone: ' . implode( ', ', array_merge( $missing, $blocked ) ) );
} else {
	bb_add( 'ok', 'Funkcje PHP', 'wszystkie potrzebne są dostępne' );
}
if ( @preg_match( '//u', '' ) === false ) {
	bb_add( 'bad', 'Znaki Unicode w wyrażeniach (PCRE /u)', 'niedostępne: polskie znaki w filtrze tekstów nie zadziałają' );
}

/* 4. GD i WebP, exif */
if ( ! extension_loaded( 'gd' ) || ! function_exists( 'imagecreatetruecolor' ) ) {
	bb_add( 'warn', 'GD (obróbka zdjęć)', 'brak: wszystko działa, ale zdjęcia wgrywane w edytorze zostają w oryginalnym rozmiarze (strona wolniejsza). Włącz rozszerzenie gd w panelu (wybór PHP)' );
} else {
	$gd   = function_exists( 'gd_info' ) ? gd_info() : array();
	$webp = false;
	if ( function_exists( 'imagewebp' ) ) {
		$im = @imagecreatetruecolor( 8, 8 );
		if ( $im ) {
			ob_start();
			@imagewebp( $im, null, 80 );
			$data = ob_get_clean();
			$webp = ( 'RIFF' === substr( (string) $data, 0, 4 ) && 'WEBP' === substr( (string) $data, 8, 4 ) );
		}
	}
	$jpeg = ! empty( $gd['JPEG Support'] ) || ! empty( $gd['JPG Support'] );
	$png  = ! empty( $gd['PNG Support'] );
	if ( $webp && $jpeg && $png ) {
		bb_add( 'ok', 'GD (obróbka zdjęć)', 'działa, w tym zapis WebP (sprawdzone próbnym obrazem), JPEG i PNG' );
	} elseif ( $jpeg && $png ) {
		bb_add( 'warn', 'GD (obróbka zdjęć)', 'jest, ale bez zapisu WebP: zdjęcia będą zmniejszane i zapisywane jako JPEG (działa, tylko trochę większe pliki)' );
	} else {
		bb_add( 'warn', 'GD (obróbka zdjęć)', 'jest, ale bez pełnej obsługi JPEG/PNG: część zdjęć może zostać w oryginalnym rozmiarze' );
	}
}
if ( function_exists( 'exif_read_data' ) ) {
	bb_add( 'ok', 'exif', 'dostępne: zdjęcia z telefonu zostaną poprawnie obrócone' );
} else {
	bb_add( 'warn', 'exif', 'brak: zdjęcia z telefonu zrobione na stojąco mogą się wgrywać położone na bok (włącz rozszerzenie exif w panelu, jeśli się da)' );
}

/* 5. Limity wgrywania i pamięci */
$mem  = bb_bytes( ini_get( 'memory_limit' ) );
$up   = bb_bytes( ini_get( 'upload_max_filesize' ) );
$post = bb_bytes( ini_get( 'post_max_size' ) );
$lim  = 'memory_limit ' . ini_get( 'memory_limit' ) . ', upload_max_filesize ' . ini_get( 'upload_max_filesize' ) . ', post_max_size ' . ini_get( 'post_max_size' ) . ', max_execution_time ' . ini_get( 'max_execution_time' ) . ' s';
if ( ! ini_get( 'file_uploads' ) ) {
	bb_add( 'bad', 'Wgrywanie plików przez PHP', 'wyłączone (file_uploads=0): edytor nie wgra zdjęć. ' . $lim );
} elseif ( ( -1 !== $mem && $mem < 64 * 1048576 ) || $post < 8 * 1048576 || $up < 8 * 1048576 ) {
	bb_add( 'warn', 'Limity PHP', 'niskie: duże zdjęcia z telefonu mogą się nie wgrać (zalecane: pamięć 128M, wgrywanie i post 16M lub więcej). ' . $lim );
} else {
	bb_add( 'ok', 'Limity PHP', 'wystarczające. ' . $lim );
}

/* 6. Zapis plików w folderze strony */
$tdir = __DIR__ . '/__bb_zapis_' . substr( md5( uniqid( mt_rand(), true ) ), 0, 10 );
$wok  = false;
$werr = '';
if ( @mkdir( $tdir ) ) {
	$f = $tdir . '/a.tmp';
	if ( false !== @file_put_contents( $f, 'x' ) ) {
		$fp = @fopen( $f, 'c+' );
		if ( $fp && @flock( $fp, LOCK_EX ) ) {
			@flock( $fp, LOCK_UN );
			@fclose( $fp );
			if ( @rename( $f, $tdir . '/b.tmp' ) && 'x' === @file_get_contents( $tdir . '/b.tmp' ) ) {
				$wok = true;
			} else {
				$werr = 'nie udało się zmienić nazwy lub odczytać pliku';
			}
		} else {
			$werr = 'blokada pliku (flock) niedostępna';
		}
	} else {
		$werr = 'nie udało się zapisać pliku';
	}
	@unlink( $tdir . '/a.tmp' );
	@unlink( $tdir . '/b.tmp' );
	@rmdir( $tdir );
} else {
	$werr = 'nie udało się utworzyć folderu';
}
if ( $wok ) {
	bb_add( 'ok', 'Zapis plików w folderze strony', 'PHP może tworzyć foldery i pliki oraz je blokować i przenosić (uprawnienia folderu: ' . substr( sprintf( '%o', fileperms( __DIR__ ) ), -4 ) . ')' );
} else {
	bb_add( 'bad', 'Zapis plików w folderze strony', $werr . ' (uprawnienia folderu: ' . substr( sprintf( '%o', fileperms( __DIR__ ) ), -4 ) . '). Edytor musi móc zapisywać w data/ i uploads/: ustaw na nich 775 albo sprawdź właściciela folderu' );
}

/* 7. Czy serwer stosuje reguły .htaccess (te same, co w paczce strony): próba na tymczasowym podfolderze przez zapytanie do samego siebie */
$probe   = '__bb_probe_' . substr( md5( uniqid( mt_rand(), true ) ), 0, 10 );
$pdir    = __DIR__ . '/' . $probe;
$htaccess = "Options -Indexes\nDirectoryIndex index.php\n<IfModule mod_rewrite.c>\n  RewriteEngine On\n  RewriteCond %{REQUEST_FILENAME} !-f\n  RewriteCond %{REQUEST_FILENAME} !-d\n  RewriteRule . index.php [L]\n</IfModule>\n";
$result  = null;
$code    = 0;
if ( @mkdir( $pdir ) && false !== @file_put_contents( $pdir . '/.htaccess', $htaccess ) && false !== @file_put_contents( $pdir . '/index.php', "<?php echo 'BB-PROBE-OK ' . \$_SERVER['REQUEST_URI'];" ) ) {
	$scheme = $https ? 'https' : 'http';
	$host   = isset( $_SERVER['HTTP_HOST'] ) ? $_SERVER['HTTP_HOST'] : '';
	$base   = rtrim( str_replace( '\\', '/', dirname( isset( $_SERVER['SCRIPT_NAME'] ) ? $_SERVER['SCRIPT_NAME'] : '/' ) ), '/' );
	$url    = $scheme . '://' . $host . $base . '/' . $probe . '/nie/istnieje/podstrona';
	if ( ! isset( $_GET['bez-proby'] ) ) {
		$got = bb_probe_fetch( $url );
		if ( is_array( $got ) && $got[0] > 0 ) {
			$code   = (int) $got[0];
			$result = ( false !== strpos( (string) $got[1], 'BB-PROBE-OK' ) ) ? 'ok' : 'fail';
		}
	}
}
@unlink( $pdir . '/.htaccess' );
@unlink( $pdir . '/index.php' );
@rmdir( $pdir );
if ( 'ok' === $result ) {
	bb_add( 'ok', 'Reguły .htaccess (przepisywanie adresów)', 'działają: serwer stosuje .htaccess i mod_rewrite, a dyrektywy z paczki strony są dozwolone' );
} elseif ( 'fail' === $result ) {
	$why = ( 500 === $code ) ? 'serwer odpowiedział błędem 500: najpewniej nie wolno używać w .htaccess dyrektywy Options (usuń z .htaccess strony linię "Options -Indexes")' : 'serwer odpowiedział kodem ' . $code . ' zamiast strony próbnej: wygląda na wyłączony .htaccess lub mod_rewrite (albo test trafił na inną domenę/serwer)';
	bb_add( 'bad', 'Reguły .htaccess (przepisywanie adresów)', $why );
} elseif ( isset( $_GET['bez-proby'] ) ) {
	bb_add( 'info', 'Reguły .htaccess (przepisywanie adresów)', 'próba pominięta (bez-proby=1)' );
} else {
	bb_add( 'info', 'Reguły .htaccess (przepisywanie adresów)', 'nie udało się sprawdzić automatycznie (serwer nie pozwala zapytać samego siebie). Sprawdzisz to po wgraniu strony: jeśli adres /admin pokaże stronę logowania, reguły działają' );
}

/* Wynik */
$bad = $warn = 0;
foreach ( $GLOBALS['bb_rows'] as $r ) {
	if ( 'bad' === $r[0] ) {
		$bad++;
	} elseif ( 'warn' === $r[0] ) {
		$warn++;
	}
}
if ( $bad ) {
	$verdict = 'Są problemy do rozwiązania przed wdrożeniem (' . $bad . ').';
	$vclass  = 'bad';
} elseif ( $warn ) {
	$verdict = 'Można wdrażać. Są uwagi (' . $warn . '), nic krytycznego.';
	$vclass  = 'warn';
} else {
	$verdict = 'Hosting spełnia wszystkie wymagania strony. Można wdrażać.';
	$vclass  = 'ok';
}
$icons = array( 'ok' => '✓', 'warn' => '!', 'bad' => '✗', 'info' => 'i' );
$text  = $verdict . "\n";
foreach ( $GLOBALS['bb_rows'] as $r ) {
	$text .= '[' . strtoupper( $r[0] ) . '] ' . $r[1] . ': ' . $r[2] . "\n";
}

$keep = isset( $_GET['zostaw'] );
$del  = '';
if ( ! $keep ) {
	if ( @unlink( __FILE__ ) ) {
		$del = 'Ten plik został usunięty z serwera. Żeby sprawdzić ponownie, wgraj go jeszcze raz.';
	} else {
		$del = 'Nie udało się usunąć tego pliku automatycznie. Usuń go ręcznie w menedżerze plików.';
	}
} else {
	$del = 'Plik został zostawiony na serwerze (zostaw=1). Usuń go ręcznie po sprawdzeniu.';
}
?><!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Sprawdzenie hostingu</title>
<style>
body{margin:0;padding:24px 16px;background:#f2f2f2;color:#111;font:16px/1.5 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.w{max-width:860px;margin:0 auto}h1{font-size:24px;margin:0 0 12px}
.v{padding:14px 18px;border-radius:12px;font-weight:600;margin-bottom:16px}.v.ok{background:#e8f7ee;color:#14663a}.v.warn{background:#fff6e0;color:#7a5600}.v.bad{background:#fdecec;color:#9b1c1c}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}td{padding:10px 14px;border-bottom:1px solid #eee;vertical-align:top}
td.i{width:34px;text-align:center;font-weight:700}tr.ok td.i{color:#14663a}tr.warn td.i{color:#b07400}tr.bad td.i{color:#c01820}tr.info td.i{color:#666}
td.n{width:30%;font-weight:600}pre{background:#fff;border-radius:12px;padding:14px;white-space:pre-wrap;word-break:break-word;font-size:13px}.m{color:#555;font-size:14px}
</style></head><body><div class="w">
<h1>Sprawdzenie hostingu</h1>
<div class="v <?php echo bb_h( $vclass ); ?>"><?php echo bb_h( $verdict ); ?></div>
<table>
<?php foreach ( $GLOBALS['bb_rows'] as $r ) : ?>
<tr class="<?php echo bb_h( $r[0] ); ?>"><td class="i"><?php echo bb_h( $icons[ $r[0] ] ); ?></td><td class="n"><?php echo bb_h( $r[1] ); ?></td><td><?php echo bb_h( $r[2] ); ?></td></tr>
<?php endforeach; ?>
</table>
<p class="m"><?php echo bb_h( $del ); ?></p>
<p class="m">Skopiuj poniższy wynik i wklej go do rozmowy:</p>
<pre><?php echo bb_h( $text ); ?></pre>
</div></body></html>
