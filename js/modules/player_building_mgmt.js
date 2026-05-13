/**
 * player_building_mgmt.js — Player building management features
 * - Work at own buildings (C1)
 * - Building manager NPCs (H4)
 * - Building reputation system (M2)
 */
(function(Player) {
    'use strict';
    if (!Player) return;

    var player, ENGINE_REF;
    function _sync() {
        player = Player.state;
        ENGINE_REF = typeof Engine !== 'undefined' ? Engine : null;
    }
    function findBuildingType(typeId) {
        return ENGINE_REF && ENGINE_REF.findBuildingType ? ENGINE_REF.findBuildingType(typeId) : null;
    }
    function findResource(id) {
        if (typeof CONFIG !== 'undefined' && CONFIG.ITEMS) return CONFIG.ITEMS[id] || null;
        return null;
    }

    // ========================================================
    // §1 WORK AT OWN BUILDING (C1)
    // ========================================================

    /**
     * Player spends 1 action (1 day tick) to "work a shift" at an owned production building.
     * Produces goods based on player skill. Output: base rate × skill_multiplier × building_level_bonus.
     * @param {string} buildingId - ID of the player-owned building
     * @returns {{ success: boolean, message: string, produced?: number, resource?: string }}
     */
    function workAtBuilding(buildingId) {
        _sync();
        if (!player || !player.alive) return { success: false, message: 'You are not alive.' };

        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) return { success: false, message: 'Building not found.' };
        if (!bld.active) return { success: false, message: 'Building is not active.' };

        // Check if already worked today
        var day = ENGINE_REF ? ENGINE_REF.getDay() : 0;
        if (bld._playerWorkedDay === day) {
            return { success: false, message: 'You already worked here today.' };
        }

        // Must be in the same town
        if (player.townId !== bld.townId) {
            return { success: false, message: 'You must be in the same town as this building.' };
        }

        // Deduct ticks if available (but don't block — owner can always work their building)
        if ((player.ticksRemaining || 0) >= 15) {
            player.ticksRemaining -= 15;
        } else {
            player.ticksRemaining = 0;
        }

        // v9p33river98: working at your own building now costs energy too,
        // matching the regular work-job flow. Cost scales with building category.
        if (Player.consumeEnergy) {
            var _bt = findBuildingType(bld.type);
            var _ePerTick = 2.0; // default = medium
            if (_bt) {
                if (_bt.category === 'farm') _ePerTick = 2.0;
                else if (_bt.category === 'mining') _ePerTick = 3.0;
                else if (_bt.category === 'processing') _ePerTick = 2.5;
                else if (_bt.category === 'finished') _ePerTick = 2.0;
                else if (_bt.category === 'retail') _ePerTick = 1.5;
                else if (_bt.category === 'storage') _ePerTick = 0.5;
            }
            Player.consumeEnergy(15 * _ePerTick);
        }

        var bt = findBuildingType(bld.type);
        if (!bt) return { success: false, message: 'Unknown building type.' };

        // Retail buildings — player works the counter
        if (bt.retailConfig) {
            return _workRetailShift(bld, bt, day);
        }

        // Production buildings
        if (!bt.produces) return { success: false, message: 'This building does not produce goods.' };

        // Resolve active product for multi-product buildings
        var activeProduct = bld.currentProduct || bld.productionChoice || bt.produces;
        var activeRecipe = (bt.availableProducts && bt.availableProducts[activeProduct]) || null;
        var activeConsumes = activeRecipe ? activeRecipe.consumes : (bt.consumes || {});
        var activeRate = activeRecipe ? (activeRecipe.rate || bt.rate) : bt.rate;
        var activeProduces = activeRecipe ? (activeRecipe.produces || activeProduct) : bt.produces;

        // Check inputs
        if (activeConsumes && Object.keys(activeConsumes).length > 0) {
            for (var resId in activeConsumes) {
                var needed = activeConsumes[resId];
                var available = (bld.inventory && bld.inventory[resId]) || 0;
                if (available < needed) {
                    var res = findResource(resId);
                    return { success: false, message: 'Not enough ' + (res ? res.name : resId) + ' (need ' + needed + ', have ' + available + ').' };
                }
            }
        }

        // Calculate player skill multiplier based on building category
        var playerSkillMult = _getPlayerProductionSkill(bt);

        // Season modifier
        var season = ENGINE_REF ? ENGINE_REF.getSeason() : 'Spring';
        var seasonMod = 1;
        if (bt.category === 'farm') {
            if (season === 'Winter') seasonMod = 0.5;
            else if (season === 'Spring' || season === 'Summer') seasonMod = 1.2;
        }

        var levelBonus = 1 + ((bld.level || 1) - 1) * 0.10;

        // Player counts as 1 worker worth of production (fraction = 1/baseWorkers)
        var baseWorkers = Math.max(bt.workers, 1);
        var playerWorkerFraction = 1 / baseWorkers;

        var rawOutput = activeRate * playerWorkerFraction * seasonMod * levelBonus * playerSkillMult;
        var output = Math.max(1, Math.round(rawOutput));

        // Consume inputs
        if (activeConsumes) {
            for (var cResId in activeConsumes) {
                var cQty = activeConsumes[cResId];
                if (bld.inventory && bld.inventory[cResId]) {
                    bld.inventory[cResId] -= cQty;
                    if (bld.inventory[cResId] <= 0) delete bld.inventory[cResId];
                }
            }
        }

        // Store output in building's own inventory (output storage), matching daily production
        if (!bld.inventory) bld.inventory = {};
        bld.inventory[activeProduces] = (bld.inventory[activeProduces] || 0) + output;

        // Mark as worked today
        bld._playerWorkedDay = day;

        // Player gains XP
        player.xp = (player.xp || 0) + 3;
        player.stats = player.stats || {};
        player.stats.totalXpEarned = (player.stats.totalXpEarned || 0) + 3;

        // Player gains building-related skill (slight improvement)
        _gainProductionSkill(bt);

        var prodRes = findResource(activeProduces);
        var prodName = prodRes ? prodRes.name : activeProduces;

        // Story Mode: notify of work shift
        if (player.storyMode && player.storyMode.active && typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('work_shift', { buildingType: bld.type, buildingId: buildingId });
        }

        return {
            success: true,
            message: '🔨 Worked a shift at ' + bt.name + '! Produced ' + output + ' ' + prodName + '. (+3 XP)',
            produced: output,
            resource: activeProduces
        };
    }

    /**
     * Work a retail shift — player works the counter, boosting sales for the day.
     */
    function _workRetailShift(bld, bt, day) {
        _sync();
        bld._playerWorkedDay = day;
        player.ticksRemaining = (player.ticksRemaining || 0) - 15;

        // Bonus: extra customers attracted by player presence
        var bonusCustomers = 2 + Math.floor((player.fame || 0) / 25);
        bld._playerRetailBonus = bonusCustomers;

        // Player gains XP
        player.xp = (player.xp || 0) + 2;

        return {
            success: true,
            message: '🏪 Worked a shift at ' + bt.name + '! Your presence attracts +' + bonusCustomers + ' extra customers today. (+2 XP)',
            produced: bonusCustomers,
            resource: 'customers'
        };
    }

    /**
     * Get player's production skill multiplier based on building category.
     */
    function _getPlayerProductionSkill(bt) {
        _sync();
        var hasSkill = Player.hasSkill || function() { return false; };
        var mult = 0.7; // base: player is 70% as efficient as a trained worker

        // Category-based skill checks
        if (bt.category === 'farm') {
            if (hasSkill('soil_knowledge')) mult += 0.15;
            if (hasSkill('animal_husbandry')) mult += 0.10;
        } else if (bt.category === 'mine') {
            if (hasSkill('mining_efficiency')) mult += 0.15;
        } else if (bt.category === 'processing' || bt.category === 'finished') {
            if (hasSkill('efficient_builder')) mult += 0.15;
            if (hasSkill('master_foreman')) mult += 0.20;
            else if (hasSkill('foreman')) mult += 0.10;
        }

        // General bonus for experienced players
        var totalBuildings = (player.buildings || []).length;
        if (totalBuildings > 5) mult += 0.05;
        if (totalBuildings > 10) mult += 0.05;

        return Math.min(1.5, mult);
    }

    /**
     * Grant slight skill improvement from working at a building.
     */
    function _gainProductionSkill(bt) {
        _sync();
        if (!player.skills) player.skills = {};
        var skillKey = null;
        if (bt.category === 'farm') skillKey = 'soil_knowledge';
        else if (bt.category === 'mine') skillKey = 'mining_efficiency';
        else if (bt.category === 'processing' || bt.category === 'finished') skillKey = 'efficient_builder';

        if (skillKey && !Player.hasSkill(skillKey)) {
            // Track progress toward unlocking the skill
            if (!player._skillProgress) player._skillProgress = {};
            player._skillProgress[skillKey] = (player._skillProgress[skillKey] || 0) + 1;
            // Unlock after 30 shifts
            if (player._skillProgress[skillKey] >= 30) {
                player.skills[skillKey] = true;
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast('🎓 Learned skill: ' + skillKey.replace(/_/g, ' ') + '!', 'success');
                }
            }
        }
    }

    // ========================================================
    // §2 BUILDING MANAGER NPCs (H4)
    // ========================================================

    /**
     * Hire a manager NPC for a building. Must be guildmaster rank.
     * Manager handles auto-buy, auto-sell, worker management, and caravans.
     */
    function hireManager(buildingId) {
        _sync();
        if (!player || !player.alive) return { success: false, message: 'You are not alive.' };

        // Check guildmaster rank
        var hasGuildmaster = false;
        if (player.guildMemberships) {
            for (var gId in player.guildMemberships) {
                if (player.guildMemberships[gId].rank === 'guildmaster') { hasGuildmaster = true; break; }
            }
        }
        if (!hasGuildmaster) return { success: false, message: 'You must be a guildmaster to hire managers.' };

        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) return { success: false, message: 'Building not found.' };
        if (bld._managerId) return { success: false, message: 'This building already has a manager.' };

        var town = ENGINE_REF ? ENGINE_REF.findTown(bld.townId) : null;
        if (!town) return { success: false, message: 'Town not found.' };

        // Find a suitable NPC in the town
        var candidates = [];
        if (ENGINE_REF && ENGINE_REF.getPeopleInTown) {
            var people = ENGINE_REF.getPeopleInTown(bld.townId);
            for (var i = 0; i < people.length; i++) {
                var p = people[i];
                if (p.alive && p.age >= 18 && p.age <= 60 && !p.isEliteMerchant && !p.isKing && !p.isNoble &&
                    (!p.occupation || p.occupation === 'laborer' || p.occupation === 'merchant' || p.occupation === 'none')) {
                    candidates.push(p);
                }
            }
        }

        if (candidates.length === 0) return { success: false, message: 'No eligible manager candidates in this town.' };

        // Pick best candidate by social/intelligence
        candidates.sort(function(a, b) {
            var aScore = ((a.personality && a.personality.social) || 30) + ((a.personality && a.personality.intelligence) || 30);
            var bScore = ((b.personality && b.personality.social) || 30) + ((b.personality && b.personality.intelligence) || 30);
            return bScore - aScore;
        });

        var manager = candidates[0];

        // Calculate salary (3-4x normal worker wage)
        var bt = findBuildingType(bld.type);
        var baseWage = (bt && bt.wage) || 8;
        var localWageMod = (town.prosperity || 50) / 50;
        var managerSalary = Math.round(baseWage * localWageMod * 3.5);

        if (player.gold < managerSalary) {
            return { success: false, message: 'Cannot afford manager salary of ' + managerSalary + 'g/day.' };
        }

        // Hire the manager
        bld._managerId = manager.id;
        bld._managerName = ((manager.firstName || '') + ' ' + (manager.lastName || '')).trim();
        bld._managerSalary = managerSalary;
        bld._managerSkill = (manager.workerSkill || 0) + ((manager.personality && manager.personality.intelligence) || 30) * 0.5;
        bld._managerHireDay = ENGINE_REF ? ENGINE_REF.getDay() : 0;
        bld._managerCaravans = false; // player must enable

        // Manager counts as one worker
        if (!bld.workers) bld.workers = [];
        if (bld.workers.indexOf(manager.id) < 0) bld.workers.push(manager.id);

        // v9p33river121: register manager as an employee so player.employees
        // stays in sync with bld.workers (used by sidebar count and other
        // legacy reads).
        if (Player && Player.state && Player.state.employees) {
            if (Player.state.employees.indexOf(manager.id) < 0) {
                Player.state.employees.push(manager.id);
            }
        }
        if (manager.employerId == null) manager.employerId = 'player';

        // Track employee relationship
        if (Player.modifyRelationship) Player.modifyRelationship(manager.id, 5, 'employer');

        return {
            success: true,
            message: '👔 Hired ' + bld._managerName + ' as manager of ' + (bt ? bt.name : bld.type) + '! Salary: ' + managerSalary + 'g/day.',
            managerId: manager.id,
            salary: managerSalary
        };
    }

    /**
     * Fire a building manager.
     */
    function fireManager(buildingId) {
        _sync();
        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) return { success: false, message: 'Building not found.' };
        if (!bld._managerId) return { success: false, message: 'This building has no manager.' };

        var name = bld._managerName || 'Manager';
        // Remove from workers
        if (bld.workers) {
            var idx = bld.workers.indexOf(bld._managerId);
            if (idx >= 0) bld.workers.splice(idx, 1);
        }

        if (Player.modifyRelationship) Player.modifyRelationship(bld._managerId, -10, 'fired');

        bld._managerId = null;
        bld._managerName = null;
        bld._managerSalary = 0;
        bld._managerSkill = 0;
        bld._managerHireDay = 0;
        bld._managerCaravans = false;

        return { success: true, message: '🚫 Fired ' + name + ' from manager position.' };
    }

    /**
     * Toggle manager caravan trading for a building.
     */
    function toggleManagerCaravans(buildingId) {
        _sync();
        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld || !bld._managerId) return { success: false, message: 'No manager at this building.' };
        bld._managerCaravans = !bld._managerCaravans;
        return { success: true, message: 'Manager caravan trading ' + (bld._managerCaravans ? 'enabled' : 'disabled') + '.' };
    }

    /**
     * Respond to manager raise request (when EM promotion is pending).
     * @param {string} buildingId
     * @param {boolean} accept - true to give raise, false to let them leave
     */
    function respondToManagerRaise(buildingId, accept) {
        _sync();
        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld || !bld._managerId) return { success: false, message: 'No manager at this building.' };
        if (!bld._managerRaiseRequest) return { success: false, message: 'No raise request pending.' };

        if (accept) {
            var raisePercent = bld._managerRaiseRequest.raisePercent || 20;
            bld._managerSalary = Math.round(bld._managerSalary * (1 + raisePercent / 100));
            bld._managerProtectedUntil = (ENGINE_REF ? ENGINE_REF.getDay() : 0) + 180;
            bld._managerRaiseRequest = null;
            return { success: true, message: '💰 Gave ' + bld._managerName + ' a ' + raisePercent + '% raise. They will stay for 180 more days.' };
        } else {
            // Manager leaves to become EM
            var name = bld._managerName;
            if (bld.workers) {
                var idx = bld.workers.indexOf(bld._managerId);
                if (idx >= 0) bld.workers.splice(idx, 1);
            }
            bld._managerId = null;
            bld._managerName = null;
            bld._managerSalary = 0;
            bld._managerSkill = 0;
            bld._managerRaiseRequest = null;
            return { success: true, message: name + ' left to become an elite merchant. You need a new manager.' };
        }
    }

    /**
     * Tick manager AI — called from tickBuildings in player.js or from main tick.
     * Managers auto-buy inputs, auto-sell output, hire/fire workers, and run caravans.
     */
    function tickBuildingManagers() {
        _sync();
        if (!player || !player.buildings || !player.alive) return;
        var rng = ENGINE_REF ? ENGINE_REF.getRng() : null;
        if (!rng) return;
        var day = ENGINE_REF ? ENGINE_REF.getDay() : 0;

        for (var bi = 0; bi < player.buildings.length; bi++) {
            var bld = player.buildings[bi];
            if (!bld._managerId) continue;

            var manager = ENGINE_REF ? ENGINE_REF.findPerson(bld._managerId) : null;
            // Manager died or left the town
            if (!manager || !manager.alive) {
                bld._managerId = null;
                bld._managerName = null;
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚠️ Your manager at ' + (findBuildingType(bld.type) || { name: bld.type }).name + ' is no longer available.', 'warning');
                continue;
            }

            // Pay salary
            if (day % 1 === 0) { // daily
                var salary = bld._managerSalary || 0;
                if (player.gold >= salary) {
                    player.gold -= salary;
                    manager.gold = (manager.gold || 0) + salary;
                } else {
                    // Can't pay — manager quits after 3 days
                    bld._managerUnpaidDays = (bld._managerUnpaidDays || 0) + 1;
                    if (bld._managerUnpaidDays >= 3) {
                        if (typeof UI !== 'undefined' && UI.toast) UI.toast('😤 ' + bld._managerName + ' quit due to unpaid wages!', 'danger');
                        fireManager(bld.id);
                        continue;
                    }
                }
            }

            // Manager skill growth
            if (bld._managerSkill < 100) {
                bld._managerSkill = Math.min(100, bld._managerSkill + 0.04);
            }

            var bt = findBuildingType(bld.type);
            if (!bt) continue;
            var town = ENGINE_REF ? ENGINE_REF.findTown(bld.townId) : null;
            if (!town) continue;

            // Manager skill affects production: unskilled = -25%, skilled = +10%
            var skillEff = bld._managerSkill >= 70 ? 1.10 : bld._managerSkill >= 40 ? 1.0 : 0.75;
            bld._managerEfficiency = skillEff;

            // === Auto-buy inputs (smarter with higher skill) ===
            if (bt.consumes && bld.autoBuy !== false) {
                var activeConsumes = bt.consumes;
                var activeRecipe = bt.availableProducts && bt.availableProducts[bld.currentProduct || bt.produces];
                if (activeRecipe && activeRecipe.consumes) activeConsumes = activeRecipe.consumes;

                for (var resId in activeConsumes) {
                    var needed = activeConsumes[resId];
                    var current = (bld.inventory && bld.inventory[resId]) || 0;
                    var targetStock = needed * (bld._managerSkill >= 50 ? 10 : 5); // skilled managers stock more

                    if (current < targetStock && town.market && town.market.supply) {
                        var mktAvail = town.market.supply[resId] || 0;
                        var mktPrice = (town.market.prices && town.market.prices[resId]) || 5;
                        var toBuy = Math.min(mktAvail, targetStock - current);
                        var cost = toBuy * mktPrice;
                        if (toBuy > 0 && player.gold >= cost) {
                            player.gold -= cost;
                            town.market.supply[resId] -= toBuy;
                            if (!bld.inventory) bld.inventory = {};
                            bld.inventory[resId] = (bld.inventory[resId] || 0) + toBuy;
                        }
                    }
                }
            }

            // === Auto-sell output (if stored > threshold) ===
            if (bt.produces && day % 3 === 0) {
                var outputId = bld.currentProduct || bt.produces;
                var stored = (player.townStorage && player.townStorage[bld.townId] && player.townStorage[bld.townId][outputId]) || 0;
                var sellThreshold = bld._managerSkill >= 50 ? 30 : 20;

                if (stored > sellThreshold && town.market) {
                    var toSell = Math.floor(stored * 0.5);
                    var sellPrice = (town.market.prices && town.market.prices[outputId]) || 5;
                    var totalRevenue = toSell * sellPrice;
                    player.townStorage[bld.townId][outputId] -= toSell;
                    if (player.townStorage[bld.townId][outputId] <= 0) delete player.townStorage[bld.townId][outputId];
                    // Add to market supply
                    if (!town.market.supply) town.market.supply = {};
                    town.market.supply[outputId] = (town.market.supply[outputId] || 0) + toSell;
                    player.gold += totalRevenue;
                    player.stats = player.stats || {};
                    player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + totalRevenue;
                }
            }

            // === Worker management (hire workers when short) ===
            if (bt.workers && day % 7 === 0 && bld._managerSkill >= 30) {
                var maxWorkers = bt.workers + ((bld.level || 1) - 1);
                if (bld.workers.length < maxWorkers) {
                    // Try to hire from local pool
                    if (ENGINE_REF && ENGINE_REF.getPeopleInTown) {
                        var townPeople = ENGINE_REF.getPeopleInTown(bld.townId);
                        for (var wi = 0; wi < townPeople.length && bld.workers.length < maxWorkers; wi++) {
                            var wp = townPeople[wi];
                            if (wp.alive && wp.age >= 16 && wp.age <= 60 && !wp.isEliteMerchant && !wp.isKing &&
                                wp.id !== bld._managerId &&
                                bld.workers.indexOf(wp.id) < 0 &&
                                (!wp.occupation || wp.occupation === 'laborer' || wp.occupation === 'none')) {
                                bld.workers.push(wp.id);
                                // v9p33river121: register in player.employees
                                if (Player && Player.state && Player.state.employees && Player.state.employees.indexOf(wp.id) < 0) {
                                    Player.state.employees.push(wp.id);
                                }
                                wp.employerId = 'player';
                                break;
                            }
                        }
                    }
                }

                // Fire underperformers (skill check with skilled manager)
                if (bld._managerSkill >= 60 && bld.workers.length > 1) {
                    for (var fi = bld.workers.length - 1; fi >= 0; fi--) {
                        if (bld.workers[fi] === bld._managerId) continue;
                        var fWorker = ENGINE_REF ? ENGINE_REF.findPerson(bld.workers[fi]) : null;
                        if (fWorker && (fWorker.workerSkill || 0) < 10 && rng.chance(0.05)) {
                            bld.workers.splice(fi, 1);
                        }
                    }
                }
            }

            // === Caravan trading (if enabled and manager is skilled) ===
            if (bld._managerCaravans && bld._managerSkill >= 50 && day % 10 === 0) {
                _managerCaravanTrade(bld, bt, town, rng);
            }

            // === Check for EM promotion (manager becomes elite merchant) ===
            if (manager.gold > 3000 && !bld._managerProtectedUntil && !bld._managerRaiseRequest && rng.chance(0.01)) {
                var raisePercent = 10 + Math.floor(rng.random() * 40); // 10-50%
                bld._managerRaiseRequest = {
                    raisePercent: raisePercent,
                    requestDay: day,
                    managerName: bld._managerName
                };
                if (typeof UI !== 'undefined' && UI.toast) {
                    UI.toast('💼 ' + bld._managerName + ' wants a ' + raisePercent + '% raise or they\'ll leave to become an elite merchant!', 'warning');
                }
            }
        }
    }

    /**
     * Manager caravan trade: buy cheap inputs from connected towns, sell output if better price.
     */
    function _managerCaravanTrade(bld, bt, town, rng) {
        _sync();
        if (!ENGINE_REF) return;
        // Find connected towns
        var connections = [];
        if (town.connections) {
            for (var ci = 0; ci < town.connections.length; ci++) {
                var ct = ENGINE_REF.findTown(town.connections[ci]);
                if (ct && !ct.abandoned && !ct.destroyed) connections.push(ct);
            }
        }
        if (connections.length === 0) return;

        // Buy inputs cheaper from connected towns
        if (bt.consumes) {
            var activeConsumes = bt.consumes;
            var activeRecipe = bt.availableProducts && bt.availableProducts[bld.currentProduct || bt.produces];
            if (activeRecipe && activeRecipe.consumes) activeConsumes = activeRecipe.consumes;

            for (var resId in activeConsumes) {
                var localPrice = (town.market.prices && town.market.prices[resId]) || 999;
                for (var ci2 = 0; ci2 < connections.length; ci2++) {
                    var ct2 = connections[ci2];
                    var remotePrice = (ct2.market && ct2.market.prices && ct2.market.prices[resId]) || 999;
                    var remoteAvail = (ct2.market && ct2.market.supply && ct2.market.supply[resId]) || 0;
                    // Buy if 20%+ cheaper
                    if (remotePrice < localPrice * 0.8 && remoteAvail > 5) {
                        var caravanCost = 10; // flat caravan hire cost
                        var toBuy = Math.min(10, remoteAvail);
                        var totalCost = toBuy * remotePrice + caravanCost;
                        if (player.gold >= totalCost) {
                            player.gold -= totalCost;
                            ct2.market.supply[resId] -= toBuy;
                            if (!bld.inventory) bld.inventory = {};
                            bld.inventory[resId] = (bld.inventory[resId] || 0) + toBuy;
                        }
                        break;
                    }
                }
            }
        }

        // Sell output if better price elsewhere
        if (bt.produces) {
            var outputId = bld.currentProduct || bt.produces;
            var stored = (player.townStorage && player.townStorage[bld.townId] && player.townStorage[bld.townId][outputId]) || 0;
            if (stored > 15) {
                var localSellPrice = (town.market.prices && town.market.prices[outputId]) || 5;
                for (var ci3 = 0; ci3 < connections.length; ci3++) {
                    var ct3 = connections[ci3];
                    var remoteP = (ct3.market && ct3.market.prices && ct3.market.prices[outputId]) || 0;
                    if (remoteP > localSellPrice * 1.3) {
                        var toSell = Math.min(10, stored);
                        var caravanFee = 10;
                        var revenue = toSell * remoteP - caravanFee;
                        if (revenue > 0) {
                            player.townStorage[bld.townId][outputId] -= toSell;
                            if (player.townStorage[bld.townId][outputId] <= 0) delete player.townStorage[bld.townId][outputId];
                            if (!ct3.market.supply) ct3.market.supply = {};
                            ct3.market.supply[outputId] = (ct3.market.supply[outputId] || 0) + toSell;
                            player.gold += revenue;
                        }
                        break;
                    }
                }
            }
        }
    }

    // ========================================================
    // §3 BUILDING REPUTATION SYSTEM (M2)
    // ========================================================

    /**
     * Tick building reputation for all player retail buildings.
     * Rep based on: stock consistency, fair prices, quality, worker satisfaction, condition.
     */
    function tickBuildingReputation() {
        _sync();
        if (!player || !player.buildings || !player.alive) return;
        var day = ENGINE_REF ? ENGINE_REF.getDay() : 0;
        if (day % 3 !== 0) return; // every 3 days

        for (var bi = 0; bi < player.buildings.length; bi++) {
            var bld = player.buildings[bi];
            var bt = findBuildingType(bld.type);
            if (!bt || !bt.retailConfig) continue;

            if (bld._reputation == null) bld._reputation = 30; // start at 30
            if (!bld._repName) bld._repName = null; // custom name

            var repDelta = 0;

            // Stock consistency: having goods = +rep
            var stockTotal = 0;
            var stockTypes = 0;
            if (bld.retailStock) {
                for (var sk in bld.retailStock) {
                    stockTotal += (bld.retailStock[sk] || 0);
                    if (bld.retailStock[sk] > 0) stockTypes++;
                }
            }
            var acceptsGoods = (bt.retailConfig.acceptsGoods || []).length;
            var stockVariety = acceptsGoods > 0 ? stockTypes / acceptsGoods : 0;
            if (stockVariety >= 0.5) repDelta += 0.3;
            else if (stockVariety > 0) repDelta += 0.1;
            else repDelta -= 0.5; // empty shop loses rep

            // Fair prices: lower markup = better rep
            var markup = 1.3;
            if (bld._retailMarkup != null) markup = bld._retailMarkup;
            else if (bt.retailConfig.baseMarkup) markup = bt.retailConfig.baseMarkup;
            if (markup <= 1.3) repDelta += 0.2; // fair
            else if (markup >= 2.0) repDelta -= 0.3; // gouging

            // Quality goods (fine/excellent items boost rep)
            if (bld.retailStock) {
                for (var qk in bld.retailStock) {
                    if (qk.indexOf('fine_') === 0 || qk.indexOf('_good') > 0) repDelta += 0.1;
                    if (qk.indexOf('excellent') > 0 || qk.indexOf('_excellent') > 0) repDelta += 0.2;
                }
            }

            // Worker satisfaction
            var workerCount = Array.isArray(bld.workers) ? bld.workers.length : 0;
            if (workerCount >= (bt.workers || 1)) repDelta += 0.1;
            else repDelta -= 0.2; // understaffed

            // Building condition
            var cond = bld.condition || 'new';
            if (cond === 'new' || cond === 'good') repDelta += 0.1;
            else if (cond === 'damaged') repDelta -= 0.5;
            else if (cond === 'worn') repDelta -= 0.1;

            // Manager bonus
            if (bld._managerId && bld._managerSkill >= 50) repDelta += 0.15;

            // Clamp reputation
            bld._reputation = Math.max(0, Math.min(100, bld._reputation + repDelta));

            // Rep affects customer count: high rep = more customers
            // Applied in tickRetailBuildings via _repCustomerMod
            bld._repCustomerMod = 0.7 + (bld._reputation / 100) * 0.6; // 0.7 at rep 0, 1.3 at rep 100
        }
    }

    /**
     * Set a custom name for a retail building.
     */
    function nameBuildingRetail(buildingId, name) {
        _sync();
        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) return { success: false, message: 'Building not found.' };
        if (!name || name.length < 2 || name.length > 40) return { success: false, message: 'Name must be 2-40 characters.' };
        bld._repName = name;
        return { success: true, message: '✨ Building renamed to "' + name + '"!' };
    }

    // ========================================================
    // §4 EXPORTS
    // ========================================================

    Player.workAtBuilding = workAtBuilding;
    Player.hireManager = hireManager;
    Player.fireManager = fireManager;
    Player.toggleManagerCaravans = toggleManagerCaravans;
    Player.respondToManagerRaise = respondToManagerRaise;
    Player.tickBuildingManagers = tickBuildingManagers;
    Player.tickBuildingReputation = tickBuildingReputation;
    Player.nameBuildingRetail = nameBuildingRetail;

})(window.Player);
