<?php
/**
 * Admin page: Generate Article (placeholder).
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$s = Whoneedsawriter_Admin::merge_plugin_settings();

$m_raw               = isset( $s['default_model'] ) ? (string) $s['default_model'] : 'core';
$wnaw_initial_model = in_array( $m_raw, array( 'lite', 'core', 'pro' ), true ) ? $m_raw : 'core';

$wc_raw               = isset( $s['default_word_count'] ) ? absint( $s['default_word_count'] ) : 1500;
$wc_raw               = min( 3000, max( 0, $wc_raw ) );
$wnaw_initial_word    = (int) round( $wc_raw / 50 ) * 50;

$wnaw_model_labels       = array(
	'lite' => '1a Lite',
	'core' => '1a Core',
	'pro'  => '1a Pro',
);
$wnaw_initial_model_label = isset( $wnaw_model_labels[ $wnaw_initial_model ] ) ? $wnaw_model_labels[ $wnaw_initial_model ] : '1a Core';

/** @var string $wnaw_buy_credits_url SaaS pricing URL with userId and website. */
if ( ! isset( $wnaw_buy_credits_url ) || ! is_string( $wnaw_buy_credits_url ) ) {
	$wnaw_buy_credits_url = Whoneedsawriter_Admin::PRICING_URL;
}
?>

