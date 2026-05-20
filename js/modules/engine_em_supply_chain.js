// ============================================================
// Merchant Realms — Adaptive EM Supply Chain Module
// v9p33river357: Elite merchants now scout connected passable
// neighbors for scarce input materials at their owned buildings
// and reserve a shipment that arrives after an ETA. Builds on
// the same passable-road / connectedTowns / market.supply APIs
// as the NPC subsistence module.
//
// Runs every 7 days from Engine.tick via Engine.tickEmSupplyChain
// (skipped during regency fast-forward except every 21 days).
//
// Design:
//   - For each EM building in a town, look up its consumes map
//     (from BUILDING_TYPES). For each input the town is low on,
//     check connected towns for a town with strong surplus.
//   - If found and the road is passable (no destroyed bridges),
//     the EM pays a transport fee proportional to the qty and
//     queues a shipment via town._emInboundShipments [].
//   - Daily tick (called from same Engine.tick) drops arrived
//     shipments onto the destination market.
//
// Public API (on Engine):
//   Engine.tickEmSupplyChain()
//   Engine.tickEmSupplyArrivals()
// ============================================================
(function() {
    "use strict";
    if (typeof Engine === 'undefined') return;

    function _getWorld() { try { return Engine.getWorld ? Engine.getWorld() : null; } catch(e) { return null; } }
    function _findTown(id) { try { return Engine.findTown ? Engine.findTown(id) : null; } catch(e) { return null; } }
    function _getDay() { try { return Engine.getDay ? Engine.getDay() : 0; } catch(e) { return 0; } }
    function _findBuildingType(t) {
        try { return Engine.findBuildingType ? Engine.findBuildingType(t) : null; } catch(e) { return null; }
    }

    var SCOUT_RADIUS = 1;          // only direct neighbors for now
    var SUPPLY_LOW_THRESHOLD = 8;   // supply units before considering a shortage
    var SURPLUS_REQUIREMENT = 20;   // neighbor must have at least this many units
    var TRANSPORT_FEE_PER_UNIT = 0.5; // gold per unit, paid by EM
    var BASE_ETA_DAYS = 3;
    var MIN_DAYS_BETWEEN_SCOUTS_PER_EM = 7;

    function _findRoadBetween(townAId, townBId) {
        var w = _getWorld(); if (!w || !w.roads) return null;
        for (var i = 0; i < w.roads.length; i++) {
            var r = w.roads[i];
            if (!r) continue;
            if ((r.fromTownId === townAId && r.toTownId === townBId) ||
                (r.fromTownId === townBId && r.toTownId === townAId)) return r;
        }
        return null;
    }
    function _isRoadPassable(road) {
        if (typeof Engine.isRoadPassable === 'function') return Engine.isRoadPassable(road);
        if (!road || road.disabled) return false;
        if (road.bridges) {
            for (var i = 0; i < road.bridges.length; i++) {
                if (road.bridges[i] && road.bridges[i].destroyed) return false;
            }
        }
        return true;
    }

    // ─── Arrival processing ───
    function tickEmSupplyArrivals() {
        var w = _getWorld(); if (!w) return;
        var day = _getDay();
        for (var ti = 0; ti < w.towns.length; ti++) {
            var t = w.towns[ti];
            if (!t._emInboundShipments || !t._emInboundShipments.length) continue;
            var pending = [];
            for (var si = 0; si < t._emInboundShipments.length; si++) {
                var ship = t._emInboundShipments[si];
                if (!ship) continue;
                if (ship.eta <= day) {
                    if (!t.market) t.market = { supply: {}, prices: {} };
                    if (!t.market.supply) t.market.supply = {};
                    t.market.supply[ship.resourceId] = (t.market.supply[ship.resourceId] || 0) + ship.qty;
                } else {
                    pending.push(ship);
                }
            }
            t._emInboundShipments = pending;
        }
    }

    // ─── Per-EM scouting ───
    function tickEmSupplyChain() {
        var w = _getWorld(); if (!w) return;
        // First: process arrivals.
        tickEmSupplyArrivals();
        var day = _getDay();

        // Iterate elite merchants
        var people = w.people || [];
        for (var pi = 0; pi < people.length; pi++) {
            var em = people[pi];
            if (!em || !em.alive || !em.isEliteMerchant) continue;
            // Stagger via hash so not all EMs scout the same day
            var hash = 0;
            for (var ci = 0; ci < em.id.length; ci++) hash = (hash * 31 + em.id.charCodeAt(ci)) | 0;
            if (Math.abs(hash) % 7 !== day % 7) continue;

            if (em._lastSupplyScoutDay && day - em._lastSupplyScoutDay < MIN_DAYS_BETWEEN_SCOUTS_PER_EM) continue;
            if (!em.buildings || !em.buildings.length) continue;

            // v9p33river357 pass-2: only one shipment per EM per scout
            // cycle — the outer cooldown was checked, but without an
            // early exit a rich EM with many buildings could drain
            // multiple neighbor markets in a single tick.
            var emShipmentMade = false;
            for (var bi = 0; bi < em.buildings.length && !emShipmentMade; bi++) {
                var ref = em.buildings[bi];
                if (!ref || !ref.townId || !ref.type) continue;
                var bt = _findBuildingType(ref.type);
                if (!bt || !bt.consumes) continue;
                var town = _findTown(ref.townId); if (!town) continue;
                if (!town.market || !town.market.supply) continue;

                // For each consumed input the town is low on, scout neighbors.
                for (var inputId in bt.consumes) {
                    var localSupply = town.market.supply[inputId] || 0;
                    if (localSupply >= SUPPLY_LOW_THRESHOLD) continue;

                    // Check pending inbound shipments to avoid duplicates
                    var alreadyInbound = false;
                    if (town._emInboundShipments) {
                        for (var sii = 0; sii < town._emInboundShipments.length; sii++) {
                            if (town._emInboundShipments[sii] && town._emInboundShipments[sii].resourceId === inputId) {
                                alreadyInbound = true; break;
                            }
                        }
                    }
                    if (alreadyInbound) continue;

                    if (!town.connectedTowns) continue;
                    var best = null;
                    for (var ni = 0; ni < town.connectedTowns.length; ni++) {
                        var nb = _findTown(town.connectedTowns[ni]);
                        if (!nb || !nb.market || !nb.market.supply) continue;
                        var nbSupply = nb.market.supply[inputId] || 0;
                        if (nbSupply < SURPLUS_REQUIREMENT) continue;
                        var road = _findRoadBetween(town.id, nb.id);
                        if (!_isRoadPassable(road)) continue;
                        if (!best || nbSupply > best.qty) {
                            best = { neighbor: nb, qty: nbSupply, road: road };
                        }
                    }
                    if (!best) continue;

                    // Take what we can — up to (SUPPLY_LOW_THRESHOLD * 2) units.
                    var take = Math.min(SUPPLY_LOW_THRESHOLD * 2, Math.floor(best.qty * 0.5));
                    if (take <= 0) continue;
                    var fee = Math.ceil(take * TRANSPORT_FEE_PER_UNIT);
                    if ((em.gold || 0) < fee) continue;

                    // Reserve from neighbor
                    best.neighbor.market.supply[inputId] = Math.max(0, (best.neighbor.market.supply[inputId] || 0) - take);
                    em.gold = (em.gold || 0) - fee;

                    if (!town._emInboundShipments) town._emInboundShipments = [];
                    town._emInboundShipments.push({
                        resourceId: inputId,
                        qty: take,
                        fromTownId: best.neighbor.id,
                        toTownId: town.id,
                        ownerId: em.id,
                        eta: day + BASE_ETA_DAYS
                    });
                    em._lastSupplyScoutDay = day;
                    // Light log only when player owns a building in the same town (to avoid spam)
                    try {
                        var pState = (typeof Player !== 'undefined' && Player.state) ? Player.state : null;
                        if (pState && pState.townId === town.id && Engine.logEvent) {
                            Engine.logEvent('🚛 ' + (em.firstName || 'A merchant') + ' has arranged a shipment of ' + take + ' ' + inputId + ' from ' + best.neighbor.name + ' to ' + town.name + '.', { type: 'em_supply_shipment', townId: town.id }, 'local_town');
                        }
                    } catch (e) {}
                    // Only one input shortage handled per building per scout
                    emShipmentMade = true;
                    break;
                }
            }
        }
    }

    Engine.tickEmSupplyChain = tickEmSupplyChain;
    Engine.tickEmSupplyArrivals = tickEmSupplyArrivals;
})();
