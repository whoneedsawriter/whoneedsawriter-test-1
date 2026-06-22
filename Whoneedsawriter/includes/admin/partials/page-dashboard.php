<?php
/**
 * Admin page: Dashboard.
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** @var string $jobs_url Jobs admin screen URL. */
if ( ! isset( $jobs_url ) || ! is_string( $jobs_url ) ) {
	$jobs_url = admin_url( 'admin.php?page=whoneedsawriter-jobs' );
}

/** @var string $generate_url Generate Article admin screen URL. */
if ( ! isset( $generate_url ) || ! is_string( $generate_url ) ) {
	$generate_url = admin_url( 'admin.php?page=whoneedsawriter-generate' );
}

/** @var string $settings_url Settings admin screen URL. */
if ( ! isset( $settings_url ) || ! is_string( $settings_url ) ) {
	$settings_url = admin_url( 'admin.php?page=whoneedsawriter-settings' );
}

/** @var string $dashboard_credits_display Formatted credits or em dash (from server + JS refresh). */
if ( ! isset( $dashboard_credits_display ) || ! is_string( $dashboard_credits_display ) ) {
	$dashboard_credits_display = '—';
}

/** @var string $wnaw_buy_credits_url SaaS pricing URL with userId and website. */
if ( ! isset( $wnaw_buy_credits_url ) || ! is_string( $wnaw_buy_credits_url ) ) {
	$wnaw_buy_credits_url = Whoneedsawriter_Admin::PRICING_URL;
}

$wnaw_gen_raw            = isset( $_GET['wnaw_gen'] ) ? wp_unslash( $_GET['wnaw_gen'] ) : '';
$wnaw_gen_started_notice = false;
if ( is_scalar( $wnaw_gen_raw ) ) {
	$wnaw_gen_started_notice = ( '1' === sanitize_text_field( (string) $wnaw_gen_raw ) );
}

$wnaw_connected_raw    = isset( $_GET['wnaw_connected'] ) ? wp_unslash( $_GET['wnaw_connected'] ) : '';
$wnaw_connected_notice = false;
if ( is_scalar( $wnaw_connected_raw ) ) {
	$wnaw_connected_notice = ( '1' === sanitize_text_field( (string) $wnaw_connected_raw ) );
}

$wnaw_payment_notice = '';
$wnaw_payment_raw    = isset( $_GET['payment'] ) ? wp_unslash( $_GET['payment'] ) : '';
$wnaw_type_raw       = isset( $_GET['type'] ) ? wp_unslash( $_GET['type'] ) : '';
$wnaw_plan_raw       = isset( $_GET['plan'] ) ? wp_unslash( $_GET['plan'] ) : '';

if ( is_scalar( $wnaw_payment_raw ) && 'success' === sanitize_text_field( (string) $wnaw_payment_raw ) ) {
	if ( class_exists( 'Whoneedsawriter_Admin' ) ) {
		$wnaw_payment_uid = '';
		global $wpdb;
		$wnaw_table = $wpdb->prefix . 'wnaw_user';
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- table from prefix + literal.
		$wnaw_payment_uid = (string) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT userId FROM {$wnaw_table} WHERE otp_verified = %d ORDER BY updated_at DESC LIMIT 1",
				1
			)
		);
		Whoneedsawriter_Admin::invalidate_user_caches( sanitize_text_field( $wnaw_payment_uid ) );
	}

	$type = is_scalar( $wnaw_type_raw ) ? strtolower( sanitize_text_field( (string) $wnaw_type_raw ) ) : '';
	$plan = is_scalar( $wnaw_plan_raw ) ? sanitize_text_field( (string) $wnaw_plan_raw ) : '';
	$plan = trim( $plan );
	$plan_key = strtolower( $plan );

	$credits = 0;

	if ( 'lifetime' === $type ) {
		$map = array(
			'pro'      => 30,
			'premium'  => 75,
			'ultimate' => 250,
		);
		if ( isset( $map[ $plan_key ] ) ) {
			$credits = (int) $map[ $plan_key ];
		}
		if ( $credits > 0 ) {
			/* translators: %d = credits */
			$wnaw_payment_notice = sprintf( __( '%d credits have been added to your account.', 'whoneedsawriter' ), $credits );
		}
	} elseif ( 'subscription' === $type ) {
		$map = array(
			'starter'  => 5,
			'pro'      => 20,
			'premium'  => 60,
			'ultimate' => 200,
		);
		if ( isset( $map[ $plan_key ] ) ) {
			$credits = (int) $map[ $plan_key ];
		}
		if ( $credits > 0 ) {
			/* translators: %d = credits */
			$wnaw_payment_notice = sprintf( __( 'Monthly plan of %d credits is now active on your account.', 'whoneedsawriter' ), $credits );
		}
	}
}
?>

