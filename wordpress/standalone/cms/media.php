<?php
/**
 * Wgrywanie zdjęć przez edytor (odpowiednik biblioteki mediów WordPressa).
 *
 * Edytor wysyła plik jako surowe dane (POST /cms-api/wp/v2/media). Zdjęcie jest sprawdzane (tylko JPG, PNG, WebP),
 * obracane zgodnie z EXIF (zdjęcia z telefonu) i zapisywane od nowa w trzech rozmiarach (full do 2560 px, large do 1024 px,
 * medium do 400 px), najchętniej jako WebP. Nazwy plików są losowe, więc nic z nazwy wgrywanego pliku nie trafia na serwer.
 * Rejestr zdjęć: data/media.php ( id => [ sizes, alt, created ] ).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function bb_json( $data, $status = 200 ) {
	http_response_code( $status );
	header( 'Content-Type: application/json; charset=utf-8' );
	header( 'Cache-Control: no-store' );
	echo wp_json_encode( $data );
	exit;
}

function bb_json_error( $message, $status = 400 ) {
	bb_json(
		array(
			'code'    => 'bb_error',
			'message' => $message,
			'data'    => array( 'status' => $status ),
		),
		$status
	);
}

/** Wartość z php.ini (np. 128M) w bajtach; -1 = bez limitu. */
function bb_ini_bytes( $value ) {
	$value = trim( (string) $value );
	if ( '' === $value || '-1' === $value ) {
		return -1;
	}
	$n    = (float) $value;
	$unit = strtolower( substr( $value, -1 ) );
	if ( 'g' === $unit ) {
		$n *= 1024 * 1024 * 1024;
	} elseif ( 'm' === $unit ) {
		$n *= 1024 * 1024;
	} elseif ( 'k' === $unit ) {
		$n *= 1024;
	}
	return (int) $n;
}

/** Czy da się wczytać obraz o danych wymiarach (GD potrzebuje ok. 5 bajtów na piksel). */
function bb_memory_ok( $w, $h ) {
	$limit = bb_ini_bytes( ini_get( 'memory_limit' ) );
	if ( $limit < 0 ) {
		return true;
	}
	$need = (int) ( $w * $h * 5.5 ) + memory_get_usage() + 8 * 1024 * 1024;
	if ( $need <= $limit ) {
		return true;
	}
	@ini_set( 'memory_limit', '512M' );
	$limit = bb_ini_bytes( ini_get( 'memory_limit' ) );
	return $limit < 0 || $need <= $limit;
}

/** Odczyt orientacji EXIF zdjęcia JPEG (1 = bez obrotu). */
function bb_exif_orientation( $bytes ) {
	if ( ! function_exists( 'exif_read_data' ) ) {
		return 1;
	}
	$dir = bb_data_dir();
	if ( ! is_dir( $dir ) ) {
		@mkdir( $dir, 0755, true );
	}
	$tmp = $dir . '/' . bin2hex( random_bytes( 6 ) ) . '.tmp';
	if ( false === @file_put_contents( $tmp, $bytes ) ) {
		return 1;
	}
	$exif = @exif_read_data( $tmp );
	@unlink( $tmp );
	return ( is_array( $exif ) && ! empty( $exif['Orientation'] ) ) ? (int) $exif['Orientation'] : 1;
}

/** Kopia obrazu zmniejszona tak, żeby dłuższy bok miał najwyżej $max px (albo ten sam obraz, gdy jest mniejszy). */
function bb_gd_scaled( $im, $max ) {
	$w = imagesx( $im );
	$h = imagesy( $im );
	if ( max( $w, $h ) <= $max ) {
		return array( $im, $w, $h );
	}
	$scale = $max / max( $w, $h );
	$nw    = max( 1, (int) round( $w * $scale ) );
	$nh    = max( 1, (int) round( $h * $scale ) );
	$dst   = imagecreatetruecolor( $nw, $nh );
	imagealphablending( $dst, false );
	imagesavealpha( $dst, true );
	imagefilledrectangle( $dst, 0, 0, $nw, $nh, imagecolorallocatealpha( $dst, 0, 0, 0, 127 ) );
	imagecopyresampled( $dst, $im, 0, 0, 0, 0, $nw, $nh, $w, $h );
	return array( $dst, $nw, $nh );
}

function bb_gd_free( $im ) {
	if ( PHP_VERSION_ID < 80000 && is_resource( $im ) ) {
		imagedestroy( $im );
	}
}

/**
 * Przetwarza wgrane dane zdjęcia i zapisuje rozmiary w uploads/RRRR/MM/.
 * Wynik: [ nazwa => [ f (ścieżka względem uploads), w, h ] ] albo komunikat błędu (string).
 */
