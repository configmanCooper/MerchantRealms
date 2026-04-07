// ═══════════════════════════════════════════════════════════
//  GUIDANCE SYSTEM — "Merchant's Path"
//  Contextual task suggestions for new players (Peasant→Burgher)
//  Auto-disables at Guildmaster. Fully self-contained for easy removal.
// ═══════════════════════════════════════════════════════════
var Guidance = (function () {
    'use strict';

    var _initialized = false;
    var _lastRefreshDay = -1;
    var REFRESH_INTERVAL = 1; // check every day
    var _lastRenderedHtml = ''; // dedup renders to avoid DOM thrash
    var _delegationBound = false;

    // ── Task Pool ──────────────────────────────────────────
    // Each task: { id, text(p), check(p), priority(p), category, minRank, maxRank }
    // category prevents >1 task of same type at once

    function _getPlayerRank(p) {
        if (!p || !p.socialRank) return 0;
        var max = 0;
        for (var k in p.socialRank) {
            if ((p.socialRank[k] || 0) > max) max = p.socialRank[k];
        }
        return max;
    }

    function _getTown(townId) {
        try { return Engine.getTown ? Engine.getTown(townId) : null; } catch (e) { return null; }
    }

    function _getTownName(townId) {
        var t = _getTown(townId);
        return t ? t.name : 'a nearby town';
    }

    function _getKingdomName(kId) {
        try {
            var k = Engine.findKingdom ? Engine.findKingdom(kId) : null;
            return k ? k.name : 'the kingdom';
        } catch (e) { return 'the kingdom'; }
    }

    function _getAllTowns() {
        try { return Engine.getTowns ? Engine.getTowns() : []; } catch (e) { return []; }
    }

    function _getTownsSortedByDistance(p) {
        var currentTown = _getTown(p.townId);
        if (!currentTown) return [];
        var towns = _getAllTowns();
        var results = [];
        for (var i = 0; i < towns.length; i++) {
            var t = towns[i];
            if (t.id === p.townId || t.abandoned || t.destroyed) continue;
            var dx = t.x - currentTown.x, dy = t.y - currentTown.y;
            results.push({ town: t, dist: Math.sqrt(dx * dx + dy * dy) });
        }
        results.sort(function (a, b) { return a.dist - b.dist; });
        return results;
    }

    function _getNearestUnvisitedTown(p) {
        var visited = p._visitedTowns || {};
        var sorted = _getTownsSortedByDistance(p);
        for (var i = 0; i < sorted.length; i++) {
            if (!visited[sorted[i].town.id]) return sorted[i].town;
        }
        // If all visited, return closest or 2nd closest
        return sorted.length > 1 ? sorted[1].town : (sorted.length > 0 ? sorted[0].town : null);
    }

    function _getNearestTown(p) {
        var sorted = _getTownsSortedByDistance(p);
        // Pick closest or 2nd closest (avoid always sending to same place)
        if (sorted.length >= 2) {
            var visited = p._visitedTowns || {};
            // Prefer one they haven't been to, among top 2
            if (!visited[sorted[0].town.id]) return sorted[0].town;
            if (!visited[sorted[1].town.id]) return sorted[1].town;
            return sorted[0].town;
        }
        return sorted.length > 0 ? sorted[0].town : null;
    }

    function _getBasePrice(resId) {
        if (typeof RESOURCE_TYPES === 'undefined') return 0;
        for (var k in RESOURCE_TYPES) {
            if (RESOURCE_TYPES[k].id === resId) return RESOURCE_TYPES[k].basePrice || 0;
        }
        return 0;
    }

    function _getResourceName(resId) {
        if (typeof RESOURCE_TYPES === 'undefined') return resId;
        for (var k in RESOURCE_TYPES) {
            if (RESOURCE_TYPES[k].id === resId) return RESOURCE_TYPES[k].name || resId;
        }
        return resId;
    }

    function _getCheapGood(p) {
        try {
            var town = _getTown(p.townId);
            if (!town || !town.market || !town.market.prices) return null;
            var best = null, bestRatio = 1;
            for (var res in town.market.prices) {
                var price = town.market.prices[res];
                if (price <= 0 || (town.market.supply[res] || 0) < 3) continue;
                var base = _getBasePrice(res);
                if (base <= 0) continue;
                var ratio = price / base;
                if (ratio < bestRatio) { bestRatio = ratio; best = res; }
            }
            return best ? _getResourceName(best) : null;
        } catch (e) { return null; }
    }

    function _getExpensiveSellGood(p) {
        try {
            var town = _getTown(p.townId);
            if (!town || !town.market || !town.market.prices || !p.inventory) return null;
            var best = null, bestRatio = 1;
            for (var res in p.inventory) {
                if ((p.inventory[res] || 0) < 1) continue;
                var price = town.market.prices[res];
                if (!price || price <= 0) continue;
                var base = _getBasePrice(res);
                if (base <= 0) continue;
                var ratio = price / base;
                if (ratio > bestRatio) { bestRatio = ratio; best = res; }
            }
            return best ? _getResourceName(best) : null;
        } catch (e) { return null; }
    }

    function _hasInventoryItems(p) {
        if (!p.inventory) return false;
        for (var k in p.inventory) { if ((p.inventory[k] || 0) > 0) return true; }
        return false;
    }

    function _getInventoryCount(p) {
        var count = 0;
        if (p.inventory) { for (var k in p.inventory) { count += p.inventory[k] || 0; } }
        return count;
    }

    function _getTotalLand(p) {
        var total = 0;
        if (p.landOwned) { for (var k in p.landOwned) { total += p.landOwned[k] || 0; } }
        return total;
    }

    function _getGuildInTown(p) {
        // Returns the first guild building type available in the player's current town
        try {
            var town = _getTown(p.townId);
            if (!town || !town.buildings) return null;
            for (var i = 0; i < town.buildings.length; i++) {
                var b = town.buildings[i];
                if (b.inGuild && !b.destroyed) return b;
            }
        } catch (e) {}
        return null;
    }

    function _hasGuildInTown(p) {
        return _getGuildInTown(p) !== null;
    }

    // Find which specific guilds have guild-affiliated buildings in the player's current town
    function _getAvailableGuildsInTown(p) {
        try {
            var town = _getTown(p.townId);
            if (!town || !town.buildings || typeof CONFIG === 'undefined' || !CONFIG.GUILDS) return [];
            var bt = (typeof BUILDING_TYPES !== 'undefined') ? BUILDING_TYPES : {};
            var found = {};
            for (var i = 0; i < town.buildings.length; i++) {
                var b = town.buildings[i];
                if (!b.inGuild || b.destroyed) continue;
                var bDef = bt[b.type] || bt[b.type.toUpperCase()] || null;
                if (!bDef) continue;
                var cat = bDef.category;
                if (!cat) continue;
                for (var gId in CONFIG.GUILDS) {
                    if (found[gId]) continue;
                    var g = CONFIG.GUILDS[gId];
                    if (g.categories && g.categories.indexOf(cat) >= 0) {
                        found[gId] = g;
                    }
                }
            }
            var results = [];
            for (var gk in found) results.push(found[gk]);
            return results;
        } catch (e) { return []; }
    }

    // Pick the best guild to recommend — prioritize farmers, miners, harvesters, maritime
    function _getBestGuildToJoin(p) {
        var available = _getAvailableGuildsInTown(p);
        if (available.length === 0) return null;
        var joined = p.guildMemberships || {};
        // Filter out guilds already joined
        var unjoined = available.filter(function(g) { return !joined[g.id]; });
        if (unjoined.length === 0) return null;
        // Priority order
        var preferred = ['farmers', 'miners', 'harvesters', 'maritime'];
        for (var pi = 0; pi < preferred.length; pi++) {
            for (var ui = 0; ui < unjoined.length; ui++) {
                if (unjoined[ui].id === preferred[pi]) return unjoined[ui];
            }
        }
        return unjoined[0]; // fallback to first available
    }

    // Find the highest non-spouse, non-child relationship NPC
    function _getHighestRelationshipNPC(p) {
        if (!p.relationships) return null;
        var best = null, bestLevel = 0;
        for (var pid in p.relationships) {
            var rel = p.relationships[pid];
            if (!rel || rel.type === 'spouse' || rel.type === 'child') continue;
            var lvl = rel.level || 0;
            if (lvl > bestLevel) { bestLevel = lvl; best = { id: pid, level: lvl }; }
        }
        return best;
    }

    // Check if player has any NPC with 60+ relationship (non-spouse/child)
    function _hasHighRelationship(p) {
        var npc = _getHighestRelationshipNPC(p);
        return npc && npc.level >= 60;
    }

    // Check if player has used a relationship perk (favor)
    function _hasUsedFavor(p) {
        // perkCooldowns tracks personId_perkId → lastUsedDay
        if (p.perkCooldowns) {
            var baselineDay = (p._guidanceBaseline && p._guidanceBaseline._favorCheckDay) || 0;
            for (var key in p.perkCooldowns) {
                if (p.perkCooldowns[key] > baselineDay) return true;
            }
        }
        return false;
    }

    function _getVisitedTownCount(p) {
        return p._visitedTowns ? Object.keys(p._visitedTowns).length : 0;
    }

    function _getRecentVisitedTownName(p) {
        if (!p._visitedTowns) return null;
        var entries = [];
        for (var tid in p._visitedTowns) {
            if (tid !== p.townId) entries.push({ id: tid, day: p._visitedTowns[tid] });
        }
        if (entries.length === 0) return null;
        entries.sort(function (a, b) { return b.day - a.day; });
        return _getTownName(entries[0].id);
    }

    function _hasFood(p) {
        if (!p.inventory) return false;
        var foods = ['bread','meat','poultry','fish','eggs','preserved_food','vegetables','grapes','honey'];
        for (var i = 0; i < foods.length; i++) {
            if ((p.inventory[foods[i]] || 0) > 0) return true;
        }
        return false;
    }

    function _hasWater(p) {
        if (!p.inventory) return false;
        var drinks = ['water','ale','mead','cider','herbal_tea','wine'];
        for (var i = 0; i < drinks.length; i++) {
            if ((p.inventory[drinks[i]] || 0) > 0) return true;
        }
        return false;
    }

    function _isSickOrInjured(p) {
        return (p.injuries && p.injuries.length > 0) || (p.illnesses && p.illnesses.length > 0);
    }

    function _hasMedicalInTown(p) {
        var town = _getTown(p.townId);
        if (!town || !town.buildings) return false;
        for (var i = 0; i < town.buildings.length; i++) {
            var b = town.buildings[i];
            if (!b.destroyed && (b.type === 'hospital' || b.type === 'clinic')) return true;
        }
        return false;
    }

    function _hasUnstaffedBuilding(p) {
        if (!p.buildings || p.buildings.length === 0) return false;
        var staffed = {};
        if (p.employees) {
            for (var i = 0; i < p.employees.length; i++) {
                var eid = p.employees[i];
                if (typeof eid === 'object' && eid.buildingId) staffed[eid.buildingId] = true;
                else if (typeof eid === 'string') staffed[eid] = true;
            }
        }
        for (var j = 0; j < p.buildings.length; j++) {
            var bld = p.buildings[j];
            var bt = (typeof BUILDING_TYPES !== 'undefined') ? BUILDING_TYPES[bld.type] : null;
            if (bt && bt.workers && bt.workers > 0 && !staffed[bld.id]) return true;
        }
        return false;
    }

    function _getUpgradeableBuilding(p) {
        if (!p.buildings || p.buildings.length === 0) return null;
        for (var i = 0; i < p.buildings.length; i++) {
            var b = p.buildings[i];
            if ((b.level || 1) < 5) return b;
        }
        return null;
    }

    function _getAchievementCount(p) {
        if (!p.achievements) return 0;
        var count = 0;
        for (var k in p.achievements) {
            if (p.achievements[k] && p.achievements[k].unlocked) count++;
        }
        return count;
    }

    function _hasEquipmentAvailable(p) {
        try {
            if (typeof Player === 'undefined' || !Player.getAvailableEquipment) return false;
            var weapons = Player.getAvailableEquipment('weapons');
            var armor = Player.getAvailableEquipment('armor');
            return (weapons && weapons.length > 0) || (armor && armor.length > 0);
        } catch (e) { return false; }
    }

    function _hasFamily(p) {
        return p.familyMembers && p.familyMembers.length > 0;
    }

    function _isSeaOnlyTown(p) {
        var town = _getTown(p.townId);
        return town && town.isIsland;
    }

    function _hasShip(p) {
        return p.ships && p.ships.length > 0;
    }

    // ── TASK POOL ────────────────────────────────────────────

    var TASK_POOL = [
        // ═══════════════ URGENT / SITUATIONAL (any rank) ═══════════════
        {
            id: 'rest_tired', category: 'urgent_rest',
            minRank: 0, maxRank: 2,
            text: function () { return '😴 Rest — you are tired'; },
            check: function (p) { return (p.energy || 0) >= 40; },
            priority: function (p) { return (p.energy || 100) < 20 ? 95 : 0; }
        },
        {
            id: 'buy_food', category: 'urgent_food',
            minRank: 0, maxRank: 2,
            text: function () { return '🍞 Buy food — you have none'; },
            check: function (p) { return _hasFood(p); },
            priority: function (p) { return !_hasFood(p) && p.gold >= 3 ? 92 : 0; }
        },
        {
            id: 'buy_water', category: 'urgent_water',
            minRank: 0, maxRank: 2,
            text: function () { return '💧 Buy water — you have none'; },
            check: function (p) { return _hasWater(p); },
            priority: function (p) { return !_hasWater(p) && p.gold >= 2 ? 92 : 0; }
        },
        {
            id: 'eat_now', category: 'urgent_eat',
            minRank: 0, maxRank: 2,
            text: function () { return '🍖 Eat — you are very hungry!'; },
            check: function (p) { return (p.hunger || 80) > 30; },
            priority: function (p) {
                if ((p.hunger || 80) <= 20 && _hasFood(p)) return 96;
                return 0;
            }
        },
        {
            id: 'drink_now', category: 'urgent_drink',
            minRank: 0, maxRank: 2,
            text: function () { return '💧 Drink — you are very thirsty!'; },
            check: function (p) { return (p.thirst || 80) > 30; },
            priority: function (p) {
                if ((p.thirst || 80) <= 20 && _hasWater(p)) return 96;
                return 0;
            }
        },
        {
            id: 'get_treatment', category: 'urgent_medical',
            minRank: 0, maxRank: 2,
            text: function () { return '🏥 Get treatment at a hospital or clinic'; },
            check: function (p) { return !_isSickOrInjured(p); },
            priority: function (p) {
                if (!_isSickOrInjured(p)) return 0;
                return _hasMedicalInTown(p) ? 88 : 0;
            }
        },

        // ═══════════════ PEASANT (rank 0) ═══════════════
        {
            id: 'do_a_job', category: 'work',
            minRank: 0, maxRank: 1,
            text: function (p) { return '🔨 Do a job in ' + _getTownName(p.townId); },
            check: function (p) {
                var earned = (p.stats && p.stats.totalGoldEarned) || 0;
                return earned > (p._guidanceBaseline && p._guidanceBaseline.totalGoldEarned || 0);
            },
            priority: function (p) { return p.gold < 150 ? 90 : 40; }
        },
        {
            id: 'earn_100g', category: 'gold',
            minRank: 0, maxRank: 0,
            text: function () { return '🪙 Have 100 gold'; },
            check: function (p) { return p.gold >= 100; },
            priority: function (p) { return p.gold < 100 ? 85 : 0; }
        },
        {
            id: 'first_trade', category: 'trade',
            minRank: 0, maxRank: 0,
            text: function (p) {
                var good = _getCheapGood(p);
                return good ? '📦 Buy some ' + good + ' (cheap here!)' : '📦 Complete your first trade';
            },
            check: function (p) { return (p.stats && p.stats.tradesCompleted || 0) > 0; },
            priority: function (p) {
                var trades = (p.stats && p.stats.tradesCompleted) || 0;
                return trades === 0 && p.gold >= 20 ? 80 : 0;
            }
        },
        {
            id: 'travel_nearby', category: 'travel',
            minRank: 0, maxRank: 2,
            text: function (p) {
                var t = _getNearestUnvisitedTown(p);
                return '🗺️ Travel to ' + (t ? t.name : 'a nearby town');
            },
            check: function (p) {
                return _getVisitedTownCount(p) > (p._guidanceBaseline && p._guidanceBaseline.townsVisited || 0);
            },
            priority: function (p) {
                var visited = _getVisitedTownCount(p);
                if (visited < 2) return 75;
                if (visited < 5) return 40;
                return 15;
            }
        },
        {
            id: 'buy_trade_tip', category: 'tip',
            minRank: 0, maxRank: 1,
            text: function () { return '🕵️ Buy a trade tip from the Info Broker (10g)'; },
            check: function (p) {
                var tips = p.tradeTipLog ? p.tradeTipLog.length : 0;
                var baseline = (p._guidanceBaseline && p._guidanceBaseline.tradeTips) || 0;
                return tips > baseline;
            },
            priority: function (p) {
                if (p.gold < 15) return 0;
                var tips = p.tradeTipLog ? p.tradeTipLog.length : 0;
                return tips < 2 ? 60 : 20;
            }
        },
        {
            id: 'compare_prices', category: 'intel',
            minRank: 0, maxRank: 1,
            text: function (p) {
                var recentTown = _getRecentVisitedTownName(p);
                return recentTown
                    ? '📊 Compare prices here with ' + recentTown
                    : '📊 Check the market to compare prices';
            },
            check: function (p) {
                // Completed if they have market intel for at least one other town
                return p.marketIntel && Object.keys(p.marketIntel).length > 0;
            },
            priority: function (p) {
                var visited = _getVisitedTownCount(p);
                if (visited < 2) return 0; // need at least 2 towns
                var hasIntel = p.marketIntel && Object.keys(p.marketIntel).length > 0;
                return hasIntel ? 0 : 55;
            }
        },
        {
            id: 'earn_500g', category: 'gold',
            minRank: 0, maxRank: 1,
            text: function () { return '🪙 Have 500 gold'; },
            check: function (p) { return p.gold >= 500; },
            priority: function (p) { return p.gold >= 100 && p.gold < 500 ? 65 : 0; }
        },
        {
            id: 'reach_rep_40', category: 'reputation',
            minRank: 0, maxRank: 0,
            text: function () { return '⭐ Reach 40 reputation in a kingdom'; },
            check: function (p) {
                if (!p.reputation) return false;
                for (var k in p.reputation) { if (p.reputation[k] >= 40) return true; }
                return false;
            },
            priority: function (p) {
                if (!p.reputation) return 45;
                var max = 0;
                for (var k in p.reputation) { if (p.reputation[k] > max) max = p.reputation[k]; }
                return max < 40 ? 50 : 0;
            }
        },
        {
            id: 'get_citizenship', category: 'rank',
            minRank: 0, maxRank: 0,
            text: function (p) {
                var kName = _getKingdomName(p.citizenshipKingdomId);
                return '🏠 Become a Citizen of ' + kName;
            },
            check: function (p) { return _getPlayerRank(p) >= 1; },
            priority: function (p) { return _getPlayerRank(p) === 0 ? 55 : 0; }
        },
        {
            id: 'learn_skill', category: 'skill',
            minRank: 0, maxRank: 2,
            text: function () { return '📖 Learn a new skill (open Skills panel)'; },
            check: function (p) {
                var sp = p.skillPoints || 0;
                var baseline = (p._guidanceBaseline && p._guidanceBaseline.skillPoints) || 0;
                return sp < baseline; // they spent some
            },
            priority: function (p) {
                return (p.skillPoints || 0) >= 3 ? 70 : 0;
            }
        },
        {
            id: 'talk_info', category: 'social',
            minRank: 0, maxRank: 1,
            text: function () { return '💬 Talk to townsfolk for useful info'; },
            check: function (p) {
                var earned = (p.stats && p.stats.totalGoldEarned) || 0;
                return earned > (p._guidanceBaseline && p._guidanceBaseline.totalGoldEarned || 0);
            },
            priority: function (p) {
                var visited = _getVisitedTownCount(p);
                return visited <= 2 ? 50 : 20;
            }
        },
        {
            id: 'buy_horse', category: 'horse',
            minRank: 0, maxRank: 1,
            text: function () { return '🐴 Buy a horse and mount it (faster travel)'; },
            check: function (p) { return p.horses && p.horses.length > 0; },
            priority: function (p) {
                if (p.horses && p.horses.length > 0) return 0;
                return p.gold >= 200 ? 55 : 0;
            }
        },
        {
            id: 'craft_backpack', category: 'backpack',
            minRank: 0, maxRank: 1,
            text: function () { return '🎒 Construct a backpack (Character panel)'; },
            check: function (p) { return !!p._backpack; },
            priority: function (p) {
                if (p._backpack) return 0;
                var hasLeather = p.inventory && (p.inventory.leather || 0) >= 2;
                var hasCloth = p.inventory && (p.inventory.cloth || 0) >= 1;
                if (hasLeather && hasCloth && p.gold >= 10) return 60;
                return p.gold >= 50 ? 30 : 0;
            }
        },
        {
            id: 'accomplish_feat', category: 'feat',
            minRank: 0, maxRank: 2,
            text: function () { return '🏆 Accomplish a feat (check Feats button)'; },
            check: function (p) {
                var count = _getAchievementCount(p);
                var baseline = (p._guidanceBaseline && p._guidanceBaseline.achievements) || 0;
                return count > baseline;
            },
            priority: function (p) {
                var count = _getAchievementCount(p);
                return count < 3 ? 35 : 15;
            }
        },
        {
            id: 'buy_equipment', category: 'equipment',
            minRank: 0, maxRank: 2,
            text: function (p) {
                if (!p.weapon && !p.armor) return '⚔️ Buy a weapon and armor (Character menu)';
                if (!p.weapon) return '⚔️ Buy a weapon (Character menu)';
                return '🛡️ Buy armor (Character menu)';
            },
            check: function (p) { return !!p.weapon && !!p.armor; },
            priority: function (p) {
                if (p.weapon && p.armor) return 0;
                if (p.gold < 500) return 0;
                return _hasEquipmentAvailable(p) ? 58 : 0;
            }
        },
        {
            id: 'hire_guard', category: 'guard',
            minRank: 0, maxRank: 2,
            text: function () { return '💂 Hire a personal guard (Character menu)'; },
            check: function (p) { return p.guards && p.guards.length > 0; },
            priority: function (p) {
                if (p.guards && p.guards.length > 0) return 0;
                return p.gold >= 1000 ? 45 : 0;
            }
        },
        {
            id: 'ask_family_gold', category: 'family',
            minRank: 0, maxRank: 1,
            text: function () { return '👨‍👩‍👧 Ask your family for gold'; },
            check: function (p) { return p.gold >= 200; },
            priority: function (p) {
                if (!_hasFamily(p)) return 0;
                return p.gold < 200 ? 65 : 0;
            }
        },
        {
            id: 'build_ship', category: 'ship',
            minRank: 0, maxRank: 2,
            text: function () { return '⛵ Commission a boat at this port'; },
            check: function (p) { return _hasShip(p); },
            priority: function (p) {
                if (_hasShip(p)) return 0;
                if (!_isSeaOnlyTown(p)) return 0;
                var town = _getTown(p.townId);
                if (!town || !town.isPort) return 0;
                return p.gold >= 500 ? 72 : 0;
            }
        },

        // ═══════════════ CITIZEN (rank 1) ═══════════════
        {
            id: 'buy_cheap_good', category: 'trade',
            minRank: 1, maxRank: 2,
            text: function (p) {
                var good = _getCheapGood(p);
                return good ? '📦 Buy ' + good + ' (below avg price here)' : '📦 Buy goods at the market';
            },
            check: function (p) {
                return (p.stats && p.stats.tradesCompleted || 0) > (p._guidanceBaseline && p._guidanceBaseline.tradesCompleted || 0);
            },
            priority: function (p) {
                return _getInventoryCount(p) < 10 && p.gold >= 50 ? 75 : 25;
            }
        },
        {
            id: 'sell_expensive_good', category: 'sell',
            minRank: 1, maxRank: 2,
            text: function (p) {
                var good = _getExpensiveSellGood(p);
                return good ? '💰 Sell ' + good + ' here (above avg price)' : '💰 Sell goods for profit';
            },
            check: function (p) {
                return (p.stats && p.stats.tradesCompleted || 0) > (p._guidanceBaseline && p._guidanceBaseline.tradesCompleted || 0);
            },
            priority: function (p) {
                var sellGood = _getExpensiveSellGood(p);
                return sellGood ? 70 : (_hasInventoryItems(p) ? 30 : 0);
            }
        },
        {
            id: 'join_guild', category: 'guild',
            minRank: 1, maxRank: 2,
            text: function (p) {
                var g = _getBestGuildToJoin(p);
                return '🏛️ Join the ' + (g ? g.name : 'a guild');
            },
            check: function (p) {
                var gm = p.guildMemberships || {};
                return Object.keys(gm).length > 0;
            },
            priority: function (p) {
                var joined = p.guildMemberships || {};
                if (Object.keys(joined).length > 0) return 0;
                if (p.gold < 300) return 0;
                var g = _getBestGuildToJoin(p);
                return g ? 65 : 0;
            }
        },
        {
            id: 'guild_craft', category: 'craft',
            minRank: 1, maxRank: 2,
            text: function () { return '⚒️ Craft an item at a guild building'; },
            check: function (p) {
                var crafts = (p.stats && p.stats.guildCrafts) || 0;
                var baseline = (p._guidanceBaseline && p._guidanceBaseline.guildCrafts) || 0;
                return crafts > baseline;
            },
            priority: function (p) {
                var joined = p.guildMemberships || {};
                if (Object.keys(joined).length === 0) return 0;
                if (!_hasGuildInTown(p)) return 0;
                return _hasInventoryItems(p) ? 55 : 0;
            }
        },
        {
            id: 'earn_1000g', category: 'gold',
            minRank: 1, maxRank: 1,
            text: function () { return '🪙 Have 1,000 gold'; },
            check: function (p) { return p.gold >= 1000; },
            priority: function (p) { return p.gold >= 500 && p.gold < 1000 ? 60 : 0; }
        },
        {
            id: 'buy_land', category: 'land',
            minRank: 1, maxRank: 2,
            text: function (p) { return '🏞️ Buy a plot of land in ' + _getTownName(p.townId); },
            check: function (p) { return _getTotalLand(p) > 0; },
            priority: function (p) {
                if (_getTotalLand(p) > 0) return 0;
                return p.gold >= 500 ? 65 : 0; // only suggest if they can likely afford it
            }
        },
        {
            id: 'build_first', category: 'building',
            minRank: 1, maxRank: 1,
            text: function () { return '🏗️ Build your first building'; },
            check: function (p) { return p.buildings && p.buildings.length > 0; },
            priority: function (p) {
                if (p.buildings && p.buildings.length > 0) return 0;
                if (_getTotalLand(p) === 0) return 0; // need land first
                return p.gold >= 1000 ? 70 : 0; // need enough gold
            }
        },
        {
            id: 'hire_worker', category: 'worker',
            minRank: 1, maxRank: 2,
            text: function () { return '👷 Hire a worker for your building'; },
            check: function (p) {
                return !_hasUnstaffedBuilding(p);
            },
            priority: function (p) {
                return _hasUnstaffedBuilding(p) ? 72 : 0;
            }
        },
        {
            id: 'upgrade_building', category: 'upgrade',
            minRank: 1, maxRank: 2,
            text: function (p) {
                var b = _getUpgradeableBuilding(p);
                var name = b ? (b.name || b.type) : 'a building';
                return '⬆️ Upgrade ' + name + ' (level up)';
            },
            check: function (p) {
                var b = _getUpgradeableBuilding(p);
                if (!b) return true; // no upgradeable = done
                var baseline = (p._guidanceBaseline && p._guidanceBaseline.buildingLevels) || 0;
                var total = 0;
                if (p.buildings) { for (var i = 0; i < p.buildings.length; i++) total += (p.buildings[i].level || 1); }
                return total > baseline;
            },
            priority: function (p) {
                if (!p.buildings || p.buildings.length === 0) return 0;
                if (!_getUpgradeableBuilding(p)) return 0;
                return p.gold >= 1000 ? 50 : 0;
            }
        },
        {
            id: 'complete_10_trades', category: 'trade_milestone',
            minRank: 1, maxRank: 2,
            text: function () { return '📊 Complete 10 trades'; },
            check: function (p) { return (p.stats && p.stats.tradesCompleted || 0) >= 10; },
            priority: function (p) {
                var trades = (p.stats && p.stats.tradesCompleted) || 0;
                return trades >= 3 && trades < 10 ? 45 : 0;
            }
        },
        {
            id: 'become_burgher', category: 'rank',
            minRank: 1, maxRank: 1,
            text: function () { return '⚖️ Achieve Burgher rank'; },
            check: function (p) { return _getPlayerRank(p) >= 2; },
            priority: function (p) { return _getPlayerRank(p) === 1 && p.gold >= 3000 ? 50 : 10; }
        },

        // ═══════════════ BURGHER (rank 2) ═══════════════
        {
            id: 'own_processing', category: 'building',
            minRank: 2, maxRank: 2,
            text: function () { return '⚙️ Own a processing or finished-goods building'; },
            check: function (p) {
                if (!p.buildings) return false;
                for (var i = 0; i < p.buildings.length; i++) {
                    var bt = (typeof BUILDING_TYPES !== 'undefined') ? BUILDING_TYPES[p.buildings[i].type] : null;
                    if (bt && (bt.category === 'processing' || bt.category === 'finished')) return true;
                }
                return false;
            },
            priority: function (p) {
                return p.gold >= 2000 && _getTotalLand(p) > 0 ? 60 : 0;
            }
        },
        {
            id: 'send_caravan', category: 'caravan',
            minRank: 2, maxRank: 2,
            text: function () { return '🐴 Send a trade caravan'; },
            check: function (p) { return p.caravans && p.caravans.length > 0; },
            priority: function (p) {
                if (p.caravans && p.caravans.length > 0) return 0;
                return p.gold >= 500 && _hasInventoryItems(p) ? 55 : 0;
            }
        },
        {
            id: 'build_second_town', category: 'expansion',
            minRank: 2, maxRank: 2,
            text: function () { return '🏘️ Build in a second town'; },
            check: function (p) {
                if (!p.buildings) return false;
                var towns = {};
                for (var i = 0; i < p.buildings.length; i++) { towns[p.buildings[i].townId] = true; }
                return Object.keys(towns).length >= 2;
            },
            priority: function (p) {
                if (!p.buildings || p.buildings.length === 0) return 0;
                var towns = {};
                for (var i = 0; i < p.buildings.length; i++) { towns[p.buildings[i].townId] = true; }
                return Object.keys(towns).length < 2 && p.gold >= 2000 ? 60 : 0;
            }
        },
        {
            id: 'earn_5000g', category: 'gold',
            minRank: 2, maxRank: 2,
            text: function () { return '🪙 Have 5,000 gold'; },
            check: function (p) { return p.gold >= 5000; },
            priority: function (p) { return p.gold >= 2000 && p.gold < 5000 ? 50 : 0; }
        },
        {
            id: 'join_second_guild', category: 'guild',
            minRank: 2, maxRank: 2,
            text: function (p) {
                var g = _getBestGuildToJoin(p);
                return '🏛️ Join the ' + (g ? g.name : 'another guild');
            },
            check: function (p) {
                var joined = p.guildMemberships || {};
                return Object.keys(joined).length >= 2;
            },
            priority: function (p) {
                var joined = p.guildMemberships || {};
                var count = Object.keys(joined).length;
                if (count !== 1) return 0;
                if (p.gold < 300) return 0;
                var g = _getBestGuildToJoin(p);
                return g ? 45 : 0;
            }
        },
        {
            id: '8_workers', category: 'worker',
            minRank: 2, maxRank: 2,
            text: function () { return '👷 Hire 8 workers total'; },
            check: function (p) { return p.employees && p.employees.length >= 8; },
            priority: function (p) {
                var count = p.employees ? p.employees.length : 0;
                return count >= 1 && count < 8 && p.buildings && p.buildings.length >= 2 ? 50 : 0;
            }
        },
        {
            id: 'complete_50_trades', category: 'trade_milestone',
            minRank: 2, maxRank: 2,
            text: function () { return '📊 Complete 50 trades'; },
            check: function (p) { return (p.stats && p.stats.tradesCompleted || 0) >= 50; },
            priority: function (p) {
                var trades = (p.stats && p.stats.tradesCompleted) || 0;
                return trades >= 10 && trades < 50 ? 35 : 0;
            }
        },
        {
            id: 'build_relationship_60', category: 'social',
            minRank: 0, maxRank: 2,
            text: function (p) {
                var best = _getHighestRelationshipNPC(p);
                if (best && best.level >= 30) {
                    try {
                        var person = Engine.findPerson(best.id);
                        if (person) return '❤️ Reach 60 relationship with ' + person.firstName + ' (' + Math.round(best.level) + '/60)';
                    } catch(e) {}
                }
                return '❤️ Build a relationship to 60 with any NPC';
            },
            check: function (p) { return _hasHighRelationship(p); },
            priority: function (p) {
                if (_hasHighRelationship(p)) return 0; // already done
                var best = _getHighestRelationshipNPC(p);
                if (!best) return 0;
                // Show when they have at least one relationship 20+
                if (best.level >= 40) return 60;
                if (best.level >= 20) return 40;
                return 0;
            }
        },
        {
            id: 'ask_npc_favor', category: 'social',
            minRank: 0, maxRank: 2,
            text: function (p) {
                var best = _getHighestRelationshipNPC(p);
                if (best) {
                    try {
                        var person = Engine.findPerson(best.id);
                        if (person) return '🤝 Ask ' + person.firstName + ' for a favor (Talk → Favors)';
                    } catch(e) {}
                }
                return '🤝 Ask an NPC for a favor (Talk → Favors)';
            },
            check: function (p) { return _hasUsedFavor(p); },
            priority: function (p) {
                if (_hasUsedFavor(p)) return 0;
                if (!_hasHighRelationship(p)) return 0;
                return 55;
            }
        },
        {
            id: 'become_guildmaster', category: 'rank',
            minRank: 2, maxRank: 2,
            text: function () { return '🔨 Achieve Guildmaster rank'; },
            check: function (p) { return _getPlayerRank(p) >= 3; },
            priority: function (p) { return _getPlayerRank(p) === 2 && p.gold >= 10000 ? 45 : 5; }
        }
    ];

    // ── Active Tasks State ─────────────────────────────────
    // Stored on player: player._guidanceTasks = [{ id, textCache, completedDay }]
    // player._guidanceBaseline = { tradesCompleted, ... } snapshot at task assignment
    // player._guidanceDismissed = true to permanently hide
    // player._guidanceCollapsed = true to minimize

    function _shouldShow(p) {
        if (!p) return false;
        if (p._guidanceDismissed) return false;
        if (_getPlayerRank(p) >= 3) return false;
        // Check if unique start
        if (p.gameStart) {
            var uniqueStarts = ['pilgrim', 'shipwrecked', 'musician', 'military', 'scholar'];
            if (uniqueStarts.indexOf(p.gameStart) >= 0) return false;
        }
        return true;
    }

    function _ensureBaseline(p) {
        if (!p._guidanceBaseline) {
            var totalLevels = 0;
            if (p.buildings) { for (var i = 0; i < p.buildings.length; i++) totalLevels += (p.buildings[i].level || 1); }
            var currentDay = 0;
            try { currentDay = Engine.getDay(); } catch(e) {}
            p._guidanceBaseline = {
                tradesCompleted: (p.stats && p.stats.tradesCompleted) || 0,
                townsVisited: _getVisitedTownCount(p),
                totalGoldEarned: (p.stats && p.stats.totalGoldEarned) || 0,
                buildingsOwned: (p.stats && p.stats.buildingsOwned) || 0,
                employeesHired: (p.stats && p.stats.employeesHired) || 0,
                daysPlayed: (p.stats && p.stats.daysPlayed) || 0,
                tradeTips: p.tradeTipLog ? p.tradeTipLog.length : 0,
                skillPoints: p.skillPoints || 0,
                guildCrafts: (p.stats && p.stats.guildCrafts) || 0,
                achievements: _getAchievementCount(p),
                buildingLevels: totalLevels,
                _favorCheckDay: currentDay
            };
        }
    }

    function _refreshTasks(p) {
        if (!p._guidanceTasks) p._guidanceTasks = [];
        _ensureBaseline(p);

        var currentDay = (typeof Engine !== 'undefined' && Engine.getDay) ? Engine.getDay() : 0;
        var rank = _getPlayerRank(p);

        // Remove completed tasks after 5 seconds real time
        var nowMs = Date.now();
        p._guidanceTasks = p._guidanceTasks.filter(function (t) {
            if (t.completedAt && nowMs - t.completedAt > 5000) return false;
            return true;
        });

        // Check existing tasks for completion
        for (var i = 0; i < p._guidanceTasks.length; i++) {
            var active = p._guidanceTasks[i];
            if (active.completedDay) continue;
            var def = _findDef(active.id);
            if (def && def.check(p)) {
                active.completedDay = currentDay;
                active.completedAt = nowMs;
                _rewardTaskComplete();
                _updateBaseline(p, active.id);
            }
        }

        // Fill up to 4 active (non-completed) tasks
        var activeCount = p._guidanceTasks.filter(function (t) { return !t.completedDay; }).length;
        if (activeCount >= 4) return;

        var activeIds = {};
        var activeCategories = {};
        for (var j = 0; j < p._guidanceTasks.length; j++) {
            activeIds[p._guidanceTasks[j].id] = true;
            var d = _findDef(p._guidanceTasks[j].id);
            if (d && !p._guidanceTasks[j].completedDay) activeCategories[d.category] = true;
        }

        // Score and sort candidates
        var candidates = [];
        for (var k = 0; k < TASK_POOL.length; k++) {
            var task = TASK_POOL[k];
            if (rank < task.minRank || rank > task.maxRank) continue;
            if (activeIds[task.id]) continue;
            if (activeCategories[task.category]) continue;
            // Don't show if already completed
            if (task.check(p)) continue;
            var score = task.priority(p);
            if (score <= 0) continue;
            candidates.push({ def: task, score: score });
        }

        candidates.sort(function (a, b) { return b.score - a.score; });

        var needed = 4 - activeCount;
        for (var m = 0; m < Math.min(needed, candidates.length); m++) {
            var picked = candidates[m].def;
            p._guidanceTasks.push({
                id: picked.id,
                textCache: picked.text(p),
                completedDay: null
            });
            activeCategories[picked.category] = true;
        }
    }

    function _findDef(id) {
        for (var i = 0; i < TASK_POOL.length; i++) {
            if (TASK_POOL[i].id === id) return TASK_POOL[i];
        }
        return null;
    }

    function _updateBaseline(p, taskId) {
        if (!p._guidanceBaseline) return;
        var b = p._guidanceBaseline;
        b.tradesCompleted = (p.stats && p.stats.tradesCompleted) || 0;
        b.townsVisited = _getVisitedTownCount(p);
        b.totalGoldEarned = (p.stats && p.stats.totalGoldEarned) || 0;
        b.buildingsOwned = (p.stats && p.stats.buildingsOwned) || 0;
        b.employeesHired = (p.stats && p.stats.employeesHired) || 0;
        b.daysPlayed = (p.stats && p.stats.daysPlayed) || 0;
        b.tradeTips = p.tradeTipLog ? p.tradeTipLog.length : 0;
        b.skillPoints = p.skillPoints || 0;
        b.guildCrafts = (p.stats && p.stats.guildCrafts) || 0;
        b.achievements = _getAchievementCount(p);
        var totalLevels = 0;
        if (p.buildings) { for (var i = 0; i < p.buildings.length; i++) totalLevels += (p.buildings[i].level || 1); }
        b.buildingLevels = totalLevels;
        if (taskId === 'ask_npc_favor') {
            try { b._favorCheckDay = Engine.getDay(); } catch(e) {}
        }
    }

    // ── Rendering ──────────────────────────────────────────

    function _render(p) {
        var widget = document.getElementById('guidanceWidget');
        if (!widget) return;

        if (!_shouldShow(p)) {
            widget.style.display = 'none';
            _lastRenderedHtml = '';
            return;
        }

        var tasks = p._guidanceTasks || [];
        if (tasks.length === 0) {
            widget.style.display = 'none';
            _lastRenderedHtml = '';
            return;
        }

        widget.style.display = '';

        var collapsed = p._guidanceCollapsed || false;

        // Build HTML — use data attributes for event delegation (no inline onclick)
        var html = '<div data-guidance="header" title="These are completely optional tasks to help guide newer players" style="display:flex;align-items:center;justify-content:space-between;padding:4px 8px;cursor:pointer;background:rgba(180,160,120,0.15);border-bottom:1px solid rgba(180,160,120,0.3);user-select:none;">';
        html += '<span style="font-size:0.8rem;font-weight:bold;color:var(--parchment-dark,#5a4a2a);">📋 Merchant\'s Path ' + (collapsed ? '▶' : '▼') + '</span>';
        html += '<span data-guidance="dismiss" style="cursor:pointer;font-size:0.85rem;color:var(--text-muted,#888);padding:0 4px;line-height:1;" title="Hide Merchant\'s Path">✕</span>';
        html += '</div>';

        if (!collapsed) {
            html += '<div class="guidance-body" style="padding:4px 8px 6px;">';
            for (var i = 0; i < tasks.length; i++) {
                var t = tasks[i];
                var done = !!t.completedDay;
                var icon = done ? '✅' : '⬜';
                var textStyle = done ? 'text-decoration:line-through;color:var(--text-muted,#888);cursor:pointer;' : 'color:var(--parchment-dark,#5a4a2a);';
                if (done) {
                    html += '<div data-guidance="dismiss-task" data-task-id="' + _escapeHtml(t.id) + '" style="font-size:0.78rem;padding:2px 0;' + textStyle + '" title="Click to dismiss">' + icon + ' ' + _escapeHtml(t.textCache) + '</div>';
                } else {
                    html += '<div style="font-size:0.78rem;padding:2px 0;' + textStyle + '">' + icon + ' ' + _escapeHtml(t.textCache) + '</div>';
                }
            }
            html += '</div>';
        }

        // Only touch DOM if content actually changed
        if (html !== _lastRenderedHtml) {
            widget.innerHTML = html;
            _lastRenderedHtml = html;
        }

        // Bind event delegation once on the persistent widget element
        if (!_delegationBound) {
            _bindDelegation(widget);
            _delegationBound = true;
        }
    }

    function _bindDelegation(widget) {
        widget.addEventListener('click', function (e) {
            var el = e.target;
            while (el && el !== widget) {
                var action = el.getAttribute('data-guidance');
                if (action === 'dismiss') {
                    e.stopPropagation();
                    Guidance.confirmDismiss();
                    return;
                }
                if (action === 'dismiss-task') {
                    e.stopPropagation();
                    var taskId = el.getAttribute('data-task-id');
                    if (taskId) Guidance.dismissTask(taskId);
                    return;
                }
                if (action === 'header') {
                    Guidance.toggle();
                    return;
                }
                el = el.parentElement;
            }
        });
    }

    function _rewardTaskComplete() {
        if (typeof Player !== 'undefined' && Player.grantXP) {
            Player.grantXP(5, 'guidance_task');
        }
    }

    function _escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ── Public API ─────────────────────────────────────────

    function init() {
        _initialized = true;
    }

    function update() {
        if (!_initialized) return;
        var p;
        try { p = Player.state; } catch (e) { return; }
        if (!p) return;
        if (!_shouldShow(p)) {
            var w = document.getElementById('guidanceWidget');
            if (w) w.style.display = 'none';
            return;
        }

        var currentDay = (typeof Engine !== 'undefined' && Engine.getDay) ? Engine.getDay() : 0;
        if (currentDay !== _lastRefreshDay) {
            _refreshTasks(p);
            _lastRefreshDay = currentDay;
        } else {
            // Still check completions within the same day
            _ensureBaseline(p);
            var changed = false;
            var tasks = p._guidanceTasks || [];
            for (var i = 0; i < tasks.length; i++) {
                if (tasks[i].completedDay) continue;
                var def = _findDef(tasks[i].id);
                if (def && def.check(p)) {
                    tasks[i].completedDay = currentDay;
                    tasks[i].completedAt = Date.now();
                    _rewardTaskComplete();
                    _updateBaseline(p, tasks[i].id);
                    changed = true;
                }
            }
            if (changed) _refreshTasks(p);
        }

        _render(p);
    }

    function toggle() {
        try {
            var p = Player.state;
            p._guidanceCollapsed = !p._guidanceCollapsed;
            _lastRenderedHtml = ''; // force DOM update
            _render(p);
        } catch (e) {}
    }

    function confirmDismiss() {
        var body = '<p style="margin-bottom:12px;">Are you sure you want to hide Merchant\'s Path?</p>';
        body += '<p style="font-size:0.8rem;color:var(--text-muted);">You can re-enable it later in ⚙️ Settings.</p>';
        var footer = '<button class="btn-medieval" onclick="Guidance.dismiss();UI.closeModal()">Yes, hide it</button> ';
        footer += '<button class="btn-medieval" onclick="UI.closeModal()">Cancel</button>';
        UI.openModal("Hide Merchant's Path?", body, footer);
    }

    function dismiss() {
        try {
            var p = Player.state;
            p._guidanceDismissed = true;
            _lastRenderedHtml = '';
            var w = document.getElementById('guidanceWidget');
            if (w) w.style.display = 'none';
        } catch (e) {}
    }

    function enable() {
        try {
            var p = Player.state;
            p._guidanceDismissed = false;
            _lastRefreshDay = -1; // force refresh
            _lastRenderedHtml = ''; // force re-render
        } catch (e) {}
    }

    function isEnabled() {
        try {
            var p = Player.state;
            if (!p) return false;
            return !p._guidanceDismissed;
        } catch (e) { return false; }
    }

    function dismissTask(taskId) {
        try {
            var p = Player.state;
            if (!p || !p._guidanceTasks) return;
            p._guidanceTasks = p._guidanceTasks.filter(function (t) { return t.id !== taskId; });
            _lastRenderedHtml = '';
            _render(p);
        } catch (e) {}
    }

    return {
        init: init,
        update: update,
        toggle: toggle,
        confirmDismiss: confirmDismiss,
        dismiss: dismiss,
        enable: enable,
        isEnabled: isEnabled,
        dismissTask: dismissTask
    };

})();
