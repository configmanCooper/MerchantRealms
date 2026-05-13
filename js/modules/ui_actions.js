// ============================================================
// Merchant Realms — UI Actions Module (extracted from ui.js)
// Extends window.UI with Right Panel rendering and
// Action Helper functions (travel, trade, ship, bridge, etc.)
// ============================================================
(function(UI) {
    "use strict";
    if (!UI) throw new Error("UI must be loaded before ui_actions.js");

    // Aliases for UI utilities used as bare calls in extracted code
    var openModal = UI.openModal;
    var closeModal = UI.closeModal;
    var toast = UI.toast;
    var formatGold = UI.formatGold;
    var escapeHtml = UI.escapeHtml;
    var findResource = UI.findResource;
    var findBuildingType = UI.findBuildingType;
    var _isBankruptcyBlocked = UI._isBankruptcyBlocked;

    // capitalize helper (duplicated from UTILITY section for local use)
    function capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    // Right-panel DOM helpers (replaces el.rightPanel* from parent closure)
    function _rpEl()      { return document.getElementById('rightPanel'); }
    function _rpTitleEl() { return document.getElementById('rightPanelTitle'); }
    function _rpBodyEl()  { return document.getElementById('rightPanelBody'); }

    // Shared state that was private in ui.js closure
    var _townPanelExpandedSections = {};

// ═══════════════════════════════════════════════════════════
//  RIGHT PANEL (Context-Sensitive Details)
// ═══════════════════════════════════════════════════════════

function showRightPanel(title, html) {
    _rpTitleEl().textContent = title;
    _rpBodyEl().innerHTML = html;
    _rpEl().classList.remove('hidden');
}

function closeRightPanel() {
    _rpEl().classList.add('hidden');
    UI._rightPanelTownId = null;
}

function _toggleCollapse(h3El) {
    var body = h3El.nextElementSibling;
    var id = h3El.getAttribute('data-collapse-id');
    var isNowHidden = body.style.display !== 'none';
    body.style.display = isNowHidden ? 'none' : '';
    var arrow = h3El.querySelector('.collapse-arrow');
    if (arrow) arrow.textContent = isNowHidden ? '▶' : '▼';
    if (id) _townPanelExpandedSections[id] = !isNowHidden;
}

function showTownDetail(town) {
    if (!town) return;
    if (_isBankruptcyBlocked()) { toast('💸 You must resolve your bankruptcy first!', 'danger', 'critical'); return; }
    // Reset expanded sections when switching towns
    if (UI._rightPanelTownId !== town.id) _townPanelExpandedSections = {};
    UI._rightPanelTownId = town.id;
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

    // Sick population count (skip for outposts with no residents)
    var _sickInfo = { total: 0, minor: 0, moderate: 0, severe: 0 };
    if (pop > 0) {
    try {
        var _w = Engine.getWorld();
        if (_w && _w.people) {
            for (var _si = 0; _si < _w.people.length; _si++) {
                var _sp = _w.people[_si];
                if (_sp.alive && _sp.townId === town.id && _sp.sick) {
                    _sickInfo.total++;
                    var _sev = _sp.illnessSeverity || 'minor';
                    if (_sev === 'severe' || _sev === 'serious') _sickInfo.severe++;
                    else if (_sev === 'moderate') _sickInfo.moderate++;
                    else _sickInfo.minor++;
                }
            }
        }
    } catch(e) {}
    } // end if (pop > 0)

    if (_sickInfo.total > 0) {
        var _hasDiseaseAwareness = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('disease_awareness');
        var _hasEpidemiologist = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('epidemiologist');
        var _sickPct = pop > 0 ? _sickInfo.total / pop : 0;

        // Default: vague description based on percentage
        var _sickVal, _sickColor;
        if (_sickPct < 0.01) { _sickVal = '💚 Healthy'; _sickColor = '#55a868'; }
        else if (_sickPct < 0.03) { _sickVal = '🤒 Ailing'; _sickColor = '#ccb974'; }
        else if (_sickPct < 0.05) { _sickVal = '😷 Sickly'; _sickColor = '#e67e22'; }
        else { _sickVal = '☠️ Plagued'; _sickColor = '#c44e52'; }

        if (_hasDiseaseAwareness) {
            var _parts = [];
            if (_sickInfo.minor > 0) _parts.push('<span style="color:#ccb974;">' + _sickInfo.minor + ' minor</span>');
            if (_sickInfo.moderate > 0) _parts.push('<span style="color:#e67e22;">' + _sickInfo.moderate + ' moderate</span>');
            if (_sickInfo.severe > 0) _parts.push('<span style="color:#c44e52;">' + _sickInfo.severe + ' severe</span>');
            _sickVal = '🤒 ' + _sickInfo.total + ' sick (' + _parts.join(', ') + ')';
        }
        if (_hasEpidemiologist) {
            var _contagionLevel, _contagionColor;
            if (_sickPct >= 0.20) { _contagionLevel = 'Very High'; _contagionColor = '#c44e52'; }
            else if (_sickPct >= 0.10) { _contagionLevel = 'High'; _contagionColor = '#e67e22'; }
            else if (_sickPct >= 0.04) { _contagionLevel = 'Medium'; _contagionColor = '#ccb974'; }
            else { _contagionLevel = 'Low'; _contagionColor = '#55a868'; }
            if (prosperity >= 70 && _contagionLevel !== 'Low') {
                if (_contagionLevel === 'Medium') { _contagionLevel = 'Low'; _contagionColor = '#55a868'; }
                else if (_contagionLevel === 'High') { _contagionLevel = 'Medium'; _contagionColor = '#ccb974'; }
                else if (_contagionLevel === 'Very High') { _contagionLevel = 'High'; _contagionColor = '#e67e22'; }
            }
            _sickVal += ' — <span style="color:' + _contagionColor + ';">🦠 Contagion: ' + _contagionLevel + '</span>';
        }
        html += '<div class="detail-row"><span class="label">Health</span><span class="value" style="color:' + _sickColor + ';">' + _sickVal + '</span></div>';
    } else {
        // No sick people — show skill-aware healthy status
        var _hasDiseaseAwareness2 = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('disease_awareness');
        var _hasEpidemiologist2 = typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('epidemiologist');
        if (_hasDiseaseAwareness2) {
            // Check for nearby plague risk
            var _nearbyPlague = false;
            var _nearbyPlagueTown = '';
            try {
                var _wEvt = Engine.getWorld();
                if (_wEvt && _wEvt.events) {
                    for (var _ei = 0; _ei < _wEvt.events.length; _ei++) {
                        var _evt = _wEvt.events[_ei];
                        if (_evt.active && (_evt.type === 'plague' || _evt.type === 'plague_disaster') && _evt.townId !== town.id) {
                            // Check if adjacent via roads
                            if (_wEvt.roads) {
                                for (var _ri = 0; _ri < _wEvt.roads.length; _ri++) {
                                    var _rd = _wEvt.roads[_ri];
                                    if ((_rd.fromTownId === town.id && _rd.toTownId === _evt.townId) ||
                                        (_rd.toTownId === town.id && _rd.fromTownId === _evt.townId)) {
                                        _nearbyPlague = true;
                                        var _pt = Engine.findTown(_evt.townId);
                                        _nearbyPlagueTown = _pt ? _pt.name : 'nearby';
                                        break;
                                    }
                                }
                            }
                        }
                        if (_nearbyPlague) break;
                    }
                }
            } catch(e) {}
            var _healthyMsg = '💚 No illness detected (0 sick)';
            if (_nearbyPlague) {
                _healthyMsg += ' — <span style="color:#e67e22;">⚠️ Plague nearby (' + _nearbyPlagueTown + ')</span>';
            }
            if (_hasEpidemiologist2) {
                _healthyMsg += ' — <span style="color:#55a868;">🦠 Contagion: None</span>';
            }
            html += '<div class="detail-row"><span class="label">Health</span><span class="value" style="color:#55a868;">' + _healthyMsg + '</span></div>';
        } else {
            html += '<div class="detail-row"><span class="label">Health</span><span class="value" style="color:#55a868;">💚 Healthy</span></div>';
        }
    }

    // Port / Island indicators
    if (town.isPort) {
        html += `<div class="detail-row"><span class="label">Port</span>
            <span class="value" style="color:#00b4c8">⚓ Port Town${town.isIsland ? ' (Island)' : ''}</span></div>`;
    }

    // Town happiness with tier indicator
    const happyTier = town._happinessTier || 'neutral';
    const townTierLabels = { thriving: '🌟 Thriving', content: '😊 Content', neutral: '😐 Neutral', unrest: '😠 Unrest', crisis: '🔥 Crisis' };
    const townTierLabel = townTierLabels[happyTier] || '';
    // Prosperity descriptor
    var prospDesc = '';
    if (prosperity >= 90) prospDesc = '🏛️ Golden Age';
    else if (prosperity >= 75) prospDesc = '✨ Flourishing';
    else if (prosperity >= 60) prospDesc = '📈 Thriving';
    else if (prosperity >= 45) prospDesc = '⚖️ Stable';
    else if (prosperity >= 30) prospDesc = '📉 Struggling';
    else if (prosperity >= 15) prospDesc = '💔 Impoverished';
    else prospDesc = '💀 Destitute';
    html += `<div class="detail-row"><span class="label">Prosperity</span>
            <span class="value"><div class="bar-small"><div class="bar-small-fill" style="width:${Math.round(prosperity)}%;background:${prosperity > 60 ? '#55a868' : prosperity > 30 ? '#ccb974' : '#c44e52'}"></div></div> ${Math.round(prosperity)}% ${prospDesc}</span></div>
        <div class="detail-row"><span class="label">Happiness</span>
            <span class="value"><div class="bar-small"><div class="bar-small-fill" style="width:${happiness}%;background:${happiness > 60 ? '#55a868' : happiness > 30 ? '#ccb974' : '#c44e52'}"></div></div> ${Math.round(happiness)}% ${townTierLabel}</span></div>
        ${(function(){
            // v9p33river180: town security display + verbal tier
            var sec = Math.max(0, Math.min(100, Math.round(town.security || 0)));
            var secColor = sec >= 75 ? '#55a868' : sec >= 50 ? '#7fb37d' : sec >= 30 ? '#ccb974' : sec >= 15 ? '#d97f51' : '#c44e52';
            var secTier;
            if      (sec >= 90) secTier = '🛡️ Fortified';
            else if (sec >= 75) secTier = '🛡️ Secure';
            else if (sec >= 60) secTier = '✅ Safe';
            else if (sec >= 45) secTier = '⚖️ Watchful';
            else if (sec >= 30) secTier = '⚠️ Uneasy';
            else if (sec >= 15) secTier = '🦹 Lawless';
            else                secTier = '☠️ Anarchic';
            return '<div class="detail-row"><span class="label">Security</span>' +
                '<span class="value"><div class="bar-small"><div class="bar-small-fill" style="width:' + sec + '%;background:' + secColor + '"></div></div> ' + sec + '% ' + secTier + '</span></div>';
        })()}
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
    // Active events affecting this town
    if (typeof Engine !== 'undefined' && Engine.getActiveEvents) {
        var activeEvents = Engine.getActiveEvents().filter(function(ev) { return ev.townId === town.id; });
        if (activeEvents.length > 0) {
            var eventIcons = {
                drought: { icon: '☀️', color: '#ccb974', label: 'Drought' },
                blight: { icon: '🌾', color: '#c44e52', label: 'Crop Blight' },
                bountiful: { icon: '🌻', color: '#55a868', label: 'Bountiful Harvest' },
                trade_festival: { icon: '🎪', color: '#6c9bd1', label: 'Trade Festival' },
                plague: { icon: '🦠', color: '#9b59b6', label: 'Plague' },
                bandit_surge: { icon: '🗡️', color: '#c44e52', label: 'Bandit Uprising' },
                fire: { icon: '🔥', color: '#e74c3c', label: 'Fire' },
                flood: { icon: '🌊', color: '#3498db', label: 'Flood' },
                earthquake: { icon: '💥', color: '#95a5a6', label: 'Earthquake' },
                famine: { icon: '💀', color: '#c44e52', label: 'Famine' },
                festival: { icon: '🎉', color: '#f1c40f', label: 'Festival' },
                religious_revival: { icon: '⛪', color: '#daa520', label: 'Religious Revival' },
                migration_wave: { icon: '🚶', color: '#1abc9c', label: 'Migration Wave' },
                gold_rush: { icon: '⛏️', color: '#f1c40f', label: 'Gold Rush' }
            };
            var evHtml = '';
            for (var ei = 0; ei < activeEvents.length; ei++) {
                var ev = activeEvents[ei];
                var evCfg = eventIcons[ev.type] || { icon: '⚡', color: '#aaa', label: ev.name || ev.type };
                var evName = ev.name || evCfg.label;
                var daysLeft = ev.daysRemaining != null ? ev.daysRemaining : '?';
                var tooltip = evName + ' — ' + daysLeft + ' days remaining';
                evHtml += '<span title="' + tooltip + '" style="cursor:help;font-size:1.1rem;margin-right:4px;filter:drop-shadow(0 0 2px ' + evCfg.color + ');">' + evCfg.icon + '</span>';
            }
            html += '<div class="detail-row"><span class="label">Events</span><span class="value">' + evHtml + '</span></div>';
        }
    }
    html += `</div>`;
    // Player can see CURRENT prices if: in this town, OR has appropriate skill
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

    // Stale price memory: player can see prices from their last visit (up to 90 days)
    // Skills that show CURRENT prices override stale prices
    var rememberedData = null;
    var showStale = false;
    if (!canSeePrices && typeof Player !== 'undefined' && Player.getRememberedPrices) {
        rememberedData = Player.getRememberedPrices(town.id);
        if (rememberedData) showStale = true;
    }


    // View Townspeople button — only if player is in this town or a connected town
    if (isPlayerHere) {
        html += `<div class="text-center mt-sm">
            <button class="btn-medieval" data-action="showTownPeople" data-id="${town.id}" style="font-size:0.8rem;padding:6px 16px;">
                👥 View Townspeople (${pop})
            </button>`;
        // v9p33river131: surface "Manage Outpost" directly from the town
        // panel when this is the player's outpost (avoids hunting through
        // the top-bar Outposts dialog).
        try {
            var _myOpId = (typeof Player !== 'undefined' && Player.state && Player.state.id) || 'player';
            if (town.isOutpost && town.founderId === _myOpId) {
                html += ' <button class="btn-medieval" data-action="openOutpostDetail" data-id="' + town.id + '" style="font-size:0.8rem;padding:6px 16px;">⛺ Manage Outpost</button>';
            }
        } catch(e) { /* defensive */ }
        html += '</div>';
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
                <button class="btn-medieval" data-action="showTownPeople" data-id="${town.id}" style="font-size:0.8rem;padding:6px 16px;opacity:0.8;">
                    👥 View Townspeople (${pop}) <span class="text-dim" style="font-size:0.7rem;">— View only</span>
                </button>
            </div>`;
        }
    }

    // Town Quests button (only when player is in this town, and outposts need 10+ NPCs)
    var _outpostQuestBlock = town.isOutpost && (town.population || 0) < 10;
    if (isPlayerHere && !_outpostQuestBlock) {
        var _questCount = 0;
        try {
            if (typeof Player !== 'undefined' && Player.getTownQuestsForTown) {
                _questCount = Player.getTownQuestsForTown(town.id).length;
            }
        } catch(e) {}
        var _activeCount = 0;
        try {
            if (typeof Player !== 'undefined' && Player.getActiveQuests) {
                _activeCount = Player.getActiveQuests().filter(function(q) { return q.townId === town.id; }).length;
            }
        } catch(e) {}
        var _questBadge = _questCount > 0 ? ' <span style="background:#4a7c3f;color:#fff;border-radius:8px;padding:1px 6px;font-size:0.7rem;margin-left:4px;">' + _questCount + ' available</span>' : '';
        var _activeBadge = _activeCount > 0 ? ' <span style="background:#8b6914;color:#fff;border-radius:8px;padding:1px 6px;font-size:0.7rem;margin-left:4px;">' + _activeCount + ' active</span>' : '';
        html += '<div class="text-center mt-sm">';
        html += '<button class="btn-medieval" data-action="openTownQuests" data-id="' + town.id + '" style="font-size:0.8rem;padding:6px 16px;">';
        html += '📋 Town Quests' + _questBadge + _activeBadge;
        html += '</button>';
        html += '</div>';
    }

    // Festival participation button (when there's an active festival in this town)
    if (isPlayerHere && typeof Player !== 'undefined' && typeof Engine !== 'undefined') {
        try {
            var _festKingdom = Engine.getKingdom(town.kingdomId);
            var _activeFest = null;
            if (_festKingdom && _festKingdom._activeFestivals) {
                for (var _ffi = 0; _ffi < _festKingdom._activeFestivals.length; _ffi++) {
                    if (_festKingdom._activeFestivals[_ffi].townId === town.id) {
                        _activeFest = _festKingdom._activeFestivals[_ffi];
                        break;
                    }
                }
            }
            if (_activeFest) {
                var _festDaysLeft = _activeFest.endDay - Engine.getDay();
                var _festActionsLeft = (_activeFest._maxActionsPerDay || 5) - ((_activeFest._playerActionDay === Engine.getDay()) ? (_activeFest._playerActionsToday || 0) : 0);
                var _festTypeLabel = _activeFest.type === 'large' ? '🎊 Grand Festival' : '🎉 Festival';
                var _festHighlight = (typeof StoryMode !== 'undefined' && StoryMode.isActive && StoryMode.isActive() && !StoryMode.getStoryFlags().festivalAttended) ? ' tutorial-highlight' : '';
                html += '<div class="text-center mt-sm">';
                html += '<button class="btn-medieval' + _festHighlight + '" data-action="openFestivalPanel" data-kingdom="' + _festKingdom.id + '" data-festival="' + _activeFest.id + '" style="font-size:0.8rem;padding:6px 16px;border-color:#f1c40f;animation:glow 2s infinite;">';
                html += _festTypeLabel + ' <span style="font-size:0.7rem;">(' + _festDaysLeft + 'd left, ' + _festActionsLeft + ' actions)</span>';
                html += '</button>';
                html += '</div>';
            }
        } catch(e) {}
    }

    // Hospital / Clinic button (blinks when player OR family/guards at same location are sick/injured)
    if (isPlayerHere && typeof Player !== 'undefined') {
        var _medFacilities = Player.getMedicalFacilities ? Player.getMedicalFacilities(town.id) : { hasHospital: false, hasClinic: false };
        var _playerSick = (Player.illnesses && Player.illnesses.length > 0) || (Player.injuries && Player.injuries.length > 0);

        // Check family/guards at same location who need treatment
        var _sickCompanions = [];
        try {
            var _pState = Player.state || {};
            // Spouse
            if (_pState.spouseId) {
                var _sp = Engine.findPerson(_pState.spouseId);
                if (_sp && _sp.alive && _sp.townId === town.id) {
                    var _spAi = _pState.spouseAI || {};
                    if (_spAi.condition && _spAi.condition !== 'healthy') {
                        _sickCompanions.push({ type: 'spouse', id: _pState.spouseId, name: _sp.firstName || 'Spouse', condition: _spAi.condition });
                    }
                }
            }
            // Children
            var _childIds = _pState.childrenIds || [];
            for (var _ci = 0; _ci < _childIds.length; _ci++) {
                var _ch = Engine.findPerson(_childIds[_ci]);
                if (_ch && _ch.alive && _ch.townId === town.id) {
                    var _chSick = _ch.sick || (_ch.illnesses && _ch.illnesses.length > 0);
                    var _chInj = _ch.injured || (_ch.injuries && _ch.injuries.length > 0);
                    if (_chSick || _chInj) {
                        _sickCompanions.push({ type: 'family', id: _childIds[_ci], name: _ch.firstName || 'Child', condition: _chSick ? 'sick' : 'injured' });
                    }
                }
            }
            // Guards
            var _guards = _pState.guards || [];
            for (var _gi = 0; _gi < _guards.length; _gi++) {
                var _g = Engine.findPerson(_guards[_gi].personId);
                if (_g && _g.alive && _g.townId === town.id) {
                    var _gSick = _g.sick || (_g.illnesses && _g.illnesses.length > 0);
                    var _gInj = _g.injured || (_g.injuries && _g.injuries.length > 0);
                    if (_gSick || _gInj) {
                        _sickCompanions.push({ type: 'guard', id: _guards[_gi].personId, name: _g.firstName || 'Guard', condition: _gSick ? 'sick' : 'injured' });
                    }
                }
            }
        } catch(e) { /* no-op */ }

        var _anyoneSick = _playerSick || _sickCompanions.length > 0;
        if (_medFacilities.hasHospital || _medFacilities.hasClinic || _anyoneSick) {
            var _medIcon = _medFacilities.hasHospital ? '🏥' : _medFacilities.hasClinic ? '⚕️' : '🩹';
            var _medLabel = _medFacilities.hasHospital ? 'Visit Hospital' : _medFacilities.hasClinic ? 'Visit Clinic' : 'Health Status';
            var _medStyle = _anyoneSick
                ? 'animation:pulse 2s infinite;'
                : '';
            html += '<div class="text-center mt-sm">';
            html += '<button class="btn-medieval" data-action="openHealthDialog" style="font-size:0.8rem;padding:6px 16px;' + _medStyle + '">';
            html += _medIcon + ' ' + _medLabel;
            if (_playerSick) html += ' <span style="color:#e74c3c;font-size:0.7rem;">(You need treatment!)</span>';
            else if (_sickCompanions.length > 0) html += ' <span style="color:#e67e22;font-size:0.7rem;">(' + _sickCompanions.length + ' companion' + (_sickCompanions.length > 1 ? 's' : '') + ' need treatment)</span>';
            html += '</button>';
            html += '</div>';

            // Show sick companion list with treat buttons
            if (_sickCompanions.length > 0) {
                html += '<div style="background:rgba(180,60,0,0.1);border:1px solid rgba(231,126,35,0.3);border-radius:6px;padding:8px;margin-top:6px;">';
                html += '<div style="font-size:0.78rem;color:#e67e22;font-weight:bold;margin-bottom:4px;">🩺 Companions Needing Treatment:</div>';
                for (var _sci = 0; _sci < _sickCompanions.length; _sci++) {
                    var _sc = _sickCompanions[_sci];
                    var _scIcon = _sc.type === 'spouse' ? '💑' : _sc.type === 'guard' ? '🛡️' : '👶';
                    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">';
                    html += '<span style="font-size:0.75rem;color:#ddd;">' + _scIcon + ' ' + escapeHtml(_sc.name) + ' <span style="color:#c44e52;font-size:0.68rem;">(' + _sc.condition.replace(/_/g, ' ') + ')</span></span>';
                    html += '<span style="display:flex;gap:4px;">';
                    var _safScType = _sc.type.replace(/'/g, "\\'");
                    var _safScId = _sc.id.replace(/'/g, "\\'");
                    html += '<button class="btn-medieval" data-action="treatCompanionHospitalTown" data-id="' + _safScId + '" data-type="' + _safScType + '" style="font-size:0.65rem;padding:2px 8px;background:rgba(40,80,160,0.3);border-color:rgba(60,120,220,0.5);">' + _medIcon + ' Treat</button>';
                    // Player treat option if skilled
                    if (typeof Player !== 'undefined' && Player.hasSkill && (Player.hasSkill('field_medic') || Player.hasSkill('doctor'))) {
                        html += '<button class="btn-medieval" data-action="treatCompanionPlayerTown" data-id="' + _safScId + '" data-type="' + _safScType + '" style="font-size:0.65rem;padding:2px 8px;background:rgba(40,160,80,0.3);border-color:rgba(60,200,100,0.5);">⚕️ Self</button>';
                    }
                    html += '</span></div>';
                }
                html += '</div>';
            }
        }
    }

    // Land & Housing section (only when player is in town; outposts need 10+ NPCs)
    if (isPlayerHere && typeof Player !== 'undefined' && !(town.isOutpost && (town.population || 0) < 10)) {
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
        html += '<button class="btn-medieval" data-action="openHousingDialog" style="font-size:0.8rem;padding:4px 12px;">🏡 Manage Housing</button> ';
        html += '<button class="btn-medieval" data-action="openTownMarket" style="font-size:0.8rem;padding:4px 12px;">🏗️ Town Buildings</button> ';
        if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('local_market_analysis')) {
            html += '<button class="btn-medieval" data-action="openRealEstateReport" style="font-size:0.8rem;padding:4px 12px;">📊 Real Estate Report</button> ';
        }
        if (ownedLand < maxPlots) {
            var _activeSub = Player.getActiveSubsidy ? Player.getActiveSubsidy(town.id) : null;
            var _btnLabel = '🏗️ Buy Land (' + landCost + 'g)';
            if (_activeSub) _btnLabel = '🏗️ Buy Land (' + landCost + 'g) ⭐ Subsidy Available!';
            html += '<button class="btn-medieval" data-action="buyLandUI" style="font-size:0.8rem;padding:4px 12px;">' + _btnLabel + '</button>';
        }
        html += '</div></div>';
    }

    // Kingdom laws & king actions buttons
    if (kingdom) {
        html += '<div style="margin:8px 0;display:flex;gap:6px;flex-wrap:wrap;">';
        html += '<button class="btn-medieval" data-action="openKingdomLawsPanel" data-id="' + kingdom.id + '" style="font-size:0.8rem;padding:4px 10px;">📜 Laws</button>';
        html += '<button class="btn-medieval" data-action="openKingActionLog" data-id="' + kingdom.id + '" style="font-size:0.8rem;padding:4px 10px;">👑 King Actions</button>';
        html += '<button class="btn-medieval" data-action="openRoyalCommissionsPanel" data-id="' + kingdom.id + '" style="font-size:0.8rem;padding:4px 10px;">📦 Commissions</button>';
        if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('economic_advisor')) {
            html += '<button class="btn-medieval" data-action="openProsperityBreakdown" data-id="' + town.id + '" style="font-size:0.8rem;padding:4px 10px;">📊 Prosperity</button>';
        }
        html += '</div>';
    }

    if (town.market && town.market.prices && canSeePrices && !town.isOutpost) {
        const isRemote = !isPlayerHere;
        html += `<div class="detail-section">
            <h3 data-collapse-id="market-prices" style="cursor:pointer;user-select:none;" data-action="_toggleCollapse">📊 Market Prices${isRemote ? ' <span class="text-dim" style="font-size:0.7rem;">(Intel)</span>' : ''} <span class="collapse-arrow" style="font-size:0.7rem;opacity:0.6;">${_townPanelExpandedSections['market-prices'] ? '▼' : '▶'}</span></h3>
            <div style="display:${_townPanelExpandedSections['market-prices'] ? '' : 'none'};">`;
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
                    <button class="btn-trade buy" data-action="quickBuy" data-id="${resId}" data-val="${town.id}">Buy</button>
                    <button class="btn-trade sell" data-action="quickSell" data-id="${resId}" data-val="${town.id}">Sell</button>
                    ${warWarning}
                </td>`;
            }
            html += `</tr>`;
        }
        html += `</table>
            <div class="text-dim" style="font-size:0.7rem;margin-top:4px;">⛏ = Natural deposit | 🏭 = Produced locally | 📦 = Imported</div>
            </div>
        </div>`;

        // ⚒️ Actions section (toll roads, petitions, orders, forage)
        if (isPlayerHere && typeof Player !== 'undefined') {
            var _actBtnStyle = 'font-size:0.8rem;padding:6px 14px;color:#e8dcc8;';
            html += `<div class="detail-section"><h3>⚒️ Actions</h3>`;
            html += `<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">`;
            html += `<button class="btn-medieval" data-action="showBuildRouteSelector" data-type="toll_road" style="${_actBtnStyle}background:rgba(180,140,50,0.15);border-color:rgba(180,140,50,0.4);">
                \uD83D\uDEE4\uFE0F Build Toll Road
            </button>`;
            if (town.isPort) {
                html += `<button class="btn-medieval" data-action="showBuildRouteSelector" data-type="sea_route" style="${_actBtnStyle}background:rgba(0,180,200,0.15);border-color:rgba(0,180,200,0.4);">
                    \u2693 Build Sea Route
                </button>`;
            }
            html += `<button class="btn-medieval" data-action="showBuildRouteSelector" data-type="petition" style="${_actBtnStyle}background:rgba(255,215,0,0.15);border-color:rgba(255,215,0,0.4);">
                \uD83D\uDC51 Petition King for Road
            </button>`;
            if (typeof Player !== 'undefined' && Player.isPlayerCitizenOf && Player.citizenshipKingdomId) {
                html += `<button class="btn-medieval" data-action="showPetitionsPanel" style="${_actBtnStyle}background:rgba(212,160,23,0.15);border-color:rgba(212,160,23,0.4);">
                    📜 Petitions
                </button>`;
            }
            if (typeof Player !== 'undefined' && Player.isPlayerCitizenOf && Player.isPlayerCitizenOf(town.kingdomId)) {
                html += `<button class="btn-medieval" data-action="showKingdomOrdersPanel" data-id="${town.kingdomId}" style="${_actBtnStyle}background:rgba(180,120,200,0.15);border-color:rgba(180,120,200,0.4);">
                    📋 Kingdom Orders
                </button>`;
            }
            var forageText = '\uD83C\uDF3F Forage Nearby';
            if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('soil_knowledge')) {
                var tfert = town.soilFertilityRating != null ? town.soilFertilityRating : (town.soilFertility != null ? Math.round(town.soilFertility * 50) : 50);
                var tchance = Math.round(10 + (tfert / 100) * 70);
                forageText = '\uD83C\uDF3F Forage Nearby (' + tchance + '% chance)';
            }
            html += '<button class="btn-medieval" data-action="forageNearby" style="' + _actBtnStyle + 'background:rgba(85,168,104,0.15);border-color:rgba(85,168,104,0.3);">';
            html += forageText;
            html += '</button>';
            html += `</div></div>`;
        }

        // Kingdom trade panel — sell directly to kingdom
        if (isPlayerHere && pop > 0 && typeof Player !== 'undefined' && Player.getKingdomBuyInfo) {
            html += `<div class="detail-section"><h3>🏛️ Sell to Kingdom</h3>`;
            html += `<button class="btn-action" data-action="showKingdomTradePanel" data-id="${town.kingdomId}">🏛️ Open Kingdom Trade</button>`;
            html += `</div>`;
        }
    } else if (town.market && town.market.prices && !canSeePrices && showStale && rememberedData && !town.isOutpost) {
        // STALE REMEMBERED PRICES — from player's last visit
        html += `<div class="detail-section">
            <h3 data-collapse-id="market-prices-remembered" style="cursor:pointer;user-select:none;" data-action="_toggleCollapse">📊 Market Prices <span style="color:#c9a84c;font-size:0.7rem;">(Remembered)</span> <span class="collapse-arrow" style="font-size:0.7rem;opacity:0.6;">${_townPanelExpandedSections['market-prices-remembered'] ? '▼' : '▶'}</span></h3>
            <div style="display:${_townPanelExpandedSections['market-prices-remembered'] ? '' : 'none'};">`;
        html += `<div style="background:rgba(200,160,50,0.1);border:1px solid #5a4a20;border-radius:4px;padding:6px 8px;margin-bottom:8px;">
            <span style="color:#c9a84c;font-size:0.8rem;">⚠️ These prices are from <strong>${rememberedData.daysAgo} day${rememberedData.daysAgo !== 1 ? 's' : ''} ago</strong> (Day ${rememberedData.day}). Actual prices may have changed. Learn <b>Trade Network</b> or <b>Global Trade Intel</b> to see current prices.</span>
        </div>`;
        html += `<table class="price-table"><tr><th>Item</th><th>Price (old)</th><th>Supply (old)</th></tr>`;
        var stalePrices = rememberedData.prices || {};
        var staleSupply = rememberedData.supply || {};
        for (var srId in stalePrices) {
            var sRes = findResource(srId);
            if (!sRes) continue;
            html += `<tr><td>${sRes.icon} ${sRes.name}</td><td style="color:#c9a84c;">${stalePrices[srId]}g</td><td style="color:#888;">~${Math.floor(staleSupply[srId] || 0)}</td></tr>`;
        }
        html += `</table></div></div>`;
    } else if (town.market && town.market.prices && !canSeePrices && !town.isOutpost) {
        html += `<div class="detail-section"><h3>📊 Market Prices</h3>
            <div class="text-dim" style="font-size:0.8rem;">🔒 You need to visit this town or learn <b>Market Scout</b>, <b>Trade Network</b>, or <b>Global Trade Intel</b> skills to see remote prices. Prices from towns you've visited in the last 90 days will also appear here.</div>
        </div>`;
    }

    // Natural resource deposits
    if (town.naturalDeposits && typeof Engine.getTownDeposits === 'function') {
        const deposits = Engine.getTownDeposits(town.id);
        if (deposits && Object.keys(deposits).length > 0) {
            html += `<div class="detail-section"><h3>⛏️ Natural Deposits</h3>`;
            for (const [resId, info] of Object.entries(deposits)) {
                const res = info.isWoodGrove ? null : findResource(resId);
                const icon = info.isWoodGrove ? '🌲' : (res ? res.icon : '🪨');
                const name = info.isWoodGrove ? info.groveName : (res ? res.name : resId);
                const pct = info.pct;
                const barColor = pct > 50 ? '#55a868' : pct > 20 ? '#ccb974' : pct > 0 ? '#c44e52' : '#555';
                const label = pct <= 0 ? 'Exhausted' : info.renewable ? pct + '% (renewable)' : pct + '%';
                html += `<div class="detail-row">
                    <span class="label">${icon} ${name}</span>
                    <span class="value"><div class="bar-small" style="width:80px;"><div class="bar-small-fill" style="width:${pct}%;background:${barColor}"></div></div> <span style="font-size:0.7rem;color:${barColor}">${label}</span></span>
                </div>`;
            }
            if (town.soilFertility != null && typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('soil_knowledge')) {
                const sfRating = town.soilFertilityRating != null ? town.soilFertilityRating : Math.round(town.soilFertility * 50);
                const sfPct = Math.min(100, sfRating);
                const sfColor = sfPct > 70 ? '#55a868' : sfPct > 40 ? '#ccb974' : '#c44e52';
                html += `<div class="detail-row">
                    <span class="label">🌾 Soil Fertility</span>
                    <span class="value"><div class="bar-small" style="width:80px;"><div class="bar-small-fill" style="width:${sfPct}%;background:${sfColor}"></div></div> <span style="font-size:0.7rem;color:${sfColor}">${sfPct}/100</span></span>
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
                        trackBtn = ' <button class="btn-medieval" style="font-size:0.65rem;padding:1px 6px;' + (isTracked ? 'background:var(--gold);color:#000;' : '') + '" data-action="toggleTrackMerchant" data-id="' + em.id + '" data-tracked="' + (isTracked ? 'true' : 'false') + '">' + (isTracked ? '⭐ Untrack' : '☆ Track') + '</button>';
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

    // Travel button — show when player is not in this town (including while traveling or stopped on road)
    if (!isPlayerHere) {
        // Route info preview — use nearest town to current position if no townId
        var _routeOriginId = (typeof Player !== 'undefined') ? Player.townId : null;
        if (!_routeOriginId && typeof Player !== 'undefined' && Player.getPlayerWorldPosition) {
            var _rPos = Player.getPlayerWorldPosition();
            if (_rPos) {
                var _rTowns = Engine.getTowns();
                var _rNearest = Infinity;
                for (var _ri = 0; _ri < _rTowns.length; _ri++) {
                    var _rd = Math.hypot(_rTowns[_ri].x - _rPos.x, _rTowns[_ri].y - _rPos.y);
                    if (_rd < _rNearest) { _rNearest = _rd; _routeOriginId = _rTowns[_ri].id; }
                }
            }
        }
        if (typeof Engine !== 'undefined' && Engine.findPath && _routeOriginId && _routeOriginId !== town.id) {
            try {
                const route = Engine.findPath(_routeOriginId, town.id);
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

        var _isTraveling = typeof Player !== 'undefined' && Player.traveling;
        var _travelLabel = _isTraveling ? '🔄 Redirect Travel' : '🗺️ Travel Options';
        html += `<div class="text-center mt-sm">
            <button class="btn-medieval" data-action="openTravelOptions" data-id="${town.id}" style="font-size:0.85rem;padding:8px 24px;">
                ${_travelLabel}
            </button>`;

        html += `</div>`;
    }

    // Advise the King button (if player has sway in this kingdom)
    if (isPlayerHere && typeof Player !== 'undefined' && Player.royalAdvisorBenefits &&
        Player.royalAdvisorBenefits.swayOverKing && Player.royalAdvisorKingdomId === town.kingdomId) {
        html += `<div class="text-center mt-sm">
            <button class="btn-medieval" data-action="openAdviseKingDialog" data-id="${town.kingdomId}" style="font-size:0.85rem;padding:8px 24px;background:rgba(255,215,0,0.15);border-color:rgba(255,215,0,0.4);">
                👑 Advise the King (${Player.politicalCapital || 0} uses left)
            </button>
            <button class="btn-medieval" data-action="openAdviseKingDirectDialog" data-id="${town.kingdomId}" style="font-size:0.85rem;padding:8px 24px;background:rgba(100,150,255,0.15);border-color:rgba(100,150,255,0.4);margin-left:4px;">
                📜 Royal Counsel
            </button>
            <button class="btn-medieval" data-action="openProposeLawsDialog" data-id="${town.kingdomId}" style="font-size:0.85rem;padding:8px 24px;background:rgba(150,100,255,0.15);border-color:rgba(150,100,255,0.4);margin-left:4px;">
                ⚖️ Propose Laws
            </button>
        </div>`;
    }

    // King's Commission button (if player is Minor Noble+ in this kingdom)
    if (isPlayerHere && typeof Player !== 'undefined' && Player.state && Player.state.socialRank &&
        (Player.state.socialRank[town.kingdomId] || 0) >= 4) {
        var _comm = Player.getActiveKingCommission ? Player.getActiveKingCommission(town.kingdomId) : null;
        var _commLabel = _comm ? (_comm.status === 'pending' ? '⚠️ New Commission!' : (_comm.status === 'accepted' ? '📦 Active Commission' : '👑 Commission')) : '👑 King\'s Commission';
        var _commColor = _comm && _comm.status === 'pending' ? 'rgba(255,165,0,0.15)' : 'rgba(200,200,200,0.1)';
        html += `<div class="text-center mt-sm">
            <button class="btn-medieval" data-action="openKingCommissionDialog" data-id="${town.kingdomId}" style="font-size:0.85rem;padding:8px 24px;background:${_commColor};border-color:rgba(255,215,0,0.3);">
                ${_commLabel}
            </button>
        </div>`;
    }

    // Kingdom Building Construction button (Lords in their town, RAs in any town)
    if (isPlayerHere && typeof Player !== 'undefined' && Player.state && Player.state.socialRank &&
        (Player.state.socialRank[town.kingdomId] || 0) >= 5) {
        var _canBuild = false;
        var _playerRank = Player.state.socialRank[town.kingdomId] || 0;
        if (_playerRank >= 6) _canBuild = true; // RA can build anywhere
        else if (_playerRank >= 5 && Player.state.lordTownId === town.id) _canBuild = true; // Lord only in own town
        if (_canBuild) {
            html += `<div class="text-center mt-sm">
                <button class="btn-medieval" data-action="openKingdomBuildDialog" data-id="${town.id}" data-val="${town.kingdomId}" style="font-size:0.85rem;padding:8px 24px;background:rgba(100,200,150,0.15);border-color:rgba(100,200,150,0.4);">
                    🏗️ Kingdom Construction
                </button>
            </div>`;
        }
    }

    // King's Favor button (if RA with pending favor)
    if (isPlayerHere && typeof Player !== 'undefined' && Player.getKingFavor) {
        var _favor = Player.getKingFavor(town.kingdomId);
        if (_favor) {
            html += `<div class="text-center mt-sm">
                <button class="btn-medieval" data-action="openKingFavorDialog" data-id="${town.kingdomId}" style="font-size:0.85rem;padding:8px 24px;background:rgba(255,200,50,0.2);border-color:rgba(255,200,50,0.5);animation:pulse 2s infinite;">
                    👑 King's Request (Respond!)
                </button>
            </div>`;
        }
    }
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
                    // Calculate total cost including materials from market
                    var _rbMats = CONFIG.BRIDGE_REPAIR_MATERIALS || { wood: 20, stone: 10 };
                    var _rbGoldCost = CONFIG.BRIDGE_REBUILD_COST || 1000;
                    var _rbMatCost = 0;
                    var _rbMatDesc = '';
                    try {
                        var _rbTown = Engine.findTown(town.id);
                        var _rbMarket = _rbTown && _rbTown.market ? _rbTown.market : null;
                        for (var _rbm in _rbMats) {
                            var _rbNeed = _rbMats[_rbm] - ((typeof Player !== 'undefined' && Player.state.inventory[_rbm]) || 0);
                            if (_rbNeed > 0 && _rbMarket && _rbMarket.prices) {
                                var _rbPrice = _rbMarket.prices[_rbm] || 0;
                                _rbMatCost += _rbNeed * _rbPrice;
                            }
                        }
                    } catch(e) {}
                    var _rbTotal = _rbGoldCost + _rbMatCost;
                    var _rbCostLabel = _rbMatCost > 0 ? `🔧 Rebuild (~${_rbTotal}g incl. materials)` : `🔧 Rebuild (${_rbGoldCost}g)`;
                    html += `<div style="font-size:0.8rem;color:#c44e52;margin-bottom:4px;">❌ Bridge to ${otherName} — DESTROYED `;
                    html += `<button class="btn-medieval" data-action="rebuildBridge" data-idx="${idx}" style="font-size:0.7rem;padding:3px 8px;">${_rbCostLabel}</button></div>`;
                } else {
                    html += `<div style="font-size:0.8rem;color:#55a868;margin-bottom:4px;">🌉 Bridge to ${otherName} — intact `;
                    html += `<button class="btn-medieval" data-action="destroyBridge" data-idx="${idx}" style="font-size:0.7rem;padding:3px 8px;background:rgba(200,60,50,0.35);border-color:rgba(200,60,50,0.6);color:#f0d0a0;">💣 Destroy</button></div>`;
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
        html += UI.buildNPCTransportSection();
    }

    // Town contextual treatment card (when player is here and injured/sick)
    if (isPlayerHere && typeof Player !== 'undefined') {
        var _isSick = Player.illnesses && Player.illnesses.length > 0;
        var _isInjured = Player.injuries && Player.injuries.length > 0;
        if (_isSick || _isInjured) {
            html = '<div class="town-actions-card"><button class="town-action-btn highlight" data-action="seekTreatment"><span class="ta-icon">🏥</span>Treatment</button></div>' + html;
        }
    }

    showRightPanel(`🏘 ${town.name}`, html);
    // Make the panel title clickable to pan camera to this town
    if (_rpTitleEl() && town.x != null && town.y != null) {
        _rpTitleEl().style.cursor = 'pointer';
        _rpTitleEl().title = 'Click to center view on ' + town.name;
        _rpTitleEl().addEventListener('click', function() {
            if (typeof Renderer !== 'undefined' && Renderer.panTo) {
                Renderer.panTo(town.x, town.y);
            }
        });
    }
}

function showKingdomDetail(kingdom) {
    if (!kingdom) return;
    UI._rightPanelTownId = null;
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
            <span class="value">${kingName}</span></div>`;

    // King travel status
    if (kingdom.kingTravel) {
        var _ktTrip = kingdom.kingTravel;
        var _ktDestName = '...';
        try {
            var _ktDest = Engine.findTown(_ktTrip.currentDestId);
            if (_ktDest) _ktDestName = _ktDest.name;
        } catch(e) {}
        var _ktTypeLabel = _ktTrip.type === 'progress' ? '🛤️ Royal Progress' :
                           _ktTrip.type === 'diplomatic' ? '🌍 Diplomatic Visit' : '↩️ Returning';
        var _ktPhaseLabel = _ktTrip.phase === 'traveling' ? 'Traveling to ' + _ktDestName :
                            _ktTrip.phase === 'visiting' ? 'Visiting ' + _ktDestName :
                            'Returning home';
        html += '<div class="detail-row"><span class="label">Status</span><span class="value" style="color:#FFD700;">' + _ktTypeLabel + ' — ' + _ktPhaseLabel + '</span></div>';
    }

    html += `<div class="detail-row"><span class="label">Culture</span>
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
            const isWar = kingdom.atWar && (kingdom.atWar.has ? kingdom.atWar.has(kId) : kingdom.atWar.includes(kId));
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
            html += `<div class="detail-row" style="cursor:pointer" data-action="clickTown" data-id="${t.id}">
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


    // Kingdom Trade Requests (street-trade style — per item, any qty)
    if (typeof Player !== 'undefined' && Player.getKingdomTradeRequests) {
        var kTradeRequests = [];
        try { kTradeRequests = Player.getKingdomTradeRequests() || []; } catch(e) {}
        var _playerTown = null;
        try { _playerTown = Engine.findTown(Player.townId); } catch(e) {}
        var _inThisKingdom = _playerTown && _playerTown.kingdomId === kingdom.id && !Player.traveling;

        html += '<div class="detail-section"><h3>🏪 Kingdom Trade</h3>';
        if (!_inThisKingdom) {
            html += '<div style="font-size:0.78rem;color:var(--text-dim);">Visit a town in this kingdom to trade with the crown.</div>';
        } else if (kTradeRequests.length === 0) {
            html += '<div style="font-size:0.78rem;color:var(--text-dim);">The kingdom has no trade requests right now. Check back in a week.</div>';
        } else {
            html += '<div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:6px;">The crown wants these goods. Sell for gold (+0.001 rep/item) or donate (+0.01 rep/item).</div>';
            for (var _kti = 0; _kti < kTradeRequests.length; _kti++) {
                var _kr = kTradeRequests[_kti];
                var _krHeld = (Player.inventory[_kr.resourceId] || 0);
                var _krHasAny = _krHeld > 0;
                var _krPremPct = _kr.marketPrice > 0 ? Math.round(((_kr.pricePerUnit - _kr.marketPrice) / _kr.marketPrice) * 100) : 0;
                var _krPremColor = _krPremPct >= 0 ? '#55a868' : '#c44e52';
                html += '<div style="background:rgba(255,215,0,0.06);padding:8px;border-radius:5px;margin-bottom:6px;border-left:3px solid rgba(255,215,0,0.3);">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                html += '<span style="font-size:0.8rem;"><strong>' + (_kr.resourceIcon || '') + ' ' + _kr.resourceName + '</strong>';
                html += ' — <span style="color:#ffd700;">' + _kr.pricePerUnit + 'g each</span>';
                html += ' <span style="color:' + _krPremColor + ';font-size:0.72rem;font-weight:bold;">(' + (_krPremPct >= 0 ? '+' : '') + _krPremPct + '%)</span></span>';
                html += '<span style="font-size:0.72rem;color:var(--text-dim);">You have: ' + _krHeld + '</span>';
                html += '</div>';
                html += '<div style="font-size:0.68rem;color:var(--text-dim);margin:2px 0;">' + (_kr.desc || '') + '</div>';
                html += '<div style="display:flex;gap:4px;align-items:center;margin-top:4px;flex-wrap:wrap;">';
                // Qty buttons: 1, 5, 10, All
                var _qtyOpts = [1, 5, 10];
                for (var _qi = 0; _qi < _qtyOpts.length; _qi++) {
                    var _q = _qtyOpts[_qi];
                    var _canQ = _krHeld >= _q;
                    html += '<button class="btn btn-sm" style="font-size:0.65rem;padding:1px 5px;" ' + (_canQ ? '' : 'disabled') + ' data-action="sellToKingdomRequest" data-id="' + _kti + '" data-val="' + _q + '" data-kingdom="' + kingdom.id + '">💰 Sell ' + _q + '</button>';
                }
                html += '<button class="btn btn-sm" style="font-size:0.65rem;padding:1px 5px;" ' + (_krHasAny ? '' : 'disabled') + ' data-action="sellToKingdomRequest" data-id="' + _kti + '" data-val="' + _krHeld + '" data-kingdom="' + kingdom.id + '">💰 Sell All</button>';
                html += '<span style="color:rgba(255,255,255,0.15);">|</span>';
                for (var _di = 0; _di < _qtyOpts.length; _di++) {
                    var _dq = _qtyOpts[_di];
                    var _canDq = _krHeld >= _dq;
                    html += '<button class="btn btn-sm" style="font-size:0.65rem;padding:1px 5px;" ' + (_canDq ? '' : 'disabled') + ' data-action="donateToKingdomGoods" data-id="' + _kti + '" data-val="' + _dq + '" data-kingdom="' + kingdom.id + '">🎁 Donate ' + _dq + '</button>';
                }
                html += '<button class="btn btn-sm" style="font-size:0.65rem;padding:1px 5px;" ' + (_krHasAny ? '' : 'disabled') + ' data-action="donateToKingdomGoods" data-id="' + _kti + '" data-val="' + _krHeld + '" data-kingdom="' + kingdom.id + '">🎁 Donate All</button>';
                html += '</div></div>';
            }
        }
        html += '</div>';
    }

    // Royal Commissions & Orders (inline summary)
    var _commissions = [];
    try { _commissions = Engine.getRoyalCommissions(kingdom.id) || []; } catch(e) {}
    var _openComms = _commissions.filter(function(c) { return c.status === 'open'; });

    var _proc = kingdom.procurement || {};
    var _openOrders = (_proc.orders || []).filter(function(o) { return o.status === 'open'; });

    if (_openComms.length > 0 || _openOrders.length > 0) {
        html += '<div class="detail-section"><h3>📋 Active Commissions & Orders</h3>';

        if (_openComms.length > 0) {
            html += '<div style="font-size:0.78rem;font-weight:bold;margin-bottom:4px;">📦 Commissions (' + _openComms.length + ')</div>';
            for (var _cci = 0; _cci < Math.min(_openComms.length, 3); _cci++) {
                var _cc = _openComms[_cci];
                var _ccDaysLeft = _cc.expiresDay - (Engine.getDay ? Engine.getDay() : 0);
                html += '<div style="font-size:0.75rem;padding:4px 6px;background:rgba(255,215,0,0.06);border-radius:4px;margin-bottom:3px;">';
                html += '📜 ' + _cc.description;
                html += ' <span style="color:#ffd700;">💰' + _cc.reward + 'g</span>';
                html += ' <span style="color:#6bff6b;">⭐+' + _cc.repReward + '</span>';
                html += ' <span class="text-dim">⏳' + _ccDaysLeft + 'd</span>';
                html += '</div>';
            }
            if (_openComms.length > 3) {
                html += '<div style="font-size:0.72rem;color:var(--text-dim);">+' + (_openComms.length - 3) + ' more...</div>';
            }
            html += '<button class="btn btn-sm" style="font-size:0.72rem;padding:2px 8px;margin-top:3px;" data-action="openRoyalCommissionsPanel" data-id="' + kingdom.id + '">View All Commissions</button>';
        }

        if (_openOrders.length > 0) {
            html += '<div style="font-size:0.78rem;font-weight:bold;margin:6px 0 4px 0;">📋 Orders (' + _openOrders.length + ')</div>';
            for (var _ooi = 0; _ooi < Math.min(_openOrders.length, 3); _ooi++) {
                var _oo = _openOrders[_ooi];
                var _ooRes = null;
                try { _ooRes = typeof findResource !== 'undefined' ? findResource(_oo.resourceId) : null; } catch(e) {}
                if (!_ooRes) try { _ooRes = RESOURCE_TYPES[_oo.resourceId]; } catch(e) {}
                var _ooName = _ooRes ? _ooRes.name : _oo.resourceId;
                html += '<div style="font-size:0.75rem;padding:4px 6px;background:rgba(180,120,200,0.08);border-radius:4px;margin-bottom:3px;">';
                html += '📦 ' + _oo.qty + ' ' + _ooName;
                html += ' <span style="color:#ffd700;">≤' + _oo.maxPricePerUnit + 'g/ea</span>';
                html += ' <span class="text-dim">Bids: ' + (_oo.bids ? _oo.bids.length : 0) + '</span>';
                html += '</div>';
            }
            if (_openOrders.length > 3) {
                html += '<div style="font-size:0.72rem;color:var(--text-dim);">+' + (_openOrders.length - 3) + ' more...</div>';
            }
            html += '<button class="btn btn-sm" style="font-size:0.72rem;padding:2px 8px;margin-top:3px;" data-action="showKingdomOrdersPanel" data-id="' + kingdom.id + '">View All Orders</button>';
        }

        html += '</div>';
    }

    // Donation to kingdom
    var playerRep = (typeof Player !== 'undefined' && Player.reputation) ? (Player.reputation[kingdom.id] || 50) : 50;
    var playerGold = (typeof Player !== 'undefined') ? (Player.gold || 0) : 0;
    var canDonate = playerGold >= 500;
    html += `<div class="detail-section"><h3>💰 Donate to Kingdom</h3>
        <div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:6px;">
            Your Reputation: ${playerRep}/100 &nbsp;|&nbsp; 500g per +1 rep
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-sm" style="font-size:0.75rem;" ${canDonate ? '' : 'disabled'} data-action="donateToKingdomGold" data-id="${kingdom.id}" data-val="1">Donate 500g (+1)</button>
            <button class="btn btn-sm" style="font-size:0.75rem;" ${playerGold >= 2500 ? '' : 'disabled'} data-action="donateToKingdomGold" data-id="${kingdom.id}" data-val="5">Donate 2,500g (+5)</button>
            <button class="btn btn-sm" style="font-size:0.75rem;" ${playerGold >= 5000 ? '' : 'disabled'} data-action="donateToKingdomGold" data-id="${kingdom.id}" data-val="10">Donate 5,000g (+10)</button>
        </div>
    </div>`;

    showRightPanel(`👑 ${kingdom.name}`, html);
}

function showPersonDetail(person) {
    UI._rightPanelTownId = null;
    if (!person) return;
    if (typeof person === 'string') {
        person = Engine.getPerson(person);
        if (!person) return;
    }
    UI._selectedPersonId = person.id;
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
    var _npcPortrait = (typeof Player !== 'undefined' && Player.getPersonPortrait) ? Player.getPersonPortrait(person) : '';
    let html = `<div class="detail-section">`;
    if (!isAlive) {
        html += `<div style="text-align:center;padding:8px;margin-bottom:8px;background:rgba(200,60,60,0.15);border:1px solid rgba(200,60,60,0.3);border-radius:6px;color:#c85050;font-weight:bold;">💀 Deceased</div>`;
    }
    if (_npcPortrait) {
        html += `<div style="text-align:center;margin-bottom:6px;"><span style="font-size:2.5rem;${!isAlive ? 'opacity:0.5;' : ''}">${_npcPortrait}</span></div>`;
    }
    html += `<div class="detail-row"><span class="label">Name</span>
            <span class="value">${person.firstName || ''} ${person.lastName || ''}${!isAlive ? ' <span style="color:#c85050;">(deceased)</span>' : ''}</span></div>
        <div class="detail-row"><span class="label">Age</span>
            <span class="value">${person.age || '?'}${!isAlive ? ' (at death)' : ''}</span></div>
        <div class="detail-row"><span class="label">Sex</span>
            <span class="value">${person.sex === 'M' ? '♂ Male' : person.sex === 'F' ? '♀ Female' : '?'}</span></div>`;
    var _npcSR = Player.getNPCSocialRank ? Player.getNPCSocialRank(person) : 0;
    var _npcSRDef = CONFIG.SOCIAL_RANKS[_npcSR] || CONFIG.SOCIAL_RANKS[0];
    html += `<div class="detail-row"><span class="label">Social Rank</span>
            <span class="value">${_npcSRDef.icon || ''} ${_npcSRDef.name || 'Peasant'}</span></div>`;
    html += `<div class="detail-row"><span class="label">Occupation</span>
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
    if (person._playerHorse) {
        html += `<div class="detail-row"><span class="label">Horse</span>
            <span class="value">🐴 Has your horse</span></div>`;
    }
    if (person._workerTraveling) {
        var _wtDest = null;
        try { _wtDest = Engine.findTown(person._workerTraveling.toTownId); } catch(e) {}
        var _wtDaysLeft = Math.max(0, (person._workerTraveling.arrivalDay || 0) - (Engine.getDay ? Engine.getDay() : 0));
        html += `<div class="detail-row"><span class="label">Status</span>
            <span class="value" style="color:#d4a017;">📍 Traveling to ${_wtDest ? _wtDest.name : '?'} (~${_wtDaysLeft} days left)</span></div>`;
    }
    html += `</div>`;

    // ── Elite Merchant Info ──
    if (person.isEliteMerchant) {
        html += `<div class="detail-section"><h3>⭐ Elite Merchant</h3>`;
        if (person.heraldry) {
            var hColors = (person.heraldry.colors || ['#888','#444']);
            html += `<div class="detail-row"><span class="label">House</span>
                <span class="value"><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:linear-gradient(90deg,${hColors[0]} 50%,${hColors[1]} 50%);vertical-align:middle;margin-right:4px;border:1px solid #555;"></span>${person.heraldry.symbol || ''} ${person.heraldry.name || 'Unknown'}</span></div>`;
        }
        if (person.strategy) {
            var stratLabel = person.strategy.charAt(0).toUpperCase() + person.strategy.slice(1);
            html += `<div class="detail-row"><span class="label">Strategy</span>
                <span class="value">🎯 ${stratLabel}</span></div>`;
        }
        if (person.emCaravans && person.emCaravans.length > 0) {
            html += `<div class="detail-row"><span class="label">Caravans</span>
                <span class="value">🐪 ${person.emCaravans.length} active</span></div>`;
        }
        if (person.npcMerchantInventory) {
            var invKeys = Object.keys(person.npcMerchantInventory);
            var invCount = 0;
            for (var ik = 0; ik < invKeys.length; ik++) invCount += (person.npcMerchantInventory[invKeys[ik]] || 0);
            if (invCount > 0) {
                html += `<div class="detail-row"><span class="label">Inventory</span>
                    <span class="value">📦 ${invCount} goods (${invKeys.length} types)</span></div>`;
            }
        }
        // Track/untrack button
        if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('merchant_tracker')) {
            var isTrackedEM = Player.isTrackingMerchant && Player.isTrackingMerchant(person.id);
            html += `<div style="margin-top:6px;">`;
            if (isTrackedEM) {
                html += `<button class="btn-medieval" style="font-size:0.75rem;padding:4px 10px;" data-action="untrackMerchantPerson" data-id="${person.id}">⭐ Stop Tracking</button>`;
            } else {
                html += `<button class="btn-medieval" style="font-size:0.75rem;padding:4px 10px;" data-action="trackMerchantPerson" data-id="${person.id}">☆ Track Merchant</button>`;
            }
            html += `</div>`;
        }
        // ── EM Trade & Deals buttons ──
        if (isInSameTown && isAlive && isPlayer) {
            var _emTradeRel = Player.getRelationship ? Player.getRelationship(person.id) : { level: 0 };
            var _emRelLvl = _emTradeRel.level || 0;
            var _emDiscount = Math.min(10, Math.floor(_emRelLvl / 10));
            html += `<div style="margin-top:8px;padding:8px;background:rgba(100,180,255,0.08);border:1px solid rgba(100,180,255,0.25);border-radius:6px;">`;
            html += `<div style="font-size:0.82rem;font-weight:bold;color:#6ab4ff;margin-bottom:4px;">💼 Trade with ${person.firstName}</div>`;
            html += `<div style="font-size:0.68rem;color:#888;margin-bottom:6px;">Relationship: ${_emRelLvl}/100 | Discount: ${_emDiscount}%</div>`;
            html += `<div style="display:flex;flex-wrap:wrap;gap:4px;">`;
            html += `<button class="btn-medieval" data-action="openEMTrade" data-id="${person.id}" style="font-size:0.72rem;padding:4px 10px;background:rgba(100,180,255,0.15);border-color:rgba(100,180,255,0.3);">🛒 Trade Goods</button>`;
            html += `<button class="btn-medieval" data-action="openEMDeals" data-id="${person.id}" style="font-size:0.72rem;padding:4px 10px;background:rgba(100,180,255,0.15);border-color:rgba(100,180,255,0.3);">🤝 Deals</button>`;
            html += `</div></div>`;
        }
        // ── Elite Merchant Favors ──
        if (isInSameTown && isPlayer && Player.getRelationship) {
            var _emFavRel = Player.getRelationship(person.id);
            if (_emFavRel.level >= 60) {
                var _emFavCooldown = person._playerFavorCooldown || 0;
                var _emFavDay = typeof Engine !== 'undefined' && Engine.getDay ? Engine.getDay() : 0;
                var _emFavReady = _emFavDay >= _emFavCooldown;
                html += `<div style="margin-top:8px;padding:8px;background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.25);border-radius:6px;">`;
                html += `<div style="font-size:0.82rem;font-weight:bold;color:#ffa500;margin-bottom:4px;">🤝 Ask a Favor</div>`;
                if (!_emFavReady) {
                    var _emFavWait = _emFavCooldown - _emFavDay;
                    html += `<div style="font-size:0.72rem;color:#888;">⏳ Cooldown: ${_emFavWait} day${_emFavWait !== 1 ? 's' : ''} remaining</div>`;
                } else {
                    html += `<div style="font-size:0.7rem;color:#aaa;margin-bottom:4px;">Requires 60+ relationship. 30-day cooldown after a favor.</div>`;
                    html += `<div style="display:flex;flex-wrap:wrap;gap:4px;">`;
                    html += `<button class="btn-medieval" data-action="emFavorStrategy" data-id="${person.id}" style="font-size:0.72rem;padding:4px 8px;background:rgba(255,165,0,0.15);border-color:rgba(255,165,0,0.3);">🎯 Change Strategy</button>`;
                    html += `<button class="btn-medieval" data-action="emFavorKingdom" data-id="${person.id}" style="font-size:0.72rem;padding:4px 8px;background:rgba(255,165,0,0.15);border-color:rgba(255,165,0,0.3);">👑 Switch Kingdom</button>`;
                    html += `<button class="btn-medieval" data-action="emFavorFocus" data-id="${person.id}" style="font-size:0.72rem;padding:4px 8px;background:rgba(255,165,0,0.15);border-color:rgba(255,165,0,0.3);">📦 Focus on Good</button>`;
                    html += `</div>`;
                }
                html += `</div>`;
            }
        }
        html += `</div>`;
    }

    // ── Noble/EM Assets (requires noble_assets skill) ──
    if (isPlayer && Player.hasSkill && Player.hasSkill('noble_assets') && (_npcSR >= 4 || person.isEliteMerchant)) {
        var _nfs = null;
        try { if (Engine.getNobleFinancialStatus) _nfs = Engine.getNobleFinancialStatus(person.id); } catch(e) {}
        html += `<div class="detail-section"><h3>🏠 Assets & Income</h3>`;

        // Treasury and financial status
        if (_nfs) {
            var _stressColor = _nfs.stressed ? '#c44e52' : '#55a868';
            var _stressLabel = _nfs.stressed ? '💸 Financially Stressed' : '💰 Stable';
            html += `<div class="detail-row"><span class="label">Treasury</span>
                <span class="value">${Math.floor(_nfs.gold)}g</span></div>`;
            html += `<div class="detail-row"><span class="label">Status</span>
                <span class="value" style="color:${_stressColor};font-size:0.8rem;">${_stressLabel}</span></div>`;
        }

        // Building holdings with per-building income
        if (_nfs && _nfs.buildingDetails && _nfs.buildingDetails.length > 0) {
            html += `<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border-color);">`;
            html += `<div style="font-size:0.75rem;font-weight:600;margin-bottom:4px;">🏗️ Property Holdings (${_nfs.buildings} buildings)</div>`;
            // Group by town
            var _bldByTown = {};
            for (var _bdi = 0; _bdi < _nfs.buildingDetails.length; _bdi++) {
                var _bd = _nfs.buildingDetails[_bdi];
                if (!_bldByTown[_bd.townName]) _bldByTown[_bd.townName] = [];
                _bldByTown[_bd.townName].push(_bd);
            }
            for (var _tn in _bldByTown) {
                var _townBlds = _bldByTown[_tn];
                var _townTotal = 0;
                for (var _tbi = 0; _tbi < _townBlds.length; _tbi++) _townTotal += _townBlds[_tbi].incomePer10;
                html += `<div class="detail-row" style="margin-top:4px;"><span class="label">📍 ${_tn}</span>
                    <span class="value" style="color:#55a868;font-size:0.75rem;">+${_townTotal}g/10d</span></div>`;
                for (var _tbi2 = 0; _tbi2 < _townBlds.length; _tbi2++) {
                    html += `<div style="font-size:0.7rem;color:var(--text-muted);padding-left:16px;display:flex;justify-content:space-between;">` +
                        `<span>${_townBlds[_tbi2].name}</span><span style="color:#88aa77;">+${_townBlds[_tbi2].incomePer10}g</span></div>`;
                }
            }
            html += `</div>`;
        } else {
            html += `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">No known property holdings.</div>`;
        }

        // EM Caravans
        if (person.isEliteMerchant && person.emCaravans && person.emCaravans.length > 0) {
            html += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border-color);">`;
            html += `<div style="font-size:0.75rem;font-weight:600;margin-bottom:4px;">🐪 Trade Caravans (${person.emCaravans.length})</div>`;
            for (var _eci = 0; _eci < person.emCaravans.length; _eci++) {
                var _ec = person.emCaravans[_eci];
                var _ecFrom = '', _ecTo = '';
                try { var _ft = Engine.findTown(_ec.fromTownId); _ecFrom = _ft ? _ft.name : '?'; } catch(e) { _ecFrom = '?'; }
                try { var _tt = Engine.findTown(_ec.toTownId); _ecTo = _tt ? _tt.name : '?'; } catch(e) { _ecTo = '?'; }
                html += `<div style="font-size:0.7rem;color:var(--text-muted);padding-left:8px;">${_ecFrom} → ${_ecTo}</div>`;
            }
            html += `</div>`;
        }

        // Income & expense summary
        if (_nfs) {
            html += `<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border-color);">`;
            html += `<div style="font-size:0.75rem;font-weight:600;margin-bottom:4px;">📊 Income Summary (per 10 days)</div>`;
            if (_nfs.totalBuildingIncome > 0) {
                html += `<div class="detail-row"><span class="label">🏗️ Buildings</span>
                    <span class="value" style="color:#55a868;">+${_nfs.totalBuildingIncome}g</span></div>`;
            }
            if (_nfs.stipendPer10 > 0) {
                html += `<div class="detail-row"><span class="label">👑 Rank Stipend</span>
                    <span class="value" style="color:#55a868;">+${_nfs.stipendPer10}g</span></div>`;
            }
            if (_nfs.tradePer10 > 0) {
                html += `<div class="detail-row"><span class="label">🔄 Trade Network</span>
                    <span class="value" style="color:#55a868;">+${_nfs.tradePer10}g</span></div>`;
            }
            if (_nfs.expensePer10 > 0) {
                html += `<div class="detail-row"><span class="label">💸 Expenses</span>
                    <span class="value" style="color:#c44e52;">-${_nfs.expensePer10}g</span></div>`;
            }
            var _netPer10 = _nfs.netPer10 || 0;
            var _netColor2 = _netPer10 >= 0 ? '#55a868' : '#c44e52';
            var _netSign2 = _netPer10 >= 0 ? '+' : '';
            html += `<div class="detail-row" style="font-weight:600;border-top:1px solid var(--border-color);padding-top:4px;margin-top:4px;"><span class="label">Net Income</span>
                <span class="value" style="color:${_netColor2};">${_netSign2}${_netPer10}g / 10 days</span></div>`;
            html += `</div>`;
        }
        html += `</div>`;
    }

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

    // v9p33river79: relation-to-player badge (Mother / Father / Sister / Brother / Child / Spouse)
    var _playerRelationLabel = null;
    if (isPlayer) {
        if (isSpouse) _playerRelationLabel = 'Spouse';
        else if (Player.parentIds && Player.parentIds.indexOf(person.id) >= 0) _playerRelationLabel = (person.sex === 'M' ? 'Father' : 'Mother');
        else if (Player.childrenIds && Player.childrenIds.indexOf(person.id) >= 0) _playerRelationLabel = (person.sex === 'M' ? 'Son' : 'Daughter');
        else if (Player.familyMembers) {
            for (var _fmi = 0; _fmi < Player.familyMembers.length; _fmi++) {
                if (Player.familyMembers[_fmi].npcId === person.id) {
                    var _r = Player.familyMembers[_fmi].role;
                    _playerRelationLabel = _r ? (_r.charAt(0).toUpperCase() + _r.slice(1)) : null;
                    break;
                }
            }
        }
        // Fallback: if we share parent IDs with the player → sibling
        if (!_playerRelationLabel && Player.parentIds && person.parentIds) {
            for (var _ppi = 0; _ppi < person.parentIds.length; _ppi++) {
                if (Player.parentIds.indexOf(person.parentIds[_ppi]) >= 0) {
                    _playerRelationLabel = (person.sex === 'M' ? 'Brother' : 'Sister');
                    break;
                }
            }
        }
    }
    if (_playerRelationLabel) {
        html += `<div class="detail-row"><span class="label">To You</span>
            <span class="value" style="color:#d4af37;font-weight:bold;">💞 ${_playerRelationLabel}</span></div>`;
    }

    if (person.spouseId) {
        let spouse;
        // v9p33river79: handle 'player' as a spouseId
        if (person.spouseId === 'player' && isPlayer) {
            html += `<div class="detail-row"><span class="label">Spouse</span>
                <span class="value">${Player.firstName || ''} ${Player.lastName || ''} (You)</span></div>`;
        } else {
            try { spouse = Engine.getPerson(person.spouseId); } catch (e) { /* no-op */ }
            if (spouse) {
                var spBadge = spouse.isEliteMerchant ? '⭐ ' : '';
                html += `<div class="detail-row"><span class="label">Spouse</span>
                    <span class="value"><a href="#" style="color:var(--gold);text-decoration:underline;cursor:pointer;" data-action="showPersonLink" data-id="${spouse.id}">${spBadge}${spouse.firstName} ${spouse.lastName}</a></span></div>`;
            } else {
                html += `<div class="detail-row"><span class="label">Spouse</span>
                    <span class="value text-dim">Unknown</span></div>`;
            }
        }
    } else {
        html += `<div class="detail-row"><span class="label">Spouse</span>
            <span class="value text-dim">None</span></div>`;
    }
    if (person.parentIds && person.parentIds.length) {
        for (var ppi = 0; ppi < person.parentIds.length; ppi++) {
            var parent = null;
            try { parent = Engine.getPerson(person.parentIds[ppi]); } catch (e) { /* no-op */ }
            if (parent) {
                var parBadge = parent.isEliteMerchant ? '⭐ ' : '';
                var parAlive = parent.alive !== false ? '' : ' <span style="color:#888;font-size:0.75rem;">(deceased)</span>';
                html += `<div class="detail-row"><span class="label">${parent.sex === 'M' ? 'Father' : 'Mother'}</span>
                    <span class="value"><a href="#" style="color:var(--gold);text-decoration:underline;cursor:pointer;" data-action="showPersonLink" data-id="${parent.id}">${parBadge}${parent.firstName} ${parent.lastName}</a>${parAlive}</span></div>`;
            }
        }
    }
    if (person.childrenIds && person.childrenIds.length) {
        var _kidLabelDone = false;
        for (var cci = 0; cci < person.childrenIds.length; cci++) {
            var _cid = person.childrenIds[cci];
            // v9p33river79: render the player as a child when their id appears
            if (_cid === 'player' && isPlayer) {
                var _kidLabel = _kidLabelDone ? '' : (person.childrenIds.length === 1 ? 'Child' : 'Children');
                _kidLabelDone = true;
                var _pAge = Player.age || '?';
                html += `<div class="detail-row"><span class="label">${_kidLabel}</span>
                    <span class="value">${Player.firstName || ''} ${Player.lastName || ''} (${_pAge}) <span style="color:#d4af37;">— You</span></span></div>`;
                continue;
            }
            var child = null;
            try { child = Engine.getPerson(_cid); } catch (e) { /* no-op */ }
            if (child) {
                var chBadge = child.isEliteMerchant ? '⭐ ' : '';
                var chAlive = child.alive !== false ? '' : ' <span style="color:#888;font-size:0.75rem;">(deceased)</span>';
                var chLabel = _kidLabelDone ? '' : (person.childrenIds.length === 1 ? 'Child' : 'Children');
                _kidLabelDone = true;
                html += `<div class="detail-row"><span class="label">${chLabel}</span>
                    <span class="value"><a href="#" style="color:var(--gold);text-decoration:underline;cursor:pointer;" data-action="showPersonLink" data-id="${child.id}">${chBadge}${child.firstName} ${child.lastName}</a> (${child.age || '?'})${chAlive}</span></div>`;
            }
        }
    }
    // v9p33river79: siblings — derive from shared parent ids.
    if (person.parentIds && person.parentIds.length) {
        var _sibIds = {};
        for (var _spi = 0; _spi < person.parentIds.length; _spi++) {
            var _par;
            try { _par = Engine.getPerson(person.parentIds[_spi]); } catch (e) { _par = null; }
            if (!_par || !_par.childrenIds) continue;
            for (var _ci = 0; _ci < _par.childrenIds.length; _ci++) {
                var _sid = _par.childrenIds[_ci];
                if (_sid === person.id) continue;
                _sibIds[_sid] = true;
            }
        }
        var _sibList = Object.keys(_sibIds);
        if (_sibList.length > 0) {
            var _sibLabelDone = false;
            for (var _slI = 0; _slI < _sibList.length; _slI++) {
                var _sibId = _sibList[_slI];
                var _sibLabel = _sibLabelDone ? '' : (_sibList.length === 1 ? 'Sibling' : 'Siblings');
                _sibLabelDone = true;
                if (_sibId === 'player' && isPlayer) {
                    html += `<div class="detail-row"><span class="label">${_sibLabel}</span>
                        <span class="value">${Player.firstName || ''} ${Player.lastName || ''} (${Player.age || '?'}) <span style="color:#d4af37;">— You</span></span></div>`;
                    continue;
                }
                var _sib = null;
                try { _sib = Engine.getPerson(_sibId); } catch (e) { _sib = null; }
                if (_sib) {
                    var _sBadge = _sib.isEliteMerchant ? '⭐ ' : '';
                    var _sAlive = _sib.alive !== false ? '' : ' <span style="color:#888;font-size:0.75rem;">(deceased)</span>';
                    html += `<div class="detail-row"><span class="label">${_sibLabel}</span>
                        <span class="value"><a href="#" style="color:var(--gold);text-decoration:underline;cursor:pointer;" data-action="showPersonLink" data-id="${_sib.id}">${_sBadge}${_sib.firstName} ${_sib.lastName}</a> (${_sib.age || '?'})${_sAlive}</span></div>`;
                }
            }
        }
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

    // ── Companion Health & Treatment (spouse, family, guards) ──
    if (isPlayer && isAlive && isInSameTown) {
        var _isPlayerGuard = false;
        var _guardEntry = null;
        if (Player.guards) {
            for (var _pgi2 = 0; _pgi2 < Player.guards.length; _pgi2++) {
                if (Player.guards[_pgi2].personId === person.id) { _isPlayerGuard = true; _guardEntry = Player.guards[_pgi2]; break; }
            }
        }
        var _isFamilyMember = false;
        if (Player.familyMembers) {
            for (var _fmi = 0; _fmi < Player.familyMembers.length; _fmi++) {
                if (Player.familyMembers[_fmi].npcId === person.id) { _isFamilyMember = true; break; }
            }
        }
        var _isCompanion = isSpouse || isChild || _isFamilyMember || _isPlayerGuard;

        if (_isCompanion) {
            // Check for spouse condition (spouseAI system)
            var _companionSick = false;
            var _companionCondLabel = '';
            var _companionCondColor = '#e67e22';
            if (isSpouse && Player.getSpouseStatus) {
                var _spStat = Player.getSpouseStatus();
                if (_spStat && _spStat.condition !== 'healthy') {
                    _companionSick = true;
                    _companionCondLabel = _spStat.condition === 'gravely_ill' ? '☠️ Gravely Ill' : _spStat.condition === 'sick' ? '🤒 Sick' : '🩹 Injured';
                    _companionCondColor = _spStat.condition === 'gravely_ill' ? '#f33' : _spStat.condition === 'sick' ? '#e67e22' : '#d4a017';
                }
            }
            // Check NPC illness/injury system (family/guards/children)
            if (!_companionSick) {
                var _cInjured = person.injured || (person.injuries && person.injuries.length > 0);
                var _cSick = person.sick || (person.illnesses && person.illnesses.length > 0);
                if (_cInjured || _cSick) {
                    _companionSick = true;
                    _companionCondLabel = _cInjured ? '🩹 ' + (person.injurySeverity || 'Injured') : '🤒 ' + (person.illness || 'Sick');
                    _companionCondColor = '#e67e22';
                }
            }

            if (_companionSick) {
                var _compType = isSpouse ? 'spouse' : _isPlayerGuard ? 'guard' : 'family';
                html += '<div class="detail-section" style="background:rgba(200,60,60,0.08);border:1px solid rgba(200,60,60,0.25);border-radius:6px;">';
                html += '<h3 style="color:' + _companionCondColor + ';">⚕️ Health: ' + _companionCondLabel + '</h3>';
                html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
                var _pdHasDoc = Player.hasSkill && (Player.hasSkill('field_medic') || Player.hasSkill('doctor'));
                if (_pdHasDoc) {
                    var _pdSkillName = Player.hasSkill('doctor') ? 'Doctor' : 'Field Medic';
                    html += '<button class="btn-medieval" data-action="treatCompanionUI" data-id="' + person.id + '" data-type="' + _compType + '" data-val="player" style="font-size:0.75rem;padding:5px 10px;background:rgba(40,120,40,0.3);border-color:rgba(60,180,60,0.5);">⚕️ Treat (' + _pdSkillName + ')</button>';
                } else {
                    html += '<span style="font-size:0.75rem;color:#888;">Need Field Medic or Doctor skill to treat</span>';
                }
                // Hospital button
                var _pdTown = null;
                try { _pdTown = Engine.findTown(Player.townId); } catch(e) {}
                var _pdHasHosp = false;
                if (_pdTown && _pdTown.buildings) {
                    for (var _phi = 0; _phi < _pdTown.buildings.length; _phi++) {
                        if (_pdTown.buildings[_phi].type === 'hospital' || _pdTown.buildings[_phi].type === 'clinic') { _pdHasHosp = true; break; }
                    }
                }
                if (_pdHasHosp) {
                    html += '<button class="btn-medieval" data-action="treatCompanionUI" data-id="' + person.id + '" data-type="' + _compType + '" data-val="hospital" style="font-size:0.75rem;padding:5px 10px;background:rgba(40,80,160,0.3);border-color:rgba(60,120,220,0.5);">🏥 Take to Hospital</button>';
                } else {
                    html += '<span style="font-size:0.75rem;color:#888;margin-left:4px;">🏥 No hospital in town</span>';
                }
                html += '</div></div>';
            }
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

        // ── Kingdom Quest Interactive Buttons (interview, ask, capture) ──
        if (isInSameTown) {
            var _kqInteractive = Player.state._kqInteractiveData || {};
            var _kqQuestButtons = '';
            for (var _kqId in _kqInteractive) {
                var _kqiData = _kqInteractive[_kqId];
                if (!_kqiData) continue;

                if (_kqiData.type === 'interview_npcs') {
                    for (var _kqni = 0; _kqni < _kqiData.targets.length; _kqni++) {
                        var _kqnTarget = _kqiData.targets[_kqni];
                        if (_kqnTarget.npcId === person.id && !_kqnTarget.interviewed) {
                            var _kqTitle = '';
                            try {
                                var _kqAll = Player.state.kingdomQuests || {};
                                for (var _kqKid in _kqAll) { var _kqAct = _kqAll[_kqKid].active || []; for (var _kqAi = 0; _kqAi < _kqAct.length; _kqAi++) { if (_kqAct[_kqAi].id === _kqId) { _kqTitle = _kqAct[_kqAi].title; break; } } if (_kqTitle) break; }
                            } catch(e) {}
                            _kqQuestButtons += '<div style="background:rgba(100,150,212,0.12);padding:8px;border-radius:6px;border:1px solid rgba(100,150,212,0.3);margin-bottom:6px;">';
                            _kqQuestButtons += '<div style="font-size:0.78rem;color:#6496d4;font-weight:bold;">🗣️ Interview for Quest</div>';
                            if (_kqTitle) _kqQuestButtons += '<div style="font-size:0.65rem;color:#aaa;margin:2px 0;">' + escapeHtml(_kqTitle) + '</div>';
                            _kqQuestButtons += '<div style="font-size:0.68rem;color:#aaa;margin:2px 0;">This person may have information (' + (_kqiData.infoGathered || 0) + '/' + _kqiData.infoNeeded + ' gathered)</div>';
                            _kqQuestButtons += '<button class="btn-medieval" data-action="interviewNpcForQuestUI" data-id="' + _kqId.replace(/"/g, '&quot;') + '" data-val="' + _kqni + '" style="font-size:0.75rem;padding:5px 12px;background:rgba(100,150,212,0.2);border-color:rgba(100,150,212,0.4);">🗣️ Interview about Quest</button>';
                            _kqQuestButtons += '</div>';
                        }
                    }
                } else if (_kqiData.type === 'ask_npcs') {
                    for (var _kqci = 0; _kqci < _kqiData.npcClues.length; _kqci++) {
                        var _kqcTarget = _kqiData.npcClues[_kqci];
                        if (_kqcTarget.npcId === person.id && !_kqcTarget.asked) {
                            var _kqTitle2 = '';
                            try {
                                var _kqAll2 = Player.state.kingdomQuests || {};
                                for (var _kqKid2 in _kqAll2) { var _kqAct2 = _kqAll2[_kqKid2].active || []; for (var _kqAi2 = 0; _kqAi2 < _kqAct2.length; _kqAi2++) { if (_kqAct2[_kqAi2].id === _kqId) { _kqTitle2 = _kqAct2[_kqAi2].title; break; } } if (_kqTitle2) break; }
                            } catch(e) {}
                            _kqQuestButtons += '<div style="background:rgba(180,120,60,0.12);padding:8px;border-radius:6px;border:1px solid rgba(180,120,60,0.3);margin-bottom:6px;">';
                            _kqQuestButtons += '<div style="font-size:0.78rem;color:#b4783c;font-weight:bold;">🔎 Ask about ' + escapeHtml(_kqiData.criminalName) + '</div>';
                            if (_kqTitle2) _kqQuestButtons += '<div style="font-size:0.65rem;color:#aaa;margin:2px 0;">' + escapeHtml(_kqTitle2) + '</div>';
                            _kqQuestButtons += '<div style="font-size:0.68rem;color:#aaa;margin:2px 0;">This person may know where the criminal is hiding.</div>';
                            _kqQuestButtons += '<button class="btn-medieval" data-action="askNpcAboutCriminalUI" data-id="' + _kqId.replace(/"/g, '&quot;') + '" data-val="' + _kqci + '" style="font-size:0.75rem;padding:5px 12px;background:rgba(180,120,60,0.2);border-color:rgba(180,120,60,0.4);">🔎 Ask about Criminal</button>';
                            _kqQuestButtons += '</div>';
                        }
                    }
                } else if (_kqiData.type === 'capture') {
                    // Show capture button if this NPC's town matches OR if player is in the right town
                    if (_kqiData.targetTownId === person.townId && _kqiData.targetTownId === Player.townId) {
                        _kqQuestButtons += '<div style="background:rgba(200,60,60,0.12);padding:8px;border-radius:6px;border:1px solid rgba(200,60,60,0.3);margin-bottom:6px;">';
                        _kqQuestButtons += '<div style="font-size:0.78rem;color:#c83c3c;font-weight:bold;">🎯 Criminal Target: ' + escapeHtml(_kqiData.targetName) + '</div>';
                        _kqQuestButtons += '<div style="font-size:0.68rem;color:#aaa;margin:2px 0;">This is the fugitive you\'re looking for! Attempt to capture them.</div>';
                        _kqQuestButtons += '<button class="btn-medieval" data-action="attemptCaptureCriminalUI" data-id="' + _kqId.replace(/"/g, '&quot;') + '" style="font-size:0.75rem;padding:5px 12px;background:rgba(200,60,60,0.2);border-color:rgba(200,60,60,0.4);">🎯 Attempt Capture</button>';
                        _kqQuestButtons += '</div>';
                    }
                }
            }
            if (_kqQuestButtons) {
                html += '<div class="detail-section"><h3>📜 Quest Actions</h3>' + _kqQuestButtons + '</div>';
            }
        }

        if (isInSameTown) {
            // ── Noble Access Check ──
            var _talkCheck = Player.canTalkTo ? Player.canTalkTo(person.id) : { canTalk: true };

            // ── Social Actions ──
            html += `<div class="detail-section"><h3>🤝 Social</h3>`;

            if (!_talkCheck.canTalk) {
                // Locked — show why and introduction options
                var _npcRank = Player.getNPCSocialRank ? Player.getNPCSocialRank(person) : 0;
                var _rankName = _npcRank >= 7 ? 'King' : _npcRank >= 4 ? (['', '', '', '', 'Minor Noble', 'Lord', 'Royal Advisor'][_npcRank] || 'Noble') : 'Noble';
                html += `<div style="background:rgba(200,50,50,0.1);border:1px solid rgba(200,50,50,0.3);border-radius:6px;padding:8px;margin-bottom:6px;">`;
                html += `<div style="font-size:0.85rem;font-weight:bold;color:#cc6666;">🔒 Cannot Interact — ${_rankName}</div>`;
                html += `<div style="font-size:0.75rem;color:#aaa;margin-top:4px;">${_talkCheck.reason}</div>`;
                if (_talkCheck.needsIntroduction) {
                    html += `<button class="btn-medieval" data-action="showIntroductionOptions" data-id="${person.id}" data-val="${_npcRank}" style="font-size:0.75rem;padding:5px 10px;margin-top:6px;">🤝 Find Someone to Introduce Me</button>`;
                }
                html += `</div>`;
                // Still allow observe and ask around (non-direct interaction)
                html += `<div style="display:flex;flex-wrap:wrap;gap:4px;">`;
                html += `<button class="btn-medieval" data-action="observePerson" data-id="${person.id}" title="Spend 8 hours watching this person" style="font-size:0.75rem;padding:5px 10px;">👀 Observe</button>`;
                html += `<button class="btn-medieval" data-action="askTavernAbout" data-id="${person.id}" title="Ask around at the tavern (5g)" style="font-size:0.75rem;padding:5px 10px;">🍺 Ask Around</button>`;
                html += `</div>`;
            } else {
                html += `<div style="display:flex;flex-wrap:wrap;gap:4px;">`;
                html += `<button class="btn-medieval" data-action="openGiftDialog" data-id="${person.id}" title="Give a gift to improve your relationship" style="font-size:0.75rem;padding:5px 10px;">🎁 Gift</button>`;
                html += `<button class="btn-medieval" data-action="talkToPerson" data-id="${person.id}" title="Have a conversation to build rapport" style="font-size:0.75rem;padding:5px 10px;">💬 Talk</button>`;
                html += `<button class="btn-medieval" data-action="observePerson" data-id="${person.id}" title="Spend 8 hours watching this person — 30% chance to discover a hidden quirk (free)" style="font-size:0.75rem;padding:5px 10px;">👀 Observe</button>`;
                html += `<button class="btn-medieval" data-action="askTavernAbout" data-id="${person.id}" title="Ask around at the tavern for gossip about this person (5g)" style="font-size:0.75rem;padding:5px 10px;">🍺 Ask Around</button>`;
                html += `<button class="btn-medieval" data-action="hireInvestigator" data-id="${person.id}" title="Hire an investigator to uncover secrets — costly and risky, they may find out!" style="font-size:0.75rem;padding:5px 10px;">🕵️ Investigate</button>`;
                // Introduction request for same-rank peers (if this is a noble you already know)
                var _introNpcRank = Player.getNPCSocialRank ? Player.getNPCSocialRank(person) : 0;
                if (_introNpcRank >= 4 && _introNpcRank < 7) {
                    var _introRel = Player.getRelationship ? Player.getRelationship(person.id) : { level: 0 };
                    if (_introRel.level >= 60) {
                        var _aboveRank = _introNpcRank + 1;
                        var _targetRankName = _aboveRank >= 7 ? 'King' : _aboveRank >= 6 ? 'Royal Advisor' : _aboveRank >= 5 ? 'Lord' : 'Minor Noble';
                        html += `<button class="btn-medieval" data-action="requestSameRankIntro" data-id="${person.id}" title="Ask to be introduced to a ${_targetRankName}" style="font-size:0.75rem;padding:5px 10px;">🤝 Ask for Introduction to ${_targetRankName}</button>`;
                    }
                    // Loan offer for financially stressed nobles
                    html += `<button class="btn-medieval" data-action="openNobleLoanDialog" data-id="${person.id}" title="Offer a loan to this noble — indebted nobles are easier to influence" style="font-size:0.75rem;padding:5px 10px;">💰 Offer Loan</button>`;
                } else if (person.occupation === 'guild_master' || (person.guildMemberships && Object.keys(person.guildMemberships).some(function(g) { return person.guildMemberships[g].rank === 'guildmaster'; }))) {
                    // Guildmasters can introduce you to Minor Nobles
                    var _gmRel = Player.getRelationship ? Player.getRelationship(person.id) : { level: 0 };
                    if (_gmRel.level >= 60) {
                        html += `<button class="btn-medieval" data-action="requestSameRankIntro" data-id="${person.id}" title="Ask to be introduced to a Minor Noble" style="font-size:0.75rem;padding:5px 10px;">🤝 Ask for Introduction to Minor Noble</button>`;
                    }
                }
                // Recruit to outpost button (if player has outposts, NPC not nobility/minor)
                if (typeof Player !== 'undefined' && Player.getPlayerOutposts) {
                    var _playerOutposts = Player.getPlayerOutposts().filter(function(o) { return !o.abandoned && !o.annexed && o.isOutpost; });
                    if (_playerOutposts.length > 0 && person.age >= 18 && person.occupation !== 'noble' && person.occupation !== 'king' && person.occupation !== 'queen' && person.occupation !== 'queens_lord' && !person.isKing) {
                        var _pIsNoble = false;
                        if (person.socialRank && typeof person.socialRank === 'object') {
                            for (var _srck in person.socialRank) { if ((person.socialRank[_srck] || 0) >= 4) { _pIsNoble = true; break; } }
                        }
                        if (!_pIsNoble) {
                            html += `<button class="btn-medieval" data-action="openRecruitToOutpostDialog" data-id="${person.id}" title="Convince this person to move to your outpost" style="font-size:0.75rem;padding:5px 10px;background:rgba(74,124,59,0.2);border-color:rgba(74,124,59,0.4);color:#a5d6a7;">⛺ Recruit to Outpost</button>`;
                        }
                    }
                }
                html += `</div>`;
            }
            // God mode: instant relationship +10 / -10 buttons
            if (typeof Game !== 'undefined' && Game.isGodMode && Game.isGodMode()) {
                html += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">`;
                html += `<button class="btn-medieval" data-action="godRelPlus" data-id="${person.id}" style="font-size:0.75rem;padding:5px 10px;background:rgba(50,200,50,0.2);border-color:rgba(50,200,50,0.4);color:#a5d6a7;">⬆️ +10 Relationship</button>`;
                html += `<button class="btn-medieval" data-action="godRelMinus" data-id="${person.id}" style="font-size:0.75rem;padding:5px 10px;background:rgba(200,50,50,0.2);border-color:rgba(200,50,50,0.4);color:#ef9a9a;">⬇️ -10 Relationship</button>`;
                html += `</div>`;
            }
            html += `</div>`;
            if (person.employerId === 'player' && person._playerHorse) {
                html += `<div class="detail-section"><h3>🐴 Horse</h3>
                    <div style="font-size:0.8rem;color:#aaa;margin-bottom:4px;">This worker is riding a horse you gave them.</div>
                    <button class="btn-medieval" style="font-size:0.75rem;padding:5px 12px;" data-action="takeHorseFromWorker" data-id="${person.id}">🐴 Take Horse Back</button>
                </div>`;
            }

            // ── Discovered Traits & Quirks ──
            if (Player.getRevealedInfo) {
                const revealed = Player.getRevealedInfo(person.id);
                const totalQuirks = person.quirks ? person.quirks.length : 0;
                const revealedQuirks = revealed && revealed.quirks ? revealed.quirks : [];
                const revealedTraits = revealed && revealed.traits ? revealed.traits : {};
                const traitNames = ['loyalty','ambition','frugality','intelligence','warmth','honesty'];
                const traitIcons = {loyalty:'\uD83E\uDEE1',ambition:'\uD83D\uDD25',frugality:'\uD83D\uDCB0',intelligence:'\uD83E\uDDE0',warmth:'\u2764\uFE0F',honesty:'\u2696\uFE0F'};
                const hasAnyReveal = revealedQuirks.length > 0 || Object.keys(revealedTraits).length > 0;

                html += `<div class="detail-section"><h3>\uD83D\uDD0D Discovered Info</h3>`;

                // Traits
                if (Object.keys(revealedTraits).length > 0) {
                    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">';
                    for (const tn of traitNames) {
                        if (revealedTraits[tn]) {
                            const lvl = revealedTraits[tn];
                            let label = tn.charAt(0).toUpperCase() + tn.slice(1);
                            let val = '';
                            if (lvl === 'exact' && person[tn] !== undefined) {
                                val = ' ' + Math.round(person[tn]);
                            } else if (lvl === 'specific') {
                                const v = person[tn] || 50;
                                val = v > 70 ? ' High' : v < 30 ? ' Low' : ' Average';
                            } else {
                                val = '';
                            }
                            html += `<span style="font-size:0.75rem;padding:2px 6px;border-radius:4px;background:rgba(100,150,200,0.15);border:1px solid rgba(100,150,200,0.3);" title="${label}: ${val.trim() || 'Vague impression'}">${traitIcons[tn] || ''} ${label}${val}</span>`;
                        }
                    }
                    html += '</div>';
                }

                // Quirks
                if (revealedQuirks.length > 0) {
                    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;">';
                    for (const qId of revealedQuirks) {
                        const qDef = (typeof SPOUSE_QUIRKS !== 'undefined') ? SPOUSE_QUIRKS.find(function(q) { return q.id === qId; }) : null;
                        if (qDef) {
                            const color = qDef.positive ? 'rgba(85,168,104,0.15)' : 'rgba(196,78,82,0.15)';
                            const border = qDef.positive ? 'rgba(85,168,104,0.3)' : 'rgba(196,78,82,0.3)';
                            html += `<span style="font-size:0.75rem;padding:2px 6px;border-radius:4px;background:${color};border:1px solid ${border};" title="${qDef.effect || ''}">${qDef.icon || ''} ${qDef.name}</span>`;
                        }
                    }
                    html += '</div>';
                }

                // Undiscovered count
                const undiscovered = totalQuirks - revealedQuirks.length;
                if (undiscovered > 0) {
                    html += `<div style="font-size:0.7rem;color:var(--text-muted);">${undiscovered} undiscovered quirk${undiscovered > 1 ? 's' : ''} \u2014 use Observe, Ask Around, or Investigate to learn more.</div>`;
                } else if (!hasAnyReveal) {
                    html += `<div style="font-size:0.7rem;color:var(--text-muted);">You haven\u2019t discovered anything about this person yet. Use the social actions above to learn more.</div>`;
                }

                html += '</div>';
            }

            // ── Relationship Perks (Favors) ──
            if (Player.getRelationshipPerks) {
                const perks = Player.getRelationshipPerks(person.id);
                if (perks.length > 0) {
                    var _favUsedInfo = perks[0]._favorsUsed != null ? perks[0]._favorsUsed : 0;
                    var _favLimitInfo = perks[0]._favorLimit || 2;
                    html += `<div class="detail-section"><h3>\u2B50 Favors</h3>
                        <div style="font-size:0.65rem;color:#aaa;margin-bottom:4px;">Favors used: ${_favUsedInfo}/${_favLimitInfo} (resets every 30 days)</div>
                        <div style="display:flex;flex-direction:column;gap:3px;">`;
                    for (const perk of perks) {
                        const disabled = perk.onCooldown;
                        const cdText = disabled ? (perk._favorLimited ? ` (favor limit — ${perk.cooldownRemaining}d reset)` : ` (${perk.cooldownRemaining}d cooldown)`) : '';
                        const costText = perk.cost > 0 ? ` (${perk.cost}g)` : '';
                        html += `<button class="btn-medieval" data-action="usePerk" data-id="${person.id}" data-val="${perk.id}"
                            ${disabled ? 'disabled' : ''}
                            style="font-size:0.7rem;padding:4px 8px;text-align:left;${disabled ? 'opacity:0.5;cursor:not-allowed;' : ''}"
                            title="${perk.desc}">
                            ${perk.name}${costText}${cdText}
                        </button>`;
                    }
                    html += `</div></div>`;
                }
            }

            // ── Dating Actions (if eligible, not a king, not family) ──
            var _isKingNPC = person.occupation === 'king' || person.occupation === 'reigning_queen' || person.occupation === 'queen' || person.occupation === 'queens_lord';
            if (!_isKingNPC && Engine.getKingdoms) {
                var _kkList = Engine.getKingdoms();
                for (var _kki = 0; _kki < _kkList.length; _kki++) {
                    if (_kkList[_kki].king === person.id) { _isKingNPC = true; break; }
                }
            }
            // v9p33river77: don't show courtship for the player's own family —
            // parents, siblings, children. Family panel handles family relations.
            var _isFamilyNPC = false;
            try {
                var _pSt = Player.state || Player;
                if (_pSt) {
                    if (_pSt.parentIds && _pSt.parentIds.indexOf(person.id) >= 0) _isFamilyNPC = true;
                    else if (_pSt.childrenIds && _pSt.childrenIds.indexOf(person.id) >= 0) _isFamilyNPC = true;
                    else if (_pSt.familyMembers) {
                        for (var _fmi = 0; _fmi < _pSt.familyMembers.length; _fmi++) {
                            if (_pSt.familyMembers[_fmi].npcId === person.id) { _isFamilyNPC = true; break; }
                        }
                    }
                }
            } catch (_e) {}
            // v9p33river100: don't offer courtship for NPCs the player can't directly
            // interact with (e.g., minor noble without an introduction).
            var _canTalkForCourtship = (typeof _talkCheck !== 'undefined') ? _talkCheck.canTalk : true;
            const canDate = person.age >= 16 && !isChild && !_isKingNPC && !_isFamilyNPC && _canTalkForCourtship;
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
                    html += `<button class="btn-medieval" data-action="dateAction" data-id="${person.id}" data-val="${activity.id}" ${disabledAttr} title="${tooltip}">
                        ${activity.name}${activity.cost ? ' (' + activity.cost + 'g)' : ' (Free)'}</button>`;
                }

                // Propose button
                if (rel.level >= 60 && !person.spouseId && !playerSpouseId) {
                    html += `<button id="btnPropose" class="btn-medieval" data-action="proposeTo" data-id="${person.id}" style="font-size:0.75rem;padding:5px 10px;margin-top:4px;">
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
                        <button class="btn-medieval" data-action="hirePerson" data-id="${person.id}" style="font-size:0.8rem;padding:6px 16px;width:100%;">
                            👥 Hire as Worker
                        </button>
                    </div>`;
                }
            }

            // ── Petition Signature Request ──
            if (typeof Player !== 'undefined' && Player.state && Player.state.petitions) {
                var activePetitions = Player.state.petitions.filter(function(p) { return p.status === 'active'; });
                if (activePetitions.length > 0) {
                    var eligiblePetitions = activePetitions.filter(function(p) {
                        return person.kingdomId === p.kingdomId && !(p.signatures && p.signatures.includes(person.id));
                    });
                    if (eligiblePetitions.length > 0) {
                        html += '<div class="detail-section"><h3>📜 Petition</h3>';
                        var sigToday = Player.state._signatureRequestsToday || { day: 0, count: 0 };
                        var currentDay = Engine.getDay ? Engine.getDay() : 0;
                        var requestsLeft = sigToday.day === currentDay ? Math.max(0, 2 - sigToday.count) : 2;
                        html += '<div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">Requests today: ' + (2 - requestsLeft) + '/2</div>';
                        for (var _pi = 0; _pi < eligiblePetitions.length; _pi++) {
                            var _pet = eligiblePetitions[_pi];
                            var _petType = (typeof PETITION_TYPES !== 'undefined') ? PETITION_TYPES.find(function(t) { return t.id === _pet.typeId; }) : null;
                            var _petName = _petType ? _petType.name : _pet.typeId;
                            var _disabledSig = requestsLeft <= 0;
                            html += '<button class="btn-medieval" data-action="requestSignature" data-id="' + _pet.id + '" data-val="' + person.id + '" style="font-size:0.75rem;padding:4px 10px;margin:2px 0;' + (_disabledSig ? 'opacity:0.5;cursor:not-allowed;' : '') + '"' + (_disabledSig ? ' disabled' : '') + ' title="Ask ' + (person.firstName || 'them') + ' to sign your petition">✍️ Ask to sign: ' + _petName + '</button>';
                        }
                        html += '</div>';
                    }
                }
            }

            // ── Dark Actions (skill-gated) ──
            var _hasAnySchemeSkill = false;
            if (typeof Player !== 'undefined' && Player.hasSkill) {
                _hasAnySchemeSkill = Player.hasSkill('discrete') || Player.hasSkill('shadow_dealings') || Player.hasSkill('silver_tongue_dark') || Player.hasSkill('dark_connections') || Player.hasSkill('assassin') || Player.hasSkill('poisoner') || Player.hasSkill('master_forger');
            }
            if (_hasAnySchemeSkill) {
            html += `<div class="detail-section"><h3>🏴 Schemes</h3>
                <div style="display:flex;flex-wrap:wrap;gap:4px;">`;

            if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('discrete')) {
            html += `<button class="btn-medieval" data-action="stealFromPerson" data-id="${person.id}" title="Attempt to pickpocket gold from this person. Risk of being caught and reported." style="font-size:0.9rem;padding:6px 12px;background:rgba(200,60,50,0.35);border-color:rgba(200,60,50,0.6);color:#f0d0a0;">💰 Steal</button>`;
            }
            if (typeof Player !== 'undefined' && Player.hasSkill && (Player.hasSkill('silver_tongue_dark') || Player.hasSkill('discrete'))) {
            html += `<button class="btn-medieval" data-action="spreadRumorsAbout" data-id="${person.id}" title="Spread damaging rumors to lower this person's reputation and standing in town." style="font-size:0.9rem;padding:6px 12px;background:rgba(200,60,50,0.35);border-color:rgba(200,60,50,0.6);color:#f0d0a0;">🤫 Rumors</button>`;
            }
            if (typeof Player !== 'undefined' && Player.hasSkill && (Player.hasSkill('shadow_dealings') || Player.hasSkill('silver_tongue_dark'))) {
            html += `<button class="btn-medieval" data-action="blackmailPerson" data-id="${person.id}" title="Extort gold from this person using their secrets. Higher reward but more dangerous." style="font-size:0.9rem;padding:6px 12px;background:rgba(200,60,50,0.35);border-color:rgba(200,60,50,0.6);color:#f0d0a0;">📜 Blackmail</button>`;
            }
            if (typeof Player !== 'undefined' && Player.hasSkill && (Player.hasSkill('dark_connections') || Player.hasSkill('assassin'))) {
            html += `<button class="btn-medieval" data-action="hireAssassinFor" data-id="${person.id}" title="Hire an assassin to eliminate this person. Extremely dangerous if discovered." style="font-size:0.9rem;padding:6px 12px;background:rgba(160,30,30,0.4);border-color:rgba(160,30,30,0.6);color:#f0d0a0;">🗡️ Assassin</button>`;
            }
            if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('poisoner')) {
            html += `<button class="btn-medieval" data-action="poisonPerson" data-id="${person.id}" title="Secretly poison this person, causing illness or death over time." style="font-size:0.9rem;padding:6px 12px;background:rgba(100,140,30,0.35);border-color:rgba(100,140,30,0.6);color:#f0d0a0;">☠️ Poison</button>`;
            }
            if (typeof Player !== 'undefined' && Player.hasSkill && (Player.hasSkill('shadow_dealings') || Player.hasSkill('master_forger'))) {
            html += `<button class="btn-medieval" data-action="framePerson" data-id="${person.id}" title="Plant evidence to frame this person for a crime they didn't commit." style="font-size:0.9rem;padding:6px 12px;background:rgba(200,60,50,0.35);border-color:rgba(200,60,50,0.6);color:#f0d0a0;">🎭 Frame</button>`;
            }

            html += `</div>
                <div class="text-dim" style="font-size:0.8rem;margin-top:6px;">⚠️ Criminal actions risk detection and punishment</div>
            </div>`;
            }
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
    UI._rightPanelTownId = null;
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
//  ACTION HELPERS (called via data-action delegation)
// ═══════════════════════════════════════════════════════════

// ---- Travel Options Dialog ----

function calculateRouteDist(route) {
    var totalDist = 0;
    if (!route) return 0;
    for (var i = 0; i < route.length; i++) {
        var seg = route[i];
        var a = Engine.findTown(seg.fromTownId);
        var b = Engine.findTown(seg.toTownId);
        if (a && b) {
            var segDist = Math.hypot(a.x - b.x, a.y - b.y);
            if (seg.type === 'offroad') {
                segDist /= (CONFIG.OFFROAD_SPEED_MULTIPLIER || 0.25);
            } else if (seg.type === 'sea') {
                segDist /= (CONFIG.SEA_SPEED_MULTIPLIER || 1.5);
            } else {
                segDist /= CONFIG.CARAVAN_ROAD_MULTIPLIER[seg.quality || 1] || 1;
            }
            totalDist += segDist;
        }
    }
    return totalDist;
}

function getTransportServices(fromTown, toTown, type) {
    var services = [];
    if (!fromTown || !toTown) return services;

    var kingdom = null;
    try { kingdom = Engine.findKingdom(fromTown.kingdomId); } catch (e) { /* ignore */ }

    var baseDist = Math.hypot((toTown.x || 0) - (fromTown.x || 0), (toTown.y || 0) - (fromTown.y || 0));
    var baseDays = Math.ceil(baseDist / (CONFIG.CARAVAN_BASE_SPEED * 1.5));
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

        // Luxury cabin (sea, cities and capitals with ports)
        if (type === 'sea' && fromTown.isPort && (tier === 'city' || tier === 'capital')) {
            var luxSeaPrice = Math.round(50 + baseDays * 18);
            services.push({
                icon: '🛳️',
                name: 'Luxury Cabin (' + luxSeaPrice + 'g)',
                desc: 'Private cabin on a galleon. Restores energy during the voyage.',
                price: luxSeaPrice,
                days: Math.max(1, Math.ceil(baseDays * 0.6)),
                type: 'npc_luxury_sea',
                restBonus: true
            });
        }
    }

    return services;
}

// Store state for travel options dialog
var _travelOptions = [];
var _travelDestTownId = null;
var _travelRouteDanger = {};
var _travelBringFamily = false;

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
        html += '<button class="btn-medieval" style="width:100%;" data-action="_enlistForCitizenship" data-id="' + destKingdom.id + '" data-val="' + townId + '">⚔️ Enlist for Citizenship</button>';
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
        html += '<button class="btn-medieval" style="width:100%;background:#5a2a2a;" data-action="_smuggleBorder" data-id="' + townId + '">🏃 Attempt Border Crossing</button>';
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

    html += '<button class="btn-medieval" style="width:100%;margin-top:8px;" data-action="closeModal">← Go Back</button>';
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
    // Corruption Expert halves bribe cost
    var bribeMult = (Player.hasSkill && Player.hasSkill('corruption_expert')) ? 0.2 : 0.4;
    var bribeFloor = (Player.hasSkill && Player.hasSkill('corruption_expert')) ? 10 : 20;
    var bribeCost = Math.max(bribeFloor, Math.floor(seizeValue * bribeMult));
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
    html += '<button class="btn-medieval" data-action="complyRequisition" data-id="' + targetRes + '" data-val="' + seizeQty + '" data-type="' + resName + '" style="padding:8px;">';
    html += '😔 Comply (' + seizeQty + ' ' + resName + ' seized)</button>';
    // Bribe
    var bribeLabel = (Player.hasSkill && Player.hasSkill('corruption_expert')) ? '💰 Bribe the Guards (' + bribeCost + 'g — Corruption Expert)' : '💰 Bribe the Guards (' + bribeCost + 'g)';
    html += '<button class="btn-medieval" data-action="bribeRequisitionGuard" data-id="' + targetRes + '" data-val="' + seizeQty + '" data-cost="' + bribeCost + '" style="padding:8px;">';
    html += bribeLabel + '</button>';
    // Resist (if player has combat skills)
    if (Player.hasSkill && (Player.hasSkill('combat_trained') || Player.hasSkill('battle_hardened'))) {
        html += '<button class="btn-medieval" data-action="_resistRequisition" data-id="' + targetRes + '" data-val="' + seizeQty + '" data-kingdom="' + kingdom.id + '" style="padding:8px;border-color:#c44;">';
        html += '⚔️ Resist (Combat — risky!)</button>';
    }
    // Fighting Retreat (if player has the skill)
    if (Player.hasSkill && Player.hasSkill('fighting_retreat')) {
        var combatLvl = (Player.getCombatLevel ? Player.getCombatLevel() : 0);
        var fleeChance = Math.min(85, Math.round(combatLvl));
        html += '<button class="btn-medieval" data-action="_fightingRetreat" data-id="' + targetRes + '" data-val="' + seizeQty + '" data-kingdom="' + kingdom.id + '" style="padding:8px;border-color:#c90;">';
        html += '🏃 Fighting Retreat (~' + fleeChance + '% — hit and run)</button>';
    }
    html += '</div>';

    openModal('⚠️ Forced Requisition', html);
}

function _resistRequisition(targetRes, seizeQty, kingdomId) {
    closeModal();
    var rng = Engine.getRng ? Engine.getRng() : null;
    var combatSkill = (Player.hasSkill && Player.hasSkill('battle_hardened')) ? 0.6 : 0.35;
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

function _fightingRetreat(targetRes, seizeQty, kingdomId) {
    closeModal();
    var rng = Engine.getRng ? Engine.getRng() : null;
    var combatLevel = (Player.getCombatLevel ? Player.getCombatLevel() : 0);
    var fleeChance = Math.min(0.85, combatLevel / 100);
    if (rng && rng.chance(fleeChance)) {
        toast('🏃 You fought the guards and escaped with your goods!', 'success');
        if (Player.state) Player.state.notoriety = Math.min(100, (Player.state.notoriety || 0) + 10);
        var kingdom = Engine.findKingdom(kingdomId);
        if (kingdom && Player.state.reputation) {
            Player.state.reputation[kingdomId] = Math.max(0, (Player.state.reputation[kingdomId] || 50) - 10);
        }
        Engine.logEvent(Player.state.fullName + ' fought off requisition guards and fled!');
    } else {
        toast('🏃 You tried to flee but the guards caught you! Goods seized.', 'danger');
        Player.executeRequisition(targetRes, seizeQty);
        if (Player.state) Player.state.notoriety = Math.min(100, (Player.state.notoriety || 0) + 15);
        Engine.logEvent(Player.state.fullName + ' tried to flee requisition but was caught.');
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
        html += '<button class="btn-medieval" data-action="_chooseExclusiveCitizenship" data-id="' + kId + '" data-kingdoms="' + JSON.stringify(citizenKingdoms).replace(/"/g, '&quot;') + '" style="padding:8px;' + (isPrimary ? 'border-color:#d4af37;' : '') + '">';
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
        html += '<button class="btn-medieval" data-action="payHorsePermitFine" style="background:linear-gradient(135deg,#3a5a1a,#4a7a2a);">💰 Pay Fine (' + fine + 'g)</button>';
    }
    html += '<button class="btn-medieval" data-action="refuseHorsePermitFine" style="background:linear-gradient(135deg,#5a1a1a,#7a2a2a);">🔒 ' + (canPay ? 'Refuse to Pay' : 'Accept Jail') + ' (' + jailDays + ' days)</button>';
    html += '</div>';
    html += '<p style="font-size:0.8em;color:#888;margin-top:10px;">💡 Tip: Buy a permit from the Character panel, or rank up to Burgher to be exempt.</p>';
    html += '</div>';
    openModal('🐴 Draft Animal Violation', html);
}

function openTravelOptions(townId) {
    if (_isBankruptcyBlocked()) { toast('💸 You must resolve your bankruptcy first!', 'danger', 'critical'); return; }
    var destTown = Engine.findTown(townId);
    if (!destTown) return;

    // Determine origin — use townId if in town, or nearest town if on road/traveling
    var _originTownId = Player.townId;
    if (!_originTownId && Player.getPlayerWorldPosition) {
        var _oPos = Player.getPlayerWorldPosition();
        if (_oPos) {
            var _oTowns = Engine.getTowns();
            var _oBest = Infinity;
            for (var _oi = 0; _oi < _oTowns.length; _oi++) {
                var _od = Math.hypot(_oTowns[_oi].x - _oPos.x, _oTowns[_oi].y - _oPos.y);
                if (_od < _oBest) { _oBest = _od; _originTownId = _oTowns[_oi].id; }
            }
        }
    }
    var currentTown = Engine.findTown(_originTownId);
    if (!currentTown) return;
    if (_originTownId === townId && !Player.traveling) { toast('You are already here.', 'info'); return; }
    if (Player.traveling && Player.travelPaid) { toast('Cannot redirect while on paid transport.', 'warning'); return; }

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

    // ===== CALCULATE ROUTES =====
    var mixedRoute = null;
    try { mixedRoute = Engine.findPath(_originTownId, townId); } catch (e) { /* ignore */ }

    var landRoute = null;
    try { landRoute = Engine.findPath(_originTownId, townId, { excludeSea: true }); } catch (e) { /* ignore */ }

    var canSea = false;
    try { canSea = Player.canTravelBySea(townId); } catch (e) { /* ignore */ }

    var hasHorse = Player.horses && Player.horses.length > 0;
    var hasSaddle = Player.inventory && (Player.inventory.saddles || 0) > 0;
    var hasShip = Player.ships && Player.ships.length > 0;
    var playerGold = Player.gold || 0;

    // Cart state
    var playerContainer = Player.state ? Player.state.storageContainer : null;
    var containerCfg = playerContainer ? CONFIG.STORAGE_CONTAINERS[playerContainer] : null;
    var isCartType = containerCfg && (playerContainer === 'cart' || playerContainer === 'small_wagon' || playerContainer === 'wagon' || playerContainer === 'large_wagon');

    // Horse purchase info
    var horseCost = 80;
    var horseAvailable = false;
    if (!hasHorse) {
        try {
            var horsePrice = currentTown.market && currentTown.market.prices && currentTown.market.prices.horses ? currentTown.market.prices.horses : 80;
            horseCost = Math.ceil(horsePrice);
        } catch (e) { /* ignore */ }
        var horseLegal = true;
        try {
            var hKingdom = Engine.findKingdom(currentTown.kingdomId);
            if (hKingdom && hKingdom.laws && hKingdom.laws.bannedGoods && hKingdom.laws.bannedGoods.indexOf('horses') !== -1) {
                horseLegal = Player.hasLicense && Player.hasLicense(currentTown.kingdomId, 'horses');
            }
        } catch (e) { /* ignore */ }
        horseAvailable = horseLegal && currentTown.market && currentTown.market.supply && (currentTown.market.supply.horses || 0) > 0;
    }

    // ===== SPEED / DISTANCE HELPERS =====
    var baseSpeed = CONFIG.CARAVAN_BASE_SPEED * 1.5;
    if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('road_knowledge')) baseSpeed *= 1.15;
    if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('cartographer')) baseSpeed *= 1.05;
    var horseSpd = baseSpeed * (1 + (CONFIG.HORSE_TRAVEL_SPEED_BONUS || 0.3));
    if (hasSaddle) horseSpd *= CONFIG.SADDLE_BONUS_MULTIPLIER || 2;
    var seaSpd = CONFIG.CARAVAN_BASE_SPEED * 1.5 * (CONFIG.SEA_SPEED_MULTIPLIER || 1.5);
    if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('expert_navigator')) seaSpd *= 1.2;
    var passageSpd = seaSpd * 0.8;

    function _splitRouteDists(route) {
        var ld = 0, sd = 0;
        if (!route) return { land: 0, sea: 0 };
        for (var i = 0; i < route.length; i++) {
            var s = route[i], a = Engine.findTown(s.fromTownId), b = Engine.findTown(s.toTownId);
            if (!a || !b) continue;
            var d = Math.hypot(a.x - b.x, a.y - b.y);
            if (s.type === 'sea') sd += d / (CONFIG.SEA_SPEED_MULTIPLIER || 1.5);
            else if (s.type === 'offroad') ld += d / (CONFIG.OFFROAD_SPEED_MULTIPLIER || 0.25);
            else ld += d / (CONFIG.CARAVAN_ROAD_MULTIPLIER[s.quality || 1] || 1);
        }
        return { land: ld, sea: sd };
    }

    function _calcDays(landDist, seaDist, landMode, seaMode) {
        var ls = (landMode === 'horse' || landMode === 'buy_horse') ? horseSpd : baseSpeed;
        var ss = seaMode === 'sail_own' ? seaSpd : passageSpd;
        var time = (landDist > 0 ? landDist / ls : 0) + (seaDist > 0 ? seaDist / ss : 0);
        return Math.max(1, Math.ceil(time));
    }

    // ===== SEGMENT CHAIN DISPLAY =====
    function _segChain(route) {
        if (!route || !route.length) return '';
        var icons = { road: '🚶', sea: '⛵', offroad: '🥾' };
        var chain = '';
        var first = Engine.findTown(route[0].fromTownId);
        chain += '<span style="white-space:nowrap;">' + (icons[route[0].type] || '🚶') + ' ' + (first ? first.name : '?') + '</span>';
        for (var i = 0; i < route.length; i++) {
            var to = Engine.findTown(route[i].toTownId);
            chain += ' <span style="color:var(--text-muted);">→</span> ';
            chain += '<span style="white-space:nowrap;">' + (icons[route[i].type] || '🚶') + ' ' + (to ? to.name : '?') + '</span>';
        }
        return chain;
    }

    // ===== ROUTE DANGER ASSESSMENT =====
    function _routeDangerInfo(route) {
        if (!route || !route.length) return { level: 'low', label: '🟢 Low', color: '#2ecc71', bandits: 0, atWar: false, modifiers: [], potentialModifiers: [] };
        var maxBandit = 0;
        var atWar = false;
        var hasPirates = false;
        var worstSegSafe = true;
        var worstTownSecurity = 100;
        for (var i = 0; i < route.length; i++) {
            var seg = route[i];
            if (seg.type === 'sea') {
                hasPirates = true;
                continue;
            }
            var bt = seg.banditThreat || 0;
            if (bt > maxBandit) maxBandit = bt;
            if (seg.safe === false) worstSegSafe = false;
            // Check actual war status between the two towns' kingdoms
            var fromT = Engine.findTown(seg.fromTownId);
            var toT = Engine.findTown(seg.toTownId);
            if (fromT && toT && fromT.kingdomId !== toT.kingdomId) {
                var _rdFromK = typeof Engine.findKingdom === 'function' ? Engine.findKingdom(fromT.kingdomId) : null;
                if (_rdFromK && _rdFromK.atWar && _rdFromK.atWar.has && _rdFromK.atWar.has(toT.kingdomId)) {
                    atWar = true;
                }
            }
            if (fromT && (fromT.security || 50) < worstTownSecurity) worstTownSecurity = fromT.security || 50;
            if (toT && (toT.security || 50) < worstTownSecurity) worstTownSecurity = toT.security || 50;
        }

        var baseLand = CONFIG.ENCOUNTER_LAND_BASE_CHANCE || 0.05;
        var baseSea = CONFIG.ENCOUNTER_SEA_BASE_CHANCE || 0.04;
        var chance = hasPirates ? baseSea : baseLand;
        var modifiers = [];
        var potentialModifiers = [];

        // Road danger
        if (maxBandit > 50 || !worstSegSafe) {
            var rdm = CONFIG.ENCOUNTER_ROAD_DANGER_MULT || 1.5;
            chance *= rdm;
            modifiers.push({ name: atWar ? '⚔️ War zone road' : '☠️ High bandit activity', effect: '+' + Math.round((rdm - 1) * 100) + '%', bad: true });
        }
        if (worstTownSecurity < 30) {
            var psm = CONFIG.ENCOUNTER_POOR_SECURITY_MULT || 1.3;
            chance *= psm;
            modifiers.push({ name: '🏚️ Poor town security', effect: '+' + Math.round((psm - 1) * 100) + '%', bad: true });
        }
        if (atWar) {
            var wtm = CONFIG.ENCOUNTER_WARTIME_CHANCE_MULT || 1.8;
            chance *= wtm;
            modifiers.push({ name: '⚔️ Wartime multiplier', effect: '+' + Math.round((wtm - 1) * 100) + '%', bad: true });
        }

        // Guards
        var guards = (Player.guards || []).length;
        var guardReduction = hasPirates ? (CONFIG.ENCOUNTER_SEA_GUARD_REDUCTION || 0.70) : (1.0 - (CONFIG.ENCOUNTER_GUARD_REDUCTION || 0.40));
        if (guards > 0) {
            for (var g = 0; g < guards; g++) chance *= guardReduction;
            var totalGuardPct = Math.round((1 - Math.pow(guardReduction, guards)) * 100);
            modifiers.push({ name: '🛡️ Personal guards (' + guards + ')', effect: '-' + totalGuardPct + '%', bad: false });
        } else {
            potentialModifiers.push({ name: '🛡️ Hire guards', desc: 'Each guard reduces encounter chance by ' + Math.round((1 - guardReduction) * 100) + '%', source: 'Character panel → Guards' });
        }
        if (Player.hasSkill && Player.hasSkill('veteran_guards') && guards > 0) {
            chance *= 0.70;
            modifiers.push({ name: '🎖️ Veteran Guards skill', effect: '-30%', bad: false });
        } else if (guards > 0) {
            potentialModifiers.push({ name: '🎖️ Veteran Guards skill', desc: 'Additional -30% with guards', source: 'Learn skill' });
        }

        // Horse
        if (!hasPirates && Player.horses && Player.horses.length > 0) {
            var hr = CONFIG.ENCOUNTER_HORSE_REDUCTION || 0.85;
            chance *= hr;
            modifiers.push({ name: '🐴 Riding horse', effect: '-' + Math.round((1 - hr) * 100) + '%', bad: false });
        } else if (!hasPirates) {
            potentialModifiers.push({ name: '🐴 Horse', desc: '-' + Math.round((1 - (CONFIG.ENCOUNTER_HORSE_REDUCTION || 0.85)) * 100) + '% encounter chance', source: 'Buy at market or stable' });
        }

        // Weapon
        var wepRed = hasPirates ? (CONFIG.ENCOUNTER_SEA_WEAPON_REDUCTION || 0.97) : (CONFIG.ENCOUNTER_WEAPON_REDUCTION || 0.90);
        if (Player.weapon) {
            chance *= wepRed;
            modifiers.push({ name: '⚔️ Carrying weapon', effect: '-' + Math.round((1 - wepRed) * 100) + '%', bad: false });
        } else {
            potentialModifiers.push({ name: '⚔️ Weapon', desc: '-' + Math.round((1 - wepRed) * 100) + '% encounter chance', source: 'Buy at market' });
        }

        // Armor
        var armRed = hasPirates ? (CONFIG.ENCOUNTER_SEA_ARMOR_REDUCTION || 0.98) : (CONFIG.ENCOUNTER_ARMOR_REDUCTION || 0.93);
        if (Player.armor) {
            chance *= armRed;
            modifiers.push({ name: '🛡️ Wearing armor', effect: '-' + Math.round((1 - armRed) * 100) + '%', bad: false });
        } else {
            potentialModifiers.push({ name: '🛡️ Armor', desc: '-' + Math.round((1 - armRed) * 100) + '% encounter chance', source: 'Buy at market' });
        }

        // Skills
        if (Player.hasSkill && Player.hasSkill('street_smart')) {
            var ss = CONFIG.ENCOUNTER_SKILL_STREET_SMART || 0.90;
            chance *= ss;
            modifiers.push({ name: '🧠 Street Smart', effect: '-' + Math.round((1 - ss) * 100) + '%', bad: false });
        } else {
            potentialModifiers.push({ name: '🧠 Street Smart', desc: '-' + Math.round((1 - (CONFIG.ENCOUNTER_SKILL_STREET_SMART || 0.90)) * 100) + '% encounter chance', source: 'Learn skill' });
        }
        if (Player.hasSkill && Player.hasSkill('intimidating_presence')) {
            var ip = CONFIG.ENCOUNTER_SKILL_INTIMIDATING || 0.85;
            chance *= ip;
            modifiers.push({ name: '💪 Intimidating Presence', effect: '-' + Math.round((1 - ip) * 100) + '%', bad: false });
        } else {
            potentialModifiers.push({ name: '💪 Intimidating Presence', desc: '-' + Math.round((1 - (CONFIG.ENCOUNTER_SKILL_INTIMIDATING || 0.85)) * 100) + '% encounter chance', source: 'Learn skill' });
        }
        if (!hasPirates) {
            if (Player.hasSkill && Player.hasSkill('road_knowledge')) {
                chance *= 0.92;
                modifiers.push({ name: '🗺️ Road Knowledge', effect: '-8%', bad: false });
            } else {
                potentialModifiers.push({ name: '🗺️ Road Knowledge', desc: '-8% encounter chance on land', source: 'Learn skill' });
            }
        }
        if (hasPirates) {
            if (Player.hasSkill && Player.hasSkill('expert_navigator')) {
                chance *= 0.90;
                modifiers.push({ name: '🧭 Expert Navigator', effect: '-10%', bad: false });
            } else {
                potentialModifiers.push({ name: '🧭 Expert Navigator', desc: '-10% encounter chance at sea', source: 'Learn skill' });
            }
        }
        // Bandit evasion
        if (!atWar) {
            if (Player.hasSkill && Player.hasSkill('bandit_mastery')) {
                chance *= 0.50;
                modifiers.push({ name: '🎯 Bandit Mastery', effect: '-50%', bad: false });
            } else if (Player.hasSkill && Player.hasSkill('bandit_evasion')) {
                chance *= 0.75;
                modifiers.push({ name: '🏃 Bandit Evasion', effect: '-25%', bad: false });
            } else {
                potentialModifiers.push({ name: '🏃 Bandit Evasion', desc: '-25% encounter chance', source: 'Learn skill' });
                potentialModifiers.push({ name: '🎯 Bandit Mastery', desc: '-50% encounter chance', source: 'Learn skill (advanced)' });
            }
        } else {
            if (Player.hasSkill && Player.hasSkill('bandit_mastery')) {
                chance *= 0.75;
                modifiers.push({ name: '🎯 Bandit Mastery (wartime)', effect: '-25%', bad: false });
            }
        }

        // Clamp
        var minC = hasPirates ? (CONFIG.ENCOUNTER_SEA_MIN_CHANCE || 0.0001) : (CONFIG.ENCOUNTER_LAND_MIN_CHANCE || 0.001);
        var maxC = hasPirates ? (CONFIG.ENCOUNTER_SEA_MAX_CHANCE || 0.10) : (CONFIG.ENCOUNTER_LAND_MAX_CHANCE || 0.15);
        chance = Math.max(minC, Math.min(maxC, chance));

        var level = 'low';
        var label = '🟢 Low';
        var color = '#2ecc71';
        if (chance >= 0.06) {
            level = 'high'; label = '🔴 High'; color = '#e74c3c';
        } else if (chance >= 0.025) {
            level = 'medium'; label = '🟡 Medium'; color = '#e67e22';
        }
        return { level: level, label: label, color: color, bandits: maxBandit, atWar: atWar, hasPirates: hasPirates, chance: chance, modifiers: modifiers, potentialModifiers: potentialModifiers };
    }

    // ===== CLASSIFY ROUTES =====
    var mixedHasSea = mixedRoute && mixedRoute.some(function(s) { return s.type === 'sea'; });
    var mixedHasLand = mixedRoute && mixedRoute.some(function(s) { return s.type !== 'sea'; });
    var landValid = landRoute && landRoute.length > 0 && !landRoute.every(function(s) { return s.type === 'sea'; });

    var showLand = landValid;
    var showMixed = mixedRoute && mixedRoute.length > 0 && mixedHasSea && mixedHasLand;
    var showSea = canSea;

    // If mixed has no sea, it's same as land
    if (!mixedHasSea) showMixed = false;

    // Deduplicate land vs mixed
    if (showLand && showMixed && landRoute.length === mixedRoute.length) {
        var _same = true;
        for (var ci = 0; ci < landRoute.length; ci++) {
            if (landRoute[ci].fromTownId !== mixedRoute[ci].fromTownId ||
                landRoute[ci].toTownId !== mixedRoute[ci].toTownId ||
                landRoute[ci].type !== mixedRoute[ci].type) { _same = false; break; }
        }
        if (_same) showMixed = false;
    }

    // Fallback: no categorized routes, try mixed as generic
    if (!showLand && !showSea && !showMixed && mixedRoute && mixedRoute.length > 0) showMixed = true;

    // ===== BUILD OPTIONS (tagged with route category) =====
    var options = [];
    var routeLabels = { land: '🚶 Land Route', mixed: '🗺️ Mixed Route', sea: '⛵ Sea Route', god: '⚡ God Mode' };
    var routeDanger = {};
    if (landRoute) routeDanger.land = _routeDangerInfo(landRoute);
    if (mixedRoute) routeDanger.mixed = _routeDangerInfo(mixedRoute);
    if (canSea) routeDanger.sea = { level: 'medium', label: '🟡 Medium', color: '#e67e22', bandits: 0, atWar: false, hasPirates: true };
    routeDanger.god = { level: 'low', label: '🟢 Low', color: '#2ecc71', bandits: 0, atWar: false, hasPirates: false };

    // --- LAND ROUTE OPTIONS ---
    if (showLand) {
        var lDists = _splitRouteDists(landRoute);
        var lChain = _segChain(landRoute);

        // Walk
        options.push({
            id: 'land_walk', icon: '🚶', name: 'Walk',
            desc: 'Travel on foot. Slow but free.',
            cost: 0, days: _calcDays(lDists.land, lDists.sea, 'walk', 'sail_own'),
            available: true, route: 'land', routeChain: lChain,
            action: function () { return Player.travelTo(townId, { bringFamily: _travelBringFamily }); }
        });

        // Ride Horse
        if (hasHorse) {
            options.push({
                id: 'land_horse', icon: '🐴', name: 'Ride Your Horse',
                desc: 'Much faster travel. Less tiring.',
                cost: 0, days: _calcDays(lDists.land, lDists.sea, 'horse', 'sail_own'),
                available: true, route: 'land', routeChain: lChain,
                action: function () { return Player.travelTo(townId, { mode: 'horse', bringFamily: _travelBringFamily }); }
            });
        }

        // Buy Horse & Ride
        if (!hasHorse && horseAvailable) {
            var canAffordHorse = playerGold >= horseCost;
            options.push({
                id: 'land_buy_horse', icon: '🐴💰',
                name: 'Buy Horse & Ride (' + horseCost + 'g)',
                desc: 'Purchase a horse first, then ride. You keep the horse after.',
                cost: horseCost, days: _calcDays(lDists.land, lDists.sea, 'horse', 'sail_own'),
                available: canAffordHorse,
                unavailableReason: !canAffordHorse ? 'Not enough gold' : '',
                route: 'land', routeChain: lChain,
                action: (function (hCost) { return function () { return Player.buyHorseForTravel(townId, hCost, { bringFamily: _travelBringFamily }); }; })(horseCost)
            });
        }

        // Cart options
        if (isCartType) {
            var cartPenalty = hasHorse ? 1.0 : 1.4;
            var bringSpeed = hasHorse ? horseSpd : baseSpeed;
            var bringDays = Math.max(1, Math.ceil((lDists.land * cartPenalty) / bringSpeed));
            options.push({
                id: 'land_bring_cart', icon: '🛒',
                name: 'Bring ' + containerCfg.name,
                desc: hasHorse ? 'Your horse pulls the ' + containerCfg.name + '. No speed penalty.' : 'Drag the ' + containerCfg.name + ' by hand — 40% slower!',
                cost: 0, days: bringDays,
                available: true, route: 'land', routeChain: lChain,
                action: (function (tid) { return function () { return Player.travelTo(tid, { leaveCart: false, bringFamily: _travelBringFamily }); }; })(townId)
            });

            var leaveDays = hasHorse
                ? _calcDays(lDists.land, lDists.sea, 'horse', 'sail_own')
                : _calcDays(lDists.land, lDists.sea, 'walk', 'sail_own');
            options.push({
                id: 'land_leave_cart', icon: '🛒📦',
                name: 'Leave ' + containerCfg.name + ' Behind',
                desc: 'Travel light. Cart may be stolen (15%). Goods on it get raided daily.',
                cost: 0, days: leaveDays,
                available: true, route: 'land', routeChain: lChain,
                action: (function (tid) { return function () { return Player.travelTo(tid, { leaveCart: true, bringFamily: _travelBringFamily }); }; })(townId)
            });
        }

        // Land transport services
        var landTransport = getTransportServices(currentTown, destTown, 'land');
        for (var ti = 0; ti < landTransport.length; ti++) {
            var svc = landTransport[ti];
            options.push({
                id: 'land_transport_' + ti, icon: svc.icon || '🏇', name: svc.name,
                desc: svc.desc, cost: svc.price, days: svc.days,
                available: playerGold >= svc.price,
                unavailableReason: playerGold < svc.price ? 'Not enough gold' : '',
                route: 'land', routeChain: lChain,
                action: (function (service) { return function () { return Player.useTransportService(townId, service, { bringFamily: _travelBringFamily }); }; })(svc)
            });
        }
    }

    // --- MIXED ROUTE OPTIONS ---
    if (showMixed) {
        var mDists = _splitRouteDists(mixedRoute);
        var mChain = _segChain(mixedRoute);

        // Land modes available for mixed route
        var _landModes = [{ id: 'walk', icon: '🚶', name: 'Walk' }];
        if (hasHorse) _landModes.push({ id: 'horse', icon: '🐴', name: 'Ride' });

        // Sea modes available for mixed route
        var _seaModes = [];
        if (hasShip) _seaModes.push({ id: 'sail_own', icon: '⛵', name: 'Sail Own Ship', cost: 0 });
        _seaModes.push({ id: 'sea_passage', icon: '🚢', name: 'Book Passage', cost: CONFIG.SEA_PASSAGE_COST || 50 });

        // Generate one option per land×sea combination
        for (var mli = 0; mli < _landModes.length; mli++) {
            for (var msi = 0; msi < _seaModes.length; msi++) {
                var lm = _landModes[mli], sm = _seaModes[msi];
                var mixedCost = sm.cost;
                var mixedDays = _calcDays(mDists.land, mDists.sea, lm.id, sm.id);
                var mixedAvail = mixedCost === 0 || playerGold >= mixedCost;
                options.push({
                    id: 'mixed_' + lm.id + '_' + sm.id,
                    icon: lm.icon + sm.icon,
                    name: lm.name + ' + ' + sm.name,
                    desc: lm.name + ' on land, ' + sm.name.toLowerCase() + ' at sea.',
                    cost: mixedCost, days: mixedDays,
                    available: mixedAvail,
                    unavailableReason: !mixedAvail ? 'Not enough gold' : '',
                    route: 'mixed', routeChain: mChain,
                    action: (function (lMode, sMode) {
                        return function () {
                            return Player.travelTo(townId, { mode: lMode, seaMode: sMode, bringFamily: _travelBringFamily });
                        };
                    })(lm.id, sm.id)
                });
            }
        }
    }

    // --- SEA ROUTE OPTIONS ---
    if (showSea) {
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

        var seaChain = '<span style="white-space:nowrap;">⛵ ' + (currentTown.name || '?') + '</span>'
            + ' <span style="color:var(--text-muted);">→</span> '
            + '<span style="white-space:nowrap;">⛵ ' + (destTown.name || '?') + '</span>';

        // Sail own ship
        if (hasShip) {
            var sailDays = Math.max(1, Math.ceil(seaDist / seaSpd));
            options.push({
                id: 'sea_sail', icon: '⛵', name: 'Sail Your Ship',
                desc: 'Use your own vessel. Risk of pirates and storms.',
                cost: 0, days: sailDays,
                available: true, route: 'sea', routeChain: seaChain,
                action: function () { return Player.travelBySea(townId, { bringFamily: _travelBringFamily }); }
            });
        }

        // Paid passage
        var passageCost = CONFIG.SEA_PASSAGE_COST || 50;
        var passageDays = Math.max(1, Math.ceil(seaDist / passageSpd));
        options.push({
            id: 'sea_passage', icon: '🚢',
            name: 'Book Passage (' + passageCost + 'g)',
            desc: 'Pay for passage on a merchant vessel. Safer than solo.',
            cost: passageCost, days: passageDays,
            available: playerGold >= passageCost,
            unavailableReason: playerGold < passageCost ? 'Not enough gold' : '',
            route: 'sea', routeChain: seaChain,
            action: function () { return Player.travelBySea(townId, { paid: true, bringFamily: _travelBringFamily }); }
        });

        // Sea transport services
        var seaTransport = getTransportServices(currentTown, destTown, 'sea');
        for (var sti = 0; sti < seaTransport.length; sti++) {
            var ssvc = seaTransport[sti];
            options.push({
                id: 'sea_transport_' + sti, icon: ssvc.icon || '🚢', name: ssvc.name,
                desc: ssvc.desc, cost: ssvc.price, days: ssvc.days,
                available: playerGold >= ssvc.price,
                unavailableReason: playerGold < ssvc.price ? 'Not enough gold' : '',
                route: 'sea', routeChain: seaChain,
                action: (function (service) { return function () { return Player.useTransportService(townId, service, { bringFamily: _travelBringFamily }); }; })(ssvc)
            });
        }
    }

    // --- GOD MODE ---
    if (typeof Game !== 'undefined' && Game.isGodMode && Game.isGodMode()) {
        options.push({
            id: 'god_warp', icon: '⚡', name: 'Warp (God Mode)',
            desc: 'Instantly teleport to this town.',
            cost: 0, days: 0,
            available: true, route: 'god', routeChain: '⚡ Instant teleport',
            action: function () {
                var ps = Player.state;
                ps.townId = townId;
                ps.traveling = false;
                ps.travelRoute = null;
                ps.travelProgress = 0;
                ps.travelDestination = null;
                ps.travelBySea = false;
                ps.travelOffroad = false;
                if (destTown) {
                    ps.worldX = destTown.x;
                    ps.worldY = destTown.y;
                }
                toast('⚡ Warped to ' + destTown.name + '!', 'success');
                closeModal();
            }
        });
    }

    // ===== BUILD THE MODAL =====
    if (options.length === 0) {
        toast('No travel route available to ' + destTown.name + '.', 'warning');
        return;
    }

    var html = '<div style="max-height:450px;overflow-y:auto;">';
    html += '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:10px;">\u{1F4CD} ' + (currentTown.name || '?') + ' \u2192 ' + (destTown.name || '?') + '</p>';

    // ── Siege / Quarantine warnings for origin and destination ──
    var _warnOriginSiege = currentTown && currentTown.siege;
    var _warnDestSiege = destTown && destTown.siege;
    var _warnOriginQ = false, _warnDestQ = false;
    try {
        if (currentTown) {
            var _oqK = currentTown.kingdomId && Engine.findKingdom ? Engine.findKingdom(currentTown.kingdomId) : null;
            if (_oqK && _oqK.healthPolicies) {
                var _oqDay = Engine.getDay ? Engine.getDay() : 0;
                for (var _oqi = 0; _oqi < _oqK.healthPolicies.length; _oqi++) {
                    var _oqP = _oqK.healthPolicies[_oqi];
                    if (_oqP.active && _oqP.townId === currentTown.id && (!_oqP.expiresDay || _oqDay <= _oqP.expiresDay) &&
                        (_oqP.type === 'quarantine_town' || _oqP.type === 'martial_quarantine')) { _warnOriginQ = true; break; }
                }
            }
            if (!_warnOriginQ && currentTown.quarantined) _warnOriginQ = true;
        }
        if (destTown) {
            var _dqK = destTown.kingdomId && Engine.findKingdom ? Engine.findKingdom(destTown.kingdomId) : null;
            if (_dqK && _dqK.healthPolicies) {
                var _dqDay = Engine.getDay ? Engine.getDay() : 0;
                for (var _dqi = 0; _dqi < _dqK.healthPolicies.length; _dqi++) {
                    var _dqP = _dqK.healthPolicies[_dqi];
                    if (_dqP.active && _dqP.townId === destTown.id && (!_dqP.expiresDay || _dqDay <= _dqP.expiresDay) &&
                        (_dqP.type === 'quarantine_town' || _dqP.type === 'martial_quarantine')) { _warnDestQ = true; break; }
                }
            }
            if (!_warnDestQ && destTown.quarantined) _warnDestQ = true;
        }
    } catch(e) {}
    if (_warnOriginSiege || _warnDestSiege || _warnOriginQ || _warnDestQ) {
        html += '<div style="background:rgba(200,60,50,0.15);border:1px solid rgba(200,60,50,0.4);border-radius:8px;padding:8px 10px;margin-bottom:10px;">';
        if (_warnOriginSiege) html += '<div style="font-size:0.82rem;color:#e74c3c;margin-bottom:3px;">⚔️ <strong>' + currentTown.name + '</strong> is under siege! Leaving may be dangerous.</div>';
        if (_warnDestSiege) html += '<div style="font-size:0.82rem;color:#e74c3c;margin-bottom:3px;">⚔️ <strong>' + destTown.name + '</strong> is under siege! Entering may be dangerous.</div>';
        if (_warnOriginQ) html += '<div style="font-size:0.82rem;color:#e67e22;margin-bottom:3px;">🦠 <strong>' + currentTown.name + '</strong> is under quarantine. You may face checks leaving.</div>';
        if (_warnDestQ) html += '<div style="font-size:0.82rem;color:#e67e22;margin-bottom:3px;">🦠 <strong>' + destTown.name + '</strong> is under quarantine. You may face checks entering.</div>';
        html += '</div>';
    }

    // "Bring Family" checkbox if family members are in the same town
    var _familyInTown = [];
    if (typeof Player !== 'undefined' && Player.familyMembers && Player.familyMembers.length > 0) {
        for (var _ffi = 0; _ffi < Player.familyMembers.length; _ffi++) {
            var _ffm = Player.familyMembers[_ffi];
            var _ffp = Engine.findPerson(_ffm.npcId);
            if (_ffp && _ffp.alive && _ffp.townId === Player.townId) {
                _familyInTown.push(_ffm);
            }
        }
    }
    if (_familyInTown.length > 0) {
        html += '<div style="background:rgba(139,115,85,0.12);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px 10px;margin-bottom:10px;">';
        html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.88rem;color:var(--parchment);">';
        html += '<input type="checkbox" id="travelBringFamily" style="width:16px;height:16px;cursor:pointer;">';
        html += '<span>👨‍👩‍👧‍👦 Bring family along</span>';
        html += '</label>';
        html += '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;padding-left:24px;">';
        var _familyNames = _familyInTown.map(function(f) { return f.name + ' (' + f.role + ')'; });
        html += _familyNames.join(', ');
        html += '<br><span style="color:#e67e22;">⚠️ Family can be injured in encounters!</span>';
        html += '</div>';
        html += '</div>';
    }

    // Group options by route category
    var _routeOrder = ['land', 'mixed', 'sea', 'god'];
    for (var ro = 0; ro < _routeOrder.length; ro++) {
        var routeKey = _routeOrder[ro];
        var routeOpts = [];
        for (var oi = 0; oi < options.length; oi++) {
            if (options[oi].route === routeKey) routeOpts.push(options[oi]);
        }
        if (routeOpts.length === 0) continue;

        // Route category card
        html += '<div style="background:rgba(139,115,85,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px;margin-bottom:10px;">';
        var _rdInfo = routeDanger[routeKey];
        var _dangerHtml = '';
        if (_rdInfo && routeKey !== 'god') {
            var _dangerTip = _rdInfo.level.charAt(0).toUpperCase() + _rdInfo.level.slice(1) + ' risk';
            var _tipParts = [];
            if (_rdInfo.bandits > 0) _tipParts.push('Bandit threat: ' + _rdInfo.bandits + '/100');
            if (_rdInfo.atWar) _tipParts.push('War zone');
            if (_rdInfo.hasPirates) _tipParts.push('Pirates active');
            _dangerTip += _tipParts.length ? ' (' + _tipParts.join(', ') + ')' : '';
            _dangerTip += ' — Click for details';
            var _riskTypeLabel = _rdInfo.hasPirates && _rdInfo.bandits === 0 ? 'Pirate Risk' : (_rdInfo.atWar ? 'War Risk' : 'Bandit Risk');
            _dangerHtml = ' <span data-action="showRouteDangerDetail" data-id="' + routeKey + '" style="font-size:0.75rem;margin-left:6px;cursor:pointer;" title="' + _dangerTip + '">⚔️ <span style="color:' + _rdInfo.color + ';font-weight:bold;">' + _rdInfo.level.charAt(0).toUpperCase() + _rdInfo.level.slice(1) + '</span> <span style="color:#ddd;">' + _riskTypeLabel + '</span></span>';
        }
        html += '<div style="font-size:0.95rem;font-weight:bold;margin-bottom:4px;">' + (routeLabels[routeKey] || routeKey) + _dangerHtml + '</div>';
        html += '<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;line-height:1.5;">' + routeOpts[0].routeChain + '</div>';

        // Options within this category
        for (var oi2 = 0; oi2 < routeOpts.length; oi2++) {
            var opt = routeOpts[oi2];
            var isAvail = opt.available;
            var opacity = isAvail ? '1' : '0.4';

            html += '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:5px;padding:8px;margin-bottom:6px;opacity:' + opacity + ';">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<div style="flex:1;min-width:0;">';
            html += '<span style="font-size:1rem;">' + opt.icon + '</span> ';
            html += '<strong style="font-size:0.88rem;">' + opt.name + '</strong>';
            html += '<br><span style="font-size:0.75rem;color:var(--text-muted);">' + opt.desc + '</span>';
            html += '</div>';
            html += '<div style="text-align:right;min-width:75px;margin-left:8px;">';
            if (opt.days === 0) {
                html += '<div style="font-size:0.85rem;color:#8f8;">⚡ Instant</div>';
            } else {
                html += '<div style="font-size:0.85rem;color:var(--gold);">\u23F1\uFE0F ~' + opt.days + ' day' + (opt.days !== 1 ? 's' : '') + '</div>';
            }
            if (opt.cost > 0) {
                html += '<div style="font-size:0.8rem;color:#c9a96e;">\u{1F4B0} ' + opt.cost + 'g</div>';
            } else {
                html += '<div style="font-size:0.8rem;color:#8f8;">Free</div>';
            }
            html += '</div>';
            html += '</div>';
            if (isAvail) {
                html += '<button class="btn-medieval" style="width:100%;margin-top:5px;padding:5px;font-size:0.85rem;" data-action="confirmTravel" data-id="' + townId + '" data-val="' + opt.id + '">Select</button>';
            } else {
                html += '<div style="text-align:center;margin-top:3px;font-size:0.78rem;color:#c44e52;">' + (opt.unavailableReason || 'Unavailable') + '</div>';
            }
            html += '</div>';
        }

        html += '</div>'; // end route card
    }

    html += '</div>';

    // Store options for confirm handler
    _travelOptions = options;
    _travelDestTownId = townId;
    _travelRouteDanger = routeDanger;

    openModal('\u{1F5FA}\uFE0F Travel to ' + destTown.name, html);
}

