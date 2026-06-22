<?php
/**
 * Admin page: Settings.
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** @var array<string, mixed> $wnaw_sets */
if ( ! isset( $wnaw_sets ) || ! is_array( $wnaw_sets ) ) {
	$wnaw_sets = Whoneedsawriter_Admin::merge_plugin_settings();
}

/** @var string $wnaw_connected_email */
if ( ! isset( $wnaw_connected_email ) ) {
	$wnaw_connected_email = '';
}

/** @var string $wnaw_site_id Site / SaaS user ID when connected. */
if ( ! isset( $wnaw_site_id ) ) {
	$wnaw_site_id = '';
}

/** @var string $wnaw_settings_form_action */
if ( ! isset( $wnaw_settings_form_action ) ) {
	$wnaw_settings_form_action = esc_url( admin_url( 'admin-post.php' ) );
}

/** @var string $wnaw_buy_credits_url SaaS pricing URL with userId and website. */
if ( ! isset( $wnaw_buy_credits_url ) || ! is_string( $wnaw_buy_credits_url ) ) {
	$wnaw_buy_credits_url = Whoneedsawriter_Admin::PRICING_URL;
}

/** @var array<int, WP_Term> $wnaw_categories */
if ( ! isset( $wnaw_categories ) || ! is_array( $wnaw_categories ) ) {
	$wnaw_categories = array();
}

/** @var array<int, WP_User> $wnaw_users */
if ( ! isset( $wnaw_users ) || ! is_array( $wnaw_users ) ) {
	$wnaw_users = array();
}

$wnaw_saved_flag = isset( $_GET['wnaw_saved'] ) && '1' === sanitize_text_field( wp_unslash( (string) $_GET['wnaw_saved'] ) );

$wnaw_def_model    = isset( $wnaw_sets['default_model'] ) && in_array( (string) $wnaw_sets['default_model'], array( 'lite', 'core', 'pro' ), true )
	? (string) $wnaw_sets['default_model']
	: 'core';
$wnaw_def_words    = isset( $wnaw_sets['default_word_count'] ) ? absint( $wnaw_sets['default_word_count'] ) : 1500;
$wnaw_def_author   = isset( $wnaw_sets['default_author_id'] ) ? absint( $wnaw_sets['default_author_id'] ) : 0;
$wnaw_def_category = isset( $wnaw_sets['default_category_id'] ) ? absint( $wnaw_sets['default_category_id'] ) : 0;
$wnaw_debug        = ! empty( $wnaw_sets['debug_mode'] );

$wnaw_save_form_id = 'wnaw-save-settings-form';
?>

