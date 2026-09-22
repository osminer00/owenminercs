import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}(`);
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

function extractConstObject(source, name) {
	const start = source.indexOf(`const ${name} = {`);
	assert.notEqual(start, -1, `${name} object should exist`);
	const braceStart = source.indexOf('{', start);
	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1) + ';';
		}
	}
	assert.fail(`${name} object should close`);
}

function extractConstString(source, name) {
	const match = source.match(new RegExp(`const ${name} = ('[^']*'|"[^"]*");`));
	assert.ok(match, `${name} string constant should exist`);
	return match[0];
}

function loadSocialNavMarkup() {
	const sandbox = {};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstString(componentsSource, 'DISCORD_INVITE_URL')}
		${extractConstObject(componentsSource, 'SOCIAL_ICON_PATHS')}
		${extractFunction(componentsSource, 'socialIconSvg')}
		${extractFunction(componentsSource, 'socialNavTipMarkup')}
		${extractFunction(componentsSource, 'socialNavMarkup')}
		this.__fn = socialNavMarkup;
		`,
		sandbox
	);
	assert.equal(typeof sandbox.__fn, 'function');
	return sandbox.__fn;
}

test('socialNavMarkup keeps the base class and interpolates optional extraClass values', () => {
	const socialNavMarkup = loadSocialNavMarkup();

	const base = socialNavMarkup();
	assert.match(base, /class="site-social-nav"/);
	assert.doesNotMatch(base, /class="site-social-nav /);

	const dock = socialNavMarkup('site-social-nav--dock');
	assert.match(dock, /class="site-social-nav site-social-nav--dock"/);
	assert.doesNotMatch(dock, /class="site-social-nav"/);

	const footer = socialNavMarkup('site-social-nav--footer');
	assert.match(footer, /class="site-social-nav site-social-nav--footer"/);

	assert.equal(socialNavMarkup(''), base, 'empty extraClass should match the no-arg markup');
});

test('socialNavMarkup keeps required social brands and Discord invite wiring', () => {
	const socialNavMarkup = loadSocialNavMarkup();
	const html = socialNavMarkup('site-social-nav--dock');

	for (const brand of [
		'x',
		'reddit',
		'youtube',
		'twitch',
		'instagram',
		'facebook',
		'tiktok',
		'discord',
	]) {
		assert.match(html, new RegExp(`data-social-brand="${brand}"`));
	}

	assert.match(html, /href="https:\/\/discord\.gg\/fA9GbxmAge"/);
	assert.match(html, /role="navigation"/);
	assert.match(html, /aria-label="External social profiles"/);
	assert.match(html, /data-owen-social-spin/);
});