function confirmTravel(townId, optionId) {
    var options = _travelOptions || [];
    var opt = null;
    for (var i = 0; i < options.length; i++) {
        if (options[i].id === optionId) { opt = options[i]; break; }
    }
    if (!opt || !opt.available || !opt.action) return;

    // Check origin town siege (leaving a besieged town) — skip for god mode
    if (optionId !== 'god_warp') {
        var _originTown = typeof Player !== 'undefined' && Player.townId && typeof Engine !== 'undefined' && Engine.findTown ? Engine.findTown(Player.townId) : null;
        if (_originTown && _originTown.siege) {
            _showSiegeExitPopup(townId, optionId, _originTown);
            return;
        }
    }

    _confirmTravelAfterOriginChecks(townId, optionId);
}

function _confirmTravelAfterOriginChecks(townId, optionId) {
    var options = _travelOptions || [];
    var opt = null;
    for (var i = 0; i < options.length; i++) {
        if (options[i].id === optionId) { opt = options[i]; break; }
    }
    if (!opt || !opt.available || !opt.action) return;

    // Check quarantine before executing travel (skip for god mode warp)
    if (optionId !== 'god_warp' && typeof Player !== 'undefined' && Player.getRouteQuarantineInfo) {
        var qInfo = Player.getRouteQuarantineInfo(townId);
        if (qInfo && qInfo.blocked) {
            // Show quarantine decision popup instead of traveling
            _showQuarantinePopup(townId, optionId, qInfo);
            return;
        }
    }

    // Check siege before executing travel (skip for god mode warp)
    if (optionId !== 'god_warp') {
        var _sTown = typeof Engine !== 'undefined' && Engine.findTown ? Engine.findTown(townId) : null;
        if (_sTown && _sTown.siege) {
            _showSiegeEntryPopup(townId, optionId, _sTown);
            return;
        }
        // Check for active revolt (blocks town like a siege)
        if (_sTown && _sTown._activeRevolt && _sTown._revoltBlocked) {
            _showRevoltEntryPopup(townId, optionId, _sTown);
            return;
        }
    }

    // No quarantine or siege — execute travel
    _executeTravel(townId, opt);
}

