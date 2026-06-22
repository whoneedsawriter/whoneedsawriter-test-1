<?php
/**
 * Local persistence for batches, articles, batch settings, and dashboard stats.
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Database access for plugin-owned cache tables (replaces browser localStorage).
 */
final class Whoneedsawriter_Repository {

	const TABLE_BATCHES  = 'wnaw_batches';
	const META_FLAG      = '_wnaw_saas_post';

	/**
	 * @return void
	 */
	public static function init() {
		add_action( 'transition_post_status', array( __CLASS__, 'on_wp_post_status_transition' ), 10, 3 );
	}

	/**
	 * Keep article rows in sync when WP publishes scheduled posts.
	 *
	 * @param string   $new_status New status.
	 * @param string   $old_status Old status.
	 * @param WP_Post  $post       Post.
	 * @return void
	 */
	public static function on_wp_post_status_transition( $new_status, $old_status, $post ) {
		if ( ! $post instanceof WP_Post ) {
			return;
		}

		$flag = get_post_meta( $post->ID, self::META_FLAG, true );
		if ( ! $flag ) {
			return;
		}

		$new_status = sanitize_key( (string) $new_status );
		if ( '' === $new_status || $new_status === $old_status ) {
			return;
		}

		self::update_article_wp_status_by_post_id( (int) $post->ID, $new_status );
	}

	/**
	 * @param int    $post_id Post id.
	 * @param string $post_status WP post status.
	 * @return void
	 */
	public static function update_article_wp_status_by_post_id( $post_id, $post_status ) {
		global $wpdb;

		$post_id     = absint( $post_id );
		$post_status = sanitize_key( (string) $post_status );
		if ( $post_id <= 0 || '' === $post_status ) {
			return;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
		$wpdb->update(
			self::articles_table(),
			array( 'wp_post_status' => $post_status ),
			array( 'wp_post_id' => $post_id )
		);
	}

	const TABLE_ARTICLES = 'wnaw_articles';
	const TABLE_STATS    = 'wnaw_dashboard_stats';

	/**
	 * @return string
	 */
	public static function batches_table() {
		global $wpdb;
		return $wpdb->prefix . self::TABLE_BATCHES;
	}

	/**
	 * @return string
	 */
	public static function articles_table() {
		global $wpdb;
		return $wpdb->prefix . self::TABLE_ARTICLES;
	}

	/**
	 * @return string
	 */
	public static function stats_table() {
		global $wpdb;
		return $wpdb->prefix . self::TABLE_STATS;
	}

	/**
	 * @param string $batch_id Batch id.
	 * @return array<string,mixed>|null
	 */
	public static function get_batch( $batch_id ) {
		global $wpdb;

		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' === $batch_id ) {
			return null;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::batches_table() . ' WHERE batch_id = %s LIMIT 1',
				$batch_id
			),
			ARRAY_A
		);

