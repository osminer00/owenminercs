(function () {
	'use strict';

	var root = document.getElementById('site-posts-root');
	var emptyEl = document.getElementById('site-posts-empty');
	var errEl = document.getElementById('site-posts-error');
	var dialog = document.getElementById('site-post-dialog');
	if (!root || !dialog) return;

	var dlgImg = document.getElementById('site-post-dialog-img');
	var dlgTitle = document.getElementById('site-post-dialog-title');
	var dlgClose = document.getElementById('site-post-dialog-close');
	var lastFocus = null;

	function formatDate(iso) {
		if (!iso || typeof iso !== 'string') return '';
		var d = new Date(iso.trim());
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	}

	function descriptionToNodes(text) {
		var frag = document.createDocumentFragment();
		if (!text || typeof text !== 'string') return frag;
		var parts = text.split(/\n\s*\n/);
		parts.forEach(function (block) {
			var t = block.trim();
			if (!t) return;
			var p = document.createElement('p');
			p.textContent = t;
			frag.appendChild(p);
		});
		return frag;
	}

	function openLightbox(src, alt, postTitle) {
		lastFocus = document.activeElement;
		dlgImg.src = src;
		dlgImg.alt = alt || '';
		dlgTitle.textContent = postTitle || '';
		if (typeof dialog.showModal === 'function') dialog.showModal();
		dlgClose.focus();
	}

	function closeLightbox() {
		if (typeof dialog.close === 'function') dialog.close();
		dlgImg.removeAttribute('src');
		if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
	}

	dlgClose.addEventListener('click', closeLightbox);
	dialog.addEventListener('cancel', function (e) {
		e.preventDefault();
		closeLightbox();
	});
	dialog.addEventListener('click', function (e) {
		if (e.target === dialog) closeLightbox();
	});
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && dialog.open) closeLightbox();
	});

	function renderImages(images, layout, postTitle) {
		var list = Array.isArray(images) ? images : [];
		if (!list.length) return null;

		var wrap = document.createElement('div');
		wrap.className =
			layout === 'grid'
				? 'site-post-images site-post-images--grid'
				: layout === 'gallery'
					? 'site-post-images site-post-images--gallery'
					: 'site-post-images site-post-images--stack';

		list.forEach(function (im) {
			var src = (im && im.src) || '';
			if (!String(src).trim()) return;
			var alt = (im && im.alt) || '';

			if (layout === 'gallery') {
				var btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'site-post-gallery-tile';
				btn.setAttribute('aria-label', 'Enlarge: ' + (alt || postTitle || 'image'));
				var img = document.createElement('img');
				img.src = src;
				img.alt = alt;
				img.loading = 'lazy';
				btn.appendChild(img);
				btn.addEventListener('click', function () {
					openLightbox(src, alt, postTitle);
				});
				wrap.appendChild(btn);
			} else {
				var figure = document.createElement('figure');
				figure.className = 'site-post-figure';
				var img2 = document.createElement('img');
				img2.src = src;
				img2.alt = alt;
				img2.loading = 'lazy';
				figure.appendChild(img2);
				if (alt) {
					var cap = document.createElement('figcaption');
					cap.textContent = alt;
					figure.appendChild(cap);
				}
				wrap.appendChild(figure);
			}
		});

		return wrap.childNodes.length ? wrap : null;
	}

	function renderPost(post) {
		var article = document.createElement('article');
		article.className = 'site-post';
		article.id = post.id ? 'post-' + String(post.id).replace(/\s+/g, '-') : '';

		var header = document.createElement('header');
		header.className = 'site-post-header';
		var h2 = document.createElement('h2');
		h2.className = 'site-post-title';
		h2.textContent = post.title || 'Untitled';
		header.appendChild(h2);
		if (post.date) {
			var time = document.createElement('time');
			time.className = 'site-post-date';
			time.setAttribute('datetime', String(post.date).trim());
			time.textContent = formatDate(post.date);
			header.appendChild(time);
		}
		article.appendChild(header);

		var body = document.createElement('div');
		body.className = 'site-post-body';
		body.appendChild(descriptionToNodes(post.description || ''));
		article.appendChild(body);

		var layout =
			post.imageLayout === 'grid' || post.imageLayout === 'gallery'
				? post.imageLayout
				: 'stack';
		var media = renderImages(post.images, layout, post.title || '');
		if (media) article.appendChild(media);

		return article;
	}

	fetch('posts.json')
		.then(function (r) {
			if (!r.ok) throw new Error('missing');
			return r.json();
		})
		.then(function (data) {
			var posts = Array.isArray(data.posts) ? data.posts.slice() : [];
			posts.sort(function (a, b) {
				return String(b.date || '').localeCompare(String(a.date || ''));
			});

			posts.forEach(function (p) {
				root.appendChild(renderPost(p));
			});

			if (!posts.length && emptyEl) emptyEl.hidden = false;
			else if (emptyEl) emptyEl.hidden = true;
		})
		.catch(function () {
			if (errEl) errEl.hidden = false;
			if (emptyEl) emptyEl.hidden = true;
		});
})();