// ── SIEGE ENTRY POPUP ──
function _showSiegeEntryPopup(townId, optionId, town) {
    var siege = town.siege;
    var attackK = typeof Engine !== 'undefined' && Engine.findKingdom ? Engine.findKingdom(siege.attackerKingdomId) : null;
    var defendK = typeof Engine !== 'undefined' && Engine.findKingdom ? Engine.findKingdom(siege.defenderKingdomId) : null;
    var attackName = attackK ? attackK.name : 'Attackers';
    var defendName = defendK ? defendK.name : 'Defenders';
    var army = null;
    if (typeof Engine !== 'undefined' && Engine.getWorld) {
        var _w = Engine.getWorld();
        if (_w && _w.armies) army = _w.armies.find(function(a) { return a.id === siege.armyId; });
    }
    var attackStrength = army ? army.soldiers : 50;
    var defendStrength = (town.garrison || 0) + (town.garrisonMilitary || 0);
    var totalStrength = attackStrength + defendStrength;
    var attackPct = totalStrength > 0 ? Math.round(attackStrength / totalStrength * 100) : 50;
    var defendPct = 100 - attackPct;

    // Sneak chance — base 30%, +10% discrete, +5% street_smart
    var sneakChance = 0.30;
    if (typeof Player !== 'undefined' && Player.hasSkill) {
        if (Player.hasSkill('discrete')) sneakChance += 0.10;
        if (Player.hasSkill('street_smart')) sneakChance += 0.05;
        if (Player.hasSkill('cartographer')) sneakChance += 0.05;
    }
    var sneakPct = Math.round(sneakChance * 100);

    // Combat injury/death chances based on side strength
    var joinAttackWinChance = attackPct;
    var joinDefendWinChance = defendPct;
    var combatSkillBonus = 0;
    if (typeof Player !== 'undefined' && Player.hasSkill) {
        if (Player.hasSkill('combat_trained')) combatSkillBonus += 10;
        if (Player.hasSkill('tactical_leader')) combatSkillBonus += 5;
    }

    var html = '<div style="max-width:480px;">';

    // Header
    html += '<div style="text-align:center;margin-bottom:12px;">';
    html += '<div style="font-size:2rem;">⚔️🏰</div>';
    html += '<div style="font-size:1.2rem;color:var(--gold-bright);font-weight:bold;margin-top:4px;">' + (town.name || 'Town') + ' is Under Siege!</div>';
    html += '</div>';

    // Siege info
    html += '<div style="background:rgba(196,78,82,0.15);border:1px solid rgba(196,78,82,0.3);border-radius:6px;padding:10px;margin-bottom:10px;">';
    html += '<div style="font-size:0.85rem;color:var(--parchment);">⚔️ <strong style="color:#e67e22;">' + attackName + '</strong> (' + attackStrength + ' soldiers) is besieging <strong style="color:#55a868;">' + defendName + '</strong>\'s ' + (town.name || 'town') + ' (' + defendStrength + ' garrison).</div>';
    html += '<div style="font-size:0.8rem;color:#aaa;margin-top:4px;">Day ' + (siege.daysElapsed || 0) + ' of siege</div>';
    html += '</div>';

    // Strength bar
    html += '<div style="margin-bottom:10px;">';
    html += '<div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--parchment);margin-bottom:2px;">';
    html += '<span>⚔️ ' + attackName + ' ' + attackPct + '%</span><span>🛡️ ' + defendName + ' ' + defendPct + '%</span>';
    html += '</div>';
    html += '<div style="height:8px;border-radius:4px;background:rgba(255,255,255,0.1);overflow:hidden;">';
    html += '<div style="height:100%;width:' + attackPct + '%;background:linear-gradient(90deg,#c44e52,' + (attackPct > 60 ? '#ff6b6b' : '#c44e52') + ');"></div>';
    html += '</div></div>';

    // OPTIONS
    html += '<div style="font-size:0.85rem;color:var(--gold);font-weight:bold;margin-bottom:6px;">Choose your action:</div>';

    // 1. Sneak in
    html += '<div style="margin-bottom:8px;">';
    html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.9rem;background:rgba(196,78,82,0.25);border:2px solid rgba(196,78,82,0.6);color:#f0e6d2;" data-action="_siegeSneakAttempt" data-id="' + townId + '" data-val="' + optionId + '">🤫 <strong style="color:#fff;">Sneak In</strong> (<span style="color:#e67e22;font-weight:bold;">' + sneakPct + '%</span>)</button>';
    html += '<div style="font-size:0.7rem;color:#999;margin-top:2px;">Slip past the siege lines unnoticed. Failure means turning back.</div>';
    html += '</div>';

    // 2. Join attackers
    html += '<div style="margin-bottom:8px;">';
    html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.9rem;background:rgba(196,78,82,0.35);border:2px solid rgba(196,78,82,0.7);color:#f0e6d2;" data-action="_siegeJoinSide" data-id="' + townId + '" data-val="' + optionId + '" data-side="attacker" data-win="' + (joinAttackWinChance + combatSkillBonus) + '">⚔️ <strong style="color:#ff6b6b;">Join ' + attackName + '</strong> (Attackers — ~' + Math.min(95, joinAttackWinChance + combatSkillBonus) + '% win)</button>';
    html += '<div style="font-size:0.7rem;color:#999;margin-top:2px;">⚠️ <strong style="color:#e67e22;">DANGEROUS</strong> — Risk of injury or death. Reputation consequences with both kingdoms.</div>';
    html += '</div>';

    // 3. Join defenders
    html += '<div style="margin-bottom:8px;">';
    html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.9rem;background:rgba(46,204,113,0.25);border:2px solid rgba(46,204,113,0.5);color:#f0e6d2;" data-action="_siegeJoinSide" data-id="' + townId + '" data-val="' + optionId + '" data-side="defender" data-win="' + (joinDefendWinChance + combatSkillBonus) + '">🛡️ <strong style="color:#55a868;">Join ' + defendName + '</strong> (Defenders — ~' + Math.min(95, joinDefendWinChance + combatSkillBonus) + '% win)</button>';
    html += '<div style="font-size:0.7rem;color:#999;margin-top:2px;">⚠️ <strong style="color:#e67e22;">DANGEROUS</strong> — Risk of injury or death. You enter the town if defenders win.</div>';
    html += '</div>';

    // 4. Turn back
    html += '<div style="margin-bottom:4px;">';
    html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.85rem;background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.2);color:#aaa;" data-action="_siegeTurnBack">🔙 <strong>Turn Back</strong></button>';
    html += '</div>';

    html += '</div>';
    openModal('⚔️ Siege at ' + (town.name || 'Town'), html);
}

