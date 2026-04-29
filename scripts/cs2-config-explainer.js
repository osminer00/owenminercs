(() => {
	const KNOWN_COMMANDS = {
		sensitivity: {
			description: 'Sets your mouse sensitivity.',
			check: numericRangeCheck(
				0.4,
				3.0,
				'Common range is about 0.4 to 3.0 for most players.'
			),
		},
		zoom_sensitivity_ratio: {
			description: 'Adjusts scoped sensitivity relative to your base sensitivity.',
			check: numericRangeCheck(
				0.5,
				1.5,
				'Most players keep this near 1.0 (usually 0.5 to 1.5).'
			),
		},
		fps_max: {
			description: 'Caps your maximum in-game FPS.',
			check: numericRangeCheck(
				120,
				1000,
				'Very low or very high FPS caps can feel odd. Typical range is 120 to 1000.'
			),
		},
		rate: {
			description: 'Sets max network bandwidth usage for server traffic.',
			check: numericRangeCheck(
				128000,
				1000000,
				'Unusual rate value. Common modern values are 196608 or higher.'
			),
		},
		cl_updaterate: {
			description: 'How often per second your client requests updates from server.',
			check: numericRangeCheck(32, 128, 'Most players use 64 or 128 here.'),
		},
		cl_cmdrate: {
			description: 'How often per second your client sends commands to server.',
			check: numericRangeCheck(32, 128, 'Most players use 64 or 128 here.'),
		},
		cl_radar_scale: {
			description: 'Changes radar zoom level.',
			check: numericRangeCheck(0.2, 1.0, 'Radar scale outside 0.2 to 1.0 is unusual.'),
		},
		cl_hud_radar_scale: {
			description: 'Changes size of the radar on your HUD.',
			check: numericRangeCheck(0.6, 1.3, 'HUD radar scale is usually around 0.8 to 1.3.'),
		},
		cl_crosshairsize: {
			description: 'Sets crosshair size.',
			check: numericRangeCheck(0.5, 10.0, 'Crosshair size outside 0.5 to 10.0 is uncommon.'),
		},
		cl_crosshairthickness: {
			description: 'Sets crosshair line thickness.',
			check: numericRangeCheck(
				0.1,
				3.0,
				'Crosshair thickness outside 0.1 to 3.0 is uncommon.'
			),
		},
		cl_crosshairgap: {
			description: 'Sets gap in the middle of the crosshair.',
			check: numericRangeCheck(-8.0, 8.0, 'Crosshair gap outside -8 to 8 is uncommon.'),
		},
		viewmodel_fov: {
			description: 'Changes weapon model field of view.',
			check: numericRangeCheck(54, 68, 'CS2 viewmodel_fov is usually between 54 and 68.'),
		},
		viewmodel_offset_x: {
			description: 'Moves weapon model left/right.',
			check: numericRangeCheck(-2.5, 2.5, 'Offset X outside -2.5 to 2.5 is unusual.'),
		},
		viewmodel_offset_y: {
			description: 'Moves weapon model forward/back.',
			check: numericRangeCheck(-2.0, 2.0, 'Offset Y outside -2 to 2 is unusual.'),
		},
		viewmodel_offset_z: {
			description: 'Moves weapon model up/down.',
			check: numericRangeCheck(-2.0, 2.0, 'Offset Z outside -2 to 2 is unusual.'),
		},
		volume: {
			description: 'Sets overall game volume.',
			check: numericRangeCheck(0, 1, 'Volume is usually kept between 0 and 1.'),
		},
		snd_headphone_eq: {
			description: 'Switches headphone EQ profile in CS2.',
			check: enumCheck(['0', '1', '2'], 'Expected 0, 1, or 2.'),
		},
		snd_voipvolume: {
			description: 'Adjusts voice chat volume.',
			check: numericRangeCheck(0, 1, 'VOIP volume is usually between 0 and 1.'),
		},
		m_rawinput: {
			description: 'Uses raw mouse input.',
			check: boolCheck(),
		},
		m_yaw: {
			description: 'Horizontal mouse scale factor (rarely changed).',
			check: numericRangeCheck(
				0.01,
				0.05,
				'Default is 0.022. Large changes can break your feel.'
			),
		},
		m_pitch: {
			description: 'Vertical mouse scale factor (rarely changed).',
			check: numericRangeCheck(
				0.01,
				0.05,
				'Default is 0.022. Large changes can break your feel.'
			),
		},
		exec: {
			description: 'Runs another config file.',
		},
		bind: {
			description: 'Binds a key to a command or action.',
		},
		unbind: {
			description: 'Removes bind from a specific key.',
		},
		unbindall: {
			description: 'Removes every key bind.',
			check: () => 'This clears all key binds. Make sure you rebind movement and buy keys.',
		},
		alias: {
			description: 'Creates a custom command shortcut.',
		},
		echo: {
			description: 'Prints text to the console.',
		},
		developer: {
			description: 'Enables extra developer console output.',
			check: boolCheck(),
		},
		sv_cheats: {
			description: 'Enables cheat commands in supported environments.',
			check: (value) =>
				value === '1'
					? 'This enables cheats and will not work in normal VAC secured matchmaking.'
					: '',
		},
		cl_interp: {
			description: 'Legacy interpolation command from older Counter-Strike versions.',
			check: () =>
				'This command is legacy/limited in CS2 and may not behave like it did in CS:GO.',
		},
		cl_interp_ratio: {
			description: 'Legacy interpolation ratio command from older Counter-Strike versions.',
			check: () =>
				'This command is legacy/limited in CS2 and may not behave like it did in CS:GO.',
		},
	};

	const STATUS_CLASS = {
		info: 'cs2-config-item--info',
		warn: 'cs2-config-item--warn',
	};

	function numericRangeCheck(min, max, warningText) {
		return (value) => {
			const parsed = Number(value);
			if (!Number.isFinite(parsed)) {
				return 'Expected a numeric value.';
			}
			if (parsed < min || parsed > max) {
				return warningText;
			}
			return '';
		};
	}

	function boolCheck() {
		return enumCheck(['0', '1'], 'Expected 0 or 1.');
	}

	function enumCheck(allowedValues, warningText) {
		const allowed = new Set(allowedValues);
		return (value) => (allowed.has(String(value)) ? '' : warningText);
	}

	function stripComment(line) {
		const slashCommentAt = line.indexOf('//');
		if (slashCommentAt === -1) {
			return line;
		}
		return line.slice(0, slashCommentAt);
	}

	function tokenize(line) {
		return line.match(/"[^"]*"|\S+/g) || [];
	}

	function cleanToken(token) {
		return token.replace(/^"(.*)"$/, '$1');
	}

	function analyzeLine(rawLine, lineNumber) {
		const noComment = stripComment(rawLine).trim();
		if (!noComment) {
			return null;
		}

		const tokens = tokenize(noComment);
		if (!tokens.length) {
			return null;
		}

		const command = cleanToken(tokens[0]).toLowerCase();
		const argTokens = tokens.slice(1).map(cleanToken);
		const value = argTokens.join(' ').trim();

		const rule = KNOWN_COMMANDS[command];
		const item = {
			lineNumber,
			rawLine: noComment,
			command,
			value,
			explanation: rule
				? rule.description
				: 'Custom or less common command. Check Valve docs or test manually.',
			warning: '',
		};

		if (!rule) {
			return item;
		}

		if (typeof rule.check === 'function') {
			item.warning = rule.check(value, argTokens, noComment) || '';
		}

		return item;
	}

	function createResultRow(result) {
		const li = document.createElement('li');
		li.className = `cs2-config-item ${result.warning ? STATUS_CLASS.warn : STATUS_CLASS.info}`;

		const heading = document.createElement('p');
		heading.className = 'cs2-config-item__heading';
		heading.textContent = `Line ${result.lineNumber}: ${result.command}`;

		const raw = document.createElement('code');
		raw.className = 'cs2-config-item__raw';
		raw.textContent = result.rawLine;

		const explanation = document.createElement('p');
		explanation.className = 'cs2-config-item__explanation';
		explanation.textContent = result.explanation;

		li.append(heading, raw, explanation);

		if (result.warning) {
			const warning = document.createElement('p');
			warning.className = 'cs2-config-item__warning';
			warning.textContent = `Flag: ${result.warning}`;
			li.appendChild(warning);
		}

		return li;
	}

	function init() {
		const input = document.getElementById('cs2-config-input');
		const analyzeBtn = document.getElementById('cs2-config-analyze');
		const clearBtn = document.getElementById('cs2-config-clear');
		const summary = document.getElementById('cs2-config-summary');
		const resultsList = document.getElementById('cs2-config-results');

		if (!input || !analyzeBtn || !clearBtn || !summary || !resultsList) {
			return;
		}

		function renderResults() {
			const lines = input.value.split(/\r?\n/);
			const analyzed = [];

			lines.forEach((line, index) => {
				const parsed = analyzeLine(line, index + 1);
				if (parsed) {
					analyzed.push(parsed);
				}
			});

			resultsList.innerHTML = '';

			if (!analyzed.length) {
				summary.textContent = 'Paste at least one config command to analyze.';
				return;
			}

			const warnings = analyzed.filter((entry) => entry.warning).length;
			summary.textContent = `Explained ${analyzed.length} command${analyzed.length === 1 ? '' : 's'} with ${warnings} flag${warnings === 1 ? '' : 's'}.`;

			analyzed.forEach((entry) => {
				resultsList.appendChild(createResultRow(entry));
			});
		}

		function clearAll() {
			input.value = '';
			summary.textContent = '';
			resultsList.innerHTML = '';
			input.focus();
		}

		analyzeBtn.addEventListener('click', renderResults);
		clearBtn.addEventListener('click', clearAll);
	}

	document.addEventListener('DOMContentLoaded', init);
})();
