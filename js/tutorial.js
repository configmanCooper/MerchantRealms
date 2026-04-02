// ============================================================
// Merchant Realms — Interactive Tutorial System (14 Chapters)
// ============================================================

window.Tutorial = (function () {
    'use strict';

    var active = false;
    var currentChapter = 0;
    var currentStep = 0;
    var panelEl = null;
    var highlightedEls = [];
    var completedSteps = {}; // Track completed interactive steps: "chapter:step" → true

    // Polling / waitFor state
    var pollInterval = null;
    var skipTimeout = null;
    var doneTimeout = null;
    var doneAdvanceFn = null;
    var modalObserver = null;
    var snapshotState = {};
    var waitingClickCount = 0;

    // ═══════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════

    function isModalOpen() {
        var overlay = document.getElementById('modalOverlay');
        return overlay && !overlay.classList.contains('hidden');
    }

    function isModalClosed() {
        return !isModalOpen();
    }

    function closeModal() {
        var overlay = document.getElementById('modalOverlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
        }
    }

    function getPlayerGold() {
        try { return Player.state.gold || 0; } catch (e) { return 0; }
    }

    function getPlayerInventory() {
        try { return Player.state.inventory || {}; } catch (e) { return {}; }
    }

    function getPlayerBuildings() {
        try {
            // Player buildings are in Player.state.buildings (pushed by buildBuilding)
            // and also in town.buildings with ownerId === 'player'
            var buildings = Player.state.buildings || [];
            if (buildings.length > 0) return buildings;
            // Fallback: check town buildings for player ownership
            var town = Engine.findTown(Player.state.townId);
            if (town && town.buildings) {
                return town.buildings.filter(function(b) { return b.ownerId === 'player'; });
            }
            return [];
        } catch (e) { return []; }
    }

    function getPlayerEmployees() {
        try { return Player.state.employees || []; } catch (e) { return []; }
    }

    function getPlayerSkills() {
        try { return Player.state.skills || {}; } catch (e) { return {}; }
    }

    function getPlayerSkillCount() {
        try {
            var s = Player.state.skills || {};
            return Object.keys(s).length;
        } catch (e) { return 0; }
    }

    function clickButton(id) {
        var btn = document.getElementById(id);
        if (btn) btn.click();
    }

    function btnExists(id) {
        return !!document.getElementById(id);
    }

    // ═══════════════════════════════════════════════════════════
    //  CHEATS (tutorial aids only)
    // ═══════════════════════════════════════════════════════════

    function giveGold(amount) {
        if (!active) return;
        try {
            Player.state.gold = (Player.state.gold || 0) + (amount || 0);
            if (typeof UI !== 'undefined' && UI.update) UI.update();
        } catch (e) { console.error('Tutorial cheat giveGold error:', e); }
    }

    function giveSkillPoints(amount) {
        if (!active) return;
        try {
            Player.state.skillPoints = (Player.state.skillPoints || 0) + (amount || 0);
            if (typeof UI !== 'undefined' && UI.update) UI.update();
        } catch (e) { console.error('Tutorial cheat giveSP error:', e); }
    }

    function giveItem(resourceId, qty) {
        if (!active) return;
        try {
            if (!Player.state.inventory) Player.state.inventory = {};
            Player.state.inventory[resourceId] = (Player.state.inventory[resourceId] || 0) + (qty || 0);
            if (typeof UI !== 'undefined' && UI.update) UI.update();
        } catch (e) { console.error('Tutorial cheat giveItem error:', e); }
    }

    // ═══════════════════════════════════════════════════════════
    //  POLLING / WAITFOR SYSTEM
    // ═══════════════════════════════════════════════════════════

    function startWatching(conditionFn, onComplete) {
        stopWatching();
        waitingClickCount = 0;

        // If this step was already completed, show Done immediately
        var stepKey = currentChapter + ':' + currentStep;
        if (completedSteps[stepKey]) {
            doneAdvanceFn = onComplete || function () { nextStep(); };
            var btn = document.getElementById('tutBtnNext');
            if (btn) {
                btn.textContent = '\u2705 Completed \u2014 Continue \u2192';
                btn.disabled = false;
                btn.dataset.waiting = 'false';
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.style.background = 'linear-gradient(135deg, #2d5a1d, #3a7a24)';
                btn.style.borderColor = '#5aad35';
            }
            return;
        }

        // Show waiting state
        updateNextButton('\u23F3 Complete the action above...', true);

        // Get step's custom skip delay or use default (20s)
        var step = chapters[currentChapter] && chapters[currentChapter].steps[currentStep];
        var skipDelay = (step && step.skipAfter) ? step.skipAfter : 20000;

        pollInterval = setInterval(function () {
            try {
                if (conditionFn()) {
                    stopWatching();
                    // Clear highlights (removes glow + un-greys bottom bar buttons)
                    clearHighlights();
                    // Mark step as completed
                    completedSteps[currentChapter + ':' + currentStep] = true;
                    // Show Done as clickable button with green highlight
                    doneAdvanceFn = onComplete || function () { nextStep(); };
                    var btn = document.getElementById('tutBtnNext');
                    if (btn) {
                        btn.textContent = '\u2705 Done! Continue \u2192';
                        btn.disabled = false;
                        btn.dataset.waiting = 'false';
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                        btn.style.background = 'linear-gradient(135deg, #2d5a1d, #3a7a24)';
                        btn.style.borderColor = '#5aad35';
                    }
                    // Player must click Done to continue (no auto-advance)
                }
            } catch (e) {
                console.error('Tutorial poll error:', e);
            }
        }, 500);

        // Show skip option after delay
        skipTimeout = setTimeout(function () {
            updateNextButton('Skip this step \u2192', false);
        }, skipDelay);
    }

    function stopWatching() {
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
        if (skipTimeout) { clearTimeout(skipTimeout); skipTimeout = null; }
        if (doneTimeout) { clearTimeout(doneTimeout); doneTimeout = null; }
        doneAdvanceFn = null;
        // Clean up marriage propose glow timer
        if (snapshotState._proposeGlowTimer) { clearInterval(snapshotState._proposeGlowTimer); snapshotState._proposeGlowTimer = null; }
        var propBtn = document.getElementById('btnPropose');
        if (propBtn) propBtn.classList.remove('tutorial-highlight');
    }

    function updateNextButton(label, isWaiting) {
        var btn = document.getElementById('tutBtnNext');
        if (!btn) return;
        btn.textContent = label;
        btn.disabled = false;
        btn.dataset.waiting = isWaiting ? 'true' : 'false';
        if (isWaiting) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  CHAPTERS & STEPS
    // ═══════════════════════════════════════════════════════════


    var chapters = [

        // ═══════════════════════════════════════════════════════
        //  PART 1: BASICS
        // ═══════════════════════════════════════════════════════

        // ── Chapter 1: Welcome & Controls ─────────────────────
        {
            title: 'Welcome & Controls',
            part: 'basic',
            steps: [
                {
                    title: 'Welcome',
                    text: '\uD83C\uDFF0 Welcome, merchant! <strong>Merchant Realms</strong> is about trading goods, building an empire, climbing social ranks, and founding a dynasty. <strong>This panel is moveable</strong> \u2014 drag it by the header to reposition. You can leave any time via the \uD83C\uDFE0 <strong>Main Menu</strong> button on the bottom panel.',
                    highlight: '#btnMainMenu'
                },
                {
                    title: 'Camera & Map',
                    text: '\uD83C\uDFA5 <strong>Pan</strong> the map with <strong>W/A/S/D</strong> or <strong>arrow keys</strong>. <strong>Zoom</strong> with the <strong>scroll wheel</strong> (0.5x\u20134x). Click any <strong>town</strong> on the map to inspect it.',
                    highlight: '#gameCanvas'
                },
                {
                    title: 'Your Player Icon',
                    text: '\uD83D\uDD36 See that <strong>golden pulsing diamond</strong>? That\u2019s <strong>you</strong>! If you ever lose track of yourself, click the <strong>\uD83D\uDCCD Find</strong> button on the bottom panel. Try it now \u2014 pan away with W/A/S/D, then click <strong>\uD83D\uDCCD Find</strong>!',
                    highlight: '#btnLocate',
                    onEnter: function () {
                        // Zoom to 3x and center on player
                        try {
                            if (Renderer.setZoom) Renderer.setZoom(3.0);
                            if (Renderer.centerOnTown && Player.state.townId) Renderer.centerOnTown(Player.state.townId);
                        } catch (e) {}
                    },
                    waitFor: function () {
                        if (window._tutorialLocateUsed) return true;
                        var toasts = document.querySelectorAll('.toast');
                        for (var i = 0; i < toasts.length; i++) {
                            if (toasts[i].textContent.indexOf('Centered on your location') >= 0) return true;
                        }
                        return false;
                    },
                    skipAfter: 6000
                },
                {
                    title: 'Minimap',
                    text: '\uD83D\uDDFA\uFE0F Great! Notice the <strong>blinking dot</strong> on the minimap in the bottom-right \u2014 that\u2019s your position! Try <strong>clicking the minimap</strong> to move the camera to a different area of the map. It\u2019s a quick way to jump around the world!',
                    onEnter: function () {
                        try {
                            var cam = Renderer.getCamera();
                            snapshotState.cameraX = cam.x;
                            snapshotState.cameraY = cam.y;
                        } catch (e) {}
                    },
                    waitFor: function () {
                        if (window._tutorialMinimapClicked) return true;
                        try {
                            var cam = Renderer.getCamera();
                            var dx = Math.abs(cam.x - (snapshotState.cameraX || 0));
                            var dy = Math.abs(cam.y - (snapshotState.cameraY || 0));
                            return (dx > 50 || dy > 50);
                        } catch (e) { return false; }
                    },
                    skipAfter: 8000
                },
                {
                    title: 'Speed Controls',
                    text: '\u23E9 Press <strong>1\u20135</strong> or click the speed buttons to change game speed. <strong>Spacebar</strong> is a shortcut for pause. Try pressing <strong>2</strong> now!',
                    highlight: '.speed-controls',
                    waitFor: function () {
                        return typeof Game !== 'undefined' && Game.getSpeed && Game.getSpeed() > 1;
                    },
                    onComplete: function () {
                        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(1);
                        nextStep();
                    }
                },
                {
                    title: 'Meeting Townsfolk',
                    text: '\uD83D\uDC65 The <strong>colored dots</strong> moving around a town are <strong>NPCs</strong> \u2014 real people living and working there! <strong>Zoom in</strong> past 1.5x to see them clearly. Click an NPC and say <strong>Small Talk</strong> to them! <strong>Tip:</strong> If an NPC is in the center of town, hold <strong>Shift + Click</strong> to select the person instead of the town.',
                    highlight: '#gameCanvas',
                    waitFor: function () {
                        var modal = document.getElementById('modalOverlay');
                        if (modal && !modal.classList.contains('hidden')) {
                            var title = document.getElementById('modalTitle');
                            if (title && (title.textContent.indexOf('Conversation') >= 0 || title.textContent.indexOf('small_talk') >= 0)) return true;
                        }
                        var rp = document.getElementById('rightPanel');
                        if (rp && !rp.classList.contains('hidden')) {
                            var rpTitle = document.getElementById('rightPanelTitle');
                            if (rpTitle && rpTitle.textContent.indexOf('\uD83D\uDC64') >= 0) return true;
                        }
                        return false;
                    },
                    skipAfter: 8000
                },
                {
                    title: 'The Talk Button',
                    text: '\uD83D\uDCAC The <strong>\uD83D\uDCAC Talk</strong> button on the bottom panel lets you talk to random locals and get information. Use it to hear rumors about prices, wars, or trade tips around town.',
                    highlight: '#btnTalk'
                },
                {
                    title: 'Town Info & People',
                    text: '\uD83C\uDFD8\uFE0F Click on <strong>Rustbridge</strong> on the map to see its details \u2014 population, market prices, buildings, and townspeople.',
                    highlight: '#gameCanvas',
                    onEnter: function () {
                        // Pan to Rustbridge (starting town) and zoom to 2x
                        try {
                            if (Renderer.setZoom) Renderer.setZoom(2.0);
                            var towns = Engine.getTowns();
                            var rustbridge = towns.find(function(t) { return t.name === 'Rustbridge'; }) || towns[0];
                            if (rustbridge && Renderer.panTo) Renderer.panTo(rustbridge.x, rustbridge.y);
                        } catch (e) {}
                    },
                    waitFor: function () {
                        var rp = document.getElementById('rightPanel');
                        if (rp && !rp.classList.contains('hidden')) {
                            var rpTitle = document.getElementById('rightPanelTitle');
                            if (rpTitle) {
                                var t = rpTitle.textContent;
                                if (t.indexOf('Rustbridge') >= 0 || t.indexOf('\uD83C\uDFD8') >= 0 || t.indexOf('Town') >= 0) return true;
                            }
                        }
                        return false;
                    },
                    skipAfter: 6000
                },
                {
                    title: 'Saving Your Game',
                    text: '\uD83D\uDCBE <strong>Save/Load</strong> from the menu at any time. You have <strong>5 save slots</strong> with <strong>Download</strong> (\u2B07\uFE0F) and <strong>Import</strong> (\uD83D\uDCC2) buttons so your progress is safe even if browser data is cleared. Try saving now!',
                    highlight: '#btnSave',
                    onEnter: function () {
                        snapshotState.saveTimestamps = {};
                        for (var i = 1; i <= 5; i++) {
                            var raw = localStorage.getItem('merchantRealms_slot_' + i);
                            if (raw) {
                                try {
                                    var decompressed = raw;
                                    if (typeof LZString !== 'undefined') {
                                        var attempt = LZString.decompressFromUTF16(raw);
                                        if (attempt) decompressed = attempt;
                                    }
                                    var parsed = JSON.parse(decompressed);
                                    snapshotState.saveTimestamps[i] = parsed.savedAt || 0;
                                } catch (e) {
                                    snapshotState.saveTimestamps[i] = -1;
                                }
                            }
                        }
                    },
                    waitFor: function () {
                        for (var i = 1; i <= 5; i++) {
                            var raw = localStorage.getItem('merchantRealms_slot_' + i);
                            if (!raw) {
                                if (!snapshotState.saveTimestamps[i]) return true;
                                continue;
                            }
                            try {
                                var decompressed = raw;
                                if (typeof LZString !== 'undefined') {
                                    var attempt = LZString.decompressFromUTF16(raw);
                                    if (attempt) decompressed = attempt;
                                }
                                var parsed = JSON.parse(decompressed);
                                var oldTs = snapshotState.saveTimestamps[i] || 0;
                                if ((parsed.savedAt || 0) > oldTs) return true;
                            } catch (e) {}
                        }
                        return false;
                    },
                    skipAfter: 4000
                }
            ]
        },

        // ── Chapter 2: Your First Trade ───────────────────────
        {
            title: 'Your First Trade',
            part: 'basic',
            steps: [
                {
                    title: 'Open the Market',
                    text: '\uD83D\uDCB0 Time for your first trade! We\u2019ve given you <strong>300 bonus gold</strong>. Click the <strong>\uD83D\uDCCA Trade</strong> button on the bottom panel to open the market.',
                    highlight: '#btnTrade',
                    onEnter: function () {
                        giveGold(300);
                    },
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Buy Some Goods',
                    text: '\uD83C\uDF3E Prices are set by <strong>supply & demand</strong>. Find \uD83C\uDF3E <strong>Wheat</strong> and click <strong>Buy</strong>. In a real game, you\u2019d buy cheap here and sell where prices are higher!',
                    waitFor: function () {
                        var inv = getPlayerInventory();
                        return (inv.wheat || 0) > 0;
                    },
                    onComplete: function () {
                        snapshotState.wheatBought = (getPlayerInventory().wheat || 0);
                        nextStep();
                    }
                },
                {
                    title: 'Keep Shopping',
                    text: '\uD83D\uDED2 Don\u2019t close the trade menu yet! Notice the <strong>right side</strong> shows <strong>your inventory</strong> \u2014 items you own that you can sell back to the market. Browse around to see what\u2019s available.'
                },
                {
                    title: 'Sell for Profit',
                    text: '\uD83D\uDCB0 Loading market data...',
                    highlight: '#btnTrade',
                    onEnter: function () {
                        // Find a high-demand, low/zero-stock good at this market
                        var town = null;
                        try { town = Engine.findTown(Player.townId); } catch (e) {}
                        var bestRes = 'iron';
                        var bestName = 'Iron';
                        if (town && town.market) {
                            var demand = town.market.demand || {};
                            var supply = town.market.supply || {};
                            var bestScore = -1;
                            for (var resId in demand) {
                                var d = demand[resId] || 0;
                                var s = supply[resId] || 0;
                                if (d > 0 && s < d * 0.3 && d > bestScore) {
                                    bestScore = d;
                                    bestRes = resId;
                                }
                            }
                            // Pretty name from config
                            try {
                                var rt = Config.RESOURCE_TYPES;
                                for (var k in rt) {
                                    if (rt[k].id === bestRes) { bestName = rt[k].name || bestRes; break; }
                                }
                            } catch (e) { bestName = bestRes.replace(/_/g, ' '); }
                        }
                        snapshotState.sellRes = bestRes;
                        giveItem(bestRes, 10);
                        // Update step text dynamically (step object, renderPanel reads it)
                        var ch = chapters[currentChapter];
                        if (ch && ch.steps[currentStep]) {
                            ch.steps[currentStep].text = '\uD83D\uDCB0 We\u2019ve given you <strong>10 ' + bestName + '</strong> \u2014 this market has high demand but low stock, so you\u2019ll get a great price! Open the trade menu and <strong>sell your ' + bestName + '</strong>. Price colors: <span style="color:#5a5;">green</span> = good deal, <span style="color:#c44;">red</span> = bad deal, <span style="color:#ccc;">white</span> = average.';
                        }
                    },
                    waitFor: function () {
                        var inv = getPlayerInventory();
                        var res = snapshotState.sellRes || 'iron';
                        return (inv[res] || 0) === 0;
                    },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    }
                },
                {
                    title: 'Trading Tips',
                    text: '\uD83D\uDCA1 <strong>Key concepts</strong>:<br>\u2022 \uD83D\uDCC8 <strong>Arbitrage</strong> \u2014 buy where prices are low, sell where they\u2019re high. Compare prices across towns!<br>\u2022 \uD83D\uDCC5 <strong>Seasons</strong> affect crop prices \u2014 buy grain after harvest, sell in winter<br>\u2022 \uD83C\uDFDB\uFE0F <strong>Taxes & tariffs</strong> \u2014 each kingdom sets trade taxes; foreign traders may pay extra tariffs on top. Higher <strong>rank</strong> reduces your tax rate (up to 30% off!)<br>\u2022 \uD83E\uDDE0 <strong>Price Memory</strong> \u2014 you recall prices from towns visited in the last 90 days. Learn trade skills to see live prices remotely!'
                },
                {
                    title: 'Street Trading',
                    text: '\uD83E\uDD1D Click the <strong>\uD83E\uDD1D Street</strong> button on the bottom panel to trade directly with townspeople! Some items on the street aren\u2019t banned \u2014 they\u2019re just not available in the local market. Try it now!',
                    highlight: '#btnStreet',
                    waitFor: function () { return isModalOpen(); },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    },
                    skipAfter: 6000
                },
                {
                    title: 'Trade Licenses',
                    text: '\uD83D\uDCDC Some valuable goods require a <strong>Trade License</strong>. Click the <strong>\uD83D\uDC51 Kingdoms</strong> button on the bottom panel, then click <strong>\uD83D\uDCDC Buy Licenses</strong> on any kingdom card to purchase one. We\u2019ve given you <strong>200 gold</strong> for the license fee.',
                    highlight: '#btnKingdoms',
                    onEnter: function () {
                        giveGold(200);
                        // Count total licenses across all kingdoms
                        snapshotState.totalLicensesBefore = 0;
                        try {
                            var lics = Player.state.licenses || {};
                            for (var kId in lics) {
                                if (Array.isArray(lics[kId])) snapshotState.totalLicensesBefore += lics[kId].length;
                            }
                        } catch (e) {}
                    },
                    waitFor: function () {
                        try {
                            var total = 0;
                            var lics = Player.state.licenses || {};
                            for (var kId in lics) {
                                if (Array.isArray(lics[kId])) total += lics[kId].length;
                            }
                            return total > (snapshotState.totalLicensesBefore || 0);
                        } catch (e) { return false; }
                    },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    },
                    skipAfter: 10000
                }
            ]
        },

        // ── Chapter 3: Skills & Progression ───────────────────
        {
            title: 'Skills & Progression',
            part: 'basic',
            steps: [
                {
                    title: 'Why Skills Matter',
                    text: '\uD83D\uDCDA Skills are <strong>critical to success</strong> in Merchant Realms. They unlock abilities, boost earnings, and compound over time. We\u2019ve given you <strong>5 skill points</strong>. Click <strong>\uD83D\uDCDA Skills</strong> on the bottom panel to browse!',
                    highlight: '#btnSkills',
                    onEnter: function () {
                        giveSkillPoints(5);
                        snapshotState.skillCountBefore = getPlayerSkillCount();
                    },
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Buy a Skill',
                    text: '\uD83C\uDF1F <strong>Buy any skill!</strong> Try <strong>Price Memory</strong> (remember prices from visited towns), <strong>Market Scout</strong> (see nearby town prices), or <strong>Haggling</strong> (better trade prices).',
                    waitFor: function () {
                        return getPlayerSkillCount() > (snapshotState.skillCountBefore || 0);
                    },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    }
                },
                {
                    title: 'XP & Leveling',
                    text: '\uD83D\uDCC8 Earn <strong>XP</strong> from trading, jobs, and kingdom orders. There are <strong>15 levels</strong>, each granting <strong>4 SP</strong> (with <strong>6 bonus SP</strong> at level 15!). Invest in skills early \u2014 they compound your earnings over time!'
                },
                {
                    title: 'Dynasty Founder',
                    text: '\uD83D\uDC51 The <strong>Dynasty Founder</strong> skill is special \u2014 you can buy it <strong>multiple times</strong> (1 SP each). Each purchase adds 1 SP to your <strong>dynasty bank</strong>. When your character dies, your heir inherits the full bank. Plan ahead for future generations!'
                }
            ]
        },

        // ── Chapter 4: Traveling the World ────────────────────
        {
            title: 'Traveling the World',
            part: 'basic',
            steps: [
                {
                    title: 'Road Travel',
                    text: '\uD83D\uDEB6 Two ways to travel: Click the <strong>\uD83D\uDDFA\uFE0F Routes</strong> button on the bottom panel to see road connections, or <strong>right-click</strong> a town and select <strong>Travel Here</strong>. Road quality affects speed. Try the <strong>\uD83D\uDDFA\uFE0F Routes</strong> button first!',
                    highlight: '#btnRoutes',
                    onEnter: function () {
                        closeModal();
                        snapshotState.routesOpened = false;
                    },
                    waitFor: function () {
                        if (!snapshotState.routesOpened && isModalOpen()) {
                            snapshotState.routesOpened = true;
                        }
                        return snapshotState.routesOpened;
                    },
                    skipAfter: 8000
                },
                {
                    title: 'Travel by Routes',
                    text: '\uD83D\uDEB6 Now <strong>right-click</strong> on <strong>Inkwell Cross</strong> (centered in view) and choose <strong>Travel Here</strong>. Use the <strong>speed controls</strong> (press 3 or higher) to travel faster! We\u2019ve given you a tutorial speed boost.',
                    onEnter: function () {
                        closeModal();
                        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(5);
                        // Zoom to 1.5 and pan to Inkwell Cross
                        try {
                            if (typeof Renderer !== 'undefined') {
                                if (Renderer.setZoom) Renderer.setZoom(1.5);
                                var towns = Engine.getTowns ? Engine.getTowns() : [];
                                for (var i = 0; i < towns.length; i++) {
                                    if (towns[i].name && towns[i].name.toLowerCase().indexOf('inkwell') >= 0) {
                                        if (Renderer.panTo) Renderer.panTo(towns[i].x, towns[i].y);
                                        break;
                                    }
                                }
                            }
                        } catch (e) {}
                    },
                    waitFor: function () {
                        try { return Player.traveling; } catch (e) { return false; }
                    },
                    skipAfter: 10000
                },
                {
                    title: 'Speed Up Travel',
                    text: '\u23E9 While traveling, speed up the game to travel faster! Press <strong>3</strong> or higher. Watch the progress bar and wait to arrive at your destination.',
                    waitFor: function () {
                        try { return !Player.traveling; } catch (e) { return false; }
                    },
                    onComplete: function () {
                        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(1);
                        nextStep();
                    }
                },
                {
                    title: 'Off-Road Travel',
                    text: '\uD83E\uDD7E You can also travel <strong>off-road</strong>! <strong>Right-click</strong> on an empty spot on the map near you and select <strong>Travel Off-road</strong>. It\u2019s 4\u00D7 slower than roads but lets you go anywhere. Use <strong>speed 5+</strong> to make it faster! Try a short off-road trip now.',
                    highlight: '#gameCanvas',
                    onEnter: function () {
                        snapshotState.offRoadPhase = 0; // 0 = waiting to leave, 1 = traveling out, 2 = arrived out, 3 = traveling back
                        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(10);
                    },
                    waitFor: function () {
                        try {
                            var phase = snapshotState.offRoadPhase || 0;
                            if (phase === 0 && Player.traveling) {
                                snapshotState.offRoadPhase = 1;
                            } else if (phase === 1 && !Player.traveling) {
                                snapshotState.offRoadPhase = 2;
                                // Update text to tell them to come back
                                var textEl = document.querySelector('.tutorial-step-text');
                                if (textEl) {
                                    textEl.innerHTML = '\uD83E\uDD7E Great! Now <strong>right-click</strong> on the town you came from (or any town) and select <strong>Travel Off-road</strong> to travel back. Use <strong>speed 5+</strong> to make it faster!';
                                }
                            } else if (phase === 2 && Player.traveling) {
                                snapshotState.offRoadPhase = 3;
                            } else if (phase === 3 && !Player.traveling) {
                                return true;
                            }
                            return false;
                        } catch (e) { return false; }
                    },
                    skipAfter: 20000
                },
                {
                    title: 'Sea Travel',
                    text: '\u26F5 At <strong>port towns</strong>, ships are required to sail sea routes. Buy a ship when you reach a port to unlock fast oceanic trade between distant towns!'
                }
            ]
        },

        // ── Chapter 5: Survival & Eating ──────────────────────
        {
            title: 'Survival & Eating',
            part: 'basic',
            steps: [
                {
                    title: 'Staying Fed & Hydrated',
                    text: '\uD83C\uDF5E Your <strong>hunger</strong> and <strong>thirst</strong> bars drain over time. If hunger hits 0, you <strong>start starving</strong> and lose health! We\u2019ve given you bread and water. Click the <strong>\uD83C\uDF74 Eat</strong> and <strong>\uD83E\uDD64 Drink</strong> buttons in the ledger (left panel) to restore your stats!',
                    onEnter: function () {
                        Player.state.hunger = 80;
                        Player.state.thirst = 80;
                        giveItem('bread', 5);
                        giveItem('water', 3);
                        // Heavy slow-pulse glow ONLY on the Eat and Drink buttons; dim rest of ledger
                        try {
                            var style = document.createElement('style');
                            style.id = 'tutorialGlowStyle';
                            style.textContent =
                                '#leftPanelBody { opacity: 0.45; transition: opacity 0.4s; }' +
                                '#leftPanelBody .btn-supply { opacity: 1 !important; }' +
                                '.tutorial-btn-glow {' +
                                '  animation: tutBtnGlow 2s ease-in-out infinite alternate !important;' +
                                '  box-shadow: 0 0 12px 4px #ff9900, 0 0 24px 8px rgba(255,153,0,0.5) !important;' +
                                '  border-color: #ffcc00 !important;' +
                                '  position: relative; z-index: 10; opacity: 1 !important;' +
                                '}' +
                                '@keyframes tutBtnGlow {' +
                                '  0%   { box-shadow: 0 0 8px 2px #ff9900, 0 0 16px 4px rgba(255,153,0,0.3); }' +
                                '  100% { box-shadow: 0 0 20px 8px #ffcc00, 0 0 40px 16px rgba(255,204,0,0.5); }' +
                                '}';
                            document.head.appendChild(style);
                            var eatBtn = document.getElementById('btnEatUntilFull');
                            var drinkBtn = document.getElementById('btnDrinkUntilFull');
                            if (eatBtn) eatBtn.classList.add('tutorial-btn-glow');
                            if (drinkBtn) drinkBtn.classList.add('tutorial-btn-glow');
                        } catch (e) {}
                        if (typeof UI !== 'undefined' && UI.update) UI.update();
                    },
                    waitFor: function () {
                        try {
                            var ate = window._tutorialAteFood;
                            var drank = window._tutorialDrankWater;
                            // Remove glow from Eat button once they've eaten
                            if (ate) {
                                var eatBtn = document.getElementById('btnEatUntilFull');
                                if (eatBtn) eatBtn.classList.remove('tutorial-btn-glow');
                            }
                            // Remove glow from Drink button once they've drunk
                            if (drank) {
                                var drinkBtn = document.getElementById('btnDrinkUntilFull');
                                if (drinkBtn) drinkBtn.classList.remove('tutorial-btn-glow');
                            }
                            // Both done — un-dim ledger
                            if (ate && drank) {
                                var glowStyle = document.getElementById('tutorialGlowStyle');
                                if (glowStyle) glowStyle.remove();
                                return true;
                            }
                            return false;
                        } catch (e) { return false; }
                    },
                    onComplete: function () {
                        // Cleanup any remaining glow
                        try {
                            var glowEls = document.querySelectorAll('.tutorial-btn-glow');
                            for (var gi = 0; gi < glowEls.length; gi++) glowEls[gi].classList.remove('tutorial-btn-glow');
                            var glowStyle = document.getElementById('tutorialGlowStyle');
                            if (glowStyle) glowStyle.remove();
                        } catch (e) {}
                        nextStep();
                    },
                    skipAfter: 10000
                },
                {
                    title: 'Health & Injuries',
                    text: '\u2764\uFE0F Your <strong>health bar</strong> shows your physical condition. Injuries from combat, starvation, or accidents reduce max health until you rest and recover. Keep fed, hydrated, and rested to stay in top shape!'
                },
                {
                    title: 'Transport & Carry Capacity',
                    text: '\uD83D\uDCE6 Your carry capacity determines how much you can haul. <strong>This is upgraded in the character menu</strong>, not the caravan panel. Open <strong>\uD83D\uDC64 Character</strong> on the bottom panel to see your carry capacity and upgrade options.',
                    highlight: '#btnCharacter',
                    waitFor: function () { return isModalOpen(); },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    },
                    skipAfter: 8000
                }
            ]
        },

        // ── Chapter 6: Your First Home ────────────────────────
        {
            title: 'Your First Home',
            part: 'basic',
            steps: [
                {
                    title: 'Buy a Home',
                    text: '\uD83C\uDFE0 We\u2019ve given you <strong>gold, land, and materials</strong>. Open <strong>\uD83C\uDFE1 Housing</strong> on the bottom panel and build a home \u2014 even a <strong>Shack</strong> is better than sleeping outside! Housing gives you rest, storage, security, and a home for your family.',
                    highlight: '#btnHousing',
                    onEnter: function () {
                        giveGold(500);
                        giveItem('wood', 10);
                        giveItem('rope', 5);
                        giveItem('stone', 10);
                        giveItem('planks', 10);
                        try {
                            if (!Player.state.landOwned) Player.state.landOwned = {};
                            Player.state.landOwned[Player.state.townId] = (Player.state.landOwned[Player.state.townId] || 0) + 2;
                        } catch (e) {}
                    },
                    waitFor: function () {
                        try { return (Player.state.houses || []).length > 0; } catch (e) { return false; }
                    },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    },
                    skipAfter: 12000
                },
                {
                    title: 'Home Addons',
                    text: '\uD83D\uDD27 Your home can be upgraded with <strong>\uD83D\uDD27 Addons</strong>: <strong>Workshop</strong> (craft at home), <strong>Storage Expansion</strong> (+50% capacity), <strong>Stables</strong> (hold horses), and more. Open <strong>\uD83C\uDFE1 Housing</strong> to see addon options!'
                },
                {
                    title: 'Rest at Home',
                    text: '\uD83D\uDCA4 Now that you own a home, <strong>rest there for free</strong>! Click the <strong>\uD83D\uDE34 Rest</strong> button on the bottom panel. Resting at home gives full recovery at no cost. Better housing means faster rest. Inns cost gold, so always rest at home when possible!',
                    highlight: '#btnRest',
                    onEnter: function () {
                        // Drain energy so rest is meaningful
                        try { Player.state.energy = Math.min(Player.state.energy || 100, 50); } catch (e) {}
                        window._tutorialRested = false;
                    },
                    waitFor: function () {
                        try {
                            return window._tutorialRested || Player.state.resting;
                        } catch (e) { return false; }
                    },
                    skipAfter: 10000
                }
            ]
        },

        // ── Chapter 7: Marriage & Dynasty ─────────────────────
        {
            title: 'Marriage & Dynasty',
            part: 'basic',
            steps: [
                {
                    title: 'Why Marriage Matters',
                    text: '\u26A0\uFE0F <strong>CRITICAL</strong>: If you die without a <strong>spouse</strong> or <strong>children</strong>, it\u2019s <strong>GAME OVER</strong> \u2014 you restart from scratch! <strong>Get married early</strong> to ensure your dynasty continues.'
                },
                {
                    title: 'Meeting & Courtship',
                    text: '\uD83E\uDD1D Click the <strong>View Townspeople</strong> button in a town view, or click on NPCs to see them. Build relationships through <strong>gifts</strong> and <strong>dates</strong>. At high relationship, begin courtship and eventually propose!'
                },
                {
                    title: 'Interactive Marriage',
                    text: '\uD83D\uDC8D Finding you a match...',
                    onEnter: function () {
                        var townId = Player.state.townId;
                        var npcs = [];
                        try { npcs = Engine.getPeople(townId) || []; } catch (e) {}
                        var rng = Engine.getRng();
                        var candidate = null;
                        for (var i = 0; i < npcs.length; i++) {
                            var idx = (i + rng.randInt(0, npcs.length - 1)) % npcs.length;
                            var npc = npcs[idx];
                            if (npc && npc.alive !== false && !npc.spouseId && !npc.spouse && npc.age >= 16) {
                                candidate = npc;
                                break;
                            }
                        }
                        if (!candidate) {
                            // Fallback: any adult alive NPC
                            for (var j = 0; j < npcs.length; j++) {
                                if (npcs[j] && npcs[j].alive !== false && npcs[j].age >= 16) {
                                    candidate = npcs[j];
                                    break;
                                }
                            }
                        }
                        if (candidate) {
                            // Set PLAYER-side relationship to 95
                            if (!Player.state.relationships) Player.state.relationships = {};
                            Player.state.relationships[candidate.id] = { level: 95, type: 'romantic' };
                            // Also set NPC-side
                            if (candidate.relationships) candidate.relationships.player = 95;
                            snapshotState.marriageCandidateId = candidate.id;
                            snapshotState.marriageCandidate = ((candidate.firstName || '') + ' ' + (candidate.lastName || '')).trim() || 'a townsperson';
                        }
                        var step = chapters[currentChapter].steps[currentStep];
                        var name = snapshotState.marriageCandidate || 'a townsperson';
                        step.text = '\uD83D\uDC8D We\u2019ve arranged things so <strong>' + name + '</strong> is very interested in you (relationship 95)! Find them in town \u2014 click on NPCs or use <strong>\uD83D\uDC65 View Townspeople</strong> in the town panel. Once you find them, click <strong>\uD83D\uDC8D Propose Marriage</strong>!';
                        // Periodically highlight the Propose button when it appears
                        snapshotState._proposeGlowTimer = setInterval(function () {
                            var btn = document.getElementById('btnPropose');
                            if (btn && !btn.classList.contains('tutorial-highlight')) {
                                btn.classList.add('tutorial-highlight');
                            }
                        }, 500);
                    },
                    waitFor: function () {
                        try { return Player.state.weddingPlan != null || Player.state.spouseId != null; } catch (e) { return false; }
                    },
                    onComplete: function () {
                        if (snapshotState._proposeGlowTimer) { clearInterval(snapshotState._proposeGlowTimer); snapshotState._proposeGlowTimer = null; }
                        var btn = document.getElementById('btnPropose');
                        if (btn) btn.classList.remove('tutorial-highlight');
                        nextStep();
                    },
                    skipAfter: 12000
                },
                {
                    title: 'Dynasty Strategies',
                    text: '\uD83D\uDCA1 <strong>Dynasty tips</strong>:<br>\u2022 <strong>Marry early</strong> \u2014 don\u2019t risk game over<br>\u2022 <strong>Date first</strong> to check traits before committing<br>\u2022 <strong>Train children</strong> \u2014 spend 3 SP to give a child 1 SP<br>\u2022 <strong>Dynasty Founder</strong> skill adds SP to your dynasty bank for heirs'
                },
                {
                    title: 'Investigating NPCs',
                    text: '\uD83D\uDD0D Every NPC has <strong>hidden quirks</strong>. Discover them before marrying or hiring:<br>\u2022 \uD83D\uDC41\uFE0F <strong>Observe</strong>: 8hrs, 30% success<br>\u2022 \uD83D\uDDE3\uFE0F <strong>Ask Around</strong>: 4hrs, 25% success<br>\u2022 \uD83D\uDD0D <strong>Investigate</strong>: costs gold, 50% success'
                }
            ]
        },

        // ── Chapter 8: Getting Help ───────────────────────────
        {
            title: 'Getting Help',
            part: 'basic',
            steps: [
                {
                    title: 'The Help Button',
                    text: '\u2753 Press the <strong>\u2753 Help</strong> button anytime to open the <strong>Game Guide</strong>. It has detailed explanations of every game system \u2014 trading, building, kingdoms, combat, and more.',
                    highlight: '#btnHelp'
                },
                {
                    title: 'Notifications & Settings',
                    text: '\uD83D\uDD14 The <strong>\uD83D\uDD14 bell icon</strong> shows your notifications. Click <strong>\u2699\uFE0F Settings</strong> to open notification filters. Find <strong>\uD83D\uDC51 My Kingdom</strong> and click <strong>On</strong> to enable kingdom notifications \u2014 these alert you to wars, laws, and festivals!',
                    highlight: '#btnSettings',
                    onEnter: function () {
                        if (typeof Player !== 'undefined' && Player.setNotifFilter) {
                            Player.setNotifFilter('my_kingdom', false);
                        }
                    },
                    waitFor: function () {
                        if (typeof Player !== 'undefined' && Player.getNotificationFilters) {
                            var filters = Player.getNotificationFilters();
                            return filters.my_kingdom === true;
                        }
                        return false;
                    },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    },
                    skipAfter: 12000
                },
                {
                    title: 'You\u2019re Ready!',
                    text: '\uD83C\uDF89 <strong>That\u2019s the basics!</strong> You know how to control the game, trade, travel, manage skills, eat, build a home, start a family, and find help. Now choose: start playing, or continue to advanced systems.'
                }
            ]
        },

        // ═══════════════════════════════════════════════════════
        //  PART 2: ADVANCED
        // ═══════════════════════════════════════════════════════

        // ── Chapter 9: Buildings & Production ─────────────────
        {
            title: 'Buildings & Production',
            part: 'advanced',
            steps: [
                {
                    title: 'Build Your First Business',
                    text: '\uD83C\uDFD7\uFE0F We\u2019ve given you <strong>2,000 gold</strong> and extra land. Click <strong>\uD83C\uDFD7\uFE0F Build</strong> on the bottom panel to see available buildings!',
                    highlight: '#btnBuild',
                    onEnter: function () {
                        giveGold(2000);
                        try {
                            if (!Player.state.landOwned) Player.state.landOwned = {};
                            Player.state.landOwned[Player.state.townId] = (Player.state.landOwned[Player.state.townId] || 0) + 2;
                        } catch (e) {}
                        try {
                            Player.state.workDaysCompleted = Math.max(Player.state.workDaysCompleted || 0, 30);
                            if (!Player.state.stats) Player.state.stats = {};
                            Player.state.stats.totalDaysWorked = Math.max(Player.state.stats.totalDaysWorked || 0, 30);
                        } catch (e) {}
                    },
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Building Types',
                    text: '\uD83C\uDFED <strong>Pick a building and construct it!</strong> Categories include Farming, Mining, Processing, and Finished Goods. Some buildings like mines and woodcutting <strong>need resource deposits</strong> \u2014 scroll down in a town\u2019s view panel to see available resources.',
                    waitFor: function () {
                        return getPlayerBuildings().length > 0;
                    },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    }
                },
                {
                    title: 'See Resource Deposits',
                    text: '\u26CF\uFE0F Click on <strong>Rustbridge</strong> on the map and scroll down to see its <strong>natural resource deposits</strong>. Build mines and farms in towns with matching deposits for bonus output!',
                    highlight: '#gameCanvas',
                    waitFor: function () {
                        var rp = document.getElementById('rightPanel');
                        if (rp && !rp.classList.contains('hidden')) {
                            var rpTitle = document.getElementById('rightPanelTitle');
                            if (rpTitle) {
                                var t = rpTitle.textContent;
                                if (t.indexOf('Rustbridge') >= 0 || t.indexOf('\uD83C\uDFD8') >= 0 || t.indexOf('Town') >= 0) return true;
                            }
                        }
                        return false;
                    },
                    skipAfter: 8000
                },
                {
                    title: 'Supply Chains',
                    text: '\uD83D\uDD17 Chain buildings for high-value goods:<br>\u2022 Wheat Farm \u2192 Flour Mill \u2192 Bakery = \uD83C\uDF5E Bread<br>\u2022 Iron Mine \u2192 Smelter \u2192 Blacksmith = \u2694\uFE0F Swords<br>Buildings in the same town <strong>auto-supply</strong> each other!'
                },
                {
                    title: 'Workers & Hiring',
                    text: '\uD83D\uDC77 Click <strong>\uD83D\uDC65 Hire</strong> on the bottom panel to recruit workers. Four skill levels from Unskilled (cheap, 100% output) to Master (expensive, 160% output). Better workers = more profit!',
                    highlight: '#btnHire',
                    waitFor: function () { return isModalOpen(); },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    },
                    skipAfter: 8000
                },
                {
                    title: 'Building Management',
                    text: '\uD83C\uDFED Buildings you own can be maintained and managed through the <strong>\uD83C\uDFED Buildings</strong> button on the bottom panel. Click it to see your properties!',
                    highlight: '#btnBuildings',
                    onEnter: function () { closeModal(); },
                    waitFor: function () { return isModalOpen(); },
                    skipAfter: 8000
                }
            ]
        },

        // ── Chapter 10: Kingdoms & Politics ───────────────────
        {
            title: 'Kingdoms & Politics',
            part: 'advanced',
            steps: [
                {
                    title: 'Social Ranks',
                    text: '\uD83D\uDC51 <strong>7 social ranks</strong> to climb \u2014 scroll down to see them all:<br>\uD83C\uDF3E Peasant \u2192 \uD83C\uDFE0 Citizen \u2192 \u2696\uFE0F Burgher \u2192 \uD83D\uDD28 Guildmaster \u2192 \uD83D\uDC51 Noble \u2192 \uD83C\uDFF0 Lord \u2192 \uD83D\uDCDC Royal Advisor<br>Each unlocks more buildings, workers, and political power. Open <strong>\uD83D\uDC64 Character</strong> on the bottom panel to view your rank.',
                    highlight: '#btnCharacter',
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Climbing the Ranks',
                    text: '\uD83D\uDCCB Advancing requires <strong>gold</strong>, <strong>kingdom reputation</strong>, and achievements. The <strong>Petition for Promotion</strong> button <strong>glows green</strong> when all requirements are met. Higher ranks unlock powerful buildings and political influence!',
                    onEnter: function () { closeModal(); }
                },
                {
                    title: 'Multi-Kingdom Play',
                    text: '\uD83C\uDF0D Hold rank in <strong>multiple kingdoms</strong>! Become <strong>Citizen</strong> anywhere for citizenship. Earn <strong>kingdom reputation</strong> through trading and completing kingdom orders. If two of your kingdoms go to war, you must pick a side!'
                },
                {
                    title: 'Kingdom Licenses',
                    text: '\uD83D\uDCDC Click <strong>\uD83D\uDC51 Kingdoms</strong> on the bottom panel, then click <strong>\uD83D\uDCDC Buy Licenses</strong> on a kingdom card to purchase a trade license. We\u2019ve given you <strong>200 gold</strong>.',
                    highlight: '#btnKingdoms',
                    onEnter: function () {
                        giveGold(200);
                        snapshotState.licensesBeforeAdv = 0;
                        try { snapshotState.licensesBeforeAdv = (Player.state.licenses || []).length; } catch (e) {}
                    },
                    waitFor: function () {
                        try {
                            return (Player.state.licenses || []).length > (snapshotState.licensesBeforeAdv || 0);
                        } catch (e) { return false; }
                    },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    },
                    skipAfter: 10000
                },
                {
                    title: 'Kingdom Laws & Petitions',
                    text: '\uD83D\uDCDC As Citizen+, you can create <strong>petitions</strong> to influence the king \u2014 build roads, lower taxes, ban goods, or declare war! The king\u2019s <strong>personality</strong> affects which petitions succeed. <strong>Royal Advisors</strong> can propose laws directly.'
                }
            ]
        },

        // ── Chapter 11: War & Military ────────────────────────
        {
            title: 'War & Military',
            part: 'advanced',
            steps: [
                {
                    title: 'How Wars Start',
                    text: '\u2694\uFE0F Wars break out between kingdoms due to territorial disputes, trade conflicts, or royal ambitions. During wartime, <strong>prices spike</strong> for military goods (swords, armor, food, horses) and trade routes may become dangerous.'
                },
                {
                    title: 'Arm Yourself',
                    text: '\u2694\uFE0F We\u2019ve <strong>equipped you with a sword and armor</strong>. Open <strong>\uD83D\uDC64 Character</strong> on the bottom panel to see your gear! Equipment improves your <strong>combat rating</strong> for bandit encounters, military service, and self-defense.',
                    highlight: '#btnCharacter',
                    onEnter: function () {
                        try {
                            Player.state.weapon = { id: 'iron_sword', name: 'Iron Sword', quality: 'standard', combatBonus: 0.15 };
                            Player.state.armor = { id: 'leather_armor', name: 'Leather Armor', quality: 'standard', combatBonus: 0.10 };
                        } catch (e) {}
                    },
                    waitFor: function () { return isModalOpen(); },
                    skipAfter: 10000
                },
                {
                    title: 'Military Enlistment',
                    text: '\uD83D\uDEE1\uFE0F The option to enlist is in the <strong>\uD83D\uDCBC Work</strong> button on the bottom panel if your kingdom is at war. Enlistment has ranks: Militiaman \u2192 Footman \u2192 Sergeant \u2192 Knight. Reaching Knight auto-grants <strong>Citizen status</strong>!',
                    onEnter: function () { closeModal(); }
                },
                {
                    title: 'Conscription',
                    text: '\uD83D\uDEA8 During wartime, kingdoms may <strong>draft citizens</strong> into service! Higher social rank makes you less likely to be conscripted \u2014 <strong>Nobles and above are exempt</strong>. The <strong>Political Connections</strong> skill reduces your draft chance.'
                }
            ]
        },

        // ── Chapter 12: Ships & Sea Trade ─────────────────────
        {
            title: 'Ships & Sea Trade',
            part: 'advanced',
            steps: [
                {
                    title: 'Ship Types',
                    text: '\u26F5 Buy ships at port towns:<br>\u2022 <strong>Small Ship</strong> (200g): Basic sea travel, 1.5x speed<br>\u2022 <strong>Large Ship</strong> (500g): More cargo, better storm resistance<br>Ships are required for sea travel between port towns.'
                },
                {
                    title: 'Ship Addons & Repair',
                    text: '\u2693 Ships have <strong>addon slots</strong>:<br>\u2022 \uD83D\uDCA8 <strong>Extra Sails</strong>: +speed<br>\u2022 \uD83D\uDEE1\uFE0F <strong>Reinforced Hull</strong>: +storm resistance<br>\u2022 \uD83D\uDCE6 <strong>Cargo Hold</strong>: +capacity<br>Ships take <strong>hull damage</strong> from storms and combat. Repair at port towns before your ship sinks!'
                },
                {
                    title: 'Sea Routes',
                    text: '\uD83C\uDF0A <strong>Sea routes</strong> connect port towns for fast oceanic trade. Ships are required for sea travel. <strong>Fishing</strong> provides food and extra income \u2014 a great side business for port-based merchants.'
                }
            ]
        },

        // ── Chapter 13: Advanced Commerce ─────────────────────
        {
            title: 'Advanced Commerce',
            part: 'advanced',
            steps: [
                {
                    title: 'Caravans',
                    text: '\uD83D\uDC2A <strong>Caravans</strong> send goods between towns automatically! We\u2019ve given you <strong>500 gold</strong> and <strong>20 wheat</strong>. Click <strong>\uD83D\uDC2A Caravan</strong> on the bottom panel and set up a caravan route to start automated trading!',
                    highlight: '#btnCaravan',
                    onEnter: function () {
                        giveGold(500);
                        giveItem('wheat', 20);
                        snapshotState.caravansBefore = 0;
                        try {
                            snapshotState.caravansBefore = (Player.state.caravans || []).length;
                        } catch (e) {}
                    },
                    waitFor: function () {
                        try {
                            return (Player.state.caravans || []).length > (snapshotState.caravansBefore || 0);
                        } catch (e) { return false; }
                    },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    },
                    skipAfter: 12000
                },
                {
                    title: 'Toll Roads',
                    text: '\uD83D\uDEE4\uFE0F At <strong>Guildmaster rank</strong>, build toll roads from the town\u2019s build menu. Every merchant using your road pays a toll! Set rates wisely \u2014 higher tolls earn more but may discourage traffic.'
                },
                {
                    title: 'Elite Merchants',
                    text: '\uD83E\uDD16 <strong>Elite NPC merchants</strong> are fierce rivals \u2014 they build, trade, hire, and compete for market share! Click the <strong>\uD83C\uDFC6 Rankings</strong> button on the bottom panel to see the leaderboard and track your competition.',
                    highlight: '#btnRankings',
                    onEnter: function () { closeModal(); },
                    waitFor: function () { return isModalOpen(); },
                    skipAfter: 8000
                },
                {
                    title: 'Outposts',
                    text: '\uD83C\uDFD5\uFE0F At <strong>Guildmaster rank</strong>, found <strong>\u26FA Wilderness Outposts</strong> in remote areas! Outposts extend your trade network, providing storage, rest, and a foothold in new territories. They cost 500g + materials and can grow into full towns!'
                }
            ]
        },

        // ── Chapter 14: Guilds & Crafting ─────────────────────
        {
            title: 'Guilds & Crafting',
            part: 'advanced',
            steps: [
                {
                    title: 'What Are Guilds?',
                    text: '\uD83C\uDFDB\uFE0F <strong>Guilds</strong> are professional organizations that control access to certain building types. There are <strong>9 guilds</strong>: Farmers\', Miners\', Harvesters\', Artisans\', Craftsmen\'s, Armorsmiths\', Luxury Artisans\', Maritime, and Merchants\'. Each covers a <strong>building category</strong> \u2014 you must be a member to own those buildings!<br><br>\uD83D\uDCCA The <strong>Merchants\' Guild</strong> is special \u2014 members can read a <strong>Daily Market Report</strong> with trade tips!'
                },
                {
                    title: 'The Guilds Panel',
                    text: '\uD83C\uDFDB\uFE0F We\u2019ve given you <strong>500 gold</strong> for guild dues. Click the <strong>\uD83C\uDFDB\uFE0F Guilds</strong> button on the bottom panel to see all available guilds!',
                    highlight: '#btnGuilds',
                    onEnter: function () {
                        closeModal();
                        giveGold(500);
                    },
                    waitFor: function () { return isModalOpen(); },
                    skipAfter: 8000
                },
                {
                    title: 'Joining a Guild',
                    text: '\uD83D\uDCB0 Guild memberships come in two types:<br>\u2022 <strong>Monthly</strong> \u2014 ' + (typeof CONFIG !== 'undefined' ? CONFIG.GUILD_BASE_MONTHLY : 25) + 'g/month (flexible)<br>\u2022 <strong>Yearly</strong> \u2014 ' + (typeof CONFIG !== 'undefined' ? CONFIG.GUILD_BASE_YEARLY : 200) + 'g/year (cheaper long-term)<br><br>The <strong>Guild Negotiator</strong> skill reduces dues by 20%. Memberships expire automatically!'
                },
                {
                    title: 'Guild Building Restrictions',
                    text: '\uD83D\uDD28 Some kingdoms enforce <strong>Guild Monopoly</strong> laws \u2014 only guild members at <strong>Guildmaster rank</strong> can own production buildings! Check a kingdom\'s laws before investing.<br><br>\uD83D\uDCA1 <strong>Tip:</strong> Join guilds early for categories you plan to build in.'
                },
                {
                    title: 'Guild Crafting',
                    text: '\u2699\uFE0F Guild membership unlocks <strong>crafting access</strong> at guild buildings in town. Craft items using raw materials from your inventory \u2014 no need to own the building yourself! Check <strong>\uD83C\uDFDB\uFE0F Guilds</strong> for available crafting recipes.'
                },
                {
                    title: 'Guild Entry Fees',
                    text: '\uD83C\uDFEA When you enter a town with guild-controlled buildings, you may pay a small <strong>entry fee</strong> (' + (typeof CONFIG !== 'undefined' ? CONFIG.GUILD_BUILDING_ENTRY_FEE_MIN : 5) + '-' + (typeof CONFIG !== 'undefined' ? CONFIG.GUILD_BUILDING_ENTRY_FEE_MAX : 10) + 'g) if you\u2019re not a member. Membership waives these fees and is usually cheaper long-term.'
                }
            ]
        },

        // ── Chapter 15: Survival Tips ─────────────────────────
        {
            title: 'Survival Tips',
            part: 'advanced',
            steps: [
                {
                    title: 'Market Saturation',
                    text: '\uD83D\uDCC9 <strong>Markets remember.</strong> Selling the same goods in the same town repeatedly causes prices to <strong>drop</strong>. Smart merchants:<br>\u2022 <strong>Diversify routes</strong> \u2014 don\u2019t rely on one trade route<br>\u2022 <strong>Rotate goods</strong> \u2014 sell different things each trip<br>\u2022 <strong>Trade across kingdoms</strong> \u2014 distant markets are less saturated'
                },
                {
                    title: 'Early Game Survival Tips',
                    text: '\uD83D\uDCA1 <strong>Survival checklist</strong>:<br>\u2022 \uD83C\uDF5E <strong>Food first</strong> \u2014 always carry bread/fish<br>\u2022 \uD83D\uDCA7 <strong>Water always</strong> \u2014 dehydration kills faster than hunger<br>\u2022 \uD83D\uDCB0 <strong>Trade early</strong> \u2014 buy cheap at farms, sell at cities<br>\u2022 \uD83C\uDFE0 <strong>Home base</strong> \u2014 get a house ASAP for free rest<br>\u2022 \u26A1 <strong>Rest wisely</strong> \u2014 rest at home (free) not at inns (costly)<br>\u2022 \uD83C\uDF3F <strong>Forage</strong> \u2014 free food near forests and water'
                },
                {
                    title: 'Bankruptcy Recovery',
                    text: '\uD83C\uDD98 If you go bankrupt, don\u2019t panic! Recovery paths exist:<br>\u2022 <strong>Indentured service</strong> \u2014 work for a master to pay off debts<br>\u2022 <strong>Military enlistment</strong> \u2014 guaranteed food and pay<br>\u2022 <strong>Forage & work</strong> \u2014 forage for free food, work basic jobs<br><br>Bankruptcy isn\u2019t game over \u2014 it\u2019s a setback with designed recovery paths!'
                }
            ]
        },

        // ── Chapter 16: Mastery & Endgame ─────────────────────
        {
            title: 'Mastery & Endgame',
            part: 'advanced',
            steps: [
                {
                    title: 'Dark Deeds & Schemes',
                    text: '\uD83D\uDEA8 The <strong>\uD83D\uDD75\uFE0F Schemes</strong> panel lets you plot sabotage, political schemes, assassinations, tax evasion, and market manipulation. High risk, high reward! Click <strong>\uD83D\uDD75\uFE0F Schemes</strong> on the bottom panel to take a look!',
                    highlight: '#btnSchemes',
                    onEnter: function () {
                        closeModal();
                        var btn = document.getElementById('btnSchemes');
                        if (btn) btn.style.display = '';
                        var div = document.getElementById('schemesDivider');
                        if (div) div.style.display = '';
                    },
                    waitFor: function () { return isModalOpen(); },
                    skipAfter: 8000
                },
                {
                    title: 'The Leaderboard',
                    text: '\uD83C\uDFC6 Click <strong>\uD83C\uDFC6 Rankings</strong> on the bottom panel to see the top merchants! The leaderboard tracks the top 10 by <strong>net worth</strong>. Compete against elite NPCs for the #1 spot!',
                    highlight: '#btnRankings',
                    onEnter: function () { closeModal(); },
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Endgame Goals',
                    text: '\uD83C\uDFC6 <strong>Ultimate goals</strong>:<br>\u2022 \uD83D\uDC51 Reach <strong>Royal Advisor</strong> in multiple kingdoms<br>\u2022 \uD83C\uDFF0 Own buildings in every town<br>\u2022 \uD83D\uDEE4\uFE0F Build a toll road network spanning the map<br>\u2022 \uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66 Found a dynasty lasting 3+ generations<br>\u2022 \uD83C\uDFC6 Top the leaderboard as #1 merchant'
                },
                {
                    title: 'Congratulations!',
                    text: '\uD83C\uDF89 <strong>You\u2019ve completed the full tutorial!</strong> You know every system in Merchant Realms \u2014 trading, building, guilds, kingdoms, war, ships, skills, and more. <strong>Now go build your trade empire!</strong>',
                    isFinal: true
                }
            ]
        }
    ];




    // ═══════════════════════════════════════════════════════════
    //  UI: PANEL
    // ═══════════════════════════════════════════════════════════

    function avoidOverlap() {
        if (!panelEl || !active) return;
        var overlay = document.getElementById('modalOverlay');
        if (!overlay || overlay.classList.contains('hidden')) return;
        var modalBox = overlay.querySelector('.modal-content') || overlay.children[0];
        if (!modalBox) return;
        var pr = panelEl.getBoundingClientRect();
        var mr = modalBox.getBoundingClientRect();
        if (pr.right < mr.left || pr.left > mr.right || pr.bottom < mr.top || pr.top > mr.bottom) return;
        var pw = panelEl.offsetWidth, ph = panelEl.offsetHeight;
        var vw = window.innerWidth, vh = window.innerHeight;
        var spots = [
            { x: vw - pw - 10, y: vh - ph - 10 },
            { x: 10, y: vh - ph - 10 },
            { x: vw - pw - 10, y: 60 },
            { x: 10, y: 60 }
        ];
        for (var i = 0; i < spots.length; i++) {
            var s = spots[i];
            if (s.x + pw < mr.left || s.x > mr.right || s.y + ph < mr.top || s.y > mr.bottom) {
                panelEl.style.left = Math.max(0, Math.min(vw - pw, s.x)) + 'px';
                panelEl.style.top = Math.max(0, Math.min(vh - ph, s.y)) + 'px';
                panelEl.style.bottom = 'auto';
                panelEl.style.transform = 'none';
                return;
            }
        }
        panelEl.style.left = (vw - pw - 10) + 'px';
        panelEl.style.top = '60px';
        panelEl.style.bottom = 'auto';
        panelEl.style.transform = 'none';
    }

    function createPanel() {
        if (panelEl) return;
        panelEl = document.createElement('div');
        panelEl.className = 'tutorial-panel';
        panelEl.id = 'tutorialPanel';
        document.body.appendChild(panelEl);

        // Make panel draggable by its header
        var dragOffsetX = 0, dragOffsetY = 0, dragging = false;
        panelEl.addEventListener('mousedown', function (e) {
            // Only drag from header area (not buttons)
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            var header = panelEl.querySelector('.tutorial-panel-header');
            if (!header || !header.contains(e.target)) return;
            dragging = true;
            var rect = panelEl.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            panelEl.style.cursor = 'grabbing';
            e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            var x = e.clientX - dragOffsetX;
            var y = e.clientY - dragOffsetY;
            // Clamp to viewport
            x = Math.max(0, Math.min(window.innerWidth - panelEl.offsetWidth, x));
            y = Math.max(0, Math.min(window.innerHeight - panelEl.offsetHeight, y));
            panelEl.style.left = x + 'px';
            panelEl.style.top = y + 'px';
            panelEl.style.bottom = 'auto';
            panelEl.style.transform = 'none';
        });
        document.addEventListener('mouseup', function () {
            if (dragging) {
                dragging = false;
                panelEl.style.cursor = '';
            }
        });

        // Watch for modal open/close to auto-reposition panel
        var overlay = document.getElementById('modalOverlay');
        if (overlay) {
            modalObserver = new MutationObserver(function () {
                setTimeout(avoidOverlap, 100);
            });
            modalObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
        }
    }

    function destroyPanel() {
        if (modalObserver) { modalObserver.disconnect(); modalObserver = null; }
        if (panelEl) {
            panelEl.remove();
            panelEl = null;
        }
    }



    function renderPanel() {
        if (!panelEl) return;
        var ch = chapters[currentChapter];
        if (!ch) return;
        var step = ch.steps[currentStep];
        if (!step) return;

        var part = ch.part || 'basic';
        var basicCount = 0, advancedCount = 0;
        for (var ci = 0; ci < chapters.length; ci++) {
            if (chapters[ci].part === 'basic') basicCount++;
            else advancedCount++;
        }
        var isBasic = part === 'basic';
        var partIndex = isBasic ? currentChapter : (currentChapter - basicCount);
        var partTotal = isBasic ? basicCount : advancedCount;
        var partLabel = isBasic ? 'Part 1: Basics' : 'Part 2: Advanced';
        var progressText = (isBasic ? 'Basic' : 'Advanced') + ' ' + (partIndex + 1) + '/' + partTotal + ' \u2022 Step ' + (currentStep + 1) + '/' + ch.steps.length;

        var isFinal = step.isFinal || false;
        var hasWaitFor = typeof step.waitFor === 'function';
        var nextLabel = isFinal ? '\uD83C\uDFE0 Start a Real Game' : 'Next \u2192';
        var canGoBack = currentChapter > 0 || currentStep > 0;

        var stepTitleHtml = step.title ? '<div class="tutorial-step-title">' + step.title + '</div>' : '';

        panelEl.innerHTML =
            '<div class="tutorial-panel-header">' +
                '<span class="tutorial-part-label">' + partLabel + '</span>' +
                '<span class="tutorial-chapter-title">Ch ' + (currentChapter + 1) + ': ' + ch.title + '</span>' +
                '<button class="tutorial-btn-skip" id="tutBtnMainMenu">\uD83C\uDFE0 Main Menu</button>' +
            '</div>' +
            stepTitleHtml +
            '<div class="tutorial-step-text">' + step.text + '</div>' +
            '<div class="tutorial-panel-footer">' +
                '<div class="tutorial-footer-left">' +
                    (canGoBack ? '<button class="tutorial-btn-back" id="tutBtnBack">\u2190 Back</button>' : '') +
                    '<span class="tutorial-progress">' + progressText + '</span>' +
                '</div>' +
                '<button class="tutorial-btn-next" id="tutBtnNext">' + nextLabel + '</button>' +
            '</div>';

        // Bind main menu button
        var btnMenu = document.getElementById('tutBtnMainMenu');
        if (btnMenu) {
            btnMenu.addEventListener('click', function () { end(); });
        }

        // Bind back button
        var btnBack = document.getElementById('tutBtnBack');
        if (btnBack) {
            btnBack.addEventListener('click', function () { prevStep(); });
        }

        // Bind next button
        var btnNext = document.getElementById('tutBtnNext');
        if (btnNext) {
            if (hasWaitFor) {
                // Check if this step was already completed
                var stepKey = currentChapter + ':' + currentStep;
                if (completedSteps[stepKey]) {
                    btnNext.dataset.waiting = 'false';
                    btnNext.style.opacity = '1';
                    btnNext.style.cursor = 'pointer';
                    btnNext.textContent = '\u2705 Completed \u2014 Continue \u2192';
                    btnNext.style.background = 'linear-gradient(135deg, #2d5a1d, #3a7a24)';
                    btnNext.style.borderColor = '#5aad35';
                } else {
                    btnNext.dataset.waiting = 'true';
                    btnNext.style.opacity = '0.5';
                    btnNext.style.cursor = 'not-allowed';
                    btnNext.textContent = '\u23F3 Complete the action above...';
                }
            }
            btnNext.addEventListener('click', function () {
                if (btnNext.dataset.waiting === 'true') {
                    waitingClickCount++;
                    if (waitingClickCount >= 3) {
                        // Convert to skip button after 3 frustrated clicks
                        btnNext.dataset.waiting = 'false';
                        btnNext.disabled = false;
                        updateNextButton('Skip this step \u2192', false);
                    }
                    return;
                }
                waitingClickCount = 0;
                // Mark this interactive step as completed (whether Done or Skip)
                var step = chapters[currentChapter] && chapters[currentChapter].steps[currentStep];
                if (step && typeof step.waitFor === 'function') {
                    completedSteps[currentChapter + ':' + currentStep] = true;
                }
                if (doneAdvanceFn) {
                    if (doneTimeout) { clearTimeout(doneTimeout); doneTimeout = null; }
                    var fn = doneAdvanceFn;
                    doneAdvanceFn = null;
                    fn();
                    return;
                }
                if (isFinal) {
                    end();
                } else {
                    nextStep();
                }
            });
        }
    }


    // ═══════════════════════════════════════════════════════════
    //  HIGHLIGHT SYSTEM
    // ═══════════════════════════════════════════════════════════

    function clearHighlights() {
        for (var i = 0; i < highlightedEls.length; i++) {
            highlightedEls[i].classList.remove('tutorial-highlight');
            // Remove click-to-clear handler if attached
            if (highlightedEls[i]._tutHighlightHandler) {
                highlightedEls[i].removeEventListener('click', highlightedEls[i]._tutHighlightHandler);
                delete highlightedEls[i]._tutHighlightHandler;
            }
        }
        highlightedEls = [];
        // Remove greyed-out state from bottom bar buttons
        var dimmed = document.querySelectorAll('#bottomBar .btn-action.tutorial-dimmed');
        for (var j = 0; j < dimmed.length; j++) {
            dimmed[j].classList.remove('tutorial-dimmed');
            dimmed[j].style.opacity = '';
            dimmed[j].style.pointerEvents = '';
            dimmed[j].style.filter = '';
        }
    }

    function highlightElement(selector) {
        clearHighlights();
        if (!selector) return;
        try {
            var els = document.querySelectorAll(selector);
            var isBottomBarBtn = false;
            for (var i = 0; i < els.length; i++) {
                els[i].classList.add('tutorial-highlight');
                highlightedEls.push(els[i]);
                if (els[i].closest && els[i].closest('#bottomBar')) isBottomBarBtn = true;
            }
            // Grey out all other bottom bar buttons when highlighting one
            if (isBottomBarBtn) {
                var allBtns = document.querySelectorAll('#bottomBar .btn-action');
                for (var j = 0; j < allBtns.length; j++) {
                    if (!allBtns[j].classList.contains('tutorial-highlight')) {
                        allBtns[j].classList.add('tutorial-dimmed');
                        allBtns[j].style.opacity = '0.3';
                        allBtns[j].style.filter = 'grayscale(100%)';
                    }
                }
                // Clear glow + grey as soon as the highlighted button is clicked
                for (var k = 0; k < els.length; k++) {
                    (function (el) {
                        var handler = function () {
                            el.removeEventListener('click', handler);
                            clearHighlights();
                        };
                        el.addEventListener('click', handler);
                        // Store for cleanup if step changes before click
                        el._tutHighlightHandler = handler;
                    })(els[k]);
                }
            }
        } catch (e) {
            // Invalid selector, ignore
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  STEP NAVIGATION
    // ═══════════════════════════════════════════════════════════

    function enterStep() {
        if (!active) return;
        var ch = chapters[currentChapter];
        if (!ch) return;
        var step = ch.steps[currentStep];
        if (!step) return;

        // Stop any existing polling
        stopWatching();

        // Run onEnter callback
        if (step.onEnter && typeof step.onEnter === 'function') {
            try { step.onEnter(); } catch (e) { console.error('Tutorial onEnter error:', e); }
        }

        // Highlight
        highlightElement(step.highlight || null);

        // Render panel
        renderPanel();

        // Auto-move panel if it overlaps a modal
        avoidOverlap();

        // Start watching if step has waitFor (and not already completed)
        if (typeof step.waitFor === 'function') {
            startWatching(step.waitFor, step.onComplete || null);
        }
    }


    function prevStep() {
        if (!active) return;
        stopWatching();
        clearHighlights();

        if (currentStep > 0) {
            currentStep--;
            enterStep();
        } else if (currentChapter > 0) {
            currentChapter--;
            var ch = chapters[currentChapter];
            currentStep = ch.steps.length - 1;
            enterStep();
        }
    }

    function nextStep() {
        if (!active) return;
        stopWatching();
        clearHighlights();

        var ch = chapters[currentChapter];
        if (!ch) { end(); return; }

        if (currentStep < ch.steps.length - 1) {
            currentStep++;
            enterStep();
        } else {
            advanceChapter();
        }
    }

    function advanceChapter() {
        if (!active) return;
        stopWatching();
        clearHighlights();

        if (currentChapter < chapters.length - 1) {
            // Check for basic-to-advanced transition
            var currentPart = chapters[currentChapter].part;
            var nextPart = chapters[currentChapter + 1].part;
            if (currentPart === 'basic' && nextPart === 'advanced') {
                showBasicCompleteTransition();
                return;
            }
            currentChapter++;
            currentStep = 0;
            enterStep();
        } else {
            end();
        }
    }

    function showBasicCompleteTransition() {
        if (!panelEl) return;

        panelEl.innerHTML =
            '<div class="tutorial-panel-header">' +
                '<span class="tutorial-part-label">Part 1: Basics \u2014 Complete!</span>' +
                '<button class="tutorial-btn-skip" id="tutBtnMainMenu">\uD83C\uDFE0 Main Menu</button>' +
            '</div>' +
            '<div class="tutorial-step-title">\uD83C\uDF89 Basic Tutorial Complete!</div>' +
            '<div class="tutorial-step-text">' +
                'You\u2019ve learned the essentials of Merchant Realms! You\u2019re ready to start playing, or continue to learn about <strong>advanced systems</strong> like buildings, skills, kingdoms, war, ships, and more.' +
            '</div>' +
            '<div class="tutorial-transition-buttons">' +
                '<button class="tutorial-btn-newgame" id="tutBtnNewGame">\uD83C\uDFAE Start a New Game</button>' +
                '<button class="tutorial-btn-continue" id="tutBtnContinue">\uD83D\uDCDA Continue to Advanced Tutorial</button>' +
            '</div>';

        var btnMenu = document.getElementById('tutBtnMainMenu');
        if (btnMenu) {
            btnMenu.addEventListener('click', function () { end(); });
        }

        var btnNew = document.getElementById('tutBtnNewGame');
        if (btnNew) {
            btnNew.addEventListener('click', function () { end(); });
        }

        var btnContinue = document.getElementById('tutBtnContinue');
        if (btnContinue) {
            btnContinue.addEventListener('click', function () {
                currentChapter++;
                currentStep = 0;
                enterStep();
            });
        }
    }


    // ═══════════════════════════════════════════════════════════
    //  START / END
    // ═══════════════════════════════════════════════════════════

    function start() {
        active = true;
        currentChapter = 0;
        currentStep = 0;
        snapshotState = {};

        // Hide title screen
        var ts = document.getElementById('titleScreen');
        if (ts) { ts.classList.add('hidden'); ts.style.display = 'none'; }
        // Also hide character creation if visible
        var cc = document.getElementById('charCreateScreen');
        if (cc) { cc.classList.add('hidden'); cc.style.display = 'none'; }

        // Generate tutorial world with fixed seed
        Engine.generate(7777);
        var world = Engine.getWorld();
        var towns = Engine.getTowns();
        var startTownId = towns.length > 0 ? towns[0].id : null;

        // Init UI first so DOM elements are cached
        UI.init();

        // Initialize player WITH a town (5th param is critical)
        Player.init(world, 'Tutorial', 'Merchant', 'M', startTownId);

        // Set player to Citizen rank so they can build things in the tutorial
        var startTown = towns.length > 0 ? towns[0] : null;
        if (startTown) {
            Player.socialRank[startTown.kingdomId] = 1; // Citizen
            // Stock starting town and adjacent towns with building materials
            var materialBoost = { wood: 200, stone: 150, iron: 80, planks: 100, bricks: 80, clay: 60, rope: 40, iron_ore: 60 };
            var stockedTowns = [startTown];
            // Find adjacent towns via roads
            var roads = Engine.getRoads ? Engine.getRoads() : [];
            for (var ri = 0; ri < roads.length; ri++) {
                var rd = roads[ri];
                var adjId = null;
                if (rd.fromTownId === startTown.id) adjId = rd.toTownId;
                else if (rd.toTownId === startTown.id) adjId = rd.fromTownId;
                if (adjId) {
                    var adjTown = Engine.findTown(adjId);
                    if (adjTown) stockedTowns.push(adjTown);
                }
            }
            for (var ti = 0; ti < stockedTowns.length; ti++) {
                var t = stockedTowns[ti];
                if (!t.market || !t.market.supply) continue;
                for (var mat in materialBoost) {
                    t.market.supply[mat] = (t.market.supply[mat] || 0) + materialBoost[mat];
                }
            }
        }

        // Give initial food and water for tutorial
        giveItem('bread', 3);
        giveItem('water', 2);
        Player.state.hunger = 95;
        Player.state.thirst = 95;

        // Inject sample Kingdom Orders and Royal Commissions for tutorial
        if (startTown) {
            var kId = startTown.kingdomId;
            var kObj = world.kingdoms ? world.kingdoms.find(function (k) { return k.id === kId; }) : null;
            if (kObj) {
                var day = typeof Engine !== 'undefined' && Engine.getDay ? Engine.getDay() : 0;
                // Procurement orders
                if (!kObj.procurement) kObj.procurement = { orders: [], needs: {} };
                kObj.procurement.orders.push(
                    { id: 'tut_order_1', resourceId: 'wheat', quantity: 20, pricePerUnit: 8, deadlineDay: day + 60, status: 'open', bids: [], requiresPermit: false, description: 'Wheat Supply — Royal Granary' },
                    { id: 'tut_order_2', resourceId: 'planks', quantity: 10, pricePerUnit: 18, deadlineDay: day + 45, status: 'open', bids: [], requiresPermit: false, description: 'Planks — Castle Repairs' },
                    { id: 'tut_order_3', resourceId: 'iron', quantity: 8, pricePerUnit: 25, deadlineDay: day + 30, status: 'open', bids: [], requiresPermit: false, description: 'Iron Supply — Royal Armory' }
                );
                // Royal commissions
                if (!kObj.royalCommissions) kObj.royalCommissions = [];
                kObj.royalCommissions.push(
                    { id: 'tut_comm_1', type: 'supply', resourceId: 'bread', quantity: 15, reward: 250, repReward: 8, expiresDay: day + 50, status: 'open', description: 'Supply 15 Bread for the Royal Feast' },
                    { id: 'tut_comm_2', type: 'supply', resourceId: 'wool', quantity: 10, reward: 180, repReward: 5, expiresDay: day + 40, status: 'open', description: 'Supply 10 Wool for Winter Cloaks' }
                );
            }
        }

        // Initialize renderer
        var canvas = document.getElementById('gameCanvas');
        Renderer.init(canvas, world);

        // Show game UI
        UI.showGameUI();

        // Start game state
        if (typeof Game !== 'undefined') {
            Game.setState('playing');
            Game.setSpeed(1);
            // Start the game loop — critical for rendering and ticks
            if (Game.startLoop) {
                Game.startLoop();
            }
            // Setup input handlers for keyboard/mouse
            if (Game.setupInput) {
                Game.setupInput();
            }
        }

        // Center camera on starting town and zoom in for tutorial
        if (typeof Renderer !== 'undefined') {
            if (Renderer.centerOnTown && startTownId) Renderer.centerOnTown(startTownId);
            if (Renderer.setZoom) Renderer.setZoom(1.6);
            else if (Renderer.getCamera) { var cam = Renderer.getCamera(); cam.zoom = 1.6; cam.targetZoom = 1.6; }
        }

        // Start the game loop if Game has init
        if (typeof Game !== 'undefined' && Game.init) {
            // Game.init already called from main; the loop should be running
            // Just ensure state is 'playing'
            Game.setState('playing');
        }

        // Create tutorial panel and start first step
        createPanel();
        enterStep();

        // Clear startup notifications — wars/events during world gen are distracting
        setTimeout(function () {
            var tc = document.getElementById('toastContainer');
            if (tc) tc.innerHTML = '';
            var badge = document.querySelector('[ref] .notification-count, .notif-count');
            if (badge) badge.textContent = '0';
            if (typeof UI !== 'undefined' && UI.clearNotifications) UI.clearNotifications();
        }, 200);

        // Start game music (tutorial doesn't trigger main.js music path)
        if (typeof Music !== 'undefined') {
            Music.init();
            Music.playGameMusic('peaceful');
        }

        // Show welcome toast
        var townName = towns.length > 0 ? towns[0].name : 'your town';
        if (typeof UI !== 'undefined' && UI.toast) {
            setTimeout(function () {
                UI.toast('\uD83D\uDCD6 Tutorial started! You are in ' + townName + '.', 'info');
            }, 500);
        }
    }

    function end() {
        active = false;
        stopWatching();
        clearHighlights();
        destroyPanel();

        // Return to main menu
        if (typeof Game !== 'undefined' && Game.showTitleScreen) {
            Game.showTitleScreen();
        } else {
            // Fallback
            var ts = document.getElementById('titleScreen');
            if (ts) { ts.classList.remove('hidden'); ts.style.display = 'flex'; }
            if (typeof UI !== 'undefined' && UI.hideGameUI) UI.hideGameUI();
        }
    }

    // Clean up tutorial state and UI without navigating (for external callers)
    function cleanup() {
        active = false;
        stopWatching();
        clearHighlights();
        destroyPanel();
    }

    // Resume tutorial from a loaded save (world already restored, just restore tutorial UI)
    function resume(chapter, step) {
        if (chapter == null || step == null) return;
        active = true;
        currentChapter = chapter;
        currentStep = step;
        snapshotState = {};

        createPanel();
        enterStep();

        if (typeof UI !== 'undefined' && UI.toast) {
            setTimeout(function () {
                UI.toast('\uD83D\uDCD6 Tutorial resumed from save!', 'info');
            }, 500);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════════

    return {
        start: start,
        resume: resume,
        isActive: function () { return active; },
        nextStep: nextStep,
        prevStep: prevStep,
        skip: end,
        cleanup: cleanup,
        getCurrentChapter: function () { return currentChapter; },
        getCurrentStep: function () { return currentStep; }
    };
})();