// ── SIEGE EXIT POPUP (leaving a besieged town) ──
function _showSiegeExitPopup(destTownId, optionId, originTown) {
    var siege = originTown.siege;
    var attackK = typeof Engine !== 'undefined' && Engine.findKingdom ? Engine.findKingdom(siege.attackerKingdomId) : null;
    var defendK = typeof Engine !== 'undefined' && Engine.findKingdom ? Engine.findKingdom(siege.defenderKingdomId) : null;
    var attackName = attackK ? attackK.name : 'Attackers';
    var defendName = defendK ? defendK.name : 'Defenders';

    // Sneak chance — base 35% (slightly easier to leave than enter), +skills
    var sneakChance = 0.35;
    if (typeof Player !== 'undefined' && Player.hasSkill) {
        if (Player.hasSkill('discrete')) sneakChance += 0.10;
        if (Player.hasSkill('street_smart')) sneakChance += 0.05;
        if (Player.hasSkill('cartographer')) sneakChance += 0.05;
    }
    var sneakPct = Math.round(sneakChance * 100);

    var html = '<div style="max-width:480px;">';
    html += '<div style="text-align:center;margin-bottom:12px;">';
    html += '<div style="font-size:2rem;">⚔️🏃</div>';
    html += '<div style="font-size:1.2rem;color:var(--gold-bright);font-weight:bold;margin-top:4px;">Leaving ' + (originTown.name || 'Town') + ' — Under Siege!</div>';
    html += '</div>';

    html += '<div style="background:rgba(196,78,82,0.15);border:1px solid rgba(196,78,82,0.3);border-radius:6px;padding:10px;margin-bottom:10px;">';
    html += '<div style="font-size:0.85rem;color:var(--parchment);">⚔️ <strong style="color:#e67e22;">' + attackName + '</strong> is besieging <strong style="color:#55a868;">' + defendName + '</strong>\'s ' + (originTown.name || 'town') + '. Leaving through siege lines is risky.</div>';
    html += '</div>';

    html += '<div style="font-size:0.85rem;color:var(--gold);font-weight:bold;margin-bottom:6px;">Choose your action:</div>';

    // 1. Sneak out
    html += '<div style="margin-bottom:8px;">';
    html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.9rem;background:rgba(196,78,82,0.25);border:2px solid rgba(196,78,82,0.6);color:#f0e6d2;" data-action="_siegeExitSneak" data-id="' + destTownId + '" data-val="' + optionId + '">🤫 <strong style="color:#fff;">Sneak Out</strong> (<span style="color:#e67e22;font-weight:bold;">' + sneakPct + '%</span>)</button>';
    html += '<div style="font-size:0.7rem;color:#999;margin-top:2px;">Slip past the siege lines. Failure means you stay in town.</div>';
    html += '</div>';

    // 2. Stay
    html += '<div style="margin-bottom:4px;">';
    html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.85rem;background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.2);color:#aaa;" data-action="_siegeTurnBack">🔙 <strong>Stay in Town</strong></button>';
    html += '</div>';

    html += '</div>';
    openModal('⚔️ Leaving Siege at ' + (originTown.name || 'Town'), html);
}

