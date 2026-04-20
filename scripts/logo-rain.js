/**
 * Hover-only logo rain with impact ripples + header plant growth fill.
 * Throttled spawns; respects prefers-reduced-motion.
 */
(function () {
  'use strict';

  const SPAWN_INTERVAL_MS = 88;
  const MIN_MOVE_PX = 5;
  const MAX_NODES = 28;
  const DROP_FALL_MS = 320;
  const RIPPLE_COUNT = 2;
  const RIPPLE_STAGGER_MS = 68;
  const PLANT_MAX_BURSTS = 180;
  const PLANT_FILL_PER_IMPACT = 0.028;

  function emitRainImpact(clientX, clientY) {
    window.dispatchEvent(
      new CustomEvent('logo-rain-impact', {
        detail: { clientX, clientY }
      })
    );
  }

  function emitRainReset() {
    window.dispatchEvent(new Event('logo-rain-reset'));
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  function boot() {
    if (prefersReducedMotion()) return;

    const link = document.querySelector('a.site-logo-link--alive');
    const fx = document.querySelector('.logo-rain-fx');
    const header = document.querySelector('header.site-shared-header');
    const sprouts = header ? header.querySelector('.header-plant-growth__sprouts') : null;
    if (!link || !fx) return;

    let lastSpawn = 0;
    let lastX = -1e9;
    let lastY = -1e9;
    let session = 0;
    let plantFill = 0;

    function prunePlantBursts() {
      if (!sprouts) return;
      while (sprouts.childElementCount > PLANT_MAX_BURSTS) {
        sprouts.removeChild(sprouts.firstElementChild);
      }
    }

    function spawnPlantBurst(clientX, clientY) {
      if (!header || !sprouts) return;
      const headerRect = header.getBoundingClientRect();
      if (!headerRect.width || !headerRect.height) return;

      const baseX = clientX - headerRect.left;
      const baseY = clientY - headerRect.top;
      const spread = 28 + plantFill * 90;
      const bursts = 2 + Math.floor(plantFill * 5);
      const vineBranches = 1 + Math.floor(Math.random() * 2) + Math.floor(plantFill * 2);
      const leafCount = 2 + Math.floor(Math.random() * 2) + Math.floor(plantFill * 4);

      for (let i = 0; i < bursts; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * spread;
        const x = baseX + Math.cos(angle) * distance;
        const y = baseY + Math.sin(angle) * distance;
        const burst = document.createElement('span');
        burst.className = 'header-plant-growth__burst';
        burst.style.left = `${x}px`;
        burst.style.top = `${y}px`;
        burst.style.setProperty('--grow-size', `${44 + Math.random() * 92}px`);
        burst.style.setProperty('--grow-scale', `${0.72 + Math.random() * 1.08}`);
        burst.style.setProperty('--grow-ms', `${1200 + Math.random() * 1300}ms`);
        sprouts.appendChild(burst);
      }

      for (let i = 0; i < vineBranches; i += 1) {
        const branch = document.createElement('span');
        const rot = Math.random() * 140 - 70;
        const startX = baseX + (Math.random() * 26 - 13);
        const startY = baseY + (Math.random() * 22 - 11);
        branch.className = 'header-plant-growth__vine';
        branch.style.left = `${startX}px`;
        branch.style.top = `${startY}px`;
        branch.style.setProperty('--vine-rot', `${rot}deg`);
        branch.style.setProperty('--vine-len', `${42 + plantFill * 72 + Math.random() * 44}px`);
        branch.style.setProperty('--vine-thickness', `${4 + Math.random() * 5}px`);
        branch.style.setProperty('--vine-ms', `${860 + Math.random() * 980}ms`);
        sprouts.appendChild(branch);
      }

      for (let i = 0; i < leafCount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * (22 + plantFill * 55);
        const leaf = document.createElement('span');
        leaf.className = 'header-plant-growth__leaf';
        leaf.style.left = `${baseX + Math.cos(angle) * distance}px`;
        leaf.style.top = `${baseY + Math.sin(angle) * distance}px`;
        leaf.style.setProperty('--leaf-size', `${10 + Math.random() * 14 + plantFill * 6}px`);
        leaf.style.setProperty('--leaf-rot', `${Math.random() * 360}deg`);
        leaf.style.setProperty('--leaf-ms', `${700 + Math.random() * 880}ms`);
        sprouts.appendChild(leaf);
      }

      prunePlantBursts();
    }

    function growHeaderPlantFromImpact(clientX, clientY) {
      if (!header || !sprouts) return;
      plantFill = Math.min(1, plantFill + PLANT_FILL_PER_IMPACT);
      header.style.setProperty('--plant-fill', plantFill.toFixed(3));
      spawnPlantBurst(clientX, clientY);
    }

    function clearHeaderPlantGrowth() {
      if (!header || !sprouts) return;
      plantFill = 0;
      header.style.setProperty('--plant-fill', '0');
      sprouts.replaceChildren();
    }

    function prune() {
      while (fx.childElementCount > MAX_NODES) {
        fx.removeChild(fx.firstChild);
      }
    }

    function spawnRipples(cx, cy, sid, clientX, clientY) {
      for (let i = 0; i < RIPPLE_COUNT; i++) {
        window.setTimeout(() => {
          if (sid !== session) return;
          const ring = document.createElement('span');
          ring.className = 'logo-rain-ring';
          ring.style.left = `${cx}px`;
          ring.style.top = `${cy}px`;
          fx.appendChild(ring);
          ring.addEventListener(
            'animationend',
            () => {
              ring.remove();
            },
            { once: true }
          );
        }, i * RIPPLE_STAGGER_MS);
      }
      emitRainImpact(clientX, clientY);
      growHeaderPlantFromImpact(clientX, clientY);
    }

    function spawn(cx, cy, clientX, clientY) {
      prune();

      const sid = session;
      const drop = document.createElement('span');
      drop.className = 'logo-rain-drop';
      drop.style.left = `${cx - 2.5}px`;
      drop.style.top = `${cy - 40}px`;
      fx.appendChild(drop);

      window.setTimeout(() => {
        if (sid !== session) return;
        spawnRipples(cx, cy, sid, clientX, clientY);
      }, DROP_FALL_MS);

      drop.addEventListener(
        'animationend',
        () => {
          if (sid === session) drop.remove();
        },
        { once: true }
      );
    }

    function onMove(e) {
      const now = performance.now();
      if (now - lastSpawn < SPAWN_INTERVAL_MS) return;

      const alive = fx.parentElement;
      if (!alive) return;
      const rect = alive.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < -2 || y < -2 || x > rect.width + 2 || y > rect.height + 2) return;

      if (Math.hypot(x - lastX, y - lastY) < MIN_MOVE_PX && now - lastSpawn < 420) return;

      lastSpawn = now;
      lastX = x;
      lastY = y;
      spawn(x, y, e.clientX, e.clientY);
    }

    function onLeave() {
      session += 1;
      lastX = -1e9;
      lastY = -1e9;
      fx.replaceChildren();
      emitRainReset();
      clearHeaderPlantGrowth();
    }

    link.addEventListener('mousemove', onMove, { passive: true });
    link.addEventListener('mouseleave', onLeave);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
