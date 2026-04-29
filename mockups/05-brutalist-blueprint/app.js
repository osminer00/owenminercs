(function () {
	document.getElementById('show-grid').addEventListener('change', (e) => {
		document.body.classList.toggle('show-grid-overlay', e.target.checked);
	});
	document.getElementById('high-contrast').addEventListener('change', (e) => {
		document.body.classList.toggle('high-contrast', e.target.checked);
	});

	const seq = ['o', 'w', 'e', 'n'];
	let step = 0;
	const secret = document.getElementById('secret');

	window.addEventListener('keydown', (e) => {
		if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
		const k = e.key.toLowerCase();
		if (k === seq[step]) {
			step++;
			if (step === seq.length) {
				secret.hidden = false;
				step = 0;
			}
		} else {
			step = k === seq[0] ? 1 : 0;
		}
	});

	document.getElementById('close-secret').addEventListener('click', () => {
		secret.hidden = true;
	});
})();