function _siegeExitSneak(destTownId, optionId) {
    var rng = typeof Engine !== 'undefined' && Engine.getRng ? Engine.getRng() : null;
    if (!rng) return;
    var sneakChance = 0.35;
    if (typeof Player !== 'undefined' && Player.hasSkill) {
        if (Player.hasSkill('discrete')) sneakChance += 0.10;
        if (Player.hasSkill('street_smart')) sneakChance += 0.05;
        if (Player.hasSkill('cartographer')) sneakChance += 0.05;
    }
    if (rng.random() < sneakChance) {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🤫 You slipped out past the siege lines!', 'success');
        if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal();
        // Continue with destination checks (quarantine, destination siege, etc.)
        _confirmTravelAfterOriginChecks(destTownId, optionId);
    } else {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚫 Spotted by sentries! You had to retreat back into town.', 'danger');
        if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal();
    }
}

function _siegeSneakAttempt(townId, optionId) {
    var rng = typeof Engine !== 'undefined' && Engine.getRng ? Engine.getRng() : null;
    if (!rng) return;
    var sneakChance = 0.30;
    if (typeof Player !== 'undefined' && Player.hasSkill) {
        if (Player.hasSkill('discrete')) sneakChance += 0.10;
        if (Player.hasSkill('street_smart')) sneakChance += 0.05;
        if (Player.hasSkill('cartographer')) sneakChance += 0.05;
    }
    if (rng.random() < sneakChance) {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🤫 You slipped past the siege lines undetected!', 'success');
        if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal();
        // Find the travel option and execute
        var options = _travelOptions || [];
        for (var i = 0; i < options.length; i++) {
            if (options[i].id === optionId) { _executeTravel(townId, options[i]); return; }
        }
    } else {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚫 Spotted by sentries! You had to turn back.', 'danger');
        if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal();
    }
}

