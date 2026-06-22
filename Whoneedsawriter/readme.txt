=== Whoneedsawriter ===
Contributors: whoneedsawriter
Tags: ai, content, automation, seo, articles
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 0.1.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connect Whoneedsawriter to your site: generate articles in the cloud, then draft, schedule, or publish them in WordPress.

== Description ==

Whoneedsawriter bridges your WordPress site and the Whoneedsawriter SaaS platform. After you connect your account from wp-admin, you can submit generation jobs, track batches and articles, and receive posts created or updated by the Whoneedsawriter service—including scheduled publishing aligned with your site’s timezone.

**Admin features**

* **Connect** — Sign up or sign in (including OTP verification and supported OAuth flows where enabled).
* **Dashboard** — Overview of activity and quick links into the workflow.
* **Generate Article** — Submit keywords and options (models, categories, authors, schedule settings, publish vs schedule).
* **List of Jobs** — Browse batches with status derived from generation and WordPress post presence.
* **Job detail** — Per-batch progress (generation and scheduling steps), generated articles table, and refresh actions.
* **All Articles** — Cross-batch view of articles tied to your connected account.
* **Settings** — Plugin preferences, credits visibility, sync helpers, and disconnect.

**Publishing from Whoneedsawriter**

The plugin exposes a REST endpoint your Whoneedsawriter backend can call to create or update posts (`/wp-json/apf/v1/create-post`). Optional shared-secret protection is supported for production sites.

Incoming payloads can include title, HTML content, featured image, categories, authors, SEO meta, draft/future/publish behavior, and scheduling hints (`schedule_time`, `published_start_date_time`). Content is normalized where appropriate—for example, `<h1>` tags inside article HTML are removed so the theme’s post title remains the single primary heading.

**Requirements**

* WordPress 6.0 or newer.
* PHP 7.4 or newer.
* A verified Whoneedsawriter account linked from the Connect screen.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`, or upload the ZIP via **Plugins → Add New → Upload Plugin**.
2. Activate **Whoneedsawriter** through the **Plugins** screen.
3. Open **Whoneedsawriter** in the admin menu and complete **Connect** (signup / login / verification as prompted).
4. Use **Generate Article** to start a batch, then monitor **List of Jobs** and each job’s detail page.

== Frequently Asked Questions ==

= Does the plugin write posts without my SaaS account? =

Generation and orchestration happen on Whoneedsawriter’s service. This plugin handles authentication in wp-admin and accepts REST callbacks from your configured SaaS workflow to create posts in WordPress.

= Can I restrict who may call the create-post REST route? =

Yes. Define `WHONEEDSAWRITER_PUBLISH_REST_SECRET` in `wp-config.php` or set the matching option so requests must send the secret header—see plugin documentation or support for exact header names.

= Why remove `<h1>` from imported content? =

Most themes output the post title as an `<h1>`. Duplicate H1s in the body hurt semantics and accessibility; the plugin strips body `<h1>` elements before saving.

= Where do scheduled times come from? =

Schedule settings from generation are interpreted using your WordPress site timezone (`Settings → General`) where relevant, so admin-facing labels align with how WordPress stores and displays dates.

== Screenshots ==

1. Connect and account linking.
2. Generate Article — keywords and schedule settings.
3. List of Jobs — batches and status.
4. Job detail — progress stepper and generated articles table.

== Changelog ==

= 0.1.3 =
* Improved job and article status display (Generating / Generated / Failed) aligned with WordPress post presence where applicable.
* Job detail stepper and scheduling badge refinements; jobs list status aggregation.
* REST create-post: strip `<h1>` from article body to avoid duplicate titles on the front end.
* Miscellaneous UI fixes (notices, caching, redirects, timezone display).

= 0.1.2 =
* After signup (HTTP 200), open Verify OTP modal; submit OTP via admin-ajax to verify-otp API. Submit loaders on both steps.

= 0.1.1 =
* Signup modal: client + server email validation, AJAX, JSON POST to create-user API.

= 0.1.0 =
* Initial release with admin UI scaffolding.

== Upgrade Notice ==

= 0.1.3 =
Recommended update for clearer job/article status, scheduling step UX, and safer default post content (no duplicate H1 in body).
