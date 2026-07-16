/**
 * CS2 Config Visualizer & Generator
 * Counter-Strike/cs2-config.js
 */

/* ==========================================================================
   KEY TRANSLATION MAP  (e.code → CS2 bind key string)
   ========================================================================== */
const CODE_TO_CS2 = {
  KeyA: 'a', KeyB: 'b', KeyC: 'c', KeyD: 'd', KeyE: 'e', KeyF: 'f',
  KeyG: 'g', KeyH: 'h', KeyI: 'i', KeyJ: 'j', KeyK: 'k', KeyL: 'l',
  KeyM: 'm', KeyN: 'n', KeyO: 'o', KeyP: 'p', KeyQ: 'q', KeyR: 'r',
  KeyS: 's', KeyT: 't', KeyU: 'u', KeyV: 'v', KeyW: 'w', KeyX: 'x',
  KeyY: 'y', KeyZ: 'z',
  Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
  Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',
  F1: 'f1', F2: 'f2', F3: 'f3', F4: 'f4', F5: 'f5', F6: 'f6',
  F7: 'f7', F8: 'f8', F9: 'f9', F10: 'f10', F11: 'f11', F12: 'f12',
  Space: 'space',
  ShiftLeft: 'shift', ShiftRight: 'rshift',
  ControlLeft: 'ctrl', ControlRight: 'rctrl',
  AltLeft: 'alt', AltRight: 'ralt',
  Tab: 'tab',
  CapsLock: 'capslock',
  Backspace: 'backspace',
  Enter: 'enter',
  Escape: 'escape',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  ArrowUp: 'uparrow', ArrowDown: 'downarrow',
  ArrowLeft: 'leftarrow', ArrowRight: 'rightarrow',
  Insert: 'ins', Delete: 'del',
  Home: 'home', End: 'end',
  PageUp: 'pgup', PageDown: 'pgdn',
  PrintScreen: 'printscr',
  ScrollLock: 'scrolllock',
  Pause: 'break',
  Numpad0: 'kp_0', Numpad1: 'kp_1', Numpad2: 'kp_2', Numpad3: 'kp_3',
  Numpad4: 'kp_4', Numpad5: 'kp_5', Numpad6: 'kp_6', Numpad7: 'kp_7',
  Numpad8: 'kp_8', Numpad9: 'kp_9',
  NumpadDecimal: 'kp_period',
  NumpadEnter: 'kp_enter',
  NumpadAdd: 'kp_plus',
  NumpadSubtract: 'kp_minus',
  NumpadMultiply: 'kp_multiply',
  NumpadDivide: 'kp_slash',
  NumLock: 'numlock',
};

// Mouse pseudo-keys (not real e.code values — displayed separately as chips)
const MOUSE_KEYS = [
  { id: 'MOUSE1', label: 'M1', description: 'Left Click' },
  { id: 'MOUSE2', label: 'M2', description: 'Right Click' },
  { id: 'MOUSE3', label: 'M3', description: 'Middle Click' },
  { id: 'MOUSE4', label: 'M4', description: 'Side Back' },
  { id: 'MOUSE5', label: 'M5', description: 'Side Fwd' },
  { id: 'mwheelup', label: 'MWU', description: 'Scroll Up' },
  { id: 'mwheeldown', label: 'MWD', description: 'Scroll Down' },
];

/* ==========================================================================
   CS2 COMMAND DATABASE
   requiresCheats = true means blocked in autoexec profile
   ========================================================================== */
