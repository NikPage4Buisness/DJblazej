<?php
/**
 * DJ Błażej Biurkowski: motyw.
 *
 * Etap 1: strona przeniesiona 1:1 (szablony PHP wygenerowane z plików strony).
 * Etap 2: edycja tekstów przez kliknięcie na samej stronie. Każdy edytowalny tekst w szablonie ma znacznik data-bb="klucz",
 *         a jego treść pochodzi z funkcji bb_e( 'klucz' ): to zapisana zmiana (opcja bb_text_overrides w bazie) albo tekst
 *         domyślny z inc/texts.json. Zalogowany użytkownik z prawem edycji stron widzi na stronie przycisk „Edytuj teksty”
 *         (js/bb-edit.js), a zmiany zapisuje przez REST: POST /wp-json/djblazej/v1/texts.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ---------- podstawy motywu ---------- */

add_action( 'after_setup_theme', function () {
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
} );

// Strona ma własne style i skrypty (wczytywane w szablonach), więc wyłączamy zbędny balast WordPressa z nagłówka.
add_action( 'wp_enqueue_scripts', function () {
	wp_dequeue_style( 'wp-block-library' );
	wp_dequeue_style( 'wp-block-library-theme' );
	wp_dequeue_style( 'classic-theme-styles' );
	wp_dequeue_style( 'global-styles' );
}, 100 );

remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
remove_action( 'wp_print_styles', 'print_emoji_styles' );
remove_action( 'wp_head', 'wp_generator' );

/* ---------- teksty edytowalne ---------- */

/** Teksty domyślne: [ klucz => kod HTML ], wygenerowane przy budowie motywu (inc/texts.json). */
function bb_defaults() {
	static $defaults = null;
	if ( null === $defaults ) {
		$defaults = array();
		$file     = get_theme_file_path( 'inc/texts.json' );
		if ( is_readable( $file ) ) {
			$data = json_decode( (string) file_get_contents( $file ), true );
			if ( is_array( $data ) ) {
				$defaults = $data;
			}
		}
	}
	return $defaults;
}

/** Zapisane zmiany klienta: [ klucz => kod HTML ]. */
function bb_overrides() {
	static $over = null;
	if ( null === $over ) {
		$over = get_option( 'bb_text_overrides', array() );
		if ( ! is_array( $over ) ) {
			$over = array();
		}
	}
	return $over;
}

/** Treść elementu: zmiana klienta albo tekst domyślny. */
function bb_get( $key ) {
	$over = bb_overrides();
	if ( isset( $over[ $key ] ) && is_string( $over[ $key ] ) && '' !== $over[ $key ] ) {
		return $over[ $key ];
	}
	$defaults = bb_defaults();
	return isset( $defaults[ $key ] ) ? $defaults[ $key ] : '';
}

/** Wypisuje treść elementu (używane w szablonach). Zapisane zmiany są oczyszczone przy zapisie, tekst domyślny pochodzi z motywu. */
function bb_e( $key ) {
	echo bb_get( $key ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}

/** Dozwolone formatowanie: pogrubienie, kursywa (akcent), złamanie linii i span z klasą (np. wyróżnione nazwy programów). */
function bb_clean_html( $html ) {
	$html = (string) $html;
	$html = preg_replace( '#<(/?)b(\s[^>]*)?>#i', '<$1strong>', $html );
	$html = preg_replace( '#<(/?)i(\s[^>]*)?>#i', '<$1em>', $html );
	$html = wp_kses(
		$html,
		array(
			'strong' => array(),
			'em'     => array(),
			'br'     => array(),
			'span'   => array( 'class' => true ),
		)
	);
	return trim( preg_replace( '/\s+/u', ' ', $html ) );
}

/* ---------- zapis zmian (REST) ---------- */

add_action( 'rest_api_init', function () {
	register_rest_route(
		'djblazej/v1',
		'/texts',
		array(
			'methods'             => 'POST',
			'permission_callback' => function () {
				return current_user_can( 'edit_pages' );
			},
			'callback'            => 'bb_rest_save_texts',
		)
	);
} );

/**
 * Body: { "items": { "klucz": "<kod HTML>" lub null (przywrócenie oryginału) } }
 * Odpowiedź: { "saved": { "klucz": "<zapisany kod HTML>" } }
 */
function bb_rest_save_texts( WP_REST_Request $request ) {
	$items = $request->get_param( 'items' );
	if ( ! is_array( $items ) ) {
		return new WP_Error( 'bb_bad_request', 'Brak danych do zapisania.', array( 'status' => 400 ) );
	}

	$defaults = bb_defaults();
	$over     = get_option( 'bb_text_overrides', array() );
	if ( ! is_array( $over ) ) {
		$over = array();
	}
	$saved = array();

	foreach ( $items as $key => $html ) {
		$key = sanitize_key( (string) $key );
		if ( '' === $key || ! isset( $defaults[ $key ] ) ) {
			continue; // tylko znane teksty
		}
		if ( null === $html || false === $html ) {
			unset( $over[ $key ] );
			$saved[ $key ] = $defaults[ $key ];
			continue;
		}
		$clean = bb_clean_html( $html );
		if ( '' === trim( wp_strip_all_tags( $clean ) ) ) {
			continue; // pusty tekst nie jest zapisywany
		}
		if ( $clean === bb_clean_html( $defaults[ $key ] ) ) {
			unset( $over[ $key ] );
			$saved[ $key ] = $defaults[ $key ];
		} else {
			$over[ $key ]  = $clean;
			$saved[ $key ] = $clean;
		}
	}

	update_option( 'bb_text_overrides', $over );
	return array( 'saved' => $saved );
}

/* ---------- zdjęcia, linki i wczytywanie edytora (etap 3) ---------- */

require_once get_theme_file_path( 'inc/editor.php' );

/* ---------- galerie portfolio: kolejność, dodawanie i usuwanie zdjęć (etap 4) ---------- */

require_once get_theme_file_path( 'inc/gallery.php' );

