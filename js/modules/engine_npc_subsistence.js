// ============================================================
// Merchant Realms — NPC Food/Water Subsistence Module
// v9p33river357: Towns without enough food or water dispatch
// runners to connected neighbors with surplus, respecting
// passable roads (no destroyed bridges). Even ordinary NPCs
// benefit because the town's market supply is what they draw
// from. Travel time is modeled as a multi-day ETA so the relief
// is not instant.
//
// Approach:
//   - Per-town daily deficit check (only every 2 days for perf).
//   - For each deficit town, scan connectedTowns for a passable
//     route to a surplus neighbor.
//   - Reserve goods from the neighbor immediately and queue a
//     run with ETA = base + per-hop days.
//   - Each tick, process arrivals: add reserved goods to the
//     deficit town's market supply.
//
// Public API (on Engine):
//   Engine.tickNpcSubsistence()
//   Engine.isRoadPassable(road)
// ============================================================
(function() {
    "use strict";
    if (typeof Engine === 'undefined') return;

    function _getWorld() { try { return Engine.getWorld ? Engine.getWorld() : null; } catch(e) { return null; } }
    function _findTown(id) { try { return Engine.findTown ? Engine.findTown(id) : null; } catch(e) { return null; } }
    function _getDay() { try { return Engine.getDay ? Engine.getDay() : 0; } catch(e) { return 0; } }

    // Foods that count toward subsistence
    var FOOD_IDS = ['bread', 'wheat', 'meat', 'fish', 'eggs', 'vegetables', 'preserved_food', 'poultry'];
    var WATER_IDS = ['water'];
    var DEFICIT_FOOD_PER_CAPITA = 0.6;   // pop * 0.6 units = baseline
    var DEFICIT_WATER_PER_CAPITA = 0.4;
    var SURPLUS_FOOD_PER_CAPITA = 1.5;   // neighbor must have well above baseline
    var SURPLUS_WATER_PER_CAPITA = 1.2;
    var BASE_ETA_DAYS = 3;
    var MIN_REL_DAYS_BETWEEN_RUNS = 4;   // a town will not start a new run within 4 days

    // ──────────────────────────────────────────────────────────
    // Road passability — no destroyed bridges, road not disabled.
    // ──────────────────────────────────────────────────────────
    function isRoadPassable(road) {
        if (!road) return false;
        if (road.disabled) return false;
        if (road.bridges && road.bridges.length) {
            for (var i = 0; i < road.bridges.length; i++) {
                if (road.bridges[i] && road.bridges[i].destroyed) return false;
            }
        }
        return true;
    }
    Engine.isRoadPassable = isRoadPassable;

    function _findRoadBetween(townAId, townBId) {
        var w = _getWorld(); if (!w || !w.roads) return null;
        for (var i = 0; i < w.roads.length; i++) {
            var r = w.roads[i];
            if (!r) continue;
            if ((r.fromTownId === townAId && r.toTownId === townBId) ||
                (r.fromTownId === townBId && r.toTownId === townAId)) {
                return r;
            }
        }
        return null;
    }

    // ──────────────────────────────────────────────────────────
    // Town supply summaries
    // ──────────────────────────────────────────────────────────
    function _totalFood(town) {
        if (!town || !town.market || !town.market.supply) return 0;
        var sum = 0;
        for (var i = 0; i < FOOD_IDS.length; i++) sum += (town.market.supply[FOOD_IDS[i]] || 0);
        return sum;
    }
    function _totalWater(town) {
        if (!town || !town.market || !town.market.supply) return 0;
        return town.market.supply.water || 0;
    }

    function _pickFoodFromTown(town, qty) {
        // Picks foods to remove totalling up to qty; returns map of id -> taken.
        if (!town || !town.market || !town.market.supply) return null;
        var taken = {};
        var remaining = qty;
        for (var i = 0; i < FOOD_IDS.length && remaining > 0; i++) {
            var id = FOOD_IDS[i];
            var have = town.market.supply[id] || 0;
            if (have <= 0) continue;
            var take = Math.min(have, remaining);
            town.market.supply[id] = have - take;
            taken[id] = take;
            remaining -= take;
        }
        return (Object.keys(taken).length > 0) ? taken : null;
    }

    // ──────────────────────────────────────────────────────────
    // Run queue management — stored on town._subsistenceRuns
    // ──────────────────────────────────────────────────────────
    function _ensureRunQueue(town) {
        if (!town._subsistenceRuns) town._subsistenceRuns = [];
        return town._subsistenceRuns;
    }

    function _processArrivals(day) {
        var w = _getWorld(); if (!w) return;
        for (var ti = 0; ti < w.towns.length; ti++) {
            var t = w.towns[ti];
            if (!t._subsistenceRuns || !t._subsistenceRuns.length) continue;
            var pending = [];
            for (var ri = 0; ri < t._subsistenceRuns.length; ri++) {
                var run = t._subsistenceRuns[ri];
                if (!run) continue;
                if (run.eta <= day) {
                    // Arrived — add to market supply
                    if (!t.market) t.market = { supply: {}, prices: {} };
                    if (!t.market.supply) t.market.supply = {};
                    if (run.water) {
                        t.market.supply.water = (t.market.supply.water || 0) + run.water;
                    }
                    if (run.food && typeof run.food === 'object') {
                        for (var fid in run.food) {
                            t.market.supply[fid] = (t.market.supply[fid] || 0) + run.food[fid];
                        }
                    }
                    // v9p33river368: removed subsistence convoy arrival notification (too noisy)
                } else {
                    pending.push(run);
                }
            }
            t._subsistenceRuns = pending;
        }
    }

    // ──────────────────────────────────────────────────────────
    // Main tick
    // ──────────────────────────────────────────────────────────
    function tickNpcSubsistence() {
        var w = _getWorld(); if (!w) return;
        var day = _getDay();

        // 1. Process pending arrivals every tick we are called.
        _processArrivals(day);

        // 2. New runs every 2 days (this function is called every 2 days
        // from Engine.tick so we just run once per call).
        for (var ti = 0; ti < w.towns.length; ti++) {
            var town = w.towns[ti];
            if (!town || town.isWilderness || town.isOutpost) continue;
            var pop = town.population || 0;
            if (pop <= 0) continue;

            // Throttle: don't start a new run if one is already in flight
            // OR if we ran for this town very recently.
            var runs = _ensureRunQueue(town);
            if (runs.length > 0) continue;
            if (town._subsistenceLastDispatchDay && day - town._subsistenceLastDispatchDay < MIN_REL_DAYS_BETWEEN_RUNS) continue;

            var foodPerCap = _totalFood(town) / pop;
            var waterPerCap = _totalWater(town) / pop;
            var needFood = foodPerCap < DEFICIT_FOOD_PER_CAPITA;
            var needWater = waterPerCap < DEFICIT_WATER_PER_CAPITA;
            if (!needFood && !needWater) continue;

            // Find best passable neighbor with surplus
            if (!town.connectedTowns || !town.connectedTowns.length) continue;
            var best = null;
            for (var ci = 0; ci < town.connectedTowns.length; ci++) {
                var nbId = town.connectedTowns[ci];
                var nb = _findTown(nbId);
                if (!nb || nb.isWilderness) continue;
                var road = _findRoadBetween(town.id, nb.id);
                if (!isRoadPassable(road)) continue;

                var nbPop = Math.max(1, nb.population || 0);
                var nbFoodCap = _totalFood(nb) / nbPop;
                var nbWaterCap = _totalWater(nb) / nbPop;

                var canHelpFood = needFood && nbFoodCap >= SURPLUS_FOOD_PER_CAPITA;
                var canHelpWater = needWater && nbWaterCap >= SURPLUS_WATER_PER_CAPITA;
                if (!canHelpFood && !canHelpWater) continue;

                // Score: prefer the most surplused neighbor.
                var score = (canHelpFood ? (nbFoodCap - SURPLUS_FOOD_PER_CAPITA) : 0)
                          + (canHelpWater ? (nbWaterCap - SURPLUS_WATER_PER_CAPITA) : 0);
                if (!best || score > best.score) {
                    best = { neighbor: nb, road: road, canFood: canHelpFood, canWater: canHelpWater, score: score };
                }
            }
            if (!best) continue;

            // Build the run: take what we can spare WITHOUT dropping the
            // neighbor below their own surplus floor (otherwise a donor
            // exactly at the threshold can be left in a deficit).
            var run = { fromTownId: best.neighbor.id, toTownId: town.id, eta: day + BASE_ETA_DAYS };
            var nbPopFinal = Math.max(1, best.neighbor.population || 1);
            // Food: target the deficit gap, cap by neighbor's spare above
            // their surplus floor.
            if (best.canFood) {
                var foodTarget = Math.max(4, Math.floor((DEFICIT_FOOD_PER_CAPITA * pop) - _totalFood(town)));
                // v9p33river357 pass-2: spare = totalFood - (SURPLUS_FOOD_PER_CAPITA * pop)
                var nbExportable = Math.max(0, Math.floor(_totalFood(best.neighbor) - SURPLUS_FOOD_PER_CAPITA * nbPopFinal));
                var takeQty = Math.min(foodTarget, nbExportable, Math.floor(pop * 0.5));
                if (takeQty > 0) {
                    var taken = _pickFoodFromTown(best.neighbor, takeQty);
                    if (taken) run.food = taken;
                }
            }
            if (best.canWater) {
                var waterTarget = Math.max(4, Math.floor((DEFICIT_WATER_PER_CAPITA * pop) - _totalWater(town)));
                var nbWaterExport = Math.max(0, Math.floor(_totalWater(best.neighbor) - SURPLUS_WATER_PER_CAPITA * nbPopFinal));
                var waterTake = Math.min(waterTarget, nbWaterExport, Math.floor(pop * 0.5));
                if (waterTake > 0) {
                    best.neighbor.market.supply.water = Math.max(0, (best.neighbor.market.supply.water || 0) - waterTake);
                    run.water = waterTake;
                }
            }
            // Only queue if we actually grabbed something
            if (run.food || run.water) {
                runs.push(run);
                town._subsistenceLastDispatchDay = day;
                try {
                    // v9p33river365: removed noisy dispatch log events per user request
                } catch (e) {}
            }
        }
    }

    Engine.tickNpcSubsistence = tickNpcSubsistence;
})();
