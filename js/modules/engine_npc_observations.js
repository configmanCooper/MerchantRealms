// ============================================================
// Merchant Realms — NPC Observations Module
// v9p33river356: Watches the player for noticeable life events
// (jailing, new buildings, new caravans, wealth surges, rank
// promotions, debts) and posts memories to NPCs who would
// plausibly notice — family always, plus elite merchants and
// nobles in the same town or relevant kingdom. Memories then
// surface in dialog (see ui.js _interactionMemorySnippet and
// the Q&A dialog system).
//
// Runs every 3 days from Engine.tick. Maintains a snapshot of
// observed player state on player._observerLastSnapshot so it
// only records DELTAS.
//
// Public API (on Engine):
//   Engine.tickNpcObservations()
//   Engine.observePlayerEvent(kind, data)  // direct event dispatch
// ============================================================
(function() {
    "use strict";
    if (typeof Engine === 'undefined') return;

    function _getDay() { try { return Engine.getDay ? Engine.getDay() : 0; } catch(e) { return 0; } }
    function _getWorld() { try { return Engine.getWorld ? Engine.getWorld() : null; } catch(e) { return null; } }
    function _findTown(id) { try { return Engine.findTown ? Engine.findTown(id) : null; } catch(e) { return null; } }
    function _findPerson(id) { try { return Engine.findPerson ? Engine.findPerson(id) : null; } catch(e) { return null; } }
    function _getPlayer() {
        try { return (typeof Player !== 'undefined' && Player.state) ? Player.state : null; } catch(e) { return null; }
    }

    // Reuse the canonical qualifier + recorder from player_quests.js
    function _recordOn(npc, kind, summary, sentiment) {
        try {
            if (Player.npcQualifiesForMemory && !Player.npcQualifiesForMemory(npc)) return;
            if (Player.recordNpcMemory) Player.recordNpcMemory(npc, kind, summary, { sentiment: sentiment || 'neutral' });
        } catch (e) {}
    }

    // Family NPCs (parents, siblings, spouse, children) — always notice.
    function _familyNpcs(p) {
        if (!p) return [];
        var ids = [];
        if (p.spouseId) ids.push(p.spouseId);
        if (Array.isArray(p.parentIds)) ids = ids.concat(p.parentIds);
        if (Array.isArray(p.siblingIds)) ids = ids.concat(p.siblingIds);
        if (Array.isArray(p.childrenIds)) ids = ids.concat(p.childrenIds);
        var out = [];
        for (var i = 0; i < ids.length; i++) {
            var person = _findPerson(ids[i]);
            if (person && person.alive !== false) out.push(person);
        }
        return out;
    }

    // Elite merchants + nobles in a given town (and currently alive).
    function _notablesInTown(townId) {
        var w = _getWorld(); if (!w || !townId) return [];
        var out = [];
        for (var i = 0; i < w.people.length; i++) {
            var p = w.people[i];
            if (!p || p.alive === false || p.townId !== townId) continue;
            if (p.isEliteMerchant) { out.push(p); continue; }
            if (p.isKing) { out.push(p); continue; }
            if (p.socialRank) {
                for (var k in p.socialRank) {
                    if ((p.socialRank[k] || 0) >= 4) { out.push(p); break; }
                }
            }
        }
        return out;
    }

    // Nobles across a kingdom — used for rank promotions etc.
    function _nobleNpcsInKingdom(kingdomId) {
        var w = _getWorld(); if (!w || !kingdomId) return [];
        var out = [];
        for (var i = 0; i < w.people.length; i++) {
            var p = w.people[i];
            if (!p || p.alive === false) continue;
            if (!p.socialRank) continue;
            if ((p.socialRank[kingdomId] || 0) >= 4) out.push(p);
        }
        return out;
    }

    // Dedupe by id; sample up to N for variety.
    function _dedupSample(arr, max) {
        var seen = {};
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var p = arr[i];
            if (!p || !p.id || seen[p.id]) continue;
            seen[p.id] = true;
            out.push(p);
        }
        if (out.length > max) {
            // Random sample
            for (var k = out.length - 1; k > 0; k--) {
                var j = Math.floor(Math.random() * (k + 1));
                var tmp = out[k]; out[k] = out[j]; out[j] = tmp;
            }
            out = out.slice(0, max);
        }
        return out;
    }

    // ──────────────────────────────────────────────────────────
    // Snapshot helpers — track DELTA state across observation runs
    // ──────────────────────────────────────────────────────────
    function _ensureSnapshot(p) {
        if (!p._observerLastSnapshot) {
            p._observerLastSnapshot = {
                jailedUntilDay: p.jailedUntilDay || 0,
                buildingsIds: (p.buildings || []).map(function(b){ return _buildingKey(b); }),
                caravanCount: (p.caravans || []).length,
                gold: p.gold || 0,
                maxRankByKingdom: {},
                debtCount: (p.debts || []).length,
                completedQuests: p.completedQuestCount || 0,
                notoriety: p.notoriety || 0,
                day: _getDay()
            };
            if (p.socialRank) for (var k in p.socialRank) p._observerLastSnapshot.maxRankByKingdom[k] = p.socialRank[k] || 0;
        }
        return p._observerLastSnapshot;
    }

    function _buildingKey(b) {
        if (!b) return '';
        // Best-effort stable key.
        return (b.id || '') + ':' + (b.townId || '') + ':' + (b.type || '');
    }

    // ──────────────────────────────────────────────────────────
    // Event dispatchers — each takes context and posts memories
    // to the right set of NPCs.
    // ──────────────────────────────────────────────────────────
    function _observeJailed(p, townIdAtJail) {
        var summary = townIdAtJail
            ? ('was hauled off to jail in ' + ((_findTown(townIdAtJail) || {}).name || 'town'))
            : 'was hauled off to jail';
        var fam = _familyNpcs(p);
        var townFolk = townIdAtJail ? _notablesInTown(townIdAtJail) : [];
        var recipients = _dedupSample(fam.concat(townFolk), 24);
        for (var i = 0; i < recipients.length; i++) {
            _recordOn(recipients[i], 'jailed', summary, 'negative');
        }
    }

    function _observeNewBuilding(p, bld) {
        if (!bld) return;
        var t = _findTown(bld.townId);
        var bt = null;
        try { bt = (typeof BUILDING_TYPES !== 'undefined') ? BUILDING_TYPES[bld.type] : null; } catch(e) {}
        var bName = (bt && bt.name) || bld.type || 'building';
        var tName = (t && t.name) || 'town';
        var summary = 'built a new ' + bName + ' in ' + tName;
        var fam = _familyNpcs(p);
        var townFolk = _notablesInTown(bld.townId);
        var recipients = _dedupSample(fam.concat(townFolk), 18);
        for (var i = 0; i < recipients.length; i++) {
            _recordOn(recipients[i], 'new_building', summary, 'positive');
        }
    }

    function _observeBuildingLost(p, key) {
        // Best-effort: we only know the key, not the town anymore.
        var parts = String(key).split(':');
        var townId = parts[1];
        var type = parts[2];
        var t = _findTown(townId);
        var summary = 'lost their ' + (type || 'business') + (t ? ' in ' + t.name : '');
        var townFolk = _notablesInTown(townId);
        var fam = _familyNpcs(p);
        var recipients = _dedupSample(fam.concat(townFolk), 14);
        for (var i = 0; i < recipients.length; i++) {
            _recordOn(recipients[i], 'building_lost', summary, 'negative');
        }
    }

    function _observeNewCaravan(p) {
        var t = _findTown(p.townId);
        var summary = 'started a new caravan' + (t ? ' out of ' + t.name : '');
        var fam = _familyNpcs(p);
        var townFolk = _notablesInTown(p.townId);
        var recipients = _dedupSample(fam.concat(townFolk), 14);
        for (var i = 0; i < recipients.length; i++) {
            _recordOn(recipients[i], 'new_caravan', summary, 'neutral');
        }
    }

    function _observeWindfall(p, deltaGold) {
        var summary = 'came into a windfall of ' + Math.floor(deltaGold) + ' gold';
        var fam = _familyNpcs(p);
        var townFolk = _notablesInTown(p.townId);
        var recipients = _dedupSample(fam.concat(townFolk), 12);
        for (var i = 0; i < recipients.length; i++) {
            _recordOn(recipients[i], 'windfall', summary, 'positive');
        }
    }

    function _observeRankUp(p, kingdomId, newRank) {
        var k = null; try { k = Engine.findKingdom ? Engine.findKingdom(kingdomId) : null; } catch(e) {}
        var rankName = '';
        try { rankName = (CONFIG.SOCIAL_RANKS && CONFIG.SOCIAL_RANKS[newRank] && CONFIG.SOCIAL_RANKS[newRank].name) || ('Rank ' + newRank); } catch(e) { rankName = 'Rank ' + newRank; }
        var summary = 'rose to ' + rankName + ' in ' + ((k && k.name) || 'a kingdom');
        var fam = _familyNpcs(p);
        var nobles = _nobleNpcsInKingdom(kingdomId);
        var recipients = _dedupSample(fam.concat(nobles), 24);
        for (var i = 0; i < recipients.length; i++) {
            _recordOn(recipients[i], 'rank_up', summary, 'positive');
        }
    }

    function _observeDebt(p, lender, amount) {
        var summary = 'took on a debt of ' + Math.floor(amount || 0) + ' gold';
        // Always tell the lender (if they qualify)
        if (lender) _recordOn(lender, 'debt_taken', summary, 'neutral');
        // And tell family
        var fam = _familyNpcs(p);
        for (var i = 0; i < fam.length; i++) _recordOn(fam[i], 'debt_taken', summary, 'negative');
    }

    function _observeQuestCompleted(p, totalNow) {
        var summary = 'completed another quest (' + totalNow + ' total)';
        var fam = _familyNpcs(p);
        for (var i = 0; i < fam.length; i++) {
            _recordOn(fam[i], 'quest_completed', summary, 'positive');
        }
    }

    function _observeNotorietyJump(p, delta) {
        var summary = 'has been the subject of dark rumors';
        var fam = _familyNpcs(p);
        var townFolk = _notablesInTown(p.townId);
        var recipients = _dedupSample(fam.concat(townFolk), 18);
        for (var i = 0; i < recipients.length; i++) {
            _recordOn(recipients[i], 'notoriety_jump', summary, 'negative');
        }
    }

    // ──────────────────────────────────────────────────────────
    // Main scan — called every few days from Engine.tick
    // ──────────────────────────────────────────────────────────
    function tickNpcObservations() {
        var p = _getPlayer();
        if (!p) return;
        var snap = _ensureSnapshot(p);
        var day = _getDay();

        // 1. Jail event: jailedUntilDay just increased above today.
        var jUntil = p.jailedUntilDay || 0;
        if (jUntil > day && jUntil > (snap.jailedUntilDay || 0) + 1) {
            _observeJailed(p, p.townId);
        }
        snap.jailedUntilDay = jUntil;

        // 2. Buildings added / removed
        try {
            var curKeys = (p.buildings || []).map(_buildingKey);
            var snapKeys = snap.buildingsIds || [];
            var snapSet = {}; for (var i = 0; i < snapKeys.length; i++) snapSet[snapKeys[i]] = true;
            var curSet = {};  for (var j = 0; j < curKeys.length; j++)  curSet[curKeys[j]] = true;
            // Added
            for (var ai = 0; ai < curKeys.length; ai++) {
                if (!snapSet[curKeys[ai]]) {
                    _observeNewBuilding(p, p.buildings[ai]);
                }
            }
            // Lost
            for (var bi = 0; bi < snapKeys.length; bi++) {
                if (!curSet[snapKeys[bi]]) {
                    _observeBuildingLost(p, snapKeys[bi]);
                }
            }
            snap.buildingsIds = curKeys;
        } catch (e) {}

        // 3. New caravan
        var curCarCount = (p.caravans || []).length;
        if (curCarCount > (snap.caravanCount || 0)) {
            _observeNewCaravan(p);
        }
        snap.caravanCount = curCarCount;

        // 4. Windfall (gold delta over the last observation window)
        var curGold = p.gold || 0;
        if (curGold - (snap.gold || 0) >= 5000) {
            _observeWindfall(p, curGold - (snap.gold || 0));
        }
        snap.gold = curGold;

        // 5. Rank promotion
        try {
            if (p.socialRank) {
                for (var rk in p.socialRank) {
                    var cur = p.socialRank[rk] || 0;
                    var prev = (snap.maxRankByKingdom && snap.maxRankByKingdom[rk]) || 0;
                    if (cur > prev && cur >= 4) {
                        _observeRankUp(p, rk, cur);
                    }
                    if (!snap.maxRankByKingdom) snap.maxRankByKingdom = {};
                    snap.maxRankByKingdom[rk] = cur;
                }
            }
        } catch (e) {}

        // 6. New debt
        try {
            var curDebts = (p.debts || []).length;
            if (curDebts > (snap.debtCount || 0)) {
                var newest = p.debts[curDebts - 1];
                var lender = (newest && newest.lenderId) ? _findPerson(newest.lenderId) : null;
                _observeDebt(p, lender, newest && newest.amount);
            }
            snap.debtCount = curDebts;
        } catch (e) {}

        // 7. Quest completion (family only — generic flag)
        var curQuests = p.completedQuestCount || 0;
        if (curQuests > (snap.completedQuests || 0)) {
            _observeQuestCompleted(p, curQuests);
        }
        snap.completedQuests = curQuests;

        // 8. Notoriety jump
        var curNot = p.notoriety || 0;
        if (curNot - (snap.notoriety || 0) >= 8) {
            _observeNotorietyJump(p, curNot - (snap.notoriety || 0));
        }
        snap.notoriety = curNot;

        snap.day = day;
    }

    // Public direct event dispatch — code paths that don't fit the
    // snapshot model can call this to push a memory immediately.
    function observePlayerEvent(kind, data) {
        var p = _getPlayer(); if (!p) return;
        try {
            switch (kind) {
                case 'jailed':
                    _observeJailed(p, (data && data.townId) || p.townId);
                    break;
                case 'new_building':
                    _observeNewBuilding(p, data && data.building);
                    break;
                case 'new_caravan':
                    _observeNewCaravan(p);
                    break;
                case 'windfall':
                    if (data && data.amount) _observeWindfall(p, data.amount);
                    break;
                case 'rank_up':
                    if (data && data.kingdomId && data.rank) _observeRankUp(p, data.kingdomId, data.rank);
                    break;
                case 'debt':
                    var lender = (data && data.lenderId) ? _findPerson(data.lenderId) : null;
                    _observeDebt(p, lender, data && data.amount);
                    break;
                case 'notoriety_jump':
                    _observeNotorietyJump(p, (data && data.delta) || 0);
                    break;
            }
        } catch (e) {}
    }

    Engine.tickNpcObservations = tickNpcObservations;
    Engine.observePlayerEvent = observePlayerEvent;
})();