const CS2_COMMANDS = [
  // --- Movement ---
  { id: 'fwd',       label: 'Move Forward',         command: '+forward',   description: 'Move forward (W)', category: 'Movement', requiresCheats: false },
  { id: 'back',      label: 'Move Backward',         command: '+back',      description: 'Move backward (S)', category: 'Movement', requiresCheats: false },
  { id: 'left',      label: 'Strafe Left',           command: '+moveleft',  description: 'Strafe left (A)', category: 'Movement', requiresCheats: false },
  { id: 'right',     label: 'Strafe Right',          command: '+moveright', description: 'Strafe right (D)', category: 'Movement', requiresCheats: false },
  { id: 'jump',      label: 'Jump',                  command: '+jump',      description: 'Jump', category: 'Movement', requiresCheats: false },
  { id: 'duck',      label: 'Crouch',                command: '+duck',      description: 'Crouch / duck', category: 'Movement', requiresCheats: false },
  { id: 'walk',      label: 'Walk (Silent)',         command: '+sprint',    description: 'Walk silently (hold Shift)', category: 'Movement', requiresCheats: false },
  { id: 'ping',      label: 'Map Ping',              command: 'player_ping',description: 'Ping a location on the minimap', category: 'Movement', requiresCheats: false },
  // --- Weapons / Combat ---
  { id: 'fire',      label: 'Primary Fire',          command: '+attack',    description: 'Primary fire (Mouse 1)', category: 'Combat', requiresCheats: false },
  { id: 'fire2',     label: 'Secondary Fire / Scope',command: '+attack2',   description: 'Secondary fire or scope (Mouse 2)', category: 'Combat', requiresCheats: false },
  { id: 'reload',    label: 'Reload',                command: '+reload',    description: 'Reload current weapon', category: 'Combat', requiresCheats: false },
  { id: 'lastinv',   label: 'Last Weapon',           command: 'lastinv',   description: 'Switch to last used weapon (Q)', category: 'Combat', requiresCheats: false },
  { id: 'slot1',     label: 'Primary (Slot 1)',       command: 'slot1',     description: 'Select primary weapon', category: 'Combat', requiresCheats: false },
  { id: 'slot2',     label: 'Secondary (Slot 2)',     command: 'slot2',     description: 'Select pistol', category: 'Combat', requiresCheats: false },
  { id: 'slot3',     label: 'Melee (Slot 3)',         command: 'slot3',     description: 'Select knife', category: 'Combat', requiresCheats: false },
  { id: 'slot10',    label: 'Bomb / C4 (Slot 10)',   command: 'slot10',    description: 'Select bomb / C4', category: 'Combat', requiresCheats: false },
  { id: 'drop',      label: 'Drop Weapon',           command: 'drop',      description: 'Drop current weapon', category: 'Combat', requiresCheats: false },
  { id: 'dropnade',  label: 'Drop Grenade (quick)',  command: 'slot4; drop', description: 'Switch to grenades then drop', category: 'Combat', requiresCheats: false },
  { id: 'inspect',   label: 'Inspect Weapon',        command: '+lookatweapon', description: 'Inspect weapon animation', category: 'Combat', requiresCheats: false },
  { id: 'zoom',      label: 'Zoom / Scope',          command: '+zoom',     description: 'Zoom or scope in', category: 'Combat', requiresCheats: false },
  { id: 'use',       label: 'Use / Plant / Defuse',  command: '+use',      description: 'Interact, plant bomb, defuse (E)', category: 'Combat', requiresCheats: false },
  // --- Grenades ---
  { id: 'henade',    label: 'HE Grenade (Slot 6)',   command: 'slot6',     description: 'Select HE grenade', category: 'Grenades', requiresCheats: false },
  { id: 'flash',     label: 'Flashbang (Slot 7)',    command: 'slot7',     description: 'Select flashbang', category: 'Grenades', requiresCheats: false },
  { id: 'smoke',     label: 'Smoke (Slot 8)',        command: 'slot8',     description: 'Select smoke grenade (Down arrow in Owen\'s config)', category: 'Grenades', requiresCheats: false },
  { id: 'molly',     label: 'Molotov / Incendiary (Slot 9)', command: 'slot9', description: 'Select molotov or incendiary', category: 'Grenades', requiresCheats: false },
  { id: 'decoy',     label: 'Decoy (Slot 10)',       command: 'slot10',    description: 'Select decoy grenade', category: 'Grenades', requiresCheats: false },
  { id: 'nadeprev',  label: 'Grenade Preview Toggle', command: 'toggle cl_grenadepreview 0 1', description: 'Toggle grenade trajectory preview', category: 'Grenades', requiresCheats: false },
  // --- Buy Binds ---
  { id: 'buy-ak',    label: 'Buy AK-47',             command: 'buy ak47',  description: 'Buy AK-47 (T side)', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-m4a1',  label: 'Buy M4A1-S',            command: 'buy m4a1',  description: 'Buy M4A1-S (CT side)', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-m4a4',  label: 'Buy M4A4',              command: 'buy m4a4',  description: 'Buy M4A4 (CT side)', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-awp',   label: 'Buy AWP',               command: 'buy awp',   description: 'Buy AWP sniper rifle', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-sg',    label: 'Buy SG 553',            command: 'buy sg556', description: 'Buy SG 553 (krieg)', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-aug',   label: 'Buy AUG',               command: 'buy aug',   description: 'Buy AUG (CT rifle)', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-deagle',label: 'Buy Deagle',            command: 'buy deagle',description: 'Buy Desert Eagle', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-fbang', label: 'Buy Flashbang',         command: 'buy flashbang', description: 'Buy flashbang grenade', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-smoke', label: 'Buy Smoke',             command: 'buy smokegrenade', description: 'Buy smoke grenade', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-he',    label: 'Buy HE Grenade',        command: 'buy hegrenade', description: 'Buy HE grenade', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-molotov', label: 'Buy Molotov',         command: 'buy molotov', description: 'Buy molotov (T side)', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-incgren', label: 'Buy Incendiary',      command: 'buy incgrenade', description: 'Buy incendiary grenade (CT side)', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-decoy', label: 'Buy Decoy',             command: 'buy decoy', description: 'Buy decoy grenade', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-vest',  label: 'Buy Kevlar',            command: 'buy kevlar', description: 'Buy Kevlar vest', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-vesthelm', label: 'Buy Kevlar + Helmet', command: 'buy vesthelm', description: 'Buy Kevlar and Helmet', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-defuser', label: 'Buy Defuse Kit',      command: 'buy defuser', description: 'Buy defuse kit (CT only)', category: 'Buy Binds', requiresCheats: false },
  { id: 'buy-zeus',  label: 'Buy Zeus / Taser',      command: 'buy taser', description: 'Buy Zeus x27 taser', category: 'Buy Binds', requiresCheats: false },
  // --- HUD / Communication ---
  { id: 'radar-toggle', label: 'Toggle Radar Zoom', command: 'toggle cl_radar_scale 1 0.3', description: 'Toggle radar between zoomed in and full map', category: 'HUD / View', requiresCheats: false },
  { id: 'xhair-cycle', label: 'Cycle Crosshair Color', command: 'toggle cl_crosshaircolor 0 1 2 3 4 5', description: 'Cycle through all crosshair colors in game', category: 'HUD / View', requiresCheats: false },
  { id: 'hud-toggle', label: 'Toggle HUD',           command: 'toggle cl_drawhud', description: 'Hide or show the entire HUD', category: 'HUD / View', requiresCheats: false },
  { id: 'radar-only', label: 'Toggle Radar Only',   command: 'toggle cl_drawhud_force_radar -1 0', description: 'Show or hide only the radar (keep rest of HUD)', category: 'HUD / View', requiresCheats: false },
  { id: 'console',   label: 'Open Console',          command: 'toggleconsole', description: 'Open or close the developer console', category: 'HUD / View', requiresCheats: false },
  { id: 'scores',    label: 'Scoreboard',            command: '+showscores', description: 'Hold to show scoreboard (Tab)', category: 'HUD / View', requiresCheats: false },
  { id: 'allchat',   label: 'All Chat',              command: 'messagemode', description: 'Open all-chat text input (Y)', category: 'HUD / View', requiresCheats: false },
  { id: 'teamchat',  label: 'Team Chat',             command: 'messagemode2', description: 'Open team-chat text input (U)', category: 'HUD / View', requiresCheats: false },
  { id: 'radio1',    label: 'Radio Wheel 1',         command: '+radialradio', description: 'Open primary radio command wheel', category: 'HUD / View', requiresCheats: false },
  { id: 'radio2',    label: 'Radio Wheel 2',         command: '+radialradio2', description: 'Open secondary radio command wheel', category: 'HUD / View', requiresCheats: false },
  { id: 'mic',       label: 'Push to Talk',          command: '+voicerecord', description: 'Push-to-talk voice (V)', category: 'HUD / View', requiresCheats: false },
  { id: 'lockscam',  label: 'Lock Camera',           command: 'toggle cl_lock_camera', description: 'Lock/unlock free camera position (demo use)', category: 'HUD / View', requiresCheats: false },
  { id: 'pred-dmg',  label: 'Toggle Predicted Dmg', command: 'toggle cl_show_predicted_damage 0 1', description: 'Show or hide predicted damage number on screen', category: 'HUD / View', requiresCheats: false },
  // --- Practice / Cheats ---
  { id: 'noclip',    label: 'Noclip (fly)',           command: 'noclip',    description: 'Toggle noclip fly mode (Alt in Owen\'s practice config)', category: 'Practice', requiresCheats: true },
  { id: 'god',       label: 'God Mode (invincible)', command: 'god',       description: 'Toggle invincibility', category: 'Practice', requiresCheats: true },
  { id: 'svcheats',  label: 'Enable sv_cheats',      command: 'sv_cheats 1', description: 'Enable cheat commands on the server', category: 'Practice', requiresCheats: true },
  { id: 'infammo1',  label: 'Infinite Ammo (no reload)', command: 'sv_infinite_ammo 1', description: 'Infinite ammo, no reload required', category: 'Practice', requiresCheats: true },
  { id: 'infammo2',  label: 'Infinite Ammo (with reload)', command: 'sv_infinite_ammo 2', description: 'Ammo refills automatically on reload', category: 'Practice', requiresCheats: true },
  { id: 'give-flash',label: 'Give Flashbang',        command: 'give weapon_flashbang', description: 'Give yourself a flashbang', category: 'Practice', requiresCheats: true },
  { id: 'give-smoke',label: 'Give Smoke',            command: 'give weapon_smokegrenade', description: 'Give yourself a smoke grenade', category: 'Practice', requiresCheats: true },
  { id: 'give-he',   label: 'Give HE Grenade',       command: 'give weapon_hegrenade', description: 'Give yourself an HE grenade', category: 'Practice', requiresCheats: true },
  { id: 'give-molly',label: 'Give Molotov',          command: 'give weapon_molotov', description: 'Give yourself a molotov', category: 'Practice', requiresCheats: true },
  { id: 'give-ak',   label: 'Give AK-47',            command: 'give weapon_ak47', description: 'Give yourself an AK-47', category: 'Practice', requiresCheats: true },
  { id: 'give-all',  label: 'Give All Util + AK',   command: 'give weapon_flashbang; give weapon_molotov; give weapon_hegrenade; give weapon_smokegrenade; give weapon_ak47', description: 'Give flashbang, molotov, HE, smoke, and AK-47 (Owen\'s practice bind on O)', category: 'Practice', requiresCheats: true },
  { id: 'rethrow',   label: 'Rethrow Last Grenade',  command: 'sv_rethrow_last_grenade', description: 'Rethrow the last grenade you threw (N in Owen\'s config)', category: 'Practice', requiresCheats: true },
  { id: 'botadd',    label: 'Add Bot',               command: 'bot_add',   description: 'Add a bot to the server (J in Owen\'s config)', category: 'Practice', requiresCheats: true },
  { id: 'botkick',   label: 'Kick All Bots',         command: 'bot_kick',  description: 'Remove all bots from the server', category: 'Practice', requiresCheats: true },
  { id: 'botplace',  label: 'Place Bot at Crosshair', command: 'bot_place', description: 'Place a bot at your crosshair position (M in Owen\'s config)', category: 'Practice', requiresCheats: true },
  { id: 'botstop',   label: 'Toggle Bot Stop',       command: 'toggle bot_stop 1 2', description: 'Freeze or unfreeze bots (K in Owen\'s config)', category: 'Practice', requiresCheats: true },
  { id: 'botmimic',  label: 'Toggle Bot Mimic',      command: 'toggle bot_mimic 0 1 2', description: 'Toggle bot mimic behavior (L in Owen\'s config)', category: 'Practice', requiresCheats: true },
  { id: 'third',     label: 'Third Person View',     command: 'thirdperson', description: 'Switch to third-person view (= in Owen\'s config)', category: 'Practice', requiresCheats: true },
  { id: 'first',     label: 'First Person View',     command: 'firstperson', description: 'Return to first-person view (- in Owen\'s config)', category: 'Practice', requiresCheats: true },
  { id: 'restart',   label: 'Restart Round',         command: 'mp_restartgame 1', description: 'Immediately restart the current game/round', category: 'Practice', requiresCheats: true },
  { id: 'warmup-end',label: 'End Warmup',            command: 'mp_warmup_end', description: 'End the warmup phase immediately', category: 'Practice', requiresCheats: true },
  { id: 'impacts',   label: 'Show Bullet Impacts',   command: 'toggle sv_showimpacts 0 1 2', description: 'Toggle bullet impact markers on surfaces', category: 'Practice', requiresCheats: true },
  { id: 'nade-traj', label: 'Grenade Trajectory',    command: 'toggle sv_grenade_trajectory 0 1', description: 'Toggle grenade trajectory line overlay', category: 'Practice', requiresCheats: true },
  { id: 'castray',   label: 'Cast Debug Ray',        command: 'cast_ray',  description: 'Cast a debug ray from your crosshair', category: 'Practice', requiresCheats: true },
  // --- Demo Controls ---
  { id: 'demo-pause', label: 'Demo Play / Pause',    command: 'demo_togglepause', description: 'Toggle demo playback pause (Right Alt in Owen\'s config)', category: 'Demo Controls', requiresCheats: false },
  { id: 'demo-rw15', label: 'Rewind 15 Seconds',     command: 'demo_gototick -480 relative', description: 'Jump back ~15 seconds in the demo (Home in Owen\'s config)', category: 'Demo Controls', requiresCheats: false },
  { id: 'demo-ff15', label: 'Fast Forward 15 Sec',   command: 'demo_gototick +480 relative', description: 'Jump forward ~15 seconds (Right Ctrl in Owen\'s config)', category: 'Demo Controls', requiresCheats: false },
  { id: 'demo-rw60', label: 'Rewind 60 Seconds',     command: 'demo_gototick -1920 relative', description: 'Jump back ~60 seconds in the demo', category: 'Demo Controls', requiresCheats: false },
  { id: 'demo-ff60', label: 'Fast Forward 60 Sec',   command: 'demo_gototick +1920 relative', description: 'Jump forward ~60 seconds', category: 'Demo Controls', requiresCheats: false },
  { id: 'demo-025',  label: 'Demo Speed 0.25x',      command: 'demo_timescale 0.25', description: 'Set demo playback to quarter speed', category: 'Demo Controls', requiresCheats: false },
  { id: 'demo-05',   label: 'Demo Speed 0.5x',       command: 'demo_timescale 0.5', description: 'Set demo playback to half speed', category: 'Demo Controls', requiresCheats: false },
  { id: 'demo-1',    label: 'Demo Speed 1x (normal)', command: 'demo_timescale 1', description: 'Set demo playback to normal speed', category: 'Demo Controls', requiresCheats: false },
  { id: 'demo-2',    label: 'Demo Speed 2x',         command: 'demo_timescale 2', description: 'Set demo playback to 2x speed', category: 'Demo Controls', requiresCheats: false },
  { id: 'demo-4',    label: 'Demo Speed 4x',         command: 'demo_timescale 4', description: 'Fast forward demo at 4x speed', category: 'Demo Controls', requiresCheats: false },
  { id: 'demo-10',   label: 'Demo Speed 10x',        command: 'demo_timescale 10', description: 'Fast forward demo at 10x speed', category: 'Demo Controls', requiresCheats: false },
  { id: 'xray',      label: 'Toggle X-Ray Wallhack', command: 'toggle spec_show_xray', description: 'Toggle X-ray wallhack for spectating (/ in Owen\'s config)', category: 'Demo Controls', requiresCheats: false },
  { id: 'spec-mode', label: 'Cycle Spectator Mode',  command: 'spec_mode', description: 'Cycle through spectator view modes', category: 'Demo Controls', requiresCheats: false },
  { id: 'spec-next', label: 'Next Spectator Target', command: 'spec_next', description: 'Spectate next player', category: 'Demo Controls', requiresCheats: false },
  { id: 'spec-prev', label: 'Prev Spectator Target', command: 'spec_prev', description: 'Spectate previous player', category: 'Demo Controls', requiresCheats: false },
  // --- Hidden / Useful ---
  { id: 'advert',    label: 'Allow Friends to Join', command: 'cl_join_advertise 2', description: 'Allow friends to see and join your private lobby', category: 'Misc / Hidden', requiresCheats: false },
  { id: 'clear',     label: 'Clear Console',         command: 'clear',     description: 'Clear the developer console output', category: 'Misc / Hidden', requiresCheats: false },
  { id: 'wiremod',   label: 'Toggle Wireframe',      command: 'toggle mat_wireframe 0 1', description: 'Toggle wireframe rendering (cheat)', category: 'Misc / Hidden', requiresCheats: true },
  { id: 'xmodels',   label: 'Toggle Enemy Wireframes', command: 'toggle r_drawothermodels 1 2', description: 'Toggle visible enemy wireframes through walls (cheat)', category: 'Misc / Hidden', requiresCheats: true },
];

/* Categories (ordered) */
const CATEGORIES = ['Movement', 'Combat', 'Grenades', 'Buy Binds', 'HUD / View', 'Practice', 'Demo Controls', 'Misc / Hidden'];

/* ==========================================================================
   POPULAR KEY SUGGESTIONS
   ========================================================================== */
const POPULAR_SUGGESTIONS = {
  space:     ['+duck', '+jump'],
  mwheelup:  ['+jump', '+attack'],
  mwheeldown:['+duck', '+attack'],
  q:         ['lastinv'],
  alt:       ['noclip'],
  e:         ['+use'],
  v:         ['+voicerecord'],
  tab:       ['+showscores', 'toggleconsole'],
  '`':       ['toggleconsole'],
  f:         ['+use', '+lookatweapon'],
  g:         ['drop'],
  r:         ['+reload'],
  z:         ['+use'],
  x:         ['player_ping'],
  y:         ['messagemode'],
  u:         ['messagemode2'],
  '[':       ['+radialradio'],
  ']':       ['+radialradio2'],
  ralt:      ['demo_togglepause'],
  home:      ['demo_gototick -480 relative'],
  rctrl:     ['demo_gototick +480 relative'],
  '/':       ['toggle spec_show_xray'],
  '-':       ['firstperson'],
  '=':       ['thirdperson'],
  '6':       ['slot4; drop'],
  down:      ['slot8'],
  MOUSE5:    ['slot10'],
  n:         ['sv_rethrow_last_grenade'],
  m:         ['bot_place'],
  o:         ['give weapon_flashbang; give weapon_molotov; give weapon_hegrenade; give weapon_smokegrenade; give weapon_ak47'],
  j:         ['bot_add'],
  k:         ['toggle bot_stop 1 2'],
  l:         ['toggle bot_mimic 0 1 2'],
  "'":       ['sv_rethrow_last_grenade'],
  ';':       ['toggle cl_radar_scale 1 0.3'],
  backspace: ['toggle cl_drawhud'],
  rshift:    ['toggle cl_drawhud_force_radar -1 0'],
  p:         ['toggle cl_lock_camera'],
  'kp_1':   ['demo_timescale 0.25', 'buy ak47'],
  'kp_2':   ['demo_timescale 0.5', 'buy awp'],
  'kp_5':   ['demo_timescale 1'],
  'kp_7':   ['demo_timescale 2'],
  'kp_9':   ['demo_timescale 4'],
};

/* ==========================================================================
   DEFAULT PROFILES  (seeded from Owen's real configs)
   ========================================================================== */
const CHEATS_COMMANDS = new Set(CS2_COMMANDS.filter(c => c.requiresCheats).map(c => c.command));
// Also check if a bind *contains* a cheat command
function bindRequiresCheats(bindStr) {
  if (!bindStr) return false;
  const parts = bindStr.split(';').map(s => s.trim());
  return parts.some(part => {
    return CS2_COMMANDS.some(c => c.requiresCheats && part.startsWith(c.command.split(' ')[0]) && part.startsWith(c.command.substring(0, Math.min(part.length, c.command.length))));
  });
}

const DEFAULT_PROFILES = {
  autoexec: {
    name: 'autoexec',
    displayName: 'Gameplay (autoexec)',
    binds: {
      mwheelup: '+jump',
      v: '+voicerecord',
      space: '+duck',
      q: 'lastinv',
      downarrow: 'slot8',
      MOUSE5: 'slot10',
      u: 'messagemode2',
      x: 'player_ping',
      y: 'messagemode',
      '6': 'slot4; drop',
      '.': 'toggle cl_crosshaircolor 0 1 2 3 4 5',
    },
    extraConfig: `fps_max "999"
rate "1000000"
sensitivity "1.25"
zoom_sensitivity_ratio "1"
cl_allow_animated_avatars "0"
cl_showloadout "1"
cl_show_predicted_damage "0"
viewmodel_fov "68"
viewmodel_offset_x "2.5"
viewmodel_offset_y "0"
viewmodel_offset_z "-1.5"
viewmodel_presetpos "2"
cl_hud_radar_scale "1.300000"
cl_radar_scale "0.300000"
cl_radar_icon_scale_min "0.400000"
cl_radar_always_centered "false"
cl_radar_rotate "true"
r_drawtracers_firstperson "0"
safezonex "0.800000"
safezoney "0.900000"
clear`,
    extraScripts: '',
  },
  practice: {
    name: 'practice',
    displayName: 'Practice',
    binds: {
      alt:       'noclip',
      o:         'give weapon_flashbang; give weapon_molotov; give weapon_hegrenade; give weapon_smokegrenade; give weapon_ak47',
      ';':       'toggle cl_radar_scale 1 0.3',
      x:         'player_ping',
      y:         'messagemode',
      '[':       '+radialradio',
      ']':       '+radialradio2',
      '\\':      'toggleconsole',
      m:         'bot_place',
      n:         'sv_rethrow_last_grenade',
      '=':       'thirdperson',
      '-':       'firstperson',
      p:         'toggle cl_lock_camera',
      backspace: 'toggle cl_drawhud',
      ralt:      'demo_togglepause',
      home:      'demo_gototick -480 relative',
      rctrl:     'demo_gototick +480 relative',
      '/':       'toggle spec_show_xray',
      rshift:    'toggle cl_drawhud_force_radar -1 0',
      j:         'bot_add',
      k:         'toggle bot_stop 1 2',
      l:         'toggle bot_mimic 0 1 2',
      "'":       'sv_rethrow_last_grenade',
    },
    extraConfig: `cl_versus_intro "false"
mp_team_intro_time "0"
sv_cheats "1"
mp_limitteams "0"
mp_autoteambalance "0"
mp_maxmoney "60000"
mp_startmoney "60000"
mp_buytime "9999"
mp_buy_anywhere "1"
mp_freezetime "0"
mp_roundtime "60"
mp_roundtime_defuse "60"
mp_respawn_on_death_ct "1"
mp_respawn_on_death_t "1"
sv_infinite_ammo "1"
sv_grenade_trajectory "1"
sv_grenade_trajectory_prac_pipreview "true"
sv_grenade_trajectory_prac_trailtime "15"
sv_grenade_trajectory_time_spectator "15"
sv_grenade_trajectory_time "15"
ammo_grenade_limit_total "5"
bot_kick
bot_stop "1"
mp_warmup_end
mp_restartgame "1"`,
    extraScripts: '',
  },
  demo: {
    name: 'demo',
    displayName: 'Demo Controls',
    binds: {
      ralt:      'demo_togglepause',
      home:      'demo_gototick -480 relative',
      rctrl:     'demo_gototick +480 relative',
      '/':       'toggle spec_show_xray',
      rshift:    'toggle cl_drawhud_force_radar -1 0',
      p:         'toggle cl_lock_camera',
      backspace: 'toggle cl_drawhud',
      kp_1:      'demo_timescale 0.25',
      kp_2:      'demo_timescale 0.5',
      kp_5:      'demo_timescale 1',
      kp_7:      'demo_timescale 2',
      kp_9:      'demo_timescale 4',
    },
    extraConfig: '',
    extraScripts: '',
  },
};

/* ==========================================================================
   KEYBOARD LAYOUT DEFINITIONS
   Each key: { code, label, width (in u), isSpecial }
   width: 1 = 1u, 1.5 = 1.5u, etc.
   ========================================================================== */
function makeRow(keys) { return keys; }

const LAYOUTS = {
  '60pct': buildLayout60(),
  '65pct': buildLayout65(),
  '75pct': buildLayout75(),
  'tkl':   buildLayoutTKL(),
  '60split': buildLayout60Split(),
};

function buildLayout60() {
  return {
    name: '60%',
    rows: [
      makeRow([
        { code: 'Backquote', cs2: '`', label: '`' },
        { code: 'Digit1', cs2: '1', label: '1' }, { code: 'Digit2', cs2: '2', label: '2' },
        { code: 'Digit3', cs2: '3', label: '3' }, { code: 'Digit4', cs2: '4', label: '4' },
        { code: 'Digit5', cs2: '5', label: '5' }, { code: 'Digit6', cs2: '6', label: '6' },
        { code: 'Digit7', cs2: '7', label: '7' }, { code: 'Digit8', cs2: '8', label: '8' },
        { code: 'Digit9', cs2: '9', label: '9' }, { code: 'Digit0', cs2: '0', label: '0' },
        { code: 'Minus', cs2: '-', label: '-' }, { code: 'Equal', cs2: '=', label: '=' },
        { code: 'Backspace', cs2: 'backspace', label: '⌫', width: 2 },
      ]),
      makeRow([
        { code: 'Tab', cs2: 'tab', label: 'Tab', width: 1.5 },
        { code: 'KeyQ', cs2: 'q', label: 'Q' }, { code: 'KeyW', cs2: 'w', label: 'W' },
        { code: 'KeyE', cs2: 'e', label: 'E' }, { code: 'KeyR', cs2: 'r', label: 'R' },
        { code: 'KeyT', cs2: 't', label: 'T' }, { code: 'KeyY', cs2: 'y', label: 'Y' },
        { code: 'KeyU', cs2: 'u', label: 'U' }, { code: 'KeyI', cs2: 'i', label: 'I' },
        { code: 'KeyO', cs2: 'o', label: 'O' }, { code: 'KeyP', cs2: 'p', label: 'P' },
        { code: 'BracketLeft', cs2: '[', label: '[' }, { code: 'BracketRight', cs2: ']', label: ']' },
        { code: 'Backslash', cs2: '\\', label: '\\', width: 1.5 },
      ]),
      makeRow([
        { code: 'CapsLock', cs2: 'capslock', label: 'Caps', width: 1.75 },
        { code: 'KeyA', cs2: 'a', label: 'A' }, { code: 'KeyS', cs2: 's', label: 'S' },
        { code: 'KeyD', cs2: 'd', label: 'D' }, { code: 'KeyF', cs2: 'f', label: 'F' },
        { code: 'KeyG', cs2: 'g', label: 'G' }, { code: 'KeyH', cs2: 'h', label: 'H' },
        { code: 'KeyJ', cs2: 'j', label: 'J' }, { code: 'KeyK', cs2: 'k', label: 'K' },
        { code: 'KeyL', cs2: 'l', label: 'L' }, { code: 'Semicolon', cs2: ';', label: ';' },
        { code: 'Quote', cs2: "'", label: "'" },
        { code: 'Enter', cs2: 'enter', label: 'Enter', width: 2.25 },
      ]),
      makeRow([
        { code: 'ShiftLeft', cs2: 'shift', label: 'Shift', width: 2.25 },
        { code: 'KeyZ', cs2: 'z', label: 'Z' }, { code: 'KeyX', cs2: 'x', label: 'X' },
        { code: 'KeyC', cs2: 'c', label: 'C' }, { code: 'KeyV', cs2: 'v', label: 'V' },
        { code: 'KeyB', cs2: 'b', label: 'B' }, { code: 'KeyN', cs2: 'n', label: 'N' },
        { code: 'KeyM', cs2: 'm', label: 'M' }, { code: 'Comma', cs2: ',', label: ',' },
        { code: 'Period', cs2: '.', label: '.' }, { code: 'Slash', cs2: '/', label: '/' },
        { code: 'ShiftRight', cs2: 'rshift', label: 'Shift', width: 2.75 },
      ]),
      makeRow([
        { code: 'ControlLeft', cs2: 'ctrl', label: 'Ctrl', width: 1.25 },
        { code: null, cs2: null, label: 'Win', width: 1.25, isInert: true },
        { code: 'AltLeft', cs2: 'alt', label: 'Alt', width: 1.25 },
        { code: 'Space', cs2: 'space', label: 'Space', width: 6.25 },
        { code: 'AltRight', cs2: 'ralt', label: 'Alt', width: 1.25 },
        { code: null, cs2: null, label: 'Menu', width: 1.25, isInert: true },
        { code: 'ControlRight', cs2: 'rctrl', label: 'Ctrl', width: 1.5 },
      ]),
    ],
  };
}

function buildLayout65() {
  const base = buildLayout60();
  // Add right cluster column to bottom 4 rows
  // Row 0: Insert at end
  base.rows[0].push({ code: 'Delete', cs2: 'del', label: 'Del' });
  // Row 1: PgUp
  base.rows[1].push({ code: 'PageUp', cs2: 'pgup', label: 'PgUp' });
  // Row 2: PgDn
  base.rows[2].push({ code: 'PageDown', cs2: 'pgdn', label: 'PgDn' });
  // Row 3: right shift shorter + End
  base.rows[3][base.rows[3].length - 1] = { code: 'ShiftRight', cs2: 'rshift', label: 'Shift', width: 1.75 };
  base.rows[3].push({ code: 'End', cs2: 'end', label: 'End' });
  // Row 4: arrows
  base.rows[4][base.rows[4].length - 1] = { code: 'ControlRight', cs2: 'rctrl', label: 'Ctrl', width: 1.25 };
  base.rows[4].push(
    { code: 'ArrowLeft', cs2: 'leftarrow', label: '←' },
    { code: 'ArrowDown', cs2: 'downarrow', label: '↓' },
    { code: 'ArrowRight', cs2: 'rightarrow', label: '→' },
  );
  // Add ArrowUp above arrows in row 3
  base.rows[3].push({ code: 'ArrowUp', cs2: 'uparrow', label: '↑' });
  base.name = '65%';
  return base;
}

function buildLayout75() {
  const base = buildLayout65();
  const fRow = makeRow([
    { code: 'Escape', cs2: 'escape', label: 'Esc' },
    { code: 'F1', cs2: 'f1', label: 'F1' }, { code: 'F2', cs2: 'f2', label: 'F2' },
    { code: 'F3', cs2: 'f3', label: 'F3' }, { code: 'F4', cs2: 'f4', label: 'F4' },
    { code: 'F5', cs2: 'f5', label: 'F5' }, { code: 'F6', cs2: 'f6', label: 'F6' },
    { code: 'F7', cs2: 'f7', label: 'F7' }, { code: 'F8', cs2: 'f8', label: 'F8' },
    { code: 'F9', cs2: 'f9', label: 'F9' }, { code: 'F10', cs2: 'f10', label: 'F10' },
    { code: 'F11', cs2: 'f11', label: 'F11' }, { code: 'F12', cs2: 'f12', label: 'F12' },
    { code: 'Delete', cs2: 'del', label: 'Del' },
  ]);
  base.rows.unshift(fRow);
  base.name = '75%';
  return base;
}

function buildLayoutTKL() {
  const base = buildLayout75();
  // Add nav cluster after F-row
  base.rows[0].push(
    { code: 'PrintScreen', cs2: 'printscr', label: 'PrtSc' },
    { code: 'ScrollLock', cs2: 'scrolllock', label: 'ScLk' },
    { code: 'Pause', cs2: 'break', label: 'Pause' },
  );
  // Add full nav cluster
  base.rows[1].push({ code: 'Insert', cs2: 'ins', label: 'Ins' }, { code: 'Home', cs2: 'home', label: 'Home' }, { code: 'PageUp', cs2: 'pgup', label: 'PgUp' });
  base.rows[2].push({ code: 'Delete', cs2: 'del', label: 'Del' }, { code: 'End', cs2: 'end', label: 'End' }, { code: 'PageDown', cs2: 'pgdn', label: 'PgDn' });
  base.name = 'TKL (80%)';
  return base;
}

function buildLayout60Split() {
  const base = buildLayout60();
  // Split the space bar row
  const spaceRow = base.rows[4];
  const spaceIdx = spaceRow.findIndex(k => k.cs2 === 'space');
  spaceRow.splice(spaceIdx, 1,
    { code: 'Space', cs2: 'space', label: 'Space', width: 2.75 },
    { code: null, cs2: null, label: '', width: 0.5, isInert: true },
    { code: null, cs2: 'mwheeldown', label: 'Spc2', width: 2.75, isVirtual: true, cs2Override: 'mwheeldown' },
  );
  base.name = '60% Split Space';
  return base;
}

/* ==========================================================================
   STATE MANAGEMENT
   ========================================================================== */
const STORAGE_KEY = 'owenminercs_cs2_profiles';

let state = {
  activeLayout: '60pct',
  activeProfile: 'autoexec',
  captureMode: false,
  selectedKey: null,
  searchQuery: '',
  searchCategory: 'All',
  showComments: true,
  profiles: JSON.parse(JSON.stringify(DEFAULT_PROFILES)),
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge saved profiles — preserve default structure but restore user binds
      ['autoexec', 'practice', 'demo'].forEach(name => {
        if (parsed[name]) {
          state.profiles[name].binds = parsed[name].binds || {};
          state.profiles[name].extraConfig = parsed[name].extraConfig !== undefined ? parsed[name].extraConfig : DEFAULT_PROFILES[name].extraConfig;
          state.profiles[name].extraScripts = parsed[name].extraScripts || '';
        }
      });
    }
  } catch (e) {
    console.warn('cs2-config: failed to load saved profiles', e);
  }
}

