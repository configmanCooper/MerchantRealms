// ============================================================
// Merchant Realms — Funeral & Death/Inheritance UI Module
// Handles death notifications, inheritance display, funeral
// planning, funeral event interactions, and funeral tick logic.
// ============================================================
(function(UI) {
    "use strict";
    if (!UI) throw new Error("UI must be loaded before ui_funeral.js");

    var openModal  = UI.openModal;
    var closeModal = UI.closeModal;
    var toast      = UI.toast;
    var formatGold = UI.formatGold;
    var escapeHtml = UI.escapeHtml;

    // ── CONFIG DEFAULTS (used when kingdom has no inheritance_tax law) ──
    var INHERITANCE_TAX_DEFAULTS = {
        minRate: 0.05,
        maxRate: 0.20,
        nobleExemptionRank: 4,
        exemptionDiscount: 0.5
    };

    var FUNERAL_TIMING = [
        { id: 'quick',    name: 'Quick Funeral',   days: 3,  cost: 200, rep: -5,  desc: '3 days — fewer attendees, rushed' },
        { id: 'standard', name: 'Standard Funeral', days: 7,  cost: 400, rep: 0,   desc: '7 days — moderate attendance' },
        { id: 'grand',    name: 'Grand Memorial',  days: 30, cost: 800, rep: 10,  desc: '30 days — many attendees, +5 relationship with all' }
    ];

    var BURIAL_TYPES = [
        { id: 'simple_grave',      name: 'Simple Grave',       cost: 50,  rep: 0,  icon: '⚰️', desc: 'A humble resting place', requiresChurch: false },
        { id: 'family_plot',       name: 'Family Plot',        cost: 200, rep: 5,  icon: '🪦', desc: '+5 rep, family legacy bonus', requiresChurch: false },
        { id: 'church_burial',     name: 'Church Burial',      cost: 300, rep: 8,  icon: '⛪', desc: '+8 rep, requires church in town', requiresChurch: true },
        { id: 'memorial_monument', name: 'Memorial Monument',  cost: 500, rep: 15, icon: '🏛️', desc: '+15 rep, permanent town memorial', requiresChurch: false },
        { id: 'cremation',         name: 'Cremation',          cost: 100, rep: 0,  icon: '🔥', desc: 'No grave marker', requiresChurch: false }
    ];

    var CEREMONY_STYLES = [
        { id: 'private', name: 'Private Ceremony',  cost: 0,   rep: 0,  maxAttendees: 5,  desc: 'Family only, +10 rel with close family', requiresRank: 0 },
        { id: 'public',  name: 'Public Ceremony',   cost: 100, rep: 5,  maxAttendees: 20, desc: 'Open to all, +5 rep', requiresRank: 0 },
        { id: 'state',   name: 'State Funeral',     cost: 500, rep: 20, maxAttendees: 100, desc: 'Kingdom-wide, requires noble rank 4+', requiresRank: 4 }
    ];

    // ── HELPERS ──

    function _getPlayerNobleRank(kingdomId) {
        var ps = Player.state;
        if (!ps || !ps.socialRank) return 0;
        if (kingdomId && ps.socialRank[kingdomId]) return ps.socialRank[kingdomId];
        // Return highest rank across all kingdoms
        var best = 0;
        if (typeof ps.socialRank === 'object') {
            for (var k in ps.socialRank) {
                if ((ps.socialRank[k] || 0) > best) best = ps.socialRank[k];
            }
        }
        return best;
    }

    function _getPersonName(p) {
        if (!p) return 'Unknown';
        return (p.firstName || '') + ' ' + (p.lastName || '');
    }

    function _getRelationshipLabel(rel) {
        var labels = {
            'spouse': 'Spouse', 'mother': 'Mother', 'father': 'Father',
            'parent': 'Parent', 'child': 'Child', 'sibling': 'Sibling'
        };
        return labels[rel] || rel;
    }

    function _getTownName(townId) {
        var t = Engine.findTown ? Engine.findTown(townId) : (Engine.getTown ? Engine.getTown(townId) : null);
        return t ? t.name : 'Unknown';
    }

    function _getKingdomForTown(townId) {
        var t = Engine.findTown ? Engine.findTown(townId) : (Engine.getTown ? Engine.getTown(townId) : null);
        if (!t || !t.kingdomId) return null;
        var k = Engine.getKingdom ? Engine.getKingdom(t.kingdomId) : null;
        return k || null;
    }

    function _hasChurchInTown(townId) {
        var t = Engine.findTown ? Engine.findTown(townId) : (Engine.getTown ? Engine.getTown(townId) : null);
        if (!t || !t.buildings) return false;
        for (var i = 0; i < t.buildings.length; i++) {
            var b = t.buildings[i];
            if (b && (b.type === 'church' || b.type === 'cathedral' || b.type === 'chapel' || b.type === 'temple')) return true;
        }
        return false;
    }

    function _calcInheritanceTax(grossGold, kingdomId) {
        var cfg = INHERITANCE_TAX_DEFAULTS;
        var taxRate = cfg.maxRate;
        var _kingdomLawRate = null;

        // Check if kingdom has inheritance_tax law
        if (kingdomId) {
            var kingdom = Engine.getKingdom ? Engine.getKingdom(kingdomId) : null;
            if (kingdom && kingdom.laws && kingdom.laws.specialLaws) {
                for (var i = 0; i < kingdom.laws.specialLaws.length; i++) {
                    if (kingdom.laws.specialLaws[i].id === 'inheritance_tax') {
                        _kingdomLawRate = kingdom.laws.specialLaws[i].rate;
                        if (_kingdomLawRate != null) taxRate = _kingdomLawRate;
                        break;
                    }
                }
            }
        }

        // v9p33river320: clamp only when there's NO explicit kingdom-law
        // rate. If a kingdom law sets a higher rate (e.g. 35%), that's a
        // sovereign decision and must override the 20% maxRate default.
        if (_kingdomLawRate == null) {
            if (taxRate < cfg.minRate) taxRate = cfg.minRate;
            if (taxRate > cfg.maxRate) taxRate = cfg.maxRate;
        } else if (taxRate < 0) {
            taxRate = 0;
        }

        // Noble exemption discount
        var playerRank = _getPlayerNobleRank(kingdomId);
        if (playerRank >= cfg.nobleExemptionRank) {
            taxRate = taxRate * cfg.exemptionDiscount;
        }

        var taxAmount = Math.floor(grossGold * taxRate);
        var netGold = grossGold - taxAmount;
        return { taxRate: taxRate, taxAmount: taxAmount, netGold: netGold, grossGold: grossGold };
    }

    function _findInheritedBuildings(deceasedId) {
        var buildings = [];
        var world = Engine.getWorld ? Engine.getWorld() : null;
        if (!world || !world.towns) return buildings;
        for (var ti = 0; ti < world.towns.length; ti++) {
            var town = world.towns[ti];
            if (!town.buildings) continue;
            for (var bi = 0; bi < town.buildings.length; bi++) {
                var bld = town.buildings[bi];
                if (bld.ownerId === deceasedId) {
                    buildings.push({ name: bld.name || bld.type, townName: town.name, type: bld.type });
                }
            }
        }
        return buildings;
    }

    // ── A. DEATH NOTIFICATION UI ──

    function showDeathNotification(personId, cause, relationship, snapshot) {
        var p = Engine.findPerson ? Engine.findPerson(personId) : (Engine.getPerson ? Engine.getPerson(personId) : null);
        if (!p && !snapshot) {
            toast('A family member has passed away.', 'warning');
            return;
        }
        // v9p33river87: pause the game when this modal opens so the player can read it.
        try {
            if (typeof Game !== 'undefined' && Game.getSpeed && Game.setSpeed) {
                var _curSpd = Game.getSpeed();
                if (_curSpd > 0) window._funeralPauseSavedSpeed = _curSpd;
                Game.setSpeed(0);
            }
        } catch (_e) {}

        var name = snapshot ? snapshot.personName : _getPersonName(p);
        var relLabel = _getRelationshipLabel(relationship);
        var causeText = cause || 'natural causes';

        var html = '<div style="padding:12px;">';
        html += '<div style="text-align:center;font-size:1.5rem;margin-bottom:8px;">⚰️</div>';
        html += '<h3 style="color:#c0392b;margin:0 0 6px;text-align:center;">Death of ' + escapeHtml(name) + '</h3>';
        html += '<div style="text-align:center;color:#bbb;font-size:0.78rem;margin-bottom:12px;">';
        html += 'Your ' + escapeHtml(relLabel) + ' has died of ' + escapeHtml(causeText) + '.</div>';

        // Determine inheritance — use snapshot data if available (captures pre-transfer state)
        var inheritInfo = _determineInheritance(p, relationship, snapshot);

        if (inheritInfo.playerInherits) {
            var kingdom = _getKingdomForTown(p.townId);
            var kingdomId = kingdom ? kingdom.id : null;
            var grossGold = inheritInfo.goldAmount;
            var taxInfo = _calcInheritanceTax(grossGold, kingdomId);
            var inheritedBuildings = inheritInfo.buildings || [];

            html += '<div style="background:rgba(46,204,113,0.1);border:1px solid #2ecc71;border-radius:6px;padding:10px;margin-bottom:10px;">';
            html += '<div style="color:#2ecc71;font-weight:bold;margin-bottom:6px;">💰 Inheritance</div>';

            if (grossGold > 0) {
                html += '<div style="font-size:0.78rem;color:#ddd;margin-bottom:4px;">Gold (pre-tax): <span style="color:#f1c40f;">' + (formatGold ? formatGold(grossGold) : grossGold + 'g') + '</span></div>';
                html += '<div style="font-size:0.78rem;color:#ddd;margin-bottom:4px;">Tax rate: <span style="color:#e74c3c;">' + Math.round(taxInfo.taxRate * 100) + '%</span>';
                if (_getPlayerNobleRank(kingdomId) >= INHERITANCE_TAX_DEFAULTS.nobleExemptionRank) {
                    html += ' <span style="color:#f39c12;font-size:0.68rem;">(50% noble discount)</span>';
                }
                html += '</div>';
                html += '<div style="font-size:0.78rem;color:#ddd;margin-bottom:4px;">Tax amount: <span style="color:#e74c3c;">-' + (formatGold ? formatGold(taxInfo.taxAmount) : taxInfo.taxAmount + 'g') + '</span></div>';
                html += '<div style="font-size:0.85rem;color:#2ecc71;font-weight:bold;">Net inheritance: ' + (formatGold ? formatGold(taxInfo.netGold) : taxInfo.netGold + 'g') + '</div>';
            }

            if (inheritedBuildings.length > 0) {
                html += '<div style="margin-top:8px;font-size:0.78rem;color:#ddd;">🏠 Buildings inherited:</div>';
                for (var bi = 0; bi < inheritedBuildings.length; bi++) {
                    html += '<div style="font-size:0.72rem;color:#bbb;margin-left:10px;">• ' + escapeHtml(inheritedBuildings[bi].name || inheritedBuildings[bi].type) + ' in ' + escapeHtml(inheritedBuildings[bi].townName) + '</div>';
                }
            }
            html += '</div>';

            // Secret beneficiary warning
            if (p && p.quirks && p.quirks.indexOf('secret_beneficiary') >= 0) {
                var _benName = 'someone';
                if (p.secretBeneficiaryId) {
                    var _benPerson = Engine.findPerson ? Engine.findPerson(p.secretBeneficiaryId) : null;
                    if (_benPerson) _benName = (_benPerson.firstName || '') + ' ' + (_benPerson.lastName || '');
                }
                html += '<div style="background:rgba(231,76,60,0.15);border:1px solid #e74c3c;border-radius:6px;padding:10px;margin-bottom:10px;">';
                html += '<div style="color:#e74c3c;font-weight:bold;margin-bottom:4px;">🤐 Secret Beneficiary</div>';
                html += '<div style="font-size:0.78rem;color:#ddd;">Your spouse had secretly arranged for 90% of their estate to go to <strong style="color:#e67e22;">' + escapeHtml(_benName) + '</strong>. You only received a small fraction of the inheritance.</div>';
                html += '</div>';
            }
        }

        // Funeral planning section
        if (inheritInfo.playerPlansFuneral) {
            html += '<div style="background:rgba(155,89,182,0.1);border:1px solid #9b59b6;border-radius:6px;padding:10px;margin-bottom:10px;">';
            html += '<div style="color:#9b59b6;font-weight:bold;margin-bottom:6px;">🪦 Funeral Arrangements</div>';
            html += '<div style="font-size:0.78rem;color:#ccc;">As ' + (relationship === 'spouse' ? 'their spouse' : 'the responsible family member') + ', you must plan the funeral.</div>';
            html += '</div>';
        } else if (inheritInfo.funeralPlannedBy) {
            html += '<div style="background:rgba(155,89,182,0.1);border:1px solid #9b59b6;border-radius:6px;padding:10px;margin-bottom:10px;">';
            html += '<div style="color:#9b59b6;font-weight:bold;margin-bottom:6px;">🪦 Funeral Arrangements</div>';
            // v9p33river88/89: prefer the authoritative funeralNotification stored
            // by engine.js's _setupAIFuneral path (it has correct town + day).
            var _arrLine = escapeHtml(inheritInfo.funeralPlannedBy) + ' will handle the funeral arrangements.';
            var _funNotif = (Player && Player.state && Player.state.funeralNotification) || null;
            var _useNotif = _funNotif && (_funNotif.deceasedId === personId || _funNotif.deceasedName === name);
            var _funTown = _useNotif ? _funNotif.funeralTownId : inheritInfo.funeralTownId;
            var _funDay  = _useNotif ? _funNotif.funeralDay   : inheritInfo.funeralDay;
            if (_funTown || _funDay) {
                var _tn = _funTown ? _getTownName(_funTown) : null;
                _arrLine += '<br><span style="color:#bbb;font-size:0.74rem;">';
                if (_tn) _arrLine += '📍 ' + escapeHtml(_tn);
                if (_tn && _funDay) _arrLine += ' &middot; ';
                if (_funDay) _arrLine += '🗓️ Day ' + _funDay;
                _arrLine += '</span>';
            }
            html += '<div style="font-size:0.78rem;color:#ccc;">' + _arrLine + '</div>';
            html += '</div>';
        }

        html += '</div>';

        // Footer buttons
        var footer = '';
        if (inheritInfo.playerPlansFuneral) {
            footer += '<button class="btn-medieval" data-action="funeralPlanStart" data-personid="' + personId + '" data-rel="' + relationship + '" style="margin-right:6px;">🪦 Plan Funeral</button>';
            // Lock the modal — player must plan the funeral
            UI._funeralLocked = true;
            // v9p33river216: stash the args so we can re-open this dialog if
            // the player tries to do anything else and gets the warning toast.
            UI._pendingFuneralArgs = { personId: personId, cause: cause, relationship: relationship, snapshot: snapshot };
        } else {
            footer += '<button class="btn-medieval" data-action="closeModal">Close</button>';
        }

        openModal('⚰️ A Passing in the Family', html, footer);
    }

    // v9p33river216: re-open the death notification / funeral planning dialog
    // (used when something else triggered the funeral-lock toast).
    function reopenPendingFuneral() {
        if (!UI._pendingFuneralArgs) return false;
        var a = UI._pendingFuneralArgs;
        try {
            showDeathNotification(a.personId, a.cause, a.relationship, a.snapshot);
            return true;
        } catch (_e) { return false; }
    }

    function _determineInheritance(p, relationship, snapshot) {
        var result = {
            playerInherits: false,
            playerPlansFuneral: false,
            goldAmount: 0,
            buildings: [],
            funeralPlannedBy: null,
            funeralPlannedByTownId: null,
            funeralTownId: null,
            funeralDay: null
        };

        var ps = Player.state;
        // Use snapshot gold/buildings if available (pre-transfer state)
        var deceasedGold = snapshot ? snapshot.gold : (p ? (p.gold || 0) : 0);
        var deceasedBuildings = snapshot ? snapshot.buildings : (p ? _findInheritedBuildings(p.id) : []);

        if (relationship === 'spouse') {
            // Spouse: player always inherits and plans funeral
            result.playerInherits = true;
            result.playerPlansFuneral = true;
            result.goldAmount = Math.floor(deceasedGold * 0.85);
            result.buildings = deceasedBuildings;
        } else if (relationship === 'mother' || relationship === 'father' || relationship === 'parent') {
            // Parent dies
            var otherParentAlive = false;
            var otherParentName = null;
            if (ps.parentIds && ps.parentIds.length > 0) {
                for (var i = 0; i < ps.parentIds.length; i++) {
                    if (ps.parentIds[i] !== (p ? p.id : null)) {
                        var otherParent = Engine.findPerson ? Engine.findPerson(ps.parentIds[i]) : null;
                        if (otherParent && otherParent.alive) {
                            otherParentAlive = true;
                            otherParentName = _getPersonName(otherParent);
                        }
                    }
                }
            }

            if (otherParentAlive) {
                // Other parent inherits and plans funeral
                result.funeralPlannedBy = otherParentName;
                // v9p33river88: track where the funeral will be held
                var _opPerson = ps.parentIds.map(function(pid) { return Engine.findPerson ? Engine.findPerson(pid) : null; }).find(function(pp) { return pp && pp.alive; });
                if (_opPerson) result.funeralPlannedByTownId = _opPerson.townId || null;
                result.funeralTownId = result.funeralPlannedByTownId || (p ? p.townId : null);
                result.funeralDay = (Engine.getDay ? Engine.getDay() : 0) + 7;
            } else {
                // Both parents dead — inheritance goes to children (siblings + player)
                var siblings = [];
                if (ps.siblingIds) {
                    for (var si = 0; si < ps.siblingIds.length; si++) {
                        var sib = Engine.findPerson ? Engine.findPerson(ps.siblingIds[si]) : null;
                        if (sib && sib.alive && sib.age >= 18) siblings.push(sib);
                    }
                }

                // Player is always an eligible child
                var playerAge = ps.age || 18;
                var allEligible = [];
                if (playerAge >= 18) {
                    allEligible.push({ id: 'player', age: playerAge, name: ps.firstName || 'You' });
                }
                for (var ei = 0; ei < siblings.length; ei++) {
                    allEligible.push({ id: siblings[ei].id, age: siblings[ei].age, name: _getPersonName(siblings[ei]) });
                }

                // Sort by age descending (oldest first)
                allEligible.sort(function(a, b) { return b.age - a.age; });

                if (allEligible.length > 0 && allEligible[0].id === 'player') {
                    // Player is oldest — gets inheritance and plans funeral
                    result.playerInherits = true;
                    result.playerPlansFuneral = true;
                    result.goldAmount = Math.floor(deceasedGold * 0.50);
                    result.buildings = deceasedBuildings;
                } else if (allEligible.length > 0) {
                    // Check if player gets a share
                    for (var pi = 0; pi < allEligible.length; pi++) {
                        if (allEligible[pi].id === 'player') {
                            var share = pi === 0 ? 0.50 : (pi === 1 ? 0.30 : 0.20);
                            result.playerInherits = true;
                            result.goldAmount = Math.floor(deceasedGold * share);
                            break;
                        }
                    }
                    result.funeralPlannedBy = allEligible[0].name;
                    // v9p33river88: track town/day for the elder sibling who plans
                    var _elder = Engine.findPerson ? Engine.findPerson(allEligible[0].id) : null;
                    if (_elder) result.funeralPlannedByTownId = _elder.townId || null;
                    result.funeralTownId = result.funeralPlannedByTownId || (p ? p.townId : null);
                    result.funeralDay = (Engine.getDay ? Engine.getDay() : 0) + 7;
                }
            }
        } else if (relationship === 'sibling') {
            // Sibling: no inheritance unless no spouse/children
            if (p && !p.spouseId && (!p.childrenIds || p.childrenIds.length === 0)) {
                result.playerInherits = true;
                result.goldAmount = Math.floor(deceasedGold * 0.50);
                result.buildings = deceasedBuildings;
                result.playerPlansFuneral = true;
            }
        } else if (relationship === 'child') {
            // Child: no assets to inherit
            result.playerPlansFuneral = true;
        }

        return result;
    }

    // ── B. FUNERAL PLANNING UI ──

    function showFuneralPlanning(personId, relationship) {
        var p = Engine.findPerson ? Engine.findPerson(personId) : (Engine.getPerson ? Engine.getPerson(personId) : null);
        var name = p ? _getPersonName(p) : 'the deceased';
        var relLabel = _getRelationshipLabel(relationship);
        var playerTownId = Player.state ? Player.state.townId : (Player.townId || null);
        var hasChurch = _hasChurchInTown(playerTownId);
        // v9p33river316: state funeral eligibility now uses the deceased's
        // home kingdom rank (or current-town kingdom rank as a fallback)
        // instead of the player's highest rank in any kingdom. A noble
        // dying in their own realm should get a state funeral; a noble
        // dying abroad shouldn't qualify based on a foreign rank.
        var _deceasedKingdomId = (p && p.kingdomId) || null;
        if (!_deceasedKingdomId && playerTownId) {
            var _pt = Engine.findTown ? Engine.findTown(playerTownId) : null;
            _deceasedKingdomId = _pt ? _pt.kingdomId : null;
        }
        var playerRank = _getPlayerNobleRank(_deceasedKingdomId);

        var html = '<div style="padding:12px;">';
        html += '<h3 style="color:#9b59b6;margin:0 0 10px;">🪦 Funeral Planning for ' + escapeHtml(name) + '</h3>';
        html += '<div style="font-size:0.75rem;color:#aaa;margin-bottom:14px;">Your ' + escapeHtml(relLabel) + '</div>';

        // Section 0: Location
        var locationOptions = [];
        var addedTownIds = {};
        // Current town (default)
        if (playerTownId) {
            locationOptions.push({ townId: playerTownId, label: _getTownName(playerTownId) + ' (your current town)', isDefault: true });
            addedTownIds[playerTownId] = true;
        }
        // Deceased's town
        var deceasedTownId = p ? p.townId : null;
        if (deceasedTownId && !addedTownIds[deceasedTownId]) {
            locationOptions.push({ townId: deceasedTownId, label: _getTownName(deceasedTownId) + ' (deceased\'s home)' });
            addedTownIds[deceasedTownId] = true;
        }
        // Towns where player owns buildings
        var playerBuildings = (Player.state && Player.state.buildings) ? Player.state.buildings : [];
        for (var pbi = 0; pbi < playerBuildings.length; pbi++) {
            var pbTownId = playerBuildings[pbi].townId;
            if (pbTownId && !addedTownIds[pbTownId]) {
                locationOptions.push({ townId: pbTownId, label: _getTownName(pbTownId) + ' (you own property)' });
                addedTownIds[pbTownId] = true;
            }
        }

        html += '<div style="margin-bottom:14px;">';
        html += '<div style="color:#e0c068;font-weight:bold;margin-bottom:6px;font-size:0.82rem;">📍 Location</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
        for (var li = 0; li < locationOptions.length; li++) {
            var loc = locationOptions[li];
            html += '<button class="btn-medieval" data-action="funeralSetLocation" data-locationid="' + loc.townId + '" ';
            html += 'style="font-size:0.7rem;padding:6px;text-align:center;color:#111;">';
            html += '<div style="font-weight:bold;">' + escapeHtml(loc.label) + '</div>';
            if (loc.isDefault) html += '<div style="font-size:0.58rem;color:#2a7;">Default</div>';
            html += '</button>';
        }
        html += '</div></div>';

        // Section 1: Timing
        html += '<div style="margin-bottom:14px;">';
        html += '<div style="color:#e0c068;font-weight:bold;margin-bottom:6px;font-size:0.82rem;">⏳ Timing</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">';
        for (var ti = 0; ti < FUNERAL_TIMING.length; ti++) {
            var ft = FUNERAL_TIMING[ti];
            var repText = ft.rep > 0 ? '+' + ft.rep + ' rep' : (ft.rep < 0 ? ft.rep + ' rep' : '');
            html += '<button class="btn-medieval" data-action="funeralSetTiming" data-timingid="' + ft.id + '" ';
            html += 'style="font-size:0.7rem;padding:6px;text-align:center;color:#111;">';
            html += '<div style="font-weight:bold;">' + escapeHtml(ft.name) + '</div>';
            html += '<div style="font-size:0.62rem;color:#555;">' + ft.days + ' days • -' + ft.cost + 'g</div>';
            if (repText) html += '<div style="font-size:0.6rem;color:' + (ft.rep > 0 ? '#2a7' : '#c44') + ';">' + repText + '</div>';
            html += '</button>';
        }
        html += '</div></div>';

        // Section 2: Burial Type
        html += '<div style="margin-bottom:14px;">';
        html += '<div style="color:#e0c068;font-weight:bold;margin-bottom:6px;font-size:0.82rem;">⚰️ Burial Type</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
        for (var bi = 0; bi < BURIAL_TYPES.length; bi++) {
            var bt = BURIAL_TYPES[bi];
            var disabled = bt.requiresChurch && !hasChurch;
            html += '<button class="btn-medieval" data-action="funeralSetBurial" data-burialid="' + bt.id + '" ';
            html += 'style="font-size:0.7rem;padding:6px;text-align:left;color:#111;' + (disabled ? 'opacity:0.4;' : '') + '" ' + (disabled ? 'disabled' : '') + '>';
            html += bt.icon + ' ' + escapeHtml(bt.name);
            html += '<br><span style="font-size:0.6rem;color:#555;">-' + bt.cost + 'g' + (bt.rep > 0 ? ' • +' + bt.rep + ' rep' : '') + '</span>';
            if (disabled) html += '<br><span style="font-size:0.58rem;color:#c44;">No church in town</span>';
            html += '</button>';
        }
        html += '</div></div>';

        // Section 3: Ceremony Style
        html += '<div style="margin-bottom:14px;">';
        html += '<div style="color:#e0c068;font-weight:bold;margin-bottom:6px;font-size:0.82rem;">🕯️ Ceremony Style</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">';
        for (var ci = 0; ci < CEREMONY_STYLES.length; ci++) {
            var cs = CEREMONY_STYLES[ci];
            var cantAffordRank = cs.requiresRank > 0 && playerRank < cs.requiresRank;
            html += '<button class="btn-medieval" data-action="funeralSetCeremony" data-ceremonyid="' + cs.id + '" ';
            html += 'style="font-size:0.7rem;padding:6px;text-align:center;color:#111;' + (cantAffordRank ? 'opacity:0.4;' : '') + '" ' + (cantAffordRank ? 'disabled' : '') + '>';
            html += '<div style="font-weight:bold;">' + escapeHtml(cs.name) + '</div>';
            html += '<div style="font-size:0.62rem;color:#555;">' + (cs.cost > 0 ? '-' + cs.cost + 'g • ' : '') + 'Max ' + cs.maxAttendees + '</div>';
            html += '<div style="font-size:0.6rem;color:#888;">' + escapeHtml(cs.desc) + '</div>';
            if (cantAffordRank) html += '<div style="font-size:0.58rem;color:#c44;">Requires rank 4+</div>';
            html += '</button>';
        }
        html += '</div></div>';

        // Current selections
        html += '<div id="funeral-plan-summary" style="background:rgba(0,0,0,0.2);border-radius:4px;padding:8px;font-size:0.72rem;color:#bbb;">';
        html += _renderPlanSummary();
        html += '</div>';

        html += '</div>';

        var footer = '<button class="btn-medieval" data-action="funeralFinalize" data-personid="' + personId + '" data-rel="' + relationship + '" style="margin-right:6px;">✅ Confirm Funeral</button>';
        footer += '<button class="btn-medieval" data-action="closeModal">Cancel</button>';

        openModal('🪦 Plan Funeral for ' + escapeHtml(name), html, footer);

        // Initialize temporary plan state
        if (!Player.state._funeralPlanDraft) {
            Player.state._funeralPlanDraft = { timing: null, burial: null, ceremony: null, locationTownId: playerTownId };
        }
    }

    function _renderPlanSummary() {
        var draft = (Player.state && Player.state._funeralPlanDraft) || {};
        var parts = [];
        if (draft.locationTownId) parts.push('Location: ' + _getTownName(draft.locationTownId));
        if (draft.timing) parts.push('Timing: ' + draft.timing);
        if (draft.burial) parts.push('Burial: ' + draft.burial);
        if (draft.ceremony) parts.push('Ceremony: ' + draft.ceremony);
        if (parts.length === 0) return 'Select location, timing, burial type, and ceremony style above.';
        return parts.join(' &bull; ');
    }

    function _updatePlanSummaryDOM() {
        var el = document.getElementById('funeral-plan-summary');
        if (el) el.innerHTML = _renderPlanSummary();
    }

    // ── C. FUNERAL EVENT UI ──

    function showFuneralEvent() {
        var plan = Player.state ? Player.state.funeralPlan : null;
        if (!plan) {
            toast('No funeral is scheduled.', 'warning');
            return;
        }
        // v9p33river93: pause the game when the funeral attendance UI opens
        try {
            if (typeof Game !== 'undefined' && Game.getSpeed && Game.setSpeed) {
                var _curSpd = Game.getSpeed();
                if (_curSpd > 0) window._funeralPauseSavedSpeed = _curSpd;
                Game.setSpeed(0);
            }
        } catch (_e) {}

        var name = plan.deceasedName || 'the deceased';
        var rel = plan.relationship || 'family member';
        var attendees = plan.attendees || [];

        // Track which actions have been performed
        if (!plan._actionsPerformed) plan._actionsPerformed = {};

        var universalActions = [
            { id: 'pay_respects',      icon: '🙏', name: 'Pay Respects',       desc: 'Stand silently at the grave (+5 rep)', targeted: false },
            { id: 'speak_words',       icon: '🗣️', name: 'Speak Words',        desc: 'Say words about the deceased (+8 rep, +5 rel)', targeted: false },
            { id: 'comfort_mourners',  icon: '🤗', name: 'Comfort Someone',    desc: 'Comfort a mourner (+5 rel with them)', targeted: true },
            { id: 'share_memories',    icon: '💭', name: 'Share Memories',      desc: 'Share a memory with someone (+5 rel)', targeted: true },
            { id: 'offer_condolences', icon: '🤝', name: 'Offer Condolences',  desc: 'Offer condolences to someone (+3 rel, +2 rep)', targeted: true },
            { id: 'pray',             icon: '✝️', name: 'Pray',               desc: 'Pray for the departed (+3 rep)', targeted: false },
            { id: 'tend_grave',        icon: '🌸', name: 'Tend Grave',         desc: 'Place flowers at the burial site (+2 rep)', targeted: false },
            { id: 'host_wake',         icon: '🍷', name: 'Host Wake',          desc: 'Host a wake gathering (-50g, +10 rel all)', targeted: false }
        ];

        var relActions = [];
        if (rel === 'spouse') {
            relActions.push({ id: 'farewell_spouse', icon: '💔', name: 'Bid Farewell', desc: 'Bid farewell to your beloved (+15 rep)' });
        }
        if (rel === 'mother' || rel === 'father' || rel === 'parent') {
            relActions.push({ id: 'honor_parent', icon: '👑', name: 'Honor Legacy', desc: "Honor your parent's legacy (+10 rep)" });
        }
        if (rel === 'sibling') {
            relActions.push({ id: 'remember_sibling', icon: '👫', name: 'Remember Childhood', desc: 'Remember your shared childhood (+8 rep)' });
        }
        if (rel === 'child') {
            relActions.push({ id: 'mourn_child', icon: '😢', name: 'Mourn the Loss', desc: 'Mourn the life that could have been (+10 rep)' });
        }

        var allActions = universalActions.concat(relActions);

        // Action-count system: 5 base + bonus from ceremony options
        if (plan._actionsRemaining == null) {
            var baseActions = 5;
            if (plan.timing === 'grand') baseActions += 2;
            if (plan.ceremony === 'state') baseActions += 3;
            if (plan.burial === 'memorial_monument') baseActions += 1;
            plan._actionsRemaining = baseActions;
        }
        var actionsRemaining = plan._actionsRemaining;

        var html = '<div style="padding:12px;">';
        html += '<div style="text-align:center;font-size:1.3rem;margin-bottom:6px;">⚰️🕯️</div>';
        html += '<h3 style="color:#9b59b6;margin:0 0 6px;text-align:center;">Funeral of ' + escapeHtml(name) + '</h3>';
        html += '<div style="text-align:center;font-size:0.72rem;color:#aaa;margin-bottom:6px;">Your ' + escapeHtml(_getRelationshipLabel(rel)) + '</div>';

        // Attendees header + collapsible list
        html += '<div style="margin-bottom:10px;">';
        html += '<div data-action="toggleAttendeeList" style="font-size:0.72rem;color:#999;text-align:center;cursor:pointer;user-select:none;">';
        html += '👥 ' + attendees.length + ' mourner' + (attendees.length !== 1 ? 's' : '') + ' in attendance <span style="font-size:0.6rem;color:#666;">(click to expand)</span>';
        html += '</div>';
        html += '<div id="funeral-attendee-list" style="display:none;max-height:140px;overflow-y:auto;background:rgba(0,0,0,0.15);border-radius:4px;padding:6px;margin-top:4px;">';
        if (attendees.length === 0) {
            html += '<div style="font-size:0.65rem;color:#777;text-align:center;">No one else attended.</div>';
        } else {
            // Tag family members
            var _famSet = {};
            var _ps = Player.state || {};
            if (_ps.childrenIds) for (var _fi0 = 0; _fi0 < _ps.childrenIds.length; _fi0++) _famSet[_ps.childrenIds[_fi0]] = 'child';
            if (_ps.parentIds) for (var _fi1 = 0; _fi1 < _ps.parentIds.length; _fi1++) _famSet[_ps.parentIds[_fi1]] = 'parent';
            if (_ps.siblingIds) for (var _fi2 = 0; _fi2 < _ps.siblingIds.length; _fi2++) _famSet[_ps.siblingIds[_fi2]] = 'sibling';
            if (_ps.spouseId) _famSet[_ps.spouseId] = 'spouse';
            for (var ati = 0; ati < attendees.length; ati++) {
                var att = attendees[ati];
                var attName = typeof att === 'object' ? (att.name || 'Unknown') : att;
                var attId = typeof att === 'object' ? att.id : att;
                var famTag = _famSet[attId] ? ' <span style="color:#9b59b6;font-size:0.58rem;">(' + _famSet[attId] + ')</span>' : '';
                html += '<div style="font-size:0.65rem;color:#ccc;padding:1px 0;">• ' + escapeHtml(attName) + famTag + '</div>';
            }
        }
        html += '</div></div>';

        // Actions remaining
        html += '<div style="font-size:0.7rem;color:#ccc;margin-bottom:10px;">Actions remaining: <span style="color:#3498db;">' + actionsRemaining + '</span></div>';

        // Action buttons
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
        for (var ai = 0; ai < allActions.length; ai++) {
            var a = allActions[ai];
            var done = plan._actionsPerformed[a.id];
            var noActions = actionsRemaining <= 0;
            var isDisabled = done || noActions;
            if (a.targeted && attendees.length > 0 && !done && !noActions) {
                // Targeted action: render as container with dropdown + button
                html += '<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:6px;">';
                html += '<div style="font-size:0.7rem;color:#ddd;margin-bottom:4px;">' + a.icon + ' ' + escapeHtml(a.name) + '</div>';
                html += '<div style="font-size:0.6rem;color:#888;margin-bottom:4px;">' + escapeHtml(a.desc) + '</div>';
                html += '<select id="funeral-target-' + a.id + '" style="width:100%;font-size:0.65rem;padding:2px;margin-bottom:4px;background:#2a2a2a;color:#ccc;border:1px solid #555;border-radius:3px;">';
                for (var sti = 0; sti < attendees.length; sti++) {
                    var satt = attendees[sti];
                    var sattName = typeof satt === 'object' ? (satt.name || 'Unknown') : satt;
                    var sattId = typeof satt === 'object' ? satt.id : satt;
                    html += '<option value="' + sattId + '">' + escapeHtml(sattName) + '</option>';
                }
                html += '</select>';
                html += '<button class="btn-medieval" data-action="doFuneralActionTargeted" data-actionid="' + a.id + '" style="font-size:0.65rem;padding:3px 8px;width:100%;color:#111;">' + a.icon + ' Do it</button>';
                html += '</div>';
            } else {
                html += '<button class="btn-medieval" data-action="doFuneralAction" data-actionid="' + a.id + '" ';
                html += 'style="font-size:0.7rem;padding:6px;text-align:left;color:#111;' + (isDisabled ? 'opacity:0.35;' : '') + '" ' + (isDisabled ? 'disabled' : '') + '>';
                html += a.icon + ' ' + escapeHtml(a.name);
                if (done) {
                    html += ' <span style="color:#2a7;font-size:0.6rem;">✓</span>';
                }
                html += '<br><span style="font-size:0.6rem;color:#555;">' + escapeHtml(a.desc) + '</span>';
                html += '</button>';
            }
        }
        html += '</div>';
        html += '</div>';

        var footer = '<button class="btn-medieval" data-action="funeralEnd">🕊️ End Funeral</button>';

        openModal('⚰️ Funeral of ' + escapeHtml(name), html, footer);
    }

    // ── FUNERAL ACTION HANDLER ──

    function _handleFuneralAction(actionId, targetPersonId) {
        var plan = Player.state ? Player.state.funeralPlan : null;
        if (!plan) { toast('No funeral active.', 'warning'); return; }
        if (!plan._actionsPerformed) plan._actionsPerformed = {};
        if (plan._actionsPerformed[actionId]) { toast('Already performed this action.', 'info'); return; }

        var actionDefs = {
            'pay_respects':      { rep: 5,  relBonus: 0,  relTarget: 'none',     msg: 'You stand silently at the grave, paying your respects.' },
            'speak_words':       { rep: 8,  relBonus: 5,  relTarget: 'attendees', msg: 'You speak heartfelt words about the departed.' },
            'comfort_mourners':  { rep: 0,  relBonus: 5,  relTarget: 'targeted', msg: 'You comfort {target} with kind words.' },
            'share_memories':    { rep: 0,  relBonus: 5,  relTarget: 'targeted', msg: 'You share a cherished memory with {target}.' },
            'offer_condolences': { rep: 2,  relBonus: 3,  relTarget: 'targeted', msg: 'You formally offer your condolences to {target}.' },
            'pray':             { rep: 3,  relBonus: 0,  relTarget: 'none',      msg: 'You pray for the departed soul.', wellbeing: 5 },
            'tend_grave':        { rep: 2,  relBonus: 0,  relTarget: 'none',      msg: 'You place flowers and tend the burial site.' },
            'host_wake':         { rep: 0,  relBonus: 10, relTarget: 'attendees', msg: 'You host a wake, bringing mourners together.', goldCost: 50 },
            'farewell_spouse':   { rep: 15, relBonus: 0,  relTarget: 'none',      msg: 'You bid a tearful farewell to your beloved.', journal: true, journalType: 'funeral', journalText: 'I said goodbye to my beloved {name}. The world feels emptier now.' },
            'honor_parent':      { rep: 10, relBonus: 5,  relTarget: 'surviving_parent', msg: "You honor your parent's legacy with dignity." },
            'remember_sibling':  { rep: 8,  relBonus: 0,  relTarget: 'none',      msg: 'You recall the days of your shared childhood.', journal: true, journalType: 'funeral', journalText: 'I remembered the days I shared with {name}. Those memories will never fade.' },
            'mourn_child':       { rep: 10, relBonus: 0,  relTarget: 'none',      msg: 'You mourn the life that could have been.', journal: true, journalType: 'funeral', journalText: 'I wept for {name}, for the life they will never live. A parent should not bury their child.' }
        };

        var def = actionDefs[actionId];
        if (!def) { toast('Unknown action.', 'warning'); return; }

        // Check actions remaining
        if (plan._actionsRemaining != null && plan._actionsRemaining <= 0) {
            toast('No actions remaining.', 'warning');
            return;
        }

        // Check gold cost
        var ps = Player.state;
        if (def.goldCost && (ps.gold || 0) < def.goldCost) {
            toast('Not enough gold (-' + def.goldCost + 'g required).', 'warning');
            return;
        }

        // Apply costs — decrement action count
        if (plan._actionsRemaining != null) plan._actionsRemaining -= 1;
        if (def.goldCost) ps.gold = (ps.gold || 0) - def.goldCost;

        // Apply reputation to funeral town
        if (def.rep > 0 && plan.funeralTownId) {
            if (Player.modifyTownReputation) {
                Player.modifyTownReputation(plan.funeralTownId, def.rep);
            }
        }

        // Apply wellbeing
        if (def.wellbeing && ps.mentalWellbeing != null) {
            ps.mentalWellbeing = (ps.mentalWellbeing || 50) + def.wellbeing;
        }

        // Apply relationship bonuses
        if (def.relBonus > 0 && def.relTarget !== 'none') {
            var targets = [];
            if (def.relTarget === 'targeted' && targetPersonId) {
                targets.push(targetPersonId);
            } else if (def.relTarget === 'attendees') {
                targets = plan.attendees || [];
            } else if (def.relTarget === 'family') {
                // Family members among attendees
                var famIds = [];
                if (ps.parentIds) famIds = famIds.concat(ps.parentIds);
                if (ps.siblingIds) famIds = famIds.concat(ps.siblingIds);
                if (ps.childrenIds) famIds = famIds.concat(ps.childrenIds);
                if (ps.spouseId) famIds.push(ps.spouseId);
                var attendeeIds = (plan.attendees || []).map(function(a) { return a.id || a; });
                for (var fi = 0; fi < famIds.length; fi++) {
                    if (attendeeIds.indexOf(famIds[fi]) >= 0) targets.push(famIds[fi]);
                }
            } else if (def.relTarget === 'surviving_parent') {
                if (ps.parentIds) {
                    for (var pi = 0; pi < ps.parentIds.length; pi++) {
                        if (ps.parentIds[pi] !== plan.deceasedId) {
                            var sp = Engine.findPerson ? Engine.findPerson(ps.parentIds[pi]) : null;
                            if (sp && sp.alive) targets.push(ps.parentIds[pi]);
                        }
                    }
                }
            }

            for (var ri = 0; ri < targets.length; ri++) {
                var targetId = typeof targets[ri] === 'object' ? targets[ri].id : targets[ri];
                if (targetId && targetId !== 'player' && Player.modifyRelationship) {
                    Player.modifyRelationship(targetId, def.relBonus);
                }
            }
        }

        // Journal entry
        if (def.journal && def.journalText) {
            var journalText = def.journalText.replace(/\{name\}/g, plan.deceasedName || 'them');
            if (Player.autoJournalCapture) {
                Player.autoJournalCapture(def.journalType || 'funeral', journalText, { mood: 'somber' });
            }
        }

        // Mark as done
        plan._actionsPerformed[actionId] = true;

        // Resolve target name for message
        var actionMsg = def.msg;
        if (targetPersonId) {
            var _tgtPerson = Engine.findPerson ? Engine.findPerson(targetPersonId) : null;
            var _tgtName = _tgtPerson ? _getPersonName(_tgtPerson) : 'them';
            actionMsg = actionMsg.replace(/\{target\}/g, _tgtName);
        } else {
            actionMsg = actionMsg.replace(/\{target\}/g, 'the mourners');
        }

        // Log
        if (Engine.logEvent) {
            Engine.logEvent('⚰️ ' + actionMsg, { type: 'funeral_action', action: actionId, target: targetPersonId || null }, 'player_activity');
        }

        toast(actionMsg, 'info');

        // Refresh the funeral panel
        showFuneralEvent();
    }

    // ── D. FUNERAL TICK ──

    function tickFuneralPlan() {
        var ps = Player.state;
        if (!ps) return;

        var currentDay = Engine.getDay ? Engine.getDay() : 0;

        var plan = ps.funeralPlan;

        // Player-planned funeral progression
        if (plan) {
            // Build attendees list if not done yet
            if (!plan._attendeesBuilt) {
                _buildAttendeeList(plan);
                plan._attendeesBuilt = true;
            }

            // Check if funeral day has arrived
            if (currentDay >= plan.funeralDay) {
                var playerTownId = ps.townId || (Player.townId || null);

                if (playerTownId === plan.funeralTownId) {
                    // Player is in town — show funeral event
                    showFuneralEvent();
                } else {
                    // Player missed the funeral
                    if (Engine.logEvent) {
                        Engine.logEvent('⚰️ The funeral of ' + (plan.deceasedName || 'your family member') + ' was held in ' + _getTownName(plan.funeralTownId) + ' without you.', {
                            type: 'funeral_missed',
                            deceasedId: plan.deceasedId
                        }, 'player_activity');
                    }
                    toast('The funeral was held without you.', 'warning');
                    _resolveFuneral(plan);
                }
            }
        }

        // Also check AI-planned funerals the player can attend
        var notif = ps.funeralNotification;
        if (notif && currentDay >= notif.funeralDay) {
            var playerTown = ps.townId || (Player.townId || null);
            if (playerTown === notif.funeralTownId) {
                // v9p33river91: synthesize a funeralPlan so the full attendance UI
                // opens (was just a toast before, which felt empty).
                // v9p33river305: previously stored burialType/ceremonyStyle
                // but consumer reads plan.burial / plan.ceremony — AI funerals
                // lost burial/ceremony effects (extra actions, attendee logic).
                // Match the canonical schema used by player-planned funerals.
                ps.funeralPlan = {
                    deceasedId: notif.deceasedId,
                    deceasedName: notif.deceasedName,
                    relationship: notif.relationship,
                    funeralDay: notif.funeralDay,
                    funeralTownId: notif.funeralTownId,
                    plannedBy: notif.plannedBy,
                    timing: 'standard',
                    burial: 'family_plot',
                    ceremony: 'public',
                    aiPlanned: true,
                    attendees: []
                };
                _buildAttendeeList(ps.funeralPlan);
                ps.funeralPlan._attendeesBuilt = true;
                if (Engine.logEvent) {
                    Engine.logEvent('⚰️ You attend the funeral of ' + (notif.deceasedName || 'your family member') + ', arranged by ' + (notif.plannedBy || 'the family') + '.', {
                        type: 'funeral_attended_ai',
                        deceasedId: notif.deceasedId
                    }, 'player_activity');
                }
                toast('You attend the funeral of ' + (notif.deceasedName || 'your family member') + '.', 'info');
                showFuneralEvent();
            } else {
                if (Engine.logEvent) {
                    Engine.logEvent('⚰️ The funeral of ' + (notif.deceasedName || 'your family member') + ' was held in ' + _getTownName(notif.funeralTownId) + '. You were unable to attend.', {
                        type: 'funeral_missed_ai',
                        deceasedId: notif.deceasedId
                    }, 'player_activity');
                }
            }
            ps.funeralNotification = null;
        }
    }

    function _buildAttendeeList(plan) {
        if (!plan.attendees) plan.attendees = [];
        var world = Engine.getWorld ? Engine.getWorld() : null;
        if (!world || !world.people) return;

        var maxAttendees = 20;
        // Determine max from ceremony style
        for (var ci = 0; ci < CEREMONY_STYLES.length; ci++) {
            if (CEREMONY_STYLES[ci].id === plan.ceremony) {
                maxAttendees = CEREMONY_STYLES[ci].maxAttendees;
                break;
            }
        }

        var addedIds = {};
        var funeralTownId = plan.funeralTownId;

        function _canAttend(npc) {
            if (!npc || !npc.alive) return false;
            if (npc.townId === funeralTownId) return true;
            // Estimate distance: check if towns are connected
            var npcTown = Engine.findTown ? Engine.findTown(npc.townId) : null;
            var fTown = Engine.findTown ? Engine.findTown(funeralTownId) : null;
            if (!npcTown || !fTown) return Math.random() < 0.5;
            // Check if directly connected (1 town away)
            var isNeighbor = false;
            if (npcTown.connectedTowns) {
                for (var ci2 = 0; ci2 < npcTown.connectedTowns.length; ci2++) {
                    if (npcTown.connectedTowns[ci2] === funeralTownId || (npcTown.connectedTowns[ci2] && npcTown.connectedTowns[ci2].id === funeralTownId)) {
                        isNeighbor = true;
                        break;
                    }
                }
            }
            if (!isNeighbor && npcTown.roads) {
                for (var ri = 0; ri < npcTown.roads.length; ri++) {
                    var rd = npcTown.roads[ri];
                    if (rd.to === funeralTownId || rd.from === funeralTownId) { isNeighbor = true; break; }
                }
            }
            if (isNeighbor) return Math.random() < 0.8;
            return Math.random() < 0.5;
        }

        function _addAttendee(npc) {
            if (!npc || addedIds[npc.id] || plan.attendees.length >= maxAttendees) return;
            if (npc.id === plan.deceasedId) return;
            if (!npc.alive) return;
            if (!_canAttend(npc)) return;
            addedIds[npc.id] = true;
            plan.attendees.push({ id: npc.id, name: _getPersonName(npc) });
        }

        var ps = Player.state;
        var deceased = Engine.findPerson ? Engine.findPerson(plan.deceasedId) : null;

        // 1. Family first: player's children
        if (ps.childrenIds) {
            for (var ki = 0; ki < ps.childrenIds.length; ki++) {
                var child = Engine.findPerson ? Engine.findPerson(ps.childrenIds[ki]) : null;
                _addAttendee(child);
            }
        }

        // 2. Deceased's children
        if (deceased && deceased.childrenIds) {
            for (var dci = 0; dci < deceased.childrenIds.length; dci++) {
                var dChild = Engine.findPerson ? Engine.findPerson(deceased.childrenIds[dci]) : null;
                _addAttendee(dChild);
            }
        }

        // 3. Spouse's children (if spouse exists)
        if (ps.spouseId) {
            var spouse = Engine.findPerson ? Engine.findPerson(ps.spouseId) : null;
            if (spouse && spouse.childrenIds) {
                for (var sci = 0; sci < spouse.childrenIds.length; sci++) {
                    var sChild = Engine.findPerson ? Engine.findPerson(spouse.childrenIds[sci]) : null;
                    _addAttendee(sChild);
                }
            }
        }

        // 4. Player's siblings
        if (ps.siblingIds) {
            for (var si = 0; si < ps.siblingIds.length; si++) {
                var sib = Engine.findPerson ? Engine.findPerson(ps.siblingIds[si]) : null;
                _addAttendee(sib);
            }
        }

        // 5. Player's parents
        if (ps.parentIds) {
            for (var pi = 0; pi < ps.parentIds.length; pi++) {
                var par = Engine.findPerson ? Engine.findPerson(ps.parentIds[pi]) : null;
                _addAttendee(par);
            }
        }

        // 6. Elite merchants who had a relationship with the deceased
        if (world.eliteMerchants) {
            for (var emi = 0; emi < world.eliteMerchants.length; emi++) {
                var em = world.eliteMerchants[emi];
                if (!em.alive || em.id === plan.deceasedId) continue;
                var emRel = 0;
                if (em.relationships && em.relationships[plan.deceasedId]) {
                    emRel = em.relationships[plan.deceasedId].level || em.relationships[plan.deceasedId] || 0;
                }
                if (emRel >= 30) {
                    _addAttendee(em);
                } else if (emRel >= 10 && Math.random() < 0.5) {
                    _addAttendee(em);
                }
            }
        }

        // 7. Other people with relationships to the deceased
        for (var i = 0; i < world.people.length; i++) {
            if (plan.attendees.length >= maxAttendees) break;
            var npc = world.people[i];
            if (!npc.alive || npc.id === plan.deceasedId || addedIds[npc.id]) continue;

            var relToDeceased = 0;
            if (npc.relationships && npc.relationships[plan.deceasedId]) {
                relToDeceased = npc.relationships[plan.deceasedId].level || npc.relationships[plan.deceasedId] || 0;
            }

            var willAttend = false;
            if (relToDeceased >= 60) {
                willAttend = true;
            } else if (relToDeceased >= 20) {
                willAttend = Math.random() < 0.5;
            }

            if (willAttend) {
                _addAttendee(npc);
            }
        }

        // 8. Public/State ceremony: add random townspeople from funeral town
        if (plan.ceremony === 'public' || plan.ceremony === 'state') {
            var randomMin = plan.ceremony === 'state' ? 20 : 5;
            var randomMax = plan.ceremony === 'state' ? 50 : 15;
            var randomCount = randomMin + Math.floor(Math.random() * (randomMax - randomMin + 1));
            var townLocals = [];
            for (var tli = 0; tli < world.people.length; tli++) {
                var local = world.people[tli];
                if (!local.alive || local.id === plan.deceasedId || addedIds[local.id]) continue;
                if (local.townId === funeralTownId) {
                    townLocals.push(local);
                }
            }
            // Shuffle and pick
            for (var shi = townLocals.length - 1; shi > 0; shi--) {
                var shj = Math.floor(Math.random() * (shi + 1));
                var tmp = townLocals[shi];
                townLocals[shi] = townLocals[shj];
                townLocals[shj] = tmp;
            }
            for (var rli = 0; rli < Math.min(randomCount, townLocals.length); rli++) {
                if (plan.attendees.length >= maxAttendees) break;
                _addAttendee(townLocals[rli]);
            }
        }
    }

    function _resolveFuneral(plan) {
        var funeralTownId = plan.funeralTownId;

        // Apply timing reputation
        for (var ti = 0; ti < FUNERAL_TIMING.length; ti++) {
            if (FUNERAL_TIMING[ti].id === plan.timing && FUNERAL_TIMING[ti].rep !== 0) {
                if (funeralTownId && Player.modifyTownReputation) {
                    Player.modifyTownReputation(funeralTownId, FUNERAL_TIMING[ti].rep);
                }
            }
        }

        // Apply burial reputation
        for (var bi = 0; bi < BURIAL_TYPES.length; bi++) {
            if (BURIAL_TYPES[bi].id === plan.burial && BURIAL_TYPES[bi].rep > 0) {
                if (funeralTownId && Player.modifyTownReputation) {
                    Player.modifyTownReputation(funeralTownId, BURIAL_TYPES[bi].rep);
                }
            }
        }

        // Apply ceremony reputation
        for (var ci = 0; ci < CEREMONY_STYLES.length; ci++) {
            if (CEREMONY_STYLES[ci].id === plan.ceremony && CEREMONY_STYLES[ci].rep > 0) {
                if (funeralTownId && Player.modifyTownReputation) {
                    Player.modifyTownReputation(funeralTownId, CEREMONY_STYLES[ci].rep);
                }
            }
        }

        // Grand memorial: +5 relationship with all attendees
        if (plan.timing === 'grand' && plan.attendees) {
            for (var ai = 0; ai < plan.attendees.length; ai++) {
                var attId = typeof plan.attendees[ai] === 'object' ? plan.attendees[ai].id : plan.attendees[ai];
                if (attId && attId !== 'player' && Player.modifyRelationship) {
                    Player.modifyRelationship(attId, 5);
                }
            }
        }

        // Private ceremony: +10 relationship with close family
        if (plan.ceremony === 'private') {
            var famIds = [];
            var ps = Player.state;
            if (ps.parentIds) famIds = famIds.concat(ps.parentIds);
            if (ps.siblingIds) famIds = famIds.concat(ps.siblingIds);
            if (ps.childrenIds) famIds = famIds.concat(ps.childrenIds);
            if (ps.spouseId) famIds.push(ps.spouseId);
            for (var fi = 0; fi < famIds.length; fi++) {
                if (famIds[fi] && Player.modifyRelationship) {
                    var fp = Engine.findPerson ? Engine.findPerson(famIds[fi]) : null;
                    if (fp && fp.alive) Player.modifyRelationship(famIds[fi], 10);
                }
            }
        }

        // Clear the plan
        Player.state.funeralPlan = null;
    }

    // ── E. AI-PLANNED FUNERAL (parent/sibling handles it) ──

    function _setupAIFuneral(deceasedPerson, relationship, plannedByName, plannedByTownId) {
        var ps = Player.state;
        if (!ps) return;

        var currentDay = Engine.getDay ? Engine.getDay() : 0;
        var funeralDay = currentDay + 7; // AI always does standard timing
        var funeralTownId = plannedByTownId || deceasedPerson.townId || (ps.townId || null);

        ps.funeralNotification = {
            deceasedId: deceasedPerson.id,
            deceasedName: _getPersonName(deceasedPerson),
            relationship: relationship,
            funeralDay: funeralDay,
            funeralTownId: funeralTownId,
            plannedBy: plannedByName
        };

        // v9p33river88: include the funeral location in both the toast and the
        // event log so the player knows WHERE to go.
        var _funTownName = funeralTownId ? _getTownName(funeralTownId) : 'an unknown town';
        var _msg = '⚰️ ' + (plannedByName || 'The family') + ' is planning the funeral of ' + _getPersonName(deceasedPerson) + ' in ' + _funTownName + ' for day ' + funeralDay + '.';
        toast(_msg, 'info');
        try { if (Engine.logEvent) Engine.logEvent(_msg, { type: 'family' }, 'family'); } catch (_e) {}
    }

    // ── ACTION REGISTRATIONS ──

    UI.registerAction('funeralPlanStart', function(_t, d) {
        var personId = d.personid;
        var rel = d.rel;
        UI._funeralLocked = false;
        UI._pendingFuneralArgs = null;
        closeModal();
        showFuneralPlanning(personId, rel);
    });

    UI.registerAction('funeralSetLocation', function(_t, d) {
        if (!Player.state._funeralPlanDraft) Player.state._funeralPlanDraft = {};
        Player.state._funeralPlanDraft.locationTownId = d.locationid;
        toast('Location set: ' + _getTownName(d.locationid), 'success');
        _updatePlanSummaryDOM();
    });

    UI.registerAction('funeralSetTiming', function(_t, d) {
        if (!Player.state._funeralPlanDraft) Player.state._funeralPlanDraft = {};
        Player.state._funeralPlanDraft.timing = d.timingid;
        toast('Timing set: ' + d.timingid, 'success');
        _updatePlanSummaryDOM();
    });

    UI.registerAction('funeralSetBurial', function(_t, d) {
        if (!Player.state._funeralPlanDraft) Player.state._funeralPlanDraft = {};
        Player.state._funeralPlanDraft.burial = d.burialid;
        toast('Burial set: ' + d.burialid, 'success');
        _updatePlanSummaryDOM();
    });

    UI.registerAction('funeralSetCeremony', function(_t, d) {
        if (!Player.state._funeralPlanDraft) Player.state._funeralPlanDraft = {};
        Player.state._funeralPlanDraft.ceremony = d.ceremonyid;
        toast('Ceremony set: ' + d.ceremonyid, 'success');
        _updatePlanSummaryDOM();
    });

    UI.registerAction('funeralFinalize', function(_t, d) {
        var draft = Player.state._funeralPlanDraft;
        if (!draft || !draft.timing || !draft.burial || !draft.ceremony) {
            toast('Please select timing, burial type, and ceremony style.', 'warning');
            return;
        }

        var personId = d.personid;
        var rel = d.rel;
        var p = Engine.findPerson ? Engine.findPerson(personId) : null;

        // Look up costs
        var totalCost = 0;
        var timingDays = 7;
        for (var ti = 0; ti < FUNERAL_TIMING.length; ti++) {
            if (FUNERAL_TIMING[ti].id === draft.timing) {
                totalCost += FUNERAL_TIMING[ti].cost;
                timingDays = FUNERAL_TIMING[ti].days;
                break;
            }
        }
        for (var bi = 0; bi < BURIAL_TYPES.length; bi++) {
            if (BURIAL_TYPES[bi].id === draft.burial) { totalCost += BURIAL_TYPES[bi].cost; break; }
        }
        for (var ci = 0; ci < CEREMONY_STYLES.length; ci++) {
            if (CEREMONY_STYLES[ci].id === draft.ceremony) { totalCost += CEREMONY_STYLES[ci].cost; break; }
        }

        if ((Player.state.gold || 0) < totalCost) {
            toast('Not enough gold! Need ' + totalCost + 'g.', 'warning');
            return;
        }

        // Deduct cost
        Player.state.gold = (Player.state.gold || 0) - totalCost;

        var currentDay = Engine.getDay ? Engine.getDay() : 0;
        var playerTownId = Player.state.townId || (Player.townId || null);
        var funeralTownId = draft.locationTownId || playerTownId;

        // Create the funeral plan
        Player.state.funeralPlan = {
            deceasedId: personId,
            deceasedName: p ? _getPersonName(p) : 'the deceased',
            relationship: rel,
            timing: draft.timing,
            timingDays: timingDays,
            burial: draft.burial,
            ceremony: draft.ceremony,
            funeralDay: currentDay + timingDays,
            funeralTownId: funeralTownId,
            attendees: [],
            _actionsPerformed: {},
            _attendeesBuilt: false
        };

        // Clear draft
        delete Player.state._funeralPlanDraft;

        if (Engine.logEvent) {
            Engine.logEvent('🪦 You have planned a funeral for ' + (Player.state.funeralPlan.deceasedName) + '. The ceremony will be held in ' + _getTownName(funeralTownId) + ' on day ' + Player.state.funeralPlan.funeralDay + '.', {
                type: 'funeral_planned',
                cost: totalCost,
                timing: draft.timing,
                burial: draft.burial,
                ceremony: draft.ceremony
            }, 'player_activity');
        }

        closeModal();
        toast('🪦 Funeral planned for day ' + Player.state.funeralPlan.funeralDay + '. Cost: ' + totalCost + 'g.', 'success');
    });

    UI.registerAction('doFuneralAction', function(_t, d) {
        _handleFuneralAction(d.actionid);
    });

    UI.registerAction('doFuneralActionTargeted', function(_t, d) {
        var selectEl = document.getElementById('funeral-target-' + d.actionid);
        var targetId = selectEl ? selectEl.value : null;
        if (!targetId) { toast('Select a person first.', 'warning'); return; }
        _handleFuneralAction(d.actionid, targetId);
    });

    UI.registerAction('toggleAttendeeList', function() {
        var el = document.getElementById('funeral-attendee-list');
        if (el) {
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        }
    });

    UI.registerAction('funeralEnd', function() {
        var plan = Player.state ? Player.state.funeralPlan : null;
        if (plan) {
            if (Engine.logEvent) {
                var actionCount = plan._actionsPerformed ? Object.keys(plan._actionsPerformed).length : 0;
                Engine.logEvent('⚰️ The funeral of ' + (plan.deceasedName || 'your family member') + ' has concluded. You performed ' + actionCount + ' act(s) of remembrance.', {
                    type: 'funeral_complete',
                    actions: actionCount
                }, 'player_activity');
            }
            _resolveFuneral(plan);
        }
        closeModal();
        toast('🕊️ The funeral has concluded.', 'info');
    });

    // ── REGISTER PUBLIC API ──

    UI.showDeathNotification = showDeathNotification;
    UI.showFuneralPlanning   = showFuneralPlanning;
    UI.showFuneralEvent      = showFuneralEvent;
    UI.reopenPendingFuneral  = reopenPendingFuneral;
    UI.tickFuneralPlan       = tickFuneralPlan;
    UI._setupAIFuneral       = _setupAIFuneral;

})(window.UI);
