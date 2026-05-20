// ============================================================
// Merchant Realms — Spouse Jealousy + Annulment Module
// v9p33river358: Spouses can find out about player courting
// actions, confront the player, and react in personality-driven
// ways. Three rare traits modify the consequences:
//   - vengeful_spouse: walks out (annulled by you, in spirit)
//   - murderous_spouse: tries to assassinate the lover
//   - paranoid_spouse: occasionally interprets high same-gender
//     relationships as cheating
// Plus a baseline reaction of -50 relationship + 30-day silent
// treatment, scaled by warmth / vindictiveness / loyalty.
//
// Annulment system:
//   - Player who is noble (rank >= 4 in any kingdom) may annul
//     for a heavy gold fee.
//   - Player who is at least a citizen (rank >= 1) may petition
//     the king for an annulment with low approval chance.
//   - Spouse panel surfaces the controls.
//
// Public API (Player):
//   Player.recordCourtingAction(targetPersonId)
//   Player.tickSpouseMisbehavior()
//   Player.canAnnulMarriage()
//   Player.requestAnnulment()
//   Player.petitionKingForAnnulment()
// ============================================================
(function(Player) {
    "use strict";
    if (!Player) throw new Error('Player must be loaded before player_spouse_jealousy.js');

    var player;
    function _sync() { player = Player.state; }
    function _getDay() { try { return Engine.getDay ? Engine.getDay() : 0; } catch(e) { return 0; } }
    function _rng() { try { return Engine.getRng ? Engine.getRng() : null; } catch(e) { return null; } }
    function _findPerson(id) { try { return Engine.findPerson ? Engine.findPerson(id) : null; } catch(e) { return null; } }
    function _findTown(id) { try { return Engine.findTown ? Engine.findTown(id) : null; } catch(e) { return null; } }
    function _findKingdom(id) { try { return Engine.findKingdom ? Engine.findKingdom(id) : null; } catch(e) { return null; } }
    function _getWorld() { try { return Engine.getWorld ? Engine.getWorld() : null; } catch(e) { return null; } }
    function _toast(msg, type) { try { if (typeof UI !== 'undefined' && UI.toast) UI.toast(msg, type || 'info'); } catch(e) {} }
    function _logEvent(msg, data, cat) { try { Engine.logEvent && Engine.logEvent(msg, data || null, cat || 'my_actions'); } catch(e) {} }
    function _hasQuirk(p, q) {
        if (!p || !p.quirks) return false;
        return p.quirks.indexOf(q) >= 0;
    }

    var SILENT_TREATMENT_DAYS = 30;

    function _ensureState() {
        _sync();
        if (!player._spouseAnger) player._spouseAnger = null;          // { until, reasons }
        if (!player._spouseRevealHistory) player._spouseRevealHistory = {}; // map: lover -> day
        if (!player._lastSpouseMisbehavior) player._lastSpouseMisbehavior = 0;
    }

    // ──────────────────────────────────────────────────────────
    // Record a courting action: rolls detection chance based on
    // spouse and lover locations.
    // ──────────────────────────────────────────────────────────
    function recordCourtingAction(targetPersonId) {
        _ensureState();
        if (!player.spouseId) return;
        if (targetPersonId === player.spouseId) return; // courting your spouse is fine
        var spouse = _findPerson(player.spouseId);
        var lover = _findPerson(targetPersonId);
        if (!spouse || !lover) return;
        if (spouse.alive === false) return;
        var day = _getDay();
        // Cooldown: at most one reveal-attempt for this lover per 7 days
        if (player._spouseRevealHistory[targetPersonId] && day - player._spouseRevealHistory[targetPersonId] < 7) return;
        player._spouseRevealHistory[targetPersonId] = day;

        var spouseTownId = spouse.townId;
        var loverTownId = lover.townId;
        var spouseTown = _findTown(spouseTownId);
        var loverTown = _findTown(loverTownId);
        var sameTown = spouseTownId && loverTownId && spouseTownId === loverTownId;
        var sameKingdom = false;
        try {
            if (spouseTown && loverTown && spouseTown.kingdomId && loverTown.kingdomId &&
                spouseTown.kingdomId === loverTown.kingdomId) sameKingdom = true;
        } catch(e) {}

        var detectChance;
        if (sameTown) detectChance = 0.25;
        else if (sameKingdom) detectChance = 0.10;
        else detectChance = 0.05;

        // Cold/honest/intelligent spouses are slightly more perceptive.
        var sp = spouse.personality || {};
        if ((sp.intelligence || 50) >= 65) detectChance += 0.05;
        if ((sp.honesty || 50) >= 70) detectChance += 0.03;

        if (Math.random() < detectChance) {
            _executeJealousyEvent(spouse, lover, false);
        }
    }

    // ──────────────────────────────────────────────────────────
    // Paranoid spouse: random check that interprets high
    // same-gender relationships as cheating.
    // ──────────────────────────────────────────────────────────
    function _maybeParanoidCheck() {
        _ensureState();
        if (!player.spouseId) return;
        var spouse = _findPerson(player.spouseId); if (!spouse || spouse.alive === false) return;
        if (!_hasQuirk(spouse, 'paranoid')) return;
        // Find a same-gender NPC the player has high relationship with
        var pSex = player.sex || 'M';
        var candidates = [];
        if (player.relationships) {
            for (var rid in player.relationships) {
                if (rid === player.spouseId) continue;
                if ((player.relationships[rid].level || 0) < 65) continue;
                var p = _findPerson(rid); if (!p || p.alive === false) continue;
                if (p.sex !== pSex) continue; // same gender as player
                candidates.push(p);
            }
        }
        if (!candidates.length) return;
        // 6% chance per check that paranoid spouse misreads it
        if (Math.random() > 0.06) return;
        var lover = candidates[Math.floor(Math.random() * candidates.length)];
        _executeJealousyEvent(spouse, lover, true);
    }

    // ──────────────────────────────────────────────────────────
    // Execute the jealousy event with personality-driven reaction
    // ──────────────────────────────────────────────────────────
    function _executeJealousyEvent(spouse, lover, paranoid) {
        if (!spouse || !lover) return;
        var day = _getDay();
        var sp = spouse.personality || {};
        var warmth = sp.warmth || 50;
        var loyalty = sp.loyalty || 50;
        var ambition = sp.ambition || 50;
        var consequences = []; // strings to put in the popup
        var dialogLines = [];
        var actionLabel = '';

        // Severity scaling: paranoid (false accusation) is lighter
        var baseRelHit = paranoid ? -25 : -50;
        try { Player.modifyRelationship(spouse.id, baseRelHit); } catch(e) {}
        consequences.push('Relationship with ' + spouse.firstName + ' dropped by ' + Math.abs(baseRelHit) + '.');

        // Silent treatment: refuse interaction for 30 days
        player._spouseAnger = {
            until: day + SILENT_TREATMENT_DAYS,
            reason: paranoid ? 'paranoid_accusation' : 'caught_cheating',
            loverId: lover.id,
            loverName: ((lover.firstName||'') + ' ' + (lover.lastName||'')).trim()
        };
        consequences.push(spouse.firstName + ' will not speak to you for ' + SILENT_TREATMENT_DAYS + ' days.');

        // Trait-driven escalations
        if (_hasQuirk(spouse, 'vengeful')) {
            // Walks out — spouse leaves the player
            try {
                // Clear marriage on both sides
                spouse.spouseId = null;
                var prevSpouseId = player.spouseId;
                player.spouseId = null;
                // Remove from familyMembers
                if (player.familyMembers) {
                    for (var fi = player.familyMembers.length - 1; fi >= 0; fi--) {
                        if (player.familyMembers[fi] && player.familyMembers[fi].npcId === prevSpouseId) {
                            player.familyMembers.splice(fi, 1);
                        }
                    }
                }
            } catch(e) {}
            actionLabel = 'walks out';
            dialogLines.push('"I am done. This marriage is over."');
            dialogLines.push('"Do not come looking for me."');
            consequences.push(spouse.firstName + ' has LEFT YOU — the marriage is dissolved.');
        } else if (_hasQuirk(spouse, 'murderous')) {
            actionLabel = 'plots murder';
            dialogLines.push('"Sleep with one eye open."');
            // Schedule an assassination attempt (placed on spouse._pendingAssassination)
            spouse._pendingAssassination = {
                targetId: lover.id,
                targetName: ((lover.firstName||'') + ' ' + (lover.lastName||'')).trim(),
                attemptDay: day + 2 + Math.floor(Math.random() * 5),
                spouseId: spouse.id
            };
            consequences.push(spouse.firstName + ' may be plotting violence against ' + ((lover.firstName||'') + ' ' + (lover.lastName||'')).trim() + '.');
        } else if (loyalty < 30 || _hasQuirk(spouse, 'vindictive') || _hasQuirk(spouse, 'manipulative')) {
            // Sabotage + rumors
            actionLabel = 'plots revenge';
            dialogLines.push('"You will pay for this. I will see to it."');
            // Pick a random player building to sabotage
            try {
                if (player.buildings && player.buildings.length > 0) {
                    var bIdx = Math.floor(Math.random() * player.buildings.length);
                    var bld = player.buildings[bIdx];
                    if (bld) {
                        if (!player.sabotagedBuildings) player.sabotagedBuildings = [];
                        // Find the corresponding building index in the town
                        var t = _findTown(bld.townId);
                        if (t && t.buildings) {
                            for (var sbi = 0; sbi < t.buildings.length; sbi++) {
                                if (t.buildings[sbi].ownerId === 'player' && t.buildings[sbi].type === bld.type) {
                                    t.buildings[sbi]._disabledUntil = day + 30;
                                    player.sabotagedBuildings.push({
                                        townId: bld.townId, buildingIdx: sbi,
                                        expiresDay: day + 30
                                    });
                                    consequences.push('Your ' + (bld.type || 'building') + ' in ' + (t.name || 'town') + ' has been SABOTAGED.');
                                    break;
                                }
                            }
                        }
                    }
                }
            } catch(e) {}
            // Kingdom reputation hit
            try {
                var t2 = _findTown(spouse.townId || player.townId);
                if (t2 && t2.kingdomId && player.reputation) {
                    var oldRep = player.reputation[t2.kingdomId] || 50;
                    var repHit = 5 + Math.floor(Math.random() * 5);
                    player.reputation[t2.kingdomId] = Math.max(0, oldRep - repHit);
                    consequences.push('Word of the affair damages your reputation (-' + repHit + ' in ' + (_findKingdom(t2.kingdomId)||{}).name + ').');
                }
            } catch(e) {}
        } else if (warmth >= 60 || _hasQuirk(spouse, 'forgiving')) {
            // Wounded but won't escalate
            actionLabel = 'is heartbroken';
            dialogLines.push('"How could you?"');
            dialogLines.push('"I do not even know what to say. Just go."');
        } else {
            // Default: cold silent treatment
            actionLabel = 'turns cold';
            dialogLines.push('"...Get out of my sight."');
        }

        // Tells friends/family/nobles — moderate cascade (any non-forgiving spouse)
        if (!_hasQuirk(spouse, 'forgiving') && warmth < 70) {
            try {
                var spread = [];
                // Spouse's own family members
                if (spouse.parentIds) for (var pi = 0; pi < spouse.parentIds.length; pi++) {
                    var pp = _findPerson(spouse.parentIds[pi]); if (pp && pp.alive !== false) spread.push(pp);
                }
                if (spouse.siblingIds) for (var sbi2 = 0; sbi2 < spouse.siblingIds.length; sbi2++) {
                    var sib = _findPerson(spouse.siblingIds[sbi2]); if (sib && sib.alive !== false) spread.push(sib);
                }
                // Nobles in spouse's kingdom (only a couple)
                var sTown = _findTown(spouse.townId);
                var sKid = sTown ? sTown.kingdomId : null;
                if (sKid) {
                    var w = _getWorld();
                    if (w) {
                        var noblesNear = w.people.filter(function(p) {
                            if (!p || p.alive === false || !p.socialRank) return false;
                            return (p.socialRank[sKid] || 0) >= 4;
                        });
                        for (var ni = 0; ni < Math.min(3, noblesNear.length); ni++) spread.push(noblesNear[ni]);
                    }
                }
                // Apply small relationship hits
                var cascadeCount = 0;
                for (var si = 0; si < spread.length && cascadeCount < 6; si++) {
                    if (spread[si].id === player.spouseId) continue;
                    if (spread[si].id === player.id) continue;
                    try {
                        Player.modifyRelationship(spread[si].id, -8);
                        // Record on memory if applicable
                        if (Player.recordNpcMemory) {
                            Player.recordNpcMemory(spread[si], 'heard_about_affair',
                                'the affair scandal' + (paranoid ? ' (allegedly)' : ''), { sentiment: 'negative' });
                        }
                        cascadeCount++;
                    } catch(e) {}
                }
                if (cascadeCount > 0) {
                    consequences.push(spouse.firstName + ' spread word — ' + cascadeCount + ' people now think less of you.');
                }
            } catch(e) {}
        }

        // Build confrontation modal
        var introLines = [];
        if (paranoid) {
            introLines.push('"I have seen the way you look at ' + (lover.firstName||'them') + '. Do not lie to me."');
            introLines.push('"Everyone sees it. EVERYONE."');
        } else {
            introLines.push('"I know about ' + (lover.firstName||'them') + '."');
            introLines.push('"Do not insult me by denying it."');
            introLines.push('"Did you think the kingdom is so big I would never hear?"');
        }
        var openingLine = introLines[Math.floor(Math.random() * introLines.length)];
        var reactionLine = dialogLines.join(' ');

        try {
            if (typeof UI !== 'undefined' && UI.openSpouseConfrontation) {
                UI.openSpouseConfrontation({
                    spouseId: spouse.id,
                    spouseName: ((spouse.firstName||'') + ' ' + (spouse.lastName||'')).trim(),
                    loverName: ((lover.firstName||'') + ' ' + (lover.lastName||'')).trim(),
                    paranoid: paranoid,
                    actionLabel: actionLabel,
                    openingLine: openingLine,
                    reactionLine: reactionLine,
                    consequences: consequences
                });
            }
        } catch(e) {}
        _logEvent('💔 ' + spouse.firstName + ' found out about your affair' + (paranoid ? ' (suspicion)' : '') + '.', null, 'my_actions');
    }

    // Check if the player is currently locked out of spouse interactions.
    function isSpouseAngry() {
        _ensureState();
        if (!player._spouseAnger) return false;
        var day = _getDay();
        if (player._spouseAnger.until && day < player._spouseAnger.until) return true;
        if (player._spouseAnger.until && day >= player._spouseAnger.until) {
            player._spouseAnger = null;
        }
        return false;
    }

    // ──────────────────────────────────────────────────────────
    // Spouse misbehavior at low relationship
    // ──────────────────────────────────────────────────────────
    function tickSpouseMisbehavior() {
        _ensureState();
        if (!player.spouseId) return;
        var day = _getDay();
        if (player._lastSpouseMisbehavior && day - player._lastSpouseMisbehavior < 14) return;
        var spouse = _findPerson(player.spouseId); if (!spouse || spouse.alive === false) return;
        var rel = 50;
        try { var _mr = Player.getRelationship(spouse.id); rel = _mr && _mr.level !== undefined ? _mr.level : 50; } catch(e) {}
        if (rel >= 35) return; // Only misbehaves when relationship is low
        var chance = 0.08 + Math.max(0, (35 - rel)) * 0.012;
        if (Math.random() > chance) return;
        player._lastSpouseMisbehavior = day;

        var sp = spouse.personality || {};
        var ambition = sp.ambition || 50;
        var honesty = sp.honesty || 50;
        var warmth = sp.warmth || 50;

        var actions = [];
        // Low honesty: steals gold
        if (honesty <= 35 && (player.gold || 0) > 100) {
            var amt = Math.min(player.gold * 0.15, 300 + Math.floor(Math.random() * 500));
            amt = Math.floor(amt);
            player.gold = Math.max(0, player.gold - amt);
            actions.push(spouse.firstName + ' helped themselves to ' + amt + 'g from your purse.');
            _logEvent('💸 ' + spouse.firstName + ' stole ' + amt + 'g from you.', null, 'my_actions');
        }
        // Ambitious + cold: bad-mouths you (rep hit)
        else if (ambition >= 60 || warmth <= 30) {
            try {
                var t = _findTown(spouse.townId || player.townId);
                if (t && t.kingdomId && player.reputation) {
                    var hit = 2 + Math.floor(Math.random() * 4);
                    player.reputation[t.kingdomId] = Math.max(0, (player.reputation[t.kingdomId] || 50) - hit);
                    actions.push(spouse.firstName + ' has been bad-mouthing you (-' + hit + ' kingdom reputation).');
                    _logEvent('🗣️ ' + spouse.firstName + ' damaged your reputation.', null, 'my_actions');
                }
            } catch(e) {}
        }
        // Default: minor sulk
        else {
            actions.push(spouse.firstName + ' has been distant and uncooperative.');
        }

        if (actions.length) _toast(actions[0], 'warning');
    }

    // ──────────────────────────────────────────────────────────
    // Pending assassination resolution
    // ──────────────────────────────────────────────────────────
    function tickSpouseAssassinations() {
        var w = _getWorld(); if (!w) return;
        var day = _getDay();
        for (var i = 0; i < w.people.length; i++) {
            var spouse = w.people[i];
            if (!spouse || !spouse._pendingAssassination) continue;
            // Dead spouses can't carry out assassinations
            if (spouse.alive === false) { spouse._pendingAssassination = null; continue; }
            var att = spouse._pendingAssassination;
            if (att.attemptDay > day) continue;
            // Resolve
            var target = _findPerson(att.targetId);
            spouse._pendingAssassination = null;
            if (!target || target.alive === false) {
                _logEvent('☠️ ' + spouse.firstName + ' set out to attack ' + att.targetName + ', but they were already gone.', null, 'my_actions');
                continue;
            }
            // Success chance: based on warmth (low) + intelligence
            var sp = spouse.personality || {};
            var success = 0.35 + Math.max(0, (50 - (sp.warmth || 50))) * 0.005;
            var caught = 0.20 + Math.max(0, (50 - (sp.intelligence || 50))) * 0.006;
            var rng = Math.random();
            var killed = rng < success;
            if (killed) {
                try { Engine.killPerson && Engine.killPerson(target, 'jealous_spouse'); } catch(e) {}
                if (target.alive === false) {
                    _logEvent('☠️ ' + (target.firstName||'A person') + ' was found dead — your spouse\'s jealousy claimed a life.', null, 'critical');
                    _toast('☠️ Your spouse killed ' + (target.firstName||'them') + '!', 'warning');
                } else {
                    _logEvent('🗡️ ' + spouse.firstName + ' attempted violence against ' + (target.firstName||'them') + ' but the target survived.', null, 'my_actions');
                    _toast('Your spouse attacked ' + (target.firstName||'them') + ' but they survived.', 'warning');
                }
            } else {
                _logEvent('🗡️ ' + spouse.firstName + ' attacked ' + (target.firstName||'them') + ' but failed.', null, 'my_actions');
                _toast('Your spouse attacked ' + (target.firstName||'them') + ' but failed.', 'warning');
            }
            if (Math.random() < caught) {
                spouse._jailedUntilDay = day + 30;
                _logEvent('⚖️ ' + spouse.firstName + ' was caught and jailed for the attack.', null, 'my_actions');
                _toast(spouse.firstName + ' was jailed for the attack.', 'info');
            }
        }
    }

    // ──────────────────────────────────────────────────────────
    // Annulment system
    // ──────────────────────────────────────────────────────────
    function canAnnulMarriage() {
        _ensureState();
        if (!player.spouseId) return false;
        // Player is noble (rank >= 4 in any kingdom)?
        if (player.socialRank) {
            for (var k in player.socialRank) if ((player.socialRank[k] || 0) >= 4) return true;
        }
        return false;
    }
    function annulmentGoldCost() {
        _ensureState();
        // Heavy fee scaling with rank
        var maxRank = 0;
        if (player.socialRank) for (var k in player.socialRank) if ((player.socialRank[k]||0) > maxRank) maxRank = player.socialRank[k];
        return 8000 + maxRank * 1500;
    }
    function requestAnnulment() {
        _ensureState();
        if (!player.spouseId) return { success: false, message: 'You are not married.' };
        if (!canAnnulMarriage()) return { success: false, message: 'Only nobles may annul a marriage directly.' };
        var cost = annulmentGoldCost();
        if ((player.gold || 0) < cost) return { success: false, message: 'Annulment requires ' + cost + 'g.' };
        player.gold = Math.max(0, (player.gold || 0) - cost);
        return _executeAnnulment('paid');
    }
    function petitionKingForAnnulment() {
        _ensureState();
        if (!player.spouseId) return { success: false, message: 'You are not married.' };
        // Need to be at least a citizen somewhere
        var maxRank = 0;
        if (player.socialRank) for (var k in player.socialRank) if ((player.socialRank[k]||0) > maxRank) maxRank = player.socialRank[k];
        if (maxRank < 1) return { success: false, message: 'You must be at least a citizen of some kingdom to petition.' };
        // Difficult approval: base 8% + rank*3 + reputation/10
        var approval = 0.08 + maxRank * 0.03;
        try {
            // Highest kingdom reputation boost
            if (player.reputation) {
                var maxRep = 0;
                for (var krk in player.reputation) if ((player.reputation[krk]||0) > maxRep) maxRep = player.reputation[krk];
                approval += Math.max(0, (maxRep - 50)) * 0.004;
            }
        } catch (e) {}
        approval = Math.max(0.04, Math.min(0.40, approval));
        if (Math.random() < approval) {
            return _executeAnnulment('royal');
        }
        return { success: false, message: 'Your petition for annulment was DENIED by the crown.' };
    }
    function _executeAnnulment(reason) {
        var prevSpouseId = player.spouseId;
        var spouse = _findPerson(prevSpouseId);
        try {
            if (spouse) spouse.spouseId = null;
            player.spouseId = null;
            if (player.familyMembers) {
                for (var fi = player.familyMembers.length - 1; fi >= 0; fi--) {
                    if (player.familyMembers[fi] && player.familyMembers[fi].npcId === prevSpouseId) {
                        player.familyMembers.splice(fi, 1);
                    }
                }
            }
            player._spouseAnger = null;
        } catch(e) {}
        _logEvent('📜 Marriage annulled.', null, 'my_actions');
        _toast('Marriage annulled.', 'success');
        return { success: true, message: 'Marriage annulled (' + reason + ').' };
    }

    // ──────────────────────────────────────────────────────────
    // Exports
    // ──────────────────────────────────────────────────────────
    Player.recordCourtingAction = recordCourtingAction;
    Player.tickSpouseMisbehavior = tickSpouseMisbehavior;
    Player.tickSpouseAssassinations = tickSpouseAssassinations;
    Player.maybeParanoidSpouseCheck = _maybeParanoidCheck;
    Player.isSpouseAngry = isSpouseAngry;
    Player.canAnnulMarriage = canAnnulMarriage;
    Player.annulmentGoldCost = annulmentGoldCost;
    Player.requestAnnulment = requestAnnulment;
    Player.petitionKingForAnnulment = petitionKingForAnnulment;
})(window.Player);
