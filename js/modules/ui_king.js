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
        var tabs = [
            { id: 'overview', icon: '📊', label: 'Overview' },
            { id: 'decisions', icon: '⚖️', label: 'Decisions' },
            { id: 'kingdom', icon: '🗺️', label: 'Kingdom' },
            { id: 'court', icon: '🏰', label: 'Court' },
            { id: 'nobility', icon: '🏅', label: 'Nobility' },
            { id: 'threats', icon: '⚠️', label: 'Threats' }
        ];
        html += '<div style="display:flex;gap:3px;margin-bottom:10px;flex-wrap:wrap;">';
        for (var _ti = 0; _ti < tabs.length; _ti++) {
            var _tab = tabs[_ti];
            var _active = _kingTab === _tab.id;
            html += '<button class="btn-medieval" data-action="openKingPanel" data-id="' + _tab.id + '" style="flex:1;min-width:60px;font-size:0.72rem;padding:5px 4px;' + (_active ? 'background:rgba(212,168,67,0.35) !important;border-color:rgba(212,168,67,0.6) !important;color:#d4a843;' : '') + '">' + _tab.icon + ' ' + _tab.label + '</button>';
        }
        html += '</div>';

        // Tab content
        if (_kingTab === 'overview') html += _kingOverviewTab(kingdom, ks);
        else if (_kingTab === 'decisions') html += _kingDecisionsTab(kingdom, ks);
        else if (_kingTab === 'kingdom') html += _kingKingdomTab(kingdom, ks);
        else if (_kingTab === 'court') html += _kingCourtTab(kingdom, ks);
        else if (_kingTab === 'nobility') html += _kingNobilityTab(kingdom, ks);
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

        // Risk meters
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
                    html += '<button class="btn-medieval" data-action="kingSuePeace" data-id="' + _tgt.id + '" style="font-size:0.65rem;padding:2px 8px;background:rgba(93,173,226,0.3) !important;border-color:rgba(93,173,226,0.5) !important;">🕊️ Sue Peace</button>';
                } else {
                    html += '<button class="btn-medieval" data-action="kingDeclareWar" data-id="' + _tgt.id + '" style="font-size:0.65rem;padding:2px 8px;background:rgba(196,78,82,0.3) !important;border-color:rgba(196,78,82,0.5) !important;">⚔️ Declare War</button>';
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
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
        html += '<button class="btn-medieval" data-action="kingHostFeast" style="font-size:0.72rem;padding:4px 10px;' + (!_feastReady ? 'opacity:0.5;' : '') + '" ' + (!_feastReady ? 'disabled' : '') + '>🎉 Host Feast (500g)</button>';
        html += '<button class="btn-medieval" data-action="kingHoldCourt" style="font-size:0.72rem;padding:4px 10px;' + (!_courtReady ? 'opacity:0.5;' : '') + '" ' + (!_courtReady ? 'disabled' : '') + '>🏰 Hold Court</button>';
        html += '</div>';
        if (!_feastReady) html += '<div style="font-size:0.65rem;color:#888;margin-top:4px;">Feast available in ' + (30 - (Engine.getDay() - (ks.feastHeldDay || 0))) + ' days</div>';
        if (!_courtReady) html += '<div style="font-size:0.65rem;color:#888;">Court available in ' + (30 - (Engine.getDay() - (ks.courtHeldDay || 0))) + ' days</div>';
        html += '</div>';

        return html;
    }

    function _kingKingdomTab(kingdom, ks) {
        var html = '';
        html += '<div style="font-size:0.8rem;color:#d4a843;margin-bottom:6px;">🗺️ Towns of ' + kingdom.name + '</div>';
        try {
            var _kTowns = Engine.getTowns().filter(function(t) { return t.kingdomId === kingdom.id && !t.isOutpost && !t.isWilderness; });
            _kTowns.sort(function(a, b) { return (b.isCapital ? 1 : 0) - (a.isCapital ? 1 : 0); });
            html += '<div style="max-height:350px;overflow-y:auto;">';
            for (var _ki = 0; _ki < _kTowns.length; _ki++) {
                var _kt = _kTowns[_ki];
                var _pop = (_kt.people || []).length;
                var _hap = Math.round(_kt.happiness || 50);
                var _hapColor = _hap > 60 ? '#55a868' : _hap > 35 ? '#e67e22' : '#c44e52';
                html += '<div style="background:rgba(0,0,0,0.15);padding:6px;border-radius:6px;margin-bottom:4px;border-left:3px solid ' + (_kt.isCapital ? '#d4a843' : 'rgba(255,255,255,0.1)') + ';">';
                html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
                html += '<span style="font-size:0.8rem;color:#d4c9a0;">' + (_kt.isCapital ? '⭐ ' : '') + (_kt.name || 'Unknown') + '</span>';
                html += '<span style="font-size:0.72rem;color:' + _hapColor + ';">' + _hap + '% happy</span>';
                html += '</div>';
                html += '<div style="font-size:0.68rem;color:#888;">Pop: ' + _pop + ' | Category: ' + (_kt.category || 'village') + '</div>';
                // Garrison
                if (_kt.garrison) html += '<div style="font-size:0.68rem;color:#5dade2;">⚔️ Garrison: ' + _kt.garrison + ' soldiers</div>';
                // Quarantine
                if (_kt.quarantineLevel) html += '<div style="font-size:0.68rem;color:#c44e52;">🏥 Quarantine Level ' + _kt.quarantineLevel + '</div>';
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

        // Nobles list
        html += '<div style="font-size:0.85rem;color:#d4a843;margin-bottom:6px;">🏰 Nobles of ' + kingdom.name + '</div>';
        html += '<div style="max-height:300px;overflow-y:auto;">';
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
                var _nRank = (_n.socialRank && _n.socialRank[kingdom.id]) || 0;
                var rankName = _nRank >= 6 ? 'Royal Advisor' : _nRank >= 5 ? 'Lord' : _nRank >= 4 ? 'Minor Noble' : 'Burgher';
                // Player relationship with this noble
                var _pRel = Player.state && Player.state.relationships && Player.state.relationships[_n.id];
                var _relLevel = _pRel ? Math.round(_pRel.level) : 0;
                var _relColor = _relLevel > 60 ? '#55a868' : _relLevel > 30 ? '#d4c9a0' : '#c44e52';
                // Loan/blackmail indicators
                var _hasLoan = false, _hasBM = false;
                if (Player.state && Player.state._nobleLoans) {
                    for (var _lci = 0; _lci < Player.state._nobleLoans.length; _lci++) {
                        if (Player.state._nobleLoans[_lci].nobleId === _n.id && Player.state._nobleLoans[_lci].status === 'active') { _hasLoan = true; break; }
                    }
                }
                if (Player.state && Player.state.blackmailTargets && Player.state.blackmailTargets[_n.id]) _hasBM = true;

                html += '<div style="background:rgba(0,0,0,0.1);padding:4px 6px;border-radius:4px;margin-bottom:2px;display:flex;justify-content:space-between;align-items:center;">';
                html += '<div>';
                html += '<span style="font-size:0.75rem;color:#d4c9a0;">' + (_n.firstName || '') + ' ' + (_n.lastName || '') + '</span>';
                html += '<span style="font-size:0.65rem;color:#888;margin-left:6px;">' + rankName + '</span>';
                if (_hasLoan) html += ' <span title="Owes you a loan" style="font-size:0.65rem;">💰</span>';
                if (_hasBM) html += ' <span title="You have blackmail on them" style="font-size:0.65rem;">🔒</span>';
                html += '</div>';
                html += '<span style="font-size:0.7rem;color:' + _relColor + ';">' + _relLevel + ' ❤️</span>';
                html += '</div>';
            }
            if (_nobles.length === 0) html += '<div style="color:#888;font-size:0.75rem;">No nobles found in this kingdom.</div>';
        } catch(e) { html += '<div style="color:#888;">Error loading court data.</div>'; }
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

        // ── ROYAL DIRECTIVES ──
        try {
            if (typeof _buildRoyalDirectivesSection === 'function') {
                html += _buildRoyalDirectivesSection(citizenKingdomId, day);
            } else if (typeof UI._buildRoyalDirectivesSection === 'function') {
                html += UI._buildRoyalDirectivesSection(citizenKingdomId, day);
            }
        } catch (e) { /* ignore */ }

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
        html += '<button class="btn-medieval" data-action="openKingPanel" data-type="threats">Cancel</button>';
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


    // --- Delegated action handlers ---
    UI.registerAction('kingSetTaxRate', function() { var v = parseInt(document.getElementById('_kingTaxSlider').value) / 100; var r = Player.kingSetTaxRate(v); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingRepealLaw', function(_t, d) { var r = Player.kingRepealLaw(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingEnactLaw', function(_t, d) { var r = Player.kingEnactLaw(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingSuePeace', function(_t, d) { var r = Player.kingSuePeace(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingDeclareWar', function(_t, d) { var r = Player.kingDeclareWar(d.id); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingHostFeast', function() { var r = Player.kingHostFeast(); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingHoldCourt', function() { var r = Player.kingHoldCourt(); UI.toast(r.message, r.success ? 'success' : 'warning'); UI.openKingPanel('decisions'); });
    UI.registerAction('kingFleeConfirm', function() { var r = Player.kingFleeKingdom(); UI.closeModal(); UI.toast(r.message, r.success ? 'success' : 'warning'); });
    UI.registerAction('kingElectionVote', function(_t, d) { Engine._resolvePendingElection(Engine.findKingdom(d.kingdom), d.id); UI.closeModal(); UI.toast('Your vote has been cast.', 'success'); });
    UI.registerAction('kingElectionAbstain', function(_t, d) { Engine._resolvePendingElection(Engine.findKingdom(d.kingdom), null); UI.closeModal(); UI.toast('You abstained from voting.', 'warning'); });
    UI.registerAction('_confirmKingFlee', function() { _confirmKingFlee(); });
    UI.registerAction('_resolveRevolt', function(_t, d) { _resolveRevolt(d.id, d.val); });

})(window.UI);