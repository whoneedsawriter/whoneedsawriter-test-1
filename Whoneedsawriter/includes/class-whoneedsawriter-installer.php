<?php
/**
 * Plugin install/upgrade routines.
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Whoneedsawriter_Installer {
	/**
	 * Create/upgrade database tables.
	 *
	 * @return void
	 */
	public static function activate() {
		self::ensure_site_secret();
		self::create_tables();
		self::set_saas_bridge_options();
		self::mark_schema_current();
		update_option( 'whoneedsawriter_activation_redirect', '1' );
	}

	/**
	 * Ensure DB schema is current (creates/alters tables via dbDelta).
	 *
	 * @return void
	 */
	public static function ensure_schema() {
		self::ensure_site_secret();
		self::create_tables();
		self::set_saas_bridge_options();
		self::mark_schema_current();
	}

	/**
	 * Ensure this WordPress install has a private billing/site secret.
	 *
	 * @return string
	 */
	public static function ensure_site_secret() {
		$existing = get_option( 'whoneedsawriter_site_secret', '' );
		if ( is_string( $existing ) && strlen( trim( $existing ) ) >= 32 ) {
			return trim( $existing );
		}

		try {
			$secret = bin2hex( random_bytes( 32 ) );
		} catch ( Exception $e ) {
			$secret = wp_generate_password( 64, true, true );
		}

		update_option( 'whoneedsawriter_site_secret', $secret, false );
		return $secret;
	}

	/**
	 * Repair schema once per plugin version if activation did not create tables.
	 *
	 * @return void
	 */
	public static function maybe_ensure_schema() {
		$schema_version = get_option( 'whoneedsawriter_schema_version', '' );

		if ( WHONEEDSAWRITER_VERSION === $schema_version ) {
			return;
		}

		self::ensure_schema();
	}

	/**
	 * Values used by SaaS → WordPress publish endpoint (REST).
	 *
	 * @return void
	 */
	private static function set_saas_bridge_options() {
		update_option( 'whoneedsawriter_saas_plugin_version', WHONEEDSAWRITER_VERSION );
	}

	/**
	 * Store the schema version after dbDelta has run.
	 *
	 * @return void
	 */
	private static function mark_schema_current() {
		update_option( 'whoneedsawriter_schema_version', WHONEEDSAWRITER_VERSION );
	}

	/**
	 * Create required tables.
	 *
	 * @return void
	 */
	private static function create_tables() {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table_name      = $wpdb->prefix . 'wnaw_user';
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table_name} (
			id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			userId TEXT NOT NULL,
			connected_email VARCHAR(255) NOT NULL DEFAULT '',
			otp_verified TINYINT(1) NOT NULL DEFAULT 0,
			google_login TINYINT(1) NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id)
		) {$charset_collate};";

		dbDelta( $sql );

		$batches_table = $wpdb->prefix . 'wnaw_batches';
		$articles_table = $wpdb->prefix . 'wnaw_articles';
		$stats_table    = $wpdb->prefix . 'wnaw_dashboard_stats';

		$sql_batches = "CREATE TABLE {$batches_table} (
			id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			batch_id VARCHAR(64) NOT NULL,
			saas_user_id VARCHAR(191) NOT NULL DEFAULT '',
			batch_name VARCHAR(255) NOT NULL DEFAULT '',
			status_int TINYINT(2) NOT NULL DEFAULT 0,
			status_key VARCHAR(32) NOT NULL DEFAULT 'generating',
			status_label VARCHAR(64) NOT NULL DEFAULT '',
			articles_total INT(11) NOT NULL DEFAULT 0,
			articles_completed INT(11) NOT NULL DEFAULT 0,
			articles_pending INT(11) NOT NULL DEFAULT 0,
			failed_articles INT(11) NOT NULL DEFAULT 0,
			saas_created_at VARCHAR(32) NOT NULL DEFAULT '',
			settings_json LONGTEXT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY batch_id (batch_id),
			KEY saas_user_id (saas_user_id)
		) {$charset_collate};";

		$sql_articles = "CREATE TABLE {$articles_table} (
			id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			batch_id VARCHAR(64) NOT NULL,
			row_index INT(11) NOT NULL DEFAULT 0,
			keyword VARCHAR(500) NOT NULL DEFAULT '',
			title VARCHAR(500) NOT NULL DEFAULT '',
			status_int TINYINT(2) NOT NULL DEFAULT 0,
			status_key VARCHAR(32) NOT NULL DEFAULT 'generating',
			status_label VARCHAR(64) NOT NULL DEFAULT '',
			wp_post_id BIGINT(20) UNSIGNED NOT NULL DEFAULT 0,
			wp_post_status VARCHAR(20) NOT NULL DEFAULT '',
			scheduled_time VARCHAR(64) NOT NULL DEFAULT '',
			is_removed TINYINT(1) NOT NULL DEFAULT 0,
			model VARCHAR(64) NOT NULL DEFAULT '',
			category VARCHAR(255) NOT NULL DEFAULT '',
			author VARCHAR(255) NOT NULL DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY batch_id (batch_id),
			KEY wp_post_id (wp_post_id),
			KEY batch_row (batch_id, row_index)
		) {$charset_collate};";

		$sql_stats = "CREATE TABLE {$stats_table} (
			id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			saas_user_id VARCHAR(191) NOT NULL,
			articles_generated INT(11) NOT NULL DEFAULT 0,
			articles_published INT(11) NOT NULL DEFAULT 0,
			active_jobs INT(11) NOT NULL DEFAULT 0,
			failed_articles INT(11) NOT NULL DEFAULT 0,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY saas_user_id (saas_user_id)
		) {$charset_collate};";

		dbDelta( $sql_batches );
		dbDelta( $sql_articles );
		dbDelta( $sql_stats );

		self::maybe_backfill_connected_email();
	}

	/**
	 * If the canonical email option exists but verified rows lack connected_email (post-migration).
	 *
	 * @return void
	 */
	private static function maybe_backfill_connected_email() {
		global $wpdb;

		$opt = get_option( 'whoneedsawriter_connected_email', '' );

		if ( ! is_string( $opt ) || '' === trim( $opt ) ) {
			return;
		}

		$email = sanitize_email( $opt );

		if ( ! is_email( $email ) ) {
			return;
		}

		$table = $wpdb->prefix . 'wnaw_user';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is DB prefix + literal suffix.
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table} SET connected_email = %s WHERE otp_verified = %d AND connected_email = %s",
				$email,
				1,
				''
			)
		);
	}
}
