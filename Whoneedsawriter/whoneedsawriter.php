<?php
/**
 * Plugin Name:       Whoneedsawriter
 * Plugin URI:        https://example.com/
 * Description:       Connect your account to generate and publish articles automatically.
 * Version:           0.1.3
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Whoneedsawriter
 * Author URI:        https://example.com/
 * Text Domain:       whoneedsawriter
 * Domain Path:       /languages
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'WHONEEDSAWRITER_VERSION' ) ) {
	define( 'WHONEEDSAWRITER_VERSION', '0.1.3' );
}

if ( ! defined( 'WHONEEDSAWRITER_PLUGIN_FILE' ) ) {
	define( 'WHONEEDSAWRITER_PLUGIN_FILE', __FILE__ );
}

if ( ! defined( 'WHONEEDSAWRITER_PLUGIN_DIR' ) ) {
	define( 'WHONEEDSAWRITER_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
}

if ( ! defined( 'WHONEEDSAWRITER_PLUGIN_URL' ) ) {
	define( 'WHONEEDSAWRITER_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
}

register_activation_hook(
	__FILE__,
	function () {
		require_once WHONEEDSAWRITER_PLUGIN_DIR . 'includes/class-whoneedsawriter-installer.php';
		Whoneedsawriter_Installer::activate();
	}
);

if ( ! function_exists( 'whoneedsawriter_redirect_after_activation' ) ) {
	/**
	 * Redirect immediately after activation, even before the full admin class boots.
	 *
	 * @return void
	 */
	function whoneedsawriter_redirect_after_activation() {
		if (
			! is_admin()
			|| wp_doing_ajax()
			|| is_network_admin()
			|| ! get_option( 'whoneedsawriter_activation_redirect', false )
		) {
			return;
		}

		if ( isset( $_GET['activate-multi'] ) ) {
			delete_option( 'whoneedsawriter_activation_redirect' );
			return;
		}

		delete_option( 'whoneedsawriter_activation_redirect' );

		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		global $wpdb;

		$table_name = $wpdb->prefix . 'wnaw_user';
		$user_id    = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT userId FROM {$table_name} WHERE otp_verified = %d ORDER BY updated_at DESC LIMIT 1",
				1
			)
		);

		$page = is_string( $user_id ) && '' !== trim( $user_id ) ? 'whoneedsawriter-generate' : 'whoneedsawriter';

		wp_safe_redirect( admin_url( 'admin.php?page=' . $page ) );
		exit;
	}
}

add_action( 'admin_init', 'whoneedsawriter_redirect_after_activation', 1 );

if ( ! function_exists( 'whoneedsawriter_record_boot_error' ) ) {
	/**
	 * Persist plugin boot errors where they can be inspected after WordPress recovers.
	 *
	 * @param string $message Error message.
	 * @return void
	 */
	function whoneedsawriter_record_boot_error( $message ) {
		$message = '[' . gmdate( 'c' ) . '] ' . (string) $message . "\n";
		update_option( 'whoneedsawriter_last_boot_error', $message );
		error_log( $message );
	}
}

if ( ! function_exists( 'whoneedsawriter_clear_boot_error' ) ) {
	/**
	 * Clear diagnostics from earlier failed boot attempts.
	 *
	 * @return void
	 */
	function whoneedsawriter_clear_boot_error() {
		delete_option( 'whoneedsawriter_last_boot_error' );

		if ( defined( 'WP_CONTENT_DIR' ) ) {
			$legacy_log = WP_CONTENT_DIR . '/uploads/whoneedsawriter-fatal.txt';
			if ( is_file( $legacy_log ) && is_writable( $legacy_log ) ) {
				unlink( $legacy_log );
			}
		}
	}
}

add_action(
	'plugins_loaded',
	function () {
		if (
			is_admin()
			&& isset( $_GET['activate'] )
			&& ! wp_doing_ajax()
		) {
			return;
		}

		$whoneedsawriter_booting = true;
		register_shutdown_function(
			function () use ( &$whoneedsawriter_booting ) {
				if ( ! $whoneedsawriter_booting ) {
					return;
				}

				$error = error_get_last();
				if ( ! is_array( $error ) ) {
					return;
				}

				$fatal_types = array( E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR );
				if ( ! in_array( (int) $error['type'], $fatal_types, true ) ) {
					return;
				}

				$message = 'Whoneedsawriter boot fatal: ' . $error['message'] . ' in ' . $error['file'] . ':' . $error['line'];
				whoneedsawriter_record_boot_error( $message );

				if ( ! function_exists( 'deactivate_plugins' ) && defined( 'ABSPATH' ) ) {
					require_once ABSPATH . 'wp-admin/includes/plugin.php';
				}

				if ( function_exists( 'deactivate_plugins' ) ) {
					deactivate_plugins( plugin_basename( WHONEEDSAWRITER_PLUGIN_FILE ), true );
				}
			}
		);

		try {
			if ( ! class_exists( 'Whoneedsawriter', false ) ) {
				require_once WHONEEDSAWRITER_PLUGIN_DIR . 'includes/class-whoneedsawriter.php';
			}

			$plugin = new Whoneedsawriter();
			$plugin->run();
			$whoneedsawriter_booting = false;
			whoneedsawriter_clear_boot_error();
		} catch ( Exception $e ) {
			$whoneedsawriter_booting = false;
			whoneedsawriter_record_boot_error( 'Whoneedsawriter boot exception: ' . $e->getMessage() );

			if ( is_admin() ) {
				add_action(
					'admin_notices',
					function () use ( $e ) {
						echo '<div class="notice notice-error"><p>';
						echo esc_html( 'Whoneedsawriter could not start: ' . $e->getMessage() );
						echo '</p></div>';
					}
				);
			}
		}
	}
);