		return is_array( $row ) ? $row : null;
	}

	/**
	 * @param string $saas_user_id SaaS user id.
	 * @return array<int,array<string,mixed>>
	 */
	public static function get_batches_for_user( $saas_user_id ) {
		global $wpdb;

		$saas_user_id = sanitize_text_field( (string) $saas_user_id );
		if ( '' === $saas_user_id ) {
			return array();
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::batches_table() . ' WHERE saas_user_id = %s ORDER BY updated_at DESC, id DESC',
				$saas_user_id
			),
			ARRAY_A
		);

		return is_array( $rows ) ? $rows : array();
	}

	/**
	 * Upsert a normalized batch row (jobs list / job detail header).
	 *
	 * @param string              $saas_user_id SaaS user id.
	 * @param array<string,mixed> $row          Normalized batch (id, name, statusKey, …).
	 * @return void
	 */
	public static function upsert_batch_row( $saas_user_id, array $row ) {
		global $wpdb;

		$batch_id = isset( $row['id'] ) ? sanitize_text_field( (string) $row['id'] ) : '';
		if ( '' === $batch_id ) {
			return;
		}

		$existing   = self::get_batch( $batch_id );
		$batch_name = isset( $row['name'] ) ? sanitize_text_field( (string) $row['name'] ) : '';
		if ( self::is_batch_name_placeholder( $batch_name, $batch_id ) ) {
			$batch_name = '';
		}
		if ( $existing && '' === $batch_name && ! empty( $existing['batch_name'] ) ) {
			$stored = sanitize_text_field( (string) $existing['batch_name'] );
			if ( ! self::is_batch_name_placeholder( $stored, $batch_id ) ) {
				$batch_name = $stored;
			}
		}
		if ( $existing && '' !== $batch_name && ! empty( $existing['batch_name'] ) ) {
			$stored = sanitize_text_field( (string) $existing['batch_name'] );
			if ( ! self::is_batch_name_placeholder( $stored, $batch_id )
				&& self::is_more_specific_batch_name( $stored, $batch_name ) ) {
				$batch_name = $stored;
			}
		}

		$data = array(
			'batch_id'           => $batch_id,
			'saas_user_id'       => sanitize_text_field( (string) $saas_user_id ),
			'batch_name'         => $batch_name,
			'status_int'         => isset( $row['statusInt'] ) ? (int) $row['statusInt'] : 0,
			'status_key'         => isset( $row['statusKey'] ) ? sanitize_key( (string) $row['statusKey'] ) : 'generating',
			'status_label'       => isset( $row['statusLabel'] ) ? sanitize_text_field( (string) $row['statusLabel'] ) : '',
			'articles_total'     => isset( $row['articles'] ) ? (int) $row['articles'] : 0,
			'articles_completed' => isset( $row['completedArticles'] ) ? (int) $row['completedArticles'] : 0,
			'articles_pending'   => isset( $row['pendingArticles'] ) ? (int) $row['pendingArticles'] : 0,
			'failed_articles'    => isset( $row['failedArticles'] ) ? (int) $row['failedArticles'] : 0,
			'saas_created_at'    => isset( $row['createdAt'] ) ? sanitize_text_field( (string) $row['createdAt'] ) : '',
		);

		if ( $existing ) {
			$wpdb->update( self::batches_table(), $data, array( 'batch_id' => $batch_id ) );
			return;
		}

		$wpdb->insert( self::batches_table(), $data );
	}

	/**
	 * @param string              $saas_user_id SaaS user id.
	 * @param array<int,array<string,mixed>> $rows Normalized batch rows.
	 * @return void
	 */
	public static function upsert_batch_rows( $saas_user_id, array $rows ) {
		foreach ( $rows as $row ) {
			if ( is_array( $row ) ) {
				self::upsert_batch_row( $saas_user_id, $row );
			}
		}
	}

	/**
	 * @param string $batch_id Batch id.
	 * @param array<string,mixed> $settings Settings snapshot.
	 * @return void
	 */
	public static function save_batch_settings( $batch_id, array $settings ) {
		global $wpdb;

		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' === $batch_id ) {
			return;
		}

		$json = wp_json_encode( $settings );
		if ( ! is_string( $json ) ) {
			return;
		}

		$display_name = ! empty( $settings['batch_display_name'] )
			? sanitize_text_field( (string) $settings['batch_display_name'] )
			: '';

		$existing = self::get_batch( $batch_id );
		if ( $existing ) {
			$update = array( 'settings_json' => $json );
			if ( '' !== $display_name && ! self::is_batch_name_placeholder( $display_name, $batch_id ) ) {
				$stored = isset( $existing['batch_name'] ) ? (string) $existing['batch_name'] : '';
				$should_update = '' === trim( $stored ) || self::is_batch_name_placeholder( $stored, $batch_id );
				if ( ! $should_update && self::is_more_specific_batch_name( $stored, $display_name ) ) {
					$should_update = false;
				}
				if ( $should_update ) {
					$update['batch_name'] = $display_name;
				}
			}
			$wpdb->update(
				self::batches_table(),
				$update,
				array( 'batch_id' => $batch_id )
			);
			return;
		}

		$wpdb->insert(
			self::batches_table(),
			array(
				'batch_id'      => $batch_id,
				'settings_json' => $json,
			)
		);
	}

	/**
	 * @param string $batch_id Batch id.
	 * @return array<string,mixed>|null
	 */
	public static function get_batch_settings( $batch_id ) {
		$row = self::get_batch( $batch_id );
		if ( ! $row || empty( $row['settings_json'] ) ) {
			return null;
		}

		$decoded = json_decode( (string) $row['settings_json'], true );
		return is_array( $decoded ) ? $decoded : null;
	}

	/**
	 * Seed article placeholders at generation time.
	 *
	 * @param string   $batch_id Batch id.
	 * @param string[] $keywords Keywords.
	 * @param string[] $scheduled_slots Optional schedule labels per row.
	 * @return void
	 */
	public static function seed_articles( $batch_id, array $keywords, array $scheduled_slots = array() ) {
		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' === $batch_id || empty( $keywords ) ) {
			return;
		}

		$idx = 0;
		foreach ( $keywords as $kw ) {
			$keyword = sanitize_text_field( (string) $kw );
			if ( '' === $keyword ) {
				continue;
			}

			$slot = isset( $scheduled_slots[ $idx ] ) ? sanitize_text_field( (string) $scheduled_slots[ $idx ] ) : '';

			self::upsert_article_row(
				$batch_id,
				$idx,
				array(
					'keyword'       => $keyword,
					'title'           => $keyword,
					'statusInt'       => 0,
					'statusKey'       => 'generating',
					'statusLabel'     => __( 'Generating', 'whoneedsawriter' ),
					'scheduledTime'   => $slot,
				)
			);
			++$idx;
		}

		self::recompute_batch_status( $batch_id );
	}

	/**
	 * @param string $batch_id Batch id.
	 * @return array<int,array<string,mixed>>
	 */
	public static function get_articles( $batch_id ) {
		global $wpdb;

		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' === $batch_id ) {
			return array();
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::articles_table() . ' WHERE batch_id = %s ORDER BY row_index ASC, id ASC',
				$batch_id
			),
			ARRAY_A
		);

		return is_array( $rows ) ? $rows : array();
	}

	/**
	 * Persist normalized article rows from SaaS sync.
	 *
	 * @param string $batch_id Batch id.
	 * @param array<int,array<string,mixed>> $rows Normalized rows.
	 * @return void
	 */
	public static function upsert_article_rows( $batch_id, array $rows ) {
		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' === $batch_id ) {
			return;
		}

		foreach ( $rows as $idx => $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			self::upsert_article_row( $batch_id, (int) $idx, $row );
		}

		self::recompute_batch_status( $batch_id );
	}

	/**
	 * @param string              $batch_id Batch id.
	 * @param int                 $row_index Row index.
	 * @param array<string,mixed> $row Normalized article row.
	 * @return void
	 */
	public static function upsert_article_row( $batch_id, $row_index, array $row ) {
		global $wpdb;

		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' === $batch_id ) {
			return;
		}

		$row_index = max( 0, (int) $row_index );

		$keyword = isset( $row['keyword'] ) ? sanitize_text_field( (string) $row['keyword'] ) : '';
		$title   = isset( $row['title'] ) ? sanitize_text_field( (string) $row['title'] ) : $keyword;

		$data = array(
			'batch_id'       => $batch_id,
			'row_index'      => $row_index,
			'keyword'        => $keyword,
			'title'          => $title,
			'status_int'     => isset( $row['statusInt'] ) ? (int) $row['statusInt'] : 0,
			'status_key'     => isset( $row['statusKey'] ) ? sanitize_key( (string) $row['statusKey'] ) : 'generating',
			'status_label'   => isset( $row['statusLabel'] ) ? sanitize_text_field( (string) $row['statusLabel'] ) : '',
			'wp_post_id'     => isset( $row['wpPostId'] ) ? absint( $row['wpPostId'] ) : 0,
			'wp_post_status' => isset( $row['wpPostStatus'] ) ? sanitize_key( (string) $row['wpPostStatus'] ) : '',
			'scheduled_time' => isset( $row['scheduledTime'] ) ? sanitize_text_field( (string) $row['scheduledTime'] ) : '',
			'is_removed'     => ( isset( $row['statusKey'] ) && 'removed' === sanitize_key( (string) $row['statusKey'] ) ) ? 1 : 0,
			'model'          => isset( $row['model'] ) ? sanitize_text_field( (string) $row['model'] ) : '',
			'category'       => isset( $row['category'] ) ? sanitize_text_field( (string) $row['category'] ) : '',
			'author'         => isset( $row['author'] ) ? sanitize_text_field( (string) $row['author'] ) : '',
		);

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
		$existing_id = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . self::articles_table() . ' WHERE batch_id = %s AND row_index = %d LIMIT 1',
				$batch_id,
				$row_index
			)
		);

		if ( $existing_id ) {
			$wpdb->update( self::articles_table(), $data, array( 'id' => (int) $existing_id ) );
			return;
		}

		$wpdb->insert( self::articles_table(), $data );
	}

	/**
	 * REST publish / SaaS cron: article landed in WordPress.
	 *
	 * @param string $batch_id Batch id (optional).
	 * @param string $keyword Keyword (optional).
	 * @param string $title Post title.
	 * @param int    $post_id WP post id.
	 * @param string $post_status draft|future|publish|…
	 * @param string $scheduled_time Optional display label.
	 * @return void
	 */
	public static function mark_article_published_in_wp( $batch_id, $keyword, $title, $post_id, $post_status, $scheduled_time = '', $row_index = -1 ) {
		global $wpdb;

		$post_id     = absint( $post_id );
		$post_status = sanitize_key( (string) $post_status );
		$title       = sanitize_text_field( (string) $title );
		$keyword     = sanitize_text_field( (string) $keyword );
		$batch_id    = sanitize_text_field( (string) $batch_id );
		$row_index   = (int) $row_index;

		if ( '' === $batch_id && $post_id > 0 ) {
			$meta_batch = get_post_meta( $post_id, '_wnaw_batch_id', true );
			if ( is_string( $meta_batch ) && '' !== trim( $meta_batch ) ) {
				$batch_id = sanitize_text_field( $meta_batch );
			}
		}
		if ( '' === $keyword && $post_id > 0 ) {
			$meta_keyword = get_post_meta( $post_id, '_wnaw_keyword', true );
			if ( is_string( $meta_keyword ) && '' !== trim( $meta_keyword ) ) {
				$keyword = sanitize_text_field( $meta_keyword );
			}
		}

		$article = self::find_article_for_publish( $batch_id, $keyword, $title, $post_id, $row_index );
		if ( ! $article ) {
			return false;
		}

		if ( '' !== $keyword && self::normalize_match_key( $keyword ) !== self::normalize_match_key( (string) $article['keyword'] ) ) {
			return false;
		}
		if ( $row_index >= 0 && (int) $article['row_index'] !== $row_index ) {
			return false;
		}

		$existing_post_id = absint( $article['wp_post_id'] );
		if ( $existing_post_id > 0 && $existing_post_id !== $post_id ) {
			return false;
		}

		if ( '' === $batch_id && ! empty( $article['batch_id'] ) ) {
			$batch_id = (string) $article['batch_id'];
		}
		if ( '' === $keyword && ! empty( $article['keyword'] ) ) {
			$keyword = sanitize_text_field( (string) $article['keyword'] );
		}

		$wpdb->update(
			self::articles_table(),
			array(
				'title'          => '' !== $title ? $title : (string) $article['title'],
				'keyword'        => '' !== $keyword ? $keyword : (string) $article['keyword'],
				'status_int'     => 1,
				'status_key'     => 'generated',
				'status_label'   => __( 'Generated', 'whoneedsawriter' ),
				'wp_post_id'     => $post_id,
				'wp_post_status' => $post_status,
				'scheduled_time' => '' !== $scheduled_time ? sanitize_text_field( $scheduled_time ) : (string) $article['scheduled_time'],
				'is_removed'     => 0,
			),
			array( 'id' => (int) $article['id'] )
		);

		if ( $post_id > 0 ) {
			if ( '' !== $batch_id ) {
				update_post_meta( $post_id, '_wnaw_batch_id', $batch_id );
			}
			if ( '' !== $keyword ) {
				update_post_meta( $post_id, '_wnaw_keyword', $keyword );
			}
			update_post_meta( $post_id, self::META_FLAG, true );
		}

		if ( '' !== $batch_id ) {
			self::recompute_batch_status( $batch_id );
			self::refresh_dashboard_stats_for_batch( $batch_id );
		}

		return true;
	}

	/**
	 * Find a WordPress post already linked to this keyword in the plugin DB.
	 *
	 * @param string $keyword  Article keyword.
	 * @param string $batch_id Optional batch scope.
	 * @return int WP post ID or 0.
	 */
	public static function find_linked_wp_post_id_by_keyword( $keyword, $batch_id = '' ) {
		$keyword_key = self::normalize_match_key( (string) $keyword );
		if ( '' === $keyword_key ) {
			return 0;
		}

		$batch_id = sanitize_text_field( (string) $batch_id );

		if ( '' !== $batch_id ) {
			$articles = self::get_articles( $batch_id );
			foreach ( $articles as $article ) {
				if ( self::normalize_match_key( (string) $article['keyword'] ) !== $keyword_key ) {
					continue;
				}
				$wp_post_id = absint( $article['wp_post_id'] );
				if ( $wp_post_id > 0 && get_post( $wp_post_id ) instanceof WP_Post ) {
					return $wp_post_id;
				}
			}

			return 0;
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results(
			'SELECT wp_post_id, keyword FROM ' . self::articles_table() . ' WHERE is_removed = 0 AND wp_post_id > 0',
			ARRAY_A
		);

		if ( ! is_array( $rows ) ) {
			return 0;
		}

		foreach ( $rows as $row ) {
			if ( self::normalize_match_key( (string) $row['keyword'] ) !== $keyword_key ) {
				continue;
			}
			$wp_post_id = absint( $row['wp_post_id'] );
			if ( $wp_post_id > 0 && get_post( $wp_post_id ) instanceof WP_Post ) {
				return $wp_post_id;
			}
		}

		return 0;
	}

	/**
	 * Link still-Generating DB rows to SaaS posts already created in WordPress.
	 *
	 * @param string $batch_id Batch id.
	 * @return bool True when at least one row was updated.
	 */
	public static function reconcile_generating_articles_with_wp( $batch_id ) {
		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' === $batch_id ) {
			return false;
		}

		$changed = false;
		foreach ( self::get_articles( $batch_id ) as $article ) {
			if ( ! empty( $article['is_removed'] ) || 'generating' !== sanitize_key( (string) $article['status_key'] ) ) {
				continue;
			}

			$post_id = self::find_wp_post_for_generating_article( $batch_id, $article );
			if ( $post_id <= 0 ) {
				continue;
			}

			$post     = get_post( $post_id );
			$status   = $post instanceof WP_Post ? sanitize_key( (string) $post->post_status ) : 'draft';
			$title    = $post instanceof WP_Post ? (string) $post->post_title : (string) $article['title'];
			$keyword  = (string) $article['keyword'];
			$scheduled = 'future' === $status && $post instanceof WP_Post ? (string) $post->post_date : '';

			if ( self::mark_article_published_in_wp( $batch_id, $keyword, $title, $post_id, $status, $scheduled, (int) $article['row_index'] ) ) {
				$changed = true;
			}
		}

		return $changed;
	}

	/**
	 * @param string              $batch_id Batch id.
	 * @param array<string,mixed> $article  Article DB row.
	 * @return int
	 */
	private static function find_wp_post_for_generating_article( $batch_id, array $article ) {
		$batch_id = sanitize_text_field( (string) $batch_id );
		$keyword  = sanitize_text_field( (string) $article['keyword'] );

		if ( '' === $keyword ) {
			return 0;
		}

		if ( '' !== $batch_id ) {
			$posts = get_posts(
				array(
					'post_type'              => 'post',
					'post_status'            => array( 'draft', 'publish', 'future', 'pending', 'private' ),
					'posts_per_page'         => 1,
					'fields'                 => 'ids',
					'no_found_rows'          => true,
					'update_post_meta_cache' => false,
					'update_post_term_cache' => false,
					'meta_query'             => array(
						'relation' => 'AND',
						array(
							'key'   => '_wnaw_batch_id',
							'value' => $batch_id,
						),
						array(
							'key'   => '_wnaw_keyword',
							'value' => $keyword,
						),
					),
				)
			);
			if ( ! empty( $posts[0] ) ) {
				return absint( $posts[0] );
			}
		}

		$posts = get_posts(
			array(
				'post_type'              => 'post',
				'post_status'            => array( 'draft', 'publish', 'future', 'pending', 'private' ),
				'posts_per_page'         => 5,
				'fields'                 => 'ids',
				'no_found_rows'          => true,
				'update_post_meta_cache' => true,
				'update_post_term_cache' => false,
				'meta_query'             => array(
					'relation' => 'AND',
					array(
						'key'   => '_wnaw_keyword',
						'value' => $keyword,
					),
					array(
						'key'   => self::META_FLAG,
						'value' => '1',
					),
				),
			)
		);

		$matches = array();
		foreach ( $posts as $candidate_id ) {
			$candidate_id = absint( $candidate_id );
			if ( self::article_is_linked_to_another_row( $candidate_id, $batch_id, $keyword ) ) {
				continue;
			}
			$matches[] = $candidate_id;
		}

		return 1 === count( $matches ) ? (int) $matches[0] : 0;
	}

	/**
	 * @param int    $post_id   Post id.
	 * @param string $batch_id  Expected batch id.
	 * @param string $keyword   Expected keyword.
	 * @return bool
	 */
	private static function article_is_linked_to_another_row( $post_id, $batch_id, $keyword ) {
		global $wpdb;

		$post_id = absint( $post_id );
		if ( $post_id <= 0 ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT batch_id, keyword FROM ' . self::articles_table() . ' WHERE wp_post_id = %d LIMIT 1',
				$post_id
			),
			ARRAY_A
		);

		if ( ! is_array( $row ) ) {
			return false;
		}

		$linked_batch   = isset( $row['batch_id'] ) ? sanitize_text_field( (string) $row['batch_id'] ) : '';
		$linked_keyword = isset( $row['keyword'] ) ? self::normalize_match_key( (string) $row['keyword'] ) : '';
		$keyword_key    = self::normalize_match_key( $keyword );

		if ( '' !== $batch_id && $linked_batch !== sanitize_text_field( (string) $batch_id ) ) {
			return true;
		}

		return '' !== $keyword_key && '' !== $linked_keyword && $linked_keyword !== $keyword_key;
	}

	/**
	 * @param string $batch_id Batch id.
	 * @param int    $row_index Row index.
	 * @return void
	 */
	public static function mark_article_failed( $batch_id, $row_index ) {
		global $wpdb;

		$batch_id  = sanitize_text_field( (string) $batch_id );
		$row_index = (int) $row_index;
		if ( '' === $batch_id || $row_index < 0 ) {
			return;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
		$wpdb->query(
			$wpdb->prepare(
				'UPDATE ' . self::articles_table() . ' SET status_int = %d, status_key = %s, status_label = %s WHERE batch_id = %s AND row_index = %d',
				2,
				'failed',
				__( 'Failed', 'whoneedsawriter' ),
				$batch_id,
				$row_index
			)
		);

		self::recompute_batch_status( $batch_id );
	}

	/**
	 * Check SaaS status for DB "generating" rows; mark status 2 as Failed.
	 *
	 * @param string                $batch_id   Batch id.
	 * @param array<int,array<string,mixed>> $saas_rows SaaS article rows.
	 * @return bool True when at least one row changed.
	 */
	public static function sync_generating_articles_from_saas( $batch_id, array $saas_rows ) {
		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' === $batch_id ) {
			return false;
		}

		$changed = false;
		foreach ( self::get_articles( $batch_id ) as $article ) {
			if ( ! empty( $article['is_removed'] ) || 'generating' !== sanitize_key( (string) $article['status_key'] ) ) {
				continue;
			}

			$db_keyword = self::normalize_match_key( (string) $article['keyword'] );
			if ( '' === $db_keyword ) {
				continue;
			}

			foreach ( $saas_rows as $saas_row ) {
				if ( ! is_array( $saas_row ) ) {
					continue;
				}

				$saas_keyword = isset( $saas_row['keyword'] ) ? self::normalize_match_key( (string) $saas_row['keyword'] ) : '';
				if ( $saas_keyword !== $db_keyword ) {
					continue;
				}

				$status_int = isset( $saas_row['status'] ) && is_numeric( $saas_row['status'] ) ? (int) $saas_row['status'] : -1;
				if ( 2 === $status_int ) {
					self::mark_article_failed( $batch_id, (int) $article['row_index'] );
					$changed = true;
				}
				break;
			}
		}

		return $changed;
	}

	/**
	 * @param string $batch_id Batch id.
	 * @return array<int,array<string,mixed>>
	 */
	public static function get_articles_normalized( $batch_id ) {
		self::reconcile_generating_articles_with_wp( $batch_id );

		$rows = array();
		foreach ( self::get_articles( $batch_id ) as $db_row ) {
			$rows[] = self::db_article_to_normalized( $db_row );
		}
		return $rows;
	}

	/**
	 * @param string $batch_id Batch id.
	 * @return array<string,mixed>|null
	 */
	public static function get_batch_normalized( $batch_id ) {
		self::recompute_batch_status( $batch_id );
		$batch = self::get_batch( $batch_id );
		return is_array( $batch ) ? self::db_batch_to_normalized( $batch ) : null;
	}

	/**
	 * @param string $saas_user_id SaaS user id.
	 * @return array<int,array<string,mixed>>
	 */
	public static function get_jobs_normalized_for_user( $saas_user_id ) {
		$rows = array();
		foreach ( self::get_batches_for_user( $saas_user_id ) as $db_row ) {
			$batch_id = isset( $db_row['batch_id'] ) ? (string) $db_row['batch_id'] : '';
			if ( '' !== $batch_id ) {
				self::recompute_batch_status( $batch_id );
				$fresh = self::get_batch( $batch_id );
				if ( is_array( $fresh ) ) {
					$db_row = $fresh;
				}
			}
			$rows[] = self::db_batch_to_normalized( $db_row );
		}
		return $rows;
	}

	/**
	 * @param string $saas_user_id SaaS user id.
	 * @return array{articlesGenerated:int,articlesPublished:int,activeJobs:int,failedArticles:int}
	 */
	public static function compute_dashboard_stats( $saas_user_id ) {
		$saas_user_id = sanitize_text_field( (string) $saas_user_id );

		$articles_generated = 0;
		$articles_published = 0;
		$active_jobs        = 0;
		$failed_articles    = 0;

		foreach ( self::get_batches_for_user( $saas_user_id ) as $db_batch ) {
			$batch_id = isset( $db_batch['batch_id'] ) ? (string) $db_batch['batch_id'] : '';
			if ( '' === $batch_id ) {
				continue;
			}

			self::recompute_batch_status( $batch_id );
			$batch = self::get_batch( $batch_id );
			if ( is_array( $batch ) && 'generating' === sanitize_key( (string) $batch['status_key'] ) ) {
				++$active_jobs;
			}

			foreach ( self::get_articles( $batch_id ) as $article ) {
				if ( ! empty( $article['is_removed'] ) ) {
					continue;
				}

				$key = sanitize_key( (string) $article['status_key'] );
				if ( 'generated' === $key ) {
					++$articles_generated;
					if ( 'publish' === sanitize_key( (string) $article['wp_post_status'] ) ) {
						++$articles_published;
					}
				} elseif ( 'failed' === $key ) {
					++$failed_articles;
				}
			}
		}

		return array(
			'articlesGenerated' => max( 0, $articles_generated ),
			'articlesPublished' => max( 0, $articles_published ),
			'activeJobs'        => max( 0, $active_jobs ),
			'failedArticles'    => max( 0, $failed_articles ),
		);
	}

	/**
	 * @param string $saas_user_id SaaS user id.
	 * @return array{articlesGenerated:int,articlesPublished:int,activeJobs:int,failedArticles:int}
	 */
	public static function refresh_dashboard_stats( $saas_user_id ) {
		$stats = self::compute_dashboard_stats( $saas_user_id );
		self::save_dashboard_stats( $saas_user_id, $stats );
		return $stats;
	}

	/**
	 * @param string $batch_id Batch id.
	 * @return void
	 */
	public static function refresh_dashboard_stats_for_batch( $batch_id ) {
		$batch = self::get_batch( $batch_id );
		if ( ! is_array( $batch ) || empty( $batch['saas_user_id'] ) ) {
			return;
		}
		self::refresh_dashboard_stats( (string) $batch['saas_user_id'] );
	}

	/**
	 * @param string $batch_id Batch id.
	 * @param string $keyword Keyword.
	 * @param string $title Title.
	 * @param int    $post_id Post id.
	 * @return array<string,mixed>|null
	 */
	private static function find_article_for_publish( $batch_id, $keyword, $title, $post_id, $row_index = -1 ) {
		global $wpdb;

		unset( $title );

		$post_id     = absint( $post_id );
		$row_index   = (int) $row_index;
		$batch_id    = sanitize_text_field( (string) $batch_id );
		$keyword     = sanitize_text_field( (string) $keyword );
		$keyword_key = self::normalize_match_key( $keyword );

		if ( $post_id > 0 ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
			$row = $wpdb->get_row(
				$wpdb->prepare(
					'SELECT * FROM ' . self::articles_table() . ' WHERE wp_post_id = %d LIMIT 1',
					$post_id
				),
				ARRAY_A
			);
			if ( is_array( $row ) && empty( $row['is_removed'] ) ) {
				return $row;
			}
		}

		if ( '' !== $keyword_key ) {
			$scoped = self::find_generating_articles_by_keyword( $keyword_key, $batch_id );
			if ( 1 === count( $scoped ) ) {
				return $scoped[0];
			}
		}

		if ( '' !== $batch_id && $row_index >= 0 ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
			$row = $wpdb->get_row(
				$wpdb->prepare(
					'SELECT * FROM ' . self::articles_table() . ' WHERE batch_id = %s AND row_index = %d LIMIT 1',
					$batch_id,
					$row_index
				),
				ARRAY_A
			);
			if ( is_array( $row ) && empty( $row['is_removed'] ) ) {
				return $row;
			}
		}

		return null;
	}

	/**
	 * Exact keyword match among still-Generating rows (SaaS cron sends `keyword`).
	 *
	 * @param string $keyword_key Normalized keyword.
	 * @param string $batch_id    Optional batch scope.
	 * @return array<int,array<string,mixed>>
	 */
	private static function find_generating_articles_by_keyword( $keyword_key, $batch_id = '' ) {
		$keyword_key = self::normalize_match_key( $keyword_key );
		$batch_id    = sanitize_text_field( (string) $batch_id );
		if ( '' === $keyword_key ) {
			return array();
		}

		$matches = array();
		$rows    = '' !== $batch_id
			? self::get_articles( $batch_id )
			: self::get_all_generating_articles();

		foreach ( $rows as $candidate ) {
			if ( ! empty( $candidate['is_removed'] ) || 'generating' !== sanitize_key( (string) $candidate['status_key'] ) ) {
				continue;
			}
			if ( absint( $candidate['wp_post_id'] ) > 0 ) {
				continue;
			}
			if ( self::normalize_match_key( (string) $candidate['keyword'] ) !== $keyword_key ) {
				continue;
			}
			$matches[] = $candidate;
		}

		return $matches;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private static function get_all_generating_articles() {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
		$rows = $wpdb->get_results(
			'SELECT * FROM ' . self::articles_table() . " WHERE status_key = 'generating' AND is_removed = 0 ORDER BY updated_at DESC",
			ARRAY_A
		);

		return is_array( $rows ) ? $rows : array();
	}

	/**
	 * @param string $value Raw string.
	 * @return string
	 */
	private static function normalize_match_key( $value ) {
		$plain = trim( wp_strip_all_tags( (string) $value ) );
		$plain = html_entity_decode( $plain, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		return strtolower( $plain );
	}

	/**
	 * @param string $batch_id Batch id.
	 * @param int    $row_index Row index.
	 * @return void
	 */
	public static function mark_article_removed( $batch_id, $row_index ) {
		global $wpdb;

		$batch_id  = sanitize_text_field( (string) $batch_id );
		$row_index = (int) $row_index;
		if ( '' === $batch_id || $row_index < 0 ) {
			return;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
		$wpdb->query(
			$wpdb->prepare(
				'UPDATE ' . self::articles_table() . ' SET is_removed = 1, status_key = %s, status_label = %s, wp_post_id = 0, wp_post_status = %s WHERE batch_id = %s AND row_index = %d',
				'removed',
				__( 'Removed', 'whoneedsawriter' ),
				'',
				$batch_id,
				$row_index
			)
		);

		self::recompute_batch_status( $batch_id );
		self::refresh_dashboard_stats_for_batch( $batch_id );
	}

	/**
	 * @param string $batch_id Batch id.
	 * @param string $title Title.
	 * @param int    $post_id Post id.
	 * @return void
	 */
	public static function mark_article_removed_by_identity( $batch_id, $title, $post_id = 0 ) {
		$articles = self::get_articles( $batch_id );
		$title_key = self::normalize_match_key( $title );
		$post_id   = absint( $post_id );

		foreach ( $articles as $idx => $article ) {
			$match = false;
			if ( $post_id > 0 && absint( $article['wp_post_id'] ) === $post_id ) {
				$match = true;
			} elseif ( '' !== $title_key && self::normalize_match_key( (string) $article['title'] ) === $title_key ) {
				$match = true;
			}
			if ( $match ) {
				self::mark_article_removed( $batch_id, (int) $article['row_index'] );
				return;
			}
		}
	}

	/**
	 * Recompute batch status from stored article rows.
	 *
	 * @param string $batch_id Batch id.
	 * @return void
	 */
	public static function recompute_batch_status( $batch_id ) {
		global $wpdb;

		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' === $batch_id ) {
			return;
		}

		$articles = self::get_articles( $batch_id );
		if ( empty( $articles ) ) {
			return;
		}

		$keys            = array();
		$articles_total  = 0;
		$completed_count = 0;
		$pending_count   = 0;
		$failed_count    = 0;

		foreach ( $articles as $article ) {
			if ( ! empty( $article['is_removed'] ) ) {
				$keys[] = 'removed';
				continue;
			}

			++$articles_total;
			$key = sanitize_key( (string) $article['status_key'] );
			$keys[] = $key;

			if ( 'generated' === $key ) {
				++$completed_count;
			} elseif ( 'failed' === $key ) {
				++$failed_count;
			} else {
				++$pending_count;
			}
		}

		$display = self::resolve_batch_status_from_article_keys( $keys, $articles_total );

		$wpdb->update(
			self::batches_table(),
			array(
				'status_key'         => $display['key'],
				'status_label'       => $display['label'],
				'status_int'         => 'generated' === $display['key'] ? 1 : ( in_array( $display['key'], array( 'failed', 'removed' ), true ) ? 2 : 0 ),
				'articles_total'     => max( 0, $articles_total ),
				'articles_completed' => max( 0, $completed_count ),
				'articles_pending'   => max( 0, $pending_count ),
				'failed_articles'    => max( 0, $failed_count ),
			),
			array( 'batch_id' => $batch_id )
		);
	}

	/**
	 * @param string[] $article_status_keys Status keys.
	 * @param int      $articles_total Total articles.
	 * @return array{key: string, label: string}
	 */
	public static function resolve_batch_status_from_article_keys( array $article_status_keys, $articles_total = 0 ) {
		unset( $articles_total );

		$total      = count( $article_status_keys );
		$removed    = 0;
		$failed     = 0;
		$generating = 0;
		$generated  = 0;

		if ( 0 === $total ) {
			return array(
				'key'   => 'generating',
				'label' => __( 'Generating', 'whoneedsawriter' ),
			);
		}

		foreach ( $article_status_keys as $key ) {
			$key = sanitize_key( (string) $key );
			if ( 'removed' === $key ) {
				++$removed;
			} elseif ( 'failed' === $key ) {
				++$failed;
			} elseif ( 'generated' === $key ) {
				++$generated;
			} else {
				++$generating;
			}
		}

		if ( $removed === $total ) {
			return array(
				'key'   => 'removed',
				'label' => __( 'Removed', 'whoneedsawriter' ),
			);
		}

		if ( $failed === $total ) {
			return array(
				'key'   => 'failed',
				'label' => __( 'Failed', 'whoneedsawriter' ),
			);
		}

		if ( $generating === $total ) {
			return array(
				'key'   => 'generating',
				'label' => __( 'Generating', 'whoneedsawriter' ),
			);
		}

		if ( $generated >= 1 && 0 === $generating ) {
			return array(
				'key'   => 'generated',
				'label' => __( 'Generated', 'whoneedsawriter' ),
			);
		}

		if ( $generating > 0 ) {
			return array(
				'key'   => 'generating',
				'label' => __( 'Generating', 'whoneedsawriter' ),
			);
		}

		return array(
			'key'   => 'failed',
			'label' => __( 'Failed', 'whoneedsawriter' ),
		);
	}

	/**
	 * @param array<string,mixed> $db_row DB row.
	 * @return array<string,mixed>
	 */
	public static function db_batch_to_normalized( array $db_row ) {
		return array(
			'id'                => isset( $db_row['batch_id'] ) ? (string) $db_row['batch_id'] : '',
			'name'              => self::resolve_batch_display_name( $db_row ),
			'articles'          => isset( $db_row['articles_total'] ) ? (int) $db_row['articles_total'] : 0,
			'completedArticles' => isset( $db_row['articles_completed'] ) ? (int) $db_row['articles_completed'] : 0,
			'pendingArticles'   => isset( $db_row['articles_pending'] ) ? (int) $db_row['articles_pending'] : 0,
			'failedArticles'    => isset( $db_row['failed_articles'] ) ? (int) $db_row['failed_articles'] : 0,
			'statusInt'         => isset( $db_row['status_int'] ) ? (int) $db_row['status_int'] : 0,
			'statusKey'         => isset( $db_row['status_key'] ) ? (string) $db_row['status_key'] : 'generating',
			'statusLabel'       => isset( $db_row['status_label'] ) ? (string) $db_row['status_label'] : '',
			'createdAt'         => isset( $db_row['saas_created_at'] ) ? (string) $db_row['saas_created_at'] : '',
		);
	}

	/**
	 * @param array<string,mixed> $db_row DB row.
	 * @return array<string,mixed>
	 */
	public static function db_article_to_normalized( array $db_row ) {
		$status_key = ! empty( $db_row['is_removed'] ) ? 'removed' : (string) $db_row['status_key'];
		$status_label = ! empty( $db_row['is_removed'] )
			? __( 'Removed', 'whoneedsawriter' )
			: (string) $db_row['status_label'];

		$wp_post_id = absint( $db_row['wp_post_id'] );
		$edit_url   = '';
		if ( $wp_post_id > 0 && 'removed' !== $status_key ) {
			$edit_url = get_edit_post_link( $wp_post_id, 'raw' );
			$edit_url = is_string( $edit_url ) ? $edit_url : '';
		}

		return array(
			'keyword'       => (string) $db_row['keyword'],
			'title'         => (string) $db_row['title'],
			'statusInt'     => (int) $db_row['status_int'],
			'statusKey'     => $status_key,
			'statusLabel'   => $status_label,
			'isPublished'   => in_array( (string) $db_row['wp_post_status'], array( 'publish', 'future' ), true ),
			'wpPostStatus'  => (string) $db_row['wp_post_status'],
			'wpPostId'      => $wp_post_id,
			'editPostUrl'   => $edit_url,
			'batchId'       => (string) $db_row['batch_id'],
			'scheduledTime' => (string) $db_row['scheduled_time'],
			'model'         => (string) $db_row['model'],
			'category'      => (string) $db_row['category'],
			'author'        => (string) $db_row['author'],
		);
	}

	/**
	 * @param string $saas_user_id SaaS user id.
	 * @param array<string,int> $stats Stats without credits.
	 * @return void
	 */
	public static function save_dashboard_stats( $saas_user_id, array $stats ) {
		global $wpdb;

		$saas_user_id = sanitize_text_field( (string) $saas_user_id );
		if ( '' === $saas_user_id ) {
			return;
		}

		$data = array(
			'saas_user_id'       => $saas_user_id,
			'articles_generated' => isset( $stats['articlesGenerated'] ) ? (int) $stats['articlesGenerated'] : 0,
			'articles_published' => isset( $stats['articlesPublished'] ) ? (int) $stats['articlesPublished'] : 0,
			'active_jobs'        => isset( $stats['activeJobs'] ) ? (int) $stats['activeJobs'] : 0,
			'failed_articles'    => isset( $stats['failedArticles'] ) ? (int) $stats['failedArticles'] : 0,
		);

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
		$existing = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . self::stats_table() . ' WHERE saas_user_id = %s LIMIT 1',
				$saas_user_id
			)
		);

		if ( $existing ) {
			$wpdb->update( self::stats_table(), $data, array( 'saas_user_id' => $saas_user_id ) );
			return;
		}

		$wpdb->insert( self::stats_table(), $data );
	}

	/**
	 * @param string $saas_user_id SaaS user id.
	 * @return array<string,int>|null
	 */
	public static function get_dashboard_stats( $saas_user_id ) {
		global $wpdb;

		$saas_user_id = sanitize_text_field( (string) $saas_user_id );
		if ( '' === $saas_user_id ) {
			return null;
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name is controlled.
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::stats_table() . ' WHERE saas_user_id = %s LIMIT 1',
				$saas_user_id
			),
			ARRAY_A
		);

		if ( ! is_array( $row ) ) {
			return null;
		}

		return array(
			'articlesGenerated' => (int) $row['articles_generated'],
			'articlesPublished' => (int) $row['articles_published'],
			'activeJobs'        => (int) $row['active_jobs'],
			'failedArticles'    => (int) $row['failed_articles'],
		);
	}

	/**
	 * Optimistic batch row at generation start.
	 *
	 * @param string              $saas_user_id SaaS user id.
	 * @param string              $batch_id Batch id.
	 * @param int                 $article_count Keyword count.
	 * @param array<string,mixed> $settings Optional settings snapshot.
	 * @return void
	 */
	public static function seed_generation_batch( $saas_user_id, $batch_id, $article_count, array $settings = array() ) {
		$batch_id = sanitize_text_field( (string) $batch_id );
		if ( '' === $batch_id ) {
			return;
		}

		$name = '';
		if ( ! empty( $settings['batch_display_name'] ) ) {
			$candidate = sanitize_text_field( (string) $settings['batch_display_name'] );
			if ( ! self::is_batch_name_placeholder( $candidate, $batch_id ) ) {
				$name = $candidate;
			}
		}

		self::upsert_batch_row(
			$saas_user_id,
			array(
				'id'                => $batch_id,
				'name'              => $name,
				'articles'          => max( 1, (int) $article_count ),
				'completedArticles' => 0,
				'pendingArticles'   => max( 1, (int) $article_count ),
				'failedArticles'    => 0,
				'statusInt'         => 0,
				'statusKey'         => 'generating',
				'statusLabel'       => __( 'Generating', 'whoneedsawriter' ),
				'createdAt'         => gmdate( 'mdy' ),
			)
		);

		if ( ! empty( $settings ) ) {
			self::save_batch_settings( $batch_id, $settings );
		}
	}

	/**
	 * True when a stored name is empty or just the batch id (not a SaaS batch name).
	 *
	 * @param string $name     Candidate display name.
	 * @param string $batch_id Batch id.
	 * @return bool
	 */
	public static function is_batch_name_placeholder( $name, $batch_id ) {
		$name     = self::batch_name_compare_key( $name );
		$batch_id = strtolower( trim( (string) $batch_id ) );

		return '' === $name || ( '' !== $batch_id && $name === $batch_id );
	}

	/**
	 * True when $current is the same base name as $incoming but with a SaaS uniqueness suffix.
	 *
	 * @param string $current  Existing stored name (e.g. WNAW-061226-2).
	 * @param string $incoming Incoming name (e.g. WNAW-061226).
	 * @return bool
	 */
	public static function is_more_specific_batch_name( $current, $incoming ) {
		$current_key  = self::batch_name_compare_key( $current );
		$incoming_key = self::batch_name_compare_key( $incoming );

		if ( '' === $current_key || '' === $incoming_key || $current_key === $incoming_key ) {
			return false;
		}

		return 0 === strpos( $current_key, $incoming_key ) && strlen( $current_key ) > strlen( $incoming_key );
	}

	/**
	 * @param string $name Raw batch name.
	 * @return string
	 */
	public static function batch_name_compare_key( $name ) {
		return strtolower( trim( ltrim( trim( (string) $name ), '#' ) ) );
	}

	/**
	 * Resolve the human-readable batch name for jobs list / job detail UI.
	 *
	 * @param array<string,mixed> $db_row Batch DB row.
	 * @return string
	 */
	public static function resolve_batch_display_name( array $db_row ) {
		global $wpdb;

		$batch_id = isset( $db_row['batch_id'] ) ? sanitize_text_field( (string) $db_row['batch_id'] ) : '';
		$stored   = isset( $db_row['batch_name'] ) ? sanitize_text_field( (string) $db_row['batch_name'] ) : '';

		if ( '' !== $stored && ! self::is_batch_name_placeholder( $stored, $batch_id ) ) {
			return $stored;
		}

		$settings = null;
		if ( ! empty( $db_row['settings_json'] ) ) {
			$decoded = json_decode( (string) $db_row['settings_json'], true );
			if ( is_array( $decoded ) ) {
				$settings = $decoded;
			}
		}
		if ( ! is_array( $settings ) && '' !== $batch_id ) {
			$settings = self::get_batch_settings( $batch_id );
		}

		if ( is_array( $settings ) && ! empty( $settings['batch_display_name'] ) ) {
			$from_settings = sanitize_text_field( (string) $settings['batch_display_name'] );
			if ( '' !== $from_settings && ! self::is_batch_name_placeholder( $from_settings, $batch_id ) ) {
				if ( '' !== $batch_id ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
					$wpdb->update(
						self::batches_table(),
						array( 'batch_name' => $from_settings ),
						array( 'batch_id' => $batch_id )
					);
				}
				return $from_settings;
			}
		}

		return '';
	}
}
