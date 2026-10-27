<?php
/**
 * Warstwa zgodności z WordPressem na zwykłym hostingu PHP.
 *
 * Szablony i edytor motywu (theme/) korzystają z kilkudziesięciu funkcji WordPressa. Tu mają one swoje odpowiedniki,
 * więc ten sam motyw działa bez WordPressa: opcje w plikach (store.php), logowanie (auth.php), wgrywanie zdjęć (media.php).
 * Adresy są względne (od katalogu głównego domeny), więc strona działa też w podkatalogu.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BB_STANDALONE', true );

require_once __DIR__ . '/store.php';
require_once __DIR__ . '/auth.php';

/* ---------- adresy ---------- */

/** Podkatalog, w którym leży strona ('' gdy w katalogu głównym domeny). */
function bb_base_path() {
	static $base = null;
	if ( null === $base ) {
		$script = isset( $_SERVER['SCRIPT_NAME'] ) ? str_replace( '\\', '/', (string) $_SERVER['SCRIPT_NAME'] ) : '/index.php';
		$dir    = rtrim( str_replace( '\\', '/', dirname( $script ) ), '/' );
		$base   = ( '.' === $dir || '' === $dir ) ? '' : $dir;
	}
	return $base;
}

/** Ścieżka żądania względem strony (zaczyna się od /). */
function bb_request_path() {
	$uri  = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '/';
	$path = rawurldecode( (string) parse_url( $uri, PHP_URL_PATH ) );
	$base = bb_base_path();
	if ( '' !== $base && 0 === strpos( $path, $base . '/' ) ) {
		$path = substr( $path, strlen( $base ) );
	} elseif ( '' !== $base && $path === $base ) {
		$path = '/';
	}
	if ( '' === $path || '/' !== $path[0] ) {
		$path = '/' . $path;
	}
	return ( '/index.php' === $path ) ? '/' : $path;
}

function home_url( $path = '' ) {
	return bb_base_path() . '/' . ltrim( (string) $path, '/' );
}

function get_template_directory_uri() {
	return bb_base_path() . '/theme';
}

function get_theme_file_uri( $file = '' ) {
	return get_template_directory_uri() . '/' . ltrim( (string) $file, '/' );
}

function get_theme_file_path( $file = '' ) {
	return bb_root() . '/theme/' . ltrim( (string) $file, '/' );
}

function rest_url( $path = '' ) {
	return bb_base_path() . '/cms-api/' . ltrim( (string) $path, '/' );
}

function language_attributes() {
	echo 'lang="pl"';
}

function bloginfo( $what = '' ) {
	echo 'charset' === $what ? 'UTF-8' : 'DJ Błażej Biurkowski';
}

/* ---------- haki (akcje) ---------- */

$GLOBALS['bb_hooks'] = array();

function add_action( $hook, $callback, $priority = 10, $args = 1 ) {
	$GLOBALS['bb_hooks'][ $hook ][ (int) $priority ][] = $callback;
}

function do_action( $hook ) {
	if ( empty( $GLOBALS['bb_hooks'][ $hook ] ) ) {
		return;
	}
	$by_priority = $GLOBALS['bb_hooks'][ $hook ];
	ksort( $by_priority );
	foreach ( $by_priority as $callbacks ) {
		foreach ( $callbacks as $callback ) {
			call_user_func( $callback );
		}
	}
}

function remove_action() {
	return true;
}

function add_theme_support() {}

function wp_dequeue_style() {}

function wp_enqueue_media() {}

/* ---------- style i skrypty (wp_head / wp_footer) ---------- */

$GLOBALS['bb_styles']    = array();
$GLOBALS['bb_scripts']   = array();
$GLOBALS['bb_localized'] = array();

function wp_enqueue_style( $handle, $src = '', $deps = array(), $ver = false ) {
	$GLOBALS['bb_styles'][ $handle ] = array( $src, $ver );
}

function wp_enqueue_script( $handle, $src = '', $deps = array(), $ver = false, $in_footer = false ) {
	$GLOBALS['bb_scripts'][ $handle ] = array( $src, $ver );
}

function wp_localize_script( $handle, $name, $data ) {
	$GLOBALS['bb_localized'][ $handle ][ $name ] = $data;
	return true;
}

function bb_asset_url( $src, $ver ) {
	return htmlspecialchars( $src . ( $ver ? ( false === strpos( $src, '?' ) ? '?' : '&' ) . 'ver=' . $ver : '' ), ENT_QUOTES, 'UTF-8' );
}

function wp_head() {
	static $done = false;
	if ( ! $done ) {
		$done = true;
		do_action( 'wp_enqueue_scripts' );
	}
	foreach ( $GLOBALS['bb_styles'] as $style ) {
		echo '<link rel="stylesheet" href="' . bb_asset_url( $style[0], $style[1] ) . '">' . "\n";
	}
	do_action( 'wp_head' );
}

