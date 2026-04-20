(function () {
  const cloud = document.getElementById("socialCloud");
  if (!cloud) return;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "smc-starfield";
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;";
  cloud.insertBefore(canvas, cloud.firstChild);

  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STAR_COUNT = 360;
  const PARALLAX = [0.005, 0.012, 0.022];

  let W = 0;
  let H = 0;
  let targetX = 0;
  let targetY = 0;
  let smoothX = 0;
  let smoothY = 0;
  const minDim = () => Math.min(W, H) || 1;

  /** Large soft nebula blobs (normalized coords); drawn under stars with screen blend */
  const nebulae = [
    { nx: 0.12, ny: 0.28, r: 0.52, hue: 258, drift: 0.11, phase: 0.2, inner: 0.14, outer: 0.78 },
    { nx: 0.82, ny: 0.18, r: 0.44, hue: 312, drift: 0.09, phase: 1.1, inner: 0.12, outer: 0.72 },
    { nx: 0.72, ny: 0.72, r: 0.48, hue: 278, drift: 0.08, phase: 2.4, inner: 0.11, outer: 0.8 },
    { nx: 0.38, ny: 0.62, r: 0.38, hue: 198, drift: 0.12, phase: 3.7, inner: 0.1, outer: 0.75 },
    { nx: 0.55, ny: 0.22, r: 0.28, hue: 168, drift: 0.1, phase: 4.9, inner: 0.09, outer: 0.7 },
  ];

  function resize() {
    W = canvas.width = cloud.offsetWidth || window.innerWidth;
    H = canvas.height = cloud.offsetHeight || window.innerHeight;
  }

  window.addEventListener("resize", resize);
  resize();

  function pickStarColor(isBright) {
    if (isBright) {
      return {
        h: 210 + Math.random() * 24,
        s: 6 + Math.random() * 18,
        l: 88 + Math.random() * 10,
      };
    }
    const roll = Math.random();
    if (roll < 0.55) {
      return {
        h: 205 + Math.random() * 55,
        s: 12 + Math.random() * 38,
        l: 62 + Math.random() * 28,
      };
    }
    if (roll < 0.82) {
      return {
        h: 38 + Math.random() * 28,
        s: 18 + Math.random() * 45,
        l: 58 + Math.random() * 22,
      };
    }
    return {
      h: 285 + Math.random() * 40,
      s: 15 + Math.random() * 35,
      l: 68 + Math.random() * 22,
    };
  }

  const stars = Array.from({ length: STAR_COUNT }, function (_, i) {
    const layer = i % 3;
    const isBright = i < 22;
    const col = pickStarColor(isBright);
    return {
      x: Math.random(),
      y: Math.random(),
      r: isBright
        ? 1.15 + Math.random() * 1.05
        : layer === 2
          ? 0.65 + Math.random() * 0.75
          : layer === 1
            ? 0.4 + Math.random() * 0.55
            : 0.22 + Math.random() * 0.38,
      baseAlpha: isBright
        ? 0.68 + Math.random() * 0.28
        : 0.22 + Math.random() * 0.48,
      phase: Math.random() * Math.PI * 2,
      speed: isBright
        ? 0.35 + Math.random() * 0.85
        : 0.45 + Math.random() * 2.1,
      amp: isBright
        ? 0.07 + Math.random() * 0.15
        : 0.05 + Math.random() * 0.22,
      layer,
      h: col.h,
      s: col.s,
      l: col.l,
      twinkle: isBright ? 0.35 + Math.random() * 0.5 : 0,
    };
  });

  document.addEventListener("mousemove", function (e) {
    targetX = e.clientX / window.innerWidth - 0.5;
    targetY = e.clientY / window.innerHeight - 0.5;
  });

  document.addEventListener(
    "touchmove",
    function (e) {
      if (!e.touches.length) return;
      targetX = e.touches[0].clientX / window.innerWidth - 0.5;
      targetY = e.touches[0].clientY / window.innerHeight - 0.5;
    },
    { passive: true }
  );

  const LERP = reducedMotion ? 1 : 0.048;

  function drawGalacticBand(t) {
    const md = minDim();
    const breathe = reducedMotion ? 0 : Math.sin(t * 0.00012) * 0.018;
    ctx.save();
    ctx.translate(W * 0.5, H * 0.46);
    ctx.rotate(-0.38 + breathe);
    const grad = ctx.createLinearGradient(-W * 1.1, 0, W * 1.1, 0);
    grad.addColorStop(0, "rgba(12,14,32,0)");
    grad.addColorStop(0.28, "rgba(52,68,120,0.055)");
    grad.addColorStop(0.48, "rgba(110,82,160,0.065)");
    grad.addColorStop(0.62, "rgba(48,72,130,0.05)");
    grad.addColorStop(0.78, "rgba(28,40,88,0.035)");
    grad.addColorStop(1, "rgba(8,10,24,0)");
    ctx.fillStyle = grad;
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-W * 1.5, -md * 0.34, W * 3, md * 0.68);
    ctx.restore();
  }

  function drawNebulae(t) {
    const md = minDim();
    const sec = t / 1000;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < nebulae.length; i++) {
      const n = nebulae[i];
      const driftX = reducedMotion ? 0 : Math.sin(sec * n.drift + n.phase) * md * 0.028;
      const driftY = reducedMotion ? 0 : Math.cos(sec * (n.drift * 0.85) + n.phase * 1.3) * md * 0.022;
      const cx = n.nx * W + driftX;
      const cy = n.ny * H + driftY;
      const rad = n.r * md * (0.92 + (reducedMotion ? 0 : Math.sin(sec * 0.15 + i) * 0.06));
      const g = ctx.createRadialGradient(cx, cy, rad * n.inner, cx, cy, rad * n.outer);
      const innerA = 0.22 + (reducedMotion ? 0 : Math.sin(sec * 0.2 + n.phase) * 0.04);
      const midA = innerA * 0.45;
      g.addColorStop(0, `hsla(${n.hue}, 72%, 58%, ${innerA})`);
      g.addColorStop(0.35, `hsla(${n.hue + 18}, 65%, 52%, ${midA})`);
      g.addColorStop(0.65, `hsla(${n.hue - 25}, 55%, 42%, ${midA * 0.55})`);
      g.addColorStop(1, "hsla(240, 40%, 20%, 0)");
      ctx.fillStyle = g;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, rad * n.outer, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDistantHaze(t) {
    const md = minDim();
    const sec = t / 1000;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const cx = W * (0.48 + (reducedMotion ? 0 : Math.sin(sec * 0.04) * 0.03));
    const cy = H * (0.55 + (reducedMotion ? 0 : Math.cos(sec * 0.035) * 0.025));
    const g = ctx.createRadialGradient(cx, cy, md * 0.05, cx, cy, md * 0.95);
    g.addColorStop(0, "rgba(40, 55, 120, 0.04)");
    g.addColorStop(0.45, "rgba(90, 40, 110, 0.055)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function draw(time) {
    requestAnimationFrame(draw);

    smoothX += (targetX - smoothX) * LERP;
    smoothY += (targetY - smoothY) * LERP;

    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    drawDistantHaze(time);
    drawGalacticBand(time);
    drawNebulae(time);

    const t = time / 1000;

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      let px = s.x * W;
      let py = s.y * H;

      if (!reducedMotion) {
        const ox = smoothX * PARALLAX[s.layer] * W;
        const oy = smoothY * PARALLAX[s.layer] * H;
        px = ((px + ox) % W + W) % W;
        py = ((py + oy) % H + H) % H;
      }

      const flicker = reducedMotion ? 0 : Math.sin(t * s.speed + s.phase);
      let alpha = Math.max(0.035, s.baseAlpha + flicker * s.amp);
      if (s.twinkle > 0 && !reducedMotion) {
        alpha = Math.min(1, alpha + Math.sin(t * 2.8 + s.phase * 2) * s.twinkle * 0.08);
      }

      const light = Math.min(100, s.l + (isBrightStar(s) ? flicker * 4 : 0));

      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, 6.2832);
      ctx.fillStyle = `hsla(${s.h}, ${s.s}%, ${light}%, ${alpha.toFixed(3)})`;
      ctx.globalCompositeOperation = "source-over";
      ctx.fill();

      if (s.r > 1.05 && alpha > 0.45) {
        ctx.beginPath();
        ctx.arc(px, py, s.r * 2.4, 0, 6.2832);
        const glow = ctx.createRadialGradient(px, py, 0, px, py, s.r * 2.4);
        glow.addColorStop(0, `hsla(${s.h}, ${s.s}%, ${light}%, ${(alpha * 0.35).toFixed(3)})`);
        glow.addColorStop(1, "hsla(220, 80%, 70%, 0)");
        ctx.fillStyle = glow;
        ctx.globalCompositeOperation = "screen";
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  function isBrightStar(s) {
    return s.r > 1.05;
  }

  requestAnimationFrame(draw);
})();
