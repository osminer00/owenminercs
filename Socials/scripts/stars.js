/** @deprecated Loaded globally via `scripts/components.js` → `scripts/starfield-bg.js`. */
(function () {
	const scriptUrl = document.querySelector('script[src*="stars.js"]')?.src || '';
	const siteRoot = scriptUrl.replace(/Socials\/scripts\/stars\.js.*$/, '');
	if (!siteRoot || document.querySelector('script[data-owen-starfield-bg]')) return;
	const s = document.createElement('script');
	s.src = `${siteRoot}scripts/starfield-bg.js`;
	s.defer = true;
	s.setAttribute('data-owen-starfield-bg', '1');
	document.body.appendChild(s);
})();
