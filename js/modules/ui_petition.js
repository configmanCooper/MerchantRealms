// ============================================================
// Merchant Realms — UI Petition Module (extracted from ui.js)
// Extends window.UI with petition system UI functions
// ============================================================
(function(UI) {
    "use strict";
    if (!UI) throw new Error("UI must be loaded before ui_petition.js");

    // Aliases for UI utilities
    var openModal = UI.openModal;
    var closeModal = UI.closeModal;
    var toast = UI.toast;
    var formatGold = UI.formatGold;
    var findResource = UI.findResource;
    // v9p33river325: lightweight html escape for kingdom/town names in
    // option labels (town/kingdom names shouldn't have html, but be safe).
    function escapeHtml(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

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
                // v9p33river324: guard petitioners + signatures arrays —
                // legacy/in-progress petitions may lack one or both.
                var _ptrs = Array.isArray(p.petitioners) ? p.petitioners : [];
                var _sigs = Array.isArray(p.signatures) ? p.signatures : [];
                var activePtrs = _ptrs.filter(function(pt) { return pt.active; }).length;

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
                html += '<span>' + _sigs.length + ' signatures (' + sigPct + '%)</span>';
                html += '<span>' + activePtrs + ' petitioner' + (activePtrs !== 1 ? 's' : '') + '</span>';
                html += '</div></div>';
                html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
                html += '<button class="btn-medieval" style="font-size:0.75rem;padding:4px 10px;" data-action="showPetitionDetail" data-id="' + p.id + '">📋 Manage</button>';
                if (estimate && estimate.chance > 0) {
                    html += '<button class="btn-medieval" style="font-size:0.75rem;padding:4px 10px;background:rgba(100,200,100,0.2);border-color:rgba(100,200,100,0.4);" data-action="submitPetitionUI" data-id="' + p.id + '">✅ Submit (~' + Math.floor(estimate.chance * 100) + '%)</button>';
                }
                html += '<button class="btn-medieval" style="font-size:0.75rem;padding:4px 10px;background:rgba(200,60,50,0.3);border-color:rgba(200,60,50,0.55);" data-action="cancelPetitionUI" data-id="' + p.id + '">❌ Cancel</button>';
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
                // v9p33river367: history entries from legacy saves can lack signatures.
                var _pastSigs = Array.isArray(p.signatures) ? p.signatures : [];
                html += '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #333;font-size:0.85em;">';
                html += '<span>' + (pType ? pType.icon : '📜') + ' ' + (pType ? pType.name : p.typeId) + '</span>';
                html += '<span style="color:' + statusColor + ';">' + statusIcon + ' ' + p.status + ' (' + _pastSigs.length + ' sigs)</span>';
                html += '</div>';
            }
        }

        html += '<div style="margin-top:15px;">';
        // v9p33river329: kings can't create petitions — show a hint
        // instead of the button.
        if (Player.state && Player.state.isKing && Player.state.kingState && Player.state.kingState.kingdomId) {
            html += '<div style="color:#aa7;font-size:0.85em;padding:8px;background:rgba(60,60,40,0.4);border:1px solid #665;border-radius:4px;">' +
                    '👑 As king, you don\'t need to petition. Open the <strong>King\'s panel</strong> to enact policy directly.' +
                    '</div>';
        } else {
            html += '<button class="btn-medieval" style="padding:8px 20px;background:rgba(212,160,23,0.2);border-color:rgba(212,160,23,0.5);" data-action="showCreatePetitionPanel">📜 Create New Petition</button>';
        }
        html += '</div></div>';

        openModal('Petitions', html);
    }

    function showCreatePetitionPanel() {
        // v9p33river329: kings can't petition — they enact policy directly.
        if (Player.state && Player.state.isKing && Player.state.kingState && Player.state.kingState.kingdomId) {
            toast('As king, you don\'t need to petition — use the King\'s panel to enact policy directly.', 'info', 'my_kingdom');
            return;
        }
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
            html += '<button class="btn-medieval" style="font-size:0.75rem;padding:4px 12px;margin-left:8px;" data-action="selectPetitionType" data-id="' + pt.id + '">Select</button>';
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
                // v9p33river367: names go through data-* attrs; backslash-escaping apostrophes
                // leaks into dataset values and still leaves other HTML chars unescaped.
                var _townName = kTowns[i].name || kTowns[i].id;
                html += '<button class="btn-medieval" style="display:block;width:100%;text-align:left;padding:6px 12px;margin:3px 0;font-size:0.85rem;" ';
                html += 'data-action="confirmCreatePetition" data-type="' + typeId + '" data-townid="' + kTowns[i].id + '" data-townname="' + escapeHtml(_townName) + '">';
                html += '🏘️ ' + escapeHtml(_townName);
                html += '</button>';
            }
        } else if (pt.targetType === 'town_pair') {
            html += '<h4 style="color:#ccc;">Select Towns:</h4>';
            var towns = (typeof Engine !== 'undefined' && Engine.getTowns) ? Engine.getTowns() : [];
            // v9p33river325: petitions for build_road can now request a
            // road that touches OTHER kingdoms (e.g. cross-border trade
            // road). Sort player-kingdom towns first, then group by
            // kingdom name in the dropdown for clear visual separation.
            var kingdoms = (typeof Engine !== 'undefined' && Engine.getKingdoms) ? Engine.getKingdoms() : [];
            var _kNameById = {};
            for (var _ki = 0; _ki < kingdoms.length; _ki++) _kNameById[kingdoms[_ki].id] = kingdoms[_ki].name;
            var _eligTowns = towns.filter(function(t) { return !t.isJunction && !t.isWilderness && !t.destroyed; });
            _eligTowns.sort(function(a, b) {
                var aOwn = a.kingdomId === playerKingdomId ? 0 : 1;
                var bOwn = b.kingdomId === playerKingdomId ? 0 : 1;
                if (aOwn !== bOwn) return aOwn - bOwn;
                var aK = _kNameById[a.kingdomId] || 'Independent';
                var bK = _kNameById[b.kingdomId] || 'Independent';
                if (aK !== bK) return aK.localeCompare(bK);
                return (a.name || '').localeCompare(b.name || '');
            });
            var _renderTownOptions = function() {
                var s = '';
                var _lastK = null;
                for (var i = 0; i < _eligTowns.length; i++) {
                    var t = _eligTowns[i];
                    var kName = _kNameById[t.kingdomId] || 'Independent';
                    if (kName !== _lastK) {
                        if (_lastK !== null) s += '</optgroup>';
                        var ownTag = (t.kingdomId === playerKingdomId) ? ' (Your Kingdom)' : '';
                        s += '<optgroup label="' + escapeHtml(kName + ownTag) + '">';
                        _lastK = kName;
                    }
                    s += '<option value="' + t.id + '">' + escapeHtml(t.name) + ' — ' + escapeHtml(kName) + '</option>';
                }
                if (_lastK !== null) s += '</optgroup>';
                return s;
            };
            html += '<div style="margin-bottom:8px;"><label style="color:#aaa;">From: </label>';
            html += '<select id="petFromTown" style="background:#333;color:#eee;border:1px solid #555;padding:4px;border-radius:3px;min-width:240px;">';
            html += _renderTownOptions();
            html += '</select></div>';
            html += '<div style="margin-bottom:8px;"><label style="color:#aaa;">To: </label>';
            html += '<select id="petToTown" style="background:#333;color:#eee;border:1px solid #555;padding:4px;border-radius:3px;min-width:240px;">';
            html += _renderTownOptions();
            html += '</select></div>';
            html += '<div style="font-size:0.72rem;color:#888;margin-bottom:6px;">💡 Cross-border roads: <span style="color:#c44e52;">war = much harder</span>, <span style="color:#aaa;">no relations = harder</span>, <span style="color:#6ab4ff;">trade deal = easier</span>, <span style="color:#a5d6a7;">alliance = much easier</span>.</div>';
            html += '<button class="btn-medieval" style="padding:6px 16px;" data-action="confirmCreatePetitionTownPair" data-id="' + typeId + '">Create Petition</button>';
        } else if (pt.targetType === 'port_pair') {
            html += '<h4 style="color:#ccc;">Select Port Towns:</h4>';
            var towns = (typeof Engine !== 'undefined' && Engine.getTowns) ? Engine.getTowns() : [];
            // v9p33river325: same cross-kingdom extension for sea routes.
            // Show all ports, sorted player-kingdom first, then grouped
            // by kingdom in optgroups with the kingdom name shown after
            // the port name in each option.
            var kingdoms = (typeof Engine !== 'undefined' && Engine.getKingdoms) ? Engine.getKingdoms() : [];
            var _kNameById = {};
            for (var _ki = 0; _ki < kingdoms.length; _ki++) _kNameById[kingdoms[_ki].id] = kingdoms[_ki].name;
            var portTowns = towns.filter(function(t) { return t.isPort && !t.destroyed; });
            portTowns.sort(function(a, b) {
                var aOwn = a.kingdomId === playerKingdomId ? 0 : 1;
                var bOwn = b.kingdomId === playerKingdomId ? 0 : 1;
                if (aOwn !== bOwn) return aOwn - bOwn;
                var aK = _kNameById[a.kingdomId] || 'Independent';
                var bK = _kNameById[b.kingdomId] || 'Independent';
                if (aK !== bK) return aK.localeCompare(bK);
                return (a.name || '').localeCompare(b.name || '');
            });
            if (portTowns.length < 2) {
                html += '<div style="color:#888;">Not enough port towns to establish a sea route.</div>';
            } else {
                var _renderPortOptions = function(selectedIdx) {
                    var s = '';
                    var _lastK = null;
                    for (var i = 0; i < portTowns.length; i++) {
                        var t = portTowns[i];
                        var kName = _kNameById[t.kingdomId] || 'Independent';
                        if (kName !== _lastK) {
                            if (_lastK !== null) s += '</optgroup>';
                            var ownTag = (t.kingdomId === playerKingdomId) ? ' (Your Kingdom)' : '';
                            s += '<optgroup label="' + escapeHtml(kName + ownTag) + '">';
                            _lastK = kName;
                        }
                        s += '<option value="' + t.id + '"' + (i === selectedIdx ? ' selected' : '') + '>⚓ ' + escapeHtml(t.name) + ' — ' + escapeHtml(kName) + '</option>';
                    }
                    if (_lastK !== null) s += '</optgroup>';
                    return s;
                };
                html += '<div style="margin-bottom:8px;"><label style="color:#aaa;">From Port: </label>';
                html += '<select id="petFromTown" style="background:#333;color:#eee;border:1px solid #555;padding:4px;border-radius:3px;min-width:240px;">';
                html += _renderPortOptions(0);
                html += '</select></div>';
                html += '<div style="margin-bottom:8px;"><label style="color:#aaa;">To Port: </label>';
                html += '<select id="petToTown" style="background:#333;color:#eee;border:1px solid #555;padding:4px;border-radius:3px;min-width:240px;">';
                html += _renderPortOptions(1);
                html += '</select></div>';
                html += '<div style="font-size:0.72rem;color:#888;margin-bottom:6px;">💡 Foreign sea routes: <span style="color:#c44e52;">war = much harder</span>, <span style="color:#aaa;">no relations = harder</span>, <span style="color:#6ab4ff;">trade deal = easier</span>, <span style="color:#a5d6a7;">alliance = much easier</span>.</div>';
                html += '<button class="btn-medieval" style="padding:6px 16px;" data-action="confirmCreatePetitionTownPair" data-id="' + typeId + '">Create Petition</button>';
            }
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
                html += 'data-action="confirmCreatePetition" data-type="' + typeId + '" data-roadindex="' + i + '" data-roadname="' + escapeHtml(rName) + '">';
                html += '🛤️ ' + escapeHtml(rName);
                html += '</button>';
            }
        } else if (pt.targetType === 'kingdom') {
            html += '<h4 style="color:#ccc;">Select a Kingdom:</h4>';
            var kingdoms = (typeof Engine !== 'undefined' && Engine.getKingdoms) ? Engine.getKingdoms() : [];
            for (var i = 0; i < kingdoms.length; i++) {
                if (kingdoms[i].id === playerKingdomId) continue;
                var _targetKingdomName = kingdoms[i].name || kingdoms[i].id;
                html += '<button class="btn-medieval" style="display:block;width:100%;text-align:left;padding:6px 12px;margin:3px 0;font-size:0.85rem;" ';
                html += 'data-action="confirmCreatePetition" data-type="' + typeId + '" data-targetkingdomid="' + kingdoms[i].id + '" data-targetkingdomname="' + escapeHtml(_targetKingdomName) + '">';
                html += '👑 ' + escapeHtml(_targetKingdomName);
                html += '</button>';
            }
        } else if (pt.targetType === 'resource') {
            html += '<h4 style="color:#ccc;">Select a Resource:</h4>';
            var resources = (typeof RESOURCE_TYPES !== 'undefined') ? Object.values(RESOURCE_TYPES) : []; // v9p33river389: RESOURCES doesn't exist, use RESOURCE_TYPES
            for (var i = 0; i < resources.length; i++) {
                var _resourceName = resources[i].name || resources[i].id;
                html += '<button class="btn-medieval" style="display:block;width:100%;text-align:left;padding:6px 12px;margin:3px 0;font-size:0.85rem;" ';
                html += 'data-action="confirmCreatePetition" data-type="' + typeId + '" data-resourceid="' + resources[i].id + '" data-resourcename="' + escapeHtml(_resourceName) + '">';
                html += (resources[i].icon || '📦') + ' ' + escapeHtml(_resourceName);
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
        // Prefer active petition when duplicate IDs exist
        var petition = petitions.find(function(p) { return p.id === petitionId && p.status === 'active'; })
                    || petitions.find(function(p) { return p.id === petitionId; });
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
            html += (petition.signatures || []).length + ' signatures (' + estimate.totalWeightedSignatures + ' weighted) — ' + sigPct + '% of ' + estimate.kingdomPop + ' population';
            html += '</div>';
            if (estimate.signaturesNeeded5pct > 0) {
                html += '<div style="color:#f88;font-size:0.8em;">Need ' + estimate.signaturesNeeded5pct + ' more weighted signatures for minimum chance (' + CONFIG.PETITION_MIN_SIGNATURES_PCT + '%)</div>';
            }
            if (estimate.signaturesNeeded15pct > 0 && estimate.signaturePct >= CONFIG.PETITION_MIN_SIGNATURES_PCT) {
                html += '<div style="color:#cc4;font-size:0.8em;">Need ' + estimate.signaturesNeeded15pct + ' more for good chance (' + CONFIG.PETITION_GOOD_CHANCE_PCT + '%)</div>';
            }
            if (estimate.chance > 0) {
                html += '<div style="color:#4c4;font-size:0.85em;margin-top:4px;">Estimated approval chance: <strong>' + Math.floor(estimate.chance * 100) + '%</strong></div>';
                // v9p33river328: show rank-based cap so player understands
                // why their chance is capped where it is.
                if (typeof estimate.rankCap === 'number' && estimate.rankCap < 0.99) {
                    var _rankName = (CONFIG.SOCIAL_RANKS && CONFIG.SOCIAL_RANKS[estimate.playerRankInKingdom || 0])
                                    ? CONFIG.SOCIAL_RANKS[estimate.playerRankInKingdom || 0].name
                                    : 'Commoner';
                    html += '<div style="color:#aa7;font-size:0.75em;margin-top:2px;">' +
                            'Maximum chance capped at <strong>' + Math.floor(estimate.rankCap * 100) + '%</strong> ' +
                            '(your rank in this kingdom: ' + escapeHtml(_rankName) + '). ' +
                            'Higher ranks command more political weight.</div>';
                }
            }
            html += '</div>';
        }

        // Request Signature section
        if (petition.status === 'active') {
            html += '<div style="background:rgba(40,40,40,0.8);border:1px solid #555;border-radius:4px;padding:8px;margin-bottom:10px;">';
            html += '<h4 style="color:#ddd;margin:0 0 5px;">✍️ Request Signatures (NPCs in town)</h4>';
            var world = (typeof Engine !== 'undefined') ? Engine.getWorld() : null;
            if (world && world.people) {
                var _askDay = (typeof Engine !== 'undefined') ? Engine.getDay() : 0;
                var _askCounts = (petition._askCountsDay === _askDay && petition._askCounts) ? petition._askCounts : {};
                var townNpcs = world.people.filter(function(p) {
                    return p.alive && p.townId === Player.townId &&
                           p.kingdomId === petition.kingdomId &&
                           !(petition.signatures || []).includes(p.id) &&
                           (_askCounts[p.id] || 0) < 2;
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
                        html += '<button class="btn-medieval" style="font-size:0.7rem;padding:2px 8px;" data-action="askNPCToSign" data-id="' + petition.id + '" data-val="' + npc.id + '">Ask</button>';
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
            var activePtrs = (petition.petitioners || []).filter(function(pt) { return pt.active; });
            if (activePtrs.length > 0) {
                for (var pi = 0; pi < activePtrs.length; pi++) {
                    var ptr = activePtrs[pi];
                    var ptrTown = (typeof Engine !== 'undefined') ? Engine.findTown(ptr.currentTownId) : null;
                    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #333;font-size:0.85em;">';
                    html += '<span>' + (ptr.mounted ? '🐴 Mounted' : '🚶 Basic') + ' — in ' + (ptrTown ? ptrTown.name : '?') + ' — ' + ptr.signaturesCollected + ' sigs — ' + ptr.dailyCost + 'g/day</span>';
                    html += '<button class="btn-medieval" style="font-size:0.7rem;padding:2px 8px;background:rgba(200,60,50,0.3);" data-action="firePetitionerUI" data-id="' + petition.id + '" data-val="' + ptr.id + '">Fire</button>';
                    html += '</div>';
                }
            } else {
                html += '<p style="color:#aaa;font-size:0.85em;">No active petitioners.</p>';
            }
            html += '<div style="display:flex;gap:6px;margin-top:8px;">';
            html += '<button class="btn-medieval" style="font-size:0.8rem;padding:5px 12px;" data-action="hirePetitionerUI" data-id="' + petition.id + '" data-val="false">🚶 Hire Basic (' + CONFIG.PETITIONER_BASIC_COST + 'g/day)</button>';
            html += '<button class="btn-medieval" style="font-size:0.8rem;padding:5px 12px;" data-action="hirePetitionerUI" data-id="' + petition.id + '" data-val="true">🐴 Hire Mounted (' + CONFIG.PETITIONER_MOUNTED_COST + 'g/day)</button>';
            html += '</div></div>';

            // Action buttons
            html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">';
            if (estimate && estimate.chance > 0) {
                html += '<button class="btn-medieval" style="padding:8px 16px;background:rgba(100,200,100,0.2);border-color:rgba(100,200,100,0.4);" data-action="submitPetitionUI" data-id="' + petition.id + '">✅ Submit Petition (~' + Math.floor(estimate.chance * 100) + '% chance)</button>';
            }
            html += '<button class="btn-medieval" style="padding:8px 16px;background:rgba(200,60,50,0.3);border-color:rgba(200,60,50,0.55);" data-action="cancelPetitionUI" data-id="' + petition.id + '">❌ Cancel Petition</button>';
            html += '<button class="btn-medieval" style="padding:8px 16px;" data-action="showPetitionsPanel">⬅️ Back</button>';
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
        html += '<h3 style="color:#ff6644;margin-bottom:15px;">⚔️ War Breaks Out!</h3>';
        html += '<p style="color:#ddd;margin-bottom:20px;">';
        html += '<strong style="color:' + (k1 ? k1.color : '#fff') + '">' + (k1 ? k1.name : 'Kingdom 1') + '</strong> has declared war on ';
        html += '<strong style="color:' + (k2 ? k2.color : '#fff') + '">' + (k2 ? k2.name : 'Kingdom 2') + '</strong>!';
        html += '</p>';
        html += '<p style="color:#ffa;margin-bottom:10px;">You hold rank in both kingdoms. You must choose a side!</p>';
        html += '<p style="color:#c44;font-size:0.8rem;margin-bottom:5px;">⚠️ This choice is PERMANENT — you cannot change sides!</p>';
        html += '<p style="color:#aaa;font-size:0.8rem;margin-bottom:5px;">Nobles siding against their kingdom are demoted to Guildmaster.</p>';
        html += '<p style="color:#aaa;font-size:0.8rem;margin-bottom:20px;">The abandoned kingdom: -5 rep, -5 king/noble relationships, rank becomes "Enemy".</p>';
        html += '<div style="display:flex;gap:20px;justify-content:center;">';
        html += '<button class="btn-medieval" style="padding:15px 30px;font-size:1.1rem;" data-action="resolveWarConflict" data-id="' + conflict.kingdom1 + '" title="Side with ' + (k1 ? k1.name : 'Kingdom 1') + '&#10;&#10;✅ Keep ' + k1Rank + ' rank in ' + (k1 ? k1.name : 'Kingdom 1') + '&#10;✅ +5 rep with ' + (k1 ? k1.name : 'Kingdom 1') + '&#10;❌ -5 rep with ' + (k2 ? k2.name : 'Kingdom 2') + '&#10;❌ Rank in ' + (k2 ? k2.name : 'Kingdom 2') + ' → Enemy&#10;❌ -5 rel with ' + (k2 ? k2.name : 'Kingdom 2') + ' king + nobles">';
        html += (k1 ? k1.name : 'Kingdom 1') + '<br><span style="font-size:0.75rem;color:#aaa;">Your rank: ' + k1Rank + '</span></button>';
        html += '<button class="btn-medieval" style="padding:15px 30px;font-size:1.1rem;" data-action="resolveWarConflict" data-id="' + conflict.kingdom2 + '" title="Side with ' + (k2 ? k2.name : 'Kingdom 2') + '&#10;&#10;✅ Keep ' + k2Rank + ' rank in ' + (k2 ? k2.name : 'Kingdom 2') + '&#10;✅ +5 rep with ' + (k2 ? k2.name : 'Kingdom 2') + '&#10;❌ -5 rep with ' + (k1 ? k1.name : 'Kingdom 1') + '&#10;❌ Rank in ' + (k1 ? k1.name : 'Kingdom 1') + ' → Enemy&#10;❌ -5 rel with ' + (k1 ? k1.name : 'Kingdom 1') + ' king + nobles">';
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
        confirmHtml += '<button class="btn-medieval" style="padding:10px 25px;background:rgba(200,60,50,0.35);border-color:rgba(200,60,50,0.6);color:#f0d0a0;" data-action="renounceKingdom" data-id="' + kingdomId + '">Yes, Renounce</button>';
        confirmHtml += '<button class="btn-medieval" style="padding:10px 25px;" data-action="closeModal">Cancel</button>';
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
                    html += '<button class="btn-medieval" data-action="petitionPromotion" style="margin-top:10px;font-size:0.85rem;padding:6px 16px;">\uD83D\uDCDC Petition for Promotion</button>';
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
            html += '<button class="btn-medieval" data-action="renounceKingdomUI" data-id="' + kingdomId + '" style="font-size:0.8rem;padding:5px 14px;background:rgba(200,60,50,0.35);border-color:rgba(200,60,50,0.6);color:#f0d0a0;">\u274C Renounce ' + kName + '</button>';
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
                html += '<td><button class="btn-trade sell" data-action="sellToKingdomUI" data-id="' + kingdomId + '" data-val="' + item.resourceId + '" data-qty="1" data-price="' + item.effectivePrice + '">Sell 1</button></td></tr>';
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
            html += '<td><button class="btn-trade sell" data-action="sellToKingdomUI" data-id="' + kingdomId + '" data-val="' + resId + '" data-qty="1" data-price="' + matchItem.effectivePrice + '">Sell 1</button>';
            if (inv[resId] >= 5) html += ' <button class="btn-trade sell" data-action="sellToKingdomUI" data-id="' + kingdomId + '" data-val="' + resId + '" data-qty="5" data-price="' + matchItem.effectivePrice + '">Sell 5</button>';
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
        html += '<button class="btn-tab active" data-action="switchOrdersTab" data-tab="open">📋 Open Orders</button>';
        html += '<button class="btn-tab" data-action="switchOrdersTab" data-tab="sell_crown">👑 Sell to Crown</button>';
        html += '<button class="btn-tab" data-action="switchOrdersTab" data-tab="my_orders">📦 My Orders</button>';
        html += '<button class="btn-tab" data-action="switchOrdersTab" data-tab="my_deals">🤝 My Deals</button>';
        html += '<button class="btn-tab" data-action="switchOrdersTab" data-tab="history">📜 History</button>';
        html += '</div>';

        html += '<div id="ordersTabOpen">' + buildOpenOrdersTab(kingdomId) + '</div>';
        html += '<div id="ordersTabSellCrown" style="display:none">' + buildSellToCrownTab(kingdomId) + '</div>';
        html += '<div id="ordersTabMyOrders" style="display:none">' + buildMyOrdersTab(kingdomId) + '</div>';
        html += '<div id="ordersTabMyDeals" style="display:none">' + buildMyDealsTab(kingdomId) + '</div>';
        html += '<div id="ordersTabHistory" style="display:none">' + buildHistoryTab(kingdomId) + '</div>';

        openModal('📋 Kingdom Orders — ' + kingdom.name, html);
    }

    function switchOrdersTab(tab) {
        var tabs = ['open', 'sell_crown', 'my_orders', 'my_deals', 'history'];
        var idMap = { open: 'ordersTabOpen', sell_crown: 'ordersTabSellCrown', my_orders: 'ordersTabMyOrders', my_deals: 'ordersTabMyDeals', history: 'ordersTabHistory' };
        var btns = document.querySelectorAll('.hire-tabs .btn-tab');
        btns.forEach(function(btn, i) { btn.classList.toggle('active', tabs[i] === tab); });
        for (var i = 0; i < tabs.length; i++) {
            var el = document.getElementById(idMap[tabs[i]]);
            if (el) el.style.display = tabs[i] === tab ? '' : 'none';
        }
    }

    // ── Sell to Crown tab — sell goods the kingdom urgently needs ──
    function buildSellToCrownTab(kingdomId) {
        var kingdom = Engine.findKingdom(kingdomId);
        if (!kingdom) return '<div style="padding:12px;color:#aaa;text-align:center;">Kingdom not found.</div>';
        var proc = kingdom.procurement || {};
        var needs = proc.needs || {};
        var needKeys = Object.keys(needs);
        if (needKeys.length === 0) return '<div style="padding:12px;color:#aaa;text-align:center;">The kingdom has no urgent needs right now.</div>';

        var town = Engine.findTown(Player.townId);
        var inKingdomTown = town && town.kingdomId === kingdomId;
        if (!inKingdomTown) return '<div style="padding:12px;color:#e67e22;text-align:center;">⚠️ You must be in a town belonging to this kingdom to sell goods to the crown.</div>';

        var treasury = kingdom.gold || 0;
        var inv = Player.inventory || {};
        var townSt = (Player.townStorage && Player.townStorage[Player.townId]) || (Player.state && Player.state.townStorage && Player.state.townStorage[Player.townId]) || {};

        // Build sorted list: items player has first, then others
        var items = [];
        for (var ni = 0; ni < needKeys.length; ni++) {
            var resId = needKeys[ni];
            var need = needs[resId];
            if (!need || need.qtyNeeded <= 0) continue;
            var res = findResource(resId);
            if (!res) continue;
            var marketPrice = (town.market && town.market.prices && town.market.prices[resId]) ? town.market.prices[resId] : (res.basePrice || 1);
            var bannedGoods = (kingdom.laws && kingdom.laws.bannedGoods) || [];
            var isBanned = bannedGoods.indexOf(resId) >= 0;
            var urgencyMult;
            if (isBanned) {
                // Banned goods: crown pays BELOW market — 10% less max at urgent
                urgencyMult = need.urgency >= 80 ? 0.90 : (need.urgency >= 50 ? 0.75 : 0.60);
            } else {
                // Normal goods: modest premium based on urgency
                urgencyMult = 1.0 + (need.urgency / 100) * 0.15;
            }
            var crownPrice = Math.ceil(marketPrice * urgencyMult);
            var playerQty = (inv[resId] || 0) + (townSt[resId] || 0);
            items.push({
                resId: resId, name: res.name, icon: res.icon || '📦',
                urgency: need.urgency, qtyNeeded: need.qtyNeeded,
                marketPrice: marketPrice, crownPrice: crownPrice,
                multiplier: urgencyMult.toFixed(2),
                playerQty: playerQty, isBanned: isBanned
            });
        }
        // Sort: highest urgency first, player-held items first within same urgency tier
        items.sort(function(a, b) {
            var aHas = a.playerQty > 0 ? 1 : 0;
            var bHas = b.playerQty > 0 ? 1 : 0;
            if (aHas !== bHas) return bHas - aHas;
            return b.urgency - a.urgency;
        });

        var html = '<div style="padding:8px;">';
        html += '<div style="margin-bottom:8px;">';
        html += '<span style="font-size:0.82rem;font-weight:bold;color:#f0d0a0;">👑 Sell Goods to ' + kingdom.name + '</span>';
        html += '</div>';
        var lowTreasury = treasury < 2000;
        if (lowTreasury) {
            html += '<div style="font-size:0.75rem;color:#e74c3c;margin-bottom:8px;">⚠️ The kingdom\'s coffers are too low to purchase goods right now.</div>';
        } else {
            html += '<div style="font-size:0.72rem;color:#aaa;margin-bottom:8px;">The crown buys goods it needs. Normal goods get a small premium; banned goods pay below market (smuggling may be more profitable).</div>';
        }

        html += '<div style="max-height:350px;overflow-y:auto;">';
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var urgColor = it.urgency >= 60 ? '#e74c3c' : it.urgency >= 30 ? '#e67e22' : '#aaa';
            var urgLabel = it.urgency >= 60 ? '🔴 Urgent' : it.urgency >= 30 ? '🟡 Needed' : '⚪ Low';
            var hasGoods = it.playerQty > 0;
            var borderColor = hasGoods ? 'rgba(200,160,23,0.3)' : 'rgba(255,255,255,0.05)';

            html += '<div style="padding:8px;margin:4px 0;background:rgba(0,0,0,0.2);border-radius:4px;border:1px solid ' + borderColor + ';">';
            // Header row: item name + urgency badge
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<span style="font-size:0.82rem;">' + it.icon + ' <strong>' + it.name + '</strong>' + (it.isBanned ? ' <span style="font-size:0.6rem;color:#e74c3c;cursor:help;" title="Banned items are illegal to make or sell, but legal to buy or own in small amounts.">🚫 BANNED</span>' : '') + '</span>';
            html += '<span style="font-size:0.7rem;color:' + urgColor + ';">' + urgLabel + ' (' + it.urgency + ')</span>';
            html += '</div>';
            // Price info row
            var _multColor = parseFloat(it.multiplier) < 1.0 ? '#e74c3c' : '#55a868';
            html += '<div style="font-size:0.75rem;color:#ccc;margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;">';
            html += '<span>Crown Price: <strong style="color:var(--gold);">' + it.crownPrice + 'g</strong></span>';
            html += '<span style="color:#888;">Market: ' + it.marketPrice + 'g</span>';
            html += '<span style="color:' + _multColor + ';">' + it.multiplier + 'x</span>';
            html += '<span style="color:#888;">Needs: ' + it.qtyNeeded + '</span>';
            html += '</div>';

            if (hasGoods) {
                var invQty = inv[it.resId] || 0;
                var tsQty = townSt[it.resId] || 0;
                var srcNote = (invQty > 0 && tsQty > 0) ? ' (' + invQty + ' inv + ' + tsQty + ' storage)' : (tsQty > 0 && invQty === 0 ? ' (town storage)' : '');
                html += '<div style="font-size:0.75rem;color:#7bed9f;margin-top:4px;">You have: <strong>' + it.playerQty + '</strong>' + srcNote + '</div>';
                html += '<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;align-items:center;">';
                var sellQtys = [1, 5, 10, 25, 50];
                for (var si = 0; si < sellQtys.length; si++) {
                    if (it.playerQty >= sellQtys[si]) {
                        html += '<button class="btn-trade sell" style="font-size:0.68rem;padding:2px 8px;' + (lowTreasury ? 'opacity:0.4;cursor:not-allowed;' : '') + '" ' + (lowTreasury ? 'disabled' : 'data-action="sellToCrownUI" data-id="' + kingdomId + '" data-val="' + it.resId + '" data-qty="' + sellQtys[si] + '" data-price="' + it.crownPrice + '"') + '>Sell ' + sellQtys[si] + '</button>';
                    }
                }
                if (it.playerQty > 1) {
                    html += '<button class="btn-trade sell" style="font-size:0.68rem;padding:2px 8px;' + (lowTreasury ? 'opacity:0.4;cursor:not-allowed;' : '') + '" ' + (lowTreasury ? 'disabled' : 'data-action="sellToCrownUI" data-id="' + kingdomId + '" data-val="' + it.resId + '" data-qty="' + it.playerQty + '" data-price="' + it.crownPrice + '"') + '>Sell All (' + it.playerQty + ')</button>';
                }
                html += '</div>';
            } else {
                html += '<div style="font-size:0.72rem;color:#666;margin-top:4px;">You don\'t have any to sell.</div>';
            }
            html += '</div>';
        }
        html += '</div></div>';
        return html;
    }

    function sellToCrownUI(kingdomId, resourceId, qty, pricePerUnit) {
        if (typeof Player === 'undefined' || !Player.sellToKingdom) return;
        var result = Player.sellToKingdom(kingdomId, resourceId, parseInt(qty), parseInt(pricePerUnit));
        if (result.success) {
            toast(result.message, 'success');
            // Refresh the orders panel to update quantities
            showKingdomOrdersPanel(kingdomId);
            // Switch back to the sell_crown tab
            setTimeout(function() { switchOrdersTab('sell_crown'); }, 50);
        } else {
            toast(result.message, 'error');
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
            html += 'Qty: <strong>' + (o.qty || o.qtyNeeded || '?') + '</strong> · Max Price: <strong>' + (o.maxPricePerUnit || o.maxPrice || '?') + 'g</strong>/unit · Bids: ' + (o.bids ? o.bids.length : 0);
            html += '</div>';
            if (playerBid) {
                html += '<div style="font-size:0.75rem;color:#7bed9f;margin-top:3px;">✅ You bid ' + playerBid.pricePerUnit + 'g/unit</div>';
            } else {
                html += '<div style="margin-top:6px;">';
                html += '<button class="btn-medieval" data-action="showBidModal" data-id="' + o.id + '" style="font-size:0.75rem;padding:4px 12px;background:rgba(100,180,255,0.15);border-color:rgba(100,180,255,0.3);">💰 Place Bid</button>';
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
                    html += '<button class="btn-medieval" data-action="showDeliverOrderModal" data-id="' + o.id + '" style="font-size:0.75rem;padding:4px 12px;background:rgba(46,204,113,0.15);border-color:rgba(46,204,113,0.3);">📦 Deliver</button>';
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
            html += '<button class="btn-medieval" data-action="showNegotiateDealPanel" data-id="' + kingdomId + '" style="font-size:0.8rem;padding:6px 14px;background:rgba(100,200,100,0.15);border-color:rgba(100,200,100,0.3);">🤝 Negotiate New Deal</button>';
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
                    html += '<button class="btn-medieval" data-action="deliverSupplyDealUI" data-id="' + d.id + '" style="font-size:0.75rem;padding:4px 12px;background:rgba(46,204,113,0.15);border-color:rgba(46,204,113,0.3);">📦 Deliver</button>';
                }
                html += '<button class="btn-medieval" data-action="cancelSupplyDealUI" data-id="' + d.id + '" style="font-size:0.75rem;padding:4px 12px;background:rgba(231,76,60,0.15);border-color:rgba(231,76,60,0.3);">❌ Cancel</button>';
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        html += '<div style="text-align:center;margin-top:8px;">';
        html += '<button class="btn-medieval" data-action="showNegotiateDealPanel" data-id="' + kingdomId + '" style="font-size:0.8rem;padding:6px 14px;background:rgba(100,200,100,0.15);border-color:rgba(100,200,100,0.3);">🤝 Negotiate New Deal</button>';
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
        html += '<button class="btn-medieval" data-action="submitBid" data-id="' + orderId + '" style="font-size:0.85rem;padding:6px 18px;background:rgba(100,180,255,0.2);border-color:rgba(100,180,255,0.4);">💰 Submit Bid</button>';
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
        html += '<button class="btn-medieval" data-action="executeDeliverOrder" data-id="' + orderId + '" style="font-size:0.85rem;padding:6px 18px;background:rgba(46,204,113,0.2);border-color:rgba(46,204,113,0.4);">📦 Deliver</button>';
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
        html += '<button class="btn-medieval" data-action="submitDealProposal" data-id="' + kingdomId + '" style="font-size:0.85rem;padding:6px 18px;background:rgba(100,200,100,0.2);border-color:rgba(100,200,100,0.4);">🤝 Propose Deal</button>';
        html += '<button class="btn-medieval" data-action="showKingdomOrdersPanel" data-id="' + kingdomId + '" style="font-size:0.85rem;padding:6px 18px;">◀ Back</button>';
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
        html += '<button class="btn-medieval" data-action="executeDeliverDeal" data-id="' + dealId + '" style="font-size:0.85rem;padding:6px 18px;background:rgba(46,204,113,0.2);border-color:rgba(46,204,113,0.4);">📦 Deliver</button>';
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
                html += '<div style="margin-top:12px;"><button class="btn-medieval" data-action="buyFreedomUI">💰 Pay ' + cost + 'g for Freedom</button></div>';
            } else {
                html += '<p style="color:#c44e52;">You need ' + cost + 'g to buy your freedom. You have ' + Math.floor(Player.gold) + 'g.</p>';
                html += '<p>You are now an indentured servant of ' + kingdom.name + '.</p>';
            }
        } else if (conquestChoice === 'raid') {
            html += '<p style="color:#c44e52;">The town has been brutally sacked! Many have perished and survivors have been enslaved.</p>';
            var cost2 = CONFIG.SERVITUDE_FREEDOM_COST;
            if (Player.gold >= cost2) {
                html += '<div style="margin-top:12px;"><button class="btn-medieval" data-action="buyFreedomUI">💰 Pay ' + cost2 + 'g for Freedom</button></div>';
            } else {
                html += '<p style="color:#c44e52;">You are now an indentured servant of ' + kingdom.name + '.</p>';
            }
        }

        html += '</div>';
        openModal('⚔️ Conquest!', html, '<button class="btn-medieval" data-action="closeModal">Continue</button>');
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
            UI.openSpecialStartPanel();
        }
    }

    var _lastHeirSelectionArgs = null; // cache for go-back from confirmation

    // ── HEIR SELECTION UI ──
    // Shown when player dies and has multiple heir options (children + spouse)
    function showHeirSelectionUI(heirOptions, deceasedName, totalGold) {
        _lastHeirSelectionArgs = [heirOptions, deceasedName, totalGold];
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

            html += '<div data-action="confirmHeirSelection" data-id="' + npc.id + '" data-val="' + type + '" style="';
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
            if (npc.occupation && npc.occupation !== 'None' && type !== 'child_young') html += ' • ' + npc.occupation;
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

        // Hide close button — player must select an heir
        var closeBtn = document.querySelector('#modal .modal-close, #modal [data-action="closeModal"]');
        if (!closeBtn) closeBtn = document.getElementById('btnCloseModal');
        if (closeBtn) closeBtn.style.display = 'none';
    }

    function confirmHeirSelection(heirId, heirType) {
        var typeName = heirType === 'spouse' ? 'spouse' : 'child';
        if (heirType === 'child_young') typeName = 'young child (regency will begin)';

        // Find the heir name for confirmation
        var npc = Engine.findPerson(heirId);
        var heirName = npc ? (npc.firstName + ' ' + npc.lastName) : 'this heir';
        var heirAge = npc ? npc.age : '?';
        var heirOcc = npc ? (npc.occupation || 'commoner').replace(/_/g, ' ') : '';
        var heirSex = npc ? (npc.sex === 'F' ? '♀' : '♂') : '';

        var html = '';
        html += '<div style="text-align:center;padding:15px 10px;">';
        html += '<div style="font-size:48px;margin-bottom:10px;">⚔️</div>';
        html += '<p style="font-size:17px;color:#ff9;margin-bottom:6px;font-weight:bold;">Continue as ' + heirName + '?</p>';
        html += '<p style="color:#bbb;font-size:13px;margin-bottom:14px;">' + heirSex + ' Age ' + heirAge + ' • ' + heirOcc + ' • ' + typeName + '</p>';
        html += '<div style="background:#3a1a1a;border:1px solid #a55;border-radius:6px;padding:12px 16px;margin:0 10px 18px;text-align:center;">';
        html += '<span style="color:#f88;font-size:13px;">⚠️ This cannot be undone. Your current character\'s story ends here.</span>';
        html += '</div>';
        html += '<div style="display:flex;gap:12px;justify-content:center;">';
        html += '<button data-action="confirmHeirFinal" data-id="' + heirId + '" style="padding:10px 28px;background:#4a7a4a;border:1px solid #6a6;border-radius:6px;color:#fff;cursor:pointer;font-size:14px;font-weight:bold;transition:all 0.2s;" onmouseover="this.style.background=\'#5a9a5a\'" onmouseout="this.style.background=\'#4a7a4a\'">✔ Accept Legacy</button>';
        html += '<button data-action="cancelHeirSelection" style="padding:10px 28px;background:#4a3a3a;border:1px solid #855;border-radius:6px;color:#ccc;cursor:pointer;font-size:14px;transition:all 0.2s;" onmouseover="this.style.background=\'#5a4a4a\'" onmouseout="this.style.background=\'#4a3a3a\'">← Go Back</button>';
        html += '</div>';
        html += '</div>';

        openModal('⚔️ Confirm Succession', html, '');

        // Register actions
        UI.registerAction('confirmHeirFinal', function(el) {
            var id = el.getAttribute('data-id');
            closeModal();
            Player.selectHeir(id);
        });
        UI.registerAction('cancelHeirSelection', function() {
            // Re-open the succession heir selection panel
            if (_lastHeirSelectionArgs) {
                showHeirSelectionUI(_lastHeirSelectionArgs[0], _lastHeirSelectionArgs[1], _lastHeirSelectionArgs[2]);
            } else {
                closeModal();
            }
        });
    }

    // ========================================================
    // CHILD NAMING DIALOG
    // ========================================================
    function showChildNamingDialog(childId, childSex, spouseSuggestion, spouseFirstName) {
        var genderLabel = childSex === 'M' ? 'son' : 'daughter';
        var genderIcon = childSex === 'M' ? '👶🏻' : '👶🏻';
        var html = '';
        html += '<div style="text-align:center;padding:10px 0;">';
        html += '<div style="font-size:48px;margin-bottom:8px;">🍼</div>';
        html += '<p style="font-size:16px;color:#ff9;margin-bottom:4px;">A ' + genderLabel + ' is born!</p>';
        html += '<p style="color:#ccc;font-size:13px;margin-bottom:16px;">Choose a name for your child:</p>';
        html += '</div>';

        // Name input
        html += '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 20px;">';
        html += '<input id="childNameInput" type="text" maxlength="20" placeholder="Enter a name..." ';
        html += 'style="width:100%;max-width:280px;padding:10px 14px;font-size:16px;border:2px solid #555;border-radius:6px;';
        html += 'background:#1a1a1a;color:#fff;text-align:center;outline:none;font-family:inherit;" ';
        html += 'onfocus="this.style.borderColor=\'#ff9\'" onblur="this.style.borderColor=\'#555\'">';

        // Spouse suggestion
        if (spouseFirstName && spouseSuggestion) {
            html += '<div style="margin-top:4px;">';
            html += '<button data-action="useSpouseSuggestion" data-val="' + spouseSuggestion.replace(/'/g, "\\'") + '" data-label="✓ ' + spouseFirstName.replace(/'/g, "\\'") + ' suggests: ' + spouseSuggestion.replace(/'/g, "\\'") + '" ';
            html += 'style="padding:8px 16px;background:#2a2a3a;border:1px solid #55a;border-radius:4px;color:#aaf;cursor:pointer;font-size:13px;';
            html += 'transition:all 0.2s;" onmouseover="this.style.background=\'#3a3a4a\'" onmouseout="if(!this.textContent.startsWith(\'✓\'))this.style.background=\'#2a2a3a\'">';
            html += '💬 ' + spouseFirstName + ' suggests: <strong>' + spouseSuggestion + '</strong>';
            html += '</button>';
            html += '<div style="font-size:11px;color:#888;margin-top:4px;">Using this name will make ' + spouseFirstName + ' happy (+10 ❤️)</div>';
            html += '</div>';
        }

        // Confirm button
        html += '<button data-action="confirmChildName" data-id="' + childId + '" data-val="' + (spouseSuggestion || '').replace(/'/g, "\\'") + '" ';
        html += 'style="margin-top:8px;padding:10px 32px;background:#3a5a3a;border:2px solid #5a5;border-radius:6px;color:#fff;';
        html += 'cursor:pointer;font-size:15px;font-weight:bold;transition:all 0.2s;" ';
        html += 'onmouseover="this.style.background=\'#4a6a4a\'" onmouseout="this.style.background=\'#3a5a3a\'">';
        html += '✅ Name My Child</button>';

        html += '</div>';

        openModal('🍼 Name Your Child', html, '');

        // Hide close button — must name the child
        var closeBtn = document.querySelector('#modal .modal-close, #modal [data-action="closeModal"]');
        if (!closeBtn) closeBtn = document.getElementById('btnCloseModal');
        if (closeBtn) closeBtn.style.display = 'none';

        // Focus the input after a brief delay
        setTimeout(function() {
            var inp = document.getElementById('childNameInput');
            if (inp) inp.focus();
        }, 100);
    }

    function _confirmChildName(childId, spouseSuggestion) {
        var inp = document.getElementById('childNameInput');
        var chosenName = inp ? inp.value.trim() : '';
        if (!chosenName) {
            if (inp) { inp.style.borderColor = '#f55'; inp.placeholder = 'Please enter a name!'; }
            return;
        }

        var usedSpouseSuggestion = (spouseSuggestion && chosenName === spouseSuggestion);

        // Restore close button and close modal
        var closeBtn = document.getElementById('btnCloseModal');
        if (closeBtn) closeBtn.style.display = '';
        closeModal();

        // Call Player.confirmChildName
        if (typeof Player !== 'undefined' && Player.confirmChildName) {
            Player.confirmChildName(childId, chosenName, usedSpouseSuggestion);
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
            html += '<br><button class="btn-medieval" data-action="openSuccessionCrisisDialog" data-id="' + kingdomId + '" style="font-size:0.75rem;padding:3px 8px;margin-top:4px;">👑 View Details / Influence</button>';
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
            html += '<div style="padding:4px 8px;color:#ff6b6b;cursor:help;" title="Banned items are illegal to make or sell, but legal to buy or own in small amounts.">🚫 <b>Banned Goods:</b> ' + kingdom.laws.bannedGoods.join(', ') + ' — Trading these is illegal!</div>';
        } else {
            html += '<div style="padding:4px 8px;color:#6bff6b;">✅ No banned goods</div>';
        }
        if (kingdom.laws && kingdom.laws.restrictedGoods && kingdom.laws.restrictedGoods.length > 0) {
            html += '<div style="padding:4px 8px;color:#ffaa6b;cursor:help;" title="Legal to buy. Illegal to sell or produce without a license. Purchase a license from the Kingdom menu.">⚠️ <b>Restricted Goods:</b> ' + kingdom.laws.restrictedGoods.join(', ') + ' — Require permits to trade</div>';
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

        // Crime Punishments section
        if (typeof CONFIG !== 'undefined' && CONFIG.CRIME_TYPES && CONFIG.CRIME_TYPES.length > 0) {
            html += '<h4 style="margin:12px 0 4px;">⚖️ Crime Punishments</h4>';
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;">';
            for (var ci = 0; ci < CONFIG.CRIME_TYPES.length; ci++) {
                var crime = CONFIG.CRIME_TYPES[ci];
                var cp = (kingdom.crimePunishments && kingdom.crimePunishments[crime.id]) || null;
                var pType = cp ? cp.type : crime.defaultPunishment;
                var pFine = cp ? (cp.fine != null ? cp.fine : crime.defaultFine) : crime.defaultFine;
                var pJail = cp ? (cp.jailDays != null ? cp.jailDays : crime.defaultJailDays) : crime.defaultJailDays;

                var pColor = pType === 'execution' ? '#ff4444' : pType === 'jail' ? '#ffaa44' : '#dddd44';
                var pLabel = '';
                if (pType === 'execution') {
                    pLabel = 'Execution';
                } else if (pType === 'jail') {
                    pLabel = 'Jail ' + pJail + 'd' + (pFine > 0 ? ' + ' + pFine + 'g' : '');
                } else {
                    pLabel = 'Fine ' + pFine + 'g';
                }
                html += '<div style="padding:2px 4px;font-size:0.85rem;">' + (crime.icon || '⚖️') + ' <b>' + crime.name + ':</b> <span style="color:' + pColor + ';">' + pLabel + '</span></div>';
            }
            html += '</div>';
        }

        html += '</div>';

        openModal('📜 Laws of ' + kingdom.name, html,
            '<button class="btn-medieval" data-action="closeModal">Close</button>');
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
        html += '<h3 style="margin:0 0 8px;color:var(--gold);">📊 ' + escapeHtml(town.name || 'Town') + ' Prosperity: ' + p.toFixed(1) + '/100</h3>';

        var barColor = p > 70 ? '#55a868' : p > 40 ? '#ccb44c' : '#c44e52';
        html += '<div style="background:#333;border-radius:4px;height:12px;margin-bottom:12px;"><div style="background:' + barColor + ';height:100%;width:' + p + '%;border-radius:4px;"></div></div>';

        html += '<h4 style="color:var(--gold);margin:8px 0 4px;">📈 Positive Factors</h4>';

        var positives = [];
        var negatives = [];

        // v9p33river367: outposts/minor towns can lack a market; keep the panel working.
        var _prosperitySupply = (town.market && town.market.supply) || {};
        var _prosperityDemand = (town.market && town.market.demand) || {};
        var totalSupply = 0, totalDemand = 0;
        for (var rid in _prosperitySupply) { totalSupply += (_prosperitySupply[rid] || 0); }
        for (var rid2 in _prosperityDemand) { totalDemand += (_prosperityDemand[rid2] || 0); }
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
            '<button class="btn-medieval" data-action="closeModal">Close</button>');
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
            return parts.map(function(p) {
                if (p.indexOf('🚫 Banned') >= 0) return '<div style="padding:2px 0;cursor:help;" title="Banned items are illegal to make or sell, but legal to buy or own in small amounts.">' + p + '</div>';
                return '<div style="padding:2px 0;">' + p + '</div>';
            }).join('');
        }

        var html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr><th style="width:50%;padding:8px;border-bottom:2px solid rgba(255,215,0,0.3);text-align:left;">' + kA.name + '</th>';
        html += '<th style="width:50%;padding:8px;border-bottom:2px solid rgba(255,215,0,0.3);text-align:left;">' + kB.name + '</th></tr>';
        html += '<tr><td style="padding:8px;vertical-align:top;">' + lawCell(kA) + '</td>';
        html += '<td style="padding:8px;vertical-align:top;">' + lawCell(kB) + '</td></tr>';
        html += '</table>';

        openModal('⚖️ Law Comparison', html,
            '<button class="btn-medieval" data-action="closeModal">Close</button>');
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
                    html += '<button class="btn-medieval" data-action="fulfillCommissionUI" data-id="' + kingdomId + '" data-val="' + comm.id + '" style="font-size:0.8rem;padding:4px 10px;margin-top:4px;">✅ Fulfill Commission</button>';
                } else if (comm.type === 'building_request') {
                    html += '<div style="margin-top:4px;font-size:0.8rem;color:#ff9f43;">🏗️ Build the requested building to fulfill this commission.</div>';
                }
                html += '</div>';
            }
        }
        html += '</div>';

        openModal('📜 Royal Commissions — ' + kingdom.name, html,
            '<button class="btn-medieval" data-action="closeModal">Close</button>');
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
                Engine.logEvent('✅ Fulfilled royal commission for ' + kingdom.name + ': ' + comm.description + ' → +' + result.reward + 'g, +' + result.repReward + ' rep', null, 'my_actions');
            }
            openRoyalCommissionsPanel(kingdomId); // refresh
        } else {
            toast(result ? result.reason : 'Failed.', 'danger');
        }
    }

    function openKingdomDonateDialog(kingdomId) {
        var kingdom = null;
        try { kingdom = Engine.findKingdom(kingdomId); } catch(e) {}
        if (!kingdom) { toast('Kingdom not found.', 'warning'); return; }
        var playerGold = (typeof Player !== 'undefined') ? (Player.gold || 0) : 0;
        var playerRep = (typeof Player !== 'undefined' && Player.reputation) ? Math.floor(Player.reputation[kingdomId] || 50) : 50;

        var html = '<div style="max-height:400px;overflow-y:auto;">';
        html += '<div style="font-size:0.85rem;margin-bottom:8px;">Your gold: <strong style="color:#ffd700;">' + playerGold + 'g</strong> &nbsp;|&nbsp; Rep with ' + kingdom.name + ': <strong>' + playerRep + '/100</strong></div>';
        html += '<div style="font-size:0.78rem;color:var(--text-dim);margin-bottom:10px;">Donate gold to the kingdom treasury. Each 500g gives +1 reputation.</div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';

        var amounts = [
            { gold: 500, rep: 1 },
            { gold: 1000, rep: 2 },
            { gold: 2500, rep: 5 },
            { gold: 5000, rep: 10 },
        ];
        for (var i = 0; i < amounts.length; i++) {
            var a = amounts[i];
            var canAfford = playerGold >= a.gold;
            html += '<button class="btn-medieval" style="font-size:0.8rem;padding:6px 12px;" ' + (canAfford ? '' : 'disabled') + ' data-action="donateToKingdom" data-id="' + kingdomId + '" data-val="' + a.rep + '">💰 ' + a.gold + 'g (+' + a.rep + ' rep)</button>';
        }
        html += '</div></div>';

        openModal('💰 Donate to ' + kingdom.name, html,
            '<button class="btn-medieval" data-action="closeModal">Close</button>');
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
        html += '<button class="btn-medieval" data-action="respondConscription" data-val="report" style="margin-top:6px;">⚔️ Report for Duty</button>';
        html += '</div>';

        // Option 2: Pay (if eligible)
        html += '<div style="background:rgba(255,215,0,0.1);padding:10px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(255,215,0,0.3);' + (canPay ? '' : 'opacity:0.5;') + '">';
        html += '<b>💰 Pay Exemption Fee (' + (cfg.exemptionFee || 5000) + 'g)</b><br>';
        html += '<span class="text-dim">Requires Minor Noble rank (4+) and ' + (cfg.exemptionFee || 5000) + 'g. Fee goes to the kingdom treasury.</span><br>';
        if (canPay) {
            html += '<button class="btn-medieval" data-action="respondConscription" data-val="pay" style="margin-top:6px;">💰 Pay ' + (cfg.exemptionFee || 5000) + 'g</button>';
        } else {
            html += '<span style="color:#ff6b6b;font-size:0.8rem;">' + (highestRank < (cfg.exemptionMinRank || 4) ? 'Rank too low (need Minor Noble+)' : 'Not enough gold') + '</span>';
        }
        html += '</div>';

        // Option 3: Dodge
        html += '<div style="background:rgba(200,50,50,0.1);padding:10px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(200,50,50,0.3);">';
        html += '<b>🏃 Dodge Conscription</b><br>';
        html += '<span class="text-dim">Refuse to report. Risk of being caught and sentenced to 2 years in prison. Being outside the kingdom greatly reduces catch chance. Stealth skills help.</span><br>';
        html += '<button class="btn-medieval" data-action="respondConscription" data-val="dodge" style="margin-top:6px;background:rgba(200,60,50,0.3);border-color:rgba(200,60,50,0.55);">🏃 Dodge (Risky)</button>';
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
        html += '<p><b>Sentence remaining:</b> ' + daysLeft + ' days (' + (daysLeft / (CONFIG.DAYS_PER_SEASON || 90)).toFixed(1) + ' years)</p>';
        html += '<p class="text-dim">While in jail, you cannot trade, travel, work, or interact with the world. The world continues to simulate around you.</p>';
        html += '</div>';

        if (canFastForward && daysLeft > 0) {
            html += '<div style="background:rgba(100,150,255,0.1);padding:10px;border-radius:6px;border:1px solid rgba(100,150,255,0.3);">';
            html += '<b>⏩ Fast Forward</b><br>';
            html += '<span class="text-dim">Skip ahead through your sentence. The game will simulate ' + daysLeft + ' days of world activity while you serve your time.</span><br>';
            html += '<button class="btn-medieval" data-action="fastForwardJailUI" style="margin-top:6px;">⏩ Skip ' + daysLeft + ' Days</button>';
            html += '</div>';
        }

        html += '</div>';

        openModal('🔒 Prison', html,
            '<button class="btn-medieval" data-action="closeModal">Close</button>');
    }

    function fastForwardJailUI() {
        if (typeof Player === 'undefined') return;
        if (!Player.jailedUntilDay || Player.jailedUntilDay <= Engine.getDay()) {
            toast('Not currently jailed.', 'info'); return;
        }
        window._jailFastForwarding = true;
        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(120);
        toast('⏩ Fast-forwarding at 120x until release...', 'info');
    }

    function attemptJailEscapeUI() {
        if (typeof Player === 'undefined' || !Player.attemptJailEscape) return;
        var result = Player.attemptJailEscape();
        toast(result.message, result.success ? 'success' : 'danger');
        if (result.success) {
            var jp = document.getElementById('jailPanel');
            if (jp) jp.remove();
        }
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
                    html += '<br><button class="btn-medieval" data-action="backPretenderUI" data-id="' + kingdomId + '" data-val="' + pr.id + '" style="font-size:0.75rem;padding:3px 8px;margin-top:4px;">💰 Back with 10,000g</button>';
                }
                html += '</div>';
            }
        }

        if (!canInfluence && !crisis.playerBacking) {
            html += '<p class="text-dim" style="font-size:0.8rem;">Requires Lord rank (5+), 10,000g, and 70+ reputation to influence the succession.</p>';
        }

        html += '</div>';

        openModal('⚠️ Succession Crisis — ' + kingdom.name, html,
            '<button class="btn-medieval" data-action="closeModal">Close</button>');
    }

    function backPretenderUI(kingdomId, pretenderId) {
        var cfg = (typeof CONFIG !== 'undefined' && CONFIG.SUCCESSION_CRISIS) ? CONFIG.SUCCESSION_CRISIS : {};
        var cost = cfg.minGoldToInfluence || 10000;
        if (typeof Player !== 'undefined' && Player.state && Player.state.gold < cost) {
            toast('Not enough gold. Need ' + cost + 'g.', 'danger'); return;
        }
        // v9p33river417: removed UI gold deduction — engine.backPretender handles it
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
            if (!curPos && Player.worldX != null) curPos = { x: Player.worldX, y: Player.worldY };
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
        } else if (Player.worldX != null && Player.worldY != null) {
            startX = Player.worldX;
            startY = Player.worldY;
        } else {
            toast('Cannot determine current location.', 'warning'); return;
        }

        var dist = Math.hypot(worldX - startX, worldY - startY);
        var offRoadMult = (CONFIG.OFFROAD_SPEED_MULTIPLIER || 0.25);
        if (Player.hasSkill && Player.hasSkill('cartographer')) offRoadMult *= 1.5;
        var effectiveDist = dist / offRoadMult;
        if (Player.horses && Player.horses.length > 0) {
            effectiveDist *= (1 - (CONFIG.HORSE_TRAVEL_SPEED_BONUS || 0.3));
            if (Player.horses.some(function(h) { return h.saddled; })) effectiveDist *= (1 - 0.3);
        }
        // v9p33river131: actual travel uses CARAVAN_BASE_SPEED * 1.5 per day.
        // The previous hard-coded 30 * 1.5 (=45) made estimates ~4x too high.
        var estDays = Math.max(1, Math.ceil(effectiveDist / ((CONFIG.CARAVAN_BASE_SPEED || 120) * 1.5)));

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
        html += '<button class="btn-medieval" style="flex:1;" data-action="travelToCoords" data-x="' + worldX + '" data-y="' + worldY + '">\uD83E\uDDB6 Go</button>';
        html += '<button class="btn-medieval" style="flex:1;opacity:0.6;" data-action="closeModal">Cancel</button>';
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

        // Attach drag handler once
        if (!panel._dragInit) {
            panel._dragInit = true;
            var header = panel.querySelector('.travel-panel-header');
            if (header) {
                var dx = 0, dy = 0, sx = 0, sy = 0;
                header.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    sx = e.clientX; sy = e.clientY;
                    panel.style.transform = 'none';
                    function onMove(e2) {
                        dx = e2.clientX - sx; dy = e2.clientY - sy;
                        sx = e2.clientX; sy = e2.clientY;
                        var t = panel.offsetTop + dy;
                        var l = panel.offsetLeft + dx;
                        t = Math.max(0, Math.min(window.innerHeight - 40, t));
                        l = Math.max(-panel.offsetWidth + 40, Math.min(window.innerWidth - 40, l));
                        panel.style.top = t + 'px';
                        panel.style.left = l + 'px';
                        panel.style.bottom = 'auto';
                    }
                    function onUp() {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    }
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }
        }

        var destText = document.getElementById('travelDestText');
        if (destText) {
            if (Player.travelDestination) {
                var dest = Engine.findTown(Player.travelDestination);
                destText.textContent = '\uD83D\uDCCD To: ' + (dest ? dest.name : 'Unknown');
            } else if (Player.travelDestCoords) {
                // Check if destination is near a town
                var nearTownName = null;
                try {
                    var towns = Engine.getTowns();
                    var dc = Player.travelDestCoords;
                    for (var ti = 0; ti < towns.length; ti++) {
                        var td = Math.hypot(towns[ti].x - dc.x, towns[ti].y - dc.y);
                        if (td < (CONFIG.TILE_SIZE || 32) * 4) {
                            nearTownName = towns[ti].name;
                            break;
                        }
                    }
                } catch (e) {}
                destText.textContent = '\uD83D\uDCCD To: ' + (nearTownName || 'Wilderness location');
            }else {
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
            var speed = CONFIG.CARAVAN_BASE_SPEED * 1.5;
            var daysLeft = Math.max(1, Math.ceil(remaining * (Player.travelTotalDist || 100) / speed));
            eta.textContent = '~' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' left';
        }

        // Risk indicator for encounters
        var riskDiv = document.getElementById('travelRiskIndicator');
        if (!riskDiv) {
            // Create risk indicator element next to ETA
            var etaParent = eta ? eta.parentNode : null;
            if (etaParent) {
                riskDiv = document.createElement('span');
                riskDiv.id = 'travelRiskIndicator';
                riskDiv.style.cssText = 'margin-left:12px;font-size:0.8rem;font-weight:bold;';
                etaParent.appendChild(riskDiv);
            }
        }
        if (riskDiv && typeof Player !== 'undefined' && Player.getEncounterRiskLabel) {
            var riskInfo = Player.getEncounterRiskLabel();
            if (riskInfo) {
                riskDiv.innerHTML = riskInfo.icon + ' <span style="color:' + riskInfo.color + ';">' + riskInfo.label + '</span> <span style="font-size:0.7rem;color:var(--text-muted);">' + riskInfo.typeLabel + ' risk</span>';
                riskDiv.style.display = '';
            } else {
                riskDiv.style.display = 'none';
            }
        }

        var actionsDiv = document.getElementById('travelActions');
        if (actionsDiv) {
            var btns = '';
            if (!Player.travelPaid) {
                btns += '<button class="btn-travel" data-action="turnBackUI">\uD83D\uDD04 Turn Back</button>';
                btns += '<button class="btn-travel" data-action="stopTravelUI">\u23F9\uFE0F Stop Here</button>';
            }
            btns += '<button class="btn-travel" data-action="openTravelRest">\uD83C\uDFD5\uFE0F Camp</button>';
            btns += '<button class="btn-travel" data-action="openCharacterDialog">\uD83D\uDC64 Status</button>';
            // Forage while traveling button
            var forageLabel = '\uD83C\uDF3F Forage';
            if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('soil_knowledge')) {
                var pos = Player.getPlayerWorldPosition ? Player.getPlayerWorldPosition() : null;
                var nearTown = (pos && typeof Engine !== 'undefined' && Engine.findNearestTown) ? Engine.findNearestTown(pos.x, pos.y) : null;
                if (nearTown) {
                    var fert = nearTown.soilFertilityRating != null ? nearTown.soilFertilityRating : (nearTown.soilFertility != null ? Math.round(nearTown.soilFertility * 50) : 50);
                    var chance = Math.round(10 + (fert / 100) * 70);
                    forageLabel = '\uD83C\uDF3F Forage (' + chance + '%)';
                }
            }
            btns += '<button class="btn-travel" data-action="forageNearby" style="background:rgba(85,168,104,0.15);border-color:rgba(85,168,104,0.3);">' + forageLabel + '</button>';
            // Found Outpost while traveling
            btns += '<button class="btn-travel" data-action="foundOutpostFromTravel" style="background:rgba(74,124,59,0.15);border-color:rgba(74,124,59,0.3);">\u26FA Found Outpost</button>';
            // Only rebuild DOM when content changes to prevent button flicker
            if (actionsDiv._lastBtns !== btns) {
                actionsDiv.innerHTML = btns;
                actionsDiv._lastBtns = btns;
            }
        }

        // Auto-open camp UI when player is exhausted while traveling — pause game until player chooses
        if (typeof Player !== 'undefined' && Player._campPromptNeeded && Player.traveling && !Player.resting) {
            Player._campPromptNeeded = false;
            // Save speed and pause so time doesn't advance while player decides
            if (typeof Game !== 'undefined' && Game.getSpeed && Game.setSpeed) {
                var curSpd = Game.getSpeed();
                if (curSpd > 0) window._restPauseSavedSpeed = curSpd;
                Game.setSpeed(0);
            }
            openTravelRest();
        }
    }

    function updateJailPanel() {
        var _jailPanel = document.getElementById('jailPanel');
        if (typeof Player !== 'undefined' && Player.jailedUntilDay > 0 && Engine.getDay() < Player.jailedUntilDay) {
            var _jailDaysLeft = Player.jailedUntilDay - Engine.getDay();
            var _jailTownName = Player.townId ? (Engine.findTown(Player.townId) || {}).name || 'Unknown' : 'Unknown';
            if (!_jailPanel) {
                _jailPanel = document.createElement('div');
                _jailPanel.id = 'jailPanel';
                _jailPanel.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:500;background:linear-gradient(135deg,#1a1a2e,#2a1a1a);border:2px solid #8b0000;border-radius:8px;padding:10px 20px;color:#e0d6b8;font-family:inherit;box-shadow:0 -2px 15px rgba(139,0,0,0.4);min-width:400px;text-align:center;';
                var bottomBar = document.getElementById('bottomBar');
                if (bottomBar) bottomBar.parentNode.insertBefore(_jailPanel, bottomBar);
                else document.body.appendChild(_jailPanel);
            }
            var _escapeChance = 5;
            if (Player.hasSkill && Player.hasSkill('jail_break')) _escapeChance += 10;
            if (Player.hasSkill && Player.hasSkill('street_smart')) _escapeChance += 5;
            if (Player.hasSkill && Player.hasSkill('untouchable')) _escapeChance += 5;
            if (Player.hasSkill && Player.hasSkill('silver_tongue_dark')) _escapeChance += 3;
            var _ffLabel = window._jailFastForwarding ? '⏸️ Stop Fast Forward' : '⏩ Fast Forward to Release';
            var _ffAction = window._jailFastForwarding ? 'stopJailFastForward' : 'fastForwardJailUI';
            // Slow down to 60x when close to release
            if (window._jailFastForwarding && _jailDaysLeft < 3 && typeof Game !== 'undefined' && Game.getSpeed && Game.getSpeed() > 60) {
                Game.setSpeed(60);
            }
            // v9p33river223: 90-day cooldown between escape attempts
            var _today = Engine.getDay();
            var _cooldownUntil = (Player.state && Player.state._jailEscapeCooldownUntil) || 0;
            var _onCooldown = _cooldownUntil > _today;
            var _escapeBtn;
            if (_onCooldown) {
                var _cdLeft = _cooldownUntil - _today;
                _escapeBtn = '<button disabled style="padding:4px 12px;font-size:0.8rem;background:rgba(60,60,60,0.4);color:#888;border:1px solid #555;border-radius:4px;cursor:not-allowed;" title="Cooldown after last attempt — guards on alert.">🔒 Escape (' + _cdLeft + 'd cooldown)</button>';
            } else {
                _escapeBtn = '<button data-action="attemptJailEscapeUI" style="padding:4px 12px;font-size:0.8rem;background:rgba(139,0,0,0.4);color:#e0d6b8;border:1px solid #8b0000;border-radius:4px;cursor:pointer;" title="' + _escapeChance + '% chance. If caught: more time + fine. 90-day cooldown after attempt.">🔓 Attempt Escape (' + _escapeChance + '%)</button>';
            }
            _jailPanel.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;">' +
                '<div>🔒 <strong style="color:#c44e52;">IMPRISONED</strong> in ' + _jailTownName + '</div>' +
                '<div style="font-size:0.9rem;">⏳ ' + _jailDaysLeft + ' day' + (_jailDaysLeft !== 1 ? 's' : '') + ' remaining</div>' +
                _escapeBtn +
                '<button data-action="' + _ffAction + '" style="padding:4px 12px;font-size:0.8rem;background:rgba(50,50,150,0.4);color:#e0d6b8;border:1px solid #4444aa;border-radius:4px;cursor:pointer;">' + _ffLabel + '</button>' +
                '</div>';
        } else {
            // Jail ended — auto-pause if fast forwarding
            if (window._jailFastForwarding) {
                window._jailFastForwarding = false;
                if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(0);
                toast('🔓 Released from prison! Game paused.', 'success');
                // Clear jail state
                if (typeof Player !== 'undefined' && Player.state) {
                    Player.state.jailReason = null;
                }
            }
            if (_jailPanel) _jailPanel.remove();
        }
    }

    function stopJailFastForward() {
        window._jailFastForwarding = false;
        if (typeof Game !== 'undefined' && Game.setSpeed) Game.setSpeed(0);
        toast('⏸️ Fast forward stopped. Game paused.', 'info');
    }

    // ============================================================
    // v9p33river205 — MANHUNT BANNER (above bottomBar)
    // ============================================================
    function updateManhuntBanner() {
        var pState = (typeof Player !== 'undefined' && Player.state) ? Player.state : null;
        var hunts = pState && pState.activeManhunts ? pState.activeManhunts : null;
        var hasAny = hunts && Object.keys(hunts).length > 0;
        var banner = document.getElementById('manhuntBanner');
        if (!hasAny) { if (banner) banner.remove(); return; }
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'manhuntBanner';
            banner.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:480;background:linear-gradient(135deg,#2a0a0a,#3a1818);border:2px solid #c44e52;border-radius:8px;padding:8px 12px;color:#f4e6c8;font-family:inherit;box-shadow:0 -2px 12px rgba(196,78,82,0.45);max-width:320px;font-size:0.78rem;';
            var bottomBar = document.getElementById('bottomBar');
            if (bottomBar) bottomBar.parentNode.insertBefore(banner, bottomBar);
            else document.body.appendChild(banner);
        }
        var rows = '';
        var kIds = Object.keys(hunts);
        for (var i = 0; i < kIds.length; i++) {
            var hunt = hunts[kIds[i]];
            var k = (Engine.findKingdom ? Engine.findKingdom(kIds[i]) : null);
            var kName = k ? k.name : kIds[i];
            var chance = (Player._calcManhuntCatchChance ? Player._calcManhuntCatchChance(kIds[i]) : 0);
            var label = (Player._manhuntCatchLabel ? Player._manhuntCatchLabel(chance) : { word: 'UNKNOWN', color: '#ddd' });
            var crime = (hunt.crimeId || 'misc').replace(/_/g, ' ');
            var daysLeft = Math.max(0, hunt.untilDay - (Engine.getDay ? Engine.getDay() : 0));
            rows += '<div style="margin:2px 0;">' +
                '<span style="color:#ffb;font-weight:bold;">' + kName + '</span>' +
                ' • ' + crime +
                ' • <span style="color:' + label.color + ';font-weight:bold;">' + label.word + '</span>' +
                ' <span style="color:#aaa;font-size:0.72rem;">(' + daysLeft + 'd left)</span>' +
                '</div>';
        }
        banner.innerHTML = '<div style="font-weight:bold;color:#ff8888;margin-bottom:4px;">🚨 WANTED · daily catch risk</div>' + rows;
    }

    // ============================================================
    // v9p33river205 — TRIAL BANNER + DIALOG (Noble Council)
    // ============================================================
    function updateTrialBanner() {
        if (typeof Player === 'undefined' || !Player.getActiveTrials) return;
        var trials = Player.getActiveTrials();
        var banner = document.getElementById('trialBanner');
        if (!trials || trials.length === 0) { if (banner) banner.remove(); return; }
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'trialBanner';
            banner.style.cssText = 'position:fixed;bottom:80px;left:14px;z-index:480;background:linear-gradient(135deg,#1a1a2e,#2a2a4a);border:2px solid #c0a060;border-radius:8px;padding:8px 12px;color:#f4e6c8;font-family:inherit;box-shadow:0 -2px 12px rgba(192,160,96,0.45);max-width:340px;font-size:0.78rem;cursor:pointer;';
            var bottomBar = document.getElementById('bottomBar');
            if (bottomBar) bottomBar.parentNode.insertBefore(banner, bottomBar);
            else document.body.appendChild(banner);
            banner.addEventListener('click', function() {
                var ts = Player.getActiveTrials();
                if (ts.length > 0) openTrialDialog(ts[0].vote.id, ts[0].kingdom.id);
            });
        }
        var rows = '';
        var day = Engine.getDay ? Engine.getDay() : 0;
        for (var i = 0; i < trials.length; i++) {
            var t = trials[i];
            var daysLeft = Math.max(0, t.vote.deadlineDay - day);
            var crime = (t.vote.trial.crimeId || 'misc').replace(/_/g, ' ');
            var roleTag = t.role === 'accused' ? '<span style="color:#ff7070;font-weight:bold;">ACCUSED</span>'
                : '<span style="color:#a8d8a8;font-weight:bold;">VOTER</span>';
            rows += '<div style="margin:2px 0;">' +
                roleTag + ' · ' + (t.kingdom.name || '?') +
                ' · ' + crime +
                ' · <span style="color:#ffd86a;">' + daysLeft + 'd to verdict</span>' +
                '</div>';
        }
        banner.innerHTML = '<div style="font-weight:bold;color:#ffd070;margin-bottom:4px;">⚖️ NOBLE COUNCIL TRIAL · click to view</div>' + rows;
    }

    function openTrialDialog(voteId, kingdomId) {
        var k = Engine.findKingdom ? Engine.findKingdom(kingdomId) : null;
        if (!k || !k._activeVotes) { toast('Trial not found.', 'warning'); return; }
        var vote = null;
        for (var i = 0; i < k._activeVotes.length; i++) {
            if (k._activeVotes[i].id === voteId) { vote = k._activeVotes[i]; break; }
        }
        if (!vote || !vote.trial) { toast('Trial not found.', 'warning'); return; }
        var pState = Player.state || {};
        var isAccused = !!vote.trial.accusedIsPlayer;
        var playerVoter = null;
        for (var vi = 0; vi < vote.voters.length; vi++) if (vote.voters[vi].isPlayer) { playerVoter = vote.voters[vi]; break; }
        var courtTown = vote.trial.courtTownId ? Engine.findTown(vote.trial.courtTownId) : null;
        var day = Engine.getDay ? Engine.getDay() : 0;
        var daysLeft = Math.max(0, vote.deadlineDay - day);

        // Build voter list with current votes
        var voterRows = '';
        var weightMap = { 7: 5, 6: 5, 5: 2, 4: 1 };
        var nGuilty = 0, nNot = 0, wGuilty = 0, wNot = 0;
        for (var voi = 0; voi < vote.voters.length; voi++) {
            var v = vote.voters[voi];
            var w = weightMap[v.rank] || 1;
            var name, voteText, voteColor;
            if (v.isPlayer) name = (pState.fullName || 'You');
            else { var p = Engine.findPerson(v.id); name = p ? ((p.firstName || '') + ' ' + (p.lastName || '')).trim() : '?'; }
            if (v.vote === 'yes') { voteText = 'NOT GUILTY'; voteColor = '#a8d8a8'; nNot++; wNot += w; }
            else if (v.vote === 'no') { voteText = 'GUILTY'; voteColor = '#ff8080'; nGuilty++; wGuilty += w; }
            else { voteText = 'undecided'; voteColor = '#aaa'; }
            var rankName = v.rank === 7 ? 'King' : v.rank === 6 ? 'Royal Advisor' : v.rank === 5 ? 'Lord' : 'Minor Noble';
            voterRows += '<tr><td style="padding:3px 8px;">' + name + (v.isPlayer ? ' <span style="color:#ffd070;">(YOU)</span>' : '') + '</td>' +
                '<td style="padding:3px 8px;color:#bbb;">' + rankName + '</td>' +
                '<td style="padding:3px 8px;text-align:center;color:#ddd;">×' + w + '</td>' +
                '<td style="padding:3px 8px;color:' + voteColor + ';font-weight:bold;">' + voteText + '</td></tr>';
        }

        var voteButtonsHtml = '';
        if (playerVoter && !vote.resolved) {
            voteButtonsHtml = '<div style="margin-top:14px;text-align:center;">' +
                '<button class="btn-medieval" style="padding:8px 18px;margin:0 6px;background:rgba(170,40,40,0.6);" data-action="castTrialVote" data-id="' + vote.id + ',' + k.id + ',guilty">⚖️ Vote GUILTY</button>' +
                '<button class="btn-medieval" style="padding:8px 18px;margin:0 6px;background:rgba(40,140,80,0.6);" data-action="castTrialVote" data-id="' + vote.id + ',' + k.id + ',not_guilty">⚖️ Vote NOT GUILTY</button>' +
                '</div>' +
                (playerVoter.vote !== 'undecided' ? '<div style="text-align:center;color:#ffd070;margin-top:6px;font-size:0.85rem;">Your vote: <b>' + (playerVoter.vote === 'yes' ? 'NOT GUILTY' : 'GUILTY') + '</b></div>' : '');
        }

        var pun = vote.trial.originalPunishment || {};
        var punDesc = pun.execution ? '☠️ EXECUTION' : pun.exile ? '🚪 EXILE' : '⛓️ heavy jail';

        var html = '<div style="padding:14px;max-width:640px;font-family:inherit;color:#e0d6b8;">' +
            '<h2 style="margin:0 0 8px;color:#ffd070;">⚖️ Noble Council Trial</h2>' +
            '<div style="font-size:0.95rem;margin-bottom:6px;">' +
                '<b>' + (vote.trial.accusedName || 'The accused') + '</b>' + (isAccused ? ' <span style="color:#ff7070;">(YOU)</span>' : '') +
                ' is charged with <b>' + (vote.trial.crimeId || 'misc').replace(/_/g, ' ') + '</b> in <b>' + k.name + '</b>.' +
            '</div>' +
            '<div style="margin-bottom:8px;color:#e0c58a;">If guilty: ' + punDesc + '</div>' +
            '<div style="margin-bottom:8px;color:#aaa;">Court town: ' + (courtTown ? courtTown.name : '—') + ' · Verdict in ' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + '</div>' +
            '<div style="margin:10px 0 6px;color:#ffd070;font-weight:bold;">Tally so far: ' +
                '<span style="color:#a8d8a8;">' + nNot + ' Not Guilty (w' + wNot + ')</span> · ' +
                '<span style="color:#ff8080;">' + nGuilty + ' Guilty (w' + wGuilty + ')</span></div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:0.88rem;background:rgba(0,0,0,0.25);border-radius:4px;">' +
                '<thead><tr style="background:rgba(192,160,96,0.18);"><th style="padding:5px 8px;text-align:left;">Noble</th><th style="padding:5px 8px;text-align:left;">Rank</th><th style="padding:5px 8px;text-align:center;">Weight</th><th style="padding:5px 8px;text-align:left;">Vote</th></tr></thead>' +
                '<tbody>' + voterRows + '</tbody>' +
            '</table>' +
            voteButtonsHtml +
            '</div>';

        if (UI.openModal) {
            UI.openModal('⚖️ Trial', html);
        } else if (UI.showModal) {
            UI.showModal('⚖️ Trial', html);
        } else {
            alert('Trial: ' + (vote.trial.accusedName || 'accused') + ' charged with ' + (vote.trial.crimeId || 'misc'));
        }
    }

    function castTrialVoteUI(voteId, kingdomId, choice) {
        if (!Player.castTrialVote) return;
        var r = Player.castTrialVote(voteId, kingdomId, choice);
        toast(r.message || 'Vote cast.', r.success ? 'success' : 'warning');
        if (r.success) {
            if (UI.closeModal) UI.closeModal();
            updateTrialBanner();
        }
    }

    function openTravelRest() {
        if (!Player.traveling) { toast('Not traveling.', 'info'); return; }
        // Pause game when player manually opens Camp dialog too
        if (typeof Game !== 'undefined' && Game.getSpeed && Game.setSpeed) {
            var curSpd = Game.getSpeed();
            if (curSpd > 0) window._restPauseSavedSpeed = curSpd;
            Game.setSpeed(0);
        }

        var options = [];
        var inv = Player.inventory || {};

        // v9p33river62: at sea — sailing-appropriate rest options based on ship.
        var atSea = !!Player.travelOffSea;
        var ship = null, shipType = null;
        if (atSea) {
            ship = (Player.ships || []).find(function(s) { return s.id === Player.offSeaShipId; });
            if (ship) shipType = CONFIG.SHIP_TYPES[ship.type] || null;
        }

        if (atSea && shipType) {
            // Energy/tick scales with ship's restBonus + size category. Baseline 2.0
            // (open deck), +restBonus*4 (so 0=2.0, 0.3=3.2, 0.4=3.6, 0.6=4.4),
            // +0.5 if size=large (galleon), +0.3 if medium.
            var sizeBump = shipType.sizeCategory === 'large' ? 0.5 : shipType.sizeCategory === 'medium' ? 0.3 : 0;
            var capRate = (2.0 + (shipType.restBonus || 0) * 4 + sizeBump).toFixed(1);
            // Captain's quarters (ship has restBonus → has crew/passenger quarters)
            if ((shipType.restBonus || 0) >= 0.5) {
                options.push({ id: 'ship_captain_cabin', icon: '\uD83D\uDEAA', name: "Captain's Cabin (" + shipType.name + ')', energy: capRate + '/tick', risks: 'Safe & dry · gentle sway' });
            } else if ((shipType.restBonus || 0) >= 0.3) {
                options.push({ id: 'ship_cabin', icon: '\uD83D\uDECF\uFE0F', name: 'Crew Quarters (' + shipType.name + ')', energy: capRate + '/tick', risks: 'Cramped but sheltered' });
            }
            // Tent on deck (if player has tent)
            if ((inv.tent || 0) > 0) {
                var deckTentRate = ((shipType.restBonus || 0) >= 0.3 ? 3.5 : 3.0).toFixed(1);
                options.push({ id: 'ship_tent_deck', icon: '\u26FA', name: 'Pitch Tent on Deck', energy: deckTentRate + '/tick', risks: 'Sea spray · 15% tent wear' });
            }
            // Bedroll on deck (if player has bedroll)
            if ((inv.bedroll || 0) > 0) {
                var deckBedRate = ((shipType.restBonus || 0) >= 0.3 ? 3.0 : 2.5).toFixed(1);
                options.push({ id: 'ship_bedroll_deck', icon: '\uD83D\uDECF\uFE0F', name: 'Bedroll on Deck', energy: deckBedRate + '/tick', risks: 'Damp from sea spray' });
            }
            // Sleep on open deck — always available
            var openDeckRate = ((shipType.restBonus || 0) >= 0.3 ? 2.5 : 2.0).toFixed(1);
            options.push({ id: 'ship_open_deck', icon: '\uD83C\uDF0A', name: 'Sleep on Open Deck', energy: openDeckRate + '/tick', risks: 'Exposed · 8% chance to catch chill' });
        } else {
            // Caravan wagon (mobile home) — best option
            if (Player.hasCaravanWagon) {
                options.push({ id: 'caravan_wagon', icon: '\uD83C\uDFE0', name: 'Rest in Mobile Home', energy: '5.5/tick', risks: '1% theft' });
            }
            var _wearPct = (Player.hasSkill && Player.hasSkill('wilderness_survival')) ? '10' : '25';
            if ((inv.camping_kit || 0) > 0) {
                options.push({ id: 'camping_kit_travel', icon: '\uD83C\uDFD5\uFE0F', name: 'Camp with Kit', energy: '5.0/tick', risks: 'Minimal · ' + _wearPct + '% wear' });
            }
            // Bedroll + Tent combo
            if ((inv.bedroll || 0) > 0 && (inv.tent || 0) > 0) {
                options.push({ id: 'bedroll_tent_travel', icon: '\u26FA\uD83D\uDECF\uFE0F', name: 'Tent & Bedroll', energy: '4.5/tick', risks: '2% theft, 1% disease · ' + _wearPct + '% wear each' });
            } else if ((inv.tent || 0) > 0) {
                options.push({ id: 'tent_travel', icon: '\u26FA', name: 'Pitch Tent', energy: '4.0/tick', risks: '3% theft · ' + _wearPct + '% wear' });
            } else if ((inv.bedroll || 0) > 0) {
                options.push({ id: 'bedroll_travel', icon: '\uD83D\uDECF\uFE0F', name: 'Use Bedroll', energy: '3.0/tick', risks: '5% theft, 3% disease · ' + _wearPct + '% wear' });
            }
            // Sleep in wagon (storage container with 30+ space)
            if (!Player.hasCaravanWagon && Player.storageContainer) {
                var wagonTypes = ['small_wagon', 'wagon', 'large_wagon'];
                if (wagonTypes.indexOf(Player.storageContainer) !== -1) {
                    var cap = Player.getCarryCapacity ? Player.getCarryCapacity() : 0;
                    var used = Player.getCarriedWeight ? Player.getCarriedWeight() : 0;
                    if (cap - used >= 30) {
                        var cName = (CONFIG.STORAGE_CONTAINERS[Player.storageContainer] || {}).name || 'Wagon';
                        options.push({ id: 'wagon_sleep_travel', icon: '\uD83D\uDEDE', name: 'Sleep in ' + cName, energy: '2.5/tick', risks: '8% theft' });
                    }
                }
            }
            options.push({ id: 'outside', icon: '\uD83C\uDF3F', name: 'Sleep Roadside', energy: '2.0/tick', risks: '10% theft, 5% disease, 5% injury' });
        }

        var html = '<div>';
        var headerCopy = atSea
            ? 'Rest at sea. Travel pauses while resting. Pirates may still strike!'
            : 'Choose where to rest. Travel pauses while camping. Bandits may still attack!';
        html += '<p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;">' + headerCopy + '</p>';

        for (var i = 0; i < options.length; i++) {
            var opt = options[i];
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px;margin-bottom:4px;background:rgba(255,255,255,0.03);border-radius:4px;cursor:pointer;" data-action="startTravelRest" data-id="' + opt.id + '">';
            html += '<div>' + opt.icon + ' <strong>' + opt.name + '</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">\u26A1 ' + opt.energy + ' | \u26A0\uFE0F ' + opt.risks + '</span></div>';
            html += '<button class="btn-medieval" style="font-size:0.75rem;padding:3px 8px;">Rest</button>';
            html += '</div>';
        }
        html += '</div>';

        var titleIcon = atSea ? '\u26F5' : '\uD83C\uDFD5\uFE0F';
        var titleText = atSea ? 'Rest at Sea' : 'Camp & Rest';
        openModal(titleIcon + ' ' + titleText, html);
    }

    function startTravelRest(locationId) {
        if (typeof Player !== 'undefined' && Player.restForTicks) {
            // Rest until fully energized (restForTicks auto-caps at energy needed)
            Player.restForTicks(locationId, 999);
            closeModal();
            // Restore game speed after resting
            if (typeof Game !== 'undefined' && Game.setSpeed && window._restPauseSavedSpeed) {
                Game.setSpeed(window._restPauseSavedSpeed);
                delete window._restPauseSavedSpeed;
            }
            toast('\uD83D\uDCA4 Resting until fully energized...', 'info', 'travel_events');
        }
    }

    // ── Register on UI namespace ──
    UI.showPetitionsPanel = showPetitionsPanel;
    UI.showCreatePetitionPanel = showCreatePetitionPanel;
    UI.selectPetitionType = selectPetitionType;
    UI.confirmCreatePetition = confirmCreatePetition;
    UI.confirmCreatePetitionTownPair = confirmCreatePetitionTownPair;
    UI.showPetitionDetail = showPetitionDetail;
    UI.askNPCToSign = askNPCToSign;
    UI.hirePetitionerUI = hirePetitionerUI;
    UI.firePetitionerUI = firePetitionerUI;
    UI.submitPetitionUI = submitPetitionUI;
    UI.cancelPetitionUI = cancelPetitionUI;
    UI.showWarConflictChoice = showWarConflictChoice;
    UI.resolveWarConflict = resolveWarConflict;
    UI.renounceKingdomUI = renounceKingdomUI;
    UI.showRankProgressionPanel = showRankProgressionPanel;
    UI.showKingdomTradePanel = showKingdomTradePanel;
    UI.sellToKingdomUI = sellToKingdomUI;
    UI.showKingdomOrdersPanel = showKingdomOrdersPanel;
    UI.switchOrdersTab = switchOrdersTab;
    UI.sellToCrownUI = sellToCrownUI;
    UI.showBidModal = showBidModal;
    UI.submitBid = submitBid;
    UI.showDeliverOrderModal = showDeliverOrderModal;
    UI.executeDeliverOrder = executeDeliverOrder;
    UI.showNegotiateDealPanel = showNegotiateDealPanel;
    UI.submitDealProposal = submitDealProposal;
    UI.deliverSupplyDealUI = deliverSupplyDealUI;
    UI.executeDeliverDeal = executeDeliverDeal;
    UI.showConquestDialog = showConquestDialog;
    UI.buyFreedomUI = buyFreedomUI;
    UI.attemptIndenturedEscape = attemptIndenturedEscape;
    UI.completeMasterTask = completeMasterTask;
    UI.dismissMasterTask = dismissMasterTask;
    UI.payDebt = payDebt;
    UI.showHeirSelectionUI = showHeirSelectionUI;
    UI.confirmHeirSelection = confirmHeirSelection;
    UI.showChildNamingDialog = showChildNamingDialog;
    UI._confirmChildName = _confirmChildName;
    UI.checkConquestEvents = checkConquestEvents;
    UI.cancelSupplyDealUI = cancelSupplyDealUI;
    UI.openKingdomLawsPanel = openKingdomLawsPanel;
    UI.openProsperityBreakdown = openProsperityBreakdown;
    UI.openKingActionLog = openKingActionLog;
    UI.openLawComparisonPanel = openLawComparisonPanel;
    UI.openRoyalCommissionsPanel = openRoyalCommissionsPanel;
    UI.fulfillCommissionUI = fulfillCommissionUI;
    UI.openKingdomDonateDialog = openKingdomDonateDialog;
    UI.openConscriptionDialog = openConscriptionDialog;
    UI.respondConscription = respondConscription;
    UI.openJailDialog = openJailDialog;
    UI.fastForwardJailUI = fastForwardJailUI;
    UI.attemptJailEscapeUI = attemptJailEscapeUI;
    UI.openSuccessionCrisisDialog = openSuccessionCrisisDialog;
    UI.backPretenderUI = backPretenderUI;
    UI.confirmFreeTravel = confirmFreeTravel;
    UI.updateTravelPanel = updateTravelPanel;
    UI.updateJailPanel = updateJailPanel;
    UI.updateManhuntBanner = updateManhuntBanner;
    UI.updateTrialBanner = updateTrialBanner;
    UI.openTrialDialog = openTrialDialog;
    UI.castTrialVoteUI = castTrialVoteUI;
    UI.stopJailFastForward = stopJailFastForward;
    UI.openTravelRest = openTravelRest;
    UI.startTravelRest = startTravelRest;

    // ============================================================
    // ACTION REGISTRATIONS (data-action delegation)
    // ============================================================

    // Simple one-arg actions: handler receives data-id
    var _simpleIdActions = [
        'showPetitionDetail', 'submitPetitionUI', 'cancelPetitionUI',
        'selectPetitionType', 'resolveWarConflict', 'renounceKingdomUI',
        'showBidModal', 'showDeliverOrderModal', 'showNegotiateDealPanel',
        'deliverSupplyDealUI', 'cancelSupplyDealUI', 'submitBid',
        'executeDeliverOrder', 'submitDealProposal', 'showKingdomOrdersPanel',
        'executeDeliverDeal', 'openSuccessionCrisisDialog',
        'confirmCreatePetitionTownPair', 'startTravelRest'
    ];
    for (var _i = 0; _i < _simpleIdActions.length; _i++) {
        (function(name) {
            UI.registerAction(name, function(_t, d) { UI[name](d.id); });
        })(_simpleIdActions[_i]);
    }

    // No-arg actions
    var _noArgActions = [
        'showCreatePetitionPanel', 'showPetitionsPanel', 'petitionPromotion',
        'fastForwardJailUI', 'turnBackUI', 'stopTravelUI', 'openTravelRest',
        'attemptJailEscapeUI', 'forageNearby', 'foundOutpostFromTravel',
        'stopJailFastForward', 'closeModal'
    ];
    for (var _i = 0; _i < _noArgActions.length; _i++) {
        (function(name) {
            UI.registerAction(name, function() { UI[name](); });
        })(_noArgActions[_i]);
    }

    // Two-arg actions (id, val) — both string
    var _twoArgActions = [
        'askNPCToSign', 'firePetitionerUI', 'backPretenderUI'
    ];
    for (var _i = 0; _i < _twoArgActions.length; _i++) {
        (function(name) {
            UI.registerAction(name, function(_t, d) { UI[name](d.id, d.val); });
        })(_twoArgActions[_i]);
    }

    // v9p33river205: castTrialVote takes 'voteId,kingdomId,choice' as comma string
    UI.registerAction('castTrialVote', function(_t, d) {
        if (!d || !d.id) return;
        var parts = d.id.split(',');
        if (parts.length < 3) return;
        UI.castTrialVoteUI(parts[0], parts[1], parts[2]);
    });

    // hirePetitionerUI: id + boolean val
    UI.registerAction('hirePetitionerUI', function(_t, d) {
        UI.hirePetitionerUI(d.id, d.val === 'true');
    });

    // fulfillCommissionUI: id + val (both strings)
    UI.registerAction('fulfillCommissionUI', function(_t, d) {
        UI.fulfillCommissionUI(d.id, d.val);
    });

    // confirmHeirSelection: id + val
    UI.registerAction('confirmHeirSelection', function(_t, d) {
        UI.confirmHeirSelection(d.id, d.val);
    });

    // switchOrdersTab: uses data-tab
    UI.registerAction('switchOrdersTab', function(_t, d) {
        UI.switchOrdersTab(d.tab);
    });

    // respondConscription: uses data-val
    UI.registerAction('respondConscription', function(_t, d) {
        UI.respondConscription(d.val);
    });

    // sellToKingdomUI: id, val, qty (int), price (float)
    UI.registerAction('sellToKingdomUI', function(_t, d) {
        UI.sellToKingdomUI(d.id, d.val, parseInt(d.qty), parseFloat(d.price));
    });

    // sellToCrownUI: id, val, qty (int), price (float)
    UI.registerAction('sellToCrownUI', function(_t, d) {
        UI.sellToCrownUI(d.id, d.val, parseInt(d.qty), parseFloat(d.price));
    });

    // confirmCreatePetition: type + reconstructed params object
    UI.registerAction('confirmCreatePetition', function(_t, d) {
        var params = {};
        if (d.townid) { params.townId = d.townid; params.townName = d.townname || ''; }
        if (d.roadindex !== undefined && d.roadindex !== '') { params.roadIndex = parseInt(d.roadindex); params.roadName = d.roadname || ''; }
        if (d.targetkingdomid) { params.targetKingdomId = d.targetkingdomid; params.targetKingdomName = d.targetkingdomname || ''; }
        if (d.resourceid) { params.resourceId = d.resourceid; params.resourceName = d.resourcename || ''; }
        UI.confirmCreatePetition(d.type, params);
    });

    // renounceKingdom IIFE wrapper
    UI.registerAction('renounceKingdom', function(_t, d) {
        var r = Player.renounceKingdom(d.id);
        UI.toast(r.message, r.success ? 'warning' : 'danger');
        UI.closeModal();
        UI.openCharacterDialog();
    });

    // donateToKingdom IIFE wrapper
    UI.registerAction('donateToKingdom', function(_t, d) {
        var r = Player.donateToKingdom(d.id, parseInt(d.val));
        if (!r.success) { UI.toast(r.message, 'warning'); }
        else { UI.openKingdomDonateDialog(d.id); }
    });

    // travelToCoords: multi-statement wrapper
    UI.registerAction('travelToCoords', function(_t, d) {
        var result = Player.travelToCoords(parseInt(d.x), parseInt(d.y));
        UI.closeModal();
        // v9p33river65: surface failure (water-blocked, etc) as a toast.
        if (result && result.success === false && result.message) {
            UI.toast(result.message, 'warning');
        }
    });

    // useSpouseSuggestion: fill child name input + update button
    UI.registerAction('useSpouseSuggestion', function(target, d) {
        var inp = document.getElementById('childNameInput');
        if (inp) inp.value = d.val;
        target.style.background = '#2a4a2a';
        target.style.borderColor = '#5a5';
        target.textContent = d.label;
    });

    // confirmChildName: wrapper for _confirmChildName
    UI.registerAction('confirmChildName', function(_t, d) {
        UI._confirmChildName(d.id, d.val);
    });

})(window.UI);
