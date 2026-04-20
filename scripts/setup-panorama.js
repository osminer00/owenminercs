(function () {
  var root = document.querySelector('[data-setup-panorama]');
  if (!root) return;
  var img = root.querySelector('img');
  if (!img) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  img.setAttribute('draggable', 'false');
  function preventNativeDrag(e) {
    e.preventDefault();
  }
  img.addEventListener('dragstart', preventNativeDrag);
  root.addEventListener('dragstart', preventNativeDrag);
  root.addEventListener(
    'mousedown',
    function (e) {
      if (e.button === 0) e.preventDefault();
    },
    true
  );

  var DRAG_SENSITIVITY = 4.25;
  var AUTO_PAN_PERIOD_MS = 15000;
  var autoPanActive = true;
  var animStart = performance.now();
  var rafId = null;

  var zoom = 1;
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 2.75;

  var panX = 0;
  var panY = 0.5;
  var lastX = 0;
  var lastY = 0;
  var dragging = false;

  function clamp(t, lo, hi) {
    return Math.max(lo, Math.min(hi, t));
  }

  function txTyFromPan(rw, rh, iw, ih, z) {
    var effW = iw * z;
    var effH = ih * z;
    var rangeX = rw - effW;
    var rangeY = rh - effH;
    var tx;
    var ty;
    if (rangeX >= 0) {
      tx = rangeX / 2;
    } else {
      tx = panX * rangeX;
    }
    if (rangeY >= 0) {
      ty = rangeY / 2;
    } else {
      ty = panY * rangeY;
    }
    return { tx: tx, ty: ty, rangeX: rangeX, rangeY: rangeY, effW: effW, effH: effH };
  }

  function panFromTxTy(tx, ty, rangeX, rangeY) {
    if (rangeX >= 0) {
      panX = 0.5;
    } else {
      panX = clamp(tx / rangeX, 0, 1);
    }
    if (rangeY >= 0) {
      panY = 0.5;
    } else {
      panY = clamp(ty / rangeY, 0, 1);
    }
  }

  function applyPan() {
    var rw = root.clientWidth;
    var rh = root.clientHeight;
    var iw = img.offsetWidth;
    var ih = img.offsetHeight;
    if (rw <= 0 || rh <= 0 || iw <= 0 || ih <= 0) {
      return;
    }

    var o = txTyFromPan(rw, rh, iw, ih, zoom);
    img.style.transformOrigin = '0 0';
    /* Same as x' = zoom*x + tx (focal math in onWheel); avoids translate/scale order quirks */
    img.style.transform =
      'matrix(' + zoom + ',0,0,' + zoom + ',' + o.tx + ',' + o.ty + ')';
  }

  function triangleWave(phase) {
    phase -= Math.floor(phase);
    if (phase < 0.5) return phase * 2;
    return 2 - phase * 2;
  }

  function stopAutoPan() {
    if (!autoPanActive) return;
    autoPanActive = false;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function tick(now) {
    if (!autoPanActive) {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
    if (document.hidden) return;

    var phase = ((now - animStart) / AUTO_PAN_PERIOD_MS) % 1;
    panX = triangleWave(phase);
    panY = 0.5;
    applyPan();
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stopAutoPan();
    e.preventDefault();
    dragging = true;
    root.classList.add('setup-panorama--dragging');
    lastX = e.clientX;
    lastY = e.clientY;
    try {
      root.setPointerCapture(e.pointerId);
    } catch (err) {}
  }

  function onPointerMove(e) {
    if (!dragging) return;
    var rect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    panX -= (dx / rect.width) * DRAG_SENSITIVITY;
    panY -= (dy / rect.height) * DRAG_SENSITIVITY;
    panX = clamp(panX, 0, 1);
    panY = clamp(panY, 0, 1);
    applyPan();
  }

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('setup-panorama--dragging');
    try {
      if (e.pointerId != null) {
        root.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
  }

  function onWheel(e) {
    stopAutoPan();
    e.preventDefault();

    var rw = root.clientWidth;
    var rh = root.clientHeight;
    var iw = img.offsetWidth;
    var ih = img.offsetHeight;
    if (rw <= 0 || rh <= 0 || iw <= 0 || ih <= 0) return;

    var rect = root.getBoundingClientRect();
    var mx = clamp(e.clientX - rect.left, 0, rw);
    var my = clamp(e.clientY - rect.top, 0, rh);

    var z0 = zoom;
    var dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= rh;

    var factor = Math.exp(-dy * 0.0022);
    var z1 = clamp(z0 * factor, MIN_ZOOM, MAX_ZOOM);
    if (z1 === z0) return;

    var o0 = txTyFromPan(rw, rh, iw, ih, z0);
    var ix = (mx - o0.tx) / z0;
    var iy = (my - o0.ty) / z0;

    zoom = z1;

    var tx1 = mx - zoom * ix;
    var ty1 = my - zoom * iy;

    var o1 = txTyFromPan(rw, rh, iw, ih, zoom);
    if (o1.rangeX < 0) {
      tx1 = clamp(tx1, o1.rangeX, 0);
    } else {
      tx1 = o1.rangeX / 2;
    }
    if (o1.rangeY < 0) {
      ty1 = clamp(ty1, o1.rangeY, 0);
    } else {
      ty1 = o1.rangeY / 2;
    }

    panFromTxTy(tx1, ty1, o1.rangeX, o1.rangeY);
    applyPan();
  }

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);
  root.addEventListener('lostpointercapture', function () {
    dragging = false;
    root.classList.remove('setup-panorama--dragging');
  });

  root.addEventListener('wheel', onWheel, { passive: false });

  function onLayout() {
    applyPan();
  }

  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(onLayout);
    ro.observe(root);
  }

  img.addEventListener('load', onLayout);
  if (img.complete) {
    onLayout();
  }

  applyPan();
  rafId = requestAnimationFrame(tick);

  root.addEventListener('dblclick', function () {
    window.open(img.currentSrc || img.src, '_blank', 'noopener,noreferrer');
  });
})();
