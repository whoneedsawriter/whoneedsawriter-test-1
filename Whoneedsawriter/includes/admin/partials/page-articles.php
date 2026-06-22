<?php
/**
 * Admin page: All Articles (cross-batch view).
 *
 * Reuses the SaaS articles endpoint without a batchId so the full per-user
 * article list is returned. Same row shape as the per-job articles table.
 *
 * @var string $wnaw_jobs_list_url URL back to the jobs list.
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wnaw_jobs_list_url = isset( $wnaw_jobs_list_url ) ? (string) $wnaw_jobs_list_url : add_query_arg( 'page', 'whoneedsawriter-jobs', admin_url( 'admin.php' ) );
?>

<div class="wrap whoneedsawriter">
	<div
		class="whoneedsawriter__shell whoneedsawriter__shell--job-detail whoneedsawriter__shell--articles-all"
		data-wnaw-articles-all-root
	>
		<div class="whoneedsawriter__jd-back">
			<a class="whoneedsawriter__jd-back-link" href="<?php echo esc_url( $wnaw_jobs_list_url ); ?>">
				<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
					<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span><?php echo esc_html__( 'Back to Jobs', 'whoneedsawriter' ); ?></span>
			</a>
		</div>

		<div class="whoneedsawriter__jd-header">
			<div class="whoneedsawriter__jd-header-main">
				<div class="whoneedsawriter__jd-titlerow">
					<h1 class="whoneedsawriter__jd-title">
						<?php echo esc_html__( 'All Articles', 'whoneedsawriter' ); ?>
					</h1>
				</div>
				<p class="whoneedsawriter__jd-submitted">
					<?php echo esc_html__( 'Every article ever generated on this site, across all jobs.', 'whoneedsawriter' ); ?>
				</p>
			</div>
			<div class="whoneedsawriter__jd-header-actions">
				<button type="button" class="whoneedsawriter__jd-actionbtn whoneedsawriter__jd-actionbtn--refresh" data-wnaw-articles-refresh>
					<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
						<path d="M21 12a9 9 0 1 1-3.4-7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
						<path d="M21 4v5h-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span><?php echo esc_html__( 'Refresh', 'whoneedsawriter' ); ?></span>
				</button>
			</div>
		</div>

		<p class="notice notice-alt whoneedsawriter__jd-notice" data-wnaw-articles-notice hidden role="alert"></p>

		<section class="whoneedsawriter__jd-card whoneedsawriter__jd-articles whoneedsawriter__jd-articles--full">
			<header class="whoneedsawriter__jd-articles-head">
				<h2 class="whoneedsawriter__jd-section-title">
					<?php echo esc_html__( 'Articles', 'whoneedsawriter' ); ?>
					<span class="whoneedsawriter__jd-articles-count" data-wnaw-articles-count></span>
				</h2>
			</header>

			<div class="whoneedsawriter__jd-table-wrap">
				<table class="whoneedsawriter__jd-table">
					<thead>
						<tr>
							<th scope="col" class="whoneedsawriter__jd-col-num">#</th>
							<th scope="col"><?php echo esc_html__( 'Article Title', 'whoneedsawriter' ); ?></th>
							<th scope="col" class="whoneedsawriter__jd-col-status"><?php echo esc_html__( 'Status', 'whoneedsawriter' ); ?></th>
							<th scope="col" class="whoneedsawriter__jd-col-time"><?php echo esc_html__( 'Scheduled Time', 'whoneedsawriter' ); ?></th>
							<th scope="col" class="whoneedsawriter__jd-col-actions"><span class="screen-reader-text"><?php echo esc_html__( 'Actions', 'whoneedsawriter' ); ?></span></th>
						</tr>
					</thead>
					<tbody data-wnaw-articles-tbody>
						<tr class="whoneedsawriter__jd-articles-loading">
							<td colspan="5">
								<span class="whoneedsawriter__jobs-loading-inner">
									<svg class="whoneedsawriter__spinner" viewBox="0 0 50 50" focusable="false" aria-hidden="true">
										<circle class="whoneedsawriter__spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
									</svg>
									<span><?php echo esc_html__( 'Loading articles…', 'whoneedsawriter' ); ?></span>
								</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>
	</div>
</div>
