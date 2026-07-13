(function () {
	'use strict';

	var listRoot = document.getElementById('donators-list');
	var summaryRoot = document.getElementById('donators-summary');
	var followersRoot = document.getElementById('donators-followers-list');
	var activityListRoot = document.getElementById('donators-activity-list');
	var activityStatusEl = document.getElementById('donators-activity-status');
	var activityRefreshBtn = document.getElementById('donators-activity-refresh');
	var errEl = document.getElementById('donators-error');
	if (!listRoot || !summaryRoot) return;

	var script = document.currentScript;
	var rel = (script && script.getAttribute('data-source')) || 'donators.json';
	var jsonUrl = new URL(rel, window.location.href).href;
	var cachedData = null;
	var ACTIVE_PLATFORMS = { kofi: true, streamelements: true };

	var DEFAULT_SUPPORT_LINKS = {
		ko_fi: 'https://ko-fi.com/owenminer',
		streamelements_tip: 'https://streamelements.com/owenminercs/tip',
	};

	var donateDialogEl = null;

	function isHttpUrl(s) {
		return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
	}

	function fetchSupportLinks() {
		var fallback = {
			ko_fi: DEFAULT_SUPPORT_LINKS.ko_fi,
			streamelements_tip: DEFAULT_SUPPORT_LINKS.streamelements_tip,
		};
		return fetch(new URL('/donation-links.json', window.location.href), {
			credentials: 'same-origin',
		})
			.then(function (r) {
				return r.ok ? r.json() : null;
			})
			.then(function (data) {
				if (!data) return fallback;
				var out = {
					ko_fi: fallback.ko_fi,
					streamelements_tip: fallback.streamelements_tip,
				};
				if (isHttpUrl(data.ko_fi)) out.ko_fi = data.ko_fi.trim();
				if (isHttpUrl(data.streamelements_tip))
					out.streamelements_tip = data.streamelements_tip.trim();
				return out;
			})
			.catch(function () {
				return fallback;
			});
	}

	function ensureDonateDialog() {
		if (donateDialogEl) return donateDialogEl;
		donateDialogEl = document.createElement('dialog');
		donateDialogEl.className = 'donators-donate-dialog';
		donateDialogEl.setAttribute('aria-labelledby', 'donators-donate-dialog-title');
		donateDialogEl.innerHTML =
			'<div class="donators-donate-dialog__inner">' +
			'<button type="button" class="donators-donate-dialog__scrim" aria-label="Close dialog"></button>' +
			'<div class="donators-donate-dialog__panel" role="document">' +
			'<button type="button" class="donators-donate-dialog__close" aria-label="Close">&times;</button>' +
			'<div class="donators-donate-dialog__standby">' +
			'<h3 id="donators-donate-dialog-title" class="donators-donate-dialog__title"></h3>' +
			'<p class="donators-donate-dialog__body"></p>' +
			'<div class="donators-donate-dialog__actions">' +
			'<a class="donators-donate-dialog__cta" target="_blank" rel="noopener noreferrer"></a>' +
			'<button type="button" class="donators-donate-dialog__dismiss">Close</button>' +
			'</div>' +
			'</div>' +
			'<div class="donators-donate-dialog__embed" hidden>' +
			'<p id="donators-donate-embed-kofi-title" class="donators-donate-dialog__embed-title">Donate on Ko-fi</p>' +
			'<iframe class="donators-donate-dialog__embed-frame" title="Ko-fi: support Owen Miner" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>' +
			'</div>' +
			'</div>' +
			'</div>';
		document.body.appendChild(donateDialogEl);
		donateDialogEl.setAttribute('aria-modal', 'true');
		donateDialogEl.setAttribute('aria-label', 'Donation');
		function clearKofiEmbed() {
			var d = donateDialogEl;
			d.classList.remove('donators-donate-dialog--kofi-embed');
			d.setAttribute('aria-labelledby', 'donators-donate-dialog-title');
			d.removeAttribute('aria-describedby');
			var st = d.querySelector('.donators-donate-dialog__standby');
			var em = d.querySelector('.donators-donate-dialog__embed');
			if (st) st.hidden = false;
			if (em) {
				em.hidden = true;
				var fr = em.querySelector('iframe.donators-donate-dialog__embed-frame');
				if (fr) fr.removeAttribute('src');
			}
		}
		donateDialogEl.addEventListener('close', clearKofiEmbed);
		function closeDialog() {
			donateDialogEl.close();
		}
		donateDialogEl
			.querySelector('.donators-donate-dialog__scrim')
			.addEventListener('click', closeDialog);
		donateDialogEl
			.querySelector('.donators-donate-dialog__close')
			.addEventListener('click', closeDialog);
		donateDialogEl
			.querySelector('.donators-donate-dialog__dismiss')
			.addEventListener('click', closeDialog);
		return donateDialogEl;
	}

	function kofiPageEmbedUrl(profilePageUrl) {
		try {
			var u = new URL(profilePageUrl, window.location.href);
			u.searchParams.set('hidefeed', 'true');
			u.searchParams.set('widget', '1');
			u.searchParams.set('embed', '1');
			return u.href;
		} catch (e) {
			return profilePageUrl;
		}
	}

	/** Centered modal with Ko-fi embed (donators pill); keeps the page floating Donate control independent. */
	function showKofiEmbedInDialog(koPageUrl) {
		var d = ensureDonateDialog();
		d.classList.add('donators-donate-dialog--kofi-embed');
		var st = d.querySelector('.donators-donate-dialog__standby');
		var em = d.querySelector('.donators-donate-dialog__embed');
		if (st) st.hidden = true;
		if (em) {
			em.hidden = false;
			var fr = em.querySelector('iframe.donators-donate-dialog__embed-frame');
			if (fr) {
				fr.setAttribute('loading', 'eager');
				fr.setAttribute('src', kofiPageEmbedUrl(koPageUrl));
			}
		}
		d.removeAttribute('aria-labelledby');
		d.setAttribute('aria-describedby', 'donators-donate-embed-kofi-title');
		if (typeof d.showModal === 'function') {
			d.showModal();
			var toFocus = d.querySelector('.donators-donate-dialog__close');
			if (toFocus) toFocus.focus();
		} else {
			window.open(koPageUrl, '_blank', 'noopener,noreferrer');
		}
	}

	/**
	 * Donators page only: open Ko-fi in a centered modal (embed), not the site floating widget.
	 * The corner “Donate” control stays separate; other pages still use data-kofi-link + overlay.
	 */
	function openKofiSupporterDonate(links) {
		var url = (links && links.ko_fi) || DEFAULT_SUPPORT_LINKS.ko_fi;
		showKofiEmbedInDialog(url);
	}

	/**
	 * Donators: StreamElements tips cannot be iframed on this site (their pages send
	 * X-Frame-Options: SAMEORIGIN). Use a centered browser window; modal only if the popup is blocked.
	 */
	function openStreamElementsSupporterDonate(links) {
		var url = (links && links.streamelements_tip) || DEFAULT_SUPPORT_LINKS.streamelements_tip;
		var w = 520;
		var h = 700;
		var screenLeft = window.screenX != null ? window.screenX : window.screenLeft;
		var screenTop = window.screenY != null ? window.screenY : window.screenTop;
		var outerW = window.outerWidth;
		var outerH = window.outerHeight;
		if (typeof outerW !== 'number' || Number.isNaN(outerW)) {
			outerW =
				document.documentElement && document.documentElement.clientWidth
					? document.documentElement.clientWidth
					: 0;
		}
		if (typeof outerH !== 'number' || Number.isNaN(outerH)) {
			outerH =
				document.documentElement && document.documentElement.clientHeight
					? document.documentElement.clientHeight
					: 0;
		}
		var left = screenLeft + Math.max(0, (outerW - w) / 2);
		var top = screenTop + Math.max(0, (outerH - h) / 2);
		var features =
			'width=' +
			w +
			',height=' +
			h +
			',left=' +
			Math.round(left) +
			',top=' +
			Math.round(top) +
			',location=yes,menubar=no,toolbar=no,scrollbars=yes,resizable=yes';
		var pop = window.open(url, 'owenminercsStreamElementsTip', features);
		if (pop) {
			try {
				pop.opener = null;
			} catch (e) {
				/* empty */
			}
			try {
				if (pop.focus) {
					pop.focus();
				}
			} catch (e2) {
				/* empty */
			}
			return;
		}
		showStreamElementsFallbackDialog(url);
	}

	/** If window.open is blocked, same centered modal shell as a manual escape hatch. */
	function showStreamElementsFallbackDialog(tipUrl) {
		var d = ensureDonateDialog();
		d.classList.remove('donators-donate-dialog--kofi-embed');
		var st = d.querySelector('.donators-donate-dialog__standby');
		var em = d.querySelector('.donators-donate-dialog__embed');
		if (st) st.hidden = false;
		if (em) {
			em.hidden = true;
			var efr = em.querySelector('iframe.donators-donate-dialog__embed-frame');
			if (efr) efr.removeAttribute('src');
		}
		d.setAttribute('aria-labelledby', 'donators-donate-dialog-title');
		d.removeAttribute('aria-describedby');
		d.querySelector('.donators-donate-dialog__title').textContent = 'Tip via StreamElements';
		d.querySelector('.donators-donate-dialog__body').textContent =
			'The tip page could not open in a new window. Allow popups for this site and try again, or use the link below to open the tip page in a new tab.';
		var ctaEl = d.querySelector('.donators-donate-dialog__cta');
		ctaEl.textContent = 'Open StreamElements tip page';
		ctaEl.setAttribute('href', tipUrl);
		ctaEl.removeAttribute('data-kofi-link');
		ctaEl.setAttribute('data-streamelements-tip-link', '');
		if (typeof d.showModal === 'function') {
			d.showModal();
			ctaEl.focus();
		} else {
			window.open(tipUrl, '_blank', 'noopener,noreferrer');
		}
	}

	function openDonateDialog(platform, supportLinks) {
		var links = supportLinks || {
			ko_fi: DEFAULT_SUPPORT_LINKS.ko_fi,
			streamelements_tip: DEFAULT_SUPPORT_LINKS.streamelements_tip,
		};
		if (platform === 'kofi') {
			openKofiSupporterDonate(links);
			return;
		}
		if (platform === 'streamelements') {
			openStreamElementsSupporterDonate(links);
			return;
		}
	}

	var PLATFORM_LABELS = {
		kofi: 'Ko-fi',
		twitch: 'Twitch',
		youtube: 'YouTube',
		streamelements: 'StreamElements',
		facebook: 'Facebook',
		instagram: 'Instagram',
		tiktok: 'TikTok',
		other: 'Other',
	};

	var FOLLOWER_PLATFORMS = ['twitch', 'youtube', 'facebook', 'instagram', 'tiktok'];

	function normalizePlatform(value) {
		var v = String(value || '')
			.trim()
			.toLowerCase();
		return PLATFORM_LABELS[v] ? v : 'other';
	}

	function platformIsActive(platform) {
		return Boolean(ACTIVE_PLATFORMS[normalizePlatform(platform)]);
	}

	function normalizeKind(value) {
		var v = String(value || '')
			.trim()
			.toLowerCase();
		if (v === 'subscription' || v === 'sub' || v === 'membership') return 'subscription';
		if (v === 'donation' || v === 'tip') return 'donation';
		if (v === 'bits' || v === 'cheer') return 'bits';
		return 'other';
	}

	function safeDate(value, withTime) {
		var raw = String(value || '').trim();
		if (!raw) return '';
		var parsed = new Date(raw);
		if (Number.isNaN(parsed.getTime())) return raw;
		if (withTime) {
			return parsed.toLocaleString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
			});
		}
		return parsed.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}

	function amountNumber(item) {
		var amount = String(item.amount || '').trim();
		if (!amount) return 0;
		var clean = amount.replace(/[^0-9.-]/g, '');
		var n = Number.parseFloat(clean);
		return Number.isFinite(n) ? n : 0;
	}

	function asNumber(value) {
		var n = Number(value);
		return Number.isFinite(n) ? n : 0;
	}

	function currencyText(num) {
		if (!Number.isFinite(num) || num <= 0) return '$0.00';
		return '$' + num.toFixed(2);
	}

	function intText(num) {
		return Math.max(0, Math.floor(asNumber(num))).toLocaleString();
	}

	function escapeAttr(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	function buildSupportEvents(items, twitchFeed) {
		var out = [];

		items.forEach(function (item) {
			if (!platformIsActive(item.platform)) return;
			var kind = normalizeKind(item.kind);
			var evt = {
				id: String(item.id || ''),
				name: String(item.name || 'Anonymous').trim() || 'Anonymous',
				platform: normalizePlatform(item.platform),
				kind: kind,
				donations: 0,
				bits: 0,
				subscribers: 0,
				date: String(item.date || '').trim(),
				message: String(item.message || '').trim(),
			};
			if (kind === 'donation') {
				evt.donations = amountNumber(item);
			} else if (kind === 'bits') {
				evt.bits = Math.max(0, asNumber(item.bits || item.amount || 0));
			} else if (kind === 'subscription') {
				evt.subscribers = Math.max(1, asNumber(item.subscribers || item.subs || 1));
			} else if (amountNumber(item) > 0) {
				evt.kind = 'donation';
				evt.donations = amountNumber(item);
			}
			if (evt.donations > 0 || evt.bits > 0 || evt.subscribers > 0) out.push(evt);
		});

		if (twitchFeed && Array.isArray(twitchFeed.events)) {
			twitchFeed.events.forEach(function (ev) {
				var kind = '';
				var subs = 0;
				var bits = 0;
				if (ev.type === 'bits') {
					kind = 'bits';
					bits = Math.max(0, asNumber(ev.bits || 0));
				} else if (ev.type === 'subscribe') {
					kind = 'subscription';
					subs = 1;
				} else if (ev.type === 'gift_sub') {
					kind = 'subscription';
					subs = Math.max(1, asNumber(ev.total || 1));
				} else {
					return;
				}

				out.push({
					id: String(ev.id || ''),
					name: String(ev.userName || 'Anonymous').trim() || 'Anonymous',
					platform: 'twitch',
					kind: kind,
					donations: 0,
					bits: bits,
					subscribers: subs,
					date: String(ev.createdAt || '').trim(),
					message: '',
				});
			});
		}

		return out.sort(function (a, b) {
			var da = Date.parse(a.date || '');
			var db = Date.parse(b.date || '');
			var va = Number.isFinite(da);
			var vb = Number.isFinite(db);
			if (va && vb) return db - da;
			if (va) return -1;
			if (vb) return 1;
			return a.name.localeCompare(b.name);
		});
	}

	function renderSummary(events, updatedAt, twitchFeed, supportLinks) {
		var counts = {
			kofi: 0,
			twitch: 0,
			youtube: 0,
			streamelements: 0,
			facebook: 0,
			instagram: 0,
			tiktok: 0,
			other: 0,
		};
		events.forEach(function (evt) {
			counts[normalizePlatform(evt.platform)] += 1;
		});
		summaryRoot.innerHTML = '';
		var card = document.createElement('section');
		card.className = 'donators-summary-card';

		var title = document.createElement('h2');
		title.textContent = 'Supporter totals';
		card.appendChild(title);

		var stats = document.createElement('div');
		stats.className = 'donators-summary-stats';
		['kofi', 'streamelements'].forEach(function (key) {
			var pill = document.createElement('button');
			pill.type = 'button';
			pill.className = 'donators-pill donators-pill--action';
			pill.textContent = PLATFORM_LABELS[key] + ': ' + counts[key];
			pill.setAttribute(
				'aria-label',
				key === 'kofi'
					? PLATFORM_LABELS[key] +
							': ' +
							counts[key] +
							'. Open centered Ko-fi donation form.'
					: PLATFORM_LABELS[key] +
							': ' +
							counts[key] +
							'. Open StreamElements tip in a centered window.'
			);
			pill.addEventListener('click', function () {
				openDonateDialog(key, supportLinks);
			});
			stats.appendChild(pill);
		});
		card.appendChild(stats);

		if (updatedAt) {
			var p = document.createElement('p');
			p.className = 'donators-updated';
			p.textContent = 'Last updated: ' + safeDate(updatedAt);
			card.appendChild(p);
		}

		summaryRoot.appendChild(card);
	}

	function kindLabel(kind, evt) {
		if (kind === 'donation') return 'Donation';
		if (kind === 'bits') return 'Bits';
		if (kind === 'subscription') {
			if (evt.platform === 'twitch' && asNumber(evt.subscribers) > 1) return 'Gifted subs';
			return 'Subscription';
		}
		return 'Support';
	}

	function renderSupporterCard(evt, supportLinks) {
		var tipLinks = supportLinks || DEFAULT_SUPPORT_LINKS;
		var article = document.createElement('article');
		article.className = 'donators-card';
		var platformNorm = normalizePlatform(evt.platform);
		article.setAttribute('data-platform', platformNorm);

		var name = document.createElement('h3');
		name.textContent = String(evt.name || 'Anonymous');
		article.appendChild(name);

		var stats = document.createElement('div');
		stats.className = 'donators-card-stats';
		if (evt.kind === 'donation') {
			var amount = document.createElement('p');
			amount.className = 'donators-card-amount';

			var amountPrefix = document.createElement('span');
			amountPrefix.className = 'donators-card-amount-prefix';
			amountPrefix.textContent = 'Donation:';
			amount.appendChild(amountPrefix);

			var amountValue = document.createElement('span');
			amountValue.className = 'donators-card-amount-value';
			amountValue.textContent = currencyText(evt.donations);
			amount.appendChild(amountValue);

			stats.appendChild(amount);
		} else if (evt.kind === 'bits') {
			stats.innerHTML = '<p><strong>Bits:</strong> ' + intText(evt.bits) + '</p>';
		} else if (evt.kind === 'subscription') {
			stats.innerHTML =
				'<p><strong>Subscribers:</strong> ' + intText(evt.subscribers) + '</p>';
		} else {
			stats.innerHTML = '<p><strong>Support:</strong> Activity recorded</p>';
		}
		article.appendChild(stats);

		var meta = document.createElement('p');
		meta.className = 'donators-card-meta';
		var label = PLATFORM_LABELS[platformNorm] || 'Other';
		if (platformNorm === 'kofi' || platformNorm === 'streamelements') {
			var platA = document.createElement('a');
			platA.href = platformNorm === 'kofi' ? tipLinks.ko_fi : tipLinks.streamelements_tip;
			platA.target = '_blank';
			platA.rel = 'noopener noreferrer';
			platA.className = 'donators-card-meta__platform-link';
			if (platformNorm === 'kofi') platA.setAttribute('data-kofi-link', '');
			if (platformNorm === 'streamelements')
				platA.setAttribute('data-streamelements-tip-link', '');
			platA.textContent = label;
			meta.appendChild(platA);
		} else {
			meta.appendChild(document.createTextNode(label));
		}
		meta.appendChild(document.createTextNode(' - ' + kindLabel(evt.kind, evt)));
		if (evt.date) meta.appendChild(document.createTextNode(' - ' + safeDate(evt.date, true)));
		article.appendChild(meta);

		if (evt.message) {
			var time = document.createElement('p');
			time.className = 'donators-card-message';
			time.textContent = evt.message;
			article.appendChild(time);
		}

		return article;
	}

	function renderFollowers(followerData, twitchFeed) {
		if (!followersRoot) return;
		followersRoot.innerHTML = '';

		var twitchFeedCount =
			twitchFeed && twitchFeed.totals ? asNumber(twitchFeed.totals.follows_total) : 0;
		var values = followerData || {};

		var frag = document.createDocumentFragment();
		FOLLOWER_PLATFORMS.forEach(function (platform) {
			var card = document.createElement('article');
			card.className = 'donators-followers-card';
			card.setAttribute('data-platform', platform);

			var h3 = document.createElement('h3');
			h3.textContent = PLATFORM_LABELS[platform];
			card.appendChild(h3);

			var n = document.createElement('p');
			n.className = 'donators-followers-count';
			var rawValue = values[platform];
			if (
				platform === 'twitch' &&
				(rawValue === undefined || rawValue === null || rawValue === '')
			) {
				rawValue = twitchFeedCount || '';
			}
			if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
				n.textContent = 'Not set';
				card.appendChild(n);
				frag.appendChild(card);
				return;
			}
			var num = Number(rawValue);
			n.textContent = Number.isFinite(num) && num >= 0 ? num.toLocaleString() : 'Not set';
			card.appendChild(n);

			frag.appendChild(card);
		});

		followersRoot.appendChild(frag);
	}

	function setActivityStatus(text, isError) {
		if (!activityStatusEl) return;
		activityStatusEl.textContent = text;
		activityStatusEl.dataset.state = isError ? 'error' : 'ok';
	}

	function renderActivity(twitchFeed, supportLinks) {
		if (!activityListRoot) return;
		activityListRoot.innerHTML = '';

		setActivityStatus('Twitch activity is paused for now.', false);
		var links = supportLinks || DEFAULT_SUPPORT_LINKS;
		var paused = document.createElement('article');
		paused.className = 'donators-activity-item donators-activity-item--empty';
		paused.innerHTML =
			'<h3>Paused</h3><p>Showing <a href="' +
			escapeAttr(links.ko_fi) +
			'" data-kofi-link target="_blank" rel="noopener noreferrer" class="donators-card-meta__platform-link">Ko-fi</a> and <a href="' +
			escapeAttr(links.streamelements_tip) +
			'" data-streamelements-tip-link target="_blank" rel="noopener noreferrer" class="donators-card-meta__platform-link">StreamElements</a> supporters only for now.</p>';
		activityListRoot.appendChild(paused);
	}

	function fetchTwitchFeed() {
		return Promise.resolve(null);
	}

	function renderSupporterCards(events, supportLinks) {
		listRoot.innerHTML = '';
		if (!events.length) {
			var empty = document.createElement('p');
			empty.className = 'donators-empty';
			empty.textContent =
				'No supporter activity yet. Add entries in Donators/donators.json or connect Twitch EventSub.';
			listRoot.appendChild(empty);
			return;
		}

		var frag = document.createDocumentFragment();
		events.forEach(function (evt) {
			frag.appendChild(renderSupporterCard(evt, supportLinks));
		});
		listRoot.appendChild(frag);
	}

	function applyRender(data, twitchFeed, supportLinks) {
		var supporters = Array.isArray(data.supporters) ? data.supporters : [];
		var events = buildSupportEvents(supporters, twitchFeed);

		renderSummary(events, data.updatedAt, twitchFeed, supportLinks);
		renderSupporterCards(events, supportLinks);
		renderFollowers(data.followers || {}, twitchFeed);
		renderActivity(twitchFeed, supportLinks);
	}

	Promise.all([
		fetch(jsonUrl).then(function (r) {
			if (!r.ok) throw new Error('missing');
			return r.json();
		}),
		fetchTwitchFeed(),
		fetchSupportLinks(),
	])
		.then(function (results) {
			cachedData = results[0] || {};
			applyRender(cachedData, results[1], results[2]);
		})
		.catch(function () {
			if (errEl) errEl.hidden = false;
		});
})();
