(function() {
    'use strict';

    const controlKeys = ['speed', 'density', 'scale', 'glow', 'parallax', 'chaos', 'breeze'];
    const fallbackControls = { speed: 1, density: 1, scale: 1, glow: 1, parallax: 1, chaos: 1, breeze: 0.2 };

    const appScenes = [
        {
            mode: 'anti',
            label: 'Anti-Gravity Plexus',
            accent: '#69e3ff',
            background: 'radial-gradient(circle at 50% 26%, rgba(105, 227, 255, 0.12), transparent 28%), radial-gradient(circle at 84% 14%, rgba(136, 247, 202, 0.08), transparent 18%), linear-gradient(160deg, #05111d 0%, #0b1d31 58%, #060d15 100%)',
            defaults: { speed: 0.9, density: 0.92, scale: 0.94, glow: 0.95, parallax: 0.9, chaos: 0.86 },
            presets: [
                { id: 'balanced', label: 'Balanced', hint: 'Responsive without dominating the cards.', controls: { speed: 0.9, density: 0.92, scale: 0.94, glow: 0.95, parallax: 0.9, chaos: 0.86 } },
                { id: 'event-horizon', label: 'Event Horizon', hint: 'Stronger shock-rings and a hotter center.', controls: { speed: 1.08, density: 1.12, scale: 1.02, glow: 1.22, parallax: 1.08, chaos: 1.04 } },
                { id: 'calm-field', label: 'Calm Field', hint: 'Production-friendly and easier on form fields.', controls: { speed: 0.74, density: 0.74, scale: 0.88, glow: 0.74, parallax: 0.64, chaos: 0.62 } },
                { id: 'low-motion', label: 'Low Motion', hint: 'Accessibility-first movement with a softer cursor response.', controls: { speed: 0.48, density: 0.68, scale: 0.88, glow: 0.68, parallax: 0.22, chaos: 0.34 } }
            ]
        },
        {
            mode: 'grid',
            label: 'Neon Grid Rain',
            accent: '#6cd5ff',
            background: 'radial-gradient(circle at 50% 14%, rgba(73, 164, 255, 0.16), transparent 18%), linear-gradient(180deg, #04111d 0%, #07111a 58%, #04080d 100%)',
            defaults: { speed: 0.88, density: 0.96, scale: 1.02, glow: 1.02, parallax: 0.84, chaos: 0.8 },
            presets: [
                { id: 'balanced', label: 'Balanced', hint: 'Bright enough to feel premium, restrained enough for data entry.', controls: { speed: 0.88, density: 0.96, scale: 1.02, glow: 1.02, parallax: 0.84, chaos: 0.8 } },
                { id: 'storm-run', label: 'Storm Run', hint: 'Extra rain and horizon energy for showcase moments.', controls: { speed: 1.08, density: 1.18, scale: 1.1, glow: 1.28, parallax: 1.0, chaos: 0.98 } },
                { id: 'night-drive', label: 'Night Drive', hint: 'Softer lane glow and deeper cinematic spacing.', controls: { speed: 0.7, density: 0.8, scale: 0.96, glow: 0.76, parallax: 0.66, chaos: 0.6 } },
                { id: 'low-motion', label: 'Low Motion', hint: 'A calmer synth horizon with restrained rain speed.', controls: { speed: 0.42, density: 0.72, scale: 0.94, glow: 0.68, parallax: 0.18, chaos: 0.32 } }
            ]
        },
        {
            mode: 'trunk',
            label: 'Vault Trunk Field',
            accent: '#88f7ca',
            background: 'radial-gradient(circle at 50% 8%, rgba(126, 240, 191, 0.12), transparent 22%), linear-gradient(180deg, #07131b 0%, #0c1822 48%, #050b11 100%)',
            defaults: { speed: 0.82, density: 0.96, scale: 1.02, glow: 1.08, parallax: 0.78, chaos: 0.74 },
            presets: [
                { id: 'balanced', label: 'Balanced', hint: 'Organic and premium without getting too thorny.', controls: { speed: 0.82, density: 0.96, scale: 1.02, glow: 1.08, parallax: 0.78, chaos: 0.74 } },
                { id: 'cathedral', label: 'Cathedral', hint: 'Taller trunks and a richer canopy for hero mode.', controls: { speed: 0.94, density: 1.12, scale: 1.14, glow: 1.34, parallax: 0.92, chaos: 0.9 } },
                { id: 'ember-roots', label: 'Ember Roots', hint: 'Lower motion with softer structure for everyday use.', controls: { speed: 0.64, density: 0.78, scale: 0.92, glow: 0.82, parallax: 0.58, chaos: 0.52 } },
                { id: 'low-motion', label: 'Low Motion', hint: 'Soft ambient branching with very little visual agitation.', controls: { speed: 0.38, density: 0.68, scale: 0.9, glow: 0.72, parallax: 0.16, chaos: 0.26 } }
            ]
        },
        {
            mode: 'trunk-copy',
            label: 'Vault Trunk Field Copy',
            accent: '#88f7ca',
            background: 'radial-gradient(circle at 50% 8%, rgba(126, 240, 191, 0.12), transparent 22%), linear-gradient(180deg, #07131b 0%, #0c1822 48%, #050b11 100%)',
            defaults: { speed: 0.82, density: 0.96, scale: 1.02, glow: 1.08, parallax: 0.78, chaos: 0.74 },
            presets: [
                { id: 'balanced', label: 'Balanced', hint: 'A direct copy of the original Vault Trunk Field tune.', controls: { speed: 0.82, density: 0.96, scale: 1.02, glow: 1.08, parallax: 0.78, chaos: 0.74 } },
                { id: 'cathedral', label: 'Cathedral', hint: 'Taller trunks and a richer canopy for hero mode.', controls: { speed: 0.94, density: 1.12, scale: 1.14, glow: 1.34, parallax: 0.92, chaos: 0.9 } },
                { id: 'ember-roots', label: 'Ember Roots', hint: 'Lower motion with softer structure for everyday use.', controls: { speed: 0.64, density: 0.78, scale: 0.92, glow: 0.82, parallax: 0.58, chaos: 0.52 } },
                { id: 'low-motion', label: 'Low Motion', hint: 'Soft ambient branching with very little visual agitation.', controls: { speed: 0.38, density: 0.68, scale: 0.9, glow: 0.72, parallax: 0.16, chaos: 0.26 } }
            ]
        },
        {
            mode: 'dandelion',
            label: 'Vault Dandelion Field',
            accent: '#f6f2c4',
            background: 'radial-gradient(circle at 50% 10%, rgba(222, 242, 188, 0.14), transparent 22%), linear-gradient(180deg, #081117 0%, #101813 44%, #060a09 100%)',
            defaults: { speed: 0.8, density: 0.7, scale: 1.04, glow: 1.06, parallax: 0.82, chaos: 0.72 },
            presets: [
                { id: 'balanced', label: 'Balanced', hint: 'A meadow of giant dandelion trees that cycles from bloom to seed.', controls: { speed: 0.8, density: 0.7, scale: 1.04, glow: 1.06, parallax: 0.82, chaos: 0.72 } },
                { id: 'spring-rise', label: 'Spring Rise', hint: 'More green growth, fuller crowns, and gentler shedding.', controls: { speed: 0.74, density: 1.08, scale: 1.08, glow: 1.0, parallax: 0.76, chaos: 0.58 } },
                { id: 'golden-hour', label: 'Golden Hour', hint: 'Longer yellow bloom phase with warmer glow.', controls: { speed: 0.86, density: 0.94, scale: 1.02, glow: 1.18, parallax: 0.88, chaos: 0.68 } },
                { id: 'seed-release', label: 'Seed Release', hint: 'The white stage lingers and more petals break away into the wind.', controls: { speed: 1.02, density: 1.06, scale: 1.1, glow: 1.14, parallax: 0.94, chaos: 0.96 } }
            ]
        }
    ];

    const defaultPresets = [
        { id: 'balanced', label: 'Balanced', hint: 'A tuned all-round starting point.', controls: fallbackControls },
        { id: 'low-motion', label: 'Low Motion', hint: 'Accessibility-first movement with reduced parallax and lower speed.', controls: { speed: 0.45, density: 0.72, scale: 0.92, glow: 0.7, parallax: 0.16, chaos: 0.28 } }
    ];

    const labExtras = [
        { mode: 'globe', label: 'Money Sign Globe', accent: '#ffd36b', pill: 'Rotating symbol sphere / cursor tilt', subtitle: 'The money globe now has more room to breathe, with orbit rings, depth sorting, and stronger tilt from mouse movement.', why: 'It turns the finance theme into a clear centerpiece instead of a hidden detail.', risk: 'If the glyph set gets too playful, it can feel less premium.', next: 'A later version could swap some symbols for provider badges or custom icons.', defaults: fallbackControls, presets: defaultPresets },
        { mode: 'graph', label: 'Market Arc Graph', accent: '#7ef0bf', pill: '3D chart field / mouse rotation', subtitle: 'The graph scene is now easier to see, with layered arcs, bars, and a mouse-tilting floor that feels more spatial.', why: 'This makes the background feel tied to finance without pretending to show real data.', risk: 'A chart can accidentally imply meaning, so it should stay stylized and clearly decorative.', next: 'We can eventually feed this with live totals from the real app for a responsive data wall.', defaults: fallbackControls, presets: defaultPresets },
        { mode: 'ticker', label: 'Money Glyph Storm', accent: '#ffb46b', pill: '3D-ish money icons / depth drift', subtitle: 'The scary text is gone. This version uses floating money symbols, coins, and cash-like emoji with pseudo-3D depth.', why: 'It keeps the fast moving storm idea without feeling ominous or text-heavy.', risk: 'Emoji rendering varies a bit by platform, so a future art pass could replace them with custom assets.', next: 'A polished version could use hand-made coin and bill sprites for an even richer look.', defaults: fallbackControls, presets: defaultPresets },
        { mode: 'objects', label: 'Object Parade', accent: '#d7b4ff', pill: '3D-ish random object storm', subtitle: 'Same motion system as the money storm, but with playful floating objects for a more surreal wallpaper direction.', why: 'It is useful as a contrast concept and proves the motion system can carry different themes.', risk: 'This is more playful than finance-focused, so it works better as a side experiment than a default.', next: 'If you like this, we can make an object set that feels more luxury-tech and less toybox.', defaults: fallbackControls, presets: defaultPresets },
        { mode: 'aurora', label: 'Aurora Glass Drift', accent: '#82eec9', pill: 'Luxury glow ribbons / soft pointer bloom', subtitle: 'This keeps the calmer premium route, but with deeper ribbons, stronger glow falloff, and cleaner composition.', why: 'It still feels polished and expensive while giving the eye a place to rest.', risk: 'Compared to the wilder scenes, it can feel restrained if the glow is too low.', next: 'This is a good candidate for a production default with the others as optional themes.', defaults: fallbackControls, presets: defaultPresets },
        { mode: 'chrome', label: 'Liquid Chrome Bloom', accent: '#d9f7ff', pill: 'Reflective blobs / metallic glare', subtitle: 'Now visible beside the shell, the chrome scene uses reflective metaball blooms and orbital light streaks instead of hiding under the app.', why: 'It feels like premium hardware and looks especially strong with the finance shell docked to the side.', risk: 'If the blob sizes are too large, the effect can flatten into generic blur.', next: 'We can push this toward mirrored silver, gold, or glass-metal hybrids next.', defaults: fallbackControls, presets: defaultPresets },
        { mode: 'dunes', label: 'Magnetic Dunes', accent: '#ffcf7f', pill: 'Pressure waves / contour glow', subtitle: 'The dunes now have more layered contour movement and stronger pointer bending while keeping the premium slower mood.', why: 'It gives motion without screaming for attention, which makes it a strong balancing concept.', risk: 'This one depends on subtlety, so too much chaos can break the calm illusion.', next: 'A future pass could add embossed depth shadows and metallic dust highlights.', defaults: fallbackControls, presets: defaultPresets },
        { mode: 'prism', label: 'Prism Storm', accent: '#9ad6ff', pill: 'Shards / beams / high-energy bloom', subtitle: 'Brighter shard sweeps, stronger edge beams, and more obvious pointer flashes make this the loudest scene in the set.', why: 'It has the most event energy and feels perfect for a dramatic showcase mode.', risk: 'It can easily become too hot visually, especially on smaller screens.', next: 'This would benefit from presets that clamp brightness automatically on mobile.', defaults: fallbackControls, presets: defaultPresets }
    ];

    function cloneControls(source) {
        const next = {};
        controlKeys.forEach(function(key) {
            next[key] = source && typeof source[key] === 'number' ? source[key] : fallbackControls[key];
        });
        return next;
    }

    function clonePreset(preset) {
        return {
            id: preset.id,
            label: preset.label,
            hint: preset.hint,
            controls: cloneControls(preset.controls)
        };
    }

    function cloneScene(scene) {
        const next = {};
        Object.keys(scene).forEach(function(key) {
            if (key === 'defaults') {
                next.defaults = cloneControls(scene.defaults);
            } else if (key === 'presets') {
                next.presets = (scene.presets || []).map(clonePreset);
            } else {
                next[key] = scene[key];
            }
        });
        return next;
    }

    function createAppSceneConfigs() {
        return appScenes.map(cloneScene);
    }

    function createLabSceneConfigs() {
        return [
            {
                mode: 'anti',
                label: 'Anti-Gravity Plexus',
                accent: '#69e3ff',
                pill: 'Mouse repulsion / electric network',
                subtitle: 'The plexus now has a more forceful antigravity core, layered charge haze, and sharper pointer shock-rings that feel closer to the Google antigravity direction.',
                why: 'This scene now reads immediately as reactive motion instead of just drifting particles, especially when you whip the cursor across the stage.',
                risk: 'The high-voltage presets can overwhelm the UI if glow and density are both pinned on smaller screens.',
                next: 'Once this lands in production, a low-motion accessibility preset would be the right companion.',
                defaults: { speed: 1.08, density: 1.16, scale: 1.06, glow: 1.22, parallax: 1.12, chaos: 1.08 },
                presets: [
                    { id: 'balanced', label: 'Balanced', hint: 'Responsive and premium without turning into noise.', controls: { speed: 1.08, density: 1.16, scale: 1.06, glow: 1.22, parallax: 1.12, chaos: 1.08 } },
                    { id: 'event-horizon', label: 'Event Horizon', hint: 'Bolder shock-rings and a more dramatic core collapse.', controls: { speed: 1.22, density: 1.32, scale: 1.12, glow: 1.55, parallax: 1.28, chaos: 1.28 } },
                    { id: 'calm-field', label: 'Calm Field', hint: 'Same spatial feel, but easier to live behind real UI.', controls: { speed: 0.82, density: 0.86, scale: 0.96, glow: 0.9, parallax: 0.7, chaos: 0.74 } },
                    { id: 'low-motion', label: 'Low Motion', hint: 'Accessibility-first motion that still preserves the scene identity.', controls: { speed: 0.52, density: 0.72, scale: 0.9, glow: 0.72, parallax: 0.22, chaos: 0.34 } }
                ]
            },
            {
                mode: 'grid',
                label: 'Neon Grid Rain',
                accent: '#6cd5ff',
                pill: 'Perspective grid / synth storm',
                subtitle: 'This pass adds a stronger horizon bloom, brighter lane beacons, and denser synth-rain so the scene feels more like a premium live wallpaper instead of a simple grid.',
                why: 'It has the clearest desktop-wallpaper identity now and feels the most theatrical without losing control.',
                risk: 'The most intense presets will compete with bright finance cards unless we clamp them slightly in the real app.',
                next: 'A future color-theme switcher would be especially valuable here because the scene is already preset-friendly.',
                defaults: { speed: 1.02, density: 1.14, scale: 1.1, glow: 1.3, parallax: 1.02, chaos: 0.96 },
                presets: [
                    { id: 'balanced', label: 'Balanced', hint: 'A bright synth storm that still leaves room for white panels.', controls: { speed: 1.02, density: 1.14, scale: 1.1, glow: 1.3, parallax: 1.02, chaos: 0.96 } },
                    { id: 'storm-run', label: 'Storm Run', hint: 'More streaks, more horizon energy, more desktop drama.', controls: { speed: 1.28, density: 1.42, scale: 1.18, glow: 1.64, parallax: 1.22, chaos: 1.14 } },
                    { id: 'night-drive', label: 'Night Drive', hint: 'Softer lane glow with a cooler cinematic depth.', controls: { speed: 0.88, density: 0.92, scale: 1.03, glow: 0.94, parallax: 0.84, chaos: 0.76 } },
                    { id: 'low-motion', label: 'Low Motion', hint: 'A calmer synth horizon that remains readable for long sessions.', controls: { speed: 0.48, density: 0.72, scale: 0.94, glow: 0.74, parallax: 0.18, chaos: 0.3 } }
                ]
            },
            {
                mode: 'trunk',
                label: 'Vault Trunk Field',
                accent: '#88f7ca',
                pill: 'Branching energy / Vanta trunk direction',
                subtitle: 'The trunks now layer glow, branch depth, and floating sparks into something that feels closer to a showpiece living sculpture than a generic branch sketch.',
                why: 'It has the most signature identity of the set, and the new glow canopy makes it feel expensive.',
                risk: 'Very high chaos settings can still get a little thorny behind dense text blocks.',
                next: 'This is ready to become a flagship production theme with just a final readability pass around app edges.',
                defaults: { speed: 0.98, density: 1.12, scale: 1.1, glow: 1.34, parallax: 0.96, chaos: 0.92 },
                presets: [
                    { id: 'balanced', label: 'Balanced', hint: 'The strongest default showpiece right now.', controls: { speed: 0.98, density: 1.12, scale: 1.1, glow: 1.34, parallax: 0.96, chaos: 0.92 } },
                    { id: 'cathedral', label: 'Cathedral', hint: 'Taller trunks, brighter nodes, and a richer canopy.', controls: { speed: 1.06, density: 1.28, scale: 1.22, glow: 1.62, parallax: 1.08, chaos: 1.06 } },
                    { id: 'ember-roots', label: 'Ember Roots', hint: 'Lower motion with softer structure for a production-friendly calm.', controls: { speed: 0.78, density: 0.9, scale: 0.98, glow: 1.0, parallax: 0.7, chaos: 0.68 } },
                    { id: 'low-motion', label: 'Low Motion', hint: 'The ambient canopy path with minimal movement and calmer branching.', controls: { speed: 0.42, density: 0.74, scale: 0.92, glow: 0.8, parallax: 0.16, chaos: 0.28 } }
                ]
            },
            {
                mode: 'trunk-copy',
                label: 'Vault Trunk Field Copy',
                accent: '#88f7ca',
                pill: 'Original duplicate / safe branch-off',
                subtitle: 'This is a direct copy of Vault Trunk Field so you can keep the original composition while exploring other variations beside it.',
                why: 'It preserves the exact branch sculpture you liked while giving you a separate slot for comparison and future tweaks.',
                risk: 'Because it matches the original intentionally, it only adds value if you want a stable duplicate.',
                next: 'This is the clean base to branch from for alternate colors, particle passes, or seasonal versions.',
                defaults: { speed: 0.98, density: 1.12, scale: 1.1, glow: 1.34, parallax: 0.96, chaos: 0.92 },
                presets: [
                    { id: 'balanced', label: 'Balanced', hint: 'An exact duplicate of the original flagship tune.', controls: { speed: 0.98, density: 1.12, scale: 1.1, glow: 1.34, parallax: 0.96, chaos: 0.92 } },
                    { id: 'cathedral', label: 'Cathedral', hint: 'Taller trunks, brighter nodes, and a richer canopy.', controls: { speed: 1.06, density: 1.28, scale: 1.22, glow: 1.62, parallax: 1.08, chaos: 1.06 } },
                    { id: 'ember-roots', label: 'Ember Roots', hint: 'Lower motion with softer structure for a production-friendly calm.', controls: { speed: 0.78, density: 0.9, scale: 0.98, glow: 1.0, parallax: 0.7, chaos: 0.68 } },
                    { id: 'low-motion', label: 'Low Motion', hint: 'The ambient canopy path with minimal movement and calmer branching.', controls: { speed: 0.42, density: 0.74, scale: 0.92, glow: 0.8, parallax: 0.16, chaos: 0.28 } }
                ]
            },
            {
                mode: 'dandelion',
                label: 'Vault Dandelion Field',
                accent: '#f6f2c4',
                pill: 'Giant dandelion grove / bloom-to-seed cycle',
                subtitle: 'This turns the field into towering dandelion forms that bloom green, warm to yellow, fade to white, and then release their seeds into the air.',
                why: 'It keeps the organic premium mood of the trunk scene but gives it a more story-driven seasonal transformation.',
                risk: 'At the highest density settings the seed fluff can get busy behind small text blocks.',
                next: 'If you like this direction, we can make spring, midsummer, and late-autumn dandelion passes as separate moods.',
                defaults: { speed: 0.94, density: 1.04, scale: 1.08, glow: 1.12, parallax: 0.9, chaos: 0.74 },
                presets: [
                    { id: 'balanced', label: 'Balanced', hint: 'A steady full-cycle dandelion grove with clear bloom transitions.', controls: { speed: 0.94, density: 1.04, scale: 1.08, glow: 1.12, parallax: 0.9, chaos: 0.74 } },
                    { id: 'spring-rise', label: 'Spring Rise', hint: 'Leans greener with fuller crowns and a calmer seed drift.', controls: { speed: 0.82, density: 1.12, scale: 1.12, glow: 1.02, parallax: 0.82, chaos: 0.58 } },
                    { id: 'golden-hour', label: 'Golden Hour', hint: 'Longer yellow phase with warmer highlights and softer motion.', controls: { speed: 0.88, density: 0.96, scale: 1.04, glow: 1.22, parallax: 0.84, chaos: 0.66 } },
                    { id: 'seed-release', label: 'Seed Release', hint: 'The white crowns linger and more seeds peel away into the wind.', controls: { speed: 1.08, density: 1.1, scale: 1.14, glow: 1.18, parallax: 0.98, chaos: 1.0 } }
                ]
            }
        ].map(cloneScene).concat(labExtras.map(cloneScene));
    }

    window.FinanceBackgroundScenes = {
        controlKeys: controlKeys.slice(),
        fallbackControls: cloneControls(fallbackControls),
        defaultPresets: defaultPresets.map(clonePreset),
        cloneControls: cloneControls,
        createAppSceneConfigs: createAppSceneConfigs,
        createLabSceneConfigs: createLabSceneConfigs
    };
})();
