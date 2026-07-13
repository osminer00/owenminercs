/**
 * CS2 merch page — native <video controls> fallback when glass backdrop-filter
 * blocks UA control hit-testing (see liquid-glass-surfaces.css cs2-merch hub rule).
 */
(function () {
	if (!document.body.classList.contains('cs2-merch-page')) return;

	function bindNativePlayFallback(video) {
		if (!video || video.dataset.merchPlayFallback === '1') return;
		video.dataset.merchPlayFallback = '1';
		video.addEventListener('click', function () {
			window.setTimeout(function () {
				if (video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
					video.play().catch(function () {});
				}
			}, 0);
		});
	}

	document
		.querySelectorAll('.merch-video-grid video, .merch-section__video')
		.forEach(bindNativePlayFallback);
})();