function saveState() {
  try {
    const toSave = {};
    ['autoexec', 'practice', 'demo'].forEach(name => {
      toSave[name] = {
        binds: state.profiles[name].binds,
        extraConfig: state.profiles[name].extraConfig,
        extraScripts: state.profiles[name].extraScripts,
      };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('cs2-config: failed to save profiles', e);
  }
}

function resetProfileToDefault(profileName) {
  state.profiles[profileName] = JSON.parse(JSON.stringify(DEFAULT_PROFILES[profileName]));
  saveState();
  render();
}

/* ==========================================================================
   CONFIG OUTPUT GENERATOR
   ========================================================================== */
function generateConfig(profileName) {
  const profile = state.profiles[profileName];
  const showComments = state.showComments;
  const lines = [];

  if (showComments) {
    lines.push(`// ============================================================`);
    lines.push(`// ${profile.displayName} Config`);
    lines.push(`// generated by owenminercs.com/cs2-config`);
    lines.push(`// ============================================================`);
    lines.push('');
  }

  // Extra config block
  if (profile.extraConfig.trim()) {
    if (showComments) lines.push('// --- Config / CVars ---');
    profile.extraConfig.split('\n').forEach(line => lines.push(line));
    lines.push('');
  }

  // Bind lines
  const bindEntries = Object.entries(profile.binds).filter(([k, v]) => v && v.trim());
  if (bindEntries.length > 0) {
    if (showComments) lines.push('// --- Key Binds ---');
    bindEntries.forEach(([cs2key, cmd]) => {
      if (showComments) {
        const match = CS2_COMMANDS.find(c => c.command === cmd || cmd.startsWith(c.command));
        const comment = match ? match.description : cmd;
        lines.push(`// ${comment}`);
      }
      lines.push(`bind "${cs2key}" "${cmd}"`);
    });
    lines.push('');
  }

  // Extra scripts
  if (profile.extraScripts && profile.extraScripts.trim()) {
    if (showComments) lines.push('// --- Custom Aliases / Scripts ---');
    lines.push(profile.extraScripts.trim());
    lines.push('');
  }

  return lines.join('\n');
}

/* ==========================================================================
   DOM RENDERING
   ========================================================================== */
function render() {
  renderKeyboard();
  renderInspector();
  renderOutput();
  updateCaptureButton();
}

/* --- Keyboard --- */
function renderKeyboard() {
  const layout = LAYOUTS[state.activeLayout];
  const container = document.getElementById('cs2-keyboard-keys');
  if (!container) return;
  container.innerHTML = '';

  const profile = state.profiles[state.activeProfile];

  layout.rows.forEach((row, rowIdx) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'cs2-kb-row';
    rowEl.setAttribute('role', 'row');

    row.forEach(key => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cs2-key';

      const widthU = key.width || 1;
      btn.style.setProperty('--key-width', widthU);

      if (key.isInert) {
        btn.className += ' cs2-key--inert';
        btn.disabled = true;
        btn.setAttribute('aria-hidden', 'true');
        btn.textContent = key.label;
      } else if (key.cs2) {
        const cs2key = key.cs2Override || key.cs2;
        const boundCmd = profile.binds[cs2key] || '';
        const isBound = Boolean(boundCmd);
        const isSelected = state.selectedKey === cs2key;

        btn.id = `cs2-key-${cs2key.replace(/[^a-zA-Z0-9]/g, '_')}`;
        btn.setAttribute('data-cs2key', cs2key);
        btn.setAttribute('data-code', key.code || '');
        btn.setAttribute('aria-label', `${key.label}${isBound ? ' — bound to: ' + boundCmd : ' — unbound'}`);
        btn.setAttribute('role', 'gridcell');

        if (isBound) btn.classList.add('cs2-key--bound');
        if (isSelected) btn.classList.add('cs2-key--selected');

        const labelEl = document.createElement('span');
        labelEl.className = 'cs2-key__label';
        labelEl.textContent = key.label;
        btn.appendChild(labelEl);

        if (isBound) {
          const cmdEl = document.createElement('span');
          cmdEl.className = 'cs2-key__cmd';
          cmdEl.textContent = shortCommand(boundCmd);
          btn.appendChild(cmdEl);
        }

        btn.addEventListener('click', () => selectKey(cs2key));
      }

      rowEl.appendChild(btn);
    });

    container.appendChild(rowEl);
  });

  // Mouse button chips
  renderMouseChips();
}