<div class="wrap whoneedsawriter">
	<div class="whoneedsawriter__shell whoneedsawriter__shell--dashboard whoneedsawriter__shell--settings" data-wnaw-settings>
		<div class="whoneedsawriter__settings-head">
			<h1 class="whoneedsawriter__title"><?php echo esc_html__( 'Settings', 'whoneedsawriter' ); ?></h1>
			<p class="whoneedsawriter__subtext whoneedsawriter__subtext--tight">
				<?php echo esc_html__( 'Manage your account, generation defaults, and plugin behavior.', 'whoneedsawriter' ); ?>
			</p>
		</div>

		<?php if ( $wnaw_saved_flag ) : ?>
			<div class="notice notice-success whoneedsawriter__settings-notice" role="status">
				<p><?php echo esc_html__( 'Settings saved.', 'whoneedsawriter' ); ?></p>
			</div>
		<?php endif; ?>

		<p class="whoneedsawriter__modal-notice" hidden aria-live="polite" data-wnaw-settings-notice></p>

		<section class="whoneedsawriter__settings-section whoneedsawriter__card">
			<h2 class="whoneedsawriter__settings-section-title"><?php echo esc_html__( 'Account', 'whoneedsawriter' ); ?></h2>
			<dl class="whoneedsawriter__settings-kv">
				<div class="whoneedsawriter__settings-kv-row">
					<dt><?php echo esc_html__( 'Connected Email', 'whoneedsawriter' ); ?></dt>
					<dd>
						<?php echo $wnaw_connected_email !== '' ? esc_html( $wnaw_connected_email ) : '—'; ?>
					</dd>
				</div>
				<div class="whoneedsawriter__settings-kv-row">
					<dt><?php echo esc_html__( 'Site ID', 'whoneedsawriter' ); ?></dt>
					<dd>
						<code class="whoneedsawriter__settings-code"><?php echo $wnaw_site_id !== '' ? esc_html( $wnaw_site_id ) : '—'; ?></code>
					</dd>
				</div>
			</dl>
			<p class="whoneedsawriter__settings-actions">
				<button
					type="submit"
					class="button button-primary whoneedsawriter__button"
					form="wnaw-disconnect-form"
					data-wnaw-disconnect-trigger
				>
					<?php echo esc_html__( 'Disconnect', 'whoneedsawriter' ); ?>
				</button>
			</p>
		</section>

		<form id="<?php echo esc_attr( $wnaw_save_form_id ); ?>" class="whoneedsawriter__settings-form" method="post" action="<?php echo esc_url( $wnaw_settings_form_action ); ?>">
			<input type="hidden" name="action" value="whoneedsawriter_save_settings" />
			<?php wp_nonce_field( Whoneedsawriter_Admin::NONCE_SAVE_SETTINGS, 'wnaw_save_nonce' ); ?>

			<section class="whoneedsawriter__settings-section whoneedsawriter__card">
				<h2 class="whoneedsawriter__settings-section-title"><?php echo esc_html__( 'Defaults', 'whoneedsawriter' ); ?></h2>
				<p class="whoneedsawriter__muted whoneedsawriter__muted--tight">
					<?php echo esc_html__( 'Used as the starting point on the Generate Article screen.', 'whoneedsawriter' ); ?>
				</p>

				<div class="whoneedsawriter__settings-field">
					<label class="whoneedsawriter__label" for="wnaw-default-model"><?php echo esc_html__( 'Default Model', 'whoneedsawriter' ); ?></label>
					<select id="wnaw-default-model" class="whoneedsawriter__select" name="wnaw_default_model">
						<option value="lite" <?php selected( $wnaw_def_model, 'lite' ); ?>><?php echo esc_html__( '1a Lite', 'whoneedsawriter' ); ?></option>
						<option value="core" <?php selected( $wnaw_def_model, 'core' ); ?>><?php echo esc_html__( '1a Core', 'whoneedsawriter' ); ?></option>
						<option value="pro" <?php selected( $wnaw_def_model, 'pro' ); ?>><?php echo esc_html__( '1a Pro', 'whoneedsawriter' ); ?></option>
					</select>
				</div>

				<div class="whoneedsawriter__settings-field">
					<label class="whoneedsawriter__label" for="wnaw-default-word"><?php echo esc_html__( 'Default Word Count', 'whoneedsawriter' ); ?></label>
					<input
						id="wnaw-default-word"
						class="whoneedsawriter__input"
						type="number"
						name="wnaw_default_word_count"
						min="0"
						max="3000"
						step="50"
						value="<?php echo esc_attr( (string) $wnaw_def_words ); ?>"
					/>
				</div>

				<div class="whoneedsawriter__settings-field">
					<label class="whoneedsawriter__label" for="wnaw-default-author"><?php echo esc_html__( 'Default Author', 'whoneedsawriter' ); ?></label>
					<select id="wnaw-default-author" class="whoneedsawriter__select" name="wnaw_default_author_id">
						<option value="0"><?php echo esc_html__( '— Same as Generate page (automatic) —', 'whoneedsawriter' ); ?></option>
						<?php foreach ( $wnaw_users as $wnaw_u ) : ?>
							<option value="<?php echo esc_attr( (string) $wnaw_u->ID ); ?>" <?php selected( $wnaw_def_author, (int) $wnaw_u->ID ); ?>>
								<?php echo esc_html( $wnaw_u->display_name ? (string) $wnaw_u->display_name : (string) $wnaw_u->user_login ); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</div>

				<div class="whoneedsawriter__settings-field">
					<label class="whoneedsawriter__label" for="wnaw-default-category"><?php echo esc_html__( 'Default Category', 'whoneedsawriter' ); ?></label>
					<select id="wnaw-default-category" class="whoneedsawriter__select" name="wnaw_default_category_id">
						<option value="0"><?php echo esc_html__( '— Same as Generate page (automatic) —', 'whoneedsawriter' ); ?></option>
						<?php foreach ( $wnaw_categories as $wnaw_cat ) : ?>
							<option value="<?php echo esc_attr( (string) $wnaw_cat->term_id ); ?>" <?php selected( $wnaw_def_category, (int) $wnaw_cat->term_id ); ?>>
								<?php echo esc_html( (string) $wnaw_cat->name ); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</div>
			</section>
		</form>

		<section class="whoneedsawriter__settings-section whoneedsawriter__card" aria-disabled="true">
			<h2 class="whoneedsawriter__settings-section-title"><?php echo esc_html__( 'Sync Data', 'whoneedsawriter' ); ?></h2>
			<p class="whoneedsawriter__muted whoneedsawriter__muted--tight">
				<?php echo esc_html__( 'Initial sync of categories and authors already runs when you connect and verify your account.', 'whoneedsawriter' ); ?>
			</p>
			<p class="whoneedsawriter__muted whoneedsawriter__muted--tight">
				<?php echo esc_html__( 'Manual sync buttons are temporarily disabled in this version.', 'whoneedsawriter' ); ?>
			</p>
			<p class="whoneedsawriter__settings-actions">
				<button type="button" class="button button-primary whoneedsawriter__button" data-wnaw-sync-categories disabled aria-disabled="true"><?php echo esc_html__( 'Sync Categories', 'whoneedsawriter' ); ?></button>
				<button type="button" class="button button-primary whoneedsawriter__button" data-wnaw-sync-authors disabled aria-disabled="true"><?php echo esc_html__( 'Sync Authors', 'whoneedsawriter' ); ?></button>
			</p>
		</section>

		<section class="whoneedsawriter__settings-section whoneedsawriter__card">
			<h2 class="whoneedsawriter__settings-section-title"><?php echo esc_html__( 'Credits', 'whoneedsawriter' ); ?></h2>
			<p class="whoneedsawriter__settings-kv-simple">
				<?php echo esc_html__( 'Credits Remaining:', 'whoneedsawriter' ); ?>
				<strong data-wnaw-settings-credits data-wnaw-account-loading="1"><?php echo esc_html__( 'Checking...', 'whoneedsawriter' ); ?></strong>
			</p>
			<p class="whoneedsawriter__settings-actions">
				<a class="button button-primary whoneedsawriter__button" role="button" aria-disabled="true" data-wnaw-account-cta data-wnaw-account-loading="1">
					<span data-wnaw-cta-label><?php echo esc_html__( 'Checking account...', 'whoneedsawriter' ); ?></span>
				</a>
				<span class="whoneedsawriter__account-message" data-wnaw-account-message hidden></span>
			</p>
		</section>

		<section class="whoneedsawriter__settings-footer whoneedsawriter__card">
			<button type="submit" class="button button-primary whoneedsawriter__button" form="<?php echo esc_attr( $wnaw_save_form_id ); ?>"><?php echo esc_html__( 'Save Settings', 'whoneedsawriter' ); ?></button>
			<button type="submit" class="button button-primary whoneedsawriter__button" form="wnaw-disconnect-form" data-wnaw-disconnect-trigger>
				<?php echo esc_html__( 'Disconnect Account', 'whoneedsawriter' ); ?>
			</button>
		</section>

		<form id="wnaw-disconnect-form" method="post" action="<?php echo esc_url( $wnaw_settings_form_action ); ?>" hidden>
			<input type="hidden" name="action" value="whoneedsawriter_disconnect_account" />
			<?php wp_nonce_field( Whoneedsawriter_Admin::NONCE_DISCONNECT, 'wnaw_disconnect_nonce' ); ?>
		</form>
		<span class="screen-reader-text" data-wnaw-disconnect-msg hidden>
			<?php echo esc_html__( 'Disconnect this site from your Whoneedsawriter account? You can reconnect anytime.', 'whoneedsawriter' ); ?>
		</span>
	</div>
</div>
