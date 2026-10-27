<?php
/**
 * DJ Błażej Biurkowski: zdjęcia i linki edytowalne na stronie oraz wczytywanie edytora (etap 3).
 * Wczytywany z functions.php. Zmiany klienta leżą w opcjach bb_img_overrides i bb_link_overrides.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Odczyt pliku JSON z katalogu inc/ motywu (z pamięcią podręczną na czas żądania). */
function bb_read_json( $name ) {
	static $cache = array();
	if ( ! isset( $cache[ $name ] ) ) {
		$cache[ $name ] = array();
		$file           = get_theme_file_path( 'inc/' . $name );
		if ( is_readable( $file ) ) {
			$data = json_decode( (string) file_get_contents( $file ), true );
			if ( is_array( $data ) ) {
				$cache[ $name ] = $data;
			}
		}
	}
	return $cache[ $name ];
}

/** Zdjęcia domyślne: [ klucz => [ src, alt, full (opcjonalnie: duży plik do powiększenia) ] ]. */
function bb_img_defaults() {
	return bb_read_json( 'images.json' );
}

/** Linki domyślne: [ klucz => [ href, page (true: adres strony serwisu względem home_url) ] ]. */
function bb_link_defaults() {
	return bb_read_json( 'links.json' );
}

function bb_img_overrides() {
	static $over = null;
	if ( null === $over ) {
		$over = get_option( 'bb_img_overrides', array() );
		if ( ! is_array( $over ) ) {
			$over = array();
		}
	}
	return $over;
}

function bb_link_overrides() {
	static $over = null;
	if ( null === $over ) {
		$over = get_option( 'bb_link_overrides', array() );
		if ( ! is_array( $over ) ) {
			$over = array();
		}
	}
	return $over;
}

/** Adresy i opis zdjęcia po uwzględnieniu zmiany klienta: [ src, full, alt ]. */
function bb_img_resolve( $key, $over = null ) {
	$over     = ( null === $over ) ? bb_img_overrides() : $over;
	$defaults = bb_img_defaults();
	$def      = isset( $defaults[ $key ] ) ? $defaults[ $key ] : array();
	$ov       = ( isset( $over[ $key ] ) && is_array( $over[ $key ] ) ) ? $over[ $key ] : array();

	$src  = ! empty( $ov['url'] ) ? $ov['url'] : ( isset( $def['src'] ) ? get_theme_file_uri( $def['src'] ) : '' );
	$full = ! empty( $ov['full'] ) ? $ov['full'] : ( isset( $def['full'] ) ? get_theme_file_uri( $def['full'] ) : '' );
	$alt  = array_key_exists( 'alt', $ov ) ? (string) $ov['alt'] : ( isset( $def['alt'] ) ? (string) $def['alt'] : '' );

	return array(
		'src'  => (string) $src,
		'full' => (string) $full,
		'alt'  => $alt,
	);
}

/** Adres linku po uwzględnieniu zmiany klienta. */
function bb_link_resolve( $key, $over = null ) {
	$over = ( null === $over ) ? bb_link_overrides() : $over;
	if ( isset( $over[ $key ] ) && is_string( $over[ $key ] ) && '' !== $over[ $key ] ) {
		return $over[ $key ];
	}
	$defaults = bb_link_defaults();
	if ( ! isset( $defaults[ $key ]['href'] ) ) {
		return '';
	}
	$def = $defaults[ $key ];
	return ! empty( $def['page'] ) ? home_url( $def['href'] ) : $def['href'];
}

// Funkcje używane w szablonach (wypisują oczyszczoną wartość atrybutu).
function bb_img_src( $key ) {
	$r = bb_img_resolve( $key );
	echo esc_url( $r['src'] );
}
function bb_img_alt( $key ) {
	$r = bb_img_resolve( $key );
	echo esc_attr( $r['alt'] );
}
function bb_img_full( $key ) {
	$r = bb_img_resolve( $key );
	echo esc_url( '' !== $r['full'] ? $r['full'] : $r['src'] );
}
/**
 * Zestaw rozmiarów (srcset) zdjęcia z projektu. Po podmianie zdjęcia przez klienta nie wypisujemy nic
 * (WordPress sam dobiera rozmiary nowego zdjęcia, a stary zestaw wskazywałby na poprzednie zdjęcie).
 */
