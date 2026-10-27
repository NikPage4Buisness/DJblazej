<?php
/**
 * Przechowywanie danych (bez bazy danych): pliki w folderze data/.
 *
 * Każdy plik ma rozszerzenie .php i zaczyna się od zabezpieczenia (BB_GUARD), więc serwer nigdy nie pokaże jego treści,
 * nawet jeśli nie działa ochrona z .htaccess (np. nginx). Treść to JSON po pierwszej linii.
 * Przed każdą zmianą opcji zapisujemy poprzednią wersję w data/history/ (ostatnie 60), z możliwością przywrócenia w panelu.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BB_GUARD', "<?php http_response_code( 404 ); exit; ?>\n" );

function bb_root() {
	return rtrim( str_replace( '\\', '/', ABSPATH ), '/' );
}

function bb_data_dir() {
	return bb_root() . '/data';
}

function bb_data_path( $name ) {
	return bb_data_dir() . '/' . preg_replace( '/[^a-z0-9_-]/i', '', (string) $name ) . '.php';
}

/** Odczyt pliku danych (tablica). Brak pliku lub uszkodzona treść: wartość domyślna. */
function bb_data_read( $name, $default = array() ) {
	$file = bb_data_path( $name );
	if ( ! is_file( $file ) ) {
		return $default;
	}
	$raw = @file_get_contents( $file );
	if ( false === $raw || 0 !== strpos( $raw, BB_GUARD ) ) {
		return $default;
	}
	$data = json_decode( substr( $raw, strlen( BB_GUARD ) ), true );
	return is_array( $data ) ? $data : $default;
}

/** Zapis pliku danych: najpierw plik tymczasowy, potem podmiana, żeby przerwany zapis nie uszkodził danych. */
function bb_data_write( $name, $data ) {
	$dir = bb_data_dir();
	if ( ! is_dir( $dir ) && ! @mkdir( $dir, 0755, true ) ) {
		return false;
	}
	$json = json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
	if ( false === $json ) {
		return false;
	}
	$file = bb_data_path( $name );
	$tmp  = $dir . '/' . preg_replace( '/[^a-z0-9_-]/i', '', (string) $name ) . '.' . bin2hex( random_bytes( 4 ) ) . '.tmp.php';
	if ( false === @file_put_contents( $tmp, BB_GUARD . $json ) ) {
		return false;
	}
	if ( ! @rename( $tmp, $file ) ) {
		$ok = @copy( $tmp, $file );
		@unlink( $tmp );
		return $ok;
	}
	return true;
}

/** Wykonuje funkcję z blokadą (jeden zapis naraz). */
function bb_lock( $callback ) {
	$dir = bb_data_dir();
	if ( ! is_dir( $dir ) ) {
		@mkdir( $dir, 0755, true );
	}
	$fp = @fopen( $dir . '/.lock', 'c' );
	if ( $fp ) {
		flock( $fp, LOCK_EX );
	}
	try {
		return call_user_func( $callback );
	} finally {
		if ( $fp ) {
			flock( $fp, LOCK_UN );
			fclose( $fp );
		}
	}
}

/** Kopia poprzedniej wersji pliku w data/history/ (zostaje 60 ostatnich). */
function bb_snapshot( $name ) {
	$src = bb_data_path( $name );
	if ( ! is_file( $src ) ) {
		return;
	}
	$dir = bb_data_dir() . '/history';
	if ( ! is_dir( $dir ) ) {
		@mkdir( $dir, 0755, true );
		@file_put_contents( $dir . '/index.html', '' );
	}
	$name = preg_replace( '/[^a-z0-9_-]/i', '', (string) $name );
	@copy( $src, $dir . '/' . $name . '-' . gmdate( 'Ymd-His' ) . '-' . substr( bin2hex( random_bytes( 2 ) ), 0, 4 ) . '.php' );
	$files = glob( $dir . '/' . $name . '-*.php' );
	if ( is_array( $files ) ) {
		sort( $files );
		while ( count( $files ) > 60 ) {
			@unlink( array_shift( $files ) );
		}
	}
}

/** Lista zapisanych wersji opcji (najnowsze pierwsze): [ [ file, time ], ... ]. */
function bb_history_list() {
	$files = glob( bb_data_dir() . '/history/options-*.php' );
	$out   = array();
	if ( is_array( $files ) ) {
		rsort( $files );
		foreach ( $files as $f ) {
			if ( preg_match( '/options-(\d{8})-(\d{6})-[a-f0-9]{4}\.php$/', $f, $m ) ) {
				$out[] = array(
					'file' => basename( $f ),
					'time' => gmmktime( (int) substr( $m[2], 0, 2 ), (int) substr( $m[2], 2, 2 ), (int) substr( $m[2], 4, 2 ), (int) substr( $m[1], 4, 2 ), (int) substr( $m[1], 6, 2 ), (int) substr( $m[1], 0, 4 ) ),
				);
			}
		}
	}
	return $out;
}

/** Przywraca zapisaną wersję opcji (wcześniej zapisuje bieżącą w historii). */
function bb_history_restore( $file ) {
	if ( ! preg_match( '/^options-\d{8}-\d{6}-[a-f0-9]{4}\.php$/', (string) $file ) ) {
		return false;
	}
	$src = bb_data_dir() . '/history/' . $file;
	if ( ! is_file( $src ) ) {
		return false;
	}
	return bb_lock(
		function () use ( $src ) {
			$raw = @file_get_contents( $src );
			if ( false === $raw || 0 !== strpos( $raw, BB_GUARD ) || ! is_array( json_decode( substr( $raw, strlen( BB_GUARD ) ), true ) ) ) {
				return false;
			}
			bb_snapshot( 'options' );
			return false !== @file_put_contents( bb_data_path( 'options' ), $raw );
		}
	);
}

/* ---------- opcje (jak w WordPressie) ---------- */

function get_option( $key, $default = false ) {
	$all = bb_data_read( 'options' );
	return array_key_exists( $key, $all ) ? $all[ $key ] : $default;
}

function update_option( $key, $value, $autoload = null ) {
	return bb_lock(
		function () use ( $key, $value ) {
			$all = bb_data_read( 'options' );
			bb_snapshot( 'options' );
			$all[ $key ] = $value;
			return bb_data_write( 'options', $all );
		}
	);
}
