(function () {
	var mount = document.querySelector('[data-setup-vs]');
	if (!mount) return;

	function parseSpecs(raw) {
		var specs = {};
		if (!raw) return specs;
		raw.split('|').forEach(function (entry) {
			var parts = entry.split(':');
			if (parts.length < 2) return;
			var key = parts.shift().trim();
			var value = parts.join(':').trim();
			if (!key || !value) return;
			specs[key] = value;
		});
		return specs;
	}

	function getNumericValue(text) {
		if (!text) return null;
		var match = text.match(/-?\d+(\.\d+)?/);
		return match ? Number(match[0]) : null;
	}

	function normalizeLabel(label) {
		if (!label) return '';
		return label
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ' ')
			.trim();
	}

	function getPrimaryLabel(rawLabel) {
		if (!rawLabel) return '';
		if (rawLabel.indexOf('—') !== -1) {
			return rawLabel.split('—').pop().trim();
		}
		return rawLabel.trim();
	}

	function collectItems() {
		return Array.prototype.slice
			.call(document.querySelectorAll('.keep-card[data-compare-group]'))
			.map(function (card) {
				var labelEl = card.querySelector('.keep-card__label');
				var thumbEl = card.querySelector('.keep-card__thumb');
				var rawLabel = labelEl ? labelEl.textContent.trim() : '';
				var fallbackOpinionEl = card.querySelector('.keep-card__peek p');
				return {
					group: card.getAttribute('data-compare-group'),
					groupLabel: card.getAttribute('data-compare-group-label') || '',
					name:
						card.getAttribute('data-compare-name') ||
						getPrimaryLabel(rawLabel) ||
						'Setup item',
					href: card.getAttribute('data-href') || '',
					thumbSrc:
						thumbEl && thumbEl.getAttribute('src') ? thumbEl.getAttribute('src') : '',
					thumbAlt:
						thumbEl && thumbEl.getAttribute('alt') ? thumbEl.getAttribute('alt') : '',
					specs: parseSpecs(card.getAttribute('data-compare-specs') || ''),
					opinion:
						card.getAttribute('data-compare-opinion') ||
						(fallbackOpinionEl ? fallbackOpinionEl.textContent.trim() : ''),
				};
			})
			.filter(function (item) {
				return item.group;
			});
	}

	function escapeHtml(text) {
		return String(text || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function getSpecComparisons(a, b) {
		var entries = [];
		Object.keys(a.specs).forEach(function (keyA) {
			var normalizedA = normalizeLabel(keyA);
			var matchKeyB = Object.keys(b.specs).find(function (keyB) {
				return normalizeLabel(keyB) === normalizedA;
			});
			if (!matchKeyB) return;
			var valueA = a.specs[keyA];
			var valueB = b.specs[matchKeyB];
			if (!valueA || !valueB || valueA === valueB) return;
			entries.push({
				label: keyA,
				a: valueA,
				b: valueB,
			});
		});
		return entries;
	}

	function getHeadlineFromSpecs(specs) {
		if (!specs.length) return '';
		var preferred = ['refresh rate', 'resolution', 'weight', 'size', 'dpi'];
		for (var i = 0; i < preferred.length; i++) {
			var found = specs.find(function (entry) {
				return normalizeLabel(entry.label) === preferred[i];
			});
			if (found) return found;
		}
		return specs[0];
	}

	function chooseLead(spec) {
		if (!spec) return null;
		var numA = getNumericValue(spec.a);
		var numB = getNumericValue(spec.b);
		if (numA == null || numB == null || numA === numB) return null;
		var lowerIsBetter = ['weight', 'response time', 'latency', 'price', 'noise'];
		var normalized = normalizeLabel(spec.label);
		var shouldPreferLower = lowerIsBetter.indexOf(normalized) !== -1;
		if (shouldPreferLower) {
			return numA < numB ? 'a' : 'b';
		}
		return numA > numB ? 'a' : 'b';
	}

	function getIntentFromSpecLabel(label) {
		var normalized = normalizeLabel(label);
		if (normalized === 'refresh rate' || normalized === 'response time') {
			return 'competitive gaming';
		}
		if (normalized === 'resolution' || normalized === 'size') {
			return 'workspace clarity';
		}
		if (normalized === 'weight') {
			return 'lightweight feel';
		}
		if (normalized === 'price') {
			return 'value';
		}
		return 'your priorities';
	}

	function createSummary(a, b) {
		var diffSpecs = getSpecComparisons(a, b);
		var keySpec = getHeadlineFromSpecs(diffSpecs);
		var lead = chooseLead(keySpec);

		var summary = '';
		if (keySpec) {
			var intent = getIntentFromSpecLabel(keySpec.label);
			if (lead === 'a') {
				summary =
					'For ' +
					intent +
					', I would lean ' +
					a.name +
					' (' +
					keySpec.label.toLowerCase() +
					' ' +
					keySpec.a +
					' vs ' +
					keySpec.b +
					').';
			} else if (lead === 'b') {
				summary =
					'For ' +
					intent +
					', I would lean ' +
					b.name +
					' (' +
					keySpec.label.toLowerCase() +
					' ' +
					keySpec.b +
					' vs ' +
					keySpec.a +
					').';
			} else {
				summary =
					'Main difference here is ' +
					keySpec.label +
					': ' +
					keySpec.a +
					' vs ' +
					keySpec.b +
					'.';
			}
		} else {
			summary =
				'These are different tools for different jobs, so choose based on your workflow and camera/audio/desk goals.';
		}

		var opinions = [];
		if (a.opinion) opinions.push(a.name + ': ' + a.opinion);
		if (b.opinion) opinions.push(b.name + ': ' + b.opinion);

		return {
			summary: summary,
			specs: diffSpecs.slice(0, 3),
			opinions: opinions.slice(0, 2),
		};
	}

	function renderComparisons(items) {
		var byGroup = {};
		items.forEach(function (item) {
			if (!byGroup[item.group]) byGroup[item.group] = [];
			byGroup[item.group].push(item);
		});

		var allCards = [];
		Object.keys(byGroup).forEach(function (group) {
			var groupItems = byGroup[group];
			if (groupItems.length < 2) return;
			for (var i = 0; i < groupItems.length; i++) {
				for (var j = i + 1; j < groupItems.length; j++) {
					allCards.push({
						group: group,
						groupLabel: groupItems[i].groupLabel || groupItems[j].groupLabel || group,
						thisItem: groupItems[i],
						thatItem: groupItems[j],
					});
				}
			}
		});

		if (!allCards.length) return false;

		allCards.sort(function (left, right) {
			function score(pair) {
				var overlap = getSpecComparisons(pair.thisItem, pair.thatItem).length;
				var opinions = (pair.thisItem.opinion ? 1 : 0) + (pair.thatItem.opinion ? 1 : 0);
				return overlap * 2 + opinions;
			}
			return score(right) - score(left);
		});

		var grid = mount.querySelector('[data-setup-vs-grid]');
		if (!grid) return false;

		var fragment = document.createDocumentFragment();
		allCards.slice(0, 6).forEach(function (pair) {
			var details = createSummary(pair.thisItem, pair.thatItem);
			var article = document.createElement('article');
			article.className = 'setup-vs-card';

			var specMarkup = details.specs
				.map(function (spec) {
					return (
						'<li><strong>' +
						escapeHtml(spec.label) +
						':</strong> ' +
						escapeHtml(pair.thisItem.name) +
						' ' +
						escapeHtml(spec.a) +
						' vs ' +
						escapeHtml(pair.thatItem.name) +
						' ' +
						escapeHtml(spec.b) +
						'</li>'
					);
				})
				.join('');

			var opinionsMarkup = details.opinions
				.map(function (opinion) {
					return '<li>' + escapeHtml(opinion) + '</li>';
				})
				.join('');

			article.innerHTML =
				'<span class="setup-vs-card__group">' +
				escapeHtml(pair.groupLabel) +
				'</span>' +
				'<h3 class="setup-vs-card__title">' +
				escapeHtml(pair.thisItem.name) +
				' vs ' +
				escapeHtml(pair.thatItem.name) +
				'</h3>' +
				'<p class="setup-vs-card__summary">' +
				escapeHtml(details.summary) +
				'</p>' +
				(specMarkup ? '<ul class="setup-vs-card__list">' + specMarkup + '</ul>' : '') +
				(opinionsMarkup
					? '<ul class="setup-vs-card__opinions">' + opinionsMarkup + '</ul>'
					: '') +
				'<div class="setup-vs-card__links">' +
				'<a href="' +
				escapeHtml(pair.thisItem.href) +
				'">View ' +
				escapeHtml(pair.thisItem.name) +
				'</a>' +
				'<a href="' +
				escapeHtml(pair.thatItem.href) +
				'">View ' +
				escapeHtml(pair.thatItem.name) +
				'</a>' +
				'</div>';

			fragment.appendChild(article);
		});

		grid.appendChild(fragment);
		return true;
	}

	var items = collectItems();
	if (!items.length) return;
	if (renderComparisons(items)) {
		mount.hidden = false;
	}
})();
