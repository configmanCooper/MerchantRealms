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

        // Migrate old single-save to slot 1
        migrateOldSave();

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

        // Find towns in Valdren
        var valdrenTowns = towns.filter(function(t) { return t.kingdomId === valdren.id; });
        if (valdrenTowns.length < 3) {
            // Fallback: just use first 3 towns
            valdrenTowns = towns.slice(0, 3);
        }

        // Rename first 3 Valdren towns to story towns
        valdrenTowns[0].name = 'Ashford';
        if (valdrenTowns.length > 1) valdrenTowns[1].name = 'Millhaven';
        if (valdrenTowns.length > 2) valdrenTowns[2].name = 'Ferrowdale';

        // Set capital — must NOT be Ashford (it gets captured in story)
        if (valdren.capitalTownId) {
            var capital = Engine.findTown(valdren.capitalTownId);
            if (!capital || capital.name === 'Ashford' || capital.name === 'Millhaven' || capital.name === 'Ferrowdale') {
                // Reassign capital to a non-story town
                if (valdrenTowns.length > 3) {
                    valdren.capitalTownId = valdrenTowns[3].id;
                } else {
                    // No other Valdren towns — pick any non-Ashford town
                    for (var ci = valdrenTowns.length - 1; ci >= 0; ci--) {
                        if (valdrenTowns[ci].name !== 'Ashford') { valdren.capitalTownId = valdrenTowns[ci].id; break; }
                    }
                }
            }
        }

        // Ensure Ashford has required buildings
        var ashford = valdrenTowns[0];

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

        // Ensure road between Ashford and Ferrowdale is short (~2 days walk)
        var world = Engine.getWorld();
        if (world && valdrenTowns.length > 2) {
            var ashfordId = valdrenTowns[0].id;
            var ferrowdaleId = valdrenTowns[2].id;
            var ashford_t = valdrenTowns[0];
            var ferrowdale_t = valdrenTowns[2];

            // Move Ferrowdale close to Ashford if too far (max ~200 units for ~2 day walk on quality 3 road)
            var dist = Math.hypot(ashford_t.x - ferrowdale_t.x, ashford_t.y - ferrowdale_t.y);
            var maxDist = 200; // quality 3 road: effective = dist/2, walk speed 60/day → 2 days = 120 effective → 240 actual
            if (dist > maxDist) {
                // Move Ferrowdale to be ~180 units from Ashford in the same direction
                var angle = Math.atan2(ferrowdale_t.y - ashford_t.y, ferrowdale_t.x - ashford_t.x);
                ferrowdale_t.x = Math.round(ashford_t.x + Math.cos(angle) * 180);
                ferrowdale_t.y = Math.round(ashford_t.y + Math.sin(angle) * 180);
            }

            // Ensure Ferrowdale is NOT a port (force land-only connection)
            ferrowdale_t.isPort = false;
            ferrowdale_t.hasHarbor = false;

            // Remove any sea routes between Ashford and Ferrowdale
            if (world.seaRoutes) {
                world.seaRoutes = world.seaRoutes.filter(function(sr) {
                    return !((sr.fromTownId === ashfordId && sr.toTownId === ferrowdaleId) ||
                             (sr.fromTownId === ferrowdaleId && sr.toTownId === ashfordId));
                });
            }

            // Ensure a quality 3 land road exists
            if (world.roads) {
                for (var ri = 0; ri < world.roads.length; ri++) {
                    var road = world.roads[ri];
                    if ((road.fromTownId === ashfordId && road.toTownId === ferrowdaleId) ||
                        (road.fromTownId === ferrowdaleId && road.toTownId === ashfordId)) {
                        road.quality = 3;
                        road.type = 'land';
                        // Update waypoints to match new positions
                        road.waypoints = [
                            { x: ashford_t.x, y: ashford_t.y },
                            { x: (ashford_t.x + ferrowdale_t.x) / 2, y: (ashford_t.y + ferrowdale_t.y) / 2 },
                            { x: ferrowdale_t.x, y: ferrowdale_t.y }
                        ];
                        break;
                    }
                }

                // If no direct road exists, create one
                var hasDirectRoad = world.roads.some(function(r) {
                    return (r.fromTownId === ashfordId && r.toTownId === ferrowdaleId) ||
                           (r.fromTownId === ferrowdaleId && r.toTownId === ashfordId);
                });
                if (!hasDirectRoad) {
                    world.roads.push({
                        fromTownId: ashfordId,
                        toTownId: ferrowdaleId,
                        quality: 3,
                        type: 'land',
                        safe: true,
                        hasBridge: false,
                        bridgeDestroyed: false,
                        bridgeSegments: [],
                        bridges: [],
                        waypoints: [
                            { x: ashford_t.x, y: ashford_t.y },
                            { x: (ashford_t.x + ferrowdale_t.x) / 2, y: (ashford_t.y + ferrowdale_t.y) / 2 },
                            { x: ferrowdale_t.x, y: ferrowdale_t.y }
                        ]
                    });
                }
            }
        }

        // Connect Ashford to a Korvathi border town that supplies iron
        if (korvath && world) {
            var korvathTowns = towns.filter(function(t) { return t.kingdomId === korvath.id; });
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

                // Move border town closer if too far
                var btDist = Math.hypot(ashfordT.x - borderTown.x, ashfordT.y - borderTown.y);
                if (btDist > 250) {
                    var btAngle = Math.atan2(borderTown.y - ashfordT.y, borderTown.x - ashfordT.x);
                    borderTown.x = Math.round(ashfordT.x + Math.cos(btAngle) * 220);
                    borderTown.y = Math.round(ashfordT.y + Math.sin(btAngle) * 220);
                }

                // Ensure a road exists between Ashford and the Korvathi border town
                var _ashId = ashfordT.id;
                var _btId = borderTown.id;
                if (world.roads) {
                    var _hasRoad = world.roads.some(function(r) {
                        return (r.fromTownId === _ashId && r.toTownId === _btId) ||
                               (r.fromTownId === _btId && r.toTownId === _ashId);
                    });
                    if (!_hasRoad) {
                        world.roads.push({
                            fromTownId: _ashId,
                            toTownId: _btId,
                            quality: 2,
                            type: 'land',
                            safe: true,
                            hasBridge: false,
                            bridgeDestroyed: false,
                            bridgeSegments: [],
                            bridges: [],
                            waypoints: [
                                { x: ashfordT.x, y: ashfordT.y },
                                { x: (ashfordT.x + borderTown.x) / 2, y: (ashfordT.y + borderTown.y) / 2 },
                                { x: borderTown.x, y: borderTown.y }
                            ]
                        });
                    }
                }

                console.log('[StoryMode] Korvathi border town: ' + borderTown.name + ' connected to Ashford with iron supply');
            }
        }
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
            // If name left blank, pick a random NPC-style name from NAMES pool
            const playerFirstName = (firstNameInput && firstNameInput.value.trim()) ||
                (typeof NAMES !== 'undefined' ? NAMES[playerSex === 'F' ? 'female' : 'male'][Math.floor(Math.random() * NAMES[playerSex === 'F' ? 'female' : 'male'].length)] : 'Unknown');
            var isStoryStart = window._selectedStartConfig && window._selectedStartConfig.id === 'story_mode';
            const playerLastName = isStoryStart ? 'Ashford' :
                ((lastNameInput && lastNameInput.value.trim()) ||
                (typeof NAMES !== 'undefined' ? NAMES.surnames[Math.floor(Math.random() * NAMES.surnames.length)] : 'Merchant'));

            // Hide character creation screen
            const charCreateScreen = document.getElementById('charCreateScreen');
            if (charCreateScreen) {
                charCreateScreen.classList.add('hidden');
                charCreateScreen.style.display = 'none';
            }

            // Generate world with random seed
            if (typeof Engine !== 'undefined' && Engine.generate) {
                Engine.generate(Math.floor(Math.random() * 999999) + 1);
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
                    lastProcessedEventCount = _initEvents ? _initEvents.length : 0;
                    if (!animFrameId) { loop(performance.now()); }
                    if (typeof Music !== 'undefined') Music.playGameMusic('peaceful');
                    startAutosave();
                    UI.toast('Welcome, ' + playerFirstName + '! Your story begins in ' + (storyTown ? storyTown.name : 'your hometown') + '.', 'info');
                    console.log('[StoryMode] Game started successfully');
                } catch (e) {
                    console.error('[StoryMode] Game start FAILED:', e);
                    console.error('[StoryMode] Stack:', e.stack);
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
                            Player.skinTone = playerSkinTone;
                            Player.faceType = playerFaceType;
                        }
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
                    lastProcessedEventCount = _initEvents ? _initEvents.length : 0;

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

        // Render (skip frames during fast-forward for performance)
        _loopFrameCount++;
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
            }
        }
        // At high speed, still update the day/year display every frame so it stays current
        if (_skipRender || _freezeMap) {
            try { if (UI.updateDateDisplay) UI.updateDateDisplay(); } catch (_e) { /* no-op */ }
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
        if (count <= 0) return;
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

    function processEvents() {
        try {
            const events = Engine.getEvents ? Engine.getEvents() : [];
            if (!events) return;

            // Guard against event log pruning making our counter stale
            if (lastProcessedEventCount > events.length) {
                lastProcessedEventCount = events.length;
            }

            // Only process new events
            if (events.length > lastProcessedEventCount) {
                const newEvents = events.slice(lastProcessedEventCount);
                for (const event of newEvents) {
                    // Handle war allegiance popup (suppress during tutorial)
                    if (event.type === 'warDeclared') {
                        var tutorialActive = typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.isActive();
                        if (!tutorialActive && typeof Player !== 'undefined' && Player.shouldShowWarAllegiancePopup && Player.shouldShowWarAllegiancePopup(event)) {
                            // Auto-neutral only in the very early game (first 30 days)
                            var earlyGame = (Engine.getDay ? Engine.getDay() : 999) <= 30;
                            if (earlyGame) {
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
                        UI.toast(msg, toastType, evtCategory, true);
                    }
                    emit('eventOccurred', event);
                }
                lastProcessedEventCount = events.length;
            }
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
        if (s === 0) {
            state = 'paused';
        } else if (state === 'paused') {
            state = 'playing';
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
        if (window._inputSetup) return;
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;
        window._inputSetup = true;

        // Ensure canvas can receive keyboard focus
        if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
        canvas.style.outline = 'none';
        canvas.focus({ preventScroll: true });

        // Mouse events
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('contextmenu', onContextMenu);
        canvas.addEventListener('dblclick', onDoubleClick);

        // Touch events
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);

        // Minimap clicks
        const minimap = document.getElementById('minimapCanvas');
        if (minimap) {
            minimap.addEventListener('mousedown', onMinimapClick);
            minimap.addEventListener('mousemove', function (e) {
                if (e.buttons === 1) onMinimapClick(e);
            });
        }

        // Keyboard
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        // Resize
        window.addEventListener('resize', onResize);
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

    function onMouseMove(e) {
        input.mouseX = e.clientX;
        input.mouseY = e.clientY;
        if (typeof Renderer !== 'undefined' && Renderer.getMapMode() === 2) return;
        if (speed >= 60) return; // Map frozen at 60x

        if (input.mouseDown && input.mouseDragStart) {
            const dx = e.clientX - input.mouseDragStart.x;
            const dy = e.clientY - input.mouseDragStart.y;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                input.isDragging = true;
                Renderer.pan(-dx, -dy);
                input.mouseDragStart = { x: e.clientX, y: e.clientY };
                document.getElementById('gameCanvas').style.cursor = 'grabbing';
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
            document.getElementById('gameCanvas').style.cursor = 'default';
        }
    }

    function onMouseLeave() {
        input.mouseDown = false;
        input.isDragging = false;
        input.mouseDragStart = null;
        UI.hideTooltip();
        document.getElementById('gameCanvas').style.cursor = 'default';
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

    function onTouchStart(e) {
        e.preventDefault();
        // Cancel any ongoing momentum panning
        if (momentumId) { cancelAnimationFrame(momentumId); momentumId = null; }
        if (typeof Renderer !== 'undefined' && Renderer.getMapMode() === 2) return;
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
        e.preventDefault();
        if (typeof Renderer !== 'undefined' && Renderer.getMapMode() === 2) return;
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

            items.push({ icon: '👁', label: 'View Details', action: `UI.showTownDetail(Engine.getTown('${town.id}'))` });
            if (!isHere) {
                // Road travel options only available when in a town (not mid-travel/offroad)
                // Outposts without a road cannot be reached via road travel
                const _isOutpostNoRoad = town.isOutpost && !town.hasRoad;
                if (Player.townId && !Player.traveling && !_isOutpostNoRoad) {
                    items.push({ icon: '🗺️', label: 'Travel Here...', action: `UI.openTravelOptions('${town.id}')` });
                }
                // Offroad travel always available
                items.push({ icon: '🥾', label: 'Travel Off-road to ' + town.name, action: 'UI.confirmFreeTravel(' + town.x + ',' + town.y + ')' });
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
            // Offroad travel to this point on the road
            if (typeof Player !== 'undefined') {
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
                        if (inPort || Player.travelOffSea) {
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
    //  SAVE / LOAD SYSTEM (5 Slots)
    // ═══════════════════════════════════════════════════════════

    const SAVE_SLOT_PREFIX = 'merchantRealms_slot_';
    const OLD_SAVE_KEY = 'merchantRealms_save';
    const NUM_SAVE_SLOTS = 5;
    let lastUsedSlot = parseInt(localStorage.getItem('merchantRealms_lastSlot')) || 0;

    // ── Autosave System ──
    const AUTOSAVE_SLOT_A = 'merchantRealms_autosave_A';
    const AUTOSAVE_SLOT_B = 'merchantRealms_autosave_B';
    const AUTOSAVE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
    let _autosaveTimerId = null;
    // Track which autosave slot is "older" — we always overwrite the older one
    // Start with A so first save goes to A, second to B, then back to A, etc.
    let _autosaveNextSlot = 'A';

    // ═══════════════════════════════════════════════════════════
    //  SAVE MIGRATION SYSTEM
    //  Each migration upgrades from version N to N+1.
    //  Runs before deserialize to ensure data shape is current.
    // ═══════════════════════════════════════════════════════════

    const CURRENT_SAVE_VERSION = 6;

    const SAVE_MIGRATIONS = {
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
            version: 4,
            engine: engineData,
            player: playerData,
            aiMerchants: Player.serializeAI ? Player.serializeAI() : null,
        };
    }

    function _compressAndStore(key, data) {
        const jsonStr = JSON.stringify(data);
        let saveStr = jsonStr;
        if (typeof LZString !== 'undefined') {
            saveStr = LZString.compressToUTF16(jsonStr);
        }
        localStorage.setItem(key, saveStr);
        // Store lightweight metadata separately for fast slot picker display
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
        } catch (_e) { /* metadata is optional — slot picker will fall back to full parse */ }
    }

    function _performAutosave() {
        if (state !== 'playing' && state !== 'paused') return;
        try {
            var data = _buildSavePayload();
            data.isAutosave = true;
            var key = _autosaveNextSlot === 'A' ? AUTOSAVE_SLOT_A : AUTOSAVE_SLOT_B;
            _compressAndStore(key, data);
            console.log('[Autosave] Saved to slot ' + _autosaveNextSlot + ' on Day ' + data.day);
            // Alternate to the other slot next time
            _autosaveNextSlot = _autosaveNextSlot === 'A' ? 'B' : 'A';
        } catch (e) {
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
        try {
            var key = slot === 'A' ? AUTOSAVE_SLOT_A : AUTOSAVE_SLOT_B;
            var raw = localStorage.getItem(key);
            if (!raw) return null;
            if (typeof LZString !== 'undefined') {
                var decompressed = LZString.decompressFromUTF16(raw);
                if (decompressed) {
                    try { return JSON.parse(decompressed); } catch (e2) { /* fall through */ }
                }
            }
            return JSON.parse(raw);
        } catch (e) { return null; }
    }

    function getAutosaveMeta(slot) {
        // Fast path: read lightweight metadata
        try {
            var key = slot === 'A' ? AUTOSAVE_SLOT_A : AUTOSAVE_SLOT_B;
            var metaRaw = localStorage.getItem(key + '_meta');
            if (metaRaw) return JSON.parse(metaRaw);
        } catch (_e) { /* fall through */ }
        // Slow fallback for old autosaves without separate meta
        var data = getAutosaveData(slot);
        if (!data) return null;
        return {
            playerName: data.playerName || 'Unknown',
            day: data.day || 0,
            season: data.season || 'Spring',
            year: data.year || 1,
            kingdom: data.kingdom || '',
            rank: data.rank || '',
            gold: data.gold || 0,
            savedAt: data.savedAt || 0,
        };
    }

    function loadAutosave(slot) {
        var data = getAutosaveData(slot);
        if (!data) {
            if (typeof UI !== 'undefined') UI.toast('No autosave in slot ' + slot + '.', 'warning');
            return;
        }
        // Reuse the same load logic as normal slots
        try {
            _migrateSaveData(data);
            if (data.engine && Engine.deserialize) Engine.deserialize(data.engine);
            if (data.player && Player.deserialize) Player.deserialize(data.player);
            if (data.aiMerchants && Player.deserializeAI) Player.deserializeAI(data.aiMerchants);

            try { UI.update(); } catch (e) { console.error('UI update after autosave load:', e); }
            setupInput();
            state = 'playing';
            speed = 1;
            lastTickTime = performance.now();
            tickAccumulator = 0;
            tickCounter = 0;
            lastFrameTime = performance.now();
            const events = Engine.getEvents ? Engine.getEvents() : [];
            lastProcessedEventCount = events ? events.length : 0;
            if (!animFrameId) loop(performance.now());
            if (typeof Music !== 'undefined') Music.playGameMusic('peaceful');
            startAutosave();
            UI.toast('Loaded Autosave ' + slot + '!', 'success');
        } catch (e) {
            console.error('Autosave load failed:', e);
            if (typeof UI !== 'undefined') UI.toast('Autosave load failed: ' + (e.message || 'Unknown error'), 'danger');
        }
    }

    function migrateOldSave() {
        const old = localStorage.getItem(OLD_SAVE_KEY);
        if (old && !localStorage.getItem(SAVE_SLOT_PREFIX + '1')) {
            try {
                const data = JSON.parse(old);
                // Add metadata for slot display
                data.playerName = (data.player && data.player.fullName) || 'Unknown Merchant';
                data.day = (data.engine && data.engine.day) || 0;
                const dayNum = data.day || 0;
                const seasonIdx = Math.floor(dayNum / CONFIG.DAYS_PER_SEASON) % 4;
                data.season = CONFIG.SEASONS[seasonIdx] || 'Spring';
                data.year = Math.floor(dayNum / CONFIG.DAYS_PER_SEASON) + 1;
                data.kingdom = '';
                data.rank = '';
                data.gold = (data.player && data.player.gold) || 0;
                const jsonStr = JSON.stringify(data);
                let saveStr = jsonStr;
                if (typeof LZString !== 'undefined') {
                    saveStr = LZString.compressToUTF16(jsonStr);
                }
                localStorage.setItem(SAVE_SLOT_PREFIX + '1', saveStr);
                // Store metadata for fast slot picker
                try {
                    localStorage.setItem(SAVE_SLOT_PREFIX + '1_meta', JSON.stringify({
                        playerName: data.playerName, day: data.day, season: data.season,
                        year: data.year, kingdom: data.kingdom, rank: data.rank,
                        gold: data.gold, savedAt: data.savedAt || 0,
                    }));
                } catch (_e) { /* optional */ }
                localStorage.removeItem(OLD_SAVE_KEY);
                lastUsedSlot = 1;
                localStorage.setItem('merchantRealms_lastSlot', '1');
            } catch (e) {
                console.error('Migration failed:', e);
            }
        }
    }

    function getSlotData(slotNum) {
        try {
            const raw = localStorage.getItem(SAVE_SLOT_PREFIX + slotNum);
            if (!raw) return null;
            // Try decompressing first (new compressed format)
            if (typeof LZString !== 'undefined') {
                const decompressed = LZString.decompressFromUTF16(raw);
                if (decompressed) {
                    try { return JSON.parse(decompressed); } catch (e2) { /* fall through to raw parse */ }
                }
            }
            // Fallback: parse raw JSON (old uncompressed saves)
            return JSON.parse(raw);
        } catch (e) { return null; }
    }

    function getSlotMeta(slotNum) {
        // Fast path: read lightweight metadata stored alongside the save
        try {
            var metaRaw = localStorage.getItem(SAVE_SLOT_PREFIX + slotNum + '_meta');
            if (metaRaw) return JSON.parse(metaRaw);
        } catch (_e) { /* fall through to full parse */ }
        // Slow fallback: decompress + parse the full save (old saves without separate meta)
        const data = getSlotData(slotNum);
        if (!data) return null;
        return {
            playerName: data.playerName || 'Unknown',
            day: data.day || 0,
            season: data.season || 'Spring',
            year: data.year || 1,
            kingdom: data.kingdom || '',
            rank: data.rank || '',
            gold: data.gold || 0,
            savedAt: data.savedAt || 0,
        };
    }

    function downloadSave(slotNum) {
        const raw = localStorage.getItem(SAVE_SLOT_PREFIX + slotNum);
        if (!raw) { UI.toast('No save in slot ' + slotNum, 'warning'); return; }
        // Decompress to JSON for portability
        let jsonStr = raw;
        if (typeof LZString !== 'undefined') {
            const decompressed = LZString.decompressFromUTF16(raw);
            if (decompressed) jsonStr = decompressed;
        }
        // Validate it's parseable
        try { JSON.parse(jsonStr); } catch(e) { jsonStr = raw; }
        const meta = getSlotMeta(slotNum);
        const safeName = (meta && meta.playerName ? meta.playerName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Unknown');
        const day = meta ? meta.day : 0;
        const filename = 'MerchantRealms_' + safeName + '_Day' + day + '_Slot' + slotNum + '.json';
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        UI.toast('Downloaded ' + filename, 'success');
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
                    // Basic validation — must have engine or player data
                    if (!data.engine && !data.player) {
                        UI.toast('Invalid save file — missing game data', 'danger');
                        return;
                    }
                    // Compress and store
                    let saveStr = jsonStr;
                    if (typeof LZString !== 'undefined') {
                        saveStr = LZString.compressToUTF16(jsonStr);
                    }
                    localStorage.setItem(SAVE_SLOT_PREFIX + slotNum, saveStr);
                    // Store metadata for fast slot picker
                    try {
                        localStorage.setItem(SAVE_SLOT_PREFIX + slotNum + '_meta', JSON.stringify({
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
                    lastUsedSlot = slotNum;
                    localStorage.setItem('merchantRealms_lastSlot', String(slotNum));
                    UI.toast('Imported save to Slot ' + slotNum + '!', 'success');
                    UI.closeModal();
                    showLoadSlotPicker();
                } catch (err) {
                    UI.toast('Failed to import: ' + (err.message || 'Invalid file'), 'danger');
                }
            };
            reader.readAsText(file);
        };
        input.click();
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
                html += '<div class="' + slotClass + '" data-slot="' + i + '">' +
                    '<div class="save-slot-left">' +
                    '<div class="save-slot-info">' +
                    '<span class="save-slot-num">[' + i + ']</span>' +
                    '<span class="save-slot-name">' + meta.playerName + '</span>' +
                    '</div>' +
                    '<div class="save-slot-details">' +
                    'Day ' + meta.day + ' — ' + meta.season + ', Year ' + meta.year +
                    '</div>' +
                    '<div class="save-slot-meta">' +
                    '🪙 ' + Math.floor(meta.gold).toLocaleString() + '  •  ' + dateStr +
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
                    html += '<div class="save-slot-row" data-autosave-slot="' + _asl.label + '" style="cursor:pointer;border-left:3px solid rgba(100,180,100,0.5);">' +
                        '<div class="save-slot-left">' +
                        '<div class="save-slot-info">' +
                        '<span class="save-slot-num" style="color:#8c8;">[Auto ' + _asl.label + ']</span>' +
                        '<span class="save-slot-name">' + _asl.meta.playerName + '</span>' +
                        '</div>' +
                        '<div class="save-slot-details">' +
                        'Day ' + _asl.meta.day + ' — ' + _asl.meta.season + ', Year ' + _asl.meta.year +
                        '</div>' +
                        '<div class="save-slot-meta">' +
                        '🪙 ' + Math.floor(_asl.meta.gold).toLocaleString() + '  •  ' + _aDateStr +
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
                    if (getSlotData(slot)) {
                        UI.closeModal();
                        loadFromSlot(slot);
                    }
                });
            });
            // Also allow clicking empty slots for import
            document.querySelectorAll('.save-slot-row.save-slot-disabled').forEach(function (row) {
                row.addEventListener('click', function (e) {
                    if (e.target.dataset.importSlot) return;
                    // Clicking empty slot itself does nothing (only import button works)
                });
            });
            document.querySelectorAll('[data-delete-slot]').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const slot = parseInt(this.dataset.deleteSlot);
                    const meta = getSlotMeta(slot);
                    if (meta && confirm('Delete save in Slot ' + slot + '?\n"' + meta.playerName + ' — Day ' + meta.day + '"')) {
                        localStorage.removeItem(SAVE_SLOT_PREFIX + slot);
                        localStorage.removeItem(SAVE_SLOT_PREFIX + slot + '_meta');
                        if (lastUsedSlot === slot) {
                            lastUsedSlot = 0;
                            localStorage.setItem('merchantRealms_lastSlot', '0');
                        }
                        UI.closeModal();
                        showLoadSlotPicker();
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
            _compressAndStore(SAVE_SLOT_PREFIX + slotNum, data);
            lastUsedSlot = slotNum;
            localStorage.setItem('merchantRealms_lastSlot', String(slotNum));
            if (typeof UI !== 'undefined') UI.toast('Saved to Slot ' + slotNum + '!', 'success');
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

    function loadFromSlot(slotNum) {
        try {
            const data = getSlotData(slotNum);
            if (!data) {
                if (typeof UI !== 'undefined') UI.toast('No save in Slot ' + slotNum + '.', 'warning');
                return;
            }

            // Clean up tutorial if it was running (prevents panel leaking into loaded game)
            if (typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.isActive()) {
                try { Tutorial.cleanup(); } catch(e) {}
            }
            // Also destroy leftover tutorial panel even if Tutorial.isActive is false
            var tutPanel = document.getElementById('tutorialPanel');
            if (tutPanel) tutPanel.remove();

            // Clear all tutorial window flags from a prior session
            delete window._tutorialMinimapClicked;
            delete window._tutorialLocateUsed;
            delete window._tutorialAteFood;
            delete window._tutorialDrankWater;
            delete window._tutorialSocialInteracted;
            delete window._tutorialSmallTalkDone;
            delete window._tutorialRested;

            // Clear any stale tutorial/story highlight classes from tab buttons
            document.querySelectorAll('.tab-btn.tutorial-highlight').forEach(function(t) { t.classList.remove('tutorial-highlight'); });
            document.querySelectorAll('.tab-btn.active').forEach(function(t) { t.classList.remove('active'); });
            document.querySelectorAll('.sub-menu-btn.tutorial-highlight').forEach(function(t) { t.classList.remove('tutorial-highlight'); });

            // Close any open modal from previous game
            if (typeof UI !== 'undefined' && UI.closeModal) {
                try { UI.closeModal(); } catch(e) {}
            }
            // Close story dialog overlay if open
            if (typeof UI !== 'undefined' && UI.closeStoryDialog) {
                try { UI.closeStoryDialog(); } catch(e) {}
            }
            // Stop TTS
            if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();

            // Run save migrations before deserializing
            _migrateSaveData(data);

            // Restore engine state
            if (data.engine && Engine.deserialize) {
                Engine.deserialize(data.engine);
            }

            // Restore player state
            if (data.player && Player.deserialize) {
                Player.deserialize(data.player);
            }

            // Restore AI merchants
            if (data.aiMerchants && Player.deserializeAI) {
                Player.deserializeAI(data.aiMerchants);
            }

            // Hide title screen and char creation
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
            // Hide kingdom select screen if open
            var kingdomScreen = document.getElementById('kingdomSelectScreen');
            if (kingdomScreen) { kingdomScreen.classList.add('hidden'); kingdomScreen.style.display = 'none'; }

            // Reset story mode if loaded save isn't a story save
            if (typeof StoryMode !== 'undefined' && StoryMode.isActive && StoryMode.isActive()) {
                var _loadedP = Player.state;
                if (!_loadedP || !_loadedP.storyMode || !_loadedP.storyMode.active) {
                    // Loaded a non-story save but StoryMode was active from a previous session
                    StoryMode.deserialize({ active: false, chapter: 0, complete: false });
                }
            }
            // Hide story tracker if not in story mode
            if (typeof UI !== 'undefined' && UI.hideStoryTracker) {
                var _lp = Player.state;
                if (!_lp || !_lp.storyMode || !_lp.storyMode.active) {
                    UI.hideStoryTracker();
                }
            }

            // Re-init renderer with loaded world
            const canvas = document.getElementById('gameCanvas');
            const world = Engine.getWorld ? Engine.getWorld() : {};
            Renderer.init(canvas, world);

            // Initialize UI
            UI.init();
            UI.showGameUI();

            // Immediately refresh UI with loaded data (before game loop starts)
            try { UI.update(); } catch (e) { console.error('UI update after load:', e); }

            // Setup input handlers
            setupInput();

            // Start game loop
            state = 'playing';
            speed = 1;
            lastTickTime = performance.now();
            tickAccumulator = 0;
            tickCounter = 0;
            lastFrameTime = performance.now();

            // Reset event counter to avoid re-toasting old events
            const events = Engine.getEvents ? Engine.getEvents() : [];
            lastProcessedEventCount = events ? events.length : 0;

            if (!animFrameId) {
                loop(performance.now());
            }

            // Start game music on load
            if (typeof Music !== 'undefined') Music.playGameMusic('peaceful');

            // Start autosave timer
            startAutosave();

            lastUsedSlot = slotNum;
            localStorage.setItem('merchantRealms_lastSlot', String(slotNum));

            UI.toast('Loaded Slot ' + slotNum + '!', 'success');
        } catch (e) {
            console.error('Load failed:', e);
            if (typeof UI !== 'undefined') UI.toast('Load failed: ' + (e.message || 'Unknown error'), 'danger');
        }
    }

    function loadGame() {
        // Called from title screen "Load Game" button — show slot picker
        showLoadSlotPicker();
    }

    function hasSave() {
        for (let i = 1; i <= NUM_SAVE_SLOTS; i++) {
            if (localStorage.getItem(SAVE_SLOT_PREFIX + i)) return true;
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

            // 2. Current save data (from last used slot or generate fresh)
            var saveData = null;
            if (lastUsedSlot > 0) {
                var raw = localStorage.getItem(SAVE_SLOT_PREFIX + lastUsedSlot);
                if (raw) {
                    try {
                        var decompressed = (typeof LZString !== 'undefined') ? LZString.decompressFromUTF16(raw) : raw;
                        saveData = JSON.parse(decompressed || raw);
                    } catch(e) { saveData = { raw: raw.substring(0, 1000) + '...(truncated)' }; }
                }
            }
            // If no slot save, serialize current state
            if (!saveData && state === 'playing') {
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
                gameVersion: 'v0.84.1',
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
            lastProcessedEventCount = _slEvents ? _slEvents.length : 0;
            if (!animFrameId) {
                loop(performance.now());
            }
            startAutosave();
        },
        showTitleScreen: function () {
            console.log('[Menu] showTitleScreen v2 called, clearing game state');
            // CRITICAL: Clear these first before anything can throw
            state = 'title';
            delete window._selectedStartConfig;
            if (typeof StoryMode !== 'undefined' && StoryMode.deserialize) {
                try { StoryMode.deserialize({ active: false, chapter: 0, complete: false }); } catch(e) {}
            }
            try { stopAutosave(); } catch(e) {}
            if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
            // Clean up tutorial if it was running
            try {
                if (typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.isActive()) {
                    Tutorial.cleanup();
                }
            } catch(e) {}
            // Close story dialog if open
            try { if (typeof UI !== 'undefined' && UI.closeStoryDialog) UI.closeStoryDialog(); } catch(e) {}
            // Stop TTS
            try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch(e) {}
            try { if (typeof UI !== 'undefined' && UI.hideGameUI) UI.hideGameUI(); } catch(e) {}
            var ts = document.getElementById('titleScreen');
            if (ts) { ts.classList.remove('hidden'); ts.style.display = 'flex'; }
            var cs = document.getElementById('charCreateScreen');
            if (cs) { cs.classList.add('hidden'); cs.style.display = 'none'; }
            var gms = document.getElementById('gameModeScreen');
            if (gms) { gms.style.display = 'none'; }
            var kss = document.getElementById('kingdomSelectScreen');
            if (kss) { kss.classList.add('hidden'); kss.style.display = 'none'; }
            // Close any open modals
            var mo = document.getElementById('modalOverlay');
            if (mo) mo.classList.add('hidden');
            // Refresh load button visibility
            var btnLoad = document.getElementById('btnLoadGame');
            if (btnLoad) btnLoad.style.display = '';
            // Switch back to title music
            try { if (typeof Music !== 'undefined') Music.playTitleMusic(); } catch(e) {}
        },
    };
})();

// ── Auto-initialize on DOM ready ──
document.addEventListener('DOMContentLoaded', function () {
    Game.init();
});
