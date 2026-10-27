<?php
/**
 * DJ Błażej Biurkowski: galerie portfolio edytowalne na stronie (etap 4).
 * Wczytywany z functions.php. Są cztery galerie: home (strona główna), eventy, studniowki, wedding.
 *
 * Domyślne kafelki każdej galerii są w inc/gallery.json (wygenerowane przy budowie motywu). Zmiany klienta leżą w opcji bb_galleries:
 *   [ id galerii => [ 'items' => [ wpis, ... ], 'removed' => [ klucze usuniętych kafelków domyślnych ] ] ]
 * Wpis to kafelek domyślny { k, cats?, alt?, att? } albo dodany przez klienta { u, att, cats, alt }:
 *   k    klucz kafelka z projektu,        u    własny identyfikator dodanego kafelka,
 *   att  id zdjęcia z biblioteki mediów (przy kafelku domyślnym: podmiana zdjęcia),
 *   cats kategorie (slugi), alt opis zdjęcia.
 * Kolejność wpisów to kolejność kafelków na stronie. Kafelki domyślne, których nie ma na liście ani w „removed” (np. dodane przez
 * późniejszą aktualizację motywu), trafiają na koniec galerii.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Dane domyślne wszystkich galerii. */
function bb_gallery_defs() {
	return bb_read_json( 'gallery.json' );
}

/** Zapisane zmiany klienta (wszystkie galerie). */
function bb_gallery_store() {
	$all = get_option( 'bb_galleries', array() ); // WordPress pamięta opcje w pamięci podręcznej na czas żądania
	return is_array( $all ) ? $all : array();
}

/** Dane zdjęcia z biblioteki mediów: [ src (rozmiar „large”), w, h, full, alt ] albo null, gdy to nie zdjęcie. */
function bb_attachment_info( $id ) {
	static $cache = array();
	$id = absint( $id );
	if ( ! $id ) {
		return null;
	}
	if ( ! array_key_exists( $id, $cache ) ) {
		$cache[ $id ] = null;
		if ( wp_attachment_is_image( $id ) ) {
			$large = wp_get_attachment_image_src( $id, 'large' );
			$full  = wp_get_attachment_url( $id );
			if ( $large && $full ) {
				$cache[ $id ] = array(
					'src'  => (string) $large[0],
					'w'    => max( 1, (int) $large[1] ),
					'h'    => max( 1, (int) $large[2] ),
					'full' => (string) $full,
					'alt'  => (string) get_post_meta( $id, '_wp_attachment_image_alt', true ),
				);
			}
		}
	}
	return $cache[ $id ];
}

/** Kategorie galerii: [ slug => [ slug, label, tag ] ]. */
function bb_gallery_cat_map( $def ) {
	$map = array();
	foreach ( (array) $def['cats'] as $cat ) {
		$map[ $cat['slug'] ] = $cat;
	}
	return $map;
}

/** Zostawia tylko znane kategorie, bez powtórzeń. */
function bb_gallery_clean_cats( $cats, $map ) {
	$out = array();
	foreach ( (array) $cats as $cat ) {
		$cat = sanitize_key( (string) $cat );
		if ( isset( $map[ $cat ] ) && ! in_array( $cat, $out, true ) ) {
			$out[] = $cat;
		}
	}
	return $out;
}

/**
 * Składa kafelek z wpisu. Wynik: [ id, custom, att, src, src0, full, w, h, ar, alt, cats, tag, caption ] albo null.
 * src0 to zdjęcie z projektu (bez podmiany klienta).
 */
