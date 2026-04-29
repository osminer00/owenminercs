(function () {
	var toggle = document.getElementById('nav-toggle');
	var drawer = document.getElementById('nav-drawer');
	var closeBtn = document.getElementById('nav-drawer-close');
	if (!toggle || !drawer) return;

	function openDrawer() {
		drawer.classList.add('is-open');
		drawer.setAttribute('aria-hidden', 'false');
		toggle.setAttribute('aria-expanded', 'true');
		document.body.style.overflow = 'hidden';
	}

	function closeDrawer() {
		drawer.classList.remove('is-open');
		drawer.setAttribute('aria-hidden', 'true');
		toggle.setAttribute('aria-expanded', 'false');
		document.body.style.overflow = '';
	}

	toggle.addEventListener('click', function () {
		if (drawer.classList.contains('is-open')) closeDrawer();
		else openDrawer();
	});

	if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

	drawer.addEventListener('click', function (e) {
		if (e.target === drawer) closeDrawer();
	});

	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
	});

	drawer.querySelectorAll('a.btn-sm').forEach(function (a) {
		a.addEventListener('click', closeDrawer);
	});
})();
