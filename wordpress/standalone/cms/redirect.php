<?php
/**
 * Przekierowania 301: ze starych adresów poprzedniej strony (WordPress) na nowe oraz z wariantu domeny (www) na docelowy.
 *
 * Dane (adres strony, lista adresów, reguły) są w cms/redirects.php, które tworzy skrypt budujący paczkę z wordpress/redirects.mjs.
 * Funkcje są czyste (nic nie wysyłają), żeby dało się je sprawdzić testami; wysyła je index.php.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function bb_redirect_config() {
	static $cfg = null;
	if ( null === $cfg ) {
		$file = __DIR__ . '/redirects.php';
		$cfg  = is_file( $file ) ? (array) include $file : array();
	}
	return $cfg;
}

/** Postać ścieżki do porównań: małe litery, bez podwójnych ukośników, z ukośnikiem na końcu (poza plikami z kropką). */
function bb_redirect_key( $path ) {
	$path = strtolower( (string) $path );
	$path = preg_replace( '#/{2,}#', '/', $path );
	if ( '' === $path || '/' !== $path[0] ) {
		$path = '/' . $path;
	}
	$last = substr( $path, (int) strrpos( $path, '/' ) + 1 );
	if ( '' !== $last && false === strpos( $last, '.' ) ) {
		$path .= '/';
	}
	return $path;
}

/** Docelowa ścieżka dla starego adresu (np. /wedding/ albo /#portfolio) albo null, gdy adres nie jest na liście. */
function bb_redirect_old( $path ) {
	$cfg = bb_redirect_config();
	$key = bb_redirect_key( $path );
	if ( isset( $cfg['exact'][ $key ] ) ) {
		return (string) $cfg['exact'][ $key ];
	}
	foreach ( isset( $cfg['rules'] ) ? (array) $cfg['rules'] : array() as $rule ) {
		if ( isset( $rule[0], $rule[1] ) && 1 === preg_match( $rule[0], $key ) ) {
			return (string) $rule[1];
		}
	}
	return null;
}

/** Pełny adres na docelowej domenie, gdy żądanie przyszło na jej drugi wariant (www albo bez www); w innym razie null. */
function bb_redirect_host( $host, $uri ) {
	$cfg  = bb_redirect_config();
	$site = isset( $cfg['site'] ) ? rtrim( (string) $cfg['site'], '/' ) : '';
	$main = strtolower( (string) parse_url( $site, PHP_URL_HOST ) );
	if ( '' === $main ) {
		return null;
	}
	$alt  = ( 0 === strpos( $main, 'www.' ) ) ? substr( $main, 4 ) : 'www.' . $main;
	$host = strtolower( (string) preg_replace( '/:\d+$/', '', (string) $host ) );
	if ( $host !== $alt ) {
		return null;
	}
	$uri = (string) preg_replace( '/[\x00-\x1f\x7f]/', '', (string) $uri );
	if ( '' === $uri || '/' !== $uri[0] ) {
		$uri = '/';
	}
	return $site . $uri;
}

function bb_redirect_send( $url ) {
	header( 'Location: ' . $url, true, 301 );
	header( 'Cache-Control: public, max-age=3600' );
	exit;
}
