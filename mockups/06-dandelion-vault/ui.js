(function () {
	'use strict';

	var quotes = [
		'Thanks for stopping by — tune the breeze and glow until the field feels right.',
		'CS2 content creator & software developer — Iowa.',
		'Same drawer as the standalone dandelion page: presets, speed, placement, chaos.',
		'Drop dandylion.mp4 next to this HTML for the full composite, or use ?novideo=1.',
	];
	var i = 0;
	var el = document.getElementById('rotating-quote');
	var btn = document.getElementById('spin-quote');

	function show() {
		if (!el) return;
		el.textContent = quotes[i % quotes.length];
		i += 1;
	}

	show();
	if (btn) {
		btn.addEventListener('click', show);
	}
})();
