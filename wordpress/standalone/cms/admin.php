<?php
/**
 * Panel /admin: pierwsze uruchomienie, logowanie, pulpit, zmiana hasła i historia zmian.
 * Sama edycja treści odbywa się na stronie (czerwony przycisk po zalogowaniu), tu są tylko sprawy konta.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function bb_h( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
}

function bb_redirect( $path, $status = 303 ) {
	header( 'Location: ' . $path, true, $status );
	exit;
}

function bb_admin_page( $title, $body ) {
	header( 'Content-Type: text/html; charset=UTF-8' );
	header( 'Cache-Control: no-store' );
	header( 'X-Frame-Options: DENY' );
	header( 'X-Content-Type-Options: nosniff' );
	header( 'Referrer-Policy: same-origin' );
	echo '<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
		. '<meta name="robots" content="noindex, nofollow"><title>' . bb_h( $title ) . '</title><style>'
		. '*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#f2f2f2;color:#111;font:16px/1.5 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}'
		. '.card{width:min(520px,100%);background:#fff;border-radius:18px;padding:28px;box-shadow:0 12px 40px rgba(0,0,0,.12)}'
		. 'h1{margin:0 0 6px;font-size:24px}p{margin:8px 0}.muted{color:#666;font-size:14px}'
		. 'label{display:block;margin:14px 0 4px;font-weight:600}input[type=text],input[type=password]{width:100%;padding:12px 14px;border:1px solid #bbb;border-radius:10px;font:inherit}'
		. 'button,.btn{display:inline-block;margin-top:18px;padding:12px 20px;border:0;border-radius:10px;background:#e0262f;color:#fff;font-family:inherit;font-weight:600;font-size:16px;text-decoration:none;cursor:pointer}'
		. 'button:hover,.btn:hover{background:#f0343d}.btn--light{background:#eee;color:#111;margin-top:8px}.btn--light:hover{background:#ddd}'
		. '.err{margin:12px 0;padding:10px 14px;border-radius:10px;background:#fdecec;color:#9b1c1c}.ok{margin:12px 0;padding:10px 14px;border-radius:10px;background:#e8f7ee;color:#14663a}'
		. '.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}ul.list{list-style:none;margin:10px 0;padding:0}ul.list li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #eee}'
		. 'ul.list button{margin:0;padding:8px 14px;font-size:14px}a{color:#c01820}'
		. '</style></head><body><div class="card">' . $body . '</div></body></html>';
	exit;
}

function bb_admin_form_nonce() {
	return '<input type="hidden" name="_n" value="' . bb_h( bb_nonce() ) . '">';
}

function bb_format_time( $ts ) {
	try {
		$d = new DateTime( '@' . (int) $ts );
		$d->setTimezone( new DateTimeZone( 'Europe/Warsaw' ) );
		return $d->format( 'd.m.Y H:i:s' );
	} catch ( Exception $e ) {
		return gmdate( 'd.m.Y H:i:s', (int) $ts ) . ' UTC';
	}
}

function bb_admin( $path ) {
	$path   = rtrim( $path, '/' );
	$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : 'GET';
	$admin  = home_url( '/admin' );

	if ( '/admin/logout' === $path ) {
		bb_logout();
		bb_redirect( $admin );
	}

	/* --- pierwsze uruchomienie --- */
	if ( ! bb_auth_configured() ) {
		$error = '';
		if ( 'POST' === $method ) {
			if ( ( isset( $_POST['pass'] ) ? (string) $_POST['pass'] : '' ) !== ( isset( $_POST['pass2'] ) ? (string) $_POST['pass2'] : '' ) ) {
				$error = 'Hasła nie są takie same.';
			} elseif ( bb_auth_setup( isset( $_POST['code'] ) ? $_POST['code'] : '', isset( $_POST['user'] ) ? $_POST['user'] : '', isset( $_POST['pass'] ) ? $_POST['pass'] : '', $error ) ) {
				bb_login( $_POST['user'], $_POST['pass'], $error );
				bb_redirect( home_url( '/' ) );
			}
		}
		$no_code = ! is_file( bb_data_path( 'setup' ) );
		bb_admin_page(
			'Pierwsze uruchomienie',
			'<h1>Pierwsze uruchomienie</h1><p class="muted">Załóż konto do edycji strony. Kod instalacyjny jest w pliku od osoby, która wdrożyła stronę.</p>'
			. ( $error ? '<div class="err">' . bb_h( $error ) . '</div>' : '' )
			. ( $no_code ? '<div class="err">Brakuje pliku data/setup.php z paczki instalacyjnej. Wgraj go ponownie na serwer.</div>' : '' )
			. '<form method="post" autocomplete="off"><label for="code">Kod instalacyjny</label><input type="text" id="code" name="code" required>'
			. '<label for="user">Login (3 do 40 znaków)</label><input type="text" id="user" name="user" required autocomplete="username">'
			. '<label for="pass">Hasło (co najmniej 10 znaków)</label><input type="password" id="pass" name="pass" required autocomplete="new-password">'
			. '<label for="pass2">Powtórz hasło</label><input type="password" id="pass2" name="pass2" required autocomplete="new-password">'
			. '<button type="submit">Załóż konto</button></form>'
		);
	}

	/* --- logowanie --- */
	if ( ! bb_session() ) {
		$error = '';
		if ( 'POST' === $method && bb_login( isset( $_POST['user'] ) ? $_POST['user'] : '', isset( $_POST['pass'] ) ? $_POST['pass'] : '', $error ) ) {
			bb_redirect( home_url( '/' ) );
		}
		bb_admin_page(
			'Logowanie',
			'<h1>Logowanie</h1><p class="muted">Edycja strony.</p>'
			. ( $error ? '<div class="err">' . bb_h( $error ) . '</div>' : '' )
			. '<form method="post"><label for="user">Login</label><input type="text" id="user" name="user" required autocomplete="username" autofocus>'
			. '<label for="pass">Hasło</label><input type="password" id="pass" name="pass" required autocomplete="current-password">'
			. '<button type="submit">Zaloguj</button></form>'
		);
	}

	$session = bb_session();

	/* --- zmiana hasła --- */
	if ( '/admin/password' === $path ) {
		$error = '';
		$done  = false;
		if ( 'POST' === $method ) {
			if ( ! bb_check_nonce( isset( $_POST['_n'] ) ? $_POST['_n'] : '' ) ) {
				$error = 'Sesja wygasła. Odśwież stronę i spróbuj ponownie.';
			} elseif ( ( isset( $_POST['new'] ) ? (string) $_POST['new'] : '' ) !== ( isset( $_POST['new2'] ) ? (string) $_POST['new2'] : '' ) ) {
				$error = 'Nowe hasła nie są takie same.';
			} else {
				$done = bb_auth_change_password( isset( $_POST['current'] ) ? $_POST['current'] : '', isset( $_POST['new'] ) ? $_POST['new'] : '', $error );
			}
		}
		bb_admin_page(
			'Zmiana hasła',
			'<h1>Zmiana hasła</h1>'
			. ( $error ? '<div class="err">' . bb_h( $error ) . '</div>' : '' )
			. ( $done ? '<div class="ok">Hasło zostało zmienione. Pozostałe urządzenia zostały wylogowane.</div>' : '' )
			. '<form method="post">' . bb_admin_form_nonce()
			. '<label for="current">Obecne hasło</label><input type="password" id="current" name="current" required autocomplete="current-password">'
			. '<label for="new">Nowe hasło (co najmniej 10 znaków)</label><input type="password" id="new" name="new" required autocomplete="new-password">'
			. '<label for="new2">Powtórz nowe hasło</label><input type="password" id="new2" name="new2" required autocomplete="new-password">'
			. '<button type="submit">Zmień hasło</button></form>'
			. '<p><a class="btn btn--light" href="' . bb_h( $admin ) . '">Wróć</a></p>'
		);
	}

	/* --- historia zmian --- */
	if ( '/admin/history' === $path ) {
		$msg = '';
		if ( 'POST' === $method ) {
			if ( ! bb_check_nonce( isset( $_POST['_n'] ) ? $_POST['_n'] : '' ) ) {
				$msg = '<div class="err">Sesja wygasła. Odśwież stronę i spróbuj ponownie.</div>';
			} elseif ( bb_history_restore( isset( $_POST['file'] ) ? $_POST['file'] : '' ) ) {
				$msg = '<div class="ok">Przywrócono wybraną wersję. Bieżący stan zapisał się w historii, więc można do niego wrócić.</div>';
			} else {
				$msg = '<div class="err">Nie udało się przywrócić tej wersji.</div>';
			}
		}
		$rows = '';
		foreach ( bb_history_list() as $v ) {
			$rows .= '<li><span>' . bb_h( bb_format_time( $v['time'] ) ) . '</span><form method="post" onsubmit="return confirm(\'Przywrócić stan strony sprzed tej zmiany?\')">'
				. bb_admin_form_nonce() . '<input type="hidden" name="file" value="' . bb_h( $v['file'] ) . '"><button type="submit">Przywróć</button></form></li>';
		}
		bb_admin_page(
			'Historia zmian',
			'<h1>Historia zmian</h1><p class="muted">Przed każdym zapisem strona zapamiętuje poprzedni stan treści (teksty, zdjęcia, linki, galerie). Tu możesz do niego wrócić. Pamiętanych jest 60 ostatnich zapisów.</p>'
			. $msg . ( $rows ? '<ul class="list">' . $rows . '</ul>' : '<p>Nie ma jeszcze zapisanych zmian.</p>' )
			. '<p><a class="btn btn--light" href="' . bb_h( $admin ) . '">Wróć</a></p>'
		);
	}

	/* --- pulpit --- */
	bb_admin_page(
		'Panel',
		'<h1>Panel</h1><p class="muted">Zalogowano jako ' . bb_h( $session['user'] ) . '.</p>'
		. '<p>Treści zmieniasz bezpośrednio na stronie: otwórz ją, kliknij czerwony przycisk <strong>Edytuj</strong> w lewym dolnym rogu i klikaj w teksty, zdjęcia, linki lub portfolio.</p>'
		. '<div class="grid"><a class="btn" href="' . bb_h( home_url( '/' ) ) . '">Strona główna</a><a class="btn" href="' . bb_h( home_url( '/eventy/' ) ) . '">Eventy</a>'
		. '<a class="btn" href="' . bb_h( home_url( '/studniowki/' ) ) . '">Studniówki</a><a class="btn" href="' . bb_h( home_url( '/wedding/' ) ) . '">Wedding</a></div>'
		. '<p style="margin-top:20px"><a href="' . bb_h( $admin . '/history' ) . '">Historia zmian i przywracanie</a><br><a href="' . bb_h( $admin . '/password' ) . '">Zmiana hasła</a><br><a href="' . bb_h( $admin . '/logout' ) . '">Wyloguj</a></p>'
	);
}