<?php
$wnaw_settings_url = admin_url( 'admin.php?page=whoneedsawriter-settings' );
$wnaw_help_url     = 'https://whoneedsawriter.canny.io/';
?>
<div class="wrap whoneedsawriter">
	<div class="whoneedsawriter__shell whoneedsawriter__shell--dashboard whoneedsawriter__shell--autoblog">
		<div class="whoneedsawriter__topbar whoneedsawriter__topbar--autoblog">
			<div>
				<h1 class="whoneedsawriter__title whoneedsawriter__title--autoblog"><?php echo esc_html__( 'Autoblogging Setup', 'whoneedsawriter' ); ?></h1>
				<p class="whoneedsawriter__subtext whoneedsawriter__subtext--tight" style="max-width: unset;">
					<?php echo esc_html__( 'Generate high-ranking SEO articles and publish them to WordPress automatically.', 'whoneedsawriter' ); ?>
				</p>
			</div>
			<div class="whoneedsawriter__topbar-actions whoneedsawriter__topbar-actions--autoblog">
				<a
					class="whoneedsawriter__credit-pill"
					role="button"
					aria-disabled="true"
					data-wnaw-credits-badge
					data-wnaw-account-cta
					data-wnaw-account-loading="1"
					title="<?php echo esc_attr__( 'Buy more credits', 'whoneedsawriter' ); ?>"
				>
					<?php echo esc_html__( 'Credits:', 'whoneedsawriter' ); ?>&nbsp;<strong data-wnaw-credits data-wnaw-account-loading="1"><?php echo esc_html__( 'Checking...', 'whoneedsawriter' ); ?></strong>
				</a>
				<p class="whoneedsawriter__account-message" data-wnaw-account-message hidden></p>
				<a
					class="whoneedsawriter__icon-btn"
					href="<?php echo esc_url( $wnaw_help_url ); ?>"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="<?php echo esc_attr__( 'Help', 'whoneedsawriter' ); ?>"
					title="<?php echo esc_attr__( 'Help & documentation', 'whoneedsawriter' ); ?>"
				>
					<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
						<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
						<path d="M9.4 9c.2-1.6 1.4-2.6 2.9-2.6 1.7 0 2.9 1.1 2.9 2.6 0 1.5-.9 2-1.9 2.5-.9.5-1.5 1-1.5 2v.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
						<circle cx="11.85" cy="17" r="1" fill="currentColor"/>
					</svg>
				</a>
				<a
					class="whoneedsawriter__icon-btn"
					href="<?php echo esc_url( $wnaw_settings_url ); ?>"
					aria-label="<?php echo esc_attr__( 'Settings', 'whoneedsawriter' ); ?>"
					title="<?php echo esc_attr__( 'Settings', 'whoneedsawriter' ); ?>"
				>
					<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
						<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/>
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
					</svg>
				</a>
			</div>
		</div>

		<div
			class="whoneedsawriter__gen"
			data-wnaw-generate
			data-wnaw-initial-model="<?php echo esc_attr( $wnaw_initial_model ); ?>"
			data-wnaw-initial-word="<?php echo esc_attr( (string) $wnaw_initial_word ); ?>"
		>
			<div class="whoneedsawriter__gen-grid whoneedsawriter__gen-grid--autoblog">
				<div class="whoneedsawriter__gen-card whoneedsawriter__gen-card--autoblog">
					<div class="whoneedsawriter__gen-label"><?php echo esc_html__( 'Model', 'whoneedsawriter' ); ?></div>

					<input type="hidden" name="model" value="<?php echo esc_attr( $wnaw_initial_model ); ?>" data-wnaw-model-value />

					<button type="button" class="whoneedsawriter__selectbtn whoneedsawriter__selectbtn--autoblog" aria-expanded="false" data-wnaw-model-button>
						<span class="whoneedsawriter__selectbtn-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
								<path d="M12 2.6 13.6 8 19 9.6 13.6 11.2 12 16.6 10.4 11.2 5 9.6 10.4 8 12 2.6Z" fill="currentColor" opacity=".95"/>
								<path d="M18.5 14 19.4 16.6 22 17.5 19.4 18.4 18.5 21 17.6 18.4 15 17.5 17.6 16.6 18.5 14Z" fill="currentColor" opacity=".75"/>
							</svg>
						</span>
						<span class="whoneedsawriter__selectbtn-text" data-wnaw-model-selected><?php echo esc_html( $wnaw_initial_model_label ); ?></span>
						<span class="whoneedsawriter__chev" aria-hidden="true"></span>
					</button>

					<div class="whoneedsawriter__menu" role="listbox" tabindex="-1" hidden data-wnaw-model-menu>
						<button type="button" class="whoneedsawriter__menu-item" role="option" aria-selected="<?php echo 'lite' === $wnaw_initial_model ? 'true' : 'false'; ?>" data-wnaw-model="lite">
							<div class="whoneedsawriter__menu-top">
								<span class="whoneedsawriter__menu-title">1a Lite</span>
								<span class="whoneedsawriter__badge">0.1 Credit</span>
							</div>
							<div class="whoneedsawriter__menu-sub"><?php echo esc_html__( 'Simple content, no frills', 'whoneedsawriter' ); ?></div>
							<?php if ( 'lite' === $wnaw_initial_model ) : ?>
								<span class="whoneedsawriter__check" aria-hidden="true"></span>
							<?php endif; ?>
						</button>
						<button type="button" class="whoneedsawriter__menu-item" role="option" aria-selected="<?php echo 'core' === $wnaw_initial_model ? 'true' : 'false'; ?>" data-wnaw-model="core">
							<div class="whoneedsawriter__menu-top">
								<span class="whoneedsawriter__menu-title">1a Core</span>
								<span class="whoneedsawriter__badge">1 Credit</span>
							</div>
							<div class="whoneedsawriter__menu-sub"><?php echo esc_html__( 'Research-backed. Blog-ready.', 'whoneedsawriter' ); ?></div>
							<?php if ( 'core' === $wnaw_initial_model ) : ?>
								<span class="whoneedsawriter__check" aria-hidden="true"></span>
							<?php endif; ?>
						</button>
						<button type="button" class="whoneedsawriter__menu-item" role="option" aria-selected="<?php echo 'pro' === $wnaw_initial_model ? 'true' : 'false'; ?>" data-wnaw-model="pro">
							<div class="whoneedsawriter__menu-top">
								<span class="whoneedsawriter__menu-title">1a Pro</span>
								<span class="whoneedsawriter__badge">2 Credits</span>
							</div>
							<div class="whoneedsawriter__menu-sub"><?php echo esc_html__( 'PhD-level & deeply researched', 'whoneedsawriter' ); ?></div>
							<?php if ( 'pro' === $wnaw_initial_model ) : ?>
								<span class="whoneedsawriter__check" aria-hidden="true"></span>
							<?php endif; ?>
						</button>
					</div>
				</div>

				<div class="whoneedsawriter__gen-card whoneedsawriter__gen-card--autoblog">
					<div class="whoneedsawriter__gen-label"><?php echo esc_html__( 'Word count', 'whoneedsawriter' ); ?></div>
					<input type="range" min="0" max="3000" step="50" value="<?php echo esc_attr( (string) $wnaw_initial_word ); ?>" class="whoneedsawriter__range whoneedsawriter__range--autoblog" data-wnaw-word-range />
					<div class="whoneedsawriter__range-value">
						<span data-wnaw-word-value><?php echo esc_html( (string) $wnaw_initial_word ); ?></span>
					</div>
				</div>
			</div>

			<div class="whoneedsawriter__gen-form">
				<?php
				$wnaw_categories = get_categories(
					array(
						'hide_empty' => false,
						'orderby'    => 'name',
						'order'      => 'ASC',
					)
				);
				$wnaw_users      = get_users(
					array(
						'role__in' => array( 'administrator', 'editor', 'author' ),
						'orderby'  => 'display_name',
						'order'    => 'ASC',
						'fields'   => array( 'ID', 'display_name', 'user_login' ),
					)
				);

				/** Default category: WP “Default Post Category” if it exists, otherwise first category. */
				$wnaw_default_category_id = 0;
				$wp_default_cat           = absint( get_option( 'default_category' ) );
				if ( $wp_default_cat > 0 ) {
					foreach ( $wnaw_categories as $wnaw_cat_probe ) {
						if ( (int) $wnaw_cat_probe->term_id === $wp_default_cat ) {
							$wnaw_default_category_id = $wp_default_cat;
							break;
						}
					}
				}
				if ( 0 === $wnaw_default_category_id && ! empty( $wnaw_categories ) ) {
					$wnaw_default_category_id = absint( $wnaw_categories[0]->term_id );
				}

				/** Default author: current user if in list, otherwise first author in list. */
				$wnaw_default_author_id = 0;
				$wnaw_current_uid        = get_current_user_id();
				foreach ( $wnaw_users as $wnaw_u ) {
					if ( (int) $wnaw_u->ID === (int) $wnaw_current_uid ) {
						$wnaw_default_author_id = (int) $wnaw_u->ID;
						break;
					}
				}
				if ( 0 === $wnaw_default_author_id && ! empty( $wnaw_users ) ) {
					$wnaw_default_author_id = (int) $wnaw_users[0]->ID;
				}

				$scat = isset( $s['default_category_id'] ) ? absint( $s['default_category_id'] ) : 0;
				if ( $scat > 0 ) {
					foreach ( $wnaw_categories as $wnaw_cat_probe ) {
						if ( (int) $wnaw_cat_probe->term_id === $scat ) {
							$wnaw_default_category_id = $scat;
							break;
						}
					}
				}

				$sauth = isset( $s['default_author_id'] ) ? absint( $s['default_author_id'] ) : 0;
				if ( $sauth > 0 ) {
					foreach ( $wnaw_users as $wnaw_u_probe ) {
						if ( (int) $wnaw_u_probe->ID === $sauth ) {
							$wnaw_default_author_id = $sauth;
							break;
						}
					}
				}
				?>

				<div
					class="whoneedsawriter__field whoneedsawriter__kwmode"
					data-wnaw-kw-mode-root
					data-wnaw-kw-mode="bulk"
				>
					<div class="whoneedsawriter__kwmode-toggle" role="tablist" aria-label="<?php echo esc_attr__( 'Keywords mode', 'whoneedsawriter' ); ?>">
						<button type="button" class="whoneedsawriter__kwmode-pill is-on" role="tab" aria-selected="true" data-wnaw-kw-mode-btn="bulk">
							<span class="whoneedsawriter__kwmode-dot" aria-hidden="true"></span>
							<span><?php echo esc_html__( 'Bulk', 'whoneedsawriter' ); ?></span>
						</button>
						<button type="button" class="whoneedsawriter__kwmode-pill" role="tab" aria-selected="false" data-wnaw-kw-mode-btn="split">
							<span class="whoneedsawriter__kwmode-dot" aria-hidden="true"></span>
							<span><?php echo esc_html__( 'Split', 'whoneedsawriter' ); ?></span>
						</button>
					</div>

					<div
						class="whoneedsawriter__kwpanel"
						data-wnaw-kw-panel="bulk"
						data-wnaw-default-category="<?php echo esc_attr( (string) $wnaw_default_category_id ); ?>"
						data-wnaw-default-author="<?php echo esc_attr( (string) $wnaw_default_author_id ); ?>"
					>
						<div class="whoneedsawriter__kwpanel-head">
							<div class="whoneedsawriter__kwpanel-title">
								<span class="whoneedsawriter__kwpanel-icon" aria-hidden="true">
									<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
										<path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" fill="currentColor" opacity=".95"/>
										<path d="m3 12 9 4.5L21 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
										<path d="m3 16.5 9 4.5 9-4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
									</svg>
								</span>
								<span class="whoneedsawriter__kwpanel-titletext">
									<span class="whoneedsawriter__kwpanel-h"><?php echo esc_html__( 'Bulk mode', 'whoneedsawriter' ); ?></span>
									<span class="whoneedsawriter__kwpanel-sub"><?php echo esc_html__( 'Enter one keyword per line.', 'whoneedsawriter' ); ?></span>
								</span>
							</div>
						</div>

						<textarea
							class="whoneedsawriter__textarea whoneedsawriter__kw-bulk-textarea"
							rows="6"
							placeholder="<?php echo esc_attr__( "content marketing\nSEO tips\nemail automation", 'whoneedsawriter' ); ?>"
							data-wnaw-kw-bulk-textarea
						></textarea>

						<p class="whoneedsawriter__kwpanel-credits">
							<span class="whoneedsawriter__kwpanel-credits-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
									<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
									<path d="M12 7.25v9.5M14.4 9.5c-.4-.9-1.4-1.4-2.6-1.4-1.6 0-2.6.9-2.6 2.1 0 2.6 5.6 1.5 5.6 4.1 0 1.3-1.1 2.2-2.9 2.2-1.4 0-2.6-.6-3-1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
								</svg>
							</span>
							<span class="whoneedsawriter__kwpanel-credits-label"><?php echo esc_html__( 'Predicted credit usage:', 'whoneedsawriter' ); ?></span>
							<strong class="whoneedsawriter__kwpanel-credits-value" data-wnaw-kw-bulk-credits>0 <?php echo esc_html__( 'credits', 'whoneedsawriter' ); ?></strong>
							<span class="whoneedsawriter__kwpanel-eta">
								<svg class="whoneedsawriter__kwpanel-eta-icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
									<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
									<polyline points="12 7 12 12 15.5 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
								~15 <?php echo esc_html__( 'mins', 'whoneedsawriter' ); ?>
							</span>
						</p>

						<div class="whoneedsawriter__kwpanel-meta">
							<div class="whoneedsawriter__settings-field">
								<label class="whoneedsawriter__label" for="wnaw-bulk-category"><?php echo esc_html__( 'Category', 'whoneedsawriter' ); ?></label>
								<select id="wnaw-bulk-category" class="whoneedsawriter__select" data-wnaw-kw-bulk-category>
									<option value=""><?php echo esc_html__( 'Category', 'whoneedsawriter' ); ?></option>
									<?php foreach ( $wnaw_categories as $wnaw_cat ) : ?>
										<option value="<?php echo esc_attr( (string) $wnaw_cat->term_id ); ?>" <?php selected( $wnaw_default_category_id, (int) $wnaw_cat->term_id ); ?>>
											<?php echo esc_html( (string) $wnaw_cat->name ); ?>
										</option>
									<?php endforeach; ?>
								</select>
							</div>
							<div class="whoneedsawriter__settings-field">
								<label class="whoneedsawriter__label" for="wnaw-bulk-author"><?php echo esc_html__( 'Author', 'whoneedsawriter' ); ?></label>
								<select id="wnaw-bulk-author" class="whoneedsawriter__select" data-wnaw-kw-bulk-author>
									<option value=""><?php echo esc_html__( 'Author', 'whoneedsawriter' ); ?></option>
									<?php foreach ( $wnaw_users as $wnaw_user ) : ?>
										<option value="<?php echo esc_attr( (string) $wnaw_user->ID ); ?>" <?php selected( $wnaw_default_author_id, (int) $wnaw_user->ID ); ?>>
											<?php echo esc_html( (string) ( $wnaw_user->display_name ? $wnaw_user->display_name : $wnaw_user->user_login ) ); ?>
										</option>
									<?php endforeach; ?>
								</select>
							</div>
						</div>

						<p class="whoneedsawriter__muted whoneedsawriter__muted--tight"><?php echo esc_html__( 'Max 10 keywords. Category and author apply to every keyword in the batch.', 'whoneedsawriter' ); ?></p>
					</div>

					<div class="whoneedsawriter__kwpanel" data-wnaw-kw-panel="split" hidden>
						<div class="whoneedsawriter__kwpanel-head">
							<div class="whoneedsawriter__kwpanel-title">
								<span class="whoneedsawriter__kwpanel-icon" aria-hidden="true">
									<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
										<rect x="3" y="5" width="4" height="2.5" rx="1"/>
										<rect x="9" y="5" width="12" height="2.5" rx="1"/>
										<rect x="3" y="10.75" width="4" height="2.5" rx="1"/>
										<rect x="9" y="10.75" width="12" height="2.5" rx="1"/>
										<rect x="3" y="16.5" width="4" height="2.5" rx="1"/>
										<rect x="9" y="16.5" width="12" height="2.5" rx="1"/>
									</svg>
								</span>
								<span class="whoneedsawriter__kwpanel-titletext">
									<span class="whoneedsawriter__kwpanel-h"><?php echo esc_html__( 'Split mode', 'whoneedsawriter' ); ?></span>
									<span class="whoneedsawriter__kwpanel-sub"><?php echo esc_html__( 'Add keywords individually with their own category and author.', 'whoneedsawriter' ); ?></span>
								</span>
							</div>
						</div>

						<div class="whoneedsawriter__kwpanel-actions">
							<button type="button" class="whoneedsawriter__button whoneedsawriter__button--outline whoneedsawriter__kw-add" data-wnaw-kw-add>
								<span class="dashicons dashicons-plus-alt2" aria-hidden="true"></span>
								<span><?php echo esc_html__( 'Add keyword', 'whoneedsawriter' ); ?></span>
							</button>
						</div>

						<template data-wnaw-kw-template>
							<div class="whoneedsawriter__kw-row" data-wnaw-kw-row draggable="true">
								<button type="button" class="whoneedsawriter__kw-drag" aria-label="<?php echo esc_attr__( 'Drag to reorder', 'whoneedsawriter' ); ?>" data-wnaw-kw-drag>
									<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
										<circle cx="5.5" cy="3" r="1.3"/>
										<circle cx="10.5" cy="3" r="1.3"/>
										<circle cx="5.5" cy="8" r="1.3"/>
										<circle cx="10.5" cy="8" r="1.3"/>
										<circle cx="5.5" cy="13" r="1.3"/>
										<circle cx="10.5" cy="13" r="1.3"/>
									</svg>
								</button>

								<input type="text" class="whoneedsawriter__input whoneedsawriter__kw-input" placeholder="<?php echo esc_attr__( 'Keyword', 'whoneedsawriter' ); ?>" data-wnaw-kw-keyword />

								<select class="whoneedsawriter__select whoneedsawriter__kw-input" data-wnaw-kw-category>
									<option value=""><?php echo esc_html__( 'Category', 'whoneedsawriter' ); ?></option>
									<?php foreach ( $wnaw_categories as $wnaw_cat ) : ?>
										<option value="<?php echo esc_attr( (string) $wnaw_cat->term_id ); ?>">
											<?php echo esc_html( (string) $wnaw_cat->name ); ?>
										</option>
									<?php endforeach; ?>
								</select>

								<select class="whoneedsawriter__select whoneedsawriter__kw-input" data-wnaw-kw-author>
									<option value=""><?php echo esc_html__( 'Author', 'whoneedsawriter' ); ?></option>
									<?php foreach ( $wnaw_users as $wnaw_user ) : ?>
										<option value="<?php echo esc_attr( (string) $wnaw_user->ID ); ?>">
											<?php echo esc_html( (string) ( $wnaw_user->display_name ? $wnaw_user->display_name : $wnaw_user->user_login ) ); ?>
										</option>
									<?php endforeach; ?>
								</select>

								<button type="button" class="whoneedsawriter__kw-del" aria-label="<?php echo esc_attr__( 'Delete keyword', 'whoneedsawriter' ); ?>" data-wnaw-kw-del>
									<span class="dashicons dashicons-trash" aria-hidden="true"></span>
								</button>
							</div>
						</template>

						<div
							class="whoneedsawriter__kw-list"
							data-wnaw-kw-list
							data-wnaw-default-category="<?php echo esc_attr( (string) $wnaw_default_category_id ); ?>"
							data-wnaw-default-author="<?php echo esc_attr( (string) $wnaw_default_author_id ); ?>"
						></div>

						<p class="whoneedsawriter__kwpanel-hint">
							<span class="dashicons dashicons-lightbulb" aria-hidden="true"></span>
							<span><?php echo esc_html__( 'Drag to reorder keywords.', 'whoneedsawriter' ); ?></span>
						</p>

						<p class="whoneedsawriter__kwpanel-credits">
							<span class="whoneedsawriter__kwpanel-credits-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
									<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
									<path d="M12 7.25v9.5M14.4 9.5c-.4-.9-1.4-1.4-2.6-1.4-1.6 0-2.6.9-2.6 2.1 0 2.6 5.6 1.5 5.6 4.1 0 1.3-1.1 2.2-2.9 2.2-1.4 0-2.6-.6-3-1.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
								</svg>
							</span>
							<span class="whoneedsawriter__kwpanel-credits-label"><?php echo esc_html__( 'Predicted credit usage:', 'whoneedsawriter' ); ?></span>
							<strong class="whoneedsawriter__kwpanel-credits-value" data-wnaw-kw-split-credits>0 <?php echo esc_html__( 'credits', 'whoneedsawriter' ); ?></strong>
							<span class="whoneedsawriter__kwpanel-eta">
								<svg class="whoneedsawriter__kwpanel-eta-icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
									<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
									<polyline points="12 7 12 12 15.5 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
								~15 <?php echo esc_html__( 'mins', 'whoneedsawriter' ); ?>
							</span>
						</p>

						<p class="whoneedsawriter__muted whoneedsawriter__muted--tight"><?php echo esc_html__( 'Max 10 keywords. Each keyword can include an optional category and author.', 'whoneedsawriter' ); ?></p>
					</div>
				</div>

				<section
					class="whoneedsawriter__optset"
					data-wnaw-optset
					aria-labelledby="wnaw-optset-title"
				>
					<input type="hidden" value="1" data-wnaw-opt-value="featured" />
					<input type="hidden" value="0" data-wnaw-opt-value="infographics" />
					<input type="hidden" value="0" data-wnaw-opt-value="references" />
					<input type="hidden" value="0" data-wnaw-opt-value="humanize" />
					<input type="hidden" value="0" data-wnaw-opt-value="external_links" />

					<button
						type="button"
						class="whoneedsawriter__optset-head"
						aria-expanded="false"
						aria-controls="wnaw-optset-body"
						data-wnaw-optset-toggle
					>
						<span class="whoneedsawriter__optset-chev" aria-hidden="true">
							<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
								<path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</span>
						<span class="whoneedsawriter__optset-title" id="wnaw-optset-title"><?php echo esc_html__( 'Optional settings', 'whoneedsawriter' ); ?></span>
						<span class="whoneedsawriter__optset-sub"><?php echo esc_html__( 'Images, Links, Humanize & More', 'whoneedsawriter' ); ?></span>
					</button>

					<div class="whoneedsawriter__optset-body" id="wnaw-optset-body" data-wnaw-optset-body hidden>
						<div class="whoneedsawriter__optset-grid">
							<div class="whoneedsawriter__optset-left">
								<label class="whoneedsawriter__label" for="wnaw-instructions"><?php echo esc_html__( 'Custom Instructions', 'whoneedsawriter' ); ?></label>
								<textarea
									id="wnaw-instructions"
									class="whoneedsawriter__textarea whoneedsawriter__optset-textarea"
									rows="6"
									maxlength="2000"
									placeholder="<?php echo esc_attr__( 'Enter Custom instructions you want to be followed for your article Eg. add link to https://xyz.com', 'whoneedsawriter' ); ?>"
									data-wnaw-textcount-input
								></textarea>
								<div class="whoneedsawriter__optset-counter" aria-live="polite">
									<span data-wnaw-textcount>0</span> / 2000 <?php echo esc_html__( 'characters', 'whoneedsawriter' ); ?>
								</div>
							</div>

							<div class="whoneedsawriter__optset-toggles" role="group" aria-label="<?php echo esc_attr__( 'Optional features', 'whoneedsawriter' ); ?>">
								<button
									type="button"
									class="whoneedsawriter__optset-row is-on"
									data-wnaw-opt="featured"
									aria-pressed="true"
								>
									<span class="whoneedsawriter__optset-rowicon" aria-hidden="true">
										<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
											<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
											<path d="M3.5 16.5 8 12l3 3 4-4 5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
											<circle cx="9" cy="9.5" r="1.4" fill="currentColor"/>
										</svg>
									</span>
									<span class="whoneedsawriter__optset-rowtext">
										<span class="whoneedsawriter__optset-rowtitle"><?php echo esc_html__( 'Featured image', 'whoneedsawriter' ); ?></span>
										<span class="whoneedsawriter__optset-rowsub"><?php echo esc_html__( 'Allow AI to generate and set a featured image.', 'whoneedsawriter' ); ?></span>
									</span>
									<span class="whoneedsawriter__optset-switch" aria-hidden="true">
										<span class="whoneedsawriter__optset-knob"></span>
									</span>
								</button>

								<button
									type="button"
									class="whoneedsawriter__optset-row"
									data-wnaw-opt="infographics"
									data-wnaw-core-only
									data-wnaw-tip="<?php echo esc_attr__( 'Available from 1a Core', 'whoneedsawriter' ); ?>"
									data-wnaw-core-locked-sub="<?php echo esc_attr__( 'Available from 1a Core', 'whoneedsawriter' ); ?>"
									aria-pressed="false"
								>
									<span class="whoneedsawriter__optset-rowicon" aria-hidden="true">
										<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
											<rect x="4" y="11" width="3" height="8" rx="0.5" fill="currentColor"/>
											<rect x="10" y="7" width="3" height="12" rx="0.5" fill="currentColor"/>
											<rect x="16" y="4" width="3" height="15" rx="0.5" fill="currentColor"/>
											<path d="M3 21h18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
										</svg>
									</span>
									<span class="whoneedsawriter__optset-rowtext">
										<span class="whoneedsawriter__optset-rowtitle"><?php echo esc_html__( 'Infographic', 'whoneedsawriter' ); ?></span>
										<span class="whoneedsawriter__optset-rowsub" data-wnaw-rowsub-default="<?php echo esc_attr__( 'Allow AI to generate and include infographics.', 'whoneedsawriter' ); ?>"><?php echo esc_html__( 'Allow AI to generate and include infographics.', 'whoneedsawriter' ); ?></span>
									</span>
									<span class="whoneedsawriter__optset-switch" aria-hidden="true">
										<span class="whoneedsawriter__optset-knob"></span>
									</span>
								</button>

								<button
									type="button"
									class="whoneedsawriter__optset-row"
									data-wnaw-opt="references"
									data-wnaw-pro-only
									data-wnaw-ref
									data-wnaw-tip="<?php echo esc_attr__( 'Available in 1a Pro', 'whoneedsawriter' ); ?>"
									aria-pressed="false"
								>
									<span class="whoneedsawriter__optset-rowicon" aria-hidden="true">
										<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
											<path d="M5 8c0-2 1.5-3 3-3v2c-1 0-1.5.7-1.5 1.5V9H8v5H4V9c0-.4 0-.7.5-1H5Zm9 0c0-2 1.5-3 3-3v2c-1 0-1.5.7-1.5 1.5V9H17v5h-4V9c0-.4 0-.7.5-1H14Z" fill="currentColor"/>
										</svg>
									</span>
									<span class="whoneedsawriter__optset-rowtext">
										<span class="whoneedsawriter__optset-rowtitle"><?php echo esc_html__( 'References', 'whoneedsawriter' ); ?></span>
										<span class="whoneedsawriter__optset-rowsub"><?php echo esc_html__( 'Allow AI to add references and citations.', 'whoneedsawriter' ); ?></span>
									</span>
									<span class="whoneedsawriter__optset-switch" aria-hidden="true">
										<span class="whoneedsawriter__optset-knob"></span>
									</span>
								</button>

								<button
									type="button"
									class="whoneedsawriter__optset-row"
									data-wnaw-opt="humanize"
									data-wnaw-core-only
									data-wnaw-tip="<?php echo esc_attr__( 'Available from 1a Core', 'whoneedsawriter' ); ?>"
									data-wnaw-core-locked-sub="<?php echo esc_attr__( 'Available from 1a Core', 'whoneedsawriter' ); ?>"
									aria-pressed="false"
								>
									<span class="whoneedsawriter__optset-rowicon" aria-hidden="true">
										<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
											<circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.6"/>
											<path d="M5 20c1-4 4-6 7-6s6 2 7 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
										</svg>
									</span>
									<span class="whoneedsawriter__optset-rowtext">
										<span class="whoneedsawriter__optset-rowtitle"><?php echo esc_html__( 'Humanize', 'whoneedsawriter' ); ?></span>
										<span class="whoneedsawriter__optset-rowsub" data-wnaw-rowsub-default="<?php echo esc_attr__( 'Humanize and make content more natural.', 'whoneedsawriter' ); ?>"><?php echo esc_html__( 'Humanize and make content more natural.', 'whoneedsawriter' ); ?></span>
									</span>
									<span class="whoneedsawriter__optset-switch" aria-hidden="true">
										<span class="whoneedsawriter__optset-knob"></span>
									</span>
								</button>

								<button
									type="button"
									class="whoneedsawriter__optset-row"
									data-wnaw-opt="external_links"
									data-wnaw-core-only
									data-wnaw-tip="<?php echo esc_attr__( 'Available from 1a Core', 'whoneedsawriter' ); ?>"
									data-wnaw-core-locked-sub="<?php echo esc_attr__( 'Available from 1a Core', 'whoneedsawriter' ); ?>"
									aria-pressed="false"
								>
									<span class="whoneedsawriter__optset-rowicon" aria-hidden="true">
										<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
											<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
											<path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
										</svg>
									</span>
									<span class="whoneedsawriter__optset-rowtext">
										<span class="whoneedsawriter__optset-rowtitle"><?php echo esc_html__( 'External link', 'whoneedsawriter' ); ?></span>
										<span class="whoneedsawriter__optset-rowsub" data-wnaw-rowsub-default="<?php echo esc_attr__( 'Allow AI to add relevant external links.', 'whoneedsawriter' ); ?>"><?php echo esc_html__( 'Allow AI to add relevant external links.', 'whoneedsawriter' ); ?></span>
									</span>
									<span class="whoneedsawriter__optset-switch" aria-hidden="true">
										<span class="whoneedsawriter__optset-knob"></span>
									</span>
								</button>
							</div>
						</div>
					</div>
				</section>

				<div class="whoneedsawriter__field whoneedsawriter__field--publish" data-wnaw-publish>
					<div class="whoneedsawriter__label whoneedsawriter__label--publish"><?php echo esc_html__( 'Publish mode', 'whoneedsawriter' ); ?></div>

					<div class="whoneedsawriter__radio-grid whoneedsawriter__radio-grid--publish" role="radiogroup" aria-label="<?php echo esc_attr__( 'Publish mode', 'whoneedsawriter' ); ?>">
						<label class="whoneedsawriter__radio-card whoneedsawriter__radio-card--publish">
							<input class="whoneedsawriter__radio" type="radio" name="wnaw_publish_mode" value="draft" checked data-wnaw-publish-mode />
							<span class="whoneedsawriter__radio-ui" aria-hidden="true"></span>
							<span class="whoneedsawriter__radio-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
									<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
									<path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
									<path d="M8.5 13h7M8.5 16.5h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
								</svg>
							</span>
							<span class="whoneedsawriter__radio-text">
								<span class="whoneedsawriter__radio-title"><?php echo esc_html__( 'Draft', 'whoneedsawriter' ); ?></span>
								<span class="whoneedsawriter__radio-sub"><?php echo esc_html__( 'Save as draft to review before publishing.', 'whoneedsawriter' ); ?></span>
							</span>
						</label>

						<label class="whoneedsawriter__radio-card whoneedsawriter__radio-card--publish">
							<input class="whoneedsawriter__radio" type="radio" name="wnaw_publish_mode" value="publish" data-wnaw-publish-mode />
							<span class="whoneedsawriter__radio-ui" aria-hidden="true"></span>
							<span class="whoneedsawriter__radio-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
									<rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
									<path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
									<circle cx="12" cy="14.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
									<path d="M12 13.2v1.3l1 .9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
								</svg>
							</span>
							<span class="whoneedsawriter__radio-text">
								<span class="whoneedsawriter__radio-title"><?php echo esc_html__( 'Publish now', 'whoneedsawriter' ); ?></span>
								<span class="whoneedsawriter__radio-sub"><?php echo esc_html__( 'Publish immediately after generation.', 'whoneedsawriter' ); ?></span>
							</span>
						</label>

						<label class="whoneedsawriter__radio-card whoneedsawriter__radio-card--publish">
							<input class="whoneedsawriter__radio" type="radio" name="wnaw_publish_mode" value="schedule" data-wnaw-publish-mode />
							<span class="whoneedsawriter__radio-ui" aria-hidden="true"></span>
							<span class="whoneedsawriter__radio-icon" aria-hidden="true">
								<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
									<rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
									<path d="M3.5 9.5h17M8 3.5v3M16 3.5v3M8 13h2M12 13h2M16 13h.01M8 16.5h2M12 16.5h2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
								</svg>
							</span>
							<span class="whoneedsawriter__radio-text">
								<span class="whoneedsawriter__radio-title"><?php echo esc_html__( 'Schedule', 'whoneedsawriter' ); ?></span>
								<span class="whoneedsawriter__radio-sub"><?php echo esc_html__( 'Choose a future date and time.', 'whoneedsawriter' ); ?></span>
							</span>
						</label>
					</div>

					<div class="whoneedsawriter__schedule" hidden data-wnaw-schedule>
						<div class="whoneedsawriter__schedset">
							<header class="whoneedsawriter__schedset-head">
								<span class="whoneedsawriter__schedset-icon" aria-hidden="true">
									<svg viewBox="0 0 24 24" focusable="false">
										<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
										<path d="M3 9h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
									</svg>
								</span>
								<div>
									<h3 class="whoneedsawriter__schedset-title"><?php echo esc_html__( 'Schedule Settings', 'whoneedsawriter' ); ?></h3>
									<p class="whoneedsawriter__schedset-sub"><?php echo esc_html__( 'Choose how and when the articles should be published.', 'whoneedsawriter' ); ?></p>
								</div>
							</header>

							<div class="whoneedsawriter__schedset-grid">
								<div class="whoneedsawriter__schedset-left">

									<div class="whoneedsawriter__field">
										<div class="whoneedsawriter__label"><?php echo esc_html__( 'Frequency', 'whoneedsawriter' ); ?></div>
										<div class="whoneedsawriter__freq whoneedsawriter__freq--cards" role="radiogroup" aria-label="<?php echo esc_attr__( 'Frequency', 'whoneedsawriter' ); ?>">
											<label class="whoneedsawriter__freq-card">
												<input class="whoneedsawriter__radio" type="radio" name="wnaw_frequency" value="daily" checked data-wnaw-frequency />
												<span class="whoneedsawriter__freq-card-ui">
													<span class="whoneedsawriter__freq-card-icon" aria-hidden="true">
														<svg viewBox="0 0 24 24" focusable="false">
															<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
															<path d="M3 9h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
														</svg>
													</span>
													<span class="whoneedsawriter__freq-card-label"><?php echo esc_html__( 'Daily', 'whoneedsawriter' ); ?></span>
												</span>
											</label>
											<label class="whoneedsawriter__freq-card">
												<input class="whoneedsawriter__radio" type="radio" name="wnaw_frequency" value="weekly" data-wnaw-frequency />
												<span class="whoneedsawriter__freq-card-ui">
													<span class="whoneedsawriter__freq-card-icon" aria-hidden="true">
														<svg viewBox="0 0 24 24" focusable="false">
															<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
															<path d="M3 9h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
															<path d="M7 14h2M11 14h2M15 14h2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
														</svg>
													</span>
													<span class="whoneedsawriter__freq-card-label"><?php echo esc_html__( 'Weekly', 'whoneedsawriter' ); ?></span>
												</span>
											</label>
											<label class="whoneedsawriter__freq-card">
												<input class="whoneedsawriter__radio" type="radio" name="wnaw_frequency" value="monthly" data-wnaw-frequency />
												<span class="whoneedsawriter__freq-card-ui">
													<span class="whoneedsawriter__freq-card-icon" aria-hidden="true">
														<svg viewBox="0 0 24 24" focusable="false">
															<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
															<path d="M3 9h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
															<path d="M7 13h3v3H7zM11 13h3v3h-3zM15 13h3v3h-3z" fill="none" stroke="currentColor" stroke-width="1.4"/>
														</svg>
													</span>
													<span class="whoneedsawriter__freq-card-label"><?php echo esc_html__( 'Monthly', 'whoneedsawriter' ); ?></span>
												</span>
											</label>
										</div>
									</div>

									<div class="whoneedsawriter__field">
										<div class="whoneedsawriter__label"><?php echo esc_html__( 'Start date & time', 'whoneedsawriter' ); ?></div>
										<div class="whoneedsawriter__schedset-dtrow">
											<div class="whoneedsawriter__schedset-dtfield whoneedsawriter__schedset-dtfield--date" data-wnaw-schedset-date-wrap>
												<span class="whoneedsawriter__schedset-dtfield-icon" aria-hidden="true">
													<svg viewBox="0 0 24 24" focusable="false">
														<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>
														<path d="M3 9h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
													</svg>
												</span>
												<span class="whoneedsawriter__schedset-dtfield-value" data-wnaw-schedset-date-display><?php echo esc_html__( 'Select date', 'whoneedsawriter' ); ?></span>
												<input
													type="date"
													class="whoneedsawriter__schedset-date-native"
													data-wnaw-schedset-date-input
													aria-label="<?php echo esc_attr__( 'Start date', 'whoneedsawriter' ); ?>"
												/>
											</div>
											<div class="whoneedsawriter__schedset-dtfield whoneedsawriter__schedset-dtfield--time" data-wnaw-schedset-time-wrap>
												<span class="whoneedsawriter__schedset-dtfield-icon" aria-hidden="true">
													<svg viewBox="0 0 24 24" focusable="false">
														<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
														<path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
													</svg>
												</span>
												<select
													class="whoneedsawriter__schedset-time-select"
													data-wnaw-schedset-time-select
													aria-label="<?php echo esc_attr__( 'Start time', 'whoneedsawriter' ); ?>"
												></select>
												<span class="whoneedsawriter__schedset-dtfield-chev" aria-hidden="true">
													<svg viewBox="0 0 24 24" focusable="false">
														<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
													</svg>
												</span>
											</div>
										</div>
										<p class="whoneedsawriter__schedset-help">
											<?php echo esc_html__( 'When the first article should be published.', 'whoneedsawriter' ); ?>
										</p>
									</div>

								</div>

								<aside class="whoneedsawriter__schedset-preview" aria-label="<?php echo esc_attr__( 'Schedule preview', 'whoneedsawriter' ); ?>">
									<header class="whoneedsawriter__schedset-preview-head">
										<h4 class="whoneedsawriter__schedset-preview-title"><?php echo esc_html__( 'Preview', 'whoneedsawriter' ); ?></h4>
										<p class="whoneedsawriter__schedset-preview-sub"><?php echo esc_html__( 'Articles will be published as per the schedule below.', 'whoneedsawriter' ); ?></p>
									</header>

									<ol class="whoneedsawriter__schedset-preview-list" data-wnaw-schedset-preview-list>
										<li class="whoneedsawriter__schedset-preview-item whoneedsawriter__schedset-preview-item--empty" data-wnaw-schedset-preview-empty>
											<span class="whoneedsawriter__schedset-preview-text whoneedsawriter__schedset-preview-text--muted">
												<?php echo esc_html__( 'Add at least one keyword to see the publishing schedule.', 'whoneedsawriter' ); ?>
											</span>
										</li>
									</ol>

									<p class="whoneedsawriter__schedset-preview-tz">
										<span class="whoneedsawriter__schedset-preview-tz-icon" aria-hidden="true">
											<svg viewBox="0 0 24 24" focusable="false">
												<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
												<path d="M12 11v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
												<circle cx="12" cy="8" r="1" fill="currentColor"/>
											</svg>
										</span>
										<span data-wnaw-schedset-tz><?php echo esc_html__( 'All times are in your timezone.', 'whoneedsawriter' ); ?></span>
									</p>
								</aside>
							</div>
						</div>
					</div>
				</div>

				<div class="whoneedsawriter__gen-actions">
					<button
						type="button"
						class="button button-primary whoneedsawriter__button whoneedsawriter__submit"
						data-wnaw-create-batch
						aria-busy="false"
					>
						<span class="whoneedsawriter__btn-inner">
							<span class="whoneedsawriter__btn-label" data-wnaw-create-batch-label>
								<?php echo esc_html__( 'Start Job', 'whoneedsawriter' ); ?>
							</span>
							<span class="whoneedsawriter__btn-spinner" aria-hidden="true">
								<svg class="whoneedsawriter__spinner" viewBox="0 0 50 50" focusable="false" aria-hidden="true">
									<circle class="whoneedsawriter__spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
								</svg>
							</span>
						</span>
					</button>
				</div>

				<p class="whoneedsawriter__modal-notice" hidden aria-live="polite" data-wnaw-gen-notice></p>
			</div>
		</div>
	</div>

	<div
		class="whoneedsawriter__credit-modal"
		data-wnaw-credit-modal
		role="dialog"
		aria-modal="true"
		aria-labelledby="wnaw-credit-modal-title"
		aria-describedby="wnaw-credit-modal-desc"
		hidden
	>
		<div class="whoneedsawriter__credit-modal-backdrop" data-wnaw-credit-modal-dismiss></div>
		<div class="whoneedsawriter__credit-modal-card" role="document">
			<button
				type="button"
				class="whoneedsawriter__credit-modal-close"
				aria-label="<?php echo esc_attr__( 'Close', 'whoneedsawriter' ); ?>"
				data-wnaw-credit-modal-dismiss
			>
				<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
					<path d="M3 3l10 10M13 3 3 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
				</svg>
			</button>

			<div class="whoneedsawriter__credit-modal-iconwrap" aria-hidden="true">
				<span class="whoneedsawriter__credit-modal-icon">
					<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
						<path d="M12 3.5 21.4 19.5a1.6 1.6 0 0 1-1.4 2.4H4a1.6 1.6 0 0 1-1.4-2.4L12 3.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
						<path d="M12 10v4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
						<circle cx="12" cy="17.5" r="1" fill="currentColor"/>
					</svg>
				</span>
			</div>

			<h3 class="whoneedsawriter__credit-modal-title" id="wnaw-credit-modal-title">
				<?php echo esc_html__( 'Not enough credits', 'whoneedsawriter' ); ?>
			</h3>

			<div class="whoneedsawriter__credit-modal-body" id="wnaw-credit-modal-desc">
				<p class="whoneedsawriter__credit-modal-line">
					<?php
					printf(
						/* translators: 1: number of credits needed (HTML), 2: number of credits available (HTML). */
						esc_html__( 'You need %1$s to complete this task, but you only have %2$s.', 'whoneedsawriter' ),
						'<strong class="whoneedsawriter__credit-modal-need" data-wnaw-credit-need>0 ' . esc_html__( 'credits', 'whoneedsawriter' ) . '</strong>',
						'<strong class="whoneedsawriter__credit-modal-have" data-wnaw-credit-have>0 ' . esc_html__( 'credits', 'whoneedsawriter' ) . '</strong>'
					);
					?>
				</p>
				<p class="whoneedsawriter__credit-modal-line" data-wnaw-credit-modal-message>
					<?php echo esc_html__( 'Please upgrade your plan to continue.', 'whoneedsawriter' ); ?>
				</p>
			</div>

			<div class="whoneedsawriter__credit-modal-actions">
				<button
					type="button"
					class="whoneedsawriter__credit-modal-btn whoneedsawriter__credit-modal-btn--cancel"
					data-wnaw-credit-modal-dismiss
				>
					<?php echo esc_html__( 'Cancel', 'whoneedsawriter' ); ?>
				</button>
				<a
					class="whoneedsawriter__credit-modal-btn whoneedsawriter__credit-modal-btn--upgrade"
					role="button"
					aria-disabled="true"
					data-wnaw-credit-modal-upgrade
					data-wnaw-account-cta
					data-wnaw-account-loading="1"
				>
					<span data-wnaw-cta-label><?php echo esc_html__( 'Checking account...', 'whoneedsawriter' ); ?></span>
				</a>
			</div>
		</div>
	</div>
</div>
