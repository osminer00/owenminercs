import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const postsSource = readFileSync(new URL('../Posts/scripts/posts.js', import.meta.url), 'utf8');

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

function createNode(tag) {
	const childNodes = [];
	const attrs = {};
	let text = '';
	const node = {
		tagName: String(tag).toUpperCase(),
		childNodes,
		listeners: {},
		parentNode: null,
		get className() {
			return attrs.class || '';
		},
		set className(value) {
			attrs.class = String(value);
		},
		get id() {
			return attrs.id || '';
		},
		set id(value) {
			attrs.id = String(value);
		},
		get textContent() {
			return text;
		},
		set textContent(value) {
			text = String(value);
			childNodes.length = 0;
		},
		get src() {
			return attrs.src || '';
		},
		set src(value) {
			attrs.src = String(value);
		},
		get alt() {
			return attrs.alt || '';
		},
		set alt(value) {
			attrs.alt = String(value);
		},
		get loading() {
			return attrs.loading || '';
		},
		set loading(value) {
			attrs.loading = String(value);
		},
		get type() {
			return attrs.type || '';
		},
		set type(value) {
			attrs.type = String(value);
		},
		setAttribute(name, value) {
			attrs[name] = String(value);
		},
		getAttribute(name) {
			return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
		},
		appendChild(child) {
			childNodes.push(child);
			child.parentNode = node;
			return child;
		},
		addEventListener(type, fn) {
			if (!node.listeners[type]) node.listeners[type] = [];
			node.listeners[type].push(fn);
		},
		click() {
			for (const fn of node.listeners.click || []) fn({ target: node });
		},
	};
	return node;
}

function loadPostHelpers() {
	const dialog = {
		showModal() {
			this.open = true;
		},
		close() {
			this.open = false;
		},
		open: false,
	};
	const dlgImg = createNode('img');
	const dlgTitle = createNode('span');
	const dlgClose = {
		focused: false,
		focus() {
			this.focused = true;
		},
	};

	const sandbox = {
		String,
		Number,
		Date,
		Array,
		document: {
			createElement: createNode,
			createDocumentFragment() {
				return createNode('#fragment');
			},
		},
		dialog,
		dlgImg,
		dlgTitle,
		dlgClose,
		lastFocus: null,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(postsSource, 'formatDate')}
		${extractFunction(postsSource, 'descriptionToNodes')}
		${extractFunction(postsSource, 'openLightbox')}
		${extractFunction(postsSource, 'renderImages')}
		${extractFunction(postsSource, 'renderPost')}
		this.__helpers = {
			formatDate,
			descriptionToNodes,
			openLightbox,
			renderImages,
			renderPost,
			dialog,
			dlgImg,
			dlgTitle,
			dlgClose,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('formatDate returns empty or original strings for unusable input', () => {
	const helpers = loadPostHelpers();
	assert.equal(helpers.formatDate(''), '');
	assert.equal(helpers.formatDate(null), '');
	assert.equal(helpers.formatDate(2024), '');
	assert.equal(helpers.formatDate('not-a-date'), 'not-a-date');
});

test('formatDate formats a midday ISO timestamp without throwing', () => {
	const helpers = loadPostHelpers();
	const formatted = helpers.formatDate('2024-06-15T12:00:00');
	assert.match(formatted, /2024/);
	assert.match(formatted, /15/);
});

test('descriptionToNodes splits paragraphs and keeps markup as text', () => {
	const helpers = loadPostHelpers();

	const empty = helpers.descriptionToNodes(null);
	assert.equal(empty.childNodes.length, 0);

	const nodes = helpers.descriptionToNodes(
		'First paragraph.\n\n\n<script>alert(1)</script>\n\n   \n\nThird'
	);
	assert.equal(nodes.childNodes.length, 3);
	assert.equal(nodes.childNodes[0].tagName, 'P');
	assert.equal(nodes.childNodes[0].textContent, 'First paragraph.');
	assert.equal(nodes.childNodes[1].textContent, '<script>alert(1)</script>');
	assert.equal(nodes.childNodes[1].childNodes.length, 0);
	assert.equal(nodes.childNodes[2].textContent, 'Third');
});

test('renderImages skips blank sources and maps layout classes', () => {
	const helpers = loadPostHelpers();
	const images = [
		{ src: '', alt: 'missing' },
		{ src: '   ', alt: 'spaces' },
		{ src: 'images/shot.webp', alt: 'Desk shot' },
		{ src: 'images/plain.webp' },
	];

	assert.equal(helpers.renderImages([], 'stack', 'Post'), null);
	assert.equal(helpers.renderImages(null, 'grid', 'Post'), null);

	const stack = helpers.renderImages(images, 'unexpected', 'Post');
	assert.equal(stack.className, 'site-post-images site-post-images--stack');
	assert.equal(stack.childNodes.length, 2);
	assert.equal(stack.childNodes[0].tagName, 'FIGURE');
	assert.equal(stack.childNodes[0].childNodes[0].src, 'images/shot.webp');
	assert.equal(stack.childNodes[0].childNodes[0].loading, 'lazy');
	assert.equal(stack.childNodes[0].childNodes[1].tagName, 'FIGCAPTION');
	assert.equal(stack.childNodes[0].childNodes[1].textContent, 'Desk shot');
	assert.equal(stack.childNodes[1].childNodes.length, 1);

	const grid = helpers.renderImages(images, 'grid', 'Post');
	assert.equal(grid.className, 'site-post-images site-post-images--grid');

	const gallery = helpers.renderImages(images, 'gallery', 'Setup tour');
	assert.equal(gallery.className, 'site-post-images site-post-images--gallery');
	assert.equal(gallery.childNodes[0].tagName, 'BUTTON');
	assert.equal(gallery.childNodes[0].type, 'button');
	assert.equal(gallery.childNodes[0].getAttribute('aria-label'), 'Enlarge: Desk shot');
	assert.equal(gallery.childNodes[1].getAttribute('aria-label'), 'Enlarge: Setup tour');

	gallery.childNodes[0].click();
	assert.equal(helpers.dialog.open, true);
	assert.equal(helpers.dlgImg.src, 'images/shot.webp');
	assert.equal(helpers.dlgImg.alt, 'Desk shot');
	assert.equal(helpers.dlgTitle.textContent, 'Setup tour');
	assert.equal(helpers.dlgClose.focused, true);
});

test('renderPost sanitizes ids, defaults titles, and uses stack unless grid/gallery', () => {
	const helpers = loadPostHelpers();
	const article = helpers.renderPost({
		id: 'hello world',
		date: '2024-06-15',
		description: 'Hello',
		images: [{ src: 'images/a.webp', alt: 'A' }],
		imageLayout: 'carousel',
	});

	assert.equal(article.className, 'site-post');
	assert.equal(article.id, 'post-hello-world');
	assert.equal(article.childNodes[0].childNodes[0].textContent, 'Untitled');
	assert.equal(article.childNodes[0].childNodes[1].tagName, 'TIME');
	assert.equal(article.childNodes[0].childNodes[1].getAttribute('datetime'), '2024-06-15');
	assert.equal(article.childNodes[2].className, 'site-post-images site-post-images--stack');

	const untitled = helpers.renderPost({ title: 'Named', description: '' });
	assert.equal(untitled.id, '');
	assert.equal(untitled.childNodes[0].childNodes[0].textContent, 'Named');
	assert.equal(untitled.childNodes.length, 2);
});
