(function () {
	const board = document.getElementById('viewAllContentBoard');
	const statusEl = document.getElementById('viewAllContentStatus');
	if (!board) return;

	const DATA_FILES = [
		{ path: 'data/youtube-videos.json', kind: 'youtube-long' },
		{ path: 'data/youtube-shorts.json', kind: 'youtube-short' },
		{ path: 'data/tiktok-posts.json', kind: 'tiktok' },
		{ path: 'data/x-top-posts.json', kind: 'x' },
		{ path: 'data/instagram-posts.json', kind: 'instagram' },
		{ path: 'data/facebook-posts.json', kind: 'facebook' },
		{ path: 'data/twitch-posts.json', kind: 'twitch' },
	];

	const CLUSTER_HOURS = 20;
	const CLUSTER_TITLE_DAYS = 14;

	function normalizePlatform(p) {
		const x = String(p || '')
			.toLowerCase()
			.trim();
		return x === 'twitter' ? 'x' : x;
	}

	function extractYoutubeId(url) {
		const s = String(url || '');
		let m = s.match(/[?&]v=([^&]+)/);
		if (m) return m[1];
		m = s.match(/youtu\.be\/([^?&]+)/);
		if (m) return m[1];
		m = s.match(/\/shorts\/([^/?]+)/);
		return m ? m[1] : '';
	}

	function parseTime(iso) {
		const t = Date.parse(String(iso || ''));
		return Number.isFinite(t) ? t : 0;
	}

	function utcDateKey(iso) {
		const t = parseTime(iso);
		if (!t) return '';
		return new Date(t).toISOString().slice(0, 10);
	}

	function normalizeTitle(title) {
		return String(title || '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ' ')
			.trim()
			.slice(0, 96);
	}

	function isVideoLike(entry) {
		const plat = normalizePlatform(entry.platform);
		if (plat === 'youtube' || plat === 'tiktok') return true;
		if (plat === 'instagram' && /\/reel\//i.test(String(entry.url || ''))) return true;
		const mk = String(entry.mediaKind || '').toLowerCase();
		const ct = String(entry.contentType || '').toLowerCase();
		if (plat === 'x' || plat === 'twitter') return mk === 'video' || ct === 'video';
		if (plat === 'instagram') return mk !== 'image' && ct !== 'photo';
		if (plat === 'facebook' || plat === 'twitch') return mk === 'video' || ct === 'video';
		return ct === 'video' || mk === 'video';
	}

	function isImageLike(entry) {
		const plat = normalizePlatform(entry.platform);
		const mk = String(entry.mediaKind || '').toLowerCase();
		const ct = String(entry.contentType || '').toLowerCase();
		if (plat === 'x' || plat === 'twitter') return mk === 'image' || ct === 'photo' || (!mk && ct === 'photo');
		if (plat === 'instagram') return mk === 'image' || ct === 'photo';
		return mk === 'image' || ct === 'photo';
	}

	function canCrossMerge(a, b) {
		if (normalizePlatform(a.platform) === normalizePlatform(b.platform)) return false;
		const va = isVideoLike(a);
		const vb = isVideoLike(b);
		if (va && vb) return true;
		const ia = isImageLike(a);
		const ib = isImageLike(b);
		if (ia && ib) return true;
		return false;
	}

	class UnionFind {
		constructor(n) {
			this.p = Array.from({ length: n }, (_, i) => i);
		}
		find(i) {
			if (this.p[i] !== i) this.p[i] = this.find(this.p[i]);
			return this.p[i];
		}
		union(a, b) {
			const ra = this.find(a);
			const rb = this.find(b);
			if (ra !== rb) this.p[rb] = ra;
		}
	}

	function platformSortKey(entry) {
		const order = {
			youtube: 0,
			tiktok: 1,
			instagram: 2,
			x: 3,
			facebook: 4,
			twitch: 5,
			reddit: 6,
		};
		const pl = normalizePlatform(entry.platform);
		const base = order[pl] ?? 99;
		const ytShort = pl === 'youtube' && String(entry.contentType || '').toLowerCase() === 'short';
		return base * 10 + (ytShort ? 1 : 0);
	}

	function pickPrimaryEntry(cluster) {
		const sorted = [...cluster].sort((a, b) => {
			const ka = platformSortKey(a);
			const kb = platformSortKey(b);
			if (ka !== kb) return ka - kb;
			return parseTime(b.publishedAt) - parseTime(a.publishedAt);
		});
		return sorted[0];
	}

	function formatDate(iso) {
		const t = parseTime(iso);
		if (!t) return '';
		try {
			return new Intl.DateTimeFormat(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				timeZone: 'UTC',
			}).format(new Date(t));
		} catch {
			return utcDateKey(iso);
		}
	}

	function labelForEntry(entry) {
		const pl = normalizePlatform(entry.platform);
		if (pl === 'youtube') {
			return String(entry.contentType || '').toLowerCase() === 'short' ? 'YouTube Short' : 'YouTube';
		}
		const labels = {
			tiktok: 'TikTok',
			instagram: 'Instagram',
			x: 'X',
			facebook: 'Facebook',
			twitch: 'Twitch',
			reddit: 'Reddit',
		};
		return labels[pl] || pl;
	}

	function renderCard(cluster) {
		const primary = pickPrimaryEntry(cluster);
		const title =
			cluster.map((e) => String(e.title || '').trim()).sort((a, b) => b.length - a.length)[0] ||
			'Post';
		const thumb =
			primary.thumbnail ||
			cluster.find((e) => e.thumbnail)?.thumbnail ||
			'';
		const primaryUrl = primary.url || '#';

		const byPlatform = new Map();
		for (const e of cluster) {
			const key = normalizePlatform(e.platform);
			const sub =
				key === 'youtube' && String(e.contentType || '').toLowerCase() === 'short'
					? 'youtube-short'
					: key;
			const prev = byPlatform.get(sub);
			if (!prev || parseTime(e.publishedAt) > parseTime(prev.publishedAt)) {
				byPlatform.set(sub, e);
			}
		}

		const actions = [...byPlatform.entries()]
			.sort(([ka], [kb]) => {
				const fakeA = { platform: ka.startsWith('youtube') ? 'youtube' : ka, contentType: ka === 'youtube-short' ? 'short' : '' };
				const fakeB = { platform: kb.startsWith('youtube') ? 'youtube' : kb, contentType: kb === 'youtube-short' ? 'short' : '' };
				return platformSortKey(fakeA) - platformSortKey(fakeB);
			})
			.map(([, e]) => {
				const lab = labelForEntry(e);
				return `<a class="vac-platform-btn" href="${escapeAttr(e.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(lab)}</a>`;
			})
			.join('');

		const slotLabel =
			cluster.length > 1 ? `Cross-post · ${cluster.length} places` : labelForEntry(primary);

		const peek =
			cluster.length > 1
				? `Same clip grouped by publish date/title match — open any platform below.`
				: String(primary.caption || '').trim().slice(0, 220) +
					(String(primary.caption || '').length > 220 ? '…' : '');

		const imgHtml = thumb
			? `<a class="vac-thumb-link" href="${escapeAttr(primaryUrl)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-label="Open primary link"><img class="keep-card__thumb" src="${escapeAttr(thumb)}" alt="" loading="lazy" decoding="async" /></a>`
			: `<div class="keep-card__thumb keep-card__thumb--empty" role="img" aria-label="">No thumbnail</div>`;

		return `
<div class="keep-card keep-card--static" role="article">
	<span class="keep-card__inner">
		${imgHtml}
		<div class="keep-card__scalable">
			<div class="keep-card__video-slot">${escapeHtml(slotLabel)}</div>
			<div class="keep-card__body">
				<p class="keep-card__label">${escapeHtml(title)}</p>
				<div class="keep-card__affiliate">
					<p style="margin:0;font-size:0.82rem;color:var(--text-muted);">${escapeHtml(formatDate(primary.publishedAt) || '')}</p>
				</div>
				<div class="vac-platform-actions" aria-label="Open on each platform">${actions}</div>
			</div>
		</div>
	</span>
	<div class="keep-card__peek">
		<p>${escapeHtml(peek || '—')}</p>
		<div class="keep-card__peek-extra" aria-hidden="true">&nbsp;</div>
	</div>
</div>`;
	}

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function escapeAttr(s) {
		return escapeHtml(s).replace(/\n/g, ' ');
	}

	async function loadJson(relPath) {
		const res = await fetch(relPath, { credentials: 'same-origin' });
		if (!res.ok) throw new Error(`${relPath}: ${res.status}`);
		return res.json();
	}

	function flattenPayload(data) {
		if (!data) return [];
		if (Array.isArray(data)) return data;
		if (Array.isArray(data.items)) return data.items;
		return [];
	}

	function hintFromPath(p) {
		if (p.includes('youtube-videos')) return 'youtube';
		if (p.includes('youtube-shorts')) return 'youtube';
		if (p.includes('tiktok')) return 'tiktok';
		if (p.includes('instagram')) return 'instagram';
		if (p.includes('x-top')) return 'x';
		if (p.includes('facebook')) return 'facebook';
		if (p.includes('twitch')) return 'twitch';
		return '';
	}

	async function main() {
		const entries = [];
		for (const spec of DATA_FILES) {
			try {
				const data = await loadJson(spec.path);
				const rows = flattenPayload(data);
				for (const row of rows) {
					if (!row || typeof row !== 'object') continue;
					const url = String(row.url || '').trim();
					if (!url) continue;
					entries.push({
						...row,
						platform: normalizePlatform(row.platform) || hintFromPath(spec.path),
					});
				}
			} catch {
				/* optional files */
			}
		}

		const n = entries.length;
		const uf = new UnionFind(n);

		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				const a = entries[i];
				const b = entries[j];
				const pa = normalizePlatform(a.platform);
				const pb = normalizePlatform(b.platform);

				if (pa === pb) {
					const ua = String(a.url || '');
					const ub = String(b.url || '');
					if (ua && ua === ub) uf.union(i, j);
					const ya = extractYoutubeId(ua);
					const yb = extractYoutubeId(ub);
					if (ya && ya === yb) uf.union(i, j);
					continue;
				}

				if (!canCrossMerge(a, b)) continue;

				const ya = extractYoutubeId(a.url);
				const yb = extractYoutubeId(b.url);
				if (ya && ya === yb) {
					uf.union(i, j);
					continue;
				}

				const dkA = utcDateKey(a.publishedAt);
				const dkB = utcDateKey(b.publishedAt);
				if (dkA && dkA === dkB) {
					const dt = Math.abs(parseTime(a.publishedAt) - parseTime(b.publishedAt));
					if (dt <= CLUSTER_HOURS * 3600 * 1000) {
						uf.union(i, j);
						continue;
					}
				}

				const ta = normalizeTitle(a.title);
				const tb = normalizeTitle(b.title);
				if (ta.length >= 16 && ta === tb) {
					const dt = Math.abs(parseTime(a.publishedAt) - parseTime(b.publishedAt));
					if (dt <= CLUSTER_TITLE_DAYS * 24 * 3600 * 1000) uf.union(i, j);
				}
			}
		}

		const groups = new Map();
		for (let i = 0; i < n; i++) {
			const r = uf.find(i);
			if (!groups.has(r)) groups.set(r, []);
			groups.get(r).push(entries[i]);
		}

		const clusters = [...groups.values()].sort((A, B) => {
			const tA = Math.max(...A.map((e) => parseTime(e.publishedAt)));
			const tB = Math.max(...B.map((e) => parseTime(e.publishedAt)));
			return tB - tA;
		});

		board.innerHTML = clusters.map(renderCard).join('');
		if (statusEl) {
			statusEl.textContent = `${clusters.length} grouped posts (${n} total items from feeds).`;
		}
	}

	main().catch((err) => {
		console.error(err);
		if (statusEl) statusEl.textContent = 'Could not load content feeds.';
		board.innerHTML =
			'<p class="vac-error" role="alert">Something went wrong loading social data. Try refreshing.</p>';
	});
})();
