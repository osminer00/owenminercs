import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const socialCloudSource = readFileSync(
	new URL('../Socials/scripts/social-cloud.js', import.meta.url),
	'utf8'
);

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${functionName} should have parameters`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = paramsStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '(') parenDepth += 1;
		if (char === ')') {
			parenDepth -= 1;
			if (parenDepth === 0) {
				paramsEnd = i;
				break;
			}
		}
	}
	assert.notEqual(paramsEnd, -1, `${functionName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${functionName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function extractConstAssignment(source, constName) {
	const start = source.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${constName} assignment should end`);
	return source.slice(start, end + 1);
}

function createMemoryStorage() {
	const store = new Map();
	return {
		getItem(key) {
			return store.has(key) ? store.get(key) : null;
		},
		setItem(key, value) {
			store.set(String(key), String(value));
		},
		removeItem(key) {
			store.delete(key);
		},
	};
}

function loadCatalogHelpers(options = {}) {
	const nowMs = Number.isFinite(options.nowMs)
		? options.nowMs
		: Date.parse('2026-08-09T12:00:00Z');
	const RealDate = Date;
	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		Array,
		Set,
		URL,
		console,
		Date: class FrozenDate extends RealDate {
			static now() {
				return nowMs;
			}
		},
		toContentCard(item) {
			return {
				platform: item.platform,
				title: item.title,
				url: item.url,
				likeCount: item.likeCount,
				viewCount: item.viewCount,
			};
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(socialCloudSource, 'MIN_SOCIAL_ENGAGEMENT')}
		${extractConstAssignment(socialCloudSource, 'X_MIN_LIKES')}
		${extractConstAssignment(socialCloudSource, 'REDDIT_MIN_UPVOTES')}
		${extractFunction(socialCloudSource, 'normalizePlatformKey')}
		${extractFunction(socialCloudSource, 'toSafeNumber')}
		${extractFunction(socialCloudSource, 'hasMinimumSocialEngagement')}
		${extractFunction(socialCloudSource, 'isLivestreamLikeContent')}
		${extractFunction(socialCloudSource, 'getYouTubeVideoId')}
		${extractFunction(socialCloudSource, 'getCuratedShortScore')}
		${extractFunction(socialCloudSource, 'interleaveCardGroups')}
		${extractFunction(socialCloudSource, 'getCardCatalog')}
		this.__helpers = {
			MIN_SOCIAL_ENGAGEMENT,
			isLivestreamLikeContent,
			getYouTubeVideoId,
			getCardCatalog,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

function loadVisitedHelpers(seedUrls = []) {
	const localStorage = createMemoryStorage();
	if (seedUrls.length) {
		localStorage.setItem('smc-visited-links', JSON.stringify(seedUrls));
	}

	const sandbox = {
		localStorage,
		window: {
			location: {
				origin: 'https://www.owenminercs.com',
				href: 'https://www.owenminercs.com/Socials/socials.html',
			},
		},
		URL,
		JSON,
		Set,
		Array,
		String,
		console,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(socialCloudSource, 'VISITED_LINKS_STORAGE_KEY')}
		${extractFunction(socialCloudSource, 'loadVisitedLinks')}
		const visitedLinks = loadVisitedLinks();
		${extractFunction(socialCloudSource, 'normalizeVisitedUrl')}
		${extractFunction(socialCloudSource, 'persistVisitedLinks')}
		${extractFunction(socialCloudSource, 'isLinkVisited')}
		${extractFunction(socialCloudSource, 'markLinkVisited')}
		this.__helpers = {
			VISITED_LINKS_STORAGE_KEY,
			normalizeVisitedUrl,
			isLinkVisited,
			markLinkVisited,
			visitedLinks,
		};
		`,
		sandbox
	);

	return {
		helpers: sandbox.__helpers,
		localStorage,
	};
}

function loadIdleSpinHelpers(options = {}) {
	const controllers = [];
	const timeoutCalls = [];
	let nextTimerId = 1;
	let activeTimer = null;

	const windowObj = {
		setTimeout(cb, delay) {
			const id = nextTimerId++;
			activeTimer = { id, cb, delay };
			timeoutCalls.push({ id, delay });
			return id;
		},
		clearTimeout(id) {
			if (activeTimer && activeTimer.id === id) activeTimer = null;
		},
	};

	const sandbox = {
		window: windowObj,
		prefersReducedMotion: Boolean(options.prefersReducedMotion),
		idleSpinActive: false,
		idleSpinTimerId: 0,
		socialCardSpinControllers: controllers,
		console,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(socialCloudSource, 'SOCIAL_CARD_IDLE_SPIN_MS')}
		${extractFunction(socialCloudSource, 'stopIdleSpinForAllCards')}
		${extractFunction(socialCloudSource, 'startIdleSpinForAllCards')}
		${extractFunction(socialCloudSource, 'clearIdleSpinTimer')}
		${extractFunction(socialCloudSource, 'scheduleIdleSpinTimer')}
		${extractFunction(socialCloudSource, 'handleIdleSpinInterrupt')}
		this.__helpers = {
			SOCIAL_CARD_IDLE_SPIN_MS,
			stopIdleSpinForAllCards,
			startIdleSpinForAllCards,
			clearIdleSpinTimer,
			scheduleIdleSpinTimer,
			handleIdleSpinInterrupt,
			get idleSpinActive() { return idleSpinActive; },
			get idleSpinTimerId() { return idleSpinTimerId; },
		};
		`,
		sandbox
	);

	return {
		helpers: sandbox.__helpers,
		controllers,
		timeoutCalls,
		runActiveTimer() {
			assert.ok(activeTimer, 'expected an active idle timer');
			const current = activeTimer;
			activeTimer = null;
			current.cb();
		},
	};
}

test('social-cloud catalog excludes livestreams and dedupes YouTube by video id', () => {
	const { getCardCatalog, isLivestreamLikeContent, MIN_SOCIAL_ENGAGEMENT } = loadCatalogHelpers();

	assert.equal(
		isLivestreamLikeContent({
			title: 'Holiday livestream recap',
			url: 'https://www.youtube.com/watch?v=live1',
		}),
		true
	);
	assert.equal(
		isLivestreamLikeContent({
			title: 'Desk tour',
			url: 'https://www.youtube.com/watch?v=abc12345',
		}),
		false
	);

	const catalog = getCardCatalog([
		{
			platform: 'YouTube',
			title: 'Low engagement',
			url: 'https://www.youtube.com/watch?v=lowengage',
			likeCount: MIN_SOCIAL_ENGAGEMENT - 1,
			viewCount: 10,
			publishedAt: '2026-08-01T00:00:00Z',
		},
		{
			platform: 'YouTube',
			title: 'Live flag',
			url: 'https://www.youtube.com/watch?v=liveflag1',
			likeCount: 500,
			viewCount: 1000,
			isLive: true,
			publishedAt: '2026-08-02T00:00:00Z',
		},
		{
			platform: 'YouTube',
			title: 'Watch party livestream',
			url: 'https://www.youtube.com/watch?v=livetext1',
			likeCount: 500,
			viewCount: 1000,
			publishedAt: '2026-08-02T00:00:00Z',
		},
		{
			platform: 'YouTube',
			title: 'Duplicate first-seen watch URL',
			url: 'https://www.youtube.com/watch?v=samevid99',
			likeCount: 200,
			viewCount: 1000,
			publishedAt: '2026-08-01T00:00:00Z',
		},
		{
			platform: 'YouTube',
			title: 'Duplicate later shorts URL',
			url: 'https://www.youtube.com/shorts/samevid99',
			likeCount: 900,
			viewCount: 50000,
			publishedAt: '2026-08-03T00:00:00Z',
		},
		{
			platform: 'YouTube',
			title: 'Unique high score clip',
			url: 'https://www.youtube.com/watch?v=unique777',
			likeCount: 800,
			viewCount: 90000,
			publishedAt: '2026-08-04T00:00:00Z',
		},
		{
			platform: 'TikTok',
			title: 'TikTok keep',
			url: 'https://www.tiktok.com/@owen/video/111',
			likeCount: 300,
			viewCount: 2000,
			publishedAt: '2026-08-04T00:00:00Z',
		},
	]);

	const youtubeTitles = catalog
		.filter((card) => card.platform === 'YouTube')
		.map((card) => card.title);
	// First-seen video id wins before score sorting; later shorts duplicate is dropped.
	assert.deepEqual(Array.from(youtubeTitles), [
		'Unique high score clip',
		'Duplicate first-seen watch URL',
	]);
	assert.ok(
		catalog.some((card) => card.platform === 'TikTok' && card.title === 'TikTok keep'),
		'TikTok cards should still interleave into the catalog'
	);
	assert.ok(
		!catalog.some((card) => /live/i.test(card.title)),
		'livestream-like YouTube rows must stay out of the catalog'
	);
});

test('social-cloud visited links persist normalized https URLs and ignore unsafe schemes', () => {
	const { helpers, localStorage } = loadVisitedHelpers();
	const url = 'https://www.youtube.com/watch?v=abc12345';

	assert.equal(helpers.isLinkVisited(url), false);
	helpers.markLinkVisited(url);
	assert.equal(helpers.isLinkVisited(url), true);
	assert.equal(helpers.isLinkVisited('/watch?v=abc12345'), false);

	const stored = JSON.parse(localStorage.getItem(helpers.VISITED_LINKS_STORAGE_KEY));
	assert.deepEqual(Array.from(stored), [url]);

	helpers.markLinkVisited(url);
	const storedAgain = JSON.parse(localStorage.getItem(helpers.VISITED_LINKS_STORAGE_KEY));
	assert.equal(Array.from(storedAgain).length, 1);

	helpers.markLinkVisited('javascript:alert(1)');
	helpers.markLinkVisited('mailto:owen@example.com');
	assert.equal(helpers.isLinkVisited('javascript:alert(1)'), false);
	const afterUnsafe = JSON.parse(localStorage.getItem(helpers.VISITED_LINKS_STORAGE_KEY));
	assert.deepEqual(Array.from(afterUnsafe), [url]);
});

test('social-cloud idle spin arms a 15-minute timer, starts controllers, and resets on interrupt', () => {
	const starts = [];
	const stops = [];
	const { helpers, controllers, timeoutCalls, runActiveTimer } = loadIdleSpinHelpers();
	controllers.push({
		start() {
			starts.push('start');
		},
		stop() {
			stops.push('stop');
		},
	});

	helpers.scheduleIdleSpinTimer();
	assert.equal(timeoutCalls.length, 1);
	assert.equal(timeoutCalls[0].delay, helpers.SOCIAL_CARD_IDLE_SPIN_MS);
	assert.equal(helpers.SOCIAL_CARD_IDLE_SPIN_MS, 15 * 60 * 1000);

	runActiveTimer();
	assert.equal(helpers.idleSpinActive, true);
	assert.deepEqual(Array.from(starts), ['start']);

	helpers.handleIdleSpinInterrupt();
	assert.equal(helpers.idleSpinActive, false);
	assert.deepEqual(Array.from(stops), ['stop']);
	assert.equal(timeoutCalls.length, 2, 'interrupt should reschedule the idle timer');
	assert.equal(timeoutCalls[1].delay, helpers.SOCIAL_CARD_IDLE_SPIN_MS);
});

test('social-cloud idle spin respects reduced-motion preference', () => {
	const starts = [];
	const { helpers, controllers, runActiveTimer } = loadIdleSpinHelpers({
		prefersReducedMotion: true,
	});
	controllers.push({
		start() {
			starts.push('start');
		},
		stop() {},
	});

	helpers.scheduleIdleSpinTimer();
	runActiveTimer();
	assert.equal(helpers.idleSpinActive, false);
	assert.equal(starts.length, 0);
});
