<?php
/**
 * DJ Błażej Biurkowski v2 – fragment do functions.php motywu potomnego.
 * Skopiuj styles.css, main.js i assets/ do folderu /bb w motywie potomnym.
 * Wymaga WordPressa 6.3+ (parametr 'strategy' => 'defer').
 */

add_action( 'after_setup_theme', function () {
	register_nav_menus( array( 'primary' => 'Menu główne' ) );
} );

add_action( 'wp_enqueue_scripts', function () {
	$dir = get_stylesheet_directory_uri() . '/bb';
	$ver = '2.0.0';

	wp_enqueue_style( 'bb-fonts', 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@1,18,800&family=Manrope:wght@400..700&display=swap', array(), null );
	wp_enqueue_style( 'bb-styles', $dir . '/styles.css', array( 'bb-fonts' ), $ver );
	wp_enqueue_script( 'bb-main', $dir . '/main.js', array(), $ver, array( 'strategy' => 'defer', 'in_footer' => false ) );
} );

// Preconnect do Google Fonts.
add_filter( 'wp_resource_hints', function ( $urls, $type ) {
	if ( 'preconnect' === $type ) {
		$urls[] = 'https://fonts.googleapis.com';
		$urls[] = array( 'href' => 'https://fonts.gstatic.com', 'crossorigin' );
	}
	return $urls;
}, 10, 2 );

/*
 * Klasa .js na <html> włącza animacje wejścia; awaryjnie pokazuje treść po 2,5 s.
 * W header.php: <html <?php language_attributes(); ?> class="no-js">
 */
add_action( 'wp_head', function () {
	echo "<script>(function(c){c.remove('no-js');c.add('js');setTimeout(function(){c.add('is-ready')},2500)})(document.documentElement.classList)</script>\n";
}, 1 );

/*
 * Menu w header.php (zamiast statycznej listy <ul class="menu"> z index.html):
 *
 * <nav class="bb-nav" aria-label="Menu główne">
 *   <?php wp_nav_menu( array(
 *     'theme_location' => 'primary',
 *     'container'      => false,
 *     'menu_class'     => 'menu',
 *     'depth'          => 2,
 *     'fallback_cb'    => false,
 *   ) ); ?>
 * </nav>
 *
 * „Oferta” i „Portfolio” dodaj jako Własne odnośniki z adresem „#”;
 * main.js sam zamieni je na przyciski rozwijające podmenu.
 */
