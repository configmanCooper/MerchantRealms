// ========================================================
// player_inventory.js
// §10A INVENTORY CAPACITY SYSTEM — extracted from player.js
// ========================================================
(function(Player) {
    "use strict";
    if (!Player) throw new Error("Player must be loaded before player_inventory.js");

    var player;
    function _sync() { player = Player.state; }

    // ── Player helpers (defined in player.js, accessed via Player) ──
    var hasSkill = function(skillId) { return Player.hasSkill(skillId); };
    var findResource = function(resId) { return Player.findResource(resId); };
    var logFinance = function(amount, category, description) { return Player.logFinance(amount, category, description); };
    var unlockAchievement = function(id) { return Player.unlockAchievement(id); };
    var isPlayerCitizenOf = function(kingdomId) { return Player.isPlayerCitizenOf(kingdomId); };
    var modifyRelationship = function(personId, amount) { return Player.modifyRelationship(personId, amount); };
    var modifyKingdomReputation = function(kingdomId, amount) { return Player.modifyReputation(kingdomId, amount); };
    // ========================================================
    // §10A INVENTORY CAPACITY SYSTEM
    // ========================================================

    function buyHorse(townId) {
        _sync();
        // v9p33river305: count mounted + inventory horses to match the cap
        // used by the regular buy/sell paths (player.js:1574) — was
        // mount-only which let players bypass the horse cap.
        var _maxBh = (CONFIG.MAX_HORSES || 2) + (hasSkill('horse_mastery') ? 2 : 0);
        var _totalBh = (player.horses ? player.horses.length : 0) + ((player.inventory && player.inventory.horses) || 0);
        if (_totalBh >= _maxBh) {
            return { success: false, message: 'You can only have ' + _maxBh + ' horses total (mounted + inventory).' };
        }
        var town = Engine.findTown(townId);
        if (!town || !town.market) return { success: false, message: 'No market here.' };

        // Draft Animal Law — commoners need permits
        if (town.kingdomId) {
            var horseKingdom = Engine.findKingdom(town.kingdomId);
            if (horseKingdom && horseKingdom.laws && horseKingdom.laws.specialLaws &&
                horseKingdom.laws.specialLaws.some(function(l) { return l.id === 'draft_animal_law'; })) {
                var cfg = CONFIG.DRAFT_ANIMAL_LAW;
                var playerRank = (player.socialRank && player.socialRank[horseKingdom.id]) || 0;
                if (cfg && playerRank < (cfg.minRankExempt || 2)) {
                    // Check for valid permit
                    var permit = player.horsePermit && player.horsePermit[horseKingdom.id];
                    if (!permit || permit.expiresDay <= Engine.getDay()) {
                        return { success: false, message: '🐴 ' + horseKingdom.name + ' requires a horse permit for commoners. Buy a permit (30-day: ' + (cfg.permitCostMonthly || 100) + 'g / Annual: ' + (cfg.permitCostAnnual || 1000) + 'g) or achieve Burgher rank.' };
                    }
                }
            }
        }

        var supply = (town.market.supply && town.market.supply.horses) || 0;
        if (supply < 1) return { success: false, message: 'No horses available in this market.' };
        var price = (town.market.prices && town.market.prices.horses) || 60;
        if (player.gold < price) return { success: false, message: 'Not enough gold. Need ' + price + 'g.' };

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.buy_horse || 2);

        player.gold -= price;
        player.stats.totalGoldSpent += price;
        town.market.supply.horses -= 1;

        var names = ['Shadow', 'Thunder', 'Storm', 'Blaze', 'Spirit', 'Midnight', 'Copper', 'Arrow', 'Dusty', 'Noble', 'Whisper', 'Ember', 'Frost', 'Chestnut', 'Maple'];
        var hrng = Engine.getRng();
        var name = names[hrng ? hrng.randInt(0, names.length - 1) : Math.floor(Math.random() * names.length)];
        // Make sure name is unique among current horses
        while (player.horses.some(function(h) { return h.name === name; })) {
            name = names[hrng ? hrng.randInt(0, names.length - 1) : Math.floor(Math.random() * names.length)] + ' ' + (hrng ? hrng.randInt(0, 99) : Math.floor(Math.random() * 100));
        }

        var horse = {
            id: 'horse_' + Date.now() + '_' + (hrng ? hrng.randInt(0, 999) : Math.floor(Math.random() * 1000)),
            name: name,
            stamina: 80 + (hrng ? hrng.randInt(0, 20) : Math.floor(Math.random() * 21)), // 80-100
            speed: 0.8 + (hrng ? hrng.random() * 0.4 : Math.random() * 0.4), // 0.8-1.2 multiplier
        };
        player.horses.push(horse);
        Engine.logEvent('🐴 You bought a horse named ' + horse.name + '!');

        if (player.storyMode && player.storyMode.active && typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('buy_horse', {});
        }

        return { success: true, message: '🐴 Bought ' + horse.name + '! (Stamina: ' + horse.stamina + ', Speed: ' + horse.speed.toFixed(1) + 'x)', horse: horse };
    }

    function sellHorse(horseId) {
        _sync();
        var idx = player.horses.findIndex(function(h) { return h.id === horseId; });
        if (idx === -1) return { success: false, message: 'Horse not found.' };

        // Check if container requires this horse
        var container = player.storageContainer ? CONFIG.STORAGE_CONTAINERS[player.storageContainer] : null;
        var required = container ? (container.horsesRequired || 0) : 0;
        if (player.horses.length - 1 < required) {
            return { success: false, message: 'Your ' + container.name + ' requires ' + required + ' horse(s). Downgrade container first.' };
        }

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.sell_horse || 2);

        var horse = player.horses[idx];
        var town = Engine.findTown(player.townId);
        var price = 0;
        if (town && town.market) {
            price = Math.floor(((town.market.prices && town.market.prices.horses) || 60) * 0.7);
            town.market.supply.horses = (town.market.supply.horses || 0) + 1;
        } else {
            price = 40; // Fallback
        }

        player.gold += price;
        player.stats.totalGoldEarned += price;
        // Return saddle to inventory if horse was saddled
        if (horse.saddled) {
            player.inventory.saddles = (player.inventory.saddles || 0) + 1;
        }
        player.horses.splice(idx, 1);
        if (player.horses.length === 0) player.travelMode = 'walk';
        Engine.logEvent('🐴 You sold ' + horse.name + ' for ' + price + 'g.');
        return { success: true, message: 'Sold ' + horse.name + ' for ' + price + 'g.' + (horse.saddled ? ' Saddle returned.' : '') };
    }

    function mountHorse() {
        _sync();
        var maxHorses = (CONFIG.MAX_HORSES || 2) + (hasSkill('horse_mastery') ? 2 : 0);
        if (player.horses.length >= maxHorses) {
            return { success: false, message: 'You can only have ' + maxHorses + ' horses mounted at once.' };
        }
        var held = player.inventory.horses || 0;
        if (held <= 0) return { success: false, message: 'No horses in inventory to mount.' };

        // Draft Animal Law check
        try {
            var town = Engine.findTown(player.townId);
            if (town && town.kingdomId) {
                var horseKingdom = Engine.findKingdom(town.kingdomId);
                if (horseKingdom && horseKingdom.laws && horseKingdom.laws.specialLaws &&
                    horseKingdom.laws.specialLaws.some(function(l) { return l.id === 'draft_animal_law'; })) {
                    var cfg = CONFIG.DRAFT_ANIMAL_LAW;
                    var playerRank = (player.socialRank && player.socialRank[horseKingdom.id]) || 0;
                    if (cfg && playerRank < (cfg.minRankExempt || 2)) {
                        var permit = player.horsePermit && player.horsePermit[horseKingdom.id];
                        if (!permit || permit.expiresDay <= Engine.getDay()) {
                            return { success: false, message: '🐴 ' + horseKingdom.name + ' requires a horse permit for commoners. Buy a permit or achieve Burgher rank.' };
                        }
                    }
                }
            }
        } catch(e) {}

        player.inventory.horses -= 1;
        if (player.inventory.horses <= 0) delete player.inventory.horses;

        var names = ['Shadow', 'Thunder', 'Storm', 'Blaze', 'Spirit', 'Midnight', 'Copper', 'Arrow', 'Dusty', 'Noble', 'Whisper', 'Ember', 'Frost', 'Chestnut', 'Maple'];
        var hrng = Engine.getRng();
        var name = names[hrng ? hrng.randInt(0, names.length - 1) : Math.floor(Math.random() * names.length)];
        while (player.horses.some(function(h) { return h.name === name; })) {
            name = names[hrng ? hrng.randInt(0, names.length - 1) : Math.floor(Math.random() * names.length)] + ' ' + (hrng ? hrng.randInt(0, 99) : Math.floor(Math.random() * 100));
        }

        var horse = {
            id: 'horse_' + Date.now() + '_' + (hrng ? hrng.randInt(0, 999) : Math.floor(Math.random() * 1000)),
            name: name,
            stamina: 80 + (hrng ? hrng.randInt(0, 20) : Math.floor(Math.random() * 21)),
            speed: 0.8 + (hrng ? hrng.random() * 0.4 : Math.random() * 0.4)
        };
        player.horses.push(horse);
        player.travelMode = 'horse';
        Engine.logEvent('🐴 You mounted ' + horse.name + '!');

        if (player.storyMode && player.storyMode.active && typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('mount_horse', {});
        }

        return { success: true, message: '🐴 Mounted ' + horse.name + '! (Stamina: ' + horse.stamina + ', Speed: ' + horse.speed.toFixed(1) + 'x)' };
    }

    function dismountHorse(horseId) {
        _sync();
        var idx = player.horses.findIndex(function(h) { return h.id === horseId; });
        if (idx === -1) return { success: false, message: 'Horse not found.' };

        // Check if container requires this horse
        var container = player.storageContainer ? CONFIG.STORAGE_CONTAINERS[player.storageContainer] : null;
        var required = container ? (container.horsesRequired || 0) : 0;
        if (player.horses.length - 1 < required) {
            return { success: false, message: 'Your ' + container.name + ' requires ' + required + ' horse(s). Downgrade container first.' };
        }

        var horse = player.horses[idx];
        // Return saddle to inventory if horse was saddled
        if (horse.saddled) {
            player.inventory.saddles = (player.inventory.saddles || 0) + 1;
        }
        player.horses.splice(idx, 1);
        player.inventory.horses = (player.inventory.horses || 0) + 1;
        if (player.horses.length === 0) player.travelMode = 'walk';
        Engine.logEvent('🐴 You dismounted ' + horse.name + '.');
        return { success: true, message: '🐴 Dismounted ' + horse.name + '. Horse added to inventory.' + (horse.saddled ? ' Saddle returned.' : '') };
    }

    function mountSaddle(horseId) {
        _sync();
        var horse = player.horses.find(function(h) { return h.id === horseId; });
        if (!horse) return { success: false, message: 'Horse not found.' };
        if (horse.saddled) return { success: false, message: horse.name + ' already has a saddle.' };
        var saddles = player.inventory.saddles || 0;
        if (saddles <= 0) return { success: false, message: 'No saddles in inventory.' };
        player.inventory.saddles -= 1;
        if (player.inventory.saddles <= 0) delete player.inventory.saddles;
        horse.saddled = true;
        Engine.logEvent('🪑 Saddle mounted on ' + horse.name + '.');
        return { success: true, message: '🪑 Saddle mounted on ' + horse.name + '! Travel energy reduced.' };
    }

    function unmountSaddle(horseId) {
        _sync();
        var horse = player.horses.find(function(h) { return h.id === horseId; });
        if (!horse) return { success: false, message: 'Horse not found.' };
        if (!horse.saddled) return { success: false, message: horse.name + ' has no saddle.' };
        horse.saddled = false;
        player.inventory.saddles = (player.inventory.saddles || 0) + 1;
        Engine.logEvent('🪑 Saddle removed from ' + horse.name + '.');
        return { success: true, message: '🪑 Saddle removed from ' + horse.name + '. Returned to inventory.' };
    }

    function buyHorsePermit(kingdomId, durationType) {
        _sync();
        var kingdom = Engine.findKingdom(kingdomId);
        if (!kingdom) return { success: false, message: 'Kingdom not found.' };
        if (!kingdom.laws || !kingdom.laws.specialLaws ||
            !kingdom.laws.specialLaws.some(function(l) { return l.id === 'draft_animal_law'; })) {
            return { success: false, message: 'This kingdom does not require horse permits.' };
        }
        var cfg = CONFIG.DRAFT_ANIMAL_LAW;
        if (!cfg) return { success: false, message: 'System error.' };
        var playerRank = (player.socialRank && player.socialRank[kingdomId]) || 0;
        if (playerRank >= (cfg.minRankExempt || 2)) {
            return { success: false, message: 'Your rank exempts you from needing a permit.' };
        }
        var isAnnual = durationType === 'annual';
        var cost = isAnnual ? (cfg.permitCostAnnual || 1000) : (cfg.permitCostMonthly || 100);
        var duration = isAnnual ? (cfg.permitDurationAnnual || 360) : (cfg.permitDurationMonthly || 30);
        if (player.gold < cost) return { success: false, message: 'Not enough gold. Permit costs ' + cost + 'g.' };
        player.gold -= cost;
        logFinance(-cost, 'licenses', 'Horse permit');
        player.stats.totalGoldSpent += cost;
        if (!player.horsePermit) player.horsePermit = {};
        player.horsePermit[kingdomId] = { purchasedDay: Engine.getDay(), expiresDay: Engine.getDay() + duration };
        // Permit fee goes to kingdom coffers
        kingdom.gold = (kingdom.gold || 0) + cost;
        var label = isAnnual ? 'annual' : '30-day';
        Engine.logEvent('🐴 Purchased a ' + label + ' horse permit in ' + kingdom.name + ' for ' + cost + 'g (valid ' + duration + ' days).');
        return { success: true, message: '🐴 Horse permit purchased! Valid for ' + duration + ' days.' };
    }

    function getCarryCapacity() {
        _sync();
        var base = CONFIG.PLAYER_BASE_CARRY || 20;
        // Carry capacity skills
        if (hasSkill('pack_mule')) base += 20;
        if (hasSkill('beast_of_burden')) base += 20;
        if (hasSkill('iron_back')) base += 30;
        // Horse bonus: each horse adds flat carry bonus
        var horseCarry = CONFIG.HORSE_CARRY_BONUS || 40;
        if (hasSkill('horse_mastery')) horseCarry = Math.floor(horseCarry * 1.25);
        var horseBonus = player.horses.length * horseCarry;
        if (player.storageContainer && CONFIG.STORAGE_CONTAINERS[player.storageContainer]) {
            var _capCont = CONFIG.STORAGE_CONTAINERS[player.storageContainer];
            var _cap = base * _capCont.capacityMult + horseBonus;
            // v9p33river260: backpack is worn ON the player and persists when
            // they switch to a vehicle. It adds extra capacity on top of the
            // cart/wagon (base × 1 = +20 by default) instead of being replaced.
            if (player._backpack && player.storageContainer !== 'backpack') {
                _cap += base;
            }
            return _cap;
        }
        // No vehicle, but backpack still counted via storageContainer === 'backpack' path above
        return base + horseBonus;
    }

    function getCarriedWeight() {
        _sync();
        var total = 0;
        for (var resId in player.inventory) {
            if (resId === 'horses') continue; // Horses tracked separately
            var qty = player.inventory[resId] || 0;
            if (qty <= 0) continue;
            var res = findResource(resId);
            var weight = res ? (res.weight || 1) : 1;
            total += qty * weight;
        }
        return total;
    }

    function getTownStorageCapacity(townId) {
        _sync();
        var tid = townId || player.townId;
        var total = 0;
        // Outpost base storage capacity
        var _capTown = Engine.findTown(tid);
        if (_capTown && _capTown.isOutpost) total += _capTown.outpostStorage || 200;
        // Warehouses (category: 'storage') always count, other buildings only if inputOnly is OFF
        for (var i = 0; i < player.buildings.length; i++) {
            var b = player.buildings[i];
            if (b.townId !== tid) continue;
            var bt = null;
            for (var key in BUILDING_TYPES) {
                if (BUILDING_TYPES[key].id === b.type) { bt = BUILDING_TYPES[key]; break; }
            }
            if (!bt || !bt.storage) continue;
            var cap = Player._bldStorageCap(bt.storage, b.level);
            // Buildings with no input consumes get half storage (except dedicated storage buildings)
            var hasConsumes = bt.consumes && Object.keys(bt.consumes).length > 0;
            if (!hasConsumes && bt.category !== 'storage') {
                cap = Math.floor(cap / 2);
            }
            if (bt.category === 'storage') {
                // Warehouses always contribute
                total += cap;
            } else if (bt.produces && b.inputOnly === false) {
                // Production buildings with inputOnly OFF contribute
                total += cap;
            } else if (!bt.produces) {
                // Non-production buildings (e.g. guild halls) contribute
                total += cap;
            }
            // inputOnly ON (default for production buildings) = excluded
        }
        // Housing storage (cottages, townhouses, etc.)
        for (var hi = 0; hi < (player.houses || []).length; hi++) {
            var h = player.houses[hi];
            if (h.townId !== tid) continue;
            var ht = CONFIG.HOUSING_TYPES.find(function(x) { return x.id === h.type; });
            if (ht && ht.storage) {
                total += ht.storage;
            }
        }
        // Parked vehicles (unmounted carts/wagons left in town)
        var parked = (player.parkedVehicles && player.parkedVehicles[tid]) || [];
        var vehicleCaps = { cart: 80, small_wagon: 120, wagon: 200, large_wagon: 300 };
        for (var vi = 0; vi < parked.length; vi++) {
            total += vehicleCaps[parked[vi].type] || 0;
        }
        return total;
    }

    function getTownStorageUsed(townId) {
        _sync();
        var tid = townId || player.townId;
        var stored = player.townStorage[tid];
        if (!stored) return 0;
        var total = 0;
        for (var resId in stored) {
            // v9p33river127/130: skip internal underscore-prefixed fields
            // (e.g. _foodAge cohort ledger) and defensively coerce values.
            if (resId.charAt(0) === '_') continue;
            var qty = Number(stored[resId]);
            if (!isFinite(qty) || qty <= 0) {
                if (stored[resId] !== 0 && stored[resId] != null) {
                    console.warn('[townStorage] non-finite qty for ' + resId + ' in town ' + tid + ': ' + stored[resId] + ' — zeroing.');
                    delete stored[resId];
                }
                continue;
            }
            var res = findResource(resId);
            var weight = res ? Number(res.weight || 1) : 1;
            if (!isFinite(weight) || weight <= 0) weight = 1;
            total += qty * weight;
        }
        return isFinite(total) ? total : 0;
    }

    function getEffectiveCapacity() {
        _sync();
        var carry = getCarryCapacity();
        if (player.townId) {
            carry += getTownStorageCapacity(player.townId);
        }
        return carry;
    }

    function depositToStorage(resId, qty) {
        _sync();
        qty = Number(qty);
        if (!qty || !isFinite(qty) || qty <= 0) return { success: false, message: 'Invalid quantity.' };
        qty = Math.floor(qty);
        if (resId === 'horses') return { success: false, message: 'Horses cannot be stored in a warehouse. Use the stable or sell them.' };
        if (!player.townId) return { success: false, message: 'Must be in a town to deposit.' };
        var available = player.inventory[resId] || 0;
        if (available < qty) return { success: false, message: 'Not enough in inventory.' };
        var cap = getTownStorageCapacity(player.townId);
        if (cap <= 0) return { success: false, message: 'No warehouse in this town. Build one first.' };
        var used = getTownStorageUsed(player.townId);
        var res = findResource(resId);
        var weight = res ? (res.weight || 1) : 1;
        if (used + qty * weight > cap) return { success: false, message: 'Not enough warehouse space. Build or upgrade warehouses.' };
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.deposit || 2);
        player.inventory[resId] -= qty;
        if (player.inventory[resId] <= 0) player.inventory[resId] = 0;
        if (!player.townStorage[player.townId]) player.townStorage[player.townId] = {};
        player.townStorage[player.townId][resId] = (player.townStorage[player.townId][resId] || 0) + qty;
        return { success: true, message: 'Deposited ' + qty + ' ' + (res ? res.name : resId) + '.' };
    }

    function withdrawFromStorage(resId, qty) {
        _sync();
        qty = Number(qty);
        if (!qty || !isFinite(qty) || qty <= 0) return { success: false, message: 'Invalid quantity.' };
        qty = Math.floor(qty);
        if (!player.townId) return { success: false, message: 'Must be in a town to withdraw.' };
        var stored = (player.townStorage[player.townId] || {})[resId] || 0;
        if (stored < qty) return { success: false, message: 'Not enough in storage.' };
        var res = findResource(resId);
        // Horses use slot system, not weight
        if (resId === 'horses') {
            var _totalHorses = (player.inventory.horses || 0) + (player.horses || []).length;
            var _maxHorses = (CONFIG.MAX_HORSES || 2) + (hasSkill('horse_mastery') ? 2 : 0);
            if (_totalHorses + qty > _maxHorses) {
                return { success: false, message: 'You can only have ' + _maxHorses + ' horses total. You have ' + _totalHorses + '.' };
            }
        } else {
            var weight = res ? (res.weight || 1) : 1;
            var currentWeight = getCarriedWeight();
            var maxCarry = getCarryCapacity();
            if (currentWeight + qty * weight > maxCarry) return { success: false, message: 'Too heavy to carry. Upgrade your storage container.' };
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.withdraw || 2);
        player.townStorage[player.townId][resId] -= qty;
        if (player.townStorage[player.townId][resId] <= 0) delete player.townStorage[player.townId][resId];
        player.inventory[resId] = (player.inventory[resId] || 0) + qty;
        return { success: true, message: 'Withdrew ' + qty + ' ' + (res ? res.name : resId) + '.' };
    }

    function parkVehicle(vehicleType) {
        _sync();
        if (!player.townId) return { success: false, message: 'Must be in a town.' };
        var validTypes = { cart: 80, small_wagon: 120, wagon: 200, large_wagon: 300 };
        if (!validTypes[vehicleType]) return { success: false, message: 'Invalid vehicle type.' };
        var invQty = player.inventory[vehicleType] || 0;
        if (invQty <= 0) return { success: false, message: 'You don\'t have a ' + vehicleType.replace(/_/g, ' ') + ' in your inventory.' };
        // If this is the player's mounted container, can't park it
        if (player.storageContainer === vehicleType) {
            return { success: false, message: 'You are currently using this as your storage container. Unmount it first.' };
        }
        player.inventory[vehicleType] = invQty - 1;
        if (player.inventory[vehicleType] <= 0) player.inventory[vehicleType] = 0;
        if (!player.parkedVehicles) player.parkedVehicles = {};
        if (!player.parkedVehicles[player.townId]) player.parkedVehicles[player.townId] = [];
        player.parkedVehicles[player.townId].push({ type: vehicleType, parkedDay: Engine.getDay ? Engine.getDay() : 0 });
        var cap = validTypes[vehicleType];
        var name = vehicleType.replace(/_/g, ' ');
        return { success: true, message: '🛒 Parked ' + name + ' in town (+' + cap + ' storage). ⚠️ Unguarded vehicles risk theft!' };
    }

    function unparkVehicle(vehicleType) {
        _sync();
        if (!player.townId) return { success: false, message: 'Must be in a town.' };
        var parked = (player.parkedVehicles && player.parkedVehicles[player.townId]) || [];
        var idx = -1;
        for (var i = 0; i < parked.length; i++) {
            if (parked[i].type === vehicleType) { idx = i; break; }
        }
        if (idx < 0) return { success: false, message: 'No parked ' + vehicleType.replace(/_/g, ' ') + ' in this town.' };
        // Check if town storage would overflow
        var vehicleCaps = { cart: 80, small_wagon: 120, wagon: 200, large_wagon: 300 };
        var removingCap = vehicleCaps[vehicleType] || 0;
        var currentCap = getTownStorageCapacity(player.townId);
        var currentUsed = getTownStorageUsed(player.townId);
        if (currentUsed > currentCap - removingCap) {
            return { success: false, message: 'Town storage would overflow. Withdraw goods first.' };
        }
        parked.splice(idx, 1);
        if (parked.length <= 0) delete player.parkedVehicles[player.townId];
        player.inventory[vehicleType] = (player.inventory[vehicleType] || 0) + 1;
        var name = vehicleType.replace(/_/g, ' ');
        return { success: true, message: '🛒 Retrieved ' + name + ' from town.' };
    }

    function getParkedVehicles(townId) {
        _sync();
        var tid = townId || player.townId;
        return (player.parkedVehicles && player.parkedVehicles[tid]) || [];
    }

    function tickParkedVehicleTheft() {
        _sync();
        // ~26% per year (90 days) = ~0.33% per day (1 - (1-r)^90 = 0.26 → r ≈ 0.0033)
        var dailyTheftChance = 0.0033;
        var rng = Engine.getRng ? Engine.getRng() : null;
        if (!rng) return;
        for (var tid in (player.parkedVehicles || {})) {
            var parked = player.parkedVehicles[tid];
            if (!parked || parked.length === 0) continue;
            var town = Engine.findTown(tid);
            // Safer towns have lower theft (prosperity reduces theft)
            var prosperity = town ? (town.prosperity || 50) : 50;
            var safetyMod = 1.0 - (prosperity - 50) * 0.005; // 0.75x at 100 prosperity, 1.25x at 0
            safetyMod = Math.max(0.5, Math.min(1.5, safetyMod));
            for (var vi = parked.length - 1; vi >= 0; vi--) {
                if (rng.chance(dailyTheftChance * safetyMod)) {
                    var stolen = parked[vi];
                    var name = stolen.type.replace(/_/g, ' ');
                    var townName = town ? town.name : 'unknown town';
                    parked.splice(vi, 1);
                    // Also steal some goods from town storage
                    var stolenGoods = [];
                    var ts = player.townStorage[tid];
                    if (ts) {
                        var stolenWeight = 0;
                        var maxSteal = 30 + Math.floor(rng.random() * 50);
                        for (var rk in ts) {
                            if (ts[rk] <= 0 || stolenWeight >= maxSteal) continue;
                            var sr = findResource(rk);
                            var sw = sr ? (sr.weight || 1) : 1;
                            var stealQty = Math.min(ts[rk], Math.floor((maxSteal - stolenWeight) / sw));
                            if (stealQty > 0) {
                                ts[rk] -= stealQty;
                                if (ts[rk] <= 0) delete ts[rk];
                                stolenGoods.push(stealQty + ' ' + (sr ? sr.name : rk));
                                stolenWeight += stealQty * sw;
                            }
                        }
                    }
                    var goodsMsg = stolenGoods.length > 0 ? ' Along with: ' + stolenGoods.join(', ') + '.' : '';
                    Engine.logEvent('🏴‍☠️ Your parked ' + name + ' was stolen in ' + townName + '!' + goodsMsg);
                    if (typeof UI !== 'undefined' && UI.toast) UI.toast('🏴‍☠️ Your ' + name + ' was stolen in ' + townName + '!' + goodsMsg, 'error', 'critical');
                }
            }
            if (parked.length <= 0) delete player.parkedVehicles[tid];
        }
    }

    // ── HOME STORAGE TRANSFER ──
    function getHomeStorageUsed(house) {
        _sync();
        if (!house || !house.homeStorage) return 0;
        var total = 0;
        for (var k in house.homeStorage) total += (house.homeStorage[k] || 0) * ((findResource(k) || {}).weight || 1);
        return total;
    }

    function getHomeStorageCapacity(house) {
        _sync();
        if (!house) return 0;
        var ht = CONFIG.HOUSING_TYPES.find(function(x) { return x.id === house.type; });
        var base = ht ? (ht.storage || 0) : 0;
        if ((house.addons || []).indexOf('storage_expansion') >= 0) {
            base = Math.floor(base * 1.5);
        }
        return base;
    }

    function depositToHome(houseId, resId, qty) {
        _sync();
        qty = Math.floor(Number(qty));
        if (!qty || qty <= 0) return { success: false, message: 'Invalid quantity.' };
        var house = (player.houses || []).find(function(h) { return h.id === houseId; });
        if (!house) return { success: false, message: 'House not found.' };
        if (house.townId !== player.townId) return { success: false, message: 'You must be in the same town as this property.' };
        var res = findResource(resId);
        // Block livestock from homes (except horses — homes can stable horses)
        if (res && res.category === 'livestock' && resId !== 'horses') return { success: false, message: 'Livestock cannot be stored in a home. Use a livestock building.' };
        var available = player.inventory[resId] || 0;
        if (available < qty) return { success: false, message: 'Not enough in inventory.' };
        var cap = getHomeStorageCapacity(house);
        var used = getHomeStorageUsed(house);
        var weight = res ? (res.weight || 1) : 1;
        if (used + qty * weight > cap) {
            var canFit = Math.floor((cap - used) / weight);
            if (canFit <= 0) return { success: false, message: 'Home storage is full (' + used + '/' + cap + ').' };
            return { success: false, message: 'Only room for ' + canFit + ' more. Storage: ' + used + '/' + cap + '.' };
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(1);
        player.inventory[resId] -= qty;
        if (player.inventory[resId] <= 0) player.inventory[resId] = 0;
        if (!house.homeStorage) house.homeStorage = {};
        house.homeStorage[resId] = (house.homeStorage[resId] || 0) + qty;
        return { success: true, message: 'Stored ' + qty + ' ' + (res ? res.name : resId) + ' in your home.' };
    }

    function withdrawFromHome(houseId, resId, qty) {
        _sync();
        qty = Math.floor(Number(qty));
        if (!qty || qty <= 0) return { success: false, message: 'Invalid quantity.' };
        var house = (player.houses || []).find(function(h) { return h.id === houseId; });
        if (!house) return { success: false, message: 'House not found.' };
        if (house.townId !== player.townId) return { success: false, message: 'You must be in the same town as this property.' };
        var stored = (house.homeStorage && house.homeStorage[resId]) || 0;
        if (stored < qty) return { success: false, message: 'Not enough stored.' };
        var res = findResource(resId);
        if (resId === 'horses') {
            var _thH = (player.inventory.horses || 0) + (player.horses || []).length;
            var _mxH = (CONFIG.MAX_HORSES || 2) + (hasSkill('horse_mastery') ? 2 : 0);
            if (_thH + qty > _mxH) return { success: false, message: 'You can only have ' + _mxH + ' horses total. You have ' + _thH + '.' };
        } else {
            var weight = res ? (res.weight || 1) : 1;
            if (getCarriedWeight() + qty * weight > getCarryCapacity()) return { success: false, message: 'Too heavy to carry.' };
        };
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(1);
        house.homeStorage[resId] -= qty;
        if (house.homeStorage[resId] <= 0) delete house.homeStorage[resId];
        player.inventory[resId] = (player.inventory[resId] || 0) + qty;
        return { success: true, message: 'Took ' + qty + ' ' + (res ? res.name : resId) + ' from home.' };
    }

    function stableHorseAtHome(houseId) {
        _sync();
        var house = (player.houses || []).find(function(h) { return h.id === houseId; });
        if (!house) return { success: false, message: 'House not found.' };
        if (house.townId !== player.townId) return { success: false, message: 'You must be in the same town.' };
        if (!player.horses || player.horses.length === 0) return { success: false, message: 'You have no mounted horses.' };
        var maxHorses = hasSkill('horse_mastery') ? 4 : 2;
        if (!house.horses) house.horses = [];
        if (house.horses.length >= maxHorses) return { success: false, message: 'Home can hold ' + maxHorses + ' horses (has ' + house.horses.length + ').' };
        var horse = player.horses.pop();
        house.horses.push(horse);
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(1);
        return { success: true, message: '🐴 Stabled ' + (horse.name || 'horse') + ' at home.' };
    }

    function unstableHorseFromHome(houseId, horseIdx) {
        _sync();
        var house = (player.houses || []).find(function(h) { return h.id === houseId; });
        if (!house) return { success: false, message: 'House not found.' };
        if (house.townId !== player.townId) return { success: false, message: 'You must be in the same town.' };
        if (!house.horses || house.horses.length === 0) return { success: false, message: 'No horses stabled here.' };
        var idx = Number(horseIdx) || 0;
        if (idx < 0 || idx >= house.horses.length) return { success: false, message: 'Invalid horse.' };
        var horse = house.horses.splice(idx, 1)[0];
        if (!player.horses) player.horses = [];
        player.horses.push(horse);
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(1);
        return { success: true, message: '🐴 Took ' + (horse.name || 'horse') + ' from home.' };
    }

    // ── HOUSE ADDONS ──
    function getAvailableAddons(houseId) {
        _sync();
        var house = (player.houses || []).find(function(h) { return h.id === houseId; });
        if (!house) return [];
        var hType = CONFIG.HOUSING_TYPES.find(function(ht) { return ht.id === house.type; });
        if (!hType) return [];
        var addons = CONFIG.HOUSE_ADDONS;
        if (!addons) return [];
        var existing = house.addons || [];
        var result = [];
        for (var aId in addons) {
            var addon = addons[aId];
            if (existing.indexOf(aId) >= 0) continue; // already installed
            // Skip if house already has the feature built-in
            if (addon.grants === 'hasWorkshop' && hType.hasWorkshop) continue;
            if (addon.grants === 'hasStables' && hType.hasStables) continue;
            if (addon.grants === 'hasGarden' && (hType.hasGarden || (hType.canGrow && hType.canGrow.length > 0))) continue;
            // Check house type compatibility
            if (addon.minHouseId && addon.minHouseId.indexOf(house.type) < 0) continue;
            result.push({ id: aId, name: addon.name, icon: addon.icon, desc: addon.description, goldCost: addon.goldCost, materials: addon.materials });
        }
        return result;
    }

    function installAddon(houseId, addonId) {
        _sync();
        var house = (player.houses || []).find(function(h) { return h.id === houseId; });
        if (!house) return { success: false, message: 'House not found.' };
        if (house.townId !== player.townId) return { success: false, message: 'You must be in the same town.' };
        var addon = CONFIG.HOUSE_ADDONS ? CONFIG.HOUSE_ADDONS[addonId] : null;
        if (!addon) return { success: false, message: 'Unknown addon.' };
        if (!house.addons) house.addons = [];
        if (house.addons.indexOf(addonId) >= 0) return { success: false, message: 'Already installed.' };
        if (player.gold < addon.goldCost) return { success: false, message: 'Need ' + addon.goldCost + ' gold (have ' + Math.floor(player.gold) + ').' };
        // Check materials
        if (addon.materials) {
            for (var matId in addon.materials) {
                var need = addon.materials[matId];
                var have = player.inventory[matId] || 0;
                // Also check home storage and market
                var houseHas = (house.homeStorage && house.homeStorage[matId]) ? house.homeStorage[matId] : 0;
                var town = Engine.findTown(player.townId);
                var mktHas = (town && town.market && town.market.supply) ? (town.market.supply[matId] || 0) : 0;
                if (have + houseHas + mktHas < need) {
                    var res = findResource(matId);
                    return { success: false, message: 'Need ' + need + ' ' + (res ? res.name : matId) + ' (have ' + have + ', home ' + houseHas + ', market ' + mktHas + ').' };
                }
            }
            // Deduct materials: from inventory first, then home storage, then buy from market
            for (var matId2 in addon.materials) {
                var need2 = addon.materials[matId2];
                var fromInv = Math.min(need2, player.inventory[matId2] || 0);
                if (fromInv > 0) { player.inventory[matId2] -= fromInv; need2 -= fromInv; }
                if (need2 > 0 && house.homeStorage && house.homeStorage[matId2]) {
                    var fromHome = Math.min(need2, house.homeStorage[matId2]);
                    house.homeStorage[matId2] -= fromHome; need2 -= fromHome;
                    if (house.homeStorage[matId2] <= 0) delete house.homeStorage[matId2];
                }
                if (need2 > 0) {
                    // Buy from market
                    var town2 = Engine.findTown(player.townId);
                    if (town2 && town2.market && town2.market.supply) {
                        var bought = Math.min(need2, town2.market.supply[matId2] || 0);
                        if (bought > 0) {
                            var mktPrice = (town2.market.prices && town2.market.prices[matId2]) || 10;
                            player.gold -= bought * mktPrice;
                            town2.market.supply[matId2] = (town2.market.supply[matId2] || 0) - bought;
                            need2 -= bought;
                        }
                    }
                }
            }
        }
        player.gold -= addon.goldCost;
        house.addons.push(addonId);
        // Initialize garden manure level when garden addon is installed
        if (addonId === 'garden') {
            house.gardenManure = 4;
            house._lastManureDecayDay = typeof Engine !== 'undefined' && Engine.getDay ? Engine.getDay() : 0;
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.build || 3);
        Engine.logEvent(player.fullName + ' installed ' + addon.icon + ' ' + addon.name + ' in their ' + house.type + '.');

        if (player.storyMode && player.storyMode.active && typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('install_addon', { addon: addonId });
        }

        return { success: true, message: addon.icon + ' ' + addon.name + ' installed!' };
    }

    function houseHasAddon(houseId, addonId) {
        _sync();
        var house = (player.houses || []).find(function(h) { return h.id === houseId; });
        if (!house) return false;
        return (house.addons || []).indexOf(addonId) >= 0;
    }

    function getHouseEffectiveStorage(house) {
        _sync();
        var hType = CONFIG.HOUSING_TYPES.find(function(ht) { return ht.id === house.type; });
        var base = hType ? (hType.storage || 0) : 0;
        if ((house.addons || []).indexOf('storage_expansion') >= 0) {
            base = Math.floor(base * 1.5);
        }
        return base;
    }

    // ── BUILDING STORAGE HELPERS ──
    // Get all resource ids a building type can consume (across all available products)
    function getBuildingConsumedGoods(bt) {
        _sync();
        var goods = {};
        if (bt.consumes) {
            for (var k in bt.consumes) goods[k] = true;
        }
        if (bt.availableProducts) {
            for (var pk in bt.availableProducts) {
                var ap = bt.availableProducts[pk];
                if (ap.consumes) {
                    for (var ak in ap.consumes) goods[ak] = true;
                }
            }
        }
        return goods;
    }

    function toggleBuildingInputOnly(buildingId) {
        _sync();
        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) return { success: false, message: 'Building not found.' };
        bld.inputOnly = !bld.inputOnly;
        return { success: true, message: bld.inputOnly ? 'Storage restricted to consumed goods only.' : 'Storage now accepts any goods.' };
    }

    // ── BUILDING STORAGE TRANSFER ──
    function depositToBuilding(buildingId, resId, qty) {
        _sync();
        qty = Math.floor(Number(qty));
        if (!qty || qty <= 0) return { success: false, message: 'Invalid quantity.' };
        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) return { success: false, message: 'Building not found.' };
        if (bld.townId !== player.townId) return { success: false, message: 'You must be in the same town as this building.' };
        var res = findResource(resId);
        // Block livestock except to livestock buildings, horses except to cavalry/stable buildings
        var bt = null;
        for (var key in BUILDING_TYPES) { if (BUILDING_TYPES[key].id === bld.type) { bt = BUILDING_TYPES[key]; break; } }
        if (res && res.category === 'livestock') {
            var isLivestockBld = bt && (bt.category === 'farming' || bt.livestockCapacity || (bt.id && bt.id.indexOf('livestock') >= 0));
            if (!isLivestockBld) return { success: false, message: 'Livestock can only be stored in livestock/farm buildings.' };
        }
        if (resId === 'horses') {
            var isHorseBld = bt && (bt.cavalryCapacity || bt.id === 'horse_market' || bt.id === 'stable' || (bt.id && bt.id.indexOf('horse') >= 0) || (bt.id && bt.id.indexOf('cavalry') >= 0));
            if (!isHorseBld) return { success: false, message: 'Horses can only be stored in stables, horse markets, or cavalry buildings.' };
        }
        // Input-only filter: if enabled, only accept goods this building consumes
        if (bld.inputOnly !== false && bt && bt.produces) {
            var consumed = getBuildingConsumedGoods(bt);
            var directConsumed = bt.consumes && bt.consumes[resId];
            if (!consumed[resId] && !directConsumed) {
                return { success: false, message: 'This building only accepts goods it uses. Uncheck "Only accept consumed goods" to store other items.' };
            }
        }
        var available = player.inventory[resId] || 0;
        // Also check town storage for buildings in the same town
        var townStoreAvail = 0;
        if (bld.townId && player.townStorage && player.townStorage[bld.townId]) {
            townStoreAvail = player.townStorage[bld.townId][resId] || 0;
        }
        var totalAvailable = available + townStoreAvail;
        if (totalAvailable < qty) return { success: false, message: 'Not enough. Inventory: ' + available + ', Town storage: ' + townStoreAvail + '.' };
        var bldCap = bt ? Player._bldStorageCap(bt.storage, bld.level) : 0;
        if (bldCap > 0) {
            // Input capacity is independent of output — only count non-output items
            var _dOutSet = {};
            if (bt && bt.produces) _dOutSet[bt.produces] = true;
            if (bt && bt.canProduce) { for (var _di = 0; _di < bt.canProduce.length; _di++) _dOutSet[bt.canProduce[_di]] = true; }
            var inputUsed = 0;
            if (bld.inventory) { for (var bk in bld.inventory) { if (!_dOutSet[bk]) inputUsed += (bld.inventory[bk] || 0) * ((findResource(bk) || {}).weight || 1); } }
            var weight = res ? (res.weight || 1) : 1;
            // Smart ratio limit: considers all current inputs and cycle balance
            var _depSmartMax = Player._smartInputLimit(bt, bld, resId);
            var _depRatioMax = _depSmartMax >= 0 ? _depSmartMax : Infinity;
            var effectiveQty = Math.min(qty, _depRatioMax);
            if (effectiveQty <= 0 && _depRatioMax < Infinity) {
                return { success: false, message: 'Building already has enough ' + (res ? res.name : resId) + ' for its input ratio. Deposit other inputs first.' };
            }
            if (effectiveQty < qty) qty = effectiveQty;
            if (inputUsed + qty * weight > bldCap) {
                var canFit = Math.floor((bldCap - inputUsed) / weight);
                if (canFit <= 0) return { success: false, message: 'Building input storage full (' + Math.round(inputUsed) + '/' + bldCap + ').' };
                return { success: false, message: 'Only room for ' + canFit + ' more. Input storage: ' + Math.round(inputUsed) + '/' + bldCap + '.' };
            }
        }
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(1);
        // Draw from personal inventory first, then town storage
        var fromInv = Math.min(qty, available);
        var fromTown = qty - fromInv;
        if (fromInv > 0) {
            player.inventory[resId] = (player.inventory[resId] || 0) - fromInv;
            if (player.inventory[resId] <= 0) player.inventory[resId] = 0;
        }
        if (fromTown > 0 && player.townStorage && player.townStorage[bld.townId]) {
            player.townStorage[bld.townId][resId] = (player.townStorage[bld.townId][resId] || 0) - fromTown;
            if (player.townStorage[bld.townId][resId] <= 0) delete player.townStorage[bld.townId][resId];
        }
        if (!bld.inventory) bld.inventory = {};
        bld.inventory[resId] = (bld.inventory[resId] || 0) + qty;
        var sourceNote = fromTown > 0 ? ' (' + fromInv + ' from inventory, ' + fromTown + ' from town storage)' : '';
        return { success: true, message: 'Stored ' + qty + ' ' + (res ? res.name : resId) + ' in ' + (bt ? bt.name : 'building') + '.' + sourceNote };
    }

    function withdrawFromBuilding(buildingId, resId, qty) {
        _sync();
        qty = Math.floor(Number(qty));
        if (!qty || qty <= 0) return { success: false, message: 'Invalid quantity.' };
        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) return { success: false, message: 'Building not found.' };
        if (bld.townId !== player.townId) return { success: false, message: 'You must be in the same town.' };
        var stored = (bld.inventory && bld.inventory[resId]) || 0;
        if (stored < qty) return { success: false, message: 'Not enough stored.' };
        var res = findResource(resId);
        if (resId === 'horses') {
            var _thH2 = (player.inventory.horses || 0) + (player.horses || []).length;
            var _mxH2 = (CONFIG.MAX_HORSES || 2) + (hasSkill('horse_mastery') ? 2 : 0);
            if (_thH2 + qty > _mxH2) return { success: false, message: 'You can only have ' + _mxH2 + ' horses total. You have ' + _thH2 + '.' };
        } else {
            var weight = res ? (res.weight || 1) : 1;
            if (getCarriedWeight() + qty * weight > getCarryCapacity()) return { success: false, message: 'Too heavy to carry.' };
        };
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(1);
        bld.inventory[resId] -= qty;
        if (bld.inventory[resId] <= 0) delete bld.inventory[resId];
        player.inventory[resId] = (player.inventory[resId] || 0) + qty;
        var bt = null;
        for (var key in BUILDING_TYPES) { if (BUILDING_TYPES[key].id === bld.type) { bt = BUILDING_TYPES[key]; break; } }
        return { success: true, message: 'Took ' + qty + ' ' + (res ? res.name : resId) + ' from ' + (bt ? bt.name : 'building') + '.' };
    }

    function buyContainer(containerId) {
        _sync();
        var container = CONFIG.STORAGE_CONTAINERS[containerId];
        if (!container) return { success: false, message: 'Unknown container.' };

        // v9p33river193: backpack/cart/wagons must be CRAFTED at a home
        // workshop in the player's current town. Carts/wagons/backpacks can
        // also be bought as goods directly from canvas workshops or other
        // markets, but the in-place craft-from-materials path is gated to
        // home workshop. Exception: nothing in player.inventory of the
        // matching good type? Then they need a workshop. If they DO have one
        // in inventory (bought from market or canvas workshop), allow it.
        var inventoryGood = (player.inventory && player.inventory[containerId]) || 0;
        if (inventoryGood <= 0) {
            var _bcHouse = (typeof getHouseInTown === 'function') ? getHouseInTown(player.townId) : null;
            var _bcHt = _bcHouse ? CONFIG.HOUSING_TYPES.find(function(h) { return h.id === _bcHouse.type; }) : null;
            var _bcWorkshop = (_bcHt && _bcHt.hasWorkshop) || (_bcHouse && _bcHouse.addons && _bcHouse.addons.indexOf('workshop') >= 0);
            if (!_bcWorkshop) {
                return { success: false, message: 'You need a home with a workshop in this town to craft a ' + container.name + '. (Or buy a ready-made one from the market.)' };
            }
        }

        // Check horse requirements
        var horsesNeeded = container.horsesRequired || 0;
        if (player.horses.length < horsesNeeded) {
            return { success: false, message: 'A ' + container.name + ' requires ' + horsesNeeded + ' horse(s) to pull. You have ' + player.horses.length + '.' };
        }

        var refund = 0;
        if (player.storageContainer) {
            var old = CONFIG.STORAGE_CONTAINERS[player.storageContainer];
            if (old) {
                if (container.capacityMult <= old.capacityMult) {
                    return { success: false, message: 'You already have a better or equal container.' };
                }
                refund = Math.floor(old.cost * 0.5);
            }
        }

        // Check material requirements
        var town = Engine.findTown(player.townId);
        var materialMarketCost = 0;
        if (container.materials) {
            if (!town) return { success: false, message: 'Materials not available here — you must be in a town.' };
            for (var matId in container.materials) {
                if (!container.materials.hasOwnProperty(matId)) continue;
                var qty = container.materials[matId];
                var playerHas = player.inventory[matId] || 0;
                var townHas = (town.market && town.market.supply[matId]) || 0;
                if (playerHas + townHas < qty) {
                    var res = findResource(matId);
                    var resName = res ? res.name : matId;
                    return { success: false, message: 'Materials not available here. Need ' + qty + ' ' + resName + ', have ' + playerHas + ' (inventory) + ' + townHas + ' (market).' };
                }
            }
        }

        var laborCost = container.cost - refund;
        if (laborCost < 0) laborCost = 0;

        // v9p33river193: shortcut path — player owns a ready-made backpack/
        // cart/wagon as a good in inventory (bought from market or canvas
        // workshop). Skip material + labor costs, just consume one unit and
        // equip it. This is the path that does NOT require a home workshop.
        if (inventoryGood > 0) {
            player.inventory[containerId] = inventoryGood - 1;
            if (player.inventory[containerId] <= 0) delete player.inventory[containerId];
            if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.buy_container || 2);
            // v9p33river310: previously refunded 50% of the old container's
            // cost as gold, silently destroying the old cart/wagon. Return
            // the old vehicle to inventory instead so the player can keep
            // multiple containers and swap between them. Backpack is worn
            // and tracked separately, so we still skip it here.
            var _oldId = player.storageContainer;
            var _oldNm = _oldId ? CONFIG.STORAGE_CONTAINERS[_oldId].name : 'nothing';
            if (containerId === 'backpack') player._backpack = true;
            else if (player.storageContainer === 'backpack') player._backpack = true;
            player.storageContainer = containerId;
            var _msg = 'Equipped ' + container.icon + ' ' + container.name + ' (from inventory)!';
            if (_oldId && _oldId !== 'backpack' && _oldId !== containerId) {
                player.inventory[_oldId] = (player.inventory[_oldId] || 0) + 1;
                _msg += ' Previous ' + _oldNm + ' returned to inventory.';
            }
            Engine.logEvent(_msg);
            return { success: true, message: _msg };
        }

        // Calculate total cost: labor gold + market price of materials bought from market
        var totalGoldCost = laborCost;
        if (container.materials && town) {
            for (var matId in container.materials) {
                if (!container.materials.hasOwnProperty(matId)) continue;
                var qty = container.materials[matId];
                var fromInv = Math.min(player.inventory[matId] || 0, qty);
                var fromMarket = qty - fromInv;
                if (fromMarket > 0) {
                    var price = (town.market && town.market.prices[matId]) || ((findResource(matId) || {}).basePrice || 1);
                    materialMarketCost += fromMarket * price;
                }
            }
        }
        totalGoldCost += materialMarketCost;

        if (player.gold < totalGoldCost) return { success: false, message: 'Not enough gold. Need ' + totalGoldCost + 'g (' + laborCost + 'g labor + ' + materialMarketCost + 'g materials).' };

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.buy_container || 2);

        // Consume materials from inventory first, then market
        if (container.materials && town) {
            for (var matId in container.materials) {
                if (!container.materials.hasOwnProperty(matId)) continue;
                var qty = container.materials[matId];
                var remaining = qty;
                var fromInv = Math.min(player.inventory[matId] || 0, remaining);
                if (fromInv > 0) {
                    player.inventory[matId] -= fromInv;
                    if (player.inventory[matId] <= 0) delete player.inventory[matId];
                    remaining -= fromInv;
                }
                if (remaining > 0) {
                    town.market.supply[matId] = (town.market.supply[matId] || 0) - remaining;
                }
            }
        }

        player.gold -= totalGoldCost;
        player.stats.totalGoldSpent += totalGoldCost;
        // v9p33river310: same return-to-inventory fix as the inventory-good
        // path above — preserve the player's previous vehicle instead of
        // silently destroying it.
        var oldId = player.storageContainer;
        var oldName = oldId ? CONFIG.STORAGE_CONTAINERS[oldId].name : 'nothing';
        if (containerId === 'backpack') {
            player._backpack = true;
        } else if (player.storageContainer === 'backpack') {
            player._backpack = true;
        }
        player.storageContainer = containerId;

        var msg = 'Bought ' + container.icon + ' ' + container.name + '!';
        if (oldId && oldId !== 'backpack' && oldId !== containerId) {
            player.inventory[oldId] = (player.inventory[oldId] || 0) + 1;
            msg += ' Previous ' + oldName + ' returned to inventory.';
        }
        if (materialMarketCost > 0) msg += ' Materials from market: ' + materialMarketCost + 'g.';
        Engine.logEvent(msg);
        return { success: true, message: msg };
    }

    function mountContainer(containerId) {
        _sync();
        var container = CONFIG.STORAGE_CONTAINERS[containerId];
        if (!container) return { success: false, message: 'Unknown container type.' };

        // Check inventory for this container type
        var held = player.inventory[containerId] || 0;
        if (held <= 0) return { success: false, message: 'No ' + container.name + ' in inventory.' };

        // Check horse requirements
        var horsesNeeded = container.horsesRequired || 0;
        if (player.horses.length < horsesNeeded) {
            return { success: false, message: 'A ' + container.name + ' requires ' + horsesNeeded + ' mounted horse(s). You have ' + player.horses.length + '.' };
        }

        // If current container is backpack, save it (backpack is worn under vehicle)
        if (player.storageContainer === 'backpack') {
            player._backpack = true;
        } else if (player.storageContainer && player.storageContainer !== 'backpack') {
            // Switching vehicles — put old vehicle in inventory
            var oldC = CONFIG.STORAGE_CONTAINERS[player.storageContainer];
            if (oldC && container.capacityMult <= oldC.capacityMult) {
                return { success: false, message: 'You already have a better or equal vehicle equipped.' };
            }
            player.inventory[player.storageContainer] = (player.inventory[player.storageContainer] || 0) + 1;
            Engine.logEvent('Stored your ' + oldC.name + ' in inventory.');
        }

        player.inventory[containerId] -= 1;
        if (player.inventory[containerId] <= 0) delete player.inventory[containerId];
        player.storageContainer = containerId;

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.buy_container || 2);
        var msg = container.icon + ' Equipped ' + container.name + ' from inventory!';
        Engine.logEvent(msg);
        return { success: true, message: msg };
    }

    function dismountContainer() {
        _sync();
        if (!player.storageContainer) return { success: false, message: 'No container equipped.' };
        var container = CONFIG.STORAGE_CONTAINERS[player.storageContainer];
        if (!container) return { success: false, message: 'Unknown container.' };

        // Can't dismount backpack (it's always worn, not a vehicle)
        if (player.storageContainer === 'backpack') {
            return { success: false, message: 'Your backpack is worn, not a vehicle. Sell it from a shop instead.' };
        }

        // Calculate capacity without this vehicle but keeping backpack if owned
        var currentWeight = getCarriedWeight();
        var base = CONFIG.PLAYER_BASE_CARRY || 20;
        if (hasSkill('pack_mule')) base += 20;
        if (hasSkill('beast_of_burden')) base += 20;
        if (hasSkill('iron_back')) base += 30;
        var horseCarry = CONFIG.HORSE_CARRY_BONUS || 40;
        if (hasSkill('horse_mastery')) horseCarry = Math.floor(horseCarry * 1.25);
        var horseBonus = player.horses.length * horseCarry;
        // Fall back to backpack if player has one
        var fallbackContainer = player._backpack ? CONFIG.STORAGE_CONTAINERS['backpack'] : null;
        var newCapacity = fallbackContainer ? (base * fallbackContainer.capacityMult + horseBonus) : (base + horseBonus);
        if (currentWeight > newCapacity) {
            return { success: false, message: 'Too much cargo. Lighten your load first (carrying ' + Math.round(currentWeight) + ', capacity without vehicle: ' + newCapacity + ').' };
        }

        var oldId = player.storageContainer;
        player.inventory[oldId] = (player.inventory[oldId] || 0) + 1;
        // Restore backpack if player had one
        player.storageContainer = player._backpack ? 'backpack' : null;

        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(CONFIG.ACTION_TICK_COSTS.buy_container || 2);
        var msg = container.icon + ' Dismounted ' + container.name + ' to inventory.';
        if (player._backpack) msg += ' Backpack re-equipped.';
        Engine.logEvent(msg);
        return { success: true, message: msg };
    }

    function tickStorageTheft() {
        _sync();
        if (!player.storageContainer) return;
        if (!player.traveling) return;
        var container = CONFIG.STORAGE_CONTAINERS[player.storageContainer];
        if (!container || container.theftRisk <= 0) return;
        // Reduce theft risk based on guards/security in the town we left
        var risk = container.theftRisk;
        // If player has weapon equipped, thieves are more cautious even when away
        if (player.weapon) risk *= 0.5;
        if (player.armor) risk *= 0.6;
        // Security skill reduces theft
        if (hasSkill && hasSkill('cheap_security')) risk *= 0.6;
        if (hasSkill && hasSkill('shadow_dealings')) risk *= 0.7;
        // Notoriety actually helps here — feared merchants get robbed less
        if (player.notoriety > 30) risk *= 0.7;
        if (player.notoriety > 60) risk *= 0.5;
        if (Math.random() < risk) {
            var keys = Object.keys(player.inventory).filter(function(k) { return (player.inventory[k] || 0) > 0; });
            if (keys.length === 0) return;
            var targetRes = keys[Math.floor(Math.random() * keys.length)];
            var qty = player.inventory[targetRes] || 0;
            // Only lose 3-8% — forgiving
            var stolen = Math.max(1, Math.floor(qty * (0.03 + Math.random() * 0.05)));
            stolen = Math.min(stolen, qty);
            player.inventory[targetRes] -= stolen;
            var res = findResource(targetRes);
            Engine.logEvent('\u26A0\uFE0F Thieves raided your ' + container.name + '! Lost ' + stolen + ' ' + (res ? res.name : targetRes) + '.');
        }
    }

    function tickLeftCartTheft() {
        _sync();
        if (!player.leftCart) return;
        var lc = player.leftCart;
        var goodKeys = Object.keys(lc.goods).filter(function(k) { return (lc.goods[k] || 0) > 0; });
        if (goodKeys.length === 0) return;
        // High theft chance per day for unattended goods (~15% per day)
        // v9p33river286: Engine.getRng() returns the RNG OBJECT (not a number),
        // so the previous `rng < 0.15` and `rng * length` operations were always
        // false / NaN — theft never triggered, and would have picked an
        // undefined resource if it had. Use rng.random() consistently.
        var _rngObj = Engine.getRng ? Engine.getRng() : null;
        var _rand = function() { return (_rngObj && typeof _rngObj.random === 'function') ? _rngObj.random() : Math.random(); };
        if (_rand() < 0.15) {
            var targetRes = goodKeys[Math.floor(_rand() * goodKeys.length)];
            var qty = lc.goods[targetRes];
            // Lose 20-50% of one resource type
            var stolen = Math.max(1, Math.floor(qty * (0.2 + _rand() * 0.3)));
            stolen = Math.min(stolen, qty);
            lc.goods[targetRes] -= stolen;
            if (lc.goods[targetRes] <= 0) delete lc.goods[targetRes];
            var res = findResource(targetRes);
            var cartContainer = CONFIG.STORAGE_CONTAINERS[lc.container];
            var cartName = cartContainer ? cartContainer.name : 'Cart';
            Engine.logEvent('⚠️ Thieves raided your unattended ' + cartName + '! Lost ' + stolen + ' ' + (res ? res.name : targetRes) + '.');
        }
    }

    function tickWorkerTheft() {
        _sync();
        // 0.05% daily chance per worker — extremely rare
        // Reduced by: player being in town, worker skill level, security upgrades
        var playerTownId = player.townId;
        for (var i = 0; i < player.buildings.length; i++) {
            var bld = player.buildings[i];
            if (!bld.active || !bld.workers || bld.workers.length === 0) continue;
            var stored = player.townStorage[bld.townId];
            if (!stored) continue;
            var storageKeys = Object.keys(stored).filter(function(k) { return (stored[k] || 0) > 0; });
            if (storageKeys.length === 0) continue;
            for (var w = 0; w < bld.workers.length; w++) {
                var theftChance = 0.0005; // 0.05% base — very rare
                var worker = Engine.findPerson ? Engine.findPerson(bld.workers[w]) : null;
                // Player presence in town greatly reduces theft
                if (playerTownId === bld.townId) theftChance *= 0.1;
                // Higher skill workers are less likely to steal
                if (worker && worker.skillLevel) {
                    if (worker.skillLevel === 'skilled') theftChance *= 0.5;
                    else if (worker.skillLevel === 'expert') theftChance *= 0.2;
                    else if (worker.skillLevel === 'master') theftChance *= 0.05;
                }
                // Warehouse security reduces theft
                if (bld.security) {
                    if (bld.security === 'iron_door') theftChance *= 0.6;
                    else if (bld.security === 'guard_post') theftChance *= 0.3;
                    else if (bld.security === 'vault_room') theftChance *= 0.15;
                    else if (bld.security === 'trapped_locks') theftChance *= 0.05;
                }
                if (Math.random() < theftChance) {
                    var targetRes = storageKeys[Math.floor(Math.random() * storageKeys.length)];
                    var maxSteal = Math.min(stored[targetRes], 1 + Math.floor(Math.random() * 1));
                    if (maxSteal > 0) {
                        stored[targetRes] -= maxSteal;
                        if (stored[targetRes] <= 0) delete stored[targetRes];
                        var res = findResource(targetRes);
                        var workerName = worker ? (worker.firstName || 'A worker') : 'A worker';
                        Engine.logEvent('\uD83D\uDD75\uFE0F ' + workerName + ' stole ' + maxSteal + ' ' + (res ? res.name : targetRes) + ' from your warehouse!');
                    }
                }
            }
        }
    }

    /** Deduct qty of resourceId from carried inventory first, then town storage. */
    function deductGoodsFromPools(resourceId, qty) {
        _sync();
        var fromCarried = Math.min(qty, player.inventory[resourceId] || 0);
        var fromStorage = qty - fromCarried;
        player.inventory[resourceId] = (player.inventory[resourceId] || 0) - fromCarried;
        if (fromStorage > 0 && player.townId && player.townStorage[player.townId]) {
            player.townStorage[player.townId][resourceId] = (player.townStorage[player.townId][resourceId] || 0) - fromStorage;
            if (player.townStorage[player.townId][resourceId] <= 0) delete player.townStorage[player.townId][resourceId];
        }
    }

    /**
     * Check if the player has a military goods exemption for a given kingdom.
     * Returns true if player is:
     *  - Sided with this kingdom in an active war, OR
     *  - Minor Noble (rank 4+) in this kingdom
     * Military exemption allows possessing, selling, and producing banned
     * military goods and horses for/in that kingdom without penalty.
     */
    function hasMilitaryExemption(kingdomId) {
        _sync();
        if (!kingdomId) return false;
        // Nobility: Minor Noble (4+) in this kingdom
        if (player.socialRank && (player.socialRank[kingdomId] || 0) >= 4) return true;
        // War allegiance: sided with this kingdom
        if (player.warAllegiances) {
            var activeWars = (typeof Engine !== 'undefined' && Engine.getActiveWars) ? Engine.getActiveWars() : {};
            for (var wId in player.warAllegiances) {
                var al = player.warAllegiances[wId];
                if (al.side === kingdomId) {
                    var w = activeWars[wId];
                    if (w && (w.kingdomA === kingdomId || w.kingdomB === kingdomId)) return true;
                }
            }
        }
        return false;
    }

    function _isMilitaryOrHorse(resourceId) {
        _sync();
        var res = findResource(resourceId);
        if (!res) return false;
        return res.category === 'military' || resourceId === 'horses' || resourceId === 'saddles';
    }

    function checkNeutralSalesImbalance(warId, alleg, war) {
        _sync();
        const salesA = alleg.salesA || 0;
        const salesB = alleg.salesB || 0;
        if (salesA === 0 && salesB === 0) return;

        // Check for war profiteer supreme achievement (sold to both sides)
        if (salesA > 0 && salesB > 0) {
            unlockAchievement('war_profiteer_supreme');
        }

        const max = Math.max(salesA, salesB);
        const min = Math.min(salesA, salesB);
        if (min === 0) return;
        const ratio = max / min;

        // Determine disadvantaged kingdom
        const disadvantagedId = salesA > salesB ? war.kingdomB : war.kingdomA;
        const disadvantagedK = Engine.findKingdom(disadvantagedId);
        if (!disadvantagedK) return;

        if (ratio >= 10) {
            // Full asset seizure in their territory + reputation drops to 0
            if (!alleg._penaltyApplied10) {
                alleg._penaltyApplied10 = true;
                const seizedBuildings = player.buildings.filter(b => {
                    const town = Engine.findTown(b.townId);
                    return town && town.kingdomId === disadvantagedId;
                });
                for (const bld of seizedBuildings) {
                    bld.active = false;
                    const town = Engine.findTown(bld.townId);
                    if (town) {
                        const idx = town.buildings.findIndex(b => b.ownerId === 'player' && b.type === bld.type);
                        if (idx !== -1) town.buildings[idx].ownerId = null;
                    }
                }
                player.buildings = player.buildings.filter(b => b.active);
                player.reputation[disadvantagedId] = 0;
                Engine.logEvent(`${disadvantagedK.name} seizes all your assets for supplying their enemy!`);
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast(`💀 ${disadvantagedK.name} has seized all your assets!`, 'danger', 'critical');
                }
            }
        } else if (ratio >= 5) {
            // Seize one random building
            if (!alleg._penaltyApplied5) {
                alleg._penaltyApplied5 = true;
                const targetBlds = player.buildings.filter(b => {
                    const town = Engine.findTown(b.townId);
                    return town && town.kingdomId === disadvantagedId;
                });
                if (targetBlds.length > 0) {
                    const bld = targetBlds[0];
                    bld.active = false;
                    const town = Engine.findTown(bld.townId);
                    if (town) {
                        const idx = town.buildings.findIndex(b => b.ownerId === 'player' && b.type === bld.type);
                        if (idx !== -1) town.buildings[idx].ownerId = null;
                    }
                    player.buildings = player.buildings.filter(b => b.active);
                    Engine.logEvent(`${disadvantagedK.name} seizes one of your buildings!`);
                    if (typeof UI !== 'undefined' && UI.toast) {
                        UI.toast(`⚠️ ${disadvantagedK.name} seized a building!`, 'warning', 'critical');
                    }
                }
            }
        } else if (ratio >= 3) {
            // Extra 10% tax — tracked in alleg
            if (!alleg._penaltyApplied3) {
                alleg._penaltyApplied3 = true;
                Engine.logEvent(`${disadvantagedK.name} imposes extra taxes on your trades!`);
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast(`⚠️ ${disadvantagedK.name} added 10% extra tax on your trades.`, 'warning', 'military');
                }
            }
        } else if (ratio >= 2) {
            // Diplomatic warning
            if (!alleg._warningGiven) {
                alleg._warningGiven = true;
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast(`📜 ${disadvantagedK.name} warns you about your lopsided war trade!`, 'warning', 'military');
                }
            }
        }
    }

    function donateToKingdom(kingdomId, increments) {
        _sync();
        increments = Math.max(1, Math.floor(increments || 1));
        var cost = increments * 500;
        if (player.gold < cost) return { success: false, message: 'Not enough gold. Need ' + cost + 'g.' };
        var kingdom = Engine.getKingdom(kingdomId);
        if (!kingdom) return { success: false, message: 'Kingdom not found.' };
        player.gold -= cost;
        kingdom.gold = (kingdom.gold || 0) + cost;
        // Diminishing returns: each donation in 30 days gives 25% less
        if (!player._donationTracker) player._donationTracker = {};
        if (!player._donationTracker[kingdomId]) player._donationTracker[kingdomId] = { count: 0, resetDay: 0 };
        var dt = player._donationTracker[kingdomId];
        var day = Engine.getDay();
        if (day - dt.resetDay > 30) { dt.count = 0; dt.resetDay = day; }
        var diminish = Math.pow(0.75, dt.count);
        var repGain = Math.max(0.5, Math.round(increments * diminish * 100) / 100);
        repGain = Math.min(repGain, 8); // Cap at +8 max per donation
        dt.count++;
        modifyKingdomReputation(kingdomId, repGain);
        Engine.logEvent('Donated ' + cost + 'g to ' + kingdom.name + '. Reputation +' + repGain.toFixed(1) + '.');
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('💰 Donated ' + cost + 'g to ' + kingdom.name + '! Rep +' + repGain.toFixed(1), 'success');
        }
        // Notify story mode
        if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('donate_gold', { kingdomId: kingdomId, amount: cost });
        }
        return { success: true, message: 'Donated ' + cost + 'g. Reputation +' + repGain.toFixed(1) + '.' };
    }

    function setWarAllegiance(warId, side) {
        _sync();
        if (!player.warAllegiances) player.warAllegiances = {};
        const activeWars = Engine.getActiveWars ? Engine.getActiveWars() : {};
        const war = activeWars[warId];
        if (!war) return;

        // Handle changing allegiance — allowed for non-nobles, with penalties
        if (player.warAllegiances[warId] && player.warAllegiances[warId].side !== 'neutral' && player.warAllegiances[warId].side) {
            var _oldSide = player.warAllegiances[warId].side;
            // Nobles cannot change allegiance
            var _oldK = Engine.findKingdom(_oldSide);
            if (player.socialRank && player.socialRank[_oldSide] >= 4) {
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('As nobility of ' + (_oldK ? _oldK.name : 'that kingdom') + ', you cannot change allegiance.', 'error');
                return;
            }

            // Apply switching penalties
            // -20 kingdom reputation from the side you change from
            player.reputation[_oldSide] = Math.max(0, (player.reputation[_oldSide] || 50) - 20);
            // -10 relationship with their king
            if (_oldK && _oldK.king) modifyRelationship(_oldK.king, -10);
            // -5 relationship with all their nobles
            var _oldPeople = Engine.getWorld ? Engine.getWorld().people : [];
            if (_oldPeople) {
                for (var _opi = 0; _opi < _oldPeople.length; _opi++) {
                    var _op = _oldPeople[_opi];
                    if (!_op.alive || _op.kingdomId !== _oldSide) continue;
                    var _opRank = (_op.socialRank && _op.socialRank[_oldSide]) || 0;
                    if (_opRank >= 4) modifyRelationship(_op.id, -5);
                }
            }

            // If switching to neutral, -10 rep from BOTH kingdoms
            if (side === 'neutral') {
                var _otherSide = _oldSide === war.kingdomA ? war.kingdomB : war.kingdomA;
                player.reputation[_otherSide] = Math.max(0, (player.reputation[_otherSide] || 50) - 10);
                player.reputation[_oldSide] = Math.max(0, (player.reputation[_oldSide] || 50) - 10); // additional -10
            }

            // Restore saved rank from Enemy status before re-applying
            if (player._warSavedRanks) {
                var _oldEnemy = _oldSide === war.kingdomA ? war.kingdomB : war.kingdomA;
                if (player._warSavedRanks[_oldEnemy] != null && player.socialRank[_oldEnemy] === -1) {
                    player.socialRank[_oldEnemy] = player._warSavedRanks[_oldEnemy];
                    delete player._warSavedRanks[_oldEnemy];
                }
            }

            Engine.logEvent('⚠️ You changed allegiance from ' + (_oldK ? _oldK.name : _oldSide) + '! Severe reputation penalties applied.');
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚠️ Allegiance changed! -20 rep with former ally, relationship penalties applied.', 'warning');

            // Clear old allegiance — will be set fresh below
            delete player.warAllegiances[warId];
        }

        var enemySide = null;
        if (side !== 'neutral') {
            enemySide = (side === war.kingdomA) ? war.kingdomB : war.kingdomA;
        }

        // Nobility check: must side with own kingdom or be downgraded
        if (side !== 'neutral' && enemySide) {
            var playerRankInEnemy = player.socialRank[enemySide] || 0;
            if (playerRankInEnemy >= 4) {
                // Player is noble in the enemy kingdom — they must side with that kingdom, or be downgraded
                var playerRankInChosen = player.socialRank[side] || 0;
                if (playerRankInChosen < 4) {
                    // They're choosing against the kingdom they're noble in — downgrade to guildmaster
                    var oldRank = CONFIG.SOCIAL_RANKS[playerRankInEnemy] ? CONFIG.SOCIAL_RANKS[playerRankInEnemy].name : 'Noble';
                    player.socialRank[enemySide] = 3; // guildmaster
                    delete player.rankSince[enemySide];
                    Engine.logEvent('⚠️ Your ' + oldRank + ' rank in the enemy kingdom has been stripped — demoted to Guildmaster for siding against them!');
                    if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚠️ Demoted to Guildmaster in enemy kingdom for siding against them!', 'warning');
                }
            }
        }

        player.warAllegiances[warId] = {
            side: side,
            declaredDay: Engine.getDay(),
            salesA: 0,
            salesB: 0,
            militarySalesTotal: 0, // tracks total military goods + horses sold to allied side
            strengthAtDeclaration: war.strengthAtStart ? Object.assign({}, war.strengthAtStart) : {},
        };

        if (side === 'neutral') {
            Engine.logEvent('You chose to remain neutral in the war.');
            if (typeof UI !== 'undefined' && UI.toast) {
                UI.toast('🕊️ You chose neutrality.', 'info');
            }
        } else {
            var chosenK = Engine.findKingdom(side);
            var enemyK = enemySide ? Engine.findKingdom(enemySide) : null;

            // Immediate +2 kingdom reputation with chosen side (declaration only; +3 more from active participation)
            player.reputation[side] = Math.min(100, (player.reputation[side] || 50) + 2);

            // Immediate -5 kingdom reputation with enemy
            if (enemySide) {
                player.reputation[enemySide] = Math.max(0, (player.reputation[enemySide] || 50) - 5);
            }

            // -5 relationship with enemy king and all enemy nobles
            if (enemyK) {
                if (enemyK.king) modifyRelationship(enemyK.king, -5);
                var enemyPeople = Engine.getWorld ? Engine.getWorld().people : [];
                if (enemyPeople) {
                    for (var epi = 0; epi < enemyPeople.length; epi++) {
                        var ep = enemyPeople[epi];
                        if (!ep.alive || ep.kingdomId !== enemySide) continue;
                        var epRank = (ep.socialRank && ep.socialRank[enemySide]) || 0;
                        if (epRank >= 4) modifyRelationship(ep.id, -5);
                    }
                }
            }

            // If player has social status with enemy kingdom, temporarily set to "Enemy" (rank -1)
            if (enemySide && (player.socialRank[enemySide] || 0) >= 1) {
                if (!player._warSavedRanks) player._warSavedRanks = {};
                player._warSavedRanks[enemySide] = player.socialRank[enemySide];
                player.socialRank[enemySide] = -1; // Special "Enemy" rank
            }

            Engine.logEvent('⚔️ You sided with ' + (chosenK ? chosenK.name : side) + ' in the war!' +
                (enemyK ? ' (-5 rep with ' + enemyK.name + ')' : ''));
            if (typeof UI !== 'undefined' && UI.toast) {
                UI.toast('⚔️ You sided with ' + (chosenK ? chosenK.name : side) + '! +5 rep, -5 enemy rep', 'info', 'military');
            }
        }
    }

    function processWarEnd(warEndEvent) {
        _sync();
        if (!player.warAllegiances) return;
        const warId = warEndEvent.warId;
        const alleg = player.warAllegiances[warId];
        if (!alleg) return;

        const winner = warEndEvent.winner;
        const kingdomA = warEndEvent.kingdomA;
        const kingdomB = warEndEvent.kingdomB;

        // Restore saved ranks from "Enemy" status
        if (player._warSavedRanks) {
            for (var _rk in player._warSavedRanks) {
                // Only restore if still at -1 (Enemy)
                if (player.socialRank[_rk] === -1) {
                    // If your side lost, don't fully restore — handled below
                    if (alleg.side !== 'neutral' && winner && winner !== alleg.side) {
                        player.socialRank[_rk] = 0; // Strip completely on loss
                    } else {
                        player.socialRank[_rk] = player._warSavedRanks[_rk];
                    }
                }
                delete player._warSavedRanks[_rk];
            }
        }

        // Helper: get people of a kingdom
        function _getKingdomPeople(kId) {
            var people = Engine.getWorld ? Engine.getWorld().people : [];
            var result = [];
            if (!people) return result;
            for (var i = 0; i < people.length; i++) {
                if (people[i].alive && people[i].kingdomId === kId) result.push(people[i]);
            }
            return result;
        }

        // Calculate scaling factors: military sales and social status
        var militarySales = alleg.militarySalesTotal || 0;
        var salesFactor = Math.min(1.0, militarySales / 200); // 200 units = full bonus
        var playerRank = Math.max((player.socialRank[kingdomA] || 0), (player.socialRank[kingdomB] || 0));
        var rankFactor = Math.min(1.0, playerRank / 6); // rank 6 = full bonus
        var scaleFactor = 0.5 + salesFactor * 0.3 + rankFactor * 0.2; // 0.5 base + up to 0.3 sales + 0.2 rank

        if (alleg.side === 'neutral') {
            // No special consequences for neutrals at war end
        } else if (alleg.side && alleg.side !== 'neutral') {
            var alliedSide = alleg.side;
            var enemySide = alliedSide === kingdomA ? kingdomB : kingdomA;
            var alliedK = Engine.findKingdom(alliedSide);
            var enemyK = Engine.findKingdom(enemySide);

            if (winner === alliedSide) {
                // ============================
                // YOUR SIDE WON
                // ============================

                // +5 to +20 kingdom reputation (scaled by military sales + social status)
                var repGain = Math.min(20, Math.max(5, Math.floor(5 + 15 * scaleFactor)));
                player.reputation[alliedSide] = Math.min(100, (player.reputation[alliedSide] || 50) + repGain);

                // +10 relationship with the king
                if (alliedK && alliedK.king) modifyRelationship(alliedK.king, 10);

                // +5 relationship with all nobles of that kingdom
                var alliedPeople = _getKingdomPeople(alliedSide);
                for (var ani = 0; ani < alliedPeople.length; ani++) {
                    var an = alliedPeople[ani];
                    var anRank = (an.socialRank && an.socialRank[alliedSide]) || 0;
                    if (anRank >= 4) modifyRelationship(an.id, 5);
                }

                // War Hero achievement
                unlockAchievement('war_hero');

                // One guaranteed yes petition (as long as kingdom can afford it)
                player.guaranteedPetition = player.guaranteedPetition || {};
                player.guaranteedPetition[alliedSide] = true;

                // Gold reward (scaled, up to 5000g)
                var baseReward = alliedK ? Math.floor(alliedK.gold * 0.05) : 500;
                var reward = Math.min(5000, Math.max(100, Math.floor(baseReward * scaleFactor)));
                if (alliedK) alliedK.gold -= Math.min(alliedK.gold, reward);
                player.gold += reward;
                player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + reward;

                // Against All Odds check
                if (alleg.strengthAtDeclaration) {
                    var ourStrength = alleg.strengthAtDeclaration[alliedSide] || 0;
                    var theirStrength = alleg.strengthAtDeclaration[enemySide] || 0;
                    if (ourStrength < theirStrength) unlockAchievement('against_all_odds');
                }

                Engine.logEvent('🎖️ Your side won the war! +' + repGain + ' rep, +' + reward + 'g reward, guaranteed petition granted.');
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast('🎖️ War Hero! ' + (alliedK ? alliedK.name : 'Your side') + ' wins! +' + repGain + ' rep, +' + reward + 'g, petition granted!', 'success', 'military');
                }

            } else if (winner && winner !== alliedSide) {
                // ============================
                // YOUR SIDE LOST
                // ============================

                // -10 to -20 kingdom reputation with BOTH kingdoms
                var repLoss = Math.min(20, Math.max(10, Math.floor(10 + 10 * scaleFactor)));
                player.reputation[alliedSide] = Math.max(0, (player.reputation[alliedSide] || 50) - repLoss);
                player.reputation[enemySide] = Math.max(0, (player.reputation[enemySide] || 50) - repLoss);

                // -10 relationship with BOTH kings
                if (alliedK && alliedK.king) modifyRelationship(alliedK.king, -10);
                if (enemyK && enemyK.king) modifyRelationship(enemyK.king, -10);

                // -5 relationship with all nobles of BOTH kingdoms
                var allPeopleA = _getKingdomPeople(alliedSide);
                var allPeopleB = _getKingdomPeople(enemySide);
                for (var lni = 0; lni < allPeopleA.length; lni++) {
                    var ln = allPeopleA[lni];
                    var lnRank = (ln.socialRank && ln.socialRank[alliedSide]) || 0;
                    if (lnRank >= 4) modifyRelationship(ln.id, -5);
                }
                for (var lni2 = 0; lni2 < allPeopleB.length; lni2++) {
                    var ln2 = allPeopleB[lni2];
                    var ln2Rank = (ln2.socialRank && ln2.socialRank[enemySide]) || 0;
                    if (ln2Rank >= 4) modifyRelationship(ln2.id, -5);
                }

                // Gold retribution (up to 5000g, scaled)
                var retribution = Math.min(5000, Math.max(100, Math.floor(2000 * scaleFactor)));
                retribution = Math.min(retribution, Math.floor(player.gold * 0.5)); // Can't take more than 50% of gold
                if (retribution > 0) {
                    player.gold -= retribution;
                    if (enemyK) enemyK.gold += retribution;
                }

                // Possible jail time (winning king decides based on personality)
                var rng = Engine.getRng();
                var jailDays = 0;
                if (enemyK && rng) {
                    var kp = enemyK.kingPersonality || {};
                    var jailChance = 0.4; // base 40% chance of jail
                    if (kp.temperament === 'cruel' || kp.temperament === 'ruthless') jailChance = 0.7;
                    if (kp.temperament === 'merciful' || kp.temperament === 'kind') jailChance = 0.15;
                    if (playerRank >= 4) jailChance += 0.2; // Nobles more likely jailed
                    if (rng.chance(Math.min(0.9, jailChance))) {
                        jailDays = rng.randInt(3, 14);
                        if (kp.temperament === 'cruel' || kp.temperament === 'ruthless') jailDays = rng.randInt(7, 21);
                        if (kp.temperament === 'merciful' || kp.temperament === 'kind') jailDays = rng.randInt(2, 7);
                        player.jailed = true;
                        player.jailDaysRemaining = jailDays;
                        player.jailReason = 'Sided with ' + (alliedK ? alliedK.name : 'the losing side') + ' in the war';
                        player.jailKingdomId = enemySide;
                    }
                }

                // Winning kingdom seizes ALL buildings in their territory
                var seizedBuildings = player.buildings.filter(function(b) {
                    var town = Engine.findTown(b.townId);
                    return town && town.kingdomId === winner;
                });
                for (var sbi = 0; sbi < seizedBuildings.length; sbi++) {
                    seizedBuildings[sbi].active = false;
                    var sTown = Engine.findTown(seizedBuildings[sbi].townId);
                    if (sTown) {
                        var sIdx = sTown.buildings.findIndex(function(b) { return b.ownerId === 'player' && b.type === seizedBuildings[sbi].type; });
                        if (sIdx !== -1) sTown.buildings[sIdx].ownerId = null;
                    }
                }
                player.buildings = player.buildings.filter(function(b) { return b.active; });

                var lossMsg = '💀 Defeat! -' + repLoss + ' rep both kingdoms, -' + retribution + 'g retribution';
                if (jailDays > 0) lossMsg += ', jailed for ' + jailDays + ' days';
                lossMsg += '.';
                Engine.logEvent(lossMsg);
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast(lossMsg, 'danger', 'critical');
                }
            }
        }

        // Clean up allegiance
        delete player.warAllegiances[warId];
    }

    function shouldShowWarAllegiancePopup(warEvent) {
        _sync();
        // Check trigger conditions
        if (!warEvent || warEvent.type !== 'warDeclared') return false;
        const kingdomA = warEvent.kingdomA;
        const kingdomB = warEvent.kingdomB;

        // Player is citizen of one of the warring kingdoms?
        const isCitizenOfWarring = isPlayerCitizenOf(kingdomA) || isPlayerCitizenOf(kingdomB);

        // Player owns military-related buildings or has military inventory?
        const militaryGoods = ['swords', 'armor', 'bows', 'arrows', 'horses', 'saddles'];
        const hasMilitaryInventory = militaryGoods.some(g => (player.inventory[g] || 0) > 0);
        const hasMilitaryBuildings = player.buildings.some(b => {
            const bt = Engine.findBuildingType(b.type);
            if (!bt || !bt.produces) return false;
            return militaryGoods.includes(bt.produces);
        });

        return isCitizenOfWarring || hasMilitaryInventory || hasMilitaryBuildings;
    }


    // ── Exports ──
    Player.buyHorse = buyHorse;
    Player.sellHorse = sellHorse;
    Player.mountHorse = mountHorse;
    Player.dismountHorse = dismountHorse;
    Player.mountSaddle = mountSaddle;
    Player.unmountSaddle = unmountSaddle;
    Player.buyHorsePermit = buyHorsePermit;
    Player.getCarryCapacity = getCarryCapacity;
    Player.getCarriedWeight = getCarriedWeight;
    Player.getTownStorageCapacity = getTownStorageCapacity;
    Player.getTownStorageUsed = getTownStorageUsed;
    Player.getEffectiveCapacity = getEffectiveCapacity;
    Player.depositToStorage = depositToStorage;
    Player.withdrawFromStorage = withdrawFromStorage;
    Player.parkVehicle = parkVehicle;
    Player.unparkVehicle = unparkVehicle;
    Player.getParkedVehicles = getParkedVehicles;
    Player.tickParkedVehicleTheft = tickParkedVehicleTheft;
    Player.getHomeStorageUsed = getHomeStorageUsed;
    Player.getHomeStorageCapacity = getHomeStorageCapacity;
    Player.depositToHome = depositToHome;
    Player.withdrawFromHome = withdrawFromHome;
    Player.stableHorseAtHome = stableHorseAtHome;
    Player.unstableHorseFromHome = unstableHorseFromHome;
    Player.getAvailableAddons = getAvailableAddons;
    Player.installAddon = installAddon;
    Player.houseHasAddon = houseHasAddon;
    Player.getHouseEffectiveStorage = getHouseEffectiveStorage;
    Player.getBuildingConsumedGoods = function(bt) { return getBuildingConsumedGoods(bt); };
    Player.toggleBuildingInputOnly = toggleBuildingInputOnly;
    Player.depositToBuilding = depositToBuilding;
    Player.withdrawFromBuilding = withdrawFromBuilding;
    Player.buyContainer = buyContainer;
    Player.mountContainer = mountContainer;
    Player.dismountContainer = dismountContainer;
    Player.tickStorageTheft = tickStorageTheft;
    Player.tickLeftCartTheft = tickLeftCartTheft;
    Player.tickWorkerTheft = tickWorkerTheft;
    Player.deductGoodsFromPools = deductGoodsFromPools;
    Player.hasMilitaryExemption = hasMilitaryExemption;
    Player._isMilitaryOrHorse = _isMilitaryOrHorse;
    Player.checkNeutralSalesImbalance = checkNeutralSalesImbalance;
    Player.donateToKingdom = donateToKingdom;
    Player.setWarAllegiance = setWarAllegiance;
    Player.processWarEnd = processWarEnd;
    Player.shouldShowWarAllegiancePopup = shouldShowWarAllegiancePopup;

    // ── v9p33river74: Ship cargo system ──
    function _getShipCargoWeight(ship) {
        if (!ship || !ship.cargo) return 0;
        var t = 0;
        for (var rId in ship.cargo) {
            var qty = ship.cargo[rId] || 0;
            if (qty <= 0) continue;
            var res = findResource(rId);
            t += qty * (res ? (res.weight || 1) : 1);
        }
        return t;
    }
    function getShipCapacity(ship) {
        if (!ship) return 0;
        var st = CONFIG.SHIP_TYPES[ship.type];
        return st ? (st.capacity || 0) : 0;
    }
    function getShipCargo(shipId) {
        _sync();
        var ship = (player.ships || []).find(function(s) { return s.id === shipId; });
        return ship ? (ship.cargo || {}) : {};
    }
    function getShipCargoWeight(shipId) {
        _sync();
        var ship = (player.ships || []).find(function(s) { return s.id === shipId; });
        return _getShipCargoWeight(ship);
    }
    // Move qty of resId between player.inventory and ship.cargo.
    // direction: 'load' (player → ship) or 'unload' (ship → player).
    function transferShipCargo(shipId, resId, qty, direction) {
        _sync();
        qty = Math.floor(qty);
        if (qty <= 0) return { success: false, message: 'Invalid quantity.' };
        var ship = (player.ships || []).find(function(s) { return s.id === shipId; });
        if (!ship) return { success: false, message: 'Ship not found.' };
        ship.cargo = ship.cargo || {};
        var res = findResource(resId);
        var w = res ? (res.weight || 1) : 1;

        if (direction === 'load') {
            var have = player.inventory[resId] || 0;
            if (have < qty) return { success: false, message: 'You only have ' + have + '.' };
            var cap = getShipCapacity(ship);
            var used = _getShipCargoWeight(ship);
            var room = cap - used;
            if (room < qty * w) return { success: false, message: 'Ship has only ' + Math.floor(room / w) + ' room for ' + resId + '.' };
            player.inventory[resId] = have - qty;
            if (player.inventory[resId] <= 0) delete player.inventory[resId];
            ship.cargo[resId] = (ship.cargo[resId] || 0) + qty;
            return { success: true, message: '📦 Loaded ' + qty + ' ' + resId + ' onto ship.' };
        } else if (direction === 'unload') {
            var aboard = ship.cargo[resId] || 0;
            if (aboard < qty) return { success: false, message: 'Ship only has ' + aboard + '.' };
            // Player capacity check (allow overflow if at port — town storage handles it)
            var maxCarry = Player.getCarryCapacity ? Player.getCarryCapacity() : Infinity;
            var carried = Player.getCarriedWeight ? Player.getCarriedWeight() : 0;
            var roomP = maxCarry - carried;
            if (roomP < qty * w) {
                // Overflow handled silently if at a town with storage; otherwise reject.
                if (!player.townId) return { success: false, message: 'You can carry only ' + Math.floor(roomP / w) + ' ' + resId + ' more.' };
            }
            ship.cargo[resId] = aboard - qty;
            if (ship.cargo[resId] <= 0) delete ship.cargo[resId];
            player.inventory[resId] = (player.inventory[resId] || 0) + qty;
            return { success: true, message: '📦 Unloaded ' + qty + ' ' + resId + ' from ship.' };
        }
        return { success: false, message: 'Invalid direction.' };
    }
    Player.getShipCargo = getShipCargo;
    Player.getShipCargoWeight = getShipCargoWeight;
    Player.getShipCapacity = function(ship) { return getShipCapacity(ship); };
    Player.transferShipCargo = transferShipCargo;
})(window.Player);