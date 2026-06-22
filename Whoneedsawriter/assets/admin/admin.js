(function () {
	'use strict';

	/** @type {Window & { whoneedsawriterAdmin?: Record<string, unknown> }} */
	const w = window;
	const cfg = w.whoneedsawriterAdmin;

	/* ====================================================================
	 * Move third-party WordPress admin notices above the plugin shell.
	 *
	 * WordPress core (common.js) injects .notice elements after the first
	 * <h1>/<h2> inside .wrap, which lands them inside __shell/__topbar.
	 * We relocate them to just before the shell so they sit above the card.
	 * ================================================================== */
	function wnawRelocateAdminNotices() {
		var shells = document.querySelectorAll('.wrap.whoneedsawriter .whoneedsawriter__shell');
		if (!shells.length) return;

		shells.forEach(function (shell) {
			var wrap = shell.parentNode;
			if (!wrap) return;

			var notices = shell.querySelectorAll(
				'.notice, .updated, .error, .update-nag'
			);
			notices.forEach(function (notice) {
				if (notice.closest('[data-wnaw-dashboard]') && notice.classList.contains('whoneedsawriter__gen-redirect-notice')) {
					return;
				}
				wrap.insertBefore(notice, shell);
			});
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', wnawRelocateAdminNotices);
	} else {
		wnawRelocateAdminNotices();
	}
	window.addEventListener('load', wnawRelocateAdminNotices);

	/* ====================================================================
	 * Plugin DB cache (server-side tables). Runtime mirrors enable sync reads
	 * within a page session after the first AJAX load. Credits are never
	 * stored — always loaded live from the balance API.
	 * ================================================================== */
	const wnawRuntimeDb = {
		batches: /** @type {unknown[] | null} */ (null),
		dashboard: /** @type {Record<string, unknown> | null} */ (null),
		articles: /** @type {Record<string, Record<string, unknown>[]>} */ ({}),
		settings: /** @type {Record<string, Record<string, unknown>>} */ ({}),
	};

	let wnawAccountState = /** @type {Record<string, unknown> | null} */ (null);
	let wnawAccountStatePromise = /** @type {Promise<Record<string, unknown> | null> | null} */ (null);
	let wnawTrialModalLastFocus = null;

	const wnawAccountShouldOfferTrial = (account) => {
		const access = account && typeof account === 'object' ? account.access : null;
		return Boolean(
			access &&
			typeof access === 'object' &&
			access.trialEligible === true &&
			access.hasGenerationAccess !== true
		);
	};

	const wnawGetAccountCta = (account) => {
		const cta = account && typeof account === 'object' ? account.cta : null;
		return cta && typeof cta === 'object' ? cta : {};
	};

	const wnawGetAccountMessage = (account) => {
		const access = account && typeof account === 'object' ? account.access : null;
		if (access && typeof access === 'object' && access.message) {
			return String(access.message);
		}
		const cta = wnawGetAccountCta(account || {});
		return cta.message ? String(cta.message) : '';
	};

	const wnawFormatCredits = (value) => {
		const n = Number(value);
		if (!Number.isFinite(n)) return '';
		return String(Math.round(n * 10) / 10);
	};

	function wnawSetAccountLoading(isLoading) {
		document.querySelectorAll('[data-wnaw-account-cta]').forEach((el) => {
			if (isLoading) {
				el.setAttribute('aria-disabled', 'true');
				el.setAttribute('data-wnaw-account-loading', '1');
				if (el instanceof HTMLAnchorElement) {
					el.removeAttribute('href');
					el.removeAttribute('target');
					el.removeAttribute('rel');
				}
				const labelEl = el.querySelector('[data-wnaw-cta-label]');
				if (labelEl) labelEl.textContent = 'Checking account...';
				else if (!el.hasAttribute('data-wnaw-credits-badge')) el.textContent = 'Checking account...';
			} else {
				el.removeAttribute('data-wnaw-account-loading');
			}
		});
		document.querySelectorAll('[data-wnaw-credits], [data-wnaw-dashboard-credits], [data-wnaw-settings-credits]').forEach((el) => {
			if (isLoading) {
				el.setAttribute('data-wnaw-account-loading', '1');
				el.textContent = 'Checking...';
			} else {
				el.removeAttribute('data-wnaw-account-loading');
			}
		});
		document.querySelectorAll('[data-wnaw-account-message]').forEach((el) => {
			el.hidden = true;
			el.textContent = '';
		});
	}

	const wnawFormatDateLabel = (value) => {
		if (!value) return '';
		const d = new Date(String(value));
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	};

	async function wnawFetchAccountState(force) {
		if (!cfg || !cfg.ajaxUrl || !cfg.actionGetUserBalance || !cfg.nonceGetUserBalance) {
			return null;
		}
		if (!force && wnawAccountState) {
			return wnawAccountState;
		}
		if (!force && wnawAccountStatePromise) {
			return wnawAccountStatePromise;
		}

		wnawSetAccountLoading(true);
		wnawAccountStatePromise = (async () => {
			const params = new URLSearchParams();
			params.set('action', String(cfg.actionGetUserBalance));
			params.set('nonce', String(cfg.nonceGetUserBalance));
			if (force) params.set('force', '1');

			try {
				const res = await fetch(String(cfg.ajaxUrl), {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
					body: params.toString(),
				});
				const json = await res.json();
				if (json && json.success && json.data) {
					wnawAccountState = json.data;
					wnawApplyAccountCtas(wnawAccountState);
					return wnawAccountState;
				}
				const msg = json && json.data && json.data.message ? String(json.data.message) : 'Could not check account status. Please retry.';
				wnawApplyAccountError(msg);
			} catch (e) {
				wnawApplyAccountError('Could not check account status. Please retry.');
			}
			return null;
		})();

		const result = await wnawAccountStatePromise;
		wnawAccountStatePromise = null;
		return result;
	}

	function wnawCloseTrialModal() {
		const modal = document.querySelector('[data-wnaw-trial-modal]');
		if (!modal) return;
		modal.setAttribute('hidden', '');
		document.body.classList.remove('whoneedsawriter-modal-open');
		if (wnawTrialModalLastFocus && typeof wnawTrialModalLastFocus.focus === 'function') {
			try { wnawTrialModalLastFocus.focus(); } catch (e) { /* noop */ }
		}
		wnawTrialModalLastFocus = null;
	}

	function wnawOpenTrialModal(mode, account) {
		const modal = document.querySelector('[data-wnaw-trial-modal]');
		if (!modal) return;
		const titleEl = modal.querySelector('[data-wnaw-trial-modal-title]');
		const bodyEl = modal.querySelector('[data-wnaw-trial-modal-body]');
		const metaEl = modal.querySelector('[data-wnaw-trial-modal-meta]');
		const startEl = modal.querySelector('[data-wnaw-trial-modal-start]');
		const cancelEl = modal.querySelector('[data-wnaw-trial-modal-dismiss].whoneedsawriter__trial-modal-btn--cancel');
		const cta = wnawGetAccountCta(account || wnawAccountState || {});
		const access = account && typeof account === 'object' ? account.access : {};

		if (mode === 'success') {
			if (titleEl) titleEl.textContent = cfg.strings && cfg.strings.trialActivatedTitle ? String(cfg.strings.trialActivatedTitle) : 'Trial activated';
			if (bodyEl) bodyEl.textContent = cfg.strings && cfg.strings.trialActivatedBody ? String(cfg.strings.trialActivatedBody) : 'Your 7-day trial is active with 5 credits included. You can now generate articles from WordPress.';
			if (startEl) startEl.setAttribute('hidden', '');
			if (cancelEl) cancelEl.textContent = 'Close';
			const bits = [];
			if (access && access.activePlanName) bits.push(`Plan: ${access.activePlanName}`);
			const end = access && access.trialEndsAt ? wnawFormatDateLabel(access.trialEndsAt) : '';
			if (end) bits.push(`Trial ends: ${end}`);
			if (metaEl) {
				metaEl.textContent = bits.join(' · ');
				metaEl.hidden = bits.length === 0;
			}
		} else {
			if (titleEl) titleEl.textContent = cfg.strings && cfg.strings.trialModalTitle ? String(cfg.strings.trialModalTitle) : 'Start your 7-day trial';
			if (bodyEl) bodyEl.textContent = cfg.strings && cfg.strings.trialModalBody ? String(cfg.strings.trialModalBody) : 'Activate your trial to generate articles from WordPress.';
			if (metaEl) {
				metaEl.textContent = '';
				metaEl.hidden = true;
			}
			if (startEl) {
				const trialUrl = cta.trialUrl || '';
				if (trialUrl && cta.disabled !== true) {
					startEl.setAttribute('href', String(trialUrl));
					startEl.setAttribute('target', '_blank');
					startEl.setAttribute('rel', 'noopener noreferrer');
					startEl.setAttribute('aria-disabled', 'false');
				} else {
					startEl.removeAttribute('href');
					startEl.removeAttribute('target');
					startEl.removeAttribute('rel');
					startEl.setAttribute('aria-disabled', 'true');
				}
				startEl.removeAttribute('hidden');
				startEl.textContent = cfg.strings && cfg.strings.trialModalStart ? String(cfg.strings.trialModalStart) : 'Start Trial';
			}
			if (cancelEl) cancelEl.textContent = cfg.strings && cfg.strings.trialModalCancel ? String(cfg.strings.trialModalCancel) : 'Maybe later';
		}

		wnawTrialModalLastFocus = document.activeElement;
		modal.removeAttribute('hidden');
		document.body.classList.add('whoneedsawriter-modal-open');
		const focusTarget = mode === 'success' ? cancelEl : startEl;
		if (focusTarget && typeof focusTarget.focus === 'function') {
			try { focusTarget.focus({ preventScroll: true }); } catch (e) { /* noop */ }
		}
	}

	function wnawApplyAccountError(message) {
		const text = message || 'Could not check account status. Please retry.';
		document.querySelectorAll('[data-wnaw-account-cta]').forEach((el) => {
			el.setAttribute('aria-disabled', 'true');
			el.setAttribute('data-wnaw-account-loading', '1');
			el.setAttribute('data-wnaw-account-cta-kind', 'loading');
			if (el instanceof HTMLAnchorElement) {
				el.removeAttribute('href');
				el.removeAttribute('target');
				el.removeAttribute('rel');
			}
			const labelEl = el.querySelector('[data-wnaw-cta-label]');
			if (labelEl) labelEl.textContent = 'Retry account check';
			else if (!el.hasAttribute('data-wnaw-credits-badge')) el.textContent = 'Retry account check';
		});
		document.querySelectorAll('[data-wnaw-account-message]').forEach((el) => {
			el.hidden = false;
			el.textContent = text;
		});
	}

	function wnawApplyAccountCtas(account) {
		const cta = wnawGetAccountCta(account || {});
		const label = cta.label ? String(cta.label) : '';
		const ctaUrl = cta.url || '';
		const pricingUrl = cta.pricingUrl || '';
		const trialUrl = cta.trialUrl || '';
		const kind = String(cta.kind || 'credits');
		const disabled = cta.disabled === true;
		const shouldTrial = wnawAccountShouldOfferTrial(account || {});
		const message = wnawGetAccountMessage(account || {});
		const credits = wnawFormatCredits(account && typeof account === 'object' ? account.credits : null);

		document.querySelectorAll('[data-wnaw-credits], [data-wnaw-dashboard-credits], [data-wnaw-settings-credits]').forEach((el) => {
			el.removeAttribute('data-wnaw-account-loading');
			if (credits) el.textContent = credits;
		});

		document.querySelectorAll('[data-wnaw-account-cta]').forEach((el) => {
			el.removeAttribute('data-wnaw-account-loading');
			el.setAttribute('data-wnaw-account-cta-kind', shouldTrial ? 'trial' : kind);
			if (disabled) el.setAttribute('aria-disabled', 'true');
			else el.setAttribute('aria-disabled', 'false');

			const labelEl = el.querySelector('[data-wnaw-cta-label]');
			if (label && labelEl) labelEl.textContent = label;
			else if (label && !el.hasAttribute('data-wnaw-credits-badge')) el.textContent = label;
			if (el instanceof HTMLAnchorElement) {
				const href = shouldTrial && trialUrl ? trialUrl : (ctaUrl || pricingUrl);
				if (!disabled && href) {
					el.setAttribute('href', String(href));
					el.setAttribute('target', '_blank');
					el.setAttribute('rel', 'noopener noreferrer');
				} else {
					el.removeAttribute('href');
					el.removeAttribute('target');
					el.removeAttribute('rel');
				}
			}
		});

		const modalStart = document.querySelector('[data-wnaw-trial-modal-start]');
		if (modalStart instanceof HTMLAnchorElement) {
			if (!disabled && trialUrl) {
				modalStart.setAttribute('href', String(trialUrl));
				modalStart.setAttribute('target', '_blank');
				modalStart.setAttribute('rel', 'noopener noreferrer');
				modalStart.setAttribute('aria-disabled', 'false');
			} else {
				modalStart.removeAttribute('href');
				modalStart.removeAttribute('target');
				modalStart.removeAttribute('rel');
				modalStart.setAttribute('aria-disabled', 'true');
			}
		}

		document.querySelectorAll('[data-wnaw-account-message]').forEach((el) => {
			el.hidden = !message;
			el.textContent = message;
		});
	}

	(function initTrialModalAndGates() {
		const wire = () => {
			const modal = document.querySelector('[data-wnaw-trial-modal]');
			if (modal && !modal.getAttribute('data-wnaw-wired')) {
				modal.setAttribute('data-wnaw-wired', '1');
				modal.querySelectorAll('[data-wnaw-trial-modal-dismiss]').forEach((el) => {
					el.addEventListener('click', (ev) => {
						ev.preventDefault();
						wnawCloseTrialModal();
					});
				});
				document.addEventListener('keydown', (ev) => {
					if (ev.key === 'Escape' && !modal.hasAttribute('hidden')) {
						wnawCloseTrialModal();
					}
				});
			}

			document.addEventListener('click', async (ev) => {
				const target = ev.target instanceof Element ? ev.target : null;
				const gated = target ? target.closest('[data-wnaw-account-cta], [data-wnaw-trial-gate]') : null;
				if (!gated) return;
				if (gated.getAttribute('data-wnaw-account-loading') === '1' || gated.getAttribute('aria-disabled') === 'true') {
					ev.preventDefault();
					return;
				}
				const hrefBeforeFetch = gated instanceof HTMLAnchorElement ? gated.getAttribute('href') : '';
				const shouldHoldForAccount = !wnawAccountState;
				if (shouldHoldForAccount) {
					ev.preventDefault();
				}
				const account = await wnawFetchAccountState(false);
				if (!account) {
					ev.preventDefault();
					return;
				}
				if (!wnawAccountShouldOfferTrial(account)) {
					if (shouldHoldForAccount && hrefBeforeFetch) {
						window.location.href = hrefBeforeFetch;
					}
					return;
				}
				ev.preventDefault();
				wnawOpenTrialModal('trial', account || {});
			});

			document.addEventListener('click', (ev) => {
				const target = ev.target instanceof Element ? ev.target : null;
				const start = target ? target.closest('[data-wnaw-trial-modal-start]') : null;
				if (start && (start.getAttribute('aria-disabled') === 'true' || !start.getAttribute('href'))) {
					ev.preventDefault();
				}
			});

			let forceAccount = false;
			try {
				const params = new URLSearchParams(window.location.search);
				if (params.get('wnaw_trial') === 'started') {
					forceAccount = true;
					params.delete('wnaw_trial');
					params.delete('type');
					params.delete('plan');
					const nextSearch = params.toString();
					window.history.replaceState({}, '', window.location.pathname + (nextSearch ? `?${nextSearch}` : '') + window.location.hash);
				}
			} catch (e) {
				forceAccount = false;
			}
			wnawFetchAccountState(forceAccount).then((account) => {
				if (forceAccount) {
					wnawOpenTrialModal('success', account || {});
				}
			});
		};

		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', wire);
		} else {
			wire();
		}
	})();

	/**
	 * @param {string} scope
	 * @param {Record<string, string>} [extra]
	 * @returns {Promise<Record<string, unknown> | null>}
	 */
	async function wnawDbFetchScope(scope, extra) {
		if (!cfg || !cfg.ajaxUrl || !cfg.actionGetDbData || !cfg.nonceGetDbData) {
			return null;
		}
		const params = new URLSearchParams();
		params.set('action', String(cfg.actionGetDbData));
		params.set('nonce', String(cfg.nonceGetDbData));
		params.set('scope', scope);
		if (extra && typeof extra === 'object') {
			Object.keys(extra).forEach((k) => {
				if (extra[k] != null) {
					params.set(k, String(extra[k]));
				}
			});
		}
		try {
			const res = await fetch(String(cfg.ajaxUrl), {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
				body: params.toString(),
			});
			/** @type {{ success?: boolean; data?: Record<string, unknown> }} */
			const json = await res.json();
			return json && json.success && json.data ? json.data : null;
		} catch (e) {
			return null;
		}
	}

	/** @returns {Promise<unknown[]>} */
	async function wnawDbLoadJobs() {
		const data = await wnawDbFetchScope('jobs');
		const rows = data && Array.isArray(data.rows) ? data.rows : [];
		wnawRuntimeDb.batches = rows;
		return rows;
	}

	/** @returns {unknown[] | null} */
	function wnawReadBatchesCache() {
		return wnawRuntimeDb.batches;
	}

	/** @param {unknown[]} rows */
	function wnawWriteBatchesCache(rows) {
		if (!Array.isArray(rows)) return;
		wnawRuntimeDb.batches = rows;
	}

	/** @returns {boolean} */
	function wnawIsBatchesCacheFresh() {
		return !!(wnawRuntimeDb.batches && wnawRuntimeDb.batches.length);
	}

	/** MMDDYY token used by the SaaS jobs list `createdAt` field. */
	function wnawTodayBatchCreatedAtToken() {
		const d = new Date();
		const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
		const dd = String(d.getUTCDate()).padStart(2, '0');
		const yy = String(d.getUTCFullYear() % 100).padStart(2, '0');
		return `${mm}${dd}${yy}`;
	}

	/** Proposed SaaS batch name sent at create-batch time (e.g. WNAW-052826). */
	function wnawProposedBatchName() {
		return `WNAW-${wnawTodayBatchCreatedAtToken()}`;
	}

	/**
	 * @param {Record<string, unknown>} batchRow
	 */
	function wnawUpsertBatchInCache(batchRow) {
		if (!batchRow || typeof batchRow !== 'object') return;
		const id = batchRow.id != null ? String(batchRow.id).trim() : '';
		if (!id) return;
		const rows = wnawReadBatchesCache() || [];
		const next = rows.filter((r) => !(r && typeof r === 'object' && String(r.id) === id));
		next.unshift(batchRow);
		wnawWriteBatchesCache(next);
	}

	/**
	 * @param {string} batchId
	 * @returns {Promise<Record<string, unknown>[]>}
	 */
	async function wnawDbLoadArticles(batchId) {
		const batchIdSafe = String(batchId || '').trim();
		if (!batchIdSafe) return [];
		const data = await wnawDbFetchScope('articles', { batch_id: batchIdSafe });
		const rows = data && Array.isArray(data.rows)
			? /** @type {Record<string, unknown>[]} */ (data.rows)
			: [];
		wnawRuntimeDb.articles[batchIdSafe] = rows;
		return rows;
	}

	/**
	 * @param {string} batchId
	 * @returns {Record<string, unknown>[] | null}
	 */
	function wnawReadBatchArticlesCache(batchId) {
		const batchIdSafe = String(batchId || '').trim();
		if (!batchIdSafe) return null;
		const rows = wnawRuntimeDb.articles[batchIdSafe];
		return Array.isArray(rows) ? rows : null;
	}

	/**
	 * @param {string} batchId
	 * @param {Record<string, unknown>[]} rows
	 */
	function wnawWriteBatchArticlesCache(batchId, rows) {
		const batchIdSafe = String(batchId || '').trim();
		if (!batchIdSafe || !Array.isArray(rows)) return;
		wnawRuntimeDb.articles[batchIdSafe] = rows;
	}

	/**
	 * @param {string} batchId
	 * @param {number} index
	 * @param {Record<string, unknown>} patch
	 */
	function wnawPatchBatchArticleInCache(batchId, index, patch) {
		const rows = wnawReadBatchArticlesCache(batchId);
		if (!rows || index < 0 || index >= rows.length || !patch) return;
		rows[index] = Object.assign({}, rows[index], patch);
		wnawWriteBatchArticlesCache(batchId, rows);
	}

	/**
	 * @param {string} batchName
	 * @returns {Record<string, unknown> | null}
	 */
	function wnawReadBatchSettings(batchName) {
		if (!batchName) return null;
		const v = wnawRuntimeDb.settings[String(batchName)];
		return v && typeof v === 'object' ? v : null;
	}

	/**
	 * @param {string} batchId
	 * @returns {Promise<Record<string, unknown> | null>}
	 */
	async function wnawDbLoadBatchSettings(batchId) {
		const batchIdSafe = String(batchId || '').trim();
		if (!batchIdSafe) return null;
		const data = await wnawDbFetchScope('batch_settings', { batch_id: batchIdSafe });
		const settings = data && data.settings && typeof data.settings === 'object'
			? /** @type {Record<string, unknown>} */ (data.settings)
			: null;
		if (settings) {
			wnawRuntimeDb.settings[batchIdSafe] = settings;
		}
		return settings;
	}

	/** @returns {Promise<Record<string, unknown> | null>} */
	async function wnawDbLoadDashboard() {
		const data = await wnawDbFetchScope('dashboard');
		const stats = data && data.stats && typeof data.stats === 'object'
			? /** @type {Record<string, unknown>} */ (data.stats)
			: null;
		if (stats) {
			wnawRuntimeDb.dashboard = stats;
		}
		return stats;
	}

	/**
	 * @param {string} batchId
	 * @returns {Promise<Record<string, unknown> | null>}
	 */
	async function wnawDbLoadBatch(batchId) {
		const batchIdSafe = String(batchId || '').trim();
		if (!batchIdSafe) return null;
		const data = await wnawDbFetchScope('batch', { batch_id: batchIdSafe });
		const batch = data && data.batch && typeof data.batch === 'object'
			? /** @type {Record<string, unknown>} */ (data.batch)
			: null;
		if (batch && batch.id) {
			wnawUpsertBatchInCache(batch);
		}
		return batch;
	}

	/**
	 * When at least one article is Generated, check SaaS for Failed on still-Generating rows.
	 *
	 * @param {string} batchId
	 * @param {Record<string, unknown>[]} dbRows
	 * @returns {Promise<{ rows: Record<string, unknown>[]; batch: Record<string, unknown> | null; changed: boolean } | null>}
	 */
	async function wnawSyncGeneratingArticlesIfNeeded(batchId, dbRows) {
		if (!cfg || !cfg.ajaxUrl || !cfg.actionSyncGeneratingArticles || !cfg.nonceSyncGeneratingArticles) {
			return null;
		}
		const rows = Array.isArray(dbRows) ? dbRows : [];
		const hasGenerated = rows.some((r) => r && String(r.statusKey) === 'generated');
		const hasGenerating = rows.some((r) => r && String(r.statusKey) === 'generating');
		if (!hasGenerated || !hasGenerating) {
			return null;
		}

		const params = new URLSearchParams();
		params.set('action', String(cfg.actionSyncGeneratingArticles));
		params.set('nonce', String(cfg.nonceSyncGeneratingArticles));
		params.set('batch_id', String(batchId));

		try {
			const res = await fetch(String(cfg.ajaxUrl), {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
				body: params.toString(),
			});
			/** @type {{ success?: boolean; data?: { rows?: unknown[]; batch?: Record<string, unknown>; changed?: boolean } }} */
			const json = await res.json();
			if (!(json && json.success && json.data && Array.isArray(json.data.rows))) {
				return null;
			}
			if (!json.data.changed) {
				return null;
			}
			const nextRows = /** @type {Record<string, unknown>[]} */ (json.data.rows);
			wnawWriteBatchArticlesCache(batchId, nextRows);
			if (json.data.batch && typeof json.data.batch === 'object') {
				wnawUpsertBatchInCache(json.data.batch);
			}
			return {
				rows: nextRows,
				batch: json.data.batch && typeof json.data.batch === 'object'
					? /** @type {Record<string, unknown>} */ (json.data.batch)
					: null,
				changed: true,
			};
		} catch (e) {
			return null;
		}
	}

	/** @returns {Record<string, unknown> | null} */
	function wnawReadDashboardCache() {
		return wnawRuntimeDb.dashboard;
	}

	/**
	 * Persist batch + keywords + settings during generation (plugin DB).
	 *
	 * @param {{ batchId: string; keywords?: string[]; scheduledSlots?: string[]; settings?: Record<string, unknown>; batchRow?: Record<string, unknown> }} opts
	 * @returns {Promise<boolean>}
	 */
	async function wnawSaveGenerationSnapshot(opts) {
		if (!cfg || !cfg.ajaxUrl || !cfg.actionSaveGenerationSnapshot || !cfg.nonceSaveGenerationSnapshot) {
			return false;
		}
		if (!opts || !opts.batchId) return false;
		const params = new URLSearchParams();
		params.set('action', String(cfg.actionSaveGenerationSnapshot));
		params.set('nonce', String(cfg.nonceSaveGenerationSnapshot));
		params.set('batch_id', String(opts.batchId));
		if (opts.keywords && opts.keywords.length) {
			params.set('keywords_json', JSON.stringify(opts.keywords));
		}
		if (opts.scheduledSlots && opts.scheduledSlots.length) {
			params.set('scheduled_slots_json', JSON.stringify(opts.scheduledSlots));
		}
		if (opts.settings && typeof opts.settings === 'object') {
			params.set('settings_json', JSON.stringify(opts.settings));
		}
		if (opts.batchRow && typeof opts.batchRow === 'object') {
			params.set('batch_row_json', JSON.stringify(opts.batchRow));
		}
		try {
			const res = await fetch(String(cfg.ajaxUrl), {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
				body: params.toString(),
			});
			const json = await res.json();
			return !!(json && json.success);
		} catch (e) {
			return false;
		}
	}

	/**
	 * Generate page URL with bulk keywords pre-filled (?wnaw_keywords=).
	 *
	 * @param {string[]} keywords
	 * @returns {string}
	 */
	function wnawBuildGenerateUrlWithKeywords(keywords) {
		const base = cfg && cfg.generateUrl ? String(cfg.generateUrl) : '';
		if (!base) return '';
		const lines = Array.isArray(keywords)
			? keywords.map((k) => String(k).trim()).filter(Boolean)
			: [];
		if (!lines.length) return base;
		try {
			const url = new URL(base, window.location.href);
			url.searchParams.set('wnaw_keywords', lines.join('\n'));
			return url.toString();
		} catch (e) {
			return base;
		}
	}

	/** SaaS batch display name: single leading `#` for Job ID column / header. */
	function wnawNormalizePluginJobDisplayName(raw) {
		const s = raw == null ? '' : String(raw).trim();
		if (!s) return '';
		const stripped = s.replace(/^#+/, '');
		return stripped ? '#' + stripped : '';
	}

	const WNAW_SCHED_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/** @param {Date} d */
	function wnawFormatScheduleSlotDate(d) {
		if (!(d instanceof Date) || isNaN(d.getTime())) return '';
		return `${WNAW_SCHED_MONTH_LABELS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
	}

	/** @param {number} hh @param {number} mm */
	function wnawFormatScheduleSlotTime12(hh, mm) {
		const ampm = hh >= 12 ? 'PM' : 'AM';
		let h12 = hh % 12;
		if (h12 === 0) h12 = 12;
		return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
	}

	/**
	 * @param {Date} startDate
	 * @param {string} freq
	 * @param {number} i
	 */
	function wnawScheduleOccurrenceAt(startDate, freq, i) {
		const d = new Date(startDate.getTime());
		if (freq === 'weekly') d.setDate(d.getDate() + i * 7);
		else if (freq === 'monthly') d.setMonth(d.getMonth() + i);
		else d.setDate(d.getDate() + i);
		return d;
	}

	/**
	 * One label per keyword/article slot (aligned with Generate page schedule preview).
	 *
	 * @param {string} dStr yyyy-mm-dd
	 * @param {string} tStr HH:MM
	 * @param {string} freq daily|weekly|monthly
	 * @param {number} count
	 * @returns {string[]}
	 */
	function wnawBuildArticleScheduledSlotLabels(dStr, tStr, freq, count) {
		if (!dStr || !tStr || count < 1) return [];
		const dParts = dStr.split('-').map((p) => parseInt(p, 10));
		const tParts = tStr.split(':').map((p) => parseInt(p, 10));
		if (dParts.length !== 3 || tParts.length !== 2) return [];
		const startDate = new Date(
			dParts[0],
			dParts[1] - 1,
			dParts[2],
			tParts[0] || 0,
			tParts[1] || 0,
			0,
			0
		);
		if (isNaN(startDate.getTime())) return [];
		const f = freq === 'weekly' ? 'weekly' : freq === 'monthly' ? 'monthly' : 'daily';
		/** @type {string[]} */
		const out = [];
		const dot = '\u00B7';
		for (let i = 0; i < count; i++) {
			const d = wnawScheduleOccurrenceAt(startDate, f, i);
			out.push(`${wnawFormatScheduleSlotDate(d)} ${dot} ${wnawFormatScheduleSlotTime12(d.getHours(), d.getMinutes())}`);
		}
		return out;
	}

	/**
	 * SaaS batch/article schedule start in MySQL local form: `YYYY-MM-DD HH:mm:ss`.
	 *
	 * @param {string} dStr yyyy-mm-dd
	 * @param {string} tStr HH:MM or HH:MM:SS
	 * @returns {string}
	 */
	function wnawIsSaasBatchScheduleFrequency(scheduleTime) {
		const s = scheduleTime != null ? String(scheduleTime).trim() : '';
		return s === 'one_post_per_day' || s === 'one_post_per_weekly' || s === 'one_post_per_monthly';
	}

	/**
	 * Anchor publishedStartDateTime + scheduleTime cadence × slot index.
	 *
	 * @param {string} baseMysql e.g. 2026-05-24 12:32:00
	 * @param {string} scheduleTime one_post_per_day|weekly|monthly
	 * @param {number} slotIndex 0 = anchor, 1 = +7 days (weekly), etc.
	 * @returns {string}
	 */
	/**
	 * @param {string} raw MySQL `Y-m-d H:i:s` or ISO-8601 from SaaS.
	 * @returns {Date | null}
	 */
	function wnawParseScheduleAnchorDate(raw) {
		const base = raw != null ? String(raw).trim() : '';
		if (!base) {
			return null;
		}
		if (/^\d{4}-\d{2}-\d{2}T/.test(base)) {
			const d = new Date(base);
			return isNaN(d.getTime()) ? null : d;
		}
		const m = base.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
		if (!m) {
			return null;
		}
		const start = new Date(
			parseInt(m[1], 10),
			parseInt(m[2], 10) - 1,
			parseInt(m[3], 10),
			parseInt(m[4], 10),
			parseInt(m[5], 10) || 0,
			0,
			0
		);
		return isNaN(start.getTime()) ? null : start;
	}

	function wnawComputeSlotFromPublishedStartMysql(baseMysql, scheduleTime, slotIndex) {
		const base = baseMysql != null ? String(baseMysql).trim() : '';
		const sched = scheduleTime != null ? String(scheduleTime).trim() : '';
		if (!base || !wnawIsSaasBatchScheduleFrequency(sched)) {
			return '';
		}
		const idx = Math.max(0, Number(slotIndex) || 0);
		const start = wnawParseScheduleAnchorDate(base);
		if (!start) {
			return '';
		}
		let freq = 'daily';
		if (sched === 'one_post_per_weekly') {
			freq = 'weekly';
		} else if (sched === 'one_post_per_monthly') {
			freq = 'monthly';
		}
		const d = wnawScheduleOccurrenceAt(start, freq, idx);
		const dot = '\u00B7';
		return `${wnawFormatScheduleSlotDate(d)} ${dot} ${wnawFormatScheduleSlotTime12(d.getHours(), d.getMinutes())}`;
	}

	function wnawFormatPublishedStartDateTimeMysql(dStr, tStr) {
		const d = dStr != null ? String(dStr).trim() : '';
		const t = tStr != null ? String(tStr).trim() : '';
		if (!d || !t) {
			return '';
		}
		const tParts = t.split(':');
		const hh = String(parseInt(tParts[0], 10) || 0).padStart(2, '0');
		const mm = String(parseInt(tParts[1], 10) || 0).padStart(2, '0');
		const ss = tParts[2] != null ? String(parseInt(tParts[2], 10) || 0).padStart(2, '0') : '00';
		return `${d} ${hh}:${mm}:${ss}`;
	}

	/**
	 * @param {Record<string, unknown> | null} snap
	 * @returns {string[]}
	 */
	function wnawArticleScheduledSlotsFromSnapshot(snap) {
		if (!snap || typeof snap !== 'object') {
			return [];
		}
		const raw = snap.article_scheduled_slots;
		if (Array.isArray(raw) && raw.length) {
			return raw.map((x) => String(x).trim()).filter(Boolean);
		}
		if (snap.publish_mode !== 'schedule') {
			return [];
		}
		const sched = snap.schedule;
		if (!sched || typeof sched !== 'object') {
			return [];
		}
		let dStr = sched.start_date != null ? String(sched.start_date) : '';
		let tStr = sched.start_time != null ? String(sched.start_time) : '';
		if ((!dStr || !tStr) && sched.publishedStartDateTime != null) {
			const m = String(sched.publishedStartDateTime).trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
			if (m) {
				dStr = m[1];
				tStr = m[2];
			}
		}
		if ((!dStr || !tStr) && sched.start_datetime != null) {
			const iso = String(sched.start_datetime).trim();
			if (iso) {
				const d = new Date(iso);
				if (!isNaN(d.getTime())) {
					const pad = (n) => String(n).padStart(2, '0');
					dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
					tStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
				}
			}
		}
		const schedTime = sched.scheduleTime != null ? String(sched.scheduleTime) : '';
		const publishedMysql = sched.published_start_mysql != null
			? String(sched.published_start_mysql).trim()
			: (sched.publishedStartDateTime != null
				? String(sched.publishedStartDateTime).trim()
				: (snap.publishedStartDateTime != null ? String(snap.publishedStartDateTime).trim() : ''));
		const nKw = Array.isArray(snap.keywords) ? snap.keywords.length : 0;
		const nTot = Number.isFinite(Number(sched.total_articles)) ? Number(sched.total_articles) : 0;
		const count = Math.max(nKw, nTot, 0);
		if (count < 1) {
			return [];
		}
		if (publishedMysql && wnawIsSaasBatchScheduleFrequency(schedTime)) {
			/** @type {string[]} */
			const out = [];
			for (let i = 0; i < count; i++) {
				const label = wnawComputeSlotFromPublishedStartMysql(publishedMysql, schedTime, i);
				if (label) {
					out.push(label);
				}
			}
			if (out.length) {
				return out;
			}
		}
		const freq = sched.frequency != null ? String(sched.frequency) : 'daily';
		if (!dStr || !tStr) {
			return [];
		}
		return wnawBuildArticleScheduledSlotLabels(dStr, tStr, freq, count);
	}

	/**
	 * @param {string} batchId
	 * @param {unknown[] | null} batchesCache
	 * @returns {Record<string, unknown> | null}
	 */
	function wnawFindBatchSnapshot(batchId, batchesCache) {
		const id = batchId != null ? String(batchId).trim() : '';
		if (!id) {
			return null;
		}
		let snap = wnawReadBatchSettings(id);
		if (snap) {
			return snap;
		}
		if (!Array.isArray(batchesCache)) {
			return null;
		}
		for (let i = 0; i < batchesCache.length; i++) {
			const b = batchesCache[i];
			if (!b || typeof b !== 'object' || String(/** @type {Record<string, unknown>} */ (b).id) !== id) {
				continue;
			}
			const rawName = /** @type {Record<string, unknown>} */ (b).name != null
				? String(/** @type {Record<string, unknown>} */ (b).name).trim()
				: '';
			if (!rawName) {
				break;
			}
			snap = wnawReadBatchSettings(wnawNormalizePluginJobDisplayName(rawName));
			if (snap) {
				return snap;
			}
			snap = wnawReadBatchSettings(rawName.replace(/^#+/, ''));
			if (snap) {
				return snap;
			}
			break;
		}
		return null;
	}

	/**
	 * @param {Record<string, unknown> | null} snap
	 * @param {unknown} keyword
	 * @param {unknown} title
	 * @returns {number}
	 */
	function wnawKeywordIndexInSnapshot(snap, keyword, title) {
		if (!snap || !Array.isArray(snap.keywords)) {
			return -1;
		}
		/** @type {string[]} */
		const kws = snap.keywords.map((k) => String(k).trim().toLowerCase());
		const kw = keyword != null ? String(keyword).trim().toLowerCase() : '';
		const tit = title != null ? String(title).trim().toLowerCase() : '';
		if (kw) {
			let idx = kws.indexOf(kw);
			if (idx >= 0) {
				return idx;
			}
			idx = kws.findIndex((k) => k === kw || k.includes(kw) || kw.includes(k));
			if (idx >= 0) {
				return idx;
			}
		}
		if (tit) {
			const idx = kws.findIndex((k) => tit.includes(k) || k.includes(tit));
			if (idx >= 0) {
				return idx;
			}
		}
		return -1;
	}

	/**
	 * @param {Record<string, unknown>} row
	 * @param {unknown[] | null} batchesCache
	 * @param {number} [slotIndex] Zero-based slot when batch anchor + scheduleTime cadence apply.
	 * @returns {string}
	 */
	function wnawResolveArticleScheduledTime(row, batchesCache, slotIndex) {
		const slot = Number.isFinite(Number(slotIndex)) ? Math.max(0, Number(slotIndex)) : 0;
		const base = row.publishedStartDateTime != null ? String(row.publishedStartDateTime).trim() : '';
		let sched = row.scheduleTime != null ? String(row.scheduleTime).trim() : '';
		if (!sched && row.schedule_time != null) {
			sched = String(row.schedule_time).trim();
		}
		if (base && wnawIsSaasBatchScheduleFrequency(sched)) {
			const computed = wnawComputeSlotFromPublishedStartMysql(base, sched, slot);
			if (computed) {
				return computed;
			}
		}
		const fromApi = row.scheduledTime != null ? String(row.scheduledTime).trim() : '';
		if (fromApi && !wnawIsSaasBatchScheduleFrequency(fromApi)) {
			return fromApi;
		}
		const batchId = row.batchId != null ? String(row.batchId).trim() : '';
		if (!batchId) {
			return '';
		}
		const snap = wnawFindBatchSnapshot(batchId, batchesCache);
		if (!snap) {
			return '';
		}
		const slots = wnawArticleScheduledSlotsFromSnapshot(snap);
		if (!slots.length) {
			return '';
		}
		const idx = wnawKeywordIndexInSnapshot(snap, row.keyword, row.title);
		if (idx < 0 || idx >= slots.length) {
			return '';
		}
		return slots[idx];
	}

	/**
	 * @param {Record<string, unknown>} cfgAdmin
	 * @returns {Promise<unknown[] | null>}
	 */
	async function wnawFetchBatchesCache() {
		const dbRows = await wnawDbLoadJobs();
		return dbRows && dbRows.length ? dbRows : null;
	}

	function initConnectOtpUi() {
		const openBtn = document.querySelector('[data-wnaw-open-modal]');
		const overlay = document.querySelector('[data-wnaw-modal-overlay]');
		const modalSignup = document.querySelector('[data-wnaw-modal="signup"]');
		const modalOtp = document.querySelector('[data-wnaw-modal="otp"]');
		const closeEls = document.querySelectorAll('[data-wnaw-close-modal]');

		const formSignup = document.querySelector('[data-wnaw-signup-form]');
		const formOtp = document.querySelector('[data-wnaw-otp-form]');
		const emailInput = document.getElementById('wnaw-email');
		const otpInput = document.getElementById('wnaw-otp');
		const noticeSignup = document.querySelector('[data-wnaw-signup-notice]');
		const noticeOtp = document.querySelector('[data-wnaw-otp-notice]');
		const noticeOtpSent = document.querySelector('[data-wnaw-otp-sent]');
		const submitSignup = formSignup ? formSignup.querySelector('[data-wnaw-submit]') : null;
		const submitOtp = formOtp ? formOtp.querySelector('[data-wnaw-otp-submit]') : null;
		const otpSubmitWrap = formOtp ? formOtp.querySelector('[data-wnaw-otp-submit-wrap]') : null;
		const generateActions = document.querySelector('[data-wnaw-generate-actions]');

		if (!openBtn || !overlay || !modalSignup || !modalOtp) {
			return;
		}

		let lastActiveEl = null;
		/** @type {string} */
		let pendingVerifyEmail = '';
		/** @type {string} */
		let pendingUserId = '';

	/**
	 * @param {HTMLElement | null} el
	 * @param {string} message
	 * @param {string} type
	 */
	const setNotice = (el, message, type) => {
		if (!el) {
			return;
		}
		el.removeAttribute('hidden');
		el.textContent = message;
		el.setAttribute('data-wnaw-notice-type', type);
		el.setAttribute('role', 'status');
	};

	/**
	 * @param {HTMLElement | null} el
	 */
	const clearNotice = (el) => {
		if (!el) {
			return;
		}
		el.setAttribute('hidden', '');
		el.textContent = '';
		el.removeAttribute('data-wnaw-notice-type');
	};

		const clearAllNotices = () => {
		clearNotice(noticeSignup);
		clearNotice(noticeOtp);
	};

	/**
	 * Show OTP submit row; hide Generate until verification succeeds.
	 */
	const resetOtpVerifiedUi = () => {
		if (otpSubmitWrap) {
			otpSubmitWrap.removeAttribute('hidden');
		}
		if (generateActions) {
			generateActions.setAttribute('hidden', '');
		}
	};

	/**
	 * Toggle loading state and swap button label text.
	 *
	 * @param {HTMLButtonElement | null} btn
	 * @param {boolean} busy
	 * @param {string} busyLabel
	 */
	const setButtonLoading = (btn, busy, busyLabel) => {
		if (!btn) return;
		const label = btn.querySelector('.whoneedsawriter__btn-label');
		if (label) {
			if (!btn.dataset.wnawDefaultLabel) {
				btn.dataset.wnawDefaultLabel = label.textContent || '';
			}
			label.textContent = busy ? busyLabel : btn.dataset.wnawDefaultLabel;
		}
		btn.classList.toggle('is-loading', busy);
		btn.setAttribute('aria-busy', busy ? 'true' : 'false');
	};

	/**
	 * @param {boolean} busy
	 */
	const setSignupLoading = (busy) => {
		if (submitSignup) {
			submitSignup.disabled = busy;
			setButtonLoading(submitSignup, busy, 'Submitting...');
		}
		if (formSignup) {
			formSignup.querySelectorAll('input, button').forEach((el) => {
				if (submitSignup && el === submitSignup) {
					return;
				}
				if (busy) {
					el.setAttribute('disabled', 'disabled');
				} else {
					el.removeAttribute('disabled');
				}
			});
		}
	};

	/**
	 * @param {boolean} busy
	 */
	const setOtpLoading = (busy) => {
		if (submitOtp) {
			submitOtp.disabled = busy;
			setButtonLoading(submitOtp, busy, 'Verifying...');
		}
		if (formOtp) {
			formOtp.querySelectorAll('input, button').forEach((el) => {
				if (submitOtp && el === submitOtp) {
					return;
				}
				if (busy) {
					el.setAttribute('disabled', 'disabled');
				} else {
					el.removeAttribute('disabled');
				}
			});
		}
	};

	const isAnyModalOpen = () =>
		!modalSignup.hasAttribute('hidden') || !modalOtp.hasAttribute('hidden');

	const closeAllModals = () => {
		if (!isAnyModalOpen()) {
			return;
		}
		clearAllNotices();
		pendingUserId = '';
		resetOtpVerifiedUi();
		modalSignup.setAttribute('hidden', '');
		modalOtp.setAttribute('hidden', '');
		overlay.setAttribute('hidden', '');
		document.body.classList.remove('wnaw-modal-open');
		pendingVerifyEmail = '';
		if (otpInput) {
			otpInput.value = '';
		}
		if (lastActiveEl && typeof lastActiveEl.focus === 'function') {
			lastActiveEl.focus();
		}
		lastActiveEl = null;
	};

	const showOverlay = () => {
		overlay.removeAttribute('hidden');
		document.body.classList.add('wnaw-modal-open');
	};

	/**
	 * Open signup modal (from hero CTA).
	 */
	const openSignupModal = () => {
		pendingVerifyEmail = '';
		pendingUserId = '';
		clearAllNotices();
		resetOtpVerifiedUi();
		if (modalOtp) {
			modalOtp.setAttribute('hidden', '');
		}
		if (otpInput) {
			otpInput.value = '';
		}
		lastActiveEl = document.activeElement;
		showOverlay();
		modalSignup.removeAttribute('hidden');
		window.setTimeout(() => {
			if (emailInput) {
				emailInput.focus();
			}
		}, 0);
	};

	/**
	 * After successful signup, show OTP step.
	 *
	 * @param {string} email
	 */
	const openOtpModal = (email) => {
		pendingVerifyEmail = email;
		clearAllNotices();
		resetOtpVerifiedUi();
		if (noticeOtpSent) {
			const s = (c && c.strings) || {};
			if (s.otpSent) {
				noticeOtpSent.textContent = String(s.otpSent);
			}
			noticeOtpSent.removeAttribute('hidden');
			noticeOtpSent.setAttribute('data-wnaw-notice-type', 'success');
		}
		modalSignup.setAttribute('hidden', '');
		if (otpInput) {
			otpInput.value = '';
		}
		showOverlay();
		modalOtp.removeAttribute('hidden');
		window.setTimeout(() => {
			if (otpInput) {
				otpInput.focus();
			}
		}, 0);
	};

	openBtn.addEventListener('click', openSignupModal);
	closeEls.forEach((btn) => {
		btn.addEventListener('click', closeAllModals);
	});
	overlay.addEventListener('click', closeAllModals);

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isAnyModalOpen()) {
			closeAllModals();
		}
	});

	if (!cfg || !cfg.ajaxUrl) {
		return;
	}

	/** @type {Record<string, string | undefined> & { strings?: Record<string, string> }} */
	const c = cfg;

	const actionSignup = c.actionSignup || c.action;
	const nonceSignup = c.nonceSignup || c.nonce;
	const actionVerify = c.actionVerify;
	const nonceVerify = c.nonceVerify;

	if (!formSignup || !actionSignup || !nonceSignup) {
		return;
	}

	formSignup.addEventListener('submit', async (e) => {
		e.preventDefault();
		clearNotice(noticeSignup);

		const s = c.strings || {};
		const str = {
			invalidEmail: s.invalidEmail || 'Invalid email.',
			otpSent: s.otpSent || s.success || 'OTP sent.',
			genericError: s.genericError || 'Error.',
			networkError: s.networkError || 'Network error.',
		};

		if (!emailInput) {
			setNotice(noticeSignup, str.genericError, 'error');
			return;
		}

		const value = (emailInput.value || '').trim();
		emailInput.value = value;
		if (typeof emailInput.checkValidity === 'function' && !emailInput.checkValidity()) {
			emailInput.reportValidity();
			return;
		}
		if (!value) {
			setNotice(noticeSignup, str.invalidEmail, 'error');
			return;
		}

		const params = new URLSearchParams();
		params.set('action', String(actionSignup));
		params.set('nonce', String(nonceSignup));
		params.set('email', value);

		setSignupLoading(true);

		try {
			const res = await fetch(String(c.ajaxUrl), {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				},
				body: params.toString(),
			});

			/** @type {{ success?: boolean; data?: { message?: string; email?: string; userId?: string } }} */
			let json = {};
			try {
				json = await res.json();
			} catch (e) {
				setNotice(noticeSignup, str.genericError, 'error');
				return;
			}

			if (json && json.success) {
				const serverEmail = json.data && json.data.email ? String(json.data.email) : value;
				const userId = json.data && json.data.userId ? String(json.data.userId) : '';
				pendingUserId = userId;
				openOtpModal(serverEmail);
				return;
			}

			const errMsg = json && json.data && json.data.message ? String(json.data.message) : str.genericError;
			setNotice(noticeSignup, errMsg, 'error');
		} catch {
			setNotice(noticeSignup, str.networkError, 'error');
		} finally {
			setSignupLoading(false);
		}
	});

	if (!formOtp || !actionVerify || !nonceVerify) {
		return;
	}

		formOtp.addEventListener('submit', async (e) => {
		e.preventDefault();
		clearNotice(noticeOtp);

		const s = c.strings || {};
		const str = {
			invalidOtp: s.invalidOtp || 'Invalid code.',
			verifySuccess: s.verifySuccess || 'Success.',
			genericError: s.genericError || 'Error.',
			networkError: s.networkError || 'Network error.',
		};

		if (!pendingUserId) {
			setNotice(noticeOtp, str.genericError, 'error');
			return;
		}
		if (!otpInput) {
			setNotice(noticeOtp, str.genericError, 'error');
			return;
		}

		const code = (otpInput.value || '').trim();
		otpInput.value = code;
		if (typeof otpInput.checkValidity === 'function' && !otpInput.checkValidity()) {
			otpInput.reportValidity();
			return;
		}
		if (!code) {
			setNotice(noticeOtp, str.invalidOtp, 'error');
			return;
		}

		const params = new URLSearchParams();
		params.set('action', String(actionVerify));
		params.set('nonce', String(nonceVerify));
		params.set('userId', pendingUserId);
		params.set('otp', code);
		if (pendingVerifyEmail && String(pendingVerifyEmail).trim() !== '') {
			params.set('email', String(pendingVerifyEmail).trim());
		}

		setOtpLoading(true);

		try {
			const res = await fetch(String(c.ajaxUrl), {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				},
				body: params.toString(),
			});

			/** @type {{ success?: boolean; data?: { message?: string } }} */
			let json = {};
			try {
				json = await res.json();
			} catch (err) {
				setNotice(noticeOtp, str.genericError, 'error');
				return;
			}

			if (json && json.success) {
				const msg = json.data && json.data.message ? String(json.data.message) : str.verifySuccess;
				setNotice(noticeOtp, msg, 'success');
				if (otpSubmitWrap) {
					otpSubmitWrap.setAttribute('hidden', '');
				}
				if (generateActions) {
					generateActions.removeAttribute('hidden');
				}

				const genUrl = cfg.generateUrl ? String(cfg.generateUrl) : '';
				if (genUrl) {
					setTimeout(function () {
						const sep = genUrl.indexOf('?') >= 0 ? '&' : '?';
						window.location.assign(genUrl + sep + 'wnaw_connected=1');
					}, 1200);
				}
				return;
			}

			const errMsg = json && json.data && json.data.message ? String(json.data.message) : str.genericError;
			setNotice(noticeOtp, errMsg, 'error');
		} catch {
			setNotice(noticeOtp, str.networkError, 'error');
		} finally {
			setOtpLoading(false);
		}
		});
	}

	initConnectOtpUi();

	/**
	 * Generate Article page UI controller (UI only for now).
	 */
	(function initGenerateArticleUi() {
		const root = document.querySelector('[data-wnaw-generate]');
		if (!root) return;

		const creditsEl = document.querySelector('[data-wnaw-credits]');

		const modelBtn = root.querySelector('[data-wnaw-model-button]');
		const modelMenu = root.querySelector('[data-wnaw-model-menu]');
		const modelSelected = root.querySelector('[data-wnaw-model-selected]');
		const modelValue = root.querySelector('[data-wnaw-model-value]');
		const modelItems = root.querySelectorAll('[data-wnaw-model]');
		const range = root.querySelector('[data-wnaw-word-range]');
		const rangeValue = root.querySelector('[data-wnaw-word-value]');
		const pills = root.querySelectorAll('[data-wnaw-opt]');
		const refPill = root.querySelector('[data-wnaw-ref]');
		const optInputs = root.querySelectorAll('[data-wnaw-opt-value]');
		const kwList = root.querySelector('[data-wnaw-kw-list]');
		const kwAdd = root.querySelector('[data-wnaw-kw-add]');
		const kwTemplate = root.querySelector('[data-wnaw-kw-template]');
		const kwModeRoot = root.querySelector('[data-wnaw-kw-mode-root]');
		const kwModeBtns = root.querySelectorAll('[data-wnaw-kw-mode-btn]');
		const kwBulkTextarea = /** @type {HTMLTextAreaElement | null} */ (root.querySelector('[data-wnaw-kw-bulk-textarea]'));
		const kwBulkCategory = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-wnaw-kw-bulk-category]'));
		const kwBulkAuthor = /** @type {HTMLSelectElement | null} */ (root.querySelector('[data-wnaw-kw-bulk-author]'));
		const kwBulkCredits = root.querySelector('[data-wnaw-kw-bulk-credits]');
		const kwSplitCredits = root.querySelector('[data-wnaw-kw-split-credits]');
		const publishRoot = root.querySelector('[data-wnaw-publish]');
		const scheduleWrap = root.querySelector('[data-wnaw-schedule]');
		const freqRadios = root.querySelectorAll('[data-wnaw-frequency]');
		/** @type {HTMLInputElement | null} */
		const schedDateInput = root.querySelector('[data-wnaw-schedset-date-input]');
		const schedDateWrap = root.querySelector('[data-wnaw-schedset-date-wrap]');
		const schedDateDisplay = root.querySelector('[data-wnaw-schedset-date-display]');
		/** @type {HTMLSelectElement | null} */
		const schedTimeSelect = root.querySelector('[data-wnaw-schedset-time-select]');
		const schedPreviewList = root.querySelector('[data-wnaw-schedset-preview-list]');
		const schedTzLabel = root.querySelector('[data-wnaw-schedset-tz]');

		const readInitialModel = () => {
			const fromHidden = modelValue ? String(modelValue.value || '') : '';
			if (fromHidden === 'lite' || fromHidden === 'core' || fromHidden === 'pro') {
				return /** @type {'lite'|'core'|'pro'} */ (fromHidden);
			}
			const ds = root.getAttribute('data-wnaw-initial-model') || '';
			if (ds === 'lite' || ds === 'core' || ds === 'pro') {
				return /** @type {'lite'|'core'|'pro'} */ (ds);
			}
			return 'core';
		};

		/** @type {'lite'|'core'|'pro'} */
		let model = readInitialModel();
		let referencesOn = false;
		let pendingAssignedBatch = '';
		let pendingAssignedBatchName = '';
		let balanceCredits = 0;
		let balanceType = 'freeCredits';
		const maxKeywords = 10;

		const getKwMode = () => {
			const m = kwModeRoot ? String(kwModeRoot.getAttribute('data-wnaw-kw-mode') || '') : '';
			return m === 'split' ? 'split' : 'bulk';
		};

		const getKeywordRows = () => (kwList ? kwList.querySelectorAll('[data-wnaw-kw-row]') : []);

		const getBulkKeywordList = () => {
			if (!kwBulkTextarea) return [];
			return String(kwBulkTextarea.value || '')
				.split(/\r?\n/)
				.map((s) => s.trim())
				.filter(Boolean);
		};

		const countKeywords = () => {
			if (getKwMode() === 'bulk') {
				return getBulkKeywordList().length;
			}
			let n = 0;
			getKeywordRows().forEach((row) => {
				const kwInput = row.querySelector('[data-wnaw-kw-keyword]');
				const v = (kwInput && kwInput.value ? String(kwInput.value) : '').trim();
				if (v) n += 1;
			});
			return n;
		};

		const formatCreditsText = (total) => {
			const cost = model === 'lite' ? 0.1 : model === 'core' ? 1 : 2;
			const credits = Math.round(total * cost * 10) / 10;
			const label = credits === 1 ? 'credit' : 'credits';
			return `${credits} ${label}`;
		};

		const etaEls = root.querySelectorAll('.whoneedsawriter__kwpanel-eta');

		const updateKeywordUi = () => {
			if (kwAdd && kwList) {
				const count = getKeywordRows().length;
				const atMax = count >= maxKeywords;
				kwAdd.disabled = atMax;
				kwAdd.setAttribute('aria-disabled', atMax ? 'true' : 'false');
			}
			const mode = getKwMode();
			let totalKw = 0;
			if (kwBulkCredits) {
				const total = Math.min(maxKeywords, getBulkKeywordList().length);
				kwBulkCredits.textContent = formatCreditsText(total);
				if (mode === 'bulk') totalKw = total;
			}
			if (kwSplitCredits) {
				let n = 0;
				getKeywordRows().forEach((row) => {
					const kwInput = row.querySelector('[data-wnaw-kw-keyword]');
					const v = (kwInput && kwInput.value ? String(kwInput.value) : '').trim();
					if (v) n += 1;
				});
				kwSplitCredits.textContent = formatCreditsText(Math.min(maxKeywords, n));
				if (mode !== 'bulk') totalKw = Math.min(maxKeywords, n);
			}
			etaEls.forEach(function (el) {
				/** @type {HTMLElement} */ (el).style.display = totalKw > 0 ? 'inline-flex' : 'none';
			});
			void mode;
			updateSchedulePreview();
		};

		/* -------------------- Schedule Settings (functional) -------------------- */

		const SCHED_MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

		/** Format "YYYY-MM-DD" → "May 20, 2025". */
		const formatScheduleDate = (yyyymmdd) => {
			if (!yyyymmdd) return '';
			const parts = String(yyyymmdd).split('-');
			if (parts.length !== 3) return '';
			const y = parseInt(parts[0], 10);
			const m = parseInt(parts[1], 10);
			const d = parseInt(parts[2], 10);
			if (!isFinite(y) || !isFinite(m) || !isFinite(d) || m < 1 || m > 12) return '';
			return `${SCHED_MONTH_LABELS[m - 1]} ${d}, ${y}`;
		};

		/** Format a Date object → "May 20, 2025". */
		const formatScheduleDateObj = (d) => {
			if (!(d instanceof Date) || isNaN(d.getTime())) return '';
			return `${SCHED_MONTH_LABELS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
		};

		/** Format 24h H/M into "h:MM AM". */
		const formatTime12 = (hh, mm) => {
			const ampm = hh >= 12 ? 'PM' : 'AM';
			let h12 = hh % 12;
			if (h12 === 0) h12 = 12;
			return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
		};

		/** Return the currently selected frequency ("daily"|"weekly"|"monthly"). */
		const getSelectedFrequency = () => {
			let freq = 'daily';
			freqRadios.forEach((r) => {
				const rr = /** @type {HTMLInputElement} */ (r);
				if (rr.checked) freq = rr.value;
			});
			return freq;
		};

		/** Today's local date as "YYYY-MM-DD". */
		const todayLocalIso = () => {
			const t = new Date();
			const y = t.getFullYear();
			const m = String(t.getMonth() + 1).padStart(2, '0');
			const d = String(t.getDate()).padStart(2, '0');
			return `${y}-${m}-${d}`;
		};

		/** Tomorrow's local date as "YYYY-MM-DD". */
		const tomorrowLocalIso = () => {
			const t = new Date();
			t.setDate(t.getDate() + 1);
			const y = t.getFullYear();
			const m = String(t.getMonth() + 1).padStart(2, '0');
			const d = String(t.getDate()).padStart(2, '0');
			return `${y}-${m}-${d}`;
		};

		/**
		 * Build hourly time options for the given local date (YYYY-MM-DD).
		 *
		 * - For today: anchor at (now + 30 min) and list hourly slots until end of day,
		 *   so past/too-soon times never appear in the dropdown.
		 * - For any future date: list a clean hourly 00:00 … 23:00 set (no restriction).
		 *
		 * Tries to preserve the previously selected value if still valid; otherwise
		 * defaults to the first option.
		 *
		 * @param {string} [selectedDateIso] YYYY-MM-DD; defaults to the date input value.
		 */
		const buildTimeOptions = (selectedDateIso) => {
			if (!schedTimeSelect) return;
			const today = todayLocalIso();
			const dateIso =
				selectedDateIso != null && String(selectedDateIso) !== ''
					? String(selectedDateIso)
					: schedDateInput && schedDateInput.value
						? String(schedDateInput.value)
						: today;
			const isToday = dateIso === today;
			const isPast = dateIso < today;

			const previousValue = schedTimeSelect.value;
			schedTimeSelect.innerHTML = '';

			/** @type {{ value: string; label: string }[]} */
			const opts = [];

			if (isToday) {
				const now = new Date();
				const start = new Date(now.getTime() + 30 * 60 * 1000);
				start.setSeconds(0, 0);
				let h = start.getHours();
				const m = start.getMinutes();
				/* If the anchor already rolled past midnight (now + 30 min ≥ next day),
				 * the day is effectively over -- leave the dropdown empty. The user
				 * should pick a later date. */
				const rolledToTomorrow = start.getDate() !== now.getDate() || start.getMonth() !== now.getMonth() || start.getFullYear() !== now.getFullYear();
				if (!rolledToTomorrow) {
					while (h < 24) {
						const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
						opts.push({ value, label: formatTime12(h, m) });
						h += 1;
					}
				}
			} else if (!isPast) {
				for (let h = 0; h < 24; h++) {
					const value = `${String(h).padStart(2, '0')}:00`;
					opts.push({ value, label: formatTime12(h, 0) });
				}
			}

			opts.forEach((o) => {
				const opt = document.createElement('option');
				opt.value = o.value;
				opt.textContent = o.label;
				schedTimeSelect.appendChild(opt);
			});

			if (previousValue && opts.some((o) => o.value === previousValue)) {
				schedTimeSelect.value = previousValue;
			} else if (schedTimeSelect.options.length > 0) {
				schedTimeSelect.selectedIndex = 0;
			}
		};

		/** Apply the local timezone offset to the legend (e.g., "(UTC +05:30)"). */
		const applyTimezoneLabel = () => {
			if (!schedTzLabel) return;
			const offsetMin = -new Date().getTimezoneOffset();
			const sign = offsetMin >= 0 ? '+' : '-';
			const abs = Math.abs(offsetMin);
			const hh = String(Math.floor(abs / 60)).padStart(2, '0');
			const mm = String(abs % 60).padStart(2, '0');
			const tzOffset = `UTC ${sign}${hh}:${mm}`;
			const base = String(schedTzLabel.textContent || 'All times are in your timezone').replace(/[\.\s]+$/, '');
			schedTzLabel.textContent = `${base} (${tzOffset})`;
		};

		/** Compute the publish date for the i-th keyword (0-based) given the start. */
		const computeOccurrence = (startDate, freq, i) => {
			const d = new Date(startDate.getTime());
			if (freq === 'weekly') d.setDate(d.getDate() + i * 7);
			else if (freq === 'monthly') d.setMonth(d.getMonth() + i);
			else d.setDate(d.getDate() + i);
			return d;
		};

		/** Rebuild the preview list based on keyword count, date, time and frequency. */
		const updateSchedulePreview = () => {
			if (!schedPreviewList) return;
			const n = countKeywords();
			const dateStr = schedDateInput && schedDateInput.value ? String(schedDateInput.value) : '';
			const timeStr = schedTimeSelect && schedTimeSelect.value ? String(schedTimeSelect.value) : '';

			schedPreviewList.innerHTML = '';

			if (n < 1 || !dateStr || !timeStr) {
				const li = document.createElement('li');
				li.className = 'whoneedsawriter__schedset-preview-item whoneedsawriter__schedset-preview-item--empty';
				const span = document.createElement('span');
				span.className = 'whoneedsawriter__schedset-preview-text whoneedsawriter__schedset-preview-text--muted';
				span.textContent = (cfg.strings && cfg.strings.schedPreviewEmpty)
					? String(cfg.strings.schedPreviewEmpty)
					: 'Add at least one keyword to see the publishing schedule.';
				li.appendChild(span);
				schedPreviewList.appendChild(li);
				return;
			}

			const freq = getSelectedFrequency();
			const dateParts = dateStr.split('-').map((p) => parseInt(p, 10));
			const timeParts = timeStr.split(':').map((p) => parseInt(p, 10));
			if (dateParts.length !== 3 || timeParts.length !== 2) return;
			const startDate = new Date(
				dateParts[0],
				dateParts[1] - 1,
				dateParts[2],
				timeParts[0] || 0,
				timeParts[1] || 0,
				0,
				0
			);
			if (isNaN(startDate.getTime())) return;

			/** @type {{ num: string | number; date: Date | null; gap: number | null }[]} */
			const items = [];
			if (n <= 5) {
				for (let i = 0; i < n; i++) {
					items.push({ num: i + 1, date: computeOccurrence(startDate, freq, i), gap: null });
				}
			} else {
				for (let i = 0; i < 3; i++) {
					items.push({ num: i + 1, date: computeOccurrence(startDate, freq, i), gap: null });
				}
				items.push({ num: '···', date: null, gap: n - 4 });
				items.push({ num: n, date: computeOccurrence(startDate, freq, n - 1), gap: null });
			}

			const dotChar = '\u00B7';
			items.forEach((it) => {
				const li = document.createElement('li');
				li.className = 'whoneedsawriter__schedset-preview-item';
				if (it.gap !== null) li.classList.add('whoneedsawriter__schedset-preview-item--gap');

				const numSpan = document.createElement('span');
				numSpan.className = 'whoneedsawriter__schedset-preview-num';
				if (it.gap !== null) numSpan.classList.add('whoneedsawriter__schedset-preview-num--gap');
				numSpan.textContent = String(it.num);
				li.appendChild(numSpan);

				const textSpan = document.createElement('span');
				textSpan.className = 'whoneedsawriter__schedset-preview-text';
				if (it.gap !== null) {
					textSpan.classList.add('whoneedsawriter__schedset-preview-text--muted');
					const tmpl = (cfg.strings && cfg.strings.schedPreviewGap)
						? String(cfg.strings.schedPreviewGap)
						: 'and %d more';
					textSpan.textContent = tmpl.replace('%d', String(it.gap));
				} else if (it.date) {
					const dateLabel = formatScheduleDateObj(it.date);
					const timeLabel = formatTime12(it.date.getHours(), it.date.getMinutes());
					textSpan.appendChild(document.createTextNode(`${dateLabel} `));
					const dot = document.createElement('span');
					dot.className = 'whoneedsawriter__schedset-preview-dot';
					dot.textContent = dotChar;
					textSpan.appendChild(dot);
					textSpan.appendChild(document.createTextNode(` ${timeLabel}`));
				}
				li.appendChild(textSpan);
				schedPreviewList.appendChild(li);
			});
		};

		/* Initialize schedule UI (time options + default date + listeners). */
		if (schedDateInput) {
			const tomorrow = tomorrowLocalIso();
			schedDateInput.value = tomorrow;
			schedDateInput.setAttribute('min', tomorrow);
			if (schedDateDisplay) schedDateDisplay.textContent = formatScheduleDate(tomorrow);
			schedDateInput.addEventListener('change', () => {
				const v = schedDateInput.value || tomorrowLocalIso();
				if (schedDateDisplay) schedDateDisplay.textContent = formatScheduleDate(v);
				buildTimeOptions(v);
				updateSchedulePreview();
			});
		}
		if (schedTimeSelect) {
			buildTimeOptions(schedDateInput && schedDateInput.value ? schedDateInput.value : undefined);
			schedTimeSelect.addEventListener('change', updateSchedulePreview);
		}
		/* Open the native date picker reliably across browsers. The transparent
		 * <input type="date"> overlay sometimes ignores clicks that originate on
		 * sibling spans (esp. on Firefox/Safari), so we always trigger the picker
		 * programmatically via showPicker() when the wrapper is clicked. */
		if (schedDateWrap && schedDateInput) {
			schedDateWrap.addEventListener('click', () => {
				const inp = /** @type {HTMLInputElement & { showPicker?: () => void }} */ (schedDateInput);
				if (typeof inp.showPicker === 'function') {
					try {
						inp.showPicker();
						return;
					} catch (e) {
						/* Browser denied (e.g., not focused / non-user gesture). Fall through. */
					}
				}
				try {
					inp.focus();
					inp.click();
				} catch (e) {
					/* noop */
				}
			});
		}
		freqRadios.forEach((r) => {
			r.addEventListener('change', updateSchedulePreview);
		});
		applyTimezoneLabel();

		/**
		 * @param {HTMLSelectElement | null} sel
		 * @param {string} val
		 */
		const selectOptionIfExists = (sel, val) => {
			if (!sel || val === undefined || val === null || String(val) === '') return;
			const v = String(val);
			const opts = sel.querySelectorAll('option');
			for (let i = 0; i < opts.length; i++) {
				if (opts[i].value === v) {
					sel.value = v;
					return;
				}
			}
		};

		/**
		 * @param {{ keyword?: string; category?: string; author?: string }} [prefill]
		 */
		const addKeywordRow = (prefill) => {
			if (!kwList || !kwAdd) return;
			if (getKeywordRows().length >= maxKeywords) return;

			let row = null;

			if (kwTemplate && 'content' in kwTemplate) {
				const frag = /** @type {HTMLTemplateElement} */ (kwTemplate).content.cloneNode(true);
				const el = frag.querySelector('[data-wnaw-kw-row]');
				if (el) {
					row = /** @type {HTMLElement} */ (el);
				}
				kwList.appendChild(frag);
			}

			if (!row) {
				// Fallback (should not happen): no template found.
				row = document.createElement('div');
				row.className = 'whoneedsawriter__kw-row';
				row.setAttribute('data-wnaw-kw-row', '');
				kwList.appendChild(row);
			}

			/** @type {HTMLInputElement | null} */
			const keyword = row.querySelector('[data-wnaw-kw-keyword]');
			/** @type {HTMLSelectElement | null} */
			const category = row.querySelector('[data-wnaw-kw-category]');
			/** @type {HTMLSelectElement | null} */
			const author = row.querySelector('[data-wnaw-kw-author]');
			const del = row.querySelector('[data-wnaw-kw-del]');

			if (keyword) keyword.value = (prefill && prefill.keyword) || '';

			if (category) {
				if (prefill && prefill.category) {
					selectOptionIfExists(category, String(prefill.category));
				} else {
					const dc = kwList.getAttribute('data-wnaw-default-category') || '';
					selectOptionIfExists(category, dc);
				}
			}
			if (author) {
				if (prefill && prefill.author) {
					selectOptionIfExists(author, String(prefill.author));
				} else {
					const da = kwList.getAttribute('data-wnaw-default-author') || '';
					selectOptionIfExists(author, da);
				}
			}

			if (del) {
				del.addEventListener('click', () => {
					row?.remove();
					updateKeywordUi();
				});
			}

			updateKeywordUi();
		};

		/**
		 * @param {string} key
		 * @param {boolean} on
		 */
		const setOptValue = (key, on) => {
			optInputs.forEach((i) => {
				if (i.getAttribute('data-wnaw-opt-value') === key) {
					/** @type {HTMLInputElement} */ (i).value = on ? '1' : '0';
				}
			});
		};

		const setHiddenByModel = () => {
			root.querySelectorAll('[data-wnaw-visible]').forEach((el) => {
				const visible = String(el.getAttribute('data-wnaw-visible') || '')
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean);
				const show = visible.includes(model);
				if (!show) {
					el.setAttribute('hidden', '');
					el.classList.remove('is-on');
					el.setAttribute('aria-pressed', 'false');
					const key = el.getAttribute('data-wnaw-opt');
					if (key) setOptValue(key, false);
				} else {
					el.removeAttribute('hidden');
				}
			});

			root.querySelectorAll('[data-wnaw-pro-only]').forEach((el) => {
				const isPro = model === 'pro';
				if (isPro) {
					el.classList.remove('is-locked');
					el.removeAttribute('aria-disabled');
				} else {
					el.classList.add('is-locked');
					el.classList.remove('is-on');
					el.setAttribute('aria-pressed', 'false');
					el.setAttribute('aria-disabled', 'true');
					const key = el.getAttribute('data-wnaw-opt');
					if (key) setOptValue(key, false);
					if (el === refPill) {
						referencesOn = false;
					}
				}
			});

			root.querySelectorAll('[data-wnaw-core-only]').forEach((el) => {
				const isCoreOrPro = model === 'core' || model === 'pro';
				const subEl = el.querySelector('.whoneedsawriter__optset-rowsub');
				const defaultSub = subEl
					? String(subEl.getAttribute('data-wnaw-rowsub-default') || subEl.textContent || '').trim()
					: '';
				const lockedSub = String(el.getAttribute('data-wnaw-core-locked-sub') || 'Available from 1a Core').trim();

				if (isCoreOrPro) {
					el.classList.remove('is-locked');
					el.removeAttribute('aria-disabled');
					if (subEl && defaultSub) {
						subEl.textContent = defaultSub;
					}
				} else {
					el.classList.add('is-locked');
					el.classList.remove('is-on');
					el.setAttribute('aria-pressed', 'false');
					el.setAttribute('aria-disabled', 'true');
					if (subEl && lockedSub) {
						subEl.textContent = lockedSub;
					}
					const key = el.getAttribute('data-wnaw-opt');
					if (key) setOptValue(key, false);
				}
			});
		};

		const closeMenu = () => {
			if (!modelBtn || !modelMenu) return;
			modelBtn.setAttribute('aria-expanded', 'false');
			modelMenu.setAttribute('hidden', '');
		};

		const openMenu = () => {
			if (!modelBtn || !modelMenu) return;
			modelBtn.setAttribute('aria-expanded', 'true');
			modelMenu.removeAttribute('hidden');
		};

		const setModel = (next) => {
			model = next;
			if (modelValue) modelValue.value = next;
			if (modelSelected) {
				modelSelected.textContent = next === 'lite' ? '1a Lite' : next === 'core' ? '1a Core' : '1a Pro';
			}
			modelItems.forEach((item) => {
				const isSelected = item.getAttribute('data-wnaw-model') === next;
				item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
				const check = item.querySelector('.whoneedsawriter__check');
				if (check) check.remove();
				if (isSelected) {
					const c = document.createElement('span');
					c.className = 'whoneedsawriter__check';
					c.setAttribute('aria-hidden', 'true');
					item.appendChild(c);
				}
			});
			setHiddenByModel();
			updateKeywordUi();
		};

		const setKwMode = (next) => {
			const mode = next === 'split' ? 'split' : 'bulk';
			if (kwModeRoot) kwModeRoot.setAttribute('data-wnaw-kw-mode', mode);
			kwModeBtns.forEach((btn) => {
				const isOn = btn.getAttribute('data-wnaw-kw-mode-btn') === mode;
				btn.classList.toggle('is-on', isOn);
				btn.setAttribute('aria-selected', isOn ? 'true' : 'false');
			});
			root.querySelectorAll('[data-wnaw-kw-panel]').forEach((panel) => {
				const isOn = panel.getAttribute('data-wnaw-kw-panel') === mode;
				if (isOn) panel.removeAttribute('hidden');
				else panel.setAttribute('hidden', '');
			});
			if (mode === 'split' && kwList && getKeywordRows().length === 0) {
				addKeywordRow();
			}
			updateKeywordUi();
		};

		if (range && rangeValue) {
			const w0 = parseInt(String(root.getAttribute('data-wnaw-initial-word') || range.value || '0'), 10);
			const clamped =
				Number.isFinite(w0) ? Math.min(3000, Math.max(0, Math.round(w0 / 50) * 50)) : parseInt(range.value, 10) || 0;
			range.value = String(clamped);
			const syncRange = () => {
				rangeValue.textContent = String(range.value);
			};
			range.addEventListener('input', syncRange);
			syncRange();
		}

		if (modelBtn && modelMenu) {
			modelBtn.addEventListener('click', () => {
				const expanded = modelBtn.getAttribute('aria-expanded') === 'true';
				if (expanded) closeMenu();
				else openMenu();
			});

			modelItems.forEach((item) => {
				item.addEventListener('click', () => {
					const next = item.getAttribute('data-wnaw-model');
					if (next === 'lite' || next === 'core' || next === 'pro') {
						setModel(next);
					}
					closeMenu();
				});
			});

			document.addEventListener('click', (e) => {
				const t = /** @type {Node} */ (e.target);
				if (!modelMenu.contains(t) && !modelBtn.contains(t)) closeMenu();
			});

			document.addEventListener('keydown', (e) => {
				if (e.key === 'Escape') closeMenu();
			});
		}

		pills.forEach((pill) => {
			pill.addEventListener('click', () => {
				if (pill.hasAttribute('hidden')) return;
				if (pill.classList.contains('is-locked')) return;
				const isRef = pill === refPill;
				if (isRef) {
					referencesOn = !referencesOn;
					pill.classList.toggle('is-on', referencesOn);
					pill.setAttribute('aria-pressed', referencesOn ? 'true' : 'false');
					setOptValue('references', referencesOn);
					return;
				}
				const on = !pill.classList.contains('is-on');
				pill.classList.toggle('is-on', on);
				pill.setAttribute('aria-pressed', on ? 'true' : 'false');
				const key = pill.getAttribute('data-wnaw-opt');
				if (key) setOptValue(key, on);
			});
		});

		// Default state from saved settings / server markup.
		setModel(readInitialModel());
		setOptValue('featured', true);
		setOptValue('infographics', false);
		setOptValue('external_links', false);
		setOptValue('references', false);
		setOptValue('humanize', false);

		// Optional settings: collapsible header.
		const optsetToggle = root.querySelector('[data-wnaw-optset-toggle]');
		const optsetBody = root.querySelector('[data-wnaw-optset-body]');
		if (optsetToggle && optsetBody) {
			optsetToggle.addEventListener('click', () => {
				const expanded = optsetToggle.getAttribute('aria-expanded') === 'true';
				const next = expanded ? 'false' : 'true';
				optsetToggle.setAttribute('aria-expanded', next);
				if (next === 'true') {
					optsetBody.removeAttribute('hidden');
				} else {
					optsetBody.setAttribute('hidden', '');
				}
			});
		}

		// Optional settings: humanize textarea character counter.
		const textcountInput = /** @type {HTMLTextAreaElement | null} */ (
			root.querySelector('[data-wnaw-textcount-input]')
		);
		const textcountDisplay = root.querySelector('[data-wnaw-textcount]');
		if (textcountInput && textcountDisplay) {
			const syncCount = () => {
				const len = String(textcountInput.value || '').length;
				textcountDisplay.textContent = String(len);
			};
			textcountInput.addEventListener('input', syncCount);
			syncCount();
		}

		// Keywords (UI-only). Start with one empty row in split mode.
		if (kwAdd && kwList) {
			kwAdd.addEventListener('click', () => addKeywordRow());
			addKeywordRow();
			updateKeywordUi();
		}

		// Mode toggle (Bulk / Split).
		if (kwModeBtns && kwModeBtns.length) {
			kwModeBtns.forEach((btn) => {
				btn.addEventListener('click', () => {
					const next = btn.getAttribute('data-wnaw-kw-mode-btn') || 'bulk';
					setKwMode(next);
				});
			});
			setKwMode(getKwMode());
		}

		// Bulk-mode live keyword count + credit prediction.
		if (kwBulkTextarea) {
			kwBulkTextarea.addEventListener('input', () => {
				updateKeywordUi();
			});
			updateKeywordUi();
		}

		/** Job detail "Regenerate" → ?wnaw_keywords= (bulk textarea). */
		const applyKeywordsFromQuery = () => {
			try {
				const params = new URLSearchParams(window.location.search);
				const raw = params.get('wnaw_keywords');
				if (!raw) return;
				const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
				if (!lines.length) return;
				setKwMode('bulk');
				if (kwBulkTextarea) {
					kwBulkTextarea.value = lines.join('\n');
					updateKeywordUi();
					kwBulkTextarea.focus();
					const panel = root.querySelector('[data-wnaw-kw-panel="bulk"]');
					if (panel && typeof panel.scrollIntoView === 'function') {
						panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
					}
				}
				params.delete('wnaw_keywords');
				const qs = params.toString();
				const clean = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
				window.history.replaceState({}, '', clean);
			} catch (e) {
				/* non-fatal */
			}
		};
		applyKeywordsFromQuery();

		// Split-mode: refresh credit prediction as the user types in any row.
		if (kwList) {
			kwList.addEventListener('input', (ev) => {
				const target = /** @type {HTMLElement | null} */ (ev.target);
				if (!target) return;
				if (target.matches('[data-wnaw-kw-keyword]')) {
					updateKeywordUi();
				}
			});
		}

		// Split-mode drag-and-drop reordering using HTML5 DnD.
		if (kwList) {
			let dragRow = null;
			kwList.addEventListener('dragstart', (ev) => {
				const target = /** @type {HTMLElement} */ (ev.target);
				const row = target.closest('[data-wnaw-kw-row]');
				if (!row) return;
				dragRow = /** @type {HTMLElement} */ (row);
				dragRow.classList.add('is-dragging');
				if (ev.dataTransfer) {
					ev.dataTransfer.effectAllowed = 'move';
					try { ev.dataTransfer.setData('text/plain', 'wnaw-kw'); } catch (e) { /* noop */ }
				}
			});
			kwList.addEventListener('dragover', (ev) => {
				if (!dragRow) return;
				ev.preventDefault();
				if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
				const target = /** @type {HTMLElement} */ (ev.target);
				const overRow = target.closest('[data-wnaw-kw-row]');
				if (!overRow || overRow === dragRow) return;
				const rect = /** @type {HTMLElement} */ (overRow).getBoundingClientRect();
				const before = ev.clientY < rect.top + rect.height / 2;
				if (before) overRow.parentNode.insertBefore(dragRow, overRow);
				else overRow.parentNode.insertBefore(dragRow, overRow.nextSibling);
			});
			kwList.addEventListener('dragend', () => {
				if (dragRow) dragRow.classList.remove('is-dragging');
				dragRow = null;
			});
		}

		// Publish Mode (UI-only).
		if (publishRoot && scheduleWrap) {
			const radios = publishRoot.querySelectorAll('[data-wnaw-publish-mode]');
			const syncSchedule = () => {
				let mode = 'draft';
				radios.forEach((r) => {
					const rr = /** @type {HTMLInputElement} */ (r);
					if (rr.checked) mode = rr.value;
				});
				if (mode === 'schedule') scheduleWrap.removeAttribute('hidden');
				else scheduleWrap.setAttribute('hidden', '');
			};
			radios.forEach((r) => r.addEventListener('change', syncSchedule));
			syncSchedule();
		}

		// Frequency (Daily/Weekly) (UI-only) is just a selector now (no extra fields).

		const applyAccountBalance = (account) => {
			if (!account || typeof account !== 'object') return;
			if (typeof account.credits !== 'undefined') {
				const c = Number(account.credits);
				balanceCredits = Number.isFinite(c) ? c : 0;
				if (creditsEl) creditsEl.textContent = String(Math.round(balanceCredits * 10) / 10);
			}
			if (account.balance_type) {
				balanceType = String(account.balance_type);
			}
		};

		wnawFetchAccountState(false).then((account) => {
			if (account) applyAccountBalance(account);
		});

		// Step 1: Create Batch (UI -> admin-ajax).
		if (cfg && cfg.ajaxUrl) {
			const createBtn = root.querySelector('[data-wnaw-create-batch]');
			const genNotice = root.querySelector('[data-wnaw-gen-notice]');
			const btnLabel = createBtn ? createBtn.querySelector('[data-wnaw-create-batch-label]') : null;

			const setGenNotice = (message, type) => {
				if (!genNotice) return;
				genNotice.hidden = false;
				genNotice.textContent = String(message || '');
				genNotice.setAttribute('data-wnaw-notice-type', type || 'success');
			};

			const clearGenNotice = () => {
				if (!genNotice) return;
				genNotice.hidden = true;
				genNotice.textContent = '';
				genNotice.removeAttribute('data-wnaw-notice-type');
			};

			// Credit-shortfall modal: shown when balance is too low to start the job.
			// The modal markup lives outside [data-wnaw-generate], so query at document level.
			const creditModal = document.querySelector('[data-wnaw-credit-modal]');
			const creditNeedEl = creditModal ? creditModal.querySelector('[data-wnaw-credit-need]') : null;
			const creditHaveEl = creditModal ? creditModal.querySelector('[data-wnaw-credit-have]') : null;
			const creditMessageEl = creditModal ? creditModal.querySelector('[data-wnaw-credit-modal-message]') : null;
			let creditModalLastFocus = null;

			const formatCreditCount = (n) => {
				const num = Number.isFinite(n) ? n : 0;
				const rounded = Math.round(num * 10) / 10;
				const label = rounded === 1 ? 'credit' : 'credits';
				return `${rounded} ${label}`;
			};

			const closeCreditModal = () => {
				if (!creditModal) return;
				creditModal.setAttribute('hidden', '');
				document.body.classList.remove('whoneedsawriter-modal-open');
				if (creditModalLastFocus && typeof creditModalLastFocus.focus === 'function') {
					try { creditModalLastFocus.focus(); } catch (e) { /* noop */ }
				}
				creditModalLastFocus = null;
			};

			const showCreditModal = (need, have) => {
				if (!creditModal) return;
				if (creditNeedEl) creditNeedEl.textContent = formatCreditCount(need);
				if (creditHaveEl) creditHaveEl.textContent = formatCreditCount(have);
				if (creditMessageEl) {
					creditMessageEl.textContent = wnawGetAccountMessage(wnawAccountState) || 'Please upgrade your plan to continue.';
				}
				creditModalLastFocus = document.activeElement;
				creditModal.removeAttribute('hidden');
				document.body.classList.add('whoneedsawriter-modal-open');
				const upgradeBtn = creditModal.querySelector('[data-wnaw-credit-modal-upgrade]');
				if (upgradeBtn && typeof upgradeBtn.focus === 'function') {
					try { upgradeBtn.focus({ preventScroll: true }); } catch (e) { /* noop */ }
				}
			};

			if (creditModal) {
				creditModal.querySelectorAll('[data-wnaw-credit-modal-dismiss]').forEach((el) => {
					el.addEventListener('click', (ev) => {
						ev.preventDefault();
						closeCreditModal();
					});
				});
				document.addEventListener('keydown', (ev) => {
					if (ev.key === 'Escape' && !creditModal.hasAttribute('hidden')) {
						closeCreditModal();
					}
				});
			}

			const setCreateLoading = (busy) => {
				if (!createBtn) return;
				createBtn.disabled = busy;
				createBtn.classList.toggle('is-loading', busy);
				createBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
				if (btnLabel) {
					if (!createBtn.dataset.wnawDefaultLabel) {
						createBtn.dataset.wnawDefaultLabel = btnLabel.textContent || '';
					}
					const busyLbl =
						cfg.strings && cfg.strings.submittingKeywords
							? String(cfg.strings.submittingKeywords)
							: 'Submitting keywords...';
					btnLabel.textContent = busy ? busyLbl : createBtn.dataset.wnawDefaultLabel;
				}
			};

			const actionCreate = cfg.actionCreateBatch;
			const nonceCreate = cfg.nonceCreateBatch;
			const actionSubmit = cfg.actionSubmitGeneration;
			const nonceSubmit = cfg.nonceSubmitGeneration;

			const getOptValue = (key) => {
				let val = '0';
				optInputs.forEach((i) => {
					if (i.getAttribute('data-wnaw-opt-value') === key) {
						val = /** @type {HTMLInputElement} */ (i).value;
					}
				});
				return val;
			};

			const getKeywordsCsv = () => {
				if (getKwMode() === 'bulk') {
					return getBulkKeywordList().slice(0, maxKeywords).join(',');
				}
				const parts = [];
				getKeywordRows().forEach((row) => {
					const kwInput = row.querySelector('[data-wnaw-kw-keyword]');
					const v = (kwInput && kwInput.value ? String(kwInput.value) : '').trim();
					if (v) parts.push(v);
				});
				return parts.join(',');
			};

			/**
			 * @param {HTMLSelectElement | null} sel
			 * @param {'value'|'label'} mode
			 */
			const readSelectToken = (sel, mode) => {
				if (!sel) return '';
				const rawVal = String(sel.value || '').trim();
				if (mode === 'label' && sel.selectedOptions && sel.selectedOptions.length) {
					return rawVal === '' ? '' : String(sel.selectedOptions[0].textContent || '').trim();
				}
				return rawVal;
			};

			/**
			 * CSV aligned with keywords: one token per keyword row (empty placeholders allowed).
			 * @param {string} attr - Row selector, e.g. '[data-wnaw-kw-category]'.
			 * @param {'value'|'label'} mode - Category uses human-readable name (option label); author uses IDs (value).
			 */
			const getKeywordsMetaCsv = (attr, mode) => {
				if (getKwMode() === 'bulk') {
					const total = Math.min(maxKeywords, getBulkKeywordList().length);
					if (total <= 0) return '';
					const isCategory = attr.indexOf('category') !== -1;
					const sharedSel = isCategory ? kwBulkCategory : kwBulkAuthor;
					const token = readSelectToken(sharedSel, mode);
					return new Array(total).fill(token).join(',');
				}
				const parts = [];
				getKeywordRows().forEach((row) => {
					const kwInput = row.querySelector('[data-wnaw-kw-keyword]');
					const keyword = (kwInput && kwInput.value ? String(kwInput.value) : '').trim();
					if (!keyword) return;
					const el = row.querySelector(attr);
					parts.push(readSelectToken(el instanceof HTMLSelectElement ? el : null, mode));
				});
				return parts.join(',');
			};

			const getSelectedModelApi = () => {
				const m = modelValue && modelValue.value ? String(modelValue.value) : 'pro';
				return m === 'lite' ? '1a-lite' : m === 'core' ? '1a-core' : '1a-pro';
			};

			const getModelCostPerKeyword = (selectedModelApi) => {
				if (selectedModelApi === '1a-lite') return 0.1;
				if (selectedModelApi === '1a-core') return 1;
				return 2;
			};

			const submitGeneration = async (batchId, totalKeywords) => {
				if (!actionSubmit || !nonceSubmit) {
					setGenNotice('Configuration error.', 'error');
					return;
				}

				const modelApi = getSelectedModelApi();

				const payload = new URLSearchParams();
				payload.set('action', String(actionSubmit));
				payload.set('nonce', String(nonceSubmit));
				payload.set('batchId', String(batchId));
				payload.set('total_keywords', String(totalKeywords));
				payload.set('textKeywords', getKeywordsCsv());
				payload.set('model', modelApi);
				payload.set('balance_type', String(balanceType || 'freeCredits'));
				payload.set('wordLimit', range && range.value ? String(range.value) : '500');
				const humanizeOn = getOptValue('humanize') === '1';
				const customInstructions = instructions ? String(instructions.value || '') : '';
				payload.set('specialInstructions', humanizeOn ? customInstructions : '');

				// Options mapping.
				payload.set('infographics', getOptValue('infographics') === '1' ? 'yes' : 'no');
				payload.set('externalLinks', getOptValue('external_links') === '1' ? 'Yes' : 'No');
				payload.set('references', getOptValue('references') === '1' ? 'Yes' : 'No');
				payload.set('humanize', getOptValue('humanize') === '1' ? 'Yes' : 'No');
				payload.set('category', getKeywordsMetaCsv('[data-wnaw-kw-category]', 'label'));
				payload.set('author', getKeywordsMetaCsv('[data-wnaw-kw-author]', 'value'));

				const res = await fetch(String(cfg.ajaxUrl), {
					method: 'POST',
					credentials: 'same-origin',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
					},
					body: payload.toString(),
				});

				/** @type {{ success?: boolean; data?: { message?: string } }} */
				let json = {};
				try {
					json = await res.json();
				} catch (e) {
					setGenNotice(
						(cfg.strings && cfg.strings.submitGenerationError)
							? String(cfg.strings.submitGenerationError)
							: 'Failed to start generation.',
						'error'
					);
					return;
				}

				if (json && json.success) {
					const progMsg =
						cfg.strings && cfg.strings.generationInProgress
							? String(cfg.strings.generationInProgress)
							: 'Article Generation is in progress.';
					setGenNotice(progMsg, 'success');

					await new Promise((resolve) => {
						setTimeout(resolve, 1300);
					});

					const jobsUrl = cfg.jobsUrl ? String(cfg.jobsUrl) : '';
					if (jobsUrl && pendingAssignedBatch) {
						try {
							const next = new URL(jobsUrl, window.location.href);
							next.searchParams.set('job_id', pendingAssignedBatch);
							next.searchParams.set('wnaw_gen', '1');
							window.location.assign(next.toString());
						} catch (e) {
							const sep = jobsUrl.indexOf('?') >= 0 ? '&' : '?';
							window.location.assign(`${jobsUrl}${sep}job_id=${encodeURIComponent(pendingAssignedBatch)}&wnaw_gen=1`);
						}
					} else {
						const dashUrl = cfg.dashboardUrl ? String(cfg.dashboardUrl) : '';
						if (dashUrl) {
							const sep = dashUrl.indexOf('?') >= 0 ? '&' : '?';
							window.location.assign(`${dashUrl}${sep}wnaw_gen=1`);
						}
					}
					return;
				}

				const errMsg = json && json.data && json.data.message
					? String(json.data.message)
					: ((cfg.strings && cfg.strings.submitGenerationError) ? String(cfg.strings.submitGenerationError) : 'Failed to start generation.');
				setGenNotice(errMsg, 'error');
			};

			const instructions = root.querySelector('#wnaw-instructions');

			if (createBtn && actionCreate && nonceCreate) {
				createBtn.addEventListener('click', async () => {
					clearGenNotice();
					const account = await wnawFetchAccountState(false);
					applyAccountBalance(account);
					if (!account || typeof account !== 'object') {
						setGenNotice('Could not check account status. Please retry.', 'error');
						return;
					}
					if (wnawAccountShouldOfferTrial(account)) {
						wnawOpenTrialModal('trial', account || {});
						return;
					}
					const access = account.access && typeof account.access === 'object' ? account.access : {};
					if (access.hasGenerationAccess !== true) {
						setGenNotice(wnawGetAccountMessage(account) || 'Start a trial or choose a paid plan before generating articles.', 'error');
						const cta = wnawGetAccountCta(account);
						if (cta.kind === 'upgrade' || cta.kind === 'renew' || cta.kind === 'credits') {
							showCreditModal(0, balanceCredits || 0);
						}
						return;
					}

					let totalKeywords = countKeywords();

					if (totalKeywords < 1) {
						const msg =
							(cfg.strings && cfg.strings.invalidKeywords)
								? String(cfg.strings.invalidKeywords)
								: 'Please add at least 1 keyword.';
						setGenNotice(msg, 'error');
						return;
					}

					if (totalKeywords > 10) {
						setGenNotice('10 Maximum keywords allowed in one batch', 'error');
						return;
					}

					// Credits gate (before BOTH calls).
					const selectedModelApi = getSelectedModelApi();
					const costPer = getModelCostPerKeyword(selectedModelApi);

					if (!balanceCredits || balanceCredits <= 0) {
						const need = Math.round(totalKeywords * costPer * 10) / 10;
						showCreditModal(need, 0);
						return;
					}

					const required = totalKeywords * costPer;
					if (required > balanceCredits) {
						const need = Math.round(required * 10) / 10;
						const have = Math.round(balanceCredits * 10) / 10;
						showCreditModal(need, have);
						return;
					}

					setCreateLoading(true);

					try {
						// Publish mapping for batch creation.
						let publishMode = 'draft';
						if (publishRoot) {
							const radios = publishRoot.querySelectorAll('[data-wnaw-publish-mode]');
							radios.forEach((r) => {
								const rr = /** @type {HTMLInputElement} */ (r);
								if (rr.checked) publishMode = rr.value;
							});
						}
						const saveOption =
							publishMode === 'schedule'
								? 'future'
								: publishMode === 'publish'
									? 'publish'
									: 'draft';

						let scheduleTime = '';
						let publishedStartDateTime = '';
						if (saveOption === 'future') {
							const freq = getSelectedFrequency();
							scheduleTime =
								freq === 'monthly'
									? 'one_post_per_monthly'
									: freq === 'weekly'
										? 'one_post_per_weekly'
										: 'one_post_per_day';

							const dStr = schedDateInput && schedDateInput.value ? String(schedDateInput.value) : '';
							const tStr = schedTimeSelect && schedTimeSelect.value ? String(schedTimeSelect.value) : '';
							if (dStr && tStr) {
								const dParts = dStr.split('-').map((p) => parseInt(p, 10));
								const tParts = tStr.split(':').map((p) => parseInt(p, 10));
								if (dParts.length === 3 && tParts.length >= 2) {
									const local = new Date(
										dParts[0],
										dParts[1] - 1,
										dParts[2],
										tParts[0] || 0,
										tParts[1] || 0,
										0,
										0
									);
									if (!isNaN(local.getTime())) {
										/* SaaS / Prisma requires ISO-8601 (not `Y-m-d H:i:s`). */
										publishedStartDateTime = local.toISOString();
									}
								}
							}
						}

						const params = new URLSearchParams();
						params.set('action', String(actionCreate));
						params.set('nonce', String(nonceCreate));
						params.set('batch', wnawProposedBatchName());
						params.set('total_keywords', String(totalKeywords));
						params.set('saveOption', saveOption);
						params.set('scheduleTime', scheduleTime);
						if (saveOption === 'future') {
							params.set('publishedStartDateTime', publishedStartDateTime);
						}

						const res = await fetch(String(cfg.ajaxUrl), {
							method: 'POST',
							credentials: 'same-origin',
							headers: {
								'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
							},
							body: params.toString(),
						});

						/** @type {{ success?: boolean; data?: { assignedBatch?: string; message?: string } }} */
						let json = {};
						try {
							json = await res.json();
						} catch (e) {
							setGenNotice(
								(cfg.strings && cfg.strings.createBatchError)
									? String(cfg.strings.createBatchError)
									: 'Could not create batch.',
								'error'
							);
							return;
						}

						if (json && json.success && json.data && json.data.assignedBatch) {
							pendingAssignedBatch = String(json.data.assignedBatch);
							pendingAssignedBatchName = json.data.batchName != null
								? String(json.data.batchName).trim()
								: '';

							/* Snapshot the form so the Job Detail page can render
							 * the "Job Settings" sidebar and scheduled article times
							 * without an extra API call.
							 * Stored keyed by assignedBatch (same id as ?job_id=).
							 */
							try {
								const modelCode = modelValue && modelValue.value ? String(modelValue.value) : 'core';
								const modelLabelMap = { lite: '1a Lite', core: '1a Core', pro: '1a Pro' };
								const modelLabel = /** @type {Record<string, string>} */ (modelLabelMap)[modelCode] || modelCode;

								const kwModeNow = getKwMode();
								const isBulk = kwModeNow === 'bulk';

								/** @type {string[]} */
								const kwList = [];
								/** @type {string[]} */
								const authorLabels = [];

								if (isBulk) {
									getBulkKeywordList().slice(0, maxKeywords).forEach((k) => kwList.push(String(k)));
									const sharedAuthor = kwBulkAuthor && kwBulkAuthor.selectedOptions && kwBulkAuthor.selectedOptions.length && String(kwBulkAuthor.value || '').trim() !== ''
										? String(kwBulkAuthor.selectedOptions[0].textContent || '').trim()
										: '';
									for (let i = 0; i < kwList.length; i++) {
										if (sharedAuthor) authorLabels.push(sharedAuthor);
									}
								} else {
									getKeywordRows().forEach((row) => {
										const ki = row.querySelector('[data-wnaw-kw-keyword]');
										const keyword = (ki && /** @type {HTMLInputElement} */ (ki).value ? String(/** @type {HTMLInputElement} */ (ki).value) : '').trim();
										if (!keyword) return;
										kwList.push(keyword);
										const authorEl = row.querySelector('[data-wnaw-kw-author]');
										if (authorEl instanceof HTMLSelectElement) {
											const sel = authorEl.selectedOptions && authorEl.selectedOptions.length && String(authorEl.value || '').trim() !== ''
												? String(authorEl.selectedOptions[0].textContent || '').trim()
												: '';
											if (sel) authorLabels.push(sel);
										}
									});
								}

								const publishLabelMap = { draft: 'Draft', publish: 'Publish now', schedule: 'Schedule' };
								const publishLabel = /** @type {Record<string, string>} */ (publishLabelMap)[publishMode] || publishMode;

								/** @type {Record<string, unknown> | null} */
								let scheduleObj = null;
								/** @type {string[]} */
								let articleScheduledSlots = [];
								if (publishMode === 'schedule') {
									const freq = getSelectedFrequency();
									const freqLabelMap = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
									const dStr = schedDateInput && schedDateInput.value ? String(schedDateInput.value) : '';
									const tStr = schedTimeSelect && schedTimeSelect.value ? String(schedTimeSelect.value) : '';
									let startIso = '';
									if (dStr && tStr) {
										const dParts = dStr.split('-').map((p) => parseInt(p, 10));
										const tParts = tStr.split(':').map((p) => parseInt(p, 10));
										if (dParts.length === 3 && tParts.length === 2) {
											const local = new Date(
												dParts[0],
												dParts[1] - 1,
												dParts[2],
												tParts[0] || 0,
												tParts[1] || 0,
												0,
												0
											);
											if (!isNaN(local.getTime())) startIso = local.toISOString();
										}
									}
									const publishedStartMysql = wnawFormatPublishedStartDateTimeMysql(dStr, tStr);
									const publishedStartIso = publishedStartDateTime || startIso || new Date().toISOString();
									scheduleObj = {
										total_articles: kwList.length,
										frequency: freq,
										frequency_label: /** @type {Record<string, string>} */ (freqLabelMap)[freq] || freq,
										start_date: dStr,
										start_time: tStr,
										start_datetime: publishedStartIso,
										publishedStartDateTime: publishedStartIso,
										published_start_mysql: publishedStartMysql,
										scheduleTime: /** @type {Record<string, string>} */ ({
											daily: 'one_post_per_day',
											weekly: 'one_post_per_weekly',
											monthly: 'one_post_per_monthly',
										})[freq] || 'one_post_per_day',
									};
									articleScheduledSlots = wnawBuildArticleScheduledSlotLabels(dStr, tStr, freq, kwList.length);
								}

								/** @type {Record<string, unknown>} */
								const batchSnap = {
									model: modelCode,
									model_label: modelLabel,
									word_count: range && /** @type {HTMLInputElement} */ (range).value ? Number(/** @type {HTMLInputElement} */ (range).value) : null,
									keyword_mode: kwModeNow,
									split_mode: !isBulk,
									keywords: kwList,
									authors: authorLabels,
									publish_mode: publishMode,
									publish_mode_label: publishLabel,
									schedule: scheduleObj,
									article_scheduled_slots: articleScheduledSlots,
								};
								if (publishMode === 'schedule' && scheduleObj && scheduleObj.publishedStartDateTime) {
									batchSnap.publishedStartDateTime = scheduleObj.publishedStartDateTime;
								}
								const batchDisplayName = pendingAssignedBatchName
									? wnawNormalizePluginJobDisplayName(pendingAssignedBatchName)
									: '';
								if (batchDisplayName) {
									batchSnap.batch_display_name = batchDisplayName;
								}
								const optimisticBatchRow = {
									id: pendingAssignedBatch,
									name: batchDisplayName,
									articles: kwList.length,
									completedArticles: 0,
									pendingArticles: kwList.length,
									failedArticles: 0,
									statusInt: 0,
									statusKey: 'generating',
									statusLabel: (cfg.strings && cfg.strings.articlesLabelGenerating)
										? String(cfg.strings.articlesLabelGenerating)
										: 'Generating',
									createdAt: wnawTodayBatchCreatedAtToken(),
								};
								wnawUpsertBatchInCache(optimisticBatchRow);
								wnawRuntimeDb.settings[pendingAssignedBatch] = Object.assign({}, batchSnap, { _savedAt: Date.now() });
								const labelGen = (cfg.strings && cfg.strings.articlesLabelGenerating)
									? String(cfg.strings.articlesLabelGenerating)
									: 'Generating';
								wnawWriteBatchArticlesCache(
									pendingAssignedBatch,
									kwList.map((kw, idx) => ({
										keyword: String(kw).trim(),
										title: String(kw).trim(),
										statusInt: 0,
										statusKey: 'generating',
										statusLabel: labelGen,
										isPublished: false,
										wpPostStatus: '',
										wpPostId: 0,
										editPostUrl: '',
										batchId: pendingAssignedBatch,
										scheduledTime: articleScheduledSlots[idx] != null ? String(articleScheduledSlots[idx]).trim() : '',
										model: '',
										category: '',
										author: '',
									}))
								);
								await wnawSaveGenerationSnapshot({
									batchId: pendingAssignedBatch,
									keywords: kwList,
									scheduledSlots: articleScheduledSlots,
									settings: batchSnap,
									batchRow: optimisticBatchRow,
								});
							} catch (snapErr) {
								/* Snapshot failures should never block the actual submission. */
							}

							// Step 2: submit generation request (no separate batch success message).
							await submitGeneration(pendingAssignedBatch, totalKeywords);
							return;
						}

						const errMsg =
							json && json.data && json.data.message
								? String(json.data.message)
								: (cfg.strings && cfg.strings.createBatchError) ? String(cfg.strings.createBatchError) : 'Could not create batch.';
						setGenNotice(errMsg, 'error');
					} catch (err) {
						setGenNotice(
							(cfg.strings && cfg.strings.networkError) ? String(cfg.strings.networkError) : 'Network error.',
							'error'
						);
					} finally {
						setCreateLoading(false);
					}
				});
		}
	}
	})();

	/**
	 * Dashboard: SaaS stats + credits (reuse balance endpoint).
	 */
	(function initDashboardUi() {
		const shell = document.querySelector('[data-wnaw-dashboard]');
		if (!shell || !cfg) {
			return;
		}

		let dashForceFresh = false;
		try {
			const params = new URLSearchParams(window.location.search);
			if (params.get('wnaw_gen') === '1' || params.get('payment') === 'success') {
				dashForceFresh = true;
			}
			if (params.get('wnaw_gen') === '1') {
				params.delete('wnaw_gen');
				const nextSearch = params.toString();
				const nextUrl =
					window.location.pathname +
					(nextSearch ? `?${nextSearch}` : '') +
					window.location.hash;
				window.history.replaceState({}, '', nextUrl);
			}
		} catch (e) {
			// ignore
		}

		const notice = shell.querySelector('[data-wnaw-dashboard-notice]');
		const elCredits = shell.querySelector('[data-wnaw-dashboard-credits]');
		const elGen = shell.querySelector('[data-wnaw-dashboard-articles-generated]');
		const elPub = shell.querySelector('[data-wnaw-dashboard-articles-published]');
		const elActive = shell.querySelector('[data-wnaw-dashboard-active-jobs]');
		const elFailed = shell.querySelector('[data-wnaw-dashboard-failed-jobs]');

		const str = cfg.strings || {};

		/**
		 * @param {unknown} v
		 * @returns {string}
		 */
		const fmtStat = (v) => {
			const n = Math.max(0, Math.floor(Number(v)));
			return Number.isFinite(n) ? String(n) : '0';
		};

		/**
		 * @param {unknown} v
		 * @returns {string}
		 */
		const fmtCredits = (v) => {
			const n = Number(v);
			if (!Number.isFinite(n)) return '0';
			if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
			return n.toFixed(1);
		};

		/**
		 * @param {string} message
		 * @param {'error'|'info'} type
		 */
		const setDashNotice = (message, type) => {
			if (!notice) return;
			if (!message) {
				notice.setAttribute('hidden', '');
				notice.textContent = '';
				notice.classList.remove('notice-error', 'notice-warning');
				return;
			}
			notice.removeAttribute('hidden');
			notice.textContent = message;
			notice.classList.remove('notice-error', 'notice-warning');
			if (type === 'error') {
				notice.classList.add('notice-error');
			} else {
				notice.classList.add('notice-warning');
			}
		};

		/**
		 * @param {Record<string, unknown>} d
		 */
		const applyDashboardStats = (d) => {
			if (elGen && typeof d.articlesGenerated !== 'undefined') {
				elGen.textContent = fmtStat(d.articlesGenerated);
			}
			if (elPub && typeof d.articlesPublished !== 'undefined') {
				elPub.textContent = fmtStat(d.articlesPublished);
			}
			if (elActive && typeof d.activeJobs !== 'undefined') {
				elActive.textContent = fmtStat(d.activeJobs);
			}
			if (elFailed) {
				const failed = typeof d.failedArticles !== 'undefined' && d.failedArticles !== null
					? d.failedArticles
					: d.failedJobs;
				if (typeof failed !== 'undefined') {
					elFailed.textContent = fmtStat(failed);
				}
			}
		};

		/**
		 * @param {unknown} credits
		 */
		const applyCredits = (credits) => {
			if (!elCredits) return;
			elCredits.textContent = fmtCredits(credits);
		};

		const loadCredits = async () => {
			const account = await wnawFetchAccountState(dashForceFresh);
			if (account && typeof account === 'object' && typeof account.credits !== 'undefined') {
				applyCredits(account.credits);
			}
		};

		(async () => {
			const stats = await wnawDbLoadDashboard();
			if (stats && typeof stats === 'object') {
				setDashNotice('', 'info');
				applyDashboardStats(stats);
			} else {
				setDashNotice(str.dashboardError ? String(str.dashboardError) : 'Could not load dashboard data.', 'error');
				if (elGen) elGen.textContent = '0';
				if (elPub) elPub.textContent = '0';
				if (elActive) elActive.textContent = '0';
				if (elFailed) elFailed.textContent = '0';
			}
			loadCredits();
		})();
	})();

	/**
	 * Jobs list (plugin DB tables).
	 */
	(function initJobsUi() {
		const root = document.querySelector('[data-wnaw-jobs]');
		if (!root || !cfg) {
			return;
		}

		const tbody = root.querySelector('[data-wnaw-jobs-tbody]');
		const notice = root.querySelector('[data-wnaw-jobs-notice]');
		const refreshBtn = root.querySelector('[data-wnaw-jobs-refresh]');
		const detailUrlBase = root.getAttribute('data-wnaw-jobs-detail-url') || '';

		const str = cfg.strings || {};
		const COLSPAN = 5;

		/** Build the detail-page URL for a given batch id, or '' if no base configured. */
		const buildDetailUrl = (id) => {
			const safeId = id == null ? '' : String(id).trim();
			if (!detailUrlBase || !safeId) return '';
			const sep = detailUrlBase.indexOf('?') === -1 ? '?' : '&';
			return `${detailUrlBase}${sep}job_id=${encodeURIComponent(safeId)}`;
		};

		/**
		 * @param {string} message
		 */
		const setNotice = (message) => {
			if (!notice) return;
			if (!message) {
				notice.setAttribute('hidden', '');
				notice.textContent = '';
				return;
			}
			notice.removeAttribute('hidden');
			notice.textContent = message;
			notice.classList.remove('notice-error');
			notice.classList.add('notice-error');
		};

		const clearBody = () => {
			if (!tbody) return;
			while (tbody.firstChild) {
				tbody.removeChild(tbody.firstChild);
			}
		};

		/** Convert MMDDYY (UTC) to a friendly "MMM D, YYYY" label. Falls back to raw input. */
		const formatBatchDate = (raw) => {
			const s = raw == null ? '' : String(raw).trim();
			if (!s) return '—';
			if (/^\d{6}$/.test(s)) {
				const mm = parseInt(s.substring(0, 2), 10);
				const dd = parseInt(s.substring(2, 4), 10);
				const yy = parseInt(s.substring(4, 6), 10);
				const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
				const monthIdx = mm - 1;
				if (monthIdx >= 0 && monthIdx < 12 && dd > 0 && dd < 32) {
					return `${months[monthIdx]} ${dd}, 20${String(yy).padStart(2, '0')}`;
				}
			}
			return s;
		};

		/** Build a status pill element for the table cell. */
		const buildStatusPill = (key, label) => {
			const wrap = document.createElement('span');
			wrap.className = `whoneedsawriter__job-status whoneedsawriter__job-status--${key || 'unknown'}`;
			const dot = document.createElement('span');
			dot.className = 'whoneedsawriter__job-status-dot';
			dot.setAttribute('aria-hidden', 'true');
			wrap.appendChild(dot);
			const text = document.createElement('span');
			text.textContent = label || '';
			wrap.appendChild(text);
			return wrap;
		};

		const setLoading = (busy) => {
			if (!tbody) return;
			if (busy) {
				clearBody();
				const tr = document.createElement('tr');
				tr.className = 'whoneedsawriter__jobs-loading';
				const c = document.createElement('td');
				c.colSpan = COLSPAN;
				c.innerHTML =
					'<span class="whoneedsawriter__jobs-loading-inner">' +
					'<svg class="whoneedsawriter__spinner" viewBox="0 0 50 50" focusable="false" aria-hidden="true">' +
					'<circle class="whoneedsawriter__spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>' +
					'</svg>' +
					'<span>Loading batches…</span>' +
					'</span>';
				tr.appendChild(c);
				tbody.appendChild(tr);
			}
			if (refreshBtn) {
				refreshBtn.classList.toggle('is-loading', !!busy);
				refreshBtn.disabled = !!busy;
			}
		};

		const readJobsCache = () => wnawReadBatchesCache();

		const writeJobsCache = (rows) => {
			wnawWriteBatchesCache(rows);
		};

		const isCacheFresh = () => wnawIsBatchesCacheFresh();

		/** Render rows into the table body. */
		const renderJobRows = (rows) => {
			if (!tbody) return;
			clearBody();

			if (rows.length === 0) {
				const empty = document.createElement('tr');
				const c = document.createElement('td');
				c.colSpan = COLSPAN;
				c.className = 'whoneedsawriter__jobs-empty';
				c.textContent = str.jobsEmpty
					? String(str.jobsEmpty)
					: 'No jobs found yet. Start your first batch from Generate Article.';
				empty.appendChild(c);
				tbody.appendChild(empty);
				return;
			}

			rows.forEach((/** @type {Record<string, unknown>} */ r, idx) => {
				const tr = document.createElement('tr');
				tr.className = 'whoneedsawriter__jobs-row';

				const detailUrl = buildDetailUrl(r.id);
				if (detailUrl) {
					tr.classList.add('whoneedsawriter__jobs-row--clickable');
					tr.setAttribute('tabindex', '0');
					tr.setAttribute('role', 'link');
					tr.setAttribute('aria-label', `Open job ${r.name != null ? String(r.name) : ''}`);
					tr.addEventListener('click', () => {
						window.location.href = detailUrl;
					});
					tr.addEventListener('keydown', (ev) => {
						const key = /** @type {KeyboardEvent} */ (ev).key;
						if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
							ev.preventDefault();
							window.location.href = detailUrl;
						}
					});
				}

				const tdNum = document.createElement('td');
				tdNum.className = 'whoneedsawriter__jobs-col-num';
				tdNum.textContent = String(idx + 1);
				tr.appendChild(tdNum);

				const tdName = document.createElement('td');
				tdName.className = 'whoneedsawriter__jobs-col-name';
				const nameStrong = document.createElement('span');
				nameStrong.className = 'whoneedsawriter__jobs-name';
				const jobNameRaw = r.name != null ? String(r.name).trim() : '';
				nameStrong.textContent = jobNameRaw
					? wnawNormalizePluginJobDisplayName(jobNameRaw)
					: '—';
				tdName.appendChild(nameStrong);
				tr.appendChild(tdName);

				const tdArticles = document.createElement('td');
				tdArticles.className = 'whoneedsawriter__jobs-col-articles';
				const completed = Number.isFinite(Number(r.completedArticles)) ? Number(r.completedArticles) : 0;
				const total = Number.isFinite(Number(r.articles)) ? Number(r.articles) : 0;
				const articlesWrap = document.createElement('span');
				articlesWrap.className = 'whoneedsawriter__jobs-progress';
				articlesWrap.innerHTML =
					`<strong>${completed}</strong>` +
					(total > 0 ? `<span class="whoneedsawriter__jobs-progress-sep"> / ${total}</span>` : '');

				tdArticles.appendChild(articlesWrap);
				tr.appendChild(tdArticles);

				const tdStatus = document.createElement('td');
				tdStatus.className = 'whoneedsawriter__jobs-col-status';
				tdStatus.appendChild(buildStatusPill(
					r.statusKey != null ? String(r.statusKey) : '',
					r.statusLabel != null ? String(r.statusLabel) : ''
				));
				tr.appendChild(tdStatus);

				const tdDate = document.createElement('td');
				tdDate.className = 'whoneedsawriter__jobs-col-date';
				tdDate.textContent = formatBatchDate(r.createdAt);
				tr.appendChild(tdDate);

				tbody.appendChild(tr);
			});
		};

		const loadJobs = async () => {
			if (!tbody) return;

			setLoading(true);
			setNotice('');

			const rows = await wnawDbLoadJobs();
			setLoading(false);

			if (!rows || !rows.length) {
				clearBody();
				setNotice(str.jobsEmpty ? String(str.jobsEmpty) : 'No jobs found yet. Start your first batch from Generate Article.');
				return;
			}

			renderJobRows(rows);
		};

		const forceRefreshJobs = async () => {
			if (!tbody) return;
			setLoading(true);
			setNotice('');
			const rows = await wnawDbLoadJobs();
			setLoading(false);
			if (rows && rows.length) {
				renderJobRows(rows);
			} else {
				clearBody();
				setNotice(str.jobsEmpty ? String(str.jobsEmpty) : 'No jobs found yet. Start your first batch from Generate Article.');
			}
		};

		if (refreshBtn) {
			refreshBtn.addEventListener('click', () => {
				forceRefreshJobs();
			});
		}

		loadJobs();
	})();

	/** @type {HTMLElement | null} */
	let wnawDeleteArticleModal = null;

	/**
	 * @param {string} url
	 * @returns {number}
	 */
	function wnawParsePostIdFromEditUrl(url) {
		const s = url != null ? String(url).trim() : '';
		if (!s) return 0;
		const m = s.match(/[?&]post=(\d+)/i);
		return m ? parseInt(m[1], 10) : 0;
	}

	/**
	 * @param {Record<string, unknown>} row
	 * @param {number} [postIdOverride]
	 * @returns {string[]}
	 */
	function wnawArticleRemovedKeys(row, postIdOverride) {
		const batchId = row.batchId != null ? String(row.batchId).trim() : '';
		const postId = postIdOverride != null && postIdOverride > 0
			? String(postIdOverride)
			: (row.wpPostId != null ? String(row.wpPostId).trim() : '');
		const t = row.title != null ? String(row.title).trim() : '';
		const k = row.keyword != null ? String(row.keyword).trim() : '';
		const title = (t || k).toLowerCase();
		/** @type {string[]} */
		const keys = [];
		if (batchId && postId) keys.push(`${batchId}::p:${postId}`);
		if (batchId && title) keys.push(`${batchId}::t:${title}`);
		if (postId) keys.push(`p:${postId}`);
		return keys;
	}

	/**
	 * @param {Record<string, unknown>} map
	 * @param {Record<string, unknown>} row
	 * @param {number} [postIdOverride]
	 * @returns {boolean}
	 */
	function wnawIsArticleRemoved(map, row, postIdOverride) {
		if (row.statusKey != null && String(row.statusKey) === 'removed') {
			return true;
		}
		return wnawArticleRemovedKeys(row, postIdOverride).some((key) => !!map[key]);
	}

	/**
	 * Build (once) and return the delete-confirmation modal root element.
	 * @returns {HTMLElement}
	 */
	function wnawEnsureDeleteArticleModal() {
		if (wnawDeleteArticleModal) {
			return wnawDeleteArticleModal;
		}
		const modal = document.createElement('div');
		modal.className = 'whoneedsawriter__jd-delete-modal';
		modal.setAttribute('hidden', '');
		modal.setAttribute('role', 'dialog');
		modal.setAttribute('aria-modal', 'true');
		modal.setAttribute('aria-labelledby', 'wnaw-delete-article-title');
		modal.innerHTML =
			'<div class="whoneedsawriter__jd-delete-modal-backdrop" data-wnaw-delete-dismiss></div>' +
			'<div class="whoneedsawriter__jd-delete-modal-card" role="document">' +
			'<h3 class="whoneedsawriter__jd-delete-modal-title" id="wnaw-delete-article-title"></h3>' +
			'<p class="whoneedsawriter__jd-delete-modal-desc" id="wnaw-delete-article-desc"></p>' +
			'<div class="whoneedsawriter__jd-delete-modal-actions">' +
			'<button type="button" class="whoneedsawriter__jd-delete-modal-btn whoneedsawriter__jd-delete-modal-btn--cancel" data-wnaw-delete-dismiss></button>' +
			'<button type="button" class="whoneedsawriter__jd-delete-modal-btn whoneedsawriter__jd-delete-modal-btn--danger" data-wnaw-delete-confirm></button>' +
			'</div>' +
			'</div>';
		document.body.appendChild(modal);
		wnawDeleteArticleModal = modal;
		return modal;
	}

	/**
	 * Modal confirm dialog for deleting an article from WordPress.
	 * @param {Record<string, unknown>} [strings] Localized strings.
	 * @returns {Promise<boolean>}
	 */
	function wnawConfirmDeleteArticle(strings) {
		const str = strings && typeof strings === 'object' ? strings : {};
		const title = str.articlesDeleteTitle ? String(str.articlesDeleteTitle) : 'Delete article?';
		const message = str.articlesDeleteConfirm
			? String(str.articlesDeleteConfirm)
			: 'Delete this article from WordPress? This cannot be undone.';
		const cancelLabel = str.articlesDeleteCancel ? String(str.articlesDeleteCancel) : 'Cancel';
		const confirmLabel = str.articlesDeleteConfirmBtn
			? String(str.articlesDeleteConfirmBtn)
			: (str.articlesActionDelete ? String(str.articlesActionDelete) : 'Delete');

		return new Promise((resolve) => {
			const modal = wnawEnsureDeleteArticleModal();
			const titleEl = modal.querySelector('#wnaw-delete-article-title');
			const descEl = modal.querySelector('#wnaw-delete-article-desc');
			const confirmBtn = modal.querySelector('[data-wnaw-delete-confirm]');
			const dismissEls = modal.querySelectorAll('[data-wnaw-delete-dismiss]');

			if (titleEl) titleEl.textContent = title;
			if (descEl) descEl.textContent = message;
			if (confirmBtn) confirmBtn.textContent = confirmLabel;
			dismissEls.forEach((el) => {
				if (el instanceof HTMLButtonElement) {
					el.textContent = cancelLabel;
				}
			});

			let settled = false;

			const cleanup = () => {
				modal.setAttribute('hidden', '');
				document.body.classList.remove('whoneedsawriter-modal-open');
				if (confirmBtn) confirmBtn.removeEventListener('click', onConfirm);
				dismissEls.forEach((el) => el.removeEventListener('click', onCancel));
				document.removeEventListener('keydown', onKey);
			};

			const finish = (/** @type {boolean} */ value) => {
				if (settled) return;
				settled = true;
				cleanup();
				resolve(value);
			};

			const onCancel = (/** @type {Event} */ ev) => {
				ev.preventDefault();
				ev.stopPropagation();
				finish(false);
			};

			const onConfirm = (/** @type {Event} */ ev) => {
				ev.preventDefault();
				ev.stopPropagation();
				finish(true);
			};

			const onKey = (/** @type {KeyboardEvent} */ ev) => {
				if (ev.key === 'Escape') {
					finish(false);
				}
			};

			/* Defer open so the same click that opened the menu cannot hit the backdrop. */
			requestAnimationFrame(() => {
				if (confirmBtn) confirmBtn.addEventListener('click', onConfirm);
				dismissEls.forEach((el) => el.addEventListener('click', onCancel));
				document.addEventListener('keydown', onKey);
				modal.removeAttribute('hidden');
				document.body.classList.add('whoneedsawriter-modal-open');
				if (confirmBtn) confirmBtn.focus();
			});
		});
	}

	/**
	 * Shared article-row renderer (used by both the per-batch table on the
	 * Job Detail page and the cross-batch table on the All Articles page).
	 * Returns a populated <tr> for the given row payload.
	 *
	 * @param {Record<string, unknown>} row
	 * @param {number} index Zero-based row index for the "#" column.
	 * @param {Record<string, unknown>} strings Localized string bag (cfg.strings).
	 * @param {string[] | undefined} [scheduledSlots] Optional per-row scheduled labels (Job Detail + schedule snapshot).
	 */
	function buildArticleRow(row, index, strings, scheduledSlots) {
		const tr = document.createElement('tr');
		tr.className = 'whoneedsawriter__jd-article-row';

		const str = strings && typeof strings === 'object' ? strings : {};
		const labelRemoved = str.articlesLabelRemoved ? String(str.articlesLabelRemoved) : 'Removed';

		const tdNum = document.createElement('td');
		tdNum.className = 'whoneedsawriter__jd-col-num';
		tdNum.textContent = String(index + 1);
		tr.appendChild(tdNum);

		const tdTitle = document.createElement('td');
		tdTitle.className = 'whoneedsawriter__jd-col-title';
		const titleText =
			row.title != null && String(row.title).trim() !== ''
				? String(row.title)
				: row.keyword != null
					? String(row.keyword)
					: '';
		const editUrlRaw = row.editPostUrl != null ? String(row.editPostUrl).trim() : '';
		const wpPostIdFromRow = row.wpPostId != null ? parseInt(String(row.wpPostId), 10) : 0;
		const effectivePostId = wpPostIdFromRow > 0 ? wpPostIdFromRow : wnawParsePostIdFromEditUrl(editUrlRaw);
		const articleTitleForDelete =
			row.title != null && String(row.title).trim() !== ''
				? String(row.title).trim()
				: (row.keyword != null ? String(row.keyword).trim() : '');
		const batchIdForDelete = row.batchId != null ? String(row.batchId).trim() : '';
		const isRemovedEarly = row.statusKey != null && String(row.statusKey) === 'removed';
		const editUrl = isRemovedEarly ? '' : editUrlRaw;

		if (editUrl) {
			const a = document.createElement('a');
			a.href = editUrl;
			a.target = '_blank';
			a.rel = 'noopener noreferrer';
			a.className = 'whoneedsawriter__jd-titlelink';
			a.textContent = titleText;
			a.setAttribute('title', 'Edit in WordPress (opens in a new tab)');
			tdTitle.appendChild(a);
		} else {
			tdTitle.textContent = titleText;
			tdTitle.setAttribute('title', titleText);
		}
		tr.appendChild(tdTitle);

		const tdStatus = document.createElement('td');
		tdStatus.className = 'whoneedsawriter__jd-col-status';
		let statusKey = row.statusKey != null ? String(row.statusKey) : 'unknown';
		let statusLabel = row.statusLabel != null ? String(row.statusLabel) : '';

		const isRemoved = isRemovedEarly;
		if (isRemoved) {
			statusKey = 'removed';
			statusLabel = labelRemoved;
			tr.classList.add('is-removed');
		}

		const pill = document.createElement('span');
		pill.className = `whoneedsawriter__jd-pill whoneedsawriter__jd-pill--${statusKey}`;
		const dotIcon = (() => {
			if (statusKey === 'generated') {
				return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
					'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
					'<path d="M8 12.5l3 3 5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
					'</svg>';
			}
			if (statusKey === 'generating') {
				return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" class="whoneedsawriter__jd-pill-spin">' +
					'<path d="M21 12a9 9 0 1 1-3.4-7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
					'</svg>';
			}
			if (statusKey === 'failed') {
				return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
					'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
					'<path d="M9 9l6 6M15 9l-6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
					'</svg>';
			}
			if (statusKey === 'removed') {
				return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
					'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
					'<path d="M8 12h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
					'</svg>';
			}
			return '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
				'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
				'<path d="M12 8v5l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
				'</svg>';
		})();
		pill.innerHTML = `${dotIcon}<span>${statusLabel}</span>`;
		tdStatus.appendChild(pill);
		tr.appendChild(tdStatus);

		const tdTime = document.createElement('td');
		tdTime.className = 'whoneedsawriter__jd-col-time';
		const slotWrap = document.createElement('span');
		const slots = scheduledSlots && Array.isArray(scheduledSlots) ? scheduledSlots : [];
		const rowSlot = row.scheduledTime != null ? String(row.scheduledTime).trim() : '';
		const slotText = rowSlot || (slots[index] != null ? String(slots[index]).trim() : '');
		if (slotText) {
			slotWrap.className = 'whoneedsawriter__jd-time-slot';
			slotWrap.textContent = slotText;
			slotWrap.setAttribute('title', slotText);
		} else {
			slotWrap.className = 'whoneedsawriter__jd-time-empty';
			slotWrap.textContent = '—';
		}
		tdTime.appendChild(slotWrap);
		tr.appendChild(tdTime);

		const tdActions = document.createElement('td');
		tdActions.className = 'whoneedsawriter__jd-col-actions';
		const previewBtn = document.createElement('button');
		previewBtn.type = 'button';
		previewBtn.className = 'whoneedsawriter__jd-preview';
		const canOpenEditor = editUrl !== '' && statusKey === 'generated';
		const previewLabel = str.articlesPreview ? String(str.articlesPreview) : 'Preview';
		previewBtn.innerHTML =
			'<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
			'<path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
			'<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
			'</svg>' +
			`<span>${previewLabel}</span>`;
		if (!canOpenEditor) {
			previewBtn.disabled = true;
			previewBtn.classList.add('is-disabled');
			previewBtn.setAttribute('aria-disabled', 'true');
			let previewTitle = 'Preview is not available for this article yet.';
			if (statusKey === 'generating') {
				previewTitle = 'Preview is available when generation completes.';
			} else if (statusKey === 'failed') {
				previewTitle = 'This article failed to generate.';
			} else if (statusKey === 'removed') {
				previewTitle = 'This article was removed from WordPress.';
			} else if (statusKey === 'generated') {
				previewTitle = 'Could not find this post in WordPress to edit.';
			}
			previewBtn.setAttribute('title', previewTitle);
		} else {
			const previewTitle = 'Edit post in WordPress (opens in a new tab)';
			previewBtn.setAttribute('title', previewTitle);
			previewBtn.addEventListener('click', (ev) => {
				ev.preventDefault();
				window.open(editUrl, '_blank', 'noopener,noreferrer');
			});
		}
		tdActions.appendChild(previewBtn);

		const menuBtn = document.createElement('button');
		menuBtn.type = 'button';
		menuBtn.className = 'whoneedsawriter__jd-rowmenu';
		menuBtn.setAttribute('aria-label', str.articlesMenuLabel ? String(str.articlesMenuLabel) : 'More actions');
		menuBtn.innerHTML =
			'<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">' +
			'<circle cx="12" cy="6" r="1.5" fill="currentColor"/>' +
			'<circle cx="12" cy="12" r="1.5" fill="currentColor"/>' +
			'<circle cx="12" cy="18" r="1.5" fill="currentColor"/>' +
			'</svg>';
		tdActions.appendChild(menuBtn);

		const menu = document.createElement('div');
		menu.className = 'whoneedsawriter__jd-rowmenu-pop';
		menu.setAttribute('role', 'menu');
		menu.setAttribute('hidden', '');

		const editItem = document.createElement('button');
		editItem.type = 'button';
		editItem.className = 'whoneedsawriter__jd-rowmenu-item';
		editItem.setAttribute('role', 'menuitem');
		editItem.textContent = str.articlesActionEdit ? String(str.articlesActionEdit) : 'Edit';

		const viewItem = document.createElement('button');
		viewItem.type = 'button';
		viewItem.className = 'whoneedsawriter__jd-rowmenu-item';
		viewItem.setAttribute('role', 'menuitem');
		viewItem.textContent = str.articlesActionView ? String(str.articlesActionView) : 'View';

		const delItem = document.createElement('button');
		delItem.type = 'button';
		delItem.className = 'whoneedsawriter__jd-rowmenu-item is-danger';
		delItem.setAttribute('role', 'menuitem');
		delItem.textContent = str.articlesActionDelete ? String(str.articlesActionDelete) : 'Delete';

		const showRegenerate = statusKey === 'failed' && !isRemoved;
		/** @type {HTMLButtonElement | null} */
		let regenItem = null;
		if (showRegenerate) {
			regenItem = document.createElement('button');
			regenItem.type = 'button';
			regenItem.className = 'whoneedsawriter__jd-rowmenu-item';
			regenItem.setAttribute('role', 'menuitem');
			regenItem.textContent = str.articlesActionRegenerate
				? String(str.articlesActionRegenerate)
				: 'Regenerate';
			menu.appendChild(regenItem);
		}

		menu.appendChild(editItem);
		menu.appendChild(viewItem);
		menu.appendChild(delItem);
		tdActions.appendChild(menu);

		const positionMenu = () => {
			const rect = menuBtn.getBoundingClientRect();
			const menuWidth = Math.max(menu.offsetWidth || 0, 160);
			let left = rect.right - menuWidth;
			if (left < 8) {
				left = 8;
			}
			let top = rect.bottom + 6;
			const menuHeight = menu.offsetHeight || 120;
			if (top + menuHeight > window.innerHeight - 8) {
				top = Math.max(8, rect.top - menuHeight - 6);
			}
			menu.style.position = 'fixed';
			menu.style.left = `${left}px`;
			menu.style.top = `${top}px`;
			menu.style.right = 'auto';
			menu.style.zIndex = '100050';
		};

		const closeMenu = () => {
			menu.setAttribute('hidden', '');
			menuBtn.setAttribute('aria-expanded', 'false');
			if (menu.parentElement === document.body) {
				tdActions.appendChild(menu);
			}
			menu.style.position = '';
			menu.style.left = '';
			menu.style.top = '';
			menu.style.right = '';
			menu.style.zIndex = '';
		};

		const openMenu = () => {
			document.querySelectorAll('.whoneedsawriter__jd-rowmenu-pop').forEach((el) => {
				if (el !== menu && !el.hasAttribute('hidden')) {
					el.setAttribute('hidden', '');
				}
			});
			if (menu.parentElement !== document.body) {
				document.body.appendChild(menu);
			}
			menu.removeAttribute('hidden');
			menuBtn.setAttribute('aria-expanded', 'true');
			positionMenu();
		};

		menuBtn.addEventListener('click', (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			const isOpen = !menu.hasAttribute('hidden');
			if (isOpen) closeMenu();
			else openMenu();
		});

		document.addEventListener('click', () => closeMenu(), { passive: true });
		window.addEventListener('resize', () => {
			if (!menu.hasAttribute('hidden')) {
				positionMenu();
			}
		}, { passive: true });
		window.addEventListener('scroll', () => {
			if (!menu.hasAttribute('hidden')) {
				closeMenu();
			}
		}, { passive: true, capture: true });
		menu.addEventListener('click', (ev) => ev.stopPropagation());

		const viewUrl = row.viewPostUrl != null ? String(row.viewPostUrl).trim() : '';

		editItem.disabled = !editUrl || isRemoved;
		viewItem.disabled = (!viewUrl && !editUrl) || isRemoved;
		delItem.disabled = effectivePostId <= 0 || isRemoved;

		editItem.addEventListener('click', () => {
			closeMenu();
			if (editUrl) window.open(editUrl, '_blank', 'noopener,noreferrer');
		});

		viewItem.addEventListener('click', () => {
			closeMenu();
			const u = viewUrl || editUrl;
			if (u) window.open(u, '_blank', 'noopener,noreferrer');
		});

		if (regenItem) {
			regenItem.addEventListener('click', () => {
				closeMenu();
				const kw = row.keyword != null ? String(row.keyword).trim() : '';
				const fill = kw || titleText;
				if (!fill) return;
				const dest = wnawBuildGenerateUrlWithKeywords([fill]);
				if (dest) window.location.href = dest;
			});
		}

		const deleteViaAjax = async () => {
			if (!cfg || !cfg.ajaxUrl || !cfg.actionDeletePost || !cfg.nonceDeletePost) return false;
			if (effectivePostId <= 0) return false;
			const params = new URLSearchParams();
			params.set('action', String(cfg.actionDeletePost));
			params.set('nonce', String(cfg.nonceDeletePost));
			params.set('postId', String(effectivePostId));
			if (batchIdForDelete) params.set('batchId', batchIdForDelete);
			if (articleTitleForDelete) params.set('articleTitle', articleTitleForDelete);
			params.set('rowIndex', String(index));
			try {
				const res = await fetch(String(cfg.ajaxUrl), {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
					body: params.toString(),
				});
				const json = await res.json();
				return !!(json && json.success);
			} catch (e) {
				return false;
			}
		};

		const applyRemovedRowUi = () => {
			tr.classList.add('is-removed');
			pill.className = 'whoneedsawriter__jd-pill whoneedsawriter__jd-pill--removed';
			pill.innerHTML = `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">` +
				`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
				`<path d="M8 12h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>` +
				`</svg><span>${labelRemoved}</span>`;
			previewBtn.disabled = true;
			previewBtn.classList.add('is-disabled');
			previewBtn.setAttribute('aria-disabled', 'true');
			previewBtn.setAttribute('title', 'This article was removed from WordPress.');
			editItem.disabled = true;
			viewItem.disabled = true;
			delItem.disabled = true;
			const titleLink = tdTitle.querySelector('.whoneedsawriter__jd-titlelink');
			if (titleLink) {
				const plain = titleLink.textContent || '';
				tdTitle.textContent = plain;
				tdTitle.setAttribute('title', plain);
			}
		};

		delItem.addEventListener('click', (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			closeMenu();
			setTimeout(async () => {
				const ok = await wnawConfirmDeleteArticle(str);
				if (!ok) return;
				delItem.disabled = true;
				const success = await deleteViaAjax();
				if (!success) {
					delItem.disabled = false;
					window.alert(str.articlesDeleteFailed ? String(str.articlesDeleteFailed) : 'Could not delete this article.');
					return;
				}
				if (batchIdForDelete) {
					wnawPatchBatchArticleInCache(batchIdForDelete, index, {
						statusKey: 'removed',
						statusLabel: labelRemoved,
						wpPostId: 0,
						wpPostStatus: '',
						editPostUrl: '',
						isPublished: false,
					});
				}
				applyRemovedRowUi();
			}, 0);
		});

		tr.appendChild(tdActions);

		return tr;
	}

	/**
	 * Job Detail screen: dynamically render header + stepper for the batch
	 * identified by `?job_id=` in the URL. Reuses the batches list endpoint
	 * (cached in plugin DB from the jobs list page) instead of
	 * introducing a per-batch API call.
	 */
	(function initJobDetailUi() {
		const root = document.querySelector('[data-wnaw-jd-root]');
		if (!root || !cfg) {
			return;
		}

		const jobId = root.getAttribute('data-wnaw-job-id') || '';
		if (!jobId) {
			return;
		}

		const headerEl     = root.querySelector('[data-wnaw-jd-header]');
		const nameEl       = root.querySelector('[data-wnaw-jd-name]');
		const statusEl     = root.querySelector('[data-wnaw-jd-status]');
		const submittedEl  = root.querySelector('[data-wnaw-jd-submitted]');
		const stepEls      = root.querySelectorAll('[data-wnaw-jd-step]');
		const noticeEl     = root.querySelector('[data-wnaw-jd-notice]');

		const tplComplete  = root.querySelector('[data-wnaw-jd-tpl="meta-complete"]');
		const tplActive    = root.querySelector('[data-wnaw-jd-tpl="meta-active-progress"]');
		const tplPending   = root.querySelector('[data-wnaw-jd-tpl="meta-pending"]');

		const str = cfg.strings || {};

		/* Articles table: show loading immediately (no PHP placeholder rows). */
		const articlesSection = root.querySelector('[data-wnaw-jd-articles]');
		const articlesTbody   = root.querySelector('[data-wnaw-jd-articles-tbody]');
		const articlesTable   = articlesSection
			? articlesSection.querySelector('.whoneedsawriter__jd-table')
			: null;
		const COLSPAN = 5;

		const clearArticlesBody = () => {
			if (!articlesTbody) return;
			while (articlesTbody.firstChild) articlesTbody.removeChild(articlesTbody.firstChild);
		};

		const setArticlesLoading = () => {
			if (!articlesTbody) return;
			if (articlesTable) articlesTable.setAttribute('aria-busy', 'true');
			clearArticlesBody();
			const tr = document.createElement('tr');
			tr.className = 'whoneedsawriter__jd-articles-loading';
			const td = document.createElement('td');
			td.colSpan = COLSPAN;
			td.innerHTML =
				'<span class="whoneedsawriter__jobs-loading-inner">' +
				'<svg class="whoneedsawriter__spinner" viewBox="0 0 50 50" focusable="false" aria-hidden="true">' +
				'<circle class="whoneedsawriter__spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>' +
				'</svg>' +
				`<span>${str.articlesLoading ? String(str.articlesLoading) : 'Loading articles…'}</span>` +
				'</span>';
			tr.appendChild(td);
			articlesTbody.appendChild(tr);
		};

		const setArticlesEmpty = (msg) => {
			if (!articlesTbody) return;
			if (articlesTable) articlesTable.setAttribute('aria-busy', 'false');
			clearArticlesBody();
			const tr = document.createElement('tr');
			const td = document.createElement('td');
			td.colSpan = COLSPAN;
			td.className = 'whoneedsawriter__jd-articles-empty';
			td.textContent = msg;
			tr.appendChild(td);
			articlesTbody.appendChild(tr);
		};

		if (articlesTbody) {
			setArticlesLoading();
		}

		/** @type {Record<string, unknown>[] | null} */
		let dbArticlesLoaded = null;

		const STATUS_CLASS_PREFIX = 'whoneedsawriter__jd-status--';
		const STEP_STATE_CLASSES  = ['is-complete', 'is-active', 'is-pending'];

		/**
		 * @param {string} message
		 * @param {'error' | 'info'} [level]
		 */
		const setNotice = (message, level) => {
			if (!noticeEl) return;
			if (!message) {
				noticeEl.setAttribute('hidden', '');
				noticeEl.textContent = '';
				return;
			}
			noticeEl.removeAttribute('hidden');
			noticeEl.textContent = message;
			noticeEl.classList.remove('notice-error', 'notice-info');
			noticeEl.classList.add(level === 'info' ? 'notice-info' : 'notice-error');
		};

		/** MMDDYY (UTC) → "MMM D, YYYY". Falls back to the raw value when format unknown. */
		const formatBatchDate = (raw) => {
			const s = raw == null ? '' : String(raw).trim();
			if (!s) return '';
			if (/^\d{6}$/.test(s)) {
				const mm = parseInt(s.substring(0, 2), 10);
				const dd = parseInt(s.substring(2, 4), 10);
				const yy = parseInt(s.substring(4, 6), 10);
				const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
				const monthIdx = mm - 1;
				if (monthIdx >= 0 && monthIdx < 12 && dd > 0 && dd < 32) {
					return `${months[monthIdx]} ${dd}, 20${String(yy).padStart(2, '0')}`;
				}
			}
			return s;
		};

		/**
		 * @param {HTMLElement | null} stepEl
		 * @param {'complete' | 'active' | 'pending'} state
		 */
		const setStepState = (stepEl, state) => {
			if (!stepEl) return;
			STEP_STATE_CLASSES.forEach((c) => stepEl.classList.remove(c));
			const cls =
				state === 'complete' ? 'is-complete' :
				state === 'active'   ? 'is-active' :
				                       'is-pending';
			stepEl.classList.add(cls);
		};

		/**
		 * @param {HTMLElement | null} stepEl
		 * @param {HTMLTemplateElement | null} template
		 */
		const swapStepMeta = (stepEl, template) => {
			if (!stepEl || !template) return;
			const meta = stepEl.querySelector('[data-wnaw-jd-step-meta]');
			if (!meta) return;
			while (meta.firstChild) meta.removeChild(meta.firstChild);
			meta.appendChild(template.content.cloneNode(true));
		};

		const getStepEl = (n) => {
			let found = null;
			stepEls.forEach((el) => {
				if (el.getAttribute('data-wnaw-jd-step') === String(n)) found = el;
			});
			return found;
		};

		/**
		 * Render a single batch payload into the DOM. The payload shape matches
		 * the AJAX rows produced by handle_ajax_get_jobs() (camelCase).
		 *
		 * @param {Record<string, unknown>} batch
		 */
		let latestBatch = /** @type {Record<string, unknown> | null} */ (null);
		/** @type {unknown[] | null} */
		let latestArticleRows = null;

		const renderBatch = (batch) => {
			latestBatch = batch;
			setNotice('');

			const name        = batch.name != null ? String(batch.name).trim() : '';
			const displayName = name ? wnawNormalizePluginJobDisplayName(name) : '—';
			const statusInt   = Number.isFinite(Number(batch.statusInt)) ? Number(batch.statusInt) : 0;
			const total       = Number.isFinite(Number(batch.articles)) ? Number(batch.articles) : 0;
			const completed   = Number.isFinite(Number(batch.completedArticles)) ? Number(batch.completedArticles) : 0;
			const created     = batch.createdAt != null ? String(batch.createdAt) : '';

			if (nameEl) {
				nameEl.textContent = displayName;
			}

			if (statusEl) {
				const isCompleted = statusInt === 1;
				const labelDone   = statusEl.getAttribute('data-label-completed')   || 'Completed';
				const labelActive = statusEl.getAttribute('data-label-in-progress') || 'In Progress';
				statusEl.removeAttribute('hidden');
				statusEl.textContent = isCompleted ? labelDone : labelActive;
				/* Strip every modifier class so we never stack stale states. */
				const toRemove = [];
				statusEl.classList.forEach((c) => {
					if (c.indexOf(STATUS_CLASS_PREFIX) === 0) toRemove.push(c);
				});
				toRemove.forEach((c) => statusEl.classList.remove(c));
				statusEl.classList.add(STATUS_CLASS_PREFIX + (isCompleted ? 'completed' : 'in_progress'));
			}

			if (submittedEl) {
				const prefix = submittedEl.getAttribute('data-prefix') || 'Submitted on';
				const dateStr = formatBatchDate(created);
				submittedEl.textContent = dateStr ? `${prefix} ${dateStr}` : prefix;
			}

			/* Stepper logic
			 * status 0 (generating): step1=complete · step2=active · step3=pending
			 * status 1 (completed):  all three steps marked complete
			 */
			const step1 = getStepEl(1);
			const step2 = getStepEl(2);
			const step3 = getStepEl(3);

			setStepState(step1, 'complete');
			swapStepMeta(step1, tplComplete);

			if (statusInt === 1) {
				setStepState(step2, 'complete');
				swapStepMeta(step2, tplComplete);
				/* Step 3 is updated only from article rows (syncArticlesStepperProgress). */
			} else {
				setStepState(step2, 'active');
				swapStepMeta(step2, tplActive);
				const pill = step2 ? step2.querySelector('[data-wnaw-jd-progress-pill]') : null;
				const bar  = step2 ? step2.querySelector('[data-wnaw-jd-progress-bar]') : null;
				if (pill) {
					pill.textContent = `${completed} / ${total} articles generated`;
				}
				if (bar) {
					const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((completed / total) * 100))) : 0;
					/** @type {HTMLElement} */ (bar).style.width = pct + '%';
					const wrap = bar.parentElement;
					if (wrap) wrap.setAttribute('aria-valuenow', String(pct));
				}
				setStepState(step3, 'pending');
				swapStepMeta(step3, tplPending);
			}
		};

		/**
		 * Derive step-2 / step-3 badges from loaded article rows.
		 * Step 2: Generating → done when no row is still "generating".
		 * Step 3: Scheduling & Posting → progress when rows are "generated" (found in WP).
		 * @param {unknown[]} rows
		 */
		const syncArticlesStepperProgress = (rows) => {
			if (!Array.isArray(rows) || rows.length === 0) {
				return;
			}
			const b = latestBatch;
			if (!b) {
				return;
			}

			const batchTotal = Number.isFinite(Number(b.articles)) ? Number(b.articles) : 0;
			const total = Math.max(batchTotal, rows.length);

			const rowKey = (r) => (r && typeof r === 'object' && 'statusKey' in r ? String(r.statusKey) : '');

			const inWp = rows.filter((r) => rowKey(r) === 'generated').length;
			const failed = rows.filter((r) => rowKey(r) === 'failed').length;
			const generating = rows.filter((r) => rowKey(r) === 'generating').length;

			const denom = total > 0 ? total : rows.length;
			const doneGen = Math.min(denom, total - generating);
			const allGenDone = denom > 0 && generating === 0;
			const eligible = Math.max(0, denom - failed);
			const cappedInWp = eligible > 0 ? Math.min(inWp, eligible) : inWp;
			/* No "Generating" rows → table is only Generated / Failed → scheduling step is done. */
			const schedulingDone = allGenDone;

			const step2 = getStepEl(2);
			const step3 = getStepEl(3);

			const step3PillLabel = (posted, eligibleCount) => {
				if (str.step3ProgressPill) {
					return String(str.step3ProgressPill)
						.replace('%1$d', String(posted))
						.replace('%2$d', String(eligibleCount));
				}
				return `${posted} / ${eligibleCount} scheduled & posted`;
			};

			if (allGenDone) {
				if (step2) {
					setStepState(step2, 'complete');
					swapStepMeta(step2, tplComplete);
				}
			} else {
				if (step2) {
					setStepState(step2, 'active');
					swapStepMeta(step2, tplActive);
					const pill = step2.querySelector('[data-wnaw-jd-progress-pill]');
					const bar = step2.querySelector('[data-wnaw-jd-progress-bar]');
					if (pill) {
						pill.textContent = `${doneGen} / ${denom} articles generated`;
					}
					if (bar) {
						const pct = denom > 0 ? Math.max(0, Math.min(100, Math.round((doneGen / denom) * 100))) : 0;
						/** @type {HTMLElement} */ (bar).style.width = pct + '%';
						const wrap = bar.parentElement;
						if (wrap) wrap.setAttribute('aria-valuenow', String(pct));
					}
				}
			}

			if (!step3) {
				return;
			}

			if (schedulingDone) {
				setStepState(step3, 'complete');
				swapStepMeta(step3, tplComplete);
				return;
			}

			if (inWp > 0) {
				setStepState(step3, 'active');
				swapStepMeta(step3, tplActive);
				const pill = step3.querySelector('[data-wnaw-jd-progress-pill]');
				const bar = step3.querySelector('[data-wnaw-jd-progress-bar]');
				if (pill) {
					pill.textContent = step3PillLabel(cappedInWp, eligible > 0 ? eligible : denom);
				}
				if (bar) {
					const base = eligible > 0 ? eligible : denom;
					const pct = base > 0 ? Math.max(0, Math.min(100, Math.round((cappedInWp / base) * 100))) : 0;
					/** @type {HTMLElement} */ (bar).style.width = pct + '%';
					const wrap = bar.parentElement;
					if (wrap) wrap.setAttribute('aria-valuenow', String(pct));
				}
				return;
			}

			setStepState(step3, 'pending');
			swapStepMeta(step3, tplPending);
		};

		/** Read the cached batches list from plugin DB (jobs page). */
		const readCache = () => wnawReadBatchesCache();

		const findById = (list, id) => {
			if (!Array.isArray(list)) return null;
			for (let i = 0; i < list.length; i++) {
				const r = list[i];
				if (r && String(r.id) === String(id)) return r;
			}
			return null;
		};

		/**
		 * Per-article schedule labels from the Generate-page snapshot (schedule mode).
		 * Primary key: batch id (`assignedBatch`). Tries alternate keys for older saves.
		 * @returns {string[]}
		 */
		const getArticleScheduledSlots = () => {
			const cache = readCache();
			const snap = wnawFindBatchSnapshot(jobId, cache);
			return wnawArticleScheduledSlotsFromSnapshot(snap);
		};

		/**
		 * Show/hide the in-progress notice from DB article statuses.
		 *
		 * @param {Record<string, unknown>[]} rows
		 * @param {Record<string, unknown> | null} [batch]
		 */
		const updateJobDetailNotice = (rows, batch) => {
			const infoNotice = root.querySelector('[data-wnaw-jd-info-notice]');
			if (!infoNotice) return;
			const hasGenerating = Array.isArray(rows) && rows.some((r) => r && String(r.statusKey) === 'generating');
			const batchGenerating = batch && String(batch.statusKey) === 'generating';
			infoNotice.style.display = (hasGenerating || batchGenerating) ? 'flex' : 'none';
		};

		/**
		 * Load articles from DB; optionally background-sync Generating rows via SaaS.
		 *
		 * @param {{ forceLoading?: boolean }} [opts]
		 */
		const loadArticlesFromDb = async (opts) => {
			if (!articlesTbody) return [];

			const forceLoading = !!(opts && opts.forceLoading);
			if (forceLoading) {
				setArticlesLoading();
			}

			const dbArticles = await wnawDbLoadArticles(jobId);
			dbArticlesLoaded = dbArticles;

			if (dbArticles.length > 0) {
				renderArticlesRows(dbArticles);
			} else {
				setArticlesEmpty(str.articlesEmpty ? String(str.articlesEmpty) : 'No articles yet for this job.');
			}

			const batch = await wnawDbLoadBatch(jobId);
			if (batch) {
				renderBatch(batch);
			}
			updateJobDetailNotice(dbArticles, batch);

			const syncResult = await wnawSyncGeneratingArticlesIfNeeded(jobId, dbArticles);
			if (syncResult) {
				renderArticlesRows(syncResult.rows);
				if (syncResult.batch) {
					renderBatch(syncResult.batch);
				}
				updateJobDetailNotice(syncResult.rows, syncResult.batch);
				return syncResult.rows;
			}

			return dbArticles;
		};

		const showLoading = () => {
			if (headerEl) headerEl.setAttribute('aria-busy', 'true');
		};
		const clearLoading = () => {
			if (headerEl) headerEl.removeAttribute('aria-busy');
		};

		const showNotFound = () => {
			const msg = str.jobDetailNotFound
				? String(str.jobDetailNotFound)
				: 'This job could not be found. It may have been deleted or the link is outdated.';
			setNotice(msg, 'error');
		};

		/* --- Job Settings sidebar (plugin DB snapshot) ------------------- */
		const settingsRoot     = root.querySelector('[data-wnaw-jd-settings]');
		const settingsEmptyEl  = root.querySelector('[data-wnaw-jd-settings-empty]');

		/**
		 * @param {string} key
		 * @param {string} value
		 */
		const setSettingText = (key, value) => {
			if (!settingsRoot) return;
			const el = settingsRoot.querySelector(`[data-wnaw-jd-setting="${key}"]`);
			if (el) el.textContent = value;
		};

		/**
		 * @param {string[]} keywords
		 */
		const setSettingKeywords = (keywords) => {
			if (!settingsRoot) return;
			const list = settingsRoot.querySelector('[data-wnaw-jd-setting-list="keywords"]');
			if (!list) return;
			while (list.firstChild) list.removeChild(list.firstChild);
			if (!keywords || keywords.length === 0) {
				const li = document.createElement('li');
				li.className = 'whoneedsawriter__jd-setting-bullets-empty';
				li.textContent = '—';
				list.appendChild(li);
				return;
			}
			keywords.forEach((k) => {
				const li = document.createElement('li');
				li.textContent = String(k);
				list.appendChild(li);
			});
		};

		const clearSettings = () => {
			setSettingText('model', '—');
			setSettingText('word_count', '—');
			setSettingText('authors', '—');
			setSettingText('publish_mode', '—');
			setSettingKeywords([]);
			if (settingsRoot) {
				const countEl = settingsRoot.querySelector('[data-wnaw-jd-setting="keywords_count"]');
				if (countEl) countEl.textContent = '0';
			}
		};

		/**
		 * @param {Record<string, unknown> | null} settings
		 */
		const renderBatchSettings = (settings) => {
			if (!settingsRoot) return;
			if (!settings) {
				clearSettings();
				if (settingsEmptyEl) settingsEmptyEl.removeAttribute('hidden');
				return;
			}
			if (settingsEmptyEl) settingsEmptyEl.setAttribute('hidden', '');

			const modelLabel = settings.model_label != null ? String(settings.model_label) : '';
			const wordCount  = settings.word_count != null ? String(settings.word_count) : '';
			/** @type {string[]} */
			const keywords   = Array.isArray(settings.keywords) ? settings.keywords.map((k) => String(k)) : [];
			/** @type {string[]} */
			const authors    = Array.isArray(settings.authors)  ? settings.authors.map((a) => String(a))  : [];
			const publishLbl = settings.publish_mode_label != null
				? String(settings.publish_mode_label)
				: (settings.publish_mode != null ? String(settings.publish_mode) : '');

			setSettingText('model', modelLabel || '—');
			setSettingText('word_count', wordCount || '—');
			setSettingText('authors', authors.length ? authors.join(', ') : '—');
			setSettingText('publish_mode', publishLbl || '—');
			setSettingKeywords(keywords);

			const countEl = settingsRoot.querySelector('[data-wnaw-jd-setting="keywords_count"]');
			if (countEl) countEl.textContent = String(keywords.length);
		};

		/** Read batch settings from plugin DB runtime cache. */
		const loadSettingsForBatch = (batchName) => {
			if (!batchName) {
				renderBatchSettings(null);
				return;
			}
			const snap = wnawReadBatchSettings(batchName);
			renderBatchSettings(snap);
		};

		/**
		 * @param {Record<string, unknown>[]} rows
		 */
		const renderArticlesRows = (rows) => {
			if (!articlesTbody) return;
			if (!Array.isArray(rows) || rows.length === 0) {
				setArticlesEmpty(str.articlesEmpty ? String(str.articlesEmpty) : 'No articles yet for this job.');
				return;
			}

			latestArticleRows = rows;
			const scheduledSlots = getArticleScheduledSlots();
			const batchesCache = readCache();

			clearArticlesBody();
			if (articlesTable) articlesTable.setAttribute('aria-busy', 'false');

			rows.forEach((/** @type {Record<string, unknown>} */ r, idx) => {
				/** @type {Record<string, unknown>} */
				const enriched = Object.assign({}, r);
				if (!enriched.batchId) {
					enriched.batchId = jobId;
				}
				if (!enriched.scheduledTime) {
					const resolved = wnawResolveArticleScheduledTime(enriched, batchesCache, idx);
					enriched.scheduledTime = resolved
						|| (scheduledSlots[idx] != null ? String(scheduledSlots[idx]).trim() : '');
				}
				articlesTbody.appendChild(buildArticleRow(enriched, idx, str));
			});

			syncArticlesStepperProgress(rows);

			const countEl = articlesSection
				? articlesSection.querySelector('[data-wnaw-jd-articles-count]')
				: null;
			if (countEl) {
				const generatedCount = rows.filter((r) => {
					const k = r && typeof r === 'object' && 'statusKey' in r ? String(r.statusKey) : '';
					return k === 'generated';
				}).length;
				countEl.textContent = `(${generatedCount} / ${rows.length})`;
			}
		};

		const bootstrapJobDetail = async () => {
			const dbSettings = await wnawDbLoadBatchSettings(jobId);
			if (dbSettings) {
				renderBatchSettings(dbSettings);
			} else {
				loadSettingsForBatch(jobId);
			}

			const batch = await wnawDbLoadBatch(jobId);
			if (!batch) {
				showNotFound();
				return;
			}

			renderBatch(batch);
			await loadArticlesFromDb();
		};

		bootstrapJobDetail();

		/* --- Refresh Status ------------------------------------------------ */
		const refreshBtn      = root.querySelector('[data-wnaw-jd-refresh]');
		const refreshLabelEl  = root.querySelector('[data-wnaw-jd-refresh-label]');
		const refreshIdleLabel = refreshLabelEl ? String(refreshLabelEl.textContent || 'Refresh Status').trim() : 'Refresh Status';
		const refreshBusyLabel = str.articlesLoading
			? String(str.articlesLoading).replace('…', '').trim() || 'Refreshing'
			: 'Refreshing';

		/** @param {boolean} busy */
		const setRefreshBusy = (busy) => {
			if (!refreshBtn) return;
			refreshBtn.classList.toggle('is-loading', !!busy);
			/** @type {HTMLButtonElement} */ (refreshBtn).disabled = !!busy;
			if (refreshLabelEl) {
				refreshLabelEl.textContent = busy ? refreshBusyLabel + '…' : refreshIdleLabel;
			}
		};

		const refreshAll = async () => {
			setRefreshBusy(true);
			setNotice('');

			const batch = await wnawDbLoadBatch(jobId);
			if (!batch) {
				showNotFound();
				setRefreshBusy(false);
				return;
			}

			renderBatch(batch);
			await loadArticlesFromDb({ forceLoading: true });
			setRefreshBusy(false);
		};

		if (refreshBtn) {
			refreshBtn.addEventListener('click', () => { refreshAll(); });
		}
	})();

	/**
	 * All Articles screen: full-page table populated via the same articles
	 * AJAX endpoint, without a batchId so it returns every article for the
	 * verified user.
	 */
	(function initArticlesAllUi() {
		const root = document.querySelector('[data-wnaw-articles-all-root]');
		if (!root || !cfg) return;

		const tbody     = root.querySelector('[data-wnaw-articles-tbody]');
		const notice    = root.querySelector('[data-wnaw-articles-notice]');
		const refreshBtn = root.querySelector('[data-wnaw-articles-refresh]');
		const countEl   = root.querySelector('[data-wnaw-articles-count]');

		const str = cfg.strings || {};
		const COLSPAN = 5;

		const setNotice = (msg, level) => {
			if (!notice) return;
			if (!msg) {
				notice.setAttribute('hidden', '');
				notice.textContent = '';
				return;
			}
			notice.removeAttribute('hidden');
			notice.textContent = msg;
			notice.classList.remove('notice-error', 'notice-info');
			notice.classList.add(level === 'info' ? 'notice-info' : 'notice-error');
		};

		const clearBody = () => {
			if (!tbody) return;
			while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
		};

		const setLoading = (busy) => {
			if (refreshBtn) {
				refreshBtn.classList.toggle('is-loading', !!busy);
				/** @type {HTMLButtonElement} */ (refreshBtn).disabled = !!busy;
			}
			if (!tbody || !busy) return;
			clearBody();
			const tr = document.createElement('tr');
			tr.className = 'whoneedsawriter__jd-articles-loading';
			const td = document.createElement('td');
			td.colSpan = COLSPAN;
			td.innerHTML =
				'<span class="whoneedsawriter__jobs-loading-inner">' +
				'<svg class="whoneedsawriter__spinner" viewBox="0 0 50 50" focusable="false" aria-hidden="true">' +
				'<circle class="whoneedsawriter__spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>' +
				'</svg>' +
				`<span>${str.articlesLoading ? String(str.articlesLoading) : 'Loading articles…'}</span>` +
				'</span>';
			tr.appendChild(td);
			tbody.appendChild(tr);
		};

		const setEmpty = (msg) => {
			if (!tbody) return;
			clearBody();
			const tr = document.createElement('tr');
			const td = document.createElement('td');
			td.colSpan = COLSPAN;
			td.className = 'whoneedsawriter__jd-articles-empty';
			td.textContent = msg;
			tr.appendChild(td);
			tbody.appendChild(tr);
		};

		const load = async () => {
			if (!cfg.actionGetArticles || !cfg.nonceGetArticles || !cfg.ajaxUrl || !tbody) return;

			setNotice('');
			setLoading(true);

			const params = new URLSearchParams();
			params.set('action', String(cfg.actionGetArticles));
			params.set('nonce', String(cfg.nonceGetArticles));

			try {
				const res = await fetch(String(cfg.ajaxUrl), {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
					body: params.toString(),
				});
				/** @type {{ success?: boolean; data?: { rows?: unknown[]; message?: string } }} */
				const json = await res.json();
				setLoading(false);
				if (!(json && json.success && json.data && Array.isArray(json.data.rows))) {
					const msg =
						json && json.data && json.data.message
							? String(json.data.message)
							: str.articlesError
								? String(str.articlesError)
								: 'Could not load articles.';
					setNotice(msg, 'error');
					setEmpty('—');
					return;
				}

				const rows = json.data.rows;
				if (countEl) {
					countEl.textContent = `(${rows.length})`;
				}

				if (rows.length === 0) {
					setEmpty(
						str.articlesEmptyAll
							? String(str.articlesEmptyAll)
							: 'No articles generated yet. Start your first batch from Generate Article.'
					);
					return;
				}

				const batchesCache = await wnawFetchBatchesCache();

				clearBody();
				rows.forEach((/** @type {Record<string, unknown>} */ r, idx) => {
					/** @type {Record<string, unknown>} */
					const enriched = Object.assign({}, r);
					if (!enriched.scheduledTime) {
						enriched.scheduledTime = wnawResolveArticleScheduledTime(enriched, batchesCache, idx);
					}
					tbody.appendChild(buildArticleRow(enriched, idx, str));
				});
			} catch (e) {
				setLoading(false);
				setNotice(str.networkError ? String(str.networkError) : 'Network error.', 'error');
				setEmpty('—');
			}
		};

		if (refreshBtn) {
			refreshBtn.addEventListener('click', () => load());
		}

		load();
	})();

	/**
	 * Settings screen: credits, sync placeholders, disconnect confirm.
	 */
	(function initSettingsUi() {
		const root = document.querySelector('[data-wnaw-settings]');
		if (!root || !cfg) {
			return;
		}

		const notice = root.querySelector('[data-wnaw-settings-notice]');
		const elCredits = root.querySelector('[data-wnaw-settings-credits]');
		const disconnectMsgEl = root.querySelector('[data-wnaw-disconnect-msg]');
		const disconnectTriggers = root.querySelectorAll('[data-wnaw-disconnect-trigger]');
		const btnCat = root.querySelector('[data-wnaw-sync-categories]');
		const btnAuthor = root.querySelector('[data-wnaw-sync-authors]');

		const str = cfg.strings || {};

		disconnectTriggers.forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const msg =
					disconnectMsgEl && disconnectMsgEl.textContent
						? disconnectMsgEl.textContent.trim()
						: str.settingsDisconnectConfirm
							? String(str.settingsDisconnectConfirm)
							: '';
				if (msg && !window.confirm(msg)) {
					e.preventDefault();
				}
			});
		});

		/**
		 * @param {string} message
		 */
		const setSettingsNotice = (message) => {
			if (!notice) return;
			if (!message) {
				notice.setAttribute('hidden', '');
				notice.textContent = '';
				return;
			}
			notice.removeAttribute('hidden');
			notice.textContent = message;
		};

		/**
		 * @param {unknown} v
		 * @returns {string}
		 */
		const fmtCredits = (v) => {
			const n = Number(v);
			if (!Number.isFinite(n)) return '0';
			if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
			return n.toFixed(1);
		};

		const loadCredits = async () => {
			const account = await wnawFetchAccountState(false);
			if (account && typeof account === 'object' && typeof account.credits !== 'undefined') {
				elCredits.textContent = fmtCredits(account.credits);
			}
		};

		/**
		 * @param {string} actionKey
		 * @param {string} nonceKey
		 * @param {HTMLButtonElement | null} btn
		 */
		const runSync = async (actionKey, nonceKey, btn) => {
			const action = /** @type {Record<string, unknown>} */ (cfg)[actionKey];
			const nonce = /** @type {Record<string, unknown>} */ (cfg)[nonceKey];
			if (!action || !nonce || !cfg.ajaxUrl) {
				setSettingsNotice(str.settingsSyncError ? String(str.settingsSyncError) : 'Sync request failed.');
				return;
			}

			const prev = btn ? btn.textContent : '';
			if (btn) {
				btn.disabled = true;
				btn.setAttribute('aria-busy', 'true');
			}

			const params = new URLSearchParams();
			params.set('action', String(action));
			params.set('nonce', String(nonce));

			try {
				const res = await fetch(String(cfg.ajaxUrl), {
					method: 'POST',
					credentials: 'same-origin',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
					},
					body: params.toString(),
				});
				const json = await res.json();
				if (json && json.success && json.data && json.data.message != null) {
					setSettingsNotice(String(json.data.message));
					return;
				}
				const errMsg =
					json && json.data && json.data.message != null ? String(json.data.message) : str.settingsSyncError
						? String(str.settingsSyncError)
						: 'Sync request failed.';
				setSettingsNotice(errMsg);
			} catch (e) {
				setSettingsNotice(str.networkError ? String(str.networkError) : 'Network error.');
			} finally {
				if (btn) {
					btn.disabled = false;
					btn.removeAttribute('aria-busy');
					if (prev != null) btn.textContent = prev;
				}
			}
		};

		if (btnCat) {
			btnCat.addEventListener('click', () => runSync('actionSyncCategories', 'nonceSyncCategories', btnCat));
		}
		if (btnAuthor) {
			btnAuthor.addEventListener('click', () => runSync('actionSyncAuthors', 'nonceSyncAuthors', btnAuthor));
		}

		loadCredits();
	})();

	/**
	 * Remove stray cache-plugin notices (e.g. LiteSpeed "Reset the optimized data successfully.") from our admin screens.
	 */
	(function removeOptimizationResetAdminNotice() {
		const needles = [
			'Reset the optimized data successfully.',
			'Reset the optimized data successfully',
		];
		const root = document.getElementById('wpbody-content');
		if (!root) {
			return;
		}
		root.querySelectorAll('.notice, .notice-warning, .notice-success, .notice-info, .updated').forEach((el) => {
			const text = el.textContent || '';
			for (let i = 0; i < needles.length; i++) {
				if (text.indexOf(needles[i]) !== -1) {
					el.remove();
					return;
				}
			}
		});
	})();
})();