function shortCommand(cmd) {
  if (!cmd) return '';
  if (cmd.length <= 14) return cmd;
  // Abbreviate known commands
  const abbrevs = {
    'sv_rethrow_last_grenade': 'rethrow',
    'demo_gototick': 'goto',
    'demo_timescale': 'speed',
    'demo_togglepause': 'pause',
    'toggle cl_radar_scale': 'radar',
    'toggle cl_drawhud': 'HUD',
    'toggle cl_drawhud_force_radar': 'radar',
    'toggle cl_lock_camera': 'lock cam',
    'toggle spec_show_xray': 'xray',
    'toggle bot_stop': 'bot stop',
    'toggle bot_mimic': 'bot mimic',
    'give weapon_': 'give ',
    'toggleconsole': 'console',
    'messagemode2': 'team chat',
    'messagemode': 'all chat',
  };
  for (const [k, v] of Object.entries(abbrevs)) {
    if (cmd.startsWith(k)) return v;
  }
  return cmd.substring(0, 12) + '…';
}

function renderMouseChips() {
  const container = document.getElementById('cs2-mouse-chips');
  if (!container) return;
  container.innerHTML = '';

  const profile = state.profiles[state.activeProfile];

  MOUSE_KEYS.forEach(mk => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cs2-mouse-chip';
    const isBound = Boolean(profile.binds[mk.id]);
    const isSelected = state.selectedKey === mk.id;
    if (isBound) btn.classList.add('cs2-mouse-chip--bound');
    if (isSelected) btn.classList.add('cs2-mouse-chip--selected');
    btn.setAttribute('data-cs2key', mk.id);
    btn.setAttribute('aria-label', `${mk.description}${isBound ? ' — bound to: ' + profile.binds[mk.id] : ' — unbound'}`);

    btn.innerHTML = `<span class="cs2-mouse-chip__label">${mk.label}</span><span class="cs2-mouse-chip__desc">${mk.description}</span>`;
    btn.addEventListener('click', () => selectKey(mk.id));
    container.appendChild(btn);
  });
}

