(function () {
	var toolbar = document.querySelector('.gaming-board-filters');
	if (!toolbar) return;

	var buttons = toolbar.querySelectorAll('.gaming-filter-btn[data-gaming-filter]');
	var redditScriptLoaded = false;

	function loadRedditWidgets() {
		if (redditScriptLoaded || document.querySelector('script[data-reddit-widgets]')) {
			redditScriptLoaded = true;
			return;
		}
		var s = document.createElement('script');
		s.async = true;
		s.src = 'https://embed.reddit.com/widgets.js';
		s.charset = 'UTF-8';
		s.setAttribute('data-reddit-widgets', '1');
		s.onload = function () {
			redditScriptLoaded = true;
		};
		document.body.appendChild(s);
	}

	function isRedditGroupVisible() {
		var group = document.querySelector('.gaming-card-group[data-gaming-group="reddit"]');
		return group && !group.classList.contains('is-hidden');
	}

	function syncGroup(filterKey, visible) {
		var group = document.querySelector('.gaming-card-group[data-gaming-group="' + filterKey + '"]');
		if (group) {
			group.classList.toggle('is-hidden', !visible);
		}
		if (filterKey === 'reddit' && visible) {
			loadRedditWidgets();
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

	if (isRedditGroupVisible()) {
		loadRedditWidgets();
	}
})();
