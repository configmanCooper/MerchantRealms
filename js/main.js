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

    // ── Town hover hint ──
    let townHoverHintCount = parseInt(localStorage.getItem('mr_townHoverHints') || '0', 10);
    const TOWN_HOVER_HINT_MAX = 10;

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
                startTitleMusic();
                showCharacterCreation();
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
            });
        }
        var volSlider = document.getElementById('musicVolume');
        if (volSlider) {
            volSlider.addEventListener('input', function (e) {
                if (typeof Music === 'undefined') return;
                Music.init();
                Music.setVolume(e.target.value / 100);
            });
        }
    }

    // ── Music mood detection (called from game tick) ──
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

            const playerFirstName = (firstNameInput && firstNameInput.value.trim()) || 'Unknown';
            const playerLastName = (lastNameInput && lastNameInput.value.trim()) || 'Merchant';
            const playerSex = sexRadio ? sexRadio.value : 'M';

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

            // Show kingdom/town selection screen
            // After player picks a town, finalize game start
            UI.init(); // init UI so modal system works

            UI.showKingdomSelection(function (selectedTownId) {
                try {
                    // Initialize player with character info and selected town
                    if (typeof Player !== 'undefined' && Player.init) {
                        const world = Engine.getWorld ? Engine.getWorld() : {};
                        const startConfig = window._selectedStartConfig || CONFIG.GAME_STARTS.find(s => s.id === 'normal') || null;
                        Player.init(world, playerFirstName, playerLastName, playerSex, selectedTownId, startConfig);
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
                    lastProcessedEventCount = 0;

                    if (!animFrameId) {
                        loop(performance.now());
                    }

                    // Start game music
                    if (typeof Music !== 'undefined') Music.playGameMusic('peaceful');

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
        if (!_skipRender) {
            try {
                const world = (typeof Engine !== 'undefined' && Engine.getWorld) ? Engine.getWorld() : null;
                const player = (typeof Player !== 'undefined') ? Player : null;
                Renderer.render(world, player);
            } catch (e) {
                console.error('Render error:', e);
            }

            // UI update (throttled — every ~6 frames)
            if (Renderer.getFrameCount() % 6 === 0) {
                try { UI.update(); } catch (e) { console.error('UI update error:', e); }
                try { if (UI.updateTravelPanel) UI.updateTravelPanel(); } catch (e) { /* no-op */ }
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

            // Engine.tick() advances one full day, so only call it every TICKS_PER_DAY sim ticks
            if (tickCounter >= CONFIG.TICKS_PER_DAY) {
                tickCounter = 0;

                // Advance world simulation
                if (typeof Engine !== 'undefined' && Engine.tick) {
                    Engine.tick();
                }

                // Advance player
                if (typeof Player !== 'undefined' && Player.tick) {
                    Player.tick();
                }

                // Check win/lose conditions
                checkEndConditions();

                // Update music mood based on game state
                updateMusicMood();
            }

            // Process events for notifications
            processEvents();

            emit('tick', { day: Engine.getDay ? Engine.getDay() : 0 });

        } catch (e) {
            console.error('Tick error:', e);
        }
    }

    function advanceTicks(count) {
        if (count <= 0) return;
        for (let i = 0; i < count; i++) {
            gameTick();
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

            // Only process new events
            if (events.length > lastProcessedEventCount) {
                const newEvents = events.slice(lastProcessedEventCount);
                for (const event of newEvents) {
                    // Handle war allegiance popup
                    if (event.type === 'warDeclared') {
                        if (typeof Player !== 'undefined' && Player.shouldShowWarAllegiancePopup && Player.shouldShowWarAllegiancePopup(event)) {
                            if (typeof UI !== 'undefined' && UI.showWarAllegiancePopup) {
                                UI.showWarAllegiancePopup(event);
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
                        UI.toast(msg, toastType);
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
        speed = s;
        if (s === 0) {
            state = 'paused';
        } else if (state === 'paused') {
            state = 'playing';
        }
        emit('speedChanged', { speed: s });
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

    function onTouchStart(e) {
        e.preventDefault();
        if (typeof Renderer !== 'undefined' && Renderer.getMapMode() === 2) return;
        if (e.touches.length === 1) {
            touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
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
            Renderer.pan(-dx, -dy);
            touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2 && touchStartDist) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const delta = touchStartDist - dist;
            Renderer.zoomAt(delta, (e.touches[0].clientX + e.touches[1].clientX) / 2,
                (e.touches[0].clientY + e.touches[1].clientY) / 2);
            touchStartDist = dist;
        }
    }

    function onTouchEnd() {
        touchStartPos = null;
        touchStartDist = null;
    }

    function onMinimapClick(e) {
        Renderer.minimapClick(e.clientX, e.clientY);
    }

    function onKeyDown(e) {
        input.keys[e.key] = true;

        // Skip if typing in input/select
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

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

        if (hit.type === 'town' && hit.data) {
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
            UI.showTooltip(sx, sy, `${p.firstName || ''} ${p.lastName || ''}\n${(p.occupation || 'Unemployed')}`);
            document.getElementById('gameCanvas').style.cursor = 'pointer';
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
                items.push({ icon: '🗺️', label: 'Travel Here...', action: `UI.openTravelOptions('${town.id}')` });
                items.push({ icon: '🐴', label: 'Send Caravan', action: `UI.openCaravanDialog()` });
            } else {
                items.push({ icon: '📊', label: 'Trade', action: 'UI.openTradeDialog()' });
                items.push({ icon: '🏗️', label: 'Build', action: 'UI.openBuildDialog()' });
                items.push({ icon: '👥', label: 'Hire Workers', action: 'UI.openHireDialog()' });
            }
        } else if (hit.type === 'person') {
            const p = hit.data;
            items.push({ icon: '👁', label: 'View Details', action: `UI.showPersonDetail(Engine.getPerson('${p.id}'))` });
            if (!p.occupation || p.occupation === 'none') {
                items.push({ icon: '👥', label: 'Hire', action: `UI.hirePerson('${p.id}')` });
            }
        } else if (hit.type === 'road') {
            items.push({ icon: '👁', label: 'View Road Info', action: 'void(0)' });
        } else {
            items.push({ icon: '🗺️', label: 'Map Overview', action: 'UI.openMapView()' });
            // Free travel: "Travel Here" when right-clicking empty map (works while traveling too)
            if (typeof Player !== 'undefined') {
                var worldCoords = Renderer.screenToWorld(x, y);
                if (worldCoords) {
                    var terrain = Engine.getTerrainAtPixel(worldCoords.x, worldCoords.y);
                    if (terrain !== 2 && terrain !== 3) { // Not water or mountains
                        items.push({
                            icon: '🥾',
                            label: Player.traveling ? 'Go Off-road Here (Leave Route)' : 'Travel Here (Off-road)',
                            action: 'UI.confirmFreeTravel(' + worldCoords.x + ',' + worldCoords.y + ')'
                        });
                    }
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

    function migrateOldSave() {
        const old = localStorage.getItem(OLD_SAVE_KEY);
        if (old && !localStorage.getItem(SAVE_SLOT_PREFIX + '1')) {
            try {
                const data = JSON.parse(old);
                // Add metadata for slot display
                data.playerName = (data.player && data.player.fullName) || 'Unknown Merchant';
                data.day = (data.engine && data.engine.day) || 0;
                const dayNum = data.day || 0;
                const seasonIdx = Math.floor((dayNum % (CONFIG.DAYS_PER_SEASON * 4)) / CONFIG.DAYS_PER_SEASON);
                data.season = CONFIG.SEASONS[seasonIdx] || 'Spring';
                data.year = Math.floor(dayNum / (CONFIG.DAYS_PER_SEASON * 4)) + 1;
                data.kingdom = '';
                data.rank = '';
                data.gold = (data.player && data.player.gold) || 0;
                const jsonStr = JSON.stringify(data);
                let saveStr = jsonStr;
                if (typeof LZString !== 'undefined') {
                    saveStr = LZString.compressToUTF16(jsonStr);
                }
                localStorage.setItem(SAVE_SLOT_PREFIX + '1', saveStr);
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
                    '<div class="save-slot-actions">' +
                    '<button class="save-slot-download btn-medieval" data-download-slot="' + i + '" title="Download Save">📤 Download</button>' +
                    (isLoad ? '<button class="save-slot-import btn-medieval" data-import-slot="' + i + '" title="Import Save File">📥 Import</button>' : '') +
                    (isLoad ? '<button class="save-slot-delete btn-medieval" data-delete-slot="' + i + '" title="Delete Save">🗑️</button>' : '') +
                    '</div>' +
                    '</div>';
            }
        }
        html += '</div>';
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
        }, 50);
    }

    function showLoadSlotPicker() {
        const { title, html } = buildSlotPickerHTML('load');
        UI.openModal(title, html, '');
        setTimeout(function () {
            document.querySelectorAll('.save-slot-row:not(.save-slot-disabled)').forEach(function (row) {
                row.addEventListener('click', function (e) {
                    if (e.target.dataset.deleteSlot || e.target.dataset.downloadSlot || e.target.dataset.importSlot) return;
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
        }, 50);
    }

    function saveToSlot(slotNum) {
        try {
            const engineData = Engine.serialize ? Engine.serialize() : null;
            const playerData = Player.serialize ? Player.serialize() : null;
            const dayNum = Engine.getDay ? Engine.getDay() : 0;
            const seasonIdx = Math.floor((dayNum % (CONFIG.DAYS_PER_SEASON * 4)) / CONFIG.DAYS_PER_SEASON);
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
            const data = {
                playerName: Player.fullName || 'Unknown',
                day: dayNum,
                season: CONFIG.SEASONS[seasonIdx] || 'Spring',
                year: Math.floor(dayNum / (CONFIG.DAYS_PER_SEASON * 4)) + 1,
                kingdom: kingdomName,
                rank: rankName,
                gold: Player.gold || 0,
                savedAt: Date.now(),
                version: 3,
                engine: engineData,
                player: playerData,
                aiMerchants: Player.serializeAI ? Player.serializeAI() : null,
            };
            const jsonStr = JSON.stringify(data);
            // Compress save data to fit more in localStorage's 5MB limit
            let saveStr = jsonStr;
            if (typeof LZString !== 'undefined') {
                saveStr = LZString.compressToUTF16(jsonStr);
                const ratio = Math.round((1 - saveStr.length / jsonStr.length) * 100);
                console.log('[Save] Compressed ' + (jsonStr.length / 1024).toFixed(0) + 'KB → ' + (saveStr.length / 1024).toFixed(0) + 'KB (' + ratio + '% smaller)');
            }
            localStorage.setItem(SAVE_SLOT_PREFIX + slotNum, saveStr);
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
        // Quick save: if we have a last used slot, save there directly
        if (lastUsedSlot > 0) {
            saveToSlot(lastUsedSlot);
        } else {
            showSaveSlotPicker();
        }
    }

    function loadFromSlot(slotNum) {
        try {
            const data = getSlotData(slotNum);
            if (!data) {
                if (typeof UI !== 'undefined') UI.toast('No save in Slot ' + slotNum + '.', 'warning');
                return;
            }

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
            if (titleScreen) {
                titleScreen.classList.add('hidden');
                titleScreen.style.display = 'none';
            }
            if (charCreateScreen) {
                charCreateScreen.classList.add('hidden');
                charCreateScreen.style.display = 'none';
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
            _godModeBufferTimeout = setTimeout(function() { _godModeBuffer = ''; }, 3000);
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
        advanceTicks,
        isGodMode,
        setupInput: setupInput,
        startLoop: function() {
            lastTickTime = performance.now();
            tickAccumulator = 0;
            tickCounter = 0;
            lastFrameTime = performance.now();
            lastProcessedEventCount = 0;
            if (!animFrameId) {
                loop(performance.now());
            }
        },
        showTitleScreen: function () {
            state = 'title';
            if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
            // Clean up tutorial if it was running
            if (typeof Tutorial !== 'undefined' && Tutorial.isActive && Tutorial.isActive()) {
                Tutorial.cleanup();
            }
            if (typeof UI !== 'undefined' && UI.hideGameUI) UI.hideGameUI();
            var ts = document.getElementById('titleScreen');
            if (ts) { ts.classList.remove('hidden'); ts.style.display = 'flex'; }
            var cs = document.getElementById('charCreateScreen');
            if (cs) { cs.classList.add('hidden'); cs.style.display = 'none'; }
            // Refresh load button visibility
            var btnLoad = document.getElementById('btnLoadGame');
            if (btnLoad) btnLoad.style.display = '';
            // Switch back to title music
            if (typeof Music !== 'undefined') Music.playTitleMusic();
        },
    };
})();

// ── Auto-initialize on DOM ready ──
document.addEventListener('DOMContentLoaded', function () {
    Game.init();
});
