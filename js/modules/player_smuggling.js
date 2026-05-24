// ========================================================
// player_smuggling.js
// §3B SMUGGLING / CONTRABAND — extracted from player.js
// ========================================================
(function(Player) {
    "use strict";
    if (!Player) throw new Error("Player must be loaded before player_smuggling.js");

    var player;
    function _sync() { player = Player.state; }

    // ── Player helpers (defined in player.js, accessed via Player) ──
    var hasSkill = function(skillId) { return Player.hasSkill(skillId); };
    var hasSpecialLaw = function(kingdom, lawId) { return Player.hasSpecialLaw(kingdom, lawId); };
    var isNightTime = function() { return Player.isNightTime(); };
    var findResource = function(resId) { return Player.findResource(resId); };
    var deductGoodsFromPools = function(resourceId, qty) { return Player.deductGoodsFromPools(resourceId, qty); };
    var grantXP = function(amount, reason) { return Player.grantXP(amount, reason); };
    var unlockAchievement = function(id) { return Player.unlockAchievement(id); };
    var addTradeLog = function(resource, qty, price, townId, type) { return Player.addTradeLog(resource, qty, price, townId, type); };
    var isPlayerCitizenOf = function(kingdomId) { return Player.isPlayerCitizenOf(kingdomId); };

    // ========================================================
    // §3B  SMUGGLING / CONTRABAND
    // ========================================================
    function attemptSmuggle(resourceId, qty, town, kingdom, basePrice) {
        _sync();
        qty = Number(qty);
        if (!qty || !isFinite(qty) || qty <= 0) return { success: false, message: 'Invalid quantity.' };
        qty = Math.floor(qty);

        // v9p33river430: verify player actually has the goods before attempting smuggle
        var _smugAvail = (player.inventory[resourceId] || 0);
        var _smugTownStorage = player.townStorage && player.townId ? player.townStorage[player.townId] : null;
        if (_smugTownStorage && _smugTownStorage[resourceId]) {
            _smugAvail += _smugTownStorage[resourceId];
        }
        // v9p33river433: sell() can source from mounted/equipped goods too, so smuggling checks must count the same pool without mutating it first.
        if (resourceId === 'horses') _smugAvail += (player.horses && player.horses.length) || 0;
        if (player.weapon && typeof player.weapon === 'object' && player.weapon.id && typeof EQUIPMENT_TYPES !== 'undefined' && EQUIPMENT_TYPES.weapons) {
            var _smugW = EQUIPMENT_TYPES.weapons.find(function(e) { return e.id === player.weapon.id; });
            if (_smugW && _smugW.resource === resourceId) _smugAvail += 1;
        }
        if (player.armor && typeof player.armor === 'object' && player.armor.id && typeof EQUIPMENT_TYPES !== 'undefined' && EQUIPMENT_TYPES.armor) {
            var _smugA = EQUIPMENT_TYPES.armor.find(function(e) { return e.id === player.armor.id; });
            if (_smugA && _smugA.resource === resourceId) _smugAvail += 1;
        }
        if (resourceId === 'backpack' && (player._backpack || player.storageContainer === 'backpack')) _smugAvail += 1;
        if (player.storageContainer && player.storageContainer !== 'backpack' && resourceId === player.storageContainer) _smugAvail += 1;
        if (_smugAvail < qty) return { success: false, message: 'You only have ' + _smugAvail + ' ' + ((findResource(resourceId) || {}).name || resourceId) + '.' };

        // Nobles cannot smuggle against their own kingdom — it's beneath their station and treasonous
        var _smNobleRank = player.socialRank[kingdom.id] || 0;
        if (_smNobleRank >= 4) {
            var _smRankName = CONFIG.SOCIAL_RANKS[_smNobleRank] ? CONFIG.SOCIAL_RANKS[_smNobleRank].name : 'noble';
            return { success: false, message: 'As a ' + _smRankName + ' of ' + (kingdom.name || 'this kingdom') + ', smuggling against your own kingdom is treason. Your noble oath forbids it.' };
        }

        const rng = Engine.getRng();
        const rankIdx = player.socialRank[kingdom.id] || 0;
        let detectionChance = CONFIG.SMUGGLING_BASE_DETECTION
            - (rankIdx * CONFIG.SMUGGLING_RANK_REDUCTION)
            - Math.min(CONFIG.SMUGGLING_SKILL_MAX_REDUCTION, player.smugglingSkill * CONFIG.SMUGGLING_SKILL_REDUCTION);

        // Skill-based detection reduction
        if (hasSkill('master_smuggler')) detectionChance -= 0.20;
        else if (hasSkill('discrete')) detectionChance -= 0.10;

        // Check for guard relationships in town
        const people = Engine.getPeople(town.id);
        const guards = people ? people.filter(p => p.occupation === 'guard') : [];
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.smuggle || 4);
        for (const g of guards) {
            const rel = player.relationships[g.id];
            if (rel && rel.level >= 40) {
                detectionChance -= CONFIG.SMUGGLING_GUARD_RELATION_REDUCTION;
                break;
            }
        }
        detectionChance = Math.max(0.01, detectionChance);

        // Special law: night_market — halve detection at night
        if (hasSpecialLaw(kingdom, 'night_market') && isNightTime()) {
            detectionChance *= 0.5;
        }

        if (rng && rng.chance(detectionChance)) {
            // v9p33river305: _smugRepPenalty was previously assigned below
            // (line ~116) AFTER this immunity branch read it — producing
            // undefined / NaN reputation loss and broken toast messages.
            // Compute it up front so both branches see a valid number.
            var _smugRes = findResource(resourceId);
            var _smugIsWarGoods = _smugRes && (_smugRes.category === 'military' || resourceId === 'swords' || resourceId === 'armor' || resourceId === 'bows' || resourceId === 'shields' || resourceId === 'blasting_powder');
            var _smugRepPenalty = _smugIsWarGoods ? (CONFIG.SMUGGLING_REP_PENALTY_WAR_GOODS || 5) : (CONFIG.SMUGGLING_REP_PENALTY || 1);
            // Crime immunity check — Lords in lord town, RA kingdom-wide
            var smugImmunity = Player.checkCrimeImmunity(town.id, kingdom.id);
            if (smugImmunity.immune) {
                // Immune: still sell goods at normal price, just lose some rep
                var smugRepLoss = Math.min(_smugRepPenalty, 3);
                player.reputation[kingdom.id] = Math.max(0, (player.reputation[kingdom.id] || 50) - smugRepLoss);
                var normalRevenue = Math.floor(basePrice * qty);
                player.gold += normalRevenue;
                player.stats.totalGoldEarned += normalRevenue;
                deductGoodsFromPools(resourceId, qty);
                player.stats.tradesCompleted++;
                var scopeLabel = smugImmunity.scope === 'kingdom' ? 'Royal Advisor' : 'Lord of this town';
                EventTypes.emit('SMUGGLING_IMMUNITY_CAUGHT', {
                    playerFullName: player.fullName,
                    scopeLabel: scopeLabel,
                    repLoss: smugRepLoss,
                    townId: town.id,
                    kingdomId: kingdom.id
                });
                return { success: true, message: 'Caught smuggling, but your ' + scopeLabel + ' status grants immunity! (-' + smugRepLoss + ' rep). Sold for ' + normalRevenue + 'g.', totalRevenue: normalRevenue, immune: true };
            }

            // Caught! Check trial_combat special law first
            if (hasSpecialLaw(kingdom, 'trial_combat')) {
                let combatChance = 0.30;
                if (player.weapon) combatChance += (typeof player.weapon === 'object') ? (player.weapon.combatBonus * 0.5) : 0.10;
                if (hasSkill('combat_proficiency')) combatChance += 0.10;
                if (rng.chance(combatChance)) {
                    EventTypes.emit('SMUGGLING_TRIAL_BY_COMBAT_WON', {
                        playerFullName: player.fullName,
                        townName: town.name,
                        townId: town.id,
                        kingdomId: kingdom.id
                    });
                    grantXP(XP_REWARDS.COMBAT_SURVIVE, 'trial_combat');
                    const normalRevenue = Math.floor(basePrice * qty);
                    player.gold += normalRevenue;
                    player.stats.totalGoldEarned += normalRevenue;
                    deductGoodsFromPools(resourceId, qty);
                    player.stats.tradesCompleted++;
                    return { success: true, message: `Won Trial by Combat! Sold for ${normalRevenue}g.`, totalRevenue: normalRevenue };
                }
            }

            // But check untouchable skill
            if (hasSkill('untouchable') && rng.chance(0.25)) {
                EventTypes.emit('SMUGGLING_CHARGES_DROPPED', {
                    playerFullName: player.fullName,
                    townId: town.id,
                    kingdomId: kingdom.id
                });
                // Still sell at normal price
                const normalRevenue = Math.floor(basePrice * qty);
                player.gold += normalRevenue;
                player.stats.totalGoldEarned += normalRevenue;
                deductGoodsFromPools(resourceId, qty);
                player.stats.tradesCompleted++;
                return { success: true, message: `Nearly caught but charges dropped! Sold for ${normalRevenue}g.`, totalRevenue: normalRevenue };
            }

            const fineAmount = Math.floor(basePrice * qty * CONFIG.SMUGGLING_FINE_MULTIPLIER);
            // v9p33river305: _smugRepPenalty + _smugRes hoisted above
            // (computed at the top of the caught-branch so the immunity path
            // sees a valid number).

            // Special law: blood_price — pay 2x fine instead of jail
            if (hasSpecialLaw(kingdom, 'blood_price')) {
                const bloodFine = fineAmount * 2;
                Player.deductGoldOrDebt(bloodFine, 'kingdom', kingdom.id, kingdom.name, 'Blood Price smuggling fine');
                deductGoodsFromPools(resourceId, qty);
                player.reputation[kingdom.id] = Math.max(0, (player.reputation[kingdom.id] || 50) - _smugRepPenalty);
                player.achievementStats.smuggleStreak = 0;
                unlockAchievement('caught_ach');
                EventTypes.emit('SMUGGLING_BLOOD_PRICE_PAID', {
                    playerFullName: player.fullName,
                    bloodFine: bloodFine,
                    townName: town.name,
                    townId: town.id,
                    kingdomId: kingdom.id
                });
                return { success: false, message: `Caught! Blood Price paid: ${bloodFine}g. No jail time.`, caught: true };
            }

            Player.deductGoldOrDebt(fineAmount, 'kingdom', kingdom.id, kingdom.name, 'Smuggling fine');
            deductGoodsFromPools(resourceId, qty);
            player.reputation[kingdom.id] = Math.max(0, (player.reputation[kingdom.id] || 50) - _smugRepPenalty);
            let jailDays = (rng ? rng.randInt(CONFIG.SMUGGLING_JAIL_DAYS_MIN, CONFIG.SMUGGLING_JAIL_DAYS_MAX) : CONFIG.SMUGGLING_JAIL_DAYS_MIN);
            // Jail break skill
            if (hasSkill('jail_break')) jailDays = Math.max(1, Math.floor(jailDays * 0.5));
            player.jailedUntilDay = Engine.getDay() + jailDays;
            player.achievementStats.smuggleStreak = 0;
            unlockAchievement('caught_ach');
            unlockAchievement('jailbird');
            EventTypes.emit('SMUGGLING_CAUGHT_JAILED', {
                playerFullName: player.fullName,
                goodName: (findResource(resourceId) && findResource(resourceId).name) || resourceId,
                townName: town.name,
                fineAmount: fineAmount,
                jailDays: jailDays,
                townId: town.id,
                kingdomId: kingdom.id
            });
            return { success: false, message: `Caught smuggling! Fined ${fineAmount}g, goods confiscated, jailed ${jailDays} days.`, caught: true };
        } else {
            // Successful smuggle - black market premium
            let premiumMult = CONFIG.SMUGGLING_BLACK_MARKET_PREMIUM;
            if (hasSkill('black_market_contacts')) premiumMult = 2.0;
            const smugglePrice = basePrice * premiumMult;
            const totalRevenue = Math.floor(smugglePrice * qty);
            player.gold += totalRevenue;
            player.stats.totalGoldEarned += totalRevenue;
            deductGoodsFromPools(resourceId, qty);
            player.stats.tradesCompleted++;
            player.smugglingSkill = Math.min(20, player.smugglingSkill + 1);
            if (kingdom) {
                player.goldEarnedInKingdom[kingdom.id] = (player.goldEarnedInKingdom[kingdom.id] || 0) + totalRevenue;
            }
            // XP & achievement tracking
            grantXP(XP_REWARDS.SMUGGLE_SUCCESS, 'smuggle');
            player.achievementStats.smuggleSuccesses = (player.achievementStats.smuggleSuccesses || 0) + 1;
            player.achievementStats.smuggleStreak = (player.achievementStats.smuggleStreak || 0) + 1;
            player.achievementStats.smuggleGoldEarned = (player.achievementStats.smuggleGoldEarned || 0) + totalRevenue;
            // Track tax saved by smuggling for achievement
            var taxSaved = Math.floor(basePrice * qty * ((kingdom && kingdom.taxRate) || 0.10));
            player.smugglingTaxSaved = (player.smugglingTaxSaved || 0) + taxSaved;
            // Double agent check
            if (isPlayerCitizenOf(kingdom.id)) unlockAchievement('double_agent');
            addTradeLog(resourceId, qty, smugglePrice, town.id, 'smuggle');
            EventTypes.emit('SMUGGLING_SUCCESS', {
                playerFullName: player.fullName,
                goodName: (findResource(resourceId) && findResource(resourceId).name) || resourceId,
                townName: town.name,
                townId: town.id,
                kingdomId: kingdom.id
            });
            return { success: true, message: `Smuggled ${qty} ${findResource(resourceId)?.name || resourceId} for ${totalRevenue}g (black market)!`, totalRevenue, smuggled: true };
        }
    }

    // ── Exports ──
    Player.attemptSmuggle = attemptSmuggle;
    Player.getSmuggleChance = function(kingdomId) {
        _sync(); // v9p33river430: sync player state to avoid reading stale/undefined data
        var rankIdx = player.socialRank[kingdomId] || 0;
        var detection = CONFIG.SMUGGLING_BASE_DETECTION
            - (rankIdx * CONFIG.SMUGGLING_RANK_REDUCTION)
            - Math.min(CONFIG.SMUGGLING_SKILL_MAX_REDUCTION, player.smugglingSkill * CONFIG.SMUGGLING_SKILL_REDUCTION);
        if (hasSkill('master_smuggler')) detection -= 0.20;
        else if (hasSkill('discrete')) detection -= 0.10;
        return Math.max(0.05, Math.min(1, 1 - detection));
    };
})(window.Player);
