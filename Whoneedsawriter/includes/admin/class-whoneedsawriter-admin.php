<?php
/**
 * Admin functionality.
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Whoneedsawriter_Admin {

	/**
	 * Stored plugin preferences (defaults, debug, etc.).
	 *
	 * @var string
	 */
	const OPTION_SETTINGS = 'whoneedsawriter_settings';

	/**
	 * Email used when the SaaS account was connected (signup).
	 *
	 * @var string
	 */
	const OPTION_CONNECTED_EMAIL = 'whoneedsawriter_connected_email';

	/**
	 * Per-install private secret used to authenticate this WordPress site to the SaaS.
	 *
	 * @var string
	 */
	const OPTION_SITE_SECRET = 'whoneedsawriter_site_secret';

	/**
	 * Article keys the user removed from WordPress (row stays in SaaS list as "Removed").
	 *
	 * @var string
	 */
	const OPTION_REMOVED_ARTICLES = 'whoneedsawriter_removed_articles';

	/**
	 * Default shared secret for Google plugin connect + `connect_token` verify
	 * (must match SaaS `NEXTAUTH_SECRET` / plugin-connect signing secret).
	 * Per-site override: `define( 'WHONEEDSAWRITER_CONNECT_SECRET', '...' );` in wp-config.php.
	 *
	 * @var string
	 */
	const DEFAULT_PLUGIN_CONNECT_SECRET = '4348yhu34h3ui4ofjndfsdfeirh4b637u5sfd3';

	const ACTION_SYNC_CATEGORIES = 'whoneedsawriter_sync_categories';
	const ACTION_SYNC_AUTHORS    = 'whoneedsawriter_sync_authors';

	const NONCE_SAVE_SETTINGS     = 'whoneedsawriter_save_settings';
	const NONCE_DISCONNECT        = 'whoneedsawriter_disconnect_account';
	const NONCE_SYNC_CATEGORIES   = 'whoneedsawriter_sync_categories';
	const NONCE_SYNC_AUTHORS      = 'whoneedsawriter_sync_authors';

	/**
	 * Transient TTL (seconds) for dashboard balance + stats caches.
	 *
	 * @var int
	 */
	const CACHE_TTL_DASHBOARD = 120;

	/**
	 * AJAX action name (wp_ajax_{action}).
	 *
	 * @var string
	 */
	const ACTION_SIGNUP = 'whoneedsawriter_signup';

	/**
	 * AJAX action: verify OTP.
	 *
	 * @var string
	 */
	const ACTION_VERIFY_OTP = 'whoneedsawriter_verify_otp';

	/**
	 * AJAX action: create batch.
	 *
	 * @var string
	 */
	const ACTION_CREATE_BATCH = 'whoneedsawriter_create_batch';

	/**
	 * AJAX action: submit generation (after batch created).
	 *
	 * @var string
	 */
	const ACTION_SUBMIT_GENERATION = 'whoneedsawriter_submit_generation';

	/**
	 * AJAX action: fetch user balance.
	 *
	 * @var string
	 */
	const ACTION_GET_USER_BALANCE = 'whoneedsawriter_get_user_balance';

	/**
	 * AJAX action: dashboard stats from SaaS.
	 *
	 * @var string
	 */
	const ACTION_GET_DASHBOARD = 'whoneedsawriter_get_dashboard_stats';

	/**
	 * AJAX action: article jobs listing from SaaS.
	 *
	 * @var string
	 */
	const ACTION_GET_JOBS = 'whoneedsawriter_get_jobs';

	/**
	 * AJAX action: article rows for a batch (or all user articles).
	 *
	 * @var string
	 */
	const ACTION_GET_ARTICLES = 'whoneedsawriter_get_articles';
	const ACTION_DELETE_POST  = 'whoneedsawriter_delete_post';

	/**
	 * AJAX action: read plugin DB cache (jobs, articles, dashboard stats, settings).
	 *
	 * @var string
	 */
	const ACTION_GET_DB_DATA = 'whoneedsawriter_get_db_data';

	/**
	 * AJAX action: persist generation snapshot to plugin DB.
	 *
	 * @var string
	 */
	const ACTION_SAVE_GENERATION_SNAPSHOT = 'whoneedsawriter_save_generation_snapshot';

	/**
	 * AJAX action: sync still-generating articles against SaaS (failed only).
	 *
	 * @var string
	 */
	const ACTION_SYNC_GENERATING_ARTICLES = 'whoneedsawriter_sync_generating_articles';

	/**
	 * SaaS production base URL (used for OAuth + verify endpoints).
	 *
	 * @var string
	 */
	const SAAS_BASE_URL = 'https://whoneedsawriter.com';

	/**
	 * SaaS path that initiates the Google-login flow for the plugin.
	 *
	 * @var string
	 */
	const SAAS_GOOGLE_LOGIN_PATH = '/login/plugin';

	/**
	 * Optional SaaS endpoint that verifies a connect_token server-side
	 * (avoids needing a shared secret on the WP site). When present and
	 * returns 200 with {sub,email}, we trust it.
	 *
	 * @var string
	 */
	const SAAS_CONNECT_VERIFY_URL = 'https://whoneedsawriter.com/api/plugin-connect/verify';

	/**
	 * admin-post action name to kick off the SaaS Google login flow.
	 *
	 * @var string
	 */
	const ACTION_GOOGLE_CONNECT_START = 'whoneedsawriter_google_connect';

	/**
	 * Nonce action for the Google-connect start link.
	 *
	 * @var string
	 */
	const NONCE_GOOGLE_CONNECT_START = 'whoneedsawriter_google_connect';

	/**
	 * Transient prefix where the per-user OAuth `state` is stored.
	 *
	 * @var string
	 */
	const TRANSIENT_OAUTH_STATE_PREFIX = 'wnaw_oauth_state_';

	/**
	 * Lifetime (seconds) of the OAuth `state` transient.
	 *
	 * @var int
	 */
	const OAUTH_STATE_TTL = 600;

	/**
	 * Create-user API endpoint (HTTPS).
	 *
	 * @var string
	 */
	const API_CREATE_USER = 'https://whoneedsawriter.com/api/create-user-plugin';

	/**
	 * Verify-OTP API endpoint (HTTPS).
	 *
	 * @var string
	 */
	const API_VERIFY_OTP = 'https://whoneedsawriter.com/api/otp-verification';

	/**
	 * Nonce action for signup requests.
	 *
	 * @var string
	 */
	const NONCE_SIGNUP = 'whoneedsawriter_signup';

	/**
	 * Nonce action for verify-OTP requests.
	 *
	 * @var string
	 */
	const NONCE_VERIFY_OTP = 'whoneedsawriter_verify_otp';

	/**
	 * Create-user API endpoint for batch creation (expects JSON payload).
	 *
	 * @var string
	 */
	const API_CREATE_BATCH = 'https://whoneedsawriter.com/api/article-generator/plugin/batch';

	/**
	 * Article generator endpoint (expects JSON payload).
	 *
	 * @var string
	 */
	const API_ARTICLE_GENERATOR = 'https://whoneedsawriter.com/api/article-generator/plugin';

	/**
	 * User endpoint (expects id query parameter).
	 *
	 * @var string
	 */
	const API_USER = 'https://whoneedsawriter.com/api/article-generator/plugin/user';

	/**
	 * Dashboard stats (expects id query parameter).
	 *
	 * @var string
	 */
	const API_DASHBOARD = 'https://whoneedsawriter.com/api/article-generator/plugin/dashboard';

	/**
	 * Jobs listing (expects id query parameter).
	 *
	 * @var string
	 */
	const API_JOBS = 'https://whoneedsawriter.com/api/article-generator/plugin/jobs';

	/**
	 * SaaS endpoint for the per-user batches list (View Jobs page).
	 *
	 * @var string
	 */
	const API_BATCHES = 'https://whoneedsawriter.com/api/article-generator/plugin/batch';

	/**
	 * SaaS endpoint for per-batch / per-user article rows.
	 *
	 * @var string
	 */
	const API_ARTICLES = 'https://whoneedsawriter.com/api/article-generator/plugin/articles';

	/**
	 * SaaS pricing (query: userId, website hostname).
	 *
	 * @var string
	 */
	const PRICING_URL = 'http://whoneedsawriter.com/pricing';

	/**
	 * SaaS trial checkout path.
	 *
	 * @var string
	 */
	const TRIAL_CHECKOUT_PATH = '/checkout/trial';

	/**
	 * Nonce action for create batch requests.
	 *
	 * @var string
	 */
	const NONCE_CREATE_BATCH = 'whoneedsawriter_create_batch';

	/**
	 * Nonce action for submit generation requests.
	 *
	 * @var string
	 */
	const NONCE_SUBMIT_GENERATION = 'whoneedsawriter_submit_generation';

	/**
	 * Nonce action for fetching user balance.
	 *
	 * @var string
	 */
	const NONCE_GET_USER_BALANCE = 'whoneedsawriter_get_user_balance';

	/**
	 * Nonce action for dashboard stats.
	 *
	 * @var string
	 */
	const NONCE_GET_DASHBOARD = 'whoneedsawriter_get_dashboard_stats';

	/**
	 * Nonce action for jobs list.
	 *
	 * @var string
	 */
	const NONCE_GET_JOBS = 'whoneedsawriter_get_jobs';

	/**
	 * Nonce action for fetching articles (per-batch / per-user).
	 *
	 * @var string
	 */
	const NONCE_GET_ARTICLES = 'whoneedsawriter_get_articles';
	const NONCE_DELETE_POST = 'whoneedsawriter_delete_post';

	/**
	 * Nonce action for DB cache reads.
	 *
	 * @var string
	 */
	const NONCE_GET_DB_DATA = 'whoneedsawriter_get_db_data';

	/**
	 * Nonce action for generation snapshot writes.
	 *
	 * @var string
	 */
	const NONCE_SAVE_GENERATION_SNAPSHOT = 'whoneedsawriter_save_generation_snapshot';

	/**
	 * Nonce action for generating-article SaaS sync.
	 *
	 * @var string
	 */
	const NONCE_SYNC_GENERATING_ARTICLES = 'whoneedsawriter_sync_generating_articles';

	/**
	 * Plugin slug.
	 *
	 * @var string
	 */
	private $slug;

	/**
	 * Plugin version.
	 *
	 * @var string
	 */
	private $version;

	/**
	 * Constructor.
	 *
	 * @param string $slug    Plugin slug.
	 * @param string $version Plugin version.
	 */
	public function __construct( $slug, $version ) {
		$this->slug    = (string) $slug;
		$this->version = (string) $version;
	}

	/**
	 * Register admin hooks.
	 *
	 * @return void
	 */
	public function init() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_init', array( $this, 'maybe_ensure_local_schema' ), 0 );
		add_action( 'admin_init', array( $this, 'maybe_fix_malformed_page_query' ), 1 );
		add_action( 'admin_page_access_denied', array( $this, 'maybe_fix_malformed_page_query' ), 0 );
		add_action( 'admin_init', array( $this, 'maybe_redirect_after_activation' ), 5 );
		// Run BEFORE maybe_require_saas_connection (priority 10) so a successful
		// Google callback can persist the user before the "must be connected" gate.
		add_action( 'admin_init', array( $this, 'maybe_handle_google_connect_callback' ), 8 );
		add_action( 'admin_init', array( $this, 'maybe_require_saas_connection' ), 10 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_action( 'admin_footer', array( $this, 'render_trial_modal' ) );
		add_action( 'admin_post_whoneedsawriter_save_settings', array( $this, 'handle_admin_post_save_settings' ) );
		add_action( 'admin_post_whoneedsawriter_disconnect_account', array( $this, 'handle_admin_post_disconnect_account' ) );
		add_action( 'admin_post_' . self::ACTION_GOOGLE_CONNECT_START, array( $this, 'handle_admin_post_google_connect_start' ) );
		add_action( 'wp_ajax_' . self::ACTION_SIGNUP, array( $this, 'handle_ajax_signup' ) );
		add_action( 'wp_ajax_' . self::ACTION_VERIFY_OTP, array( $this, 'handle_ajax_verify_otp' ) );
		add_action( 'wp_ajax_' . self::ACTION_CREATE_BATCH, array( $this, 'handle_ajax_create_batch' ) );
		add_action( 'wp_ajax_' . self::ACTION_SUBMIT_GENERATION, array( $this, 'handle_ajax_submit_generation' ) );
		add_action( 'wp_ajax_' . self::ACTION_GET_USER_BALANCE, array( $this, 'handle_ajax_get_user_balance' ) );
		add_action( 'wp_ajax_' . self::ACTION_GET_DASHBOARD, array( $this, 'handle_ajax_get_dashboard_stats' ) );
		add_action( 'wp_ajax_' . self::ACTION_GET_JOBS, array( $this, 'handle_ajax_get_jobs' ) );
		add_action( 'wp_ajax_' . self::ACTION_GET_ARTICLES, array( $this, 'handle_ajax_get_articles' ) );
		add_action( 'wp_ajax_' . self::ACTION_DELETE_POST, array( $this, 'handle_ajax_delete_post' ) );
		add_action( 'wp_ajax_' . self::ACTION_GET_DB_DATA, array( $this, 'handle_ajax_get_db_data' ) );
		add_action( 'wp_ajax_' . self::ACTION_SAVE_GENERATION_SNAPSHOT, array( $this, 'handle_ajax_save_generation_snapshot' ) );
		add_action( 'wp_ajax_' . self::ACTION_SYNC_GENERATING_ARTICLES, array( $this, 'handle_ajax_sync_generating_articles' ) );
		add_action( 'wp_ajax_' . self::ACTION_SYNC_CATEGORIES, array( $this, 'handle_ajax_sync_categories_placeholder' ) );
		add_action( 'wp_ajax_' . self::ACTION_SYNC_AUTHORS, array( $this, 'handle_ajax_sync_authors_placeholder' ) );
	}

	/**
	 * Default structure for whoneedsawriter_settings option.
	 *
	 * @return array<string, mixed>
	 */
	public static function get_settings_defaults() {
		return array(
			'default_model'       => 'core',
			'default_word_count'  => 1500,
			'default_author_id'   => 0,
			'default_category_id' => 0,
			'debug_mode'          => false,
		);
	}

	/**
	 * Merged saved settings with defaults.
	 *
	 * @return array<string, mixed>
	 */
	public static function merge_plugin_settings() {
		$stored = get_option( self::OPTION_SETTINGS, array() );

		return wp_parse_args( is_array( $stored ) ? $stored : array(), self::get_settings_defaults() );
	}

	/**
	 * Cache key for the credits/balance payload of a SaaS user.
	 *
	 * @param string $user_id SaaS userId.
	 * @return string
	 */
	private static function cache_key_balance( $user_id ) {
		return 'wnaw_bal_v3_' . md5( (string) $user_id );
	}

	/**
	 * Cache key for the dashboard stats payload of a SaaS user.
	 *
	 * @param string $user_id SaaS userId.
	 * @return string
	 */
	private static function cache_key_stats( $user_id ) {
		return 'wnaw_stats_' . md5( (string) $user_id );
	}

	/**
	 * Get or create the per-install private site secret.
	 *
	 * @return string
	 */
	private static function get_site_secret() {
		$existing = get_option( self::OPTION_SITE_SECRET, '' );
		if ( is_string( $existing ) && strlen( trim( $existing ) ) >= 32 ) {
			return trim( $existing );
		}

		try {
			$secret = bin2hex( random_bytes( 32 ) );
		} catch ( Exception $e ) {
			$secret = wp_generate_password( 64, true, true );
		}

		update_option( self::OPTION_SITE_SECRET, $secret, false );
		return $secret;
	}

	/**
	 * Invalidate cached dashboard payloads for a given SaaS user.
	 *
	 * @param string $user_id SaaS userId. Empty string = no-op.
	 * @return void
	 */
	public static function invalidate_user_caches( $user_id = '' ) {
		$user_id = is_string( $user_id ) ? trim( $user_id ) : '';
		if ( '' === $user_id ) {
			return;
		}
		delete_transient( self::cache_key_balance( $user_id ) );
		delete_transient( self::cache_key_stats( $user_id ) );
	}

	/**
	 * Whether the request asked us to skip cache (force=1).
	 *
	 * @return bool
	 */
	private static function request_force_refresh() {
		$src = isset( $_POST['force'] ) ? $_POST['force'] : ( isset( $_GET['force'] ) ? $_GET['force'] : '' );
		if ( '' === $src ) {
			return false;
		}
		$flag = sanitize_text_field( wp_unslash( (string) $src ) );

		return in_array( $flag, array( '1', 'true', 'yes' ), true );
	}

	/**
	 * Recover from malformed redirects that put query args into the "page" value.
	 * Example bad: admin.php?page=whoneedsawriter-dashboard?payment=success&type=subscription&plan=Pro
	 * Example good: admin.php?page=whoneedsawriter-dashboard&payment=success&type=subscription&plan=Pro
	 *
	 * @return void
	 */
	public function maybe_fix_malformed_page_query() {
		if ( ! is_admin() || wp_doing_ajax() ) {
			return;
		}

		if ( ! isset( $_GET['page'] ) ) {
			return;
		}

		$page_raw = wp_unslash( $_GET['page'] );
		$page     = is_scalar( $page_raw ) ? (string) $page_raw : '';

		if ( '' === $page || false === strpos( $page, '?' ) ) {
			return;
		}

		$parts = explode( '?', $page, 2 );
		if ( count( $parts ) !== 2 ) {
			return;
		}

		$fixed_page = sanitize_text_field( $parts[0] );
		$query_str  = (string) $parts[1];

		if ( '' === $fixed_page ) {
			return;
		}

		$extra = array();
		parse_str( $query_str, $extra );

		$args          = array();
		$args['page']  = $fixed_page;
		$args          = array_merge( $args, is_array( $extra ) ? $extra : array() );
		$redirect_url  = add_query_arg( $args, admin_url( 'admin.php' ) );

		wp_safe_redirect( $redirect_url );
		exit;
	}

	/**
	 * Site hostname only (e.g. example.com): no scheme, path, trailing slash, or leading www.
	 *
	 * @return string
	 */
	public static function get_normalized_site_hostname() {
		$host = wp_parse_url( home_url( '/' ), PHP_URL_HOST );

		if ( ! is_string( $host ) || '' === $host ) {
			return '';
		}

		$host = strtolower( $host );

		if ( 0 === strpos( $host, 'www.' ) ) {
			$host = substr( $host, 4 );
		}

		return $host;
	}

	/**
	 * Website identifier for SaaS links.
	 * Format: host[/path] (no scheme, no leading www., no trailing slash).
	 * Examples: example.com, cyberhusk.com/blog4
	 *
	 * @return string
	 */
	public static function get_normalized_site_host_and_path() {
		$host = self::get_normalized_site_hostname();
		if ( '' === $host ) {
			return '';
		}

		$path = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
		if ( ! is_string( $path ) ) {
			return $host;
		}

		$path = trim( $path );
		$path = trim( $path, '/' );

		if ( '' === $path ) {
			return $host;
		}

		return $host . '/' . $path;
	}

	/**
	 * Save settings from admin POST.
	 *
	 * @return void
	 */
	public function handle_admin_post_save_settings() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You are not allowed to perform this action.', 'whoneedsawriter' ) );
		}

		check_admin_referer( self::NONCE_SAVE_SETTINGS, 'wnaw_save_nonce' );

		$model_raw = isset( $_POST['wnaw_default_model'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['wnaw_default_model'] ) ) : 'core';
		$model     = in_array( $model_raw, array( 'lite', 'core', 'pro' ), true ) ? $model_raw : 'core';

		$word_count = isset( $_POST['wnaw_default_word_count'] ) ? absint( wp_unslash( (string) $_POST['wnaw_default_word_count'] ) ) : 1500;
		$word_count = min( 3000, max( 0, $word_count ) );
		$word_count = (int) round( $word_count / 50 ) * 50;

		$author_id   = isset( $_POST['wnaw_default_author_id'] ) ? absint( wp_unslash( (string) $_POST['wnaw_default_author_id'] ) ) : 0;
		$category_id = isset( $_POST['wnaw_default_category_id'] ) ? absint( wp_unslash( (string) $_POST['wnaw_default_category_id'] ) ) : 0;

		if ( $author_id > 0 ) {
			$user = get_userdata( $author_id );
			if ( ! $user ) {
				$author_id = 0;
			} else {
				$roles_ok = false;
				foreach ( (array) $user->roles as $r ) {
					if ( in_array( $r, array( 'administrator', 'editor', 'author' ), true ) ) {
						$roles_ok = true;
						break;
					}
				}
				if ( ! $roles_ok ) {
					$author_id = 0;
				}
			}
		}

		if ( $category_id > 0 ) {
			$term = get_term( $category_id, 'category' );
			if ( ! $term || is_wp_error( $term ) ) {
				$category_id = 0;
			}
		}

		$debug = isset( $_POST['wnaw_debug_mode'] );

		update_option(
			self::OPTION_SETTINGS,
			array(
				'default_model'         => $model,
				'default_word_count'    => $word_count,
				'default_author_id'     => $author_id,
				'default_category_id'   => $category_id,
				'debug_mode'            => $debug,
			)
		);

		wp_safe_redirect(
			add_query_arg(
				'wnaw_saved',
				'1',
				admin_url( 'admin.php?page=' . rawurlencode( $this->slug . '-settings' ) )
			)
		);
		exit;
	}

	/**
	 * Disconnect SaaS: clear local user row(s) and connected email.
	 *
	 * @return void
	 */
	public function handle_admin_post_disconnect_account() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You are not allowed to perform this action.', 'whoneedsawriter' ) );
		}

		check_admin_referer( self::NONCE_DISCONNECT, 'wnaw_disconnect_nonce' );

		$this->clear_saas_connection();

		wp_safe_redirect(
			add_query_arg(
				'wnaw_disconnected',
				'1',
				admin_url( 'admin.php?page=' . rawurlencode( $this->slug ) )
			)
		);
		exit;
	}

	/**
	 * Placeholder sync: categories are already synced at login; SaaS wiring can extend this endpoint later.
	 *
	 * @return void
	 */
	public function handle_ajax_sync_categories_placeholder() {
		check_ajax_referer( self::NONCE_SYNC_CATEGORIES, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		if ( '' === $this->get_verified_user_id_for_api() ) {
			wp_send_json_error(
				array(
					'message' => __( 'Connect and verify your account first.', 'whoneedsawriter' ),
				),
				400
			);
		}

		wp_send_json_success(
			array(
				'message' => __( 'Your WordPress categories are already sent when you connect. Pull/push-specific SaaS sync is not enabled in this plugin version yet.', 'whoneedsawriter' ),
			)
		);
	}

	/**
	 * Placeholder sync: authors behave like categories at login until a SaaS endpoint exists.
	 *
	 * @return void
	 */
	public function handle_ajax_sync_authors_placeholder() {
		check_ajax_referer( self::NONCE_SYNC_AUTHORS, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		if ( '' === $this->get_verified_user_id_for_api() ) {
			wp_send_json_error(
				array(
					'message' => __( 'Connect and verify your account first.', 'whoneedsawriter' ),
				),
				400
			);
		}

		wp_send_json_success(
			array(
				'message' => __( 'Your WordPress authors are already sent when you connect. Pull/push-specific SaaS sync is not enabled in this plugin version yet.', 'whoneedsawriter' ),
			)
		);
	}

	/**
	 * Remove stored SaaS linkage for this site.
	 *
	 * @return void
	 */
	private function clear_saas_connection() {
		global $wpdb;

		$table = $wpdb->prefix . 'wnaw_user';

		$current_user_id = $this->get_verified_user_id_for_api();
		if ( '' !== $current_user_id ) {
			self::invalidate_user_caches( $current_user_id );
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name from trusted prefix + literal.
		$wpdb->query( "DELETE FROM {$table}" );

		delete_option( self::OPTION_CONNECTED_EMAIL );
	}

	/**
	 * Register admin menu pages.
	 *
	 * @return void
	 */
	public function register_menu() {
		$capability = 'manage_options';

		add_menu_page(
			__( 'Connect Your Account', 'whoneedsawriter' ),
			__( 'Whoneedsawriter', 'whoneedsawriter' ),
			$capability,
			$this->slug,
			array( $this, 'render_connect_page' ),
			'dashicons-edit-page',
			26
		);

		add_submenu_page(
			$this->slug,
			__( 'Dashboard', 'whoneedsawriter' ),
			__( 'Dashboard', 'whoneedsawriter' ),
			$capability,
			$this->slug . '-dashboard',
			array( $this, 'render_dashboard_page' )
		);

		add_submenu_page(
			$this->slug,
			__( 'View Jobs', 'whoneedsawriter' ),
			__( 'View Jobs', 'whoneedsawriter' ),
			$capability,
			$this->slug . '-jobs',
			array( $this, 'render_jobs_page' )
		);

		add_submenu_page(
			$this->slug,
			__( 'Generate Article', 'whoneedsawriter' ),
			__( 'Generate Article', 'whoneedsawriter' ),
			$capability,
			$this->slug . '-generate',
			array( $this, 'render_generate_page' )
		);

		add_submenu_page(
			$this->slug,
			__( 'Settings', 'whoneedsawriter' ),
			__( 'Settings', 'whoneedsawriter' ),
			$capability,
			$this->slug . '-settings',
			array( $this, 'render_settings_page' )
		);

		// Remove WordPress auto-added duplicate entry that mirrors the parent slug (same title as top-level).
		remove_submenu_page( $this->slug, $this->slug );
	}

	/**
	 * After plugin activation, send the admin to Generate when connected, or Connect otherwise.
	 *
	 * @return void
	 */
	public function maybe_redirect_after_activation() {
		if ( ! is_admin() ) {
			return;
		}

		if ( wp_doing_ajax() ) {
			return;
		}

		if ( ! get_option( 'whoneedsawriter_activation_redirect', false ) ) {
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

		$page = $this->slug;
		if ( '' !== $this->get_verified_user_id_for_api() ) {
			$page = $this->slug . '-generate';
		}

		wp_safe_redirect( admin_url( 'admin.php?page=' . $page ) );
		exit;
	}

	/**
	 * SaaS-connected screens require a verified row in wp_wnaw_user; otherwise send users to Connect.
	 *
	 * @return void
	 */
	public function maybe_require_saas_connection() {
		if ( ! is_admin() ) {
			return;
		}

		if ( wp_doing_ajax() ) {
			return;
		}

		if ( ! isset( $_GET['page'] ) || '' === $_GET['page'] ) {
			return;
		}

		$page_raw = wp_unslash( $_GET['page'] );
		$page     = sanitize_text_field( is_scalar( $page_raw ) ? (string) $page_raw : '' );
		if ( '' === $page ) {
			return;
		}

		$restricted = array(
			$this->slug . '-dashboard',
			$this->slug . '-jobs',
			$this->slug . '-generate',
			$this->slug . '-settings',
		);

		if ( ! in_array( $page, $restricted, true ) ) {
			return;
		}

		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		if ( '' !== $this->get_verified_user_id_for_api() ) {
			return;
		}

		wp_safe_redirect( admin_url( 'admin.php?page=' . $this->slug ) );
		exit;
	}

	/**
	 * Enqueue admin CSS/JS only on our pages.
	 *
	 * @param string $hook_suffix Current admin page hook suffix.
	 * @return void
	 */
	public function enqueue_assets( $hook_suffix ) {
		$allowed_pages = array(
			'toplevel_page_' . $this->slug,
			$this->slug . '_page_' . $this->slug . '-dashboard',
			$this->slug . '_page_' . $this->slug . '-jobs',
			$this->slug . '_page_' . $this->slug . '-generate',
			$this->slug . '_page_' . $this->slug . '-settings',
		);

		if ( ! in_array( (string) $hook_suffix, $allowed_pages, true ) ) {
			return;
		}

		$css_path = WHONEEDSAWRITER_PLUGIN_DIR . 'assets/admin/admin.css';
		$js_path  = WHONEEDSAWRITER_PLUGIN_DIR . 'assets/admin/admin.js';

		$css_ver = file_exists( $css_path ) ? (string) filemtime( $css_path ) : $this->version;
		$js_ver  = file_exists( $js_path ) ? (string) filemtime( $js_path ) : $this->version;

		wp_enqueue_style(
			$this->slug . '-admin',
			WHONEEDSAWRITER_PLUGIN_URL . 'assets/admin/admin.css',
			array(),
			$css_ver
		);

		wp_enqueue_script(
			$this->slug . '-admin',
			WHONEEDSAWRITER_PLUGIN_URL . 'assets/admin/admin.js',
			array(),
			$js_ver,
			true
		);

		wp_localize_script(
			$this->slug . '-admin',
			'whoneedsawriterAdmin',
			array(
				'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
				'actionSignup' => self::ACTION_SIGNUP,
				'nonceSignup'  => wp_create_nonce( self::NONCE_SIGNUP ),
				'actionVerify' => self::ACTION_VERIFY_OTP,
				'nonceVerify'  => wp_create_nonce( self::NONCE_VERIFY_OTP ),
				'actionCreateBatch' => self::ACTION_CREATE_BATCH,
				'nonceCreateBatch'  => wp_create_nonce( self::NONCE_CREATE_BATCH ),
				'actionSubmitGeneration' => self::ACTION_SUBMIT_GENERATION,
				'nonceSubmitGeneration'  => wp_create_nonce( self::NONCE_SUBMIT_GENERATION ),
				'actionGetUserBalance'   => self::ACTION_GET_USER_BALANCE,
				'nonceGetUserBalance'    => wp_create_nonce( self::NONCE_GET_USER_BALANCE ),
				'actionGetDashboard'     => self::ACTION_GET_DASHBOARD,
				'nonceGetDashboard'      => wp_create_nonce( self::NONCE_GET_DASHBOARD ),
				'actionGetJobs'          => self::ACTION_GET_JOBS,
				'nonceGetJobs'           => wp_create_nonce( self::NONCE_GET_JOBS ),
				'actionGetArticles'      => self::ACTION_GET_ARTICLES,
				'nonceGetArticles'       => wp_create_nonce( self::NONCE_GET_ARTICLES ),
				'actionDeletePost'       => self::ACTION_DELETE_POST,
				'nonceDeletePost'        => wp_create_nonce( self::NONCE_DELETE_POST ),
				'actionGetDbData'        => self::ACTION_GET_DB_DATA,
				'nonceGetDbData'         => wp_create_nonce( self::NONCE_GET_DB_DATA ),
				'actionSaveGenerationSnapshot' => self::ACTION_SAVE_GENERATION_SNAPSHOT,
				'nonceSaveGenerationSnapshot'  => wp_create_nonce( self::NONCE_SAVE_GENERATION_SNAPSHOT ),
				'actionSyncGeneratingArticles' => self::ACTION_SYNC_GENERATING_ARTICLES,
				'nonceSyncGeneratingArticles'  => wp_create_nonce( self::NONCE_SYNC_GENERATING_ARTICLES ),
				'actionSyncCategories'    => self::ACTION_SYNC_CATEGORIES,
				'nonceSyncCategories'    => wp_create_nonce( self::NONCE_SYNC_CATEGORIES ),
				'actionSyncAuthors'       => self::ACTION_SYNC_AUTHORS,
				'nonceSyncAuthors'        => wp_create_nonce( self::NONCE_SYNC_AUTHORS ),
				'dashboardUrl'           => admin_url( 'admin.php?page=' . $this->slug . '-dashboard' ),
				'jobsUrl'                => admin_url( 'admin.php?page=' . $this->slug . '-jobs' ),
				'generateUrl'            => admin_url( 'admin.php?page=' . $this->slug . '-generate' ),
				'pricingUrl'             => $this->build_buy_credits_pricing_url(),
				'trialUrl'               => $this->build_trial_checkout_url(),
				'strings'      => array(
					'invalidEmail'  => __( 'Please enter a valid email address.', 'whoneedsawriter' ),
					'otpSent'       => __( ' Access Code sent to your email', 'whoneedsawriter' ),
					'invalidOtp'    => __( 'Please enter the verification code.', 'whoneedsawriter' ),
					'verifySuccess' => __( 'Verification successful.', 'whoneedsawriter' ),
					'genericError'  => __( 'Something went wrong. Please try again in a few minutes.', 'whoneedsawriter' ),
					'networkError'  => __( 'Network error. Please check your connection and try again.', 'whoneedsawriter' ),
					'invalidKeywords' => __( 'Please add at least 1 keyword before generating.', 'whoneedsawriter' ),
					'createBatchError' => __( 'Could not create batch. Please try again.', 'whoneedsawriter' ),
					'createBatchSuccess' => __( 'Batch created successfully.', 'whoneedsawriter' ),
					'submitGenerationError' => __( 'Failed to start generation. Please try again.', 'whoneedsawriter' ),
					'submitGenerationSuccess' => __( 'Generation started successfully.', 'whoneedsawriter' ),
					'generationInProgress'    => __( 'Article Generation is in progress.', 'whoneedsawriter' ),
					'submittingKeywords'      => __( 'Submitting keywords...', 'whoneedsawriter' ),
					'creditsError' => __( 'Could not load credits.', 'whoneedsawriter' ),
					'dashboardError' => __( 'Could not load dashboard data.', 'whoneedsawriter' ),
					'dashboardNotVerified' => __( 'Connect and verify your account to see dashboard stats.', 'whoneedsawriter' ),
					'jobsError'       => __( 'Could not load jobs.', 'whoneedsawriter' ),
					'jobsEmpty'       => __( 'No jobs found yet. Start your first batch from Generate Article.', 'whoneedsawriter' ),
					'jobsViewPost'    => __( 'View post', 'whoneedsawriter' ),
					'jobsRefresh'     => __( 'Refresh', 'whoneedsawriter' ),
					'jobsLabelGenerating' => __( 'Generating…', 'whoneedsawriter' ),
					'jobsLabelCompleted'  => __( 'Completed', 'whoneedsawriter' ),
					'articlesError'       => __( 'Could not load articles.', 'whoneedsawriter' ),
					'articlesEmpty'       => __( 'No articles yet for this job.', 'whoneedsawriter' ),
					'articlesEmptyAll'    => __( 'No articles generated yet. Start your first batch from Generate Article.', 'whoneedsawriter' ),
					'articlesLoading'     => __( 'Loading articles…', 'whoneedsawriter' ),
					'articlesPreview'     => __( 'Preview', 'whoneedsawriter' ),
					'articlesLabelGenerating' => __( 'Generating', 'whoneedsawriter' ),
					'articlesLabelGenerated'  => __( 'Generated', 'whoneedsawriter' ),
					'articlesLabelPublished'  => __( 'Published', 'whoneedsawriter' ),
					'articlesLabelFailed'     => __( 'Failed', 'whoneedsawriter' ),
					'articlesLabelRemoved'    => __( 'Removed', 'whoneedsawriter' ),
					'articlesLabelPending'    => __( 'Pending', 'whoneedsawriter' ),
					'articlesMenuLabel'       => __( 'More actions', 'whoneedsawriter' ),
					'articlesActionEdit'      => __( 'Edit', 'whoneedsawriter' ),
					'articlesActionView'      => __( 'View', 'whoneedsawriter' ),
					'articlesActionDelete'    => __( 'Delete', 'whoneedsawriter' ),
					'articlesActionRegenerate' => __( 'Regenerate', 'whoneedsawriter' ),
					'articlesDeleteTitle'     => __( 'Delete article?', 'whoneedsawriter' ),
					'articlesDeleteConfirm'   => __( 'Delete this article from WordPress? This cannot be undone.', 'whoneedsawriter' ),
					'articlesDeleteCancel'    => __( 'Cancel', 'whoneedsawriter' ),
					'articlesDeleteConfirmBtn' => __( 'Delete', 'whoneedsawriter' ),
					'articlesDeleteFailed'    => __( 'Could not delete this article. Please try again.', 'whoneedsawriter' ),
					'jobDetailNotFound'   => __( 'This job could not be found. It may have been deleted or the link is outdated.', 'whoneedsawriter' ),
					'step3SchedulingActive' => __( 'Scheduling & posting…', 'whoneedsawriter' ),
					/* translators: 1: posted count, 2: total eligible count */
					'step3ProgressPill' => __( '%1$d / %2$d scheduled & posted', 'whoneedsawriter' ),
					'settingsSyncError' => __( 'Sync request failed.', 'whoneedsawriter' ),
					'settingsDisconnectConfirm' => __( 'Disconnect this site from your Whoneedsawriter account? You can reconnect anytime.', 'whoneedsawriter' ),
					'trialModalTitle' => __( 'Start your 7-day trial', 'whoneedsawriter' ),
					'trialModalBody' => __( 'Activate your trial to generate articles from WordPress. Your trial includes 5 credits and can be cancelled before renewal.', 'whoneedsawriter' ),
					'trialModalCancel' => __( 'Maybe later', 'whoneedsawriter' ),
					'trialModalStart' => __( 'Start Trial', 'whoneedsawriter' ),
					'trialActivatedTitle' => __( 'Trial activated', 'whoneedsawriter' ),
					'trialActivatedBody' => __( 'Your 7-day trial is active with 5 credits included. You can now generate articles from WordPress.', 'whoneedsawriter' ),
				),
			)
		);
	}

	/**
	 * Read cached jobs, articles, dashboard stats, or batch settings from plugin DB.
	 *
	 * @return void
	 */
	public function handle_ajax_get_db_data() {
		check_ajax_referer( self::NONCE_GET_DB_DATA, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$user_id = $this->get_verified_user_id_for_api();
		if ( '' === $user_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'User is not verified. Please complete signup/OTP verification.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$scope = isset( $_POST['scope'] ) ? sanitize_key( wp_unslash( (string) $_POST['scope'] ) ) : '';

		switch ( $scope ) {
			case 'jobs':
				wp_send_json_success(
					array(
						'rows' => Whoneedsawriter_Repository::get_jobs_normalized_for_user( $user_id ),
					)
				);
				break;

			case 'batch':
				$batch_id = isset( $_POST['batch_id'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['batch_id'] ) ) : '';
				if ( '' === $batch_id ) {
					wp_send_json_error(
						array(
							'message' => __( 'Missing batch id.', 'whoneedsawriter' ),
						),
						400
					);
				}
				$batch = Whoneedsawriter_Repository::get_batch_normalized( $batch_id );
				wp_send_json_success(
					array(
						'batch' => $batch,
					)
				);
				break;

			case 'articles':
				$batch_id = isset( $_POST['batch_id'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['batch_id'] ) ) : '';
				if ( '' === $batch_id ) {
					wp_send_json_error(
						array(
							'message' => __( 'Missing batch id.', 'whoneedsawriter' ),
						),
						400
					);
				}
				wp_send_json_success(
					array(
						'rows'    => Whoneedsawriter_Repository::get_articles_normalized( $batch_id ),
						'batchId' => $batch_id,
					)
				);
				break;

			case 'dashboard':
				$stats = Whoneedsawriter_Repository::refresh_dashboard_stats( $user_id );
				wp_send_json_success( array( 'stats' => $stats ) );
				break;

			case 'batch_settings':
				$batch_id = isset( $_POST['batch_id'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['batch_id'] ) ) : '';
				if ( '' === $batch_id ) {
					wp_send_json_error(
						array(
							'message' => __( 'Missing batch id.', 'whoneedsawriter' ),
						),
						400
					);
				}
				$settings = Whoneedsawriter_Repository::get_batch_settings( $batch_id );
				wp_send_json_success(
					array(
						'settings' => is_array( $settings ) ? $settings : null,
						'batchId'  => $batch_id,
					)
				);
				break;

			default:
				wp_send_json_error(
					array(
						'message' => __( 'Invalid cache scope.', 'whoneedsawriter' ),
					),
					400
				);
		}
	}

	/**
	 * Persist batch, keywords, and settings at generation time.
	 *
	 * @return void
	 */
	public function handle_ajax_save_generation_snapshot() {
		check_ajax_referer( self::NONCE_SAVE_GENERATION_SNAPSHOT, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$user_id = $this->get_verified_user_id_for_api();
		if ( '' === $user_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'User is not verified. Please complete signup/OTP verification.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$batch_id = isset( $_POST['batch_id'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['batch_id'] ) ) : '';
		if ( '' === $batch_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'Missing batch id.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$keywords = array();
		if ( isset( $_POST['keywords_json'] ) ) {
			$decoded = json_decode( wp_unslash( (string) $_POST['keywords_json'] ), true );
			if ( is_array( $decoded ) ) {
				foreach ( $decoded as $kw ) {
					$kw = sanitize_text_field( (string) $kw );
					if ( '' !== $kw ) {
						$keywords[] = $kw;
					}
				}
			}
		}

		$scheduled_slots = array();
		if ( isset( $_POST['scheduled_slots_json'] ) ) {
			$decoded = json_decode( wp_unslash( (string) $_POST['scheduled_slots_json'] ), true );
			if ( is_array( $decoded ) ) {
				foreach ( $decoded as $slot ) {
					$scheduled_slots[] = sanitize_text_field( (string) $slot );
				}
			}
		}

		$settings = array();
		if ( isset( $_POST['settings_json'] ) ) {
			$decoded = json_decode( wp_unslash( (string) $_POST['settings_json'] ), true );
			if ( is_array( $decoded ) ) {
				$settings = $decoded;
			}
		}

		$batch_row = array();
		if ( isset( $_POST['batch_row_json'] ) ) {
			$decoded = json_decode( wp_unslash( (string) $_POST['batch_row_json'] ), true );
			if ( is_array( $decoded ) ) {
				$batch_row = $decoded;
			}
		}

		if ( ! empty( $batch_row ) ) {
			Whoneedsawriter_Repository::upsert_batch_row( $user_id, $batch_row );
		} else {
			Whoneedsawriter_Repository::seed_generation_batch(
				$user_id,
				$batch_id,
				max( 1, count( $keywords ) ),
				$settings
			);
		}

		if ( ! empty( $settings ) ) {
			Whoneedsawriter_Repository::save_batch_settings( $batch_id, $settings );
		}

		if ( ! empty( $keywords ) ) {
			Whoneedsawriter_Repository::seed_articles( $batch_id, $keywords, $scheduled_slots );
		}

		Whoneedsawriter_Repository::refresh_dashboard_stats( $user_id );

		wp_send_json_success(
			array(
				'saved'   => true,
				'batchId' => $batch_id,
			)
		);
	}

	/**
	 * Background sync: check SaaS status for DB "generating" rows only.
	 * Called when at least one article in the batch is already Generated.
	 *
	 * @return void
	 */
	public function handle_ajax_sync_generating_articles() {
		check_ajax_referer( self::NONCE_SYNC_GENERATING_ARTICLES, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$user_id = $this->get_verified_user_id_for_api();
		if ( '' === $user_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'User is not verified. Please complete signup/OTP verification.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$batch_id = isset( $_POST['batch_id'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['batch_id'] ) ) : '';
		if ( '' === $batch_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'Missing batch id.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$db_articles = Whoneedsawriter_Repository::get_articles( $batch_id );
		$has_generated = false;
		$has_generating = false;

		foreach ( $db_articles as $article ) {
			if ( ! empty( $article['is_removed'] ) ) {
				continue;
			}
			$key = sanitize_key( (string) $article['status_key'] );
			if ( 'generated' === $key ) {
				$has_generated = true;
			} elseif ( 'generating' === $key ) {
				$has_generating = true;
			}
		}

		if ( ! $has_generated || ! $has_generating ) {
			wp_send_json_success(
				array(
					'changed' => false,
					'rows'    => Whoneedsawriter_Repository::get_articles_normalized( $batch_id ),
					'batch'   => Whoneedsawriter_Repository::get_batch_normalized( $batch_id ),
				)
			);
		}

		$saas_list = self::fetch_saas_articles_list( $user_id, $batch_id );
		$changed   = false;
		if ( is_array( $saas_list ) && ! empty( $saas_list ) ) {
			$changed = Whoneedsawriter_Repository::sync_generating_articles_from_saas( $batch_id, $saas_list );
		}

		if ( $changed ) {
			Whoneedsawriter_Repository::refresh_dashboard_stats( $user_id );
		}

		wp_send_json_success(
			array(
				'changed' => (bool) $changed,
				'rows'    => Whoneedsawriter_Repository::get_articles_normalized( $batch_id ),
				'batch'   => Whoneedsawriter_Repository::get_batch_normalized( $batch_id ),
			)
		);
	}

	/**
	 * @param string $batch_id Batch id.
	 * @return array<int,array<string,mixed>>
	 */
	private static function get_db_articles_normalized( $batch_id ) {
		$rows = array();
		foreach ( Whoneedsawriter_Repository::get_articles( $batch_id ) as $db_row ) {
			$rows[] = Whoneedsawriter_Repository::db_article_to_normalized( $db_row );
		}
		return $rows;
	}

	/**
	 * Delete a WordPress post by ID (used by the Job Detail actions menu).
	 *
	 * @return void
	 */
	public function handle_ajax_delete_post() {
		check_ajax_referer( self::NONCE_DELETE_POST, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$post_id = isset( $_POST['postId'] ) ? absint( wp_unslash( (string) $_POST['postId'] ) ) : 0;
		$title   = isset( $_POST['articleTitle'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['articleTitle'] ) ) : '';
		$batch_id  = isset( $_POST['batchId'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['batchId'] ) ) : '';
		$row_index = isset( $_POST['rowIndex'] ) ? absint( wp_unslash( (string) $_POST['rowIndex'] ) ) : -1;

		if ( $post_id <= 0 && '' !== $title ) {
			$post_id = self::resolve_job_article_wp_post_id( array(), $title );
		}

		if ( $post_id <= 0 ) {
			wp_send_json_error(
				array(
					'message' => __( 'Missing or invalid post ID.', 'whoneedsawriter' ),
				),
				422
			);
		}

		if ( ! current_user_can( 'delete_post', $post_id ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to delete this post.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$post = get_post( $post_id );
		if ( $post instanceof WP_Post ) {
			$deleted = wp_delete_post( $post_id, true );
			if ( ! $deleted ) {
				wp_send_json_error(
					array(
						'message' => __( 'Could not delete the post.', 'whoneedsawriter' ),
					),
					500
				);
			}
		}

		if ( '' === $title && $post instanceof WP_Post ) {
			$title = (string) $post->post_title;
		}

		self::mark_article_removed( $batch_id, $title, $post_id );

		if ( '' !== $batch_id ) {
			if ( $row_index >= 0 ) {
				Whoneedsawriter_Repository::mark_article_removed( $batch_id, $row_index );
			} else {
				Whoneedsawriter_Repository::mark_article_removed_by_identity( $batch_id, $title, $post_id );
			}
		}

		wp_send_json_success(
			array(
				'deleted' => true,
				'postId'  => $post_id,
			)
		);
	}

	/**
	 * @return string[]
	 */
	private static function get_removed_article_keys() {
		$stored = get_option( self::OPTION_REMOVED_ARTICLES, array() );

		return is_array( $stored ) ? array_values( $stored ) : array();
	}

	/**
	 * @param string $title Article title.
	 * @return string
	 */
	private static function normalize_removed_article_title( $title ) {
		$plain = trim( wp_strip_all_tags( (string) $title ) );
		$plain = html_entity_decode( $plain, ENT_QUOTES | ENT_HTML5, 'UTF-8' );

		return strtolower( $plain );
	}

	/**
	 * @param string $batch_id Batch id.
	 * @param string $title    Article title.
	 * @param int    $post_id  WordPress post id.
	 * @return string[]
	 */
	private static function build_removed_article_keys( $batch_id, $title, $post_id = 0 ) {
		$keys      = array();
		$batch_id  = sanitize_text_field( (string) $batch_id );
		$post_id   = absint( $post_id );
		$title_key = self::normalize_removed_article_title( $title );

		if ( '' !== $batch_id && $post_id > 0 ) {
			$keys[] = $batch_id . '::p:' . $post_id;
		}
		if ( '' !== $batch_id && '' !== $title_key ) {
			$keys[] = $batch_id . '::t:' . $title_key;
		}
		if ( $post_id > 0 ) {
			$keys[] = 'p:' . $post_id;
		}

		return array_values( array_unique( $keys ) );
	}

	/**
	 * @param string $batch_id Batch id.
	 * @param string $title    Article title.
	 * @param int    $post_id  WordPress post id.
	 * @return bool
	 */
	private static function is_article_marked_removed( $batch_id, $title, $post_id = 0 ) {
		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' !== $batch_id ) {
			$post_id   = absint( $post_id );
			$title_key = self::normalize_removed_article_title( $title );
			foreach ( Whoneedsawriter_Repository::get_articles( $batch_id ) as $article ) {
				if ( empty( $article['is_removed'] ) ) {
					continue;
				}
				if ( $post_id > 0 && absint( $article['wp_post_id'] ) === $post_id ) {
					return true;
				}
				if ( '' !== $title_key && self::normalize_removed_article_title( (string) $article['title'] ) === $title_key ) {
					return true;
				}
			}
		}

		$removed = self::get_removed_article_keys();
		if ( empty( $removed ) ) {
			return false;
		}

		$lookup = array_flip( $removed );
		foreach ( self::build_removed_article_keys( $batch_id, $title, $post_id ) as $key ) {
			if ( isset( $lookup[ $key ] ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * @param string $batch_id Batch id.
	 * @param string $title    Article title.
	 * @param int    $post_id  WordPress post id.
	 * @return void
	 */
	private static function mark_article_removed( $batch_id, $title, $post_id = 0 ) {
		$removed = self::get_removed_article_keys();
		$lookup  = array_flip( $removed );

		foreach ( self::build_removed_article_keys( $batch_id, $title, $post_id ) as $key ) {
			if ( ! isset( $lookup[ $key ] ) ) {
				$removed[]       = $key;
				$lookup[ $key ] = true;
			}
		}

		update_option( self::OPTION_REMOVED_ARTICLES, $removed, false );
	}

	/**
	 * Build the "name" value for the API from the current user (not shown in the form).
	 * Example: display name "Talk Pabitra".
	 *
	 * @return string Sanitized non-empty name, or empty string if none could be resolved.
	 */
	private function get_requestor_name_for_api() {
		$user = wp_get_current_user();
		if ( ! $user || ! $user->ID ) {
			return '';
		}

		$name = trim( (string) $user->display_name );
		if ( '' === $name ) {
			$first = (string) get_user_meta( $user->ID, 'first_name', true );
			$last  = (string) get_user_meta( $user->ID, 'last_name', true );
			$name  = trim( $first . ' ' . $last );
		}
		if ( '' === $name ) {
			$name = trim( (string) $user->nickname );
		}
		if ( '' === $name ) {
			$name = trim( (string) $user->user_login );
		}

		$name = sanitize_text_field( $name );
		if ( function_exists( 'mb_substr' ) ) {
			$name = mb_substr( $name, 0, 255 );
		} else {
			$name = substr( $name, 0, 255 );
		}

		return trim( $name );
	}

	/**
	 * Handle signup: validate email, POST JSON to API, return JSON to browser.
	 *
	 * @return void
	 */
	public function handle_ajax_signup() {
		check_ajax_referer( self::NONCE_SIGNUP, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$name = $this->get_requestor_name_for_api();
		if ( '' === $name ) {
			wp_send_json_error(
				array(
					'message' => __( 'Could not determine your account name from your profile. Please update your display name and try again.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$raw_email = isset( $_POST['email'] ) ? wp_unslash( (string) $_POST['email'] ) : '';
		$email     = sanitize_email( $raw_email );

		if ( ! is_email( $email ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Please enter a valid email address.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$charset = (string) get_option( 'blog_charset', 'utf-8' );
		$api_url = self::API_CREATE_USER;

		$response = wp_remote_post(
			$api_url,
			array(
				'timeout' => 20,
				'headers' => array(
					'Content-Type' => 'application/json; charset=' . $charset,
					'Accept'       => 'application/json',
				),
				'body'      => wp_json_encode(
					array(
						'email' => $email,
						'name'  => $name,
					)
				),
				'sslverify' => true,
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Could not reach the service. Please try again later.', 'whoneedsawriter' ),
				),
				502
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = (string) wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( 200 === $code && is_array( $data ) && ! empty( $data['success'] ) ) {
			$user_id = isset( $data['userId'] ) ? sanitize_text_field( (string) $data['userId'] ) : '';
			if ( '' === $user_id ) {
				wp_send_json_error(
					array(
						'message' => __( 'User creation failed (missing userId). Please try again.', 'whoneedsawriter' ),
					),
					500
				);
			}

			$this->persist_user_id( $user_id, $email );
			update_option( self::OPTION_CONNECTED_EMAIL, $email );
			self::invalidate_user_caches( $user_id );

			wp_send_json_success(
				array(
					'userId'  => $user_id,
					'message' => isset( $data['message'] ) ? sanitize_text_field( (string) $data['message'] ) : __( 'User created successfully', 'whoneedsawriter' ),
				)
			);
		}

		if ( is_array( $data ) && ! empty( $data['message'] ) ) {
			wp_send_json_error(
				array(
					'message' => sanitize_text_field( (string) $data['message'] ),
				),
				( 0 !== $code ? $code : 400 )
			);
		}

		wp_send_json_error(
			array(
				'message' => __( 'Something went wrong. Please try again in a few minutes.', 'whoneedsawriter' ),
			),
			400
		);
	}

	/**
	 * Handle verify OTP: POST JSON to API, return JSON to browser.
	 *
	 * @return void
	 */
	public function handle_ajax_verify_otp() {
		check_ajax_referer( self::NONCE_VERIFY_OTP, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$raw_user_id = isset( $_POST['userId'] ) ? wp_unslash( (string) $_POST['userId'] ) : '';
		$user_id     = sanitize_text_field( $raw_user_id );

		if ( '' === $user_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'Missing userId. Please sign up again.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$raw_otp = isset( $_POST['otp'] ) ? wp_unslash( (string) $_POST['otp'] ) : '';
		$otp     = preg_replace( '/\s+/', '', sanitize_text_field( $raw_otp ) );

		if ( '' === $otp || strlen( $otp ) > 32 ) {
			wp_send_json_error(
				array(
					'message' => __( 'Please enter the verification code.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$charset = (string) get_option( 'blog_charset', 'utf-8' );
		$api_url = self::API_VERIFY_OTP;

		$response = wp_remote_post(
			$api_url,
			array(
				'timeout' => 20,
				'headers' => array(
					'Content-Type' => 'application/json; charset=' . $charset,
					'Accept'       => 'application/json',
				),
				'body'      => wp_json_encode(
					array(
						'userId'     => $user_id,
						'otp'        => $otp,
						'website'    => self::get_normalized_site_host_and_path(),
						'siteSecret' => self::get_site_secret(),
					)
				),
				'sslverify' => true,
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Could not reach the service. Please try again later.', 'whoneedsawriter' ),
				),
				502
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = (string) wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( 200 === $code && is_array( $data ) && ! empty( $data['success'] ) ) {
			$raw_verify_email = isset( $_POST['email'] ) ? sanitize_email( wp_unslash( (string) $_POST['email'] ) ) : '';

			$this->mark_otp_verified( $user_id, $raw_verify_email );

			if ( is_email( $raw_verify_email ) ) {
				update_option( self::OPTION_CONNECTED_EMAIL, $raw_verify_email );
			}

			self::invalidate_user_caches( $user_id );

			wp_send_json_success(
				array(
					'message' => isset( $data['message'] ) ? sanitize_text_field( (string) $data['message'] ) : __( 'Access Code verified successfully', 'whoneedsawriter' ),
				)
			);
		}

		if ( is_array( $data ) && ! empty( $data['message'] ) ) {
			wp_send_json_error(
				array(
					'message' => sanitize_text_field( (string) $data['message'] ),
				),
				( 0 !== $code ? $code : 400 )
			);
		}

		wp_send_json_error(
			array(
				'message' => __( 'Something went wrong. Please try again in a few minutes.', 'whoneedsawriter' ),
			),
			400
		);
	}

	/**
	 * Persist API userId in custom table.
	 *
	 * @param string $user_id          API userId.
	 * @param string $connected_email SaaS signup email (optional).
	 * @param bool   $via_google      True when the row is created from Google plugin connect.
	 * @return void
	 */
	private function persist_user_id( $user_id, $connected_email = '', $via_google = false ) {
		global $wpdb;

		$this->ensure_local_schema( true );

		$table_name = $wpdb->prefix . 'wnaw_user';

		$row_email = is_email( $connected_email ) ? $connected_email : '';
		$gl        = $via_google ? 1 : 0;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is DB prefix + literal suffix.
		$existing_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$table_name} WHERE userId = %s ORDER BY updated_at DESC LIMIT 1",
				$user_id
			)
		);

		if ( is_numeric( $existing_id ) ) {
			$data = array(
				'google_login' => $gl,
				'updated_at'   => current_time( 'mysql' ),
			);
			$format = array(
				'%d',
				'%s',
			);

			if ( '' !== $row_email ) {
				$data['connected_email'] = $row_email;
				$format[]                = '%s';
			}

			$wpdb->update(
				$table_name,
				$data,
				array(
					'id' => (int) $existing_id,
				),
				$format,
				array(
					'%d',
				)
			);

			return;
		}

		$result = $wpdb->insert(
			$table_name,
			array(
				'userId'           => $user_id,
				'connected_email' => $row_email,
				'otp_verified'    => 0,
				'google_login'    => $gl,
				'created_at'      => current_time( 'mysql' ),
				'updated_at'      => current_time( 'mysql' ),
			),
			array(
				'%s',
				'%s',
				'%d',
				'%d',
				'%s',
				'%s',
			)
		);

		if ( false === $result ) {
			whoneedsawriter_record_boot_error( 'Whoneedsawriter could not persist connected user: ' . $wpdb->last_error );
		}
	}

	/**
	 * Mark OTP as verified for a userId; optionally persist signup email on the row.
	 *
	 * @param string $user_id          API userId.
	 * @param string $connected_email  Raw email from verify request (sanitized inside when valid).
	 * @param bool   $via_google       True when verification came from Google plugin connect.
	 * @return void
	 */
	private function mark_otp_verified( $user_id, $connected_email = '', $via_google = false ) {
		global $wpdb;

		$this->ensure_local_schema( true );

		$table_name = $wpdb->prefix . 'wnaw_user';

		$data = array(
			'otp_verified'  => 1,
			'google_login'  => $via_google ? 1 : 0,
			'updated_at'    => current_time( 'mysql' ),
		);
		$format = array(
			'%d',
			'%d',
			'%s',
		);

		if ( is_email( $connected_email ) ) {
			$data['connected_email'] = $connected_email;
			$format[]                = '%s';
		}

		$wpdb->update(
			$table_name,
			$data,
			array(
				'userId' => $user_id,
			),
			$format,
			array(
				'%s',
			)
		);

		if ( 0 < (int) $wpdb->rows_affected ) {
			return;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is DB prefix + literal suffix.
		$existing_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$table_name} WHERE userId = %s ORDER BY updated_at DESC LIMIT 1",
				$user_id
			)
		);

		if ( is_numeric( $existing_id ) ) {
			return;
		}

		$row_email = is_email( $connected_email ) ? $connected_email : '';
		$result    = $wpdb->insert(
			$table_name,
			array(
				'userId'           => $user_id,
				'connected_email' => $row_email,
				'otp_verified'    => 1,
				'google_login'    => $via_google ? 1 : 0,
				'created_at'      => current_time( 'mysql' ),
				'updated_at'      => current_time( 'mysql' ),
			),
			array(
				'%s',
				'%s',
				'%d',
				'%d',
				'%s',
				'%s',
			)
		);

		if ( false === $result ) {
			whoneedsawriter_record_boot_error( 'Whoneedsawriter could not mark connected user verified: ' . $wpdb->last_error );
		}
	}

	/* ------------------------------------------------------------------ *
	 * Google sign-in (SaaS /login/plugin) -- start + callback.
	 * ------------------------------------------------------------------ */

	/**
	 * admin-post handler: generate state, store it as a transient and redirect
	 * the user to the SaaS Google-login URL with redirect_uri pointing back to
	 * our connect page.
	 *
	 * @return void
	 */
	public function handle_admin_post_google_connect_start() {
		check_admin_referer( self::NONCE_GOOGLE_CONNECT_START );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die(
				esc_html__( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				'',
				array( 'response' => 403 )
			);
		}

		$state    = wp_generate_password( 32, false );
		$callback = admin_url( 'admin.php?page=' . $this->slug );

		set_transient(
			self::TRANSIENT_OAUTH_STATE_PREFIX . get_current_user_id(),
			$state,
			self::OAUTH_STATE_TTL
		);

		// add_query_arg() already urlencodes values; do NOT pre-encode or we
		// would double-encode.
		$url = add_query_arg(
			array(
				'redirect_uri' => $callback,
				'state'        => $state,
			),
			self::SAAS_BASE_URL . self::SAAS_GOOGLE_LOGIN_PATH
		);

		// Off-site redirect, so wp_redirect (not wp_safe_redirect). URL is built
		// entirely server-side from a constant + nonce-protected request.
		wp_redirect( $url );
		exit;
	}

	/**
	 * Handle the SaaS Google-login callback: verify state, verify connect_token,
	 * persist the SaaS user, and redirect to the dashboard. Runs early on
	 * admin_init so it executes before the "must be connected" gate.
	 *
	 * @return void
	 */
	public function maybe_handle_google_connect_callback() {
		if ( ! is_admin() || wp_doing_ajax() ) {
			return;
		}

		if ( ! isset( $_GET['page'] ) || $this->slug !== sanitize_text_field( wp_unslash( (string) $_GET['page'] ) ) ) {
			return;
		}

		if ( ! isset( $_GET['connect_token'] ) || ! isset( $_GET['state'] ) ) {
			return;
		}

		$base_redirect = admin_url( 'admin.php?page=' . $this->slug );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_safe_redirect( add_query_arg( 'wnaw_oauth_error', 'forbidden', $base_redirect ) );
			exit;
		}

		// Do not run sanitize_text_field() on connect_token — it can alter or
		// truncate JWT-style / base64url payloads and break verification.
		$token_raw = isset( $_GET['connect_token'] ) ? trim( wp_unslash( (string) $_GET['connect_token'] ) ) : '';
		$state_raw = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( (string) $_GET['state'] ) ) : '';

		$state_key      = self::TRANSIENT_OAUTH_STATE_PREFIX . get_current_user_id();
		$expected_state = get_transient( $state_key );

		if ( ! is_string( $expected_state ) || '' === $expected_state || ! hash_equals( $expected_state, $state_raw ) ) {
			delete_transient( $state_key );
			wp_safe_redirect( add_query_arg( 'wnaw_oauth_error', 'state_mismatch', $base_redirect ) );
			exit;
		}

		// One-time use.
		delete_transient( $state_key );

		$payload = $this->verify_connect_token( $token_raw );
		if ( null === $payload ) {
			wp_safe_redirect( add_query_arg( 'wnaw_oauth_error', 'invalid_token', $base_redirect ) );
			exit;
		}

		$sub   = isset( $payload['sub'] ) ? sanitize_text_field( (string) $payload['sub'] ) : '';
		$email = isset( $payload['email'] ) ? sanitize_email( (string) $payload['email'] ) : '';

		if ( '' === $sub ) {
			wp_safe_redirect( add_query_arg( 'wnaw_oauth_error', 'missing_sub', $base_redirect ) );
			exit;
		}

		// Persist as fully verified (matches the existing OTP-success path).
		$this->persist_user_id( $sub, $email, true );
		$this->mark_otp_verified( $sub, $email, true );

		if ( '' !== $email ) {
			update_option( self::OPTION_CONNECTED_EMAIL, $email );
		}

		self::invalidate_user_caches( $sub );

		wp_safe_redirect(
			add_query_arg(
				'wnaw_connected',
				'1',
				admin_url( 'admin.php?page=' . $this->slug . '-generate' )
			)
		);
		exit;
	}

	/**
	 * Default batch name sent to SaaS when the client does not propose one.
	 *
	 * @return string e.g. WNAW-052826
	 */
	private static function generate_default_batch_name() {
		return 'WNAW-' . gmdate( 'mdy' );
	}

	/**
	 * Read batch display name from SaaS create-batch / batch list payloads.
	 *
	 * @param array<string,mixed> $data API JSON.
	 * @return string
	 */
	private static function extract_batch_name_from_api_response( array $data ) {
		$priority_keys = array( 'batchName', 'batch_name', 'finalBatchName' );
		foreach ( $priority_keys as $key ) {
			if ( empty( $data[ $key ] ) || ! is_scalar( $data[ $key ] ) ) {
				continue;
			}

			$name = sanitize_text_field( (string) $data[ $key ] );
			if ( '' !== $name ) {
				return $name;
			}
		}

		$nested_sources = array(
			array( 'batch_created', 'name' ),
			array( 'batchCreated', 'name' ),
			array( 'data', 'batchName' ),
			array( 'data', 'name' ),
		);
		foreach ( $nested_sources as $path ) {
			$parent = isset( $data[ $path[0] ] ) ? $data[ $path[0] ] : null;
			if ( ! is_array( $parent ) || empty( $parent[ $path[1] ] ) || ! is_scalar( $parent[ $path[1] ] ) ) {
				continue;
			}

			$name = sanitize_text_field( (string) $parent[ $path[1] ] );
			if ( '' !== $name ) {
				return $name;
			}
		}

		if ( ! empty( $data['name'] ) && is_scalar( $data['name'] ) ) {
			$name = sanitize_text_field( (string) $data['name'] );
			if ( '' !== $name ) {
				return $name;
			}
		}

		// Never use `batch` — that is the proposed input echoed back, not the final unique name.
		return '';
	}

	/**
	 * Compare batch names without leading `#` (for suffix / proposed-name checks).
	 *
	 * @param string $name Raw batch name.
	 * @return string
	 */
	private static function batch_name_compare_key( $name ) {
		return strtolower( trim( ltrim( trim( (string) $name ), '#' ) ) );
	}

	/**
	 * Fetch the canonical batch name from SaaS after create (includes uniqueness suffix).
	 *
	 * @param string $user_id  SaaS user id.
	 * @param string $batch_id Assigned batch id.
	 * @return string
	 */
	private function fetch_saas_batch_display_name( $user_id, $batch_id ) {
		$user_id  = sanitize_text_field( (string) $user_id );
		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' === $user_id || '' === $batch_id ) {
			return '';
		}

		$url = add_query_arg(
			array(
				'userId'  => rawurlencode( $user_id ),
				'batchId' => rawurlencode( $batch_id ),
			),
			self::API_BATCHES
		);

		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => 15,
				'sslverify' => true,
				'headers'   => array(
					'Accept' => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return '';
		}

		$data = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $data ) ) {
			return '';
		}

		return self::extract_batch_name_from_api_response( $data );
	}

	/**
	 * Verify a SaaS-issued connect_token.
	 *
	 * If a shared secret is configured: POSTs to the SaaS verify endpoint with
	 * header `X-Plugin-Connect-Secret`, then falls back to local HMAC when needed.
	 * The verify API may return `userId` or `sub`; both are normalized to `sub`.
	 *
	 * Local HMAC: split on the last "." only — payload is the string before it
	 * (signed as-is, never re-encoded JSON). Signature is compared as raw bytes
	 * after base64url decode, or as a base64url string.
	 *
	 * @param string $token Raw token from the callback URL.
	 * @return array<string, mixed>|null Normalized payload with `sub` and `email` (optional `exp`) or null on failure.
	 */
	private function verify_connect_token( $token ) {
		$token = is_string( $token ) ? trim( $token ) : '';
		if ( '' === $token ) {
			return null;
		}

		$secret = self::get_connect_secret();

		// 1) Prefer the SaaS verify endpoint (matches Node signing; avoids PHP
		//    base64url edge cases). Requires the same shared secret in the header.
		$verify_url = (string) apply_filters( 'whoneedsawriter_connect_verify_url', self::SAAS_CONNECT_VERIFY_URL );
		if ( '' !== $verify_url && '' !== $secret ) {
			$resp = wp_remote_post(
				$verify_url,
				array(
					'timeout' => 15,
					'headers' => array(
						'Content-Type'             => 'application/json',
						'Accept'                   => 'application/json',
						'X-Plugin-Connect-Secret' => $secret,
					),
					'body'    => wp_json_encode(
						array(
							'token'      => $token,
							'website'    => self::get_normalized_site_host_and_path(),
							'siteSecret' => self::get_site_secret(),
						)
					),
				)
			);
			if ( ! is_wp_error( $resp ) && 200 === (int) wp_remote_retrieve_response_code( $resp ) ) {
				$decoded = json_decode( (string) wp_remote_retrieve_body( $resp ), true );
				if ( is_array( $decoded ) ) {
					$sub = '';
					if ( isset( $decoded['sub'] ) && '' !== trim( (string) $decoded['sub'] ) ) {
						$sub = sanitize_text_field( (string) $decoded['sub'] );
					} elseif ( isset( $decoded['userId'] ) && '' !== trim( (string) $decoded['userId'] ) ) {
						$sub = sanitize_text_field( (string) $decoded['userId'] );
					}
					if ( '' !== $sub ) {
						$email = isset( $decoded['email'] ) ? sanitize_email( (string) $decoded['email'] ) : '';
						return array(
							'sub'   => $sub,
							'email' => is_email( $email ) ? $email : '',
						);
					}
				}
			}
		}

		// 2) Local HMAC verification fallback (must match Node: HMAC the exact
		//    base64url string before the LAST dot; signature is base64url of raw digest).
		if ( '' === $secret ) {
			return null;
		}

		$last_dot = strrpos( $token, '.' );
		if ( false === $last_dot || $last_dot < 1 ) {
			return null;
		}

		$body_b64 = substr( $token, 0, $last_dot );
		$sig_b64  = substr( $token, $last_dot + 1 );
		if ( '' === $body_b64 || '' === $sig_b64 ) {
			return null;
		}

		$expected_mac = hash_hmac( 'sha256', $body_b64, $secret, true );
		$sig_raw      = self::base64url_decode( $sig_b64 );
		$sig_ok       = ( false !== $sig_raw && hash_equals( $expected_mac, $sig_raw ) );
		if ( ! $sig_ok ) {
			// Also accept base64url-encoded signature string compare (some stacks emit sig as b64url string).
			$expected_sig_b64 = self::base64url_encode( $expected_mac );
			if ( ! hash_equals( $expected_sig_b64, $sig_b64 ) ) {
				return null;
			}
		}

		$body_json = self::base64url_decode( $body_b64 );
		if ( false === $body_json || '' === $body_json ) {
			return null;
		}

		$body = json_decode( $body_json, true );
		if ( ! is_array( $body ) ) {
			return null;
		}

		if ( isset( $body['exp'] ) && (int) $body['exp'] < time() ) {
			return null;
		}

		if ( ( ! isset( $body['sub'] ) || '' === trim( (string) $body['sub'] ) ) && isset( $body['userId'] ) && '' !== trim( (string) $body['userId'] ) ) {
			$body['sub'] = (string) $body['userId'];
		}

		return $body;
	}

	/**
	 * Resolve the shared secret used to verify `connect_token` and call the SaaS verify API.
	 * Priority: `WHONEEDSAWRITER_CONNECT_SECRET` (wp-config) → `whoneedsawriter_connect_secret` filter → built-in default (matches production SaaS).
	 *
	 * @return string
	 */
	private static function get_connect_secret() {
		if ( defined( 'WHONEEDSAWRITER_CONNECT_SECRET' ) && is_string( WHONEEDSAWRITER_CONNECT_SECRET ) && '' !== WHONEEDSAWRITER_CONNECT_SECRET ) {
			return (string) WHONEEDSAWRITER_CONNECT_SECRET;
		}
		$filtered = apply_filters( 'whoneedsawriter_connect_secret', '' );
		if ( is_string( $filtered ) && '' !== trim( $filtered ) ) {
			return trim( $filtered );
		}
		return self::DEFAULT_PLUGIN_CONNECT_SECRET;
	}

	/**
	 * Base64url-decode (RFC 4648 §5) with padding restored.
	 *
	 * @param string $input
	 * @return string|false
	 */
	private static function base64url_decode( $input ) {
		$input = (string) $input;
		$input = strtr( $input, '-_', '+/' );
		$pad   = strlen( $input ) % 4;
		if ( $pad > 0 ) {
			$input .= str_repeat( '=', 4 - $pad );
		}
		return base64_decode( $input, true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
	}

	/**
	 * Base64url-encode (RFC 4648 §5) without padding.
	 *
	 * @param string $bin
	 * @return string
	 */
	private static function base64url_encode( $bin ) {
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		return rtrim( strtr( base64_encode( (string) $bin ), '+/', '-_' ), '=' );
	}

	/**
	 * Handle create batch: call SaaS batch endpoint and return assignedBatch id.
	 *
	 * @return void
	 */
	public function handle_ajax_create_batch() {
		check_ajax_referer( self::NONCE_CREATE_BATCH, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$total_keywords = isset( $_POST['total_keywords'] ) ? absint( wp_unslash( (string) $_POST['total_keywords'] ) ) : 0;
		if ( $total_keywords < 1 ) {
			wp_send_json_error(
				array(
					'message' => __( 'Invalid keywords count.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$save_option_raw = isset( $_POST['saveOption'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['saveOption'] ) ) : 'draft';
		$allowed_save    = array( 'draft', 'publish', 'future' );
		$save_option     = in_array( $save_option_raw, $allowed_save, true ) ? $save_option_raw : 'draft';

		$schedule_time_raw = isset( $_POST['scheduleTime'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['scheduleTime'] ) ) : '';
		$allowed_sched     = array( 'one_post_per_day', 'one_post_per_weekly', 'one_post_per_monthly' );
		$schedule_time     = ( 'future' === $save_option && in_array( $schedule_time_raw, $allowed_sched, true ) ) ? $schedule_time_raw : '';

		$published_start_raw = isset( $_POST['publishedStartDateTime'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['publishedStartDateTime'] ) ) : '';
		$published_start_dt  = self::normalize_published_start_datetime_for_api( $published_start_raw );

		$proposed_batch_raw = isset( $_POST['batch'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['batch'] ) ) : '';
		$proposed_batch     = '' !== trim( $proposed_batch_raw )
			? trim( $proposed_batch_raw )
			: self::generate_default_batch_name();

		$user_id = $this->get_verified_user_id_for_api();
		if ( '' === $user_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'User is not verified. Please complete signup/OTP verification.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$payload = array(
			'batch'            => $proposed_batch,
			'articleType'      => 'godmode',
			'articles'         => $total_keywords,
			'total_keywords'   => $total_keywords,
			'userId'           => $user_id,
			'websiteToPublish' => home_url(),
			'saveOption'       => $save_option,
			'scheduleTime'     => $schedule_time,
		);

		if ( 'future' === $save_option && '' !== $published_start_dt ) {
			$payload['publishedStartDateTime'] = $published_start_dt;
		}

		$charset = (string) get_option( 'blog_charset', 'utf-8' );

		$response = wp_remote_post(
			self::API_CREATE_BATCH,
			array(
				'timeout' => 20,
				'headers' => array(
					'Content-Type' => 'application/json; charset=' . $charset,
					'Accept'       => 'application/json',
				),
				'body'      => wp_json_encode( $payload ),
				'sslverify' => true,
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Could not reach the service. Please try again later.', 'whoneedsawriter' ),
				),
				502
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = (string) wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( 200 === $code && is_array( $data ) && ! empty( $data['assignedBatch'] ) ) {
			$assigned_batch = sanitize_text_field( (string) $data['assignedBatch'] );
			$batch_name     = self::extract_batch_name_from_api_response( $data );
			$proposed_key   = self::batch_name_compare_key( $proposed_batch );
			$resolved_key   = self::batch_name_compare_key( $batch_name );

			if ( '' === $batch_name || ( '' !== $proposed_key && $resolved_key === $proposed_key ) ) {
				$fetched = $this->fetch_saas_batch_display_name( $user_id, $assigned_batch );
				if ( '' !== $fetched ) {
					$batch_name = $fetched;
				}
			}

			if ( '' === $batch_name ) {
				$batch_name = $proposed_batch;
			}

			$batch_name_normalized = self::normalize_plugin_batch_display_name( $batch_name );

			Whoneedsawriter_Repository::upsert_batch_row(
				$user_id,
				array(
					'id'                => $assigned_batch,
					'name'              => $batch_name_normalized,
					'articles'          => $total_keywords,
					'completedArticles' => 0,
					'pendingArticles'   => $total_keywords,
					'failedArticles'    => 0,
					'statusInt'         => 0,
					'statusKey'         => 'generating',
					'statusLabel'       => __( 'Generating', 'whoneedsawriter' ),
					'createdAt'         => gmdate( 'mdy' ),
				)
			);

			self::invalidate_user_caches( $user_id );
			wp_send_json_success(
				array(
					'assignedBatch' => $assigned_batch,
					'batchName'     => $batch_name_normalized,
					'message'       => isset( $data['message'] ) ? sanitize_text_field( (string) $data['message'] ) : __( 'Batch created successfully.', 'whoneedsawriter' ),
				)
			);
		}

		if ( is_array( $data ) && ( ! empty( $data['error'] ) || ! empty( $data['message'] ) ) ) {
			$err = ! empty( $data['error'] ) ? $data['error'] : $data['message'];
			$status_code = ( $code >= 400 && $code <= 599 ) ? $code : 400;
			$error_data  = array(
				'message' => sanitize_text_field( (string) $err ),
			);
			if ( ! empty( $data['code'] ) ) {
				$error_data['code'] = sanitize_key( (string) $data['code'] );
			}
			wp_send_json_error(
				$error_data,
				$status_code
			);
		}

		wp_send_json_error(
			array(
				'message' => __( 'Failed to create batch.', 'whoneedsawriter' ),
			),
			400
		);
	}

	/**
	 * Handle submit generation: call article-generator endpoint with payload.
	 *
	 * @return void
	 */
	public function handle_ajax_submit_generation() {
		check_ajax_referer( self::NONCE_SUBMIT_GENERATION, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$batch_id = isset( $_POST['batchId'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['batchId'] ) ) : '';
		if ( '' === $batch_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'Missing batchId.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$text_keywords = isset( $_POST['textKeywords'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['textKeywords'] ) ) : '';
		$text_keywords = trim( $text_keywords, " \t\n\r\0\x0B," );
		if ( '' === $text_keywords ) {
			wp_send_json_error(
				array(
					'message' => __( 'Missing keywords.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$total_keywords = isset( $_POST['total_keywords'] ) ? absint( wp_unslash( (string) $_POST['total_keywords'] ) ) : 0;
		if ( $total_keywords < 1 ) {
			wp_send_json_error(
				array(
					'message' => __( 'Invalid keywords count.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$word_limit = isset( $_POST['wordLimit'] ) ? absint( wp_unslash( (string) $_POST['wordLimit'] ) ) : 1500;
		$word_limit = max( 0, min( 3000, $word_limit ) );

		$model_raw = isset( $_POST['model'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['model'] ) ) : '1a-pro';
		$model_map = array(
			'pro'     => '1a-pro',
			'core'    => '1a-core',
			'lite'    => '1a-lite',
			'1a-pro'  => '1a-pro',
			'1a-core' => '1a-core',
			'1a-lite' => '1a-lite',
		);
		$model     = isset( $model_map[ $model_raw ] ) ? $model_map[ $model_raw ] : '1a-pro';

		$special_instructions = isset( $_POST['specialInstructions'] ) ? sanitize_textarea_field( wp_unslash( (string) $_POST['specialInstructions'] ) ) : '';

		$infographics = isset( $_POST['infographics'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['infographics'] ) ) : 'no';
		$infographics = ( 'yes' === strtolower( $infographics ) ) ? 'yes' : 'no';

		$external_links = isset( $_POST['externalLinks'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['externalLinks'] ) ) : 'No';
		$external_links = ( 'yes' === strtolower( $external_links ) ) ? 'Yes' : 'No';

		$references = isset( $_POST['references'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['references'] ) ) : 'No';
		$references = ( 'yes' === strtolower( $references ) ) ? 'Yes' : 'No';

		$balance_type_raw = isset( $_POST['balance_type'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['balance_type'] ) ) : 'freeCredits';
		$allowed_balance  = array( 'monthyBalance', 'lifetimeBalance', 'freeCredits' );
		$balance_type     = in_array( $balance_type_raw, $allowed_balance, true ) ? $balance_type_raw : 'freeCredits';

		$category = isset( $_POST['category'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['category'] ) ) : '';
		$author   = isset( $_POST['author'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['author'] ) ) : '';

		$user_id = $this->get_verified_user_id_for_api();
		if ( '' === $user_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'User is not verified. Please complete signup/OTP verification.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$payload = array(
			'userId'             => $user_id,
			'batchId'            => $batch_id,
			'textKeywords'       => $text_keywords,
			'model'              => $model,
			'balance_type'       => $balance_type,
			'total_keywords'     => $total_keywords,
			'wordLimit'          => $word_limit,
			'featuredImage'      => 'yes',
			'infographics'       => $infographics,
			'specialInstructions'=> $special_instructions,
			'externalLinks'      => $external_links,
			'references'         => $references,
			'category'           => $category,
			'author'             => $author,
		);

		$charset = (string) get_option( 'blog_charset', 'utf-8' );

		$response = wp_remote_post(
			self::API_ARTICLE_GENERATOR,
			array(
				'timeout' => 30,
				'headers' => array(
					'Content-Type' => 'application/json; charset=' . $charset,
					'Accept'       => 'application/json',
				),
				'body'      => wp_json_encode( $payload ),
				'sslverify' => true,
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'Could not reach the service. Please try again later.', 'whoneedsawriter' ),
				),
				502
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = (string) wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( 200 === $code && is_array( $data ) && isset( $data['status'] ) && 200 === (int) $data['status'] ) {
			self::invalidate_user_caches( $user_id );
			wp_send_json_success(
				array(
					'message' => __( 'Generation started successfully.', 'whoneedsawriter' ),
				)
			);
		}

		if ( is_array( $data ) ) {
			if ( ! empty( $data['error'] ) ) {
				$error_data = array(
					'message' => sanitize_text_field( (string) $data['error'] ),
				);
				if ( ! empty( $data['code'] ) ) {
					$error_data['code'] = sanitize_key( (string) $data['code'] );
				}
				wp_send_json_error(
					$error_data,
					( $code >= 400 && $code <= 599 ) ? $code : 400
				);
			}
			if ( ! empty( $data['message'] ) ) {
				wp_send_json_error(
					array(
						'message' => sanitize_text_field( (string) $data['message'] ),
					),
					400
				);
			}
		}

		wp_send_json_error(
			array(
				'message' => __( 'Failed to start generation.', 'whoneedsawriter' ),
			),
			400
		);
	}

	/**
	 * Fetch user record from SaaS and compute credits + balance_type.
	 *
	 * @return void
	 */
	public function handle_ajax_get_user_balance() {
		check_ajax_referer( self::NONCE_GET_USER_BALANCE, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$user_id = $this->get_verified_user_id_for_api();
		if ( '' === $user_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'User is not verified. Please complete signup/OTP verification.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$cache_key = self::cache_key_balance( $user_id );
		$force     = self::request_force_refresh();

		if ( ! $force ) {
			$cached = get_transient( $cache_key );
			if ( is_array( $cached ) && isset( $cached['credits'], $cached['balance_type'] ) ) {
				wp_send_json_success( $cached );
			}
		}

		$balance = $this->get_linked_user_balance();

		if ( is_wp_error( $balance ) ) {
			$code = (int) $balance->get_error_data();
			if ( $code < 400 || $code > 599 ) {
				$code = 400;
			}

			wp_send_json_error(
				array(
					'message' => $balance->get_error_message(),
				),
				$code
			);
		}

		if ( is_array( $balance ) ) {
			set_transient( $cache_key, $balance, self::CACHE_TTL_DASHBOARD );
			wp_send_json_success( $balance );
		}

		wp_send_json_error(
			array(
				'message' => __( 'Could not load credits.', 'whoneedsawriter' ),
			),
			400
		);
	}

	/**
	 * Fetch SaaS user payload and compute credits (same rules as Generate page).
	 *
	 * @return array{credits: float, balance_type: string}|WP_Error|null Null when no linked/verified user.
	 */
	private function get_linked_user_balance() {
		$user_id = $this->get_verified_user_id_for_api();
		if ( '' === $user_id ) {
			return null;
		}

		$url = add_query_arg(
			array(
				'id'      => rawurlencode( $user_id ),
				'website' => self::get_normalized_site_host_and_path(),
			),
			self::API_USER
		);

		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => 20,
				'sslverify' => true,
				'headers'   => array(
					'Accept'             => 'application/json',
					'X-WNAW-Site-Secret' => self::get_site_secret(),
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return new WP_Error(
				'wnaw_balance_remote',
				__( 'Could not reach the service. Please try again later.', 'whoneedsawriter' ),
				502
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = (string) wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( 200 !== $code || ! is_array( $data ) ) {
			return new WP_Error(
				'wnaw_balance_bad_response',
				__( 'Could not load credits.', 'whoneedsawriter' ),
				400
			);
		}

		$monthly  = isset( $data['monthyBalance'] ) ? (float) $data['monthyBalance'] : ( isset( $data['monthlyBalance'] ) ? (float) $data['monthlyBalance'] : 0.0 );
		$lifetime = isset( $data['lifetimeBalance'] ) ? (float) $data['lifetimeBalance'] : 0.0;
		$free     = isset( $data['freeCredits'] ) ? (float) $data['freeCredits'] : 0.0;

		$total = $monthly + $lifetime + $free;

		$balance_type = 'freeCredits';
		if ( $monthly > 0 ) {
			$balance_type = 'monthyBalance';
		} elseif ( $lifetime > 0 ) {
			$balance_type = 'lifetimeBalance';
		}

		return $this->normalize_account_state_payload( $data, $total, $balance_type );
	}

	/**
	 * Format credit total for display (aligned with admin.js fmtCredits).
	 *
	 * @param float $credits Credits.
	 * @return string
	 */
	private function format_credits_for_display( $credits ) {
		$n = (float) $credits;
		if ( ! is_finite( $n ) ) {
			return '0';
		}
		if ( abs( $n - round( $n ) ) < 1e-9 ) {
			return (string) (int) round( $n );
		}

		return wp_number_format_i18n( $n, 1 );
	}

	/**
	 * Fetch SaaS batch rows for a user (same payload as the jobs list).
	 *
	 * @param string $user_id SaaS user id.
	 * @return array<int, array<string, mixed>>|null List of batch rows, or null on failure.
	 */
	private function fetch_saas_batches_raw_for_user( $user_id ) {
		$user_id = sanitize_text_field( (string) $user_id );
		if ( '' === $user_id ) {
			return null;
		}

		$url      = add_query_arg(
			array(
				'userId' => rawurlencode( $user_id ),
			),
			self::API_BATCHES
		);
		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => 25,
				'sslverify' => true,
				'headers'   => array(
					'Accept' => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return null;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = (string) wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( 200 !== $code || ! is_array( $data ) ) {
			return null;
		}

		$list = isset( $data['batch'] ) && is_array( $data['batch'] ) ? $data['batch'] : array();

		return $list;
	}

	/**
	 * Fetch dashboard aggregates from SaaS for the verified plugin user.
	 *
	 * @return void
	 */
	public function handle_ajax_get_dashboard_stats() {
		check_ajax_referer( self::NONCE_GET_DASHBOARD, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$user_id = $this->get_verified_user_id_for_api();
		if ( '' === $user_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'User is not verified. Please complete signup/OTP verification.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$cache_key = self::cache_key_stats( $user_id );
		$force     = self::request_force_refresh();

		if ( ! $force ) {
			$cached = get_transient( $cache_key );
			if ( is_array( $cached ) && isset( $cached['articlesGenerated'] ) ) {
				if ( ! isset( $cached['failedArticles'] ) && isset( $cached['failedJobs'] ) ) {
					$cached['failedArticles'] = (int) $cached['failedJobs'];
				}
				Whoneedsawriter_Repository::save_dashboard_stats( $user_id, $cached );
				wp_send_json_success( $cached );
			}
		}

		$url      = add_query_arg(
			array(
				'id' => rawurlencode( $user_id ),
			),
			self::API_DASHBOARD
		);
		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => 20,
				'sslverify' => true,
				'headers'   => array(
					'Accept' => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			$db_stats = Whoneedsawriter_Repository::get_dashboard_stats( $user_id );
			if ( is_array( $db_stats ) ) {
				wp_send_json_success( $db_stats );
			}
			wp_send_json_error(
				array(
					'message' => __( 'Could not reach the service. Please try again later.', 'whoneedsawriter' ),
				),
				502
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = (string) wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( 200 !== $code || ! is_array( $data ) ) {
			$db_stats = Whoneedsawriter_Repository::get_dashboard_stats( $user_id );
			if ( is_array( $db_stats ) ) {
				wp_send_json_success( $db_stats );
			}

			$message = __( 'Could not load dashboard data.', 'whoneedsawriter' );
			if ( is_array( $data ) && ! empty( $data['error'] ) ) {
				$message = sanitize_text_field( (string) $data['error'] );
			}

			wp_send_json_error(
				array(
					'message' => $message,
				),
				400
			);
		}

		$articles_generated  = isset( $data['articlesGenerated'] ) ? (int) $data['articlesGenerated'] : ( isset( $data['articles_generated'] ) ? (int) $data['articles_generated'] : 0 );
		$articles_published  = isset( $data['articlesPublished'] ) ? (int) $data['articlesPublished'] : ( isset( $data['articles_published'] ) ? (int) $data['articles_published'] : 0 );
		$active_jobs         = isset( $data['activeJobs'] ) ? (int) $data['activeJobs'] : ( isset( $data['active_jobs'] ) ? (int) $data['active_jobs'] : 0 );
		$failed_articles     = isset( $data['failedJobs'] ) ? (int) $data['failedJobs'] : ( isset( $data['failed_jobs'] ) ? (int) $data['failed_jobs'] : 0 );

		$batches = $this->fetch_saas_batches_raw_for_user( $user_id );
		if ( is_array( $batches ) ) {
			$active_jobs     = 0;
			$failed_articles = 0;
			foreach ( $batches as $row ) {
				if ( ! is_array( $row ) ) {
					continue;
				}
				$status_int = isset( $row['status'] ) && is_numeric( $row['status'] ) ? (int) $row['status'] : -1;
				if ( 0 === $status_int ) {
					$active_jobs++;
				}
				$failed_articles += isset( $row['failed_articles'] ) ? (int) $row['failed_articles'] : 0;
			}
		}

		$stats = array(
			'articlesGenerated' => max( 0, $articles_generated ),
			'articlesPublished' => max( 0, $articles_published ),
			'activeJobs'        => max( 0, $active_jobs ),
			'failedArticles'    => max( 0, $failed_articles ),
		);

		set_transient( $cache_key, $stats, self::CACHE_TTL_DASHBOARD );
		Whoneedsawriter_Repository::save_dashboard_stats( $user_id, $stats );

		wp_send_json_success( $stats );
	}

	/**
	 * Normalize SaaS batch `name` for plugin UI: always a single leading `#`
	 * (e.g. `WNAW-051426-1` → `#WNAW-051426-1`). Matches what the Job Detail
	 * header expects next to the "Job ID:" label.
	 *
	 * @param string $raw Raw name from the batches API.
	 * @return string
	 */
	private static function normalize_plugin_batch_display_name( $raw ) {
		$s = is_string( $raw ) ? trim( $raw ) : '';
		if ( '' === $s ) {
			return '';
		}
		$s = preg_replace( '/^#+/u', '', $s );

		return '' !== $s ? '#' . $s : '';
	}

	/**
	 * Fetch jobs/articles from SaaS and enrich with local author names & post URLs.
	 *
	 * @return void
	 */
	public function handle_ajax_get_jobs() {
		check_ajax_referer( self::NONCE_GET_JOBS, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$user_id = $this->get_verified_user_id_for_api();
		if ( '' === $user_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'User is not verified. Please complete signup/OTP verification.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$batch_id = isset( $_POST['batchId'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['batchId'] ) ) : '';

		$query_args = array(
			'userId' => rawurlencode( $user_id ),
		);
		if ( '' !== $batch_id ) {
			$query_args['batchId'] = rawurlencode( $batch_id );
		}

		$url      = add_query_arg( $query_args, self::API_BATCHES );
		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => 25,
				'sslverify' => true,
				'headers'   => array(
					'Accept' => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			$db_rows = array();
			foreach ( Whoneedsawriter_Repository::get_batches_for_user( $user_id ) as $db_row ) {
				$db_rows[] = Whoneedsawriter_Repository::db_batch_to_normalized( $db_row );
			}
			if ( ! empty( $db_rows ) ) {
				wp_send_json_success( array( 'rows' => $db_rows, 'source' => 'db' ) );
			}
			wp_send_json_error(
				array(
					'message' => __( 'Could not reach the service. Please try again later.', 'whoneedsawriter' ),
				),
				502
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = (string) wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( 200 !== $code || ! is_array( $data ) ) {
			$db_rows = array();
			foreach ( Whoneedsawriter_Repository::get_batches_for_user( $user_id ) as $db_row ) {
				$db_rows[] = Whoneedsawriter_Repository::db_batch_to_normalized( $db_row );
			}
			if ( ! empty( $db_rows ) ) {
				wp_send_json_success( array( 'rows' => $db_rows, 'source' => 'db' ) );
			}

			$message = __( 'Could not load jobs.', 'whoneedsawriter' );
			if ( is_array( $data ) && ! empty( $data['error'] ) ) {
				$message = sanitize_text_field( (string) $data['error'] );
			}

			wp_send_json_error(
				array(
					'message' => $message,
				),
				400
			);
		}

		// Single batch request: SaaS returns a flat object with { name, id, status, … }.
		if ( '' !== $batch_id ) {
			$row = $data;
			$status_raw = isset( $row['status'] ) ? $row['status'] : null;
			$status_int = is_numeric( $status_raw ) ? (int) $status_raw : -1;

			$article_status_map = self::build_batch_article_status_keys_map( $user_id, $batch_id );
			$keys               = isset( $article_status_map[ $batch_id ] ) ? $article_status_map[ $batch_id ] : array();

			$normalized = self::normalize_batch_row( $row, $status_int, $keys );
			Whoneedsawriter_Repository::upsert_batch_row( $user_id, $normalized );

			wp_send_json_success(
				array(
					'batch' => $normalized,
				)
			);
		}

		$list = isset( $data['batch'] ) && is_array( $data['batch'] ) ? $data['batch'] : array();

		$article_status_map = self::build_batch_article_status_keys_map( $user_id );

		$rows = array();

		foreach ( $list as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}

			$status_raw = isset( $row['status'] ) ? $row['status'] : null;
			$status_int = is_numeric( $status_raw ) ? (int) $status_raw : -1;
			$batch_id   = isset( $row['id'] ) ? sanitize_text_field( (string) $row['id'] ) : '';
			$keys       = ( '' !== $batch_id && isset( $article_status_map[ $batch_id ] ) )
				? $article_status_map[ $batch_id ]
				: array();

			$rows[] = self::normalize_batch_row( $row, $status_int, $keys );
		}

		Whoneedsawriter_Repository::upsert_batch_rows( $user_id, $rows );

		wp_send_json_success(
			array(
				'rows' => $rows,
			)
		);
	}

	/**
	 * Normalize a raw SaaS batch row into the camelCase shape used by JS.
	 *
	 * @param array        $row                 Raw SaaS batch data.
	 * @param int          $status_int          Numeric batch status.
	 * @param string[]     $article_status_keys Article status keys for this batch (generating|generated|failed).
	 * @return array
	 */
	private static function normalize_batch_row( array $row, $status_int, array $article_status_keys = array() ) {
		$display      = self::resolve_batch_display_status( $row, $status_int, $article_status_keys );
		$status_key   = $display['key'];
		$status_label = $display['label'];

		$raw_name = isset( $row['name'] ) ? sanitize_text_field( (string) $row['name'] ) : '';

		return array(
			'id'                 => isset( $row['id'] ) ? sanitize_text_field( (string) $row['id'] ) : '',
			'name'               => self::normalize_plugin_batch_display_name( $raw_name ),
			'articles'           => isset( $row['articles'] ) ? (int) $row['articles'] : 0,
			'completedArticles'  => isset( $row['completed_articles'] ) ? (int) $row['completed_articles'] : 0,
			'pendingArticles'    => isset( $row['pending_articles'] ) ? (int) $row['pending_articles'] : 0,
			'failedArticles'     => isset( $row['failed_articles'] ) ? (int) $row['failed_articles'] : 0,
			'statusInt'          => $status_int,
			'statusLabel'        => $status_label,
			'statusKey'          => $status_key,
			'createdAt'          => isset( $row['createdAt'] ) ? sanitize_text_field( (string) $row['createdAt'] ) : '',
		);
	}

	/**
	 * Batch-level status for the jobs list (same three states as article rows).
	 *
	 * @param array    $row                 Raw SaaS batch row.
	 * @param int      $status_int          SaaS batch status.
	 * @param string[] $article_status_keys Per-article keys for this batch.
	 * @return array{key: string, label: string}
	 */
	private static function resolve_batch_display_status( array $row, $status_int, array $article_status_keys ) {
		$articles        = isset( $row['articles'] ) ? (int) $row['articles'] : 0;
		$failed_articles = isset( $row['failed_articles'] ) ? (int) $row['failed_articles'] : 0;

		if ( ! empty( $article_status_keys ) ) {
			$total      = count( $article_status_keys );
			$failed     = 0;
			$generating = 0;
			$generated  = 0;

			foreach ( $article_status_keys as $key ) {
				$key = sanitize_key( (string) $key );
				if ( 'failed' === $key ) {
					++$failed;
				} elseif ( 'generated' === $key ) {
					++$generated;
				} else {
					++$generating;
				}
			}

			if ( $total > 0 && $failed >= $total ) {
				return array(
					'key'   => 'failed',
					'label' => __( 'Failed', 'whoneedsawriter' ),
				);
			}

			if ( $generating > 0 ) {
				return array(
					'key'   => 'generating',
					'label' => __( 'Generating', 'whoneedsawriter' ),
				);
			}

			$eligible = max( 0, $total - $failed );
			if ( $eligible > 0 && $generated >= $eligible ) {
				return array(
					'key'   => 'generated',
					'label' => __( 'Generated', 'whoneedsawriter' ),
				);
			}
		}

		if ( $articles > 0 && $failed_articles >= $articles ) {
			return array(
				'key'   => 'failed',
				'label' => __( 'Failed', 'whoneedsawriter' ),
			);
		}

		if ( 1 === $status_int ) {
			return array(
				'key'   => 'generated',
				'label' => __( 'Generated', 'whoneedsawriter' ),
			);
		}

		return array(
			'key'   => 'generating',
			'label' => __( 'Generating', 'whoneedsawriter' ),
		);
	}

	/**
	 * Fetch raw article rows from SaaS for the verified user.
	 *
	 * @param string $user_id  SaaS user id.
	 * @param string $batch_id Optional batch scope.
	 * @return array<int, array<string, mixed>>
	 */
	private static function fetch_saas_articles_list( $user_id, $batch_id = '' ) {
		$user_id = sanitize_text_field( (string) $user_id );
		if ( '' === $user_id ) {
			return array();
		}

		$query_args = array(
			'userId' => rawurlencode( $user_id ),
		);
		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' !== $batch_id ) {
			$query_args['batchId'] = rawurlencode( $batch_id );
		}

		$url      = add_query_arg( $query_args, self::API_ARTICLES );
		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => 25,
				'sslverify' => true,
				'headers'   => array(
					'Accept' => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return array();
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = (string) wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( 200 !== $code || ! is_array( $data ) ) {
			return array();
		}

		$list = isset( $data['articles'] ) && is_array( $data['articles'] ) ? $data['articles'] : array();

		return array_values(
			array_filter(
				$list,
				function ( $row ) {
					return is_array( $row );
				}
			)
		);
	}

	/**
	 * Article display status key for a raw SaaS article row.
	 *
	 * @param array<string, mixed> $row SaaS article row.
	 * @return string generating|generated|failed
	 */
	private static function compute_article_status_key_from_saas_row( array $row ) {
		$keyword = isset( $row['keyword'] ) ? (string) $row['keyword'] : '';
		$title   = ( isset( $row['title'] ) && null !== $row['title'] && '' !== $row['title'] )
			? (string) $row['title']
			: $keyword;

		$is_published   = self::job_is_published_sentinel( $row );
		$status_int     = isset( $row['status'] ) && is_numeric( $row['status'] ) ? (int) $row['status'] : -1;
		$wp_post_id     = self::resolve_job_article_wp_post_id( $row, $title );
		$wp_post_status = self::get_wp_post_status_by_id( $wp_post_id );

		return self::resolve_article_display_status( $is_published, $status_int, $wp_post_status )['key'];
	}

	/**
	 * Map batch id → list of article status keys (for jobs list aggregation).
	 *
	 * @param string $user_id  SaaS user id.
	 * @param string $batch_id Optional batch scope.
	 * @return array<string, string[]>
	 */
	private static function build_batch_article_status_keys_map( $user_id, $batch_id = '' ) {
		$list = self::fetch_saas_articles_list( $user_id, $batch_id );
		$map  = array();

		foreach ( $list as $row ) {
			$bid = self::extract_batch_id_from_article_row( $row );
			if ( '' === $bid ) {
				continue;
			}

			if ( ! isset( $map[ $bid ] ) ) {
				$map[ $bid ] = array();
			}

			$map[ $bid ][] = self::compute_article_status_key_from_saas_row( $row );
		}

		return $map;
	}

	/**
	 * Fetch article rows from SaaS. Optional `batch_id` POST param scopes the
	 * request to a single batch; without it, returns every article for the
	 * current verified user. The SaaS endpoint shape is
	 * `{ articles: PluginJobArticleRow[] }` per the contract.
	 *
	 * @return void
	 */
	public function handle_ajax_get_articles() {
		check_ajax_referer( self::NONCE_GET_ARTICLES, 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error(
				array(
					'message' => __( 'You are not allowed to perform this action.', 'whoneedsawriter' ),
				),
				403
			);
		}

		$user_id = $this->get_verified_user_id_for_api();
		if ( '' === $user_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'User is not verified. Please complete signup/OTP verification.', 'whoneedsawriter' ),
				),
				400
			);
		}

		$batch_id_raw = isset( $_POST['batch_id'] ) ? wp_unslash( (string) $_POST['batch_id'] ) : '';
		$batch_id     = sanitize_text_field( $batch_id_raw );

		$query_args = array(
			'userId' => rawurlencode( $user_id ),
		);
		if ( '' !== $batch_id ) {
			$query_args['batchId'] = rawurlencode( $batch_id );
		}
		$url = add_query_arg( $query_args, self::API_ARTICLES );

		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => 25,
				'sslverify' => true,
				'headers'   => array(
					'Accept' => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			if ( '' !== $batch_id ) {
				$db_rows = self::get_db_articles_normalized( $batch_id );
				if ( ! empty( $db_rows ) ) {
					wp_send_json_success(
						array(
							'rows'    => $db_rows,
							'batchId' => $batch_id,
							'source'  => 'db',
						)
					);
				}
			}
			wp_send_json_error(
				array(
					'message' => __( 'Could not reach the service. Please try again later.', 'whoneedsawriter' ),
				),
				502
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = (string) wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( 200 !== $code || ! is_array( $data ) ) {
			if ( '' !== $batch_id ) {
				$db_rows = self::get_db_articles_normalized( $batch_id );
				if ( ! empty( $db_rows ) ) {
					wp_send_json_success(
						array(
							'rows'    => $db_rows,
							'batchId' => $batch_id,
							'source'  => 'db',
						)
					);
				}
			}
			$message = __( 'Could not load articles.', 'whoneedsawriter' );
			if ( is_array( $data ) && ! empty( $data['error'] ) ) {
				$message = sanitize_text_field( (string) $data['error'] );
			}
			wp_send_json_error(
				array(
					'message' => $message,
				),
				400
			);
		}

		$list = isset( $data['articles'] ) && is_array( $data['articles'] ) ? $data['articles'] : array();

		$rows      = array();
		$slot_idx  = 0;
		foreach ( $list as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}

			$keyword = isset( $row['keyword'] ) ? (string) $row['keyword'] : '';
			$title   = ( isset( $row['title'] ) && null !== $row['title'] && '' !== $row['title'] )
				? (string) $row['title']
				: $keyword;

			$is_published = self::job_is_published_sentinel( $row );
			$status_int   = isset( $row['status'] ) && is_numeric( $row['status'] ) ? (int) $row['status'] : -1;

			$wp_post_id     = self::resolve_job_article_wp_post_id( $row, $title );
			$wp_post_status = self::get_wp_post_status_by_id( $wp_post_id );
			$edit_post_url  = self::resolve_job_article_wp_edit_url( $row, $title );
			$batch_id_row = self::extract_batch_id_from_article_row( $row );
			if ( '' === $batch_id_row && '' !== $batch_id ) {
				$batch_id_row = $batch_id;
			}
			$article_slot   = self::extract_schedule_slot_index_from_data( $row );
			$scheduled_time = self::resolve_article_scheduled_time_label(
				$row,
				$title,
				$wp_post_id,
				$article_slot > 0 ? $article_slot : $slot_idx
			);

			if ( self::is_article_marked_removed( $batch_id_row, $title, $wp_post_id ) ) {
				$status_key   = 'removed';
				$status_label = __( 'Removed', 'whoneedsawriter' );
				$wp_post_id     = 0;
				$wp_post_status = '';
				$edit_post_url  = '';
			} else {
				$status       = self::resolve_article_display_status( $is_published, $status_int, $wp_post_status );
				$status_key   = $status['key'];
				$status_label = $status['label'];
			}

			$rows[] = array(
				'keyword'        => sanitize_text_field( $keyword ),
				'title'          => sanitize_text_field( $title ),
				'statusInt'      => $status_int,
				'statusKey'      => $status_key,
				'statusLabel'    => $status_label,
				'isPublished'    => (bool) $is_published,
				'wpPostStatus'   => $wp_post_status,
				'wpPostId'       => $wp_post_id,
				'editPostUrl'    => $edit_post_url,
				'batchId'        => $batch_id_row,
				'scheduledTime'  => $scheduled_time,
				'model'          => isset( $row['model'] ) && null !== $row['model'] ? sanitize_text_field( (string) $row['model'] ) : '',
				'category'       => isset( $row['category'] ) && null !== $row['category'] ? sanitize_text_field( (string) $row['category'] ) : '',
				'author'         => isset( $row['author'] ) && null !== $row['author'] ? sanitize_text_field( (string) $row['author'] ) : '',
			);

			++$slot_idx;
		}

		if ( '' !== $batch_id && ! empty( $rows ) ) {
			Whoneedsawriter_Repository::upsert_article_rows( $batch_id, $rows );
		}

		wp_send_json_success(
			array(
				'rows'    => $rows,
				'batchId' => $batch_id,
			)
		);
	}

	/**
	 * WordPress post_status for a resolved post ID.
	 *
	 * @param int $post_id Post ID.
	 * @return string publish|future|draft|… or empty.
	 */
	private static function get_wp_post_status_by_id( $post_id ) {
		$post_id = absint( $post_id );
		if ( $post_id <= 0 ) {
			return '';
		}

		$post = get_post( $post_id );

		return ( $post instanceof WP_Post ) ? (string) $post->post_status : '';
	}

	/**
	 * UI status for an article row (Job Detail table).
	 *
	 * Only three statuses are exposed to the UI:
	 * - generating: WP post not found yet
	 * - generated:  WP post found (any WP status: draft/future/publish/etc)
	 * - failed:     SaaS numeric status == 2
	 *
	 * @param bool   $is_published    SaaS isPublished sentinel (used only as fallback).
	 * @param int    $status_int      SaaS numeric status.
	 * @param string $wp_post_status  Local WP post_status (empty when unknown).
	 * @return array{key: string, label: string}
	 */
	private static function resolve_article_display_status( $is_published, $status_int, $wp_post_status ) {
		$wp_post_status = sanitize_key( (string) $wp_post_status );

		if ( 2 === $status_int ) {
			return array(
				'key'   => 'failed',
				'label' => __( 'Failed', 'whoneedsawriter' ),
			);
		}

		// If WP post exists in any status, treat as Generated.
		if ( '' !== $wp_post_status ) {
			return array(
				'key'   => 'generated',
				'label' => __( 'Generated', 'whoneedsawriter' ),
			);
		}

		// If WP post doesn't exist yet, keep as Generating (regardless of SaaS status).
		if ( 0 === $status_int ) {
			return array(
				'key'   => 'generating',
				'label' => __( 'Generating', 'whoneedsawriter' ),
			);
		}

		return array(
			'key'   => 'generating',
			'label' => __( 'Generating', 'whoneedsawriter' ),
		);
	}

	/**
	 * Whether SaaS marks the row as published (check this before numeric status).
	 *
	 * @param array<string,mixed> $row Row.
	 * @return bool
	 */
	private static function job_is_published_sentinel( array $row ) {
		if ( ! array_key_exists( 'isPublished', $row ) ) {
			return false;
		}

		$v = $row['isPublished'];

		if ( true === $v || 1 === $v || '1' === $v ) {
			return true;
		}

		if ( is_string( $v ) && 'true' === strtolower( $v ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Resolve status label per plugin rules (isPublished first).
	 *
	 * @param array<string,mixed> $row Row.
	 * @return string
	 */
	private static function resolve_job_status_label_static( array $row ) {
		if ( self::job_is_published_sentinel( $row ) ) {
			return __( 'Published', 'whoneedsawriter' );
		}

		$status = isset( $row['status'] ) ? (int) $row['status'] : -1;

		if ( 0 === $status ) {
			return __( 'Generating', 'whoneedsawriter' );
		}

		if ( 1 === $status ) {
			return __( 'Completed', 'whoneedsawriter' );
		}

		if ( 2 === $status ) {
			return __( 'Failed', 'whoneedsawriter' );
		}

		return __( 'Unknown', 'whoneedsawriter' );
	}

	/**
	 * Map model slug to display label.
	 *
	 * @param mixed $model Raw model.
	 * @return string
	 */
	private static function resolve_job_model_label_static( $model ) {
		$m = strtolower( trim( (string) $model ) );

		if ( '1a-lite' === $m ) {
			return __( '1a Lite', 'whoneedsawriter' );
		}
		if ( '1a-core' === $m ) {
			return __( '1a Core', 'whoneedsawriter' );
		}
		if ( '1a-pro' === $m ) {
			return __( '1a Pro', 'whoneedsawriter' );
		}

		return sanitize_text_field( trim( (string) $model ) );
	}

	/**
	 * Resolve WordPress display name from author field (expected to be numeric user id).
	 *
	 * @param mixed $author_raw Author from API.
	 * @return string
	 */
	private static function resolve_author_display_from_api_value( $author_raw ) {
		$str = trim( (string) $author_raw );
		if ( '' === $str ) {
			return '';
		}

		$id = absint( preg_replace( '/[^\d]/', '', $str ) );
		if ( $id <= 0 ) {
			return '';
		}

		$user = get_userdata( $id );
		if ( ! $user ) {
			return '';
		}

		$name = $user->display_name ? $user->display_name : $user->user_login;

		return sanitize_text_field( (string) $name );
	}

	/**
	 * Batch id on a SaaS article row (for cross-batch schedule lookup).
	 *
	 * @param array<string,mixed> $row SaaS article row.
	 * @return string
	 */
	private static function extract_batch_id_from_article_row( array $row ) {
		$keys = array( 'batchId', 'batch_id', 'BatchId', 'batchID' );

		foreach ( $keys as $key ) {
			if ( ! empty( $row[ $key ] ) ) {
				return sanitize_text_field( (string) $row[ $key ] );
			}
		}

		return '';
	}

	/**
	 * SaaS batch cadence values (anchor + slot index → per-article datetime).
	 *
	 * @param string $schedule_time Raw scheduleTime from SaaS.
	 * @return bool
	 */
	public static function is_saas_batch_schedule_frequency( $schedule_time ) {
		return in_array(
			sanitize_key( (string) $schedule_time ),
			array( 'one_post_per_day', 'one_post_per_weekly', 'one_post_per_monthly' ),
			true
		);
	}

	/**
	 * @param array<string,mixed> $data Row or REST payload.
	 * @return string
	 */
	public static function extract_schedule_time_from_data( array $data ) {
		$keys = array( 'scheduleTime', 'schedule_time' );

		foreach ( $keys as $key ) {
			if ( ! empty( $data[ $key ] ) ) {
				return sanitize_key( (string) $data[ $key ] );
			}
		}

		return '';
	}

	/**
	 * Zero-based article slot for schedule offset (0 = batch publishedStartDateTime).
	 *
	 * @param array<string,mixed> $data Row or REST payload.
	 * @return int
	 */
	public static function extract_schedule_slot_index_from_data( array $data ) {
		$explicit = self::extract_article_row_index_from_payload( $data );

		return $explicit >= 0 ? $explicit : 0;
	}

	/**
	 * Zero-based article slot when explicitly present in payload; otherwise -1.
	 *
	 * @param array<string,mixed> $data Row or REST payload.
	 * @return int
	 */
	public static function extract_article_row_index_from_payload( array $data ) {
		$keys = array(
			'articleIndex',
			'article_index',
			'keywordIndex',
			'keyword_index',
			'scheduleSlotIndex',
			'schedule_slot_index',
			'slotIndex',
			'slot_index',
			'publishOrder',
			'publish_order',
			'order',
		);

		foreach ( $keys as $key ) {
			if ( isset( $data[ $key ] ) && is_numeric( $data[ $key ] ) ) {
				return max( 0, (int) $data[ $key ] );
			}
		}

		return -1;
	}

	/**
	 * Per-article schedule: publishedStartDateTime + (slot × day/week/month per scheduleTime).
	 *
	 * Example: base `2026-05-24 12:32:00`, one_post_per_weekly, slot 2 → +14 days.
	 *
	 * @param string $base_mysql    Batch anchor `Y-m-d H:i:s` (site-local).
	 * @param string $schedule_time one_post_per_day|weekly|monthly.
	 * @param int    $slot_index    Zero-based article index in the batch.
	 * @return string MySQL datetime or empty.
	 */
	public static function compute_saas_scheduled_slot_datetime_mysql( $base_mysql, $schedule_time, $slot_index ) {
		$base_mysql    = trim( (string) $base_mysql );
		$schedule_time = sanitize_key( (string) $schedule_time );
		$slot_index    = max( 0, (int) $slot_index );

		if ( '' === $base_mysql || ! self::is_saas_batch_schedule_frequency( $schedule_time ) ) {
			return '';
		}

		$dt = self::parse_published_start_datetime( $base_mysql );
		if ( ! $dt instanceof DateTime ) {
			return '';
		}

		if ( $slot_index > 0 ) {
			if ( 'one_post_per_weekly' === $schedule_time ) {
				$dt->modify( '+' . ( 7 * $slot_index ) . ' days' );
			} elseif ( 'one_post_per_monthly' === $schedule_time ) {
				$dt->modify( '+' . $slot_index . ' months' );
			} else {
				$dt->modify( '+' . $slot_index . ' days' );
			}
		}

		return $dt->format( 'Y-m-d H:i:s' );
	}

	/**
	 * Parse schedule anchor from Generate form / POST into a site-timezone DateTime.
	 *
	 * @param string $raw MySQL `Y-m-d H:i:s` or ISO-8601.
	 * @return DateTime|null
	 */
	private static function parse_published_start_datetime( $raw ) {
		$raw = trim( (string) $raw );
		if ( '' === $raw ) {
			return null;
		}

		try {
			$tz = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		} catch ( Exception $e ) {
			$tz = new DateTimeZone( 'UTC' );
		}

		// MySQL-style local datetime (from Generate form or plugin).
		if ( preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/', $raw ) ) {
			$normalized = $raw;
			if ( preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $normalized ) ) {
				$normalized .= ':00';
			}
			$dt = DateTime::createFromFormat( 'Y-m-d H:i:s', substr( $normalized, 0, 19 ), $tz );

			return $dt instanceof DateTime ? $dt : null;
		}

		// ISO-8601 from SaaS/Prisma (e.g. "2026-05-25T03:30:00.000Z") — convert UTC → site TZ.
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}T/', $raw ) ) {
			try {
				$dt = new DateTime( $raw );
				$dt->setTimezone( $tz );

				return $dt;
			} catch ( Exception $e ) {
				return null;
			}
		}

		return null;
	}

	/**
	 * Normalize batch schedule start for SaaS API (Prisma expects ISO-8601 DateTime).
	 *
	 * @param string $raw Raw value from the Generate form / POST.
	 * @return string ISO-8601 datetime or empty.
	 */
	private static function normalize_published_start_datetime_for_api( $raw ) {
		$dt = self::parse_published_start_datetime( $raw );
		if ( ! $dt instanceof DateTime ) {
			return '';
		}

		return $dt->format( 'c' );
	}

	/**
	 * Human-readable scheduled publish label (matches Generate-page preview style).
	 *
	 * @param string $mysql_datetime MySQL or ISO datetime string.
	 * @return string
	 */
	private static function format_article_scheduled_datetime_label( $mysql_datetime ) {
		$raw = trim( (string) $mysql_datetime );
		if ( '' === $raw ) {
			return '';
		}

		try {
			$tz = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		} catch ( Exception $e ) {
			$tz = new DateTimeZone( 'UTC' );
		}

		// Bare MySQL strings (from compute_saas_scheduled_slot_datetime_mysql or WP post_date)
		// are already in site-local time.  WP forces PHP default TZ to UTC, so strtotime()
		// would misinterpret them; use explicit DateTime with site TZ instead.
		$dt = DateTime::createFromFormat( 'Y-m-d H:i:s', $raw, $tz );
		if ( ! $dt instanceof DateTime ) {
			try {
				$dt = new DateTime( $raw );
				$dt->setTimezone( $tz );
			} catch ( Exception $e ) {
				return sanitize_text_field( $raw );
			}
		}

		if ( ! $dt instanceof DateTime ) {
			return sanitize_text_field( $raw );
		}

		$date_part = wp_date( 'M j, Y', $dt->getTimestamp(), $tz );
		$time_part = wp_date( 'g:i A', $dt->getTimestamp(), $tz );

		return $date_part . ' · ' . $time_part;
	}

	/**
	 * Scheduled time for an article: SaaS field first, then WordPress future post date.
	 *
	 * @param array<string,mixed> $row         SaaS article row.
	 * @param string              $title_plain Title for WP lookup.
	 * @param int                 $post_id     Optional pre-resolved post ID.
	 * @param int                 $slot_index  Zero-based slot for batch schedule offset.
	 * @return string
	 */
	private static function resolve_article_scheduled_time_label( array $row, $title_plain, $post_id = 0, $slot_index = 0 ) {
		$base          = '';
		$base_keys     = array( 'publishedStartDateTime', 'published_start_datetime' );
		foreach ( $base_keys as $key ) {
			if ( ! empty( $row[ $key ] ) ) {
				$base = trim( (string) $row[ $key ] );
				break;
			}
		}
		$schedule_time = self::extract_schedule_time_from_data( $row );

		if ( '' !== $base && self::is_saas_batch_schedule_frequency( $schedule_time ) ) {
			$computed = self::compute_saas_scheduled_slot_datetime_mysql( $base, $schedule_time, $slot_index );
			if ( '' !== $computed ) {
				return self::format_article_scheduled_datetime_label( $computed );
			}
		}

		$api_keys = array(
			'scheduledAt',
			'scheduled_at',
			'publishAt',
			'publish_at',
		);

		foreach ( $api_keys as $key ) {
			if ( empty( $row[ $key ] ) ) {
				continue;
			}
			$v = trim( (string) $row[ $key ] );
			if ( '' === $v ) {
				continue;
			}
			if ( preg_match( '/^\d{4}-\d{2}-\d{2}/', $v ) ) {
				$formatted = self::format_article_scheduled_datetime_label( $v );
				if ( '' !== $formatted ) {
					return $formatted;
				}
			}

			return sanitize_text_field( $v );
		}

		if ( $post_id <= 0 ) {
			$post_id = self::resolve_job_article_wp_post_id( $row, $title_plain );
		}
		if ( $post_id <= 0 ) {
			return '';
		}

		$post = get_post( $post_id );
		if ( ! $post instanceof WP_Post ) {
			return '';
		}

		if ( 'future' === $post->post_status ) {
			return self::format_article_scheduled_datetime_label( $post->post_date );
		}

		return '';
	}

	/**
	 * Resolve local WordPress post ID for a SaaS article row (explicit id fields, then title + SaaS meta, then title-only).
	 *
	 * @param array<string,mixed> $row           SaaS article row.
	 * @param string              $title_plain   Plain title used for DB match (same as stored post_title).
	 * @return int Post ID or 0.
	 */
	private static function resolve_job_article_wp_post_id( array $row, $title_plain ) {
		$id_keys = array(
			'wpPostId',
			'wordpressPostId',
			'wordPressPostId',
			'WordPressPostId',
			'wp_post_id',
		);

		foreach ( $id_keys as $key ) {
			if ( ! isset( $row[ $key ] ) ) {
				continue;
			}
			$raw = $row[ $key ];
			if ( is_string( $raw ) ) {
				$raw = preg_replace( '/[^\d]/', '', $raw );
			}
			$candidate = is_numeric( $raw ) ? absint( $raw ) : 0;
			if ( $candidate > 0 ) {
				$post = get_post( $candidate );
				if ( $post instanceof WP_Post && 'post' === $post->post_type && 'trash' !== $post->post_status ) {
					return (int) $post->ID;
				}
			}
		}

		$raw   = trim( wp_strip_all_tags( (string) $title_plain ) );
		$plain = trim( html_entity_decode( $raw, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );

		if ( '' === $plain && '' === $raw ) {
			return 0;
		}

		global $wpdb;

		$meta_key = '_wnaw_saas_post';
		if ( class_exists( 'Whoneedsawriter_REST_Create_Post' ) ) {
			$meta_key = Whoneedsawriter_REST_Create_Post::META_FLAG;
		}

		// Build title candidates: decoded, raw, and re-encoded forms.
		$candidates = array_values( array_unique( array_filter( array(
			$plain,
			$raw,
			htmlspecialchars( $plain, ENT_QUOTES | ENT_HTML5, 'UTF-8', false ),
		) ) ) );

		// 1. Exact match with our SaaS meta flag (most reliable).
		foreach ( $candidates as $title_candidate ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$by_meta = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT p.ID FROM {$wpdb->posts} AS p
					INNER JOIN {$wpdb->postmeta} AS pm ON pm.post_id = p.ID AND pm.meta_key = %s
					WHERE p.post_type = 'post'
					AND p.post_status NOT IN ( 'trash', 'auto-draft' )
					AND p.post_title = %s
					AND ( pm.meta_value = '1' OR pm.meta_value = 'true' )
					ORDER BY p.ID DESC
					LIMIT 1",
					$meta_key,
					$title_candidate
				)
			);

			if ( $by_meta ) {
				return (int) $by_meta;
			}
		}

		// 2. Exact match by title only (no meta requirement).
		foreach ( $candidates as $title_candidate ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$by_title = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT ID FROM {$wpdb->posts}
					WHERE post_type = 'post'
					AND post_status IN ( 'publish', 'future', 'draft', 'private', 'pending' )
					AND post_title = %s
					ORDER BY FIELD( post_status, 'publish', 'future', 'private', 'draft', 'pending' ), ID DESC
					LIMIT 1",
					$title_candidate
				)
			);

			if ( $by_title ) {
				return (int) $by_title;
			}
		}

		// 3. Fuzzy fallback: strip all non-alphanumeric chars and match with LIKE.
		$alpha_only = preg_replace( '/[^a-zA-Z0-9]/', '%', $plain );
		if ( '' !== $alpha_only && strlen( $alpha_only ) > 10 ) {
			$like_pattern = '%' . $wpdb->esc_like( preg_replace( '/%+/', '%', $alpha_only ) ) . '%';

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$by_like = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT p.ID FROM {$wpdb->posts} AS p
					INNER JOIN {$wpdb->postmeta} AS pm ON pm.post_id = p.ID AND pm.meta_key = %s
					WHERE p.post_type = 'post'
					AND p.post_status NOT IN ( 'trash', 'auto-draft' )
					AND p.post_title LIKE %s
					AND ( pm.meta_value = '1' OR pm.meta_value = 'true' )
					ORDER BY p.ID DESC
					LIMIT 1",
					$meta_key,
					$like_pattern
				)
			);

			if ( $by_like ) {
				return (int) $by_like;
			}
		}

		return 0;
	}

	/**
	 * Admin edit URL for a published SaaS article when we can resolve a local post.
	 *
	 * @param array<string,mixed> $row           SaaS article row.
	 * @param string              $title_plain Title used for resolution fallback.
	 * @return string Absolute edit URL or empty.
	 */
	private static function resolve_job_article_wp_edit_url( array $row, $title_plain ) {
		$post_id = self::resolve_job_article_wp_post_id( $row, $title_plain );
		if ( $post_id <= 0 ) {
			return '';
		}

		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return '';
		}

		$link = get_edit_post_link( $post_id, 'raw' );

		return is_string( $link ) && '' !== $link ? esc_url_raw( $link ) : '';
	}

	/**
	 * Find a public scheduled or published post with the exact title and return its front URL.
	 *
	 * @param string $title Post title from API.
	 * @return string Absolute URL or empty string.
	 */
	private static function get_frontend_post_url_by_exact_title( $title ) {
		$plain = wp_strip_all_tags( (string) $title );
		$plain = trim( $plain );

		if ( '' === $plain ) {
			return '';
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$post_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'post' AND post_status IN ( 'publish', 'future' ) AND post_title = %s LIMIT 1",
				$plain
			)
		);

		if ( ! $post_id ) {
			return '';
		}

		$link = get_permalink( (int) $post_id );

		return is_string( $link ) && '' !== $link ? esc_url_raw( $link ) : '';
	}

	/**
	 * Get verified API userId from our local custom table.
	 *
	 * @return string
	 */
	private function get_verified_user_id_for_api() {
		global $wpdb;

		$table_name = $wpdb->prefix . 'wnaw_user';

		// Most recent verified row wins.
		$user_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT userId FROM {$table_name} WHERE otp_verified = %d ORDER BY updated_at DESC LIMIT 1",
				1
			)
		);

		return is_string( $user_id ) ? sanitize_text_field( $user_id ) : '';
	}

	/**
	 * Neutral pricing URL. Actionable plugin billing URLs come from the SaaS account response.
	 *
	 * @return string
	 */
	private function build_buy_credits_pricing_url() {
		return self::PRICING_URL;
	}

	/**
	 * Neutral trial checkout URL. Actionable plugin trial URLs come from the SaaS account response.
	 *
	 * @return string
	 */
	private function build_trial_checkout_url() {
		return self::SAAS_BASE_URL . self::TRIAL_CHECKOUT_PATH;
	}

	/**
	 * Normalize CTA/account data returned by the SaaS plugin-user endpoint.
	 *
	 * @param array<string,mixed> $data SaaS user response.
	 * @param float               $total Total available credits.
	 * @param string              $balance_type Selected balance bucket.
	 * @return array<string,mixed>
	 */
	private function normalize_account_state_payload( array $data, $total, $balance_type ) {
		$access = isset( $data['access'] ) && is_array( $data['access'] ) ? $data['access'] : array();
		$cta    = isset( $data['cta'] ) && is_array( $data['cta'] ) ? $data['cta'] : array();
		$user_plan = isset( $data['SubscriptionPlan'] ) && is_array( $data['SubscriptionPlan'] ) ? $data['SubscriptionPlan'] : array();
		$plan      = isset( $data['SubscriptionDetails'] ) && is_array( $data['SubscriptionDetails'] ) ? $data['SubscriptionDetails'] : array();

		$status = isset( $access['status'] ) ? sanitize_key( (string) $access['status'] ) : 'none';
		if ( 'none' === $status && isset( $user_plan['status'] ) ) {
			$status = sanitize_key( (string) $user_plan['status'] );
		}
		if ( '' === $status ) {
			$status = 'none';
		}

		$active_plan_name = isset( $access['activePlanName'] ) ? sanitize_text_field( (string) $access['activePlanName'] ) : '';
		if ( '' === $active_plan_name && ! empty( $plan['name'] ) ) {
			$active_plan_name = sanitize_text_field( (string) $plan['name'] );
		}

		$trial_eligible   = ! empty( $access['trialEligible'] );
		$has_access       = ! empty( $access['hasGenerationAccess'] );
		$trial_ends_at    = isset( $access['trialEndsAt'] ) && is_string( $access['trialEndsAt'] ) ? sanitize_text_field( $access['trialEndsAt'] ) : null;
		if ( null === $trial_ends_at && ! empty( $user_plan['trialEndsAt'] ) && is_string( $user_plan['trialEndsAt'] ) ) {
			$trial_ends_at = sanitize_text_field( $user_plan['trialEndsAt'] );
		}

		if ( empty( $access ) ) {
			$active_statuses = array( 'trialing', 'active' );
			if ( in_array( $status, $active_statuses, true ) ) {
				$has_access = true;
			}

			if ( 'trialing' === $status ) {
				$trial_eligible = false;
			}

			if ( 'none' === $status && empty( $user_plan ) && (float) $total <= 0 ) {
				$trial_eligible = true;
				$has_access     = false;
			}
		}

		$label = isset( $cta['label'] ) ? sanitize_text_field( (string) $cta['label'] ) : '';
		if ( '' === $label ) {
			if ( $trial_eligible ) {
				$label = __( 'Start Trial', 'whoneedsawriter' );
			} elseif ( 'trialing' === $status ) {
				$label = __( 'Trial', 'whoneedsawriter' );
			} elseif ( '' !== $active_plan_name ) {
				$label = $active_plan_name;
			} else {
				$label = __( 'Buy Credits', 'whoneedsawriter' );
			}
		}

		$kind = isset( $cta['kind'] ) ? sanitize_key( (string) $cta['kind'] ) : '';
		if ( ! in_array( $kind, array( 'loading', 'trial', 'plan', 'upgrade', 'credits', 'renew' ), true ) ) {
			$kind = $trial_eligible ? 'trial' : ( ( 'trialing' === $status || '' !== $active_plan_name ) ? 'plan' : 'credits' );
		}

		$coerce_saas_url = static function( $value ) {
			if ( ! is_string( $value ) ) {
				return '';
			}
			$incoming = trim( $value );
			if ( '' === $incoming ) {
				return '';
			}
			if ( 0 === strpos( $incoming, '/' ) && 0 !== strpos( $incoming, '//' ) ) {
				return esc_url_raw( Whoneedsawriter_Admin::SAAS_BASE_URL . $incoming );
			}
			if ( 0 === strpos( $incoming, 'https://whoneedsawriter.com/' ) || 0 === strpos( $incoming, 'http://whoneedsawriter.com/' ) ) {
				return esc_url_raw( $incoming );
			}
			return '';
		};

		$trial_url   = ! empty( $cta['trialUrl'] ) ? $coerce_saas_url( $cta['trialUrl'] ) : '';
		$pricing_url = ! empty( $cta['pricingUrl'] ) ? $coerce_saas_url( $cta['pricingUrl'] ) : '';
		$cta_url     = ! empty( $cta['url'] ) ? $coerce_saas_url( $cta['url'] ) : '';
		if ( '' === $cta_url ) {
			$cta_url = 'trial' === $kind ? $trial_url : $pricing_url;
		}

		$message = isset( $access['message'] ) && is_string( $access['message'] ) ? sanitize_text_field( $access['message'] ) : '';
		$disabled = ! empty( $cta['disabled'] ) || '' === $cta_url && ! in_array( $kind, array( 'plan' ), true );

		return array(
			'credits'       => $total,
			'balance_type'  => $balance_type,
			'creditsLoaded' => isset( $data['creditsLoaded'] ) ? (bool) $data['creditsLoaded'] : true,
			'access'        => array(
				'status'              => $status,
				'hasGenerationAccess' => $has_access,
				'trialEligible'       => $trial_eligible,
				'activePlanName'      => '' !== $active_plan_name ? $active_plan_name : null,
				'trialEndsAt'         => $trial_ends_at,
				'trialCreditsGranted' => isset( $access['trialCreditsGranted'] ) ? (float) $access['trialCreditsGranted'] : ( isset( $user_plan['trialCreditsGranted'] ) ? (float) $user_plan['trialCreditsGranted'] : 0 ),
				'trialCreditsUsed'    => isset( $access['trialCreditsUsed'] ) ? (float) $access['trialCreditsUsed'] : ( isset( $user_plan['trialCreditsUsed'] ) ? (float) $user_plan['trialCreditsUsed'] : 0 ),
				'message'             => $message,
			),
			'cta'           => array(
				'label'      => $label,
				'kind'       => $kind,
				'url'        => $cta_url,
				'trialUrl'   => $trial_url,
				'pricingUrl' => $pricing_url,
				'disabled'   => $disabled,
			),
		);
	}

	/**
	 * Ensure local plugin tables exist for already-active installs.
	 *
	 * @return void
	 */
	public function maybe_ensure_local_schema() {
		$this->ensure_local_schema( false );
	}

	/**
	 * Create or repair local plugin tables.
	 *
	 * @param bool $force True to run dbDelta even when schema version is current.
	 * @return void
	 */
	private function ensure_local_schema( $force = false ) {
		$installer = WHONEEDSAWRITER_PLUGIN_DIR . 'includes/class-whoneedsawriter-installer.php';

		if ( ! class_exists( 'Whoneedsawriter_Installer', false ) && is_readable( $installer ) ) {
			require_once $installer;
		}

		if ( ! class_exists( 'Whoneedsawriter_Installer', false ) ) {
			return;
		}

		if ( $force ) {
			Whoneedsawriter_Installer::ensure_schema();
			return;
		}

		Whoneedsawriter_Installer::maybe_ensure_schema();
	}

	/**
	 * SaaS signup email for the active verified linkage (DB column, then option fallback).
	 *
	 * @return string
	 */
	private function get_verified_connected_email() {
		$from_table = $this->fetch_verified_connected_email_from_table();

		if ( '' !== $from_table ) {
			return $from_table;
		}

		return (string) get_option( self::OPTION_CONNECTED_EMAIL, '' );
	}

	/**
	 * Read connected_email from the latest verified row in wp_wnaw_user.
	 *
	 * @return string Sanitized email or empty string.
	 */
	private function fetch_verified_connected_email_from_table() {
		global $wpdb;

		$table_name = $wpdb->prefix . 'wnaw_user';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is DB prefix + literal suffix.
		$raw = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT connected_email FROM {$table_name} WHERE otp_verified = %d ORDER BY updated_at DESC LIMIT 1",
				1
			)
		);

		if ( ! is_string( $raw ) ) {
			return '';
		}

		$raw = trim( $raw );

		if ( '' === $raw ) {
			return '';
		}

		$email = sanitize_email( $raw );

		return is_email( $email ) ? $email : '';
	}

	/**
	 * Render the shared trial modal used across plugin admin pages.
	 *
	 * @return void
	 */
	public function render_trial_modal() {
		if ( ! is_admin() || wp_doing_ajax() ) {
			return;
		}

		$page_raw = isset( $_GET['page'] ) ? wp_unslash( (string) $_GET['page'] ) : '';
		$page     = sanitize_key( $page_raw );
		$allowed  = array(
			$this->slug,
			$this->slug . '-dashboard',
			$this->slug . '-jobs',
			$this->slug . '-generate',
			$this->slug . '-settings',
		);

		if ( ! in_array( $page, $allowed, true ) ) {
			return;
		}

		$trial_url = $this->build_trial_checkout_url();
		?>
		<div
			class="whoneedsawriter__trial-modal"
			data-wnaw-trial-modal
			role="dialog"
			aria-modal="true"
			aria-labelledby="wnaw-trial-modal-title"
			aria-describedby="wnaw-trial-modal-desc"
			hidden
		>
			<div class="whoneedsawriter__trial-modal-backdrop" data-wnaw-trial-modal-dismiss></div>
			<div class="whoneedsawriter__trial-modal-card" role="document">
				<button
					type="button"
					class="whoneedsawriter__trial-modal-close"
					aria-label="<?php echo esc_attr__( 'Close', 'whoneedsawriter' ); ?>"
					data-wnaw-trial-modal-dismiss
				>
					<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
						<path d="M3 3l10 10M13 3 3 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
					</svg>
				</button>
				<div class="whoneedsawriter__trial-modal-iconwrap" aria-hidden="true">
					<span class="whoneedsawriter__trial-modal-icon">
						<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
							<path d="M12 3 14 9l6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" fill="currentColor"/>
						</svg>
					</span>
				</div>
				<h3 class="whoneedsawriter__trial-modal-title" id="wnaw-trial-modal-title" data-wnaw-trial-modal-title>
					<?php echo esc_html__( 'Start your 7-day trial', 'whoneedsawriter' ); ?>
				</h3>
				<div class="whoneedsawriter__trial-modal-body" id="wnaw-trial-modal-desc">
					<p data-wnaw-trial-modal-body><?php echo esc_html__( 'Activate your trial to generate articles from WordPress. Your trial includes 5 credits and can be cancelled before renewal.', 'whoneedsawriter' ); ?></p>
					<p class="whoneedsawriter__trial-modal-meta" data-wnaw-trial-modal-meta hidden></p>
				</div>
				<div class="whoneedsawriter__trial-modal-actions">
					<button type="button" class="whoneedsawriter__trial-modal-btn whoneedsawriter__trial-modal-btn--cancel" data-wnaw-trial-modal-dismiss>
						<?php echo esc_html__( 'Maybe later', 'whoneedsawriter' ); ?>
					</button>
					<a
						class="whoneedsawriter__trial-modal-btn whoneedsawriter__trial-modal-btn--start"
						role="button"
						aria-disabled="true"
						data-wnaw-trial-modal-start
					>
						<?php echo esc_html__( 'Start Trial', 'whoneedsawriter' ); ?>
					</a>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Render: Connect page.
	 *
	 * @return void
	 */
	public function render_connect_page() {
		require WHONEEDSAWRITER_PLUGIN_DIR . 'includes/admin/partials/page-connect.php';
	}

	/**
	 * Render: Dashboard page.
	 *
	 * @return void
	 */
	public function render_dashboard_page() {
		$jobs_url       = admin_url( 'admin.php?page=' . $this->slug . '-jobs' );
		$generate_url   = admin_url( 'admin.php?page=' . $this->slug . '-generate' );
		$settings_url   = admin_url( 'admin.php?page=' . $this->slug . '-settings' );

		// Credits load via AJAX only (avoid blocking HTTP during render — can cause timeouts/fatals).
		$dashboard_credits_display = '—';
		$wnaw_buy_credits_url      = $this->build_buy_credits_pricing_url();

		require WHONEEDSAWRITER_PLUGIN_DIR . 'includes/admin/partials/page-dashboard.php';
	}

	/**
	 * Render: Jobs list page.
	 *
	 * @return void
	 */
	public function render_jobs_page() {
		$job_id_raw = isset( $_GET['job_id'] ) ? wp_unslash( (string) $_GET['job_id'] ) : '';
		$view_raw   = isset( $_GET['view'] ) ? wp_unslash( (string) $_GET['view'] ) : '';
		$job_id     = sanitize_text_field( $job_id_raw );
		$view       = sanitize_key( $view_raw );

		$wnaw_jobs_list_url = add_query_arg( 'page', 'whoneedsawriter-jobs', admin_url( 'admin.php' ) );

		if ( 'articles' === $view ) {
			// phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
			$wnaw_jobs_list_url = $wnaw_jobs_list_url;
			require WHONEEDSAWRITER_PLUGIN_DIR . 'includes/admin/partials/page-articles.php';
			return;
		}

		if ( '' !== $job_id ) {
			$wnaw_job_id = $job_id; // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
			$wnaw_job_display_name = '';
			if ( class_exists( 'Whoneedsawriter_Repository' ) ) {
				$batch_row = Whoneedsawriter_Repository::get_batch( $job_id );
				if ( is_array( $batch_row ) ) {
					$wnaw_job_display_name = Whoneedsawriter_Repository::resolve_batch_display_name( $batch_row );
				}
			}
			// phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
			$wnaw_jobs_list_url = $wnaw_jobs_list_url;
			require WHONEEDSAWRITER_PLUGIN_DIR . 'includes/admin/partials/page-job-detail.php';
			return;
		}

		require WHONEEDSAWRITER_PLUGIN_DIR . 'includes/admin/partials/page-jobs.php';
	}

	/**
	 * Render: Generate Article page.
	 *
	 * @return void
	 */
	public function render_generate_page() {
		$wnaw_buy_credits_url = $this->build_buy_credits_pricing_url();

		require WHONEEDSAWRITER_PLUGIN_DIR . 'includes/admin/partials/page-generate.php';
	}

	/**
	 * Render: Settings.
	 *
	 * @return void
	 */
	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'whoneedsawriter' ) );
		}

		$wnaw_sets            = self::merge_plugin_settings();
		$wnaw_connected_email = $this->get_verified_connected_email();
		$wnaw_site_id         = $this->get_verified_user_id_for_api();

		$wnaw_categories = get_categories(
			array(
				'hide_empty' => false,
				'orderby'    => 'name',
				'order'      => 'ASC',
			)
		);

		$wnaw_users = get_users(
			array(
				'role__in' => array( 'administrator', 'editor', 'author' ),
				'orderby'  => 'display_name',
				'order'    => 'ASC',
				'fields'   => array( 'ID', 'display_name', 'user_login' ),
			)
		);

		$wnaw_settings_form_action = admin_url( 'admin-post.php' );
		$wnaw_buy_credits_url      = $this->build_buy_credits_pricing_url();

		require WHONEEDSAWRITER_PLUGIN_DIR . 'includes/admin/partials/page-settings.php';
	}
}