// ── REVOLT ENTRY POPUP ──
function _showRevoltEntryPopup(townId, optionId, town) {
    var revolt = town._activeRevolt;
    var parentK = typeof Engine !== 'undefined' && Engine.findKingdom ? Engine.findKingdom(revolt.parentKingdomId) : null;
    var parentName = parentK ? parentK.name : 'the Kingdom';
    var groupName = revolt.groupName || 'Rebels';

    var rebelStr = revolt.rebelStrength || revolt.rebelCount || 0;
    var defStr = revolt.defenderStrength || revolt.defenderCount || 0;
    var totalStr = rebelStr + defStr;
    var rebelPct = totalStr > 0 ? Math.round(rebelStr / totalStr * 100) : 50;
    var defPct = 100 - rebelPct;

    // Sneak chance — base 25%, skills add more
    var sneakChance = 0.25;
    if (typeof Player !== 'undefined' && Player.hasSkill) {
        if (Player.hasSkill('discrete')) sneakChance += 0.10;
        if (Player.hasSkill('street_smart')) sneakChance += 0.05;
    }
    var sneakPct = Math.round(sneakChance * 100);

    var combatSkillBonus = 0;
    if (typeof Player !== 'undefined' && Player.hasSkill) {
        if (Player.hasSkill('combat_trained')) combatSkillBonus += 10;
        if (Player.hasSkill('tactical_leader')) combatSkillBonus += 5;
    }

    var html = '<div style="text-align:center;margin-bottom:12px;">';
    html += '<h3 style="color:#ff6b6b;margin:0;">🔥 REVOLT in ' + (town.name || 'Town') + '!</h3>';
    html += '<p style="color:#f0e6d2;font-size:0.85rem;margin:6px 0;">' + groupName + ' has risen against ' + parentName + '!</p>';
    html += '<div style="display:flex;justify-content:space-around;margin:8px 0;">';
    html += '<div style="text-align:center;"><span style="color:#ff6b6b;">🔥 ' + groupName + '</span><br><strong>' + (revolt.rebelCount || '?') + '</strong> rebels (' + rebelPct + '%)</div>';
    html += '<div style="text-align:center;"><span style="color:#55a868;">🛡️ ' + parentName + '</span><br><strong>' + (revolt.defenderCount || '?') + '</strong> defenders (' + defPct + '%)</div>';
    html += '</div>';
    html += '<p style="color:#b8a88a;font-size:0.8rem;margin:4px 0;">Day ' + revolt.daysElapsed + ' of ' + revolt.duration + '</p>';
    html += '</div>';

    // Option: sneak in
    html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.9rem;margin-bottom:6px;background:rgba(44,62,80,0.5);border:2px solid rgba(149,165,166,0.5);color:#f0e6d2;" data-action="_revoltSneak" data-id="' + townId + '" data-val="' + optionId + '">🤫 Sneak into town (~' + sneakPct + '% success)</button>';

    // Option: join rebels
    html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.9rem;margin-bottom:6px;background:rgba(196,78,82,0.35);border:2px solid rgba(196,78,82,0.7);color:#f0e6d2;" data-action="_revoltJoinSide" data-id="' + townId + '" data-val="' + optionId + '" data-side="rebels" data-win="' + Math.min(95, rebelPct + combatSkillBonus) + '">🔥 <strong style="color:#ff6b6b;">Join ' + groupName + '</strong> (Rebels — ~' + Math.min(95, rebelPct + combatSkillBonus) + '% win)</button>';

    // Option: join defenders
    html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.9rem;margin-bottom:6px;background:rgba(46,204,113,0.25);border:2px solid rgba(46,204,113,0.5);color:#f0e6d2;" data-action="_revoltJoinSide" data-id="' + townId + '" data-val="' + optionId + '" data-side="defenders" data-win="' + Math.min(95, defPct + combatSkillBonus) + '">🛡️ <strong style="color:#55a868;">Join ' + parentName + '</strong> (Defenders — ~' + Math.min(95, defPct + combatSkillBonus) + '% win)</button>';

    // Option: turn back
    html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.9rem;background:rgba(80,80,80,0.4);border:2px solid rgba(120,120,120,0.5);color:#b8a88a;" data-action="_revoltTurnBack">↩️ Turn back</button>';

    if (typeof openModal === 'function') {
        openModal('Revolt in ' + (town.name || 'Town'), html);
    } else if (typeof UI !== 'undefined' && UI.openModal) {
        UI.openModal('Revolt in ' + (town.name || 'Town'), html);
    }
}

function _revoltSneak(townId, optionId) {
    var rng = typeof Engine !== 'undefined' && Engine.getRng ? Engine.getRng() : null;
    if (!rng) return;
    var sneakChance = 0.25;
    if (typeof Player !== 'undefined' && Player.hasSkill) {
        if (Player.hasSkill('discrete')) sneakChance += 0.10;
        if (Player.hasSkill('street_smart')) sneakChance += 0.05;
    }
    if (rng.random() < sneakChance) {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🤫 You slipped past the chaos undetected!', 'success');
        if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal();
        var options = _travelOptions || [];
        for (var i = 0; i < options.length; i++) {
            if (options[i].id === optionId) { _executeTravel(townId, options[i]); return; }
        }
    } else {
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚫 The streets are too dangerous! You had to turn back.', 'danger');
        if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal();
    }
}

function _revoltJoinSide(townId, optionId, side, winChance) {
    var rng = typeof Engine !== 'undefined' && Engine.getRng ? Engine.getRng() : null;
    if (!rng) return;
    var town = typeof Engine !== 'undefined' && Engine.findTown ? Engine.findTown(townId) : null;
    if (!town || !town._activeRevolt) { if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal(); return; }
    var revolt = town._activeRevolt;

    var winPct = Math.min(95, Math.max(5, parseInt(winChance) || 50));
    var won = rng.random() * 100 < winPct;
    var parentK = typeof Engine !== 'undefined' && Engine.findKingdom ? Engine.findKingdom(revolt.parentKingdomId) : null;

    if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal();

    // Injury/death calculation
    var deathChance = won ? 0.04 : 0.10;
    var severeInjuryChance = won ? 0.15 : 0.30;
    var moderateInjuryChance = won ? 0.25 : 0.35;
    if (typeof Player !== 'undefined' && Player.hasSkill) {
        if (Player.hasSkill('combat_trained')) { deathChance *= 0.6; severeInjuryChance *= 0.7; }
        if (Player.hasSkill('first_aid')) { severeInjuryChance *= 0.8; moderateInjuryChance *= 0.8; }
    }

    // Check death
    if (rng.random() < deathChance && !window._godInvincible) {
        if (typeof Player !== 'undefined' && Player.state) Player.state.deathCause = 'Killed in the revolt at ' + (town.name || 'a town');
        if (typeof Engine !== 'undefined' && Engine.logEvent) Engine.logEvent('💀 You were killed fighting in the revolt at ' + (town.name || 'a town') + '!');
        if (typeof Player !== 'undefined' && Player.handlePlayerDeath) Player.handlePlayerDeath();
        return;
    }

    // Check injury
    var injuryMsg = '';
    if (rng.random() < severeInjuryChance) {
        if (typeof Player !== 'undefined' && Player.state) {
            Player.state.injured = true;
            Player.state.injurySeverity = 'severe';
            Player.state.injuryType = 'battle_wound';
            Player.state.injuryDay = typeof Engine !== 'undefined' && Engine.getDay ? Engine.getDay() : 0;
        }
        injuryMsg = ' You suffered a severe battle wound!';
    } else if (rng.random() < moderateInjuryChance) {
        if (typeof Player !== 'undefined' && Player.state) {
            Player.state.injured = true;
            Player.state.injurySeverity = 'moderate';
            Player.state.injuryType = 'battle_wound';
            Player.state.injuryDay = typeof Engine !== 'undefined' && Engine.getDay ? Engine.getDay() : 0;
        }
        injuryMsg = ' You suffered a moderate wound.';
    }

    var alliedName = side === 'rebels' ? (revolt.groupName || 'Rebels') : (parentK ? parentK.name : 'Defenders');

    if (won) {
        // Give a small combat boost to the side the player joined
        if (side === 'rebels') {
            revolt.rebelMorale = Math.min(100, (revolt.rebelMorale || 50) + 10);
            revolt.rebelStrength = Math.floor((revolt.rebelStrength || 0) * 1.1);
            // Track player helped rebels for post-revolt deal
            if (typeof Player !== 'undefined' && Player.state) {
                Player.state._helpedRevolt = { townId: town.id, side: 'rebels', day: typeof Engine !== 'undefined' && Engine.getDay ? Engine.getDay() : 0 };
            }
        } else {
            revolt.defenderMorale = Math.min(100, (revolt.defenderMorale || 50) + 10);
            revolt.defenderStrength = Math.floor((revolt.defenderStrength || 0) * 1.1);
        }

        // Reputation with relevant faction
        if (typeof Player !== 'undefined' && Player.state) {
            if (side === 'defenders' && parentK) {
                Player.state.reputation = Player.state.reputation || {};
                Player.state.reputation[parentK.id] = Math.min(100, (Player.state.reputation[parentK.id] || 50) + 5);
            }
        }

        if (typeof Engine !== 'undefined' && Engine.logEvent) Engine.logEvent('⚔️ You fought alongside ' + alliedName + ' in the revolt and won!' + injuryMsg);
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚔️ Victory! You helped ' + alliedName + '!' + injuryMsg, 'success');

        // Add journal entry
        if (typeof Player !== 'undefined' && Player.addJournalEntry) {
            Player.addJournalEntry('Fought in revolt at ' + town.name + ' alongside ' + alliedName + ' — victorious!' + injuryMsg);
        }
    } else {
        if (side === 'rebels') {
            revolt.rebelMorale = Math.max(0, (revolt.rebelMorale || 50) - 5);
        } else {
            revolt.defenderMorale = Math.max(0, (revolt.defenderMorale || 50) - 5);
        }

        if (typeof Engine !== 'undefined' && Engine.logEvent) Engine.logEvent('⚔️ You fought alongside ' + alliedName + ' in the revolt but lost the skirmish.' + injuryMsg);
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚔️ Defeat. ' + alliedName + ' lost ground.' + injuryMsg, 'warning');

        if (typeof Player !== 'undefined' && Player.addJournalEntry) {
            Player.addJournalEntry('Fought in revolt at ' + town.name + ' alongside ' + alliedName + ' — defeated.' + injuryMsg);
        }
    }

    // Enter the town
    var options = _travelOptions || [];
    for (var i = 0; i < options.length; i++) {
        if (options[i].id === optionId) { _executeTravel(townId, options[i]); return; }
    }
}

function _revoltTurnBack() {
    if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal();
    if (typeof UI !== 'undefined' && UI.toast) UI.toast('↩️ You turned back from the revolt.', 'info');
}

function _siegeJoinSide(townId, optionId, side, winChance) {
    var rng = typeof Engine !== 'undefined' && Engine.getRng ? Engine.getRng() : null;
    if (!rng) return;
    var town = typeof Engine !== 'undefined' && Engine.findTown ? Engine.findTown(townId) : null;
    if (!town || !town.siege) { if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal(); return; }
    var siege = town.siege;

    var winPct = Math.min(95, Math.max(5, parseInt(winChance) || 50));
    var won = rng.random() * 100 < winPct;
    var playerKingdomId = typeof Player !== 'undefined' && Player.state ? Player.state.citizenshipKingdomId : null;

    // Determine allied/enemy kingdoms
    var alliedKingdomId = side === 'attacker' ? siege.attackerKingdomId : siege.defenderKingdomId;
    var enemyKingdomId = side === 'attacker' ? siege.defenderKingdomId : siege.attackerKingdomId;
    var alliedK = typeof Engine !== 'undefined' && Engine.findKingdom ? Engine.findKingdom(alliedKingdomId) : null;
    var enemyK = typeof Engine !== 'undefined' && Engine.findKingdom ? Engine.findKingdom(enemyKingdomId) : null;
    var alliedName = alliedK ? alliedK.name : 'Allies';

    if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal();

    // Injury/death calculation
    var deathChance = won ? 0.03 : 0.08; // 3% if won, 8% if lost
    var severeInjuryChance = won ? 0.12 : 0.25;
    var moderateInjuryChance = won ? 0.25 : 0.35;
    if (typeof Player !== 'undefined' && Player.hasSkill) {
        if (Player.hasSkill('combat_trained')) { deathChance *= 0.6; severeInjuryChance *= 0.7; }
        if (Player.hasSkill('first_aid')) { severeInjuryChance *= 0.8; moderateInjuryChance *= 0.8; }
    }

    // Check death
    if (rng.random() < deathChance && !window._godInvincible) {
        if (typeof Player !== 'undefined' && Player.state) Player.state.deathCause = 'Killed in the siege of ' + (town.name || 'a town');
        if (typeof Engine !== 'undefined' && Engine.logEvent) Engine.logEvent('💀 ' + (typeof Player !== 'undefined' && Player.state ? Player.state.fullName : 'You') + ' was killed fighting in the siege of ' + (town.name || 'a town') + '!');
        if (typeof Player !== 'undefined' && Player.handlePlayerDeath) Player.handlePlayerDeath();
        return;
    }

    // Check injury
    var injuryMsg = '';
    if (rng.random() < severeInjuryChance) {
        if (typeof Player !== 'undefined' && Player.state) {
            Player.state.injured = true;
            Player.state.injurySeverity = 'severe';
            Player.state.injuryType = 'battle_wound';
            Player.state.injuryDay = typeof Engine !== 'undefined' && Engine.getDay ? Engine.getDay() : 0;
        }
        injuryMsg = ' You suffered a severe battle wound!';
    } else if (rng.random() < moderateInjuryChance) {
        if (typeof Player !== 'undefined' && Player.state) {
            Player.state.injured = true;
            Player.state.injurySeverity = 'moderate';
            Player.state.injuryType = 'battle_wound';
            Player.state.injuryDay = typeof Engine !== 'undefined' && Engine.getDay ? Engine.getDay() : 0;
        }
        injuryMsg = ' You suffered a moderate wound.';
    }

    if (won) {
        // Reputation gains with allied kingdom
        if (typeof Player !== 'undefined' && Player.state) {
            Player.state.reputation = Player.state.reputation || {};
            Player.state.reputation[alliedKingdomId] = Math.min(100, (Player.state.reputation[alliedKingdomId] || 50) + 3);
            // +5 relationship with allied king
            if (alliedK && alliedK.kingId) {
                if (typeof Player !== 'undefined' && Player.modifyRelationship) Player.modifyRelationship(alliedK.kingId, 5, 'battle_ally');
            }
            // +2 with all allied nobles
            var _people = typeof Engine !== 'undefined' && Engine.getPeople ? Engine.getPeople() : [];
            for (var _i = 0; _i < _people.length; _i++) {
                var _p = _people[_i];
                if (_p.alive && _p.socialRank && (_p.socialRank[alliedKingdomId] || 0) >= 4) {
                    if (typeof Player !== 'undefined' && Player.modifyRelationship) Player.modifyRelationship(_p.id, 2, 'battle_ally');
                }
            }
            // Reputation loss with enemy
            Player.state.reputation[enemyKingdomId] = Math.max(0, (Player.state.reputation[enemyKingdomId] || 50) - 1);
            if (enemyK && enemyK.kingId) {
                if (typeof Player !== 'undefined' && Player.modifyRelationship) Player.modifyRelationship(enemyK.kingId, -2, 'battle_enemy');
            }
        }
        if (typeof Engine !== 'undefined' && Engine.logEvent) Engine.logEvent('⚔️ You fought alongside ' + alliedName + ' and won the battle!' + injuryMsg);
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚔️ Victory! You helped ' + alliedName + ' win! +3 kingdom rep.' + injuryMsg, 'success');

        // If defending side won, player enters the town
        if (side === 'defender') {
            var options = _travelOptions || [];
            for (var i = 0; i < options.length; i++) {
                if (options[i].id === optionId) { _executeTravel(townId, options[i]); return; }
            }
        }
    } else {
        // Lost the battle
        if (typeof Player !== 'undefined' && Player.state) {
            Player.state.reputation = Player.state.reputation || {};
            Player.state.reputation[alliedKingdomId] = Math.min(100, (Player.state.reputation[alliedKingdomId] || 50) + 1); // still get some rep for trying
        }
        if (typeof Engine !== 'undefined' && Engine.logEvent) Engine.logEvent('⚔️ You fought alongside ' + alliedName + ' but your side was defeated.' + injuryMsg);
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚔️ Defeat! ' + alliedName + ' lost the battle.' + injuryMsg, 'danger');
    }
}

function _siegeTurnBack() {
    if (typeof UI !== 'undefined' && UI.closeModal) UI.closeModal();
    if (typeof UI !== 'undefined' && UI.toast) UI.toast('🔙 You turned back from the besieged town.', 'info');
}

function _showQuarantinePopup(townId, optionId, qInfo) {
    var qIcon = qInfo.isMartial ? '⚔️🔒' : '🔒';
    var sneakPct = Math.round(qInfo.sneakChance * 100);
    var playerGold = (typeof Player !== 'undefined' && Player.gold != null) ? Player.gold : 0;

    var html = '<div style="max-width:460px;">';

    // Header
    html += '<div style="text-align:center;margin-bottom:12px;">';
    html += '<div style="font-size:2rem;">' + qIcon + '</div>';
    html += '<div style="font-size:1.2rem;color:var(--gold-bright);font-weight:bold;margin-top:4px;">' + qInfo.townName + ' is under ' + qInfo.qLabel + '!</div>';
    html += '</div>';

    // Guard name
    var _guardRelTag = '';
    if (qInfo.guardRelLevel >= 60) _guardRelTag = ' <span style="color:#55a868;font-size:0.75rem;">(Friendly)</span>';
    else if (qInfo.guardRelLevel >= 40) _guardRelTag = ' <span style="color:#e6c422;font-size:0.75rem;">(Known)</span>';
    html += '<div style="text-align:center;margin-bottom:10px;font-size:0.9rem;color:var(--parchment);">🛡️ Guard: <strong style="color:var(--gold);">' + (qInfo.guardName || 'Guard Captain') + '</strong>' + _guardRelTag + '</div>';

    html += '<div style="background:rgba(196,78,82,0.15);border:1px solid rgba(196,78,82,0.3);border-radius:6px;padding:10px;margin-bottom:10px;">';
    html += '<div style="font-size:0.85rem;color:var(--parchment);">Your route passes through a quarantine zone. Travel is restricted to certain social ranks.</div>';
    html += '</div>';

    // Allowed ranks
    html += '<div style="margin-bottom:10px;">';
    html += '<div style="font-size:0.8rem;color:var(--gold);font-weight:bold;margin-bottom:3px;">✅ Allowed Through:</div>';
    for (var ri = 0; ri < qInfo.allowedRanks.length; ri++) {
        html += '<div style="font-size:0.8rem;color:var(--parchment);padding-left:12px;">• ' + qInfo.allowedRanks[ri] + '</div>';
    }
    html += '</div>';

    // === Sneak Past section ===
    html += '<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:10px;margin-bottom:10px;">';
    html += '<div style="font-size:0.85rem;color:var(--gold);font-weight:bold;margin-bottom:4px;">🤫 Sneak Past the Guards</div>';

    // Sneak chance bar
    var barColor = sneakPct >= 50 ? '#55a868' : (sneakPct >= 30 ? '#e67e22' : '#c44e52');
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">';
    html += '<div style="font-size:0.8rem;color:var(--text-muted);min-width:90px;">Sneak chance:</div>';
    html += '<div style="flex:1;height:14px;background:rgba(0,0,0,0.3);border-radius:7px;overflow:hidden;">';
    html += '<div style="width:' + sneakPct + '%;height:100%;background:' + barColor + ';border-radius:7px;"></div>';
    html += '</div>';
    html += '<div style="font-size:0.9rem;font-weight:bold;color:' + barColor + ';min-width:40px;text-align:right;">' + sneakPct + '%</div>';
    html += '</div>';

    // Sneak skill modifiers
    if (qInfo.sneakModifiers && qInfo.sneakModifiers.length > 0) {
        html += '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:4px;">Bonuses: ';
        var _smParts = [];
        for (var _smi = 0; _smi < qInfo.sneakModifiers.length; _smi++) {
            _smParts.push(qInfo.sneakModifiers[_smi].name + ' (+' + qInfo.sneakModifiers[_smi].bonus + '%)');
        }
        html += _smParts.join(', ') + '</div>';
    }

    // Sneak button
    html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.9rem;background:rgba(196,78,82,0.25);border:2px solid rgba(196,78,82,0.6);color:#f0e6d2;" data-action="_quarantineSneakAttempt" data-id="' + townId + '" data-val="' + optionId + '">🤫 <strong style="color:#fff;">Try to Sneak</strong> (<span style="color:#e67e22;font-weight:bold;">' + sneakPct + '%</span>)</button>';
    html += '</div>';

    // === Bribe the Guard section ===
    html += '<div style="background:rgba(218,165,32,0.08);border:1px solid rgba(218,165,32,0.25);border-radius:6px;padding:10px;margin-bottom:10px;">';
    html += '<div style="font-size:0.85rem;color:var(--gold);font-weight:bold;margin-bottom:6px;">💰 Bribe the Guard</div>';

    if (qInfo.bribes && qInfo.bribes.length > 0) {
        var _bribeColors = { low: '#c44e52', medium: '#e67e22', high: '#55a868' };
        for (var _bi = 0; _bi < qInfo.bribes.length; _bi++) {
            var _b = qInfo.bribes[_bi];
            var _bPct = Math.round(_b.chance * 100);
            var _bColor = _bribeColors[_b.tier] || '#888';
            var _bDisabled = playerGold < _b.cost;
            var _bStyle = 'width:100%;padding:8px 10px;font-size:0.85rem;margin-bottom:4px;';
            if (_bDisabled) {
                _bStyle += 'opacity:0.4;cursor:not-allowed;background:rgba(100,100,100,0.2);border-color:rgba(100,100,100,0.3);color:#888;';
            } else {
                _bStyle += 'background:rgba(' + (_b.tier === 'low' ? '196,78,82' : (_b.tier === 'medium' ? '230,126,34' : '85,168,104')) + ',0.25);border:2px solid ' + _bColor + ';color:#f0e6d2;';
            }
            html += '<button class="btn-medieval" style="' + _bStyle + '"';
            if (_bDisabled) {
                html += ' disabled';
            } else {
                html += ' data-action="_quarantineBribeAttempt" data-id="' + townId + '" data-val="' + optionId + '" data-type="' + _b.tier + '" data-cost="' + _b.cost + '"';
            }
            html += '>';
            html += '<strong style="color:#fff;">' + _b.label + '</strong> — <strong style="color:#ffd700;">' + _b.cost + 'g</strong> (<span style="color:' + _bColor + ';font-weight:bold;font-size:1rem;">' + _bPct + '%</span>)';
            if (_bDisabled) html += ' <span style="font-size:0.75rem;color:#888;">(not enough gold)</span>';
            html += '</button>';
        }
    }

    // Bribe skill modifiers
    if (qInfo.bribeModifiers && qInfo.bribeModifiers.length > 0) {
        html += '<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">Bonuses: ';
        var _bmParts = [];
        for (var _bmi = 0; _bmi < qInfo.bribeModifiers.length; _bmi++) {
            _bmParts.push(qInfo.bribeModifiers[_bmi].name + ' (+' + qInfo.bribeModifiers[_bmi].bonus + '%)');
        }
        html += _bmParts.join(', ') + '</div>';
    }
    html += '</div>';

    // === Doctor Persuasion section ===
    if (qInfo.doctorPersuasion) {
        var _dp = qInfo.doctorPersuasion;
        var _dpPct = Math.round(_dp.chance * 100);
        html += '<div style="background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25);border-radius:6px;padding:10px;margin-bottom:10px;">';
        html += '<div style="font-size:0.85rem;color:var(--gold);font-weight:bold;margin-bottom:6px;">⚕️ Medical Persuasion</div>';
        html += '<div style="font-size:0.8rem;color:var(--parchment);margin-bottom:6px;">Convince the guard you need passage for medical reasons. <strong style="color:#55a868;">No penalty if refused</strong> — 7 day cooldown on failure.</div>';
        if (_dp.reasons && _dp.reasons.length > 0) {
            html += '<div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;">';
            for (var _dri = 0; _dri < _dp.reasons.length; _dri++) {
                html += '<div>• ' + _dp.reasons[_dri] + '</div>';
            }
            html += '</div>';
        }
        if (_dp.onCooldown) {
            html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.85rem;opacity:0.4;cursor:not-allowed;background:rgba(100,100,100,0.2);border-color:rgba(100,100,100,0.3);color:#888;" disabled>';
            html += '⚕️ <strong>Persuade Guard</strong> — cooldown: ' + _dp.cooldownDays + ' day' + (_dp.cooldownDays > 1 ? 's' : '') + ' remaining';
            html += '</button>';
        } else {
            html += '<button class="btn-medieval" style="width:100%;padding:8px 10px;font-size:0.85rem;background:rgba(46,204,113,0.25);border:2px solid #55a868;color:#f0e6d2;" data-action="_quarantineDoctorPersuade" data-id="' + townId + '" data-val="' + optionId + '">';
            html += '⚕️ <strong style="color:#fff;">Persuade Guard</strong> (<span style="color:#55a868;font-weight:bold;font-size:1rem;">' + _dpPct + '%</span>)';
            html += '</button>';
        }
        html += '</div>';
    }

    // === Consequences Warning ===
    html += '<div style="background:rgba(139,69,19,0.12);border:1px solid rgba(139,69,19,0.3);border-radius:6px;padding:8px;margin-bottom:10px;font-size:0.78rem;color:var(--text-muted);">';
    html += '<div style="font-weight:bold;color:var(--gold);margin-bottom:3px;">⚠️ Consequences if Caught</div>';
    html += '<div>Sneaking: <strong>' + (qInfo.sneakFine || 0) + 'g</strong> fine or <strong>' + (qInfo.sneakJailDays || 0) + '</strong> days jail</div>';
    html += '<div>Bribing: <strong>' + (qInfo.bribeFine || 0) + 'g</strong> fine or <strong>' + (qInfo.bribeJailDays || 0) + '</strong> days jail <span style="color:#c44e52;">(bribery charge)</span></div>';
    var _kingDesc = 'fair';
    if (qInfo.kingTemperament === 'strict') _kingDesc = '<span style="color:#c44e52;">strict</span>';
    else if (qInfo.kingTemperament === 'merciful') _kingDesc = '<span style="color:#55a868;">merciful</span>';
    html += '<div style="margin-top:3px;font-style:italic;">This king is known to be ' + _kingDesc + '.</div>';
    html += '</div>';

    // Turn Back button
    html += '<div style="text-align:center;">';
    html += '<button class="btn-medieval" style="padding:8px 24px;font-size:0.9rem;" data-action="closeModal">🚫 Turn Back</button>';
    html += '</div>';

    html += '</div>';
    openModal(qIcon + ' Quarantine Checkpoint', html);
}

