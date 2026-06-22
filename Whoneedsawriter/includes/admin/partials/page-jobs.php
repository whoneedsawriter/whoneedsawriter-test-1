<?php
/**
 * Admin page: Jobs (batches list from SaaS).
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wnaw_jobs_detail_base_url = add_query_arg( 'page', 'whoneedsawriter-jobs', admin_url( 'admin.php' ) );
?>

<div class="wrap whoneedsawriter">
	<div
		class="whoneedsawriter__shell whoneedsawriter__shell--jobs whoneedsawriter__shell--batches"
		data-wnaw-jobs
		data-wnaw-jobs-detail-url="<?php echo esc_url( $wnaw_jobs_detail_base_url ); ?>"
	>
		<div class="whoneedsawriter__topbar whoneedsawriter__topbar--batches">
			<div>
				<h1 class="whoneedsawriter__title whoneedsawriter__title--autoblog"><?php echo esc_html__( 'List of Jobs', 'whoneedsawriter' ); ?></h1>
				<p class="whoneedsawriter__subtext whoneedsawriter__subtext--tight">
					<?php echo esc_html__( 'Track every Jobs you have submitted and its generation progress.', 'whoneedsawriter' ); ?>
				</p>
			</div>
			<div class="whoneedsawriter__topbar-actions whoneedsawriter__topbar-actions--autoblog">
				<button
					type="button"
					class="whoneedsawriter__icon-btn whoneedsawriter__jobs-refresh"
					data-wnaw-jobs-refresh
					aria-label="<?php echo esc_attr__( 'Refresh', 'whoneedsawriter' ); ?>"
					title="<?php echo esc_attr__( 'Refresh', 'whoneedsawriter' ); ?>"
				>
					<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
						<path d="M21 12a9 9 0 1 1-3.4-7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
						<path d="M21 4v5h-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
			</div>
		</div>

		<p class="notice notice-alt whoneedsawriter__jobs-notice" data-wnaw-jobs-notice hidden role="alert"></p>

		<div class="whoneedsawriter__jobs-card whoneedsawriter__jobs-card--batches">
			<div class="whoneedsawriter__jobs-table-wrap">
				<table class="whoneedsawriter__jobs-table whoneedsawriter__jobs-table--batches" aria-describedby="wnaw-jobs-caption">
					<caption id="wnaw-jobs-caption" class="screen-reader-text">
						<?php echo esc_html__( 'Article generation batches', 'whoneedsawriter' ); ?>
					</caption>
					<thead>
						<tr>
							<th scope="col" class="whoneedsawriter__jobs-col-num"><?php echo esc_html__( '#', 'whoneedsawriter' ); ?></th>
							<th scope="col"><?php echo esc_html__( 'Job ID', 'whoneedsawriter' ); ?></th>
							<th scope="col" class="whoneedsawriter__jobs-col-articles"><?php echo esc_html__( 'Articles Generated', 'whoneedsawriter' ); ?></th>
							<th scope="col" class="whoneedsawriter__jobs-col-status"><?php echo esc_html__( 'Status', 'whoneedsawriter' ); ?></th>
							<th scope="col" class="whoneedsawriter__jobs-col-created"><?php echo esc_html__( 'Created', 'whoneedsawriter' ); ?></th>
						</tr>
					</thead>
					<tbody data-wnaw-jobs-tbody>
						<tr class="whoneedsawriter__jobs-loading" data-wnaw-jobs-loading>
							<td colspan="5">
								<span class="whoneedsawriter__jobs-loading-inner">
									<svg class="whoneedsawriter__spinner" viewBox="0 0 50 50" focusable="false" aria-hidden="true">
										<circle class="whoneedsawriter__spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
									</svg>
									<span><?php echo esc_html__( 'Loading batches…', 'whoneedsawriter' ); ?></span>
								</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>
