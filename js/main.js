// ============================================================
// Merchant Realms — Game Loop, Initialization, Input Handling
// ============================================================

window.Game = (function () {
    'use strict';

    // ── State ──
    let state = 'title'; // 'title' | 'playing' | 'paused' | 'won' | 'lost'
    let speed = 1;        // 0=paused, 1=normal, 2=fast, 5=faster, 10=fastest
    let lastTickTime = 0;
    let tickAccumulator = 0;
    let tickCounter = 0;
    var _loopFrameCount = 0;
    let animFrameId = null;
    let lastFrameTime = 0;

    // ── Error notification tracking ──
    var _lastErrorCheckDay = 0;
    var _lastErrorCount = 0;

    // ── Console capture for god mode export ──
    var _consoleLogs = [];
    var _consoleMaxEntries = 500;
    (function hookConsole() {
        var origLog = console.log;
        var origWarn = console.warn;
        var origError = console.error;
        var origInfo = console.info;
        function capture(level, args) {
            var msg = Array.prototype.slice.call(args).map(function(a) {
                try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
                catch(e) { return String(a); }
            }).join(' ');
            _consoleLogs.push({ t: new Date().toISOString(), level: level, msg: msg });
            if (_consoleLogs.length > _consoleMaxEntries) _consoleLogs.shift();
        }
        // Fire in-game debug notification for errors (respects error_alerts filter)
        function _fireErrorNotif(errorMsg, source) {
            try {
                if (typeof Player === 'undefined' || !Player.getNotificationFilters) return;
                var filters = Player.getNotificationFilters();
                if (!filters.error_alerts) return;
                var shortMsg = '🐛 ' + source + ': ' + (errorMsg.length > 120 ? errorMsg.substring(0, 120) + '…' : errorMsg);
                if (typeof Engine !== 'undefined' && Engine.logEvent) {
                    Engine.logEvent(shortMsg, { type: 'error_alert', fullError: errorMsg, source: source }, 'error_alerts');
                }
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast(shortMsg, 'danger', 'error_alerts');
                }
            } catch(_) {}
        }
        console.log = function() { capture('LOG', arguments); origLog.apply(console, arguments); };
        console.warn = function() { capture('WARN', arguments); origWarn.apply(console, arguments); };
        console.error = function() {
            capture('ERROR', arguments);
            origError.apply(console, arguments);
            var errMsg = Array.prototype.slice.call(arguments).map(function(a) {
                try { return typeof a === 'object' ? (a instanceof Error ? a.message + (a.stack ? '\n' + a.stack : '') : JSON.stringify(a)) : String(a); }
                catch(e) { return String(a); }
            }).join(' ');
            _fireErrorNotif(errMsg, 'Console Error');
        };
        console.info = function() { capture('INFO', arguments); origInfo.apply(console, arguments); };
        window.addEventListener('error', function(e) {
            var errDetail = e.message + ' at ' + (e.filename || '?') + ':' + (e.lineno || '?') + ':' + (e.colno || '?');
            _consoleLogs.push({ t: new Date().toISOString(), level: 'UNCAUGHT', msg: errDetail });
            if (_consoleLogs.length > _consoleMaxEntries) _consoleLogs.shift();
            _fireErrorNotif(errDetail, 'Uncaught Error');
        });
        window.addEventListener('unhandledrejection', function(e) {
            var reason = String(e.reason);
            _consoleLogs.push({ t: new Date().toISOString(), level: 'UNHANDLED_PROMISE', msg: reason });
            if (_consoleLogs.length > _consoleMaxEntries) _consoleLogs.shift();
            _fireErrorNotif(reason, 'Unhandled Promise');
        });
    })();

    // ── Town hover hint ──
    let townHoverHintCount = parseInt(localStorage.getItem('mr_townHoverHints') || '0', 10);
    const TOWN_HOVER_HINT_MAX = 10;

    // ── Sticky hover for shift-select (prevents tooltip flicker) ──
    let _lastPersonHover = null; // { data, sx, sy, time }
    const PERSON_HOVER_STICKY_MS = 1500;

    // ── Input state ──
    const input = {
        mouseX: 0,
        mouseY: 0,
        mouseDown: false,
        mouseDragStart: null,
        isDragging: false,
        keys: {},
        lastHover: null,
    };

    // ── Event bus ──
    const listeners = {};

    function on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
    }

    function emit(event, data) {
        if (listeners[event]) {
            for (const cb of listeners[event]) {
                try { cb(data); } catch (e) { console.error('Event handler error:', e); }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  INITIALIZATION
    // ═══════════════════════════════════════════════════════════

    function init() {
        state = 'title';

        // C7: Validate critical CONFIG values
        if (!CONFIG.TICKS_PER_DAY || CONFIG.TICKS_PER_DAY <= 0) CONFIG.TICKS_PER_DAY = 60;
        if (!CONFIG.TICK_INTERVAL || CONFIG.TICK_INTERVAL <= 0) CONFIG.TICK_INTERVAL = 50;
        if (!CONFIG.TILE_SIZE || CONFIG.TILE_SIZE <= 0) CONFIG.TILE_SIZE = 16;
        if (!CONFIG.WORLD_WIDTH || CONFIG.WORLD_WIDTH <= 0) CONFIG.WORLD_WIDTH = 3200;
        if (!CONFIG.WORLD_HEIGHT || CONFIG.WORLD_HEIGHT <= 0) CONFIG.WORLD_HEIGHT = 3200;

        // Initialize IndexedDB save system + migrate old saves
        _initSaveSystem();

        // Bind title screen button
        const btnNew = document.getElementById('btnNewGame');
        if (btnNew) {
            btnNew.addEventListener('click', function () {
                console.log('[DEBUG] btnNewGame clicked. state=' + state);
                startTitleMusic();
                showGameModeSelection();
            });
        }

        // Bind modal close button early so it works on the title screen
        var btnCloseModal = document.getElementById('btnCloseModal');
        if (btnCloseModal) {
            btnCloseModal.addEventListener('click', function () {
                var mo = document.getElementById('modalOverlay');
                if (mo) mo.classList.add('hidden');
            });
        }
        var modalOverlayEl = document.getElementById('modalOverlay');
        if (modalOverlayEl) {
            modalOverlayEl.addEventListener('click', function (e) {
                if (e.target === modalOverlayEl) modalOverlayEl.classList.add('hidden');
            });
        }

        // Load Game button (replaces old Continue)
        const btnLoad = document.getElementById('btnLoadGame');
        if (btnLoad) {
            btnLoad.addEventListener('click', function () {
                startTitleMusic();
                showLoadSlotPicker();
            });
            btnLoad.style.display = '';
        }

        // Tutorial button
        const btnTutorial = document.getElementById('btnTutorial');
        if (btnTutorial) {
            btnTutorial.addEventListener('click', function () {
                startTitleMusic();
                if (typeof Tutorial !== 'undefined' && Tutorial.start) {
                    Tutorial.start();
                }
            });
        }

        // Character creation — Start Adventure button
        const btnStartAdventure = document.getElementById('btnStartAdventure');
        if (btnStartAdventure) {
            btnStartAdventure.addEventListener('click', startNewGame);
        }

        // Character creation — Back to Mode Selection
        const btnBackToMenu = document.getElementById('btnBackToMenu');
        if (btnBackToMenu) {
            btnBackToMenu.addEventListener('click', function () {
                var charScreen = document.getElementById('charCreateScreen');
                if (charScreen) { charScreen.classList.add('hidden'); charScreen.style.display = 'none'; }
                delete window._selectedStartConfig;
                showGameModeSelection();
            });
        }

        // End screen return button
        const btnEndOk = document.getElementById('btnEndOk');
        if (btnEndOk) {
            btnEndOk.addEventListener('click', function () {
                state = 'title';
                var endScreen = document.getElementById('endScreen');
                if (endScreen) { endScreen.classList.add('hidden'); endScreen.style.display = 'none'; } // v9p33river329: hide end overlay when returning to title.
            });
        }

        // ── Music controls ──
        initMusicControls();

        // Start title music on first user interaction (AudioContext policy)
        // Browsers block audio until a click/keydown/touchstart.
        // First click (e.g. New Game, Tutorial, Load) will start title music.
        function startTitleMusic() {
            if (typeof Music !== 'undefined') {
                Music.init();
                Music.playTitleMusic();
                var volSlider = document.getElementById('musicVolume');
                if (volSlider) volSlider.value = Math.round(Music.getVolume() * 100);
                var btn = document.getElementById('btnMusicToggle');
                if (btn) btn.textContent = Music.isMuted() ? '🔇' : '🔊';
                // Sync title screen toggle button
                var titleBtn = document.getElementById('btnTitleMusicToggle');
                if (titleBtn) titleBtn.textContent = Music.isMuted() ? '🔇 Music: Off' : '🔊 Music: On';
            }
            document.removeEventListener('click', startTitleMusic);
            document.removeEventListener('keydown', startTitleMusic);
        }

        // Attempt autoplay immediately (works if user has interacted with site before)
        try {
            if (typeof Music !== 'undefined') {
                Music.init();
                Music.playTitleMusic();
            }
        } catch (e) { /* autoplay blocked — fall through to event listeners */ }
        // Fallback: start on first click or keydown
        document.addEventListener('click', startTitleMusic);
        document.addEventListener('keydown', startTitleMusic);
    }

    // ── Music UI Controls ──
    function initMusicControls() {
        var btnToggle = document.getElementById('btnMusicToggle');
        if (btnToggle) {
            btnToggle.addEventListener('click', function () {
                if (typeof Music === 'undefined') return;
                Music.init();
                Music.toggleMute();
                btnToggle.textContent = Music.isMuted() ? '🔇' : '🔊';
                // Sync title screen button if visible
                var titleBtn = document.getElementById('btnTitleMusicToggle');
                if (titleBtn) titleBtn.textContent = Music.isMuted() ? '🔇 Music: Off' : '🔊 Music: On';
            });
        }
        // Title screen music toggle
        var btnTitleToggle = document.getElementById('btnTitleMusicToggle');
        if (btnTitleToggle) {
            btnTitleToggle.addEventListener('click', function (e) {
                e.stopPropagation(); // Don't trigger startTitleMusic again
                if (typeof Music === 'undefined') return;
                Music.init();
                Music.toggleMute();
                btnTitleToggle.textContent = Music.isMuted() ? '🔇 Music: Off' : '🔊 Music: On';
                if (btnToggle) btnToggle.textContent = Music.isMuted() ? '🔇' : '🔊';
            });
        }
        // v9p27 — Renderer mode cycle: flat -> map -> flat. Helper used by both
        // the menu button (btnToggleRenderer) and the in-game god-mode button
        // (btnRendererMode). Keeps CONFIG.RENDERER_MODE, both button labels, and
        // renderer caches in sync. (v9p33river56: textured mode removed.)
        var RENDERER_MODES = ['flat', 'map'];
        function _modeLabel(mode, withPrefix) {
            var name = mode.charAt(0).toUpperCase() + mode.slice(1);
            if (withPrefix === 'menu') return '🎨 Renderer: ' + name;
            return '⚡ ' + name;
        }
        function _applyRendererMode(mode, opts) {
            opts = opts || {};
            CONFIG.RENDERER_MODE = mode;
            var bMenu = document.getElementById('btnToggleRenderer');
            var bGame = document.getElementById('btnRendererMode');
            if (bMenu) bMenu.textContent = _modeLabel(mode, 'menu');
            if (bGame) bGame.textContent = _modeLabel(mode);
            if (typeof Renderer !== 'undefined') {
                if (Renderer.invalidateTerrain) Renderer.invalidateTerrain();
                if (Renderer.refreshZoomLimits) Renderer.refreshZoomLimits();
            }
            if (opts.toast && typeof UI !== 'undefined' && UI.toast) {
                UI.toast('Renderer: ' + mode.charAt(0).toUpperCase() + mode.slice(1), 'info');
            }
        }
        function _cycleRendererMode(opts) {
            var cur = CONFIG.RENDERER_MODE || 'map';
            if (cur === 'textured') cur = 'flat';
            var idx = RENDERER_MODES.indexOf(cur);
            if (idx < 0) idx = 0;
            var next = RENDERER_MODES[(idx + 1) % RENDERER_MODES.length];
            _applyRendererMode(next, opts);
        }

        // Renderer toggle (menu button)
        var btnRendererToggle = document.getElementById('btnToggleRenderer');
        if (btnRendererToggle) {
            btnRendererToggle.textContent = _modeLabel(CONFIG.RENDERER_MODE || 'textured', 'menu');
            btnRendererToggle.addEventListener('click', function (e) {
                e.stopPropagation();
                _cycleRendererMode();
            });
        }
        // v9p19: in-game renderer toggle (mirrors main menu btnToggleRenderer).
        // Per supervisor: "god mode button to switch between textured / flat / map".
        var btnRendererMode = document.getElementById('btnRendererMode');
        if (btnRendererMode) {
            btnRendererMode.textContent = _modeLabel(CONFIG.RENDERER_MODE || 'textured');
            btnRendererMode.title = 'God Mode: Toggle Renderer (Textured / Flat / Map)';
            btnRendererMode.addEventListener('click', function (e) {
                e.stopPropagation();
                _cycleRendererMode({ toast: true });
            });
        }
        var volSlider = document.getElementById('musicVolume');
        var titleVolSlider = document.getElementById('titleMusicVolume');
        function syncVolumeSliders(val) {
            if (volSlider) volSlider.value = val;
            if (titleVolSlider) titleVolSlider.value = val;
        }
        if (volSlider) {
            volSlider.addEventListener('input', function (e) {
                if (typeof Music === 'undefined') return;
                Music.init();
                Music.setVolume(e.target.value / 100);
                if (titleVolSlider) titleVolSlider.value = e.target.value;
            });
        }
        if (titleVolSlider) {
            titleVolSlider.addEventListener('input', function (e) {
                if (typeof Music === 'undefined') return;
                Music.init();
                Music.setVolume(e.target.value / 100);
                if (volSlider) volSlider.value = e.target.value;
            });
            // Initialize slider to saved volume
            try {
                var savedVol = localStorage.getItem('merchantRealms_musicVolume');
                if (savedVol !== null) titleVolSlider.value = Math.round(parseFloat(savedVol) * 100);
            } catch(e) {}
        }
    }

    // Candle glow overlays positioned to match GIF candle locations
    var candlePositions = [
        // Bottom-right tall candle
        { x: 88, y: 82, r: 255, g: 210, b: 120, a: 0.17, spread: 22 },
        { x: 90, y: 88, r: 255, g: 200, b: 100, a: 0.13, spread: 18 },
        // Upper-right shelf candle
        { x: 74, y: 28, r: 255, g: 220, b: 140, a: 0.14, spread: 16 },
        { x: 72, y: 32, r: 255, g: 200, b: 110, a: 0.10, spread: 20 },
        // Left hanging lantern
        { x: 18, y: 34, r: 255, g: 190, b: 90, a: 0.15, spread: 20 },
        { x: 16, y: 38, r: 255, g: 210, b: 120, a: 0.11, spread: 16 },
        // Center-left balance/scale warm glow
        { x: 36, y: 54, r: 255, g: 200, b: 100, a: 0.11, spread: 24 },
        // Center desk candles
        { x: 52, y: 62, r: 255, g: 215, b: 130, a: 0.13, spread: 18 },
        { x: 58, y: 66, r: 255, g: 195, b: 95, a: 0.10, spread: 16 },
        // Left window cool moonlight
        { x: 5, y: 38, r: 180, g: 200, b: 255, a: 0.08, spread: 28 },
        // Extra ambient warmth bottom
        { x: 50, y: 92, r: 255, g: 180, b: 80, a: 0.08, spread: 30 },
        { x: 70, y: 90, r: 255, g: 200, b: 100, a: 0.07, spread: 26 }
    ];
    var candleAnims = ['candleA', 'candleB', 'candleC', 'candleD'];
    var candleDurations = [2.3, 3.1, 2.7, 3.7, 4.1, 2.9, 5.3, 3.3, 4.7, 6.1, 5.7, 7.1];
    var titleScreen = document.getElementById('titleScreen');
    if (titleScreen) {
        var titleBg = titleScreen.querySelector('.title-bg');
        for (var ci = 0; ci < candlePositions.length; ci++) {
            var cp = candlePositions[ci];
            var cdiv = document.createElement('div');
            cdiv.className = 'candle-glow';
            cdiv.style.background = 'radial-gradient(circle at ' + cp.x + '% ' + cp.y + '%, rgba(' + cp.r + ',' + cp.g + ',' + cp.b + ',' + cp.a + ') 0%, transparent ' + cp.spread + '%)';
            cdiv.style.animation = candleAnims[ci % 4] + ' ' + candleDurations[ci] + 's ease-in-out infinite';
            if (titleBg && titleBg.nextSibling) {
                titleScreen.insertBefore(cdiv, titleBg.nextSibling);
            } else {
                titleScreen.appendChild(cdiv);
            }
        }
    }

    let _lastMusicMoodCheck = 0;
    function updateMusicMood() {
        if (typeof Music === 'undefined' || state !== 'playing') return;
        var now = Date.now();
        if (now - _lastMusicMoodCheck < 15000) return; // check every 15s
        _lastMusicMoodCheck = now;

        try {
            var world = (typeof Engine !== 'undefined' && Engine.getWorld) ? Engine.getWorld() : null;
            var player = (typeof Player !== 'undefined') ? Player : null;
            if (!world || !player) return;

            var playerKingdomId = player.citizenshipKingdomId || (player.state && player.state.citizenshipKingdomId);
            var playerKingdom = playerKingdomId && world.kingdoms
                ? world.kingdoms.find(function (k) { return k.id === playerKingdomId; })
                : null;

            var isAtWar = playerKingdom && playerKingdom.atWar && playerKingdom.atWar.size > 0;
            var gold = player.gold || (player.state && player.state.gold) || 0;
            var buildings = player.buildings || (player.state && player.state.buildings) || [];
            var isProsperous = gold > 5000 && buildings.length > 3;
            var isTraveling = (player.travelProgress != null && player.travelProgress > 0) ||
                              (player.state && player.state.travelProgress > 0);

            if (isAtWar) Music.playGameMusic('tension');
            else if (isProsperous) Music.playGameMusic('prosperity');
            else if (isTraveling) Music.playGameMusic('exploration');
            else Music.playGameMusic('peaceful');
        } catch (e) {
            // Silently ignore — music is non-critical
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  GAME MODE SELECTION (replaces direct char creation)
    // ═══════════════════════════════════════════════════════════
    var _MODE_CATEGORIES = [
        {
            id: 'story', title: 'Story Modes', icon: '📖', color: '#44cc88',
            subtitle: 'Guided campaigns with narrative and tutorials',
            starts: ['story_mode']
        },
        {
            id: 'sandbox', title: 'Sandbox Modes', icon: '⚖️', color: '#DAA520',
            subtitle: 'Classic open-world trading — choose your difficulty',
            starts: ['very_hard', 'hard', 'normal', 'easy', 'very_easy']
        },
        {
            id: 'unique', title: 'Unique Sandbox Modes', icon: '✨', color: '#dd88ff',
            subtitle: 'Specialized origins with unique mechanics',
            starts: ['pilgrim', 'shipwrecked', 'musician', 'military', 'scholar']
        }
    ];

    function _setGameModeContent(el, html) {
        // Remove all children except the .title-bg background layer
        var children = Array.prototype.slice.call(el.children);
        for (var ci = 0; ci < children.length; ci++) {
            if (!children[ci].classList.contains('title-bg')) el.removeChild(children[ci]);
        }
        var wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        while (wrapper.firstChild) el.appendChild(wrapper.firstChild);
    }

    function _getGameModeScreenEl() {
        var el = document.getElementById('gameModeScreen');
        if (!el) {
            el = document.createElement('div');
            el.id = 'gameModeScreen';
            el.className = 'overlay';
            el.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:#0d0a06;overflow-y:auto;';
            // GIF background layer
            var bg = document.createElement('div');
            bg.className = 'title-bg';
            bg.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:url(images/merchant_desk_bg.gif) center center / cover no-repeat;opacity:0.40;pointer-events:none;z-index:0;';
            el.appendChild(bg);
            document.body.appendChild(el);
        }
        return el;
    }

    function showGameModeSelection() {
        console.log('[Menu] showGameModeSelection called, state=' + state);
        // Force state to title — in case something left it as 'playing'
        state = 'title';
        if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
        try { stopAutosave(); } catch(e) {}
        delete window._selectedStartConfig;
        if (typeof StoryMode !== 'undefined' && StoryMode.deserialize) {
            try { StoryMode.deserialize({ active: false, chapter: 0, complete: false }); } catch(e) {}
        }
        
        // Hide EVERYTHING that isn't the game mode screen
        var titleScreen = document.getElementById('titleScreen');
        if (titleScreen) { titleScreen.classList.add('hidden'); titleScreen.style.display = 'none'; }
        var charScreen = document.getElementById('charCreateScreen');
        if (charScreen) { charScreen.classList.add('hidden'); charScreen.style.display = 'none'; }

        // Hide game UI panels (use class only — inline display:none would block showGameUI later)
        var hideByClass = ['topBar', 'leftPanel', 'rightPanel', 'bottomBar', 'modalOverlay'];
        for (var hi = 0; hi < hideByClass.length; hi++) {
            var hel = document.getElementById(hideByClass[hi]);
            if (hel) { hel.classList.add('hidden'); }
        }
        // These are safe to hide with inline style (not toggled by showGameUI)
        var hideByStyle = ['kingdomSelectScreen', 'god-mode-panel', 'mobileHud', 'bottomTabs'];
        for (var hj = 0; hj < hideByStyle.length; hj++) {
            var hel2 = document.getElementById(hideByStyle[hj]);
            if (hel2) { hel2.style.display = 'none'; }
        }
        document.body.classList.remove('game-active');

        var el = _getGameModeScreenEl();
        el.classList.remove('hidden');  // CRITICAL: remove hidden class (has !important)
        el.style.display = 'flex';

        var html = '<div class="title-content" style="max-width:700px;width:95%;">';
        html += '<h1 class="game-title" style="font-size:2.4rem;margin-bottom:4px;">Choose Your Path</h1>';
        html += '<div class="title-divider">⚜</div>';
        html += '<p style="color:#b8a878;margin-bottom:24px;font-size:0.95rem;">How would you like to experience Merchant Realms?</p>';
        html += '<div style="display:flex;flex-direction:column;gap:16px;">';

        for (var i = 0; i < _MODE_CATEGORIES.length; i++) {
            var cat = _MODE_CATEGORIES[i];
            html += '<button class="btn-medieval" data-mode-cat="' + cat.id + '" style="';
            html += 'display:flex;align-items:center;gap:14px;padding:18px 22px;font-size:1.1rem;';
            html += 'border:2px solid ' + cat.color + ';background:linear-gradient(135deg, rgba(30,25,15,0.95), rgba(50,40,20,0.95));';
            html += 'text-align:left;cursor:pointer;transition:all 0.2s;">';
            html += '<span style="font-size:2.2rem;min-width:40px;text-align:center;">' + cat.icon + '</span>';
            html += '<div style="flex:1;">';
            html += '<div style="color:#e8d5b0;font-weight:bold;font-size:1.15rem;">' + cat.title + '</div>';
            html += '<div style="color:#9a8a6a;font-size:0.85rem;margin-top:3px;">' + cat.subtitle + '</div>';
            html += '</div>';
            html += '<span style="color:#d4af37;font-size:1.4rem;">›</span>';
            html += '</button>';
        }

        html += '</div>';
        html += '<button id="btnModeBackToMenu" class="btn-medieval" style="display:block;margin:20px auto 0;font-size:0.9rem;padding:6px 18px;opacity:0.85;">🏠 Back to Main Menu</button>';
        html += '</div>';
        _setGameModeContent(el, html);

        // Bind clicks
        el.querySelectorAll('[data-mode-cat]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var catId = btn.getAttribute('data-mode-cat');
                _showCategoryStarts(catId);
            });
        });
        var backBtn = document.getElementById('btnModeBackToMenu');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                el.style.display = 'none';
                if (titleScreen) { titleScreen.classList.remove('hidden'); titleScreen.style.display = 'flex'; }
            });
        }
    }

    function _showCategoryStarts(catId) {
        var cat = _MODE_CATEGORIES.find(function(c) { return c.id === catId; });
        if (!cat) return;

        var el = _getGameModeScreenEl();
        var starts = CONFIG.GAME_STARTS;
        var catStarts = [];
        for (var i = 0; i < cat.starts.length; i++) {
            var s = starts.find(function(st) { return st.id === cat.starts[i]; });
            if (s) catStarts.push(s);
        }

        // Custom display names for story mode
        var displayNames = { 'story_mode': "The Blacksmith's Child" };

        var html = '<div class="title-content" style="max-width:750px;width:95%;">';
        html += '<h1 class="game-title" style="font-size:2rem;margin-bottom:4px;">' + cat.icon + ' ' + cat.title + '</h1>';
        html += '<div class="title-divider">⚜</div>';
        html += '<div style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">';

        for (var j = 0; j < catStarts.length; j++) {
            var s = catStarts[j];
            var name = displayNames[s.id] || s.name;
            html += '<button class="btn-medieval" data-start-pick="' + s.id + '" style="';
            html += 'display:flex;align-items:center;gap:14px;padding:16px 20px;font-size:1rem;';
            html += 'border:2px solid ' + (s.color || '#555') + ';background:linear-gradient(135deg, rgba(30,25,15,0.95), rgba(50,40,20,0.95));';
            html += 'text-align:left;cursor:pointer;transition:all 0.2s;">';
            html += '<span style="font-size:2rem;min-width:36px;text-align:center;">' + s.icon + '</span>';
            html += '<div style="flex:1;">';
            html += '<div style="color:#e8d5b0;font-weight:bold;font-size:1.05rem;">' + name + '</div>';
            html += '<div style="color:#9a8a6a;font-size:0.82rem;margin-top:3px;">' + s.description + '</div>';
            html += '<div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;font-size:0.78rem;color:#b8a878;">';
            html += '<span>💰 ' + s.startGold + 'g</span>';
            if (s.difficulty) html += '<span style="color:' + (s.color || '#aaa') + ';">' + s.difficulty + '</span>';
            if (s.hasFamily) html += '<span>👨‍👩‍👧 Family</span>';
            if (s.startHouse) html += '<span>🏠 House</span>';
            if (s.startBuilding || s.startBuildings) html += '<span>🏗️ Buildings</span>';
            html += '</div>';
            html += '</div>';
            html += '</button>';
        }

        html += '</div>';
        html += '<button id="btnStartBackToCats" class="btn-medieval" style="display:block;margin:20px auto 0;font-size:0.9rem;padding:6px 18px;opacity:0.85;">← Back</button>';
        html += '</div>';
        _setGameModeContent(el, html);

        // Bind clicks
        el.querySelectorAll('[data-start-pick]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var startId = btn.getAttribute('data-start-pick');
                _selectGameStart(startId);
            });
        });
        var backBtn = document.getElementById('btnStartBackToCats');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                showGameModeSelection();
            });
        }
    }

    function _selectGameStart(startId) {
        var startConfig = CONFIG.GAME_STARTS.find(function(s) { return s.id === startId; });
        if (!startConfig) return;

        // Store the selected start config
        window._selectedStartConfig = startConfig;

        // v9p33river38: if story mode selected, re-pin the map to Map2 (story canon).
        // Renderer._loadTestworld1 ran at boot with a random pick; redo it now that
        // we know story mode is wanted.
        if (startConfig.special === 'story_mode') {
            try {
                window._mapDirOverride = 'images/Map2';
                window._testworld1 = { loaded: false, mapName: 'Map2' };
                if (typeof Renderer !== 'undefined' && Renderer._reloadTestworld1) {
                    Renderer._reloadTestworld1();
                    console.log('[map-pool] Story mode start -> swapped to Map2');
                }
            } catch (e) { console.warn('[map-pool] story-mode swap failed:', e); }
        } else {
            // v9p33river308: non-story modes — re-randomize the map for each
            // new game. _loadTestworld1 only picks once at boot and caches the
            // result on window._testworld1.mapName, so without this re-pick
            // every Start Adventure in the same session used the same map.
            // Kicked off here (game-mode selection) so the fetch/image-load
            // completes during character creation, before Engine.generate runs.
            try {
                var _mapPool = ['Map1','Map2','Map3','Map4','Map5','Map6','Map7','Map8','Map9','Map10','Map11','Map12','Map13','Map14'];
                var _newMap = _mapPool[Math.floor(Math.random() * _mapPool.length)];
                window._mapDirOverride = 'images/' + _newMap;
                window._testworld1 = { loaded: false, mapName: _newMap };
                if (typeof Renderer !== 'undefined' && Renderer._reloadTestworld1) {
                    Renderer._reloadTestworld1();
                    console.log('[map-pool] ' + startConfig.id + ' start -> random map: ' + _newMap);
                }
            } catch (e) { console.warn('[map-pool] random-map swap failed:', e); }
        }

        // Hide mode selection, show char creation
        var el = _getGameModeScreenEl();
        el.style.display = 'none';

        showCharacterCreation();
    }

    function showCharacterCreation() {
        const titleScreen = document.getElementById('titleScreen');
        const charCreateScreen = document.getElementById('charCreateScreen');
        if (titleScreen) {
            titleScreen.classList.add('hidden');
            titleScreen.style.display = 'none';
        }
        if (charCreateScreen) {
            charCreateScreen.classList.remove('hidden');
            charCreateScreen.style.display = 'flex';
        }

        // Story mode: show last name as plain text "Ashford" (not editable)
        var lastNameEl = document.getElementById('charLastName');
        var lastNameGroup = lastNameEl ? lastNameEl.closest('.char-form-group') : null;
        if (lastNameGroup) {
            var isStory = window._selectedStartConfig && window._selectedStartConfig.id === 'story_mode';
            if (isStory) {
                // Replace input with static text
                lastNameGroup.innerHTML = '<label class="char-label">Last Name</label>' +
                    '<div style="padding:8px 12px;font-size:1rem;color:#d4a843;letter-spacing:1px;">Ashford</div>';
            } else {
                // Ensure the input exists (restore if previously replaced)
                if (!document.getElementById('charLastName')) {
                    lastNameGroup.innerHTML = '<label class="char-label" for="charLastName">Last Name</label>' +
                        '<input type="text" id="charLastName" class="char-input" maxlength="20" placeholder="Ashford" />';
                }
                var lnEl = document.getElementById('charLastName');
                if (lnEl) {
                    lnEl.value = '';
                    lnEl.readOnly = false;
                    lnEl.style.opacity = '';
                    lnEl.style.cursor = '';
                }
            }
        }

        // Portrait picker setup
        _setupPortraitPicker();
    }

    function _setupPortraitPicker() {
        var currentEl = document.getElementById('charPortraitCurrent');
        var gridEl = document.getElementById('charPortraitGrid');
        var portraitInput = document.getElementById('charPortrait');
        var skinToneInput = document.getElementById('charSkinTone');
        var faceTypeInput = document.getElementById('charFaceType');
        if (!currentEl || !gridEl) return;

        var isStory = window._selectedStartConfig && window._selectedStartConfig.id === 'story_mode';
        var sexRadios = document.querySelectorAll('input[name="charSex"]');

        function getSex() {
            var checked = document.querySelector('input[name="charSex"]:checked');
            return checked ? checked.value : 'M';
        }

        // Skin tone modifiers
        var SKIN_TONES_LOCAL = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
        var FACES_M = ['\u{1F468}', '\u{1F9D4}', '\u{1F471}\u200D\u2642\uFE0F', '\u{1F468}\u200D\u{1F9B1}', '\u{1F468}\u200D\u{1F9B0}', '\u{1F468}\u200D\u{1F9B3}', '\u{1F468}\u200D\u{1F9B2}'];
        var FACES_F = ['\u{1F469}', '\u{1F471}\u200D\u2640\uFE0F', '\u{1F469}\u200D\u{1F9B1}', '\u{1F469}\u200D\u{1F9B0}', '\u{1F469}\u200D\u{1F9B3}'];

        function applyTone(base, tIdx) {
            if (!tIdx || tIdx < 1) return base;
            var cp = Array.from(base);
            if (cp.length === 1) return cp[0] + SKIN_TONES_LOCAL[tIdx];
            return cp[0] + SKIN_TONES_LOCAL[tIdx] + cp.slice(1).join('');
        }

        function getAllowedTones() {
            // All tones available — parent tones will be derived from player's choice
            return [0, 1, 2, 3, 4, 5];
        }

        function buildGrid() {
            var sex = getSex();
            var faces = sex === 'F' ? FACES_F : FACES_M;
            var allowedTones = getAllowedTones();
            gridEl.innerHTML = '';
            // Rows = skin tones, columns = hair/face types
            for (var ti = 0; ti < allowedTones.length; ti++) {
                var tone = allowedTones[ti];
                var row = document.createElement('div');
                row.style.cssText = 'display:flex;justify-content:center;gap:2px;margin-bottom:2px;';
                for (var fi = 0; fi < faces.length; fi++) {
                    var emoji = applyTone(faces[fi], tone);
                    var btn = document.createElement('span');
                    btn.textContent = emoji;
                    btn.style.cssText = 'font-size:2rem;cursor:pointer;padding:4px 6px;border:2px solid transparent;border-radius:6px;transition:all 0.15s;display:inline-block;';
                    btn.dataset.fi = fi;
                    btn.dataset.ti = tone;
                    btn.dataset.emoji = emoji;
                    btn.addEventListener('mouseenter', function() { this.style.borderColor = 'var(--gold)'; this.style.transform = 'scale(1.15)'; });
                    btn.addEventListener('mouseleave', function() { this.style.borderColor = 'transparent'; this.style.transform = ''; });
                    btn.addEventListener('click', function() {
                        currentEl.textContent = this.dataset.emoji;
                        portraitInput.value = this.dataset.emoji;
                        skinToneInput.value = this.dataset.ti;
                        faceTypeInput.value = this.dataset.fi;
                        gridEl.style.display = 'none';
                    });
                    row.appendChild(btn);
                }
                gridEl.appendChild(row);
            }
        }

        // Random initial portrait
        function randomize() {
            var sex = getSex();
            var faces = sex === 'F' ? FACES_F : FACES_M;
            var allowedTones = getAllowedTones();
            var fi = Math.floor(Math.random() * faces.length);
            var ti = allowedTones[Math.floor(Math.random() * allowedTones.length)];
            var emoji = applyTone(faces[fi], ti);
            currentEl.textContent = emoji;
            portraitInput.value = emoji;
            skinToneInput.value = ti;
            faceTypeInput.value = fi;
        }

        // Toggle grid on click
        currentEl.onclick = function() {
            if (gridEl.style.display === 'none' || !gridEl.style.display) {
                buildGrid();
                gridEl.style.display = 'flex';
            } else {
                gridEl.style.display = 'none';
            }
        };

        // Rebuild when sex changes
        for (var ri = 0; ri < sexRadios.length; ri++) {
            sexRadios[ri].addEventListener('change', function() {
                randomize();
                if (gridEl.style.display === 'flex') buildGrid();
            });
        }

        randomize();
    }

    // ═══════════════════════════════════════════════════════════
    //  STORY MODE WORLD SETUP
    // ═══════════════════════════════════════════════════════════
    function _setupStoryWorld() {
        var towns = Engine.getTowns();
        var kingdoms = Engine.getKingdoms();
        console.log('[StoryMode] _setupStoryWorld: towns=' + (towns ? towns.length : 0) + ' kingdoms=' + (kingdoms ? kingdoms.length : 0));
        if (!towns || towns.length < 4 || !kingdoms || kingdoms.length < 2) {
            console.warn('[StoryMode] _setupStoryWorld BAILED — not enough towns/kingdoms');
            return;
        }

        // Pick two kingdoms: Valdren (player's) and Korvath (enemy)
        var valdren = kingdoms[0];
        var korvath = kingdoms.length > 1 ? kingdoms[1] : null;
        valdren.name = 'Valdren';
        if (korvath) korvath.name = 'Korvath';

        // Story mode: Valdren should NOT have guild restrictions (player needs to build freely)
        if (valdren.laws) valdren.laws.guildRestrictions = false;

        // Story mode: remove horse permit requirement from all kingdoms
        if (valdren.laws && valdren.laws.specialLaws) {
            valdren.laws.specialLaws = valdren.laws.specialLaws.filter(function(l) { return l.id !== 'draft_animal_law'; });
        }
        if (korvath && korvath.laws && korvath.laws.specialLaws) {
            korvath.laws.specialLaws = korvath.laws.specialLaws.filter(function(l) { return l.id !== 'draft_animal_law'; });
        }
        // Remove from all other kingdoms too
        for (var ki = 0; ki < kingdoms.length; ki++) {
            if (kingdoms[ki].laws && kingdoms[ki].laws.specialLaws) {
                kingdoms[ki].laws.specialLaws = kingdoms[ki].laws.specialLaws.filter(function(l) { return l.id !== 'draft_animal_law'; });
            }
        }

        // Find towns in Valdren (excluding islands — story towns must be
        // land-based mainland settlements, not floating port-villages).
        var valdrenTowns = towns.filter(function(t) { return t.kingdomId === valdren.id && !t.isIsland; });
        if (valdrenTowns.length < 3) {
            // v9p33river312: prior fallback used `towns.slice(0, 3)` which
            // would rename towns belonging to OTHER kingdoms into story
            // towns, corrupting world layout. Bail out with a logged
            // warning instead — Valdren just doesn't get story towns
            // assigned (story mode shouldn't have triggered with fewer
            // than 3 Valdren mainland towns anyway).
            console.warn('[StoryMode] Not enough Valdren mainland towns (' + valdrenTowns.length + '); skipping story-town rename to avoid corrupting other kingdoms.');
            return;
        }

        // Rename first 3 Valdren towns to story towns
        valdrenTowns[0].name = 'Ashford';
        if (valdrenTowns.length > 1) valdrenTowns[1].name = 'Millhaven';
        if (valdrenTowns.length > 2) valdrenTowns[2].name = 'Ferrowdale';

        // v9p33river143/146: Valdren capital city is ALWAYS Millhaven —
        // the renamed valdrenTowns[1]. Force the capital pointer to it
        // even if worldgen had assigned a different town. Capital cannot
        // be Ashford or Ferrowdale (story plot beats).
        var _valdrenCapital = null;
        if (valdrenTowns.length > 1) {
            _valdrenCapital = valdrenTowns[1]; // already named 'Millhaven' above
        }
        if (_valdrenCapital) {
            valdren.capitalTownId = _valdrenCapital.id;
            // Promote to capital city tier with the appropriate stats
            if ((_valdrenCapital.population || 0) < 300) _valdrenCapital.population = 320;
            _valdrenCapital.category = 'capital_city';
            _valdrenCapital.tier = 'capital';
            _valdrenCapital.isCapital = true;
            _valdrenCapital.maxBuildingSlots = (CONFIG.TOWN_CATEGORIES && CONFIG.TOWN_CATEGORIES.capital_city) ? CONFIG.TOWN_CATEGORIES.capital_city.maxBuildingSlots : 35;
            _valdrenCapital._lockedCategory = 'capital_city'; // stays a capital city all of story mode
        }

        // v9p33river146: ensure no OTHER Valdren town shares the protected
        // story-mode names (Ashford, Millhaven, Ferrowdale). If worldgen
        // happened to generate one of those names for another town, rename
        // it to a unique fallback so map labels stay unambiguous.
        var _protectedIds = {};
        if (valdrenTowns[0]) _protectedIds[valdrenTowns[0].id] = true; // Ashford
        if (valdrenTowns[1]) _protectedIds[valdrenTowns[1].id] = true; // Millhaven
        if (valdrenTowns[2]) _protectedIds[valdrenTowns[2].id] = true; // Ferrowdale
        var _protectedNames = { 'Ashford': true, 'Millhaven': true, 'Ferrowdale': true };
        var _fallbackPool = ['Brookhollow', 'Westhaven', 'Greenford', 'Stonebridge', 'Northwatch', 'Eastvale', 'Highmeadow', 'Southkeep', 'Ravenford', 'Larkspur', 'Thornfield', 'Wheatley', 'Oakridge', 'Willowmere'];
        var _usedNames = {};
        for (var _vti2 = 0; _vti2 < valdrenTowns.length; _vti2++) {
            _usedNames[valdrenTowns[_vti2].name] = true;
        }
        for (var _vti3 = 0; _vti3 < valdrenTowns.length; _vti3++) {
            var _vt = valdrenTowns[_vti3];
            if (_protectedIds[_vt.id]) continue;
            if (_protectedNames[_vt.name]) {
                // Find an unused fallback name
                var _picked = null;
                for (var _fpi = 0; _fpi < _fallbackPool.length; _fpi++) {
                    if (!_usedNames[_fallbackPool[_fpi]]) { _picked = _fallbackPool[_fpi]; break; }
                }
                if (!_picked) _picked = 'Valdren ' + (_vti3 + 1); // last-resort
                _usedNames[_picked] = true;
                delete _usedNames[_vt.name];
                _vt.name = _picked;
            }
        }

        // Ensure Ashford has required buildings
        var ashford = valdrenTowns[0];

        // v9p33river140/141: ensure Ashford starts at the 'town' tier — not
        // a village or city. After the game starts it can grow or decline
        // naturally; this just sets the initial state.
        if ((ashford.population || 0) < 60) {
            ashford.population = 80;
        }
        if ((ashford.population || 0) > 149) {
            // Trim down so the initial tier is unambiguously 'town'
            // (city threshold is 150). Engine can still grow it later.
            ashford.population = 149;
        }
        ashford.category = 'town';
        ashford.tier = 'town';
        ashford.maxBuildingSlots = (CONFIG.TOWN_CATEGORIES && CONFIG.TOWN_CATEGORIES.town) ? CONFIG.TOWN_CATEGORIES.town.maxBuildingSlots : 14;

        // Remove iron deposits from Ashford — iron comes from Korvathi (drives ch7-8 plot)
        if (ashford.naturalDeposits) delete ashford.naturalDeposits.iron_ore;

        var requiredBuildings = ['blacksmith', 'bakery', 'clinic'];
        var existingTypes = (ashford.buildings || []).map(function(b) { return b.type || b; });
        for (var i = 0; i < requiredBuildings.length; i++) {
            if (existingTypes.indexOf(requiredBuildings[i]) === -1) {
                ashford.buildings = ashford.buildings || [];
                ashford.buildings.push({ type: requiredBuildings[i], level: 1, ownerId: null, builtDay: -1000, condition: 'used', lastRepairDay: 0 });
            }
        }

        // Ensure Ashford market has cheap food and water for ch1 objectives
        if (!ashford.market) ashford.market = { supply: {}, prices: {} };
        var _storyFoods = { bread: 4, fish: 4, vegetables: 3, eggs: 2, water: 1 };
        for (var _sf in _storyFoods) {
            if (!ashford.market.supply[_sf] || ashford.market.supply[_sf] < 10) {
                ashford.market.supply[_sf] = 20;
            }
            if (!ashford.market.prices[_sf] || ashford.market.prices[_sf] > _storyFoods[_sf] * 2) {
                ashford.market.prices[_sf] = _storyFoods[_sf];
            }
        }

        // Ensure Ashford has building materials for cheapest houses (shack: wood 6, rope 1)
        var _buildMats = { wood: { qty: 30, price: 5 }, rope: { qty: 15, price: 10 }, planks: { qty: 20, price: 12 }, stone: { qty: 20, price: 6 } };
        for (var _bm in _buildMats) {
            if (!ashford.market.supply[_bm] || ashford.market.supply[_bm] < _buildMats[_bm].qty) {
                ashford.market.supply[_bm] = _buildMats[_bm].qty;
            }
            if (!ashford.market.prices[_bm] || ashford.market.prices[_bm] > _buildMats[_bm].price * 2) {
                ashford.market.prices[_bm] = _buildMats[_bm].price;
            }
        }

        // Ensure Ferrowdale has iron deposit but NO pre-built iron mine and NO iron ore in market
        if (valdrenTowns.length > 2) {
            var ferrowdale = valdrenTowns[2];
            // Remove any pre-existing iron mines (player builds their own in story)
            if (ferrowdale.buildings && ferrowdale.buildings.length) {
                ferrowdale.buildings = ferrowdale.buildings.filter(function(b) { return (b.type || b) !== 'iron_mine'; });
            }
            // Ensure iron deposit (naturalDeposits is what the engine uses for mining)
            if (!ferrowdale.naturalDeposits) ferrowdale.naturalDeposits = {};
            if (!ferrowdale.naturalDeposits.iron_ore || ferrowdale.naturalDeposits.iron_ore < 5000) {
                ferrowdale.naturalDeposits.iron_ore = 10000;
            }
            if (!ferrowdale.naturalDeposits.stone) {
                ferrowdale.naturalDeposits.stone = 5000;
            }

            // Ferrowdale: high demand for tools, low supply
            if (!ferrowdale.market) ferrowdale.market = { supply: {}, prices: {}, demand: {} };
            if (!ferrowdale.market.supply) ferrowdale.market.supply = {};
            if (!ferrowdale.market.prices) ferrowdale.market.prices = {};
            if (!ferrowdale.market.demand) ferrowdale.market.demand = {};
            ferrowdale.market.supply['tools'] = 20;      // decent supply from local smithing
            ferrowdale.market.demand['tools'] = 50;      // high demand
            ferrowdale.market.prices['tools'] = 18;      // good sell price due to demand

            // Ferrowdale has cheap raw materials from quarrying (but NO iron ore supply — no mines yet)
            ferrowdale.market.supply['iron_ore'] = 0;
            ferrowdale.market.prices['iron_ore'] = 12;    // base price, no cheap mining yet
            ferrowdale.market.supply['stone'] = 60;
            ferrowdale.market.prices['stone'] = 3;        // base 6, cheap from quarries
            ferrowdale.market.supply['salt'] = 40;
            ferrowdale.market.prices['salt'] = 4;         // base 7, mined locally
            ferrowdale.market.supply['wood'] = 50;
            ferrowdale.market.prices['wood'] = 3;         // base 5, nearby forests
            ferrowdale.market.supply['hide'] = 30;
            ferrowdale.market.prices['hide'] = 3;         // base 5, local ranching
        }

        // Name the Korvathi king
        if (korvath) {
            var korvathKing = Engine.findPerson(korvath.king);
            if (korvathKing) {
                korvathKing.firstName = 'Mordain';
            }
        }

        // Name the Valdren king
        var valdrenKing = Engine.findPerson(valdren.king);
        if (valdrenKing) {
            valdrenKing.lastName = 'Aldric';
        }

        // Story mode protections: remove tools from banned/restricted in Valdren
        if (valdren.laws) {
            if (valdren.laws.bannedGoods) {
                valdren.laws.bannedGoods = valdren.laws.bannedGoods.filter(function(g) { return g !== 'tools'; });
            }
            if (valdren.laws.restrictedGoods) {
                valdren.laws.restrictedGoods = valdren.laws.restrictedGoods.filter(function(g) { return g !== 'tools'; });
            }
        }

        // v9p33river142: helper — when we move a town in story setup,
        // every road that references it keeps its OLD waypoints (starting
        // at the previous town position), so the road appears 'cut off'
        // from the relocated town. This walks every road touching the
        // given town and rebuilds its waypoints from the current endpoint
        // positions.
        function _refreshRoadsForTown(townId) {
            if (!world || !world.roads) return;
            for (var rri = 0; rri < world.roads.length; rri++) {
                var rrr = world.roads[rri];
                if (rrr.fromTownId !== townId && rrr.toTownId !== townId) continue;
                var fromT = Engine.findTown(rrr.fromTownId);
                var toT = Engine.findTown(rrr.toTownId);
                if (!fromT || !toT) continue;
                _refreshExistingRoad(rrr, fromT, toT, rrr.quality);
            }
        }

        // v9p33river148: rewrite waypoints of an existing road via
        // findTerrainPath, so quality changes / town moves produce a
        // proper bridged path (no straight lines through ocean). Falls
        // back to a simple 3-point line if the path engine isn't available
        // or returns nothing usable.
        function _refreshExistingRoad(road, fromT, toT, quality) {
            road.quality = quality || road.quality || 2;
            road.type = 'land';
            // Invalidate render-side caches keyed on this road's prior geometry.
            // Without this, render.js culls based on a stale bbox or skips a
            // new path-lookup attempt and may show phantom road segments at
            // the OLD waypoint positions briefly during zoom transitions.
            if (road._bbox) delete road._bbox;
            if (road._waypointLookupDone) delete road._waypointLookupDone;
            if (typeof Engine !== 'undefined' && Engine.findTerrainPath) {
                try {
                    var pr = Engine.findTerrainPath(fromT.x, fromT.y, toT.x, toT.y, 'land');
                    if (pr && pr.waypoints && pr.waypoints.length >= 2) {
                        road.waypoints = pr.waypoints;
                        if (Engine.createBridgeObjects) {
                            road.bridges = Engine.createBridgeObjects(pr.waypoints) || [];
                            road.hasBridge = road.bridges.length > 0 || (pr.bridgeSegments || []).length > 0;
                            road.bridgeSegments = pr.bridgeSegments || [];
                        }
                        return;
                    }
                } catch(e) { /* fallthrough */ }
            }
            // v9p33river160: do NOT clobber waypoints with a straight 3-point
            // line — that's exactly what produces the visible phantom road
            // segments cutting diagonally through terrain. If terrain pathing
            // fails, keep whatever waypoints the road had (or, if it never had
            // any, leave it empty so renderer's `if (!hasWP) continue` skips
            // drawing it instead of cutting a straight line through the map).
            if (!road.waypoints || road.waypoints.length < 2) {
                road.waypoints = null;
            }
        }

        // v9p33river148: route building helper that respects engine rules
        // (water-fraction caps, bridge-span limits, no phantom roads).
        // Uses Engine.buildNewRoad when no road exists; refreshes the
        // existing road's quality + waypoints otherwise. Returns true on
        // success, false if Engine.buildNewRoad rejected the build.
        // v9p33river154: BFS that traverses junction nodes to detect an
        // already-existing path between two real towns. Used so we don't
        // create a parallel direct road when worldgen produced a
        // ``A → junction → B`` route (the naive direct-edge check missed
        // these and added duplicates — e.g. Ferrowdale ↔ Millhaven).
        function _findExistingTownPath(townAId, townBId) {
            if (!world || !world.roads || townAId === townBId) return null;
            var visited = {}; visited[townAId] = true;
            var queue = [townAId];
            while (queue.length) {
                var cur = queue.shift();
                for (var ri = 0; ri < world.roads.length; ri++) {
                    var r = world.roads[ri];
                    if (r.condition === 'destroyed') continue;
                    var nxt = null;
                    if (r.fromTownId === cur) nxt = r.toTownId;
                    else if (r.toTownId === cur) nxt = r.fromTownId;
                    if (!nxt || visited[nxt]) continue;
                    if (nxt === townBId) return true;
                    var nxtTown = Engine.findTown(nxt);
                    // Only continue traversal through junction transit nodes;
                    // arriving at any other real town doesn't count as the
                    // pair being directly connected for our purposes.
                    if (!nxtTown || (!nxtTown.isJunction && nxtTown.category !== 'junction')) continue;
                    visited[nxt] = true;
                    queue.push(nxt);
                }
            }
            return false;
        }

        function _ensureRoad(townA, townB, quality) {
            if (!world || !world.roads || !townA || !townB || townA.id === townB.id) return false;
            var aId = townA.id, bId = townB.id;
            var existing = null;
            for (var ri = 0; ri < world.roads.length; ri++) {
                var r = world.roads[ri];
                if ((r.fromTownId === aId && r.toTownId === bId) || (r.fromTownId === bId && r.toTownId === aId)) {
                    existing = r;
                    break;
                }
            }
            if (existing && existing.condition !== 'destroyed') {
                _refreshExistingRoad(existing, townA, townB, quality);
                return true;
            }
            // v9p33river154: also detect indirect (junction-spliced) existing
            // paths so we don't add a parallel direct road.
            if (_findExistingTownPath(aId, bId)) return true;
            if (typeof Engine !== 'undefined' && Engine.buildNewRoad) {
                var res = Engine.buildNewRoad(aId, bId, 'story', { quality: quality || 2 });
                if (res && res.success) return true;
                console.warn('[StoryMode] _ensureRoad rejected ' + (townA.name || aId) + '<->' + (townB.name || bId) + ': ' + (res && res.message));
                return false;
            }
            return false;
        }

        // v9p33river148: sea-route helper that respects engine rules
        // (both endpoints must be ports + ≥95% water path).
        function _ensureSeaRoute(townA, townB) {
            if (!world || !townA || !townB || townA.id === townB.id) return false;
            var aId = townA.id, bId = townB.id;
            // v9p33river316: was accepting any existing sea route between
            // these towns without revalidating that both endpoints are
            // still ports. If either town stopped being a port (lost
            // dock, conquered, demoted), the route was kept. Force
            // endpoint check; if invalid, rebuild.
            var _existing = world.seaRoutes && world.seaRoutes.findIndex(function(sr) {
                return (sr.fromTownId === aId && sr.toTownId === bId) || (sr.fromTownId === bId && sr.toTownId === aId);
            });
            if (_existing != null && _existing >= 0) {
                if (townA.isPort && townB.isPort) return true;
                // Stale route — remove and rebuild
                world.seaRoutes.splice(_existing, 1);
                console.warn('[StoryMode] _ensureSeaRoute removed stale route ' + (townA.name || aId) + '<->' + (townB.name || bId) + ' (endpoint no longer port)');
            }
            if (typeof Engine !== 'undefined' && Engine.buildNewSeaRoute) {
                var res = Engine.buildNewSeaRoute(aId, bId, 'story', {});
                if (res && res.success) return true;
                console.warn('[StoryMode] _ensureSeaRoute rejected ' + (townA.name || aId) + '<->' + (townB.name || bId) + ': ' + (res && res.message));
                return false;
            }
            return false;
        }

        // Ensure road between Ashford and Ferrowdale is short (~2 days walk)
        var world = Engine.getWorld();

        if (world && valdrenTowns.length > 2) {
            var ashfordId = valdrenTowns[0].id;
            var ferrowdaleId = valdrenTowns[2].id;
            var ashford_t = valdrenTowns[0];
            var ferrowdale_t = valdrenTowns[2];

            // Move Ferrowdale close to Ashford if too far. v9p33river145:
            // bumped both the max-allowed distance (200 -> 300) and the
            // re-snap target (180 -> 270) by ~50% per user request — gives
            // Ferrowdale a bit more breathing room from Ashford.
            var dist = Math.hypot(ashford_t.x - ferrowdale_t.x, ashford_t.y - ferrowdale_t.y);
            var maxDist = 300;
            if (dist > maxDist) {
                var angle = Math.atan2(ferrowdale_t.y - ashford_t.y, ferrowdale_t.x - ashford_t.x);
                ferrowdale_t.x = Math.round(ashford_t.x + Math.cos(angle) * 270);
                ferrowdale_t.y = Math.round(ashford_t.y + Math.sin(angle) * 270);
                _refreshRoadsForTown(ferrowdaleId);
            }

            // v9p33river143: don't force Ferrowdale's port status either way.
            // Let Engine.reconcilePortStatus() decide based on actual ocean
            // proximity (5 tiles). Previously this hard-set isPort=false to
            // force a land road, but the road-type is independent of the
            // town's port flag — we only need to drop sea ROUTES between the
            // two towns (handled below).
            ferrowdale_t.hasHarbor = false;

            // Remove any sea routes between Ashford and Ferrowdale
            if (world.seaRoutes) {
                world.seaRoutes = world.seaRoutes.filter(function(sr) {
                    return !((sr.fromTownId === ashfordId && sr.toTownId === ferrowdaleId) ||
                             (sr.fromTownId === ferrowdaleId && sr.toTownId === ashfordId));
                });
            }

            // v9p33river149: Millhaven (the Valdren capital) must sit at
            // least 500 px from BOTH Ashford and Ferrowdale. If it doesn't,
            // try 16 candidate angles around Ashford at 600-800 px radius
            // and pick the first that's >=500 px from Ferrowdale (and on
            // buildable land, if engine knows). Refresh roads touching it.
            if (_valdrenCapital && _valdrenCapital !== ashford_t && _valdrenCapital !== ferrowdale_t) {
                var dA = Math.hypot(_valdrenCapital.x - ashford_t.x, _valdrenCapital.y - ashford_t.y);
                var dF = Math.hypot(_valdrenCapital.x - ferrowdale_t.x, _valdrenCapital.y - ferrowdale_t.y);
                if (dA < 500 || dF < 500) {
                    var _ts = (typeof CONFIG !== 'undefined' && CONFIG.TILE_SIZE) ? CONFIG.TILE_SIZE : 16;
                    var _gridCols = world.gridCols || 9999;
                    var _gridRows = world.gridRows || 9999;
                    function _isBuildableForCapital(px, py) {
                        if (typeof Engine === 'undefined' || !Engine.getTerrainAtPixel) return true;
                        try {
                            var tt = Engine.getTerrainAtPixel(px, py);
                            return tt !== 2 && tt !== 3; // not water, not impassable mountain
                        } catch(e) { return true; }
                    }
                    var bestPick = null;
                    var radiiTry = [600, 650, 700, 750, 800];
                    for (var _ri = 0; _ri < radiiTry.length && !bestPick; _ri++) {
                        var R = radiiTry[_ri];
                        for (var _ai = 0; _ai < 16 && !bestPick; _ai++) {
                            var theta = (_ai / 16) * Math.PI * 2;
                            var px = Math.round(ashford_t.x + Math.cos(theta) * R);
                            var py = Math.round(ashford_t.y + Math.sin(theta) * R);
                            // Stay in-bounds with a tile-margin
                            if (px < _ts * 2 || px > (_gridCols - 2) * _ts) continue;
                            if (py < _ts * 2 || py > (_gridRows - 2) * _ts) continue;
                            var d2F = Math.hypot(px - ferrowdale_t.x, py - ferrowdale_t.y);
                            if (d2F < 500) continue;
                            if (!_isBuildableForCapital(px, py)) continue;
                            bestPick = { x: px, y: py };
                        }
                    }
                    // Final fallback: 600 px directly opposite from Ferrowdale relative to Ashford
                    if (!bestPick) {
                        var fallAngle = Math.atan2(ashford_t.y - ferrowdale_t.y, ashford_t.x - ferrowdale_t.x);
                        bestPick = {
                            x: Math.round(ashford_t.x + Math.cos(fallAngle) * 600),
                            y: Math.round(ashford_t.y + Math.sin(fallAngle) * 600),
                        };
                    }
                    _valdrenCapital.x = bestPick.x;
                    _valdrenCapital.y = bestPick.y;
                    _refreshRoadsForTown(_valdrenCapital.id);
                }
            }

            // (note: _refreshExistingRoad and _ensureRoad are defined at
            // the top of _setupStoryWorld and used everywhere below.)

            // Ensure a quality 3 land road exists Ashford↔Ferrowdale
            // (uses _ensureRoad → engine rules: water-fraction caps,
            //  bridge-span limits, no phantom roads).
            _ensureRoad(ashford_t, ferrowdale_t, 3);

            // v9p33river143: ensure both Ashford and Ferrowdale can reach
            // the Valdren capital (directly or through the Valdren road
            // network). BFS over Valdren roads from Ashford and from
            // Ferrowdale; if either can't reach the capital, add a direct
            // quality-2 road to it.
            if (_valdrenCapital && world.roads) {
                var _valdrenSet = {};
                for (var _vti = 0; _vti < valdrenTowns.length; _vti++) _valdrenSet[valdrenTowns[_vti].id] = true;
                var _capId = _valdrenCapital.id;

                function _canReachCapitalViaValdren(startId) {
                    if (startId === _capId) return true;
                    var visited = {}; visited[startId] = true;
                    var queue = [startId];
                    while (queue.length) {
                        var cur = queue.shift();
                        for (var _ri = 0; _ri < world.roads.length; _ri++) {
                            var _r = world.roads[_ri];
                            if (_r.condition === 'destroyed') continue;
                            var nxt = null;
                            if (_r.fromTownId === cur) nxt = _r.toTownId;
                            else if (_r.toTownId === cur) nxt = _r.fromTownId;
                            if (!nxt || visited[nxt]) continue;
                            // v9p33river154: traverse junction transit nodes
                            // too — kingdom worldgen splits long roads on
                            // junctions, so a Valdren-to-Valdren path may
                            // pass through one.
                            var _nxtTown = Engine.findTown(nxt);
                            var _isJunction = _nxtTown && (_nxtTown.isJunction || _nxtTown.category === 'junction');
                            if (!_valdrenSet[nxt] && !_isJunction) continue;
                            if (nxt === _capId) return true;
                            visited[nxt] = true;
                            queue.push(nxt);
                        }
                    }
                    return false;
                }

                // (note: _ensureRoad helper is defined above and uses
                // Engine.buildNewRoad to honor terrain rules)

                if (!_canReachCapitalViaValdren(ashfordId)) {
                    _ensureRoad(ashford_t, _valdrenCapital, 2);
                }
                if (!_canReachCapitalViaValdren(ferrowdaleId)) {
                    _ensureRoad(ferrowdale_t, _valdrenCapital, 2);
                }

                // v9p33river145: Ferrowdale must have a direct road to at
                // least ONE Valdren town besides Ashford. If its only
                // existing direct neighbor in Valdren is Ashford, add a
                // direct road to the nearest other Valdren town (the
                // capital is preferred since it always exists).
                // v9p33river154: walk all roads from Ferrowdale, traversing
                // junction transit nodes — the first non-junction REAL town
                // reached on each path is a "neighbor". Without this,
                // Ferrowdale → junction → Millhaven looked like Ferrowdale
                // had no Valdren neighbor (and added a parallel direct road).
                var _ferroNeighbors = {};
                (function _findFerroNeighbors() {
                    var visited = {}; visited[ferrowdaleId] = true;
                    var queue = [ferrowdaleId];
                    while (queue.length) {
                        var cur = queue.shift();
                        for (var _rii = 0; _rii < world.roads.length; _rii++) {
                            var _rrr = world.roads[_rii];
                            if (_rrr.condition === 'destroyed') continue;
                            var _other = null;
                            if (_rrr.fromTownId === cur) _other = _rrr.toTownId;
                            else if (_rrr.toTownId === cur) _other = _rrr.fromTownId;
                            if (!_other || visited[_other]) continue;
                            var _otTown = Engine.findTown(_other);
                            var _otIsJ = _otTown && (_otTown.isJunction || _otTown.category === 'junction');
                            if (_otIsJ) {
                                visited[_other] = true;
                                queue.push(_other);
                                continue;
                            }
                            // Real town — record as neighbor (only if Valdren)
                            if (_valdrenSet[_other]) _ferroNeighbors[_other] = true;
                        }
                    }
                })();
                var _ferroHasOtherValdren = false;
                for (var _fnId in _ferroNeighbors) {
                    if (_fnId !== ashfordId) { _ferroHasOtherValdren = true; break; }
                }
                if (!_ferroHasOtherValdren) {
                    var _candidates = valdrenTowns.filter(function(t) {
                        return t.id !== ferrowdaleId && t.id !== ashfordId;
                    });
                    // Prefer the capital, then the nearest other Valdren town
                    _candidates.sort(function(a, b) {
                        if (a.id === _capId) return -1;
                        if (b.id === _capId) return 1;
                        var da = Math.hypot(a.x - ferrowdale_t.x, a.y - ferrowdale_t.y);
                        var db = Math.hypot(b.x - ferrowdale_t.x, b.y - ferrowdale_t.y);
                        return da - db;
                    });
                    if (_candidates.length > 0) {
                        _ensureRoad(ferrowdale_t, _candidates[0], 2);
                    }
                }
            }
        }

        // Connect Ashford to a Korvathi border town that supplies iron
        if (korvath && world) {
            // v9p33river147: exclude islands when picking the border town —
            // islands are floating villages with no roads to the rest of
            // Korvath, and moving one inland strands it as a 'port-island'
            // sitting in the middle of grass.
            var korvathTowns = towns.filter(function(t) { return t.kingdomId === korvath.id && !t.isIsland; });
            if (korvathTowns.length > 0) {
                // Pick closest Korvathi town to Ashford as the border/iron town
                var ashfordT = valdrenTowns[0];
                korvathTowns.sort(function(a, b) {
                    var da = Math.hypot(a.x - ashfordT.x, a.y - ashfordT.y);
                    var db = Math.hypot(b.x - ashfordT.x, b.y - ashfordT.y);
                    return da - db;
                });
                var borderTown = korvathTowns[0];

                // Ensure this town has iron deposits
                if (!borderTown.naturalDeposits) borderTown.naturalDeposits = {};
                if (!borderTown.naturalDeposits.iron_ore || borderTown.naturalDeposits.iron_ore < 2000) {
                    borderTown.naturalDeposits.iron_ore = 3000;
                }

                // Ensure it has iron ore in its market
                if (!borderTown.market) borderTown.market = { supply: {}, prices: {} };
                if (!borderTown.market.supply) borderTown.market.supply = {};
                if (!borderTown.market.prices) borderTown.market.prices = {};
                borderTown.market.supply['iron_ore'] = 100;
                borderTown.market.prices['iron_ore'] = 8;
                borderTown.market.supply['iron_bars'] = 40;
                borderTown.market.prices['iron_bars'] = 25;

                // Seed Ashford market with Korvathi iron (pre-war supply)
                if (ashfordT.market && ashfordT.market.supply) {
                    ashfordT.market.supply['iron_ore'] = 30;
                    ashfordT.market.prices['iron_ore'] = 14;
                    ashfordT.market.supply['iron_bars'] = 15;
                    ashfordT.market.prices['iron_bars'] = 35;
                }

                // v9p33river140: place the Korvathi border town at LEAST
                // 500 px from Ashford (was forced ≤250 — too close, the
                // 'foreign land' felt right next door). Cap at ~700 so the
                // road isn't absurdly long.
                var btDist = Math.hypot(ashfordT.x - borderTown.x, ashfordT.y - borderTown.y);
                var minBtDist = 500, maxBtDist = 700;
                var btMoved = false;
                if (btDist < minBtDist || btDist > maxBtDist) {
                    var btAngle = (btDist > 0)
                        ? Math.atan2(borderTown.y - ashfordT.y, borderTown.x - ashfordT.x)
                        : (Math.random() * Math.PI * 2);
                    var targetBtDist = (btDist < minBtDist) ? minBtDist + 50 : (maxBtDist - 50);
                    borderTown.x = Math.round(ashfordT.x + Math.cos(btAngle) * targetBtDist);
                    borderTown.y = Math.round(ashfordT.y + Math.sin(btAngle) * targetBtDist);
                    btMoved = true;
                }
                if (btMoved) _refreshRoadsForTown(borderTown.id);

                // Ensure a road exists between Ashford and the Korvathi
                // border town (uses _ensureRoad → Engine.buildNewRoad which
                // honors water/bridge/path-validity rules).
                _ensureRoad(ashfordT, borderTown, 2);

                // v9p33river140: ensure the border town is wired into
                // the rest of Korvath so it isn't a stub hanging only
                // off Ashford. Connect it to its 2 nearest fellow
                // Korvathi towns with quality-2 land roads if no link
                // already exists.
                var _otherKorvath = korvathTowns.filter(function(t) { return t.id !== borderTown.id; });
                _otherKorvath.sort(function(a, b) {
                    var da = Math.hypot(a.x - borderTown.x, a.y - borderTown.y);
                    var db = Math.hypot(b.x - borderTown.x, b.y - borderTown.y);
                    return da - db;
                });
                var _connectN = Math.min(2, _otherKorvath.length);
                for (var _ck = 0; _ck < _connectN; _ck++) {
                    _ensureRoad(borderTown, _otherKorvath[_ck], 2);
                }

                console.log('[StoryMode] Korvathi border town: ' + borderTown.name + ' connected to Ashford (~' + Math.round(Math.hypot(ashfordT.x - borderTown.x, ashfordT.y - borderTown.y)) + 'px) + ' + Math.min(2, korvathTowns.length - 1) + ' Korvath neighbors');
            }
        }

        // v9p33river143: re-reconcile port status now that towns may have
        // been moved (Ferrowdale + Korvath border). Promotes any town with
        // ocean within 5 tiles, demotes any without.
        try { if (Engine.reconcilePortStatus) Engine.reconcilePortStatus(); } catch(e) { /* defensive */ }
        // v9p33river154/157: dedupe parallel + redundant roads created by
        // worldgen + story setup (incl. removing direct A-B when an A-X-B
        // multi-hop path already serves the pair).
        try { if (Engine.deduplicateRoads) Engine.deduplicateRoads(); } catch(e) { /* defensive */ }
        // v9p33river167: repair stale endpoint anchors and sparse waypoint
        // chains without deleting roads (town connectivity must be preserved).
        try { if (Engine.repairSparseRoadWaypoints) Engine.repairSparseRoadWaypoints(); } catch(e) { /* defensive */ }
        // v9p33river188: splice any road that passes within 1 tile of an
        // unrelated town into two roads through that town (same quality)
        try { if (Engine.spliceRoadsThroughTowns) Engine.spliceRoadsThroughTowns({ tilesNear: 1 }); } catch(e) { /* defensive */ }
        try { if (Engine.repairSparseRoadWaypoints) Engine.repairSparseRoadWaypoints(); } catch(e) { /* defensive */ }

        // v9p33river169: PHANTOM-DEBUG diagnostic block removed — phantom road
        // bug fixed (bridge stub double camera offset in render.js).
        // Engine.findRoadsNear() retained below as a useful runtime helper.
        if (typeof Engine !== 'undefined' && !Engine.findRoadsNear) {
            Engine.findRoadsNear = function(px, py, radius) {
                radius = radius || 50;
                var _w = Engine.getWorld(); if (!_w) return [];
                var _hits = [];
                for (var _i = 0; _i < (_w.roads||[]).length; _i++) {
                    var _r = _w.roads[_i];
                    var _wps = _r.waypoints || [];
                    var _from = Engine.findTown(_r.fromTownId);
                    var _to = Engine.findTown(_r.toTownId);
                    for (var _j = 0; _j < _wps.length; _j++) {
                        if (Math.hypot(_wps[_j].x - px, _wps[_j].y - py) <= radius) {
                            _hits.push({ idx: _i, road: _r, fromName: _from && _from.name, toName: _to && _to.name, wpIdx: _j, wpAt: _wps[_j], fromAt: _from && {x:_from.x,y:_from.y}, toAt: _to && {x:_to.x,y:_to.y}, condition: _r.condition, quality: _r.quality });
                            break;
                        }
                    }
                }
                console.log('[findRoadsNear] ' + _hits.length + ' road(s) within ' + radius + 'px of (' + px + ',' + py + ')');
                console.table(_hits.map(function(h){ return { idx:h.idx, from:h.fromName, to:h.toName, cond:h.condition, q:h.quality, wpIdx:h.wpIdx, wpX:Math.round(h.wpAt.x), wpY:Math.round(h.wpAt.y) }; }));
                return _hits;
            };
        }

        // v9p33river168: invalidate scene cache + per-road render caches now
        // that worldgen + story setup have finished mutating the world.
        // Without this, the low-zoom offscreen canvas can bake in stale
        // sea routes / road bbox / lazy-pathfind results from a transient
        // mid-setup state and persist them as phantom orange lines until
        // the user zooms past the cache invalidation thresholds.
        try {
            if (typeof Renderer !== 'undefined' && Renderer.invalidateSceneCache) {
                Renderer.invalidateSceneCache();
            }
        } catch(e) { /* defensive */ }
    }

    function startNewGame() {
        try {
            // Clean up tutorial if it was running
            if (typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.isActive()) {
                try { Tutorial.cleanup(); } catch(e) {}
            }

            // Read character creation form values
            const firstNameInput = document.getElementById('charFirstName');
            const lastNameInput = document.getElementById('charLastName');
            const sexRadio = document.querySelector('input[name="charSex"]:checked');

            const playerSex = sexRadio ? sexRadio.value : 'M';
            // Read portrait selection
            const portraitInput = document.getElementById('charPortrait');
            const skinToneInput = document.getElementById('charSkinTone');
            const faceTypeInput = document.getElementById('charFaceType');
            const playerPortrait = (portraitInput && portraitInput.value) || null;
            const playerSkinTone = (skinToneInput && parseInt(skinToneInput.value)) || 0;
            const playerFaceType = (faceTypeInput && parseInt(faceTypeInput.value)) || 0;
            var _startRng = (typeof Engine !== 'undefined' && Engine.getRng) ? Engine.getRng() : null;
            function _pickStartRandom(pool, fallback) {
                // v9p33river434: use Engine RNG fallback for start seeds/name rolls and guard empty name pools.
                if (!Array.isArray(pool) || pool.length === 0) return fallback;
                if (_startRng && _startRng.pick) return _startRng.pick(pool);
                return pool[0];
            }
            var _firstNamePool = typeof NAMES !== 'undefined' ? NAMES[playerSex === 'F' ? 'female' : 'male'] : null;
            var _surnamePool = typeof NAMES !== 'undefined' ? NAMES.surnames : null;
            // If name left blank, pick a random NPC-style name from NAMES pool
            const playerFirstName = (firstNameInput && firstNameInput.value.trim()) || _pickStartRandom(_firstNamePool, 'Unknown');
            var isStoryStart = window._selectedStartConfig && window._selectedStartConfig.id === 'story_mode';
            const playerLastName = isStoryStart ? 'Ashford' :
                ((lastNameInput && lastNameInput.value.trim()) || _pickStartRandom(_surnamePool, 'Merchant'));

            function _restoreCharacterCreationScreen() {
                var _ccs = document.getElementById('charCreateScreen');
                if (_ccs) {
                    // v9p33river434: put the character screen back if story start aborts after we hid it.
                    _ccs.classList.remove('hidden');
                    _ccs.style.display = 'flex';
                }
            }

            // Hide character creation screen
            const charCreateScreen = document.getElementById('charCreateScreen');
            if (charCreateScreen) {
                charCreateScreen.classList.add('hidden');
                charCreateScreen.style.display = 'none';
            }

            // Generate world. v9p33river150: story mode always uses a
            // fixed canonical seed (946612) so the Valdren/Korvath setup,
            // chapter beats, and world layout stay consistent for every
            // story playthrough. Free play still gets a random seed.
            if (typeof Engine !== 'undefined' && Engine.generate) {
                var _genSeed = isStoryStart ? 946612 : ((_startRng && _startRng.randInt) ? _startRng.randInt(1, 999999) : 1);
                Engine.generate(_genSeed);
            }

            // v9p18: assign per-tier settlement sprites at world gen
            if (window.Renderer && Renderer.assignSettlementSprites) {
                Renderer.assignSettlementSprites();
            }

            // Story Mode: set up story towns in the generated world
            const startConfig = window._selectedStartConfig || CONFIG.GAME_STARTS.find(s => s.id === 'normal') || null;
            if (startConfig && startConfig.special === 'story_mode') {
                _setupStoryWorld();
            }

            // Show kingdom/town selection screen
            // After player picks a town, finalize game start
            UI.init(); // init UI so modal system works

            // Story Mode: skip town selection, auto-select Ashford
            if (startConfig && startConfig.special === 'story_mode') {
                var storyTown = null;
                var allTowns = Engine.getTowns();
                console.log('[StoryMode] Towns generated:', allTowns.length);
                for (var sti = 0; sti < allTowns.length; sti++) {
                    if (allTowns[sti].name === 'Ashford') { storyTown = allTowns[sti]; break; }
                }
                if (!storyTown && allTowns.length > 0) storyTown = allTowns[0];
                var storyTownId = storyTown ? storyTown.id : null;
                console.log('[StoryMode] Story town:', storyTown ? storyTown.name : 'NONE', 'id:', storyTownId);

                // Hide ALL overlays — char create, game mode screen, title screen
                var cc2 = document.getElementById('charCreateScreen');
                if (cc2) { cc2.classList.add('hidden'); cc2.style.display = 'none'; }
                var gms = document.getElementById('gameModeScreen');
                if (gms) { gms.classList.add('hidden'); gms.style.display = 'none'; }
                var ts2 = document.getElementById('titleScreen');
                if (ts2) { ts2.classList.add('hidden'); ts2.style.display = 'none'; }

                try {
                    if (typeof Player !== 'undefined' && Player.init) {
                        const world = Engine.getWorld ? Engine.getWorld() : {};
                        console.log('[StoryMode] Calling Player.init with town:', storyTownId, 'config:', startConfig.id);
                        // Stash appearance so initStoryModeStart() can use it for parents
                        Player.skinTone = playerSkinTone;
                        Player.faceType = playerFaceType;
                        Player.init(world, playerFirstName, playerLastName, playerSex, storyTownId, startConfig);
                        // Set portrait after init (init may regenerate default portrait)
                        if (playerPortrait) {
                            Player.portrait = playerPortrait;
                        }
                        Player.skinTone = playerSkinTone;
                        Player.faceType = playerFaceType;
                        console.log('[StoryMode] Player.init complete. townId:', Player.townId, 'gold:', Player.gold, 'name:', Player.fullName);
                        delete window._selectedStartConfig;
                    }
                } catch (e) {
                    console.error('[StoryMode] Player.init FAILED:', e);
                    console.error('[StoryMode] Stack:', e.stack);
                    _restoreCharacterCreationScreen();
                    // Show error to user instead of silently failing
                    alert('Story mode failed to initialize: ' + e.message + '\nCheck console for details.');
                    return;
                }

                try {
                    const canvas = document.getElementById('gameCanvas');
                    const world = Engine.getWorld ? Engine.getWorld() : {};
                    console.log('[StoryMode] World terrain:', world.terrain ? world.terrain.length : 'NONE', 'towns:', (world.towns || []).length);
                    Renderer.init(canvas, world);
                    console.log('[StoryMode] Renderer.init complete. Player.townId:', Player.townId);
                    UI.showGameUI();
                    try { UI.update(); } catch (e) { console.warn('[StoryMode] UI.update warning:', e); }
                    setupInput();
                    state = 'playing';
                    speed = 1;
                    lastTickTime = performance.now();
                    tickAccumulator = 0;
                    tickCounter = 0;
                    lastFrameTime = performance.now();
                    var _initEvents = Engine.getEvents ? Engine.getEvents() : [];
                    _seedProcessedEvents(_initEvents);
                    if (!animFrameId) { loop(performance.now()); }
                    if (typeof Music !== 'undefined') Music.playGameMusic('peaceful');
                    startAutosave();
                    UI.toast('Welcome, ' + playerFirstName + '! Your story begins in ' + (storyTown ? storyTown.name : 'your hometown') + '.', 'info');
                    console.log('[StoryMode] Game started successfully');
                } catch (e) {
                    console.error('[StoryMode] Game start FAILED:', e);
                    console.error('[StoryMode] Stack:', e.stack);
                    _restoreCharacterCreationScreen();
                }
                return;
            }

            UI.showKingdomSelection(function (selectedTownId) {
                try {
                    // Initialize player with character info and selected town
                    if (typeof Player !== 'undefined' && Player.init) {
                        const world = Engine.getWorld ? Engine.getWorld() : {};
                        const startConfig = window._selectedStartConfig || CONFIG.GAME_STARTS.find(s => s.id === 'normal') || null;
                        Player.init(world, playerFirstName, playerLastName, playerSex, selectedTownId, startConfig);
                        if (playerPortrait) {
                            Player.portrait = playerPortrait;
                        }
                        // v9p33river434: keep chosen tone/face even when the portrait field is blank/defaulted.
                        Player.skinTone = playerSkinTone;
                        Player.faceType = playerFaceType;
                        delete window._selectedStartConfig;
                    }

                    // Initialize renderer
                    const canvas = document.getElementById('gameCanvas');
                    const world = Engine.getWorld ? Engine.getWorld() : {};
                    Renderer.init(canvas, world);

                    // Show game UI
                    UI.showGameUI();

                    // Force immediate UI refresh so ledger/HUD shows new player data
                    try { UI.update(); } catch (e) { /* no-op */ }

                    // Setup input handlers
                    setupInput();

                    // Start game loop
                    state = 'playing';
                    speed = 1;
                    lastTickTime = performance.now();
                    tickAccumulator = 0;
                    tickCounter = 0;
                    lastFrameTime = performance.now();
                    // Skip worldgen events — only toast events that occur after game starts
                    var _initEvents = Engine.getEvents ? Engine.getEvents() : [];
                    _seedProcessedEvents(_initEvents);

                    if (!animFrameId) {
                        loop(performance.now());
                    }

                    // Start game music
                    if (typeof Music !== 'undefined') Music.playGameMusic('peaceful');

                    // Start autosave timer
                    startAutosave();

                    const actualTown = Engine.findTown(Player.townId || selectedTownId);
                    const townName = actualTown ? actualTown.name : 'your town';
                    UI.toast(`Welcome, ${playerFirstName} ${playerLastName}! Your journey begins in ${townName}.`, 'info');
                } catch (e) {
                    console.error('Failed to start game after town selection:', e);
                }
            });

        } catch (e) {
            console.error('Failed to start game:', e);
            // Attempt to start with minimal setup
            try {
                const charCreateScreen = document.getElementById('charCreateScreen');
                if (charCreateScreen) {
                    charCreateScreen.classList.add('hidden');
                    charCreateScreen.style.display = 'none';
                }
                const canvas = document.getElementById('gameCanvas');
                Renderer.init(canvas, { terrain: [], kingdoms: [], towns: [], roads: [], people: [], events: [] });
                UI.init();
                UI.showGameUI();
                try { UI.update(); } catch (e) { /* no-op */ }
                setupInput();
                state = 'playing';
                if (!animFrameId) loop(performance.now());
                startAutosave();
            } catch (e2) {
                console.error('Minimal start also failed:', e2);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  GAME LOOP
    // ═══════════════════════════════════════════════════════════

    function loop(timestamp) {
        animFrameId = requestAnimationFrame(loop);

        const dt = timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        if (state !== 'playing' && state !== 'paused') return;

        // Handle continuous input (camera pan via keys)
        handleContinuousInput(dt);

        // Game tick (simulate time passing)
        if (state === 'playing' && speed > 0) {
            // Regency turbo mode: skip subticks, batch multiple days per frame
            var _isRegencyFF = typeof Player !== 'undefined' && Player.regencyMode && typeof UI !== 'undefined' && UI._regencyToastsSuppressed;
            if (_isRegencyFF) {
                // Batch multiple full days per frame (skip subtick overhead)
                var _regencyDaysPerFrame = 10;
                for (var _rd = 0; _rd < _regencyDaysPerFrame; _rd++) {
                    if (typeof Engine !== 'undefined' && Engine.tick) {
                        try { Engine.tick(); } catch (eTick) {
                            console.error('Engine.tick() error on day', Engine.getDay ? Engine.getDay() : '?', eTick);
                        }
                    }
                    if (typeof Player !== 'undefined' && Player.tick) {
                        try { Player.tick(); } catch (pTick) {
                            console.error('Player.tick() error on day', Engine.getDay ? Engine.getDay() : '?', pTick);
                        }
                    }
                    // Check if regency ended
                    if (!Player.regencyMode) {
                        checkEndConditions();
                        break;
                    }
                }
                tickAccumulator = 0;
                tickCounter = 0;
            } else {
                const tickInterval = CONFIG.SIM_TICK_INTERVAL / speed;
                tickAccumulator += dt;

                // Cap accumulator to prevent spiral of death
                if (tickAccumulator > tickInterval * 10) {
                    tickAccumulator = tickInterval * 10;
                }

                while (tickAccumulator >= tickInterval) {
                    tickAccumulator -= tickInterval;
                    gameTick();
                }
            }
        }

        // Render (skip frames during fast-forward for performance)
        _loopFrameCount++;
        var _isRegencyFF2 = typeof Player !== 'undefined' && Player.regencyMode && typeof UI !== 'undefined' && UI._regencyToastsSuppressed;
        if (_isRegencyFF2) {
            // During regency fast-forward: only update the regency overlay, skip all rendering
            // During regency fast-forward: only update the regency overlay, skip all rendering
            if (_loopFrameCount % 30 === 0) {
                try { UI.update(); } catch (e) { /* no-op */ }
            }
            // Update regency progress display every ~90 days (1 year) — every 9 frames at 10 days/frame
            if (_loopFrameCount % 9 === 0) {
                try { if (UI._updateRegencyFastForward) UI._updateRegencyFastForward(); } catch (e) { /* no-op */ }
            }
        } else {
            var _skipRender = speed > 2 && (_loopFrameCount % Math.floor(speed) !== 0);
            // At 60x speed, freeze map rendering entirely — only update UI
            var _freezeMap = speed >= 60;
            if (!_skipRender) {
                if (!_freezeMap) {
                    try {
                        const world = (typeof Engine !== 'undefined' && Engine.getWorld) ? Engine.getWorld() : null;
                        const player = (typeof Player !== 'undefined') ? Player : null;
                        Renderer.render(world, player);
                    } catch (e) {
                        console.error('Render error:', e);
                    }
                }

                // UI update (throttled — every ~6 loop frames)
                if (_loopFrameCount % 6 === 0) {
                    try { UI.update(); } catch (e) { console.error('UI update error:', e); }
                    try { if (UI.updateTravelPanel) UI.updateTravelPanel(); } catch (e) { /* no-op */ }
                    try { if (UI.updateJailPanel) UI.updateJailPanel(); } catch (e) { /* no-op */ }
                    try { if (UI.updateManhuntBanner) UI.updateManhuntBanner(); } catch (e) { /* no-op */ }
                    try { if (UI.updateTrialBanner) UI.updateTrialBanner(); } catch (e) { /* no-op */ }
                }
            }
            // At high speed, still update the day/year display every frame so it stays current
            if (_skipRender || _freezeMap) {
                try { if (UI.updateDateDisplay) UI.updateDateDisplay(); } catch (_e) { /* no-op */ }
                // v9p33river207: keep jail / manhunt / trial banners refreshing
                // during fast-forward so the day-remaining countdown stays
                // accurate (these are cheap DOM updates).
                if (_loopFrameCount % 3 === 0) {
                    try { if (UI.updateJailPanel) UI.updateJailPanel(); } catch (_e) { /* no-op */ }
                    try { if (UI.updateManhuntBanner) UI.updateManhuntBanner(); } catch (_e) { /* no-op */ }
                    try { if (UI.updateTrialBanner) UI.updateTrialBanner(); } catch (_e) { /* no-op */ }
                }
            }
        }
    }

    function gameTick() {
        try {
            tickCounter++;

            // Advance hour-of-day: each tick = 24/TICKS_PER_DAY hours
            if (typeof Engine !== 'undefined' && Engine.getWorld) {
                const w = Engine.getWorld();
                if (w) {
                    w.hour = Math.floor((tickCounter / CONFIG.TICKS_PER_DAY) * 24) % 24;
                }
            }

            // Sub-tick: advance player travel smoothly every tick
            if (typeof Player !== 'undefined' && Player.subtick) {
                Player.subtick();
            }

            // Sub-tick: process hospital treatment queues every tick
            if (typeof Engine !== 'undefined' && Engine.tickHospitals) {
                Engine.tickHospitals();
            }

            // Engine.tick() advances one full day, so only call it every TICKS_PER_DAY sim ticks
            if (tickCounter >= CONFIG.TICKS_PER_DAY) {
                tickCounter = 0;

                // Advance world simulation
                if (typeof Engine !== 'undefined' && Engine.tick) {
                    try {
                        Engine.tick();
                    } catch (eTick) {
                        console.error('Engine.tick() error on day', Engine.getDay ? Engine.getDay() : '?', eTick);
                        if (eTick && eTick.stack) console.error(eTick.stack);
                    }
                }

                // Advance player
                if (typeof Player !== 'undefined' && Player.tick) {
                    try {
                        Player.tick();
                    } catch (pTick) {
                        console.error('Player.tick() error on day', Engine.getDay ? Engine.getDay() : '?', pTick);
                        if (pTick && pTick.stack) console.error(pTick.stack);
                    }
                }

                // Check win/lose conditions
                checkEndConditions();

                // Update music mood based on game state
                updateMusicMood();

                // Every 30 days, check for console errors and notify if enabled
                checkErrorNotifications();
            }

            // Process events for notifications
            processEvents();

            emit('tick', { day: Engine.getDay ? Engine.getDay() : 0 });

        } catch (e) {
            console.error('Tick error:', e);
            if (e && e.stack) console.error('Stack:', e.stack);
            else if (e && e.message) console.error('Message:', e.message);
            else console.error('Tick error (non-Error object):', JSON.stringify(e));
        }
    }

    function advanceTicks(count) {
        // v9p33river434: ignore fractional / invalid counts and block direct ticks outside active gameplay.
        count = Math.floor(Number(count));
        if (!isFinite(count) || count <= 0) return;
        if (state !== 'playing' && state !== 'paused') return;
        for (let i = 0; i < count; i++) {
            gameTick();
        }
        // Check achievements after every player action (not just daily)
        if (typeof Player !== 'undefined' && Player.checkAchievements) {
            Player.checkAchievements();
        }
    }

    function checkEndConditions() {
        if (state !== 'playing') return;
        // Skip win/lose checks during tutorial
        if (typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.isActive()) return;

        try {
            if (typeof Player !== 'undefined') {
                // Win conditions no longer stop the game — they handle themselves
                if (Player.checkWinConditions) {
                    Player.checkWinConditions();
                }
                // Lose conditions still stop the game
                if (Player.checkLoseConditions) {
                    const lose = Player.checkLoseConditions();
                    if (lose) {
                        state = 'lost';
                        UI.showLoseScreen(lose);
                        emit('gameLost', { message: lose });
                    }
                }
            }
        } catch (e) {
            console.error('End condition check error:', e);
        }
    }

    let lastProcessedEventCount = 0;
    const _canTrackProcessedEvents = typeof WeakSet !== 'undefined';
    let _processedEventRefs = _canTrackProcessedEvents ? new WeakSet() : [];

    function _markEventProcessed(event) {
        if (!event || typeof event !== 'object') return;
        if (_canTrackProcessedEvents) _processedEventRefs.add(event);
        else if (_processedEventRefs.indexOf(event) === -1) _processedEventRefs.push(event);
    }

    function _hasProcessedEvent(event) {
        if (!event || typeof event !== 'object') return false;
        if (_canTrackProcessedEvents) return _processedEventRefs.has(event);
        return _processedEventRefs.indexOf(event) !== -1;
    }

    function _seedProcessedEvents(events) {
        _processedEventRefs = _canTrackProcessedEvents ? new WeakSet() : [];
        var _events = events || [];
        for (var _pei = 0; _pei < _events.length; _pei++) _markEventProcessed(_events[_pei]);
        lastProcessedEventCount = _events.length;
    }

    function processEvents() {
        try {
            const events = Engine.getEvents ? Engine.getEvents() : [];
            if (!events || events.length === 0) {
                lastProcessedEventCount = 0;
                return;
            }

            const newEvents = [];
            // v9p33river434: track processed event objects instead of array length so prune+append does not skip fresh events.
            for (let _ei = 0; _ei < events.length; _ei++) {
                if (!_hasProcessedEvent(events[_ei])) newEvents.push(events[_ei]);
            }

            if (newEvents.length > 0) {
                for (const event of newEvents) {
                    _markEventProcessed(event);
                    // Handle war allegiance popup (suppress during tutorial)
                    if (event.type === 'warDeclared') {
                        var tutorialActive = typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.isActive();
                        if (!tutorialActive && typeof Player !== 'undefined' && Player.shouldShowWarAllegiancePopup && Player.shouldShowWarAllegiancePopup(event)) {
                            // v9p33river186: in story mode, auto-side with
                            // Valdren — the player's home kingdom — without
                            // showing the war declaration UI. The story
                            // narrative makes Valdren the obvious side.
                            var inStory = typeof StoryMode !== 'undefined' && StoryMode.isActive && StoryMode.isActive();
                            // Auto-neutral only in the very early game (first 30 days)
                            var earlyGame = (Engine.getDay ? Engine.getDay() : 999) <= 30;
                            if (inStory) {
                                var valdrenK = null;
                                try {
                                    var _ks = Engine.getKingdoms ? Engine.getKingdoms() : [];
                                    for (var _vki = 0; _vki < _ks.length; _vki++) {
                                        if (_ks[_vki] && /valdren/i.test(_ks[_vki].name || '')) { valdrenK = _ks[_vki]; break; }
                                    }
                                } catch(e) {}
                                var valdrenSide = valdrenK ? valdrenK.id : null;
                                // Only auto-side if Valdren is one of the warring kingdoms
                                if (valdrenSide && (event.kingdomA === valdrenSide || event.kingdomB === valdrenSide)) {
                                    if (Player.setWarAllegiance) Player.setWarAllegiance(event.warId, valdrenSide);
                                    if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚔️ War declared! You stand with Valdren.', 'info', 'military');
                                } else {
                                    // Edge case: Valdren not part of war — stay neutral silently
                                    if (Player.setWarAllegiance) Player.setWarAllegiance(event.warId, 'neutral');
                                }
                            } else if (earlyGame) {
                                // New player — auto-neutral, no popup
                                if (Player.setWarAllegiance) Player.setWarAllegiance(event.warId, 'neutral');
                                if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚔️ War declared! You remain neutral for now.', 'info', 'military');
                            } else {
                                // Established player — always show allegiance choice
                                if (typeof UI !== 'undefined' && UI.showWarAllegiancePopup) {
                                    UI.showWarAllegiancePopup(event);
                                }
                            }
                        }
                    }

                    // Handle war end — process allegiance consequences
                    if (event.type === 'warEnded') {
                        if (typeof Player !== 'undefined' && Player.processWarEnd) {
                            Player.processWarEnd(event);
                        }
                    }

                    // eventLog entries have { day, message }, not { type, description }
                    const msg = event.description || event.message || event.type || '';
                    if (!msg || msg === 'undefined') continue;
                    const type = (event.type || msg || '').toLowerCase();
                    let toastType = 'info';
                    if (type.includes('war') || type.includes('plague') || type.includes('assassin') || type.includes('coup') || type.includes('overthrown')) {
                        toastType = 'danger';
                    } else if (type.includes('bandit') || type.includes('drought') || type.includes('flood') || type.includes('surrender')) {
                        toastType = 'warning';
                    } else if (type.includes('festival') || type.includes('bountiful') || type.includes('wedding') || type.includes('discovery')) {
                        toastType = 'success';
                    }
                    // Don't double-toast warDeclared/warEnded (they have their own UI handling)
                    if (type !== 'wardeclared' && type !== 'warended' && type !== 'kingoverthrown') {
                        // Pass event category so notification filter can suppress non-player toasts
                        // Pass _skipEventLog=true to prevent circular toast→logEvent→processEvents→toast loop
                        var evtCategory = event.category || 'local_town';
                        // v9p33river374: skip toasts for events explicitly marked log-only
                        if (event.details && event.details._noToast) { /* log-only event */ }
                        // v9p33river377: let notification visibility inspect the full event context before any popup is shown.
                        else if (typeof Player !== 'undefined' && Player.shouldShowNotification &&
                            !Player.shouldShowNotification(evtCategory, event, msg)) { /* filtered */ }
                        // v9p33river377: local_town toasts only make sense when the player is actually in that town.
                        else if (evtCategory === 'local_town' && event.townId) {
                            var _pTownId = (typeof Player !== 'undefined' && Player.state) ? Player.state.townId : null;
                            if (_pTownId && event.townId === _pTownId) {
                                UI.toast(msg, toastType, evtCategory, true);
                            }
                        } else {
                            UI.toast(msg, toastType, evtCategory, true);
                        }
                    }
                    emit('eventOccurred', event);
                }
            }
            lastProcessedEventCount = events.length;
        } catch (e) {
            console.error('Event processing error:', e);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  SPEED CONTROL
    // ═══════════════════════════════════════════════════════════

    function setSpeed(s) {
        // Block manual speed changes during regency fast-forward
        if (typeof UI !== 'undefined' && UI._regencyToastsSuppressed) return;
        speed = s;
        var _activeGameplayState = state === 'playing' || state === 'paused';
        // v9p33river434: avoid mutating title / won / lost states when UI helpers call setSpeed(0/1).
        if (_activeGameplayState) {
            if (s === 0) {
                state = 'paused';
            } else if (state === 'paused') {
                state = 'playing';
            }
        }
        updateSpeedButtons();
        emit('speedChanged', { speed: s });
        // Speed warning banner
        var _swb = document.getElementById('speedWarningBanner');
        if (_swb) _swb.style.display = (s >= 60) ? 'block' : 'none';
        // Enforce zoom-speed limits — zoom in when speeding up
        if (typeof Renderer !== 'undefined' && Renderer.getCamera) {
            var cam = Renderer.getCamera();
            var minZ = 0.5;
            if (s >= 16) minZ = 1.5;
            else if (s >= 4) minZ = 1.0;
            if (cam.targetZoom < minZ) {
                cam.targetZoom = minZ;
            }
        }
    }

    function togglePause() {
        if (state === 'paused') {
            state = 'playing';
            speed = speed || 1;
        } else if (state === 'playing') {
            state = 'paused';
        }

        // Update speed button UI
        document.querySelectorAll('.btn-speed').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.speed) === (state === 'paused' ? 0 : speed));
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  INPUT HANDLING
    // ═══════════════════════════════════════════════════════════

    function setupInput() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        if (!window._inputWindowSetup) {
            window._inputWindowSetup = true;
            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('keyup', onKeyUp);
            window.addEventListener('resize', onResize);
        }

        if (window._inputSetupCanvas !== canvas) {
            window._inputSetupCanvas = canvas;
            // v9p33river434: bind listeners per live canvas so rebuilt canvases/minimaps still work after reloads.
            if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
            canvas.style.outline = 'none';
            canvas.addEventListener('mousedown', onMouseDown);
            canvas.addEventListener('mousemove', onMouseMove);
            canvas.addEventListener('mouseup', onMouseUp);
            canvas.addEventListener('mouseleave', onMouseLeave);
            canvas.addEventListener('wheel', onWheel, { passive: false });
            canvas.addEventListener('contextmenu', onContextMenu);
            canvas.addEventListener('dblclick', onDoubleClick);
            canvas.addEventListener('touchstart', onTouchStart, { passive: false });
            canvas.addEventListener('touchmove', onTouchMove, { passive: false });
            canvas.addEventListener('touchend', onTouchEnd);
            // v9p33river497: iPad fix — bind touchcancel and reset stuck touch
            // state on visibility change. Without this, an iOS interruption
            // (incoming call, app switch, alert) can leave touchIsDragging=true
            // forever, making subsequent taps silently fail.
            canvas.addEventListener('touchcancel', function(e) {
                if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
                touchStartPos = null;
                touchStartDist = null;
                touchLastPos = null;
                touchIsDragging = false;
                touchVelocity = { x: 0, y: 0 };
            });
        }
        canvas.focus({ preventScroll: true });

        const minimap = document.getElementById('minimapCanvas');
        if (minimap && window._inputSetupMinimap !== minimap) {
            window._inputSetupMinimap = minimap;
            minimap.addEventListener('mousedown', onMinimapClick);
            minimap.addEventListener('mousemove', function (e) {
                if (e.buttons === 1) onMinimapClick(e);
            });
        }
    }

    function onMouseDown(e) {
        if (state !== 'playing' && state !== 'paused') return;
        if (typeof Renderer !== 'undefined' && Renderer.getMapMode() === 2) return;
        if (e.button === 0) { // left click
            input.mouseDown = true;
            input.mouseDragStart = { x: e.clientX, y: e.clientY };
            input.isDragging = false;
        }
    }

    // v9p33river434: guard rebuilt/missing render surfaces so mouse handlers fail closed instead of throwing.
    function onMouseMove(e) {
        input.mouseX = e.clientX;
        input.mouseY = e.clientY;
        if (typeof Renderer === 'undefined') return;
        if (Renderer.getMapMode && Renderer.getMapMode() === 2) return;
        if (speed >= 60) return; // Map frozen at 60x

        if (input.mouseDown && input.mouseDragStart) {
            const dx = e.clientX - input.mouseDragStart.x;
            const dy = e.clientY - input.mouseDragStart.y;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                input.isDragging = true;
                Renderer.pan(-dx, -dy);
                input.mouseDragStart = { x: e.clientX, y: e.clientY };
                var _dragCanvas = document.getElementById('gameCanvas');
                if (_dragCanvas) _dragCanvas.style.cursor = 'grabbing';
            }
        } else {
            // Hover detection
            handleHover(e.clientX, e.clientY, e.shiftKey);
        }
    }

    function onMouseUp(e) {
        if (e.button === 0) {
            if (!input.isDragging && (state === 'playing' || state === 'paused')) {
                handleClick(e.clientX, e.clientY, e.shiftKey);
            }
            input.mouseDown = false;
            input.isDragging = false;
            input.mouseDragStart = null;
            var _mouseUpCanvas = document.getElementById('gameCanvas');
            if (_mouseUpCanvas) _mouseUpCanvas.style.cursor = 'default';
        }
    }

    function onMouseLeave() {
        input.mouseDown = false;
        input.isDragging = false;
        input.mouseDragStart = null;
        if (typeof UI !== 'undefined' && UI.hideTooltip) UI.hideTooltip();
        var _leaveCanvas = document.getElementById('gameCanvas');
        if (_leaveCanvas) _leaveCanvas.style.cursor = 'default';
    }

    function onWheel(e) {
        e.preventDefault();
        if (state !== 'playing' && state !== 'paused') return;
        if (typeof Renderer !== 'undefined' && Renderer.getMapMode() === 2) return;
        if (speed >= 60) return; // Map frozen at 60x
        Renderer.zoomAt(e.deltaY, e.clientX, e.clientY);
    }

    function onContextMenu(e) {
        e.preventDefault();
        if (state !== 'playing' && state !== 'paused') return;
        if (typeof Renderer !== 'undefined' && Renderer.getMapMode() === 2) return;

        const hit = Renderer.hitTest(e.clientX, e.clientY);
        showContextMenuForHit(e.clientX, e.clientY, hit);
    }

    function onDoubleClick(e) {
        if (state !== 'playing' && state !== 'paused') return;
        if (typeof Renderer !== 'undefined' && Renderer.getMapMode() === 2) return;
        const hit = Renderer.hitTest(e.clientX, e.clientY);
        if (hit.type === 'town') {
            // Double-click town: pan to it and show details
            const ts = CONFIG.TILE_SIZE;
            Renderer.panTo(hit.data.x, hit.data.y);
            UI.showTownDetail(hit.data);
        }
    }

    // Touch support
    let touchStartPos = null;
    let touchStartDist = null;
    let touchIsDragging = false;
    let touchLastPos = null;
    let lastTapTime = 0;
    let longPressTimer = null;
    let touchVelocity = { x: 0, y: 0 };
    let lastTouchMoveTime = 0;
    let momentumId = null;

    // v9p33river434: only suppress browser touch behavior when the live game renderer is active.
    function onTouchStart(e) {
        if (state !== 'playing' && state !== 'paused') return;
        if (typeof Renderer === 'undefined') return;
        e.preventDefault();
        // v9p33river497: clear any stale state from an interrupted prior touch
        // session (iOS can drop touchend if the system interrupts). Without
        // this, touchIsDragging stuck true from a prior session means a fresh
        // tap is treated as the tail of a drag and never opens panels.
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        if (e.touches.length === 1 && !touchLastPos) {
            touchIsDragging = false;
        }
        // Cancel any ongoing momentum panning
        if (momentumId) { cancelAnimationFrame(momentumId); momentumId = null; }
        if (Renderer.getMapMode && Renderer.getMapMode() === 2) return;
        if (e.touches.length === 1) {
            touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            touchLastPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            touchIsDragging = false;
            // Long-press (500ms) = context menu (right-click equivalent)
            longPressTimer = setTimeout(function() {
                if (!touchIsDragging && touchStartPos) {
                    touchIsDragging = true; // prevent tap on release
                    var hit = Renderer.hitTest(touchStartPos.x, touchStartPos.y);
                    showContextMenuForHit(touchStartPos.x, touchStartPos.y, hit);
                }
            }, 500);
        } else if (e.touches.length === 2) {
            touchIsDragging = true; // pinch-zoom counts as drag
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            touchStartDist = Math.sqrt(dx * dx + dy * dy);
        }
    }

    function onTouchMove(e) {
        if (state !== 'playing' && state !== 'paused') return;
        if (typeof Renderer === 'undefined') return;
        e.preventDefault();
        if (Renderer.getMapMode && Renderer.getMapMode() === 2) return;
        if (e.touches.length === 1 && touchStartPos) {
            const dx = e.touches[0].clientX - touchStartPos.x;
            const dy = e.touches[0].clientY - touchStartPos.y;
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                touchIsDragging = true;
                if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
            }
            if (touchLastPos) {
                var moveX = e.touches[0].clientX - touchLastPos.x;
                var moveY = e.touches[0].clientY - touchLastPos.y;
                Renderer.pan(-moveX, -moveY);
                // Track velocity for momentum panning
                var now = Date.now();
                var dt = now - lastTouchMoveTime;
                if (dt > 0 && dt < 100) {
                    touchVelocity.x = moveX / dt * 16;
                    touchVelocity.y = moveY / dt * 16;
                }
                lastTouchMoveTime = now;
            }
            touchLastPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2 && touchStartDist) {
            touchIsDragging = true;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const delta = touchStartDist - dist;
            Renderer.zoomAt(delta, (e.touches[0].clientX + e.touches[1].clientX) / 2,
                (e.touches[0].clientY + e.touches[1].clientY) / 2);
            touchStartDist = dist;
        }
    }

    function onTouchEnd(e) {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        if (!touchIsDragging && touchStartPos && (state === 'playing' || state === 'paused')) {
            var now = Date.now();
            if (now - lastTapTime < 350) {
                // Double-tap: zoom in at tap location OR show town detail
                var hit = Renderer.hitTest(touchStartPos.x, touchStartPos.y);
                if (hit.type === 'town') {
                    Renderer.panTo(hit.data.x, hit.data.y);
                    UI.showTownDetail(hit.data);
                } else {
                    // Double-tap zoom on empty area
                    Renderer.zoomAt(-120, touchStartPos.x, touchStartPos.y);
                }
            } else {
                // Single tap: open town/person/road detail
                handleClick(touchStartPos.x, touchStartPos.y, false);
            }
            lastTapTime = now;
        } else if (touchIsDragging && e.touches.length === 0) {
            // Momentum panning after swipe
            var vx = touchVelocity.x;
            var vy = touchVelocity.y;
            if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
                if (momentumId) cancelAnimationFrame(momentumId);
                var friction = 0.92;
                function momentumStep() {
                    if (Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3) return;
                    Renderer.pan(-vx, -vy);
                    vx *= friction;
                    vy *= friction;
                    momentumId = requestAnimationFrame(momentumStep);
                }
                momentumId = requestAnimationFrame(momentumStep);
            }
        }
        touchStartPos = null;
        touchStartDist = null;
        touchLastPos = null;
        touchIsDragging = false;
        touchVelocity = { x: 0, y: 0 };
    }

    function onMinimapClick(e) {
        Renderer.minimapClick(e.clientX, e.clientY);
        window._tutorialMinimapClicked = true;
    }

    function onKeyDown(e) {
        // Skip if typing in input/select
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

        input.keys[e.key] = true;

        // Ctrl+S to save (quick save to last slot, or show picker)
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            saveGame();
            return;
        }

        switch (e.key) {
            case ' ':
                e.preventDefault();
                togglePause();
                break;
            case 'Escape':
                // Close world map first if open, otherwise close panels
                if (Renderer.getMapMode && Renderer.getMapMode() === 2) {
                    UI.closeMapView();
                } else {
                    UI.closeModal();
                    UI.closeRightPanel();
                    UI.hideContextMenu();
                }
                break;
            case '1': setSpeed(1); updateSpeedButtons(); break;
            case '2': setSpeed(4); updateSpeedButtons(); break;
            case '3': setSpeed(16); updateSpeedButtons(); break;
            case '4': setSpeed(60); updateSpeedButtons(); break;
            case '0':
            case 'p':
            case 'P':
                togglePause();
                break;
            case 't':
            case 'T':
                UI.openTradeDialog();
                break;
            case 'b':
            case 'B':
                UI.openBuildDialog();
                break;
            case 'h':
            case 'H':
                UI.openHireDialog();
                break;
            case 'c':
            case 'C':
                UI.openCaravanDialog();
                break;
            case 'l':
            case 'L':
                UI.openEventLog();
                break;
            case 'm':
            case 'M':
                UI.openMapView();
                break;
            case 'f':
                UI.locatePlayer();
                break;
            case 'r':
                Renderer.toggleDeposits();
                break;
            case '+':
            case '=':
                Renderer.zoomAt(-100, camera_center_x(), camera_center_y());
                break;
            case '-':
            case '_':
                Renderer.zoomAt(100, camera_center_x(), camera_center_y());
                break;
            case 'F1':
                e.preventDefault();
                UI.openHelpDialog();
                break;
        }
    }

    function camera_center_x() { return CONFIG.VIEWPORT_WIDTH / 2; }
    function camera_center_y() { return CONFIG.VIEWPORT_HEIGHT / 2; }

    function onKeyUp(e) {
        input.keys[e.key] = false;
    }

    // Clear all held keys when window loses focus (prevents stuck camera drift)
    window.addEventListener('blur', function() { input.keys = {}; });
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) input.keys = {};
    });

    function onResize() {
        if (typeof Renderer !== 'undefined') Renderer.resize();
    }

    function updateSpeedButtons() {
        const activeSpeed = state === 'paused' ? 0 : speed;
        document.querySelectorAll('.btn-speed').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.speed) === activeSpeed);
        });
    }

    // ── Continuous input (WASD / arrow keys for camera pan) ──

    function handleContinuousInput(dt) {
        if (speed >= 60) return; // Map frozen at 60x
        const panSpeed = 400 * (dt / 1000); // pixels per second
        if (input.keys['w'] || input.keys['W'] || input.keys['ArrowUp']) {
            Renderer.pan(0, -panSpeed);
        }
        if (input.keys['s'] || input.keys['S'] || input.keys['ArrowDown']) {
            Renderer.pan(0, panSpeed);
        }
        if (input.keys['a'] || input.keys['A'] || input.keys['ArrowLeft']) {
            Renderer.pan(-panSpeed, 0);
        }
        if (input.keys['d'] || input.keys['D'] || input.keys['ArrowRight']) {
            Renderer.pan(panSpeed, 0);
        }
    }

    // ── Click handling ──

    function handleClick(sx, sy, shiftKey) {
        // Check if click is on minimap
        if (Renderer.isMinimapClick(sx, sy)) return;

        const hit = Renderer.hitTest(sx, sy, { shiftKey: shiftKey || false });

        switch (hit.type) {
            case 'caravan':
                UI.openCaravanManagement();
                Renderer.setSelected(hit);
                break;
            case 'town':
                UI.showTownDetail(hit.data);
                Renderer.setSelected(hit);
                emit('townClicked', hit.data);
                break;
            case 'person':
                UI.showPersonDetail(hit.data);
                Renderer.setSelected(hit);
                emit('personClicked', hit.data);
                break;
            case 'road':
                UI.showRoadDetail(hit.data);
                Renderer.setSelected(hit);
                break;
            case 'empty':
                UI.closeRightPanel();
                Renderer.setSelected(null);
                break;
        }
    }

    // ── Hover handling ──

    function handleHover(sx, sy, shiftKey) {
        // Don't hover-test while dragging or if on UI elements
        if (input.mouseDown) return;
        if (Renderer.isMinimapClick(sx, sy)) {
            UI.hideTooltip();
            return;
        }

        const hit = Renderer.hitTest(sx, sy, { shiftKey: shiftKey || false });

        // Sticky person hover when shift is held — prevents flicker
        if (shiftKey && (hit.type === 'empty' || hit.type === 'town') && _lastPersonHover) {
            if (Date.now() - _lastPersonHover.time < PERSON_HOVER_STICKY_MS) {
                // Keep showing the last person tooltip
                const p = _lastPersonHover.data;
                var stickyTip = `${p.firstName || ''} ${p.lastName || ''}`;
                if (p.isEliteMerchant) {
                    stickyTip += '\n⭐ Elite Merchant';
                    if (p.heraldry && p.heraldry.name) stickyTip += ' (' + p.heraldry.symbol + ' ' + p.heraldry.name + ')';
                    if (p.strategy) stickyTip += '\n🎯 ' + p.strategy.charAt(0).toUpperCase() + p.strategy.slice(1);
                } else {
                    stickyTip += '\n' + (p.occupation || 'Unemployed');
                }
                UI.showTooltip(sx, sy, stickyTip);
                document.getElementById('gameCanvas').style.cursor = 'pointer';
                return;
            }
            _lastPersonHover = null;
        }

        if (hit.type === 'caravan' && hit.data) {
            var hc = hit.data;
            var hcFrom = '', hcTo = '';
            try {
                var hcFromTown = Engine.findTown(hc.fromTownId);
                var hcToTown = Engine.findTown(hc.toTownId);
                hcFrom = hcFromTown ? hcFromTown.name : '?';
                hcTo = hcToTown ? hcToTown.name : '?';
            } catch(e) {}
            var hcProgress = Math.round((hc.progress || 0) * 100);
            var hcGoods = hc.goods ? Object.values(hc.goods).reduce(function(a,b){return a+b;}, 0) : 0;
            var hcTip = '🛒 Caravan: ' + hcFrom + ' → ' + hcTo;
            hcTip += '\n' + (hc.returnTrip ? '↩️ Returning' : '→ Outbound') + ' — ' + hcProgress + '%';
            if (hcGoods > 0) hcTip += '\n📦 ' + hcGoods + ' goods';
            if (hc.disbanding) hcTip += '\n🏳️ Disbanding...';
            hcTip += '\n💡 Click to manage';
            Renderer.setHover({ type: 'caravan', data: hc });
            UI.showTooltip(sx, sy, hcTip);
            document.getElementById('gameCanvas').style.cursor = 'pointer';
        } else if (hit.type === 'army' && hit.data) {
            // v9p33river59: army-on-the-move tooltip
            var ha = hit.data;
            var haFrom = '', haTo = '', haKing = '';
            try {
                var haFromTown = Engine.findTown(ha.fromTownId);
                var haToTown = Engine.findTown(ha.toTownId);
                haFrom = haFromTown ? haFromTown.name : '?';
                haTo = haToTown ? haToTown.name : '?';
                var haK = Engine.findKingdom(ha.kingdomId);
                if (haK) haKing = haK.name || '';
            } catch(e) {}
            var haStatus;
            if (ha._retreating) haStatus = '🏳️ Retreating';
            else if (ha._besieging) haStatus = '🏰 Besieging ' + haTo;
            else if (ha._recoveryUntil) haStatus = '🛏️ Recovering';
            else if (ha._consolidating) haStatus = '📦 Consolidating';
            else if (ha.status === 'fighting') haStatus = '⚔️ Fighting';
            else if (ha.status === 'returning') haStatus = '🔙 Returning to ' + haTo;
            else haStatus = '🚶 Marching to ' + haTo;
            var haProg = Math.round(((ha.progress != null ? ha.progress : ha.legProgress) || 0) * 100);
            var haTip = '🛡️ Army (' + (haKing || 'Unknown Kingdom') + ')';
            haTip += '\n' + haStatus;
            if (haFrom) haTip += '\nFrom: ' + haFrom;
            haTip += '\n👥 ' + (ha.soldiers || 0) + ' soldiers';
            if (ha.mounted) haTip += ' 🐴 mounted';
            if (ha.morale != null) haTip += '\n💪 Morale: ' + Math.round(ha.morale);
            if (!ha._besieging && haProg > 0 && haProg < 100) haTip += '\n📍 Progress: ' + haProg + '%';
            if (ha.commander && ha.commander.name) haTip += '\n👤 ' + ha.commander.name;
            Renderer.setHover({ type: 'army', data: ha });
            UI.showTooltip(sx, sy, haTip);
            document.getElementById('gameCanvas').style.cursor = 'pointer';
        } else if (hit.type === 'town' && hit.data) {
            const town = hit.data;
            Renderer.setHover({ type: 'town', data: town });
            let tip = `${town.name}${town.isPort ? ' ⚓' : ''}${town.isIsland ? ' 🏝' : ''}\nPop: ${town.population || 0} | Prosperity: ${Math.round(town.prosperity || 0)}%`;

            // Show resource indicators if player is here or has regional_survey skill
            const canSeeResources = (typeof Player !== 'undefined') && (
                Player.townId === town.id ||
                (Player.hasSkill && Player.hasSkill('regional_survey') && Player.kingdomId === town.kingdomId)
            );
            if (canSeeResources) {
                // Natural deposits
                const deps = town.naturalDeposits || {};
                const depList = Object.entries(deps).filter(([,v]) => v > 0).map(([k]) => {
                    let icon = '';
                    for (const rk in RESOURCE_TYPES) { if (RESOURCE_TYPES[rk].id === k) { icon = RESOURCE_TYPES[rk].icon || ''; break; } }
                    return icon + k.replace(/_/g,' ');
                });
                if (depList.length) tip += `\n⛏ ${depList.join(', ')}`;

                // Livestock info
                if (town.livestock) {
                    const lvNames = [];
                    if (town.livestock.livestock_cow > 0) lvNames.push('🐄 Cattle (' + town.livestock.livestock_cow + ')');
                    if (town.livestock.livestock_pig > 0) lvNames.push('🐷 Pigs (' + town.livestock.livestock_pig + ')');
                    if (town.livestock.livestock_chicken > 0) lvNames.push('🐔 Poultry (' + town.livestock.livestock_chicken + ')');
                    if (lvNames.length) tip += '\n🐾 ' + lvNames.join(', ');
                }

                // Key production buildings
                if (town.buildings) {
                    const produces = new Set();
                    for (const b of town.buildings) {
                        for (const bk in BUILDING_TYPES) { if (BUILDING_TYPES[bk].id === b.type && BUILDING_TYPES[bk].produces) { produces.add(BUILDING_TYPES[bk].produces); break; } }
                    }
                    if (produces.size) {
                        const prodList = [...produces].slice(0, 6).map(p => {
                            let icon = '';
                            for (const rk in RESOURCE_TYPES) { if (RESOURCE_TYPES[rk].id === p) { icon = RESOURCE_TYPES[rk].icon || ''; break; } }
                            return icon + p.replace(/_/g,' ');
                        });
                        tip += `\n🏭 ${prodList.join(', ')}`;
                    }
                }
            }

            // Show shift-select hint for first N hovers
            if (townHoverHintCount < TOWN_HOVER_HINT_MAX) {
                tip += '\n💡 Hold Shift to select NPCs';
                townHoverHintCount++;
                try { localStorage.setItem('mr_townHoverHints', String(townHoverHintCount)); } catch(e) {}
            }

            UI.showTooltip(sx, sy, tip);
            document.getElementById('gameCanvas').style.cursor = 'pointer';
        } else if (hit.type === 'person' && hit.data) {
            const p = hit.data;
            Renderer.setHover({ type: 'person', data: p });
            var personTip = `${p.firstName || ''} ${p.lastName || ''}`;
            if (p.isEliteMerchant) {
                personTip += '\n⭐ Elite Merchant';
                if (p.heraldry && p.heraldry.name) personTip += ' (' + p.heraldry.symbol + ' ' + p.heraldry.name + ')';
                if (p.strategy) personTip += '\n🎯 ' + p.strategy.charAt(0).toUpperCase() + p.strategy.slice(1);
            } else {
                personTip += '\n' + (p.occupation || 'Unemployed');
            }
            UI.showTooltip(sx, sy, personTip);
            document.getElementById('gameCanvas').style.cursor = 'pointer';
            if (shiftKey) _lastPersonHover = { data: p, sx: sx, sy: sy, time: Date.now() };
        } else if (hit.type === 'road' && hit.data) {
            Renderer.setHover({ type: 'road', data: hit.data });
            const road = hit.data;
            UI.showTooltip(sx, sy, `Road: ${road.fromTown?.name || '?'} → ${road.toTown?.name || '?'}\nQuality: ${road.quality || 1} | ${(road.banditThreat || 0) > (CONFIG.BANDIT_THREAT_DANGER_THRESHOLD || 50) ? '☠ Dangerous (Bandits!)' : 'Safe'}${road.isTollRoad ? ' | 💰 Toll: ' + (road.tollRate || 0) + 'g' : ''}${road.hasBridge && road.bridgeDestroyed ? ' | ❌ Bridge Destroyed' : road.hasBridge ? ' | 🌉 Bridge' : ''}`);
            document.getElementById('gameCanvas').style.cursor = 'pointer';
        } else if (hit.type === 'seaRoute' && hit.data) {
            Renderer.setHover({ type: 'seaRoute', data: hit.data });
            const sr = hit.data;
            UI.showTooltip(sx, sy, `⛵ Sea Route: ${sr.fromTown?.name || '?'} → ${sr.toTown?.name || '?'}\nDist: ${Math.round(sr.distance || 0)} | ${sr.safe !== false ? 'Safe' : '⚠ Dangerous'}`);
            document.getElementById('gameCanvas').style.cursor = 'pointer';
        } else {
            _lastPersonHover = null;
            Renderer.setHover(null);
            UI.hideTooltip();
            if (!input.mouseDown) {
                document.getElementById('gameCanvas').style.cursor = 'default';
            }
        }
    }

    // ── Context menu ──

    function showContextMenuForHit(x, y, hit) {
        const items = [];

        // Turn back option when traveling (always show at top)
        if (typeof Player !== 'undefined' && Player.traveling && !Player.travelPaid) {
            items.push({ icon: '🔄', label: 'Turn Back', action: `UI.turnBackUI()` });
        }

        if (hit.type === 'town') {
            const town = hit.data;
            const isHere = typeof Player !== 'undefined' && Player.townId === town.id;
            // v9p33river66: "sailing mode" includes being boarded on a ship at the
            // coast (embarkedShipId set), not just actively under-sail.
            const playerSailing = typeof Player !== 'undefined' && (Player.travelOffSea || !!Player.embarkedShipId);

            items.push({ icon: '👁', label: 'View Details', action: `UI.showTownDetail(Engine.getTown('${town.id}'))` });
            if (!isHere) {
                // Road travel options only available when in a town (not mid-travel/offroad)
                // Outposts without a road cannot be reached via road travel
                const _isOutpostNoRoad = town.isOutpost && !town.hasRoad;
                if (Player.townId && !Player.traveling && !_isOutpostNoRoad) {
                    items.push({ icon: '🗺️', label: 'Travel Here...', action: `UI.openTravelOptions('${town.id}')` });
                }
                // v9p33river60/66/72: when sailing/embarked, off-road land travel is
                // hidden entirely. Ports get "Sail Here"; non-ports get a hint.
                if (playerSailing) {
                    if (town.isPort) {
                        items.push({ icon: '⛵', label: 'Sail to ' + town.name, action: 'UI.showOffSeaDialog(' + town.x + ',' + town.y + ')' });
                    } else {
                        items.push({ icon: '⚓', label: 'Cannot dock — not a port. Land on a coast tile instead.', action: 'void(0)' });
                    }
                } else {
                    // v9p33river72: in a port town with a docked ship + target is also
                    // a port → offer "Sail to {town}" alongside off-road land travel.
                    var _curTownObj = Player.townId ? Engine.findTown(Player.townId) : null;
                    var _hasDockedShip = false;
                    if (_curTownObj && _curTownObj.isPort && Player.ships) {
                        for (var _shi = 0; _shi < Player.ships.length; _shi++) {
                            var _sh = Player.ships[_shi];
                            if (!_sh.assignedCaravanId && !_sh.assignedOffSea && _sh.townId === Player.townId) {
                                _hasDockedShip = true; break;
                            }
                        }
                    }
                    if (_hasDockedShip && town.isPort && !Player.traveling) {
                        // v9p33river73: don't show "Sail Here" if a sea route already
                        // exists between these two ports — the regular "Travel Here..."
                        // option will route via that sea route and let the player pick a ship.
                        var _hasSeaRoute = false;
                        try {
                            var _sr = (Engine.getSeaRoutes && Engine.getSeaRoutes()) || [];
                            for (var _sri = 0; _sri < _sr.length; _sri++) {
                                var _r = _sr[_sri];
                                if ((_r.fromTownId === Player.townId && _r.toTownId === town.id) ||
                                    (_r.toTownId === Player.townId && _r.fromTownId === town.id)) {
                                    _hasSeaRoute = true; break;
                                }
                            }
                        } catch (_e) {}
                        if (!_hasSeaRoute) {
                            items.push({ icon: '⛵', label: 'Sail to ' + town.name, action: 'UI.showOffSeaDialog(' + town.x + ',' + town.y + ')' });
                        }
                    }
                    // Off-road land travel (only when NOT sailing/embarked)
                    items.push({ icon: '🥾', label: 'Travel Off-road to ' + town.name, action: 'UI.confirmFreeTravel(' + town.x + ',' + town.y + ')' });
                }
                if (!_isOutpostNoRoad) {
                    items.push({ icon: '🐴', label: 'Send Caravan', action: `UI.openCaravanDialog()` });
                }
            }else {
                if (!town.isOutpost) {
                    items.push({ icon: '📊', label: 'Trade', action: 'UI.openTradeDialog()' });
                }
                items.push({ icon: '🏗️', label: 'Build', action: 'UI.openBuildDialog()' });
                items.push({ icon: '👥', label: 'Hire Workers', action: 'UI.openHireDialog()' });
            }
            // King war option: send army to enemy town
            if (typeof Player !== 'undefined' && Player.isPlayerKing && Player.isPlayerKing()) {
                var _pkKingdom = Player.getPlayerKingdom ? Player.getPlayerKingdom() : null;
                if (_pkKingdom && _pkKingdom.atWar && _pkKingdom.atWar.has && _pkKingdom.atWar.has(town.kingdomId)) {
                    items.push({ icon: '⚔️', label: 'Send Army to ' + town.name, action: "UI._openSendArmyModal('" + town.id + "')" });
                }
            }
        } else if (hit.type === 'army') {
            // Armies are info-only on right-click
            items.push({ icon: '👁', label: 'View army (hover for details)', action: 'void(0)' });
        } else if (hit.type === 'dockedShip') {
            // v9p33river60/63/66: docked ship — player offroad-travels to it,
            // and on arrival auto-boards. Adjacency for instant board = 1 tile.
            var ds = hit.data;
            var dsName = ds.name || (CONFIG.SHIP_TYPES[ds.type] && CONFIG.SHIP_TYPES[ds.type].name) || ds.type || 'ship';
            var pPos = (typeof Player !== 'undefined' && Player.getPlayerWorldPosition) ? Player.getPlayerWorldPosition() : null;
            var nearShip = pPos && Math.hypot(ds.dockedCoords.x - pPos.x, ds.dockedCoords.y - pPos.y) <= (CONFIG.TILE_SIZE || 16);
            if (Player.traveling && !nearShip) {
                items.push({ icon: '⛵', label: dsName + ' (docked here)', action: 'void(0)' });
            } else if (nearShip && !Player.traveling) {
                items.push({ icon: '⛵', label: 'Board ' + dsName + ' & Sail', action: "UI.boardDockedShipUI('" + ds.id + "')" });
            } else {
                items.push({ icon: '🥾', label: 'Travel to ' + dsName + ' & Board', action: "UI.travelToDockedShip('" + ds.id + "')" });
            }
        } else if (hit.type === 'person') {
            const p = hit.data;
            items.push({ icon: '👁', label: 'View Details', action: `UI.showPersonDetail(Engine.getPerson('${p.id}'))` });
            if (!p.occupation || p.occupation === 'none') {
                items.push({ icon: '👥', label: 'Hire', action: `UI.hirePerson('${p.id}')` });
            }
        } else if (hit.type === 'road') {
            items.push({ icon: '👁', label: 'View Road Info', action: 'void(0)' });
            // Bridge-specific options
            var _road = hit.data;
            if (_road.bridges && _road.bridges.length > 0) {
                var _clickWorld = Renderer.screenToWorld(x, y);
                if (_clickWorld) {
                    // Find nearest bridge to click point
                    var _nearBridge = null, _nearDist = Infinity;
                    for (var _bci = 0; _bci < _road.bridges.length; _bci++) {
                        var _br = _road.bridges[_bci];
                        if (!_road.waypoints) continue;
                        // Get bridge midpoint
                        var _bmid = Math.floor((_br.startWpIdx + _br.endWpIdx) / 2);
                        if (_bmid < _road.waypoints.length) {
                            var _bwp = _road.waypoints[_bmid];
                            var _bd = Math.hypot(_clickWorld.x - _bwp.x, _clickWorld.y - _bwp.y);
                            if (_bd < _nearDist) { _nearDist = _bd; _nearBridge = _br; }
                        }
                    }
                    if (_nearBridge && _nearDist < 40) {
                        // Find road index for engine calls
                        var _roads = Engine.getRoads();
                        var _roadIdx = -1;
                        for (var _rfi = 0; _rfi < _roads.length; _rfi++) {
                            if (_roads[_rfi].fromTownId === _road.fromTownId && _roads[_rfi].toTownId === _road.toTownId) {
                                _roadIdx = _rfi; break;
                            }
                        }
                        if (_nearBridge.destroyed && _roadIdx >= 0) {
                            var _repMats = (typeof CONFIG !== 'undefined' && CONFIG.BRIDGE_REPAIR_MATERIALS) || { wood: 20, stone: 10 };
                            var _repCost = (typeof CONFIG !== 'undefined' && CONFIG.BRIDGE_REBUILD_COST) || 1000;
                            var _costStr = _repCost + 'g';
                            for (var _mk in _repMats) { _costStr += ' + ' + _repMats[_mk] + ' ' + _mk; }
                            items.push({
                                icon: '🔨',
                                label: 'Repair Bridge (' + _costStr + ')',
                                action: 'UI.repairBridgeUI(' + _roadIdx + ',\'' + _nearBridge.id + '\')'
                            });
                        } else if (!_nearBridge.destroyed) {
                            items.push({ icon: '🌉', label: 'Bridge (Intact)', action: 'void(0)' });
                        }
                    }
                }
            }
            // Offroad travel to this point on the road (hidden while sailing)
            if (typeof Player !== 'undefined' && !Player.travelOffSea && !Player.embarkedShipId) {
                var roadWorldCoords = Renderer.screenToWorld(x, y);
                if (roadWorldCoords) {
                    items.push({
                        icon: '🥾',
                        label: Player.traveling ? 'Go Off-road Here (Leave Route)' : 'Travel Here (Off-road)',
                        action: 'UI.confirmFreeTravel(' + roadWorldCoords.x + ',' + roadWorldCoords.y + ')'
                    });
                }
            }
        } else {
            items.push({ icon: '🗺️', label: 'Map Overview', action: 'UI.openMapView()' });
            // Free travel: "Travel Here" when right-clicking empty map (works while traveling too)
            if (typeof Player !== 'undefined') {
                var worldCoords = Renderer.screenToWorld(x, y);
                if (worldCoords) {
                    var terrain = Engine.getTerrainAtPixel(worldCoords.x, worldCoords.y);
                    // Outpost placement mode
                    if (window._outpostPlacementMode && terrain !== 2 && terrain !== 3) {
                        window._outpostPlacementMode = false;
                        UI.confirmOutpostPlacement(worldCoords.x, worldCoords.y);
                        return;
                    }
                    if (terrain !== 2 && terrain !== 3) { // Not water or mountains
                        // v9p33river66: hide land off-road options entirely while
                        // sailing/embarked. Show only the landing option.
                        var _sailing = Player.travelOffSea || !!Player.embarkedShipId;
                        if (!_sailing) {
                            items.push({
                                icon: '🥾',
                                label: Player.traveling ? 'Go Off-road Here (Leave Route)' : 'Travel Here (Off-road)',
                                action: 'UI.confirmFreeTravel(' + worldCoords.x + ',' + worldCoords.y + ')'
                            });
                            items.push({
                                icon: '⛺',
                                label: 'Travel & Found Outpost Here',
                                action: 'UI.travelAndFoundOutpost(' + worldCoords.x + ',' + worldCoords.y + ')'
                            });
                        }
                        // Off-sea landing option (when sailing in open water)
                        if (Player.travelOffSea) {
                            items.push({
                                icon: '⚓',
                                label: 'Attempt Landing Here',
                                action: 'UI.showLandingDialog(' + worldCoords.x + ',' + worldCoords.y + ')'
                            });
                        }
                    }
                    // Right-click on water: off-sea travel options
                    if (terrain === 2) {
                        var inPort = false;
                        if (Player.townId) {
                            var pTown = Engine.findTown(Player.townId);
                            if (pTown && pTown.isPort) inPort = true;
                        }
                        // v9p33river60: also allow sailing if player has just boarded
                        // a previously-docked ship (Player.embarkedShipId is set).
                        var embarked = !!Player.embarkedShipId;
                        if (inPort || Player.travelOffSea || embarked) {
                            items.push({
                                icon: '⛵',
                                label: Player.travelOffSea ? 'Redirect Course Here' : 'Sail Here (Off-Sea)',
                                action: 'UI.showOffSeaDialog(' + worldCoords.x + ',' + worldCoords.y + ')'
                            });
                        }
                    }
                }
            }
        }

        // Survey options (available on any right-click when overlays are active)
        if (typeof Renderer !== 'undefined') {
            var _surveyWorld = Renderer.screenToWorld(x, y);
            if (_surveyWorld) {
                if (Renderer.isFertilityOn && Renderer.isFertilityOn()) {
                    items.push({ icon: '🌾', label: 'Check Fertility Here', action: 'Renderer.startFertilitySurvey(' + _surveyWorld.x + ',' + _surveyWorld.y + ')' });
                }
                if (Renderer.isDepositsOn && Renderer.isDepositsOn() && typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('world_survey')) {
                    items.push({ icon: '⛏️', label: 'Find Deposits Here', action: 'Renderer.startDepositSurvey(' + _surveyWorld.x + ',' + _surveyWorld.y + ')' });
                }
            }
        }

        if (items.length > 0) {
            UI.showContextMenu(x, y, items);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  SAVE / LOAD SYSTEM (5 Slots) — IndexedDB + LZString
    // ═══════════════════════════════════════════════════════════

    const SAVE_SLOT_PREFIX = 'merchantRealms_slot_';
    const OLD_SAVE_KEY = 'merchantRealms_save';
    const NUM_SAVE_SLOTS = 5;
    let lastUsedSlot = parseInt(localStorage.getItem('merchantRealms_lastSlot')) || 0;

    // ── IndexedDB Storage Layer ──
    // Replaces localStorage for save data to avoid ~5MB quota.
    // Metadata stays in localStorage for fast sync reads (slot picker).
    const IDB_NAME = 'MerchantRealmsDB';
    const IDB_VERSION = 1;
    const IDB_STORE = 'saves';
    var _idb = null;       // IDBDatabase reference (null until opened)
    var _idbReady = false; // true once DB is open and usable
    var _idbFailed = false; // true if IndexedDB not available — use localStorage fallback
    var _knownIDBSaveKeys = {}; // v9p33river329: sync hint for IDB-only saves.
    var _idbKeyRefreshPromise = null;

    function _openIDB() {
        return new Promise(function(resolve, reject) {
            if (_idb) { resolve(_idb); return; }
            if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
            try {
                var req = indexedDB.open(IDB_NAME, IDB_VERSION);
                req.onupgradeneeded = function(e) {
                    var db = e.target.result;
                    if (!db.objectStoreNames.contains(IDB_STORE)) {
                        db.createObjectStore(IDB_STORE);
                    }
                };
                req.onsuccess = function(e) {
                    _idb = e.target.result;
                    _idbReady = true;
                    // v9p33river434: finish the initial IDB key scan before callers trust cached slot presence.
                    _refreshKnownIDBSaveKeys().then(function() {
                        resolve(_idb);
                    });
                };
                req.onerror = function(e) {
                    console.error('[IDB] Open failed:', e.target.error);
                    reject(e.target.error);
                };
            } catch (err) {
                reject(err);
            }
        });
    }

    function _idbPut(key, value) {
        return new Promise(function(resolve, reject) {
            if (!_idb) { reject(new Error('IDB not open')); return; }
            try {
                var tx = _idb.transaction(IDB_STORE, 'readwrite');
                var store = tx.objectStore(IDB_STORE);
                var req = store.put(value, key);
                var _settled = false;
                // v9p33river434: wait for transaction completion so IDB saves are durable before we treat them as written.
                tx.oncomplete = function() {
                    if (_settled) return;
                    _settled = true;
                    resolve();
                };
                tx.onabort = tx.onerror = function(e) {
                    if (_settled) return;
                    _settled = true;
                    reject((e && e.target && e.target.error) || tx.error || new Error('IDB write failed'));
                };
                req.onerror = function(e) {
                    if (_settled) return;
                    _settled = true;
                    reject(e.target.error);
                };
            } catch (err) { reject(err); }
        });
    }

    function _idbGet(key) {
        return new Promise(function(resolve, reject) {
            if (!_idb) { reject(new Error('IDB not open')); return; }
            try {
                var tx = _idb.transaction(IDB_STORE, 'readonly');
                var store = tx.objectStore(IDB_STORE);
                var req = store.get(key);
                req.onsuccess = function() { resolve(req.result); };
                req.onerror = function(e) { reject(e.target.error); };
            } catch (err) { reject(err); }
        });
    }

    function _idbDelete(key) {
        return new Promise(function(resolve, reject) {
            if (!_idb) { reject(new Error('IDB not open')); return; }
            try {
                var tx = _idb.transaction(IDB_STORE, 'readwrite');
                var store = tx.objectStore(IDB_STORE);
                var req = store.delete(key);
                var _settled = false;
                // v9p33river434: wait for delete transaction completion before hiding IDB-backed slots.
                tx.oncomplete = function() {
                    if (_settled) return;
                    _settled = true;
                    resolve();
                };
                tx.onabort = tx.onerror = function(e) {
                    if (_settled) return;
                    _settled = true;
                    reject((e && e.target && e.target.error) || tx.error || new Error('IDB delete failed'));
                };
                req.onerror = function(e) {
                    if (_settled) return;
                    _settled = true;
                    reject(e.target.error);
                };
            } catch (err) { reject(err); }
        });
    }

    function _idbGetAllKeys() {
        return new Promise(function(resolve, reject) {
            if (!_idb) { reject(new Error('IDB not open')); return; }
            try {
                var tx = _idb.transaction(IDB_STORE, 'readonly');
                var store = tx.objectStore(IDB_STORE);
                var req = store.getAllKeys();
                req.onsuccess = function() { resolve(req.result || []); };
                req.onerror = function(e) { reject(e.target.error); };
            } catch (err) { reject(err); }
        });
    }

    function _refreshKnownIDBSaveKeys() {
        if (!_idbReady || _idbFailed) return Promise.resolve(_knownIDBSaveKeys);
        if (_idbKeyRefreshPromise) return _idbKeyRefreshPromise;
        _idbKeyRefreshPromise = _idbGetAllKeys().then(function(keys) {
            _knownIDBSaveKeys = {};
            for (var ki = 0; ki < keys.length; ki++) _knownIDBSaveKeys[keys[ki]] = true;
            _idbKeyRefreshPromise = null;
            return _knownIDBSaveKeys;
        }).catch(function() {
            _idbKeyRefreshPromise = null;
            return _knownIDBSaveKeys;
        });
        return _idbKeyRefreshPromise;
    }

    // Compress data to a string for storage
    function _compressSaveData(data) {
        var jsonStr = JSON.stringify(data);
        if (typeof LZString !== 'undefined') {
            return LZString.compressToUTF16(jsonStr);
        }
        return jsonStr;
    }

    // Decompress a stored string back to an object
    function _decompressSaveData(raw) {
        if (!raw) return null;
        if (typeof raw === 'object') return raw;
        if (typeof LZString !== 'undefined') {
            try {
                var decompressed = LZString.decompressFromUTF16(raw);
                if (decompressed) return JSON.parse(decompressed);
            } catch (_lzErr) { /* fall through */ }
        }
        try { return JSON.parse(raw); } catch (_jsonErr) {}
        // v9p33river434: treat corrupt payloads as load errors instead of silently pretending the slot is empty.
        throw new Error('Corrupt save data');
    }

    // Store save data — IndexedDB primary, localStorage fallback
    function _storeSave(key, data) {
        var compressed = _compressSaveData(data);
        function _finalizeVisibleSave() {
            _knownIDBSaveKeys[key] = true;
            _storeMetaSync(key, data);
        }
        if (_idbReady && !_idbFailed) {
            return _idbPut(key, compressed).then(function() {
                // v9p33river434: only expose the slot after the payload actually exists.
                _finalizeVisibleSave();
            }).catch(function(err) {
                console.warn('[Save] IDB write failed, falling back to localStorage:', err);
                try {
                    localStorage.setItem(key, compressed);
                    _finalizeVisibleSave();
                } catch (e2) {
                    throw new Error('Save failed: storage full. Try deleting old saves.');
                }
            });
        } else {
            // Fallback to localStorage
            try {
                localStorage.setItem(key, compressed);
                _finalizeVisibleSave();
                return Promise.resolve();
            } catch (e) {
                return Promise.reject(new Error('Save failed: storage full (' + e.message + '). Try deleting old saves.'));
            }
        }
    }

    // Read save data — try IndexedDB first, then localStorage
    function _readSave(key) {
        if (_idbReady && !_idbFailed) {
            return _idbGet(key).then(function(raw) {
                if (raw) return _decompressSaveData(raw);
                // Fallback: maybe it's still in localStorage (pre-migration)
                var lsRaw = null;
                try { lsRaw = localStorage.getItem(key); } catch(e) {}
                return lsRaw ? _decompressSaveData(lsRaw) : null;
            }).catch(function(err) {
                console.warn('[Load] IDB read failed, trying localStorage:', err);
                var lsRaw = null;
                try { lsRaw = localStorage.getItem(key); } catch(e) {}
                return lsRaw ? _decompressSaveData(lsRaw) : null;
            });
        } else {
            var lsRaw = null;
            try { lsRaw = localStorage.getItem(key); } catch(e) {}
            try {
                return Promise.resolve(lsRaw ? _decompressSaveData(lsRaw) : null);
            } catch (err) {
                return Promise.reject(err);
            }
        }
    }

    // Delete save data from both stores
    function _deleteSave(key) {
        try { localStorage.removeItem(key); } catch(e) {}
        try { localStorage.removeItem(key + '_meta'); } catch(e) {}
        // v9p33river434: keep the IDB-key cache alive until the delete transaction really commits.
        if (_idbReady && !_idbFailed) {
            return _idbDelete(key).then(function() {
                delete _knownIDBSaveKeys[key];
            }).catch(function(err) {
                console.warn('[Save] IDB delete failed:', err);
            });
        }
        delete _knownIDBSaveKeys[key];
        return Promise.resolve();
    }

    // Store metadata in localStorage (sync, tiny)
    function _storeMetaSync(key, data) {
        try {
            localStorage.setItem(key + '_meta', JSON.stringify({
                playerName: data.playerName || 'Unknown',
                day: data.day || 0,
                season: data.season || 'Spring',
                year: data.year || 1,
                kingdom: data.kingdom || '',
                rank: data.rank || '',
                gold: data.gold || 0,
                savedAt: data.savedAt || 0,
            }));
        } catch (_e) { /* metadata is optional */ }
    }

    // Migrate all existing localStorage saves to IndexedDB
    function _migrateLocalStorageToIDB() {
        if (!_idbReady) return Promise.resolve();
        var keys = [];
        for (var i = 1; i <= NUM_SAVE_SLOTS; i++) keys.push(SAVE_SLOT_PREFIX + i);
        keys.push(AUTOSAVE_SLOT_A, AUTOSAVE_SLOT_B);

        var promises = [];
        for (var k = 0; k < keys.length; k++) {
            (function(storageKey) {
                var raw = null;
                try { raw = localStorage.getItem(storageKey); } catch(e) {}
                if (raw) {
                    promises.push(
                        _idbPut(storageKey, raw).then(function() {
                            try { localStorage.removeItem(storageKey); } catch(e) {}
                            console.log('[Migration] Moved ' + storageKey + ' to IndexedDB');
                        }).catch(function(err) {
                            console.warn('[Migration] Failed to migrate ' + storageKey + ':', err);
                        })
                    );
                }
            })(keys[k]);
        }
        // Also migrate old save key
        var oldRaw = null;
        try { oldRaw = localStorage.getItem(OLD_SAVE_KEY); } catch(e) {}
        if (oldRaw) {
            promises.push(
                _idbGet(SAVE_SLOT_PREFIX + '1').then(function(existingSlot1Raw) {
                    var slot1MetaRaw = null;
                    try { slot1MetaRaw = localStorage.getItem(SAVE_SLOT_PREFIX + '1_meta'); } catch(e) {}
                    if (existingSlot1Raw || slot1MetaRaw) return;
                    // v9p33river434: never overwrite an existing slot-1 payload just because its metadata went missing.
                    return _idbPut(SAVE_SLOT_PREFIX + '1', oldRaw).then(function() {
                        // Parse it to create metadata
                        var data = _decompressSaveData(oldRaw);
                        if (data) {
                            data.playerName = (data.player && data.player.fullName) || 'Unknown Merchant';
                            data.day = (data.engine && data.engine.day) || 0;
                            var dayNum = data.day || 0;
                            var seasonIdx = Math.floor(dayNum / CONFIG.DAYS_PER_SEASON) % 4;
                            data.season = CONFIG.SEASONS[seasonIdx] || 'Spring';
                            data.year = Math.floor(dayNum / CONFIG.DAYS_PER_SEASON) + 1;
                            data.gold = (data.player && data.player.gold) || 0;
                            _storeMetaSync(SAVE_SLOT_PREFIX + '1', data);
                        }
                        try { localStorage.removeItem(OLD_SAVE_KEY); } catch(e) {}
                        lastUsedSlot = 1;
                        localStorage.setItem('merchantRealms_lastSlot', '1');
                        console.log('[Migration] Moved old save to IndexedDB slot 1');
                    });
                }).catch(function(err) {
                    console.warn('[Migration] Failed to migrate old save:', err);
                })
            );
        }
        return Promise.all(promises);
    }

    // Initialize IndexedDB — call on game start
    function _initSaveSystem() {
        return _openIDB().then(function() {
            console.log('[Save] IndexedDB ready — unlimited save storage enabled');
            return _migrateLocalStorageToIDB();
        }).catch(function(err) {
            console.warn('[Save] IndexedDB unavailable, using localStorage fallback:', err);
            _idbFailed = true;
        });
    }

    // ── Autosave System ──
    const AUTOSAVE_SLOT_A = 'merchantRealms_autosave_A';
    const AUTOSAVE_SLOT_B = 'merchantRealms_autosave_B';
    const AUTOSAVE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    let _autosaveTimerId = null;
    // Track which autosave slot is "older" — we always overwrite the older one
    // Start with A so first save goes to A, second to B, then back to A, etc.
    let _autosaveNextSlot = 'A';
    let _autosaveInFlight = false;

    // ═══════════════════════════════════════════════════════════
    //  SAVE MIGRATION SYSTEM
    //  Each migration upgrades from version N to N+1.
    //  Runs before deserialize to ensure data shape is current.
    // ═══════════════════════════════════════════════════════════

    const CURRENT_SAVE_VERSION = 6;

    const SAVE_MIGRATIONS = {
        // v1 → v2: Backfill core player containers introduced after early saves.
        1: function(data) {
            if (data.player) {
                if (!data.player.relationships) data.player.relationships = {};
                if (!data.player.guildMemberships) data.player.guildMemberships = {};
                if (!data.player.achievements) data.player.achievements = {};
                if (!data.player.trackedMerchants) data.player.trackedMerchants = [];
            }
        },
        // v2 → v3: Backfill family/corruption containers used by later deserializers.
        2: function(data) {
            if (data.player) {
                if (!data.player.familyMembers) data.player.familyMembers = [];
                if (!data.player.criminalRecord) data.player.criminalRecord = {};
                if (!data.player.forgedDocuments) data.player.forgedDocuments = {};
                if (!data.player.forgedKingdomDocs) data.player.forgedKingdomDocs = {}; // v9p33river329: preserve kingdom-scoped forged docs in old saves.
            }
        },
        // v3 → v4: Add notification filter defaults, ensure agents array
        3: function(data) {
            if (data.player) {
                if (!data.player.agents) data.player.agents = [];
                if (!data.player.notifFilters) data.player.notifFilters = {};
                if (!data.player._notifSubKeys) data.player._notifSubKeys = {};
            }
        },
        // v4 → v5: Rename age achievements (adulthood→prime_of_life, old_age→seasoned_merchant)
        4: function(data) {
            if (data.player && data.player.achievements) {
                var ach = data.player.achievements;
                if (ach.adulthood && !ach.prime_of_life) { ach.prime_of_life = ach.adulthood; delete ach.adulthood; }
                if (ach.old_age && !ach.seasoned_merchant) { ach.seasoned_merchant = ach.old_age; delete ach.old_age; }
            }
        },
        // v5 → v6: Add king mode state defaults
        5: function(data) {
            if (data.player) {
                if (data.player.isKing === undefined) data.player.isKing = false;
                if (!data.player.kingState) data.player.kingState = null;
            }
        },
    };

    function _migrateSaveData(data) {
        if (!data) return data;
        var ver = data.version || 1;
        while (ver < CURRENT_SAVE_VERSION) {
            var migrator = SAVE_MIGRATIONS[ver];
            if (migrator) {
                try {
                    migrator(data);
                } catch (e) {
                    console.error('Save migration v' + ver + ' → v' + (ver + 1) + ' failed:', e);
                    // v9p33river434: never stamp a save as upgraded if one of its migrations failed.
                    throw new Error('Save migration failed at version ' + ver + ': ' + (e.message || e));
                }
            }
            ver++;
        }
        data.version = CURRENT_SAVE_VERSION;
        return data;
    }

    function _buildSavePayload() {
        const engineData = Engine.serialize ? Engine.serialize() : null;
        const playerData = Player.serialize ? Player.serialize() : null;
        const dayNum = Engine.getDay ? Engine.getDay() : 0;
        const seasonIdx = Math.floor(dayNum / CONFIG.DAYS_PER_SEASON) % 4;
        const kingdomId = Player.citizenshipKingdomId;
        let kingdomName = '';
        if (kingdomId && Engine.getKingdom) {
            const k = Engine.getKingdom(kingdomId);
            if (k) kingdomName = k.name;
        }
        let rankName = '';
        if (Player.socialRank && kingdomId != null) {
            const rIdx = Player.socialRank[kingdomId] || 0;
            if (CONFIG.SOCIAL_RANKS[rIdx]) rankName = CONFIG.SOCIAL_RANKS[rIdx].name;
        }
        return {
            playerName: Player.fullName || 'Unknown',
            day: dayNum,
            season: CONFIG.SEASONS[seasonIdx] || 'Spring',
            year: Math.floor(dayNum / CONFIG.DAYS_PER_SEASON) + 1,
            kingdom: kingdomName,
            rank: rankName,
            gold: Player.gold || 0,
            savedAt: Date.now(),
            version: CURRENT_SAVE_VERSION,
            engine: engineData,
            player: playerData,
            aiMerchants: Player.serializeAI ? Player.serializeAI() : null,
            tutorial: (typeof Tutorial !== 'undefined' && Tutorial.serialize) ? Tutorial.serialize() : null,
        };
    }

    function _compressAndStore(key, data) {
        // Async: stores to IndexedDB (or localStorage fallback) + metadata
        return _storeSave(key, data);
    }

    function _performAutosave() {
        if (state !== 'playing' && state !== 'paused') return;
        if (_autosaveInFlight) return;
        try {
            var data = _buildSavePayload();
            data.isAutosave = true;
            var slotLabel = _autosaveNextSlot;
            var key = slotLabel === 'A' ? AUTOSAVE_SLOT_A : AUTOSAVE_SLOT_B;
            _autosaveInFlight = true;
            _compressAndStore(key, data).then(function() {
                console.log('[Autosave] Saved to slot ' + slotLabel + ' on Day ' + data.day);
                // v9p33river434: serialize autosaves so stale async completions cannot flip slot order.
                _autosaveNextSlot = slotLabel === 'A' ? 'B' : 'A';
            }).catch(function(err) {
                console.error('[Autosave] Failed:', err);
            }).finally(function() {
                _autosaveInFlight = false;
            });
        } catch (e) {
            _autosaveInFlight = false;
            console.error('[Autosave] Failed:', e);
        }
    }

    function startAutosave() {
        stopAutosave();
        // Determine which slot is older so we overwrite it first
        var metaA = getAutosaveMeta('A');
        var metaB = getAutosaveMeta('B');
        if (!metaA && !metaB) {
            _autosaveNextSlot = 'A'; // both empty, start with A
        } else if (!metaA) {
            _autosaveNextSlot = 'A'; // A is empty, fill it
        } else if (!metaB) {
            _autosaveNextSlot = 'B'; // B is empty, fill it
        } else {
            // Both exist — overwrite the older one
            _autosaveNextSlot = (metaA.savedAt || 0) <= (metaB.savedAt || 0) ? 'A' : 'B';
        }
        _autosaveTimerId = setInterval(_performAutosave, AUTOSAVE_INTERVAL_MS);
    }

    function stopAutosave() {
        if (_autosaveTimerId) {
            clearInterval(_autosaveTimerId);
            _autosaveTimerId = null;
        }
    }

    function getAutosaveData(slot) {
        var key = slot === 'A' ? AUTOSAVE_SLOT_A : AUTOSAVE_SLOT_B;
        return _readSave(key);
    }

    function getAutosaveMeta(slot) {
        // Sync: reads only from localStorage metadata (always available)
        try {
            var key = slot === 'A' ? AUTOSAVE_SLOT_A : AUTOSAVE_SLOT_B;
            var metaRaw = localStorage.getItem(key + '_meta');
            if (metaRaw) return JSON.parse(metaRaw);
        } catch (_e) { /* fall through */ }
        return null;
    }

    function _hideGameStartScreens() {
        const titleScreen = document.getElementById('titleScreen');
        const charCreateScreen = document.getElementById('charCreateScreen');
        const gameModeScreen = document.getElementById('gameModeScreen');
        if (titleScreen) {
            titleScreen.classList.add('hidden');
            titleScreen.style.display = 'none';
        }
        if (charCreateScreen) {
            charCreateScreen.classList.add('hidden');
            charCreateScreen.style.display = 'none';
        }
        if (gameModeScreen) {
            gameModeScreen.style.display = 'none';
        }
        var kingdomScreen = document.getElementById('kingdomSelectScreen');
        if (kingdomScreen) { kingdomScreen.classList.add('hidden'); kingdomScreen.style.display = 'none'; }
    }

    function _restoreLoadedSave(data, opts) {
        opts = opts || {};
        // v9p33river434: autosaves and manual loads must share the same reset / renderer / tutorial restore pipeline.
        _resetEverythingExceptSaves();
        _migrateSaveData(data);
        if (!data.engine || !data.player) throw new Error('Save is missing core game data');

        if (data.engine && Engine.deserialize) Engine.deserialize(data.engine);
        if (data.player && Player.deserialize) Player.deserialize(data.player);
        if (data.aiMerchants && Player.deserializeAI) Player.deserializeAI(data.aiMerchants);

        _hideGameStartScreens();

        if (typeof StoryMode !== 'undefined' && StoryMode.isActive && StoryMode.isActive()) {
            var _loadedP = Player.state;
            if (!_loadedP || !_loadedP.storyMode || !_loadedP.storyMode.active) {
                StoryMode.deserialize({ active: false, chapter: 0, complete: false });
            }
        }
        if (typeof UI !== 'undefined' && UI.hideStoryTracker) {
            var _lp = Player.state;
            if (!_lp || !_lp.storyMode || !_lp.storyMode.active) {
                UI.hideStoryTracker();
            }
        }

        const canvas = document.getElementById('gameCanvas');
        const world = Engine.getWorld ? Engine.getWorld() : {};
        if (typeof Renderer !== 'undefined' && Renderer.init) Renderer.init(canvas, world);
        if (typeof UI !== 'undefined') {
            if (UI.init) UI.init();
            if (UI.showGameUI) UI.showGameUI();
            try { if (UI.update) UI.update(); } catch (e) { console.error('UI update after load:', e); }
        }

        setupInput();
        state = 'playing';
        speed = 1;
        lastTickTime = performance.now();
        tickAccumulator = 0;
        tickCounter = 0;
        lastFrameTime = performance.now();
        const events = Engine.getEvents ? Engine.getEvents() : [];
        _seedProcessedEvents(events);
        if (!animFrameId) loop(performance.now());
        if (typeof Music !== 'undefined' && Music.playGameMusic) Music.playGameMusic('peaceful');
        startAutosave();

        if (typeof opts.slotNum === 'number' && opts.slotNum > 0) {
            lastUsedSlot = opts.slotNum;
            localStorage.setItem('merchantRealms_lastSlot', String(opts.slotNum));
        }

        if (data.tutorial && data.tutorial.active && typeof Tutorial !== 'undefined' && Tutorial.resume) {
            try { Tutorial.resume(data.tutorial); } catch(e) { console.error('Tutorial resume failed:', e); }
        }

        if (opts.toastMessage && typeof UI !== 'undefined' && UI.toast) {
            UI.toast(opts.toastMessage, 'success');
        }
    }

    function loadAutosave(slot) {
        getAutosaveData(slot).then(function(data) {
            if (!data) {
                if (typeof UI !== 'undefined') UI.toast('No autosave in slot ' + slot + '.', 'warning');
                return;
            }
            try {
                _restoreLoadedSave(data, { toastMessage: 'Loaded Autosave ' + slot + '!' });
            } catch (e) {
                console.error('Autosave load failed:', e);
                if (typeof UI !== 'undefined') UI.toast('Autosave load failed: ' + (e.message || 'Unknown error'), 'danger');
            }
        }).catch(function(err) {
            console.error('Autosave load failed:', err);
            if (typeof UI !== 'undefined') UI.toast('Autosave load failed: ' + (err.message || 'Unknown error'), 'danger');
        });
    }

    function migrateOldSave() {
        // Old save migration is now handled by _migrateLocalStorageToIDB()
        // This function remains for backwards compatibility but is a no-op
    }

    function getSlotData(slotNum) {
        return _readSave(SAVE_SLOT_PREFIX + slotNum);
    }

    function getSlotMeta(slotNum) {
        // Sync: reads only from localStorage metadata
        try {
            var metaRaw = localStorage.getItem(SAVE_SLOT_PREFIX + slotNum + '_meta');
            if (metaRaw) return JSON.parse(metaRaw);
        } catch (_e) { /* fall through */ }
        return null;
    }

    function downloadSave(slotNum) {
        getSlotData(slotNum).then(function(data) {
            if (!data) { UI.toast('No save in slot ' + slotNum, 'warning'); return; }
            var jsonStr = JSON.stringify(data);
            var meta = getSlotMeta(slotNum);
            var safeName = (meta && meta.playerName ? meta.playerName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Unknown');
            var day = meta ? meta.day : 0;
            var filename = 'MerchantRealms_' + safeName + '_Day' + day + '_Slot' + slotNum + '.json';
            var blob = new Blob([jsonStr], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            UI.toast('Downloaded ' + filename, 'success');
        }).catch(function(err) {
            UI.toast('Download failed: ' + (err.message || 'Unknown error'), 'danger');
        });
    }

    function importSaveToSlot(slotNum) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.txt';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const jsonStr = ev.target.result;
                    const data = JSON.parse(jsonStr);
                    // v9p33river434: reject partial imports so we do not store slots that cannot deserialize into a real game.
                    if (!data.engine || !data.player) {
                        UI.toast('Invalid save file — missing engine or player data', 'danger');
                        return;
                    }
                    // v9p33river434: migrate imported saves before storage so the slot payload is already on the current version.
                    _migrateSaveData(data);
                    _storeSave(SAVE_SLOT_PREFIX + slotNum, data).then(function() {
                        lastUsedSlot = slotNum;
                        localStorage.setItem('merchantRealms_lastSlot', String(slotNum));
                        UI.toast('Imported save to Slot ' + slotNum + '!', 'success');
                        UI.closeModal();
                        showLoadSlotPicker();
                    }).catch(function(err) {
                        UI.toast('Import failed: ' + (err.message || 'Storage error'), 'danger');
                    });
                } catch (err) {
                    UI.toast('Failed to import: ' + (err.message || 'Invalid file'), 'danger');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // v9p33river434: escape save-slot metadata before inserting it into modal HTML.
    function _escapeSaveSlotHTML(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function buildSlotPickerHTML(mode) {
        const isLoad = mode === 'load';
        const title = isLoad ? '📂 Load Game' : '💾 Save Game';
        let html = '<div class="save-slots-list">';
        for (let i = 1; i <= NUM_SAVE_SLOTS; i++) {
            const meta = getSlotMeta(i);
            const isLast = (i === lastUsedSlot);
            const isEmpty = !meta;
            const slotClass = 'save-slot-row' + (isLast ? ' save-slot-highlighted' : '') + (isLoad && isEmpty ? ' save-slot-disabled' : '');
            if (isEmpty) {
                html += '<div class="' + slotClass + '" data-slot="' + i + '">' +
                    '<span class="save-slot-num">[' + i + ']</span>' +
                    '<span class="save-slot-empty">— Empty Slot —</span>' +
                    (isLoad ? '<button class="save-slot-import btn-medieval" data-import-slot="' + i + '" title="Import Save File">📥 Import</button>' : '') +
                    '</div>';
            } else {
                const dateStr = meta.savedAt ? new Date(meta.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                const safePlayerName = _escapeSaveSlotHTML(meta.playerName);
                const safeDay = _escapeSaveSlotHTML(meta.day);
                const safeSeason = _escapeSaveSlotHTML(meta.season);
                const safeYear = _escapeSaveSlotHTML(meta.year);
                const safeGold = _escapeSaveSlotHTML(Math.floor(meta.gold).toLocaleString());
                const safeDateStr = _escapeSaveSlotHTML(dateStr);
                html += '<div class="' + slotClass + '" data-slot="' + i + '">' +
                    '<div class="save-slot-left">' +
                    '<div class="save-slot-info">' +
                    '<span class="save-slot-num">[' + i + ']</span>' +
                    '<span class="save-slot-name">' + safePlayerName + '</span>' +
                    '</div>' +
                    '<div class="save-slot-details">' +
                    'Day ' + safeDay + ' — ' + safeSeason + ', Year ' + safeYear +
                    '</div>' +
                    '<div class="save-slot-meta">' +
                    '🪙 ' + safeGold + '  •  ' + safeDateStr +
                    '</div>' +
                    '</div>' +
                    '<div class="save-slot-actions">' +
                    '<button class="save-slot-download btn-medieval" data-download-slot="' + i + '" title="Download Save">📤 Download</button>' +
                    (isLoad ? '<button class="save-slot-import btn-medieval" data-import-slot="' + i + '" title="Import Save File">📥 Import</button>' : '') +
                    (isLoad ? '<button class="save-slot-delete btn-medieval" data-delete-slot="' + i + '" title="Delete Save">🗑️</button>' : '') +
                    '</div>' +
                    '</div>';
            }
        }
        html += '</div>';

        // Autosave slots (only in load mode, only if they exist)
        if (isLoad) {
            var autoA = getAutosaveMeta('A');
            var autoB = getAutosaveMeta('B');
            if (autoA || autoB) {
                html += '<div style="margin-top:10px;border-top:1px solid rgba(212,175,55,0.3);padding-top:8px;">';
                html += '<div style="font-size:12px;color:#d4af37;margin-bottom:6px;">🔄 Autosaves</div>';
                var autoSlots = [{ label: 'A', meta: autoA }, { label: 'B', meta: autoB }];
                for (var _as = 0; _as < autoSlots.length; _as++) {
                    var _asl = autoSlots[_as];
                    if (!_asl.meta) continue;
                    var _aDateStr = _asl.meta.savedAt ? new Date(_asl.meta.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
                    var _safeAutoName = _escapeSaveSlotHTML(_asl.meta.playerName);
                    var _safeAutoDay = _escapeSaveSlotHTML(_asl.meta.day);
                    var _safeAutoSeason = _escapeSaveSlotHTML(_asl.meta.season);
                    var _safeAutoYear = _escapeSaveSlotHTML(_asl.meta.year);
                    var _safeAutoGold = _escapeSaveSlotHTML(Math.floor(_asl.meta.gold).toLocaleString());
                    var _safeAutoDate = _escapeSaveSlotHTML(_aDateStr);
                    html += '<div class="save-slot-row" data-autosave-slot="' + _asl.label + '" style="cursor:pointer;border-left:3px solid rgba(100,180,100,0.5);">' +
                        '<div class="save-slot-left">' +
                        '<div class="save-slot-info">' +
                        '<span class="save-slot-num" style="color:#8c8;">[Auto ' + _asl.label + ']</span>' +
                        '<span class="save-slot-name">' + _safeAutoName + '</span>' +
                        '</div>' +
                        '<div class="save-slot-details">' +
                        'Day ' + _safeAutoDay + ' — ' + _safeAutoSeason + ', Year ' + _safeAutoYear +
                        '</div>' +
                        '<div class="save-slot-meta">' +
                        '🪙 ' + _safeAutoGold + '  •  ' + _safeAutoDate +
                        '</div>' +
                        '</div>' +
                        '</div>';
                }
                html += '</div>';
            }
        }

        // Add debug file download button at the bottom
        html += '<div style="margin-top:12px;text-align:center;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px;">' +
            '<button class="btn-medieval save-slot-debug" title="Download a debug file containing your save data, console logs, and error info to send to the developer">🐛 Download Debug File</button>' +
            '</div>';
        return { title, html };
    }

    function showSaveSlotPicker() {
        if (state !== 'playing' && state !== 'paused') {
            if (typeof UI !== 'undefined') UI.toast('Nothing to save.', 'warning');
            return;
        }
        const { title, html } = buildSlotPickerHTML('save');
        UI.openModal(title, html, '');
        // Bind slot clicks
        setTimeout(function () {
            document.querySelectorAll('.save-slot-row').forEach(function (row) {
                row.addEventListener('click', function (e) {
                    if (e.target.dataset.downloadSlot || e.target.dataset.importSlot) return;
                    const slot = parseInt(this.dataset.slot);
                    const existing = getSlotMeta(slot);
                    if (existing) {
                        if (confirm('Overwrite save in Slot ' + slot + '?\n"' + existing.playerName + ' — Day ' + existing.day + '"')) {
                            saveToSlot(slot);
                            UI.closeModal();
                        }
                    } else {
                        saveToSlot(slot);
                        UI.closeModal();
                    }
                });
            });
            document.querySelectorAll('[data-download-slot]').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    downloadSave(parseInt(this.dataset.downloadSlot));
                });
            });
            var debugBtnSave = document.querySelector('.save-slot-debug');
            if (debugBtnSave) {
                debugBtnSave.addEventListener('click', function (e) {
                    e.stopPropagation();
                    downloadDebugFile();
                });
            }
        }, 50);
    }

    function showLoadSlotPicker() {
        const { title, html } = buildSlotPickerHTML('load');
        UI.openModal(title, html, '');
        setTimeout(function () {
            document.querySelectorAll('.save-slot-row:not(.save-slot-disabled)').forEach(function (row) {
                row.addEventListener('click', function (e) {
                    if (e.target.dataset.deleteSlot || e.target.dataset.downloadSlot || e.target.dataset.importSlot) return;
                    if (this.dataset.autosaveSlot) return; // handled separately
                    const slot = parseInt(this.dataset.slot);
                    if (getSlotMeta(slot)) {
                        UI.closeModal();
                        loadFromSlot(slot);
                    }
                });
            });
            // Also allow clicking empty slots for import
            document.querySelectorAll('.save-slot-row.save-slot-disabled').forEach(function (row) {
                row.addEventListener('click', function (e) {
                    if (e.target.dataset.importSlot) return;
                });
            });
            document.querySelectorAll('[data-delete-slot]').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const slot = parseInt(this.dataset.deleteSlot);
                    const meta = getSlotMeta(slot);
                    if (meta && confirm('Delete save in Slot ' + slot + '?\n"' + meta.playerName + ' — Day ' + meta.day + '"')) {
                        _deleteSave(SAVE_SLOT_PREFIX + slot).then(function() {
                            if (lastUsedSlot === slot) {
                                lastUsedSlot = 0;
                                localStorage.setItem('merchantRealms_lastSlot', '0');
                            }
                            UI.closeModal();
                            showLoadSlotPicker();
                        });
                    }
                });
            });
            document.querySelectorAll('[data-download-slot]').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    downloadSave(parseInt(this.dataset.downloadSlot));
                });
            });
            document.querySelectorAll('[data-import-slot]').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    importSaveToSlot(parseInt(this.dataset.importSlot));
                });
            });
            var debugBtn = document.querySelector('.save-slot-debug');
            if (debugBtn) {
                debugBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    downloadDebugFile();
                });
            }
            // Autosave slot click handlers
            document.querySelectorAll('[data-autosave-slot]').forEach(function (row) {
                row.addEventListener('click', function (e) {
                    var slot = this.dataset.autosaveSlot;
                    UI.closeModal();
                    loadAutosave(slot);
                });
            });
        }, 50);
    }

    function saveToSlot(slotNum) {
        try {
            var data = _buildSavePayload();
            _compressAndStore(SAVE_SLOT_PREFIX + slotNum, data).then(function() {
                lastUsedSlot = slotNum;
                localStorage.setItem('merchantRealms_lastSlot', String(slotNum));
                if (typeof UI !== 'undefined') UI.toast('Saved to Slot ' + slotNum + '!', 'success');
            }).catch(function(err) {
                console.error('Save failed:', err);
                if (typeof UI !== 'undefined') UI.toast('Save failed: ' + (err.message || 'Unknown error'), 'danger');
            });
        } catch (e) {
            console.error('Save failed:', e);
            if (typeof UI !== 'undefined') UI.toast('Save failed: ' + (e.message || 'Unknown error'), 'danger');
        }
    }

    function saveGame() {
        if (state !== 'playing' && state !== 'paused') {
            if (typeof UI !== 'undefined') UI.toast('Nothing to save.', 'warning');
            return;
        }
        showSaveSlotPicker();
    }

    // v9p33river191: comprehensive state reset that does NOT touch IndexedDB
    // saves. Call this before loading a saved game (in-place) and before
    // returning to the title screen, so the next phase starts from a clean
    // slate without needing a full page reload. Touches every transient
    // window flag, UI overlay, render cache, autosave timer, animation
    // frame, music state, story tracker, tutorial panel, and engine/player
    // module state we know about.
    function _resetEverythingExceptSaves() {
        try { stopAutosave(); } catch(e) {}
        if (animFrameId) { try { cancelAnimationFrame(animFrameId); } catch(e) {} animFrameId = null; }

        // Tutorial cleanup
        try {
            if (typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.isActive()) {
                Tutorial.cleanup();
            }
        } catch(e) {}
        var tutPanel = document.getElementById('tutorialPanel');
        if (tutPanel) tutPanel.remove();

        // Tutorial / story flags
        delete window._tutorialMinimapClicked;
        delete window._tutorialLocateUsed;
        delete window._tutorialAteFood;
        delete window._tutorialDrankWater;
        delete window._tutorialSocialInteracted;
        delete window._tutorialSmallTalkDone;
        delete window._tutorialRested;
        delete window._restPauseSavedSpeed;
        delete window._loadAfterReload;
        delete window._godInvincible;
        delete window._selectedStartConfig;

        // Story-mode runtime state
        try {
            if (typeof StoryMode !== 'undefined' && StoryMode.deserialize) {
                StoryMode.deserialize({ active: false, chapter: 0, complete: false });
            }
        } catch(e) {}
        try {
            if (typeof UI !== 'undefined') {
                if (UI.closeStoryDialog) UI.closeStoryDialog();
                if (UI.hideStoryTracker) UI.hideStoryTracker();
            }
        } catch(e) {}

        // UI overlays / locks / banners
        try {
            if (typeof UI !== 'undefined') {
                if (UI.closeModal) UI.closeModal();
                UI._funeralLocked = false;
                UI._regencyToastsSuppressed = false;
                if (UI.hideRegencyFastForward) UI.hideRegencyFastForward();
                if (UI._clearBankruptcyLock) UI._clearBankruptcyLock();
                if (UI.hideGameUI) UI.hideGameUI();
            }
        } catch(e) {}

        // Stale tutorial/story highlight classes
        try {
            document.querySelectorAll('.tab-btn.tutorial-highlight').forEach(function(t) { t.classList.remove('tutorial-highlight'); });
            document.querySelectorAll('.tab-btn.active').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.sub-menu-btn.tutorial-highlight').forEach(function(t) { t.classList.remove('tutorial-highlight'); });
        } catch(e) {}

        // Transient overlays / floating panels
        var transientIds = [
            'endScreen', 'healthAlert', 'modalOverlay',
            'storyDialogOverlay',
            'icons-glossary-overlay', 'game-guide-overlay', 'goods-guide-overlay',
            'kingdoms-notables-overlay'
        ];
        for (var ti = 0; ti < transientIds.length; ti++) {
            var el = document.getElementById(transientIds[ti]);
            if (!el) continue;
            if (transientIds[ti] === 'endScreen' || transientIds[ti] === 'modalOverlay') {
                el.classList.add('hidden');
                if (transientIds[ti] === 'endScreen') el.style.display = 'none';
            } else if (transientIds[ti] === 'healthAlert') {
                el.classList.remove('visible');
            } else {
                el.remove();
            }
        }

        // Stop TTS and any audio
        try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch(e) {}
        try { if (typeof Music !== 'undefined' && Music.stopAll) Music.stopAll(); } catch(e) {}

        // Renderer caches — invalidate everything possible
        try {
            if (typeof Renderer !== 'undefined') {
                if (Renderer.invalidateSceneCache) Renderer.invalidateSceneCache();
                if (Renderer.invalidateTerrain) Renderer.invalidateTerrain();
            }
        } catch(e) {}

        // Game-loop bookkeeping
        _lastErrorCheckDay = 0;
        _lastErrorCount = 0;
        _consoleLogs.length = 0;
        _seedProcessedEvents([]);
    }

    function loadFromSlot(slotNum) {
        getSlotData(slotNum).then(function(data) {
            if (!data) {
                if (typeof UI !== 'undefined') UI.toast('No save in Slot ' + slotNum + '.', 'warning');
                return;
            }
            try {
                _restoreLoadedSave(data, { slotNum: slotNum, toastMessage: 'Loaded Slot ' + slotNum + '!' });
            } catch (e) {
                console.error('Load failed:', e);
                if (typeof UI !== 'undefined') UI.toast('Load failed: ' + (e.message || 'Unknown error'), 'danger');
            }
        }).catch(function(err) {
            console.error('Load failed:', err);
            if (typeof UI !== 'undefined') UI.toast('Load failed: ' + (err.message || 'Unknown error'), 'danger');
        });
    }

    function loadGame() {
        // Called from title screen "Load Game" button — show slot picker
        showLoadSlotPicker();
    }

    function hasSave() {
        for (let i = 1; i <= NUM_SAVE_SLOTS; i++) {
            if (localStorage.getItem(SAVE_SLOT_PREFIX + i + '_meta')) return true;
            if (_knownIDBSaveKeys[SAVE_SLOT_PREFIX + i]) return true; // v9p33river329: IDB payload can outlive localStorage metadata.
        }
        return false;
    }

    // ── Error Notification & Debug System ──

    function checkErrorNotifications() {
        if (state !== 'playing') return;
        var day = 0;
        try { day = Engine.getDay(); } catch(e) { return; }
        if (day - _lastErrorCheckDay < 30) return;
        _lastErrorCheckDay = day;

        // Count errors since last check
        var errorCount = 0;
        for (var i = 0; i < _consoleLogs.length; i++) {
            var lvl = _consoleLogs[i].level;
            if (lvl === 'ERROR' || lvl === 'UNCAUGHT' || lvl === 'UNHANDLED_PROMISE') {
                errorCount++;
            }
        }

        var newErrors = errorCount - _lastErrorCount;
        _lastErrorCount = errorCount;

        if (newErrors > 0) {
            // Check if player has error_alerts enabled
            var showAlert = false;
            try {
                var filters = Player.state.notificationFilters;
                if (filters && filters.error_alerts) showAlert = true;
            } catch(e) {}

            if (showAlert && typeof UI !== 'undefined' && UI.toast) {
                UI.toast('⚠️ ' + newErrors + ' error(s) detected in the last 30 days. Check notifications for details.', 'warning', 'critical');
                // Log the error summary to event log
                if (typeof Engine !== 'undefined' && Engine.logEvent) {
                    Engine.logEvent('⚠️ ' + newErrors + ' console error(s) detected. Use the debug file download in Save/Load to report issues.', {
                        type: 'error_alert',
                        category: 'critical'
                    });
                }
            }
        }
    }

    function downloadDebugFile() {
        try {
            var debugData = {};

            // 1. Console logs
            debugData.consoleLogs = _consoleLogs.slice();

            // 2. Current save data — serialize live state (avoids async IDB read)
            var saveData = null;
            if (state === 'playing') {
                try {
                    saveData = {
                        engine: Engine.serialize ? Engine.serialize() : null,
                        player: Player.serialize ? Player.serialize() : null,
                        day: Engine.getDay ? Engine.getDay() : 0
                    };
                } catch(e) { saveData = { error: 'Could not serialize: ' + e.message }; }
            }
            debugData.saveData = saveData;

            // 3. Game metadata
            debugData.meta = {
                gameVersion: 'v0.85.0',
                saveVersion: 3,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                screenSize: window.innerWidth + 'x' + window.innerHeight,
                gameState: state,
                currentDay: 0,
                currentSeason: '',
                playerName: '',
                playerGold: 0,
                playerTown: ''
            };
            try {
                debugData.meta.currentDay = Engine.getDay();
                debugData.meta.currentSeason = Engine.getSeason();
                debugData.meta.playerName = Player.fullName || '';
                debugData.meta.playerGold = Player.gold || 0;
                debugData.meta.playerTown = Player.townId || '';
            } catch(e) {}

            // 4. Error summary
            var errors = [];
            for (var i = 0; i < _consoleLogs.length; i++) {
                var lvl = _consoleLogs[i].level;
                if (lvl === 'ERROR' || lvl === 'UNCAUGHT' || lvl === 'UNHANDLED_PROMISE') {
                    errors.push(_consoleLogs[i]);
                }
            }
            debugData.errorSummary = {
                totalErrors: errors.length,
                totalLogs: _consoleLogs.length,
                errors: errors
            };

            // 5. Performance info
            debugData.performance = {
                memoryUsed: (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : 'N/A'),
                memoryTotal: (performance.memory ? Math.round(performance.memory.totalJSHeapSize / 1048576) + 'MB' : 'N/A')
            };

            // Download as file
            var jsonStr = JSON.stringify(debugData, null, 2);
            var blob = new Blob([jsonStr], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            var dayStr = debugData.meta.currentDay || 'unknown';
            a.download = 'merchant_realms_debug_day' + dayStr + '_' + Date.now() + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (typeof UI !== 'undefined' && UI.toast) {
                UI.toast('📦 Debug file downloaded! Send this to the developer.', 'success');
            }
        } catch(e) {
            console.error('Debug file download failed:', e);
            if (typeof UI !== 'undefined' && UI.toast) {
                UI.toast('❌ Debug file download failed: ' + e.message, 'danger');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════════

    // ── God Mode ──
    var _godModeSequence = '0621ac,./';
    var _godModeBuffer = '';
    var _godModeBufferTimeout = null;
    var _godModeActive = false;

    document.addEventListener('keydown', function(e) {
        var key = e.key;
        if (key.length === 1) {
            _godModeBuffer += key;
            clearTimeout(_godModeBufferTimeout);
            _godModeBufferTimeout = setTimeout(function() { _godModeBuffer = ''; }, 5000);
            if (_godModeBuffer.endsWith(_godModeSequence)) {
                _godModeBuffer = '';
                toggleGodMode();
            }
            if (_godModeBuffer.length > 30) {
                _godModeBuffer = _godModeBuffer.slice(-15);
            }
        }
    });

    function toggleGodMode() {
        _godModeActive = !_godModeActive;
        if (_godModeActive) {
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('🔮 GOD MODE ACTIVATED', 'success');
            if (typeof UI !== 'undefined' && UI.openGodModePanel) UI.openGodModePanel();
        } else {
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('🔮 God Mode deactivated', 'info');
            if (typeof UI !== 'undefined' && UI.closeGodModePanel) UI.closeGodModePanel();
        }
    }

    function isGodMode() { return _godModeActive; }

    return {
        init,
        setSpeed,
        togglePause,
        on,
        emit,
        getState: () => state,
        setState: function(s) { state = s; },
        getSpeed: () => speed,
        save: saveGame,
        load: loadGame,
        hasSave,
        showSaveSlotPicker,
        showLoadSlotPicker,
        loadFromSlot,
        downloadSave,
        importSaveToSlot,
        startNewGame,
        showCharacterCreation,
        showGameModeSelection,
        advanceTicks,
        isGodMode,
        downloadDebugFile,
        getConsoleLogs: function() { return _consoleLogs; },
        exportConsole: function() {
            var text = _consoleLogs.map(function(e) {
                return '[' + e.t + '] [' + e.level + '] ' + e.msg;
            }).join('\n');
            if (!text) text = '(No console logs captured)';
            navigator.clipboard.writeText(text).then(function() {
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('📋 Console logs copied! (' + _consoleLogs.length + ' entries)', 'success');
            }).catch(function() {
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('❌ Clipboard write failed', 'error');
            });
            return text;
        },
        setupInput: setupInput,
        startLoop: function() {
            lastTickTime = performance.now();
            tickAccumulator = 0;
            tickCounter = 0;
            lastFrameTime = performance.now();
            var _slEvents = Engine.getEvents ? Engine.getEvents() : [];
            _seedProcessedEvents(_slEvents);
            if (!animFrameId) {
                loop(performance.now());
            }
            startAutosave();
        },
        showTitleScreen: function () {
            console.log('[Menu] showTitleScreen — full reset (v9p33river191)');
            // v9p33river191: route through _resetEverythingExceptSaves so we
            // share the same cleanup pipeline as in-game load. Then put the
            // title-screen DOM back up and start title music. No page reload
            // (which previously caused the menu to flash and music to switch
            // back to title during in-game load).
            state = 'title';
            _resetEverythingExceptSaves();

            var ts = document.getElementById('titleScreen');
            if (ts) { ts.classList.remove('hidden'); ts.style.display = 'flex'; }
            var cs = document.getElementById('charCreateScreen');
            if (cs) { cs.classList.add('hidden'); cs.style.display = 'none'; }
            var gms = document.getElementById('gameModeScreen');
            if (gms) { gms.style.display = 'none'; }
            var kss = document.getElementById('kingdomSelectScreen');
            if (kss) { kss.classList.add('hidden'); kss.style.display = 'none'; }
            var btnLoad = document.getElementById('btnLoadGame');
            if (btnLoad) btnLoad.style.display = '';

            try { if (typeof Music !== 'undefined') Music.playTitleMusic(); } catch(e) {}
        },
    };
})();

// ── Auto-initialize on DOM ready ──
document.addEventListener('DOMContentLoaded', function () {
    Game.init();
});