function _quarantineSneakAttempt(townId, optionId) {
    closeModal();

    // Execute the sneak attempt through Player
    var sneakResult = Player.attemptQuarantineSneak(townId);

    if (sneakResult && !sneakResult.allowed) {
        // Caught — message already toasted by _checkRouteQuarantine
        return;
    }

    // Sneak succeeded or no quarantine — proceed with travel, skipping the quarantine check
    var options = _travelOptions || [];
    var opt = null;
    for (var i = 0; i < options.length; i++) {
        if (options[i].id === optionId) { opt = options[i]; break; }
    }
    if (!opt || !opt.action) return;

    if (sneakResult && sneakResult.allowed && sneakResult.message) {
        toast(sneakResult.message, 'success', 'travel_events');
    }

    // Wrap the action to add skipQuarantineCheck
    closeRightPanel();
    try {
        // We need to pass skipQuarantineCheck to the underlying Player.travelTo call
        // Temporarily patch the action to include skipQuarantineCheck
        var result = _executeTravelAction(townId, opt);
        if (result && result.success === false) {
            toast(result.message || 'Travel failed.', 'danger');
            return;
        }
    } catch (e) {
        toast('Travel error: ' + (e.message || e), 'danger');
        return;
    }
    if (typeof Renderer !== 'undefined') {
        var town = Engine.getTown(townId);
        if (town) Renderer.panTo(town.x, town.y);
    }
}

function _quarantineBribeAttempt(townId, optionId, tier, bribeCost) {
    closeModal();

    // Execute the bribe attempt through Player
    var bribeResult = Player.attemptQuarantineBribe(townId, tier, bribeCost);

    if (bribeResult && !bribeResult.allowed) {
        // Caught — message already toasted by attemptQuarantineBribe
        return;
    }

    // Bribe succeeded — proceed with travel, skipping the quarantine check
    var options = _travelOptions || [];
    var opt = null;
    for (var i = 0; i < options.length; i++) {
        if (options[i].id === optionId) { opt = options[i]; break; }
    }
    if (!opt || !opt.action) return;

    if (bribeResult && bribeResult.allowed && bribeResult.message) {
        toast(bribeResult.message, 'success', 'travel_events');
    }

    closeRightPanel();
    try {
        var result = _executeTravelAction(townId, opt);
        if (result && result.success === false) {
            toast(result.message || 'Travel failed.', 'danger');
            return;
        }
    } catch (e) {
        toast('Travel error: ' + (e.message || e), 'danger');
        return;
    }
    if (typeof Renderer !== 'undefined') {
        var town = Engine.getTown(townId);
        if (town) Renderer.panTo(town.x, town.y);
    }
}

function _quarantineDoctorPersuade(townId, optionId) {
    closeModal();

    var result = Player.attemptQuarantineDoctorPersuasion(townId);

    if (result && !result.allowed) {
        // Failed — toast already shown by player.js, re-open popup after brief delay
        setTimeout(function() {
            var qInfo = Player.getRouteQuarantineInfo(townId);
            if (qInfo && qInfo.blocked) _showQuarantinePopup(townId, optionId, qInfo);
        }, 1500);
        return;
    }

    // Success — proceed with travel
    var options = _travelOptions || [];
    var opt = null;
    for (var i = 0; i < options.length; i++) {
        if (options[i].id === optionId) { opt = options[i]; break; }
    }
    if (!opt || !opt.action) return;

    if (result && result.allowed && result.message) {
        toast(result.message, 'success', 'travel_events');
    }

    closeRightPanel();
    try {
        var travelResult = _executeTravelAction(townId, opt);
        if (travelResult && travelResult.success === false) {
            toast(travelResult.message || 'Travel failed.', 'danger');
            return;
        }
    } catch (e) {
        toast('Travel error: ' + (e.message || e), 'danger');
        return;
    }
    if (typeof Renderer !== 'undefined') {
        var town = Engine.getTown(townId);
        if (town) Renderer.panTo(town.x, town.y);
    }
}

function _executeTravelAction(townId, opt) {
    // For standard travel options, call Player.travelTo with skipQuarantineCheck
    // Parse the option to determine what kind of travel
    if (opt.id && opt.id.indexOf('land_walk') === 0) return Player.travelTo(townId, { skipQuarantineCheck: true, bringFamily: _travelBringFamily });
    if (opt.id && opt.id.indexOf('land_horse') === 0) return Player.travelTo(townId, { mode: 'horse', skipQuarantineCheck: true, bringFamily: _travelBringFamily });
    if (opt.id && opt.id.indexOf('land_buy_horse') === 0) {
        return Player.buyHorseForTravel(townId, opt.cost, { skipQuarantineCheck: true, bringFamily: _travelBringFamily });
    }
    if (opt.id && opt.id.indexOf('land_bring_cart') === 0) return Player.travelTo(townId, { leaveCart: false, skipQuarantineCheck: true, bringFamily: _travelBringFamily });
    if (opt.id && opt.id.indexOf('land_leave_cart') === 0) return Player.travelTo(townId, { leaveCart: true, skipQuarantineCheck: true, bringFamily: _travelBringFamily });
    if (opt.id && opt.id.indexOf('mixed_') === 0) {
        var parts = opt.id.replace('mixed_', '').split('_');
        var lMode = parts[0];
        var sMode = parts.slice(1).join('_');
        return Player.travelTo(townId, { mode: lMode, seaMode: sMode, skipQuarantineCheck: true, bringFamily: _travelBringFamily });
    }
    // Fallback: just call the original action
    return opt.action();
}

function _executeTravel(townId, opt) {
    // Check "Bring Family" checkbox before closing modal
    var _bringFamily = false;
    var cbEl = document.getElementById('travelBringFamily');
    if (cbEl && cbEl.checked) _bringFamily = true;
    _travelBringFamily = _bringFamily;

    closeModal();
    closeRightPanel();
    try {
        var result = opt.action();
        if (result && result.success === false) {
            toast(result.message || 'Travel failed.', 'danger');
            return;
        }
    } catch (e) {
        toast('Travel error: ' + (e.message || e), 'danger');
        return;
    }
    if (typeof Renderer !== 'undefined') {
        var town = Engine.getTown(townId);
        if (town) Renderer.panTo(town.x, town.y);
    }
}

function showRouteDangerDetail(routeKey) {
    var info = _travelRouteDanger[routeKey];
    if (!info) return;
    var routeNames = { land: 'Land Route', mixed: 'Mixed Route', sea: 'Sea Route' };
    var html = '<div style="max-height:400px;overflow-y:auto;">';

    // Header
    html += '<div style="text-align:center;margin-bottom:12px;">';
    html += '<div style="font-size:1.5rem;">' + info.label + '</div>';
    html += '<div style="font-size:0.85rem;color:var(--text-muted);">' + (routeNames[routeKey] || routeKey) + ' — Encounter Risk</div>';
    html += '<div style="font-size:0.8rem;color:' + info.color + ';margin-top:4px;">Daily encounter chance: ~' + (info.chance * 100).toFixed(1) + '%</div>';
    html += '</div>';

    // Active modifiers
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:0.85rem;font-weight:bold;margin-bottom:6px;color:var(--gold);">Active Modifiers</div>';
    if (info.modifiers && info.modifiers.length > 0) {
        for (var i = 0; i < info.modifiers.length; i++) {
            var m = info.modifiers[i];
            var mColor = m.bad ? '#e74c3c' : '#2ecc71';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;margin-bottom:3px;background:rgba(' + (m.bad ? '200,50,50' : '46,204,113') + ',0.08);border-radius:4px;border-left:3px solid ' + mColor + ';">';
            html += '<span style="font-size:0.8rem;">' + m.name + '</span>';
            html += '<span style="font-size:0.8rem;font-weight:bold;color:' + mColor + ';">' + m.effect + '</span>';
            html += '</div>';
        }
    } else {
        html += '<div style="font-size:0.8rem;color:#888;font-style:italic;">No active modifiers — base risk only.</div>';
    }
    html += '</div>';

    // How to reduce risk
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:0.85rem;font-weight:bold;margin-bottom:6px;color:var(--gold);">How to Reduce Risk</div>';
    if (info.potentialModifiers && info.potentialModifiers.length > 0) {
        for (var j = 0; j < info.potentialModifiers.length; j++) {
            var pm = info.potentialModifiers[j];
            html += '<div style="padding:4px 6px;margin-bottom:3px;background:rgba(255,255,255,0.04);border-radius:4px;border-left:3px solid #555;">';
            html += '<div style="font-size:0.8rem;color:#aaa;">' + pm.name + ' <span style="color:#6a9;">' + pm.desc + '</span></div>';
            html += '<div style="font-size:0.72rem;color:#777;margin-top:1px;">📍 ' + pm.source + '</div>';
            html += '</div>';
        }
    } else {
        html += '<div style="font-size:0.8rem;color:#2ecc71;">✅ You have all available protections!</div>';
    }
    html += '</div>';

    // Route conditions
    html += '<div style="padding:8px;background:rgba(0,0,0,0.2);border-radius:4px;font-size:0.78rem;color:var(--text-muted);">';
    html += '<strong>Route Conditions:</strong><br>';
    if (info.bandits > 0) {
        html += '☠️ Max bandit threat: ' + info.bandits + '/100<br>';
    } else if (!info.hasPirates) {
        html += '☠️ Bandit threat: None<br>';
    }
    if (info.atWar) html += '⚔️ <span style="color:#e74c3c;">Passes through war zone!</span><br>';
    if (info.hasPirates) html += '🏴‍☠️ <span style="color:#e67e22;">Sea segment — pirates possible</span><br>';
    html += '</div>';

    html += '</div>';
    openModal('⚔️ Route Danger: ' + (routeNames[routeKey] || routeKey), html, '<button class="btn-medieval" data-action="closeModal">Close</button>');
}

function turnBackUI() {
    if (typeof Player === 'undefined' || !Player.turnBack) return;
    var result = Player.turnBack();
    if (result && result.success) {
        toast('🔄 Turning back...', 'info', 'travel_events');
        UI.update(); // refresh travel panel immediately
    } else {
        toast((result && result.message) || 'Cannot turn back', 'warning');
    }
}

function stopTravelUI() {
    if (typeof Player === 'undefined' || !Player.stopTravel) return;
    var result = Player.stopTravel();
    if (result && result.success) {
        if (result.atTown) {
            toast('🛑 Stopped at ' + result.atTown + '.', 'info', 'travel_events');
        } else {
            toast('🛑 Stopped on the road.', 'info', 'travel_events');
        }
        UI.update(); // refresh UI to show town/wilderness view
    } else {
        toast((result && result.message) || 'Cannot stop', 'warning');
    }
}

