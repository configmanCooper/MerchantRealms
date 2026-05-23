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
    function _consumeBuildingWorkCost(bt) {
        // v9p33river431: only charge the shift after all validation passes so
        // missing-input failures do not burn ticks or energy.
        if ((player.ticksRemaining || 0) >= 15) {
            player.ticksRemaining -= 15;
        } else {
            player.ticksRemaining = 0;
        }
        if (Player.consumeEnergy) {
            var _ePerTick = 2.0;
            if (bt) {
                if (bt.category === 'farm') _ePerTick = 2.0;
                else if (bt.category === 'mining' || bt.category === 'mine') _ePerTick = 3.0;
                else if (bt.category === 'processing') _ePerTick = 2.5;
                else if (bt.category === 'finished') _ePerTick = 2.0;
                else if (bt.category === 'retail' || bt.category === 'trade') _ePerTick = 1.5;
                else if (bt.category === 'storage') _ePerTick = 0.5;
            }
            Player.consumeEnergy(15 * _ePerTick);
        }
    }
    function _getManualOutputStorageState(bt, bld, outputId) {
        // v9p33river431: manual shifts now honor the same output storage cap
        // used by daily production and manager auto-handling.
        var cap = Player._bldStorageCap ? Player._bldStorageCap(bt.storage || 50, bld.level) : Math.floor((bt.storage || 50) * (1 + (((bld.level || 1) - 1) * 0.50)));
        if (cap <= 0) return { cap: 0, space: Infinity };
        var outputSet = {};
        outputSet[outputId] = true;
        if (bt.canProduce) {
            for (var _moi = 0; _moi < bt.canProduce.length; _moi++) outputSet[bt.canProduce[_moi]] = true;
        }
        if (bt.availableProducts) {
            for (var _mok in bt.availableProducts) {
                var _mor = bt.availableProducts[_mok];
                if (_mor && _mor.produces) outputSet[_mor.produces] = true;
            }
        }
        var consumed = Player.getBuildingConsumedGoods ? Player.getBuildingConsumedGoods(bt) : (bt.consumes || {});
        for (var consumedId in consumed) delete outputSet[consumedId];
        var used = 0;
        if (bld.inventory) {
            for (var invId in bld.inventory) {
                if (!outputSet[invId]) continue;
                var invRes = findResource(invId);
                used += (bld.inventory[invId] || 0) * (invRes ? (invRes.weight || 1) : 1);
            }
        }
        var outRes = findResource(outputId);
        var outWeight = outRes ? (outRes.weight || 1) : 1;
        return {
            cap: cap,
            space: Math.max(0, Math.floor((cap - used) / outWeight))
        };
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

        // v9p33river312: validate building type AND that it's a producer
        // before deducting ticks/energy. Was checking only bt below,
        // burning a full work action on civic/storage/retail-non-
        // production buildings that hit the early-return at the
        // bt.produces check (line ~92).
        var bt = findBuildingType(bld.type);
        if (!bt) return { success: false, message: 'Unknown building type.' };
        var _isWorkable = !!(bt.retailConfig || bt.produces);
        if (!_isWorkable) return { success: false, message: 'This building does not produce goods or support a retail shift.' };

        // Retail buildings — player works the counter
        if (bt.retailConfig) {
            // v9p33river431: retail shifts still pay the normal work cost, but
            // only after the building passed all early validation.
            _consumeBuildingWorkCost(bt);
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

        // v9p33river312: apply condition penalty so working at a 'used'/
        // 'breaking' building doesn't pretend everything's fine. Matches
        // the multiplier used by the daily production loop.
        var condPenalty = 1.0;
        var _cond = bld.condition || 'new';
        if (_cond === 'used') condPenalty = 0.85;
        else if (_cond === 'breaking') condPenalty = 0.55;
        else if (_cond === 'destroyed') return { success: false, message: 'This building is destroyed.' };

        // Player counts as 1 worker worth of production (fraction = 1/baseWorkers)
        var baseWorkers = Math.max(bt.workers, 1);
        var playerWorkerFraction = 1 / baseWorkers;

        var rawOutput = activeRate * playerWorkerFraction * seasonMod * levelBonus * playerSkillMult * condPenalty;
        var output = Math.max(1, Math.round(rawOutput));
        var outputState = _getManualOutputStorageState(bt, bld, activeProduces);
        var storedOutput = Math.min(output, outputState.space);
        var overflowOutput = Math.max(0, output - storedOutput);

        // v9p33river431: production shifts only spend the action after both the
        // recipe inputs and output storage rules have been validated.
        _consumeBuildingWorkCost(bt);

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
        if (storedOutput > 0) {
            bld.inventory[activeProduces] = (bld.inventory[activeProduces] || 0) + storedOutput;
        }

        var overflowRevenue = 0;
        if (overflowOutput > 0) {
            var sellTown = ENGINE_REF ? ENGINE_REF.findTown(bld.townId) : null;
            if (sellTown && !sellTown.isOutpost && sellTown.market) {
                if (!sellTown.market.supply) sellTown.market.supply = {};
                var overflowRes = findResource(activeProduces);
                var overflowPrice = (sellTown.market.prices && sellTown.market.prices[activeProduces]) || ((overflowRes && overflowRes.basePrice) || 1);
                overflowRevenue = Math.floor(overflowOutput * overflowPrice);
                player.stats = player.stats || {};
                player.gold += overflowRevenue;
                player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + overflowRevenue;
                sellTown.market.supply[activeProduces] = (sellTown.market.supply[activeProduces] || 0) + overflowOutput;
                if (ENGINE_REF && ENGINE_REF.transferFoodCohorts) ENGINE_REF.transferFoodCohorts(bld, sellTown.market, activeProduces, overflowOutput);
                if (Player.logFinance) Player.logFinance(overflowRevenue, 'building_sales', 'Sold ' + overflowOutput + ' ' + activeProduces + ' (manual overflow)');
            }
        }

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
        var overflowMsg = '';
        if (overflowOutput > 0 && overflowRevenue > 0) overflowMsg = ' Storage was full, so ' + overflowOutput + ' auto-sold for ' + overflowRevenue + 'g.';
        else if (overflowOutput > 0) overflowMsg = ' Storage was full, so ' + overflowOutput + ' could not be stored.';

        // Story Mode: notify of work shift
        if (player.storyMode && player.storyMode.active && typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('work_shift', { buildingType: bld.type, buildingId: buildingId });
        }

        return {
            success: true,
            message: '🔨 Worked a shift at ' + bt.name + '! Produced ' + output + ' ' + prodName + '.' + overflowMsg + ' (+3 XP)',
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
        // v9p33river306: previously deducted 15 more ticks here AFTER the
        // entry path already deducted 15 (line ~54). Total = 30 ticks for
        // retail work, half a day spent. Removed the double-deduction.

        // Bonus: extra customers attracted by player presence
        var bonusCustomers = 2 + Math.floor((player.fame || 0) / 25);
        bld._playerRetailBonus = bonusCustomers;

        // Player gains XP
        player.xp = (player.xp || 0) + 2;
        player.stats = player.stats || {};
        // v9p33river431: retail shifts award XP too, so keep total XP stats in sync.
        player.stats.totalXpEarned = (player.stats.totalXpEarned || 0) + 2;

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
        } else if (bt.category === 'mining' || bt.category === 'mine') {
            // v9p33river305: building catalog uses 'mining' (see
            // player_building_mgmt.js:67) but this branch only matched
            // 'mine'. Accept both so mining skill bonuses actually apply.
            if (hasSkill('master_foreman')) mult += 0.20;
            else if (hasSkill('foreman')) mult += 0.10;
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
        // v9p33river351: working enough shifts unlocks the canonical
        // production skill for that category — bypasses prereqs and the
        // SP cost. Same skill ID as the SP-purchasable version, so the
        // production bonus, abilities, and UI rendering all work
        // identically once unlocked.
        //   farm        → soil_knowledge    (industry)
        //   mining/mine → foreman           (industry)
        //   processing  → efficient_builder (industry)
        //   finished    → efficient_builder (industry)
        var skillKey = null;
        if (bt.category === 'farm') skillKey = 'soil_knowledge';
        else if (bt.category === 'mining' || bt.category === 'mine') skillKey = 'foreman';
        else if (bt.category === 'processing' || bt.category === 'finished') skillKey = 'efficient_builder';

        if (skillKey && !Player.hasSkill(skillKey)) {
            // Track progress toward unlocking the skill
            if (!player._skillProgress) player._skillProgress = {};
            player._skillProgress[skillKey] = (player._skillProgress[skillKey] || 0) + 1;
            var unlockAt = (typeof CONFIG !== 'undefined' && CONFIG.WORK_EARNED_SKILL_SHIFTS) ? CONFIG.WORK_EARNED_SKILL_SHIFTS : 30;
            if (player._skillProgress[skillKey] >= unlockAt) {
                player.skills[skillKey] = true;
                if (typeof UI !== 'undefined' && UI.toast) {
                    var _label = (typeof SKILLS !== 'undefined' && SKILLS[skillKey]) ? (SKILLS[skillKey].icon + ' ' + SKILLS[skillKey].name) : skillKey.replace(/_/g, ' ');
                    UI.toast('🎓 Learned skill through hard work: ' + _label + '!', 'success');
                }
                if (typeof Engine !== 'undefined' && Engine.logEvent) {
                    Engine.logEvent('🎓 ' + (player.fullName || 'You') + ' mastered ' + (SKILLS && SKILLS[skillKey] ? SKILLS[skillKey].name : skillKey) + ' from ' + unlockAt + ' shifts of hard labor.', null, 'my_business');
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

        // v9p33river315: guildMemberships entries are {expiresDay, type}
        // — no rank field. The previous check always failed, hiding the
        // hire-manager option from every player. socialRank 5+ in any
        // kingdom is the canonical "guildmaster" status; also accept any
        // membership flagged with type==='guildmaster'.
        var hasGuildmaster = false;
        if (player.socialRank) {
            for (var _grkk in player.socialRank) {
                if ((player.socialRank[_grkk] || 0) >= 5) { hasGuildmaster = true; break; }
            }
        }
        if (!hasGuildmaster && player.guildMemberships) {
            for (var gId in player.guildMemberships) {
                var _gm = player.guildMemberships[gId];
                if (_gm && (_gm.rank === 'guildmaster' || _gm.type === 'guildmaster')) { hasGuildmaster = true; break; }
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
                if (p.alive && p.age >= 18 && p.age <= 60 && !p.isEliteMerchant && !p.isKing && !p.isNoble && !p.employerId &&
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
        // v9p33river312: bt.wage doesn't exist on BUILDING_TYPES configs
        // (config.js:1839+ has cost/workers/produces/etc but no wage).
        // Was always falling back to the same flat 8g base wage. Scale
        // by category instead so capital/skilled buildings cost more.
        var bt = findBuildingType(bld.type);
        var _wageByCat = { mine: 14, mining: 14, military: 14, processing: 11, finished: 11, farm: 8, harvest: 8, storage: 6, retail: 7, port: 9, medical: 12 };
        var baseWage = (bt && (bt.wage || _wageByCat[bt.category])) || 8;
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
        manager.employerId = 'player';

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

        var firedManagerId = bld._managerId;
        if (Player.modifyRelationship) Player.modifyRelationship(firedManagerId, -10, 'fired');
        var firedManager = ENGINE_REF ? ENGINE_REF.findPerson(firedManagerId) : null;
        if (firedManager && firedManager.employerId === 'player') firedManager.employerId = null; // v9p33river329: keep NPC employment state in sync.
        if (Player && Player.state && Player.state.employees) {
            var empIdx = Player.state.employees.indexOf(firedManagerId);
            if (empIdx >= 0) Player.state.employees.splice(empIdx, 1);
        }

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
            var leavingManagerId = bld._managerId;
            if (bld.workers) {
                var idx = bld.workers.indexOf(leavingManagerId);
                if (idx >= 0) bld.workers.splice(idx, 1);
            }
            var leavingManager = ENGINE_REF ? ENGINE_REF.findPerson(leavingManagerId) : null;
            if (leavingManager && leavingManager.employerId === 'player') leavingManager.employerId = null; // v9p33river329: clear manager employment when they leave.
            if (Player && Player.state && Player.state.employees) {
                var lmIdx = Player.state.employees.indexOf(leavingManagerId);
                if (lmIdx >= 0) Player.state.employees.splice(lmIdx, 1);
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
            if (!Array.isArray(bld.workers)) bld.workers = []; // v9p33river334: legacy buildings may lack workers arrays after sync.

            var manager = ENGINE_REF ? ENGINE_REF.findPerson(bld._managerId) : null;
            // Manager died or left the town
            if (!manager || !manager.alive) {
                bld._managerId = null;
                bld._managerName = null;
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚠️ Your manager at ' + (findBuildingType(bld.type) || { name: bld.type }).name + ' is no longer available.', 'warning');
                continue;
            }

            // Pay salary
            if (bld._managerLastPaidDay !== day) { // v9p33river334: tick can run more than once per day; charge salary once daily.
                bld._managerLastPaidDay = day;
                var salary = bld._managerSalary || 0;
                if (player.gold >= salary) {
                    player.gold -= salary;
                    manager.gold = (manager.gold || 0) + salary;
                    // v9p33river315: missing stats/finance update —
                    // manager salaries drained gold silently.
                    if (player.stats) player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + salary;
                    if (Player.logFinance) Player.logFinance(-salary, 'managers', 'Manager salary (' + (manager.firstName || 'manager') + ')');
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
                        var _mgrCap = Player._bldStorageCap ? Player._bldStorageCap(bt.storage || 50, bld.level) : Math.floor((bt.storage || 50) * (1 + (((bld.level || 1) - 1) * 0.50)));
                        if (_mgrCap > 0) {
                            // v9p33river334: manager auto-buy must respect input storage capacity.
                            var _outSet = {};
                            if (bt.produces) _outSet[bt.produces] = true;
                            if (bt.canProduce) { for (var _mpi = 0; _mpi < bt.canProduce.length; _mpi++) _outSet[bt.canProduce[_mpi]] = true; }
                            if (bt.availableProducts) { for (var _mpk in bt.availableProducts) { var _mpr = bt.availableProducts[_mpk]; if (_mpr && _mpr.produces) _outSet[_mpr.produces] = true; } }
                            var _inputWeight = 0;
                            if (bld.inventory) {
                                for (var _mik in bld.inventory) {
                                    if (_outSet[_mik]) continue;
                                    var _miRes = findResource(_mik);
                                    _inputWeight += (bld.inventory[_mik] || 0) * (_miRes ? (_miRes.weight || 1) : 1);
                                }
                            }
                            var _buyRes = findResource(resId);
                            var _unitWeight = _buyRes ? (_buyRes.weight || 1) : 1;
                            toBuy = Math.min(toBuy, Math.floor(Math.max(0, _mgrCap - _inputWeight) / _unitWeight));
                        }
                        var cost = toBuy * mktPrice;
                        if (toBuy > 0 && player.gold >= cost) {
                            player.gold -= cost;
                            // v9p33river315: manager auto-buy missed
                            // stats + ledger updates, so these costs
                            // were invisible in the finance report.
                            if (player.stats) player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + cost;
                            if (Player.logFinance) Player.logFinance(-cost, 'buildings', 'Manager auto-buy: ' + toBuy + ' ' + resId);
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
                // v9p33river306: production output is written to bld.inventory
                // (see line ~138). Reading player.townStorage missed the
                // manager's actual output, so auto-sell never fired.
                if (!bld.inventory) bld.inventory = {};
                var stored = bld.inventory[outputId] || 0;
                var sellThreshold = bld._managerSkill >= 50 ? 30 : 20;

                if (stored >= sellThreshold && town.market) { // v9p33river334: sell at the threshold too to avoid exact-threshold stalls.
                    var toSell = Math.floor(stored * 0.5);
                    var sellPrice = (town.market.prices && town.market.prices[outputId]) || 5;
                    var totalRevenue = toSell * sellPrice;
                    bld.inventory[outputId] -= toSell;
                    if (bld.inventory[outputId] <= 0) delete bld.inventory[outputId];
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
                                bld.workers.indexOf(wp.id) < 0 && !wp.employerId &&
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
                            var firedWorkerId = bld.workers[fi];
                            bld.workers.splice(fi, 1);
                            if (fWorker.employerId === 'player') fWorker.employerId = null; // v9p33river329: clear fired worker state.
                            if (Player && Player.state && Player.state.employees) {
                                var fwIdx = Player.state.employees.indexOf(firedWorkerId);
                                if (fwIdx >= 0) Player.state.employees.splice(fwIdx, 1);
                            }
                        }
                    }
                }
            }

            // === Caravan trading (if enabled and manager is skilled) ===
            if (bld._managerCaravans && bld._managerSkill >= 50 && day % 10 === 0) {
                _managerCaravanTrade(bld, bt, town, rng);
            }

            // === Check for EM promotion (manager becomes elite merchant) ===
            if (manager.gold > 3000 && !bld._managerProtectedUntil && !bld._managerRaiseRequest && bld._managerLastRaiseRequestDay !== day && rng.chance(0.01)) { // v9p33river334: prevent same-day raise prompt stacking.
                var raisePercent = 10 + Math.floor(rng.random() * 40); // 10-50%
                bld._managerLastRaiseRequestDay = day;
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
        var _seenConn = {};
        var _queue = [];
        if (town.connections) {
            for (var ci = 0; ci < town.connections.length; ci++) _queue.push({ id: town.connections[ci], depth: 1 });
        }
        _seenConn[town.id] = true;
        while (_queue.length > 0) {
            var _nextConn = _queue.shift();
            if (_seenConn[_nextConn.id] || _nextConn.depth > 3) continue;
            _seenConn[_nextConn.id] = true;
            var ct = ENGINE_REF.findTown(_nextConn.id);
            if (ct && !ct.abandoned && !ct.destroyed) {
                connections.push(ct);
                // v9p33river334: managers can use valid indirect trade routes, not just direct neighbors.
                var _ctConns = ct.connections || [];
                for (var _cci = 0; _cci < _ctConns.length; _cci++) {
                    if (!_seenConn[_ctConns[_cci]]) _queue.push({ id: _ctConns[_cci], depth: _nextConn.depth + 1 });
                }
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
            if (!bld.inventory) bld.inventory = {};
            var stored = bld.inventory[outputId] || 0; // v9p33river329: manager output is stored on the building inventory.
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
                            bld.inventory[outputId] -= toSell;
                            if (bld.inventory[outputId] <= 0) delete bld.inventory[outputId];
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
