// ============================================================
// Merchant Realms — Player Disposition Module
// v9p33river356: Computes how an elite merchant or noble feels
// about the player. Combines relationship level, completed
// quests for that NPC, kingdom reputation, player notability,
// competing business interests, and notoriety. Other AI systems
// (gift favors, sabotage targeting, bidding aggression, scheme
// targeting) read the disposition to bias their decisions for
// or against the player.
//
// Public API (on Engine):
//   Engine.getPlayerNotability()        -> 0..100
//   Engine.getDispositionToPlayer(npc)  -> { score, tier, factors }
//   Engine.isPlayerRival(npc)           -> bool
//   Engine.isPlayerAlly(npc)            -> bool
//   Engine.recordPlayerQuestCompleted(npc) -> void
//   Engine.recordPlayerCompetingBusiness(npc, townId, buildingType) -> void
//
// Disposition tiers (score range):
//   ally     (+60..+100)
//   friendly (+25..+59)
//   neutral  (-10..+24)
//   wary     (-40..-11)
//   rival    (-70..-41)
//   hostile  (-100..-71)
// ============================================================
(function() {
    "use strict";
    if (typeof Engine === 'undefined') {
        console.warn('engine_player_disposition.js loaded before Engine — disposition API will be no-ops.');
        return;
    }

    var _notabilityCache = { day: -1, value: 0 };

    function _getPlayer() {
        try { return (typeof Player !== 'undefined' && Player.state) ? Player.state : null; } catch(e) { return null; }
    }
    function _getDay() {
        try { return Engine.getDay ? Engine.getDay() : 0; } catch(e) { return 0; }
    }
    function _getWorld() {
        try { return Engine.getWorld ? Engine.getWorld() : null; } catch(e) { return null; }
    }
    function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    // ──────────────────────────────────────────────────────────
    // Player notability — how well-known the player is
    // ──────────────────────────────────────────────────────────
    function getPlayerNotability() {
        var day = _getDay();
        if (_notabilityCache.day === day) return _notabilityCache.value;
        var p = _getPlayer();
        if (!p) return 0;

        var score = 0;

        // Relationships: count meaningful positive connections
        try {
            if (p.relationships) {
                var posCount = 0, strongCount = 0, totalLevel = 0;
                for (var rid in p.relationships) {
                    var lvl = (p.relationships[rid] && p.relationships[rid].level) || 0;
                    if (lvl >= 20) posCount++;
                    if (lvl >= 60) strongCount++;
                    totalLevel += Math.max(0, lvl);
                }
                // Up to 30 points from breadth, up to 15 from depth
                score += Math.min(30, posCount * 0.4);
                score += Math.min(15, strongCount * 1.2);
                // Up to 10 from sheer accumulated goodwill
                score += Math.min(10, totalLevel / 200);
            }
        } catch(e) {}

        // Kingdom reputation — sum above the 50 baseline
        try {
            if (p.reputation) {
                var repAbove = 0, kingdomCount = 0;
                for (var kid in p.reputation) {
                    repAbove += Math.max(0, (p.reputation[kid] || 50) - 50);
                    kingdomCount++;
                }
                // Up to 20 points
                score += Math.min(20, repAbove / 10);
                // Cross-kingdom presence bonus (up to 5)
                if (kingdomCount >= 2) score += Math.min(5, (kingdomCount - 1) * 1.5);
            }
        } catch(e) {}

        // Social rank: nobility is well-known
        try {
            if (p.socialRank) {
                var maxRank = 0;
                for (var srk in p.socialRank) if ((p.socialRank[srk]||0) > maxRank) maxRank = p.socialRank[srk];
                score += Math.min(15, maxRank * 2.5);
            }
        } catch(e) {}

        // Wealth / scale: a magnate is famous in their own right
        try {
            var buildingCount = (p.buildings || []).length;
            score += Math.min(10, buildingCount * 0.7);
            if ((p.gold || 0) > 50000) score += 5;
            else if ((p.gold || 0) > 20000) score += 3;
            else if ((p.gold || 0) > 5000) score += 1;
        } catch(e) {}

        // Notoriety contributes — infamous is still well-known
        try {
            score += Math.min(15, (p.notoriety || 0) * 0.2);
        } catch(e) {}

        // XP/level proxy
        try {
            score += Math.min(10, (p.level || 1) * 0.7);
        } catch(e) {}

        var final = _clamp(Math.round(score), 0, 100);
        _notabilityCache = { day: day, value: final };
        return final;
    }

    // ──────────────────────────────────────────────────────────
    // Competing business detection: does this NPC own buildings
    // that compete with the player's in the same town?
    // ──────────────────────────────────────────────────────────
    function _competingBusinessPenalty(npc) {
        var p = _getPlayer();
        var w = _getWorld();
        if (!p || !w || !npc) return 0;
        var playerBuildings = p.buildings || [];
        if (!playerBuildings.length) return 0;
        var penalty = 0;
        var playerTypesByTown = {};
        for (var i = 0; i < playerBuildings.length; i++) {
            var pb = playerBuildings[i];
            if (!pb || !pb.townId || !pb.type) continue;
            if (!playerTypesByTown[pb.townId]) playerTypesByTown[pb.townId] = {};
            playerTypesByTown[pb.townId][pb.type] = true;
        }
        // Walk world.towns; if npc owns a building of a type the player
        // also owns in the same town, that is a direct rivalry.
        for (var ti = 0; ti < w.towns.length; ti++) {
            var t = w.towns[ti];
            if (!t.buildings) continue;
            var playerTypesHere = playerTypesByTown[t.id];
            if (!playerTypesHere) continue;
            for (var bi = 0; bi < t.buildings.length; bi++) {
                var b = t.buildings[bi];
                if (b.ownerId !== npc.id) continue;
                if (playerTypesHere[b.type]) {
                    // Same building type in same town = direct competitor
                    penalty -= 8;
                }
            }
        }
        return Math.max(-30, penalty);
    }

    // ──────────────────────────────────────────────────────────
    // Disposition: composite score from -100 to +100
    // ──────────────────────────────────────────────────────────
    function getDispositionToPlayer(npc) {
        if (!npc) return { score: 0, tier: 'neutral', factors: [] };
        var p = _getPlayer();
        if (!p) return { score: 0, tier: 'neutral', factors: [] };

        var score = 0;
        var factors = [];

        // Personal relationship (the dominant factor) — scaled from
        // 0..100 down to -25..+50 so very low / very high relationships
        // can shift even a competitor / patron.
        var rel = 0;
        try {
            if (Player.getRelationship) {
                var r = Player.getRelationship(npc.id);
                if (r) rel = r.level || 0;
            }
        } catch(e) {}
        // 50 maps to 0; 100 maps to +50; 0 maps to -25
        var relMod = (rel >= 50) ? (rel - 50) : ((rel - 50) * 0.5);
        score += relMod;
        factors.push({ source: 'relationship', value: Math.round(relMod) });

        // Completed quests FOR this NPC. We use a simple per-NPC counter
        // tracked on the npc itself (set by recordPlayerQuestCompleted).
        var qDone = (npc._playerQuestsDone || 0);
        if (qDone > 0) {
            var qBonus = Math.min(40, qDone * 12);
            score += qBonus;
            factors.push({ source: 'quests_completed', value: qBonus });
        }

        // Notability — well-known players get a small boost from most
        // NPCs (they want association) but with ambitious / cold NPCs
        // notability past 60 can register as a threat.
        var notab = getPlayerNotability();
        var pers = npc.personality || {};
        var ambitionScore = (pers.ambition || 50);
        var warmthScore = (pers.warmth || 50);
        if (notab >= 60 && ambitionScore >= 65) {
            // Famous + ambitious NPC sees you as competition
            var threat = -Math.min(10, (notab - 50) * 0.2);
            score += threat;
            factors.push({ source: 'notability_threat', value: Math.round(threat) });
        } else {
            var prestige = Math.min(8, notab * 0.08);
            score += prestige;
            factors.push({ source: 'notability_prestige', value: Math.round(prestige) });
        }

        // Personality flavor
        if (warmthScore >= 65) {
            score += 3;
            factors.push({ source: 'warm_personality', value: 3 });
        } else if (warmthScore <= 35) {
            score -= 3;
            factors.push({ source: 'cold_personality', value: -3 });
        }

        // Notoriety — even friendly NPCs become wary of an infamous player
        var notoriety = (p.notoriety || 0);
        if (notoriety >= 40) {
            var notMod = -Math.min(20, (notoriety - 20) * 0.4);
            score += notMod;
            factors.push({ source: 'player_notoriety', value: Math.round(notMod) });
        }

        // Kingdom reputation — boosts disposition with NPCs in that kingdom
        try {
            var kId = npc.kingdomId;
            if (!kId && npc.townId) {
                var t = (Engine.findTown ? Engine.findTown(npc.townId) : null);
                if (t) kId = t.kingdomId;
            }
            if (kId && p.reputation && p.reputation[kId] != null) {
                var repHere = p.reputation[kId];
                var repMod = (repHere - 50) * 0.15; // up to ±7.5
                score += repMod;
                if (Math.abs(repMod) >= 1) factors.push({ source: 'kingdom_reputation', value: Math.round(repMod) });
            }
        } catch(e) {}

        // Competing business — only matters when relationship isn't great
        if (rel < 60) {
            var compPen = _competingBusinessPenalty(npc);
            if (compPen !== 0) {
                score += compPen;
                factors.push({ source: 'competing_business', value: compPen });
            }
        }

        // Player owes this NPC money? -5
        try {
            if (p.debts && Array.isArray(p.debts)) {
                for (var di = 0; di < p.debts.length; di++) {
                    if (p.debts[di] && p.debts[di].lenderId === npc.id) {
                        score -= 5;
                        factors.push({ source: 'unpaid_debt', value: -5 });
                        break;
                    }
                }
            }
        } catch(e) {}

        // Recorded relationship-affecting events from the memory log
        // (e.g., a documented scheme against this NPC is a big negative).
        try {
            var mems = npc._playerMemories || [];
            for (var mi = 0; mi < mems.length; mi++) {
                var m = mems[mi];
                if (m && m.kind === 'scheme_against') {
                    score -= 25;
                    factors.push({ source: 'scheme_against_them', value: -25 });
                    break;
                }
            }
        } catch(e) {}

        score = _clamp(Math.round(score), -100, 100);
        var tier;
        if (score >= 60) tier = 'ally';
        else if (score >= 25) tier = 'friendly';
        else if (score >= -10) tier = 'neutral';
        else if (score >= -40) tier = 'wary';
        else if (score >= -70) tier = 'rival';
        else tier = 'hostile';

        return { score: score, tier: tier, factors: factors };
    }

    function isPlayerAlly(npc) {
        var d = getDispositionToPlayer(npc);
        return d.tier === 'ally' || d.tier === 'friendly';
    }
    function isPlayerRival(npc) {
        var d = getDispositionToPlayer(npc);
        return d.tier === 'rival' || d.tier === 'hostile';
    }

    // ──────────────────────────────────────────────────────────
    // Trackers used by quest/scheme systems to set context
    // ──────────────────────────────────────────────────────────
    function recordPlayerQuestCompleted(npc) {
        if (!npc) return;
        npc._playerQuestsDone = (npc._playerQuestsDone || 0) + 1;
    }
    function recordPlayerSchemeAgainst(npc, schemeName) {
        if (!npc) return;
        if (!npc._playerMemories) npc._playerMemories = [];
        npc._playerMemories.push({
            kind: 'scheme_against',
            day: _getDay(),
            summary: schemeName || 'scheme',
            sentiment: 'negative'
        });
        while (npc._playerMemories.length > 16) npc._playerMemories.shift();
    }

    Engine.getPlayerNotability = getPlayerNotability;
    Engine.getDispositionToPlayer = getDispositionToPlayer;
    Engine.isPlayerAlly = isPlayerAlly;
    Engine.isPlayerRival = isPlayerRival;
    Engine.recordPlayerQuestCompleted = recordPlayerQuestCompleted;
    Engine.recordPlayerSchemeAgainst = recordPlayerSchemeAgainst;
})();
