// ============================================================
// Merchant Realms — Unsolicited Quests Module
// v9p33river357: Elite merchants and nobles may reach out to
// the player with quests. Triggered by daily presence (~1% per
// eligible NPC in town) or town entry (~2.5%), modulated by
// relationship. At most one offer per day; cannot offer while
// an unresolved offer is pending. Quest button also appears on
// the NPC detail pane.
//
// Public API (on Player):
//   Player.tryGenerateDailyUnsolicitedOffer()         // called per day from engine.tick
//   Player.tryGenerateEntryUnsolicitedOffer(townId)   // called on travel arrival
//   Player.getPendingUnsolicitedOffer()
//   Player.acceptUnsolicitedOffer()
//   Player.declineUnsolicitedOffer()
//   Player.getActiveUnsolicitedQuests()
//   Player.tickActiveUnsolicitedQuests()              // called daily, expires/fails
//   Player.attemptCompleteUnsolicitedQuest(questId)
//   Player.unsolicitedOfferForNpc(npcId)              // for detail-pane button
//   Player.generateQuestFromNpc(personId)             // manual request from detail pane
// ============================================================
(function(Player) {
    "use strict";
    if (!Player) throw new Error('Player must be loaded before player_unsolicited_quests.js');

    var player;
    function _sync() { player = Player.state; }

    function _getDay() { try { return Engine.getDay ? Engine.getDay() : 0; } catch(e) { return 0; } }
    function _rng() { try { return Engine.getRng ? Engine.getRng() : null; } catch(e) { return null; } }
    function _findTown(id) { try { return Engine.findTown ? Engine.findTown(id) : null; } catch(e) { return null; } }
    function _findPerson(id) { try { return Engine.findPerson ? Engine.findPerson(id) : null; } catch(e) { return null; } }
    function _findKingdom(id) { try { return Engine.findKingdom ? Engine.findKingdom(id) : null; } catch(e) { return null; } }
    function _getWorld() { try { return Engine.getWorld ? Engine.getWorld() : null; } catch(e) { return null; } }
    function _logEvent(msg, data, cat) { try { Engine.logEvent && Engine.logEvent(msg, data || null, cat || 'my_actions'); } catch(e) {} }
    function _toast(msg, type) { try { if (typeof UI !== 'undefined' && UI.toast) UI.toast(msg, type || 'info'); } catch(e) {} }

    // ── Constants ──
    var BASE_DAILY_CHANCE = 0.01;
    var BASE_ENTRY_CHANCE = 0.025;
    var NPC_COOLDOWN_DAYS = 60;
    var MAX_ACTIVE = 6;

    function _ensureState() {
        _sync();
        if (player._pendingUnsolicitedOffer === undefined) player._pendingUnsolicitedOffer = null;
        if (!player._activeUnsolicitedQuests) player._activeUnsolicitedQuests = [];
        if (!player._unsolicitedNpcCooldowns) player._unsolicitedNpcCooldowns = {};
        if (player._lastUnsolicitedOfferDay == null) player._lastUnsolicitedOfferDay = 0;
        if (!player._nextUnsolicitedQuestId) player._nextUnsolicitedQuestId = 1;
    }

    // ── NPC eligibility ──
    function _isEliteMerchant(p) { return !!p && p.alive !== false && !!p.isEliteMerchant; }
    function _isNoble(p) {
        if (!p || p.alive === false || !p.socialRank) return false;
        for (var k in p.socialRank) {
            var r = p.socialRank[k] || 0;
            if (r >= 4 && r <= 6) return true;
        }
        return false;
    }
    function _npcKingdomId(p) {
        if (!p) return null;
        if (p.kingdomId) return p.kingdomId;
        if (p.townId) {
            var t = _findTown(p.townId);
            if (t) return t.kingdomId;
        }
        return null;
    }
    function _playerIsNobleIn(kId) {
        if (!kId) return false;
        return ((player.socialRank && player.socialRank[kId]) || 0) >= 4;
    }
    function _playerIsCitizenOf(kId) {
        if (!kId) return false;
        return ((player.socialRank && player.socialRank[kId]) || 0) >= 1;
    }
    function _canTalkToNpc(npcId) {
        try {
            var r = Player.canTalkTo ? Player.canTalkTo(npcId) : { canTalk: true };
            return !!(r && r.canTalk);
        } catch (e) { return false; }
    }
    function _relLevel(npcId) {
        try {
            var r = Player.getRelationship ? Player.getRelationship(npcId) : null;
            return r ? (r.level || 0) : 0;
        } catch (e) { return 0; }
    }

    // ── Resources & helpers ──
    var DELIVERY_GOODS = ['bread','meat','fish','wine','ale','cloth','silk','iron','tools','leather','planks','bricks','stone','honey','salt','eggs','vegetables'];
    var MILITARY_GOODS = ['swords','bows','arrows','armor','bandages'];
    var LUXURY_GOODS = ['wine','silk','jewelry'];

    function _basePrice(resId) {
        try {
            if (typeof RESOURCE_TYPES !== 'undefined') {
                // RESOURCE_TYPES is keyed by UPPERCASE, look up by lowercase id
                var rt = Object.values(RESOURCE_TYPES);
                for (var i = 0; i < rt.length; i++) {
                    if (rt[i].id === resId) return rt[i].basePrice || 5;
                }
            }
        } catch (e) {}
        return 5;
    }
    function _resName(resId) {
        try {
            if (typeof RESOURCE_TYPES !== 'undefined') {
                var rt = Object.values(RESOURCE_TYPES);
                for (var i = 0; i < rt.length; i++) {
                    if (rt[i].id === resId) return rt[i].name || resId;
                }
            }
        } catch (e) {}
        return resId;
    }
    function _pick(rng, arr) { return arr[rng.randInt(0, arr.length - 1)]; }

    function _allRealTowns() {
        var w = _getWorld(); if (!w) return [];
        return w.towns.filter(function(t) { return !t.isWilderness && !t.isOutpost; });
    }
    function _townsInKingdom(kId) {
        var w = _getWorld(); if (!w) return [];
        return w.towns.filter(function(t) { return t.kingdomId === kId && !t.isWilderness && !t.isOutpost; });
    }
    function _countPlayerGoods(resId, townId) {
        var inv = (player.inventory && player.inventory[resId]) || 0;
        var stor = 0;
        if (townId && player.townStorage && player.townStorage[townId]) {
            stor = player.townStorage[townId][resId] || 0;
        }
        return inv + stor;
    }
    function _consumePlayerGoods(resId, qty, townId) {
        var remaining = qty;
        if (townId && player.townStorage && player.townStorage[townId]) {
            var stor = player.townStorage[townId];
            var s = stor[resId] || 0;
            if (s > 0) {
                var take = Math.min(s, remaining);
                stor[resId] = s - take;
                if (stor[resId] <= 0) delete stor[resId];
                remaining -= take;
            }
        }
        if (remaining > 0 && player.inventory) {
            var iv = player.inventory[resId] || 0;
            player.inventory[resId] = Math.max(0, iv - remaining);
            if (player.inventory[resId] <= 0) delete player.inventory[resId];
        }
    }

    function _findOtherNobleInKingdom(kId, excludeId, rng) {
        var w = _getWorld(); if (!w) return null;
        var c = w.people.filter(function(p) {
            if (!p || p.id === excludeId || p.alive === false || !p.socialRank) return false;
            var r = p.socialRank[kId] || 0;
            return r >= 4 && r <= 5;
        });
        if (!c.length) return null;
        return c[rng.randInt(0, c.length - 1)];
    }
    function _adultUnmarriedChildOf(npc, rng, preferredSex) {
        if (!npc || !npc.childrenIds) return null;
        var cands = [];
        for (var i = 0; i < npc.childrenIds.length; i++) {
            var c = _findPerson(npc.childrenIds[i]);
            if (!c || c.alive === false) continue;
            if ((c.age || 0) < 16) continue;
            if (c.spouseId) continue;
            if (preferredSex && c.sex !== preferredSex) continue;
            cands.push(c);
        }
        if (!cands.length) return null;
        return cands[rng.randInt(0, cands.length - 1)];
    }

    // ── Quest Type Definitions ─────────────────────────────────
    // Each def: { id, audience, forPlayerRank, weight, rare?
    //   generate(npc, rng, ctx) -> { params, dialog, objectives, timeLimitDays, rewards } | null,
    //   check(quest)            -> { ok, reason },
    //   consume(quest),
    //   onSchemeEvent?(quest, eventId, data) -> {advance,msg} | null,
    //   onArrival?(quest, townId) -> {advance,msg} | null
    // }
    var QUEST_DEFS = {};
    function _def(d) { QUEST_DEFS[d.id] = d; }

    function _foodSubset(rng) { return _pick(rng, DELIVERY_GOODS); }

    // ── EM QUESTS ──
    _def({ id: 'em_deliver_goods', audience: 'merchant', forPlayerRank: 'any', weight: 14,
        generate: function(npc, rng) {
            var npcTown = _findTown(npc.townId); if (!npcTown) return null;
            var resId = _foodSubset(rng); var qty = rng.randInt(10, 40);
            return {
                params: { townId: npc.townId, townName: npcTown.name, resourceId: resId, resourceName: _resName(resId), quantity: qty },
                dialog: 'I have buyers in ' + npcTown.name + ' waiting and my own stock is bare. Bring me ' + qty + ' ' + _resName(resId) + ' here and I will pay well.',
                objectives: ['Bring ' + qty + ' ' + _resName(resId) + ' to ' + npcTown.name + ' and open my detail pane to deliver'],
                timeLimitDays: rng.randInt(20, 35),
                rewards: { gold: Math.max(150, Math.floor(qty * _basePrice(resId) * 1.35)), rel: rng.randInt(12, 22) }
            };
        },
        check: function(q) {
            if (player.townId !== q.params.townId) return { ok: false, reason: 'You must be in ' + q.params.townName + ' to deliver.' };
            var have = _countPlayerGoods(q.params.resourceId, q.params.townId);
            if (have < q.params.quantity) return { ok: false, reason: 'Need ' + q.params.quantity + ' ' + q.params.resourceName + ' (you have ' + have + ').' };
            return { ok: true };
        },
        consume: function(q) {
            _consumePlayerGoods(q.params.resourceId, q.params.quantity, q.params.townId);
            // v9p33river364: boost NPC business — delivered goods enter town supply
            var t = _findTown(q.params.townId);
            if (t && t.market && t.market.supply) {
                t.market.supply[q.params.resourceId] = (t.market.supply[q.params.resourceId] || 0) + Math.floor(q.params.quantity * 0.5);
            }
        }
    });

    _def({ id: 'em_deliver_to_partner', audience: 'merchant', forPlayerRank: 'any', weight: 9,
        generate: function(npc, rng) {
            var npcTown = _findTown(npc.townId); if (!npcTown) return null;
            var towns = _allRealTowns().filter(function(t) { return t.id !== npc.townId; });
            if (!towns.length) return null;
            var dest = towns[rng.randInt(0, towns.length - 1)];
            var resId = _foodSubset(rng); var qty = rng.randInt(8, 25);
            return {
                params: { townId: dest.id, townName: dest.name, resourceId: resId, resourceName: _resName(resId), quantity: qty },
                dialog: 'I owe a colleague in ' + dest.name + ' a shipment of ' + qty + ' ' + _resName(resId) + '. Make the run for me, would you?',
                objectives: ['Deliver ' + qty + ' ' + _resName(resId) + ' in ' + dest.name],
                timeLimitDays: rng.randInt(28, 45),
                rewards: { gold: Math.max(200, Math.floor(qty * _basePrice(resId) * 1.5)), rel: rng.randInt(14, 24) }
            };
        },
        check: function(q) {
            if (player.townId !== q.params.townId) return { ok: false, reason: 'You must be in ' + q.params.townName + ' to deliver.' };
            var have = _countPlayerGoods(q.params.resourceId, q.params.townId);
            if (have < q.params.quantity) return { ok: false, reason: 'Need ' + q.params.quantity + ' ' + q.params.resourceName + '.' };
            return { ok: true };
        },
        consume: function(q) {
            _consumePlayerGoods(q.params.resourceId, q.params.quantity, q.params.townId);
            // v9p33river364: delivered goods enter destination town market
            var t = _findTown(q.params.townId);
            if (t && t.market && t.market.supply) {
                t.market.supply[q.params.resourceId] = (t.market.supply[q.params.resourceId] || 0) + Math.floor(q.params.quantity * 0.5);
            }
        }
    });

    _def({ id: 'em_donate_gold', audience: 'merchant', forPlayerRank: 'any', weight: 5,
        generate: function(npc, rng) {
            var amt = rng.randInt(500, 2500);
            return {
                params: { amount: amt },
                dialog: 'I am pulling together a private venture and need silent backers. Contribute ' + amt + ' gold and you will share in the goodwill.',
                objectives: ['Contribute ' + amt + ' gold via my detail pane'],
                timeLimitDays: rng.randInt(14, 28),
                rewards: { gold: Math.floor(amt * 1.35), rel: rng.randInt(10, 18) }
            };
        },
        check: function(q) {
            if ((player.gold || 0) < q.params.amount) return { ok: false, reason: 'You need ' + q.params.amount + 'g (you have ' + Math.floor(player.gold || 0) + 'g).' };
            return { ok: true };
        },
        consume: function(q) {
            player.gold = Math.max(0, (player.gold || 0) - q.params.amount);
            var npc = _findPerson(q.npcId); var t = npc ? _findTown(npc.townId) : null;
            if (t) t.gold = (t.gold || 0) + Math.floor(q.params.amount * 0.3);
        }
    });

    _def({ id: 'em_marry_child',audience: 'merchant', forPlayerRank: 'any', weight: 1, rare: true,
        generate: function(npc, rng) {
            if (player.spouseId) return null;
            var sex = (player.sex === 'M') ? 'F' : 'M';
            var child = _adultUnmarriedChildOf(npc, rng, sex); if (!child) return null;
            return {
                params: { npcId: npc.id, childId: child.id, childName: ((child.firstName||'') + ' ' + (child.lastName||'')).trim() },
                dialog: 'You have impressed me. My ' + (child.sex==='M'?'son ':'daughter ') + (child.firstName||'') + ' is unwed. Court ' + (child.sex==='M'?'him':'her') + ' properly and I will bless the union.',
                objectives: ['Court and marry ' + ((child.firstName||'') + ' ' + (child.lastName||'')).trim()],
                timeLimitDays: rng.randInt(60, 120),
                rewards: { gold: rng.randInt(2000, 4000), rel: rng.randInt(30, 45), unique: { type: 'marriage_blessing', childId: child.id } }
            };
        },
        check: function(q) {
            if (player.spouseId === q.params.childId) return { ok: true };
            return { ok: false, reason: 'Marry ' + q.params.childName + ' first.' };
        },
        consume: function(q) {
            // v9p33river364: marriage blessing improves family standing
            _logEvent('A marriage blessed by the merchant house brings good fortune.', null, 'world_events');
        }
    });

    _def({ id: 'em_build_warehouse', audience: 'merchant', forPlayerRank: 'any', weight: 3,
        generate: function(npc, rng) {
            var t = _findTown(npc.townId); if (!t) return null;
            return {
                params: { townId: npc.townId, townName: t.name, buildingType: 'warehouse' },
                dialog: 'Storage in ' + t.name + ' is at a premium. Build a warehouse here and I will pay you for the trouble. You keep ownership.',
                objectives: ['Construct a warehouse in ' + t.name + ' (you keep ownership)'],
                timeLimitDays: rng.randInt(40, 70),
                rewards: { gold: rng.randInt(1500, 3000), rel: rng.randInt(18, 28) }
            };
        },
        check: function(q) {
            // Player must own a warehouse in target town
            if (!player.buildings) return { ok: false, reason: 'No buildings.' };
            for (var i = 0; i < player.buildings.length; i++) {
                var b = player.buildings[i];
                if (b && b.townId === q.params.townId && b.type === q.params.buildingType) return { ok: true };
            }
            return { ok: false, reason: 'Build a ' + q.params.buildingType + ' in ' + q.params.townName + ' first.' };
        },
        consume: function(q) {
            // v9p33river364: warehouse benefits town storage capacity
            var t = _findTown(q.params.townId);
            if (t) {
                t.storageCapacity = (t.storageCapacity || 500) + 200;
                _logEvent('A new warehouse in ' + q.params.townName + ' expanded storage capacity.', null, 'world_events');
            }
        }
    });

    // ── NOBLE QUESTS (commoner or noble player) ──
    _def({ id: 'nb_courier_letter', audience: 'noble', forPlayerRank: 'any', weight: 11,
        generate: function(npc, rng) {
            var kId = _npcKingdomId(npc); if (!kId) return null;
            var other = _findOtherNobleInKingdom(kId, npc.id, rng); if (!other) return null;
            var otherTown = _findTown(other.townId); var npcTown = _findTown(npc.townId);
            if (!otherTown || !npcTown || otherTown.id === npcTown.id) return null;
            var purposes = ['alliance', 'trade_deal', 'warning', 'invitation', 'petition'];
            var purpose = purposes[rng.randInt(0, purposes.length - 1)];
            var purposeText = { alliance: 'a diplomatic alliance proposal', trade_deal: 'a trade agreement', warning: 'an urgent warning', invitation: 'an invitation to a banquet', petition: 'a petition for the king' };
            return {
                params: { targetTownId: otherTown.id, targetTownName: otherTown.name, targetNobleId: other.id, targetNobleName: ((other.firstName||'') + ' ' + (other.lastName||'')).trim(), purpose: purpose, senderId: npc.id },
                dialog: 'I have a sealed letter for ' + (other.firstName||'a fellow noble') + ' in ' + otherTown.name + '. It concerns ' + (purposeText[purpose] || 'important matters') + '. Deliver it personally.',
                objectives: ['Deliver the letter to ' + ((other.firstName||'') + ' ' + (other.lastName||'')).trim() + ' in ' + otherTown.name],
                timeLimitDays: rng.randInt(20, 35),
                rewards: { gold: rng.randInt(300, 700), rel: rng.randInt(12, 22) }
            };
        },
        check: function(q) {
            if (player.townId !== q.params.targetTownId) return { ok: false, reason: 'Travel to ' + q.params.targetTownName + ' to deliver the letter.' };
            return { ok: true };
        },
        consume: function(q) {
            var purpose = q.params.purpose || 'alliance';
            var sender = _findPerson(q.params.senderId);
            var target = _findPerson(q.params.targetNobleId);
            if (sender && target) {
                if (!target._npcRelationships) target._npcRelationships = {};
                if (!sender._npcRelationships) sender._npcRelationships = {};
                var oldRel = target._npcRelationships[sender.id] || 0;
                if (purpose === 'alliance') {
                    target._npcRelationships[sender.id] = Math.min(100, oldRel + 15);
                    sender._npcRelationships[target.id] = Math.min(100, (sender._npcRelationships[target.id] || 0) + 10);
                    _logEvent('The letter strengthened the alliance between ' + (sender.firstName||'') + ' and ' + (target.firstName||'') + '.', null, 'world_events');
                } else if (purpose === 'trade_deal') {
                    var targetTown = _findTown(q.params.targetTownId);
                    var senderTown = _findTown(sender.townId);
                    if (targetTown && senderTown && targetTown.market && senderTown.market) {
                        targetTown.tradeDealBonus = (targetTown.tradeDealBonus || 0) + 0.05;
                        senderTown.tradeDealBonus = (senderTown.tradeDealBonus || 0) + 0.05;
                    }
                    target._npcRelationships[sender.id] = Math.min(100, oldRel + 10);
                    _logEvent('A trade deal between ' + (senderTown ? senderTown.name : 'towns') + ' and ' + (targetTown ? targetTown.name : 'towns') + ' was established.', null, 'world_events');
                } else if (purpose === 'warning') {
                    target._npcRelationships[sender.id] = Math.min(100, oldRel + 20);
                    var tTown = _findTown(q.params.targetTownId);
                    if (tTown) tTown.security = Math.min(100, (tTown.security || 50) + 10);
                    _logEvent('The warning was heeded — ' + (tTown ? tTown.name : 'the town') + ' increased security.', null, 'world_events');
                } else if (purpose === 'invitation') {
                    target._npcRelationships[sender.id] = Math.min(100, oldRel + 8);
                    try { Player.modifyRelationship(q.params.targetNobleId, 5); } catch(e) {}
                    _logEvent((target.firstName||'The noble') + ' was pleased by the invitation.', null, 'world_events');
                } else if (purpose === 'petition') {
                    target._npcRelationships[sender.id] = Math.min(100, oldRel + 5);
                    try { Player.modifyRelationship(q.params.targetNobleId, 3); } catch(e) {}
                    _logEvent('The petition was delivered. Political matters are in motion.', null, 'world_events');
                }
            }
        }
    });

    _def({ id: 'nb_deliver_luxury', audience: 'noble', forPlayerRank: 'any', weight: 7,
        generate: function(npc, rng) {
            var t = _findTown(npc.townId); if (!t) return null;
            var resId = LUXURY_GOODS[rng.randInt(0, LUXURY_GOODS.length - 1)];
            var qty = rng.randInt(4, 12);
            return {
                params: { townId: npc.townId, townName: t.name, resourceId: resId, resourceName: _resName(resId), quantity: qty },
                dialog: 'I am hosting a banquet and need ' + qty + ' units of ' + _resName(resId) + '. Bring them to ' + t.name + '.',
                objectives: ['Bring ' + qty + ' ' + _resName(resId) + ' to ' + t.name],
                timeLimitDays: rng.randInt(15, 28),
                rewards: { gold: Math.max(400, Math.floor(qty * _basePrice(resId) * 1.8)), rel: rng.randInt(15, 25) }
            };
        },
        check: function(q) {
            if (player.townId !== q.params.townId) return { ok: false, reason: 'Be in ' + q.params.townName + ' to deliver.' };
            var have = _countPlayerGoods(q.params.resourceId, q.params.townId);
            if (have < q.params.quantity) return { ok: false, reason: 'Need ' + q.params.quantity + ' ' + q.params.resourceName + '.' };
            return { ok: true };
        },
        consume: function(q) {
            _consumePlayerGoods(q.params.resourceId, q.params.quantity, q.params.townId);
            // v9p33river364: luxury goods boost noble's banquet — town happiness
            var t = _findTown(q.params.townId);
            if (t) { t.happiness = Math.min(100, (t.happiness || 50) + 3); }
        }
    });

    _def({ id: 'nb_donate_treasury', audience: 'noble', forPlayerRank: 'any', weight: 6,
        generate: function(npc, rng) {
            var amt = rng.randInt(800, 3500);
            return {
                params: { amount: amt },
                dialog: 'I am funding works for the common good but the coffers are thin. Donate ' + amt + ' gold and I will not forget.',
                objectives: ['Contribute ' + amt + ' gold via my detail pane'],
                timeLimitDays: rng.randInt(20, 35),
                rewards: { gold: 0, rel: rng.randInt(20, 32) }
            };
        },
        check: function(q) {
            if ((player.gold || 0) < q.params.amount) return { ok: false, reason: 'Need ' + q.params.amount + 'g (you have ' + Math.floor(player.gold || 0) + 'g).' };
            return { ok: true };
        },
        consume: function(q) {
            player.gold = Math.max(0, (player.gold || 0) - q.params.amount);
            // v9p33river364: donation goes to kingdom treasury
            var npc = _findPerson(q.npcId);
            var kId = npc ? _npcKingdomId(npc) : null;
            if (kId) {
                var kingdom = _findKingdom(kId);
                if (kingdom) kingdom.gold = (kingdom.gold || 0) + q.params.amount;
            }
        }
    });

    _def({ id: 'nb_supply_militia', audience: 'noble', forPlayerRank: 'any', weight: 6,
        generate: function(npc, rng) {
            var t = _findTown(npc.townId); if (!t) return null;
            var resId = MILITARY_GOODS[rng.randInt(0, MILITARY_GOODS.length - 1)];
            var qty = rng.randInt(6, 18);
            return {
                params: { townId: npc.townId, townName: t.name, resourceId: resId, resourceName: _resName(resId), quantity: qty },
                dialog: 'The militia here in ' + t.name + ' lacks proper gear. Bring me ' + qty + ' ' + _resName(resId) + '.',
                objectives: ['Bring ' + qty + ' ' + _resName(resId) + ' to ' + t.name],
                timeLimitDays: rng.randInt(20, 35),
                rewards: { gold: Math.max(350, Math.floor(qty * _basePrice(resId) * 1.5)), rel: rng.randInt(15, 25) }
            };
        },
        check: function(q) {
            if (player.townId !== q.params.townId) return { ok: false, reason: 'Be in ' + q.params.townName + ' to deliver.' };
            var have = _countPlayerGoods(q.params.resourceId, q.params.townId);
            if (have < q.params.quantity) return { ok: false, reason: 'Need ' + q.params.quantity + ' ' + q.params.resourceName + '.' };
            return { ok: true };
        },
        consume: function(q) {
            _consumePlayerGoods(q.params.resourceId, q.params.quantity, q.params.townId);
            // v9p33river364: military goods boost town security
            var t = _findTown(q.params.townId);
            if (t) { t.security = Math.min(100, (t.security || 50) + 8); }
            _logEvent('The militia in ' + q.params.townName + ' has been re-equipped.', null, 'world_events');
        }
    });

    _def({ id: 'nb_build_road', audience: 'noble', forPlayerRank: 'any', weight: 2,
        generate: function(npc, rng) {
            var kId = _npcKingdomId(npc); if (!kId) return null;
            var townsK = _townsInKingdom(kId); if (townsK.length < 2) return null;
            var w = _getWorld(); if (!w) return null;
            // v9p33river357 pass-2: only consider town pairs that DO NOT
            // already have a road, since the engine will refuse to build
            // a duplicate.
            function _existingRoad(aId, bId) {
                if (!w.roads) return false;
                for (var ri = 0; ri < w.roads.length; ri++) {
                    var r = w.roads[ri];
                    if ((r.fromTownId === aId && r.toTownId === bId) ||
                        (r.fromTownId === bId && r.toTownId === aId)) return true;
                }
                return false;
            }
            // Build viable pair list
            var pairs = [];
            for (var i = 0; i < townsK.length; i++) {
                for (var j = i + 1; j < townsK.length; j++) {
                    if (!_existingRoad(townsK[i].id, townsK[j].id)) {
                        pairs.push({ a: townsK[i], b: townsK[j] });
                    }
                }
            }
            if (!pairs.length) return null;
            var pick = pairs[rng.randInt(0, pairs.length - 1)];
            var a = pick.a, b = pick.b;
            return {
                params: { fromTownId: a.id, fromTownName: a.name, toTownId: b.id, toTownName: b.name },
                dialog: 'Trade between ' + a.name + ' and ' + b.name + ' is slow because there is no road. Build one and the kingdom will see the benefit.',
                objectives: ['Build a road between ' + a.name + ' and ' + b.name],
                timeLimitDays: rng.randInt(50, 90),
                rewards: { gold: rng.randInt(1500, 3500), rel: rng.randInt(20, 32) }
            };
        },
        check: function(q) {
            var w = _getWorld(); if (!w || !w.roads) return { ok: false, reason: 'No roads available.' };
            for (var i = 0; i < w.roads.length; i++) {
                var r = w.roads[i];
                var match = (r.fromTownId === q.params.fromTownId && r.toTownId === q.params.toTownId) ||
                            (r.fromTownId === q.params.toTownId && r.toTownId === q.params.fromTownId);
                // v9p33river357 pass-2: also accept r.builtBy === 'player' which is
                // what Engine.buildNewRoad actually stores for player builds.
                if (match && (r.ownerId === 'player' || r.builtByPlayer || r.builtBy === 'player')) return { ok: true };
            }
            return { ok: false, reason: 'Build a road between ' + q.params.fromTownName + ' and ' + q.params.toTownName + '.' };
        },
        consume: function(q) {
            // v9p33river364: road boosts kingdom reputation + trade between towns
            var fromTown = _findTown(q.params.fromTownId);
            var toTown = _findTown(q.params.toTownId);
            if (fromTown) { fromTown.tradeDealBonus = (fromTown.tradeDealBonus || 0) + 0.1; }
            if (toTown) { toTown.tradeDealBonus = (toTown.tradeDealBonus || 0) + 0.1; }
            _logEvent('A new road between ' + q.params.fromTownName + ' and ' + q.params.toTownName + ' strengthens trade routes.', null, 'world_events');
        }
    });

    _def({ id: 'nb_unique_citizenship', audience: 'noble', forPlayerRank: 'any', weight: 1, rare: true,
        generate: function(npc, rng) {
            var kId = _npcKingdomId(npc); if (!kId) return null;
            if (_playerIsCitizenOf(kId)) return null;
            var t = _findTown(npc.townId); if (!t) return null;
            var resId = _foodSubset(rng); var qty = rng.randInt(15, 35);
            return {
                params: { townId: npc.townId, townName: t.name, resourceId: resId, resourceName: _resName(resId), quantity: qty, kingdomId: kId },
                dialog: 'Prove your loyalty: bring ' + qty + ' ' + _resName(resId) + ' to ' + t.name + ' and I will recommend you for citizenship in this kingdom.',
                objectives: ['Deliver ' + qty + ' ' + _resName(resId) + ' to ' + t.name],
                timeLimitDays: rng.randInt(30, 50),
                rewards: { gold: rng.randInt(500, 1200), rel: rng.randInt(20, 30), unique: { type: 'citizenship', kingdomId: kId } }
            };
        },
        check: function(q) {
            if (player.townId !== q.params.townId) return { ok: false, reason: 'Be in ' + q.params.townName + ' to deliver.' };
            var have = _countPlayerGoods(q.params.resourceId, q.params.townId);
            if (have < q.params.quantity) return { ok: false, reason: 'Need ' + q.params.quantity + ' ' + q.params.resourceName + '.' };
            return { ok: true };
        },
        consume: function(q) { _consumePlayerGoods(q.params.resourceId, q.params.quantity, q.params.townId); }
    });

    // ── NOBLE QUESTS (player is also noble) ──
    _def({ id: 'nn_political_marriage', audience: 'noble', forPlayerRank: 'noble', weight: 1, rare: true,
        generate: function(npc, rng) {
            if (player.spouseId) return null;
            var sex = (player.sex === 'M') ? 'F' : 'M';
            var child = _adultUnmarriedChildOf(npc, rng, sex); if (!child) return null;
            return {
                params: { npcId: npc.id, childId: child.id, childName: ((child.firstName||'') + ' ' + (child.lastName||'')).trim() },
                dialog: 'You are of suitable rank. My ' + (child.sex==='M'?'son':'daughter') + ' is unwed. A political marriage between our houses would benefit us both.',
                objectives: ['Court and marry ' + ((child.firstName||'') + ' ' + (child.lastName||'')).trim()],
                timeLimitDays: rng.randInt(60, 120),
                rewards: { gold: rng.randInt(3000, 6000), rel: rng.randInt(35, 50), unique: { type: 'marriage_blessing', childId: child.id } }
            };
        },
        check: function(q) {
            if (player.spouseId === q.params.childId) return { ok: true };
            return { ok: false, reason: 'Marry ' + q.params.childName + ' first.' };
        },
        consume: function(q) {
            // v9p33river364: political marriage forges alliance between houses
            var npc = _findPerson(q.params.npcId);
            if (npc) {
                var kId = _npcKingdomId(npc);
                if (kId) {
                    var kingdom = _findKingdom(kId);
                    if (kingdom && kingdom.king) {
                        try { Player.modifyRelationship(kingdom.king, 10); } catch(e) {}
                    }
                }
            }
            _logEvent('A political marriage strengthens the alliance between noble houses.', null, 'world_events');
        }
    });

    // ── Generation ──
    function _pickQuestForNpc(npc, rng) {
        var audience = _isEliteMerchant(npc) ? 'merchant' : (_isNoble(npc) ? 'noble' : null);
        if (!audience) return null;
        var kId = _npcKingdomId(npc);
        var playerIsNobleHere = _playerIsNobleIn(kId);
        // Filter quests by audience + player-rank requirement
        var candidates = [];
        for (var id in QUEST_DEFS) {
            var d = QUEST_DEFS[id];
            if (d.audience !== audience) continue;
            if (d.forPlayerRank === 'noble' && !playerIsNobleHere) continue;
            // Weight; rare quests apply weight cap
            candidates.push(d);
        }
        if (!candidates.length) return null;
        // Try up to 6 attempts to generate (some defs return null for invalid params)
        for (var attempt = 0; attempt < 6; attempt++) {
            // Weighted random pick
            var totalW = 0;
            for (var ci = 0; ci < candidates.length; ci++) totalW += (candidates[ci].weight || 1);
            var roll = rng.random() * totalW;
            var acc = 0;
            var picked = null;
            for (var pi = 0; pi < candidates.length; pi++) {
                acc += (candidates[pi].weight || 1);
                if (roll < acc) { picked = candidates[pi]; break; }
            }
            if (!picked) continue;
            try {
                var data = picked.generate(npc, rng);
                if (data) {
                    return { def: picked, data: data };
                }
            } catch (e) { /* try again */ }
        }
        return null;
    }

    function _generateOfferFromNpc(npc) {
        var rng = _rng(); if (!rng) return false;
        var generated = _pickQuestForNpc(npc, rng);
        if (!generated) return false;
        var def = generated.def;
        var data = generated.data;
        var day = _getDay();
        var offer = {
            npcId: npc.id,
            npcName: ((npc.firstName || '') + ' ' + (npc.lastName || '')).trim(),
            defId: def.id,
            params: data.params,
            dialog: data.dialog,
            objectives: data.objectives || [],
            timeLimitDays: data.timeLimitDays || 30,
            rewards: data.rewards || { gold: 0, rel: 0 },
            generatedDay: day,
            expiresDay: day + 7
        };
        player._pendingUnsolicitedOffer = offer;
        player._lastUnsolicitedOfferDay = day;
        // Show the popup
        try {
            if (typeof UI !== 'undefined' && UI.openUnsolicitedQuestOffer) {
                UI.openUnsolicitedQuestOffer(offer);
            }
        } catch (e) {}
        _logEvent('📜 ' + offer.npcName + ' has approached you with a quest.', null, 'my_actions');
        return true;
    }

    // ── Daily / Entry rolls ──
    function _candidateNpcsInTown(townId) {
        if (!townId) return [];
        var w = _getWorld(); if (!w) return [];
        var day = _getDay();
        var out = [];
        for (var i = 0; i < w.people.length; i++) {
            var p = w.people[i];
            if (!p || p.alive === false || p.townId !== townId) continue;
            if (!(_isEliteMerchant(p) || _isNoble(p))) continue;
            if (!_canTalkToNpc(p.id)) continue;
            var cd = (player._unsolicitedNpcCooldowns && player._unsolicitedNpcCooldowns[p.id]) || 0;
            if (cd && day - cd < NPC_COOLDOWN_DAYS) continue;
            out.push(p);
        }
        return out;
    }

    function _relMultiplier(npcId) {
        var rel = _relLevel(npcId);
        // 0 rel = 1.0; +50 rel = 1.5; +100 rel = 2.0; -50 = 0.5
        return Math.max(0.4, Math.min(2.0, 1.0 + rel / 100));
    }

    function _runRollPass(baseChance) {
        _ensureState();
        // v9p33river357 pass-2: clear expired pending offers BEFORE the
        // pending-offer block — otherwise an ignored offer locks out all
        // future offers forever.
        var day = _getDay();
        var pending = player._pendingUnsolicitedOffer;
        if (pending && pending.expiresDay && pending.expiresDay < day) {
            try { _logEvent('📜 The offer from ' + pending.npcName + ' has expired.', null, 'my_actions'); } catch (e) {}
            // Apply the same -2 relationship hit as decline so ignoring is
            // not strictly better than declining.
            try { Player.modifyRelationship(pending.npcId, -2); } catch (e) {}
            // Mark NPC cooldown so they don't immediately re-offer.
            if (!player._unsolicitedNpcCooldowns) player._unsolicitedNpcCooldowns = {};
            player._unsolicitedNpcCooldowns[pending.npcId] = day;
            player._pendingUnsolicitedOffer = null;
        }
        if (player._pendingUnsolicitedOffer) return false;
        // v9p33river360: 7-day global cooldown between unsolicited offers
        if (player._lastUnsolicitedOfferDay && (day - player._lastUnsolicitedOfferDay) < 7) return false;
        if ((player._activeUnsolicitedQuests || []).length >= MAX_ACTIVE) return false;
        if (!player.townId || player.traveling) return false;
        if (player.jailedUntilDay && player.jailedUntilDay > day) return false;
        var candidates = _candidateNpcsInTown(player.townId);
        if (!candidates.length) return false;
        // Shuffle
        for (var i = candidates.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp;
        }
        for (var ci = 0; ci < candidates.length; ci++) {
            var npc = candidates[ci];
            var chance = baseChance * _relMultiplier(npc.id);
            if (Math.random() < chance) {
                if (_generateOfferFromNpc(npc)) return true;
            }
        }
        return false;
    }

    function tryGenerateDailyUnsolicitedOffer() {
        _ensureState();
        var townChanged = (player._lastUnsolicitedSeenTownId !== undefined && player._lastUnsolicitedSeenTownId !== player.townId);
        // If the player arrived in a new town, also check active quests
        // for an onArrival progress trigger (deliver-letter quests etc).
        if (townChanged && player.townId) {
            var active = player._activeUnsolicitedQuests || [];
            for (var ai = 0; ai < active.length; ai++) {
                var q = active[ai];
                if (!q) continue;
                var def = QUEST_DEFS[q.defId]; if (!def || !def.onArrival) continue;
                try {
                    var res = def.onArrival(q, player.townId);
                    if (res && res.advance) _toast(res.msg || 'Quest progress.', 'success');
                } catch (e) {}
            }
        }
        var chance = townChanged ? BASE_ENTRY_CHANCE : BASE_DAILY_CHANCE;
        var fired = _runRollPass(chance);
        player._lastUnsolicitedSeenTownId = player.townId;
        return fired;
    }
    function tryGenerateEntryUnsolicitedOffer(townId) {
        _ensureState();
        if (townId && player.townId !== townId) return false;
        var fired = _runRollPass(BASE_ENTRY_CHANCE);
        player._lastUnsolicitedSeenTownId = player.townId;
        return fired;
    }

    // ── Accept / Decline ──
    function getPendingUnsolicitedOffer() { _ensureState(); return player._pendingUnsolicitedOffer; }

    function acceptUnsolicitedOffer() {
        _ensureState();
        var offer = player._pendingUnsolicitedOffer;
        if (!offer) return { success: false, message: 'No pending offer.' };
        var day = _getDay();
        var quest = {
            id: 'uq_' + (player._nextUnsolicitedQuestId++),
            npcId: offer.npcId,
            npcName: offer.npcName,
            defId: offer.defId,
            params: offer.params,
            objectives: offer.objectives,
            rewards: offer.rewards,
            acceptedDay: day,
            deadlineDay: day + (offer.timeLimitDays || 30),
            progress: {}
        };
        player._activeUnsolicitedQuests.push(quest);
        player._pendingUnsolicitedOffer = null;
        // NPC cooldown
        player._unsolicitedNpcCooldowns[offer.npcId] = day;
        _logEvent('📜 Accepted quest from ' + offer.npcName + '.', null, 'my_actions');
        _toast('Quest accepted from ' + offer.npcName, 'success');
        return { success: true, message: 'Accepted.', quest: quest };
    }

    function declineUnsolicitedOffer() {
        _ensureState();
        var offer = player._pendingUnsolicitedOffer;
        if (!offer) return { success: false, message: 'No pending offer.' };
        var day = _getDay();
        // Small relationship hit
        try { Player.modifyRelationship(offer.npcId, -2); } catch (e) {}
        player._pendingUnsolicitedOffer = null;
        player._unsolicitedNpcCooldowns[offer.npcId] = day;
        _logEvent('📜 Declined quest from ' + offer.npcName + '.', null, 'my_actions');
        return { success: true, message: 'Declined.' };
    }

    // ── Active quest management ──
    function getActiveUnsolicitedQuests() { _ensureState(); return player._activeUnsolicitedQuests.slice(); }

    function tickActiveUnsolicitedQuests() {
        _ensureState();
        var day = _getDay();
        var i = (player._activeUnsolicitedQuests || []).length - 1;
        for (; i >= 0; i--) {
            var q = player._activeUnsolicitedQuests[i];
            if (!q) { player._activeUnsolicitedQuests.splice(i, 1); continue; }
            if (q.deadlineDay && day > q.deadlineDay) {
                _failUnsolicitedQuest(i, 'expired');
            }
        }
    }

    function _failUnsolicitedQuest(idx, reason) {
        var q = player._activeUnsolicitedQuests[idx];
        if (!q) return;
        try { Player.modifyRelationship(q.npcId, -10, undefined, 'quest_fail_' + q.id); } catch (e) {}
        player._activeUnsolicitedQuests.splice(idx, 1);
        _logEvent('📜 Quest from ' + q.npcName + ' failed (' + (reason || 'expired') + ').', null, 'my_actions');
        _toast('Quest failed (' + (reason || 'expired') + ')', 'warning');
    }

    function attemptCompleteUnsolicitedQuest(questId) {
        _ensureState();
        var idx = -1;
        for (var i = 0; i < player._activeUnsolicitedQuests.length; i++) {
            if (player._activeUnsolicitedQuests[i].id === questId) { idx = i; break; }
        }
        if (idx < 0) return { success: false, message: 'Quest not found.' };
        var q = player._activeUnsolicitedQuests[idx];
        var def = QUEST_DEFS[q.defId];
        if (!def) {
            // Orphan quest — remove
            player._activeUnsolicitedQuests.splice(idx, 1);
            return { success: false, message: 'Quest definition missing.' };
        }
        var check = def.check(q);
        if (!check.ok) return { success: false, message: check.reason };
        // Consume + award
        try { def.consume(q); } catch (e) {}
        var rewards = q.rewards || {};
        var msg = '✅ Quest complete!';
        if (rewards.gold) {
            player.gold = (player.gold || 0) + rewards.gold;
            msg += ' +' + rewards.gold + 'g.';
        }
        if (rewards.rel) {
            try { Player.modifyRelationship(q.npcId, rewards.rel); } catch (e) {}
            msg += ' +' + rewards.rel + ' rel with ' + q.npcName + '.';
        }
        if (rewards.unique) _applyUniqueReward(rewards.unique, q);
        // Record completion on NPC for disposition
        try {
            var npc = _findPerson(q.npcId);
            if (npc && Engine.recordPlayerQuestCompleted) Engine.recordPlayerQuestCompleted(npc);
        } catch (e) {}
        if (player.completedQuestCount != null) player.completedQuestCount = (player.completedQuestCount || 0) + 1;
        player._activeUnsolicitedQuests.splice(idx, 1);
        _logEvent('✅ Completed quest for ' + q.npcName + '.', null, 'my_actions');
        _toast(msg, 'success');
        return { success: true, message: msg };
    }

    function _applyUniqueReward(unique, quest) {
        if (!unique || !unique.type) return;
        try {
            if (unique.type === 'marriage_blessing') {
                // Boost relationship with target child + flag a guaranteed-yes proposal
                if (unique.childId) {
                    Player.modifyRelationship(unique.childId, 80);
                    if (!player._guaranteedProposals) player._guaranteedProposals = {};
                    player._guaranteedProposals[unique.childId] = _getDay() + 90;
                    _logEvent('💍 Marriage blessing earned. Their child will accept a proposal.', null, 'my_actions');
                }
            } else if (unique.type === 'citizenship') {
                if (unique.kingdomId) {
                    if (!player.socialRank) player.socialRank = {};
                    if ((player.socialRank[unique.kingdomId] || 0) < 1) player.socialRank[unique.kingdomId] = 1;
                    if (!player.citizenshipKingdomId) player.citizenshipKingdomId = unique.kingdomId;
                    _logEvent('🏛️ You have been granted citizenship.', null, 'my_actions');
                }
            }
        } catch (e) {}
    }

    function generateQuestFromNpc(personId) {
        _ensureState();
        if (!personId) return false;
        var npc = _findPerson(personId);
        var day = _getDay();
        if (!npc || npc.alive === false) return false;
        if (!(_isEliteMerchant(npc) || _isNoble(npc))) return false;
        if (!_canTalkToNpc(npc.id)) return false;
        if (_relLevel(npc.id) < 40) return false;
        if (player._pendingUnsolicitedOffer) return false;
        if ((player._activeUnsolicitedQuests || []).length >= MAX_ACTIVE) return false;
        if (!player.townId || player.traveling || npc.townId !== player.townId) return false;
        if (player.jailedUntilDay && player.jailedUntilDay > day) return false;
        var cd = (player._unsolicitedNpcCooldowns && player._unsolicitedNpcCooldowns[npc.id]) || 0;
        if (cd && day - cd < NPC_COOLDOWN_DAYS) return false;
        return _generateOfferFromNpc(npc);
    }

    // ── Detail-pane helpers ──
    function unsolicitedOfferForNpc(npcId) {
        _ensureState();
        var offer = player._pendingUnsolicitedOffer;
        if (offer && offer.npcId === npcId) return offer;
        return null;
    }

    function activeQuestsForNpc(npcId) {
        _ensureState();
        return (player._activeUnsolicitedQuests || []).filter(function(q) { return q && q.npcId === npcId; });
    }

    // ── Arrival hook (entry roll) ──
    function onPlayerArrival(townId) {
        tryGenerateEntryUnsolicitedOffer(townId);
        // Also: any active quest with onArrival
        _ensureState();
        var active = player._activeUnsolicitedQuests || [];
        for (var i = 0; i < active.length; i++) {
            var q = active[i];
            var def = QUEST_DEFS[q.defId]; if (!def || !def.onArrival) continue;
            var res = def.onArrival(q, townId);
            if (res && res.advance) {
                _toast(res.msg || 'Quest progress.', 'success');
            }
        }
    }

    Player.tryGenerateDailyUnsolicitedOffer = tryGenerateDailyUnsolicitedOffer;
    Player.tryGenerateEntryUnsolicitedOffer = tryGenerateEntryUnsolicitedOffer;
    Player.getPendingUnsolicitedOffer = getPendingUnsolicitedOffer;
    Player.acceptUnsolicitedOffer = acceptUnsolicitedOffer;
    Player.declineUnsolicitedOffer = declineUnsolicitedOffer;
    Player.getActiveUnsolicitedQuests = getActiveUnsolicitedQuests;
    Player.tickActiveUnsolicitedQuests = tickActiveUnsolicitedQuests;
    Player.attemptCompleteUnsolicitedQuest = attemptCompleteUnsolicitedQuest;
    Player.generateQuestFromNpc = generateQuestFromNpc;
    Player.unsolicitedOfferForNpc = unsolicitedOfferForNpc;
    Player.activeUnsolicitedQuestsForNpc = activeQuestsForNpc;
    Player.onPlayerArrival_unsolicited = onPlayerArrival;
})(window.Player);
