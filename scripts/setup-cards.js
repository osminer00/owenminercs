(function () {

	var HUB_CARD_LINK_SEL =

		'.keep-board--hub .keep-card__affiliate a, body.gaming-hub-page .hub-content-panel > .keep-board .keep-card__affiliate a';

	var HUB_LINK_VISIT_KEY = 'owenHubCardLinkVisit:';



	function hubLinkStorageKey(link) {

		return HUB_LINK_VISIT_KEY + location.pathname + ':' + link.href;

	}



	function parseRgb(color) {

		var match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);

		if (!match) return null;

		return [Number(match[1]), Number(match[2]), Number(match[3])];

	}



	function linkLooksVisitedPurple(link) {

		var rgb = parseRgb(getComputedStyle(link).color);

		if (!rgb) return false;

		return rgb[0] > 150 && rgb[1] < 130 && rgb[2] > 150;

	}



	function applyHubLinkVisitState(link) {

		var stored = null;

		try {

			stored = localStorage.getItem(hubLinkStorageKey(link));

		} catch (_) {}



		link.classList.remove('keep-card__link--marked-visited', 'keep-card__link--marked-unvisited');

		if (stored === 'visited') {

			link.classList.add('keep-card__link--marked-visited');

		} else if (stored === 'unvisited') {

			link.classList.add('keep-card__link--marked-unvisited');

		}

	}



	function toggleHubLinkVisit(link) {

		var key = hubLinkStorageKey(link);

		var stored = null;

		try {

			stored = localStorage.getItem(key);

		} catch (_) {}



		var next;

		if (stored === 'visited') {

			next = 'unvisited';

		} else if (stored === 'unvisited') {

			next = 'visited';

		} else {

			next = linkLooksVisitedPurple(link) ? 'unvisited' : 'visited';

		}



		try {

			localStorage.setItem(key, next);

		} catch (_) {}



		applyHubLinkVisitState(link);

	}



	function initHubCardLinkVisitToggle() {

		document.querySelectorAll(HUB_CARD_LINK_SEL).forEach(applyHubLinkVisitState);



		if (document.documentElement.dataset.hubCardLinkVisitBound === '1') return;

		document.documentElement.dataset.hubCardLinkVisitBound = '1';



		document.addEventListener(

			'click',

			function (e) {

				if (!e.altKey || e.button !== 0) return;

				var link = e.target.closest(HUB_CARD_LINK_SEL);

				if (!link) return;

				e.preventDefault();

				e.stopPropagation();

				toggleHubLinkVisit(link);

			},

			true

		);

	}



	if (document.readyState === 'loading') {

		document.addEventListener('DOMContentLoaded', initHubCardLinkVisitToggle);

	} else {

		initHubCardLinkVisitToggle();

	}

})();


