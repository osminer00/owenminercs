(function () {
	function isHttpUrl(s) {
		return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
	}
	function apply(data) {
		if (!data) return;
		if (isHttpUrl(data.ko_fi)) {
			var url = data.ko_fi.trim();
			document.querySelectorAll('a[data-kofi-link]').forEach(function (a) {
				a.setAttribute('href', url);
			});
		}
		if (isHttpUrl(data.streamelements_tip)) {
			var tipUrl = data.streamelements_tip.trim();
			document.querySelectorAll('a[data-streamelements-tip-link]').forEach(function (a) {
				a.setAttribute('href', tipUrl);
			});
		}
		if (isHttpUrl(data.steam_trade_offer)) {
			var steamUrl = data.steam_trade_offer.trim();
			document.querySelectorAll('a[data-steam-trade-link]').forEach(function (a) {
				a.setAttribute('href', steamUrl);
			});
		}
	}
	var path = '/donation-links.json';
	fetch(path, { credentials: 'same-origin' })
		.then(function (r) {
			return r.ok ? r.json() : null;
		})
		.then(function (data) {
			if (data) apply(data);
		})
		.catch(function () {});
})();
