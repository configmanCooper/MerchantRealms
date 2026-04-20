(function(Player) {
    "use strict";
    if (!Player) throw new Error("Player must be loaded before player_vitals.js");

    var player;
    function _sync() { player = Player.state; }

    // Aliases for Player functions used by this module
    var hasSkill = Player.hasSkill;
    var logFinance = Player.logFinance;
    var handlePlayerDeath = Player.handlePlayerDeath;
    var getHouseInTown = Player.getHouseInTown;
    var getBestShip = Player.getBestShip;
    var modifyRelationship = Player.modifyRelationship;
    var _applyConditionHealthHit = Player._applyConditionHealthHit;

    // Find a family member's house in the given town
    function _getFamilyHouseInTown(townId) {
        _sync();
        if (!townId) return null;
        // Check world.familyHouses registry first
        var world = (typeof Engine !== 'undefined' && Engine.getWorld) ? Engine.getWorld() : null;
        if (world && world.familyHouses) {
            for (var i = 0; i < world.familyHouses.length; i++) {
                var fh = world.familyHouses[i];
                if (fh.townId === townId) {
                    // Verify owner is a family member
                    var isFamily = false;
                    if (player.spouseId && fh.ownerId === player.spouseId) isFamily = true;
                    if (!isFamily && player.parentIds) {
                        for (var p = 0; p < player.parentIds.length; p++) {
                            if (player.parentIds[p] === fh.ownerId) { isFamily = true; break; }
                        }
                    }
                    if (!isFamily && player.childrenIds) {
                        for (var c = 0; c < player.childrenIds.length; c++) {
                            if (player.childrenIds[c] === fh.ownerId) { isFamily = true; break; }
                        }
                    }
                    if (!isFamily && player.siblingIds) {
                        for (var s = 0; s < player.siblingIds.length; s++) {
                            if (player.siblingIds[s] === fh.ownerId) { isFamily = true; break; }
                        }
                    }
                    if (isFamily) return fh;
                }
            }
        }
        // Fallback: check family members for houseTownId
        var famIds = [];
        if (player.spouseId) famIds.push(player.spouseId);
        if (player.parentIds) famIds = famIds.concat(player.parentIds);
        if (player.childrenIds) famIds = famIds.concat(player.childrenIds);
        if (player.siblingIds) famIds = famIds.concat(player.siblingIds);
        for (var f = 0; f < famIds.length; f++) {
            try {
                var person = Engine.findPerson(famIds[f]);
                if (person && person.alive && person.houseTownId === townId && person.houseId) {
                    // Check if the house still exists in world.familyHouses or player.houses
                    var house = null;
                    if (world && world.familyHouses) {
                        for (var h = 0; h < world.familyHouses.length; h++) {
                            if (world.familyHouses[h].id === person.houseId) { house = world.familyHouses[h]; break; }
                        }
                    }
                    if (house) return house;
                    // Construct minimal house object from person data
                    return { id: person.houseId, townId: townId, ownerId: famIds[f], type: 'cottage' };
                }
            } catch(e) { /* person not found */ }
        }
        return null;
    }

    // Check if the next food to be consumed (oldest FIFO cohort) is stale
    function _isNextFoodStale(storageObj, foodId) {
        if (!CONFIG.PERISHABLE_FOODS || !CONFIG.PERISHABLE_FOODS[foodId]) return false;
        if (!storageObj._foodAge || !storageObj._foodAge[foodId] || storageObj._foodAge[foodId].length === 0) return false;
        var oldest = storageObj._foodAge[foodId][0];
        var age = (typeof Engine !== 'undefined' ? Engine.getDay() : 0) - oldest.day;
        return age >= CONFIG.PERISHABLE_FOODS[foodId].stale;
    }

    // ========================================================
    // §12J HUNGER / FOOD SYSTEM
    // ========================================================
    function tickHunger() {
        _sync();
        if (!player.alive) return;

        // Auto-feed in jail
        if (player.jailedUntilDay > 0 && Engine.getDay() < player.jailedUntilDay) {
            if ((player.hunger || 0) < 50) player.hunger = 50;
        }

        // Decay hunger (spouseHungerMod reduces decay if good_cook, injuries increase it)
        const injDebuffs = Player.getInjuryDebuffs();
        const hungerDecay = HUNGER_CONFIG.DECAY_PER_DAY * (player.spouseHungerMod || 1.0) * injDebuffs.hungerRate;
        player.hunger = Math.max(0, player.hunger - hungerDecay);

        // Injury gold drain (bandage/medicine costs for severe wounds)
        if (injDebuffs.goldDrain > 0 && player.gold > 0) {
            player.gold = Math.max(0, player.gold - injDebuffs.goldDrain);
        }

        if (player.townId && !player.traveling) {
            // Military soldiers are fed by the kingdom — skip auto-buy
            if (player.militaryActive) {
                // Military provisions handle food separately in tickMilitaryCareer()
            } else {
            // Auto-buy food from town market
            const town = Engine.findTown(player.townId);
            if (town && player.hunger < 60) {
                const foodTypes = [...HUNGER_CONFIG.FOOD_TYPES, ...HUNGER_CONFIG.RAW_FOOD_TYPES];
                // Buy food until hunger >= 80 or can't afford/find any
                let bought = false;
                while (player.hunger < 80) {
                    bought = false;
                    for (const foodId of foodTypes) {
                        const supply = town.market.supply[foodId] || 0;
                        const price = town.market.prices[foodId] || 5;
                        if (supply > 0 && player.gold >= price) {
                            var _staleM = _isNextFoodStale(town.market, foodId);
                            town.market.supply[foodId]--;
                            Engine.removeFoodCohort(town.market, foodId, 1);
                            player.gold -= price;
                            logFinance(-price, 'food_drink', 'Bought food/drink');
                            var restore = HUNGER_CONFIG.RAW_FOOD_TYPES.includes(foodId) ? HUNGER_CONFIG.RAW_FOOD_RESTORE : HUNGER_CONFIG.FOOD_RESTORE;
                            if (_staleM) restore = Math.floor(restore / 2);
                            player.hunger = Math.min(HUNGER_CONFIG.MAX, player.hunger + restore);
                            bought = true;
                            break;
                        }
                    }
                    if (!bought) break; // No food available or can't afford
                }
            }
            } // end else (not military)
        } else if (player.traveling) {
            // Eat from inventory while traveling — only when actually hungry
            if (player.hunger < 50) {
            let fed = false;
            for (const foodId of HUNGER_CONFIG.FOOD_TYPES) {
                if ((player.inventory[foodId] || 0) > 0) {
                    var _staleT1 = _isNextFoodStale(player, foodId);
                    player.inventory[foodId]--;
                    Engine.removeFoodCohort(player, foodId, 1);
                    var _restoreT1 = HUNGER_CONFIG.FOOD_RESTORE;
                    if (_staleT1) _restoreT1 = Math.floor(_restoreT1 / 2);
                    player.hunger = Math.min(HUNGER_CONFIG.MAX, player.hunger + _restoreT1);
                    fed = true;
                    break;
                }
            }
            if (!fed) {
                for (const foodId of HUNGER_CONFIG.RAW_FOOD_TYPES) {
                    if ((player.inventory[foodId] || 0) > 0) {
                        var _staleT2 = _isNextFoodStale(player, foodId);
                        player.inventory[foodId]--;
                        Engine.removeFoodCohort(player, foodId, 1);
                        var _restoreT2 = HUNGER_CONFIG.RAW_FOOD_RESTORE;
                        if (_staleT2) _restoreT2 = Math.floor(_restoreT2 / 2);
                        player.hunger = Math.min(HUNGER_CONFIG.MAX, player.hunger + _restoreT2);
                        fed = true;
                        break;
                    }
                }
            }
            if (!fed && player.hunger <= 0) {
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast('⚠️ You are starving! Find food soon!', 'danger');
                }
            }
            } // end hunger < 50 check
        }

        // Starvation effects
        if (player.hunger <= 0) {
            // Speed reduction handled in travel tick
            // Energy drain — can't recover while starving
            player.energy = Math.max(0, (player.energy || 0) - 2);
            // Health loss — gradual damage from starvation
            if (!player._lastStarveTick || Engine.getDay() > player._lastStarveTick) {
                player._lastStarveTick = Engine.getDay();
                player.health = Math.max(0, (player.health || 100) - (HUNGER_CONFIG.STARVING_HEALTH_LOSS || 1));
                if (player.health <= 0 && player.alive && !window._godInvincible) {
                    player.deathCause = 'starvation';
                    Engine.logEvent('💀 ' + player.fullName + ' has died of starvation.');
                    if (typeof UI !== 'undefined' && UI.toast) {
                        UI.toast('💀 You have died of starvation!', 'danger', 'critical');
                    }
                    player.alive = false;
                    if (typeof handlePlayerDeath === 'function') handlePlayerDeath();
                }
            }
        } else if (player.hunger <= 20) {
            // Low hunger warning — reduced energy recovery
            player.energy = Math.max(0, (player.energy || 0) - 1);
        }

        // Health recovery — +2/day when no conditions and vitals > 50, +1 bonus when vitals > 80
        // (Moved to tickInjuriesAndIllnesses for centralized health management)

        // Low hunger/thirst health drain: -1 per day per stat below 10
        if (player.hunger < 10 || player.thirst < 10) {
            if (!player._lastLowVitalHealthTick || Engine.getDay() > player._lastLowVitalHealthTick) {
                player._lastLowVitalHealthTick = Engine.getDay();
                var vitalDrain = 0;
                if (player.hunger < 10) vitalDrain++;
                if (player.thirst < 10) vitalDrain++;
                if (vitalDrain > 0) {
                    player.health = Math.max(0, (player.health || 100) - vitalDrain);
                    if (player.health <= 0 && player.alive && !window._godInvincible) {
                        var cause = (player.hunger < 10 && player.thirst < 10) ? 'starvation and dehydration' : (player.hunger < 10 ? 'starvation' : 'dehydration');
                        Engine.logEvent('💀 ' + player.fullName + ' died from ' + cause + '.');
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast('💀 Died from ' + cause + '!', 'danger', 'critical');
                        player.deathCause = cause;
                        player.alive = false;
                        if (typeof handlePlayerDeath === 'function') handlePlayerDeath();
                    }
                }
            }
        }
    }

    // ========================================================
    // §12J  ENERGY & THIRST SYSTEM (replaces old Fatigue)
    // ========================================================
    function getMaxEnergy() {
        _sync();
        var max = ENERGY_CONFIG.BASE_MAX;
        for (var i = 0; i < ENERGY_CONFIG.ENDURANCE_TIERS.length; i++) {
            if (hasSkill(ENERGY_CONFIG.ENDURANCE_TIERS[i].id)) {
                max = ENERGY_CONFIG.ENDURANCE_TIERS[i].maxEnergy;
            }
        }
        player.maxEnergy = max;
        return max;
    }

    function consumeEnergy(amount) {
        _sync();
        player.energy = Math.max(0, (player.energy || ENERGY_CONFIG.START) - amount);
        // Sync legacy fatigue for backward compat
        player.fatigue = Math.max(0, getMaxEnergy() - player.energy);
        // Mark that energy was consumed this tick (prevents double-drain with passive decay)
        player._energyConsumedThisTick = true;
    }

    function restoreEnergy(amount) {
        _sync();
        var max = getMaxEnergy();
        player.energy = Math.min(max, (player.energy || 0) + amount);
        player.fatigue = Math.max(0, max - player.energy);
    }

    function getJobEnergyCostPerTick(job) {
        // If explicitly set on job definition, use it
        if (job.energyCost != null) return job.energyCost;

        var name = (job.name || '').toLowerCase();

        // Very heavy (4.0) — extreme physical
        if (name.includes('arena') || name.includes('tournament')) return 4.0;

        // Heavy (3.0) — hard labor / dangerous fieldwork
        if (name.includes('mine') || name.includes('dock') || name.includes('lumber') ||
            name.includes('well dig') || name.includes('rescue') || name.includes('deep sea') ||
            name.includes('siege') || name.includes('road repair') || name.includes('caravan loader') ||
            name.includes('gravedigger') || name.includes('rebuilder') || name.includes('chop wood') ||
            name.includes('load cargo') || name.includes('carry supplies')) return 3.0;

        // Medium-heavy (2.5) — moderate physical + skill
        if (name.includes('soldier') || name.includes('smithy') || name.includes('harvest') ||
            name.includes('ship repair') || name.includes('fence mend') || name.includes('blacksmith') ||
            name.includes('castle work') || name.includes('caravan guard')) return 2.5;

        // Medium (2.0) — standing/walking work
        if (name.includes('guard') || name.includes('stablehand') || name.includes('farm') ||
            name.includes('watchman') || name.includes('plague nurse') || name.includes('war medic') ||
            name.includes('navigator') || name.includes('quarantine') || name.includes('guild enforcer') ||
            name.includes('privateer') || name.includes('weapons courier')) return 2.0;

        // Light-medium (1.5) — moderate activity
        if (name.includes('castle servant') || name.includes('messenger') || name.includes('shepherd') ||
            name.includes('market crier') || name.includes('lamplighter') || name.includes('herb') ||
            name.includes('itinerant') || name.includes('customs') || name.includes('bakery') ||
            name.includes('tailor') || name.includes('assist') || name.includes('warehouse') ||
            name.includes('procurer') ||
            name.includes('sweep') || name.includes('deliver') || name.includes('tend')) return 1.5;

        // Light (1.0) — mental or entertainment work
        if (name.includes('entertainer') || name.includes('tax collector') || name.includes('spy') ||
            name.includes('merchant') || name.includes('count inventory') || name.includes('traveling')) return 1.0;

        // Very light (0.5) — desk work
        if (name.includes('scribe') || name.includes('clerk') || name.includes('diplomat') ||
            name.includes('banker')) return 0.5;

        // Default: light-medium
        return 1.5;
    }

    function checkEnergyForAction(energyCost) {
        _sync();
        var cost = energyCost || 0;
        var energy = (player.energy != null) ? player.energy : ENERGY_CONFIG.START;
        if (energy <= ENERGY_CONFIG.COLLAPSE_THRESHOLD) {
            var rng = Engine.getRng();
            if (rng && rng.chance(ENERGY_CONFIG.COLLAPSE_CHANCE)) {
                if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(30);
                restoreEnergy(30);
                var injuryChance = rng.chance(0.30);
                if (injuryChance) {
                    player.injuries = player.injuries || [];
                    player.injuries.push({ type: 'exhaustion_collapse', severity: 'minor', dayOccurred: Engine.getDay(), treated: false });
                    _applyConditionHealthHit('minor');
                }
                Engine.logEvent(player.fullName + ' collapsed from exhaustion!');
                return { blocked: true, message: '💫 You collapsed from exhaustion!' + (injuryChance ? ' You injured yourself in the fall.' : '') };
            }
        }
        if (energy < ENERGY_CONFIG.ACTION_BLOCK) {
            return { blocked: true, message: '😵 Too exhausted! You need to rest. (Energy: ' + Math.floor(energy) + ')' };
        }
        if (cost > 0 && energy < cost) {
            return { blocked: true, message: '😴 Not enough energy for this action. Need ' + Math.ceil(cost) + ', have ' + Math.floor(energy) + '. Rest first!' };
        }
        return { blocked: false };
    }

    function getEnergyDebuffs() {
        _sync();
        var max = getMaxEnergy();
        var threshold = max * ENERGY_CONFIG.LOW_DEBUFF_THRESHOLD;
        var energy = (player.energy != null) ? player.energy : ENERGY_CONFIG.START;
        if (energy > threshold) return null;
        return ENERGY_CONFIG.DEBUFFS;
    }

    function getLowEnergyModifier(stat) {
        _sync();
        var debuffs = getEnergyDebuffs();
        if (!debuffs) return 0;
        return debuffs[stat] || 0;
    }

    // Legacy wrapper — keeps old addFatigue calls working
    function addFatigue(ticks) {
        _sync();
        consumeEnergy(ticks * CONFIG.FATIGUE_PER_TICK_COST);
    }

    // Legacy wrapper
    function checkFatigueForAction() {
        _sync();
        return checkEnergyForAction(0);
    }

    // Passive energy drain per subtick (0.25 × 60 = 15/day)
    // Applies always when not resting — sitting in town, traveling, etc.
    function energySubtick() {
        _sync();
        if (!player.resting) {
            player.energy = Math.max(0, (player.energy || ENERGY_CONFIG.START) - 0.25);
            player.fatigue = Math.max(0, getMaxEnergy() - player.energy);
        }
    }

    function tickEnergy() {
        _sync();
        // Passive energy drain is now handled in energySubtick() (60x/day)
        // This daily tick only handles: auto-rest and passive recovery
        player._energyConsumedThisTick = false;

        // Auto-rest: if enabled and energy below 10, start resting automatically
        // While traveling, don't auto-rest — prompt player to camp instead
        if (player.traveling) {
            if ((player.energy || 0) < 10 && !player.resting) {
                if (!player._campPromptNeeded) {
                    player._campPromptNeeded = true;
                    Engine.logEvent('⚠️ You are exhausted! Click 🏕️ Camp to rest before you collapse.');
                }
            }
        } else if (player.autoRest !== false && !player.resting && (player.energy || 0) < 10) {
            var opts = getAvailableRestOptions();
            if (opts.length > 0) {
                // Pick best option player can afford (highest energyPerTick)
                var best = null;
                for (var ri = 0; ri < opts.length; ri++) {
                    var opt = opts[ri];
                    if (opt.cost > 0 && player.gold < opt.cost) continue;
                    if (!best || opt.energyPerTick > best.energyPerTick) best = opt;
                }
                if (best) {
                    var result = restForTicks(best.id, 8);
                    if (result && result.success) {
                        Engine.logEvent('💤 Auto-rest: ' + best.name + (best.cost > 0 ? ' (' + best.cost + 'g)' : ''));
                    }
                }
            }
        }

        // Natural daily passive recovery (only when housed/idle — NOT while traveling)
        if (!player.traveling) {
            var house = getHouseInTown(player.townId);
            var recovery = house ? ENERGY_CONFIG.PASSIVE_RECOVERY_HOUSED : ENERGY_CONFIG.PASSIVE_RECOVERY_HOMELESS;
            // Reduce recovery when hungry or thirsty
            if ((player.hunger || 0) <= 0) recovery *= 0.25;  // Starving: 75% less recovery
            else if ((player.hunger || 0) <= 20) recovery *= 0.5;  // Very hungry: 50% less
            if ((player.thirst || 0) <= 0) recovery *= 0.25;  // Dehydrated: 75% less
            else if ((player.thirst || 0) <= 20) recovery *= 0.5;  // Very thirsty: 50% less
            restoreEnergy(recovery);
        }
    }

    // Keep old name as alias
    function tickFatigue() {
        _sync();
        tickEnergy();
    }

    function getLodgingCost(type) {
        _sync();
        var town = Engine.findTown(player.townId);
        var prosperity = (town && town.prosperity) || 50;
        var catMult = { village: 0.5, town: 1.0, city: 1.8, capital_city: 3.0 };
        var cat = (town && town.category) || 'town';
        var cm = catMult[cat] || 1.0;
        // prosperity 0-100 maps to 0.5-1.5 multiplier
        var pm = 0.5 + (prosperity / 100);
        if (type === 'inn_room') {
            // Base 3g, range 3-15g
            return Math.max(3, Math.min(15, Math.round(3 * cm * pm)));
        } else if (type === 'tavern') {
            // Base 4g, range 4-20g
            return Math.max(4, Math.min(20, Math.round(4 * cm * pm)));
        }
        return 0;
    }

    function getRestEnergyRate(locationId) {
        _sync();
        var rate = ENERGY_CONFIG.REST_ENERGY_PER_TICK[locationId] || ENERGY_CONFIG.REST_ENERGY_PER_TICK.outside;
        // Wilderness Survival: +50% rest while traveling
        if (hasSkill('wilderness_survival') && (locationId === 'camping_kit_travel' || locationId === 'tent_travel' || locationId === 'bedroll_travel' || (player.traveling && locationId === 'outside'))) {
            rate *= 1.5;
        }
        return rate;
    }

    function getRestLocationId() {
        _sync();
        // Determine best rest location for player
        if (player.indentured && player.indentured.active) return 'master_quarters';
        if (player.militaryService && player.militaryService.active) return 'barracks';
        var house = getHouseInTown(player.townId);
        if (house) {
            var ht = CONFIG.HOUSING_TYPES.find(function(h) { return h.id === house.type; });
            if (ht) return house.type;
        }
        return null; // no home — must choose inn, tavern, or outside
    }

    function getAvailableRestOptions() {
        _sync();
        var options = [];

        // ── While traveling: only camping/roadside options ──
        if (player.traveling) {
            // Camping Kit (best travel rest)
            if ((player.inventory.camping_kit || 0) > 0) {
                options.push({
                    id: 'camping_kit_travel',
                    name: '🏕️ Camp with Kit',
                    cost: 0,
                    energyPerTick: getRestEnergyRate('camping_kit_travel'),
                    risks: [],
                    icon: '🏕️',
                });
            }
            // Tent
            if ((player.inventory.tent || 0) > 0) {
                options.push({
                    id: 'tent_travel',
                    name: '⛺ Rest in Tent',
                    cost: 0,
                    energyPerTick: getRestEnergyRate('tent_travel'),
                    risks: ['3% theft'],
                    icon: '⛺',
                });
            }
            // Bedroll
            if ((player.inventory.bedroll || 0) > 0) {
                // Bedroll + Tent combo (better than either alone)
                if ((player.inventory.tent || 0) > 0) {
                    options.push({
                        id: 'bedroll_tent_travel',
                        name: '⛺🛏️ Tent & Bedroll',
                        cost: 0,
                        energyPerTick: getRestEnergyRate('bedroll_tent_travel'),
                        risks: ['2% theft', '1% disease'],
                        icon: '⛺',
                    });
                } else {
                    options.push({
                        id: 'bedroll_travel',
                        name: '🛏️ Sleep on Bedroll',
                        cost: 0,
                        energyPerTick: getRestEnergyRate('bedroll_travel'),
                        risks: ['5% theft', '3% disease'],
                        icon: '🛏️',
                    });
                }
            } else if ((player.inventory.tent || 0) > 0) {
                // Tent alone (no bedroll)
                options.push({
                    id: 'tent_travel',
                    name: '⛺ Rest in Tent',
                    cost: 0,
                    energyPerTick: getRestEnergyRate('tent_travel'),
                    risks: ['3% theft'],
                    icon: '⛺',
                });
            }
            // Caravan Wagon (mobile home — best travel rest option)
            var hasWagon = (player.houses || []).some(function(h) { return h.type === 'caravan_wagon'; });
            if (hasWagon) {
                options.push({
                    id: 'caravan_wagon',
                    name: '🏠 Rest in Mobile Home',
                    cost: 0,
                    energyPerTick: getRestEnergyRate('caravan_wagon'),
                    risks: ['1% theft'],
                    icon: '🏠',
                });
            }
            // Sleep in wagon/cart (if equipped and has 30+ capacity left)
            if (!hasWagon && player.storageContainer) {
                var wagonTypes = ['small_wagon', 'wagon', 'large_wagon'];
                if (wagonTypes.indexOf(player.storageContainer) !== -1) {
                    var wCap = Player.getCarryCapacity();
                    var wUsed = Player.getCarriedWeight();
                    if (wCap - wUsed >= 30) {
                        options.push({
                            id: 'wagon_sleep_travel',
                            name: '🛞 Sleep in ' + (CONFIG.STORAGE_CONTAINERS[player.storageContainer] ? CONFIG.STORAGE_CONTAINERS[player.storageContainer].name : 'Wagon'),
                            cost: 0,
                            energyPerTick: getRestEnergyRate('wagon_sleep_travel'),
                            risks: ['8% theft'],
                            icon: '🛞',
                        });
                    }
                }
            }
            // Ship rest — if traveling by sea and ship has rest capability
            if (player.travelBySea) {
                var bestSailor = getBestShip();
                if (bestSailor && bestSailor.restBonus > 0) {
                    var shipRestRate = bestSailor.restBonus * 10; // Convert to energy/tick (0.7 → 7.0)
                    var stConfig = CONFIG.SHIP_TYPES[bestSailor.type];
                    options.push({
                        id: 'ship_cabin',
                        name: '⚓ Rest Aboard ' + bestSailor.name,
                        cost: 0,
                        energyPerTick: shipRestRate,
                        risks: [],
                        icon: '⚓',
                    });
                }
            }
            // Bare roadside (always available)
            options.push({
                id: 'outside',
                name: '🌙 Sleep on the Road',
                cost: 0,
                energyPerTick: getRestEnergyRate('outside'),
                risks: ['10% theft', '5% disease', '5% injury'],
                risk: 'Exposed on the road',
                icon: '🌙',
            });
            return options;
        }

        // ── Outpost-specific rest options ──
        var _restTown = Engine.findTown(player.townId);
        var _isOutpost = _restTown && _restTown.isOutpost;
        if (_isOutpost) {
            // Outpost housing rest (if space available)
            var _ohCap = 0;
            var _ohPop = (_restTown.outpostResidents || []).length;
            if (_restTown.outpostHousing) {
                for (var _ohi = 0; _ohi < _restTown.outpostHousing.length; _ohi++) {
                    var _ohCfg = CONFIG.OUTPOST_HOUSING && CONFIG.OUTPOST_HOUSING[_restTown.outpostHousing[_ohi].type];
                    if (_ohCfg) _ohCap += _ohCfg.capacity;
                }
            }
            if (_ohPop < _ohCap) {
                options.push({
                    id: 'outpost_housing',
                    name: '🏠 Outpost Housing',
                    cost: 0,
                    energyPerTick: getRestEnergyRate('outpost_housing'),
                    risks: [],
                    icon: '🏠',
                });
            }
            // Camping kit
            if ((player.inventory.camping_kit || 0) > 0) {
                options.push({
                    id: 'camping_kit_travel',
                    name: '🏕️ Camp with Kit',
                    cost: 0,
                    energyPerTick: getRestEnergyRate('camping_kit_travel'),
                    risks: ['25% wear'],
                    icon: '🏕️',
                });
            }
            // Bedroll + Tent combo
            if ((player.inventory.bedroll || 0) > 0 && (player.inventory.tent || 0) > 0) {
                options.push({
                    id: 'bedroll_tent_travel',
                    name: '⛺🛏️ Tent & Bedroll',
                    cost: 0,
                    energyPerTick: getRestEnergyRate('bedroll_tent_travel'),
                    risks: ['25% wear each'],
                    icon: '⛺',
                });
            } else if ((player.inventory.tent || 0) > 0) {
                options.push({
                    id: 'tent_travel',
                    name: '⛺ Pitch Tent',
                    cost: 0,
                    energyPerTick: getRestEnergyRate('tent_travel'),
                    risks: ['25% wear'],
                    icon: '⛺',
                });
            } else if ((player.inventory.bedroll || 0) > 0) {
                options.push({
                    id: 'bedroll_travel',
                    name: '🛏️ Use Bedroll',
                    cost: 0,
                    energyPerTick: getRestEnergyRate('bedroll_travel'),
                    risks: ['25% wear'],
                    icon: '🛏️',
                });
            }
            // Sleep outside always available
            options.push({
                id: 'outside',
                name: '🌙 Sleep Outside',
                cost: 0,
                energyPerTick: getRestEnergyRate('outside'),
                risks: ['theft', 'disease'],
                icon: '🌙',
            });
            return options;
        }

        // ── In town: full rest options ──
        var house = getHouseInTown(player.townId);

        // Own home
        if (house) {
            var ht = CONFIG.HOUSING_TYPES.find(function(h) { return h.id === house.type; });
            options.push({
                id: house.type,
                name: '🏠 ' + (ht ? ht.name : 'Home'),
                cost: 0,
                energyPerTick: getRestEnergyRate(house.type),
                risks: [],
            });
        }

        // Family member's home — check if a family member has a house in this town
        if (!house) {
            var famHouse = _getFamilyHouseInTown(player.townId);
            if (famHouse) {
                var famHt = CONFIG.HOUSING_TYPES.find(function(h) { return h.id === famHouse.type; });
                var famOwner = famHouse.ownerId ? Engine.findPerson(famHouse.ownerId) : null;
                var ownerName = famOwner ? famOwner.firstName : 'Family';
                options.push({
                    id: 'family_house',
                    name: '🏠 ' + ownerName + '\'s ' + (famHt ? famHt.name : 'Home'),
                    cost: 0,
                    energyPerTick: getRestEnergyRate(famHouse.type),
                    risks: [],
                    isFamilyHouse: true,
                    desc: 'Rest at your family\'s home — free.',
                });
            }
        }

        // Master's quarters
        if (player.indentured && player.indentured.active) {
            var master = Engine.findPerson(player.indentured.masterId);
            if (master && player.townId === master.townId) {
                options.push({
                    id: 'master_quarters',
                    name: '🛏️ Master\'s Quarters',
                    cost: 0,
                    energyPerTick: getRestEnergyRate('master_quarters'),
                    risks: [],
                });
            }
        }

        // Ship cabin — rest aboard docked ship at port
        var portTown = Engine.findTown(player.townId);
        if (portTown && portTown.isPort && player.ships && player.ships.length > 0) {
            var dockedShip = getBestShip();
            if (dockedShip && dockedShip.restBonus > 0) {
                var dockRestRate = dockedShip.restBonus * 10;
                options.push({
                    id: 'ship_cabin',
                    name: '⚓ Rest Aboard ' + dockedShip.name,
                    cost: 0,
                    energyPerTick: dockRestRate,
                    risks: [],
                    icon: '⚓',
                });
            }
        }

        // Military barracks
        if (player.militaryService && player.militaryService.active) {
            options.push({
                id: 'barracks',
                name: '⚔️ Military Barracks',
                cost: 0,
                energyPerTick: getRestEnergyRate('barracks'),
                risks: [],
            });
        }

        // Tavern (if town has one)
        if (player.townId) {
            var town = Engine.findTown(player.townId);
            if (town && town.buildings) {
                var hasTavern = town.buildings.some(function(b) { return b.type === 'tavern'; });
                if (hasTavern) {
                    options.push({
                        id: 'tavern',
                        name: '🍻 Tavern',
                        cost: getLodgingCost('tavern'),
                        energyPerTick: getRestEnergyRate('tavern'),
                        risks: [],
                        desc: 'Socialize while you rest — meet locals!',
                    });
                }
            }
        }

        // Inn (always available in towns)
        if (player.townId) {
            options.push({
                id: 'inn_room',
                name: '🏨 Inn Room',
                cost: getLodgingCost('inn_room'),
                energyPerTick: getRestEnergyRate('inn_room'),
                risks: [],
            });
        }

        // Sleep outside (always available)
        options.push({
            id: 'outside',
            name: '🌙 Sleep Outside',
            cost: 0,
            energyPerTick: getRestEnergyRate('outside'),
            risks: ['8% theft', '5% disease', '3% injury'],
        });

        return options;
    }

    function restForTicks(locationId, ticks) {
        _sync();
        var isTravelRest = ['camping_kit_travel', 'tent_travel', 'bedroll_travel', 'bedroll_tent_travel', 'wagon_sleep_travel', 'caravan_wagon', 'ship_cabin'].indexOf(locationId) !== -1;
        var isRoadsideRest = player.traveling && locationId === 'outside';

        // Block non-travel rest while traveling
        if (player.traveling && !isTravelRest && !isRoadsideRest) {
            return { success: false, message: 'Cannot rest here while traveling. Use camping gear or sleep roadside.' };
        }

        // Clear camp prompt flag since player is now resting
        player._campPromptNeeded = false;

        var rate = getRestEnergyRate(locationId);
        var max = getMaxEnergy();
        var energyNeeded = max - (player.energy || 0);
        var maxTicks = Math.ceil(energyNeeded / rate);
        var actualTicks = Math.min(ticks, maxTicks);
        if (actualTicks <= 0) return { success: false, message: 'Already at full energy.' };

        // Handle costs (only in-town lodging)
        if (locationId === 'inn_room') {
            var innCost = getLodgingCost('inn_room');
            if (player.gold < innCost) return { success: false, message: 'Need ' + innCost + 'g for an inn room.' };
            player.gold -= innCost;
            player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + innCost;
        } else if (locationId === 'tavern') {
            var tavCost = getLodgingCost('tavern');
            if (player.gold < tavCost) return { success: false, message: 'Need ' + tavCost + 'g for a tavern room.' };
            player.gold -= tavCost;
            player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + tavCost;
        }

        // Pause travel progress while resting (time passes but no distance covered)
        var wasTraveling = player.traveling;
        var savedTravelProgress = null;
        if (wasTraveling && player.travelData) {
            savedTravelProgress = {
                ticksRemaining: player.travelData.ticksRemaining,
                progress: player.travelData.progress
            };
        }

        // Advance time
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(actualTicks);

        // Restore travel state so resting doesn't advance the journey
        if (wasTraveling && savedTravelProgress && player.travelData) {
            player.travelData.ticksRemaining = savedTravelProgress.ticksRemaining;
            player.travelData.progress = savedTravelProgress.progress;
        }

        // Restore energy
        var restored = actualTicks * rate;
        restoreEnergy(restored);

        // Injury recovery bonus for sheltered rest
        if (locationId !== 'outside' && !isRoadsideRest && locationId !== 'barracks') {
            if (player.injuries && player.injuries.length > 0) {
                for (var i = 0; i < player.injuries.length; i++) {
                    if (player.injuries[i].dayOccurred) player.injuries[i].dayOccurred -= 1;
                }
            }
        }

        var messages = ['Rested for ' + actualTicks + ' ticks. Energy: ' + Math.floor(player.energy) + '/' + max + '.'];
        player.lastRestDay = Engine.getDay();

        // Road/outdoor risks — roadside rest while traveling or sleeping outside in town
        if (isRoadsideRest || locationId === 'outside') {
            var rng = Engine.getRng();
            // Camping gear reduces risks
            var theftChance = isRoadsideRest ? 0.10 : 0.08;
            var goodsTheftChance = isRoadsideRest ? 0.06 : 0.04;
            var diseaseChance = isRoadsideRest ? 0.07 : 0.05;
            var injuryChance = isRoadsideRest ? 0.05 : 0.03;

            if (rng && rng.chance(theftChance)) {
                var stolen = Math.min(player.gold, Math.floor(Math.random() * 15) + 3);
                if (stolen > 0) {
                    player.gold -= stolen;
                    messages.push('💰 A thief stole ' + stolen + 'g while you slept!');
                }
            }
            if (rng && rng.chance(goodsTheftChance)) {
                var invKeys = Object.keys(player.inventory).filter(function(k) { return player.inventory[k] > 0; });
                if (invKeys.length > 0) {
                    var stolenGood = invKeys[Math.floor(Math.random() * invKeys.length)];
                    var stolenQty = Math.min(player.inventory[stolenGood], Math.floor(Math.random() * 3) + 1);
                    player.inventory[stolenGood] -= stolenQty;
                    if (player.inventory[stolenGood] <= 0) delete player.inventory[stolenGood];
                    messages.push('📦 Someone stole ' + stolenQty + ' ' + stolenGood + '!');
                }
            }
            if (rng && rng.chance(diseaseChance)) {
                player.illnesses = player.illnesses || [];
                player.illnesses.push({ type: 'cold', name: 'Common Cold', severity: 'minor', dayOccurred: Engine.getDay(), treated: false });
                messages.push('🤧 You caught a cold!');
            } else if (rng && rng.chance(0.02)) {
                player.illnesses = player.illnesses || [];
                player.illnesses.push({ type: 'fever', name: 'Fever', severity: 'moderate', dayOccurred: Engine.getDay(), treated: false });
                messages.push('🤒 You developed a fever!');
            }
            if (rng && rng.chance(injuryChance)) {
                player.injured = true;
                player.injuryDaysLeft = (player.injuryDaysLeft || 0) + 3;
                messages.push('🩹 You woke up with a minor injury!');
            }
        }

        // Travel camping gear has reduced risks (tent/bedroll/kit/wagon/caravan)
        if (isTravelRest) {
            var rng2 = Engine.getRng();
            var gearTheft, gearDisease;
            if (locationId === 'caravan_wagon') { gearTheft = 0.01; gearDisease = 0; }
            else if (locationId === 'camping_kit_travel') { gearTheft = 0.01; gearDisease = 0; }
            else if (locationId === 'bedroll_tent_travel') { gearTheft = 0.02; gearDisease = 0.01; }
            else if (locationId === 'tent_travel') { gearTheft = 0.03; gearDisease = 0.01; }
            else if (locationId === 'bedroll_travel') { gearTheft = 0.05; gearDisease = 0.03; }
            else if (locationId === 'wagon_sleep_travel') { gearTheft = 0.08; gearDisease = 0.02; }
            else if (locationId === 'ship_cabin') { gearTheft = 0; gearDisease = 0; }
            else { gearTheft = 0.01; gearDisease = 0; }

            if (rng2 && gearTheft > 0 && rng2.chance(gearTheft)) {
                var stolen2 = Math.min(player.gold, Math.floor(Math.random() * 10) + 2);
                if (stolen2 > 0) {
                    player.gold -= stolen2;
                    messages.push('💰 A thief stole ' + stolen2 + 'g while you camped!');
                }
            }
            if (rng2 && gearDisease > 0 && rng2.chance(gearDisease)) {
                player.illnesses = player.illnesses || [];
                player.illnesses.push({ type: 'cold', name: 'Common Cold', severity: 'minor', dayOccurred: Engine.getDay(), treated: false });
                messages.push('🤧 You caught a cold while camping.');
            }

            // Gear wear — 25% chance of consumption per rest (10% with wilderness_survival)
            var _gearWearChance = hasSkill('wilderness_survival') ? 0.10 : 0.25;
            if (locationId === 'camping_kit_travel') {
                if (rng2.chance(_gearWearChance)) {
                    player.inventory.camping_kit = (player.inventory.camping_kit || 0) - 1;
                    if (player.inventory.camping_kit <= 0) delete player.inventory.camping_kit;
                    messages.push('🏕️ Your camping kit wore out!');
                }
            } else if (locationId === 'bedroll_tent_travel') {
                // Both items risk wearing out independently
                if (rng2.chance(_gearWearChance)) {
                    player.inventory.bedroll = (player.inventory.bedroll || 0) - 1;
                    if (player.inventory.bedroll <= 0) delete player.inventory.bedroll;
                    messages.push('🛏️ Your bedroll wore out!');
                }
                if (rng2.chance(_gearWearChance)) {
                    player.inventory.tent = (player.inventory.tent || 0) - 1;
                    if (player.inventory.tent <= 0) delete player.inventory.tent;
                    messages.push('⛺ Your tent wore out!');
                }
            } else if (locationId === 'tent_travel') {
                if (rng2.chance(_gearWearChance)) {
                    player.inventory.tent = (player.inventory.tent || 0) - 1;
                    if (player.inventory.tent <= 0) delete player.inventory.tent;
                    messages.push('⛺ Your tent wore out!');
                }
            } else if (locationId === 'bedroll_travel') {
                if (rng2.chance(_gearWearChance)) {
                    player.inventory.bedroll = (player.inventory.bedroll || 0) - 1;
                    if (player.inventory.bedroll <= 0) delete player.inventory.bedroll;
                    messages.push('🛏️ Your bedroll wore out!');
                }
            }
        }

        // Tavern socializing — boost relationships with random locals
        if (locationId === 'tavern' && player.townId) {
            try {
                var rngTav = Engine.getRng();
                var townNpcs = Engine.getPeople(player.townId);
                if (townNpcs && townNpcs.length > 0) {
                    var alive = townNpcs.filter(function(n) { return n.alive !== false && n.age >= 14; });
                    if (alive.length > 0) {
                        var numToMeet = rngTav.randInt(2, Math.min(4, alive.length));
                        var shuffled = rngTav.shuffle(alive.slice());
                        var metNames = [];
                        for (var ti = 0; ti < numToMeet; ti++) {
                            var boost = rngTav.randInt(2, 5);
                            modifyRelationship(shuffled[ti].id, boost);
                            metNames.push((shuffled[ti].firstName || 'someone'));
                        }
                        messages.push('🍻 Socialized with ' + metNames.join(', ') + ' at the tavern!');
                    }
                }
            } catch (e) {}
        }

        var icon = isTravelRest ? '🏕️' : isRoadsideRest ? '🌙' : locationId === 'outside' ? '🌙' : locationId === 'inn_room' ? '🏨' : locationId === 'tavern' ? '🍻' : locationId === 'barracks' ? '⚔️' : '🏠';
        var restLabel = wasTraveling ? 'camped' : 'rested';
        Engine.logEvent(player.fullName + ' ' + restLabel + ' (' + actualTicks + ' ticks). Energy restored.');
        return { success: true, message: messages.join(' ') + ' ' + icon };
    }

    // Legacy rest functions — now redirect to restForTicks
    function restAtHome(townId) {
        _sync();
        var tid = townId || player.townId;
        if (player.traveling) return { success: false, message: 'Cannot rest while traveling.' };
        var house = getHouseInTown(tid);
        if (!house) return { success: false, message: 'You have no house in this town.' };
        var max = getMaxEnergy();
        var needed = max - (player.energy || 0);
        var rate = getRestEnergyRate(house.type);
        var ticks = Math.ceil(needed / rate);
        return restForTicks(house.type, ticks);
    }

    function restAtInn(townId) {
        _sync();
        return restForTicks('inn_room', Math.ceil((getMaxEnergy() - (player.energy || 0)) / getRestEnergyRate('inn_room')));
    }

    function sleepOutside() {
        _sync();
        return restForTicks('outside', Math.ceil((getMaxEnergy() - (player.energy || 0)) / getRestEnergyRate('outside')));
    }

    function restAtMasterQuarters() {
        _sync();
        if (!player.indentured || !player.indentured.active) {
            return { success: false, message: 'You are not an indentured servant.' };
        }
        return restForTicks('master_quarters', Math.ceil((getMaxEnergy() - (player.energy || 0)) / getRestEnergyRate('master_quarters')));
    }


    // -- Thirst System --
    // ── Thirst System ──

    function tickThirst() {
        _sync();
        if (!player.alive) return;

        // Auto-thirst in jail
        if (player.jailedUntilDay > 0 && Engine.getDay() < player.jailedUntilDay) {
            if ((player.thirst || 0) < 50) player.thirst = 50;
        }

        var injDebuffs = Player.getInjuryDebuffs();
        var thirstDecay = THIRST_CONFIG.DECAY_PER_DAY * (injDebuffs.thirstRate || 1.0);
        player.thirst = Math.max(0, (player.thirst != null ? player.thirst : THIRST_CONFIG.START) - thirstDecay);

        if (player.townId && !player.traveling) {
            // Military soldiers get water from the kingdom — skip auto-buy
            if (!player.militaryActive) {
            var town = Engine.findTown(player.townId);
            if (town && player.thirst < 60) {
                // Try to auto-buy beverages from market
                for (var bi = 0; bi < THIRST_CONFIG.BEVERAGE_TYPES.length && player.thirst < 80; bi++) {
                    var bevId = THIRST_CONFIG.BEVERAGE_TYPES[bi];
                    var supply = (town.market.supply[bevId] || 0);
                    var price = town.market.prices[bevId] || 2;
                    if (supply > 0 && player.gold >= price) {
                        town.market.supply[bevId]--;
                        player.gold -= price;
                        logFinance(-price, 'food_drink', 'Bought food/drink');
                        var restore = THIRST_CONFIG.BEVERAGE_RESTORE[bevId] || 20;
                        player.thirst = Math.min(THIRST_CONFIG.MAX, player.thirst + restore);
                        // Apply beverage effects
                        var effects = THIRST_CONFIG.BEVERAGE_EFFECTS[bevId];
                        if (effects && effects.happiness && player.happiness != null) {
                            player.happiness = Math.min(100, player.happiness + effects.happiness);
                        }
                    }
                }
            }
            } // end if not military
        } else if (player.traveling) {
            // Drink from inventory while traveling
            if (player.thirst < 50) {
                for (var ti = 0; ti < THIRST_CONFIG.BEVERAGE_TYPES.length; ti++) {
                    var drinkId = THIRST_CONFIG.BEVERAGE_TYPES[ti];
                    if ((player.inventory[drinkId] || 0) > 0) {
                        player.inventory[drinkId]--;
                        if (player.inventory[drinkId] <= 0) delete player.inventory[drinkId];
                        player.thirst = Math.min(THIRST_CONFIG.MAX, player.thirst + (THIRST_CONFIG.BEVERAGE_RESTORE[drinkId] || 20));
                        break;
                    }
                }
                if (player.thirst <= 0) {
                    if (typeof UI !== 'undefined' && UI.toast) {
                        UI.toast('⚠️ You are dehydrated! Find water soon!', 'danger');
                    }
                }
            }
        }

        // Dehydration effects
        if (player.thirst <= THIRST_CONFIG.DEHYDRATED_THRESHOLD) {
            // Speed reduction handled in travel tick
            // Energy drain from dehydration
            if (player.thirst <= 0) {
                player.energy = Math.max(0, (player.energy || 0) - 3);
                // Health loss from severe dehydration
                if (!player._lastDehydrateTick || Engine.getDay() > player._lastDehydrateTick) {
                    player._lastDehydrateTick = Engine.getDay();
                    player.health = Math.max(0, (player.health || 100) - 2);
                    if (player.health <= 0 && player.alive && !window._godInvincible) {
                        player.deathCause = 'dehydration';
                        Engine.logEvent('💀 ' + player.fullName + ' has died of dehydration.');
                        if (typeof UI !== 'undefined' && UI.toast) {
                            UI.toast('💀 You have died of dehydration!', 'danger', 'critical');
                        }
                        player.alive = false;
                        if (typeof handlePlayerDeath === 'function') handlePlayerDeath();
                    }
                }
            } else {
                // Mild dehydration — reduced energy
                player.energy = Math.max(0, (player.energy || 0) - 1);
            }
        }
    }

    function getThirstDebuffs() {
        _sync();
        if ((player.thirst != null ? player.thirst : THIRST_CONFIG.START) > THIRST_CONFIG.DEHYDRATED_THRESHOLD) return null;
        return {
            travelSpeed: -THIRST_CONFIG.DEHYDRATED_SPEED_PENALTY,
            workPay: -THIRST_CONFIG.DEHYDRATED_WORK_PENALTY,
        };
    }

    // ── Food & Drink Supply Helpers ──

    function getFoodSupply() {
        _sync();
        var total = 0;
        var items = [];
        var allTypes = HUNGER_CONFIG.FOOD_TYPES.concat(HUNGER_CONFIG.RAW_FOOD_TYPES);
        for (var i = 0; i < allTypes.length; i++) {
            var qty = player.inventory[allTypes[i]] || 0;
            if (qty > 0) {
                var restore = HUNGER_CONFIG.RAW_FOOD_TYPES.indexOf(allTypes[i]) !== -1 ? HUNGER_CONFIG.RAW_FOOD_RESTORE : HUNGER_CONFIG.FOOD_RESTORE;
                items.push({ id: allTypes[i], qty: qty, restore: restore });
                total += qty;
            }
        }
        // Estimate days: each food item restores X hunger, decay is Y per day
        var totalRestore = 0;
        for (var j = 0; j < items.length; j++) totalRestore += items[j].qty * items[j].restore;
        var daysEstimate = HUNGER_CONFIG.DECAY_PER_DAY > 0 ? Math.floor(totalRestore / HUNGER_CONFIG.DECAY_PER_DAY) : 999;
        return { total: total, items: items, daysEstimate: daysEstimate };
    }

    function getDrinkSupply() {
        _sync();
        var total = 0;
        var items = [];
        for (var i = 0; i < THIRST_CONFIG.BEVERAGE_TYPES.length; i++) {
            var bev = THIRST_CONFIG.BEVERAGE_TYPES[i];
            var qty = player.inventory[bev] || 0;
            if (qty > 0) {
                var restore = THIRST_CONFIG.BEVERAGE_RESTORE[bev] || 20;
                items.push({ id: bev, qty: qty, restore: restore });
                total += qty;
            }
        }
        var totalRestore = 0;
        for (var j = 0; j < items.length; j++) totalRestore += items[j].qty * items[j].restore;
        var daysEstimate = THIRST_CONFIG.DECAY_PER_DAY > 0 ? Math.floor(totalRestore / THIRST_CONFIG.DECAY_PER_DAY) : 999;
        return { total: total, items: items, daysEstimate: daysEstimate };
    }

    function eatUntilFull() {
        _sync();
        if (!player.alive) return { success: false, message: 'Cannot eat.' };
        if (player.hunger >= HUNGER_CONFIG.MAX) return { success: false, message: 'Already full.' };
        var eaten = 0;
        var allTypes = HUNGER_CONFIG.FOOD_TYPES.concat(HUNGER_CONFIG.RAW_FOOD_TYPES);
        while (player.hunger < HUNGER_CONFIG.MAX) {
            var found = false;
            for (var i = 0; i < allTypes.length; i++) {
                var fid = allTypes[i];
                if ((player.inventory[fid] || 0) > 0) {
                    var _stale = _isNextFoodStale(player, fid);
                    player.inventory[fid]--;
                    Engine.removeFoodCohort(player, fid, 1);
                    if (player.inventory[fid] <= 0) delete player.inventory[fid];
                    var restore = HUNGER_CONFIG.RAW_FOOD_TYPES.indexOf(fid) !== -1 ? HUNGER_CONFIG.RAW_FOOD_RESTORE : HUNGER_CONFIG.FOOD_RESTORE;
                    if (_stale) restore = Math.floor(restore / 2);
                    player.hunger = Math.min(HUNGER_CONFIG.MAX, player.hunger + restore);
                    eaten++;
                    found = true;
                    break;
                }
            }
            if (!found) break;
        }
        if (eaten === 0) return { success: false, message: 'No food in inventory.' };
        return { success: true, message: 'Ate ' + eaten + ' item' + (eaten > 1 ? 's' : '') + '. Hunger: ' + Math.floor(player.hunger) };
    }

    function drinkUntilFull() {
        _sync();
        if (!player.alive) return { success: false, message: 'Cannot drink.' };
        if (player.thirst >= THIRST_CONFIG.MAX) return { success: false, message: 'Already quenched.' };
        var drunk = 0;
        while (player.thirst < THIRST_CONFIG.MAX) {
            var found = false;
            for (var i = 0; i < THIRST_CONFIG.BEVERAGE_TYPES.length; i++) {
                var bid = THIRST_CONFIG.BEVERAGE_TYPES[i];
                if ((player.inventory[bid] || 0) > 0) {
                    player.inventory[bid]--;
                    if (player.inventory[bid] <= 0) delete player.inventory[bid];
                    var restore = THIRST_CONFIG.BEVERAGE_RESTORE[bid] || 20;
                    player.thirst = Math.min(THIRST_CONFIG.MAX, player.thirst + restore);
                    // Apply beverage effects
                    var effects = THIRST_CONFIG.BEVERAGE_EFFECTS[bid];
                    if (effects && effects.happiness && player.happiness != null) {
                        player.happiness = Math.min(100, player.happiness + effects.happiness);
                    }
                    drunk++;
                    found = true;
                    break;
                }
            }
            if (!found) break;
        }
        if (drunk === 0) return { success: false, message: 'No drinks in inventory.' };
        return { success: true, message: 'Drank ' + drunk + ' item' + (drunk > 1 ? 's' : '') + '. Thirst: ' + Math.floor(player.thirst) };
    }

    function drawWaterFromWell(townId) {
        _sync();
        var tid = townId || player.townId;
        if (player.traveling) return { success: false, message: 'Cannot draw water while traveling.' };
        var town = Engine.findTown(tid);
        if (!town) return { success: false, message: 'No town found.' };

        // Find an active (non-depleted) well
        var activeWell = null;
        if (town.buildings) {
            for (var i = 0; i < town.buildings.length; i++) {
                var b = town.buildings[i];
                if ((b.type === 'well' && !b.depleted) || b.type === 'cistern') {
                    activeWell = b;
                    break;
                }
            }
        }
        // Outpost well upgrade counts as a well (infinite water, no depletion)
        if (!activeWell && town.isOutpost && town.outpostUpgrades && town.outpostUpgrades.indexOf('well') >= 0) {
            activeWell = { type: 'outpost_well', _isOutpostWell: true };
        }
        if (!activeWell) return { success: false, message: 'No active well in ' + (town.name || 'this town') + '.' + (town.isOutpost ? ' Build a Well upgrade first.' : ' All wells have run dry!') };

        // Outpost well: free, skip rep check
        var isOutpostWell = activeWell._isOutpostWell;

        // Check kingdom law on well water (skip for outpost wells)
        var kingdom = Engine.findKingdom(town.kingdomId);
        var isFree = isOutpostWell || (kingdom && kingdom.laws && kingdom.laws.freeWellWater !== false); // default true
        var cost = isFree ? 0 : 1;

        if (cost > 0 && player.gold < cost) {
            return { success: false, message: 'Well water costs ' + cost + 'g in this kingdom. You can\'t afford it.' };
        }

        // Check rep — need at least non-hostile rep to use the well (skip for outpost wells)
        if (!isOutpostWell) {
            var townKingdomId = town.kingdomId;
            var townRep = player.reputation && townKingdomId ? (player.reputation[townKingdomId] || 0) : 0;
            if (townRep < -30) {
                return { success: false, message: 'The townsfolk won\'t let you near the well. Your reputation is too low.' };
            }
        }

        // Pay cost
        if (cost > 0) {
            player.gold -= cost;
            player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + cost;
        }

        // Advance time
        if (typeof Game !== 'undefined' && Game.advanceTicks) Game.advanceTicks(THIRST_CONFIG.WELL_DRAW_TICKS);

        // Deduct from well water supply
        var drawAmount = THIRST_CONFIG.WELL_DRAW_AMOUNT;
        if (activeWell.type === 'well' && activeWell.waterRemaining != null) {
            var actualDraw = Math.min(drawAmount, activeWell.waterRemaining);
            activeWell.waterRemaining -= actualDraw;
            if (activeWell.waterRemaining <= 0) {
                activeWell.waterRemaining = 0;
                activeWell.depleted = true;
            }
        }

        // Give water
        player.inventory.water = (player.inventory.water || 0) + drawAmount;

        // Also drink immediately if thirsty
        if (player.thirst < 70) {
            player.thirst = Math.min(THIRST_CONFIG.MAX, player.thirst + THIRST_CONFIG.BEVERAGE_RESTORE.water);
        }

        // Build status message with water remaining info
        var costMsg = isFree ? '(free well water)' : '(-' + cost + 'g)';
        var waterInfo = '';
        if (activeWell.type === 'well' && activeWell.waterCapacity) {
            var pct = Math.round((activeWell.waterRemaining / activeWell.waterCapacity) * 100);
            waterInfo = ' Well: ' + Math.floor(activeWell.waterRemaining).toLocaleString() + '/' + activeWell.waterCapacity.toLocaleString() + ' (' + pct + '%)';
        }
        return { success: true, message: '💧 Drew ' + drawAmount + ' water from the well. ' + costMsg + waterInfo };
    }

    // -- Exports --
    Player.tickHunger = tickHunger;
    Player.getMaxEnergy = getMaxEnergy;
    Player.consumeEnergy = consumeEnergy;
    Player.restoreEnergy = restoreEnergy;
    Player.getJobEnergyCostPerTick = getJobEnergyCostPerTick;
    Player.checkEnergyForAction = checkEnergyForAction;
    Player.getEnergyDebuffs = getEnergyDebuffs;
    Player.getLowEnergyModifier = getLowEnergyModifier;
    Player.addFatigue = addFatigue;
    Player.checkFatigueForAction = checkFatigueForAction;
    Player.energySubtick = energySubtick;
    Player.tickEnergy = tickEnergy;
    Player.tickFatigue = tickFatigue;
    Player.getAvailableRestOptions = getAvailableRestOptions;
    Player.restForTicks = restForTicks;
    Player.restAtHome = restAtHome;
    Player.rest = restAtHome;
    Player.restAtInn = restAtInn;
    Player.sleepOutside = sleepOutside;
    Player.restAtMasterQuarters = restAtMasterQuarters;
    Player.tickThirst = tickThirst;
    Player.getThirstDebuffs = getThirstDebuffs;
    Player.getFoodSupply = getFoodSupply;
    Player.getDrinkSupply = getDrinkSupply;
    Player.eatUntilFull = eatUntilFull;
    Player.eat = eatUntilFull;
    Player.drinkUntilFull = drinkUntilFull;
    Player.drink = drinkUntilFull;
    Player.drawWaterFromWell = drawWaterFromWell;

})(window.Player);