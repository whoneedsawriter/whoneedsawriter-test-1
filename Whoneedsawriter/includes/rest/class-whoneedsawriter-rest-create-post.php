<?php
/**
 * REST API for SaaS → WordPress post creation (legacy path: /wp-json/apf/v1/create-post).
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles incoming publish requests from Whoneedsawriter SaaS.
 */
final class Whoneedsawriter_REST_Create_Post {

	const META_FLAG = '_wnaw_saas_post';

	const ROUTE_NS   = 'apf/v1';
	const ROUTE_PATH = '/create-post';

	const OPTION_SAAS_PLUGIN_VERSION       = 'whoneedsawriter_saas_plugin_version';
	const LEGACY_OPTION_AP_PLUGIN_VERSION = 'apf_plugin_version';

	/**
	 * Hook into WordPress.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * REST routes registration.
	 *
	 * @return void
	 */
	public static function register_routes() {
		register_rest_route(
			self::ROUTE_NS,
			self::ROUTE_PATH,
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'handle_create_post' ),
				'permission_callback' => array( __CLASS__, 'verify_request' ),
			)
		);
	}

	/**
	 * Optional hardening when WHONEEDSAWRITER_PUBLISH_REST_SECRET or the option publish_rest_secret is set.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return bool|WP_Error
	 */
	public static function verify_request( $request ) {
		$key = '';

		if ( defined( 'WHONEEDSAWRITER_PUBLISH_REST_SECRET' ) && WHONEEDSAWRITER_PUBLISH_REST_SECRET !== '' ) {
			$key = (string) WHONEEDSAWRITER_PUBLISH_REST_SECRET;
		} elseif ( '' !== (string) get_option( 'whoneedsawriter_publish_rest_secret', '' ) ) {
			$key = (string) get_option( 'whoneedsawriter_publish_rest_secret', '' );
		}

		if ( '' === $key ) {
			return apply_filters( 'whoneedsawriter_publish_rest_allow_unauthenticated', true, $request );
		}

		$provided = '';
		if ( $request instanceof WP_REST_Request ) {
			$auth = (string) $request->get_header( 'authorization' );
			if ( preg_match( '/Bearer\s+(.*)$/i', $auth, $m ) ) {
				$provided = trim( $m[1] );
			}
			if ( '' === $provided ) {
				$provided = (string) $request->get_header( 'x-whoneedsawriter-secret' );
			}
		}

		if ( ! hash_equals( $key, $provided ) ) {
			return new WP_Error(
				'invalid_publish_secret',
				__( 'Invalid publish credentials.', 'whoneedsawriter' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}

	/**
	 * SaaS-compatible version check option (mirrors legacy apf_plugin_version).
	 *
	 * @return string
	 */
	private static function get_expected_plugin_version_token() {
		$stored = get_option( self::OPTION_SAAS_PLUGIN_VERSION, '' );

		if ( '' === $stored || false === $stored ) {
			$legacy = get_option( self::LEGACY_OPTION_AP_PLUGIN_VERSION, '' );
			if ( is_string( $legacy ) && $legacy !== '' ) {
				return (string) $legacy;
			}
			return (string) WHONEEDSAWRITER_VERSION;
		}

		return (string) $stored;
	}

	/**
	 * Core handler.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function handle_create_post( WP_REST_Request $request ) {
		$post_data = $request->get_json_params();
		if ( ! is_array( $post_data ) ) {
			$post_data = array();
		}

		/** This filter is documented in wp-includes/rest-api/class-wp-rest-request.php */
		$post_data = apply_filters( 'whoneedsawriter_publish_rest_payload', $post_data, $request );

		/*
		 * plugin_version — SaaS may always include this in JSON. While testing / by default we do not validate it:
		 * the field is harmless and stays in $post_data unless you strip it elsewhere. To enforce parity with
		 * the installed plugin again, use: add_filter( 'whoneedsawriter_publish_rest_enforce_plugin_version', '__return_true' );
		 */
		/**
		 * When true, rejects requests whose plugin_version JSON field does not match the installed plugin token.
		 * Default false so SaaS can send plugin_version without the site rejecting requests during rollout.
		 *
		 * @param bool                 $enforce    Whether to enforce.
		 * @param array<string,mixed> $post_data Incoming payload after filter above.
		 * @param WP_REST_Request     $request   Request.
		 */
		if ( apply_filters( 'whoneedsawriter_publish_rest_enforce_plugin_version', false, $post_data, $request ) ) {
			$expected_version = self::get_expected_plugin_version_token();
			$posted_version   = isset( $post_data['plugin_version'] ) ? (string) $post_data['plugin_version'] : '';

			if ( $posted_version !== $expected_version ) {
				self::dbg( 'publish rest: plugin_version mismatch expected=' . $expected_version . ' got=' . $posted_version );

				return new WP_Error(
					'plugin_version_outdated',
					__( 'Plugin version is outdated or mismatch.', 'whoneedsawriter' ),
					array( 'status' => 422 )
				);
			}
		}

		if ( empty( $post_data['title'] ) || empty( $post_data['content'] ) ) {
			self::dbg( 'publish rest: missing title/content' );

			return new WP_Error(
				'invalid_data',
				__( 'Missing or invalid post title or content.', 'whoneedsawriter' ),
				array( 'status' => 422 )
			);
		}

		$processed_content = self::process_content_images( $post_data['content'] );

		$category_name_raw = isset( $post_data['category'] ) ? $post_data['category'] : '';
		$category_name     = sanitize_text_field( (string) $category_name_raw );
		if ( '' === $category_name ) {
			self::dbg( 'publish rest: missing category after sanitize' );

			return new WP_Error(
				'invalid_data',
				__( 'Missing or invalid category.', 'whoneedsawriter' ),
				array( 'status' => 422 )
			);
		}

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.custom_url_get_cat_ID_get_cat_ID
		$category_id = absint( get_cat_ID( $category_name ) );
		if ( 0 === $category_id ) {
			$term = wp_insert_term( $category_name, 'category' );
			if ( is_wp_error( $term ) ) {
				self::dbg( 'publish rest: wp_insert_term failed ' . $term->get_error_message() );

				return new WP_Error(
					'category_creation_failed',
					__( 'Failed to create category.', 'whoneedsawriter' ),
					array( 'status' => 500 )
				);
			}
			$category_id = isset( $term['term_id'] ) ? absint( $term['term_id'] ) : 0;
		}

		$plain_title = wp_strip_all_tags( (string) $post_data['title'] );

		$batch_id_preflight = self::extract_batch_id_from_payload( $post_data );
		$keyword_preflight  = self::extract_keyword_from_payload( $post_data );
		$row_index_preflight = class_exists( 'Whoneedsawriter_Admin' )
			? Whoneedsawriter_Admin::extract_article_row_index_from_payload( $post_data )
			: -1;

		$existing_post_id = self::find_existing_publish_post( $plain_title, $keyword_preflight, $batch_id_preflight );
		if ( $existing_post_id > 0 ) {
			return self::respond_existing_publish_post(
				$existing_post_id,
				$plain_title,
				$batch_id_preflight,
				$keyword_preflight,
				$row_index_preflight
			);
		}

		if ( empty( $post_data['status'] ) && ! empty( $post_data['saveOption'] ) ) {
			$save_map = array(
				'draft'   => 'draft',
				'publish' => 'publish',
				'future'  => 'future',
			);
			$save_key = sanitize_key( (string) $post_data['saveOption'] );
			if ( isset( $save_map[ $save_key ] ) ) {
				$post_data['status'] = $save_map[ $save_key ];
			}
		}

		$post_status      = isset( $post_data['status'] ) ? sanitize_text_field( (string) $post_data['status'] ) : 'draft';
		$allowed_statuses = array( 'draft', 'publish', 'future', 'pending', 'private' );
		if ( ! in_array( $post_status, $allowed_statuses, true ) ) {
			$post_status = 'draft';
		}

		// Auto-promote to 'future' when a schedule anchor is present but status
		// wasn't explicitly set to 'future' (SaaS cron payloads typically omit it).
		if ( 'future' !== $post_status ) {
			$has_schedule_anchor = '' !== self::extract_published_start_datetime_from_payload( $post_data );
			$has_schedule_time   = isset( $post_data['schedule_time'] ) && '' !== trim( (string) $post_data['schedule_time'] );
			if ( $has_schedule_anchor || $has_schedule_time ) {
				$post_status = 'future';
			}
		}

		$post_date     = null;
		$post_date_gmt = null;

		if ( 'future' === $post_status ) {
			try {
				$tz = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
			} catch ( Exception $e ) {
				self::dbg( 'publish rest timezone fallback UTC — ' . $e->getMessage() );
				$tz = new DateTimeZone( 'UTC' );
			}

			try {
				$dt = self::resolve_scheduled_publish_datetime( $post_data, $tz );

				if ( ! $dt instanceof DateTime ) {
					self::dbg(
						'publish rest: schedule resolve returned null; payload keys published_start_date_time='
						. self::dbg_scalar( isset( $post_data['published_start_date_time'] ) ? $post_data['published_start_date_time'] : null )
						. ' schedule_time='
						. self::dbg_scalar( isset( $post_data['schedule_time'] ) ? $post_data['schedule_time'] : null ),
						true
					);

					return new WP_Error(
						'schedule_invalid',
						__( 'Could not calculate scheduled publish time.', 'whoneedsawriter' ),
						array( 'status' => 422 )
					);
				}

				$post_date = $dt->format( 'Y-m-d H:i:s' );

				$utc = clone $dt;
				$utc->setTimezone( new DateTimeZone( 'UTC' ) );
				$post_date_gmt = $utc->format( 'Y-m-d H:i:s' );

			} catch ( Exception $t ) {
				$published_start_debug = isset( $post_data['published_start_date_time'] ) ? $post_data['published_start_date_time'] : null;
				if ( null === $published_start_debug && isset( $post_data['publishedStartDateTime'] ) ) {
					$published_start_debug = $post_data['publishedStartDateTime'];
				}
				self::dbg(
					'publish rest: scheduling failed — '
					. $t->getMessage()
					. ' published_start='
					. self::dbg_scalar( $published_start_debug )
					. ' schedule_time='
					. self::dbg_scalar( isset( $post_data['schedule_time'] ) ? $post_data['schedule_time'] : null ),
					true
				);

				return new WP_Error(
					'schedule_invalid',
					__( 'Could not calculate scheduled publish time.', 'whoneedsawriter' ),
					array(
						'status'  => 422,
						'details' => $t->getMessage(),
					)
				);
			}
		}

		$post_author = get_current_user_id();
		if ( isset( $post_data['author'] ) && '' !== (string) $post_data['author'] ) {
			$candidate_author = absint( $post_data['author'] );
			if ( $candidate_author && get_userdata( $candidate_author ) ) {
				$post_author = $candidate_author;
			}
		}

		$new_post = array(
			'post_title'    => $plain_title,
			'post_content'  => $processed_content,
			'post_status'   => $post_status,
			'post_author'   => $post_author,
			'post_category' => array( $category_id ),
		);

		if ( null !== $post_date && null !== $post_date_gmt ) {
			$new_post['post_date']     = $post_date;
			$new_post['post_date_gmt'] = $post_date_gmt;
		}

		$lock_key = self::build_publish_lock_key( $keyword_preflight, $plain_title );

		$wait_post_id = self::wait_for_publish_lock_or_existing(
			$lock_key,
			$plain_title,
			$keyword_preflight,
			$batch_id_preflight
		);
		if ( $wait_post_id > 0 ) {
			return self::respond_existing_publish_post(
				$wait_post_id,
				$plain_title,
				$batch_id_preflight,
				$keyword_preflight,
				$row_index_preflight
			);
		}

		if ( ! self::acquire_publish_lock( $lock_key ) ) {
			$wait_post_id = self::wait_for_publish_lock_or_existing(
				$lock_key,
				$plain_title,
				$keyword_preflight,
				$batch_id_preflight
			);
			if ( $wait_post_id > 0 ) {
				return self::respond_existing_publish_post(
					$wait_post_id,
					$plain_title,
					$batch_id_preflight,
					$keyword_preflight,
					$row_index_preflight
				);
			}

			$existing_post_id = self::find_existing_publish_post( $plain_title, $keyword_preflight, $batch_id_preflight );
			if ( $existing_post_id > 0 ) {
				return self::respond_existing_publish_post(
					$existing_post_id,
					$plain_title,
					$batch_id_preflight,
					$keyword_preflight,
					$row_index_preflight
				);
			}

			delete_transient( $lock_key );

			return new WP_Error(
				'publish_in_progress',
				__( 'Another publish request for this article is in progress. Retry shortly.', 'whoneedsawriter' ),
				array( 'status' => 409 )
			);
		}

		$existing_post_id = self::find_existing_publish_post( $plain_title, $keyword_preflight, $batch_id_preflight );
		if ( $existing_post_id > 0 ) {
			self::release_publish_lock( $lock_key, $existing_post_id );

			return self::respond_existing_publish_post(
				$existing_post_id,
				$plain_title,
				$batch_id_preflight,
				$keyword_preflight,
				$row_index_preflight
			);
		}

		$post_id = wp_insert_post( wp_slash( $new_post ), true );

		if ( is_wp_error( $post_id ) || ! $post_id ) {
			delete_transient( $lock_key );
			self::dbg( 'publish rest: wp_insert_post failed' );

			return new WP_Error(
				'post_creation_failed',
				__( 'Failed to create post.', 'whoneedsawriter' ),
				array( 'status' => 500 )
			);
		}

		self::release_publish_lock( $lock_key, (int) $post_id );

		update_post_meta( (int) $post_id, self::META_FLAG, true );

		$batch_id  = $batch_id_preflight;
		$keyword   = $keyword_preflight;
		$row_index = $row_index_preflight;

		if ( '' !== $batch_id ) {
			update_post_meta( (int) $post_id, '_wnaw_batch_id', sanitize_text_field( $batch_id ) );
		}
		if ( '' !== $keyword ) {
			update_post_meta( (int) $post_id, '_wnaw_keyword', sanitize_text_field( $keyword ) );
		}

		$scheduled_label = '';
		if ( 'future' === $post_status && null !== $post_date ) {
			$scheduled_label = (string) $post_date;
		}

		if ( class_exists( 'Whoneedsawriter_Repository' ) ) {
			if ( '' === $keyword ) {
				self::dbg(
					'publish rest: missing keyword in payload; cannot update plugin article row for post_id='
					. (string) $post_id
					. ' title='
					. $plain_title,
					true
				);
			}

			$synced = Whoneedsawriter_Repository::mark_article_published_in_wp(
				$batch_id,
				$keyword,
				$plain_title,
				(int) $post_id,
				$post_status,
				$scheduled_label,
				$row_index
			);
			if ( ! $synced ) {
				self::dbg(
					'publish rest: post created but article row not matched post_id='
					. (string) $post_id
					. ' batch='
					. $batch_id
					. ' keyword='
					. $keyword
					. ' title='
					. $plain_title
					. ' row='
					. (string) $row_index,
					true
				);
			}
		}

		if ( ! empty( $post_data['add_meta_content'] )
			&& ( ! empty( $post_data['meta_title'] ) || ! empty( $post_data['meta_description'] ) ) ) {
			self::set_seo_meta(
				(int) $post_id,
				isset( $post_data['meta_title'] ) ? (string) $post_data['meta_title'] : '',
				isset( $post_data['meta_description'] ) ? (string) $post_data['meta_description'] : ''
			);
		}

		if ( ! empty( $post_data['add_featured_image'] ) && ! empty( $post_data['image_url'] ) ) {
			$image_url = esc_url_raw( (string) $post_data['image_url'] );
			$img_res   = self::set_featured_image( $image_url, (int) $post_id );
			if ( is_wp_error( $img_res ) ) {
				self::dbg( 'publish rest: featured image failed ' . $img_res->get_error_message() );
			}
		}

		$response_data = array(
			'post_id' => (int) $post_id,
			'status'  => $post_status,
			'message' => ( 'future' === $post_status )
				? __( 'Post scheduled successfully', 'whoneedsawriter' )
				: __( 'Post created successfully', 'whoneedsawriter' ),
		);

		return new WP_REST_Response( $response_data, 201 );
	}

	/**
	 * Read publishedStartDateTime from SaaS publish payload (camelCase or snake_case).
	 *
	 * @param array<string,mixed> $post_data Request JSON.
	 * @return string
	 */
	private static function extract_published_start_datetime_from_payload( array $post_data ) {
		$keys = array(
			'publishedStartDateTime',
			'published_start_datetime',
			'published_start_date_time',
		);

		foreach ( $keys as $key ) {
			if ( ! array_key_exists( $key, $post_data ) || null === $post_data[ $key ] || '' === $post_data[ $key ] ) {
				continue;
			}

			$val = $post_data[ $key ];
			if ( is_numeric( $val ) ) {
				return (string) (int) $val;
			}

			if ( is_string( $val ) ) {
				$trimmed = trim( $val );
				if ( '' !== $trimmed ) {
					return $trimmed;
				}
			}
		}

		return '';
	}

	/**
	 * Allowed relative offset from SaaS cron (e.g. "+7 days", "+24 hours").
	 *
	 * @param array<string,mixed> $post_data Request JSON.
	 * @return string modify() expression or empty.
	 */
	private static function extract_relative_schedule_modify_expr( array $post_data ) {
		foreach ( array( 'schedule_time', 'scheduleTime' ) as $key ) {
			if ( ! isset( $post_data[ $key ] ) || ( ! is_string( $post_data[ $key ] ) && ! is_numeric( $post_data[ $key ] ) ) ) {
				continue;
			}

			$candidate = trim( (string) $post_data[ $key ] );
			if ( '' === $candidate ) {
				continue;
			}

			if ( preg_match( '/^\+(\d+)\s+(minutes?|minute|hours?|hour|days?|day|months?|month|years?|year)s?$/i', $candidate, $matches ) ) {
				$expr = strtolower( $matches[0] );
				// "+0 hours" is a no-op; skip modify() (some PHP builds treat it oddly).
				if ( preg_match( '/^\+0\s+(minute|minutes|hour|hours|day|days|month|months|year|years)s?$/i', $expr ) ) {
					return '';
				}

				return $expr;
			}
			if ( preg_match( '/^next\s+(weekday|week|month|year)$/i', $candidate ) ) {
				return $candidate;
			}
		}

		return '';
	}

	/**
	 * Batch cadence key (one_post_per_day|weekly|monthly), not a relative "+N days" string.
	 *
	 * @param array<string,mixed> $post_data Request JSON.
	 * @return string
	 */
	private static function extract_batch_schedule_frequency( array $post_data ) {
		foreach ( array( 'scheduleTime', 'schedule_time', 'batchScheduleTime', 'batch_schedule_time' ) as $key ) {
			if ( empty( $post_data[ $key ] ) ) {
				continue;
			}

			$raw = trim( (string) $post_data[ $key ] );
			if ( Whoneedsawriter_Admin::is_saas_batch_schedule_frequency( $raw ) ) {
				return sanitize_key( $raw );
			}
		}

		return '';
	}

	/**
	 * Apply a vetted DateTime::modify() expression (Windows-safe).
	 *
	 * @param DateTime $dt       Mutable datetime.
	 * @param string   $mod_expr Allowed modify expression.
	 * @return DateTime
	 */
	private static function apply_datetime_modify( DateTime $dt, $mod_expr ) {
		$mod_expr = trim( (string) $mod_expr );
		if ( '' === $mod_expr ) {
			return $dt;
		}

		$is_windows = defined( 'PHP_OS_FAMILY' ) && 'Windows' === PHP_OS_FAMILY;

		try {
			if ( ! $is_windows ) {
				$dt->modify( $mod_expr );

				return $dt;
			}

			$ts_local = strtotime( $mod_expr, $dt->getTimestamp() );
			if ( false !== $ts_local ) {
				$dt->setTimestamp( $ts_local );
			}
		} catch ( Exception $t ) {
			self::dbg( 'apply_datetime_modify failed for "' . $mod_expr . '": ' . $t->getMessage() );
		}

		return $dt;
	}

	/**
	 * Resolve WordPress local post_date for status=future.
	 *
	 * Supports:
	 * - Anchor + batch cadence + articleIndex (Generate / plugin).
	 * - Anchor + relative offset (+0 hours, +7 days) from SaaS publish-plugin cron.
	 * - Anchor only.
	 * - now() + relative offset when no anchor.
	 *
	 * @param array<string,mixed> $post_data Request JSON.
	 * @param DateTimeZone        $tz        Site timezone.
	 * @return DateTime|null
	 */
	private static function resolve_scheduled_publish_datetime( array $post_data, DateTimeZone $tz ) {
		$base_raw     = self::extract_published_start_datetime_from_payload( $post_data );
		$batch_freq   = self::extract_batch_schedule_frequency( $post_data );
		$relative_mod = self::extract_relative_schedule_modify_expr( $post_data );
		$slot_index   = Whoneedsawriter_Admin::extract_schedule_slot_index_from_data( $post_data );

		$anchor_dt = null;
		if ( '' !== $base_raw ) {
			$anchor_dt = self::parse_scheduled_publish_datetime( $base_raw, $tz );
		}

		if ( $anchor_dt instanceof DateTime && '' !== $batch_freq ) {
			$slot_mysql = Whoneedsawriter_Admin::compute_saas_scheduled_slot_datetime_mysql(
				$base_raw,
				$batch_freq,
				$slot_index
			);
			if ( '' !== $slot_mysql ) {
				$slot_dt = self::parse_scheduled_publish_datetime( $slot_mysql, $tz );
				if ( $slot_dt instanceof DateTime ) {
					return $slot_dt;
				}
			}
		}

		if ( $anchor_dt instanceof DateTime && '' !== $relative_mod ) {
			try {
				$dt = clone $anchor_dt;
				self::apply_datetime_modify( $dt, $relative_mod );

				return $dt;
			} catch ( Exception $e ) {
				self::dbg( 'resolve schedule anchor+relative failed: ' . $e->getMessage() );
			}
		}

		if ( $anchor_dt instanceof DateTime ) {
			return $anchor_dt;
		}

		return self::fallback_scheduled_publish_datetime( $tz, $relative_mod, $base_raw );
	}

	/**
	 * Last-resort schedule: now (+ optional offset), always returns a DateTime.
	 *
	 * @param DateTimeZone $tz           Site timezone.
	 * @param string       $relative_mod Relative modify expression or empty.
	 * @param string       $base_raw     Raw anchor for logging.
	 * @return DateTime
	 */
	private static function fallback_scheduled_publish_datetime( DateTimeZone $tz, $relative_mod, $base_raw ) {
		$mod_expr = '' !== $relative_mod ? $relative_mod : '+4 hours';

		try {
			$dt = new DateTime( 'now', $tz );
		} catch ( Exception $e ) {
			self::dbg( 'fallback schedule: invalid site timezone, using UTC — ' . $e->getMessage() );
			$dt = new DateTime( 'now', new DateTimeZone( 'UTC' ) );
		}

		self::apply_datetime_modify( $dt, $mod_expr );

		if ( '' !== trim( (string) $base_raw ) ) {
			self::dbg(
				'resolve schedule: could not parse anchor "' . $base_raw . '"; used fallback ' . $dt->format( 'Y-m-d H:i:s' )
			);
		}

		return $dt;
	}

	/**
	 * Parse SaaS / Prisma schedule anchor (MySQL, ISO-8601, or unix timestamp).
	 *
	 * Prisma `timestamp` → ISO UTC in cron (`toISOString()`), or unix seconds/ms as JSON number.
	 * MySQL display `2026-05-25 03:30:00` is site-local wall time when sent without offset.
	 *
	 * @param string       $raw Raw datetime from SaaS.
	 * @param DateTimeZone $tz  WordPress site timezone for local wall times.
	 * @return DateTime|null
	 */
	private static function parse_scheduled_publish_datetime( $raw, DateTimeZone $tz ) {
		$raw = trim( (string) $raw );
		if ( '' === $raw ) {
			return null;
		}

		// Unix timestamp (Prisma / JSON number as string: seconds or milliseconds).
		if ( preg_match( '/^\d{10,13}$/', $raw ) ) {
			$ts = (int) $raw;
			if ( strlen( $raw ) > 10 ) {
				$ts = (int) floor( $ts / 1000 );
			}

			try {
				$dt = new DateTime( '@' . $ts );
				$dt->setTimezone( $tz );

				return $dt;
			} catch ( Exception $e ) {
				self::dbg( 'parse_scheduled_publish_datetime unix failed: ' . $e->getMessage() );
			}
		}

		// ISO-8601 with timezone (Prisma toISOString(): …Z or …+05:30).
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}T/', $raw ) ) {
			try {
				$dt = new DateTime( $raw );
				$dt->setTimezone( $tz );

				return $dt;
			} catch ( Exception $e ) {
				self::dbg( 'parse_scheduled_publish_datetime ISO failed: ' . $e->getMessage() . ' raw=' . $raw );
			}
		}

		// MySQL-style local datetime (batch table display / plugin form).
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/', $raw ) ) {
			$normalized = str_replace( 'T', ' ', $raw );
			if ( preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $normalized ) ) {
				$normalized .= ':00';
			}
			$dt = DateTime::createFromFormat( 'Y-m-d H:i:s', substr( $normalized, 0, 19 ), $tz );
			if ( $dt instanceof DateTime ) {
				return $dt;
			}
		}

		try {
			$dt = new DateTime( $raw, $tz );

			return $dt;
		} catch ( Exception $e ) {
			self::dbg( 'parse_scheduled_publish_datetime failed: ' . $e->getMessage() . ' raw=' . $raw );

			return null;
		}
	}

	/**
	 * Safe scalar for debug logs.
	 *
	 * @param mixed $value Value.
	 * @return string
	 */
	private static function dbg_scalar( $value ) {
		if ( null === $value ) {
			return 'null';
		}
		if ( is_bool( $value ) ) {
			return $value ? 'true' : 'false';
		}
		if ( is_scalar( $value ) ) {
			return (string) $value;
		}

		return gettype( $value );
	}

	/**
	 * Lightweight debug logger.
	 *
	 * @param string $message Message.
	 * @return void
	 */
	private static function dbg( $message, $force = false ) {
		if ( $force ) {
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( '[whoneedsawriter publish] ' . $message );

			return;
		}

		$plugin_debug = false;
		$opts         = get_option( 'whoneedsawriter_settings', array() );
		if ( is_array( $opts ) && ! empty( $opts['debug_mode'] ) ) {
			$plugin_debug = true;
		}
		if ( ! $plugin_debug && ! ( defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) ) {
			return;
		}
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( '[whoneedsawriter publish] ' . $message );
	}

	/**
	 * Remove a file from uploads (prefers core helper when present).
	 *
	 * @param string $path Absolute filesystem path.
	 * @return void
	 */
	private static function delete_local_file( $path ) {
		if ( ! is_string( $path ) || '' === $path ) {
			return;
		}
		if ( function_exists( 'wp_delete_file' ) ) {
			wp_delete_file( $path );

			return;
		}
		if ( file_exists( $path ) ) {
			// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.unlink_unlink
			@unlink( $path );
		}
	}

	/**
	 * Resolve an existing WP post for this publish request (idempotent retries).
	 *
	 * @param string $plain_title Plain post title.
	 * @param string $keyword     Article keyword.
	 * @param string $batch_id    Optional batch id.
	 * @return int
	 */
	private static function find_existing_publish_post( $plain_title, $keyword, $batch_id ) {
		$plain_title = wp_strip_all_tags( (string) $plain_title );
		$keyword     = sanitize_text_field( (string) $keyword );
		$batch_id    = sanitize_text_field( (string) $batch_id );

		if ( class_exists( 'Whoneedsawriter_Repository' ) && '' !== trim( $keyword ) ) {
			$linked = Whoneedsawriter_Repository::find_linked_wp_post_id_by_keyword( $keyword, $batch_id );
			if ( $linked > 0 ) {
				return $linked;
			}
		}

		if ( '' !== trim( $keyword ) ) {
			$by_keyword_meta = self::get_post_id_by_wnaw_keyword( $keyword );
			if ( $by_keyword_meta > 0 ) {
				return $by_keyword_meta;
			}
		}

		$by_title = self::get_post_id_by_exact_title( $plain_title );
		if ( $by_title > 0 ) {
			return $by_title;
		}

		return self::get_post_id_by_normalized_title( $plain_title );
	}

	/**
	 * @param int    $existing_post_id Existing WP post id.
	 * @param string $plain_title      Plain title.
	 * @param string $batch_id         Batch id.
	 * @param string $keyword          Keyword.
	 * @param int    $row_index        Article row index.
	 * @return WP_REST_Response
	 */
	private static function respond_existing_publish_post( $existing_post_id, $plain_title, $batch_id, $keyword, $row_index ) {
		$existing_post_id = absint( $existing_post_id );
		self::dbg(
			'publish rest: duplicate skipped post_id='
			. (string) $existing_post_id
			. ' title='
			. $plain_title
			. ' keyword='
			. $keyword
		);

		$existing_post   = get_post( $existing_post_id );
		$existing_status = $existing_post instanceof WP_Post ? sanitize_key( (string) $existing_post->post_status ) : 'draft';

		if ( class_exists( 'Whoneedsawriter_Repository' ) ) {
			$synced = Whoneedsawriter_Repository::mark_article_published_in_wp(
				$batch_id,
				$keyword,
				$plain_title,
				$existing_post_id,
				$existing_status,
				'',
				$row_index
			);
			if ( ! $synced ) {
				self::dbg(
					'publish rest: duplicate but article row not matched batch='
					. $batch_id
					. ' keyword='
					. $keyword
					. ' row='
					. (string) $row_index,
					true
				);
			}
		}

		return new WP_REST_Response(
			array(
				'post_id'   => $existing_post_id,
				'status'    => $existing_status,
				'duplicate' => true,
				'message'   => __( 'Post already exists', 'whoneedsawriter' ),
			),
			200
		);
	}

	/**
	 * @param string $keyword Keyword or title seed.
	 * @param string $title   Plain title fallback.
	 * @return string
	 */
	private static function build_publish_lock_key( $keyword, $title ) {
		$seed = '' !== trim( (string) $keyword )
			? strtolower( trim( (string) $keyword ) )
			: self::normalize_title_for_match( $title );

		return 'wnaw_publish_' . md5( $seed );
	}

	/**
	 * @param string $lock_key Transient key.
	 * @return bool
	 */
	private static function acquire_publish_lock( $lock_key ) {
		if ( false !== get_transient( $lock_key ) ) {
			return false;
		}

		set_transient( $lock_key, 'lock', 60 );

		return true;
	}

	/**
	 * @param string $lock_key Transient key.
	 * @param int    $post_id  Created or existing post id.
	 * @return void
	 */
	private static function release_publish_lock( $lock_key, $post_id ) {
		set_transient( $lock_key, absint( $post_id ), 120 );
	}

	/**
	 * @param string $lock_key   Transient key.
	 * @param string $plain_title Plain title.
	 * @param string $keyword    Keyword.
	 * @param string $batch_id   Batch id.
	 * @return int
	 */
	private static function wait_for_publish_lock_or_existing( $lock_key, $plain_title, $keyword, $batch_id ) {
		$val = get_transient( $lock_key );
		if ( false === $val ) {
			return 0;
		}

		if ( is_numeric( $val ) && (int) $val > 0 ) {
			return (int) $val;
		}

		if ( 'lock' !== $val ) {
			return 0;
		}

		for ( $i = 0; $i < 5; $i++ ) {
			usleep( 200000 );

			$existing = self::find_existing_publish_post( $plain_title, $keyword, $batch_id );
			if ( $existing > 0 ) {
				return $existing;
			}

			$val = get_transient( $lock_key );
			if ( is_numeric( $val ) && (int) $val > 0 ) {
				return (int) $val;
			}
			if ( false === $val ) {
				return 0;
			}
		}

		return 0;
	}

	/**
	 * @param string $title Raw title.
	 * @return string
	 */
	private static function normalize_title_for_match( $title ) {
		$plain = trim( wp_strip_all_tags( (string) $title ) );
		$plain = html_entity_decode( $plain, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$plain = preg_replace( '/\s+/u', ' ', $plain );

		return strtolower( $plain );
	}

	/**
	 * @param string $keyword Article keyword.
	 * @return int
	 */
	private static function get_post_id_by_wnaw_keyword( $keyword ) {
		$keyword = sanitize_text_field( (string) $keyword );
		if ( '' === trim( $keyword ) ) {
			return 0;
		}

		$posts = get_posts(
			array(
				'post_type'              => 'post',
				'post_status'            => array( 'publish', 'draft', 'future', 'pending', 'private' ),
				'posts_per_page'         => 1,
				'fields'                 => 'ids',
				'no_found_rows'          => true,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
				'meta_query'             => array(
					array(
						'key'   => '_wnaw_keyword',
						'value' => $keyword,
					),
				),
				'orderby'                => 'ID',
				'order'                  => 'DESC',
			)
		);

		return ! empty( $posts[0] ) ? absint( $posts[0] ) : 0;
	}

	/**
	 * @param string $title Plain title.
	 * @return int
	 */
	private static function get_post_id_by_normalized_title( $title ) {
		$needle = self::normalize_title_for_match( $title );
		if ( '' === $needle ) {
			return 0;
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			"SELECT ID, post_title FROM {$wpdb->posts}
			WHERE post_type = 'post'
			AND post_status NOT IN ('trash','auto-draft')
			ORDER BY ID DESC
			LIMIT 200",
			ARRAY_A
		);

		if ( ! is_array( $rows ) ) {
			return 0;
		}

		foreach ( $rows as $row ) {
			if ( ! isset( $row['ID'], $row['post_title'] ) ) {
				continue;
			}
			if ( self::normalize_title_for_match( (string) $row['post_title'] ) === $needle ) {
				return absint( $row['ID'] );
			}
		}

		return 0;
	}

	/**
	 * Replace remote img src with local uploads.
	 *
	 * @param string $content HTML article content.
	 * @return string
	 */
	private static function process_content_images( $content ) {
		$dom = new DOMDocument();
		libxml_use_internal_errors( true );

		$html_utf8 = '<?xml encoding="UTF-8"?><meta charset="UTF-8"><div id="__wnaw_root">' . $content . '</div>';
		// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		@$dom->loadHTML( $html_utf8, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD );
		libxml_clear_errors();

		$imgs = $dom->getElementsByTagName( 'img' );
		$list = array();
		for ( $i = 0, $ilen = $imgs->length; $i < $ilen; $i++ ) {
			$list[] = $imgs->item( $i );
		}

		$site = home_url();
		foreach ( $list as $img ) {
			if ( ! $img instanceof DOMElement ) {
				continue;
			}

			$src = trim( $img->getAttribute( 'src' ) );

			if ( '' === $src || 0 === strpos( $src, $site ) ) {
				continue;
			}

			$new_url = self::upload_image_from_url( $src );
			if ( $new_url ) {
				$img->setAttribute( 'src', $new_url );
			}
		}

		// Drop <h1> in body copy — the theme already renders the post title as the page H1.
		$h1_nodes = $dom->getElementsByTagName( 'h1' );
		$h1_remove = array();
		for ( $i = 0, $h1_len = $h1_nodes->length; $i < $h1_len; $i++ ) {
			$h1_remove[] = $h1_nodes->item( $i );
		}
		foreach ( $h1_remove as $h1 ) {
			if ( $h1 && $h1->parentNode ) {
				$h1->parentNode->removeChild( $h1 );
			}
		}

		$root = $dom->getElementById( '__wnaw_root' );
		if ( $root ) {
			$html = '';
			foreach ( $root->childNodes as $child ) {
				$html .= $dom->saveHTML( $child );
			}

			return $html;
		}

		self::dbg( 'process_content_images: wrapper node missing; returning content without h1 tags' );

		return self::strip_h1_tags_from_content( (string) $content );
	}

	/**
	 * Remove all <h1> elements from HTML content (regex fallback when DOM wrapper is unavailable).
	 *
	 * @param string $content HTML.
	 * @return string
	 */
	private static function strip_h1_tags_from_content( $content ) {
		$content = (string) $content;
		if ( '' === trim( $content ) ) {
			return $content;
		}

		$stripped = preg_replace( '/<h1\b[^>]*>[\s\S]*?<\/h1>/i', '', $content );

		return is_string( $stripped ) ? $stripped : $content;
	}

	/**
	 * Download image and insert attachment; returns URL or false.
	 *
	 * @param string $image_url Remote URL.
	 * @return string|false
	 */
	private static function upload_image_from_url( $image_url ) {
		if ( '' === trim( $image_url ) ) {
			return false;
		}

		$url_for_ext = strtok( $image_url, '?' );

		$ext = pathinfo( $url_for_ext, PATHINFO_EXTENSION );
		if ( empty( $ext ) && preg_match( '/\.([a-zA-Z]{2,6})(?:\?|$)/', $image_url, $matches ) ) {
			$ext = strtolower( $matches[1] );
		}
		if ( empty( $ext ) ) {
			$ext = 'jpg';
		}

		$filename      = 'wnaw-content-img-' . time() . '-' . wp_generate_password( 6, false, false ) . '.' . strtolower( $ext );
		$upload_dir    = wp_upload_dir();
		$response      = wp_remote_get(
			esc_url_raw( $image_url ),
			array(
				'timeout' => 30,
				'headers' => array(
					'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ) . '; ' . home_url(),
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			self::dbg( 'image download wp_error content ' . $response->get_error_message() );

			return false;
		}

		$image_data   = wp_remote_retrieve_body( $response );
		$content_type = (string) wp_remote_retrieve_header( $response, 'content-type' );

		if ( '' === trim( $image_data ) ) {
			self::dbg( 'image empty body' );

			return false;
		}

		if ( ! self::validate_image_data( $image_data, $content_type ) ) {
			self::dbg( 'image validate failed content' );

			return false;
		}

		$detected = self::detect_image_extension( $image_data );
		if ( $detected ) {
			$ext      = strtolower( $detected );
			$filename = 'wnaw-content-img-' . time() . '-' . wp_generate_password( 6, false, false ) . '.' . $ext;
		}

		if ( wp_mkdir_p( $upload_dir['path'] ) ) {
			$file = trailingslashit( $upload_dir['path'] ) . $filename;
		} else {
			$file = trailingslashit( $upload_dir['basedir'] ) . $filename;
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- REST context; direct write is reliable.
		if ( false === file_put_contents( $file, $image_data ) ) {
			self::dbg( 'image write failed content' );

			return false;
		}

		if ( ! file_exists( $file ) ) {
			self::dbg( 'image missing after write' );

			return false;
		}

		$wp_filetype = wp_check_filetype( $filename, null );
		if ( ! $wp_filetype['type'] ) {
			self::delete_local_file( $file );

			return false;
		}

		$attachment = array(
			'post_mime_type' => $wp_filetype['type'],
			'post_title'     => sanitize_file_name( wp_basename( $filename ) ),
			'post_content'   => '',
			'post_status'    => 'inherit',
		);

		$attach_id = wp_insert_attachment( $attachment, $file );

		if ( is_wp_error( $attach_id ) ) {
			self::delete_local_file( $file );

			return false;
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';

		$meta_data = wp_generate_attachment_metadata( (int) $attach_id, $file );
		$meta_data = apply_filters(
			'whoneedsawriter_attachment_metadata_generated',
			is_array( $meta_data ) ? $meta_data : array(),
			(int) $attach_id,
			$file
		);

		if ( ! empty( $meta_data ) && is_array( $meta_data ) ) {
			wp_update_attachment_metadata( (int) $attach_id, $meta_data );
			do_action( 'whoneedsawriter_attachment_meta_ready', (int) $attach_id, $file, $meta_data );
		} else {
			do_action( 'whoneedsawriter_attachment_meta_failed', (int) $attach_id, $file );
		}

		return wp_get_attachment_url( (int) $attach_id );
	}

	/**
	 * Set featured image from remote URL.
	 *
	 * @param string                $image_url URL.
	 * @param int                   $post_id   Post ID.
	 * @return int|WP_Error Attachment ID or error.
	 */
	private static function set_featured_image( $image_url, $post_id ) {
		self::dbg( 'set featured img post ' . (string) $post_id );

		if ( '' === trim( $image_url ) ) {
			return new WP_Error( 'empty_url', 'Empty image URL.' );
		}

		$url_for_ext = strtok( $image_url, '?' );
		$ext         = pathinfo( $url_for_ext, PATHINFO_EXTENSION );

		if ( empty( $ext ) && preg_match( '/\.([a-zA-Z]{2,6})(?:\?|$)/', $image_url, $matches ) ) {
			$ext = strtolower( $matches[1] );
		}
		if ( empty( $ext ) ) {
			$ext = 'jpg';
		}

		$filename      = 'wnaw-featured-' . (string) $post_id . '-' . time() . '.' . strtolower( $ext );
		$upload_dir    = wp_upload_dir();

		$response = wp_remote_get(
			esc_url_raw( $image_url ),
			array(
				'timeout' => 45,
				'headers' => array(
					'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ) . '; ' . home_url(),
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'image_download_failed', $response->get_error_message() );
		}

		$body         = wp_remote_retrieve_body( $response );
		$content_type = (string) wp_remote_retrieve_header( $response, 'content-type' );

		if ( '' === trim( $body ) ) {
			return new WP_Error( 'image_download_failed', __( 'Empty image data received.', 'whoneedsawriter' ) );
		}

		if ( ! self::validate_image_data( $body, $content_type ) ) {
			return new WP_Error( 'image_validation_failed', __( 'Invalid image data.', 'whoneedsawriter' ) );
		}

		$d = self::detect_image_extension( $body );
		if ( $d ) {
			$filename = 'wnaw-featured-' . (string) $post_id . '-' . time() . '.' . strtolower( $d );
		}

		if ( wp_mkdir_p( $upload_dir['path'] ) ) {
			$file = trailingslashit( $upload_dir['path'] ) . $filename;
		} else {
			$file = trailingslashit( $upload_dir['basedir'] ) . $filename;
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents -- REST publish path.
		if ( false === file_put_contents( $file, $body ) ) {
			return new WP_Error( 'file_write_failed', __( 'Failed to save image.', 'whoneedsawriter' ) );
		}

		$wp_filetype = wp_check_filetype( $filename, null );
		if ( ! $wp_filetype['type'] ) {
			self::delete_local_file( $file );

			return new WP_Error( 'invalid_file_type', __( 'Invalid file type.', 'whoneedsawriter' ) );
		}

		$attachment = array(
			'post_mime_type' => $wp_filetype['type'],
			'post_title'     => sanitize_file_name( wp_basename( $filename ) ),
			'post_content'   => '',
			'post_status'    => 'inherit',
		);

		$attach_id = wp_insert_attachment( $attachment, $file, $post_id );

		if ( is_wp_error( $attach_id ) ) {
			self::delete_local_file( $file );

			return $attach_id;
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';

		set_post_thumbnail( $post_id, (int) $attach_id );

		$meta_data = wp_generate_attachment_metadata( (int) $attach_id, $file );
		if ( is_array( $meta_data ) && ! empty( $meta_data ) ) {
			wp_update_attachment_metadata( (int) $attach_id, $meta_data );
			if ( ! has_post_thumbnail( $post_id ) ) {
				set_post_thumbnail( $post_id, (int) $attach_id );
			}
		} else {
			$upload_dir = wp_upload_dir();
			$rel_file   = function_exists( '_wp_relative_upload_path' )
				? _wp_relative_upload_path( $file )
				: ltrim( str_replace( trailingslashit( $upload_dir['basedir'] ), '', wp_normalize_path( $file ) ), '/' );

			$minimal = array(
				'width'  => 0,
				'height' => 0,
				'file'   => $rel_file,
				'sizes'  => array(),
			);
			wp_update_attachment_metadata( (int) $attach_id, $minimal );
			if ( ! has_post_thumbnail( $post_id ) ) {
				set_post_thumbnail( $post_id, (int) $attach_id );
			}
		}

		return (int) $attach_id;
	}

	/**
	 * Rough extension from magic bytes.
	 *
	 * @param string $image_data Raw bytes.
	 * @return string|false
	 */
	private static function detect_image_extension( $image_data ) {
		if ( strpos( $image_data, "\xFF\xD8\xFF" ) === 0 ) {
			return 'jpg';
		}
		if ( strpos( $image_data, "\x89PNG\r\n\x1a\n" ) === 0 ) {
			return 'png';
		}
		if ( strpos( $image_data, 'GIF87a', 0 ) === 0 || strpos( $image_data, 'GIF89a', 0 ) === 0 ) {
			return 'gif';
		}
		if ( strpos( $image_data, 'RIFF', 0 ) === 0 && false !== strpos( $image_data, 'WEBP', 8 ) ) {
			return 'webp';
		}
		if ( strpos( $image_data, 'BM', 0 ) === 0 ) {
			return 'bmp';
		}

		return false;
	}

	/**
	 * Basic safety checks before writing binary blobs.
	 *
	 * @param string $image_data Raw image.
	 * @param string $content_type MIME from header.
	 * @return bool
	 */
	private static function validate_image_data( $image_data, $content_type ) {
		$len = strlen( $image_data );
		if ( $len > 10485760 || $len < 100 ) {
			return false;
		}

		return (bool) self::detect_image_extension( $image_data );
	}

	/**
	 * SEO plugin meta bridging.
	 *
	 * @param int    $post_id          Post ID.
	 * @param string $meta_title       Title meta.
	 * @param string $meta_description Description meta.
	 * @return void
	 */
	private static function set_seo_meta( $post_id, $meta_title, $meta_description ) {
		$post_id = absint( $post_id );

		if ( defined( 'WPSEO_VERSION' ) ) {
			update_post_meta( $post_id, '_yoast_wpseo_title', sanitize_text_field( $meta_title ) );
			update_post_meta( $post_id, '_yoast_wpseo_metadesc', sanitize_textarea_field( $meta_description ) );
		}

		if ( class_exists( 'RankMath' ) ) {
			update_post_meta( $post_id, 'rank_math_title', sanitize_text_field( $meta_title ) );
			update_post_meta( $post_id, 'rank_math_description', sanitize_textarea_field( $meta_description ) );
		}

		if ( class_exists( 'AIOSEO' ) ) {
			update_post_meta( $post_id, '_aioseo_title', sanitize_text_field( $meta_title ) );
			update_post_meta( $post_id, '_aioseo_description', sanitize_textarea_field( $meta_description ) );
		}

		update_post_meta( $post_id, '_wnaw_meta_title', sanitize_text_field( $meta_title ) );
		update_post_meta( $post_id, '_wnaw_meta_description', sanitize_textarea_field( $meta_description ) );
	}

	/**
	 * @param array<string,mixed> $post_data Payload.
	 * @param string[]            $keys      Candidate keys.
	 * @return string
	 */
	private static function extract_payload_string( array $post_data, array $keys ) {
		foreach ( $keys as $key ) {
			if ( ! array_key_exists( $key, $post_data ) ) {
				continue;
			}
			$value = $post_data[ $key ];
			if ( null === $value || '' === $value ) {
				continue;
			}
			if ( is_scalar( $value ) ) {
				$text = trim( (string) $value );
				if ( '' !== $text ) {
					return sanitize_text_field( $text );
				}
			}
		}
		return '';
	}

	/**
	 * SaaS batch id from publish payload (batch creation uses `batch`).
	 *
	 * @param array<string,mixed> $post_data Payload.
	 * @return string
	 */
	private static function extract_batch_id_from_payload( array $post_data ) {
		return self::extract_payload_string(
			$post_data,
			array(
				'batchId',
				'batch_id',
				'BatchId',
				'batchID',
				'batch',
				'Batch',
				'assignedBatch',
				'assigned_batch',
			)
		);
	}

	/**
	 * Keyword from SaaS publish payload (`keyword` field from cron).
	 *
	 * @param array<string,mixed> $post_data Payload.
	 * @return string
	 */
	private static function extract_keyword_from_payload( array $post_data ) {
		return self::extract_payload_string(
			$post_data,
			array(
				'keyword',
				'Keyword',
				'textKeyword',
				'text_keyword',
				'searchKeyword',
				'search_keyword',
			)
		);
	}

	/**
	 * @param string $title Post title plain text.
	 * @return int
	 */
	private static function get_post_id_by_exact_title( $title ) {
		global $wpdb;

		$title = wp_strip_all_tags( (string) $title );
		if ( '' === trim( $title ) ) {
			return 0;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$post_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT ID FROM {$wpdb->posts}
				WHERE post_type = 'post'
				AND post_status NOT IN ('trash','auto-draft')
				AND post_title = %s
				ORDER BY ID DESC
				LIMIT 1",
				$title
			)
		);

		return $post_id ? absint( $post_id ) : 0;
	}
}
