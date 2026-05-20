// ──────────────────────────────────────────────────────────
// player_unsolicited_favors.js — NPC unsolicited favors
// v9p33river360
//
// NPCs with 80+ relationship or lovers (60+ rel, dating
// history) have a 2% chance per day of doing the player
// a favor while in the same location. 7-day global cooldown
// between any two favors. Favor types depend on NPC role,
// personality, and status.
//
// Exports:
//   Player.tickUnsolicitedFavors()
//   Player.getLastFavorInfo() → obj|null
// ──────────────────────────────────────────────────────────
(function(Player) {
    'use strict';
    if (!Player) return;

    var player;
    function _ensureState() { player = Player.state; }
    function _getDay() { try { return Engine.getDay(); } catch(e) { return 0; } }
    function _getWorld() { try { return Engine.getWorld(); } catch(e) { return null; } }
    function _findPerson(id) { try { return Engine.findPerson(id); } catch(e) { return null; } }
    function _findTown(id) { try { return Engine.findTown(id); } catch(e) { return null; } }
    function _findKingdom(id) { try { return Engine.getKingdom(id); } catch(e) { return null; } }
    function _logEvent(msg, d, c) { try { Engine.logEvent(msg, d, c); } catch(e) {} }
    function _toast(msg, type) { if (typeof UI !== 'undefined' && UI.toast) UI.toast(msg, type); }

    // ── Constants ──────────────────────────────────────────
    var FAVOR_CHANCE = 0.02;
    var FAVOR_COOLDOWN_DAYS = 7;
    var REL_THRESHOLD = 80;
    var LOVER_REL_THRESHOLD = 60;
    var LOVER_DATE_THRESHOLD = 50;

    // ── Favor templates ───────────────────────────────────
    // role: 'any' | 'elite_merchant' | 'noble' | 'king' | 'family'
    // condition: optional function(npc, player) → bool
    var FAVOR_TEMPLATES = [
        // === Any NPC ===
        { id: 'gold_gift_small', role: 'any', text: '{name} handed you a small pouch. "Take this. You have been good to me."', goldMin: 10, goldMax: 40, relBoost: 2 },
        { id: 'gold_gift_medium', role: 'any', text: '{name} pressed coins into your hand. "I want you to have this. You deserve it."', goldMin: 30, goldMax: 80, relBoost: 3, minRel: 85 },
        { id: 'food_gift', role: 'any', text: '{name} brought you a basket of food. "You look like you could use a good meal."', giveGood: 'bread', goodQty: [5, 15], relBoost: 2 },
        { id: 'medicine_gift', role: 'any', text: '{name} handed you some herbs. "These will help if you ever fall ill."', giveGood: 'herbs', goodQty: [3, 8], relBoost: 2 },
        { id: 'tool_gift', role: 'any', text: '{name} gave you a set of tools. "I had extras. Put them to good use."', giveGood: 'tools', goodQty: [2, 5], relBoost: 2 },
        { id: 'moral_support', role: 'any', text: '{name} spoke highly of you to others in {town}. Your reputation has improved.', repBoost: 3, relBoost: 1 },
        { id: 'market_tip', role: 'any', text: '{name} pulled you aside. "Buy {good} now. The price is about to rise. Trust me."', relBoost: 2 },
        { id: 'shelter_offer', role: 'any', text: '{name} offered you lodging. "Stay at my place as long as you need. No charge."', relBoost: 3 },
        { id: 'rumor_share', role: 'any', text: '{name} whispered some useful gossip about local affairs in {town}.', relBoost: 2 },
        { id: 'escort_help', role: 'any', text: '{name} arranged for someone to accompany you on your next journey. "The roads are dangerous."', relBoost: 2 },

        // === Elite Merchant ===
        { id: 'em_trade_goods', role: 'elite_merchant', text: '{name} delivered a crate of goods to you. "Consider it a gift between business partners."', giveGood: 'random_trade', goodQty: [8, 20], relBoost: 3 },
        { id: 'em_business_intro', role: 'elite_merchant', text: '{name} introduced you to another merchant. "This one can be trusted. Tell them I sent you."', relBoost: 4, introEffect: true },
        { id: 'em_discount', role: 'elite_merchant', text: '{name} offered a special deal. "For you, I will give a discount at my shop for a while."', relBoost: 3 },
        { id: 'em_investment_tip', role: 'elite_merchant', text: '{name} shared trade route information. "{good} is scarce in the north. Big profits to be made."', relBoost: 3 },
        { id: 'em_loan_offer', role: 'elite_merchant', text: '{name} offered gold with no strings attached. "Pay me back whenever you can."', goldMin: 50, goldMax: 150, relBoost: 4 },
        { id: 'em_warehouse_space', role: 'elite_merchant', text: '{name} offered free storage. "Use my warehouse — I have more room than I need."', relBoost: 3 },
        { id: 'em_caravan_guard', role: 'elite_merchant', text: '{name} sent guards to protect your caravan. "Can not have my friend losing goods on the road."', relBoost: 3 },
        { id: 'em_bulk_deal', role: 'elite_merchant', text: '{name} sold you premium goods at cost. "Between friends, profit does not matter."', goldMin: 20, goldMax: 60, relBoost: 3 },

        // === Noble ===
        { id: 'nb_reputation_boost', role: 'noble', text: '{name} spoke of you at court. "I vouched for your character before the other nobles."', repBoost: 5, relBoost: 3 },
        { id: 'nb_court_intro', role: 'noble', text: '{name} introduced you to influential figures at court. "You should know the right people."', relBoost: 5, introEffect: true },
        { id: 'nb_legal_protection', role: 'noble', text: '{name} used their influence to shield you. "If anyone accuses you of a minor offense, I will handle it."', relBoost: 4 },
        { id: 'nb_recommendation', role: 'noble', text: '{name} wrote a letter of recommendation. "Show this to any noble. They will treat you with respect."', repBoost: 4, relBoost: 4 },
        { id: 'nb_gold_gift', role: 'noble', text: '{name} sent a servant with a purse of gold. "A token of my esteem for a valued friend."', goldMin: 80, goldMax: 250, relBoost: 3 },
        { id: 'nb_prison_release', role: 'noble', text: '{name} used their authority to have you released. "Consider this a personal favor."', jailRelease: true, relBoost: 5,
          condition: function(npc, pl) { return pl.jailedUntilDay && pl.jailedUntilDay > (_getDay()); } },
        { id: 'nb_tax_relief', role: 'noble', text: '{name} arranged a tax reduction for you. "I convinced the treasurer to lighten your burden."', goldMin: 40, goldMax: 100, relBoost: 3 },
        { id: 'nb_political_favor', role: 'noble', text: '{name} used political capital on your behalf. "I called in some favors. You owe me a good deed in return."', repBoost: 6, relBoost: 4 },

        // === King ===
        { id: 'king_pardon', role: 'king', text: '{name} issued a royal pardon. "Your past transgressions are forgiven by royal decree."', clearCriminal: true, relBoost: 5,
          condition: function(npc, pl) { return pl.criminalRecord && Object.keys(pl.criminalRecord).length > 0; } },
        { id: 'king_treasury_gift', role: 'king', text: '{name} sent gold from the royal treasury. "A reward for your service to the crown."', goldMin: 200, goldMax: 500, relBoost: 4 },
        { id: 'king_title_boost', role: 'king', text: '{name} elevated your standing at court. "You have earned greater recognition in {kingdom}."', repBoost: 10, relBoost: 5 },
        { id: 'king_decree', role: 'king', text: '{name} mentioned you favorably in a royal decree. Your name is known throughout {kingdom}.', repBoost: 8, relBoost: 4 }
    ];

    // ── State init ─────────────────────────────────────────
    function _initState() {
        if (player._lastUnsolicitedFavorDay === undefined) player._lastUnsolicitedFavorDay = 0;
        if (player._favorHistory === undefined) player._favorHistory = [];
        if (player._lastFavorInfo === undefined) player._lastFavorInfo = null;
    }

    // ── Helpers ────────────────────────────────────────────
    function _isLover(personId) {
        var rel = player.relationships && player.relationships[personId];
        if (!rel || (rel.level || 0) < LOVER_REL_THRESHOLD) return false;
        var dp = player.dateProgress && player.dateProgress[personId];
        if (!dp) return false;
        return ((dp.traitProgress || 0) + (dp.quirkProgress || 0)) >= LOVER_DATE_THRESHOLD;
    }

    function _getRelLevel(personId) {
        var rel = player.relationships && player.relationships[personId];
        return rel ? (rel.level || 0) : 0;
    }

    function _getNPCRole(person) {
        if (person.isKing) return 'king';
        if (person.isNoble || person.occupation === 'noble') return 'noble';
        if (person.isEliteMerchant) return 'elite_merchant';
        return 'any';
    }

    function _getEligibleFavors(person, role) {
        var eligible = [];
        for (var i = 0; i < FAVOR_TEMPLATES.length; i++) {
            var ft = FAVOR_TEMPLATES[i];
            if (ft.role !== 'any' && ft.role !== role) continue;
            if (ft.minRel && _getRelLevel(person.id) < ft.minRel) continue;
            if (ft.condition && !ft.condition(person, player)) continue;
            eligible.push(ft);
        }
        return eligible;
    }

    function _fillFavorText(text, person) {
        var name = person.firstName || 'Someone';
        var town = '';
        try { var t = _findTown(person.townId); if (t) town = t.name; } catch(e) {}
        town = town || 'the town';
        var kingdom = '';
        try {
            var t2 = _findTown(person.townId);
            if (t2 && t2.kingdomId) { var k = _findKingdom(t2.kingdomId); if (k) kingdom = k.name; }
        } catch(e) {}
        kingdom = kingdom || 'the realm';
        var goodName = 'goods';
        try {
            if (typeof RESOURCE_TYPES !== 'undefined') {
                var rtArr = Object.values(RESOURCE_TYPES);
                if (rtArr.length > 0) {
                    var ri = Math.floor(Math.random() * rtArr.length);
                    goodName = rtArr[ri].name || 'goods';
                }
            }
        } catch(e) {}
        return text.replace(/\{name\}/g, name)
                   .replace(/\{town\}/g, town)
                   .replace(/\{kingdom\}/g, kingdom)
                   .replace(/\{good\}/g, goodName);
    }

    function _applyFavorEffects(favor, person) {
        var day = _getDay();
        var effects = [];

        // Gold gift
        if (favor.goldMin != null) {
            var gold = favor.goldMin + Math.floor(Math.random() * ((favor.goldMax || favor.goldMin) - favor.goldMin + 1));
            try { Player.modifyGold(gold); } catch(e) { player.gold = (player.gold || 0) + gold; }
            effects.push('+' + gold + 'g');
        }

        // Give goods
        if (favor.giveGood) {
            var goodId = favor.giveGood;
            if (goodId === 'random_trade') {
                try {
                    if (typeof RESOURCE_TYPES !== 'undefined') {
                        var rtArr2 = Object.values(RESOURCE_TYPES);
                        if (rtArr2.length > 0) {
                            var tradeGoods = rtArr2.filter(function(r) { return r.category === 'luxury'; });
                            if (tradeGoods.length > 0) goodId = tradeGoods[Math.floor(Math.random() * tradeGoods.length)].id;
                            else goodId = rtArr2[Math.floor(Math.random() * rtArr2.length)].id;
                        }
                    }
                } catch(e) {}
            }
            if (goodId && goodId !== 'random_trade') {
                var qty = 5;
                if (favor.goodQty) qty = favor.goodQty[0] + Math.floor(Math.random() * (favor.goodQty[1] - favor.goodQty[0] + 1));
                if (!player.inventory) player.inventory = {};
                player.inventory[goodId] = (player.inventory[goodId] || 0) + qty;
                var gName = goodId;
                try {
                    if (typeof RESOURCE_TYPES !== 'undefined') {
                        var rtArr3 = Object.values(RESOURCE_TYPES);
                        var rt = rtArr3.find ? rtArr3.find(function(r) { return r.id === goodId; }) : null;
                        if (rt) gName = rt.name;
                    }
                } catch(e) {}
                effects.push('+' + qty + ' ' + gName);
            }
        }

        // Reputation boost
        if (favor.repBoost) {
            try {
                var t = _findTown(person.townId || player.townId);
                if (t && t.kingdomId) {
                    Player.modifyReputation(t.kingdomId, favor.repBoost);
                    var kd = _findKingdom(t.kingdomId);
                    effects.push('+' + favor.repBoost + ' reputation in ' + (kd ? kd.name : 'the kingdom'));
                }
            } catch(e) {}
        }

        // Relationship boost
        if (favor.relBoost) {
            try { Player.modifyRelationship(person.id, favor.relBoost); } catch(e) {}
        }

        // Jail release
        if (favor.jailRelease && player.jailedUntilDay) {
            player.jailedUntilDay = 0;
            effects.push('Released from jail!');
        }

        // Clear criminal record
        if (favor.clearCriminal && player.criminalRecord) {
            player.criminalRecord = {};
            effects.push('Criminal record cleared!');
        }

        // Introduction effect
        if (favor.introEffect && person.townId) {
            var w = _getWorld();
            if (w && w.people) {
                var introCount = 0;
                for (var pi = 0; pi < w.people.length && introCount < 3; pi++) {
                    var p = w.people[pi];
                    if (!p || !p.alive || p.id === person.id || p.id === 'player') continue;
                    if (p.townId !== person.townId) continue;
                    var isImportant = p.isEliteMerchant || p.isNoble || p.occupation === 'noble';
                    if (!isImportant) continue;
                    var existingRel = _getRelLevel(p.id);
                    if (existingRel < 20) {
                        try { Player.modifyRelationship(p.id, 10); } catch(e) {}
                        introCount++;
                    }
                }
                if (introCount > 0) effects.push('Introduced to ' + introCount + ' notable people');
            }
        }

        return effects;
    }

    // ── Daily tick ─────────────────────────────────────────
    function tickUnsolicitedFavors() {
        _ensureState();
        _initState();

        var day = _getDay();
        // Global cooldown
        if (player._lastUnsolicitedFavorDay && (day - player._lastUnsolicitedFavorDay) < FAVOR_COOLDOWN_DAYS) return;
        if (!player.townId || player.traveling) return;
        if (!player.alive) return;

        var w = _getWorld();
        if (!w || !w.people) return;

        // Collect eligible NPCs in the same town
        var candidates = [];
        for (var i = 0; i < w.people.length; i++) {
            var p = w.people[i];
            if (!p || !p.alive || p.id === 'player') continue;
            if (p.townId !== player.townId) continue;
            var relLvl = _getRelLevel(p.id);
            var isLov = _isLover(p.id);
            if (relLvl >= REL_THRESHOLD || isLov) {
                candidates.push(p);
            }
        }
        if (!candidates.length) return;

        // Each eligible NPC has a 2% chance
        for (var ci = 0; ci < candidates.length; ci++) {
            if (Math.random() >= FAVOR_CHANCE) continue;

            var npc = candidates[ci];
            var role = _getNPCRole(npc);
            var eligible = _getEligibleFavors(npc, role);
            if (!eligible.length) continue;

            var favor = eligible[Math.floor(Math.random() * eligible.length)];
            var text = _fillFavorText(favor.text, npc);
            var effects = _applyFavorEffects(favor, npc);

            player._lastUnsolicitedFavorDay = day;
            player._favorHistory.push({
                npcId: npc.id,
                npcName: ((npc.firstName || '') + ' ' + (npc.lastName || '')).trim(),
                favorId: favor.id,
                day: day,
                effects: effects
            });

            // Keep history manageable
            if (player._favorHistory.length > 50) {
                player._favorHistory = player._favorHistory.slice(-30);
            }

            player._lastFavorInfo = {
                npcId: npc.id,
                npcName: ((npc.firstName || '') + ' ' + (npc.lastName || '')).trim(),
                text: text,
                effects: effects,
                day: day
            };

            _logEvent('🎁 ' + (npc.firstName || 'Someone') + ' did you a favor: ' + (effects.join(', ') || 'a kind gesture'), null, 'my_actions');
            _toast('🎁 ' + (npc.firstName || 'Someone') + ' did you a favor!', 'success');

            // Show popup if UI is available
            if (typeof UI !== 'undefined' && UI.openFavorPopup) {
                try { UI.openFavorPopup(player._lastFavorInfo); } catch(e) {}
            }

            // Only one favor per tick
            return;
        }
    }

    function getLastFavorInfo() {
        _ensureState();
        _initState();
        return player._lastFavorInfo;
    }

    // ── Exports ────────────────────────────────────────────
    Player.tickUnsolicitedFavors = tickUnsolicitedFavors;
    Player.getLastFavorInfo = getLastFavorInfo;

})(window.Player);
