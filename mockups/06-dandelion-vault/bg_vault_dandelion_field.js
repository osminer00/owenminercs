(function() {
    'use strict';

    const STORAGE_KEY = 'owenMinerMockupDandelionV1';
    const sharedBackgrounds = window.FinanceBackgroundScenes || {};
    const controlKeys = sharedBackgrounds.controlKeys || ['speed', 'density', 'scale', 'glow', 'parallax', 'chaos', 'breeze'];
    const fallbackControls = sharedBackgrounds.fallbackControls || { speed: 1, density: 1, scale: 1, glow: 1, parallax: 1, chaos: 1, breeze: 0.2 };
    const cloneControls = sharedBackgrounds.cloneControls || function(source) {
        const next = {};
        controlKeys.forEach(function(key) {
            next[key] = source && typeof source[key] === 'number' ? source[key] : fallbackControls[key];
        });
        return next;
    };
    const sceneConfigs = sharedBackgrounds.createLabSceneConfigs ? sharedBackgrounds.createLabSceneConfigs() : [];
    const scene = sceneConfigs.find(function(entry) {
        return entry.mode === 'dandelion';
    }) || {
        label: 'Vault Dandelion Field',
        defaults: { speed: 0.8, density: 0.7, scale: 1.04, glow: 1.06, parallax: 0.82, chaos: 0.72 },
        presets: [
            { id: 'balanced', label: 'Balanced', hint: 'A steady full-cycle dandelion grove with clear bloom transitions.', controls: { speed: 0.8, density: 0.7, scale: 1.04, glow: 1.06, parallax: 0.82, chaos: 0.72 } }
        ]
    };

    const urlParams = new URLSearchParams(window.location.search);
    const stillMode = urlParams.get('still') === '1' || urlParams.get('static') === '1';
    const embedMode = urlParams.get('embed') === '1' || urlParams.get('gallery') === '1';
    const forcedPresetParam = urlParams.get('preset') || '';
    const forcedAnimationSpeedParam = readSingleNumberParam('animationSpeed');
    const initialOverrides = readControlOverridesFromParams();

    if (embedMode) {
        document.body.classList.add('embed-mode');
    }

    const bgLayerVideo = document.getElementById('bgLayerVideo');
    if (bgLayerVideo) {
        if (urlParams.get('novideo') === '1') {
            bgLayerVideo.remove();
        } else {
            bgLayerVideo.play().catch(function() {});
        }
    }

    const stage = document.getElementById('backgroundStage');
    const fxCanvas = document.getElementById('fxCanvas');
    const fxParticles = document.getElementById('fxParticles');
    const ctx = fxCanvas && fxCanvas.getContext('2d');
    const ptx = fxParticles && fxParticles.getContext('2d');
    const canvas2dReady = !!(ctx && ptx);
    const toggleControls = document.getElementById('toggleControls');
    const controlsDrawer = document.getElementById('controlsDrawer');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const resetControlsBtn = document.getElementById('resetControlsBtn');
    const presetSelect = document.getElementById('presetSelect');
    const presetValue = document.getElementById('presetValue');
    const presetHint = document.getElementById('presetHint');
    const controlStatus = document.getElementById('controlStatus');
    const animationSpeedControl = document.getElementById('animationSpeedControl');
    const animationSpeedValue = document.getElementById('animationSpeedValue');
    const horizontalControl = document.getElementById('horizontalControl');
    const horizontalValue = document.getElementById('horizontalValue');
    const heightControl = document.getElementById('heightControl');
    const heightValue = document.getElementById('heightValue');
    const sliderEls = {
        speed: document.getElementById('speedControl'),
        density: document.getElementById('densityControl'),
        scale: document.getElementById('scaleControl'),
        glow: document.getElementById('glowControl'),
        parallax: document.getElementById('parallaxControl'),
        chaos: document.getElementById('chaosControl'),
        breeze: document.getElementById('breezeControl')
    };
    const sliderValueEls = {
        speed: document.getElementById('speedValue'),
        density: document.getElementById('densityValue'),
        scale: document.getElementById('scaleValue'),
        glow: document.getElementById('glowValue'),
        parallax: document.getElementById('parallaxValue'),
        chaos: document.getElementById('chaosValue'),
        breeze: document.getElementById('breezeValue')
    };

    const storedState = loadStoredState();
    const defaultControls = cloneControls(scene.defaults || fallbackControls);
    const presets = Array.isArray(scene.presets) && scene.presets.length ? scene.presets : [
        { id: 'balanced', label: 'Balanced', hint: 'Recommended default.', controls: defaultControls }
    ];

    let controls = cloneControls(storedState.controls || { speed: 0.4, density: 0.4, scale: 0.6, glow: 0.3, parallax: 0, chaos: 0.2, breeze: 0.2 });
    let animationSpeed = clamp(typeof storedState.animationSpeed === 'number' ? storedState.animationSpeed : 0.2, 0.2, 2.4);
    let horizontalPosition = clamp(typeof storedState.horizontalPosition === 'number' ? storedState.horizontalPosition : 0.23, 0.12, 0.6);
    let verticalPosition = clamp(typeof storedState.verticalPosition === 'number' ? storedState.verticalPosition : 0.285, 0.16, 0.72);
    let size = { width: 0, height: 0, dpr: window.devicePixelRatio || 1 };
    let pointer = { x: 0, y: 0, tx: 0, ty: 0, lx: 0, ly: 0, energy: 0.2 };
    let time = 0;
    let trunkMotes = [];
    let rafId = 0;
    const gradientCache = {};
    let breeze = { phase: Math.random() * Math.PI * 2, offsetX: 0, offsetY: 0 };

    const initialPreset = findPresetById(forcedPresetParam) || findPresetById(storedState.presetId) || presets[0];
    controls = cloneControls(initialPreset.controls);
    if (forcedAnimationSpeedParam !== null) {
        animationSpeed = clamp(forcedAnimationSpeedParam, 0.2, 2.4);
    }
    Object.assign(controls, initialOverrides);

    buildPresetSelect();
    updateControlUI();
    applyDrawerState(Boolean(storedState.drawerOpen) && !embedMode);

    window.addEventListener('resize', resize);

    if (!embedMode) {
        toggleControls.addEventListener('click', function() {
            applyDrawerState(!controlsDrawer.classList.contains('open'));
            saveStoredState();
        });
        closeDrawerBtn.addEventListener('click', function() {
            applyDrawerState(false);
            saveStoredState();
        });
        resetControlsBtn.addEventListener('click', function() {
            const preset = findPresetById('balanced') || presets[0];
            controls = cloneControls(preset.controls);
            animationSpeed = 1;
            horizontalPosition = 0.23;
            verticalPosition = 0.285;
            seedData();
            updateControlUI();
            setStatus('Reset the standalone dandelion page to its default tune.');
            saveStoredState();
            requestRender();
        });
    }

    presetSelect.addEventListener('change', function() {
        const preset = findPresetById(presetSelect.value);
        if (!preset) {
            return;
        }
        controls = cloneControls(preset.controls);
        seedData();
        updateControlUI();
        setStatus('Applied "' + preset.label + '" for the standalone dandelion page.');
        saveStoredState();
        requestRender();
    });

    controlKeys.forEach(function(key) {
        sliderEls[key].addEventListener('input', function() {
            controls[key] = clamp(parseFloat(sliderEls[key].value) || 1, parseFloat(sliderEls[key].min), parseFloat(sliderEls[key].max));
            seedData();
            updateControlUI();
            setStatus('Live tuning the standalone dandelion field.');
            saveStoredState();
            requestRender();
        });
    });

    animationSpeedControl.addEventListener('input', function() {
        animationSpeed = clamp(parseFloat(animationSpeedControl.value) || 1, 0.2, 2.4);
        updateControlUI();
        setStatus('Adjusted animation speed for the standalone page.');
        saveStoredState();
        requestRender();
    });

    horizontalControl.addEventListener('input', function() {
        horizontalPosition = clamp(parseFloat(horizontalControl.value) || 0.23, 0.12, 0.6);
        updateControlUI();
        setStatus('Adjusted horizontal placement for the standalone page.');
        saveStoredState();
        requestRender();
    });

    heightControl.addEventListener('input', function() {
        verticalPosition = clamp(parseFloat(heightControl.value) || 0.285, 0.16, 0.72);
        updateControlUI();
        setStatus('Adjusted height placement for the standalone page.');
        saveStoredState();
        requestRender();
    });

    if (canvas2dReady) {
        resize();
        requestRender();
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function readSingleNumberParam(key) {
        const raw = urlParams.get(key);
        if (raw === null || raw === '') {
            return null;
        }
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    }

    function readControlOverridesFromParams() {
        const overrides = {};
        controlKeys.forEach(function(key) {
            const raw = urlParams.get(key);
            if (raw === null || raw === '') {
                return;
            }
            const value = Number(raw);
            if (Number.isFinite(value)) {
                overrides[key] = value;
            }
        });
        return overrides;
    }

    function loadStoredState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return {};
            }
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed ? parsed : {};
        } catch (error) {
            console.warn('[Dandelion standalone] Failed to read stored state:', error);
            return {};
        }
    }

    function saveStoredState() {
        if (embedMode) {
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                controls: controls,
                presetId: matchPresetId(controls),
                animationSpeed: animationSpeed,
                horizontalPosition: horizontalPosition,
                verticalPosition: verticalPosition,
                drawerOpen: controlsDrawer.classList.contains('open')
            }));
        } catch (error) {
            console.warn('[Dandelion standalone] Failed to save settings:', error);
            setStatus('Could not save settings (storage may be full or blocked).');
        }
    }

    function buildPresetSelect() {
        presetSelect.replaceChildren();
        presets.forEach(function(preset) {
            const opt = document.createElement('option');
            opt.value = preset.id;
            opt.textContent = preset.label;
            presetSelect.appendChild(opt);
        });
        const customOpt = document.createElement('option');
        customOpt.value = 'custom-live';
        customOpt.textContent = 'Custom Live';
        presetSelect.appendChild(customOpt);
    }

    function findPresetById(id) {
        return presets.find(function(preset) {
            return preset.id === id;
        }) || null;
    }

    function matchPresetId(currentControls) {
        const matched = presets.find(function(preset) {
            return controlKeys.every(function(key) {
                return Math.abs((preset.controls[key] || 0) - (currentControls[key] || 0)) < 0.001;
            });
        });
        return matched ? matched.id : 'custom-live';
    }

    function updateControlUI() {
        controlKeys.forEach(function(key) {
            sliderEls[key].value = String(controls[key]);
            sliderValueEls[key].textContent = controls[key].toFixed(2) + 'x';
        });
        animationSpeedControl.value = String(animationSpeed);
        animationSpeedValue.textContent = animationSpeed.toFixed(2) + 'x';
        horizontalControl.value = String(horizontalPosition);
        horizontalValue.textContent = Math.round(horizontalPosition * 100) + '%';
        heightControl.value = String(verticalPosition);
        heightValue.textContent = Math.round(verticalPosition * 100) + '%';
        const matchedId = matchPresetId(controls);
        presetSelect.value = matchedId;
        if (matchedId === 'custom-live') {
            presetValue.textContent = 'Custom Live';
            presetHint.textContent = 'The sliders are in a custom live state for this standalone page.';
        } else {
            const preset = findPresetById(matchedId);
            presetValue.textContent = preset ? preset.label : 'Balanced';
            presetHint.textContent = preset ? preset.hint : 'Scene-tuned dandelion variations.';
        }
    }

    function applyDrawerState(isOpen) {
        controlsDrawer.classList.toggle('open', isOpen && !embedMode);
        controlsDrawer.setAttribute('aria-hidden', String(!(isOpen && !embedMode)));
    }

    function setStatus(message) {
        controlStatus.textContent = message;
    }

    function resizeCanvas(canvas, context) {
        if (!canvas || !context || !stage) return;
        const rect = stage.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function resize() {
        if (!canvas2dReady) return;
        const rect = stage.getBoundingClientRect();
        size.width = rect.width;
        size.height = rect.height;
        size.dpr = window.devicePixelRatio || 1;
        resizeCanvas(fxCanvas, ctx);
        resizeCanvas(fxParticles, ptx);
        pointer.x = size.width * 0.42;
        pointer.y = size.height * 0.36;
        pointer.tx = pointer.x;
        pointer.ty = pointer.y;
        pointer.lx = pointer.x;
        pointer.ly = pointer.y;
        seedData();
        requestRender();
    }

    function random(min, max) {
        return min + Math.random() * (max - min);
    }

    function seedData() {
        trunkMotes = [];
        const particleCount = Math.floor(clamp(28 * controls.density, 18, 72));
        for (let i = 0; i < particleCount; i += 1) {
            trunkMotes.push({
                x: random(0, size.width),
                y: random(0, size.height),
                vx: random(-0.4, 0.4),
                vy: random(-0.4, 0.4),
                size: random(1, 3.8) * controls.scale,
                pulse: random(0, Math.PI * 2)
            });
        }
    }

    function updatePointer(event) {
        const rect = stage.getBoundingClientRect();
        pointer.tx = clamp(event.clientX - rect.left, 0, rect.width);
        pointer.ty = clamp(event.clientY - rect.top, 0, rect.height);
    }

    function softenPointer() {
        pointer.tx = size.width * 0.42;
        pointer.ty = size.height * 0.36;
    }

    function clearAll() {
        ctx.clearRect(0, 0, size.width, size.height);
        ptx.clearRect(0, 0, size.width, size.height);
    }

    function drawGlow(context, x, y, radius, color, alpha) {
        const cacheKey = radius + '_' + color;
        let gradient = gradientCache[cacheKey];
        if (!gradient) {
            gradient = context.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, color.replace('ALPHA', alpha.toFixed(3)));
            gradient.addColorStop(1, color.replace('ALPHA', '0'));
            if (Object.keys(gradientCache).length < 32) {
                gradientCache[cacheKey] = gradient;
            }
        }
        context.fillStyle = gradient;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    function currentParallaxX() {
        return (pointer.x - size.width * 0.5) * 0.12 * controls.parallax;
    }

    function currentParallaxY() {
        return (pointer.y - size.height * 0.5) * 0.08 * controls.parallax;
    }

    function mixColor(a, b, t) {
        return [
            Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t)
        ];
    }

    function dandelionPalette(phase) {
        const green = { bloom: [138, 224, 131], glow: [126, 240, 191], stem: [101, 165, 96] };
        const yellow = { bloom: [242, 212, 92], glow: [255, 221, 134], stem: [132, 154, 74] };
        const white = { bloom: [244, 242, 228], glow: [255, 248, 214], stem: [154, 163, 124] };

        if (phase < 0.38) {
            const t = phase / 0.38;
            return {
                bloom: mixColor(green.bloom, yellow.bloom, t * 0.35),
                glow: mixColor(green.glow, yellow.glow, t * 0.25),
                stem: mixColor(green.stem, yellow.stem, t * 0.18)
            };
        }
        if (phase < 0.64) {
            const t = (phase - 0.38) / 0.26;
            return {
                bloom: mixColor(green.bloom, yellow.bloom, t),
                glow: mixColor(green.glow, yellow.glow, t),
                stem: mixColor(green.stem, yellow.stem, t * 0.72)
            };
        }
        const t = Math.min(1, (phase - 0.64) / 0.36);
        return {
            bloom: mixColor(yellow.bloom, white.bloom, t),
            glow: mixColor(yellow.glow, white.glow, t),
            stem: mixColor(yellow.stem, white.stem, t * 0.72)
        };
    }

    function drawSeedCrown(context, x, y, radius, rotation, alpha) {
        const rays = 7;
        context.strokeStyle = 'rgba(255,255,248,' + alpha.toFixed(3) + ')';
        context.lineWidth = 0.6;
        for (let i = 0; i < rays; i += 1) {
            const a = rotation + (i / rays) * Math.PI * 2;
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius * 0.84);
            context.stroke();
        }

        context.beginPath();
        context.fillStyle = 'rgba(255,248,236,' + Math.max(0.08, alpha * 0.8).toFixed(3) + ')';
        context.arc(x, y, Math.max(0.7, radius * 0.18), 0, Math.PI * 2);
        context.fill();
    }

    function drawDandelionSeed(context, originX, originY, angle, travel, depth, alpha) {
        const seedX = originX + Math.cos(angle) * (travel * (84 + controls.chaos * 130) * depth);
        const seedY = originY - travel * (26 + depth * 26) + Math.sin(angle * 1.3 + time * 0.9) * 8;
        const pointerDx = pointer.x - seedX;
        const pointerDy = pointer.y - seedY;
        const pointerDist = Math.sqrt(pointerDx * pointerDx + pointerDy * pointerDy) || 1;
        const pointerPush = pointerDist < 180 ? (1 - pointerDist / 180) * 26 * controls.parallax * (0.45 + pointer.energy) : 0;
        const driftX = seedX - (pointerDx / pointerDist) * pointerPush + currentParallaxX() * 0.1;
        const driftY = seedY - (pointerDy / pointerDist) * pointerPush + currentParallaxY() * 0.04;
        const fluffX = driftX - (8 + travel * 14);
        const fluffY = driftY - 6 - travel * 7;

        context.strokeStyle = 'rgba(248,248,240,' + alpha.toFixed(3) + ')';
        context.lineWidth = 0.9;
        context.beginPath();
        context.moveTo(driftX, driftY);
        context.lineTo(fluffX, fluffY);
        context.stroke();

        drawSeedCrown(context, fluffX, fluffY, 2.4 + depth * 0.85 + travel * 1.4, angle + time * 0.08, Math.min(0.96, alpha + 0.1));
        drawGlow(context, fluffX, fluffY, 7 * controls.glow, 'rgba(255, 248, 214, ALPHA)', 0.018 * controls.glow);
    }

    function drawWideDandelionSeedBurst(context, x, y, radius, phase, pulse, alphaBoost, depth) {
        const whitening = clamp((phase - 0.56) / 0.18, 0, 1);
        const release = clamp((phase - 0.78) / 0.22, 0, 1);
        const attachedSeeds = Math.floor(clamp(14 + controls.density * 10 + depth * 4, 14, 28) * (1 - release * 0.78));

        drawGlow(context, x, y, radius * 2.0 * controls.glow, 'rgba(255, 248, 214, ALPHA)', (0.06 + whitening * 0.05) * controls.glow * alphaBoost);

        for (let i = 0; i < attachedSeeds; i += 1) {
            const angle = (i / Math.max(1, attachedSeeds)) * Math.PI * 2 + pulse + Math.sin(i * 2.1 + pulse) * 0.045;
            const reach = radius * (1.16 + 0.28 * Math.sin(i * 1.3 + pulse + time * 0.18));
            const tipX = x + Math.cos(angle) * reach;
            const tipY = y + Math.sin(angle) * reach * 0.9;

            context.strokeStyle = 'rgba(238,238,230,' + (0.14 + whitening * 0.24).toFixed(3) + ')';
            context.lineWidth = Math.max(0.75, depth * 0.72);
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(tipX, tipY);
            context.stroke();

            drawSeedCrown(context, tipX, tipY, Math.max(2.6, radius * 0.11), angle + Math.PI * 0.5, 0.22 + whitening * 0.34);
        }

        context.beginPath();
        context.fillStyle = 'rgba(214,188,96,' + (0.12 + (1 - release) * 0.16).toFixed(3) + ')';
        context.arc(x, y, radius * 0.09, 0, Math.PI * 2);
        context.fill();

        const looseSeeds = Math.min(18, Math.floor((18 + controls.density * 10) * release));
        for (let i = 0; i < looseSeeds; i += 1) {
            const angle = pulse + i * 0.37;
            const travel = ((time * 0.085 * controls.speed + i * 0.11 + pulse * 0.2) % 1) * release;
            drawDandelionSeed(context, x + Math.cos(angle) * radius * 0.18, y + Math.sin(angle) * radius * 0.16, angle, travel, depth, 0.14 + release * 0.42);
        }
    }

    function drawDandelionSeedArm(baseContext, glowContext, x, y, length, angle, depthLeft, sway, phase, thickness) {
        const nx = x + Math.cos(angle) * length;
        const ny = y + Math.sin(angle) * length;
        baseContext.lineWidth = Math.max(1.1, thickness * (0.72 + depthLeft * 0.16) * controls.scale);
        baseContext.strokeStyle = 'rgba(176,255,226,' + Math.max(0.12, 0.12 + depthLeft * 0.028 * controls.glow).toFixed(3) + ')';
        baseContext.beginPath();
        baseContext.moveTo(x, y);
        baseContext.lineTo(nx, ny);
        baseContext.stroke();

        glowContext.lineWidth = Math.max(0.9, thickness * (0.4 + depthLeft * 0.1) * controls.scale);
        glowContext.strokeStyle = 'rgba(224,255,241,' + Math.max(0.1, 0.08 + depthLeft * 0.022 * controls.glow).toFixed(3) + ')';
        glowContext.beginPath();
        glowContext.moveTo(x, y);
        glowContext.lineTo(nx, ny);
        glowContext.stroke();

        const maxDepth = controls.density > 1.8 ? 2 : 4;
        if (depthLeft <= 1 || length < 18 || depthLeft > maxDepth) {
            drawWideDandelionSeedBurst(glowContext, nx, ny, length * 0.72, phase, angle + time * 0.1, 0.82, Math.max(0.72, thickness * 0.34));
            return;
        }

        const pointerBias = (pointer.x / size.width - 0.5) * 0.46 * controls.parallax;
        const bend = Math.sin(time * 1.16 + nx * 0.006 + ny * 0.004) * 0.06 * controls.chaos;
        const split = 0.34 + depthLeft * 0.04;
        drawDandelionSeedArm(baseContext, glowContext, nx, ny, length * 0.74, angle - split + sway + pointerBias + bend, depthLeft - 1, sway, phase + 0.015, thickness * 0.82);
        drawDandelionSeedArm(baseContext, glowContext, nx, ny, length * 0.78, angle + split - sway + pointerBias - bend, depthLeft - 1, sway, phase + 0.02, thickness * 0.8);
    }

    function drawDandelionSupportArm(baseContext, glowContext, x, y, length, angle, depthLeft, sway, thickness) {
        const nx = x + Math.cos(angle) * length;
        const ny = y + Math.sin(angle) * length;
        baseContext.lineWidth = Math.max(0.8, thickness * (0.6 + depthLeft * 0.14) * controls.scale);
        baseContext.strokeStyle = 'rgba(176,255,226,' + Math.max(0.08, 0.08 + depthLeft * 0.02 * controls.glow).toFixed(3) + ')';
        baseContext.beginPath();
        baseContext.moveTo(x, y);
        baseContext.lineTo(nx, ny);
        baseContext.stroke();

        glowContext.lineWidth = Math.max(0.65, thickness * (0.34 + depthLeft * 0.08) * controls.scale);
        glowContext.strokeStyle = 'rgba(224,255,241,' + Math.max(0.06, 0.06 + depthLeft * 0.016 * controls.glow).toFixed(3) + ')';
        glowContext.beginPath();
        glowContext.moveTo(x, y);
        glowContext.lineTo(nx, ny);
        glowContext.stroke();

        if (depthLeft <= 1 || length < 14) {
            return;
        }

        const pointerBias = (pointer.x / size.width - 0.5) * 0.34 * controls.parallax;
        const bend = Math.sin(time * 1.08 + nx * 0.006 + ny * 0.004) * 0.05 * controls.chaos;
        const split = 0.28 + depthLeft * 0.035;
        drawDandelionSupportArm(baseContext, glowContext, nx, ny, length * 0.76, angle - split + sway + pointerBias + bend, depthLeft - 1, sway, thickness * 0.82);
        drawDandelionSupportArm(baseContext, glowContext, nx, ny, length * 0.8, angle + split - sway + pointerBias - bend, depthLeft - 1, sway, thickness * 0.8);
    }

    function drawDandelion() {
        const cycle = (time * (0.018 + controls.speed * 0.012)) % 1;
        const skyPalette = dandelionPalette(cycle);
        const anchorX = size.width * horizontalPosition + currentParallaxX() * 0.12;
        const anchorY = size.height * verticalPosition + currentParallaxY() * 0.08;
        const stemTopX = anchorX - 12 - currentParallaxX() * 0.06;
        const stemTopY = 28;
        const pointerDx = anchorX - pointer.x;
        const pointerDy = anchorY - pointer.y;
        const pointerDist = Math.sqrt(pointerDx * pointerDx + pointerDy * pointerDy) || 1;
        const pointerForce = pointerDist < 240 ? (1 - pointerDist / 240) * 0.22 * controls.parallax * (0.55 + pointer.energy) : 0;
        const sway = Math.sin(time * 1.28 * controls.speed) * 0.1 * controls.chaos;
        const phase = cycle;

        drawGlow(ctx, size.width * 0.42, size.height * 0.42, 360 * controls.glow, 'rgba(' + skyPalette.glow[0] + ', ' + skyPalette.glow[1] + ', ' + skyPalette.glow[2] + ', ALPHA)', 0.08 * controls.glow);
        drawGlow(ctx, anchorX, anchorY, 150 * controls.glow, 'rgba(255, 248, 214, ALPHA)', 0.08 * controls.glow);
        drawGlow(ctx, pointer.x, pointer.y, 180 * controls.glow * (1 + pointer.energy), 'rgba(255, 244, 209, ALPHA)', 0.06 * controls.glow);

        ctx.lineWidth = 8.8 * controls.scale;
        ctx.strokeStyle = 'rgba(176,255,226,' + (0.18 * controls.glow).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(stemTopX, stemTopY);
        ctx.lineTo(anchorX, anchorY);
        ctx.stroke();

        ptx.lineWidth = 4.2 * controls.scale;
        ptx.strokeStyle = 'rgba(230,255,244,' + (0.22 * controls.glow).toFixed(3) + ')';
        ptx.beginPath();
        ptx.moveTo(stemTopX + 4, stemTopY);
        ptx.lineTo(anchorX, anchorY);
        ptx.stroke();

        const densityFactor = Math.min(1, controls.density / 1.5);
        const armCount = Math.floor(clamp(8 + densityFactor * 7, 8, 16));
        const upperArmCount = Math.floor(clamp(12 + densityFactor * 10, 12, 20));
        const sideArmCount = Math.floor(clamp(10 + densityFactor * 8, 10, 18));
        const baseLength = Math.min(size.width, size.height) * 0.11 * controls.scale;

        for (let i = 0; i < armCount; i += 1) {
            const fan = (i / Math.max(1, armCount - 1) - 0.5) * 1.66;
            const armAngle = Math.PI / 2 + fan + sway + (pointerDx / pointerDist) * pointerForce;
            const armLength = baseLength * (0.92 + Math.sin(i * 1.2 + time * 0.1) * 0.08);
            drawDandelionSeedArm(ctx, ptx, anchorX, anchorY, armLength, armAngle, 4, sway * 0.9, phase + i * 0.012, 3.8);
        }

        const upperSpan = 2.34;
        for (let j = 0; j < upperArmCount; j += 1) {
            const t = j / Math.max(1, upperArmCount - 1);
            const upperFan = -Math.PI / 2 + (t - 0.5) * upperSpan;
            if (Math.abs(upperFan + Math.PI / 2) < 0.14) {
                continue;
            }
            const upperAngle = upperFan + sway * 0.65 + (pointerDx / pointerDist) * pointerForce * 0.55;
            const upperLength = baseLength * (0.9 + Math.sin(j * 1.05 + time * 0.14) * 0.06);
            drawDandelionSeedArm(ctx, ptx, anchorX, anchorY, upperLength, upperAngle, 4, sway * 0.62, phase + 0.18 + j * 0.014, 3.0);
        }

        const sideSpan = 1.9;
        [Math.PI, 0].forEach(function(centerAngle, sideIndex) {
            for (let m = 0; m < sideArmCount; m += 1) {
                const t = m / Math.max(1, sideArmCount - 1);
                const sideFan = (t - 0.5) * sideSpan;
                const sideAngle = centerAngle + sideFan + sway * 0.56 + (pointerDx / pointerDist) * pointerForce * 0.48;
                const sideLength = baseLength * (0.88 + Math.sin(m * 1.12 + time * 0.13 + sideIndex) * 0.06);
                drawDandelionSeedArm(ctx, ptx, anchorX, anchorY, sideLength, sideAngle, 4, sway * 0.54, phase + 0.34 + sideIndex * 0.1 + m * 0.013, 3.1);
            }
        });

        const supportArmCount = controls.density > 1.5 ? Math.floor(clamp(12 + densityFactor * 8, 12, 24)) : Math.floor(clamp(18 + densityFactor * 12, 18, 36));
        const supportSpan = Math.PI * 2 - 0.22;
        for (let k = 0; k < supportArmCount; k += 1) {
            const t = k / Math.max(1, supportArmCount - 1);
            const supportAngle = -Math.PI / 2 + 0.11 + t * supportSpan + sway * 0.28;
            if (Math.abs(supportAngle + Math.PI / 2) < 0.08) {
                continue;
            }
            const supportLength = baseLength * (0.72 + Math.sin(k * 0.92 + time * 0.12) * 0.05);
            drawDandelionSupportArm(ctx, ptx, anchorX, anchorY, supportLength, supportAngle, 3, sway * 0.36, 2.1);
        }

        drawWideDandelionSeedBurst(ptx, anchorX, anchorY, Math.min(size.width, size.height) * 0.12 * controls.scale, phase, time * 0.14, 1, 1.1);

        trunkMotes.forEach(function(mote, index) {
            mote.x += (0.16 + mote.vx * 0.08) * controls.speed + pointer.energy * 0.24;
            mote.y += (-0.06 + mote.vy * 0.08) * controls.speed;
            if (mote.x > size.width + 24) mote.x = -24;
            if (mote.y < -24) mote.y = size.height + 24;
            const alpha = clamp(0.08 + Math.sin(time * 1.7 + mote.pulse + index * 0.2) * 0.06, 0.05, 0.18);
            drawDandelionSeed(ptx, mote.x, mote.y, mote.pulse + time * 0.1, 0.06 + pointer.energy * 0.04, 0.72, alpha);
        });
    }

    function renderFrame() {
        if (!canvas2dReady) return;
        if (rafId) {
            rafId = 0;
        }

        time += 0.016 * animationSpeed;

        // Breeze simulation (ambient, non-pointer-driven)
        // offsets vary slowly with time and scale with controls.breeze
        const breezeStrength = clamp(typeof controls.breeze === 'number' ? controls.breeze : 0.2, 0, 2);
        breeze.offsetX = Math.sin(time * 0.55 + breeze.phase) * (22 * breezeStrength);
        breeze.offsetY = Math.cos(time * 0.28 + breeze.phase * 0.9) * (8 * breezeStrength);

        // Treat pointer target as a slowly moving point driven by breeze
        pointer.tx = size.width * 0.42 + breeze.offsetX;
        pointer.ty = size.height * 0.36 + breeze.offsetY;

        pointer.x += (pointer.tx - pointer.x) * 0.12;
        pointer.y += (pointer.ty - pointer.y) * 0.12;
        const motionX = pointer.x - pointer.lx;
        const motionY = pointer.y - pointer.ly;
        const motionMag = Math.sqrt(motionX * motionX + motionY * motionY);
        pointer.energy += (Math.min(1.4, motionMag / 18 + breezeStrength * 0.24) - pointer.energy) * 0.14;
        pointer.lx = pointer.x;
        pointer.ly = pointer.y;

        clearAll();
        drawDandelion();

        if (!stillMode) {
            rafId = requestAnimationFrame(renderFrame);
        }
    }

    function requestRender() {
        if (!canvas2dReady) return;
        if (stillMode) {
            renderFrame();
            return;
        }
        if (!rafId) {
            rafId = requestAnimationFrame(renderFrame);
        }
    }
})();
