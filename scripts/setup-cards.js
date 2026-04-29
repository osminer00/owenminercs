(function () {
	document.querySelectorAll('.keep-card[data-href]').forEach(function (card) {
		var href = card.getAttribute('data-href');
		if (!href) return;

		card.addEventListener('click', function (e) {
			if (e.target.closest('a')) return;
			window.location.href = href;
		});

		card.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' || e.key === ' ') {
				if (e.target.closest && e.target.closest('a')) return;
				e.preventDefault();
				window.location.href = href;
			}
		});
	});
})();
