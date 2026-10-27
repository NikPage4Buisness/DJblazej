<?php
/**
 * Logowanie do edycji strony (bez WordPressa).
 *
 * - Jedno konto: login i hasło (hasło zapisane jako skrót password_hash, nigdy jawnie).
 * - Pierwsze uruchomienie: konto zakłada się w /admin kodem instalacyjnym z paczki (data/setup.php zawiera tylko jego skrót).
 * - Sesja: losowy token w ciasteczku (HttpOnly, SameSite=Lax, Secure na https), na serwerze zapisany tylko jego skrót.
 * - Zmiany z edytora wymagają dodatkowo nagłówka X-WP-Nonce (token wyliczony z sesji), więc inna strona nie wyśle ich w imieniu zalogowanego.
 * - Po 5 błędnych próbach logowania z jednego adresu IP logowanie jest blokowane na 15 minut.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BB_COOKIE', 'bb_session' );
define( 'BB_SESSION_DAYS', 14 );

function bb_is_https() {
	if ( ! empty( $_SERVER['HTTPS'] ) && 'off' !== strtolower( (string) $_SERVER['HTTPS'] ) ) {
		return true;
	}
	if ( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && 'https' === strtolower( (string) $_SERVER['HTTP_X_FORWARDED_PROTO'] ) ) {
		return true;
	}
	return isset( $_SERVER['SERVER_PORT'] ) && 443 === (int) $_SERVER['SERVER_PORT'];
}

function bb_client_ip() {
	return isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
}

function bb_auth_data() {
	return bb_data_read( 'auth' );
}

function bb_auth_configured() {
	$a = bb_auth_data();
	return ! empty( $a['user'] ) && ! empty( $a['hash'] );
}

/* ---------- ograniczanie prób ---------- */

/** Ile sekund jeszcze trwa blokada (0 = można próbować). */
function bb_throttle_wait() {
	$all = bb_data_read( 'throttle' );
	$k   = hash( 'sha256', bb_client_ip() );
	if ( isset( $all[ $k ]['until'] ) && $all[ $k ]['until'] > time() ) {
		return (int) $all[ $k ]['until'] - time();
	}
	return 0;
}

function bb_throttle_fail() {
	bb_lock(
		function () {
			$all = bb_data_read( 'throttle' );
			$now = time();
			foreach ( $all as $k => $e ) {
				if ( empty( $e['first'] ) || $now - (int) $e['first'] > 3600 ) {
					unset( $all[ $k ] );
				}
			}
			$k = hash( 'sha256', bb_client_ip() );
			$e = isset( $all[ $k ] ) ? $all[ $k ] : array( 'n' => 0, 'first' => $now );
			if ( $now - (int) $e['first'] > 900 ) {
				$e = array( 'n' => 0, 'first' => $now );
			}
			$e['n'] = (int) $e['n'] + 1;
			if ( $e['n'] >= 5 ) {
				$e = array( 'n' => 0, 'first' => $now, 'until' => $now + 900 );
			}
			$all[ $k ] = $e;
			bb_data_write( 'throttle', $all );
		}
	);
}

function bb_throttle_clear() {
	bb_lock(
		function () {
			$all = bb_data_read( 'throttle' );
			unset( $all[ hash( 'sha256', bb_client_ip() ) ] );
			bb_data_write( 'throttle', $all );
		}
	);
}

/* ---------- pierwsze uruchomienie, logowanie, sesja ---------- */

/** Zakłada konto kodem instalacyjnym. Zwraca true albo ustawia komunikat błędu. */
function bb_auth_setup( $code, $user, $pass, &$error ) {
	if ( bb_auth_configured() ) {
		$error = 'Konto jest już utworzone.';
		return false;
	}
	$wait = bb_throttle_wait();
	if ( $wait > 0 ) {
		$error = 'Zbyt wiele prób. Spróbuj ponownie za ' . (int) ceil( $wait / 60 ) . ' min.';
		return false;
	}
	$setup = bb_data_read( 'setup' );
	if ( empty( $setup['hash'] ) || ! hash_equals( (string) $setup['hash'], hash( 'sha256', trim( (string) $code ) ) ) ) {
		bb_throttle_fail();
		$error = 'Nieprawidłowy kod instalacyjny.';
		return false;
	}
	$user = trim( (string) $user );
	if ( ! preg_match( '/^[A-Za-z0-9._@-]{3,40}$/', $user ) ) {
		$error = 'Login ma mieć od 3 do 40 znaków: litery, cyfry oraz . _ @ -';
		return false;
	}
	if ( strlen( (string) $pass ) < 10 ) {
		$error = 'Hasło musi mieć co najmniej 10 znaków.';
		return false;
	}
	$ok = bb_data_write(
		'auth',
		array(
			'user'    => $user,
			'hash'    => password_hash( (string) $pass, PASSWORD_DEFAULT ),
			'created' => time(),
		)
	);
	if ( ! $ok ) {
		$error = 'Nie udało się zapisać konta (sprawdź uprawnienia zapisu do folderu data).';
		return false;
	}
	@unlink( bb_data_path( 'setup' ) );
	bb_throttle_clear();
	return true;
}

