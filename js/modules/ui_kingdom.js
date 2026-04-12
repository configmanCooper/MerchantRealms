// ============================================================
// Merchant Realms — UI Kingdom Module (extracted from ui.js)
// Extends window.UI with Kingdom & Town Selection functions
// ============================================================
(function(UI) {
    "use strict";
    if (!UI) throw new Error("UI must be loaded before ui_kingdom.js");

    // Aliases for UI utilities
    var openModal = UI.openModal;
    var closeModal = UI.closeModal;
    var toast = UI.toast;
    var formatGold = UI.formatGold;
    var escapeHtml = UI.escapeHtml;
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
                bannedHtml = '<div class="kingdom-detail-row" style="cursor:help;" title="Banned items are illegal to make or sell, but legal to buy or own in small amounts."><span class="detail-label">🚫 Banned:</span> ' + k.laws.bannedGoods.join(', ') + '</div>';
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
            html += '<button class="btn-medieval btn-kingdom-select" data-action="selectKingdom" data-id="' + k.id + '">Select Kingdom</button>';
            html += '</div>';
        }

        html += '</div>';
        html += '<div style="text-align:center;margin-top:18px;">';
        html += '<button class="btn-medieval" data-action="regenerateWorld" style="background:linear-gradient(135deg,#5a3a1a,#7a4a2a);font-size:1.1em;padding:10px 28px;">🔄 Regenerate World</button>';
        html += ' <button class="btn-medieval" data-action="backToMainMenu" style="background:linear-gradient(135deg,#4a2a1a,#6a3a2a);font-size:1.1em;padding:10px 28px;">🏠 Back to Main Menu</button>';
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
        if (UI._clearBankruptcyLock) UI._clearBankruptcyLock(); // Clear lock when returning to main menu
        var closeBtn = document.getElementById('btnCloseModal');
        if (closeBtn) closeBtn.style.display = ''; // Restore close button
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
        html += '<button class="btn-medieval btn-back" data-action="backToKingdomSelect">← Back to Kingdoms</button>';
        html += '<button class="btn-medieval btn-random-town" data-action="randomTown" data-id="' + kingdomId + '">🎲 Random Town</button>';
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
            html += '<button class="btn-medieval btn-town-select" data-action="selectTown" data-id="' + town.id + '">Start Here</button>';
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
        html += '<button class="btn-medieval btn-back" data-action="backToTownSelection">← Back to Towns</button>';
        html += '</div>';
        html += '<div class="start-scenario-grid">';

        for (let i = 0; i < starts.length; i++) {
            const s = starts[i];
            const isUnique = s.difficulty === 'Unique';
            html += '<div class="start-scenario-card" data-start-id="' + s.id + '" data-action="selectStartScenario" data-id="' + s.id + '" style="border-color:' + s.color + '">';
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
                    optHtml += '<button class="btn-medieval" style="margin:4px;background:' + k.color + '" data-action="selectMilitaryKingdom" data-id="' + k.id + '">' + k.name + ' (at war)</button>';
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
                btnDiv.innerHTML = '<button id="btnConfirmStart" class="btn-medieval" style="font-size:1.3em;padding:12px 36px;background:linear-gradient(135deg,#8B6914,#DAA520);border:2px solid #FFD700;" data-action="confirmStartScenario">⚔️ Begin Your Journey ⚔️</button>';
                content.appendChild(btnDiv);
            }
        }
    }

    function selectMilitaryKingdom(kingdomId) {
        window._selectedMilitaryKingdomId = kingdomId;
        var btns = document.querySelectorAll('#militaryKingdomOptions button');
        for (var i = 0; i < btns.length; i++) {
            btns[i].style.border = '';
            if (btns[i].dataset && btns[i].dataset.id === kingdomId) {
                btns[i].style.border = '3px solid #FFD700';
            }
        }
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
                html += '<span><a href="#" style="color:var(--gold);text-decoration:underline;cursor:pointer;" data-action="showPersonLink" data-id="' + m.npcId + '">' + roleIcon + ' ' + m.name + '</a></span>';
                html += '<span class="family-role-badge">' + roleLabel + '</span>';
                html += '</div>';
                html += '<div class="family-member-body">';
                html += '<div>Age: ' + (person.age || '?') + ' | ' + (person.occupation || 'unemployed') + '</div>';
                html += '<div>💰 ' + formatGold(person.gold || 0) + 'g | 📍 ' + locationName + (sameLocation ? ' <span style="color:#5f5;font-size:0.7rem;">(Here)</span>' : '') + '</div>';
                html += '<div>❤️ Relationship: ' + Math.round(rel) + '/100</div>';

                // Show equipment, horse, and instrument status
                var _eqParts = [];
                if (person.weapon) _eqParts.push('⚔️ ' + (typeof person.weapon === 'object' ? person.weapon.name : 'Armed'));
                if (person.armor) _eqParts.push('🛡️ ' + (typeof person.armor === 'object' ? person.armor.name : 'Armored'));
                if (person.horse) _eqParts.push('🐴 Horse');
                if (person._familyInstruments) {
                    for (var _iKey in person._familyInstruments) {
                        if (person._familyInstruments[_iKey]) {
                            var _iSkill = (person._familyInstrumentSkill && person._familyInstrumentSkill[_iKey]) || 0;
                            var _iTier = _iSkill >= 76 ? 'Master' : _iSkill >= 51 ? 'Expert' : _iSkill >= 26 ? 'Competent' : 'Novice';
                            _eqParts.push('🎵 ' + _iKey.charAt(0).toUpperCase() + _iKey.slice(1).replace('_', '-') + ' (' + _iTier + ')');
                        }
                    }
                }
                if (_eqParts.length > 0) {
                    html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">' + _eqParts.join(' • ') + '</div>';
                }
                // Health status
                if (person.injured || person.sick) {
                    var _hParts = [];
                    if (person.injured) _hParts.push('🩹 ' + (person.injurySeverity || 'injured'));
                    if (person.sick) _hParts.push('🤒 ' + (person.illness || 'sick'));
                    if (person._illnessTreatPaid) _hParts.push('🏥 Being treated');
                    html += '<div style="font-size:0.75rem;color:#e67e22;margin-top:2px;">' + _hParts.join(' • ') + '</div>';
                    // Treatment buttons for sick/injured family
                    if (person.townId === Player.townId && !Player.traveling) {
                        html += '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">';
                        var _fmHasDoc = Player.hasSkill && (Player.hasSkill('field_medic') || Player.hasSkill('doctor'));
                        if (_fmHasDoc) {
                            html += '<button class="btn-action btn-small" style="background:rgba(40,120,40,0.4);" data-action="treatCompanionUI" data-type="family" data-id="' + m.npcId + '" data-val="player">⚕️ Treat</button>';
                        }
                        html += '<button class="btn-action btn-small" style="background:rgba(40,80,160,0.4);" data-action="treatCompanionUI" data-type="family" data-id="' + m.npcId + '" data-val="hospital">🏥 Hospital</button>';
                        html += '</div>';
                    }
                }

                html += '<div class="family-actions" style="margin-top:6px;">';
                html += '<button class="btn-action btn-small" data-action="familyAction" data-type="money" data-id="' + m.npcId + '">💰 Ask Money</button>';
                html += '<button class="btn-action btn-small" data-action="familyAction" data-type="work" data-id="' + m.npcId + '">🔨 Ask Work</button>';
                html += '<button class="btn-action btn-small" data-action="familyAction" data-type="teach" data-id="' + m.npcId + '">📖 Teach</button>';
                html += '<button class="btn-action btn-small" data-action="familyAction" data-type="connections" data-id="' + m.npcId + '">🤝 Connections</button>';
                html += '<button class="btn-action btn-small" data-action="familyAction" data-type="gift" data-id="' + m.npcId + '">🎁 Gift</button>';
                html += '<button class="btn-action btn-small" data-action="giveFamilyGoldDialog" data-id="' + m.npcId + '" data-val="' + m.name.replace(/'/g, "\\'") + '">💰 Give Gold</button>';
                html += '<button class="btn-action btn-small" data-action="giveFamilyItemDialog" data-id="' + m.npcId + '" data-val="' + m.name.replace(/'/g, "\\'") + '">📦 Give Item</button>';
                html += '<button class="btn-action btn-small" data-action="familyAction" data-type="invite" data-id="' + m.npcId + '">🏠 Invite</button>';
                html += '<button class="btn-action btn-small" data-action="familyAction" data-type="confide" data-id="' + m.npcId + '">💬 Confide</button>';
                if (m.role === 'brother' || m.role === 'sister') {
                    html += '<button class="btn-action btn-small" data-action="familyAction" data-type="business" data-id="' + m.npcId + '">🏪 Business</button>';
                }
                if (m.role === 'spouse' || m.npcId === Player.spouseId) {
                    html += '<button class="btn-action btn-small" style="background:#5a2a5a;" data-action="openSpousePanel">💍 Spouse Panel</button>';
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
                if (dperson && !isSynthetic) {
                    html += '<span style="color:#999;"><a href="#" style="color:#999;text-decoration:underline;cursor:pointer;" data-action="showPersonLink" data-id="' + dm.npcId + '">' + roleIcon + ' ' + dm.name + '</a></span>';
                } else {
                    html += '<span style="color:#999;">' + roleIcon + ' ' + dm.name + '</span>';
                }
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
        html += '<button class="btn-action btn-small" data-action="familyAction" data-type="dinner">🍽️ Family Dinner</button>';
        html += '<button class="btn-action btn-small" data-action="familyAction" data-type="celebration">🎉 Celebration</button>';
        html += '<button class="btn-action btn-small" data-action="familyAction" data-type="advice">💡 Ask Advice</button>';
        html += '<button class="btn-action btn-small" data-action="familyAction" data-type="caretake">🏡 Caretake</button>';
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
                    html += '<button class="btn-action btn-small" data-action="respondToMarriageProposal" data-id="' + pr.id + '" data-val="true">✅ Accept</button> ';
                    html += '<button class="btn-action btn-small" style="background:rgba(200,60,50,0.3);" data-action="respondToMarriageProposal" data-id="' + pr.id + '" data-val="false">❌ Reject</button>';
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
                        html += '<button class="btn-action btn-small" data-action="arrangeChildMarriage" data-id="' + eligibleChildren[ci] + '" data-idx="' + ci + '">💒 Arrange</button>';
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

    function giveFamilyGoldDialog(npcId, name) {
        var html = '<div style="text-align:center;padding:10px;">';
        html += '<p style="color:var(--parchment);margin-bottom:12px;">How much gold to give <strong>' + name + '</strong>?</p>';
        html += '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px;">Your gold: ' + formatGold(Player.gold) + 'g</p>';
        html += '<div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin-bottom:12px;">';
        var amounts = [10, 25, 50, 100, 250, 500];
        for (var i = 0; i < amounts.length; i++) {
            var amt = amounts[i];
            var disabled = Player.gold < amt ? ' disabled style="opacity:0.4;padding:4px 10px;font-size:0.8rem;"' : ' style="padding:4px 10px;font-size:0.8rem;"';
            html += '<button class="btn-medieval"' + disabled + ' data-action="giveFamilyGoldPreset" data-id="' + npcId + '" data-val="' + amt + '">' + amt + 'g</button>';
        }
        html += '</div>';
        html += '<div style="display:flex;justify-content:center;gap:6px;align-items:center;">';
        html += '<input type="number" id="familyGoldCustom" min="1" max="' + Player.gold + '" placeholder="Custom amount" style="width:120px;padding:4px;font-size:0.85rem;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:4px;">';
        html += '<button class="btn-medieval" style="padding:4px 10px;font-size:0.8rem;" data-action="giveFamilyGoldCustom" data-id="' + npcId + '">Give</button>';
        html += '</div></div>';
        openModal('💰 Give Gold to ' + name, html);
    }

    function giveFamilyItemDialog(npcId, name) {
        var html = '<div style="max-height:400px;overflow-y:auto;padding:6px;">';
        html += '<p style="color:var(--parchment);margin-bottom:10px;">Select an item to give <strong>' + name + '</strong>:</p>';
        var inv = Player.inventory || {};
        var hasItems = false;
        // Group by category
        var categories = { military: '⚔️ Military', luxury: '✨ Luxury', food: '🍞 Food', materials: '🪵 Materials', medical: '🏥 Medical', other: '📦 Other' };
        var grouped = {};
        for (var resId in inv) {
            if (!inv[resId] || inv[resId] <= 0) continue;
            hasItems = true;
            var resDef = null;
            var _resKey = resId.toUpperCase();
            if (typeof RESOURCE_TYPES !== 'undefined' && RESOURCE_TYPES[_resKey]) resDef = RESOURCE_TYPES[_resKey];
            if (!resDef && typeof RESOURCE_TYPES !== 'undefined') { for (var _rk in RESOURCE_TYPES) { if (RESOURCE_TYPES[_rk].id === resId) { resDef = RESOURCE_TYPES[_rk]; break; } } }
            var cat = (resDef && resDef.category) || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ id: resId, name: resDef ? resDef.name : resId, icon: resDef ? (resDef.icon || '') : '', qty: inv[resId] });
        }
        if (!hasItems) {
            html += '<p style="color:#888;">No items in your inventory.</p>';
        } else {
            for (var cat in grouped) {
                var catLabel = categories[cat] || categories.other;
                html += '<div style="margin-bottom:8px;">';
                html += '<div style="font-size:0.8rem;font-weight:bold;color:var(--gold);margin-bottom:4px;">' + catLabel + '</div>';
                for (var gi = 0; gi < grouped[cat].length; gi++) {
                    var item = grouped[cat][gi];
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;margin-bottom:2px;background:rgba(255,255,255,0.03);border-radius:3px;">';
                    html += '<span style="font-size:0.82rem;">' + item.icon + ' ' + item.name + ' <span style="color:#888;">x' + item.qty + '</span></span>';
                    html += '<button class="btn-action btn-small" style="padding:2px 8px;font-size:0.75rem;" data-action="giveFamilyGift" data-id="' + npcId + '" data-val="' + item.id + '">Give 1</button>';
                    html += '</div>';
                }
                html += '</div>';
            }
        }
        html += '</div>';
        openModal('📦 Give Item to ' + name, html);
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

        // Pregnancy / Fertility indicator + Try for Baby button
        var babyInfo = Player.getTryForBabyChance ? Player.getTryForBabyChance() : { chance: 0 };
        html += '<div style="margin-top:8px;padding:6px 8px;border-radius:4px;font-size:12px;display:flex;justify-content:space-between;align-items:center;';
        if (status.isPregnant) {
            html += 'background:rgba(200,120,200,0.15);border:1px solid rgba(200,120,200,0.4);color:#d8a0d8;">';
            html += '<span>🤰 <strong>Pregnant!</strong> Due in ~' + status.pregnancyDaysLeft + ' days</span>';
        } else if (status.canConceive) {
            html += 'background:rgba(100,180,100,0.12);border:1px solid rgba(100,180,100,0.3);color:#8c8;">';
            html += '<span>🍀 <strong>Fertility:</strong> ' + status.fertilityReason + '</span>';
        } else {
            html += 'background:rgba(100,100,100,0.12);border:1px solid rgba(100,100,100,0.3);color:#888;">';
            html += '<span>🚫 <strong>Fertility:</strong> ' + status.fertilityReason + '</span>';
        }
        // Try for Baby button
        if (!status.isPregnant && status.canConceive && babyInfo.canTryToday) {
            html += '<button class="btn-medieval" data-action="tryForBaby" style="font-size:11px;padding:4px 10px;margin-left:8px;white-space:nowrap;">💕 Try for Baby (' + babyInfo.chance + '%)</button>';
        } else if (!status.isPregnant && status.canConceive && !babyInfo.canTryToday) {
            html += '<span style="font-size:11px;color:#886;margin-left:8px;white-space:nowrap;">⏳ Already tried today</span>';
        }
        html += '</div>';

        html += '</div>'; // end header card

        // === MEDICAL TREATMENT (when spouse is sick/injured/gravely ill) ===
        if (status.condition !== 'healthy') {
            var _spCondLabel = status.condition === 'gravely_ill' ? '☠️ Gravely Ill' : status.condition === 'sick' ? '🤒 Sick' : '🩹 Injured';
            var _spCondColor = status.condition === 'gravely_ill' ? '#f33' : status.condition === 'sick' ? '#e67e22' : '#d4a017';
            html += '<div style="background:rgba(200,60,60,0.12);border:1px solid rgba(200,60,60,0.3);border-radius:6px;padding:10px;margin-bottom:8px;">';
            html += '<div style="font-size:13px;font-weight:bold;color:' + _spCondColor + ';margin-bottom:6px;">' + _spCondLabel + ' — Needs Treatment!</div>';
            html += '<div style="font-size:11px;color:#ccc;margin-bottom:8px;">Health: ' + status.health + '/' + (CONFIG.SPOUSE_AI ? CONFIG.SPOUSE_AI.HEALTH_MAX : 100) + '</div>';
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
            // Player treatment button (needs skill)
            var _hasDocSkill = Player.hasSkill && (Player.hasSkill('field_medic') || Player.hasSkill('doctor'));
            var _inSameTown = Player.townId && !Player.traveling;
            if (_hasDocSkill && _inSameTown) {
                var _skillName = Player.hasSkill('doctor') ? 'Doctor' : 'Field Medic';
                if (status.condition === 'gravely_ill' && !Player.hasSkill('doctor')) {
                    html += '<button class="btn-medieval" disabled style="font-size:11px;padding:5px 10px;opacity:0.5;" title="Need Doctor skill for gravely ill">⚕️ Treat (Need Doctor Skill)</button>';
                } else {
                    html += '<button class="btn-medieval" data-action="treatSpousePlayer" style="font-size:11px;padding:5px 10px;background:rgba(40,120,40,0.3);border-color:rgba(60,180,60,0.5);">⚕️ Treat with ' + _skillName + ' Skill</button>';
                }
            } else if (!_hasDocSkill) {
                html += '<span style="font-size:11px;color:#888;">⚕️ Need Field Medic or Doctor skill to treat</span>';
            }
            // Hospital button
            var _townObj = null;
            try { _townObj = Engine.findTown(Player.townId); } catch(e) {}
            var _hasHospital = false;
            if (_townObj && _townObj.buildings) {
                for (var _hci = 0; _hci < _townObj.buildings.length; _hci++) {
                    if (_townObj.buildings[_hci].type === 'hospital' || _townObj.buildings[_hci].type === 'clinic') { _hasHospital = true; break; }
                }
            }
            if (_hasHospital && _inSameTown) {
                html += '<button class="btn-medieval" data-action="treatSpouseHospital" style="font-size:11px;padding:5px 10px;background:rgba(40,80,160,0.3);border-color:rgba(60,120,220,0.5);">🏥 Take to Hospital</button>';
            } else if (!_hasHospital && _inSameTown) {
                html += '<span style="font-size:11px;color:#888;">🏥 No hospital/clinic in town</span>';
            }
            html += '</div></div>';
        }

        // Wedding Planner notification
        if (Player.weddingPlan) {
            html += '<div style="padding:8px;margin-bottom:6px;border:1px solid rgba(200,180,60,0.4);border-radius:6px;background:rgba(200,180,60,0.08);text-align:center;">';
            html += '<strong>💒 Wedding Planning!</strong> You are planning your wedding to ' + Player.weddingPlan.fianceName + '.';
            html += '<br><button class="btn-medieval" data-action="openWeddingPlanner" style="font-size:12px;padding:6px 16px;margin-top:6px;">Open Wedding Planner</button>';
            html += '</div>';
        }

        // === INTERACTIONS ===
        html += '<h4 style="color:#d4af37;margin:10px 0 6px 0;font-size:0.85rem;">💬 Interactions</h4>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';

        // Relationship
        html += '<button class="btn-medieval" data-action="openTalkToSpouse" style="font-size:12px;padding:6px;">💬 Talk to Spouse</button>';
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="spend_time" style="font-size:12px;padding:6px;">💕 Spend Time Together</button>';
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="give_gold" style="font-size:12px;padding:6px;">🪙 Give Gold</button>';

        // Work/Economy
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="ask_work" style="font-size:12px;padding:6px;">💼 Ask to Work Jobs</button>';
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="ask_trade" style="font-size:12px;padding:6px;">📊 Ask to Trade</button>';
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="ask_money" style="font-size:12px;padding:6px;">💰 Ask for Money</button>';
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="ask_intel" style="font-size:12px;padding:6px;">🔍 Gather Market Intel</button>';

        // Management
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="ask_manage" style="font-size:12px;padding:6px;">🏭 Manage Building</button>';
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="ask_hire" style="font-size:12px;padding:6px;">👷 Hire Workers</button>';
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="ask_negotiate" style="font-size:12px;padding:6px;">🤝 Negotiate Deal</button>';

        // Movement
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="ask_stay" style="font-size:12px;padding:6px;">🏠 Stay in Town</button>';
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="ask_travel" style="font-size:12px;padding:6px;">🗺️ Travel to Town</button>';
        html += '<button class="btn-medieval" data-action="spouseInteraction" data-type="ask_caravan" style="font-size:12px;padding:6px;">🐪 Guard Caravan</button>';

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

    function tryForBaby() {
        if (!Player.tryForBaby) { toast('Not available.', 'warning'); return; }
        var result = Player.tryForBaby();
        if (result.blocked) {
            toast(result.message, 'warning');
        } else if (result.success) {
            toast(result.message, 'success');
        } else {
            toast(result.message, 'info');
        }
        // Refresh the spouse panel to update the button state
        openSpousePanel();
    }

    function spouseInteraction(action) {
        var result;
        switch (action) {
            case 'spend_time':
                result = Player.spouseSpendTime ? Player.spouseSpendTime() : { success: false, message: 'Not available.' };
                break;
            case 'give_gold':
                _showSpouseGoldPicker('give');
                return;
            case 'ask_work':
                result = Player.askSpouseToWork ? Player.askSpouseToWork() : { success: false, message: 'Not available.' };
                break;
            case 'ask_trade':
                _showSpouseTownPicker('trade');
                return;
            case 'ask_money':
                _showSpouseGoldPicker('ask');
                return;
            case 'ask_intel':
                result = Player.askSpouseToGatherIntel ? Player.askSpouseToGatherIntel() : { success: false, message: 'Not available.' };
                break;
            case 'ask_manage':
                _showSpouseBuildingPicker();
                return;
            case 'ask_hire':
                result = Player.askSpouseToHireWorkers ? Player.askSpouseToHireWorkers() : { success: false, message: 'Not available.' };
                break;
            case 'ask_negotiate':
                _showSpouseNegotiatePicker();
                return;
            case 'ask_stay':
                result = Player.askSpouseToStay ? Player.askSpouseToStay(Player.townId) : { success: false, message: 'Not available.' };
                break;
            case 'ask_travel':
                _showSpouseTownPicker('travel');
                return;
            case 'ask_caravan':
                _showSpouseCaravanPicker();
                return;
            default:
                result = { success: false, message: 'Unknown action.' };
        }
        if (result) {
            toast(result.message, result.success ? 'success' : (result.accepted === false ? 'warning' : 'error'));
            openSpousePanel();
        }
    }

    // --- Spouse sub-modal helpers (replace native prompt()) ---

    function _showSpouseGoldPicker(mode) {
        var status = Player.getSpouseStatus ? Player.getSpouseStatus() : null;
        if (!status) { toast('No spouse.', 'error'); return; }
        var isGive = mode === 'give';
        var maxGold = isGive ? Math.floor(Player.state.gold) : Math.floor(status.gold || 0);
        var title = isGive ? '🪙 Give Gold to ' + status.name : '💰 Ask ' + status.name + ' for Gold';
        var desc = isGive
            ? 'How much gold to give? (You have ' + formatGold(maxGold) + 'g)'
            : status.name + ' has ' + formatGold(maxGold) + 'g. How much to ask for?';
        var presets = [];
        if (maxGold >= 10) presets.push(10);
        if (maxGold >= 25) presets.push(25);
        if (maxGold >= 50) presets.push(50);
        if (maxGold >= 100) presets.push(100);
        if (maxGold >= 250) presets.push(250);

        var html = '<div style="padding:8px;">';
        html += '<div style="color:#ccc;margin-bottom:10px;">' + desc + '</div>';
        if (!isGive) {
            html += '<button class="btn-medieval" data-action="_spouseGoldConfirm" data-id="' + mode + '" data-val="999999" style="width:100%;margin-bottom:8px;background:rgba(200,180,60,0.15);border-color:rgba(200,180,60,0.4);">💰 Ask for All (' + formatGold(maxGold) + 'g)</button>';
        }
        if (presets.length > 0) {
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">';
            for (var pi = 0; pi < presets.length; pi++) {
                html += '<button class="btn-medieval" data-action="_spouseGoldConfirm" data-id="' + mode + '" data-val="' + presets[pi] + '" style="flex:1;min-width:60px;font-size:12px;padding:6px;">' + presets[pi] + 'g</button>';
            }
            html += '</div>';
        }
        html += '<div style="display:flex;gap:6px;align-items:center;">';
        html += '<input type="number" id="spouseGoldInput" min="1" max="' + maxGold + '" value="50" style="flex:1;padding:6px;background:#1a1a1a;border:1px solid #555;color:#ddd;border-radius:4px;font-size:14px;" />';
        html += '<button class="btn-medieval" data-action="spouseGoldConfirmInput" data-id="' + mode + '" style="padding:6px 16px;">Confirm</button>';
        html += '</div></div>';

        var footer = '<button class="btn-medieval" data-action="openSpousePanel" style="background:rgba(150,100,100,0.2);border-color:rgba(150,100,100,0.4);">↩ Back</button>';
        openModal(title, html, footer);
    }

    function _spouseGoldConfirm(mode, amount) {
        if (!amount || isNaN(amount) || amount <= 0) { toast('Invalid amount.', 'error'); return; }
        var result;
        if (mode === 'give') {
            result = Player.giveSpouseGold ? Player.giveSpouseGold(amount) : { success: false, message: 'Not available.' };
        } else {
            result = Player.askSpouseForMoney ? Player.askSpouseForMoney(amount) : { success: false, message: 'Not available.' };
        }
        toast(result.message, result.success ? 'success' : (result.accepted === false ? 'warning' : 'error'));
        openSpousePanel();
    }

    function _showSpouseTownPicker(mode) {
        var towns = [];
        try { towns = Engine.getTowns(); } catch(e) {}
        if (!towns || towns.length === 0) { toast('No towns available.', 'error'); return; }
        var currentTownId = Player.townId;
        var currentTown = Engine.findTown(currentTownId);

        // Sort towns by distance from player's current town
        var sortedTowns = towns.slice().sort(function(a, b) {
            if (!currentTown) return 0;
            var da = Math.abs(a.x - currentTown.x) + Math.abs(a.y - currentTown.y);
            var db = Math.abs(b.x - currentTown.x) + Math.abs(b.y - currentTown.y);
            return da - db;
        });

        var isTravel = mode === 'travel';
        var title = isTravel ? '🗺️ Send Spouse to Town' : '📊 Send Spouse to Trade';
        var html = '<div style="padding:8px;">';
        html += '<div style="color:#ccc;margin-bottom:10px;">Select a town for your spouse to ' + (isTravel ? 'travel' : 'trade') + ' in:</div>';
        html += '<div style="max-height:350px;overflow-y:auto;">';
        for (var ti = 0; ti < sortedTowns.length; ti++) {
            var t = sortedTowns[ti];
            var isCurrent = t.id === currentTownId;
            var dist = currentTown ? Math.round(Math.sqrt(Math.pow(t.x - currentTown.x, 2) + Math.pow(t.y - currentTown.y, 2))) : 0;
            var distLabel = dist > 0 ? ' (' + dist + ' away)' : '';
            var style = 'width:100%;text-align:left;font-size:12px;padding:8px;margin-bottom:4px;';
            if (isCurrent) style += 'border-color:rgba(100,200,100,0.4);background:rgba(100,200,100,0.1);';
            html += '<button class="btn-medieval" data-action="_spouseTownConfirm" data-id="' + mode + '" data-val="' + t.id + '" style="' + style + '">';
            html += (isCurrent ? '📍 ' : '') + t.name + '<span style="color:#888;margin-left:6px;">' + distLabel + '</span>';
            if (t.kingdom) {
                var kn = '';
                try { var k = Engine.findKingdom(t.kingdom); kn = k ? k.name : ''; } catch(e) {}
                if (kn) html += '<span style="color:#a88;margin-left:6px;font-size:11px;">(' + kn + ')</span>';
            }
            html += '</button>';
        }
        html += '</div></div>';

        var footer = '<button class="btn-medieval" data-action="openSpousePanel" style="background:rgba(150,100,100,0.2);border-color:rgba(150,100,100,0.4);">↩ Back</button>';
        openModal(title, html, footer);
    }

    function _spouseTownConfirm(mode, townId) {
        var result;
        if (mode === 'trade') {
            result = Player.askSpouseToTrade ? Player.askSpouseToTrade(townId) : { success: false, message: 'Not available.' };
        } else {
            result = Player.askSpouseToTravel ? Player.askSpouseToTravel(townId) : { success: false, message: 'Not available.' };
        }
        toast(result.message, result.success ? 'success' : (result.accepted === false ? 'warning' : 'error'));
        openSpousePanel();
    }

    function _showSpouseBuildingPicker() {
        if (!Player.buildings || Player.buildings.length === 0) { toast('You have no buildings.', 'error'); return; }
        var status = Player.getSpouseStatus ? Player.getSpouseStatus() : {};
        var html = '<div style="padding:8px;">';
        html += '<div style="color:#ccc;margin-bottom:10px;">Select a building for your spouse to manage:</div>';
        html += '<div style="max-height:350px;overflow-y:auto;">';

        // Unassign button
        html += '<button class="btn-medieval" data-action="_spouseBuildingConfirm" data-val="-1" style="width:100%;text-align:left;font-size:12px;padding:8px;margin-bottom:6px;background:rgba(150,100,100,0.15);border-color:rgba(150,100,100,0.3);">❌ Unassign from Building Management</button>';

        for (var bi = 0; bi < Player.buildings.length; bi++) {
            var b = Player.buildings[bi];
            var tn = '';
            try { var bTown = Engine.findTown(b.townId); tn = bTown ? bTown.name : '?'; } catch(e) { tn = '?'; }
            var isManaged = status.managedBuilding && status.managedBuilding.type === b.type && status.managedBuilding.townId === b.townId;
            var style = 'width:100%;text-align:left;font-size:12px;padding:8px;margin-bottom:4px;';
            if (isManaged) style += 'border-color:rgba(100,200,100,0.4);background:rgba(100,200,100,0.1);';
            html += '<button class="btn-medieval" data-action="_spouseBuildingConfirm" data-val="' + bi + '" style="' + style + '">';
            html += (isManaged ? '✅ ' : '🏭 ') + (b.type || 'building') + ' (Lv.' + (b.level || 1) + ') — ' + tn;
            html += '</button>';
        }
        html += '</div></div>';

        var footer = '<button class="btn-medieval" data-action="openSpousePanel" style="background:rgba(150,100,100,0.2);border-color:rgba(150,100,100,0.4);">↩ Back</button>';
        openModal('🏭 Manage Building — Spouse', html, footer);
    }

    function _spouseBuildingConfirm(idx) {
        var result = Player.askSpouseToManage ? Player.askSpouseToManage(idx) : { success: false, message: 'Not available.' };
        toast(result.message, result.success ? 'success' : (result.accepted === false ? 'warning' : 'error'));
        openSpousePanel();
    }

    function _showSpouseNegotiatePicker() {
        var people = [];
        try { people = Engine.getPeople ? Engine.getPeople(Player.townId) : []; } catch(e) {}
        var merchants = people.filter(function(p) { return p.occupation === 'merchant' && p.alive; });
        if (merchants.length === 0) { toast('No merchants in town to negotiate with.', 'error'); return; }

        var html = '<div style="padding:8px;">';
        html += '<div style="color:#ccc;margin-bottom:10px;">Select a merchant for your spouse to negotiate with:</div>';
        html += '<div style="max-height:350px;overflow-y:auto;">';
        for (var mi = 0; mi < merchants.length; mi++) {
            var m = merchants[mi];
            var rel = Player.getRelationship ? Player.getRelationship(m.id) : null;
            var relStr = rel ? ' (Rel: ' + Math.round(rel.level || 0) + ')' : '';
            html += '<button class="btn-medieval" data-action="_spouseNegotiateConfirm" data-id="' + m.id + '" style="width:100%;text-align:left;font-size:12px;padding:8px;margin-bottom:4px;">';
            html += '🤝 ' + (m.firstName || 'Unknown') + ' ' + (m.lastName || '') + '<span style="color:#888;margin-left:6px;">' + relStr + '</span>';
            html += '</button>';
        }
        html += '</div></div>';

        var footer = '<button class="btn-medieval" data-action="openSpousePanel" style="background:rgba(150,100,100,0.2);border-color:rgba(150,100,100,0.4);">↩ Back</button>';
        openModal('🤝 Negotiate Deal — Spouse', html, footer);
    }

    function _spouseNegotiateConfirm(npcId) {
        var result = Player.askSpouseToNegotiate ? Player.askSpouseToNegotiate(npcId) : { success: false, message: 'Not available.' };
        toast(result.message, result.success ? 'success' : (result.accepted === false ? 'warning' : 'error'));
        openSpousePanel();
    }

    function _showSpouseCaravanPicker() {
        if (!Player.caravans || Player.caravans.length === 0) { toast('You have no active caravans.', 'error'); return; }
        var html = '<div style="padding:8px;">';
        html += '<div style="color:#ccc;margin-bottom:10px;">Select a caravan for your spouse to guard:</div>';
        html += '<div style="max-height:350px;overflow-y:auto;">';
        for (var ci = 0; ci < Player.caravans.length; ci++) {
            var c = Player.caravans[ci];
            var dest = '';
            try { var cTown = Engine.findTown(c.destinationTownId || c.targetTownId); dest = cTown ? cTown.name : 'Unknown'; } catch(e) { dest = 'Unknown'; }
            html += '<button class="btn-medieval" data-action="_spouseCaravanConfirm" data-val="' + ci + '" style="width:100%;text-align:left;font-size:12px;padding:8px;margin-bottom:4px;">';
            html += '🐪 Caravan #' + (ci + 1) + ' → ' + dest;
            if (c.goods && c.goods.length > 0) html += '<span style="color:#888;margin-left:6px;">(' + c.goods.length + ' goods)</span>';
            html += '</button>';
        }
        html += '</div></div>';

        var footer = '<button class="btn-medieval" data-action="openSpousePanel" style="background:rgba(150,100,100,0.2);border-color:rgba(150,100,100,0.4);">↩ Back</button>';
        openModal('🐪 Guard Caravan — Spouse', html, footer);
    }

    function _spouseCaravanConfirm(idx) {
        var result = Player.askSpouseToGuardCaravan ? Player.askSpouseToGuardCaravan(idx) : { success: false, message: 'Not available.' };
        toast(result.message, result.success ? 'success' : (result.accepted === false ? 'warning' : 'error'));
        openSpousePanel();
    }

    // ── Special Start Actions Panel ──
    function openSpecialStartPanel() {
        var status = Player.getSpecialStartStatus();
        if (!status) { toast('No active special start.', 'info'); return; }

        var html = '<div class="special-start-panel">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div class="special-status-header">' + status.icon + ' ' + status.label + '</div>';
        html += '<button class="btn-action" data-action="openStartJournal" style="font-size:0.85em;background:#2a3a5a;">📓 Journal</button>';
        html += '</div>';
        html += '<div class="special-status-info">' + status.info + '</div>';
        html += '<hr style="border-color:#5a3a1a;margin:10px 0;">';

        var townId = Player.townId;

        if (status.type === 'pilgrim') {
            html += '<h3>Pilgrim Actions</h3>';
            var pil = Player.state.pilgrim || {};
            html += '<button class="btn-action" data-action="specialAction" data-type="sermon">🙏 Give Sermon</button>';
            html += '<button class="btn-action" data-action="specialAction" data-type="visitSite">⛪ Visit Holy Site</button>';
            html += '<button class="btn-action" data-action="specialAction" data-type="convert">✝️ Convert NPC</button>';
            html += '<button class="btn-action" data-action="specialAction" data-type="bless">🙌 Bless NPC</button>';
            if (!pil.templeBuilt && pil.followers >= 20) {
                html += '<button class="btn-action" data-action="specialAction" data-type="buildTemple" style="background:#553322;">🏛️ Build Temple (500g)</button>';
            }
            if (pil.rivalFaith && !pil.rivalDefeated && pil.rivalFaith.townId === Player.townId) {
                html += '<button class="btn-action" data-action="specialAction" data-type="challengeRival" style="background:#882222;">⚡ Challenge ' + (pil.rivalFaith.preacherName || 'Rival') + '</button>';
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
            html += '<button class="btn-action" data-action="specialAction" data-type="story">📖 Tell Story</button>';
            html += '<button class="btn-action" data-action="specialAction" data-type="craft">🔧 Teach Craft</button>';
            // Resonance site
            if (sw.artifactPulsing) {
                html += '<button class="btn-action" data-action="specialAction" data-type="resonance" style="background:#553388;animation:pulse 2s infinite;">✨ Visit Resonance Site</button>';
            }
            // Final choice
            if (sw.finalChoiceAvailable && !sw.finalChoice) {
                html += '<div style="margin:8px 0;padding:8px;background:rgba(255,215,0,0.15);border:1px solid gold;border-radius:6px;">';
                html += '<strong style="color:gold;">🌟 THE FINAL CHOICE</strong><br>';
                html += '<p style="color:#ccc;font-size:0.9em;">All sea chart fragments assembled. The artifact awaits your decision.</p>';
                html += '<button class="btn-action" data-action="specialAction" data-type="openArtifact" style="background:#336633;margin:4px;">🏛️ OPEN — Found Embassy</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="sealArtifact" style="background:#663333;margin:4px;">⚡ SEAL — Absorb Power</button>';
                html += '</div>';
            }
            // Embassy actions
            if (sw.embassy) {
                html += '<hr style="border-color:#555;margin:8px 0;">';
                html += '<h4 style="color:#55aacc;">🏛️ Embassy in ' + sw.embassy.townName + '</h4>';
                html += '<p>Bank: ' + (Player.state.shipwrecked.embassyBankAccount || 0) + 'g | Potions: R:' + (sw.embassy.potionStockRed || 0) + ' G:' + (sw.embassy.potionStockGreen || 0) + ' B:' + (sw.embassy.potionStockBlue || 0) + '</p>';
                html += '<button class="btn-action" data-action="specialAction" data-type="warpEmbassy" style="background:#224488;">🌀 Warp to Embassy</button>';
                html += '<div style="margin:4px 0;"><strong>Free Potion (monthly):</strong></div>';
                html += '<button class="btn-action" data-action="specialAction" data-type="potionRed" style="background:#882222;font-size:0.85em;">❤️ Red (Strength)</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="potionGreen" style="background:#228822;font-size:0.85em;">💚 Green (Speed)</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="potionBlue" style="background:#222288;font-size:0.85em;">💙 Blue (Immunity)</button>';
                // Homeland NPCs
                if (sw.homelandNPCs && sw.homelandNPCs.length > 0 && Player.townId === sw.embassy.townId) {
                    html += '<div style="margin:6px 0;"><strong>Homeland NPCs:</strong></div>';
                    for (var hi = 0; hi < sw.homelandNPCs.length; hi++) {
                        var hnpc = sw.homelandNPCs[hi];
                        var roleIcons = { healer: '💚', merchant: '💰', guard: '⚔️', scholar: '📚', worker: '🔧' };
                        html += '<button class="btn-action" data-action="specialAction" data-type="homeland_' + hi + '" style="font-size:0.85em;">' + (roleIcons[hnpc.role] || '👤') + ' ' + hnpc.first + ' (' + hnpc.role + ')</button>';
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
                html += '<button class="btn-action" data-action="specialAction" data-type="tavern">🎵 Tavern</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="street">🎶 Street</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="concert">🎪 Concert</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="court">👑 Court</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="private">🎻 Private</button>';
                html += '<div style="margin:4px 0;">';
                html += '<strong>Compose:</strong> ';
                html += '<button class="btn-action" data-action="specialAction" data-type="compose_love" style="font-size:0.85em;">❤️ Love</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="compose_war" style="font-size:0.85em;">⚔️ War</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="compose_comedy" style="font-size:0.85em;">😂 Comedy</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="compose_epic" style="font-size:0.85em;">⭐ Epic</button>';
                html += '</div>';
                if ((mus.musicSkill || 0) >= 70) {
                    html += '<button class="btn-action" data-action="specialAction" data-type="grandConcert" style="background:#553388;">🌟 Grand Concert (200g)</button>';
                }
            }
            // Rival duels
            if (mus.rivals) {
                for (var ri3 = 0; ri3 < mus.rivals.length; ri3++) {
                    var rv = mus.rivals[ri3];
                    if (!rv.defeated && rv.townId === Player.townId) {
                        html += '<button class="btn-action" data-action="specialAction" data-type="duel_' + ri3 + '" style="background:#882222;">🎭 Duel ' + rv.name + ' (Skill:' + rv.skill + ')</button>';
                    }
                }
            }
            // Legacy choice
            if (mus.legacyOffered && !mus.legacyChoice) {
                html += '<div style="margin:6px 0;padding:6px;background:rgba(255,215,0,0.15);border-radius:4px;">';
                html += '<strong>🌟 Legacy Choice:</strong><br>';
                html += '<button class="btn-action" data-action="specialAction" data-type="legacy_school" style="background:#336633;">🏫 Music School</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="legacy_bard" style="background:#663366;">🌟 Legendary Bard</button>';
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
            html += '<button class="btn-action" data-action="specialAction" data-type="train">⚔️ Train Troops</button>';
            html += '<button class="btn-action" data-action="specialAction" data-type="plan">📋 Plan Battle</button>';
            html += '<button class="btn-action" data-action="specialAction" data-type="inspire">📣 Inspire Army</button>';
            html += '<button class="btn-action" data-action="specialAction" data-type="fortify">🏰 Fortify (100g)</button>';
            html += '<button class="btn-action" data-action="specialAction" data-type="scout">🔭 Scout Enemy</button>';
            // Battle actions
            var milRanksArr = (typeof CONFIG !== 'undefined' && CONFIG.MILITARY_LEADER_RANKS) || [];
            var milRankIdxUI = milRanksArr.findIndex(function(r) { return r.id === mil.rank; });
            html += '<div style="margin:4px 0;">';
            html += '<strong>Battle Tactics:</strong> ';
            html += '<button class="btn-action" data-action="specialAction" data-type="battle_aggressive" style="background:#882222;font-size:0.85em;">🗡️ Aggressive</button>';
            html += '<button class="btn-action" data-action="specialAction" data-type="battle_defensive" style="background:#224488;font-size:0.85em;">🛡️ Defensive</button>';
            html += '<button class="btn-action" data-action="specialAction" data-type="battle_flanking" style="background:#886622;font-size:0.85em;">🏇 Flanking</button>';
            html += '</div>';
            // War council (captain+)
            if (mil.warCouncilAccess || milRankIdxUI >= 4) {
                html += '<button class="btn-action" data-action="specialAction" data-type="warCouncil" style="background:#553388;">📜 War Council</button>';
            }
            // Decisive battle (general + 10 victories)
            if (mil.decisiveBattleAvailable && !mil.heroOfAgesEarned) {
                html += '<button class="btn-action" data-action="specialAction" data-type="decisiveBattle" style="background:#aa6600;font-size:1.1em;">⚔️👑 DECISIVE BATTLE</button>';
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
                html += '<button class="btn-action" data-action="specialAction" data-type="specHistory" style="background:#665533;">📜 History</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="specEconomics" style="background:#336655;">💰 Economics</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="specScience" style="background:#335566;">🔬 Natural Science</button>';
                html += '</div>';
            } else if (sch.specialization) {
                var specLabels = { history: '📜 History', economics: '💰 Economics', natural_science: '🔬 Natural Science' };
                html += '<p style="color:#8888ff;">Specialization: ' + (specLabels[sch.specialization] || sch.specialization) + '</p>';
            }
            if (sch.active) {
                html += '<button class="btn-action" data-action="specialAction" data-type="study">📚 Study Town</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="library">📖 Study Library</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="learn">🎓 Learn from NPC</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="notes">✏️ Write Notes</button>';
                html += '<button class="btn-action" data-action="specialAction" data-type="book">📕 Write Great Book</button>';
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
                        html += '<button class="btn-action" data-action="payDebt" data-val="' + Math.min(pa, debtLeft) + '" style="background:' + (canPay ? '#2d5a27' : '#333') + ';padding:4px 8px;font-size:12px;"' + (canPay ? '' : ' disabled') + '>' + pa + 'g</button>';
                    }
                    if (pGold > 0) {
                        var allPay = Math.min(pGold, debtLeft);
                        html += '<button class="btn-action" data-action="payDebt" data-val="' + allPay + '" style="background:#5a4a27;padding:4px 8px;font-size:12px;">All (' + allPay + 'g)</button>';
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
                html += '<button class="btn-action" data-action="completeMasterTask" style="background:#2d5a27;margin-right:5px;">✅ Complete Task</button>';
                html += '<button class="btn-action" data-action="dismissMasterTask" style="background:#5a2727;">❌ Dismiss</button>';
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
                    html += '<button class="btn-action" data-action="specialAction" data-type="acceptEarlyRelease" style="background:' + (canAfford ? '#2d5a27' : '#333') + ';margin-top:5px;"' + (canAfford ? '' : ' disabled') + '>🤝 Accept Early Release (' + releaseCost + 'g)</button>';
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
                            html += '<button class="btn-action" style="font-size:11px;margin-top:4px;" data-action="attemptIndenturedEscape" data-id="' + eid + '">⚡ Attempt</button>';
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
        html += '<button class="btn-action" data-action="openSpecialStartPanel" style="font-size:0.85em;">⬅ Actions</button>';
        html += '</div>';

        var day = Engine.getDay ? Engine.getDay() : 0;
        var year = Math.floor(day / (CONFIG.DAYS_PER_SEASON || 90)) + 1;
        var season = ['Spring', 'Summer', 'Autumn', 'Winter'][Math.floor(day / (CONFIG.DAYS_PER_SEASON || 90)) % 4];

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


    // Register functions on UI namespace
    // Kingdom/Town Selection
    UI.showKingdomSelection = showKingdomSelection;
    UI.regenerateWorld = regenerateWorld;
    UI.backToMainMenu = backToMainMenu;
    UI.selectKingdom = selectKingdom;
    UI.selectTown = selectTown;
    UI.randomTown = randomTown;
    // Game Start UI
    UI.showStartScenarioSelection = showStartScenarioSelection;
    UI.selectStartScenario = selectStartScenario;
    UI.selectMilitaryKingdom = selectMilitaryKingdom;
    UI.confirmStartScenario = confirmStartScenario;
    UI.backToTownSelection = backToTownSelection;
    // Family Panel
    UI.openFamilyPanel = openFamilyPanel;
    UI.familyAction = familyAction;
    UI.giveFamilyGoldDialog = giveFamilyGoldDialog;
    UI.giveFamilyItemDialog = giveFamilyItemDialog;
    // Spouse Panel
    UI.openSpousePanel = openSpousePanel;
    UI.tryForBaby = tryForBaby;
    UI.spouseInteraction = spouseInteraction;
    UI._spouseGoldConfirm = _spouseGoldConfirm;
    UI._spouseTownConfirm = _spouseTownConfirm;
    UI._spouseBuildingConfirm = _spouseBuildingConfirm;
    UI._spouseNegotiateConfirm = _spouseNegotiateConfirm;
    UI._spouseCaravanConfirm = _spouseCaravanConfirm;
    // Special Start
    UI.openSpecialStartPanel = openSpecialStartPanel;
    UI.openStartJournal = openStartJournal;
    UI.specialAction = specialAction;

    // --- Delegated action handlers ---
    UI.registerAction('showPersonLink', function(_t, d) { var p = Engine.findPerson(d.id); if (p) UI.showPersonDetail(p); });
    UI.registerAction('backToKingdomSelect', function() { UI.showKingdomSelection(window._kingdomSelectCallback); });
    UI.registerAction('arrangeChildMarriage', function(_t, d) { var sel = document.getElementById('marriageTarget_' + d.idx); if (sel) { var r = Player.arrangeChildMarriage(d.id, sel.value); UI.toast(r.message, r.success ? 'success' : 'error'); if (r.success) UI.openFamilyPanel(); } });
    UI.registerAction('giveFamilyGoldPreset', function(_t, d) { var r = Player.giveFamilyGold(d.id, parseInt(d.val)); UI.toast(r.message, r.success ? 'success' : 'error'); if (r.success) { UI.closeModal(); UI.openFamilyPanel(); } });
    UI.registerAction('giveFamilyGoldCustom', function(_t, d) { var el = document.getElementById('familyGoldCustom'); if (!el) return; var r = Player.giveFamilyGold(d.id, parseInt(el.value)); UI.toast(r.message, r.success ? 'success' : 'error'); if (r.success) { UI.closeModal(); UI.openFamilyPanel(); } });
    UI.registerAction('giveFamilyGift', function(_t, d) { var r = Player.giveFamilyGift(d.id, d.val, 1); UI.toast(r.message, r.success ? 'success' : 'error'); if (r.success) { UI.closeModal(); UI.openFamilyPanel(); } });
    UI.registerAction('spouseGoldConfirmInput', function(_t, d) { UI._spouseGoldConfirm(d.id, parseInt(document.getElementById('spouseGoldInput').value)); });
    UI.registerAction('treatSpousePlayer', function() { UI.treatCompanionUI('spouse', null, 'player'); });
    UI.registerAction('treatSpouseHospital', function() { UI.treatCompanionUI('spouse', null, 'hospital'); });

    // --- New game flow actions ---
    UI.registerAction('selectKingdom', function(_t, d) { selectKingdom(d.id); });
    UI.registerAction('regenerateWorld', function() { regenerateWorld(); });
    UI.registerAction('backToMainMenu', function() { backToMainMenu(); });
    UI.registerAction('randomTown', function(_t, d) { randomTown(d.id); });
    UI.registerAction('selectTown', function(_t, d) { selectTown(d.id); });
    UI.registerAction('backToTownSelection', function(_t, d) { backToTownSelection(d.id); });
    UI.registerAction('selectStartScenario', function(_t, d) { selectStartScenario(d.id); });
    UI.registerAction('selectMilitaryKingdom', function(_t, d) { selectMilitaryKingdom(d.id); });
    UI.registerAction('confirmStartScenario', function(_t, d) { confirmStartScenario(d.id); });

    // --- Family & spouse actions ---
    UI.registerAction('familyAction', function(_t, d) { familyAction(d.type, d.id); });
    UI.registerAction('giveFamilyGoldDialog', function(_t, d) { giveFamilyGoldDialog(d.id, d.val); });
    UI.registerAction('giveFamilyItemDialog', function(_t, d) { giveFamilyItemDialog(d.id, d.val); });
    UI.registerAction('openSpousePanel', function() { openSpousePanel(); });
    UI.registerAction('tryForBaby', function() { tryForBaby(); });
    UI.registerAction('spouseInteraction', function(_t, d) { spouseInteraction(d.id); });

    // --- Special start & journal actions ---
    UI.registerAction('openStartJournal', function() { openStartJournal(); });
    UI.registerAction('specialAction', function(_t, d) { specialAction(d.type); });
    UI.registerAction('openSpecialStartPanel', function() { UI.openSpecialStartPanel(); });

    // --- Actions that need Player functions ---
    UI.registerAction('respondToMarriageProposal', function(_t, d) { if (Player.respondToMarriageProposal) { var r = Player.respondToMarriageProposal(d.id, d.val === 'true'); UI.toast(r.message, r.success ? 'success' : 'error'); if (r.success) UI.openFamilyPanel(); } });
    UI.registerAction('payDebt', function(_t, d) { if (Player.payDebt) { var r = Player.payDebt(parseInt(d.val)); UI.toast(r.message, r.success ? 'success' : 'error'); if (r.success) UI.openSpecialStartPanel(); } });
    UI.registerAction('completeMasterTask', function() { if (Player.completeMasterTask) { var r = Player.completeMasterTask(); UI.toast(r.message, r.success ? 'success' : 'error'); if (r.success) UI.openSpecialStartPanel(); } });
    UI.registerAction('dismissMasterTask', function() { if (Player.dismissMasterTask) { var r = Player.dismissMasterTask(); UI.toast(r.message, r.success ? 'success' : 'error'); if (r.success) UI.openSpecialStartPanel(); } });
    UI.registerAction('attemptIndenturedEscape', function(_t, d) { if (Player.attemptEscape) { Player.attemptEscape(d.id); } });
    UI.registerAction('treatCompanionUI', function(_t, d) { if (UI.treatCompanionUI) UI.treatCompanionUI(d.type, d.id, d.val); });
    UI.registerAction('openWeddingPlanner', function() { if (UI.openWeddingPlanner) UI.openWeddingPlanner(); });
    UI.registerAction('openTalkToSpouse', function() { if (UI.openTalkToSpouse) UI.openTalkToSpouse(); });
    UI.registerAction('_spouseGoldConfirm', function(_t, d) { if (UI._spouseGoldConfirm) UI._spouseGoldConfirm(d.id, parseInt(d.amount)); });
    UI.registerAction('_spouseTownConfirm', function(_t, d) { if (UI._spouseTownConfirm) UI._spouseTownConfirm(d.id); });
    UI.registerAction('_spouseBuildingConfirm', function(_t, d) { if (UI._spouseBuildingConfirm) UI._spouseBuildingConfirm(d.id, d.type); });
    UI.registerAction('_spouseNegotiateConfirm', function(_t, d) { if (UI._spouseNegotiateConfirm) UI._spouseNegotiateConfirm(d.id); });
    UI.registerAction('_spouseCaravanConfirm', function(_t, d) { if (UI._spouseCaravanConfirm) UI._spouseCaravanConfirm(d.id); });

})(window.UI);