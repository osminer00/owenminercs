(function () {
	var toolbar = document.querySelector('.gaming-board-filters');
	if (!toolbar) return;

	var buttons = toolbar.querySelectorAll('.gaming-filter-btn[data-gaming-filter]');

	function syncGroup(filterKey, visible) {
		var group = document.querySelector('.gaming-card-group[data-gaming-group="' + filterKey + '"]');
		if (group) {
			group.classList.toggle('is-hidden', !visible);
		}
	}

	buttons.forEach(function (btn) {
		var key = btn.getAttribute('data-gaming-filter');
		var pressed = btn.getAttribute('aria-pressed') !== 'false';
		syncGroup(key, pressed);

		btn.addEventListener('click', function () {
			var next = btn.getAttribute('aria-pressed') !== 'true';
			btn.setAttribute('aria-pressed', next ? 'true' : 'false');
			syncGroup(key, next);
		});
	});
})();