/* --- Inspector --- */
function selectKey(cs2key) {
  state.selectedKey = cs2key;
  renderKeyboard();
  renderInspector();
}

function renderInspector() {
  const panel = document.getElementById('cs2-inspector');
  if (!panel) return;

  if (!state.selectedKey) {
    panel.innerHTML = '<div class="cs2-inspector__empty"><p>Click a key on the keyboard or press a key on your physical keyboard to inspect and bind it.</p></div>';
    return;
  }

  const cs2key = state.selectedKey;
  const profile = state.profiles[state.activeProfile];
  const currentBind = profile.binds[cs2key] || '';
  const isAutoexec = state.activeProfile === 'autoexec';
  const suggestions = POPULAR_SUGGESTIONS[cs2key] || [];

  // Cross-profile usage
  const usedIn = ['autoexec', 'practice', 'demo'].filter(p => state.profiles[p].binds[cs2key]);

  panel.innerHTML = `
    <div class="cs2-inspector__header">
      <div class="cs2-inspector__key-badge">${cs2key}</div>
      <button type="button" class="cs2-inspector__clear-btn" id="cs2-clear-bind" ${!currentBind ? 'disabled' : ''}>Clear Bind</button>
    </div>

    <div class="cs2-inspector__section">
      <label class="cs2-inspector__label" for="cs2-bind-input">Current Bind</label>
      <input
        type="text"
        id="cs2-bind-input"
        class="cs2-inspector__input"
        value="${escapeHtml(currentBind)}"
        placeholder="Type a command or pick from the list..."
        autocomplete="off"
        spellcheck="false"
      />
      <div id="cs2-cheat-warning" class="cs2-inspector__cheat-warning" style="display:none">
        Cheat commands are not allowed in the Gameplay (autoexec) profile.
      </div>
      <button type="button" class="cs2-btn cs2-btn--accent" id="cs2-save-bind">Save Bind</button>
    </div>

    ${suggestions.length ? `
    <div class="cs2-inspector__section">
      <div class="cs2-inspector__label">Popular binds for "${cs2key}"</div>
      <div class="cs2-inspector__suggestions">
        ${suggestions.map(s => `<button type="button" class="cs2-suggestion-pill" data-cmd="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
      </div>
    </div>` : ''}

    ${usedIn.length ? `
    <div class="cs2-inspector__section">
      <div class="cs2-inspector__label">Used in profiles</div>
      <div class="cs2-inspector__profile-use">
        ${usedIn.map(p => `<span class="cs2-inspector__profile-tag cs2-inspector__profile-tag--${p}">${state.profiles[p].displayName}: <code>${escapeHtml(state.profiles[p].binds[cs2key])}</code></span>`).join('')}
      </div>
    </div>` : ''}

    <div class="cs2-inspector__section cs2-inspector__search-section">
      <div class="cs2-inspector__label">Command picker</div>
      <input type="text" id="cs2-cmd-search" class="cs2-inspector__input cs2-inspector__input--search" placeholder="Search commands..." autocomplete="off" value="${escapeHtml(state.searchQuery)}" />
      <select id="cs2-cmd-category" class="cs2-inspector__select">
        <option value="All">All categories</option>
        ${CATEGORIES.map(c => `<option value="${c}" ${state.searchCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <div class="cs2-cmd-list" id="cs2-cmd-list">
        ${renderCommandList(isAutoexec)}
      </div>
    </div>
  `;

  // Events
  const input = panel.querySelector('#cs2-bind-input');
  const warning = panel.querySelector('#cs2-cheat-warning');
  const saveBtn = panel.querySelector('#cs2-save-bind');

  input.addEventListener('input', () => {
    const val = input.value.trim();
    const cheat = isAutoexec && bindRequiresCheats(val);
    warning.style.display = cheat ? 'block' : 'none';
    saveBtn.disabled = cheat;
  });

  saveBtn.addEventListener('click', () => {
    const val = input.value.trim();
    if (isAutoexec && bindRequiresCheats(val)) return;
    if (val) profile.binds[cs2key] = val;
    else delete profile.binds[cs2key];
    saveState();
    render();
  });

  panel.querySelector('#cs2-clear-bind').addEventListener('click', () => {
    delete profile.binds[cs2key];
    saveState();
    render();
  });

  panel.querySelector('#cs2-cmd-search').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    document.getElementById('cs2-cmd-list').innerHTML = renderCommandList(isAutoexec);
    attachCommandListEvents();
  });

  panel.querySelector('#cs2-cmd-category').addEventListener('change', e => {
    state.searchCategory = e.target.value;
    document.getElementById('cs2-cmd-list').innerHTML = renderCommandList(isAutoexec);
    attachCommandListEvents();
  });

  // Suggestion pills
  panel.querySelectorAll('.cs2-suggestion-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      if (isAutoexec && bindRequiresCheats(cmd)) {
        warning.style.display = 'block';
        return;
      }
      profile.binds[cs2key] = cmd;
      saveState();
      render();
    });
  });

  attachCommandListEvents();
}

