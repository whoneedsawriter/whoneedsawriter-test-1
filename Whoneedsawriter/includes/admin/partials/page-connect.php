<?php
/**
 * Admin page: Connect.
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wnaw_disconnected = isset( $_GET['wnaw_disconnected'] ) && '1' === sanitize_text_field( wp_unslash( (string) $_GET['wnaw_disconnected'] ) );

$wnaw_oauth_error_raw = isset( $_GET['wnaw_oauth_error'] ) ? sanitize_key( wp_unslash( (string) $_GET['wnaw_oauth_error'] ) ) : '';
$wnaw_oauth_error_map = array(
	'state_mismatch' => __( 'Session expired or invalid. Please try connecting with Google again.', 'whoneedsawriter' ),
	'invalid_token'  => __( 'We could not verify the response from Whoneedsawriter. Please try again.', 'whoneedsawriter' ),
	'missing_sub'    => __( 'Whoneedsawriter did not return a valid user. Please try again.', 'whoneedsawriter' ),
	'forbidden'      => __( 'You do not have permission to connect this site.', 'whoneedsawriter' ),
);
$wnaw_oauth_error_msg = isset( $wnaw_oauth_error_map[ $wnaw_oauth_error_raw ] ) ? $wnaw_oauth_error_map[ $wnaw_oauth_error_raw ] : '';

$wnaw_google_start_url = wp_nonce_url(
	add_query_arg(
		array( 'action' => Whoneedsawriter_Admin::ACTION_GOOGLE_CONNECT_START ),
		admin_url( 'admin-post.php' )
	),
	Whoneedsawriter_Admin::NONCE_GOOGLE_CONNECT_START
);
?>

<div class="wrap whoneedsawriter">
	<?php if ( $wnaw_disconnected ) : ?>
		<div class="notice notice-info" role="status">
			<p><?php echo esc_html__( 'Your site has been disconnected from Whoneedsawriter. Sign up again to reconnect.', 'whoneedsawriter' ); ?></p>
		</div>
	<?php endif; ?>
	<?php if ( '' !== $wnaw_oauth_error_msg ) : ?>
		<div class="notice notice-error" role="alert">
			<p><?php echo esc_html( $wnaw_oauth_error_msg ); ?></p>
		</div>
	<?php endif; ?>
	<div class="whoneedsawriter__shell">
		<div class="whoneedsawriter__hero">
			<div class="brand-logo">
				<img src="<?php echo WHONEEDSAWRITER_PLUGIN_URL . 'assets/admin/images/logo.webp'; ?>" alt="Whoneedsawriter" class="whoneedsawriter__logo">
			</div>
			<h2 class="whoneedsawriter__title">Welcome to Whoneedsawriter</h2>
			<p class="whoneedsawriter__text">Generate well-researched, human-focused articles with AI. Optimized for featured snippets and complete with high-quality images. Just enter a keyword and get started.</p>
			<div class="whoneedsawriter__separator"></div>
			<br>
			<h3 class="whoneedsawriter__subtitle"><?php echo esc_html__( 'Connect Your Account', 'whoneedsawriter' ); ?></h3>
			<p class="whoneedsawriter__subtext"><?php echo esc_html__( 'Connect your account to start generating and publishing articles automatically.', 'whoneedsawriter' ); ?></p>

			<div class="whoneedsawriter__connect-actions">
				<a
					href="<?php echo esc_url( $wnaw_google_start_url ); ?>"
					class="whoneedsawriter__google-btn"
				>
					<span class="whoneedsawriter__google-icon" aria-hidden="true">
						<svg viewBox="0 0 18 18" focusable="false">
							<path fill="#4285F4" d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"/>
							<path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.806.54-1.8368.859-3.0477.859-2.3441 0-4.3282-1.583-5.0359-3.7104H.957v2.3318C2.4382 15.983 5.4818 18 9 18z"/>
							<path fill="#FBBC05" d="M3.9641 10.71C3.7841 10.17 3.6818 9.5932 3.6818 9c0-.5932.1023-1.17.2823-1.71V4.9582H.957C.3477 6.1732 0 7.5477 0 9c0 1.4523.3477 2.8268.957 4.0418L3.9641 10.71z"/>
							<path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.017.957 4.9582L3.9641 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"/>
						</svg>
					</span>
					<span><?php echo esc_html__( 'Continue with Google', 'whoneedsawriter' ); ?></span>
				</a>

				<div class="whoneedsawriter__or-divider" aria-hidden="true">
					<span><?php echo esc_html__( 'or', 'whoneedsawriter' ); ?></span>
				</div>

				<button type="button" class="button button-primary whoneedsawriter__button" data-wnaw-open-modal>
					<?php echo esc_html__( 'Continue with Email', 'whoneedsawriter' ); ?>
				</button>
			</div>
		</div>

		<div class="whoneedsawriter__card">
			<div class="whoneedsawriter__card-title"><?php echo esc_html__( 'What happens next?', 'whoneedsawriter' ); ?></div>
			<div class="whoneedsawriter__card-body">
				<p class="whoneedsawriter__muted">
					<?php echo esc_html__( 'After you connect, you’ll be able to generate drafts and publish to your site automatically.', 'whoneedsawriter' ); ?>
				</p>
			</div>
		</div>
	</div>

	<div class="whoneedsawriter__modal-overlay" data-wnaw-modal-overlay hidden></div>

	<div
		class="whoneedsawriter__modal"
		role="dialog"
		aria-modal="true"
		aria-labelledby="wnaw-modal-title-signup"
		data-wnaw-modal="signup"
		hidden
	>
		<div class="whoneedsawriter__modal-header">
			<h2 id="wnaw-modal-title-signup" class="whoneedsawriter__modal-title"><?php echo esc_html__( 'Signup', 'whoneedsawriter' ); ?></h2>
			<button type="button" class="whoneedsawriter__icon-button" aria-label="<?php echo esc_attr__( 'Close', 'whoneedsawriter' ); ?>" data-wnaw-close-modal>
				<span aria-hidden="true">&times;</span>
			</button>
		</div>

		<form class="whoneedsawriter__modal-body" data-wnaw-signup-form>
			<label class="whoneedsawriter__label" for="wnaw-email">
				<?php echo esc_html__( 'Email', 'whoneedsawriter' ); ?>
			</label>
			<input
				id="wnaw-email"
				name="email"
				type="email"
				class="whoneedsawriter__input"
				placeholder="<?php echo esc_attr__( 'you@example.com', 'whoneedsawriter' ); ?>"
				autocomplete="email"
				inputmode="email"
				required
			/>

			<p class="whoneedsawriter__modal-notice" data-wnaw-signup-notice hidden aria-live="polite"></p>

			<div class="whoneedsawriter__modal-actions">
				<button type="submit" class="button button-primary whoneedsawriter__button whoneedsawriter__submit w-full" data-wnaw-submit>
					<span class="whoneedsawriter__btn-inner">
					    <span class="whoneedsawriter__btn-spinner" aria-hidden="true">
							<svg class="whoneedsawriter__spinner" viewBox="0 0 50 50" focusable="false" aria-hidden="true">
								<circle class="whoneedsawriter__spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
							</svg>
						</span>
						<span class="whoneedsawriter__btn-label"><?php echo esc_html__( 'Submit', 'whoneedsawriter' ); ?></span>
					</span>
				</button>
			</div>

			<p class="whoneedsawriter__fineprint">
				<?php echo esc_html__( 'We will send your email securely to Whoneedsawriter to create or link your account.', 'whoneedsawriter' ); ?>
			</p>
		</form>
	</div>

	<div
		class="whoneedsawriter__modal"
		role="dialog"
		aria-modal="true"
		aria-labelledby="wnaw-modal-title-otp"
		data-wnaw-modal="otp"
		hidden
	>
		<div class="whoneedsawriter__modal-header">
			<h2 id="wnaw-modal-title-otp" class="whoneedsawriter__modal-title"><?php echo esc_html__( 'Verify Access Code', 'whoneedsawriter' ); ?></h2>
			<button type="button" class="whoneedsawriter__icon-button" aria-label="<?php echo esc_attr__( 'Close', 'whoneedsawriter' ); ?>" data-wnaw-close-modal>
				<span aria-hidden="true">&times;</span>
			</button>
		</div>

		<form class="whoneedsawriter__modal-body" data-wnaw-otp-form>
			<p class="whoneedsawriter__modal-notice" data-wnaw-otp-sent aria-live="polite" data-wnaw-notice-type="success">
				<?php echo esc_html__( 'Access Code sent to your email', 'whoneedsawriter' ); ?>
			</p>

			<label class="whoneedsawriter__label" for="wnaw-otp">
				<?php echo esc_html__( 'Access Code', 'whoneedsawriter' ); ?>
			</label>
			<input
				id="wnaw-otp"
				name="otp"
				type="text"
				class="whoneedsawriter__input"
				placeholder="<?php echo esc_attr__( 'Enter the code from your email', 'whoneedsawriter' ); ?>"
				autocomplete="one-time-code"
				inputmode="numeric"
				maxlength="32"
				required
			/>

			<p class="whoneedsawriter__modal-notice" data-wnaw-otp-notice hidden aria-live="polite"></p>

			<div class="whoneedsawriter__modal-actions" data-wnaw-otp-submit-wrap>
				<button type="submit" class="button button-primary whoneedsawriter__button whoneedsawriter__submit w-full" data-wnaw-otp-submit>
					<span class="whoneedsawriter__btn-inner">
					    <span class="whoneedsawriter__btn-spinner" aria-hidden="true">
							<svg class="whoneedsawriter__spinner" viewBox="0 0 50 50" focusable="false" aria-hidden="true">
								<circle class="whoneedsawriter__spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
							</svg>
						</span>
						<span class="whoneedsawriter__btn-label"><?php echo esc_html__( 'Submit', 'whoneedsawriter' ); ?></span>
					</span>
				</button>
			</div>
			<div class="whoneedsawriter__modal-actions" data-wnaw-generate-actions hidden>
				<a class="button button-primary whoneedsawriter__button" href="<?php echo esc_url( admin_url( 'admin.php?page=whoneedsawriter-generate' ) ); ?>" data-wnaw-trial-gate>
					<?php echo esc_html__( 'Generate Articles', 'whoneedsawriter' ); ?>
				</a>
			</div>
		</form>
	</div>
</div>
