<?php
/**
 * Router żądań z edytora (odpowiednik REST API WordPressa): /cms-api/...
 *
 * Wszystkie żądania wymagają zalogowania. Zmieniające dane (POST) wymagają też nagłówka X-WP-Nonce z tokenem wyliczonym z sesji.
 * Trasy motywu (djblazej/v1/texts, images, links, gallery) rejestrują się przez register_rest_route(), tak samo jak w WordPressie.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Wczytuje funkcje motywu (trasy REST, edytor, galeria), raz na żądanie. */
function bb_load_theme() {
	static $loaded = false;
	if ( ! $loaded ) {
		$loaded = true;
		require_once get_theme_file_path( 'functions.php' );
	}
}

function bb_rest_dispatch( $path ) {
	$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : 'GET';
	$path   = trim( (string) $path, '/' );

	if ( ! bb_session() ) {
		bb_json_error( 'Sesja wygasła. Zaloguj się ponownie (adres /admin) i odśwież stronę.', 401 );
	}
	if ( 'GET' !== $method && 'HEAD' !== $method ) {
		$sent = isset( $_SERVER['HTTP_X_WP_NONCE'] ) ? (string) $_SERVER['HTTP_X_WP_NONCE'] : '';
		if ( ! bb_check_nonce( $sent ) ) {
			bb_json_error( 'Sesja edytora wygasła. Odśwież stronę (Ctrl + F5) i spróbuj ponownie.', 403 );
		}
	}

	if ( 'wp/v2/media' === $path ) {
		if ( 'POST' === $method ) {
			bb_media_upload();
		}
		bb_media_list();
	}

	bb_load_theme();
	do_action( 'rest_api_init' );
	if ( ! isset( $GLOBALS['bb_routes'][ $path ] ) ) {
		bb_json_error( 'Nie znaleziono.', 404 );
	}
	$route = $GLOBALS['bb_routes'][ $path ];
	if ( isset( $route['methods'] ) && strtoupper( (string) $route['methods'] ) !== $method ) {
		bb_json_error( 'Niedozwolona metoda.', 405 );
	}
	if ( isset( $route['permission_callback'] ) && ! call_user_func( $route['permission_callback'] ) ) {
		bb_json_error( 'Brak uprawnień.', 403 );
	}

	$params = $_GET;
	$type   = isset( $_SERVER['CONTENT_TYPE'] ) ? (string) $_SERVER['CONTENT_TYPE'] : '';
	if ( false !== stripos( $type, 'json' ) ) {
		$raw  = file_get_contents( 'php://input' );
		$json = json_decode( (string) $raw, true );
		if ( is_array( $json ) ) {
			$params = array_merge( $params, $json );
		}
	}

	$result = call_user_func( $route['callback'], new WP_REST_Request( $params ) );
	if ( $result instanceof WP_Error ) {
		$status = ( is_array( $result->data ) && isset( $result->data['status'] ) ) ? (int) $result->data['status'] : 400;
		bb_json(
			array(
				'code'    => $result->code,
				'message' => $result->message,
				'data'    => $result->data,
			),
			$status
		);
	}
	bb_json( $result );
}