function travelTo(townId) {
    if (_isBankruptcyBlocked()) { toast('💸 You must resolve your bankruptcy first!', 'danger', 'critical'); return; }
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
    if (_isBankruptcyBlocked()) { toast('💸 You must resolve your bankruptcy first!', 'danger', 'critical'); return; }
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

function repairBridgeUI(roadIdx, bridgeId) {
    try {
        var result = Player.playerRebuildBridge(roadIdx, bridgeId);
        toast(result.message, result.success ? 'success' : 'warning');
    } catch (e) {
        toast(e.message || 'Cannot repair bridge', 'warning');
    }
}

function destroyBridge(roadIdx) {
    // Check if already destroying a bridge
    if (Player.bridgeDestruction) {
        var status = Player.getBridgeDestructionStatus();
        if (status) {
            var html = '<div style="text-align:center;margin-bottom:12px;">';
            html += '<div style="font-size:1.2rem;">💣 Bridge Sabotage In Progress</div>';
            html += '<div style="font-size:0.85rem;color:#ccc;margin-top:8px;">';
            html += '<strong>' + status.fromTown + ' – ' + status.toTown + '</strong><br>';
            html += 'Method: ' + status.methodName + '<br>';
            html += 'Progress: Day ' + status.daysElapsed + ' / ' + status.totalDays + '<br>';
            html += 'Detection risk: ' + Math.round(status.detectionRate * 100) + '% per day<br>';
            html += '</div>';
            html += '<div style="margin-top:8px;background:rgba(0,0,0,0.3);border-radius:4px;height:12px;overflow:hidden;">';
            var pct = Math.round((status.daysElapsed / status.totalDays) * 100);
            html += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#c44e52,#e67e22);transition:width 0.3s;"></div>';
            html += '</div>';
            html += '<div style="font-size:0.75rem;color:#aaa;margin-top:4px;">' + status.daysRemaining + ' days remaining</div>';
            html += '</div>';
            html += '<div style="text-align:center;">';
            html += '<button class="btn-medieval" data-action="cancelBridgeDestruction" style="background:rgba(200,60,50,0.35);border-color:rgba(200,60,50,0.6);color:#f0d0a0;">⏹️ Cancel Sabotage</button>';
            html += '</div>';
            openModal('💣 Bridge Sabotage', html);
            return;
        }
    }

    var roads = Engine.getRoads();
    var road = roads[roadIdx];
    if (!road || !road.hasBridge) { toast('No bridge on this road.', 'warning'); return; }
    if (road.bridgeDestroyed) { toast('Bridge already destroyed.', 'warning'); return; }

    var fromTown = Engine.findTown(road.fromTownId);
    var toTown = Engine.findTown(road.toTownId);
    var bridgeName = (fromTown ? fromTown.name : '?') + ' – ' + (toTown ? toTown.name : '?');

    var methods = CONFIG.BRIDGE_DESTROY_METHODS;
    if (!methods) { toast('Bridge destruction not configured.', 'warning'); return; }

    var hasSkill = false;
    var skillNames = CONFIG.BRIDGE_DESTROY_SKILLS || [];
    for (var si = 0; si < skillNames.length; si++) {
        if (typeof Player.hasSkill === 'function' && Player.hasSkill(skillNames[si])) { hasSkill = true; break; }
    }

    var cost = CONFIG.BRIDGE_DESTROY_COST || 500;
    var html = '<div style="text-align:center;margin-bottom:12px;">';
    html += '<div style="font-size:0.9rem;color:var(--gold);">🌉 Bridge: <strong>' + bridgeName + '</strong></div>';
    html += '<div style="font-size:0.8rem;color:#ccc;margin-top:4px;">Cost: <strong>' + cost + 'g</strong> + materials below</div>';
    if (hasSkill) {
        html += '<div style="font-size:0.75rem;color:#7bed9f;margin-top:4px;">✅ Relevant skills detected — faster & stealthier</div>';
    }
    html += '</div>';

    html += '<div style="display:flex;flex-direction:column;gap:8px;">';
    for (var key in methods) {
        var m = methods[key];
        var days = hasSkill ? m.skilledDays : m.baseDays;
        var detect = hasSkill ? m.skilledDetectionPerDay : m.detectionPerDay;
        var reqs = m.requires || {};

        // Check if player has materials
        var canAfford = Player.gold >= cost;
        var missingItems = [];
        for (var resId in reqs) {
            var have = (Player.inventory && Player.inventory[resId]) || 0;
            var need = reqs[resId];
            if (have < need) {
                var res = typeof RESOURCE_TYPES !== 'undefined' ? Object.values(RESOURCE_TYPES).find(function(r) { return r.id === resId; }) : null;
                missingItems.push((res ? res.name : resId) + ' (' + have + '/' + need + ')');
            }
        }
        var canDo = canAfford && missingItems.length === 0;

        // Build material list
        var matList = [];
        for (var resId2 in reqs) {
            var res2 = typeof RESOURCE_TYPES !== 'undefined' ? Object.values(RESOURCE_TYPES).find(function(r) { return r.id === resId2; }) : null;
            var icon2 = res2 ? res2.icon : '📦';
            var name2 = res2 ? res2.name : resId2;
            var have2 = (Player.inventory && Player.inventory[resId2]) || 0;
            var need2 = reqs[resId2];
            var color2 = have2 >= need2 ? '#7bed9f' : '#ff6b6b';
            matList.push(icon2 + ' ' + name2 + ': <span style="color:' + color2 + '">' + have2 + '/' + need2 + '</span>');
        }

        var detectPct = Math.round(detect * 100);
        var borderColor = canDo ? 'rgba(200,170,80,0.4)' : 'rgba(100,100,100,0.3)';
        var bgColor = canDo ? 'rgba(200,170,80,0.08)' : 'rgba(50,50,50,0.1)';

        html += '<div style="padding:10px;border:1px solid ' + borderColor + ';border-radius:6px;background:' + bgColor + ';">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<strong>' + m.icon + ' ' + m.name + '</strong>';
        html += '<span style="font-size:0.75rem;color:#aaa;">⏱ ' + days + ' days · 🔍 ' + detectPct + '%/day</span>';
        html += '</div>';
        html += '<div style="font-size:0.78rem;color:#bbb;margin:4px 0;">' + m.description + '</div>';
        html += '<div style="font-size:0.75rem;margin:4px 0;">' + matList.join(' · ') + '</div>';

        if (missingItems.length > 0) {
            html += '<div style="font-size:0.72rem;color:#ff6b6b;margin:2px 0;">❌ Missing: ' + missingItems.join(', ') + '</div>';
        }
        if (!canAfford) {
            html += '<div style="font-size:0.72rem;color:#ff6b6b;">❌ Need ' + cost + 'g (have ' + Math.floor(Player.gold) + 'g)</div>';
        }

        html += '<div style="margin-top:6px;text-align:right;">';
        if (canDo) {
            html += '<button class="btn-medieval" data-action="playerDestroyBridge" data-id="' + roadIdx + '" data-val="' + key + '" style="font-size:0.8rem;padding:5px 14px;background:rgba(200,60,50,0.35);border-color:rgba(200,60,50,0.6);color:#f0d0a0;">💣 Begin Sabotage</button>';
        } else {
            html += '<button class="btn-medieval" disabled style="font-size:0.8rem;padding:5px 14px;opacity:0.4;cursor:not-allowed;">💣 Cannot Begin</button>';
        }
        html += '</div></div>';
    }
    html += '</div>';

    html += '<div style="margin-top:12px;padding:8px;background:rgba(200,60,50,0.1);border-radius:4px;border:1px solid rgba(200,60,50,0.3);">';
    html += '<div style="font-size:0.75rem;color:#ff8866;">⚠️ <strong>Warning:</strong> Bridge sabotage is a serious crime. If caught, you face a <strong>' + (CONFIG.BRIDGE_DESTROY_CAUGHT_FINE || 2000) + 'g fine</strong>, <strong>' + (CONFIG.BRIDGE_DESTROY_CAUGHT_JAIL_DAYS || 30) + ' days jail</strong>, and <strong>reputation loss in ALL kingdoms</strong>. You must stay in the area during sabotage.</div>';
    html += '</div>';

    openModal('💣 Destroy Bridge — ' + bridgeName, html);
}

function buyShipUI(type) {
    try {
        const result = Player.buyShip(type);
        if (result && result.success) {
            toast(result.message, 'success');
            UI.openCharacterDialog(); // refresh
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
            html += '<button class="btn-trade buy" style="font-size:0.7rem;margin-top:2px;" data-action="installShipAddon" data-id="' + shipId + '" data-val="' + addonId + '">Install</button>';
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
        closeModal(); // close any modal that spawned this FIRST
        if (typeof Renderer !== 'undefined') {
            Renderer.panTo(town.x, town.y);
        }
        showTownDetail(town); // then open town detail
    }
}

    // ── Festival Participation Panel ──
    function openFestivalPanel(kingdomId, festivalId) {
        var kingdom = Engine.getKingdom(kingdomId);
        if (!kingdom) { UI.toast('Kingdom not found.', 'warning'); return; }
        var festivals = kingdom._activeFestivals || [];
        var fest = null;
        for (var i = 0; i < festivals.length; i++) {
            if (festivals[i].id === festivalId) { fest = festivals[i]; break; }
        }
        if (!fest) { UI.toast('Festival has ended.', 'warning'); return; }
        var town = Engine.findTown(fest.townId);
        var townName = town ? town.name : 'the town';

        // Location check: player must be at the festival town
        if (fest.townId && Player.townId !== fest.townId) {
            UI.toast('You must travel to ' + townName + ' to attend the festival.', 'info');
            return;
        }

        var daysLeft = fest.endDay - Engine.getDay();
        // Reset daily actions if new day
        if (fest._playerActionDay !== Engine.getDay()) {
            fest._playerActionsToday = 0;
            fest._playerActionDay = Engine.getDay();
        }
        var actionsLeft = (fest._maxActionsPerDay || 5) - (fest._playerActionsToday || 0);
        var sizeLabel = fest.type === 'large' ? '🎊 Grand Festival' : '🎉 Festival';

        var html = '<div style="padding:10px;">';
        html += '<h3 style="color:#f1c40f;margin:0 0 8px;">' + sizeLabel + ' in ' + escapeHtml(townName) + '</h3>';
        html += '<div style="font-size:0.75rem;color:#ccc;margin-bottom:10px;">';
        html += daysLeft + ' days remaining &bull; ' + actionsLeft + ' of ' + (fest._maxActionsPerDay || 5) + ' actions left today';
        html += '</div>';

        // Recent events
        if (fest.events && fest.events.length > 0) {
            html += '<div style="background:rgba(0,0,0,0.2);padding:6px;border-radius:4px;margin-bottom:10px;max-height:100px;overflow-y:auto;">';
            html += '<div style="font-size:0.68rem;color:#888;margin-bottom:4px;">Recent happenings:</div>';
            var recentEvents = fest.events.slice(-5);
            for (var ei = 0; ei < recentEvents.length; ei++) {
                html += '<div style="font-size:0.68rem;color:#bbb;margin-bottom:2px;">• ' + escapeHtml(recentEvents[ei]) + '</div>';
            }
            html += '</div>';
        }

        // Action buttons
        var actions = [
            { id: 'mingle', icon: '🤝', name: 'Mingle', desc: 'Meet someone new (+3-6 relationship)' },
            { id: 'gossip', icon: '🗣️', name: 'Gossip', desc: 'Hear what people are saying (may learn secrets)' },
            { id: 'drink', icon: '🍺', name: 'Eat & Drink', desc: 'Festival food and drinks (+3 happiness, restores hunger & thirst)' },
            { id: 'shop', icon: '🛒', name: 'Browse Stalls', desc: 'Find discounted goods at festival stalls' },
            { id: 'gamble', icon: '🎲', name: 'Gamble', desc: 'Bet gold on games of chance (45% win, 55% lose)' },
            { id: 'socialize_noble', icon: '👑', name: 'Approach a Noble', desc: 'Try to meet a noble (Burgher+ required)' }
        ];
        // Add perform if player has music skill or instrument
        var hasMusic = false;
        try { hasMusic = Player.hasSkill && (Player.hasSkill('musician') || Player.hasSkill('bard')); } catch(e) {}
        if (!hasMusic) {
            try {
                var inv = Player.getInventory ? Player.getInventory() : (Player.state ? Player.state.inventory : null);
                if (inv) {
                    var instruments = ['drum', 'flute', 'lute', 'harp', 'hurdy_gurdy'];
                    for (var ii = 0; ii < instruments.length; ii++) {
                        if ((inv[instruments[ii]] || 0) > 0) { hasMusic = true; break; }
                    }
                }
            } catch(e) {}
        }
        if (hasMusic) {
            actions.splice(4, 0, { id: 'perform', icon: '🎵', name: 'Perform', desc: 'Play music for tips (2-10g, +2 rep)' });
        }
        // Add pickpocket if player has skill
        var hasPick = false;
        try { hasPick = Player.hasSkill && (Player.hasSkill('lockpicking') || Player.hasSkill('pickpocket') || Player.hasSkill('thievery')); } catch(e) {}
        if (hasPick) {
            actions.push({ id: 'pickpocket', icon: '🤏', name: 'Pickpocket', desc: 'Try to steal from a festivalgoer' });
        }

        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
        for (var ai = 0; ai < actions.length; ai++) {
            var a = actions[ai];
            var disabled = actionsLeft <= 0;
            html += '<button class="btn-medieval" data-action="doFestivalAction" data-kingdom="' + kingdomId + '" data-festival="' + festivalId + '" data-actionid="' + a.id + '" ';
            html += 'style="font-size:0.72rem;padding:6px;text-align:left;color:#111;' + (disabled ? 'opacity:0.4;' : '') + '" ' + (disabled ? 'disabled' : '') + '>';
            html += a.icon + ' ' + a.name + '<br><span style="font-size:0.6rem;color:#444;">' + a.desc + '</span>';
            html += '</button>';
        }
        html += '</div>';
        html += '</div>';

        openModal(sizeLabel + ' in ' + escapeHtml(townName), html, '<button class="btn-medieval" data-action="closeModal">Close</button>');
    }

    UI.registerAction('doFestivalAction', function(_t, d) {
        var result = Engine.doFestivalAction(d.kingdom, d.festival, d.actionid);
        if (result && result.success) {
            UI.toast(result.message, 'success');
            if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
                StoryMode.onPlayerAction('attend_festival', { kingdomId: d.kingdom });
            }
        } else {
            UI.toast((result && result.message) || 'Action failed.', 'warning');
        }
        // Refresh the panel
        UI.openFestivalPanel(d.kingdom, d.festival);
    });


    // ── Register all public functions on UI namespace ──

    // RIGHT PANEL
    UI.showRightPanel          = showRightPanel;
    UI.closeRightPanel         = closeRightPanel;
    UI._toggleCollapse         = _toggleCollapse;
    UI.showTownDetail          = showTownDetail;
    UI.openFestivalPanel       = openFestivalPanel;
    UI.showKingdomDetail       = showKingdomDetail;
    UI.showPersonDetail        = showPersonDetail;
    UI.showRoadDetail          = showRoadDetail;

    // ACTION HELPERS
    UI.calculateRouteDist      = calculateRouteDist;
    UI.getTransportServices    = getTransportServices;
    UI._showClosedBordersDialog = _showClosedBordersDialog;
    UI._enlistForCitizenship   = _enlistForCitizenship;
    UI._smuggleBorder          = _smuggleBorder;
    UI.showRequisitionDialog   = showRequisitionDialog;
    UI._resistRequisition      = _resistRequisition;
    UI._fightingRetreat        = _fightingRetreat;
    UI.showExclusiveCitizenshipDialog = showExclusiveCitizenshipDialog;
    UI._chooseExclusiveCitizenship = _chooseExclusiveCitizenship;
    UI.showHorsePermitViolationDialog = showHorsePermitViolationDialog;
    UI.openTravelOptions       = openTravelOptions;
    UI.confirmTravel           = confirmTravel;
    UI._quarantineSneakAttempt = _quarantineSneakAttempt;
    UI._quarantineBribeAttempt = _quarantineBribeAttempt;
    UI._quarantineDoctorPersuade = _quarantineDoctorPersuade;
    UI._siegeSneakAttempt      = _siegeSneakAttempt;
    UI._siegeJoinSide          = _siegeJoinSide;
    UI._siegeTurnBack          = _siegeTurnBack;
    UI._siegeExitSneak         = _siegeExitSneak;
    UI._revoltSneak            = _revoltSneak;
    UI._revoltJoinSide         = _revoltJoinSide;
    UI._revoltTurnBack         = _revoltTurnBack;
    UI.showRouteDangerDetail   = showRouteDangerDetail;
    UI.turnBackUI              = turnBackUI;
    UI.stopTravelUI            = stopTravelUI;
    UI.travelTo                = travelTo;
    UI.travelBySea             = travelBySeaUI;
    UI.buyShip                 = buyShipUI;
    UI.showShipAddons          = showShipAddons;
    UI.installShipAddon        = installShipAddonUI;
    UI.clickTown               = clickTown;
    UI.forageNearby            = forageNearby;
    UI.rebuildBridge           = rebuildBridge;
    UI.repairBridgeUI          = repairBridgeUI;
    UI.destroyBridge           = destroyBridge;


    // ── Delegated action handlers (data-action) ──
    UI.registerAction('_toggleCollapse', function(t) { UI._toggleCollapse(t); });
    UI.registerAction('showBuildRouteSelector', function(_t, d) { UI.showBuildRouteSelector(d.type); });
    UI.registerAction('toggleTrackMerchant', function(_t, d) { var fn = d.tracked === 'true' ? 'untrackMerchant' : 'trackMerchant'; var r = Player[fn](d.id); if (typeof UI !== 'undefined' && UI.toast) UI.toast(r.message, r.success ? 'success' : 'warning'); });
    UI.registerAction('sellToKingdomRequest', function(_t, d) { var r = Player.sellToKingdomRequest(d.id, Number(d.val)); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.showKingdomDetail(Engine.getKingdom(d.kingdom)); });
    UI.registerAction('donateToKingdomGoods', function(_t, d) { var r = Player.donateToKingdomGoods(d.id, Number(d.val)); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.showKingdomDetail(Engine.getKingdom(d.kingdom)); });
    UI.registerAction('donateToKingdomGold', function(_t, d) { var r = Player.donateToKingdom(d.id, Number(d.val)); if (!r.success) { UI.toast(r.message, 'warning'); } else { UI.showKingdomDetail(Engine.getKingdom(d.id)); } });
    UI.registerAction('untrackMerchantPerson', function(_t, d) { Player.untrackMerchant(d.id); UI.showPersonDetail(Engine.getPerson(d.id)); });
    UI.registerAction('trackMerchantPerson', function(_t, d) { Player.trackMerchant(d.id); UI.showPersonDetail(Engine.getPerson(d.id)); });
    UI.registerAction('showPersonLink', function(t, d) { UI.showPersonDetail(Engine.getPerson(d.id)); });
    UI.registerAction('treatCompanionUI', function(_t, d) { UI.treatCompanionUI(d.type, d.id, d.val); });
    UI.registerAction('takeHorseFromWorker', function(_t, d) { var r = Player.takeHorseFromWorker(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); if (r.success) { try { var p = Engine.findPerson(d.id); if (p) UI.showPersonDetail(p); } catch(e) {} } });
    UI.registerAction('requestSignature', function(_t, d) { var r = Player.requestSignature(d.id, d.val); UI.toast(r.message, r.signed ? 'success' : 'warning'); try { var p = Engine.getPerson(d.val); if (p) UI.showPersonDetail(p); } catch(e) {} });
    UI.registerAction('interviewNpcForQuestUI', function(_t, d) {
        var r = Player.interviewNpcForQuest ? Player.interviewNpcForQuest(d.id, parseInt(d.val)) : { success: false, message: 'Interview not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        try { var p = Engine.getPerson(Player.state._kqInteractiveData[d.id].targets[parseInt(d.val)].npcId); if (p) UI.showPersonDetail(p); } catch(e) {}
    });
    UI.registerAction('askNpcAboutCriminalUI', function(_t, d) {
        var r = Player.askNpcAboutCriminal ? Player.askNpcAboutCriminal(d.id, parseInt(d.val)) : { success: false, message: 'Ask not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        try { var p = Engine.getPerson(Player.state._kqInteractiveData[d.id].npcClues[parseInt(d.val)].npcId); if (p) UI.showPersonDetail(p); } catch(e) {}
    });
    UI.registerAction('attemptCaptureCriminalUI', function(_t, d) {
        var r = Player.attemptCaptureCriminal ? Player.attemptCaptureCriminal(d.id) : { success: false, message: 'Capture not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        if (typeof UI.openStreetTrading === 'function') UI.openStreetTrading();
    });
    UI.registerAction('complyRequisition', function(_t, d) { Player.executeRequisition(d.id, Number(d.val)); UI.closeModal(); UI.toast('⚠️ Guards seized ' + d.val + ' ' + d.type + '.', 'danger'); });
    UI.registerAction('bribeRequisitionGuard', function(_t, d) { var r = Player.bribeRequisitionGuard(Number(d.cost)); UI.closeModal(); if (!r.success) { Player.executeRequisition(d.id, Number(d.val)); } });
    UI.registerAction('_resistRequisition', function(_t, d) { UI._resistRequisition(d.id, Number(d.val), d.kingdom); });
    UI.registerAction('_fightingRetreat', function(_t, d) { UI._fightingRetreat(d.id, Number(d.val), d.kingdom); });
    UI.registerAction('_chooseExclusiveCitizenship', function(_t, d) { UI._chooseExclusiveCitizenship(d.id, JSON.parse(d.kingdoms.replace(/&quot;/g, '"'))); });
    UI.registerAction('payHorsePermitFine', function() { Player.payHorsePermitFine(); UI.closeModal(); });
    UI.registerAction('refuseHorsePermitFine', function() { Player.refuseHorsePermitFine(); UI.closeModal(); });
    UI.registerAction('_quarantineBribeAttempt', function(_t, d) { UI._quarantineBribeAttempt(d.id, d.val, d.type, Number(d.cost)); });
    UI.registerAction('cancelBridgeDestruction', function() { var r = Player.cancelBridgeDestruction(); UI.toast(r.message, r.success ? 'warning' : 'danger'); UI.closeModal(); });
    UI.registerAction('playerDestroyBridge', function(_t, d) { var r = Player.playerDestroyBridge(Number(d.id), d.val); UI.toast(r.message, r.success ? 'success' : 'warning'); if (r.success) UI.closeModal(); });
    UI.registerAction('treatCompanionHospitalTown', function(_t, d) { var r = Player.treatCompanion(d.type, d.id, 'hospital'); UI.toast(r.message, r.success ? 'success' : 'warning'); try { UI.showTownDetail(Engine.findTown(Player.townId)); } catch(e) {} });
    UI.registerAction('treatCompanionPlayerTown', function(_t, d) { var r = Player.treatCompanion(d.type, d.id, 'player'); UI.toast(r.message, r.success ? 'success' : 'warning'); try { UI.showTownDetail(Engine.findTown(Player.townId)); } catch(e) {} });

    // Simple passthrough handlers (no-arg)
    UI.registerAction('openHealthDialog', function() { UI.openHealthDialog(); });
    UI.registerAction('openHousingDialog', function() { UI.openHousingDialog(); });
    UI.registerAction('openTownMarket', function() { UI.openTownMarket(); });
    UI.registerAction('openRealEstateReport', function() { UI.openRealEstateReport(); });
    UI.registerAction('buyLandUI', function() { UI.buyLandUI(); });
    UI.registerAction('showTollRoutesPanel', function() { UI.showTollRoutesPanel(); });
    UI.registerAction('showTravelPanel', function() { UI.showTravelPanel(); });
    UI.registerAction('showPetitionsPanel', function() { UI.showPetitionsPanel(); });
    UI.registerAction('forageNearby', function() { UI.forageNearby(); });

    // Single-arg passthrough handlers (data-id)
    UI.registerAction('showTownPeople', function(_t, d) { UI.showTownPeople(d.id); });
    UI.registerAction('openTownQuests', function(_t, d) { UI.openTownQuests(d.id); });
    UI.registerAction('openFestivalPanel', function(_t, d) { UI.openFestivalPanel(d.kingdom, d.festival); });
    UI.registerAction('openKingdomLawsPanel', function(_t, d) { UI.openKingdomLawsPanel(d.id); });
    UI.registerAction('openKingActionLog', function(_t, d) { UI.openKingActionLog(d.id); });
    UI.registerAction('openRoyalCommissionsPanel', function(_t, d) { UI.openRoyalCommissionsPanel(d.id); });
    UI.registerAction('openProsperityBreakdown', function(_t, d) { UI.openProsperityBreakdown(d.id); });
    UI.registerAction('showKingdomOrdersPanel', function(_t, d) { UI.showKingdomOrdersPanel(d.id); });
    UI.registerAction('showKingdomTradePanel', function(_t, d) { UI.showKingdomTradePanel(d.id); });
    UI.registerAction('openTravelOptions', function(_t, d) { UI.openTravelOptions(d.id); });
    UI.registerAction('openAdviseKingDialog', function(_t, d) { UI.openAdviseKingDialog(d.id); });
    UI.registerAction('openAdviseKingDirectDialog', function(_t, d) { UI.openAdviseKingDirectDialog(d.id); });
    UI.registerAction('openProposeLawsDialog', function(_t, d) { UI.openProposeLawsDialog(d.id); });
    UI.registerAction('openKingCommissionDialog', function(_t, d) { UI.openKingCommissionDialog(d.id); });
    UI.registerAction('openKingFavorDialog', function(_t, d) { UI.openKingFavorDialog(d.id); });
    UI.registerAction('clickTown', function(_t, d) { UI.clickTown(d.id); });
    UI.registerAction('observePerson', function(_t, d) { UI.observePerson(d.id); });
    UI.registerAction('askTavernAbout', function(_t, d) { UI.askTavernAbout(d.id); });
    UI.registerAction('openGiftDialog', function(_t, d) { UI.openGiftDialog(d.id); });
    UI.registerAction('talkToPerson', function(_t, d) { UI.talkToPerson(d.id); });
    UI.registerAction('hireInvestigator', function(_t, d) { UI.hireInvestigator(d.id); });
    UI.registerAction('requestSameRankIntro', function(_t, d) { UI.requestSameRankIntro(d.id); });
    UI.registerAction('openNobleLoanDialog', function(_t, d) { UI.openNobleLoanDialog(d.id); });
    UI.registerAction('openRecruitToOutpostDialog', function(_t, d) { UI.openRecruitToOutpostDialog(d.id); });
    UI.registerAction('proposeTo', function(_t, d) { UI.proposeTo(d.id); });
    UI.registerAction('hirePerson', function(_t, d) { UI.hirePerson(d.id); });
    UI.registerAction('stealFromPerson', function(_t, d) { UI.stealFromPerson(d.id); });
    UI.registerAction('spreadRumorsAbout', function(_t, d) { UI.spreadRumorsAbout(d.id); });
    UI.registerAction('blackmailPerson', function(_t, d) { UI.blackmailPerson(d.id); });
    UI.registerAction('hireAssassinFor', function(_t, d) { UI.hireAssassinFor(d.id); });
    UI.registerAction('poisonPerson', function(_t, d) { UI.poisonPerson(d.id); });
    UI.registerAction('framePerson', function(_t, d) { UI.framePerson(d.id); });
    UI.registerAction('godRelPlus', function(_t, d) {
        var p = Engine.findPerson(d.id);
        if (!p || !Player.state) return;
        if (!Player.state.relationships) Player.state.relationships = {};
        if (!Player.state.relationships[d.id]) Player.state.relationships[d.id] = { level: 0, interactions: 0 };
        Player.state.relationships[d.id].level = Math.min(100, (Player.state.relationships[d.id].level || 0) + 10);
        var lvl = Math.floor(Player.state.relationships[d.id].level);
        UI.toast('⬆️ +10 relationship with ' + (p.firstName || 'NPC') + ' (now ' + lvl + ')', 'success');
        UI.showPersonDetail(d.id);
    });
    UI.registerAction('godRelMinus', function(_t, d) {
        var p = Engine.findPerson(d.id);
        if (!p || !Player.state) return;
        if (!Player.state.relationships) Player.state.relationships = {};
        if (!Player.state.relationships[d.id]) Player.state.relationships[d.id] = { level: 0, interactions: 0 };
        Player.state.relationships[d.id].level = Math.max(0, (Player.state.relationships[d.id].level || 0) - 10);
        var lvl = Math.floor(Player.state.relationships[d.id].level);
        UI.toast('⬇️ -10 relationship with ' + (p.firstName || 'NPC') + ' (now ' + lvl + ')', 'info');
        UI.showPersonDetail(d.id);
    });
    UI.registerAction('_smuggleBorder', function(_t, d) { UI._smuggleBorder(d.id); });
    UI.registerAction('showRouteDangerDetail', function(_t, d) { UI.showRouteDangerDetail(d.id); });

    // Two-arg passthrough handlers (data-id, data-val)
    UI.registerAction('quickBuy', function(_t, d) { UI.quickBuy(d.id, d.val); });
    UI.registerAction('quickSell', function(_t, d) { UI.quickSell(d.id, d.val); });
    UI.registerAction('openKingdomBuildDialog', function(_t, d) { UI.openKingdomBuildDialog(d.id, d.val); });
    UI.registerAction('showIntroductionOptions', function(_t, d) { UI.showIntroductionOptions(d.id, Number(d.val)); });
    UI.registerAction('usePerk', function(_t, d) { UI.usePerk(d.id, d.val); });
    UI.registerAction('dateAction', function(_t, d) { UI.dateAction(d.id, d.val); });
    UI.registerAction('_enlistForCitizenship', function(_t, d) { UI._enlistForCitizenship(d.id, d.val); });
    UI.registerAction('confirmTravel', function(_t, d) { UI.confirmTravel(d.id, d.val); });
    UI.registerAction('_quarantineSneakAttempt', function(_t, d) { UI._quarantineSneakAttempt(d.id, d.val); });
    UI.registerAction('_quarantineDoctorPersuade', function(_t, d) { UI._quarantineDoctorPersuade(d.id, d.val); });
    UI.registerAction('_siegeSneakAttempt', function(_t, d) { UI._siegeSneakAttempt(d.id, d.val); });
    UI.registerAction('_siegeJoinSide', function(_t, d) { UI._siegeJoinSide(d.id, d.val, d.side, d.win); });
    UI.registerAction('_siegeTurnBack', function() { UI._siegeTurnBack(); });
    UI.registerAction('_siegeExitSneak', function(_t, d) { UI._siegeExitSneak(d.id, d.val); });
    UI.registerAction('_revoltSneak', function(_t, d) { UI._revoltSneak(d.id, d.val); });
    UI.registerAction('_revoltJoinSide', function(_t, d) { UI._revoltJoinSide(d.id, d.val, d.side, d.win); });
    UI.registerAction('_revoltTurnBack', function() { UI._revoltTurnBack(); });
    UI.registerAction('installShipAddon', function(_t, d) { UI.installShipAddon(d.id, d.val); });

    // ── Elite Merchant Favor Action Handlers ──
    function _emFavorCalcCost(em, favorType) {
        var rel = Player.getRelationship ? Player.getRelationship(em.id) : { level: 0 };
        var playerRank = 0;
        if (Player.state.socialRank) { for (var _srk in Player.state.socialRank) { if ((Player.state.socialRank[_srk] || 0) > playerRank) playerRank = Player.state.socialRank[_srk]; } }
        var baseCost = 500;
        if (favorType === 'kingdom') baseCost = 2000;
        else if (favorType === 'focus') baseCost = 1000;
        // Personality modifiers
        var p = em.personality || {};
        var greedMod = 1 + ((p.greed || 50) - 50) / 100; // 0.5-1.5x
        var relDiscount = 1 - ((rel.level - 60) / 200); // 60rel=1.0, 100rel=0.8
        var rankDiscount = 1 - (playerRank * 0.08); // rank0=1.0, rank7=0.44
        var cost = Math.floor(baseCost * greedMod * relDiscount * rankDiscount);
        return Math.max(100, Math.min(10000, cost));
    }

    function _emFavorBaseChance(em) {
        var rel = Player.getRelationship ? Player.getRelationship(em.id) : { level: 0 };
        var p = em.personality || {};
        var chance = 0.15 + (rel.level - 60) * 0.008 + ((p.warmth || 50) - 50) * 0.002;
        return Math.max(0.1, Math.min(0.85, chance));
    }

    UI.registerAction('emFavorStrategy', function(_t, d) {
        var em = Engine.findPerson(d.id);
        if (!em || !em.isEliteMerchant) { UI.toast('NPC not found.', 'error'); return; }
        var strategies = ['food_monopoly', 'military_supplier', 'luxury_trader', 'diversified', 'political_climber', 'war_profiteer', 'land_baron', 'trade_network', 'medical_supplier', 'culture_trader', 'retail_mogul'];
        var current = em.strategy || 'diversified';
        var opts = '';
        for (var si = 0; si < strategies.length; si++) {
            if (strategies[si] === current) continue;
            var sLabel = strategies[si].replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
            opts += '<option value="' + strategies[si] + '">' + sLabel + '</option>';
        }
        var cost = _emFavorCalcCost(em, 'strategy');
        var body = '<div style="padding:10px;">';
        body += '<div style="margin-bottom:8px;font-size:0.85rem;">Ask <strong>' + (em.firstName || '') + ' ' + (em.lastName || '') + '</strong> to change their trading strategy.</div>';
        body += '<div style="margin-bottom:6px;font-size:0.78rem;color:#aaa;">Current strategy: <span style="color:#ffa500;">' + current.replace(/_/g, ' ') + '</span></div>';
        body += '<div style="margin-bottom:6px;"><label style="font-size:0.78rem;color:#ccc;">New Strategy:</label><br>';
        body += '<select id="emFavorStrategySelect" style="background:#1a1a2e;color:#ccc;border:1px solid #555;border-radius:4px;padding:4px 8px;width:100%;margin-top:4px;">' + opts + '</select></div>';
        body += '<div style="font-size:0.8rem;color:#d4a017;margin-top:8px;">💰 Cost: <strong>' + cost + 'g</strong></div>';
        body += '<div style="font-size:0.7rem;color:#888;margin-top:4px;">Your gold: ' + Math.floor(Player.state.gold || 0) + 'g</div>';
        body += '</div>';
        var footer = '<button class="btn-medieval" data-action="_emFavorStrategyConfirm" data-id="' + em.id + '" data-val="' + cost + '" style="font-size:0.78rem;padding:5px 14px;">💰 Pay & Ask</button>';
        footer += '<button class="btn-medieval" onclick="UI.closeModal()" style="font-size:0.78rem;padding:5px 14px;margin-left:8px;">Cancel</button>';
        UI.openModal('🎯 Ask to Change Strategy', body, footer);
    });

    UI.registerAction('_emFavorStrategyConfirm', function(_t, d) {
        var em = Engine.findPerson(d.id);
        if (!em) { UI.toast('NPC not found.', 'error'); return; }
        var cost = Number(d.val);
        var sel = document.getElementById('emFavorStrategySelect');
        if (!sel) { UI.toast('Select a strategy first.', 'warning'); return; }
        var newStrat = sel.value;
        if ((Player.state.gold || 0) < cost) { UI.toast('Not enough gold!', 'warning'); return; }
        Player.state.gold -= cost;
        em.gold = (em.gold || 0) + cost;
        var chance = _emFavorBaseChance(em);
        var rng = Engine.getRng();
        if (rng.random() < chance) {
            var old = em.strategy;
            em.strategy = newStrat;
            em._playerFavorCooldown = (Engine.getDay ? Engine.getDay() : 0) + 30;
            UI.closeModal();
            UI.toast('✅ ' + em.firstName + ' agrees! Switching from ' + (old || '?').replace(/_/g, ' ') + ' to ' + newStrat.replace(/_/g, ' ') + '.', 'success');
            UI.showPersonDetail(em);
        } else {
            em._playerFavorCooldown = (Engine.getDay ? Engine.getDay() : 0) + 30;
            UI.closeModal();
            UI.toast('❌ ' + em.firstName + ' considers but declines your request. They keep the gold as a "consideration fee."', 'warning');
            UI.showPersonDetail(em);
        }
    });

    UI.registerAction('emFavorKingdom', function(_t, d) {
        var em = Engine.findPerson(d.id);
        if (!em || !em.isEliteMerchant) { UI.toast('NPC not found.', 'error'); return; }
        var kingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];
        var currentKid = em.kingdomId || em.citizenshipKingdomId || '';
        var opts = '';
        for (var ki = 0; ki < kingdoms.length; ki++) {
            if (kingdoms[ki].id === currentKid) continue;
            opts += '<option value="' + kingdoms[ki].id + '">' + (kingdoms[ki].name || kingdoms[ki].id) + '</option>';
        }
        if (!opts) { UI.toast('No other kingdoms available.', 'warning'); return; }
        var cost = _emFavorCalcCost(em, 'kingdom');
        var currentKName = '?';
        try { var ck = Engine.findKingdom(currentKid); if (ck) currentKName = ck.name; } catch(e) {}
        var body = '<div style="padding:10px;">';
        body += '<div style="margin-bottom:8px;font-size:0.85rem;">Ask <strong>' + (em.firstName || '') + ' ' + (em.lastName || '') + '</strong> to relocate to a different kingdom.</div>';
        body += '<div style="margin-bottom:6px;font-size:0.78rem;color:#aaa;">Current kingdom: <span style="color:#4fc3f7;">' + currentKName + '</span></div>';
        body += '<div style="margin-bottom:6px;"><label style="font-size:0.78rem;color:#ccc;">Target Kingdom:</label><br>';
        body += '<select id="emFavorKingdomSelect" style="background:#1a1a2e;color:#ccc;border:1px solid #555;border-radius:4px;padding:4px 8px;width:100%;margin-top:4px;">' + opts + '</select></div>';
        body += '<div style="font-size:0.8rem;color:#d4a017;margin-top:8px;">💰 Cost: <strong>' + cost + 'g</strong></div>';
        body += '<div style="font-size:0.7rem;color:#888;margin-top:4px;">Your gold: ' + Math.floor(Player.state.gold || 0) + 'g</div>';
        body += '</div>';
        var footer = '<button class="btn-medieval" data-action="_emFavorKingdomConfirm" data-id="' + em.id + '" data-val="' + cost + '" style="font-size:0.78rem;padding:5px 14px;">💰 Pay & Ask</button>';
        footer += '<button class="btn-medieval" onclick="UI.closeModal()" style="font-size:0.78rem;padding:5px 14px;margin-left:8px;">Cancel</button>';
        UI.openModal('👑 Ask to Switch Kingdom', body, footer);
    });

    UI.registerAction('_emFavorKingdomConfirm', function(_t, d) {
        var em = Engine.findPerson(d.id);
        if (!em) { UI.toast('NPC not found.', 'error'); return; }
        var cost = Number(d.val);
        var sel = document.getElementById('emFavorKingdomSelect');
        if (!sel) { UI.toast('Select a kingdom first.', 'warning'); return; }
        var newKid = sel.value;
        if ((Player.state.gold || 0) < cost) { UI.toast('Not enough gold!', 'warning'); return; }
        Player.state.gold -= cost;
        em.gold = (em.gold || 0) + cost;
        var chance = _emFavorBaseChance(em);
        var rng = Engine.getRng();
        if (rng.random() < chance) {
            var oldKid = em.kingdomId || em.citizenshipKingdomId || '';
            // Move to a town in the new kingdom
            var targetKingdom = Engine.findKingdom(newKid);
            var towns = Engine.getTowns ? Engine.getTowns() : [];
            var targetTowns = towns.filter(function(t) { return t.kingdomId === newKid; });
            if (targetTowns.length > 0) {
                var targetTown = targetTowns[Math.floor(rng.random() * targetTowns.length)];
                em.townId = targetTown.id;
            }
            em.kingdomId = newKid;
            em.citizenshipKingdomId = newKid;
            if (em.socialRank && em.socialRank[oldKid]) {
                em.socialRank[newKid] = Math.max(em.socialRank[newKid] || 0, 1);
            }
            em._playerFavorCooldown = (Engine.getDay ? Engine.getDay() : 0) + 30;
            UI.closeModal();
            UI.toast('✅ ' + em.firstName + ' agrees to move to ' + (targetKingdom ? targetKingdom.name : newKid) + '!', 'success');
            UI.showPersonDetail(em);
        } else {
            em._playerFavorCooldown = (Engine.getDay ? Engine.getDay() : 0) + 30;
            UI.closeModal();
            UI.toast('❌ ' + em.firstName + ' declines to relocate. They keep the gold as a "consideration fee."', 'warning');
            UI.showPersonDetail(em);
        }
    });

    UI.registerAction('emFavorFocus', function(_t, d) {
        var em = Engine.findPerson(d.id);
        if (!em || !em.isEliteMerchant) { UI.toast('NPC not found.', 'error'); return; }
        // Show a list of goods grouped by category
        var goodsList = [
            { id: 'wheat', name: 'Wheat' }, { id: 'bread', name: 'Bread' }, { id: 'meat', name: 'Meat' },
            { id: 'fish', name: 'Fish' }, { id: 'eggs', name: 'Eggs' }, { id: 'flour', name: 'Flour' },
            { id: 'preserved_food', name: 'Preserved Food' }, { id: 'salt', name: 'Salt' },
            { id: 'iron', name: 'Iron' }, { id: 'iron_ore', name: 'Iron Ore' }, { id: 'steel', name: 'Steel' },
            { id: 'tools', name: 'Tools' }, { id: 'swords', name: 'Swords' }, { id: 'armor', name: 'Armor' },
            { id: 'bows', name: 'Bows' }, { id: 'arrows', name: 'Arrows' },
            { id: 'wood', name: 'Wood' }, { id: 'stone', name: 'Stone' }, { id: 'charcoal', name: 'Charcoal' }, { id: 'coal', name: 'Coal' },
            { id: 'cloth', name: 'Cloth' }, { id: 'wool', name: 'Wool' }, { id: 'silk', name: 'Silk' },
            { id: 'leather', name: 'Leather' }, { id: 'dye', name: 'Dye' },
            { id: 'wine', name: 'Wine' }, { id: 'ale', name: 'Ale' }, { id: 'mead', name: 'Mead' },
            { id: 'jewelry', name: 'Jewelry' }, { id: 'spices', name: 'Spices' },
            { id: 'furniture', name: 'Furniture' }, { id: 'clothes', name: 'Clothes' }, { id: 'fine_clothes', name: 'Fine Clothes' },
            { id: 'herbs', name: 'Herbs' }, { id: 'medicine', name: 'Medicine' }, { id: 'bandages', name: 'Bandages' }
        ];
        var opts = '';
        for (var gi = 0; gi < goodsList.length; gi++) {
            opts += '<option value="' + goodsList[gi].id + '">' + goodsList[gi].name + '</option>';
        }
        var cost = _emFavorCalcCost(em, 'focus');
        var body = '<div style="padding:10px;">';
        body += '<div style="margin-bottom:8px;font-size:0.85rem;">Ask <strong>' + (em.firstName || '') + ' ' + (em.lastName || '') + '</strong> to focus on a specific good and its supply chain.</div>';
        body += '<div style="margin-bottom:6px;font-size:0.72rem;color:#aaa;">They will prioritize trading and producing this good.</div>';
        body += '<div style="margin-bottom:6px;"><label style="font-size:0.78rem;color:#ccc;">Focus Good:</label><br>';
        body += '<select id="emFavorGoodSelect" style="background:#1a1a2e;color:#ccc;border:1px solid #555;border-radius:4px;padding:4px 8px;width:100%;margin-top:4px;">' + opts + '</select></div>';
        body += '<div style="font-size:0.8rem;color:#d4a017;margin-top:8px;">💰 Cost: <strong>' + cost + 'g</strong></div>';
        body += '<div style="font-size:0.7rem;color:#888;margin-top:4px;">Your gold: ' + Math.floor(Player.state.gold || 0) + 'g</div>';
        body += '</div>';
        var footer = '<button class="btn-medieval" data-action="_emFavorFocusConfirm" data-id="' + em.id + '" data-val="' + cost + '" style="font-size:0.78rem;padding:5px 14px;">💰 Pay & Ask</button>';
        footer += '<button class="btn-medieval" onclick="UI.closeModal()" style="font-size:0.78rem;padding:5px 14px;margin-left:8px;">Cancel</button>';
        UI.openModal('📦 Ask to Focus on a Good', body, footer);
    });

    UI.registerAction('_emFavorFocusConfirm', function(_t, d) {
        var em = Engine.findPerson(d.id);
        if (!em) { UI.toast('NPC not found.', 'error'); return; }
        var cost = Number(d.val);
        var sel = document.getElementById('emFavorGoodSelect');
        if (!sel) { UI.toast('Select a good first.', 'warning'); return; }
        var focusGood = sel.value;
        if ((Player.state.gold || 0) < cost) { UI.toast('Not enough gold!', 'warning'); return; }
        Player.state.gold -= cost;
        em.gold = (em.gold || 0) + cost;
        var chance = _emFavorBaseChance(em);
        var rng = Engine.getRng();
        if (rng.random() < chance) {
            em._focusGood = focusGood;
            em._focusGoodDay = Engine.getDay ? Engine.getDay() : 0;
            em._playerFavorCooldown = (Engine.getDay ? Engine.getDay() : 0) + 30;
            UI.closeModal();
            var goodName = focusGood.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
            UI.toast('✅ ' + em.firstName + ' agrees to focus on ' + goodName + ' and its supply chain!', 'success');
            UI.showPersonDetail(em);
        } else {
            em._playerFavorCooldown = (Engine.getDay ? Engine.getDay() : 0) + 30;
            UI.closeModal();
            UI.toast('❌ ' + em.firstName + ' declines your request. They keep the gold as a "consideration fee."', 'warning');
            UI.showPersonDetail(em);
        }
    });

    // Numeric-arg handlers (data-idx)
    UI.registerAction('rebuildBridge', function(_t, d) { UI.rebuildBridge(Number(d.idx)); });
    UI.registerAction('destroyBridge', function(_t, d) { UI.destroyBridge(Number(d.idx)); });
    UI.registerAction('stopTravelUI', function() { stopTravelUI(); });

})(window.UI);