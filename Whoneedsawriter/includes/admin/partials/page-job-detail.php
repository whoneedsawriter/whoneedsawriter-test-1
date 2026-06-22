<?php
/**
 * Admin page: Job Detail (populated via admin.js + SaaS AJAX).
 *
 * Expected variables provided by the parent renderer:
 *
 * @var string $wnaw_job_id          Sanitized job/batch id from the query string.
 * @var string $wnaw_jobs_list_url   URL back to the jobs list.
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wnaw_job_id        = isset( $wnaw_job_id ) ? (string) $wnaw_job_id : '';
$wnaw_jobs_list_url = isset( $wnaw_jobs_list_url ) ? (string) $wnaw_jobs_list_url : add_query_arg( 'page', 'whoneedsawriter-jobs', admin_url( 'admin.php' ) );

$wnaw_job_display_name = isset( $wnaw_job_display_name ) ? (string) $wnaw_job_display_name : '';
$wnaw_job_id_display     = '' !== trim( $wnaw_job_display_name )
	? '#' . ltrim( $wnaw_job_display_name, '#' )
	: '—';

$wnaw_all_articles_url = add_query_arg(
	array(
		'page' => 'whoneedsawriter-jobs',
		'view' => 'articles',
	),
	admin_url( 'admin.php' )
);

$wnaw_settings_url = admin_url( 'admin.php?page=whoneedsawriter-settings' );
$wnaw_help_url     = 'https://whoneedsawriter.canny.io/';
?>

<div class="wrap whoneedsawriter">
	<div
		class="whoneedsawriter__shell whoneedsawriter__shell--job-detail"
		data-wnaw-jd-root
		data-wnaw-job-id="<?php echo esc_attr( $wnaw_job_id ); ?>"
		data-wnaw-jobs-list-url="<?php echo esc_url( $wnaw_jobs_list_url ); ?>"
	>

		<!-- Top: back link + title row -->
		<div class="whoneedsawriter__jd-back">
			<a class="whoneedsawriter__jd-back-link" href="<?php echo esc_url( $wnaw_jobs_list_url ); ?>">
				<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
					<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span><?php echo esc_html__( 'Back to Jobs', 'whoneedsawriter' ); ?></span>
			</a>
		</div>

		<p class="notice notice-alt whoneedsawriter__jd-notice" data-wnaw-jd-notice hidden role="alert"></p>

		<div class="whoneedsawriter__jd-header" data-wnaw-jd-header>
			<div class="whoneedsawriter__jd-header-main">
				<div class="whoneedsawriter__jd-titlerow">
					<h1 class="whoneedsawriter__jd-title whoneedsawriter__jd-title--jobid">
						<span class="whoneedsawriter__jd-title-label"><?php echo esc_html__( 'Job ID:', 'whoneedsawriter' ); ?></span>
						<span class="whoneedsawriter__jd-title-value" data-wnaw-jd-name><?php echo esc_html( $wnaw_job_id_display ); ?></span>
					</h1>
					<span
						class="whoneedsawriter__jd-status"
						data-wnaw-jd-status
						data-label-in-progress="<?php echo esc_attr__( 'In Progress', 'whoneedsawriter' ); ?>"
						data-label-completed="<?php echo esc_attr__( 'Completed', 'whoneedsawriter' ); ?>"
						hidden
					></span>
				</div>
				<p class="whoneedsawriter__jd-submitted" data-wnaw-jd-submitted data-prefix="<?php echo esc_attr__( 'Submitted on', 'whoneedsawriter' ); ?>"></p>
			</div>
			<div class="whoneedsawriter__jd-header-actions">
				<button type="button" class="whoneedsawriter__jd-actionbtn whoneedsawriter__jd-actionbtn--help">
					<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
						<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
						<path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.25c-.9.45-1.6 1-1.6 2v.25" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
						<circle cx="12" cy="17.25" r="1" fill="currentColor"/>
					</svg>
					<a
						href="<?php echo esc_url( $wnaw_help_url ); ?>"
						target="_blank"
						rel="noopener noreferrer"
					><span><?php echo esc_html__( 'Need help?', 'whoneedsawriter' ); ?></span></a>
				</button>
			</div>
		</div>

		<!-- Stepper card -->
		<section class="whoneedsawriter__jd-card whoneedsawriter__jd-stepper-card">
			<ol class="whoneedsawriter__jd-stepper">
				<li class="whoneedsawriter__jd-step is-complete" data-wnaw-jd-step="1">
					<div class="whoneedsawriter__jd-step-head">
						<span class="whoneedsawriter__jd-step-num">1</span>
						<span class="whoneedsawriter__jd-step-title"><?php echo esc_html__( 'Job Submitted', 'whoneedsawriter' ); ?></span>
					</div>
					<p class="whoneedsawriter__jd-step-desc">
						<?php echo esc_html__( 'Your job has been received and is being processed.', 'whoneedsawriter' ); ?>
					</p>
					<div class="whoneedsawriter__jd-step-meta" data-wnaw-jd-step-meta>
						<span class="whoneedsawriter__jd-step-check" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<path d="M5 12.5l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</span>
					</div>
				</li>

				<li class="whoneedsawriter__jd-step-sep" aria-hidden="true">
					<svg viewBox="0 0 24 24" focusable="false">
						<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</li>

				<li class="whoneedsawriter__jd-step is-active" data-wnaw-jd-step="2">
					<div class="whoneedsawriter__jd-step-head">
						<span class="whoneedsawriter__jd-step-num">2</span>
						<span class="whoneedsawriter__jd-step-title"><?php echo esc_html__( 'Articles Generated', 'whoneedsawriter' ); ?></span>
					</div>
					<p class="whoneedsawriter__jd-step-desc">
						<?php echo esc_html__( 'AI is generating high-quality articles for you.', 'whoneedsawriter' ); ?>
					</p>
					<div class="whoneedsawriter__jd-step-meta" data-wnaw-jd-step-meta>
						<span class="whoneedsawriter__jd-step-pill whoneedsawriter__jd-step-pill--active">&nbsp;</span>
						<div class="whoneedsawriter__jd-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
							<span class="whoneedsawriter__jd-progress-bar" style="width: 0%"></span>
						</div>
					</div>
				</li>

				<li class="whoneedsawriter__jd-step-sep" aria-hidden="true">
					<svg viewBox="0 0 24 24" focusable="false">
						<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</li>

				<li class="whoneedsawriter__jd-step is-pending" data-wnaw-jd-step="3">
					<div class="whoneedsawriter__jd-step-head">
						<span class="whoneedsawriter__jd-step-num">3</span>
						<span class="whoneedsawriter__jd-step-title"><?php echo esc_html__( 'Scheduling & Posting', 'whoneedsawriter' ); ?></span>
					</div>
					<p class="whoneedsawriter__jd-step-desc">
						<?php echo esc_html__( 'Articles will be scheduled and posted automatically.', 'whoneedsawriter' ); ?>
					</p>
					<div class="whoneedsawriter__jd-step-meta" data-wnaw-jd-step-meta>
						<span class="whoneedsawriter__jd-step-pill whoneedsawriter__jd-step-pill--pending">
							<?php echo esc_html__( 'Pending', 'whoneedsawriter' ); ?>
						</span>
					</div>
				</li>
			</ol>
		</section>

		<!-- Hidden templates the JS uses to swap each step's meta content. -->
		<template data-wnaw-jd-tpl="meta-complete">
			<span class="whoneedsawriter__jd-step-check" aria-hidden="true">
				<svg viewBox="0 0 24 24" focusable="false">
					<path d="M5 12.5l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</span>
		</template>
		<template data-wnaw-jd-tpl="meta-active-progress">
			<span class="whoneedsawriter__jd-step-pill whoneedsawriter__jd-step-pill--active" data-wnaw-jd-progress-pill></span>
			<div class="whoneedsawriter__jd-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
				<span class="whoneedsawriter__jd-progress-bar" style="width: 0%" data-wnaw-jd-progress-bar></span>
			</div>
		</template>
		<template data-wnaw-jd-tpl="meta-pending">
			<span class="whoneedsawriter__jd-step-pill whoneedsawriter__jd-step-pill--pending"><?php echo esc_html__( 'Pending', 'whoneedsawriter' ); ?></span>
		</template>

		<!-- Info notice (visible only while generation is in progress) -->
		<div class="whoneedsawriter__jd-info" data-wnaw-jd-info-notice hidden style="display: none;">
			<div class="whoneedsawriter__jd-info-text">
				<span class="whoneedsawriter__jd-info-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" focusable="false">
						<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
						<path d="M12 11v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
						<circle cx="12" cy="8" r="1" fill="currentColor"/>
					</svg>
				</span>
				<div>
					<p class="whoneedsawriter__jd-info-line is-strong">
						<?php echo esc_html__( 'This usually takes 15–20 minutes.', 'whoneedsawriter' ); ?>
					</p>
					<p class="whoneedsawriter__jd-info-line">
						<?php echo esc_html__( 'You can leave this page. We will notify you via email once it\'s completed.', 'whoneedsawriter' ); ?>
					</p>
				</div>
			</div>
			<button type="button" class="whoneedsawriter__jd-actionbtn whoneedsawriter__jd-actionbtn--refresh" data-wnaw-jd-refresh>
				<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
					<path d="M21 12a9 9 0 1 1-3.4-7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
					<path d="M21 4v5h-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span data-wnaw-jd-refresh-label><?php echo esc_html__( 'Refresh Status', 'whoneedsawriter' ); ?></span>
			</button>
		</div>

		<!-- Two-column body -->
		<div class="whoneedsawriter__jd-body">

			<!-- Left: Job Settings -->
			<aside class="whoneedsawriter__jd-card whoneedsawriter__jd-settings" data-wnaw-jd-settings>
				<header class="whoneedsawriter__jd-settings-head">
					<h2 class="whoneedsawriter__jd-section-title"><?php echo esc_html__( 'Job Settings', 'whoneedsawriter' ); ?></h2>
				</header>

				<p class="whoneedsawriter__jd-settings-empty" data-wnaw-jd-settings-empty hidden>
					<?php echo esc_html__( "Settings aren't cached for this job on this device.", 'whoneedsawriter' ); ?>
				</p>

				<ul class="whoneedsawriter__jd-settings-list">
					<li class="whoneedsawriter__jd-setting">
						<span class="whoneedsawriter__jd-setting-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
								<path d="M8 8h8M8 12h8M8 16h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
							</svg>
						</span>
						<div>
							<p class="whoneedsawriter__jd-setting-label"><?php echo esc_html__( 'Model', 'whoneedsawriter' ); ?></p>
							<p class="whoneedsawriter__jd-setting-value" data-wnaw-jd-setting="model">&mdash;</p>
						</div>
					</li>

					<li class="whoneedsawriter__jd-setting">
						<span class="whoneedsawriter__jd-setting-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
								<path d="M7 9h10M7 13h10M7 17h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
							</svg>
						</span>
						<div>
							<p class="whoneedsawriter__jd-setting-label"><?php echo esc_html__( 'Word count', 'whoneedsawriter' ); ?></p>
							<p class="whoneedsawriter__jd-setting-value" data-wnaw-jd-setting="word_count">&mdash;</p>
						</div>
					</li>

					<li class="whoneedsawriter__jd-setting">
						<span class="whoneedsawriter__jd-setting-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V5a2 2 0 0 1 2-2h8l7.6 7.6a2 2 0 0 1 0 2.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
								<circle cx="8" cy="8" r="1.4" fill="currentColor"/>
							</svg>
						</span>
						<div>
							<p class="whoneedsawriter__jd-setting-label">
								<?php echo esc_html__( 'Keywords', 'whoneedsawriter' ); ?>
								(<span data-wnaw-jd-setting="keywords_count">0</span>)
							</p>
							<ul class="whoneedsawriter__jd-setting-bullets" data-wnaw-jd-setting-list="keywords">
								<li class="whoneedsawriter__jd-setting-bullets-empty">&mdash;</li>
							</ul>
						</div>
					</li>

					<li class="whoneedsawriter__jd-setting">
						<span class="whoneedsawriter__jd-setting-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.6"/>
								<path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
							</svg>
						</span>
						<div>
							<p class="whoneedsawriter__jd-setting-label"><?php echo esc_html__( 'Authors', 'whoneedsawriter' ); ?></p>
							<p class="whoneedsawriter__jd-setting-value" data-wnaw-jd-setting="authors">&mdash;</p>
						</div>
					</li>

					<li class="whoneedsawriter__jd-setting">
						<span class="whoneedsawriter__jd-setting-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false">
								<path d="M4 12h16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
								<path d="M14 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</span>
						<div>
							<p class="whoneedsawriter__jd-setting-label"><?php echo esc_html__( 'Publish mode', 'whoneedsawriter' ); ?></p>
							<p class="whoneedsawriter__jd-setting-value" data-wnaw-jd-setting="publish_mode">&mdash;</p>
						</div>
					</li>
				</ul>
			</aside>

			<!-- Right: Generated Articles -->
			<section class="whoneedsawriter__jd-card whoneedsawriter__jd-articles" data-wnaw-jd-articles>
				<header class="whoneedsawriter__jd-articles-head">
					<h2 class="whoneedsawriter__jd-section-title">
						<?php echo esc_html__( 'Generated Articles', 'whoneedsawriter' ); ?>
						<span class="whoneedsawriter__jd-articles-count" data-wnaw-jd-articles-count></span>
					</h2>
					<a href="<?php echo esc_url( $wnaw_all_articles_url ); ?>" class="whoneedsawriter__jd-link"><?php echo esc_html__( 'View all articles', 'whoneedsawriter' ); ?></a>
				</header>

				<div class="whoneedsawriter__jd-table-wrap">
					<table class="whoneedsawriter__jd-table" aria-busy="true">
						<thead>
							<tr>
								<th scope="col" class="whoneedsawriter__jd-col-num">#</th>
								<th scope="col"><?php echo esc_html__( 'Article Title', 'whoneedsawriter' ); ?></th>
								<th scope="col" class="whoneedsawriter__jd-col-status"><?php echo esc_html__( 'Status', 'whoneedsawriter' ); ?></th>
								<th scope="col" class="whoneedsawriter__jd-col-time"><?php echo esc_html__( 'Scheduled Time', 'whoneedsawriter' ); ?></th>
								<th scope="col" class="whoneedsawriter__jd-col-actions"><span class="screen-reader-text"><?php echo esc_html__( 'Actions', 'whoneedsawriter' ); ?></span></th>
							</tr>
						</thead>
						<tbody data-wnaw-jd-articles-tbody aria-live="polite"></tbody>
					</table>
				</div>
			</section>
		</div>
	</div>
</div>