function wp_footer() {
	do_action( 'wp_footer' );
	foreach ( $GLOBALS['bb_scripts'] as $handle => $script ) {
		if ( ! empty( $GLOBALS['bb_localized'][ $handle ] ) ) {
			foreach ( $GLOBALS['bb_localized'][ $handle ] as $name => $data ) {
				echo '<script>var ' . preg_replace( '/[^A-Za-z0-9_]/', '', $name ) . ' = ' . wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . ";</script>\n";
			}
		}
		echo '<script src="' . bb_asset_url( $script[0], $script[1] ) . '"></script>' . "\n";
	}
}

/* ---------- uprawnienia ---------- */

function is_user_logged_in() {
	return null !== bb_session();
}

function current_user_can( $capability ) {
	return null !== bb_session();   // jedno konto: administrator
}

function wp_create_nonce( $action = '' ) {
	return bb_nonce();
}

/* ---------- oczyszczanie i zabezpieczanie danych ---------- */

function absint( $n ) {
	return abs( (int) $n );
}

function sanitize_key( $key ) {
	return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
}

function wp_strip_all_tags( $text ) {
	return trim( strip_tags( (string) $text ) );
}

function sanitize_text_field( $text ) {
	return trim( preg_replace( '/\s+/u', ' ', strip_tags( (string) $text ) ) );
}

function wp_json_encode( $data, $flags = 0 ) {
	return json_encode( $data, $flags );
}

function wp_specialchars_decode( $text, $quote_style = ENT_NOQUOTES ) {
	return htmlspecialchars_decode( (string) $text, $quote_style );
}

function esc_attr( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8', false );
}

function esc_html( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8', false );
}

function is_email( $email ) {
	return false !== filter_var( (string) $email, FILTER_VALIDATE_EMAIL );
}

/**
 * Adres po oczyszczeniu: bez znaków sterujących, z dozwolonym protokołem (albo względny).
 * Znaki zapisane jako encje (&#106;avascript:) są najpierw dekodowane, więc nie da się w ten sposób ominąć sprawdzenia.
 */