function bb_media_process( $bytes, $info ) {
	$type = $info[2];
	$w    = (int) $info[0];
	$h    = (int) $info[1];
	$sub  = gmdate( 'Y' ) . '/' . gmdate( 'm' );
	$dir  = bb_root() . '/uploads/' . $sub;
	if ( ! is_dir( $dir ) && ! @mkdir( $dir, 0755, true ) ) {
		return 'Nie udało się utworzyć folderu na zdjęcia (sprawdź uprawnienia zapisu do folderu uploads).';
	}
	$base = bin2hex( random_bytes( 6 ) );

	// Bez GD (rzadkie): zapisujemy zdjęcie bez zmian i używamy go w każdym rozmiarze.
	if ( ! function_exists( 'imagecreatefromstring' ) ) {
		$ext = IMAGETYPE_PNG === $type ? 'png' : ( IMAGETYPE_WEBP === $type ? 'webp' : 'jpg' );
		$f   = $sub . '/' . $base . '-full.' . $ext;
		if ( false === @file_put_contents( bb_root() . '/uploads/' . $f, $bytes ) ) {
			return 'Nie udało się zapisać zdjęcia.';
		}
		$one = array( 'f' => $f, 'w' => $w, 'h' => $h );
		return array( 'full' => $one, 'large' => $one, 'medium' => $one );
	}

	if ( ! bb_memory_ok( $w, $h ) ) {
		return 'Zdjęcie ma za dużo pikseli jak na ten hosting (' . round( $w * $h / 1000000 ) . ' Mpx). Zmniejsz je do ok. 4000 px z dłuższego boku i spróbuj ponownie.';
	}
	$im = @imagecreatefromstring( $bytes );
	if ( ! $im ) {
		return 'Nie udało się odczytać zdjęcia (plik jest uszkodzony lub w nieobsługiwanym formacie).';
	}
	if ( IMAGETYPE_JPEG === $type ) {
		$angle = array( 3 => 180, 6 => -90, 8 => 90 );
		$o     = bb_exif_orientation( $bytes );
		if ( isset( $angle[ $o ] ) && function_exists( 'imagerotate' ) ) {
			$rot = @imagerotate( $im, $angle[ $o ], 0 );
			if ( $rot ) {
				bb_gd_free( $im );
				$im = $rot;
			}
		}
	}
	if ( ! imageistruecolor( $im ) && function_exists( 'imagepalettetotruecolor' ) ) {
		imagepalettetotruecolor( $im );
	}
	imagealphablending( $im, true );
	imagesavealpha( $im, true );

	$use_webp = function_exists( 'imagewebp' );
	$ext      = $use_webp ? 'webp' : ( IMAGETYPE_PNG === $type ? 'png' : 'jpg' );
	$out      = array();
	foreach ( array( 'full' => 2560, 'large' => 1024, 'medium' => 400 ) as $name => $max ) {
		list( $img, $iw, $ih ) = bb_gd_scaled( $im, $max );
		$f    = $sub . '/' . $base . '-' . $name . '.' . $ext;
		$path = bb_root() . '/uploads/' . $f;
		$ok   = false;
		if ( $use_webp ) {
			$ok = @imagewebp( $img, $path, 84 );
		} elseif ( 'png' === $ext ) {
			$ok = @imagepng( $img, $path, 6 );
		} else {
			$ok = @imagejpeg( $img, $path, 85 );
		}
		if ( $img !== $im ) {
			bb_gd_free( $img );
		}
		if ( ! $ok ) {
			bb_gd_free( $im );
			return 'Nie udało się zapisać zdjęcia (sprawdź uprawnienia zapisu do folderu uploads).';
		}
		$out[ $name ] = array( 'f' => $f, 'w' => $iw, 'h' => $ih );
	}
	bb_gd_free( $im );
	return $out;
}

/** Zdjęcie w postaci zbliżonej do odpowiedzi REST WordPressa (z niej korzysta edytor). */
function bb_media_item( $id, $rec ) {
	$sizes = array();
	foreach ( $rec['sizes'] as $name => $s ) {
		$sizes[ $name ] = array(
			'source_url' => bb_uploads_url( $s['f'] ),
			'width'      => (int) $s['w'],
			'height'     => (int) $s['h'],
		);
	}
	return array(
		'id'            => (int) $id,
		'alt_text'      => isset( $rec['alt'] ) ? (string) $rec['alt'] : '',
		'source_url'    => bb_uploads_url( $rec['sizes']['full']['f'] ),
		'media_type'    => 'image',
		'media_details' => array(
			'width'  => (int) $rec['sizes']['full']['w'],
			'height' => (int) $rec['sizes']['full']['h'],
			'sizes'  => $sizes,
		),
	);
}

function bb_media_upload() {
	$body = file_get_contents( 'php://input' );
	if ( ! is_string( $body ) || '' === $body ) {
		bb_json_error( 'Nie udało się odebrać pliku: jest pusty albo za duży dla tego hostingu (limit żądania: ' . ini_get( 'post_max_size' ) . ').', 413 );
	}
	if ( strlen( $body ) > 30 * 1024 * 1024 ) {
		bb_json_error( 'Plik jest za duży (najwyżej 30 MB). Zmniejsz zdjęcie i spróbuj ponownie.', 413 );
	}
	$info = @getimagesizefromstring( $body );
	if ( ! $info || ! in_array( $info[2], array( IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP ), true ) ) {
		bb_json_error( 'Dozwolone są zdjęcia w formacie JPG, PNG lub WebP.', 415 );
	}
	if ( $info[0] < 1 || $info[1] < 1 || $info[0] * $info[1] > 120000000 ) {
		bb_json_error( 'Zdjęcie ma nieprawidłowe wymiary.', 400 );
	}
	$sizes = bb_media_process( $body, $info );
	if ( is_string( $sizes ) ) {
		bb_json_error( $sizes, 400 );
	}
	$result = bb_lock(
		function () use ( $sizes ) {
			$all = bb_data_read( 'media' );
			$id  = $all ? max( array_map( 'intval', array_keys( $all ) ) ) + 1 : 1001;
			$rec = array(
				'sizes'   => $sizes,
				'alt'     => '',
				'created' => time(),
			);
			$all[ $id ] = $rec;
			bb_data_write( 'media', $all );
			return bb_media_item( $id, $rec );
		}
	);
	bb_json( $result, 201 );
}

/** Lista wgranych zdjęć (najnowsze pierwsze), dla okna „Wybierz z biblioteki”. */
function bb_media_list() {
	$all = bb_data_read( 'media' );
	krsort( $all, SORT_NUMERIC );
	$out = array();
	foreach ( array_slice( $all, 0, 300, true ) as $id => $rec ) {
		$out[] = bb_media_item( $id, $rec );
	}
	bb_json( $out );
}
