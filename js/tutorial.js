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

    // Polling / waitFor state
    var pollInterval = null;
    var skipTimeout = null;
    var doneTimeout = null;
    var doneAdvanceFn = null;
    var modalObserver = null;
    var snapshotState = {};

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
        try { return Player.state.buildings || []; } catch (e) { return []; }
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

        // Show waiting state
        updateNextButton('\u23F3 Complete the action above...', true);

        // Get step's custom skip delay or use default (20s)
        var step = chapters[currentChapter] && chapters[currentChapter].steps[currentStep];
        var skipDelay = (step && step.skipAfter) ? step.skipAfter : 20000;

        pollInterval = setInterval(function () {
            try {
                if (conditionFn()) {
                    stopWatching();
                    // Show Done as clickable button with green highlight
                    doneAdvanceFn = onComplete || function () { nextStep(); };
                    var btn = document.getElementById('tutBtnNext');
                    if (btn) {
                        btn.textContent = '\u2705 Done! Continue \u2192';
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                        btn.style.background = 'linear-gradient(135deg, #2d5a1d, #3a7a24)';
                        btn.style.borderColor = '#5aad35';
                    }
                    // Auto-advance after 5 seconds if not clicked
                    doneTimeout = setTimeout(function () {
                        var fn = doneAdvanceFn;
                        doneAdvanceFn = null;
                        doneTimeout = null;
                        if (fn) fn();
                    }, 5000);
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
    }

    function updateNextButton(label, disabled) {
        var btn = document.getElementById('tutBtnNext');
        if (!btn) return;
        btn.textContent = label;
        btn.disabled = !!disabled;
        if (disabled) {
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
                    title: 'Welcome to Merchant Realms',
                    text: '\uD83C\uDFF0 Welcome, merchant! In <strong>Merchant Realms</strong> you trade goods, build an empire, climb social ranks, and found a dynasty across generations. Let\u2019s learn the basics \u2014 you can leave at any time via the \uD83C\uDFE0 Main Menu button.'
                },
                {
                    title: 'Camera & Map',
                    text: '\uD83C\uDFA5 <strong>Pan</strong> the map with <strong>W/A/S/D</strong> or <strong>arrow keys</strong>. <strong>Zoom</strong> with the <strong>scroll wheel</strong> (0.5x\u20134x). Click any <strong>town</strong> on the map to inspect it.',
                    highlight: '#gameCanvas'
                },
                {
                    title: 'Your Player Icon',
                    text: '\uD83D\uDD36 See that <strong>golden pulsing diamond</strong> on the map? That\u2019s <strong>you</strong>! It shows your exact position \u2014 in a town, on the road, or traveling by sea. If you ever lose track of yourself, click the <strong>\uD83D\uDCCD Find</strong> button or <strong>click your name</strong> in the top-left panel to instantly snap the camera back to your location. Try it now \u2014 pan away with W/A/S/D, then click <strong>\uD83D\uDCCD Find</strong>!',
                    highlight: '#btnLocate',
                    waitFor: function () {
                        // Detect that locatePlayer was used by checking for the toast
                        var toasts = document.querySelectorAll('.toast');
                        for (var i = 0; i < toasts.length; i++) {
                            if (toasts[i].textContent.indexOf('Centered on your location') >= 0) return true;
                        }
                        return false;
                    },
                    skipAfter: 6000
                },
                {
                    title: 'Speed Controls',
                    text: '\u23E9 Press <strong>1\u20135</strong> or click the speed buttons to change game speed. Try pressing <strong>2</strong> now! Use \u23F8 to pause when you need to plan.',
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
                    title: 'Keyboard Shortcuts',
                    text: '\u2328\uFE0F Speed up your play with <strong>keyboard shortcuts</strong>:<br>\u2022 <strong>T</strong> = Trade \u2022 <strong>B</strong> = Build \u2022 <strong>H</strong> = Hire \u2022 <strong>C</strong> = Caravans<br>\u2022 <strong>F</strong> = Find Me \u2022 <strong>M</strong> = Map \u2022 <strong>L</strong> = Log \u2022 <strong>R</strong> = Resource Deposits<br>\u2022 <strong>Space</strong> = Pause \u2022 <strong>1\u20135</strong> = Speed<br>Try pressing <strong>T</strong> now to open the Trade panel!',
                    waitFor: function () {
                        return isModalOpen();
                    },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    },
                    skipAfter: 8000
                },
                {
                    title: 'Meeting the Townsfolk',
                    text: '\uD83D\uDC65 <strong>Zoom in</strong> (scroll wheel) past 1.5x to see individual <strong>NPCs walking around</strong> your town \u2014 click one to see their name, job, and personality! You can also click the <strong>\uD83D\uDCAC Talk</strong> button in the bottom bar to chat with a random local \u2014 they may share useful rumors about prices, wars, or elite merchants. Try clicking <strong>\uD83D\uDCAC Talk</strong> now!',
                    highlight: '#btnTalk',
                    waitFor: function () {
                        // Detect that the talk dialog appeared (modal title is "💬 Conversation")
                        var modal = document.getElementById('modalOverlay');
                        if (!modal || modal.classList.contains('hidden')) return false;
                        var title = document.getElementById('modalTitle');
                        return title && title.textContent.indexOf('Conversation') >= 0;
                    },
                    skipAfter: 4000
                },
                {
                    title: 'Town Info & People List',
                    text: '\uD83C\uDFD8\uFE0F <strong>Click any town</strong> on the map to see its details \u2014 population, market prices, buildings, and a <strong>\uD83D\uDC65 View Townspeople</strong> button that lists every NPC living there. <strong>Tip:</strong> Hold <strong>Shift + Click</strong> to select an individual NPC instead of the town they\u2019re standing in! You can <strong>right-click anywhere</strong> on the map to travel off-road to that point for shortcuts. The <strong>Ledger</strong> (left panel) shows your gold, location, and status.',
                    highlight: '#leftPanel'
                },
                {
                    title: 'Saving Your Game',
                    text: '\uD83D\uDCBE <strong>Save/Load</strong> from the menu at any time. You have <strong>5 save slots</strong> to experiment with different strategies. Each slot has a <strong>Download</strong> button (\u2B07\uFE0F) to save your game as a file to your computer, and an <strong>Import</strong> button (\uD83D\uDCC2) to upload a previously downloaded save. This way your progress is safe even if browser data is cleared! Try saving now \u2014 click the <strong>Save Game</strong> button.',
                    highlight: '#btnSave',
                    waitFor: function () { return typeof Game !== 'undefined' && Game.hasSave && Game.hasSave(); },
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
                    text: '\uD83D\uDCB0 Time for your first trade! We\u2019ve given you <strong>300 bonus gold</strong>. Click the <strong>\uD83D\uDCCA Trade</strong> button to open the market.',
                    highlight: '#btnTrade',
                    onEnter: function () {
                        giveGold(300);
                    },
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Buy Some Goods',
                    text: '\uD83C\uDF3E Prices are set by <strong>supply & demand</strong>. Find \uD83C\uDF3E Wheat and click <strong>Buy</strong>. In a real game, you\u2019d buy cheap here and sell where prices are higher!',
                    waitFor: function () {
                        var inv = getPlayerInventory();
                        return (inv.wheat || 0) > 0;
                    },
                    onComplete: function () {
                        snapshotState.wheatBought = (getPlayerInventory().wheat || 0);
                        closeModal();
                        nextStep();
                    }
                },
                {
                    title: 'Sell for Profit',
                    text: '\uD83D\uDCCA Now sell it back. Click <strong>\uD83D\uDCCA Trade</strong> again and sell your wheat. The <strong>market spread</strong> means sell prices are ~80% of buy in the same town \u2014 real profit comes from <strong>trading between towns</strong>.',
                    highlight: '#btnTrade',
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Complete the Sale',
                    text: '\uD83C\uDF3E Sell all your wheat now! Remember the golden rule: <strong>buy low in one town, sell high in another</strong>.',
                    waitFor: function () {
                        var inv = getPlayerInventory();
                        return (inv.wheat || 0) === 0;
                    },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    }
                },
                {
                    title: 'Trading Tips',
                    text: '\uD83D\uDCA1 <strong>Key concepts</strong>:<br>\u2022 \uD83D\uDCC8 <strong>Supply/demand</strong> \u2014 prices swing \u00B115% based on local stock<br>\u2022 \uD83D\uDCC5 <strong>Seasons</strong> affect crop prices \u2014 buy grain after harvest, sell in winter<br>\u2022 \uD83C\uDFDB\uFE0F <strong>Tariffs</strong> \u2014 foreign traders pay extra in some kingdoms<br>\u2022 Higher <strong>rank</strong> = tax discount (up to 30%!)'
                },
                {
                    title: 'Street Trading',
                    text: '\uD83E\uDD1D You can trade <strong>directly with townspeople</strong>! Click the <strong>\uD83E\uDD1D Street</strong> button to see what locals want to buy or sell. Street trading lets you bypass the market and deal person-to-person \u2014 sometimes at better prices. Some goods can <strong>only</strong> be sold on the street. Try it now!',
                    highlight: '#btnStreet',
                    waitFor: function () { return isModalOpen(); },
                    skipAfter: 6000
                },
                {
                    title: 'Trade Licenses',
                    text: '\uD83D\uDCDC Some valuable goods require a <strong>Trade License</strong> to sell legally. You can buy licenses from the <strong>kingdom panel</strong> (\uD83D\uDC51 Kingdoms). Selling without a license is <strong>smuggling</strong> \u2014 high profit but you risk jail! Check the kingdom\u2019s laws to see which goods are restricted.'
                }
            ]
        },

        // ── Chapter 3: Traveling the World ────────────────────
        {
            title: 'Traveling the World',
            part: 'basic',
            steps: [
                {
                    title: 'Road Travel',
                    text: '\uD83D\uDEB6 <strong>Click any town</strong> on the map, then click <strong>\uD83D\uDEB6 Travel Here</strong>. Road quality affects speed: no road (0.25x), poor road (1.5x), good road (2x). Routes show estimated travel time.',
                    highlight: '#gameCanvas'
                },
                {
                    title: 'Travel Demo',
                    text: '\uD83D\uDC34 We\u2019re sending you to a nearby town! A <strong>\uD83D\uDC34 horse</strong> gives +30% speed. Watch the progress bar \u2014 you\u2019ll arrive shortly.',
                    onEnter: function () {
                        if (Player.horses && Player.horses.length === 0) {
                            try { Player.buyHorse && Player.buyHorse(Player.townId); } catch(e) {}
                            if (Player.horses && Player.horses.length === 0 && Player.state) {
                                Player.state.horses = Player.state.horses || [];
                                Player.state.horses.push({ id: 'tutorial_horse', name: 'Storm', stamina: 90, speed: 1.0 });
                            }
                        }
                        var towns = Engine.getTowns();
                        var roads = Engine.getRoads();
                        var nearest = null, nearestDist = Infinity;
                        var startTown = Engine.findTown(Player.townId);
                        if (startTown && roads) {
                            for (var ri = 0; ri < roads.length; ri++) {
                                var rd = roads[ri];
                                var otherId = null;
                                if (rd.fromTownId === Player.townId) otherId = rd.toTownId;
                                else if (rd.toTownId === Player.townId) otherId = rd.fromTownId;
                                if (otherId) {
                                    var ot = Engine.findTown(otherId);
                                    if (ot) {
                                        var d = Math.hypot(startTown.x - ot.x, startTown.y - ot.y);
                                        if (d < nearestDist) { nearestDist = d; nearest = otherId; }
                                    }
                                }
                            }
                        }
                        if (nearest) {
                            try { Player.travelTo(nearest); } catch (e) { }
                        } else if (towns.length > 1) {
                            try { Player.travelTo(towns[1].id); } catch (e) { }
                        }
                        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(10);
                    },
                    waitFor: function () {
                        try { return !Player.traveling; } catch (e) { return false; }
                    },
                    onComplete: function () {
                        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(1);
                        nextStep();
                    }
                },
                {
                    title: 'Off-Road & Free Travel',
                    text: '\uD83E\uDD7E <strong>Right-click anywhere</strong> on the map to travel off-road. It\u2019s slow (0.25x speed) but lets you go <strong>anywhere</strong> \u2014 no roads needed! Great for shortcuts.',
                    highlight: '#gameCanvas'
                },
                {
                    title: 'Sea Travel',
                    text: '\u26F5 At <strong>port towns</strong>, buy a ship to sail ocean routes at 1.5x speed. Beware <strong>storms</strong> (5% risk, lose 10\u201330% cargo). Ships unlock fast trade lanes between distant ports.'
                }
            ]
        },

        // ── Chapter 4: Working & Earning ──────────────────────
        {
            title: 'Working & Earning',
            part: 'basic',
            steps: [
                {
                    title: 'Staying Fed & Hydrated',
                    text: '\uD83C\uDF5E Your <strong>hunger</strong> and <strong>thirst</strong> bars drain over time. If hunger hits 0, you <strong>start starving</strong> and lose health! We\u2019ve given you bread and water. Open <strong>\uD83D\uDC64 Character</strong> to see your vitals and eat/drink from your inventory. Keep both bars above 20%!',
                    highlight: '#btnCharacter',
                    onEnter: function () {
                        giveItem('bread', 5);
                        giveItem('water', 3);
                    },
                    waitFor: function () {
                        try { return Player.state.hunger > 50; } catch (e) { return false; }
                    },
                    skipAfter: 10000
                },
                {
                    title: 'Health & Injuries',
                    text: '\uD83C\uDFE5 Your <strong>health bar</strong> shows your physical condition. You can get <strong>injured</strong> from combat, bandit attacks, or starvation. Visit a <strong>\uD83C\uDFE5 Hospital</strong> in town for treatment, or learn <strong>First Aid</strong> (Survival skill) to self-treat minor injuries. The <strong>Herbalist</strong> skill lets you craft healing potions from foraged herbs!'
                },
                {
                    title: 'Energy & Rest',
                    text: '\uD83D\uDE34 <strong>Energy</strong> depletes as you perform actions (trading, building, traveling, working). At 30% you get a warning; below 20% you take penalties to trade, combat, and other skills. At 0 energy you may <strong>collapse</strong>! <strong>Rest at home or an inn</strong> to recover \u2014 better housing restores energy faster.'
                },
                {
                    title: 'Take Your First Job',
                    text: '\uD83D\uDD28 Open the <strong>\uD83D\uDCBC Work</strong> panel to see available jobs in town. Accept any job to start earning gold! Jobs pay daily wages and build experience. Try it now \u2014 click <strong>\uD83D\uDCBC Work</strong>!',
                    highlight: '#btnWork',
                    waitFor: function () { return isModalOpen(); },
                    skipAfter: 6000
                },
                {
                    title: 'Transport & Carry Capacity',
                    text: '\uD83D\uDCE6 Open the <strong>\uD83D\uDC34 Caravan</strong> panel to upgrade your carry capacity:<br>\u2022 \uD83C\uDF92 <strong>Backpack</strong>: 2x (~10g + materials)<br>\u2022 \uD83D\uDED2 <strong>Cart</strong>: 4x (~30g + materials)<br>\u2022 <strong>Wagon</strong>: 10x (needs horses)<br>Prices depend on <strong>local material costs</strong> \u2014 a dynamic economy feature! More cargo = bigger profits per trip.',
                    highlight: '#btnCaravan'
                }
            ]
        },

        // ── Chapter 5: Your First Home ────────────────────────
        {
            title: 'Your First Home',
            part: 'basic',
            steps: [
                {
                    title: 'Buy a Home',
                    text: '\uD83C\uDFE0 We\u2019ve given you <strong>gold, land, and materials</strong>. Open <strong>\uD83C\uDFE1 Housing</strong> and build a home \u2014 even a <strong>Shack</strong> is better than sleeping outside! Housing gives you a <strong>place to rest</strong>, <strong>storage</strong>, <strong>security</strong> against theft, and a home for your <strong>family</strong>.',
                    highlight: '#btnHousing',
                    onEnter: function () {
                        giveGold(500);
                        giveItem('wood', 10);
                        giveItem('rope', 5);
                        giveItem('stone', 10);
                        giveItem('planks', 10);
                        // Grant a land plot so the player can actually build
                        try {
                            if (!Player.state.landOwned) Player.state.landOwned = {};
                            Player.state.landOwned[Player.state.townId] = (Player.state.landOwned[Player.state.townId] || 0) + 1;
                        } catch (e) { console.error('Tutorial land grant error:', e); }
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
                    title: 'Rest & Storage',
                    text: '\uD83D\uDCA4 <strong>Sleep at home</strong> for full recovery in 20 ticks. Better housing = faster rest and more storage (up to 500 units). A \uD83C\uDFE8 <strong>Inn Room</strong> (3g/night) works while traveling.'
                },
                {
                    title: 'Upgrading Over Time',
                    text: '\uD83C\uDFF0 As you grow wealthier, upgrade for better bonuses:<br>\u2022 <strong>Townhouse</strong>: +15 reputation, 200 storage<br>\u2022 <strong>Merchant House</strong>: +25 rep, 350 storage<br>\u2022 <strong>Manor</strong>: +30 rep, 400 storage<br>Costs vary by town \u2014 building materials are priced from the <strong>local market</strong>, so shop around! Sell housing at 70% of current material value.'
                },
                {
                    title: 'Home Crafting',
                    text: '\u2692\uFE0F If your home has a <strong>Workshop</strong> (Townhouse+), you can <strong>craft items at home</strong>! Open <strong>\uD83C\uDFE1 Housing</strong> and look for the crafting section. Craft weapons, tools, or goods from raw materials without needing a dedicated building. It\u2019s a great way to add value to cheap resources!'
                }
            ]
        },

        // ── Chapter 6: Marriage & Dynasty ─────────────────────
        {
            title: 'Marriage & Dynasty',
            part: 'basic',
            steps: [
                {
                    title: '\u26A0\uFE0F Why This Matters',
                    text: '\u26A0\uFE0F <strong>CRITICAL</strong>: If you die without a <strong>spouse</strong> or <strong>children</strong>, it\u2019s <strong>GAME OVER</strong> \u2014 you restart from scratch! <strong>Get married early</strong> to ensure your dynasty continues.'
                },
                {
                    title: 'Meeting & Courtship',
                    text: '\uD83E\uDD1D <strong>Click on NPCs</strong> in towns to build relationships (0\u2013100). Give <strong>gifts</strong>, go on <strong>dates</strong>, and build trust. At 60+ relationship, begin <strong>courtship</strong> (nobles require 80+). The <strong>Charming</strong> skill gives +25% relationship gains.'
                },
                {
                    title: 'Marriage & Children',
                    text: '\uD83D\uDC8D <strong>Marriage</strong> costs 50g + 100g per rank. Choose wisely \u2014 spouses have <strong>personality traits</strong> that affect your business! <strong>Children</strong> arrive naturally (3% chance/day, 270-day pregnancy). You and your spouse must be in the <strong>same town</strong> for a chance at conception, and having a <strong>home</strong> greatly improves fertility!'
                },
                {
                    title: 'Inheritance \u2014 Your Legacy',
                    text: '\uD83D\uDC51 When you die, your <strong>heir inherits</strong> your <strong>gold</strong> (split with siblings if any, minus kingdom inheritance tax), your <strong>buildings</strong>, and partial <strong>reputation</strong> (15% retention, or 50% with <strong>Legacy of Trust</strong>). Skills reset, but <strong>Dynasty Founder</strong> gives your heir +1 SP. A surviving <strong>spouse</strong> inherits 100% of gold!'
                },
                {
                    title: 'Dynasty Tips',
                    text: '\uD83D\uDCA1 <strong>Dynasty strategies</strong>:<br>\u2022 Marry someone with <strong>Natural Leader</strong> (+10% worker productivity)<br>\u2022 Teach your children skills to prepare them<br>\u2022 Invest in <strong>Dynasty Founder</strong> skill (+1 SP to your heir)<br>\u2022 Build wealth and buildings \u2014 they pass to your heirs!'
                },
                {
                    title: 'Investigating NPCs',
                    text: '\uD83D\uDD0D Every NPC has <strong>hidden quirks</strong> that affect how they work and interact. Click any person and try <strong>Observe</strong> to discover their traits. This costs <strong>8 hours</strong> but may reveal useful info about potential workers or spouses!<br>\u2022 \uD83D\uDC41\uFE0F <strong>Observe</strong>: 8hrs, 30% success<br>\u2022 \uD83D\uDDE3\uFE0F <strong>Ask Around</strong>: 4hrs, 25% success<br>\u2022 \uD83D\uDD0D <strong>Investigate</strong>: costs gold, 50% success'
                }
            ]
        },

        // ── Chapter 7: Getting Help ───────────────────────────
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
                    title: 'Glossary & Icons',
                    text: '\uD83D\uDCD6 Inside Help, check the <strong>Glossary</strong> for definitions of game terms, and the <strong>Icons Guide</strong> to learn what every symbol means. Hover over most UI elements for <strong>tooltips</strong> with extra info.'
                },
                {
                    title: 'Notifications & Settings',
                    text: '\uD83D\uDD14 See the <strong>\uD83D\uDD14 bell icon</strong> in the top bar? That\u2019s your <strong>notification center</strong> \u2014 click it to review events you may have missed. Click <strong>\u2699\uFE0F Settings</strong> to customize your experience, including <strong>notification filters</strong> to show only what matters to you. Too many popups? Turn off categories you don\u2019t need!',
                    highlight: '#btnSettings'
                },
                {
                    title: 'You\u2019re Ready!',
                    text: '\uD83C\uDF89 <strong>That\u2019s the basics!</strong> You know how to control the game, trade, travel, earn money, get housing, start a family, and find help. Now choose: start playing, or continue to advanced systems.'
                }
            ]
        },

        // ═══════════════════════════════════════════════════════
        //  PART 2: ADVANCED
        // ═══════════════════════════════════════════════════════

        // ── Chapter 8: Buildings & Production ─────────────────
        {
            title: 'Buildings & Production',
            part: 'advanced',
            steps: [
                {
                    title: 'Build Your First Business',
                    text: '\uD83C\uDFD7\uFE0F We\u2019ve given you <strong>2,000 gold</strong>. Click <strong>\uD83C\uDFD7\uFE0F Build</strong> to see available buildings. Try a <strong>Wheat Farm</strong> or anything you can afford!',
                    highlight: '#btnBuild',
                    onEnter: function () {
                        giveGold(2000);
                    },
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Building Types',
                    text: '\uD83C\uDFED <strong>Pick a building and construct it!</strong> 40+ buildings in categories:<br>\u2022 \uD83C\uDF3E <strong>Farming</strong>: Wheat Farm, Cattle Ranch, Vineyard<br>\u2022 \u26CF\uFE0F <strong>Mining</strong>: Iron Mine, Gold Mine, Quarry<br>\u2022 \u2699\uFE0F <strong>Processing</strong>: Flour Mill, Smelter, Sawmill<br>\u2022 \uD83C\uDFAF <strong>Finished</strong>: Bakery, Blacksmith, Jeweler<br>Match buildings to local <strong>resource deposits</strong> for bonus output!',
                    waitFor: function () {
                        return getPlayerBuildings().length > 0;
                    },
                    onComplete: function () {
                        closeModal();
                        nextStep();
                    }
                },
                {
                    title: 'Supply Chains',
                    text: '\uD83D\uDD17 Chain buildings for high-value goods:<br>\u2022 Wheat Farm \u2192 Flour Mill \u2192 Bakery = \uD83C\uDF5E Bread<br>\u2022 Iron Mine \u2192 Smelter \u2192 Blacksmith = \u2694\uFE0F Swords<br>Buildings in the same town <strong>auto-supply</strong> each other. Guildmasters get +10% chain bonus!'
                },
                {
                    title: 'Workers & Hiring',
                    text: '\uD83D\uDC77 Click <strong>\uD83D\uDC65 Hire</strong> to recruit. Four skill levels:<br>\u2022 \uD83D\uDFE2 <strong>Unskilled</strong>: 10g hire, 5g/week, 100% output<br>\u2022 \uD83D\uDFE1 <strong>Skilled</strong>: 50g, 120% output<br>\u2022 \uD83D\uDFE0 <strong>Expert</strong>: 200g, 140% output<br>\u2022 \uD83D\uDD34 <strong>Master</strong>: 800g, 160% output',
                    highlight: '#btnHire',
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Building Management',
                    text: '\uD83D\uDD27 Buildings need <strong>maintenance</strong> (3% of cost/week). Condition degrades over time \u2014 neglect leads to destruction! Hire <strong>guards</strong> (10g/season) to prevent theft. Use <strong>Transfer Targets</strong> to auto-send output between buildings.',
                    waitFor: function () { return isModalClosed(); }
                },
                {
                    title: 'Worker Quirk Effects',
                    text: '\uD83E\uDDE0 Workers\u2019 <strong>quirks affect your buildings</strong>! A <strong>Perfectionist</strong> worker produces higher quality goods but works slower. A <strong>Clumsy</strong> worker breaks materials. A <strong>Thief</strong> may steal output! Use <strong>Observe/Ask Around/Investigate</strong> on NPCs before hiring to discover their quirks. Check the building panel to see active quirk effects on production.'
                },
                {
                    title: 'Resource Deposits',
                    text: '\u26CF\uFE0F Towns near <strong>resource deposits</strong> produce those resources more cheaply. Press <strong>R</strong> or click the <strong>\u26CF Deposits</strong> button to see deposit icons on the map (requires <strong>Regional Survey</strong> skill). Build mines and farms in towns with matching deposits for <strong>bonus output</strong>!'
                }
            ]
        },

        // ── Chapter 9: Skills & Progression ───────────────────
        {
            title: 'Skills & Progression',
            part: 'advanced',
            steps: [
                {
                    title: 'Skill Branches',
                    text: '\uD83D\uDCDA Click <strong>\uD83D\uDCDA Skills</strong> to browse. <strong>50+ skills in 6 branches</strong>:<br>\u2022 \uD83D\uDCB0 <strong>Commerce</strong> \u2022 \uD83C\uDFED <strong>Industry</strong> \u2022 \uD83D\uDE9A <strong>Transport</strong><br>\u2022 \uD83D\uDC65 <strong>Social</strong> \u2022 \u2694\uFE0F <strong>Survival</strong> \u2022 \uD83D\uDD75\uFE0F <strong>Underworld</strong><br>We\u2019ve given you <strong>5 skill points</strong> to try!',
                    highlight: '#btnSkills',
                    onEnter: function () {
                        giveSkillPoints(5);
                        snapshotState.skillCountBefore = getPlayerSkillCount();
                    },
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Buy a Skill',
                    text: '\uD83C\uDF1F <strong>Buy a skill now!</strong> Try <strong>Keen Eye</strong> (reveals prices), <strong>Charming</strong> (+25% relationships), or <strong>Haggling</strong> (better trade prices). Each costs <strong>3 SP</strong>.',
                    waitFor: function () {
                        return getPlayerSkillCount() > (snapshotState.skillCountBefore || 0);
                    }
                },
                {
                    title: 'XP & Leveling',
                    text: '\uD83D\uDCC8 Earn <strong>XP</strong> from trading (1 per 50g), jobs, and kingdom orders. <strong>10 levels</strong>, 3 SP each. <strong>Invest in skills early</strong> \u2014 they compound your earnings over time!'
                },
                {
                    title: 'Skill Inheritance',
                    text: '\uD83D\uDC51 Plan for the future! <strong>Legacy of Trust</strong> (Social branch) boosts reputation inheritance from 15% to <strong>50%</strong>. <strong>Dynasty Founder</strong> gives your heir +1 SP to start. Skills reset on inheritance, but these investments make your dynasty grow stronger each generation.'
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
                    text: '\uD83D\uDC51 Click <strong>\uD83D\uDC64 Character</strong> to view your rank. <strong>7 ranks</strong>:<br>\uD83C\uDF3E Peasant \u2192 \uD83C\uDFE0 Citizen \u2192 \u2696\uFE0F Burgher \u2192 \uD83D\uDD28 Guildmaster \u2192 \uD83D\uDC51 Noble \u2192 \uD83C\uDFF0 Lord \u2192 \uD83D\uDCDC Royal Advisor<br>Each unlocks more buildings, workers, and political power.',
                    highlight: '#btnCharacter',
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Climbing the Ranks',
                    text: '\uD83D\uDCCB Advancement needs <strong>gold, reputation, and achievements</strong>:<br>\u2022 <strong>Citizen</strong>: 1,000g + 40 rep + 90 days residency<br>\u2022 <strong>Guildmaster</strong>: 20,000g + 75 rep + 3 buildings in 2+ towns<br>\u2022 <strong>Royal Advisor</strong>: 600,000g + 100 rep + Lord for 3+ years'
                },
                {
                    title: 'Multi-Kingdom Play',
                    text: '\uD83C\uDF0D Hold rank in <strong>multiple kingdoms</strong>! Become Citizen anywhere to gain citizenship. If two of your kingdoms go to <strong>war</strong>, you must pick a side \u2014 losing 30 rep in the other.',
                    onEnter: function () { closeModal(); }
                },
                {
                    title: 'Petitions & Influence',
                    text: '\uD83D\uDCDC Click <strong>\uD83D\uDC51 Kingdoms</strong> to open the kingdom panel. As Citizen+, you can create <strong>petitions</strong> to influence the king \u2014 build roads, lower taxes, ban goods, or declare war! Look for the <strong>Petitions</strong> section inside. Gather NPC signatures and submit. <strong>Royal Advisors</strong> can propose laws directly.',
                    highlight: '#btnKingdoms',
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Kingdom Orders',
                    text: '\uD83D\uDC51 Kingdoms post <strong>procurement orders</strong> \u2014 guaranteed sales at fixed prices, often above market. Scroll down in the town detail and find <strong>📋 Kingdom Orders</strong> under ⚒️ Actions. Open it to see the orders the crown needs filled!',
                    highlight: '#btnKingdoms',
                    onEnter: function () { closeModal(); },
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Royal Commissions',
                    text: '📜 The king also posts <strong>Royal Commissions</strong> \u2014 one-off requests with gold + reputation rewards. Find the <strong>📦 Commissions</strong> button in the town detail (just above Market Prices). These are great for building reputation early!',
                    onEnter: function () { closeModal(); },
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Kingdom Laws',
                    text: '\uD83D\uDCDC Every kingdom has <strong>laws</strong> set by the king that affect your business! Click a town on the map, then find <strong>\uD83D\uDCDC Laws</strong> in the town detail to see current taxes, trade restrictions, and special policies like <strong>Open Market</strong>, <strong>Forced Requisition</strong>, or <strong>Exclusive Citizenship</strong>. Laws change based on the king\u2019s mood and personality!',
                    onEnter: function () { closeModal(); }
                },
                {
                    title: 'King Personality & Mood',
                    text: '\uD83D\uDC51 Each king has a <strong>personality</strong> (Generous, Warlike, Greedy, etc.) that influences their decisions. The king\u2019s <strong>mood</strong> fluctuates based on kingdom wealth, wars, and events \u2014 affecting taxes, laws, and war declarations. A happy king means lower taxes and more trade-friendly policies!'
                },
                {
                    title: 'Succession',
                    text: '\u2620\uFE0F When a king <strong>dies</strong>, the crown passes to their heir. The new king may have a completely different personality \u2014 changing laws, taxes, and alliances overnight! A <strong>Succession Crisis</strong> can occur if there\u2019s no clear heir, causing instability. Watch for these events \u2014 they create massive trading opportunities.'
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
                    text: '\u2694\uFE0F <strong>Wars</strong> erupt when kingdom relations drop below \u221235. <strong>Frontline zones</strong> (500px radius) have 25% daily ambush chance \u2014 extremely dangerous but massively profitable for war suppliers.'
                },
                {
                    title: 'Arm Yourself',
                    text: '\u2694\uFE0F We\u2019ve <strong>equipped you with a sword and armor</strong>. Open <strong>\uD83D\uDC64 Character</strong> to see your gear! Equipment improves your <strong>combat rating</strong> for bandit encounters, military service, and resisting forced requisition. You can buy better gear from the <strong>Character panel</strong> when a town\u2019s market sells weapons. Better gear = better survival.',
                    highlight: '#btnCharacter',
                    onEnter: function () {
                        // Equip directly since equipWeapon() buys from market, not inventory
                        try {
                            Player.state.weapon = { id: 'iron_sword', name: 'Iron Sword', quality: 'standard', combatBonus: 0.15 };
                            Player.state.armor = { id: 'leather_armor', name: 'Leather Armor', quality: 'standard', combatBonus: 0.10 };
                        } catch (e) { console.error('Tutorial equip error:', e); }
                    },
                    waitFor: function () {
                        try { return Player.state.weapon || Player.state.armor; } catch (e) { return false; }
                    },
                    skipAfter: 10000
                },
                {
                    title: 'Military Enlistment',
                    text: '\u2694\uFE0F <strong>Enlist</strong> during wartime! Normal enlistment has <strong>4 ranks</strong>: Militiaman \u2192 Footman \u2192 Sergeant \u2192 <strong>Knight</strong> (max). Reaching Knight auto-grants <strong>Citizen status</strong>! The unique <strong>Military Leader</strong> start unlocks 3 higher ranks: Captain \u2192 Commander \u2192 General.'
                },
                {
                    title: 'Conscription',
                    text: '\uD83D\uDEA8 During wartime, kingdoms may <strong>draft citizens</strong> into military service! Higher social rank makes you less likely to be conscripted \u2014 <strong>Minor Nobles and above are exempt</strong>. If drafted, you\u2019ll serve for a set period and risk combat. The <strong>Political Connections</strong> skill reduces your draft chance. Plan accordingly when wars break out!'
                },
                {
                    title: 'War Profiteering',
                    text: '\uD83D\uDCB0 Kingdoms need <strong>swords, armor, food, and horses</strong> during wars \u2014 prices spike! Selling to enemies is <strong>War Profiteering</strong> (30 days jail if caught). Add <strong>armed escorts</strong> (20g/day) to reduce ambush chance by 15%.'
                },
                {
                    title: 'Naval & Bridge Warfare',
                    text: '\uD83D\uDEA2 Ships can be <strong>armed</strong> during wartime with cannons and reinforced hulls. Naval battles determine sea route control. Destroying enemy <strong>bridges</strong> cripples their trade and costs the kingdom dearly to rebuild!'
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
                    text: '\u26F5 Buy ships at port towns:<br>\u2022 <strong>Small Ship</strong> (200g): Basic sea travel, 1.5x speed<br>\u2022 <strong>Large Ship</strong> (500g): More cargo, better storm resistance<br>Equip <strong>addons</strong> like extra sails, reinforced hulls, and cargo holds.'
                },
                {
                    title: 'Ship Addons & Repair',
                    text: '\u2693 Ships have <strong>addon slots</strong> for upgrades:<br>\u2022 \uD83D\uDCA8 <strong>Extra Sails</strong>: +speed<br>\u2022 \uD83D\uDEE1\uFE0F <strong>Reinforced Hull</strong>: +storm resistance<br>\u2022 \uD83D\uDCE6 <strong>Cargo Hold</strong>: +capacity<br>Ships take <strong>hull damage</strong> from storms and combat. Repair at port towns before your ship sinks! Hull health is shown in your ship panel.'
                },
                {
                    title: 'Sea Routes & Fishing',
                    text: '\uD83C\uDF0A <strong>Sea routes</strong> connect port towns for fast oceanic trade. At <strong>Guildmaster</strong> rank with a ship, you can build new sea routes from the town \u2699\uFE0F Actions panel. <strong>Storms</strong> risk cargo loss. <strong>Fishing</strong> provides food and extra income \u2014 a great side business for port-based merchants.'
                },
                {
                    title: 'Fleet Management',
                    text: '\uD83D\uDEA2 At higher ranks, build a <strong>fleet</strong> for simultaneous sea routes. The <strong>Fleet Admiral</strong> skill reduces ship costs and boosts crew efficiency. Control the seas = control long-distance trade!'
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
                    text: '\uD83D\uDC34 <strong>Caravans</strong> send goods between towns automatically! Add <strong>armed escorts</strong> (20g/day) to reduce bandit ambush chance. Bandits attack 3%/day on roads, +15% for military goods.',
                    highlight: '#btnCaravan'
                },
                {
                    title: 'Toll Roads',
                    text: '\uD83D\uDEE4\uFE0F At <strong>Guildmaster rank</strong>, build toll roads (5,000g+). Every merchant using your road pays a toll! Set rates (1\u201350g) \u2014 higher tolls earn more but may discourage traffic.'
                },
                {
                    title: 'Elite Merchants & Competition',
                    text: '\uD83E\uDD16 <strong>Elite NPC merchants</strong> are fierce rivals \u2014 they build, trade, hire, and poach your workers! Watch the <strong>Leaderboard</strong> to track competition. Counter their moves and outmaneuver them.'
                },
                {
                    title: 'Outposts & Expansion',
                    text: '\uD83C\uDFD5\uFE0F Click <strong>\uD83C\uDFE0 Buildings</strong> to open the building manager \u2014 look for the <strong>\u26FA Wilderness Outposts</strong> section. Outposts extend your trade network into remote areas, providing storage, rest, and a foothold in new territories. They cost 500g + materials (wood, stone) to found and can grow into full towns! Combine with toll roads and caravans for a self-sustaining empire.',
                    highlight: '#btnBuildings',
                    waitFor: function () { return isModalOpen(); }
                }
            ]
        },

        // ── Chapter 14: Mastery & Endgame ─────────────────────
        {
            title: 'Mastery & Endgame',
            part: 'advanced',
            steps: [
                {
                    title: 'Dark Deeds & Schemes',
                    text: '\uD83D\uDEA8 The <strong>\uD83D\uDD75\uFE0F Schemes</strong> panel lets you plot sabotage, political schemes, assassinations, tax evasion, and market manipulation. 5 categories of crime \u2014 high risk, high reward! Hover over each tab to see what\u2019s available. Some require <strong>Underworld skills</strong>. Click <strong>\uD83D\uDD75\uFE0F Schemes</strong> to take a look!',
                    highlight: '#btnSchemes',
                    waitFor: function () { return isModalOpen(); },
                    skipAfter: 8000
                },
                {
                    title: 'The Leaderboard',
                    text: '\uD83C\uDFC6 Click <strong>\uD83C\uDFC6 Rankings</strong> to see the top merchants! The <strong>Leaderboard</strong> tracks the top 10 by <strong>net worth</strong> (gold + buildings + inventory + ships + routes). Compete against elite NPCs for the #1 spot!',
                    highlight: '#btnRankings',
                    waitFor: function () { return isModalOpen(); }
                },
                {
                    title: 'Advanced Strategies',
                    text: '\uD83D\uDCC8 <strong>Pro tips</strong>:<br>\u2022 <strong>Manipulate markets</strong> \u2014 buy out a town\u2019s stock to spike prices<br>\u2022 <strong>Watch seasonal prices</strong> \u2014 buy grain after harvest, sell in winter<br>\u2022 <strong>Invest in skills early</strong> \u2014 they compound over time<br>\u2022 <strong>Control supply chains</strong> end-to-end for maximum profit'
                },
                {
                    title: 'Endgame Goals',
                    text: '\uD83C\uDFC6 <strong>Ultimate goals</strong>:<br>\u2022 \uD83D\uDC51 Reach <strong>Royal Advisor</strong> in multiple kingdoms<br>\u2022 \uD83C\uDFF0 Own buildings in every town<br>\u2022 \uD83D\uDEE4\uFE0F Build a toll road network spanning the map<br>\u2022 \uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66 Found a dynasty lasting 3+ generations<br>\u2022 \uD83C\uDFC6 Top the leaderboard as #1 merchant'
                },
                {
                    title: 'Congratulations!',
                    text: '\uD83C\uDF89 <strong>You\u2019ve completed the full tutorial!</strong> You know every system in Merchant Realms. Diversify across kingdoms, time seasonal trades, invest in skills, marry for dynasty, and watch the leaderboard. <strong>Now go build your trade empire!</strong>',
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
                btnNext.disabled = true;
                btnNext.style.opacity = '0.5';
                btnNext.style.cursor = 'not-allowed';
                btnNext.textContent = '\u23F3 Complete the action above...';
            }
            btnNext.addEventListener('click', function () {
                if (btnNext.disabled) return;
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
        }
        highlightedEls = [];
    }

    function highlightElement(selector) {
        clearHighlights();
        if (!selector) return;
        try {
            var els = document.querySelectorAll(selector);
            for (var i = 0; i < els.length; i++) {
                els[i].classList.add('tutorial-highlight');
                highlightedEls.push(els[i]);
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

        // Start watching if step has waitFor
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

    // ═══════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════════

    return {
        start: start,
        isActive: function () { return active; },
        nextStep: nextStep,
        prevStep: prevStep,
        skip: end,
        cleanup: cleanup,
        getCurrentChapter: function () { return currentChapter; },
        getCurrentStep: function () { return currentStep; }
    };
})();