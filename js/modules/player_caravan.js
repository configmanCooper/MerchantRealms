// ========================================================
// player_caravan.js
// §6b PASSENGER TRANSPORT + §5 CARAVAN TICK
// Extracted from player.js
// ========================================================
(function(Player) {
    "use strict";
    if (!Player) throw new Error("Player must be loaded before player_caravan.js");

    var player;
    function _sync() {
        player = Player.state;
        // v9p33river333: legacy saves may lack horses; caravan travel assumes an array.
        if (player && !player.horses) player.horses = [];
        // v9p33river432: caravan flows read town storage + ships directly on legacy saves.
        if (player && !player.townStorage) player.townStorage = {};
        if (player && !Array.isArray(player.ships)) player.ships = [];
    }

    // ── Player helpers (defined in player.js, accessed via Player) ──
    var logFinance = function(amount, category, description) { return Player.logFinance(amount, category, description); };
    var findResource = function(resId) { return Player.findResource(resId); };
    var hasSkill = function(skillId) { return Player.hasSkill(skillId); };
    var grantXP = function(amount, reason) { return Player.grantXP(amount, reason); };
    var unlockAchievement = function(id) { return Player.unlockAchievement(id); };
    var autoJournalCapture = function(type, text, opts) { return Player.autoJournalCapture(type, text, opts); };
    var cleanupTravelState = function() { return Player.cleanupTravelState(); };
    // v9p33river305: was single-arg alias dropping kingdomId — Player.hasLicense
    // expects (kingdomId, resourceId). Caravan restricted-sale checks always
    // saw 'no license' even with valid kingdom licenses.
    var hasLicense = function(kingdomId, resId) { return Player.hasLicense(kingdomId, resId); };
    var attemptRestrictedTrade = function(resourceId, qty, town, kingdom, basePrice) { return Player.attemptRestrictedTrade(resourceId, qty, town, kingdom, basePrice); };
    var attemptBorderCrossing = function(townId) { return Player.attemptBorderCrossing(townId); };
    var getBuildingConsumedGoods = function(bldTypeId) { return Player.getBuildingConsumedGoods(bldTypeId); };
    var getCarriedWeight = function() { return Player.getCarriedWeight(); };
    var getCarryCapacity = function() { return Player.getCarryCapacity(); };
    var getEncounterChance = function() { return Player.getEncounterChance(); };
    var getPlayerWorldPosition = function() { return Player.getPlayerWorldPosition(); };
    var travelToCoords = function(x, y) { return Player.travelToCoords(x, y); };

    // ========================================================
    // §6b PASSENGER TRANSPORT
    // ========================================================

    function getTransportCapacity() {
        _sync();
        var container = player.storageContainer;
        if (!container) return 0;
        // Must have a wagon (not just a cart) for passenger transport
        if (container !== 'wagon' && container !== 'large_wagon' && container !== 'small_wagon') return 0;
        var cargoCapacities = { small_wagon: 120, wagon: 200, large_wagon: 300 };
        var cargo = cargoCapacities[container] || 0;
        return Math.floor(cargo / 30); // Each passenger takes 30 capacity
    }

    function getSeaTransportCapacity() {
        _sync();
        if (!player.ships || player.ships.length === 0) return 0;
        var best = 0;
        for (var i = 0; i < player.ships.length; i++) {
            var ship = player.ships[i];
            var shipType = CONFIG.SHIP_TYPES[ship.type];
            var cap = shipType ? (shipType.passengers || 10) : 10;
            if (cap > best) best = cap;
        }
        return best;
    }
    function _findSeaRouteBetweenTowns(fromTownId, toTownId) {
        // v9p33river431: both NPC passage and player-run sea transport must
        // verify that a real sea route exists between the two ports.
        var seaRoutes = Engine.getSeaRoutes ? Engine.getSeaRoutes() : [];
        for (var i = 0; i < seaRoutes.length; i++) {
            if ((seaRoutes[i].fromTownId === fromTownId && seaRoutes[i].toTownId === toTownId) ||
                (seaRoutes[i].toTownId === fromTownId && seaRoutes[i].fromTownId === toTownId)) {
                return seaRoutes[i];
            }
        }
        return null;
    }
    function _checkTravelClearance(originTownId, destTownId, route) {
        // v9p33river431: paid transport must obey the same border and
        // quarantine rules as normal travel.
        var borderResult = attemptBorderCrossing(destTownId);
        if (!borderResult.allowed) {
            return { success: false, message: borderResult.message };
        }
        var quarantineCheck = _checkRouteQuarantine(route, originTownId, destTownId);
        if (quarantineCheck && !quarantineCheck.allowed) {
            return { success: false, message: quarantineCheck.message };
        }
        return { success: true };
    }

    function useNPCTransport(townId, serviceIndex) {
        _sync();
        if (player.traveling) return { success: false, message: 'Already traveling.' };
        if (player.townId !== townId) return { success: false, message: 'Not in this town.' };

        var town = Engine.findTown(townId);
        if (!town || !town.npcTransportServices) return { success: false, message: 'No transport services available.' };

        var service = town.npcTransportServices[serviceIndex];
        if (!service) return { success: false, message: 'Service not found.' };
        if (service.capacity <= 0) return { success: false, message: 'This service is full.' };
        if (player.gold < service.price) return { success: false, message: 'Not enough gold. Need ' + service.price + 'g.' };

        var destTown = Engine.findTown(service.destinationTownId);
        if (!destTown) return { success: false, message: 'Destination not found.' };

        var route = null;
        var totalDist = 0;
        if (service.isSea) {
            var seaRoute = _findSeaRouteBetweenTowns(townId, service.destinationTownId);
            if (!seaRoute) return { success: false, message: 'No sea route found.' };
            route = [seaRoute];
            totalDist = (seaRoute.distance || 500) * 0.7;
        } else {
            route = Engine.findPath(townId, service.destinationTownId);
            if (!route || route.length === 0) return { success: false, message: 'No route found.' };
            for (var s = 0; s < route.length; s++) {
                var a = Engine.findTown(route[s].fromTownId);
                var b = Engine.findTown(route[s].toTownId);
                if (a && b) totalDist += Math.hypot(a.x - b.x, a.y - b.y) / (CONFIG.CARAVAN_ROAD_MULTIPLIER[route[s].quality] || 1);
            }
            totalDist *= 0.6;
        }

        var accessCheck = _checkTravelClearance(townId, service.destinationTownId, route);
        if (!accessCheck.success) return accessCheck;

        // v9p33river431: only charge paid transport after the route clears the
        // same border and quarantine checks as regular travel.
        player.gold -= service.price;
        player.stats = player.stats || {};
        player.stats.totalGoldSpent = (player.stats.totalGoldSpent || 0) + service.price;
        service.capacity -= 1;

        // Pay the NPC operator
        var operator = Engine.findPerson ? Engine.findPerson(service.operatorId) : null;
        if (operator) operator.gold = (operator.gold || 0) + service.price;

        player.traveling = true;
        player.travelProgress = 0;
        player.travelDestination = service.destinationTownId;
        player.travelRoute = route;
        player.travelOrigin = townId;
        player.travelPaid = true;

        if (service.isSea) {
            player.travelBySea = true;
            // v9p33river285: use 'npc_vessel' (the canonical paid-sea mode) so
            // the energy drain code in player.js recognises it as paid transport
            // (was 'npc_sea', which fell through to the walking-drain branch).
            player.travelMode = 'npc_vessel';
        } else {
            // v9p33river285: mark paid land transport so energy drain treats it
            // as 'npc_carriage' (passive drain only) instead of walking, and so
            // the player cannot turn back mid-route.
            player.travelMode = 'npc_carriage';
            player.travelBySea = false;
        }
        player.travelTotalDist = totalDist;

        Engine.logEvent('🚐 You boarded ' + service.operatorName + "'s transport to " + destTown.name + ' for ' + service.price + 'g.', null, 'travel_events');
        return { success: true, message: '🚐 Boarding transport to ' + destTown.name + '! Paid ' + service.price + 'g.' };
    }

    function setupTransport(townId, destTownId, pricePerPassenger, isSea) {
        _sync();
        if (player.traveling) return { success: false, message: 'Cannot setup transport while traveling.' };
        if (player.townId !== townId) return { success: false, message: 'Must be in the town.' };
        pricePerPassenger = Number(pricePerPassenger);
        if (!pricePerPassenger || !isFinite(pricePerPassenger) || pricePerPassenger <= 0) return { success: false, message: 'Invalid fare price.' };

        var town = Engine.findTown(townId);
        var destTown = Engine.findTown(destTownId);
        if (!town || !destTown) return { success: false, message: 'Invalid towns.' };

        var maxCap;
        if (isSea) {
            maxCap = getSeaTransportCapacity();
            if (maxCap === 0) return { success: false, message: 'You need a ship for sea transport.' };
            if (!town.isPort || !destTown.isPort) return { success: false, message: 'Both towns must be ports for sea transport.' };
            // v9p33river431: ship capacity + port checks are not enough; only
            // offer sea passenger transport when a real sea lane exists.
            if (!_findSeaRouteBetweenTowns(townId, destTownId)) return { success: false, message: 'No sea route to that destination.' };
        } else {
            maxCap = getTransportCapacity();
            if (maxCap === 0) return { success: false, message: 'You need a wagon and horses for land transport.' };
            if (player.horses.length === 0) return { success: false, message: 'You need at least one horse.' };
            var route = Engine.findPath(townId, destTownId);
            if (!route || route.length === 0) return { success: false, message: 'No road to that destination.' };
        }

        // Find willing passengers from town's travel demand
        var demand = town.travelDemand || [];
        var passengers = [];
        for (var i = 0; i < demand.length; i++) {
            var d = demand[i];
            if (d.destinationTownId === destTownId && d.maxPrice >= pricePerPassenger) {
                passengers.push(d);
                if (passengers.length >= maxCap) break;
            }
        }

        if (passengers.length === 0) {
            return { success: false, message: 'No passengers willing to pay ' + pricePerPassenger + 'g to go to ' + destTown.name + '.' };
        }

        // Remove passengers from town demand
        for (var j = 0; j < passengers.length; j++) {
            var idx = town.travelDemand.indexOf(passengers[j]);
            if (idx !== -1) town.travelDemand.splice(idx, 1);
        }

        // Create transport record
        var totalRevenue = passengers.length * pricePerPassenger;
        player.activeTransport = {
            fromTownId: townId,
            toTownId: destTownId,
            passengers: passengers.map(function(p) { return { personId: p.personId, name: p.personName, wealthClass: p.wealthClass, fare: pricePerPassenger }; }),
            totalRevenue: totalRevenue,
            isSea: !!isSea,
            status: 'boarding'
        };

        Engine.logEvent('\uD83D\uDE8C ' + passengers.length + ' passengers boarded for ' + destTown.name + '. Revenue: ' + totalRevenue + 'g', null, 'my_business');
        return { success: true, message: '\u2705 ' + passengers.length + ' passengers boarded! They\'ll pay ' + totalRevenue + 'g total when you arrive at ' + destTown.name + '.', passengers: passengers.length, revenue: totalRevenue };
    }

    function completeTransport() {
        _sync();
        if (!player.activeTransport) return { success: false, message: 'No active transport.' };
        var transport = player.activeTransport;
        if (player.townId !== transport.toTownId) return { success: false, message: 'You have not reached the destination yet.' };

        // v9p33river431: only pay for passengers who still exist and are alive
        // when the transport actually arrives.
        var passengerCount = 0;
        var deliveredRevenue = 0;
        for (var i = 0; i < transport.passengers.length; i++) {
            var passenger = transport.passengers[i];
            var person = Engine.findPerson ? Engine.findPerson(passenger.personId) : null;
            if (!person || !person.alive) continue;
            person.townId = transport.toTownId;
            passengerCount += 1;
            deliveredRevenue += passenger.fare || 0;
        }

        player.stats = player.stats || {};
        player.gold += deliveredRevenue;
        player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + deliveredRevenue;

        var destTown = Engine.findTown(transport.toTownId);
        Engine.logEvent('🚌 Delivered ' + passengerCount + ' passengers to ' + (destTown ? destTown.name : 'destination') + '. Earned ' + deliveredRevenue + 'g!', null, 'my_business');
        if (passengerCount > 0) grantXP(5 + passengerCount * 2, 'Passenger transport');
        player.activeTransport = null;
        return {
            success: true,
            message: 'Delivered ' + passengerCount + ' passengers to ' + (destTown ? destTown.name : 'destination') + '. Earned ' + deliveredRevenue + 'g.',
            passengers: passengerCount,
            revenue: deliveredRevenue
        };
    }

    function cancelTransport() {
        _sync();
        if (!player.activeTransport) return { success: false, message: 'No active transport.' };
        var transport = player.activeTransport;
        // v9p33river431: once you are already at the destination, finishing the
        // transport must not bounce passengers back to the origin queue.
        if (player.townId === transport.toTownId) {
            return completeTransport();
        }
        // Return passengers to origin town's travel demand
        var originTown = Engine.findTown(transport.fromTownId);
        if (originTown) {
            if (!originTown.travelDemand) originTown.travelDemand = [];
            var destTown = Engine.findTown(transport.toTownId);
            for (var i = 0; i < transport.passengers.length; i++) {
                var p = transport.passengers[i];
                originTown.travelDemand.push({
                    personId: p.personId,
                    personName: p.name,
                    wealthClass: p.wealthClass,
                    destinationTownId: transport.toTownId,
                    destinationName: destTown ? destTown.name : '?',
                    maxPrice: p.fare,
                    urgency: 1,
                    createdDay: Engine.getDay ? Engine.getDay() : 0
                });
            }
        }
        var count = transport.passengers.length;
        player.activeTransport = null;
        Engine.logEvent('🚌 Transport cancelled. ' + count + ' passengers returned to ' + (originTown ? originTown.name : 'origin') + '.', null, 'my_business');
        return { success: true, message: 'Transport cancelled. ' + count + ' passengers returned to waiting.' };
    }

    function _hasLocalQuarantinePrivilege(kingdomId) {
        // v9p33river431: the global isNoble flag is cross-kingdom, so only the
        // player's rank in the current kingdom should grant quarantine passage.
        var localRank = (player.socialRank && player.socialRank[kingdomId]) || 0;
        return localRank >= 4 || !!(player.isKing && player.kingState && player.kingState.kingdomId === kingdomId);
    }
    function _hasOfficialQuarantineOrders(kingdomId) {
        // v9p33river431: quarantine clearance from auto-travel only applies to
        // recognized crown missions issued by the kingdom running the checkpoint.
        var mission = player.autoTravelJob;
        var officialTypes = ['royal_messenger', 'spy', 'weapons_courier', 'privateer'];
        return !!(mission && officialTypes.indexOf(mission.type) >= 0 && mission.kingdomId === kingdomId);
    }

    // Quarantine travel check — nobles pass freely, others can try to sneak through
    function _checkRouteQuarantine(route, originTownId, destTownId) {
        _sync();
        // Collect all town IDs along the route
        var routeTownIds = {};
        routeTownIds[originTownId] = true;
        routeTownIds[destTownId] = true;
        for (var si = 0; si < route.length; si++) {
            if (route[si].fromTownId) routeTownIds[route[si].fromTownId] = true;
            if (route[si].toTownId) routeTownIds[route[si].toTownId] = true;
        }
        // Check each town for quarantine via kingdom.healthPolicies
        for (var tid in routeTownIds) {
            var t = Engine.findTown(tid);
            if (!t) continue;
            var qType = null;
            // Check kingdom health policies for this town
            if (t.kingdomId) {
                var kingdom = Engine.findKingdom ? Engine.findKingdom(t.kingdomId) : null;
                if (kingdom && kingdom.healthPolicies) {
                    var day = Engine.getDay ? Engine.getDay() : 0;
                    for (var qi = 0; qi < kingdom.healthPolicies.length; qi++) {
                        var pol = kingdom.healthPolicies[qi];
                        if (!pol.active || (pol.expiresDay && day > pol.expiresDay)) continue;
                        if (pol.townId !== tid) continue;
                        if (pol.type === 'martial_quarantine') { qType = 'martial'; break; }
                        if (pol.type === 'quarantine_town') { qType = 'standard'; }
                    }
                }
            }
            // Also check town.quarantined flag (set by RA propose action)
            if (!qType && t.quarantined) {
                qType = 'standard';
            }
            if (!qType) continue;

            var isMartial = qType === 'martial';
            var qLabel = isMartial ? 'martial quarantine' : 'quarantine';

            if (_hasLocalQuarantinePrivilege(t.kingdomId)) {
                return { allowed: true, message: 'Your standing in this kingdom grants passage through the ' + qLabel + ' at ' + t.name + '.' };
            }
            if (_hasOfficialQuarantineOrders(t.kingdomId)) {
                return { allowed: true, message: '📜 Your official kingdom orders grant passage through the ' + qLabel + ' at ' + t.name + '.' };
            }
            // Guildmasters (rank 3) can pass standard quarantine on trade business, but NOT martial
            var playerRankInKingdom = 0;
            if (t.kingdomId && player.socialRank) {
                playerRankInKingdom = player.socialRank[t.kingdomId] || 0;
            }
            if (!isMartial && playerRankInKingdom >= 3) {
                return { allowed: true, message: 'Your merchant standing lets you pass the quarantine at ' + t.name + ' on official trade business.' };
            }

            // Sneak attempt — 40% for standard, 20% for martial
            var sneakChance = isMartial ? 0.20 : 0.40;
            if (hasSkill('cartographer')) sneakChance += 0.10;
            if (hasSkill('shadow_step')) sneakChance += 0.05;
            if (hasSkill('ghost')) sneakChance += 0.10;
            if (hasSkill('master_disguise')) sneakChance += 0.05;
            if (hasSkill('master_smuggler')) sneakChance += 0.05;
            var _sneakHour = Engine.getHour ? Engine.getHour() : 12;
            if (_sneakHour >= 20 || _sneakHour < 5) sneakChance += 0.10;
            // Guard relationship bonus for sneak
            var _sneakGuardRel = 0;
            var _sneakPeople = Engine.getPeople ? Engine.getPeople(tid) : [];
            for (var _sgi = 0; _sgi < _sneakPeople.length; _sgi++) {
                var _sg = _sneakPeople[_sgi];
                if (_sg.alive && (_sg.occupation === 'guard' || _sg.occupation === 'soldier')) {
                    var _sgr = player.relationships[_sg.id];
                    if (_sgr && _sgr.level > _sneakGuardRel) _sneakGuardRel = _sgr.level;
                }
            }
            if (_sneakGuardRel >= 60) sneakChance += 0.15;
            else if (_sneakGuardRel >= 40) sneakChance += 0.08;
            sneakChance = Math.min(sneakChance, 0.95);
            var rng = Engine.getRng();
            if (rng.chance(sneakChance)) {
                return { allowed: true, message: '🤫 You slipped past the ' + qLabel + ' guards at ' + t.name + '.' };
            }

            // Caught — kingdom decides fine or jail based on king personality
            var kingdom = t.kingdomId ? Engine.findKingdom(t.kingdomId) : null;
            var kp = kingdom ? kingdom.kingPersonality : null;
            var punishment = _quarantinePunishment(kingdom, kp, isMartial, rng);
            // v9p33river133: caught sneaking adds +2 notoriety (bribery adds +5).
            player.notoriety = Math.min(100, (player.notoriety || 0) + 2);

            if (punishment.type === 'jail') {
                var jailDays = punishment.days;
                if (hasSkill('jail_break')) jailDays = Math.max(1, Math.floor(jailDays * 0.5));
                player.jailedUntilDay = Engine.getDay() + jailDays;
                player.jailReason = 'Violating ' + qLabel;
                if (punishment.fine > 0) {
                    Player.deductGoldOrDebt(punishment.fine, 'kingdom', kingdom ? kingdom.id : 'unknown', kingdom ? kingdom.name : 'Kingdom', 'Fine for violating ' + qLabel);
                }
                EventTypes.emit('QUARANTINE_VIOLATION_JAILED', { playerName: player.fullName, quarantineType: qLabel, townName: t.name, days: jailDays, extra: punishment.fine > 0 ? ' and fined ' + punishment.fine + 'g' : '' });
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚔 Caught! Jailed ' + jailDays + ' days for violating ' + qLabel + '.', 'error', 'critical');
                return { allowed: false, message: '🚧 Caught violating ' + qLabel + ' at ' + t.name + '! Jailed for ' + jailDays + ' days' + (punishment.fine > 0 ? ', fined ' + punishment.fine + 'g' : '') + '.' };
            } else {
                // Fine only — remainder becomes debt
                Player.deductGoldOrDebt(punishment.fine, 'kingdom', kingdom ? kingdom.id : 'unknown', kingdom ? kingdom.name : 'Kingdom', 'Fine for violating ' + qLabel);
                EventTypes.emit('QUARANTINE_VIOLATION_FINED', { playerName: player.fullName, townName: t.name, quarantineType: qLabel, gold: punishment.fine });
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚧 Caught! Fined ' + punishment.fine + 'g for violating ' + qLabel + '.', 'warning', 'critical');
                return { allowed: false, message: '🚧 Caught at ' + t.name + ' ' + qLabel + '! Fined ' + punishment.fine + 'g and turned away.' };
            }
        }
        return null; // no quarantine on route
    }

    // Determine quarantine violation punishment based on kingdom personality
    function _quarantinePunishment(kingdom, kp, isMartial, rng, isBribery) {
        _sync();
        // Base fine scales with martial vs standard
        var baseFine = isMartial ? 100 : 40;
        var baseJailDays = isMartial ? 5 : 2;

        if (kp) {
            // Harsh/tyrannical kings jail more and fine higher
            if (kp.temperament === 'cruel' || kp.temperament === 'stern') {
                baseFine = Math.floor(baseFine * 1.5);
                baseJailDays = Math.floor(baseJailDays * 1.5);
            } else if (kp.temperament === 'kind') {
                baseFine = Math.floor(baseFine * 0.6);
                baseJailDays = Math.max(1, Math.floor(baseJailDays * 0.5));
            }
            // Greedy kings prefer fines over jail (they want gold)
            if (kp.greed === 'greedy' || kp.greed === 'corrupt') {
                baseFine = Math.floor(baseFine * 1.4);
            }
        }

        // Bribery is an additional offense — harsher punishment
        if (isBribery) {
            baseFine = Math.floor(baseFine * 1.3);
            baseJailDays += 2;
            // High-justice kings punish bribery even harder
            if (kp && kp.justice === 'just') {
                baseFine = Math.floor(baseFine * 1.5);
                baseJailDays = Math.floor(baseJailDays * 1.5);
            }
            // Greedy kings: boost the fine for bribery (they want the money)
            if (kp && (kp.greed === 'greedy' || kp.greed === 'corrupt')) {
                baseFine = Math.floor(baseFine * 1.2);
            }
        }

        // Reputation loss with kingdom: -1 to -5 based on king personality.
        // v9p33river132: drastically reduced (was -5 to -15) since the
        // diminishing-returns Proxy doesn't scale losses, making caught
        // sneaks/bribes feel disproportionately punishing at high rep.
        // High-justice kings still add +5 for bribery specifically.
        var repLoss = 2;
        if (kp) {
            if (kp.temperament === 'cruel' || kp.temperament === 'tyrannical') repLoss = 5;
            else if (kp.temperament === 'merciful' || kp.temperament === 'kind') repLoss = 1;
            if (isBribery && typeof kp.justice === 'number' && kp.justice >= 70) repLoss += 5;
        }
        if (kingdom && kingdom.id) {
            player.reputation[kingdom.id] = Math.max(0, (player.reputation[kingdom.id] || 50) - repLoss);
        }

        // Martial quarantine: always jail. Standard: 40% chance jail, 60% fine only
        var jailChance = isMartial ? 0.85 : 0.40;
        if (kp && (kp.temperament === 'cruel' || kp.temperament === 'tyrannical')) jailChance += 0.20;
        if (kp && (kp.temperament === 'merciful' || kp.temperament === 'kind')) jailChance -= 0.25;
        // Greedy kings less likely to jail for bribery — they prefer fines
        if (isBribery && kp && (kp.greed === 'greedy' || kp.greed === 'corrupt')) jailChance -= 0.15;
        jailChance = Math.max(0.1, Math.min(0.95, jailChance));

        if (rng.chance(jailChance)) {
            return { type: 'jail', days: baseJailDays, fine: baseFine, repLoss: repLoss };
        }
        return { type: 'fine', fine: baseFine, repLoss: repLoss };
    }

    // Read-only quarantine info for a travel destination (no side effects)
    function getRouteQuarantineInfo(townId) {
        _sync();
        var originTownId = player.townId;
        if (!originTownId) return null;
        var route = Engine.findPath(originTownId, townId);
        if (!route || route.length === 0) return null;

        var routeTownIds = {};
        routeTownIds[originTownId] = true;
        routeTownIds[townId] = true;
        for (var si = 0; si < route.length; si++) {
            if (route[si].fromTownId) routeTownIds[route[si].fromTownId] = true;
            if (route[si].toTownId) routeTownIds[route[si].toTownId] = true;
        }

        for (var tid in routeTownIds) {
            var t = Engine.findTown(tid);
            if (!t) continue;
            var qType = null;
            if (t.kingdomId) {
                var kingdom = Engine.findKingdom ? Engine.findKingdom(t.kingdomId) : null;
                if (kingdom && kingdom.healthPolicies) {
                    var day = Engine.getDay ? Engine.getDay() : 0;
                    for (var qi = 0; qi < kingdom.healthPolicies.length; qi++) {
                        var pol = kingdom.healthPolicies[qi];
                        if (!pol.active || (pol.expiresDay && day > pol.expiresDay)) continue;
                        if (pol.townId !== tid) continue;
                        if (pol.type === 'martial_quarantine') { qType = 'martial'; break; }
                        if (pol.type === 'quarantine_town') { qType = 'standard'; }
                    }
                }
            }
            if (!qType && t.quarantined) qType = 'standard';
            if (!qType) continue;

            var isMartial = qType === 'martial';
            var qLabel = isMartial ? 'Martial Quarantine' : 'Quarantine';

            // v9p33river431: preview uses the same kingdom-specific privilege
            // checks as the live quarantine gate.
            if (_hasLocalQuarantinePrivilege(t.kingdomId)) {
                return { blocked: false, townName: t.name, townId: tid, qType: qType, qLabel: qLabel,
                    reason: 'Your standing in this kingdom grants free passage.' };
            }
            if (_hasOfficialQuarantineOrders(t.kingdomId)) {
                return { blocked: false, townName: t.name, townId: tid, qType: qType, qLabel: qLabel,
                    reason: 'Your official kingdom orders grant passage.' };
            }
            var playerRankInKingdom = 0;
            if (t.kingdomId && player.socialRank) {
                playerRankInKingdom = player.socialRank[t.kingdomId] || 0;
            }
            if (!isMartial && playerRankInKingdom >= 3) {
                return { blocked: false, townName: t.name, townId: tid, qType: qType, qLabel: qLabel,
                    reason: 'Your merchant standing grants passage on trade business.' };
            }

            // Blocked — find guard NPC at checkpoint
            var _qPeople = Engine.getPeople ? Engine.getPeople(tid) : [];
            var _qGuard = null;
            var _qGuardFallback = null;
            for (var _qgi = 0; _qgi < _qPeople.length; _qgi++) {
                var _qgp = _qPeople[_qgi];
                if (!_qgp.alive) continue;
                if (_qgp.occupation === 'guard' || _qgp.occupation === 'soldier') {
                    _qGuard = _qgp;
                    break;
                }
                if (!_qGuardFallback && _qgp.occupation !== 'noble' && _qgp.occupation !== 'king' && _qgp.occupation !== 'merchant') {
                    _qGuardFallback = _qgp;
                }
            }
            if (!_qGuard) _qGuard = _qGuardFallback;
            var guardId = _qGuard ? _qGuard.id : null;
            var guardName = _qGuard ? ((_qGuard.firstName || '') + ' ' + (_qGuard.lastName || '')).trim() : 'Guard Captain';
            if (!guardName) guardName = 'Guard Captain';

            // Guard relationship
            var guardRelLevel = 0;
            if (guardId) {
                var _gRel = player.relationships[guardId];
                if (_gRel) guardRelLevel = _gRel.level || 0;
            }

            // Calculate sneak chance with all modifiers
            var sneakChance = isMartial ? 0.20 : 0.40;
            var sneakModifiers = [];
            if (hasSkill('cartographer')) { sneakChance += 0.10; sneakModifiers.push({ name: 'Cartographer', bonus: 10 }); }
            if (hasSkill('shadow_step')) { sneakChance += 0.05; sneakModifiers.push({ name: 'Shadow Step', bonus: 5 }); }
            if (hasSkill('ghost')) { sneakChance += 0.10; sneakModifiers.push({ name: 'Ghost', bonus: 10 }); }
            if (hasSkill('master_disguise')) { sneakChance += 0.05; sneakModifiers.push({ name: 'Master Disguise', bonus: 5 }); }
            if (hasSkill('master_smuggler')) { sneakChance += 0.05; sneakModifiers.push({ name: 'Master Smuggler', bonus: 5 }); }
            var _qHour = Engine.getHour ? Engine.getHour() : 12;
            var isNighttime = _qHour >= 20 || _qHour < 5;
            if (isNighttime) { sneakChance += 0.05; sneakModifiers.push({ name: 'Nighttime', bonus: 5 }); }
            if (guardRelLevel >= 60) { sneakChance += 0.15; sneakModifiers.push({ name: 'Guard Relationship (60+)', bonus: 15 }); }
            else if (guardRelLevel >= 40) { sneakChance += 0.08; sneakModifiers.push({ name: 'Guard Relationship (40+)', bonus: 8 }); }
            sneakChance = Math.min(sneakChance, 0.95);

            // Calculate bribe tiers
            var _qRng = Engine.getRng();
            var _weeklyPay = 100;
            var bribeLow = _qRng.randInt(4 * _weeklyPay, 8 * _weeklyPay);
            var bribeMed = _qRng.randInt(9 * _weeklyPay, 16 * _weeklyPay);
            var bribeHigh = _qRng.randInt(17 * _weeklyPay, 26 * _weeklyPay);

            // Bribe success modifiers
            var bribeBonus = 0;
            var bribeModifiers = [];
            if (hasSkill('bribe_expert')) { bribeBonus += 0.15; bribeModifiers.push({ name: 'Bribe Expert', bonus: 15 }); }
            if (hasSkill('corruption_expert')) { bribeBonus += 0.15; bribeModifiers.push({ name: 'Corruption Expert', bonus: 15 }); }
            if (hasSkill('silver_tongue_dark')) { bribeBonus += 0.10; bribeModifiers.push({ name: 'Silver Tongue (Dark)', bonus: 10 }); }
            if (!hasSkill('silver_tongue_dark')) {
                if (hasSkill('silver_tongue') || hasSkill('golden_tongue')) {
                    bribeBonus += 0.05;
                    bribeModifiers.push({ name: hasSkill('silver_tongue') ? 'Silver Tongue' : 'Golden Tongue', bonus: 5 });
                }
            }
            if (hasSkill('charming') || hasSkill('charismatic')) {
                bribeBonus += 0.05;
                bribeModifiers.push({ name: hasSkill('charismatic') ? 'Charismatic' : 'Charming', bonus: 5 });
            }
            if (guardRelLevel >= 60) { bribeBonus += 0.15; bribeModifiers.push({ name: 'Guard Relationship (60+)', bonus: 15 }); }
            else if (guardRelLevel >= 40) { bribeBonus += 0.08; bribeModifiers.push({ name: 'Guard Relationship (40+)', bonus: 8 }); }

            var bribeLowChance = Math.min(0.95, 0.25 + bribeBonus);
            var bribeMedChance = Math.min(0.95, 0.45 + bribeBonus);
            var bribeHighChance = Math.min(0.95, 0.75 + bribeBonus);

            var bribes = [
                { tier: 'low', cost: bribeLow, chance: bribeLowChance, label: 'Small Bribe' },
                { tier: 'medium', cost: bribeMed, chance: bribeMedChance, label: 'Generous Bribe' },
                { tier: 'high', cost: bribeHigh, chance: bribeHighChance, label: 'Lavish Bribe' }
            ];

            // Consequences preview
            var _cKingdom = t.kingdomId ? Engine.findKingdom(t.kingdomId) : null;
            var _cKp = _cKingdom ? _cKingdom.kingPersonality : null;
            var sneakFine = isMartial ? 100 : 40;
            var sneakJailDays = isMartial ? 5 : 2;
            if (_cKp) {
                if (_cKp.temperament === 'cruel' || _cKp.temperament === 'tyrannical') {
                    sneakFine = Math.floor(sneakFine * 1.5);
                    sneakJailDays = Math.floor(sneakJailDays * 1.5);
                } else if (_cKp.temperament === 'merciful' || _cKp.temperament === 'kind') {
                    sneakFine = Math.floor(sneakFine * 0.6);
                    sneakJailDays = Math.max(1, Math.floor(sneakJailDays * 0.5));
                }
                if (_cKp.greed === 'greedy' || _cKp.greed === 'corrupt') {
                    sneakFine = Math.floor(sneakFine * 1.4);
                }
            }
            var bribeFine = Math.floor(sneakFine * 1.3);
            var bribeJailDays = sneakJailDays + 2;
            if (_cKp && typeof _cKp.justice === 'number' && _cKp.justice >= 70) {
                bribeFine = Math.floor(bribeFine * 1.5);
                bribeJailDays = Math.floor(bribeJailDays * 1.5);
            }

            var kingTemperament = 'fair';
            if (_cKp) {
                if (_cKp.temperament === 'cruel' || _cKp.temperament === 'tyrannical') kingTemperament = 'strict';
                else if (_cKp.temperament === 'merciful' || _cKp.temperament === 'kind') kingTemperament = 'merciful';
            }

            // Doctor persuasion option
            var doctorPersuasion = null;
            var hasDoctor = hasSkill('doctor');
            var ownsMedicalHere = false;
            var ownsMedicalDest = false;
            if (player.buildings) {
                for (var _dbi = 0; _dbi < player.buildings.length; _dbi++) {
                    var _db = player.buildings[_dbi];
                    if (_db.type === 'clinic' || _db.type === 'hospital') {
                        if (_db.townId === originTownId) ownsMedicalHere = true;
                        if (_db.townId === tid) ownsMedicalDest = true;
                    }
                }
            }
            // If origin and quarantine town are the same, only count once (as dest bonus)
            if (originTownId === tid && ownsMedicalHere && ownsMedicalDest) ownsMedicalHere = false;
            if (hasDoctor || ownsMedicalHere || ownsMedicalDest) {
                var _dpChance = 0;
                var _dpReasons = [];
                if (hasDoctor) { _dpChance += 0.50; _dpReasons.push('Doctor skill (+50%)'); }
                if (ownsMedicalHere) { _dpChance += 0.20; _dpReasons.push('Own clinic/hospital in ' + (Engine.findTown(originTownId) || {}).name + ' (+20%)'); }
                if (ownsMedicalDest) { _dpChance += 0.25; _dpReasons.push('Own clinic/hospital in ' + t.name + ' (+25%)'); }
                _dpChance = Math.min(0.95, _dpChance);
                // Cooldown check
                var _dpCooldownDay = player._doctorPersuasionCooldown || 0;
                var _dpOnCooldown = (Engine.getDay ? Engine.getDay() : 0) < _dpCooldownDay;
                var _dpCooldownRemaining = _dpOnCooldown ? (_dpCooldownDay - (Engine.getDay ? Engine.getDay() : 0)) : 0;
                doctorPersuasion = {
                    chance: _dpChance,
                    reasons: _dpReasons,
                    onCooldown: _dpOnCooldown,
                    cooldownDays: _dpCooldownRemaining
                };
            }

            // Ranks allowed through
            var allowedRanks = [];
            allowedRanks.push('Minor Noble or higher (rank 4+)');
            if (!isMartial) allowedRanks.push('Guildmaster (rank 3)');

            return {
                blocked: true, townName: t.name, townId: tid, qType: qType, qLabel: qLabel, isMartial: isMartial,
                sneakChance: sneakChance, sneakModifiers: sneakModifiers, allowedRanks: allowedRanks,
                guardId: guardId, guardName: guardName, guardRelLevel: guardRelLevel,
                bribes: bribes, bribeModifiers: bribeModifiers,
                sneakFine: sneakFine, sneakJailDays: sneakJailDays,
                bribeFine: bribeFine, bribeJailDays: bribeJailDays,
                kingTemperament: kingTemperament, isNighttime: isNighttime,
                doctorPersuasion: doctorPersuasion
            };
        }
        return null;
    }

    // Execute a quarantine sneak attempt (called after player confirms)
    function attemptQuarantineSneak(destTownId) {
        _sync();
        var originTownId = player.townId;
        if (!originTownId) return { allowed: false, message: 'Cannot determine location.' };
        var route = Engine.findPath(originTownId, destTownId);
        if (!route || route.length === 0) return { allowed: false, message: 'No route found.' };
        return _checkRouteQuarantine(route, originTownId, destTownId);
    }

    // Execute a quarantine bribe attempt (called after player selects bribe tier)
    function attemptQuarantineBribe(destTownId, tier, bribeCost) {
        _sync();
        var originTownId = player.townId;
        if (!originTownId) return { allowed: false, message: 'Cannot determine location.' };
        var route = Engine.findPath(originTownId, destTownId);
        if (!route || route.length === 0) return { allowed: false, message: 'No route found.' };

        // Find the quarantined town on route
        var routeTownIds = {};
        routeTownIds[originTownId] = true;
        routeTownIds[destTownId] = true;
        for (var _bsi = 0; _bsi < route.length; _bsi++) {
            if (route[_bsi].fromTownId) routeTownIds[route[_bsi].fromTownId] = true;
            if (route[_bsi].toTownId) routeTownIds[route[_bsi].toTownId] = true;
        }

        for (var _btid in routeTownIds) {
            var _bt = Engine.findTown(_btid);
            if (!_bt) continue;
            var _bqType = null;
            if (_bt.kingdomId) {
                var _bkingdom = Engine.findKingdom ? Engine.findKingdom(_bt.kingdomId) : null;
                if (_bkingdom && _bkingdom.healthPolicies) {
                    var _bday = Engine.getDay ? Engine.getDay() : 0;
                    for (var _bqi = 0; _bqi < _bkingdom.healthPolicies.length; _bqi++) {
                        var _bpol = _bkingdom.healthPolicies[_bqi];
                        if (!_bpol.active || (_bpol.expiresDay && _bday > _bpol.expiresDay)) continue;
                        if (_bpol.townId !== _btid) continue;
                        if (_bpol.type === 'martial_quarantine') { _bqType = 'martial'; break; }
                        if (_bpol.type === 'quarantine_town') { _bqType = 'standard'; }
                    }
                }
            }
            if (!_bqType && _bt.quarantined) _bqType = 'standard';
            if (!_bqType) continue;

            var _bisMartial = _bqType === 'martial';
            var _bqLabel = _bisMartial ? 'martial quarantine' : 'quarantine';

            if (_hasLocalQuarantinePrivilege(_bt.kingdomId)) {
                return { allowed: true, message: 'Your standing in this kingdom grants passage through the ' + _bqLabel + ' at ' + _bt.name + '.' };
            }
            if (_hasOfficialQuarantineOrders(_bt.kingdomId)) {
                return { allowed: true, message: '📜 Your official kingdom orders grant passage through the ' + _bqLabel + ' at ' + _bt.name + '.' };
            }
            var _bpRank = 0;
            if (_bt.kingdomId && player.socialRank) {
                _bpRank = player.socialRank[_bt.kingdomId] || 0;
            }
            if (!_bisMartial && _bpRank >= 3) {
                return { allowed: true, message: 'Your merchant standing lets you pass the quarantine at ' + _bt.name + ' on official trade business.' };
            }

            // Check if player can afford the bribe
            if (player.gold < bribeCost) {
                return { allowed: false, message: 'You cannot afford the ' + bribeCost + 'g bribe.' };
            }

            // Determine base success chance from tier
            var _bBaseChance = 0.25;
            if (tier === 'medium') _bBaseChance = 0.45;
            else if (tier === 'high') _bBaseChance = 0.75;

            // Skill modifiers
            var _bBonus = 0;
            if (hasSkill('bribe_expert')) _bBonus += 0.15;
            if (hasSkill('corruption_expert')) _bBonus += 0.15;
            if (hasSkill('silver_tongue_dark')) _bBonus += 0.10;
            if (!hasSkill('silver_tongue_dark')) {
                if (hasSkill('silver_tongue') || hasSkill('golden_tongue')) _bBonus += 0.05;
            }
            if (hasSkill('charming') || hasSkill('charismatic')) _bBonus += 0.05;

            // Guard relationship bonus
            var _bPeople = Engine.getPeople ? Engine.getPeople(_btid) : [];
            var _bGuardRel = 0;
            for (var _bgri = 0; _bgri < _bPeople.length; _bgri++) {
                var _bgp = _bPeople[_bgri];
                if (_bgp.alive && (_bgp.occupation === 'guard' || _bgp.occupation === 'soldier')) {
                    var _bgrv = player.relationships[_bgp.id];
                    if (_bgrv && _bgrv.level > _bGuardRel) _bGuardRel = _bgrv.level;
                }
            }
            if (_bGuardRel >= 60) _bBonus += 0.15;
            else if (_bGuardRel >= 40) _bBonus += 0.08;

            var _bSuccessChance = Math.min(0.95, _bBaseChance + _bBonus);
            var rng = Engine.getRng();

            if (rng.chance(_bSuccessChance)) {
                // Bribe succeeded — deduct gold, log event
                player.gold -= bribeCost;
                EventTypes.emit('QUARANTINE_BRIBE_SUCCESS', { playerName: player.fullName, gold: bribeCost, quarantineType: _bqLabel, townName: _bt.name });
                return { allowed: true, message: '💰 You slipped the guard ' + bribeCost + 'g and were waved through the ' + _bqLabel + ' at ' + _bt.name + '.' };
            }

            // Bribe failed — lose half the bribe money in the attempt, harsher punishment
            player.gold -= Math.floor(bribeCost * 0.5);
            player.notoriety = Math.min(100, (player.notoriety || 0) + 5);

            var _bKingdom = _bt.kingdomId ? Engine.findKingdom(_bt.kingdomId) : null;
            var _bKp = _bKingdom ? _bKingdom.kingPersonality : null;
            var _bPunishment = _quarantinePunishment(_bKingdom, _bKp, _bisMartial, rng, true);

            if (_bPunishment.type === 'jail') {
                var _bJailDays = _bPunishment.days;
                if (hasSkill('jail_break')) _bJailDays = Math.max(1, Math.floor(_bJailDays * 0.5));
                player.jailedUntilDay = Engine.getDay() + _bJailDays;
                player.jailReason = 'Bribery and violating ' + _bqLabel;
                if (_bPunishment.fine > 0) {
                    Player.deductGoldOrDebt(_bPunishment.fine, 'kingdom', _bKingdom ? _bKingdom.id : 'unknown', _bKingdom ? _bKingdom.name : 'Kingdom', 'Fine for bribery and violating ' + _bqLabel);
                }
                EventTypes.emit('QUARANTINE_BRIBE_JAILED', { playerName: player.fullName, townName: _bt.name, quarantineType: _bqLabel, days: _bJailDays, extra: _bPunishment.fine > 0 ? ' and fined ' + _bPunishment.fine + 'g' : '' });
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚔 Caught bribing! Jailed ' + _bJailDays + ' days for bribery and violating ' + _bqLabel + '.', 'error', 'critical');
                return { allowed: false, message: '🚧 Caught bribing a guard at ' + _bt.name + '! Jailed for ' + _bJailDays + ' days' + (_bPunishment.fine > 0 ? ', fined ' + _bPunishment.fine + 'g' : '') + '.' };
            } else {
                Player.deductGoldOrDebt(_bPunishment.fine, 'kingdom', _bKingdom ? _bKingdom.id : 'unknown', _bKingdom ? _bKingdom.name : 'Kingdom', 'Fine for bribery at ' + _bt.name);
                EventTypes.emit('QUARANTINE_BRIBE_FINED', { playerName: player.fullName, townName: _bt.name, quarantineType: _bqLabel, gold: _bPunishment.fine });
                if (typeof UI !== 'undefined' && UI.toast) UI.toast('🚧 Caught bribing! Fined ' + _bPunishment.fine + 'g for bribery and violating ' + _bqLabel + '.', 'warning', 'critical');
                return { allowed: false, message: '🚧 Caught bribing at ' + _bt.name + ' ' + _bqLabel + '! Fined ' + _bPunishment.fine + 'g and turned away.' };
            }
        }
        return null;
    }

    function attemptQuarantineDoctorPersuasion(destTownId) {
        _sync();
        var originTownId = player.townId;
        if (!originTownId) return { allowed: false, message: 'Cannot determine location.' };

        var rng = Engine.getRng();
        var currentDay = Engine.getDay ? Engine.getDay() : 0;

        // Cooldown check
        if (player._doctorPersuasionCooldown && currentDay < player._doctorPersuasionCooldown) {
            var remaining = player._doctorPersuasionCooldown - currentDay;
            return { allowed: false, message: 'You must wait ' + remaining + ' more day' + (remaining > 1 ? 's' : '') + ' before trying to persuade a guard again.' };
        }

        // Check eligibility: doctor skill or own clinic/hospital
        var hasDoc = hasSkill('doctor');
        var ownsMedOrigin = false;
        var ownsMedDest = false;
        if (player.buildings) {
            for (var i = 0; i < player.buildings.length; i++) {
                var b = player.buildings[i];
                if (b.type === 'clinic' || b.type === 'hospital') {
                    if (b.townId === originTownId) ownsMedOrigin = true;
                    if (b.townId === destTownId) ownsMedDest = true;
                }
            }
        }
        // If origin and quarantine town are the same, only count once (as dest bonus)
        if (originTownId === destTownId && ownsMedOrigin && ownsMedDest) ownsMedOrigin = false;
        if (!hasDoc && !ownsMedOrigin && !ownsMedDest) {
            return { allowed: false, message: 'You need medical credentials to persuade the guard.' };
        }

        // Calculate chance
        var chance = 0;
        if (hasDoc) chance += 0.50;
        if (ownsMedOrigin) chance += 0.20;
        if (ownsMedDest) chance += 0.25;
        chance = Math.min(0.95, chance);

        if (rng.chance(chance)) {
            EventTypes.emit('QUARANTINE_MEDICAL_PASS', { playerName: player.fullName });
            return { allowed: true, message: '⚕️ The guard recognizes your medical expertise and waves you through.' };
        }

        // Failed — set 7-day cooldown, no other penalty
        player._doctorPersuasionCooldown = currentDay + 7;
        EventTypes.emit('QUARANTINE_MEDICAL_FAIL', { playerName: player.fullName });
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('⚕️ The guard isn\'t convinced. Try again in 7 days.', 'warning');
        return { allowed: false, message: '⚕️ The guard isn\'t convinced of your medical necessity. You can try again in 7 days.' };
    }

    /**
     * Player travels to another town (takes time).
     */
    function travelTo(townId, options) {
        _sync();
        options = options || {};
        if (player.traveling) {
            // Allow redirecting travel — stop current and use current position
            if (player.travelPaid) return { success: false, message: 'Cannot redirect while on paid transport.' };
            var currentPos = getPlayerWorldPosition();
            if (!currentPos) return { success: false, message: 'Cannot determine current position.' };
            player.traveling = false;
            player.travelProgress = 0;
            player.townId = null;
            player.worldX = currentPos.x;
            player.worldY = currentPos.y;
            cleanupTravelState();
        }

        // Block travel while in jail
        if (player.jailedUntilDay > 0 && Engine.getDay() < player.jailedUntilDay) {
            return { success: false, message: '🔒 You are in jail until day ' + player.jailedUntilDay + '.' };
        }

        // v9p33river205: Block travel while awaiting Noble Council trial.
        // Player can only move to the court town (forced auto-travel).
        if (player._activeTrial && player._activeTrial.courtTownId) {
            var _atDay = Engine.getDay ? Engine.getDay() : 0;
            if (_atDay < player._activeTrial.courtDay) {
                if (townId !== player._activeTrial.courtTownId) {
                    var _atK = Engine.findKingdom ? Engine.findKingdom(player._activeTrial.kingdomId) : null;
                    var _atCourtTown = Engine.findTown(player._activeTrial.courtTownId);
                    return { success: false, message: '⚖️ You are awaiting trial in ' + (_atK ? _atK.name : 'a kingdom') + '. You may only travel to ' + (_atCourtTown ? _atCourtTown.name : 'the court town') + '.' };
                }
            }
        }

        // Kingdom travel ban (from double noble agent defection)
        if (player._kingdomTravelBan) {
            var _destTown = Engine.findTown(townId);
            if (_destTown) {
                var _banExpiry = player._kingdomTravelBan[_destTown.kingdomId];
                if (_banExpiry && Engine.getDay() < _banExpiry) {
                    var _banDays = _banExpiry - Engine.getDay();
                    var _banK = Engine.findKingdom ? Engine.findKingdom(_destTown.kingdomId) : null;
                    return { success: false, message: '🚫 You are banned from ' + (_banK ? _banK.name : 'that kingdom') + ' for ' + _banDays + ' more days.' };
                } else if (_banExpiry) {
                    delete player._kingdomTravelBan[_destTown.kingdomId];
                }
            }
        }

        if (townId === player.townId) return { success: false, message: 'Already there.' };

        // Check carry capacity before traveling
        var carriedWeight = getCarriedWeight();
        var portableCapacity = getCarryCapacity();
        if (carriedWeight > portableCapacity) {
            return { success: false, message: 'You are carrying too much! (' + Math.round(carriedWeight) + '/' + portableCapacity + '). Deposit items to warehouse storage first.' };
        }

        // If in wilderness (stopped on road), find nearest town as origin
        var originTownId = player.townId;
        if (!originTownId && player.worldX != null && player.worldY != null) {
            var towns = Engine.getTowns();
            var nearestDist = Infinity;
            for (var ni = 0; ni < towns.length; ni++) {
                var nd = Math.hypot(towns[ni].x - player.worldX, towns[ni].y - player.worldY);
                if (nd < nearestDist) { nearestDist = nd; originTownId = towns[ni].id; }
            }
            // If nearest town IS the destination, travel directly to its coords
            if (originTownId === townId) {
                var destTown = Engine.findTown(townId);
                if (destTown) return travelToCoords(destTown.x, destTown.y);
                return { success: false, message: 'Cannot find destination.' };
            }
        }
        if (!originTownId) return { success: false, message: 'Cannot determine current location.' };

        const route = Engine.findPath(originTownId, townId);
        if (!route || route.length === 0) return { success: false, message: 'No route to that town. It may be across water with no sea route.' };

        // Check for closed border at destination
        var borderResult = attemptBorderCrossing(townId);
        if (!borderResult.allowed) {
            if (borderResult.caught) {
                return { success: false, message: borderResult.message };
            }
            return { success: false, message: borderResult.message };
        }

        // Check quarantine on route (skip if UI already handled it)
        if (!options.skipQuarantineCheck) {
            var quarantineCheck = _checkRouteQuarantine(route, originTownId, townId);
            if (quarantineCheck && !quarantineCheck.allowed) {
                return { success: false, message: quarantineCheck.message };
            }
        }

        // Determine travel type from route segments
        let isOffroad = route.some(seg => seg.type === 'offroad');
        let isSea = route.some(seg => seg.type === 'sea');

        let totalDist = 0;
        for (const seg of route) {
            const a = Engine.findTown(seg.fromTownId);
            const b = Engine.findTown(seg.toTownId);
            if (a && b) {
                const segDist = Math.hypot(a.x - b.x, a.y - b.y);
                if (seg.type === 'offroad') {
                    // Off-road: 4x slower (divide by OFFROAD_SPEED_MULTIPLIER)
                    var offroadMult = CONFIG.OFFROAD_SPEED_MULTIPLIER || 0.25;
                    // Cartographer: 50% faster off-road travel
                    if (hasSkill('cartographer')) offroadMult *= 1.50;
                    totalDist += segDist / offroadMult;
                } else if (seg.type === 'sea') {
                    totalDist += segDist / (CONFIG.SEA_SPEED_MULTIPLIER || 1.5);
                } else {
                    totalDist += segDist / CONFIG.CARAVAN_ROAD_MULTIPLIER[seg.quality || 1];
                }
            }
        }

        // Horse travel speed bonus
        const hasHorse = player.horses.length > 0;
        const hasSaddle = player.horses.some(function(h) { return h.saddled; });
        if (hasHorse) {
            let speedBonus = CONFIG.HORSE_TRAVEL_SPEED_BONUS || 0.3;
            // Average speed of all horses
            var avgSpeed = player.horses.reduce(function(sum, h) { return sum + h.speed; }, 0) / player.horses.length;
            speedBonus *= avgSpeed;
            if (hasSaddle) speedBonus *= CONFIG.SADDLE_BONUS_MULTIPLIER || 2;
            totalDist *= (1 - Math.min(speedBonus, 0.7)); // Cap at 70% reduction
        }

        // Cart travel handling
        var container = player.storageContainer ? CONFIG.STORAGE_CONTAINERS[player.storageContainer] : null;
        var isCartType = container && (player.storageContainer === 'cart' || player.storageContainer === 'small_wagon' || player.storageContainer === 'wagon' || player.storageContainer === 'large_wagon');
        var cartMsg = '';

        if (isCartType && options.leaveCart) {
            // Leave cart behind — store it with goods
            var leftGoods = {};
            // Only goods that exceed personal carry capacity stay on the cart
            var baseCarry = CONFIG.PLAYER_BASE_CARRY || 20;
            var personalCap = baseCarry + (hasHorse ? (CONFIG.HORSE_CARRY_BONUS || 30) * player.horses.length : 0);
            var currentWeight = getCarriedWeight();
            if (currentWeight > personalCap) {
                // Move excess goods to the cart storage
                var excessWeight = currentWeight - personalCap;
                for (var resId in player.inventory) {
                    if (excessWeight <= 0) break;
                    var res = findResource(resId);
                    var itemWeight = res ? (res.weight || 1) : 1;
                    var qty = player.inventory[resId];
                    var toLeave = Math.min(qty, Math.ceil(excessWeight / itemWeight));
                    if (toLeave > 0) {
                        leftGoods[resId] = toLeave;
                        player.inventory[resId] -= toLeave;
                        if (player.inventory[resId] <= 0) delete player.inventory[resId];
                        excessWeight -= toLeave * itemWeight;
                    }
                }
            }
            player.leftCart = {
                townId: player.townId,
                container: player.storageContainer,
                goods: leftGoods,
                leftDay: Engine.getDay()
            };
            player.storageContainer = null; // Travel without cart
            var goodCount = Object.keys(leftGoods).length;
            cartMsg = ' 🛒 Left ' + container.name + ' in town' + (goodCount > 0 ? ' with ' + goodCount + ' type(s) of goods' : '') + '.';
        } else if (isCartType && !options.leaveCart && !hasHorse) {
            // Bringing cart without horse — 40% slower
            totalDist *= 1.4;
            cartMsg = ' 🛒 Dragging ' + container.name + ' by hand — slower travel!';
        }
        // v9p33river501: reverted v497's wagon-weight penalty (1.08-1.25x totalDist).
        // The travel-selection UI advertises "no speed penalty" for bringing a
        // wagon with a horse, so the engine must not silently add one — that
        // mismatch made actual trips noticeably longer than the dialog's ETA.
        // Horse-pulled carts now travel at unmodified speed, matching the UI.

        // If route includes sea segments, delegate to travelBySea for proper ship handling
        if (isSea && !isOffroad && route.length === 1 && route[0].type === 'sea') {
            // Pure sea route — use dedicated sea travel with ship checks, blockades, etc.
            var _seaOpts = options.seaMode === 'sea_passage' ? { paid: true } : {};
            if (options.bringFamily) _seaOpts.bringFamily = true;
            return Player.travelBySea(townId, _seaOpts);
        }

        // v9p33river333: mixed land+sea paths are paced here, not by Player.travelBySea(),
        // so don't charge sea-passage fees unless the dedicated pure-sea flow owns the trip.

        player.traveling = true;
        player.travelProgress = 0;
        player.travelDestination = townId;
        player.travelRoute = route;
        player.travelTotalDist = totalDist;
        player.travelOffroad = isOffroad;
        // v9p33river333: only all-sea routes should enter global sea-travel state.
        player.travelBySea = isSea && route.every(function(s) { return s.type === 'sea'; });
        player.travelOrigin = player.townId || originTownId;
        player.travelPaid = false;
        // Set travel mode based on route type
        var requestedMode = options.mode || (hasHorse ? 'horse' : 'walk');
        if (isSea && route.every(function(s) { return s.type === 'sea'; })) {
            // All-sea multi-segment route
            player.travelMode = (player.ships && player.ships.length > 0) ? 'sail_own' : 'sea_passage';
            player.travelSeaMode = player.travelMode;
        } else if (isSea) {
            // v9p33river333: mixed routes stay in land/offroad travel mode; no sea-passage state.
            player.travelMode = requestedMode;
            player.travelSeaMode = null;
        } else {
            // Pure land/offroad route
            player.travelMode = requestedMode;
            player.travelSeaMode = null;
        }
        player.travelRestBonus = false;

        // Bring family companions if requested (preserve existing companions during redirect)
        if (options.bringFamily) {
            player.travelCompanions = [];
            var _originIdFam = player.townId || originTownId;
            for (var _fci = 0; _fci < player.familyMembers.length; _fci++) {
                var _fm = player.familyMembers[_fci];
                var _fp = Engine.findPerson(_fm.npcId);
                if (_fp && _fp.alive && _fp.townId === _originIdFam) {
                    // Skip companions currently hospitalized — they must stay for treatment
                    if (_fp._hospitalTreatmentEndDay && Engine.getDay() < _fp._hospitalTreatmentEndDay) continue;
                    player.travelCompanions.push({ npcId: _fm.npcId, name: _fm.name, role: _fm.role });
                }
            }
        } else if (!player.travelCompanions) {
            player.travelCompanions = [];
        }

        // Wartime ambush is now handled by the daily encounter system during travel
        // (no longer instant at departure — happens each day on the road)

        // Travel energy is now handled per-tick in tickTravel (no upfront cost)

        // v9p33river497: factor in-flight speed bonuses into the estimate so
        // displayed ETA matches reality. tickTravel adds expert_navigator/
        // road_knowledge/cartographer multiplicatively on top of base speed,
        // so the previous estimate was too pessimistic for skilled travelers.
        var _etaSpeedMult = 1.0;
        if (isSea && hasSkill('expert_navigator')) _etaSpeedMult *= 1.20;
        if (!isSea && hasSkill('road_knowledge')) _etaSpeedMult *= 1.15;
        if (!isSea && hasSkill('cartographer')) _etaSpeedMult *= 1.05;
        var estimatedDays = Math.max(1, Math.ceil(totalDist / (CONFIG.CARAVAN_BASE_SPEED * 1.5 * _etaSpeedMult)));

        const dest = Engine.findTown(townId);
        const horseMsg = hasHorse ? (hasSaddle ? ' 🐴 (Horse + Saddle bonus!)' : ' 🐴 (Horse bonus!)') : '';
        const offroadMsg = isOffroad ? ' 🥾 (Off-road — slow going!)' : '';
        const seaMsg = isSea ? ' ⛵ (Sea route!)' : '';
        // Show risk level in departure message
        var riskInfo = getEncounterChance();
        var riskMsg = riskInfo.chance > 0 ? (' ' + (riskInfo.riskLevel === 'high' ? '🔴' : riskInfo.riskLevel === 'medium' ? '🟡' : '🟢') + ' ' + riskInfo.riskLevel.charAt(0).toUpperCase() + riskInfo.riskLevel.slice(1) + ' risk') : '';
        var companionMsg = player.travelCompanions.length > 0 ? ' 👨‍👩‍👧‍👦 Traveling with ' + player.travelCompanions.map(function(c) { return c.name; }).join(', ') + '.' : '';
        Engine.logEvent(`You set out for ${dest ? dest.name : 'unknown'}.${horseMsg}${offroadMsg}${seaMsg}${cartMsg}${companionMsg}${riskMsg}`, null, 'travel_events');

        // Journal — travel departure
        var originTown = Engine.findTown(player.travelOrigin);
        var travelJText = 'Set out from ' + (originTown ? originTown.name : 'town') + ' heading for ' + (dest ? dest.name : 'parts unknown') + '. The journey should take about ' + estimatedDays + ' day' + (estimatedDays > 1 ? 's' : '') + '.';
        if (hasHorse) travelJText += ' My horse should make the ride swifter.';
        if (isOffroad) travelJText += ' The path is rough — no proper road to follow.';
        if (isSea) travelJText += ' We set sail across the waters.';
        autoJournalCapture('travel', travelJText, { mood: 'hopeful' });

        return { success: true, message: `Traveling to ${dest ? dest.name : townId}.${horseMsg}${offroadMsg}${seaMsg}${cartMsg}${riskMsg}`, estimatedDays: estimatedDays };
    }

    /**
     * Upgrade a player-owned building (increases level and production).
     */
    // Helper: storage capacity with 50% bump per level
    function _bldStorageCap(baseStorage, level) {
        _sync();
        return Math.floor((baseStorage || 0) * (1 + (((level || 1) - 1) * 0.50)));
    }

    // v9p33river432: caravan storage drops must honor town storage capacity instead of silently overflowing.
    function _storeInTownStorage(townId, resId, qty) {
        _sync();
        qty = Math.floor(Number(qty) || 0);
        if (qty <= 0) return 0;
        var cap = Player.getTownStorageCapacity ? Player.getTownStorageCapacity(townId) : 0;
        var used = Player.getTownStorageUsed ? Player.getTownStorageUsed(townId) : 0;
        var res = findResource(resId);
        var weight = res ? Number(res.weight || 1) : 1;
        if (!isFinite(weight) || weight <= 0) weight = 1;
        var freeUnits = Math.max(0, Math.floor((cap - used) / weight));
        var storeQty = Math.min(qty, freeUnits);
        if (storeQty <= 0) return 0;
        if (!player.townStorage[townId]) player.townStorage[townId] = {};
        player.townStorage[townId][resId] = (player.townStorage[townId][resId] || 0) + storeQty;
        return storeQty;
    }

    // v9p33river432: remote contraband sales must not leave staged inventory behind when the sale fails.
    function _runStagedCaravanTrade(tradeFn, resId, qty, town, kingdom, basePrice) {
        _sync();
        var beforeInv = player.inventory[resId] || 0;
        player.inventory[resId] = beforeInv + qty;
        var result = tradeFn(resId, qty, town, kingdom, basePrice) || { success: false, message: 'Trade failed.' };
        var afterInv = player.inventory[resId] || 0;
        var stagedRemaining = Math.max(0, afterInv - beforeInv);
        if (stagedRemaining > 0) {
            player.inventory[resId] = afterInv - stagedRemaining;
            if (player.inventory[resId] <= 0) delete player.inventory[resId];
        }
        return { result: result, consumed: Math.max(0, qty - stagedRemaining) };
    }

    // v9p33river432: caravan sell tax must reduce merchant payout before revenue is finalized.
    function _collectCaravanSellTax(townId, resId, grossRevenue) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.kingdomId || grossRevenue <= 0) {
            return { net: grossRevenue, tax: 0 };
        }
        var kingdom = Engine.findKingdom ? Engine.findKingdom(town.kingdomId) : null;
        if (!kingdom) return { net: grossRevenue, tax: 0 };
        var taxableAmount = grossRevenue;
        if (resId && kingdom.exportRestrictions && kingdom.exportRestrictions.indexOf(resId) >= 0) {
            taxableAmount = Math.floor(taxableAmount * 0.5);
        }
        var taxCollected = Math.max(0, Math.floor(taxableAmount * (kingdom.taxRate || 0.10)));
        if (town.buildings) {
            var _tbBonus = 0;
            for (var _tbi = 0; _tbi < town.buildings.length; _tbi++) {
                var _tb = town.buildings[_tbi];
                if (!_tb || _tb.condition === 'destroyed') continue;
                var _tbt = Engine.findBuildingType ? Engine.findBuildingType(_tb.type) : null;
                if (_tbt && _tbt.tradeBonus) _tbBonus += _tbt.tradeBonus;
            }
            if (_tbBonus > 0) taxCollected = Math.floor(taxCollected * (1 + Math.min(0.5, _tbBonus)));
        }
        return { net: Math.max(1, grossRevenue - taxCollected), tax: taxCollected };
    }

    function _applyCaravanSellTax(townId, resId, grossRevenue) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.kingdomId || !Engine.collectTradeTax || grossRevenue <= 0) return;
        Engine.collectTradeTax(town.kingdomId, grossRevenue, resId, false, townId);
    }

    // v9p33river432: sea-caravan risk must inspect the assigned ship, not player.ships[0].
    function _findAssignedCaravanShip(caravan) {
        _sync();
        if (!caravan || !caravan.shipId || !player.ships) return null;
        for (var i = 0; i < player.ships.length; i++) {
            if (player.ships[i] && player.ships[i].id === caravan.shipId) return player.ships[i];
        }
        return null;
    }

    // v9p33river432: edited caravan orders need schema validation before they are accepted.
    function _validateCaravanOrders(newOrders) {
        _sync();
        if (newOrders == null) return { valid: true, orders: [] };
        if (!Array.isArray(newOrders)) return { valid: false, message: 'Orders must be an array.' };
        var validActions = { buy: true, sell: true, store: true, pickup: true };
        var sanitized = [];
        for (var i = 0; i < newOrders.length; i++) {
            var order = newOrders[i];
            if (!order || typeof order !== 'object') return { valid: false, message: 'Order #' + (i + 1) + ' is invalid.' };
            var action = order.action;
            if (!validActions[action]) return { valid: false, message: 'Order #' + (i + 1) + ' has an invalid action.' };
            var good = order.good;
            if (!findResource(good)) return { valid: false, message: 'Order #' + (i + 1) + ' has an invalid good.' };
            var location = order.location || 'destination';
            var isWaypoint = typeof location === 'string' && location.indexOf('waypoint:') === 0;
            if (location !== 'source' && location !== 'destination' && !(isWaypoint && Engine.findTown(location.replace('waypoint:', '')))) {
                return { valid: false, message: 'Order #' + (i + 1) + ' has an invalid location.' };
            }
            var qty = order.qty;
            if (qty !== 'max') {
                qty = Number(qty);
                if (!isFinite(qty) || qty <= 0) return { valid: false, message: 'Order #' + (i + 1) + ' has an invalid quantity.' };
                qty = Math.floor(qty);
            }
            var priceLimit = null;
            if (order.priceLimit != null) {
                priceLimit = Number(order.priceLimit);
                if (!isFinite(priceLimit) || priceLimit < 0) return { valid: false, message: 'Order #' + (i + 1) + ' has an invalid price limit.' };
                priceLimit = Math.floor(priceLimit);
                if (priceLimit <= 0) priceLimit = null;
            }
            var buildingId = order.buildingId == null ? null : order.buildingId;
            if (buildingId != null && typeof buildingId !== 'string') return { valid: false, message: 'Order #' + (i + 1) + ' has an invalid building target.' };
            sanitized.push({ good: good, action: action, location: location, qty: qty, priceLimit: priceLimit, buildingId: buildingId });
        }
        return { valid: true, orders: sanitized };
    }

    /**
     * Calculate the quality crafting chance for a given tier, resource, and worker skill.
     * @param {'good'|'excellent'} tier
     * @param {string} baseItem - the base resource id (e.g. 'swords', 'armor')
     * @param {number} avgWorkerSkill - average worker skill 0-100
     * @returns {number} chance 0-1 (clamped to max)
     */
    function _qualityCraftChance(tier, baseItem, avgWorkerSkill) {
        _sync();
        var cfg = CONFIG.QUALITY_CRAFTING[tier];
        if (!cfg) return 0;
        var chance = cfg.baseChance + avgWorkerSkill * cfg.workerSkillFactor;
        var isWeapon = CONFIG.QUALITY_CRAFTING.WEAPON_BASE_ITEMS.indexOf(baseItem) >= 0;
        var isArmor = CONFIG.QUALITY_CRAFTING.ARMOR_BASE_ITEMS.indexOf(baseItem) >= 0;
        if (tier === 'good') {
            if (isWeapon && hasSkill('good_weaponcraft')) chance += cfg.playerSkillBonus;
            if (isArmor && hasSkill('good_armorcraft')) chance += cfg.playerSkillBonus;
        } else if (tier === 'excellent') {
            if (isWeapon && hasSkill('excellent_weaponcraft')) chance += cfg.playerSkillBonus;
            if (isArmor && hasSkill('excellent_armorcraft')) chance += cfg.playerSkillBonus;
        }
        return Math.min(chance, cfg.maxChance);
    }

    /**
     * Smart input ratio limiter: given a target building and a resource being deposited,
     * returns the max units of that resource the building should accept to stay balanced.
     * Looks at ALL current input stock and calculates how many production cycles each
     * input can sustain, then prioritises the most-needed inputs.
     *
     * @param {object} targetBt  - building type definition (from BUILDING_TYPES)
     * @param {object} targetBld - the actual building instance (with .inventory, .level)
     * @param {string} resId     - resource id being deposited / transferred / bought
     * @returns {number} max units of resId the building should accept (-1 = unlimited)
     */
    function _smartInputLimit(targetBt, targetBld, resId) {
        _sync();
        if (!targetBt || !targetBt.consumes) return -1;
        var consumeKeys = Object.keys(targetBt.consumes);
        if (consumeKeys.length < 2) return -1; // single-input buildings need no balancing
        if (!targetBt.consumes[resId]) return -1; // this resource isn't consumed

        var cap = _bldStorageCap(targetBt.storage || 50, targetBld.level);
        if (cap <= 0) return -1;

        var resObj = findResource(resId);
        var resWeight = resObj ? (resObj.weight || 1) : 1;
        var myConsumePerCycle = targetBt.consumes[resId];

        // Ratio-based allocation: each input gets a proportional share of total
        // input capacity based on its weight contribution per production cycle.
        // E.g. recipe 3 iron (wt 2) + 2 wood (wt 1) → total cycle weight = 8
        // Iron share = 6/8 of capacity (in weight), wood = 2/8
        var totalWeightPerCycle = 0;
        for (var k = 0; k < consumeKeys.length; k++) {
            var ckRes = findResource(consumeKeys[k]);
            var ckW = ckRes ? (ckRes.weight || 1) : 1;
            totalWeightPerCycle += targetBt.consumes[consumeKeys[k]] * ckW;
        }

        var myWeightFraction = (myConsumePerCycle * resWeight) / totalWeightPerCycle;
        var myAllocatedWeight = cap * myWeightFraction;
        var maxByRatio = Math.floor(myAllocatedWeight / resWeight);

        var currentStored = (targetBld.inventory && targetBld.inventory[resId]) || 0;
        var roomByRatio = Math.max(0, maxByRatio - currentStored);

        // Also enforce absolute free input space (excluding output items)
        var outputSet = {};
        if (targetBt.produces) outputSet[targetBt.produces] = true;
        if (targetBt.canProduce) { for (var ci = 0; ci < targetBt.canProduce.length; ci++) outputSet[targetBt.canProduce[ci]] = true; }
        // Consumed goods are inputs, not outputs
        var _slConsumed = getBuildingConsumedGoods(targetBt);
        for (var _slk in _slConsumed) { delete outputSet[_slk]; }
        var inputUsed = 0;
        if (targetBld.inventory) {
            for (var bk in targetBld.inventory) {
                if (!outputSet[bk]) {
                    var bkRes = findResource(bk);
                    inputUsed += (targetBld.inventory[bk] || 0) * (bkRes ? (bkRes.weight || 1) : 1);
                }
            }
        }
        var freeSpace = Math.max(0, Math.floor((cap - inputUsed) / resWeight));

        return Math.min(roomByRatio, freeSpace);
    }

    function getUpgradeCost(buildingId) {
        _sync();
        var bld = player.buildings.find(function(b) { return b.id === buildingId; });
        if (!bld) return null;
        var bt = Engine.findBuildingType(bld.type);
        if (!bt) return null;
        var currentLevel = bld.level || 1;
        if (currentLevel >= 5) return { cost: 0, maxed: true };
        var baseLaborHalf = Math.floor((bt.cost || 0) * 0.5);
        var baseMaterialHalf = 0;
        if (bt.materials) {
            for (var matId in bt.materials) {
                var qty = bt.materials[matId];
                var matPrice = 0;
                try { matPrice = Engine.getMarketPrice(bld.townId, matId) || 0; } catch(e) {}
                if (matPrice <= 0) { var res = findResource(matId); matPrice = res ? (res.basePrice || 5) : 5; }
                baseMaterialHalf += Math.floor(qty * matPrice * 0.5);
            }
        }
        var baseHalf = baseLaborHalf + baseMaterialHalf;
        var levelMultiplier = Math.pow(2, currentLevel - 1);
        var cost = Math.floor(baseHalf * levelMultiplier);
        if (hasSkill('building_upgrade_discount')) cost = Math.floor(cost * 0.75);
        return { cost: cost, maxed: false };
    }

    function upgradeBuilding(buildingId) {
        _sync();
        const bld = player.buildings.find(b => b.id === buildingId);
        if (!bld) return { success: false, message: 'Building not found.' };

        const bt = Engine.findBuildingType(bld.type);
        if (!bt) return { success: false, message: 'Unknown building type.' };

        var currentLevel = bld.level || 1;
        if (currentLevel >= 5) return { success: false, message: 'Building is already at maximum level (5).' };

        // Cost = half of (labor + materials at local market) × 2^(currentLevel-1)
        var town = Engine.findTown(bld.townId);
        var baseLaborHalf = Math.floor((bt.cost || 0) * 0.5);
        var baseMaterialHalf = 0;
        if (bt.materials) {
            for (var matId in bt.materials) {
                var qty = bt.materials[matId];
                var matPrice = 0;
                try { matPrice = Engine.getMarketPrice(bld.townId, matId) || 0; } catch(e) {}
                if (matPrice <= 0) { var res = findResource(matId); matPrice = res ? (res.basePrice || 5) : 5; }
                baseMaterialHalf += Math.floor(qty * matPrice * 0.5);
            }
        }
        var baseHalf = baseLaborHalf + baseMaterialHalf;
        // Each upgrade doubles cost: level 1→2 = 1×, level 2→3 = 2×, level 3→4 = 4×, level 4→5 = 8×
        var levelMultiplier = Math.pow(2, currentLevel - 1);
        let upgradeCost = Math.floor(baseHalf * levelMultiplier);
        if (hasSkill('building_upgrade_discount')) upgradeCost = Math.floor(upgradeCost * 0.75);
        if (player.gold < upgradeCost) {
            return { success: false, message: 'Upgrade costs ' + upgradeCost + ' gold.' };
        }

        player.gold -= upgradeCost;
        logFinance(-upgradeCost, 'buildings', 'Upgraded building');
        player.stats.totalGoldSpent += upgradeCost;

        bld.level = currentLevel + 1;

        // Also update the town's matching building record
        if (town) {
            const townBld = town.buildings.find(b =>
                (b.id && b.id === bld.id) || (b.type === bld.type && b.ownerId === 'player')
            );
            if (townBld) townBld.level = bld.level;
        }

        if (player.storyMode && player.storyMode.active && typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction) {
            StoryMode.onPlayerAction('upgrade_building', { buildingType: bld.type });
        }

        return { success: true, message: 'Upgraded ' + bt.name + ' to level ' + bld.level + '.' };
    }


    // ========================================================
    // §5  CARAVAN TICK
    // ========================================================

    function getCaravanHireRates(townId) {
        _sync();
        var town = Engine.findTown(townId || player.townId);
        var categoryMult = 1.0;
        var prosperityMult = 1.0;
        if (town) {
            categoryMult = (CONFIG.JOB_PAY_SCALE && CONFIG.JOB_PAY_SCALE[town.category]) || 1.0;
            prosperityMult = 0.5 + ((town.prosperity || 50) / 100);
        }
        var factor = categoryMult * prosperityMult;
        var carrierWage = Math.max(1, Math.min(5, Math.round(3 * factor)));
        var guardWage = Math.max(2, Math.min(10, Math.round(6 * factor)));
        return { carrierWage: carrierWage, guardWage: guardWage, factor: factor };
    }

    function logCaravan(caravan, message) {
        _sync();
        if (!caravan.log) caravan.log = [];
        caravan.log.push({ day: Engine.getDay(), message: message });
        Engine.logEvent(message, null, 'my_business');
    }

    function cleanCaravanLogs() {
        _sync();
        var today = Engine.getDay();
        for (var i = 0; i < player.caravans.length; i++) {
            var c = player.caravans[i];
            if (!c.log || c.log.length === 0) continue;
            c.log = c.log.filter(function(entry) { return today - entry.day <= 90; });
        }
    }

    // Helper: compute tariff rate for caravan sales at a destination town
    // Returns { tariffRate, tariffRevenue } where tariffRevenue is gold owed to destination kingdom
    function _getCaravanTariffRate(townId) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town || !town.kingdomId) return 0;
        var kingdom = Engine.findKingdom(town.kingdomId);
        if (!kingdom || !kingdom.laws) return 0;
        // No tariff if player is citizen of destination kingdom
        if (player.citizenshipKingdomId === town.kingdomId) return 0;
        // Check open_market special law (no tariffs)
        var specialLaws = kingdom.laws.specialLaws || [];
        for (var i = 0; i < specialLaws.length; i++) {
            var _slId = typeof specialLaws[i] === 'string' ? specialLaws[i] : (specialLaws[i].id || '');
            if (_slId === 'open_market') return 0;
        }
        var tariff = kingdom.laws.tradeTariff || 0;
        // Check foreign_ban special law (+25% surcharge)
        for (var j = 0; j < specialLaws.length; j++) {
            var _slId2 = typeof specialLaws[j] === 'string' ? specialLaws[j] : (specialLaws[j].id || '');
            if (_slId2 === 'foreign_ban') tariff += 0.25;
        }
        return Math.min(tariff, 0.35);
    }

    // Helper: apply tariff to a caravan sale revenue and credit kingdom
    function _applyCaravanTariff(grossRevenue, townId) {
        _sync();
        var tariffRate = _getCaravanTariffRate(townId);
        if (tariffRate <= 0) return { net: grossRevenue, tariff: 0 };
        var tariffAmount = Math.floor(grossRevenue * tariffRate);
        var net = grossRevenue - tariffAmount;
        // Credit tariff to destination kingdom
        var town = Engine.findTown(townId);
        if (town && town.kingdomId) {
            var kingdom = Engine.findKingdom(town.kingdomId);
            if (kingdom) {
                kingdom.gold = (kingdom.gold || 0) + tariffAmount;
                kingdom.taxRevenue = (kingdom.taxRevenue || 0) + tariffAmount;
                kingdom.tradeTaxRevenue = (kingdom.tradeTaxRevenue || 0) + tariffAmount;
            }
        }
        return { net: Math.max(1, net), tariff: tariffAmount };
    }

    function processCaravanOrders(caravan, townId, isReturnLeg) {
        _sync();
        var town = Engine.findTown(townId);
        if (!town) return;

        var orders = caravan.orders || [];
        var locationFilter = isReturnLeg ? 'source' : 'destination';
        var locationOrders = orders.filter(function(o) {
            if (o.location === locationFilter) return true;
            // Waypoint orders: match if this town is the waypoint
            if (o.location && o.location.indexOf('waypoint:') === 0) {
                var wpTownId = o.location.replace('waypoint:', '');
                return wpTownId === townId;
            }
            return false;
        });
        if (locationOrders.length === 0) return false; // signal: no orders, use legacy

        // Process in order: store → sell → pickup → buy
        // (sell/store first to free capacity, then pickup/buy to load new cargo)
        var actionPriority = { store: 0, sell: 1, pickup: 2, buy: 3 };
        locationOrders.sort(function(a, b) { return (actionPriority[a.action] || 0) - (actionPriority[b.action] || 0); });

        var townName = town.name || townId;

        for (var oi = 0; oi < locationOrders.length; oi++) {
            var o = locationOrders[oi];
            var res = findResource(o.good);
            if (!res) { logCaravan(caravan, '⚠️ Unknown good: ' + o.good + ' — skipped.'); continue; }
            var resName = res.icon + ' ' + res.name;
            var qty = o.qty === 'max' ? 99999 : (Number(o.qty) || 0);
            if (qty <= 0 && o.qty !== 'max') { logCaravan(caravan, '⚠️ Invalid qty for ' + resName + ' — skipped.'); continue; }

            // Block buy/sell at outpost locations — no market until upgraded to village
            if ((o.action === 'buy' || o.action === 'sell') && town && town.isOutpost) {
                logCaravan(caravan, '🚫 Cannot ' + o.action + ' ' + resName + ' at ' + townName + ' — outpost has no market.');
                continue;
            }

            if (o.action === 'pickup') {
                // Check town storage first
                var stored = (player.townStorage[townId] || {})[o.good] || 0;
                // Also check player buildings at this town (inventory: output + input items)
                var buildingStored = 0;
                var buildingSources = [];
                for (var bi = 0; bi < player.buildings.length; bi++) {
                    var bld = player.buildings[bi];
                    if (bld.townId !== townId) continue;
                    if (!bld.inventory) continue;
                    var bldBt = Engine.findBuildingType(bld.type);
                    // Determine which items are output vs input
                    var _outGoods = {};
                    if (bldBt && bldBt.produces) _outGoods[bldBt.produces] = true;
                    if (bldBt && bldBt.canProduce) { for (var _oi2 = 0; _oi2 < bldBt.canProduce.length; _oi2++) _outGoods[bldBt.canProduce[_oi2]] = true; }
                    var bldAmt = bld.inventory[o.good] || 0;
                    if (bldAmt > 0) {
                        var pool = _outGoods[o.good] ? 'output' : 'input';
                        buildingSources.push({ bld: bld, pool: pool, qty: bldAmt });
                        buildingStored += bldAmt;
                    }
                }
                var totalAvail = stored + buildingStored;
                var canFit = _caravanCanFit(caravan, o.good);
                var pickupQty = Math.min(qty, totalAvail, canFit);
                if (pickupQty <= 0) {
                    if (canFit <= 0 && totalAvail > 0) {
                        logCaravan(caravan, '📦 Caravan full — cannot pick up ' + resName + ' at ' + townName + '.');
                    } else {
                        logCaravan(caravan, '📦 No ' + resName + ' in storage at ' + townName + ' to pick up.');
                    }
                    continue;
                }
                // Pick up from town storage first, then building output, then building input
                var remaining = pickupQty;
                if (stored > 0 && remaining > 0) {
                    var fromTown = Math.min(remaining, stored);
                    if (!player.townStorage[townId]) player.townStorage[townId] = {};
                    player.townStorage[townId][o.good] = (player.townStorage[townId][o.good] || 0) - fromTown;
                    if (player.townStorage[townId][o.good] <= 0) delete player.townStorage[townId][o.good];
                    remaining -= fromTown;
                }
                for (var bsi = 0; bsi < buildingSources.length && remaining > 0; bsi++) {
                    var bs = buildingSources[bsi];
                    var fromBld = Math.min(remaining, bs.qty);
                    bs.bld.inventory[o.good] = (bs.bld.inventory[o.good] || 0) - fromBld;
                    if (bs.bld.inventory[o.good] <= 0) delete bs.bld.inventory[o.good];
                    remaining -= fromBld;
                }
                caravan.goods[o.good] = (caravan.goods[o.good] || 0) + pickupQty;
                logCaravan(caravan, '📦 Picked up ' + pickupQty + ' ' + resName + ' from storage at ' + townName + '.');
            } else if (o.action === 'buy') {
                var marketSupply = town.market.supply[o.good] || 0;
                // v9p33river313: was reading town.market.prices[o.good]
                // directly, bypassing kingdom price-control law. Use
                // Engine.getMarketPrice so essentials caps apply.
                var marketPrice = Engine.getMarketPrice ? Engine.getMarketPrice(town.id, o.good) : (town.market.prices[o.good] || 0);
                var maxPrice = o.priceLimit || Infinity;
                if (marketPrice <= 0 || marketSupply <= 0) {
                    logCaravan(caravan, '🛒 ' + resName + ' not available at ' + townName + ' market.');
                    continue;
                }
                if (marketPrice > maxPrice) {
                    logCaravan(caravan, '🛒 ' + resName + ' price (' + Math.floor(marketPrice) + 'g) exceeds limit (' + maxPrice + 'g) at ' + townName + '.');
                    continue;
                }
                var canAfford = Math.floor(player.gold / marketPrice);
                var canFitBuy = _caravanCanFit(caravan, o.good);
                var buyQty = Math.min(qty, marketSupply, canAfford, canFitBuy);
                if (buyQty <= 0) {
                    if (canFitBuy <= 0) {
                        logCaravan(caravan, '🛒 Caravan full — cannot buy ' + resName + ' at ' + townName + '.');
                    } else {
                        logCaravan(caravan, '🛒 Cannot afford ' + resName + ' at ' + townName + ' (' + Math.floor(marketPrice) + 'g each).');
                    }
                    continue;
                }
                var cost = Math.floor(marketPrice * buyQty);
                player.gold -= cost;
                logFinance(-cost, 'caravan_costs', 'Caravan bought ' + buyQty + ' ' + res.name);
                player.stats.totalGoldSpent += cost;
                caravan.totalSpent = (caravan.totalSpent || 0) + cost;
                caravan.totalProfit = (caravan.totalProfit || 0) - cost;
                town.market.supply[o.good] = Math.max(0, marketSupply - buyQty);
                // v9p33river85: caravan bought goods → gold flows into the town's market
                if (Engine.adjustTownMarketGold) Engine.adjustTownMarketGold(town.id, cost);
                // v9p33river313: caravan market trades now pay trade tax
                // like all other market activity (import = true since
                // we're buying into the town's market).
                // v9p33river338: credit trade subsidy (if any) back to
                // player gold — was previously burned (deducted from
                // kingdom but never paid to caravan/player).
                if (Engine.collectTradeTax) {
                    var _ctt = Engine.collectTradeTax(town.kingdomId, cost, o.good, true, town.id);
                    if (_ctt && _ctt.subsidyAwarded > 0) {
                        player.gold += _ctt.subsidyAwarded;
                        if (typeof logFinance === 'function') logFinance(_ctt.subsidyAwarded, 'caravan', 'Trade subsidy: ' + o.good);
                        logCaravan(caravan, '💸 Royal subsidy +' + _ctt.subsidyAwarded + 'g for importing ' + resName + ' to ' + townName + '.');
                    }
                }
                caravan.goods[o.good] = (caravan.goods[o.good] || 0) + buyQty;
                logCaravan(caravan, '🛒 Bought ' + buyQty + ' ' + resName + ' for ' + cost + 'g at ' + townName + '.');
            } else if (o.action === 'store') {
                var carried = caravan.goods[o.good] || 0;
                var storeQty = Math.min(qty, carried);
                if (storeQty <= 0) {
                    logCaravan(caravan, '📥 No ' + resName + ' on caravan to store at ' + townName + '.');
                    continue;
                }
                var stored = 0;
                if (o.buildingId) {
                    // Store in specific building
                    var bld = (player.buildings || []).find(function(b) { return b.id === o.buildingId; });
                    // v9p33river536: legacy compatibility — earlier versions of the order
                    // builder stored buildingId as "<type>_<townBuildingsIndex>" instead of
                    // the canonical pbld_NN id, so existing saved orders never matched the
                    // real building. Try to resolve those by parsing the type prefix and
                    // finding a player building of that type at this town. Auto-migrate
                    // the order so subsequent runs are an O(1) lookup.
                    if (!bld && typeof o.buildingId === 'string') {
                        var _legacyMatch = o.buildingId.match(/^(.+)_(\d+)$/);
                        if (_legacyMatch) {
                            var _wantedType = _legacyMatch[1];
                            var _wantedIdx = parseInt(_legacyMatch[2], 10);
                            // Prefer town.buildings[idx] if it's a player-owned building of the right type
                            var _townObj = Engine.findTown(townId);
                            if (_townObj && _townObj.buildings && _townObj.buildings[_wantedIdx]) {
                                var _tbCandidate = _townObj.buildings[_wantedIdx];
                                if (_tbCandidate && _tbCandidate.ownerId === 'player' && _tbCandidate.type === _wantedType && _tbCandidate.id) {
                                    bld = (player.buildings || []).find(function(b) { return b.id === _tbCandidate.id; });
                                }
                            }
                            // Fallback: first player building of that type at this town
                            if (!bld) {
                                bld = (player.buildings || []).find(function(b) {
                                    return b.townId === townId && b.type === _wantedType;
                                });
                            }
                            if (bld) {
                                o.buildingId = bld.id;
                                logCaravan(caravan, '🔧 Migrated stale building reference for ' + resName + ' at ' + townName + '.');
                            }
                        }
                    }
                    if (bld && bld.townId === townId) {
                        var bt = null;
                        for (var bk in BUILDING_TYPES) { if (BUILDING_TYPES[bk].id === bld.type) { bt = BUILDING_TYPES[bk]; break; } }
                        // Check inputOnly filter
                        if (bld.inputOnly !== false && bt && bt.produces) {
                            var consumed = getBuildingConsumedGoods(bt);
                            if (!consumed[o.good]) {
                                logCaravan(caravan, '⚠️ ' + resName + ' not accepted by ' + (bt ? bt.name : 'building') + ' — input filter is on. Keeping on caravan.');
                                continue;
                            }
                        }
                        var bldCap = bt ? _bldStorageCap(bt.storage, bld.level) : 0;
                        // Input-only capacity: exclude output items from count
                        var _csOutSet = {};
                        if (bt && bt.produces) { _csOutSet[bt.produces] = true; }
                        if (bt && bt.canProduce) { for (var _cpi = 0; _cpi < bt.canProduce.length; _cpi++) _csOutSet[bt.canProduce[_cpi]] = true; }
                        var bldUsed = 0;
                        if (bld.inventory) { for (var bi in bld.inventory) { if (_csOutSet[bi]) continue; var bw = (findResource(bi) || {}).weight || 1; bldUsed += (bld.inventory[bi] || 0) * bw; } }
                        var resWeight = (findResource(o.good) || {}).weight || 1;
                        // Smart ratio limiter: considers all current inputs and cycle balance
                        var _crSmartMax = _smartInputLimit(bt, bld, o.good);
                        var canFit;
                        if (_crSmartMax >= 0) {
                            canFit = _crSmartMax;
                        } else {
                            canFit = Math.floor((bldCap - bldUsed) / resWeight);
                        }
                        var bldQty = Math.min(storeQty, canFit);
                        if (bldQty > 0) {
                            if (!bld.inventory) bld.inventory = {};
                            bld.inventory[o.good] = (bld.inventory[o.good] || 0) + bldQty;
                            stored += bldQty;
                            var bldName = bt ? bt.name : 'building';
                            logCaravan(caravan, '📥 Stored ' + bldQty + ' ' + resName + ' in ' + bldName + ' at ' + townName + '.');
                        }
                        var remainder = storeQty - stored;
                        if (remainder > 0) {
                            // v9p33river432: clamp overflow against remote town-storage capacity instead of blindly writing past it.
                            var _storedOverflow = _storeInTownStorage(townId, o.good, remainder);
                            if (_storedOverflow > 0) {
                                stored += _storedOverflow;
                                logCaravan(caravan, '📥 ' + _storedOverflow + ' ' + resName + ' overflow stored in town storage at ' + townName + '.');
                            }
                            if (_storedOverflow < remainder) {
                                logCaravan(caravan, '⚠️ Town storage full at ' + townName + ' — keeping ' + (remainder - _storedOverflow) + ' ' + resName + ' on caravan.');
                            }
                        }
                    } else {
                        logCaravan(caravan, '⚠️ Target building not found in ' + townName + '. Keeping goods on caravan.');
                    }
                } else {
                    // No specific building — try to store in any suitable building at this town
                    // Prioritize production buildings that consume this good as input
                    var _storeRemaining = storeQty;
                    var _townBuildings = (player.buildings || []).filter(function(b) { return b.townId === townId; });
                    _townBuildings.sort(function(a, b) {
                        var aBt = null, bBt = null;
                        for (var _sk in BUILDING_TYPES) { if (BUILDING_TYPES[_sk].id === a.type) { aBt = BUILDING_TYPES[_sk]; break; } }
                        for (var _sk2 in BUILDING_TYPES) { if (BUILDING_TYPES[_sk2].id === b.type) { bBt = BUILDING_TYPES[_sk2]; break; } }
                        var aConsumes = aBt ? getBuildingConsumedGoods(aBt) : {};
                        var bConsumes = bBt ? getBuildingConsumedGoods(bBt) : {};
                        var aNeeds = aConsumes[o.good] ? 1 : 0;
                        var bNeeds = bConsumes[o.good] ? 1 : 0;
                        if (aNeeds !== bNeeds) return bNeeds - aNeeds;
                        // Both consume this good — prioritize buildings stalled due to lack of it
                        if (aNeeds && bNeeds) {
                            var aStored = (a.inventory && a.inventory[o.good]) || 0;
                            var bStored = (b.inventory && b.inventory[o.good]) || 0;
                            var aPerCycle = aConsumes[o.good] || 1;
                            var bPerCycle = bConsumes[o.good] || 1;
                            var aCycles = aStored / aPerCycle;
                            var bCycles = bStored / bPerCycle;
                            // Fewer cycles = more urgent (stalled buildings first)
                            return aCycles - bCycles;
                        }
                        return 0;
                    });
                    for (var _tbi = 0; _tbi < _townBuildings.length && _storeRemaining > 0; _tbi++) {
                        var _tBld = _townBuildings[_tbi];
                        var _tBt = null;
                        for (var _tbk in BUILDING_TYPES) { if (BUILDING_TYPES[_tbk].id === _tBld.type) { _tBt = BUILDING_TYPES[_tbk]; break; } }
                        if (!_tBt) continue;
                        // Check inputOnly filter
                        if (_tBld.inputOnly !== false && _tBt.produces) {
                            var _consumed = getBuildingConsumedGoods(_tBt);
                            if (!_consumed[o.good]) continue;
                        }
                        var _tBldCap = _bldStorageCap(_tBt.storage, _tBld.level);
                        // Input-only capacity: exclude output items
                        var _tOutSet = {};
                        if (_tBt.produces) { _tOutSet[_tBt.produces] = true; }
                        if (_tBt.canProduce) { for (var _tcpi = 0; _tcpi < _tBt.canProduce.length; _tcpi++) _tOutSet[_tBt.canProduce[_tcpi]] = true; }
                        var _tBldUsed = 0;
                        if (_tBld.inventory) { for (var _tbi2 in _tBld.inventory) { if (_tOutSet[_tbi2]) continue; var _tbw = (findResource(_tbi2) || {}).weight || 1; _tBldUsed += (_tBld.inventory[_tbi2] || 0) * _tbw; } }
                        var _tResWeight = (findResource(o.good) || {}).weight || 1;
                        // Smart ratio limiter
                        var _trSmartMax = _smartInputLimit(_tBt, _tBld, o.good);
                        var _tCanFit;
                        if (_trSmartMax >= 0) {
                            _tCanFit = _trSmartMax;
                        } else {
                            _tCanFit = Math.floor((_tBldCap - _tBldUsed) / _tResWeight);
                        }
                        var _tStoreQty = Math.min(_storeRemaining, _tCanFit);
                        if (_tStoreQty > 0) {
                            if (!_tBld.inventory) _tBld.inventory = {};
                            _tBld.inventory[o.good] = (_tBld.inventory[o.good] || 0) + _tStoreQty;
                            _storeRemaining -= _tStoreQty;
                            stored += _tStoreQty;
                            logCaravan(caravan, '📥 Stored ' + _tStoreQty + ' ' + resName + ' in ' + (_tBt.name || _tBld.type) + ' at ' + townName + '.');
                        }
                    }
                    // Overflow: fall back to town/outpost storage, then keep leftovers on the caravan
                    if (_storeRemaining > 0) {
                        // v9p33river432: general fallback storage also needs a real capacity check.
                        var _storedTown = _storeInTownStorage(townId, o.good, _storeRemaining);
                        if (_storedTown > 0) {
                            stored += _storedTown;
                            logCaravan(caravan, '📥 Stored ' + _storedTown + ' ' + resName + ' in town storage at ' + townName + '.');
                            _storeRemaining -= _storedTown;
                        }
                        if (_storeRemaining > 0) {
                            logCaravan(caravan, '⚠️ Town storage full at ' + townName + ' — keeping ' + _storeRemaining + ' ' + resName + ' on caravan.');
                        }
                    }
                }
                if (stored > 0) {
                    caravan.goods[o.good] = (caravan.goods[o.good] || 0) - stored;
                    if (caravan.goods[o.good] <= 0) delete caravan.goods[o.good];
                    player.stats.caravanGoodsMoved = (player.stats.caravanGoodsMoved || 0) + stored;
                }
            } else if (o.action === 'sell') {
                var sellCarried = caravan.goods[o.good] || 0;
                var sellQty = Math.min(qty, sellCarried);
                var minPrice = o.priceLimit || 0;
                // v9p33river313: use Engine.getMarketPrice so price-control
                // law applies to caravan sell decisions too.
                var sellPrice = Engine.getMarketPrice ? Engine.getMarketPrice(town.id, o.good) : (town.market.prices[o.good] || 1);
                if (hasSkill('trade_route_mastery')) sellPrice *= 1.10;
                if (sellPrice < minPrice) {
                    logCaravan(caravan, '💰 ' + resName + ' price (' + Math.floor(sellPrice) + 'g) below minimum (' + minPrice + 'g) at ' + townName + '. Holding.');
                    continue;
                }
                if (sellQty <= 0) {
                    logCaravan(caravan, '💰 No ' + resName + ' on caravan to sell at ' + townName + '.');
                    continue;
                }

                // Check banned/restricted goods — apply same detection as personal smuggling
                var _sellKingdom = town.kingdomId ? Engine.findKingdom(town.kingdomId) : null;
                var _sellBanned = _sellKingdom && _sellKingdom.laws && _sellKingdom.laws.bannedGoods && _sellKingdom.laws.bannedGoods.indexOf(o.good) >= 0;
                var _sellRestricted = _sellKingdom && _sellKingdom.laws && _sellKingdom.laws.restrictedGoods && _sellKingdom.laws.restrictedGoods.indexOf(o.good) >= 0 && !hasLicense(_sellKingdom.id, o.good);

                if (_sellBanned) {
                    // v9p33river432: staged contraband must be removed again if the remote smuggle attempt fails.
                    var _cSmugTrade = _runStagedCaravanTrade(Player.attemptSmuggle, o.good, sellQty, town, _sellKingdom, sellPrice);
                    var _cSmugResult = _cSmugTrade.result;
                    if (_cSmugResult.success) {
                        logCaravan(caravan, '🚫💰 Caravan smuggled ' + sellQty + ' ' + resName + ' at ' + townName + '. ' + (_cSmugResult.message || ''));
                        caravan.totalProfit = (caravan.totalProfit || 0) + (_cSmugResult.totalRevenue || 0);
                    } else {
                        logCaravan(caravan, '🚨 Caravan caught smuggling ' + resName + ' at ' + townName + '! ' + (_cSmugResult.message || '') + (_cSmugTrade.consumed <= 0 ? ' Goods stayed on the caravan.' : ''));
                    }
                    if (_cSmugTrade.consumed > 0) {
                        caravan.goods[o.good] = (caravan.goods[o.good] || 0) - _cSmugTrade.consumed;
                        if (caravan.goods[o.good] <= 0) delete caravan.goods[o.good];
                        player.stats.caravanGoodsMoved = (player.stats.caravanGoodsMoved || 0) + _cSmugTrade.consumed;
                    }
                    continue;
                }

                if (_sellRestricted) {
                    // v9p33river432: failed restricted sales must not teleport staged cargo into player inventory.
                    player.restrictedTradesWithoutLicense = (player.restrictedTradesWithoutLicense || 0) + 1;
                    if (player.restrictedTradesWithoutLicense >= 10) unlockAchievement('tax_evader');
                    var _cRestTrade = _runStagedCaravanTrade(attemptRestrictedTrade, o.good, sellQty, town, _sellKingdom, sellPrice);
                    var _cRestResult = _cRestTrade.result;
                    if (_cRestResult.success) {
                        logCaravan(caravan, '⚠️💰 Caravan sold restricted ' + resName + ' at ' + townName + ' (no license). ' + (_cRestResult.message || ''));
                        caravan.totalProfit = (caravan.totalProfit || 0) + (_cRestResult.totalRevenue || 0);
                    } else {
                        logCaravan(caravan, '🚨 Caravan caught selling restricted ' + resName + ' at ' + townName + '! ' + (_cRestResult.message || '') + (_cRestTrade.consumed <= 0 ? ' Goods stayed on the caravan.' : ''));
                    }
                    if (_cRestTrade.consumed > 0) {
                        caravan.goods[o.good] = (caravan.goods[o.good] || 0) - _cRestTrade.consumed;
                        if (caravan.goods[o.good] <= 0) delete caravan.goods[o.good];
                        player.stats.caravanGoodsMoved = (player.stats.caravanGoodsMoved || 0) + _cRestTrade.consumed;
                    }
                    continue;
                }
                var grossRevenue = Math.floor(sellPrice * sellQty);
                // v9p33river432: collect sell tax from the gross first so caravan payouts are net, not tax-minting.
                var _cTax = _collectCaravanSellTax(townId, o.good, grossRevenue);
                var _cTariff = _applyCaravanTariff(_cTax.net, townId);
                var revenue = _cTariff.net;
                // v9p33river85: refuse caravan sale if market can't pay (silent — caravan keeps the goods).
                var _mAvail = Engine.getTownMarketGold ? Engine.getTownMarketGold(townId) : Infinity;
                if (_mAvail < revenue) {
                    logCaravan(caravan, '🪙 ' + townName + ' market lacks gold to buy ' + sellQty + ' ' + resName + ' (need ' + revenue + 'g, has ' + _mAvail + 'g). Caravan keeps the goods.');
                    continue;
                }
                _applyCaravanSellTax(townId, o.good, grossRevenue);
                player.gold += revenue;
                logFinance(revenue, 'caravan_sales', 'Caravan sold ' + sellQty + ' ' + res.name);
                player.stats.totalGoldEarned += revenue;
                // v9p33river342: credit toward "Raise X gold through trade" kingdom quests.
                if (Player.trackKQTradeGold) Player.trackKQTradeGold(revenue, town.kingdomId);
                caravan.totalProfit = (caravan.totalProfit || 0) + revenue;
                town.market.supply[o.good] = (town.market.supply[o.good] || 0) + sellQty;
                // v9p33river85: gold flows out of the town's market to the caravan
                if (Engine.adjustTownMarketGold) Engine.adjustTownMarketGold(town.id, -revenue);
                caravan.goods[o.good] = (caravan.goods[o.good] || 0) - sellQty;
                if (caravan.goods[o.good] <= 0) delete caravan.goods[o.good];
                player.stats.caravanGoodsMoved = (player.stats.caravanGoodsMoved || 0) + sellQty;
                var _sellCharges = [];
                if (_cTax.tax > 0) _sellCharges.push('tax: ' + _cTax.tax + 'g');
                if (_cTariff.tariff > 0) _sellCharges.push('tariff: ' + _cTariff.tariff + 'g');
                var _tariffMsg = _sellCharges.length > 0 ? ' (' + _sellCharges.join(', ') + ')' : '';
                logCaravan(caravan, '💰 Sold ' + sellQty + ' ' + resName + ' for ' + revenue + 'g at ' + townName + '.' + _tariffMsg);
                // Track cross-kingdom caravan trade for story mode
                if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction && caravan.route && caravan.route.length > 0) {
                    // v9p33river367: caravan.route stores segment objects here,
                    // not raw town ids. Resolve the origin town consistently.
                    var _originSeg = caravan.route[0];
                    var _originId = caravan.fromTownId || (_originSeg && _originSeg.fromTownId) || _originSeg;
                    var _originTown = Engine.findTown(_originId);
                    if (_originTown && _originTown.kingdomId && town.kingdomId && _originTown.kingdomId !== town.kingdomId) {
                        StoryMode.onPlayerAction('caravan_trade_complete', { goldValue: grossRevenue, fromKingdom: _originTown.kingdomId, toKingdom: town.kingdomId });
                    }
                }
            }
        }

        // Sell remaining goods with no specific order (backward-compat default)
        var orderedGoods = {};
        for (var gi = 0; gi < locationOrders.length; gi++) { orderedGoods[locationOrders[gi].good] = true; }
        for (var gId in caravan.goods) {
            if (orderedGoods[gId]) continue;
            var remQty = caravan.goods[gId] || 0;
            if (remQty <= 0) continue;
            if (player.townId === townId) {
                // Player is here — return to inventory
                player.inventory[gId] = (player.inventory[gId] || 0) + remQty;
                player.stats.caravanGoodsMoved = (player.stats.caravanGoodsMoved || 0) + remQty;
                logCaravan(caravan, '📋 Returned ' + remQty + ' ' + (findResource(gId) ? findResource(gId).name : gId) + ' to inventory.');
            } else {
                // Auto-sell: check banned/restricted first
                var _asKingdom = town.kingdomId ? Engine.findKingdom(town.kingdomId) : null;
                var _asBanned = _asKingdom && _asKingdom.laws && _asKingdom.laws.bannedGoods && _asKingdom.laws.bannedGoods.indexOf(gId) >= 0;
                var _asRestricted = _asKingdom && _asKingdom.laws && _asKingdom.laws.restrictedGoods && _asKingdom.laws.restrictedGoods.indexOf(gId) >= 0 && !hasLicense(_asKingdom.id, gId);
                var _asResName = findResource(gId) ? findResource(gId).name : gId;

                if (_asBanned) {
                    var remPrice = town.market.prices[gId] || 1;
                    // v9p33river432: auto-smuggle fallbacks need the same staged-inventory cleanup as manual sell orders.
                    var _asSmugTrade = _runStagedCaravanTrade(Player.attemptSmuggle, gId, remQty, town, _asKingdom, remPrice);
                    var _asSmugResult = _asSmugTrade.result;
                    if (_asSmugResult.success) {
                        logCaravan(caravan, '🚫💰 Caravan auto-smuggled ' + remQty + ' ' + _asResName + ' at ' + townName + '. ' + (_asSmugResult.message || ''));
                        caravan.totalProfit = (caravan.totalProfit || 0) + (_asSmugResult.totalRevenue || 0);
                    } else {
                        logCaravan(caravan, '🚨 Caravan caught auto-smuggling ' + _asResName + ' at ' + townName + '! ' + (_asSmugResult.message || '') + (_asSmugTrade.consumed <= 0 ? ' Goods stayed on the caravan.' : ''));
                    }
                    if (_asSmugTrade.consumed <= 0) continue;
                    player.stats.caravanGoodsMoved = (player.stats.caravanGoodsMoved || 0) + _asSmugTrade.consumed;
                } else if (_asRestricted) {
                    var remPrice2 = town.market.prices[gId] || 1;
                    // v9p33river432: failed restricted auto-sales must not teleport cargo into player inventory.
                    player.restrictedTradesWithoutLicense = (player.restrictedTradesWithoutLicense || 0) + 1;
                    if (player.restrictedTradesWithoutLicense >= 10) unlockAchievement('tax_evader');
                    var _asRestTrade = _runStagedCaravanTrade(attemptRestrictedTrade, gId, remQty, town, _asKingdom, remPrice2);
                    var _asRestResult = _asRestTrade.result;
                    if (_asRestResult.success) {
                        logCaravan(caravan, '⚠️💰 Caravan auto-sold restricted ' + _asResName + ' at ' + townName + ' (no license). ' + (_asRestResult.message || ''));
                        caravan.totalProfit = (caravan.totalProfit || 0) + (_asRestResult.totalRevenue || 0);
                    } else {
                        logCaravan(caravan, '🚨 Caravan caught selling restricted ' + _asResName + ' at ' + townName + '! ' + (_asRestResult.message || '') + (_asRestTrade.consumed <= 0 ? ' Goods stayed on the caravan.' : ''));
                    }
                    if (_asRestTrade.consumed <= 0) continue;
                    player.stats.caravanGoodsMoved = (player.stats.caravanGoodsMoved || 0) + _asRestTrade.consumed;
                } else {
                    var remPrice3 = Engine.getMarketPrice ? Engine.getMarketPrice(town.id, gId) : (town.market.prices[gId] || 1);
                    if (hasSkill('trade_route_mastery')) remPrice3 *= 1.10;
                    var remGross = Math.floor(remPrice3 * remQty);
                    // v9p33river432: auto-sells need the same pre-payout tax handling as explicit caravan sells.
                    var remTax = _collectCaravanSellTax(townId, gId, remGross);
                    var remTar = _applyCaravanTariff(remTax.net, townId);
                    var remRev = remTar.net;
                    // v9p33river85: refuse if market lacks gold
                    var _remAvail = Engine.getTownMarketGold ? Engine.getTownMarketGold(townId) : Infinity;
                    if (_remAvail < remRev) {
                        logCaravan(caravan, '🪙 ' + townName + ' market lacks gold to buy ' + remQty + ' ' + _asResName + ' (need ' + remRev + 'g, has ' + _remAvail + 'g).');
                        continue;
                    }
                    _applyCaravanSellTax(townId, gId, remGross);
                    player.gold += remRev;
                    logFinance(remRev, 'caravan_sales', 'Caravan auto-sold ' + _asResName);
                    player.stats.totalGoldEarned += remRev;
                    caravan.totalProfit = (caravan.totalProfit || 0) + remRev;
                    town.market.supply[gId] = (town.market.supply[gId] || 0) + remQty;
                    if (Engine.adjustTownMarketGold) Engine.adjustTownMarketGold(town.id, -remRev);
                    player.stats.caravanGoodsMoved = (player.stats.caravanGoodsMoved || 0) + remQty;
                    var _remCharges = [];
                    if (remTax.tax > 0) _remCharges.push('tax: ' + remTax.tax + 'g');
                    if (remTar.tariff > 0) _remCharges.push('tariff: ' + remTar.tariff + 'g');
                    var _remTMsg = _remCharges.length > 0 ? ' (' + _remCharges.join(', ') + ')' : '';
                    logCaravan(caravan, '💰 Auto-sold ' + remQty + ' ' + _asResName + ' for ' + remRev + 'g at ' + townName + '.' + _remTMsg);
                }
            }
            delete caravan.goods[gId];
        }

        // Recalculate weight using caravan-aware weight function
        caravan.totalWeight = _getCaravanCurrentWeight(caravan);
        return true; // signal: orders were processed
    }

    function getCaravanLog(caravanId) {
        _sync();
        for (var i = 0; i < player.caravans.length; i++) {
            if (player.caravans[i].id === caravanId) return player.caravans[i].log || [];
        }
        return [];
    }

    function editCaravanOrders(caravanId, newOrders) {
        _sync();
        for (var i = 0; i < player.caravans.length; i++) {
            if (player.caravans[i].id === caravanId) {
                var _validatedOrders = _validateCaravanOrders(newOrders);
                if (!_validatedOrders.valid) {
                    return { success: false, message: _validatedOrders.message };
                }
                player.caravans[i].orders = _validatedOrders.orders.length > 0 ? structuredClone(_validatedOrders.orders) : null;
                logCaravan(player.caravans[i], '📝 Orders updated.');
                return { success: true, message: 'Caravan orders updated.' };
            }
        }
        return { success: false, message: 'Caravan not found.' };
    }

    // Calculate caravan stats for preview or display
    function getCaravanStats(opts) {
        _sync();
        var carriers = Math.max(1, Number(opts.carriers) || 1);
        var guardCount = Math.max(0, Number(opts.guardCount) || 0);
        var carrierHorses = Math.min(carriers, Math.max(0, Number(opts.carrierHorses) || 0));
        var crt = Math.max(0, Number(opts.carts) || 0);
        var wag = Math.max(0, Number(opts.wagons) || 0);
        var guardWeapons = Math.min(guardCount, Math.max(0, Number(opts.guardWeapons) || 0));
        var guardArmor = Math.min(guardCount, Math.max(0, Number(opts.guardArmor) || 0));

        // Capacity
        var capacity = carriers * (CONFIG.CARAVAN_CARRIER_BASE_CAPACITY || 30);
        capacity += carrierHorses * (CONFIG.CARAVAN_HORSE_EXTRA_CAPACITY || 30);
        capacity += crt * (CONFIG.CARAVAN_CART_CAPACITY || 80);
        capacity += wag * (CONFIG.CARAVAN_WAGON_CAPACITY || 200);

        // Estimate trip days
        var fromTownId = opts.fromTownId || player.townId;
        var toTownId = opts.toTownId;
        var tripDays = 0;
        if (fromTownId && toTownId) {
            var route = Engine.findPath(fromTownId, toTownId);
            if (route && route.length > 0) {
                var dist = 0;
                for (var si = 0; si < route.length; si++) {
                    var a = Engine.findTown(route[si].fromTownId);
                    var b = Engine.findTown(route[si].toTownId);
                    if (a && b) dist += Math.hypot(a.x - b.x, a.y - b.y) / (CONFIG.CARAVAN_ROAD_MULTIPLIER[route[si].quality] || 1);
                }
                if (carrierHorses > 0) {
                    dist *= Math.max(0.4, 1 - carrierHorses * (CONFIG.CARAVAN_HORSE_SPEED_BONUS || 0.10));
                }
                var speed = CONFIG.CARAVAN_BASE_SPEED || 120;
                if (hasSkill('road_knowledge')) speed *= 1.15;
                if (hasSkill('cartographer')) speed *= 1.05;
                tripDays = Math.max(1, Math.ceil(dist / speed));
            }
        }

        // Risk calculation — daily and yearly
        var roadUnsafe = opts.roadUnsafe || false;
        var atWar = opts.atWar || false;
        var connUnsafe = opts.connUnsafe || false;
        // Auto-detect from route if possible
        if (fromTownId && toTownId && !opts._manualRisk) {
            var rte = Engine.findPath(fromTownId, toTownId);
            if (rte && rte.length > 0) {
                for (var ri = 0; ri < rte.length; ri++) {
                    if (rte[ri].safe === false || (rte[ri].banditThreat || 0) > (CONFIG.BANDIT_THREAT_DANGER_THRESHOLD || 50)) roadUnsafe = true;
                }
            }
            var w = Engine.getWorld();
            if (w) {
                // Check if kingdoms at origin/dest are at war
                var fromT = Engine.findTown(fromTownId);
                var toT = Engine.findTown(toTownId);
                if (fromT && toT && w.kingdoms) {
                    for (var ki = 0; ki < w.kingdoms.length; ki++) {
                        var k = w.kingdoms[ki];
                        if (k.id === fromT.kingdomId || k.id === toT.kingdomId) {
                            if (k.atWar && (k.atWar instanceof Set ? k.atWar.size > 0 : Array.isArray(k.atWar) ? k.atWar.length > 0 : !!k.atWar)) atWar = true;
                        }
                    }
                }
                // Check connection town security
                if (rte) {
                    for (var ci = 0; ci < rte.length; ci++) {
                        var cTown = Engine.findTown(rte[ci].fromTownId);
                        if (cTown && (cTown.security || 50) < 40) connUnsafe = true;
                        cTown = Engine.findTown(rte[ci].toTownId);
                        if (cTown && (cTown.security || 50) < 40) connUnsafe = true;
                    }
                }
            }
        }

        var baseDailyTheft = CONFIG.CARAVAN_BASE_DAILY_THEFT || 0.0012;
        var baseDailyKill = CONFIG.CARAVAN_BASE_DAILY_KILL || 0.0005;
        var roadMult = roadUnsafe ? (CONFIG.CARAVAN_ROAD_UNSAFE_MULT || 2.0) : 1.0;
        var warMult = atWar ? (CONFIG.CARAVAN_WAR_MULT || 1.5) : 1.0;
        var connMult = connUnsafe ? (CONFIG.CARAVAN_UNSAFE_CONN_MULT || 1.2) : 1.0;
        var guardMult = Math.pow(CONFIG.CARAVAN_PER_GUARD_MULT || 0.55, guardCount);
        var weapMult = Math.pow(CONFIG.CARAVAN_PER_WEAPON_MULT || 0.85, guardWeapons);
        var armMult = Math.pow(CONFIG.CARAVAN_PER_ARMOR_MULT || 0.90, guardArmor);
        // More carriers = bigger target (each extra carrier adds ~8% risk)
        var carrierRiskMult = 1 + (carriers - 1) * (CONFIG.CARAVAN_PER_CARRIER_RISK || 0.08);
        // Legacy security bonuses
        var decoyMult = opts.decoy ? 0.60 : 1.0;
        var fortMult = opts.fortified ? 0.85 : 1.0;

        var dailyTheft = baseDailyTheft * roadMult * warMult * connMult * carrierRiskMult * guardMult * weapMult * armMult * decoyMult * fortMult;
        var dailyKill = baseDailyKill * roadMult * warMult * connMult * carrierRiskMult * guardMult * weapMult * armMult * fortMult;
        var yearlyTheft = 1 - Math.pow(1 - dailyTheft, CONFIG.DAYS_PER_SEASON);
        var yearlyKill = 1 - Math.pow(1 - dailyKill, CONFIG.DAYS_PER_SEASON);

        // Daily wage cost — dynamic based on town economy
        var wageRates = getCaravanHireRates(opts.fromTownId || player.townId);
        var dailyWage = carriers * wageRates.carrierWage + guardCount * wageRates.guardWage;
        if (hasSkill('thrifty_caravanner')) dailyWage = Math.floor(dailyWage * 0.75);
        if (hasSkill('cheap_security')) dailyWage = Math.floor(dailyWage * 0.80);

        return {
            capacity: capacity,
            tripDays: tripDays,
            roundTripDays: tripDays * 2,
            dailyTheft: dailyTheft,
            dailyKill: dailyKill,
            yearlyTheftPct: Math.round(yearlyTheft * 1000) / 10,
            yearlyKillPct: Math.round(yearlyKill * 1000) / 10,
            dailyWage: dailyWage,
            carrierWage: wageRates.carrierWage,
            guardWage: wageRates.guardWage,
            roadUnsafe: roadUnsafe,
            atWar: atWar,
            connUnsafe: connUnsafe
        };
    }

    function editCaravanEquipment(caravanId, changes) {
        _sync();
        var caravan = null;
        for (var i = 0; i < player.caravans.length; i++) {
            if (player.caravans[i].id === caravanId) { caravan = player.caravans[i]; break; }
        }
        if (!caravan) return { success: false, message: 'Caravan not found.' };
        if (!caravan.active) return { success: false, message: 'Cannot edit a completed caravan.' };

        var msgs = [];
        // Add horses
        if (changes.addHorses && changes.addHorses > 0) {
            var maxH = (caravan.carriers || 1) - (caravan.carrierHorses || 0);
            var addH = Math.min(changes.addHorses, maxH, player.inventory['horses'] || 0);
            if (addH > 0) {
                player.inventory['horses'] -= addH;
                caravan.carrierHorses = (caravan.carrierHorses || 0) + addH;
                msgs.push('+' + addH + ' 🐴 horses');
            }
        }
        // Add weapons
        if (changes.addWeapons && changes.addWeapons > 0) {
            var maxW = (caravan.guards || 0) - (caravan.guardWeapons || 0);
            var addW = Math.min(changes.addWeapons, maxW, player.inventory['swords'] || 0);
            if (addW > 0) {
                player.inventory['swords'] -= addW;
                caravan.guardWeapons = (caravan.guardWeapons || 0) + addW;
                msgs.push('+' + addW + ' ⚔️ weapons');
            }
        }
        // Add armor
        if (changes.addArmor && changes.addArmor > 0) {
            var maxA = (caravan.guards || 0) - (caravan.guardArmor || 0);
            var addA = Math.min(changes.addArmor, maxA, player.inventory['armor'] || 0);
            if (addA > 0) {
                player.inventory['armor'] -= addA;
                caravan.guardArmor = (caravan.guardArmor || 0) + addA;
                msgs.push('+' + addA + ' 🛡️ armor');
            }
        }
        // Recalculate capacity
        caravan.capacity = (caravan.carriers || 1) * (CONFIG.CARAVAN_CARRIER_BASE_CAPACITY || 30)
            + (caravan.carrierHorses || 0) * (CONFIG.CARAVAN_HORSE_EXTRA_CAPACITY || 30)
            + (caravan.carts || 0) * (CONFIG.CARAVAN_CART_CAPACITY || 80)
            + (caravan.wagons || 0) * (CONFIG.CARAVAN_WAGON_CAPACITY || 200);

        if (msgs.length > 0) {
            logCaravan(caravan, '🔧 Equipment updated: ' + msgs.join(', '));
            return { success: true, message: 'Caravan updated: ' + msgs.join(', ') };
        }
        return { success: false, message: 'No changes applied.' };
    }

    // Process caravan arrival — extracted so it can be called from subtick for instant turnaround
    // Release ship assignment when a caravan completes/deactivates
    function _releaseCaravanShip(caravan) {
        _sync();
        if (caravan.shipId) {
            var ship = _findAssignedCaravanShip(caravan);
            if (ship) ship.assignedCaravanId = null;
            caravan.shipId = null;
        }
    }

    // ── Caravan passenger system ──────────────────────────────
    function _getCaravanRouteTownIds(caravan) {
        _sync();
        var towns = {};
        if (caravan.fromTownId) towns[caravan.fromTownId] = true;
        if (caravan.toTownId) towns[caravan.toTownId] = true;
        if (caravan.route) {
            for (var i = 0; i < caravan.route.length; i++) {
                if (caravan.route[i].fromTownId) towns[caravan.route[i].fromTownId] = true;
                if (caravan.route[i].toTownId) towns[caravan.route[i].toTownId] = true;
            }
        }
        return towns;
    }

    function _getCaravanPassengerCap(caravan) {
        _sync();
        // 1 passenger per carrier, +4 per cart, +8 per wagon
        return (caravan.carriers || 1) + (caravan.carts || 0) * 4 + (caravan.wagons || 0) * 8;
    }

    function _getCaravanCurrentWeight(caravan) {
        _sync();
        var w = 0;
        var isSea = !!(caravan.shipCapacity || caravan.routeType === 'sea');
        if (caravan.goods) {
            for (var k in caravan.goods) {
                if (caravan.goods.hasOwnProperty(k)) {
                    var r = findResource(k);
                    var rw;
                    if (k === 'horses' && !isSea) {
                        rw = 0; // road caravans: horses walk alongside, no weight
                    } else if (k === 'horses' && isSea) {
                        rw = CONFIG.CARAVAN_HORSE_SEA_WEIGHT || 15;
                    } else {
                        rw = r ? r.weight : 1;
                    }
                    w += rw * (caravan.goods[k] || 0);
                }
            }
        }
        return w;
    }

    function _getCaravanCapacity(caravan) {
        _sync();
        // Sea caravans use ship capacity
        if (caravan.shipCapacity) return caravan.shipCapacity;
        return (caravan.carriers || 1) * (CONFIG.CARAVAN_CARRIER_BASE_CAPACITY || 30)
            + (caravan.carrierHorses || 0) * (CONFIG.CARAVAN_HORSE_EXTRA_CAPACITY || 30)
            + (caravan.carts || 0) * (CONFIG.CARAVAN_CART_CAPACITY || 80)
            + (caravan.wagons || 0) * (CONFIG.CARAVAN_WAGON_CAPACITY || 200);
    }

    // Returns how many units of a given resource can still fit on caravan
    function _caravanCanFit(caravan, resId) {
        _sync();
        var cap = _getCaravanCapacity(caravan);
        var cur = _getCaravanCurrentWeight(caravan);
        var remaining = cap - cur;
        if (remaining <= 0) return 0;
        var isSea = !!(caravan.shipCapacity || caravan.routeType === 'sea');
        var w;
        if (resId === 'horses' && !isSea) {
            // Road caravans: horses don't use weight capacity but limited by carriers
            var maxHorses = (caravan.carriers || 1) * (CONFIG.CARAVAN_HORSES_PER_CARRIER || 4);
            var curHorses = (caravan.goods && caravan.goods['horses']) || 0;
            return Math.max(0, maxHorses - curHorses);
        } else if (resId === 'horses' && isSea) {
            w = CONFIG.CARAVAN_HORSE_SEA_WEIGHT || 15;
        } else {
            var r = findResource(resId);
            w = (r ? r.weight : 1);
        }
        return Math.floor(remaining / w);
    }

    function _processCaravanPassengers(caravan, townId) {
        _sync();
        if (!caravan.autoPickupTravelers) return;
        if (!caravan.passengers) caravan.passengers = [];
        var town = Engine.findTown(townId);
        if (!town) return;
        var townName = town.name || townId;

        // 1. Drop off passengers whose destination is this town
        var dropped = [];
        var remaining = [];
        var fareEarned = 0;
        for (var i = 0; i < caravan.passengers.length; i++) {
            var p = caravan.passengers[i];
            if (p.destinationTownId === townId) {
                // v9p33river432: only pay for passengers who still exist and are alive on arrival.
                var person = Engine.findPerson ? Engine.findPerson(p.personId) : null;
                if (person && person.alive) {
                    fareEarned += p.fare || 0;
                    dropped.push(p);
                    person.townId = townId;
                }
            } else {
                remaining.push(p);
            }
        }
        caravan.passengers = remaining;
        if (dropped.length > 0) {
            player.gold += fareEarned;
            player.stats.totalGoldEarned += fareEarned;
            caravan.totalProfit = (caravan.totalProfit || 0) + fareEarned;
            logFinance(fareEarned, 'caravan_passenger', 'Caravan passenger fares');
            logCaravan(caravan, '🚌 Delivered ' + dropped.length + ' passenger' + (dropped.length > 1 ? 's' : '') + ' to ' + townName + '. Earned ' + fareEarned + 'g.');
            player.stats.caravanPassengersDelivered = (player.stats.caravanPassengersDelivered || 0) + dropped.length;
        }

        // 2. Pick up travelers whose destination is on the caravan's route
        var demand = town.travelDemand || [];
        // v9p33river432: stale travel-demand entries can point to dead or moved NPCs.
        if (demand.length > 0 && Engine.findPerson) {
            demand = demand.filter(function(d) {
                var traveler = Engine.findPerson(d.personId);
                return traveler && traveler.alive && traveler.townId === townId;
            });
            town.travelDemand = demand;
        }
        if (demand.length === 0) return;
        var routeTowns = _getCaravanRouteTownIds(caravan);
        var cap = _getCaravanPassengerCap(caravan);
        var currentCount = caravan.passengers.length;
        var pickedUp = [];

        for (var j = 0; j < demand.length && currentCount < cap; j++) {
            var d = demand[j];
            // Destination must be on this caravan's route and NOT the current town
            if (d.destinationTownId === townId) continue;
            if (!routeTowns[d.destinationTownId]) continue;
            pickedUp.push(d);
            caravan.passengers.push({
                personId: d.personId,
                name: d.personName || 'Traveler',
                wealthClass: d.wealthClass || 'lower',
                destinationTownId: d.destinationTownId,
                destinationName: d.destinationName || d.destinationTownId,
                fare: d.maxPrice || 5,
                boardedDay: Engine.getDay ? Engine.getDay() : 0
            });
            currentCount++;
        }

        // Remove picked-up travelers from town demand
        for (var k = 0; k < pickedUp.length; k++) {
            var idx = town.travelDemand.indexOf(pickedUp[k]);
            if (idx !== -1) town.travelDemand.splice(idx, 1);
        }

        if (pickedUp.length > 0) {
            logCaravan(caravan, '🚌 Picked up ' + pickedUp.length + ' passenger' + (pickedUp.length > 1 ? 's' : '') + ' at ' + townName + '. (' + currentCount + '/' + cap + ' seats)');
        }
    }

    function _processCaravanArrival(caravan) {
        _sync();
                // Export contraband check — intercept before goods are sold
                if (caravan._exportContraband && !caravan._exportCheckDone) {
                    caravan._exportCheckDone = true;
                    var _ecFromTown = Engine.findTown(caravan.returnTrip ? caravan.toTownId : caravan.fromTownId);
                    var _ecToTown = Engine.findTown(caravan.returnTrip ? caravan.fromTownId : caravan.toTownId);
                    if (_ecFromTown && _ecToTown && _ecFromTown.kingdomId !== _ecToTown.kingdomId) {
                        var _ecRng = Engine.getRng();
                        // Base detection: 20%
                        var _ecDetect = 0.20;
                        // More guards reduce detection
                        _ecDetect -= Math.min(0.15, (caravan.guards || 0) * 0.03);
                        // More wagons help hide contraband
                        _ecDetect -= Math.min(0.10, (caravan.wagons || 0) * 0.05);
                        // Fortified flag
                        if (caravan.fortified) _ecDetect -= 0.10;
                        // Decoy
                        if (caravan.decoy) _ecDetect -= 0.08;
                        // Player noble rank in source kingdom
                        var _ecRank = (player.socialRank && player.socialRank[caravan._exportRestrictionKingdomId]) || 0;
                        if (_ecRank >= 5) _ecDetect -= 0.20;
                        else if (_ecRank >= 4) _ecDetect -= 0.10;
                        // Skills
                        if (hasSkill('master_smuggler')) _ecDetect -= 0.15;
                        else if (hasSkill('smugglers_run')) _ecDetect -= 0.08;
                        _ecDetect = Math.max(0.01, Math.min(0.90, _ecDetect));

                        if ((_ecRng ? _ecRng.random() : Math.random()) < _ecDetect) {
                            // CAUGHT — caravan seized
                            var _ecKName = '';
                            var _ecK = Engine.findKingdom ? Engine.findKingdom(caravan._exportRestrictionKingdomId) : null;
                            if (_ecK) _ecKName = _ecK.name;
                            var confGoods = [];
                            for (var _egi = 0; _egi < (caravan._exportRestrictedGoods || []).length; _egi++) {
                                var _egId = caravan._exportRestrictedGoods[_egi];
                                if (caravan.goods[_egId] && caravan.goods[_egId] > 0) {
                                    confGoods.push(caravan.goods[_egId] + 'x ' + _egId);
                                    delete caravan.goods[_egId];
                                }
                            }
                            // Fine the player
                            var _ecFine = 200 + Math.floor((player.gold || 0) * 0.05);
                            Player.modifyGold(-_ecFine);
                            if (_ecK) { _ecK.gold = (_ecK.gold || 0) + _ecFine; }
                            // Criminal record
                            if (!player.criminalRecord) player.criminalRecord = {};
                            if (!player.criminalRecord[caravan._exportRestrictionKingdomId]) player.criminalRecord[caravan._exportRestrictionKingdomId] = {};
                            player.criminalRecord[caravan._exportRestrictionKingdomId].export_violation = (player.criminalRecord[caravan._exportRestrictionKingdomId].export_violation || 0) + 1;
                            // Disband caravan
                            caravan.status = 'arrived';
                            caravan.active = false;
                            caravan.recurring = false;
                            var _ecMsg = '🚫 Caravan seized at ' + _ecKName + ' border for export violation! Confiscated: ' + confGoods.join(', ') + '. Fined ' + _ecFine + 'g. Caravan disbanded.';
                            logCaravan(caravan, _ecMsg);
                            Engine.logEvent(_ecMsg, null, 'my_business');
                            if (typeof UI !== 'undefined' && UI.toast) UI.toast(_ecMsg, 'danger', 'critical');
                            return;
                        }
                        // Not caught — log success
                        logCaravan(caravan, '🥷 Caravan smuggled export-restricted goods past the ' + (_ecK ? _ecK.name : '') + ' border checkpoint.');
                    }
                }
                caravan.progress = 1.0;
                caravan.tripCount = (caravan.tripCount || 0) + 1;

                // Handle ship arrival: move owned ship to destination, release assignment
                var _arrDestId = caravan.returnTrip ? caravan.fromTownId : caravan.toTownId;
                if (caravan.routeType === 'sea' && caravan.shipId) {
                    var _arrShip = _findAssignedCaravanShip(caravan);
                    if (_arrShip) _arrShip.townId = _arrDestId;
                }

                const isReturnLeg = caravan.returnTrip;
                const destTownId = isReturnLeg ? caravan.fromTownId : caravan.toTownId;
                const originTownId = isReturnLeg ? caravan.toTownId : caravan.fromTownId;
                const destTown = Engine.findTown(destTownId);
                const originTown = Engine.findTown(originTownId);

                if (destTown) {
                    // Disbanding caravan: drop all goods to storage instead of selling
                    if (caravan.disbanding) {
                        var dropTownId = destTownId;
                        var dropTownName = destTown.name || destTownId;
                        if (!player.townStorage[dropTownId]) player.townStorage[dropTownId] = {};
                        var totalDropped = 0;
                        for (var _dk in caravan.goods) {
                            if (caravan.goods[_dk] > 0) {
                                if (player.townId === dropTownId) {
                                    player.inventory[_dk] = (player.inventory[_dk] || 0) + caravan.goods[_dk];
                                } else {
                                    player.townStorage[dropTownId][_dk] = (player.townStorage[dropTownId][_dk] || 0) + caravan.goods[_dk];
                                }
                                totalDropped += caravan.goods[_dk];
                            }
                        }
                        caravan.goods = {};
                        if (totalDropped > 0) {
                            logCaravan(caravan, '📦 Dropped off ' + totalDropped + ' goods at ' + dropTownName + (player.townId === dropTownId ? ' (to inventory).' : ' (to storage).'));
                        }

                        if (isReturnLeg) {
                            caravan.status = 'arrived';
                            caravan.active = false;
                            caravan.recurring = false;
                            logCaravan(caravan, '🏳️ Caravan disbanded after final run.');
                            Engine.logEvent('Caravan disbanded at ' + dropTownName + '. All goods dropped off.', { _noToast: true }, 'my_business');
                            return;
                        } else {
                            caravan.returnTrip = true;
                            caravan.progress = 0.0;
                            caravan._lastWaypointIdx = 0;
                            caravan.status = 'traveling';
                            if (caravan.route) {
                                caravan.route = caravan.route.slice().reverse().map(function(seg) {
                                    return { ...seg, fromTownId: seg.toTownId, toTownId: seg.fromTownId,
                                        waypoints: seg.waypoints ? seg.waypoints.slice().reverse() : seg.waypoints };
                                });
                            }
                            logCaravan(caravan, '🔄 Returning to ' + (originTown ? originTown.name : 'origin') + ' for final disbandment.');
                            return;
                        }
                    }

                    // New order-based processing
                    if (caravan.orders && caravan.orders.length > 0) {
                        processCaravanOrders(caravan, destTownId, isReturnLeg);
                    } else {
                        // Legacy behavior: sell all goods at destination
                        let tripRevenue = 0;
                        let remainingLegacyGoods = {};
                        for (const [resId, qty] of Object.entries(caravan.goods)) {
                            if (qty <= 0) continue;
                            if (player.townId === destTownId) {
                                player.inventory[resId] = (player.inventory[resId] || 0) + qty;
                            } else {
                                // v9p33river432: keep unsold legacy cargo aboard, and collect sell tax before final payout.
                                let price = Engine.getMarketPrice ? Engine.getMarketPrice(destTownId, resId) : (destTown.market.prices[resId] || 1);
                                if (hasSkill('trade_route_mastery')) price *= 1.10;
                                const grossRev = Math.floor(price * qty);
                                const _legTax = _collectCaravanSellTax(destTownId, resId, grossRev);
                                const _legTar = _applyCaravanTariff(_legTax.net, destTownId);
                                const revenue = _legTar.net;
                                // v9p33river85: refuse if dest market can't pay
                                const _legAvail = Engine.getTownMarketGold ? Engine.getTownMarketGold(destTownId) : Infinity;
                                if (_legAvail < revenue) {
                                    remainingLegacyGoods[resId] = qty;
                                    Engine.logEvent('🪙 ' + destTown.name + ' market lacks gold for caravan goods (need ' + revenue + 'g, has ' + _legAvail + 'g) — kept aboard.', null, 'my_business');
                                    continue;
                                }
                                _applyCaravanSellTax(destTownId, resId, grossRev);
                                player.gold += revenue;
                                logFinance(revenue, 'caravan_sales', 'Caravan sold goods');
                                player.stats.totalGoldEarned += revenue;
                                tripRevenue += revenue;
                                destTown.market.supply[resId] = (destTown.market.supply[resId] || 0) + qty;
                                if (Engine.adjustTownMarketGold) Engine.adjustTownMarketGold(destTown.id, -revenue);
                                var _legCharges = [];
                                if (_legTax.tax > 0) _legCharges.push('tax: ' + _legTax.tax + 'g');
                                if (_legTar.tariff > 0) _legCharges.push('tariff: ' + _legTar.tariff + 'g');
                                var _legTMsg = _legCharges.length > 0 ? ' (' + _legCharges.join(', ') + ')' : '';
                                Engine.logEvent('Caravan goods sold at ' + destTown.name + ': ' + qty + ' ' + resId + ' for ' + revenue + 'g.' + _legTMsg, { _noToast: true }, 'my_business');
                                // Track cross-kingdom caravan trade for story mode
                                if (typeof StoryMode !== 'undefined' && StoryMode.onPlayerAction && caravan.route && caravan.route.length > 0) {
                                    // v9p33river320: caravan.route entries are
                                    // segment objects ({fromTownId, toTownId,
                                    // waypoints, ...}), not town id strings.
                                    // Use the first segment's fromTownId.
                                    var _legSeg = caravan.route[0];
                                    var _legOriginId = (_legSeg && _legSeg.fromTownId) || _legSeg;
                                    var _legOrigin = Engine.findTown(_legOriginId);
                                    if (_legOrigin && _legOrigin.kingdomId && destTown.kingdomId && _legOrigin.kingdomId !== destTown.kingdomId) {
                                        StoryMode.onPlayerAction('caravan_trade_complete', { goldValue: grossRev, fromKingdom: _legOrigin.kingdomId, toKingdom: destTown.kingdomId });
                                    }
                                }
                            }
                        }
                        caravan.totalProfit = (caravan.totalProfit || 0) + tripRevenue;
                        caravan.goods = remainingLegacyGoods;

                        // Legacy auto-buy at destination if buyOrders configured
                        if (caravan.buyOrders && (caravan.roundTrip || caravan.recurring)) {
                            let buySpent = 0;
                            let buySubsidy = 0;
                            const boughtGoods = {};
                            let boughtWeight = 0;
                            const legacyCap = _getCaravanCapacity(caravan);
                            for (const [resId, order] of Object.entries(caravan.buyOrders)) {
                                const wantQty = order.qty || 0;
                                const maxPrice = order.maxPrice || Infinity;
                                const marketPrice = Engine.getMarketPrice ? Engine.getMarketPrice(destTown.id, resId) : (destTown.market.prices[resId] || 0);
                                const marketSupply = destTown.market.supply[resId] || 0;
                                if (marketPrice <= 0 || marketPrice > maxPrice || marketSupply <= 0) continue;
                                const canAfford = Math.floor((player.gold - buySpent) / marketPrice);
                                const rw = (findResource(resId) || {}).weight || 1;
                                const fitQty = Math.floor((legacyCap - boughtWeight) / rw);
                                const buyQty = Math.min(wantQty, marketSupply, canAfford, fitQty);
                                if (buyQty <= 0) continue;
                                const cost = Math.floor(marketPrice * buyQty);
                                boughtGoods[resId] = buyQty;
                                boughtWeight += buyQty * rw;
                                buySpent += cost;
                                destTown.market.supply[resId] = Math.max(0, marketSupply - buyQty);
                                if (Engine.adjustTownMarketGold) Engine.adjustTownMarketGold(destTown.id, cost);
                                if (Engine.collectTradeTax) {
                                    var _legacyTax = Engine.collectTradeTax(destTown.kingdomId, cost, resId, true, destTown.id);
                                    if (_legacyTax && _legacyTax.subsidyAwarded > 0) {
                                        buySubsidy += _legacyTax.subsidyAwarded;
                                        player.gold += _legacyTax.subsidyAwarded;
                                        player.stats.totalGoldEarned = (player.stats.totalGoldEarned || 0) + _legacyTax.subsidyAwarded;
                                        if (typeof logFinance === 'function') logFinance(_legacyTax.subsidyAwarded, 'caravan', 'Trade subsidy: ' + resId);
                                    }
                                }
                                Engine.logEvent(`Caravan bought ${buyQty} ${resId} at ${destTown.name} for ${cost}g.`, { _noToast: true }, 'my_business');
                            }
                            if (buySpent > 0) {
                                player.gold -= buySpent;
                                player.stats.totalGoldSpent += buySpent;
                                caravan.totalProfit = (caravan.totalProfit || 0) - buySpent + buySubsidy;
                                caravan.totalSpent = (caravan.totalSpent || 0) + buySpent;
                            }
                            caravan.goods = boughtGoods;
                            let returnWeight = 0;
                            for (const [resId, qty] of Object.entries(boughtGoods)) {
                                const res = findResource(resId);
                                returnWeight += (res ? res.weight : 1) * qty;
                            }
                            caravan.totalWeight = returnWeight;
                        }
                    }
                } else {
                    // Destination town no longer exists — return cargo and stop caravan
                    for (const [resId, qty] of Object.entries(caravan.goods)) {
                        if (qty > 0) player.inventory[resId] = (player.inventory[resId] || 0) + qty;
                    }
                    caravan.goods = {};
                    caravan.status = 'arrived';
                    caravan.active = false;
                    caravan.recurring = false;
                    Engine.logEvent('Caravan destination no longer exists — cargo returned to inventory.', null, 'my_business');
                    return;
                }

                // Process passengers: drop off arrivals, pick up new travelers
                _processCaravanPassengers(caravan, destTownId);

                const routeLabel = caravan.routeType === 'sea' ? 'Sea caravan' : 'Caravan';
                Engine.logEvent(`${routeLabel} arrived at ${destTown ? destTown.name : 'destination'}.`, { _noToast: true }, 'my_business');

                // XP for caravan/voyage completion
                if (caravan.routeType === 'sea') {
                    grantXP(XP_REWARDS.SEA_VOYAGE, 'sea voyage');
                    player.achievementStats.seaVoyagesCompleted = (player.achievementStats.seaVoyagesCompleted || 0) + 1;
                } else {
                    grantXP(XP_REWARDS.CARAVAN_COMPLETE, 'caravan');
                }
                if (!player.achievementStats.caravanDestinations) player.achievementStats.caravanDestinations = {};
                player.achievementStats.caravanDestinations[destTownId] = true;
                player.stats.caravansCompleted = (player.stats.caravansCompleted || 0) + 1;

                // CHECK AUTO-DISBAND CONDITIONS
                var autoDisbandReason = checkAutoDisbandConditions(caravan, destTownId);
                if (autoDisbandReason) {
                    logCaravan(caravan, autoDisbandReason);
                    Engine.logEvent(autoDisbandReason, null, 'my_business');
                    if (caravan.orders && caravan.orders.length > 0) {
                        processCaravanOrders(caravan, destTownId, isReturnLeg);
                    }
                    for (var _adk in caravan.goods) {
                        if (caravan.goods[_adk] > 0) {
                            if (player.townId === destTownId) {
                                player.inventory[_adk] = (player.inventory[_adk] || 0) + caravan.goods[_adk];
                            } else if (caravan.overflowSell && destTown && destTown.market) {
                                var _adPrice = destTown.market.prices[_adk] || 1;
                                var _adRev = Math.floor(_adPrice * caravan.goods[_adk]);
                                player.gold += _adRev;
                                player.stats.totalGoldEarned += _adRev;
                                caravan.totalProfit = (caravan.totalProfit || 0) + _adRev;
                                destTown.market.supply[_adk] = (destTown.market.supply[_adk] || 0) + caravan.goods[_adk];
                            } else {
                                if (!player.townStorage[destTownId]) player.townStorage[destTownId] = {};
                                player.townStorage[destTownId][_adk] = (player.townStorage[destTownId][_adk] || 0) + caravan.goods[_adk];
                            }
                        }
                    }
                    caravan.goods = {};
                    caravan.status = 'arrived';
                    caravan.active = false;
                    caravan.recurring = false;
                    logCaravan(caravan, '🛑 Caravan auto-disbanded.');
                    var _adAtTown = player.townId === destTownId;
                    if (caravan.carrierHorses > 0) {
                        // Horses go to player inventory (slot-based, not weight-based) regardless of location
                        player.inventory['horses'] = (player.inventory['horses'] || 0) + caravan.carrierHorses;
                    }
                    if (caravan.guardWeapons > 0) {
                        if (_adAtTown) player.inventory['swords'] = (player.inventory['swords'] || 0) + caravan.guardWeapons;
                        else { if (!player.townStorage[destTownId]) player.townStorage[destTownId] = {}; player.townStorage[destTownId]['swords'] = (player.townStorage[destTownId]['swords'] || 0) + caravan.guardWeapons; }
                    }
                    if (caravan.guardArmor > 0) {
                        if (_adAtTown) player.inventory['armor'] = (player.inventory['armor'] || 0) + caravan.guardArmor;
                        else { if (!player.townStorage[destTownId]) player.townStorage[destTownId] = {}; player.townStorage[destTownId]['armor'] = (player.townStorage[destTownId]['armor'] || 0) + caravan.guardArmor; }
                    }
                    if (caravan.carts > 0) {
                        if (_adAtTown) player.inventory['cart'] = (player.inventory['cart'] || 0) + caravan.carts;
                        else { if (!player.townStorage[destTownId]) player.townStorage[destTownId] = {}; player.townStorage[destTownId]['cart'] = (player.townStorage[destTownId]['cart'] || 0) + caravan.carts; }
                    }
                    if (caravan.wagons > 0) {
                        if (_adAtTown) player.inventory['wagon'] = (player.inventory['wagon'] || 0) + caravan.wagons;
                        else { if (!player.townStorage[destTownId]) player.townStorage[destTownId] = {}; player.townStorage[destTownId]['wagon'] = (player.townStorage[destTownId]['wagon'] || 0) + caravan.wagons; }
                    }
                    return;
                }

                // Handle round-trip / recurring logic
                if ((caravan.roundTrip || caravan.recurring) && !isReturnLeg) {
                    caravan.returnTrip = true;
                    caravan.progress = 0.0;
                    caravan._lastWaypointIdx = 0;
                    caravan.status = 'traveling';
                    if (caravan.route) {
                        caravan.route = caravan.route.slice().reverse().map(seg => ({
                            ...seg,
                            fromTownId: seg.toTownId,
                            toTownId: seg.fromTownId,
                            waypoints: seg.waypoints ? seg.waypoints.slice().reverse() : seg.waypoints
                        }));
                    }
                    Engine.logEvent(`${routeLabel} starting return trip to ${originTown ? originTown.name : 'origin'}.`, null, 'my_business');
                } else if (caravan.recurring && isReturnLeg) {
                    const maintenanceCost = CONFIG.CARAVAN_RECURRING_MAINTENANCE_PER_TRIP || 15;
                    let totalMaint = maintenanceCost + (caravan.guards * CONFIG.GUARD_WAGE * 2);
                    if (caravan.decoy) totalMaint += CONFIG.CARAVAN_DECOY_COST || 50;
                    if (caravan.armedEscort) totalMaint += CONFIG.CARAVAN_ARMED_ESCORT_COST || 80;
                    if (hasSkill('cheap_security')) totalMaint = Math.floor(totalMaint * 0.80);

                    if (player.gold < totalMaint) {
                        caravan.status = 'arrived';
                        caravan.active = false;
                        caravan.recurring = false;
                        logCaravan(caravan, '⛔ Recurring route stopped — insufficient funds for maintenance (' + totalMaint + 'g).');
                    } else {
                        player.gold -= totalMaint;
                        player.stats.totalGoldSpent += totalMaint;
                        caravan.totalSpent = (caravan.totalSpent || 0) + totalMaint;

                        if (caravan.orders && caravan.orders.length > 0) {
                            var hasCargoForNext = false;
                            for (var _ck in caravan.goods) { if (caravan.goods[_ck] > 0) { hasCargoForNext = true; break; } }
                            var hasDestOrders = caravan.orders.some(function(o) { return o.location === 'destination'; });
                            if (!hasCargoForNext && !hasDestOrders) {
                                caravan.status = 'arrived';
                                caravan.active = false;
                                caravan.recurring = false;
                                logCaravan(caravan, '⛔ Recurring route stopped — no cargo and no destination orders.');
                            } else {
                                caravan.returnTrip = false;
                                caravan.progress = 0.0;
                                caravan._lastWaypointIdx = 0;
                                caravan.status = 'traveling';
                                if (caravan.route) {
                                    caravan.route = caravan.route.slice().reverse().map(seg => ({
                                        ...seg, fromTownId: seg.toTownId, toTownId: seg.fromTownId,
                                        waypoints: seg.waypoints ? seg.waypoints.slice().reverse() : seg.waypoints
                                    }));
                                }
                                var rWeight = 0;
                                for (var _rk in caravan.goods) {
                                    var _rr = findResource(_rk);
                                    rWeight += (_rr ? _rr.weight : 1) * (caravan.goods[_rk] || 0);
                                }
                                caravan.totalWeight = rWeight;
                                logCaravan(caravan, '🔄 Recurring caravan departing again (maintenance: ' + totalMaint + 'g). Trip #' + (caravan.tripCount + 1));
                            }
                        } else {
                            const originId = caravan.fromTownId;
                            const reloadedGoods = {};
                            let reloaded = false;
                            let reloadWeight = 0;
                            const reloadCap = _getCaravanCapacity(caravan);
                            for (const [resId, qty] of Object.entries(caravan.originalGoods || {})) {
                                const carried = player.inventory[resId] || 0;
                                const stored = (player.townStorage[originId] || {})[resId] || 0;
                                const available = carried + stored;
                                const rw = (findResource(resId) || {}).weight || 1;
                                const fitQty = Math.floor((reloadCap - reloadWeight) / rw);
                                const loadQty = Math.min(qty, available, fitQty);
                                if (loadQty > 0) {
                                    const fromC = Math.min(loadQty, carried);
                                    const fromS = loadQty - fromC;
                                    if (fromC > 0) player.inventory[resId] = (player.inventory[resId] || 0) - fromC;
                                    if (fromS > 0 && player.townStorage[originId]) {
                                        player.townStorage[originId][resId] = (player.townStorage[originId][resId] || 0) - fromS;
                                        if (player.townStorage[originId][resId] <= 0) delete player.townStorage[originId][resId];
                                    }
                                    reloadedGoods[resId] = loadQty;
                                    reloadWeight += loadQty * rw;
                                    reloaded = true;
                                }
                            }
                            for (const [resId, qty] of Object.entries(caravan.goods)) {
                                if (qty <= 0) continue;
                                if (player.townId === originId) {
                                    player.inventory[resId] = (player.inventory[resId] || 0) + qty;
                                } else {
                                    const originTownObj = Engine.findTown(originId);
                                    if (originTownObj) {
                                        // v9p33river313: price-control aware + trade tax on recurring return sales.
                                        let price = Engine.getMarketPrice ? Engine.getMarketPrice(originId, resId) : (originTownObj.market.prices[resId] || 1);
                                        if (hasSkill('trade_route_mastery')) price *= 1.10;
                                        const rev = Math.floor(price * qty);
                                        player.gold += rev;
                                        player.stats.totalGoldEarned += rev;
                                        caravan.totalProfit = (caravan.totalProfit || 0) + rev;
                                        originTownObj.market.supply[resId] = (originTownObj.market.supply[resId] || 0) + qty;
                                        if (Engine.collectTradeTax) Engine.collectTradeTax(originTownObj.kingdomId, rev, resId, false, originTownObj.id);
                                        Engine.logEvent(`Recurring caravan sold return goods: ${qty} ${resId} for ${rev}g.`, { _noToast: true }, 'my_business');
                                    }
                                }
                            }

                            if (!reloaded) {
                                caravan.status = 'arrived';
                                caravan.active = false;
                                caravan.recurring = false;
                                Engine.logEvent(`Recurring route stopped — no goods available to reload at ${originTown ? originTown.name : 'origin'}.`, { _noToast: true }, 'my_business');
                            } else {
                                caravan.goods = reloadedGoods;
                                caravan.returnTrip = false;
                                caravan.progress = 0.0;
                                caravan._lastWaypointIdx = 0;
                                caravan.status = 'traveling';
                                if (caravan.route) {
                                    caravan.route = caravan.route.slice().reverse().map(seg => ({
                                        ...seg, fromTownId: seg.toTownId, toTownId: seg.fromTownId,
                                        waypoints: seg.waypoints ? seg.waypoints.slice().reverse() : seg.waypoints
                                    }));
                                }
                                let legacyWeight = 0;
                                for (const [resId, qty] of Object.entries(reloadedGoods)) {
                                    const res = findResource(resId);
                                    legacyWeight += (res ? res.weight : 1) * qty;
                                }
                                caravan.totalWeight = legacyWeight;
                                Engine.logEvent(`Recurring caravan reloaded and departing again (maintenance: ${totalMaint}g). Trip #${caravan.tripCount + 1}`, { _noToast: true }, 'my_business');
                            }
                        }
                    }
                } else {
                    // Simple one-way or return leg of one-time round-trip — done
                    caravan.status = 'arrived';
                    caravan.active = false;
                    if (isReturnLeg) {
                        for (const [resId, qty] of Object.entries(caravan.goods)) {
                            if (qty <= 0) continue;
                            if (player.townId === caravan.fromTownId) {
                                player.inventory[resId] = (player.inventory[resId] || 0) + qty;
                            } else {
                                const originTownObj = Engine.findTown(caravan.fromTownId);
                                if (originTownObj) {
                                    // v9p33river313: same price-control + tax fix for one-way return sales.
                                    let price = Engine.getMarketPrice ? Engine.getMarketPrice(caravan.fromTownId, resId) : (originTownObj.market.prices[resId] || 1);
                                    if (hasSkill('trade_route_mastery')) price *= 1.10;
                                    const rev = Math.floor(price * qty);
                                    player.gold += rev;
                                    player.stats.totalGoldEarned += rev;
                                    caravan.totalProfit = (caravan.totalProfit || 0) + rev;
                                    originTownObj.market.supply[resId] = (originTownObj.market.supply[resId] || 0) + qty;
                                    if (Engine.collectTradeTax) Engine.collectTradeTax(originTownObj.kingdomId, rev, resId, false, originTownObj.id);
                                    Engine.logEvent(`Return caravan sold goods at ${originTownObj.name}: ${qty} ${resId} for ${rev}g.`, { _noToast: true }, 'my_business');
                                }
                            }
                        }
                        caravan.goods = {};
                    }
                }
    }

    // Advance caravan positions smoothly (called 60x per day from subtick)
    function caravanSubtick() {
        _sync();
        var ticksPerDay = CONFIG.TICKS_PER_DAY || 60;

        // WASM fast path — batch all traveling caravans into typed array
        if (typeof WASM !== 'undefined' && WASM.ready() && WASM.caravanSubtick) {
            var _travelingCaravans = [];
            var _travelingIndices = [];
            var _hasExpNav = hasSkill('expert_navigator') ? 1 : 0;
            var _hasRoadK = hasSkill('road_knowledge') ? 1 : 0;
            var _hasCart = hasSkill('cartographer') ? 1 : 0;
            for (var _ci = 0; _ci < player.caravans.length; _ci++) {
                var _c = player.caravans[_ci];
                if (_c.status !== 'traveling') continue;
                var _shipEff = 1.0;
                if (_c.routeType === 'sea' && _c.shipId) {
                    var _sh = player.ships.find(function(s) { return s.id === _c.shipId; });
                    if (_sh) {
                        _shipEff = CONFIG.CONDITION_LEVELS[_sh.degradeCondition || 'new'] ? CONFIG.CONDITION_LEVELS[_sh.degradeCondition || 'new'].efficiency : 1.0;
                    }
                }
                _travelingCaravans.push(
                    _c.progress, _c.totalWeight || 0, _c.totalDist || 1,
                    CONFIG.CARAVAN_BASE_SPEED, _c.routeType === 'sea' ? 1 : 0,
                    _hasExpNav, _hasRoadK, _hasCart, _shipEff
                );
                _travelingIndices.push(_ci);
            }
            if (_travelingIndices.length > 0) {
                var _data = new Float64Array(_travelingCaravans);
                var _result = WASM.caravanSubtick(_data, _travelingIndices.length, ticksPerDay);
                if (_result && _result.progress && _result.progress.length >= _travelingIndices.length) {
                    for (var _ri = 0; _ri < _travelingIndices.length; _ri++) {
                        var _cv = player.caravans[_travelingIndices[_ri]];
                        _cv.progress = _result.progress[_ri];
                        if (_cv.progress >= 1.0) {
                            _cv.progress = 1.0;
                            _processCaravanArrival(_cv);
                        }
                    }
                    return;
                }
                // v9p33river329: invalid/overflow WASM result falls through to JS update instead of freezing/crashing.
            }
        }

        for (var ci = 0; ci < player.caravans.length; ci++) {
            var caravan = player.caravans[ci];
            if (caravan.status !== 'traveling') continue;

            var weightPenalty = 1 / (1 + caravan.totalWeight * 0.005);
            var caravanSpeed = CONFIG.CARAVAN_BASE_SPEED * weightPenalty;
            if (caravan.routeType === 'sea') {
                // Sea speed based on the caravan's assigned or rented ship
                if (hasSkill('expert_navigator')) caravanSpeed *= 1.20;
                if (caravan.shipId) {
                    var assignedShip = player.ships.find(function(s) { return s.id === caravan.shipId; });
                    if (assignedShip) {
                        var shipCondEff = CONFIG.CONDITION_LEVELS[assignedShip.degradeCondition || 'new'] ? CONFIG.CONDITION_LEVELS[assignedShip.degradeCondition || 'new'].efficiency : 1.0;
                        caravanSpeed *= Math.max(0.1, shipCondEff);
                    }
                }
                // Rental ships have no condition degradation — use stored speed
            } else {
                if (hasSkill('road_knowledge')) caravanSpeed *= 1.15;
                if (hasSkill('cartographer')) caravanSpeed *= 1.05;
            }
            caravan.progress += (caravanSpeed / Math.max(caravan.totalDist, 1)) / ticksPerDay;
            if (caravan.progress >= 1.0) {
                caravan.progress = 1.0;
                _processCaravanArrival(caravan);
            }
        }
    }

    function tickCaravans() {
        _sync();
        const rng = Engine.getRng();
        if (!rng) return;

        for (const caravan of player.caravans) {
            if (caravan.status !== 'traveling') continue;

            // Progress is now advanced per-subtick in caravanSubtick() for smooth map movement

            // Daily wage payment for carriers and guards
            var today = Engine.getDay();
            if (today > (caravan.lastWageDay || 0)) {
                var daysSinceWage = today - (caravan.lastWageDay || today);
                var cWage = caravan.carrierWage || (CONFIG.CARAVAN_CARRIER_WAGE || 4);
                var gWage = caravan.guardWage || (CONFIG.CARAVAN_GUARD_WAGE || 6);
                var dailyCrew = (caravan.carriers || 1) * cWage + (caravan.guards || 0) * gWage;
                // Add ship rental cost for sea caravans with rented ships
                var dailyRental = (caravan.rentalDailyCost || 0);
                if (hasSkill('thrifty_caravanner')) dailyCrew = Math.floor(dailyCrew * 0.75);
                if (hasSkill('cheap_security')) dailyCrew = Math.floor(dailyCrew * 0.80);
                var wageBill = (dailyCrew + dailyRental) * daysSinceWage;
                if (player.gold >= wageBill) {
                    player.gold -= wageBill;
                    logFinance(-wageBill, 'caravan_wages', 'Caravan crew wages');
                    player.stats.totalGoldSpent += wageBill;
                    caravan.totalSpent = (caravan.totalSpent || 0) + wageBill;
                    caravan.totalProfit = (caravan.totalProfit || 0) - wageBill;
                    caravan.daysUnpaid = 0;
                } else {
                    // Can't afford wages — crew gets unhappy
                    caravan.daysUnpaid = (caravan.daysUnpaid || 0) + daysSinceWage;

                    // Workers steal goods proportional to unpaid time
                    var stealRate = Math.min(0.05, 0.01 * caravan.daysUnpaid); // 1-5% per day
                    var totalStolen = 0;
                    for (var _sg in caravan.goods) {
                        if (caravan.goods[_sg] > 0) {
                            var stolen = Math.max(1, Math.ceil(caravan.goods[_sg] * stealRate));
                            stolen = Math.min(stolen, caravan.goods[_sg]);
                            caravan.goods[_sg] -= stolen;
                            if (caravan.goods[_sg] <= 0) delete caravan.goods[_sg];
                            totalStolen += stolen;
                        }
                    }
                    if (totalStolen > 0) {
                        logCaravan(caravan, '🤚 Unpaid crew stole ' + totalStolen + ' goods! (' + caravan.daysUnpaid + ' days unpaid)');
                    }

                    // After 7+ days unpaid, crew starts deserting
                    if (caravan.daysUnpaid >= 7) {
                        var desertedCarriers = 0;
                        var desertedGuards = 0;
                        // Each day over 7, 30% chance per crew member to desert
                        var desertChance = Math.min(0.60, 0.30 + (caravan.daysUnpaid - 7) * 0.05);
                        for (var _dc = 0; _dc < (caravan.carriers || 1); _dc++) {
                            if (rng.chance(desertChance)) desertedCarriers++;
                        }
                        for (var _dg = 0; _dg < (caravan.guards || 0); _dg++) {
                            if (rng.chance(desertChance)) desertedGuards++;
                        }
                        if (desertedCarriers > 0) {
                            caravan.carriers = Math.max(0, (caravan.carriers || 1) - desertedCarriers);
                            logCaravan(caravan, '🚪 ' + desertedCarriers + ' carrier(s) deserted! Remaining: ' + caravan.carriers);
                        }
                        if (desertedGuards > 0) {
                            caravan.guards = Math.max(0, (caravan.guards || 0) - desertedGuards);
                            logCaravan(caravan, '🚪 ' + desertedGuards + ' guard(s) deserted! Remaining: ' + caravan.guards);
                        }

                        // If all carriers are gone, caravan is destroyed
                        if ((caravan.carriers || 0) <= 0) {
                            logCaravan(caravan, '💀 All carriers deserted — caravan abandoned and destroyed!');
                            Engine.logEvent('Your caravan to ' + (Engine.findTown(caravan.toTownId) || {}).name + ' was abandoned after all carriers deserted!', null, 'my_business');
                            caravan.status = 'destroyed';
                            caravan.active = false;
                            caravan.recurring = false;
                            caravan.goods = {};
                            continue;
                        }
                    }
                }
                caravan.lastWageDay = today;
            }

            if (caravan.routeType === 'sea') {
                // Sea caravan — check for storms instead of bandits
                let stormChance = CONFIG.STORM_RISK_PER_TRIP || 0.05;
                if (hasSkill('expert_navigator')) stormChance *= 0.90;
                // v9p33river432: only the caravan's assigned ship should affect storm risk.
                var _stormShip = _findAssignedCaravanShip(caravan);
                if (_stormShip && _stormShip.degradeCondition === 'breaking') {
                    stormChance *= 2;
                }

                // Check for active storm/pirate events
                const w = Engine.getWorld();
                if (w) {
                    for (const ev of w.events) {
                        if (!ev.active) continue;
                        if (ev.type === 'storm_season') stormChance *= (ev.seaRiskMultiplier || 2);
                        if (ev.type === 'pirates') {
                            if (ev.townId === caravan.fromTownId || ev.townId === caravan.toTownId) {
                                stormChance *= (ev.seaRiskMultiplier || 3);
                            }
                        }
                        if (ev.type === 'naval_blockade') {
                            if (ev.townId === caravan.toTownId) {
                                // v9p33river432: blockade cargo stays with the blocked caravan so rescue can resume the run.
                                caravan.status = 'blocked';
                                caravan.active = false;
                                Engine.logEvent('Your sea caravan was turned back by a naval blockade!', null, 'combat');
                                logCaravan(caravan, '⛔ Naval blockade halted the voyage. Cargo remains aboard pending rescue.');
                                break;
                            }
                        }
                    }
                }

                // Skip further processing if blocked by naval blockade
                if (caravan.status === 'blocked') continue;

                // Scale storm chance per-tick (not per-trip)
                const stormChancePerTick = stormChance / 30;
                if (rng.chance(stormChancePerTick)) {
                    const lossRate = rng.randFloat(CONFIG.STORM_LOSS_MIN || 0.10, CONFIG.STORM_LOSS_MAX || 0.30);
                    let totalLost = 0;
                    for (const resId in caravan.goods) {
                        const lost = Math.ceil(caravan.goods[resId] * lossRate);
                        caravan.goods[resId] = Math.max(0, caravan.goods[resId] - lost);
                        if (caravan.goods[resId] <= 0) delete caravan.goods[resId]; // v9p33river432: storm losses should not leave zero-qty cargo keys behind.
                        totalLost += lost;
                    }
                    if (totalLost > 0) {
                        Engine.logEvent(`A storm struck your sea caravan! Lost ${totalLost} goods to the waves.`, null, 'travel_events');
                    }
                }
            } else {
                // Land caravan — new crew-based theft/kill system
                var cGuards = caravan.guards || 0;
                var cWeapons = caravan.guardWeapons || 0;
                var cArmor = caravan.guardArmor || 0;

                // Determine road/war/connection factors
                const currentSegIdx = Math.min(
                    Math.floor(caravan.progress * caravan.route.length),
                    caravan.route.length - 1
                );
                const currentSeg = caravan.route[currentSegIdx];
                var isRoadUnsafe = currentSeg && (currentSeg.safe === false || (currentSeg.banditThreat || 0) > (CONFIG.BANDIT_THREAT_DANGER_THRESHOLD || 50));
                var isAtWar = false;
                var isConnUnsafe = false;
                const w = Engine.getWorld();
                if (w) {
                    // Check war status
                    if (w.kingdoms) {
                        var fTown = Engine.findTown(caravan.fromTownId);
                        var tTown = Engine.findTown(caravan.toTownId);
                        for (var wki = 0; wki < w.kingdoms.length; wki++) {
                            if ((fTown && w.kingdoms[wki].id === fTown.kingdomId) || (tTown && w.kingdoms[wki].id === tTown.kingdomId)) {
                                if (w.kingdoms[wki].atWar && (w.kingdoms[wki].atWar instanceof Set ? w.kingdoms[wki].atWar.size > 0 : Array.isArray(w.kingdoms[wki].atWar) ? w.kingdoms[wki].atWar.length > 0 : !!w.kingdoms[wki].atWar)) isAtWar = true;
                            }
                        }
                    }
                    // Check connection town security
                    if (currentSeg) {
                        var segFrom = Engine.findTown(currentSeg.fromTownId);
                        var segTo = Engine.findTown(currentSeg.toTownId);
                        if ((segFrom && (segFrom.security || 50) < 40) || (segTo && (segTo.security || 50) < 40)) isConnUnsafe = true;
                    }
                    // Bandit surge event multiplier
                    for (var evi = 0; evi < w.events.length; evi++) {
                        var ev = w.events[evi];
                        if (ev.active && ev.type === 'bandit_surge') {
                            if (currentSeg && (currentSeg.fromTownId === ev.townId || currentSeg.toTownId === ev.townId)) {
                                isRoadUnsafe = true; // force unsafe for surge
                            }
                        }
                    }
                }

                // Calculate daily theft and kill chances
                var dTheft = CONFIG.CARAVAN_BASE_DAILY_THEFT || 0.0012;
                var dKill = CONFIG.CARAVAN_BASE_DAILY_KILL || 0.0005;
                var roadM = isRoadUnsafe ? (CONFIG.CARAVAN_ROAD_UNSAFE_MULT || 2.0) : 1.0;
                var warM = isAtWar ? (CONFIG.CARAVAN_WAR_MULT || 1.5) : 1.0;
                var connM = isConnUnsafe ? (CONFIG.CARAVAN_UNSAFE_CONN_MULT || 1.2) : 1.0;
                var grdM = Math.pow(CONFIG.CARAVAN_PER_GUARD_MULT || 0.55, cGuards);
                var wpnM = Math.pow(CONFIG.CARAVAN_PER_WEAPON_MULT || 0.85, cWeapons);
                var armM = Math.pow(CONFIG.CARAVAN_PER_ARMOR_MULT || 0.90, cArmor);
                // More carriers = bigger target
                var crrM = 1 + ((caravan.carriers || 1) - 1) * (CONFIG.CARAVAN_PER_CARRIER_RISK || 0.08);
                // Legacy security bonuses
                var decM = caravan.decoy ? 0.60 : 1.0;
                var frtM = caravan.fortified ? 0.85 : 1.0;
                // Skill bonuses
                if (hasSkill('street_smart')) { dTheft *= 0.90; dKill *= 0.90; }
                if (hasSkill('intimidating_presence')) { dTheft *= 0.85; dKill *= 0.85; }

                var theftChance = dTheft * roadM * warM * connM * crrM * grdM * wpnM * armM * decM * frtM;
                var killChance = dKill * roadM * warM * connM * crrM * grdM * wpnM * armM * frtM;

                // Theft check
                if (rng.chance(theftChance)) {
                    var lossRate = cGuards > 0 ? rng.randFloat(0.05, 0.20) : rng.randFloat(0.20, 0.60);
                    var totalLost = 0;
                    for (var _tr in caravan.goods) {
                        var lost = Math.ceil((caravan.goods[_tr] || 0) * lossRate);
                        caravan.goods[_tr] = Math.max(0, (caravan.goods[_tr] || 0) - lost);
                        if (caravan.goods[_tr] <= 0) delete caravan.goods[_tr];
                        totalLost += lost;
                    }
                    if (totalLost > 0) {
                        logCaravan(caravan, '🏴‍☠️ Bandits raided the caravan! Lost ' + totalLost + ' goods.');
                        // Guards may take casualties
                        if (cGuards > 0 && rng.chance(0.15)) {
                            caravan.guards = Math.max(0, caravan.guards - 1);
                            logCaravan(caravan, '⚔️ A guard was injured in the attack. Guards: ' + caravan.guards);
                        }
                    }
                }

                // Kill check (caravan destroyed)
                if (rng.chance(killChance)) {
                    logCaravan(caravan, '💀 The caravan was ambushed and destroyed!');
                    caravan.status = 'destroyed';
                    caravan.active = false;
                    caravan.goods = {};
                    // Strand passengers — return them to their origin towns
                    if (caravan.passengers && caravan.passengers.length > 0) {
                        logCaravan(caravan, '🚌 ' + caravan.passengers.length + ' passengers stranded by attack.');
                        caravan.passengers = [];
                    }
                    continue;
                }
            }

            // Waypoint order processing — check if caravan passed through intermediate towns
            if (caravan.orders && caravan.orders.length > 0 && caravan.route && caravan.route.length > 1 && caravan.progress < 1.0) {
                var hasWaypoints = caravan.orders.some(function(o) { return o.location && o.location.indexOf('waypoint:') === 0; });
                if (hasWaypoints) {
                    var cumDist = 0;
                    var lastWp = caravan._lastWaypointIdx || 0;
                    for (var wsi = 0; wsi < caravan.route.length; wsi++) {
                        var seg = caravan.route[wsi];
                        var segA = Engine.findTown(seg.fromTownId);
                        var segB = Engine.findTown(seg.toTownId);
                        if (segA && segB) cumDist += Math.hypot(segA.x - segB.x, segA.y - segB.y) / (CONFIG.CARAVAN_ROAD_MULTIPLIER[seg.quality] || 1);
                        var segProgress = cumDist / Math.max(caravan.totalDist, 1);
                        if (wsi > lastWp && caravan.progress >= segProgress) {
                            // Caravan just passed through this segment's endpoint
                            var waypointTownId = seg.toTownId;
                            if (waypointTownId !== caravan.fromTownId && waypointTownId !== caravan.toTownId) {
                                processCaravanOrders(caravan, waypointTownId, caravan.returnTrip);
                                _processCaravanPassengers(caravan, waypointTownId);
                                caravan._lastWaypointIdx = wsi;
                            }
                        }
                    }
                }
            }

            // Check arrival (fallback — normally processed instantly in caravanSubtick)
            if (caravan.progress >= 1.0) {
                _processCaravanArrival(caravan);
            }
        }

        // Release ships from any inactive caravans
        for (var _rc = 0; _rc < player.caravans.length; _rc++) {
            var _rcc = player.caravans[_rc];
            if (!_rcc.active && _rcc.shipId) _releaseCaravanShip(_rcc);
        }

        // Clean up old arrived/destroyed/blocked caravans (keep last 20, only non-active)
        const finished = player.caravans.filter(c => !c.active && (c.status === 'arrived' || c.status === 'destroyed' || c.status === 'blocked'));
        if (finished.length > 20) {
            const toRemove = finished.slice(0, finished.length - 20);
            player.caravans = player.caravans.filter(c => !toRemove.includes(c));
        }

        // Clean old log entries (>90 days)
        cleanCaravanLogs();
    }

    // ═══════════════════════════════════════════════════════════
    // AUTO-DISBAND CONDITION CHECKER
    // ═══════════════════════════════════════════════════════════
    function checkAutoDisbandConditions(caravan, currentTownId) {
        _sync();
        if (!caravan.autoDisbandConditions || caravan.autoDisbandConditions.length === 0) return null;
        for (var i = 0; i < caravan.autoDisbandConditions.length; i++) {
            var cond = caravan.autoDisbandConditions[i];
            var checkTownId = cond.location === 'source' ? caravan.fromTownId : caravan.toTownId;
            // Only check conditions relevant to the town we just arrived at
            if (checkTownId !== currentTownId) continue;
            var town = Engine.findTown(checkTownId);
            if (!town) continue;
            var townName = town.name || checkTownId;
            var resObj = cond.good ? findResource(cond.good) : null;
            var resName = resObj ? resObj.name : (cond.good || '');

            if (cond.type === 'no_supply') {
                var supply = (town.market && town.market.supply && town.market.supply[cond.good]) || 0;
                if (supply <= 0) {
                    return '📦 Auto-disband: no ' + resName + ' available at ' + townName;
                }
            } else if (cond.type === 'storage_full') {
                // Check if ALL player buildings at this town have full input storage
                var townBuildings = player.buildings.filter(function(b) { return b.townId === checkTownId && b.active; });
                if (townBuildings.length === 0) {
                    return '🏭 Auto-disband: no buildings at ' + townName;
                }
                var allFull = true;
                for (var bi = 0; bi < townBuildings.length; bi++) {
                    var bld = townBuildings[bi];
                    var bt = null;
                    for (var bk in BUILDING_TYPES) { if (BUILDING_TYPES[bk].id === bld.type) { bt = BUILDING_TYPES[bk]; break; } }
                    var cap = bt ? _bldStorageCap(bt.storage, bld.level) : 0;
                    var used = 0;
                    // v9p33river432: auto-disband input checks must ignore output goods in mixed building inventories.
                    var _adOutSet = {};
                    if (bt && bt.produces) _adOutSet[bt.produces] = true;
                    if (bt && bt.canProduce) { for (var _adi = 0; _adi < bt.canProduce.length; _adi++) _adOutSet[bt.canProduce[_adi]] = true; }
                    if (bld.inventory) { for (var ik in bld.inventory) { if (_adOutSet[ik]) continue; var rw = (findResource(ik) || {}).weight || 1; used += (bld.inventory[ik] || 0) * rw; } }
                    if (used < cap) { allFull = false; break; }
                }
                if (allFull) {
                    return '🏭 Auto-disband: all building storage full at ' + townName;
                }
            } else if (cond.type === 'price_above') {
                var priceA = (town.market && town.market.prices && town.market.prices[cond.good]) || 0;
                if (priceA > 0 && priceA >= cond.price) {
                    return '📈 Auto-disband: ' + resName + ' price (' + Math.floor(priceA) + 'g) ≥ ' + cond.price + 'g at ' + townName;
                }
            } else if (cond.type === 'price_below') {
                var priceB = (town.market && town.market.prices && town.market.prices[cond.good]) || 0;
                if (priceB > 0 && priceB <= cond.price) {
                    return '📉 Auto-disband: ' + resName + ' price (' + Math.floor(priceB) + 'g) ≤ ' + cond.price + 'g at ' + townName;
                }
            } else if (cond.type === 'trip_count') {
                if ((caravan.tripCount || 0) >= (cond.count || 1)) {
                    return '🔢 Auto-disband: completed ' + caravan.tripCount + ' trips (limit: ' + cond.count + ')';
                }
            } else if (cond.type === 'profit_below') {
                var avgProfit = (caravan.tripCount > 0) ? Math.floor((caravan.totalProfit || 0) / caravan.tripCount) : 0;
                if (caravan.tripCount >= 2 && avgProfit < (cond.amount || 0)) {
                    return '💰 Auto-disband: avg profit/trip (' + avgProfit + 'g) below ' + cond.amount + 'g';
                }
            }
        }
        return null;
    }

    function setAutoDisbandConditions(caravanId, conditions) {
        _sync();
        var caravan = player.caravans.find(function(c) { return c.id === caravanId && c.active; });
        if (!caravan) return { success: false, message: 'No active caravan with that ID.' };
        caravan.autoDisbandConditions = conditions ? structuredClone(conditions) : [];
        logCaravan(caravan, '⚙️ Auto-disband conditions updated (' + caravan.autoDisbandConditions.length + ' rules).');
        return { success: true, message: 'Auto-disband conditions set (' + caravan.autoDisbandConditions.length + ' rules).' };
    }

    function rescueCaravan(caravanId) {
        _sync();
        const caravan = player.caravans.find(c => c.id === caravanId && c.status === 'blocked');
        if (!caravan) return { success: false, message: 'No blocked caravan with that ID.' };
        const rescueCost = CONFIG.CARAVAN_BLOCKED_RESCUE_COST || 100;
        if (player.gold < rescueCost) {
            return { success: false, message: `Not enough gold. Rescue costs ${rescueCost}g.` };
        }
        player.gold -= rescueCost;
        player.stats.totalGoldSpent += rescueCost;
        caravan.status = 'traveling';
        caravan.active = true; // v9p33river432: blocked rescues must reactivate the caravan or it never moves again.
        caravan.progress = Math.max(0, caravan.progress - 0.1);
        Engine.logEvent(`Caravan rescued for ${rescueCost}g. It continues its journey.`, { _noToast: true }, 'my_business');
        return { success: true, message: `Caravan rescued for ${rescueCost}g.` };
    }

    function cancelRecurringRoute(caravanId) {
        _sync();
        const caravan = player.caravans.find(c => c.id === caravanId && c.recurring && c.active);
        if (!caravan) return { success: false, message: 'No active recurring route with that ID.' };
        caravan.recurring = false;
        caravan.active = caravan.status === 'traveling';
        Engine.logEvent(`Recurring caravan route cancelled. Current trip will complete.`, { _noToast: true }, 'my_business');
        return { success: true, message: 'Recurring route cancelled. Current trip will finish.' };
    }

    function disbandCaravan(caravanId) {
        _sync();
        var caravan = player.caravans.find(function(c) { return c.id === caravanId && c.active; });
        if (!caravan) return { success: false, message: 'No active caravan with that ID.' };
        if (caravan.disbanding) return { success: false, message: 'Caravan is already disbanding.' };

        caravan.disbanding = true;
        caravan.recurring = false;

        // Determine behavior based on current state:
        // If on outbound leg → continue to destination, drop goods there, return to origin, disband
        // If on return leg → continue to origin, drop goods there, disband
        // The arrival logic will handle dropping goods instead of selling
        var isReturn = caravan.returnTrip;
        var destName = Engine.findTown(caravan.toTownId) ? Engine.findTown(caravan.toTownId).name : caravan.toTownId;
        var originName = Engine.findTown(caravan.fromTownId) ? Engine.findTown(caravan.fromTownId).name : caravan.fromTownId;

        logCaravan(caravan, '🏳️ Caravan set to disband. Will finish last run and drop off all goods.');
        if (isReturn) {
            Engine.logEvent('Caravan disbanding — finishing return to ' + originName + ', then will disband.', { _noToast: true }, 'my_business');
            return { success: true, message: 'Caravan disbanding. Finishing return to ' + originName + ' and will drop off all goods.' };
        } else {
            // Outbound: will go to destination, drop goods, return, disband
            caravan.roundTrip = true; // ensure it does a return leg
            Engine.logEvent('Caravan disbanding — finishing trip to ' + destName + ', returning goods to ' + originName + ', then will disband.', { _noToast: true }, 'my_business');
            return { success: true, message: 'Caravan disbanding. Will deliver to ' + destName + ', return to ' + originName + ', and drop off remaining goods.' };
        }
    }

    function forceDisbandCaravan(caravanId) {
        _sync();
        var caravan = player.caravans.find(function(c) { return c.id === caravanId && c.active; });
        if (!caravan) return { success: false, message: 'No active caravan with that ID.' };

        // Drop goods at origin town storage (or player inventory if in same town)
        var dropTownId = caravan.fromTownId;
        if (!player.townStorage[dropTownId]) player.townStorage[dropTownId] = {};
        var totalDropped = 0;
        for (var gk in caravan.goods) {
            if (caravan.goods[gk] > 0) {
                if (player.townId === dropTownId) {
                    player.inventory[gk] = (player.inventory[gk] || 0) + caravan.goods[gk];
                } else {
                    player.townStorage[dropTownId][gk] = (player.townStorage[dropTownId][gk] || 0) + caravan.goods[gk];
                }
                totalDropped += caravan.goods[gk];
            }
        }

        // Return equipment to origin town storage
        if (caravan.carrierHorses > 0) {
            // Horses go to player inventory (slot-based, not weight-based) regardless of location
            player.inventory['horses'] = (player.inventory['horses'] || 0) + caravan.carrierHorses;
        }
        if (caravan.carts > 0) {
            if (player.townId === dropTownId) {
                player.inventory['cart'] = (player.inventory['cart'] || 0) + caravan.carts;
            } else {
                player.townStorage[dropTownId]['cart'] = (player.townStorage[dropTownId]['cart'] || 0) + caravan.carts;
            }
        }
        if (caravan.wagons > 0) {
            if (player.townId === dropTownId) {
                player.inventory['wagon'] = (player.inventory['wagon'] || 0) + caravan.wagons;
            } else {
                player.townStorage[dropTownId]['wagon'] = (player.townStorage[dropTownId]['wagon'] || 0) + caravan.wagons;
            }
        }

        caravan.goods = {};
        caravan.status = 'arrived';
        caravan.active = false;
        caravan.recurring = false;
        caravan.disbanding = false;

        // Strand passengers
        if (caravan.passengers && caravan.passengers.length > 0) {
            logCaravan(caravan, '🚌 ' + caravan.passengers.length + ' passengers stranded by force-disband.');
            caravan.passengers = [];
        }

        var originName = Engine.findTown(dropTownId) ? Engine.findTown(dropTownId).name : 'origin';
        logCaravan(caravan, '❌ Caravan force-disbanded. ' + (totalDropped > 0 ? totalDropped + ' goods dropped at ' + originName + '.' : 'No goods to drop.'));
        Engine.logEvent('Caravan force-disbanded. Equipment returned to ' + originName + '.', { _noToast: true }, 'my_business');
        return { success: true, message: 'Caravan disbanded immediately. Goods & equipment returned to ' + originName + '.' };
    }

    function getActiveRoutes() {
        _sync();
        return player.caravans.filter(c => c.active && (c.status === 'traveling' || c.recurring));
    }


    // ── Exports: attach to Player ──
    // §6b PASSENGER TRANSPORT
    Player.getTransportCapacity = getTransportCapacity;
    Player.getSeaTransportCapacity = getSeaTransportCapacity;
    Player.useNPCTransport = useNPCTransport;
    Player.setupTransport = setupTransport;
    Player.completeTransport = completeTransport;
    Player.cancelTransport = cancelTransport;
    Player._checkRouteQuarantine = _checkRouteQuarantine;
    Player._quarantinePunishment = _quarantinePunishment;
    Player.getRouteQuarantineInfo = getRouteQuarantineInfo;
    Player.attemptQuarantineSneak = attemptQuarantineSneak;
    Player.attemptQuarantineBribe = attemptQuarantineBribe;
    Player.attemptQuarantineDoctorPersuasion = attemptQuarantineDoctorPersuasion;
    Player.travelTo = travelTo;
    Player._bldStorageCap = _bldStorageCap;
    Player.qualityCraftChance = _qualityCraftChance;
    Player._smartInputLimit = _smartInputLimit;
    Player.getUpgradeCost = getUpgradeCost;
    Player.upgradeBuilding = upgradeBuilding;

    // §5 CARAVAN TICK
    Player.getCaravanHireRates = getCaravanHireRates;
    Player.logCaravan = logCaravan;
    Player.cleanCaravanLogs = cleanCaravanLogs;
    Player.processCaravanOrders = processCaravanOrders;
    Player.getCaravanLog = getCaravanLog;
    Player.editCaravanOrders = editCaravanOrders;
    Player.getCaravanStats = getCaravanStats;
    Player.editCaravanEquipment = editCaravanEquipment;
    Player.rescueCaravan = rescueCaravan;
    Player.cancelRecurringRoute = cancelRecurringRoute;
    Player.disbandCaravan = disbandCaravan;
    Player.forceDisbandCaravan = forceDisbandCaravan;
    Player.setAutoDisbandConditions = setAutoDisbandConditions;
    Player.getActiveRoutes = getActiveRoutes;
    Player.caravanSubtick = caravanSubtick;
    Player.tickCaravans = tickCaravans;
    Player.checkAutoDisbandConditions = checkAutoDisbandConditions;

})(window.Player);