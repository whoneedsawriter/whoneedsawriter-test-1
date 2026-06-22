<?php
/**
 * Main plugin class.
 *
 * @package Whoneedsawriter
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Whoneedsawriter {
	/**
	 * Plugin slug used for admin pages and handles.
	 *
	 * @var string
	 */
	const SLUG = 'whoneedsawriter';

	/**
	 * Admin instance.
	 *
	 * @var Whoneedsawriter_Admin|null
	 */
	private $admin = null;

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public function run() {
		require_once WHONEEDSAWRITER_PLUGIN_DIR . 'includes/class-whoneedsawriter-repository.php';
		require_once WHONEEDSAWRITER_PLUGIN_DIR . 'includes/admin/class-whoneedsawriter-admin.php';
		Whoneedsawriter_Repository::init();

		add_action(
			'rest_api_init',
			function () {
				require_once WHONEEDSAWRITER_PLUGIN_DIR . 'includes/rest/class-whoneedsawriter-rest-create-post.php';
				Whoneedsawriter_REST_Create_Post::register_routes();
			}
		);

		if ( is_admin() ) {
			$this->admin = new Whoneedsawriter_Admin( self::SLUG, WHONEEDSAWRITER_VERSION );
			$this->admin->init();
		}
	}
}