function renderCommandList(isAutoexec) {
  const q = state.searchQuery.toLowerCase();
  const cat = state.searchCategory;

  const filtered = CS2_COMMANDS.filter(c => {
    const catMatch = cat === 'All' || c.category === cat;
    const qMatch = !q || c.label.toLowerCase().includes(q) || c.command.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    return catMatch && qMatch;
  });

  if (!filtered.length) return '<div class="cs2-cmd-list__empty">No commands found.</div>';

  let html = '';
  let lastCat = null;
  filtered.forEach(c => {
    if (c.category !== lastCat) {
      html += `<div class="cs2-cmd-list__category">${c.category}</div>`;
      lastCat = c.category;
    }
    const blocked = isAutoexec && c.requiresCheats;
    html += `
      <button type="button" class="cs2-cmd-item${blocked ? ' cs2-cmd-item--blocked' : ''}" data-command="${escapeHtml(c.command)}" ${blocked ? 'title="Not allowed in Gameplay/autoexec profile"' : ''}>
        <span class="cs2-cmd-item__label">${escapeHtml(c.label)}</span>
        <code class="cs2-cmd-item__cmd">${escapeHtml(c.command)}</code>
        <span class="cs2-cmd-item__desc">${escapeHtml(c.description)}</span>
        ${blocked ? '<span class="cs2-cmd-item__lock">practice/demo only</span>' : ''}
      </button>`;
  });
  return html;
}