<div class="wrap whoneedsawriter">
	<div class="whoneedsawriter__shell whoneedsawriter__shell--dashboard" data-wnaw-dashboard>
		<?php if ( $wnaw_connected_notice ) : ?>
			<div class="notice notice-success is-dismissible whoneedsawriter__gen-redirect-notice" role="status">
				<p><?php echo esc_html__( 'You have successfully connected your account. Welcome to Whoneedsawriter!', 'whoneedsawriter' ); ?></p>
			</div>
		<?php endif; ?>
		<?php if ( $wnaw_gen_started_notice ) : ?>
			<div class="notice notice-success whoneedsawriter__gen-redirect-notice" role="status">
				<p><?php echo esc_html__( 'Article Generation is in progress.', 'whoneedsawriter' ); ?></p>
			</div>
		<?php endif; ?>
		<?php if ( '' !== $wnaw_payment_notice ) : ?>
			<div class="notice notice-success" role="status">
				<p><?php echo esc_html( $wnaw_payment_notice ); ?></p>
			</div>
		<?php endif; ?>
		<div class="whoneedsawriter__topbar">
			<div>
				<h2 class="whoneedsawriter__title"><?php echo esc_html__( 'Dashboard', 'whoneedsawriter' ); ?></h2>
				<p class="whoneedsawriter__subtext whoneedsawriter__subtext--tight">
					<?php echo esc_html__( 'Credits Remaining:', 'whoneedsawriter' ); ?>
					<strong><span data-wnaw-dashboard-credits data-wnaw-account-loading="1" aria-live="polite"><?php echo esc_html__( 'Checking...', 'whoneedsawriter' ); ?></span> <?php echo esc_html__( 'Credits', 'whoneedsawriter' ); ?></strong>
				</p>
			</div>
			<div class="whoneedsawriter__topbar-actions">
				<a class="button button-primary whoneedsawriter__button" role="button" aria-disabled="true" data-wnaw-account-cta data-wnaw-account-loading="1">
					<span data-wnaw-cta-label><?php echo esc_html__( 'Checking account...', 'whoneedsawriter' ); ?></span>
				</a>
				<p class="whoneedsawriter__account-message" data-wnaw-account-message hidden></p>
			</div>
		</div>

		<p class="notice notice-alt whoneedsawriter__dash-notice" data-wnaw-dashboard-notice hidden role="status"></p>

		<div class="whoneedsawriter__stats" data-wnaw-dashboard-stats>
			<div class="whoneedsawriter__stat">
				<div class="whoneedsawriter__stat-label"><?php echo esc_html__( 'Articles Generated', 'whoneedsawriter' ); ?></div>
				<div class="whoneedsawriter__stat-value" data-wnaw-dashboard-articles-generated aria-live="polite">—</div>
			</div>
			<div class="whoneedsawriter__stat">
				<div class="whoneedsawriter__stat-label"><?php echo esc_html__( 'Articles Published', 'whoneedsawriter' ); ?></div>
				<div class="whoneedsawriter__stat-value" data-wnaw-dashboard-articles-published aria-live="polite">—</div>
			</div>
			<div class="whoneedsawriter__stat">
				<div class="whoneedsawriter__stat-label"><?php echo esc_html__( 'Active Jobs', 'whoneedsawriter' ); ?></div>
				<div class="whoneedsawriter__stat-value" data-wnaw-dashboard-active-jobs aria-live="polite">—</div>
			</div>
			<div class="whoneedsawriter__stat">
				<div class="whoneedsawriter__stat-label"><?php echo esc_html__( 'Failed Articles', 'whoneedsawriter' ); ?></div>
				<div class="whoneedsawriter__stat-value" data-wnaw-dashboard-failed-jobs aria-live="polite">—</div>
			</div>
		</div>

		<div class="whoneedsawriter__card">
			<div class="whoneedsawriter__card-title"><?php echo esc_html__( 'Quick Actions', 'whoneedsawriter' ); ?></div>
			<div class="whoneedsawriter__card-body">
				<div class="whoneedsawriter__action-grid">
					<a class="whoneedsawriter__action whoneedsawriter__action--batch" href="<?php echo esc_url( $generate_url ); ?>" data-wnaw-trial-gate>
						<span class="dashicons dashicons-plus-alt2" aria-hidden="true"></span>
						<span><?php echo esc_html__( 'Generate Articles', 'whoneedsawriter' ); ?></span>
					</a>
					<a class="whoneedsawriter__action whoneedsawriter__action--jobs" href="<?php echo esc_url( $jobs_url ); ?>">
						<span class="dashicons dashicons-list-view" aria-hidden="true"></span>
						<span><?php echo esc_html__( 'View Jobs', 'whoneedsawriter' ); ?></span>
					</a>
					<a class="whoneedsawriter__action whoneedsawriter__action--settings" href="<?php echo esc_url( $settings_url ); ?>">
						<span class="dashicons dashicons-admin-generic" aria-hidden="true"></span>
						<span><?php echo esc_html__( 'Settings', 'whoneedsawriter' ); ?></span>
					</a>
				</div>
			</div>
		</div>
	</div>
</div>