function bb_login( $user, $pass, &$error ) {
	$wait = bb_throttle_wait();
	if ( $wait > 0 ) {
		$error = 'Zbyt wiele prób logowania. Spróbuj ponownie za ' . (int) ceil( $wait / 60 ) . ' min.';
		return false;
	}
	$a       = bb_auth_data();
	$hash    = ! empty( $a['hash'] ) ? $a['hash'] : '$2y$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234';
	$pass_ok = password_verify( (string) $pass, $hash );
	$user_ok = ! empty( $a['user'] ) && hash_equals( (string) $a['user'], trim( (string) $user ) );
	if ( ! $pass_ok || ! $user_ok ) {
		bb_throttle_fail();
		$error = 'Nieprawidłowy login lub hasło.';
		return false;
	}
	bb_throttle_clear();
	bb_session_create( (string) $a['user'] );
	return true;
}

function bb_cookie_options( $expires ) {
	return array(
		'expires'  => $expires,
		'path'     => bb_base_path() . '/',
		'secure'   => bb_is_https(),
		'httponly' => true,
		'samesite' => 'Lax',
	);
}

function bb_session_create( $user ) {
	$token = bin2hex( random_bytes( 32 ) );
	bb_lock(
		function () use ( $token, $user ) {
			$all = bb_data_read( 'sessions' );
			$now = time();
			foreach ( $all as $h => $s ) {
				if ( empty( $s['exp'] ) || $s['exp'] < $now ) {
					unset( $all[ $h ] );
				}
			}
			$all[ hash( 'sha256', $token ) ] = array(
				'user' => $user,
				'exp'  => $now + BB_SESSION_DAYS * 86400,
			);
			bb_data_write( 'sessions', $all );
		}
	);
	setcookie( BB_COOKIE, $token, bb_cookie_options( time() + BB_SESSION_DAYS * 86400 ) );
	$_COOKIE[ BB_COOKIE ] = $token;
	$GLOBALS['bb_session_cache'] = null;
}

/** Bieżąca sesja: [ token, user ] albo null. */
function bb_session() {
	if ( array_key_exists( 'bb_session_cache', $GLOBALS ) && null !== $GLOBALS['bb_session_cache'] ) {
		return $GLOBALS['bb_session_cache'] ?: null;
	}
	$token = isset( $_COOKIE[ BB_COOKIE ] ) ? (string) $_COOKIE[ BB_COOKIE ] : '';
	$res   = false;
	if ( preg_match( '/^[a-f0-9]{64}$/', $token ) ) {
		$all = bb_data_read( 'sessions' );
		$h   = hash( 'sha256', $token );
		if ( isset( $all[ $h ]['exp'] ) && $all[ $h ]['exp'] >= time() ) {
			$res = array(
				'token' => $token,
				'user'  => (string) $all[ $h ]['user'],
			);
		}
	}
	$GLOBALS['bb_session_cache'] = $res;
	return $res ?: null;
}

function bb_logout() {
	$s = bb_session();
	if ( $s ) {
		bb_lock(
			function () use ( $s ) {
				$all = bb_data_read( 'sessions' );
				unset( $all[ hash( 'sha256', $s['token'] ) ] );
				bb_data_write( 'sessions', $all );
			}
		);
	}
	setcookie( BB_COOKIE, '', bb_cookie_options( time() - 3600 ) );
	unset( $_COOKIE[ BB_COOKIE ] );
	$GLOBALS['bb_session_cache'] = false;
}

/** Token bezpieczeństwa dla żądań z edytora i formularzy panelu (zależy od sesji). */
function bb_nonce() {
	$s = bb_session();
	return $s ? hash_hmac( 'sha256', 'wp_rest', $s['token'] ) : '';
}

function bb_check_nonce( $sent ) {
	$n = bb_nonce();
	return '' !== $n && hash_equals( $n, (string) $sent );
}

/** Zmiana hasła (po podaniu obecnego). Pozostałe sesje są wylogowywane. */
function bb_auth_change_password( $current, $new, &$error ) {
	$a = bb_auth_data();
	if ( empty( $a['hash'] ) || ! password_verify( (string) $current, $a['hash'] ) ) {
		$error = 'Obecne hasło jest nieprawidłowe.';
		return false;
	}
	if ( strlen( (string) $new ) < 10 ) {
		$error = 'Nowe hasło musi mieć co najmniej 10 znaków.';
		return false;
	}
	$a['hash'] = password_hash( (string) $new, PASSWORD_DEFAULT );
	if ( ! bb_data_write( 'auth', $a ) ) {
		$error = 'Nie udało się zapisać hasła.';
		return false;
	}
	$s = bb_session();
	bb_lock(
		function () use ( $s ) {
			$all  = bb_data_read( 'sessions' );
			$keep = array();
			if ( $s && isset( $all[ hash( 'sha256', $s['token'] ) ] ) ) {
				$keep[ hash( 'sha256', $s['token'] ) ] = $all[ hash( 'sha256', $s['token'] ) ];
			}
			bb_data_write( 'sessions', $keep );
		}
	);
	return true;
}