function attachCommandListEvents() {
  const listEl = document.getElementById('cs2-cmd-list');
  if (!listEl) return;
  const cs2key = state.selectedKey;
  const profile = state.profiles[state.activeProfile];
  const isAutoexec = state.activeProfile === 'autoexec';

  listEl.querySelectorAll('.cs2-cmd-item:not(.cs2-cmd-item--blocked)').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-command');
      if (cs2key) {
        profile.binds[cs2key] = cmd;
        saveState();
        render();
      }
    });
  });
}

/* --- Config Output --- */
function renderOutput() {
  ['autoexec', 'practice', 'demo'].forEach(name => {
    const el = document.getElementById(`cs2-output-${name}`);
    if (el) {
      el.textContent = generateConfig(name);
      highlightOutput(el);
    }
  });

  // Update extra config / scripts textareas
  ['autoexec', 'practice', 'demo'].forEach(name => {
    const cfgEl = document.getElementById(`cs2-extra-config-${name}`);
    const scriptEl = document.getElementById(`cs2-extra-scripts-${name}`);
    if (cfgEl) cfgEl.value = state.profiles[name].extraConfig;
    if (scriptEl) scriptEl.value = state.profiles[name].extraScripts;
  });
}

function highlightOutput(pre) {
  // Simple CSS-class based syntax color via wrapper spans
  const raw = pre.textContent;
  const lines = raw.split('\n');
  pre.innerHTML = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) {
      return `<span class="cfg-comment">${escapeHtml(line)}</span>`;
    }
    if (trimmed.startsWith('bind ')) {
      const m = trimmed.match(/^(bind)\s+"([^"]+)"\s+"(.+)"$/);
      if (m) {
        return `<span class="cfg-keyword">${escapeHtml(m[1])}</span> <span class="cfg-key">"${escapeHtml(m[2])}"</span> <span class="cfg-value">"${escapeHtml(m[3])}"</span>`;
      }
    }
    return escapeHtml(line);
  }).join('\n');
}

