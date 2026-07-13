/**

 * Turntable spin viewer: drag delta maps to unbounded virtual rotation, then

 * wraps onto a monotonic loop clip (modulo duration). Portrait spin assets

 * should be all-keyframes for smooth fastSeek scrubbing.

 *

 * Nade plushie loop (source C0184.MP4 / nade-plushie-spin.full.mp4):

 * trimmed to 2.60s–10.21s, the longest single-direction spin before the

 * operator reverses (~frame 311 @ 29.97 fps). In/out frames match within

 * ~7.6s for a near-seamless 360° loop. Video mode.

 *

 * Knife case (source C0186.MP4 / knife-case-spin.full.mp4):

 * frame-sequence mode — ~149 sharpness-picked frames from longest single CW run

 * (f907–f1120, ~95°) plus 5 wrap-bridge crossfades (154 total). Frames are chosen

 * by highest Laplacian variance per angle bin to avoid motion blur. Build normalizes

 * center-crop LAB luminance to segment median before export. Viewer draws nearest

 * frame only (no canvas crossfade) to avoid brightness pulsing during slow drag.

 */

(function () {

	var roots = document.querySelectorAll('[data-spin-viewer]');



	if (!roots.length) return;



	var reduced =

		window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	var STEP_SEC = 0.35;



	function initSpinViewer(root) {

		if (root.hasAttribute('data-spin-frames')) {

			initFrameSpinViewer(root);

			return;

		}



		initVideoSpinViewer(root);

	}



	function initVideoSpinViewer(root) {

		var video = root.querySelector('video');



		if (!video) return;



		var dragging = false;

		var pointerId = null;

		var anchorX = 0;

		var anchorRotation = 0;

		var virtualRotation = 0;

		var duration = 0;

		var dragSpan = 1;

		var frameStep = 1 / 30;

		var targetTime = 0;

		var dragLoopActive = false;

		var lastSeekTime = -1;



		function refreshDuration() {

			if (!isFinite(video.duration) || video.duration <= 0) return;



			duration = video.duration;

			dragSpan = Math.max(root.clientWidth || 320, 240);



			var rate = Number(video.getAttribute('data-frame-rate'));

			if (rate > 0) frameStep = 1 / rate;



			root.setAttribute('aria-valuemin', '0');

			root.setAttribute('aria-valuemax', String(Math.round(duration * 1000)));

			updateAriaValue();

		}



		function wrapRotation(rotation) {

			if (!duration) return 0;



			var wrapped = rotation % duration;

			if (wrapped < 0) wrapped += duration;

			return wrapped;

		}



		function snapToFrame(seconds) {

			return Math.round(seconds / frameStep) * frameStep;

		}



		function rotationToTime(rotation) {

			return snapToFrame(wrapRotation(rotation));

		}



		function updateAriaValue() {

			root.setAttribute('aria-valuenow', String(Math.round(video.currentTime * 1000)));

		}



		function seekToTime(seconds) {

			if (!duration) return;



			var next = rotationToTime(seconds);



			if (Math.abs(lastSeekTime - next) < frameStep * 0.15) return;



			lastSeekTime = next;



			if (typeof video.fastSeek === 'function') {

				video.fastSeek(next);

			} else {

				video.currentTime = next;

			}



			updateAriaValue();

		}



		function dragLoop() {

			if (!dragging) {

				dragLoopActive = false;

				return;

			}



			seekToTime(targetTime);

			requestAnimationFrame(dragLoop);

		}



		function startDragLoop() {

			if (dragLoopActive || reduced) return;



			dragLoopActive = true;

			requestAnimationFrame(dragLoop);

		}



		function pixelsToSeconds(deltaX) {

			return (deltaX / dragSpan) * duration;

		}



		function onPointerDown(event) {

			if (event.button !== undefined && event.button !== 0) return;

			if (reduced) return;

			if (!duration) return;



			dragging = true;

			pointerId = event.pointerId;

			anchorX = event.clientX;

			anchorRotation = virtualRotation;

			targetTime = virtualRotation;

			lastSeekTime = -1;



			root.classList.add('is-dragging');

			root.setPointerCapture(pointerId);

			startDragLoop();

			event.preventDefault();

		}



		function onPointerMove(event) {

			if (!dragging || event.pointerId !== pointerId) return;



			virtualRotation = anchorRotation + pixelsToSeconds(event.clientX - anchorX);

			targetTime = virtualRotation;

			event.preventDefault();

		}



		function endDrag(event) {

			if (!dragging || (event && event.pointerId !== pointerId)) return;



			dragging = false;

			pointerId = null;

			seekToTime(virtualRotation);

			root.classList.remove('is-dragging');



			try {

				if (event) root.releasePointerCapture(event.pointerId);

			} catch (e) {

				/* ignore */

			}

		}



		function stepBy(delta) {

			if (!duration) return;



			virtualRotation += delta;

			targetTime = virtualRotation;

			seekToTime(virtualRotation);

		}



		function onKeyDown(event) {

			if (event.key === 'ArrowLeft') {

				event.preventDefault();

				stepBy(-STEP_SEC);

			} else if (event.key === 'ArrowRight') {

				event.preventDefault();

				stepBy(STEP_SEC);

			}

		}



		function onClick(event) {

			if (!reduced || !duration) return;



			var rect = root.getBoundingClientRect();

			var mid = rect.left + rect.width / 2;

			stepBy(event.clientX < mid ? -STEP_SEC : STEP_SEC);

		}



		root.classList.toggle('merch-spin-viewer--reduced', reduced);

		root.setAttribute('aria-valuemin', '0');

		root.setAttribute('aria-valuemax', '0');

		root.setAttribute('aria-valuenow', '0');



		video.pause();

		video.controls = false;

		video.setAttribute('tabindex', '-1');

		video.loop = false;



		video.addEventListener('loadedmetadata', refreshDuration);

		if (video.readyState >= 1) refreshDuration();



		root.addEventListener('pointerdown', onPointerDown);

		root.addEventListener('pointermove', onPointerMove);

		root.addEventListener('pointerup', endDrag);

		root.addEventListener('pointercancel', endDrag);

		root.addEventListener('lostpointercapture', endDrag);

		root.addEventListener('keydown', onKeyDown);

		root.addEventListener('click', onClick);



		window.addEventListener(

			'resize',

			function () {

				if (duration) dragSpan = Math.max(root.clientWidth || 320, 240);

			},

			{ passive: true }

		);

	}



	function initFrameSpinViewer(root) {

		var canvas = root.querySelector('canvas');

		var manifestUrl = root.getAttribute('data-spin-frames');



		if (!canvas || !manifestUrl) return;



		var ctx = canvas.getContext('2d');

		var frames = [];

		var frameCount = 0;

		var duration = 0;

		var dragSpan = 1;

		var frameStep = 1 / 30;

		var dragging = false;

		var pointerId = null;

		var anchorX = 0;

		var anchorRotation = 0;

		var virtualRotation = 0;

		var targetRotation = 0;

		var dragLoopActive = false;

		var ready = false;

		var manifestBase = manifestUrl.replace(/\/[^/]*$/, '/');

		var canvasLayoutW = 0;

		var canvasLayoutH = 0;

		var canvasDpr = 1;

		var offscreen = null;

		var offCtx = null;



		function wrapRotation(rotation) {

			if (!duration) return 0;



			var wrapped = rotation % duration;

			if (wrapped < 0) wrapped += duration;

			return wrapped;

		}



		function updateAriaValue() {

			root.setAttribute('aria-valuenow', String(Math.round(wrapRotation(virtualRotation) * 1000)));

		}



		function frameEntry(index) {

			if (!frameCount) return frames[index];

			var wrapped = index % frameCount;

			if (wrapped < 0) wrapped += frameCount;

			return frames[wrapped];

		}



		function frameDrawable(entry) {

			if (!entry) return null;

			if (entry.bitmap) return entry.bitmap;

			if (entry.img && entry.img.complete && entry.img.naturalWidth) return entry.img;

			return null;

		}



		function frameIsDecoded(entry) {

			return !!frameDrawable(entry);

		}



		function frameDimensions(entry) {

			if (!entry) return null;

			if (entry.bitmap) return { w: entry.bitmap.width, h: entry.bitmap.height };

			if (entry.img && entry.img.naturalWidth) return { w: entry.img.naturalWidth, h: entry.img.naturalHeight };

			return null;

		}



		function ensureCanvasSize() {

			var dpr = window.devicePixelRatio || 1;

			var w = root.clientWidth;

			var h = root.clientHeight;

			if (w <= 0 || h <= 0) return false;



			if (w !== canvasLayoutW || h !== canvasLayoutH || dpr !== canvasDpr) {

				canvasLayoutW = w;

				canvasLayoutH = h;

				canvasDpr = dpr;

				canvas.width = Math.round(w * dpr);

				canvas.height = Math.round(h * dpr);

				canvas.style.width = w + 'px';

				canvas.style.height = h + 'px';

				ctx.setTransform(1, 0, 0, 1, 0, 0);

				offscreen = null;

				offCtx = null;

			}



			return true;

		}



		function ensureOffscreen() {

			if (!ensureCanvasSize()) return false;



			if (!offscreen || offscreen.width !== canvas.width || offscreen.height !== canvas.height) {

				offscreen = document.createElement('canvas');

				offscreen.width = canvas.width;

				offscreen.height = canvas.height;

				offCtx = offscreen.getContext('2d');

				offCtx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);

				offCtx.imageSmoothingEnabled = true;

				if (offCtx.imageSmoothingQuality) offCtx.imageSmoothingQuality = 'high';

			}



			return true;

		}



		function blitOffscreen() {

			ctx.setTransform(1, 0, 0, 1, 0, 0);

			ctx.drawImage(offscreen, 0, 0);

		}



		function layoutDrawRect(dim) {

			var scale = Math.min(canvasLayoutW / dim.w, canvasLayoutH / dim.h);

			var dw = dim.w * scale;

			var dh = dim.h * scale;

			return {

				dx: (canvasLayoutW - dw) / 2,

				dy: (canvasLayoutH - dh) / 2,

				dw: dw,

				dh: dh,

			};

		}



		function drawSingleFrame(index) {

			var entry = frameEntry(index);

			var drawable = frameDrawable(entry);

			var dim = frameDimensions(entry);

			if (!drawable || !dim) return;

			if (!ensureOffscreen()) return;



			var rect = layoutDrawRect(dim);

			offCtx.globalAlpha = 1;

			offCtx.fillStyle = '#000';

			offCtx.fillRect(0, 0, canvasLayoutW, canvasLayoutH);

			offCtx.drawImage(drawable, rect.dx, rect.dy, rect.dw, rect.dh);

			blitOffscreen();

		}



		function drawForRotation(rotation) {

			if (!frameCount) return;



			var wrapped = wrapRotation(rotation);

			var exact = wrapped / frameStep;

			var index = Math.round(exact) % frameCount;

			if (index < 0) index += frameCount;



			if (!frameIsDecoded(frameEntry(index))) return;



			drawSingleFrame(index);



			updateAriaValue();

		}



		function seekToRotation(rotation) {

			drawForRotation(rotation);

		}



		function dragLoop() {

			if (!dragging) {

				dragLoopActive = false;

				return;

			}



			seekToRotation(targetRotation);

			requestAnimationFrame(dragLoop);

		}



		function startDragLoop() {

			if (dragLoopActive || reduced) return;



			dragLoopActive = true;

			requestAnimationFrame(dragLoop);

		}



		function pixelsToSeconds(deltaX) {

			return (deltaX / dragSpan) * duration;

		}



		function onPointerDown(event) {

			if (event.button !== undefined && event.button !== 0) return;

			if (reduced) return;

			if (!ready) return;



			dragging = true;

			pointerId = event.pointerId;

			anchorX = event.clientX;

			anchorRotation = virtualRotation;

			targetRotation = virtualRotation;



			root.classList.add('is-dragging');

			root.setPointerCapture(pointerId);

			startDragLoop();

			event.preventDefault();

		}



		function onPointerMove(event) {

			if (!dragging || event.pointerId !== pointerId) return;



			virtualRotation = anchorRotation + pixelsToSeconds(event.clientX - anchorX);

			targetRotation = virtualRotation;

			event.preventDefault();

		}



		function endDrag(event) {

			if (!dragging || (event && event.pointerId !== pointerId)) return;



			dragging = false;

			pointerId = null;

			seekToRotation(virtualRotation);

			root.classList.remove('is-dragging');



			try {

				if (event) root.releasePointerCapture(event.pointerId);

			} catch (e) {

				/* ignore */

			}

		}



		function stepBy(delta) {

			if (!ready) return;



			virtualRotation += delta;

			targetRotation = virtualRotation;

			seekToRotation(virtualRotation);

		}



		function onKeyDown(event) {

			if (event.key === 'ArrowLeft') {

				event.preventDefault();

				stepBy(-STEP_SEC);

			} else if (event.key === 'ArrowRight') {

				event.preventDefault();

				stepBy(STEP_SEC);

			}

		}



		function onClick(event) {

			if (!reduced || !ready) return;



			var rect = root.getBoundingClientRect();

			var mid = rect.left + rect.width / 2;

			stepBy(event.clientX < mid ? -STEP_SEC : STEP_SEC);

		}



		function frameUrl(index) {

			var padded = String(index).padStart(3, '0');

			return manifestBase + 'frame-' + padded + '.webp';

		}



		function loadFrame(index) {

			return new Promise(function (resolve, reject) {

				var img = new Image();

				img.decoding = 'async';



				img.onload = function () {

					var store = function (bitmap) {

						frames[index - 1] = { img: img, bitmap: bitmap || null };

						resolve();

					};



					var afterDecode = function () {

						if (typeof createImageBitmap === 'function') {

							createImageBitmap(img)

								.then(function (bitmap) {

									store(bitmap);

								})

								.catch(function () {

									store(null);

								});

						} else {

							store(null);

						}

					};



					if (img.decode) {

						img.decode().then(afterDecode).catch(afterDecode);

					} else {

						afterDecode();

					}

				};



				img.onerror = function () {

					reject(new Error('Failed to load frame ' + index));

				};



				img.src = frameUrl(index);

			});

		}



		function preloadFrames(count) {

			var first = loadFrame(1).then(function () {

				drawForRotation(0);

			});



			var rest = [];

			for (var i = 2; i <= count; i++) {

				rest.push(loadFrame(i));

			}



			return first.then(function () {

				return Promise.all(rest);

			});

		}



		function finishInit(manifest) {

			frameCount = manifest.frameCount;

			frameStep = 1 / (manifest.frameRate || 30);

			duration = frameCount * frameStep;

			dragSpan = Math.max(root.clientWidth || 320, 240);

			ready = true;



			root.dataset.spinReady = '1';

			root.classList.remove('merch-spin-viewer--loading');

			root.setAttribute('aria-valuemin', '0');

			root.setAttribute('aria-valuemax', String(Math.round(duration * 1000)));

			drawForRotation(0);

		}



		root.classList.toggle('merch-spin-viewer--reduced', reduced);

		root.classList.add('merch-spin-viewer--loading');

		root.setAttribute('aria-valuemin', '0');

		root.setAttribute('aria-valuemax', '0');

		root.setAttribute('aria-valuenow', '0');



		root.addEventListener('pointerdown', onPointerDown);

		root.addEventListener('pointermove', onPointerMove);

		root.addEventListener('pointerup', endDrag);

		root.addEventListener('pointercancel', endDrag);

		root.addEventListener('lostpointercapture', endDrag);

		root.addEventListener('keydown', onKeyDown);

		root.addEventListener('click', onClick);



		window.addEventListener(

			'resize',

			function () {

				if (ready) {

					dragSpan = Math.max(root.clientWidth || 320, 240);

					drawForRotation(virtualRotation);

				}

			},

			{ passive: true }

		);



		fetch(manifestUrl)

			.then(function (response) {

				if (!response.ok) throw new Error('manifest fetch failed');

				return response.json();

			})

			.then(function (manifest) {

				frameCount = manifest.frameCount;

				frameStep = 1 / (manifest.frameRate || 30);

				duration = frameCount * frameStep;

				dragSpan = Math.max(root.clientWidth || 320, 240);

				return preloadFrames(manifest.frameCount).then(function () {

					return manifest;

				});

			})

			.then(finishInit)

			.catch(function () {

				root.classList.add('merch-spin-viewer--error');

			});

	}



	for (var i = 0; i < roots.length; i++) {

		initSpinViewer(roots[i]);

	}

})();