function bb_img_srcset( $key ) {
	$over = bb_img_overrides();
	if ( ! empty( $over[ $key ]['url'] ) ) {
		return;
	}
	$defaults = bb_img_defaults();
	if ( empty( $defaults[ $key ]['srcset'] ) ) {
		return;
	}
	$parts = array();
	foreach ( explode( ',', (string) $defaults[ $key ]['srcset'] ) as $candidate ) {
		$candidate = trim( $candidate );
		if ( '' === $candidate ) {
			continue;
		}
		$pieces = preg_split( '/\s+/', $candidate, 2 );
		$parts[] = esc_url( get_theme_file_uri( $pieces[0] ) ) . ( isset( $pieces[1] ) ? ' ' . esc_attr( $pieces[1] ) : '' );
	}
	echo implode( ', ', $parts ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}
function bb_href( $key ) {
	echo esc_url( bb_link_resolve( $key ) );
}

/* ---------- zapis zdjęć i linków (REST) ---------- */

add_action( 'rest_api_init', function () {
	$perm = function () {
		return current_user_can( 'edit_pages' );
	};
	register_rest_route(
		'djblazej/v1',
		'/images',
		array(
			'methods'             => 'POST',
			'permission_callback' => $perm,
			'callback'            => 'bb_rest_save_images',
		)
	);
	register_rest_route(
		'djblazej/v1',
		'/links',
		array(
			'methods'             => 'POST',
			'permission_callback' => $perm,
			'callback'            => 'bb_rest_save_links',
		)
	);
} );

/**
 * Body: { "items": { "klucz": { "id": 123, "alt": "opis" } lub { "alt": "opis" } lub null (przywrócenie oryginału) } }
 * Odpowiedź: { "saved": { "klucz": { "src": "...", "full": "...", "alt": "..." } } }
 */
function bb_rest_save_images( WP_REST_Request $request ) {
	$items = $request->get_param( 'items' );
	if ( ! is_array( $items ) ) {
		return new WP_Error( 'bb_bad_request', 'Brak danych do zapisania.', array( 'status' => 400 ) );
	}

	$defaults = bb_img_defaults();
	$over     = get_option( 'bb_img_overrides', array() );
	if ( ! is_array( $over ) ) {
		$over = array();
	}
	$saved = array();

	foreach ( $items as $key => $item ) {
		$key = sanitize_key( (string) $key );
		if ( '' === $key || ! isset( $defaults[ $key ] ) ) {
			continue;
		}
		if ( null === $item || false === $item ) {
			unset( $over[ $key ] );
			$saved[ $key ] = bb_img_resolve( $key, $over );
			continue;
		}
		if ( ! is_array( $item ) ) {
			continue;
		}
		$cur = ( isset( $over[ $key ] ) && is_array( $over[ $key ] ) ) ? $over[ $key ] : array();

		if ( ! empty( $item['id'] ) ) {
			$id = absint( $item['id'] );
			if ( $id && wp_attachment_is_image( $id ) ) {
				// miniatury w galerii (mają duży plik do powiększenia): rozmiar „large”; pozostałe zdjęcia: pełny (WordPress zmniejsza ogromne pliki sam)
				$size = isset( $defaults[ $key ]['full'] ) ? 'large' : 'full';
				$url  = wp_get_attachment_image_url( $id, $size );
				$full = wp_get_attachment_url( $id );
				if ( $url && $full ) {
					$cur['id']   = $id;
					$cur['url']  = $url;
					$cur['full'] = $full;
				}
			}
		}
		if ( array_key_exists( 'alt', $item ) ) {
			$cur['alt'] = sanitize_text_field( (string) $item['alt'] );
		}

		if ( empty( $cur ) ) {
			unset( $over[ $key ] );
		} else {
			$over[ $key ] = $cur;
		}
		$saved[ $key ] = bb_img_resolve( $key, $over );
	}

	update_option( 'bb_img_overrides', $over );
	return array( 'saved' => $saved );
}

/**
 * Body: { "items": { "klucz": "adres" lub null (przywrócenie oryginału) } }
 * Dozwolone adresy: http(s), mailto, tel, adresy względne (/strona/) i kotwice (#sekcja).
 */
function bb_rest_save_links( WP_REST_Request $request ) {
	$items = $request->get_param( 'items' );
	if ( ! is_array( $items ) ) {
		return new WP_Error( 'bb_bad_request', 'Brak danych do zapisania.', array( 'status' => 400 ) );
	}

	$defaults = bb_link_defaults();
	$over     = get_option( 'bb_link_overrides', array() );
	if ( ! is_array( $over ) ) {
		$over = array();
	}
	$saved = array();

	foreach ( $items as $key => $url ) {
		$key = sanitize_key( (string) $key );
		if ( '' === $key || ! isset( $defaults[ $key ] ) ) {
			continue;
		}
		if ( null === $url || false === $url ) {
			unset( $over[ $key ] );
			$saved[ $key ] = bb_link_resolve( $key, $over );
			continue;
		}
		$url = trim( (string) $url );
		if ( is_email( $url ) ) {
			$url = 'mailto:' . $url; // wpisany sam adres e-mail
		}
		$clean = esc_url_raw( $url, array( 'http', 'https', 'mailto', 'tel' ) );
		if ( '' === $clean ) {
			continue; // niepoprawny lub niebezpieczny adres
		}
		$def_href = ! empty( $defaults[ $key ]['page'] ) ? home_url( $defaults[ $key ]['href'] ) : $defaults[ $key ]['href'];
		if ( $clean === $def_href ) {
			unset( $over[ $key ] );
		} else {
			$over[ $key ] = $clean;
		}
		$saved[ $key ] = bb_link_resolve( $key, $over );
	}

	update_option( 'bb_link_overrides', $over );
	return array( 'saved' => $saved );
}

/* ---------- edytor na stronie (tylko dla zalogowanych z prawem edycji stron) ---------- */

add_action( 'wp_enqueue_scripts', function () {
	if ( ! is_user_logged_in() || ! current_user_can( 'edit_pages' ) ) {
		return;
	}
	if ( current_user_can( 'upload_files' ) ) {
		wp_enqueue_media(); // okno biblioteki mediów do wyboru zdjęć
	}
	$css = get_theme_file_path( 'css/bb-edit.css' );
	$js  = get_theme_file_path( 'js/bb-edit.js' );
	wp_enqueue_style( 'bb-edit', get_theme_file_uri( 'css/bb-edit.css' ), array(), file_exists( $css ) ? filemtime( $css ) : null );
	wp_enqueue_script( 'bb-edit', get_theme_file_uri( 'js/bb-edit.js' ), array(), file_exists( $js ) ? filemtime( $js ) : null, true );
	$config = array(
		'rest'       => esc_url_raw( rest_url( 'djblazej/v1/texts' ) ),
		'restImages' => esc_url_raw( rest_url( 'djblazej/v1/images' ) ),
		'restLinks'  => esc_url_raw( rest_url( 'djblazej/v1/links' ) ),
		'restMedia'  => esc_url_raw( rest_url( 'wp/v2/media' ) ),
		'canUpload'  => current_user_can( 'upload_files' ),
		'nonce'      => wp_create_nonce( 'wp_rest' ),
	);
	// poza WordPressem (wersja na zwykły hosting) dochodzi wylogowanie i lista wgranych zdjęć
	if ( function_exists( 'bb_extra_editor_config' ) ) {
		$config = array_merge( $config, bb_extra_editor_config() );
	}
	wp_localize_script( 'bb-edit', 'BB_EDIT', $config );
}, 20 );