/* ==========================================================================
   PHYSICAL KEY LISTENER
   ========================================================================== */
function initKeyListener() {
  document.addEventListener('keydown', e => {
    if (!state.captureMode) return;
    // Don't capture when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    const cs2key = CODE_TO_CS2[e.code];
    if (cs2key) {
      e.preventDefault();
      e.stopPropagation();

      // Flash the key
      const keyBtn = document.querySelector(`[data-cs2key="${CSS.escape(cs2key)}"]`);
      if (keyBtn) {
        keyBtn.classList.add('cs2-key--flash');
        setTimeout(() => keyBtn.classList.remove('cs2-key--flash'), 200);
      }

      selectKey(cs2key);
    }
  });
}

function updateCaptureButton() {
  const btn = document.getElementById('cs2-capture-toggle');
  if (!btn) return;
  if (state.captureMode) {
    btn.classList.add('cs2-capture-toggle--active');
    btn.textContent = 'Key capture: ON — press any key';
    btn.setAttribute('aria-pressed', 'true');
  } else {
    btn.classList.remove('cs2-capture-toggle--active');
    btn.textContent = 'Key capture: OFF — click to activate';
    btn.setAttribute('aria-pressed', 'false');
  }
}

/* ==========================================================================
   COPY / DOWNLOAD
   ========================================================================== */
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('cs2-btn--success');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('cs2-btn--success'); }, 1800);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy to Clipboard'; }, 1800);
  });
}

function downloadConfig(profileName) {
  const content = generateConfig(profileName);
  const filename = `${profileName}.cfg`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ==========================================================================
   INIT
   ========================================================================== */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function init() {
  loadState();

  // Layout selector pills
  document.querySelectorAll('[data-layout]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeLayout = btn.getAttribute('data-layout');
      document.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('active', b === btn));
      render();
    });
    if (btn.getAttribute('data-layout') === state.activeLayout) btn.classList.add('active');
  });

  // Profile tabs (keyboard view)
  document.querySelectorAll('[data-profile-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeProfile = btn.getAttribute('data-profile-tab');
      document.querySelectorAll('[data-profile-tab]').forEach(b => b.classList.toggle('active', b === btn));
      render();
    });
    if (btn.getAttribute('data-profile-tab') === state.activeProfile) btn.classList.add('active');
  });

  // Output profile tabs
  document.querySelectorAll('[data-output-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-output-tab');
      document.querySelectorAll('[data-output-tab]').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('[data-output-panel]').forEach(p => {
        p.hidden = p.getAttribute('data-output-panel') !== target;
      });
    });
  });

  // Capture toggle
  const captureBtn = document.getElementById('cs2-capture-toggle');
  if (captureBtn) {
    captureBtn.addEventListener('click', () => {
      state.captureMode = !state.captureMode;
      updateCaptureButton();
    });
  }

  // Copy buttons
  document.querySelectorAll('[data-copy-profile]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-copy-profile');
      copyToClipboard(generateConfig(name), btn);
    });
  });

  // Download buttons
  document.querySelectorAll('[data-download-profile]').forEach(btn => {
    btn.addEventListener('click', () => {
      downloadConfig(btn.getAttribute('data-download-profile'));
    });
  });

  // Comments toggle
  const commentsToggle = document.getElementById('cs2-comments-toggle');
  if (commentsToggle) {
    commentsToggle.checked = state.showComments;
    commentsToggle.addEventListener('change', () => {
      state.showComments = commentsToggle.checked;
      renderOutput();
    });
  }

  // Reset profile buttons
  document.querySelectorAll('[data-reset-profile]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-reset-profile');
      const displayName = state.profiles[name].displayName;
      if (confirm(`Reset "${displayName}" to suggested defaults? This will overwrite your current binds for this profile.`)) {
        resetProfileToDefault(name);
      }
    });
  });

  // Extra config textareas
  ['autoexec', 'practice', 'demo'].forEach(name => {
    const cfgEl = document.getElementById(`cs2-extra-config-${name}`);
    if (cfgEl) {
      cfgEl.addEventListener('input', () => {
        state.profiles[name].extraConfig = cfgEl.value;
        saveState();
        renderOutput();
      });
    }
    const scriptEl = document.getElementById(`cs2-extra-scripts-${name}`);
    if (scriptEl) {
      scriptEl.addEventListener('input', () => {
        state.profiles[name].extraScripts = scriptEl.value;
        saveState();
        renderOutput();
      });
    }
  });

  initKeyListener();
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