function bb_clean_url( $url, $protocols = null ) {
	$url = html_entity_decode( (string) $url, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	$url = preg_replace( '/[\x00-\x1F\x7F]+/', '', $url );   // znaki sterujące (przeglądarki ignorują je w adresie, np. java\tscript:)
	$url = str_replace( ' ', '%20', trim( (string) $url ) );
	if ( '' === $url ) {
		return '';
	}
	$protocols = $protocols ? $protocols : array( 'http', 'https', 'mailto', 'tel' );
	if ( preg_match( '#^([a-z][a-z0-9+.\-]*):#i', $url, $m ) && ! in_array( strtolower( $m[1] ), $protocols, true ) ) {
		return '';
	}
	return $url;
}

function esc_url( $url, $protocols = null ) {
	return htmlspecialchars( bb_clean_url( $url, $protocols ), ENT_QUOTES, 'UTF-8', true );
}

function esc_url_raw( $url, $protocols = null ) {
	return bb_clean_url( $url, $protocols );
}

/**
 * Filtr HTML: zostają tylko dozwolone znaczniki z dozwolonymi atrybutami ($allowed: [ znacznik => [ atrybut => true ] ]).
 * Znaczniki są domykane, obce usuwane (zostaje ich tekst), a pojedyncze < > & zamieniane na encje.
 */
function wp_kses( $html, $allowed ) {
	$allowed = array_change_key_case( (array) $allowed, CASE_LOWER );
	$parts   = preg_split( '/(<\/?[a-zA-Z][a-zA-Z0-9]*(?:"[^"]*"|\'[^\']*\'|[^>"\'])*>)/', (string) $html, -1, PREG_SPLIT_DELIM_CAPTURE );
	$out     = '';
	$stack   = array();
	$void    = array( 'br', 'hr', 'img' );

	foreach ( $parts as $i => $part ) {
		if ( 0 === $i % 2 ) {
			$text = preg_replace( '/&(?!(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6});)/', '&amp;', $part );
			$out .= str_replace( array( '<', '>' ), array( '&lt;', '&gt;' ), $text );
			continue;
		}
		if ( ! preg_match( '/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)(.*?)\/?>$/s', $part, $m ) ) {
			continue;
		}
		$closing = '/' === $m[1];
		$name    = strtolower( $m[2] );
		if ( ! isset( $allowed[ $name ] ) ) {
			continue;
		}
		if ( $closing ) {
			if ( in_array( $name, $void, true ) ) {
				continue;
			}
			if ( ! in_array( $name, $stack, true ) ) {
				continue;
			}
			while ( ! empty( $stack ) ) {
				$top  = array_pop( $stack );
				$out .= '</' . $top . '>';
				if ( $top === $name ) {
					break;
				}
			}
			continue;
		}
		$attrs = '';
		if ( preg_match_all( '/([a-zA-Z][a-zA-Z0-9_:-]*)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s"\'>]+))/', $m[3], $am, PREG_SET_ORDER ) ) {
			$seen = array();
			foreach ( $am as $a ) {
				$an = strtolower( $a[1] );
				if ( isset( $seen[ $an ] ) || empty( $allowed[ $name ][ $an ] ) ) {
					continue;
				}
				$seen[ $an ] = true;
				$val         = isset( $a[4] ) ? $a[4] : ( isset( $a[3] ) && '' !== $a[3] ? $a[3] : $a[2] );
				if ( 'class' === $an ) {
					$val = trim( preg_replace( '/[^\w\- ]/u', '', $val ) );
					if ( '' === $val ) {
						continue;
					}
				} else {
					$val = htmlspecialchars( html_entity_decode( $val, ENT_QUOTES, 'UTF-8' ), ENT_QUOTES, 'UTF-8' );
				}
				$attrs .= ' ' . $an . '="' . $val . '"';
			}
		}
		$out .= '<' . $name . $attrs . '>';
		if ( ! in_array( $name, $void, true ) ) {
			$stack[] = $name;
		}
	}
	while ( ! empty( $stack ) ) {
		$out .= '</' . array_pop( $stack ) . '>';
	}
	return $out;
}

/* ---------- błędy i żądania REST ---------- */

class WP_Error {
	public $code;
	public $message;
	public $data;

	public function __construct( $code = '', $message = '', $data = array() ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}
}

class WP_REST_Request {
	private $params;

	public function __construct( $params = array() ) {
		$this->params = is_array( $params ) ? $params : array();
	}

	public function get_param( $key ) {
		return isset( $this->params[ $key ] ) ? $this->params[ $key ] : null;
	}
}

$GLOBALS['bb_routes'] = array();

function register_rest_route( $namespace, $route, $args = array() ) {
	$GLOBALS['bb_routes'][ trim( $namespace, '/' ) . '/' . trim( $route, '/' ) ] = $args;
}

/* ---------- zdjęcia z biblioteki (wgrane przez edytor, patrz media.php) ---------- */

function bb_media_all() {
	return bb_data_read( 'media' );
}

function bb_uploads_url( $relative ) {
	return bb_base_path() . '/uploads/' . ltrim( (string) $relative, '/' );
}

function wp_attachment_is_image( $id ) {
	$all = bb_media_all();
	return isset( $all[ (int) $id ] );
}

/** [ adres, szerokość, wysokość, true ] dla rozmiaru ('full', 'large', 'medium') albo false. */
function wp_get_attachment_image_src( $id, $size = 'thumbnail' ) {
	$all = bb_media_all();
	$id  = (int) $id;
	if ( ! isset( $all[ $id ]['sizes'] ) ) {
		return false;
	}
	$sizes = $all[ $id ]['sizes'];
	$use   = isset( $sizes[ $size ] ) ? $sizes[ $size ] : ( isset( $sizes['large'] ) && 'full' !== $size ? $sizes['large'] : $sizes['full'] );
	return array( bb_uploads_url( $use['f'] ), (int) $use['w'], (int) $use['h'], true );
}

function wp_get_attachment_image_url( $id, $size = 'thumbnail' ) {
	$src = wp_get_attachment_image_src( $id, $size );
	return $src ? $src[0] : false;
}

function wp_get_attachment_url( $id ) {
	$all = bb_media_all();
	$id  = (int) $id;
	return isset( $all[ $id ]['sizes']['full']['f'] ) ? bb_uploads_url( $all[ $id ]['sizes']['full']['f'] ) : false;
}

function get_post_meta( $id, $key = '', $single = false ) {
	$all = bb_media_all();
	$id  = (int) $id;
	if ( '_wp_attachment_image_alt' === $key && isset( $all[ $id ] ) ) {
		return isset( $all[ $id ]['alt'] ) ? (string) $all[ $id ]['alt'] : '';
	}
	return '';
}

/** Dodatkowe ustawienia dla edytora na stronie (poza WordPressem: wylogowanie i lista wgranych zdjęć). */
function bb_extra_editor_config() {
	return array(
		'logout'        => home_url( '/admin/logout' ),
		'restMediaList' => rest_url( 'wp/v2/media' ),
	);
}

require_once __DIR__ . '/media.php';
require_once __DIR__ . '/rest.php';
require_once __DIR__ . '/admin.php';