function bb_gallery_build_item( $entry, $def, $by_key, $map ) {
	if ( isset( $entry['k'] ) ) {
		$k = (string) $entry['k'];
		if ( ! isset( $by_key[ $k ] ) ) {
			return null;
		}
		$it       = $by_key[ $k ];
		$r        = bb_img_resolve( $k ); // zdjęcie z projektu (z ewentualną zmianą z etapu 3)
		$def_cats = array_values( array_filter( explode( ' ', (string) $it['cat'] ) ) );
		$w        = (int) $it['w'];
		$h        = (int) $it['h'];
		$ar       = isset( $it['ar'] ) ? (string) $it['ar'] : '';
		$item     = array(
			'id'      => $k,
			'custom'  => false,
			'att'     => 0,
			'src'     => $r['src'],
			'src0'    => $r['src'],
			'full'    => '' !== $r['full'] ? $r['full'] : $r['src'],
			'w'       => $w,
			'h'       => $h,
			'ar'      => $ar,
			'alt'     => isset( $entry['alt'] ) ? (string) $entry['alt'] : $r['alt'],
			'cats'    => $def_cats,
			'tag'     => isset( $it['tag'] ) ? (string) $it['tag'] : '',
			'caption' => isset( $it['caption'] ) ? (string) $it['caption'] : '',
		);
		if ( isset( $entry['cats'] ) && is_array( $entry['cats'] ) ) {
			$item['cats']    = bb_gallery_clean_cats( $entry['cats'], $map );
			$item['tag']     = $item['cats'] ? $map[ $item['cats'][0] ]['tag'] : (string) $def['fallbackTag'];
			$item['caption'] = $item['tag'];
		}
		$att = ! empty( $entry['att'] ) ? bb_attachment_info( $entry['att'] ) : null;
		if ( $att ) {
			$item['att']  = absint( $entry['att'] );
			$item['src']  = $att['src'];
			$item['full'] = $att['full'];
			$item['w']    = $att['w'];
			$item['h']    = $att['h'];
			$item['ar']   = number_format( $att['w'] / $att['h'], 3, '.', '' );
		}
		return $item;
	}

	if ( empty( $entry['u'] ) ) {
		return null;
	}
	$att = bb_attachment_info( isset( $entry['att'] ) ? $entry['att'] : 0 );
	if ( ! $att ) {
		return null; // zdjęcie usunięto z biblioteki mediów
	}
	$cats = bb_gallery_clean_cats( isset( $entry['cats'] ) ? $entry['cats'] : array(), $map );
	$tag  = $cats ? $map[ $cats[0] ]['tag'] : (string) $def['fallbackTag'];
	return array(
		'id'      => (string) $entry['u'],
		'custom'  => true,
		'att'     => absint( $entry['att'] ),
		'src'     => $att['src'],
		'src0'    => $att['src'],
		'full'    => $att['full'],
		'w'       => $att['w'],
		'h'       => $att['h'],
		'ar'      => number_format( $att['w'] / $att['h'], 3, '.', '' ),
		'alt'     => ( isset( $entry['alt'] ) && '' !== $entry['alt'] ) ? (string) $entry['alt'] : $att['alt'],
		'cats'    => $cats,
		'tag'     => $tag,
		'caption' => $tag,
	);
}

/** Kafelki galerii w kolejności ze strony: [ def, items, removed ] albo null, gdy galerii nie ma. */
function bb_gallery_resolve( $gid ) {
	$defs = bb_gallery_defs();
	if ( ! isset( $defs[ $gid ] ) ) {
		return null;
	}
	$def    = $defs[ $gid ];
	$map    = bb_gallery_cat_map( $def );
	$by_key = array();
	foreach ( $def['items'] as $it ) {
		$by_key[ $it['k'] ] = $it;
	}

	$all   = bb_gallery_store();
	$saved = ( isset( $all[ $gid ]['items'] ) && is_array( $all[ $gid ]['items'] ) ) ? $all[ $gid ] : null;

	$entries = array();
	$used    = array();
	if ( $saved ) {
		$removed = ( isset( $saved['removed'] ) && is_array( $saved['removed'] ) ) ? $saved['removed'] : array();
		foreach ( $saved['items'] as $entry ) {
			if ( ! is_array( $entry ) ) {
				continue;
			}
			if ( isset( $entry['k'] ) ) {
				if ( ! isset( $by_key[ $entry['k'] ] ) || isset( $used[ $entry['k'] ] ) ) {
					continue;
				}
				$used[ $entry['k'] ] = true;
			}
			$entries[] = $entry;
		}
		foreach ( $def['items'] as $it ) {
			if ( ! isset( $used[ $it['k'] ] ) && ! in_array( $it['k'], $removed, true ) ) {
				$used[ $it['k'] ] = true;
				$entries[]        = array( 'k' => $it['k'] );
			}
		}
	} else {
		foreach ( $def['items'] as $it ) {
			$used[ $it['k'] ] = true;
			$entries[]        = array( 'k' => $it['k'] );
		}
	}

	$items = array();
	foreach ( $entries as $entry ) {
		$item = bb_gallery_build_item( $entry, $def, $by_key, $map );
		if ( $item ) {
			$items[] = $item;
		}
	}
	$removed_items = array();
	foreach ( $def['items'] as $it ) {
		if ( ! isset( $used[ $it['k'] ] ) ) {
			$removed_items[] = bb_gallery_build_item( array( 'k' => $it['k'] ), $def, $by_key, $map );
		}
	}

	return array(
		'def'     => $def,
		'items'   => $items,
		'removed' => $removed_items,
	);
}

