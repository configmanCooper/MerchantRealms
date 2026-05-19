// ============================================================
// Merchant Realms — UI King Module (extracted from ui.js)
// Extends window.UI with King panel functions
// ============================================================
(function(UI) {
    "use strict";
    if (!UI) throw new Error("UI must be loaded before ui_king.js");

    // Aliases for UI utilities
    var openModal = UI.openModal;
    var closeModal = UI.closeModal;
    var toast = UI.toast;
    var formatGold = UI.formatGold;
    var escapeHtml = UI.escapeHtml;

    // Loyalty label helper: converts perceived loyalty to text + color
    function _loyaltyLabel(perceivedVal) {
        var v = Math.round(perceivedVal || 50);
        if (v >= 80) return { text: 'Very Loyal', color: '#55a868', icon: '♛' };
        if (v >= 60) return { text: 'Loyal', color: '#5dade2', icon: '♛' };
        if (v >= 50) return { text: 'Neutral', color: '#e0c58a', icon: '♛' };
        return { text: 'Unsure', color: '#c44e52', icon: '♛' };
    }

    // ========================================================
    // §KING — KING UI PANEL & FUNCTIONS
    // ========================================================

    var _kingTab = 'overview';

    function showKingButton() {
        var btn = document.getElementById('btnKing');
        if (btn) { btn.style.display = ''; btn.classList.remove('hidden'); }
    }

    function hideKingButton() {
        var btn = document.getElementById('btnKing');
        if (btn) { btn.style.display = 'none'; btn.classList.add('hidden'); }
    }

    function openKingPanel(tab) {
        if (tab) _kingTab = tab;
        if (!Player.isPlayerKing || !Player.isPlayerKing()) { toast('You are not the ruler.', 'warning'); return; }
        var kingdom = Player.getPlayerKingdom();
        if (!kingdom) { toast('Kingdom not found.', 'warning'); return; }
        var p = Player.state;
        var ks = p.kingState || {};

        var html = '<div style="font-family:\'Merriweather\',Georgia,serif;">';

        // Header
        html += '<div style="text-align:center;padding:8px;background:linear-gradient(135deg,rgba(212,168,67,0.25),rgba(139,69,19,0.25));border:1px solid rgba(212,168,67,0.4);border-radius:8px;margin-bottom:10px;">';
        html += '<div style="font-size:1.1rem;color:#d4a843;">👑 ' + (p.sex === 'F' ? 'Queen' : 'King') + ' ' + p.fullName + '</div>';
        html += '<div style="font-size:0.8rem;color:#b8a070;">' + kingdom.name + ' — Day ' + (Engine.getDay() - ks.coronationDay || 0) + ' of reign</div>';
        html += '<div style="font-size:0.85rem;color:#e0c58a;margin-top:4px;">💰 Treasury: ' + formatGold(kingdom.gold || 0) + '</div>';
        html += '</div>';

        // Tab bar
        var _pendingPetitions = (kingdom._pendingPetitions || []).length;
        var _advisorCount = (kingdom._advisorSuggestions || []).length;
        var tabs = [
            { id: 'overview', icon: '📊', label: 'Overview' },
            { id: 'decisions', icon: '⚖️', label: 'Decisions' + ((kingdom._economicProposals && kingdom._economicProposals.length > 0) ? ' (' + kingdom._economicProposals.length + ')' : '') },
            { id: 'military', icon: '⚔️', label: 'Military' },
            { id: 'stockpile', icon: '📦', label: 'Stockpile' },
            { id: 'kingdom', icon: '🗺️', label: 'Towns' },
            { id: 'court', icon: '🏰', label: 'Court' + ((kingdom._pendingPetitions && kingdom._pendingPetitions.length > 0) ? ' (' + kingdom._pendingPetitions.length + ')' : '') },
            { id: 'nobility', icon: '🏅', label: 'Nobility' },
            { id: 'employees', icon: '👷', label: 'Employees' },
            { id: 'finances', icon: '💰', label: 'Finances' },
            { id: 'threats', icon: '⚠️', label: 'Threats' }
        ];
        html += '<div class="king-tabs-wrapper"><div class="king-tabs-container" style="display:flex;gap:3px;margin-bottom:10px;flex-wrap:wrap;">';
        for (var _ti = 0; _ti < tabs.length; _ti++) {
            var _tab = tabs[_ti];
            var _active = _kingTab === _tab.id;
            html += '<button class="btn-medieval king-tab-btn" data-action="openKingPanel" data-id="' + _tab.id + '" style="flex:0 1 auto;min-width:auto;font-size:0.68rem;padding:5px 6px;white-space:nowrap;' + (_active ? 'background:rgba(212,168,67,0.35) !important;border-color:rgba(212,168,67,0.6) !important;color:#d4a843;' : '') + '">' + _tab.icon + ' ' + _tab.label + '</button>';
        }
        html += '</div></div>';

        // Tab content
        if (_kingTab === 'overview') html += _kingOverviewTab(kingdom, ks);
        else if (_kingTab === 'decisions') html += _kingDecisionsTab(kingdom, ks);
        else if (_kingTab === 'military') html += _kingMilitaryTab(kingdom, ks);
        else if (_kingTab === 'stockpile') html += _kingStockpileTab(kingdom, ks);
        else if (_kingTab === 'kingdom') html += _kingKingdomTab(kingdom, ks);
        else if (_kingTab === 'court') html += _kingCourtTab(kingdom, ks);
        else if (_kingTab === 'nobility') html += _kingNobilityTab(kingdom, ks);
        else if (_kingTab === 'employees') html += _kingEmployeesTab(kingdom, ks);
        else if (_kingTab === 'finances') html += _kingFinancesTab(kingdom, ks);
        else if (_kingTab === 'threats') html += _kingThreatsTab(kingdom, ks);

        html += '</div>';

        openModal('👑 Royal Court', html, '<button class="btn-medieval" data-action="closeModal">Close</button>');
    }

    function _riskMeter(value, label, color) {
        var bg = value > 60 ? 'rgba(196,78,82,0.3)' : value > 30 ? 'rgba(231,126,35,0.3)' : 'rgba(85,168,104,0.3)';
        var fg = value > 60 ? '#c44e52' : value > 30 ? '#e67e22' : '#55a868';
        return '<div style="margin:4px 0;">' +
            '<div style="font-size:0.75rem;color:#aaa;margin-bottom:2px;">' + label + ': ' + Math.round(value) + '%</div>' +
            '<div style="background:rgba(0,0,0,0.3);border-radius:4px;height:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">' +
            '<div style="height:100%;width:' + Math.max(2, value) + '%;background:' + fg + ';border-radius:4px;transition:width 0.3s;"></div>' +
            '</div></div>';
    }

    function _kingOverviewTab(kingdom, ks) {
        var html = '';
        // Key stats
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">';
        html += '<div style="background:rgba(0,0,0,0.2);padding:6px;border-radius:6px;text-align:center;"><div style="font-size:0.7rem;color:#aaa;">Happiness</div><div style="font-size:1rem;color:#55a868;">' + Math.round(kingdom.happiness || 50) + '%</div></div>';
        html += '<div style="background:rgba(0,0,0,0.2);padding:6px;border-radius:6px;text-align:center;"><div style="font-size:0.7rem;color:#aaa;">Treasury</div><div style="font-size:1rem;color:#e0c58a;">' + formatGold(kingdom.gold || 0) + '</div></div>';

        // Town count
        var townCount = 0;
        try {
            var allTowns = Engine.getTowns();
            for (var _tci = 0; _tci < allTowns.length; _tci++) {
                if (allTowns[_tci].kingdomId === kingdom.id && !allTowns[_tci].isOutpost && !allTowns[_tci].isWilderness) townCount++;
            }
        } catch(e) {}
        html += '<div style="background:rgba(0,0,0,0.2);padding:6px;border-radius:6px;text-align:center;"><div style="font-size:0.7rem;color:#aaa;">Towns</div><div style="font-size:1rem;color:#5dade2;">' + townCount + '</div></div>';
        html += '<div style="background:rgba(0,0,0,0.2);padding:6px;border-radius:6px;text-align:center;"><div style="font-size:0.7rem;color:#aaa;">Tax Rate</div><div style="font-size:1rem;color:#d4c9a0;">' + Math.round((kingdom.taxRate || 0.08) * 100) + '%</div></div>';
        html += '</div>';

        // Treasury transfer section
        var _playerGold = (typeof Player !== 'undefined' && Player.state) ? (Player.state.gold || 0) : 0;
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:10px;border:1px solid rgba(224,197,138,0.2);">';
        html += '<div style="font-size:0.8rem;color:#e0c58a;margin-bottom:6px;">💰 Treasury Management</div>';
        html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">';
        html += '<span style="font-size:0.68rem;color:#aaa;">Kingdom: ' + formatGold(kingdom.gold || 0) + '</span>';
        html += '<span style="font-size:0.68rem;color:#888;">|</span>';
        html += '<span style="font-size:0.68rem;color:#aaa;">Your Gold: ' + formatGold(_playerGold) + '</span>';
        html += '</div>';
        html += '<div style="display:flex;gap:6px;align-items:center;">';
        html += '<input type="number" id="_treasuryAmount" min="10" value="100" style="font-size:0.68rem;width:70px;padding:3px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
        html += '<button class="btn-medieval" data-action="kingDonateTreasury" style="font-size:0.72rem;padding:4px 12px;color:#e8dcc8 !important;background:rgba(85,168,104,0.4) !important;border-color:rgba(85,168,104,0.6) !important;">💰 Donate</button>';
        html += '<button class="btn-medieval" data-action="kingWithdrawTreasury" style="font-size:0.72rem;padding:4px 12px;color:#e8dcc8 !important;background:rgba(196,78,82,0.45) !important;border-color:rgba(196,78,82,0.7) !important;">🏦 Withdraw</button>';
        html += '</div>';
        html += '</div>';
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:10px;">';
        html += '<div style="font-size:0.8rem;color:#d4a843;margin-bottom:4px;">⚠️ Risk Assessment</div>';
        html += _riskMeter(ks.assassinationRisk || 0, '🗡️ Assassination Risk', '#c44e52');
        html += _riskMeter(ks.revoltRisk || 0, '🔥 Revolt Risk', '#e67e22');
        html += '</div>';

        // Wars
        var wars = [];
        if (kingdom.atWar) {
            var warIter = kingdom.atWar.forEach ? kingdom.atWar : [];
            if (kingdom.atWar.forEach) {
                kingdom.atWar.forEach(function(wid) {
                    var wk = Engine.findKingdom(wid);
                    if (wk) wars.push(wk.name);
                });
            }
        }
        if (wars.length > 0) {
            html += '<div style="background:rgba(196,78,82,0.15);padding:6px;border-radius:6px;border:1px solid rgba(196,78,82,0.3);margin-bottom:8px;">';
            html += '<div style="font-size:0.8rem;color:#c44e52;">⚔️ At War With: ' + wars.join(', ') + '</div></div>';
        }

        // Active laws
        var laws = (kingdom.laws && kingdom.laws.specialLaws) || [];
        if (laws.length > 0) {
            html += '<div style="background:rgba(0,0,0,0.15);padding:6px;border-radius:6px;margin-bottom:8px;">';
            html += '<div style="font-size:0.8rem;color:#d4a843;margin-bottom:4px;">📜 Active Laws (' + laws.length + ')</div>';
            for (var _li = 0; _li < laws.length; _li++) {
                var _lawDef = (CONFIG.SPECIAL_LAWS || []).find(function(l) { return l.id === laws[_li].id; });
                html += '<div style="font-size:0.72rem;color:#d4c9a0;">• ' + (_lawDef ? _lawDef.name : laws[_li].id) + '</div>';
            }
            html += '</div>';
        }

        // Reign stats
        html += '<div style="background:rgba(0,0,0,0.15);padding:6px;border-radius:6px;">';
        html += '<div style="font-size:0.8rem;color:#d4a843;margin-bottom:4px;">📊 Reign Statistics</div>';
        html += '<div style="font-size:0.72rem;color:#d4c9a0;">Decrees issued: ' + (ks.decreesIssued || 0) + '</div>';
        html += '<div style="font-size:0.72rem;color:#d4c9a0;">Wars started: ' + (ks.warsStarted || 0) + '</div>';
        html += '<div style="font-size:0.72rem;color:#d4c9a0;">Peace treaties: ' + (ks.peacesMade || 0) + '</div>';
        html += '</div>';

        // Advisor suggestions
        var _suggestions = kingdom._advisorSuggestions || [];
        if (_suggestions.length > 0) {
            html += '<div style="background:rgba(93,173,226,0.08);padding:8px;border-radius:6px;border:1px solid rgba(93,173,226,0.2);margin-top:10px;">';
            html += '<div style="font-size:0.85rem;color:#5dade2;margin-bottom:6px;">📋 Royal Advisor Suggestions (' + _suggestions.length + ')</div>';
            for (var _si = 0; _si < _suggestions.length; _si++) {
                var _sug = _suggestions[_si];
                var _urgColor = _sug.urgency === 'critical' ? '#c44e52' : _sug.urgency === 'high' ? '#e67e22' : '#55a868';
                html += '<div style="background:rgba(0,0,0,0.2);padding:6px;border-radius:4px;margin-bottom:4px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                html += '<span style="font-size:0.75rem;color:#d4c9a0;">' + (_sug.icon || '💡') + ' ' + (_sug.title || _sug.type || 'Suggestion') + '</span>';
                html += '<span style="font-size:0.65rem;color:' + _urgColor + ';text-transform:uppercase;">' + (_sug.urgency || 'low') + '</span>';
                html += '</div>';
                html += '<div style="font-size:0.68rem;color:#aaa;margin-top:2px;">' + (_sug.description || '') + '</div>';
                // Action button routes to the relevant tab
                var _actTab = _sug.actionTab || 'decisions';
                html += '<button class="btn-medieval" data-action="openKingPanel" data-id="' + _actTab + '" style="margin-top:4px;font-size:0.65rem;padding:2px 8px;">Go to ' + _actTab.charAt(0).toUpperCase() + _actTab.slice(1) + ' →</button>';
                html += '</div>';
            }
            html += '</div>';
        }

        return html;
    }

    function _kingDecisionsTab(kingdom, ks) {
        var html = '';

        // Tax Rate
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">💰 Tax Policy</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">Set the kingdom tax rate. Higher taxes fill the treasury but decrease happiness.</div>';
        var curTax = Math.round((kingdom.taxRate || 0.08) * 100);
        html += '<div style="display:flex;align-items:center;gap:6px;">';
        html += '<span style="font-size:0.75rem;color:#d4c9a0;">2%</span>';
        html += '<input type="range" id="_kingTaxSlider" min="2" max="25" value="' + curTax + '" style="flex:1;accent-color:#d4a843;" oninput="document.getElementById(\'_kingTaxVal\').textContent=this.value+\'%\'">';
        html += '<span style="font-size:0.75rem;color:#d4c9a0;">25%</span>';
        html += '<span id="_kingTaxVal" style="font-size:0.85rem;color:#e0c58a;font-weight:bold;min-width:35px;text-align:right;">' + curTax + '%</span>';
        html += '</div>';
        html += '<button class="btn-medieval" data-action="kingSetTaxRate" style="margin-top:6px;font-size:0.72rem;padding:4px 12px;">📜 Set Tax Rate</button>';
        html += '</div>';

        // Laws
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">📜 Laws</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">Enact or repeal special laws. Each law has specific effects on your kingdom.</div>';
        var specialLaws = CONFIG.SPECIAL_LAWS || [];
        var activeLawIds = {};
        var _akLaws = (kingdom.laws && kingdom.laws.specialLaws) || [];
        for (var _ali = 0; _ali < _akLaws.length; _ali++) activeLawIds[_akLaws[_ali].id] = true;
        html += '<div style="max-height:200px;overflow-y:auto;">';
        for (var _sli = 0; _sli < specialLaws.length; _sli++) {
            var _sl = specialLaws[_sli];
            var _isActive = !!activeLawIds[_sl.id];
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;margin-bottom:2px;background:rgba(0,0,0,' + (_isActive ? '0.25' : '0.1') + ');border-radius:4px;border-left:3px solid ' + (_isActive ? '#55a868' : 'transparent') + ';">';
            html += '<div style="flex:1;"><span style="font-size:0.75rem;color:' + (_isActive ? '#55a868' : '#d4c9a0') + ';">' + (_sl.icon || '📜') + ' ' + _sl.name + '</span>';
            if (_sl.desc) html += '<div style="font-size:0.65rem;color:#888;">' + _sl.desc + '</div>';
            html += '</div>';
            if (_isActive) {
                html += '<button class="btn-medieval" data-action="kingRepealLaw" data-id="' + _sl.id + '" style="font-size:0.65rem;padding:2px 8px;background:rgba(196,78,82,0.3) !important;border-color:rgba(196,78,82,0.5) !important;">Repeal</button>';
            } else {
                html += '<button class="btn-medieval" data-action="kingEnactLaw" data-id="' + _sl.id + '" style="font-size:0.65rem;padding:2px 8px;">Enact</button>';
            }
            html += '</div>';
        }
        html += '</div></div>';

        // Military / War
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">⚔️ Military & Diplomacy</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">Declare war costs ' + formatGold(CONFIG.WAR_DECLARATION_COST || 300) + ' from treasury. Suing for peace costs 20% of treasury as tribute.</div>';
        // List all kingdoms
        try {
            var _allK = Engine.getWorld().kingdoms;
            for (var _ki = 0; _ki < _allK.length; _ki++) {
                var _tgt = _allK[_ki];
                if (_tgt.id === kingdom.id) continue;
                var _atWar = kingdom.atWar && kingdom.atWar.has && kingdom.atWar.has(_tgt.id);
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;margin-bottom:2px;background:rgba(0,0,0,0.1);border-radius:4px;">';
                html += '<span style="font-size:0.75rem;color:' + (_atWar ? '#c44e52' : '#d4c9a0') + ';">' + (_atWar ? '⚔️' : '🤝') + ' ' + _tgt.name + '</span>';
                if (_atWar) {
                    html += '<button class="btn-medieval" data-action="kingSuePeace" data-id="' + _tgt.id + '" style="font-size:0.72rem;padding:4px 12px;color:#e8dcc8 !important;background:rgba(93,173,226,0.4) !important;border-color:rgba(93,173,226,0.6) !important;">🕊️ Sue Peace</button>';
                } else {
                    html += '<button class="btn-medieval" data-action="kingDeclareWar" data-id="' + _tgt.id + '" style="font-size:0.72rem;padding:4px 12px;color:#e8dcc8 !important;background:rgba(196,78,82,0.45) !important;border-color:rgba(196,78,82,0.7) !important;">⚔️ Declare War</button>';
                }
                html += '</div>';
            }
        } catch(e) {}
        html += '</div>';

        // Feast / Court
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">🎉 Events</div>';
        var _feastReady = Engine.getDay() - (ks.feastHeldDay || 0) >= 30;
        var _courtReady = Engine.getDay() - (ks.courtHeldDay || 0) >= 30;
        var _activeFeastK = null;
        try { _activeFeastK = Engine.getActiveFeast(ks.kingdomId); } catch(e) {}
        var _pendingFeastK = null;
        try { _pendingFeastK = Engine.getPendingFeast ? Engine.getPendingFeast(ks.kingdomId) : null; } catch(e) {}
        var _activeCourtK = null;
        try { _activeCourtK = Engine.getCourtSession ? Engine.getCourtSession(ks.kingdomId) : null; } catch(e) {}
        var _pendingCourtK = null;
        try { _pendingCourtK = Engine.getPendingCourt ? Engine.getPendingCourt(ks.kingdomId) : null; } catch(e) {}
        var _courtHasUnresolved = _activeCourtK && _activeCourtK.cases && _activeCourtK.cases.some(function(c) { return !c.resolved; });
        // Mutual exclusion flags
        var _hasFeastActivity = _activeFeastK || _pendingFeastK;
        var _hasCourtActivity = _courtHasUnresolved || _pendingCourtK;
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
        if (_activeFeastK) {
            var _fDaysLeft = Math.max(0, (_activeFeastK.endDay || 0) - Engine.getDay());
            html += '<button class="btn-medieval" data-action="kingOpenActiveFeast" style="font-size:0.72rem;padding:4px 10px;background:rgba(200,150,50,0.3);border-color:rgba(200,150,50,0.5);">🎪 Feast in Progress (' + _fDaysLeft + 'd left)</button>';
        } else if (_pendingFeastK) {
            var _pfDays = Math.max(0, (_pendingFeastK.startDay || 0) - Engine.getDay());
            var _pfAccepted = (_pendingFeastK.invitedNobles || []).filter(function(n) { return n.accepted; }).length;
            html += '<button class="btn-medieval" disabled style="font-size:0.72rem;padding:4px 10px;background:rgba(200,150,50,0.2);border-color:rgba(200,150,50,0.3);">📅 Feast in ' + _pfDays + 'd (' + _pfAccepted + ' attending)</button>';
        } else {
            var _feastDisabled = !_feastReady || _hasCourtActivity;
            html += '<button class="btn-medieval" data-action="kingHostFeast" style="font-size:0.72rem;padding:4px 10px;' + (_feastDisabled ? 'opacity:0.5;' : '') + '" ' + (_feastDisabled ? 'disabled' : '') + '>🎉 Host Feast (500g)</button>';
        }
        if (_courtHasUnresolved) {
            html += '<button class="btn-medieval" data-action="kingOpenActiveCourt" style="font-size:0.72rem;padding:4px 10px;background:rgba(80,120,200,0.3);border-color:rgba(80,120,200,0.5);">⚖️ Court in Session (' + _activeCourtK.cases.filter(function(c){ return !c.resolved; }).length + ' cases)</button>';
        } else if (_pendingCourtK) {
            var _pcDays = Math.max(0, (_pendingCourtK.courtDay || 0) - Engine.getDay());
            var _pcAccepted = (_pendingCourtK.invitedNobles || []).filter(function(n) { return n.accepted; }).length;
            html += '<button class="btn-medieval" disabled style="font-size:0.72rem;padding:4px 10px;background:rgba(80,120,200,0.2);border-color:rgba(80,120,200,0.3);">📅 Court in ' + _pcDays + 'd (' + _pcAccepted + ' attending)</button>';
        } else {
            var _courtDisabled = !_courtReady || _hasFeastActivity;
            html += '<button class="btn-medieval" data-action="kingHoldCourt" style="font-size:0.72rem;padding:4px 10px;' + (_courtDisabled ? 'opacity:0.5;' : '') + '" ' + (_courtDisabled ? 'disabled' : '') + '>🏰 Hold Court</button>';
        }
        html += '</div>';
        if (!_activeFeastK && !_pendingFeastK && !_feastReady) html += '<div style="font-size:0.65rem;color:#888;margin-top:4px;">Feast available in ' + (30 - (Engine.getDay() - (ks.feastHeldDay || 0))) + ' days</div>';
        if (_hasFeastActivity && !_courtHasUnresolved && !_pendingCourtK) html += '<div style="font-size:0.65rem;color:#888;margin-top:4px;">Court unavailable while feast is active/planned</div>';
        if (_hasCourtActivity && !_activeFeastK && !_pendingFeastK) html += '<div style="font-size:0.65rem;color:#888;margin-top:4px;">Feast unavailable while court is active/planned</div>';
        if (!_courtHasUnresolved && !_pendingCourtK && !_courtReady) html += '<div style="font-size:0.65rem;color:#888;">Court available in ' + (30 - (Engine.getDay() - (ks.courtHeldDay || 0))) + ' days</div>';
        // Tribute collection
        var _tributeReady = Engine.getDay() - (ks._vassalTributeDay || 0) >= 30;
        html += '<div style="margin-top:6px;">';
        html += '<button class="btn-medieval" data-action="kingCollectTribute" style="font-size:0.72rem;padding:4px 10px;' + (!_tributeReady ? 'opacity:0.5;' : '') + '" ' + (!_tributeReady ? 'disabled' : '') + '>💎 Collect Vassal Tribute</button>';
        if (!_tributeReady) html += '<span style="font-size:0.65rem;color:#888;margin-left:6px;">Available in ' + (30 - (Engine.getDay() - (ks._vassalTributeDay || 0))) + ' days</span>';
        html += '</div>';
        html += '</div>';

        // ── Diplomacy & Trade Agreements ──
        html += _kingDiplomacySection(kingdom, ks);

        // ── Economic Proposals (advisor recommendations) ──
        html += _kingEconomicProposalsSection(kingdom);

        // ── Royal Orders ──
        html += _kingRoyalOrdersSection(kingdom);

        // ── War Management ──
        html += _kingWarManagementSection(kingdom, ks);

        return html;
    }

    // ── Royal Orders Section ──
    function _kingRoyalOrdersSection(kingdom) {
        var html = '';
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">📋 Royal Orders</div>';
        html += '<div style="font-size:0.68rem;color:#aaa;margin-bottom:8px;">Direct kingdom actions. Costs deducted from treasury.</div>';

        // Get towns for dropdowns
        var _roTowns = [];
        try { _roTowns = Engine.getTowns().filter(function(t) { return t.kingdomId === kingdom.id && !t.isWilderness; }); } catch(e) {}
        var _roRoads = [];
        try { _roRoads = Engine.getRoads(); } catch(e) {}

        // Build Road
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🛤️ Build Road <span style="font-size:0.62rem;color:#e0c58a;">(' + formatGold(350) + ')</span></div>';
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
        html += '<select id="_roFromTown" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:120px;">';
        html += '<option value="">From...</option>';
        for (var _roi = 0; _roi < _roTowns.length; _roi++) html += '<option value="' + _roTowns[_roi].id + '">' + escapeHtml(_roTowns[_roi].name) + '</option>';
        html += '</select>';
        html += '<select id="_roToTown" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:120px;">';
        html += '<option value="">To...</option>';
        for (var _roj = 0; _roj < _roTowns.length; _roj++) html += '<option value="' + _roTowns[_roj].id + '">' + escapeHtml(_roTowns[_roj].name) + '</option>';
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingOrderBuildRoad" style="font-size:0.62rem;padding:2px 6px;">Build</button>';
        html += '</div></div>';

        // Build Structure — dynamic from BUILDING_TYPES
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🏗️ Build Structure <span style="font-size:0.58rem;color:#aaa;">(cost = labor + materials at market price)</span></div>';
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
        html += '<select id="_roBuildTown" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:120px;">';
        html += '<option value="">Town...</option>';
        for (var _rok = 0; _rok < _roTowns.length; _rok++) html += '<option value="' + _roTowns[_rok].id + '">' + escapeHtml(_roTowns[_rok].name) + '</option>';
        html += '</select>';
        html += '<select id="_roBuildType" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:200px;">';
        html += '<option value="">Select building...</option>';
        // Group by category
        var _btCatOrder = [
            { cat: 'military', label: '⚔️ Military' },
            { cat: 'civic', label: '🏛️ Civic' },
            { cat: 'medical', label: '🏥 Medical' },
            { cat: 'farm', label: '🌾 Farm' },
            { cat: 'harvest', label: '🪓 Harvest' },
            { cat: 'mine', label: '⛏️ Mine' },
            { cat: 'processing', label: '⚙️ Processing' },
            { cat: 'finished', label: '📦 Finished Goods' },
            { cat: 'luxury', label: '💎 Luxury' },
            { cat: 'storage', label: '🏪 Storage' },
            { cat: 'trade', label: '💰 Trade' },
            { cat: 'port', label: '⚓ Port' },
            { cat: 'retail', label: '🍻 Retail' }
        ];
        var _btByCategory = {};
        if (typeof BUILDING_TYPES !== 'undefined') {
            for (var _btk in BUILDING_TYPES) {
                if (!BUILDING_TYPES.hasOwnProperty(_btk)) continue;
                var _btDef = BUILDING_TYPES[_btk];
                var _btCat = _btDef.category || 'other';
                if (!_btByCategory[_btCat]) _btByCategory[_btCat] = [];
                _btByCategory[_btCat].push(_btDef);
            }
        }
        for (var _bci = 0; _bci < _btCatOrder.length; _bci++) {
            var _catKey = _btCatOrder[_bci].cat;
            var _catItems = _btByCategory[_catKey];
            if (!_catItems || _catItems.length === 0) continue;
            _catItems.sort(function(a, b) { return (a.cost || 0) - (b.cost || 0); });
            html += '<optgroup label="' + escapeHtml(_btCatOrder[_bci].label) + '">';
            for (var _bii = 0; _bii < _catItems.length; _bii++) {
                var _bi = _catItems[_bii];
                html += '<option value="' + _bi.id + '">' + escapeHtml(_bi.name) + ' (' + formatGold(_bi.cost || 0) + ' labor)</option>';
            }
            html += '</optgroup>';
        }
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingOrderBuildStructure" style="font-size:0.62rem;padding:2px 6px;">Build</button>';
        html += '</div></div>';

        // Increase Security
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🛡️ Increase Town Security <span style="font-size:0.62rem;color:#e0c58a;">(' + formatGold(100) + ')</span></div>';
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
        html += '<select id="_roSecTown" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:140px;">';
        html += '<option value="">Select town...</option>';
        for (var _rol = 0; _rol < _roTowns.length; _rol++) html += '<option value="' + _roTowns[_rol].id + '">' + escapeHtml(_roTowns[_rol].name) + ' (Garrison: ' + (_roTowns[_rol].garrison || 0) + ')</option>';
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingOrderSecurity" style="font-size:0.62rem;padding:2px 6px;">Deploy</button>';
        html += '</div></div>';

        // Clear Bandits
        var _banditRoads = [];
        for (var _bri2 = 0; _bri2 < _roRoads.length; _bri2++) {
            var _brr = _roRoads[_bri2];
            if ((_brr.banditThreat || 0) > 10) {
                var _brFrom = Engine.findTown(_brr.fromTownId);
                var _brTo = Engine.findTown(_brr.toTownId);
                if (_brFrom && _brTo && (_brFrom.kingdomId === kingdom.id || _brTo.kingdomId === kingdom.id)) {
                    _banditRoads.push({ index: _bri2, from: _brFrom.name, to: _brTo.name, threat: _brr.banditThreat });
                }
            }
        }
        if (_banditRoads.length > 0) {
            html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
            html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">⚔️ Clear Bandits <span style="font-size:0.62rem;color:#e0c58a;">(' + formatGold(150) + ')</span></div>';
            html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
            html += '<select id="_roBanditRoad" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:180px;">';
            for (var _bri3 = 0; _bri3 < _banditRoads.length; _bri3++) html += '<option value="' + _banditRoads[_bri3].index + '">' + escapeHtml(_banditRoads[_bri3].from) + ' ↔ ' + escapeHtml(_banditRoads[_bri3].to) + ' (Threat: ' + Math.round(_banditRoads[_bri3].threat) + ')</option>';
            html += '</select>';
            html += '<button class="btn-medieval" data-action="kingOrderClearBandits" style="font-size:0.62rem;padding:2px 6px;">Clear</button>';
            html += '</div></div>';
        }

        // Repair Infrastructure
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🔧 Repair Infrastructure <span style="font-size:0.62rem;color:#e0c58a;">(' + formatGold(200) + ')</span></div>';
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
        html += '<select id="_roRepairTown" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:140px;">';
        html += '<option value="">Select town...</option>';
        for (var _rom = 0; _rom < _roTowns.length; _rom++) html += '<option value="' + _roTowns[_rom].id + '">' + escapeHtml(_roTowns[_rom].name) + '</option>';
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingOrderRepairInfra" style="font-size:0.62rem;padding:2px 6px;">Repair</button>';
        html += '</div></div>';

        // Repair Bridge
        var _brokenBridges = [];
        for (var _bbi = 0; _bbi < _roRoads.length; _bbi++) {
            var _bbr = _roRoads[_bbi];
            if (_bbr.bridges) {
                for (var _bbj = 0; _bbj < _bbr.bridges.length; _bbj++) {
                    if (_bbr.bridges[_bbj].destroyed) {
                        var _bbFrom = Engine.findTown(_bbr.fromTownId);
                        var _bbTo = Engine.findTown(_bbr.toTownId);
                        if (_bbFrom && _bbTo && (_bbFrom.kingdomId === kingdom.id || _bbTo.kingdomId === kingdom.id)) {
                            _brokenBridges.push({ index: _bbi, from: _bbFrom.name, to: _bbTo.name });
                            break;
                        }
                    }
                }
            }
        }
        if (_brokenBridges.length > 0) {
            html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
            html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🌉 Repair Bridge <span style="font-size:0.62rem;color:#e0c58a;">(' + formatGold(300) + ')</span></div>';
            html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
            html += '<select id="_roBridgeRoad" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:180px;">';
            for (var _bbi2 = 0; _bbi2 < _brokenBridges.length; _bbi2++) html += '<option value="' + _brokenBridges[_bbi2].index + '">' + escapeHtml(_brokenBridges[_bbi2].from) + ' ↔ ' + escapeHtml(_brokenBridges[_bbi2].to) + '</option>';
            html += '</select>';
            html += '<button class="btn-medieval" data-action="kingOrderRepairBridge" style="font-size:0.62rem;padding:2px 6px;">Repair</button>';
            html += '</div></div>';
        }

        // Ban/Unban Goods
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🚫 Ban/Unban Goods</div>';
        var _bannedGoods = (kingdom.laws && kingdom.laws.bannedGoods) || [];
        var _tradeGoods = (typeof CONFIG !== 'undefined' && CONFIG.TRADE_GOODS) ? CONFIG.TRADE_GOODS : [];
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
        html += '<select id="_roBanGood" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:120px;">';
        if (_tradeGoods.length > 0) {
            for (var _tgi = 0; _tgi < _tradeGoods.length; _tgi++) {
                var _tg = _tradeGoods[_tgi];
                var _tgId = _tg.id || _tg;
                var _tgName = _tg.name || _tgId;
                html += '<option value="' + _tgId + '">' + escapeHtml(_tgName) + '</option>';
            }
        } else {
            var _defaultGoods = ['wheat', 'bread', 'fish', 'wine', 'ale', 'wool', 'cloth', 'silk', 'iron', 'tools', 'weapons', 'wood', 'stone', 'salt', 'spices', 'gold_ore', 'jewelry'];
            for (var _dgi = 0; _dgi < _defaultGoods.length; _dgi++) html += '<option value="' + _defaultGoods[_dgi] + '">' + _defaultGoods[_dgi] + '</option>';
        }
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingOrderBanGood" style="font-size:0.62rem;padding:2px 6px;">🚫 Ban</button>';
        html += '<button class="btn-medieval" data-action="kingOrderUnbanGood" style="font-size:0.62rem;padding:2px 6px;">✅ Unban</button>';
        html += '</div>';
        if (_bannedGoods.length > 0) html += '<div style="font-size:0.62rem;color:#c44e52;margin-top:3px;">Currently banned: ' + _bannedGoods.join(', ') + '</div>';
        html += '</div>';

        // Throw Festival (Small/Large)
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🎉 Town Festival <span style="font-size:0.62rem;color:#888;">(for common people)</span></div>';
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
        html += '<select id="_roFestTown" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:140px;">';
        html += '<option value="">Select town...</option>';
        for (var _ron = 0; _ron < _roTowns.length; _ron++) {
            var _fTown = _roTowns[_ron];
            var _fCd = Engine.getDay() - (_fTown._lastFestivalDay || 0);
            var _fReady = _fCd >= 90;
            html += '<option value="' + _fTown.id + '"' + (!_fReady ? ' disabled' : '') + '>' + escapeHtml(_fTown.name) + (_fReady ? '' : ' (CD: ' + (90 - _fCd) + 'd)') + '</option>';
        }
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingStartSmallFestival" style="font-size:0.62rem;padding:2px 6px;" title="3 days, +10 happiness during, +5 for 15 days after">🎉 Small (' + formatGold(500) + ')</button>';
        html += '<button class="btn-medieval" data-action="kingStartLargeFestival" style="font-size:0.62rem;padding:2px 6px;" title="3 days, +20 happiness during, +10 for 15 days after">🎊 Grand (' + formatGold(2000) + ')</button>';
        html += '</div>';
        // Show active festivals
        var _activeFests = kingdom._activeFestivals || [];
        if (_activeFests.length > 0) {
            html += '<div style="margin-top:4px;font-size:0.62rem;color:#e0c58a;">';
            for (var _afi = 0; _afi < _activeFests.length; _afi++) {
                var _af = _activeFests[_afi];
                var _afDaysLeft = _af.endDay - Engine.getDay();
                html += '🎪 ' + escapeHtml(_af.townName || 'Town') + ': ' + (_af.type === 'large' ? 'Grand' : 'Small') + ' festival (' + _afDaysLeft + 'd left)<br>';
            }
            html += '</div>';
        }
        html += '</div>';

        // Promote Outpost
        var _outposts = [];
        try { _outposts = Engine.getTowns().filter(function(t) { return t.kingdomId === kingdom.id && t.category === 'outpost' && (t.population || 0) >= 20; }); } catch(e) {}
        if (_outposts.length > 0) {
            html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
            html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🏘️ Promote Outpost <span style="font-size:0.62rem;color:#e0c58a;">(' + formatGold(250) + ')</span></div>';
            html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
            html += '<select id="_roPromoteOutpost" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:140px;">';
            for (var _opi = 0; _opi < _outposts.length; _opi++) html += '<option value="' + _outposts[_opi].id + '">' + escapeHtml(_outposts[_opi].name) + ' (Pop: ' + (_outposts[_opi].population || 0) + ')</option>';
            html += '</select>';
            html += '<button class="btn-medieval" data-action="kingOrderPromoteOutpost" style="font-size:0.62rem;padding:2px 6px;">Promote</button>';
            html += '</div></div>';
        }

        // ── Economic Orders ──
        html += '<div style="font-size:0.8rem;color:#d4a843;margin:10px 0 6px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;">💰 Economic Orders</div>';

        // Export Ban
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🚢 Export Ban <span style="font-size:0.62rem;color:#888;">(Block exports of a good to a kingdom)</span></div>';
        var _exportBans = (kingdom.laws && kingdom.laws.exportBans) || [];
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
        var _exGoods = ['wheat', 'bread', 'fish', 'wine', 'ale', 'wool', 'cloth', 'silk', 'iron', 'tools', 'swords', 'armor', 'bows', 'wood', 'stone', 'salt', 'spices', 'horses'];
        html += '<select id="_roExportGood" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:100px;">';
        for (var _egi = 0; _egi < _exGoods.length; _egi++) html += '<option value="' + _exGoods[_egi] + '">' + _exGoods[_egi] + '</option>';
        html += '</select>';
        var _otherKingdoms = [];
        try { _otherKingdoms = Engine.getKingdoms().filter(function(ok) { return ok.id !== kingdom.id; }); } catch(e) {}
        html += '<select id="_roExportKingdom" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:100px;">';
        html += '<option value="all">All Kingdoms</option>';
        for (var _oki = 0; _oki < _otherKingdoms.length; _oki++) html += '<option value="' + _otherKingdoms[_oki].id + '">' + escapeHtml(_otherKingdoms[_oki].name) + '</option>';
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingExportBan" style="font-size:0.62rem;padding:2px 6px;">🚫 Ban</button>';
        html += '<button class="btn-medieval" data-action="kingExportUnban" style="font-size:0.62rem;padding:2px 6px;">✅ Lift</button>';
        html += '</div>';
        if (_exportBans.length > 0) {
            html += '<div style="font-size:0.6rem;color:#c44e52;margin-top:3px;">Active bans: ';
            for (var _ebi = 0; _ebi < _exportBans.length; _ebi++) {
                var _eb = _exportBans[_ebi];
                html += _eb.good + ' → ' + (_eb.target === 'all' ? 'All' : (_eb.targetName || _eb.target));
                if (_ebi < _exportBans.length - 1) html += ', ';
            }
            html += '</div>';
        }
        html += '</div>';

        // Production Bounty
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🏭 Production Bounty <span style="font-size:0.62rem;color:#888;">(+2g per unit produced)</span> <span style="font-size:0.62rem;color:#e0c58a;">(' + formatGold(100) + '/season)</span></div>';
        var _activeBounties = (kingdom.laws && kingdom.laws.productionBounties) || [];
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
        html += '<select id="_roBountyGood" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:120px;">';
        for (var _bgi = 0; _bgi < _exGoods.length; _bgi++) html += '<option value="' + _exGoods[_bgi] + '">' + _exGoods[_bgi] + '</option>';
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingSetBounty" style="font-size:0.62rem;padding:2px 6px;">📜 Set</button>';
        html += '<button class="btn-medieval" data-action="kingRemoveBounty" style="font-size:0.62rem;padding:2px 6px;">❌ Remove</button>';
        html += '</div>';
        if (_activeBounties.length > 0) html += '<div style="font-size:0.6rem;color:#55a868;margin-top:3px;">Active bounties: ' + _activeBounties.join(', ') + '</div>';
        html += '</div>';

        // Goods Subsidy
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">💸 Goods Subsidy <span style="font-size:0.62rem;color:#888;">(Kingdom pays 30% of price)</span> <span style="font-size:0.62rem;color:#e0c58a;">(' + formatGold(150) + '/season)</span></div>';
        var _activeSubsidies = (kingdom.laws && kingdom.laws.goodsSubsidies) || [];
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
        html += '<select id="_roSubsidyGood" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:120px;">';
        for (var _sgi = 0; _sgi < _exGoods.length; _sgi++) html += '<option value="' + _exGoods[_sgi] + '">' + _exGoods[_sgi] + '</option>';
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingSetSubsidy" style="font-size:0.62rem;padding:2px 6px;">💸 Set</button>';
        html += '<button class="btn-medieval" data-action="kingRemoveSubsidy" style="font-size:0.62rem;padding:2px 6px;">❌ Remove</button>';
        html += '</div>';
        if (_activeSubsidies.length > 0) html += '<div style="font-size:0.6rem;color:#5dade2;margin-top:3px;">Subsidized: ' + _activeSubsidies.join(', ') + '</div>';
        html += '</div>';

        // Land Subsidy
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🏡 Land Subsidy <span style="font-size:0.62rem;color:#888;">(Reduce building costs 25%)</span> <span style="font-size:0.62rem;color:#e0c58a;">(' + formatGold(200) + '/season)</span></div>';
        var _landSubTowns = (kingdom.laws && kingdom.laws.landSubsidyTowns) || [];
        // v9p33river306: replaced legacy/invalid building ids ('marketplace',
        // 'mill', 'lumber_mill', 'mine', 'dock') with the canonical config
        // ids from config.js (marketplace_royal, flour_mill, coal_mine/
        // sulfur_mine, no 'dock' — use port_fortress or omit).
        var _landSubBuildings = ['farm', 'bakery', 'blacksmith', 'armorer', 'fletcher', 'clinic', 'hospital', 'marketplace_royal', 'inn', 'tavern', 'flour_mill', 'coal_mine', 'sulfur_mine', 'quarry', 'warehouse', 'guild_hall'];
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
        html += '<select id="_roLandSubTown" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:120px;">';
        html += '<option value="">Select town...</option>';
        for (var _lsi = 0; _lsi < _roTowns.length; _lsi++) html += '<option value="' + _roTowns[_lsi].id + '">' + escapeHtml(_roTowns[_lsi].name) + '</option>';
        html += '</select>';
        html += '<select id="_roLandSubBldg" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:120px;">';
        html += '<option value="all">All Buildings</option>';
        for (var _lbi = 0; _lbi < _landSubBuildings.length; _lbi++) html += '<option value="' + _landSubBuildings[_lbi] + '">' + _landSubBuildings[_lbi].replace(/_/g, ' ') + '</option>';
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingSetLandSubsidy" style="font-size:0.62rem;padding:2px 6px;">🏡 Set</button>';
        html += '<button class="btn-medieval" data-action="kingRemoveLandSubsidy" style="font-size:0.62rem;padding:2px 6px;">❌ Remove</button>';
        html += '</div>';
        if (_landSubTowns.length > 0) {
            var _lsNames = [];
            for (var _lsni = 0; _lsni < _landSubTowns.length; _lsni++) {
                var _lsEntry = _landSubTowns[_lsni];
                var _lsTownId = typeof _lsEntry === 'string' ? _lsEntry : _lsEntry.townId;
                var _lsBldgType = typeof _lsEntry === 'object' && _lsEntry.buildingType ? _lsEntry.buildingType : 'all';
                var _lst = Engine.findTown(_lsTownId);
                var _lsLabel = (_lst ? _lst.name : _lsTownId) + (_lsBldgType !== 'all' ? ' (' + _lsBldgType.replace(/_/g, ' ') + ')' : '');
                _lsNames.push(_lsLabel);
            }
            html += '<div style="font-size:0.6rem;color:#55a868;margin-top:3px;">Land subsidies in: ' + _lsNames.join(', ') + '</div>';
        }
        html += '</div>';

        html += '</div>';
        return html;
    }

    // ── War Management Section ──
    function _kingWarManagementSection(kingdom, ks) {
        var html = '';
        var atWar = kingdom.atWar && ((kingdom.atWar.size > 0) || (Array.isArray(kingdom.atWar) && kingdom.atWar.length > 0));
        if (!atWar) return '';

        html += '<div style="background:rgba(196,78,82,0.1);padding:8px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(196,78,82,0.3);">';
        html += '<div style="font-size:0.85rem;color:#c44e52;margin-bottom:6px;">⚔️ War Management</div>';

        // Per-enemy info
        var warTargets = [];
        if (kingdom.atWar && kingdom.atWar.forEach) {
            kingdom.atWar.forEach(function(wid) {
                var wk = Engine.findKingdom(wid);
                if (wk) warTargets.push(wk);
            });
        }

        for (var _wi = 0; _wi < warTargets.length; _wi++) {
            var _wk = warTargets[_wi];
            var _wExh = _wk._warExhaustion || 0;
            var _eMil = _wk.militaryStrength || 50;
            html += '<div style="background:rgba(0,0,0,0.15);padding:6px;border-radius:4px;margin-bottom:4px;">';
            html += '<div style="font-size:0.78rem;color:#c44e52;margin-bottom:4px;">⚔️ War with ' + escapeHtml(_wk.name) + '</div>';
            // War exhaustion bar
            html += '<div style="font-size:0.65rem;color:#aaa;">Enemy War Exhaustion:</div>';
            html += '<div style="background:rgba(0,0,0,0.3);border-radius:3px;height:8px;overflow:hidden;margin:2px 0 4px;">';
            html += '<div style="height:100%;width:' + Math.max(2, _wExh) + '%;background:' + (_wExh > 60 ? '#55a868' : '#e67e22') + ';border-radius:3px;"></div>';
            html += '</div>';
            html += '<div style="font-size:0.62rem;color:#888;margin-bottom:4px;">Enemy Military: ~' + _eMil + ' | Our Military: ~' + (kingdom.militaryStrength || 50) + '</div>';

            // Enemy towns to attack
            var _eTowns = [];
            try { _eTowns = Engine.getTowns().filter(function(t) { return t.kingdomId === _wk.id && !t.isWilderness; }); } catch(e) {}
            if (_eTowns.length > 0) {
                html += '<div style="font-size:0.65rem;color:#ddd;margin-bottom:2px;">Send army to:</div>';
                html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
                html += '<select id="_warTarget_' + _wi + '" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:140px;">';
                for (var _eti = 0; _eti < _eTowns.length; _eti++) html += '<option value="' + _eTowns[_eti].id + '">' + escapeHtml(_eTowns[_eti].name) + ' (G:' + (_eTowns[_eti].garrison || 0) + ')</option>';
                html += '</select>';
                html += '<input type="number" id="_warSoldiers_' + _wi + '" min="10" max="200" value="30" style="font-size:0.65rem;width:50px;padding:2px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
                html += '<button class="btn-medieval" data-action="kingSendArmyUI" data-id="' + _wi + '" style="font-size:0.62rem;padding:2px 6px;background:rgba(196,78,82,0.3) !important;">⚔️ Send</button>';
                html += '</div>';
            }

            // Check for pending peace offer from this enemy
            var _peaceOffers = (kingdom._pendingPetitions || []).filter(function(p) { return p.type === 'peace_offer' && p.fromId === _wk.id; });
            if (_peaceOffers.length > 0) {
                var _po = _peaceOffers[0];
                var _poTerms = _po.peaceTerms || {};
                var _poOffer = _poTerms.offer || {};
                var _poGold = Math.floor(_poOffer.gold || 0);
                var _poTowns = (_poOffer.towns || []).length;
                html += '<div style="background:rgba(93,173,226,0.12);border:1px solid rgba(93,173,226,0.3);padding:6px;border-radius:4px;margin-top:4px;">';
                html += '<div style="font-size:0.75rem;color:#90caf9;margin-bottom:3px;">🕊️ ' + escapeHtml(_wk.name) + ' Offers Peace!</div>';
                html += '<div style="font-size:0.65rem;color:#aaa;margin-bottom:4px;">They offer: <strong style="color:#e0c58a;">' + formatGold(_poGold) + '</strong> gold';
                if (_poTowns > 0) html += ' + <strong style="color:#81c784;">' + _poTowns + ' town' + (_poTowns > 1 ? 's' : '') + '</strong>';
                if (_poOffer.concessions && _poOffer.concessions.length > 0) html += ' + concessions';
                html += '</div>';
                html += '<div style="display:flex;gap:6px;">';
                html += '<button class="btn-medieval" data-action="kingAcceptPeaceOffer" data-id="' + _wk.id + '" style="font-size:0.68rem;padding:4px 12px;background:rgba(85,168,104,0.3) !important;border:1px solid rgba(85,168,104,0.5) !important;color:#81c784;">🕊️ Accept Peace (+' + formatGold(_poGold) + ')</button>';
                html += '<button class="btn-medieval" data-action="kingRejectPeaceOffer" data-id="' + _wk.id + '" style="font-size:0.68rem;padding:4px 12px;opacity:0.7;">🔥 Reject — Continue War</button>';
                html += '</div></div>';
            }

            // Check for surrender offer
            var _surrenderOffers = (kingdom._pendingPetitions || []).filter(function(p) { return p.type === 'surrender_offer' && p.fromId === _wk.id; });
            if (_surrenderOffers.length > 0) {
                var _so = _surrenderOffers[0];
                var _soTerms = _so.peaceTerms || {};
                var _soOffer = _soTerms.offer || {};
                var _soGold = Math.floor(_soOffer.gold || 0);
                var _soTowns = (_soOffer.towns || []).length;
                html += '<div style="background:rgba(85,168,104,0.12);border:1px solid rgba(85,168,104,0.3);padding:6px;border-radius:4px;margin-top:4px;">';
                html += '<div style="font-size:0.75rem;color:#81c784;margin-bottom:3px;">🏳️ ' + escapeHtml(_wk.name) + ' Wants to Surrender!</div>';
                html += '<div style="font-size:0.65rem;color:#aaa;margin-bottom:4px;">They offer: <strong style="color:#e0c58a;">' + formatGold(_soGold) + '</strong> gold';
                if (_soTowns > 0) html += ' + <strong style="color:#81c784;">' + _soTowns + ' town' + (_soTowns > 1 ? 's' : '') + '</strong>';
                html += '</div>';
                html += '<div style="display:flex;gap:6px;">';
                html += '<button class="btn-medieval" data-action="kingAcceptPeaceOffer" data-id="' + _wk.id + '" style="font-size:0.68rem;padding:4px 12px;background:rgba(85,168,104,0.3) !important;border:1px solid rgba(85,168,104,0.5) !important;color:#81c784;">🏳️ Accept Surrender (+' + formatGold(_soGold) + ')</button>';
                html += '<button class="btn-medieval" data-action="kingRejectPeaceOffer" data-id="' + _wk.id + '" style="font-size:0.68rem;padding:4px 12px;opacity:0.7;">🔥 Reject — Continue War</button>';
                html += '</div></div>';
            }

            html += '</div>';
        }

        // Raise Army
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🪖 Raise Army <span style="font-size:0.62rem;color:#888;">(100g per 10 soldiers)</span></div>';
        html += '<div style="display:flex;gap:4px;align-items:center;">';
        html += '<input type="number" id="_raiseCount" min="10" max="200" step="10" value="30" style="font-size:0.65rem;width:55px;padding:2px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
        html += '<span id="_raiseCost" style="font-size:0.62rem;color:#e0c58a;">Cost: ' + formatGold(300) + '</span>';
        html += '<button class="btn-medieval" data-action="kingRaiseArmyUI" style="font-size:0.62rem;padding:2px 6px;">🪖 Raise</button>';
        html += '</div></div>';

        // Fortify Town
        var _fTowns = [];
        try { _fTowns = Engine.getTowns().filter(function(t) { return t.kingdomId === kingdom.id && !t.isWilderness; }); } catch(e) {}
        html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
        html += '<div style="font-size:0.75rem;color:#ddd;margin-bottom:4px;">🏰 Fortify Town <span style="font-size:0.62rem;color:#e0c58a;">(' + formatGold(150) + ')</span></div>';
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
        html += '<select id="_fortifyTown" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:140px;">';
        html += '<option value="">Select town...</option>';
        for (var _fti = 0; _fti < _fTowns.length; _fti++) html += '<option value="' + _fTowns[_fti].id + '">' + escapeHtml(_fTowns[_fti].name) + ' (G:' + (_fTowns[_fti].garrison || 0) + ')</option>';
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingFortifyTownUI" style="font-size:0.62rem;padding:2px 6px;">🏰 Fortify</button>';
        html += '</div></div>';

        // Active Armies Status
        var _armies = kingdom._armies || [];
        if (_armies.length > 0) {
            html += '<div style="background:rgba(0,0,0,0.1);padding:6px;border-radius:4px;margin-bottom:4px;">';
            html += '<div style="font-size:0.75rem;color:#5dade2;margin-bottom:4px;">📊 Active Armies (' + _armies.length + ')</div>';
            var _day = 0;
            try { _day = Engine.getDay(); } catch(e) {}
            for (var _ari = 0; _ari < _armies.length; _ari++) {
                var _ar = _armies[_ari];
                var _arTown = Engine.findTown(_ar.targetTownId);
                var _statusIcon = _ar._recoveryUntil ? '🛏️' : _ar.status === 'retreating' ? '🏳️' : _ar.status === 'besieging' ? '🏰' : _ar.status === 'consolidating' ? '📦' : _ar.status === 'marching' ? (_ar.mounted ? '🐴' : '🚶') : _ar.status === 'recovering' ? '🛏️' : '⚔️';
                var _statusText = '';
                if (_ar._recoveryUntil) {
                    _statusText = 'Recovering (' + Math.max(0, _ar._recoveryUntil - _day) + 'd)';
                } else if (_ar.status === 'retreating') {
                    _statusText = 'Retreating home';
                } else if (_ar.status === 'besieging') {
                    _statusText = 'Besieging';
                } else if (_ar.status === 'consolidating') {
                    var _consLeft = _ar.consolidationDaysLeft || 0;
                    _statusText = 'Consolidating at ' + escapeHtml(_ar.stagingTownName || '?') + ' (' + _consLeft + 'd)';
                } else if (_ar.status === 'marching') {
                    if (_ar._daysLeft != null && _ar._daysLeft >= 0) {
                        _statusText = 'Marching (' + _ar._daysLeft + 'd left)';
                    } else if (_ar.arrivalDay && _ar.departDay) {
                        var _fb = Math.max(0, _ar.arrivalDay - _day);
                        _statusText = 'Marching (' + _fb + 'd left)';
                    } else {
                        _statusText = 'Marching';
                    }
                } else {
                    _statusText = _ar.status || 'Unknown';
                }
                var _mountLabel = _ar.mounted ? ' 🐴' : '';
                html += '<div style="font-size:0.65rem;color:#ccc;padding:2px 0;">' + _statusIcon + ' ' + _ar.soldiers + ' soldiers' + _mountLabel + ' → ' + (_arTown ? escapeHtml(_arTown.name) : '?') + ' — ' + _statusText + ' · Morale: ' + Math.round(_ar.morale || 50) + '%</div>';
            }
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // =========================================================================
    // Military Tab — Army management, recruitment, garrison, war dispatch
    // =========================================================================
    function _kingMilitaryTab(kingdom, ks) {
        var html = '';

        // Military overview
        var _milStrength = kingdom.militaryStrength || 0;
        var _soldiers = kingdom.soldiers || 0;
        var _stockpile = kingdom.militaryStockpile || {};
        var _swords = _stockpile.swords || 0;
        var _armor = _stockpile.armor || 0;
        var _bows = _stockpile.bows || 0;
        var _arrows = _stockpile.arrows || 0;
        var _horses = _stockpile.horses || 0;
        var _warExh = kingdom.warExhaustion || 0;

        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">';
        html += '<div style="background:rgba(0,0,0,0.2);padding:6px;border-radius:6px;text-align:center;"><div style="font-size:0.7rem;color:#aaa;">Military Strength</div><div style="font-size:1rem;color:#c44e52;">' + Math.round(_milStrength) + '</div></div>';
        html += '<div style="background:rgba(0,0,0,0.2);padding:6px;border-radius:6px;text-align:center;"><div style="font-size:0.7rem;color:#aaa;">Total Soldiers</div><div style="font-size:1rem;color:#5dade2;">' + _soldiers + '</div></div>';
        html += '<div style="background:rgba(0,0,0,0.2);padding:6px;border-radius:6px;text-align:center;"><div style="font-size:0.7rem;color:#aaa;">War Exhaustion</div><div style="font-size:1rem;color:' + (_warExh > 60 ? '#c44e52' : _warExh > 30 ? '#e67e22' : '#55a868') + ';">' + Math.round(_warExh) + '%</div></div>';
        html += '<div style="background:rgba(0,0,0,0.2);padding:6px;border-radius:6px;text-align:center;"><div style="font-size:0.7rem;color:#aaa;">Treasury</div><div style="font-size:1rem;color:#e0c58a;">' + formatGold(kingdom.gold || 0) + '</div></div>';
        html += '</div>';

        // Military Stockpile
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">🗡️ Military Stockpile</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">';
        html += '<div style="background:rgba(0,0,0,0.2);padding:4px;border-radius:4px;text-align:center;font-size:0.68rem;"><span style="color:#aaa;">⚔️ Swords</span><br><span style="color:#d4c9a0;">' + _swords + '</span></div>';
        html += '<div style="background:rgba(0,0,0,0.2);padding:4px;border-radius:4px;text-align:center;font-size:0.68rem;"><span style="color:#aaa;">🛡️ Armor</span><br><span style="color:#d4c9a0;">' + _armor + '</span></div>';
        html += '<div style="background:rgba(0,0,0,0.2);padding:4px;border-radius:4px;text-align:center;font-size:0.68rem;"><span style="color:#aaa;">🏹 Bows</span><br><span style="color:#d4c9a0;">' + _bows + '</span></div>';
        html += '<div style="background:rgba(0,0,0,0.2);padding:4px;border-radius:4px;text-align:center;font-size:0.68rem;"><span style="color:#aaa;">🎯 Arrows</span><br><span style="color:#d4c9a0;">' + _arrows + '</span></div>';
        html += '<div style="background:rgba(0,0,0,0.2);padding:4px;border-radius:4px;text-align:center;font-size:0.68rem;"><span style="color:#aaa;">🐴 Horses</span><br><span style="color:#d4c9a0;">' + _horses + '</span></div>';
        html += '</div></div>';

        // Recruitment Postings
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">🎖️ Soldier Recruitment</div>';
        var _recruitCost = CONFIG.SOLDIER_RECRUIT_COST || 50;
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">Post recruitment orders for soldiers (' + formatGold(_recruitCost) + '/soldier). NPCs will enlist over time from their towns.</div>';

        // Show active postings
        var _postings = kingdom._recruitmentPostings || [];
        if (_postings.length > 0) {
            html += '<div style="margin-bottom:6px;">';
            for (var _pi = 0; _pi < _postings.length; _pi++) {
                var _post = _postings[_pi];
                var _pctFilled = Math.round(_post.slotsFilled / _post.slotsTotal * 100);
                var _pType = _post.isConscription ? '⚠️ Conscription' : '📜 Voluntary';
                var _pColor = _pctFilled >= 80 ? '#55a868' : _pctFilled >= 40 ? '#e0c58a' : '#c44e52';
                html += '<div style="padding:3px 6px;margin-bottom:2px;background:rgba(0,0,0,0.1);border-radius:4px;font-size:0.7rem;">';
                html += '<span style="color:#d4c9a0;">' + _pType + '</span> ';
                html += '<span style="color:' + _pColor + ';">' + _post.slotsFilled + '/' + _post.slotsTotal + ' filled (' + _pctFilled + '%)</span>';
                html += ' <span style="color:#888;">· Day ' + _post.postedDay + ' · ' + formatGold(_post.payPerSoldier) + '/ea</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
        html += '<label style="font-size:0.72rem;color:#d4c9a0;">Post for:</label>';
        html += '<input type="number" id="_kingRecruitCount" min="1" max="50" value="10" style="width:60px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#d4c9a0;padding:2px 4px;font-size:0.72rem;text-align:center;">';
        html += '<span style="font-size:0.65rem;color:#888;">soldiers</span>';
        html += '</div>';
        var _canAfford = (kingdom.gold || 0) >= _recruitCost;
        var _postingsFull = _postings.length >= 3;
        html += '<div style="display:flex;gap:4px;flex-wrap:wrap;">';
        html += '<button class="btn-medieval" data-action="kingRecruitSoldiers" style="font-size:0.72rem;padding:4px 12px;' + (!_canAfford || _postingsFull ? 'opacity:0.5;' : '') + '" ' + (!_canAfford || _postingsFull ? 'disabled' : '') + '>🎖️ Post Recruitment</button>';
        // Conscription button
        var _hasConscription = kingdom.laws && kingdom.laws.conscription;
        var _conscriptPay = Math.round(_recruitCost * 0.2);
        html += '<button class="btn-medieval" data-action="kingConscriptSoldiers" style="font-size:0.72rem;padding:4px 12px;' + (!_hasConscription || _postingsFull ? 'opacity:0.5;' : '') + '" ' + (!_hasConscription || _postingsFull ? 'disabled' : '') + '>⚠️ Conscript (' + formatGold(_conscriptPay) + '/ea)</button>';
        html += '</div>';
        if (_postingsFull) html += '<div style="font-size:0.65rem;color:#e67e22;margin-top:2px;">Max 3 active postings. Wait for them to fill.</div>';
        if (!_canAfford) html += '<div style="font-size:0.65rem;color:#c44e52;margin-top:2px;">Not enough treasury gold.</div>';
        if (!_hasConscription) html += '<div style="font-size:0.65rem;color:#888;margin-top:2px;">Enable Conscription law to use forced recruitment (males 18+).</div>';
        html += '</div>';

        // Garrison per town with transfer UI
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">🏰 Town Garrisons</div>';

        // Show pending transfers
        var _transfers = kingdom._soldierTransfers || [];
        if (_transfers.length > 0) {
            html += '<div style="margin-bottom:6px;padding:4px;background:rgba(200,170,100,0.08);border-radius:4px;">';
            html += '<div style="font-size:0.7rem;color:#d4a843;margin-bottom:2px;">🚶 In Transit:</div>';
            for (var _tri = 0; _tri < _transfers.length; _tri++) {
                var _tr = _transfers[_tri];
                var _trTo = Engine.findTown(_tr.toTownId);
                var _trFrom = Engine.findTown(_tr.fromTownId);
                var _daysLeft = Math.max(0, _tr.arrivalDay - (Engine.getDay ? Engine.getDay() : 0));
                html += '<div style="font-size:0.65rem;color:#aaa;padding:1px 4px;">' + _tr.count + ' soldiers: ' + (_trFrom ? _trFrom.name : '?') + ' → ' + (_trTo ? _trTo.name : '?') + ' (' + _daysLeft + 'd left)</div>';
            }
            html += '</div>';
        }

        try {
            var _kTowns = Engine.getTowns().filter(function(t) { return t.kingdomId === kingdom.id && !t.isOutpost && !t.isWilderness; });
            _kTowns.sort(function(a, b) { return (a.garrison || 0) - (b.garrison || 0); }); // weakest first
            for (var _gi = 0; _gi < _kTowns.length; _gi++) {
                var _gt = _kTowns[_gi];
                var _garr = _gt.garrison || 0;
                var _garrColor = _garr >= 20 ? '#55a868' : _garr >= 10 ? '#d4c9a0' : _garr >= 5 ? '#e67e22' : '#c44e52';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;margin-bottom:2px;background:rgba(0,0,0,0.1);border-radius:4px;">';
                html += '<span style="font-size:0.72rem;color:#d4c9a0;">' + (_gt.isCapital ? '⭐ ' : '') + escapeHtml(_gt.name || '?') + '</span>';
                html += '<div style="display:flex;align-items:center;gap:4px;">';
                html += '<span style="font-size:0.72rem;color:' + _garrColor + ';">' + _garr + ' soldiers</span>';
                if (_garr > 3) {
                    html += '<button class="btn-medieval" data-action="kingOpenTransfer" data-id="' + _gt.id + '" style="font-size:0.55rem;padding:1px 5px;" title="Transfer soldiers from this town">📤 Transfer</button>';
                }
                html += '</div></div>';
            }
        } catch(e) {}
        html += '</div>';

        // Active armies / dispatch
        var _armies = kingdom._armies || [];
        html += '<div style="background:rgba(196,78,82,0.08);padding:8px;border-radius:6px;border:1px solid rgba(196,78,82,0.2);margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#c44e52;margin-bottom:4px;">⚔️ Active Armies (' + _armies.length + ')</div>';
        if (_armies.length === 0) {
            html += '<div style="font-size:0.72rem;color:#888;">No armies currently deployed. Right-click an enemy town on the map to send an army during wartime.</div>';
        } else {
            for (var _ai = 0; _ai < _armies.length; _ai++) {
                var _army = _armies[_ai];
                var _statusIcon = _army._recoveryUntil ? '🛏️' : _army._retreating ? '🏳️' : _army._besieging ? '🏰' : _army._consolidating ? '📦' : _army.status === 'marching' ? '🚶' : _army.status === 'fighting' ? '⚔️' : _army.status === 'returning' ? '🔙' : '📍';
                var _statusText = _army._recoveryUntil ? 'Regrouping (resumes attack soon)' : _army._retreating ? 'Retreating home' : _army._besieging ? 'Besieging' : _army._consolidating ? 'Consolidating (' + (_army._consolidationDaysLeft || 0) + 'd)' : (_army.status || 'unknown');
                var _moraleColor = (_army.morale || 50) > 60 ? '#4caf50' : (_army.morale || 50) > 30 ? '#ff9800' : '#f44336';
                html += '<div style="background:rgba(0,0,0,0.2);padding:4px 6px;border-radius:4px;margin-bottom:3px;">';
                html += '<div style="font-size:0.72rem;color:#d4c9a0;">' + _statusIcon + ' ' + (_army.soldiers || 0) + ' soldiers → ' + (_army.targetName || 'Unknown') + '</div>';
                html += '<div style="font-size:0.62rem;color:#888;">Status: ' + _statusText + ' · Morale: <span style="color:' + _moraleColor + ';">' + Math.round(_army.morale || 50) + '%</span></div>';
                html += '</div>';
            }
        }
        html += '</div>';

        // Discharge soldiers
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">📉 Discharge Soldiers</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:4px;">Reduce army size to save on upkeep. Discharged soldiers return to civilian life.</div>';
        html += '<div style="display:flex;align-items:center;gap:6px;">';
        html += '<input type="number" id="_kingDischargeCount" min="1" max="' + Math.max(1, _soldiers) + '" value="5" style="width:60px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#d4c9a0;padding:2px 4px;font-size:0.72rem;text-align:center;">';
        html += '<button class="btn-medieval" data-action="kingDischargeSoldiers" style="font-size:0.72rem;padding:4px 12px;' + (_soldiers < 1 ? 'opacity:0.5;' : '') + '" ' + (_soldiers < 1 ? 'disabled' : '') + '>📉 Discharge</button>';
        html += '</div></div>';

        // ── Military Proposals (AI suggestions for player-king) ──
        var _milProps = kingdom._militaryProposals || [];
        if (_milProps.length > 0) {
            html += '<div style="background:rgba(212,168,67,0.08);padding:10px;border-radius:6px;border:1px solid rgba(212,168,67,0.2);margin-top:10px;">';
            html += '<div style="font-size:0.9rem;color:#d4a843;margin-bottom:6px;font-weight:bold;">📜 Military Proposals (' + _milProps.length + ')</div>';
            html += '<div style="font-size:0.7rem;color:#aaa;margin-bottom:8px;">Your military advisors recommend these actions. Approve or dismiss.</div>';

            for (var _mpi = 0; _mpi < _milProps.length; _mpi++) {
                var _mp = _milProps[_mpi];
                var _mpBg = _mp.type === 'attack' ? 'rgba(196,78,82,0.12)' : _mp.type === 'fortify' ? 'rgba(93,173,226,0.1)' : 'rgba(0,0,0,0.15)';
                var _mpBorder = _mp.type === 'attack' ? 'rgba(196,78,82,0.25)' : _mp.type === 'fortify' ? 'rgba(93,173,226,0.2)' : 'rgba(255,255,255,0.08)';
                html += '<div style="background:' + _mpBg + ';border:1px solid ' + _mpBorder + ';padding:8px;border-radius:5px;margin-bottom:6px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
                html += '<div style="flex:1;">';
                html += '<div style="font-size:0.8rem;color:#d4c9a0;font-weight:bold;margin-bottom:3px;">' + (_mp.icon || '📋') + ' ' + escapeHtml(_mp.title || '') + '</div>';
                html += '<div style="font-size:0.7rem;color:#aaa;">' + escapeHtml(_mp.desc || '') + '</div>';
                if (_mp.cost) html += '<div style="font-size:0.68rem;color:#e0c58a;margin-top:2px;">💰 Cost: ' + _mp.cost + 'g</div>';
                html += '</div>';
                html += '<div style="display:flex;flex-direction:column;gap:3px;margin-left:8px;">';
                html += '<button class="btn-medieval" data-action="kingApproveMilProposal" data-id="' + _mp.id + '" style="font-size:0.68rem;padding:3px 10px;background:rgba(85,168,104,0.3) !important;border:1px solid rgba(85,168,104,0.4) !important;color:#81c784;">✅ Approve</button>';
                html += '<button class="btn-medieval" data-action="kingDismissMilProposal" data-id="' + _mp.id + '" style="font-size:0.68rem;padding:3px 10px;opacity:0.7;">❌ Dismiss</button>';
                html += '</div></div></div>';
            }
            html += '</div>';
        } else if (kingdom.atWar && kingdom.atWar.size > 0) {
            html += '<div style="font-size:0.72rem;color:#888;margin-top:8px;padding:6px;background:rgba(0,0,0,0.1);border-radius:4px;">📜 No current military proposals. Your advisors will suggest actions as the war progresses.</div>';
        }

        return html;
    }

    // =========================================================================
    // Stockpile Tab — Kingdom goods stockpile + buy/sell
    // =========================================================================
    function _kingStockpileTab(kingdom, ks) {
        var html = '';

        var _kTowns = Engine.getTowns().filter(function(t) { return t.kingdomId === kingdom.id && !t.isOutpost && !t.isWilderness; });
        var _goodsStockpile = kingdom.goodsStockpile || {};
        var _milStockpile = kingdom.militaryStockpile || {};

        // Goods stockpile
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">📦 Kingdom Goods Stockpile</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">Goods purchased by the kingdom for strategic reserves. Buy and sell from the treasury.</div>';

        var _goodsKeys = Object.keys(_goodsStockpile).filter(function(k) { return _goodsStockpile[k] > 0; });
        if (_goodsKeys.length === 0) {
            html += '<div style="font-size:0.72rem;color:#888;margin-bottom:6px;">No goods in stockpile. Use procurement to build reserves.</div>';
        } else {
            html += '<div style="max-height:200px;overflow-y:auto;margin-bottom:6px;">';
            _goodsKeys.sort();
            for (var _gki = 0; _gki < _goodsKeys.length; _gki++) {
                var _gk = _goodsKeys[_gki];
                var _qty = Math.round(_goodsStockpile[_gk]);
                var _itemDef = CONFIG.ITEMS ? CONFIG.ITEMS[_gk] : null;
                var _itemName = _itemDef ? (_itemDef.name || _gk) : _gk;
                var _itemIcon = _itemDef && _itemDef.icon ? _itemDef.icon : '📦';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;margin-bottom:2px;background:rgba(0,0,0,0.1);border-radius:4px;">';
                html += '<span style="font-size:0.72rem;color:#d4c9a0;">' + _itemIcon + ' ' + _itemName + '</span>';
                html += '<div style="display:flex;align-items:center;gap:4px;">';
                html += '<span style="font-size:0.72rem;color:#e0c58a;">' + _qty + '</span>';
                html += '<button class="btn-medieval" data-action="kingSellStockpile" data-id="' + _gk + '" style="font-size:0.6rem;padding:1px 6px;">Sell</button>';
                html += '</div></div>';
            }
            html += '</div>';
        }
        html += '</div>';

        // Military stockpile (view-only duplicate from military tab for convenience)
        html += '<div style="background:rgba(196,78,82,0.08);padding:8px;border-radius:6px;border:1px solid rgba(196,78,82,0.15);margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#c44e52;margin-bottom:4px;">⚔️ Military Stockpile</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">';
        var _milItems = [
            { key: 'swords', icon: '⚔️', name: 'Swords' },
            { key: 'armor', icon: '🛡️', name: 'Armor' },
            { key: 'bows', icon: '🏹', name: 'Bows' },
            { key: 'arrows', icon: '🎯', name: 'Arrows' },
            { key: 'horses', icon: '🐴', name: 'Horses' }
        ];
        for (var _mi = 0; _mi < _milItems.length; _mi++) {
            var _mItem = _milItems[_mi];
            html += '<div style="background:rgba(0,0,0,0.2);padding:4px;border-radius:4px;text-align:center;font-size:0.68rem;">';
            html += '<span style="color:#aaa;">' + _mItem.icon + ' ' + _mItem.name + '</span><br>';
            html += '<span style="color:#d4c9a0;">' + (_milStockpile[_mItem.key] || 0) + '</span>';
            html += '</div>';
        }
        html += '</div></div>';

        // Procurement — create orders for military goods (fulfilled by procurers over time)
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">🔨 Order Military Equipment</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">Create procurement orders — kingdom procurers will buy from markets over time.</div>';
        var _milItems2 = [
            { key: 'swords', icon: '⚔️', name: 'Swords' },
            { key: 'armor', icon: '🛡️', name: 'Armor' },
            { key: 'bows', icon: '🏹', name: 'Bows' },
            { key: 'arrows', icon: '🎯', name: 'Arrows' },
            { key: 'horses', icon: '🐴', name: 'Horses' },
            { key: 'saddles', icon: '🐎', name: 'Saddles' },
            { key: 'shields', icon: '🛡️', name: 'Shields' }
        ];
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">';
        html += '<select id="_milOrdGood" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
        for (var _mo2 = 0; _mo2 < _milItems2.length; _mo2++) {
            var _mI2 = _milItems2[_mo2];
            html += '<option value="' + _mI2.key + '">' + _mI2.icon + ' ' + _mI2.name + '</option>';
        }
        html += '</select>';
        html += '<input type="number" id="_milOrdQty" min="1" max="500" value="10" style="font-size:0.65rem;width:55px;padding:2px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
        html += '<button class="btn-medieval" data-action="kingProcureMilitary" style="font-size:0.62rem;padding:2px 6px;">📋 Place Order</button>';
        html += '</div>';
        // Show active procurer count
        var _procCount = 0;
        try { var _empSum = Player.kingGetEmployeeSummary(); if (_empSum) _procCount = _empSum.procurers.length; } catch(e) {}
        if (_procCount === 0) {
            html += '<div style="font-size:0.65rem;color:#c44e52;">⚠️ No procurers hired! Orders won\'t be filled. Hire procurers in the Employees tab.</div>';
        } else {
            html += '<div style="font-size:0.65rem;color:#7a7;">✓ ' + _procCount + ' procurer' + (_procCount > 1 ? 's' : '') + ' active — orders will be filled over time.</div>';
        }
        html += '</div>';

        // Order goods for stockpile — creates procurement orders
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">📋 Order Goods for Stockpile</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">Create procurement orders — procurers travel the kingdom buying from local markets.</div>';
        try {
            // Build a list of all non-military goods from RESOURCE_TYPES
            var _goodsSet = {};
            var _excludeCats = { military: true, quest: true, contraband: true };
            if (typeof RESOURCE_TYPES !== 'undefined') {
                var _rtKeys = Object.keys(RESOURCE_TYPES);
                for (var _ik = 0; _ik < _rtKeys.length; _ik++) {
                    var _iDef = RESOURCE_TYPES[_rtKeys[_ik]];
                    if (_iDef && _iDef.id && _iDef.name && !_excludeCats[_iDef.category]) {
                        _goodsSet[_iDef.id] = { name: _iDef.name, icon: _iDef.icon || '📦' };
                    }
                }
            }
            var _sortedGoods = Object.keys(_goodsSet).sort(function(a, b) { return (_goodsSet[a].name || a).localeCompare(_goodsSet[b].name || b); });
            if (_sortedGoods.length > 0) {
                html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">';
                html += '<select id="_kBuyGood" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:200px;">';
                for (var _sg2 = 0; _sg2 < _sortedGoods.length; _sg2++) {
                    var _sgId = _sortedGoods[_sg2];
                    html += '<option value="' + _sgId + '">' + _goodsSet[_sgId].icon + ' ' + escapeHtml(_goodsSet[_sgId].name) + '</option>';
                }
                html += '</select>';
                html += '<input type="number" id="_kBuyQty" min="1" max="500" value="20" style="font-size:0.65rem;width:55px;padding:2px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
                html += '<button class="btn-medieval" data-action="kingBuyStockpile" style="font-size:0.72rem;padding:3px 8px;color:#e8dcc8 !important;">📋 PLACE ORDER</button>';
                html += '</div>';
            } else {
                html += '<div style="font-size:0.68rem;color:#888;">No goods known.</div>';
            }
        } catch(e) {
            html += '<div style="font-size:0.68rem;color:#888;">Unable to load goods data.</div>';
        }
        // Show active procurement orders
        try {
            // v9p33river319: was crashing when Player.state.kingState was
            // null (player not king). Guard the access; this panel only
            // makes sense when the player IS king of the rendered kingdom.
            var _kForOrders = kingdom; // v9p33river329: show orders for the rendered kingdom, not a separate Player.state lookup.
            var _orders = (_kForOrders && _kForOrders._procurementOrders) ? _kForOrders._procurementOrders.filter(function(o) { return o.remaining > 0; }) : [];
            if (_orders.length > 0) {
                html += '<div style="margin-top:6px;border-top:1px solid #444;padding-top:4px;">';
                html += '<div style="font-size:0.72rem;color:#d4c9a0;margin-bottom:3px;">📦 Active Orders (' + _orders.length + '):</div>';
                for (var _oi = 0; _oi < _orders.length; _oi++) {
                    var _ord = _orders[_oi];
                    var _oItemDef = (typeof CONFIG !== 'undefined' && CONFIG.ITEMS) ? CONFIG.ITEMS[_ord.goodId] : null;
                    var _oName = _oItemDef ? (_oItemDef.name || _ord.goodId) : _ord.goodId;
                    var _oIcon = _oItemDef && _oItemDef.icon ? _oItemDef.icon : '📦';
                    var _oFilled = _ord.filled || 0;
                    var _oTotal = _oFilled + _ord.remaining;
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px;background:rgba(0,0,0,0.1);border-radius:3px;margin-bottom:2px;">';
                    html += '<span style="font-size:0.65rem;color:#d4c9a0;">' + _oIcon + ' ' + escapeHtml(_oName) + '</span>';
                    html += '<span style="font-size:0.65rem;color:#aaa;">' + _oFilled + '/' + _oTotal + ' (max ' + _ord.maxPrice + 'g ea)</span>';
                    html += '<button class="btn-medieval" data-action="kingCancelProcOrder" data-id="' + _ord.id + '" style="font-size:0.55rem;padding:1px 4px;background:rgba(196,78,82,0.3);">✕</button>';
                    html += '</div>';
                }
                html += '</div>';
            }
        } catch(e) {}
        html += '</div>';

        // Commission goods for production
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-top:8px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">📋 Commission Goods Production</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">Pay artisans in advance. Orders are filled over time by kingdom producers.</div>';
        // Build dynamic goods list from CONFIG.ITEMS (producible goods)
        var _commGoods = [];
        try {
            if (typeof CONFIG !== 'undefined' && CONFIG.ITEMS) {
                var _itemKeys = Object.keys(CONFIG.ITEMS);
                for (var _iki = 0; _iki < _itemKeys.length; _iki++) {
                    var _item = CONFIG.ITEMS[_itemKeys[_iki]];
                    if (_item && (_item.category === 'military' || _item.category === 'tools' || _item.category === 'food' ||
                        _item.category === 'clothing' || _item.category === 'luxury' || _item.category === 'crafted' ||
                        _item.category === 'raw_materials' || _item.category === 'materials' || _item.category === 'trade' ||
                        _item.producedBy || _item.craftable)) {
                        _commGoods.push(_itemKeys[_iki]);
                    }
                }
                _commGoods.sort();
            }
        } catch(e) {}
        // v9p33river308: removed 'ships' from fallback — not a market
        // resource, so a 'ships' commission could never be filled by
        // market supply and would silently sit forever.
        if (_commGoods.length === 0) _commGoods = ['swords', 'armor', 'bows', 'arrows', 'bread', 'cloth', 'tools', 'horses', 'wine', 'ale', 'spices', 'silk', 'iron', 'wood', 'stone', 'planks', 'bricks'];
        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">';
        html += '<select id="_roCommGood" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:140px;">';
        for (var _cgi = 0; _cgi < _commGoods.length; _cgi++) {
            var _cgDef = (typeof CONFIG !== 'undefined' && CONFIG.ITEMS) ? CONFIG.ITEMS[_commGoods[_cgi]] : null;
            var _cgName = _cgDef ? (_cgDef.name || _commGoods[_cgi]) : _commGoods[_cgi];
            html += '<option value="' + _commGoods[_cgi] + '">' + _cgName + '</option>';
        }
        html += '</select>';
        html += '<input type="number" id="_roCommQty" min="5" max="500" value="10" style="font-size:0.65rem;width:55px;padding:2px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
        html += '<button class="btn-medieval" data-action="kingCommissionGoods" style="font-size:0.62rem;padding:2px 6px;">📋 Commission</button>';
        html += '</div>';
        var _commissions = kingdom._commissions || [];
        if (_commissions.length > 0) {
            html += '<div style="font-size:0.62rem;color:#aaa;margin-top:3px;">';
            for (var _cci = 0; _cci < _commissions.length; _cci++) {
                var _cc = _commissions[_cci];
                var _ccLeft = Math.max(0, (_cc.qty || 0) - (_cc.filled || 0));
                html += '<div>' + _cc.good + ': ' + (_cc.filled || 0) + '/' + _cc.qty + ' filled' + (_ccLeft > 0 ? ' (' + _ccLeft + ' remaining)' : ' ✅') + '</div>';
            }
            html += '</div>';
        }
        html += '</div>';

        // Send goods to town market
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">📦 Send Stockpile to Town Market</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:6px;">Send goods from the kingdom stockpile to a specific town market.</div>';
        var _stockpileItems = [];
        if (kingdom.goodsStockpile) {
            for (var _sk in kingdom.goodsStockpile) {
                if (kingdom.goodsStockpile[_sk] > 0) _stockpileItems.push(_sk);
            }
        }
        if (kingdom.militaryStockpile) {
            for (var _mk2 in kingdom.militaryStockpile) {
                if (kingdom.militaryStockpile[_mk2] > 0 && _stockpileItems.indexOf(_mk2) < 0) _stockpileItems.push(_mk2);
            }
        }
        if (_stockpileItems.length > 0) {
            html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">';
            html += '<select id="_roSendGood" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:100px;">';
            for (var _sgi2 = 0; _sgi2 < _stockpileItems.length; _sgi2++) {
                var _sgItem = _stockpileItems[_sgi2];
                var _sgQty = (kingdom.goodsStockpile && kingdom.goodsStockpile[_sgItem]) || (kingdom.militaryStockpile && kingdom.militaryStockpile[_sgItem]) || 0;
                html += '<option value="' + _sgItem + '">' + _sgItem + ' (' + _sgQty + ')</option>';
            }
            html += '</select>';
            html += '<select id="_roSendTown" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:120px;">';
            for (var _sti3 = 0; _sti3 < _kTowns.length; _sti3++) html += '<option value="' + _kTowns[_sti3].id + '">' + escapeHtml(_kTowns[_sti3].name) + '</option>';
            html += '</select>';
            html += '<input type="number" id="_roSendQty" min="1" max="500" value="5" style="font-size:0.65rem;width:50px;padding:2px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
            html += '<button class="btn-medieval" data-action="kingSendStockpile" style="font-size:0.62rem;padding:2px 6px;">📦 Send</button>';
            html += '</div>';
        } else {
            html += '<div style="font-size:0.68rem;color:#888;">No goods in stockpile to send.</div>';
        }
        html += '</div>';

        return html;
    }

    // =========================================================================
    // Kingdom Towns Tab — Detailed per-town view with stats and actions
    // =========================================================================
    function _kingKingdomTab(kingdom, ks) {
        var html = '';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">🏘️ Kingdom Towns — Detailed View</div>';
        html += '<div style="font-size:0.68rem;color:#888;margin-bottom:8px;">Town-level data for informed decisions. Use action buttons for direct management.</div>';
        try {
            var _kTowns = Engine.getTowns().filter(function(t) { return t.kingdomId === kingdom.id && !t.isOutpost && !t.isWilderness; });
            _kTowns.sort(function(a, b) { return (b.isCapital ? 1 : 0) - (a.isCapital ? 1 : 0) || (b.prosperity || 50) - (a.prosperity || 50); });

            // Kingdom summary bar
            var _totalPop = 0, _totalGarrison = 0, _totalBuildings = 0, _plagueCount = 0;
            for (var _si = 0; _si < _kTowns.length; _si++) {
                var _sPeople = [];
                try { _sPeople = Engine.getPeople(_kTowns[_si].id) || []; } catch(e) {}
                _totalPop += _sPeople.length;
                _totalGarrison += (_kTowns[_si].garrison || 0);
                _totalBuildings += (_kTowns[_si].buildings || []).length;
                if (_kTowns[_si].plagueActive) _plagueCount++;
            }
            html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;margin-bottom:8px;">';
            html += '<div style="background:rgba(0,0,0,0.2);padding:4px;border-radius:4px;text-align:center;font-size:0.68rem;"><span style="color:#aaa;">Towns</span><br><span style="color:#5dade2;">' + _kTowns.length + '</span></div>';
            html += '<div style="background:rgba(0,0,0,0.2);padding:4px;border-radius:4px;text-align:center;font-size:0.68rem;"><span style="color:#aaa;">Pop</span><br><span style="color:#d4c9a0;">' + _totalPop + '</span></div>';
            html += '<div style="background:rgba(0,0,0,0.2);padding:4px;border-radius:4px;text-align:center;font-size:0.68rem;"><span style="color:#aaa;">Garrison</span><br><span style="color:#5dade2;">' + _totalGarrison + '</span></div>';
            html += '<div style="background:rgba(0,0,0,0.2);padding:4px;border-radius:4px;text-align:center;font-size:0.68rem;"><span style="color:#aaa;">Plague</span><br><span style="color:' + (_plagueCount > 0 ? '#c44e52' : '#55a868') + ';">' + (_plagueCount > 0 ? _plagueCount + ' towns' : 'None') + '</span></div>';
            html += '</div>';

            html += '<div style="max-height:400px;overflow-y:auto;">';
            for (var _ki = 0; _ki < _kTowns.length; _ki++) {
                var _kt = _kTowns[_ki];
                var _townPeople = [];
                try { _townPeople = Engine.getPeople(_kt.id) || []; } catch(e) {}
                var _pop = _townPeople.length;
                var _sickCount = 0;
                for (var _sci = 0; _sci < _townPeople.length; _sci++) {
                    if (_townPeople[_sci].sick) _sickCount++;
                }
                var _hap = Math.round(_kt.happiness || 50);
                var _pros = Math.round(_kt.prosperity || 50);
                var _hapColor = _hap > 60 ? '#55a868' : _hap > 35 ? '#e67e22' : '#c44e52';
                var _prosColor = _pros > 60 ? '#55a868' : _pros > 35 ? '#e67e22' : '#c44e52';
                var _garr = _kt.garrison || 0;

                // Problems detection
                var _problems = [];
                if (_kt.plagueActive) _problems.push('🦠 Plague');
                if (_sickCount > 0) _problems.push('🤒 ' + _sickCount + ' Sick');
                if (_kt.foodShortage) _problems.push('🍞 Food Shortage');
                if (_hap < 30) _problems.push('😡 Very Unhappy');
                if (_garr < 5) _problems.push('🛡️ Weak Garrison');
                if (_kt.banditThreat && _kt.banditThreat > 50) _problems.push('🏴‍☠️ Bandits');
                if (_kt.quarantineLevel && _kt.quarantineLevel > 0) _problems.push('🏥 Quarantine Lv' + _kt.quarantineLevel);

                html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:5px;border-left:3px solid ' + (_kt.isCapital ? '#d4a843' : _problems.length > 0 ? '#c44e52' : 'rgba(255,255,255,0.1)') + ';">';

                // Header row
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
                html += '<span style="font-size:0.82rem;color:#d4c9a0;font-weight:bold;">' + (_kt.isCapital ? '⭐ ' : '') + (_kt.name || 'Unknown') + '</span>';
                html += '<span style="font-size:0.65rem;color:#888;text-transform:uppercase;">' + (_kt.category || 'village') + '</span>';
                html += '</div>';

                // Stats grid
                html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:3px;margin-bottom:4px;">';
                html += '<div style="font-size:0.65rem;text-align:center;"><span style="color:#aaa;">Pop</span><br><span style="color:#d4c9a0;">' + _pop + '</span></div>';
                html += '<div style="font-size:0.65rem;text-align:center;"><span style="color:#aaa;">Happy</span><br><span style="color:' + _hapColor + ';">' + _hap + '%</span></div>';
                html += '<div style="font-size:0.65rem;text-align:center;"><span style="color:#aaa;">Prosp</span><br><span style="color:' + _prosColor + ';">' + _pros + '%</span></div>';
                html += '<div style="font-size:0.65rem;text-align:center;"><span style="color:#aaa;">Garrison</span><br><span style="color:#5dade2;">' + _garr + '</span></div>';
                html += '<div style="font-size:0.65rem;text-align:center;"><span style="color:#aaa;">Sick</span><br><span style="color:' + (_sickCount > 0 ? '#c44e52' : '#55a868') + ';">' + (_sickCount > 0 ? _sickCount : '0') + '</span></div>';
                html += '</div>';

                // Buildings summary
                var _bldgs = _kt.buildings || [];
                if (_bldgs.length > 0) {
                    var _bCats = {};
                    for (var _bi = 0; _bi < _bldgs.length; _bi++) {
                        var _bCat = _bldgs[_bi].category || 'other';
                        _bCats[_bCat] = (_bCats[_bCat] || 0) + 1;
                    }
                    var _bSummary = [];
                    for (var _bc in _bCats) _bSummary.push(_bc + ': ' + _bCats[_bc]);
                    html += '<div style="font-size:0.62rem;color:#888;">🏗️ ' + _bldgs.length + ' buildings (' + _bSummary.join(', ') + ')</div>';
                }

                // Problems
                if (_problems.length > 0) {
                    html += '<div style="font-size:0.65rem;color:#c44e52;margin-top:3px;">⚠️ ' + _problems.join(' | ') + '</div>';
                }

                // Action buttons
                html += '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">';
                html += '<button class="btn-medieval" data-action="kingReinforceTown" data-id="' + _kt.id + '" style="font-size:0.6rem;padding:2px 6px;">🛡️ Reinforce</button>';
                if (_kt.plagueActive) {
                    html += '<button class="btn-medieval" data-action="kingSendMedical" data-id="' + _kt.id + '" style="font-size:0.6rem;padding:2px 6px;">🏥 Send Aid</button>';
                }
                if (_kt.foodShortage) {
                    html += '<button class="btn-medieval" data-action="kingSendFood" data-id="' + _kt.id + '" style="font-size:0.6rem;padding:2px 6px;">🍞 Send Food</button>';
                }
                if (_hap < 40) {
                    html += '<button class="btn-medieval" data-action="kingHostLocalFeast" data-id="' + _kt.id + '" style="font-size:0.6rem;padding:2px 6px;">🎉 Local Feast</button>';
                }
                html += '<button class="btn-medieval" data-action="kingQuarantineTown" data-id="' + _kt.id + '" data-val="' + (_kt.quarantineLevel || 0) + '" style="font-size:0.6rem;padding:2px 6px;">' + (_kt.quarantineLevel ? '🔓 Lift' : '🔒 Quarantine') + '</button>';
                html += '</div>';
                html += '</div>';
            }
            html += '</div>';
        } catch(e) {
            html += '<div style="color:#888;">Unable to load town data.</div>';
        }
        return html;
    }

    function _kingCourtTab(kingdom, ks) {
        var html = '';

        // ── Noble Audiences ──
        html += _kingAudiencesSection(ks);

        // ── Pending Petitions ──
        html += _kingPetitionsSection(kingdom);

        // ── Royal Gifts & Private Audiences ──
        html += _kingNobleManagementSection(kingdom, ks);

        // ── Active Missions ──
        html += _kingMissionsSection(ks);

        // ── Intrigue Warnings ──
        html += _kingIntrigueSection(ks);

        // ── Royal Advisor Suggestions ──
        html += _kingAdvisorSection(kingdom, ks);

        // Nobles list
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;margin-top:10px;">🏰 Nobles of ' + kingdom.name + '</div>';
        html += '<div style="max-height:200px;overflow-y:auto;">';
        try {
            var _nobles = [];
            var w = Engine.getWorld();
            if (w && w.people) {
                for (var _ni = 0; _ni < w.people.length; _ni++) {
                    var _np = w.people[_ni];
                    if (!_np.alive || _np.kingdomId !== kingdom.id) continue;
                    var _nRank = (_np.socialRank && _np.socialRank[kingdom.id]) || 0;
                    if (_nRank >= 3) _nobles.push(_np);
                }
            }
            _nobles.sort(function(a, b) {
                return ((b.socialRank && b.socialRank[kingdom.id]) || 0) - ((a.socialRank && a.socialRank[kingdom.id]) || 0);
            });
            for (var _nj = 0; _nj < _nobles.length; _nj++) {
                var _n = _nobles[_nj];
                var _nRank2 = (_n.socialRank && _n.socialRank[kingdom.id]) || 0;
                var rankName = _nRank2 >= 6 ? 'Royal Advisor' : _nRank2 >= 5 ? 'Lord' : _nRank2 >= 4 ? 'Minor Noble' : 'Burgher';
                var _pRel = Player.state && Player.state.relationships && Player.state.relationships[_n.id];
                var _relLevel = _pRel ? Math.round(_pRel.level) : 0;
                var _relColor = _relLevel > 60 ? '#55a868' : _relLevel > 30 ? '#d4c9a0' : '#c44e52';
                var _hasLoan = false, _hasBM = false;
                if (Player.state && Player.state._nobleLoans) {
                    for (var _lci = 0; _lci < Player.state._nobleLoans.length; _lci++) {
                        if (Player.state._nobleLoans[_lci].nobleId === _n.id && Player.state._nobleLoans[_lci].status === 'active') { _hasLoan = true; break; }
                    }
                }
                if (Player.state && Player.state.blackmailTargets && Player.state.blackmailTargets[_n.id]) _hasBM = true;

                html += '<div style="background:rgba(0,0,0,0.1);padding:4px 6px;border-radius:4px;margin-bottom:2px;display:flex;justify-content:space-between;align-items:center;">';
                html += '<div>';
                html += '<span style="font-size:0.75rem;color:#d4c9a0;">' + escapeHtml((_n.firstName || '') + ' ' + (_n.lastName || '')) + '</span>';
                html += '<span style="font-size:0.65rem;color:#888;margin-left:6px;">' + rankName + '</span>';
                if (_hasLoan) html += ' <span title="Owes you a loan" style="font-size:0.65rem;">💰</span>';
                if (_hasBM) html += ' <span title="You have blackmail on them" style="font-size:0.65rem;">🔒</span>';
                html += '</div>';
                var _pLoy = _loyaltyLabel(_n.perceivedKingLoyalty != null ? _n.perceivedKingLoyalty : (_n.kingLoyalty || 50));
                html += '<div style="font-size:0.7rem;">';
                html += '<span style="color:' + _pLoy.color + ';" title="Loyalty to crown">' + _pLoy.icon + ' ' + _pLoy.text + '</span>';
                html += '<span style="color:' + _relColor + ';margin-left:6px;">' + _relLevel + ' ❤️</span>';
                html += '</div>';
                html += '</div>';
            }
            if (_nobles.length === 0) html += '<div style="color:#888;font-size:0.75rem;">No nobles found in this kingdom.</div>';
        } catch(e) { html += '<div style="color:#888;">Error loading court data.</div>'; }
        html += '</div>';

        return html;
    }

    // ── King Petitions Section ──
    function _kingPetitionsSection(kingdom) {
        var html = '';
        var allPetitions = kingdom._pendingPetitions || [];
        // Filter out peace/surrender offers — shown in War Management instead
        var petitions = allPetitions.filter(function(p) { return p.type !== 'peace_offer' && p.type !== 'surrender_offer'; });
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">📜 Petitions from Subjects' + (petitions.length > 0 ? ' <span style="background:#c44e52;color:#fff;font-size:0.6rem;padding:1px 5px;border-radius:8px;margin-left:4px;">' + petitions.length + '</span>' : '') + '</div>';

        if (petitions.length === 0) {
            html += '<div style="font-size:0.72rem;color:#888;">No pending petitions. Your subjects are content... for now.</div>';
        } else {
            html += '<div style="max-height:250px;overflow-y:auto;">';
            for (var _pi = 0; _pi < petitions.length; _pi++) {
                var _pet = petitions[_pi];
                var _pType = (typeof PETITION_TYPES !== 'undefined') ? PETITION_TYPES.find(function(t) { return t.id === _pet.typeId; }) : null;
                var _urgColor = _pet.urgency === 'high' ? '#c44e52' : _pet.urgency === 'critical' ? '#ff4444' : '#5dade2';
                var _urgLabel = _pet.urgency === 'high' ? '🔶 Urgent' : _pet.urgency === 'critical' ? '⚠️ Critical' : '🔵 Normal';
                var _rankBadge = _pet.petitionerRank >= 6 ? '👑 RA' : _pet.petitionerRank >= 5 ? '🏰 Lord' : _pet.petitionerRank >= 4 ? '🎖️ Noble' : _pet.petitionerRank >= 3 ? '🏅 Burgher' : '👤 Citizen';
                var _cost = 0;
                try { _cost = Player.kingGetOrderCost(_pet.typeId, _pet); } catch(e) {}

                html += '<div style="background:rgba(0,0,0,0.12);border:1px solid rgba(255,255,255,0.08);border-left:3px solid ' + _urgColor + ';padding:6px 8px;border-radius:4px;margin-bottom:4px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
                html += '<div style="flex:1;">';
                html += '<div style="font-size:0.78rem;color:#ddd;">' + (_pType ? _pType.icon : '📜') + ' ' + escapeHtml(_pet.title) + '</div>';
                html += '<div style="font-size:0.65rem;color:#999;margin-top:2px;">' + escapeHtml(_pet.desc) + '</div>';
                html += '<div style="font-size:0.62rem;color:#888;margin-top:3px;">';
                html += '<span style="color:' + _urgColor + ';">' + _urgLabel + '</span>';
                html += ' · From: <span style="color:#d4c9a0;">' + escapeHtml(_pet.petitionerName) + '</span> (' + _rankBadge + ')';
                if (_cost > 0) html += ' · Cost: <span style="color:#e0c58a;">' + formatGold(_cost) + '</span>';
                html += '</div>';
                html += '</div>';
                html += '<div style="display:flex;gap:4px;flex-shrink:0;margin-left:6px;">';
                html += '<button class="btn-medieval" data-action="kingApprovePetition" data-id="' + _pet.id + '" style="font-size:0.62rem;padding:3px 6px;background:rgba(85,168,104,0.3) !important;border-color:rgba(85,168,104,0.5) !important;" title="Approve">✅</button>';
                html += '<button class="btn-medieval" data-action="kingRejectPetition" data-id="' + _pet.id + '" style="font-size:0.62rem;padding:3px 6px;background:rgba(196,78,82,0.3) !important;border-color:rgba(196,78,82,0.5) !important;" title="Reject">❌</button>';
                html += '</div></div></div>';
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    // ── Noble Audiences Section ──
    function _kingAudiencesSection(ks) {
        var html = '';
        var audiences = (ks._nobleAudiences || []);
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">👑 Noble Audiences' + (audiences.length > 0 ? ' <span style="background:#9b59b6;color:#fff;font-size:0.6rem;padding:1px 5px;border-radius:8px;margin-left:4px;">' + audiences.length + '</span>' : '') + '</div>';
        html += '<div style="font-size:0.65rem;color:#888;margin-bottom:4px;">Nobles petition you for personal favors. Granting builds loyalty; denying harms it.</div>';

        if (audiences.length === 0) {
            html += '<div style="font-size:0.72rem;color:#888;">No pending audiences. Nobles will petition you soon.</div>';
        } else {
            html += '<div style="max-height:250px;overflow-y:auto;">';
            for (var ai = 0; ai < audiences.length; ai++) {
                var aud = audiences[ai];
                var rankBadge = aud.nobleRank >= 6 ? '👑 RA' : aud.nobleRank >= 5 ? '🏰 Lord' : '🎖️ Noble';
                var daysOld = Engine.getDay() - aud.generatedDay;
                var urgColor = daysOld > 20 ? '#c44e52' : daysOld > 10 ? '#e0c58a' : '#5dade2';

                html += '<div style="background:rgba(0,0,0,0.12);border:1px solid rgba(255,255,255,0.08);border-left:3px solid ' + urgColor + ';padding:6px 8px;border-radius:4px;margin-bottom:4px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
                html += '<div style="flex:1;">';
                html += '<div style="font-size:0.78rem;color:#ddd;">' + aud.requestIcon + ' ' + escapeHtml(aud.requestLabel) + '</div>';
                html += '<div style="font-size:0.65rem;color:#999;margin-top:2px;">' + escapeHtml(aud.description) + '</div>';
                html += '<div style="font-size:0.62rem;color:#888;margin-top:3px;">';
                html += 'From: <span style="color:#d4c9a0;">' + escapeHtml(aud.nobleName) + '</span> (' + rankBadge + ')';
                if (aud.cost > 0) html += ' · Cost: <span style="color:#e0c58a;">' + formatGold(aud.cost) + '</span>';
                html += ' · <span style="color:#55a868;">+' + aud.loyaltyGain + ' loyalty</span>';
                // Wave effect warning for high-jealousy requests
                var _waveWarn = '';
                if (aud.requestType === 'title_elevation') _waveWarn = '⚡ High jealousy if granted';
                else if (aud.requestType === 'land_grant') _waveWarn = '⚡ May cause jealousy';
                else if (aud.requestType === 'trade_privilege') _waveWarn = '⚡ Slight jealousy';
                if (_waveWarn) html += ' · <span style="font-size:0.58rem;color:#e0a050;" title="Other nobles may react">' + _waveWarn + '</span>';
                html += ' · <span style="font-size:0.6rem;color:' + urgColor + ';">' + (30 - daysOld) + 'd left</span>';
                html += '</div></div>';
                html += '<div style="display:flex;gap:4px;flex-shrink:0;margin-left:6px;">';
                html += '<button class="btn-medieval" data-action="kingGrantAudience" data-idx="' + ai + '" style="font-size:0.62rem;padding:3px 6px;background:rgba(85,168,104,0.3) !important;border-color:rgba(85,168,104,0.5) !important;" title="Grant">✅ Grant</button>';
                html += '<button class="btn-medieval" data-action="kingDenyAudience" data-idx="' + ai + '" style="font-size:0.62rem;padding:3px 6px;background:rgba(196,78,82,0.3) !important;border-color:rgba(196,78,82,0.5) !important;" title="Deny">❌ Deny</button>';
                html += '</div></div></div>';
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    // ── Noble Management: Royal Gifts, Private Audiences ──
    function _kingNobleManagementSection(kingdom, ks) {
        var html = '';
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">🎁 Royal Gifts & Audiences</div>';
        html += '<div style="font-size:0.65rem;color:#888;margin-bottom:6px;">Select a noble to bestow gifts or hold a private audience. Builds loyalty and relationships.</div>';

        // Noble selector
        try {
            var _nobles = [];
            var w = Engine.getWorld();
            if (w && w.towns) {
                for (var ti = 0; ti < w.towns.length; ti++) {
                    var t = w.towns[ti];
                    if (t.kingdomId !== kingdom.id) continue;
                    var people = Engine.getPeople(t.id);
                    if (!people) continue;
                    for (var pi = 0; pi < people.length; pi++) {
                        var p = people[pi];
                        if (!p.alive) continue;
                        var rank = (p.socialRank && p.socialRank[kingdom.id]) || 0;
                        if (rank >= 4 && rank < 7) _nobles.push(p);
                    }
                }
            }
            _nobles.sort(function(a, b) {
                return ((b.socialRank && b.socialRank[kingdom.id]) || 0) - ((a.socialRank && a.socialRank[kingdom.id]) || 0);
            });

            if (_nobles.length === 0) {
                html += '<div style="color:#888;font-size:0.72rem;">No nobles in your kingdom.</div>';
            } else {
                html += '<div style="max-height:350px;overflow-y:auto;">';
                for (var ni = 0; ni < _nobles.length; ni++) {
                    var n = _nobles[ni];
                    var nName = escapeHtml(((n.firstName || '') + ' ' + (n.lastName || '')).trim());
                    var nRank = (n.socialRank && n.socialRank[kingdom.id]) || 4;
                    var rankLabel = nRank >= 6 ? '👑 RA' : nRank >= 5 ? '🏰 Lord' : '🎖️ Noble';
                    var _nLoy = _loyaltyLabel(n.perceivedKingLoyalty != null ? n.perceivedKingLoyalty : (n.kingLoyalty || 50));
                    var pRel = Player.state && Player.state.relationships && Player.state.relationships[n.id];
                    var relLvl = pRel ? Math.round(pRel.level) : 0;

                    // Check private audience cooldown
                    var audCD = (ks._privatAudienceCooldowns && ks._privatAudienceCooldowns[n.id]) || 0;
                    var audReady = Engine.getDay() - audCD >= 7;

                    // Check if on mission
                    var onMission = false;
                    var missions = ks._activeMissions || [];
                    for (var mi = 0; mi < missions.length; mi++) {
                        if (missions[mi].nobleId === n.id) { onMission = true; break; }
                    }

                    html += '<div style="background:rgba(0,0,0,0.12);border:1px solid rgba(255,255,255,0.06);padding:6px 8px;border-radius:4px;margin-bottom:3px;">';
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
                    html += '<div>';
                    html += '<span style="font-size:0.75rem;color:#d4c9a0;">' + nName + '</span>';
                    html += '<span style="font-size:0.62rem;color:#888;margin-left:4px;">' + rankLabel + '</span>';
                    if (onMission) html += '<span style="font-size:0.6rem;color:#5dade2;margin-left:4px;">📍 On Mission</span>';
                    html += '</div>';
                    html += '<div style="font-size:0.65rem;">';
                    html += '<span style="color:' + _nLoy.color + ';">' + _nLoy.icon + ' ' + _nLoy.text + '</span>';
                    html += '<span style="color:#888;margin-left:6px;">❤️ ' + relLvl + '</span>';
                    html += '</div></div>';

                    // Action buttons
                    html += '<div style="display:flex;gap:4px;flex-wrap:wrap;">';
                    html += '<button class="btn-medieval" data-action="kingPrivateAudience" data-id="' + n.id + '" style="font-size:0.6rem;padding:2px 6px;' + (!audReady || onMission ? 'opacity:0.5;' : '') + '" ' + (!audReady || onMission ? 'disabled' : '') + '>🤝 Audience' + (!audReady ? ' (' + (7 - (Engine.getDay() - audCD)) + 'd)' : '') + '</button>';
                    html += '<button class="btn-medieval" data-action="kingBestowGiftUI" data-id="' + n.id + '" data-name="' + nName + '" style="font-size:0.6rem;padding:2px 6px;">🎁 Bestow Gift</button>';
                    if (!onMission && (n.perceivedKingLoyalty != null ? n.perceivedKingLoyalty : (n.kingLoyalty || 50)) >= 40) {
                        html += '<button class="btn-medieval" data-action="kingSendMissionUI" data-id="' + n.id + '" data-name="' + nName + '" style="font-size:0.6rem;padding:2px 6px;">📜 Send Mission</button>';
                    }
                    html += '<button class="btn-medieval" data-action="kingInvestigateNoble" data-id="' + n.id + '" data-name="' + nName + '" style="font-size:0.68rem;padding:4px 10px;background:rgba(93,173,226,0.35);border:1px solid rgba(93,173,226,0.6);color:#8dd3f5;">🔍 Investigate</button>';
                    html += '<button class="btn-medieval" data-action="kingPunishNobleUI" data-id="' + n.id + '" data-name="' + nName + '" style="font-size:0.68rem;padding:4px 10px;background:rgba(196,78,82,0.35);border:1px solid rgba(196,78,82,0.6);color:#f5a0a0;">⚖️ Punish</button>';
                    html += '<button class="btn-medieval" data-action="kingPardonNoble" data-id="' + n.id + '" style="font-size:0.68rem;padding:4px 10px;background:rgba(85,168,104,0.35);border:1px solid rgba(85,168,104,0.6);color:#a0f5a0;">🕊️ Pardon</button>';
                    html += '</div></div>';
                }
                html += '</div>';
            }
        } catch(e) { html += '<div style="color:#888;font-size:0.72rem;">Error loading nobles.</div>'; }
        html += '</div>';
        return html;
    }

    // ── Active Missions Section ──
    function _kingMissionsSection(ks) {
        var html = '';
        var missions = ks._activeMissions || [];
        if (missions.length === 0) return '';

        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">📜 Active Missions <span style="background:#5dade2;color:#fff;font-size:0.6rem;padding:1px 5px;border-radius:8px;margin-left:4px;">' + missions.length + '</span></div>';
        for (var mi = 0; mi < missions.length; mi++) {
            var m = missions[mi];
            var daysLeft = m.endDay - Engine.getDay();
            var progress = Math.round(((Engine.getDay() - m.startDay) / (m.endDay - m.startDay)) * 100);
            html += '<div style="background:rgba(0,0,0,0.12);border-left:3px solid #5dade2;padding:5px 8px;border-radius:4px;margin-bottom:3px;">';
            html += '<div style="font-size:0.75rem;color:#ddd;">' + (m.missionIcon || '📜') + ' ' + escapeHtml(m.missionLabel) + '</div>';
            html += '<div style="font-size:0.65rem;color:#999;">Assigned: ' + escapeHtml(m.nobleName) + (m.targetKingdomName ? ' → ' + escapeHtml(m.targetKingdomName) : '') + '</div>';
            html += '<div style="background:rgba(255,255,255,0.1);border-radius:3px;height:6px;margin-top:3px;overflow:hidden;"><div style="background:#5dade2;height:100%;width:' + progress + '%;border-radius:3px;"></div></div>';
            html += '<div style="font-size:0.6rem;color:#888;margin-top:2px;">' + daysLeft + ' days remaining (' + progress + '%)</div>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    // ── Intrigue Warnings Section ──
    function _kingIntrigueSection(ks) {
        var html = '';
        var warnings = (ks._intrigueWarnings || []).filter(function(w) {
            return Engine.getDay() - w.day < 60;
        });
        if (warnings.length === 0) return '';

        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#c44e52;margin-bottom:6px;">🕵️ Court Intelligence <span style="background:#c44e52;color:#fff;font-size:0.6rem;padding:1px 5px;border-radius:8px;margin-left:4px;">' + warnings.length + '</span></div>';
        html += '<div style="max-height:200px;overflow-y:auto;">';
        // Show newest first
        for (var wi = warnings.length - 1; wi >= 0; wi--) {
            var w = warnings[wi];
            var daysAgo = Engine.getDay() - w.day;
            var plotIcon = w.plotType === 'conspiracy' ? '🗡️' : w.plotType === 'embezzlement' ? '💰' : w.plotType === 'foreign_contact' ? '🌍' : w.plotType === 'foreign_intel' ? '🔍' : '📢';
            html += '<div style="background:rgba(196,78,82,0.1);border-left:3px solid #c44e52;padding:5px 8px;border-radius:4px;margin-bottom:3px;">';
            html += '<div style="font-size:0.72rem;color:#ddd;">' + plotIcon + ' ' + escapeHtml(w.message) + '</div>';
            html += '<div style="font-size:0.6rem;color:#888;margin-top:2px;">' + daysAgo + ' days ago — Reported by ' + escapeHtml(w.reporterName || 'Unknown') + '</div>';
            html += '</div>';
        }
        html += '</div></div>';
        return html;
    }

    // ── Diplomacy Section (for Decisions tab) ──
    function _kingDiplomacySection(kingdom, ks) {
        var html = '';
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">🤝 Diplomacy & Agreements</div>';
        html += '<div style="font-size:0.65rem;color:#888;margin-bottom:6px;">Propose diplomatic agreements with other kingdoms. Different pacts have different relation thresholds and costs.</div>';

        // Show active agreements of ALL types
        var tradeAgr = (ks._tradeAgreements || []).filter(function(ta) { return Engine.getDay() < ta.endDay; });
        var activeTreaties = (kingdom._activeTreaties || []).filter(function(t) { return Engine.getDay() < t.endDay; });
        var activeNAPs = [];
        if (kingdom.peaceTreaties) {
            for (var napK in kingdom.peaceTreaties) {
                if (Engine.getDay() < kingdom.peaceTreaties[napK]) {
                    var napTarget = null;
                    try { napTarget = Engine.findKingdom(napK); } catch(e) {}
                    activeNAPs.push({ targetId: napK, targetName: napTarget ? napTarget.name : napK, endDay: kingdom.peaceTreaties[napK] });
                }
            }
        }

        var hasActive = tradeAgr.length > 0 || activeTreaties.length > 0 || activeNAPs.length > 0;
        if (hasActive) {
            html += '<div style="margin-bottom:6px;">';
            // Trade agreements
            for (var tai = 0; tai < tradeAgr.length; tai++) {
                var ta = tradeAgr[tai];
                var daysLeft = ta.endDay - Engine.getDay();
                html += '<div style="background:rgba(85,168,104,0.15);border-left:3px solid #55a868;padding:4px 8px;border-radius:4px;margin-bottom:2px;">';
                html += '<span style="font-size:0.72rem;color:#55a868;">📦 Trade Agreement: ' + escapeHtml(ta.targetKingdomName) + '</span>';
                html += '<span style="font-size:0.6rem;color:#888;margin-left:6px;">' + daysLeft + ' days left</span>';
                html += '</div>';
            }
            // NAPs
            for (var ni = 0; ni < activeNAPs.length; ni++) {
                var nap = activeNAPs[ni];
                var napLeft = nap.endDay - Engine.getDay();
                html += '<div style="background:rgba(93,173,226,0.15);border-left:3px solid #5dade2;padding:4px 8px;border-radius:4px;margin-bottom:2px;">';
                html += '<span style="font-size:0.72rem;color:#8dd3f5;">🕊️ Non-Aggression Pact: ' + escapeHtml(nap.targetName) + '</span>';
                html += '<span style="font-size:0.6rem;color:#888;margin-left:6px;">' + napLeft + ' days left</span>';
                html += '</div>';
            }
            // Mutual defense & border accords
            for (var ti = 0; ti < activeTreaties.length; ti++) {
                var tr = activeTreaties[ti];
                var trLeft = tr.endDay - Engine.getDay();
                var partnerK = null;
                try { partnerK = Engine.findKingdom(tr.partnerId); } catch(e) {}
                var pName = partnerK ? partnerK.name : tr.partnerId;
                if (tr.type === 'mutual_defense') {
                    html += '<div style="background:rgba(155,89,182,0.15);border-left:3px solid #9b59b6;padding:4px 8px;border-radius:4px;margin-bottom:2px;">';
                    html += '<span style="font-size:0.72rem;color:#c8a0ff;">🛡️ Mutual Defense: ' + escapeHtml(pName) + '</span>';
                    html += '<span style="font-size:0.6rem;color:#888;margin-left:6px;">' + trLeft + ' days left</span>';
                    html += '</div>';
                } else if (tr.type === 'border_accord') {
                    html += '<div style="background:rgba(230,126,34,0.15);border-left:3px solid #e67e22;padding:4px 8px;border-radius:4px;margin-bottom:2px;">';
                    html += '<span style="font-size:0.72rem;color:#f0b27a;">🤝 Border Accord: ' + escapeHtml(pName) + '</span>';
                    html += '<span style="font-size:0.6rem;color:#888;margin-left:6px;">' + trLeft + ' days left</span>';
                    html += '</div>';
                } else if (tr.type === 'trade_agreement') {
                    html += '<div style="background:rgba(85,168,104,0.15);border-left:3px solid #55a868;padding:4px 8px;border-radius:4px;margin-bottom:2px;">';
                    html += '<span style="font-size:0.72rem;color:#55a868;">📦 Trade Agreement: ' + escapeHtml(pName) + '</span>';
                    html += '<span style="font-size:0.6rem;color:#888;margin-left:6px;">' + trLeft + ' days left</span>';
                    html += '</div>';
                }
            }
            html += '</div>';
        }

        // Propose new agreements — show all types per kingdom
        try {
            var _allK = Engine.getWorld().kingdoms;
            var hasProposals = false;
            for (var ki = 0; ki < _allK.length; ki++) {
                var tgt = _allK[ki];
                if (tgt.id === kingdom.id) continue;
                var atWar = kingdom.atWar && kingdom.atWar.has && kingdom.atWar.has(tgt.id);
                if (atWar) continue;

                var relations = (kingdom.relations && kingdom.relations[tgt.id]) || 0;
                hasProposals = true;

                // Check existing agreements for this target
                var hasTradeWith = tradeAgr.some(function(ta) { return ta.targetKingdomId === tgt.id; });
                var hasNAPWith = activeNAPs.some(function(n) { return n.targetId === tgt.id; });
                var hasMDPWith = activeTreaties.some(function(t) { return t.type === 'mutual_defense' && t.partnerId === tgt.id && Engine.getDay() < t.endDay; });
                var hasBAWith = activeTreaties.some(function(t) { return t.type === 'border_accord' && t.partnerId === tgt.id && Engine.getDay() < t.endDay; });

                html += '<div style="background:rgba(0,0,0,0.1);padding:5px 6px;margin-bottom:3px;border-radius:4px;">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">';
                html += '<span style="font-size:0.72rem;color:#d4c9a0;">' + escapeHtml(tgt.name) + '</span>';
                html += '<span style="font-size:0.6rem;color:' + (relations >= 30 ? '#55a868' : relations >= 0 ? '#d4a843' : '#c44e52') + ';">Relations: ' + Math.round(relations) + '</span>';
                html += '</div>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:3px;">';

                // Trade Agreement (30+ relations, 100g)
                if (!hasTradeWith) {
                    var canTrade = relations >= 30;
                    html += '<button class="btn-medieval" data-action="kingProposeTrade" data-id="' + tgt.id + '" style="font-size:0.58rem;padding:2px 6px;' + (!canTrade ? 'opacity:0.4;' : '') + '" ' + (!canTrade ? 'disabled title="Need 30+ relations"' : '') + '>📦 Trade (100g)</button>';
                }

                // Non-Aggression Pact (>-10 relations, 75g)
                if (!hasNAPWith) {
                    var canNAP = relations > -10;
                    html += '<button class="btn-medieval" data-action="kingProposeNAP" data-id="' + tgt.id + '" style="font-size:0.58rem;padding:2px 6px;background:rgba(93,173,226,0.25);border-color:rgba(93,173,226,0.5);' + (!canNAP ? 'opacity:0.4;' : '') + '" ' + (!canNAP ? 'disabled title="Need > -10 relations"' : '') + '>🕊️ NAP (75g)</button>';
                }

                // Mutual Defense Pact (20+ relations, 150g)
                if (!hasMDPWith) {
                    var canMDP = relations >= 20;
                    html += '<button class="btn-medieval" data-action="kingProposeMDP" data-id="' + tgt.id + '" style="font-size:0.58rem;padding:2px 6px;background:rgba(155,89,182,0.25);border-color:rgba(155,89,182,0.5);' + (!canMDP ? 'opacity:0.4;' : '') + '" ' + (!canMDP ? 'disabled title="Need 20+ relations"' : '') + '>🛡️ Defense (150g)</button>';
                }

                // Border Accord (10+ relations, 50g)
                if (!hasBAWith) {
                    var canBA = relations >= 10;
                    html += '<button class="btn-medieval" data-action="kingProposeBorderAccord" data-id="' + tgt.id + '" style="font-size:0.58rem;padding:2px 6px;background:rgba(230,126,34,0.25);border-color:rgba(230,126,34,0.5);' + (!canBA ? 'opacity:0.4;' : '') + '" ' + (!canBA ? 'disabled title="Need 10+ relations"' : '') + '>🤝 Border (50g)</button>';
                }

                html += '</div></div>';
            }
            if (!hasProposals && !hasActive) {
                html += '<div style="font-size:0.72rem;color:#888;">No kingdoms available for diplomacy.</div>';
            }
        } catch(e) {}
        html += '</div>';

        // ── Conspiracy Response Section (if conspiracy detected) ──
        if (kingdom._conspiracy && kingdom._conspiracy.detected) {
            var consp = kingdom._conspiracy;
            var plotterNames = (consp.plotters || []).map(function(pid) {
                var p = null;
                try { p = Engine.findPerson(pid); } catch(e) {}
                return p ? ((p.firstName || '') + ' ' + (p.lastName || '')).trim() : 'Unknown';
            });
            html += '<div style="background:rgba(196,78,82,0.1);padding:8px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(196,78,82,0.3);">';
            html += '<div style="font-size:0.85rem;color:#c44e52;margin-bottom:4px;">🗡️ Active Conspiracy Detected!</div>';
            html += '<div style="font-size:0.68rem;color:#ddd;margin-bottom:4px;">Type: <b>' + (consp.type === 'coup' ? '⚔️ Coup' : '🗡️ Assassination') + '</b> — Strength: <b>' + Math.round(consp.strength || 0) + '/80</b></div>';
            html += '<div style="font-size:0.65rem;color:#aaa;margin-bottom:6px;">Known plotters: ' + plotterNames.join(', ') + '</div>';
            html += '<div style="display:flex;gap:4px;flex-wrap:wrap;">';
            html += '<button class="btn-medieval" data-action="kingRespondConspiracy" data-val="arrest_all" style="font-size:0.65rem;padding:3px 10px;background:rgba(93,173,226,0.3);border-color:rgba(93,173,226,0.6);">🔒 Arrest All</button>';
            html += '<button class="btn-medieval" data-action="kingRespondConspiracy" data-val="execute_ringleader" style="font-size:0.65rem;padding:3px 10px;background:rgba(196,78,82,0.3);border-color:rgba(196,78,82,0.6);">⚔️ Execute Ringleader</button>';
            html += '<button class="btn-medieval" data-action="kingRespondConspiracy" data-val="pardon_all" style="font-size:0.65rem;padding:3px 10px;background:rgba(85,168,104,0.3);border-color:rgba(85,168,104,0.6);">🕊️ Pardon All</button>';
            html += '</div></div>';
        }

        return html;
    }

    // ── Economic Proposals (player king reviews AI advisor recommendations) ──
    function _kingEconomicProposalsSection(kingdom) {
        var proposals = kingdom._economicProposals || [];
        // Also show active economic policies for context
        var activePolicies = [];
        if (kingdom.landSubsidies && kingdom.landSubsidies.length > 0) activePolicies.push('🏗️ ' + kingdom.landSubsidies.length + ' land subsid' + (kingdom.landSubsidies.length > 1 ? 'ies' : 'y'));
        if (kingdom.productionBounties && kingdom.productionBounties.length > 0) activePolicies.push('📜 ' + kingdom.productionBounties.length + ' production bount' + (kingdom.productionBounties.length > 1 ? 'ies' : 'y'));
        if (kingdom.tradeSubsidies && kingdom.tradeSubsidies.length > 0) activePolicies.push('💰 ' + kingdom.tradeSubsidies.length + ' trade subsid' + (kingdom.tradeSubsidies.length > 1 ? 'ies' : 'y'));
        if (kingdom.taxHolidays && kingdom.taxHolidays.length > 0) activePolicies.push('🎉 ' + kingdom.taxHolidays.length + ' tax holiday' + (kingdom.taxHolidays.length > 1 ? 's' : ''));
        if (kingdom.exportRestrictions && kingdom.exportRestrictions.length > 0) activePolicies.push('🚫 ' + kingdom.exportRestrictions.length + ' export restriction' + (kingdom.exportRestrictions.length > 1 ? 's' : ''));
        if (kingdom.immigrationIncentives && kingdom.immigrationIncentives.length > 0) activePolicies.push('🏘️ ' + kingdom.immigrationIncentives.length + ' immigration incentive' + (kingdom.immigrationIncentives.length > 1 ? 's' : ''));

        var html = '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;margin-top:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">📋 Economic Proposals';
        if (proposals.length > 0) html += ' <span style="background:#d4a843;color:#1a1a2e;font-size:0.6rem;padding:1px 5px;border-radius:8px;margin-left:4px;">' + proposals.length + '</span>';
        html += '</div>';
        html += '<div style="font-size:0.68rem;color:#888;margin-bottom:6px;">Your advisors analyze the kingdom economy and recommend actions. Approve or dismiss each proposal.</div>';

        // Active policies summary
        if (activePolicies.length > 0) {
            html += '<div style="background:rgba(85,168,104,0.1);border:1px solid rgba(85,168,104,0.2);border-radius:4px;padding:4px 6px;margin-bottom:6px;">';
            html += '<div style="font-size:0.68rem;color:#55a868;margin-bottom:2px;">Active Policies:</div>';
            html += '<div style="font-size:0.65rem;color:#aaa;">' + activePolicies.join(' · ') + '</div>';
            html += '</div>';
        }

        if (proposals.length === 0) {
            html += '<div style="font-size:0.72rem;color:#888;font-style:italic;">No new proposals. Your advisors will review the economy periodically.</div>';
        } else {
            for (var _epi = 0; _epi < proposals.length; _epi++) {
                var _ep = proposals[_epi];
                var _daysOld = Engine.getDay() - _ep.createdDay;
                var _expiresIn = 15 - _daysOld;
                html += '<div style="background:rgba(0,0,0,0.12);padding:6px 8px;border-radius:4px;margin-bottom:4px;border-left:3px solid rgba(212,168,67,0.5);">';
                html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
                html += '<div style="flex:1;">';
                html += '<div style="font-size:0.78rem;color:#d4c9a0;">' + _ep.icon + ' ' + escapeHtml(_ep.title) + '</div>';
                html += '<div style="font-size:0.68rem;color:#aaa;margin-top:2px;">' + escapeHtml(_ep.desc) + '</div>';
                html += '<div style="font-size:0.6rem;color:#666;margin-top:2px;">Expires in ' + _expiresIn + ' day' + (_expiresIn !== 1 ? 's' : '') + '</div>';
                html += '</div>';
                html += '<div style="display:flex;gap:4px;margin-left:8px;flex-shrink:0;">';
                html += '<button class="btn-medieval" data-action="kingApproveProposal" data-id="' + _ep.id + '" style="font-size:0.62rem;padding:2px 8px;background:rgba(85,168,104,0.3) !important;border-color:rgba(85,168,104,0.5) !important;">✅ Approve</button>';
                html += '<button class="btn-medieval" data-action="kingDismissProposal" data-id="' + _ep.id + '" style="font-size:0.62rem;padding:2px 8px;background:rgba(196,78,82,0.2) !important;border-color:rgba(196,78,82,0.4) !important;">❌ Dismiss</button>';
                html += '</div>';
                html += '</div>';
                html += '</div>';
            }
        }

        // Revoke active export restrictions
        if (kingdom.exportRestrictions && kingdom.exportRestrictions.length > 0) {
            html += '<div style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.05);padding-top:6px;">';
            html += '<div style="font-size:0.72rem;color:#c44e52;margin-bottom:4px;">🚫 Active Export Restrictions</div>';
            for (var _eri = 0; _eri < kingdom.exportRestrictions.length; _eri++) {
                var _erGood = kingdom.exportRestrictions[_eri];
                var _erRes = null;
                try { _erRes = Engine.findResourceById(_erGood); } catch(e) {}
                var _erName = _erRes ? _erRes.name : _erGood;
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 6px;margin-bottom:2px;background:rgba(0,0,0,0.08);border-radius:3px;">';
                html += '<span style="font-size:0.7rem;color:#d4c9a0;">🚫 ' + escapeHtml(_erName) + '</span>';
                html += '<button class="btn-medieval" data-action="kingRevokeExportRestriction" data-id="' + _erGood + '" style="font-size:0.58rem;padding:1px 6px;">Revoke</button>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function _kingAdvisorSection(kingdom, ks) {
        var html = '';
        var suggestions = [];

        // Find actual Royal Advisor NPCs
        var advisors = [];
        try {
            var _w = Engine.getWorld();
            if (_w && _w.people) {
                for (var _rai = 0; _rai < _w.people.length; _rai++) {
                    var _rap = _w.people[_rai];
                    if (!_rap.alive || _rap.kingdomId !== kingdom.id) continue;
                    var _raRank = (_rap.socialRank && _rap.socialRank[kingdom.id]) || 0;
                    if (_raRank >= 5) advisors.push(_rap);
                }
            }
        } catch(e) {}

        if (advisors.length === 0) {
            html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
            html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">💬 Royal Advisors</div>';
            html += '<div style="font-size:0.72rem;color:#888;">No advisors available. Appoint nobles to rank 5+ to receive counsel.</div>';
            html += '</div>';
            return html;
        }

        // Analyze kingdom state
        var atWar = kingdom.atWar && ((kingdom.atWar.size > 0) || (Array.isArray(kingdom.atWar) && kingdom.atWar.length > 0));
        var happiness = kingdom.happiness || 50;
        var treasury = kingdom.gold || 0;
        var milStr = kingdom.militaryStrength || 50;
        var towns = [];
        try { towns = Engine.getTowns().filter(function(t) { return t.kingdomId === kingdom.id; }); } catch(e) {}
        var plagueCount = 0;
        for (var _ati = 0; _ati < towns.length; _ati++) { if (towns[_ati].plagueActive) plagueCount++; }

        // Generate contextual suggestions
        var _advIdx = 0;
        if (atWar && milStr < 40) {
            suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '🪖', text: 'Your Grace, our military strength is low. We should recruit more soldiers before the enemy overwhelms us.', action: 'openKingPanel', actionParam: 'decisions', actionLabel: '🪖 Go to War Management' });
            _advIdx++;
        }
        if (happiness < 35) {
            suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '😠', text: 'The people grow restless, Your Grace. Perhaps lower taxes or hold a festival to improve morale.', action: 'openKingPanel', actionParam: 'decisions', actionLabel: '⚖️ Manage Decisions' });
            _advIdx++;
        }
        if (treasury < 2000) {
            suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '💰', text: 'The treasury runs low. We need revenue — consider raising taxes or commissioning trade expeditions.', action: 'openKingPanel', actionParam: 'decisions', actionLabel: '💰 Tax Policy' });
            _advIdx++;
        }
        if (plagueCount > 0) {
            suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '🏥', text: 'Disease spreads in ' + plagueCount + ' town' + (plagueCount > 1 ? 's' : '') + '! We must quarantine affected areas immediately.', action: 'openKingPanel', actionParam: 'decisions', actionLabel: '🏥 Issue Directive' });
            _advIdx++;
        }
        if (!atWar) {
            // Check for hostile neighbors
            try {
                var _allK2 = Engine.getWorld().kingdoms;
                for (var _ki2 = 0; _ki2 < _allK2.length; _ki2++) {
                    var _tgtK = _allK2[_ki2];
                    if (_tgtK.id === kingdom.id) continue;
                    var _rel = kingdom.relations ? (kingdom.relations[_tgtK.id] || 0) : 0;
                    if (_rel < -30) {
                        suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '⚠️', text: 'Relations with ' + escapeHtml(_tgtK.name) + ' deteriorate. We should prepare for conflict or seek diplomacy.', action: 'openKingPanel', actionParam: 'decisions', actionLabel: '⚔️ Military' });
                        _advIdx++;
                        break;
                    }
                }
            } catch(e) {}
        }
        if (happiness > 70 && treasury > 5000) {
            suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '🏗️', text: 'Times are good, Your Grace. This is the perfect time to invest in infrastructure — roads, markets, defenses.', action: 'openKingPanel', actionParam: 'decisions', actionLabel: '📋 Royal Orders' });
            _advIdx++;
        }
        if (atWar) {
            suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '⚔️', text: 'The war continues. We should monitor our armies and consider fortifying border towns.', action: 'openKingPanel', actionParam: 'decisions', actionLabel: '⚔️ War Status' });
            _advIdx++;
        }

        // Suggest trade agreements if at peace with kingdoms we have decent relations with
        if (!atWar) {
            try {
                var _tradeK = Engine.getWorld().kingdoms;
                var hasTradeAgreement = ks._tradeAgreements && ks._tradeAgreements.length > 0;
                if (!hasTradeAgreement) {
                    for (var _tki = 0; _tki < _tradeK.length; _tki++) {
                        if (_tradeK[_tki].id === kingdom.id) continue;
                        var _tRel = kingdom.relations ? (kingdom.relations[_tradeK[_tki].id] || 0) : 0;
                        if (_tRel > 20) {
                            suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '🤝', text: 'We have no trade agreements. ' + escapeHtml(_tradeK[_tki].name) + ' has favorable relations — a trade deal would benefit us both.', action: 'openKingPanel', actionParam: 'decisions', actionLabel: '🏛️ Diplomacy' });
                            _advIdx++;
                            break;
                        }
                    }
                }
            } catch(e) {}
        }

        // Suggest feast/court if none held recently
        var daysSinceFeast = Engine.getDay() - (ks.feastHeldDay || 0);
        var daysSinceCourt = Engine.getDay() - (ks.courtHeldDay || 0);
        if (daysSinceFeast > 60 && !kingdom._activeFeast && !kingdom._pendingFeast && treasury > 1000) {
            suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '🎉', text: 'It has been ' + daysSinceFeast + ' days since a royal feast. Hosting one would improve noble relations and happiness.', action: 'openKingPanel', actionParam: 'decisions', actionLabel: '🎉 Events' });
            _advIdx++;
        }
        if (daysSinceCourt > 60 && !kingdom._courtSession && !kingdom._pendingCourt) {
            suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '⚖️', text: 'The people await your judgment. Holding court would address their petitions and boost your reputation.', action: 'openKingPanel', actionParam: 'decisions', actionLabel: '⚖️ Events' });
            _advIdx++;
        }

        // Suggest recruiting soldiers if garrison is thin
        var totalGarrison = 0;
        for (var _tgi = 0; _tgi < towns.length; _tgi++) totalGarrison += (towns[_tgi].garrison || 0);
        if (totalGarrison < towns.length * 10 && treasury > 2000) {
            suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '🪖', text: 'Our garrisons are thin. Recruiting soldiers would strengthen our defenses against potential threats.', action: 'openKingPanel', actionParam: 'military', actionLabel: '🪖 Military' });
            _advIdx++;
        }

        // Suggest quarantine action — with concrete instructions
        if (plagueCount > 0) {
            var plagueTowns = [];
            for (var _pti = 0; _pti < towns.length; _pti++) { if (towns[_pti].plagueActive) plagueTowns.push(towns[_pti].name); }
            // v9p33river304: was actionParam: 'directives' — no such tab
            // exists. Royal directives (including quarantine assignments)
            // live inside the Nobility tab (_kingAssignDirectivesSection
            // is called from _kingNobilityTab).
            suggestions.push({ advisor: advisors[_advIdx % advisors.length], icon: '🦠', text: 'Quarantine needed! ' + plagueTowns.join(', ') + ' ha' + (plagueTowns.length > 1 ? 've' : 's') + ' active plague. Issue a quarantine directive from the Nobility tab to contain the spread.', action: 'openKingPanel', actionParam: 'nobility', actionLabel: '🏅 Nobility' });
            _advIdx++;
        }

        // Cap at 5 suggestions
        if (suggestions.length > 5) suggestions.length = 5;

        if (suggestions.length === 0) return '';

        html += '<div style="background:rgba(44,62,80,0.15);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:8px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">💬 Royal Advisor Counsel</div>';
        for (var _si = 0; _si < suggestions.length; _si++) {
            var _sg = suggestions[_si];
            var _adv = _sg.advisor;
            html += '<div style="background:rgba(0,0,0,0.12);padding:6px 8px;border-radius:4px;margin-bottom:4px;border-left:3px solid rgba(212,168,67,0.4);">';
            html += '<div style="font-size:0.72rem;color:#d4c9a0;margin-bottom:3px;">' + _sg.icon + ' <em>"' + _sg.text + '"</em></div>';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<span style="font-size:0.62rem;color:#888;">— ' + escapeHtml((_adv.firstName || '') + ' ' + (_adv.lastName || '')) + ', ' + ((_adv.socialRank && _adv.socialRank[kingdom.id] || 0) >= 6 ? 'Royal Advisor' : 'Lord') + '</span>';
            html += '<button class="btn-medieval" data-action="' + _sg.action + '" data-id="' + _sg.actionParam + '" style="font-size:0.6rem;padding:2px 6px;">' + _sg.actionLabel + '</button>';
            html += '</div></div>';
        }
        html += '</div>';
        return html;
    }

    // =========================================================================
    // Kingdom Employees Tab — Hire procurers, guards, royal guards
    // =========================================================================
    function _kingEmployeesTab(kingdom, ks) {
        var html = '';
        var summary = null;
        try { summary = Player.kingGetEmployeeSummary(); } catch(e) {}
        if (!summary) summary = { procurers: [], guards: [], royalGuards: [], postings: [], orders: [], weeklyCost: { procurers: 0, guards: 0, royalGuards: 0, total: 0 }, assassinationReduction: 0 };

        var _kTowns = [];
        try {
            var _allT = Engine.getTowns();
            for (var _ti2 = 0; _ti2 < _allT.length; _ti2++) {
                if (_allT[_ti2].kingdomId === kingdom.id && !_allT[_ti2].isWilderness) _kTowns.push(_allT[_ti2]);
            }
        } catch(e) {}

        // Cost Summary
        html += '<div style="background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.2);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">💰 Weekly Employee Costs</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;font-size:0.72rem;">';
        html += '<div style="text-align:center;"><div style="color:#aaa;">Procurers</div><div style="color:#e0c58a;">' + formatGold(summary.weeklyCost.procurers) + '/wk</div><div style="color:#888;">(' + summary.procurers.length + ' hired)</div></div>';
        html += '<div style="text-align:center;"><div style="color:#aaa;">Guards</div><div style="color:#e0c58a;">' + formatGold(summary.weeklyCost.guards) + '/wk</div><div style="color:#888;">(' + summary.guards.length + ' hired)</div></div>';
        html += '<div style="text-align:center;"><div style="color:#aaa;">Royal Guards</div><div style="color:#e0c58a;">' + formatGold(summary.weeklyCost.royalGuards) + '/wk</div><div style="color:#888;">(' + summary.royalGuards.length + ' hired)</div></div>';
        html += '<div style="text-align:center;"><div style="color:#d4a843;font-weight:bold;">Total</div><div style="color:#e0c58a;font-weight:bold;">' + formatGold(summary.weeklyCost.total) + '/wk</div></div>';
        html += '</div>';
        if (summary.assassinationReduction > 0) {
            html += '<div style="font-size:0.65rem;color:#81c784;margin-top:4px;">🛡️ Royal Guards reduce assassination risk by ' + summary.assassinationReduction + '%</div>';
        }
        html += '</div>';

        // Active Postings
        if (summary.postings.length > 0) {
            html += '<div style="background:rgba(93,173,226,0.08);border:1px solid rgba(93,173,226,0.2);padding:8px;border-radius:6px;margin-bottom:8px;">';
            html += '<div style="font-size:0.82rem;color:#5dade2;margin-bottom:4px;">📋 Active Hiring Postings</div>';
            for (var _hpi = 0; _hpi < summary.postings.length; _hpi++) {
                var _hp = summary.postings[_hpi];
                var _tLabel = _hp.type === 'procurer' ? '📦 Procurer' : _hp.type === 'guard' ? '🛡️ Guard' : '⚔️ Royal Guard';
                html += '<div style="font-size:0.7rem;color:#ccc;padding:2px 0;">' + _tLabel + ': ' + _hp.slotsFilled + '/' + _hp.slotsTotal + ' filled (' + _hp.weeklyPay + 'g/wk)</div>';
            }
            html += '</div>';
        }

        // Hiring Controls
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">🏗️ Hire Employees</div>';
        html += '<div style="font-size:0.68rem;color:#aaa;margin-bottom:6px;">Post positions and NPCs will apply over time based on pay.</div>';

        html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">';
        html += '<select id="_empType" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
        html += '<option value="procurer">📦 Procurer (buy goods)</option>';
        html += '<option value="guard">🛡️ Town Guard (reduce crime)</option>';
        html += '<option value="royal_guard">⚔️ Royal Guard (protect king)</option>';
        html += '</select>';
        html += '<input type="number" id="_empCount" min="1" max="10" value="2" style="font-size:0.65rem;width:40px;padding:2px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;" title="Count">';
        html += '<input type="number" id="_empPay" min="5" max="200" value="25" style="font-size:0.65rem;width:50px;padding:2px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;" title="Weekly pay (gold)">';
        html += '<span style="font-size:0.6rem;color:#888;">g/wk</span>';
        html += '<select id="_empTown" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;">';
        html += '<option value="">All Towns</option>';
        for (var _eti = 0; _eti < _kTowns.length; _eti++) html += '<option value="' + _kTowns[_eti].id + '">' + escapeHtml(_kTowns[_eti].name) + '</option>';
        html += '</select>';
        html += '<button class="btn-medieval" data-action="kingHireEmployees" style="font-size:0.62rem;padding:2px 8px;">📋 Post</button>';
        html += '</div>';
        html += '<div style="font-size:0.6rem;color:#888;">Royal Guards: 18-35, prior military experience, citizen rank. Higher pay = faster filling.</div>';
        html += '</div>';

        // Procurers Section
        html += '<div style="background:rgba(85,168,104,0.08);border:1px solid rgba(85,168,104,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.82rem;color:#81c784;margin-bottom:4px;">📦 Procurers (' + summary.procurers.length + ')</div>';
        if (summary.procurers.length === 0) {
            html += '<div style="font-size:0.68rem;color:#888;">No procurers hired. Procurers travel your kingdom buying goods for the treasury.</div>';
        } else {
            for (var _pi2 = 0; _pi2 < summary.procurers.length; _pi2++) {
                var _proc = summary.procurers[_pi2];
                var _procTown = null; try { _procTown = Engine.findTown(_proc.townId); } catch(e) {}
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;background:rgba(0,0,0,0.1);border-radius:3px;margin-bottom:2px;">';
                html += '<span style="font-size:0.7rem;color:#d4c9a0;">' + escapeHtml(_proc.name) + ' <span style="color:#888;">(' + (_procTown ? _procTown.name : '?') + ', ' + _proc.weeklyPay + 'g/wk)</span></span>';
                html += '<button class="btn-medieval" data-action="kingDismissEmployee" data-id="' + _proc.id + '" data-val="procurer" style="font-size:0.58rem;padding:1px 4px;background:rgba(196,78,82,0.3) !important;">Dismiss</button>';
                html += '</div>';
            }
        }
        html += '</div>';

        // Procurement Orders
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.82rem;color:#d4a843;margin-bottom:4px;">📋 Procurement Orders (' + summary.orders.length + '/20)</div>';
        html += '<div style="font-size:0.68rem;color:#aaa;margin-bottom:4px;">Set orders for procurers to fill by traveling and buying from kingdom markets.</div>';
        if (summary.procurers.length === 0) {
            html += '<div style="font-size:0.68rem;color:#e57373;">⚠️ Hire procurers first to fill procurement orders.</div>';
        } else {
            // Add order form
            html += '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">';
            // Dynamic goods list
            var _procGoods = [];
            try {
                if (typeof CONFIG !== 'undefined' && CONFIG.ITEMS) {
                    var _pKeys = Object.keys(CONFIG.ITEMS);
                    for (var _pki = 0; _pki < _pKeys.length; _pki++) { _procGoods.push(_pKeys[_pki]); }
                    _procGoods.sort();
                }
            } catch(e) {}
            if (_procGoods.length === 0) _procGoods = ['swords', 'armor', 'bows', 'arrows', 'horses', 'bread', 'wheat', 'cloth', 'tools', 'wood', 'iron', 'stone'];
            html += '<select id="_procGood" style="font-size:0.65rem;padding:2px 4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;max-width:140px;">';
            for (var _pgi = 0; _pgi < _procGoods.length; _pgi++) {
                var _pgDef = (typeof CONFIG !== 'undefined' && CONFIG.ITEMS) ? CONFIG.ITEMS[_procGoods[_pgi]] : null;
                var _pgName = _pgDef ? (_pgDef.name || _procGoods[_pgi]) : _procGoods[_pgi];
                html += '<option value="' + _procGoods[_pgi] + '">' + _pgName + '</option>';
            }
            html += '</select>';
            html += '<input type="number" id="_procQty" min="1" max="500" value="20" style="font-size:0.65rem;width:50px;padding:2px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;" title="Quantity">';
            html += '<input type="number" id="_procMaxPrice" min="1" max="999" value="50" style="font-size:0.65rem;width:50px;padding:2px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:3px;" title="Max price each">';
            html += '<span style="font-size:0.6rem;color:#888;">max/ea</span>';
            html += '<button class="btn-medieval" data-action="kingSetProcurementOrder" style="font-size:0.62rem;padding:2px 8px;">📦 Order</button>';
            html += '</div>';
        }
        // Active orders
        if (summary.orders.length > 0) {
            html += '<div style="margin-top:4px;">';
            for (var _oi = 0; _oi < summary.orders.length; _oi++) {
                var _ord = summary.orders[_oi];
                var _ordDef = (typeof CONFIG !== 'undefined' && CONFIG.ITEMS && CONFIG.ITEMS[_ord.goodId]) ? CONFIG.ITEMS[_ord.goodId] : null;
                var _ordName = _ordDef ? (_ordDef.name || _ord.goodId) : _ord.goodId;
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 6px;background:rgba(0,0,0,0.1);border-radius:3px;margin-bottom:2px;">';
                html += '<span style="font-size:0.68rem;color:#d4c9a0;">' + _ordName + ': ' + (_ord.filled || 0) + '/' + ((_ord.filled || 0) + _ord.remaining) + ' (max ' + _ord.maxPrice + 'g ea)</span>';
                html += '<button class="btn-medieval" data-action="kingCancelProcOrder" data-id="' + _ord.id + '" style="font-size:0.58rem;padding:1px 4px;background:rgba(196,78,82,0.2) !important;">✕</button>';
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';

        // Guards Section
        html += '<div style="background:rgba(93,173,226,0.08);border:1px solid rgba(93,173,226,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.82rem;color:#5dade2;margin-bottom:4px;">🛡️ Town Guards (' + summary.guards.length + ')</div>';
        if (summary.guards.length === 0) {
            html += '<div style="font-size:0.68rem;color:#888;">No guards hired. Guards patrol towns and reduce crime.</div>';
        } else {
            for (var _gi2 = 0; _gi2 < summary.guards.length; _gi2++) {
                var _grd = summary.guards[_gi2];
                var _grdTown = null; try { _grdTown = Engine.findTown(_grd.townId); } catch(e) {}
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;background:rgba(0,0,0,0.1);border-radius:3px;margin-bottom:2px;">';
                html += '<span style="font-size:0.7rem;color:#d4c9a0;">' + escapeHtml(_grd.name) + ' <span style="color:#888;">(' + (_grdTown ? _grdTown.name : '?') + ', ' + _grd.weeklyPay + 'g/wk)</span></span>';
                html += '<button class="btn-medieval" data-action="kingDismissEmployee" data-id="' + _grd.id + '" data-val="guard" style="font-size:0.58rem;padding:1px 4px;background:rgba(196,78,82,0.3) !important;">Dismiss</button>';
                html += '</div>';
            }
        }
        html += '</div>';

        // Royal Guards Section
        html += '<div style="background:rgba(196,78,82,0.08);border:1px solid rgba(196,78,82,0.15);padding:8px;border-radius:6px;">';
        html += '<div style="font-size:0.82rem;color:#c44e52;margin-bottom:4px;">⚔️ Royal Guards (' + summary.royalGuards.length + ')</div>';
        html += '<div style="font-size:0.65rem;color:#888;margin-bottom:4px;">Each royal guard reduces assassination chance by ~3% (max -60%). Requires ages 18-35, military experience, citizen rank.</div>';
        if (summary.royalGuards.length === 0) {
            html += '<div style="font-size:0.68rem;color:#888;">No royal guards hired.</div>';
        } else {
            for (var _rgi = 0; _rgi < summary.royalGuards.length; _rgi++) {
                var _rgd = summary.royalGuards[_rgi];
                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;background:rgba(0,0,0,0.1);border-radius:3px;margin-bottom:2px;">';
                html += '<span style="font-size:0.7rem;color:#d4c9a0;">' + escapeHtml(_rgd.name) + ' <span style="color:#888;">(' + _rgd.weeklyPay + 'g/wk)</span></span>';
                html += '<button class="btn-medieval" data-action="kingDismissEmployee" data-id="' + _rgd.id + '" data-val="royal_guard" style="font-size:0.58rem;padding:1px 4px;background:rgba(196,78,82,0.3) !important;">Dismiss</button>';
                html += '</div>';
            }
        }
        html += '</div>';

        return html;
    }

    // =========================================================================
    // Kingdom Finances Tab — Income/Expense breakdown, 30/90 day view, forecast
    // =========================================================================
    function _kingFinancesTab(kingdom, ks) {
        var html = '';
        var treasury = Math.floor(kingdom.gold || 0);

        // Treasury header
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;text-align:center;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">💰 Royal Treasury</div>';
        html += '<div style="font-size:1.3rem;color:#e0c58a;font-weight:bold;">' + formatGold(treasury) + '</div>';
        html += '</div>';

        // Category labels for display
        var _catLabels = {
            trade_tax: '🏪 Trade Tax', property_tax: '🏠 Property Tax', income_tax: '📋 Income Tax',
            transport: '🚂 Transport', stockpile_sale: '📦 Stockpile Sales', coronation: '👑 Coronation',
            soldier_upkeep: '⚔️ Soldiers', building_upkeep: '🏗️ Buildings', employee_wages: '👷 Employee Wages',
            procurement: '🛒 Procurement', commissions: '📜 Commissions', subsidies: '💸 Subsidies',
            war: '⚔️ War Costs', construction: '🏗️ Construction', other: '📦 Other'
        };

        // Get ledger summaries
        var sum30 = null, sum90 = null;
        try {
            if (Engine.getKingdomLedgerSummary) {
                sum30 = Engine.getKingdomLedgerSummary(kingdom, 30);
                sum90 = Engine.getKingdomLedgerSummary(kingdom, 90);
            }
        } catch(e) {}
        if (!sum30) sum30 = { income: {}, expenses: {}, totalIncome: 0, totalExpenses: 0, net: 0, entries: 0 };
        if (!sum90) sum90 = { income: {}, expenses: {}, totalIncome: 0, totalExpenses: 0, net: 0, entries: 0 };

        // Helper to render a breakdown section
        function _renderBreakdown(label, data, color) {
            var h = '';
            var keys = Object.keys(data).sort(function(a, b) { return (data[b] || 0) - (data[a] || 0); });
            if (keys.length === 0) {
                h += '<div style="font-size:0.68rem;color:#666;">No records.</div>';
                return h;
            }
            for (var i = 0; i < keys.length; i++) {
                var cat = keys[i];
                var amt = Math.floor(data[cat]);
                if (amt === 0) continue;
                var catLabel = _catLabels[cat] || ('📦 ' + cat);
                h += '<div style="display:flex;justify-content:space-between;padding:2px 6px;margin-bottom:1px;background:rgba(0,0,0,0.08);border-radius:3px;">';
                h += '<span style="font-size:0.68rem;color:#bbb;">' + catLabel + '</span>';
                h += '<span style="font-size:0.68rem;color:' + color + ';">' + formatGold(amt) + '</span>';
                h += '</div>';
            }
            return h;
        }

        // 30-day view
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">📅 Last 30 Days</div>';

        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;">';
        // Income column
        html += '<div>';
        html += '<div style="font-size:0.72rem;color:#7a7;margin-bottom:3px;">📈 Income: <span style="color:#8c8;">' + formatGold(Math.floor(sum30.totalIncome)) + '</span></div>';
        html += _renderBreakdown('Income', sum30.income, '#8c8');
        html += '</div>';
        // Expenses column
        html += '<div>';
        html += '<div style="font-size:0.72rem;color:#c44e52;margin-bottom:3px;">📉 Expenses: <span style="color:#e88;">' + formatGold(Math.floor(sum30.totalExpenses)) + '</span></div>';
        html += _renderBreakdown('Expenses', sum30.expenses, '#e88');
        html += '</div>';
        html += '</div>';

        var net30 = Math.floor(sum30.net);
        var netColor30 = net30 >= 0 ? '#8c8' : '#e88';
        html += '<div style="text-align:center;padding:4px;background:rgba(0,0,0,0.1);border-radius:4px;margin-bottom:4px;">';
        html += '<span style="font-size:0.72rem;color:#aaa;">Net (30d): </span>';
        html += '<span style="font-size:0.8rem;font-weight:bold;color:' + netColor30 + ';">' + (net30 >= 0 ? '+' : '') + formatGold(net30) + '</span>';
        html += '</div>';
        html += '</div>';

        // 90-day view
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">📅 Last 90 Days</div>';

        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;">';
        html += '<div>';
        html += '<div style="font-size:0.72rem;color:#7a7;margin-bottom:3px;">📈 Income: <span style="color:#8c8;">' + formatGold(Math.floor(sum90.totalIncome)) + '</span></div>';
        html += _renderBreakdown('Income', sum90.income, '#8c8');
        html += '</div>';
        html += '<div>';
        html += '<div style="font-size:0.72rem;color:#c44e52;margin-bottom:3px;">📉 Expenses: <span style="color:#e88;">' + formatGold(Math.floor(sum90.totalExpenses)) + '</span></div>';
        html += _renderBreakdown('Expenses', sum90.expenses, '#e88');
        html += '</div>';
        html += '</div>';

        var net90 = Math.floor(sum90.net);
        var netColor90 = net90 >= 0 ? '#8c8' : '#e88';
        html += '<div style="text-align:center;padding:4px;background:rgba(0,0,0,0.1);border-radius:4px;">';
        html += '<span style="font-size:0.72rem;color:#aaa;">Net (90d): </span>';
        html += '<span style="font-size:0.8rem;font-weight:bold;color:' + netColor90 + ';">' + (net90 >= 0 ? '+' : '') + formatGold(net90) + '</span>';
        html += '</div>';
        html += '</div>';

        // 30-day Treasury Forecast
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">🔮 30-Day Forecast</div>';
        var dailyNet30 = sum30.entries > 0 ? net30 / 30 : 0;
        var forecast30 = Math.floor(treasury + dailyNet30 * 30);
        var fcColor = forecast30 >= treasury ? '#8c8' : (forecast30 > 0 ? '#e0c58a' : '#e88');
        html += '<div style="text-align:center;">';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:4px;">Based on current income/expense trends:</div>';
        html += '<div style="font-size:1.1rem;font-weight:bold;color:' + fcColor + ';">' + formatGold(forecast30) + '</div>';
        html += '<div style="font-size:0.65rem;color:#888;">(' + (dailyNet30 >= 0 ? '+' : '') + formatGold(Math.round(dailyNet30)) + '/day average)</div>';
        if (forecast30 < 0) {
            var daysUntilBankrupt = dailyNet30 < 0 ? Math.floor(treasury / Math.abs(dailyNet30)) : 999;
            html += '<div style="font-size:0.72rem;color:#e88;margin-top:4px;">⚠️ Treasury will be depleted in ~' + daysUntilBankrupt + ' days at current rate!</div>';
        }
        html += '</div></div>';

        // Quick financial health indicator
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">📊 Financial Health</div>';
        var healthRating = 'Unknown';
        var healthColor = '#888';
        if (sum30.entries > 5) {
            if (net30 > 500 && treasury > 5000) { healthRating = 'Excellent'; healthColor = '#4a4'; }
            else if (net30 > 0 && treasury > 2000) { healthRating = 'Good'; healthColor = '#8c8'; }
            else if (net30 > -100 && treasury > 500) { healthRating = 'Stable'; healthColor = '#e0c58a'; }
            else if (net30 > -500) { healthRating = 'Concerning'; healthColor = '#e8a'; }
            else { healthRating = 'Critical'; healthColor = '#e44'; }
        }
        html += '<div style="text-align:center;font-size:0.9rem;font-weight:bold;color:' + healthColor + ';">' + healthRating + '</div>';
        html += '</div>';

        return html;
    }

    function _kingThreatsTab(kingdom, ks) {
        var html = '';

        // Assassination risk
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#c44e52;margin-bottom:6px;">🗡️ Assassination Risk: ' + (ks.assassinationRisk || 0) + '%</div>';
        if ((ks.assassinationRisk || 0) > 60) {
            html += '<div style="font-size:0.72rem;color:#c44e52;background:rgba(196,78,82,0.15);padding:6px;border-radius:4px;margin-bottom:6px;">⚠️ CRITICAL: Multiple nobles are hostile. Your life is in danger!</div>';
        } else if ((ks.assassinationRisk || 0) > 30) {
            html += '<div style="font-size:0.72rem;color:#e67e22;margin-bottom:6px;">⚠️ Some nobles are displeased. Consider improving relationships or hosting a feast.</div>';
        } else {
            html += '<div style="font-size:0.72rem;color:#55a868;margin-bottom:6px;">✅ Your position is secure. Nobles are generally content.</div>';
        }
        html += _riskMeter(ks.assassinationRisk || 0, 'Assassination Threat Level', '#c44e52');
        html += '<div style="font-size:0.68rem;color:#888;margin-top:4px;">Tip: Host feasts (+5 noble relations), use blackmail to suppress plotters, hire guards.</div>';
        html += '</div>';

        // Revolt risk
        html += '<div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:6px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#e67e22;margin-bottom:6px;">🔥 Revolt Risk: ' + (ks.revoltRisk || 0) + '%</div>';
        if ((ks.revoltRisk || 0) > 60) {
            html += '<div style="font-size:0.72rem;color:#c44e52;background:rgba(196,78,82,0.15);padding:6px;border-radius:4px;margin-bottom:6px;">⚠️ CRITICAL: The people are on the verge of revolt! Lower taxes or hold court immediately.</div>';
        } else if ((ks.revoltRisk || 0) > 30) {
            html += '<div style="font-size:0.72rem;color:#e67e22;margin-bottom:6px;">⚠️ Unrest is growing. Consider lowering taxes or hosting a festival.</div>';
        } else {
            html += '<div style="font-size:0.72rem;color:#55a868;margin-bottom:6px;">✅ The people are relatively content.</div>';
        }
        html += _riskMeter(ks.revoltRisk || 0, 'Revolt Threat Level', '#e67e22');
        html += '<div style="font-size:0.68rem;color:#888;margin-top:4px;">Tip: Hold court (+3 happiness), lower taxes, host festivals.</div>';
        html += '</div>';

        // Flee button
        html += '<div style="background:rgba(139,69,19,0.2);padding:10px;border-radius:6px;border:1px solid rgba(139,69,19,0.4);">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">💨 Emergency Escape</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:8px;">Flee the kingdom and start a new life. You will:</div>';
        html += '<ul style="font-size:0.68rem;color:#c44e52;margin:0 0 8px 16px;padding:0;">';
        html += '<li>Lose your crown, title, and all reputation</li>';
        html += '<li>Lose all buildings, caravans, and employees</li>';
        html += '<li>Get a random new name and identity</li>';
        html += '<li>Start with only 50g in a random foreign town</li>';
        html += '<li>Keep: skills, achievements, family</li>';
        html += '</ul>';
        html += '<button class="btn-medieval" data-action="_confirmKingFlee" style="background:rgba(139,69,19,0.4) !important;border-color:rgba(139,69,19,0.6) !important;font-size:0.75rem;padding:5px 14px;">💨 Flee the Kingdom</button>';
        html += '</div>';

        return html;
    }

    // ── King Assign Directives ──
    // Analyzes kingdom state and presents context-appropriate directives the king can issue
    function _kingAssignDirectivesSection(kingdom) {
        var html = '';
        var day = 0;
        try { day = Engine.getDay(); } catch (e) {}
        var rng = null;
        try { rng = Engine.getRng(); } catch (e) {}

        // Analyze kingdom state for context
        var atWar = kingdom.atWar && (kingdom.atWar.size > 0 || (Array.isArray(kingdom.atWar) && kingdom.atWar.length > 0));
        var happiness = kingdom.happiness || 50;
        var treasury = kingdom.gold || 0;
        var towns = [];
        try { towns = Engine.getTowns().filter(function(t) { return t.kingdomId === kingdom.id && !t.isOutpost && !t.isWilderness; }); } catch (e) {}
        var plagueCount = 0;
        var foodShortage = false;
        var lowHappinessTowns = [];
        for (var _ti = 0; _ti < towns.length; _ti++) {
            if (towns[_ti].plagueActive) plagueCount++;
            // v9p33river289: towns store goods under town.market.supply (the
            // marketSupply alias never existed), so this never detected real
            // shortages for royal-mission UI.
            var _mSup = towns[_ti].market && towns[_ti].market.supply;
            if (towns[_ti].foodShortage || (_mSup && (_mSup.wheat || 0) < 10 && (_mSup.bread || 0) < 10)) foodShortage = true;
            if ((towns[_ti].happiness || 50) < 35) lowHappinessTowns.push(towns[_ti]);
        }

        // Get eligible nobles to assign to
        var nobles = [];
        try {
            var allPeople = Engine.getPeople ? Engine.getPeople() : [];
            for (var _ni = 0; _ni < allPeople.length; _ni++) {
                var _np = allPeople[_ni];
                if (!_np.alive || !_np.socialRank) continue;
                var _npRank = 0;
                if (typeof _np.socialRank === 'object') _npRank = _np.socialRank[kingdom.id] || 0;
                else if (typeof _np.socialRank === 'number') _npRank = _np.socialRank;
                if (_npRank >= 4) nobles.push({ person: _np, rank: _npRank });
            }
        } catch (e) {}

        // Check existing active royal directives issued by the king
        var issuedDirectives = kingdom._kingDirectives || [];

        // Build suggested directives based on kingdom state
        var suggestions = [];

        // WAR directives
        if (atWar) {
            suggestions.push({ id: 'supply_warfront', icon: '⚔️', title: 'Supply the War Effort', desc: 'Order a noble to deliver military goods to the front lines.', urgency: 'critical', cat: 'military' });
            suggestions.push({ id: 'recruit_soldiers', icon: '🛡️', title: 'Recruit Soldiers', desc: 'Command a noble to recruit fighting men from their towns.', urgency: 'high', cat: 'military' });
            suggestions.push({ id: 'fortify_border', icon: '🏰', title: 'Fortify Border Towns', desc: 'Order fortification of border settlements.', urgency: 'high', cat: 'military' });
            suggestions.push({ id: 'scout_enemy', icon: '🔭', title: 'Scout Enemy Territory', desc: 'Send a noble to spy on enemy movements.', urgency: 'high', cat: 'military' });
        }

        // PLAGUE directives
        if (plagueCount > 0) {
            suggestions.push({ id: 'plague_response', icon: '🏥', title: 'Combat the Plague', desc: 'Order medical supplies delivered to ' + plagueCount + ' afflicted town' + (plagueCount > 1 ? 's' : '') + '.', urgency: 'critical', cat: 'welfare' });
            suggestions.push({ id: 'quarantine_towns', icon: '🚧', title: 'Enforce Quarantine', desc: 'Order quarantine measures to contain the spread.', urgency: 'high', cat: 'welfare' });
        }

        // FOOD SHORTAGE directives
        if (foodShortage) {
            suggestions.push({ id: 'food_relief', icon: '🌾', title: 'Emergency Food Relief', desc: 'Order grain delivered to starving towns.', urgency: 'critical', cat: 'economy' });
        }

        // LOW HAPPINESS directives
        if (lowHappinessTowns.length > 0) {
            var unhappyNames = lowHappinessTowns.slice(0, 3).map(function(t) { return t.name; }).join(', ');
            suggestions.push({ id: 'quell_unrest', icon: '🕊️', title: 'Quell Unrest', desc: 'Order a noble to restore order in ' + unhappyNames + '.', urgency: 'high', cat: 'welfare' });
            suggestions.push({ id: 'distribute_gold', icon: '💰', title: 'Distribute Royal Aid', desc: 'Send gold from the treasury to help struggling towns.', urgency: 'normal', cat: 'economy' });
        }

        // LOW TREASURY directives
        if (treasury < 5000) {
            suggestions.push({ id: 'collect_taxes', icon: '💰', title: 'Special Tax Collection', desc: 'Order nobles to collect extra taxes from their provinces.', urgency: 'high', cat: 'economy' });
            suggestions.push({ id: 'trade_expedition', icon: '🐪', title: 'Royal Trade Expedition', desc: 'Commission a noble to trade on behalf of the crown.', urgency: 'normal', cat: 'economy' });
        }

        // INFRASTRUCTURE (always relevant)
        suggestions.push({ id: 'build_roads', icon: '🛤️', title: 'Improve Roads', desc: 'Order road improvements between key towns.', urgency: 'normal', cat: 'infrastructure' });
        suggestions.push({ id: 'build_buildings', icon: '🏗️', title: 'Kingdom Construction', desc: 'Order construction of needed buildings in towns.', urgency: 'normal', cat: 'infrastructure' });

        // DIPLOMACY (peacetime)
        if (!atWar) {
            suggestions.push({ id: 'diplomatic_mission', icon: '📜', title: 'Diplomatic Mission', desc: 'Send a noble as envoy to a neighboring kingdom.', urgency: 'normal', cat: 'diplomacy' });
            suggestions.push({ id: 'trade_agreement', icon: '🤝', title: 'Negotiate Trade Agreement', desc: 'Order a noble to establish trade relations.', urgency: 'normal', cat: 'diplomacy' });
        }

        // SECURITY (always)
        suggestions.push({ id: 'suppress_smuggling', icon: '🔍', title: 'Suppress Smuggling Ring', desc: 'Order investigation of reported smuggling activity.', urgency: 'normal', cat: 'security' });
        suggestions.push({ id: 'capture_criminal', icon: '🎯', title: 'Capture Wanted Criminal', desc: 'Issue a bounty for the capture of a known criminal.', urgency: 'normal', cat: 'security' });

        // Sort by urgency
        var urgencyOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        suggestions.sort(function(a, b) { return (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2); });

        // Render
        html += '<div style="background:rgba(44,62,80,0.15);border:1px solid rgba(212,168,67,0.3);border-radius:6px;padding:8px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">📜 Issue Royal Directives</div>';
        html += '<div style="font-size:0.68rem;color:#aaa;margin-bottom:8px;">As ruler, you can issue directives to your nobles. Select a task and assign it.</div>';

        // Show currently issued directives
        if (issuedDirectives.length > 0) {
            html += '<div style="margin-bottom:8px;">';
            html += '<div style="font-size:0.75rem;color:#5dade2;margin-bottom:4px;">⚡ Active Royal Orders (' + issuedDirectives.length + ')</div>';
            for (var _adi = 0; _adi < issuedDirectives.length; _adi++) {
                var _ad = issuedDirectives[_adi];
                var _adNoble = null;
                try { _adNoble = Engine.findPerson(_ad.assigneeId); } catch (e) {}
                var _adDaysLeft = Math.max(0, (_ad.deadlineDay || 0) - day);
                html += '<div style="background:rgba(0,0,0,0.15);padding:5px 6px;border-radius:4px;margin-bottom:3px;font-size:0.72rem;">';
                html += '<div style="color:#ccc;">' + (_ad.icon || '📜') + ' ' + escapeHtml(_ad.title || 'Directive') + '</div>';
                html += '<div style="color:#888;">Assigned to: ' + (_adNoble ? _adNoble.firstName + ' ' + _adNoble.lastName : 'Unknown') + ' — ' + _adDaysLeft + 'd left';
                if (_ad.progress) html += ' — ' + Math.round(_ad.progress) + '% done';
                html += '</div></div>';
            }
            html += '</div>';
        }

        // Available directives to issue
        html += '<div style="max-height:300px;overflow-y:auto;">';
        for (var _si = 0; _si < suggestions.length; _si++) {
            var _s = suggestions[_si];
            var urgColor = _s.urgency === 'critical' ? '#c44e52' : _s.urgency === 'high' ? '#e67e22' : '#5dade2';
            var urgLabel = _s.urgency === 'critical' ? '⚠️ CRITICAL' : _s.urgency === 'high' ? '🔶 HIGH' : '🔵 Normal';
            var catColors = { military: '#c44e52', welfare: '#55a868', economy: '#d4a843', infrastructure: '#5dade2', diplomacy: '#9b59b6', security: '#e67e22' };
            var catColor = catColors[_s.cat] || '#aaa';

            html += '<div style="background:rgba(0,0,0,0.12);border:1px solid rgba(255,255,255,0.08);border-left:3px solid ' + urgColor + ';padding:6px 8px;border-radius:4px;margin-bottom:4px;">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<div style="flex:1;">';
            html += '<div style="font-size:0.78rem;color:#ddd;">' + _s.icon + ' ' + _s.title + ' <span style="font-size:0.6rem;color:' + catColor + ';text-transform:uppercase;">' + _s.cat + '</span></div>';
            html += '<div style="font-size:0.65rem;color:#999;">' + _s.desc + '</div>';
            html += '<div style="font-size:0.6rem;color:' + urgColor + ';margin-top:2px;">' + urgLabel + '</div>';
            html += '</div>';
            html += '<button class="btn-medieval" data-action="kingIssueDirective" data-id="' + _s.id + '" data-kingdom="' + kingdom.id + '" style="font-size:0.65rem;padding:3px 8px;flex-shrink:0;margin-left:6px;">📜 Issue</button>';
            html += '</div></div>';
        }
        html += '</div>';

        // Noble count for context
        if (nobles.length === 0) {
            html += '<div style="font-size:0.72rem;color:#c44e52;margin-top:6px;">⚠️ No nobles available to assign directives to.</div>';
        } else {
            html += '<div style="font-size:0.68rem;color:#888;margin-top:6px;">' + nobles.length + ' noble' + (nobles.length > 1 ? 's' : '') + ' available for assignment.</div>';
        }

        html += '</div>';
        return html;
    }

    // Handle issuing a directive — show noble selection
    function _kingIssueDirectiveUI(directiveId, kingdomId) {
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch (e) {}
        if (!kingdom) { toast('Kingdom not found.', 'error'); return; }

        // Find eligible nobles
        var nobles = [];
        try {
            var allPeople = Engine.getPeople ? Engine.getPeople() : [];
            for (var _ni = 0; _ni < allPeople.length; _ni++) {
                var _np = allPeople[_ni];
                if (!_np.alive || !_np.socialRank) continue;
                var _npRank = 0;
                if (typeof _np.socialRank === 'object') _npRank = _np.socialRank[kingdom.id] || 0;
                else if (typeof _np.socialRank === 'number') _npRank = _np.socialRank;
                if (_npRank >= 4) {
                    // Check if already on a directive
                    var _busy = false;
                    var issued = kingdom._kingDirectives || [];
                    for (var _bi = 0; _bi < issued.length; _bi++) {
                        if (issued[_bi].assigneeId === _np.id) { _busy = true; break; }
                    }
                    nobles.push({ person: _np, rank: _npRank, busy: _busy });
                }
            }
        } catch (e) {}

        nobles.sort(function(a, b) { return b.rank - a.rank; });

        // Build the directive info
        var directives = {
            supply_warfront: { icon: '⚔️', title: 'Supply the War Effort', days: 30, reward: 'Military supplies delivered' },
            recruit_soldiers: { icon: '🛡️', title: 'Recruit Soldiers', days: 20, reward: 'New troops recruited' },
            fortify_border: { icon: '🏰', title: 'Fortify Border Towns', days: 25, reward: 'Defenses strengthened' },
            scout_enemy: { icon: '🔭', title: 'Scout Enemy Territory', days: 15, reward: 'Intelligence gathered' },
            plague_response: { icon: '🏥', title: 'Combat the Plague', days: 20, reward: 'Medical aid delivered' },
            quarantine_towns: { icon: '🚧', title: 'Enforce Quarantine', days: 15, reward: 'Quarantine enforced' },
            food_relief: { icon: '🌾', title: 'Emergency Food Relief', days: 15, reward: 'Famine averted' },
            quell_unrest: { icon: '🕊️', title: 'Quell Unrest', days: 20, reward: 'Happiness +10 in target towns' },
            distribute_gold: { icon: '💰', title: 'Distribute Royal Aid', days: 10, reward: 'Happiness boost, costs 500g' },
            collect_taxes: { icon: '💰', title: 'Special Tax Collection', days: 20, reward: 'Extra revenue collected' },
            trade_expedition: { icon: '🐪', title: 'Royal Trade Expedition', days: 30, reward: 'Trade profits for treasury' },
            build_roads: { icon: '🛤️', title: 'Improve Roads', days: 25, reward: 'Faster trade routes' },
            build_buildings: { icon: '🏗️', title: 'Kingdom Construction', days: 30, reward: 'New buildings constructed' },
            diplomatic_mission: { icon: '📜', title: 'Diplomatic Mission', days: 20, reward: 'Improved foreign relations' },
            trade_agreement: { icon: '🤝', title: 'Negotiate Trade Agreement', days: 15, reward: 'Trade benefits' },
            suppress_smuggling: { icon: '🔍', title: 'Suppress Smuggling Ring', days: 20, reward: 'Crime reduced, contraband seized' },
            capture_criminal: { icon: '🎯', title: 'Capture Wanted Criminal', days: 15, reward: 'Criminal captured, justice served' }
        };

        var dir = directives[directiveId] || { icon: '📜', title: directiveId, days: 20, reward: 'Task completed' };

        var html = '<div style="padding:8px;">';
        html += '<div style="text-align:center;margin-bottom:12px;">';
        html += '<div style="font-size:1.2em;">' + dir.icon + '</div>';
        html += '<div style="font-size:0.9rem;color:#d4a843;font-weight:bold;">' + dir.title + '</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;">Duration: ' + dir.days + ' days | Outcome: ' + dir.reward + '</div>';
        html += '</div>';

        html += '<div style="font-size:0.8rem;color:#ddd;margin-bottom:8px;">Select a noble to carry out this directive:</div>';

        if (nobles.length === 0) {
            html += '<div style="color:#c44e52;font-size:0.78rem;">No eligible nobles found.</div>';
        } else {
            html += '<div style="max-height:250px;overflow-y:auto;">';
            for (var _ni2 = 0; _ni2 < nobles.length; _ni2++) {
                var _nb = nobles[_ni2];
                var _nbP = _nb.person;
                var _nbRankName = _nb.rank >= 6 ? 'Royal Advisor' : _nb.rank >= 5 ? 'Lord' : 'Minor Noble';
                var _nbTown = _nbP.townId ? Engine.findTown(_nbP.townId) : null;
                var _nbRel = Player.getRelationship ? Player.getRelationship(_nbP.id) : { level: 0 };
                var _nbRelLvl = _nbRel.level || 0;
                var _relColor = _nbRelLvl >= 60 ? '#55a868' : _nbRelLvl >= 30 ? '#ccb974' : '#c44e52';
                var _disabled = _nb.busy;

                html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 6px;margin-bottom:3px;background:rgba(0,0,0,0.15);border-radius:4px;' + (_disabled ? 'opacity:0.5;' : '') + '">';
                html += '<div>';
                html += '<div style="font-size:0.78rem;color:#ddd;">' + (_nbP.firstName || '') + ' ' + (_nbP.lastName || '') + ' <span style="font-size:0.65rem;color:#888;">' + _nbRankName + '</span></div>';
                html += '<div style="font-size:0.65rem;color:#888;">' + (_nbTown ? _nbTown.name : '?') + ' | Rel: <span style="color:' + _relColor + ';">' + Math.floor(_nbRelLvl) + '</span></div>';
                html += '</div>';
                if (_disabled) {
                    html += '<span style="font-size:0.65rem;color:#e67e22;">Already assigned</span>';
                } else {
                    html += '<button class="btn-medieval" data-action="kingConfirmDirective" data-id="' + directiveId + '" data-kingdom="' + kingdom.id + '" data-val="' + _nbP.id + '" style="font-size:0.65rem;padding:3px 8px;">📜 Assign</button>';
                }
                html += '</div>';
            }
            html += '</div>';
        }

        html += '</div>';
        openModal(dir.icon + ' Issue Directive', html, '<button class="btn-medieval" data-action="openKingPanel" data-id="nobility">Cancel</button>');
    }

    // Confirm and issue the directive
    function _kingConfirmDirective(directiveId, kingdomId, nobleId) {
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch (e) {}
        if (!kingdom) { toast('Kingdom not found.', 'error'); return; }
        var noble = null;
        try { noble = Engine.findPerson(nobleId); } catch (e) {}
        if (!noble) { toast('Noble not found.', 'error'); return; }

        var day = 0;
        try { day = Engine.getDay(); } catch (e) {}

        var dirInfo = {
            supply_warfront: { icon: '⚔️', title: 'Supply the War Effort', days: 30 },
            recruit_soldiers: { icon: '🛡️', title: 'Recruit Soldiers', days: 20 },
            fortify_border: { icon: '🏰', title: 'Fortify Border Towns', days: 25 },
            scout_enemy: { icon: '🔭', title: 'Scout Enemy Territory', days: 15 },
            plague_response: { icon: '🏥', title: 'Combat the Plague', days: 20 },
            quarantine_towns: { icon: '🚧', title: 'Enforce Quarantine', days: 15 },
            food_relief: { icon: '🌾', title: 'Emergency Food Relief', days: 15 },
            quell_unrest: { icon: '🕊️', title: 'Quell Unrest', days: 20 },
            distribute_gold: { icon: '💰', title: 'Distribute Royal Aid', days: 10 },
            collect_taxes: { icon: '💰', title: 'Special Tax Collection', days: 20 },
            trade_expedition: { icon: '🐪', title: 'Royal Trade Expedition', days: 30 },
            build_roads: { icon: '🛤️', title: 'Improve Roads', days: 25 },
            build_buildings: { icon: '🏗️', title: 'Kingdom Construction', days: 30 },
            diplomatic_mission: { icon: '📜', title: 'Diplomatic Mission', days: 20 },
            trade_agreement: { icon: '🤝', title: 'Negotiate Trade Agreement', days: 15 },
            suppress_smuggling: { icon: '🔍', title: 'Suppress Smuggling Ring', days: 20 },
            capture_criminal: { icon: '🎯', title: 'Capture Wanted Criminal', days: 15 }
        };
        var dir = dirInfo[directiveId] || { icon: '📜', title: directiveId, days: 20 };

        if (!kingdom._kingDirectives) kingdom._kingDirectives = [];
        kingdom._kingDirectives.push({
            id: directiveId + '_' + day,
            directiveType: directiveId,
            icon: dir.icon,
            title: dir.title,
            assigneeId: nobleId,
            issuedDay: day,
            deadlineDay: day + dir.days,
            progress: 0,
            status: 'active'
        });

        // Affect noble relationship (slight resentment from orders, mitigated by high relationship)
        if (Player.modifyRelationship) {
            var relChange = -2; // slight cost of commanding
            Player.modifyRelationship(nobleId, relChange);
        }

        var nobleName = noble.firstName + ' ' + noble.lastName;
        Engine.logEvent('📜 ' + (Player.state.sex === 'F' ? 'Queen' : 'King') + ' ' + Player.state.fullName + ' has ordered ' + nobleName + ' to ' + dir.title.toLowerCase() + '.');
        toast('📜 ' + nobleName + ' has been assigned: ' + dir.title, 'success');
        openKingPanel('nobility');
    }

    function _kingNobilityTab(kingdom, ks) {
        var html = '';
        var p = Player.state;
        var citizenKingdomId = kingdom.id;
        var day = 0;
        try { day = Engine.getDay(); } catch (e) {}
        var kingdoms = [];
        try { kingdoms = Engine.getKingdoms ? Engine.getKingdoms() : []; } catch (e) {}

        // ── LORDSHIP ──
        var lordTownId = p.lordTownId || null;
        var lordTown = lordTownId ? Engine.findTown(lordTownId) : null;
        if (lordTown) {
            html += '<div style="background:rgba(0,0,0,0.15);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:8px;margin-bottom:8px;">';
            html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">🏰 Your Lordship</div>';
            html += '<div style="font-size:0.78rem;color:#ccc;">';
            html += '<div style="margin-bottom:3px;"><strong>Lord of:</strong> ' + lordTown.name + '</div>';
            html += '<div style="margin-bottom:3px;"><strong>Population:</strong> ' + (lordTown.population || '?') + '</div>';
            html += '<div style="margin-bottom:3px;"><strong>Prosperity:</strong> ' + Math.floor(lordTown.prosperity || 0) + '</div>';
            html += '</div></div>';
        }

        // ── STANDING & REPUTATION ──
        html += '<div style="background:rgba(0,0,0,0.15);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:8px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">📊 Standing & Reputation</div>';
        for (var _rki = 0; _rki < kingdoms.length; _rki++) {
            var _rkk = kingdoms[_rki];
            var _rkRep = Player.reputation ? (Player.reputation[_rkk.id] || 0) : 0;
            var _rkRank = (Player.socialRank && Player.socialRank[_rkk.id]) || 0;
            if (_rkRank === 0 && _rkRep === 0) continue;
            var _rkDef = CONFIG.SOCIAL_RANKS[_rkRank] || CONFIG.SOCIAL_RANKS[0];
            var _isHome = _rkk.id === citizenKingdomId;
            html += '<div style="margin-bottom:5px;' + (_isHome ? 'border-left:3px solid #d4a843;padding-left:8px;' : '') + '">';
            html += '<div style="font-size:0.75rem;color:#d4c9a0;">' + (_rkDef.icon || '') + ' ' + _rkk.name + ' — ' + (_rkDef.name || 'Peasant') + (_isHome ? ' <span style="color:#d4a843;font-size:0.68rem;">(Home)</span>' : '') + '</div>';
            html += '<div style="height:5px;background:rgba(0,0,0,0.3);border-radius:3px;margin-top:2px;"><div style="height:100%;width:' + Math.min(100, Math.max(0, _rkRep)) + '%;background:' + (_rkRep >= 80 ? '#55a868' : _rkRep >= 50 ? '#ccb974' : '#c44e52') + ';border-radius:3px;"></div></div>';
            html += '<div style="font-size:0.65rem;color:#777;margin-top:1px;">Rep: ' + Math.floor(_rkRep) + '/100</div>';
            html += '</div>';
        }
        html += '</div>';

        // ── NOBLE PRIVILEGES ──
        var rankDef = CONFIG.SOCIAL_RANKS[7] || CONFIG.SOCIAL_RANKS[6] || {};
        html += '<div style="background:rgba(0,0,0,0.15);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:8px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:4px;">🏅 Royal Privileges</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:0.72rem;">';
        html += '<div style="color:#aaa;">Tax Status:</div><div style="color:#55a868;">Exempt from all taxes</div>';
        html += '<div style="color:#aaa;">Criminal Immunity:</div><div style="color:#55a868;">Full (entire kingdom)</div>';
        html += '<div style="color:#aaa;">Max Workers:</div><div>∞</div>';
        html += '<div style="color:#aaa;">Max Buildings:</div><div>∞</div>';
        html += '<div style="color:#aaa;">Max Land:</div><div>∞</div>';
        html += '</div></div>';

        // ── KINGDOM NOBLES ──
        html += '<div style="background:rgba(0,0,0,0.15);border:1px solid rgba(212,168,67,0.2);border-radius:6px;padding:8px;margin-bottom:8px;">';
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">🏛️ Kingdom Nobles</div>';
        try {
            var _allPeople = typeof Engine.getPeople === 'function' ? Engine.getPeople() : [];
            var _nobles = [];
            for (var _ni = 0; _ni < _allPeople.length; _ni++) {
                var _np = _allPeople[_ni];
                if (!_np.socialRank || !_np.alive) continue;
                var _npRank = 0;
                if (typeof _np.socialRank === 'object') {
                    _npRank = _np.socialRank[citizenKingdomId] || 0;
                } else if (typeof _np.socialRank === 'number') {
                    _npRank = _np.socialRank;
                }
                if (_npRank >= 4) _nobles.push({ person: _np, rank: _npRank });
            }
            _nobles.sort(function(a, b) {
                if (b.rank !== a.rank) return b.rank - a.rank;
                return (a.person.firstName || '').localeCompare(b.person.firstName || '');
            });
            if (_nobles.length === 0) {
                html += '<div style="font-size:0.75rem;color:#888;">No nobles found in this kingdom.</div>';
            } else {
                html += '<div style="max-height:250px;overflow-y:auto;">';
                for (var _nbi = 0; _nbi < _nobles.length; _nbi++) {
                    var _nb = _nobles[_nbi];
                    var _nbPerson = _nb.person;
                    var _nbRankDef = CONFIG.SOCIAL_RANKS[_nb.rank] || CONFIG.SOCIAL_RANKS[4];
                    var _nbRel = Player.getRelationship ? Player.getRelationship(_nbPerson.id) : { level: 0 };
                    var _nbRelLvl = _nbRel.level || 0;
                    var _nbRelColor = _nbRelLvl >= 60 ? '#55a868' : _nbRelLvl >= 30 ? '#ccb974' : _nbRelLvl >= 0 ? '#aaa' : '#c44e52';
                    var _nbTown = _nbPerson.townId ? Engine.findTown(_nbPerson.townId) : null;
                    var _sameLocation = _nbPerson.townId === Player.townId;
                    var _nbSafeId = String(_nbPerson.id).replace(/'/g, "\\'");
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 6px;margin-bottom:3px;background:rgba(0,0,0,0.1);border-radius:4px;border-left:3px solid ' + (_sameLocation ? '#d4a843' : 'transparent') + ';">';
                    html += '<div style="flex:1;min-width:0;cursor:pointer;" data-action="closeAndShowPerson" data-id="' + _nbSafeId + '" title="View details">';
                    html += '<div style="font-size:0.75rem;color:#d4c9a0;">' + (_nbRankDef.icon || '👑') + ' ' + (_nbPerson.firstName || '') + ' ' + (_nbPerson.lastName || '') + '</div>';
                    html += '<div style="font-size:0.65rem;color:#888;">' + (_nbRankDef.name || 'Noble');
                    if (_nbTown) html += ' — ' + _nbTown.name;
                    if (_sameLocation) html += ' <span style="color:#d4a843;">📍 Here</span>';
                    html += '</div>';
                    html += '<div style="font-size:0.62rem;color:' + _nbRelColor + ';">Rel: ' + Math.floor(_nbRelLvl) + '</div>';
                    html += '</div>';
                    if (_sameLocation) {
                        html += '<div style="display:flex;gap:3px;flex-shrink:0;">';
                        html += '<button class="btn-medieval" data-action="interactNPCSmallTalk" data-id="' + _nbSafeId + '" style="font-size:0.6rem;padding:2px 5px;" title="Small Talk">💬</button>';
                        html += '<button class="btn-medieval" data-action="closeAndGift" data-id="' + _nbSafeId + '" style="font-size:0.6rem;padding:2px 5px;" title="Give Gift">🎁</button>';
                        html += '</div>';
                    }
                    html += '</div>';
                }
                html += '</div>';
            }
        } catch (e) {
            html += '<div style="font-size:0.75rem;color:#888;">Could not load nobles list.</div>';
        }
        html += '</div>';

        // ── NOBLE AGENTS ──
        try {
            var agentData = Player.getAgentData ? Player.getAgentData() : null;
            if (agentData && agentData.agents && agentData.agents.length > 0) {
                html += '<div style="background:rgba(44,62,80,0.15);border:1px solid rgba(155,89,182,0.3);border-radius:6px;padding:8px;margin-bottom:8px;">';
                html += '<div style="font-size:0.85rem;color:#9b59b6;margin-bottom:4px;">🕵️ Agents (' + agentData.agents.length + '/' + agentData.maxAgents + ')</div>';
                for (var _ai = 0; _ai < agentData.agents.length; _ai++) {
                    var _ag = agentData.agents[_ai];
                    var _agStatus = _ag.status || 'idle';
                    var _agColor = _agStatus === 'active' ? '#55a868' : _agStatus === 'returning' ? '#e67e22' : '#aaa';
                    html += '<div style="font-size:0.72rem;padding:3px 0;color:#ccc;">';
                    html += '🕵️ ' + (_ag.name || 'Agent') + ' — <span style="color:' + _agColor + ';">' + _agStatus + '</span>';
                    if (_ag.mission) html += ' <span style="color:#888;">(' + _ag.mission + ')</span>';
                    html += '</div>';
                }
                html += '<button class="btn-medieval" data-action="closeAndOpenNobilityDialog" style="font-size:0.7rem;padding:3px 8px;margin-top:4px;">📋 Manage Agents</button>';
                html += '</div>';
            }
        } catch (e) { /* ignore */ }

        // ── ASSIGN ROYAL DIRECTIVES ──
        html += _kingAssignDirectivesSection(kingdom);

        // ── COUNCIL VOTES ──
        var _activeVotes = [];
        try { _activeVotes = Engine.getActiveVotes ? Engine.getActiveVotes() : []; } catch (e) {}
        if (_activeVotes.length > 0) {
            html += '<div style="background:rgba(100,50,200,0.1);border:1px solid rgba(150,100,255,0.3);border-radius:6px;padding:8px;margin-bottom:8px;">';
            html += '<div style="font-size:0.85rem;color:#c8a0ff;margin-bottom:4px;">🗳️ Active Council Votes (' + _activeVotes.length + ')</div>';
            for (var _avi = 0; _avi < _activeVotes.length; _avi++) {
                var _av = _activeVotes[_avi];
                var _avDays = Math.max(0, (_av.deadlineDay || 0) - day);
                html += '<button class="btn-medieval" data-action="openVotingDialog" data-id="' + _av.id + '" style="display:block;width:100%;text-align:left;padding:5px 8px;margin-bottom:3px;font-size:0.72rem;">';
                html += '📜 ' + escapeHtml(_av.title || 'Decision') + ' <span style="color:#aaa;font-size:0.65rem;">(' + _avDays + 'd left)</span>';
                html += '</button>';
            }
            html += '</div>';
        }

        // ── ROYAL FEASTS ──
        var _activeFeast = null;
        try { _activeFeast = Engine.getActiveFeast ? Engine.getActiveFeast(citizenKingdomId) : null; } catch (e) {}
        if (_activeFeast) {
            var _feastDaysLeft = Math.max(0, (_activeFeast.endDay || 0) - day);
            var _feastTownName = '';
            try { var _fTown = Engine.findTown(_activeFeast.townId); _feastTownName = _fTown ? _fTown.name : ''; } catch (e) {}
            var _playerAtFeast = Player.townId === _activeFeast.townId && !Player.traveling;
            html += '<div style="background:rgba(200,150,50,0.1);border:1px solid rgba(200,150,50,0.3);border-radius:6px;padding:8px;margin-bottom:8px;">';
            html += '<div style="font-size:0.85rem;color:#f0c040;margin-bottom:4px;">🎪 Royal Feast</div>';
            html += '<div style="font-size:0.72rem;color:#ccc;">Feast in <strong>' + escapeHtml(_feastTownName) + '</strong> — ' + _feastDaysLeft + ' day' + (_feastDaysLeft !== 1 ? 's' : '') + ' left</div>';
            if (_playerAtFeast) {
                html += '<button class="btn-medieval" data-action="openFeastDialog" data-id="' + citizenKingdomId + '" style="font-size:0.72rem;padding:4px 10px;margin-top:4px;">🍷 Attend Feast</button>';
            } else {
                html += '<div style="font-size:0.68rem;color:#e67e22;margin-top:3px;">📍 Travel to ' + escapeHtml(_feastTownName) + ' to attend.</div>';
            }
            html += '</div>';
        }

        return html;
    }

    function _confirmKingFlee() {
        var html = '<div style="text-align:center;padding:10px;">';
        html += '<div style="font-size:1rem;color:#c44e52;margin-bottom:10px;">⚠️ Are you absolutely sure?</div>';
        html += '<div style="font-size:0.8rem;color:#ddd;margin-bottom:12px;">You will abandon your crown and everything you\'ve built. There is no going back.</div>';
        html += '<div style="display:flex;gap:8px;justify-content:center;">';
        html += '<button class="btn-medieval" data-action="kingFleeConfirm" style="background:rgba(196,78,82,0.4) !important;border-color:rgba(196,78,82,0.6) !important;">💨 Yes, Flee!</button>';
        html += '<button class="btn-medieval" data-action="openKingPanel" data-id="threats">Cancel</button>';
        html += '</div></div>';
        openModal('💨 Confirm Escape', html, '');
    }

    function _showRevoltUI(kingdom, intensity) {
        if (!kingdom) return;
        // Pause the game
        if (typeof Game !== 'undefined' && Game.pause) Game.pause();

        var fightChance = Math.round(Math.max(10, Math.min(80, 60 - intensity * 40)));
        var html = '<div style="text-align:center;font-family:\'Merriweather\',Georgia,serif;">';
        html += '<div style="font-size:1.2rem;color:#c44e52;margin-bottom:10px;">⚔️ REVOLUTION!</div>';
        html += '<div style="font-size:0.85rem;color:#ddd;margin-bottom:12px;">The people of ' + kingdom.name + ' have risen against you! Rebels storm the palace.</div>';
        html += '<div style="font-size:0.8rem;color:#aaa;margin-bottom:15px;">You must decide your fate:</div>';

        // Fight
        html += '<div style="background:rgba(196,78,82,0.15);border:1px solid rgba(196,78,82,0.3);border-radius:8px;padding:10px;margin-bottom:8px;">';
        html += '<button class="btn-medieval" data-action="_resolveRevolt" data-id="' + kingdom.id + '" data-val="fight" style="width:100%;font-size:0.85rem;padding:8px;background:rgba(196,78,82,0.3) !important;border-color:rgba(196,78,82,0.5) !important;">⚔️ Fight the Rebels</button>';
        html += '<div style="font-size:0.7rem;color:#c44e52;margin-top:4px;">Survival chance: ~' + fightChance + '%. If you win, the rebellion is crushed. If you lose, you die.</div>';
        html += '</div>';

        // Flee
        html += '<div style="background:rgba(139,69,19,0.15);border:1px solid rgba(139,69,19,0.3);border-radius:8px;padding:10px;margin-bottom:8px;">';
        html += '<button class="btn-medieval" data-action="_resolveRevolt" data-id="' + kingdom.id + '" data-val="flee" style="width:100%;font-size:0.85rem;padding:8px;background:rgba(139,69,19,0.3) !important;border-color:rgba(139,69,19,0.5) !important;">💨 Flee the Kingdom</button>';
        html += '<div style="font-size:0.7rem;color:#d4a843;margin-top:4px;">Guaranteed survival. You lose everything and start a new life under a false name with 50g.</div>';
        html += '</div>';

        // Surrender
        html += '<div style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px;">';
        html += '<button class="btn-medieval" data-action="_resolveRevolt" data-id="' + kingdom.id + '" data-val="surrender" style="width:100%;font-size:0.85rem;padding:8px;">🏳️ Surrender</button>';
        html += '<div style="font-size:0.7rem;color:#888;margin-top:4px;">Game over. The rebels execute you publicly.</div>';
        html += '</div>';

        html += '</div>';
        openModal('⚔️ Revolution!', html, '');
    }

    function _resolveRevolt(kingdomId, choice) {
        closeModal();
        var kingdom = Engine.findKingdom(kingdomId);
        if (kingdom) kingdom._playerRevoltPending = null;

        if (choice === 'flee') {
            Player.kingFleeKingdom();
            toast('💨 You fled into the night...', 'warning', 'critical');
        } else if (choice === 'surrender') {
            Player.state.deathCause = 'executed by rebels';
            Player.state.isKing = false;
            Player.state.alive = false;
            Engine.logEvent('💀 ' + Player.state.fullName + ' surrendered and was executed by the rebels.');
            if (Player.handlePlayerDeath) Player.handlePlayerDeath();
        } else if (choice === 'fight') {
            var rng = Engine.getRng();
            var intensity = kingdom && kingdom._lastRevoltIntensity ? kingdom._lastRevoltIntensity : 0.5;
            var surviveChance = Math.max(0.1, Math.min(0.8, 0.6 - intensity * 0.4));
            if (rng.chance(surviveChance)) {
                // Victory!
                if (kingdom) {
                    kingdom.happiness = Math.min(100, (kingdom.happiness || 50) + 10);
                }
                Engine.logEvent('⚔️ ' + Player.state.fullName + ' crushed the rebellion! The crown is secure.');
                toast('⚔️ You crushed the rebellion!', 'success', 'critical');
            } else {
                // Defeated
                Player.state.deathCause = 'killed in revolt';
                Player.state.isKing = false;
                Player.state.alive = false;
                Engine.logEvent('💀 ' + Player.state.fullName + ' was killed fighting the rebels.');
                if (Player.handlePlayerDeath) Player.handlePlayerDeath();
            }
        }
        // Resume game
        if (typeof Game !== 'undefined' && Game.resume) Game.resume();
    }

    // Election UI — shown when king dies with no blood heir and player is a noble
    function showElectionUI(kingdom, candidates, playerAdvisorId) {
        if (!kingdom) return;
        var html = '<div style="font-family:\'Merriweather\',Georgia,serif;">';
        html += '<div style="text-align:center;background:rgba(0,0,0,0.3);padding:8px;border-radius:6px;margin-bottom:10px;">';
        html += '<div style="font-size:1rem;color:#d4a843;">👑 Succession Election</div>';
        html += '<div style="font-size:0.8rem;color:#ddd;">The king of ' + kingdom.name + ' has died with no blood heir.</div>';
        html += '<div style="font-size:0.75rem;color:#aaa;">The nobles must vote for a new ruler.</div>';
        html += '</div>';

        html += '<div style="max-height:300px;overflow-y:auto;">';
        for (var _ei = 0; _ei < candidates.length; _ei++) {
            var _ec = candidates[_ei];
            var _ecPerson = Engine.findPerson(_ec.id);
            if (!_ecPerson) continue;
            var _ecRank = (_ecPerson.socialRank && _ecPerson.socialRank[kingdom.id]) || 0;
            var rankName = _ecRank >= 6 ? 'Royal Advisor' : _ecRank >= 5 ? 'Lord' : 'Noble';
            var _isPlayer = _ec.id === playerAdvisorId;

            html += '<div style="background:rgba(0,0,0,' + (_isPlayer ? '0.3' : '0.15') + ');padding:8px;border-radius:6px;margin-bottom:4px;border:1px solid ' + (_isPlayer ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.1)') + ';">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<div>';
            html += '<span style="font-size:0.8rem;color:' + (_isPlayer ? '#d4a843' : '#d4c9a0') + ';">' + (_isPlayer ? '⭐ ' : '') + (_ecPerson.firstName || '') + ' ' + (_ecPerson.lastName || '') + '</span>';
            html += '<span style="font-size:0.68rem;color:#888;margin-left:6px;">' + rankName + '</span>';
            html += '</div>';
            html += '<button class="btn-medieval" data-action="kingElectionVote" data-kingdom="' + kingdom.id + '" data-id="' + _ec.id + '" style="font-size:0.68rem;padding:3px 10px;">Vote</button>';
            html += '</div>';
            // Score display
            html += '<div style="font-size:0.65rem;color:#888;margin-top:3px;">Influence: Rank ' + _ecRank + ' | Gold: ' + formatGold(_ecPerson.gold || 0) + '</div>';
            html += '</div>';
        }
        html += '</div>';

        html += '</div>';
        openModal('👑 Royal Election', html, '<button class="btn-medieval" data-action="kingElectionAbstain" data-kingdom="' + kingdom.id + '">Abstain</button>');
    }
    // Register functions on UI namespace
    UI.showKingButton = showKingButton;
    UI.hideKingButton = hideKingButton;
    UI.openKingPanel = openKingPanel;
    UI.showElectionUI = showElectionUI;
    UI._confirmKingFlee = _confirmKingFlee;
    UI._showRevoltUI = _showRevoltUI;
    UI._resolveRevolt = _resolveRevolt;
    // Shared Send Army modal builder — used by both _openSendArmyModal and kingSendArmyToTown
    function _buildSendArmyModal(townId) {
        var tgt = Engine.findTown(townId);
        var garrison = tgt ? (tgt.garrison || 0) : 0;
        var kingdom = null;
        try { if (Player.state && Player.state.kingState) kingdom = Engine.findKingdom(Player.state.kingState.kingdomId); } catch(e) {}
        if (!kingdom) { UI.toast('Not king.', 'error'); return; }

        // Gather all kingdom towns with garrison info
        var kTowns = [];
        var totalAvailable = 0;
        try {
            var allTowns = Engine.getTowns ? Engine.getTowns() : [];
            for (var i = 0; i < allTowns.length; i++) {
                if (allTowns[i].kingdomId === kingdom.id) {
                    var avail = Math.max(0, (allTowns[i].garrison || 0) - 5);
                    kTowns.push({ id: allTowns[i].id, name: allTowns[i].name, garrison: allTowns[i].garrison || 0, available: avail, isCapital: !!allTowns[i].isCapital, x: allTowns[i].x, y: allTowns[i].y, isPort: !!allTowns[i].isPort });
                    totalAvailable += avail;
                }
            }
        } catch(e) {}

        // Sort: capital first, then by garrison descending
        kTowns.sort(function(a, b) { if (a.isCapital) return -1; if (b.isCapital) return 1; return b.garrison - a.garrison; });

        // Find default staging town (capital or highest garrison)
        var defaultStaging = kTowns.length > 0 ? kTowns[0].id : '';

        var html = '<div style="padding:10px;">';
        html += '<div style="font-size:1em;color:#c44e52;margin-bottom:6px;font-weight:bold;">⚔️ Send Army to ' + (tgt ? escapeHtml(tgt.name) : '?') + '</div>';
        html += '<div style="font-size:0.78rem;color:#aaa;margin-bottom:8px;">Enemy garrison: <strong style="color:#e57373;">' + garrison + ' defenders</strong></div>';

        // Staging town selector
        html += '<div style="margin-bottom:10px;">';
        html += '<label style="font-size:0.75rem;color:#d4a843;">📍 Staging Town (army departs from here):</label>';
        html += '<select id="_armyStagingTown" style="display:block;width:100%;margin-top:4px;padding:5px;font-size:0.78rem;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:4px;" onchange="UI._updateSendArmyModal(\'' + townId + '\')">';
        for (var ti = 0; ti < kTowns.length; ti++) {
            var kt = kTowns[ti];
            html += '<option value="' + kt.id + '"' + (kt.id === defaultStaging ? ' selected' : '') + '>' + escapeHtml(kt.name) + (kt.isCapital ? ' ★' : '') + ' — ' + kt.garrison + ' garrison (' + kt.available + ' available)</option>';
        }
        html += '</select>';
        html += '</div>';

        // Per-town soldier breakdown
        html += '<div style="background:rgba(0,0,0,0.2);padding:6px;border-radius:5px;margin-bottom:8px;max-height:120px;overflow-y:auto;">';
        html += '<div style="font-size:0.7rem;color:#d4a843;margin-bottom:4px;">🏘️ Available soldiers across kingdom: <strong>' + totalAvailable + '</strong></div>';
        for (var ki = 0; ki < kTowns.length; ki++) {
            var _kt = kTowns[ki];
            if (_kt.available <= 0) continue;
            html += '<div style="display:flex;justify-content:space-between;font-size:0.68rem;color:#bbb;padding:1px 4px;">';
            html += '<span>' + (_kt.isCapital ? '⭐ ' : '') + escapeHtml(_kt.name) + '</span>';
            html += '<span style="color:' + (_kt.available >= 10 ? '#81c784' : '#e0a050') + ';">' + _kt.available + ' soldiers</span>';
            html += '</div>';
        }
        html += '</div>';

        // Route info area (populated by JS on staging town change)
        html += '<div id="_armyRouteInfo" style="font-size:0.72rem;margin-bottom:8px;"></div>';

        // Soldier count
        html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">';
        html += '<label style="font-size:0.75rem;color:#aaa;">Soldiers to send:</label>';
        html += '<input type="number" id="_armySendCount" min="10" max="' + Math.max(10, totalAvailable) + '" value="' + Math.min(30, totalAvailable) + '" style="font-size:0.78rem;width:70px;padding:4px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:4px;" oninput="UI._updateSendArmyModal(\'' + townId + '\')">';
        html += '<span style="font-size:0.68rem;color:#888;">/ ' + totalAvailable + ' max</span>';
        html += '</div>';

        // Success estimate
        html += '<div id="_armyChanceDisplay" style="font-size:0.72rem;margin-bottom:8px;">' + _getSuccessEstimateHtml(Math.min(30, totalAvailable), garrison) + '</div>';

        // Consolidation info
        html += '<div id="_armyConsolidationInfo" style="font-size:0.72rem;margin-bottom:10px;"></div>';

        // Mounted option — check horse availability in kingdom stockpile
        var _totalHorses = 0;
        try {
            var _spk = kingdom.militaryStockpile || {};
            _totalHorses = (_spk.horses || 0);
        } catch(e) {}
        var _mountLimit = _totalHorses;
        html += '<div style="margin-bottom:10px;padding:6px;background:rgba(139,69,19,0.15);border:1px solid rgba(139,69,19,0.3);border-radius:5px;">';
        html += '<label style="font-size:0.75rem;color:#d4a843;display:flex;align-items:center;gap:6px;cursor:pointer;">';
        html += '<input type="checkbox" id="_armyMounted" style="cursor:pointer;"' + (_mountLimit <= 0 ? ' disabled' : '') + '>';
        html += '🐴 Send as Mounted Cavalry (25% faster march)';
        html += '</label>';
        html += '<div style="font-size:0.65rem;color:#999;margin-top:3px;">Kingdom stockpile: ' + _totalHorses + ' horses (' + _mountLimit + ' can mount).</div>';
        if (_mountLimit <= 0) {
            html += '<div style="font-size:0.65rem;color:#e57373;margin-top:2px;">⚠️ Not enough horses in stockpile for mounted army.</div>';
        }
        html += '</div>';

        // Siege supplies: demolition tools + blasting powder
        var _totalDemo = 0, _totalBlast = 0;
        try {
            var _allT = Engine.getTowns ? Engine.getTowns() : [];
            for (var _si2 = 0; _si2 < _allT.length; _si2++) {
                if (_allT[_si2].kingdomId !== kingdom.id) continue;
                _totalDemo += (_allT[_si2].market.supply.demolition_tools || 0);
                _totalBlast += (_allT[_si2].market.supply.blasting_powder || 0);
            }
            var _spk2 = kingdom.militaryStockpile || {};
            _totalDemo += (_spk2.demolition_tools || 0);
            _totalBlast += (_spk2.blasting_powder || 0);
        } catch(e) {}
        html += '<div style="margin-bottom:10px;padding:6px;background:rgba(120,50,20,0.15);border:1px solid rgba(120,50,20,0.3);border-radius:5px;">';
        html += '<div style="font-size:0.75rem;color:#d4a843;margin-bottom:4px;">💥 Siege Supplies <span style="font-size:0.65rem;color:#999;">(damage enemy buildings)</span></div>';
        html += '<div style="display:flex;gap:12px;align-items:center;margin-bottom:4px;">';
        html += '<label style="font-size:0.7rem;color:#bbb;">⛏️ Demolition Tools (max 10):</label>';
        html += '<input type="number" id="_armyDemoTools" min="0" max="' + Math.min(10, _totalDemo) + '" value="0" style="font-size:0.75rem;width:55px;padding:3px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:4px;">';
        html += '<span style="font-size:0.63rem;color:#888;">' + _totalDemo + ' avail (+1% atk each)</span>';
        html += '</div>';
        html += '<div style="display:flex;gap:12px;align-items:center;">';
        html += '<label style="font-size:0.7rem;color:#bbb;">💥 Blasting Powder (max 10):</label>';
        html += '<input type="number" id="_armyBlastPowder" min="0" max="' + Math.min(10, _totalBlast) + '" value="0" style="font-size:0.75rem;width:55px;padding:3px;background:#2a2a2a;color:#ddd;border:1px solid #555;border-radius:4px;">';
        html += '<span style="font-size:0.63rem;color:#888;">' + _totalBlast + ' avail (+2% atk each)</span>';
        html += '</div>';
        html += '</div>';

        // Send button
        html += '<button class="btn-medieval" data-action="kingSendArmyConfirm" data-id="' + townId + '" style="padding:8px 16px;background:rgba(196,78,82,0.3) !important;border:2px solid rgba(196,78,82,0.5) !important;">';
        html += '<div style="font-weight:bold;color:#ef9a9a;">⚔️ Send Army</div></button>';
        html += '</div>';

        openModal('⚔️ Send Army', html, '<button class="btn-medieval" data-action="closeModal">Cancel</button>');

        // Trigger initial route info update
        setTimeout(function() { UI._updateSendArmyModal(townId); }, 50);
    }

    UI._openSendArmyModal = function(townId) { _buildSendArmyModal(townId); };

    // Dynamic update when staging town or soldier count changes
    UI._updateSendArmyModal = function(targetTownId) {
        var tgt = Engine.findTown(targetTownId);
        var garrison = tgt ? (tgt.garrison || 0) : 5;
        var kingdom = null;
        try { if (Player.state && Player.state.kingState) kingdom = Engine.findKingdom(Player.state.kingState.kingdomId); } catch(e) {}
        if (!kingdom) return;

        var stagingSel = document.getElementById('_armyStagingTown');
        var soldierInp = document.getElementById('_armySendCount');
        var routeInfoEl = document.getElementById('_armyRouteInfo');
        var consolidateEl = document.getElementById('_armyConsolidationInfo');
        var chanceEl = document.getElementById('_armyChanceDisplay');
        if (!stagingSel || !soldierInp) return;

        var stagingId = stagingSel.value;
        var soldiers = parseInt(soldierInp.value) || 30;
        var stagingTown = Engine.findTown(stagingId);

        // Update success estimate
        if (chanceEl) chanceEl.innerHTML = _getSuccessEstimateHtml(soldiers, garrison);

        // Route info: travel time + ship warning
        if (routeInfoEl && stagingTown && tgt) {
            var dist = Math.hypot(tgt.x - stagingTown.x, tgt.y - stagingTown.y);
            var baseArmySpeed = ((typeof CONFIG !== 'undefined' ? CONFIG.CARAVAN_BASE_SPEED : 120) || 120) * ((typeof CONFIG !== 'undefined' && CONFIG.ARMY_BASE_SPEED_RATIO) || 0.625);
            var travelDays = Math.max(2, Math.ceil(dist / Math.max(baseArmySpeed, 1)));
            var routeHtml = '🗺️ March: ~<strong>' + travelDays + ' days</strong> from ' + escapeHtml(stagingTown.name) + ' to ' + escapeHtml(tgt.name);

            // Check for sea legs
            var route = null;
            try {
                if (Engine.findArmyRoute) route = Engine.findArmyRoute(stagingId, targetTownId, kingdom.id);
            } catch(e) {}
            if (route && route.legs) {
                var seaLegs = route.legs.filter(function(l) { return l.type === 'sea'; });
                if (seaLegs.length > 0) {
                    var shipsNeeded = Math.ceil(soldiers / (CONFIG.ARMY_EMBARK_SOLDIERS_PER_SHIP || 50));
                    var shipsAvail = 0;
                    if (kingdom.navalFleet) {
                        var firstSeaPort = seaLegs[0].from;
                        for (var si = 0; si < kingdom.navalFleet.length; si++) {
                            var s = kingdom.navalFleet[si];
                            if (s.stationedAt === firstSeaPort && (!s.mission || s.mission === 'troop_transport') && !s._transportingArmy) shipsAvail++;
                        }
                    }
                    if (shipsAvail >= shipsNeeded) {
                        routeHtml += '<br><span style="color:#64b5f6;">⛵ Sea crossing required — ' + shipsAvail + '/' + shipsNeeded + ' ships available ✓</span>';
                    } else {
                        routeHtml += '<br><span style="color:#e57373;">⚠️ Sea crossing required! Need ' + shipsNeeded + ' ships but only ' + shipsAvail + ' available at port. Build warships first!</span>';
                    }
                }
                // Check for destroyed bridge legs
                var destBridgeLegs = route.legs.filter(function(l) { return l.type === 'road_destroyed_bridge'; });
                if (destBridgeLegs.length > 0) {
                    routeHtml += '<br><span style="color:#ffcc80;">🌉 Route crosses ' + destBridgeLegs.length + ' destroyed bridge(s) — army will move at 30% speed on those sections</span>';
                }
                // Use route total time for better estimate
                if (route.totalTime) {
                    travelDays = Math.max(2, Math.ceil(route.totalTime));
                    routeHtml = '🗺️ March: ~<strong>' + travelDays + ' days</strong> from ' + escapeHtml(stagingTown.name) + ' to ' + escapeHtml(tgt.name);
                    if (seaLegs.length > 0) {
                        var _sn = Math.ceil(soldiers / (CONFIG.ARMY_EMBARK_SOLDIERS_PER_SHIP || 50));
                        var _sa = 0;
                        if (kingdom.navalFleet) {
                            var _fp = seaLegs[0].from;
                            for (var _si2 = 0; _si2 < kingdom.navalFleet.length; _si2++) {
                                var _s2 = kingdom.navalFleet[_si2];
                                if (_s2.stationedAt === _fp && (!_s2.mission || _s2.mission === 'troop_transport') && !_s2._transportingArmy) _sa++;
                            }
                        }
                        if (_sa >= _sn) routeHtml += '<br><span style="color:#64b5f6;">⛵ Sea crossing — ' + _sa + '/' + _sn + ' ships ✓</span>';
                        else routeHtml += '<br><span style="color:#e57373;">⚠️ Need ' + _sn + ' ships, only ' + _sa + ' available!</span>';
                    }
                    if (destBridgeLegs.length > 0) {
                        routeHtml += '<br><span style="color:#ffcc80;">🌉 ' + destBridgeLegs.length + ' destroyed bridge(s) — 30% speed</span>';
                    }
                }
            }
            routeInfoEl.innerHTML = routeHtml;
        }

        // Consolidation info: how long to gather soldiers from other towns
        if (consolidateEl && stagingTown) {
            var stagingAvail = Math.max(0, (stagingTown.garrison || 0) - 5);
            if (soldiers <= stagingAvail) {
                consolidateEl.innerHTML = '<span style="color:#81c784;">✓ ' + escapeHtml(stagingTown.name) + ' has enough soldiers (' + stagingAvail + ' available). Army departs immediately.</span>';
            } else {
                var needed = soldiers - stagingAvail;
                var consHtml = '<div style="padding:6px;background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.3);border-radius:5px;">';
                consHtml += '<div style="color:#ffcc80;font-weight:bold;margin-bottom:4px;">⏳ Consolidation Required</div>';
                consHtml += '<div style="color:#ccc;font-size:0.7rem;">' + escapeHtml(stagingTown.name) + ' has ' + stagingAvail + ' soldiers. Need ' + needed + ' more from other towns:</div>';

                // Calculate consolidation: pull from nearest towns first
                var otherTowns = [];
                try {
                    var allT = Engine.getTowns ? Engine.getTowns() : [];
                    for (var oi = 0; oi < allT.length; oi++) {
                        if (allT[oi].kingdomId === kingdom.id && allT[oi].id !== stagingId) {
                            var oAvail = Math.max(0, (allT[oi].garrison || 0) - 3);
                            if (oAvail > 0) {
                                var oDist = Math.hypot(allT[oi].x - stagingTown.x, allT[oi].y - stagingTown.y);
                                var oSpeed = ((typeof CONFIG !== 'undefined' ? CONFIG.CARAVAN_BASE_SPEED : 120) || 120) * ((typeof CONFIG !== 'undefined' && CONFIG.ARMY_BASE_SPEED_RATIO) || 0.625);
                                var oDays = Math.max(1, Math.ceil(oDist / Math.max(oSpeed, 1)));
                                otherTowns.push({ name: allT[oi].name, available: oAvail, days: oDays });
                            }
                        }
                    }
                } catch(e) {}
                otherTowns.sort(function(a, b) { return a.days - b.days; });

                var rem = needed;
                var maxConsDays = 0;
                for (var ci = 0; ci < otherTowns.length && rem > 0; ci++) {
                    var pull = Math.min(rem, otherTowns[ci].available);
                    consHtml += '<div style="font-size:0.68rem;color:#bbb;padding:1px 0;">  → ' + pull + ' from ' + escapeHtml(otherTowns[ci].name) + ' (~' + otherTowns[ci].days + ' days march)</div>';
                    maxConsDays = Math.max(maxConsDays, otherTowns[ci].days);
                    rem -= pull;
                }
                if (rem > 0) {
                    consHtml += '<div style="color:#e57373;font-size:0.7rem;margin-top:4px;">⚠️ Still ' + rem + ' soldiers short! Not enough across kingdom.</div>';
                } else {
                    consHtml += '<div style="color:#81c784;font-size:0.7rem;margin-top:4px;">Consolidation time: ~' + maxConsDays + ' days before army departs.</div>';
                }
                consHtml += '</div>';
                consolidateEl.innerHTML = consHtml;
            }
        }
    };

    // Estimate travel from a given staging town to target (used internally)
    function _estimateArmyTravel(targetTown, fromTown) {
        if (!targetTown) return { days: 0, fromName: '?' };
        var kingdom = null;
        try {
            if (Player.state && Player.state.kingState) kingdom = Engine.findKingdom(Player.state.kingState.kingdomId);
        } catch(e) {}
        if (!kingdom) return { days: 0, fromName: '?' };

        if (!fromTown) {
            var kTowns = Engine.getTowns ? Engine.getTowns() : [];
            for (var i = 0; i < kTowns.length; i++) {
                if (kTowns[i].kingdomId === kingdom.id && kTowns[i].isCapital) { fromTown = kTowns[i]; break; }
            }
            if (!fromTown) {
                var bestGar = 0;
                for (var j = 0; j < kTowns.length; j++) {
                    if (kTowns[j].kingdomId === kingdom.id && (kTowns[j].garrison || 0) > bestGar) {
                        bestGar = kTowns[j].garrison || 0;
                        fromTown = kTowns[j];
                    }
                }
            }
        }
        if (!fromTown) return { days: 0, fromName: '?' };
        var dist = Math.hypot(targetTown.x - fromTown.x, targetTown.y - fromTown.y);
        var baseArmySpeed = ((typeof CONFIG !== 'undefined' ? CONFIG.CARAVAN_BASE_SPEED : 120) || 120) * ((typeof CONFIG !== 'undefined' && CONFIG.ARMY_BASE_SPEED_RATIO) || 0.625);
        var days = Math.max(2, Math.ceil(dist / Math.max(baseArmySpeed, 1)));
        return { days: days, fromName: fromTown.name || '?' };
    }

    // Success estimate HTML
    function _getSuccessEstimateHtml(soldiers, garrison) {
        soldiers = parseInt(soldiers) || 30;
        garrison = Math.max(1, garrison || 5);
        var ratio = soldiers / garrison;
        var chance, color, label;
        if (ratio >= 5) { chance = '~95%'; color = '#55a868'; label = 'Overwhelming'; }
        else if (ratio >= 3) { chance = '~85%'; color = '#55a868'; label = 'Very likely'; }
        else if (ratio >= 2) { chance = '~70%'; color = '#8bc34a'; label = 'Favorable'; }
        else if (ratio >= 1.5) { chance = '~55%'; color = '#e0c58a'; label = 'Even odds'; }
        else if (ratio >= 1) { chance = '~40%'; color = '#e0a050'; label = 'Risky'; }
        else if (ratio >= 0.5) { chance = '~20%'; color = '#c44e52'; label = 'Very risky'; }
        else { chance = '~5%'; color = '#c44e52'; label = 'Suicidal'; }
        return '<span style="color:' + color + ';">⚔️ ' + label + ' (' + chance + ' success)</span>' +
               '<span style="color:#888;margin-left:6px;">' + soldiers + ' vs ' + garrison + ' defenders</span>';
    }

    // _updateArmyChance is no longer needed — _updateSendArmyModal handles everything


    // --- Delegated action handlers ---
    UI.registerAction('kingSetTaxRate', function() { var v = parseInt(document.getElementById('_kingTaxSlider').value) / 100; var r = Player.kingSetTaxRate(v); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingRepealLaw', function(_t, d) { var r = Player.kingRepealLaw(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingEnactLaw', function(_t, d) { var r = Player.kingEnactLaw(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingSuePeace', function(_t, d) {
        // Smart routing: if a peace/surrender offer exists, show that instead (better deal)
        try {
            var kingdom = Engine.findKingdom(Player.state.kingState.kingdomId);
            var target = Engine.findKingdom(d.id);
            if (!kingdom || !target) { UI.toast('Kingdom not found', 'error'); return; }
            if (!kingdom.atWar || !kingdom.atWar.has || !kingdom.atWar.has(d.id)) { UI.toast('Not at war with ' + (target.name || 'them'), 'warning'); return; }

            // Check if enemy has a pending peace/surrender offer — accept that instead
            var petitions = kingdom._pendingPetitions || [];
            var existingOffer = null;
            for (var _eoi = 0; _eoi < petitions.length; _eoi++) {
                if ((petitions[_eoi].type === 'peace_offer' || petitions[_eoi].type === 'surrender_offer') && petitions[_eoi].fromId === d.id) {
                    existingOffer = petitions[_eoi];
                    break;
                }
            }

            if (existingOffer) {
                // Route to accepting the enemy's offer (better deal — they pay us!)
                var offerTerms = existingOffer.peaceTerms || {};
                var offerData = offerTerms.offer || {};
                var goldOffered = Math.floor(offerData.gold || 0);
                var townsOffered = (offerData.towns || []).length;
                var isSurrender = existingOffer.type === 'surrender_offer';

                var html = '<div style="padding:10px;">';
                html += '<div style="text-align:center;font-size:2em;margin-bottom:8px;">' + (isSurrender ? '🏳️' : '🕊️') + '</div>';
                html += '<p style="color:#81c784;text-align:center;font-weight:bold;font-size:1.1em;">' + escapeHtml(target.name) + (isSurrender ? ' is Surrendering!' : ' Offers Peace!') + '</p>';
                html += '<div style="background:rgba(85,168,104,0.12);border:1px solid rgba(85,168,104,0.3);padding:10px;border-radius:6px;margin:10px 0;">';
                html += '<div style="color:#81c784;font-weight:bold;margin-bottom:6px;">💰 Their Offer:</div>';
                html += '<div style="color:#ccc;font-size:0.85rem;">';
                if (goldOffered > 0) html += '• <strong style="color:#e0c58a;">Gold:</strong> ' + formatGold(goldOffered) + ' paid to you<br>';
                if (townsOffered > 0) html += '• <strong style="color:#a5d6a7;">Towns:</strong> ' + townsOffered + ' town' + (townsOffered > 1 ? 's' : '') + ' ceded to you<br>';
                if (goldOffered === 0 && townsOffered === 0) html += '• White peace — no reparations<br>';
                html += '• <strong style="color:#64b5f6;">Peace treaty:</strong> 180 days of guaranteed peace';
                html += '</div></div>';

                // Compare with sue-for-peace cost
                var tribute = Math.floor(kingdom.gold * 0.2);
                html += '<div style="background:rgba(196,78,82,0.12);border:1px solid rgba(196,78,82,0.3);padding:8px;border-radius:6px;margin:8px 0;">';
                html += '<div style="color:#e57373;font-size:0.78rem;">⚠️ Alternatively, suing for peace costs you <strong>' + formatGold(tribute) + '</strong> (20% of treasury)</div>';
                html += '</div>';

                html += '<div style="color:#81c784;font-size:0.82rem;text-align:center;margin:8px 0;">✅ Accepting their offer is the better deal!</div>';

                html += '<div style="display:flex;gap:8px;margin-top:14px;">';
                html += '<button class="btn-medieval" data-action="kingAcceptPeaceOffer" data-id="' + d.id + '" style="flex:1;padding:10px;background:rgba(85,168,104,0.3);border:2px solid rgba(85,168,104,0.6);">';
                html += '<div style="font-weight:bold;color:#81c784;">' + (isSurrender ? '🏳️ Accept Surrender' : '🕊️ Accept Peace Deal') + '</div>';
                if (goldOffered > 0) html += '<div style="font-size:0.75rem;color:#e0c58a;margin-top:2px;">Receive ' + formatGold(goldOffered) + '</div>';
                html += '</button>';
                html += '<button class="btn-medieval" data-action="closeModal" style="flex:1;padding:10px;background:rgba(100,100,100,0.2);border:2px solid rgba(150,150,150,0.4);">';
                html += '<div style="font-weight:bold;color:#ccc;">✋ Continue the War</div></button>';
                html += '</div></div>';

                UI.openModal((isSurrender ? '🏳️ ' : '🕊️ ') + escapeHtml(target.name) + (isSurrender ? ' Surrenders' : ' Offers Peace'), html);
                return;
            }

            // No existing offer — show regular sue-for-peace modal
            var tribute = Math.floor(kingdom.gold * 0.2);
            var ourTowns = kingdom.territories ? (kingdom.territories.size || kingdom.territories.length || 0) : 0;
            var theirTowns = target.territories ? (target.territories.size || target.territories.length || 0) : 0;
            var ourSoldiers = kingdom.soldiers || 0;
            var theirSoldiers = target.soldiers || 0;

            var html = '<div style="padding:10px;">';
            html += '<div style="text-align:center;font-size:2em;margin-bottom:8px;">🕊️</div>';
            html += '<p style="color:var(--gold);text-align:center;font-weight:bold;font-size:1.1em;">Peace Terms with ' + escapeHtml(target.name) + '</p>';

            // War comparison
            html += '<div style="display:flex;justify-content:space-between;gap:12px;margin:12px 0;font-size:0.85rem;">';
            html += '<div style="flex:1;padding:8px;background:rgba(46,125,50,0.15);border-radius:6px;text-align:center;">';
            html += '<div style="color:#a5d6a7;font-weight:bold;">' + escapeHtml(kingdom.name) + '</div>';
            html += '<div style="color:#ccc;margin-top:4px;">🏘️ ' + ourTowns + ' towns</div>';
            html += '<div style="color:#ccc;">⚔️ ' + ourSoldiers + ' soldiers</div>';
            html += '<div style="color:#ccc;">💰 ' + formatGold(Math.floor(kingdom.gold || 0)) + '</div>';
            html += '</div>';
            html += '<div style="flex:1;padding:8px;background:rgba(183,28,28,0.15);border-radius:6px;text-align:center;">';
            html += '<div style="color:#ef9a9a;font-weight:bold;">' + escapeHtml(target.name) + '</div>';
            html += '<div style="color:#ccc;margin-top:4px;">🏘️ ' + theirTowns + ' towns</div>';
            html += '<div style="color:#ccc;">⚔️ ' + theirSoldiers + ' soldiers</div>';
            html += '<div style="color:#ccc;">💰 ' + formatGold(Math.floor(target.gold || 0)) + '</div>';
            html += '</div></div>';

            // Terms
            html += '<div style="padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;margin:10px 0;">';
            html += '<div style="color:var(--gold);font-weight:bold;margin-bottom:6px;">📜 Terms of Surrender:</div>';
            html += '<div style="color:#ccc;font-size:0.85rem;">';
            html += '• <strong style="color:#e57373;">Tribute payment:</strong> ' + formatGold(tribute) + ' (20% of your treasury)<br>';
            html += '• <strong style="color:#81c784;">Peace treaty:</strong> 180 days of guaranteed peace<br>';
            html += '• <strong style="color:#64b5f6;">War ends:</strong> All hostilities cease immediately';
            html += '</div></div>';

            if (tribute > kingdom.gold * 0.5) {
                html += '<div style="color:#e57373;font-size:0.8rem;text-align:center;margin:6px 0;">⚠️ This tribute is a significant portion of your treasury!</div>';
            }

            html += '<div style="display:flex;gap:8px;margin-top:14px;">';
            html += '<button class="btn-medieval" data-action="kingSuePeaceConfirm" data-id="' + d.id + '" style="flex:1;padding:10px;background:rgba(93,173,226,0.3);border:2px solid rgba(93,173,226,0.6);">';
            html += '<div style="font-weight:bold;color:#90caf9;">🕊️ Accept Terms & Sue for Peace</div>';
            html += '<div style="font-size:0.75rem;color:#aaa;margin-top:2px;">Pay ' + formatGold(tribute) + ' tribute</div></button>';
            html += '<button class="btn-medieval" data-action="closeModal" style="flex:1;padding:10px;background:rgba(100,100,100,0.2);border:2px solid rgba(150,150,150,0.4);">';
            html += '<div style="font-weight:bold;color:#ccc;">✋ Continue the War</div></button>';
            html += '</div></div>';

            UI.openModal('🕊️ Sue for Peace — ' + escapeHtml(target.name), html);
        } catch(e) {
            UI.toast('Error showing peace terms', 'error');
        }
    });
    UI.registerAction('kingSuePeaceConfirm', function(_t, d) { var r = Player.kingSuePeace(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingAcceptPeaceOffer', function(_t, d) { var r = Player.kingAcceptPeaceOffer(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingRejectPeaceOffer', function(_t, d) { var r = Player.kingRejectPeaceOffer(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingDeclareWar', function(_t, d) { var r = Player.kingDeclareWar(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingHostFeast', function() {
        var r = Player.kingHostFeast();
        if (r.showSchedule) {
            _openEventScheduleModal('feast', r.kingdomId);
        } else if (r.success && r.openFeast && r.kingdomId) {
            UI.toast(r.message, 'success');
            UI.openFeastDialog(r.kingdomId);
        } else if (r.success && r.pendingFeast) {
            UI.toast(r.message, 'success');
            UI.openKingPanel('decisions');
        } else {
            UI.toast(r.message, r.success ? 'info' : 'warning');
            UI.openKingPanel('decisions');
        }
    });
    UI.registerAction('kingHoldCourt', function() {
        var r = Player.kingHoldCourt();
        if (r.showSchedule) {
            _openEventScheduleModal('court', r.kingdomId);
        } else if (r.success && r.openCourt && r.kingdomId) {
            UI.toast(r.message, 'success');
            UI.openCourtSessionDialog(r.kingdomId);
        } else if (r.success && r.pendingCourt) {
            UI.toast(r.message, 'success');
            UI.openKingPanel('decisions');
        } else {
            UI.toast(r.message, r.success ? 'info' : 'warning');
            UI.openKingPanel('decisions');
        }
    });

    // Scheduling modal for feast/court
    function _openEventScheduleModal(eventType, kingdomId) {
        var isFeast = eventType === 'feast';
        var title = isFeast ? '🎉 Schedule Royal Feast' : '⚖️ Schedule Royal Court';
        var desc = isFeast
            ? 'Choose when to hold the feast. Nobles must travel to the capital — more lead time means more nobles can attend.'
            : 'Choose when to hold court. Nobles must travel to the capital — more lead time means more nobles can attend. Nobles are more likely to attend court than a feast.';
        var html = '';
        html += '<div style="background:linear-gradient(135deg,rgba(200,150,50,0.12),rgba(200,150,50,0.04));border:1px solid rgba(200,150,50,0.3);border-radius:8px;padding:12px;margin-bottom:12px;">';
        html += '<div style="font-size:0.85rem;color:#ddd;">' + escapeHtml(desc) + '</div>';
        html += '</div>';
        var options = [
            { days: 3, label: '3 Days', desc: 'Short notice — only nearby nobles can attend', icon: '⚡' },
            { days: 7, label: '7 Days', desc: 'Standard — most nobles in the kingdom can attend', icon: '📅' },
            { days: 30, label: '30 Days', desc: 'Grand event — maximum attendance from all corners of the realm', icon: '🏰' }
        ];
        for (var i = 0; i < options.length; i++) {
            var opt = options[i];
            html += '<button class="btn-medieval" data-action="kingScheduleEvent" data-val="' + opt.days + '" data-type="' + eventType + '" data-kingdom="' + kingdomId + '" style="display:block;width:100%;text-align:left;padding:10px 14px;margin-bottom:6px;font-size:0.8rem;">';
            html += opt.icon + ' <strong>' + opt.label + '</strong>';
            if (isFeast) html += ' <span style="color:#f0c040;">(500g)</span>';
            html += '<br><span style="font-size:0.7rem;color:#aaa;">' + opt.desc + '</span>';
            html += '</button>';
        }
        var footerHtml = '<button class="btn-medieval" data-action="kingBackToDecisions">Cancel</button>';
        openModal(title, html, footerHtml);
    }

    UI.registerAction('kingScheduleEvent', function(_t, d) {
        var days = parseInt(d.val);
        var type = d.type;
        var r;
        if (type === 'feast') {
            r = Player.kingHostFeast(days);
        } else {
            r = Player.kingHoldCourt(days);
        }
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('decisions');
    });
    UI.registerAction('kingOpenActiveFeast', function() {
        var kId = Player.state && Player.state.kingState ? Player.state.kingState.kingdomId : null;
        if (kId) UI.openFeastDialog(kId);
    });
    UI.registerAction('kingOpenActiveCourt', function() {
        var kId = Player.state && Player.state.kingState ? Player.state.kingState.kingdomId : null;
        if (kId) UI.openCourtSessionDialog(kId);
    });

    // ── Court Management Actions ──
    UI.registerAction('kingGrantAudience', function(_t, d) {
        var idx = parseInt(d.idx);
        var r = Player.kingGrantAudience(idx);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('court');
    });
    UI.registerAction('kingDenyAudience', function(_t, d) {
        var idx = parseInt(d.idx);
        var r = Player.kingDenyAudience(idx);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('court');
    });
    UI.registerAction('kingPrivateAudience', function(_t, d) {
        var r = Player.kingPrivateAudience(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('court');
    });
    UI.registerAction('kingCollectTribute', function() {
        var r = Player.kingCollectTribute();
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('decisions');
    });
    UI.registerAction('kingProposeTrade', function(_t, d) {
        var r = Player.kingProposeTrade(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('decisions');
    });

    UI.registerAction('kingProposeNAP', function(_t, d) {
        var r = Player.kingProposeNAP(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('decisions');
    });

    UI.registerAction('kingProposeMDP', function(_t, d) {
        var r = Player.kingProposeMDP(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('decisions');
    });

    UI.registerAction('kingProposeBorderAccord', function(_t, d) {
        var r = Player.kingProposeBorderAccord(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('decisions');
    });

    UI.registerAction('kingPardonNoble', function(_t, d) {
        var r = Player.kingPardonNoble(d.id);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('court');
    });

    UI.registerAction('kingRespondConspiracy', function(_t, d) {
        var r = Player.kingRespondToConspiracy(d.val);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('decisions');
    });

    // Economic proposal approve/dismiss
    UI.registerAction('kingApproveProposal', function(_t, d) {
        var ks = Player.state && Player.state.kingState;
        if (!ks || !ks.kingdomId) { UI.toast('Not a king.', 'error'); return; }
        var kingdom = null;
        try { kingdom = Engine.findKingdom(ks.kingdomId); } catch(e) {}
        if (!kingdom) { UI.toast('Kingdom not found.', 'error'); return; }
        var proposals = kingdom._economicProposals || [];
        var proposal = null;
        for (var _fi = 0; _fi < proposals.length; _fi++) {
            if (proposals[_fi].id === d.id) { proposal = proposals[_fi]; break; }
        }
        if (!proposal) { UI.toast('Proposal expired or not found.', 'warning'); UI.openKingPanel('decisions'); return; }
        var result = Engine.executeEconomicProposal(kingdom, proposal);
        UI.toast(result.message, result.success ? 'success' : 'warning');
        UI.openKingPanel('decisions');
    });
    UI.registerAction('kingDismissProposal', function(_t, d) {
        var ks = Player.state && Player.state.kingState;
        if (!ks || !ks.kingdomId) return;
        var kingdom = null;
        try { kingdom = Engine.findKingdom(ks.kingdomId); } catch(e) {}
        if (!kingdom) return;
        Engine.dismissEconomicProposal(kingdom, d.id);
        UI.toast('Proposal dismissed.', 'info');
        UI.openKingPanel('decisions');
    });
    UI.registerAction('kingRevokeExportRestriction', function(_t, d) {
        var ks = Player.state && Player.state.kingState;
        if (!ks || !ks.kingdomId) return;
        var kingdom = null;
        try { kingdom = Engine.findKingdom(ks.kingdomId); } catch(e) {}
        if (!kingdom || !kingdom.exportRestrictions) return;
        var idx = kingdom.exportRestrictions.indexOf(d.id);
        if (idx >= 0) {
            kingdom.exportRestrictions.splice(idx, 1);
            var resInfo = null;
            try { resInfo = Engine.findResourceById(d.id); } catch(e) {}
            UI.toast('Export restriction on ' + (resInfo ? resInfo.name : d.id) + ' revoked.', 'success');
        }
        UI.openKingPanel('decisions');
    });

    // Bestow Gift sub-modal
    UI.registerAction('kingBestowGiftUI', function(_t, d) {
        var nobleId = d.id;
        var nobleName = d.name || 'Noble';
        var giftTypes = Player.kingGetRoyalGiftTypes ? Player.kingGetRoyalGiftTypes() : [];
        var ks = Player.state && Player.state.kingState;
        var html = '<div style="padding:12px;">';
        html += '<div style="font-size:1rem;color:#d4a843;margin-bottom:8px;">🎁 Bestow Gift upon ' + escapeHtml(nobleName) + '</div>';
        for (var gi = 0; gi < giftTypes.length; gi++) {
            var gt = giftTypes[gi];
            var cdKey = nobleId + '_' + gt.id;
            var lastDay = (ks && ks._royalGiftCooldowns && ks._royalGiftCooldowns[cdKey]) || 0;
            var ready = Engine.getDay() - lastDay >= gt.cooldown;
            html += '<div style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.08);padding:6px 8px;border-radius:4px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">';
            html += '<div style="flex:1;">';
            html += '<div style="font-size:0.78rem;color:#ddd;">' + gt.icon + ' ' + gt.label + '</div>';
            html += '<div style="font-size:0.65rem;color:#999;">' + gt.desc + '</div>';
            html += '<div style="font-size:0.6rem;color:#888;">';
            if (gt.cost > 0) html += 'Cost: ' + formatGold(gt.cost) + ' · ';
            html += '<span style="color:#55a868;">+' + gt.loyaltyGain + ' loyalty, +' + gt.relGain + ' rel</span>';
            if (!ready) html += ' · <span style="color:#c44e52;">' + (gt.cooldown - (Engine.getDay() - lastDay)) + 'd cooldown</span>';
            html += '</div></div>';
            html += '<button class="btn-medieval" data-action="kingBestowGiftExec" data-id="' + nobleId + '" data-gift="' + gt.id + '" style="font-size:0.6rem;padding:3px 8px;margin-left:6px;' + (!ready ? 'opacity:0.5;' : '') + '" ' + (!ready ? 'disabled' : '') + '>Bestow</button>';
            html += '</div>';
        }
        html += '<button class="btn-medieval" data-action="kingBackToCourt" style="margin-top:8px;font-size:0.72rem;padding:4px 12px;">← Back to Court</button>';
        html += '</div>';
        openModal('Royal Gifts', html);
    });
    UI.registerAction('kingBestowGiftExec', function(_t, d) {
        var r = Player.kingBestowGift(d.id, d.gift);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        if (r.success) UI.openKingPanel('court');
    });
    UI.registerAction('kingBackToCourt', function() { UI.openKingPanel('court'); });

    // Send Mission sub-modal
    UI.registerAction('kingSendMissionUI', function(_t, d) {
        var nobleId = d.id;
        var nobleName = d.name || 'Noble';
        var missionTypes = Player.kingGetMissionTypes ? Player.kingGetMissionTypes() : [];
        var ks = Player.state && Player.state.kingState;
        var kingdom = Engine.findKingdom(ks ? ks.kingdomId : null);
        var html = '<div style="padding:12px;">';
        html += '<div style="font-size:1rem;color:#d4a843;margin-bottom:8px;">📜 Send ' + escapeHtml(nobleName) + ' on Mission</div>';

        for (var mi = 0; mi < missionTypes.length; mi++) {
            var mt = missionTypes[mi];
            html += '<div style="background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.08);padding:6px 8px;border-radius:4px;margin-bottom:4px;">';
            html += '<div style="font-size:0.78rem;color:#ddd;">' + mt.icon + ' ' + mt.label + '</div>';
            html += '<div style="font-size:0.65rem;color:#999;">' + mt.desc.replace('{kingdom}', 'target kingdom') + '</div>';
            html += '<div style="font-size:0.6rem;color:#888;">Duration: ~' + mt.durationBase + '-' + (mt.durationBase + 15) + ' days · Success: ~' + Math.round(mt.successBase * 100) + '% · <span style="color:#55a868;">+' + mt.loyaltySuccess + ' loyalty</span></div>';

            if (mt.needsTarget) {
                // Show target kingdom selector
                try {
                    var _allK = Engine.getWorld().kingdoms;
                    html += '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;">';
                    for (var ki = 0; ki < _allK.length; ki++) {
                        if (kingdom && _allK[ki].id === kingdom.id) continue;
                        html += '<button class="btn-medieval" data-action="kingExecMission" data-noble="' + nobleId + '" data-mission="' + mt.id + '" data-target="' + _allK[ki].id + '" style="font-size:0.58rem;padding:2px 6px;">→ ' + escapeHtml(_allK[ki].name) + '</button>';
                    }
                    html += '</div>';
                } catch(e) {}
            } else {
                html += '<button class="btn-medieval" data-action="kingExecMission" data-noble="' + nobleId + '" data-mission="' + mt.id + '" data-target="" style="font-size:0.62rem;padding:2px 8px;margin-top:4px;">Send</button>';
            }
            html += '</div>';
        }
        html += '<button class="btn-medieval" data-action="kingBackToCourt" style="margin-top:8px;font-size:0.72rem;padding:4px 12px;">← Back to Court</button>';
        html += '</div>';
        openModal('Noble Missions', html);
    });
    UI.registerAction('kingExecMission', function(_t, d) {
        var r = Player.kingSendNobleOnMission(d.noble, d.mission, d.target || null);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        if (r.success) UI.openKingPanel('court');
    });

    // ── Noble Punishment UI ──
    UI.registerAction('kingPunishNobleUI', function(_t, d) {
        var nobleId = d.id;
        var nobleName = d.name || 'Noble';
        var noble = null;
        try { var w = Engine.getWorld(); if (w && w.people) for (var i = 0; i < w.people.length; i++) { if (w.people[i].id === nobleId) { noble = w.people[i]; break; } } } catch(e) {}
        var percLoy = noble ? (noble.perceivedKingLoyalty != null ? noble.perceivedKingLoyalty : (noble.kingLoyalty || 50)) : 50;
        var loyLabel = _loyaltyLabel(percLoy);
        var html = '<div style="padding:12px;">';
        html += '<div style="font-size:1rem;color:#c44e52;margin-bottom:8px;">⚖️ Punish ' + escapeHtml(nobleName) + '</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:8px;">Current standing: <span style="color:' + loyLabel.color + ';">' + loyLabel.text + '</span>. Choose a punishment — harsher measures damage loyalty of all nobles.</div>';

        var punishments = [
            { id: 'fine', icon: '💰', name: 'Levy a Fine', desc: 'Demand 200g from this noble. Moderate loyalty hit to target, minor ripple to others.', severity: 'Mild' },
            { id: 'jail', icon: '🔒', name: 'Imprison', desc: 'Jail this noble for 15 days. Significant loyalty and relationship damage. Other nobles take notice.', severity: 'Moderate' },
            { id: 'seize_gold', icon: '💎', name: 'Seize Gold', desc: 'Confiscate half their gold for the treasury. Heavy loyalty loss, other nobles fear for their wealth.', severity: 'Harsh' },
            { id: 'seize_business', icon: '🏭', name: 'Seize Properties', desc: 'Confiscate their buildings for the kingdom. Devastating loyalty impact across all nobles.', severity: 'Severe' },
            { id: 'strip_title', icon: '📜', name: 'Strip Title', desc: 'Demote this noble by one rank. Enormous reputational damage. Other nobles deeply unsettled.', severity: 'Severe' },
            { id: 'execute', icon: '⚔️', name: 'Execute', desc: 'Put this noble to death. Maximum fear effect but massive loyalty collapse among all other nobles.', severity: 'Extreme' }
        ];
        var sevColors = { Mild: '#e0c58a', Moderate: '#e67e22', Harsh: '#c44e52', Severe: '#a93226', Extreme: '#7b241c' };
        for (var pi = 0; pi < punishments.length; pi++) {
            var p = punishments[pi];
            html += '<div style="background:rgba(0,0,0,0.15);border:1px solid rgba(196,78,82,0.2);padding:6px 8px;border-radius:4px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;">';
            html += '<div style="flex:1;">';
            html += '<div style="font-size:0.78rem;color:#ddd;">' + p.icon + ' ' + p.name + ' <span style="font-size:0.58rem;color:' + (sevColors[p.severity] || '#888') + ';">(' + p.severity + ')</span></div>';
            html += '<div style="font-size:0.62rem;color:#999;">' + p.desc + '</div>';
            html += '</div>';
            html += '<button class="btn-medieval" data-action="kingPunishNoble" data-id="' + nobleId + '" data-val="' + p.id + '" style="font-size:0.62rem;padding:3px 8px;background:rgba(196,78,82,0.3);margin-left:8px;">⚖️</button>';
            html += '</div>';
        }
        html += '<button class="btn-medieval" data-action="kingBackToCourt" style="margin-top:8px;font-size:0.72rem;padding:4px 12px;">← Back to Court</button>';
        html += '</div>';
        openModal('⚖️ Noble Punishment', html);
    });
    UI.registerAction('kingPunishNoble', function(_t, d) {
        var r = Player.kingPunishNoble ? Player.kingPunishNoble(d.id, d.val) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        if (r.success) UI.openKingPanel('court');
    });

    // ── Investigate Noble ──
    UI.registerAction('kingInvestigateNoble', function(_t, d) {
        var r = Player.kingInvestigateNoble ? Player.kingInvestigateNoble(d.id) : { success: false, message: 'Not available.' };
        if (r.success && r.showPanel) {
            UI.openInvestigationPanel(r.nobleId, r.nobleName);
        } else {
            UI.toast(r.message, r.success ? 'success' : 'info');
            UI.openKingPanel('court');
        }
    });

    // ── Investigation Method Execution ──
    UI.registerAction('kingInvestigateMethod', function(_t, d) {
        var r = Player.kingInvestigateNoble ? Player.kingInvestigateNoble(d.id, d.val) : { success: false, message: 'Not available.' };
        if (r.success && r.results) {
            // Show results in the investigation panel
            UI.openInvestigationResults(d.id, r);
        } else {
            UI.toast(r.message, r.success ? 'success' : 'warning');
        }
    });
    UI.registerAction('kingFleeConfirm', function() { var r = Player.kingFleeKingdom(); UI.closeModal(); UI.toast(r.message, r.success ? 'success' : 'warning'); });
    UI.registerAction('kingElectionVote', function(_t, d) { Engine._resolvePendingElection(Engine.findKingdom(d.kingdom), d.id); UI.closeModal(); UI.toast('Your vote has been cast.', 'success'); });
    UI.registerAction('kingElectionAbstain', function(_t, d) { Engine._resolvePendingElection(Engine.findKingdom(d.kingdom), null); UI.closeModal(); UI.toast('You abstained from voting.', 'warning'); });
    UI.registerAction('_confirmKingFlee', function() { _confirmKingFlee(); });
    UI.registerAction('_resolveRevolt', function(_t, d) { _resolveRevolt(d.id, d.val); });
    UI.registerAction('kingIssueDirective', function(_t, d) { _kingIssueDirectiveUI(d.id, d.kingdom); });
    UI.registerAction('kingConfirmDirective', function(_t, d) { _kingConfirmDirective(d.id, d.kingdom, d.val); });

    // Military tab actions
    UI.registerAction('kingRecruitSoldiers', function() {
        var el = document.getElementById('_kingRecruitCount');
        var count = el ? parseInt(el.value) || 10 : 10;
        var r = Player.kingRecruitSoldiers ? Player.kingRecruitSoldiers(count) : { success: false, message: 'Recruitment system not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('military');
    });
    UI.registerAction('kingConscriptSoldiers', function() {
        var el = document.getElementById('_kingRecruitCount');
        var count = el ? parseInt(el.value) || 10 : 10;
        var r = Player.kingConscriptSoldiers ? Player.kingConscriptSoldiers(count) : { success: false, message: 'Conscription not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('military');
    });
    UI.registerAction('kingDischargeSoldiers', function() {
        var el = document.getElementById('_kingDischargeCount');
        var count = el ? parseInt(el.value) || 5 : 5;
        var r = Player.kingDischargeSoldiers ? Player.kingDischargeSoldiers(count) : { success: false, message: 'Discharge system not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('military');
    });
    UI.registerAction('kingOpenTransfer', function(_t, d) {
        var fromTownId = d.id;
        var fromTown = Engine.findTown(fromTownId);
        if (!fromTown) { UI.toast('Town not found.', 'warning'); return; }
        var kId = Player.state && Player.state.kingState ? Player.state.kingState.kingdomId : null;
        if (!kId) return;
        var kingdom = Engine.findKingdom(kId);
        if (!kingdom) return;

        var available = Math.max(0, (fromTown.garrison || 0) - 3);
        var html = '<div style="padding:8px;">';
        html += '<p style="font-size:0.85rem;color:#d4c9a0;">Transfer soldiers from <b>' + escapeHtml(fromTown.name) + '</b> (' + available + ' available, 3 minimum kept)</p>';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">';
        html += '<label style="font-size:0.75rem;">Count:</label>';
        html += '<input type="number" id="_transferCount" min="1" max="' + available + '" value="' + Math.min(5, available) + '" style="width:60px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#d4c9a0;padding:2px 4px;font-size:0.75rem;">';
        html += '</div>';
        html += '<label style="font-size:0.75rem;">Destination:</label>';
        html += '<select id="_transferDest" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#d4c9a0;padding:4px;font-size:0.75rem;margin-top:4px;">';
        var _otherTowns = Engine.getTowns().filter(function(t) { return t.kingdomId === kId && t.id !== fromTownId && !t.isWilderness; });
        for (var _oi = 0; _oi < _otherTowns.length; _oi++) {
            var _ot = _otherTowns[_oi];
            html += '<option value="' + _ot.id + '">' + escapeHtml(_ot.name) + ' (' + (_ot.garrison || 0) + ' soldiers)</option>';
        }
        html += '</select></div>';

        var footer = '<button class="btn-medieval" data-action="kingExecuteTransfer" data-id="' + fromTownId + '">🚶 Transfer</button> <button class="btn-medieval" data-action="closeModal">Cancel</button>';
        openModal('📤 Transfer Soldiers — ' + fromTown.name, html, footer);
    });
    UI.registerAction('kingExecuteTransfer', function(_t, d) {
        var fromId = d.id;
        var destEl = document.getElementById('_transferDest');
        var countEl = document.getElementById('_transferCount');
        var toId = destEl ? destEl.value : '';
        var count = countEl ? parseInt(countEl.value) || 5 : 5;
        if (!toId) { UI.toast('Select a destination.', 'warning'); return; }
        var r = Player.kingTransferSoldiers ? Player.kingTransferSoldiers(fromId, toId, count) : { success: false, message: 'Transfer not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        if (r.success) UI.openKingPanel('military');
    });
    UI.registerAction('kingReinforceTown', function(_t, d) {
        // Legacy — redirect to transfer
        UI.toast('Use the Transfer button to move soldiers between towns.', 'info');
        UI.openKingPanel('military');
    });

    // Employee tab actions
    UI.registerAction('kingHireEmployees', function() {
        var typeEl = document.getElementById('_empType');
        var countEl = document.getElementById('_empCount');
        var payEl = document.getElementById('_empPay');
        var townEl = document.getElementById('_empTown');
        if (!typeEl || !typeEl.value) { UI.toast('Select employee type.', 'warning'); return; }
        var count = countEl ? parseInt(countEl.value) || 1 : 1;
        var pay = payEl ? parseInt(payEl.value) || 25 : 25;
        var townId = townEl ? townEl.value : '';
        var r = Player.kingHireEmployees ? Player.kingHireEmployees(typeEl.value, count, pay, townId || null) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('employees');
    });
    UI.registerAction('kingDismissEmployee', function(_t, d) {
        var r = Player.kingDismissEmployee ? Player.kingDismissEmployee(d.id, d.val) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('employees');
    });
    UI.registerAction('kingSetProcurementOrder', function() {
        var goodEl = document.getElementById('_procGood');
        var qtyEl = document.getElementById('_procQty');
        var priceEl = document.getElementById('_procMaxPrice');
        if (!goodEl || !goodEl.value) { UI.toast('Select a good.', 'warning'); return; }
        var qty = qtyEl ? parseInt(qtyEl.value) || 20 : 20;
        var maxPrice = priceEl ? parseInt(priceEl.value) || 50 : 50;
        var r = Player.kingSetProcurementOrder ? Player.kingSetProcurementOrder(goodEl.value, qty, maxPrice) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('employees');
    });
    UI.registerAction('kingCancelProcOrder', function(_t, d) {
        var r = Player.kingCancelProcurementOrder ? Player.kingCancelProcurementOrder(d.id) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('employees');
    });

    // Military Proposal actions
    UI.registerAction('kingApproveMilProposal', function(_t, d) {
        try {
            var kingdom = Engine.findKingdom(Player.state.kingState.kingdomId);
            if (!kingdom || !kingdom._militaryProposals) { UI.toast('No proposals found.', 'warning'); return; }
            var proposal = null;
            for (var i = 0; i < kingdom._militaryProposals.length; i++) {
                if (kingdom._militaryProposals[i].id === d.id) { proposal = kingdom._militaryProposals[i]; break; }
            }
            if (!proposal) { UI.toast('Proposal expired or already handled.', 'warning'); UI.openKingPanel('military'); return; }
            var r = Engine.executeMilitaryProposal(kingdom, proposal);
            UI.toast(r.message, r.success ? 'success' : 'warning');
        } catch(e) { UI.toast('Error: ' + e.message, 'error'); }
        UI.openKingPanel('military');
    });
    UI.registerAction('kingDismissMilProposal', function(_t, d) {
        try {
            var kingdom = Engine.findKingdom(Player.state.kingState.kingdomId);
            Engine.dismissMilitaryProposal(kingdom, d.id);
            UI.toast('Proposal dismissed.', 'info');
        } catch(e) {}
        UI.openKingPanel('military');
    });

    // Town management actions
    UI.registerAction('kingSendMedical', function(_t, d) {
        var r = Player.kingExecuteOrder ? Player.kingExecuteOrder('send_medical', { townId: d.id }) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('kingdom');
    });
    UI.registerAction('kingSendFood', function(_t, d) {
        var r = Player.kingExecuteOrder ? Player.kingExecuteOrder('send_food', { townId: d.id }) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('kingdom');
    });
    UI.registerAction('kingHostLocalFeast', function(_t, d) {
        var r = Player.kingExecuteOrder ? Player.kingExecuteOrder('local_feast', { townId: d.id }) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('kingdom');
    });
    UI.registerAction('kingQuarantineTown', function(_t, d) {
        var curLevel = parseInt(d.val) || 0;
        var r = Player.kingExecuteOrder ? Player.kingExecuteOrder(curLevel > 0 ? 'lift_quarantine' : 'quarantine', { townId: d.id }) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('kingdom');
    });

    // Stockpile actions
    UI.registerAction('kingProcureMilitary', function() {
        var goodEl = document.getElementById('_milOrdGood'), qtyEl = document.getElementById('_milOrdQty');
        if (!goodEl || !goodEl.value) { UI.toast('Select a military item.', 'warning'); return; }
        var qty = qtyEl ? parseInt(qtyEl.value) || 10 : 10;
        var r = Player.kingProcureMilitary ? Player.kingProcureMilitary(goodEl.value, qty) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('stockpile');
    });
    UI.registerAction('kingBuyStockpile', function(_t, d) {
        var goodEl = document.getElementById('_kBuyGood'), qtyEl = document.getElementById('_kBuyQty');
        if (!goodEl || !goodEl.value) { UI.toast('Select a good.', 'warning'); return; }
        var qty = qtyEl ? parseInt(qtyEl.value) || 10 : 10;
        var r = Player.kingBuyStockpile ? Player.kingBuyStockpile(goodEl.value, qty) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('stockpile');
    });
    UI.registerAction('kingSellStockpile', function(_t, d) {
        var r = Player.kingSellStockpile ? Player.kingSellStockpile(d.id) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('stockpile');
    });
    UI.registerAction('kingCommissionGoods', function() {
        var g = document.getElementById('_roCommGood'), q = document.getElementById('_roCommQty');
        if (!g || !g.value) { UI.toast('Select a good.', 'warning'); return; }
        var qty = q ? parseInt(q.value) || 10 : 10;
        var r = Player.kingCommissionGoods ? Player.kingCommissionGoods(g.value, qty) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('stockpile');
    });
    UI.registerAction('kingSendStockpile', function() {
        var g = document.getElementById('_roSendGood'), t = document.getElementById('_roSendTown'), q = document.getElementById('_roSendQty');
        if (!g || !g.value) { UI.toast('Select a good.', 'warning'); return; }
        if (!t || !t.value) { UI.toast('Select a town.', 'warning'); return; }
        var qty = q ? parseInt(q.value) || 5 : 5;
        var r = Player.kingSendStockpile ? Player.kingSendStockpile(g.value, t.value, qty) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('stockpile');
    });

    // Petition actions
    UI.registerAction('kingApprovePetition', function(_t, d) {
        var r = Player.kingApprovePetition ? Player.kingApprovePetition(d.id) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('court');
    });
    UI.registerAction('kingRejectPetition', function(_t, d) {
        var r = Player.kingRejectPetition ? Player.kingRejectPetition(d.id) : { success: false, message: 'Not available.' };
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('court');
    });

    // Royal Order actions
    UI.registerAction('kingOrderBuildRoad', function() {
        var from = document.getElementById('_roFromTown'); var to = document.getElementById('_roToTown');
        if (!from || !to || !from.value || !to.value) { UI.toast('Select two towns.', 'warning'); return; }
        var r = Player.kingExecuteOrder('build_road', { fromTownId: from.value, toTownId: to.value }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingOrderBuildStructure', function() {
        var t = document.getElementById('_roBuildTown'); var bt = document.getElementById('_roBuildType');
        if (!t || !t.value) { UI.toast('Select a town.', 'warning'); return; }
        if (!bt || !bt.value) { UI.toast('Select a building type.', 'warning'); return; }
        var r = Player.kingBuildStructure(bt.value, t.value); UI.toast(r.message, r.success ? 'success' : 'warning'); if (r.success) UI.openKingPanel('decisions');
    });
    UI.registerAction('kingOrderSecurity', function() {
        var t = document.getElementById('_roSecTown');
        if (!t || !t.value) { UI.toast('Select a town.', 'warning'); return; }
        var r = Player.kingExecuteOrder('increase_security', { townId: t.value }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingOrderClearBandits', function() {
        var s = document.getElementById('_roBanditRoad');
        if (!s || !s.value) { UI.toast('Select a road.', 'warning'); return; }
        var r = Player.kingExecuteOrder('clear_bandits', { roadIndex: parseInt(s.value) }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingOrderRepairInfra', function() {
        var t = document.getElementById('_roRepairTown');
        if (!t || !t.value) { UI.toast('Select a town.', 'warning'); return; }
        var r = Player.kingExecuteOrder('repair_infrastructure', { townId: t.value }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingOrderRepairBridge', function() {
        var s = document.getElementById('_roBridgeRoad');
        if (!s || !s.value) { UI.toast('Select a road.', 'warning'); return; }
        var r = Player.kingExecuteOrder('repair_bridge', { roadIndex: parseInt(s.value) }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingOrderBanGood', function() {
        var s = document.getElementById('_roBanGood');
        if (!s || !s.value) { UI.toast('Select a good.', 'warning'); return; }
        var r = Player.kingExecuteOrder('ban_goods', { resourceId: s.value, resourceName: s.value }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingOrderUnbanGood', function() {
        var s = document.getElementById('_roBanGood');
        if (!s || !s.value) { UI.toast('Select a good.', 'warning'); return; }
        var r = Player.kingExecuteOrder('unban_goods', { resourceId: s.value, resourceName: s.value }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingStartSmallFestival', function() {
        var t = document.getElementById('_roFestTown');
        if (!t || !t.value) { UI.toast('Select a town.', 'warning'); return; }
        var r = Player.kingStartFestival(t.value, 'small'); if (r) { UI.toast(r.message, r.success ? 'success' : 'warning'); } else { UI.toast('Festival failed.', 'warning'); } UI.openKingPanel('decisions');
    });
    UI.registerAction('kingStartLargeFestival', function() {
        var t = document.getElementById('_roFestTown');
        if (!t || !t.value) { UI.toast('Select a town.', 'warning'); return; }
        var r = Player.kingStartFestival(t.value, 'large'); if (r) { UI.toast(r.message, r.success ? 'success' : 'warning'); } else { UI.toast('Festival failed.', 'warning'); } UI.openKingPanel('decisions');
    });
    UI.registerAction('kingOrderPromoteOutpost', function() {
        var s = document.getElementById('_roPromoteOutpost');
        if (!s || !s.value) { UI.toast('Select an outpost.', 'warning'); return; }
        var r = Player.kingExecuteOrder('promote_outpost', { townId: s.value }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });

    // Economic order actions
    UI.registerAction('kingExportBan', function() {
        var g = document.getElementById('_roExportGood'), k = document.getElementById('_roExportKingdom');
        if (!g || !g.value) { UI.toast('Select a good.', 'warning'); return; }
        var r = Player.kingEconomicOrder('export_ban', { good: g.value, target: k ? k.value : 'all' }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingExportUnban', function() {
        var g = document.getElementById('_roExportGood'), k = document.getElementById('_roExportKingdom');
        if (!g || !g.value) { UI.toast('Select a good.', 'warning'); return; }
        var r = Player.kingEconomicOrder('export_unban', { good: g.value, target: k ? k.value : 'all' }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingSetBounty', function() {
        var g = document.getElementById('_roBountyGood');
        if (!g || !g.value) { UI.toast('Select a good.', 'warning'); return; }
        var r = Player.kingEconomicOrder('set_bounty', { good: g.value }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingRemoveBounty', function() {
        var g = document.getElementById('_roBountyGood');
        if (!g || !g.value) { UI.toast('Select a good.', 'warning'); return; }
        var r = Player.kingEconomicOrder('remove_bounty', { good: g.value }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingSetSubsidy', function() {
        var g = document.getElementById('_roSubsidyGood');
        if (!g || !g.value) { UI.toast('Select a good.', 'warning'); return; }
        var r = Player.kingEconomicOrder('set_subsidy', { good: g.value }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingRemoveSubsidy', function() {
        var g = document.getElementById('_roSubsidyGood');
        if (!g || !g.value) { UI.toast('Select a good.', 'warning'); return; }
        var r = Player.kingEconomicOrder('remove_subsidy', { good: g.value }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingSetLandSubsidy', function() {
        var t = document.getElementById('_roLandSubTown');
        var b = document.getElementById('_roLandSubBldg');
        if (!t || !t.value) { UI.toast('Select a town.', 'warning'); return; }
        var bldgType = b ? b.value : 'all';
        var r = Player.kingEconomicOrder('set_land_subsidy', { townId: t.value, buildingType: bldgType }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingRemoveLandSubsidy', function() {
        var t = document.getElementById('_roLandSubTown');
        if (!t || !t.value) { UI.toast('Select a town.', 'warning'); return; }
        var r = Player.kingEconomicOrder('remove_land_subsidy', { townId: t.value }); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });

    // War management actions
    UI.registerAction('kingRaiseArmyUI', function() {
        var cnt = document.getElementById('_raiseCount');
        var count = cnt ? parseInt(cnt.value) || 30 : 30;
        var r = Player.kingRaiseArmy(count); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingSendArmyUI', function(_t, d) {
        var idx = d.id || '0';
        var tgt = document.getElementById('_warTarget_' + idx);
        var sol = document.getElementById('_warSoldiers_' + idx);
        if (!tgt || !tgt.value) { UI.toast('Select a target town.', 'warning'); return; }
        var soldiers = sol ? parseInt(sol.value) || 30 : 30;
        var r = Player.kingSendArmy(tgt.value, soldiers); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingFortifyTownUI', function() {
        var t = document.getElementById('_fortifyTown');
        if (!t || !t.value) { UI.toast('Select a town.', 'warning'); return; }
        var r = Player.kingFortifyTown(t.value); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions');
    });
    UI.registerAction('kingSendArmyToTown', function(_t, d) {
        if (!d.id) { UI.toast('No target.', 'warning'); return; }
        _buildSendArmyModal(d.id);
    });
    UI.registerAction('kingSendArmyConfirm', function(_t, d) {
        var cnt2 = document.getElementById('_armySendCount');
        var stagingSel = document.getElementById('_armyStagingTown');
        var mountedCb = document.getElementById('_armyMounted');
        var demoInput = document.getElementById('_armyDemoTools');
        var blastInput = document.getElementById('_armyBlastPowder');
        var soldiers = cnt2 ? parseInt(cnt2.value) || 30 : 30;
        var stagingTownId = stagingSel ? stagingSel.value : null;
        var mounted = mountedCb ? mountedCb.checked : false;
        var demolitionTools = demoInput ? parseInt(demoInput.value) || 0 : 0;
        var blastingPowder = blastInput ? parseInt(blastInput.value) || 0 : 0;
        var r = Player.kingSendArmy(d.id, soldiers, stagingTownId, { mounted: mounted, demolitionTools: demolitionTools, blastingPowder: blastingPowder }); UI.closeModal(); UI.toast(r.message, r.success ? 'success' : 'warning');
    });

    // ── Treasury Transfer Actions ──
    UI.registerAction('kingDonateTreasury', function() {
        var inp = document.getElementById('_treasuryAmount');
        var amount = inp ? parseInt(inp.value) || 100 : 100;
        var r = Player.kingDonateTreasury(amount);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('overview');
    });
    UI.registerAction('kingWithdrawTreasury', function() {
        var inp = document.getElementById('_treasuryAmount');
        var amount = inp ? parseInt(inp.value) || 100 : 100;
        var r = Player.kingWithdrawTreasury(amount);
        UI.toast(r.message, r.success ? 'success' : 'warning');
        UI.openKingPanel('overview');
    });

    // ═══════════════════════════════════════════════════════════
    // §COURT-SESSION — Court Session Dialog (King holds court with cases)
    // ═══════════════════════════════════════════════════════════

    function openCourtSessionDialog(kingdomId) {
        var court = null;
        try { court = Engine.getCourtSession ? Engine.getCourtSession(kingdomId) : null; } catch(e) {}
        if (!court || !court.cases) {
            toast('No court session active.', 'info');
            return;
        }

        var html = '';
        var unresolvedCount = court.cases.filter(function(c) { return !c.resolved; }).length;
        var resolvedCount = court._resolvedCount || 0;

        // Header
        html += '<div style="background:linear-gradient(135deg,rgba(80,120,200,0.15),rgba(80,120,200,0.05));border:1px solid rgba(80,120,200,0.3);border-radius:8px;padding:12px;margin-bottom:10px;">';
        html += '<div style="font-size:0.9rem;font-weight:bold;color:#5dade2;">⚖️ Royal Court Session</div>';
        html += '<div style="font-size:0.78rem;color:#ccc;margin-top:4px;">' + unresolvedCount + ' case' + (unresolvedCount !== 1 ? 's' : '') + ' pending • ' + resolvedCount + ' resolved</div>';
        if (court.nobles && court.nobles.length > 0) {
            html += '<div style="font-size:0.72rem;color:#aaa;margin-top:4px;">👥 Nobles attending: ';
            for (var ni = 0; ni < Math.min(court.nobles.length, 8); ni++) {
                html += (ni > 0 ? ', ' : '') + escapeHtml(court.nobles[ni].name);
            }
            if (court.nobles.length > 8) html += ' +' + (court.nobles.length - 8) + ' more';
            html += '</div>';
        }
        html += '</div>';

        // Cases — unresolved first
        var categories = { commoner: { icon: '👨‍🌾', color: '#a8d5a2' }, noble: { icon: '👑', color: '#f0c040' }, criminal: { icon: '⚖️', color: '#c44e52' }, military: { icon: '⚔️', color: '#5dade2' }, clergy: { icon: '⛪', color: '#c8a0ff' }, diplomacy: { icon: '🕊️', color: '#55a868' } };
        var unresolved = court.cases.filter(function(c) { return !c.resolved; });
        var resolved = court.cases.filter(function(c) { return c.resolved; });

        if (unresolved.length > 0) {
            html += '<div style="margin-bottom:8px;font-size:0.82rem;font-weight:bold;color:#ddd;">📋 Pending Cases</div>';
            for (var ui = 0; ui < unresolved.length; ui++) {
                var uc = unresolved[ui];
                var catDef = categories[uc.category] || { icon: '📜', color: '#ccc' };
                html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(80,120,200,0.2);border-radius:6px;padding:10px;margin-bottom:6px;">';
                html += '<div style="font-size:0.82rem;font-weight:bold;color:' + catDef.color + ';">' + uc.icon + ' ' + escapeHtml(uc.title) + '</div>';
                html += '<div style="font-size:0.72rem;color:#bbb;margin:4px 0 8px 0;">' + escapeHtml(uc.desc) + '</div>';
                html += '<div style="display:flex;gap:4px;flex-wrap:wrap;">';
                html += '<button class="btn-medieval" data-action="resolveCourtCase" data-id="' + uc.id + '" data-val="grant" data-kingdom="' + kingdomId + '" style="font-size:0.7rem;padding:3px 10px;background:rgba(85,168,104,0.3);border-color:rgba(85,168,104,0.5);">✅ Grant</button>';
                html += '<button class="btn-medieval" data-action="resolveCourtCase" data-id="' + uc.id + '" data-val="deny" data-kingdom="' + kingdomId + '" style="font-size:0.7rem;padding:3px 10px;background:rgba(196,78,82,0.3);border-color:rgba(196,78,82,0.5);">❌ Deny</button>';
                html += '<button class="btn-medieval" data-action="resolveCourtCase" data-id="' + uc.id + '" data-val="compromise" data-kingdom="' + kingdomId + '" style="font-size:0.7rem;padding:3px 10px;background:rgba(230,126,34,0.3);border-color:rgba(230,126,34,0.5);">🤝 Compromise</button>';
                if (court.nobles && court.nobles.length > 0) {
                    html += '<button class="btn-medieval" data-action="resolveCourtCase" data-id="' + uc.id + '" data-val="delegate" data-kingdom="' + kingdomId + '" style="font-size:0.7rem;padding:3px 10px;background:rgba(93,173,226,0.3);border-color:rgba(93,173,226,0.5);">📋 Delegate</button>';
                }
                html += '</div>';
                // Show effect previews
                html += '<div style="font-size:0.65rem;color:#777;margin-top:4px;">';
                var _previewGrant = [], _previewDeny = [], _previewComp = [];
                if (uc.grantEffect.happiness) _previewGrant.push((uc.grantEffect.happiness > 0 ? '+' : '') + uc.grantEffect.happiness + ' happ');
                if (uc.grantEffect.treasury) _previewGrant.push((uc.grantEffect.treasury > 0 ? '+' : '') + uc.grantEffect.treasury + 'g');
                if (uc.grantEffect.loyA) _previewGrant.push('Noble loyalty ' + (uc.grantEffect.loyA > 0 ? '+' : '') + uc.grantEffect.loyA);
                if (uc.denyEffect.happiness) _previewDeny.push((uc.denyEffect.happiness > 0 ? '+' : '') + uc.denyEffect.happiness + ' happ');
                if (uc.compromiseEffect.happiness) _previewComp.push((uc.compromiseEffect.happiness > 0 ? '+' : '') + uc.compromiseEffect.happiness + ' happ');
                if (uc.compromiseEffect.treasury) _previewComp.push((uc.compromiseEffect.treasury > 0 ? '+' : '') + uc.compromiseEffect.treasury + 'g');
                if (_previewGrant.length > 0) html += 'Grant: ' + _previewGrant.join(', ') + ' · ';
                if (_previewDeny.length > 0) html += 'Deny: ' + _previewDeny.join(', ') + ' · ';
                if (_previewComp.length > 0) html += 'Compromise: ' + _previewComp.join(', ');
                html += '</div>';
                html += '</div>';
            }
        }

        // Resolved cases (collapsed)
        if (resolved.length > 0) {
            html += '<div style="margin-top:8px;border-top:1px solid rgba(80,120,200,0.2);padding-top:8px;">';
            html += '<div style="font-size:0.78rem;font-weight:bold;color:#888;margin-bottom:4px;">✅ Resolved Cases (' + resolved.length + ')</div>';
            html += '<div style="max-height:100px;overflow-y:auto;">';
            for (var ri = 0; ri < resolved.length; ri++) {
                var rc = resolved[ri];
                var resColor = rc.resolution === 'grant' ? '#55a868' : rc.resolution === 'deny' ? '#c44e52' : '#e67e22';
                html += '<div style="font-size:0.68rem;color:#777;margin-bottom:2px;">' + rc.icon + ' ' + escapeHtml(rc.title) + ' — <span style="color:' + resColor + ';">' + (rc.resolution || '').toUpperCase() + '</span></div>';
            }
            html += '</div></div>';
        }

        // Court events log
        if (court.events && court.events.length > 0) {
            html += '<div style="margin-top:8px;border-top:1px solid rgba(80,120,200,0.2);padding-top:8px;">';
            html += '<div style="font-size:0.78rem;font-weight:bold;color:#5dade2;margin-bottom:4px;">📰 Court Events</div>';
            html += '<div style="max-height:120px;overflow-y:auto;">';
            for (var ei = court.events.length - 1; ei >= Math.max(0, court.events.length - 10); ei--) {
                html += '<div style="font-size:0.68rem;color:#aaa;margin-bottom:2px;padding:2px 6px;background:rgba(0,0,0,0.15);border-radius:3px;">' + escapeHtml(court.events[ei]) + '</div>';
            }
            html += '</div></div>';
        }

        var footerHtml = '<button class="btn-medieval" data-action="kingBackToDecisions">Back to Decisions</button>';
        openModal('⚖️ Royal Court', html, footerHtml);
    }
    UI.openCourtSessionDialog = openCourtSessionDialog;

    UI.registerAction('resolveCourtCase', function(_t, d) {
        var r = Engine.resolveCourtCase ? Engine.resolveCourtCase(d.kingdom, d.id, d.val) : { success: false, message: 'Not available.' };
        if (r.success) {
            toast(r.message, 'success');
            // Show noble reactions
            if (r.nobleReactions && r.nobleReactions.length > 0) {
                for (var nri = 0; nri < r.nobleReactions.length; nri++) {
                    toast(r.nobleReactions[nri], 'info');
                }
            }
        } else {
            toast(r.message, 'warning');
        }
        // Refresh court dialog
        if (r.allResolved) {
            UI.openKingPanel('decisions');
        } else {
            UI.openCourtSessionDialog(d.kingdom);
        }
    });

    UI.registerAction('kingBackToDecisions', function() { UI.openKingPanel('decisions'); });

    // ═══════════════════════════════════════════════════════════
    // §INVESTIGATION — Investigation Panel (King investigates noble)
    // ═══════════════════════════════════════════════════════════

    function openInvestigationPanel(nobleId, nobleName) {
        var html = '';
        html += '<div style="background:linear-gradient(135deg,rgba(93,173,226,0.12),rgba(93,173,226,0.04));border:1px solid rgba(93,173,226,0.3);border-radius:8px;padding:12px;margin-bottom:10px;">';
        html += '<div style="font-size:0.9rem;font-weight:bold;color:#5dade2;">🔍 Investigate ' + escapeHtml(nobleName) + '</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-top:4px;">Choose your investigation method. Each has different costs, risks, and information revealed.</div>';
        html += '</div>';

        // Show existing dossier info
        var dossier = null;
        try { dossier = Player.state && Player.state._nobleDossier ? Player.state._nobleDossier[nobleId] : null; } catch(e) {}
        if (dossier) {
            html += '<div style="background:rgba(0,0,0,0.2);border:1px solid rgba(93,173,226,0.15);border-radius:6px;padding:8px;margin-bottom:8px;">';
            html += '<div style="font-size:0.78rem;font-weight:bold;color:#ddd;margin-bottom:4px;">📁 Current Dossier</div>';
            if (dossier.loyalty != null) html += '<div style="font-size:0.7rem;color:#aaa;">Loyalty: <span style="color:' + (dossier.loyalty >= 60 ? '#55a868' : dossier.loyalty >= 40 ? '#e0c58a' : '#c44e52') + ';">' + Math.round(dossier.loyalty) + '</span></div>';
            if (dossier.fear != null) html += '<div style="font-size:0.7rem;color:#aaa;">Fear: ' + Math.round(dossier.fear) + '</div>';
            if (dossier.wealth != null) html += '<div style="font-size:0.7rem;color:#aaa;">Wealth: ~' + dossier.wealth + 'g</div>';
            var pTraits = Object.keys(dossier.personality || {});
            if (pTraits.length > 0) {
                html += '<div style="font-size:0.7rem;color:#aaa;">Traits: ';
                for (var pi = 0; pi < pTraits.length; pi++) {
                    var val = dossier.personality[pTraits[pi]];
                    html += (pi > 0 ? ', ' : '') + pTraits[pi] + ': ' + (val > 70 ? '<span style="color:#55a868;">high</span>' : val > 50 ? '<span style="color:#e0c58a;">mid</span>' : '<span style="color:#c44e52;">low</span>');
                }
                html += '</div>';
            }
            var relKeys = Object.keys(dossier.relationships || {});
            if (relKeys.length > 0) {
                html += '<div style="font-size:0.7rem;color:#aaa;">Relationships: ';
                for (var rli = 0; rli < Math.min(relKeys.length, 4); rli++) {
                    var rp = null; try { rp = Engine.getPerson(relKeys[rli]); } catch(e) {}
                    var rn = rp ? (rp.firstName || 'Unknown') : 'Unknown';
                    var rv = dossier.relationships[relKeys[rli]];
                    html += (rli > 0 ? ', ' : '') + rn + ': <span style="color:' + (rv > 30 ? '#55a868' : rv < -30 ? '#c44e52' : '#aaa') + ';">' + rv + '</span>';
                }
                html += '</div>';
            }
            if (dossier._knownConspirator) html += '<div style="font-size:0.7rem;color:#c44e52;font-weight:bold;">⚠️ Known conspirator!</div>';
            if (dossier._suspiciousFinances) html += '<div style="font-size:0.7rem;color:#e67e22;">⚠️ Suspicious finances</div>';
            html += '</div>';
        }

        // Investigation methods
        var methods = [
            { id: 'spy', icon: '🕵️', name: 'Hire Spies', cost: 50, desc: 'Reveals loyalty assessment and 1-2 personality traits. Moderate fear increase.', risk: 'Low' },
            { id: 'bribe_servants', icon: '💰', name: 'Bribe Their Servants', cost: 100, desc: 'Reveals TRUE loyalty, fear, ALL personality, plotting status. Risk: 20% servant reveals bribe.', risk: 'Moderate' },
            { id: 'search_finances', icon: '📊', name: 'Search Financial Records', cost: 25, desc: 'Reveals wealth, debts, financial stress, suspicious transactions.', risk: 'Low' },
            { id: 'check_alliances', icon: '🤝', name: 'Check Alliances', cost: 75, desc: 'Reveals all noble alliances and rivalries. Detects conspiracies.', risk: 'Moderate' },
            { id: 'shadow', icon: '👤', name: 'Shadow the Noble', cost: 50, desc: 'Observes daily activities. Can reveal plotting, secret meetings, habits.', risk: '15% chance spotted' }
        ];

        for (var mi = 0; mi < methods.length; mi++) {
            var m = methods[mi];
            html += '<button class="btn-medieval" data-action="kingInvestigateMethod" data-id="' + nobleId + '" data-val="' + m.id + '" style="display:block;width:100%;text-align:left;padding:8px 12px;margin-bottom:4px;font-size:0.75rem;">';
            html += m.icon + ' <strong>' + m.name + '</strong> <span style="color:#f0c040;">(' + m.cost + 'g)</span><br>';
            html += '<span style="font-size:0.68rem;color:#aaa;">' + m.desc + '</span><br>';
            html += '<span style="font-size:0.62rem;color:#e67e22;">Risk: ' + m.risk + '</span>';
            html += '</button>';
        }

        var footerHtml = '<button class="btn-medieval" data-action="kingBackToCourt">Back to Court</button>';
        openModal('🔍 Investigation: ' + escapeHtml(nobleName), html, footerHtml);
    }
    UI.openInvestigationPanel = openInvestigationPanel;

    function openInvestigationResults(nobleId, result) {
        var html = '';
        html += '<div style="background:rgba(93,173,226,0.1);border:1px solid rgba(93,173,226,0.3);border-radius:8px;padding:12px;margin-bottom:10px;">';
        html += '<div style="font-size:0.9rem;font-weight:bold;color:#5dade2;">🔍 Investigation Results</div>';
        html += '<div style="font-size:0.72rem;color:#aaa;margin-top:4px;">Method: ' + escapeHtml(result.method || 'Unknown') + ' (Cost: ' + (result.cost || 0) + 'g)</div>';
        html += '</div>';

        if (result.results && result.results.length > 0) {
            html += '<div style="background:rgba(0,0,0,0.2);border-radius:6px;padding:10px;">';
            for (var ri = 0; ri < result.results.length; ri++) {
                var isWarning = result.results[ri].indexOf('⚠️') >= 0;
                html += '<div style="font-size:0.78rem;color:' + (isWarning ? '#c44e52' : '#ccc') + ';margin-bottom:4px;padding:4px 8px;background:rgba(0,0,0,0.15);border-radius:4px;">';
                html += escapeHtml(result.results[ri]);
                html += '</div>';
            }
            html += '</div>';
        }

        var nobleName = '';
        try { var np = Engine.getPerson(nobleId); if (np) nobleName = (np.firstName || '') + ' ' + (np.lastName || ''); } catch(e) {}

        var footerHtml = '<button class="btn-medieval" data-action="kingInvestigateNoble" data-id="' + nobleId + '">🔍 Investigate Again</button> ';
        footerHtml += '<button class="btn-medieval" data-action="kingBackToCourt">Back to Court</button>';
        openModal('🔍 Results: ' + escapeHtml(nobleName.trim()), html, footerHtml);
    }
    UI.openInvestigationResults = openInvestigationResults;

    // ═══════════════════════════════════════════════════════════
    // §FEAST-KING — Enhanced Feast Dialog for King (noble selection)
    // ═══════════════════════════════════════════════════════════

    // Register action for king-specific feast actions with noble selection
    UI.registerAction('doKingFeastAction', function(_t, d) {
        var kingdomId = d.kingdom;
        var actionId = d.id;
        // Set selected noble if applicable
        var nobleSelect = document.getElementById('_feastNobleSelect');
        if (nobleSelect && nobleSelect.value) {
            try { Engine.setFeastSelectedNoble(kingdomId, nobleSelect.value); } catch(e) {}
        }
        // Set selected decree if applicable
        var decreeSelect = document.getElementById('_feastDecreeSelect');
        if (decreeSelect && decreeSelect.value) {
            try { Engine.setFeastSelectedDecree(kingdomId, decreeSelect.value); } catch(e) {}
        }
        var r = Engine.doFeastAction ? Engine.doFeastAction(kingdomId, actionId) : null;
        toast(r && r.message ? r.message : 'Action performed.', r && r.success ? 'success' : 'warning');
        UI.openFeastDialog(kingdomId);
    });

})(window.UI);