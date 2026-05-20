// ========================================================
// engine_military.js
// Wilderness Outpost System & Outpost Risk Events
// Extracted from engine.js sections §15B-2, §25b
// ========================================================
(function(Engine) {
    "use strict";
    if (!Engine) throw new Error("Engine must be loaded before engine_military.js");

    // ── Internal state ──
    var world;
    function _syncState() {
        world = Engine.getWorld();
    }

    // ── Already-exported Engine utilities ──
    var logEvent = function(msg, details, category) { Engine.logEvent(msg, details, category); };
    var findTown = function(id) { return Engine.findTown(id); };
    var findKingdom = function(id) { return Engine.findKingdom(id); };
    var findPerson = function(id) { return Engine.findPerson(id); };
    var findResourceById = function(id) { return Engine.findResourceById(id); };
    var findBuildingType = function(id) { return Engine.findBuildingType(id); };
    var uid = function(prefix) { return Engine.uid(prefix); };
    var assignRandomQuirks = function(rng) { return Engine.assignRandomQuirks(rng); };
    var buildNewRoad = function(from, to, by, opts) { return Engine.buildNewRoad(from, to, by, opts); };
    var createMarket = function(popScale, tier) { return Engine.createMarket(popScale, tier); };
    var classifyTownTerrain = function(town) { return Engine.classifyTownTerrain(town); };
    var computeLocalBasePrices = function(town) { return Engine.computeLocalBasePrices(town); };
    var findTerrainPath = function(sx, sy, ex, ey, mode) { return Engine.findTerrainPath(sx, sy, ex, ey, mode); };
    var createBridgeObjects = function(waypoints) { return Engine.createBridgeObjects(waypoints); };
    var registerPerson = function(p) { return Engine.registerPerson(p); };
    var registerTown = function(t) { return Engine.registerTown(t); };

    // Terrain survey wrappers (exported with different names on Engine)
    var _surveyDepositsAtPoint = function(wx, wy, radius) { return Engine.surveyDepositsAtPoint(wx, wy, radius); };
    var _surveyFertilityAtPoint = function(wx, wy, radius) { return Engine.surveyFertilityAtPoint(wx, wy, radius); };

    // ========================================================
    // §15B-2 WILDERNESS OUTPOST SYSTEM
    // ========================================================

    /**
     * Found a new wilderness outpost.
     * @param {object} opts - { founderId, founderType ('player'|'elite'|'npc'), x, y, name, kingdomId, nearRoadId }
     * @returns {{ success: boolean, message: string, outpost?: object }}
     */
    function foundOutpost(opts) {
        var cfg = CONFIG.OUTPOST_CONFIG;
        if (!opts || !opts.founderId || !opts.name) return { success: false, message: 'Invalid outpost parameters.' };

        // Minimum distance check — must be at least N tiles from any existing location
        var minDistTiles = cfg.minDistanceTiles || 10;
        var minDistPx = minDistTiles * (CONFIG.TILE_SIZE || 16);
        var tooCloseLocation = null;
        for (var ci = 0; ci < world.towns.length; ci++) {
            var ct = world.towns[ci];
            if (ct.abandoned || ct.destroyed || ct.isJunction) continue;
            var cdist = Math.hypot((opts.x || 0) - ct.x, (opts.y || 0) - ct.y);
            if (cdist < minDistPx) { tooCloseLocation = ct; break; }
        }
        if (tooCloseLocation) {
            return { success: false, message: 'Too close to ' + tooCloseLocation.name + '! Outposts must be at least ' + minDistTiles + ' tiles from any existing location.' };
        }

        // Determine nearest kingdom for jurisdiction
        var kingdomId = opts.kingdomId;
        if (!kingdomId) {
            var nearest = null, nearDist = Infinity;
            for (var ti = 0; ti < world.towns.length; ti++) {
                var t = world.towns[ti];
                // v9p33river333: jurisdiction must come from real settlements, not other outposts/junctions.
                if (t.abandoned || t.destroyed || t.isOutpost || t.isJunction || t.category === 'outpost') continue;
                var dx = (opts.x || 0) - t.x;
                var dy = (opts.y || 0) - t.y;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d < nearDist) { nearDist = d; nearest = t; }
            }
            if (nearest) kingdomId = nearest.kingdomId;
        }

        // Find nearest non-outpost settlement (for road building)
        var nearestSettlement = null;
        var nearestSettleDist = Infinity;
        for (var ti2 = 0; ti2 < world.towns.length; ti2++) {
            var t2 = world.towns[ti2];
            if (t2.abandoned || t2.destroyed || t2.category === 'outpost') continue;
            var dx2 = (opts.x || 0) - t2.x;
            var dy2 = (opts.y || 0) - t2.y;
            var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            if (d2 < nearestSettleDist) { nearestSettleDist = d2; nearestSettlement = t2; }
        }

        var outpost = {
            id: uid('town'),
            name: opts.name,
            x: opts.x || 0,
            y: opts.y || 0,
            kingdomId: kingdomId,
            isCapital: false,
            population: 0,
            buildings: [],
            // v9p33river126: outposts technically retain an internal market
            // structure (so building production / consumption can still run),
            // but the UI hides it everywhere outposts shouldn't trade through
            // a market. The buy/sell paths in caravan-orders already refuse
            // outposts via town.isOutpost guards.
            market: createMarket(1, 'village'),
            prosperity: 10,
            walls: 0,
            garrison: 0,
            happiness: 50,
            isPort: false,
            isIsland: false,
            towers: 0,
            livestock: { livestock_cow: 0, livestock_pig: 0, livestock_chicken: 0 },
            category: 'outpost',
            maxBuildingSlots: cfg.startingLandPlots || 4,
            // Outpost-specific fields
            isOutpost: true,
            founderId: opts.founderId,
            founderType: opts.founderType || 'player',
            foundedDay: world.day,
            maintenancePaid: true,
            lastMaintenanceDay: world.day,
            totalInvested: cfg.foundingCost,
            annexed: false,
            // New outpost system fields
            landPlots: cfg.startingLandPlots || 4,
            usedLandPlots: 0,
            outpostStorage: cfg.baseStorageCapacity || 200,
            outpostStorageItems: {},
            outpostHousing: [],       // array of { type: 'tent_camp'|'cabins'|'cottages', builtDay }
            outpostUpgrades: [],      // array of upgrade IDs installed
            outpostWorkers: [],       // array of NPC IDs hired as workers
            outpostGuards: [],        // array of NPC IDs hired as guards
            outpostResidents: [],     // array of NPC IDs living here
            hasRoad: !!opts.buildWithRoad,
            landForSale: [],          // array of { plots, pricePerPlot }
            outpostHappiness: 50,
            // Legacy compat
            hiredWorkers: 0,
            hiredGuards: 0,
        };

        // Generate natural deposits from terrain survey at this location
        var _outpostR = 120;
        outpost.naturalDeposits = _surveyDepositsAtPoint(outpost.x, outpost.y, _outpostR);
        // v9p33river13: clean up the wood-bonus marker (outposts don't have woodDeposits arrays)
        if (outpost.naturalDeposits.__wood_bonus_groves) delete outpost.naturalDeposits.__wood_bonus_groves;
        if (!outpost.naturalDeposits.clay) {
            var ND = CONFIG.NATURAL_DEPOSITS;
            outpost.naturalDeposits.clay = world.rng.randInt(ND.clay.min, ND.clay.max);
        }
        outpost.soilFertilityRating = _surveyFertilityAtPoint(outpost.x, outpost.y, _outpostR);
        outpost.soilFertility = outpost.soilFertilityRating / ((CONFIG.SOIL_FERTILITY && CONFIG.SOIL_FERTILITY.baselineFertility) || 50);

        world.towns.push(outpost);
        registerTown(outpost);

        // Add to kingdom's territory set
        if (kingdomId) {
            var _foundKingdom = findKingdom(kingdomId);
            if (_foundKingdom && _foundKingdom.territories) {
                if (typeof _foundKingdom.territories.add === 'function') {
                    _foundKingdom.territories.add(outpost.id);
                }
            }
        }

        // Classify terrain and compute local base prices
        outpost.terrainType = classifyTownTerrain(outpost);
        computeLocalBasePrices(outpost);

        // Build road to target settlement if requested
        if (opts.buildWithRoad) {
            var roadTarget = opts.roadTargetTownId ? findTown(opts.roadTargetTownId) : nearestSettlement;
            if (roadTarget) {
                var _roadWp = findTerrainPath(roadTarget.x, roadTarget.y, outpost.x, outpost.y, 'land');
                // v9p33river333: don't create empty/impossible road records when terrain routing fails.
                if (!_roadWp || !_roadWp.waypoints || _roadWp.waypoints.length < 2) {
                    logEvent('⚠️ Could not build a road from ' + roadTarget.name + ' to outpost \"' + outpost.name + '\" — no valid land path.', null, 'my_business');
                } else {
                    var _rpWaypoints = _roadWp.waypoints;
                    var _rpBridges = createBridgeObjects(_rpWaypoints);
                    world.roads.push({
                    fromTownId: roadTarget.id,
                    toTownId: outpost.id,
                    quality: 1,
                    safe: true,
                    hasBridge: _rpBridges.length > 0,
                    bridgeDestroyed: false,
                    bridgeSegments: [],
                    bridges: _rpBridges,
                    waypoints: _rpWaypoints,
                    condition: 'new',
                    builtDay: world.day,
                    lastRepairDay: 0,
                    banditThreat: 15,
                    isDirtTrack: true,
                    });
                    logEvent('🛤️ A road has been built from ' + roadTarget.name + ' to outpost "' + outpost.name + '".', null, 'my_business');
                }
            }
        }

        logEvent('⛺ A new outpost "' + outpost.name + '" has been established in the wilderness by ' +
            (opts.founderType === 'player' ? 'you' : 'an enterprising merchant') + '!' +
            (!opts.buildWithRoad ? ' (No road — offroad access only)' : ''), null, 'my_business');

        return { success: true, message: 'Outpost "' + outpost.name + '" established!', outpost: outpost, nearestSettlement: nearestSettlement, distance: Math.floor(nearestSettleDist) };
    }

    /**
     * Daily tick for all outposts — maintenance, theft, damage, worker upkeep.
     */
    function tickOutposts() {
        var cfg = CONFIG.OUTPOST_CONFIG;
        var rng = world.rng;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var outpost = world.towns[ti];
            if (!outpost.isOutpost || outpost.abandoned || outpost.destroyed) continue;

            // Daily kingdom reassignment — outpost belongs to kingdom of nearest non-outpost town
            if (world.day % 7 === 0) {
                var _nearestT = null, _nearDist = Infinity;
                for (var _ni = 0; _ni < world.towns.length; _ni++) {
                    var _nt = world.towns[_ni];
                    if (_nt.isOutpost || _nt.abandoned || _nt.destroyed || _nt.isJunction) continue;
                    var _dx = outpost.x - _nt.x, _dy = outpost.y - _nt.y;
                    var _nd = Math.sqrt(_dx * _dx + _dy * _dy);
                    if (_nd < _nearDist) { _nearDist = _nd; _nearestT = _nt; }
                }
                if (_nearestT && _nearestT.kingdomId !== outpost.kingdomId) {
                    outpost.kingdomId = _nearestT.kingdomId;
                }
            }

            // Ensure new fields exist (migration)
            if (!outpost.outpostWorkers) outpost.outpostWorkers = [];
            if (!outpost.outpostGuards) outpost.outpostGuards = [];
            if (!outpost.outpostResidents) outpost.outpostResidents = [];
            if (!outpost.outpostHousing) outpost.outpostHousing = [];
            if (!outpost.outpostUpgrades) outpost.outpostUpgrades = [];
            // v9p33river367: legacy outposts can be missing buildings entirely.
            if (!outpost.buildings) outpost.buildings = [];
            if (outpost.landPlots == null) outpost.landPlots = cfg.startingLandPlots || 4;
            if (outpost.usedLandPlots == null) outpost.usedLandPlots = 0;
            if (outpost.outpostStorage == null) outpost.outpostStorage = cfg.baseStorageCapacity || 200;
            if (!outpost.outpostStorageItems) outpost.outpostStorageItems = {};
            if (!outpost.workerAssignments) outpost.workerAssignments = {};
            if (!outpost.workerAssignments._maintenance) outpost.workerAssignments._maintenance = [];
            // Migrate smithy → food_hall
            var _smithyIdx = outpost.outpostUpgrades.indexOf('smithy');
            if (_smithyIdx >= 0) outpost.outpostUpgrades[_smithyIdx] = 'food_hall';

            // Sync legacy fields
            outpost.hiredWorkers = outpost.outpostWorkers.length;
            outpost.hiredGuards = outpost.outpostGuards.length;

            // ── Maintenance costs (deducted from founder) ──
            var numWorkers = outpost.outpostWorkers.length;
            var numGuards = outpost.outpostGuards.length;
            // Weekly wages paid daily: divide by 7
            var dailyWorkerCost = numWorkers * (cfg.workerWagePerWeek || 10) / 7;
            var dailyGuardCost = numGuards * (cfg.guardWagePerWeek || 15) / 7;
            var dailyCost = cfg.dailyMaintenanceCost + dailyWorkerCost + dailyGuardCost;

            var founder = null;
            if (outpost.founderType === 'player') {
                outpost._dailyMaintenanceDue = dailyCost;
            } else {
                founder = findPerson(outpost.founderId);
                if (founder && founder.alive) {
                    if ((founder.gold || 0) >= dailyCost) {
                        founder.gold -= dailyCost;
                        outpost.maintenancePaid = true;
                        outpost.lastMaintenanceDay = world.day;
                    } else {
                        outpost.maintenancePaid = false;
                    }
                } else {
                    outpost.maintenancePaid = false;
                }
            }

            // ── Abandonment from no maintenance ──
            if (!outpost.maintenancePaid && outpost.founderType !== 'player') {
                var daysSinceUpkeep = world.day - (outpost.lastMaintenanceDay || outpost.foundedDay);
                if (daysSinceUpkeep >= cfg.abandonDaysNoMaintenance) {
                    outpost.abandoned = true;
                    outpost.abandonedDay = world.day;
                    logEvent('💀 The outpost "' + outpost.name + '" has been abandoned due to lack of maintenance.', null, 'my_business');
                    continue;
                }
            }

            // ── Theft risk ──
            var theftChance = cfg.theftChancePerDay;
            theftChance -= numGuards * cfg.securityPerGuard;
            theftChance -= (cfg.wallTheftReduction[outpost.walls] || 0);
            // Watchtower upgrade reduces theft further (only if worker assigned)
            if (outpost.outpostUpgrades.indexOf('watchtower') >= 0 && outpost.workerAssignments && outpost.workerAssignments.watchtower) {
                var wtCfg = CONFIG.OUTPOST_UPGRADES && CONFIG.OUTPOST_UPGRADES.watchtower;
                theftChance -= (wtCfg && wtCfg.theftReduction) || 0.02;
            }
            theftChance = Math.max(theftChance, 0.005);

            if (rng.chance(theftChance)) {
                // Steal from outpost market/warehouse
                var stolenValue = 0;
                var stolenItems = [];
                var supplyKeys = Object.keys(outpost.market.supply).filter(function(k) {
                    return (outpost.market.supply[k] || 0) > 0;
                });
                if (supplyKeys.length > 0) {
                    var stolenKey = supplyKeys[rng.randInt(0, supplyKeys.length - 1)];
                    var maxSteal = Math.min(outpost.market.supply[stolenKey], rng.randInt(5, 20));
                    if (maxSteal > 0) {
                        outpost.market.supply[stolenKey] -= maxSteal;
                        var res = findResourceById(stolenKey);
                        stolenValue = maxSteal * (res ? res.basePrice : 1);
                        stolenItems.push(maxSteal + ' ' + stolenKey);
                    }
                }
                if (stolenItems.length > 0) {
                    logEvent('🦹 Thieves raided outpost "' + outpost.name + '" and stole ' + stolenItems.join(', ') +
                        ' (worth ~' + Math.floor(stolenValue) + 'g)!', null, 'my_business');
                }
            }

            // ── Building damage risk (weather, animals, wear) ──
            var dmgChance = cfg.damageChancePerDay;
            dmgChance -= (outpost.walls > 0 ? 0.01 : 0);
            dmgChance = Math.max(dmgChance, 0.005);

            if (rng.chance(dmgChance) && outpost.buildings.length > 0) {
                var bIdx = rng.randInt(0, outpost.buildings.length - 1);
                var bld = outpost.buildings[bIdx];
                if (bld.condition === 'new') {
                    bld.condition = 'used';
                    logEvent('⚠️ A building at outpost "' + outpost.name + '" suffered weather damage.', { townId: outpost.townId || null }, 'my_business');
                } else if (bld.condition === 'used') {
                    bld.condition = 'breaking';
                    logEvent('⚠️ A building at outpost "' + outpost.name + '" is breaking down!', { townId: outpost.townId || null }, 'my_business');
                }
            }

            // ── Prosperity growth from upgrades ──
            if (outpost.maintenancePaid || outpost.founderType === 'player') {
                var _prospGain = 0.05; // base daily prosperity gain
                var _upList = outpost.outpostUpgrades || [];
                for (var _pi = 0; _pi < _upList.length; _pi++) {
                    var _uid = _upList[_pi];
                    if (_uid === 'market_stall')     _prospGain += 0.08; // slight
                    else                             _prospGain += 0.03; // very slight for all others
                }
                // Housing prosperity: log cabins very slightly, cottages moderately
                var _housingList = outpost.outpostHousing || [];
                for (var _phi = 0; _phi < _housingList.length; _phi++) {
                    var _hType = _housingList[_phi].type;
                    if (_hType === 'cottages')         _prospGain += 0.12; // moderate per cottage
                    else if (_hType === 'cabins')     _prospGain += 0.03; // very slight per cabin
                    else                              _prospGain += 0.02; // tiny for other housing
                }
                outpost.prosperity = Math.min(100, (outpost.prosperity || 10) + _prospGain);
                // Sync population with actual residents
                outpost.population = outpost.outpostResidents.length;

                // Ensure workerAssignments migration
                if (!outpost.workerAssignments) outpost.workerAssignments = {};
                if (!outpost.workerAssignments._maintenance) outpost.workerAssignments._maintenance = [];

                // ── Helper: check if an upgrade is actively staffed ──
                function _isActive(upId) {
                    return outpost.outpostUpgrades.indexOf(upId) >= 0 && !!outpost.workerAssignments[upId];
                }

                // ── NPC Needs Satisfaction ──
                // Compute need bonuses from active upgrades
                var needFood = 20;      // base food satisfaction
                var needSafety = 20;    // base safety
                var needHappiness = 30; // base happiness
                var needHealth = 30;    // base health
                var needWealth = 15;    // base wealth

                // Food Hall: greatly helps food
                if (_isActive('food_hall')) needFood += 40;
                // Tavern: happiness + slight food
                if (_isActive('tavern')) { needHappiness += 15; needFood += 10; }
                // Chapel: happiness
                if (_isActive('chapel')) needHappiness += 15;
                // Market Stalls: slight food + wealth
                if (_isActive('market_stall')) { needFood += 8; needWealth += 15; }
                // Watchtower: security/safety
                if (_isActive('watchtower')) needSafety += 25;
                // Clinic: health
                if (_isActive('clinic')) needHealth += 20;
                // Well: base health/food
                if (outpost.outpostUpgrades.indexOf('well') >= 0) { needHealth += 10; needFood += 5; }
                // Guards: safety
                if (numGuards > 0) needSafety += numGuards * 8;
                // Walls: greatly increase security
                needSafety += (outpost.walls || 0) * 15;
                // Road: wealth/food
                if (outpost.hasRoad) { needWealth += 5; needFood += 5; }
                // Housing comfort
                for (var _hi = 0; _hi < outpost.outpostHousing.length; _hi++) {
                    var _hCfg = CONFIG.OUTPOST_HOUSING && CONFIG.OUTPOST_HOUSING[outpost.outpostHousing[_hi].type];
                    if (_hCfg) needHappiness += (_hCfg.comfort || 0) * 0.15;
                }

                // Cap needs at 100
                needFood = Math.min(100, needFood);
                needSafety = Math.min(100, needSafety);
                needHappiness = Math.min(100, needHappiness);
                needHealth = Math.min(100, needHealth);
                needWealth = Math.min(100, needWealth);

                // Store on outpost for UI
                outpost.npcNeeds = { food: needFood, safety: needSafety, happiness: needHappiness, health: needHealth, wealth: needWealth };

                // Compute overall happiness from needs
                var ohBase = (needFood + needSafety + needHappiness + needHealth + needWealth) / 5;
                outpost.outpostHappiness = Math.min(100, Math.max(10, Math.round(ohBase)));

                // ── Clinic: heal 2 sick residents per day ──
                if (_isActive('clinic') && outpost.population > 0) {
                    var _healed = 0;
                    for (var _si = 0; _si < world.people.length && _healed < 2; _si++) {
                        var _sp = world.people[_si];
                        if (_sp.townId !== outpost.id || !_sp.alive) continue;
                        if (_sp.sick && (_sp.illness || (_sp.illnesses && _sp.illnesses.length > 0))) {
                            // v9p33river367: NPC illness state is primarily singular (illness), with legacy array backups.
                            _sp.sick = false;
                            _sp.illness = null;
                            _sp.illnessSeverity = null;
                            _sp.illnessDay = 0;
                            if (_sp.illnesses) _sp.illnesses = [];
                            _healed++;
                        } else if (_sp.injured) {
                            _sp.injured = false;
                            _sp.injuryDaysLeft = 0;
                            _healed++;
                        }
                    }
                    if (_healed > 0) logEvent('🏥 Clinic at "' + outpost.name + '" healed ' + _healed + ' resident(s).', { _noToast: true }, 'my_business');
                }

                // ── Watchtower: reduce theft further (already applied above in theft section) ──
                // ── Watchtower active: additional theft reduction applied in theft calc ──

                // ── NPC Departure: dissatisfied NPCs leave ──
                var _opCfg = CONFIG.OUTPOST_CONFIG;
                if (outpost.population > 0) {
                    var avgNeed = (needFood + needSafety + needHappiness + needHealth + needWealth) / 5;
                    if (avgNeed < 30) {
                        if (!outpost._npcDissatisfaction) outpost._npcDissatisfaction = 0;
                        outpost._npcDissatisfaction += (_opCfg.npcDissatisfactionPerDay || 1);
                        if (outpost._npcDissatisfaction >= (_opCfg.npcDissatisfactionLeaveThreshold || 60)) {
                            // One NPC leaves (pick non-worker, non-guard first)
                            var _leaveCandidate = null;
                            for (var _li = outpost.outpostResidents.length - 1; _li >= 0; _li--) {
                                var _lId = outpost.outpostResidents[_li];
                                if (outpost.outpostWorkers.indexOf(_lId) < 0 && outpost.outpostGuards.indexOf(_lId) < 0) {
                                    _leaveCandidate = _lId; break;
                                }
                            }
                            if (!_leaveCandidate && outpost.outpostResidents.length > 0) {
                                _leaveCandidate = outpost.outpostResidents[outpost.outpostResidents.length - 1];
                            }
                            if (_leaveCandidate) {
                                var _leaveIdx = outpost.outpostResidents.indexOf(_leaveCandidate);
                                if (_leaveIdx >= 0) outpost.outpostResidents.splice(_leaveIdx, 1);
                                // Remove from workers/guards if applicable
                                var _wIdx = outpost.outpostWorkers.indexOf(_leaveCandidate);
                                if (_wIdx >= 0) outpost.outpostWorkers.splice(_wIdx, 1);
                                var _gIdx = outpost.outpostGuards.indexOf(_leaveCandidate);
                                if (_gIdx >= 0) outpost.outpostGuards.splice(_gIdx, 1);
                                // Unassign from worker roles
                                if (outpost.workerAssignments) {
                                    var _wRoles = ['clinic', 'tavern', 'market_stall', 'watchtower', 'chapel', 'food_hall'];
                                    for (var _wr = 0; _wr < _wRoles.length; _wr++) {
                                        if (outpost.workerAssignments[_wRoles[_wr]] === _leaveCandidate) delete outpost.workerAssignments[_wRoles[_wr]];
                                    }
                                    if (outpost.workerAssignments._maintenance) {
                                        var _mIdx = outpost.workerAssignments._maintenance.indexOf(_leaveCandidate);
                                        if (_mIdx >= 0) outpost.workerAssignments._maintenance.splice(_mIdx, 1);
                                    }
                                }
                                var _leaveNpc = findPerson(_leaveCandidate);
                                if (_leaveNpc) {
                                    // Move to nearest non-outpost town
                                    var _nearestTown = null, _nearDist = Infinity;
                                    for (var _nti = 0; _nti < world.towns.length; _nti++) {
                                        var _nt = world.towns[_nti];
                                        if (_nt.id === outpost.id || _nt.isOutpost || _nt.destroyed || _nt.abandoned) continue;
                                        var _nd = Math.hypot((_nt.x || 0) - (outpost.x || 0), (_nt.y || 0) - (outpost.y || 0));
                                        if (_nd < _nearDist) { _nearDist = _nd; _nearestTown = _nt; }
                                    }
                                    if (_nearestTown) _leaveNpc.townId = _nearestTown.id;
                                    _leaveNpc.occupation = 'unemployed';
                                    _leaveNpc.employerId = null;
                                    logEvent('😞 ' + _leaveNpc.firstName + ' ' + _leaveNpc.lastName + ' left outpost "' + outpost.name + '" due to poor conditions.', { _noToast: true }, 'my_business');
                                }
                                outpost.population = outpost.outpostResidents.length;
                                outpost._npcDissatisfaction = Math.max(0, outpost._npcDissatisfaction - 30);
                            }
                        }
                    } else {
                        // Slowly reduce dissatisfaction when needs are met
                        outpost._npcDissatisfaction = Math.max(0, (outpost._npcDissatisfaction || 0) - 0.5);
                    }
                }

                // ── Building Maintenance Degradation ──
                var maintWorkers = (outpost.workerAssignments._maintenance || []).length;
                var maxMaintBuildings = Math.min(maintWorkers, _opCfg.maxMaintainedBuildings || 10);
                // Count player-owned buildings in this outpost
                var playerBuildings = outpost.buildings.filter(function(b) { return b.ownerId === 'player' || b.ownerId === (typeof player !== 'undefined' ? player.id : 'player'); });
                if (playerBuildings.length > maxMaintBuildings) {
                    // Most recently built building degrades
                    var unmaintained = playerBuildings.slice(maxMaintBuildings);
                    for (var _umi = 0; _umi < unmaintained.length; _umi++) {
                        var _umBld = unmaintained[_umi];
                        if (!_umBld._degradeStart) _umBld._degradeStart = world.day;
                        var _degradeDays = world.day - _umBld._degradeStart;
                        var _maxDegrade = _opCfg.buildingDegradeDays || 30;
                        if (_degradeDays >= _maxDegrade) {
                            // Destroy building, free land slot
                            var _bIdx = outpost.buildings.indexOf(_umBld);
                            if (_bIdx >= 0) outpost.buildings.splice(_bIdx, 1);
                            outpost.usedLandPlots = Math.max(0, (outpost.usedLandPlots || 0) - 1);
                            var _btDef = typeof BUILDING_TYPES !== 'undefined' ? BUILDING_TYPES[(_umBld.type || '').toUpperCase()] : null;
                            logEvent('🏚️ ' + (_btDef ? _btDef.name : _umBld.type) + ' at "' + outpost.name + '" collapsed from neglect and reverted to empty land.', null, 'my_business');
                        } else if (_degradeDays % 7 === 0 && _degradeDays > 0) {
                            // Periodically warn
                            if (_umBld.condition === 'new') _umBld.condition = 'used';
                            else if (_umBld.condition === 'used') _umBld.condition = 'breaking';
                        }
                    }
                } else {
                    // Clear degrade timers on maintained buildings
                    for (var _mi = 0; _mi < playerBuildings.length; _mi++) {
                        if (playerBuildings[_mi]._degradeStart) delete playerBuildings[_mi]._degradeStart;
                    }
                }

                // Auto-attract NPCs from active upgrades (tavern, chapel etc.)
                if (outpost.outpostUpgrades && outpost.outpostUpgrades.length > 0 && outpost.hasRoad) {
                    var _totalAutoChance = 0;
                    for (var _ai = 0; _ai < outpost.outpostUpgrades.length; _ai++) {
                        var _aUpCfg = CONFIG.OUTPOST_UPGRADES && CONFIG.OUTPOST_UPGRADES[outpost.outpostUpgrades[_ai]];
                        // Only count auto-attract if upgrade is active (has worker) or doesn't need one
                        if (_aUpCfg && _aUpCfg.autoAttract) {
                            var _needsW = _aUpCfg.needsWorker;
                            if (!_needsW || _isActive(outpost.outpostUpgrades[_ai])) {
                                _totalAutoChance += (_aUpCfg.autoAttractChance || 0);
                            }
                        }
                    }
                    if (_totalAutoChance > 0 && rng.chance(_totalAutoChance)) {
                        var _housingCap = 0;
                        for (var _hci = 0; _hci < outpost.outpostHousing.length; _hci++) {
                            var _hcCfg = CONFIG.OUTPOST_HOUSING && CONFIG.OUTPOST_HOUSING[outpost.outpostHousing[_hci].type];
                            if (_hcCfg) _housingCap += _hcCfg.capacity;
                        }
                        if (outpost.outpostResidents.length < _housingCap) {
                            var _attractedNpc = _findNpcToAttract(outpost);
                            if (_attractedNpc) {
                                _attractedNpc.townId = outpost.id;
                                outpost.outpostResidents.push(_attractedNpc.id);
                                outpost.population = outpost.outpostResidents.length;
                                logEvent('🏠 ' + _attractedNpc.firstName + ' ' + _attractedNpc.lastName + ' has moved to outpost "' + outpost.name + '"!', { _noToast: true }, 'my_business');
                            }
                        }
                    }
                }
            }
        }
    }

    // ================================================================
    // §25b  OUTPOST RISK EVENTS — Bandit Raids, Fires, Desertion, Disease
    // ================================================================

    /**
     * Bandit Raids — armed bandits attack the outpost, stealing goods and injuring workers.
     * Runs daily for each player-founded outpost.
     */
    function tickOutpostBanditRaids() {
        var risks = CONFIG.OUTPOST_RISKS && CONFIG.OUTPOST_RISKS.banditRaid;
        if (!risks) return;
        var rng = world.rng;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var outpost = world.towns[ti];
            if (!outpost.isOutpost || outpost.abandoned || outpost.destroyed) continue;

            var numGuards = (outpost.outpostGuards || []).length;
            var wallLevel = outpost.walls || 0;
            var hasWatchtower = (outpost.outpostUpgrades || []).indexOf('watchtower') >= 0 &&
                                outpost.workerAssignments && !!outpost.workerAssignments.watchtower;

            // Calculate raid chance
            var raidChance = risks.baseChance;
            raidChance *= (1 - (risks.wallReduction[wallLevel] || 0));
            raidChance -= numGuards * risks.guardReduction;
            if (hasWatchtower) raidChance -= risks.watchtowerReduction;
            raidChance = Math.max(0.001, raidChance);

            if (!rng.chance(raidChance)) continue;

            // Determine number of raiders
            var raiderCount = rng.randInt(risks.raiderCount[0], risks.raiderCount[1]);

            // Guards can repel raiders
            if (numGuards >= raiderCount) {
                logEvent('⚔️🛡️ Bandits attacked outpost "' + outpost.name + '" but were repelled by the guards!',  {
                    type: 'outpost_defense', townId: outpost.id, icon: '⚔️'
                }, 'my_business');
                continue;
            }

            // Raid succeeds — determine how much is stolen
            var stolenPct;
            if (wallLevel >= 3) stolenPct = risks.stolenPctFortified;
            else if (wallLevel === 2) stolenPct = risks.stolenPctStone;
            else if (wallLevel === 1) stolenPct = risks.stolenPctPalisade;
            else stolenPct = risks.stolenPctNoWalls;

            // v9p33river334: tolerate malformed stolenPct config; raids should never produce NaN losses.
            if (!Array.isArray(stolenPct) || stolenPct.length < 2 || !isFinite(stolenPct[0]) || !isFinite(stolenPct[1])) stolenPct = [0.10, 0.25];
            var pctRoll = stolenPct[0] + rng.random() * (stolenPct[1] - stolenPct[0]);

            // Steal from outpost storage
            var stolenItems = [];
            var totalStolenValue = 0;
            var storage = outpost.outpostStorageItems || {};
            var sKeys = Object.keys(storage).filter(function(k) { return (storage[k] || 0) > 0; });
            for (var si = 0; si < sKeys.length; si++) {
                var key = sKeys[si];
                var qty = storage[key] || 0;
                var stolen = Math.max(1, Math.floor(qty * pctRoll));
                if (stolen > qty) stolen = qty;
                if (stolen > 0) {
                    storage[key] -= stolen;
                    if (storage[key] <= 0) delete storage[key];
                    var res = findResourceById(key);
                    totalStolenValue += stolen * (res ? res.basePrice : 1);
                    stolenItems.push(stolen + ' ' + key);
                }
            }

            // Also steal from building inventories at the outpost
            var buildings = outpost.buildings || [];
            for (var bi = 0; bi < buildings.length; bi++) {
                var bld = buildings[bi];
                var bldStorage = bld.outputStorage || bld.storage;
                if (!bldStorage) continue;
                var bKeys = Object.keys(bldStorage).filter(function(k) { return (bldStorage[k] || 0) > 0; });
                for (var bk = 0; bk < bKeys.length; bk++) {
                    var bKey = bKeys[bk];
                    var bQty = bldStorage[bKey] || 0;
                    var bStolen = Math.max(1, Math.floor(bQty * pctRoll * 0.5));
                    if (bStolen > bQty) bStolen = bQty;
                    if (bStolen > 0) {
                        bldStorage[bKey] -= bStolen;
                        if (bldStorage[bKey] <= 0) delete bldStorage[bKey];
                        var bRes = findResourceById(bKey);
                        totalStolenValue += bStolen * (bRes ? bRes.basePrice : 1);
                        stolenItems.push(bStolen + ' ' + bKey);
                    }
                }
            }

            // Injure workers (1-2)
            var injuredNames = [];
            var maxInjured = Math.min(risks.maxInjuredWorkers, (outpost.outpostWorkers || []).length);
            var workerPool = (outpost.outpostWorkers || []).slice();
            for (var ii = 0; ii < maxInjured && workerPool.length > 0; ii++) {
                var wIdx = rng.randInt(0, workerPool.length - 1);
                var wId = workerPool.splice(wIdx, 1)[0];
                var worker = findPerson(wId);
                if (worker && worker.alive) {
                    worker.injured = true;
                    worker.injuryDaysLeft = rng.randInt(risks.injuryHealDays[0], risks.injuryHealDays[1]);
                    worker._injurySource = 'bandit_raid';
                    injuredNames.push(worker.firstName);
                }
            }

            var msg = '🦹⚔️ Bandits raided outpost "' + outpost.name + '"!';
            if (stolenItems.length > 0) msg += ' Stolen: ' + stolenItems.slice(0, 5).join(', ') + ' (~' + Math.floor(totalStolenValue) + 'g).';
            if (injuredNames.length > 0) msg += ' Injured: ' + injuredNames.join(', ') + '.';
            if (stolenItems.length === 0 && injuredNames.length === 0) msg += ' They found little of value.';
            logEvent(msg,  { type: 'outpost_raid', townId: outpost.id, icon: '🦹' }, 'my_business');
        }
    }

    /**
     * Building Fires — random fires damage buildings and destroy inventory.
     * Runs daily for each outpost.
     */
    function tickOutpostFires() {
        var risks = CONFIG.OUTPOST_RISKS && CONFIG.OUTPOST_RISKS.buildingFire;
        if (!risks) return;
        var rng = world.rng;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var outpost = world.towns[ti];
            if (!outpost.isOutpost || outpost.abandoned || outpost.destroyed) continue;
            if (!outpost.buildings || outpost.buildings.length === 0) continue;

            var hasWell = (outpost.outpostUpgrades || []).indexOf('well') >= 0;
            var hasWatchtower = (outpost.outpostUpgrades || []).indexOf('watchtower') >= 0 &&
                                outpost.workerAssignments && !!outpost.workerAssignments.watchtower;
            var wallLevel = outpost.walls || 0;
            var numGuards = (outpost.outpostGuards || []).length;
            var hasCottages = false;
            var housingList = outpost.outpostHousing || [];
            for (var hi = 0; hi < housingList.length; hi++) {
                if (housingList[hi].type === 'cottages') { hasCottages = true; break; }
            }

            // Check each building for fire
            for (var bi = 0; bi < outpost.buildings.length; bi++) {
                var bld = outpost.buildings[bi];
                if (bld.condition === 'destroyed') continue;
                if (bld._fireRepairUntil && world.day < bld._fireRepairUntil) continue; // already being repaired

                var fireChance = risks.baseChance;
                if (hasWell) fireChance *= (1 - risks.wellReduction);
                if (hasWatchtower) fireChance *= (1 - risks.watchtowerReduction);
                if (wallLevel >= 2) fireChance *= (1 - risks.stoneWallReduction);
                if (hasCottages) fireChance *= (1 - risks.cottageReduction);
                fireChance -= numGuards * risks.guardReduction;
                fireChance = Math.max(0.001, fireChance);

                if (!rng.chance(fireChance)) continue;

                // Fire breaks out!
                // Damage condition
                var condDmgPct = risks.conditionDamage[0] + rng.random() * (risks.conditionDamage[1] - risks.conditionDamage[0]);
                if (bld.condition === 'new') {
                    // 15-30% damage — if > 20% transition to 'used'
                    if (condDmgPct > 0.20) bld.condition = 'used';
                } else if (bld.condition === 'used') {
                    // further damage pushes to breaking
                    if (condDmgPct > 0.15) bld.condition = 'breaking';
                } else if (bld.condition === 'breaking') {
                    // Breaking buildings can be destroyed by fire
                    if (condDmgPct > 0.25) bld.condition = 'destroyed';
                }

                // Destroy some inventory
                var invLossPct = risks.inventoryLoss[0] + rng.random() * (risks.inventoryLoss[1] - risks.inventoryLoss[0]);
                var lostItems = [];
                var storages = [bld.outputStorage, bld.inputStorage, bld.storage].filter(Boolean);
                for (var si = 0; si < storages.length; si++) {
                    var st = storages[si];
                    var stKeys = Object.keys(st);
                    for (var sk = 0; sk < stKeys.length; sk++) {
                        var sKey = stKeys[sk];
                        var qty = st[sKey] || 0;
                        var lost = Math.max(1, Math.floor(qty * invLossPct));
                        if (lost > qty) lost = qty;
                        if (lost > 0) {
                            st[sKey] -= lost;
                            if (st[sKey] <= 0) delete st[sKey];
                            lostItems.push(lost + ' ' + sKey);
                        }
                    }
                }

                // Pause production
                var pauseDays = rng.randInt(risks.repairPauseDays[0], risks.repairPauseDays[1]);
                bld._fireRepairUntil = world.day + pauseDays;

                var btDef = typeof BUILDING_TYPES !== 'undefined' ? BUILDING_TYPES[(bld.type || '').toUpperCase()] : null;
                var bName = btDef ? btDef.name : bld.type;
                var msg = '🔥 Fire at outpost "' + outpost.name + '"! ' + bName + ' is damaged (now ' + bld.condition + ').';
                if (lostItems.length > 0) msg += ' Lost: ' + lostItems.slice(0, 4).join(', ') + '.';
                msg += ' Repairs will take ' + pauseDays + ' days.';
                logEvent(msg,  { type: 'outpost_fire', townId: outpost.id, icon: '🔥' }, 'my_business');
                break; // Only one fire per outpost per day
            }
        }
    }

    /**
     * Enhanced Worker Desertion — workers leave if conditions are poor.
     * Stronger than the NPC departure system; targets specific quality-of-life gaps.
     * Runs daily.
     */
    function tickOutpostDesertion() {
        var risks = CONFIG.OUTPOST_RISKS && CONFIG.OUTPOST_RISKS.workerDesertion;
        if (!risks) return;
        var rng = world.rng;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var outpost = world.towns[ti];
            if (!outpost.isOutpost || outpost.abandoned || outpost.destroyed) continue;
            if (!outpost.outpostWorkers || outpost.outpostWorkers.length === 0) continue;

            var upgrades = outpost.outpostUpgrades || [];
            var hasTavern = upgrades.indexOf('tavern') >= 0 && outpost.workerAssignments && !!outpost.workerAssignments.tavern;
            var hasChapel = upgrades.indexOf('chapel') >= 0 && outpost.workerAssignments && !!outpost.workerAssignments.chapel;
            var hasFoodHall = upgrades.indexOf('food_hall') >= 0 && outpost.workerAssignments && !!outpost.workerAssignments.food_hall;

            // Determine best housing type for reduction
            var bestHousingReduction = 0;
            var housingList = outpost.outpostHousing || [];
            for (var hi = 0; hi < housingList.length; hi++) {
                var hReduction = risks.housingReduction[housingList[hi].type] || 0;
                if (hReduction > bestHousingReduction) bestHousingReduction = hReduction;
            }

            // Check morale-based desertion (no tavern and no chapel)
            var moraleDesertion = 0;
            if (!hasTavern && !hasChapel) {
                moraleDesertion = risks.baseChanceNoTavern;
            } else if (!hasTavern || !hasChapel) {
                // One but not both — half the base
                moraleDesertion = risks.baseChanceNoTavern * 0.5;
            }
            // Apply tavern/chapel reductions if partially present
            if (hasTavern) moraleDesertion *= (1 - risks.tavernReduction);
            if (hasChapel) moraleDesertion *= (1 - risks.chapelReduction);
            moraleDesertion *= (1 - bestHousingReduction);

            // Check hunger-based desertion
            var hungerDesertion = 0;
            if (!hasFoodHall) {
                var foodNeed = outpost.npcNeeds ? outpost.npcNeeds.food : 20;
                if (foodNeed < 40) {
                    hungerDesertion = risks.baseChanceHungry;
                    if (hasTavern) hungerDesertion *= (1 - risks.tavernReduction);
                    hungerDesertion *= (1 - bestHousingReduction);
                }
            }

            // Combined desertion chance (whichever is higher, don't double-dip)
            var desertChance = Math.max(moraleDesertion, hungerDesertion);
            if (desertChance <= 0) continue;

            // Check each worker individually
            var workers = outpost.outpostWorkers.slice();
            for (var wi = 0; wi < workers.length; wi++) {
                if (!rng.chance(desertChance)) continue;

                var wId = workers[wi];
                var worker = findPerson(wId);
                if (!worker || !worker.alive) continue;

                // Remove from outpost
                var wIdx = outpost.outpostWorkers.indexOf(wId);
                if (wIdx >= 0) outpost.outpostWorkers.splice(wIdx, 1);
                var rIdx = outpost.outpostResidents.indexOf(wId);
                if (rIdx >= 0) outpost.outpostResidents.splice(rIdx, 1);
                // Unassign from worker roles
                if (outpost.workerAssignments) {
                    var roles = ['clinic', 'tavern', 'market_stall', 'watchtower', 'chapel', 'food_hall'];
                    for (var r = 0; r < roles.length; r++) {
                        if (outpost.workerAssignments[roles[r]] === wId) delete outpost.workerAssignments[roles[r]];
                    }
                    if (outpost.workerAssignments._maintenance) {
                        var mIdx = outpost.workerAssignments._maintenance.indexOf(wId);
                        if (mIdx >= 0) outpost.workerAssignments._maintenance.splice(mIdx, 1);
                    }
                }
                // Move to nearest non-outpost town
                var nearTown = null, nearDist = Infinity;
                for (var nti = 0; nti < world.towns.length; nti++) {
                    var nt = world.towns[nti];
                    if (nt.id === outpost.id || nt.isOutpost || nt.destroyed || nt.abandoned) continue;
                    var nd = Math.hypot((nt.x || 0) - (outpost.x || 0), (nt.y || 0) - (outpost.y || 0));
                    if (nd < nearDist) { nearDist = nd; nearTown = nt; }
                }
                if (nearTown) worker.townId = nearTown.id;
                worker.occupation = 'unemployed';
                worker.employerId = null;
                outpost.population = outpost.outpostResidents.length;

                var reason = hungerDesertion > moraleDesertion ? 'hunger' : 'poor morale';
                logEvent('😞💨 ' + worker.firstName + ' ' + worker.lastName + ' deserted outpost "' + outpost.name + '" due to ' + reason + '.',  {
                    type: 'outpost_desertion', townId: outpost.id, icon: '😞'
                }, 'my_business');
                break; // max one desertion per outpost per day to avoid cascading
            }
        }
    }

    /**
     * Disease Outbreaks — without a clinic, disease can spread through the outpost.
     * Runs daily.
     */
    function tickOutpostDisease() {
        var risks = CONFIG.OUTPOST_RISKS && CONFIG.OUTPOST_RISKS.diseaseOutbreak;
        if (!risks) return;
        var rng = world.rng;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var outpost = world.towns[ti];
            if (!outpost.isOutpost || outpost.abandoned || outpost.destroyed) continue;
            if (!outpost.outpostResidents || outpost.outpostResidents.length < 3) continue; // need people to have an outbreak

            var upgrades = outpost.outpostUpgrades || [];
            var hasClinic = upgrades.indexOf('clinic') >= 0 && outpost.workerAssignments && !!outpost.workerAssignments.clinic;
            var hasWell = upgrades.indexOf('well') >= 0;
            var hasCottages = false;
            var hasTentCamp = false;
            var housingList = outpost.outpostHousing || [];
            for (var hi = 0; hi < housingList.length; hi++) {
                if (housingList[hi].type === 'cottages') hasCottages = true;
                if (housingList[hi].type === 'tent_camp') hasTentCamp = true;
            }

            // Calculate outbreak chance
            var outbreakChance = risks.baseChance;
            if (hasClinic) outbreakChance *= (1 - risks.clinicReduction);
            if (hasWell) outbreakChance *= (1 - risks.wellReduction);
            if (hasCottages) outbreakChance *= (1 - risks.cottageReduction);
            if (hasTentCamp) outbreakChance += risks.tentCampIncrease;
            outbreakChance = Math.max(0.001, outbreakChance);

            if (!rng.chance(outbreakChance)) continue;

            // Outbreak hits — infect 2-5 residents
            var illness = risks.illnesses[rng.randInt(0, risks.illnesses.length - 1)];
            var numToInfect = rng.randInt(risks.infectedCount[0], Math.min(risks.infectedCount[1], outpost.outpostResidents.length));
            var infected = 0;
            var infectedNames = [];
            var candidates = outpost.outpostResidents.slice();
            // Shuffle candidates
            for (var ci = candidates.length - 1; ci > 0; ci--) {
                var cj = rng.randInt(0, ci);
                var tmp = candidates[ci]; candidates[ci] = candidates[cj]; candidates[cj] = tmp;
            }

            for (var ii = 0; ii < candidates.length && infected < numToInfect; ii++) {
                var person = findPerson(candidates[ii]);
                if (!person || !person.alive) continue;
                // Skip already sick
                if (person.illnesses && person.illnesses.length > 0) continue;
                if (person.sick) continue;

                // Use simplified infection (compatible with the existing illness system)
                if (typeof Engine.infectNPC === 'function') {
                    Engine.infectNPC(person, illness, rng, world.day, 'outpost_outbreak');
                } else {
                    // Fallback: manual illness fields
                    if (!person.illnesses) person.illnesses = [];
                    person.illnesses.push({
                        id: illness,
                        startDay: world.day,
                        severity: rng.chance(0.3) ? 'moderate' : 'minor',
                        source: 'outpost_outbreak'
                    });
                    person.sick = true;
                }
                infected++;
                infectedNames.push(person.firstName);
            }

            if (infected > 0) {
                var illnessName = illness.replace(/_/g, ' ');
                illnessName = illnessName.charAt(0).toUpperCase() + illnessName.slice(1);
                logEvent('🤒🏥 Disease outbreak at outpost "' + outpost.name + '"! ' + illnessName + ' has infected ' + infected + ' resident(s): ' +
                    infectedNames.join(', ') + '.' + (hasClinic ? ' The clinic is treating patients.' : ' No clinic available!'),  {
                    type: 'outpost_disease', townId: outpost.id, icon: '🤒'
                }, 'my_business');
            }
        }
    }

    /**
     * Find a random eligible NPC from a connected town to attract to an outpost.
     */
    function _findNpcToAttract(outpost) {
        var roads = world.roads || [];
        var connectedTowns = [];
        for (var ri = 0; ri < roads.length; ri++) {
            var r = roads[ri];
            if (r.fromTownId === outpost.id) connectedTowns.push(r.toTownId);
            else if (r.toTownId === outpost.id) connectedTowns.push(r.fromTownId);
        }
        if (connectedTowns.length === 0) return null;
        var candidates = [];
        for (var pi = 0; pi < world.people.length; pi++) {
            var p = world.people[pi];
            if (!p.alive || p.isEliteMerchant || p.isPlayerGuard) continue;
            if (p.employerId) continue;
            if (connectedTowns.indexOf(p.townId) < 0) continue;
            if (p.age < 16 || p.age > 65) continue;
            if (p.occupation === 'king' || p.occupation === 'queen' || p.occupation === 'prince' || p.occupation === 'princess') continue;
            candidates.push(p);
        }
        if (candidates.length === 0) return null;
        return candidates[world.rng.randInt(0, candidates.length - 1)];
    }

    /**
     * AI Immigration — NPCs and elite merchants evaluate moving to player outposts.
     * Runs periodically (every aiImmigrationCheckInterval days).
     */
    function tickOutpostImmigration() {
        var cfg = CONFIG.OUTPOST_CONFIG;
        var interval = cfg.aiImmigrationCheckInterval || 7;
        if (world.day % interval !== 0) return;
        var rng = world.rng;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var outpost = world.towns[ti];
            if (!outpost.isOutpost || outpost.abandoned || outpost.destroyed) continue;
            if (!outpost.hasRoad && (outpost.outpostUpgrades || []).length === 0) continue;
            if (!outpost.outpostHousing || outpost.outpostHousing.length === 0) continue;
            if (!outpost.outpostResidents) outpost.outpostResidents = [];

            // Population cap
            var maxPop = cfg.maxPopulation || 30;
            if ((outpost.population || 0) >= maxPop) continue;

            // Calculate housing capacity
            var housingCap = 0;
            for (var hi = 0; hi < outpost.outpostHousing.length; hi++) {
                var hCfg = CONFIG.OUTPOST_HOUSING && CONFIG.OUTPOST_HOUSING[outpost.outpostHousing[hi].type];
                if (hCfg) housingCap += hCfg.capacity;
            }
            if (outpost.outpostResidents.length >= housingCap) continue;

            // Calculate attractiveness score
            var attractScore = 0;
            if (outpost.hasRoad) attractScore += 0.3;
            attractScore += (outpost.outpostUpgrades || []).length * 0.1;
            for (var ui = 0; ui < (outpost.outpostUpgrades || []).length; ui++) {
                var uCfg = CONFIG.OUTPOST_UPGRADES && CONFIG.OUTPOST_UPGRADES[outpost.outpostUpgrades[ui]];
                if (uCfg && uCfg.recruitBonus) attractScore += uCfg.recruitBonus;
            }
            // Buildings with unfilled jobs boost attractiveness
            var unfilledJobs = 0;
            for (var bi = 0; bi < outpost.buildings.length; bi++) {
                var bld = outpost.buildings[bi];
                var bType = findBuildingType ? findBuildingType(bld.type || bld.buildingType) : null;
                if (bType && bType.workers) {
                    var currentWorkers = (bld.workers || []).length;
                    unfilledJobs += Math.max(0, (bType.workers || 0) - currentWorkers);
                }
            }
            attractScore += unfilledJobs * 0.05;

            var baseChance = (cfg.aiImmigrationBaseChance || 0.03) * attractScore;
            if (baseChance <= 0) continue;

            // Check connected towns for eligible NPCs
            var connectedTowns = [];
            if (outpost.hasRoad) {
                var roads = world.roads || [];
                for (var ri = 0; ri < roads.length; ri++) {
                    var r = roads[ri];
                    if (r.fromTownId === outpost.id) connectedTowns.push(r.toTownId);
                    else if (r.toTownId === outpost.id) connectedTowns.push(r.fromTownId);
                }
            }
            if (connectedTowns.length === 0) continue;

            // Check a few NPCs from connected towns
            var checkedCount = 0;
            for (var pi = 0; pi < world.people.length && checkedCount < 20; pi++) {
                var p = world.people[pi];
                if (!p.alive || p.isEliteMerchant || p.isPlayerGuard) continue;
                if (p.employerId) continue;
                if (connectedTowns.indexOf(p.townId) < 0) continue;
                if (p.age < 18 || p.age > 60) continue;
                if (p.occupation === 'king' || p.occupation === 'queen') continue;
                checkedCount++;

                if (rng.chance(baseChance)) {
                    // NPC decides to move
                    p.townId = outpost.id;
                    outpost.outpostResidents.push(p.id);
                    outpost.population = outpost.outpostResidents.length;
                    if (outpost.outpostResidents.length >= housingCap) break;
                }
            }
        }
    }

    /**
     * Kingdom annexation of outposts — kingdoms absorb successful outposts into villages.
     */
    function tickOutpostAnnexation() {
        var cfg = CONFIG.OUTPOST_CONFIG;
        if (world.day % cfg.annexationCheckInterval !== 0) return;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var outpost = world.towns[ti];
            if (!outpost.isOutpost || outpost.abandoned || outpost.destroyed || outpost.annexed) continue;

            var kingdom = findKingdom(outpost.kingdomId);
            if (!kingdom) continue;

            // Annexation requires the outpost to be established and have some population
            var daysSinceFounded = world.day - (outpost.foundedDay || 0);
            if (daysSinceFounded < 180) continue; // Must exist for 6 months minimum
            if ((outpost.population || 0) < cfg.annexationMinPop) continue;

            // King personality affects approach
            var willAnnex = false;
            var annexMethod = 'negotiate';

            var kp = kingdom.kingPersonality;
            if (kingdom.king && kp) {
                if (kp.ambition === 'ambitious') {
                    willAnnex = world.rng.chance(0.40);
                    if (kp.temperament === 'cruel') {
                        annexMethod = 'seize';
                    } else if (kp.greed === 'greedy' || kp.greed === 'corrupt') {
                        annexMethod = 'tax_heavily';
                    } else {
                        annexMethod = 'negotiate';
                    }
                } else {
                    willAnnex = world.rng.chance(0.15);
                    annexMethod = 'negotiate';
                }
            } else {
                willAnnex = world.rng.chance(0.20);
            }

            if (!willAnnex) continue;

            // Perform annexation
            outpost.annexed = true;
            outpost.isOutpost = false;
            outpost.category = 'village';
            outpost.maxBuildingSlots = CONFIG.TOWN_CATEGORIES.village.maxBuildingSlots;
            outpost.garrison = world.rng.randInt(2, 5);

            // Add to kingdom territories
            if (kingdom.territories) {
                if (kingdom.territories instanceof Set) {
                    kingdom.territories.add(outpost.id);
                } else if (Array.isArray(kingdom.territories)) {
                    kingdom.territories.push(outpost.id);
                }
            }

            // Compensation depends on method
            var founder = findPerson(outpost.founderId);
            var compensationMsg = '';

            if (annexMethod === 'negotiate') {
                // Fair compensation: 150% of invested gold
                var compensation = Math.floor((outpost.totalInvested || 500) * 1.5);
                if (founder && founder.alive) {
                    founder.gold = (founder.gold || 0) + compensation;
                    compensationMsg = ' The founder received ' + compensation + 'g in compensation.';
                }
                logEvent('👑 The kingdom of ' + kingdom.name + ' has annexed outpost "' + outpost.name +
                    '" as a new village through peaceful negotiation.' + compensationMsg, null, 'my_business');
            } else if (annexMethod === 'seize') {
                // No compensation — king just takes it
                logEvent('⚔️ The kingdom of ' + kingdom.name + ' has seized outpost "' + outpost.name +
                    '" by royal decree! The founder receives nothing.', null, 'my_business');
            } else if (annexMethod === 'tax_heavily') {
                // Partial compensation but heavy ongoing tax
                var partialComp = Math.floor((outpost.totalInvested || 500) * 0.5);
                if (founder && founder.alive) {
                    founder.gold = (founder.gold || 0) + partialComp;
                    compensationMsg = ' The founder received only ' + partialComp + 'g.';
                }
                logEvent('💰 The kingdom of ' + kingdom.name + ' has absorbed outpost "' + outpost.name +
                    '" and imposed heavy taxes on its trade.' + compensationMsg, null, 'my_business');
            }

            // Spawn some villagers to populate the new village
            var settlersNeeded = Math.max(0, 25 - (outpost.population || 0));
            var occupations = ['farmer','farmer','laborer','laborer','craftsman','merchant','miner'];

            for (var s = 0; s < settlersNeeded; s++) {
                var sex = world.rng.random() < 0.5 ? 'M' : 'F';
                var names = sex === 'M' ? NAMES.male : NAMES.female;
                var settler = {
                    id: uid('person'),
                    firstName: names[world.rng.randInt(0, names.length - 1)],
                    lastName: NAMES.surnames[world.rng.randInt(0, NAMES.surnames.length - 1)],
                    age: world.rng.randInt(18, 40),
                    sex: sex,
                    alive: true,
                    townId: outpost.id,
                    kingdomId: outpost.kingdomId,
                    occupation: occupations[world.rng.randInt(0, occupations.length - 1)],
                    employerId: null,
                    needs: { food: 80, shelter: 50, safety: 50, wealth: 30, happiness: 60 },
                    gold: world.rng.randInt(10, 50),
                    wealthClass: 'lower',
                    skills: { farming: world.rng.randInt(0, 30), mining: world.rng.randInt(0, 10), crafting: world.rng.randInt(0, 20), trading: world.rng.randInt(0, 15), combat: world.rng.randInt(0, 10) },
                    workerSkill: world.rng.randInt(5, 30),
                    spouseId: null, childrenIds: [], parentIds: [],
                    personality: {
                        loyalty: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                        ambition: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                        frugality: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                        intelligence: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                        warmth: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                        honesty: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                    },
                    quirks: assignRandomQuirks(world.rng),
                    foodPreferences: { bread: 1, meat: 1, poultry: 1, fish: 1, eggs: 1, preserved_food: 1 },
                    recentFoods: [],
                    health: 100,
                    sick: false,
                    illness: null,
                    illnessDay: 0,
                    injured: false,
                    injuryDay: 0,
                };
                world.people.push(settler);
                if (typeof registerPerson === 'function') registerPerson(settler);
            }
            outpost.population = Math.max(outpost.population || 0, 25);

            // Add basic village buildings if missing
            var hasMarket = outpost.buildings.some(function(b) { return b.type === 'market_stall'; });
            if (!hasMarket) {
                outpost.buildings.push({ type: 'market_stall', id: 'bld_' + world.rng.randInt(10000, 99999), ownerId: null, condition: 'new', builtDay: world.day, workers: [] });
            }
            var hasFarm = outpost.buildings.some(function(b) { return b.type === 'wheat_farm'; });
            if (!hasFarm) {
                outpost.buildings.push({ type: 'wheat_farm', id: 'bld_' + world.rng.randInt(10000, 99999), ownerId: null, condition: 'new', builtDay: world.day, workers: [] });
            }
            // Give the new village basic market supply
            outpost.market.supply.wheat = Math.max(outpost.market.supply.wheat || 0, 200);
            outpost.market.supply.bread = Math.max(outpost.market.supply.bread || 0, 80);
            outpost.market.supply.water = Math.max(outpost.market.supply.water || 0, 100);

            // Build a road connecting the new village to nearest kingdom town
            var nearestKingdomTown = null;
            var nearestDist = Infinity;
            var kTerritories = kingdom.territories instanceof Set ? kingdom.territories : new Set(kingdom.territories || []);
            for (var ti2 = 0; ti2 < world.towns.length; ti2++) {
                var candidate = world.towns[ti2];
                if (candidate.id === outpost.id || candidate.destroyed || candidate.abandoned) continue;
                if (!kTerritories.has(candidate.id)) continue;
                var dx = (candidate.x || 0) - (outpost.x || 0);
                var dy = (candidate.y || 0) - (outpost.y || 0);
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestKingdomTown = candidate;
                }
            }
            if (nearestKingdomTown && nearestDist < 3000) {
                buildNewRoad(outpost.id, nearestKingdomTown.id, kingdom.id);
            }
        }
    }

    /**
     * Elite merchants may found outposts in the wilderness.
     */
    function tickEliteMerchantOutposts() {
        var cfg = CONFIG.OUTPOST_CONFIG;
        var rng = world.rng;
        var TS = CONFIG.TILE_SIZE || 16;
        var _emMinDistPx = (cfg.minDistanceTiles || 10) * TS;

        // v9p33river123: helper — does any existing town sit within minDist of (x,y)?
        function _spotIsClear(x, y) {
            for (var ci = 0; ci < world.towns.length; ci++) {
                var ct = world.towns[ci];
                if (ct.abandoned || ct.destroyed) continue;
                if (Math.hypot(x - ct.x, y - ct.y) < _emMinDistPx) return false;
            }
            return true;
        }
        // Helper — terrain id at world coords
        function _terrainAt(wx, wy) {
            if (!world.terrain || !world.gridCols) return -1;
            var tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
            if (tx < 0 || ty < 0 || tx >= world.gridCols || ty >= world.gridRows) return -1;
            return world.terrain[ty * world.gridCols + tx];
        }
        // Helper — count tiles of given terrain id within `radTiles` of (wx,wy)
        function _terrainCountNear(wx, wy, terrainId, radTiles) {
            if (!world.terrain || !world.gridCols) return 0;
            var ctx = Math.floor(wx / TS), cty = Math.floor(wy / TS);
            var n = 0;
            for (var dy = -radTiles; dy <= radTiles; dy++) {
                for (var dx = -radTiles; dx <= radTiles; dx++) {
                    var nx = ctx + dx, ny = cty + dy;
                    if (nx < 0 || ny < 0 || nx >= world.gridCols || ny >= world.gridRows) continue;
                    if (world.terrain[ny * world.gridCols + nx] === terrainId) n++;
                }
            }
            return n;
        }

        // Map raw resources → terrain that's most likely to have them in-world.
        // Used to pick which terrain to seek when the EM has scarcity for a good.
        var RESOURCE_TERRAIN = {
            wood:    TERRAIN.FOREST.id,
            iron:    TERRAIN.MOUNTAIN.id,
            iron_ore: TERRAIN.MOUNTAIN.id,
            gold:    TERRAIN.MOUNTAIN.id,
            gold_ore: TERRAIN.MOUNTAIN.id,
            stone:   TERRAIN.MOUNTAIN.id,
            coal:    TERRAIN.MOUNTAIN.id,
            sulfur:  TERRAIN.MOUNTAIN.id,
            copper:  TERRAIN.MOUNTAIN.id,
            silver:  TERRAIN.MOUNTAIN.id,
            herbs:   TERRAIN.FOREST.id,
            game:    TERRAIN.FOREST.id,
            hide:    TERRAIN.FOREST.id,
            furs:    TERRAIN.FOREST.id,
        };

        // Determine what raw goods this EM most needs: scan their buildings'
        // recipes for inputs that the home town's market is short on.
        function _emNeededTerrain(em, emTown) {
            if (!em.buildings || !emTown || !emTown.market || !emTown.market.supply) return null;
            var terrainTally = {};
            for (var bi = 0; bi < em.buildings.length; bi++) {
                var bRef = em.buildings[bi];
                var bTown = findTown(bRef.townId);
                if (!bTown || bTown.id !== emTown.id) continue;
                var bt = findBuildingType(bRef.type);
                if (!bt) continue;
                var recipes = [];
                if (bt.consumes) recipes.push({ consumes: bt.consumes });
                if (bt.availableProducts) {
                    for (var pk in bt.availableProducts) {
                        var rp = bt.availableProducts[pk];
                        if (rp && rp.consumes) recipes.push({ consumes: rp.consumes });
                    }
                }
                for (var ri = 0; ri < recipes.length; ri++) {
                    for (var inputId in recipes[ri].consumes) {
                        var supply = emTown.market.supply[inputId] || 0;
                        var demand = emTown.market.demand[inputId] || 1;
                        // scarcity: low supply relative to demand OR almost zero
                        if (supply < 5 || supply < demand * 0.5) {
                            var terr = RESOURCE_TERRAIN[inputId];
                            if (terr != null) terrainTally[terr] = (terrainTally[terr] || 0) + 1;
                        }
                    }
                }
            }
            // Return the terrain id with highest scarcity vote, or null
            var bestT = null, bestN = 0;
            for (var tk in terrainTally) {
                if (terrainTally[tk] > bestN) { bestN = terrainTally[tk]; bestT = +tk; }
            }
            return bestT;
        }

        // Find a legal outpost spot within `searchR` of (cx,cy) that lies on or
        // adjacent to terrain `terrainId` (within 2-tile radius). Returns
        // {x,y} or null.
        function _findResourceSpot(cx, cy, searchR, terrainId) {
            for (var t = 0; t < 20; t++) {
                var x = cx + rng.randInt(-searchR, searchR);
                var y = cy + rng.randInt(-searchR, searchR);
                if (!_spotIsClear(x, y)) continue;
                if (_terrainCountNear(x, y, terrainId, 2) >= 3) return { x: x, y: y, strategy: 'resource' };
            }
            return null;
        }
        // Find a midpoint outpost spot between two trade-partner towns.
        function _findMidpointSpot(townA, townB) {
            if (!townA || !townB || townA.id === townB.id) return null;
            var mx = (townA.x + townB.x) / 2;
            var my = (townA.y + townB.y) / 2;
            // jitter around the midpoint by up to 5 tiles to find a legal spot
            for (var t = 0; t < 16; t++) {
                var jx = mx + rng.randInt(-_emMinDistPx, _emMinDistPx);
                var jy = my + rng.randInt(-_emMinDistPx, _emMinDistPx);
                if (_spotIsClear(jx, jy)) return { x: Math.round(jx), y: Math.round(jy), strategy: 'trade-route' };
            }
            return null;
        }
        // Identify the EM's most-used trade partner (their busiest non-home destination)
        function _emTopTradePartner(em, emTown) {
            if (!world.npcCaravans) return null;
            var counts = {};
            for (var ci = 0; ci < world.npcCaravans.length; ci++) {
                var c = world.npcCaravans[ci];
                if (c.ownerId !== em.id) continue;
                if (!c.toTownId || c.toTownId === emTown.id) continue;
                counts[c.toTownId] = (counts[c.toTownId] || 0) + 1;
            }
            var bestId = null, bestN = 1;
            for (var tid in counts) {
                if (counts[tid] > bestN) { bestN = counts[tid]; bestId = tid; }
            }
            return bestId ? findTown(bestId) : null;
        }

        var _emList = (typeof Engine !== 'undefined' && Engine.getTickCache) ? (Engine.getTickCache().eliteMerchants || []) : [];
        if (_emList.length === 0) {
            for (var pi = 0; pi < world.people.length; pi++) {
                if (world.people[pi].alive && world.people[pi].isEliteMerchant) _emList.push(world.people[pi]);
            }
        }
        for (var pi = 0; pi < _emList.length; pi++) {
            var em = _emList[pi];
            if (!em.alive || !em.isEliteMerchant) continue;
            if ((em.gold || 0) < cfg.foundingCost * 2) continue; // Need 2x cost (buffer for maintenance)

            // Already owns an outpost? Skip
            var ownsOutpost = world.towns.some(function(t) { return t.isOutpost && t.founderId === em.id && !t.abandoned; });
            if (ownsOutpost) continue;

            if (!rng.chance(cfg.eliteMerchantFoundChance)) continue;

            // Find a position near the merchant's town
            var emTown = findTown(em.townId);
            if (!emTown) continue;

            // ── v9p33river123: smart location strategy ──
            // 1. RESOURCE strategy — if EM needs a scarce raw input, look for
            //    an outpost site near matching terrain (forest/mountain).
            // 2. TRADE-ROUTE strategy — if EM has a busy trade partner, place
            //    an outpost near the midpoint to act as a relay.
            // 3. RANDOM fallback — original behaviour, anywhere within
            //    expanded search radius around the home town.
            var spot = null;
            var neededTerrain = _emNeededTerrain(em, emTown);
            if (neededTerrain != null) {
                // Search a wider radius for resource spots — let EMs reach
                // distant forests/mountains rather than just home territory.
                spot = _findResourceSpot(emTown.x, emTown.y, Math.max(_emMinDistPx + 200, 400), neededTerrain);
            }
            if (!spot) {
                var partner = _emTopTradePartner(em, emTown);
                if (partner) spot = _findMidpointSpot(emTown, partner);
            }
            if (!spot) {
                // Random fallback near home
                var _emSearchR = Math.max(_emMinDistPx + 80, 200);
                for (var _emTry = 0; _emTry < 16; _emTry++) {
                    var rx = emTown.x + rng.randInt(-_emSearchR, _emSearchR);
                    var ry = emTown.y + rng.randInt(-_emSearchR, _emSearchR);
                    if (_spotIsClear(rx, ry)) { spot = { x: rx, y: ry, strategy: 'random' }; break; }
                }
            }
            if (!spot) continue; // couldn't find valid spot
            var outpostX = spot.x;
            var outpostY = spot.y;

            // Outpost names — ensure unique name
            var prefixes = ['New', 'Fort', 'Camp', 'Post', 'Watch', 'Trade', 'Old', 'North', 'South', 'East', 'West', 'Upper', 'Lower'];
            var suffixes = ['Haven', 'Point', 'Rest', 'Crossing', 'Ridge', 'Creek', 'Field', 'Gate', 'Hill', 'Hollow', 'Ford', 'Landing', 'Bend', 'Bluff', 'Pass'];
            var existingNames = {};
            world.towns.forEach(function(tt) { existingNames[tt.name] = true; });
            if (world.outposts) world.outposts.forEach(function(oo) { existingNames[oo.name] = true; });
            var outpostName;
            var nameAttempts = 0;
            do {
                outpostName = prefixes[rng.randInt(0, prefixes.length - 1)] + ' ' +
                    suffixes[rng.randInt(0, suffixes.length - 1)];
                nameAttempts++;
            } while (existingNames[outpostName] && nameAttempts < 50);
            if (existingNames[outpostName]) {
                outpostName = outpostName + ' ' + (world.day || 0);
            }

            em.gold -= cfg.foundingCost;
            var result = foundOutpost({
                founderId: em.id,
                founderType: 'elite',
                x: outpostX,
                y: outpostY,
                name: outpostName,
                kingdomId: emTown.kingdomId,
            });

            if (result.success && result.outpost) {
                result.outpost.hiredWorkers = rng.randInt(1, 3);
                result.outpost.hiredGuards = rng.randInt(0, 1);
                result.outpost._foundStrategy = spot.strategy;
            }
        }
    }

    // ── Export to Engine ──
    Engine.foundOutpost = function(opts) { _syncState(); return foundOutpost(opts); };
    Engine.tickOutposts = function() { _syncState(); tickOutposts(); };
    Engine.tickOutpostAnnexation = function() { _syncState(); tickOutpostAnnexation(); };
    Engine.tickOutpostImmigration = function() { _syncState(); tickOutpostImmigration(); };
    Engine.tickOutpostBanditRaids = function() { _syncState(); tickOutpostBanditRaids(); };
    Engine.tickOutpostFires = function() { _syncState(); tickOutpostFires(); };
    Engine.tickOutpostDesertion = function() { _syncState(); tickOutpostDesertion(); };
    Engine.tickOutpostDisease = function() { _syncState(); tickOutpostDisease(); };
    Engine.tickEliteMerchantOutposts = function() { _syncState(); tickEliteMerchantOutposts(); };
    Engine.getOutposts = function() {
        _syncState();
        return world ? world.towns.filter(function(t) { return t.isOutpost && !t.abandoned && !t.destroyed; }) : [];
    };

})(window.Engine);
