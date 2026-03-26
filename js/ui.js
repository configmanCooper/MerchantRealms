// ============================================================
// Merchant Realms — UI Panels, HUD, Dialogs, Menus
// ============================================================

window.UI = (function () {
    'use strict';

    // ── Utility ──
    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ── Element references ──
    const el = {};
    let notifications = [];
    let _lastSeenEventCount = 0;
    let toastId = 0;
    let _eventsInitialized = false;
    let selectedPersonId = null;

    // ═══════════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════════

    function init() {
        // Cache DOM elements
        el.titleScreen = document.getElementById('titleScreen');
        el.topBar = document.getElementById('topBar');
        el.leftPanel = document.getElementById('leftPanel');
        el.rightPanel = document.getElementById('rightPanel');
        el.rightPanelTitle = document.getElementById('rightPanelTitle');
        el.rightPanelBody = document.getElementById('rightPanelBody');
        el.bottomBar = document.getElementById('bottomBar');
        el.modalOverlay = document.getElementById('modalOverlay');
        el.modalTitle = document.getElementById('modalTitle');
        el.modalBody = document.getElementById('modalBody');
        el.modalFooter = document.getElementById('modalFooter');
        el.toastContainer = document.getElementById('toastContainer');
        el.tooltip = document.getElementById('tooltip');
        el.contextMenu = document.getElementById('contextMenu');
        el.endScreen = document.getElementById('endScreen');

        // HUD elements
        el.dayDisplay = document.getElementById('dayDisplay');
        el.playerGold = document.getElementById('playerGold');
        el.playerTown = document.getElementById('playerTown');
        el.reputationBars = document.getElementById('reputationBars');
        el.notorietyFill = document.getElementById('notorietyFill');
        el.notorietyValue = document.getElementById('notorietyValue');
        el.employeeCount = document.getElementById('employeeCount');
        el.buildingCount = document.getElementById('buildingCount');
        el.caravanCount = document.getElementById('caravanCount');
        el.quickInventory = document.getElementById('quickInventory');
        el.winProgress = document.getElementById('winProgress');
        el.notifCount = document.getElementById('notifCount');
        el.playerCharInfo = document.getElementById('playerCharInfo');
        el.playerName = document.getElementById('playerName');
        el.playerEquipSection = document.getElementById('playerEquipSection');
        el.playerEquipInfo = document.getElementById('playerEquipInfo');

        if (!_eventsInitialized) {
            bindEvents();
            _eventsInitialized = true;
        }

        // Remove any existing dynamically-created elements to prevent duplication on load
        ['btnWork','btnStreet','btnBuildings','btnRoutes','btnHousing','btnRest','btnTalk','btnSkills','btnAchievements','btnRankings','btnSchemes','btnHelp','btnFamily'].forEach(id => {
            const existing = document.getElementById(id);
            if (existing) existing.remove();
        });
        // Remove any stale dividers from previous layout
        document.querySelectorAll('.action-buttons > .btn-group-divider').forEach(d => d.remove());
        const existingXp = document.getElementById('xpBarGroup');
        if (existingXp) existingXp.remove();
        const existingHunger = document.getElementById('hungerBarGroup');
        if (existingHunger) existingHunger.remove();
        const existingFatigue = document.getElementById('fatigueBarGroup');
        if (existingFatigue) existingFatigue.remove();
        const existingThirst = document.getElementById('thirstBarGroup');
        if (existingThirst) existingThirst.remove();

        // Dynamically add buttons to bottom bar rows
        const actionButtons = document.querySelector('.action-buttons');
        if (actionButtons) {
            const rowActions = document.getElementById('barRowActions');
            const rowManage = document.getElementById('barRowManage');
            const rowWorld = document.getElementById('barRowWorld');

            // === Row 1: Actions (Trade, Build, Hire already static) ===

            // Work button → Actions row
            const btnWork = document.createElement('button');
            btnWork.className = 'btn-action';
            btnWork.id = 'btnWork';
            btnWork.title = 'Find Work';
            btnWork.textContent = '💼 Work';
            btnWork.addEventListener('click', openWorkDialog);
            if (rowActions) rowActions.appendChild(btnWork);

            // Street Trading button → Actions row
            const btnStreet = document.createElement('button');
            btnStreet.className = 'btn-action';
            btnStreet.id = 'btnStreet';
            btnStreet.title = 'Street Trading';
            btnStreet.textContent = '🤝 Street';
            btnStreet.addEventListener('click', openStreetTrading);
            if (rowActions) rowActions.appendChild(btnStreet);

            // Housing button → Actions row
            const btnHousing = document.createElement('button');
            btnHousing.className = 'btn-action';
            btnHousing.id = 'btnHousing';
            btnHousing.title = 'Housing & Property';
            btnHousing.textContent = '🏡 Housing';
            btnHousing.addEventListener('click', openHousingDialog);
            if (rowActions) rowActions.appendChild(btnHousing);

            // Rest button → Actions row
            const btnRest = document.createElement('button');
            btnRest.className = 'btn-action';
            btnRest.id = 'btnRest';
            btnRest.title = 'Rest & Recovery';
            btnRest.textContent = '💤 Rest';
            btnRest.addEventListener('click', openRestDialog);
            if (rowActions) rowActions.appendChild(btnRest);

            // Talk to Townsfolk button → Actions row
            const btnTalk = document.createElement('button');
            btnTalk.className = 'btn-action';
            btnTalk.id = 'btnTalk';
            btnTalk.title = 'Talk to Townsfolk';
            btnTalk.textContent = '💬 Talk';
            btnTalk.addEventListener('click', talkToTownsfolk);
            if (rowActions) rowActions.appendChild(btnTalk);

            // === Row 2: Manage (Character, Caravan already static) ===

            // Buildings Management button → Manage row
            const btnBuildings = document.createElement('button');
            btnBuildings.className = 'btn-action';
            btnBuildings.id = 'btnBuildings';
            btnBuildings.title = 'Manage Buildings';
            btnBuildings.textContent = '🏠 Buildings';
            btnBuildings.addEventListener('click', openBuildingManagement);
            if (rowManage) rowManage.appendChild(btnBuildings);

            // Toll Routes button → Manage row
            const btnRoutes = document.createElement('button');
            btnRoutes.className = 'btn-action';
            btnRoutes.id = 'btnRoutes';
            btnRoutes.title = 'Toll Routes';
            btnRoutes.textContent = '🛤️ Routes';
            btnRoutes.addEventListener('click', showTollRoutesPanel);
            if (rowManage) rowManage.appendChild(btnRoutes);

            // Skills → Manage row
            const btnSkills = document.createElement('button');
            btnSkills.className = 'btn-action';
            btnSkills.id = 'btnSkills';
            btnSkills.title = 'Skills';
            btnSkills.textContent = '📚 Skills';
            btnSkills.addEventListener('click', openSkillsDialog);
            if (rowManage) rowManage.appendChild(btnSkills);

            // Family button → Manage row (hidden until player has family)
            const btnFamily = document.createElement('button');
            btnFamily.className = 'btn-action';
            btnFamily.id = 'btnFamily';
            btnFamily.title = 'Family';
            btnFamily.textContent = '👨‍👩‍👧‍👦 Family';
            btnFamily.addEventListener('click', openFamilyPanel);
            btnFamily.style.display = 'none';
            if (rowManage) rowManage.appendChild(btnFamily);

            // === Row 3: World (Kingdoms, Map, Log already static) ===

            // Feats → World row
            const btnAchievements = document.createElement('button');
            btnAchievements.className = 'btn-action';
            btnAchievements.id = 'btnAchievements';
            btnAchievements.title = 'Achievements';
            btnAchievements.textContent = '🏆 Feats';
            btnAchievements.addEventListener('click', openAchievementsDialog);
            if (rowWorld) rowWorld.appendChild(btnAchievements);

            // Rankings → World row
            const btnRankings = document.createElement('button');
            btnRankings.className = 'btn-action';
            btnRankings.id = 'btnRankings';
            btnRankings.title = 'Rankings';
            btnRankings.textContent = '🏆 Rankings';
            btnRankings.addEventListener('click', openLeaderboard);
            if (rowWorld) rowWorld.appendChild(btnRankings);

            // Help button → World row
            const btnHelp = document.createElement('button');
            btnHelp.className = 'btn-action btn-action-help';
            btnHelp.id = 'btnHelp';
            btnHelp.title = 'Help (F1)';
            btnHelp.textContent = '❓ Help';
            btnHelp.addEventListener('click', openHelpDialog);
            if (rowWorld) rowWorld.appendChild(btnHelp);

            // Schemes (Dark Deeds) button → Actions row, initially hidden
            const btnSchemes = document.createElement('button');
            btnSchemes.className = 'btn-action btn-action-schemes';
            btnSchemes.id = 'btnSchemes';
            btnSchemes.title = 'Dark Deeds';
            btnSchemes.textContent = '🗡️ Schemes';
            btnSchemes.style.display = 'none';
            btnSchemes.addEventListener('click', openSchemesDialog);
            if (rowActions) rowActions.appendChild(btnSchemes);
        }

        // Dynamically add XP bar and hunger bar containers to left panel
        const leftPanelBody = document.getElementById('leftPanelBody');
        if (leftPanelBody) {
            // Add XP bar after gold
            const goldGroup = leftPanelBody.querySelector('.stat-group:nth-child(3)');
            if (goldGroup) {
                const xpGroup = document.createElement('div');
                xpGroup.className = 'stat-group';
                xpGroup.id = 'xpBarGroup';
                xpGroup.innerHTML = `
                    <div class="stat-label">Experience</div>
                    <div id="xpBarContainer" class="xp-bar-container">
                        <div id="xpBarFill" class="xp-bar-fill"></div>
                        <span id="xpBarLabel" class="xp-bar-label">Level 1 Novice Trader</span>
                    </div>
                    <div id="xpBarDetail" class="xp-bar-detail"></div>
                `;
                goldGroup.after(xpGroup);
            }

            // Add hunger bar after notoriety
            const notorietyGroup = leftPanelBody.querySelector('.stat-group:nth-child(7)');
            const insertPoint = notorietyGroup || leftPanelBody.lastElementChild;
            if (insertPoint) {
                const hungerGroup = document.createElement('div');
                hungerGroup.className = 'stat-group';
                hungerGroup.id = 'hungerBarGroup';
                hungerGroup.innerHTML = `
                    <div class="stat-label">Hunger</div>
                    <div class="meter-container">
                        <div id="hungerMeter" class="meter hunger-meter">
                            <div id="hungerFill" class="meter-fill" style="width:80%"></div>
                        </div>
                        <span id="hungerValue" class="meter-label">🍖 80</span>
                    </div>
                    <div id="foodSupplyRow" class="supply-row">
                        <span id="foodSupplyInfo" class="supply-info">🍞 0 food (~0d)</span>
                        <button id="btnEatUntilFull" class="btn-supply" title="Eat from inventory until full" onclick="UI.eatUntilFull()">🍴 Eat</button>
                    </div>
                `;
                insertPoint.after(hungerGroup);

                // Add energy bar after hunger (replaces old fatigue bar)
                const fatigueGroup = document.createElement('div');
                fatigueGroup.className = 'stat-group';
                fatigueGroup.id = 'fatigueBarGroup';
                fatigueGroup.innerHTML = `
                    <div class="stat-label">Energy</div>
                    <div class="meter-container">
                        <div id="fatigueMeter" class="meter">
                            <div id="fatigueFill" class="meter-fill" style="width:100%;background:#55a868"></div>
                        </div>
                        <span id="fatigueValue" class="meter-label">⚡ 100</span>
                    </div>
                `;
                hungerGroup.after(fatigueGroup);

                // Add thirst bar after energy
                const thirstGroup = document.createElement('div');
                thirstGroup.className = 'stat-group';
                thirstGroup.id = 'thirstBarGroup';
                thirstGroup.innerHTML = `
                    <div class="stat-label">Thirst</div>
                    <div class="meter-container">
                        <div id="thirstMeter" class="meter">
                            <div id="thirstFill" class="meter-fill" style="width:80%;background:#4488cc"></div>
                        </div>
                        <span id="thirstValue" class="meter-label">💧 80</span>
                    </div>
                    <div id="drinkSupplyRow" class="supply-row">
                        <span id="drinkSupplyInfo" class="supply-info">🫗 0 drinks (~0d)</span>
                        <button id="btnDrinkUntilFull" class="btn-supply" title="Drink from inventory until full" onclick="UI.drinkUntilFull()">🥤 Drink</button>
                    </div>
                `;
                fatigueGroup.after(thirstGroup);

                // Add health bar after thirst
                const healthGroup = document.createElement('div');
                healthGroup.className = 'stat-group';
                healthGroup.id = 'healthBarGroup';
                healthGroup.innerHTML = `
                    <div class="stat-label">Health</div>
                    <div class="meter-container">
                        <div id="healthMeter" class="meter">
                            <div id="healthFill" class="meter-fill" style="width:100%;background:#55a868"></div>
                        </div>
                        <span id="healthValue" class="meter-label">❤️ 100/100</span>
                    </div>
                `;
                thirstGroup.after(healthGroup);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  EVENT BINDING
    // ═══════════════════════════════════════════════════════════

    function bindEvents() {
        // Close buttons (null-safe)
        const btnCloseRight = document.getElementById('btnCloseRight');
        const btnCloseModal = document.getElementById('btnCloseModal');
        if (btnCloseRight) btnCloseRight.addEventListener('click', closeRightPanel);
        if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
        if (el.modalOverlay) {
            el.modalOverlay.addEventListener('click', function (e) {
                if (e.target === el.modalOverlay) closeModal();
            });
        }

        // Speed controls
        document.querySelectorAll('.btn-speed').forEach(btn => {
            btn.addEventListener('click', function () {
                const speed = parseInt(this.dataset.speed);
                if (typeof Game !== 'undefined') Game.setSpeed(speed);
                document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Action buttons (null-safe)
        const actionBtns = {
            btnTrade: openTradeDialog,
            btnBuild: openBuildDialog,
            btnHire: openHireDialog,
            btnCaravan: openCaravanDialog,
            btnCharacter: openCharacterDialog,
            btnMap: openMapView,
            btnLog: openEventLog,
            btnSettings: openSettings
        };
        for (const [id, handler] of Object.entries(actionBtns)) {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', handler);
        }
        const btnKingdoms = document.getElementById('btnKingdoms');
        if (btnKingdoms) btnKingdoms.addEventListener('click', openKingdomsDialog);

        // Save button
        const btnSave = document.getElementById('btnSave');
        if (btnSave) {
            btnSave.addEventListener('click', function () {
                if (typeof Game !== 'undefined' && Game.save) Game.save();
            });
        }

        const btnLoad = document.getElementById('btnLoad');
        if (btnLoad) {
            btnLoad.addEventListener('click', function () {
                if (typeof Game !== 'undefined' && Game.load) Game.load();
            });
        }

        const btnMainMenu = document.getElementById('btnMainMenu');
        if (btnMainMenu) {
            btnMainMenu.addEventListener('click', function () {
                if (confirm('Return to main menu? Unsaved progress will be lost!')) {
                    if (typeof Game !== 'undefined' && Game.showTitleScreen) Game.showTitleScreen();
                }
            });
        }

        // Zoom buttons
        const btnZoomIn = document.getElementById('btnZoomIn');
        const btnZoomOut = document.getElementById('btnZoomOut');
        if (btnZoomIn) btnZoomIn.addEventListener('click', () => Renderer.zoomAt(-100, CONFIG.VIEWPORT_WIDTH / 2, CONFIG.VIEWPORT_HEIGHT / 2));
        if (btnZoomOut) btnZoomOut.addEventListener('click', () => Renderer.zoomAt(100, CONFIG.VIEWPORT_WIDTH / 2, CONFIG.VIEWPORT_HEIGHT / 2));

        // Player name → zoom to player
        const playerNameEl = document.getElementById('playerName');
        if (playerNameEl) {
            playerNameEl.classList.add('player-name-clickable');
            playerNameEl.addEventListener('click', locatePlayer);
        }

        // Locate button
        const btnLocate = document.getElementById('btnLocate');
        if (btnLocate) btnLocate.addEventListener('click', locatePlayer);

        // Collapse left panel
        const collapseBtn = document.querySelector('.btn-collapse');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', function () {
                const body = document.getElementById('leftPanelBody');
                if (!body) return;
                body.classList.toggle('collapsed');
                this.textContent = body.classList.contains('collapsed') ? '▶' : '◀';
            });
        }

        // Notification bell (null-safe)
        const notifBell = document.getElementById('notificationBell');
        if (notifBell) notifBell.addEventListener('click', openEventLog);

        // Hide context menu on click elsewhere
        document.addEventListener('click', function () {
            hideContextMenu();
        });

        // Hide tooltip on scroll/move
        document.addEventListener('keydown', function () {
            hideTooltip();
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  SHOW / HIDE UI
    // ═══════════════════════════════════════════════════════════

    function showGameUI() {
        el.titleScreen.classList.add('hidden');
        el.titleScreen.style.display = 'none';
        el.topBar.classList.remove('hidden');
        el.leftPanel.classList.remove('hidden');
        el.bottomBar.classList.remove('hidden');
    }

    function hideGameUI() {
        el.topBar.classList.add('hidden');
        el.leftPanel.classList.add('hidden');
        el.bottomBar.classList.add('hidden');
        el.rightPanel.classList.add('hidden');
        closeModal();
        // Hide god mode panel if open
        var godPanel = document.getElementById('god-mode-panel');
        if (godPanel) godPanel.style.display = 'none';
    }

    // ═══════════════════════════════════════════════════════════
    //  HUD UPDATE (called every frame or on tick)
    // ═══════════════════════════════════════════════════════════

    function update() {
        if (!el.dayDisplay) return;

        // Check for pending war conflict choice
        if (typeof Player !== 'undefined' && Player.getPendingWarChoice && Player.getPendingWarChoice()) {
            showWarConflictChoice();
        }

        // Check for conquest events affecting player
        try { checkConquestEvents(); } catch (e) { /* no-op */ }

        // Handle regency overlay
        if (typeof Player !== 'undefined' && Player.regencyMode) {
            updateRegencyOverlay();
        } else {
            hideRegencyOverlay();
        }

        try {
            // Day / Season / Year
            const day = Engine.getDay ? Engine.getDay() : 1;
            const season = Engine.getSeason ? Engine.getSeason() : 'Spring';
            const year = Engine.getYear ? Engine.getYear() : 1;
            var hour = Engine.getHour ? Engine.getHour() : 12;
            var isNight = hour >= 20 || hour < 5;
            var timeIcon = isNight ? '🌙' : '☀️';
            el.dayDisplay.textContent = `${timeIcon} Day ${day} — ${season}, Year ${year}`;

            // Update zoom display
            const zoomEl = document.getElementById('zoomLevel');
            if (zoomEl && typeof Renderer !== 'undefined' && Renderer.getCamera) {
                const cam = Renderer.getCamera();
                zoomEl.textContent = `${cam.zoom.toFixed(1)}×`;
            }

            // Player info
            if (typeof Player !== 'undefined') {
                el.playerGold.textContent = `🪙 ${formatGold(Player.gold)}`;

                // Player name and character info
                if (el.playerName) {
                    el.playerName.textContent = Player.fullName || 'Merchant';
                }
                if (el.playerCharInfo) {
                    const sexIcon = Player.sex === 'F' ? '♀' : '♂';
                    let charInfo = `${sexIcon} Age ${Player.age || '?'}`;
                    // Show rank (primary kingdom or highest rank)
                    if (CONFIG.SOCIAL_RANKS) {
                        let displayRankIdx = 0;
                        if (Player.citizenshipKingdomId && Player.socialRank) {
                            displayRankIdx = Player.socialRank[Player.citizenshipKingdomId] || 0;
                        }
                        // Also check for higher rank in any kingdom
                        if (Player.socialRank) {
                            for (const kId in Player.socialRank) {
                                if ((Player.socialRank[kId] || 0) > displayRankIdx) displayRankIdx = Player.socialRank[kId];
                            }
                        }
                        const rank = CONFIG.SOCIAL_RANKS[displayRankIdx];
                        if (rank) charInfo += ` | ${rank.icon} ${rank.name}`;
                    }
                    if (Player.spouseId) {
                        let spouseName = '';
                        try {
                            const spouse = Engine.findPerson(Player.spouseId);
                            if (spouse) spouseName = spouse.firstName;
                        } catch (e) { /* no-op */ }
                        if (spouseName) charInfo += ` | 💍 ${spouseName}`;
                    }
                    if (Player.childrenIds && Player.childrenIds.length > 0) {
                        charInfo += ` | 👶 ${Player.childrenIds.length}`;
                    }
                    el.playerCharInfo.textContent = charInfo;
                }

                // Equipment display
                if (el.playerEquipSection && el.playerEquipInfo) {
                    if (Player.weapon || Player.armor) {
                        el.playerEquipSection.style.display = '';
                        let equipText = '';
                        if (Player.weapon) equipText += '⚔️ Sword';
                        if (Player.weapon && Player.armor) equipText += ' | ';
                        if (Player.armor) equipText += '🛡️ Armor';
                        el.playerEquipInfo.textContent = equipText;
                    } else {
                        el.playerEquipSection.style.display = 'none';
                    }
                }

                // Conquest servitude status display
                var servStatusEl = document.getElementById('conquestServitudeStatus');
                if (!servStatusEl) {
                    // Create if missing
                    var equipSec = el.playerEquipSection;
                    if (equipSec && equipSec.parentNode) {
                        servStatusEl = document.createElement('div');
                        servStatusEl.id = 'conquestServitudeStatus';
                        servStatusEl.className = 'panel-row';
                        servStatusEl.style.color = '#c44e52';
                        equipSec.parentNode.insertBefore(servStatusEl, equipSec.nextSibling);
                    }
                }
                if (servStatusEl) {
                    if (Player.conquestServitude && Player.conquestServitude.active) {
                        var daysRemain = Math.max(0, Player.conquestServitude.servitudeEndDay - Engine.getDay());
                        var cost = Player.conquestServitude.freedomCost || CONFIG.SERVITUDE_FREEDOM_COST;
                        servStatusEl.style.display = '';
                        servStatusEl.innerHTML = '⛓️ Indentured Servant (' + daysRemain + ' days remaining)' +
                            (Player.gold >= cost ? ' <button onclick="UI.buyFreedomUI()" style="margin-left:6px;font-size:11px;cursor:pointer">Pay ' + cost + 'g for freedom</button>' : '');
                    } else {
                        servStatusEl.style.display = 'none';
                    }
                }

                // Current town
                if (Player.townId != null) {
                    let town;
                    try { town = Engine.getTown(Player.townId); } catch (e) { /* no-op */ }
                    if (!town) {
                        const towns = Engine.getTowns();
                        town = towns ? towns.find(t => t.id === Player.townId) : null;
                    }
                    el.playerTown.textContent = town ? town.name : 'Unknown';
                } else if (Player.traveling) {
                    var travelModeIcon = '🚶';
                    if (Player.travelMode === 'horse') travelModeIcon = '🐴';
                    else if (Player.travelMode === 'sail_own' || Player.travelMode === 'sea_passage') travelModeIcon = '⛵';
                    else if (Player.travelMode === 'npc_carriage') travelModeIcon = '🏇';
                    else if (Player.travelMode === 'npc_luxury') travelModeIcon = '🎪';
                    else if (Player.travelMode === 'kingdom') travelModeIcon = '👑';
                    else if (Player.travelMode === 'npc_vessel') travelModeIcon = '⛴️';
                    else if (Player.travelBySea) travelModeIcon = '⛵';
                    else if (Player.travelOffroad) travelModeIcon = '🥾';
                    var travelText = travelModeIcon + ' Traveling...';
                    if (!Player.travelPaid) {
                        travelText += ' ';
                        el.playerTown.innerHTML = travelText + '<span onclick="UI.turnBackUI()" style="cursor:pointer;font-size:0.75rem;background:rgba(200,150,50,0.2);border:1px solid rgba(200,150,50,0.4);border-radius:4px;padding:1px 6px;margin-left:4px;">🔄 Turn Back</span>';
                    } else {
                        el.playerTown.textContent = travelText;
                    }
                } else {
                    el.playerTown.textContent = '🏕️ Wilderness';
                }

                // Employees, buildings, caravans
                el.employeeCount.textContent = Player.employees ? Player.employees.length : 0;
                el.buildingCount.textContent = Player.buildings ? Player.buildings.length : 0;
                el.caravanCount.textContent = Player.caravans ? Player.caravans.length : 0;

                // Notoriety meter
                const notoriety = Player.notoriety || 0;
                el.notorietyFill.style.width = notoriety + '%';
                el.notorietyValue.textContent = Math.floor(notoriety);
                if (notoriety >= CONFIG.NOTORIETY_DANGER_THRESHOLD) {
                    el.notorietyFill.style.background = '#c44e52';
                } else if (notoriety >= 30) {
                    el.notorietyFill.style.background = '#ccb974';
                } else {
                    el.notorietyFill.style.background = '#55a868';
                }

                // Reputation bars
                updateReputationBars();

                // Quick inventory
                updateQuickInventory();

                // Win progress
                updateWinProgress();

                // XP bar update
                updateXPBar();

                // Hunger bar update
                updateHungerBar();
                updateFatigueBar();
                updateHealthBar();

                // Rest button visibility — only show if fatigued
                const btnRest = document.getElementById('btnRest');
                if (btnRest) {
                    const playerFatigue = Player.fatigue || 0;
                    btnRest.style.display = playerFatigue > 30 ? '' : 'none';
                }

                // Schemes button visibility (with one-time unlock toast)
                const btnSchemes = document.getElementById('btnSchemes');
                const schemesDivider = document.getElementById('schemesDivider');
                if (btnSchemes) {
                    const shouldShow = Player.shouldShowSchemesButton();
                    btnSchemes.style.display = shouldShow ? '' : 'none';
                    if (schemesDivider) schemesDivider.style.display = shouldShow ? '' : 'none';
                    if (shouldShow && !window._schemesUnlockShown) {
                        window._schemesUnlockShown = true;
                        toast('🗡️ Dark Deeds unlocked! Your growing notoriety has attracted the criminal underworld.', 'warning');
                    }
                }

                // Pause indicator
                const pauseIndicator = document.getElementById('pauseIndicator');
                if (pauseIndicator) {
                    const isPaused = (typeof Game !== 'undefined' && Game.getState && Game.getState() === 'paused') ||
                                     (typeof Game !== 'undefined' && Game.getSpeed && Game.getSpeed() === 0);
                    pauseIndicator.style.display = isPaused ? '' : 'none';
                }
            }
        } catch (e) {
            // Silently handle missing engine/player during startup
        }

        // Special start status indicator
        var startStatusEl = document.getElementById('specialStartStatus');
        if (Player.getSpecialStartStatus) {
            var startStatus = Player.getSpecialStartStatus();
            if (startStatus) {
                if (!startStatusEl) {
                    startStatusEl = document.createElement('div');
                    startStatusEl.id = 'specialStartStatus';
                    startStatusEl.className = 'special-start-indicator';
                    startStatusEl.onclick = function() { openSpecialStartPanel(); };
                    var topBar = document.getElementById('topBar');
                    if (topBar) topBar.appendChild(startStatusEl);
                }
                startStatusEl.innerHTML = startStatus.icon + ' ' + startStatus.info;
                startStatusEl.style.display = '';
            } else if (startStatusEl) {
                startStatusEl.style.display = 'none';
            }
        }

        // Show family button if player has family
        var familyBtn = document.getElementById('btnFamily');
        if (familyBtn) {
            familyBtn.style.display = (Player.familyMembers && Player.familyMembers.length > 0) ? '' : 'none';
        }
    }

    function updateReputationBars() {
        if (!el.reputationBars) return;
        let kingdoms;
        try { kingdoms = Engine.getKingdoms(); } catch (e) { return; }
        if (!kingdoms) return;

        const rep = Player.reputation || {};
        let html = '';
        for (const kingdom of kingdoms) {
            const val = rep[kingdom.id] || 0;
            const color = kingdom.color || CONFIG.KINGDOM_COLORS[kingdom.id % CONFIG.KINGDOM_COLORS.length];
            const pct = Math.max(0, Math.min(100, (val + 100) / 2)); // -100..100 → 0..100
            html += `<div class="rep-bar-row">
                <span class="rep-bar-name" title="${kingdom.name}">${kingdom.name}</span>
                <div class="rep-bar-track">
                    <div class="rep-bar-fill" style="width:${pct}%;background:${color}"></div>
                </div>
            </div>`;
        }
        el.reputationBars.innerHTML = html;
    }

    function updateQuickInventory() {
        if (!el.quickInventory || !Player.inventory) return;
        const entries = Object.entries(Player.inventory).filter(([, qty]) => qty > 0);
        entries.sort((a, b) => b[1] - a[1]);
        const top5 = entries.slice(0, 5);

        let html = '';
        for (const [resId, qty] of top5) {
            const res = findResource(resId);
            const icon = res ? res.icon : '📦';
            const name = res ? res.name : resId;
            html += `<div class="inv-item" title="${name}">
                ${icon} <span class="qty">${qty}</span>
            </div>`;
        }
        el.quickInventory.innerHTML = html;
    }

    function updateWinProgress() {
        if (!el.winProgress) return;
        let html = '';
        const gold = Player.gold || 0;
        html += `<span class="win-indicator ${gold >= CONFIG.WIN_GOLD ? 'achieved' : ''}" title="Gold: ${formatGold(gold)} / ${formatGold(CONFIG.WIN_GOLD)}">
            🪙 ${gold >= CONFIG.WIN_GOLD ? '✓' : Math.floor(gold / CONFIG.WIN_GOLD * 100) + '%'}
        </span>`;
        el.winProgress.innerHTML = html;
    }

    // ═══════════════════════════════════════════════════════════
    //  RIGHT PANEL (Context-Sensitive Details)
    // ═══════════════════════════════════════════════════════════

    function showRightPanel(title, html) {
        el.rightPanelTitle.textContent = title;
        el.rightPanelBody.innerHTML = html;
        el.rightPanel.classList.remove('hidden');
    }

    function closeRightPanel() {
        el.rightPanel.classList.add('hidden');
    }

    function showTownDetail(town) {
        if (!town) return;
        let kingdom;
        try { kingdom = Engine.getKingdom(town.kingdomId); } catch (e) { /* no-op */ }
        const kName = kingdom ? kingdom.name : 'Unknown';
        const kColor = kingdom ? (kingdom.color || CONFIG.KINGDOM_COLORS[kingdom.id % CONFIG.KINGDOM_COLORS.length]) : '#888';
        const pop = town.population || 0;
        const prosperity = town.prosperity || 50;
        const happiness = town.happiness || 50;
        const walls = town.walls || 0;
        const garrison = town.garrison || 0;
        const isPlayerHere = (typeof Player !== 'undefined' && Player.townId === town.id && !Player.traveling);

        let html = '';

        // Town category
        const townCat = town.category || 'town';
        const catConfig = CONFIG.TOWN_CATEGORIES ? CONFIG.TOWN_CATEGORIES[townCat] : null;
        const catLabel = catConfig ? catConfig.label : townCat;
        const catIcon = catConfig ? catConfig.icon : '';

        // Wall level name
        const wallConfig = CONFIG.WALL_LEVELS ? CONFIG.WALL_LEVELS[walls] : null;
        const wallName = wallConfig ? wallConfig.name : (walls > 0 ? 'Level ' + walls : 'None');
        const wallDefBonus = wallConfig ? Math.round(wallConfig.defenseBonus * 100) : 0;
        const wallCondCfg = (walls > 0 && CONFIG.CONDITION_LEVELS) ? CONFIG.CONDITION_LEVELS[town.wallCondition || 'new'] : null;
        const wallCondStr = wallCondCfg ? ' ' + wallCondCfg.icon + ' ' + wallCondCfg.name : '';

        // Header
        html += `<div class="detail-section">
            <h3>📋 Overview</h3>
            <div class="detail-row"><span class="label">Category</span>
                <span class="value">${catIcon} ${catLabel}</span></div>
            <div class="detail-row"><span class="label">Kingdom</span>
                <span class="value" style="color:${kColor}">${kName}</span></div>
            <div class="detail-row"><span class="label">Population</span>
                <span class="value">${pop}${pop <= 0 ? ' <span class="town-status-destroyed">— Destroyed</span>' : pop < 20 ? ' <span class="town-status-struggling">— Struggling</span>' : ''}</span></div>`;

        // Port / Island indicators
        if (town.isPort) {
            html += `<div class="detail-row"><span class="label">Port</span>
                <span class="value" style="color:#00b4c8">⚓ Port Town${town.isIsland ? ' (Island)' : ''}</span></div>`;
        }

        // Town happiness with tier indicator
        const happyTier = town._happinessTier || 'neutral';
        const townTierLabels = { thriving: '🌟 Thriving', content: '😊 Content', neutral: '😐 Neutral', unrest: '😠 Unrest', crisis: '🔥 Crisis' };
        const townTierLabel = townTierLabels[happyTier] || '';
        html += `<div class="detail-row"><span class="label">Prosperity</span>
                <span class="value"><div class="bar-small"><div class="bar-small-fill" style="width:${Math.round(prosperity)}%;background:${prosperity > 60 ? '#55a868' : prosperity > 30 ? '#ccb974' : '#c44e52'}"></div></div> ${Math.round(prosperity)}%</span></div>
            <div class="detail-row"><span class="label">Happiness</span>
                <span class="value"><div class="bar-small"><div class="bar-small-fill" style="width:${happiness}%;background:${happiness > 60 ? '#55a868' : happiness > 30 ? '#ccb974' : '#c44e52'}"></div></div> ${Math.round(happiness)}% ${townTierLabel}</span></div>
            <div class="detail-row"><span class="label">Walls</span>
                <span class="value">${walls > 0 ? '🏰 ' + wallName + ' (+' + wallDefBonus + '% defense)' + wallCondStr : 'None'}</span></div>
            <div class="detail-row"><span class="label">Garrison</span>
                <span class="value">⚔ ${garrison} soldiers</span></div>`;
        // Blockade warning
        if (town.isPort && typeof Engine !== 'undefined' && Engine.isPortBlockaded && Engine.isPortBlockaded(town.id)) {
            html += `<div class="detail-row" style="color:#c44e52"><span class="label">⚠ BLOCKADED</span>
                <span class="value">Enemy warships are blockading this port!</span></div>`;
        }
        // Frontline indicator
        if (town.isFrontline) {
            html += `<div class="detail-row" style="color:#c44e52"><span class="label">⚔️ FRONTLINE</span>
                <span class="value">This town is on the front lines of war! Trade reduced, danger high.</span></div>`;
        }
        // Migration info
        if (town.migrationLog && town.migrationLog.length > 0) {
            var recentIn = 0, recentOut = 0;
            for (var mi = 0; mi < town.migrationLog.length; mi++) {
                var mEntry = town.migrationLog[mi];
                if (mEntry.in) recentIn += mEntry.in;
                if (mEntry.out) recentOut += mEntry.out;
            }
            if (recentIn > 0 || recentOut > 0) {
                html += '<div class="detail-row"><span class="label">Migration</span><span class="value">';
                if (recentIn > 0) html += '📥 +' + recentIn + ' arrived';
                if (recentIn > 0 && recentOut > 0) html += ' | ';
                if (recentOut > 0) html += '📤 -' + recentOut + ' departed';
                html += '</span></div>';
            }
        }
        // Town reputation
        if (typeof Player !== 'undefined' && Player.townReputation) {
            const rep = Player.getTownReputation ? Player.getTownReputation(town.id) : (Player.townReputation[town.id] || 50);
            const repColor = rep >= 70 ? '#55a868' : rep >= 40 ? '#ccb974' : '#c44e52';
            html += `<div class="detail-row"><span class="label">Your Reputation</span>
                <span class="value"><div class="bar-small"><div class="bar-small-fill" style="width:${rep}%;background:${repColor}"></div></div> ${rep}</span></div>`;
        }
        html += `</div>`;

        // Market prices — gated by location and skills
        // Player can see prices if: in this town, OR has appropriate skill
        const hasMarketScout = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('market_scout');
        const hasTradeNetwork = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('trade_network');
        const hasGlobalIntel = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('global_trade_intel');
        const playerKingdomId = typeof Player !== 'undefined' ? Player.kingdomId : null;
        const hasWorkersHere = typeof Player !== 'undefined' && Player.employees &&
            Player.employees.some(empId => { try { const e = Engine.getPerson(empId); return e && e.townId === town.id; } catch(ex) { return false; } });
        const hasBuildingsHere = typeof Player !== 'undefined' && Player.buildings &&
            Player.buildings.some(b => b.townId === town.id);
        const canSeePrices = isPlayerHere || hasGlobalIntel ||
            (hasTradeNetwork && town.kingdomId === playerKingdomId) ||
            (hasMarketScout && (hasWorkersHere || hasBuildingsHere));

        // Land & Housing section (only when player is in town)
        if (isPlayerHere && typeof Player !== 'undefined') {
            var playerTownCat = town.category || 'village';
            var maxPlots = (CONFIG.LAND_PLOTS_BASE && CONFIG.LAND_PLOTS_BASE[playerTownCat]) || 5;
            var ownedLand = Player.getOwnedLand ? Player.getOwnedLand(town.id) : 0;
            var landCost = Player.getLandCost ? Player.getLandCost(town.id) : CONFIG.LAND_COST_BASE;
            var playerHouse = Player.getHouseInTown ? Player.getHouseInTown(town.id) : null;
            var houseType = playerHouse ? CONFIG.HOUSING_TYPES.find(function(h) { return h.id === playerHouse.type; }) : null;

            html += '<div class="detail-section"><h3>🏡 Land & Housing</h3>';
            html += '<div class="detail-row"><span class="label">Your Land</span><span class="value">' + ownedLand + ' plots (max ' + maxPlots + ')</span></div>';
            if (playerHouse && houseType) {
                html += '<div class="detail-row"><span class="label">Your Home</span><span class="value">' + houseType.icon + ' ' + houseType.name + '</span></div>';
            } else {
                html += '<div class="detail-row"><span class="label">Your Home</span><span class="value" style="color:#888;">None</span></div>';
            }
            html += '<div style="margin-top:6px;">';
            html += '<button class="btn-medieval" onclick="UI.openHousingDialog()" style="font-size:0.8rem;padding:4px 12px;">🏡 Manage Housing</button> ';
            if (ownedLand < maxPlots) {
                html += '<button class="btn-medieval" onclick="UI.buyLandUI()" style="font-size:0.8rem;padding:4px 12px;">🏗️ Buy Land (' + landCost + 'g)</button>';
            }
            html += '</div></div>';
        }

        // Kingdom laws & king actions buttons
        if (kingdom) {
            html += '<div style="margin:8px 0;display:flex;gap:6px;flex-wrap:wrap;">';
            html += '<button class="btn-medieval" onclick="UI.openKingdomLawsPanel(\'' + kingdom.id + '\')" style="font-size:0.8rem;padding:4px 10px;">📜 Laws</button>';
            html += '<button class="btn-medieval" onclick="UI.openKingActionLog(\'' + kingdom.id + '\')" style="font-size:0.8rem;padding:4px 10px;">👑 King Actions</button>';
            html += '<button class="btn-medieval" onclick="UI.openRoyalCommissionsPanel(\'' + kingdom.id + '\')" style="font-size:0.8rem;padding:4px 10px;">📦 Commissions</button>';
            if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('economic_advisor')) {
                html += '<button class="btn-medieval" onclick="UI.openProsperityBreakdown(\'' + town.id + '\')" style="font-size:0.8rem;padding:4px 10px;">📊 Prosperity</button>';
            }
            html += '</div>';
        }

        if (town.market && town.market.prices && canSeePrices) {
            const isRemote = !isPlayerHere;
            html += `<div class="detail-section"><h3>📊 Market Prices${isRemote ? ' <span class="text-dim" style="font-size:0.7rem;">(Intel)</span>' : ''}</h3>`;
            html += `<table class="price-table"><tr><th>Item</th><th>Price</th><th>Supply</th><th style="font-size:0.7rem;">Source</th>`;
            if (isPlayerHere) html += `<th></th>`;
            html += `</tr>`;

            const prices = town.market.prices;
            const supply = town.market.supply || {};
            // Build lookup: what resources this town has deposits for and what buildings produce
            const townDeposits = town.naturalDeposits || {};
            const townBuildingProduces = new Set();
            if (town.buildings) {
                for (const b of town.buildings) {
                    const bt = findBuildingType(b.type);
                    if (bt && bt.produces) townBuildingProduces.add(bt.produces);
                }
            }

            for (const [resId, price] of Object.entries(prices)) {
                const res = findResource(resId);
                if (!res) continue;
                const priceDiff = price - res.basePrice;
                const _hasKeenEyeM = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('keen_eye');
                const priceClass = _hasKeenEyeM ? (priceDiff < -1 ? 'good-deal' : priceDiff > 1 ? 'bad-deal' : 'neutral') : 'neutral';
                const isMilitary = res.category === 'military';

                // Source indicators
                let sourceIcons = '';
                const hasDeposit = townDeposits[resId] != null && townDeposits[resId] > 0;
                const hasBuilding = townBuildingProduces.has(resId);
                if (hasDeposit) sourceIcons += '<span title="Natural deposit" style="color:#55a868;">⛏</span>';
                if (hasBuilding) sourceIcons += '<span title="Produced locally" style="color:#ccb974;">🏭</span>';
                if (!hasDeposit && !hasBuilding) sourceIcons = '<span title="Imported" style="color:#888;font-size:0.7rem;">📦</span>';

                html += `<tr class="${isMilitary ? 'military-item' : ''}">
                    <td>${res.icon} ${res.name}</td>
                    <td class="price ${priceClass}">${price}g</td>
                    <td>${isRemote ? '~' + Math.floor(supply[resId] || 0) : Math.floor(supply[resId] || 0)}</td>
                    <td style="text-align:center;">${sourceIcons}</td>`;
                if (isPlayerHere) {
                    // War trade warning
                    let warWarning = '';
                    if (isMilitary && typeof Player !== 'undefined' && Player.getWarTradeDetectionChance) {
                        const warInfo = Player.getWarTradeDetectionChance(resId, kingdom);
                        if (warInfo && warInfo.chance > 0) {
                            const enemyK = Engine.getKingdom ? Engine.getKingdom(warInfo.enemyKingdomId) : null;
                            const pct = Math.round(warInfo.chance * 100);
                            warWarning = `<div style="color:#c44e52;font-size:0.7rem;">⚠️ Selling war materials to ${kName} while you hold rank in ${enemyK ? enemyK.name : 'enemy kingdom'}. Risk: ${pct}%</div>`;
                        }
                    }
                    html += `<td>
                        <button class="btn-trade buy" onclick="UI.quickBuy('${resId}', '${town.id}')">Buy</button>
                        <button class="btn-trade sell" onclick="UI.quickSell('${resId}', '${town.id}')">Sell</button>
                        ${warWarning}
                    </td>`;
                }
                html += `</tr>`;
            }
            html += `</table>
                <div class="text-dim" style="font-size:0.7rem;margin-top:4px;">⛏ = Natural deposit | 🏭 = Produced locally | 📦 = Imported</div>
            </div>`;

            // Kingdom trade panel — sell directly to kingdom
            if (isPlayerHere && pop > 0 && typeof Player !== 'undefined' && Player.getKingdomBuyInfo) {
                html += `<div class="detail-section"><h3>🏛️ Sell to Kingdom</h3>`;
                html += `<button class="btn-action" onclick="UI.showKingdomTradePanel('${town.kingdomId}')">🏛️ Open Kingdom Trade</button>`;
                html += `</div>`;
            }
        } else if (town.market && town.market.prices && !canSeePrices) {
            html += `<div class="detail-section"><h3>📊 Market Prices</h3>
                <div class="text-dim" style="font-size:0.8rem;">🔒 You need to visit this town or learn <b>Market Scout</b>, <b>Trade Network</b>, or <b>Global Trade Intel</b> skills to see remote prices.</div>
            </div>`;
        }

        // Natural resource deposits
        if (town.naturalDeposits && typeof Engine.getTownDeposits === 'function') {
            const deposits = Engine.getTownDeposits(town.id);
            if (deposits && Object.keys(deposits).length > 0) {
                html += `<div class="detail-section"><h3>⛏️ Natural Deposits</h3>`;
                for (const [resId, info] of Object.entries(deposits)) {
                    const res = findResource(resId);
                    const icon = res ? res.icon : '🪨';
                    const name = res ? res.name : resId;
                    const pct = info.pct;
                    const barColor = pct > 50 ? '#55a868' : pct > 20 ? '#ccb974' : pct > 0 ? '#c44e52' : '#555';
                    const label = pct <= 0 ? 'Exhausted' : info.renewable ? pct + '% (renewable)' : pct + '%';
                    html += `<div class="detail-row">
                        <span class="label">${icon} ${name}</span>
                        <span class="value"><div class="bar-small" style="width:80px;"><div class="bar-small-fill" style="width:${pct}%;background:${barColor}"></div></div> <span style="font-size:0.7rem;color:${barColor}">${label}</span></span>
                    </div>`;
                }
                if (town.soilFertility != null) {
                    const sfPct = Math.round(town.soilFertility * 100);
                    const sfColor = sfPct > 70 ? '#55a868' : sfPct > 40 ? '#ccb974' : '#c44e52';
                    html += `<div class="detail-row">
                        <span class="label">🌱 Soil Fertility</span>
                        <span class="value"><div class="bar-small" style="width:80px;"><div class="bar-small-fill" style="width:${sfPct}%;background:${sfColor}"></div></div> <span style="font-size:0.7rem;color:${sfColor}">${sfPct}%</span></span>
                    </div>`;
                }
                html += `</div>`;
            }
        }

        // Buildings — only show if player is here or has trade intel
        if (town.buildings && town.buildings.length && (isPlayerHere || canSeePrices)) {
            html += `<div class="detail-section"><h3>🏢 Buildings</h3>`;
            for (const b of town.buildings.slice(0, 10)) {
                const bt = findBuildingType(b.type || b.id);
                const condCfg = CONFIG.CONDITION_LEVELS ? CONFIG.CONDITION_LEVELS[b.condition || 'new'] : null;
                const condIcon = condCfg ? condCfg.icon : '✨';
                const condColor = (b.condition === 'breaking') ? 'color:var(--danger);' : (b.condition === 'destroyed') ? 'color:#888;' : (b.condition === 'used') ? 'color:var(--gold);' : 'color:#55a868;';
                html += `<div class="detail-row">
                    <span class="label">${bt ? bt.name : b.type || b.id} ${condIcon}</span>
                    <span class="value" style="${condColor};font-size:0.75rem;">${condCfg ? condCfg.name : 'New'}</span>
                </div>`;
            }
            if (town.buildings.length > 10) {
                html += `<div class="text-dim text-center mt-sm">+${town.buildings.length - 10} more</div>`;
            }
            html += `</div>`;
        }

        // Elite merchants present in this town (requires merchant_intelligence skill)
        if (typeof Player !== 'undefined' && Player.canSeeEliteMerchantLocations && Player.canSeeEliteMerchantLocations()) {
            const w = typeof Engine !== 'undefined' ? Engine.getWorld() : null;
            if (w && w.people) {
                const elitesHere = w.people.filter(p => p.alive && p.isEliteMerchant && p.townId === town.id);
                if (elitesHere.length > 0) {
                    html += `<div class="detail-section"><h3>🔍 Elite Merchants Present</h3>`;
                    for (const em of elitesHere) {
                        const heraldrySymbol = em.heraldry ? em.heraldry.symbol : '';
                        const heraldryName = em.heraldry ? ` <span style="font-size:0.65rem;color:#aaa;">(${em.heraldry.name})</span>` : '';
                        const emStrategy = em.strategy || 'diversified';
                        // Track/Untrack button for merchant_tracker skill
                        let trackBtn = '';
                        if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('merchant_tracker')) {
                            const isTracked = Player.isTrackingMerchant && Player.isTrackingMerchant(em.id);
                            trackBtn = ' <button class="btn-medieval" style="font-size:0.65rem;padding:1px 6px;' + (isTracked ? 'background:var(--gold);color:#000;' : '') + '" onclick="(function(){ var r = Player.' + (isTracked ? 'untrackMerchant' : 'trackMerchant') + '(\'' + em.id + '\'); if(typeof UI!==\'undefined\' && UI.toast) UI.toast(r.message, r.success?\'success\':\'warning\'); })();">' + (isTracked ? '⭐ Untrack' : '☆ Track') + '</button>';
                        }
                        html += `<div class="detail-row">
                            <span class="label">${heraldrySymbol} ${em.firstName || ''} ${em.lastName || ''}${trackBtn}</span>
                            <span class="value" style="font-size:0.75rem;color:#ccb974;">${emStrategy}${heraldryName}</span>
                        </div>`;
                    }
                    html += `</div>`;
                }
            }
        }

        // Horse bonus indicator
        if (town.market && town.market.supply && (town.market.supply.horses || 0) > 0) {
            html += `<div class="detail-section"><h3>🐴 Horse Bonuses Active</h3>`;
            const hasSaddles = (town.market.supply.saddles || 0) > 0;
            html += `<div class="detail-row"><span class="label">Farm Productivity</span>
                <span class="value text-success">+${Math.round((CONFIG.HORSE_FARM_BONUS || 0.2) * (hasSaddles ? (CONFIG.SADDLE_BONUS_MULTIPLIER || 2) : 1) * 100)}%</span></div>`;
            if (hasSaddles) {
                html += `<div class="detail-row"><span class="label">Saddle Bonus</span>
                    <span class="value text-success">🐎 Active (2x horse bonuses)</span></div>`;
            }
            html += `</div>`;
        }

        // Watchtower info
        if (town.towers && town.towers > 0) {
            html += `<div class="detail-section"><h3>🏰 Defenses</h3>`;
            html += `<div class="detail-row"><span class="label">Watchtowers</span>
                <span class="value">${town.towers}</span></div>`;
            html += `<div class="detail-row"><span class="label">Archer Defense Bonus</span>
                <span class="value text-success">+${Math.round(town.towers * 50)}%</span></div>`;
            html += `</div>`;
        }

        // Livestock info — only visible locally or with intel
        if (town.livestock && (isPlayerHere || canSeePrices)) {
            const totalLv = (town.livestock.livestock_cow || 0) + (town.livestock.livestock_pig || 0) + (town.livestock.livestock_chicken || 0);
            if (totalLv > 0) {
                html += `<div class="detail-section"><h3>🐄 Livestock</h3>`;
                if (town.livestock.livestock_cow > 0) html += `<div class="detail-row"><span class="label">🐄 Cows</span><span class="value">${town.livestock.livestock_cow}</span></div>`;
                if (town.livestock.livestock_pig > 0) html += `<div class="detail-row"><span class="label">🐷 Pigs</span><span class="value">${town.livestock.livestock_pig}</span></div>`;
                if (town.livestock.livestock_chicken > 0) html += `<div class="detail-row"><span class="label">🐔 Chickens</span><span class="value">${town.livestock.livestock_chicken}</span></div>`;
                const pastureCount = town.buildings ? town.buildings.filter(b => b.type === 'pasture').length : 0;
                html += `<div class="detail-row"><span class="label">Pasture Capacity</span><span class="value">${pastureCount * 10}</span></div>`;
                html += `</div>`;
            }
        }

        // Travel button
        if (!isPlayerHere) {
            // Route info preview
            if (typeof Engine !== 'undefined' && Engine.findPath) {
                try {
                    const route = Engine.findPath(Player.townId, town.id);
                    if (route && route.length > 0) {
                        let routeDesc = '';
                        const types = new Set(route.map(s => s.type || 'road'));
                        if (types.has('offroad')) routeDesc += '🥾 Off-road segments (slow!) ';
                        if (types.has('sea')) routeDesc += '⛵ Sea crossing ';
                        if (types.has('road')) routeDesc += '🛤️ Road ';
                        html += `<div style="font-size:0.75rem;color:#aaa;margin-bottom:4px;text-align:center;">Route: ${routeDesc}</div>`;
                    } else {
                        html += `<div style="font-size:0.75rem;color:#c44e52;text-align:center;">⚠️ No route available!</div>`;
                    }
                } catch (e) { /* findPath may throw if towns unreachable */ }
            }

            html += `<div class="text-center mt-sm">
                <button class="btn-medieval" onclick="UI.openTravelOptions('${town.id}')" style="font-size:0.85rem;padding:8px 24px;">
                    🗺️ Travel Options
                </button>`;

            html += `</div>`;
        }

        // Advise the King button (if player has sway in this kingdom)
        if (isPlayerHere && typeof Player !== 'undefined' && Player.royalAdvisorBenefits &&
            Player.royalAdvisorBenefits.swayOverKing && Player.royalAdvisorKingdomId === town.kingdomId) {
            html += `<div class="text-center mt-sm">
                <button class="btn-medieval" onclick="UI.openAdviseKingDialog('${town.kingdomId}')" style="font-size:0.85rem;padding:8px 24px;background:rgba(255,215,0,0.15);border-color:rgba(255,215,0,0.4);">
                    👑 Advise the King (${Player.politicalCapital || 0} uses left)
                </button>
            </div>`;
        }

        // Toll Route Buttons (player is here)
        if (isPlayerHere && typeof Player !== 'undefined') {
            html += `<div class="detail-section"><h3>⚒️ Actions</h3>`;
            html += `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">`;
            html += `<button class="btn-medieval" onclick="UI.showBuildRouteSelector('toll_road')" style="font-size:0.8rem;padding:6px 14px;background:rgba(180,140,50,0.15);border-color:rgba(180,140,50,0.4);">
                \uD83D\uDEE4\uFE0F Build Toll Road
            </button>`;
            if (town.isPort) {
                html += `<button class="btn-medieval" onclick="UI.showBuildRouteSelector('sea_route')" style="font-size:0.8rem;padding:6px 14px;background:rgba(0,180,200,0.15);border-color:rgba(0,180,200,0.4);">
                    \u2693 Build Sea Route
                </button>`;
            }
            html += `<button class="btn-medieval" onclick="UI.showBuildRouteSelector('petition')" style="font-size:0.8rem;padding:6px 14px;background:rgba(255,215,0,0.15);border-color:rgba(255,215,0,0.4);">
                \uD83D\uDC51 Petition King for Road
            </button>`;
            html += `<button class="btn-medieval" onclick="UI.showTollRoutesPanel()" style="font-size:0.8rem;padding:6px 14px;background:rgba(100,200,100,0.15);border-color:rgba(100,200,100,0.4);">
                \uD83D\uDCCA My Toll Routes
            </button>`;
            if (typeof Player !== 'undefined' && Player.isPlayerCitizenOf && Player.citizenshipKingdomId) {
                html += `<button class="btn-medieval" onclick="UI.showPetitionsPanel()" style="font-size:0.8rem;padding:6px 14px;background:rgba(212,160,23,0.15);border-color:rgba(212,160,23,0.4);">
                    📜 Petitions
                </button>`;
            }
            if (typeof Player !== 'undefined' && Player.isPlayerCitizenOf && Player.isPlayerCitizenOf(town.kingdomId)) {
                html += `<button class="btn-medieval" onclick="UI.showKingdomOrdersPanel('${town.kingdomId}')" style="font-size:0.8rem;padding:6px 14px;background:rgba(180,120,200,0.15);border-color:rgba(180,120,200,0.4);">
                    📋 Kingdom Orders
                </button>`;
            }
            html += `<button class="btn-medieval" onclick="UI.forageNearby()" style="font-size:0.8rem;padding:6px 14px;background:rgba(85,168,104,0.15);border-color:rgba(85,168,104,0.3);">
                🌿 Forage Nearby
            </button>`;
            html += `</div></div>`;
        }

        // Kingdom Economic Policies section (bounties, subsidies, etc.)
        if (kingdom) {
            const kFull = Engine.getWorld() ? Engine.getWorld().kingdoms.find(kk => kk.id === kingdom.id) : kingdom;
            const bounties = (kFull && kFull.productionBounties || []).filter(b => b.townId === town.id && !b.fulfilled && b.expiresDay > (Engine.getDay() || 0));
            const subsidies = (kFull && kFull.landSubsidies || []).filter(s => s.townId === town.id && s.expiresDay > (Engine.getDay() || 0));
            const holidays = (kFull && kFull.taxHolidays || []).filter(h => h.townId === town.id && h.expiresDay > (Engine.getDay() || 0));
            const immigration = (kFull && kFull.immigrationIncentives || []).filter(i => i.townId === town.id && i.expiresDay > (Engine.getDay() || 0));
            const tradeSubsidies = (kFull && kFull.tradeSubsidies || []).filter(s => s.expiresDay > (Engine.getDay() || 0));

            if (bounties.length > 0 || subsidies.length > 0 || holidays.length > 0 || immigration.length > 0 || tradeSubsidies.length > 0) {
                html += '<div class="detail-section"><h3>👑 Royal Economic Policies</h3>';
                for (const b of bounties) {
                    html += `<div class="detail-row" style="color:#d4a017"><span class="label">📜 Bounty</span><span class="value">Produce ${b.good} — ${b.reward}g reward</span></div>`;
                }
                for (const s of subsidies) {
                    html += `<div class="detail-row" style="color:#55a868"><span class="label">🏗️ Land Subsidy</span><span class="value">${Math.round(s.discount * 100)}% off land for ${s.buildingType}</span></div>`;
                }
                for (const h of holidays) {
                    const daysLeft = h.expiresDay - (Engine.getDay() || 0);
                    html += `<div class="detail-row" style="color:#00b4c8"><span class="label">🎉 Tax Holiday</span><span class="value">No property tax (${daysLeft}d left)</span></div>`;
                }
                for (const i of immigration) {
                    html += `<div class="detail-row" style="color:#c89b00"><span class="label">🏠 Immigration Bonus</span><span class="value">${i.bonus}g for relocating here</span></div>`;
                }
                for (const ts of tradeSubsidies) {
                    html += `<div class="detail-row" style="color:#b478c8"><span class="label">💰 Trade Subsidy</span><span class="value">+${ts.bonusPerUnit}g per ${ts.good} sold</span></div>`;
                }
                html += '</div>';
            }
        }

        // Roads & Bridges section (player is here)
        if (isPlayerHere && typeof Engine !== 'undefined' && Engine.getRoads) {
            const roads = Engine.getRoads();
            const connectedRoads = roads.map((r, idx) => ({ road: r, idx })).filter(e =>
                e.road.fromTownId === town.id || e.road.toTownId === town.id
            );
            const bridgeRoads = connectedRoads.filter(e => e.road.hasBridge);
            if (bridgeRoads.length > 0) {
                html += '<div class="detail-section">';
                html += '<h3>🌉 Infrastructure</h3>';
                for (const { road, idx } of bridgeRoads) {
                    const otherTownId = road.fromTownId === town.id ? road.toTownId : road.fromTownId;
                    const otherTown = Engine.findTown(otherTownId);
                    const otherName = otherTown ? otherTown.name : '?';
                    if (road.bridgeDestroyed) {
                        html += `<div style="font-size:0.8rem;color:#c44e52;margin-bottom:4px;">❌ Bridge to ${otherName} — DESTROYED `;
                        html += `<button class="btn-medieval" onclick="UI.rebuildBridge(${idx})" style="font-size:0.7rem;padding:3px 8px;">🔧 Rebuild (${CONFIG.BRIDGE_REBUILD_COST}g)</button></div>`;
                    } else {
                        html += `<div style="font-size:0.8rem;color:#55a868;margin-bottom:4px;">🌉 Bridge to ${otherName} — intact `;
                        html += `<button class="btn-medieval" onclick="UI.destroyBridge(${idx})" style="font-size:0.7rem;padding:3px 8px;background:rgba(200,50,50,0.15);">💣 Destroy (${CONFIG.BRIDGE_DESTROY_COST}g)</button></div>`;
                    }
                }
                html += '</div>';
            }
        }

        // Sea route naval threat
        if (town.isPort && typeof Engine !== 'undefined' && Engine.getNavalThreat) {
            const playerTown = typeof Player !== 'undefined' ? Engine.findTown(Player.townId) : null;
            if (playerTown && playerTown.isPort && playerTown.id !== town.id) {
                const threat = Engine.getNavalThreat(playerTown.id, town.id);
                if (threat > 0) {
                    const threatColor = threat >= 50 ? '#c44e52' : '#ccb974';
                    html += `<div class="detail-section">
                        <div class="detail-row" style="color:${threatColor}">
                            <span class="label">⚠ Naval Threat</span>
                            <span class="value">${threat}% — ${threat >= 50 ? 'DANGEROUS!' : 'Moderate risk'}</span>
                        </div>
                    </div>`;
                }
            }
        }

        // NPC Transport services (when player is in this town)
        if (isPlayerHere) {
            html += buildNPCTransportSection();
        }

        // View Townspeople button — only if player is in this town or a connected town
        if (isPlayerHere) {
            html += `<div class="text-center mt-sm">
                <button class="btn-medieval" onclick="UI.showTownPeople('${town.id}')" style="font-size:0.8rem;padding:6px 16px;">
                    👥 View Townspeople (${pop})
                </button>
            </div>`;
        } else {
            // Check if connected town (road or skill)
            const hasSpyNetwork = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('trade_network');
            let isConnected = false;
            if (typeof Player !== 'undefined' && typeof Engine !== 'undefined') {
                try {
                    const roads = Engine.getRoads();
                    isConnected = roads.some(r =>
                        (r.fromTownId === Player.townId && r.toTownId === town.id) ||
                        (r.toTownId === Player.townId && r.fromTownId === town.id)
                    );
                } catch(e) {}
            }
            if (isConnected || hasSpyNetwork) {
                html += `<div class="text-center mt-sm">
                    <button class="btn-medieval" onclick="UI.showTownPeople('${town.id}')" style="font-size:0.8rem;padding:6px 16px;opacity:0.8;">
                        👥 View Townspeople (${pop}) <span class="text-dim" style="font-size:0.7rem;">— View only</span>
                    </button>
                </div>`;
            }
        }

        showRightPanel(`🏘 ${town.name}`, html);
    }

    function showKingdomDetail(kingdom) {
        if (!kingdom) return;
        const kColor = kingdom.color || CONFIG.KINGDOM_COLORS[kingdom.id % CONFIG.KINGDOM_COLORS.length];

        // Get king name
        let kingName = 'Unknown';
        if (kingdom.king) {
            try {
                const kingPerson = Engine.getPerson(kingdom.king);
                if (kingPerson) kingName = kingPerson.firstName + ' ' + kingPerson.lastName;
            } catch (e) { /* no-op */ }
        }

        let html = `<div class="detail-section">
            <div class="detail-row"><span class="label">King</span>
                <span class="value">${kingName}</span></div>
            <div class="detail-row"><span class="label">Culture</span>
                <span class="value">${kingdom.culture ? kingdom.culture.charAt(0).toUpperCase() + kingdom.culture.slice(1) : 'Unknown'}</span></div>
            <div class="detail-row"><span class="label">Gold</span>
                <span class="value gold-value">${formatGold(kingdom.gold || 0)}</span></div>
            <div class="detail-row"><span class="label">Tax Rate</span>
                <span class="value">${Math.round((kingdom.taxRate || 0.1) * 100)}%</span></div>
            <div class="detail-row"><span class="label">Military</span>
                <span class="value">⚔ ${kingdom.militaryStrength || 0}</span></div>
            <div class="detail-row"><span class="label">Prosperity</span>
                <span class="value">${kingdom.prosperity || 0}%</span></div>`;

        // Kingdom happiness bar
        const kHappiness = kingdom.happiness != null ? Math.round(kingdom.happiness) : 50;
        const kHappyColor = kHappiness > 60 ? '#55a868' : kHappiness > 30 ? '#ccb974' : '#c44e52';
        const kHappyTier = kingdom._happinessTier || 'neutral';
        const tierLabels = { golden_age: '🌟 Golden Age', stable: '😊 Stable', neutral: '😐 Neutral', discontent: '😠 Discontent', rebellion: '🔥 Rebellion' };
        const tierLabel = tierLabels[kHappyTier] || '';
        html += `<div class="detail-row"><span class="label">Happiness</span>
                <span class="value"><div class="bar-small"><div class="bar-small-fill" style="width:${kHappiness}%;background:${kHappyColor}"></div></div> ${kHappiness}% ${tierLabel}</span></div>
        </div>`;

        // Financial warnings
        if (kingdom._bankruptDays > 0) {
            html += `<div style="background:var(--danger);color:white;padding:6px 10px;border-radius:4px;margin-bottom:8px;font-size:0.78rem;">
                💸 BANKRUPT — ${kingdom._bankruptDays} days without funds. Soldiers deserting!
                ${kingdom._bankruptDays >= 60 ? '⚠️ Kingdom collapse imminent!' : ''}
            </div>`;
        } else if (kingdom.gold < (CONFIG.KINGDOM_BANKRUPTCY_WARNING_GOLD || 200)) {
            html += `<div style="background:var(--gold);color:#333;padding:6px 10px;border-radius:4px;margin-bottom:8px;font-size:0.78rem;">
                ⚠️ Treasury running low — ${formatGold(kingdom.gold)} remaining
            </div>`;
        }

        // Active embargoes
        if (kingdom.embargoes && kingdom.embargoes.length > 0) {
            const embargoNames = kingdom.embargoes.map(eId => {
                try { const ek = Engine.getKingdom(eId); return ek ? ek.name : eId; } catch (e) { return eId; }
            }).join(', ');
            html += `<div style="background:var(--bg-card);border:1px solid var(--danger);padding:6px 10px;border-radius:4px;margin-bottom:8px;font-size:0.78rem;">
                📜🚫 Embargoes: ${embargoNames}
            </div>`;
        }

        // Royal Advisors
        if (kingdom.royalAdvisors && kingdom.royalAdvisors.length > 0) {
            html += `<div class="detail-section"><h3>📜 Royal Advisors</h3>`;
            for (const advisorId of kingdom.royalAdvisors) {
                let advName = 'Unknown';
                try {
                    const adv = Engine.getPerson(advisorId);
                    if (adv) advName = adv.firstName + ' ' + adv.lastName;
                } catch (e) { /* no-op */ }
                html += `<div class="detail-row">
                    <span class="label">${advName}</span>
                    <span class="value text-dim">Advisor</span>
                </div>`;
            }
            html += `</div>`;
        }

        // Naval Fleet
        if (kingdom.navalFleet && kingdom.navalFleet.length > 0) {
            html += `<div class="detail-section"><h3>⚓ Naval Fleet (${kingdom.navalFleet.length})</h3>`;
            for (const ship of kingdom.navalFleet) {
                const mission = ship.mission ? ship.mission.charAt(0).toUpperCase() + ship.mission.slice(1) : 'Idle';
                html += `<div class="detail-row">
                    <span class="label">🚢 ${ship.name}</span>
                    <span class="value text-dim">${mission}</span>
                </div>`;
            }
            html += `</div>`;
        }

        // Military unit composition
        if (typeof MILITARY_UNITS !== 'undefined') {
            html += `<div class="detail-section"><h3>Military Units</h3>`;
            for (const [unitId, unit] of Object.entries(MILITARY_UNITS)) {
                html += `<div class="detail-row">
                    <span class="label">${unit.icon} ${unit.name}</span>
                    <span class="value text-dim">ATK: ${unit.attackMult}x | DEF: ${unit.defenseMult}x</span>
                </div>`;
            }
            html += `</div>`;
        }

        // Relations
        let kingdoms;
        try { kingdoms = Engine.getKingdoms(); } catch (e) { kingdoms = []; }
        if (kingdom.relations) {
            html += `<div class="detail-section"><h3>Relations</h3>`;
            for (const [kId, val] of Object.entries(kingdom.relations)) {
                const other = kingdoms.find(k => k.id == kId);
                if (!other) continue;
                const isWar = kingdom.atWar && kingdom.atWar.includes(parseInt(kId));
                html += `<div class="detail-row">
                    <span class="label">${other.name}</span>
                    <span class="value ${isWar ? 'text-danger' : val > 50 ? 'text-success' : val < -30 ? 'text-warning' : ''}">${isWar ? '⚔ AT WAR' : val}</span>
                </div>`;
            }
            html += `</div>`;
        }

        // Towns
        const towns = Engine.getTowns();
        const kTowns = towns ? towns.filter(t => t.kingdomId === kingdom.id) : [];
        if (kTowns.length) {
            html += `<div class="detail-section"><h3>Towns (${kTowns.length})</h3>`;
            for (const t of kTowns) {
                html += `<div class="detail-row" style="cursor:pointer" onclick="UI.clickTown('${t.id}')">
                    <span class="label">🏘 ${t.name}</span>
                    <span class="value text-dim">pop: ${t.population || 0}</span>
                </div>`;
            }
            html += `</div>`;
        }

        // Laws & Punishments
        if (typeof CONFIG !== 'undefined' && CONFIG.CRIME_TYPES && typeof Player !== 'undefined' && Player.getCrimePunishment) {
            html += `<div class="detail-section"><h3>⚖️ Laws & Punishments</h3>`;
            for (const crime of CONFIG.CRIME_TYPES) {
                const p = Player.getCrimePunishment(kingdom.id, crime.id);
                const pType = p.type === 'execution' ? '💀 Execution' : p.type === 'jail' ? '🔒 Jail' : '💰 Fine';
                const details = [];
                if (p.jailDays > 0) details.push(p.jailDays + 'd jail');
                if (p.fine > 0) details.push(p.fine + 'g fine');
                html += `<div class="detail-row" style="font-size:0.78rem;">
                    <span class="label">${crime.icon} ${crime.name}</span>
                    <span class="value" style="font-size:0.75rem;">${pType}${details.length ? ' (' + details.join(', ') + ')' : ''}</span>
                </div>`;
            }
            html += `</div>`;
        }

        showRightPanel(`👑 ${kingdom.name}`, html);
    }

    function showPersonDetail(person) {
        if (!person) return;
        selectedPersonId = person.id;
        const occ = person.occupation || 'none';
        const occInfo = OCCUPATIONS[occ.toUpperCase()] || { name: occ };
        let townName = 'Unknown';
        let townObj = null;
        try {
            townObj = Engine.getTown(person.townId);
            if (townObj) townName = townObj.name;
        } catch (e) { /* no-op */ }

        const isInSameTown = typeof Player !== 'undefined' && Player.townId === person.townId && !Player.traveling;
        const isPlayer = typeof Player !== 'undefined';
        const isAlive = person.alive !== false;
        const playerSpouseId = isPlayer ? Player.spouseId : null;
        const isSpouse = playerSpouseId === person.id;
        const isChild = isPlayer && Player.childrenIds && Player.childrenIds.includes(person.id);

        // ── Basic Info ──
        let html = `<div class="detail-section">
            <div class="detail-row"><span class="label">Name</span>
                <span class="value">${person.firstName || ''} ${person.lastName || ''}</span></div>
            <div class="detail-row"><span class="label">Age</span>
                <span class="value">${person.age || '?'}</span></div>
            <div class="detail-row"><span class="label">Sex</span>
                <span class="value">${person.sex === 'M' ? '♂ Male' : person.sex === 'F' ? '♀ Female' : '?'}</span></div>
            <div class="detail-row"><span class="label">Occupation</span>
                <span class="value">${occInfo.name || occ}</span></div>
            <div class="detail-row"><span class="label">Town</span>
                <span class="value">${townName}</span></div>
            <div class="detail-row"><span class="label">Gold</span>
                <span class="value gold-value">${formatGold(person.gold || 0)}</span></div>`;

        // Employment info
        if (person.employerId) {
            let employerName = 'Unknown';
            if (person.employerId === 'player') {
                employerName = '⭐ You';
            } else {
                try {
                    const employer = Engine.findPerson(person.employerId);
                    if (employer) employerName = employer.firstName + ' ' + employer.lastName;
                } catch (e) { /* no-op */ }
                try {
                    const kingdom = Engine.findKingdom(person.employerId);
                    if (kingdom) employerName = '👑 ' + kingdom.name;
                } catch (e) { /* no-op */ }
            }
            html += `<div class="detail-row"><span class="label">Employer</span>
                <span class="value">${employerName}</span></div>`;
        }
        html += `</div>`;

        // ── Needs Bars ──
        if (person.needs) {
            html += `<div class="detail-section"><h3>Needs</h3>`;
            const needNames = ['food', 'shelter', 'safety', 'wealth', 'happiness'];
            for (const need of needNames) {
                const val = person.needs[need] || 0;
                const color = val > 60 ? '#55a868' : val > 30 ? '#ccb974' : '#c44e52';
                html += `<div class="needs-bar-container">
                    <span class="needs-bar-label">${capitalize(need)}</span>
                    <div class="needs-bar-track">
                        <div class="needs-bar-fill" style="width:${val}%;background:${color}"></div>
                    </div>
                </div>`;
            }
            html += `</div>`;
        }

        // ── Skills ──
        if (person.skills) {
            html += `<div class="detail-section"><h3>Skills</h3>`;
            for (const [skill, val] of Object.entries(person.skills)) {
                html += `<div class="detail-row"><span class="label">${capitalize(skill)}</span>
                    <span class="value">${val}</span></div>`;
            }
            html += `</div>`;
        }

        // ── Family ──
        html += `<div class="detail-section"><h3>Family</h3>`;
        if (person.spouseId) {
            let spouse;
            try { spouse = Engine.getPerson(person.spouseId); } catch (e) { /* no-op */ }
            const spouseName = spouse ? `${spouse.firstName} ${spouse.lastName}` : 'Unknown';
            html += `<div class="detail-row"><span class="label">Spouse</span>
                <span class="value">${spouseName}</span></div>`;
        } else {
            html += `<div class="detail-row"><span class="label">Spouse</span>
                <span class="value text-dim">None</span></div>`;
        }
        if (person.childrenIds && person.childrenIds.length) {
            html += `<div class="detail-row"><span class="label">Children</span>
                <span class="value">${person.childrenIds.length}</span></div>`;
        }
        html += `</div>`;

        // ── Personality Impression ──
        if (isPlayer && Player.getPersonalityImpression && person.personality) {
            const impression = Player.getPersonalityImpression(person);
            if (impression) {
                html += `<div class="detail-section"><h3>Impression</h3>
                    <div class="text-dim" style="font-style:italic;font-size:0.85rem;">"${impression}"</div>
                </div>`;
            }
        }

        // ── Relationship & Social Actions (only if player exists and alive) ──
        if (isPlayer && isAlive && Player.getRelationship) {
            const rel = Player.getRelationship(person.id);
            const relLabel = Player.getRelationshipLabel ? Player.getRelationshipLabel(rel.level) : { icon: '🤝', name: 'Acquaintance' };
            html += `<div class="detail-section"><h3>Relationship</h3>
                <div class="detail-row"><span class="label">${relLabel.icon} ${relLabel.name}</span>
                    <span class="value">${Math.floor(rel.level)}/100</span></div>
                <div class="needs-bar-container">
                    <div class="needs-bar-track">
                        <div class="needs-bar-fill" style="width:${Math.floor(rel.level)}%;background:var(--gold)"></div>
                    </div>
                </div>
            </div>`;

            if (isInSameTown) {
                // ── Social Actions ──
                html += `<div class="detail-section"><h3>🤝 Social</h3>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;">`;

                html += `<button class="btn-medieval" onclick="UI.openGiftDialog('${person.id}')" style="font-size:0.75rem;padding:5px 10px;">🎁 Gift</button>`;
                html += `<button class="btn-medieval" onclick="UI.talkToPerson('${person.id}')" style="font-size:0.75rem;padding:5px 10px;">💬 Talk</button>`;
                html += `<button class="btn-medieval" onclick="UI.observePerson('${person.id}')" style="font-size:0.75rem;padding:5px 10px;">👀 Observe</button>`;
                html += `<button class="btn-medieval" onclick="UI.askTavernAbout('${person.id}')" style="font-size:0.75rem;padding:5px 10px;">🍺 Ask Around</button>`;
                html += `<button class="btn-medieval" onclick="UI.hireInvestigator('${person.id}')" style="font-size:0.75rem;padding:5px 10px;">🕵️ Investigate</button>`;

                html += `</div></div>`;

                // ── Relationship Perks (Favors) ──
                if (Player.getRelationshipPerks) {
                    const perks = Player.getRelationshipPerks(person.id);
                    if (perks.length > 0) {
                        html += `<div class="detail-section"><h3>\u2B50 Favors</h3>
                            <div style="display:flex;flex-direction:column;gap:3px;">`;
                        for (const perk of perks) {
                            const disabled = perk.onCooldown;
                            const cdText = disabled ? ` (${perk.cooldownRemaining}d cooldown)` : '';
                            const costText = perk.cost > 0 ? ` (${perk.cost}g)` : '';
                            html += `<button class="btn-medieval" onclick="UI.usePerk('${person.id}','${perk.id}')"
                                ${disabled ? 'disabled' : ''}
                                style="font-size:0.7rem;padding:4px 8px;text-align:left;${disabled ? 'opacity:0.5;cursor:not-allowed;' : ''}"
                                title="${perk.desc}">
                                ${perk.name}${costText}${cdText}
                            </button>`;
                        }
                        html += `</div></div>`;
                    }
                }

                // ── Dating Actions (if eligible) ──
                const canDate = person.age >= 16 && !isChild;
                if (canDate && typeof DATING_ACTIVITIES !== 'undefined') {
                    html += `<div class="detail-section"><h3>💕 Courtship</h3>
                        <div style="display:flex;flex-direction:column;gap:3px;">`;

                    for (const activity of DATING_ACTIVITIES) {
                        const meetsMin = !activity.minRelationship || rel.level >= activity.minRelationship;
                        const canAfford = !activity.cost || (Player.gold >= activity.cost);
                        const disabled = !meetsMin || !canAfford;
                        const disabledAttr = disabled ? 'disabled style="opacity:0.5;cursor:not-allowed;font-size:0.7rem;padding:4px 8px;"' : 'style="font-size:0.7rem;padding:4px 8px;"';
                        let tooltip = activity.description || '';
                        if (!meetsMin) tooltip += ` (Need relationship ${activity.minRelationship}+)`;
                        if (!canAfford) tooltip += ` (Need ${activity.cost}g)`;
                        html += `<button class="btn-medieval" onclick="UI.dateAction('${person.id}','${activity.id}')" ${disabledAttr} title="${tooltip}">
                            ${activity.name}${activity.cost ? ' (' + activity.cost + 'g)' : ' (Free)'}</button>`;
                    }

                    // Propose button
                    if (rel.level >= 60 && !person.spouseId && !playerSpouseId) {
                        html += `<button class="btn-medieval" onclick="UI.proposeTo('${person.id}')" style="font-size:0.75rem;padding:5px 10px;background:rgba(200,150,50,0.2);border-color:rgba(200,150,50,0.5);margin-top:4px;">
                            💍 Propose Marriage</button>`;
                    } else if (rel.level < 60 && !person.spouseId && !playerSpouseId) {
                        html += `<div class="text-dim" style="font-size:0.7rem;margin-top:4px;">💍 Propose requires relationship 60+</div>`;
                    }

                    html += `</div></div>`;
                }

                // ── Hire (if unemployed) ──
                if (occ === 'none' || occ === 'unemployed' || !person.employerId) {
                    if (person.age >= 14 && occ !== 'noble' && occ !== 'soldier') {
                        html += `<div class="detail-section">
                            <button class="btn-medieval" onclick="UI.hirePerson('${person.id}')" style="font-size:0.8rem;padding:6px 16px;width:100%;">
                                👥 Hire as Worker
                            </button>
                        </div>`;
                    }
                }

                // ── Dark Actions ──
                html += `<div class="detail-section"><h3>🏴 Schemes</h3>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;">`;

                html += `<button class="btn-medieval" onclick="UI.stealFromPerson('${person.id}')" style="font-size:0.9rem;padding:6px 12px;background:rgba(180,40,30,0.25);border-color:rgba(180,40,30,0.5);color:var(--parchment);">💰 Steal</button>`;
                html += `<button class="btn-medieval" onclick="UI.spreadRumorsAbout('${person.id}')" style="font-size:0.9rem;padding:6px 12px;background:rgba(180,40,30,0.25);border-color:rgba(180,40,30,0.5);color:var(--parchment);">🤫 Rumors</button>`;
                html += `<button class="btn-medieval" onclick="UI.blackmailPerson('${person.id}')" style="font-size:0.9rem;padding:6px 12px;background:rgba(180,40,30,0.25);border-color:rgba(180,40,30,0.5);color:var(--parchment);">📜 Blackmail</button>`;
                html += `<button class="btn-medieval" onclick="UI.hireAssassinFor('${person.id}')" style="font-size:0.9rem;padding:6px 12px;background:rgba(120,0,0,0.3);border-color:rgba(120,0,0,0.5);color:var(--parchment);">🗡️ Assassin</button>`;
                html += `<button class="btn-medieval" onclick="UI.poisonPerson('${person.id}')" style="font-size:0.9rem;padding:6px 12px;background:rgba(80,120,0,0.3);border-color:rgba(80,120,0,0.5);color:var(--parchment);">☠️ Poison</button>`;
                html += `<button class="btn-medieval" onclick="UI.framePerson('${person.id}')" style="font-size:0.9rem;padding:6px 12px;background:rgba(180,40,30,0.25);border-color:rgba(180,40,30,0.5);color:var(--parchment);">🎭 Frame</button>`;

                html += `</div>
                    <div class="text-dim" style="font-size:0.8rem;margin-top:6px;">⚠️ Criminal actions risk detection and punishment</div>
                </div>`;
            } else if (!isInSameTown) {
                const isTraveling = typeof Player !== 'undefined' && Player.traveling;
                html += `<div class="detail-section">
                    <div class="text-dim text-center">${isTraveling ? '🚶 Currently traveling — cannot interact' : '📍 Not in the same town — travel there to interact'}</div>
                </div>`;
            }
        }

        showRightPanel(`👤 ${person.firstName || 'Person'}`, html);
    }

    function showRoadDetail(road) {
        if (!road) return;
        const fromName = road.fromTown ? road.fromTown.name : 'Unknown';
        const toName = road.toTown ? road.toTown.name : 'Unknown';
        const quality = road.quality || 1;
        const safe = road.safe !== false;
        const roadCondCfg = CONFIG.CONDITION_LEVELS ? CONFIG.CONDITION_LEVELS[road.condition || 'new'] : null;
        const roadCondIcon = roadCondCfg ? roadCondCfg.icon : '✨';
        const roadCondName = roadCondCfg ? roadCondCfg.name : 'New';
        const roadCondColor = (road.condition === 'breaking') ? 'text-danger' : (road.condition === 'destroyed') ? 'text-dim' : (road.condition === 'used') ? '' : 'text-success';

        const qualityNames = ['', 'Dirt Path', 'Paved Road', 'King\'s Highway'];

        let html = `<div class="detail-section">
            <div class="detail-row"><span class="label">From</span>
                <span class="value">${fromName}</span></div>
            <div class="detail-row"><span class="label">To</span>
                <span class="value">${toName}</span></div>
            <div class="detail-row"><span class="label">Quality</span>
                <span class="value">${qualityNames[quality] || 'Unknown'} (${quality}/3)</span></div>
            <div class="detail-row"><span class="label">Condition</span>
                <span class="value ${roadCondColor}">${roadCondIcon} ${roadCondName}${roadCondCfg && roadCondCfg.efficiency < 1 ? ' (' + Math.round(roadCondCfg.efficiency * 100) + '% speed)' : ''}</span></div>
            <div class="detail-row"><span class="label">Safety</span>
                <span class="value ${safe ? 'text-success' : 'text-danger'}">${safe ? '✓ Safe' : '⚠ Dangerous'}</span></div>
        </div>`;

        showRightPanel('🛤 Road', html);
    }

    // ═══════════════════════════════════════════════════════════
    //  MODAL DIALOGS
    // ═══════════════════════════════════════════════════════════

    function openModal(title, bodyHtml, footerHtml) {
        const mt = el.modalTitle || document.getElementById('modalTitle');
        const mb = el.modalBody || document.getElementById('modalBody');
        const mf = el.modalFooter || document.getElementById('modalFooter');
        const mo = el.modalOverlay || document.getElementById('modalOverlay');
        if (mt) mt.textContent = title;
        if (mb) mb.innerHTML = bodyHtml;
        if (mf) mf.innerHTML = footerHtml || '';
        if (mo) mo.classList.remove('hidden');
    }

    function closeModal() {
        const mo = el.modalOverlay || document.getElementById('modalOverlay');
        if (mo) mo.classList.add('hidden');
        // Flush trade batch summary when trade dialog closes
        if (tradeDialogOpen && tradeBatch.length > 0) {
            const buys = tradeBatch.filter(t => t.type === 'buy');
            const sells = tradeBatch.filter(t => t.type === 'sell');
            let msg = '📊 Trade summary: ';
            if (buys.length) msg += 'Bought ' + buys.map(b => `${b.qty} ${b.resource} (${b.total}g)`).join(', ') + '. ';
            if (sells.length) msg += 'Sold ' + sells.map(s => `${s.qty} ${s.resource} (${s.total}g)`).join(', ') + '. ';
            const netGold = sells.reduce((s, t) => s + t.total, 0) - buys.reduce((s, t) => s + t.total, 0);
            msg += `Net: ${netGold >= 0 ? '+' : ''}${netGold}g`;
            toast(msg, netGold >= 0 ? 'success' : 'info');
            if (typeof Engine !== 'undefined' && Engine.logEvent) Engine.logEvent(msg);
            tradeBatch = [];
        }
        tradeDialogOpen = false;
    }

    // ── TRADE DIALOG ──

    let tradeBatch = [];
    let tradeDialogOpen = false;

    function setTradeQty(type, resId, qty, unitPrice) {
        const input = document.getElementById(type + 'Qty_' + resId);
        if (input) input.value = qty;
        // Highlight selected button
        const container = document.getElementById(type + 'QtyBtns_' + resId);
        if (container) {
            container.querySelectorAll('.qty-btn').forEach(b => b.classList.remove('qty-selected'));
            container.querySelectorAll('.qty-btn').forEach(b => {
                if (parseInt(b.dataset.qty) === qty || (b.dataset.qty === 'max' && parseInt(input.value) === qty)) {
                    b.classList.add('qty-selected');
                }
            });
        }
        // Update preview
        const preview = document.getElementById(type + 'Preview_' + resId);
        if (preview) {
            const total = (unitPrice * qty).toFixed(1);
            const label = type === 'buy' ? 'Buy' : 'Sell';
            preview.textContent = qty > 0 ? `${label} ${qty}: ${total}g` : '';
        }
    }

    function calcMaxTradeQty(type, resId, unitPrice, supply) {
        if (type === 'buy') {
            const affordable = unitPrice > 0 ? Math.floor(Player.gold / unitPrice) : 0;
            return Math.max(0, Math.min(affordable, supply || 0));
        } else {
            return Player.inventory[resId] || 0;
        }
    }

    function openTradeDialog() {
        if (typeof Player === 'undefined' || Player.townId == null) {
            toast('You must be in a town to trade.', 'warning');
            return;
        }

        tradeBatch = [];
        tradeDialogOpen = true;

        let town;
        try { town = Engine.getTown(Player.townId); } catch (e) { /* no-op */ }
        if (!town) {
            const towns = Engine.getTowns();
            town = towns ? towns.find(t => t.id === Player.townId) : null;
        }
        if (!town || !town.market) {
            toast('No market available in this town.', 'warning');
            return;
        }

        const prices = town.market.prices || {};
        const supply = town.market.supply || {};
        const demand = town.market.demand || {};

        // Get kingdom laws for trade info
        let kingdom;
        try { kingdom = Engine.findKingdom(town.kingdomId); } catch (e) { /* no-op */ }
        const bannedGoods = (kingdom && kingdom.laws && kingdom.laws.bannedGoods) || [];
        const restrictedGoods = (kingdom && kingdom.laws && kingdom.laws.restrictedGoods) || [];
        const goodsTaxes = (kingdom && kingdom.laws && kingdom.laws.goodsTaxes) || {};
        const tariff = (kingdom && kingdom.laws && kingdom.laws.tradeTariff) || 0;
        const taxRate = (kingdom && kingdom.taxRate) || 0;
        const isForeign = typeof Player !== 'undefined' && Player.isPlayerCitizenOf ? !Player.isPlayerCitizenOf(town.kingdomId) : (town.kingdomId !== Player.citizenshipKingdomId);

        let taxDetailsInner = '';
        // Tax info
        taxDetailsInner += `<div class="text-dim" style="margin-bottom:4px;font-size:0.78rem;">📜 Kingdom Tax: ${Math.round(taxRate * 100)}%</div>`;
        if (isForeign && tariff > 0) {
            taxDetailsInner += `<div class="text-dim" style="margin-bottom:4px;font-size:0.78rem;">⚠️ Foreign kingdom — ${Math.round(tariff * 100)}% tariff + ${Math.round((CONFIG.FOREIGN_TAX_SURCHARGE || 0) * 100)}% surcharge</div>`;
        }
        if (!isForeign) {
            taxDetailsInner += `<div class="text-dim" style="margin-bottom:4px;font-size:0.78rem;">🏠 Home kingdom — ${Math.round((CONFIG.CITIZEN_TAX_DISCOUNT || 0) * 100)}% citizen discount</div>`;
        }
        // Goods-specific taxes
        const taxedGoodsHere = Object.entries(goodsTaxes);
        if (taxedGoodsHere.length > 0) {
            const taxedNames = taxedGoodsHere.map(([g, rate]) => {
                const r = findResource(g);
                return `${r ? r.icon + r.name : g} (${Math.round(rate * 100)}%)`;
            }).join(', ');
            taxDetailsInner += `<div class="text-dim" style="margin-bottom:4px;font-size:0.78rem;">💸 Goods taxes: ${taxedNames}</div>`;
        }
        if (bannedGoods.length > 0) {
            const bannedNames = bannedGoods.map(g => { const r = findResource(g); return r ? r.icon + r.name : g; }).join(', ');
            taxDetailsInner += `<div style="color:var(--danger);font-size:0.78rem;margin-bottom:4px;">🚫 Banned: ${bannedNames}</div>`;
        }
        if (restrictedGoods.length > 0) {
            const restrictedNames = restrictedGoods.map(g => {
                const r = findResource(g);
                const hasLic = Player.hasLicense(kingdom.id, g);
                return `${r ? r.icon + r.name : g} ${hasLic ? '✅' : '🔒'}`;
            }).join(', ');
            taxDetailsInner += `<div style="color:var(--gold);font-size:0.78rem;margin-bottom:4px;">🔒 Restricted: ${restrictedNames}</div>`;
        }
        // Trade embargo warning
        const isEmbargoed = isForeign && kingdom && Player.citizenshipKingdomId &&
            Engine.hasEmbargo && Engine.hasEmbargo(Player.citizenshipKingdomId, town.kingdomId);
        if (isEmbargoed) {
            taxDetailsInner += `<div style="color:var(--danger);font-size:0.78rem;margin-bottom:4px;font-weight:bold;">📜🚫 TRADE EMBARGO — Trading here is smuggling! ${Math.round(CONFIG.EMBARGO_DETECTION_CHANCE * 100)}% detection risk, ${CONFIG.EMBARGO_FINE_MULTIPLIER}x fines. Successful smuggling earns ${CONFIG.EMBARGO_SMUGGLE_PREMIUM}x sell price.</div>`;
        }

        const tradeInfoHtml = `<details class="tax-details-accordion">
            <summary class="tax-details-summary">📜 Tax Details</summary>
            <div class="tax-details-body">${taxDetailsInner}</div>
        </details>`;

        let buyHtml = '';
        let sellHtml = '';

        // Capacity bar
        const carriedWeight = Player.getCarriedWeight ? Player.getCarriedWeight() : 0;
        const carryCapacity = Player.getCarryCapacity ? Player.getCarryCapacity() : 20;
        const townStorageCap = Player.getTownStorageCapacity ? Player.getTownStorageCapacity() : 0;
        const townStorageUsed = Player.getTownStorageUsed ? Player.getTownStorageUsed() : 0;
        const containerInfo = Player.storageContainer && CONFIG.STORAGE_CONTAINERS[Player.storageContainer]
            ? CONFIG.STORAGE_CONTAINERS[Player.storageContainer] : null;
        const containerLabel = containerInfo ? (containerInfo.icon + ' ' + containerInfo.name) : '🚶 On Person';
        const carryPct = Math.min(100, Math.round((carriedWeight / carryCapacity) * 100));
        const carryBarColor = carryPct > 90 ? 'var(--danger)' : carryPct > 70 ? 'var(--gold)' : '#55a868';
        let capacityHtml = `<div style="margin-bottom:8px;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:4px;font-size:0.78rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                <span>${containerLabel}: <strong>${Math.round(carriedWeight)}/${carryCapacity}</strong> weight</span>
                <span style="font-size:0.7rem;color:var(--text-muted);">${carryPct}%</span>
            </div>
            <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${carryPct}%;background:${carryBarColor};border-radius:3px;transition:width 0.3s;"></div>
            </div>`;
        if (townStorageCap > 0) {
            const storagePct = Math.min(100, Math.round((townStorageUsed / townStorageCap) * 100));
            capacityHtml += `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;margin-bottom:3px;">
                <span>📦 Town Storage: <strong>${Math.round(townStorageUsed)}/${townStorageCap}</strong> weight</span>
                <span style="font-size:0.7rem;color:var(--text-muted);">${storagePct}%</span>
            </div>
            <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${storagePct}%;background:#5588aa;border-radius:3px;transition:width 0.3s;"></div>
            </div>`;
        }
        capacityHtml += `</div>`;

        // Buy side: what the market has
        for (const [resId, price] of Object.entries(prices)) {
            const res = findResource(resId);
            if (!res) continue;
            const qty = supply[resId] || 0;
            if (qty <= 0) continue;

            // Calculate buy price breakdown
            let gTax = goodsTaxes[resId] || 0;
            // Special law: free_trade — no goods tax
            if (kingdom && kingdom.laws && kingdom.laws.specialLaws && kingdom.laws.specialLaws.some(l => l.id === 'free_trade')) gTax = 0;
            let buyTariff = 0, buySurcharge = 0, buyCitDiscount = 0;
            if (isForeign) {
                // Special law: open_market — no tariff
                if (kingdom && kingdom.laws && kingdom.laws.specialLaws && kingdom.laws.specialLaws.some(l => l.id === 'open_market')) {
                    buyTariff = 0;
                } else {
                    buyTariff = tariff;
                }
                buySurcharge = CONFIG.FOREIGN_TAX_SURCHARGE || 0;
                // Special law: foreign_ban — extra 25% tax
                if (kingdom && kingdom.laws && kingdom.laws.specialLaws && kingdom.laws.specialLaws.some(l => l.id === 'foreign_ban')) buySurcharge += 0.25;
            }
            else { buyCitDiscount = CONFIG.CITIZEN_TAX_DISCOUNT || 0; }
            // Special law: market_day
            let marketDayDisc = 0;
            if (kingdom && kingdom.laws && kingdom.laws.specialLaws && kingdom.laws.specialLaws.some(l => l.id === 'market_day') && Engine.getDay() % 7 === 0) marketDayDisc = 0.15;
            let skillDiscPct = 0;
            if (Player.hasSkill('master_haggler')) skillDiscPct = 10;
            else if (Player.hasSkill('haggler')) skillDiscPct = 5;
            const finalUnitPrice = price * (1 + taxRate + gTax + buyTariff + buySurcharge - buyCitDiscount - marketDayDisc) * (1 - skillDiscPct / 100);

            const priceDiff = price - res.basePrice;
            const _hasKeenEye = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('keen_eye');
            const priceClass = _hasKeenEye ? (priceDiff < -1 ? 'good-deal' : priceDiff > 1 ? 'bad-deal' : 'neutral') : 'neutral';
            const isMilitary = res.category === 'military';
            const isRestricted = restrictedGoods.includes(resId);
            const isBanned = bannedGoods.includes(resId);

            // Build price tooltip
            let breakdownLines = [`Base: ${price.toFixed(1)}g`];
            if (taxRate > 0) breakdownLines.push(`Tax (${Math.round(taxRate * 100)}%): +${(price * taxRate).toFixed(1)}g`);
            if (gTax > 0) breakdownLines.push(`Goods Tax (${Math.round(gTax * 100)}%): +${(price * gTax).toFixed(1)}g`);
            if (buyTariff > 0) breakdownLines.push(`Tariff (${Math.round(buyTariff * 100)}%): +${(price * buyTariff).toFixed(1)}g`);
            if (buySurcharge > 0) breakdownLines.push(`Surcharge (${Math.round(buySurcharge * 100)}%): +${(price * buySurcharge).toFixed(1)}g`);
            if (buyCitDiscount > 0) breakdownLines.push(`Citizen Disc: -${(price * buyCitDiscount).toFixed(1)}g`);
            if (skillDiscPct > 0) breakdownLines.push(`Haggler (-${skillDiscPct}%): -${(finalUnitPrice * skillDiscPct / (100 - skillDiscPct)).toFixed(1)}g`);
            breakdownLines.push(`Final: ${finalUnitPrice.toFixed(1)}g`);
            const breakdownTooltip = breakdownLines.join('&#10;');

            let statusBadge = '';
            if (isBanned) statusBadge = '<span style="color:var(--danger);font-size:0.7rem;">🚫 BANNED</span>';
            else if (isRestricted) statusBadge = '<span style="color:var(--gold);font-size:0.7rem;">🔒 RESTRICTED</span>';

            // Seasonal demand tag
            let seasonTag = '';
            if (typeof Engine.getSeasonalDemandInfo === 'function') {
                const sMod = Engine.getSeasonalDemandInfo(resId);
                if (sMod > 1.1) seasonTag = '<span style="color:#c44e52;font-size:0.7rem;margin-left:4px;">📈 ' + Engine.getSeason() + ' demand</span>';
                else if (sMod < 0.9) seasonTag = '<span style="color:#55a868;font-size:0.7rem;margin-left:4px;">📉 ' + Engine.getSeason() + ' surplus</span>';
            }
            // Fashion trend tag
            let trendTag = '';
            if (typeof Engine.getCurrentTrends === 'function') {
                const trends = Engine.getCurrentTrends();
                const match = trends.find(t => t.goodId === resId);
                if (match) trendTag = '<span style="color:#e67e22;font-size:0.7rem;margin-left:4px;">🔥 Trending! +' + match.demandBonus + '%</span>';
            }

            const buyMaxQty = Math.max(0, Math.min(finalUnitPrice > 0 ? Math.floor(Player.gold / finalUnitPrice) : 0, qty));
            const buyQtyBtns = [1, 5, 10, 25].map(q =>
                `<button class="qty-btn${q === 1 ? ' qty-selected' : ''}" data-qty="${q}" onclick="UI.setTradeQty('buy','${resId}',${q},${finalUnitPrice.toFixed(4)})">${q}</button>`
            ).join('') + `<button class="qty-btn" data-qty="max" onclick="UI.setTradeQty('buy','${resId}',${buyMaxQty},${finalUnitPrice.toFixed(4)})">⬆Max</button>`;

            buyHtml += `<div class="trade-item ${isMilitary ? 'military-item' : ''}">
                <div class="res-info">${res.icon} ${res.name} (${Math.floor(qty)}) ${statusBadge}${seasonTag}${trendTag}</div>
                <div class="trade-controls">
                    <span class="price ${priceClass}" title="${breakdownTooltip}" style="cursor:help;">${finalUnitPrice.toFixed(1)}g</span>
                    <div class="trade-qty-selector" id="buyQtyBtns_${resId}">${buyQtyBtns}</div>
                    <span class="trade-preview" id="buyPreview_${resId}">Buy 1: ${finalUnitPrice.toFixed(1)}g</span>
                    <input type="hidden" id="buyQty_${resId}" value="1">
                    <button class="btn-trade buy" onclick="UI.executeBuy('${resId}','${town.id}')">Buy</button>
                </div>
            </div>`;
        }

        // Sell side: what the player has (carried + town storage)
        const townStorageItems = (Player.townStorage && Player.townStorage[town.id]) || {};
        // Merge carried and stored resource IDs
        const allSellResIds = new Set([
            ...Object.keys(Player.inventory || {}).filter(id => (Player.inventory[id] || 0) > 0),
            ...Object.keys(townStorageItems).filter(id => (townStorageItems[id] || 0) > 0),
        ]);
        for (const resId of allSellResIds) {
            const carriedQty = (Player.inventory || {})[resId] || 0;
            const storedQty = townStorageItems[resId] || 0;
            const qty = carriedQty + storedQty;
            if (qty <= 0) continue;
            const res = findResource(resId);
            if (!res) continue;
            const price = prices[resId] || res.basePrice;
            // Apply market spread to display price
            const spreadPct = CONFIG.MARKET_SPREAD || 0;
            const spreadPrice = price * (1 - spreadPct);

            // Calculate sell price breakdown
            let gTax2 = goodsTaxes[resId] || 0;
            if (kingdom && kingdom.laws && kingdom.laws.specialLaws && kingdom.laws.specialLaws.some(l => l.id === 'free_trade')) gTax2 = 0;
            let sellTariff = 0, sellSurcharge = 0, sellCitBonus = 0;
            if (isForeign) {
                if (kingdom && kingdom.laws && kingdom.laws.specialLaws && kingdom.laws.specialLaws.some(l => l.id === 'open_market')) {
                    sellTariff = 0;
                } else {
                    sellTariff = tariff;
                }
                sellSurcharge = CONFIG.FOREIGN_TAX_SURCHARGE || 0;
                if (kingdom && kingdom.laws && kingdom.laws.specialLaws && kingdom.laws.specialLaws.some(l => l.id === 'foreign_ban')) sellSurcharge += 0.25;
            }
            else { sellCitBonus = CONFIG.CITIZEN_TAX_DISCOUNT || 0; }
            let sellMarketDayBonus = 0;
            if (kingdom && kingdom.laws && kingdom.laws.specialLaws && kingdom.laws.specialLaws.some(l => l.id === 'market_day') && Engine.getDay() % 7 === 0) sellMarketDayBonus = 0.15;
            let skillBonusPct = 0;
            if (Player.hasSkill('golden_tongue')) skillBonusPct = 10;
            else if (Player.hasSkill('silver_tongue')) skillBonusPct = 5;
            let sellPrice = spreadPrice * (1 - taxRate - gTax2 - sellTariff - sellSurcharge + sellCitBonus - sellMarketDayBonus);
            // Sales bonus from market stall
            let salesBonus = 0;
            for (const bld of (Player.buildings || [])) {
                if (bld.type === 'market_stall' && bld.townId === town.id && bld.active) {
                    salesBonus += (BUILDING_TYPES.MARKET_STALL && BUILDING_TYPES.MARKET_STALL.salesBonus) || 0.1;
                }
            }
            const finalSellPrice = sellPrice * (1 + salesBonus) * (1 + skillBonusPct / 100);

            const priceDiff = price - res.basePrice;
            const _hasKeenEyeS = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('keen_eye');
            const priceClass = _hasKeenEyeS ? (priceDiff > 1 ? 'good-deal' : priceDiff < -1 ? 'bad-deal' : 'neutral') : 'neutral';
            const isMilitary = res.category === 'military';
            const isBanned = bannedGoods.includes(resId);
            const isRestricted = restrictedGoods.includes(resId);
            const hasLicense = kingdom && Player.hasLicense(kingdom.id, resId);

            // Price breakdown tooltip
            let breakdownLines = [`Base: ${price.toFixed(1)}g`];
            if (spreadPct > 0) breakdownLines.push(`Spread (-${Math.round(spreadPct * 100)}%): -${(price * spreadPct).toFixed(1)}g`);
            if (taxRate > 0) breakdownLines.push(`Tax (${Math.round(taxRate * 100)}%): -${(spreadPrice * taxRate).toFixed(1)}g`);
            if (gTax2 > 0) breakdownLines.push(`Goods Tax (${Math.round(gTax2 * 100)}%): -${(spreadPrice * gTax2).toFixed(1)}g`);
            if (sellTariff > 0) breakdownLines.push(`Tariff (${Math.round(sellTariff * 100)}%): -${(spreadPrice * sellTariff).toFixed(1)}g`);
            if (sellSurcharge > 0) breakdownLines.push(`Surcharge: -${(spreadPrice * sellSurcharge).toFixed(1)}g`);
            if (sellCitBonus > 0) breakdownLines.push(`Citizen Bonus: +${(spreadPrice * sellCitBonus).toFixed(1)}g`);
            if (skillBonusPct > 0) breakdownLines.push(`Silver/Golden Tongue (+${skillBonusPct}%)`);
            if (salesBonus > 0) breakdownLines.push(`Market Stall (+${Math.round(salesBonus * 100)}%)`);
            breakdownLines.push(`Final: ${finalSellPrice.toFixed(1)}g`);
            const breakdownTooltip = breakdownLines.join('&#10;');

            let statusBadge = '';
            if (isBanned) statusBadge = '<span style="color:var(--danger);font-size:0.7rem;">🚫 BANNED</span>';
            else if (isRestricted && !hasLicense) statusBadge = '<span style="color:var(--gold);font-size:0.7rem;">🔒 NO LICENSE</span>';
            else if (isRestricted && hasLicense) statusBadge = '<span style="color:#55a868;font-size:0.7rem;">📜 LICENSED</span>';

            // Show carried/stored breakdown
            let qtyLabel = `(${qty})`;
            if (carriedQty > 0 && storedQty > 0) {
                qtyLabel = `(${qty}) <span style="font-size:0.7rem;color:var(--text-muted);">🎒${carriedQty} 📦${storedQty}</span>`;
            } else if (storedQty > 0 && carriedQty <= 0) {
                qtyLabel = `(${qty}) <span style="font-size:0.7rem;color:var(--text-muted);">📦 stored</span>`;
            }

            let sellBtnLabel = 'Sell';
            if (isBanned) sellBtnLabel = '🗡️ Smuggle';
            else if (isRestricted && !hasLicense) sellBtnLabel = '⚠️ Sell (risky)';

            const sellMaxQty = qty;
            const sellQtyBtns = [1, 5, 10, 25].map(q =>
                `<button class="qty-btn${q === 1 ? ' qty-selected' : ''}" data-qty="${q}" onclick="UI.setTradeQty('sell','${resId}',${q},${finalSellPrice.toFixed(4)})">${q}</button>`
            ).join('') + `<button class="qty-btn" data-qty="max" onclick="UI.setTradeQty('sell','${resId}',${sellMaxQty},${finalSellPrice.toFixed(4)})">⬆Max</button>`;

            sellHtml += `<div class="trade-item ${isMilitary ? 'military-item' : ''} ${isBanned ? 'banned-item' : ''} ${isRestricted && !hasLicense ? 'restricted-item' : ''}">
                <div class="res-info">${res.icon} ${res.name} ${qtyLabel} ${statusBadge}</div>
                <div class="trade-controls">
                    <span class="price ${priceClass}" title="${breakdownTooltip}" style="cursor:help;">${finalSellPrice.toFixed(1)}g</span>
                    <div class="trade-qty-selector" id="sellQtyBtns_${resId}">${sellQtyBtns}</div>
                    <span class="trade-preview" id="sellPreview_${resId}">Sell 1: ${finalSellPrice.toFixed(1)}g</span>
                    <input type="hidden" id="sellQty_${resId}" value="1">
                    <button class="btn-trade sell" onclick="UI.executeSell('${resId}','${town.id}')">${sellBtnLabel}</button>
                </div>
            </div>`;
        }

        // License purchase section
        let licenseHtml = '';
        if (kingdom && restrictedGoods.length > 0) {
            const unlicensed = restrictedGoods.filter(g => !Player.hasLicense(kingdom.id, g));
            if (unlicensed.length > 0) {
                licenseHtml = '<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:8px;"><h4 style="font-size:0.8rem;color:var(--gold);margin-bottom:6px;">📜 Available Licenses</h4>';
                for (const g of unlicensed) {
                    const r = findResource(g);
                    const rName = r ? r.icon + ' ' + r.name : g;
                    licenseHtml += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <span style="font-size:0.78rem;">${rName} — ${CONFIG.LICENSE_FEE}g</span>
                        <button class="btn-trade buy" style="font-size:0.7rem;" onclick="UI.buyLicense('${kingdom.id}','${g}')">Buy License</button>
                    </div>`;
                }
                licenseHtml += '</div>';
            }
        }

        if (!buyHtml) buyHtml = '<div class="text-dim text-center">No goods available</div>';
        if (!sellHtml) sellHtml = '<div class="text-dim text-center">No goods to sell</div>';

        const marketIntelHtml = buildMarketIntelHtml(town.id);

        // Build deposit/withdraw section if player has warehouses here
        let storageManageHtml = '';
        if (townStorageCap > 0) {
            let depositItems = '';
            let withdrawItems = '';
            // Deposit: show carried items
            for (const [resId, cQty] of Object.entries(Player.inventory || {})) {
                if (cQty <= 0) continue;
                const r = findResource(resId);
                if (!r) continue;
                depositItems += `<div style="display:flex;justify-content:space-between;align-items:center;margin:2px 0;font-size:0.75rem;">
                    <span>${r.icon} ${r.name} (${cQty})</span>
                    <div style="display:flex;gap:3px;">
                        <button class="qty-btn" onclick="UI.depositToStorage('${resId}',1)" style="font-size:0.7rem;padding:1px 5px;">1</button>
                        <button class="qty-btn" onclick="UI.depositToStorage('${resId}',${Math.min(5,cQty)})" style="font-size:0.7rem;padding:1px 5px;">${Math.min(5,cQty)}</button>
                        <button class="qty-btn" onclick="UI.depositToStorage('${resId}',${cQty})" style="font-size:0.7rem;padding:1px 5px;">All</button>
                    </div>
                </div>`;
            }
            // Withdraw: show stored items
            for (const [resId, sQty] of Object.entries(townStorageItems)) {
                if (sQty <= 0) continue;
                const r = findResource(resId);
                if (!r) continue;
                withdrawItems += `<div style="display:flex;justify-content:space-between;align-items:center;margin:2px 0;font-size:0.75rem;">
                    <span>${r.icon} ${r.name} (${sQty})</span>
                    <div style="display:flex;gap:3px;">
                        <button class="qty-btn" onclick="UI.withdrawFromStorage('${resId}',1)" style="font-size:0.7rem;padding:1px 5px;">1</button>
                        <button class="qty-btn" onclick="UI.withdrawFromStorage('${resId}',${Math.min(5,sQty)})" style="font-size:0.7rem;padding:1px 5px;">${Math.min(5,sQty)}</button>
                        <button class="qty-btn" onclick="UI.withdrawFromStorage('${resId}',${sQty})" style="font-size:0.7rem;padding:1px 5px;">All</button>
                    </div>
                </div>`;
            }
            if (!depositItems) depositItems = '<div class="text-dim" style="font-size:0.72rem;">Nothing to deposit</div>';
            if (!withdrawItems) withdrawItems = '<div class="text-dim" style="font-size:0.72rem;">Nothing to withdraw</div>';
            storageManageHtml = `<details style="border-top:1px solid var(--border);padding-top:6px;margin-top:6px;">
                <summary style="cursor:pointer;font-size:0.8rem;font-weight:bold;">📦 Warehouse Storage (${Math.round(townStorageUsed)}/${townStorageCap})</summary>
                <div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:200px;">
                        <div style="font-size:0.75rem;font-weight:bold;margin-bottom:4px;">📥 Deposit</div>
                        ${depositItems}
                    </div>
                    <div style="flex:1;min-width:200px;">
                        <div style="font-size:0.75rem;font-weight:bold;margin-bottom:4px;">📤 Withdraw</div>
                        ${withdrawItems}
                    </div>
                </div>
            </details>`;
        }

        const html = `${capacityHtml}${tradeInfoHtml}<div class="trade-columns">
            <div class="trade-column"><h3>Buy from Market</h3>${buyHtml}</div>
            <div class="trade-column"><h3>Sell to Market</h3>${sellHtml}</div>
        </div>
        ${storageManageHtml}
        ${licenseHtml}
        ${marketIntelHtml}
        <div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap;">
            <button class="btn-trade" style="font-size:0.7rem;background:rgba(100,150,200,0.15);border-color:rgba(100,150,200,0.3);" onclick="UI.askTavernFoodTrends()">📊 Food Trends (5g)</button>
            <button class="btn-trade" style="font-size:0.7rem;background:rgba(200,120,50,0.15);border-color:rgba(200,120,50,0.3);" onclick="UI.askTavernFashionTrends()">🎭 Fashion Trends (10g)</button>
        </div>
        <div class="trade-summary">Your gold: <span class="gold-value">🪙 ${formatGold(Player.gold)}</span></div>`;

        openModal(`📊 Trade — ${town.name}`, html);
    }

    function executeBuy(resId, townId) {
        const qtyInput = document.getElementById('buyQty_' + resId);
        const qty = qtyInput ? parseInt(qtyInput.value) : 1;
        try {
            const result = Player.buy(resId, qty, townId);
            if (result && result.success) {
                const resName = findResource(resId)?.name || resId;
                tradeBatch.push({ type: 'buy', resource: resName, qty: qty, total: result.totalCost || 0 });
            } else {
                toast((result && result.message) || 'Trade failed', 'warning');
            }
            openTradeDialog(); // refresh
        } catch (e) {
            toast(e.message || 'Trade failed', 'danger');
        }
    }

    function executeSell(resId, townId) {
        const qtyInput = document.getElementById('sellQty_' + resId);
        const qty = qtyInput ? parseInt(qtyInput.value) : 1;
        try {
            const result = Player.sell(resId, qty, townId);
            if (result && result.success) {
                if (result.smuggled) {
                    toast(result.message, 'warning');
                } else {
                    const resName = findResource(resId)?.name || resId;
                    tradeBatch.push({ type: 'sell', resource: resName, qty: qty, total: result.totalRevenue || 0 });
                }
            } else if (result && result.caught) {
                toast(result.message, 'danger');
            } else {
                toast((result && result.message) || 'Trade failed', 'warning');
            }
            openTradeDialog(); // refresh
        } catch (e) {
            toast(e.message || 'Trade failed', 'danger');
        }
    }

    function quickBuy(resId, townId) {
        try {
            Player.buy(resId, 1, townId);
            toast(`Bought 1× ${findResource(resId)?.name || resId}`, 'success', 'my_actions');
            update();
        } catch (e) {
            toast(e.message || 'Cannot buy', 'danger');
        }
    }

    function quickSell(resId, townId) {
        try {
            Player.sell(resId, 1, townId);
            toast(`Sold 1× ${findResource(resId)?.name || resId}`, 'success', 'my_actions');
            update();
        } catch (e) {
            toast(e.message || 'Cannot sell', 'danger');
        }
    }

    function buyLicense(kingdomId, resourceId) {
        const result = Player.petitionForLicense(kingdomId, resourceId);
        if (result.success) {
            toast(result.message, 'success');
        } else {
            toast(result.message, 'warning');
        }
        openTradeDialog(); // refresh
    }

    // ── BUILD DIALOG ──

    function openBuildDialog() {
        if (typeof Player === 'undefined' || Player.townId == null) {
            toast('You must be in a town to build.', 'warning');
            return;
        }

        let town;
        try { town = Engine.getTown(Player.townId); } catch (e) { /* no-op */ }
        if (!town) {
            const towns = Engine.getTowns();
            town = towns ? towns.find(t => t.id === Player.townId) : null;
        }

        const categories = ['farm', 'mine', 'harvest', 'processing', 'finished', 'military', 'luxury', 'storage', 'trade'];
        const catNames = { farm: '🌾 Farms', mine: '⛏ Mines', harvest: '🪓 Harvest', processing: '⚙ Processing',
                           finished: '🏭 Finished', military: '⚔ Military', luxury: '👗 Luxury', storage: '📦 Storage', trade: '🏪 Trade', port: '⚓ Port' };

        let catHtml = '';
        for (const cat of categories) {
            catHtml += `<button class="btn-category" data-cat="${cat}" onclick="UI.filterBuildings('${cat}')">${catNames[cat] || cat}</button>`;
        }

        let gridHtml = '';
        for (const [key, bt] of Object.entries(BUILDING_TYPES)) {
            // Calculate dynamic material cost from local market
            var matCost = 0;
            var matsOk = true;
            if (bt.materials && town) {
                for (var matId in bt.materials) {
                    var qty = bt.materials[matId];
                    var pHas = (Player.state && Player.state.inventory && Player.state.inventory[matId]) || 0;
                    var mHas = (town.market && town.market.supply[matId]) || 0;
                    if (pHas + mHas < qty) matsOk = false;
                    var needBuy = Math.max(0, qty - pHas);
                    if (needBuy > 0) {
                        var mp = 0;
                        try { mp = Engine.getMarketPrice(town.id, matId) || 0; } catch(e2) {}
                        if (mp <= 0) { var r2 = findResource(matId); mp = r2 ? (r2.basePrice || 5) : 5; }
                        matCost += needBuy * mp;
                    }
                }
            }
            var laborCost = bt.cost || 0;
            var totalBuildCost = laborCost + matCost;
            const canAfford = (Player.gold || 0) >= totalBuildCost && matsOk;
            const consumesStr = Object.entries(bt.consumes || {}).map(([r, q]) => {
                const res = findResource(r);
                return `${res ? res.icon : ''} ${q}`;
            }).join(', ') || 'None';
            const producesRes = bt.produces ? findResource(bt.produces) : null;
            const producesStr = producesRes ? `${producesRes.icon} ${producesRes.name}` : (bt.storage ? `📦 +${bt.storage} storage` : bt.salesBonus ? `📈 +${Math.round(bt.salesBonus * 100)}% sales` : bt.livestockCapacity ? `🐄 Holds ${bt.livestockCapacity} livestock` : bt.archerBonus ? `🏹 Archer +${Math.round(bt.archerBonus * 100)}%` : '—');

            // Material requirements string
            let materialsStr = '';
            if (bt.materials && Object.keys(bt.materials).length > 0) {
                materialsStr = Object.entries(bt.materials).map(([r, q]) => {
                    const matRes = findResource(r);
                    return `${matRes ? matRes.icon : ''} ${q}`;
                }).join(', ');
            }

            gridHtml += `<div class="build-card ${canAfford ? '' : 'cant-afford'}" data-category="${bt.category}" onclick="UI.executeBuild('${bt.id}','${town ? town.id : ''}')">
                <div class="build-name">${bt.name}</div>
                <div class="build-cost">🪙 ${Math.ceil(totalBuildCost)}g (labor: ${Math.ceil(laborCost)}g${matCost > 0 ? ' + materials: ' + Math.ceil(matCost) + 'g' : ''}) | 👥 ${bt.workers} workers</div>
                <div class="build-info">Produces: ${producesStr}<br>Consumes: ${consumesStr}<br>Rate: ${bt.rate}/day${materialsStr ? '<br>🔨 Materials: ' + materialsStr : ''}${!matsOk ? '<br><span style="color:#c44e52;">⚠ Materials unavailable!</span>' : ''}</div>
            </div>`;
        }

        // NPC buildings for sale section
        let saleHtml = '';
        if (town) {
            const offers = Engine.getNPCBuildingSaleOffers(town.id);
            if (offers.length > 0) {
                saleHtml += '<div style="margin-top:12px;padding:8px;border:1px solid var(--border);border-radius:4px;">';
                saleHtml += '<div style="font-weight:bold;font-size:0.85rem;margin-bottom:6px;">🏠 BUY EXISTING BUILDING</div>';
                for (let i = 0; i < offers.length; i++) {
                    const offer = offers[i];
                    const bldIdx = town.buildings.indexOf(offer.building);
                    const obt = Engine.findBuildingType(offer.building.type);
                    const bldName = obt ? obt.name : offer.building.type;
                    const condLabel = offer.building.condition || 'new';
                    const canAffordOffer = (Player.gold || 0) >= offer.price;
                    saleHtml += `<div class="build-card ${canAffordOffer ? '' : 'cant-afford'}" style="cursor:pointer;" onclick="UI.purchaseNPCBuildingUI(${bldIdx},'${town.id}')">
                        <div class="build-name">${bldName} (Lv.${offer.building.level || 1})</div>
                        <div class="build-cost">🪙 ${Math.ceil(+offer.price)}g | ${condLabel}</div>
                        <div class="build-info">${offer.reason}</div>
                    </div>`;
                }
                saleHtml += '</div>';
            }
        }

        const html = `<div class="build-categories">${catHtml}</div>
            <div class="build-grid" id="buildGrid">${gridHtml}</div>${saleHtml}`;

        openModal(`🏗️ Build — ${town ? town.name : ''}`, html);
        // Auto-select first category
        setTimeout(() => filterBuildings('farm'), 0);
    }

    function filterBuildings(category) {
        const cards = document.querySelectorAll('.build-card');
        const btns = document.querySelectorAll('.btn-category');
        btns.forEach(b => b.classList.toggle('active', b.dataset.cat === category));
        cards.forEach(card => {
            card.style.display = card.dataset.category === category ? '' : 'none';
        });
    }

    function executeBuild(buildingType, townId) {
        try {
            Player.buildBuilding(buildingType, townId);
            toast(`Built ${findBuildingType(buildingType)?.name || buildingType}!`, 'success', 'my_business');
            closeModal();
        } catch (e) {
            toast(e.message || 'Cannot build', 'danger');
        }
    }

    // ── BUILDING MANAGEMENT ──

    function openBuildingManagement() {
        if (!Player.buildings || Player.buildings.length === 0) {
            toast('You have no buildings to manage.', 'warning');
            return;
        }

        // Group buildings by town
        const byTown = {};
        for (const bld of Player.buildings) {
            if (!byTown[bld.townId]) byTown[bld.townId] = [];
            byTown[bld.townId].push(bld);
        }

        let html = '<div class="building-mgmt">';

        for (const [townId, buildings] of Object.entries(byTown)) {
            const town = Engine.findTown(townId);
            const tName = town ? town.name : 'Unknown';
            html += `<div style="margin-bottom:12px;"><h4 style="font-size:0.85rem;margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:4px;">📍 ${tName}</h4>`;

            for (const bld of buildings) {
                const info = Player.getBuildingStatus(bld.id);
                const bt = info ? info.type : Engine.findBuildingType(bld.type);
                const bName = bt ? bt.name : bld.type;

                // Status badge
                let statusBadge = '';
                if (info) {
                    const statusMap = {
                        producing: '<span style="color:#55a868;">✅ Producing</span>',
                        blocked: '<span style="color:var(--danger);">❌ Blocked</span>',
                        no_workers: '<span style="color:var(--gold);">👷 No Workers</span>',
                        inactive: '<span style="color:#888;">⏸️ Inactive</span>',
                        damaged: '<span style="color:var(--danger);">🔥 Damaged</span>',
                        depleted: '<span style="color:var(--danger);">⛏️ Depleted</span>',
                        idle: '<span style="color:#888;">💤 Idle</span>',
                        delivering: '<span style="color:#c4a35a;">📦 Delivering</span>',
                    };
                    statusBadge = statusMap[info.status] || '';
                }

                // Condition
                const condCfg = CONFIG.CONDITION_LEVELS ? CONFIG.CONDITION_LEVELS[bld.condition || 'new'] : null;
                const condIcon = condCfg ? condCfg.icon : '✨';

                // Security
                let securityIcon = '';
                if (bld.hasGuard && bld.lockedStorage) securityIcon = '🛡️🔒';
                else if (bld.hasGuard) securityIcon = '🛡️';
                else if (bld.lockedStorage) securityIcon = '🔒';

                // Production info
                let prodInfo = '';
                if (info && bt && bt.produces) {
                    const prodRes = findResource(bt.produces);
                    const prodName = prodRes ? prodRes.name : bt.produces;
                    prodInfo = `<span style="font-size:0.72rem;color:#aaa;">📦 ${info.dailyOutput} ${prodName}/day</span>`;
                    if (info.stored > 0) {
                        prodInfo += ` <span style="font-size:0.72rem;color:var(--gold);">| Storage: ${info.stored}</span>`;
                    }
                    if (Object.keys(info.consumes).length > 0) {
                        const consumeStr = Object.entries(info.consumes).map(([rId, qty]) => {
                            const r = findResource(rId);
                            return qty + ' ' + (r ? r.name : rId);
                        }).join(', ');
                        prodInfo += `<br><span style="font-size:0.72rem;color:#aaa;">⚙️ Consumes: ${consumeStr}/day</span>`;
                    }
                    if (info.missingInputs.length > 0) {
                        const missingStr = info.missingInputs.map(m => {
                            const r = findResource(m.id);
                            return (r ? r.name : m.id) + ' (' + m.available + '/' + m.needed + ')';
                        }).join(', ');
                        prodInfo += `<br><span style="font-size:0.72rem;color:var(--danger);">⚠️ Missing: ${missingStr}</span>`;
                    }
                }

                // Retail info for retail buildings
                if (bt && bt.retailConfig) {
                    var rRev = bld.retailRevenue || 0;
                    var rStock = 0;
                    if (bld.retailStock) { for (var rk in bld.retailStock) rStock += bld.retailStock[rk]; }
                    var rMaxStock = (bt.retailConfig.maxStock || 50) * bld.level;
                    prodInfo += (prodInfo ? '<br>' : '') + '<span style="font-size:0.72rem;color:#aaa;">🏪 Stock: ' + rStock + '/' + rMaxStock + '</span>';
                    if (rRev > 0) prodInfo += ' <span style="font-size:0.72rem;color:var(--gold);">| 💰 Revenue: ' + Math.floor(rRev).toLocaleString() + 'g</span>';
                }

                // Workers
                const wCount = info ? info.workerCount : bld.workers.length;
                const wMax = info ? info.workerMax : (bt ? bt.workers : '?');

                html += `<div class="building-mgmt-card" style="border:1px solid var(--border);padding:8px;margin-bottom:6px;border-radius:4px;cursor:pointer;" onclick="UI.showBuildingDetail('${bld.id}')">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <strong>${bName} ${condIcon}</strong> <span class="text-dim" style="font-size:0.75rem;">Lv.${bld.level}</span>
                            ${securityIcon ? '<span style="margin-left:4px;">' + securityIcon + '</span>' : ''}
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            ${statusBadge}
                            <span style="font-size:0.72rem;color:#aaa;">👷 ${wCount}/${wMax}</span>
                        </div>
                    </div>
                    ${(function() {
                        let extra = '';
                        if (bld.transferEnabled && bld.transferTarget) {
                            const _targetBld = Player.buildings.find(function(b) { return b.id === bld.transferTarget; });
                            const _targetBt = _targetBld ? Engine.findBuildingType(_targetBld.type) : null;
                            const _targetName = bld.transferTarget === 'warehouse' ? 'Storage' : bld.transferTarget === 'market' ? 'Market' : (_targetBt ? _targetBt.name : '?');
                            extra += ' <span style="font-size:0.7rem;color:#55a868;">🚚→' + _targetName + '</span>';
                        }
                        if (bld._delivering) {
                            extra += ' <span style="font-size:0.7rem;color:#c4a35a;">📦 Delivering (' + (bld._deliveryDaysLeft || 0) + 'd)</span>';
                        }
                        return extra ? '<div style="margin-top:2px;">' + extra + '</div>' : '';
                    })()}
                    ${prodInfo ? '<div style="margin-top:4px;">' + prodInfo + '</div>' : ''}
                    <div style="text-align:right;margin-top:4px;">
                        <span style="font-size:0.7rem;color:var(--link);text-decoration:underline;">View Details →</span>
                    </div>
                </div>`;
            }
            html += '</div>';
        }
        html += '</div>';

        // Protection racket status
        if (Player.protectionRacket && Player.protectionRacket.active) {
            html += '<div style="border-top:1px solid var(--border);padding-top:8px;margin-top:12px;">';
            html += '<h4 style="font-size:0.8rem;color:var(--danger);margin-bottom:6px;">💀 Protection Racket</h4>';
            if (Player.protectionRacket.paying) {
                html += `<div style="font-size:0.78rem;">Currently paying ${CONFIG.PROTECTION_RACKET_FEE}g/season.</div>`;
                html += `<button class="btn-trade sell" style="font-size:0.7rem;margin-top:4px;" onclick="UI.racketResponse('refuse')">Stop Paying</button>`;
            } else {
                html += `<div style="font-size:0.78rem;color:var(--danger);">The criminal faction demands ${CONFIG.PROTECTION_RACKET_FEE}g/season for protection.</div>`;
                html += `<div style="display:flex;gap:8px;margin-top:6px;">
                    <button class="btn-trade buy" style="font-size:0.7rem;" onclick="UI.racketResponse('pay')">💰 Pay</button>
                    <button class="btn-trade sell" style="font-size:0.7rem;" onclick="UI.racketResponse('refuse')">✋ Refuse</button>
                    ${Player.hasSkill('intimidating_presence') ? '<button class="btn-trade" style="font-size:0.7rem;background:#4682b4;color:#fff;" onclick="UI.racketResponse(\'intimidate\')">💪 Intimidate</button>' : ''}
                </div>`;
            }
            html += '</div>';
        }

        openModal('🏗️ Building Management', html);
    }

    function showBuildingDetail(buildingId) {
        const info = Player.getBuildingStatus(buildingId);
        if (!info) { toast('Building not found.', 'warning'); return; }
        const bld = info.building;
        const bt = info.type;
        const town = info.town;
        const bName = bt ? bt.name : bld.type;
        const tName = town ? town.name : 'Unknown';

        // Condition display
        const condCfg = CONFIG.CONDITION_LEVELS ? CONFIG.CONDITION_LEVELS[bld.condition || 'new'] : null;
        const condIcon = condCfg ? condCfg.icon : '✨';
        const condName = condCfg ? condCfg.name : 'New';
        const condEff = info.conditionEfficiency;

        // Status display
        const statusLabels = {
            producing: '✅ Producing',
            blocked: '❌ Blocked',
            no_workers: '👷 No Workers',
            inactive: '⏸️ Inactive',
            damaged: '🔥 Damaged',
            depleted: '⛏️ Deposit Depleted',
            idle: '💤 Idle',
            delivering: '📦 Delivering Goods',
        };
        let statusText = statusLabels[info.status] || info.status;
        if (info.status === 'blocked' && info.missingInputs.length > 0) {
            const missing = info.missingInputs.map(m => { const r = findResource(m.id); return r ? r.name : m.id; }).join(', ');
            statusText += ' (no ' + missing + ')';
        }

        let html = '<div style="max-height:70vh;overflow-y:auto;">';

        // Header
        html += `<div style="padding:8px;border-bottom:1px solid var(--border);margin-bottom:8px;">
            <div style="font-size:1rem;font-weight:bold;">🏭 ${bName} (Level ${bld.level}) — ${tName}</div>
            <div style="font-size:0.8rem;margin-top:4px;">Condition: ${condIcon} ${condName} (${Math.round(condEff * 100)}% efficiency)</div>
            <div style="font-size:0.8rem;margin-top:2px;">Status: ${statusText}</div>
        </div>`;

        // PRODUCTION section
        if (bt.produces) {
            const currentProduct = bld.currentProduct || bld.productionChoice || bt.produces;
            const prodRes = findResource(currentProduct);
            const prodName = prodRes ? (prodRes.icon || '') + ' ' + prodRes.name : currentProduct;

            html += `<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">
                <div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">📦 PRODUCTION</div>`;

            // Product selection dropdown for multi-product buildings
            const productOptions = bt.canProduce || (bt.availableProducts ? Object.keys(bt.availableProducts) : null);
            if (productOptions && productOptions.length > 1) {
                html += `<div style="margin-bottom:6px;font-size:0.78rem;">
                    <span>Producing: </span>
                    <select id="productSelect" style="font-size:0.75rem;padding:2px 4px;background:#2a2520;color:#e8dcc8;border:1px solid #555;border-radius:4px;">`;
                for (const pId of productOptions) {
                    const pRes = findResource(pId);
                    const pName = pRes ? pRes.name : pId;
                    const selected = pId === currentProduct ? 'selected' : '';
                    html += `<option value="${pId}" ${selected}>${pName}</option>`;
                }
                html += `</select>
                    <button class="btn-trade buy" style="font-size:0.7rem;margin-left:4px;" onclick="UI.setBuildingProductUI('${bld.id}')">Set</button>
                </div>`;
            }

            // Consumes
            if (Object.keys(info.consumes).length > 0) {
                for (const [resId, qty] of Object.entries(info.consumes)) {
                    const r = findResource(resId);
                    const rName = r ? r.name : resId;
                    const townSupply = (town && town.market && town.market.supply[resId]) || 0;
                    html += `<div style="font-size:0.78rem;">⚙️ Consumes: ${qty} ${rName}/day (town supply: ${Math.floor(townSupply)})</div>`;
                }
            }

            // Produces
            html += `<div style="font-size:0.78rem;">🔨 Produces: ${info.dailyOutput} ${prodName}/day</div>`;

            // Output rate breakdown
            html += `<div style="font-size:0.72rem;color:#aaa;margin-top:4px;">Output: ${bt.rate} base × ${info.workerFraction.toFixed(2)} workers × ${info.seasonMod} season × ${bld.level} level × ${info.prodBonus.toFixed(2)} bonus = ${info.dailyOutput}</div>`;

            // Current storage
            html += `<div style="font-size:0.78rem;margin-top:4px;">📋 Current Storage: ${info.stored} ${prodName}</div>`;

            // Collect button
            if (info.stored > 0 && bld.townId === Player.townId) {
                html += `<div style="margin-top:6px;display:flex;gap:6px;">
                    <button class="btn-trade buy" style="font-size:0.7rem;" onclick="UI.collectOutputUI('${bld.id}','${currentProduct}',10)">Collect 10</button>
                    <button class="btn-trade buy" style="font-size:0.7rem;" onclick="UI.collectOutputUI('${bld.id}','${currentProduct}',${info.stored})">Collect All (${info.stored})</button>
                </div>`;
            }

            html += '</div>';
        }

        // RETAIL section (for retail/service buildings)
        if (bt.retailConfig) {
            var rc = bt.retailConfig;
            var retailStatus = Player.getRetailBuildingStatus ? Player.getRetailBuildingStatus(bld.id) : null;
            var stockTotal = retailStatus ? retailStatus.stockTotal : 0;
            var maxStock = retailStatus ? retailStatus.maxStock : (rc.maxStock || 50);
            var markup = retailStatus ? retailStatus.markup : ((rc.markup || 1.5).toFixed(1));
            var revenue = bld.retailRevenue || 0;
            var totalSold = bld.retailTotalSold || 0;
            var totalEarned = bld.retailTotalEarned || 0;
            var stockPct = maxStock > 0 ? Math.round(stockTotal / maxStock * 100) : 0;
            var stockColor = stockPct > 60 ? '#55a868' : stockPct > 20 ? 'var(--gold)' : 'var(--danger)';

            html += '<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">';
            html += '<div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">🏪 RETAIL</div>';

            // Revenue display
            html += '<div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:4px;">';
            html += '<span>💰 Uncollected Revenue: <strong style="color:var(--gold);">' + Math.floor(revenue).toLocaleString() + 'g</strong></span>';
            html += '<span style="color:#888;">Lifetime: ' + Math.floor(totalEarned).toLocaleString() + 'g (' + totalSold + ' sales)</span>';
            html += '</div>';

            if (revenue > 0 && bld.townId === Player.townId) {
                html += '<button class="btn-trade buy" style="font-size:0.7rem;margin-bottom:6px;" onclick="UI.collectRetailRevenueUI(\'' + bld.id + '\')">💰 Collect ' + Math.floor(revenue).toLocaleString() + 'g</button> ';
            }

            // Markup info
            html += '<div style="font-size:0.75rem;color:#aaa;margin-bottom:4px;">📊 Markup: ' + (typeof markup === 'number' ? markup.toFixed(1) : markup) + 'x | Motivation: ' + (rc.motivation || 'need') + ' | Max Customers: ' + (rc.customersPerDay || 5) + '/day</div>';

            // Stock level bar
            html += '<div style="font-size:0.78rem;margin-bottom:4px;">📦 Stock: <span style="color:' + stockColor + ';">' + stockTotal + '/' + maxStock + '</span></div>';
            html += '<div style="background:#333;border-radius:3px;height:8px;margin-bottom:6px;overflow:hidden;">';
            html += '<div style="background:' + stockColor + ';height:100%;width:' + stockPct + '%;transition:width 0.3s;"></div></div>';

            // Current stock items
            if (retailStatus && retailStatus.stock && retailStatus.stock.length > 0) {
                html += '<div style="font-size:0.75rem;margin-bottom:6px;">';
                for (var si = 0; si < retailStatus.stock.length; si++) {
                    var item = retailStatus.stock[si];
                    html += '<span style="margin-right:8px;">' + (item.icon || '📦') + ' ' + item.name + ': ' + item.qty + '</span>';
                }
                html += '</div>';
            }

            // Stock/Unstock controls — only when player is in same town
            if (bld.townId === Player.townId) {
                var acceptsGoods = rc.acceptsGoods || [];
                html += '<div style="margin-top:4px;"><strong style="font-size:0.75rem;">Stock Items:</strong></div>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">';
                for (var gi = 0; gi < acceptsGoods.length; gi++) {
                    var goodId = acceptsGoods[gi];
                    var goodRes = findResource(goodId);
                    var goodName = goodRes ? goodRes.name : goodId;
                    var goodIcon = goodRes ? (goodRes.icon || '📦') : '📦';
                    var playerHas = (Player.inventory && Player.inventory[goodId]) || 0;
                    var inStock = (bld.retailStock && bld.retailStock[goodId]) || 0;
                    if (playerHas > 0 || inStock > 0) {
                        html += '<div style="border:1px solid #444;border-radius:4px;padding:3px 6px;font-size:0.72rem;background:rgba(0,0,0,0.2);">';
                        html += goodIcon + ' ' + goodName + ' (inv:' + playerHas + ' stock:' + inStock + ') ';
                        if (playerHas > 0) {
                            html += '<button class="btn-trade buy" style="font-size:0.65rem;padding:1px 6px;" onclick="UI.stockRetailUI(\'' + bld.id + '\',\'' + goodId + '\',5)">+5</button> ';
                            html += '<button class="btn-trade buy" style="font-size:0.65rem;padding:1px 6px;" onclick="UI.stockRetailUI(\'' + bld.id + '\',\'' + goodId + '\',' + playerHas + ')">All</button> ';
                        }
                        if (inStock > 0) {
                            html += '<button class="btn-trade sell" style="font-size:0.65rem;padding:1px 6px;" onclick="UI.unstockRetailUI(\'' + bld.id + '\',\'' + goodId + '\',' + inStock + ')">↩</button>';
                        }
                        html += '</div>';
                    }
                }
                html += '</div>';

                // Show items player has that could be stocked but aren't shown yet
                var unstockedGoods = acceptsGoods.filter(function(gid) {
                    var playerQ = (Player.inventory && Player.inventory[gid]) || 0;
                    var stockQ = (bld.retailStock && bld.retailStock[gid]) || 0;
                    return playerQ === 0 && stockQ === 0;
                });
                if (unstockedGoods.length > 0) {
                    html += '<div style="font-size:0.7rem;color:#666;margin-top:4px;">Also accepts: ' + unstockedGoods.map(function(g) { var r = findResource(g); return r ? r.name : g; }).join(', ') + '</div>';
                }
            }

            // Service building info
            if (rc.serviceType) {
                html += '<div style="font-size:0.75rem;color:#aaa;margin-top:6px;">🏥 Service: ' + (rc.serviceType || 'treatment') + ' | Fee: ' + (rc.serviceFee || 5) + 'g/customer</div>';
                if (rc.consumesPerService) {
                    var consumeList = [];
                    for (var cKey in rc.consumesPerService) {
                        consumeList.push(rc.consumesPerService[cKey] + ' ' + cKey);
                    }
                    html += '<div style="font-size:0.72rem;color:#888;">Consumes per service: ' + consumeList.join(', ') + '</div>';
                }
            }

            html += '</div>';
        }

        // WORKERS section
        html += `<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">
            <div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">👷 WORKERS (${info.workerCount}/${info.workerMax} staffed)</div>`;

        if (bld.workers.length > 0) {
            for (const wId of bld.workers) {
                const person = Engine.findPerson(wId);
                const pName = person ? (person.firstName + ' ' + person.lastName) : wId;
                const skill = person && person.skills && person.skills[bt.category] ? person.skills[bt.category] : 0;
                let skillLabel = 'Unskilled';
                if (skill >= 80) skillLabel = 'Master';
                else if (skill >= 60) skillLabel = 'Expert';
                else if (skill >= 40) skillLabel = 'Skilled';
                else if (skill >= 20) skillLabel = 'Trained';

                html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:0.78rem;">
                    <span>• ${pName} — Skill: ${skill} (${skillLabel})</span>
                    <button class="btn-trade sell" style="font-size:0.7rem;padding:2px 6px;" onclick="UI.removeWorkerUI('${wId}','${bld.id}')">Remove</button>
                </div>`;
            }
        } else {
            html += '<div style="font-size:0.78rem;color:#888;">No workers assigned.</div>';
        }

        // Assign worker button
        if (info.workerCount < info.workerMax) {
            const unassigned = Player.employees.filter(eId => {
                for (const b of Player.buildings) {
                    if (b.workers.includes(eId)) return false;
                }
                return true;
            });
            if (unassigned.length > 0) {
                html += `<div style="margin-top:6px;"><select id="assignWorkerSelect" style="font-size:0.75rem;padding:2px 4px;margin-right:4px;">`;
                for (const eId of unassigned) {
                    const p = Engine.findPerson(eId);
                    const nm = p ? (p.firstName + ' ' + p.lastName) : eId;
                    html += `<option value="${eId}">${nm}</option>`;
                }
                html += `</select><button class="btn-trade buy" style="font-size:0.7rem;" onclick="UI.assignWorkerUI('${bld.id}')">+ Assign</button></div>`;
            } else {
                html += `<div style="font-size:0.72rem;color:#aaa;margin-top:4px;">No unassigned employees. <button class="btn-trade" style="font-size:0.7rem;" onclick="UI.openHireDialog()">Hire Workers</button></div>`;
            }
        }

        html += '</div>';

        // SUPPLY INPUTS section
        if (Object.keys(info.consumes).length > 0) {
            html += `<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">
                <div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">📥 SUPPLY INPUTS</div>`;

            for (const [resId, qty] of Object.entries(info.consumes)) {
                const r = findResource(resId);
                const rName = r ? r.name : resId;
                const townSupply = (town && town.market && town.market.supply[resId]) || 0;
                const playerHas = Player.inventory[resId] || 0;

                html += `<div style="font-size:0.78rem;margin-bottom:4px;">${rName}: Town has ${Math.floor(townSupply)} | You carry ${playerHas}</div>`;
                if (playerHas > 0 && bld.townId === Player.townId) {
                    const supplyQty = Math.min(5, playerHas);
                    html += `<div style="display:flex;gap:4px;margin-bottom:4px;">
                        <button class="btn-trade buy" style="font-size:0.7rem;" onclick="UI.supplyBuildingUI('${bld.id}','${resId}',${supplyQty})">Supply ${supplyQty}</button>
                        <button class="btn-trade buy" style="font-size:0.7rem;" onclick="UI.supplyBuildingUI('${bld.id}','${resId}',${playerHas})">Supply All (${playerHas})</button>
                    </div>`;
                }
            }

            // Auto-buy toggle
            html += `<div style="margin-top:6px;font-size:0.78rem;">
                <label style="cursor:pointer;"><input type="checkbox" ${info.autoBuy ? 'checked' : ''} onchange="UI.toggleAutoBuyUI('${bld.id}')"> Auto-buy inputs from market</label>
            </div>`;

            html += '</div>';
        }

        // ── SUPPLY CHAIN TRANSFER ──
        if (bt.produces) {
            const targets = Player.getTransferTargets(buildingId);
            const currentTarget = bld.transferTarget;
            const transferEnabled = bld.transferEnabled || false;
            const hasGuild = Player.hasTransportGuild(bld.townId);
            
            html += '<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">';
            html += '<div style="font-weight:bold;font-size:0.85rem;margin-bottom:6px;">🚚 SUPPLY CHAIN TRANSFER</div>';
            
            if (info.delivering) {
                html += '<div style="color:#c4a35a;font-size:0.8rem;">📦 Workers delivering goods... (' + info.deliveryDaysLeft + ' days left)</div>';
            }
            
            html += '<div style="font-size:0.75rem;color:#aaa;margin-bottom:6px;">';
            if (hasGuild) {
                html += '✅ Transport Guild active — instant transfers';
            } else {
                html += '⚠️ No Transport Guild — workers will pause production to deliver (' + (CONFIG.TRANSFER_WORKER_DELIVERY_DAYS || 2) + ' day delay every ' + (CONFIG.TRANSFER_STORAGE_THRESHOLD || 30) + ' units)';
            }
            html += '</div>';
            
            html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
            html += '<span style="font-size:0.8rem;">Send ' + bt.produces + ' to:</span>';
            html += '<select id="transferTargetSelect" style="padding:4px 8px;background:#2a2520;color:#e8dcc8;border:1px solid #555;border-radius:4px;font-size:0.8rem;">';
            html += '<option value="">-- None (Town Storage) --</option>';
            for (const t of targets) {
                var selected = currentTarget === t.id ? 'selected' : '';
                var warning = !t.makesSense ? ' ⚠️' : '';
                var label;
                if (t.id === 'warehouse') label = '📦 ' + t.name;
                else if (t.id === 'market') label = '🏪 ' + t.name;
                else if (t.isWarehouse) label = '📦 ' + t.name + ' Lv.' + t.level;
                else label = '🏭 ' + t.name + ' Lv.' + t.level + warning;
                html += '<option value="' + t.id + '" ' + selected + '>' + label + '</option>';
            }
            html += '</select>';
            html += '<button class="btn-small" onclick="UI.setTransferTarget(\'' + buildingId + '\')" style="font-size:0.75rem;">Set</button>';
            if (transferEnabled) {
                html += '<button class="btn-small" onclick="UI.clearTransfer(\'' + buildingId + '\')" style="font-size:0.75rem;background:rgba(200,50,50,0.15);">Clear</button>';
            }
            html += '</div>';
            
            if (transferEnabled && currentTarget) {
                var targetName = currentTarget === 'warehouse' ? 'Town Storage' : currentTarget === 'market' ? 'Town Market' : '?';
                if (currentTarget !== 'warehouse' && currentTarget !== 'market') {
                    var tb = Player.buildings.find(function(b) { return b.id === currentTarget; });
                    if (tb) {
                        var tbt = Engine.findBuildingType(tb.type);
                        targetName = tbt ? tbt.name : currentTarget;
                    }
                }
                html += '<div style="font-size:0.8rem;color:#55a868;margin-top:4px;">✅ Transferring ' + bt.produces + ' → ' + targetName + '</div>';
            }
            
            html += '</div>';
        }

        // UPGRADE section
        if (bt.cost) {
            let upgradeCost = Math.floor(bt.cost * bld.level * 0.75);
            if (Player.hasSkill && Player.hasSkill('building_upgrade_discount')) upgradeCost = Math.floor(upgradeCost * 0.75);
            const nextLevel = bld.level + 1;

            html += `<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">
                <div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">⬆️ UPGRADE</div>
                <div style="font-size:0.78rem;">Level ${bld.level} → ${nextLevel} (Cost: ${upgradeCost}g)</div>
                <div style="font-size:0.72rem;color:#aaa;">+50% production output per level</div>
                <button class="btn-trade buy" style="font-size:0.7rem;margin-top:4px;" onclick="UI.upgradeBuildingUI('${bld.id}')">⬆️ Upgrade (${upgradeCost}g)</button>
            </div>`;
        }

        // MAINTENANCE section
        const needsRepair = bld.condition === 'used' || bld.condition === 'breaking' || bld.condition === 'destroyed';
        const repairCostEst = bt ? (bld.condition === 'destroyed' ? Math.floor(bt.cost * 0.5) : bld.condition === 'breaking' ? Math.floor(bt.cost * 0.3) : Math.floor(bt.cost * 0.2)) : '?';
        const warehouseTypes = ['warehouse', 'warehouse_small', 'warehouse_large'];

        html += `<div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:8px;">
            <div style="font-weight:bold;font-size:0.8rem;margin-bottom:6px;">🔧 MAINTENANCE</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">`;

        if (needsRepair) {
            html += `<button class="btn-trade buy" style="font-size:0.7rem;background:rgba(200,100,0,0.15);border-color:rgba(200,100,0,0.3);" onclick="UI.repairBuilding('${bld.id}')">🔨 Repair (${repairCostEst}g)</button>`;
        }
        html += `<button class="btn-trade ${bld.hasGuard ? 'sell' : 'buy'}" style="font-size:0.7rem;" onclick="UI.toggleGuard('${bld.id}');UI.showBuildingDetail('${bld.id}');">
            ${bld.hasGuard ? '🛡️ Dismiss Guard' : '🛡️ Hire Guard (' + CONFIG.BUILDING_GUARD_COST_PER_SEASON + 'g/season)'}
        </button>`;
        if (!bld.lockedStorage) {
            html += `<button class="btn-trade buy" style="font-size:0.7rem;" onclick="UI.buyLockedStorage('${bld.id}');UI.showBuildingDetail('${bld.id}');">🔒 Lock Storage (${CONFIG.BUILDING_LOCKED_STORAGE_COST}g)</button>`;
        }
        if (bt && bt.category === 'farm') {
            html += `<button class="btn-trade" style="font-size:0.7rem;${bld.fallow ? 'background:rgba(85,168,104,0.15);border-color:rgba(85,168,104,0.3);' : 'background:rgba(200,160,0,0.15);border-color:rgba(200,160,0,0.3);'}" onclick="UI.toggleFarmFallow('${bld.id}');UI.showBuildingDetail('${bld.id}');">${bld.fallow ? '🌾 Resume Farming' : '🌿 Set Fallow'}</button>`;
        }
        if (warehouseTypes.includes(bld.type)) {
            html += `<button class="btn-trade buy" style="font-size:0.7rem;" onclick="UI.openWarehouseSecurityDialog('${bld.id}')">🔐 Security Upgrades</button>`;
        }

        html += `</div></div>`;

        // Back button
        html += `<div style="text-align:center;margin-top:8px;">
            <button class="btn-trade" style="font-size:0.75rem;" onclick="UI.openBuildingManagement()">← Back to All Buildings</button>
        </div>`;

        html += '</div>';

        openModal('🏭 ' + bName + ' — Details', html);
    }

    function supplyBuildingUI(buildingId, resourceId, quantity) {
        const result = Player.supplyBuilding(buildingId, resourceId, quantity);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function collectOutputUI(buildingId, resourceId, quantity) {
        const result = Player.collectBuildingOutput(buildingId, resourceId, quantity);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function stockRetailUI(buildingId, resourceId, quantity) {
        if (!Player.stockRetailBuilding) { toast('Retail stocking not available', 'warning'); return; }
        var result = Player.stockRetailBuilding(buildingId, resourceId, quantity);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function unstockRetailUI(buildingId, resourceId, quantity) {
        if (!Player.unstockRetailBuilding) { toast('Retail unstocking not available', 'warning'); return; }
        var result = Player.unstockRetailBuilding(buildingId, resourceId, quantity);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function collectRetailRevenueUI(buildingId) {
        if (!Player.collectRetailRevenue) { toast('Revenue collection not available', 'warning'); return; }
        var result = Player.collectRetailRevenue(buildingId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function toggleAutoBuyUI(buildingId) {
        const result = Player.toggleAutoBuy(buildingId);
        toast(result.message, result.success ? 'success' : 'info');
        if (result.success) showBuildingDetail(buildingId);
    }

    function setTransferTargetUI(buildingId) {
        const select = document.getElementById('transferTargetSelect');
        if (!select) return;
        const targetId = select.value || null;
        const result = Player.setTransferTarget(buildingId, targetId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }
    
    function clearTransferUI(buildingId) {
        const result = Player.setTransferTarget(buildingId, null);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function setBuildingProductUI(buildingId) {
        const select = document.getElementById('productSelect');
        if (!select || !select.value) { toast('Select a product first.', 'warning'); return; }
        const result = Player.setBuildingProduct(buildingId, select.value);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function purchaseNPCBuildingUI(buildingIndex, townId) {
        const result = Player.purchaseNPCBuilding(buildingIndex, townId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) {
            openBuildDialog();
        }
    }

    function assignWorkerUI(buildingId) {
        const sel = document.getElementById('assignWorkerSelect');
        if (!sel || !sel.value) { toast('Select a worker first.', 'warning'); return; }
        const result = Player.assignWorker(sel.value, buildingId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function removeWorkerUI(personId, buildingId) {
        const result = Player.removeWorkerFromBuilding(personId, buildingId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function upgradeBuildingUI(buildingId) {
        const result = Player.upgradeBuilding(buildingId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showBuildingDetail(buildingId);
    }

    function toggleGuard(buildingId) {
        const result = Player.toggleBuildingGuard(buildingId);
        toast(result.message, result.success ? 'success' : 'warning');
        openBuildingManagement();
    }

    function buyLockedStorage(buildingId) {
        const result = Player.purchaseLockedStorage(buildingId);
        toast(result.message, result.success ? 'success' : 'warning');
        openBuildingManagement();
    }

    function toggleFarmFallow(buildingId) {
        const bld = (Player.buildings || []).find(b => b.id === buildingId);
        if (!bld) { toast('Building not found.', 'warning'); return; }
        const result = Player.setFarmFallow(buildingId, !bld.fallow);
        toast(result.message, result.success ? 'success' : 'warning');
        openBuildingManagement();
    }

    function openWarehouseSecurityDialog(buildingId) {
        const bld = (Player.buildings || []).find(b => b.id === buildingId);
        if (!bld) { toast('Building not found.', 'warning'); return; }
        const bt = Engine.findBuildingType(bld.type);
        const bName = bt ? bt.name : bld.type;

        let html = '<div style="padding:8px;">';
        html += '<h4 style="margin-bottom:8px;">🔐 Security Upgrades for ' + bName + '</h4>';

        const installed = bld.securityUpgrades || [];
        for (const [upgradeId, cfg] of Object.entries(CONFIG.WAREHOUSE_SECURITY)) {
            const isInstalled = installed.includes(upgradeId);
            const matStr = Object.entries(cfg.materials).map(function(e) { return e[0].replace('_', ' ') + ': ' + e[1]; }).join(', ');
            html += '<div style="border:1px solid var(--border);padding:8px;margin:6px 0;border-radius:4px;' + (isInstalled ? 'opacity:0.6;' : '') + '">';
            html += '<div><strong>' + cfg.icon + ' ' + cfg.name + '</strong></div>';
            html += '<div style="font-size:0.8rem;">Theft reduction: -' + Math.round(cfg.theftReduction * 100) + '%</div>';
            if (cfg.catchChance) html += '<div style="font-size:0.8rem;">Catch chance: ' + Math.round(cfg.catchChance * 100) + '%</div>';
            if (cfg.wageCost) html += '<div style="font-size:0.8rem;">Daily wage: ' + cfg.wageCost + 'g</div>';
            html += '<div style="font-size:0.75rem;color:#888;">Cost: ' + cfg.cost + 'g | Materials: ' + matStr + '</div>';
            if (isInstalled) {
                html += '<div style="color:#55a868;font-size:0.8rem;margin-top:4px;">✅ Installed</div>';
            } else {
                html += '<button class="btn-trade buy" style="font-size:0.7rem;margin-top:4px;" onclick="UI.installWarehouseSecurity(\'' + buildingId + '\',\'' + upgradeId + '\')">Install (' + cfg.cost + 'g)</button>';
            }
            html += '</div>';
        }
        html += '</div>';
        openModal('🔐 Warehouse Security', html);
    }

    function installWarehouseSecurity(buildingId, upgradeId) {
        const result = Player.installWarehouseSecurity(buildingId, upgradeId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) openWarehouseSecurityDialog(buildingId);
    }

    function racketResponse(response) {
        const result = Player.respondToRacket(response);
        toast(result.message, result.success ? 'success' : 'warning');
        openBuildingManagement();
    }

    // ── HIRE DIALOG ──

    let _cachedUnemployed = [];

    function openHireDialog() {
        if (typeof Player === 'undefined' || Player.townId == null) {
            toast('You must be in a town to hire workers.', 'warning');
            return;
        }

        let people;
        try { people = Engine.getPeople(Player.townId); } catch (e) { people = []; }
        _cachedUnemployed = (people || []).filter(p => p.alive && (p.occupation === 'none' || !p.occupation || !p.employerId));

        const availableHtml = buildWorkerListHtml(_cachedUnemployed);

        // Current employees
        let employeeHtml = '';
        const employees = Player.employees || [];
        for (const empId of employees.slice(0, 30)) {
            let emp;
            try { emp = Engine.getPerson(empId); } catch (e) { continue; }
            if (!emp) continue;
            const assigned = Player.buildings ? Player.buildings.find(b => b.workers && b.workers.includes(empId)) : null;
            employeeHtml += `<div class="worker-row">
                <div class="worker-info">
                    <div class="name">${emp.firstName || ''} ${emp.lastName || ''}</div>
                    <div class="details">${assigned ? 'Assigned to: ' + (findBuildingType(assigned.type)?.name || assigned.type) : 'Unassigned'}</div>
                </div>
                <div>
                    <button class="btn-assign" onclick="UI.showAssignDialog('${empId}')">Assign</button>
                    <button class="btn-fire" onclick="UI.fireWorker('${empId}')">Fire</button>
                </div>
            </div>`;
        }
        if (!employeeHtml) employeeHtml = '<div class="text-dim text-center">No employees yet</div>';

        const filterBar = `<div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap;">
            <select id="workerFilterSkill" onchange="UI.filterWorkerList()" style="padding:4px 8px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:4px;font-size:0.8rem;">
                <option value="all">All Skills</option>
                <option value="farming">Farming</option>
                <option value="mining">Mining</option>
                <option value="crafting">Crafting</option>
                <option value="trading">Trading</option>
                <option value="combat">Combat</option>
            </select>
            <select id="workerSortBy" onchange="UI.filterWorkerList()" style="padding:4px 8px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:4px;font-size:0.8rem;">
                <option value="skill_desc">Best Skill ↓</option>
                <option value="skill_asc">Best Skill ↑</option>
                <option value="wage_asc">Lowest Wage ↑</option>
                <option value="wage_desc">Highest Wage ↓</option>
                <option value="age_asc">Youngest ↑</option>
                <option value="age_desc">Oldest ↓</option>
            </select>
            <input type="text" id="workerSearchName" placeholder="Search name..." oninput="UI.filterWorkerList()" style="padding:4px 8px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:4px;font-size:0.8rem;flex:1;min-width:100px;">
        </div>`;

        const html = `<div class="hire-tabs">
            <button class="btn-tab active" onclick="UI.switchHireTab('available')">Available (${_cachedUnemployed.length})</button>
            <button class="btn-tab" onclick="UI.switchHireTab('employees')">Employees (${employees.length})</button>
            <button class="btn-tab" onclick="UI.switchHireTab('marriage')">💍 Marriage</button>
        </div>
        <div id="hireTabAvailable">${filterBar}<div id="workerListContainer" class="worker-list">${availableHtml}</div></div>
        <div id="hireTabEmployees" class="worker-list" style="display:none">${employeeHtml}</div>
        <div id="hireTabMarriage" class="worker-list" style="display:none">${buildMarriageTab()}</div>`;

        openModal('👥 Hire Workers', html);
    }

    function getWorkerBestSkill(p) {
        if (!p.skills) return { skill: 'none', value: 0 };
        let best = 'none', bestVal = 0;
        for (const [s, v] of Object.entries(p.skills)) {
            if (v > bestVal) { best = s; bestVal = v; }
        }
        return { skill: best, value: bestVal };
    }

    function getWorkerOverallScore(p) {
        if (!p.skills) return 0;
        let total = 0;
        for (const v of Object.values(p.skills)) total += (v || 0);
        return total;
    }

    function getWorkerExpectedWage(p) {
        const best = getWorkerBestSkill(p);
        if (best.value >= 70) return CONFIG.WORKER_WEEKLY_WAGES ? CONFIG.WORKER_WEEKLY_WAGES.expert : 50;
        if (best.value >= 40) return CONFIG.WORKER_WEEKLY_WAGES ? CONFIG.WORKER_WEEKLY_WAGES.skilled : 18;
        return CONFIG.WORKER_WEEKLY_WAGES ? CONFIG.WORKER_WEEKLY_WAGES.unskilled : 5;
    }

    function getWorkerBuildingFit(p) {
        if (!Player.buildings || !Player.buildings.length || !p.skills) return [];
        const fits = [];
        const skillBuildingMap = {
            farming: ['wheat_farm', 'cattle_ranch', 'sheep_farm', 'vineyard', 'hemp_farm', 'pig_farm', 'bakery'],
            mining: ['iron_mine', 'smelter', 'salt_works', 'brick_kiln'],
            crafting: ['sawmill', 'weaver', 'tanner', 'tailor', 'toolsmith', 'blacksmith', 'carpenter', 'jeweler', 'rope_maker'],
            trading: ['market_stall', 'winery', 'smokehouse'],
            combat: ['guard_post'],
        };
        for (const bld of Player.buildings) {
            for (const [skill, types] of Object.entries(skillBuildingMap)) {
                if (types.includes(bld.type) && (p.skills[skill] || 0) >= 30) {
                    const bt = findBuildingType(bld.type);
                    const bName = bt ? bt.name : bld.type;
                    const quality = (p.skills[skill] || 0) >= 60 ? '🟢 Great' : '🟡 OK';
                    fits.push(`${quality} fit for ${bName}`);
                }
            }
        }
        return fits;
    }

    function buildWorkerCardHtml(p) {
        const skillIcons = { farming: '🌾', mining: '⛏️', crafting: '🔨', trading: '📊', combat: '⚔️' };
        const skillColors = { farming: '#55a868', mining: '#5dade2', crafting: '#f5b041', trading: '#af7ac5', combat: '#c44e52' };
        const sexIcon = p.sex === 'F' ? '♀' : '♂';
        const best = getWorkerBestSkill(p);
        const overall = getWorkerOverallScore(p);
        const wage = getWorkerExpectedWage(p);
        const fits = getWorkerBuildingFit(p);

        let skillBars = '<div style="display:flex;gap:3px;margin:4px 0;flex-wrap:wrap;">';
        for (const sk of ['farming', 'mining', 'crafting', 'trading', 'combat']) {
            const val = (p.skills && p.skills[sk]) || 0;
            const isBest = sk === best.skill;
            skillBars += `<div style="flex:1;min-width:50px;" title="${sk}: ${val}">
                <div style="font-size:0.6rem;color:${isBest ? '#ffd700' : '#888'};text-align:center;">${skillIcons[sk]}${isBest ? '★' : ''}</div>
                <div style="height:4px;background:#333;border-radius:2px;overflow:hidden;">
                    <div style="width:${val}%;height:100%;background:${skillColors[sk]};"></div>
                </div>
            </div>`;
        }
        skillBars += '</div>';

        let fitHtml = '';
        if (fits.length > 0) {
            fitHtml = `<div style="font-size:0.65rem;color:#8f8;margin-top:2px;">${fits.slice(0, 2).join(' | ')}</div>`;
        }

        const occText = p.occupation && p.occupation !== 'none' ? `<span style="color:#aaa;font-size:0.7rem;"> • ${p.occupation}</span>` : '';

        return `<div class="worker-row" style="flex-direction:column;align-items:stretch;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div class="worker-info" style="flex:1;">
                    <div class="name">${p.firstName || ''} ${p.lastName || ''} <span style="color:#888;font-size:0.75rem;">${sexIcon} Age ${p.age || '?'}</span>${occText}</div>
                </div>
                <button class="btn-hire" onclick="UI.hirePerson('${p.id}')">Hire</button>
            </div>
            ${skillBars}
            <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#aaa;">
                <span>Best: <b style="color:${skillColors[best.skill] || '#ddd'}">${skillIcons[best.skill] || ''} ${best.skill} (${best.value})</b></span>
                <span>Overall: ${overall}</span>
                <span>Wage: <b style="color:#ffd700;">~${wage}g/wk</b></span>
            </div>
            ${fitHtml}
        </div>`;
    }

    function buildWorkerListHtml(workers) {
        if (!workers || workers.length === 0) return '<div class="text-dim text-center">No workers match your criteria</div>';
        let html = '';
        for (const p of workers.slice(0, 30)) {
            html += buildWorkerCardHtml(p);
        }
        if (workers.length > 30) {
            html += `<div class="text-dim text-center">+${workers.length - 30} more — refine filters to see others</div>`;
        }
        return html;
    }

    function filterWorkerList() {
        const filterEl = document.getElementById('workerFilterSkill');
        const sortEl = document.getElementById('workerSortBy');
        const searchEl = document.getElementById('workerSearchName');
        const container = document.getElementById('workerListContainer');
        if (!container) return;

        const filterSkill = filterEl ? filterEl.value : 'all';
        const sortBy = sortEl ? sortEl.value : 'skill_desc';
        const searchName = searchEl ? searchEl.value.toLowerCase() : '';

        let filtered = _cachedUnemployed.slice();

        // Name filter
        if (searchName) {
            filtered = filtered.filter(p => {
                const name = ((p.firstName || '') + ' ' + (p.lastName || '')).toLowerCase();
                return name.includes(searchName);
            });
        }

        // Skill filter
        if (filterSkill !== 'all') {
            filtered = filtered.filter(p => p.skills && (p.skills[filterSkill] || 0) >= 10);
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'skill_desc': return getWorkerBestSkill(b).value - getWorkerBestSkill(a).value;
                case 'skill_asc': return getWorkerBestSkill(a).value - getWorkerBestSkill(b).value;
                case 'wage_asc': return getWorkerExpectedWage(a) - getWorkerExpectedWage(b);
                case 'wage_desc': return getWorkerExpectedWage(b) - getWorkerExpectedWage(a);
                case 'age_asc': return (a.age || 0) - (b.age || 0);
                case 'age_desc': return (b.age || 0) - (a.age || 0);
                default: return 0;
            }
        });

        container.innerHTML = buildWorkerListHtml(filtered);
    }

    function switchHireTab(tab) {
        const btns = document.querySelectorAll('.hire-tabs .btn-tab');
        btns.forEach((btn, i) => {
            const tabs = ['available', 'employees', 'marriage'];
            btn.classList.toggle('active', tabs[i] === tab);
        });
        const tabAvailable = document.getElementById('hireTabAvailable');
        const tabEmployees = document.getElementById('hireTabEmployees');
        const tabMarriage = document.getElementById('hireTabMarriage');
        if (tabAvailable) tabAvailable.style.display = tab === 'available' ? '' : 'none';
        if (tabEmployees) tabEmployees.style.display = tab === 'employees' ? '' : 'none';
        if (tabMarriage) tabMarriage.style.display = tab === 'marriage' ? '' : 'none';
    }

    function buildMarriageTab() {
        if (!Player.canMarry || !Player.canMarry()) {
            if (Player.spouseId) {
                let spouseName = 'your spouse';
                let spouseHtml = '';
                try {
                    const spouse = Engine.findPerson(Player.spouseId);
                    if (spouse) {
                        spouseName = spouse.firstName + ' ' + spouse.lastName;
                        spouseHtml = buildSpouseDetailPanel(spouse);
                    }
                } catch (e) { /* no-op */ }
                return `<div class="text-dim text-center" style="margin-bottom:8px;">You are married to ${spouseName}.</div>${spouseHtml}`;
            }
            return '<div class="text-dim text-center">You cannot marry at this time.</div>';
        }

        const candidates = Player.getCourtshipCandidates ? Player.getCourtshipCandidates() : (Player.getMarriageCandidates ? Player.getMarriageCandidates() : []);
        if (candidates.length === 0) {
            return '<div class="text-dim text-center">No eligible candidates in this town.</div>';
        }

        let html = '<div class="text-dim" style="margin-bottom:8px;font-size:0.8rem;">Date candidates to learn about them. Build relationship to 60+ before proposing.</div>';
        for (const c of candidates) {
            const p = c.person || c;
            const rel = c.relationship || (Player.getRelationship ? Player.getRelationship(p.id) : { level: 0, type: 'acquaintance' });
            const relLabel = Player.getRelationshipLabel ? Player.getRelationshipLabel(rel.level) : { icon: '🤝', name: 'Acquaintance' };
            const sexIcon = p.sex === 'F' ? '♀' : '♂';
            const canPropose = rel.level >= CONFIG.COURTSHIP_MIN_RELATIONSHIP;

            // Investigator status
            const caughtCount = (Player.investigatorCaught && Player.investigatorCaught[p.id]) || 0;
            const permanentReject = caughtCount >= 2;

            // Personality impression
            const impression = Player.getPersonalityImpression ? Player.getPersonalityImpression(p) : '';

            // Revealed info
            const revealed = Player.getRevealedInfo ? Player.getRevealedInfo(p.id) : { traits: {}, quirks: [] };
            const revealedCount = Object.keys(revealed.traits).length;
            const quirksCount = revealed.quirks.length;
            const totalQuirks = (p.quirks || []).length;

            // Trait bars
            let traitHtml = '';
            if (revealedCount > 0) {
                traitHtml += '<div style="font-size:0.7rem;margin-top:4px;">';
                for (const [trait, val] of Object.entries(revealed.traits)) {
                    const label = trait.charAt(0).toUpperCase() + trait.slice(1);
                    if (typeof val === 'number') {
                        const barWidth = val;
                        traitHtml += `<div style="display:flex;align-items:center;gap:4px;margin:1px 0;"><span style="width:80px;color:var(--gold);">${label}</span><div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;"><div style="width:${barWidth}%;height:100%;background:var(--gold);border-radius:3px;"></div></div><span style="width:24px;text-align:right;">${val}</span></div>`;
                    } else {
                        traitHtml += `<div style="display:flex;align-items:center;gap:4px;margin:1px 0;"><span style="width:80px;color:var(--gold);">${label}</span><span>${val}</span></div>`;
                    }
                }
                traitHtml += '</div>';
            }

            // Quirk display with effects
            let quirkHtml = '';
            if (quirksCount > 0 && typeof SPOUSE_QUIRKS !== 'undefined') {
                quirkHtml += '<div style="font-size:0.7rem;margin-top:2px;">';
                for (const qId of revealed.quirks) {
                    const qDef = SPOUSE_QUIRKS.find(q => q.id === qId);
                    if (qDef) {
                        const color = qDef.positive ? 'rgba(100,200,100,0.8)' : 'rgba(200,100,100,0.8)';
                        quirkHtml += `<div style="margin:1px 0;color:${color};">${qDef.icon} ${qDef.name} — <span class="text-dim">${qDef.effect}</span></div>`;
                    }
                }
                quirkHtml += '</div>';
            }

            // Investigator warning
            let investigatorWarning = '';
            if (permanentReject) {
                investigatorWarning = '<div style="color:#ff4444;font-size:0.7rem;margin-top:2px;">❌ She will never marry you.</div>';
            } else if (caughtCount === 1) {
                investigatorWarning = '<div style="color:#ffaa00;font-size:0.7rem;margin-top:2px;">⚠️ She is suspicious of you. One more investigation = permanent rejection.</div>';
            }

            // Investigator cost
            let investigatorCost = 200;
            try {
                const rankIdx = Math.min(3, Math.floor((p.age || 18) / 10));
                investigatorCost = 200 * Math.pow(2, rankIdx);
            } catch (e) { /* default */ }

            // Discovery buttons
            let discoveryButtons = '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;">';
            if (!permanentReject) {
                discoveryButtons += `<button class="btn-hire" onclick="UI.hireInvestigator('${p.id}')" style="font-size:0.7rem;padding:3px 6px;background:rgba(150,100,200,0.15);border-color:rgba(150,100,200,0.3);" title="Hire someone to investigate this person. 50% chance of being caught!">🕵️ Hire Investigator (${investigatorCost}g)</button>`;
            }
            discoveryButtons += `<button class="btn-hire" onclick="UI.askTavernAbout('${p.id}')" style="font-size:0.7rem;padding:3px 6px;background:rgba(180,150,80,0.15);border-color:rgba(180,150,80,0.3);" title="Ask around at the tavern for gossip (5g)">🍺 Ask at Tavern (5g)</button>`;
            discoveryButtons += `<button class="btn-hire" onclick="UI.observePerson('${p.id}')" style="font-size:0.7rem;padding:3px 6px;background:rgba(100,150,180,0.15);border-color:rgba(100,150,180,0.3);" title="Spend 8 hours observing (free, 30% chance to spot a quirk)">👀 Observe (8 hours)</button>`;
            discoveryButtons += '</div>';

            // Dating buttons
            let dateButtons = '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;">';
            if (typeof DATING_ACTIVITIES !== 'undefined' && !permanentReject) {
                for (const act of DATING_ACTIVITIES) {
                    const disabled = (act.minRelationship && rel.level < act.minRelationship) || (act.cost > 0 && Player.gold < act.cost);
                    const title = `${act.description} (${act.cost > 0 ? act.cost + 'g, ' : ''}${act.timeHours}h, +${act.relationshipGain} rel)`;
                    dateButtons += `<button class="btn-hire ${disabled ? 'disabled' : ''}" onclick="UI.goOnDate('${p.id}','${act.id}')" style="font-size:0.7rem;padding:3px 6px;${disabled ? 'opacity:0.4;' : ''}" ${disabled ? 'disabled' : ''} title="${title}">${act.name}</button>`;
                }
            }
            dateButtons += '</div>';

            html += `<div class="worker-row" style="flex-direction:column;align-items:stretch;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div class="worker-info">
                        <div class="name">${sexIcon} ${p.firstName || ''} ${p.lastName || ''}, Age ${p.age || '?'}</div>
                        <div class="details">${p.occupation || 'Unknown'} | ${relLabel.icon} ${relLabel.name} (${Math.floor(rel.level)})</div>
                        ${impression ? `<div class="text-dim" style="font-size:0.75rem;font-style:italic;">"${impression}"</div>` : ''}
                        <div class="text-dim" style="font-size:0.7rem;">🔍 Known: ${revealedCount}/6 traits, ${quirksCount}/${totalQuirks} quirks</div>
                    </div>
                    <div style="display:flex;gap:4px;">
                        <button class="btn-hire" onclick="UI.openGiftDialog('${p.id}')" style="font-size:0.75rem;background:rgba(100,180,100,0.15);border-color:rgba(100,180,100,0.3);">🎁 Gift</button>
                        <button class="btn-hire ${canPropose && !permanentReject ? '' : 'disabled'}" onclick="UI.proposeMarriage('${p.id}')" style="background:rgba(196,163,90,0.15);border-color:rgba(196,163,90,0.3);color:var(--gold);${canPropose && !permanentReject ? '' : 'opacity:0.5;'}" ${canPropose && !permanentReject ? '' : 'disabled'}>💍 Propose</button>
                    </div>
                </div>
                ${investigatorWarning}${traitHtml}${quirkHtml}${discoveryButtons}${dateButtons}
            </div>`;
        }
        return html;
    }

    function goOnDate(personId, activityId) {
        try {
            const result = Player.goOnDate(personId, activityId);
            if (result && result.success) {
                toast(result.message, 'success');
                openHireDialog(); // refresh to show updated traits
            } else {
                toast((result && result.message) || 'Cannot go on date', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Cannot go on date', 'danger');
        }
    }

    function hireInvestigator(personId) {
        try {
            const result = Player.hireInvestigator(personId);
            if (result && result.success) {
                toast(result.message, 'success');
            } else {
                toast((result && result.message) || 'Investigation failed', result && result.permanent ? 'danger' : 'warning');
            }
            openHireDialog(); // refresh
        } catch (e) {
            toast(e.message || 'Cannot investigate', 'danger');
        }
    }

    function askTavernAbout(personId) {
        try {
            const result = Player.askTavernAbout(personId);
            if (result && result.success) {
                toast(result.message, 'info');
            } else {
                toast((result && result.message) || 'Cannot ask', 'warning');
            }
            openHireDialog(); // refresh
        } catch (e) {
            toast(e.message || 'Cannot ask', 'danger');
        }
    }

    function talkToPerson(personId) {
        if (typeof Player === 'undefined') return;
        const result = Player.goOnDate(personId, 'walk');
        if (result && result.success) {
            toast(result.message, 'success');
            try {
                const person = Engine.getPerson(personId);
                if (person) showPersonDetail(person);
            } catch (e) { /* no-op */ }
        } else {
            toast((result && result.message) || 'Cannot talk right now.', 'warning');
        }
    }

    function usePerk(personId, perkId) {
        if (typeof Player === 'undefined' || !Player.useRelationshipPerk) return;
        const result = Player.useRelationshipPerk(personId, perkId);
        toast(result.message, result.success ? 'success' : 'warning');
        try {
            const person = Engine.getPerson(personId);
            if (person) showPersonDetail(person);
        } catch (e) { /* no-op */ }
    }

    function dateAction(personId, activityId) {
        if (typeof Player === 'undefined') return;
        const result = Player.goOnDate(personId, activityId);
        if (result && result.success) {
            toast(result.message, 'success');
            try {
                const person = Engine.getPerson(personId);
                if (person) showPersonDetail(person);
            } catch (e) { /* no-op */ }
        } else {
            toast((result && result.message) || 'Cannot do this activity.', 'warning');
        }
    }

    function proposeTo(personId) {
        if (typeof Player === 'undefined' || !Player.marry) return;
        const result = Player.marry(personId);
        if (result && result.success) {
            toast(result.message, 'success');
            try {
                const person = Engine.getPerson(personId);
                if (person) showPersonDetail(person);
            } catch (e) { /* no-op */ }
        } else {
            toast((result && result.message) || 'Proposal failed.', 'warning');
        }
    }

    function stealFromPerson(personId) {
        if (typeof Player === 'undefined') return;
        if (Player.stealGoods) {
            const result = Player.stealGoods(personId);
            toast((result && result.message) || 'Theft attempted.', result && result.success ? 'success' : 'warning');
            try { const p = Engine.getPerson(personId); if (p) showPersonDetail(p); } catch(e) {}
        } else {
            toast('Stealing is not available yet.', 'warning');
        }
    }

    function spreadRumorsAbout(personId) {
        if (typeof Player === 'undefined') return;
        if (Player.spreadRumors) {
            const result = Player.spreadRumors(personId);
            toast((result && result.message) || 'Rumors spread.', result && result.success ? 'success' : 'warning');
            try { const p = Engine.getPerson(personId); if (p) showPersonDetail(p); } catch(e) {}
        } else {
            toast('Spreading rumors is not available yet.', 'warning');
        }
    }

    function blackmailPerson(personId) {
        if (typeof Player === 'undefined') return;
        if (Player.blackmailNPC) {
            const result = Player.blackmailNPC(personId);
            toast((result && result.message) || 'Blackmail attempted.', result && result.success ? 'success' : 'warning');
            try { const p = Engine.getPerson(personId); if (p) showPersonDetail(p); } catch(e) {}
        } else {
            toast('Blackmail is not available yet.', 'warning');
        }
    }

    function hireAssassinFor(personId) {
        if (typeof Player === 'undefined') return;
        if (Player.hireAssassin) {
            const result = Player.hireAssassin(personId);
            toast((result && result.message) || 'Assassin hired.', result && result.success ? 'success' : 'warning', 'my_business');
            try { const p = Engine.getPerson(personId); if (p) showPersonDetail(p); } catch(e) {}
        } else {
            toast('Assassination is not available yet.', 'warning');
        }
    }

    function poisonPerson(personId) {
        if (typeof Player === 'undefined') return;
        if (Player.poisonTarget) {
            const result = Player.poisonTarget(personId);
            toast((result && result.message) || 'Poison administered.', result && result.success ? 'success' : 'warning');
            try { const p = Engine.getPerson(personId); if (p) showPersonDetail(p); } catch(e) {}
        } else {
            toast('Poison is not available yet.', 'warning');
        }
    }

    function framePerson(personId) {
        if (typeof Player === 'undefined') return;
        if (Player.frameCompetitor) {
            const result = Player.frameCompetitor(personId);
            toast((result && result.message) || 'Framing attempted.', result && result.success ? 'success' : 'warning');
            try { const p = Engine.getPerson(personId); if (p) showPersonDetail(p); } catch(e) {}
        } else {
            toast('Framing is not available yet.', 'warning');
        }
    }

    function showTownPeople(townId) {
        let people;
        try { people = Engine.getPeople(townId); } catch (e) { people = []; }
        if (!people || people.length === 0) {
            toast('No people in this town.', 'info');
            return;
        }

        const town = Engine.getTown(townId);
        const townName = town ? town.name : 'Unknown';

        // Sort: alive first, then by occupation, then alphabetically
        const sorted = people.filter(p => p.alive !== false).sort((a, b) => {
            if (a.occupation !== b.occupation) return (a.occupation || 'z').localeCompare(b.occupation || 'z');
            return (a.firstName || '').localeCompare(b.firstName || '');
        });

        // Group by occupation
        const groups = {};
        for (const p of sorted) {
            const occ = p.occupation || 'none';
            if (!groups[occ]) groups[occ] = [];
            groups[occ].push(p);
        }

        let html = `<div style="max-height:500px;overflow-y:auto;">`;

        // Filter bar
        html += `<div style="margin-bottom:8px;">
            <input type="text" id="people-search" placeholder="Search by name..."
                oninput="UI.filterTownPeople()"
                style="width:100%;padding:6px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(200,170,100,0.3);color:var(--text);border-radius:4px;font-size:0.8rem;">
        </div>`;

        html += `<div id="people-list">`;
        for (const [occ, ppl] of Object.entries(groups)) {
            const occInfo = OCCUPATIONS[occ.toUpperCase()] || { name: capitalize(occ) };
            html += `<div class="detail-section" style="margin-bottom:6px;">
                <h3 style="font-size:0.8rem;margin-bottom:4px;">${occInfo.name || capitalize(occ)} (${ppl.length})</h3>`;

            for (const p of ppl) {
                const age = p.age || '?';
                const sex = p.sex === 'M' ? '♂' : p.sex === 'F' ? '♀' : '?';
                const isChildAge = p.age < 14;
                const employed = p.employerId ? (p.employerId === 'player' ? ' ⭐' : ' 👤') : '';
                html += `<div class="person-list-row" onclick="UI.showPersonDetail(Engine.getPerson('${p.id}'))"
                    style="cursor:pointer;padding:4px 8px;border-bottom:1px solid rgba(200,170,100,0.1);display:flex;justify-content:space-between;align-items:center;"
                    data-name="${(p.firstName || '').toLowerCase()} ${(p.lastName || '').toLowerCase()}">
                    <span style="font-size:0.8rem;">${sex} ${p.firstName || ''} ${p.lastName || ''}${employed}${isChildAge ? ' 👶' : ''}</span>
                    <span class="text-dim" style="font-size:0.7rem;">Age ${age}</span>
                </div>`;
            }
            html += `</div>`;
        }
        html += `</div></div>`;

        openModal(`👥 People of ${townName}`, html, '');
    }

    function filterTownPeople() {
        const search = document.getElementById('people-search');
        if (!search) return;
        const query = search.value.toLowerCase();
        const rows = document.querySelectorAll('.person-list-row');
        for (const row of rows) {
            const name = row.getAttribute('data-name') || '';
            row.style.display = name.includes(query) ? '' : 'none';
        }
    }

    function askTavernFoodTrends() {
        try {
            const result = Player.askTavernFoodTrends();
            if (result && result.success) {
                let html = '<div style="padding:8px;">';
                html += '<h4 style="margin-bottom:8px;">📊 Food Preferences in This Town</h4>';
                if (result.trends && result.trends.length > 0) {
                    for (const t of result.trends) {
                        const icon = t.food === 'bread' ? '🍞' : t.food === 'meat' ? '🥩' : t.food === 'poultry' ? '🍗' : t.food === 'fish' ? '🐟' : t.food === 'eggs' ? '🥚' : '🥫';
                        const level = t.avgPreference > 1.2 ? 'Very Popular' : t.avgPreference > 1.0 ? 'Popular' : 'Average';
                        const color = t.avgPreference > 1.2 ? '#55a868' : t.avgPreference > 1.0 ? '#ccb974' : '#888';
                        html += '<div style="margin:4px 0;font-size:0.85rem;">' + icon + ' <strong>' + t.food.replace('_', ' ') + '</strong>: <span style="color:' + color + '">' + level + '</span> (demand: ' + t.demand + ')</div>';
                    }
                } else {
                    html += '<div class="text-dim">No clear food preferences detected.</div>';
                }
                html += '</div>';
                openModal('📊 Food Trends', html);
            } else {
                toast((result && result.message) || 'Cannot get food trends', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Cannot get food trends', 'danger');
        }
    }

    function askTavernFashionTrends() {
        try {
            const result = Player.askTavernTrends();
            if (result && result.success) {
                let html = '<div style="padding:8px;">';
                html += '<h4 style="margin-bottom:8px;">🎭 Fashion & Luxury Trends</h4>';
                if (result.trends && result.trends.length > 0) {
                    for (const t of result.trends) {
                        html += '<div style="margin:6px 0;padding:6px;border:1px solid var(--border);border-radius:4px;">';
                        html += '<div><strong>' + t.icon + ' ' + t.good + '</strong> — from ' + t.origin + '</div>';
                        html += '<div style="font-size:0.8rem;color:var(--gold);">+' + t.demandBonus + '% demand bonus</div>';
                        if (t.spreadTo.length > 0) html += '<div style="font-size:0.75rem;color:#888;">Also popular in: ' + t.spreadTo.join(', ') + '</div>';
                        html += '<div style="font-size:0.75rem;color:' + (t.fading ? '#c44e52' : '#55a868') + ';">' + (t.fading ? 'Fading...' : t.daysRemaining + ' days remaining') + '</div>';
                        html += '</div>';
                    }
                } else {
                    html += '<div class="text-dim">No fashion trends circulating at the moment.</div>';
                }
                html += '</div>';
                openModal('🎭 Fashion Trends', html);
            } else {
                toast((result && result.message) || 'Cannot get trends', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Cannot get trends', 'danger');
        }
    }

    function observePerson(personId) {
        try {
            const result = Player.observePerson(personId);
            if (result && result.success) {
                toast(result.message, result.noticed ? 'success' : 'info');
            } else {
                toast((result && result.message) || 'Cannot observe', 'warning');
            }
            openHireDialog(); // refresh
        } catch (e) {
            toast(e.message || 'Cannot observe', 'danger');
        }
    }

    function spendTimeWithSpouse(activityId) {
        try {
            const result = Player.spendTimeWithSpouse(activityId);
            if (result && result.success) {
                toast(result.message, 'success');
                openCharacterDialog(); // refresh
            } else {
                toast((result && result.message) || 'Cannot spend time', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Error', 'danger');
        }
    }

    function buildSpouseDetailPanel(spouse) {
        if (!spouse) return '';
        const rel = Player.getRelationship ? Player.getRelationship(spouse.id) : { level: 0 };
        const revealed = Player.getRevealedInfo ? Player.getRevealedInfo(spouse.id) : { traits: {}, quirks: [] };
        const revealedCount = Object.keys(revealed.traits).length;

        let html = '<div style="border:1px solid rgba(196,163,90,0.2);border-radius:6px;padding:8px;margin-top:8px;">';
        html += `<div style="font-weight:bold;margin-bottom:4px;">💑 ${spouse.firstName || 'Unknown'} ${spouse.lastName || ''}</div>`;
        html += `<div class="text-dim" style="font-size:0.8rem;">Age ${spouse.age} | 💛 Relationship: ${Math.floor(rel.level)}/100</div>`;

        // Trait bars
        if (revealedCount > 0) {
            html += '<div style="margin-top:6px;font-size:0.75rem;">';
            const traitNames = ['loyalty', 'ambition', 'frugality', 'intelligence', 'warmth', 'honesty'];
            for (const trait of traitNames) {
                const label = trait.charAt(0).toUpperCase() + trait.slice(1);
                if (trait in revealed.traits) {
                    const val = revealed.traits[trait];
                    if (typeof val === 'number') {
                        html += `<div style="display:flex;align-items:center;gap:4px;margin:2px 0;"><span style="width:85px;color:var(--gold);">${label}</span><div style="flex:1;height:8px;background:rgba(255,255,255,0.1);border-radius:4px;"><div style="width:${val}%;height:100%;background:var(--gold);border-radius:4px;"></div></div><span style="width:28px;text-align:right;">${val}</span></div>`;
                    } else {
                        html += `<div style="display:flex;align-items:center;gap:4px;margin:2px 0;"><span style="width:85px;color:var(--gold);">${label}</span><span>${val}</span></div>`;
                    }
                } else {
                    html += `<div style="display:flex;align-items:center;gap:4px;margin:2px 0;"><span style="width:85px;color:#666;">${label}</span><span style="color:#666;">???</span></div>`;
                }
            }
            html += '</div>';
        }

        // Quirks
        if (revealed.quirks.length > 0 && typeof SPOUSE_QUIRKS !== 'undefined') {
            html += '<div style="margin-top:4px;font-size:0.75rem;">';
            for (const qId of revealed.quirks) {
                const qDef = SPOUSE_QUIRKS.find(q => q.id === qId);
                if (qDef) {
                    const color = qDef.positive ? 'rgba(100,200,100,0.8)' : 'rgba(200,100,100,0.8)';
                    html += `<div style="color:${color};">${qDef.icon} ${qDef.name} — <span class="text-dim">${qDef.effect}</span></div>`;
                }
            }
            html += '</div>';
        }

        // Spend time buttons
        html += '<div style="margin-top:6px;font-size:0.75rem;font-weight:bold;">💬 Spend Time Together</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;">';
        if (typeof DATING_ACTIVITIES !== 'undefined') {
            for (const act of DATING_ACTIVITIES) {
                const disabled = (act.minRelationship && rel.level < act.minRelationship) || (act.cost > 0 && Player.gold < act.cost);
                const title = `${act.description} (${act.cost > 0 ? act.cost + 'g, ' : ''}${act.timeHours}h)`;
                html += `<button class="btn-hire ${disabled ? 'disabled' : ''}" onclick="UI.spendTimeWithSpouse('${act.id}')" style="font-size:0.7rem;padding:3px 6px;${disabled ? 'opacity:0.4;' : ''}" ${disabled ? 'disabled' : ''} title="${title}">${act.name}</button>`;
            }
        }
        html += '</div></div>';
        return html;
    }

    function proposeMarriage(personId) {
        try {
            const result = Player.marry(personId);
            if (result && result.success) {
                toast(result.message, 'success');
                openHireDialog(); // refresh
            } else {
                toast((result && result.message) || 'Cannot marry', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Cannot marry', 'danger');
        }
    }

    function hirePerson(personId) {
        try {
            Player.hireWorker(personId);
            toast('Worker hired!', 'success', 'my_business');
            openHireDialog(); // refresh
        } catch (e) {
            toast(e.message || 'Cannot hire', 'danger');
        }
    }

    function fireWorker(personId) {
        try {
            Player.fireWorker(personId);
            toast('Worker dismissed.', 'info');
            openHireDialog(); // refresh
        } catch (e) {
            toast(e.message || 'Cannot fire', 'danger');
        }
    }

    function showAssignDialog(personId) {
        if (!Player.buildings || !Player.buildings.length) {
            toast('No buildings to assign to.', 'warning');
            return;
        }

        let html = '<div class="worker-list">';
        for (const building of Player.buildings) {
            const bt = findBuildingType(building.type);
            html += `<div class="worker-row">
                <div class="worker-info">
                    <div class="name">${bt ? bt.name : building.type}</div>
                    <div class="details">${building.active !== false ? 'Active' : 'Inactive'}</div>
                </div>
                <button class="btn-assign" onclick="UI.executeAssign('${personId}','${building.id}')">Assign</button>
            </div>`;
        }
        html += '</div>';

        openModal('📋 Assign Worker', html);
    }

    function executeAssign(personId, buildingId) {
        try {
            Player.assignWorker(personId, buildingId);
            toast('Worker assigned!', 'success');
            closeModal();
        } catch (e) {
            toast(e.message || 'Cannot assign', 'danger');
        }
    }

    // ── CARAVAN DIALOG ──

    function openCaravanDialog() {
        if (typeof Player === 'undefined' || Player.townId == null) {
            toast('You must be in a town to send caravans.', 'warning', 'my_business');
            return;
        }

        const roads = Engine.getRoads ? Engine.getRoads() : [];
        const towns = Engine.getTowns ? Engine.getTowns() : [];
        const townMap = {};
        for (const t of towns) townMap[t.id] = t;

        // Find connected towns (land)
        const connectedTowns = [];
        for (const road of roads) {
            if (road.fromTownId === Player.townId && townMap[road.toTownId]) {
                connectedTowns.push({ town: townMap[road.toTownId], road, routeType: 'land' });
            } else if (road.toTownId === Player.townId && townMap[road.fromTownId]) {
                connectedTowns.push({ town: townMap[road.fromTownId], road, routeType: 'land' });
            }
        }

        // Find sea route destinations
        const seaDestinations = (typeof Player !== 'undefined' && Player.getSeaDestinations) ? Player.getSeaDestinations() : [];

        let destOptions = connectedTowns.map(({ town, road }) => {
            const safeStr = road.safe !== false ? '✓' : '⚠';
            const threat = road.banditThreat || 0;
            const dangerStr = threat > CONFIG.BANDIT_THREAT_DANGER_THRESHOLD ? ` ☠${Math.round(threat)}` : '';
            return `<option value="${town.id}" data-route="land" data-threat="${threat}">🚶 ${town.name} (${safeStr} Q:${road.quality || 1}${dangerStr})</option>`;
        }).join('');

        for (const sd of seaDestinations) {
            destOptions += `<option value="${sd.town.id}" data-route="sea">⛵ ${sd.town.name} (Sea ~${sd.estimatedDays}d)</option>`;
        }

        if (!destOptions) destOptions = '<option value="">No connected towns</option>';

        // Goods selector (from inventory AND town storage)
        let goodsHtml = '';
        const allGoods = {};
        for (const [resId, qty] of Object.entries(Player.inventory || {})) {
            if (qty > 0) allGoods[resId] = (allGoods[resId] || 0) + qty;
        }
        const townStorage = Player.state && Player.state.townStorage && Player.state.townStorage[Player.townId] ? Player.state.townStorage[Player.townId] : {};
        for (const [resId, qty] of Object.entries(townStorage)) {
            if (qty > 0) allGoods[resId] = (allGoods[resId] || 0) + qty;
        }
        for (const [resId, qty] of Object.entries(allGoods)) {
            if (qty <= 0) continue;
            const res = findResource(resId);
            if (!res) continue;
            goodsHtml += `<div class="caravan-good-row">
                <span>${res.icon} ${res.name} (${qty})</span>
                <input type="number" class="qty-select" id="caravanGood_${resId}" min="0" max="${qty}" value="0" style="width:60px">
            </div>`;
        }
        if (!goodsHtml) goodsHtml = '<div class="text-dim text-center">No goods available</div>';

        // Ship capacity info
        let shipInfo = '';
        if (Player.ships && Player.ships.length > 0) {
            const bestShip = Player.getBestShip ? Player.getBestShip() : Player.ships.reduce((a, b) => (a.capacity || 0) > (b.capacity || 0) ? a : b);
            if (bestShip) {
                const effCap = Player.getShipEffectiveCapacity ? Player.getShipEffectiveCapacity(bestShip) : bestShip.capacity;
                const shipDef = Player.getShipDefense ? Player.getShipDefense(bestShip) : 0;
                const hullPct = bestShip.hullHealth !== undefined ? bestShip.hullHealth : 100;
                shipInfo = `<div class="text-dim" style="font-size:0.75rem;margin-top:4px;">⛵ ${bestShip.name} | Cap: ${effCap} | 🛡️${shipDef} | Hull: ${hullPct}% | Spd: ${(bestShip.speed || 1.0).toFixed(1)}x</div>`;
            }
        }

        // Buy orders section — what to auto-buy at destination for return trip
        let buyOrdersHtml = '<div id="buyOrdersSection" style="display:none;margin-top:8px;padding:8px;background:rgba(0,100,200,0.08);border-radius:6px;">';
        buyOrdersHtml += '<label style="font-size:0.8rem;color:var(--gold);">📦 Buy Orders at Destination</label>';
        buyOrdersHtml += '<div class="text-dim" style="font-size:0.7rem;margin-bottom:4px;">Specify goods to purchase at destination for the return trip</div>';
        // List all possible goods (from all known resources)
        const allResources = typeof CONFIG !== 'undefined' && CONFIG.RESOURCES ? CONFIG.RESOURCES : [];
        const resourceList = Object.keys(towns.length > 0 && towns[0].market && towns[0].market.prices ? towns[0].market.prices : {});
        for (var ri = 0; ri < Math.min(resourceList.length, 20); ri++) {
            const rId = resourceList[ri];
            const rr = findResource(rId);
            if (!rr) continue;
            buyOrdersHtml += `<div class="caravan-good-row" style="font-size:0.75rem;">
                <span>${rr.icon || '📦'} ${rr.name}</span>
                <input type="number" class="qty-select" id="buyOrder_${rId}" min="0" max="100" value="0" style="width:50px" placeholder="qty">
                <span style="color:#888;">max</span>
                <input type="number" class="qty-select" id="buyMaxPrice_${rId}" min="0" max="999" value="0" style="width:50px" placeholder="price">
                <span style="color:#888;">g</span>
            </div>`;
        }
        buyOrdersHtml += '</div>';

        // Active caravans with enhanced display
        let activeHtml = '';
        if (Player.caravans && Player.caravans.length) {
            for (const c of Player.caravans) {
                const from = townMap[c.fromTownId];
                const to = townMap[c.toTownId];
                const progress = Math.round((c.progress || 0) * 100);
                const routeIcon = c.routeType === 'sea' ? '⛵' : '🐴';
                const returnIcon = c.returnTrip ? ' ↩️' : '';
                const recurIcon = c.recurring ? ' 🔄' : '';
                const statusIcon = c.status === 'blocked' ? ' ⛔' : (c.status === 'destroyed' ? ' 💀' : '');
                const profitStr = c.totalProfit ? ` | 💰 ${c.totalProfit}g` : '';
                const tripStr = c.tripCount ? ` | Trip #${c.tripCount}` : '';
                activeHtml += `<div class="caravan-active-row">
                    <span>${routeIcon} ${from ? from.name : '?'} → ${to ? to.name : '?'}${returnIcon}${recurIcon}${statusIcon}</span>
                    <div class="caravan-progress-track">
                        <div class="caravan-progress-fill" style="width:${progress}%${c.routeType === 'sea' ? ';background:rgba(0,180,200,0.6)' : ''}"></div>
                    </div>
                    <span>${progress}%${profitStr}${tripStr}</span>`;
                // Action buttons for active caravans
                if (c.status === 'blocked' && c.active !== false) {
                    activeHtml += `<button class="btn-action btn-small" style="font-size:0.65rem;margin-left:4px;" onclick="(function(){var r=Player.rescueCaravan('${c.id}');UI.toast(r.message,r.success?'success':'warning');UI.openCaravanDialog();})()">🆘 Rescue (${CONFIG.CARAVAN_BLOCKED_RESCUE_COST || 100}g)</button>`;
                }
                if (c.recurring && c.active) {
                    activeHtml += `<button class="btn-action btn-small" style="font-size:0.65rem;margin-left:4px;background:rgba(200,50,50,0.15);" onclick="(function(){var r=Player.cancelRecurringRoute('${c.id}');UI.toast(r.message,r.success?'success':'warning');UI.openCaravanDialog();})()">⏹️ Stop Route</button>`;
                }
                activeHtml += `</div>`;
            }
        }

        const html = `<div class="caravan-form">
            <div class="form-group">
                <label>Destination</label>
                <select id="caravanDest">${destOptions}</select>
            </div>
            ${shipInfo}
            <div class="form-group">
                <label>Goods to Send</label>
                <div class="caravan-goods-list">${goodsHtml}</div>
            </div>
            <div class="form-group">
                <label>Guards</label>
                <input type="number" id="caravanGuards" min="0" max="20" value="2" class="qty-select" style="width:80px">
                <span class="text-dim" style="font-size:0.75rem">Cost: ${CONFIG.GUARD_WAGE}g/day each</span>
            </div>
            <div class="form-group" style="margin-top:8px;">
                <label style="font-size:0.8rem;">Route Type</label>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <label style="font-size:0.75rem;cursor:pointer;"><input type="radio" name="routeMode" value="oneway" checked> One-Way</label>
                    <label style="font-size:0.75rem;cursor:pointer;"><input type="radio" name="routeMode" value="roundtrip"> Round Trip</label>
                    <label style="font-size:0.75rem;cursor:pointer;"><input type="radio" name="routeMode" value="recurring"> 🔄 Recurring Route</label>
                </div>
                <div class="text-dim" style="font-size:0.65rem;margin-top:2px;">Round trip & recurring routes can auto-buy goods at destination for return.</div>
            </div>
            ${buyOrdersHtml}
            <div class="form-group" style="margin-top:8px;">
                <label style="font-size:0.8rem;">🛡️ Security Options</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <label style="font-size:0.7rem;cursor:pointer;"><input type="checkbox" id="caravanFortified"> Fortified Wagon (${CONFIG.CARAVAN_FORTIFIED_WAGON_COST || 150}g, +30% defense)</label>
                    <label style="font-size:0.7rem;cursor:pointer;"><input type="checkbox" id="caravanDecoy"> Decoy (${CONFIG.CARAVAN_DECOY_COST || 50}g, -40% attack chance)</label>
                    <label style="font-size:0.7rem;cursor:pointer;"><input type="checkbox" id="caravanArmedEscort"> Armed Escort (${CONFIG.CARAVAN_ARMED_ESCORT_COST || 80}g, +50% guard power)</label>
                </div>
            </div>
            <div class="risk-assessment" id="riskAssessment">
                Select a destination and goods to see risk assessment.
            </div>
            <div class="caravan-danger-info" style="font-size:0.75rem;margin-top:6px;">
                ${connectedTowns.filter(ct => (ct.road.banditThreat || 0) > CONFIG.BANDIT_THREAT_DANGER_THRESHOLD).map(ct => {
                    const threat = ct.road.banditThreat || 0;
                    const color = threat > 75 ? 'var(--danger)' : threat > 50 ? 'var(--gold)' : '#888';
                    return `<div style="color:${color};">⚠️ Route to ${ct.town.name}: Bandit Threat ${Math.round(threat)}/100</div>`;
                }).join('')}
            </div>
        </div>
        ${activeHtml ? '<div class="caravan-active-list"><h3 style="font-family:var(--font-display);font-size:0.8rem;color:var(--gold-dark);margin-bottom:8px;">Active Caravans & Routes</h3>' + activeHtml + '</div>' : ''}
        ${buildTransportSection(connectedTowns, seaDestinations)}
        ${buildNPCTransportSection()}`;

        const footer = `<button class="btn-medieval" onclick="UI.executeSendCaravan()" style="font-size:0.85rem;padding:8px 24px;">
            🐴 Send Caravan
        </button>`;

        openModal('🐴 Caravan & Transport', html, footer);

        // Wire up route mode radio buttons to show/hide buy orders
        setTimeout(function() {
            var radios = document.querySelectorAll('input[name="routeMode"]');
            var buySection = document.getElementById('buyOrdersSection');
            for (var r = 0; r < radios.length; r++) {
                radios[r].addEventListener('change', function() {
                    if (buySection) buySection.style.display = (this.value === 'roundtrip' || this.value === 'recurring') ? 'block' : 'none';
                });
            }
        }, 50);
    }

    function buildTransportSection(connectedTowns, seaDestinations) {
        const currentTown = Engine.findTown(Player.townId);
        if (!currentTown) return '';

        const travelDemand = currentTown.travelDemand || [];
        const landCap = Player.getTransportCapacity ? Player.getTransportCapacity() : 0;
        const seaCap = Player.getSeaTransportCapacity ? Player.getSeaTransportCapacity() : 0;
        const hasLandTransport = landCap > 0 && Player.horses && Player.horses.length > 0;
        const hasSeaTransport = seaCap > 0;
        const canTransport = hasLandTransport || hasSeaTransport;

        // Active transport manifest
        let manifestHtml = '';
        const transport = Player.activeTransport;
        if (transport) {
            const destTown = Engine.findTown(transport.toTownId);
            manifestHtml = `<div style="background:rgba(0,180,100,0.1);border:1px solid rgba(0,180,100,0.3);border-radius:6px;padding:8px;margin-bottom:10px;">
                <div style="font-weight:bold;color:var(--gold);">\uD83D\uDE8C Active Transport to ${destTown ? destTown.name : '?'}</div>
                <div style="font-size:0.75rem;color:#ccc;">${transport.passengers.length} passengers | ${transport.totalRevenue}g revenue on arrival</div>
                <div style="font-size:0.7rem;margin-top:4px;">${transport.passengers.map(function(p) {
                    var icon = p.wealthClass === 'upper' ? '\uD83D\uDC51' : p.wealthClass === 'middle' ? '\uD83D\uDCBC' : '\uD83D\uDC64';
                    return icon + ' ' + p.name + ' (' + p.fare + 'g)';
                }).join(', ')}</div>
            </div>`;
        }

        if (!canTransport && travelDemand.length === 0 && !transport) return '';

        // Group demand by destination
        var destGroups = {};
        for (var i = 0; i < travelDemand.length; i++) {
            var d = travelDemand[i];
            if (!destGroups[d.destinationTownId]) {
                destGroups[d.destinationTownId] = { name: d.destinationName, travelers: [], isSea: false };
            }
            destGroups[d.destinationTownId].travelers.push(d);
        }

        // Check which destinations are reachable by land or sea
        var landDestIds = {};
        for (var li = 0; li < connectedTowns.length; li++) {
            landDestIds[connectedTowns[li].town.id] = true;
        }
        var seaDestIds = {};
        for (var si = 0; si < seaDestinations.length; si++) {
            seaDestIds[seaDestinations[si].town.id] = true;
        }

        // Build destination rows
        var demandHtml = '';
        var destIds = Object.keys(destGroups);
        for (var di = 0; di < destIds.length; di++) {
            var destId = destIds[di];
            var group = destGroups[destId];
            var isLandRoute = !!landDestIds[destId];
            var isSeaRoute = !!seaDestIds[destId];
            if (!isLandRoute && !isSeaRoute) continue;

            var routeType = isSeaRoute && !isLandRoute ? 'sea' : 'land';
            var routeIcon = routeType === 'sea' ? '\u26F5' : '\uD83D\uDE90';
            var maxCap = routeType === 'sea' ? seaCap : landCap;
            var canServe = routeType === 'sea' ? hasSeaTransport : hasLandTransport;

            // Sort by maxPrice descending
            if (!group.travelers) group.travelers = [];
            group.travelers.sort(function(a, b) { return b.maxPrice - a.maxPrice; });

            var travelerList = group.travelers.map(function(t) {
                var wIcon = t.wealthClass === 'upper' ? '\uD83D\uDC51' : t.wealthClass === 'middle' ? '\uD83D\uDCBC' : '\uD83D\uDC64';
                var urgIcon = t.urgency >= 3 ? '\u203C\uFE0F' : t.urgency >= 2 ? '\u2757' : '';
                return '<span style="font-size:0.7rem;display:inline-block;margin:1px 3px;background:rgba(255,255,255,0.05);border-radius:3px;padding:1px 4px;">' + wIcon + ' ' + t.personName + ' (max ' + t.maxPrice + 'g' + urgIcon + ')</span>';
            }).join('');

            demandHtml += '<div style="border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;margin-bottom:6px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                    '<span style="font-weight:bold;">' + routeIcon + ' ' + group.name + ' <span style="font-size:0.75rem;color:#aaa;">(' + group.travelers.length + ' waiting)</span></span>' +
                    (canServe && !transport ? '<span style="font-size:0.7rem;color:#aaa;">Capacity: ' + maxCap + '</span>' : '') +
                '</div>' +
                '<div style="margin:4px 0;">' + travelerList + '</div>' +
                (canServe && !transport ?
                    '<div style="display:flex;gap:6px;align-items:center;margin-top:4px;">' +
                        '<label style="font-size:0.75rem;">Price/passenger:</label>' +
                        '<input type="number" id="transportPrice_' + destId + '" min="1" max="500" value="' + Math.floor(group.travelers.reduce(function(s,t){ return s + t.maxPrice; }, 0) / group.travelers.length) + '" class="qty-select" style="width:60px;">' +
                        '<button class="btn-medieval" onclick="UI.setupTransportUI(\'' + destId + '\', ' + (routeType === 'sea') + ')" style="font-size:0.7rem;padding:4px 10px;">' +
                            '\uD83D\uDE8C Board Passengers' +
                        '</button>' +
                    '</div>'
                : '') +
            '</div>';
        }

        if (!demandHtml && !manifestHtml && !canTransport) return '';

        var capacityInfo = '';
        if (hasLandTransport) capacityInfo += '\uD83D\uDE90 Land: ' + landCap + ' seats';
        if (hasSeaTransport) capacityInfo += (capacityInfo ? ' | ' : '') + '\u26F5 Sea: ' + seaCap + ' seats';
        if (!canTransport) capacityInfo = '<span style="color:#888;">Need wagon+horses or ship to transport passengers</span>';

        return '<div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:12px;padding-top:10px;">' +
            '<h3 style="font-family:var(--font-display);font-size:0.85rem;color:var(--gold-dark);margin-bottom:6px;">\uD83D\uDE8C Passenger Transport</h3>' +
            '<div style="font-size:0.7rem;color:#aaa;margin-bottom:8px;">' + capacityInfo + '</div>' +
            manifestHtml +
            (demandHtml || '<div style="font-size:0.75rem;color:#888;text-align:center;">No passengers waiting to travel from this town.</div>') +
        '</div>';
    }

    function buildNPCTransportSection() {
        if (typeof Player === 'undefined' || Player.townId == null) return '';
        var town = Engine.findTown(Player.townId);
        if (!town || !town.npcTransportServices || town.npcTransportServices.length === 0) return '';
        var html = '<div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:12px;padding-top:10px;">';
        html += '<h3 style="font-family:var(--font-display);font-size:0.85rem;color:var(--gold-dark);margin-bottom:6px;">\uD83D\uDE90 NPC Transport Services</h3>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">Pay for a ride \u2014 cheap travel without needing your own horse!</div>';
        for (var i = 0; i < town.npcTransportServices.length; i++) {
            var s = town.npcTransportServices[i];
            var typeIcon = s.isSea ? '\u26F5' : '\uD83D\uDC34';
            var seatsColor = s.capacity <= 1 ? 'var(--danger)' : s.capacity <= 3 ? 'var(--gold)' : '#aaa';
            var canAfford = typeof Player !== 'undefined' && Player.gold >= s.price;
            var btnStyle = canAfford ? '' : 'opacity:0.5;cursor:not-allowed;';
            var daysLeft = s.duration - ((Engine.getDay ? Engine.getDay() : 0) - s.createdDay);
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);">';
            html += '<div style="flex:1;"><span style="font-size:0.75rem;">' + typeIcon + ' <strong>' + s.operatorName + '</strong> \u2192 ' + s.destinationName + '</span>';
            html += '<div style="font-size:0.7rem;color:#888;">' + s.capacity + ' seat' + (s.capacity !== 1 ? 's' : '') + ' left \u00B7 departs in ' + daysLeft + 'd</div></div>';
            html += '<button class="btn-medieval" onclick="UI.useNPCTransportUI(' + i + ')" style="font-size:0.7rem;padding:3px 10px;' + btnStyle + '">' + s.price + 'g Board</button>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function useNPCTransportUI(serviceIndex) {
        var result = Player.useNPCTransport(Player.townId, serviceIndex);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) closeModal();
    }

    function setupTransportUI(destTownId, isSea) {
        var priceInput = document.getElementById('transportPrice_' + destTownId);
        var price = parseInt(priceInput ? priceInput.value : 20);
        if (isNaN(price) || price < 1) { toast('Enter a valid price.', 'warning'); return; }
        var result = Player.setupTransport(Player.townId, destTownId, price, isSea);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openCaravanDialog();
    }

    function executeSendCaravan() {
        const destSelect = document.getElementById('caravanDest');
        if (!destSelect || !destSelect.value) {
            toast('Select a destination.', 'warning');
            return;
        }

        const goods = {};
        const allGoods = {};
        for (const [resId, qty] of Object.entries(Player.inventory || {})) {
            if (qty > 0) allGoods[resId] = true;
        }
        const ts = Player.state && Player.state.townStorage && Player.state.townStorage[Player.townId] ? Player.state.townStorage[Player.townId] : {};
        for (const resId in ts) { if (ts[resId] > 0) allGoods[resId] = true; }

        for (const resId of Object.keys(allGoods)) {
            const input = document.getElementById('caravanGood_' + resId);
            if (input) {
                const qty = parseInt(input.value) || 0;
                if (qty > 0) goods[resId] = qty;
            }
        }

        if (Object.keys(goods).length === 0) {
            toast('Select goods to send.', 'warning');
            return;
        }

        const guardsInput = document.getElementById('caravanGuards');
        const guards = guardsInput ? parseInt(guardsInput.value) || 0 : 0;

        // Route mode
        const routeModeRadio = document.querySelector('input[name="routeMode"]:checked');
        const routeMode = routeModeRadio ? routeModeRadio.value : 'oneway';
        const roundTrip = routeMode === 'roundtrip';
        const recurring = routeMode === 'recurring';

        // Buy orders (for round-trip / recurring)
        let buyOrders = null;
        if (roundTrip || recurring) {
            buyOrders = {};
            const buyInputs = document.querySelectorAll('[id^="buyOrder_"]');
            for (const inp of buyInputs) {
                const rId = inp.id.replace('buyOrder_', '');
                const qty = parseInt(inp.value) || 0;
                const maxPriceEl = document.getElementById('buyMaxPrice_' + rId);
                const maxPrice = maxPriceEl ? (parseInt(maxPriceEl.value) || 999) : 999;
                if (qty > 0) buyOrders[rId] = { qty, maxPrice };
            }
            if (Object.keys(buyOrders).length === 0) buyOrders = null;
        }

        // Security options
        const fortified = document.getElementById('caravanFortified') ? document.getElementById('caravanFortified').checked : false;
        const decoy = document.getElementById('caravanDecoy') ? document.getElementById('caravanDecoy').checked : false;
        const armedEscort = document.getElementById('caravanArmedEscort') ? document.getElementById('caravanArmedEscort').checked : false;

        // Detect if sea route was selected
        const selectedOption = destSelect.options[destSelect.selectedIndex];
        const routeType = selectedOption && selectedOption.dataset && selectedOption.dataset.route;

        const options = { buyOrders, roundTrip, recurring, fortified, decoy, armedEscort };

        try {
            let result;
            if (routeType === 'sea' && Player.sendSeaCaravan) {
                result = Player.sendSeaCaravan(Player.townId, destSelect.value, goods, guards);
            } else {
                result = Player.sendCaravan(Player.townId, destSelect.value, goods, guards, false, options);
            }
            if (result && result.success) {
                toast(result.message || 'Caravan dispatched!', 'success', 'my_business');
                closeModal();
            } else {
                toast((result && result.message) || 'Cannot send caravan', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Cannot send caravan', 'danger');
        }
    }

    // ── CHARACTER DIALOG ──

    function openCharacterDialog() {
        if (typeof Player === 'undefined') return;

        const sexIcon = Player.sex === 'F' ? '♀' : '♂';
        let spouseName = 'None';
        if (Player.spouseId) {
            try {
                const spouse = Engine.findPerson(Player.spouseId);
                if (spouse) spouseName = spouse.firstName + ' ' + spouse.lastName;
            } catch (e) { /* no-op */ }
        }

        // Children info with teach buttons
        let childrenHtml = '';
        if (Player.childrenIds && Player.childrenIds.length > 0) {
            for (const childId of Player.childrenIds) {
                try {
                    const child = Engine.findPerson(childId);
                    if (child && child.alive) {
                        const childSexIcon = child.sex === 'F' ? '♀' : '♂';
                        const passed = (Player.skillPointsPassedToChild && Player.skillPointsPassedToChild[childId]) || 0;
                        childrenHtml += `<div class="detail-row">
                            <span class="label">${childSexIcon} ${child.firstName}</span>
                            <span class="value">Age ${child.age}${passed > 0 ? ' (📚 ' + passed + '/5 taught)' : ''}</span>
                        </div>`;
                        if (child.age >= 10 && passed < 5 && Player.skillPoints >= 3) {
                            childrenHtml += `<div style="margin-left:20px;margin-bottom:4px;">
                                <button class="btn-medieval" onclick="UI.openTeachChildDialog('${childId}')" style="font-size:0.7rem;padding:3px 10px;">📚 Teach Skill (3 SP → 1 SP)</button>
                            </div>`;
                        } else if (child.age >= 10 && passed >= 5) {
                            childrenHtml += `<div style="margin-left:20px;margin-bottom:4px;font-size:0.7rem;color:var(--text-muted);">Max skills taught ✓</div>`;
                        }
                    }
                } catch (e) { /* no-op */ }
            }
        }
        if (!childrenHtml) childrenHtml = '<div class="text-dim">No children</div>';

        let html = `<div class="detail-section">
            <h3>Identity</h3>
            <div class="detail-row"><span class="label">Name</span>
                <span class="value">${Player.fullName || 'Unknown'}</span></div>
            <div class="detail-row"><span class="label">Sex</span>
                <span class="value">${sexIcon} ${Player.sex === 'F' ? 'Female' : 'Male'}</span></div>
            <div class="detail-row"><span class="label">Age</span>
                <span class="value">${Player.age || '?'}</span></div>
            <div class="detail-row"><span class="label">Spouse</span>
                <span class="value">${spouseName}</span></div>
        </div>`;

        // ── Health Panel ──
        const injuries = Player.injuries || [];
        const illnesses = Player.illnesses || [];
        if (injuries.length > 0 || illnesses.length > 0) {
            html += '<div class="detail-section" style="border:1px solid rgba(200,50,50,0.3);background:rgba(200,50,50,0.04);">';
            html += '<h3>🏥 Health</h3>';
            for (let i = 0; i < injuries.length; i++) {
                const inj = injuries[i];
                const sevColor = inj.severity === 'severe' ? 'var(--danger)' : inj.severity === 'moderate' ? '#e67e22' : '#2ecc71';
                html += '<div class="detail-row"><span class="label">🩹 ' + inj.name + '</span>';
                html += '<span class="value" style="color:' + sevColor + ';">' + inj.severity + (inj.treated ? ' (treating)' : ' (untreated!)') + '</span></div>';
            }
            for (let i = 0; i < illnesses.length; i++) {
                const ill = illnesses[i];
                const sevColor = ill.severity === 'severe' ? 'var(--danger)' : ill.severity === 'moderate' ? '#e67e22' : '#2ecc71';
                html += '<div class="detail-row"><span class="label">🤒 ' + ill.name + '</span>';
                html += '<span class="value" style="color:' + sevColor + ';">' + ill.severity + (ill.treated ? ' (treating)' : ' (untreated!)') + '</span></div>';
            }
            // Treatment buttons
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">';
            html += '<button class="btn-medieval" onclick="UI.openHealthDialog()" style="font-size:0.75rem;padding:4px 12px;">🏥 Treat Conditions</button>';
            html += '</div>';
            html += '</div>';
        }

        // ── Military Status ──
        if (Player.militaryRank) {
            const rankLabel = Player.getMilitaryRankLabel ? Player.getMilitaryRankLabel() : Player.militaryRank;
            html += '<div class="detail-section">';
            html += '<h3>🎖️ Military</h3>';
            html += '<div class="detail-row"><span class="label">Rank</span><span class="value">' + rankLabel + '</span></div>';
            html += '<div class="detail-row"><span class="label">Status</span><span class="value">' + (Player.militaryActive ? '⚔️ Active Duty' : '🏠 Retired') + '</span></div>';
            html += '<div class="detail-row"><span class="label">Battles Survived</span><span class="value">' + (Player.battlesSurvived || 0) + '</span></div>';
            html += '</div>';
        }

        html += `<div class="detail-section">
            <h3>Children</h3>
            ${childrenHtml}
        </div>`;

        // Spouse detail section (when married)
        if (Player.spouseId) {
            try {
                const spouse = Engine.findPerson(Player.spouseId);
                if (spouse) {
                    html += '<div class="detail-section">';
                    html += '<h3>💑 Spouse</h3>';
                    html += buildSpouseDetailPanel(spouse);
                    html += '</div>';
                }
            } catch (e) { /* no-op */ }
        }

        // Heir traits (if any)
        if (Player.heirTraits && Player.heirTraits.length > 0) {
            html += '<div class="detail-section"><h3>🏷️ Traits</h3>';
            for (const trait of Player.heirTraits) {
                if (trait === 'well_raised') html += '<div class="detail-row"><span class="label">⭐ Well-Raised</span><span class="value">+5% XP gain</span></div>';
                if (trait === 'orphan') html += '<div class="detail-row"><span class="label">🏚️ Orphan</span><span class="value">-5% sell prices, +10% crime detection reduction</span></div>';
            }
            html += '</div>';
        }

        // Equipment section — market-based with quality tiers
        var weaponDisplay = 'None';
        var armorDisplay = 'None';
        if (Player.weapon) {
            var w = Player.weapon;
            if (typeof w === 'object') {
                var qualColor = w.quality === 'masterwork' ? '#ffd700' : w.quality === 'fine' ? '#55a868' : w.quality === 'poor' ? '#888' : 'var(--parchment)';
                weaponDisplay = '⚔️ ' + w.name + ' <span style="color:' + qualColor + ';font-size:0.75rem;">(' + w.quality + ')</span> +' + Math.round(w.combatBonus * 100) + '% survival';
            } else {
                weaponDisplay = '⚔️ Sword (+20% survival)';
            }
        }
        if (Player.armor) {
            var a = Player.armor;
            if (typeof a === 'object') {
                var qualColorA = a.quality === 'masterwork' ? '#ffd700' : a.quality === 'fine' ? '#55a868' : a.quality === 'poor' ? '#888' : 'var(--parchment)';
                armorDisplay = '🛡️ ' + a.name + ' <span style="color:' + qualColorA + ';font-size:0.75rem;">(' + a.quality + ')</span> +' + Math.round(a.combatBonus * 100) + '% survival';
            } else {
                armorDisplay = '🛡️ Armor (+30% survival)';
            }
        }

        html += '<div class="detail-section"><h3>Equipment</h3>';
        html += '<div class="detail-row"><span class="label">Weapon</span><span class="value">' + weaponDisplay + '</span></div>';
        html += '<div class="detail-row"><span class="label">Armor</span><span class="value">' + armorDisplay + '</span></div>';

        // Unequip buttons
        var unequipBtns = '';
        if (Player.weapon) {
            unequipBtns += '<button class="btn-medieval" onclick="UI.unequipWeapon()" style="font-size:0.75rem;padding:4px 10px;">❌ Unequip Weapon</button>';
        }
        if (Player.armor) {
            unequipBtns += '<button class="btn-medieval" onclick="UI.unequipArmor()" style="font-size:0.75rem;padding:4px 10px;">❌ Unequip Armor</button>';
        }
        if (unequipBtns) {
            html += '<div style="display:flex;gap:8px;margin-top:6px;">' + unequipBtns + '</div>';
        }

        // Available equipment from local market
        var availWeapons = [];
        var availArmor = [];
        try {
            availWeapons = Player.getAvailableEquipment('weapons') || [];
            availArmor = Player.getAvailableEquipment('armor') || [];
        } catch (e) { /* no-op */ }

        if (availWeapons.length > 0 || availArmor.length > 0) {
            html += '<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;">';
            html += '<div style="font-size:0.8rem;color:var(--gold);margin-bottom:6px;">⚒️ Available at Local Market</div>';
            for (var wi = 0; wi < availWeapons.length; wi++) {
                var ew = availWeapons[wi];
                var qc = ew.quality === 'masterwork' ? '#ffd700' : ew.quality === 'fine' ? '#55a868' : ew.quality === 'poor' ? '#888' : 'var(--parchment)';
                var bannedTag = ew.isBanned ? ' <span style="color:var(--danger);font-size:0.65rem;">🚫 BANNED</span>' : '';
                html += '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;">';
                html += '<span style="font-size:0.8rem;">⚔️ ' + ew.name + ' <span style="color:' + qc + ';font-size:0.7rem;">(' + ew.quality + ')</span> +' + Math.round(ew.combatBonus * 100) + '%' + bannedTag + '</span>';
                html += '<button class="btn-medieval" onclick="UI.buyWeapon(\'' + ew.id + '\')" style="font-size:0.7rem;padding:3px 10px;margin-left:auto;">' + ew.price + 'g</button>';
                html += '</div>';
            }
            for (var ai = 0; ai < availArmor.length; ai++) {
                var ea = availArmor[ai];
                var qca = ea.quality === 'masterwork' ? '#ffd700' : ea.quality === 'fine' ? '#55a868' : ea.quality === 'poor' ? '#888' : 'var(--parchment)';
                var bannedTagA = ea.isBanned ? ' <span style="color:var(--danger);font-size:0.65rem;">🚫 BANNED</span>' : '';
                html += '<div style="display:flex;align-items:center;gap:8px;margin:3px 0;">';
                html += '<span style="font-size:0.8rem;">🛡️ ' + ea.name + ' <span style="color:' + qca + ';font-size:0.7rem;">(' + ea.quality + ')</span> +' + Math.round(ea.combatBonus * 100) + '%' + bannedTagA + '</span>';
                html += '<button class="btn-medieval" onclick="UI.buyArmor(\'' + ea.id + '\')" style="font-size:0.7rem;padding:3px 10px;margin-left:auto;">' + ea.price + 'g</button>';
                html += '</div>';
            }
            html += '</div>';
        } else {
            html += '<div style="margin-top:8px;font-size:0.75rem;color:#888;font-style:italic;">No swords or armor available at this market.</div>';
        }
        html += '</div>';

        // Check port status for ship operations
        let isAtPort = false;
        try {
            const currentTown = Engine.findTown(Player.townId);
            isAtPort = currentTown && currentTown.isPort;
        } catch (e) { /* no-op */ }

        // Ships section
        html += `<div class="detail-section">
            <h3>⛵ Ships</h3>`;
        if (Player.ships && Player.ships.length > 0) {
            for (const ship of Player.ships) {
                const shipCondCfg = CONFIG.CONDITION_LEVELS ? CONFIG.CONDITION_LEVELS[ship.degradeCondition || 'new'] : null;
                const shipCondIcon = shipCondCfg ? shipCondCfg.icon : '✨';
                const shipCondName = shipCondCfg ? shipCondCfg.name : 'New';
                const shipCondColor = (ship.degradeCondition === 'breaking') ? 'color:var(--danger);' : (ship.degradeCondition === 'destroyed') ? 'color:#888;' : (ship.degradeCondition === 'used') ? 'color:var(--gold);' : 'color:#55a868;';
                const shipNeedsRepair = ship.degradeCondition === 'used' || ship.degradeCondition === 'breaking' || (ship.hullHealth !== undefined && ship.hullHealth < 100);
                const shipSt = CONFIG.SHIP_TYPES ? CONFIG.SHIP_TYPES[ship.type] : null;
                const shipRepairCost = Player.getShipPrice ? Math.floor(Player.getShipPrice(ship.type) * (ship.degradeCondition === 'breaking' ? 0.3 : 0.2)) : '?';
                const hullPct = ship.hullHealth !== undefined ? ship.hullHealth : 100;
                const hullColor = hullPct > 70 ? '#55a868' : hullPct > 30 ? 'var(--gold)' : 'var(--danger)';
                const effCap = Player.getShipEffectiveCapacity ? Player.getShipEffectiveCapacity(ship) : ship.capacity;
                html += `<div style="border:1px solid var(--border);padding:6px;margin-bottom:6px;border-radius:4px;">
                    <div class="detail-row">
                        <span class="label">${shipSt ? shipSt.icon : '⛵'} ${ship.name} ${shipCondIcon}</span>
                        <span class="value" style="${shipCondColor}">${shipCondName}${shipCondCfg && shipCondCfg.efficiency < 1 ? ' (' + Math.round(shipCondCfg.efficiency * 100) + '%)' : ''}</span>
                    </div>
                    <div style="font-size:0.75rem;color:#b0b0b0;margin-top:2px;">
                        Cap: ${effCap} | Spd: ${(ship.speed || 1.0).toFixed(1)}x | Pass: ${ship.passengers || 0} | 🛡️${ship.defense || 0} | 💣${ship.cannons || 0}
                    </div>
                    <div style="font-size:0.75rem;margin-top:2px;">
                        <span style="color:${hullColor}">Hull: ${hullPct}%</span>
                        ${(ship.addons && ship.addons.length > 0) ? ' | Addons: ' + ship.addons.map(function(a) { var ac = CONFIG.SHIP_ADDONS ? CONFIG.SHIP_ADDONS[a] : null; return ac ? ac.name : a; }).join(', ') : ''}
                    </div>
                    ${shipNeedsRepair && isAtPort ? '<button class="btn-trade buy" style="font-size:0.7rem;margin-top:4px;background:rgba(200,120,0,0.35);border-color:rgba(220,140,20,0.6);color:#f5deb3;" onclick="UI.repairShip(\'' + ship.id + '\')">🔨 Repair (' + shipRepairCost + 'g)</button>' : ''}
                    ${isAtPort && ship.addons && ship.maxAddons && ship.addons.length < ship.maxAddons ? ' <button class="btn-trade buy" style="font-size:0.7rem;margin-top:4px;background:rgba(0,100,140,0.35);border-color:rgba(0,160,200,0.6);color:#c8e8f0;" onclick="UI.showShipAddons(\'' + ship.id + '\')">🔧 Addons (' + ship.addons.length + '/' + ship.maxAddons + ')</button>' : ''}
                </div>`;
            }
        } else {
            html += `<div class="text-dim">No ships owned</div>`;
        }
        // Buy ship buttons (only at port towns) — dynamic pricing
        if (isAtPort) {
            html += `<div style="margin-top:8px;"><strong>🏗️ Build a Ship</strong></div>`;
            html += `<div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">`;
            var shipTypes = CONFIG.SHIP_TYPES || {};
            for (var stId in shipTypes) {
                var stCfg = shipTypes[stId];
                var stPrice = Player.getShipPrice ? Player.getShipPrice(stId) : (stCfg.laborCost || 100);
                var canAfford = Player.gold >= stPrice;
                html += `<button class="btn-medieval" onclick="UI.buyShip('${stId}')" style="font-size:0.7rem;padding:4px 10px;background:rgba(0,140,160,${canAfford ? '0.4' : '0.15'});border-color:rgba(0,200,220,${canAfford ? '0.6' : '0.3'});color:${canAfford ? '#e0f4f4' : '#666'};" title="${stCfg.description || ''}\nCap:${stCfg.capacity} Spd:${stCfg.speed}x Pass:${stCfg.passengers || 0} Def:${stCfg.defense || 0} Cannons:${stCfg.cannons || 0}">${stCfg.icon || '⛵'} ${stCfg.name} (${Math.round(stPrice)}g)</button>`;
            }
            html += `</div>`;
        } else {
            html += `<div class="text-dim" style="margin-top:4px;font-size:0.75rem;">Visit a port town to build ships</div>`;
        }
        html += `</div>`;

        // ── Storage / Capacity Section ──
        html += `<div class="detail-section"><h3>📦 Storage & Capacity</h3>`;

        // ── Horses Section ──
        html += `<div style="margin-bottom:8px;"><strong>🐴 Horses (${Player.horses ? Player.horses.length : 0}/${CONFIG.MAX_HORSES || 2})</strong></div>`;
        if (Player.horses && Player.horses.length > 0) {
            for (const horse of Player.horses) {
                html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:0.75rem;">`;
                html += `<span>🐴 <strong>${horse.name}</strong> — Stamina: ${horse.stamina}, Speed: ${horse.speed.toFixed(1)}x</span>`;
                html += `<button class="btn-medieval" onclick="UI.sellHorse('${horse.id}')" style="font-size:0.7rem;padding:2px 6px;">Sell</button>`;
                html += `</div>`;
            }
        } else {
            html += `<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">No horses. Buy from market to increase carry capacity (+${CONFIG.HORSE_CARRY_BONUS || 40} each).</div>`;
        }

        // ── Horse Permit (Draft Animal Law) ──
        if (Player.townId) {
            var permitTown = Engine.findTown(Player.townId);
            var permitKingdom = permitTown ? Engine.findKingdom(permitTown.kingdomId) : null;
            if (permitKingdom && Engine.hasSpecialLaw && Engine.hasSpecialLaw(permitKingdom, 'draft_animal_law')) {
                var permitCfg = CONFIG.DRAFT_ANIMAL_LAW || {};
                var permitRank = Player.getEffectiveRank ? Player.getEffectiveRank(permitKingdom.id) : (Player.state.socialRank[permitKingdom.id] || 0);
                var permitExempt = permitRank >= (permitCfg.minRankExempt || 2);
                if (permitExempt) {
                    html += `<div style="font-size:0.72rem;color:#8b8;margin:4px 0;padding:4px 6px;background:rgba(0,100,0,0.15);border-radius:4px;">🐴 <strong>Draft Animal Law:</strong> You are exempt (Burgher+ rank).</div>`;
                } else {
                    var permit = Player.state.horsePermit ? Player.state.horsePermit[permitKingdom.id] : null;
                    var hasValidPermit = permit && permit.expiresDay > Engine.getDay();
                    if (hasValidPermit) {
                        var daysLeft = permit.expiresDay - Engine.getDay();
                        html += `<div style="font-size:0.72rem;color:#8b8;margin:4px 0;padding:4px 6px;background:rgba(0,100,0,0.15);border-radius:4px;">🐴 <strong>Horse Permit:</strong> Valid for ${daysLeft} more days in ${permitKingdom.name}.</div>`;
                    } else {
                        var permitCostMonthly = permitCfg.permitCostMonthly || 100;
                        var permitCostAnnual = permitCfg.permitCostAnnual || 1000;
                        html += `<div style="font-size:0.72rem;color:#c88;margin:4px 0;padding:4px 6px;background:rgba(100,0,0,0.15);border-radius:4px;">`;
                        html += `⚠️ <strong>${permitKingdom.name}</strong> requires a horse permit for commoners (Draft Animal Law).`;
                        html += `<br><button class="btn-medieval" onclick="Player.buyHorsePermit('${permitKingdom.id}','monthly'); UI.openCharacterPanel();" style="font-size:0.7rem;padding:2px 8px;margin-top:4px;">🐴 30-Day Permit (${permitCostMonthly}g)</button>`;
                        html += ` <button class="btn-medieval" onclick="Player.buyHorsePermit('${permitKingdom.id}','annual'); UI.openCharacterPanel();" style="font-size:0.7rem;padding:2px 8px;margin-top:4px;">🐴 Annual Permit (${permitCostAnnual}g)</button>`;
                        html += `</div>`;
                    }
                }
            }
        }

        const charCarriedWeight = Player.getCarriedWeight ? Player.getCarriedWeight() : 0;
        const charCarryCap = Player.getCarryCapacity ? Player.getCarryCapacity() : 20;
        const charContainer = Player.storageContainer && CONFIG.STORAGE_CONTAINERS[Player.storageContainer]
            ? CONFIG.STORAGE_CONTAINERS[Player.storageContainer] : null;
        const charContainerLabel = charContainer ? (charContainer.icon + ' ' + charContainer.name) : '🚶 None (on person)';
        html += `<div class="detail-row"><span class="label">Container</span><span class="value">${charContainerLabel}</span></div>`;
        html += `<div class="detail-row"><span class="label">Carrying</span><span class="value">${Math.round(charCarriedWeight)} / ${charCarryCap} weight</span></div>`;
        // Available upgrades
        let upgradeHtml = '';
        for (const [cId, cCfg] of Object.entries(CONFIG.STORAGE_CONTAINERS)) {
            if (charContainer && cCfg.capacityMult <= charContainer.capacityMult) continue;
            let upgradeCost = cCfg.cost;
            if (charContainer) upgradeCost -= Math.floor(charContainer.cost * 0.5);
            let matStr = '';
            if (cCfg.materials) {
                matStr = ' + ' + Object.entries(cCfg.materials).map(function(e) {
                    var res = findResource(e[0]);
                    return (res ? res.icon || '' : '') + e[1];
                }).join(', ');
            }
            upgradeHtml += `<button class="btn-medieval" onclick="UI.buyContainer('${cId}')" style="font-size:0.7rem;padding:3px 10px;margin:2px;">${cCfg.icon} ${cCfg.name} (${upgradeCost}g${matStr}) — ${cCfg.capacityMult * (CONFIG.PLAYER_BASE_CARRY || 20)} cap</button>`;
        }
        if (upgradeHtml) {
            html += `<div style="margin-top:6px;"><div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Available upgrades:</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${upgradeHtml}</div></div>`;
        } else {
            html += `<div style="font-size:0.75rem;color:#55a868;margin-top:4px;">✅ Maximum container owned</div>`;
        }
        // Town storage summary
        if (Player.townId) {
            const charTownStorageCap = Player.getTownStorageCapacity ? Player.getTownStorageCapacity() : 0;
            const charTownStorageUsed = Player.getTownStorageUsed ? Player.getTownStorageUsed() : 0;
            if (charTownStorageCap > 0) {
                html += `<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px;">`;
                html += `<div class="detail-row"><span class="label">📦 Town Warehouse</span><span class="value">${Math.round(charTownStorageUsed)} / ${charTownStorageCap} weight</span></div>`;
                const tsItems = (Player.townStorage && Player.townStorage[Player.townId]) || {};
                const tsEntries = Object.entries(tsItems).filter(([, q]) => q > 0);
                if (tsEntries.length > 0) {
                    html += `<div style="font-size:0.72rem;margin-top:4px;color:var(--text-muted);">Stored: `;
                    html += tsEntries.map(([rId, q]) => { const r = findResource(rId); return (r ? r.icon + ' ' : '') + (r ? r.name : rId) + ' (' + q + ')'; }).join(', ');
                    html += `</div>`;
                }
                html += `</div>`;
            } else {
                html += `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">No warehouses in current town</div>`;
            }
        }
        html += `</div>`;

        html += `<div class="detail-section">
            <h3>Statistics</h3>
            <div class="detail-row"><span class="label">Net Worth</span>
                <span class="value gold-value">${formatGold(Player.getNetWorth ? Player.getNetWorth() : Player.gold)}</span></div>
            <div class="detail-row"><span class="label">Days Played</span>
                <span class="value">${Player.stats ? Player.stats.daysPlayed : 0}</span></div>
            <div class="detail-row"><span class="label">Trades Made</span>
                <span class="value">${Player.stats ? Player.stats.tradesCompleted : 0}</span></div>
            <div class="detail-row"><span class="label">Gold Earned</span>
                <span class="value">${formatGold(Player.stats ? Player.stats.totalGoldEarned : 0)}</span></div>
            <div class="detail-row"><span class="label">Gold Spent</span>
                <span class="value">${formatGold(Player.stats ? Player.stats.totalGoldSpent : 0)}</span></div>
        </div>`;

        // Social Status section
        html += buildSocialStatusHtml();

        openModal(`👤 ${Player.fullName || 'Character'}`, html);
    }

    function buyWeapon(equipmentId) {
        try {
            const result = Player.equipWeapon(equipmentId);
            if (result && result.success) {
                toast(result.message, 'success');
                openCharacterDialog(); // refresh
            } else {
                toast((result && result.message) || 'Cannot buy weapon', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Cannot buy weapon', 'danger');
        }
    }

    // ── Storage Container & Warehouse Management ──

    function buyContainerUI(containerId) {
        try {
            const result = Player.buyContainer(containerId);
            toast(result.message, result.success ? 'success' : 'warning');
            if (result.success) openCharacterDialog();
        } catch (e) {
            toast(e.message || 'Cannot buy container', 'danger');
        }
    }

    function sellHorse(horseId) {
        var result = Player.sellHorse(horseId);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openCharacterDialog(); // Refresh
    }

    function depositToStorageUI(resId, qty) {
        try {
            const result = Player.depositToStorage(resId, qty);
            toast(result.message, result.success ? 'success' : 'warning');
            if (result.success) openTradeDialog();
        } catch (e) {
            toast(e.message || 'Cannot deposit', 'danger');
        }
    }

    function withdrawFromStorageUI(resId, qty) {
        try {
            const result = Player.withdrawFromStorage(resId, qty);
            toast(result.message, result.success ? 'success' : 'warning');
            if (result.success) openTradeDialog();
        } catch (e) {
            toast(e.message || 'Cannot withdraw', 'danger');
        }
    }

    function buyArmor(equipmentId) {
        try {
            const result = Player.equipArmor(equipmentId);
            if (result && result.success) {
                toast(result.message, 'success');
                openCharacterDialog(); // refresh
            } else {
                toast((result && result.message) || 'Cannot buy armor', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Cannot buy armor', 'danger');
        }
    }

    function unequipWeaponUI() {
        try {
            const result = Player.unequipWeapon();
            toast(result.message, result.success ? 'success' : 'warning');
            if (result.success) openCharacterDialog();
        } catch (e) {
            toast(e.message || 'Cannot unequip', 'danger');
        }
    }

    function unequipArmorUI() {
        try {
            const result = Player.unequipArmor();
            toast(result.message, result.success ? 'success' : 'warning');
            if (result.success) openCharacterDialog();
        } catch (e) {
            toast(e.message || 'Cannot unequip', 'danger');
        }
    }

    // ── MAP VIEW ──

    var _mapModeState = 0; // 0=normal, 1=strategic, 2=world

    function openMapView() {
        if (typeof Renderer === 'undefined') return;

        _mapModeState = (_mapModeState + 1) % 3;

        if (_mapModeState === 0) {
            Renderer.setMapMode(0);
            Renderer.centerOnPlayer();
            toast('Normal view restored', 'info');
        } else if (_mapModeState === 1) {
            Renderer.setMapMode(1);
            toast('Strategic Map — click Map again for World Map', 'info');
        } else if (_mapModeState === 2) {
            Renderer.setMapMode(2);
            toast('World Map — click Map to return to game', 'info');
        }
    }

    function closeMapView() {
        if (typeof Renderer === 'undefined') return;
        if (_mapModeState !== 0) {
            Renderer.setMapMode(0);
            Renderer.centerOnPlayer();
            _mapModeState = 0;
            toast('Normal view restored', 'info');
        }
    }

    function locatePlayer() {
        if (typeof Renderer === 'undefined') return;
        if (_mapModeState === 2) {
            _mapModeState = 0;
        }
        Renderer.locatePlayer();
        _mapModeState = 0;
        toast('Centered on your location', 'info');
    }

    function eatUntilFull() {
        if (typeof Player === 'undefined' || !Player.eatUntilFull) return;
        var result = Player.eatUntilFull();
        if (result.success) {
            toast('🍴 ' + result.message, 'success');
            updateHungerBar();
            update();
        } else {
            toast(result.message, 'warning');
        }
    }

    function drinkUntilFull() {
        if (typeof Player === 'undefined' || !Player.drinkUntilFull) return;
        var result = Player.drinkUntilFull();
        if (result.success) {
            toast('🥤 ' + result.message, 'success');
            updateFatigueBar();
            update();
        } else {
            toast(result.message, 'warning');
        }
    }

    // ── EVENT LOG ──

    function inferCategoryFromMessage(event) {
        var m = ((event.message || event.description || '') + ' ' + ((event.details && event.details.type) || '')).toLowerCase();
        if (m.includes('war') || m.includes('army') || m.includes('siege') || m.includes('battle')) return 'military';
        if (m.includes('trade') || m.includes('sold') || m.includes('bought')) return 'my_actions';
        if (m.includes('caravan') || m.includes('warehouse') || m.includes('building')) return 'my_business';
        if (m.includes('plague') || m.includes('fire') || m.includes('flood')) return 'local_town';
        if (m.includes('law') || m.includes('tax') || m.includes('festival') || m.includes('king')) return 'my_kingdom';
        if (m.includes('pirate') || m.includes('bandit') || m.includes('ambush')) return 'combat';
        if (m.includes('elite merchant') || m.includes('married') || m.includes('retired')) return 'npc_activity';
        return 'local_town';
    }

    function openEventLog() {
        let events;
        try { events = Engine.getEvents(); } catch (e) { events = []; }

        // Mark all events as read
        _lastSeenEventCount = events ? events.length : 0;
        updateNotifCount();

        if (!events || !events.length) {
            openModal('📋 Event Log', '<div class="text-dim text-center">No events yet.</div>');
            return;
        }

        const tradeLog = Player.tradeLog || [];

        // Build filter bar
        var filterBarHtml = '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">';
        var filterLabels = {
            my_actions: '🎯 My Actions',
            my_business: '💼 Business',
            my_kingdom: '👑 Kingdom',
            local_town: '🏘️ Local',
            foreign_kingdoms: '🌍 Foreign',
            world_economy: '📈 Economy',
            military: '⚔️ Military',
            npc_activity: '👥 NPCs',
            travel_events: '🚶 Travel',
            combat: '☠️ Combat',
        };
        var filters = (typeof Player !== 'undefined' && Player.getNotificationFilters) ? Player.getNotificationFilters() : {};
        for (var fKey in filterLabels) {
            if (filterLabels.hasOwnProperty(fKey)) {
                var fLabel = filterLabels[fKey];
                var isOn = filters[fKey] === true || filters[fKey] === 'smart';
                var isSmart = filters[fKey] === 'smart';
                filterBarHtml += '<button class="btn-medieval" style="font-size:0.7rem;padding:2px 6px;opacity:' + (isOn ? 1 : 0.4) + ';' + (isSmart ? 'border:1px solid gold;' : '') + '" onclick="UI.toggleNotifFilter(\'' + fKey + '\')">' + fLabel + '</button>';
            }
        }
        filterBarHtml += '</div>';

        let html = filterBarHtml;
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';

        // Combine engine events and trade log, sort by day descending
        const allEvents = [
            ...events.map(e => ({ ...e, source: 'world' })),
            ...tradeLog.map((t, i) => ({
                day: t.day || 0,
                type: 'trade',
                description: t.description || `Trade #${i + 1}`,
                source: 'trade'
            }))
        ].sort((a, b) => (b.day || 0) - (a.day || 0));

        // Filter events by notification settings
        const filteredEvents = allEvents.filter(function(e) {
            var cat = e.category || inferCategoryFromMessage(e);
            if (typeof Player !== 'undefined' && Player.shouldShowNotification) {
                return Player.shouldShowNotification(cat, e);
            }
            return true;
        });

        html += '<span style="font-size:0.85rem;color:var(--text-muted);">' + Math.min(filteredEvents.length, 100) + ' events</span>' +
            '<button class="btn-medieval" onclick="UI.clearEventLog()" style="font-size:0.8rem;padding:4px 10px;">🗑️ Clear Log</button>' +
            '</div>';
        html += '<div class="event-log-list">';

        // Store events for detail lookup
        openEventLog._cachedEvents = filteredEvents;

        for (let evIdx = 0; evIdx < Math.min(filteredEvents.length, 100); evIdx++) {
            const event = filteredEvents[evIdx];
            const type = (event.type || event.message || '').toLowerCase();
            let eventClass = 'event-world';
            if (type.includes('war') || type.includes('plague') || type.includes('assassin') || type.includes('bandit') ||
                type.includes('collapse') || type.includes('bankrupt')) {
                eventClass = 'event-war';
            } else if (type.includes('flood') || type.includes('fire') || type.includes('blight') ||
                       type.includes('mine collapse') || type.includes('embargo') || type.includes('disaster')) {
                eventClass = 'event-war';
            } else if (type.includes('trade') || type.includes('festival') || type.includes('bountiful') ||
                       type.includes('discovery') || type.includes('prospector')) {
                eventClass = 'event-trade';
            } else if (type.includes('personal') || type.includes('hire') || type.includes('build') ||
                       type.includes('refugee') || type.includes('migrat')) {
                eventClass = 'event-personal';
            }

            const clickAction = `onclick="UI.showEventDetail(${evIdx})"`;

            html += `<div class="event-log-item ${eventClass}" ${clickAction} style="cursor:pointer;">
                <span class="event-day">Day ${event.day || '?'}</span>
                <span class="event-text">${event.description || event.message || type || 'Event'}</span>
                ${event.details ? '<span class="event-detail-icon" style="float:right;opacity:0.5;">\u2139\uFE0F</span>' : ''}
            </div>`;
        }

        html += '</div>';
        openModal('📋 Event Log', html);
    }

    function clearEventLog() {
        try {
            var world = Engine.getWorld();
            if (world && world.eventLog) {
                world.eventLog.length = 0;
            }
        } catch (e) {}
        if (Player.tradeLog) Player.tradeLog.length = 0;
        _lastSeenEventCount = 0;
        updateNotifCount();
        closeModal();
        toast('Event log cleared', 'info');
    }

    function toggleNotifFilter(key) {
        if (typeof Player !== 'undefined' && Player.toggleNotifFilter) {
            Player.toggleNotifFilter(key);
            // Refresh event log if it's open
            openEventLog();
        }
    }

    function openSettings() {
        var filters = (typeof Player !== 'undefined' && Player.getNotificationFilters) ? Player.getNotificationFilters() : {};

        var filterDefs = [
            { key: 'my_actions', label: '🎯 My Actions', desc: 'Your trades, travel, work results' },
            { key: 'my_business', label: '💼 My Business', desc: 'Caravan arrivals, building output, worker events' },
            { key: 'my_kingdom', label: '👑 My Kingdom', desc: 'Laws, taxes, king mood, festivals, wars' },
            { key: 'local_town', label: '🏘️ Local Town', desc: 'Events in your current town' },
            { key: 'foreign_kingdoms', label: '🌍 Foreign Kingdoms', desc: 'Wars, laws, diplomacy of other kingdoms' },
            { key: 'world_economy', label: '📈 World Economy', desc: 'Trade crazes, embargoes, price controls' },
            { key: 'military', label: '⚔️ Military/War', desc: 'Troop movements, battles, sieges', hasSmart: true },
            { key: 'npc_activity', label: '👥 NPC Activity', desc: 'Elite merchant moves, NPC events' },
            { key: 'travel_events', label: '🚶 Travel Events', desc: 'Foraging, terrain encounters, ambushes' },
            { key: 'combat', label: '☠️ Combat/Piracy', desc: 'Pirate raids, blockades, attacks near you' },
            { key: 'tracked', label: '⭐ Tracked Merchants', desc: 'Activities of elite merchants you are tracking' },
        ];

        var html = '<h3 style="margin-top:0;color:var(--gold);">📢 Notification Filters</h3>';
        html += '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;">Control which notifications you see. Critical alerts (jail, death, ship sunk) always show.</p>';

        for (var fi = 0; fi < filterDefs.length; fi++) {
            var f = filterDefs[fi];
            var val = filters[f.key];
            var isOn = val === true;
            var isSmart = val === 'smart';
            var isOff = val === false;

            html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">';
            html += '<div style="flex:1;"><span style="font-size:0.95rem;">' + f.label + '</span><br><span style="font-size:0.75rem;color:var(--text-muted);">' + f.desc + '</span></div>';
            html += '<div style="display:flex;gap:2px;">';

            if (f.hasSmart) {
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:2px 8px;' + (isSmart ? 'background:var(--gold);color:#000;' : 'opacity:0.5;') + '" onclick="UI.setNotifFilter(\'' + f.key + '\',\'smart\')">Smart</button>';
            }
            html += '<button class="btn-medieval" style="font-size:0.7rem;padding:2px 8px;' + (isOn ? 'background:#55a868;color:#fff;' : 'opacity:0.5;') + '" onclick="UI.setNotifFilter(\'' + f.key + '\',true)">On</button>';
            html += '<button class="btn-medieval" style="font-size:0.7rem;padding:2px 8px;' + (isOff ? 'background:#c44e52;color:#fff;' : 'opacity:0.5;') + '" onclick="UI.setNotifFilter(\'' + f.key + '\',false)">Off</button>';
            html += '</div></div>';
        }

        // Skill-gated info
        html += '<h3 style="margin-top:16px;color:var(--gold);">🔒 Intel Skills</h3>';
        html += '<p style="font-size:0.8rem;color:var(--text-muted);">Some notifications require skills to see:</p>';

        var intelSkills = [
            { id: 'foreign_intelligence', name: 'Foreign Intelligence', desc: 'See foreign kingdom events (wars, laws, embargoes)' },
            { id: 'court_informant', name: 'Court Informant', desc: 'See sensitive political intel (succession, coups, alliances)' },
            { id: 'trade_network_intelligence', name: 'Trade Network Intel', desc: 'See elite merchant activities and major trades' },
            { id: 'elite_tracker', name: 'Elite Tracker', desc: 'Detailed notifications about tracked elite merchants\' trades and travels' },
        ];

        for (var si = 0; si < intelSkills.length; si++) {
            var s = intelSkills[si];
            var hasIt = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill(s.id);
            html += '<div style="padding:4px 0;opacity:' + (hasIt ? '1' : '0.5') + ';">';
            html += '<span>' + (hasIt ? '✅' : '🔒') + ' ' + s.name + '</span>';
            html += '<br><span style="font-size:0.75rem;color:var(--text-muted);">' + s.desc + '</span>';
            html += '</div>';
        }

        openModal('⚙️ Settings', html);
    }

    function setNotifFilter(key, value) {
        if (typeof Player !== 'undefined' && Player.setNotifFilter) {
            Player.setNotifFilter(key, value);
            openSettings(); // refresh
        }
    }

    function showEventDetail(eventIndex) {
        var events = openEventLog._cachedEvents;
        if (!events || eventIndex >= events.length) return;
        var event = events[eventIndex];

        var html = '<div class="event-detail-panel">';

        // Main message
        html += '<div class="event-detail-message" style="font-size:1.1rem;margin-bottom:12px;color:var(--gold-bright);">' + (event.message || event.description || 'Event') + '</div>';
        html += '<div class="event-detail-day" style="color:var(--text-dim);margin-bottom:12px;">Day ' + (event.day || '?') + '</div>';

        if (event.details) {
            // Cause
            if (event.details.cause) {
                html += '<div style="margin-bottom:10px;">';
                html += '<div style="color:var(--gold);font-weight:bold;margin-bottom:4px;">\uD83D\uDCD6 Why This Happened</div>';
                html += '<div style="color:var(--parchment);">' + event.details.cause + '</div>';
                html += '</div>';
            }

            // Effects
            if (event.details.effects && event.details.effects.length > 0) {
                html += '<div style="margin-bottom:10px;">';
                html += '<div style="color:var(--gold);font-weight:bold;margin-bottom:4px;">\u26A1 Effects</div>';
                html += '<ul style="margin:0;padding-left:20px;">';
                for (var ei = 0; ei < event.details.effects.length; ei++) {
                    html += '<li style="color:var(--parchment);margin-bottom:4px;">' + event.details.effects[ei] + '</li>';
                }
                html += '</ul></div>';
            }

            // Navigate to town button
            var townId = event.details.townId || event.townId;
            if (townId) {
                html += '<button class="btn-action" style="margin-top:8px;" onclick="UI.closeModal(); UI.clickTown(\'' + townId + '\');">\uD83D\uDDFA\uFE0F View Location</button>';
            }
        } else {
            html += '<div style="color:var(--text-dim);font-style:italic;">No additional details available for this event.</div>';
            // Still allow navigation if there's a townId
            if (event.townId) {
                html += '<button class="btn-action" style="margin-top:8px;" onclick="UI.closeModal(); UI.clickTown(\'' + event.townId + '\');">\uD83D\uDDFA\uFE0F View Location</button>';
            }
        }

        html += '</div>';

        openModal('\uD83D\uDCCB Event Details', html, '<button class="btn-action" onclick="UI.closeModal()">Close</button>');
    }

    // ═══════════════════════════════════════════════════════════
    //  TOASTS / NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════

    function toast(message, type, category) {
        type = type || 'info';
        category = category || 'my_actions';

        // Check notification filter
        if (typeof Player !== 'undefined' && Player.shouldShowNotification) {
            if (!Player.shouldShowNotification(category, null)) return;
        }

        const icons = { info: 'ℹ️', warning: '⚠️', danger: '🔴', success: '✅', achievement: '🏆' };
        const id = 'toast_' + (toastId++);

        const toastEl = document.createElement('div');
        toastEl.className = `toast toast-${type}`;
        toastEl.id = id;
        toastEl.innerHTML = `<span class="toast-icon">${icons[type] || ''}</span> ${message}`;
        toastEl.addEventListener('click', () => dismissToast(id));

        el.toastContainer.appendChild(toastEl);

        // Track for notification count
        notifications.push({ id, message, type, time: Date.now() });
        updateNotifCount();

        // Auto-dismiss after 5 seconds
        setTimeout(() => dismissToast(id), 5000);
    }

    function dismissToast(id) {
        const toastEl = document.getElementById(id);
        if (!toastEl) return;
        toastEl.classList.add('toast-out');
        setTimeout(() => {
            if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
        }, 300);
    }

    function updateNotifCount() {
        // Show count of unread events since last time log was opened
        var totalEvents = 0;
        try {
            var evts = Engine.getEvents();
            totalEvents = evts ? evts.length : 0;
        } catch (e) { totalEvents = 0; }
        var unread = Math.max(0, totalEvents - _lastSeenEventCount);
        if (el.notifCount) {
            if (unread > 0) {
                el.notifCount.textContent = unread > 99 ? '99+' : unread;
                el.notifCount.classList.remove('hidden');
            } else {
                el.notifCount.classList.add('hidden');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  TOOLTIP
    // ═══════════════════════════════════════════════════════════

    function showTooltip(x, y, text) {
        if (!el.tooltip) return;
        el.tooltip.textContent = text;
        el.tooltip.classList.remove('hidden');
        // Position near cursor, keep on screen
        const ttw = el.tooltip.offsetWidth;
        const tth = el.tooltip.offsetHeight;
        let tx = x + 12;
        let ty = y + 12;
        if (tx + ttw > window.innerWidth - 8) tx = x - ttw - 8;
        if (ty + tth > window.innerHeight - 8) ty = y - tth - 8;
        el.tooltip.style.left = tx + 'px';
        el.tooltip.style.top = ty + 'px';
    }

    function hideTooltip() {
        if (el.tooltip) el.tooltip.classList.add('hidden');
    }

    // ═══════════════════════════════════════════════════════════
    //  CONTEXT MENU
    // ═══════════════════════════════════════════════════════════

    function showContextMenu(x, y, items) {
        if (!el.contextMenu) return;
        const container = el.contextMenu.querySelector('.context-menu-items');
        if (!container) return;
        let html = '';
        for (const item of items) {
            if (item.separator) {
                html += '<div class="ctx-separator"></div>';
            } else {
                html += `<div class="ctx-item ${item.disabled ? 'disabled' : ''}" onclick="${item.disabled ? '' : item.action}">
                    ${item.icon || ''} ${item.label}
                </div>`;
            }
        }
        container.innerHTML = html;
        el.contextMenu.classList.remove('hidden');

        // Position
        let cx = x;
        let cy = y;
        if (cx + 180 > window.innerWidth) cx = x - 180;
        if (cy + 200 > window.innerHeight) cy = y - 200;
        el.contextMenu.style.left = cx + 'px';
        el.contextMenu.style.top = cy + 'px';
    }

    function hideContextMenu() {
        if (el.contextMenu) el.contextMenu.classList.add('hidden');
    }

    // ═══════════════════════════════════════════════════════════
    //  WAR ALLEGIANCE POPUP
    // ═══════════════════════════════════════════════════════════

    function showWarAllegiancePopup(warEvent) {
        if (!warEvent) return;
        const nameA = warEvent.nameA || 'Kingdom A';
        const nameB = warEvent.nameB || 'Kingdom B';
        const strengthA = warEvent.strengthA || 0;
        const strengthB = warEvent.strengthB || 0;
        const warId = warEvent.warId;

        // Get military breakdown
        let breakdownA = { infantry: 0, archers: 0, cavalry: 0 };
        let breakdownB = { infantry: 0, archers: 0, cavalry: 0 };
        try {
            if (Engine.getMilitaryBreakdown) {
                breakdownA = Engine.getMilitaryBreakdown(warEvent.kingdomA) || breakdownA;
                breakdownB = Engine.getMilitaryBreakdown(warEvent.kingdomB) || breakdownB;
            }
        } catch (e) { /* no-op */ }

        // Build strength bars
        const maxStr = Math.max(strengthA, strengthB, 1);
        const barA = Math.round((strengthA / maxStr) * 10);
        const barB = Math.round((strengthB / maxStr) * 10);
        const barStrA = '█'.repeat(barA) + '░'.repeat(10 - barA);
        const barStrB = '█'.repeat(barB) + '░'.repeat(10 - barB);

        // Determine player context
        let contextLine = '';
        const pCitizenA = Player.isPlayerCitizenOf ? Player.isPlayerCitizenOf(warEvent.kingdomA) : (Player.citizenshipKingdomId === warEvent.kingdomA);
        const pCitizenB = Player.isPlayerCitizenOf ? Player.isPlayerCitizenOf(warEvent.kingdomB) : (Player.citizenshipKingdomId === warEvent.kingdomB);
        if (pCitizenA || pCitizenB) {
            const citizenName = pCitizenA ? nameA : nameB;
            contextLine = `As a citizen of <strong>${citizenName}</strong> with military trade interests, you must decide:`;
        } else {
            contextLine = 'As a merchant with military trade interests, you must decide:';
        }

        const bodyHtml = `
            <div style="text-align:center;padding:10px;">
                <h2 style="color:#c44e52;margin:0 0 10px 0;">⚔️ WAR DECLARED! ⚔️</h2>
                <p style="font-size:1.1em;margin-bottom:15px;"><strong>${nameA}</strong> has declared war on <strong>${nameB}</strong>!</p>
                <div style="background:#1a1a2e;padding:12px;border-radius:6px;margin-bottom:15px;text-align:left;font-family:monospace;">
                    <div style="margin-bottom:8px;"><strong>Military Comparison:</strong></div>
                    <div style="margin-bottom:4px;">${nameA}: <span style="color:#4ecdc4;">${barStrA}</span> ~${strengthA} strength</div>
                    <div style="font-size:0.85em;color:#888;margin-bottom:8px;">  ${(breakdownA.infantry || breakdownA.archers || breakdownA.cavalry) ? 'Infantry: ' + (breakdownA.infantry || 0) + ' | Archers: ' + (breakdownA.archers || 0) + ' | Cavalry: ' + (breakdownA.cavalry || 0) : 'Soldiers: ' + (breakdownA.soldiers || breakdownA.total || 0) + ' | Garrison: ' + (breakdownA.garrison || 0)}</div>
                    <div style="margin-bottom:4px;">${nameB}: <span style="color:#ff6b6b;">${barStrB}</span> ~${strengthB} strength</div>
                    <div style="font-size:0.85em;color:#888;">  ${(breakdownB.infantry || breakdownB.archers || breakdownB.cavalry) ? 'Infantry: ' + (breakdownB.infantry || 0) + ' | Archers: ' + (breakdownB.archers || 0) + ' | Cavalry: ' + (breakdownB.cavalry || 0) : 'Soldiers: ' + (breakdownB.soldiers || breakdownB.total || 0) + ' | Garrison: ' + (breakdownB.garrison || 0)}</div>
                </div>
                <p style="margin-bottom:15px;">${contextLine}</p>
            </div>
        `;

        const footerHtml = `
            <button class="btn" onclick="UI.chooseWarAllegiance('${warId}','neutral')" style="margin:4px;position:relative;" title="Stay Neutral&#10;&#10;✅ Trade freely with BOTH sides&#10;✅ No reputation change&#10;✅ No war-end reward or punishment&#10;&#10;⚠️ Military sales to both sides are tracked&#10;⚠️ Lopsided sales (2:1+) trigger warnings&#10;⚠️ At 3:1 ratio: extra 10% tax from disadvantaged side&#10;⚠️ At 5:1 ratio: building seizure risk&#10;⚠️ At 10:1 ratio: total asset seizure + reputation destroyed">🕊️ Stay Neutral</button>
            <button class="btn" onclick="UI.chooseWarAllegiance('${warId}','${warEvent.kingdomA}')" style="margin:4px;" title="Side with ${nameA}&#10;&#10;✅ If ${nameA} wins: +30 reputation, +1 social rank, gold reward (up to 5000g)&#10;✅ Unlocks 'War Hero' achievement&#10;&#10;❌ Cannot sell military goods to ${nameB}&#10;❌ If ${nameA} loses: buildings in ${nameB} territory seized&#10;❌ If ${nameA} loses: reputation with ${nameB} drops to 10">⚔️ Side with ${nameA}</button>
            <button class="btn" onclick="UI.chooseWarAllegiance('${warId}','${warEvent.kingdomB}')" style="margin:4px;" title="Side with ${nameB}&#10;&#10;✅ If ${nameB} wins: +30 reputation, +1 social rank, gold reward (up to 5000g)&#10;✅ Unlocks 'War Hero' achievement&#10;&#10;❌ Cannot sell military goods to ${nameA}&#10;❌ If ${nameB} loses: buildings in ${nameA} territory seized&#10;❌ If ${nameB} loses: reputation with ${nameA} drops to 10">⚔️ Side with ${nameB}</button>
        `;

        // Pause game during popup
        if (typeof Game !== 'undefined' && Game.setSpeed) {
            Game._preWarSpeed = Game.getSpeed ? Game.getSpeed() : 1;
            Game.setSpeed(0);
        }

        openModal('⚔️ War Declaration', bodyHtml, footerHtml);
    }

    function chooseWarAllegiance(warId, side) {
        if (typeof Player !== 'undefined' && Player.setWarAllegiance) {
            Player.setWarAllegiance(warId, side);
        }
        closeModal();
        // Restore game speed
        if (typeof Game !== 'undefined' && Game.setSpeed && Game._preWarSpeed) {
            Game.setSpeed(Game._preWarSpeed);
            Game._preWarSpeed = null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  BANKRUPTCY DIALOG
    // ═══════════════════════════════════════════════════════════

    function showBankruptcyDialog(debtAmount, choices) {
        var bodyHtml = '<div style="padding:15px;text-align:center;">';
        bodyHtml += '<p style="color:#ff6b6b;font-size:18px;margin-bottom:10px;">💸 You are bankrupt!</p>';
        bodyHtml += '<p style="color:#ccc;font-size:14px;margin-bottom:5px;">You have been in debt for 7 consecutive days with no assets to seize.</p>';
        bodyHtml += '<p style="color:#ff9;font-size:14px;margin-bottom:20px;">Outstanding debt: <strong>' + debtAmount + 'g</strong></p>';
        bodyHtml += '<p style="color:#aaa;font-size:13px;margin-bottom:15px;">The kingdom demands you choose your fate:</p>';
        bodyHtml += '</div>';

        bodyHtml += '<div style="display:flex;flex-direction:column;gap:10px;padding:0 15px 15px;">';

        for (var i = 0; i < choices.length; i++) {
            var ch = choices[i];
            var borderColor = ch.available ? (ch.id === 'indenture' ? '#c4a' : ch.id === 'military' ? '#a44' : '#5a5') : '#444';
            var bgColor = ch.available ? (ch.id === 'indenture' ? '#3a1a2a' : ch.id === 'military' ? '#3a1a1a' : '#1a2a1a') : '#1a1a1a';
            var opacity = ch.available ? '1' : '0.5';
            var cursor = ch.available ? 'pointer' : 'not-allowed';

            bodyHtml += '<div ' + (ch.available ? 'onclick="UI.handleBankruptcyChoice(\'' + ch.id + '\')"' : '') + ' style="';
            bodyHtml += 'border:2px solid ' + borderColor + ';background:' + bgColor + ';padding:14px;border-radius:8px;';
            bodyHtml += 'cursor:' + cursor + ';opacity:' + opacity + ';transition:all 0.2s;text-align:left;"';
            if (ch.available) {
                bodyHtml += ' onmouseover="this.style.borderColor=\'#fff\';this.style.transform=\'scale(1.02)\'"';
                bodyHtml += ' onmouseout="this.style.borderColor=\'' + borderColor + '\';this.style.transform=\'scale(1)\'"';
            }
            bodyHtml += '>';

            bodyHtml += '<div style="font-size:15px;font-weight:bold;color:' + (ch.available ? '#fff' : '#666') + ';margin-bottom:6px;">' + ch.label + '</div>';
            bodyHtml += '<div style="font-size:12px;color:' + (ch.available ? '#ccc' : '#555') + ';margin-bottom:6px;">' + ch.description + '</div>';
            bodyHtml += '<div style="font-size:11px;color:' + (ch.available ? '#999' : '#444') + ';">' + ch.detail + '</div>';

            bodyHtml += '</div>';
        }

        bodyHtml += '</div>';

        openModal('💸 Bankruptcy', bodyHtml, '');
    }

    function handleBankruptcyChoice(choice) {
        if (typeof Player !== 'undefined' && Player.handleBankruptcyChoice) {
            Player.handleBankruptcyChoice(choice);
        }
        closeModal();
        // Resume game
        if (typeof Game !== 'undefined' && Game.setSpeed) {
            Game.setSpeed(1);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  SPY FAVOR DIALOG
    // ═══════════════════════════════════════════════════════════
    function showSpyFavorDialog(kingdomId) {
        if (typeof Player === 'undefined' || !Player.getSpyFavorChoices) return;
        var choices = Player.getSpyFavorChoices(kingdomId);
        if (!choices || choices.length === 0) return;

        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(0);

        var bodyHtml = '<div style="margin-bottom:12px;font-size:14px;color:#c4a35a;">' +
            '👑 The King is so impressed by your spy work that he offers you a personal favor. Choose wisely — this is a rare opportunity!' +
            '</div>';

        for (var i = 0; i < choices.length; i++) {
            var ch = choices[i];
            bodyHtml += '<div onclick="UI.handleSpyFavor(\'' + ch.id + '\')" style="' +
                'background:#1a1a2e;border:1px solid #444;border-radius:8px;padding:10px 14px;margin:6px 0;cursor:pointer;transition:border-color 0.2s,background 0.2s;' +
                '" onmouseenter="this.style.borderColor=\'#c4a35a\';this.style.background=\'#222244\'" onmouseleave="this.style.borderColor=\'#444\';this.style.background=\'#1a1a2e\'">' +
                '<div style="font-weight:bold;font-size:14px;color:#e0d5c0;">' + ch.label + '</div>' +
                '<div style="font-size:12px;color:#999;margin-top:4px;">' + ch.description + '</div>' +
                '<div style="font-size:11px;color:#c4a35a;margin-top:3px;">' + ch.detail + '</div>' +
                '</div>';
        }

        openModal('👑 Royal Favor', bodyHtml, '');
    }

    function handleSpyFavor(favorId) {
        if (typeof Player !== 'undefined' && Player.handleSpyFavor) {
            var result = Player.handleSpyFavor(favorId);
            if (result && result.message && typeof toast === 'function') {
                toast(result.success ? '✅ ' + result.message : '❌ ' + result.message, result.success ? 'success' : 'danger');
            }
        }
        closeModal();
        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(1);
    }

    // ═══════════════════════════════════════════════════════════
    //  TOURNAMENT CONTINUE/FORFEIT DIALOG
    // ═══════════════════════════════════════════════════════════
    function showTournamentContinueDialog(result) {
        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(0);

        var bodyHtml = '<div style="text-align:center;margin-bottom:12px;">' +
            '<div style="font-size:24px;margin-bottom:8px;">🏟️ Round ' + (result.nextRound - 1) + ' Victory!</div>' +
            '<div style="color:#c4a35a;font-size:16px;margin-bottom:12px;">' + result.message.split('\n')[0] + '</div>' +
            '</div>';

        bodyHtml += '<div style="background:#1a1a2e;border:1px solid #444;border-radius:8px;padding:12px;margin:8px 0;text-align:center;">' +
            '<div style="font-size:14px;color:#e0d5c0;">⚔️ Round ' + result.nextRound + '</div>' +
            '<div style="font-size:13px;color:#999;margin-top:4px;">Prize: <span style="color:#c4a35a;">' + result.nextPrize + 'g</span> | Win chance: <span style="color:' + (result.nextWinChance >= 50 ? '#4ade80' : result.nextWinChance >= 25 ? '#fbbf24' : '#f87171') + ';">' + result.nextWinChance + '%</span></div>' +
            '</div>';

        bodyHtml += '<div style="display:flex;gap:10px;margin-top:14px;">' +
            '<button onclick="UI.handleTournamentContinue()" style="flex:1;padding:10px;background:#2d5a2d;color:#fff;border:1px solid #4ade80;border-radius:6px;cursor:pointer;font-size:14px;">⚔️ Fight Next Round</button>' +
            '<button onclick="UI.handleTournamentForfeit()" style="flex:1;padding:10px;background:#5a2d2d;color:#fff;border:1px solid #f87171;border-radius:6px;cursor:pointer;font-size:14px;">🏳️ Withdraw (Keep Winnings)</button>' +
            '</div>';

        openModal('🏟️ Tournament', bodyHtml, '');
    }

    function handleTournamentContinue() {
        closeModal();
        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(1);
        if (typeof Player !== 'undefined' && Player.continueTournament) {
            var result = Player.continueTournament();
            if (result && result.tournamentContinue) {
                setTimeout(function() { showTournamentContinueDialog(result); }, 300);
            }
        }
    }

    function handleTournamentForfeit() {
        closeModal();
        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(1);
        if (typeof Player !== 'undefined' && Player.forfeitTournament) {
            Player.forfeitTournament();
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  CUSTOMS INSPECTOR CONTRABAND DIALOG
    // ═══════════════════════════════════════════════════════════
    function showCustomsChoiceDialog(itemName, resourceId, kingdomId) {
        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(0);
        var bodyHtml = '<div style="text-align:center;margin-bottom:12px;">' +
            '<div style="font-size:20px;margin-bottom:8px;">🔍 Contraband Found!</div>' +
            '<div style="color:#c4a35a;font-size:14px;">You discovered <strong>' + itemName + '</strong> while inspecting cargo.</div>' +
            '</div>';
        bodyHtml += '<div style="display:flex;gap:10px;margin-top:14px;">' +
            '<div onclick="UI.handleCustomsChoice(\'turn_in\')" style="flex:1;padding:12px;background:#1a2e1a;border:1px solid #4ade80;border-radius:8px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:16px;">⚖️ Turn In</div>' +
            '<div style="font-size:12px;color:#999;margin-top:4px;">+10g bounty, +2 kingdom rep</div>' +
            '</div>' +
            '<div onclick="UI.handleCustomsChoice(\'keep\')" style="flex:1;padding:12px;background:#2e1a1a;border:1px solid #f87171;border-radius:8px;cursor:pointer;text-align:center;">' +
            '<div style="font-size:16px;">🤫 Pocket It</div>' +
            '<div style="font-size:12px;color:#999;margin-top:4px;">Keep 1x ' + itemName + ', +5 notoriety</div>' +
            '</div>' +
            '</div>';
        openModal('🔍 Customs Inspection', bodyHtml, '');
    }

    function handleCustomsChoice(choice) {
        closeModal();
        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(1);
        if (typeof Player !== 'undefined' && Player.handleCustomsChoice) {
            Player.handleCustomsChoice(choice);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  AUTO-TRAVEL JOB STATUS (shown in work dialog)
    // ═══════════════════════════════════════════════════════════
    function getAutoTravelStatusHtml() {
        if (typeof Player === 'undefined' || !Player.getAutoTravelStatus) return '';
        var status = Player.getAutoTravelStatus();
        if (!status) return '';

        var html = '<div style="border:2px solid #c4a35a;padding:10px;margin-bottom:12px;border-radius:6px;background:rgba(196,163,90,0.08);">';
        html += '<h3 style="margin:0 0 6px 0;">🗺️ ' + status.name + ' — Active Mission</h3>';
        html += '<div class="detail-row"><span class="label">Status</span><span class="value">';
        if (status.status === 'traveling') html += '🚶 Traveling to ' + status.currentDestination;
        else if (status.status === 'working') html += '⚒️ Working at ' + status.currentDestination;
        else if (status.status === 'advancing') html += '📋 Preparing next leg...';
        html += '</span></div>';
        html += '<div class="detail-row"><span class="label">Progress</span><span class="value">' + status.completedLegs + ' / ' + status.totalLegs + ' stops</span></div>';
        html += '<div class="detail-row"><span class="label">Current Task</span><span class="value" style="font-size:0.75rem;">' + status.currentDescription + '</span></div>';
        html += '<div class="detail-row"><span class="label">Earned So Far</span><span class="value">🪙 ' + formatGold(status.totalPaid || 0) + 'g</span></div>';
        html += '<div class="detail-row"><span class="label">Days Elapsed</span><span class="value">' + status.daysElapsed + '</span></div>';

        // Show letters for messenger
        if (status.letters && status.letters.length > 0) {
            html += '<div style="margin-top:6px;font-size:0.75rem;color:#999;">';
            for (var i = 0; i < status.letters.length; i++) {
                var l = status.letters[i];
                html += (l.delivered ? '✅' : '📮') + ' ' + l.recipientName + ' in ' + l.townName + (l.delivered ? ' (delivered)' : '') + '<br>';
            }
            html += '</div>';
        }

        html += '<button class="btn-medieval" onclick="UI.quitAutoTravelJob()" style="margin-top:8px;font-size:0.8rem;padding:6px 16px;background:rgba(200,50,50,0.15);border-color:rgba(200,50,50,0.3);">🛑 Quit Mission</button>';
        html += '</div>';
        html += '<p class="text-dim">You cannot take other jobs while on an auto-travel mission. The mission progresses automatically.</p>';
        return html;
    }

    function quitAutoTravelJob() {
        if (typeof Player !== 'undefined' && Player.quitAutoTravelJob) {
            var result = Player.quitAutoTravelJob();
            if (result && result.message) {
                toast(result.message, result.success ? 'info' : 'warning');
            }
        }
        closeModal();
    }

    // ═══════════════════════════════════════════════════════════
    //  WIN / LOSE SCREEN
    // ═══════════════════════════════════════════════════════════

    function showWinScreen(message) {
        const endTitle = document.getElementById('endTitle');
        const endMessage = document.getElementById('endMessage');
        if (endTitle) { endTitle.textContent = '🏆 Victory!'; endTitle.style.color = '#c4a35a'; }
        if (endMessage) endMessage.textContent = message || 'You have built a legendary trade empire!';
        showEndStats();
        el.endScreen.classList.remove('hidden');
        el.endScreen.style.display = 'flex';
    }

    // ── REGENCY SCREEN ──

    function showRegencyScreen() {
        if (!Player.regencyMode || !Player.regencyData) return;
        const rd = Player.regencyData;
        const threshold = (typeof REGENCY_THRESHOLDS !== 'undefined') ?
            REGENCY_THRESHOLDS.find(t => rd.regencyScore >= t.min && rd.regencyScore <= t.max) : null;

        let updatesHtml = '';
        const recentUpdates = (rd.monthlyUpdates || []).slice(-6);
        for (const upd of recentUpdates) {
            updatesHtml += `<div style="font-size:0.75rem;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${upd.message}</div>`;
        }
        if (!updatesHtml) updatesHtml = '<div class="text-dim">No updates yet.</div>';

        const yearsToGo = Math.max(0, CONFIG.COMING_OF_AGE - rd.heirAge);
        const heirSexIcon = rd.heirSex === 'F' ? '♀' : '♂';

        const spouseStatus = rd.spouseAlive ? '💚 Alive' : '⚰️ Deceased';
        const thresholdLabel = rd.thresholdLabel || 'Unknown';

        let revealedTraitsHtml = '';
        if (rd.revealedAtDeath) {
            const rTraits = rd.revealedAtDeath.traits || {};
            const rQuirks = rd.revealedAtDeath.quirks || [];
            if (Object.keys(rTraits).length > 0 || rQuirks.length > 0) {
                revealedTraitsHtml += '<div style="font-size:0.75rem;margin-top:6px;">';
                for (const [t, v] of Object.entries(rTraits)) {
                    const label = t.charAt(0).toUpperCase() + t.slice(1);
                    revealedTraitsHtml += `<span style="margin-right:8px;">${label}: ${typeof v === 'number' ? v : v}</span>`;
                }
                if (rQuirks.length > 0 && typeof SPOUSE_QUIRKS !== 'undefined') {
                    for (const qId of rQuirks) {
                        const qDef = SPOUSE_QUIRKS.find(q => q.id === qId);
                        if (qDef) revealedTraitsHtml += `<span style="margin-right:8px;">${qDef.icon} ${qDef.name}</span>`;
                    }
                }
                revealedTraitsHtml += '</div>';
            }
        }

        const html = `<div style="text-align:center;padding:12px;">
            <div style="font-size:1.4rem;font-weight:bold;margin-bottom:12px;">⚰️ REGENCY PERIOD</div>
            <div class="text-dim" style="margin-bottom:12px;">Your spouse manages the estate while your heir grows up.</div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:left;">
                <div style="border:1px solid rgba(196,163,90,0.2);border-radius:6px;padding:10px;">
                    <div style="font-weight:bold;margin-bottom:4px;">👩 Regent: ${rd.spouseName}</div>
                    <div style="font-size:0.8rem;">Status: ${spouseStatus}</div>
                    <div style="font-size:0.8rem;">Outcome: <span style="color:var(--gold);">${thresholdLabel}</span></div>
                    <div style="font-size:0.8rem;">Score: ${rd.regencyScore}/100</div>
                    ${revealedTraitsHtml}
                </div>
                <div style="border:1px solid rgba(196,163,90,0.2);border-radius:6px;padding:10px;">
                    <div style="font-weight:bold;margin-bottom:4px;">${heirSexIcon} Heir: ${rd.heirName}</div>
                    <div style="font-size:0.8rem;">Age: ${rd.heirAge} → ${CONFIG.COMING_OF_AGE} in ~${yearsToGo} years</div>
                    <div style="font-size:0.8rem;margin-top:8px;">💰 Estate: ${formatGold(rd.estateGold || 0)}</div>
                    <div style="font-size:0.8rem;">🏠 Buildings: ${rd.buildingsMaintained} maintained</div>
                </div>
            </div>

            <div style="border:1px solid rgba(196,163,90,0.1);border-radius:6px;padding:8px;margin-top:12px;text-align:left;">
                <div style="font-weight:bold;margin-bottom:4px;font-size:0.85rem;">📜 Recent Updates</div>
                ${updatesHtml}
            </div>

            <div style="margin-top:12px;font-size:0.8rem;color:#888;">
                Time continues to advance. Use speed controls to pass the years.
            </div>
        </div>`;

        openModal('⚰️ Regency', html);
    }

    function updateRegencyOverlay() {
        if (!Player.regencyMode || !Player.regencyData) return;
        // Show a persistent regency bar in the HUD
        let overlay = document.getElementById('regencyOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'regencyOverlay';
            overlay.style.cssText = 'position:fixed;top:40px;left:50%;transform:translateX(-50%);background:rgba(30,25,20,0.95);border:1px solid var(--gold);border-radius:8px;padding:8px 16px;z-index:1000;cursor:pointer;font-size:0.8rem;text-align:center;';
            overlay.onclick = function() { showRegencyScreen(); };
            document.body.appendChild(overlay);
        }
        const rd = Player.regencyData;
        overlay.innerHTML = `⚰️ <b>Regency</b> | ${escapeHtml(rd.spouseName)} raises ${escapeHtml(rd.heirName)} (Age ${rd.heirAge}/${CONFIG.COMING_OF_AGE}) | 💰 ${formatGold(rd.estateGold || 0)} | <span style="color:var(--gold);">${escapeHtml(rd.thresholdLabel)}</span>`;
        overlay.style.display = '';
    }

    function hideRegencyOverlay() {
        const overlay = document.getElementById('regencyOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    function showLoseScreen(message) {
        const endTitle = document.getElementById('endTitle');
        const endMessage = document.getElementById('endMessage');
        if (endTitle) { endTitle.textContent = '💀 Defeat'; endTitle.style.color = '#c44e52'; }
        let loseMsg = message || 'Your merchant ventures have come to a bitter end.';
        if (message === 'No Heir') {
            loseMsg = 'Your legacy dies with you. Without an heir to continue your trade empire, your name fades from history.';
        }
        if (endMessage) endMessage.textContent = loseMsg;
        showEndStats();
        el.endScreen.classList.remove('hidden');
        el.endScreen.style.display = 'flex';
    }

    function showEndStats() {
        const stats = (typeof Player !== 'undefined' && Player.stats) ? Player.stats : {};
        const endStats = document.getElementById('endStats');
        if (!endStats) return;
        endStats.innerHTML = `
            <span class="end-stat-label">Days Played</span><span class="end-stat-value">${stats.daysPlayed || Engine.getDay?.() || 0}</span>
            <span class="end-stat-label">Gold Earned</span><span class="end-stat-value">${formatGold(stats.totalGoldEarned || 0)}</span>
            <span class="end-stat-label">Gold Spent</span><span class="end-stat-value">${formatGold(stats.totalGoldSpent || 0)}</span>
            <span class="end-stat-label">Trades Made</span><span class="end-stat-value">${stats.tradesCompleted || 0}</span>
            <span class="end-stat-label">Final Gold</span><span class="end-stat-value">${formatGold(Player.gold || 0)}</span>
            <span class="end-stat-label">Buildings</span><span class="end-stat-value">${Player.buildings?.length || 0}</span>
        `;

        const btnEndOk = document.getElementById('btnEndOk');
        if (btnEndOk) btnEndOk.onclick = function () {
            el.endScreen.classList.add('hidden');
            el.endScreen.style.display = 'none';
            // Return to title
            hideGameUI();
            el.titleScreen.classList.remove('hidden');
            el.titleScreen.style.display = 'flex';
        };
    }

    // ═══════════════════════════════════════════════════════════
    //  ACTION HELPERS (called from onclick attributes)
    // ═══════════════════════════════════════════════════════════

    // ---- Travel Options Dialog ----

    function calculateRouteDist(route) {
        var totalDist = 0;
        if (!route) return 0;
        for (var i = 0; i < route.length; i++) {
            var a = Engine.findTown(route[i].fromTownId);
            var b = Engine.findTown(route[i].toTownId);
            if (a && b) totalDist += Math.hypot(a.x - b.x, a.y - b.y);
        }
        return totalDist;
    }

    function getTransportServices(fromTown, toTown, type) {
        var services = [];
        if (!fromTown || !toTown) return services;

        var kingdom = null;
        try { kingdom = Engine.findKingdom(fromTown.kingdomId); } catch (e) { /* ignore */ }

        var baseDist = Math.hypot((toTown.x || 0) - (fromTown.x || 0), (toTown.y || 0) - (fromTown.y || 0));
        var baseDays = Math.ceil(baseDist / (CONFIG.CARAVAN_BASE_SPEED * 1.5 * 24));
        if (baseDays < 1) baseDays = 1;

        // Kingdom Transport (if law active)
        if (kingdom && kingdom.laws && kingdom.laws.kingdomTransport) {
            var rate = kingdom.laws.transportRate || (CONFIG.KINGDOM_TRANSPORT ? CONFIG.KINGDOM_TRANSPORT.defaultRate : 15);
            var kDays = Math.ceil(baseDays * 0.6);
            services.push({
                icon: '👑',
                name: 'Kingdom Transport (' + rate + 'g)',
                desc: 'Official ' + (kingdom.name || 'Kingdom') + ' transport service.' + (type === 'sea' ? ' Royal vessel.' : ' Horse-drawn carriage.'),
                price: rate,
                days: Math.max(1, kDays),
                type: 'kingdom',
                kingdomId: kingdom.id
            });
        }

        // NPC Transport (based on town tier)
        var tier = fromTown.tier || 'town';
        if (tier !== 'village') {
            // Standard horse carriage (land only)
            if (type === 'land') {
                var carriagePrice = Math.round(10 + baseDays * 5);
                services.push({
                    icon: '🏇',
                    name: 'Horse Carriage (' + carriagePrice + 'g)',
                    desc: 'Hired transport by horse. Comfortable and faster than walking.',
                    price: carriagePrice,
                    days: Math.max(1, Math.ceil(baseDays * 0.55)),
                    type: 'npc_carriage'
                });
            }

            // Luxury wagon (cities and capitals, land only)
            if (type === 'land' && (tier === 'city' || tier === 'capital')) {
                var luxPrice = Math.round(25 + baseDays * 12);
                services.push({
                    icon: '🎪',
                    name: 'Luxury Wagon (' + luxPrice + 'g)',
                    desc: 'Padded wagon with canopy. Very comfortable, restores energy during travel.',
                    price: luxPrice,
                    days: Math.max(1, Math.ceil(baseDays * 0.5)),
                    type: 'npc_luxury',
                    restBonus: true
                });
            }

            // Merchant vessel (sea, at ports)
            if (type === 'sea' && fromTown.isPort) {
                var vesselPrice = Math.round(30 + baseDays * 8);
                services.push({
                    icon: '⛴️',
                    name: 'Merchant Vessel (' + vesselPrice + 'g)',
                    desc: 'Book passage on a merchant ship. Safer than solo sailing.',
                    price: vesselPrice,
                    days: Math.max(1, Math.ceil(baseDays * 0.7)),
                    type: 'npc_vessel'
                });
            }
        }

        return services;
    }

    // Store state for travel options dialog
    var _travelOptions = [];
    var _travelDestTownId = null;

    /** Closed borders dialog — offers military service or smuggling */
    function _showClosedBordersDialog(destTown, destKingdom, townId) {
        var hasSmugglersRun = Player.hasSkill && Player.hasSkill('smugglers_run');

        // Check if kingdom is at war (required for military enlistment)
        var atWar = false;
        try {
            var wars = Engine.getActiveWars ? Engine.getActiveWars() : {};
            for (var wId in wars) {
                var w = wars[wId];
                if (w.kingdomA === destKingdom.id || w.kingdomB === destKingdom.id) { atWar = true; break; }
            }
        } catch (e) { /* ignore */ }

        var html = '<div style="text-align:center;padding:10px;">';
        html += '<div style="font-size:2em;margin-bottom:8px;">🚫</div>';
        html += '<h3 style="color:#e74c3c;margin:0 0 8px;">Borders Closed</h3>';
        html += '<p style="margin:0 0 12px;color:#ddd;">The Kingdom of <strong>' + destKingdom.name + '</strong> has closed its borders to foreigners. You cannot enter ' + destTown.name + '.</p>';
        html += '<hr style="border-color:#555;margin:12px 0;">';

        // Option 1: Military Service (only if at war)
        if (atWar) {
            html += '<div style="background:#2a3a2a;border:1px solid #4a6a4a;border-radius:6px;padding:10px;margin-bottom:10px;text-align:left;">';
            html += '<div style="font-size:1.1em;font-weight:bold;color:#7cb342;">⚔️ Serve in Their Military</div>';
            html += '<p style="font-size:0.85em;color:#aaa;margin:4px 0 8px;">' + destKingdom.name + ' is at war and accepting foreign recruits. Serve until you reach the rank of <strong style="color:#f0c040;">Knight</strong> to earn citizenship. You cannot leave the military before then.</p>';
            html += '<button class="btn-medieval" style="width:100%;" onclick="UI._enlistForCitizenship(\'' + destKingdom.id + '\',\'' + townId + '\')">⚔️ Enlist for Citizenship</button>';
            html += '</div>';
        } else {
            html += '<div style="background:#3a3a2a;border:1px solid #6a6a4a;border-radius:6px;padding:10px;margin-bottom:10px;text-align:left;opacity:0.6;">';
            html += '<div style="font-size:1.1em;font-weight:bold;color:#888;">⚔️ Military Service (Unavailable)</div>';
            html += '<p style="font-size:0.85em;color:#777;margin:4px 0 0;">' + destKingdom.name + ' is not at war. They are not accepting foreign recruits. Wait for a war to break out.</p>';
            html += '</div>';
        }

        // Option 2: Smuggle across (requires Smuggler's Run skill)
        if (hasSmugglersRun) {
            html += '<div style="background:#3a2a2a;border:1px solid #6a4a4a;border-radius:6px;padding:10px;margin-bottom:10px;text-align:left;">';
            html += '<div style="font-size:1.1em;font-weight:bold;color:#e57373;">🏃 Sneak Across the Border</div>';
            html += '<p style="font-size:0.85em;color:#aaa;margin:4px 0 8px;">Use your <strong>Smuggler\'s Run</strong> skill to slip past border guards. If caught: <strong style="color:#e74c3c;">20 days jail + 25% gold fine</strong>.</p>';
            html += '<button class="btn-medieval" style="width:100%;background:#5a2a2a;" onclick="UI._smuggleBorder(\'' + townId + '\')">🏃 Attempt Border Crossing</button>';
            html += '</div>';
        } else {
            html += '<div style="background:#3a2a2a;border:1px solid #6a4a4a;border-radius:6px;padding:10px;margin-bottom:10px;text-align:left;opacity:0.6;">';
            html += '<div style="font-size:1.1em;font-weight:bold;color:#888;">🏃 Sneak Across (Unavailable)</div>';
            html += '<p style="font-size:0.85em;color:#777;margin:4px 0 0;">Requires the <strong>Smuggler\'s Run</strong> skill to attempt illegal border crossing.</p>';
            html += '</div>';
        }

        // Option 3: Petition from here (if at border town of same kingdom neighbor)
        html += '<div style="background:#2a2a3a;border:1px solid #4a4a6a;border-radius:6px;padding:10px;margin-bottom:10px;text-align:left;">';
        html += '<div style="font-size:1.1em;font-weight:bold;color:#64b5f6;">📜 Other Options</div>';
        html += '<p style="font-size:0.85em;color:#aaa;margin:4px 0 0;">Build reputation through trade with their merchants at other towns. Earn citizenship through military service during wartime. Or learn the Smuggler\'s Run skill from the Underworld skill tree.</p>';
        html += '</div>';

        html += '<button class="btn-medieval" style="width:100%;margin-top:8px;" onclick="UI.closeModal()">← Go Back</button>';
        html += '</div>';

        openModal('🚫 Closed Borders — ' + destKingdom.name, html);
    }

    /** Enlist in a foreign kingdom's military for citizenship */
    function _enlistForCitizenship(kingdomId, townId) {
        closeModal();
        var result = Player.enlistAsSoldier(kingdomId);
        if (result && result.success) {
            // Set mandatory service flag — cannot quit until Knight
            if (Player.state) {
                Player.state.militaryMandatory = true;
                Player.state.militaryBorderService = true;
            }
            toast('⚔️ Enlisted in ' + (Engine.findKingdom(kingdomId) || {}).name + '\'s military! Serve until Knight rank to earn citizenship.', 'success', 'military');
        } else {
            toast((result && result.message) || 'Cannot enlist.', 'danger');
        }
    }

    /** Attempt to smuggle across a closed border */
    function _smuggleBorder(townId) {
        closeModal();
        var result = Player.travelTo(townId);
        if (result && result.success) {
            toast('🏃 Slipped across the border undetected!', 'success');
        } else {
            toast((result && result.message) || 'Border crossing failed.', 'danger');
        }
    }

    // ── Forced Requisition Dialog ──
    function showRequisitionDialog(kingdom, targetRes, resName, seizeQty, seizeValue) {
        var bribeCost = Math.max(20, Math.floor(seizeValue * 0.4));
        var html = '<div style="text-align:center;margin-bottom:12px;">';
        html += '<div style="font-size:1.2rem;margin-bottom:8px;">⚠️ Guards Demand Your Goods!</div>';
        html += '<div style="font-size:0.8rem;color:#ccc;margin-bottom:12px;">Under <strong>Forced Requisition</strong> law in ' + kingdom.name + ', guards are seizing merchant goods for the crown.</div>';
        html += '<div style="background:rgba(180,60,60,0.2);padding:8px;border-radius:6px;margin-bottom:12px;">';
        html += '<strong>Demand:</strong> ' + seizeQty + 'x ' + resName + ' (worth ~' + seizeValue + 'g)';
        html += '</div>';
        html += '</div>';

        // Options
        html += '<div style="display:flex;flex-direction:column;gap:8px;">';
        // Comply
        html += '<button class="btn-medieval" onclick="Player.executeRequisition(\'' + targetRes + '\',' + seizeQty + '); UI.closeModal(); UI.toast(\'⚠️ Guards seized ' + seizeQty + ' ' + resName + '.\', \'danger\');" style="padding:8px;">';
        html += '😔 Comply (' + seizeQty + ' ' + resName + ' seized)</button>';
        // Bribe
        html += '<button class="btn-medieval" onclick="var r = Player.bribeRequisitionGuard(' + bribeCost + '); UI.closeModal(); if(!r.success){ Player.executeRequisition(\'' + targetRes + '\',' + seizeQty + '); }" style="padding:8px;">';
        html += '💰 Bribe the Guards (' + bribeCost + 'g)</button>';
        // Resist (if player has combat skills)
        if (Player.hasSkill && (Player.hasSkill('combat_training') || Player.hasSkill('veteran_fighter'))) {
            html += '<button class="btn-medieval" onclick="UI._resistRequisition(\'' + targetRes + '\',' + seizeQty + ',\'' + kingdom.id + '\');" style="padding:8px;border-color:#c44;">';
            html += '⚔️ Resist (Combat — risky!)</button>';
        }
        html += '</div>';

        openModal('⚠️ Forced Requisition', html);
    }

    function _resistRequisition(targetRes, seizeQty, kingdomId) {
        closeModal();
        var rng = Engine.getRng ? Engine.getRng() : null;
        var combatSkill = (Player.hasSkill && Player.hasSkill('veteran_fighter')) ? 0.6 : 0.35;
        if (rng && rng.chance(combatSkill)) {
            toast('⚔️ You fought off the guards! But your notoriety increased.', 'success');
            if (Player.state) Player.state.notoriety = Math.min(100, (Player.state.notoriety || 0) + 25);
            var kingdom = Engine.findKingdom(kingdomId);
            if (kingdom && Player.state.reputation) {
                Player.state.reputation[kingdomId] = Math.max(0, (Player.state.reputation[kingdomId] || 50) - 20);
            }
            Engine.logEvent(Player.state.fullName + ' resisted forced requisition by force!');
        } else {
            toast('⚔️ You tried to resist but were overpowered! Goods seized + fined.', 'danger');
            Player.executeRequisition(targetRes, seizeQty);
            if (Player.state) Player.state.notoriety = Math.min(100, (Player.state.notoriety || 0) + 30);
            var fineAmt = Math.floor(seizeQty * 10);
            Player.state.gold = Math.max(0, (Player.state.gold || 0) - fineAmt);
            var kingdom2 = Engine.findKingdom(kingdomId);
            if (kingdom2 && Player.state.reputation) {
                Player.state.reputation[kingdomId] = Math.max(0, (Player.state.reputation[kingdomId] || 50) - 25);
            }
            Engine.logEvent(Player.state.fullName + ' tried to resist requisition but was captured! Fined ' + fineAmt + 'g.');
        }
    }

    // ── Exclusive Citizenship Dialog ──
    function showExclusiveCitizenshipDialog(enforcingKingdom, citizenKingdoms) {
        var html = '<div style="text-align:center;margin-bottom:12px;">';
        html += '<div style="font-size:1.2rem;margin-bottom:8px;">🛡️ Exclusive Citizenship Enforced!</div>';
        html += '<div style="font-size:0.8rem;color:#ccc;margin-bottom:12px;"><strong>' + enforcingKingdom.name + '</strong> has enacted the <em>Exclusive Citizenship</em> law. You cannot hold citizenship in multiple kingdoms.</div>';
        html += '<div style="font-size:0.78rem;color:#e8c170;margin-bottom:12px;">You must choose which kingdom to remain a citizen of. You will lose your rank and reputation (-15) in all others.</div>';
        html += '</div>';

        html += '<div style="display:flex;flex-direction:column;gap:8px;">';
        for (var i = 0; i < citizenKingdoms.length; i++) {
            var kId = citizenKingdoms[i];
            var k = Engine.findKingdom(kId);
            if (!k) continue;
            var rankIdx = (Player.state.socialRank[kId] || 0);
            var rankName = CONFIG.SOCIAL_RANKS[rankIdx] ? CONFIG.SOCIAL_RANKS[rankIdx].name : 'Citizen';
            var rep = Math.floor(Player.state.reputation[kId] || 0);
            var isPrimary = kId === Player.state.citizenshipKingdomId;
            html += '<button class="btn-medieval" onclick="UI._chooseExclusiveCitizenship(\'' + kId + '\',' + JSON.stringify(citizenKingdoms) + ');" style="padding:8px;' + (isPrimary ? 'border-color:#d4af37;' : '') + '">';
            html += '👑 Keep <strong>' + k.name + '</strong> — ' + rankName + ' (Rep: ' + rep + ')';
            if (isPrimary) html += ' ★';
            html += '</button>';
        }
        html += '</div>';

        openModal('🛡️ Choose Your Allegiance', html);
    }

    function _chooseExclusiveCitizenship(keepKingdomId, allKingdoms) {
        closeModal();
        var kept = Engine.findKingdom(keepKingdomId);
        for (var i = 0; i < allKingdoms.length; i++) {
            if (allKingdoms[i] !== keepKingdomId) {
                Player.forceRenounceCitizenship(allKingdoms[i]);
            }
        }
        Player.state.citizenshipKingdomId = keepKingdomId;
        toast('🛡️ You pledged exclusive allegiance to ' + (kept ? kept.name : 'your kingdom') + '.', 'success');
    }

    // ========================================================
    // HORSE PERMIT VIOLATION DIALOG
    // ========================================================
    function showHorsePermitViolationDialog(kingdom) {
        var cfg = CONFIG.DRAFT_ANIMAL_LAW || {};
        var fine = cfg.confiscationFine || 500;
        var jailDays = cfg.jailDays || 30;
        var canPay = Player.gold >= fine;

        var html = '<div style="text-align:center;">';
        html += '<p style="font-size:1.1em;color:#c44;">🐴⚠️ <strong>Horse Permit Violation!</strong></p>';
        html += '<p>Guards in <strong>' + kingdom.name + '</strong> have stopped you and discovered you own horses without a valid permit under the <strong>Draft Animal Law</strong>.</p>';
        html += '<p>The fine is <strong style="color:gold;">' + fine + ' gold</strong>.</p>';
        if (!canPay) {
            html += '<p style="color:#c88;">You only have <strong>' + Math.floor(Player.gold) + ' gold</strong> — not enough to pay.</p>';
        }
        html += '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">';
        if (canPay) {
            html += '<button class="btn-medieval" onclick="Player.payHorsePermitFine(); UI.closeModal();" style="background:linear-gradient(135deg,#3a5a1a,#4a7a2a);">💰 Pay Fine (' + fine + 'g)</button>';
        }
        html += '<button class="btn-medieval" onclick="Player.refuseHorsePermitFine(); UI.closeModal();" style="background:linear-gradient(135deg,#5a1a1a,#7a2a2a);">🔒 ' + (canPay ? 'Refuse to Pay' : 'Accept Jail') + ' (' + jailDays + ' days)</button>';
        html += '</div>';
        html += '<p style="font-size:0.8em;color:#888;margin-top:10px;">💡 Tip: Buy a permit from the Character panel, or rank up to Burgher to be exempt.</p>';
        html += '</div>';
        showModal('🐴 Draft Animal Violation', html);
    }

    function openTravelOptions(townId) {
        var destTown = Engine.findTown(townId);
        if (!destTown) return;
        var currentTown = Engine.findTown(Player.townId);
        if (!currentTown) return;
        if (Player.townId === townId) { toast('You are already here.', 'info'); return; }
        if (Player.traveling) { toast('You are already traveling.', 'warning'); return; }

        // ===== CLOSED BORDERS CHECK =====
        var destKingdom = null;
        var kingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
        for (var ki = 0; ki < kingdoms.length; ki++) {
            if (kingdoms[ki].id === destTown.kingdomId) { destKingdom = kingdoms[ki]; break; }
        }
        if (destKingdom && !Player.isPlayerCitizenOf(destKingdom.id)) {
            var hasClosed = false;
            // Check all law storage formats
            if (destKingdom.immigrationPolicy === 'closed') hasClosed = true;
            if (Engine.hasSpecialLaw && Engine.hasSpecialLaw(destKingdom, 'closed_borders')) hasClosed = true;
            if (destKingdom.laws) {
                if (Array.isArray(destKingdom.laws)) {
                    for (var li = 0; li < destKingdom.laws.length; li++) {
                        var law = destKingdom.laws[li];
                        if (law.type === 'closed_borders' || law.type === 'foreign_ban' ||
                            (law.type === 'immigration' && law.policy === 'citizens_only')) hasClosed = true;
                    }
                }
                if (destKingdom.laws.specialLaws) {
                    for (var si = 0; si < destKingdom.laws.specialLaws.length; si++) {
                        if (destKingdom.laws.specialLaws[si].id === 'closed_borders') hasClosed = true;
                    }
                }
            }

            if (hasClosed) {
                _showClosedBordersDialog(destTown, destKingdom, townId);
                return;
            }
        }

        var options = [];

        // Calculate land route info
        var landRoute = null;
        try { landRoute = Engine.findPath(Player.townId, townId); } catch (e) { /* ignore */ }

        // Calculate sea route info
        var canSea = false;
        try { canSea = Player.canTravelBySea(townId); } catch (e) { /* ignore */ }

        var hasHorse = Player.horses && Player.horses.length > 0;
        var hasSaddle = Player.inventory && (Player.inventory.saddles || 0) > 0;
        var hasShip = Player.ships && Player.ships.length > 0;
        var playerGold = Player.gold || 0;

        // ===== LAND OPTIONS =====
        if (landRoute && landRoute.length > 0) {
            var baseDist = calculateRouteDist(landRoute);
            var baseSpeed = CONFIG.CARAVAN_BASE_SPEED * 1.5;
            if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('road_knowledge')) baseSpeed *= 1.15;
            if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('cartographer')) baseSpeed *= 1.05;

            // Option: Walk
            var walkDays = Math.max(1, Math.ceil(baseDist / (baseSpeed * 24)));
            options.push({
                id: 'walk',
                icon: '🚶',
                name: 'Walk',
                desc: 'Travel on foot. Slow but free.',
                cost: 0,
                days: walkDays,
                available: true,
                action: function () { Player.travelTo(townId); }
            });

            // Option: Ride Horse (if player has horse)
            if (hasHorse) {
                var horseSpeed = baseSpeed * (1 + (CONFIG.HORSE_TRAVEL_SPEED_BONUS || 0.3));
                if (hasSaddle) horseSpeed *= CONFIG.SADDLE_BONUS_MULTIPLIER || 2;
                var horseDays = Math.max(1, Math.ceil(baseDist / (horseSpeed * 24)));
                options.push({
                    id: 'ride_horse',
                    icon: '🐴',
                    name: 'Ride Your Horse',
                    desc: 'Much faster travel. Less tiring.',
                    cost: 0,
                    days: horseDays,
                    available: true,
                    action: function () { Player.travelTo(townId, { mode: 'horse' }); }
                });
            }

            // Option: Buy a horse and ride (if not already owned)
            if (!hasHorse) {
                var horseCost = 80;
                try {
                    var horsePrice = currentTown.market && currentTown.market.prices && currentTown.market.prices.horses ? currentTown.market.prices.horses : 80;
                    horseCost = Math.ceil(horsePrice);
                } catch (e) { /* ignore */ }
                var horseLegal = true;
                try {
                    var hKingdom = Engine.findKingdom(currentTown.kingdomId);
                    if (hKingdom && hKingdom.laws && hKingdom.laws.bannedGoods && hKingdom.laws.bannedGoods.indexOf('horses') !== -1) {
                        horseLegal = Player.licenses && Player.licenses[currentTown.kingdomId] && Player.licenses[currentTown.kingdomId].indexOf('horses') !== -1;
                    }
                } catch (e) { /* ignore */ }
                var canAffordHorse = playerGold >= horseCost;
                var horseAvailable = currentTown.market && currentTown.market.supply && (currentTown.market.supply.horses || 0) > 0;

                if (horseLegal && horseAvailable) {
                    var buyHorseSpeed = baseSpeed * (1 + (CONFIG.HORSE_TRAVEL_SPEED_BONUS || 0.3));
                    var buyHorseDays = Math.max(1, Math.ceil(baseDist / (buyHorseSpeed * 24)));
                    options.push({
                        id: 'buy_horse',
                        icon: '🐴💰',
                        name: 'Buy Horse & Ride (' + horseCost + 'g)',
                        desc: 'Purchase a horse first, then ride. You keep the horse after.',
                        cost: horseCost,
                        days: buyHorseDays,
                        available: canAffordHorse,
                        unavailableReason: !canAffordHorse ? 'Not enough gold' : '',
                        action: (function (hCost) { return function () { Player.buyHorseForTravel(townId, hCost); }; })(horseCost)
                    });
                }
            }

            // Land transport services
            var transportAvailable = getTransportServices(currentTown, destTown, 'land');
            for (var ti = 0; ti < transportAvailable.length; ti++) {
                var svc = transportAvailable[ti];
                options.push({
                    id: 'transport_land_' + ti,
                    icon: svc.icon || '🏇',
                    name: svc.name,
                    desc: svc.desc,
                    cost: svc.price,
                    days: svc.days,
                    available: playerGold >= svc.price,
                    unavailableReason: playerGold < svc.price ? 'Not enough gold' : '',
                    action: (function (service) { return function () { Player.useTransportService(townId, service); }; })(svc)
                });
            }
        }

        // ===== SEA OPTIONS =====
        if (canSea) {
            var seaDist = 500;
            try {
                var seaRoutes = Engine.getSeaRoutes();
                var sr = null;
                for (var sri = 0; sri < seaRoutes.length; sri++) {
                    var r = seaRoutes[sri];
                    if ((r.fromTownId === Player.townId && r.toTownId === townId) || (r.toTownId === Player.townId && r.fromTownId === townId)) {
                        sr = r;
                        break;
                    }
                }
                if (sr) seaDist = sr.distance || 500;
            } catch (e) { /* ignore */ }

            // Option: Sail own ship
            if (hasShip) {
                var shipSpeed = CONFIG.CARAVAN_BASE_SPEED * 1.5 * (CONFIG.SEA_SPEED_MULTIPLIER || 1.5);
                if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('expert_navigator')) shipSpeed *= 1.2;
                var sailDays = Math.max(1, Math.ceil(seaDist / (shipSpeed * 24)));
                options.push({
                    id: 'sail_own',
                    icon: '⛵',
                    name: 'Sail Your Ship',
                    desc: 'Use your own vessel. Risk of pirates and storms.',
                    cost: 0,
                    days: sailDays,
                    available: true,
                    action: function () { Player.travelBySea(townId); }
                });
            }

            // Option: Pay for sea passage
            var passageCost = CONFIG.SEA_PASSAGE_COST || 50;
            var passageSpeed = CONFIG.CARAVAN_BASE_SPEED * 1.5 * (CONFIG.SEA_SPEED_MULTIPLIER || 1.5) * 0.8;
            var passageDays = Math.max(1, Math.ceil(seaDist / (passageSpeed * 24)));
            options.push({
                id: 'sea_passage',
                icon: '🚢',
                name: 'Book Passage (' + passageCost + 'g)',
                desc: 'Pay for passage on a merchant vessel. Safer than solo.',
                cost: passageCost,
                days: passageDays,
                available: playerGold >= passageCost,
                unavailableReason: playerGold < passageCost ? 'Not enough gold' : '',
                action: function () { Player.travelBySea(townId, { paid: true }); }
            });

            // Sea transport services
            var seaTransport = getTransportServices(currentTown, destTown, 'sea');
            for (var sti = 0; sti < seaTransport.length; sti++) {
                var ssvc = seaTransport[sti];
                options.push({
                    id: 'transport_sea_' + sti,
                    icon: ssvc.icon || '🚢',
                    name: ssvc.name,
                    desc: ssvc.desc,
                    cost: ssvc.price,
                    days: ssvc.days,
                    available: playerGold >= ssvc.price,
                    unavailableReason: playerGold < ssvc.price ? 'Not enough gold' : '',
                    action: (function (service) { return function () { Player.useTransportService(townId, service); }; })(ssvc)
                });
            }
        }

        // ===== BUILD THE MODAL =====
        if (options.length === 0) {
            toast('No travel route available to ' + destTown.name + '.', 'warning');
            return;
        }

        var html = '<div style="max-height:450px;overflow-y:auto;">';
        html += '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px;">\u{1F4CD} ' + (currentTown.name || '?') + ' \u2192 ' + (destTown.name || '?') + '</p>';

        for (var oi = 0; oi < options.length; oi++) {
            var opt = options[oi];
            var isAvail = opt.available;
            var opacity = isAvail ? '1' : '0.4';

            html += '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:10px;margin-bottom:8px;opacity:' + opacity + ';">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<div>';
            html += '<span style="font-size:1.1rem;">' + opt.icon + '</span> ';
            html += '<strong>' + opt.name + '</strong>';
            html += '<br><span style="font-size:0.8rem;color:var(--text-muted);">' + opt.desc + '</span>';
            html += '</div>';
            html += '<div style="text-align:right;">';
            html += '<div style="font-size:0.9rem;color:var(--gold);">\u23F1\uFE0F ~' + opt.days + ' day' + (opt.days !== 1 ? 's' : '') + '</div>';
            if (opt.cost > 0) {
                html += '<div style="font-size:0.85rem;color:#c9a96e;">\u{1F4B0} ' + opt.cost + 'g</div>';
            } else {
                html += '<div style="font-size:0.85rem;color:#8f8;">Free</div>';
            }
            html += '</div>';
            html += '</div>';
            if (isAvail) {
                html += '<button class="btn-medieval" style="width:100%;margin-top:6px;padding:6px;" onclick="UI.confirmTravel(\'' + townId + '\',\'' + opt.id + '\')">Select</button>';
            } else {
                html += '<div style="text-align:center;margin-top:4px;font-size:0.8rem;color:#c44e52;">' + (opt.unavailableReason || 'Unavailable') + '</div>';
            }
            html += '</div>';
        }
        html += '</div>';

        // Store options for confirm handler
        _travelOptions = options;
        _travelDestTownId = townId;

        openModal('\u{1F5FA}\uFE0F Travel to ' + destTown.name, html);
    }

    function confirmTravel(townId, optionId) {
        var options = _travelOptions || [];
        var opt = null;
        for (var i = 0; i < options.length; i++) {
            if (options[i].id === optionId) { opt = options[i]; break; }
        }
        if (opt && opt.available && opt.action) {
            closeModal();
            closeRightPanel();
            opt.action();
            if (typeof Renderer !== 'undefined') {
                var town = Engine.getTown(townId);
                if (town) Renderer.panTo(town.x, town.y);
            }
        }
    }

    function turnBackUI() {
        if (typeof Player === 'undefined' || !Player.turnBack) return;
        var result = Player.turnBack();
        if (result && result.success) {
            toast('🔄 Turning back...', 'info', 'travel_events');
        } else {
            toast((result && result.message) || 'Cannot turn back', 'warning');
        }
    }

    function travelTo(townId) {
        try {
            const result = Player.travelTo(townId);
            if (result && result.success) {
                toast('Traveling by land...', 'info');
            } else {
                toast((result && result.message) || 'Cannot travel', 'danger');
            }
            closeRightPanel();
            if (typeof Renderer !== 'undefined') {
                const town = Engine.getTown(townId);
                if (town) Renderer.panTo(town.x, town.y);
            }
        } catch (e) {
            toast(e.message || 'Cannot travel', 'danger');
        }
    }

    function travelBySeaUI(townId) {
        try {
            const result = Player.travelBySea(townId);
            if (result && result.success) {
                toast(result.message || 'Setting sail...', 'info');
            } else {
                toast((result && result.message) || 'Cannot sail', 'danger');
            }
            closeRightPanel();
            if (typeof Renderer !== 'undefined') {
                const town = Engine.getTown(townId);
                if (town) Renderer.panTo(town.x, town.y);
            }
        } catch (e) {
            toast(e.message || 'Cannot sail', 'danger');
        }
    }

    function forageNearby() {
        try {
            const result = Player.forage();
            toast(result.message, result.success ? 'success' : 'warning');
            if (Player.townId) showTownDetail(Engine.findTown(Player.townId));
        } catch (e) {
            toast(e.message || 'Cannot forage here', 'warning');
        }
    }

    function rebuildBridge(roadIdx) {
        try {
            const result = Player.playerRebuildBridge(roadIdx);
            toast(result.message, result.success ? 'success' : 'warning');
            if (Player.townId) showTownDetail(Engine.findTown(Player.townId));
        } catch (e) {
            toast(e.message || 'Cannot rebuild bridge', 'warning');
        }
    }

    function destroyBridge(roadIdx) {
        if (!confirm('Are you sure? This will make the road impassable!')) return;
        try {
            const result = Player.playerDestroyBridge(roadIdx);
            toast(result.message, result.success ? 'success' : 'warning');
            if (Player.townId) showTownDetail(Engine.findTown(Player.townId));
        } catch (e) {
            toast(e.message || 'Cannot destroy bridge', 'warning');
        }
    }

    function buyShipUI(type) {
        try {
            const result = Player.buyShip(type);
            if (result && result.success) {
                toast(result.message, 'success');
                openCharacterDialog(); // refresh
            } else {
                toast((result && result.message) || 'Cannot buy ship', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Cannot buy ship', 'danger');
        }
    }

    function showShipAddons(shipId) {
        var ship = Player.ships ? Player.ships.find(function(s) { return s.id === shipId; }) : null;
        if (!ship) { toast('Ship not found', 'warning'); return; }
        var addons = CONFIG.SHIP_ADDONS || {};
        var html = '<div style="padding:12px;"><h3>🔧 Install Addon on ' + ship.name + '</h3>';
        html += '<div style="font-size:0.8rem;color:#b0b0b0;margin-bottom:8px;">Slots: ' + (ship.addons ? ship.addons.length : 0) + '/' + (ship.maxAddons || 0) + '</div>';
        for (var addonId in addons) {
            var addon = addons[addonId];
            var alreadyHas = ship.addons && ship.addons.indexOf(addonId) >= 0;
            var matList = [];
            var addonCost = 50;
            for (var mat in (addon.materials || {})) {
                var price = Engine.getResourcePrice ? Engine.getResourcePrice(Player.townId, mat) : 10;
                addonCost += (addon.materials[mat] || 0) * price;
                matList.push(mat + ':' + addon.materials[mat]);
            }
            html += '<div style="border:1px solid var(--border);padding:6px;margin-bottom:4px;border-radius:4px;">';
            html += '<div><strong>' + addon.name + '</strong> - ' + addon.description + '</div>';
            html += '<div style="font-size:0.75rem;color:#888;">Materials: ' + matList.join(', ') + ' | Cost: ' + addonCost + 'g</div>';
            if (alreadyHas) {
                html += '<div style="font-size:0.75rem;color:#55a868;">✅ Installed</div>';
            } else {
                html += '<button class="btn-trade buy" style="font-size:0.7rem;margin-top:2px;" onclick="UI.installShipAddon(\'' + shipId + '\',\'' + addonId + '\')">Install</button>';
            }
            html += '</div>';
        }
        html += '</div>';
        openModal('Ship Addons', html);
    }

    function installShipAddonUI(shipId, addonId) {
        try {
            var result = Player.installShipAddon(shipId, addonId);
            if (result && result.success) {
                toast(result.message, 'success');
                showShipAddons(shipId); // refresh
            } else {
                toast((result && result.message) || 'Cannot install addon', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Cannot install addon', 'danger');
        }
    }

    function clickTown(townId) {
        let town;
        try { town = Engine.getTown(townId); } catch (e) { /* no-op */ }
        if (!town) {
            const towns = Engine.getTowns();
            town = towns ? towns.find(t => t.id === townId) : null;
        }
        if (town) {
            showTownDetail(town);
            if (typeof Renderer !== 'undefined') {
                Renderer.panTo(town.x * CONFIG.TILE_SIZE, town.y * CONFIG.TILE_SIZE);
            }
            closeModal(); // close any modal that spawned this
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  UTILITY
    // ═══════════════════════════════════════════════════════════

    function formatGold(n) {
        if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
        return Math.floor(n).toLocaleString();
    }

    function capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    function formatStrategy(s) {
        if (!s) return '—';
        return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    function findResource(id) {
        for (const key in RESOURCE_TYPES) {
            if (RESOURCE_TYPES[key].id === id) return RESOURCE_TYPES[key];
        }
        return null;
    }

    function findBuildingType(id) {
        for (const key in BUILDING_TYPES) {
            if (BUILDING_TYPES[key].id === id) return BUILDING_TYPES[key];
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════════

    // ── KINGDOMS PAGE ──

    function openKingdomsDialog() {
        let kingdoms;
        try { kingdoms = Engine.getKingdoms(); } catch (e) { kingdoms = []; }
        if (!kingdoms || kingdoms.length === 0) {
            toast('No kingdoms to display.', 'warning');
            return;
        }

        // Kingdom cards
        let cardsHtml = '<div class="kingdom-cards">';
        for (const k of kingdoms) {
            const king = k.king ? Engine.findPerson(k.king) : null;
            const kingName = king ? king.firstName + ' ' + king.lastName : 'Unknown';
            const numTowns = k.territories ? k.territories.length : 0;
            const prosperityPct = Math.max(0, Math.min(100, k.prosperity || 0));
            const wealthLabel = k.gold > 10000 ? '💰 Wealthy' : k.gold > 5000 ? '💰 Moderate' : '💰 Poor';
            const isHome = Player.isPlayerCitizenOf ? Player.isPlayerCitizenOf(k.id) : (k.id === Player.citizenshipKingdomId);
            const rep = Player.reputation[k.id] || 0;
            const rankIdx = Player.socialRank[k.id] || 0;
            const rank = CONFIG.SOCIAL_RANKS[rankIdx] || CONFIG.SOCIAL_RANKS[0];

            // Laws
            let lawsHtml = '';
            if (k.laws) {
                if (k.laws.bannedGoods && k.laws.bannedGoods.length > 0) {
                    const banned = k.laws.bannedGoods.map(g => {
                        const res = Object.values(RESOURCE_TYPES).find(r => r.id === g);
                        return res ? res.icon + ' ' + res.name : g;
                    }).join(', ');
                    lawsHtml += `<div class="law-item">🚫 Banned: ${banned}</div>`;
                }
                lawsHtml += `<div class="law-item">💸 Tariff: ${Math.round((k.laws.tradeTariff || 0) * 100)}%</div>`;
                if (k.laws.conscription) lawsHtml += `<div class="law-item">⚔️ Conscription Active</div>`;
                if (k.laws.guildRestrictions) lawsHtml += `<div class="law-item">🔨 Guild Restrictions</div>`;
            }

            const warList = k.atWar && k.atWar.length > 0 ? k.atWar.map(wId => {
                const wk = kingdoms.find(kk => kk.id === wId);
                return wk ? wk.name : wId;
            }).join(', ') : '';

            // Goods taxes
            let goodsTaxHtml = '';
            if (k.laws && k.laws.goodsTaxes) {
                const taxEntries = Object.entries(k.laws.goodsTaxes);
                if (taxEntries.length > 0) {
                    const taxNames = taxEntries.map(([g, rate]) => {
                        const r = Object.values(RESOURCE_TYPES).find(rr => rr.id === g);
                        return `${r ? r.icon : ''} ${r ? r.name : g} (${Math.round(rate * 100)}%)`;
                    }).join(', ');
                    goodsTaxHtml = `<div class="law-item">💸 Goods Taxes: ${taxNames}</div>`;
                }
            }

            // Restricted goods
            let restrictedHtml = '';
            if (k.laws && k.laws.restrictedGoods && k.laws.restrictedGoods.length > 0) {
                const rNames = k.laws.restrictedGoods.map(g => {
                    const r = Object.values(RESOURCE_TYPES).find(rr => rr.id === g);
                    const hasLic = Player.hasLicense(k.id, g);
                    return `${r ? r.icon : ''} ${r ? r.name : g} ${hasLic ? '✅' : '🔒'}`;
                }).join(', ');
                restrictedHtml = `<div class="law-item">🔒 Restricted: ${rNames}</div>`;
            }

            // Player licenses in this kingdom
            let playerLicHtml = '';
            const myLicenses = Player.licenses[k.id] || [];
            if (myLicenses.length > 0) {
                const licNames = myLicenses.map(g => {
                    const r = Object.values(RESOURCE_TYPES).find(rr => rr.id === g);
                    return r ? r.icon + ' ' + r.name : g;
                }).join(', ');
                playerLicHtml = `<div class="kc-row" style="font-size:0.75rem;color:#55a868;">📜 Your Licenses: ${licNames}</div>`;
            }

            // Guard strength indicator
            let guardIcons = '';
            const kTowns = Engine.getTowns().filter(t => t.kingdomId === k.id);
            const avgSecurity = kTowns.length > 0 ? kTowns.reduce((s, t) => s + (t.security || 0), 0) / kTowns.length : 0;
            const guardLevel = avgSecurity > 70 ? '🛡️🛡️🛡️' : avgSecurity > 40 ? '🛡️🛡️' : avgSecurity > 15 ? '🛡️' : '⚠️';

            cardsHtml += `<div class="kingdom-card ${isHome ? 'kingdom-home' : ''}" style="border-left: 4px solid ${k.color};">
                <div class="kc-header" style="color:${k.color};">${k.name}</div>
                <div class="kc-row">👑 King: ${kingName}</div>
                <div class="kc-row">🏘️ Towns: ${numTowns}</div>
                <div class="kc-row">📊 Prosperity: <span class="mini-bar"><span class="mini-fill" style="width:${prosperityPct}%;background:${k.color};"></span></span></div>
                <div class="kc-row">⚔️ Military: ${k.militaryStrength || 0}</div>
                <div class="kc-row">${wealthLabel}</div>
                <div class="kc-row" style="font-size:0.85rem;font-weight:bold;color:var(--gold);">📜 Tax: ${Math.round((k.taxRate || 0.1) * 100)}%</div>
                <div class="kc-row">Guard Strength: ${guardLevel}</div>
                ${goodsTaxHtml}
                ${restrictedHtml}
                ${lawsHtml ? `<div class="kc-laws">${lawsHtml}</div>` : ''}
                ${playerLicHtml}
                ${warList ? `<div class="kc-row" style="color:var(--danger);">💀 At War: ${warList}</div>` : ''}
                ${isHome ? '<div class="kc-home-badge">★ YOUR HOME</div>' : ''}
                <div class="kc-row">Rep: ${Math.floor(rep)} | Rank: ${rank.icon} ${rank.name}</div>
            </div>`;
        }
        cardsHtml += '</div>';

        // Diplomacy matrix
        let matrixHtml = '<div class="diplo-matrix"><table class="diplo-table"><tr><th></th>';
        for (const k of kingdoms) {
            matrixHtml += `<th style="color:${k.color};">${k.name.slice(0, 4)}</th>`;
        }
        matrixHtml += '</tr>';
        for (const ki of kingdoms) {
            matrixHtml += `<tr><td style="color:${ki.color};">${ki.name.slice(0, 4)}</td>`;
            for (const kj of kingdoms) {
                if (ki.id === kj.id) {
                    matrixHtml += '<td>──</td>';
                } else {
                    const rel = ki.relations[kj.id] || 0;
                    const atWar = ki.atWar && ki.atWar.includes(kj.id);
                    let emoji, cls;
                    if (atWar) { emoji = '💀'; cls = 'diplo-war'; }
                    else if (rel > 60) { emoji = '😊'; cls = 'diplo-ally'; }
                    else if (rel < -30) { emoji = '😡'; cls = 'diplo-hostile'; }
                    else { emoji = '😐'; cls = 'diplo-neutral'; }
                    matrixHtml += `<td class="${cls}" title="${ki.name}→${kj.name}: ${rel}">${emoji}</td>`;
                }
            }
            matrixHtml += '</tr>';
        }
        matrixHtml += '</table></div>';

        // Your Status summary
        const citizenK = Player.citizenshipKingdomId ? kingdoms.find(k => k.id === Player.citizenshipKingdomId) : null;
        const citizenName = citizenK ? citizenK.name : 'Stateless';
        const citizenColor = citizenK ? citizenK.color : '#888';
        const rankIdx = Player.citizenshipKingdomId ? (Player.socialRank[Player.citizenshipKingdomId] || 0) : 0;
        const rank = CONFIG.SOCIAL_RANKS[rankIdx] || CONFIG.SOCIAL_RANKS[0];

        // Count kingdoms where player is citizen
        let citizenCountHtml = '';
        const citizenKingdomsList = [];
        if (Player.socialRank) {
            for (const kId in Player.socialRank) {
                if ((Player.socialRank[kId] || 0) >= 1) {
                    const ck = kingdoms.find(function(x) { return x.id === kId; });
                    citizenKingdomsList.push(ck ? ck.name : kId);
                }
            }
        }
        if (citizenKingdomsList.length > 1) {
            citizenCountHtml = `<div class="detail-row"><span class="label">All Citizenships</span>
                <span class="value">${citizenKingdomsList.join(', ')}</span></div>`;
        }

        let statusHtml = `<div class="your-status">
            <h3>Your Status</h3>
            <div class="detail-row"><span class="label">Primary Kingdom</span>
                <span class="value" style="color:${citizenColor};">${citizenName}</span></div>
            ${citizenCountHtml}
            <div class="detail-row"><span class="label">Rank</span>
                <span class="value">${rank.icon} ${rank.name} (${rankIdx + 1}/7)</span></div>`;

        // Jailed?
        if (Player.jailedUntilDay > 0 && Engine.getDay() < Player.jailedUntilDay) {
            statusHtml += `<div class="detail-row" style="color:var(--danger);"><span class="label">⛓️ Jailed</span>
                <span class="value">Until day ${Player.jailedUntilDay}</span></div>`;
        }
        if (Player.smugglingSkill > 0) {
            statusHtml += `<div class="detail-row"><span class="label">🗡️ Smuggling Skill</span>
                <span class="value">${Player.smugglingSkill}</span></div>`;
        }
        statusHtml += '</div>';

        const html = cardsHtml + matrixHtml + statusHtml;
        openModal('👑 Kingdoms of the Realm', html);
    }

    // ── SOCIAL STATUS PAGE (in character dialog) ──

    function buildSocialStatusHtml() {
        const citizenKId = Player.citizenshipKingdomId;
        let kingdoms;
        try { kingdoms = Engine.getKingdoms(); } catch (e) { kingdoms = []; }
        const citizenK = citizenKId ? kingdoms.find(k => k.id === citizenKId) : null;
        const citizenName = citizenK ? citizenK.name : 'Stateless';
        const citizenColor = citizenK ? citizenK.color : '#888';
        const rankIdx = citizenKId ? (Player.socialRank[citizenKId] || 0) : 0;
        const rank = CONFIG.SOCIAL_RANKS[rankIdx] || CONFIG.SOCIAL_RANKS[0];

        let html = `<div class="detail-section">
            <h3>\uD83C\uDFDB\uFE0F Social Status</h3>
            <div class="detail-row"><span class="label">Primary Kingdom</span>
                <span class="value" style="color:${citizenColor};">${citizenName}</span></div>
            <div class="detail-row"><span class="label">Primary Rank</span>
                <span class="value">${rank.icon} ${rank.name}</span></div>
        </div>`;

        // All kingdoms where player holds rank
        const citizenKingdoms = [];
        if (Player.socialRank) {
            for (const kId in Player.socialRank) {
                if ((Player.socialRank[kId] || 0) >= 1) {
                    const k = kingdoms.find(function(x) { return x.id === kId; });
                    citizenKingdoms.push({ id: kId, name: k ? k.name : kId, color: k ? k.color : '#888', rankIdx: Player.socialRank[kId] });
                }
            }
        }
        if (citizenKingdoms.length > 0) {
            html += '<div class="detail-section"><h3>\uD83C\uDFE0 Citizenships</h3>';
            for (const ck of citizenKingdoms) {
                const r = CONFIG.SOCIAL_RANKS[ck.rankIdx] || CONFIG.SOCIAL_RANKS[0];
                html += `<div class="detail-row" style="margin-bottom:4px;">
                    <span class="label" style="color:${ck.color};">${ck.name}</span>
                    <span class="value">${r.icon} ${r.name}
                        <button class="btn-medieval" onclick="UI.showRankProgressionPanel('${ck.id}')" style="font-size:0.7rem;padding:2px 8px;margin-left:6px;">Details</button>
                        <button class="btn-medieval" onclick="UI.renounceKingdomUI('${ck.id}')" style="font-size:0.7rem;padding:2px 8px;margin-left:4px;background:rgba(200,50,50,0.15);border-color:rgba(200,50,50,0.4);">\u274C Renounce</button>
                    </span>
                </div>`;
            }
            html += '</div>';
        }

        // Rank ladder for primary kingdom
        html += '<div class="detail-section"><h3>\uD83D\uDCCA Rank Ladder</h3><div class="rank-ladder">';
        for (let i = 0; i < CONFIG.SOCIAL_RANKS.length; i++) {
            const r = CONFIG.SOCIAL_RANKS[i];
            const isCurrent = i === rankIdx;
            const isAchieved = i <= rankIdx;
            html += `<div class="rank-step ${isCurrent ? 'rank-current' : ''} ${isAchieved ? 'rank-achieved' : 'rank-locked'}">
                <span class="rank-icon">${r.icon}</span>
                <span class="rank-name">${r.name}</span>
                <span class="rank-perks">\uD83D\uDC65${r.maxWorkers > 999 ? '\u221E' : r.maxWorkers} \uD83C\uDFE0${r.maxBuildings > 999 ? '\u221E' : r.maxBuildings}</span>
                ${!isAchieved ? `<span class="rank-req">${r.goldReq.toLocaleString()}g, ${r.repReq}rep</span>` : ''}
            </div>`;
        }
        html += '</div></div>';

        // Next rank progress
        if (citizenKId && rankIdx < CONFIG.SOCIAL_RANKS.length - 1) {
            const nextRank = CONFIG.SOCIAL_RANKS[rankIdx + 1];
            const goldEarned = (Player.goldEarnedInKingdom && Player.goldEarnedInKingdom[citizenKId]) || 0;
            const rep = (Player.reputation && Player.reputation[citizenKId]) || 0;
            const goldPct = nextRank.goldReq > 0 ? Math.min(100, Math.floor((goldEarned / nextRank.goldReq) * 100)) : 100;
            const repPct = nextRank.repReq > 0 ? Math.min(100, Math.floor((rep / nextRank.repReq) * 100)) : 100;

            // Check detailed requirements
            let reqChecklist = '';
            if (Player.canPetitionForPromotion) {
                const check = Player.canPetitionForPromotion(citizenKId);
                if (check.reasons && check.reasons.length > 0) {
                    reqChecklist = '<div style="margin-top:8px;font-size:0.8rem;">';
                    for (const r of check.reasons) {
                        reqChecklist += `<div style="color:#ff8866;">\u274C ${r}</div>`;
                    }
                    reqChecklist += '</div>';
                } else if (check.can) {
                    reqChecklist = '<div style="margin-top:8px;font-size:0.8rem;color:#66ff88;">\u2705 All requirements met!</div>';
                }
            }

            html += `<div class="detail-section"><h3>Next: ${nextRank.icon} ${nextRank.name}</h3>
                <div class="progress-row"><span class="label">Gold Earned</span>
                    <div class="progress-bar"><div class="progress-fill" style="width:${goldPct}%"></div></div>
                    <span class="value">${Math.floor(goldEarned).toLocaleString()}/${nextRank.goldReq.toLocaleString()}</span></div>
                <div class="progress-row"><span class="label">Reputation</span>
                    <div class="progress-bar"><div class="progress-fill" style="width:${repPct}%"></div></div>
                    <span class="value">${Math.floor(rep)}/${nextRank.repReq}</span></div>
                ${nextRank.fee ? `<div class="detail-row"><span class="label">Fee</span><span class="value">${nextRank.fee.toLocaleString()}g</span></div>` : ''}
                ${nextRank.extraReq ? `<div class="detail-row"><span class="label">Requirements</span><span class="value" style="font-size:0.8rem;">${nextRank.extraReq}</span></div>` : ''}
                ${reqChecklist}
                <button class="btn-medieval" onclick="UI.petitionPromotion()" style="margin-top:8px;font-size:0.85rem;padding:6px 16px;">\uD83D\uDCDC Petition for Promotion</button>
            </div>`;
        }

        // Change citizenship button (if in foreign town where player is not citizen)
        let currentTown;
        try { currentTown = Engine.findTown(Player.townId); } catch (e) { /* no-op */ }
        if (currentTown && Player.isPlayerCitizenOf && !Player.isPlayerCitizenOf(currentTown.kingdomId)) {
            const foreignK = kingdoms.find(k => k.id === currentTown.kingdomId);
            const foreignName = foreignK ? foreignK.name : 'Unknown';
            html += `<div class="detail-section">
                <button class="btn-medieval" onclick="UI.changeCitizenship('${currentTown.kingdomId}')" style="font-size:0.85rem;padding:6px 16px;">\uD83C\uDFDB\uFE0F Petition for ${foreignName} Citizenship</button>
            </div>`;
        }

        return html;
    }

    function petitionPromotion() {
        try {
            const result = Player.petitionForPromotion();
            if (result && result.success) {
                toast(result.message, 'success');
                openCharacterDialog();
            } else {
                toast((result && result.message) || 'Cannot promote', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Promotion failed', 'danger');
        }
    }

    function changeCitizenship(kingdomId) {
        try {
            const result = Player.petitionCitizenship(kingdomId);
            if (result && result.success) {
                toast(result.message, 'success');
                openCharacterDialog();
            } else {
                toast((result && result.message) || 'Cannot change citizenship', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Citizenship change failed', 'danger');
        }
    }

    // ── GIFT GIVING ──

    function openGiftDialog(personId) {
        const person = Engine.findPerson(personId);
        if (!person) { toast('Person not found.', 'warning'); return; }

        const rel = Player.getRelationship(personId);
        const relLabel = Player.getRelationshipLabel(rel.level);

        let itemsHtml = '';
        for (const [resId, qty] of Object.entries(Player.inventory || {})) {
            if (qty <= 0) continue;
            const res = Object.values(RESOURCE_TYPES).find(r => r.id === resId);
            if (!res) continue;
            itemsHtml += `<div class="trade-item">
                <div class="res-info">${res.icon} ${res.name} (${qty})</div>
                <div class="trade-controls">
                    <button class="btn-trade buy" onclick="UI.executeGift('${personId}','${resId}',1)">Gift 1</button>
                </div>
            </div>`;
        }
        if (!itemsHtml) itemsHtml = '<div class="text-dim text-center">No items to give</div>';

        const html = `<div class="detail-section">
            <h3>🎁 Gift to ${person.firstName} ${person.lastName}</h3>
            <div class="detail-row"><span class="label">Relationship</span>
                <span class="value">${relLabel.icon} ${relLabel.name} (${Math.floor(rel.level)})</span></div>
            <div class="detail-row"><span class="label">Type</span>
                <span class="value">${rel.type}</span></div>
        </div>
        <div class="detail-section">${itemsHtml}</div>`;

        openModal(`🎁 Gift — ${person.firstName}`, html);
    }

    function executeGift(personId, resourceId, qty) {
        try {
            const result = Player.giveGift(personId, resourceId, qty);
            if (result && result.success) {
                toast(result.message, 'success');
                openGiftDialog(personId);
            } else {
                toast((result && result.message) || 'Cannot give gift', 'warning');
            }
        } catch (e) {
            toast(e.message || 'Gift failed', 'danger');
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  XP BAR UPDATE
    // ═══════════════════════════════════════════════════════════
    function updateXPBar() {
        if (typeof Player === 'undefined') return;
        const xpFill = document.getElementById('xpBarFill');
        const xpLabel = document.getElementById('xpBarLabel');
        const xpDetail = document.getElementById('xpBarDetail');
        if (!xpFill || !xpLabel) return;

        const totalXp = Player.totalXp || 0;
        const level = Player.level || 1;
        const currentLevelXp = Player.getCurrentLevelXP ? Player.getCurrentLevelXP() : 0;
        const nextLevelXp = Player.getNextLevelXP ? Player.getNextLevelXP() : 50;
        const title = Player.getMerchantTitle ? Player.getMerchantTitle() : 'Novice';
        const sp = Player.skillPoints || 0;

        const xpInLevel = totalXp - currentLevelXp;
        const xpNeeded = nextLevelXp - currentLevelXp;
        const maxLevel = 15;
        const pct = level >= maxLevel ? 100 : Math.min(100, Math.floor(xpInLevel / Math.max(1, xpNeeded) * 100));

        xpFill.style.width = pct + '%';
        xpLabel.textContent = `Lv${level} ${title}`;
        if (xpDetail) {
            var xpBankAmt = (typeof Player.xpBank !== 'undefined') ? Player.xpBank : 0;
            var bankStr = xpBankAmt > 0 ? ` • 🏦${xpBankAmt}/1000` : '';
            xpDetail.textContent = level >= maxLevel
                ? `${formatGold(totalXp)} XP • ${sp} SP${bankStr}`
                : `${formatGold(totalXp)}/${formatGold(nextLevelXp)} XP • ${sp} SP${bankStr}`;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  HUNGER BAR UPDATE
    // ═══════════════════════════════════════════════════════════
    function updateHungerBar() {
        if (typeof Player === 'undefined') return;
        const hungerFill = document.getElementById('hungerFill');
        const hungerValue = document.getElementById('hungerValue');
        if (!hungerFill || !hungerValue) return;

        const hunger = Player.hunger != null ? Player.hunger : 80;
        hungerFill.style.width = Math.max(0, Math.min(100, hunger)) + '%';
        hungerValue.textContent = '🍖 ' + Math.floor(hunger);

        if (hunger >= 60) {
            hungerFill.style.background = '#55a868';
        } else if (hunger >= 30) {
            hungerFill.style.background = '#ccb974';
        } else {
            hungerFill.style.background = '#c44e52';
        }

        // Update food supply indicator
        var foodInfo = document.getElementById('foodSupplyInfo');
        var btnEat = document.getElementById('btnEatUntilFull');
        if (foodInfo && Player.getFoodSupply) {
            var supply = Player.getFoodSupply();
            foodInfo.textContent = '🍞 ' + supply.total + ' food (~' + supply.daysEstimate + 'd)';
            if (supply.daysEstimate <= 3) foodInfo.style.color = '#c44e52';
            else if (supply.daysEstimate <= 7) foodInfo.style.color = '#ccb974';
            else foodInfo.style.color = '#aaa';
        }
        if (btnEat) {
            btnEat.disabled = hunger >= 100 || !(Player.getFoodSupply && Player.getFoodSupply().total > 0);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  ENERGY & THIRST BAR UPDATE
    // ═══════════════════════════════════════════════════════════
    function updateFatigueBar() {
        if (typeof Player === 'undefined') return;

        // Energy bar (replaces old fatigue)
        var fatigueFill = document.getElementById('fatigueFill');
        var fatigueValue = document.getElementById('fatigueValue');
        if (fatigueFill && fatigueValue) {
            var energy = Player.energy != null ? Player.energy : 100;
            var maxEnergy = Player.maxEnergy || 100;
            var energyPct = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
            fatigueFill.style.width = energyPct + '%';

            var icon = '⚡';
            if (energyPct <= 15) icon = '😵';
            else if (energyPct <= 30) icon = '😴';
            else if (energyPct <= 50) icon = '😐';
            fatigueValue.textContent = icon + ' ' + Math.floor(energy) + '/' + maxEnergy;

            if (energyPct > 60) fatigueFill.style.background = '#55a868';
            else if (energyPct > 40) fatigueFill.style.background = '#ccb974';
            else if (energyPct > 20) fatigueFill.style.background = '#e8a040';
            else fatigueFill.style.background = '#c44e52';
        }

        // Thirst bar
        var thirstFill = document.getElementById('thirstFill');
        var thirstValue = document.getElementById('thirstValue');
        if (thirstFill && thirstValue) {
            var thirst = Player.thirst != null ? Player.thirst : 80;
            var thirstPct = Math.max(0, Math.min(100, thirst));
            thirstFill.style.width = thirstPct + '%';

            var tIcon = '💧';
            if (thirstPct <= 15) tIcon = '🏜️';
            else if (thirstPct <= 30) tIcon = '😰';
            else if (thirstPct <= 50) tIcon = '🫗';
            thirstValue.textContent = tIcon + ' ' + Math.floor(thirst);

            if (thirstPct > 60) thirstFill.style.background = '#4488cc';
            else if (thirstPct > 40) thirstFill.style.background = '#7799aa';
            else if (thirstPct > 20) thirstFill.style.background = '#cc8844';
            else thirstFill.style.background = '#c44e52';
        }

        // Update drink supply indicator
        var drinkInfo = document.getElementById('drinkSupplyInfo');
        var btnDrink = document.getElementById('btnDrinkUntilFull');
        if (drinkInfo && typeof Player !== 'undefined' && Player.getDrinkSupply) {
            var supply = Player.getDrinkSupply();
            drinkInfo.textContent = '🫗 ' + supply.total + ' drinks (~' + supply.daysEstimate + 'd)';
            if (supply.daysEstimate <= 3) drinkInfo.style.color = '#c44e52';
            else if (supply.daysEstimate <= 7) drinkInfo.style.color = '#ccb974';
            else drinkInfo.style.color = '#aaa';
        }
        if (btnDrink) {
            var thirstVal = typeof Player !== 'undefined' && Player.thirst != null ? Player.thirst : 80;
            btnDrink.disabled = thirstVal >= 100 || !(typeof Player !== 'undefined' && Player.getDrinkSupply && Player.getDrinkSupply().total > 0);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  HEALTH BAR UPDATE
    // ═══════════════════════════════════════════════════════════
    function updateHealthBar() {
        if (typeof Player === 'undefined') return;
        var healthFill = document.getElementById('healthFill');
        var healthValue = document.getElementById('healthValue');
        if (!healthFill || !healthValue) return;

        var health = Player.health != null ? Player.health : 100;
        var maxHealth = Player.maxHealth || 100;
        var healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
        healthFill.style.width = healthPct + '%';

        var hIcon = '❤️';
        if (healthPct <= 15) hIcon = '💀';
        else if (healthPct <= 30) hIcon = '🩹';
        else if (healthPct <= 50) hIcon = '🤕';
        healthValue.textContent = hIcon + ' ' + Math.floor(health) + '/' + maxHealth;

        if (healthPct > 60) healthFill.style.background = '#55a868';
        else if (healthPct > 40) healthFill.style.background = '#ccb974';
        else if (healthPct > 20) healthFill.style.background = '#e8a040';
        else healthFill.style.background = '#c44e52';
    }

    // ═══════════════════════════════════════════════════════════
    //  HOUSING DIALOG
    // ═══════════════════════════════════════════════════════════
    function openHousingDialog() {
        if (typeof Player === 'undefined') return;
        if (Player.traveling) { toast('Cannot manage housing while traveling.', 'warning'); return; }

        var html = '<div style="max-height:500px;overflow-y:auto;">';

        // Current houses
        var houses = Player.houses || [];
        html += '<h3>🏠 Your Properties (' + houses.length + ')</h3>';
        if (houses.length === 0) {
            html += '<p style="color:#aaa;">No properties owned. Buy land and build a home!</p>';
        } else {
            for (var i = 0; i < houses.length; i++) {
                var h = houses[i];
                var ht = CONFIG.HOUSING_TYPES.find(function(t) { return t.id === h.type; });
                if (!ht) continue;
                var town = Engine.findTown(h.townId);
                var isPrimary = h.id === Player.primaryHouseId;
                html += '<div style="border:1px solid ' + (isPrimary ? '#ffd700' : '#555') + ';padding:8px;margin:4px 0;border-radius:4px;background:rgba(0,0,0,0.2);">';
                html += '<div><strong>' + ht.icon + ' ' + ht.name + '</strong> in ' + (town ? town.name : '?') + (isPrimary ? ' ⭐ Primary' : '') + '</div>';
                html += '<div style="font-size:0.8rem;color:#aaa;">' + ht.description + '</div>';
                html += '<div style="font-size:0.8rem;">Storage: ' + ht.storage + ' | Comfort: ' + ht.comfort + ' | Security: ' + Math.round(ht.security * 100) + '%</div>';
                if (h.isRental) html += '<div style="color:#5ac85a;font-size:0.8rem;">💰 Rented out (accumulated: ' + (h.rentAccumulated || 0) + 'g)</div>';
                html += '<div style="margin-top:4px;">';
                if (!isPrimary) html += '<button class="btn-medieval" onclick="UI.setPrimaryHouseUI(\'' + h.id + '\')" style="font-size:0.75rem;padding:3px 8px;margin:2px;">⭐ Set Primary</button>';
                html += '<button class="btn-medieval" onclick="UI.rentOutHouseUI(\'' + h.id + '\')" style="font-size:0.75rem;padding:3px 8px;margin:2px;">' + (h.isRental ? '🏠 Stop Renting' : '💰 Rent Out') + '</button>';
                html += '<button class="btn-medieval" onclick="UI.upgradeHouseUI(\'' + h.id + '\')" style="font-size:0.75rem;padding:3px 8px;margin:2px;">🏗️ Upgrade</button>';
                html += '<button class="btn-medieval" onclick="UI.sellHouseUI(\'' + h.id + '\')" style="font-size:0.75rem;padding:3px 8px;margin:2px;color:#c44e52;">🏚️ Sell</button>';
                html += '</div></div>';
            }
        }

        // Available to buy (if player is in a town)
        if (!Player.traveling && Player.townId) {
            var town = Engine.findTown(Player.townId);
            if (town) {
                html += '<h3 style="margin-top:12px;">🏗️ Buy Housing in ' + town.name + '</h3>';
                var ownedLand = Player.getOwnedLand(Player.townId);
                var usedLand = houses.filter(function(h) { return h.townId === Player.townId && h.type !== 'apartment'; }).length;
                html += '<div style="font-size:0.85rem;margin-bottom:8px;">Land plots: ' + usedLand + '/' + ownedLand + ' used | <button class="btn-medieval" onclick="UI.buyLandUI()" style="font-size:0.75rem;padding:2px 8px;">Buy Land (' + (Player.getLandCost ? Player.getLandCost(Player.townId) : '?') + 'g)</button></div>';

                for (var j = 0; j < CONFIG.HOUSING_TYPES.length; j++) {
                    var htype = CONFIG.HOUSING_TYPES[j];
                    if (htype.id === 'bedroll' || htype.id === 'inn_room') continue;
                    if (htype.requiresPort && !town.isPort) continue;
                    if (htype.portable && htype.requiresHorse && !Player.state.horse) continue;
                    var catOrder = ['village', 'town', 'city', 'capital_city'];
                    if (htype.minTownCategory && catOrder.indexOf(town.category || 'village') < catOrder.indexOf(htype.minTownCategory)) continue;
                    var costInfo = Player.getHousingCost(htype.id, Player.townId);
                    var totalCost = costInfo.total || 0;
                    var canAfford = Player.gold >= totalCost;
                    var matsAvailable = costInfo.available !== false;
                    var needsLand = htype.id !== 'apartment' && !htype.portable && usedLand >= ownedLand;
                    var canBuild = canAfford && matsAvailable && !needsLand;
                    // Rank check
                    if (htype.minRank) {
                        var bestRank = 0;
                        var sr = Player.state.socialRank || {};
                        for (var rk in sr) { if ((sr[rk] || 0) > bestRank) bestRank = sr[rk]; }
                        if (bestRank < htype.minRank) canBuild = false;
                    }
                    html += '<div style="border:1px solid #444;padding:6px;margin:3px 0;border-radius:4px;opacity:' + (canBuild ? '1' : '0.6') + ';">';
                    html += '<div>' + htype.icon + ' <strong>' + htype.name + '</strong> — <span style="color:#ffd700;">' + totalCost.toFixed(2) + 'g</span>';
                    if (costInfo.laborCost) html += ' <span class="text-dim" style="font-size:0.75rem;">(materials: ' + costInfo.materialCost.toFixed(2) + 'g + labor: ' + costInfo.laborCost.toFixed(2) + 'g)</span>';
                    html += '</div>';
                    html += '<div style="font-size:0.75rem;color:#aaa;">' + htype.description + '</div>';
                    // Material list
                    if (htype.materials) {
                        html += '<div style="font-size:0.7rem;margin-top:2px;">';
                        var matParts = [];
                        for (var mid in costInfo.breakdown) {
                            var mb = costInfo.breakdown[mid];
                            var matColor = mb.needToBuy > mb.marketHas ? '#c44e52' : (mb.needToBuy > 0 ? '#ff9f43' : '#5ac85a');
                            matParts.push('<span style="color:' + matColor + ';">' + mid + ': ' + mb.needed + (mb.playerHas > 0 ? ' (' + mb.playerHas + ' owned)' : '') + '</span>');
                        }
                        html += '📦 ' + matParts.join(', ') + '</div>';
                    }
                    html += '<button class="btn-medieval" onclick="UI.buyHouseUI(\'' + htype.id + '\')" style="font-size:0.75rem;padding:3px 8px;margin-top:3px;"' + (canBuild ? '' : ' disabled') + '>🏗️ Build</button>';
                    if (needsLand) html += ' <span style="color:#c44e52;font-size:0.75rem;">Need land!</span>';
                    if (!matsAvailable) html += ' <span style="color:#c44e52;font-size:0.75rem;">Missing materials!</span>';
                    if (htype.minRank) {
                        var reqName = CONFIG.SOCIAL_RANKS && CONFIG.SOCIAL_RANKS[htype.minRank] ? CONFIG.SOCIAL_RANKS[htype.minRank].name : 'Rank ' + htype.minRank;
                        html += ' <span style="font-size:0.7rem;color:#aaa;">Requires: ' + reqName + '</span>';
                    }
                    html += '</div>';
                }
            }
        }

        html += '</div>';
        openModal('🏠 Housing & Property', html);
    }

    function buyHouseUI(housingTypeId) {
        var result = Player.buyHouse(housingTypeId, Player.townId);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openHousingDialog();
    }

    function sellHouseUI(houseId) {
        var result = Player.sellHouse(houseId);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openHousingDialog();
    }

    function upgradeHouseUI(houseId) {
        // Show upgrade options — list housing types more expensive than current
        var house = (Player.state.houses || []).find(function(h) { return h.id === houseId; });
        if (!house) { toast('House not found.', 'danger'); return; }
        var currentHt = CONFIG.HOUSING_TYPES.find(function(h) { return h.id === house.type; });
        if (!currentHt) return;
        var currentCostInfo = Player.getHousingCost(house.type, house.townId);
        var discount = CONFIG.HOUSING_UPGRADE_DISCOUNT || 0.60;
        var credit = Math.floor(currentCostInfo.total * discount);

        var html = '<div style="max-height:400px;overflow-y:auto;">';
        html += '<div style="margin-bottom:8px;">Current: <b>' + currentHt.icon + ' ' + currentHt.name + '</b> (value: ' + currentCostInfo.total.toFixed(2) + 'g, credit: ' + credit.toFixed(2) + 'g)</div>';
        var hasOptions = false;
        for (var i = 0; i < CONFIG.HOUSING_TYPES.length; i++) {
            var ht = CONFIG.HOUSING_TYPES[i];
            if (ht.id === house.type || !ht.materials) continue;
            if (ht.id === 'bedroll' || ht.id === 'inn_room') continue;
            var newCostInfo = Player.getHousingCost(ht.id, house.townId);
            if (newCostInfo.total <= currentCostInfo.total) continue;
            var upgCost = Math.max(0, newCostInfo.total - credit);
            var canUpg = newCostInfo.available && Player.gold >= upgCost;
            hasOptions = true;
            html += '<div style="border:1px solid #444;padding:6px;margin:3px 0;border-radius:4px;opacity:' + (canUpg ? '1' : '0.5') + ';">';
            html += ht.icon + ' <b>' + ht.name + '</b> — <span style="color:#ffd700;">' + upgCost.toFixed(2) + 'g</span> <span class="text-dim" style="font-size:0.7rem;">(full: ' + newCostInfo.total.toFixed(2) + 'g - ' + credit.toFixed(2) + 'g credit)</span><br>';
            html += '<span style="font-size:0.75rem;color:#aaa;">' + ht.description + '</span><br>';
            html += '<button class="btn-medieval" onclick="UI.doUpgradeHouse(\'' + houseId + '\',\'' + ht.id + '\')" style="font-size:0.75rem;padding:3px 8px;margin-top:2px;"' + (canUpg ? '' : ' disabled') + '>🏗️ Upgrade (' + upgCost.toFixed(2) + 'g)</button>';
            if (!newCostInfo.available) html += ' <span style="color:#c44e52;font-size:0.7rem;">Missing materials</span>';
            html += '</div>';
        }
        if (!hasOptions) html += '<p class="text-dim">No upgrades available for this location.</p>';
        html += '</div>';
        openModal('🏗️ Upgrade ' + currentHt.name, html, '<button class="btn-medieval" onclick="UI.closeModal()">Cancel</button>');
    }

    function doUpgradeHouse(houseId, newTypeId) {
        var result = Player.upgradeHouse(houseId, newTypeId);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) { closeModal(); openHousingDialog(); }
    }

    function setPrimaryHouseUI(houseId) {
        var result = Player.setPrimaryHouse(houseId);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openHousingDialog();
    }

    function rentOutHouseUI(houseId) {
        var result = Player.rentOutHouse(houseId);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openHousingDialog();
    }

    function buyLandUI() {
        var result = Player.buyLand(Player.townId);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openHousingDialog();
    }

    function sellLandUI() {
        var result = Player.sellLand(Player.townId);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openHousingDialog();
    }

    // ═══════════════════════════════════════════════════════════
    //  TALK TO TOWNSFOLK DIALOG
    // ═══════════════════════════════════════════════════════════
    function talkToTownsfolk() {
        if (typeof Player === 'undefined') return;
        if (Player.traveling) { toast('Cannot talk while traveling.', 'warning'); return; }
        if (!Player.townId) { toast('You must be in a town to talk to people.', 'warning'); return; }

        var result = Player.talkToTownsfolk();
        if (!result || !result.success) {
            toast((result && result.message) || 'Nobody wants to talk right now.', 'warning');
            return;
        }

        // Build a nice chat bubble display
        var html = '<div style="text-align:center;margin-bottom:16px;">';
        html += '<div style="font-size:1.5rem;margin-bottom:4px;">' + (result.icon || '💬') + '</div>';
        html += '<div style="font-size:0.85rem;color:var(--gold);">' + result.speaker + '</div>';
        html += '<div style="font-size:0.7rem;color:#888;margin-bottom:12px;text-transform:capitalize;">' + result.occupation + '</div>';
        html += '</div>';

        html += '<div style="background:rgba(255,255,255,0.05);border-left:3px solid ' + (result.type === 'useful' ? 'var(--gold)' : 'rgba(255,255,255,0.2)') + ';padding:10px 14px;border-radius:4px;font-style:italic;font-size:0.82rem;line-height:1.5;margin-bottom:12px;">';
        html += result.message;
        html += '</div>';

        if (result.type === 'useful') {
            html += '<div style="text-align:center;font-size:0.7rem;color:var(--gold);margin-bottom:8px;">📌 Useful information!</div>';
        }

        html += '<div style="text-align:center;">';
        html += '<button class="btn-medieval" onclick="UI.talkToTownsfolk();" style="padding:6px 16px;margin-right:8px;">Talk to Someone Else</button>';
        html += '<button class="btn-medieval" onclick="UI.closeModal();" style="padding:6px 16px;">Done</button>';
        html += '</div>';

        openModal('💬 Conversation', html);
    }

    // ═══════════════════════════════════════════════════════════
    //  REST DIALOG
    // ═══════════════════════════════════════════════════════════
    function openRestDialog() {
        if (typeof Player === 'undefined') return;
        if (Player.traveling) { toast('Cannot rest while traveling.', 'warning'); return; }

        var energy = Player.energy != null ? Player.energy : 100;
        var maxEnergy = Player.maxEnergy || 100;
        var energyPct = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
        var thirst = Player.thirst != null ? Player.thirst : 80;

        var html = '<div style="text-align:center;">';
        html += '<h3>⚡ Energy: ' + Math.floor(energy) + '/' + maxEnergy + '</h3>';
        html += '<div class="bar-small" style="width:240px;margin:8px auto;"><div class="bar-small-fill" style="width:' + energyPct + '%;background:' + (energyPct > 60 ? '#55a868' : energyPct > 40 ? '#ccb974' : energyPct > 20 ? '#e8a040' : '#c44e52') + '"></div></div>';
        html += '<h4 style="margin-top:6px;">💧 Thirst: ' + Math.floor(thirst) + '/100</h4>';
        html += '<div class="bar-small" style="width:180px;margin:6px auto;"><div class="bar-small-fill" style="width:' + thirst + '%;background:' + (thirst > 60 ? '#4488cc' : thirst > 30 ? '#cc8844' : '#c44e52') + '"></div></div>';

        // Get available rest options from Player
        var restOptions = [];
        if (Player.getAvailableRestOptions) {
            restOptions = Player.getAvailableRestOptions();
        }

        if (restOptions.length > 0) {
            html += '<h4 style="margin-top:12px;">🛏️ Rest Options</h4>';
            for (var i = 0; i < restOptions.length; i++) {
                var opt = restOptions[i];
                var ticksToFull = Math.ceil((maxEnergy - energy) / opt.energyPerTick);
                var costNote = opt.cost > 0 ? ' — ' + opt.cost + 'g' : ' — Free';
                html += '<div style="margin:6px 0;">';
                html += '<button class="btn-medieval" onclick="UI.restUI(\'' + opt.id + '\')" style="padding:6px 16px;width:90%;">';
                html += (opt.icon || '') + ' ' + opt.name + costNote;
                html += '</button>';
                html += '<div style="font-size:0.75rem;color:#aaa;">+' + opt.energyPerTick.toFixed(1) + ' energy/tick · ~' + ticksToFull + ' ticks to full';
                if (opt.risk) html += ' · ⚠️ ' + opt.risk;
                html += '</div></div>';
            }
        } else {
            // Fallback if getAvailableRestOptions not available
            html += '<div style="margin:8px 0;"><button class="btn-medieval" onclick="UI.sleepOutsideUI()" style="padding:8px 20px;">🌙 Sleep Outside (free, disease risk)</button></div>';
        }

        // Draw water button
        var town = Engine.findTown(Player.townId);
        if (town && town.buildings && town.buildings.some(function(b) { return b.type === 'well'; })) {
            var kingdom = Engine.findKingdom(town.kingdomId);
            var isFree = kingdom && kingdom.laws && kingdom.laws.freeWellWater;
            html += '<div style="margin:12px 0;border-top:1px solid #555;padding-top:8px;">';
            html += '<button class="btn-medieval" onclick="UI.drawWaterUI()" style="padding:6px 16px;">💧 Draw Water from Well' + (isFree ? ' (Free)' : ' (1g)') + '</button>';
            html += '</div>';
        }

        // Armed escort
        if (Player.armedEscort && Player.armedEscort.active) {
            html += '<div style="margin-top:12px;color:#5ac85a;">⚔️ Armed escort active: ' + Player.armedEscort.daysLeft + ' days remaining</div>';
        } else {
            html += '<div style="margin-top:12px;"><button class="btn-medieval" onclick="UI.hireEscortUI()" style="padding:6px 16px;">⚔️ Hire Armed Escort (' + CONFIG.WARTIME_ESCORT_COST_PER_DAY + 'g/day)</button></div>';
        }

        html += '</div>';
        openModal('💤 Rest & Recovery', html);
    }

    function restUI(locationId) {
        if (!Player.restForTicks) { toast('Rest system not available.', 'error'); return; }
        // Rest enough ticks to reach full energy
        var maxEnergy = Player.maxEnergy || 100;
        var energy = Player.energy != null ? Player.energy : 100;
        var rate = 3.0; // default, will be calculated by restForTicks
        var ticksNeeded = Math.ceil((maxEnergy - energy) / rate);
        if (ticksNeeded < 1) ticksNeeded = 1;
        var result = Player.restForTicks(locationId, ticksNeeded);
        toast(result.message, result.success ? 'success' : 'error');
        closeModal();
    }

    function drawWaterUI() {
        if (!Player.drawWaterFromWell) { toast('Draw water not available.', 'error'); return; }
        var result = Player.drawWaterFromWell();
        toast(result.message, result.success ? 'success' : 'error');
        closeModal();
    }

    function restAtHomeUI() {
        var result = Player.restAtHome(Player.townId);
        toast(result.message, result.success ? 'success' : 'error');
        closeModal();
    }

    function restAtInnUI() {
        var result = Player.restAtInn(Player.townId);
        toast(result.message, result.success ? 'success' : 'error');
        closeModal();
    }

    function sleepOutsideUI() {
        var result = Player.sleepOutside();
        toast(result.message, result.success ? 'success' : 'error');
        closeModal();
    }

    function hireEscortUI() {
        var result = Player.hireArmedEscort(7);
        toast(result.message, result.success ? 'success' : 'error');
        closeModal();
    }

    // ═══════════════════════════════════════════════════════════
    //  OUTPOST MANAGEMENT DIALOG
    // ═══════════════════════════════════════════════════════════

    function openOutpostDialog() {
        var outposts = Player.getPlayerOutposts ? Player.getPlayerOutposts() : [];
        var cfg = CONFIG.OUTPOST_CONFIG || {};
        var body = '';

        if (outposts.length === 0) {
            body += '<div style="text-align:center;padding:20px">';
            body += '<p>⛺ You have no wilderness outposts.</p>';
            body += '<p style="color:#aaa;font-size:12px">Found outposts in the wilderness to extend your trade network.<br>';
            body += 'Cost: ' + (cfg.foundingCost || 500) + 'g + materials (wood, stone)</p>';
            body += '</div>';
        } else {
            body += '<div style="max-height:350px;overflow-y:auto">';
            for (var i = 0; i < outposts.length; i++) {
                var op = outposts[i];
                var statusIcon = op.abandoned ? '💀' : op.annexed ? '🏘️' : '⛺';
                var statusText = op.abandoned ? 'Abandoned' : op.annexed ? 'Annexed → Village' : 'Active';
                body += '<div style="border:1px solid #555;padding:10px;margin:5px 0;border-radius:5px;background:#2a2a2a">';
                body += '<h4 style="margin:0">' + statusIcon + ' ' + op.name + '</h4>';
                body += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:5px 0;font-size:12px">';
                body += '<span>📊 ' + statusText + '</span>';
                body += '<span>🏗️ ' + op.buildings + '/' + op.maxBuildings + ' buildings</span>';
                body += '<span>👷 ' + op.workers + '/' + (cfg.maxHiredWorkers || 8) + ' workers</span>';
                body += '<span>🛡️ ' + op.guards + '/' + (cfg.maxGuards || 4) + ' guards</span>';
                body += '<span>🏰 Walls: ' + op.walls + '</span>';
                body += '<span>📈 Prosperity: ' + Math.floor(op.prosperity) + '</span>';
                body += '<span>👥 Pop: ' + op.population + '</span>';
                body += '<span>💰 Daily: -' + Math.floor(op.dailyCost) + 'g</span>';
                body += '</div>';

                if (!op.abandoned && !op.annexed && op.isOutpost) {
                    body += '<div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap">';
                    body += '<button onclick="UI.outpostStaffUI(\'' + op.townId + '\',\'hire\',\'worker\')" style="padding:3px 8px;font-size:11px">+👷 Worker</button>';
                    body += '<button onclick="UI.outpostStaffUI(\'' + op.townId + '\',\'dismiss\',\'worker\')" style="padding:3px 8px;font-size:11px">-👷 Worker</button>';
                    body += '<button onclick="UI.outpostStaffUI(\'' + op.townId + '\',\'hire\',\'guard\')" style="padding:3px 8px;font-size:11px">+🛡️ Guard</button>';
                    body += '<button onclick="UI.outpostStaffUI(\'' + op.townId + '\',\'dismiss\',\'guard\')" style="padding:3px 8px;font-size:11px">-🛡️ Guard</button>';
                    body += '</div>';
                }
                body += '</div>';
            }
            body += '</div>';
        }

        var footer = '<button onclick="UI.foundOutpostUI()" style="background:#4a7c3b;color:white;padding:6px 15px;border:none;border-radius:4px;cursor:pointer">⛺ Found New Outpost (' + (cfg.foundingCost || 500) + 'g)</button>';
        footer += ' <button onclick="closeModal()">Close</button>';
        openModal('⛺ Wilderness Outposts', body, footer);
    }

    function foundOutpostUI() {
        var name = prompt('Name your outpost:');
        if (!name || name.trim() === '') return;
        var result = Player.foundPlayerOutpost(name);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) openOutpostDialog();
    }

    function outpostStaffUI(townId, action, type) {
        var result = Player.manageOutpostStaff(townId, action, type);
        toast(result.message, result.success ? 'success' : 'error');
        openOutpostDialog();
    }

    // ═══════════════════════════════════════════════════════════
    //  SKILLS DIALOG
    // ═══════════════════════════════════════════════════════════
    let _skillBranch = 'commerce';

    function openSkillsDialog(branch) {
        if (branch && typeof branch === 'string') _skillBranch = branch;

        const sp = Player.skillPoints || 0;
        const playerSkills = Player.skills || {};

        let tabsHtml = '';
        for (const [branchId, info] of Object.entries(SKILL_BRANCHES)) {
            const active = branchId === _skillBranch ? 'active' : '';
            const branchSkills = Object.keys(SKILLS).filter(id => SKILLS[id].branch === branchId);
            const unlocked = branchSkills.filter(id => playerSkills[id]).length;
            tabsHtml += `<button class="skill-tab ${active}" onclick="UI.openSkillsDialog('${branchId}')" style="border-bottom:3px solid ${active ? info.color : 'transparent'}">
                ${info.icon} ${info.name} <span class="skill-tab-count">${unlocked}/${branchSkills.length}</span>
            </button>`;
        }

        const branchSkills = [];
        for (const id in SKILLS) {
            if (SKILLS[id].branch === _skillBranch) {
                branchSkills.push({ id, ...SKILLS[id] });
            }
        }

        let skillsHtml = '<div class="skill-grid">';
        for (const skill of branchSkills) {
            const isUnlocked = playerSkills[skill.id];
            const canUnlock = Player.canUnlockSkill ? Player.canUnlockSkill(skill.id) : false;
            const reqsMet = skill.requires.every(r => playerSkills[r]);
            const costAffordable = sp >= skill.cost;

            let stateClass = 'skill-locked';
            let stateLabel = '🔒';
            if (isUnlocked) {
                stateClass = 'skill-unlocked';
                stateLabel = '✅';
            } else if (canUnlock) {
                stateClass = 'skill-available';
                stateLabel = '';
            }

            const reqNames = skill.requires.map(r => SKILLS[r] ? SKILLS[r].name : r).join(', ');

            skillsHtml += `<div class="skill-node ${stateClass}" title="${skill.desc}">
                <div class="skill-icon">${skill.icon}</div>
                <div class="skill-name">${skill.name} ${stateLabel}</div>
                <div class="skill-cost">${skill.cost > 0 ? skill.cost + ' SP' : 'FREE'}</div>
                <div class="skill-desc">${skill.desc}</div>
                ${skill.requires.length > 0 ? `<div class="skill-requires">Requires: ${reqNames}</div>` : ''}
                ${!isUnlocked && canUnlock ? `<button class="btn-trade buy skill-learn-btn" onclick="UI.learnSkill('${skill.id}')">Learn</button>` : ''}
            </div>`;
        }
        skillsHtml += '</div>';

        const html = `
            <div class="skill-header">
                <span class="skill-sp-display">📚 Skill Points: <strong>${sp}</strong></span>
                <span class="skill-level-display">Level ${Player.level || 1} ${Player.getMerchantTitle ? Player.getMerchantTitle() : ''}</span>
            </div>
            <div class="skill-tabs">${tabsHtml}</div>
            ${skillsHtml}
        `;

        openModal('📚 Skills', html);
    }

    function learnSkill(skillId) {
        if (typeof Player !== 'undefined' && Player.unlockSkill) {
            const success = Player.unlockSkill(skillId);
            if (success) {
                openSkillsDialog(_skillBranch);
            } else {
                toast('Cannot learn this skill.', 'warning');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  ACHIEVEMENTS DIALOG
    // ═══════════════════════════════════════════════════════════
    let _achCategory = 'trading';

    function openAchievementsDialog(category) {
        if (category && typeof category === 'string') _achCategory = category;

        const playerAch = Player.achievements || {};
        const totalUnlocked = Object.keys(playerAch).length;
        const totalAch = Object.keys(ACHIEVEMENTS).length;

        let tabsHtml = '';
        for (const [catId, info] of Object.entries(ACHIEVEMENT_CATEGORIES)) {
            const active = catId === _achCategory ? 'active' : '';
            const catAchs = Object.keys(ACHIEVEMENTS).filter(id => ACHIEVEMENTS[id].category === catId);
            const unlocked = catAchs.filter(id => playerAch[id]).length;
            tabsHtml += `<button class="skill-tab ${active}" onclick="UI.openAchievementsDialog('${catId}')">
                ${info.icon} ${info.name} <span class="skill-tab-count">${unlocked}/${catAchs.length}</span>
            </button>`;
        }

        const categoryAchs = [];
        for (const id in ACHIEVEMENTS) {
            if (ACHIEVEMENTS[id].category === _achCategory) {
                categoryAchs.push({ id, ...ACHIEVEMENTS[id] });
            }
        }

        let achHtml = '<div class="achievement-grid">';
        for (const ach of categoryAchs) {
            const isUnlocked = playerAch[ach.id];
            const stateClass = isUnlocked ? 'ach-unlocked' : 'ach-locked';
            const dayText = isUnlocked ? `Day ${isUnlocked.unlockedAt}` : '';

            achHtml += `<div class="achievement-card ${stateClass}">
                <div class="ach-icon">${ach.icon}</div>
                <div class="ach-info">
                    <div class="ach-name">${ach.name} ${isUnlocked ? '✅' : '🔒'}</div>
                    <div class="ach-desc">${ach.desc}</div>
                    <div class="ach-xp">+${ach.xp} XP ${dayText ? '• ' + dayText : ''}</div>
                </div>
            </div>`;
        }
        achHtml += '</div>';

        const html = `
            <div class="ach-header">
                <span class="ach-progress">🏆 ${totalUnlocked}/${totalAch} Achievements Unlocked</span>
                <span class="ach-xp-total">Total XP: ${formatGold(Player.totalXp || 0)}</span>
            </div>
            <div class="skill-tabs">${tabsHtml}</div>
            ${achHtml}
        `;

        openModal('🏆 Achievements', html);
    }

    // ═══════════════════════════════════════════════════════════
    //  MARKET INTEL (added to trade dialog)
    // ═══════════════════════════════════════════════════════════
    function buildMarketIntelHtml(currentTownId) {
        if (typeof Player === 'undefined') return '';

        const intel = Player.marketIntel || {};
        const hasIntelSkill = Player.hasSkill && (Player.hasSkill('market_scout') || Player.hasSkill('trade_network') || Player.hasSkill('global_trade_intel'));

        // Gather remote town intel
        const remoteTowns = [];
        for (const [townId, data] of Object.entries(intel)) {
            if (townId === currentTownId) continue;
            const town = Engine.findTown(townId);
            if (!town) continue;
            remoteTowns.push({ town, data });
        }

        if (remoteTowns.length === 0 && !hasIntelSkill) {
            return `<div class="market-intel-section">
                <h4>📊 Market Intel</h4>
                <div class="text-dim" style="font-size:0.8rem;">No market intelligence available. Learn the Market Scout skill or pay an Information Broker (25g).</div>
                <button class="btn-trade buy" style="margin-top:6px;" onclick="UI.buyInfoBrokerTip()">💡 Buy Trade Tip (25g)</button>
            </div>`;
        }

        let html = '<div class="market-intel-section"><h4>📊 Market Intel</h4>';

        if (!hasIntelSkill) {
            html += `<button class="btn-trade buy" style="margin-bottom:8px;" onclick="UI.buyInfoBrokerTip()">💡 Buy Trade Tip (25g)</button>`;
        }

        if (remoteTowns.length > 0) {
            // Show condensed price comparison for profitable resources
            const currentTown = Engine.findTown(currentTownId);
            const currentPrices = currentTown ? currentTown.market.prices : {};

            html += '<div class="intel-table"><table class="intel-prices"><tr><th>Town</th><th>Best Buy</th><th>Best Sell</th><th>Updated</th></tr>';

            for (const { town, data } of remoteTowns.slice(0, 8)) {
                let bestBuy = null, bestSell = null;
                for (const resId in data.prices) {
                    const remotePrice = data.prices[resId] || 0;
                    const localPrice = currentPrices[resId] || 0;
                    if (localPrice > 0 && remotePrice > 0) {
                        const profitSelling = remotePrice - localPrice;
                        const profitBuying = localPrice - remotePrice;
                        if (profitSelling > 0 && (!bestSell || profitSelling > bestSell.profit)) {
                            const res = findResource(resId);
                            bestSell = { res, profit: profitSelling, price: remotePrice };
                        }
                        if (profitBuying > 0 && (!bestBuy || profitBuying > bestBuy.profit)) {
                            const res = findResource(resId);
                            bestBuy = { res, profit: profitBuying, price: remotePrice };
                        }
                    }
                }
                const kingdom = Engine.findKingdom(town.kingdomId);
                const kName = kingdom ? kingdom.name.substring(0, 8) : '';
                const daysSinceUpdate = Engine.getDay() - (data.updatedDay || 0);
                const updateText = daysSinceUpdate <= 1 ? 'Now' : `${daysSinceUpdate}d ago`;
                const _keenEyeD = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('keen_eye');
                const _dealClass = _keenEyeD ? 'good-deal' : 'neutral';
                html += `<tr>
                    <td title="${town.name} (${kName})">${town.name.substring(0, 12)}</td>
                    <td>${bestBuy ? `${bestBuy.res.icon}${Math.round(bestBuy.price * 10) / 10}g <span class="${_dealClass}">(+${Math.round(bestBuy.profit * 10) / 10})</span>` : '—'}</td>
                    <td>${bestSell ? `${bestSell.res.icon}${Math.round(bestSell.price * 10) / 10}g <span class="${_dealClass}">(+${Math.round(bestSell.profit * 10) / 10})</span>` : '—'}</td>
                    <td class="text-dim">${updateText}</td>
                </tr>`;
            }
            html += '</table></div>';
        }

        html += '</div>';
        return html;
    }

    function buyInfoBrokerTip() {
        if (typeof Player === 'undefined' || !Player.getInfoBrokerTip) return;
        const tips = Player.getInfoBrokerTip();
        if (!tips) {
            toast('Not enough gold for a tip (25g).', 'warning');
            return;
        }
        if (tips.length === 0) {
            toast('The broker has no useful tips right now.', 'info');
            return;
        }
        let msg = '💡 Trade Tips:\n';
        for (const tip of tips) {
            msg += `• ${tip.resource.icon} ${tip.resource.name}: buy here for ${tip.localPrice}g, sell in ${tip.town.name} for ${tip.remotePrice}g (+${tip.profit}g profit)\n`;
        }
        toast(msg, 'info');
    }

    // ═══════════════════════════════════════════════════════════
    //  KINGDOM & TOWN SELECTION
    // ═══════════════════════════════════════════════════════════

    function showKingdomSelection(onComplete) {
        const screen = document.getElementById('kingdomSelectScreen');
        if (!screen) return;
        const content = document.getElementById('kingdomSelectContent');
        if (!content) return;

        screen.classList.remove('hidden');
        screen.style.display = 'flex';

        const kingdoms = Engine.getKingdoms();
        const towns = Engine.getTowns();

        let html = '<h1 class="kingdom-select-title">Choose Your Kingdom</h1>';
        html += '<p class="kingdom-select-subtitle">Select the kingdom where you will begin your merchant career</p>';
        html += '<div class="kingdom-cards">';

        for (const k of kingdoms) {
            const kTowns = towns.filter(t => t.kingdomId === k.id);
            const totalPop = kTowns.reduce((s, t) => s + (t.population || 0), 0);
            const pers = k.kingPersonality || {};
            const kingPerson = k.king ? Engine.getPerson(k.king) : null;
            const kingName = kingPerson ? (kingPerson.firstName + ' ' + kingPerson.lastName) : 'Unknown';

            // Relations
            let relHtml = '';
            for (const ok of kingdoms) {
                if (ok.id === k.id) continue;
                const relVal = k.relations[ok.id] || 0;
                let relIcon = '✓', relLabel = 'Peace', relClass = 'rel-peace';
                if (k.atWar && k.atWar.includes(ok.id)) { relIcon = '⚔️'; relLabel = 'War'; relClass = 'rel-war'; }
                else if (relVal >= CONFIG.RELATION_ALLIANCE_THRESHOLD) { relIcon = '🤝'; relLabel = 'Alliance'; relClass = 'rel-alliance'; }
                else if (relVal < -30) { relIcon = '⚠️'; relLabel = 'Tense'; relClass = 'rel-tense'; }
                relHtml += '<span class="kingdom-rel ' + relClass + '">' + relIcon + ' ' + ok.name + ' (' + relLabel + ')</span> ';
            }

            // Prosperity level
            let prospLevel = 'Medium';
            if (k.prosperity >= 70) prospLevel = 'Very High';
            else if (k.prosperity >= 55) prospLevel = 'High';
            else if (k.prosperity < 35) prospLevel = 'Low';

            // Military strength
            let milLevel = 'Moderate';
            if (pers.militarism === 'warlike') milLevel = 'Mighty';
            else if (pers.militarism === 'aggressive') milLevel = 'Strong';
            else if (pers.militarism === 'peaceful') milLevel = 'Weak';

            // Culture icons
            const cultureIcons = { agricultural: '🌾', military: '⚔️', mercantile: '💰', industrial: '🏭' };
            const cultureIcon = cultureIcons[k.culture] || '🏰';

            // Values
            const values = [];
            if (pers.generosity === 'generous') values.push('Generosity');
            if (pers.militarism === 'warlike' || pers.militarism === 'aggressive') values.push('Martial Prowess');
            if (pers.justice === 'just') values.push('Justice & Law');
            if (pers.tradition === 'traditional') values.push('Ancient Traditions');
            if (k.culture === 'mercantile') values.push('Trade & Wealth');
            if (k.culture === 'industrial') values.push('Industry & Innovation');
            if (k.culture === 'agricultural') values.push('The Harvest');
            if (values.length === 0) values.push('Pragmatism');

            // Special laws
            let lawsHtml = '';
            const specialLaws = (k.laws && k.laws.specialLaws) || [];
            for (const law of specialLaws) {
                lawsHtml += '<span class="law-badge" title="' + (law.desc || '') + '">' + law.icon + ' ' + law.name + '</span> ';
            }

            // Banned/restricted
            let bannedHtml = '';
            if (k.laws && k.laws.bannedGoods && k.laws.bannedGoods.length > 0) {
                bannedHtml = '<div class="kingdom-detail-row"><span class="detail-label">🚫 Banned:</span> ' + k.laws.bannedGoods.join(', ') + '</div>';
            }

            html += '<div class="kingdom-card" data-kingdom-id="' + k.id + '" style="border-color:' + k.color + '">';
            html += '<div class="kingdom-card-header" style="background:' + k.color + '">';
            html += '<span class="kingdom-card-name">' + k.name + '</span>';
            html += '<span class="kingdom-card-badge">' + cultureIcon + ' ' + k.culture + '</span>';
            html += '</div>';
            html += '<div class="kingdom-card-body">';
            html += '<div class="kingdom-detail-row"><span class="detail-label">👑 King:</span> ' + kingName + ' ' + (pers.icon || '👑') + '</div>';
            html += '<div class="kingdom-detail-row"><span class="detail-label">🎭 Traits:</span> ' + [pers.generosity, pers.militarism, pers.justice, pers.tradition].join(', ') + '</div>';
            html += '<div class="kingdom-detail-row"><span class="detail-label">💫 Values:</span> ' + values.join(', ') + '</div>';
            html += '<div class="kingdom-flavor">' + (k.flavorText || '') + '</div>';
            html += '<div class="kingdom-detail-row"><span class="detail-label">🏘️ Towns:</span> ' + kTowns.length + ' — Pop: ' + totalPop + '</div>';
            html += '<div class="kingdom-detail-row"><span class="detail-label">📊 Prosperity:</span> ' + prospLevel + '</div>';
            html += '<div class="kingdom-detail-row"><span class="detail-label">⚔️ Military:</span> ' + milLevel + '</div>';
            var hasOpenMarket = specialLaws.some(function(l) { return l.id === 'open_market'; });
            var displayTariff = hasOpenMarket ? 0 : Math.round(((k.laws && k.laws.tradeTariff) || 0) * 100);
            html += '<div class="kingdom-detail-row"><span class="detail-label">💰 Tax Rate:</span> ' + Math.round((k.taxRate || 0.10) * 100) + '%</div>';
            html += '<div class="kingdom-detail-row"><span class="detail-label">📜 Tariff:</span> ' + displayTariff + '%' + (hasOpenMarket ? ' <span style="color:#5a5;font-size:0.85em;">(Open Market)</span>' : '') + '</div>';
            html += bannedHtml;
            if (lawsHtml) html += '<div class="kingdom-detail-row"><span class="detail-label">⚖️ Laws:</span> ' + lawsHtml + '</div>';
            html += '<div class="kingdom-detail-row"><span class="detail-label">🌐 Relations:</span> ' + relHtml + '</div>';
            html += '</div>';
            html += '<button class="btn-medieval btn-kingdom-select" onclick="UI.selectKingdom(\'' + k.id + '\')">Select Kingdom</button>';
            html += '</div>';
        }

        html += '</div>';
        html += '<div style="text-align:center;margin-top:18px;">';
        html += '<button class="btn-medieval" onclick="UI.regenerateWorld()" style="background:linear-gradient(135deg,#5a3a1a,#7a4a2a);font-size:1.1em;padding:10px 28px;">🔄 Regenerate World</button>';
        html += ' <button class="btn-medieval" onclick="UI.backToMainMenu()" style="background:linear-gradient(135deg,#4a2a1a,#6a3a2a);font-size:1.1em;padding:10px 28px;">🏠 Back to Main Menu</button>';
        html += '</div>';
        content.innerHTML = html;
        window._kingdomSelectCallback = onComplete;
    }

    function regenerateWorld() {
        if (typeof Engine !== 'undefined' && Engine.generate) {
            Engine.generate(Math.floor(Math.random() * 999999) + 1);
            showKingdomSelection(window._kingdomSelectCallback);
        }
    }

    function backToMainMenu() {
        // Hide kingdom select screen and return to title screen
        const screen = document.getElementById('kingdomSelectScreen');
        if (screen) { screen.classList.add('hidden'); screen.style.display = 'none'; }
        const titleScreen = document.getElementById('titleScreen');
        if (titleScreen) { titleScreen.classList.remove('hidden'); titleScreen.style.display = 'flex'; }
        window._kingdomSelectCallback = null;
    }

    function selectKingdom(kingdomId) {
        showTownSelection(kingdomId, window._kingdomSelectCallback);
    }

    function showTownSelection(kingdomId, onComplete) {
        const content = document.getElementById('kingdomSelectContent');
        if (!content) return;

        const towns = Engine.getTowns().filter(t => t.kingdomId === kingdomId);
        const kingdom = Engine.getKingdom(kingdomId);
        const roads = Engine.getRoads();
        const seaRoutes = Engine.getSeaRoutes();

        let html = '<h1 class="kingdom-select-title">Choose Your Starting Town</h1>';
        html += '<p class="kingdom-select-subtitle">in ' + (kingdom ? kingdom.name : 'Unknown Kingdom') + '</p>';
        html += '<div class="town-selection-buttons">';
        html += '<button class="btn-medieval btn-back" onclick="UI.showKingdomSelection(window._kingdomSelectCallback)">← Back to Kingdoms</button>';
        html += '<button class="btn-medieval btn-random-town" onclick="UI.randomTown(\'' + kingdomId + '\')">🎲 Random Town</button>';
        html += '</div>';
        html += '<div class="town-cards">';

        for (const town of towns) {
            // Road connections
            const roadConns = roads.filter(r => r.fromTownId === town.id || r.toTownId === town.id);
            const connTowns = roadConns.map(r => {
                const otherId = r.fromTownId === town.id ? r.toTownId : r.fromTownId;
                const other = Engine.findTown(otherId);
                return other ? other.name : 'Unknown';
            });

            // Sea connections
            const seaConns = seaRoutes.filter(r => r.fromTownId === town.id || r.toTownId === town.id);
            const seaConnTowns = seaConns.map(r => {
                const otherId = r.fromTownId === town.id ? r.toTownId : r.fromTownId;
                const other = Engine.findTown(otherId);
                return other ? other.name : 'Unknown';
            });

            // Prosperity level
            let prospLevel = 'Medium';
            if (town.prosperity >= 70) prospLevel = 'High';
            else if (town.prosperity >= 55) prospLevel = 'Good';
            else if (town.prosperity < 35) prospLevel = 'Low';

            // Starting difficulty
            let difficulty = 'Medium', diffClass = 'diff-medium';
            if (town.isIsland) { difficulty = 'Hard 🏝️'; diffClass = 'diff-hard'; }
            else if (connTowns.length <= 1 && town.prosperity < 40) { difficulty = 'Hard'; diffClass = 'diff-hard'; }
            else if (connTowns.length >= 3 && town.prosperity >= 50) { difficulty = 'Easy'; diffClass = 'diff-easy'; }

            // Nearby resources (buildings)
            const buildingNames = (town.buildings || []).map(b => {
                const bt = Engine.findBuildingType(b.type);
                return bt ? bt.name : b.type;
            }).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);

            html += '<div class="town-card">';
            html += '<div class="town-card-header">';
            html += '<span class="town-card-name">' + town.name + '</span>';
            if (town.isPort) html += '<span class="town-port-badge">🚢 Port</span>';
            if (town.isIsland) html += '<span class="town-island-badge">🏝️ Island</span>';
            html += '<span class="town-diff-badge ' + diffClass + '">' + difficulty + '</span>';
            html += '</div>';
            html += '<div class="town-card-body">';
            html += '<div class="town-detail-row">👥 Population: ' + (town.population || 0) + '</div>';
            html += '<div class="town-detail-row">📊 Prosperity: ' + prospLevel + '</div>';
            if (connTowns.length > 0) html += '<div class="town-detail-row">🛤️ Roads: ' + connTowns.join(', ') + '</div>';
            if (seaConnTowns.length > 0) html += '<div class="town-detail-row">⚓ Sea Routes: ' + seaConnTowns.join(', ') + '</div>';
            if (town.isIsland && connTowns.length === 0) html += '<div class="town-detail-row" style="color:#e74c3c;">⚠️ Sea Access Only — costly start!</div>';
            if (buildingNames.length > 0) html += '<div class="town-detail-row">🏗️ Buildings: ' + buildingNames.join(', ') + '</div>';
            html += '</div>';
            html += '<button class="btn-medieval btn-town-select" onclick="UI.selectTown(\'' + town.id + '\')">Start Here</button>';
            html += '</div>';
        }

        html += '</div>';
        content.innerHTML = html;
    }

    function selectTown(townId) {
        // Don't hide screen yet — show start scenario selection first
        window._selectedTownId = townId;
        showStartScenarioSelection(townId);
    }

    function showStartScenarioSelection(townId) {
        const content = document.getElementById('kingdomSelectContent');
        if (!content) return;

        const starts = CONFIG.GAME_STARTS;
        const town = Engine.findTown(townId);
        const townName = town ? town.name : 'Unknown';

        let html = '<h1 class="kingdom-select-title">Choose Your Origin</h1>';
        html += '<p class="kingdom-select-subtitle">Starting in ' + townName + '</p>';
        html += '<div class="town-selection-buttons">';
        html += '<button class="btn-medieval btn-back" onclick="UI.backToTownSelection()">← Back to Towns</button>';
        html += '</div>';
        html += '<div class="start-scenario-grid">';

        for (let i = 0; i < starts.length; i++) {
            const s = starts[i];
            const isUnique = s.difficulty === 'Unique';
            html += '<div class="start-scenario-card" data-start-id="' + s.id + '" onclick="UI.selectStartScenario(\'' + s.id + '\')" style="border-color:' + s.color + '">';
            html += '<div class="start-scenario-header" style="background:' + s.color + ';color:#fff">';
            html += '<span class="start-icon">' + s.icon + '</span>';
            html += '<span class="start-name">' + s.name + '</span>';
            html += '</div>';
            html += '<div class="start-scenario-body">';
            html += '<span class="start-diff-badge" style="background:' + s.color + '">' + s.difficulty + '</span>';
            html += '<p class="start-description">' + s.description + '</p>';
            html += '<div class="start-details">';
            html += '<span>💰 ' + s.startGold + 'g</span>';
            if (s.hasFamily) html += ' <span>👨‍👩‍👧 Family</span>';
            if (s.startHouse) html += ' <span>🏠 House</span>';
            if (s.startBuilding || s.startBuildings) html += ' <span>🏗️ Buildings</span>';
            if (s.startWorkers) html += ' <span>👷 Workers</span>';
            html += '</div>';
            if (isUnique) html += '<div class="start-unique-warning">⚠️ Unique gameplay restrictions apply</div>';
            html += '</div>';
            html += '</div>';
        }

        html += '</div>';

        // Military Leader kingdom-at-war selector (hidden by default)
        html += '<div id="militaryKingdomPicker" style="display:none;margin-top:16px;text-align:center;">';
        html += '<h3 style="color:#e8d5b0;">Choose a Kingdom at War</h3>';
        html += '<div id="militaryKingdomOptions"></div>';
        html += '</div>';

        content.innerHTML = html;
    }

    function selectStartScenario(startId) {
        window._selectedStartId = startId;
        // Highlight selected card
        var cards = document.querySelectorAll('.start-scenario-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].classList.remove('start-selected');
            if (cards[i].getAttribute('data-start-id') === startId) {
                cards[i].classList.add('start-selected');
            }
        }

        // Military Leader: show kingdom-at-war picker
        var milPicker = document.getElementById('militaryKingdomPicker');
        if (startId === 'military') {
            if (milPicker) {
                milPicker.style.display = 'block';
                var kingdoms = Engine.getKingdoms();
                var warKingdoms = kingdoms.filter(function(k) { return k.atWar && k.atWar.length > 0; });
                var optHtml = '';
                if (warKingdoms.length === 0) {
                    optHtml = '<p style="color:#ff8888;">No kingdoms are currently at war. The world will be regenerated with conflict.</p>';
                }
                for (var ki = 0; ki < warKingdoms.length; ki++) {
                    var k = warKingdoms[ki];
                    optHtml += '<button class="btn-medieval" style="margin:4px;background:' + k.color + '" onclick="UI.selectMilitaryKingdom(\'' + k.id + '\')">' + k.name + ' (at war)</button>';
                }
                const milOpts = document.getElementById('militaryKingdomOptions');
                if (milOpts) milOpts.innerHTML = optHtml;
            }
        } else {
            if (milPicker) milPicker.style.display = 'none';
        }

        // Show confirm button
        var existingBtn = document.getElementById('btnConfirmStart');
        if (!existingBtn) {
            var content = document.getElementById('kingdomSelectContent');
            if (content) {
                var btnDiv = document.createElement('div');
                btnDiv.id = 'startConfirmDiv';
                btnDiv.style.textAlign = 'center';
                btnDiv.style.marginTop = '20px';
                btnDiv.innerHTML = '<button id="btnConfirmStart" class="btn-medieval" style="font-size:1.3em;padding:12px 36px;background:linear-gradient(135deg,#8B6914,#DAA520);border:2px solid #FFD700;" onclick="UI.confirmStartScenario()">⚔️ Begin Your Journey ⚔️</button>';
                content.appendChild(btnDiv);
            }
        }
    }

    function selectMilitaryKingdom(kingdomId) {
        window._selectedMilitaryKingdomId = kingdomId;
        var btns = document.querySelectorAll('#militaryKingdomOptions button');
        for (var i = 0; i < btns.length; i++) {
            btns[i].style.border = '';
        }
        event.target.style.border = '3px solid #FFD700';
    }

    function confirmStartScenario() {
        var startId = window._selectedStartId;
        var townId = window._selectedTownId;
        if (!startId) { UI.toast('Please select a start scenario.', 'error'); return; }
        if (!townId) { UI.toast('No town selected.', 'error'); return; }

        var startConfig = CONFIG.GAME_STARTS.find(function(s) { return s.id === startId; });
        if (!startConfig) return;

        // For Military Leader, might need to override town to a kingdom at war
        if (startId === 'military' && window._selectedMilitaryKingdomId) {
            var towns = Engine.getTowns().filter(function(t) { return t.kingdomId === window._selectedMilitaryKingdomId; });
            if (towns.length > 0) {
                townId = towns[0].id;
            }
        }

        // Store startConfig for Player.init
        window._selectedStartConfig = startConfig;

        // Hide the kingdom select screen
        var screen = document.getElementById('kingdomSelectScreen');
        if (screen) {
            screen.classList.add('hidden');
            screen.style.display = 'none';
        }

        // Call the original callback with townId
        if (window._kingdomSelectCallback) {
            window._kingdomSelectCallback(townId);
            window._kingdomSelectCallback = null;
        }

        // Clean up
        delete window._selectedTownId;
        delete window._selectedStartId;
        delete window._selectedMilitaryKingdomId;
    }

    function backToTownSelection() {
        // Need to go back to town selection for the previously selected kingdom
        var townId = window._selectedTownId;
        if (townId) {
            var town = Engine.findTown(townId);
            if (town) {
                showTownSelection(town.kingdomId, window._kingdomSelectCallback);
                return;
            }
        }
        showKingdomSelection(window._kingdomSelectCallback);
    }

    // ── Family Panel ──
    function openFamilyPanel() {
        // Synthesize spouse + children into familyMembers if missing
        var fm = Player.familyMembers || [];
        var existingIds = {};
        for (var ei = 0; ei < fm.length; ei++) existingIds[fm[ei].npcId] = true;

        // Add spouse if not already in familyMembers
        if (Player.state && Player.state.spouseId && !existingIds[Player.state.spouseId]) {
            var sp = Engine.findPerson(Player.state.spouseId);
            if (sp) {
                fm.push({ npcId: Player.state.spouseId, role: 'spouse', name: sp.firstName + ' ' + sp.lastName });
                existingIds[Player.state.spouseId] = true;
            }
        }
        // Add children if not already in familyMembers
        var childIds = (Player.state && Player.state.childrenIds) || [];
        for (var ci = 0; ci < childIds.length; ci++) {
            if (!existingIds[childIds[ci]]) {
                var ch = Engine.findPerson(childIds[ci]);
                if (ch) {
                    fm.push({ npcId: childIds[ci], role: ch.sex === 'M' ? 'son' : 'daughter', name: ch.firstName + ' ' + ch.lastName });
                    existingIds[childIds[ci]] = true;
                }
            }
        }
        // The getter returns the array reference, so pushes above already persist

        if (!fm || fm.length === 0) {
            toast('You have no family.', 'info');
            return;
        }

        // Separate living and deceased family members
        var livingMembers = [];
        var deceasedMembers = [];
        for (var i = 0; i < fm.length; i++) {
            var m = fm[i];
            var person = Engine.findPerson(m.npcId);
            // Handle synthetic deceased IDs (e.g., 'deceased_parent_1')
            var isSyntheticDead = m.npcId && m.npcId.startsWith('deceased_parent_');
            if (isSyntheticDead || (person && !person.alive)) {
                deceasedMembers.push(m);
            } else if (person && person.alive) {
                livingMembers.push(m);
            } else {
                // Person not found — treat as deceased
                deceasedMembers.push(m);
            }
        }

        var html = '<div class="family-panel">';

        // === LIVING FAMILY MEMBERS ===
        if (livingMembers.length > 0) {
            html += '<h4 style="color:#d4af37;margin:0 0 8px 0;font-family:var(--font-display,serif);font-size:0.85rem;">Living Family</h4>';
            for (var li = 0; li < livingMembers.length; li++) {
                var m = livingMembers[li];
                var person = Engine.findPerson(m.npcId);
                if (!person) continue;
                var rel = (Player.relationships[m.npcId] && Player.relationships[m.npcId].level) || 0;
                var roleIcon = m.role === 'father' ? '👨' : (m.role === 'mother' ? '👩' : (m.role === 'brother' ? '👦' : (m.role === 'sister' ? '👧' : (m.role === 'spouse' ? '💍' : (m.role === 'son' ? '👦' : (m.role === 'daughter' ? '👧' : '👤'))))));
                var roleLabel = m.role.charAt(0).toUpperCase() + m.role.slice(1);
                var townObj = Engine.findTown(person.townId);
                var locationName = townObj ? townObj.name : 'Unknown';
                var sameLocation = person.townId === Player.townId;

                html += '<div class="family-member-card">';
                html += '<div class="family-member-header">';
                html += '<span>' + roleIcon + ' ' + m.name + '</span>';
                html += '<span class="family-role-badge">' + roleLabel + '</span>';
                html += '</div>';
                html += '<div class="family-member-body">';
                html += '<div>Age: ' + (person.age || '?') + ' | ' + (person.occupation || 'unemployed') + '</div>';
                html += '<div>💰 ' + formatGold(person.gold || 0) + 'g | 📍 ' + locationName + (sameLocation ? ' <span style="color:#5f5;font-size:0.7rem;">(Here)</span>' : '') + '</div>';
                html += '<div>❤️ Relationship: ' + Math.round(rel) + '/100</div>';

                html += '<div class="family-actions" style="margin-top:6px;">';
                html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'money\',\'' + m.npcId + '\')">💰 Ask Money</button>';
                html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'work\',\'' + m.npcId + '\')">🔨 Ask Work</button>';
                html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'teach\',\'' + m.npcId + '\')">📖 Teach</button>';
                html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'connections\',\'' + m.npcId + '\')">🤝 Connections</button>';
                html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'gift\',\'' + m.npcId + '\')">🎁 Gift</button>';
                html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'invite\',\'' + m.npcId + '\')">🏠 Invite</button>';
                html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'confide\',\'' + m.npcId + '\')">💬 Confide</button>';
                if (m.role === 'brother' || m.role === 'sister') {
                    html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'business\',\'' + m.npcId + '\')">🏪 Business</button>';
                }
                if (m.role === 'spouse' || m.npcId === Player.spouseId) {
                    html += '<button class="btn-action btn-small" style="background:#5a2a5a;" onclick="UI.openSpousePanel()">💍 Spouse Panel</button>';
                }
                html += '</div>';
                html += '</div></div>';
            }
        }

        // === DECEASED FAMILY MEMBERS ===
        if (deceasedMembers.length > 0) {
            html += '<h4 style="color:#888;margin:12px 0 8px 0;font-family:var(--font-display,serif);font-size:0.85rem;border-top:1px solid #444;padding-top:10px;">⚰️ Deceased Family</h4>';
            for (var di = 0; di < deceasedMembers.length; di++) {
                var dm = deceasedMembers[di];
                var dperson = Engine.findPerson(dm.npcId);
                var isSynthetic = dm.npcId && dm.npcId.startsWith('deceased_parent_');
                var roleIcon = dm.role === 'father' ? '👨' : (dm.role === 'mother' ? '👩' : (dm.role === 'brother' ? '👦' : (dm.role === 'sister' ? '👧' : (dm.role === 'spouse' ? '💍' : (dm.role === 'son' ? '👦' : (dm.role === 'daughter' ? '👧' : '👤'))))));
                var dRoleLabel = dm.role.charAt(0).toUpperCase() + dm.role.slice(1);

                html += '<div class="family-member-card" style="opacity:0.6;border-left:3px solid #555;">';
                html += '<div class="family-member-header">';
                html += '<span style="color:#999;">' + roleIcon + ' ' + dm.name + '</span>';
                html += '<span class="family-role-badge" style="background:rgba(100,100,100,0.3);color:#999;">' + dm.role + '</span>';
                html += '</div>';
                html += '<div class="family-member-body">';
                if (dperson && !isSynthetic) {
                    html += '<div style="color:#999;">Died at age ' + (dperson.age || '?') + ' | Was: ' + (dperson.occupation || 'unknown') + '</div>';
                    var dtownObj = Engine.findTown(dperson.townId);
                    html += '<div style="color:#999;">Last known location: ' + (dtownObj ? dtownObj.name : 'Unknown') + '</div>';
                } else {
                    html += '<div style="color:#999;">Passed away | ' + dm.role + ' of the family</div>';
                }
                html += '<div style="color:#ff6666;font-style:italic;margin-top:4px;">☠️ Deceased — Rest in Peace</div>';
                html += '</div></div>';
            }
        }

        html += '<div style="text-align:center;margin-top:10px;">';
        html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'dinner\')">🍽️ Family Dinner</button>';
        html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'celebration\')">🎉 Celebration</button>';
        html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'advice\')">💡 Ask Advice</button>';
        html += '<button class="btn-action btn-small" onclick="UI.familyAction(\'caretake\')">🏡 Caretake</button>';
        html += '</div>';

        // Marriage proposals section
        if (typeof Player !== 'undefined' && Player.getMarriageProposals) {
            var proposals = Player.getMarriageProposals();
            if (proposals.length > 0) {
                html += '<div style="margin-top:12px;padding:10px;border-top:1px solid #555;">';
                html += '<h4 style="color:#ffa0a0;margin:0 0 8px 0;">💍 Marriage Proposals</h4>';
                for (var pi = 0; pi < proposals.length; pi++) {
                    var pr = proposals[pi];
                    html += '<div style="margin-bottom:8px;padding:6px;background:rgba(255,255,255,0.05);border-radius:4px;">';
                    html += '<div style="font-size:0.85rem;color:#ddd;">' + (pr.eliteMerchantName || '?') + ' proposes: ' + (pr.eliteChildName || '?') + ' wed ' + (pr.playerChildName || '?') + '</div>';
                    html += '<button class="btn-action btn-small" onclick="UI.respondToMarriageProposal(\'' + pr.id + '\', true)">✅ Accept</button> ';
                    html += '<button class="btn-action btn-small" style="background:rgba(200,50,50,0.15);" onclick="UI.respondToMarriageProposal(\'' + pr.id + '\', false)">❌ Reject</button>';
                    html += '</div>';
                }
                html += '</div>';
            }
        }

        // Arrange marriages for eligible children
        if (typeof Player !== 'undefined' && Player.childrenIds && Player.getEligibleMarriageCandidates) {
            var eligibleChildren = Player.childrenIds.filter(function(cid) {
                var c = Engine.findPerson(cid);
                return c && c.alive && c.age >= 16 && !c.spouseId;
            });
            if (eligibleChildren.length > 0) {
                html += '<div style="margin-top:12px;padding:10px;border-top:1px solid #555;">';
                html += '<h4 style="color:#d4af37;margin:0 0 8px 0;">💍 Arrange Marriage</h4>';
                for (var ci = 0; ci < eligibleChildren.length; ci++) {
                    var childPerson = Engine.findPerson(eligibleChildren[ci]);
                    if (!childPerson) continue;
                    var candidates = Player.getEligibleMarriageCandidates(eligibleChildren[ci]);
                    if (candidates.length > 0) {
                        html += '<div style="margin-bottom:6px;font-size:0.8rem;">' + childPerson.firstName + ' (' + (childPerson.sex === 'M' ? '♂' : '♀') + ', age ' + childPerson.age + '): ';
                        html += '<select id="marriageTarget_' + ci + '" style="font-size:0.75rem;padding:2px 4px;max-width:140px;">';
                        for (var mi = 0; mi < Math.min(candidates.length, 10); mi++) {
                            html += '<option value="' + candidates[mi].id + '">' + candidates[mi].firstName + ' ' + (candidates[mi].lastName || '') + ' (age ' + candidates[mi].age + ')</option>';
                        }
                        html += '</select> ';
                        html += '<button class="btn-action btn-small" onclick="(function(){ var sel=document.getElementById(\'marriageTarget_' + ci + '\'); if(sel){ var r=Player.arrangeChildMarriage(\'' + eligibleChildren[ci] + '\', sel.value); UI.toast(r.message, r.success?\'success\':\'error\'); if(r.success) UI.openFamilyPanel(); } })()">💒 Arrange</button>';
                        html += '</div>';
                    } else {
                        html += '<div style="margin-bottom:6px;font-size:0.8rem;color:#888;">' + childPerson.firstName + ': No eligible candidates nearby</div>';
                    }
                }
                html += '</div>';
            }
        }

        html += '</div>';

        openModal('👨‍👩‍👧‍👦 Family', html);
    }

    function familyAction(action, npcId) {
        var result;
        switch (action) {
            case 'money': result = Player.askFamilyForMoney(npcId); break;
            case 'work': result = Player.askFamilyToWork(npcId); break;
            case 'dinner': result = Player.familyDinner(); break;
            case 'teach': result = Player.teachFamilyTrade(npcId); break;
            case 'advice': result = Player.askFamilyAdvice(); break;
            case 'connections': result = Player.borrowFamilyConnections(npcId); break;
            case 'celebration': result = Player.familyCelebration(); break;
            case 'gift':
                // Simple gift — give 1 bread if available
                var giftRes = Object.keys(Player.inventory).find(function(r) { return Player.inventory[r] > 0; });
                if (giftRes) {
                    result = Player.giveFamilyGift(npcId, giftRes, 1);
                } else {
                    result = { success: false, message: 'No resources to gift.' };
                }
                break;
            case 'invite': result = Player.inviteFamilyToLive(npcId); break;
            case 'business': result = Player.familyBusiness(npcId); break;
            case 'confide': result = Player.confideInFamily(npcId); break;
            case 'caretake': result = Player.askFamilyToCaretake(); break;
            default: result = { success: false, message: 'Unknown action.' };
        }
        if (result) {
            toast(result.message, result.success ? 'success' : 'error');
            if (result.success) openFamilyPanel(); // Refresh
        }
    }

    // ── Spouse Interaction Panel ──
    function openSpousePanel() {
        var status = Player.getSpouseStatus ? Player.getSpouseStatus() : null;
        if (!status) {
            toast('You have no spouse.', 'info');
            return;
        }

        var html = '<div style="max-height:500px;overflow-y:auto;">';

        // Spouse header
        var condIcon = { healthy: '💚', tired: '😴', sick: '🤒', injured: '🩹', gravely_ill: '☠️' };
        var condColor = { healthy: '#5a5', tired: '#aa5', sick: '#a85', injured: '#a55', gravely_ill: '#f33' };
        html += '<div style="background:#1a2a1a;border:1px solid #3a5a3a;border-radius:6px;padding:12px;margin-bottom:10px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div>';
        html += '<span style="font-size:18px;font-weight:bold;color:#d4af37;">' + (status.sex === 'F' ? '👩' : '👨') + ' ' + status.name + '</span>';
        html += '<div style="color:#aaa;font-size:12px;margin-top:2px;">Age ' + status.age + ' • ' + (condIcon[status.condition] || '❓') + ' ' + status.condition;
        html += ' • ❤️ Relationship: ' + Math.round(status.relationship) + '/100</div>';
        html += '</div>';
        html += '<div style="text-align:right;">';
        html += '<div style="color:#d4af37;font-size:14px;">🪙 ' + formatGold(status.gold || 0) + 'g</div>';
        html += '<div style="font-size:11px;color:#888;">Total earned: ' + formatGold(status.totalEarned || 0) + 'g</div>';
        html += '</div></div>';

        // Health bar
        var hpPct = Math.max(0, Math.min(100, status.health));
        var hpColor = hpPct > 60 ? '#5a5' : hpPct > 30 ? '#aa5' : '#a33';
        html += '<div style="margin-top:8px;">';
        html += '<div style="font-size:11px;color:#888;margin-bottom:2px;">Health: ' + status.health + '/' + (CONFIG.SPOUSE_AI ? CONFIG.SPOUSE_AI.HEALTH_MAX : 100) + '</div>';
        html += '<div style="background:#222;border-radius:3px;height:8px;width:100%;">';
        html += '<div style="background:' + hpColor + ';height:100%;width:' + hpPct + '%;border-radius:3px;transition:width 0.3s;"></div>';
        html += '</div></div>';

        // Current activity
        html += '<div style="margin-top:8px;font-size:12px;color:#ccc;">';
        html += '📋 <strong>Activity:</strong> ' + (status.activityDetail || status.activity || 'Idle');
        if (status.managedBuilding) {
            html += ' | 🏭 Managing: ' + (status.managedBuilding.type || 'building');
        }
        html += '</div>';

        // Personality summary
        var pers = status.personality || {};
        html += '<div style="margin-top:8px;font-size:11px;color:#999;display:flex;flex-wrap:wrap;gap:4px 12px;">';
        var traitNames = ['loyalty', 'ambition', 'frugality', 'intelligence', 'warmth', 'honesty'];
        var traitIcons = { loyalty: '🛡️', ambition: '🔥', frugality: '💰', intelligence: '🧠', warmth: '💛', honesty: '⚖️' };
        for (var ti = 0; ti < traitNames.length; ti++) {
            var tn = traitNames[ti];
            var tv = pers[tn] || 0;
            var tLabel = tv > 70 ? 'High' : tv > 40 ? 'Med' : 'Low';
            html += '<span>' + (traitIcons[tn] || '') + ' ' + tn.charAt(0).toUpperCase() + tn.slice(1) + ': ' + tLabel + ' (' + tv + ')</span>';
        }
        html += '</div>';

        // Quirks
        if (status.quirks && status.quirks.length > 0) {
            html += '<div style="margin-top:6px;font-size:11px;color:#a88;">';
            html += '🎭 Quirks: ' + status.quirks.map(function(q) { return q.replace(/_/g, ' '); }).join(', ');
            html += '</div>';
        }

        html += '</div>'; // end header card

        // === INTERACTIONS ===
        html += '<h4 style="color:#d4af37;margin:10px 0 6px 0;font-size:0.85rem;">💬 Interactions</h4>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';

        // Relationship
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'spend_time\')" style="font-size:12px;padding:6px;">💕 Spend Time Together</button>';
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'give_gold\')" style="font-size:12px;padding:6px;">🪙 Give Gold</button>';

        // Work/Economy
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'ask_work\')" style="font-size:12px;padding:6px;">💼 Ask to Work Jobs</button>';
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'ask_trade\')" style="font-size:12px;padding:6px;">📊 Ask to Trade</button>';
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'ask_money\')" style="font-size:12px;padding:6px;">💰 Ask for Money</button>';
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'ask_intel\')" style="font-size:12px;padding:6px;">🔍 Gather Market Intel</button>';

        // Management
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'ask_manage\')" style="font-size:12px;padding:6px;">🏭 Manage Building</button>';
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'ask_hire\')" style="font-size:12px;padding:6px;">👷 Hire Workers</button>';
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'ask_negotiate\')" style="font-size:12px;padding:6px;">🤝 Negotiate Deal</button>';

        // Movement
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'ask_stay\')" style="font-size:12px;padding:6px;">🏠 Stay in Town</button>';
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'ask_travel\')" style="font-size:12px;padding:6px;">🗺️ Travel to Town</button>';
        html += '<button class="btn-medieval" onclick="UI.spouseInteraction(\'ask_caravan\')" style="font-size:12px;padding:6px;">🐪 Guard Caravan</button>';

        html += '</div>';

        // === RECENT ACTIONS ===
        if (status.recentActions && status.recentActions.length > 0) {
            html += '<h4 style="color:#d4af37;margin:10px 0 6px 0;font-size:0.85rem;">📜 Recent Actions</h4>';
            html += '<div style="background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:6px;max-height:120px;overflow-y:auto;">';
            for (var ra = status.recentActions.length - 1; ra >= 0; ra--) {
                var act = status.recentActions[ra];
                var goldStr = act.gold > 0 ? ' (+' + Math.floor(act.gold) + 'g)' : act.gold < 0 ? ' (' + Math.floor(act.gold) + 'g)' : '';
                html += '<div style="font-size:11px;color:#aaa;padding:2px 0;border-bottom:1px solid #222;">';
                html += 'Day ' + act.day + ': ' + act.detail + '<span style="color:' + (act.gold >= 0 ? '#5a5' : '#a55') + ';">' + goldStr + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '</div>'; // end main container
        openModal('💍 Spouse — ' + status.name, html);
    }

    function spouseInteraction(action) {
        var result;
        switch (action) {
            case 'spend_time':
                result = Player.spouseSpendTime ? Player.spouseSpendTime() : { success: false, message: 'Not available.' };
                break;
            case 'give_gold':
                var giveAmt = prompt('How much gold to give your spouse?', '50');
                if (!giveAmt || isNaN(parseInt(giveAmt))) return;
                result = Player.giveSpouseGold ? Player.giveSpouseGold(parseInt(giveAmt)) : { success: false, message: 'Not available.' };
                break;
            case 'ask_work':
                result = Player.askSpouseToWork ? Player.askSpouseToWork() : { success: false, message: 'Not available.' };
                break;
            case 'ask_trade':
                // Show town picker
                var towns = Engine.getWorld ? Engine.getWorld().towns : [];
                if (!towns || towns.length === 0) { toast('No towns available.', 'error'); return; }
                var townList = towns.map(function(t) { return t.name; }).join(', ');
                var townName = prompt('Which town should your spouse trade in?\n\nAvailable: ' + townList);
                if (!townName) return;
                var targetTown = towns.find(function(t) { return t.name.toLowerCase() === townName.toLowerCase(); });
                if (!targetTown) { toast('Town not found: ' + townName, 'error'); return; }
                result = Player.askSpouseToTrade ? Player.askSpouseToTrade(targetTown.id) : { success: false, message: 'Not available.' };
                break;
            case 'ask_money':
                var askAmt = prompt('How much gold to ask for?', 'all');
                if (!askAmt) return;
                var amt = askAmt.toLowerCase() === 'all' ? 999999 : parseInt(askAmt);
                if (isNaN(amt)) return;
                result = Player.askSpouseForMoney ? Player.askSpouseForMoney(amt) : { success: false, message: 'Not available.' };
                break;
            case 'ask_intel':
                result = Player.askSpouseToGatherIntel ? Player.askSpouseToGatherIntel() : { success: false, message: 'Not available.' };
                break;
            case 'ask_manage':
                if (!Player.buildings || Player.buildings.length === 0) { toast('You have no buildings.', 'error'); return; }
                var bldgList = Player.buildings.map(function(b, idx) { return idx + ': ' + (b.type || 'building') + ' (' + (Engine.findTown(b.townId) ? Engine.findTown(b.townId).name : '?') + ')'; }).join('\n');
                var bIdx = prompt('Which building should your spouse manage?\n\n' + bldgList + '\n\nEnter number (or -1 to unassign):');
                if (bIdx === null) return;
                result = Player.askSpouseToManage ? Player.askSpouseToManage(parseInt(bIdx)) : { success: false, message: 'Not available.' };
                break;
            case 'ask_hire':
                result = Player.askSpouseToHireWorkers ? Player.askSpouseToHireWorkers() : { success: false, message: 'Not available.' };
                break;
            case 'ask_negotiate':
                // For now, negotiate with a merchant in current town
                var people = Engine.getPeople ? Engine.getPeople(Player.townId) : [];
                var merchants = people.filter(function(p) { return p.occupation === 'merchant' && p.alive; });
                if (merchants.length === 0) { toast('No merchants in town to negotiate with.', 'error'); return; }
                var mList = merchants.map(function(m) { return (m.firstName || 'Unknown') + ' ' + (m.lastName || ''); }).join(', ');
                var mName = prompt('Which merchant should your spouse negotiate with?\n\n' + mList);
                if (!mName) return;
                var target = merchants.find(function(m) { return ((m.firstName || 'Unknown') + ' ' + (m.lastName || '')).toLowerCase() === mName.toLowerCase(); });
                if (!target) { toast('Merchant not found.', 'error'); return; }
                result = Player.askSpouseToNegotiate ? Player.askSpouseToNegotiate(target.id) : { success: false, message: 'Not available.' };
                break;
            case 'ask_stay':
                result = Player.askSpouseToStay ? Player.askSpouseToStay(Player.townId) : { success: false, message: 'Not available.' };
                break;
            case 'ask_travel':
                var towns2 = Engine.getWorld ? Engine.getWorld().towns : [];
                if (!towns2 || towns2.length === 0) { toast('No towns available.', 'error'); return; }
                var townList2 = towns2.map(function(t) { return t.name; }).join(', ');
                var townName2 = prompt('Which town should your spouse travel to?\n\n' + townList2);
                if (!townName2) return;
                var targetTown2 = towns2.find(function(t) { return t.name.toLowerCase() === townName2.toLowerCase(); });
                if (!targetTown2) { toast('Town not found.', 'error'); return; }
                result = Player.askSpouseToTravel ? Player.askSpouseToTravel(targetTown2.id) : { success: false, message: 'Not available.' };
                break;
            case 'ask_caravan':
                if (!Player.caravans || Player.caravans.length === 0) { toast('You have no active caravans.', 'error'); return; }
                var cIdx = prompt('Which caravan should your spouse guard? (0-' + (Player.caravans.length - 1) + ')');
                if (cIdx === null || isNaN(parseInt(cIdx))) return;
                result = Player.askSpouseToGuardCaravan ? Player.askSpouseToGuardCaravan(parseInt(cIdx)) : { success: false, message: 'Not available.' };
                break;
            default:
                result = { success: false, message: 'Unknown action.' };
        }
        if (result) {
            toast(result.message, result.success ? 'success' : (result.accepted === false ? 'warning' : 'error'));
            openSpousePanel(); // Refresh
        }
    }

    // ── Special Start Actions Panel ──
    function openSpecialStartPanel() {
        var status = Player.getSpecialStartStatus();
        if (!status) { toast('No active special start.', 'info'); return; }

        var html = '<div class="special-start-panel">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div class="special-status-header">' + status.icon + ' ' + status.label + '</div>';
        html += '<button class="btn-action" onclick="UI.openStartJournal()" style="font-size:0.85em;background:#2a3a5a;">📓 Journal</button>';
        html += '</div>';
        html += '<div class="special-status-info">' + status.info + '</div>';
        html += '<hr style="border-color:#5a3a1a;margin:10px 0;">';

        var townId = Player.townId;

        if (status.type === 'pilgrim') {
            html += '<h3>Pilgrim Actions</h3>';
            var pil = Player.state.pilgrim || {};
            html += '<button class="btn-action" onclick="UI.specialAction(\'sermon\')">🙏 Give Sermon</button>';
            html += '<button class="btn-action" onclick="UI.specialAction(\'visitSite\')">⛪ Visit Holy Site</button>';
            html += '<button class="btn-action" onclick="UI.specialAction(\'convert\')">✝️ Convert NPC</button>';
            html += '<button class="btn-action" onclick="UI.specialAction(\'bless\')">🙌 Bless NPC</button>';
            if (!pil.templeBuilt && pil.followers >= 20) {
                html += '<button class="btn-action" onclick="UI.specialAction(\'buildTemple\')" style="background:#553322;">🏛️ Build Temple (500g)</button>';
            }
            if (pil.rivalFaith && !pil.rivalDefeated && pil.rivalFaith.townId === Player.state.currentTownId) {
                html += '<button class="btn-action" onclick="UI.specialAction(\'challengeRival\')" style="background:#882222;">⚡ Challenge ' + (pil.rivalFaith.preacherName || 'Rival') + '</button>';
            }
            html += '<p>Goals (complete any 2): ' + (pil.goals || []).map(function(g) {
                var done = false;
                if (g === 'visit_all_sites') done = (pil.visitedSites || []).length >= (pil.holySites || []).length;
                else if (g === 'convert_50_followers') done = pil.followers >= 50;
                else if (g === 'build_temple') done = pil.templeBuilt;
                var labels = { visit_all_sites: 'Visit All Sites', convert_50_followers: '50 Followers', build_temple: 'Build Temple' };
                return (done ? '✅ ' : '⬜ ') + (labels[g] || g);
            }).join(', ') + '</p>';
            var sermonSkill = Math.min(100, (pil.sermonsGiven || 0) * 2);
            html += '<p>Sermon Skill: ' + sermonSkill + '% | Followers: ' + (pil.followers || 0) + ' | Sites: ' + (pil.visitedSites || []).length + '/' + (pil.holySites || []).length + '</p>';
            if (pil.rivalFaith && !pil.rivalDefeated) {
                var rivalTown = Engine.findTown ? Engine.findTown(pil.rivalFaith.townId) : null;
                html += '<p style="color:#cc4444;">⚡ Rival: ' + pil.rivalFaith.name + ' (' + pil.rivalFaith.preacherName + ') — ' + pil.rivalFaith.followers + ' followers, Str: ' + pil.rivalFaith.strength + (rivalTown ? ', in ' + rivalTown.name : '') + '</p>';
            }
            if (pil.rivalDefeated) {
                html += '<p style="color:#55aa55;">🏆 Rival faith defeated!</p>';
            }
        }
        if (status.type === 'shipwrecked') {
            html += '<h3>Foreigner Actions</h3>';
            var sw = Player.state.shipwrecked || {};
            html += '<button class="btn-action" onclick="UI.specialAction(\'story\')">📖 Tell Story</button>';
            html += '<button class="btn-action" onclick="UI.specialAction(\'craft\')">🔧 Teach Craft</button>';
            // Resonance site
            if (sw.artifactPulsing) {
                html += '<button class="btn-action" onclick="UI.specialAction(\'resonance\')" style="background:#553388;animation:pulse 2s infinite;">✨ Visit Resonance Site</button>';
            }
            // Final choice
            if (sw.finalChoiceAvailable && !sw.finalChoice) {
                html += '<div style="margin:8px 0;padding:8px;background:rgba(255,215,0,0.15);border:1px solid gold;border-radius:6px;">';
                html += '<strong style="color:gold;">🌟 THE FINAL CHOICE</strong><br>';
                html += '<p style="color:#ccc;font-size:0.9em;">All sea chart fragments assembled. The artifact awaits your decision.</p>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'openArtifact\')" style="background:#336633;margin:4px;">🏛️ OPEN — Found Embassy</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'sealArtifact\')" style="background:#663333;margin:4px;">⚡ SEAL — Absorb Power</button>';
                html += '</div>';
            }
            // Embassy actions
            if (sw.embassy) {
                html += '<hr style="border-color:#555;margin:8px 0;">';
                html += '<h4 style="color:#55aacc;">🏛️ Embassy in ' + sw.embassy.townName + '</h4>';
                html += '<p>Bank: ' + (Player.state.shipwrecked.embassyBankAccount || 0) + 'g | Potions: R:' + (sw.embassy.potionStockRed || 0) + ' G:' + (sw.embassy.potionStockGreen || 0) + ' B:' + (sw.embassy.potionStockBlue || 0) + '</p>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'warpEmbassy\')" style="background:#224488;">🌀 Warp to Embassy</button>';
                html += '<div style="margin:4px 0;"><strong>Free Potion (monthly):</strong></div>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'potionRed\')" style="background:#882222;font-size:0.85em;">❤️ Red (Strength)</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'potionGreen\')" style="background:#228822;font-size:0.85em;">💚 Green (Speed)</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'potionBlue\')" style="background:#222288;font-size:0.85em;">💙 Blue (Immunity)</button>';
                // Homeland NPCs
                if (sw.homelandNPCs && sw.homelandNPCs.length > 0 && Player.townId === sw.embassy.townId) {
                    html += '<div style="margin:6px 0;"><strong>Homeland NPCs:</strong></div>';
                    for (var hi = 0; hi < sw.homelandNPCs.length; hi++) {
                        var hnpc = sw.homelandNPCs[hi];
                        var roleIcons = { healer: '💚', merchant: '💰', guard: '⚔️', scholar: '📚', worker: '🔧' };
                        html += '<button class="btn-action" onclick="UI.specialAction(\'homeland_' + hi + '\')" style="font-size:0.85em;">' + (roleIcons[hnpc.role] || '👤') + ' ' + hnpc.first + ' (' + hnpc.role + ')</button>';
                    }
                }
                if (sw.freePotion && sw.freePotion.expiresDay > (Engine.getDay ? Engine.getDay() : 0)) {
                    var potionLabels = { red: '❤️ Crimson Vigor', green: '💚 Emerald Swiftness', blue: '💙 Azure Ward' };
                    var daysLeft = sw.freePotion.expiresDay - Engine.getDay();
                    html += '<p style="color:#88ccff;">Active potion: ' + (potionLabels[sw.freePotion.type] || sw.freePotion.type) + ' (' + daysLeft + ' days left)</p>';
                }
            }
            // Seal bonuses display
            if (sw.sealBonuses && sw.finalChoice === 'seal') {
                html += '<hr style="border-color:#555;margin:8px 0;">';
                html += '<h4 style="color:#cc88ff;">⚡ Artifact Power (Sealed)</h4>';
                if (sw.sealBonuses.speedBonus > 0) {
                    html += '<p style="color:#aaa;">+25% speed | +25% rep gains | -25% disease/death | +10yr lifespan</p>';
                } else {
                    html += '<p style="color:#888;">Power spent from death reversal. Only skills remain.</p>';
                }
                if (sw.deathReversalAvailable && !sw.deathReversalUsed) {
                    html += '<p style="color:gold;">💫 Death Reversal: Available (one use)</p>';
                }
            }
            // Progress info
            html += '<p>Language: ' + (sw.languageSkill || 0) + '% | Sites: ' + (sw.resonanceSitesVisited || 0) + '/5 | Charts: ' + (sw.seaChartFragments || 0) + '/5</p>';
            // Show resonance site locations
            if (sw.resonanceSites) {
                var unvisited = sw.resonanceSites.filter(function(s) { return !s.visited; });
                if (unvisited.length > 0 && (sw.languageSkill || 0) >= 20) {
                    html += '<p style="color:#8888cc;font-size:0.85em;">Resonance sites: ' + unvisited.map(function(s) {
                        var sTown = Engine.findTown ? Engine.findTown(s.townId) : null;
                        return s.name + ' (' + (sTown ? sTown.name : '?') + ')';
                    }).join(', ') + '</p>';
                }
            }
        }
        if (status.type === 'musician') {
            html += '<h3>Musician Actions</h3>';
            var mus = Player.state.musician || {};
            if (mus.active || mus.legacyChoice === 'legendary_bard') {
                html += '<button class="btn-action" onclick="UI.specialAction(\'tavern\')">🎵 Tavern</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'street\')">🎶 Street</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'concert\')">🎪 Concert</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'court\')">👑 Court</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'private\')">🎻 Private</button>';
                html += '<div style="margin:4px 0;">';
                html += '<strong>Compose:</strong> ';
                html += '<button class="btn-action" onclick="UI.specialAction(\'compose_love\')" style="font-size:0.85em;">❤️ Love</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'compose_war\')" style="font-size:0.85em;">⚔️ War</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'compose_comedy\')" style="font-size:0.85em;">😂 Comedy</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'compose_epic\')" style="font-size:0.85em;">⭐ Epic</button>';
                html += '</div>';
                if ((mus.musicSkill || 0) >= 70) {
                    html += '<button class="btn-action" onclick="UI.specialAction(\'grandConcert\')" style="background:#553388;">🌟 Grand Concert (200g)</button>';
                }
            }
            // Rival duels
            if (mus.rivals) {
                for (var ri3 = 0; ri3 < mus.rivals.length; ri3++) {
                    var rv = mus.rivals[ri3];
                    if (!rv.defeated && rv.townId === Player.state.currentTownId) {
                        html += '<button class="btn-action" onclick="UI.specialAction(\'duel_' + ri3 + '\')" style="background:#882222;">🎭 Duel ' + rv.name + ' (Skill:' + rv.skill + ')</button>';
                    }
                }
            }
            // Legacy choice
            if (mus.legacyOffered && !mus.legacyChoice) {
                html += '<div style="margin:6px 0;padding:6px;background:rgba(255,215,0,0.15);border-radius:4px;">';
                html += '<strong>🌟 Legacy Choice:</strong><br>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'legacy_school\')" style="background:#336633;">🏫 Music School</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'legacy_bard\')" style="background:#663366;">🌟 Legendary Bard</button>';
                html += '</div>';
            }
            // Status info
            html += '<p>Skill: ' + (mus.musicSkill || 0) + '/100 | Fans: ' + Object.keys(mus.fans || {}).length + ' | Songs: ' + (mus.songsComposed || []).length + ' | Duels: ' + (mus.duelsWon || 0) + 'W/' + (mus.duelsLost || 0) + 'L</p>';
            if (mus.legacyChoice === 'music_school') {
                html += '<p style="color:#55aa55;">🏫 Music School income: ' + (mus.musicSchoolIncome || 0) + 'g total</p>';
            }
            if (mus.legacyChoice === 'legendary_bard') {
                html += '<p style="color:#aa55ff;">🌟 Legendary Bard — +50% income, universal court access</p>';
            }
            // Show rivals
            if (mus.rivals) {
                var activeRivals = mus.rivals.filter(function(r) { return !r.defeated; });
                if (activeRivals.length > 0) {
                    html += '<p style="color:#cc8844;">Rivals: ' + activeRivals.map(function(r) {
                        var rTown = Engine.findTown ? Engine.findTown(r.townId) : null;
                        return r.name + ' (Skill:' + r.skill + ', ' + (rTown ? rTown.name : '?') + ')';
                    }).join(', ') + '</p>';
                }
            }
        }
        if (status.type === 'military') {
            html += '<h3>Military Actions</h3>';
            var mil = Player.state.militaryLeader || {};
            html += '<button class="btn-action" onclick="UI.specialAction(\'train\')">⚔️ Train Troops</button>';
            html += '<button class="btn-action" onclick="UI.specialAction(\'plan\')">📋 Plan Battle</button>';
            html += '<button class="btn-action" onclick="UI.specialAction(\'inspire\')">📣 Inspire Army</button>';
            html += '<button class="btn-action" onclick="UI.specialAction(\'fortify\')">🏰 Fortify (100g)</button>';
            html += '<button class="btn-action" onclick="UI.specialAction(\'scout\')">🔭 Scout Enemy</button>';
            // Battle actions
            var milRanksArr = (typeof CONFIG !== 'undefined' && CONFIG.MILITARY_LEADER_RANKS) || [];
            var milRankIdxUI = milRanksArr.findIndex(function(r) { return r.id === mil.rank; });
            html += '<div style="margin:4px 0;">';
            html += '<strong>Battle Tactics:</strong> ';
            html += '<button class="btn-action" onclick="UI.specialAction(\'battle_aggressive\')" style="background:#882222;font-size:0.85em;">🗡️ Aggressive</button>';
            html += '<button class="btn-action" onclick="UI.specialAction(\'battle_defensive\')" style="background:#224488;font-size:0.85em;">🛡️ Defensive</button>';
            html += '<button class="btn-action" onclick="UI.specialAction(\'battle_flanking\')" style="background:#886622;font-size:0.85em;">🏇 Flanking</button>';
            html += '</div>';
            // War council (captain+)
            if (mil.warCouncilAccess || milRankIdxUI >= 4) {
                html += '<button class="btn-action" onclick="UI.specialAction(\'warCouncil\')" style="background:#553388;">📜 War Council</button>';
            }
            // Decisive battle (general + 10 victories)
            if (mil.decisiveBattleAvailable && !mil.heroOfAgesEarned) {
                html += '<button class="btn-action" onclick="UI.specialAction(\'decisiveBattle\')" style="background:#aa6600;font-size:1.1em;">⚔️👑 DECISIVE BATTLE</button>';
            }
            // Status display
            var milRankName = milRanksArr[milRankIdxUI] ? milRanksArr[milRankIdxUI].name : mil.rank;
            html += '<p>Rank: ' + milRankName + ' | Trainings: ' + (mil.trainingsDone || 0) + ' | Battles: ' + (mil.battlesAsLeader || 0) + ' | Victories: ' + (mil.victoriesAsLeader || 0) + '</p>';
            if (mil.heroOfAgesEarned) {
                html += '<p style="color:gold;font-weight:bold;">👑 HERO OF THE AGES</p>';
            }
            if (mil.warCouncilDecisions) {
                html += '<p>Council decisions: ' + mil.warCouncilDecisions + '</p>';
            }
        }
        if (status.type === 'scholar') {
            html += '<h3>Scholar Actions</h3>';
            var sch = Player.state.scholar || {};
            if (!sch.specialization && sch.active) {
                html += '<div style="margin-bottom:8px;padding:6px;background:rgba(136,136,255,0.15);border-radius:4px;">';
                html += '<strong>Choose Your Specialization:</strong><br>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'specHistory\')" style="background:#665533;">📜 History</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'specEconomics\')" style="background:#336655;">💰 Economics</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'specScience\')" style="background:#335566;">🔬 Natural Science</button>';
                html += '</div>';
            } else if (sch.specialization) {
                var specLabels = { history: '📜 History', economics: '💰 Economics', natural_science: '🔬 Natural Science' };
                html += '<p style="color:#8888ff;">Specialization: ' + (specLabels[sch.specialization] || sch.specialization) + '</p>';
            }
            if (sch.active) {
                html += '<button class="btn-action" onclick="UI.specialAction(\'study\')">📚 Study Town</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'library\')">📖 Study Library</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'learn\')">🎓 Learn from NPC</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'notes\')">✏️ Write Notes</button>';
                html += '<button class="btn-action" onclick="UI.specialAction(\'book\')">📕 Write Great Book</button>';
            }
            if (sch.royaltiesActive) {
                html += '<p style="color:#c4a35a;">📖 Great Book royalties: ~' + Math.min(100, 20 + Math.floor((sch.specializationKnowledge || 0) / 10)) + 'g/week | Total earned: ' + (sch.totalRoyaltiesEarned || 0) + 'g</p>';
            }
        }
        if (status.type === 'indentured') {
            var ind = Player.indentured;
            if (ind) {
                var escapeInfo = {
                    'pay_debt':             { name: '💰 Pay Your Debt',              desc: 'Pay off remaining debt to master. Requirement: Have enough gold.', risk: 'None' },
                    'earn_freedom':         { name: '🤝 Earn Freedom Through Service', desc: 'Work off your debt over time. Passive, debt reduces.', risk: 'None' },
                    'military_enlist':      { name: '⚔️ Military Enlistment',         desc: 'Join the army. 60% success. Risk: +180 days if caught.', risk: 'Medium' },
                    'legal_challenge':      { name: '⚖️ Legal Challenge',             desc: 'Challenge contract in court. Cost: 100g. Success based on reputation.', risk: 'Low' },
                    'impress_noble':        { name: '👑 Impress a Noble',             desc: 'Catch a noble\'s attention. Success based on reputation.', risk: 'Low' },
                    'steal_contract':       { name: '📜 Steal Your Contract',         desc: 'Steal and destroy the contract. Risk: +1 year if caught.', risk: 'High' },
                    'run_away':             { name: '🏃 Run Away',                    desc: 'Flee into the night. 40% success. Risk: +1 year and notoriety.', risk: 'High' },
                    'religious_sanctuary':  { name: '🙏 Religious Sanctuary',         desc: 'Seek temple protection. Cost: 50g, need 15+ rep.', risk: 'Low' },
                    'blackmail_master':     { name: '🤫 Blackmail Your Master',       desc: 'Use dirt on master. 45% success. Risk: +540 days.', risk: 'High' },
                    'frame_master':         { name: '🚔 Frame Your Master',           desc: 'Plant evidence. Cost: 50g. 35% success. Risk: +2 years.', risk: 'Very High' },
                    'poison_master':        { name: '☠️ Poison Your Master',          desc: 'Dark path. Cost: 30g. 40% success. Risk: +1 year.', risk: 'Very High' },
                    'bribe_officials':      { name: '💰 Bribe Officials',             desc: 'Pay to lose records. Cost: 200g+. 55% success.', risk: 'Medium' },
                    'win_tournament':       { name: '🏆 Win a Tournament',            desc: 'Win freedom as prize. Combat skill helps. Risk: injury.', risk: 'Medium' },
                    'marry_up':             { name: '💕 Marry Into Freedom',          desc: 'Find love. Need relationship 70+. 50%+ success.', risk: 'Low' },
                    'master_dies':          { name: '💀 Wait for Master\'s Death',    desc: 'Passive. No action needed.', risk: 'None' }
                };
                var riskColors = { 'None': '#8ec07c', 'Low': '#b8bb26', 'Medium': '#fabd2f', 'High': '#fe8019', 'Very High': '#fb4934' };

                var iDay = Engine.getDay();
                var daysLeft = Math.max(0, ind.contractDays - (iDay - (ind.startDay || 0)));
                var debtLeft = ind.debtRemaining || 0;

                html += '<h3>⛓️ Indentured Servant</h3>';
                html += '<p style="font-size:14px;"><strong>Days Remaining:</strong> ' + daysLeft + ' | <strong>Debt:</strong> ' + debtLeft + 'g</p>';

                // Pay down debt section
                if (debtLeft > 0) {
                    var pGold = Math.floor(Player.gold || 0);
                    html += '<div style="background:rgba(0,0,0,0.3);padding:8px;border-radius:6px;margin:5px 0;">';
                    html += '<span style="color:#ccc;">💰 Pay down debt (You have ' + pGold + 'g)</span><br>';
                    html += '<div style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap;">';
                    var payAmounts = [10, 50, 100];
                    for (var pi = 0; pi < payAmounts.length; pi++) {
                        var pa = payAmounts[pi];
                        var canPay = pGold >= pa && debtLeft >= pa;
                        html += '<button class="btn-action" onclick="UI.payDebt(' + Math.min(pa, debtLeft) + ')" style="background:' + (canPay ? '#2d5a27' : '#333') + ';padding:4px 8px;font-size:12px;"' + (canPay ? '' : ' disabled') + '>' + pa + 'g</button>';
                    }
                    if (pGold > 0) {
                        var allPay = Math.min(pGold, debtLeft);
                        html += '<button class="btn-action" onclick="UI.payDebt(' + allPay + ')" style="background:#5a4a27;padding:4px 8px;font-size:12px;">All (' + allPay + 'g)</button>';
                    }
                    html += '</div></div>';
                }

                // Master info
                if (ind.masterId) {
                    var iMaster = Engine.findPerson(ind.masterId);
                    if (iMaster && iMaster.alive) {
                        var masterTown = Engine.findTown(iMaster.townId);
                        var masterTownName = masterTown ? masterTown.name : 'Unknown';
                        html += '<p><strong>Master:</strong> ' + iMaster.firstName + ' ' + iMaster.lastName + ' — ' + masterTownName + ' — ' + Math.floor(iMaster.gold || 0) + 'g</p>';
                    } else {
                        html += '<p><strong>Master:</strong> <em>Deceased</em></p>';
                    }
                }

            // Master Task Section
            html += '<hr style="border-color:#555;margin:10px 0;">';
            html += '<h4 style="margin:8px 0 4px;">📋 Current Task</h4>';
            if (ind && ind.currentTask) {
                var task = ind.currentTask;
                var currentDay = Engine.getDay ? Engine.getDay() : 0;
                var daysLeft = task.deadlineDay - currentDay;
                var urgencyColor = daysLeft <= 2 ? '#ff4444' : daysLeft <= 5 ? '#ffaa00' : '#88cc88';
                html += '<div style="background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;margin:5px 0;border-left:3px solid ' + urgencyColor + ';">';
                html += '<strong>' + task.name + '</strong><br>';
                html += '<span style="color:#ccc;">' + task.description + '</span><br>';
                if (task.targetTownName) html += '<span>📍 Destination: ' + task.targetTownName + '</span><br>';
                html += '<span style="color:' + urgencyColor + ';">⏰ ' + (daysLeft > 0 ? daysLeft + ' days remaining' : '⚠️ OVERDUE!') + '</span><br>';
                html += '<span style="color:#aaa;">Reward: ' + task.reward.gold + 'g + ' + task.reward.debtReduction + 'g debt reduction + ' + task.reward.xp + ' XP</span>';
                html += '<div style="margin-top:8px;">';
                html += '<button class="btn-action" onclick="UI.completeMasterTask()" style="background:#2d5a27;margin-right:5px;">✅ Complete Task</button>';
                html += '<button class="btn-action" onclick="UI.dismissMasterTask()" style="background:#5a2727;">❌ Dismiss</button>';
                html += '</div></div>';
            } else {
                html += '<p style="color:#888;">No active task. Your master will assign one soon.</p>';
            }
            // Task stats
            if (ind) {
                html += '<div style="margin-top:5px;font-size:0.85em;color:#aaa;">';
                html += '✅ Completed: ' + (ind.totalTasksCompleted || 0);
                html += ' | ❌ Failed: ' + (ind.totalTasksFailed || 0);
                if (ind.consecutiveFailures > 0) html += ' | ⚠️ Streak: ' + ind.consecutiveFailures;
                html += '</div>';
                // Master relationship bar
                var rel = ind.masterRelationship || 50;
                var relColor = rel > 70 ? '#4CAF50' : rel > 40 ? '#FFC107' : '#f44336';
                html += '<div style="margin-top:5px;">';
                html += '<span style="font-size:0.85em;">Master Relationship: </span>';
                html += '<div style="display:inline-block;width:100px;height:8px;background:#333;border-radius:4px;vertical-align:middle;">';
                html += '<div style="width:' + rel + '%;height:100%;background:' + relColor + ';border-radius:4px;"></div>';
                html += '</div>';
                html += '<span style="font-size:0.85em;color:' + relColor + ';"> ' + rel + '</span>';
                html += '</div>';
                // Master mood display
                var moodData = { 'kind': '😊 Kind', 'neutral': '😐 Neutral', 'cruel': '😡 Cruel', 'generous': '💰 Generous', 'suspicious': '👁️ Suspicious' };
                var currentMood = ind.masterMood || 'neutral';
                var moodLabel = moodData[currentMood] || '😐 Neutral';
                html += '<div style="margin-top:4px;">';
                html += '<span style="font-size:0.85em;">Master Mood: <strong>' + moodLabel + '</strong></span>';
                html += '</div>';
            }

                html += '<hr style="border-color:#555;margin:10px 0;">';

                // Early release offer
                if (ind.earlyReleaseOffered) {
                    var releaseCost = Math.floor((ind.debtRemaining || 0) * 0.3);
                    var canAfford = Math.floor(Player.gold || 0) >= releaseCost;
                    html += '<div style="background:rgba(45,90,39,0.3);border:1px solid #4CAF50;border-radius:6px;padding:10px;margin:5px 0;">';
                    html += '<strong style="color:#8ec07c;">💝 Early Release Offered!</strong><br>';
                    html += '<span style="color:#ccc;">Your master is willing to release you for <strong>' + releaseCost + 'g</strong>.</span><br>';
                    html += '<button class="btn-action" onclick="UI.specialAction(\'acceptEarlyRelease\')" style="background:' + (canAfford ? '#2d5a27' : '#333') + ';margin-top:5px;"' + (canAfford ? '' : ' disabled') + '>🤝 Accept Early Release (' + releaseCost + 'g)</button>';
                    if (!canAfford) html += '<br><span style="font-size:11px;color:#f44336;">You need ' + releaseCost + 'g (have ' + Math.floor(Player.gold || 0) + 'g)</span>';
                    html += '</div>';
                }

                var available = ind.availableEscapes || [];
                var discovered = ind.discoveredEscapes || [];

                // Discovered escape methods
                var discoveredList = [];
                var undiscoveredList = [];
                for (var ei = 0; ei < available.length; ei++) {
                    if (discovered.indexOf(available[ei]) >= 0) {
                        discoveredList.push(available[ei]);
                    } else {
                        undiscoveredList.push(available[ei]);
                    }
                }

                html += '<h4 style="margin:8px 0 4px;">🔓 Discovered Escape Methods (' + discoveredList.length + '/' + available.length + ')</h4>';
                if (discoveredList.length === 0) {
                    html += '<p style="color:#888;font-style:italic;">No escape methods discovered yet. Keep exploring and building skills.</p>';
                } else {
                    for (var di = 0; di < discoveredList.length; di++) {
                        var eid = discoveredList[di];
                        var info = escapeInfo[eid] || { name: eid, desc: '', risk: '?' };
                        var rColor = riskColors[info.risk] || '#aaa';
                        html += '<div style="background:#1a1a2e;border:1px solid #333;border-radius:6px;padding:8px 10px;margin:6px 0;">';
                        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                        html += '<strong style="font-size:13px;">' + info.name + '</strong>';
                        html += '<span style="font-size:11px;color:' + rColor + ';border:1px solid ' + rColor + ';border-radius:4px;padding:1px 6px;">Risk: ' + info.risk + '</span>';
                        html += '</div>';
                        html += '<p style="font-size:12px;color:#bbb;margin:4px 0;">' + info.desc + '</p>';
                        if (eid !== 'master_dies') {
                            html += '<button class="btn-action" style="font-size:11px;margin-top:4px;" onclick="UI.attemptIndenturedEscape(\'' + eid + '\')">⚡ Attempt</button>';
                        } else {
                            html += '<span style="font-size:11px;color:#888;font-style:italic;">Passive — wait for fate</span>';
                        }
                        html += '</div>';
                    }
                }

                html += '<hr style="border-color:#555;margin:10px 0;">';

                // Undiscovered hints
                html += '<h4 style="margin:8px 0 4px;">🔒 Undiscovered (' + undiscoveredList.length + ')</h4>';
                if (undiscoveredList.length === 0) {
                    html += '<p style="color:#8ec07c;">All available escape methods discovered!</p>';
                } else {
                    var pool = CONFIG.INDENTURED_ESCAPE_POOL || [];
                    for (var ui2 = 0; ui2 < undiscoveredList.length; ui2++) {
                        var uid = undiscoveredList[ui2];
                        var hintText = '???';
                        for (var pi = 0; pi < pool.length; pi++) {
                            if (pool[pi].id === uid) { hintText = pool[pi].hint; break; }
                        }
                        html += '<div style="background:#111;border:1px solid #222;border-radius:6px;padding:6px 10px;margin:4px 0;opacity:0.6;">';
                        html += '<span style="color:#666;">??? — </span><span style="color:#555;font-style:italic;">' + hintText + '</span>';
                        html += '</div>';
                    }
                }
            } else {
                html += '<h3>Indentured Status</h3>';
                html += '<p>No active indenture data found.</p>';
            }
        }

        html += '</div>';
        openModal(status.icon + ' ' + status.label, html);
    }

    // ── Unique Start Journal ──
    function openStartJournal() {
        var status = Player.getSpecialStartStatus();
        if (!status) { toast('No active special start.', 'info'); return; }
        var html = '<div style="max-height:70vh;overflow-y:auto;padding:10px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
        html += '<h3 style="margin:0;">' + status.icon + ' ' + status.label + ' Journal</h3>';
        html += '<button class="btn-action" onclick="UI.openSpecialStartPanel()" style="font-size:0.85em;">⬅ Actions</button>';
        html += '</div>';

        var day = Engine.getDay ? Engine.getDay() : 0;
        var year = Math.floor(day / 360) + 1;
        var season = ['Spring', 'Summer', 'Autumn', 'Winter'][Math.floor((day % 360) / 90)];

        if (status.type === 'indentured') {
            var ind = Player.indentured || Player.state.indentured || {};
            var daysServed = day - (ind.startDay || 0);
            var daysLeft = Math.max(0, (ind.contractDays || 0) - daysServed);
            var debtLeft = ind.debtRemaining || 0;
            var discovered = (ind.discoveredEscapes || []).length;
            var available = (ind.availableEscapes || []).length;

            html += '<div style="background:rgba(90,58,26,0.2);border-left:3px solid #8b6914;padding:10px;margin-bottom:10px;border-radius:4px;">';
            html += '<h4 style="margin:0 0 6px;color:#c4a35a;">📜 The Contract</h4>';
            html += '<p style="color:#bbb;font-style:italic;margin:4px 0;">"Bound to service by debt and circumstance. The contract weighs heavy, but every chain has its weakest link..."</p>';
            html += '</div>';

            html += '<h4>📊 Progress</h4>';
            html += '<table style="width:100%;border-collapse:collapse;">';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Days Served</td><td style="padding:3px 8px;">' + daysServed + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Days Remaining</td><td style="padding:3px 8px;color:' + (daysLeft < 100 ? '#88cc88' : '#cc8844') + ';">' + daysLeft + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Debt Remaining</td><td style="padding:3px 8px;">' + debtLeft + 'g</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Escape Routes Found</td><td style="padding:3px 8px;">' + discovered + ' / ' + available + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Tasks Completed</td><td style="padding:3px 8px;">' + (ind.totalTasksCompleted || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Master Mood</td><td style="padding:3px 8px;">' + (ind.masterMood || 'neutral') + '</td></tr>';
            html += '</table>';

            html += '<h4 style="margin-top:12px;">📖 Lore</h4>';
            html += '<p style="color:#bbb;">You were sold into service to pay a debt not entirely your own. Your master holds the contract — a binding document recognized by every kingdom in the land.</p>';
            html += '<p style="color:#bbb;">Some servants earn their way out through honest labor. Others find... creative solutions. The key is patience, cunning, and knowing when to act.</p>';

            html += '<h4 style="margin-top:12px;">💡 Hints</h4>';
            if (daysServed < 60) {
                html += '<p style="color:#c4a35a;">• Focus on completing master\'s tasks to build relationship and earn gold toward your debt.</p>';
                html += '<p style="color:#c4a35a;">• Explore the town and talk to people — you may discover escape methods.</p>';
            } else if (discovered < 3) {
                html += '<p style="color:#c4a35a;">• Keep exploring. There are many paths to freedom — trade, religion, combat, or cunning.</p>';
            } else {
                html += '<p style="color:#c4a35a;">• You have multiple escape routes. Choose wisely — some are risky but immediate, others are safe but slow.</p>';
                if (ind.masterMood === 'kind' || ind.masterMood === 'generous') {
                    html += '<p style="color:#88cc88;">• Your master is in a good mood. This may work in your favor...</p>';
                }
            }
        }

        if (status.type === 'pilgrim') {
            var pil = Player.state.pilgrim || {};
            var totalSites = (pil.holySites || []).length;
            var visitedSites = (pil.visitedSites || []).length;
            var goalsCompleted = 0;
            var goals = pil.goals || [];
            for (var gi = 0; gi < goals.length; gi++) {
                if (goals[gi] === 'visit_all_sites' && visitedSites >= totalSites) goalsCompleted++;
                else if (goals[gi] === 'convert_50_followers' && (pil.followers || 0) >= 50) goalsCompleted++;
                else if (goals[gi] === 'build_temple' && pil.templeBuilt) goalsCompleted++;
            }

            html += '<div style="background:rgba(90,58,26,0.2);border-left:3px solid #8b6914;padding:10px;margin-bottom:10px;border-radius:4px;">';
            html += '<h4 style="margin:0 0 6px;color:#c4a35a;">📜 The Pilgrimage</h4>';
            html += '<p style="color:#bbb;font-style:italic;margin:4px 0;">"Called by faith to walk the sacred road. Each holy site brings you closer to divine purpose, each follower closer to building something eternal."</p>';
            html += '</div>';

            html += '<h4>📊 Progress</h4>';
            html += '<table style="width:100%;border-collapse:collapse;">';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Holy Sites Visited</td><td style="padding:3px 8px;">' + visitedSites + ' / ' + totalSites + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Followers</td><td style="padding:3px 8px;">' + (pil.followers || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Sermons Given</td><td style="padding:3px 8px;">' + (pil.sermonsGiven || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Temple Built</td><td style="padding:3px 8px;">' + (pil.templeBuilt ? '✅ Yes' : '❌ Not yet') + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Goals Complete</td><td style="padding:3px 8px;">' + goalsCompleted + ' / 2 needed</td></tr>';
            html += '</table>';

            if (pil.rivalFaith && !pil.rivalDefeated) {
                html += '<h4 style="margin-top:12px;color:#cc4444;">⚡ Rival Faith</h4>';
                html += '<p style="color:#bbb;">The ' + (pil.rivalFaith.name || 'rival faith') + ' spreads across the land, led by ' + (pil.rivalFaith.preacherName || 'a rival preacher') + '. They compete for the hearts of the people.</p>';
            }

            html += '<h4 style="margin-top:12px;">📖 Lore</h4>';
            html += '<p style="color:#bbb;">You left everything behind to spread the word of your faith. The holy sites scattered across this land call to you — ancient places of power where the divine touches the mortal world.</p>';
            html += '<p style="color:#bbb;">Complete any two sacred goals to fulfill your pilgrimage: visit all holy sites, gather 50 faithful followers, or build a temple to stand for generations.</p>';

            html += '<h4 style="margin-top:12px;">💡 Hints</h4>';
            var sermonSkill = Math.min(100, (pil.sermonsGiven || 0) * 2);
            if (sermonSkill < 30) {
                html += '<p style="color:#c4a35a;">• Your sermons are still modest. Keep preaching — your skill improves with practice, converting more people each time.</p>';
            }
            if (visitedSites < totalSites) {
                html += '<p style="color:#c4a35a;">• Travel to different towns to find holy sites. Each site has a unique challenge or blessing.</p>';
            }
            if ((pil.followers || 0) >= 20 && !pil.templeBuilt) {
                html += '<p style="color:#88cc88;">• You have enough followers to build a temple! Save 500g and find the right town.</p>';
            }
        }

        if (status.type === 'shipwrecked') {
            var sw = Player.state.shipwrecked || Player.shipwrecked || {};
            html += '<div style="background:rgba(26,58,90,0.2);border-left:3px solid #1a6b8a;padding:10px;margin-bottom:10px;border-radius:4px;">';
            html += '<h4 style="margin:0 0 6px;color:#5aadca;">📜 The Stranger\'s Tale</h4>';
            html += '<p style="color:#bbb;font-style:italic;margin:4px 0;">"Washed ashore from a distant land, carrying only an enigmatic artifact and fragments of a forgotten language. This world is strange, but perhaps you were meant to be here."</p>';
            html += '</div>';

            html += '<h4>📊 Progress</h4>';
            html += '<table style="width:100%;border-collapse:collapse;">';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Language Skill</td><td style="padding:3px 8px;">' + (sw.languageSkill || 0) + '%</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Artifact</td><td style="padding:3px 8px;">' + (sw.artifactKept ? '💎 Kept' : (sw.finalChoice === 'open' ? '🏛️ Opened (Embassy)' : (sw.finalChoice === 'seal' ? '⚡ Sealed (Absorbed)' : '💰 Sold'))) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Stories Told</td><td style="padding:3px 8px;">' + (sw.storiesTold || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Crafts Taught</td><td style="padding:3px 8px;">' + (sw.craftsTaught || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Resonance Sites</td><td style="padding:3px 8px;">' + (sw.resonanceSitesVisited || 0) + '/5</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Sea Chart Fragments</td><td style="padding:3px 8px;">' + (sw.seaChartFragments || 0) + '/5</td></tr>';
            if (sw.embassy) {
                html += '<tr><td style="padding:3px 8px;color:#aaa;">Embassy</td><td style="padding:3px 8px;">🏛️ ' + sw.embassy.townName + '</td></tr>';
                html += '<tr><td style="padding:3px 8px;color:#aaa;">Embassy Bank</td><td style="padding:3px 8px;">' + (sw.embassyBankAccount || 0) + 'g</td></tr>';
            }
            if (sw.sealBonuses) {
                html += '<tr><td style="padding:3px 8px;color:#aaa;">Seal Power</td><td style="padding:3px 8px;">' + (sw.sealBonuses.speedBonus > 0 ? '⚡ Active' : '💤 Spent') + '</td></tr>';
            }
            html += '</table>';

            html += '<h4 style="margin-top:12px;">📖 Lore</h4>';
            html += '<p style="color:#bbb;">Your ship was lost in a terrible storm. You alone survived, clutching an ancient artifact from your homeland. The people here speak a language you barely understand, but you\'re learning quickly.</p>';
            if (sw.resonanceSitesVisited > 0 && sw.resonanceSitesVisited < 5) {
                html += '<p style="color:#bbb;">The artifact pulses at ancient sites across the land, revealing visions of your homeland and fragments of a sea chart that could bridge two worlds.</p>';
            }
            if (sw.finalChoice === 'open') {
                html += '<p style="color:#bbb;">You opened the artifact and founded an Embassy — a bridge between your homeland and this new world. Your people have begun to arrive, bringing their knowledge and culture.</p>';
            }
            if (sw.finalChoice === 'seal') {
                html += '<p style="color:#bbb;">You sealed the artifact\'s power within yourself, gaining extraordinary abilities at the cost of severing the connection to your homeland forever.</p>';
            }

            html += '<h4 style="margin-top:12px;">💡 Hints</h4>';
            if ((sw.languageSkill || 0) < 50) {
                html += '<p style="color:#c4a35a;">• Talk to everyone you meet. Your language skill improves with every interaction.</p>';
            }
            if (sw.artifactKept && !sw.finalChoice) {
                html += '<p style="color:#c4a35a;">• The artifact pulses near ancient resonance sites. Visit all 5 to unlock the final choice.</p>';
            }
            html += '<p style="color:#c4a35a;">• Tell exotic stories and teach foreign crafts to earn gold and reputation as you build your new life.</p>';
        }

        if (status.type === 'musician') {
            var mus = Player.state.musician || {};
            var maxFame2 = 0; var maxFameK2 = 'none';
            var kingdoms2 = Engine.getKingdoms ? Engine.getKingdoms() : [];
            for (var ki2 = 0; ki2 < kingdoms2.length; ki2++) {
                var f2 = (mus.fame || {})[kingdoms2[ki2].id] || 0;
                if (f2 > maxFame2) { maxFame2 = f2; maxFameK2 = kingdoms2[ki2].name; }
            }
            var totalFans2 = Object.keys(mus.fans || {}).length;

            html += '<div style="background:rgba(90,26,90,0.2);border-left:3px solid #8b1488;padding:10px;margin-bottom:10px;border-radius:4px;">';
            html += '<h4 style="margin:0 0 6px;color:#ca5ac4;">📜 The Musician\'s Journey</h4>';
            html += '<p style="color:#bbb;font-style:italic;margin:4px 0;">"With nothing but an instrument and a dream, you set out to fill the world with song. Every tavern is a stage, every crowd a chance at glory."</p>';
            html += '</div>';

            html += '<h4>📊 Progress</h4>';
            html += '<table style="width:100%;border-collapse:collapse;">';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Music Skill</td><td style="padding:3px 8px;">' + (mus.musicSkill || 0) + ' / 100</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Highest Fame</td><td style="padding:3px 8px;">' + Math.floor(maxFame2) + ' (' + maxFameK2 + ')</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Total Fans</td><td style="padding:3px 8px;">' + totalFans2 + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Songs Composed</td><td style="padding:3px 8px;">' + (mus.songsComposed || []).length + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Performances</td><td style="padding:3px 8px;">' + (mus.totalPerformances || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Duels Won/Lost</td><td style="padding:3px 8px;">' + (mus.duelsWon || 0) + ' / ' + (mus.duelsLost || 0) + '</td></tr>';
            if (mus.legacyChoice) {
                html += '<tr><td style="padding:3px 8px;color:#aaa;">Legacy</td><td style="padding:3px 8px;color:gold;">' + (mus.legacyChoice === 'music_school' ? '🏫 Music School' : '🌟 Legendary Bard') + '</td></tr>';
            }
            html += '</table>';

            // Song list
            if ((mus.songsComposed || []).length > 0) {
                html += '<h4 style="margin-top:12px;">🎵 Songbook</h4>';
                var themeIcons = { love: '❤️', war: '⚔️', comedy: '😂', epic: '⭐', tragedy: '😢', nature: '🌿' };
                for (var si = 0; si < mus.songsComposed.length; si++) {
                    var song = mus.songsComposed[si];
                    var sTheme = song.theme || song.subject || 'unknown';
                    var sDay = song.day || 0;
                    html += '<div style="padding:2px 6px;color:#bbb;">' + (themeIcons[sTheme] || '🎵') + ' ' + sTheme.charAt(0).toUpperCase() + sTheme.slice(1) + ' — Day ' + sDay + '</div>';
                }
            }

            // Rivals
            if (mus.rivals && mus.rivals.length > 0) {
                html += '<h4 style="margin-top:12px;">🎭 Rivals</h4>';
                for (var ri4 = 0; ri4 < mus.rivals.length; ri4++) {
                    var rival = mus.rivals[ri4];
                    var rivalTown = Engine.findTown ? Engine.findTown(rival.townId) : null;
                    var rivalStatus = rival.defeated ? '<span style="color:#88cc88;">Defeated</span>' : '<span style="color:#cc8844;">Active (Skill: ' + rival.skill + ')</span>';
                    html += '<div style="padding:2px 6px;color:#bbb;">🎭 ' + rival.name + ' — ' + rivalStatus + (rivalTown ? ' — ' + rivalTown.name : '') + '</div>';
                }
            }

            html += '<h4 style="margin-top:12px;">📖 Lore</h4>';
            html += '<p style="color:#bbb;">Born with music in your blood, you took to the road with nothing but your instrument. Tavern stages became your home, street corners your arena.</p>';
            html += '<p style="color:#bbb;">Reach legendary fame in any kingdom to face your destiny: establish a Music School to train the next generation, or walk the endless road as a Legendary Bard.</p>';

            html += '<h4 style="margin-top:12px;">💡 Hints</h4>';
            if ((mus.musicSkill || 0) < 40) {
                html += '<p style="color:#c4a35a;">• Keep performing to build skill. Taverns and streets are good early stages.</p>';
            }
            if (maxFame2 >= 30 && maxFame2 < 80) {
                html += '<p style="color:#c4a35a;">• Compose songs with themes that match the mood of each kingdom — war songs during wars, love songs in peacetime.</p>';
            }
            if (maxFame2 >= 50 && (mus.musicSkill || 0) >= 70) {
                html += '<p style="color:#88cc88;">• You\'re famous enough for Grand Concerts! High risk, high reward. Build up with songs first.</p>';
            }
            if (maxFame2 >= 70) {
                html += '<p style="color:gold;">• Legendary fame is within reach! Push past 80 to unlock your Legacy choice.</p>';
            }
        }

        if (status.type === 'military') {
            var mil = Player.state.militaryLeader || {};
            var milRanks = CONFIG.MILITARY_LEADER_RANKS || [];
            var milRankIdx = milRanks.findIndex(function(r) { return r.id === mil.rank; });
            var milRankName = milRanks[milRankIdx] ? milRanks[milRankIdx].name : (mil.rank || 'Recruit');

            html += '<div style="background:rgba(90,26,26,0.2);border-left:3px solid #8b1414;padding:10px;margin-bottom:10px;border-radius:4px;">';
            html += '<h4 style="margin:0 0 6px;color:#ca5a5a;">📜 The Commander\'s Chronicle</h4>';
            html += '<p style="color:#bbb;font-style:italic;margin:4px 0;">"From humble recruit to legend of the battlefield. Every training session sharpens the sword, every battle forges the commander."</p>';
            html += '</div>';

            html += '<h4>📊 Progress</h4>';
            html += '<table style="width:100%;border-collapse:collapse;">';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Current Rank</td><td style="padding:3px 8px;font-weight:bold;">' + milRankName + ' (' + (milRankIdx + 1) + '/' + milRanks.length + ')</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Trainings Done</td><td style="padding:3px 8px;">' + (mil.trainingsDone || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Battles Fought</td><td style="padding:3px 8px;">' + (mil.battlesAsLeader || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Victories</td><td style="padding:3px 8px;">' + (mil.victoriesAsLeader || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Sieges Won</td><td style="padding:3px 8px;">' + (mil.siegesWon || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Naval Battles Won</td><td style="padding:3px 8px;">' + (mil.navalBattlesWon || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Council Decisions</td><td style="padding:3px 8px;">' + (mil.warCouncilDecisions || 0) + '</td></tr>';
            if (mil.heroOfAgesEarned) {
                html += '<tr><td style="padding:3px 8px;color:#aaa;">Title</td><td style="padding:3px 8px;color:gold;font-weight:bold;">👑 Hero of the Ages</td></tr>';
            }
            html += '</table>';

            // Rank progression
            html += '<h4 style="margin-top:12px;">⚔️ Rank Progression</h4>';
            for (var rp = 0; rp < milRanks.length; rp++) {
                var rpColor = rp < milRankIdx ? '#88cc88' : (rp === milRankIdx ? '#ffd700' : '#555');
                var rpMark = rp < milRankIdx ? '✅' : (rp === milRankIdx ? '➡️' : '⬜');
                html += '<div style="padding:2px 6px;color:' + rpColor + ';">' + rpMark + ' ' + milRanks[rp].name + '</div>';
            }

            // Tactics used
            var tacticsUsed = mil.tacticsUsed || {};
            if (Object.keys(tacticsUsed).length > 0) {
                html += '<h4 style="margin-top:12px;">🗡️ Tactics Used</h4>';
                var tacticLabels = { aggressive: '🗡️ Aggressive', defensive: '🛡️ Defensive', flanking: '🏇 Flanking' };
                for (var tKey in tacticsUsed) {
                    if (tacticsUsed.hasOwnProperty(tKey)) {
                        html += '<div style="padding:2px 6px;color:#bbb;">' + (tacticLabels[tKey] || tKey) + ': ' + tacticsUsed[tKey] + ' times</div>';
                    }
                }
            }

            html += '<h4 style="margin-top:12px;">📖 Lore</h4>';
            html += '<p style="color:#bbb;">You joined the military with a fire in your heart and steel in your hand. Starting as a lowly recruit, you train relentlessly, fight in kingdom wars, and climb the ranks.</p>';
            html += '<p style="color:#bbb;">The ultimate goal: become General, prove yourself in a decisive battle, and earn the legendary title of Hero of the Ages — a name that will echo through eternity.</p>';

            html += '<h4 style="margin-top:12px;">💡 Hints</h4>';
            if ((mil.trainingsDone || 0) < 15) {
                html += '<p style="color:#c4a35a;">• Train regularly to build strength and qualify for promotions.</p>';
            }
            if (milRankIdx < 4) {
                html += '<p style="color:#c4a35a;">• Fight in battles during wartime to gain victories needed for promotion. Use Plan Battle and Inspire Army first for bonuses.</p>';
            }
            if (milRankIdx >= 4 && milRankIdx < 5) {
                html += '<p style="color:#88cc88;">• As Captain, you can attend the War Council! Strategic decisions boost your reputation and kingdom strength.</p>';
            }
            if (milRankIdx >= 5 && !mil.heroOfAgesEarned) {
                html += '<p style="color:gold;">• You are a General! Win 10+ victories to unlock the Decisive Battle — your path to becoming Hero of the Ages.</p>';
            }
        }

        if (status.type === 'scholar') {
            var sch = Player.state.scholar || {};
            var totalTowns2 = Engine.getTowns ? Engine.getTowns().length : 0;
            var visited2 = Object.keys(sch.townsVisited || {}).length;
            var specLabels2 = { history: '📜 History', economics: '💰 Economics', natural_science: '🔬 Natural Science' };

            html += '<div style="background:rgba(26,26,90,0.2);border-left:3px solid #14148b;padding:10px;margin-bottom:10px;border-radius:4px;">';
            html += '<h4 style="margin:0 0 6px;color:#5a5aca;">📜 The Scholar\'s Chronicle</h4>';
            html += '<p style="color:#bbb;font-style:italic;margin:4px 0;">"Knowledge is the only currency that grows when shared. Travel the land, study its secrets, and write the book that will define an age."</p>';
            html += '</div>';

            html += '<h4>📊 Progress</h4>';
            html += '<table style="width:100%;border-collapse:collapse;">';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Specialization</td><td style="padding:3px 8px;">' + (specLabels2[sch.specialization] || 'Not chosen') + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Total Knowledge</td><td style="padding:3px 8px;">' + (sch.totalKnowledge || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Specialization Knowledge</td><td style="padding:3px 8px;">' + (sch.specializationKnowledge || 0) + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Towns Studied</td><td style="padding:3px 8px;">' + visited2 + ' / ' + totalTowns2 + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">NPCs Learned From</td><td style="padding:3px 8px;">' + (sch.npcsTaughtBy || []).length + '</td></tr>';
            html += '<tr><td style="padding:3px 8px;color:#aaa;">Great Book</td><td style="padding:3px 8px;">' + (sch.greatBookWritten ? '✅ Complete!' : '📝 In progress') + '</td></tr>';
            if (sch.royaltiesActive) {
                html += '<tr><td style="padding:3px 8px;color:#aaa;">Royalties Earned</td><td style="padding:3px 8px;color:gold;">' + (sch.totalRoyaltiesEarned || 0) + 'g</td></tr>';
            }
            html += '</table>';

            html += '<h4 style="margin-top:12px;">📖 Lore</h4>';
            html += '<p style="color:#bbb;">You left the comfort of the academy to study the world firsthand. Every town is a library, every person a teacher, every ruin a chapter waiting to be written.</p>';
            html += '<p style="color:#bbb;">Your life\'s work: The Great Book — a masterpiece that synthesizes all your knowledge. Once complete, it will earn royalties and fame across every kingdom.</p>';

            html += '<h4 style="margin-top:12px;">💡 Hints</h4>';
            if (!sch.specialization) {
                html += '<p style="color:gold;">• Choose a specialization first! History, Economics, or Natural Science — each gives unique bonuses.</p>';
            }
            if ((sch.totalKnowledge || 0) < 100) {
                html += '<p style="color:#c4a35a;">• Study towns and learn from NPCs to build knowledge. Visit libraries for extra learning.</p>';
            }
            if ((sch.totalKnowledge || 0) >= 100 && !sch.greatBookWritten) {
                html += '<p style="color:#88cc88;">• You have enough knowledge to attempt The Great Book! This will be your masterpiece.</p>';
            }
            if (sch.greatBookWritten && sch.royaltiesActive) {
                html += '<p style="color:gold;">• Your Great Book is published! Royalties flow in weekly. Your legacy is secure.</p>';
            }
        }

        html += '</div>';
        openModal('📓 Journey Journal', html);
    }

    function specialAction(action) {
        var result;
        var townId = Player.townId;
        switch (action) {
            case 'sermon': result = Player.giveSermon(townId); break;
            case 'visitSite': result = Player.visitHolySite(townId); break;
            case 'convert':
                // Pick an NPC in town to convert
                var cworld = Engine.getWorld();
                if (cworld && cworld.people) {
                    var cppl = cworld.people.filter(function(p) { return p.townId === townId && p.alive; });
                    var convertTarget = cppl.length > 0 ? cppl[0] : null;
                    if (convertTarget) result = Player.convertNPC(convertTarget.id);
                    else result = { success: false, message: 'No one to convert here.' };
                } else {
                    result = { success: false, message: 'Cannot find people in town.' };
                }
                break;
            case 'buildTemple': result = Player.buildTemple(townId); break;
            case 'challengeRival': result = Player.challengeRivalFaith(); break;
            case 'bless':
                var bworld = Engine.getWorld();
                if (bworld && bworld.people) {
                    var bppl = bworld.people.filter(function(p) { return p.townId === townId && p.alive; });
                    var blessTarget = bppl.length > 0 ? bppl[0] : null;
                    if (blessTarget) result = Player.blessNPC(blessTarget.id);
                    else result = { success: false, message: 'No one to bless here.' };
                } else {
                    result = { success: false, message: 'Cannot find people in town.' };
                }
                break;
            case 'story': result = Player.tellExoticStory(townId); break;
            case 'craft': result = Player.teachForeignCraft(); break;
            case 'sellArtifact': result = Player.sellExoticArtifact(); break;
            case 'resonance': result = Player.visitResonanceSite(); break;
            case 'openArtifact': result = Player.openArtifact(townId); break;
            case 'sealArtifact': result = Player.sealArtifact(); break;
            case 'warpEmbassy': result = Player.warpToEmbassy(); break;
            case 'potionRed': result = Player.claimFreePotion('red'); break;
            case 'potionGreen': result = Player.claimFreePotion('green'); break;
            case 'potionBlue': result = Player.claimFreePotion('blue'); break;
            case 'tavern': result = Player.performAtTavern(townId); break;
            case 'street': result = Player.streetPerformance(townId); break;
            case 'concert': result = Player.hostConcert(townId); break;
            case 'compose_love': result = Player.composeSong('love'); break;
            case 'compose_war': result = Player.composeSong('war'); break;
            case 'compose_comedy': result = Player.composeSong('comedy'); break;
            case 'compose_epic': result = Player.composeSong('epic'); break;
            case 'grandConcert': result = Player.grandConcert(townId); break;
            case 'legacy_school': result = Player.chooseMusicianLegacy('music_school'); break;
            case 'legacy_bard': result = Player.chooseMusicianLegacy('legendary_bard'); break;
            case 'court':
                var town = Engine.findTown(townId);
                if (town) result = Player.performAtCourt(town.kingdomId);
                else result = { success: false, message: 'No town found.' };
                break;
            case 'private':
                // Pick an NPC in town for private performance
                var pworld = Engine.getWorld();
                if (pworld && pworld.people) {
                    var pppl = pworld.people.filter(function(p) { return p.townId === townId && p.alive; });
                    var privTarget = pppl.length > 0 ? pppl[0] : null;
                    if (privTarget) result = Player.privatePerformance(privTarget.id);
                    else result = { success: false, message: 'No audience available.' };
                } else {
                    result = { success: false, message: 'Cannot find people in town.' };
                }
                break;
            case 'train': result = Player.trainTroops(townId); break;
            case 'plan': result = Player.planBattle(); break;
            case 'inspire': result = Player.inspireArmy(); break;
            case 'fortify': result = Player.fortifyPosition(townId); break;
            case 'scout': result = Player.scoutEnemy(); break;
            case 'battle_aggressive': result = Player.engageBattle('aggressive'); break;
            case 'battle_defensive': result = Player.engageBattle('defensive'); break;
            case 'battle_flanking': result = Player.engageBattle('flanking'); break;
            case 'warCouncil': result = Player.attendWarCouncil(); break;
            case 'decisiveBattle': result = Player.fightDecisiveBattle(); break;
            case 'specHistory': result = Player.chooseScholarSpecialization('history'); break;
            case 'specEconomics': result = Player.chooseScholarSpecialization('economics'); break;
            case 'specScience': result = Player.chooseScholarSpecialization('natural_science'); break;
            case 'study': result = Player.studyTown(townId); break;
            case 'library': result = Player.studyAtLibrary(townId); break;
            case 'learn':
                // Pick an NPC in town to learn from
                var lworld = Engine.getWorld();
                if (lworld && lworld.people) {
                    var lpeople = lworld.people.filter(function(p) { return p.townId === townId && p.alive; });
                    var lnpc = lpeople.length > 0 ? lpeople[0] : null;
                    if (lnpc) result = Player.learnFromNPC(lnpc.id);
                    else result = { success: false, message: 'No one to learn from here.' };
                } else {
                    result = Player.learnFromNPC(null);
                }
                break;
            case 'notes': result = Player.writeNotes(); break;
            case 'book': result = Player.writeGreatBook(); break;
            case 'acceptEarlyRelease': result = Player.acceptEarlyRelease(); break;
            default:
                // Music duel dispatch
                if (action.startsWith && action.startsWith('duel_')) {
                    var duelIdx = parseInt(action.split('_')[1], 10);
                    result = Player.musicDuel(duelIdx);
                } else if (action.startsWith && action.startsWith('homeland_')) {
                    var npcIdx = parseInt(action.split('_')[1], 10);
                    result = Player.talkToHomelandNPC(npcIdx);
                } else {
                    result = { success: false, message: 'Unknown action.' };
                }
        }
        if (result) {
            toast(result.message, result.success ? 'success' : 'error');
        }
        closeModal();
    }

    function randomTown(kingdomId) {
        const towns = Engine.getTowns().filter(t => t.kingdomId === kingdomId);
        if (towns.length === 0) return;
        const rng = Engine.getRng();
        const town = rng ? rng.pick(towns) : towns[0];
        selectTown(town.id);
    }

    // ═══════════════════════════════════════════════════════════
    //  LEADERBOARD
    // ═══════════════════════════════════════════════════════════

    function openLeaderboard() {
        // Use new Engine leaderboard if available, fallback to old
        var entries;
        if (typeof Engine !== 'undefined' && Engine.getLeaderboard) {
            entries = Engine.getLeaderboard();
        } else if (typeof Player !== 'undefined' && Player.getMerchantLeaderboard) {
            entries = Player.getMerchantLeaderboard();
        } else {
            return;
        }

        const kingdoms = Engine.getKingdoms();
        const kingdomMap = {};
        for (const k of kingdoms) kingdomMap[k.id] = k;
        const RANKS = CONFIG.SOCIAL_RANKS || [];
        const canSeeLocations = typeof Player !== 'undefined' && Player.canSeeEliteMerchantLocations && Player.canSeeEliteMerchantLocations();

        // Find player rank
        let playerRank = -1;
        for (let i = 0; i < entries.length; i++) {
            if (entries[i].isPlayer) { playerRank = i + 1; break; }
        }

        let html = '<div style="padding:15px;">';
        html += '<h3 style="color:#ffd700;text-align:center;margin-bottom:5px;">🏆 Merchant Leaderboard</h3>';
        if (playerRank > 0) {
            html += '<div style="text-align:center;font-size:0.8rem;color:#aaa;margin-bottom:12px;">You are ranked <b style="color:#ffd700;">#' + playerRank + '</b> of ' + entries.length + '</div>';
        }
        html += '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr style="border-bottom:2px solid #555;">';
        html += '<th style="padding:8px;text-align:left;">#</th>';
        html += '<th style="text-align:left;">Name</th>';
        html += '<th style="text-align:center;">Strategy</th>';
        html += '<th style="text-align:center;">Rank</th>';
        if (canSeeLocations) html += '<th style="text-align:center;">Town</th>';
        html += '<th style="text-align:right;">Net Worth</th>';
        html += '<th style="text-align:center;">Track</th>';
        html += '</tr>';

        const strategyIcons = {
            'food_monopoly': '🌾', 'military_supplier': '⚔️', 'luxury_trader': '💎',
            'diversified': '📦', 'political_climber': '👑', 'war_profiteer': '🔥',
            'land_baron': '🏠', 'trade_network': '🗺️', 'Player': '🎮',
        };

        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
            const rankIdx = e.highestRank || 0;
            const rankInfo = RANKS[rankIdx];
            const rankIcon = rankInfo ? rankInfo.icon : '🌾';
            const highlight = e.isPlayer ? 'background:rgba(255,215,0,0.15);' : '';
            const nameStyle = e.isPlayer ? 'color:#ffd700;font-weight:bold;' : 'color:#ddd;';
            const k = kingdomMap[e.primaryKingdom];
            const kName = k ? k.name : '—';
            const kColor = k ? (k.color || '#888') : '#888';
            const stratIcon = strategyIcons[e.strategy] || '📦';
            const heraldryStr = e.heraldry ? (e.heraldry.symbol + ' ') : '';
            const heraldryTitle = e.heraldry ? e.heraldry.name : '';

            html += '<tr style="border-bottom:1px solid #333;' + highlight + '">';
            html += '<td style="padding:8px;font-size:1.1rem;">' + medal + '</td>';
            html += '<td style="' + nameStyle + '"><span title="' + heraldryTitle + '">' + heraldryStr + '</span>' + e.name + (e.isPlayer ? ' (You)' : '') +
                '<br><span style="font-size:0.7rem;color:#888;">' + (e.familyName || '') + ' family • <span style="color:' + kColor + ';">' + kName + '</span>' +
                ' • ' + e.buildings + ' bldgs • ' + e.employees + ' workers</span></td>';
            html += '<td style="text-align:center;font-size:0.85rem;" title="' + (e.strategy || '') + '">' + stratIcon + '<br><span style="font-size:0.6rem;color:#aaa;">' + formatStrategy(e.strategy) + '</span></td>';
            html += '<td style="text-align:center;">' + rankIcon + '</td>';
            if (canSeeLocations) {
                let townName = '???';
                if (e.townId != null) {
                    try {
                        const eTown = Engine.findTown(e.townId);
                        townName = eTown ? eTown.name : '???';
                    } catch (ex) { /* no-op */ }
                }
                html += '<td style="text-align:center;font-size:0.75rem;color:#aaa;">' + townName + '</td>';
            }
            html += '<td style="text-align:right;color:#ffd700;font-weight:bold;">' + formatGold(e.netWorth || 0) + '</td>';
            // Track/Untrack button in leaderboard
            if (!e.isPlayer && typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('merchant_tracker') && e.id) {
                var lbTracked = Player.isTrackingMerchant && Player.isTrackingMerchant(e.id);
                html += '<td style="text-align:center;"><button class="btn-medieval" style="font-size:0.6rem;padding:1px 5px;' + (lbTracked ? 'background:var(--gold);color:#000;' : '') + '" onclick="(function(){ var r = Player.' + (lbTracked ? 'untrackMerchant' : 'trackMerchant') + '(\'' + e.id + '\'); if(typeof UI!==\'undefined\' && UI.toast) UI.toast(r.message, r.success?\'success\':\'warning\'); UI.openLeaderboard(); })();">' + (lbTracked ? '⭐' : '☆') + '</button></td>';
            } else {
                html += '<td></td>';
            }
            html += '</tr>';
        }
        html += '</table>';

        // Alliance info section
        if (typeof Player !== 'undefined' && Player.getAllianceBenefits) {
            const alliances = Player.getAllianceBenefits();
            if (alliances.allianceCount > 0) {
                html += '<div style="margin-top:15px;padding:10px;border-top:1px solid #555;">';
                html += '<h4 style="color:#c0a0ff;margin:0 0 8px 0;">👑 Family Alliances (' + alliances.allianceCount + ')</h4>';
                const playerAlliances = Player.familyAlliances || [];
                for (let ai = 0; ai < playerAlliances.length; ai++) {
                    const a = playerAlliances[ai];
                    html += '<div style="font-size:0.8rem;color:#aaa;margin-bottom:4px;">• ' + (a.familyName || 'Unknown') + ' family (Day ' + a.startDay + ')</div>';
                }
                html += '<div style="font-size:0.75rem;color:#8f8;margin-top:6px;">Benefits: +' + alliances.repBonus + '% reputation, ' + Math.round(alliances.storageDiscount * 100) + '% storage discount</div>';
                html += '</div>';
            }
        }

        // Marriage proposals section
        if (typeof Player !== 'undefined' && Player.getMarriageProposals) {
            const proposals = Player.getMarriageProposals();
            if (proposals.length > 0) {
                html += '<div style="margin-top:15px;padding:10px;border-top:1px solid #555;">';
                html += '<h4 style="color:#ffa0a0;margin:0 0 8px 0;">💍 Marriage Proposals</h4>';
                for (let pi = 0; pi < proposals.length; pi++) {
                    const pr = proposals[pi];
                    html += '<div style="margin-bottom:8px;padding:6px;background:rgba(255,255,255,0.05);border-radius:4px;">';
                    html += '<div style="font-size:0.85rem;color:#ddd;">' + pr.eliteMerchantName + ' proposes: ' + pr.eliteChildName + ' wed ' + pr.playerChildName + '</div>';
                    html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 10px;margin-top:4px;" onclick="UI.respondToMarriageProposal(\'' + pr.id + '\', true)">✅ Accept</button> ';
                    html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 10px;margin-top:4px;background:rgba(200,50,50,0.15);" onclick="UI.respondToMarriageProposal(\'' + pr.id + '\', false)">❌ Reject</button>';
                    html += '</div>';
                }
                html += '</div>';
            }
        }

        html += '</div>';
        openModal('🏆 Merchant Leaderboard', html);
    }

    function respondToMarriageProposalUI(proposalId, accept) {
        if (typeof Player === 'undefined' || !Player.respondToMarriageProposal) return;
        var result = Player.respondToMarriageProposal(proposalId, accept);
        toast(result.message || (accept ? 'Marriage arranged!' : 'Proposal rejected.'), result.success ? 'success' : 'warning');
        if (result.success) openLeaderboard(); // Refresh
    }

    // ═══════════════════════════════════════════════════════════
    //  FIND WORK DIALOG
    // ═══════════════════════════════════════════════════════════

    function openWorkDialog() {
        if (typeof Player === 'undefined') return;
        if (Player.traveling) { toast('Cannot work while traveling.', 'warning'); return; }
        if (Player.workingUntilTick > Engine.getDay()) {
            toast('Already working! Finish on day ' + Player.workingUntilTick + '.', 'warning');
            return;
        }
        if (Player.jailedUntilDay > Engine.getDay()) {
            toast('Cannot work while in jail.', 'warning');
            return;
        }

        let html = '';

        // ── Military Career Section ──
        const wars = Engine.getActiveWars ? Engine.getActiveWars() : {};
        const hasActiveWars = Object.keys(wars).length > 0;

        if (Player.militaryActive) {
            // Currently enlisted — show status panel
            const rankLabel = Player.getMilitaryRankLabel ? Player.getMilitaryRankLabel() : (Player.militaryRank || 'Soldier');
            const pay = Player.getMilitaryPay ? Player.getMilitaryPay() : 0;
            const kName = Player.militaryKingdomId ? (Engine.findKingdom(Player.militaryKingdomId) || {}).name || '?' : '?';
            html += '<div style="border:2px solid var(--danger);padding:10px;margin-bottom:12px;border-radius:6px;background:rgba(200,50,50,0.08);">';
            html += '<h3 style="margin:0 0 6px 0;">⚔️ Military Service — Active</h3>';
            html += '<div class="detail-row"><span class="label">Rank</span><span class="value">' + rankLabel + '</span></div>';
            html += '<div class="detail-row"><span class="label">Fighting for</span><span class="value">' + kName + '</span></div>';
            html += '<div class="detail-row"><span class="label">Battles Survived</span><span class="value">' + (Player.battlesSurvived || 0) + '</span></div>';
            html += '<div class="detail-row"><span class="label">Pay per Battle</span><span class="value">🪙 ' + pay + 'g</span></div>';
            // Show mandatory service info or quit button
            if (Player.militaryMandatory) {
                var milEndDay = Player.militaryServiceEndDay || 0;
                var curDay = Engine.getDay ? Engine.getDay() : 0;
                var milDaysLeft = Math.max(0, milEndDay - curDay);
                html += '<div style="margin-top:8px;padding:6px;background:rgba(200,150,0,0.15);border:1px solid rgba(200,150,0,0.3);border-radius:4px;font-size:0.8rem;">';
                html += '⚠️ <strong>Mandatory Service:</strong> ' + milDaysLeft + ' days remaining (' + (milDaysLeft / 365).toFixed(1) + ' years). Cannot desert.';
                html += '</div>';
            } else {
                html += '<button class="btn-medieval" onclick="UI.quitMilitary()" style="margin-top:8px;font-size:0.8rem;padding:6px 16px;background:rgba(200,50,50,0.15);border-color:rgba(200,50,50,0.3);">🏠 Quit Military</button>';
            }
            html += '</div>';
            html += '<p class="text-dim">You cannot take other jobs while enlisted. Battles occur every 3-5 days automatically.</p>';
            openModal('💼 Find Work', html);
            return;
        }

        if (hasActiveWars) {
            html += '<div style="border:1px solid var(--gold);padding:10px;margin-bottom:12px;border-radius:6px;background:rgba(200,150,0,0.06);">';
            html += '<h3 style="margin:0 0 6px 0;">⚔️ Enlist as Soldier</h3>';
            html += '<p style="font-size:0.75rem;color:var(--text-muted);margin:0 0 8px 0;">Active wars detected! Join the fight for a kingdom. Earn gold, gain rank, risk death.</p>';
            // Show kingdoms at war
            const shownKingdoms = {};
            for (const wId in wars) {
                const w = wars[wId];
                for (const kId of [w.kingdomA, w.kingdomB]) {
                    if (shownKingdoms[kId]) continue;
                    shownKingdoms[kId] = true;
                    const k = Engine.findKingdom(kId);
                    if (!k) continue;
                    html += '<button class="btn-medieval" onclick="UI.enlistAsSoldier(\'' + kId + '\')" style="font-size:0.75rem;padding:4px 12px;margin:2px;">';
                    html += '⚔️ Enlist for ' + k.name;
                    html += '</button> ';
                }
            }
            html += '</div>';
        }

        // Show military rank if any (even when not enlisted)
        if (Player.militaryRank && !Player.militaryActive) {
            const rankLabel = Player.getMilitaryRankLabel ? Player.getMilitaryRankLabel() : Player.militaryRank;
            html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">🎖️ Military Rank: <strong>' + rankLabel + '</strong> (retired) — Battles survived: ' + (Player.battlesSurvived || 0) + '</div>';
        }

        html += '<p class="work-intro">Find work at local businesses to earn gold without traveling.</p>';

        // Show auto-travel mission status if active
        if (Player.autoTravelJob) {
            html += getAutoTravelStatusHtml();
            openModal('💼 Find Work', html);
            return;
        }

        const jobs = Player.getAvailableJobs();

        if (jobs.length === 0) {
            html += '<p>No jobs available right now.</p>';
        } else {
            html += '<div class="job-list">';
            for (let i = 0; i < jobs.length; i++) {
                const job = jobs[i];
                const typeIcons = {
                    building: '🏢', odd: '🔧', kingdom: '👑', castle: '🏰',
                    apprentice: '📖', merchant: '🤝'
                };
                const typeIcon = typeIcons[job.type] || '🏢';
                const typeLabels = {
                    building: 'Building', odd: 'Odd Job', kingdom: 'Kingdom',
                    castle: 'Royal Court', apprentice: 'Apprentice', merchant: 'Merchant'
                };
                const typeLabel = typeLabels[job.type] || '';

                // Risk indicators — show risk level badge
                let riskBadges = '';
                const riskLevel = job.riskLevel || (job.deathRisk ? 'high' : job.injuryRisk > 0.005 ? 'medium' : job.injuryRisk ? 'low' : (job.illnessRisk > 0.03 ? 'high' : job.illnessRisk ? 'medium' : ''));
                if (riskLevel === 'high') {
                    riskBadges += '<span style="font-size:0.7rem;color:#fff;background:#c0392b;margin-left:6px;padding:1px 5px;border-radius:3px;font-weight:bold;">⚠ High Risk</span>';
                } else if (riskLevel === 'medium') {
                    riskBadges += '<span style="font-size:0.7rem;color:#fff;background:#e67e22;margin-left:6px;padding:1px 5px;border-radius:3px;">⚡ Medium Risk</span>';
                } else if (riskLevel === 'low') {
                    riskBadges += '<span style="font-size:0.7rem;color:#fff;background:#27ae60;margin-left:6px;padding:1px 5px;border-radius:3px;">🛡 Low Risk</span>';
                }
                if (job.deathRisk) riskBadges += '<span style="font-size:0.7rem;color:var(--danger);margin-left:4px;">☠️</span>';
                if (job.injuryRisk) riskBadges += '<span style="font-size:0.7rem;color:#e67e22;margin-left:4px;">🩹</span>';
                if (job.illnessRisk) riskBadges += '<span style="font-size:0.7rem;color:#8e44ad;margin-left:4px;">🤒</span>';

                html += '<div class="job-item">';
                html += '<div class="job-info">';
                html += '<span class="job-name">' + typeIcon + ' ' + job.name + riskBadges + '</span>';
                if (typeLabel) {
                    html += '<span style="font-size:0.7rem;color:var(--text-muted);margin-left:6px;background:var(--bg-card);padding:1px 5px;border-radius:3px;">' + typeLabel + '</span>';
                }
                if (job.contextReason) {
                    html += '<span style="font-size:0.7rem;color:var(--gold);margin-left:4px;background:rgba(200,150,0,0.1);padding:1px 5px;border-radius:3px;">' + job.contextReason + '</span>';
                }
                if (job.autoTravel) {
                    html += '<span style="font-size:0.7rem;color:#60a5fa;margin-left:4px;background:rgba(96,165,250,0.12);padding:1px 5px;border-radius:3px;">🗺️ Auto-Travel</span>';
                }
                html += '<span class="job-details">⏱ ' + job.hours + ' hours — 🪙 ' + job.pay + 'g';
                if (job.xpReward) html += ' — ⭐ ' + job.xpReward + ' XP';
                if (job.repGain) html += ' — 👑 +' + job.repGain + ' Rep';
                if (job.skillGain) html += ' — 📚 ' + job.skillGain;
                html += '</span>';
                if (job.description) {
                    html += '<span style="font-size:0.72rem;color:var(--text-muted);display:block;margin-top:2px;">' + job.description + '</span>';
                }
                // Skill learning progress
                if (job.jobTypeKey && Player.getJobSkillProgress) {
                    var prog = Player.getJobSkillProgress(job.jobTypeKey);
                    if (prog) {
                        html += '<span style="font-size:0.7rem;color:#2ecc71;display:block;margin-top:1px;">📚 ' + prog.current + '/' + prog.needed + ' days to learn ' + prog.skillName + '</span>';
                    }
                }
                html += '</div>';
                html += '<button class="btn-medieval btn-work" onclick="UI.executeWork(' + i + ')">Work</button>';
                html += '</div>';
            }
            html += '</div>';
        }

        openModal('💼 Find Work', html);
    }

    function enlistAsSoldier(kingdomId) {
        if (typeof Player === 'undefined' || !Player.enlistAsSoldier) return;
        const result = Player.enlistAsSoldier(kingdomId);
        if (result.success) {
            toast(result.message, 'success');
            closeModal();
        } else {
            toast(result.message, 'warning');
        }
    }

    function quitMilitary() {
        if (typeof Player === 'undefined' || !Player.quitMilitary) return;
        const result = Player.quitMilitary();
        if (result.success) {
            toast(result.message, 'success');
            closeModal();
        } else {
            toast(result.message, 'warning');
        }
    }

    function executeWork(jobIndex) {
        const result = Player.doWork(jobIndex);
        if (result.success) {
            toast(result.message, 'success');
            closeModal();
            // Handle tournament continue prompt
            if (result.tournamentContinue) {
                setTimeout(function() { showTournamentContinueDialog(result); }, 300);
            }
        } else {
            toast(result.message, 'warning');
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  HEALTH DIALOG
    // ═══════════════════════════════════════════════════════════

    function openHealthDialog() {
        if (typeof Player === 'undefined') return;
        let html = '<h3>🏥 Treatment Options</h3>';

        const injuries = Player.injuries || [];
        const illnesses = Player.illnesses || [];

        if (injuries.length === 0 && illnesses.length === 0) {
            html += '<p class="text-dim">You are healthy!</p>';
            openModal('🏥 Health', html);
            return;
        }

        // Check hospital availability
        let hasHospital = false;
        try {
            const town = Engine.findTown(Player.townId);
            if (town) {
                hasHospital = (town.buildings && town.buildings.some(function(b) {
                    return b.type === 'hospital' || (b.type && b.type.indexOf('medical') !== -1);
                })) || town.category === 'city' || town.category === 'capital_city';
            }
        } catch (e) { /* no-op */ }

        const hasDoctor = Player.hasSkill && Player.hasSkill('doctor');

        // Injuries
        if (injuries.length > 0) {
            html += '<h4 style="margin:8px 0 4px 0;">🩹 Injuries</h4>';
            for (let i = 0; i < injuries.length; i++) {
                var inj = injuries[i];
                var injTypes = Player.getInjuryTypes ? Player.getInjuryTypes() : [];
                var typeDef = injTypes.find(function(t) { return t.id === inj.type; });
                var hospCost = typeDef ? typeDef.productCost * 5 : '?';
                var sevColor = inj.severity === 'severe' ? 'var(--danger)' : inj.severity === 'moderate' ? '#e67e22' : '#2ecc71';

                html += '<div style="border:1px solid var(--border);padding:6px;margin-bottom:6px;border-radius:4px;">';
                html += '<div class="detail-row"><span class="label">' + inj.name + '</span>';
                html += '<span class="value" style="color:' + sevColor + ';">' + inj.severity + (inj.treated ? ' ✓ treating' : '') + '</span></div>';
                html += '<div style="display:flex;gap:4px;margin-top:4px;">';
                if (hasHospital) {
                    html += '<button class="btn-medieval" onclick="UI.treatAtHospital(' + i + ',false)" style="font-size:0.7rem;padding:3px 8px;">🏥 Hospital (' + hospCost + 'g)</button>';
                }
                if (hasDoctor && !inj.treated && typeDef) {
                    html += '<button class="btn-medieval" onclick="UI.selfTreatCondition(' + i + ',false)" style="font-size:0.7rem;padding:3px 8px;">💊 Self-Treat (needs ' + typeDef.product + ')</button>';
                }
                html += '</div></div>';
            }
        }

        // Illnesses
        if (illnesses.length > 0) {
            html += '<h4 style="margin:8px 0 4px 0;">🤒 Illnesses</h4>';
            for (let i = 0; i < illnesses.length; i++) {
                var ill = illnesses[i];
                var illTypes = Player.getIllnessTypes ? Player.getIllnessTypes() : [];
                var illTypeDef = illTypes.find(function(t) { return t.id === ill.type; });
                var illHospCost = illTypeDef ? illTypeDef.productCost * 5 : '?';
                var illSevColor = ill.severity === 'severe' ? 'var(--danger)' : ill.severity === 'moderate' ? '#e67e22' : '#2ecc71';

                html += '<div style="border:1px solid var(--border);padding:6px;margin-bottom:6px;border-radius:4px;">';
                html += '<div class="detail-row"><span class="label">' + ill.name + '</span>';
                html += '<span class="value" style="color:' + illSevColor + ';">' + ill.severity + (ill.treated ? ' ✓ treating' : '') + '</span></div>';
                html += '<div style="display:flex;gap:4px;margin-top:4px;">';
                if (hasHospital) {
                    html += '<button class="btn-medieval" onclick="UI.treatAtHospital(' + i + ',true)" style="font-size:0.7rem;padding:3px 8px;">🏥 Hospital (' + illHospCost + 'g)</button>';
                }
                if (hasDoctor && !ill.treated && illTypeDef) {
                    html += '<button class="btn-medieval" onclick="UI.selfTreatCondition(' + i + ',true)" style="font-size:0.7rem;padding:3px 8px;">💊 Self-Treat (needs ' + illTypeDef.product + ')</button>';
                }
                html += '</div></div>';
            }
        }

        if (!hasHospital) {
            html += '<p class="text-dim" style="font-size:0.72rem;">No hospital here. Visit a city or capital for hospital treatment.</p>';
        }
        if (!hasDoctor) {
            html += '<p class="text-dim" style="font-size:0.72rem;">Learn the Doctor skill to self-treat with medical supplies.</p>';
        }

        openModal('🏥 Health', html);
    }

    function treatAtHospital(index, isIllness) {
        if (typeof Player === 'undefined' || !Player.visitHospital) return;
        var result = Player.visitHospital(index, isIllness);
        if (result.success) {
            toast(result.message, 'success');
            openHealthDialog(); // refresh
        } else {
            toast(result.message, 'warning');
        }
    }

    function selfTreatCondition(index, isIllness) {
        if (typeof Player === 'undefined' || !Player.selfTreat) return;
        var result = Player.selfTreat(index, isIllness);
        if (result.success) {
            toast(result.message, 'success');
            openHealthDialog(); // refresh
        } else {
            toast(result.message, 'warning');
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  TEACH CHILD DIALOG
    // ═══════════════════════════════════════════════════════════

    function openTeachChildDialog(childId) {
        if (typeof Player === 'undefined') return;

        var child = null;
        try { child = Engine.findPerson(childId); } catch (e) { /* no-op */ }
        if (!child) { toast('Child not found.', 'warning'); return; }

        var passed = (Player.skillPointsPassedToChild && Player.skillPointsPassedToChild[childId]) || 0;
        var html = '<h3>📚 Teach ' + child.firstName + '</h3>';
        html += '<p style="font-size:0.75rem;color:var(--text-muted);">Costs 3 of your Skill Points to give 1 SP to your child (as heir). Points taught: <strong>' + passed + '/5</strong></p>';
        html += '<p style="font-size:0.75rem;">Your Skill Points: <strong>' + Player.skillPoints + '</strong></p>';

        if (passed >= 5) {
            html += '<p class="text-dim">Maximum skills already taught to this child.</p>';
            openModal('📚 Teach Child', html);
            return;
        }
        if (Player.skillPoints < 3) {
            html += '<p class="text-dim">Need at least 3 skill points to teach.</p>';
            openModal('📚 Teach Child', html);
            return;
        }

        // Show skills the player knows
        var skills = Player.skills || {};
        var hasAny = false;
        html += '<div class="job-list">';
        for (var skillId in skills) {
            if (!skills[skillId]) continue;
            var skillDef = null;
            if (typeof SKILLS !== 'undefined') skillDef = SKILLS[skillId];
            var skillName = (skillDef && skillDef.name) || skillId;
            var skillIcon = (skillDef && skillDef.icon) || '📖';
            hasAny = true;
            html += '<div class="job-item">';
            html += '<div class="job-info"><span class="job-name">' + skillIcon + ' ' + skillName + '</span></div>';
            html += '<button class="btn-medieval" onclick="UI.executeTeachChild(\'' + childId + '\',\'' + skillId + '\')" style="font-size:0.7rem;padding:3px 10px;">Teach (3→1 SP)</button>';
            html += '</div>';
        }
        html += '</div>';
        if (!hasAny) html += '<p class="text-dim">You have no skills to teach.</p>';

        openModal('📚 Teach Child', html);
    }

    function executeTeachChild(childId, skillId) {
        if (typeof Player === 'undefined' || !Player.teachChild) return;
        var result = Player.teachChild(childId, skillId);
        if (result.success) {
            toast(result.message, 'success');
            openTeachChildDialog(childId); // refresh
        } else {
            toast(result.message, 'warning');
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  STREET TRADING DIALOG
    // ═══════════════════════════════════════════════════════════

    function openStreetTrading() {
        if (typeof Player === 'undefined') return;
        if (Player.traveling) { toast('Cannot trade while traveling.', 'warning'); return; }

        const trades = Player.getStreetTrades();
        let html = '<p class="street-intro">Local townsfolk looking to buy specific goods at premium prices.</p>';

        if (trades.length === 0) {
            html += '<p>No street trading opportunities right now. Check back in a few days.</p>';
        } else {
            html += '<div class="street-trade-list">';
            for (let i = 0; i < trades.length; i++) {
                const t = trades[i];
                const held = (Player.inventory[t.resourceId] || 0);
                const canSell = held >= t.qty;
                html += '<div class="street-trade-item">';
                html += '<div class="street-trade-info">';
                html += '<span class="street-npc-name">' + t.npcName + '</span> wants ';
                html += '<strong>' + t.qty + ' ' + t.resourceIcon + ' ' + t.resourceName + '</strong>';
                html += ' — will pay <span class="street-price">' + t.pricePerUnit + 'g each</span>';
                html += ' <span class="street-market-price">(market: ' + Math.round(t.marketPrice) + 'g)</span>';
                html += '</div>';
                html += '<div class="street-trade-actions">';
                html += '<span class="street-have">You have: ' + held + '</span>';
                html += '<button class="btn-medieval btn-street-sell" ' + (canSell ? 'onclick="UI.executeStreetTrade(' + i + ')"' : 'disabled') + '>';
                html += 'Sell ' + t.qty + ' for ' + (t.pricePerUnit * t.qty) + 'g</button>';
                html += '</div>';
                html += '</div>';
            }
            html += '</div>';
        }

        // Add NPC Chat section for indentured servants seeking escape hints
        if (typeof Player !== 'undefined' && Player.indentured && Player.indentured.active) {
            html += '<hr style="border-color:#555;margin:12px 0;">';
            html += '<p class="street-intro">💬 <strong>Talk to Townsfolk</strong> — Chat with locals to learn about the town and maybe discover ways out of your contract.</p>';
            // Get NPCs in current town
            const townId = Player.townId;
            const townNpcs = (typeof Engine !== 'undefined' && Engine.getPeople) ? Engine.getPeople(townId) : [];
            const chatNpcs = [];
            for (let n = 0; n < Math.min(townNpcs.length, 50); n++) {
                const npc = townNpcs[n];
                if (npc && npc.alive && npc.id !== Player.indentured.masterId) {
                    chatNpcs.push(npc);
                }
            }
            // Show up to 6 random NPCs to chat with
            const shuffled = chatNpcs.sort(() => Math.random() - 0.5).slice(0, 6);
            if (shuffled.length > 0) {
                html += '<div class="street-trade-list">';
                for (let c = 0; c < shuffled.length; c++) {
                    const npc = shuffled[c];
                    const occ = npc.occupation || npc.title || 'Townsfolk';
                    const occDisplay = occ.charAt(0).toUpperCase() + occ.slice(1);
                    html += '<div class="street-trade-item" style="padding:6px 10px;">';
                    html += '<div class="street-trade-info">';
                    html += '<span class="street-npc-name">' + (npc.firstName || npc.fullName || 'Someone') + ' ' + (npc.lastName || '') + '</span>';
                    html += ' <span class="text-dim">(' + occDisplay + ')</span>';
                    html += '</div>';
                    html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 10px;" onclick="UI.chatWithNPC(\'' + npc.id + '\')">💬 Chat</button>';
                    html += '</div>';
                }
                html += '</div>';
            } else {
                html += '<p class="text-dim">No one around to talk to right now.</p>';
            }
        }

        openModal('🤝 Street Trading', html);
    }

    function chatWithNPC(npcId) {
        if (typeof Player === 'undefined' || !Player.checkNPCEscapeHints) return;
        var hint = Player.checkNPCEscapeHints(npcId);
        if (hint) {
            toast('💡 ' + hint, 'success');
        } else {
            // Generic chat responses
            var npc = (typeof Engine !== 'undefined') ? Engine.findPerson(npcId) : null;
            var name = npc ? (npc.firstName || 'They') : 'They';
            var chatLines = [
                name + ' nods politely but has nothing useful to say.',
                name + ' talks about the weather and rising grain prices.',
                name + ' grumbles about taxes and moves along.',
                name + ' shares gossip about a merchant who went bankrupt.',
                name + ' mentions the roads have been dangerous lately.',
                name + ' tells you about their family troubles.',
                name + ' warns you about the war affecting trade routes.'
            ];
            toast('💬 ' + chatLines[Math.floor(Math.random() * chatLines.length)], 'info');
        }
        openStreetTrading(); // Refresh to show new NPCs
    }

    function executeStreetTradeUI(tradeIndex) {
        const result = Player.executeStreetTrade(tradeIndex);
        if (result.success) {
            toast(result.message, 'success');
            openStreetTrading(); // refresh
        } else {
            toast(result.message, 'warning');
        }
    }

    // ========================================================
    // DARK DEEDS — SCHEMES DIALOG
    // ========================================================

    let _schemesTab = 'sabotage';

    function switchSchemesTab(tab) {
        _schemesTab = tab;
        const tabs = ['sabotage', 'political', 'assassination', 'tax_evasion', 'market'];
        const btns = document.querySelectorAll('.schemes-tabs .btn-tab');
        btns.forEach((btn, i) => {
            btn.classList.toggle('active', tabs[i] === tab);
        });
        for (const t of tabs) {
            const el = document.getElementById('schemesTab_' + t);
            if (el) el.style.display = t === tab ? '' : 'none';
        }
    }

    function getDetectionColor(pct) {
        if (pct < 0.20) return '#55a868';
        if (pct < 0.50) return '#ccb974';
        return '#c44e52';
    }

    function openSchemesDialog() {
        const actions = Player.getAvailableCorruptActions();
        const tabs = [
            { id: 'sabotage', label: '🔨 Sabotage' },
            { id: 'political', label: '🏛️ Political' },
            { id: 'assassination', label: '🗡️ Assassination' },
            { id: 'tax_evasion', label: '💰 Tax Evasion' },
            { id: 'market', label: '📈 Market' },
        ];

        let html = '<div class="schemes-tabs" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">';
        for (const tab of tabs) {
            const count = actions.filter(a => a.tab === tab.id).length;
            html += `<button class="btn-tab${_schemesTab === tab.id ? ' active' : ''}" `
                + `onclick="UI.switchSchemesTab('${tab.id}')" `
                + `style="font-size:0.85rem;padding:6px 12px;">`
                + `${tab.label} (${count})</button>`;
        }
        html += '</div>';

        // Stats summary
        html += '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px;display:flex;gap:12px;flex-wrap:wrap;">';
        html += `<span>🗡️ Crimes: ${Player.corruptActions}</span>`;
        html += `<span>🔥 Streak: ${Player.corruptionStreak}</span>`;
        html += `<span>⚠️ Notoriety: ${Math.floor(Player.notoriety)}</span>`;
        html += '</div>';

        for (const tab of tabs) {
            const tabActions = actions.filter(a => a.tab === tab.id);
            html += `<div id="schemesTab_${tab.id}" style="display:${_schemesTab === tab.id ? '' : 'none'}">`;

            if (tabActions.length === 0) {
                html += '<div style="color:var(--text-muted);font-size:0.78rem;padding:12px;">No actions available at this location.</div>';
            }

            for (let ai = 0; ai < tabActions.length; ai++) {
                const a = tabActions[ai];
                const detPct = Math.round(a.detection * 100);
                const detColor = getDetectionColor(a.detection);
                const locked = a.requires && !a.available;
                const opacity = a.available ? '1' : '0.5';

                html += `<div style="border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px;opacity:${opacity}">`;
                html += `<div style="display:flex;justify-content:space-between;align-items:center;">`;
                html += `<strong style="font-size:0.95rem;">${a.name}</strong>`;
                if (a.detection > 0) {
                    html += `<span style="font-size:0.85rem;color:${detColor};font-weight:bold;">${detPct}% detection</span>`;
                } else {
                    html += '<span style="font-size:0.85rem;color:#55a868;">No detection</span>';
                }
                html += '</div>';
                html += `<div style="font-size:0.85rem;color:var(--text-muted);margin:4px 0;">${a.desc}</div>`;
                html += '<div style="display:flex;gap:12px;font-size:0.85rem;margin:4px 0;">';
                html += `<span>💰 ${a.cost}</span>`;
                html += `<span>🎯 ${a.reward}</span>`;
                html += `<span>⭐ ${a.xp} XP</span>`;
                html += '</div>';
                if (a.requires && !hasSkillForAction(a)) {
                    html += `<div style="font-size:0.85rem;color:#c44e52;">🔒 Requires: ${a.requires}</div>`;
                }

                if (a.available) {
                    // For actions that need extra input (steal_goods, counterfeit, spread_rumors, etc.)
                    if (a.id === 'steal_goods') {
                        html += buildStealGoodsUI(a, ai);
                    } else if (a.id === 'counterfeit') {
                        html += buildCounterfeitUI(a, ai);
                    } else if (a.id === 'spread_rumors' || a.id === 'frame_competitor' ||
                               a.id === 'assassinate_competitor' || a.id === 'poison') {
                        html += buildTargetSelectUI(a, ai);
                    } else if (a.id === 'bribe_guards') {
                        html += buildBribeGuardsUI(a, ai);
                    } else if (a.id === 'bribe_advisor') {
                        html += buildBribeAdvisorUI(a, ai);
                    } else {
                        html += `<button class="btn-trade sell" style="font-size:0.85rem;margin-top:6px;" `
                            + `onclick="UI.executeScheme('${a.id}', ${JSON.stringify(a.params).replace(/"/g, '&quot;')})">⚡ Execute</button>`;
                    }
                }
                html += '</div>';
            }
            html += '</div>';
        }

        // Insider info display
        if (Player.insiderInfo && Player.insiderInfo.length > 0) {
            html += '<div style="border-top:1px solid var(--border);margin-top:10px;padding-top:8px;">';
            html += '<h4 style="font-size:0.9rem;margin-bottom:6px;">📋 Insider Information</h4>';
            for (const info of Player.insiderInfo) {
                html += `<div style="font-size:0.85rem;color:var(--text-muted);">• ${info.type.replace(/_/g, ' ')} in ~${Math.max(0, info.effectDay - (Engine.getDay ? Engine.getDay() : 0))} days</div>`;
            }
            html += '</div>';
        }

        openModal('🗡️ Dark Deeds — Schemes', html);
    }

    function hasSkillForAction(action) {
        if (!action.requires) return true;
        if (typeof action.requires === 'string') {
            return Player.hasSkill(action.requires);
        }
        return true;
    }

    function buildStealGoodsUI(action, idx) {
        let html = '<div style="display:flex;gap:4px;align-items:center;margin-top:4px;">';
        html += '<select id="stealRes_' + idx + '" style="font-size:0.7rem;padding:2px;flex:1;">';
        const town = Engine.findTown(Player.townId);
        if (town && town.market) {
            for (const key in RESOURCE_TYPES) {
                const res = RESOURCE_TYPES[key];
                const avail = town.market.supply[res.id] || 0;
                if (avail > 0) {
                    html += `<option value="${res.id}">${res.icon} ${res.name} (${Math.floor(avail)})</option>`;
                }
            }
        }
        html += '</select>';
        html += `<input type="number" id="stealQty_${idx}" value="5" min="1" max="20" style="width:45px;font-size:0.7rem;padding:2px;">`;
        html += `<button class="btn-trade sell" style="font-size:0.7rem;" `
            + `onclick="UI.executeStealGoods(${idx})">⚡ Steal</button>`;
        html += '</div>';
        return html;
    }

    function buildCounterfeitUI(action, idx) {
        let html = '<div style="display:flex;gap:4px;align-items:center;margin-top:4px;">';
        html += '<select id="counterfeitRes_' + idx + '" style="font-size:0.7rem;padding:2px;">';
        html += '<option value="jewelry">💎 Jewelry</option>';
        html += '<option value="wine">🍷 Wine</option>';
        html += '<option value="cloth">🧵 Cloth</option>';
        html += '</select>';
        html += `<input type="number" id="counterfeitQty_${idx}" value="5" min="1" max="20" style="width:45px;font-size:0.7rem;padding:2px;">`;
        html += `<button class="btn-trade sell" style="font-size:0.7rem;" `
            + `onclick="UI.executeCounterfeit(${idx})">⚡ Sell</button>`;
        html += '</div>';
        return html;
    }

    function buildTargetSelectUI(action, idx) {
        let html = '<div style="display:flex;gap:4px;align-items:center;margin-top:4px;">';
        html += '<select id="targetSelect_' + idx + '" style="font-size:0.7rem;padding:2px;flex:1;">';
        // Populate with AI merchants or people in town
        try {
            const aiMerchants = Player.getAIMerchants ? Player.getAIMerchants() : [];
            for (const m of aiMerchants) {
                if (m.alive !== false) {
                    html += `<option value="${m.id}">${m.name || m.firstName || 'Merchant'}</option>`;
                }
            }
        } catch (e) { /* no-op */ }
        html += '</select>';
        html += `<button class="btn-trade sell" style="font-size:0.7rem;" `
            + `onclick="UI.executeTargetAction('${action.id}', ${idx})">⚡ Execute</button>`;
        html += '</div>';
        return html;
    }

    function buildBribeGuardsUI(action, idx) {
        let html = '<div style="display:flex;gap:4px;align-items:center;margin-top:4px;">';
        const minBribe = action.params[1] || 50;
        html += `<input type="number" id="bribeAmount_${idx}" value="${minBribe}" min="${minBribe}" max="500" `
            + `style="width:65px;font-size:0.7rem;padding:2px;">`;
        html += '<span style="font-size:0.7rem;">gold</span>';
        html += `<button class="btn-trade sell" style="font-size:0.7rem;" `
            + `onclick="UI.executeBribeGuards(${idx})">⚡ Bribe</button>`;
        html += '</div>';
        return html;
    }

    function buildBribeAdvisorUI(action, idx) {
        let html = '<div style="display:flex;gap:4px;align-items:center;margin-top:4px;">';
        html += '<select id="voteDir_' + idx + '" style="font-size:0.7rem;padding:2px;flex:1;">';
        html += '<option value="lower_taxes">Lower Taxes</option>';
        html += '<option value="raise_taxes">Raise Taxes</option>';
        html += '<option value="ban_good">Ban a Good</option>';
        html += '<option value="unban_good">Unban a Good</option>';
        html += '</select>';
        html += `<button class="btn-trade sell" style="font-size:0.7rem;" `
            + `onclick="UI.executeBribeAdvisor('${action.params[0]}', ${idx})">⚡ Bribe</button>`;
        html += '</div>';
        return html;
    }

    function executeScheme(actionId, params) {
        const result = Player.executeCorruptAction(actionId, params);
        if (result.success) {
            toast(result.message, 'success');
        } else if (result.caught) {
            toast(result.message, 'danger');
        } else {
            toast(result.message, 'warning');
        }
        openSchemesDialog(); // refresh
    }

    function executeStealGoods(idx) {
        const resEl = document.getElementById('stealRes_' + idx);
        const qtyEl = document.getElementById('stealQty_' + idx);
        if (!resEl || !qtyEl) return;
        const result = Player.stealGoods(resEl.value, parseInt(qtyEl.value) || 1, Player.townId);
        if (result.success) {
            toast(result.message, 'success');
        } else if (result.caught) {
            toast(result.message, 'danger');
        } else {
            toast(result.message, 'warning');
        }
        openSchemesDialog();
    }

    function executeCounterfeit(idx) {
        const resEl = document.getElementById('counterfeitRes_' + idx);
        const qtyEl = document.getElementById('counterfeitQty_' + idx);
        if (!resEl || !qtyEl) return;
        const result = Player.sellCounterfeit(resEl.value, parseInt(qtyEl.value) || 1, Player.townId);
        if (result.success) {
            toast(result.message, 'success');
        } else if (result.caught) {
            toast(result.message, 'danger');
        } else {
            toast(result.message, 'warning');
        }
        openSchemesDialog();
    }

    function executeTargetAction(actionId, idx) {
        const targetEl = document.getElementById('targetSelect_' + idx);
        if (!targetEl) return;
        const targetId = targetEl.value;
        let result;
        if (actionId === 'spread_rumors') {
            result = Player.spreadRumors(targetId);
        } else if (actionId === 'frame_competitor') {
            result = Player.frameCompetitor(targetId, 'smuggling');
        } else if (actionId === 'assassinate_competitor') {
            result = Player.hireAssassin(targetId, 'competitor');
        } else if (actionId === 'poison') {
            result = Player.poisonTarget(targetId);
        } else {
            result = Player.executeCorruptAction(actionId, [targetId]);
        }
        if (result.success) {
            toast(result.message, 'success');
        } else if (result.caught) {
            toast(result.message, 'danger');
        } else {
            toast(result.message, 'warning');
        }
        openSchemesDialog();
    }

    function executeBribeGuards(idx) {
        const amountEl = document.getElementById('bribeAmount_' + idx);
        if (!amountEl) return;
        const result = Player.bribeGuards(Player.townId, parseInt(amountEl.value) || 50);
        if (result.success) {
            toast(result.message, 'success');
        } else if (result.caught) {
            toast(result.message, 'danger');
        } else {
            toast(result.message, 'warning');
        }
        openSchemesDialog();
    }

    function executeBribeAdvisor(kingdomId, idx) {
        const voteDirEl = document.getElementById('voteDir_' + idx);
        if (!voteDirEl) return;
        const result = Player.bribeAdvisor(kingdomId, voteDirEl.value);
        if (result.success) {
            toast(result.message, 'success');
        } else if (result.caught) {
            toast(result.message, 'danger');
        } else {
            toast(result.message, 'warning');
        }
        openSchemesDialog();
    }

    // ═══════════════════════════════════════════════════════════
    //  HELP DIALOG
    // ═══════════════════════════════════════════════════════════

    function openHelpDialog() {
        const html = `
        <div class="help-section" style="display:flex; gap:10px; margin-bottom:8px;">
            <button class="btn btn-primary" onclick="UI.openIconsGlossary()" style="flex:1; padding:10px; font-size:14px; cursor:pointer;">🗺️ Icons Guide</button>
            <button class="btn btn-primary" onclick="UI.openGameGuide()" style="flex:1; padding:10px; font-size:14px; cursor:pointer;">📖 Game Guide</button>
        </div>
        <div class="help-section">
            <h3 class="help-heading">⌨️ Keyboard Shortcuts</h3>
            <table class="help-table">
                <tr><td class="help-key">W A S D / Arrow Keys</td><td>Pan the camera</td></tr>
                <tr><td class="help-key">+ / -</td><td>Zoom in / out</td></tr>
                <tr><td class="help-key">1 2 3 4</td><td>Set game speed (Normal, Fast, Faster, Fastest)</td></tr>
                <tr><td class="help-key">Space / 0 / P</td><td>Pause / Unpause</td></tr>
                <tr><td class="help-key">T</td><td>Open Trade dialog</td></tr>
                <tr><td class="help-key">B</td><td>Open Build dialog</td></tr>
                <tr><td class="help-key">H</td><td>Open Hire dialog</td></tr>
                <tr><td class="help-key">C</td><td>Open Caravan dialog</td></tr>
                <tr><td class="help-key">L</td><td>Open Event Log</td></tr>
                <tr><td class="help-key">M</td><td>Open Map View</td></tr>
                <tr><td class="help-key">Ctrl+S</td><td>Save game</td></tr>
                <tr><td class="help-key">F1</td><td>This help screen</td></tr>
                <tr><td class="help-key">Esc</td><td>Close dialogs</td></tr>
            </table>
        </div>
        <div class="help-section">
            <h3 class="help-heading">📊 HUD Elements</h3>
            <ul class="help-list">
                <li><strong>Reputation</strong> — Your standing with each kingdom. Higher reputation grants better prices, lower taxes, and access to higher social ranks.</li>
                <li><strong>Notoriety</strong> — How well known you are to law enforcement. High notoriety increases detection chance for illegal activities.</li>
                <li><strong>Hunger</strong> — Your character's nourishment level. Keep it above zero or face starvation. Buy food at markets.</li>
                <li><strong>Experience</strong> — Earn XP from trading, working, and completing achievements. Level up to unlock new skills.</li>
            </ul>
        </div>
        <div class="help-section">
            <h3 class="help-heading">💡 Tips for New Players</h3>
            <ul class="help-list">
                <li>Start by buying goods cheap in one town and selling them where they are in demand.</li>
                <li>Check the price colors — <span style="color:var(--success);">green</span> means a good deal, <span style="color:var(--danger);">red</span> means overpriced. <em>(Requires the Keen Eye skill to see price colors.)</em></li>
                <li>Hire workers and build production facilities to generate passive income.</li>
                <li>Set up caravans between towns to automate trade routes.</li>
                <li>Watch for kingdom events — wars and plagues disrupt trade but can create opportunities.</li>
                <li>Keep your hunger bar full by carrying food. Starvation is fatal!</li>
                <li>Right-click on towns and people for quick-action menus.</li>
            </ul>
        </div>`;

        openModal('❓ Help & Controls', html);
    }

    // ═══════════════════════════════════════════════════════════
    //  ICONS GLOSSARY
    // ═══════════════════════════════════════════════════════════

    var iconGlossaryData = [
        // MAP ICONS
        { icon: '👑', name: 'Capital City', desc: 'Appears next to town names that are kingdom capitals', cat: 'Map' },
        { icon: '⚔️', name: 'Frontline Town', desc: 'Town is in an active war zone between kingdoms', cat: 'Map' },
        { icon: '⚓', name: 'Port / Harbor', desc: 'Town has a port with sea trade access', cat: 'Map' },
        { icon: '🏝️', name: 'Island', desc: 'Town is located on an island', cat: 'Map' },
        { icon: '⚠️', name: 'Low Security', desc: 'Pulsing warning — town security is dangerously low (<25)', cat: 'Map' },
        { icon: '💀', name: 'Destroyed Town', desc: 'This settlement has been destroyed or ruined', cat: 'Map' },
        { icon: '📦', name: 'Caravan Goods', desc: 'Shows number of goods being transported by a caravan', cat: 'Map' },
        { icon: '🛡️', name: 'Caravan Guards', desc: 'Number of guards protecting a caravan', cat: 'Map' },
        { icon: '⛵', name: 'Your Ship', desc: 'Your ship is docked at this port', cat: 'Map' },
        { icon: '☠️', name: 'Bandit Territory', desc: 'Road or area has high bandit threat. More skulls = more danger', cat: 'Map' },
        { icon: '📍', name: 'You (Player)', desc: 'Gold pulsing diamond showing your current location', cat: 'Map' },
        { icon: '⭐', name: 'Tracked Merchant', desc: 'Elite Merchant you are tracking (requires Merchant Tracker skill)', cat: 'Map' },
        { icon: '🔥', name: 'Fire / Disaster', desc: 'Active fire or disaster affecting a town', cat: 'Map' },
        { icon: '☠️', name: 'Plague', desc: 'Green-tinted skulls — plague is active in this town', cat: 'Map' },
        { icon: '🎉', name: 'Festival', desc: 'Town is celebrating a festival or event', cat: 'Map' },
        { icon: '🟢', name: 'Farmer (map dot)', desc: 'Green dot on map represents a farmer NPC', cat: 'Map' },
        { icon: '🟤', name: 'Miner (map dot)', desc: 'Brown dot represents a miner NPC', cat: 'Map' },
        { icon: '🟡', name: 'Merchant (map dot)', desc: 'Gold dot represents a merchant NPC', cat: 'Map' },
        { icon: '🔴', name: 'Soldier (map dot)', desc: 'Red dot represents a soldier NPC', cat: 'Map' },
        { icon: '🟣', name: 'Noble (map dot)', desc: 'Purple dot represents a noble NPC', cat: 'Map' },
        { icon: '⚪', name: 'Laborer (map dot)', desc: 'Gray dot represents a laborer NPC', cat: 'Map' },
        // UI BUTTONS
        { icon: '💼', name: 'Work', desc: 'Find jobs and employment opportunities in your town', cat: 'UI' },
        { icon: '🤝', name: 'Street Trading', desc: 'Buy and sell goods directly on the street', cat: 'UI' },
        { icon: '🏡', name: 'Housing', desc: 'View and manage your housing', cat: 'UI' },
        { icon: '💤', name: 'Rest', desc: 'Rest to recover energy and satisfy hunger', cat: 'UI' },
        { icon: '🏠', name: 'Buildings', desc: 'Manage buildings you own (shops, workshops, farms)', cat: 'UI' },
        { icon: '🛤️', name: 'Routes', desc: 'Manage your toll road routes', cat: 'UI' },
        { icon: '📚', name: 'Skills', desc: 'Learn and upgrade skills with skill points', cat: 'UI' },
        { icon: '👨‍👩‍👧‍👦', name: 'Family', desc: 'View your family, spouse, and children', cat: 'UI' },
        { icon: '🏆', name: 'Feats / Rankings', desc: 'View achievements and world leaderboards', cat: 'UI' },
        { icon: '❓', name: 'Help', desc: 'Game help, icons guide, and game guide', cat: 'UI' },
        { icon: '🗡️', name: 'Schemes', desc: 'Dark deeds — smuggling, espionage, and criminal activities', cat: 'UI' },
        { icon: '📊', name: 'Trade', desc: 'Open the market to buy and sell resources', cat: 'UI' },
        { icon: '📦', name: 'Caravan', desc: 'Create and manage trade caravans', cat: 'UI' },
        { icon: '👤', name: 'Character', desc: 'View your character profile and stats', cat: 'UI' },
        // SOCIAL RANKS
        { icon: '🌾', name: 'Peasant', desc: 'Starting rank. Limited rights and access', cat: 'Ranks' },
        { icon: '🏠', name: 'Citizen', desc: 'Can own property and vote in town matters', cat: 'Ranks' },
        { icon: '⚖️', name: 'Burgher', desc: 'Merchant class with processing and trade rights', cat: 'Ranks' },
        { icon: '🔨', name: 'Guildmaster', desc: 'Master craftsman who can build toll roads', cat: 'Ranks' },
        { icon: '👑', name: 'Minor Noble', desc: 'Aristocracy with court access and political power', cat: 'Ranks' },
        { icon: '🏰', name: 'Lord', desc: 'Landed elite with militia rights and significant influence', cat: 'Ranks' },
        { icon: '📜', name: 'Royal Advisor', desc: 'The king\'s counsel with legislative power. Can become king', cat: 'Ranks' },
        // NOTIFICATIONS
        { icon: 'ℹ️', name: 'Info', desc: 'General information notification', cat: 'Notifications' },
        { icon: '⚠️', name: 'Warning', desc: 'Caution — something needs attention', cat: 'Notifications' },
        { icon: '🔴', name: 'Danger', desc: 'Error or serious problem', cat: 'Notifications' },
        { icon: '✅', name: 'Success', desc: 'Action completed successfully', cat: 'Notifications' },
        { icon: '🏆', name: 'Achievement', desc: 'You unlocked a feat or achievement!', cat: 'Notifications' },
        // JOBS
        { icon: '🏢', name: 'Building Job', desc: 'Work at a building (farm, mine, workshop)', cat: 'Jobs' },
        { icon: '🔧', name: 'Odd Job', desc: 'Temporary work for quick gold', cat: 'Jobs' },
        { icon: '👑', name: 'Kingdom Job', desc: 'Work for the kingdom government', cat: 'Jobs' },
        { icon: '🏰', name: 'Royal Court Job', desc: 'Prestigious work at the royal court', cat: 'Jobs' },
        { icon: '📖', name: 'Apprenticeship', desc: 'Learn a trade under a master', cat: 'Jobs' },
        { icon: '🤝', name: 'Merchant Work', desc: 'Work for a merchant or trading company', cat: 'Jobs' },
        // EVENTS
        { icon: '👑💀', name: 'King Dies', desc: 'The ruler has died — succession crisis possible', cat: 'Events' },
        { icon: '⚔️', name: 'War Declared', desc: 'Two kingdoms have gone to war', cat: 'Events' },
        { icon: '☮️', name: 'Peace Treaty', desc: 'Warring kingdoms have made peace', cat: 'Events' },
        { icon: '💒', name: 'Royal Marriage', desc: 'A marriage into the royal family', cat: 'Events' },
        { icon: '🌾', name: 'Crop Blight', desc: 'Farming output reduced in affected area', cat: 'Events' },
        { icon: '⛏️', name: 'Mine Event', desc: 'Mine collapse or new vein discovered', cat: 'Events' },
        { icon: '🏗️', name: 'Construction', desc: 'New building or infrastructure being built', cat: 'Events' },
        { icon: '🏟️', name: 'Tournament', desc: 'Royal tournament — combat competitions', cat: 'Events' },
        { icon: '🏴', name: 'Secession', desc: 'A town has declared independence from its kingdom', cat: 'Events' },
        { icon: '🔥', name: 'Fire / Revolt', desc: 'Fire or civil unrest in a town', cat: 'Events' },
        // HERALDRY
        { icon: '🦁', name: 'House of the Lion', desc: 'Elite Merchant house — gold and red heraldry', cat: 'Heraldry' },
        { icon: '🦅', name: 'House of the Eagle', desc: 'Elite Merchant house — blue and gold heraldry', cat: 'Heraldry' },
        { icon: '🐺', name: 'House of the Wolf', desc: 'Elite Merchant house — gray and silver heraldry', cat: 'Heraldry' },
        { icon: '🦌', name: 'House of the Stag', desc: 'Elite Merchant house — green and gold heraldry', cat: 'Heraldry' },
        { icon: '🐻', name: 'House of the Bear', desc: 'Elite Merchant house — brown and gold heraldry', cat: 'Heraldry' },
        { icon: '🐍', name: 'House of the Serpent', desc: 'Elite Merchant house — blue and green heraldry', cat: 'Heraldry' },
        { icon: '🐉', name: 'House of the Dragon', desc: 'Elite Merchant house — red and orange heraldry', cat: 'Heraldry' },
        { icon: '🔥', name: 'House of the Phoenix', desc: 'Elite Merchant house — red and cream heraldry', cat: 'Heraldry' },
        { icon: '🌹', name: 'House of the Rose', desc: 'Elite Merchant house — red and peach heraldry', cat: 'Heraldry' },
        { icon: '⚓', name: 'House of the Anchor', desc: 'Elite Merchant house — dark and blue heraldry', cat: 'Heraldry' },
        { icon: '🌳', name: 'House of the Oak', desc: 'Elite Merchant house — green and brown heraldry', cat: 'Heraldry' },
        { icon: '🌙', name: 'House of the Crescent', desc: 'Elite Merchant house — dark and gold heraldry', cat: 'Heraldry' },
        { icon: '🛡️', name: 'House of the Shield', desc: 'Elite Merchant house — dark and gold heraldry', cat: 'Heraldry' },
        { icon: '🔔', name: 'House of the Bell', desc: 'Elite Merchant house — brown and gold heraldry', cat: 'Heraldry' },
        { icon: '🪶', name: 'House of the Feather', desc: 'Elite Merchant house — lavender and purple heraldry', cat: 'Heraldry' },
        { icon: '🏮', name: 'House of the Lantern', desc: 'Elite Merchant house — red and gold heraldry', cat: 'Heraldry' }
    ];

    function openIconsGlossary() {
        var overlay = document.createElement('div');
        overlay.id = 'icons-glossary-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center;';

        var panel = document.createElement('div');
        panel.style.cssText = 'background:#1a1a2e; border:2px solid #FFD700; border-radius:8px; width:600px; max-height:80vh; display:flex; flex-direction:column; color:#fff; font-family:sans-serif;';

        var header = '<div style="padding:12px 16px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">';
        header += '<span style="color:#FFD700; font-size:18px; font-weight:bold;">🗺️ Icons Guide</span>';
        header += '<button onclick="document.getElementById(\'icons-glossary-overlay\').remove()" style="background:#600; color:#fff; border:1px solid #a00; padding:4px 12px; cursor:pointer; border-radius:4px;">✖ Close</button>';
        header += '</div>';

        header += '<div style="padding:8px 16px; border-bottom:1px solid #333;">';
        header += '<input id="icon-search" type="text" placeholder="Search icons..." oninput="window._filterIcons()" style="width:200px; background:#2a2a3e; color:#fff; border:1px solid #555; padding:6px 10px; border-radius:4px; margin-right:8px;" />';
        var cats = ['All', 'Map', 'UI', 'Ranks', 'Heraldry', 'Notifications', 'Jobs', 'Events'];
        for (var ci = 0; ci < cats.length; ci++) {
            header += '<button onclick="window._iconCat=\'' + cats[ci] + '\'; window._filterIcons()" style="margin:2px; padding:3px 8px; background:' + (ci === 0 ? '#FFD700' : '#2a2a3e') + '; color:' + (ci === 0 ? '#000' : '#ddd') + '; border:1px solid #555; border-radius:3px; cursor:pointer; font-size:11px;" id="icon-cat-' + cats[ci] + '">' + cats[ci] + '</button>';
        }
        header += '</div>';

        panel.innerHTML = header + '<div id="icon-list" style="padding:8px 16px; overflow-y:auto; flex:1;"></div>';
        overlay.appendChild(panel);

        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        document.body.appendChild(overlay);

        window._iconGlossaryData = iconGlossaryData;
        window._iconCat = 'All';
        window._filterIcons();
    }

    window._filterIcons = function () {
        var search = (document.getElementById('icon-search') ? document.getElementById('icon-search').value : '').toLowerCase();
        var cat = window._iconCat || 'All';
        var list = document.getElementById('icon-list');
        if (!list) return;

        var html = '';
        var data = window._iconGlossaryData || [];
        var shown = 0;
        for (var i = 0; i < data.length; i++) {
            var d = data[i];
            if (cat !== 'All' && d.cat !== cat) continue;
            if (search && d.name.toLowerCase().indexOf(search) === -1 && d.desc.toLowerCase().indexOf(search) === -1 && d.icon.indexOf(search) === -1) continue;
            html += '<div style="display:flex; align-items:center; padding:6px 0; border-bottom:1px solid #222;">';
            html += '<span style="font-size:24px; width:40px; text-align:center; flex-shrink:0;">' + d.icon + '</span>';
            html += '<div style="margin-left:8px;"><b style="color:#FFD700;">' + d.name + '</b> <span style="color:#888; font-size:11px;">(' + d.cat + ')</span><br><span style="color:#aaa; font-size:12px;">' + d.desc + '</span></div>';
            html += '</div>';
            shown++;
        }
        if (shown === 0) html = '<div style="color:#888; padding:20px; text-align:center;">No icons match your search</div>';
        list.innerHTML = html;

        var cats = ['All', 'Map', 'UI', 'Ranks', 'Heraldry', 'Notifications', 'Jobs', 'Events'];
        for (var ci = 0; ci < cats.length; ci++) {
            var btn = document.getElementById('icon-cat-' + cats[ci]);
            if (btn) {
                btn.style.background = cats[ci] === cat ? '#FFD700' : '#2a2a3e';
                btn.style.color = cats[ci] === cat ? '#000' : '#ddd';
            }
        }
    };

    // ═══════════════════════════════════════════════════════════
    //  GAME GUIDE
    // ═══════════════════════════════════════════════════════════

    var gameGuideData = [
        // GETTING STARTED
        { cat: 'Getting Started', title: 'Welcome to Merchant Realms', text: 'You are a medieval merchant trying to build wealth and influence. Start by taking jobs, trading goods, and building a reputation. Your goal is to climb the social ranks, build a merchant empire, and establish a dynasty.' },
        { cat: 'Getting Started', title: 'Your First Steps', text: 'Take a job at a local building to earn starting gold. Visit the market to buy cheap goods and sell at higher prices. Rest when your energy is low. Talk to NPCs to build relationships.' },
        { cat: 'Getting Started', title: 'Energy & Rest', text: 'Every action costs energy. When you run low, rest at an inn, your home, or sleep outside. Having a home improves rest quality. Better housing provides more energy per rest. Eating food restores hunger, which prevents energy drain.' },
        { cat: 'Getting Started', title: 'Hunger & Thirst', text: 'Hunger and thirst decrease over time. When hunger hits 0 you begin starving, losing health each tick. Buy food (wheat, bread, meat, fish) from the market and eat it. Water is cheapest to buy and restores thirst. Keep both bars above 20 to be safe.' },
        { cat: 'Getting Started', title: 'Origin Stories', text: 'When starting a new game, you can choose from 10 different origin stories. Each gives a different starting situation — some start with debt, others with special skills or connections. Experiment to find your favorite start.' },
        { cat: 'Getting Started', title: 'The Indentured Start', text: 'The Indentured Servant origin starts you in debt to the kingdom. You must work to pay off your debt before you gain full freedom. Escape attempts are possible but risky — success depends on your skills and luck.' },
        { cat: 'Getting Started', title: 'Game Speed', text: 'Use the speed buttons (1×, 4×, 16×, 60×) to control how fast time passes. Pause with ⏸ or Space. Higher speeds are useful for waiting, but slow down during important moments like combat or trading decisions.' },
        { cat: 'Getting Started', title: 'Saving Your Game', text: 'Click the 💾 icon or press Ctrl+S to save. There are 5 save slots available. Save regularly — especially before risky activities like traveling dangerous roads or making big investments.' },
        // TRADING
        { cat: 'Trading', title: 'Market Basics', text: 'Each town has a market where goods are bought and sold. Prices change based on supply and demand. Buy low in towns with surplus, sell high in towns with shortage.' },
        { cat: 'Trading', title: 'Supply & Demand', text: 'Prices drop when supply is high and rise when supply is low. Towns produce goods based on their buildings — a town with farms produces cheaper food. Your purchases reduce supply and push prices up.' },
        { cat: 'Trading', title: 'Terrain & Prices', text: 'Town location affects base prices. Coastal towns have cheaper fish and salt. Mountain towns have cheaper ore and stone. Forest towns have cheaper wood and herbs. Plains have cheaper wheat and meat.' },
        { cat: 'Trading', title: 'Taxes & Discounts', text: 'All market purchases include a kingdom tax. Citizens of a kingdom receive a discount on purchases. The tax rate varies by kingdom — check the Kingdoms panel to compare. Some kings raise or lower taxes over time.' },
        { cat: 'Trading', title: 'Trade Licenses', text: 'Some luxury goods require a trade license to buy or sell. Licenses cost gold and are available in the Trade panel. Without a license, you cannot trade restricted goods at the market.' },
        { cat: 'Trading', title: 'Seasonal Demand', text: 'Some goods have seasonal price changes. Winter increases demand for wool, wood, and warm clothing. Summer boosts demand for water and light fabrics. Watch for 📈 seasonal demand markers in the trade panel.' },
        { cat: 'Trading', title: 'Trending Goods', text: 'Fashion trends cause certain goods to become popular, marked with 🔥 Trending in the market. Trending goods sell at higher prices — capitalize on these surges while they last.' },
        { cat: 'Trading', title: 'Street Trading', text: 'The Street Trading button (🤝) lets you buy and sell directly to NPCs on the street, sometimes at better prices than the market. This includes both legal goods and (if unlocked) banned goods.' },
        { cat: 'Trading', title: 'Banned Goods', text: 'Some kingdoms ban certain goods (weapons, poison, etc.). Selling banned goods carries risk — you may be caught and fined or jailed. Higher underworld skills reduce detection chance. The reward can be enormous.' },
        { cat: 'Trading', title: 'Carrying Capacity', text: 'You can only carry a limited weight of goods. Your base capacity is 20 weight units. Horses, carts, and ships increase your carrying capacity. The trade panel shows your current load.' },
        { cat: 'Trading', title: 'Caravans', text: 'Hire caravans to automatically transport goods between towns. Caravans can be one-way, round-trip, or continuous. Guards protect your goods from bandits on dangerous routes.' },
        { cat: 'Trading', title: 'Price Convergence', text: 'Connected towns slowly equalize prices over time through background trade. Isolated towns may have extreme price differences — these are the best trading opportunities.' },
        // SKILLS
        { cat: 'Skills', title: 'Skill Points', text: 'Earn skill points (SP) by leveling up through experience. Spend them in the Skills panel (📚) to unlock new abilities. Each skill costs 1-5 SP depending on power.' },
        { cat: 'Skills', title: 'Skill Branches', text: 'Skills are organized into 6 branches: Commerce, Industry, Transport, Social, Survival, and Underworld. Each branch unlocks different gameplay options. Some skills have prerequisites.' },
        { cat: 'Skills', title: 'Commerce Skills', text: 'Commerce skills improve your trading: Keen Eye shows price colors, Bulk Trader gives discounts on large purchases, Market Manipulator doubles your supply impact, and Tax Attorney reduces your tax burden.' },
        { cat: 'Skills', title: 'Industry Skills', text: 'Industry skills boost production: Efficient Logistics reduces building material costs, Property Magnate lets you own more buildings, and Herbalist doubles your herb gathering yield.' },
        { cat: 'Skills', title: 'Transport Skills', text: 'Transport skills improve travel: Cartographer speeds up road and off-road travel, Horse Mastery increases horse capacity and speed, and Regional Survey reveals nearby town information.' },
        { cat: 'Skills', title: 'Social Skills', text: 'Social skills help with relationships and politics: Court Etiquette improves petition success, Guild Negotiator helps with business deals, and Shrewd Negotiator gives better prices from NPCs.' },
        { cat: 'Skills', title: 'Survival Skills', text: 'Survival skills help you endure: First Aid lets you self-treat minor injuries, Field Medic lets you treat others for gold, Wilderness Survival improves foraging and rest outdoors, and Combat Proficiency helps in fights.' },
        { cat: 'Skills', title: 'Underworld Skills', text: 'Underworld skills enable risky but lucrative activities: Smugglers Run lets you cross closed borders, Blockade Runner lets you pass naval blockades, and Dark Connections opens access to shady deals.' },
        { cat: 'Skills', title: 'Merchant Tracker', text: 'A special skill that lets you track Elite Merchants on the map with a ⭐ star. Costs 1 skill point. The advanced version (Elite Tracker, 5 SP) gives you notifications about their activities.' },
        { cat: 'Skills', title: 'Medicine Skills', text: 'The Medicine branch includes First Aid (self-treat minor injuries), Herbalist (better herb yield), Field Medic (treat NPCs for gold), and Doctor (treat all injury severities). Medicine skills are especially useful in war-torn areas.' },
        // BUILDINGS
        { cat: 'Buildings', title: 'Owning Buildings', text: 'As you gain wealth and rank, you can buy and build buildings: farms, mines, workshops, shops, and more. Buildings generate income and produce goods that supply the local market.' },
        { cat: 'Buildings', title: 'Material Costs', text: 'Buildings require specific materials to construct: wood, planks, stone, bricks, iron, cloth, and rope. Costs are dynamic based on local market prices. If materials are unavailable, you cannot build.' },
        { cat: 'Buildings', title: 'Employees', text: 'Your buildings need workers. Hire NPCs from the town to work in your buildings. Better-skilled workers produce more. Pay fair wages to attract the best employees.' },
        { cat: 'Buildings', title: 'Production Buildings', text: 'Farms grow wheat and raise livestock. Mines extract ore and stone. Sawmills process logs into planks. Tanneries turn hides into leather. Each production chain creates value from raw materials.' },
        { cat: 'Buildings', title: 'Workshops & Crafting', text: 'Workshops and smithies process raw materials into finished goods. A smithy turns iron ore into weapons and tools. A weaving shop turns wool into cloth. These produce the most valuable goods.' },
        { cat: 'Buildings', title: 'Shops & Retail', text: 'General stores and specialty shops sell goods directly to townspeople. Stock them with goods from your inventory or warehouse. Retail prices include a markup above market price for profit.' },
        { cat: 'Buildings', title: 'Building Degradation', text: 'Buildings degrade over time and need repairs. Neglected buildings produce less and may eventually become unusable. Check your Buildings panel regularly and repair when condition drops.' },
        { cat: 'Buildings', title: 'Warehouses', text: 'Warehouses store goods safely. Without a warehouse, your goods are limited to what you can carry. Upgrade warehouse security to protect against theft. Some buildings come with built-in storage.' },
        // HOUSING
        { cat: 'Housing', title: 'Buying a Home', text: 'Homes provide better rest quality and storage space. Open the Housing panel (🏡) to see available housing in your current town. Better homes require higher ranks and more gold.' },
        { cat: 'Housing', title: 'Housing Types', text: 'From cheapest to most expensive: Tent, Shack, Cottage, Townhouse, Manor, Estate, Fortress, Castle. Each provides different rest quality, storage, and special features. Some require minimum social ranks.' },
        { cat: 'Housing', title: 'Housing Features', text: 'Homes can have special features: stables (improve horse rest), gardens (grow herbs and vegetables weekly), workshops (home crafting), and more. Better homes have more features.' },
        { cat: 'Housing', title: 'Home Crafting', text: 'If your home has a workshop, you can craft items like bandages, herbal remedies, rope, candles, and preserved food. Open the Housing panel and click Craft to see available recipes.' },
        { cat: 'Housing', title: 'Farmstead', text: 'The Farmstead housing type is affordable and grows food weekly. Great for self-sufficiency. Includes a garden that produces herbs and vegetables automatically.' },
        { cat: 'Housing', title: 'Harbor House', text: 'The Harbor House is available in port towns and gives a 10% discount on ship purchases and repairs. Ideal for seafaring merchants.' },
        { cat: 'Housing', title: 'Caravan Wagon', text: 'A portable home that lets you rest while traveling. Provides modest rest quality (4.5 energy per tick) anywhere on the map. Great for merchants who spend most of their time on the road.' },
        { cat: 'Housing', title: 'Upgrading Homes', text: 'You can upgrade your current home to a better type without buying a completely new one. The upgrade cost is the price difference. This preserves your stored items and home garden.' },
        // SHIPS
        { cat: 'Ships', title: 'Ship Overview', text: 'Ships let you travel between port towns by sea. They vary in speed, cargo capacity, combat defense, and addon slots. Buy ships from port towns using the Character panel.' },
        { cat: 'Ships', title: 'Ship Types', text: 'There are 10 ship types from the humble Rowboat to the mighty Man-o\'-War. Sloops and caravels are good for trading. Frigates and warships excel in combat. Choose based on your needs and budget.' },
        { cat: 'Ships', title: 'Ship Addons', text: 'Ships have addon slots for upgrades: Cabin (better rest), Cargo Hold (more storage), Armory (combat bonus), Medical Bay (heal at sea), Navigation (speed boost), Smuggling Hold (hidden cargo), and Fishing Nets (catch fish while sailing).' },
        { cat: 'Ships', title: 'Hull Health', text: 'Ships have hull health (0-100). Damage from storms, combat, or neglect reduces hull health. At 0, the ship sinks and cargo is lost. Repair your ship regularly at port towns.' },
        { cat: 'Ships', title: 'Ship Fishing', text: 'Fishing boats and ships with Fishing Nets addon can catch fish. Fishing boats catch fish automatically when docked. Nets catch fish while traveling by sea — a great passive income source.' },
        { cat: 'Ships', title: 'Naval Combat', text: 'Pirates may attack on sea routes. Your ship\'s defense, cannons, and hull health determine survival. Hiring guards and having an Armory addon improve your chances. Losing means cargo loss or ship damage.' },
        // TRAVEL
        { cat: 'Travel', title: 'Moving Between Towns', text: 'Click a town or use roads to travel. Travel takes time and energy. Roads are faster than off-road travel. Dangerous roads may have bandits.' },
        { cat: 'Travel', title: 'Roads & Safety', text: 'Roads connect towns and enable trade. Some roads are dangerous (☠️ on the map). Toll roads cost gold but are usually safer and faster. You can build toll roads at Guildmaster rank.' },
        { cat: 'Travel', title: 'Sea Travel', text: 'If you own a ship, you can travel between port towns via sea routes (yellow dashed lines on map). Sea travel can be faster for distant ports but requires a ship purchase.' },
        { cat: 'Travel', title: 'Free Travel', text: 'Right-click anywhere on the map to travel off-road to that location. This is slower than using roads but lets you reach any point on the map. Useful for reaching remote areas without roads.' },
        { cat: 'Travel', title: 'Kingdom Borders', text: 'Some kingdoms close their borders during wartime. Closed borders block travel through that kingdom unless you have the Smugglers Run skill to sneak across. Check kingdom status before planning routes.' },
        { cat: 'Travel', title: 'Kingdom Transport', text: 'Some kingdoms offer public transport between their towns. This costs a small fare but is convenient and safe. Check if the kingdom has a transport law enabled.' },
        { cat: 'Travel', title: 'Travel Rest', text: 'While traveling, your energy depletes. You can stop and rest on the road. Sleeping outside restores less energy than an inn. A Caravan Wagon home lets you rest comfortably anywhere.' },
        { cat: 'Travel', title: 'Horses', text: 'Horses increase your travel speed and carrying capacity. Buy them at the market. Horse Mastery skill further improves horse benefits. Horses with stables at home recover stamina faster.' },
        // WORK & JOBS
        { cat: 'Work', title: 'Finding Work', text: 'Open the Work panel (💼) to see available jobs in your current town. Jobs pay gold and grant experience. Different jobs require different minimum ranks and skills. Job duration varies from 5 to 60 ticks.' },
        { cat: 'Work', title: 'Building Jobs', text: 'Work at local buildings like farms, mines, and workshops. These are the most common jobs and are available to all ranks. Pay depends on the building type and local economy.' },
        { cat: 'Work', title: 'Apprentice Jobs', text: 'Work as an apprentice to learn a trade. Apprenticeships are longer but provide skill experience in addition to gold. Good for building up your abilities early in the game.' },
        { cat: 'Work', title: 'Merchant Jobs', text: 'At higher ranks, you can take merchant contracts: delivering goods between towns, negotiating deals, and managing trade agreements. These pay well but require travel.' },
        { cat: 'Work', title: 'Kingdom Jobs', text: 'Work directly for the kingdom: military service, tax collection, road building, and diplomatic missions. These build reputation and provide steady income. Available at Citizen rank and above.' },
        { cat: 'Work', title: 'Royal Court Jobs', text: 'At the highest ranks (Minor Noble+), you can work at the royal court: advising the king, managing state affairs, and conducting diplomatic missions. These pay the most and build political capital.' },
        { cat: 'Work', title: 'Odd Jobs', text: 'Quick jobs that are always available regardless of rank: street sweeping, message delivery, and manual labor. Low pay but good for emergencies when you need gold immediately.' },
        // KINGDOMS
        { cat: 'Kingdoms', title: 'Kingdom Overview', text: 'The world is divided into 4 kingdoms, each ruled by a king with unique personality. Kingdoms have their own taxes, laws, and military. Your social rank is tracked per kingdom.' },
        { cat: 'Kingdoms', title: 'King Personality', text: 'Kings have moods that affect their decisions: Jubilant kings lower taxes and build. Paranoid kings raise security. Wrathful kings may start wars. Ambitious kings expand territory. A king\'s mood changes based on events.' },
        { cat: 'Kingdoms', title: 'Laws & Taxes', text: 'Kings set tax rates and enact laws: price controls, immigration policy, inheritance tax, draft animals, and female succession. Laws affect your daily life — check the Kingdom Laws panel to see active laws.' },
        { cat: 'Kingdoms', title: 'War & Peace', text: 'Kingdoms can declare war on each other. War affects trade (prices spike, roads become dangerous), and towns in the frontline zone are marked with ⚔️. Caravans crossing war zones are at risk.' },
        { cat: 'Kingdoms', title: 'Conscription', text: 'During wartime, kingdoms may conscript citizens into military service. If conscripted, you must serve or face penalties. Higher social rank and political connections can help you avoid the draft.' },
        { cat: 'Kingdoms', title: 'Royal Commissions', text: 'Kings issue commissions — requests for specific goods to be delivered to the kingdom. Fulfilling commissions earns gold, reputation, and royal favor. Check the Royal Commissions panel.' },
        { cat: 'Kingdoms', title: 'Succession', text: 'When a king dies, succession follows: children first, then siblings, then royal advisors. Sometimes succession fails, creating a crisis period. You may be able to influence who takes the throne.' },
        { cat: 'Kingdoms', title: 'Citizenship', text: 'You can hold citizenship in multiple kingdoms simultaneously. Citizens get trade discounts and can access kingdom services. To gain citizenship, petition in a town of that kingdom with 40+ reputation, 90+ days residency, and the citizenship fee. Some kings enact an Exclusive Citizenship law that forbids dual citizenship — you must renounce other citizenships first, or wait for the law to be repealed. Your primary citizenship determines your home kingdom for tax purposes.' },
        { cat: 'Kingdoms', title: 'Petitions', text: 'You can petition the king for various favors: road construction, law changes, trade agreements. Petitions cost political capital and have a chance of success based on your rank and the king\'s mood.' },
        { cat: 'Kingdoms', title: 'Royal Court', text: 'At high social ranks, you gain access to the royal court. You can petition the king, spy for other kingdoms, or work toward becoming a Royal Advisor — the highest non-royal rank.' },
        { cat: 'Kingdoms', title: 'Kingdom Laws', text: 'Each kingdom has unique laws enacted by their king. Laws include: Guild Monopoly (rank required to build), Open Market (no tariffs), Closed Borders (foreigners restricted), Price Controls, Exclusive Citizenship (no dual citizenship), Female Succession, Inheritance Tax, Draft Animal Permits, and more. Kings may enact or repeal laws based on their personality and mood.' },
        // OUTPOSTS
        { cat: 'Outposts', title: 'Founding Outposts', text: 'At higher ranks, you can found outposts in the wilderness. Outposts cost 500g to establish and 3g/day to maintain. They serve as small trading posts and can grow into full towns if population reaches 15+.' },
        { cat: 'Outposts', title: 'Outpost Growth', text: 'Outposts attract settlers over time. When population reaches 15+, a nearby kingdom may annex the outpost into a village. This is how new towns are born in the world — you can shape the map!' },
        { cat: 'Outposts', title: 'Outpost Risks', text: 'Outposts face theft, bandit damage, and annexation. Staff your outposts with guards to reduce risk. Abandoned outposts decay and may be destroyed.' },
        // SOCIAL RANKS
        { cat: 'Ranks', title: 'Climbing the Ranks', text: 'Social rank determines what you can do. Start as a Peasant, work up through Citizen, Burgher, Guildmaster, Minor Noble, Lord, and Royal Advisor. Each rank requires gold, reputation, and skill thresholds.' },
        { cat: 'Ranks', title: 'Rank Benefits', text: 'Higher ranks unlock: property ownership (Citizen), processing buildings (Burgher), toll roads (Guildmaster), court access (Minor Noble), militia rights (Lord), and legislative power (Royal Advisor).' },
        { cat: 'Ranks', title: 'Peasant', text: 'Starting rank. Can work basic jobs, trade at markets, and rest at inns. Must earn enough gold and reputation to petition for Citizen rank.' },
        { cat: 'Ranks', title: 'Citizen', text: 'Can own basic buildings (farms, market stalls), hire workers, and access kingdom jobs. Getting here is your first major milestone.' },
        { cat: 'Ranks', title: 'Burgher', text: 'Can own processing buildings (workshops, smithies) and access merchant contracts. At this rank you can begin building a real trade empire.' },
        { cat: 'Ranks', title: 'Guildmaster', text: 'Can build toll roads and sea routes, own luxury buildings, and influence local politics. Guildmasters are respected members of the merchant community.' },
        { cat: 'Ranks', title: 'Minor Noble & Above', text: 'Minor Noble gives access to the royal court. Lord rank grants militia command. Royal Advisor is the pinnacle — you can advise the king and shape kingdom policy.' },
        // FAMILY & DYNASTY
        { cat: 'Family', title: 'Marriage', text: 'Find a spouse through courtship — talk to NPCs, go on dates, and propose when the relationship is strong enough. Marriage provides companionship bonuses and the ability to have children.' },
        { cat: 'Family', title: 'Spouse Interactions', text: 'Interact with your spouse through 12 different actions: spend time together, give gifts, go on dates, ask for advice, and more. Keep your spouse happy — neglect damages the relationship.' },
        { cat: 'Family', title: 'Spouse Health', text: 'Your spouse has their own health, mood, and needs. They age over time and may develop health conditions. Keeping them well-fed and providing a good home improves their wellbeing.' },
        { cat: 'Family', title: 'Children & Heirs', text: 'Children grow up over time. When they reach adulthood (18), they become active members of society. Your eldest eligible child becomes your heir — if you die, you continue playing as them.' },
        { cat: 'Family', title: 'Teaching Children', text: 'You can teach your children skills and pass on knowledge. Teaching builds their abilities for when they eventually inherit. Invest in your children early for a stronger next generation.' },
        { cat: 'Family', title: 'Inheritance', text: 'When your character dies, you inherit as your heir. Your accumulated wealth, buildings, and reputation carry forward with some inheritance tax. Skills are partially inherited through XP bank.' },
        { cat: 'Family', title: 'Dynasty', text: 'Build a lasting dynasty! The game tracks your family across generations. Each successor carries the family name and legacy forward. The dynasty score combines all generations\' achievements.' },
        // ELITE MERCHANTS
        { cat: 'Elite Merchants', title: 'Who Are They?', text: 'Elite Merchants are the wealthiest and most powerful traders in the world. They have unique heraldry (house flags), travel between towns, and control significant market share. They are your main competitors.' },
        { cat: 'Elite Merchants', title: 'EM Strategies', text: 'Each EM has a strategy: trade_network (multi-town trading), luxury_trader (high-value goods), land_baron (property focused), military_supplier (weapons/armor), food_monopoly (food markets), political_climber (influence), or war_profiteer (exploits conflict).' },
        { cat: 'Elite Merchants', title: 'Interacting with EMs', text: 'You can talk to Elite Merchants, trade with them, track their movements (with the right skill), and compete for the same goods. Building relationships with EMs can open up opportunities.' },
        { cat: 'Elite Merchants', title: 'EM Caravans', text: 'Elite Merchants hire their own caravans to transport goods. These caravans follow profitable routes and can affect market prices in towns they visit. Watch their movements for trade intelligence.' },
        { cat: 'Elite Merchants', title: 'Becoming an EM', text: 'With enough wealth, buildings, and influence, you may eventually rival the Elite Merchants in power. Your gold and business empire are tracked on the leaderboard alongside theirs.' },
        // HEALTH & DANGER
        { cat: 'Health', title: 'Health Conditions', text: 'You may contract illnesses from poor housing, contaminated water, or plague events. Conditions reduce your effectiveness. Better housing provides disease resistance. Visit a hospital or use medicine skills to treat conditions.' },
        { cat: 'Health', title: 'Injuries', text: 'Combat and dangerous travel can cause injuries. Minor injuries heal over time, but serious injuries need treatment. The First Aid skill lets you self-treat minor injuries; Field Medic handles more severe cases.' },
        { cat: 'Health', title: 'Starvation', text: 'If hunger drops to 0, you begin starving. Starvation drains health every tick and can be fatal. Always carry emergency food. Bread and preserved food are lightweight and prevent starvation.' },
        { cat: 'Health', title: 'Plague Events', text: 'Plagues can sweep through towns, killing population and disrupting trade. During a plague, town happiness drops and prices for medicine spike. Stay away from plagued towns or stock up on medicine.' },
        // COMBAT & DANGER
        { cat: 'Combat', title: 'Bandits', text: 'Roads marked with ☠️ have bandit presence. Traveling these roads risks ambush. Higher combat skill and caravan guards reduce the danger.' },
        { cat: 'Combat', title: 'Combat System', text: 'Combat considers your weapons, armor, combat skills, and health. Equip weapons and armor from the Character panel. Hire guards for caravans. Combat Proficiency skill improves your chances.' },
        { cat: 'Combat', title: 'Weapons & Armor', text: 'Buy weapons (swords, bows) and armor from the market or smithies. Equipped items improve your combat rating. Higher quality equipment is more expensive but much more effective.' },
        { cat: 'Combat', title: 'Military Service', text: 'You can enlist as a soldier in a kingdom\'s army. Military service provides steady pay, combat experience, and reputation. But you must follow orders — desertion has consequences.' },
        // ECONOMY
        { cat: 'Economy', title: 'Town Prosperity', text: 'Each town has a prosperity score (0-100) based on buildings, population, food supply, and safety. Higher prosperity means better prices, more goods, and happier citizens. You can improve prosperity by building and trading.' },
        { cat: 'Economy', title: 'Town Happiness', text: 'Citizens\' happiness depends on food supply, security, taxation, and events. Unhappy towns have fewer workers and lower production. Extremely unhappy towns may see population exodus.' },
        { cat: 'Economy', title: 'Price Factors', text: 'Prices are affected by: base supply/demand, terrain type, seasonal demand, fashion trends, kingdom taxes, war disruption, trade convergence with nearby towns, and your citizen discount.' },
        { cat: 'Economy', title: 'Population Growth', text: 'Towns grow naturally when well-fed and safe. New settlements can be founded by kingdoms when existing towns are prosperous. Your outposts can also grow into new towns.' },
        // TIPS
        { cat: 'Tips', title: 'Making Money Fast', text: 'Buy goods where they are cheap (surplus towns) and sell where they are expensive (shortage towns). Coastal towns have cheap fish; mountain towns have cheap ore. Check multiple towns before committing to a trade route.' },
        { cat: 'Tips', title: 'Reputation Matters', text: 'Reputation in each kingdom determines what opportunities are available. Work for the kingdom, complete commissions, and avoid crimes to build reputation. High reputation unlocks rank promotions.' },
        { cat: 'Tips', title: 'Watch the Map', text: 'The minimap shows kingdom territories (colored regions), trade routes (yellow dashes), and danger zones. Towns with ⚠️ are unsafe. The ⚔️ symbol between territories means war.' },
        { cat: 'Tips', title: 'Diversify Income', text: 'Don\'t rely on just one income source. Combine trading, building production, toll roads, caravans, and jobs for a resilient income. When war disrupts trade, your buildings still produce.' },
        { cat: 'Tips', title: 'War Profiteering', text: 'Wars create trading opportunities. Military goods (weapons, arrows, armor) spike in price near war zones. Medical supplies become valuable. But travel near frontlines is dangerous — weigh risk vs reward.' },
        { cat: 'Tips', title: 'Early Game Strategy', text: 'Focus on: 1) Take odd jobs for initial gold, 2) Buy cheap goods and sell in the next town, 3) Save up for Citizen rank, 4) Buy your first building, 5) Hire workers and build passive income.' },
        { cat: 'Tips', title: 'Notification Filters', text: 'Too many notifications? Open Settings (⚙️) and filter by category. You can show only important notifications while hiding routine messages. Customize to focus on what matters to you.' },
        { cat: 'Tips', title: 'Check the Leaderboard', text: 'The Rankings panel shows how you compare to Elite Merchants and other powerful figures. Track your progress and aim to climb the ranks. Your dynasty score is cumulative across generations.' }
    ];

    function openGameGuide() {
        var overlay = document.createElement('div');
        overlay.id = 'game-guide-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center;';

        var panel = document.createElement('div');
        panel.style.cssText = 'background:#1a1a2e; border:2px solid #FFD700; border-radius:8px; width:700px; max-height:80vh; display:flex; flex-direction:column; color:#fff; font-family:sans-serif;';

        var header = '<div style="padding:12px 16px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">';
        header += '<span style="color:#FFD700; font-size:18px; font-weight:bold;">📖 Game Guide</span>';
        header += '<button onclick="document.getElementById(\'game-guide-overlay\').remove()" style="background:#600; color:#fff; border:1px solid #a00; padding:4px 12px; cursor:pointer; border-radius:4px;">✖ Close</button>';
        header += '</div>';

        header += '<div style="padding:8px 16px; border-bottom:1px solid #333; display:flex; flex-wrap:wrap; align-items:center;">';
        header += '<input id="guide-search" type="text" placeholder="Search guide..." oninput="window._filterGuide()" style="width:200px; background:#2a2a3e; color:#fff; border:1px solid #555; padding:6px 10px; border-radius:4px; margin-right:8px; margin-bottom:4px;" />';
        var cats = ['All', 'Getting Started', 'Trading', 'Skills', 'Buildings', 'Housing', 'Ships', 'Travel', 'Work', 'Kingdoms', 'Outposts', 'Ranks', 'Family', 'Elite Merchants', 'Health', 'Combat', 'Economy', 'Tips'];
        for (var ci = 0; ci < cats.length; ci++) {
            header += '<button onclick="window._guideCat=\'' + cats[ci] + '\'; window._filterGuide()" style="margin:2px; padding:3px 8px; background:' + (ci === 0 ? '#FFD700' : '#2a2a3e') + '; color:' + (ci === 0 ? '#000' : '#ddd') + '; border:1px solid #555; border-radius:3px; cursor:pointer; font-size:11px;" id="guide-cat-' + cats[ci].replace(/ /g, '-') + '">' + cats[ci] + '</button>';
        }
        header += '</div>';

        panel.innerHTML = header + '<div id="guide-list" style="padding:8px 16px; overflow-y:auto; flex:1;"></div>';
        overlay.appendChild(panel);

        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

        document.body.appendChild(overlay);

        window._gameGuideData = gameGuideData;
        window._guideCat = 'All';
        window._filterGuide();
    }

    window._filterGuide = function () {
        var search = (document.getElementById('guide-search') ? document.getElementById('guide-search').value : '').toLowerCase();
        var cat = window._guideCat || 'All';
        var list = document.getElementById('guide-list');
        if (!list) return;

        var html = '';
        var data = window._gameGuideData || [];
        var shown = 0;
        var lastCat = '';
        for (var i = 0; i < data.length; i++) {
            var d = data[i];
            if (cat !== 'All' && d.cat !== cat) continue;
            if (search && d.title.toLowerCase().indexOf(search) === -1 && d.text.toLowerCase().indexOf(search) === -1 && d.cat.toLowerCase().indexOf(search) === -1) continue;
            if (d.cat !== lastCat) {
                if (lastCat) html += '<div style="height:8px;"></div>';
                html += '<div style="color:#FFD700; font-size:13px; font-weight:bold; padding:8px 0 4px; border-bottom:1px solid #444; text-transform:uppercase; letter-spacing:1px;">' + d.cat + '</div>';
                lastCat = d.cat;
            }
            html += '<div style="padding:8px 0; border-bottom:1px solid #222;">';
            html += '<div style="color:#FFD700; font-size:14px; font-weight:bold; margin-bottom:4px;">' + d.title + '</div>';
            html += '<div style="color:#ccc; font-size:13px; line-height:1.5;">' + d.text + '</div>';
            html += '</div>';
            shown++;
        }
        if (shown === 0) html = '<div style="color:#888; padding:20px; text-align:center;">No guide entries match your search</div>';
        list.innerHTML = html;

        var cats = ['All', 'Getting Started', 'Trading', 'Skills', 'Buildings', 'Housing', 'Ships', 'Travel', 'Work', 'Kingdoms', 'Outposts', 'Ranks', 'Family', 'Elite Merchants', 'Health', 'Combat', 'Economy', 'Tips'];
        for (var ci = 0; ci < cats.length; ci++) {
            var btn = document.getElementById('guide-cat-' + cats[ci].replace(/ /g, '-'));
            if (btn) {
                btn.style.background = cats[ci] === cat ? '#FFD700' : '#2a2a3e';
                btn.style.color = cats[ci] === cat ? '#000' : '#ddd';
            }
        }
    };

    // ========================================================
    // ADVISE THE KING DIALOG
    // ========================================================
    function openAdviseKingDialog(kingdomId) {
        if (typeof Player === 'undefined' || !Player.royalAdvisorBenefits) return;

        let kingdom;
        try { kingdom = Engine.getKingdom(kingdomId); } catch (e) { return; }
        if (!kingdom) return;

        const capital = Player.politicalCapital || 0;
        let html = `<div class="detail-section">
            <p>As Royal Advisor, you may counsel the King of ${kingdom.name}.</p>
            <p><b>Political Capital:</b> ${capital} / ${CONFIG.ADVISE_KING_POLITICAL_CAPITAL_MAX} uses remaining this season</p>
            ${capital <= 0 ? '<p style="color:var(--danger)">No political capital remaining. Wait until next season.</p>' : ''}
        </div>`;

        if (capital > 0) {
            html += `<div class="detail-section"><h3>Counsel Options</h3>`;

            html += `<div class="detail-row" style="cursor:pointer" onclick="UI.executeAdvice('${kingdomId}','lower_taxes')">
                <span class="label">📉 Lower Taxes</span>
                <span class="value text-dim">Suggest reducing kingdom tax rate</span>
            </div>`;
            html += `<div class="detail-row" style="cursor:pointer" onclick="UI.executeAdvice('${kingdomId}','raise_taxes')">
                <span class="label">📈 Raise Taxes</span>
                <span class="value text-dim">Suggest increasing kingdom tax rate</span>
            </div>`;
            html += `<div class="detail-row" style="cursor:pointer" onclick="UI.executeAdvice('${kingdomId}','build_walls')">
                <span class="label">🏰 Fortify Towns</span>
                <span class="value text-dim">Suggest building fortifications</span>
            </div>`;

            // War/Peace options
            let kingdoms;
            try { kingdoms = Engine.getKingdoms(); } catch (e) { kingdoms = []; }
            const enemies = kingdoms.filter(k => k.id !== kingdomId && kingdom.atWar && kingdom.atWar.includes(k.id));
            const potentials = kingdoms.filter(k => k.id !== kingdomId && (!kingdom.atWar || !kingdom.atWar.includes(k.id)));

            if (enemies.length > 0) {
                for (const enemy of enemies) {
                    html += `<div class="detail-row" style="cursor:pointer" onclick="UI.executeAdvice('${kingdomId}','make_peace','${enemy.id}')">
                        <span class="label">🕊️ Seek Peace with ${enemy.name}</span>
                        <span class="value text-dim">End the war diplomatically</span>
                    </div>`;
                }
            }
            if (potentials.length > 0) {
                for (const pot of potentials.slice(0, 3)) {
                    html += `<div class="detail-row" style="cursor:pointer" onclick="UI.executeAdvice('${kingdomId}','declare_war','${pot.id}')">
                        <span class="label">⚔ Provoke ${pot.name}</span>
                        <span class="value text-dim">Worsen relations (may lead to war)</span>
                    </div>`;
                }
            }

            html += `</div>`;
        }

        openModal('👑 Advise the King', html);
    }

    function executeAdvice(kingdomId, adviceType, adviceValue) {
        if (typeof Player === 'undefined' || !Player.adviseKing) return;
        const result = Player.adviseKing(kingdomId, adviceType, adviceValue);
        if (result && result.success) {
            toast(result.reason, 'success');
        } else {
            toast(result ? result.reason : 'Advice failed.', 'warning');
        }
        closeModal();
    }

    function showKingSuccessionPopup(kingdomName, newKingName, cause) {
        const html = `<div class="detail-section">
            <p>The ruler of <b>${kingdomName}</b> has ${cause === 'old_age' ? 'died of old age' : cause === 'coup' ? 'been overthrown in a coup' : cause === 'war' ? 'fallen in battle' : 'died'}.</p>
            <p><b>${newKingName}</b> has ascended to the throne!</p>
            <p>Diplomatic relations may shift under the new ruler.</p>
        </div>`;
        openModal('👑 Royal Succession', html, '<button class="btn-medieval" onclick="UI.closeModal()">Acknowledge</button>');
    }

    // ── Degradation Repair Handlers ──
    function repairBuildingUI(buildingId) {
        if (typeof Player === 'undefined' || !Player.repairBuilding) return;
        const result = Player.repairBuilding(buildingId);
        if (result && result.success) {
            toast(result.message, 'success');
            openBuildingManagement();
        } else {
            toast(result ? result.message : 'Repair failed.', 'warning');
        }
    }

    function repairShipUI(shipId) {
        if (typeof Player === 'undefined' || !Player.repairShip) return;
        const result = Player.repairShip(shipId);
        if (result && result.success) {
            toast(result.message, 'success');
            openCharacterDialog();
        } else {
            toast(result ? result.message : 'Repair failed.', 'warning');
        }
    }

    // ── Toll Route UI Functions ──

    function showTollRoutesPanel() {
        const owned = Player.getPlayerOwnedRoutes();
        let html = '<div style="padding:15px;">';
        html += '<h3 style="color:#ffd700;margin-bottom:10px;">\uD83D\uDEE4\uFE0F Your Toll Routes</h3>';

        if (owned.length === 0) {
            html += '<p style="color:#aaa;">You don\'t own any toll routes yet. Build roads or sea routes to start earning toll revenue!</p>';
        } else {
            html += '<table style="width:100%;border-collapse:collapse;">';
            html += '<tr style="border-bottom:1px solid #555;"><th style="text-align:left;padding:5px;">Route</th><th>Type</th><th>Toll</th><th>Revenue</th><th>Action</th></tr>';
            for (const r of owned) {
                html += '<tr style="border-bottom:1px solid #333;">';
                html += '<td style="padding:5px;">' + r.fromName + ' \u2194 ' + r.toName + '</td>';
                html += '<td style="text-align:center;">' + (r.type === 'sea' ? '\u2693' : '\uD83D\uDEE4\uFE0F') + ' ' + r.type + '</td>';
                html += '<td style="text-align:center;">' + r.tollRate + 'g</td>';
                html += '<td style="text-align:center;color:#ffd700;">' + Math.floor(r.tollRevenue || 0) + 'g</td>';
                html += '<td style="text-align:center;">';
                html += '<button class="btn-medieval" style="font-size:0.7rem;padding:3px 8px;" onclick="UI.changeTollRate(\'' + r.type + '\',\'' + r.fromTownId + '\',\'' + r.toTownId + '\')">Set Rate</button>';
                html += '</td></tr>';
            }
            html += '</table>';
        }

        html += '<div style="margin-top:15px;">';
        html += '<button class="btn-medieval" onclick="UI.collectTolls()" style="padding:8px 20px;">\uD83D\uDCB0 Collect All Revenue</button>';
        html += '</div>';
        html += '</div>';

        openModal('Toll Routes', html);
    }

    function changeTollRate(routeType, fromTownId, toTownId) {
        var rate = prompt('Set toll rate (' + CONFIG.TOLL_MIN_RATE + '-' + CONFIG.TOLL_MAX_RATE + ' gold per use):', CONFIG.TOLL_DEFAULT_RATE);
        if (rate === null) return;
        var numRate = parseInt(rate);
        if (isNaN(numRate)) return;
        var result = Player.setTollRate(routeType, fromTownId, toTownId, numRate);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showTollRoutesPanel();
    }

    function collectTollsUI() {
        var amount = Player.collectTollRevenue();
        if (amount > 0) {
            toast('\uD83D\uDCB0 Collected ' + Math.floor(amount) + 'g in toll revenue!', 'success');
        } else {
            toast('No toll revenue to collect.', 'info');
        }
        showTollRoutesPanel();
    }

    function showBuildRouteSelector(type) {
        var towns = Engine.getTowns();
        var currentTown = Engine.findTown(Player.townId);
        if (!currentTown) return;

        var roads = Engine.getRoads();
        var seaRoutes = Engine.getSeaRoutes ? Engine.getSeaRoutes() : [];
        var candidates = [];

        if (type === 'toll_road' || type === 'petition') {
            candidates = towns.filter(function(t) {
                if (t.id === Player.townId) return false;
                if (t.destroyed) return false;
                var d = Math.hypot(currentTown.x - t.x, currentTown.y - t.y);
                if (d > 3000) return false;
                if (type === 'petition' && t.kingdomId !== currentTown.kingdomId) return false;
                var hasRoad = roads.some(function(r) {
                    return (r.fromTownId === Player.townId && r.toTownId === t.id) ||
                           (r.fromTownId === t.id && r.toTownId === Player.townId);
                });
                return !hasRoad;
            });
        } else if (type === 'sea_route') {
            if (!currentTown.isPort) { toast('Must be in a port town!', 'warning'); return; }
            candidates = towns.filter(function(t) {
                if (t.id === Player.townId) return false;
                if (t.destroyed) return false;
                if (!t.isPort) return false;
                var hasRoute = seaRoutes.some(function(r) {
                    return (r.fromTownId === Player.townId && r.toTownId === t.id) ||
                           (r.fromTownId === t.id && r.toTownId === Player.townId);
                });
                return !hasRoute;
            });
        }

        if (candidates.length === 0) {
            toast('No valid destinations available.', 'info');
            return;
        }

        candidates.sort(function(a, b) {
            var da = Math.hypot(currentTown.x - a.x, currentTown.y - a.y);
            var db = Math.hypot(currentTown.x - b.x, currentTown.y - b.y);
            return da - db;
        });

        var titles = { toll_road: '\uD83D\uDEE4\uFE0F Build Toll Road To...', sea_route: '\u2693 Build Sea Route To...', petition: '\uD83D\uDC51 Petition King to Build Road To...' };
        var html = '<div style="padding:15px;max-height:400px;overflow-y:auto;">';
        html += '<h3 style="color:#ffd700;margin-bottom:10px;">' + titles[type] + '</h3>';

        for (var i = 0; i < candidates.length; i++) {
            var t = candidates[i];
            var d = Math.hypot(currentTown.x - t.x, currentTown.y - t.y);
            var kingdom = Engine.findKingdom(t.kingdomId);
            var costEstimate = '';

            if (type === 'toll_road') {
                var waterFrac = Engine.checkWaterFraction(currentTown.x, currentTown.y, t.x, t.y);
                var cost = CONFIG.TOLL_ROAD_BASE_COST + Math.floor(d * CONFIG.TOLL_ROAD_DIST_COST) + (waterFrac > 0 ? Math.floor(CONFIG.TOLL_ROAD_BASE_COST * waterFrac * CONFIG.TOLL_ROAD_WATER_MULTIPLIER) : 0);
                var timberNeeded = Math.ceil(d / 100) * CONFIG.TOLL_ROAD_TIMBER_PER_100;
                var stoneNeeded = Math.ceil(d / 100) * CONFIG.TOLL_ROAD_STONE_PER_100;
                var ironNeeded = Math.ceil(d / 100) * CONFIG.TOLL_ROAD_IRON_PER_100;
                if (waterFrac > CONFIG.TOLL_ROAD_MAX_WATER_FRACTION) {
                    costEstimate = '<span style="color:#f44;">Too much water \u2014 impassable</span>';
                } else {
                    costEstimate = '<span style="color:#ccc;">~' + cost.toLocaleString() + 'g + ' + timberNeeded + ' timber, ' + stoneNeeded + ' stone, ' + ironNeeded + ' iron</span>';
                }
            } else if (type === 'sea_route') {
                var seaCost = CONFIG.TOLL_SEA_BASE_COST + CONFIG.TOLL_SEA_DOCK_COST * 2 + Math.floor(d * 5);
                costEstimate = '<span style="color:#ccc;">~' + seaCost.toLocaleString() + 'g + ' + CONFIG.TOLL_SEA_TIMBER_NEEDED + ' timber, ' + CONFIG.TOLL_SEA_STONE_NEEDED + ' stone, ' + CONFIG.TOLL_SEA_IRON_NEEDED + ' iron</span>';
            } else if (type === 'petition') {
                var fullCost = CONFIG.TOLL_ROAD_BASE_COST + Math.floor(d * CONFIG.TOLL_ROAD_DIST_COST);
                var playerCost = Math.floor(fullCost * CONFIG.KING_INFLUENCE_COST_FRACTION);
                costEstimate = '<span style="color:#ccc;">~' + playerCost.toLocaleString() + 'g (your 10% share)</span>';
            }

            var btnAction = '';
            if (type === 'toll_road') btnAction = "UI.buildTollRoad('" + t.id + "')";
            else if (type === 'sea_route') btnAction = "UI.buildSeaRoute('" + t.id + "')";
            else if (type === 'petition') btnAction = "UI.petitionKingForRoad('" + t.id + "')";

            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #333;">';
            html += '<div><strong>' + t.name + '</strong> (' + (kingdom ? kingdom.name : '?') + ') \u2014 ' + Math.floor(d) + ' dist<br>' + costEstimate + '</div>';
            html += '<button class="btn-medieval" style="font-size:0.75rem;padding:4px 12px;white-space:nowrap;" onclick="' + btnAction + '">Select</button>';
            html += '</div>';
        }
        html += '</div>';
        openModal(titles[type], html);
    }

    function buildTollRoad(targetTownId) {
        var result = Player.playerBuildTollRoad(targetTownId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) closeModal();
    }

    function buildSeaRoute(targetTownId) {
        var result = Player.playerBuildSeaRoute(targetTownId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) closeModal();
    }

    function petitionKingForRoad(targetTownId) {
        var result = Player.influenceKingToBuildRoad(targetTownId);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) closeModal();
    }

    // ═══════════════════════════════════════════════════════════
    //  PETITION SYSTEM UI
    // ═══════════════════════════════════════════════════════════

    function showPetitionsPanel() {
        var active = Player.getActivePetitions();
        var history = Player.getPetitionHistory();
        var html = '<div style="padding:15px;">';

        html += '<h3 style="color:#d4a017;margin-bottom:10px;">📜 Your Petitions</h3>';

        if (active.length === 0 && history.length === 0) {
            html += '<p style="color:#aaa;">You have no petitions yet. Create one to rally support for a cause!</p>';
        }

        // Active petitions
        if (active.length > 0) {
            html += '<h4 style="color:#ccc;margin:10px 0 5px;">Active Petitions</h4>';
            for (var i = 0; i < active.length; i++) {
                var p = active[i];
                var pType = (typeof PETITION_TYPES !== 'undefined') ? PETITION_TYPES.find(function(t) { return t.id === p.typeId; }) : null;
                var estimate = Player.getPetitionChanceEstimate(p.id);
                var daysLeft = CONFIG.PETITION_MAX_DURATION_DAYS - ((typeof Engine !== 'undefined' ? Engine.getDay() : 0) - p.createdDay);
                var sigPct = estimate ? estimate.signaturePct.toFixed(1) : '0.0';
                var barColor = '#f44';
                if (estimate && estimate.signaturePct >= CONFIG.PETITION_GREAT_CHANCE_PCT) barColor = '#ffd700';
                else if (estimate && estimate.signaturePct >= CONFIG.PETITION_GOOD_CHANCE_PCT) barColor = '#4c4';
                else if (estimate && estimate.signaturePct >= CONFIG.PETITION_MIN_SIGNATURES_PCT) barColor = '#cc4';
                var barWidth = Math.min(100, estimate ? estimate.signaturePct * 4 : 0);
                var activePtrs = p.petitioners.filter(function(pt) { return pt.active; }).length;

                html += '<div style="background:rgba(50,50,50,0.8);border:1px solid #555;border-radius:6px;padding:10px;margin-bottom:8px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                html += '<span style="font-size:1.1em;">' + (pType ? pType.icon : '📜') + ' <strong>' + (pType ? pType.name : p.typeId) + '</strong></span>';
                html += '<span style="color:#aaa;font-size:0.85em;">' + daysLeft + ' days left</span>';
                html += '</div>';
                html += '<div style="margin:6px 0;">';
                html += '<div style="background:#333;border-radius:4px;height:14px;overflow:hidden;">';
                html += '<div style="background:' + barColor + ';height:100%;width:' + barWidth + '%;transition:width 0.3s;"></div>';
                html += '</div>';
                html += '<div style="display:flex;justify-content:space-between;font-size:0.8em;color:#aaa;margin-top:2px;">';
                html += '<span>' + p.signatures.length + ' signatures (' + sigPct + '%)</span>';
                html += '<span>' + activePtrs + ' petitioner' + (activePtrs !== 1 ? 's' : '') + '</span>';
                html += '</div></div>';
                html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
                html += '<button class="btn-medieval" style="font-size:0.75rem;padding:4px 10px;" onclick="UI.showPetitionDetail(\'' + p.id + '\')">📋 Manage</button>';
                if (estimate && estimate.chance > 0) {
                    html += '<button class="btn-medieval" style="font-size:0.75rem;padding:4px 10px;background:rgba(100,200,100,0.2);border-color:rgba(100,200,100,0.4);" onclick="UI.submitPetitionUI(\'' + p.id + '\')">✅ Submit (~' + Math.floor(estimate.chance * 100) + '%)</button>';
                }
                html += '<button class="btn-medieval" style="font-size:0.75rem;padding:4px 10px;background:rgba(200,50,50,0.2);border-color:rgba(200,50,50,0.4);" onclick="UI.cancelPetitionUI(\'' + p.id + '\')">❌ Cancel</button>';
                html += '</div></div>';
            }
        }

        // History
        var past = history.filter(function(p) { return p.status !== 'active'; });
        if (past.length > 0) {
            html += '<h4 style="color:#ccc;margin:15px 0 5px;">Petition History</h4>';
            for (var j = 0; j < Math.min(10, past.length); j++) {
                var p = past[past.length - 1 - j];
                var pType = (typeof PETITION_TYPES !== 'undefined') ? PETITION_TYPES.find(function(t) { return t.id === p.typeId; }) : null;
                var statusIcon = p.status === 'approved' ? '✅' : (p.status === 'cancelled' ? '🚫' : '❌');
                var statusColor = p.status === 'approved' ? '#4c4' : (p.status === 'cancelled' ? '#aaa' : '#f44');
                html += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #333;font-size:0.85em;">';
                html += '<span>' + (pType ? pType.icon : '📜') + ' ' + (pType ? pType.name : p.typeId) + '</span>';
                html += '<span style="color:' + statusColor + ';">' + statusIcon + ' ' + p.status + ' (' + p.signatures.length + ' sigs)</span>';
                html += '</div>';
            }
        }

        html += '<div style="margin-top:15px;">';
        html += '<button class="btn-medieval" style="padding:8px 20px;background:rgba(212,160,23,0.2);border-color:rgba(212,160,23,0.5);" onclick="UI.showCreatePetitionPanel()">📜 Create New Petition</button>';
        html += '</div></div>';

        openModal('Petitions', html);
    }

    function showCreatePetitionPanel() {
        var hasCitizenship = (Player.citizenshipKingdomId) || (Player.isPlayerCitizenOf && Object.keys(Player.socialRank || {}).some(function(k) { return Player.isPlayerCitizenOf(k); }));
        if (!hasCitizenship) {
            toast('You must be a citizen of a kingdom to create petitions.', 'warning', 'my_kingdom');
            return;
        }
        var html = '<div style="padding:15px;">';
        html += '<h3 style="color:#d4a017;margin-bottom:10px;">📜 Create New Petition</h3>';
        html += '<p style="color:#aaa;font-size:0.85em;margin-bottom:10px;">Choose a cause to petition the king about. You\'ll gather signatures from NPCs to strengthen your case.</p>';

        if (typeof PETITION_TYPES === 'undefined') { html += '<p>No petition types available.</p></div>'; openModal('Create Petition', html); return; }

        for (var i = 0; i < PETITION_TYPES.length; i++) {
            var pt = PETITION_TYPES[i];
            html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px;margin-bottom:4px;background:rgba(50,50,50,0.6);border:1px solid #444;border-radius:4px;">';
            html += '<div style="flex:1;">';
            html += '<span style="font-size:1.1em;">' + pt.icon + '</span> <strong>' + pt.name + '</strong>';
            html += '<div style="color:#aaa;font-size:0.8em;">' + pt.desc + '</div>';
            html += '</div>';
            html += '<button class="btn-medieval" style="font-size:0.75rem;padding:4px 12px;margin-left:8px;" onclick="UI.selectPetitionType(\'' + pt.id + '\')">Select</button>';
            html += '</div>';
        }
        html += '</div>';
        openModal('Create Petition', html);
    }

    function selectPetitionType(typeId) {
        var pt = (typeof PETITION_TYPES !== 'undefined') ? PETITION_TYPES.find(function(t) { return t.id === typeId; }) : null;
        if (!pt) return;

        if (!pt.requiresTarget) {
            var result = Player.createPetition(typeId, null);
            toast(result.message, result.success ? 'success' : 'warning');
            if (result.success) showPetitionsPanel();
            return;
        }

        var html = '<div style="padding:15px;">';
        html += '<h3 style="color:#d4a017;margin-bottom:10px;">' + pt.icon + ' ' + pt.name + '</h3>';
        html += '<p style="color:#aaa;font-size:0.85em;margin-bottom:10px;">' + pt.desc + '</p>';

        var playerKingdomId = Player.citizenshipKingdomId || (Player.state ? Player.state.citizenshipKingdomId : null);

        if (pt.targetType === 'town') {
            html += '<h4 style="color:#ccc;">Select a Town:</h4>';
            var towns = (typeof Engine !== 'undefined' && Engine.getTowns) ? Engine.getTowns() : [];
            var kTowns = towns.filter(function(t) { return t.kingdomId === playerKingdomId; });
            for (var i = 0; i < kTowns.length; i++) {
                html += '<button class="btn-medieval" style="display:block;width:100%;text-align:left;padding:6px 12px;margin:3px 0;font-size:0.85rem;" ';
                html += 'onclick="UI.confirmCreatePetition(\'' + typeId + '\', {townId:\'' + kTowns[i].id + '\',townName:\'' + kTowns[i].name.replace(/'/g, "\\'") + '\'})">';
                html += '🏘️ ' + kTowns[i].name;
                html += '</button>';
            }
        } else if (pt.targetType === 'town_pair') {
            html += '<h4 style="color:#ccc;">Select Towns:</h4>';
            var towns = (typeof Engine !== 'undefined' && Engine.getTowns) ? Engine.getTowns() : [];
            var kTowns = towns.filter(function(t) { return t.kingdomId === playerKingdomId; });
            html += '<div style="margin-bottom:8px;"><label style="color:#aaa;">From: </label>';
            html += '<select id="petFromTown" style="background:#333;color:#eee;border:1px solid #555;padding:4px;border-radius:3px;">';
            for (var i = 0; i < kTowns.length; i++) {
                html += '<option value="' + kTowns[i].id + '">' + kTowns[i].name + '</option>';
            }
            html += '</select></div>';
            html += '<div style="margin-bottom:8px;"><label style="color:#aaa;">To: </label>';
            html += '<select id="petToTown" style="background:#333;color:#eee;border:1px solid #555;padding:4px;border-radius:3px;">';
            for (var i = 0; i < kTowns.length; i++) {
                html += '<option value="' + kTowns[i].id + '">' + kTowns[i].name + '</option>';
            }
            html += '</select></div>';
            html += '<button class="btn-medieval" style="padding:6px 16px;" onclick="UI.confirmCreatePetitionTownPair(\'' + typeId + '\')">Create Petition</button>';
        } else if (pt.targetType === 'road') {
            html += '<h4 style="color:#ccc;">Select a Road:</h4>';
            var roads = (typeof Engine !== 'undefined' && Engine.getRoads) ? Engine.getRoads() : [];
            for (var i = 0; i < roads.length; i++) {
                var r = roads[i];
                var ft = Engine.findTown(r.fromTownId);
                var tt = Engine.findTown(r.toTownId);
                if (!ft || !tt) continue;
                if (ft.kingdomId !== playerKingdomId && tt.kingdomId !== playerKingdomId) continue;
                var rName = ft.name + ' ↔ ' + tt.name;
                html += '<button class="btn-medieval" style="display:block;width:100%;text-align:left;padding:6px 12px;margin:3px 0;font-size:0.85rem;" ';
                html += 'onclick="UI.confirmCreatePetition(\'' + typeId + '\', {roadIndex:' + i + ',roadName:\'' + rName.replace(/'/g, "\\'") + '\'})">';
                html += '🛤️ ' + rName;
                html += '</button>';
            }
        } else if (pt.targetType === 'kingdom') {
            html += '<h4 style="color:#ccc;">Select a Kingdom:</h4>';
            var kingdoms = (typeof Engine !== 'undefined' && Engine.getKingdoms) ? Engine.getKingdoms() : [];
            for (var i = 0; i < kingdoms.length; i++) {
                if (kingdoms[i].id === playerKingdomId) continue;
                html += '<button class="btn-medieval" style="display:block;width:100%;text-align:left;padding:6px 12px;margin:3px 0;font-size:0.85rem;" ';
                html += 'onclick="UI.confirmCreatePetition(\'' + typeId + '\', {targetKingdomId:\'' + kingdoms[i].id + '\',targetKingdomName:\'' + kingdoms[i].name.replace(/'/g, "\\'") + '\'})">';
                html += '👑 ' + kingdoms[i].name;
                html += '</button>';
            }
        } else if (pt.targetType === 'resource') {
            html += '<h4 style="color:#ccc;">Select a Resource:</h4>';
            var resources = (typeof RESOURCES !== 'undefined') ? RESOURCES : [];
            for (var i = 0; i < resources.length; i++) {
                html += '<button class="btn-medieval" style="display:block;width:100%;text-align:left;padding:6px 12px;margin:3px 0;font-size:0.85rem;" ';
                html += 'onclick="UI.confirmCreatePetition(\'' + typeId + '\', {resourceId:\'' + resources[i].id + '\',resourceName:\'' + resources[i].name.replace(/'/g, "\\'") + '\'})">';
                html += (resources[i].icon || '📦') + ' ' + resources[i].name;
                html += '</button>';
            }
        }

        html += '</div>';
        openModal('Create Petition — ' + pt.name, html);
    }

    function confirmCreatePetition(typeId, targetData) {
        var result = Player.createPetition(typeId, targetData);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showPetitionsPanel();
    }

    function confirmCreatePetitionTownPair(typeId) {
        var fromSel = document.getElementById('petFromTown');
        var toSel = document.getElementById('petToTown');
        if (!fromSel || !toSel) return;
        if (fromSel.value === toSel.value) { toast('Must select two different towns.', 'warning'); return; }
        var fromTown = Engine.findTown(fromSel.value);
        var toTown = Engine.findTown(toSel.value);
        var td = {
            fromTownId: fromSel.value,
            toTownId: toSel.value,
            fromName: fromTown ? fromTown.name : fromSel.value,
            toName: toTown ? toTown.name : toSel.value,
        };
        var result = Player.createPetition(typeId, td);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showPetitionsPanel();
    }

    function showPetitionDetail(petitionId) {
        var petitions = Player.getPetitionHistory();
        var petition = petitions.find(function(p) { return p.id === petitionId; });
        if (!petition) { toast('Petition not found.', 'warning', 'my_kingdom'); return; }

        var pType = (typeof PETITION_TYPES !== 'undefined') ? PETITION_TYPES.find(function(t) { return t.id === petition.typeId; }) : null;
        var estimate = Player.getPetitionChanceEstimate(petitionId);
        var daysLeft = CONFIG.PETITION_MAX_DURATION_DAYS - ((typeof Engine !== 'undefined' ? Engine.getDay() : 0) - petition.createdDay);
        var html = '<div style="padding:15px;">';

        // Header
        html += '<h3 style="color:#d4a017;margin-bottom:5px;">' + (pType ? pType.icon : '📜') + ' ' + (pType ? pType.name : petition.typeId) + '</h3>';
        if (pType) html += '<p style="color:#aaa;font-size:0.85em;">' + pType.desc + '</p>';
        html += '<div style="color:#ccc;font-size:0.85em;margin-bottom:8px;">Days remaining: <strong>' + Math.max(0, daysLeft) + '</strong> | Status: <strong>' + petition.status + '</strong></div>';

        // Signature progress
        if (estimate) {
            var sigPct = estimate.signaturePct.toFixed(1);
            var barColor = '#f44';
            if (estimate.signaturePct >= CONFIG.PETITION_GREAT_CHANCE_PCT) barColor = '#ffd700';
            else if (estimate.signaturePct >= CONFIG.PETITION_GOOD_CHANCE_PCT) barColor = '#4c4';
            else if (estimate.signaturePct >= CONFIG.PETITION_MIN_SIGNATURES_PCT) barColor = '#cc4';
            var barWidth = Math.min(100, estimate.signaturePct * 4);

            html += '<div style="background:rgba(40,40,40,0.8);border:1px solid #555;border-radius:4px;padding:8px;margin-bottom:10px;">';
            html += '<h4 style="color:#ddd;margin:0 0 5px;">📊 Signatures</h4>';
            html += '<div style="background:#333;border-radius:4px;height:18px;overflow:hidden;position:relative;">';
            html += '<div style="background:' + barColor + ';height:100%;width:' + barWidth + '%;transition:width 0.3s;"></div>';
            // Threshold markers
            html += '<div style="position:absolute;left:' + (CONFIG.PETITION_MIN_SIGNATURES_PCT * 4) + '%;top:0;bottom:0;border-left:2px dashed #888;" title="5% minimum"></div>';
            html += '<div style="position:absolute;left:' + (CONFIG.PETITION_GOOD_CHANCE_PCT * 4) + '%;top:0;bottom:0;border-left:2px dashed #cc4;" title="15% good"></div>';
            html += '</div>';
            html += '<div style="font-size:0.8em;color:#aaa;margin-top:4px;">';
            html += petition.signatures.length + ' signatures (' + estimate.totalWeightedSignatures + ' weighted) — ' + sigPct + '% of ' + estimate.kingdomPop + ' population';
            html += '</div>';
            if (estimate.signaturesNeeded5pct > 0) {
                html += '<div style="color:#f88;font-size:0.8em;">Need ' + estimate.signaturesNeeded5pct + ' more weighted signatures for minimum chance (' + CONFIG.PETITION_MIN_SIGNATURES_PCT + '%)</div>';
            }
            if (estimate.signaturesNeeded15pct > 0 && estimate.signaturePct >= CONFIG.PETITION_MIN_SIGNATURES_PCT) {
                html += '<div style="color:#cc4;font-size:0.8em;">Need ' + estimate.signaturesNeeded15pct + ' more for good chance (' + CONFIG.PETITION_GOOD_CHANCE_PCT + '%)</div>';
            }
            if (estimate.chance > 0) {
                html += '<div style="color:#4c4;font-size:0.85em;margin-top:4px;">Estimated approval chance: <strong>' + Math.floor(estimate.chance * 100) + '%</strong></div>';
            }
            html += '</div>';
        }

        // Request Signature section
        if (petition.status === 'active') {
            html += '<div style="background:rgba(40,40,40,0.8);border:1px solid #555;border-radius:4px;padding:8px;margin-bottom:10px;">';
            html += '<h4 style="color:#ddd;margin:0 0 5px;">✍️ Request Signatures (NPCs in town)</h4>';
            var world = (typeof Engine !== 'undefined') ? Engine.getWorld() : null;
            if (world && world.people) {
                var townNpcs = world.people.filter(function(p) {
                    return p.alive && p.townId === Player.townId &&
                           p.kingdomId === petition.kingdomId &&
                           !petition.signatures.includes(p.id);
                });
                if (townNpcs.length === 0) {
                    html += '<p style="color:#aaa;font-size:0.85em;">No eligible NPCs in this town to ask.</p>';
                } else {
                    html += '<div style="max-height:200px;overflow-y:auto;">';
                    for (var n = 0; n < Math.min(20, townNpcs.length); n++) {
                        var npc = townNpcs[n];
                        var occLabel = npc.occupation || 'citizen';
                        if (npc.isEliteMerchant) occLabel = '⭐ Elite Merchant';
                        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #333;">';
                        html += '<span style="font-size:0.85em;">' + npc.firstName + ' ' + npc.lastName + ' <span style="color:#888;">(' + occLabel + ')</span></span>';
                        html += '<button class="btn-medieval" style="font-size:0.7rem;padding:2px 8px;" onclick="UI.askNPCToSign(\'' + petition.id + '\',\'' + npc.id + '\')">Ask</button>';
                        html += '</div>';
                    }
                    if (townNpcs.length > 20) {
                        html += '<p style="color:#aaa;font-size:0.8em;">...and ' + (townNpcs.length - 20) + ' more eligible NPCs.</p>';
                    }
                    html += '</div>';
                }
            }
            html += '</div>';

            // Petitioner management
            html += '<div style="background:rgba(40,40,40,0.8);border:1px solid #555;border-radius:4px;padding:8px;margin-bottom:10px;">';
            html += '<h4 style="color:#ddd;margin:0 0 5px;">🏃 Petitioners</h4>';
            var activePtrs = petition.petitioners.filter(function(pt) { return pt.active; });
            if (activePtrs.length > 0) {
                for (var pi = 0; pi < activePtrs.length; pi++) {
                    var ptr = activePtrs[pi];
                    var ptrTown = (typeof Engine !== 'undefined') ? Engine.findTown(ptr.currentTownId) : null;
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #333;font-size:0.85em;">';
                    html += '<span>' + (ptr.mounted ? '🐴 Mounted' : '🚶 Basic') + ' — in ' + (ptrTown ? ptrTown.name : '?') + ' — ' + ptr.signaturesCollected + ' sigs — ' + ptr.dailyCost + 'g/day</span>';
                    html += '<button class="btn-medieval" style="font-size:0.7rem;padding:2px 8px;background:rgba(200,50,50,0.2);" onclick="UI.firePetitionerUI(\'' + petition.id + '\',\'' + ptr.id + '\')">Fire</button>';
                    html += '</div>';
                }
            } else {
                html += '<p style="color:#aaa;font-size:0.85em;">No active petitioners.</p>';
            }
            html += '<div style="display:flex;gap:6px;margin-top:8px;">';
            html += '<button class="btn-medieval" style="font-size:0.8rem;padding:5px 12px;" onclick="UI.hirePetitionerUI(\'' + petition.id + '\',false)">🚶 Hire Basic (' + CONFIG.PETITIONER_BASIC_COST + 'g/day)</button>';
            html += '<button class="btn-medieval" style="font-size:0.8rem;padding:5px 12px;" onclick="UI.hirePetitionerUI(\'' + petition.id + '\',true)">🐴 Hire Mounted (' + CONFIG.PETITIONER_MOUNTED_COST + 'g/day)</button>';
            html += '</div></div>';

            // Action buttons
            html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">';
            if (estimate && estimate.chance > 0) {
                html += '<button class="btn-medieval" style="padding:8px 16px;background:rgba(100,200,100,0.2);border-color:rgba(100,200,100,0.4);" onclick="UI.submitPetitionUI(\'' + petition.id + '\')">✅ Submit Petition (~' + Math.floor(estimate.chance * 100) + '% chance)</button>';
            }
            html += '<button class="btn-medieval" style="padding:8px 16px;background:rgba(200,50,50,0.2);border-color:rgba(200,50,50,0.4);" onclick="UI.cancelPetitionUI(\'' + petition.id + '\')">❌ Cancel Petition</button>';
            html += '<button class="btn-medieval" style="padding:8px 16px;" onclick="UI.showPetitionsPanel()">⬅️ Back</button>';
            html += '</div>';
        }

        html += '</div>';
        openModal('Petition Detail', html);
    }

    function askNPCToSign(petitionId, npcId) {
        var result = Player.requestSignature(petitionId, npcId);
        toast(result.message, result.signed ? 'success' : 'info');
        showPetitionDetail(petitionId);
    }

    function hirePetitionerUI(petitionId, mounted) {
        var result = Player.hirePetitioner(petitionId, mounted);
        toast(result.message, result.success ? 'success' : 'warning');
        if (result.success) showPetitionDetail(petitionId);
    }

    function firePetitionerUI(petitionId, petitionerId) {
        var result = Player.firePetitioner(petitionId, petitionerId);
        toast(result.message, result.success ? 'success' : 'warning');
        showPetitionDetail(petitionId);
    }

    function submitPetitionUI(petitionId) {
        var result = Player.submitPetition(petitionId);
        if (result.approved) {
            toast(result.message, 'success');
        } else {
            toast(result.message, result.success ? 'warning' : 'danger');
        }
        showPetitionsPanel();
    }

    function cancelPetitionUI(petitionId) {
        var result = Player.cancelPetition(petitionId);
        toast(result.message, result.success ? 'info' : 'warning');
        showPetitionsPanel();
    }

    // ========================================================
    // WAR CONFLICT CHOICE UI
    // ========================================================
    function showWarConflictChoice() {
        if (typeof Player === 'undefined' || !Player.getPendingWarChoice) return;
        var conflict = Player.getPendingWarChoice();
        if (!conflict) return;
        var k1 = Engine.findKingdom(conflict.kingdom1);
        var k2 = Engine.findKingdom(conflict.kingdom2);
        var k1Rank = CONFIG.SOCIAL_RANKS[Player.getPlayerRankIndex(conflict.kingdom1)] ? CONFIG.SOCIAL_RANKS[Player.getPlayerRankIndex(conflict.kingdom1)].name : 'Peasant';
        var k2Rank = CONFIG.SOCIAL_RANKS[Player.getPlayerRankIndex(conflict.kingdom2)] ? CONFIG.SOCIAL_RANKS[Player.getPlayerRankIndex(conflict.kingdom2)].name : 'Peasant';

        var html = '<div style="padding:20px;text-align:center;">';
        html += '<h3 style="color:#ff6644;margin-bottom:15px;">\u2694\uFE0F War Breaks Out!</h3>';
        html += '<p style="color:#ddd;margin-bottom:20px;">';
        html += '<strong style="color:' + (k1 ? k1.color : '#fff') + '">' + (k1 ? k1.name : 'Kingdom 1') + '</strong> has declared war on ';
        html += '<strong style="color:' + (k2 ? k2.color : '#fff') + '">' + (k2 ? k2.name : 'Kingdom 2') + '</strong>!';
        html += '</p>';
        html += '<p style="color:#ffa;margin-bottom:20px;">You hold rank in both kingdoms. You must choose a side!</p>';
        html += '<p style="color:#aaa;font-size:0.8rem;margin-bottom:20px;">The kingdom you abandon will strip your rank and your reputation will drop by 30.</p>';
        html += '<div style="display:flex;gap:20px;justify-content:center;">';
        html += '<button class="btn-medieval" style="padding:15px 30px;font-size:1.1rem;" onclick="UI.resolveWarConflict(\'' + conflict.kingdom1 + '\')" title="Keep ' + (k1 ? k1.name : 'Kingdom 1') + '&#10;&#10;✅ Keep your ' + k1Rank + ' rank in ' + (k1 ? k1.name : 'Kingdom 1') + '&#10;❌ Lose ALL rank in ' + (k2 ? k2.name : 'Kingdom 2') + '&#10;❌ -30 reputation with ' + (k2 ? k2.name : 'Kingdom 2') + '">';
        html += (k1 ? k1.name : 'Kingdom 1') + '<br><span style="font-size:0.75rem;color:#aaa;">Your rank: ' + k1Rank + '</span></button>';
        html += '<button class="btn-medieval" style="padding:15px 30px;font-size:1.1rem;" onclick="UI.resolveWarConflict(\'' + conflict.kingdom2 + '\')" title="Keep ' + (k2 ? k2.name : 'Kingdom 2') + '&#10;&#10;✅ Keep your ' + k2Rank + ' rank in ' + (k2 ? k2.name : 'Kingdom 2') + '&#10;❌ Lose ALL rank in ' + (k1 ? k1.name : 'Kingdom 1') + '&#10;❌ -30 reputation with ' + (k1 ? k1.name : 'Kingdom 1') + '">';
        html += (k2 ? k2.name : 'Kingdom 2') + '<br><span style="font-size:0.75rem;color:#aaa;">Your rank: ' + k2Rank + '</span></button>';
        html += '</div></div>';

        openModal('\u2694\uFE0F Choose Your Allegiance', html, '');
    }

    function resolveWarConflict(chosenKingdomId) {
        if (typeof Player === 'undefined' || !Player.resolveWarConflict) return;
        var result = Player.resolveWarConflict(chosenKingdomId);
        if (result.success) {
            closeModal();
            toast(result.message, 'warning');
        } else {
            toast(result.message, 'error');
        }
    }

    function renounceKingdomUI(kingdomId) {
        if (typeof Player === 'undefined' || !Player.renounceKingdom) return;
        var k = Engine.findKingdom(kingdomId);
        var kName = k ? k.name : kingdomId;
        var confirmHtml = '<div style="padding:20px;text-align:center;">';
        confirmHtml += '<p style="color:#ff8866;margin-bottom:15px;">\u26A0\uFE0F Are you sure you want to renounce your rank in <strong>' + kName + '</strong>?</p>';
        confirmHtml += '<p style="color:#aaa;font-size:0.85rem;margin-bottom:20px;">You will lose ALL rank and -30 reputation.</p>';
        confirmHtml += '<div style="display:flex;gap:15px;justify-content:center;">';
        confirmHtml += '<button class="btn-medieval" style="padding:10px 25px;background:rgba(200,50,50,0.2);border-color:rgba(200,50,50,0.4);" onclick="(function(){ var r = Player.renounceKingdom(\'' + kingdomId + '\'); UI.toast(r.message, r.success ? \'warning\' : \'danger\'); UI.closeModal(); UI.openCharacterDialog(); })()">Yes, Renounce</button>';
        confirmHtml += '<button class="btn-medieval" style="padding:10px 25px;" onclick="UI.closeModal()">Cancel</button>';
        confirmHtml += '</div></div>';
        openModal('\u26A0\uFE0F Renounce Kingdom', confirmHtml, '');
    }

    // ========================================================
    // RANK PROGRESSION PANEL
    // ========================================================
    function showRankProgressionPanel(kingdomId) {
        if (typeof Player === 'undefined') return;
        var kingdoms;
        try { kingdoms = Engine.getKingdoms(); } catch (e) { kingdoms = []; }
        var k = Engine.findKingdom(kingdomId);
        var kName = k ? k.name : kingdomId;
        var kColor = k ? k.color : '#888';
        var rankIdx = Player.socialRank[kingdomId] || 0;
        var rank = CONFIG.SOCIAL_RANKS[rankIdx] || CONFIG.SOCIAL_RANKS[0];

        var html = '<div style="padding:15px;">';
        html += '<h3 style="color:' + kColor + ';margin-bottom:10px;">' + kName + '</h3>';
        html += '<div style="margin-bottom:10px;"><strong>Current Rank:</strong> ' + rank.icon + ' ' + rank.name + '</div>';

        // Description
        if (rank.description) {
            html += '<div style="color:#aaa;font-size:0.85rem;margin-bottom:10px;font-style:italic;">' + rank.description + '</div>';
        }

        // Abilities
        if (rank.abilities && rank.abilities.length > 0) {
            html += '<div style="margin-bottom:10px;"><strong>Abilities:</strong> ';
            html += rank.abilities.map(function(a) { return '<span style="background:rgba(100,200,100,0.15);padding:2px 6px;border-radius:3px;font-size:0.8rem;margin:2px;">' + a.replace(/_/g, ' ') + '</span>'; }).join(' ');
            html += '</div>';
        }

        // Next rank requirements
        if (rankIdx < CONFIG.SOCIAL_RANKS.length - 1) {
            var nextRank = CONFIG.SOCIAL_RANKS[rankIdx + 1];
            html += '<div style="margin-top:15px;border-top:1px solid #444;padding-top:10px;">';
            html += '<h4>Next: ' + nextRank.icon + ' ' + nextRank.name + '</h4>';
            if (nextRank.description) {
                html += '<div style="color:#aaa;font-size:0.8rem;margin-bottom:8px;font-style:italic;">' + nextRank.description + '</div>';
            }

            // Requirements checklist
            if (Player.canPetitionForPromotion) {
                var check = Player.canPetitionForPromotion(kingdomId);
                var goldEarned = (Player.goldEarnedInKingdom && Player.goldEarnedInKingdom[kingdomId]) || 0;
                var rep = (Player.reputation && Player.reputation[kingdomId]) || 0;

                html += '<div style="font-size:0.85rem;">';
                html += '<div>' + (goldEarned >= nextRank.goldReq ? '\u2705' : '\u274C') + ' Gold earned: ' + Math.floor(goldEarned).toLocaleString() + '/' + nextRank.goldReq.toLocaleString() + '</div>';
                html += '<div>' + (rep >= nextRank.repReq ? '\u2705' : '\u274C') + ' Reputation: ' + Math.floor(rep) + '/' + nextRank.repReq + '</div>';
                if (nextRank.fee) {
                    html += '<div>' + (Player.gold >= nextRank.fee ? '\u2705' : '\u274C') + ' Fee: ' + nextRank.fee.toLocaleString() + 'g</div>';
                }

                if (check.reasons && check.reasons.length > 0) {
                    for (var i = 0; i < check.reasons.length; i++) {
                        var r = check.reasons[i];
                        // Skip gold/rep reasons (already shown above)
                        if (r.indexOf('Gold') === -1 && r.indexOf('reputation') === -1 && r.indexOf('fee') === -1) {
                            html += '<div style="color:#ff8866;">\u274C ' + r + '</div>';
                        }
                    }
                }
                html += '</div>';

                if (check.can) {
                    html += '<button class="btn-medieval" onclick="UI.petitionPromotion()" style="margin-top:10px;font-size:0.85rem;padding:6px 16px;">\uD83D\uDCDC Petition for Promotion</button>';
                }
            }

            // Next rank abilities
            if (nextRank.abilities && nextRank.abilities.length > 0) {
                html += '<div style="margin-top:8px;"><strong style="font-size:0.85rem;">Unlocks:</strong> ';
                html += nextRank.abilities.map(function(a) { return '<span style="background:rgba(200,160,23,0.15);padding:2px 6px;border-radius:3px;font-size:0.75rem;margin:2px;">' + a.replace(/_/g, ' ') + '</span>'; }).join(' ');
                html += '</div>';
            }
            html += '</div>';
        }

        // Renounce button
        if (rankIdx >= 1) {
            html += '<div style="margin-top:15px;border-top:1px solid #444;padding-top:10px;">';
            html += '<button class="btn-medieval" onclick="UI.renounceKingdomUI(\'' + kingdomId + '\')" style="font-size:0.8rem;padding:5px 14px;background:rgba(200,50,50,0.15);border-color:rgba(200,50,50,0.4);">\u274C Renounce ' + kName + '</button>';
            html += '</div>';
        }

        html += '</div>';
        openModal(rank.icon + ' Rank in ' + kName, html);
    }

    // ========================================================
    // KINGDOM TRADE PANEL
    // ========================================================
    function showKingdomTradePanel(kingdomId) {
        if (typeof Player === 'undefined' || !Player.getKingdomBuyInfo) return;
        var info = Player.getKingdomBuyInfo(kingdomId);
        if (!info) {
            toast('Cannot trade with this kingdom from here.', 'error');
            return;
        }

        var html = '<div class="detail-section">';
        html += '<div class="detail-row"><span class="label">Kingdom</span><span class="value">' + info.kingdomName + '</span></div>';
        html += '<div class="detail-row"><span class="label">Treasury</span><span class="value">' + info.treasuryDesc + '</span></div>';
        if (info.atWar) html += '<div class="detail-row" style="color:#c44e52"><span class="label">⚔️ At War</span><span class="value">Military goods in high demand!</span></div>';
        if (info.happiness < 25) html += '<div class="detail-row" style="color:#c44e52"><span class="label">🍞 Famine</span><span class="value">Food in high demand!</span></div>';
        if (info.prosperity < 30) html += '<div class="detail-row" style="color:#ccb974"><span class="label">🔨 Rebuilding</span><span class="value">Construction materials in demand!</span></div>';
        html += '</div>';

        // List items with multiplier > 0.9 first
        var priorityItems = info.buyList.filter(function(item) { return item.multiplier > 0.9; });
        var regularItems = info.buyList.filter(function(item) { return item.multiplier <= 0.9; });

        if (priorityItems.length > 0) {
            html += '<div class="detail-section"><h3>⭐ Priority Purchases</h3>';
            html += '<table class="price-table"><tr><th>Item</th><th>Price</th><th>Mult</th><th>Reason</th><th></th></tr>';
            for (var i = 0; i < priorityItems.length; i++) {
                var item = priorityItems[i];
                var playerQty = (typeof Player !== 'undefined' && Player.inventory) ? (Player.inventory[item.resourceId] || 0) : 0;
                if (playerQty <= 0) continue;
                html += '<tr><td>' + item.icon + ' ' + item.name + '</td><td class="price good-deal">' + item.effectivePrice + 'g</td><td style="color:#55a868">' + item.multiplier + 'x</td><td style="font-size:0.7rem;">' + item.reason + '</td>';
                html += '<td><button class="btn-trade sell" onclick="UI.sellToKingdomUI(\'' + kingdomId + '\',\'' + item.resourceId + '\',1,' + item.effectivePrice + ')">Sell 1</button></td></tr>';
            }
            html += '</table></div>';
        }

        // Show what player has in inventory
        html += '<div class="detail-section"><h3>📦 Your Inventory</h3>';
        html += '<table class="price-table"><tr><th>Item</th><th>Qty</th><th>Kingdom Price</th><th></th></tr>';
        var inv = (typeof Player !== 'undefined' && Player.inventory) ? Player.inventory : {};
        for (var resId in inv) {
            if ((inv[resId] || 0) <= 0) continue;
            var matchItem = info.buyList.find(function(b) { return b.resourceId === resId; });
            if (!matchItem) continue;
            html += '<tr><td>' + matchItem.icon + ' ' + matchItem.name + '</td><td>' + inv[resId] + '</td><td>' + matchItem.effectivePrice + 'g</td>';
            html += '<td><button class="btn-trade sell" onclick="UI.sellToKingdomUI(\'' + kingdomId + '\',\'' + resId + '\',1,' + matchItem.effectivePrice + ')">Sell 1</button>';
            if (inv[resId] >= 5) html += ' <button class="btn-trade sell" onclick="UI.sellToKingdomUI(\'' + kingdomId + '\',\'' + resId + '\',5,' + matchItem.effectivePrice + ')">Sell 5</button>';
            html += '</td></tr>';
        }
        html += '</table></div>';

        openModal('🏛️ Kingdom Trade — ' + info.kingdomName, html);
    }

    function sellToKingdomUI(kingdomId, resourceId, qty, pricePerUnit) {
        if (typeof Player === 'undefined' || !Player.sellToKingdom) return;
        var result = Player.sellToKingdom(kingdomId, resourceId, parseInt(qty), parseInt(pricePerUnit));
        if (result.success) {
            toast(result.message, 'success');
            showKingdomTradePanel(kingdomId);
        } else {
            toast(result.message, 'error');
        }
    }

    // ========================================================
    // KINGDOM ORDERS & PROCUREMENT UI
    // ========================================================
    var _ordersKingdomId = null;

    function showKingdomOrdersPanel(kingdomId) {
        _ordersKingdomId = kingdomId;
        if (typeof Player === 'undefined' || typeof Engine === 'undefined') return;
        var kingdom = Engine.findKingdom(kingdomId);
        if (!kingdom) { toast('Kingdom not found.', 'error'); return; }

        var html = '<div class="hire-tabs">';
        html += '<button class="btn-tab active" onclick="UI.switchOrdersTab(\'open\')">📋 Open Orders</button>';
        html += '<button class="btn-tab" onclick="UI.switchOrdersTab(\'my_orders\')">📦 My Orders</button>';
        html += '<button class="btn-tab" onclick="UI.switchOrdersTab(\'my_deals\')">🤝 My Deals</button>';
        html += '<button class="btn-tab" onclick="UI.switchOrdersTab(\'history\')">📜 History</button>';
        html += '</div>';

        html += '<div id="ordersTabOpen">' + buildOpenOrdersTab(kingdomId) + '</div>';
        html += '<div id="ordersTabMyOrders" style="display:none">' + buildMyOrdersTab(kingdomId) + '</div>';
        html += '<div id="ordersTabMyDeals" style="display:none">' + buildMyDealsTab(kingdomId) + '</div>';
        html += '<div id="ordersTabHistory" style="display:none">' + buildHistoryTab(kingdomId) + '</div>';

        openModal('📋 Kingdom Orders — ' + kingdom.name, html);
    }

    function switchOrdersTab(tab) {
        var tabs = ['open', 'my_orders', 'my_deals', 'history'];
        var btns = document.querySelectorAll('.hire-tabs .btn-tab');
        btns.forEach(function(btn, i) { btn.classList.toggle('active', tabs[i] === tab); });
        for (var i = 0; i < tabs.length; i++) {
            var el = document.getElementById('ordersTab' + capitalize(tabs[i]).replace('_o', 'O').replace('_d', 'D'));
            if (!el) {
                var idMap = { open: 'ordersTabOpen', my_orders: 'ordersTabMyOrders', my_deals: 'ordersTabMyDeals', history: 'ordersTabHistory' };
                el = document.getElementById(idMap[tabs[i]]);
            }
            if (el) el.style.display = tabs[i] === tab ? '' : 'none';
        }
    }

    function buildOpenOrdersTab(kingdomId) {
        var orders = [];
        try {
            var proc = Engine.getKingdomProcurement(kingdomId);
            if (proc && proc.orders) {
                orders = proc.orders.filter(function(o) { return o.status === 'open'; });
            }
        } catch (e) { /* no-op */ }
        if (orders.length === 0) return '<div style="padding:12px;color:#aaa;text-align:center;">No open orders at this time.</div>';

        var html = '<div style="max-height:350px;overflow-y:auto;">';
        for (var i = 0; i < orders.length; i++) {
            var o = orders[i];
            var res = findResource(o.resourceId);
            var icon = res ? res.icon : '📦';
            var name = res ? res.name : o.resourceId;
            var daysLeft = o.deadlineDay - (Engine.getDay ? Engine.getDay() : 0);
            var playerBid = o.bids ? o.bids.find(function(b) { return b.merchantId === 'player'; }) : null;
            var permitBadge = o.requiresPermit ? ' <span style="color:#ff6b6b;font-size:0.7rem;">🔒 Permit Required</span>' : '';

            html += '<div style="padding:8px;margin:4px 0;background:rgba(0,0,0,0.2);border-radius:4px;border:1px solid rgba(255,255,255,0.05);">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<span>' + icon + ' <strong>' + name + '</strong>' + permitBadge + '</span>';
            html += '<span style="font-size:0.75rem;color:#aaa;">' + daysLeft + ' days left</span>';
            html += '</div>';
            html += '<div style="font-size:0.78rem;color:#ccc;margin-top:4px;">';
            html += 'Qty: <strong>' + o.qty + '</strong> · Max Price: <strong>' + o.maxPricePerUnit + 'g</strong>/unit · Bids: ' + (o.bids ? o.bids.length : 0);
            html += '</div>';
            if (playerBid) {
                html += '<div style="font-size:0.75rem;color:#7bed9f;margin-top:3px;">✅ You bid ' + playerBid.pricePerUnit + 'g/unit</div>';
            } else {
                html += '<div style="margin-top:6px;">';
                html += '<button class="btn-medieval" onclick="UI.showBidModal(\'' + o.id + '\')" style="font-size:0.75rem;padding:4px 12px;background:rgba(100,180,255,0.15);border-color:rgba(100,180,255,0.3);">💰 Place Bid</button>';
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function buildMyOrdersTab(kingdomId) {
        var orders = [];
        try {
            var allKingdoms = Engine.getKingdoms();
            for (var ki = 0; ki < allKingdoms.length; ki++) {
                var proc = Engine.getKingdomProcurement(allKingdoms[ki].id);
                if (!proc || !proc.orders) continue;
                for (var oi = 0; oi < proc.orders.length; oi++) {
                    var o = proc.orders[oi];
                    if (o.assignedTo === 'player' && (o.status === 'assigned' || o.status === 'completed' || o.status === 'failed')) {
                        orders.push({ order: o, kingdomName: allKingdoms[ki].name });
                    }
                }
            }
        } catch (e) { /* no-op */ }
        if (orders.length === 0) return '<div style="padding:12px;color:#aaa;text-align:center;">No assigned orders.</div>';

        var html = '<div style="max-height:350px;overflow-y:auto;">';
        for (var i = 0; i < orders.length; i++) {
            var entry = orders[i];
            var o = entry.order;
            var res = findResource(o.resourceId);
            var icon = res ? res.icon : '📦';
            var name = res ? res.name : o.resourceId;
            var pct = o.qty > 0 ? Math.round(o.qtyDelivered / o.qty * 100) : 0;
            var daysLeft = o.deadlineDay - (Engine.getDay ? Engine.getDay() : 0);
            var barColor = o.status === 'completed' ? '#2ecc71' : o.status === 'failed' ? '#e74c3c' : '#3498db';
            var statusIcon = o.status === 'completed' ? '✅' : o.status === 'failed' ? '❌' : '📦';

            html += '<div style="padding:8px;margin:4px 0;background:rgba(0,0,0,0.2);border-radius:4px;border:1px solid rgba(255,255,255,0.05);">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<span>' + statusIcon + ' ' + icon + ' <strong>' + name + '</strong> (' + entry.kingdomName + ')</span>';
            if (o.status === 'assigned') {
                html += '<span style="font-size:0.75rem;color:' + (daysLeft < 30 ? '#e74c3c' : '#aaa') + ';">' + daysLeft + ' days left</span>';
            }
            html += '</div>';
            html += '<div style="margin-top:4px;">';
            html += '<div style="height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">';
            html += '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:4px;transition:width 0.3s;"></div>';
            html += '</div>';
            html += '<div style="font-size:0.75rem;color:#ccc;margin-top:2px;">' + o.qtyDelivered + '/' + o.qty + ' delivered · ' + o.assignedPrice + 'g/unit</div>';
            html += '</div>';
            if (o.status === 'assigned') {
                var town = Engine.findTown ? Engine.findTown(Player.townId) : null;
                var inDeliveryTown = town && town.id === o.deliveryTownId;
                var hasGoods = Player.inventory && (Player.inventory[o.resourceId] || 0) > 0;
                if (inDeliveryTown && hasGoods) {
                    html += '<div style="margin-top:6px;">';
                    html += '<button class="btn-medieval" onclick="UI.showDeliverOrderModal(\'' + o.id + '\')" style="font-size:0.75rem;padding:4px 12px;background:rgba(46,204,113,0.15);border-color:rgba(46,204,113,0.3);">📦 Deliver</button>';
                    html += '</div>';
                } else if (!inDeliveryTown) {
                    var deliveryTown = Engine.findTown ? Engine.findTown(o.deliveryTownId) : null;
                    html += '<div style="font-size:0.7rem;color:#ff9f43;margin-top:3px;">📍 Deliver to: ' + (deliveryTown ? deliveryTown.name : 'Unknown') + '</div>';
                }
            }
            if (o.status === 'completed' && o.bonusOnCompletion > 0) {
                html += '<div style="font-size:0.75rem;color:#2ecc71;margin-top:3px;">🎁 Bonus earned: ' + o.bonusOnCompletion + 'g</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function buildMyDealsTab(kingdomId) {
        var deals = (typeof Player !== 'undefined' && Player.supplyDeals) ? Player.supplyDeals : [];
        if (deals.length === 0) {
            var html = '<div style="padding:12px;color:#aaa;text-align:center;">No active supply deals.</div>';
            html += '<div style="text-align:center;margin-top:8px;">';
            html += '<button class="btn-medieval" onclick="UI.showNegotiateDealPanel(\'' + kingdomId + '\')" style="font-size:0.8rem;padding:6px 14px;background:rgba(100,200,100,0.15);border-color:rgba(100,200,100,0.3);">🤝 Negotiate New Deal</button>';
            html += '</div>';
            return html;
        }

        var html = '<div style="max-height:300px;overflow-y:auto;">';
        for (var i = 0; i < deals.length; i++) {
            var d = deals[i];
            var res = findResource(d.resourceId);
            var icon = res ? res.icon : '📦';
            var name = res ? res.name : d.resourceId;
            var kingdom = Engine.findKingdom ? Engine.findKingdom(d.kingdomId) : null;
            var statusColor = d.status === 'active' ? '#2ecc71' : '#e74c3c';
            var daysSinceStart = (Engine.getDay ? Engine.getDay() : 0) - d.startDay;
            var monthsActive = Math.floor(daysSinceStart / 30);

            html += '<div style="padding:8px;margin:4px 0;background:rgba(0,0,0,0.2);border-radius:4px;border:1px solid rgba(255,255,255,0.05);">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<span>' + icon + ' <strong>' + name + '</strong> → ' + (kingdom ? kingdom.name : '?') + '</span>';
            html += '<span style="font-size:0.75rem;color:' + statusColor + ';">' + d.status + '</span>';
            html += '</div>';
            html += '<div style="font-size:0.78rem;color:#ccc;margin-top:4px;">';
            html += d.qtyPerMonth + '/month · ' + d.pricePerUnit + 'g/unit · Delivered: ' + (d.totalDelivered || 0) + ' total';
            if (d.missedMonths > 0) html += ' · <span style="color:#e74c3c;">⚠️ ' + d.missedMonths + '/3 warnings</span>';
            html += '</div>';
            if (d.status === 'active') {
                var town = Engine.findTown ? Engine.findTown(Player.townId) : null;
                var inKingdom = town && town.kingdomId === d.kingdomId;
                var hasGoods = Player.inventory && (Player.inventory[d.resourceId] || 0) > 0;
                html += '<div style="margin-top:6px;display:flex;gap:6px;">';
                if (inKingdom && hasGoods) {
                    html += '<button class="btn-medieval" onclick="UI.deliverSupplyDealUI(\'' + d.id + '\')" style="font-size:0.75rem;padding:4px 12px;background:rgba(46,204,113,0.15);border-color:rgba(46,204,113,0.3);">📦 Deliver</button>';
                }
                html += '<button class="btn-medieval" onclick="UI.cancelSupplyDealUI(\'' + d.id + '\')" style="font-size:0.75rem;padding:4px 12px;background:rgba(231,76,60,0.15);border-color:rgba(231,76,60,0.3);">❌ Cancel</button>';
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        html += '<div style="text-align:center;margin-top:8px;">';
        html += '<button class="btn-medieval" onclick="UI.showNegotiateDealPanel(\'' + kingdomId + '\')" style="font-size:0.8rem;padding:6px 14px;background:rgba(100,200,100,0.15);border-color:rgba(100,200,100,0.3);">🤝 Negotiate New Deal</button>';
        html += '</div>';
        return html;
    }

    function buildHistoryTab(kingdomId) {
        var completedOrders = [];
        try {
            var allKingdoms = Engine.getKingdoms();
            for (var ki = 0; ki < allKingdoms.length; ki++) {
                var proc = Engine.getKingdomProcurement(allKingdoms[ki].id);
                if (!proc || !proc.orders) continue;
                for (var oi = 0; oi < proc.orders.length; oi++) {
                    var o = proc.orders[oi];
                    if (o.assignedTo === 'player' && (o.status === 'completed' || o.status === 'failed')) {
                        completedOrders.push({ order: o, kingdomName: allKingdoms[ki].name });
                    }
                }
            }
        } catch (e) { /* no-op */ }

        var html = '<div style="padding:8px;font-size:0.8rem;color:#ccc;">';
        html += '<div style="margin-bottom:8px;">Orders Completed: <strong style="color:#2ecc71;">' + (Player.ordersCompleted || 0) + '</strong> · Failed: <strong style="color:#e74c3c;">' + (Player.ordersFailed || 0) + '</strong></div>';
        if (completedOrders.length === 0) {
            html += '<div style="color:#aaa;text-align:center;">No completed or failed orders yet.</div>';
        } else {
            for (var i = 0; i < completedOrders.length; i++) {
                var entry = completedOrders[i];
                var o = entry.order;
                var res = findResource(o.resourceId);
                var icon = res ? res.icon : '📦';
                var statusIcon = o.status === 'completed' ? '✅' : '❌';
                html += '<div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05);">';
                html += statusIcon + ' ' + icon + ' ' + (res ? res.name : o.resourceId) + ' — ' + o.qtyDelivered + '/' + o.qty + ' (' + entry.kingdomName + ')';
                html += '</div>';
            }
        }
        html += '</div>';
        return html;
    }

    function showBidModal(orderId) {
        // Find the order
        var foundOrder = null;
        var foundKingdom = null;
        try {
            var allKingdoms = Engine.getKingdoms();
            for (var ki = 0; ki < allKingdoms.length; ki++) {
                var proc = Engine.getKingdomProcurement(allKingdoms[ki].id);
                if (!proc || !proc.orders) continue;
                for (var oi = 0; oi < proc.orders.length; oi++) {
                    if (proc.orders[oi].id === orderId) {
                        foundOrder = proc.orders[oi];
                        foundKingdom = allKingdoms[ki];
                        break;
                    }
                }
                if (foundOrder) break;
            }
        } catch (e) { /* no-op */ }
        if (!foundOrder) { toast('Order not found.', 'error'); return; }

        var res = findResource(foundOrder.resourceId);
        var icon = res ? res.icon : '📦';
        var name = res ? res.name : foundOrder.resourceId;
        var daysLeft = foundOrder.deadlineDay - (Engine.getDay ? Engine.getDay() : 0);

        // Show bid price range (anonymized)
        var bidInfo = '';
        if (foundOrder.bids && foundOrder.bids.length > 0) {
            var prices = foundOrder.bids.map(function(b) { return b.pricePerUnit; });
            var minP = Math.min.apply(null, prices);
            var maxP = Math.max.apply(null, prices);
            bidInfo = '<div style="font-size:0.78rem;color:#aaa;margin-top:6px;">Current bid range: ' + minP + 'g — ' + maxP + 'g/unit (' + foundOrder.bids.length + ' bids)</div>';
        }

        var suggestPrice = Math.floor(foundOrder.maxPricePerUnit * 0.85);
        var estimateEarnings = foundOrder.qty * suggestPrice;

        var html = '<div style="padding:8px;">';
        html += '<div style="font-size:0.9rem;margin-bottom:8px;">' + icon + ' <strong>' + name + '</strong> — ' + foundKingdom.name + '</div>';
        html += '<div style="font-size:0.8rem;color:#ccc;">';
        html += 'Quantity: <strong>' + foundOrder.qty + '</strong><br>';
        html += 'Max Price: <strong>' + foundOrder.maxPricePerUnit + 'g</strong>/unit<br>';
        html += 'Deadline: <strong>' + daysLeft + ' days</strong><br>';
        if (foundOrder.requiresPermit) html += '<span style="color:#ff6b6b;">🔒 Requires production permit</span><br>';
        html += '</div>';
        html += bidInfo;
        html += '<div style="margin-top:12px;">';
        html += '<label style="font-size:0.8rem;color:#ddd;">Your bid price per unit:</label><br>';
        html += '<input type="number" id="bidPriceInput" value="' + suggestPrice + '" min="1" max="' + foundOrder.maxPricePerUnit + '" style="width:100px;padding:4px 8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:3px;">';
        html += '</div>';
        html += '<div id="bidEstimate" style="font-size:0.78rem;color:#7bed9f;margin-top:6px;">Estimated earnings: ~' + estimateEarnings + 'g for full delivery</div>';
        html += '<div style="margin-top:12px;text-align:center;">';
        html += '<button class="btn-medieval" onclick="UI.submitBid(\'' + orderId + '\')" style="font-size:0.85rem;padding:6px 18px;background:rgba(100,180,255,0.2);border-color:rgba(100,180,255,0.4);">💰 Submit Bid</button>';
        html += '</div>';
        html += '</div>';

        openModal('💰 Place Bid — ' + name, html);
    }

    function submitBid(orderId) {
        var input = document.getElementById('bidPriceInput');
        if (!input) return;
        var price = parseInt(input.value);
        if (isNaN(price) || price <= 0) { toast('Enter a valid price.', 'warning'); return; }
        var result = Player.bidOnOrder(orderId, price);
        if (result.success) {
            if (_ordersKingdomId) showKingdomOrdersPanel(_ordersKingdomId);
        } else {
            toast(result.message || 'Bid failed.', 'error');
        }
    }

    function showDeliverOrderModal(orderId) {
        var foundOrder = null;
        try {
            var allKingdoms = Engine.getKingdoms();
            for (var ki = 0; ki < allKingdoms.length; ki++) {
                var proc = Engine.getKingdomProcurement(allKingdoms[ki].id);
                if (!proc || !proc.orders) continue;
                for (var oi = 0; oi < proc.orders.length; oi++) {
                    if (proc.orders[oi].id === orderId) { foundOrder = proc.orders[oi]; break; }
                }
                if (foundOrder) break;
            }
        } catch (e) { /* no-op */ }
        if (!foundOrder) { toast('Order not found.', 'error'); return; }

        var res = findResource(foundOrder.resourceId);
        var icon = res ? res.icon : '📦';
        var name = res ? res.name : foundOrder.resourceId;
        var remaining = foundOrder.qty - foundOrder.qtyDelivered;
        var available = Player.inventory ? (Player.inventory[foundOrder.resourceId] || 0) : 0;
        var maxDeliver = Math.min(remaining, available);

        var html = '<div style="padding:8px;">';
        html += '<div style="font-size:0.9rem;margin-bottom:8px;">' + icon + ' <strong>' + name + '</strong></div>';
        html += '<div style="font-size:0.8rem;color:#ccc;">';
        html += 'Remaining: <strong>' + remaining + '</strong><br>';
        html += 'You have: <strong>' + available + '</strong><br>';
        html += 'Price: <strong>' + foundOrder.assignedPrice + 'g</strong>/unit<br>';
        html += '</div>';
        html += '<div style="margin-top:12px;">';
        html += '<label style="font-size:0.8rem;color:#ddd;">Quantity to deliver:</label><br>';
        html += '<input type="number" id="deliverQtyInput" value="' + maxDeliver + '" min="1" max="' + maxDeliver + '" style="width:100px;padding:4px 8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:3px;">';
        html += '</div>';
        html += '<div style="font-size:0.78rem;color:#7bed9f;margin-top:6px;">Payment: ' + (maxDeliver * foundOrder.assignedPrice) + 'g</div>';
        html += '<div style="margin-top:12px;text-align:center;">';
        html += '<button class="btn-medieval" onclick="UI.executeDeliverOrder(\'' + orderId + '\')" style="font-size:0.85rem;padding:6px 18px;background:rgba(46,204,113,0.2);border-color:rgba(46,204,113,0.4);">📦 Deliver</button>';
        html += '</div>';
        html += '</div>';

        openModal('📦 Deliver Order — ' + name, html);
    }

    function executeDeliverOrder(orderId) {
        var input = document.getElementById('deliverQtyInput');
        if (!input) return;
        var qty = parseInt(input.value);
        if (isNaN(qty) || qty <= 0) { toast('Enter a valid quantity.', 'warning'); return; }
        var result = Player.deliverOrder(orderId, qty);
        if (result.success) {
            if (_ordersKingdomId) showKingdomOrdersPanel(_ordersKingdomId);
        } else {
            toast(result.message || 'Delivery failed.', 'error');
        }
    }

    function showNegotiateDealPanel(kingdomId) {
        if (typeof Player === 'undefined' || typeof Engine === 'undefined') return;
        var kingdom = Engine.findKingdom(kingdomId);
        if (!kingdom) { toast('Kingdom not found.', 'error'); return; }
        var proc = Engine.getKingdomProcurement(kingdomId);
        var needs = (proc && proc.needs) ? proc.needs : {};

        var html = '<div style="padding:8px;">';
        html += '<div style="font-size:0.85rem;margin-bottom:8px;color:#ddd;">🤝 Negotiate a supply deal with <strong>' + kingdom.name + '</strong></div>';

        // Show what kingdom needs
        var needKeys = Object.keys(needs);
        if (needKeys.length > 0) {
            html += '<div style="margin-bottom:10px;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:4px;">';
            html += '<div style="font-size:0.78rem;color:#aaa;margin-bottom:4px;">Kingdom needs:</div>';
            for (var ni = 0; ni < needKeys.length; ni++) {
                var resId = needKeys[ni];
                var need = needs[resId];
                var res = findResource(resId);
                var icon = res ? res.icon : '📦';
                html += '<span style="font-size:0.75rem;margin-right:8px;">' + icon + ' ' + (res ? res.name : resId) + ' (urgency: ' + need.urgency + ')</span>';
            }
            html += '</div>';
        }

        // Build resource selector
        html += '<div style="margin-bottom:8px;">';
        html += '<label style="font-size:0.8rem;color:#ddd;">Resource:</label><br>';
        html += '<select id="dealResourceSelect" style="padding:4px 8px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:3px;width:200px;">';
        for (var key in RESOURCE_TYPES) {
            var r = RESOURCE_TYPES[key];
            html += '<option value="' + r.id + '">' + r.icon + ' ' + r.name + ' (base: ' + r.basePrice + 'g)</option>';
        }
        html += '</select>';
        html += '</div>';

        html += '<div style="margin-bottom:8px;">';
        html += '<label style="font-size:0.8rem;color:#ddd;">Quantity per month:</label><br>';
        html += '<input type="number" id="dealQtyInput" value="10" min="1" max="500" style="width:100px;padding:4px 8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:3px;">';
        html += '</div>';

        html += '<div style="margin-bottom:8px;">';
        html += '<label style="font-size:0.8rem;color:#ddd;">Price per unit (gold):</label><br>';
        html += '<input type="number" id="dealPriceInput" value="10" min="1" style="width:100px;padding:4px 8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:3px;">';
        html += '</div>';

        html += '<div style="margin-top:12px;text-align:center;display:flex;gap:8px;justify-content:center;">';
        html += '<button class="btn-medieval" onclick="UI.submitDealProposal(\'' + kingdomId + '\')" style="font-size:0.85rem;padding:6px 18px;background:rgba(100,200,100,0.2);border-color:rgba(100,200,100,0.4);">🤝 Propose Deal</button>';
        html += '<button class="btn-medieval" onclick="UI.showKingdomOrdersPanel(\'' + kingdomId + '\')" style="font-size:0.85rem;padding:6px 18px;">◀ Back</button>';
        html += '</div>';
        html += '</div>';

        openModal('🤝 Negotiate Supply Deal — ' + kingdom.name, html);
    }

    function submitDealProposal(kingdomId) {
        var resSelect = document.getElementById('dealResourceSelect');
        var qtyInput = document.getElementById('dealQtyInput');
        var priceInput = document.getElementById('dealPriceInput');
        if (!resSelect || !qtyInput || !priceInput) return;
        var resourceId = resSelect.value;
        var qty = parseInt(qtyInput.value);
        var price = parseInt(priceInput.value);
        if (isNaN(qty) || qty <= 0) { toast('Enter a valid quantity.', 'warning'); return; }
        if (isNaN(price) || price <= 0) { toast('Enter a valid price.', 'warning'); return; }
        var result = Player.negotiateSupplyDeal(kingdomId, resourceId, qty, price);
        if (result.success) {
            showKingdomOrdersPanel(kingdomId);
        } else {
            toast(result.message || 'Deal rejected.', 'error');
        }
    }

    function deliverSupplyDealUI(dealId) {
        var deal = null;
        var deals = Player.supplyDeals || [];
        for (var i = 0; i < deals.length; i++) {
            if (deals[i].id === dealId) { deal = deals[i]; break; }
        }
        if (!deal) { toast('Deal not found.', 'error'); return; }
        var available = Player.inventory ? (Player.inventory[deal.resourceId] || 0) : 0;
        if (available <= 0) { toast('You have no ' + deal.resourceId + ' to deliver.', 'warning'); return; }

        var res = findResource(deal.resourceId);
        var icon = res ? res.icon : '📦';
        var name = res ? res.name : deal.resourceId;

        var html = '<div style="padding:8px;">';
        html += '<div style="font-size:0.9rem;margin-bottom:8px;">' + icon + ' <strong>' + name + '</strong></div>';
        html += '<div style="font-size:0.8rem;color:#ccc;">You have: <strong>' + available + '</strong><br>Price: <strong>' + deal.pricePerUnit + 'g</strong>/unit</div>';
        html += '<div style="margin-top:12px;">';
        html += '<label style="font-size:0.8rem;color:#ddd;">Quantity to deliver:</label><br>';
        html += '<input type="number" id="dealDeliverQtyInput" value="' + available + '" min="1" max="' + available + '" style="width:100px;padding:4px 8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:3px;">';
        html += '</div>';
        html += '<div style="margin-top:12px;text-align:center;">';
        html += '<button class="btn-medieval" onclick="UI.executeDeliverDeal(\'' + dealId + '\')" style="font-size:0.85rem;padding:6px 18px;background:rgba(46,204,113,0.2);border-color:rgba(46,204,113,0.4);">📦 Deliver</button>';
        html += '</div>';
        html += '</div>';

        openModal('📦 Deliver Supply Deal — ' + name, html);
    }

    function executeDeliverDeal(dealId) {
        var input = document.getElementById('dealDeliverQtyInput');
        if (!input) return;
        var qty = parseInt(input.value);
        if (isNaN(qty) || qty <= 0) { toast('Enter a valid quantity.', 'warning'); return; }
        var result = Player.deliverSupplyDeal(dealId, qty);
        if (result.success) {
            if (_ordersKingdomId) showKingdomOrdersPanel(_ordersKingdomId);
        } else {
            toast(result.message || 'Delivery failed.', 'error');
        }
    }

    // ========================================================
    // CONQUEST DIALOG & SERVITUDE UI
    // ========================================================

    function showConquestDialog(townId, kingdomId, conquestChoice) {
        var town = Engine.getTown(townId);
        var kingdom = Engine.getKingdom(kingdomId);
        if (!town || !kingdom) return;

        var choiceLabels = {
            'citizenship': '👑 Citizenship Granted',
            'servitude': '⛓️ Indentured Servitude Imposed',
            'raid': '🔥 Town Sacked!',
        };

        var html = '<div style="padding:12px;">';
        html += '<h3 style="color:#c4a000;">The Kingdom of ' + kingdom.name + ' has taken control of ' + town.name + '!</h3>';
        html += '<p style="font-size:1rem;margin:8px 0;">' + (choiceLabels[conquestChoice] || 'Unknown outcome') + '</p>';

        if (conquestChoice === 'citizenship') {
            html += '<p>The new rulers have graciously accepted all residents as citizens. Life should continue normally.</p>';
        } else if (conquestChoice === 'servitude') {
            html += '<p>All residents have been placed under indentured servitude for 7 years. Wages will be paid to the kingdom treasury.</p>';
            var cost = CONFIG.SERVITUDE_FREEDOM_COST;
            if (Player.gold >= cost) {
                html += '<div style="margin-top:12px;"><button class="btn-medieval" onclick="UI.buyFreedomUI()">💰 Pay ' + cost + 'g for Freedom</button></div>';
            } else {
                html += '<p style="color:#c44e52;">You need ' + cost + 'g to buy your freedom. You have ' + Math.floor(Player.gold) + 'g.</p>';
                html += '<p>You are now an indentured servant of ' + kingdom.name + '.</p>';
            }
        } else if (conquestChoice === 'raid') {
            html += '<p style="color:#c44e52;">The town has been brutally sacked! Many have perished and survivors have been enslaved.</p>';
            var cost2 = CONFIG.SERVITUDE_FREEDOM_COST;
            if (Player.gold >= cost2) {
                html += '<div style="margin-top:12px;"><button class="btn-medieval" onclick="UI.buyFreedomUI()">💰 Pay ' + cost2 + 'g for Freedom</button></div>';
            } else {
                html += '<p style="color:#c44e52;">You are now an indentured servant of ' + kingdom.name + '.</p>';
            }
        }

        html += '</div>';
        openModal('⚔️ Conquest!', html, '<button class="btn-medieval" onclick="UI.closeModal()">Continue</button>');
    }

    function buyFreedomUI() {
        var result = Player.buyFreedom();
        if (result.success) {
            toast(result.message, 'success');
            closeModal();
        } else {
            toast(result.message, 'warning');
        }
    }

    function attemptIndenturedEscape(escapeId) {
        var result = Player.attemptEscape(escapeId);
        if (result.success) {
            toast(result.message, 'success');
            closeModal();
        } else {
            toast(result.message, 'warning');
        }
    }

    function completeMasterTask() {
        var result = Player.completeCurrentTask();
        toast(result.message, result.success ? 'success' : 'error');
        closeModal();
    }

    function dismissMasterTask() {
        if (!confirm('Are you sure? Dismissing a task counts as a failure and your master will add time to your contract!')) return;
        var result = Player.dismissCurrentTask();
        toast(result.message, result.success ? 'warning' : 'error');
        closeModal();
    }

    function payDebt(amount) {
        var result = Player.makeDebtPayment(amount);
        toast(result.message, result.success ? 'success' : 'error');
        if (result.success) {
            closeModal();
            openSpecialStartPanel();
        }
    }

    // ── HEIR SELECTION UI ──
    // Shown when player dies and has multiple heir options (children + spouse)
    function showHeirSelectionUI(heirOptions, deceasedName, totalGold) {
        var html = '';
        html += '<div style="text-align:center;padding:10px 0;color:#ff9;">';
        html += '<p style="font-size:16px;margin-bottom:10px;">☠️ <strong>' + deceasedName + '</strong> has passed away.</p>';
        html += '<p style="color:#ccc;font-size:13px;">Choose who will carry on the family legacy:</p>';
        html += '</div>';

        html += '<div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto;padding:8px;">';

        for (var i = 0; i < heirOptions.length; i++) {
            var opt = heirOptions[i];
            var npc = opt.npc;
            var type = opt.type;
            var label = '';
            var desc = '';
            var icon = '';
            var borderColor = '#555';
            var bgColor = '#2a2a2a';

            if (type === 'spouse') {
                icon = '💍';
                label = 'Spouse';
                desc = 'Inherits 100% of gold (' + formatGold(totalGold) + 'g). Social rank maintained. Children remain yours.';
                borderColor = '#c4a';
                bgColor = '#3a1a2a';
            } else if (type === 'child') {
                icon = '👤';
                label = 'Child (Adult)';
                var numSiblings = 0;
                for (var j = 0; j < heirOptions.length; j++) {
                    if (heirOptions[j].type === 'child' && heirOptions[j].npc.id !== npc.id) numSiblings++;
                }
                var heirShare = numSiblings > 0 ? Math.floor(totalGold * 0.7) : totalGold;
                desc = 'Inherits ' + formatGold(heirShare) + 'g (siblings split ' + formatGold(numSiblings > 0 ? Math.floor(totalGold * 0.3) : 0) + 'g). Social rank may drop.';
                borderColor = '#5a5';
                bgColor = '#1a2a1a';
            } else if (type === 'child_young') {
                icon = '👶';
                label = 'Child (Minor — Regency)';
                desc = 'Enters regency until age 18. Spouse manages estate. Gold/buildings may be lost depending on spouse loyalty.';
                borderColor = '#aa5';
                bgColor = '#2a2a1a';
            }

            html += '<div onclick="UI.confirmHeirSelection(\'' + npc.id + '\', \'' + type + '\')" style="';
            html += 'border:2px solid ' + borderColor + ';background:' + bgColor + ';padding:12px;border-radius:6px;cursor:pointer;';
            html += 'transition:all 0.2s;display:flex;align-items:center;gap:12px;" ';
            html += 'onmouseover="this.style.borderColor=\'#fff\';this.style.transform=\'scale(1.02)\'" ';
            html += 'onmouseout="this.style.borderColor=\'' + borderColor + '\';this.style.transform=\'scale(1)\'">';

            // Icon & portrait area
            html += '<div style="font-size:32px;min-width:48px;text-align:center;">' + icon + '</div>';

            // Info area
            html += '<div style="flex:1;">';
            html += '<div style="font-size:14px;font-weight:bold;color:#fff;">' + npc.firstName + ' ' + npc.lastName + '</div>';
            html += '<div style="font-size:12px;color:#aaa;margin-top:2px;">';
            html += label + ' • ' + (npc.sex === 'M' ? '♂' : '♀') + ' Age ' + npc.age;
            if (npc.occupation && npc.occupation !== 'None') html += ' • ' + npc.occupation;
            html += '</div>';
            html += '<div style="font-size:11px;color:#888;margin-top:4px;">' + desc + '</div>';
            html += '</div>';

            // Arrow
            html += '<div style="font-size:18px;color:#666;">▶</div>';
            html += '</div>';
        }

        html += '</div>';

        // Game over warning if no heirs
        if (heirOptions.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:#f55;">';
            html += '<p style="font-size:16px;">No heirs available. The legacy ends.</p>';
            html += '</div>';
        }

        openModal('⚰️ Succession', html, '');
    }

    function confirmHeirSelection(heirId, heirType) {
        var typeName = heirType === 'spouse' ? 'spouse' : 'child';
        if (heirType === 'child_young') typeName = 'young child (regency will begin)';

        // Find the heir name for confirmation
        var npc = Engine.findPerson(heirId);
        var heirName = npc ? (npc.firstName + ' ' + npc.lastName) : 'this heir';

        if (confirm('Play as ' + heirName + ' (' + typeName + ')?\n\nThis cannot be undone.')) {
            closeModal();
            Player.selectHeir(heirId);
        }
    }

    // Check if player's town was just conquered - hook into event updates
    var _lastConquestCheckDay = -1;
    function checkConquestEvents() {
        if (!Player || !Player.townId) return;
        var world = Engine.getWorld();
        if (!world || !world.eventLog) return;
        // Only check once per day
        if (_lastConquestCheckDay === world.day) return;

        for (var i = world.eventLog.length - 1; i >= Math.max(0, world.eventLog.length - 5); i--) {
            var evt = world.eventLog[i];
            if (!evt || !evt.details) continue;
            if (evt.day !== world.day) continue;
            if (evt.details.type === 'territory_transfer' && evt.details.townId === Player.townId) {
                _lastConquestCheckDay = world.day;
                // Player's town was transferred
                var conquestChoice = 'citizenship';
                // Check for more specific events
                for (var j = world.eventLog.length - 1; j >= Math.max(0, world.eventLog.length - 10); j--) {
                    var e2 = world.eventLog[j];
                    if (!e2 || !e2.details || e2.day !== world.day) continue;
                    if (e2.details.townId === Player.townId) {
                        if (e2.details.type === 'conquest_servitude') conquestChoice = 'servitude';
                        else if (e2.details.type === 'conquest_raid') conquestChoice = 'raid';
                        else if (e2.details.type === 'conquest_citizenship') conquestChoice = 'citizenship';
                    }
                }

                var kingdom = Engine.getKingdom(Engine.getTown(Player.townId).kingdomId);
                if (kingdom) {
                    // Apply conquest servitude to player if applicable
                    if (conquestChoice === 'servitude' || conquestChoice === 'raid') {
                        if (!Player.conquestServitude || !Player.conquestServitude.active) {
                            Player.state.conquestServitude = {
                                active: true,
                                servitudeEndDay: world.day + CONFIG.SERVITUDE_DURATION_DAYS,
                                freedomCost: CONFIG.SERVITUDE_FREEDOM_COST,
                                kingdomId: kingdom.id,
                            };
                            Player.state.citizenshipKingdomId = kingdom.id;
                        }
                    } else {
                        // Citizenship — update player's kingdom
                        Player.state.citizenshipKingdomId = kingdom.id;
                    }

                    showConquestDialog(Player.townId, kingdom.id, conquestChoice);
                }
                break;
            }
        }
    }

    function cancelSupplyDealUI(dealId) {
        var result = Player.cancelSupplyDeal(dealId);
        if (result.success) {
            if (_ordersKingdomId) showKingdomOrdersPanel(_ordersKingdomId);
        } else {
            toast(result.message || 'Cancel failed.', 'error');
        }
    }

    // ============================================================
    // §KLP — KINGDOM LAWS PANEL
    // ============================================================
    function openKingdomLawsPanel(kingdomId) {
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        if (!kingdom) { toast('Kingdom not found.', 'warning'); return; }

        var html = '<div style="max-height:500px;overflow-y:auto;">';

        // King mood (if available)
        var mood = null;
        try { mood = Engine.getKingMood(kingdomId); } catch(e) {}
        if (mood && mood.current) {
            var moodConfig = (typeof CONFIG !== 'undefined' && CONFIG.KING_MOOD) ? CONFIG.KING_MOOD.moods[mood.current] : null;
            html += '<div style="background:rgba(255,215,0,0.1);padding:8px;border-radius:6px;margin-bottom:10px;">';
            html += '<b>' + (moodConfig ? moodConfig.icon : '😐') + ' King\'s Mood:</b> ' + mood.current.charAt(0).toUpperCase() + mood.current.slice(1);
            if (mood.reason) html += ' <span class="text-dim">(' + mood.reason + ')</span>';
            html += '</div>';
        }

        // Succession crisis
        var crisis = null;
        try { crisis = Engine.getSuccessionCrisis(kingdomId); } catch(e) {}
        if (crisis && crisis.active) {
            html += '<div style="background:rgba(255,50,50,0.15);padding:8px;border-radius:6px;margin-bottom:10px;">';
            html += '<b>⚠️ SUCCESSION CRISIS</b> (' + crisis.severity + ')<br>';
            if (crisis.pretenders && crisis.pretenders.length > 0) {
                html += '<span class="text-dim">Pretenders: ' + crisis.pretenders.map(function(p) { return p.name + ' (' + p.type + ', support: ' + p.support + ')'; }).join(', ') + '</span>';
            }
            html += '<br><button class="btn-medieval" onclick="UI.openSuccessionCrisisDialog(\'' + kingdomId + '\')" style="font-size:0.75rem;padding:3px 8px;margin-top:4px;">👑 View Details / Influence</button>';
            html += '</div>';
        }

        // Basic laws
        html += '<h4 style="margin:8px 0 4px;">📜 Tax & Trade</h4>';
        html += '<div style="padding:4px 8px;">💰 <b>Trade Tax:</b> ' + Math.round((kingdom.taxRate || 0.05) * 100) + '% — Applied to all market transactions</div>';
        if (kingdom.laws) {
            html += '<div style="padding:4px 8px;">📊 <b>Trade Tariff:</b> ' + Math.round((kingdom.laws.tradeTariff || 0) * 100) + '% — Foreign traders pay this surcharge</div>';
            if (kingdom.propertyTaxRate) html += '<div style="padding:4px 8px;">🏠 <b>Property Tax:</b> ' + Math.round(kingdom.propertyTaxRate * 100) + '% monthly</div>';
            if (kingdom.incomeTaxRate) html += '<div style="padding:4px 8px;">💼 <b>Income Tax:</b> ' + Math.round(kingdom.incomeTaxRate * 100) + '%</div>';

            // Goods taxes
            if (kingdom.laws.goodsTaxes && Object.keys(kingdom.laws.goodsTaxes).length > 0) {
                html += '<div style="padding:4px 8px;">📦 <b>Goods Taxes:</b> ';
                var gts = [];
                for (var gid in kingdom.laws.goodsTaxes) {
                    gts.push(gid + ' (' + Math.round(kingdom.laws.goodsTaxes[gid] * 100) + '%)');
                }
                html += gts.join(', ') + '</div>';
            }
        }

        // Banned goods
        html += '<h4 style="margin:12px 0 4px;">🚫 Restrictions</h4>';
        if (kingdom.laws && kingdom.laws.bannedGoods && kingdom.laws.bannedGoods.length > 0) {
            html += '<div style="padding:4px 8px;color:#ff6b6b;">🚫 <b>Banned Goods:</b> ' + kingdom.laws.bannedGoods.join(', ') + ' — Trading these is illegal!</div>';
        } else {
            html += '<div style="padding:4px 8px;color:#6bff6b;">✅ No banned goods</div>';
        }
        if (kingdom.laws && kingdom.laws.restrictedGoods && kingdom.laws.restrictedGoods.length > 0) {
            html += '<div style="padding:4px 8px;color:#ffaa6b;">⚠️ <b>Restricted Goods:</b> ' + kingdom.laws.restrictedGoods.join(', ') + ' — Require permits to trade</div>';
        }

        // Conscription
        html += '<h4 style="margin:12px 0 4px;">⚔️ Military</h4>';
        html += '<div style="padding:4px 8px;">' + (kingdom.laws && kingdom.laws.conscription ? '⚔️ <b>Conscription:</b> <span style="color:#ff6b6b;">Active</span> — You may be drafted during wartime' : '🕊️ <b>Conscription:</b> <span style="color:#6bff6b;">Inactive</span>') + '</div>';

        // Guild restrictions
        if (kingdom.laws && kingdom.laws.guildRestrictions) {
            html += '<div style="padding:4px 8px;">🔨 <b>Guild Restrictions:</b> Active — Guild membership required for some activities</div>';
        }

        // Water
        if (kingdom.laws) {
            html += '<div style="padding:4px 8px;">' + (kingdom.laws.freeWellWater ? '💧 <b>Free Well Water:</b> Available' : '💧 <b>Well Water:</b> Not free — must purchase') + '</div>';
        }

        // Special laws
        if (kingdom.laws && kingdom.laws.specialLaws && kingdom.laws.specialLaws.length > 0) {
            html += '<h4 style="margin:12px 0 4px;">📋 Special Laws</h4>';
            for (var si = 0; si < kingdom.laws.specialLaws.length; si++) {
                var sl = kingdom.laws.specialLaws[si];
                html += '<div style="padding:4px 8px;">' + (sl.icon || '📜') + ' <b>' + sl.name + ':</b> ' + sl.desc + '</div>';
            }
        }

        html += '</div>';

        openModal('📜 Laws of ' + kingdom.name, html,
            '<button class="btn-medieval" onclick="UI.closeModal()">Close</button>');
    }

    function openProsperityBreakdown(townId) {
        var town;
        try { town = Engine.findTown(townId); } catch(e) { return; }
        if (!town) return;

        if (typeof Player === 'undefined' || !Player.hasSkill || !Player.hasSkill('economic_advisor')) {
            toast('You need the Economic Advisor skill to view prosperity breakdowns.', 'warning');
            return;
        }

        var p = town.prosperity || 0;
        var html = '<div style="max-height:400px;overflow-y:auto;">';
        html += '<h3 style="margin:0 0 8px;color:var(--gold);">📊 ' + (town.name || 'Town') + ' Prosperity: ' + p.toFixed(1) + '/100</h3>';

        var barColor = p > 70 ? '#55a868' : p > 40 ? '#ccb44c' : '#c44e52';
        html += '<div style="background:#333;border-radius:4px;height:12px;margin-bottom:12px;"><div style="background:' + barColor + ';height:100%;width:' + p + '%;border-radius:4px;"></div></div>';

        html += '<h4 style="color:var(--gold);margin:8px 0 4px;">📈 Positive Factors</h4>';

        var positives = [];
        var negatives = [];

        var totalSupply = 0, totalDemand = 0;
        for (var rid in (town.market.supply || {})) { totalSupply += (town.market.supply[rid] || 0); }
        for (var rid2 in (town.market.demand || {})) { totalDemand += (town.market.demand[rid2] || 0); }
        if (totalSupply > totalDemand * 0.8) positives.push({ name: 'Good supply coverage', value: '+' + ((totalSupply / Math.max(1, totalDemand)) * 2).toFixed(1) });
        else negatives.push({ name: 'Supply shortage', value: '-' + ((1 - totalSupply / Math.max(1, totalDemand)) * 3).toFixed(1) });

        var pop = town.population || 0;
        if (pop > 100) positives.push({ name: 'Large population (' + pop + ')', value: '+' + (pop * 0.005).toFixed(1) });

        var buildingCount = (town.buildings || []).length;
        if (buildingCount > 5) positives.push({ name: 'Many buildings (' + buildingCount + ')', value: '+' + (buildingCount * 0.05).toFixed(1) });

        var playerBldgs = (town.buildings || []).filter(function(b) { return b.ownerId === 'player'; });
        if (playerBldgs.length > 0) {
            var boost = playerBldgs.length * 0.1;
            var hasBenefactor = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('town_benefactor');
            if (hasBenefactor) boost *= 2;
            positives.push({ name: 'Your buildings (' + playerBldgs.length + ')' + (hasBenefactor ? ' [2× Benefactor]' : ''), value: '+' + boost.toFixed(1) });
        }

        negatives.push({ name: 'Natural decay (0.5%/day)', value: '-' + (p * 0.005).toFixed(1) });

        if (town.activeEvents) {
            for (var ei = 0; ei < town.activeEvents.length; ei++) {
                var ev = town.activeEvents[ei];
                if (ev.type === 'plague' || ev.type === 'fire' || ev.type === 'flood') {
                    negatives.push({ name: '🔴 ' + ev.type.charAt(0).toUpperCase() + ev.type.slice(1) + ' (-5/day)', value: '-5.0' });
                }
            }
        }

        try {
            var kingdom = Engine.findKingdom(town.kingdomId);
            if (kingdom && kingdom.atWar && kingdom.atWar.size > 0) {
                negatives.push({ name: '⚔️ Kingdom at war', value: '-2.0' });
            }
        } catch(e) {}

        for (var pi = 0; pi < positives.length; pi++) {
            html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span style="color:#8f8;">' + positives[pi].name + '</span><span style="color:#8f8;">' + positives[pi].value + '</span></div>';
        }

        html += '<h4 style="color:var(--gold);margin:8px 0 4px;">📉 Negative Factors</h4>';
        for (var ni = 0; ni < negatives.length; ni++) {
            html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span style="color:#f88;">' + negatives[ni].name + '</span><span style="color:#f88;">' + negatives[ni].value + '</span></div>';
        }

        html += '</div>';
        openModal('📊 Prosperity Breakdown', html);
    }

    function openKingActionLog(kingdomId) {
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        if (!kingdom) { toast('Kingdom not found.', 'warning'); return; }

        var log = [];
        try { log = Engine.getKingActionLog(kingdomId) || []; } catch(e) {}

        var html = '<div style="max-height:500px;overflow-y:auto;">';
        if (log.length === 0) {
            html += '<p class="text-dim">No recent king actions recorded.</p>';
        } else {
            for (var li = log.length - 1; li >= 0; li--) {
                var entry = log[li];
                html += '<div style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.05);">';
                html += '<span class="text-dim" style="font-size:0.75rem;">Day ' + entry.day + '</span> ';
                html += entry.message;
                html += '</div>';
            }
        }
        html += '</div>';

        openModal('👑 King\'s Actions — ' + kingdom.name, html,
            '<button class="btn-medieval" onclick="UI.closeModal()">Close</button>');
    }

    function openLawComparisonPanel(kingdomIdA, kingdomIdB) {
        var kA = null, kB = null;
        try { kA = Engine.findKingdom(kingdomIdA); } catch(e) {}
        try { kB = Engine.findKingdom(kingdomIdB); } catch(e) {}
        if (!kA || !kB) { toast('Kingdom not found.', 'warning'); return; }

        function lawCell(kingdom) {
            var parts = [];
            parts.push('💰 Tax: ' + Math.round((kingdom.taxRate || 0.05) * 100) + '%');
            parts.push('📊 Tariff: ' + Math.round((kingdom.laws ? kingdom.laws.tradeTariff || 0 : 0) * 100) + '%');
            if (kingdom.laws && kingdom.laws.bannedGoods && kingdom.laws.bannedGoods.length > 0) {
                parts.push('🚫 Banned: ' + kingdom.laws.bannedGoods.join(', '));
            } else {
                parts.push('✅ No bans');
            }
            parts.push(kingdom.laws && kingdom.laws.conscription ? '⚔️ Conscription' : '🕊️ No conscription');
            parts.push(kingdom.laws && kingdom.laws.freeWellWater ? '💧 Free water' : '💧 Paid water');
            if (kingdom.laws && kingdom.laws.guildRestrictions) parts.push('🔨 Guild restrictions');
            if (kingdom.laws && kingdom.laws.specialLaws) {
                for (var i = 0; i < kingdom.laws.specialLaws.length; i++) {
                    var sl = kingdom.laws.specialLaws[i];
                    parts.push((sl.icon || '📜') + ' ' + sl.name);
                }
            }
            return parts.map(function(p) { return '<div style="padding:2px 0;">' + p + '</div>'; }).join('');
        }

        var html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr><th style="width:50%;padding:8px;border-bottom:2px solid rgba(255,215,0,0.3);text-align:left;">' + kA.name + '</th>';
        html += '<th style="width:50%;padding:8px;border-bottom:2px solid rgba(255,215,0,0.3);text-align:left;">' + kB.name + '</th></tr>';
        html += '<tr><td style="padding:8px;vertical-align:top;">' + lawCell(kA) + '</td>';
        html += '<td style="padding:8px;vertical-align:top;">' + lawCell(kB) + '</td></tr>';
        html += '</table>';

        openModal('⚖️ Law Comparison', html,
            '<button class="btn-medieval" onclick="UI.closeModal()">Close</button>');
    }

    function openRoyalCommissionsPanel(kingdomId) {
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        if (!kingdom) { toast('Kingdom not found.', 'warning'); return; }

        var commissions = [];
        try { commissions = Engine.getRoyalCommissions(kingdomId) || []; } catch(e) {}
        var openComms = commissions.filter(function(c) { return c.status === 'open'; });

        var html = '<div style="max-height:500px;overflow-y:auto;">';
        if (openComms.length === 0) {
            html += '<p class="text-dim">No active royal commissions. Check back later.</p>';
        } else {
            var inv = (typeof Player !== 'undefined' && Player.state) ? (Player.state.inventory || {}) : {};
            for (var ci = 0; ci < openComms.length; ci++) {
                var comm = openComms[ci];
                var daysLeft = comm.expiresDay - (typeof Engine !== 'undefined' && Engine.getDay ? Engine.getDay() : 0);
                var playerHas = comm.resourceId ? (inv[comm.resourceId] || 0) : 0;
                var canFulfill = comm.type !== 'building_request' && comm.resourceId && playerHas >= (comm.quantity || 1);

                html += '<div style="background:rgba(255,215,0,0.08);padding:10px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(255,215,0,0.2);">';
                html += '<div><b>📜 ' + comm.description + '</b></div>';
                html += '<div style="margin-top:4px;">';
                html += '<span style="color:#ffd700;">💰 Reward: ' + comm.reward + 'g</span> | ';
                html += '<span style="color:#6bff6b;">⭐ Rep: +' + comm.repReward + '</span> | ';
                html += '<span class="text-dim">⏳ ' + daysLeft + ' days left</span>';
                html += '</div>';
                if (comm.resourceId) {
                    html += '<div style="margin-top:4px;font-size:0.8rem;">You have: <b>' + playerHas + '</b> / ' + (comm.quantity || 1) + ' ' + comm.resourceId + '</div>';
                }
                if (canFulfill) {
                    html += '<button class="btn-medieval" onclick="UI.fulfillCommissionUI(\'' + kingdomId + '\',\'' + comm.id + '\')" style="font-size:0.8rem;padding:4px 10px;margin-top:4px;">✅ Fulfill Commission</button>';
                } else if (comm.type === 'building_request') {
                    html += '<div style="margin-top:4px;font-size:0.8rem;color:#ff9f43;">🏗️ Build the requested building to fulfill this commission.</div>';
                }
                html += '</div>';
            }
        }
        html += '</div>';

        openModal('📜 Royal Commissions — ' + kingdom.name, html,
            '<button class="btn-medieval" onclick="UI.closeModal()">Close</button>');
    }

    function fulfillCommissionUI(kingdomId, commissionId) {
        // Find the commission to get resource/quantity
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        if (!kingdom || !kingdom.royalCommissions) { toast('Error.', 'danger'); return; }
        var comm = null;
        for (var i = 0; i < kingdom.royalCommissions.length; i++) {
            if (kingdom.royalCommissions[i].id === commissionId && kingdom.royalCommissions[i].status === 'open') {
                comm = kingdom.royalCommissions[i]; break;
            }
        }
        if (!comm) { toast('Commission no longer available.', 'warning'); closeModal(); return; }

        // Check player has inventory
        var inv = (typeof Player !== 'undefined' && Player.state) ? (Player.state.inventory || {}) : {};
        var has = comm.resourceId ? (inv[comm.resourceId] || 0) : 0;
        if (has < (comm.quantity || 1)) {
            toast('Not enough ' + comm.resourceId + '. Need ' + (comm.quantity || 1) + ', have ' + has + '.', 'danger');
            return;
        }

        // Deduct goods from player
        Player.state.inventory[comm.resourceId] -= (comm.quantity || 1);
        if (Player.state.inventory[comm.resourceId] <= 0) delete Player.state.inventory[comm.resourceId];

        // Fulfill via engine
        var result = Engine.fulfillRoyalCommission(kingdomId, commissionId, 'player');
        if (result && result.success) {
            // Grant reward and rep
            Player.state.gold += result.reward;
            if (!Player.state.reputation) Player.state.reputation = {};
            Player.state.reputation[kingdomId] = Math.min(100, (Player.state.reputation[kingdomId] || 50) + result.repReward);
            Player.state.stats.totalGoldEarned = (Player.state.stats.totalGoldEarned || 0) + result.reward;

            toast('✅ Commission fulfilled! +' + result.reward + 'g, +' + result.repReward + ' rep!', 'success');
            if (typeof Engine !== 'undefined' && Engine.logEvent) {
                Engine.logEvent('✅ Fulfilled royal commission for ' + kingdom.name + ': ' + comm.description + ' → +' + result.reward + 'g, +' + result.repReward + ' rep');
            }
            openRoyalCommissionsPanel(kingdomId); // refresh
        } else {
            toast(result ? result.reason : 'Failed.', 'danger');
        }
    }

    // ============================================================
    // §CD — CONSCRIPTION DIALOG
    // ============================================================
    function openConscriptionDialog() {
        if (typeof Player === 'undefined' || !Player.state) return;
        var pending = Player.state.conscriptionPending;
        if (!pending) { toast('No conscription pending.', 'warning'); return; }

        var canPay = false;
        var highestRank = 0;
        var sr = Player.state.socialRank || {};
        for (var kId in sr) { if ((sr[kId] || 0) > highestRank) highestRank = sr[kId]; }
        var cfg = (typeof CONFIG !== 'undefined' && CONFIG.CONSCRIPTION_CONFIG) ? CONFIG.CONSCRIPTION_CONFIG : {};
        canPay = highestRank >= (cfg.exemptionMinRank || 4) && Player.state.gold >= (cfg.exemptionFee || 5000);
        var daysLeft = (pending.deadlineDay || 0) - (typeof Engine !== 'undefined' && Engine.getDay ? Engine.getDay() : 0);

        var html = '<div style="padding:8px;">';
        html += '<div style="background:rgba(255,50,50,0.15);padding:12px;border-radius:8px;margin-bottom:12px;">';
        html += '<h3 style="margin:0 0 8px;">⚔️ CONSCRIPTION DECREE</h3>';
        html += '<p>The King of <b>' + pending.kingdomName + '</b> has ordered ' + Math.round((pending.conscriptionRate || 0.1) * 100) + '% of able-bodied men conscripted.</p>';
        html += '<p><b>You have been called to serve.</b></p>';
        html += '<p class="text-dim">⏳ ' + daysLeft + ' days to respond (auto-dodges if ignored)</p>';
        html += '</div>';

        // Option 1: Report
        html += '<div style="background:rgba(100,200,100,0.1);padding:10px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(100,200,100,0.3);">';
        html += '<b>⚔️ Report for Duty</b><br>';
        html += '<span class="text-dim">Serve 1 year of mandatory military service. You will be fed, paid, and may earn rank/citizenship. If indentured, your servitude is dissolved.</span><br>';
        html += '<button class="btn-medieval" onclick="UI.respondConscription(\'report\')" style="margin-top:6px;">⚔️ Report for Duty</button>';
        html += '</div>';

        // Option 2: Pay (if eligible)
        html += '<div style="background:rgba(255,215,0,0.1);padding:10px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(255,215,0,0.3);' + (canPay ? '' : 'opacity:0.5;') + '">';
        html += '<b>💰 Pay Exemption Fee (' + (cfg.exemptionFee || 5000) + 'g)</b><br>';
        html += '<span class="text-dim">Requires Minor Noble rank (4+) and ' + (cfg.exemptionFee || 5000) + 'g. Fee goes to the kingdom treasury.</span><br>';
        if (canPay) {
            html += '<button class="btn-medieval" onclick="UI.respondConscription(\'pay\')" style="margin-top:6px;">💰 Pay ' + (cfg.exemptionFee || 5000) + 'g</button>';
        } else {
            html += '<span style="color:#ff6b6b;font-size:0.8rem;">' + (highestRank < (cfg.exemptionMinRank || 4) ? 'Rank too low (need Minor Noble+)' : 'Not enough gold') + '</span>';
        }
        html += '</div>';

        // Option 3: Dodge
        html += '<div style="background:rgba(200,50,50,0.1);padding:10px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(200,50,50,0.3);">';
        html += '<b>🏃 Dodge Conscription</b><br>';
        html += '<span class="text-dim">Refuse to report. Risk of being caught and sentenced to 2 years in prison. Being outside the kingdom greatly reduces catch chance. Stealth skills help.</span><br>';
        html += '<button class="btn-medieval" onclick="UI.respondConscription(\'dodge\')" style="margin-top:6px;background:rgba(200,50,50,0.15);border-color:rgba(200,50,50,0.4);">🏃 Dodge (Risky)</button>';
        html += '</div>';

        html += '</div>';

        openModal('⚔️ Conscription — ' + pending.kingdomName, html);
    }

    function respondConscription(choice) {
        if (typeof Player === 'undefined' || !Player.respondToConscription) return;
        var result = Player.respondToConscription(choice);
        if (result && result.success) {
            toast(result.message, choice === 'report' ? 'info' : choice === 'pay' ? 'success' : 'warning');
            closeModal();
        } else {
            toast(result ? result.message : 'Failed.', 'danger');
        }
    }

    // ============================================================
    // §JD — JAIL DIALOG
    // ============================================================
    function openJailDialog() {
        if (typeof Player === 'undefined' || !Player.state) return;
        var jailEnd = Player.state.jailedUntilDay || 0;
        var currentDay = (typeof Engine !== 'undefined' && Engine.getDay) ? Engine.getDay() : 0;
        var daysLeft = Math.max(0, jailEnd - currentDay);
        var reason = Player.state.jailReason || 'crime';
        var canFastForward = Player.state.jailFastForwardAvailable;

        var reasonText = reason === 'conscription_dodge' ? 'Dodging conscription' : 'Criminal offense';

        var html = '<div style="padding:8px;">';
        html += '<div style="background:rgba(100,100,100,0.2);padding:12px;border-radius:8px;margin-bottom:12px;">';
        html += '<h3 style="margin:0 0 8px;">🔒 IMPRISONED</h3>';
        html += '<p><b>Reason:</b> ' + reasonText + '</p>';
        html += '<p><b>Sentence remaining:</b> ' + daysLeft + ' days (' + (daysLeft / 360).toFixed(1) + ' years)</p>';
        html += '<p class="text-dim">While in jail, you cannot trade, travel, work, or interact with the world. The world continues to simulate around you.</p>';
        html += '</div>';

        if (canFastForward && daysLeft > 0) {
            html += '<div style="background:rgba(100,150,255,0.1);padding:10px;border-radius:6px;border:1px solid rgba(100,150,255,0.3);">';
            html += '<b>⏩ Fast Forward</b><br>';
            html += '<span class="text-dim">Skip ahead through your sentence. The game will simulate ' + daysLeft + ' days of world activity while you serve your time.</span><br>';
            html += '<button class="btn-medieval" onclick="UI.fastForwardJailUI()" style="margin-top:6px;">⏩ Skip ' + daysLeft + ' Days</button>';
            html += '</div>';
        }

        html += '</div>';

        openModal('🔒 Prison', html,
            '<button class="btn-medieval" onclick="UI.closeModal()">Close</button>');
    }

    function fastForwardJailUI() {
        if (typeof Player === 'undefined' || !Player.fastForwardJail) return;
        toast('⏩ Fast-forwarding through jail sentence...', 'info');
        closeModal();
        setTimeout(function() {
            Player.fastForwardJail();
            toast('🔓 You have been released from prison!', 'success');
        }, 100);
    }

    // ============================================================
    // §SCD — SUCCESSION CRISIS DIALOG
    // ============================================================
    function openSuccessionCrisisDialog(kingdomId) {
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        if (!kingdom || !kingdom.successionCrisis || !kingdom.successionCrisis.active) {
            toast('No active succession crisis.', 'warning'); return;
        }
        var crisis = kingdom.successionCrisis;
        var cfg = (typeof CONFIG !== 'undefined' && CONFIG.SUCCESSION_CRISIS) ? CONFIG.SUCCESSION_CRISIS : {};
        var currentDay = (typeof Engine !== 'undefined' && Engine.getDay) ? Engine.getDay() : 0;
        var daysLeft = Math.max(0, (crisis.endDay || 0) - currentDay);
        var playerState = (typeof Player !== 'undefined') ? Player.state : null;
        var canInfluence = false;
        if (playerState) {
            var pRank = (playerState.socialRank && playerState.socialRank[kingdomId]) || 0;
            var pRep = (playerState.reputation && playerState.reputation[kingdomId]) || 0;
            canInfluence = pRank >= (cfg.minRankToInfluence || 5) && playerState.gold >= (cfg.minGoldToInfluence || 10000) && pRep >= (cfg.minRepToInfluence || 70);
        }

        var html = '<div style="max-height:500px;overflow-y:auto;padding:8px;">';
        html += '<div style="background:rgba(255,50,50,0.15);padding:12px;border-radius:8px;margin-bottom:12px;">';
        html += '<h3 style="margin:0 0 8px;">⚠️ SUCCESSION CRISIS — ' + crisis.severity.toUpperCase() + '</h3>';
        html += '<p>⏳ ' + daysLeft + ' days until resolution</p>';
        if (crisis.playerBacking) {
            var backedName = '?';
            for (var bi = 0; bi < (crisis.pretenders || []).length; bi++) {
                if (crisis.pretenders[bi].id === crisis.playerBacking) backedName = crisis.pretenders[bi].name;
            }
            html += '<p style="color:#ffd700;">You are backing: <b>' + backedName + '</b> (' + (crisis.playerInvested || 0) + 'g invested)</p>';
        }
        html += '</div>';

        // Pretenders
        if (crisis.pretenders && crisis.pretenders.length > 0) {
            html += '<h4>👑 Claimants to the Throne</h4>';
            for (var pi = 0; pi < crisis.pretenders.length; pi++) {
                var pr = crisis.pretenders[pi];
                var isBacked = crisis.playerBacking === pr.id;
                html += '<div style="background:rgba(255,215,0,' + (isBacked ? '0.15' : '0.05') + ');padding:8px;border-radius:6px;margin-bottom:6px;border:1px solid rgba(255,215,0,' + (isBacked ? '0.4' : '0.1') + ');">';
                html += '<b>' + pr.name + '</b> <span class="text-dim">(' + pr.type + ')</span><br>';
                html += 'Support: ' + pr.support + ' | Gold: ' + (pr.gold || 0) + 'g';
                if (canInfluence && !crisis.playerBacking) {
                    html += '<br><button class="btn-medieval" onclick="UI.backPretenderUI(\'' + kingdomId + '\',\'' + pr.id + '\')" style="font-size:0.75rem;padding:3px 8px;margin-top:4px;">💰 Back with 10,000g</button>';
                }
                html += '</div>';
            }
        }

        if (!canInfluence && !crisis.playerBacking) {
            html += '<p class="text-dim" style="font-size:0.8rem;">Requires Lord rank (5+), 10,000g, and 70+ reputation to influence the succession.</p>';
        }

        html += '</div>';

        openModal('⚠️ Succession Crisis — ' + kingdom.name, html,
            '<button class="btn-medieval" onclick="UI.closeModal()">Close</button>');
    }

    function backPretenderUI(kingdomId, pretenderId) {
        var cfg = (typeof CONFIG !== 'undefined' && CONFIG.SUCCESSION_CRISIS) ? CONFIG.SUCCESSION_CRISIS : {};
        var cost = cfg.minGoldToInfluence || 10000;
        if (typeof Player !== 'undefined' && Player.state && Player.state.gold < cost) {
            toast('Not enough gold. Need ' + cost + 'g.', 'danger'); return;
        }
        if (typeof Player !== 'undefined' && Player.state) Player.state.gold -= cost;
        var result = null;
        try { result = Engine.backPretender(kingdomId, pretenderId, cost); } catch(e) {}
        if (result && result.success) {
            toast('💰 Backed claimant! New support: ' + result.newSupport, 'success');
            openSuccessionCrisisDialog(kingdomId); // refresh
        } else {
            toast(result ? result.reason : 'Failed.', 'danger');
        }
    }

    // ========================================================
    // FREE TRAVEL CONFIRMATION & TRAVEL HUD PANEL
    // ========================================================

    function confirmFreeTravel(worldX, worldY) {
        var terrainId = Engine.getTerrainAtPixel(worldX, worldY);
        var terrainNames = { 0: 'Grassland', 1: 'Forest', 2: 'Water', 3: 'Mountain', 4: 'Hills', 5: 'Desert' };
        var terrainName = terrainNames[terrainId] || 'Unknown';

        if (terrainId === 2) { toast('Cannot travel to water.', 'warning'); return; }
        if (terrainId === 3) { toast('Cannot travel through mountains.', 'warning'); return; }

        // Get start position — works whether in town, traveling, or wilderness
        var startX, startY;
        if (Player.traveling) {
            // Mid-travel: estimate current position
            var curPos = null;
            try { curPos = Player.getPlayerWorldPosition ? Player.getPlayerWorldPosition() : null; } catch(e) {}
            if (!curPos && Player.worldX) curPos = { x: Player.worldX, y: Player.worldY };
            if (!curPos) {
                var t = Engine.findTown(Player.townId || Player.travelOrigin);
                curPos = t ? { x: t.x, y: t.y } : null;
            }
            if (!curPos) { toast('Cannot determine current location.', 'warning'); return; }
            startX = curPos.x;
            startY = curPos.y;
        } else if (Player.townId) {
            var currentTown = Engine.findTown(Player.townId);
            if (!currentTown) { toast('Cannot determine current location.', 'warning'); return; }
            startX = currentTown.x;
            startY = currentTown.y;
        } else if (Player.worldX && Player.worldY) {
            startX = Player.worldX;
            startY = Player.worldY;
        } else {
            toast('Cannot determine current location.', 'warning'); return;
        }

        var dist = Math.hypot(worldX - startX, worldY - startY);
        var offRoadMult = 0.25;
        if (Player.hasSkill && Player.hasSkill('cartographer')) offRoadMult *= 1.5;
        var effectiveDist = dist / offRoadMult;
        if (Player.horses && Player.horses.length > 0) effectiveDist *= 0.7;
        var estDays = Math.max(1, Math.ceil(effectiveDist / (30 * 1.5 * 24)));

        var nearbyTowns = [];
        var towns = Engine.getTowns();
        for (var i = 0; i < towns.length; i++) {
            var d = Math.hypot(towns[i].x - worldX, towns[i].y - worldY);
            if (d < 200) nearbyTowns.push({ name: towns[i].name, dist: Math.round(d) });
        }

        var html = '<div>';
        html += '<p style="font-size:0.9rem;">\uD83E\uDDB6 <strong>Off-Road Travel</strong></p>';
        html += '<p style="font-size:0.85rem;color:var(--text-muted);">Terrain: ' + terrainName + '</p>';
        html += '<p style="font-size:0.85rem;">\u23F1\uFE0F Estimated: ~' + estDays + ' day' + (estDays !== 1 ? 's' : '') + '</p>';
        html += '<p style="font-size:0.85rem;">\uD83D\uDCB0 Cost: Free</p>';

        if (nearbyTowns.length > 0) {
            html += '<p style="font-size:0.8rem;color:var(--text-muted);">Near: ' + nearbyTowns.map(function(t) { return t.name; }).join(', ') + '</p>';
        }

        if (Player.traveling) {
            html += '<p style="font-size:0.8rem;color:#e8a54b;margin-top:8px;">\u26A0\uFE0F You will leave your current route and go off-road.</p>';
        }
        html += '<p style="font-size:0.8rem;color:#c9a96e;margin-top:8px;">\u26A0\uFE0F Off-road travel is 4\u00D7 slower than roads. Higher risk of encounters.</p>';

        html += '<div style="display:flex;gap:8px;margin-top:12px;">';
        html += '<button class="btn-medieval" style="flex:1;" onclick="Player.travelToCoords(' + worldX + ',' + worldY + '); UI.closeModal();">\uD83E\uDDB6 Go</button>';
        html += '<button class="btn-medieval" style="flex:1;opacity:0.6;" onclick="UI.closeModal();">Cancel</button>';
        html += '</div>';
        html += '</div>';

        openModal('\uD83D\uDDFA\uFE0F Travel Off-Road', html);
    }

    function updateTravelPanel() {
        var panel = document.getElementById('travelPanel');
        if (!panel) return;

        if (!Player.traveling) {
            panel.classList.add('hidden');
            return;
        }

        panel.classList.remove('hidden');

        var destText = document.getElementById('travelDestText');
        if (destText) {
            if (Player.travelDestination) {
                var dest = Engine.findTown(Player.travelDestination);
                destText.textContent = '\uD83D\uDCCD To: ' + (dest ? dest.name : 'Unknown');
            } else if (Player.travelDestCoords) {
                destText.textContent = '\uD83D\uDCCD To: Wilderness location';
            } else {
                destText.textContent = '\uD83D\uDCCD Traveling...';
            }
        }

        var bar = document.getElementById('travelProgressBar');
        if (bar) {
            bar.style.width = Math.round((Player.travelProgress || 0) * 100) + '%';
        }

        var eta = document.getElementById('travelETA');
        if (eta) {
            var remaining = 1 - (Player.travelProgress || 0);
            var speed = 30 * 1.5;
            var daysLeft = Math.max(1, Math.ceil(remaining * (Player.travelTotalDist || 100) / (speed * 24)));
            eta.textContent = '~' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' left';
        }

        var actionsDiv = document.getElementById('travelActions');
        if (actionsDiv) {
            var btns = '';
            if (!Player.travelPaid) {
                btns += '<button class="btn-travel" onclick="Player.turnBack()">\uD83D\uDD04 Turn Back</button>';
                btns += '<button class="btn-travel" onclick="Player.stopTravel()">\u23F9\uFE0F Stop Here</button>';
            }
            btns += '<button class="btn-travel" onclick="UI.openTravelRest()">\uD83C\uDFD5\uFE0F Camp</button>';
            btns += '<button class="btn-travel" onclick="UI.openCharacterDialog()">\uD83D\uDC64 Status</button>';
            actionsDiv.innerHTML = btns;
        }
    }

    function openTravelRest() {
        if (!Player.traveling) { toast('Not traveling.', 'info'); return; }

        var options = [];
        var inv = Player.inventory || {};

        if ((inv.camping_kit || 0) > 0) {
            options.push({ id: 'camping_kit_travel', icon: '\uD83C\uDFD5\uFE0F', name: 'Camp with Kit', energy: '5.0/tick', risks: 'None' });
        }
        if ((inv.tent || 0) > 0) {
            options.push({ id: 'tent_travel', icon: '\u26FA', name: 'Pitch Tent', energy: '4.0/tick', risks: '3% theft' });
        }
        if ((inv.bedroll || 0) > 0) {
            options.push({ id: 'bedroll_travel', icon: '\uD83D\uDECF\uFE0F', name: 'Use Bedroll', energy: '3.0/tick', risks: '5% theft, 3% disease' });
        }
        if (Player.hasCaravanWagon) {
            options.push({ id: 'caravan_wagon', icon: '\uD83D\uDED2', name: 'Rest in Wagon', energy: '4.5/tick', risks: '2% theft' });
        }
        options.push({ id: 'outside', icon: '\uD83C\uDF3F', name: 'Sleep Roadside', energy: '2.0/tick', risks: '10% theft, 5% disease, 5% injury' });

        var html = '<div>';
        html += '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;">Choose where to rest. You\'ll stop traveling while resting.</p>';

        for (var i = 0; i < options.length; i++) {
            var opt = options[i];
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px;margin-bottom:4px;background:rgba(255,255,255,0.03);border-radius:4px;cursor:pointer;" onclick="UI.startTravelRest(\'' + opt.id + '\')">';
            html += '<div>' + opt.icon + ' <strong>' + opt.name + '</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">\u26A1 ' + opt.energy + ' | \u26A0\uFE0F ' + opt.risks + '</span></div>';
            html += '<button class="btn-medieval" style="font-size:0.75rem;padding:3px 8px;">Rest</button>';
            html += '</div>';
        }
        html += '</div>';

        openModal('\uD83C\uDFD5\uFE0F Rest While Traveling', html);
    }

    function startTravelRest(locationId) {
        if (typeof Player !== 'undefined' && Player.restForTicks) {
            Player.restForTicks(locationId, 8);
            closeModal();
            toast('\uD83D\uDCA4 Resting...', 'info', 'travel_events');
        }
    }

    // ── God Mode Panel ──────────────────────────────────────────
    function openGodModePanel() {
        var existing = document.getElementById('god-mode-panel');
        if (existing) existing.remove();
        if (window._godModeRefreshInterval) clearInterval(window._godModeRefreshInterval);

        var panel = document.createElement('div');
        panel.id = 'god-mode-panel';
        panel.style.cssText = 'position:fixed;top:0;right:0;width:480px;height:100vh;background:#1a1a2e;color:#e0e0e0;border-left:3px solid #FFD700;overflow-y:auto;z-index:10000;font-family:monospace;font-size:12px;padding:10px;box-shadow:-5px 0 20px rgba(0,0,0,0.5);';

        panel.innerHTML = buildGodModeHTML();
        document.body.appendChild(panel);

        window._godModeRefreshInterval = setInterval(function() {
            var p = document.getElementById('god-mode-panel');
            if (p) p.innerHTML = buildGodModeHTML();
            else clearInterval(window._godModeRefreshInterval);
        }, 2000);
    }

    function closeGodModePanel() {
        var panel = document.getElementById('god-mode-panel');
        if (panel) panel.remove();
        if (window._godModeRefreshInterval) clearInterval(window._godModeRefreshInterval);
    }

    function buildGodModeHTML() {
        var html = '<div style="border-bottom:2px solid #FFD700;padding-bottom:8px;margin-bottom:10px;">';
        html += '<span style="font-size:18px;color:#FFD700;">🔮 GOD MODE</span>';
        html += ' <button onclick="UI.closeGodModePanel()" style="float:right;background:#8b0000;color:white;border:none;padding:4px 10px;cursor:pointer;">✕ Close</button>';
        html += '</div>';

        // === CHEAT BUTTONS ===
        html += '<div style="margin-bottom:12px;padding:8px;background:#2a2a3e;border-radius:4px;">';
        html += '<div style="color:#FFD700;font-weight:bold;margin-bottom:6px;">⚡ CHEATS</div>';
        html += '<button onclick="Player.state.gold+=10000;UI.toast(\'💰 +10,000 gold\',\'success\')" style="margin:2px;padding:3px 8px;background:#2d5016;color:#fff;border:1px solid #4a8;cursor:pointer;">+10K Gold</button> ';
        html += '<button onclick="Player.state.gold+=100000;UI.toast(\'💰 +100,000 gold\',\'success\')" style="margin:2px;padding:3px 8px;background:#2d5016;color:#fff;border:1px solid #4a8;cursor:pointer;">+100K Gold</button> ';
        html += '<button onclick="Player.state.skillPoints=(Player.state.skillPoints||0)+20;UI.toast(\'🧠 +20 SP\',\'success\')" style="margin:2px;padding:3px 8px;background:#16305d;color:#fff;border:1px solid #48a;cursor:pointer;">+20 SP</button> ';
        html += '<button onclick="Player.state.skillPoints=(Player.state.skillPoints||0)+100;UI.toast(\'🧠 +100 SP\',\'success\')" style="margin:2px;padding:3px 8px;background:#16305d;color:#fff;border:1px solid #48a;cursor:pointer;">+100 SP</button> ';
        html += '<button onclick="Player.state.energy=100;Player.state.hunger=0;Player.state.thirst=0;UI.toast(\'💪 Full energy/food/drink\',\'success\')" style="margin:2px;padding:3px 8px;background:#5d1630;color:#fff;border:1px solid #a48;cursor:pointer;">Full Energy</button> ';
        html += '<button onclick="if(Player.state.jailedUntilDay){Player.state.jailedUntilDay=0;UI.toast(\'🔓 Freed from jail\',\'success\');}else{UI.toast(\'Not in jail\',\'info\');}" style="margin:2px;padding:3px 8px;background:#5d4016;color:#fff;border:1px solid #a84;cursor:pointer;">Free from Jail</button> ';
        html += '<button onclick="Player.state.traveling=false;Player.state.travelProgress=0;UI.toast(\'🏠 Travel cancelled\',\'success\')" style="margin:2px;padding:3px 8px;background:#4a3520;color:#fff;border:1px solid #a86;cursor:pointer;">Stop Travel</button> ';

        // Set Gold input
        html += '<br><input id="gm-set-gold" type="number" placeholder="Set gold..." style="width:80px; background:#333; color:#fff; border:1px solid #666; padding:2px 4px; margin:2px;" />';
        html += '<button onclick="var v=document.getElementById(\'gm-set-gold\').value; if(v){Player.state.gold=parseInt(v); UI.toast(\'💰 Gold set to \'+v,\'success\');}" style="margin:2px; padding:3px 8px; background:#2d5016; color:#fff; border:1px solid #4a8; cursor:pointer;">Set Gold</button> ';

        // Invincibility toggle
        html += '<br><button id="gm-invincible-btn" onclick="window._godInvincible=!window._godInvincible; var b=this; b.textContent=window._godInvincible?\'🛡️ Invincible ON\':\'🛡️ Invincible OFF\'; b.style.background=window._godInvincible?\'#8b0000\':\'#16305d\'; b.style.borderColor=window._godInvincible?\'#f44\':\'#48a\'; UI.toast(window._godInvincible?\'🛡️ INVINCIBLE — Cannot die or lose\':\'Invincibility OFF\', window._godInvincible?\'success\':\'info\')" style="margin:2px; padding:3px 8px; background:' + (window._godInvincible ? '#8b0000' : '#16305d') + '; color:#fff; border:1px solid ' + (window._godInvincible ? '#f44' : '#48a') + '; cursor:pointer;">' + (window._godInvincible ? '🛡️ Invincible ON' : '🛡️ Invincible OFF') + '</button> ';

        // Set rank
        html += '<select id="gm-set-rank" style="background:#333; color:#fff; border:1px solid #666; margin:2px; padding:2px;"><option value="0">Peasant</option><option value="1">Citizen</option><option value="2">Burgher</option><option value="3">Guildmaster</option><option value="4">Minor Noble</option><option value="5">Lord</option><option value="6">Royal Advisor</option></select>';
        html += '<button onclick="var sel=document.getElementById(\'gm-set-rank\'); var r=parseInt(sel.value); var kid=Player.state.citizenshipKingdomId||Object.keys(Player.state.socialRank||{})[0]||\'k_1\'; if(!Player.state.socialRank)Player.state.socialRank={}; Player.state.socialRank[kid]=r; var names=[\'Peasant\',\'Citizen\',\'Burgher\',\'Guildmaster\',\'Minor Noble\',\'Lord\',\'Royal Advisor\']; UI.toast(\'Set rank to \'+(names[r]||r)+\' in \'+kid,\'success\')" style="margin:2px; padding:3px 8px; background:#5d1630; color:#fff; border:1px solid #a48; cursor:pointer;">Set Rank</button> ';

        // Unlock all skills
        html += '<button onclick="if(typeof SKILLS!==\'undefined\'){var count=0; for(var sk in SKILLS){if(!Player.state.unlockedSkills)Player.state.unlockedSkills=[];if(Player.state.unlockedSkills.indexOf(sk)===-1){Player.state.unlockedSkills.push(sk); count++;}} UI.toast(\'🧠 Unlocked \'+count+\' skills! (\'+Player.state.unlockedSkills.length+\' total)\',\'success\');}else{UI.toast(\'SKILLS config not found\',\'error\');}" style="margin:2px; padding:3px 8px; background:#5d4016; color:#fff; border:1px solid #a84; cursor:pointer;">Unlock All Skills</button> ';

        // Advance time
        html += '<br><input id="gm-advance-days" type="number" value="30" style="width:60px; background:#333; color:#fff; border:1px solid #666; padding:2px 4px; margin:2px;" />';
        html += '<button onclick="var d=parseInt(document.getElementById(\'gm-advance-days\').value)||30; for(var i=0;i<d;i++){Engine.tick();Player.tick();} UI.toast(\'⏩ Advanced \'+d+\' days\',\'success\')" style="margin:2px; padding:3px 8px; background:#16305d; color:#fff; border:1px solid #48a; cursor:pointer;">Advance Days</button> ';

        html += '</div>';

        // === POSSESSED NPC ===
        if (window._gmPossessedNpc) {
            html += '<div style="margin-bottom:12px; padding:8px; background:#3a2a4e; border:2px solid #a0a; border-radius:4px;">';
            html += '<div style="color:#e0a0ff; font-weight:bold; margin-bottom:6px;">👁️ POSSESSING NPC <button onclick="window._gmPossessedNpc=null" style="float:right; font-size:10px; padding:1px 6px; background:#600; color:#fff; border:1px solid #a00; cursor:pointer;">✖ Stop</button></div>';
            try {
                var poss = Engine.getPeople().find(function(pp) { return pp.id === window._gmPossessedNpc; });
                if (poss) {
                    var possTown = Engine.findTown ? Engine.findTown(poss.townId) : null;
                    html += '<div style="font-size:11px; color:#ddd;">';
                    html += '<b>' + (poss.firstName || '?') + ' ' + (poss.lastName || '') + '</b> (' + (poss.sex || '?') + ', Age ' + (poss.age || '?') + ')';
                    html += '<br>📍 ' + (possTown ? possTown.name : '?') + ' | 💰 ' + Math.floor(poss.gold || 0).toLocaleString() + 'g | 🏷️ ' + (poss.occupation || '?');
                    html += '<br>❤️ Alive: ' + poss.alive;
                    if (poss.personality) {
                        html += '<br><b>Personality:</b>';
                        for (var pk in poss.personality) { html += ' ' + pk + ':' + poss.personality[pk]; }
                    }
                    if (poss.skills) {
                        html += '<br><b>Skills:</b>';
                        for (var sk in poss.skills) { html += ' ' + sk + ':' + poss.skills[sk]; }
                    }
                    if (poss.needs) {
                        html += '<br><b>Needs:</b>';
                        for (var nk in poss.needs) { html += ' ' + nk + ':' + Math.round(poss.needs[nk]); }
                    }
                    html += '<br><b>Family:</b>';
                    if (poss.spouseId) {
                        var possSpouse = Engine.getPeople().find(function(pp){return pp.id===poss.spouseId});
                        html += ' Spouse: ' + (possSpouse ? possSpouse.firstName : poss.spouseId);
                    }
                    if (poss.childrenIds && poss.childrenIds.length > 0) {
                        html += ' | Children: ' + poss.childrenIds.length;
                    }
                    if (poss.npcMerchantInventory) {
                        html += '<br><b>Inventory:</b>';
                        var hasItems = false;
                        for (var item in poss.npcMerchantInventory) {
                            if (poss.npcMerchantInventory[item] > 0) { html += ' ' + item + ':' + poss.npcMerchantInventory[item]; hasItems = true; }
                        }
                        if (!hasItems) html += ' (empty)';
                    }
                    if (poss.isEliteMerchant) {
                        html += '<br><b>EM Data:</b> Strategy: ' + (poss.strategy || '?');
                        if (poss.emCaravans && poss.emCaravans.length > 0) html += ' | Caravans: ' + poss.emCaravans.length;
                        if (poss.heraldry) html += ' | Heraldry: ' + (poss.heraldry.name || '?');
                    }
                    if (poss.buildings && poss.buildings.length > 0) html += '<br><b>Buildings:</b> ' + poss.buildings.length + ' owned';
                    if (poss.mood) html += '<br><b>Mood:</b> ' + poss.mood;
                    html += '<br><b>Quirks:</b> ' + (poss.quirks && poss.quirks.length > 0 ? poss.quirks.join(', ') : 'none');
                    html += '</div>';
                } else {
                    html += '<div style="color:#f44;">NPC not found (may be dead)</div>';
                    window._gmPossessedNpc = null;
                }
            } catch(e) { html += '<div style="color:#f44;">Error: ' + e.message + '</div>'; }
            html += '</div>';
        }

        // === WORLD STATE ===
        html += '<div style="margin-bottom:12px;padding:8px;background:#2a2a3e;border-radius:4px;">';
        html += '<div style="color:#FFD700;font-weight:bold;margin-bottom:6px;">🌍 WORLD STATE</div>';
        try {
            var day = Engine.getDay ? Engine.getDay() : '?';
            var kingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
            var towns = Engine.getTowns ? Engine.getTowns() : [];
            var ems = Engine.getEliteMerchants ? Engine.getEliteMerchants() : [];
            html += '<div>Day: <span style="color:#4fc3f7;">' + day + '</span> | Kingdoms: <span style="color:#4fc3f7;">' + kingdoms.length + '</span> | Towns: <span style="color:#4fc3f7;">' + towns.length + '</span> | Elite Merchants: <span style="color:#4fc3f7;">' + ems.length + '</span></div>';

            var totalGold = 0;
            var people = Engine.getPeople ? Engine.getPeople() : [];
            for (var i = 0; i < people.length; i++) { if (people[i].alive) totalGold += (people[i].gold || 0); }
            for (var ki = 0; ki < kingdoms.length; ki++) { totalGold += (kingdoms[ki].gold || 0); }
            totalGold += (Player.state.gold || 0);
            html += '<div>Total Gold in Economy: <span style="color:#ffd700;">' + Math.round(totalGold).toLocaleString() + 'g</span></div>';
        } catch(e) { html += '<div style="color:#f44;">Error: ' + e.message + '</div>'; }
        html += '</div>';

        // === KINGDOMS ===
        html += '<div style="margin-bottom:12px;padding:8px;background:#2a2a3e;border-radius:4px;">';
        html += '<div style="color:#FFD700;font-weight:bold;margin-bottom:6px;">👑 KINGDOMS</div>';
        try {
            var kingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
            for (var ki = 0; ki < kingdoms.length; ki++) {
                var k = kingdoms[ki];
                var king = k.king ? (Engine.getPerson ? Engine.getPerson(k.king) : (Engine.findPerson ? Engine.findPerson(k.king) : null)) : null;
                var kingName = king ? (king.firstName || '') + ' ' + (king.lastName || '') : 'Unknown';
                var mood = (k.kingMood && k.kingMood.current) ? k.kingMood.current : (king ? 'unknown' : '?');
                var wars = (k.atWar && Array.isArray(k.atWar)) ? k.atWar.length : ((k.atWar && k.atWar.size) ? k.atWar.size : 0);
                var kTowns = Engine.getTowns ? Engine.getTowns().filter(function(t){return t.kingdomId===k.id;}) : [];
                var avgProsp = kTowns.length > 0 ? Math.round(kTowns.reduce(function(s,t){return s+(t.prosperity||0);},0)/kTowns.length) : 0;
                html += '<div style="margin:4px 0;padding:4px;border-left:3px solid ' + (k.color || '#666') + ';">';
                html += '<b>' + (k.name || 'Kingdom') + '</b> — King: ' + kingName + '<br>';
                html += '💰 ' + Math.floor(k.gold || 0).toLocaleString() + 'g | 😊 Mood: ' + mood + ' | ⚔️ Wars: ' + wars + ' | 🏘️ Towns: ' + kTowns.length + ' | 📈 Avg Prosperity: ' + avgProsp;
                html += ' | Tax: ' + Math.round((k.taxRate || 0) * 100) + '%';
                html += '</div>';
            }
        } catch(e) { html += '<div style="color:#f44;">Error: ' + e.message + '</div>'; }
        html += '</div>';

        // === TOP TOWNS ===
        html += '<div style="margin-bottom:12px;padding:8px;background:#2a2a3e;border-radius:4px;">';
        html += '<div style="color:#FFD700;font-weight:bold;margin-bottom:6px;">🏘️ TOP 10 TOWNS (by prosperity)</div>';
        try {
            var towns = Engine.getTowns ? Engine.getTowns() : [];
            towns = towns.slice().sort(function(a,b){return (b.prosperity||0)-(a.prosperity||0);});
            for (var ti = 0; ti < Math.min(towns.length, 10); ti++) {
                var t = towns[ti];
                html += '<div style="margin:2px 0;">' + (ti+1) + '. <b>' + (t.name||'?') + '</b> (' + (t.isCapital ? 'capital' : (t.category || t.tier || '?')) + ') — Prosp: ' + Math.round(t.prosperity||0) + ' | Pop: ' + (t.population||0) + ' | Happy: ' + Math.round(t.happiness||0) + '</div>';
            }
        } catch(e) { html += '<div style="color:#f44;">Error: ' + e.message + '</div>'; }
        html += '</div>';

        // === ELITE MERCHANTS ===
        html += '<div style="margin-bottom:12px;padding:8px;background:#2a2a3e;border-radius:4px;">';
        html += '<div style="color:#FFD700;font-weight:bold;margin-bottom:6px;">⭐ ELITE MERCHANTS</div>';
        try {
            var ems = Engine.getEliteMerchants ? Engine.getEliteMerchants() : [];
            // Fallback: scan people if getEliteMerchants returns empty
            if (ems.length === 0 && Engine.getPeople) {
                ems = Engine.getPeople().filter(function(p) { return p.isEliteMerchant; });
            }
            ems = ems.slice().sort(function(a,b){return (b.gold||0)-(a.gold||0);});
            for (var ei = 0; ei < ems.length; ei++) {
                var em = ems[ei];
                var emTown = Engine.findTown ? Engine.findTown(em.townId) : null;
                var invCount = 0;
                if (em.npcMerchantInventory) { for (var k2 in em.npcMerchantInventory) invCount += (em.npcMerchantInventory[k2]||0); }
                html += '<div style="margin:3px 0;padding:3px;border-left:2px solid #FFD700;">';
                html += (em.heraldry ? em.heraldry.symbol + ' ' : '') + '<b>' + (em.firstName||'') + ' ' + (em.lastName||'') + '</b>';
                html += ' — 💰' + Math.floor(em.gold||0).toLocaleString() + 'g | 📦' + invCount + ' items';
                html += ' | 📍' + (emTown ? emTown.name : '?');
                html += ' | 🎯' + (em.strategy||'?');
                if (em.traveling) html += ' | 🚶 Traveling (' + Math.round((em.travelProgress||0)*100) + '%)';
                html += '</div>';
            }
            if (ems.length === 0) html += '<div>No elite merchants found</div>';
        } catch(e) { html += '<div style="color:#f44;">Error: ' + e.message + '</div>'; }
        html += '</div>';

        // === NPC CARAVANS ===
        html += '<div style="margin-bottom:12px;padding:8px;background:#2a2a3e;border-radius:4px;">';
        html += '<div style="color:#FFD700;font-weight:bold;margin-bottom:6px;">🐪 NPC CARAVANS</div>';
        try {
            var caravans = Engine.getNpcCaravans ? Engine.getNpcCaravans() : [];
            if (caravans.length === 0) {
                html += '<div>No active NPC caravans</div>';
            } else {
                for (var ci = 0; ci < caravans.length; ci++) {
                    var c = caravans[ci];
                    var fromT = Engine.findTown ? Engine.findTown(c.fromTownId) : null;
                    var toT = Engine.findTown ? Engine.findTown(c.toTownId) : null;
                    var goodsStr = '';
                    for (var gk in (c.goods||{})) { goodsStr += gk + ':' + c.goods[gk] + ' '; }
                    html += '<div style="margin:2px 0;">' + (c.ownerType === 'kingdom' ? '👑' : '⭐') + ' ' + (fromT?fromT.name:'?') + ' → ' + (toT?toT.name:'?') + ' | ' + Math.round((c.progress||0)*100) + '% | ' + c.mode + ' | ' + (goodsStr || 'empty') + '</div>';
                }
            }
        } catch(e) { html += '<div style="color:#f44;">Error: ' + e.message + '</div>'; }
        html += '</div>';

        // === PLAYER DEBUG ===
        html += '<div style="margin-bottom:12px;padding:8px;background:#2a2a3e;border-radius:4px;">';
        html += '<div style="color:#FFD700;font-weight:bold;margin-bottom:6px;">🧑 PLAYER DEBUG</div>';
        try {
            var p = Player.state;
            html += '<div>Gold: ' + Math.floor(p.gold||0).toLocaleString() + ' | SP: ' + (p.skillPoints||0) + ' | Energy: ' + Math.round(p.energy||0) + ' | Rank: ' + (p.socialRank && p.citizenshipKingdomId ? (p.socialRank[p.citizenshipKingdomId] != null ? p.socialRank[p.citizenshipKingdomId] : '?') : '?') + '</div>';
            html += '<div>Town: ' + (p.townId||'?') + ' | Kingdom: ' + (p.citizenshipKingdomId||'?') + ' | Day: ' + (Engine.getDay?Engine.getDay():'?') + '</div>';
            html += '<div>Traveling: ' + (p.traveling?'Yes ('+Math.round((p.travelProgress||0)*100)+'%)':'No') + ' | Jailed: ' + (p.jailedUntilDay>0?'Until day '+p.jailedUntilDay:'No') + '</div>';
            var skills = p.unlockedSkills || [];
            html += '<div>Skills (' + skills.length + '): ' + skills.join(', ') + '</div>';
            var bldCount = p.buildings ? p.buildings.length : 0;
            var caravanCount = p.caravans ? p.caravans.length : 0;
            html += '<div>Buildings: ' + bldCount + ' | Caravans: ' + caravanCount + ' | Workers: ' + (p.workers?p.workers.length:0) + '</div>';
        } catch(e) { html += '<div style="color:#f44;">Error: ' + e.message + '</div>'; }
        html += '</div>';

        // === ACTIVE WARS ===
        html += '<div style="margin-bottom:12px;padding:8px;background:#2a2a3e;border-radius:4px;">';
        html += '<div style="color:#FFD700;font-weight:bold;margin-bottom:6px;">⚔️ ACTIVE WARS</div>';
        try {
            var kingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
            var warPairs = {};
            for (var wi = 0; wi < kingdoms.length; wi++) {
                var wk = kingdoms[wi];
                if (wk.atWar) {
                    wk.atWar.forEach(function(enemyId) {
                        var pairKey = [wk.id, enemyId].sort().join('-');
                        if (!warPairs[pairKey]) {
                            var enemy = kingdoms.find(function(kk){return kk.id===enemyId;});
                            warPairs[pairKey] = (wk.name||'?') + ' ⚔️ ' + (enemy?enemy.name:'?');
                        }
                    });
                }
            }
            var warList = Object.values(warPairs);
            if (warList.length === 0) html += '<div>Peace across the realm</div>';
            else { for (var wli = 0; wli < warList.length; wli++) html += '<div>' + warList[wli] + '</div>'; }
        } catch(e) { html += '<div style="color:#f44;">Error: ' + e.message + '</div>'; }
        html += '</div>';

        // === NPC BROWSER ===
        html += '<div style="margin-bottom:12px; padding:8px; background:#2a2a3e; border-radius:4px;">';
        html += '<div style="color:#FFD700; font-weight:bold; margin-bottom:6px;">👥 NPC BROWSER</div>';

        // Search and filter controls
        html += '<div style="margin-bottom:6px;">';
        html += '<input id="gm-npc-search" type="text" placeholder="Search by name..." style="width:140px; background:#333; color:#fff; border:1px solid #666; padding:3px 6px; margin:2px;" oninput="window._gmNpcSearch=this.value" />';
        html += '<select id="gm-npc-filter" style="background:#333; color:#fff; border:1px solid #666; margin:2px; padding:3px;" onchange="window._gmNpcFilter=this.value">';
        html += '<option value="all">All NPCs</option>';
        html += '<option value="king">👑 Kings</option>';
        html += '<option value="elite">⭐ Elite Merchants</option>';
        html += '<option value="merchant">🏪 Merchants</option>';
        html += '<option value="farmer">🌾 Farmers</option>';
        html += '<option value="craftsman">🔨 Craftsmen</option>';
        html += '</select>';
        html += '<select id="gm-npc-sort" style="background:#333; color:#fff; border:1px solid #666; margin:2px; padding:3px;" onchange="window._gmNpcSort=this.value">';
        html += '<option value="gold">Sort: Gold ↓</option>';
        html += '<option value="name">Sort: Name</option>';
        html += '<option value="age">Sort: Age ↓</option>';
        html += '</select>';
        html += '</div>';

        try {
            var npcPeople = Engine.getPeople ? Engine.getPeople() : [];
            var npcKingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
            var searchTerm = (window._gmNpcSearch || '').toLowerCase();
            var filterType = window._gmNpcFilter || 'all';
            var sortType = window._gmNpcSort || 'gold';

            // Build king lookup
            var kingIds = {};
            for (var kki = 0; kki < npcKingdoms.length; kki++) {
                if (npcKingdoms[kki].kingId) kingIds[npcKingdoms[kki].kingId] = npcKingdoms[kki].name;
            }

            // Filter people
            var filtered = npcPeople.filter(function(p) {
                if (!p.alive) return false;
                if (searchTerm && ((p.firstName || '') + ' ' + (p.lastName || '')).toLowerCase().indexOf(searchTerm) === -1) return false;
                if (filterType === 'king') return !!kingIds[p.id];
                if (filterType === 'elite') return p.isEliteMerchant;
                if (filterType === 'merchant') return p.occupation === 'merchant' && !p.isEliteMerchant;
                if (filterType === 'farmer') return p.occupation === 'farmer';
                if (filterType === 'craftsman') return p.occupation === 'craftsman';
                return true;
            });

            // Sort
            if (sortType === 'gold') filtered.sort(function(a,b) { return (b.gold||0) - (a.gold||0); });
            else if (sortType === 'name') filtered.sort(function(a,b) { return ((a.firstName||'')+(a.lastName||'')).localeCompare((b.firstName||'')+(b.lastName||'')); });
            else if (sortType === 'age') filtered.sort(function(a,b) { return (b.age||0) - (a.age||0); });

            html += '<div style="color:#aaa; margin-bottom:4px;">Showing ' + Math.min(filtered.length, 50) + ' of ' + filtered.length + ' NPCs</div>';

            // Show top 50
            for (var ni = 0; ni < Math.min(filtered.length, 50); ni++) {
                var npc = filtered[ni];
                var npcTown = Engine.findTown ? Engine.findTown(npc.townId) : null;
                var isKing = !!kingIds[npc.id];
                var badge = isKing ? '👑' : npc.isEliteMerchant ? '⭐' : '👤';
                var kingdomInfo = isKing ? ' [King of ' + kingIds[npc.id] + ']' : '';

                html += '<div style="margin:3px 0; padding:4px; background:#1e1e2e; border-radius:3px; border-left:2px solid ' + (isKing ? '#FFD700' : npc.isEliteMerchant ? '#FFA500' : '#555') + ';">';
                html += badge + ' <b>' + (npc.firstName || '?') + ' ' + (npc.lastName || '') + '</b>';
                html += ' <span style="color:#888;">Age:' + (npc.age || '?') + ' ' + (npc.sex || '?') + '</span>';
                html += kingdomInfo;
                html += '<br>💰' + Math.floor(npc.gold || 0).toLocaleString() + 'g | 📍' + (npcTown ? npcTown.name : '?') + ' | 🏷️' + (npc.occupation || '?');
                if (npc.isEliteMerchant) html += ' | 🎯' + (npc.strategy || '?');
                if (isKing && npc.mood) html += ' | 😊' + npc.mood;

                // Action buttons
                html += '<br>';
                // Travel to
                html += '<button onclick="Player.state.townId=\'' + npc.townId + '\'; Player.state.traveling=false; UI.toast(\'Teleported to ' + ((npcTown ? npcTown.name : '?').replace(/'/g, '')) + '\',\'success\')" style="font-size:10px; padding:1px 5px; margin:1px; background:#16305d; color:#fff; border:1px solid #48a; cursor:pointer;">📍Travel To</button>';
                // Kill
                html += '<button onclick="var pp=Engine.getPeople().find(function(x){return x.id===\'' + npc.id + '\';}); if(pp){pp.alive=false; pp._deathDay=Engine.getDay(); UI.toast(\'💀 Killed ' + ((npc.firstName || '?').replace(/'/g, '')) + '\',\'warning\');}" style="font-size:10px; padding:1px 5px; margin:1px; background:#8b0000; color:#fff; border:1px solid #f44; cursor:pointer;">💀Kill</button>';
                // Give gold
                html += '<button onclick="var pp=Engine.getPeople().find(function(x){return x.id===\'' + npc.id + '\';}); if(pp){pp.gold=(pp.gold||0)+1000; UI.toast(\'💰+1000g to ' + ((npc.firstName || '?').replace(/'/g, '')) + '\',\'success\');}" style="font-size:10px; padding:1px 5px; margin:1px; background:#2d5016; color:#fff; border:1px solid #4a8; cursor:pointer;">💰+1K</button>';
                // Force marry player
                html += '<button onclick="(function(){var oldSp=Player.state.spouseId; if(oldSp){var op=Engine.getPeople().find(function(x){return x.id===oldSp;}); if(op)op.spouseId=null;} Player.state.spouseId=\'' + npc.id + '\'; Player.state.spouseRelationship=50; var pp=Engine.getPeople().find(function(x){return x.id===\'' + npc.id + '\';}); if(pp){if(pp.spouseId){var os=Engine.getPeople().find(function(x){return x.id===pp.spouseId;}); if(os)os.spouseId=null;} pp.spouseId=\'player\';} UI.toast(\'💒 Married ' + ((npc.firstName || '?').replace(/'/g, '')) + '!\',\'success\');})()" style="font-size:10px; padding:1px 5px; margin:1px; background:#5d1630; color:#fff; border:1px solid #a48; cursor:pointer;">💒Marry</button>';
                // Possess - spectate NPC
                html += '<button onclick="window._gmPossessedNpc=\'' + npc.id + '\'; UI.toast(\'👁️ Possessing ' + ((npc.firstName || '?').replace(/'/g, '')) + '\',\'info\')" style="font-size:10px; padding:1px 5px; margin:1px; background:#4a004a; color:#fff; border:1px solid #a0a; cursor:pointer;">👁️Possess</button>';
                // Become NPC — swap player identity
                html += '<button onclick="(function(){var target=Engine.getPeople().find(function(x){return x.id===\'' + npc.id + '\'}); if(!target){UI.toast(\'NPC not found\',\'error\'); return;} if(!confirm(\'Become \'+target.firstName+\'? Your old character becomes an Elite Merchant.\')){return;} var st=Player.state; var oldClone={id:\'p_former_\'+Engine.getDay(), firstName:st.firstName, lastName:st.lastName, sex:st.sex, age:st.age, gold:st.gold, townId:st.townId, personality:Object.assign({},st.personality||{}), skills:Object.assign({},st.skills||{}), needs:{food:80,shelter:80,safety:80,wealth:50}, alive:true, occupation:\'merchant\', isEliteMerchant:true, strategy:\'opportunist\', npcMerchantInventory:{}, emCaravans:[], _formerPlayer:true, spouseId:null, childrenIds:(st.childrenIds||[]).slice(), parentIds:(st.parentIds||[]).slice()}; var oldName=oldClone.firstName+\' \'+oldClone.lastName; var world=Engine.getWorld(); if(world.eliteMerchants){world.eliteMerchants.push(oldClone);} Engine.addPerson(oldClone); st.townId=target.townId; st.gold=target.gold||100; st.firstName=target.firstName; st.lastName=target.lastName; st.sex=target.sex; st.age=target.age; st.personality=target.personality||st.personality; st.spouseId=target.spouseId||null; st.spouseRelationship=target.spouseId?50:0; st.childrenIds=target.childrenIds||[]; st.parentIds=target.parentIds||[]; st.traveling=false; st.travelPath=null; target.alive=false; target._deathDay=Engine.getDay(); target._absorbed=true; UI.toast(\'🔄 You are now \'+st.firstName+\'! Old character (\'+oldName+\') is now an Elite Merchant.\',\'success\');})()" style="font-size:10px; padding:1px 5px; margin:1px; background:#004a4a; color:#fff; border:1px solid #0aa; cursor:pointer;">🔄Become</button>';

                // King-specific actions
                if (isKing) {
                    var kingKingdom = npcKingdoms.find(function(kk) { return kk.kingId === npc.id; });
                    if (kingKingdom) {
                        var kid = kingKingdom.id;
                        html += '<br>';
                        html += '<button onclick="Engine.godAddKingdomGold(\'' + kid + '\', 5000); UI.toast(\'💰+5000g to kingdom\',\'success\');" style="font-size:10px; padding:1px 5px; margin:1px; background:#2d5016; color:#fff; border:1px solid #4a8; cursor:pointer;">💰+5K Treasury</button>';
                        // Force declare war — pick random enemy
                        html += '<button onclick="var all=Engine.getKingdoms(); if(all.length>1){var targets=all.filter(function(t){return t.id!==\'' + kid + '\';}); var target=targets[Math.floor(Math.random()*targets.length)]; Engine.godDeclareWar(\'' + kid + '\', target.id); UI.toast(\'⚔️ War declared on \'+target.name,\'warning\');}" style="font-size:10px; padding:1px 5px; margin:1px; background:#8b0000; color:#fff; border:1px solid #f44; cursor:pointer;">⚔️Declare War</button>';
                        // Force change tax
                        html += '<button onclick="var kk=Engine.getKingdom(\'' + kid + '\'); if(kk){Engine.godSetKingdomTax(\'' + kid + '\', Math.min(0.5,(kk.taxRate||0.1)+0.05)); UI.toast(\'📈 Tax now \'+(Math.min(0.5,(kk.taxRate||0.1)+0.05)*100).toFixed(0)+\'%\',\'info\');}" style="font-size:10px; padding:1px 5px; margin:1px; background:#5d4016; color:#fff; border:1px solid #a84; cursor:pointer;">📈+Tax</button>';
                        html += '<button onclick="var kk=Engine.getKingdom(\'' + kid + '\'); if(kk){Engine.godSetKingdomTax(\'' + kid + '\', Math.max(0.01,(kk.taxRate||0.1)-0.05)); UI.toast(\'📉 Tax now \'+(Math.max(0.01,(kk.taxRate||0.1)-0.05)*100).toFixed(0)+\'%\',\'info\');}" style="font-size:10px; padding:1px 5px; margin:1px; background:#5d4016; color:#fff; border:1px solid #a84; cursor:pointer;">📉-Tax</button>';
                        // Force mood change
                        html += '<button onclick="var pp=Engine.getPeople().find(function(x){return x.id===\'' + npc.id + '\';}); if(pp){var moods=[\'jubilant\',\'content\',\'worried\',\'paranoid\',\'wrathful\',\'ambitious\']; pp.mood=moods[Math.floor(Math.random()*moods.length)]; UI.toast(\'😊 Mood: \'+pp.mood,\'info\');}" style="font-size:10px; padding:1px 5px; margin:1px; background:#16305d; color:#fff; border:1px solid #48a; cursor:pointer;">🎭Rand Mood</button>';
                        // Force make peace (clear all wars)
                        html += '<button onclick="var kk=Engine.getKingdom(\'' + kid + '\'); if(kk && kk.atWar){kk.atWar.forEach(function(eid){Engine.godMakePeace(\'' + kid + '\', eid);}); UI.toast(\'☮️ Peace declared!\',\'success\');}" style="font-size:10px; padding:1px 5px; margin:1px; background:#16505d; color:#fff; border:1px solid #4a8; cursor:pointer;">☮️Peace</button>';
                    }
                }

                html += '</div>';
            }
        } catch(e) { html += '<div style="color:#f44;">Error: ' + e.message + '</div>'; }
        html += '</div>';

        // === FORCE EVENTS ===
        html += '<div style="margin-bottom:12px; padding:8px; background:#2a2a3e; border-radius:4px;">';
        html += '<div style="color:#FFD700; font-weight:bold; margin-bottom:6px;">🌪️ FORCE EVENTS</div>';
        html += '<button onclick="(function(){var t=Engine.getTowns().find(function(t){return t.id===Player.state.townId}); if(t&&t.market&&t.market.supply){var foods=[\'wheat\',\'meat\',\'fish\',\'bread\',\'eggs\',\'poultry\',\'flour\',\'grapes\',\'preserved_food\']; for(var i=0;i<foods.length;i++){var r=foods[i]; if(t.market.supply[r]!==undefined){t.market.supply[r]=Math.max(1,Math.floor((t.market.supply[r]||50)*0.1));}} UI.toast(\'🥺 Famine! Food supplies at 10% in \'+t.name,\'warning\');}else{UI.toast(\'No town found\',\'error\');}})()" style="margin:2px; padding:3px 8px; background:#8b4000; color:#fff; border:1px solid #d80; cursor:pointer;">🥺 Famine (This Town)</button> ';
        html += '<button onclick="(function(){var t=Engine.getTowns().find(function(t){return t.id===Player.state.townId}); if(t&&t.market&&t.market.supply){t.market.supply.gold_ore=(t.market.supply.gold_ore||0)+500; t.market.supply.jewelry=(t.market.supply.jewelry||0)+200; UI.toast(\'💎 Gold rush in \'+t.name+\'!\',\'success\');}else{UI.toast(\'No town\',\'error\');}})()" style="margin:2px; padding:3px 8px; background:#8b8000; color:#fff; border:1px solid #dd0; cursor:pointer;">💎 Gold Rush</button> ';
        html += '<button onclick="(function(){var t=Engine.getTowns().find(function(t){return t.id===Player.state.townId}); if(t&&t.market&&t.market.supply){for(var r in t.market.supply){t.market.supply[r]=Math.floor((t.market.supply[r]||0)*2);} UI.toast(\'📈 Trade boom in \'+t.name+\'!\',\'success\');}else{UI.toast(\'No town\',\'error\');}})()" style="margin:2px; padding:3px 8px; background:#006400; color:#fff; border:1px solid #0a0; cursor:pointer;">📈 Trade Boom</button> ';
        html += '<button onclick="(function(){var t=Engine.getTowns().find(function(t){return t.id===Player.state.townId}); if(t){t.gold=Math.max(0,(t.gold||0)-500); t.safety=Math.max(0,(t.safety||50)-30); UI.toast(\'🏴‍☠️ Bandit raid on \'+t.name+\'!\',\'warning\');}else{UI.toast(\'No town\',\'error\');}})()" style="margin:2px; padding:3px 8px; background:#4a0000; color:#fff; border:1px solid #a00; cursor:pointer;">🏴‍☠️ Bandit Raid</button> ';
        html += '<button onclick="(function(){var ks=Engine.getKingdoms(); var pk=ks.find(function(k){var t=Engine.getTowns().find(function(tt){return tt.id===Player.state.townId}); return t && k.id===t.kingdomId;}); if(pk && pk.kingId){var king=Engine.getPeople().find(function(p){return p.id===pk.kingId;}); if(king){king.alive=false; king._deathDay=Engine.getDay(); UI.toast(\'💀 King \'+king.firstName+\' is dead! Succession crisis!\',\'warning\');}else{UI.toast(\'King not found\',\'error\');}}else{UI.toast(\'No kingdom\',\'error\');}})()" style="margin:2px; padding:3px 8px; background:#5a0000; color:#fff; border:1px solid #f44; cursor:pointer;">👑💀 Kill King</button> ';
        html += '<button onclick="(function(){var people=Engine.getPeople().filter(function(p){return p.alive && p.townId===Player.state.townId}); var killCount=Math.max(1,Math.floor(people.length*0.1)); for(var i=0;i<killCount;i++){var victim=people[Math.floor(Math.random()*people.length)]; if(victim){victim.alive=false; victim._deathDay=Engine.getDay();}} UI.toast(\'☠️ Plague! \'+killCount+\' dead in town\',\'warning\');})()" style="margin:2px; padding:3px 8px; background:#2a004a; color:#fff; border:1px solid #80f; cursor:pointer;">☠️ Plague</button> ';
        html += '<button onclick="Engine.godMakeWorldWar(); UI.toast(\'⚔️ WORLD WAR! All kingdoms at war!\',\'warning\');" style="margin:2px; padding:3px 8px; background:#8b0000; color:#fff; border:1px solid #f00; cursor:pointer;">⚔️ World War</button> ';
        html += '<button onclick="Engine.godMakeWorldPeace(); UI.toast(\'☮️ World peace declared!\',\'success\');" style="margin:2px; padding:3px 8px; background:#005050; color:#fff; border:1px solid #0aa; cursor:pointer;">☮️ World Peace</button> ';
        html += '</div>';

        // === MARKET OVERVIEW ===
        html += '<div style="margin-bottom:12px; padding:8px; background:#2a2a3e; border-radius:4px;">';
        html += '<div style="color:#FFD700; font-weight:bold; margin-bottom:6px; cursor:pointer;" onclick="window._gmShowMarket=!window._gmShowMarket">📊 MARKET OVERVIEW ' + (window._gmShowMarket ? '▼' : '▶') + '</div>';
        if (window._gmShowMarket) {
            try {
                var mktTowns = Engine.getTowns();
                var resources = [];
                if (typeof RESOURCE_TYPES !== 'undefined') { for (var rk in RESOURCE_TYPES) { resources.push(RESOURCE_TYPES[rk]); } }
                var bestProfit = 0, bestRoute = '';
                for (var ri = 0; ri < resources.length; ri++) {
                    var res = resources[ri];
                    var cheapest = null, cheapPrice = Infinity, expensive = null, expPrice = 0;
                    for (var ti = 0; ti < mktTowns.length; ti++) {
                        var tp = (mktTowns[ti].market && mktTowns[ti].market.prices ? mktTowns[ti].market.prices[res.id] : null) || res.basePrice;
                        if (tp < cheapPrice) { cheapPrice = tp; cheapest = mktTowns[ti]; }
                        if (tp > expPrice) { expPrice = tp; expensive = mktTowns[ti]; }
                    }
                    var profit = expPrice - cheapPrice;
                    if (profit > bestProfit && cheapest && expensive && cheapest.id !== expensive.id) {
                        bestProfit = profit;
                        bestRoute = '🏆 Best: Buy ' + res.name + ' at ' + cheapest.name + ' (' + cheapPrice.toFixed(1) + 'g) → Sell at ' + expensive.name + ' (' + expPrice.toFixed(1) + 'g) = +' + profit.toFixed(1) + 'g/unit';
                    }
                }
                if (bestRoute) html += '<div style="color:#0f0; margin-bottom:6px; font-size:11px;">' + bestRoute + '</div>';
                html += '<div style="max-height:300px; overflow:auto;">';
                html += '<table style="font-size:10px; border-collapse:collapse; width:100%;">';
                html += '<tr><th style="padding:2px 4px; border:1px solid #555; color:#FFD700; position:sticky; top:0; background:#2a2a3e;">Resource</th>';
                for (var ti = 0; ti < mktTowns.length; ti++) {
                    html += '<th style="padding:2px 3px; border:1px solid #555; color:#aaa; position:sticky; top:0; background:#2a2a3e; writing-mode:vertical-lr; max-width:20px;">' + mktTowns[ti].name.substr(0,8) + '</th>';
                }
                html += '</tr>';
                for (var ri = 0; ri < resources.length; ri++) {
                    var res = resources[ri];
                    var prices = [];
                    for (var ti = 0; ti < mktTowns.length; ti++) {
                        prices.push((mktTowns[ti].market && mktTowns[ti].market.prices ? mktTowns[ti].market.prices[res.id] : null) || res.basePrice);
                    }
                    var minP = Math.min.apply(null, prices);
                    var maxP = Math.max.apply(null, prices);
                    var range = maxP - minP || 1;
                    html += '<tr><td style="padding:2px 4px; border:1px solid #444; color:#ddd; white-space:nowrap;">' + (res.icon || '') + res.name + '</td>';
                    for (var ti = 0; ti < mktTowns.length; ti++) {
                        var p = prices[ti];
                        var ratio = (p - minP) / range;
                        var r = Math.floor(ratio * 255);
                        var g = Math.floor((1 - ratio) * 255);
                        var color = 'rgb(' + r + ',' + g + ',0)';
                        html += '<td style="padding:1px 2px; border:1px solid #333; color:' + color + '; text-align:center; font-size:9px;">' + p.toFixed(0) + '</td>';
                    }
                    html += '</tr>';
                }
                html += '</table></div>';
            } catch(e) { html += '<div style="color:#f44;">Error: ' + e.message + '</div>'; }
        }
        html += '</div>';

        // === MILITARY STRENGTH ===
        html += '<div style="margin-bottom:12px; padding:8px; background:#2a2a3e; border-radius:4px;">';
        html += '<div style="color:#FFD700; font-weight:bold; margin-bottom:6px; cursor:pointer;" onclick="window._gmShowMilitary=!window._gmShowMilitary">⚔️ MILITARY STRENGTH ' + (window._gmShowMilitary ? '▼' : '▶') + '</div>';
        if (window._gmShowMilitary) {
            try {
                var milKingdoms = Engine.getKingdoms();
                var milTowns = Engine.getTowns();
                for (var ki = 0; ki < milKingdoms.length; ki++) {
                    var kk = milKingdoms[ki];
                    var kTowns = milTowns.filter(function(t) { return t.kingdomId === kk.id; });
                    var totalTroops = 0, totalGarrison = 0;
                    for (var ti = 0; ti < kTowns.length; ti++) {
                        totalTroops += (kTowns[ti].troops || 0);
                        totalGarrison += (kTowns[ti].garrison || 0);
                    }
                    var atWar = kk.atWar && kk.atWar.size > 0;
                    var warText = atWar ? ' ⚔️ AT WAR' : '';
                    var barWidth = Math.min(100, totalTroops / 5);
                    html += '<div style="margin:3px 0; padding:3px; background:#1e1e2e; border-radius:3px; border-left:2px solid ' + (atWar ? '#f44' : '#4a4') + ';">';
                    html += '<b style="color:' + (kk.color || '#fff') + ';">' + kk.name + '</b>' + warText;
                    html += '<br>🗡️ Troops: <b>' + totalTroops + '</b> | 🏰 Garrison: <b>' + totalGarrison + '</b> | 💰 Treasury: ' + Math.floor(kk.gold || 0).toLocaleString() + 'g';
                    html += '<div style="background:#333; height:6px; border-radius:3px; margin-top:2px;"><div style="background:' + (atWar ? '#f44' : '#4a8') + '; height:6px; border-radius:3px; width:' + barWidth + 'px;"></div></div>';
                    kTowns.sort(function(a, b) { return (b.troops || 0) - (a.troops || 0); });
                    for (var ti = 0; ti < Math.min(kTowns.length, 5); ti++) {
                        var tt = kTowns[ti];
                        if ((tt.troops || 0) > 0 || (tt.garrison || 0) > 0) {
                            html += '<div style="margin-left:10px; font-size:10px; color:#aaa;">📍' + tt.name + ': 🗡️' + (tt.troops || 0) + ' 🏰' + (tt.garrison || 0) + '</div>';
                        }
                    }
                    html += '</div>';
                }
            } catch(e) { html += '<div style="color:#f44;">Error: ' + e.message + '</div>'; }
        }
        html += '</div>';

        // === FAMILY & DYNASTY ===
        html += '<div style="margin-bottom:12px; padding:8px; background:#2a2a3e; border-radius:4px;">';
        html += '<div style="color:#FFD700; font-weight:bold; margin-bottom:6px;">👶 FAMILY & DYNASTY</div>';
        html += '<input id="gm-set-sp" type="number" value="10" style="width:50px; background:#333; color:#fff; border:1px solid #666; padding:2px 4px; margin:2px;" />';
        html += '<button onclick="var v=parseInt(document.getElementById(\'gm-set-sp\').value)||10; Player.state.skillPoints=(Player.state.skillPoints||0)+v; UI.toast(\'🧠 +\'+v+\' Skill Points (now \'+Player.state.skillPoints+\')\',\'success\')" style="margin:2px; padding:3px 8px; background:#16305d; color:#fff; border:1px solid #48a; cursor:pointer;">+SP</button> ';
        html += '<button onclick="(function(){var p=Player.state; var spouse=Engine.getPeople().find(function(pp){return pp.id===p.spouseId}); if(!spouse){UI.toast(\'❌ Need a spouse first!\',\'error\'); return;} var sex=Math.random()>0.5?\'M\':\'F\'; var nms=typeof NAMES!==\'undefined\'?NAMES:null; var nameList=nms?(sex===\'M\'?nms.male:nms.female):[\'Child\']; var baby={id:\'p_god_\'+Date.now(), firstName:nameList[Math.floor(Math.random()*nameList.length)], lastName:p.lastName||\'Unknown\', age:0, sex:sex, alive:true, townId:p.townId, kingdomId:p.citizenshipKingdomId||\'k1\', occupation:\'none\', employerId:null, gold:0, spouseId:null, childrenIds:[], parentIds:[p.id||\'player\', spouse.id], skills:{farming:0,mining:0,crafting:0,trading:0,combat:0}, personality:{loyalty:50,ambition:50,frugality:50,intelligence:50,warmth:50,honesty:50}, needs:{food:70,shelter:70,safety:70,wealth:50,happiness:60}, quirks:[], wealthClass:\'lower\', houseType:null, workerSkill:10}; Engine.addPerson(baby); if(!p.childrenIds)p.childrenIds=[]; p.childrenIds.push(baby.id); if(!spouse.childrenIds)spouse.childrenIds=[]; spouse.childrenIds.push(baby.id); UI.toast(\'👶 Baby \'+baby.firstName+\' born! (\'+sex+\')\',\'success\');})()" style="margin:2px; padding:3px 8px; background:#5d1630; color:#fff; border:1px solid #a48; cursor:pointer;">👶 Have Baby</button> ';
        html += '<button onclick="(function(){var p=Player.state; if(!p.childrenIds||p.childrenIds.length===0){UI.toast(\'No children\',\'error\'); return;} var aged=0; for(var i=0;i<p.childrenIds.length;i++){var kid=Engine.getPeople().find(function(pp){return pp.id===p.childrenIds[i]}); if(kid&&kid.alive&&kid.age<18){kid.age=18; if(kid.occupation===\'none\'||!kid.occupation){kid.occupation=\'merchant\'; kid.skills={farming:10,mining:10,crafting:10,trading:20,combat:10}; kid.gold=(kid.gold||0)+30;} aged++;}} UI.toast(\'🎂 Aged \'+aged+\' children to 18!\',\'success\');})()" style="margin:2px; padding:3px 8px; background:#2d5016; color:#fff; border:1px solid #4a8; cursor:pointer;">🎂 Age Kids→18</button> ';
        html += '<button onclick="(function(){var p=Player.state; if(!p.childrenIds||p.childrenIds.length===0){UI.toast(\'No children\',\'error\'); return;} var aged=0; for(var i=0;i<p.childrenIds.length;i++){var kid=Engine.getPeople().find(function(pp){return pp.id===p.childrenIds[i]}); if(kid&&kid.alive&&kid.age<17){kid.age=17; kid._almostAdult=true; aged++;}} UI.toast(\'🎂 Aged \'+aged+\' children to 17\',\'success\');})()" style="margin:2px; padding:3px 8px; background:#4d5016; color:#fff; border:1px solid #8a8; cursor:pointer;">🎂 Age Kids→17</button> ';
        html += '<br><button onclick="if(confirm(\'Kill your character? This will trigger inheritance/dynasty.\')){Player.handlePlayerDeath ? Player.handlePlayerDeath() : (function(){Player.state.alive=false; Player.state.health=0;})(); UI.toast(\'💀 You died. Checking inheritance...\',\'warning\');}" style="margin:2px; padding:3px 8px; background:#8b0000; color:#fff; border:1px solid #f44; cursor:pointer;">💀 Suicide (Test Inheritance)</button> ';
        try {
            var fp = Player.state;
            html += '<div style="margin-top:6px; font-size:11px; color:#aaa;">';
            html += '<b>Family:</b>';
            if (fp.spouseId) {
                var fsp = Engine.getPeople().find(function(pp){return pp.id===fp.spouseId});
                html += '<br>💒 Spouse: ' + (fsp ? fsp.firstName + ' ' + fsp.lastName + ' (Age:' + fsp.age + ')' : 'ID:' + fp.spouseId);
            } else { html += '<br>💒 Spouse: None'; }
            if (fp.childrenIds && fp.childrenIds.length > 0) {
                for (var ci = 0; ci < fp.childrenIds.length; ci++) {
                    var kid = Engine.getPeople().find(function(pp){return pp.id===fp.childrenIds[ci]});
                    if (kid) {
                        html += '<br>' + (kid.alive ? '👶' : '💀') + ' ' + kid.firstName + ' ' + kid.lastName + ' (' + kid.sex + ', Age:' + kid.age + (kid.alive ? '' : ' DEAD') + ')';
                    }
                }
            } else { html += '<br>👶 Children: None'; }
            html += '</div>';
        } catch(e) {}
        html += '</div>';

        return html;
    }

    return {
        init,
        update,
        showGameUI,
        hideGameUI,
        toast,
        showTooltip,
        hideTooltip,
        showContextMenu,
        hideContextMenu,
        showTownDetail,
        showKingdomDetail,
        openKingdomLawsPanel,
        openKingActionLog,
        openProsperityBreakdown,
        openLawComparisonPanel,
        openRoyalCommissionsPanel,
        fulfillCommissionUI,
        openConscriptionDialog,
        respondConscription,
        openJailDialog,
        fastForwardJailUI,
        openSuccessionCrisisDialog,
        backPretenderUI,
        showPersonDetail,
        showRoadDetail,
        showWinScreen,
        showLoseScreen,
        closeModal,
        openModal,
        closeRightPanel,
        openTradeDialog,
        openBuildDialog,
        openHireDialog,
        openCaravanDialog,
        openCharacterDialog,
        openEventLog,
        showEventDetail,
        clearEventLog,
        toggleNotifFilter,
        openSettings,
        setNotifFilter,
        openMapView,
        closeMapView,
        locatePlayer,
        eatUntilFull,
        drinkUntilFull,
        executeBuy,
        executeSell,
        setTradeQty,
        quickBuy,
        quickSell,
        executeBuild,
        filterBuildings,
        buyLicense,
        openBuildingManagement,
        showBuildingDetail,
        supplyBuildingUI,
        collectOutputUI,
        stockRetailUI,
        unstockRetailUI,
        collectRetailRevenueUI,
        toggleAutoBuyUI,
        setTransferTarget: setTransferTargetUI,
        clearTransfer: clearTransferUI,
        assignWorkerUI,
        removeWorkerUI,
        upgradeBuildingUI,
        toggleGuard,
        buyLockedStorage,
        racketResponse,
        switchHireTab,
        hirePerson,
        fireWorker,
        showAssignDialog,
        executeAssign,
        filterWorkerList,
        executeSendCaravan,
        travelTo,
        travelBySea: travelBySeaUI,
        openTravelOptions,
        confirmTravel,
        getTransportServices,
        turnBackUI,
        _enlistForCitizenship,
        _smuggleBorder,
        showRequisitionDialog,
        _resistRequisition,
        showExclusiveCitizenshipDialog,
        showHorsePermitViolationDialog,
        _chooseExclusiveCitizenship,
        buyShip: buyShipUI,
        showShipAddons: showShipAddons,
        installShipAddon: installShipAddonUI,
        clickTown,
        proposeMarriage,
        goOnDate,
        spendTimeWithSpouse,
        hireInvestigator,
        askTavernAbout,
        observePerson,
        showRegencyScreen,
        buyWeapon,
        buyArmor,
        unequipWeapon: unequipWeaponUI,
        unequipArmor: unequipArmorUI,
        // New features
        openKingdomsDialog,
        petitionPromotion,
        changeCitizenship,
        openGiftDialog,
        executeGift,
        // XP, Skills, Achievements
        openSkillsDialog,
        openAchievementsDialog,
        learnSkill,
        buyInfoBrokerTip,
        // Kingdom/Town Selection
        showKingdomSelection,
        regenerateWorld,
        backToMainMenu,
        selectKingdom,
        selectTown,
        randomTown,
        // Game Start UI
        showStartScenarioSelection,
        selectStartScenario,
        selectMilitaryKingdom,
        confirmStartScenario,
        backToTownSelection,
        // Family Panel
        openFamilyPanel,
        familyAction,
        // Special Start
        openSpecialStartPanel,
        openStartJournal,
        specialAction,
        // Leaderboard
        openLeaderboard,
        respondToMarriageProposal: respondToMarriageProposalUI,
        // War Allegiance
        showWarAllegiancePopup,
        chooseWarAllegiance,
        // Bankruptcy
        showBankruptcyDialog,
        handleBankruptcyChoice,
        showSpyFavorDialog,
        handleSpyFavor,
        showTournamentContinueDialog,
        handleTournamentContinue,
        handleTournamentForfeit,
        // Customs Inspector
        showCustomsChoiceDialog,
        handleCustomsChoice,
        // Auto-Travel Jobs
        quitAutoTravelJob,
        // Local Work & Street Trading
        openWorkDialog,
        executeWork,
        enlistAsSoldier,
        quitMilitary,
        // Health / Medical
        openHealthDialog,
        treatAtHospital,
        selfTreatCondition,
        // Teach Child
        openTeachChildDialog,
        executeTeachChild,
        openStreetTrading,
        executeStreetTrade: executeStreetTradeUI,
        chatWithNPC,
        // Dark Deeds / Schemes
        openSchemesDialog,
        switchSchemesTab,
        executeScheme,
        executeStealGoods,
        executeCounterfeit,
        executeTargetAction,
        executeBribeGuards,
        executeBribeAdvisor,
        // Help
        openHelpDialog,
        openIconsGlossary,
        openGameGuide,
        // Crown & Succession
        openAdviseKingDialog,
        executeAdvice,
        showKingSuccessionPopup,
        // Degradation & Repair
        repairBuilding: repairBuildingUI,
        repairShip: repairShipUI,
        // Resource Depletion, Food/Fashion Trends, Warehouse Tiers
        toggleFarmFallow,
        openWarehouseSecurityDialog,
        installWarehouseSecurity,
        askTavernFoodTrends,
        askTavernFashionTrends,
        // Inventory Capacity System
        buyContainer: buyContainerUI,
        setBuildingProductUI,
        purchaseNPCBuildingUI,
        sellHorse,
        depositToStorage: depositToStorageUI,
        withdrawFromStorage: withdrawFromStorageUI,
        // Passenger Transport
        setupTransportUI,
        useNPCTransportUI,
        // NPC Interaction
        talkToPerson,
        usePerk,
        dateAction,
        proposeTo,
        stealFromPerson,
        spreadRumorsAbout,
        blackmailPerson,
        hireAssassinFor,
        poisonPerson,
        framePerson,
        showTownPeople,
        filterTownPeople,
        // Toll Routes
        showTollRoutesPanel,
        changeTollRate,
        collectTolls: collectTollsUI,
        showBuildRouteSelector,
        buildTollRoad,
        buildSeaRoute,
        petitionKingForRoad,
        // Free-form travel: forage & bridges
        forageNearby,
        rebuildBridge,
        destroyBridge,
        // Petitions
        showPetitionsPanel,
        showCreatePetitionPanel,
        selectPetitionType,
        confirmCreatePetition,
        confirmCreatePetitionTownPair,
        showPetitionDetail,
        askNPCToSign,
        hirePetitionerUI,
        firePetitionerUI,
        submitPetitionUI,
        cancelPetitionUI,
        // War Conflict Choice & Multi-Kingdom
        showWarConflictChoice,
        resolveWarConflict,
        renounceKingdomUI,
        showRankProgressionPanel,
        // Kingdom Trade
        showKingdomTradePanel,
        sellToKingdomUI,
        // Kingdom Orders & Procurement
        showKingdomOrdersPanel,
        switchOrdersTab,
        showBidModal,
        submitBid,
        showDeliverOrderModal,
        executeDeliverOrder,
        showNegotiateDealPanel,
        submitDealProposal,
        deliverSupplyDealUI,
        executeDeliverDeal,
        cancelSupplyDealUI,
        // Housing & Rest
        openHousingDialog,
        buyHouseUI,
        sellHouseUI,
        upgradeHouseUI,
        doUpgradeHouse,
        setPrimaryHouseUI,
        rentOutHouseUI,
        buyLandUI,
        sellLandUI,
        openRestDialog,
        restUI,
        drawWaterUI,
        restAtHomeUI,
        restAtInnUI,
        sleepOutsideUI,
        hireEscortUI,
        // Talk to Townsfolk
        talkToTownsfolk,
        // Outpost Management
        openOutpostDialog,
        foundOutpostUI,
        outpostStaffUI,
        // Conquest & Servitude
        showConquestDialog,
        buyFreedomUI,
        attemptIndenturedEscape,
        completeMasterTask,
        dismissMasterTask,
        payDebt,
        showHeirSelectionUI,
        confirmHeirSelection,
        openSpousePanel,
        spouseInteraction,
        checkConquestEvents,

        // Free Travel & Travel HUD
        confirmFreeTravel,
        updateTravelPanel,
        openTravelRest,
        startTravelRest,

        // God Mode
        openGodModePanel,
        closeGodModePanel,
        buildGodModeHTML,
    };
})();
