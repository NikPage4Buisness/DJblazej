<?php
/**
 * Strona DJ Błażej Biurkowski na zwykłym hostingu PHP (bez WordPressa), z edycją na stronie.
 *
 * Ten plik obsługuje wszystkie adresy, które nie są istniejącymi plikami (patrz .htaccess):
 *   /, /eventy/, /studniowki/, /wedding/,
 *   /referencje-dj-blazej/, /polityka-prywatnosci-i-plikow-cookies/   strony (szablony z theme/)
 *   stare adresy poprzedniej strony        przekierowanie 301 na odpowiednik (cms/redirect.php, dane z wordpress/redirects.mjs)
 *   /admin                                  konto: logowanie, hasło, historia zmian
 *   /cms-api/...                            zapis zmian z edytora
 * Zdjęcia, style i skrypty (theme/, uploads/) serwer wysyła bezpośrednio.
 */

define( 'ABSPATH', __DIR__ . '/' );

require __DIR__ . '/cms/compat.php';
require __DIR__ . '/cms/redirect.php';

/** Szablony stron: ścieżka => plik szablonu (bez .php) w folderze theme/. */
function bb_routes() {
	$file = __DIR__ . '/cms/routes.php';
	return is_file( $file ) ? (array) include $file : array(
		'/'           => 'front-page',
		'/eventy/'    => 'page-eventy',
		'/studniowki/' => 'page-studniowki',
		'/wedding/'   => 'page-wedding',
		'/referencje-dj-blazej/' => 'page-referencje-dj-blazej',
		'/polityka-prywatnosci-i-plikow-cookies/' => 'page-polityka-prywatnosci-i-plikow-cookies',
	);
}

/** Czas ostatniej zmiany treści lub motywu (dla nagłówka Last-Modified: odwiedzający dostają 304, gdy nic się nie zmieniło). */
function bb_last_modified() {
	$time = 0;
	foreach ( array_merge( array( bb_data_path( 'options' ) ), (array) glob( __DIR__ . '/theme/*.php' ), (array) glob( __DIR__ . '/theme/inc/*' ) ) as $f ) {
		if ( is_file( $f ) ) {
			$time = max( $time, (int) filemtime( $f ) );
		}
	}
	return $time;
}

function bb_render_page( $template ) {
	bb_load_theme();
	header( 'Content-Type: text/html; charset=UTF-8' );
	header( 'X-Content-Type-Options: nosniff' );
	if ( bb_session() ) {
		header( 'Cache-Control: no-store' );   // zalogowany widzi zawsze aktualną stronę z edytorem
	} else {
		$modified = bb_last_modified();
		header( 'Cache-Control: public, max-age=0, must-revalidate' );
		if ( $modified ) {
			header( 'Last-Modified: ' . gmdate( 'D, d M Y H:i:s', $modified ) . ' GMT' );
			if ( isset( $_SERVER['HTTP_IF_MODIFIED_SINCE'] ) && (int) strtotime( (string) $_SERVER['HTTP_IF_MODIFIED_SINCE'] ) >= $modified ) {
				http_response_code( 304 );
				return;
			}
		}
	}
	include __DIR__ . '/theme/' . $template . '.php';
}

function bb_not_found() {
	http_response_code( 404 );
	header( 'Content-Type: text/html; charset=UTF-8' );
	echo '<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">'
		. '<title>Nie znaleziono strony</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:18px/1.5 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:#111;color:#fff;text-align:center}a{color:#fff}</style></head>'
		. '<body><div><h1>Nie znaleziono strony</h1><p><a href="' . htmlspecialchars( home_url( '/' ), ENT_QUOTES, 'UTF-8' ) . '">Wróć na stronę główną</a></p></div></body></html>';
}

function bb_run() {
	$path   = bb_request_path();
	$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : 'GET';

	// drugi wariant domeny (www albo bez www) kierujemy na docelową; tylko zwykłe odczyty (przekierowanie zapisu zgubiłoby dane)
	if ( ( 'GET' === $method || 'HEAD' === $method ) && 0 !== strpos( $path, '/cms-api/' ) ) {
		$to = bb_redirect_host( isset( $_SERVER['HTTP_HOST'] ) ? $_SERVER['HTTP_HOST'] : '', isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : '/' );
		if ( null !== $to ) {
			bb_redirect_send( $to );
		}
	}

	if ( 0 === strpos( $path, '/cms-api/' ) ) {
		bb_rest_dispatch( substr( $path, 9 ) );
		exit;
	}
	if ( '/admin' === rtrim( $path, '/' ) || 0 === strpos( $path, '/admin/' ) ) {
		bb_admin( $path );
		exit;
	}

	$routes = bb_routes();
	if ( isset( $routes[ $path ] ) ) {
		bb_render_page( $routes[ $path ] );
		return;
	}
	// adres bez ukośnika na końcu (np. /eventy) przekierowujemy na właściwy
	if ( isset( $routes[ $path . '/' ] ) ) {
		bb_redirect( home_url( $path . '/' ), 301 );
	}
	// stary adres poprzedniej strony (WordPress): 301 na odpowiednik w nowej, żeby zachować pozycje w Google
	$old = bb_redirect_old( $path );
	if ( null !== $old ) {
		bb_redirect_send( home_url( $old ) );
	}
	bb_not_found();
}

bb_run();