/** Jeden kafelek galerii (ten sam kod HTML, który był w statycznej stronie). */
function bb_gallery_li( $kind, $item, $editable ) {
	$ed  = $editable ? ' data-bb-item="' . esc_attr( $item['id'] ) . '"' : '';
	$cat = esc_attr( implode( ' ', $item['cats'] ) );
	$img = '<img src="' . esc_url( $item['src'] ) . '" width="' . (int) $item['w'] . '" height="' . (int) $item['h'] . '" alt="' . esc_attr( $item['alt'] ) . '" loading="lazy" decoding="async">';
	if ( 'home' === $kind ) {
		$tag = '' !== $item['tag'] ? '<span class="gallery__tag">' . esc_html( $item['tag'] ) . '</span>' : '';
		echo '<li class="gallery__item" data-cat="' . $cat . '" data-ar="' . esc_attr( $item['ar'] ) . '"' . $ed . '><button data-lb="gallery" data-src="' . esc_url( $item['full'] ) . '" data-caption="' . esc_attr( $item['caption'] ) . '">' . $img . $tag . '</button></li>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	} else {
		echo '<li class="sub-gallery__item" data-cat="' . $cat . '"' . $ed . '><a href="' . esc_url( $item['full'] ) . '" data-lb>' . $img . '</a></li>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}

/** Kafelek w postaci przekazywanej edytorowi (okno „Galeria”). */
function bb_gallery_js_item( $item ) {
	return array(
		'id'     => $item['id'],
		'custom' => $item['custom'],
		'att'    => $item['att'],
		'src'    => $item['src'],
		'src0'   => $item['src0'],
		'alt'    => wp_specialchars_decode( (string) $item['alt'], ENT_QUOTES ),
		'cats'   => $item['cats'],
	);
}

/** Wypisuje wnętrze listy galerii (używane w szablonach zamiast statycznych kafelków). */
function bb_gallery( $gid ) {
	$res = bb_gallery_resolve( $gid );
	if ( ! $res ) {
		return;
	}
	$editable = is_user_logged_in() && current_user_can( 'edit_pages' );
	foreach ( $res['items'] as $item ) {
		bb_gallery_li( $res['def']['kind'], $item, $editable );
	}
	if ( $editable ) {
		$cats = array();
		foreach ( $res['def']['cats'] as $cat ) {
			$cats[] = array(
				'slug'  => $cat['slug'],
				'label' => $cat['label'],
			);
		}
		$GLOBALS['bb_gallery_payload'] = array(
			'gallery' => $gid,
			'rest'    => esc_url_raw( rest_url( 'djblazej/v1/gallery' ) ),
			'cats'    => $cats,
			'items'   => array_map( 'bb_gallery_js_item', $res['items'] ),
			'removed' => array_map( 'bb_gallery_js_item', $res['removed'] ),
		);
	}
}

// Dane galerii dla edytora (przed skryptami z wp_footer, więc dostępne od razu).
add_action(
	'wp_footer',
	function () {
		if ( empty( $GLOBALS['bb_gallery_payload'] ) ) {
			return;
		}
		echo '<script>window.BB_GALLERY = ' . wp_json_encode( $GLOBALS['bb_gallery_payload'], JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . ";</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	},
	5
);

/* ---------- zapis galerii (REST) ---------- */

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'djblazej/v1',
			'/gallery',
			array(
				'methods'             => 'POST',
				'permission_callback' => function () {
					return current_user_can( 'edit_pages' );
				},
				'callback'            => 'bb_rest_save_gallery',
			)
		);
	}
);

/**
 * Body: { "gallery": "home", "items": [ { "k"|"u": ..., "att": 123, "alt": "opis", "cats": [ "sax" ] }, ... ] }
 *   albo { "gallery": "home", "reset": true } (przywrócenie oryginalnej galerii).
 * Kolejność w „items” to kolejność na stronie. Kafelki domyślne, których nie ma na liście, są uznane za usunięte.
 */
function bb_rest_save_gallery( WP_REST_Request $request ) {
	$gid  = sanitize_key( (string) $request->get_param( 'gallery' ) );
	$defs = bb_gallery_defs();
	if ( '' === $gid || ! isset( $defs[ $gid ] ) ) {
		return new WP_Error( 'bb_bad_request', 'Nieznana galeria.', array( 'status' => 400 ) );
	}
	$all = get_option( 'bb_galleries', array() );
	if ( ! is_array( $all ) ) {
		$all = array();
	}

	if ( $request->get_param( 'reset' ) ) {
		unset( $all[ $gid ] );
		update_option( 'bb_galleries', $all, false );
		return array(
			'saved' => true,
			'count' => count( $defs[ $gid ]['items'] ),
		);
	}

	$items = $request->get_param( 'items' );
	if ( ! is_array( $items ) || count( $items ) > 600 ) {
		return new WP_Error( 'bb_bad_request', 'Brak danych do zapisania.', array( 'status' => 400 ) );
	}

	$def    = $defs[ $gid ];
	$map    = bb_gallery_cat_map( $def );
	$by_key = array();
	foreach ( $def['items'] as $it ) {
		$by_key[ $it['k'] ] = $it;
	}

	$entries = array();
	$seen    = array();
	foreach ( $items as $raw ) {
		if ( ! is_array( $raw ) ) {
			continue;
		}
		$att  = isset( $raw['att'] ) ? absint( $raw['att'] ) : 0;
		$att  = ( $att && bb_attachment_info( $att ) ) ? $att : 0;
		$cats = bb_gallery_clean_cats( isset( $raw['cats'] ) ? $raw['cats'] : array(), $map );
		$alt  = isset( $raw['alt'] ) ? mb_substr( sanitize_text_field( (string) $raw['alt'] ), 0, 300 ) : null;

		if ( isset( $raw['k'] ) ) {
			$key = sanitize_key( (string) $raw['k'] );
			if ( ! isset( $by_key[ $key ] ) || isset( $seen[ 'k' . $key ] ) ) {
				continue;
			}
			$seen[ 'k' . $key ] = true;
			$entry              = array( 'k' => $key );
			$def_cats           = array_values( array_filter( explode( ' ', (string) $by_key[ $key ]['cat'] ) ) );
			if ( isset( $raw['cats'] ) && ( array_diff( $cats, $def_cats ) || array_diff( $def_cats, $cats ) ) ) {
				$entry['cats'] = $cats;
			}
			$r = bb_img_resolve( $key );
			if ( null !== $alt && $alt !== wp_specialchars_decode( (string) $r['alt'], ENT_QUOTES ) ) {
				$entry['alt'] = $alt;
			}
			if ( $att ) {
				$entry['att'] = $att;
			}
			$entries[] = $entry;
			continue;
		}

		$uid = isset( $raw['u'] ) ? substr( preg_replace( '/[^a-z0-9]/', '', strtolower( (string) $raw['u'] ) ), 0, 16 ) : '';
		if ( '' === $uid || ! $att || isset( $seen[ 'u' . $uid ] ) ) {
			continue;
		}
		$seen[ 'u' . $uid ] = true;
		$entries[]          = array(
			'u'    => $uid,
			'att'  => $att,
			'cats' => $cats,
			'alt'  => ( null === $alt ) ? '' : $alt,
		);
	}

	$removed = array();
	foreach ( array_keys( $by_key ) as $key ) {
		if ( ! isset( $seen[ 'k' . $key ] ) ) {
			$removed[] = $key;
		}
	}

	$all[ $gid ] = array(
		'items'   => $entries,
		'removed' => $removed,
	);
	update_option( 'bb_galleries', $all, false );
	return array(
		'saved' => true,
		'count' => count( $entries ),
	);
}
