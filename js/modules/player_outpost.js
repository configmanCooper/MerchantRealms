// ========================================================
// player_outpost.js
// §12M WILDERNESS OUTPOST SYSTEM + RETAIL BUILDINGS — extracted from player.js
// ========================================================
(function(Player) {
    "use strict";
    if (!Player) throw new Error("Player must be loaded before player_outpost.js");

    var player;
    function _sync() { player = Player.state; }

    // ── Player helpers (defined in player.js, accessed via Player) ──
    var hasSkill = function(skillId) { return Player.hasSkill(skillId); };
    var findResource = function(resId) { return Player.findResource(resId); };
    var unlockAchievement = function(id) { return Player.unlockAchievement(id); };
    var getRelationship = function(personId) { return Player.getRelationship(personId); };
    // ========================================================
    // §12M  WILDERNESS OUTPOST SYSTEM (Player)
    // ========================================================

    /**
     * Found a wilderness outpost with or without a road.
     * @param {string} name - Name for the outpost
     * @param {object} opts - { buildWithRoad: boolean, roadCost: number, roadMaterials: object }
     * @returns {{ success: boolean, message: string }}
     */
    function foundPlayerOutpost(name, opts) {
        _sync();
        var cfg = CONFIG.OUTPOST_CONFIG;
        if (!name || name.trim().length === 0) return { success: false, message: 'Outpost needs a name.' };
        if (!opts) opts = {};

        // Calculate total costs
        var totalGold = cfg.foundingCost;
        var totalMats = {};
        for (var mk in cfg.foundingMaterials) totalMats[mk] = cfg.foundingMaterials[mk];
        if (opts.buildWithRoad && opts.roadCost) {
            totalGold += opts.roadCost.gold || 0;
            for (var rk in opts.roadCost) {
                if (rk === 'gold') continue;
                totalMats[rk] = (totalMats[rk] || 0) + (opts.roadCost[rk] || 0);
            }
        }

        // Cost check
        if (player.gold < totalGold) {
            return { success: false, message: 'Need ' + totalGold + 'g (have ' + Math.floor(player.gold) + 'g).' };
        }

        // Material check
        var matMissing = [];
        for (var matId in totalMats) {
            var needed = totalMats[matId];
            var has = player.inventory[matId] || 0;
            if (has < needed) matMissing.push(needed + ' ' + matId + ' (have ' + has + ')');
        }
        if (matMissing.length > 0) {
            return { success: false, message: 'Missing materials: ' + matMissing.join(', ') };
        }

        // Determine outpost position
        // v9p33river305: player.travelData is obsolete; live travel state is
        // travelProgress/travelRoute/travelDestination. Use the canonical
        // helper that resolves the player's current world coords during
        // travel (it knows about waypoints + sea routes too).
        var ox, oy;
        if (player.traveling && typeof Player !== 'undefined' && Player.getPlayerWorldPosition) {
            var _pPos = null;
            try { _pPos = Player.getPlayerWorldPosition(); } catch (_e) {}
            if (_pPos && _pPos.x != null && _pPos.y != null) {
                ox = Math.floor(_pPos.x);
                oy = Math.floor(_pPos.y);
            } else {
                var town = Engine.findTown(player.townId);
                ox = town ? town.x + 30 : 100;
                oy = town ? town.y + 30 : 100;
            }
        } else {
            if (player.worldX != null && player.worldY != null) {
                ox = player.worldX;
                oy = player.worldY;
            } else {
                var curTown = Engine.findTown(player.townId);
                if (!curTown) return { success: false, message: 'Cannot determine location for outpost.' };
                var rng = Engine.getRng();
                var _foundSpot = false;
                for (var _try = 0; _try < 10; _try++) {
                    ox = curTown.x + (rng ? rng.randInt(-60, 60) : 30);
                    oy = curTown.y + (rng ? rng.randInt(-60, 60) : 30);
                    if (Engine.getTerrainAtPixel) {
                        var _trTerrain = Engine.getTerrainAtPixel(ox, oy);
                        if (_trTerrain !== 2 && _trTerrain !== 3) { _foundSpot = true; break; }
                    } else {
                        _foundSpot = true; break;
                    }
                }
                if (!_foundSpot) return { success: false, message: 'Could not find suitable terrain near town for outpost.' };
            }
        }

        // Validate terrain at chosen location
        if (Engine.getTerrainAtPixel) {
            var _opTerrain = Engine.getTerrainAtPixel(ox, oy);
            if (_opTerrain === 2) return { success: false, message: 'Cannot build an outpost on water.' };
            if (_opTerrain === 3) return { success: false, message: 'Cannot build an outpost on mountains.' };
        }

        // v9p33river303: previously deducted gold/materials BEFORE the
        // engine's distance check ran inside foundOutpost — a "too close"
        // failure silently kept the player's coin and resources. Snapshot
        // and refund on any failure path.
        var _snapGold = totalGold;
        var _snapMats = {};
        for (var _smK in totalMats) _snapMats[_smK] = totalMats[_smK];

        // Deduct all costs
        player.gold -= totalGold;
        player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + totalGold;
        for (var matId2 in totalMats) {
            player.inventory[matId2] = (player.inventory[matId2] || 0) - totalMats[matId2];
            if (player.inventory[matId2] <= 0) delete player.inventory[matId2];
        }

        var result = Engine.foundOutpost({
            founderId: player.id || 'player',
            founderType: 'player',
            x: ox,
            y: oy,
            name: name.trim(),
            buildWithRoad: !!opts.buildWithRoad,
            roadTargetTownId: opts.roadTargetTownId || null,
        });

        if (!result.success) {
            // Refund on any engine-side failure (distance check, terrain, etc.)
            player.gold += _snapGold;
            player.stats.totalGoldSpent = Math.max(0, (player.stats.totalGoldSpent || 0) - _snapGold);
            for (var _rmK in _snapMats) {
                player.inventory[_rmK] = (player.inventory[_rmK] || 0) + _snapMats[_rmK];
            }
            return result;
        }

        if (result.success && result.outpost) {
            if (!player.outposts) player.outposts = [];
            player.outposts.push({
                townId: result.outpost.id,
                name: result.outpost.name,
                foundedDay: Engine.getDay(),
            });
            // Player owns all land in the outpost
            if (!player.landOwned) player.landOwned = {};
            var opPlots = result.outpost.landPlots || (CONFIG.OUTPOST_CONFIG && CONFIG.OUTPOST_CONFIG.startingLandPlots) || 4;
            player.landOwned[result.outpost.id] = opPlots;

            // Set player location to the new outpost
            player.townId = result.outpost.id;
            player.traveling = false;
            player.travelData = null;
            player.worldX = result.outpost.x;
            player.worldY = result.outpost.y;

            unlockAchievement('frontier_founder');
        }

        return result;
    }

    /**
     * Get player's outposts with status info.
     */
    function getPlayerOutposts() {
        _sync();
        if (!player.outposts || player.outposts.length === 0) return [];
        var outposts = [];
        for (var i = 0; i < player.outposts.length; i++) {
            var po = player.outposts[i];
            var town = Engine.findTown(po.townId);
            if (!town) continue;
            // Compute connected roads and sea routes
            var roads = Engine.getRoads ? Engine.getRoads() : [];
            var seaRoutes = Engine.getSeaRoutes ? Engine.getSeaRoutes() : [];
            var connRoads = [];
            var connSea = [];
            for (var ri = 0; ri < roads.length; ri++) {
                var r = roads[ri];
                // v9p33river311: skip destroyed roads so broken roads
                // don't keep outposts looking road-connected. Previously
                // connRoads.length included destroyed entries and hasRoad
                // would stay true after the road was wrecked.
                if (r.condition === 'destroyed') continue;
                if (r.fromTownId === town.id || r.toTownId === town.id) {
                    var otherId = r.fromTownId === town.id ? r.toTownId : r.fromTownId;
                    var otherT = Engine.findTown(otherId);
                    connRoads.push({ townId: otherId, name: otherT ? otherT.name : '?', condition: r.condition || 'new' });
                }
            }
            for (var si = 0; si < seaRoutes.length; si++) {
                var sr = seaRoutes[si];
                if (sr.fromTownId === town.id || sr.toTownId === town.id) {
                    var otherSId = sr.fromTownId === town.id ? sr.toTownId : sr.fromTownId;
                    var otherST = Engine.findTown(otherSId);
                    connSea.push({ townId: otherSId, name: otherST ? otherST.name : '?' });
                }
            }
            // Building details
            var bldgs = [];
            for (var bi = 0; bi < town.buildings.length; bi++) {
                var b = town.buildings[bi];
                var bt = Engine.findBuildingType(b.type || b.buildingType);
                bldgs.push({ type: b.type || b.buildingType, name: bt ? bt.name : (b.type || '?'), level: b.level || 1 });
            }
            outposts.push({
                townId: town.id,
                name: town.name,
                x: town.x,
                y: town.y,
                category: town.category,
                buildings: town.buildings,
                buildingCount: town.buildings.length,
                buildingDetails: bldgs,
                maxBuildings: town.maxBuildingSlots || 4,
                workers: (town.outpostWorkers || []).length,
                guards: (town.outpostGuards || []).length,
                workerIds: town.outpostWorkers || [],
                guardIds: town.outpostGuards || [],
                walls: town.walls || 0,
                prosperity: town.prosperity || 0,
                population: (town.outpostResidents || []).length,
                residents: town.outpostResidents || [],
                dailyCost: (town._dailyMaintenanceDue || CONFIG.OUTPOST_CONFIG.dailyMaintenanceCost),
                isOutpost: town.isOutpost,
                isPort: town.isPort || false,
                annexed: town.annexed || false,
                abandoned: town.abandoned || false,
                foundedDay: po.foundedDay,
                connectedRoads: connRoads,
                connectedSeaRoutes: connSea,
                naturalDeposits: town.naturalDeposits || {},
                soilFertility: town.soilFertility || 0,
                garrison: town.garrison || 0,
                // New outpost system fields
                landPlots: town.landPlots || 4,
                usedLandPlots: town.usedLandPlots || 0,
                outpostStorage: town.outpostStorage || 200,
                outpostStorageItems: town.outpostStorageItems || {},
                outpostHousing: town.outpostHousing || [],
                outpostUpgrades: town.outpostUpgrades || [],
                outpostHappiness: town.outpostHappiness || 50,
                hasRoad: town.hasRoad || connRoads.length > 0,
            });
        }
        return outposts;
    }
    function _releaseOutpostStaff(town) {
        // v9p33river431: abandoned outposts must release hired staff so NPCs do
        // not stay stuck as player-employed outpost workers/guards forever.
        var seen = {};
        var workerIds = town.outpostWorkers || [];
        for (var wi = 0; wi < workerIds.length; wi++) {
            _unassignOutpostWorker(town, workerIds[wi]);
            seen[workerIds[wi]] = true;
            var workerNpc = Engine.findPerson(workerIds[wi]);
            if (workerNpc) {
                workerNpc.employerId = null;
                if (workerNpc.occupation === 'outpost_worker') workerNpc.occupation = 'unemployed';
            }
        }
        var guardIds = town.outpostGuards || [];
        for (var gi = 0; gi < guardIds.length; gi++) {
            if (seen[guardIds[gi]]) continue;
            var guardNpc = Engine.findPerson(guardIds[gi]);
            if (guardNpc) {
                guardNpc.employerId = null;
                if (guardNpc.occupation === 'outpost_guard') guardNpc.occupation = 'unemployed';
            }
        }
        town.outpostWorkers = [];
        town.outpostGuards = [];
        town.hiredWorkers = 0;
        town.hiredGuards = 0;
        town.workerAssignments = {};
    }

    /**
     * Pay daily maintenance for player outposts. Called from player tick.
     */
    function payOutpostMaintenance() {
        _sync();
        if (!player.outposts || player.outposts.length === 0) return;
        var cfg = CONFIG.OUTPOST_CONFIG;

        for (var i = 0; i < player.outposts.length; i++) {
            var po = player.outposts[i];
            var town = Engine.findTown(po.townId);
            if (!town || !town.isOutpost || town.abandoned || town.destroyed) continue;

            // Ensure new arrays exist
            if (!town.outpostWorkers) town.outpostWorkers = [];
            if (!town.outpostGuards) town.outpostGuards = [];

            var numWorkers = town.outpostWorkers.length;
            var numGuards = town.outpostGuards.length;
            var dailyWorkerCost = numWorkers * (cfg.workerWagePerWeek || 10) / 7;
            var dailyGuardCost = numGuards * (cfg.guardWagePerWeek || 15) / 7;
            var dailyCost = cfg.dailyMaintenanceCost + dailyWorkerCost + dailyGuardCost;

            if (player.gold >= dailyCost) {
                player.gold -= dailyCost;
                player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + dailyCost;
                town.maintenancePaid = true;
                town.lastMaintenanceDay = Engine.getDay();
            } else {
                town.maintenancePaid = false;
                EventTypes.emit('OUTPOST_MAINTENANCE_UNAFFORDABLE', {
                    dailyCost: Math.ceil(dailyCost),
                    townName: town.name,
                    townId: town.id
                });
            }

            // Player outpost abandonment
            if (!town.maintenancePaid) {
                var daysSince = Engine.getDay() - (town.lastMaintenanceDay || town.foundedDay || 0);
                if (daysSince >= cfg.abandonDaysNoMaintenance) {
                    town.abandoned = true;
                    town.abandonedDay = Engine.getDay();
                    // v9p33river431: release hired outpost staff before removing
                    // the outpost from the player's roster.
                    _releaseOutpostStaff(town);
                    EventTypes.emit('OUTPOST_ABANDONED_MAINTENANCE', {
                        townName: town.name,
                        daysSince: daysSince,
                        townId: town.id
                    });
                    player.outposts.splice(i, 1);
                    i--;
                }
            }
        }
    }

    /**
     * Hire or dismiss workers/guards at a player outpost.
     * Workers and guards are specific NPCs living in the outpost.
     */
    function manageOutpostStaff(townId, action, type, npcId) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.isOutpost) return { success: false, message: 'Not an outpost.' };
        if (town.founderId !== (player.id || 'player')) return { success: false, message: 'Not your outpost.' };
        var cfg = CONFIG.OUTPOST_CONFIG;

        // Ensure arrays exist
        if (!town.outpostWorkers) town.outpostWorkers = [];
        if (!town.outpostGuards) town.outpostGuards = [];
        if (!town.outpostResidents) town.outpostResidents = [];

        if (type === 'worker') {
            if (action === 'hire') {
                if (town.outpostWorkers.length >= (cfg.maxOutpostWorkers || 10)) return { success: false, message: 'Maximum workers reached (' + (cfg.maxOutpostWorkers || 10) + ').' };
                if (town.outpostResidents.length === 0) return { success: false, message: 'No residents to hire. Recruit NPCs first.' };
                // Find eligible NPC
                var npc = npcId ? Engine.findPerson(npcId) : null;
                // v9p33river312: explicit-id path was skipping alive +
                // employerId checks, allowing dead NPCs or already-employed
                // NPCs to be hired as workers.
                if (npc && !npc.alive) return { success: false, message: (npc.firstName || 'That NPC') + ' is dead.' };
                if (npc && npc.employerId && npc.employerId !== (player.id || 'player')) {
                    return { success: false, message: (npc.firstName || 'NPC') + ' is already employed elsewhere.' };
                }
                if (npc && town.outpostResidents.indexOf(npc.id) < 0) {
                    return { success: false, message: (npc.firstName || 'NPC') + ' is not a resident of this outpost.' };
                }
                if (!npc) {
                    // Find first available resident not already hired
                    for (var ri = 0; ri < town.outpostResidents.length; ri++) {
                        var candidate = Engine.findPerson(town.outpostResidents[ri]);
                        if (candidate && candidate.alive && town.outpostWorkers.indexOf(candidate.id) < 0 && town.outpostGuards.indexOf(candidate.id) < 0) {
                            npc = candidate; break;
                        }
                    }
                }
                if (!npc) return { success: false, message: 'No available residents to hire as workers.' };
                if (town.outpostWorkers.indexOf(npc.id) >= 0) return { success: false, message: npc.firstName + ' is already a worker.' };
                if (town.outpostGuards.indexOf(npc.id) >= 0) return { success: false, message: npc.firstName + ' is already a guard.' };
                town.outpostWorkers.push(npc.id);
                town.hiredWorkers = town.outpostWorkers.length;
                npc.occupation = 'outpost_worker';
                npc.employerId = player.id || 'player';
                return { success: true, message: '👷 Hired ' + npc.firstName + ' ' + npc.lastName + ' as a worker. (' + town.outpostWorkers.length + '/' + (cfg.maxOutpostWorkers || 10) + ')' };
            } else {
                if (town.outpostWorkers.length === 0) return { success: false, message: 'No workers to dismiss.' };
                var dismissId = npcId || town.outpostWorkers[town.outpostWorkers.length - 1];
                var idx = town.outpostWorkers.indexOf(dismissId);
                if (idx >= 0) {
                    _unassignOutpostWorker(town, dismissId);
                    town.outpostWorkers.splice(idx, 1);
                    town.hiredWorkers = town.outpostWorkers.length;
                    var dismissedNpc = Engine.findPerson(dismissId);
                    if (dismissedNpc) { dismissedNpc.occupation = 'unemployed'; dismissedNpc.employerId = null; }
                    return { success: true, message: '👋 Dismissed worker' + (dismissedNpc ? ' ' + dismissedNpc.firstName : '') + '. (' + town.outpostWorkers.length + '/' + (cfg.maxOutpostWorkers || 15) + ')' };
                }
                return { success: false, message: 'Worker not found.' };
            }
        } else if (type === 'guard') {
            if (action === 'hire') {
                if (town.outpostGuards.length >= (cfg.maxOutpostGuards || 4)) return { success: false, message: 'Maximum guards reached (' + (cfg.maxOutpostGuards || 4) + ').' };
                if (town.outpostResidents.length === 0) return { success: false, message: 'No residents to hire. Recruit NPCs first.' };
                var guardNpc = npcId ? Engine.findPerson(npcId) : null;
                // v9p33river312: same alive+employerId guards for the
                // explicit-id guard hire path.
                if (guardNpc && !guardNpc.alive) return { success: false, message: (guardNpc.firstName || 'That NPC') + ' is dead.' };
                if (guardNpc && guardNpc.employerId && guardNpc.employerId !== (player.id || 'player')) {
                    return { success: false, message: (guardNpc.firstName || 'NPC') + ' is already employed elsewhere.' };
                }
                if (guardNpc && town.outpostResidents.indexOf(guardNpc.id) < 0) {
                    return { success: false, message: (guardNpc.firstName || 'NPC') + ' is not a resident of this outpost.' };
                }
                if (!guardNpc) {
                    for (var gi = 0; gi < town.outpostResidents.length; gi++) {
                        var gCandidate = Engine.findPerson(town.outpostResidents[gi]);
                        if (gCandidate && gCandidate.alive && town.outpostWorkers.indexOf(gCandidate.id) < 0 && town.outpostGuards.indexOf(gCandidate.id) < 0) {
                            guardNpc = gCandidate; break;
                        }
                    }
                }
                if (!guardNpc) return { success: false, message: 'No available residents to hire as guards.' };
                if (town.outpostGuards.indexOf(guardNpc.id) >= 0) return { success: false, message: guardNpc.firstName + ' is already a guard.' };
                if (town.outpostWorkers.indexOf(guardNpc.id) >= 0) return { success: false, message: guardNpc.firstName + ' is already a worker.' };
                town.outpostGuards.push(guardNpc.id);
                town.hiredGuards = town.outpostGuards.length;
                guardNpc.occupation = 'outpost_guard';
                guardNpc.employerId = player.id || 'player';
                return { success: true, message: '🛡️ Hired ' + guardNpc.firstName + ' ' + guardNpc.lastName + ' as a guard. (' + town.outpostGuards.length + '/' + (cfg.maxOutpostGuards || 4) + ')' };
            } else {
                if (town.outpostGuards.length === 0) return { success: false, message: 'No guards to dismiss.' };
                var gDismissId = npcId || town.outpostGuards[town.outpostGuards.length - 1];
                var gIdx = town.outpostGuards.indexOf(gDismissId);
                if (gIdx >= 0) {
                    // v9p33river319: also call _unassignOutpostWorker so
                    // any role assignment the guard had (gate/patrol/etc.)
                    // is cleared. Worker dismissal (line 350) already did
                    // this; guard dismissal was leaving stale assignments.
                    _unassignOutpostWorker(town, gDismissId);
                    town.outpostGuards.splice(gIdx, 1);
                    town.hiredGuards = town.outpostGuards.length;
                    var gDismissed = Engine.findPerson(gDismissId);
                    if (gDismissed) { gDismissed.occupation = 'unemployed'; gDismissed.employerId = null; }
                    return { success: true, message: '👋 Dismissed guard' + (gDismissed ? ' ' + gDismissed.firstName : '') + '. (' + town.outpostGuards.length + '/' + (cfg.maxOutpostGuards || 4) + ')' };
                }
                return { success: false, message: 'Guard not found.' };
            }
        }
        return { success: false, message: 'Unknown staff type.' };
    }

    /**
     * Assign a worker to a specific role at the outpost.
     * Roles: 'building_maintenance', or any upgrade id with needsWorker (clinic, tavern, etc.)
     */
    function assignOutpostWorker(townId, workerId, role) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.isOutpost) return { success: false, message: 'Not an outpost.' };
        if (town.founderId !== (player.id || 'player')) return { success: false, message: 'Not your outpost.' };
        if (!town.outpostWorkers) town.outpostWorkers = [];
        if (town.outpostWorkers.indexOf(workerId) < 0) return { success: false, message: 'Not a worker here.' };
        if (!town.workerAssignments) town.workerAssignments = {};

        // Validate role
        var validUpgradeRoles = ['clinic', 'tavern', 'market_stall', 'watchtower', 'chapel', 'food_hall'];
        if (role !== 'building_maintenance' && validUpgradeRoles.indexOf(role) < 0) {
            return { success: false, message: 'Invalid assignment role.' };
        }

        // For upgrade roles, check upgrade is built
        if (role !== 'building_maintenance') {
            if (!town.outpostUpgrades || town.outpostUpgrades.indexOf(role) < 0) {
                var uCfg = CONFIG.OUTPOST_UPGRADES && CONFIG.OUTPOST_UPGRADES[role];
                return { success: false, message: (uCfg ? uCfg.name : role) + ' not built yet.' };
            }
            // Only 1 worker per upgrade
            if (town.workerAssignments[role] && town.workerAssignments[role] !== workerId) {
                return { success: false, message: 'Another worker is already assigned to ' + role + '.' };
            }
        }

        // Remove worker from any previous assignment
        _unassignOutpostWorker(town, workerId);

        // Assign to new role
        if (role === 'building_maintenance') {
            if (!town.workerAssignments._maintenance) town.workerAssignments._maintenance = [];
            town.workerAssignments._maintenance.push(workerId);
        } else {
            town.workerAssignments[role] = workerId;
        }

        var npc = Engine.findPerson(workerId);
        var npcName = npc ? npc.firstName : 'Worker';
        var roleName = role === 'building_maintenance' ? 'Building Maintenance' :
            (CONFIG.OUTPOST_UPGRADES && CONFIG.OUTPOST_UPGRADES[role] ? CONFIG.OUTPOST_UPGRADES[role].name : role);
        return { success: true, message: '✅ ' + npcName + ' assigned to ' + roleName + '.' };
    }

    /**
     * Unassign a worker from their current role.
     */
    function unassignOutpostWorker(townId, workerId) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.isOutpost) return { success: false, message: 'Not an outpost.' };
        if (town.founderId !== (player.id || 'player')) return { success: false, message: 'Not your outpost.' };
        _unassignOutpostWorker(town, workerId);
        return { success: true, message: 'Worker unassigned.' };
    }

    function _unassignOutpostWorker(town, workerId) {
        _sync();
        if (!town.workerAssignments) return;
        // Remove from upgrade roles
        var upgradeRoles = ['clinic', 'tavern', 'market_stall', 'watchtower', 'chapel', 'food_hall'];
        for (var i = 0; i < upgradeRoles.length; i++) {
            if (town.workerAssignments[upgradeRoles[i]] === workerId) {
                delete town.workerAssignments[upgradeRoles[i]];
            }
        }
        // Remove from maintenance
        if (town.workerAssignments._maintenance) {
            var idx = town.workerAssignments._maintenance.indexOf(workerId);
            if (idx >= 0) town.workerAssignments._maintenance.splice(idx, 1);
        }
    }

    /**
     * Get the current worker assignment for a given worker.
     */
    function getWorkerAssignment(town, workerId) {
        _sync();
        if (!town.workerAssignments) return null;
        var upgradeRoles = ['clinic', 'tavern', 'market_stall', 'watchtower', 'chapel', 'food_hall'];
        for (var i = 0; i < upgradeRoles.length; i++) {
            if (town.workerAssignments[upgradeRoles[i]] === workerId) return upgradeRoles[i];
        }
        if (town.workerAssignments._maintenance && town.workerAssignments._maintenance.indexOf(workerId) >= 0) return 'building_maintenance';
        return null;
    }

    /**
     * Check if an upgrade is actively staffed (has worker assigned).
     */
    function isUpgradeActive(town, upgradeId) {
        _sync();
        if (!town.workerAssignments) return false;
        return !!town.workerAssignments[upgradeId];
    }

    /**
     * Get the number of workers assigned to building maintenance.
     */
    function getMaintenanceWorkerCount(town) {
        _sync();
        if (!town.workerAssignments || !town.workerAssignments._maintenance) return 0;
        return town.workerAssignments._maintenance.length;
    }
    function upgradeOutpostWalls(townId) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.isOutpost) return { success: false, message: 'Not an outpost.' };
        if (town.founderId !== (player.id || 'player')) return { success: false, message: 'Not your outpost.' };
        var curWalls = town.walls || 0;
        if (curWalls >= 3) return { success: false, message: 'Walls already at maximum level (3).' };
        var nextLevel = curWalls + 1;
        var costs = { 1: { gold: 200, stone: 20, wood: 15 }, 2: { gold: 500, stone: 40, wood: 25 }, 3: { gold: 1000, stone: 80, wood: 40 } };
        var c = costs[nextLevel];
        if (hasSkill('cartographer')) { c.gold = Math.floor(c.gold * 0.75); c.stone = Math.floor(c.stone * 0.75); c.wood = Math.floor(c.wood * 0.75); }
        if (player.gold < c.gold) return { success: false, message: 'Need ' + c.gold + 'g (have ' + Math.floor(player.gold) + 'g).' };
        var inv = player.inventory || {};
        if ((inv.stone || 0) < c.stone) return { success: false, message: 'Need ' + c.stone + ' stone (have ' + (inv.stone || 0) + ').' };
        if ((inv.wood || 0) < c.wood) return { success: false, message: 'Need ' + c.wood + ' wood (have ' + (inv.wood || 0) + ').' };
        player.gold -= c.gold;
        inv.stone = (inv.stone || 0) - c.stone;
        inv.wood = (inv.wood || 0) - c.wood;
        town.walls = nextLevel;
        EventTypes.emit('OUTPOST_WALLS_UPGRADED', {
            townName: town.name,
            nextLevel: nextLevel,
            townId: town.id
        });
        return { success: true, message: '🏰 Walls upgraded to level ' + nextLevel + '!' };
    }

    /**
     * Build docks at a coastal outpost. Makes it a port.
     */
    function buildOutpostDocks(townId) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.isOutpost) return { success: false, message: 'Not an outpost.' };
        if (town.founderId !== (player.id || 'player')) return { success: false, message: 'Not your outpost.' };
        if (town.isPort) return { success: false, message: town.name + ' already has docks.' };
        if ((town.walls || 0) < 1) return { success: false, message: 'Need walls level 1+ before building docks.' };
        // Check if near water
        var TS = CONFIG.TILE_SIZE || 16;
        var prox = CONFIG.PORT_WATER_PROXIMITY || 3;
        var cx = Math.floor(town.x / TS), cy = Math.floor(town.y / TS);
        var nearWater = false;
        for (var dy = -prox; dy <= prox && !nearWater; dy++) {
            for (var dx = -prox; dx <= prox && !nearWater; dx++) {
                if (Engine.getTerrainAtPixel((cx + dx) * TS, (cy + dy) * TS) === 2) nearWater = true;
            }
        }
        if (!nearWater) return { success: false, message: 'No water within ' + prox + ' tiles — cannot build docks.' };
        var cost = { gold: 400, wood: 30, planks: 20, rope: 10, iron: 8 };
        if (hasSkill('cartographer')) { for (var k in cost) { cost[k] = Math.floor(cost[k] * 0.75); } }
        if (player.gold < cost.gold) return { success: false, message: 'Need ' + cost.gold + 'g (have ' + Math.floor(player.gold) + 'g).' };
        var inv = player.inventory || {};
        for (var matId in cost) {
            if (matId === 'gold') continue;
            if ((inv[matId] || 0) < cost[matId]) return { success: false, message: 'Need ' + cost[matId] + ' ' + matId + ' (have ' + (inv[matId] || 0) + ').' };
        }
        player.gold -= cost.gold;
        for (var matId2 in cost) {
            if (matId2 === 'gold') continue;
            inv[matId2] = (inv[matId2] || 0) - cost[matId2];
        }
        town.isPort = true;
        EventTypes.emit('OUTPOST_DOCKS_BUILT', {
            townName: town.name,
            townId: town.id
        });
        return { success: true, message: '⚓ Docks built! ' + town.name + ' is now a port.' };
    }

    /**
     * Build a road from an outpost to another town.
     */
    function buildOutpostRoad(fromTownId, toTownId) {
        _sync();
        var fromT = Engine.findTown(fromTownId);
        var toT = Engine.findTown(toTownId);
        if (!fromT) return { success: false, message: 'Source town not found.' };
        if (!toT) return { success: false, message: 'Destination town not found.' };
        // Verify player owns the outpost
        var isOwner = false;
        if (fromT.isOutpost && fromT.founderId === (player.id || 'player')) isOwner = true;
        if (toT.isOutpost && toT.founderId === (player.id || 'player')) isOwner = true;
        if (!isOwner) return { success: false, message: 'You must own at least one of the connected outposts.' };
        var dist = Math.hypot(fromT.x - toT.x, fromT.y - toT.y);
        var baseCost = Math.floor(100 + dist * 0.5);
        var woodCost = Math.floor(10 + dist * 0.1);
        var stoneCost = Math.floor(8 + dist * 0.08);
        if (hasSkill('cartographer')) { baseCost = Math.floor(baseCost * 0.75); woodCost = Math.floor(woodCost * 0.75); stoneCost = Math.floor(stoneCost * 0.75); }
        if (player.gold < baseCost) return { success: false, message: 'Need ' + baseCost + 'g (have ' + Math.floor(player.gold) + 'g).' };
        var inv = player.inventory || {};
        if ((inv.wood || 0) < woodCost) return { success: false, message: 'Need ' + woodCost + ' wood (have ' + (inv.wood || 0) + ').' };
        if ((inv.stone || 0) < stoneCost) return { success: false, message: 'Need ' + stoneCost + ' stone (have ' + (inv.stone || 0) + ').' };
        var result = Engine.buildNewRoad(fromTownId, toTownId, player.id || 'player', { ownerId: player.id || 'player' });
        if (!result.success) return result;
        player.gold -= baseCost;
        inv.wood = (inv.wood || 0) - woodCost;
        inv.stone = (inv.stone || 0) - stoneCost;
        return { success: true, message: '🛤️ Road built to ' + toT.name + '! (-' + baseCost + 'g, -' + woodCost + ' wood, -' + stoneCost + ' stone)' };
    }

    /**
     * Build a sea route from a port outpost to another port.
     */
    function buildOutpostSeaRoute(fromTownId, toTownId) {
        _sync();
        var fromT = Engine.findTown(fromTownId);
        var toT = Engine.findTown(toTownId);
        if (!fromT) return { success: false, message: 'Source not found.' };
        if (!toT) return { success: false, message: 'Destination not found.' };
        if (!fromT.isPort) return { success: false, message: fromT.name + ' is not a port.' };
        if (!toT.isPort) return { success: false, message: toT.name + ' is not a port.' };
        var isOwner = false;
        if (fromT.isOutpost && fromT.founderId === (player.id || 'player')) isOwner = true;
        if (toT.isOutpost && toT.founderId === (player.id || 'player')) isOwner = true;
        if (!isOwner) return { success: false, message: 'You must own at least one of the connected port outposts.' };
        var dist = Math.hypot(fromT.x - toT.x, fromT.y - toT.y);
        var baseCost = Math.floor(200 + dist * 0.8);
        var ropeCost = Math.floor(10 + dist * 0.05);
        var planksCost = Math.floor(15 + dist * 0.08);
        var clothCost = Math.floor(5 + dist * 0.03);
        if (hasSkill('cartographer')) { baseCost = Math.floor(baseCost * 0.75); ropeCost = Math.floor(ropeCost * 0.75); planksCost = Math.floor(planksCost * 0.75); clothCost = Math.floor(clothCost * 0.75); }
        if (player.gold < baseCost) return { success: false, message: 'Need ' + baseCost + 'g (have ' + Math.floor(player.gold) + 'g).' };
        var inv = player.inventory || {};
        if ((inv.rope || 0) < ropeCost) return { success: false, message: 'Need ' + ropeCost + ' rope (have ' + (inv.rope || 0) + ').' };
        if ((inv.planks || 0) < planksCost) return { success: false, message: 'Need ' + planksCost + ' planks (have ' + (inv.planks || 0) + ').' };
        if ((inv.cloth || 0) < clothCost) return { success: false, message: 'Need ' + clothCost + ' cloth (have ' + (inv.cloth || 0) + ').' };
        var result = Engine.buildNewSeaRoute(fromTownId, toTownId, player.id || 'player', { ownerId: player.id || 'player' });
        if (!result.success) return result;
        player.gold -= baseCost;
        inv.rope = (inv.rope || 0) - ropeCost;
        inv.planks = (inv.planks || 0) - planksCost;
        inv.cloth = (inv.cloth || 0) - clothCost;
        return { success: true, message: '⚓ Sea route established to ' + toT.name + '!' };
    }

    /**
     * Get cost info for outpost infrastructure (for UI display).
     */
    function getOutpostCosts(townId) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town) return null;
        var cartDisc = hasSkill('cartographer') ? 0.75 : 1.0;
        var curWalls = town.walls || 0;
        var wallCosts = { 1: { gold: 200, stone: 20, wood: 15 }, 2: { gold: 500, stone: 40, wood: 25 }, 3: { gold: 1000, stone: 80, wood: 40 } };
        var nextWall = curWalls < 3 ? wallCosts[curWalls + 1] : null;
        if (nextWall) { nextWall = { gold: Math.floor(nextWall.gold * cartDisc), stone: Math.floor(nextWall.stone * cartDisc), wood: Math.floor(nextWall.wood * cartDisc) }; }
        var dockCost = !town.isPort ? { gold: Math.floor(400 * cartDisc), wood: Math.floor(30 * cartDisc), planks: Math.floor(20 * cartDisc), rope: Math.floor(10 * cartDisc), iron: Math.floor(8 * cartDisc) } : null;
        // Check if near water for dock eligibility
        var nearWater = false;
        if (!town.isPort) {
            var TS = CONFIG.TILE_SIZE || 16;
            var prox = CONFIG.PORT_WATER_PROXIMITY || 3;
            var cx = Math.floor(town.x / TS), cy = Math.floor(town.y / TS);
            for (var dy = -prox; dy <= prox && !nearWater; dy++) {
                for (var dx = -prox; dx <= prox && !nearWater; dx++) {
                    if (Engine.getTerrainAtPixel((cx + dx) * TS, (cy + dy) * TS) === 2) nearWater = true;
                }
            }
        }
        return { wallCost: nextWall, dockCost: dockCost, nearWater: nearWater || town.isPort, currentWalls: curWalls, isPort: town.isPort };
    }

    /**
     * Find the nearest existing road to a point (for connecting outposts to nearby roads).
     * Returns the closest road, perpendicular distance, nearest point on road, and the
     * nearer endpoint town to connect to.
     */
    function getNearestRoadConnection(ox, oy, outpostTownId) {
        _sync();
        var roads = Engine.getRoads ? Engine.getRoads() : [];
        if (roads.length === 0) return null;

        var best = null;
        var bestDist = Infinity;

        for (var ri = 0; ri < roads.length; ri++) {
            var road = roads[ri];
            if (road.condition === 'destroyed') continue;
            // Skip roads already connected to this outpost
            if (outpostTownId && (road.fromTownId === outpostTownId || road.toTownId === outpostTownId)) continue;

            var fromT = Engine.findTown(road.fromTownId);
            var toT = Engine.findTown(road.toTownId);
            if (!fromT || !toT) continue;
            // Skip roads involving junctions that connect to this outpost
            if (fromT.isJunction || toT.isJunction) {
                // Check if any road from this junction connects to outpost already
                var junctionTown = fromT.isJunction ? fromT : toT;
                var alreadyConnected = false;
                for (var rj = 0; rj < roads.length; rj++) {
                    if ((roads[rj].fromTownId === junctionTown.id && roads[rj].toTownId === outpostTownId) ||
                        (roads[rj].toTownId === junctionTown.id && roads[rj].fromTownId === outpostTownId)) {
                        alreadyConnected = true; break;
                    }
                }
                if (alreadyConnected) continue;
            }

            // Use waypoints if available, otherwise endpoints
            var points = (road.waypoints && road.waypoints.length >= 2) ? road.waypoints : [{ x: fromT.x, y: fromT.y }, { x: toT.x, y: toT.y }];

            // Find closest point on any segment of the road
            for (var si = 0; si < points.length - 1; si++) {
                var ax = points[si].x, ay = points[si].y;
                var bx = points[si + 1].x, by = points[si + 1].y;
                // Project point onto segment
                var dx = bx - ax, dy = by - ay;
                var lenSq = dx * dx + dy * dy;
                var t = lenSq > 0 ? Math.max(0, Math.min(1, ((ox - ax) * dx + (oy - ay) * dy) / lenSq)) : 0;
                var px = ax + t * dx, py = ay + t * dy;
                var d = Math.hypot(ox - px, oy - py);
                if (d < bestDist) {
                    bestDist = d;
                    best = {
                        road: road,
                        perpDist: Math.floor(d),
                        nearestPointX: Math.floor(px),
                        nearestPointY: Math.floor(py),
                        fromTownId: road.fromTownId,
                        toTownId: road.toTownId,
                        fromTownName: fromT.name,
                        toTownName: toT.name,
                    };
                }
            }
        }

        if (!best || bestDist > 800) return null;
        return best;
    }

    /**
     * Connect an outpost to a nearby road by creating a junction on the road.
     * Splits the target road at the nearest point, creating a junction node,
     * then builds a short road from the outpost to the junction.
     */
    function connectOutpostToRoad(outpostTownId) {
        _sync();
        var outpost = Engine.findTown(outpostTownId);
        if (!outpost || !outpost.isOutpost) return { success: false, message: 'Not a valid outpost.' };
        if (outpost.founderId !== (player.id || 'player')) return { success: false, message: 'Not your outpost.' };

        // Find the nearest road connection
        var roadConn = getNearestRoadConnection(outpost.x, outpost.y, outpostTownId);
        if (!roadConn || !roadConn.road) return { success: false, message: 'No nearby road found.' };

        // Calculate cost based on perpendicular distance
        var costDist = roadConn.perpDist;
        var baseCost = Math.floor(100 + costDist * 0.5);
        var woodCost = Math.floor(10 + costDist * 0.1);
        var stoneCost = Math.floor(8 + costDist * 0.08);
        if (hasSkill('cartographer')) { baseCost = Math.floor(baseCost * 0.75); woodCost = Math.floor(woodCost * 0.75); stoneCost = Math.floor(stoneCost * 0.75); }

        if (player.gold < baseCost) return { success: false, message: 'Need ' + baseCost + 'g (have ' + Math.floor(player.gold) + 'g).' };
        var inv = player.inventory || {};
        if ((inv.wood || 0) < woodCost) return { success: false, message: 'Need ' + woodCost + ' wood (have ' + (inv.wood || 0) + ').' };
        if ((inv.stone || 0) < stoneCost) return { success: false, message: 'Need ' + stoneCost + ' stone (have ' + (inv.stone || 0) + ').' };

        // v9p33river303: pre-validate the connector road's land path before
        // splitting the original road. Previously, createRoadJunction ran
        // first (splitting the original road and adding a junction town),
        // then buildNewRoad could fail and leave an orphan junction with a
        // split original road. Now we check terrain feasibility up front.
        if (Engine.findTerrainPath) {
            var _connPath = Engine.findTerrainPath(outpost.x, outpost.y, roadConn.nearestPointX, roadConn.nearestPointY, 'land');
            if (!_connPath || !_connPath.waypoints || _connPath.waypoints.length < 2) {
                return { success: false, message: 'No valid land path to the road (too much water in between).' };
            }
        }

        // Create junction on the road at the nearest point
        var jResult = Engine.createRoadJunction(roadConn.road, roadConn.nearestPointX, roadConn.nearestPointY);
        if (!jResult.success) return jResult;

        // Build road from outpost to junction
        var roadResult = Engine.buildNewRoad(outpostTownId, jResult.junction.id, player.id || 'player', { ownerId: player.id || 'player' });
        if (!roadResult.success) {
            // v9p33river303: roll back the junction split so the original
            // road is not left orphaned/broken.
            if (Engine.rollbackRoadJunction) {
                try { Engine.rollbackRoadJunction(jResult.junction.id); } catch (_eRb) { /* best-effort */ }
            }
            return { success: false, message: 'Failed to build road to junction: ' + roadResult.message };
        }

        // Deduct costs
        player.gold -= baseCost;
        inv.wood = (inv.wood || 0) - woodCost;
        inv.stone = (inv.stone || 0) - stoneCost;
        if (inv.wood <= 0) delete inv.wood;
        if (inv.stone <= 0) delete inv.stone;

        // Mark outpost as having a road
        outpost.hasRoad = true;

        return { success: true, message: '🛤️ Connected to ' + roadConn.fromTownName + '–' + roadConn.toTownName + ' road via junction! (-' + baseCost + 'g, -' + woodCost + ' wood, -' + stoneCost + ' stone)' };
    }

    /**
     * Get nearby towns for road/sea route building from an outpost.
     */
    function getNearbyTownsForOutpost(townId, maxDist) {
        _sync();
        maxDist = maxDist || 600;
        var town = Engine.findTown(townId);
        if (!town) return [];
        var allTowns = Engine.getTowns();
        var roads = Engine.getRoads ? Engine.getRoads() : [];
        var seaRoutes = Engine.getSeaRoutes ? Engine.getSeaRoutes() : [];
        var nearby = [];
        for (var i = 0; i < allTowns.length; i++) {
            var t = allTowns[i];
            if (t.id === townId || t.isJunction) continue;
            var dist = Math.hypot(t.x - town.x, t.y - town.y);
            if (dist > maxDist) continue;
            // Check if road already exists
            var hasRoad = roads.some(function(r) {
                return (r.fromTownId === townId && r.toTownId === t.id) || (r.fromTownId === t.id && r.toTownId === townId);
            });
            // Check if sea route already exists
            var hasSeaRoute = seaRoutes.some(function(sr) {
                return (sr.fromTownId === townId && sr.toTownId === t.id) || (sr.fromTownId === t.id && sr.toTownId === townId);
            });
            nearby.push({ townId: t.id, name: t.name, dist: Math.floor(dist), isPort: t.isPort || false, hasRoad: hasRoad, hasSeaRoute: hasSeaRoute, category: t.category || 'town' });
        }
        nearby.sort(function(a, b) { return a.dist - b.dist; });
        return nearby;
    }

    /**
     * Buy additional land plots for an outpost.
     */
    function buyOutpostLandPlot(townId) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.isOutpost) return { success: false, message: 'Not an outpost.' };
        if (town.founderId !== (player.id || 'player')) return { success: false, message: 'Not your outpost.' };
        if ((town.population || 0) < 10) return { success: false, message: 'Need at least 10 residents to expand land.' };
        var cfg = CONFIG.OUTPOST_CONFIG;
        var maxPlots = cfg.maxLandPlots || 10;
        if ((town.landPlots || 4) >= maxPlots) return { success: false, message: 'Maximum land plots reached (' + maxPlots + ').' };
        var cost = cfg.landPlotCost || 150;
        var mats = cfg.landPlotMaterials || { wood: 10, stone: 5 };
        if (player.gold < cost) return { success: false, message: 'Need ' + cost + 'g (have ' + Math.floor(player.gold) + 'g).' };
        for (var mk in mats) {
            if ((player.inventory[mk] || 0) < mats[mk]) return { success: false, message: 'Need ' + mats[mk] + ' ' + mk + ' (have ' + (player.inventory[mk] || 0) + ').' };
        }
        player.gold -= cost;
        for (var mk2 in mats) {
            player.inventory[mk2] = (player.inventory[mk2] || 0) - mats[mk2];
            if (player.inventory[mk2] <= 0) delete player.inventory[mk2];
        }
        town.landPlots = (town.landPlots || 4) + 1;
        town.maxBuildingSlots = town.landPlots;
        // Sync player land ownership
        if (!player.landOwned) player.landOwned = {};
        player.landOwned[townId] = town.landPlots;
        return { success: true, message: '📐 Purchased land plot! (' + town.landPlots + '/' + maxPlots + ')' };
    }

    /**
     * Build outpost housing (tent camp, cabins, or cottages).
     */
    function buildOutpostHousing(townId, housingType) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.isOutpost) return { success: false, message: 'Not an outpost.' };
        if (town.founderId !== (player.id || 'player')) return { success: false, message: 'Not your outpost.' };
        var hCfg = CONFIG.OUTPOST_HOUSING && CONFIG.OUTPOST_HOUSING[housingType];
        if (!hCfg) return { success: false, message: 'Unknown housing type.' };
        if (!town.outpostHousing) town.outpostHousing = [];
        var usedPlots = (town.usedLandPlots || 0);
        if (usedPlots + (hCfg.landSlots || 1) > (town.landPlots || 4)) {
            return { success: false, message: 'Not enough land plots. Need ' + (hCfg.landSlots || 1) + ' but only ' + ((town.landPlots || 4) - usedPlots) + ' available.' };
        }
        if (player.gold < hCfg.cost) return { success: false, message: 'Need ' + hCfg.cost + 'g (have ' + Math.floor(player.gold) + 'g).' };
        for (var mk in hCfg.materials) {
            if ((player.inventory[mk] || 0) < hCfg.materials[mk]) return { success: false, message: 'Need ' + hCfg.materials[mk] + ' ' + mk + ' (have ' + (player.inventory[mk] || 0) + ').' };
        }
        player.gold -= hCfg.cost;
        for (var mk2 in hCfg.materials) {
            player.inventory[mk2] = (player.inventory[mk2] || 0) - hCfg.materials[mk2];
            if (player.inventory[mk2] <= 0) delete player.inventory[mk2];
        }
        town.outpostHousing.push({ type: housingType, builtDay: Engine.getDay() });
        town.usedLandPlots = (town.usedLandPlots || 0) + (hCfg.landSlots || 1);
        return { success: true, message: hCfg.icon + ' Built ' + hCfg.name + '! Holds ' + hCfg.capacity + ' residents.' };
    }

    /**
     * Build an outpost upgrade (well, clinic, tavern, etc.).
     */
    function buildOutpostUpgrade(townId, upgradeId) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.isOutpost) return { success: false, message: 'Not an outpost.' };
        if (town.founderId !== (player.id || 'player')) return { success: false, message: 'Not your outpost.' };
        var uCfg = CONFIG.OUTPOST_UPGRADES && CONFIG.OUTPOST_UPGRADES[upgradeId];
        if (!uCfg) return { success: false, message: 'Unknown upgrade.' };
        if (!town.outpostUpgrades) town.outpostUpgrades = [];
        if (town.outpostUpgrades.indexOf(upgradeId) >= 0) return { success: false, message: uCfg.name + ' already built.' };
        // Check prerequisites
        if (uCfg.requires) {
            for (var ri = 0; ri < uCfg.requires.length; ri++) {
                if (town.outpostUpgrades.indexOf(uCfg.requires[ri]) < 0) {
                    var reqCfg = CONFIG.OUTPOST_UPGRADES[uCfg.requires[ri]];
                    return { success: false, message: 'Requires ' + (reqCfg ? reqCfg.name : uCfg.requires[ri]) + ' first.' };
                }
            }
        }
        if (player.gold < uCfg.cost) return { success: false, message: 'Need ' + uCfg.cost + 'g (have ' + Math.floor(player.gold) + 'g).' };
        for (var mk in uCfg.materials) {
            if ((player.inventory[mk] || 0) < uCfg.materials[mk]) return { success: false, message: 'Need ' + uCfg.materials[mk] + ' ' + mk + ' (have ' + (player.inventory[mk] || 0) + ').' };
        }
        player.gold -= uCfg.cost;
        for (var mk2 in uCfg.materials) {
            player.inventory[mk2] = (player.inventory[mk2] || 0) - uCfg.materials[mk2];
            if (player.inventory[mk2] <= 0) delete player.inventory[mk2];
        }
        town.outpostUpgrades.push(upgradeId);
        if (uCfg.storageBonus) town.outpostStorage = (town.outpostStorage || 200) + uCfg.storageBonus;
        return { success: true, message: uCfg.icon + ' Built ' + uCfg.name + '!' };
    }

    /**
     * Recruit an NPC to move to a player's outpost.
     * @returns {{ success: boolean, message: string, chance?: number }}
     */
    function recruitNpcToOutpost(npcId, townId, goldIncentive, shelterItem) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.isOutpost) return { success: false, message: 'Not an outpost.' };
        if (town.founderId !== (player.id || 'player')) return { success: false, message: 'Not your outpost.' };
        var npc = Engine.findPerson(npcId);
        if (!npc || !npc.alive) return { success: false, message: 'NPC not found.' };
        var cfg = CONFIG.OUTPOST_CONFIG;

        // Cannot recruit minors (under 18)
        if (npc.age < 18) return { success: false, message: npc.firstName + ' is too young to recruit (under 18).' };

        // Cannot recruit nobility
        if (npc.isKing || npc.occupation === 'king') return { success: false, message: 'You cannot recruit a king to an outpost!' };
        if (npc.occupation === 'noble' || npc.occupation === 'queen' || npc.occupation === 'queens_lord') {
            return { success: false, message: npc.firstName + ' is a noble and will not move to an outpost.' };
        }
        if (npc.socialRank && typeof npc.socialRank === 'object') {
            var _npcHighRank = 0;
            for (var _ork in npc.socialRank) { if ((npc.socialRank[_ork] || 0) > _npcHighRank) _npcHighRank = npc.socialRank[_ork]; }
            if (_npcHighRank >= 4) {
                var _nrkDef = CONFIG.SOCIAL_RANKS[_npcHighRank] || {};
                return { success: false, message: npc.firstName + ' holds the rank of ' + (_nrkDef.name || 'Noble') + ' and will not move to an outpost.' };
            }
        }

        // Check cooldown
        if (!player._outpostRecruitCooldowns) player._outpostRecruitCooldowns = {};
        var cooldownKey = npcId + '_' + townId;
        var lastAsked = player._outpostRecruitCooldowns[cooldownKey];
        if (lastAsked && lastAsked > 0 && Engine.getDay() - lastAsked < (cfg.recruitCooldownDays || 7)) {
            var daysLeft = (cfg.recruitCooldownDays || 7) - (Engine.getDay() - lastAsked);
            return { success: false, message: npc.firstName + ' was recently asked. Wait ' + daysLeft + ' more day(s).' };
        }

        // Check population cap
        var maxPop = cfg.maxPopulation || 30;
        if ((town.population || 0) >= maxPop) {
            return { success: false, message: 'Outpost has reached maximum population of ' + maxPop + '.' };
        }

        // Check housing capacity — no longer blocks, but applies penalty
        if (!town.outpostHousing) town.outpostHousing = [];
        if (!town.outpostResidents) town.outpostResidents = [];
        var housingCap = 0;
        for (var hi = 0; hi < town.outpostHousing.length; hi++) {
            var hCfg = CONFIG.OUTPOST_HOUSING && CONFIG.OUTPOST_HOUSING[town.outpostHousing[hi].type];
            if (hCfg) housingCap += hCfg.capacity;
        }
        var noHousing = town.outpostResidents.length >= housingCap;
        var noHousingPenalty = 0;
        var shelterUsed = '';
        if (noHousing) {
            noHousingPenalty = 0.225; // base penalty for no housing (was 0.30, reduced 25%)
            // Shelter items reduce the penalty
            if (shelterItem === 'camping_kit' && (player.inventory.camping_kit || 0) >= 1) {
                noHousingPenalty *= 0.50; // camping kit removes half the penalty
                shelterUsed = 'camping_kit';
            } else if (shelterItem === 'tent' && (player.inventory.tent || 0) >= 1) {
                noHousingPenalty *= 0.65; // tent removes 35% of the penalty
                shelterUsed = 'tent';
            } else if (shelterItem === 'bedroll' && (player.inventory.bedroll || 0) >= 1) {
                noHousingPenalty *= 0.75; // bedroll removes 25% of the penalty
                shelterUsed = 'bedroll';
            }
        }

        // Calculate chance
        var chance = getOutpostRecruitChance(npcId, townId);

        // Apply no-housing penalty
        if (noHousing) chance -= noHousingPenalty;

        // Add gold incentive
        goldIncentive = Math.max(0, goldIncentive || 0);
        var goldBonus = 0;
        if (goldIncentive > 0 && cfg.recruitGoldPerPercent) {
            goldBonus = Math.min(goldIncentive / cfg.recruitGoldPerPercent / 100, cfg.recruitMaxGoldBonus || 0.20);
            chance += goldBonus;
        }
        chance = Math.max(cfg.recruitMinChance || 0.03, Math.min(cfg.recruitMaxChance || 0.85, chance));

        // Check if player can afford gold incentive
        if (goldIncentive > 0 && player.gold < goldIncentive) {
            return { success: false, message: 'Cannot afford ' + goldIncentive + 'g incentive.' };
        }

        // Set cooldown
        player._outpostRecruitCooldowns[cooldownKey] = Engine.getDay();

        // Deduct gold incentive
        if (goldIncentive > 0) {
            player.gold -= goldIncentive;
            player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + goldIncentive;
        }

        // Roll
        var rng = Engine.getRng();
        var roll = rng.random();
        if (roll < chance) {
            // Success — NPC agrees to move
            npc.townId = town.id;
            town.outpostResidents.push(npc.id);
            town.population = town.outpostResidents.length;
            // Consume shelter item given to the recruit
            if (shelterUsed) {
                player.inventory[shelterUsed] = (player.inventory[shelterUsed] || 0) - 1;
                if (player.inventory[shelterUsed] <= 0) delete player.inventory[shelterUsed];
            }
            EventTypes.emit('OUTPOST_RECRUIT_SUCCESS', {
                npcFirstName: npc.firstName,
                npcLastName: npc.lastName,
                townName: town.name,
                townId: town.id,
                npcId: npc.id
            });
            return { success: true, message: '🎉 ' + npc.firstName + ' agreed to move! (' + Math.round(chance * 100) + '% chance)' + (shelterUsed ? ' Gave them a ' + shelterUsed.replace(/_/g, ' ') + '.' : ''), chance: chance };
        } else {
            EventTypes.emit('OUTPOST_RECRUIT_DECLINED', {
                npcFirstName: npc.firstName,
                npcLastName: npc.lastName,
                townName: town.name,
                townId: town.id,
                npcId: npc.id,
                _noToast: true
            });
            return { success: false, message: '😔 ' + npc.firstName + ' declined. (' + Math.round(chance * 100) + '% chance)' + (goldIncentive > 0 ? ' Gold spent.' : ''), chance: chance };
        }
    }

    /**
     * Get recruitment chance for an NPC to an outpost (without rolling).
     */
    function getOutpostRecruitChance(npcId, townId) {
        _sync();
        var town = Engine.findTown(townId);
        var npc = Engine.findPerson(npcId);
        if (!town || !npc) return 0;
        var cfg = CONFIG.OUTPOST_CONFIG;
        var chance = cfg.recruitBaseChance || 0.10;

        // Road bonus (big)
        if (town.hasRoad) chance += cfg.recruitRoadBonus || 0.15;

        // Relationship bonus
        var rel = getRelationship(npcId);
        var relLevel = rel ? (rel.level || 0) : 0;
        chance += Math.max(0, relLevel) * (cfg.recruitRelationshipScale || 0.002);

        // Social status comparison (socialRank is { kingdomId → rankIndex })
        var kId = town.kingdomId;
        var playerRank = (typeof player.socialRank === 'object' && player.socialRank) ? (player.socialRank[kId] || 0) : (player.socialRank || 0);
        var npcRank = (typeof npc.socialRank === 'object' && npc.socialRank) ? (npc.socialRank[kId] || 0) : (npc.socialRank || 0);
        var rankDiff = playerRank - npcRank;
        chance += rankDiff * (cfg.recruitStatusScale || 0.02);

        // Upgrade bonuses
        if (town.outpostUpgrades) {
            for (var ui = 0; ui < town.outpostUpgrades.length; ui++) {
                var uCfg = CONFIG.OUTPOST_UPGRADES && CONFIG.OUTPOST_UPGRADES[town.outpostUpgrades[ui]];
                if (uCfg && uCfg.recruitBonus) chance += uCfg.recruitBonus;
            }
        }

        // Housing quality bonus
        if (town.outpostHousing) {
            for (var hi = 0; hi < town.outpostHousing.length; hi++) {
                var hCfg = CONFIG.OUTPOST_HOUSING && CONFIG.OUTPOST_HOUSING[town.outpostHousing[hi].type];
                if (hCfg && hCfg.recruitBonus) chance += hCfg.recruitBonus;
            }
        }

        // Penalty for NPCs with children (they don't want to uproot their family)
        var _npcChildren = npc.childrenIds ? npc.childrenIds.filter(function(cid) {
            var c = Engine.findPerson(cid);
            return c && c.alive;
        }).length : 0;
        if (_npcChildren > 0) {
            var _hasSpouse = npc.spouseId && Engine.findPerson(npc.spouseId);
            _hasSpouse = _hasSpouse && _hasSpouse.alive;
            if (!_hasSpouse) {
                // Single parent — very reluctant (−40% base, −8% per child)
                chance -= 0.40 + (_npcChildren * 0.08);
            } else {
                // Has spouse and children — reluctant (−25% base, −5% per child)
                chance -= 0.25 + (_npcChildren * 0.05);
            }
        }

        return Math.max(cfg.recruitMinChance || 0.03, Math.min(cfg.recruitMaxChance || 0.85, chance));
    }

    /**
     * Petition the king to convert an outpost to a village.
     */
    function petitionOutpostToVillage(townId) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.isOutpost) return { success: false, message: 'Not an outpost.' };
        if (town.founderId !== (player.id || 'player')) return { success: false, message: 'Not your outpost.' };
        var cfg = CONFIG.OUTPOST_CONFIG;
        if (!town.outpostResidents) town.outpostResidents = [];
        var minPop = cfg.villageConversionMinPop || 20;
        if (town.outpostResidents.length < minPop) {
            return { success: false, message: 'Need at least ' + minPop + ' residents to petition for village status. Currently: ' + town.outpostResidents.length };
        }

        // Find kingdom
        var kingdom = Engine.findKingdom(town.kingdomId);
        if (!kingdom) return { success: false, message: 'No kingdom found.' };

        // Calculate king's payment based on treasury, personality, outpost quality
        var basePay = cfg.villageConversionKingPayMin || 500;
        var maxPay = cfg.villageConversionKingPayMax || 2000;
        var qualityScore = 0;
        qualityScore += (town.outpostUpgrades || []).length * 0.1;
        qualityScore += (town.outpostHousing || []).length * 0.15;
        qualityScore += town.outpostResidents.length * 0.02;
        qualityScore += (town.walls || 0) * 0.1;
        qualityScore += town.hasRoad ? 0.1 : 0;
        qualityScore += town.isPort ? 0.1 : 0;
        qualityScore = Math.min(1.0, qualityScore);

        var treasuryFactor = Math.min(1.0, (kingdom.gold || 0) / 5000);
        var personalityBonus = 0;
        if (kingdom.kingPersonality) {
            if (kingdom.kingPersonality.generosity === 'generous') personalityBonus = 0.2;
            if (kingdom.kingPersonality.greed === 'greedy') personalityBonus = -0.2;
            if (kingdom.kingPersonality.greed === 'corrupt') personalityBonus = -0.3;
        }
        var payFactor = Math.max(0, Math.min(1, (qualityScore * 0.5 + treasuryFactor * 0.3 + personalityBonus + 0.2)));
        var payment = Math.floor(basePay + (maxPay - basePay) * payFactor);
        payment = Math.min(payment, Math.floor((kingdom.gold || 0) * 0.15));
        if (payment < basePay) payment = basePay;

        // Convert outpost to village
        town.isOutpost = false;
        town.annexed = true;
        town.category = 'village';
        town.maxBuildingSlots = Math.max(town.landPlots || 4, CONFIG.TOWN_CATEGORIES.village.maxBuildingSlots);
        town.garrison = Math.max(town.garrison || 0, 3);

        // Player keeps all land and buildings
        // Give player 80 town rep
        if (!player.townReputation) player.townReputation = {};
        player.townReputation[town.id] = cfg.villageConversionBaseRep || 80;

        // Bump NPC relationships below 20 up to 20
        var minRel = cfg.villageConversionMinRelationship || 20;
        if (town.outpostResidents) {
            for (var ri = 0; ri < town.outpostResidents.length; ri++) {
                var resNpc = Engine.findPerson(town.outpostResidents[ri]);
                if (resNpc) {
                    var curRel = getRelationship(town.outpostResidents[ri]);
                    var curLevel = curRel ? (curRel.level || 0) : 0;
                    if (curLevel < minRel) {
                        if (!player.relationships[town.outpostResidents[ri]]) {
                            player.relationships[town.outpostResidents[ri]] = { level: minRel, type: 'acquaintance' };
                        } else {
                            player.relationships[town.outpostResidents[ri]].level = minRel;
                        }
                    }
                }
            }
        }

        // King pays the player
        if (kingdom.gold >= payment) {
            kingdom.gold -= payment;
        } else {
            payment = Math.floor(kingdom.gold * 0.5);
            kingdom.gold -= payment;
        }
        player.gold += payment;

        // Remove from player outposts tracking (it's now a regular village)
        if (player.outposts) {
            for (var oi = 0; oi < player.outposts.length; oi++) {
                if (player.outposts[oi].townId === townId) {
                    player.outposts.splice(oi, 1);
                    break;
                }
            }
        }

        // Give player land ownership in the village
        if (!player.landOwned) player.landOwned = {};
        player.landOwned[town.id] = town.landPlots || 4;

        EventTypes.emit('OUTPOST_RECOGNIZED_VILLAGE', {
            townName: town.name,
            payment: payment,
            townId: town.id,
            kingdomId: town.kingdomId
        });
        unlockAchievement('village_maker');
        return { success: true, message: '🏘️ ' + town.name + ' is now a village! King paid ' + payment + 'g. You have 80 town reputation.' };
    }

    /**
     * Get outpost housing capacity info.
     */
    function getOutpostHousingInfo(townId) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town) return null;
        var totalCap = 0;
        var housing = [];
        var hList = town.outpostHousing || [];
        for (var i = 0; i < hList.length; i++) {
            var hCfg = CONFIG.OUTPOST_HOUSING && CONFIG.OUTPOST_HOUSING[hList[i].type];
            if (hCfg) {
                totalCap += hCfg.capacity;
                housing.push({ type: hList[i].type, name: hCfg.name, icon: hCfg.icon, capacity: hCfg.capacity, comfort: hCfg.comfort, builtDay: hList[i].builtDay });
            }
        }
        return {
            housing: housing,
            totalCapacity: totalCap,
            currentResidents: (town.outpostResidents || []).length,
            availableSpace: totalCap - (town.outpostResidents || []).length,
            playerCanRest: totalCap > (town.outpostResidents || []).length,
        };
    }

    /**
     * Deposit goods from player inventory into outpost storage.
     */
    function depositToOutpostStorage(townId, resId, qty) {
        _sync();
        // Unified: outpost storage IS town storage
        return Player.depositToStorage(resId, qty);
    }

    /**
     * Withdraw goods from outpost storage into player inventory.
     */
    function withdrawFromOutpostStorage(townId, resId, qty) {
        _sync();
        // Unified: outpost storage IS town storage
        return Player.withdrawFromStorage(resId, qty);
    }

    function getRetailBuildings() {
        _sync();
        if (!player.buildings) return [];
        return player.buildings.filter(function(b) {
            var bt = findBuildingType(b.type);
            return bt && bt.retailConfig;
        });
    }

    function findBuildingType(typeId) {
        _sync();
        for (var key in BUILDING_TYPES) {
            if (BUILDING_TYPES[key].id === typeId) return BUILDING_TYPES[key];
        }
        return null;
    }

    function stockRetailBuilding(buildingId, resourceId, quantity) {
        _sync();
        if (quantity != null) { quantity = Number(quantity); if (!isFinite(quantity) || quantity <= 0) return { success: false, message: 'Invalid quantity.' }; }
        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) return { success: false, message: 'Building not found.' };
        var bt = findBuildingType(bld.type);
        if (!bt || !bt.retailConfig) return { success: false, message: 'This building is not a retail building.' };

        // Check if this good is accepted
        if (bt.retailConfig.acceptsGoods.indexOf(resourceId) === -1) {
            return { success: false, message: 'This shop doesn\'t sell ' + resourceId + '.' };
        }

        // Check player inventory
        var available = player.inventory[resourceId] || 0;
        if (available <= 0) return { success: false, message: 'You have no ' + resourceId + ' to stock.' };
        var qty = Math.min(quantity || available, available);

        // Check stock capacity
        bld.retailStock = bld.retailStock || {};
        var currentTotal = 0;
        for (var k in bld.retailStock) { currentTotal += (bld.retailStock[k] || 0); }
        var maxStock = (bt.retailConfig.maxStock || 50) * (bld.level || 1);
        var canAdd = Math.min(qty, maxStock - currentTotal);
        if (canAdd <= 0) return { success: false, message: 'Shop is fully stocked! (Capacity: ' + maxStock + ')' };

        // Transfer from inventory to shop
        player.inventory[resourceId] -= canAdd;
        if (player.inventory[resourceId] <= 0) delete player.inventory[resourceId];
        bld.retailStock[resourceId] = (bld.retailStock[resourceId] || 0) + canAdd;

        var res = findResource(resourceId);
        return { success: true, message: '📦 Stocked ' + canAdd + ' ' + (res ? res.name : resourceId) + ' in your ' + (bt.name || 'shop') + '.' };
    }

    function unstockRetailBuilding(buildingId, resourceId, quantity) {
        _sync();
        if (quantity != null) { quantity = Number(quantity); if (!isFinite(quantity) || quantity <= 0) return { success: false, message: 'Invalid quantity.' }; }
        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) return { success: false, message: 'Building not found.' };
        bld.retailStock = bld.retailStock || {};
        var available = bld.retailStock[resourceId] || 0;
        if (available <= 0) return { success: false, message: 'No ' + resourceId + ' in this shop.' };
        var qty = Math.min(quantity || available, available);

        bld.retailStock[resourceId] -= qty;
        if (bld.retailStock[resourceId] <= 0) delete bld.retailStock[resourceId];
        player.inventory[resourceId] = (player.inventory[resourceId] || 0) + qty;

        var res = findResource(resourceId);
        return { success: true, message: '📤 Withdrew ' + qty + ' ' + (res ? res.name : resourceId) + ' from shop.' };
    }

    function collectRetailRevenue(buildingId) {
        _sync();
        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) return { success: false, message: 'Building not found.' };
        var revenue = bld.retailRevenue || 0;
        if (revenue <= 0) return { success: false, message: 'No revenue to collect.' };
        player.gold += revenue;
        player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + revenue;
        bld.retailRevenue = 0;
        return { success: true, message: '💰 Collected ' + Math.floor(revenue) + 'g in retail revenue!' };
    }

    function collectAllRetailRevenue() {
        _sync();
        var total = 0;
        var buildings = getRetailBuildings();
        for (var i = 0; i < buildings.length; i++) {
            var rev = buildings[i].retailRevenue || 0;
            if (rev > 0) {
                total += rev;
                buildings[i].retailRevenue = 0;
            }
        }
        if (total <= 0) return { success: false, message: 'No retail revenue to collect.' };
        player.gold += total;
        player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + total;
        return { success: true, message: '💰 Collected ' + Math.floor(total) + 'g total retail revenue from ' + buildings.length + ' shops!' };
    }

    function getRetailBuildingStatus(buildingId) {
        _sync();
        var bld = (player.buildings || []).find(function(b) { return b.id === buildingId; });
        if (!bld) return null;
        var bt = findBuildingType(bld.type);
        if (!bt || !bt.retailConfig) return null;

        bld.retailStock = bld.retailStock || {};
        var stockTotal = 0;
        var stockItems = [];
        for (var k in bld.retailStock) {
            if (bld.retailStock[k] > 0) {
                var res = findResource(k);
                stockItems.push({ id: k, name: res ? res.name : k, qty: bld.retailStock[k], icon: res ? res.icon : '📦' });
                stockTotal += bld.retailStock[k];
            }
        }
        var maxStock = (bt.retailConfig.maxStock || 50) * (bld.level || 1);
        var markup = getRetailMarkup(bld);

        return {
            building: bld,
            type: bt,
            stock: stockItems,
            stockTotal: stockTotal,
            maxStock: maxStock,
            revenue: bld.retailRevenue || 0,
            totalEarned: bld.retailTotalEarned || 0,
            totalSold: bld.retailTotalSold || 0,
            customersToday: bld.retailCustomersToday || 0,
            maxCustomers: (bt.retailConfig.maxCustomersPerDay || 5) * (bld.level || 1),
            markup: markup,
            acceptsGoods: bt.retailConfig.acceptsGoods,
        };
    }

    function getRetailMarkup(bld) {
        _sync();
        var bt = findBuildingType(bld.type);
        if (!bt || !bt.retailConfig) return 1.0;
        var base = bt.retailConfig.baseMarkup || 1.2;
        var upgradeBonus = (bt.retailConfig.upgradeMarkupBonus || 0.1) * ((bld.level || 1) - 1);
        var max = bt.retailConfig.maxMarkup || 2.0;
        return Math.min(max, base + upgradeBonus);
    }

    function tickRetailBuildings() {
        _sync();
        if (!player.buildings || !player.alive) return;
        var rng = Engine.getRng();
        if (!rng) return;

        for (var bi = 0; bi < player.buildings.length; bi++) {
            var bld = player.buildings[bi];
            var bt = findBuildingType(bld.type);
            if (!bt || !bt.retailConfig) continue;

            // Reset daily customer count
            bld.retailCustomersToday = 0;
            bld.retailStock = bld.retailStock || {};
            bld.retailRevenue = bld.retailRevenue || 0;
            bld.retailTotalEarned = bld.retailTotalEarned || 0;
            bld.retailTotalSold = bld.retailTotalSold || 0;

            // Need workers to operate
            var workerCount = Array.isArray(bld.workers) ? bld.workers.length : (bld.workers || 0);
            if (workerCount < (bt.workers || 1)) continue;

            var town = Engine.findTown(bld.townId);
            if (!town) continue;

            // Calculate max potential customers based on town pop and building level
            var maxCust = (bt.retailConfig.maxCustomersPerDay || 5) * (bld.level || 1);
            var popFactor = Math.min(2.0, (town.population || 50) / 100);
            maxCust = Math.floor(maxCust * popFactor);
            if (maxCust < 1) maxCust = 1;

            var markup = getRetailMarkup(bld);
            var motivation = bt.retailConfig.npcMotivation || 'need';

            // Kingdom tax info for this town
            var kingdom = Engine.findKingdom(town.kingdomId);
            var tariffRate = (kingdom && kingdom.laws && kingdom.laws.tradeTariff) || 0.05;

            var actualCustomers = 0;
            for (var ci = 0; ci < maxCust; ci++) {

                // ── NPC decides: market or shop? ──
                // Service buildings (clinic, bathhouse) always draw — no market alternative
                if (bt.retailConfig.serviceFee) {
                    var canServe = true;
                    var serviceCost = bt.retailConfig.consumesPerService || {};
                    for (var sRes in serviceCost) {
                        if ((bld.retailStock[sRes] || 0) < serviceCost[sRes]) { canServe = false; break; }
                    }
                    if (!canServe) continue;

                    // Base chance: service motivation
                    var serviceChance = 0.5;
                    if (motivation === 'health') {
                        var hasPlague = false;
                        if (typeof Engine !== 'undefined' && Engine.getActiveEvents) {
                            var evts = Engine.getActiveEvents ? Engine.getActiveEvents() : [];
                            hasPlague = evts.some(function(e) { return e.type === 'plague_disaster' && e.townId === bld.townId && e.active; });
                        }
                        serviceChance = hasPlague ? 0.9 : 0.4;
                    } else if (motivation === 'hygiene') {
                        serviceChance = 0.6;
                    }
                    if (!rng.chance(serviceChance)) continue;

                    // Consume service materials
                    for (var sRes2 in serviceCost) {
                        bld.retailStock[sRes2] -= serviceCost[sRes2];
                        if (bld.retailStock[sRes2] <= 0) delete bld.retailStock[sRes2];
                    }

                    var fee = bt.retailConfig.serviceFee * (bld.level || 1);
                    // Tax the service fee
                    var serviceTax = Math.floor(fee * tariffRate);
                    if (kingdom) kingdom.gold = (kingdom.gold || 0) + serviceTax;
                    var netFee = fee - serviceTax;

                    bld.retailRevenue += netFee;
                    bld.retailTotalEarned += netFee;
                    bld.retailTotalSold++;
                    actualCustomers++;
                    continue;
                }

                // ── Retail sale: NPC checks market first ──
                var stockKeys = Object.keys(bld.retailStock).filter(function(k) { return bld.retailStock[k] > 0; });
                if (stockKeys.length === 0) break; // shop empty

                // Pick a random stocked item the NPC might want
                var itemId = stockKeys[Math.floor(rng.random() * stockKeys.length)];
                var res = findResource(itemId);
                var marketPrice = town.market.prices[itemId] || (res ? res.basePrice : 5);
                var shopPrice = Math.round(marketPrice * markup);
                var marketSupply = town.market.supply[itemId] || 0;

                // NPC decision: buy from market or shop?
                var buyFromShop = false;
                var npcWealth = 20 + Math.floor(rng.random() * 80); // random NPC wealth 20-100g

                if (marketSupply <= 0) {
                    // Market out of stock — shop is only option
                    buyFromShop = npcWealth >= shopPrice;
                } else if (shopPrice <= marketPrice * 1.1) {
                    // Shop price competitive with market — might prefer shop for convenience
                    buyFromShop = rng.chance(0.4);
                } else if (npcWealth > shopPrice * 3) {
                    // Wealthy NPC doesn't care about markup
                    buyFromShop = rng.chance(0.5);
                } else {
                    // Shop is more expensive — NPC preference based on motivation
                    var prefChance = 0.15; // base: 15% prefer shop even at markup
                    if (motivation === 'happiness') {
                        // Tavern: people pay for the atmosphere
                        var happiness = town.happiness || 50;
                        prefChance = happiness < 40 ? 0.6 : happiness < 60 ? 0.35 : 0.2;
                    } else if (motivation === 'hunger') {
                        // Restaurant: prepared meals are worth more
                        prefChance = marketSupply < 30 ? 0.7 : 0.25;
                    } else if (motivation === 'luxury') {
                        // Jeweler: wealthy NPCs browse boutiques
                        var tc = town.category || 'town';
                        prefChance = tc === 'capital_city' ? 0.5 : tc === 'city' ? 0.35 : 0.15;
                    } else if (motivation === 'need') {
                        // General/clothing/armory: convenience factor
                        prefChance = marketSupply < 20 ? 0.5 : 0.2;
                    }
                    buyFromShop = rng.chance(prefChance) && npcWealth >= shopPrice;
                }

                if (!buyFromShop) continue;

                // Sale! Remove from stock, add revenue
                bld.retailStock[itemId]--;
                if (bld.retailStock[itemId] <= 0) delete bld.retailStock[itemId];

                // Kingdom tax on the sale
                var saleTax = Math.floor(shopPrice * tariffRate);
                if (kingdom) kingdom.gold = (kingdom.gold || 0) + saleTax;
                var netRevenue = shopPrice - saleTax;

                bld.retailRevenue += netRevenue;
                bld.retailTotalEarned += netRevenue;
                bld.retailTotalSold++;
                actualCustomers++;
            }

            bld.retailCustomersToday = actualCustomers;

            // Reputation bonus from sales
            if (actualCustomers > 0 && bt.retailConfig.repPerSale) {
                var repGain = actualCustomers * bt.retailConfig.repPerSale;
                addReputation(bld.townId, repGain);
            }

            // Plague reduction from bathhouse
            if (bt.retailConfig.plagueReduction && actualCustomers > 0) {
                bld.plagueReductionActive = true;
            }
        }
    }


    // ── Exports ──
    // Outpost system
    Player.foundPlayerOutpost = foundPlayerOutpost;
    Player.getPlayerOutposts = getPlayerOutposts;
    Player.payOutpostMaintenance = payOutpostMaintenance;
    Player.manageOutpostStaff = manageOutpostStaff;
    Player.assignOutpostWorker = assignOutpostWorker;
    Player.unassignOutpostWorker = unassignOutpostWorker;
    Player.getWorkerAssignment = function(townId, workerId) {
        var t = Engine.findTown(townId);
        return t ? getWorkerAssignment(t, workerId) : null;
    };
    Player.isUpgradeActive = function(townId, upgradeId) {
        var t = Engine.findTown(townId);
        return t ? isUpgradeActive(t, upgradeId) : false;
    };
    Player.getMaintenanceWorkerCount = function(townId) {
        var t = Engine.findTown(townId);
        return t ? getMaintenanceWorkerCount(t) : 0;
    };
    Player.upgradeOutpostWalls = upgradeOutpostWalls;
    Player.buildOutpostDocks = buildOutpostDocks;
    Player.buildOutpostRoad = buildOutpostRoad;
    Player.buildOutpostSeaRoute = buildOutpostSeaRoute;
    Player.getOutpostCosts = getOutpostCosts;
    Player.getNearbyTownsForOutpost = getNearbyTownsForOutpost;
    Player.getNearestRoadConnection = getNearestRoadConnection;
    Player.connectOutpostToRoad = connectOutpostToRoad;
    Player.buyOutpostLandPlot = buyOutpostLandPlot;
    Player.buildOutpostHousing = buildOutpostHousing;
    Player.buildOutpostUpgrade = buildOutpostUpgrade;
    Player.recruitNpcToOutpost = recruitNpcToOutpost;
    Player.getOutpostRecruitChance = getOutpostRecruitChance;
    Player.petitionOutpostToVillage = petitionOutpostToVillage;
    Player.getOutpostHousingInfo = getOutpostHousingInfo;
    Player.depositToOutpostStorage = depositToOutpostStorage;
    Player.withdrawFromOutpostStorage = withdrawFromOutpostStorage;

    // Retail buildings
    Player.getRetailBuildings = getRetailBuildings;
    Player.stockRetailBuilding = stockRetailBuilding;
    Player.unstockRetailBuilding = unstockRetailBuilding;
    Player.collectRetailRevenue = collectRetailRevenue;
    Player.collectAllRetailRevenue = collectAllRetailRevenue;
    Player.getRetailBuildingStatus = getRetailBuildingStatus;
    Player.tickRetailBuildings = tickRetailBuildings;
})(window.Player);